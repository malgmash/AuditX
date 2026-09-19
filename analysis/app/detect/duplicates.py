"""Detector 1: duplicate receipts.

Three layers, cheapest first, stopping at the first hit so one pair of receipts produces one
finding and not three. The cross-user rule replaces the layer's rule id when the two submitters
differ. The highest-precision detector, and the one that may place a hold.
"""

from __future__ import annotations

from collections import defaultdict

from app.detect.rules import RULES
from app.detect.hashing import lookalike_counts
from app.detect.recurring import recurring_ids
from app.detect.types import DetectionContext, DetectorConfig, ExpenseRec, FindingDraft

LAYER_RULE = {
    "EXACT": "DUP_RECEIPT_EXACT",
    "IMAGE": "DUP_RECEIPT_IMAGE",
    "FIELDS": "DUP_RECEIPT_FIELDS",
}


def _hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def _within(a: int, b: int, tolerance: float) -> bool:
    return abs(a - b) <= tolerance * max(a, b)


def _days_apart(a: ExpenseRec, b: ExpenseRec) -> int:
    return abs((a.incurred_at.date() - b.incurred_at.date()).days)


def _same_time(a: ExpenseRec, b: ExpenseRec, cfg: DetectorConfig) -> bool:
    """One purchase has one transaction time. Only decisive when both claims carry it."""
    if not (a.has_time and b.has_time):
        return True
    return abs((a.incurred_at - b.incurred_at).total_seconds()) / 60 <= cfg.dup_time_window_minutes


def _corroborated(a: ExpenseRec, b: ExpenseRec, cfg: DetectorConfig) -> bool:
    """A close hash alone is not enough. Receipts share a layout, so distinct receipts can land
    near each other. Require the same merchant on the same or the next day, and the same
    transaction time when both are known. Amounts are free for one person, since a copied receipt
    with an inflated amount is exactly what the image layer exists to catch. Between two people
    the amounts must agree, because a colleague's copy of a receipt carries the same total."""
    if not (a.merchant_key and a.merchant_key == b.merchant_key):
        return False
    if _days_apart(a, b) > cfg.dup_date_window_days or not _same_time(a, b, cfg):
        return False
    if a.user_id != b.user_id:
        return _within(a.amount_cents, b.amount_cents, cfg.dup_amount_tolerance)
    return True


def _fields_match(p: ExpenseRec, e: ExpenseRec, recurring: set[str], cfg: DetectorConfig) -> bool:
    if not e.merchant_key or p.merchant_key != e.merchant_key:
        return False
    if _days_apart(p, e) > cfg.dup_date_window_days:
        return False
    if not _within(p.amount_cents, e.amount_cents, cfg.dup_amount_tolerance):
        return False
    amount = max(p.amount_cents, e.amount_cents)
    if amount < cfg.dup_fields_min_cents:
        return False
    if not (p.has_time and e.has_time) and amount < cfg.dup_fields_min_untimed_cents:
        return False
    # A different photo of the same purchase carries the same transaction time. When both times
    # are known they must agree, which rules out two similar fares or two similar lunches.
    if p.has_time and e.has_time:
        minutes = abs((p.incurred_at - e.incurred_at).total_seconds()) / 60
        if minutes > cfg.dup_time_window_minutes:
            return False
    if p.user_id == e.user_id:
        return not (p.id in recurring and e.id in recurring)
    # Two people at the same merchant for the same amount is often coincidence. Without a printed
    # time on both there is nothing to tie the two claims to one purchase.
    if not (p.has_time and e.has_time):
        return False
    return amount >= cfg.dup_cross_user_fields_min_cents


def detect(ctx: DetectionContext) -> list[FindingDraft]:
    cfg = ctx.config
    receipts = {r.id: r for r in ctx.receipts}
    exps = sorted(ctx.expenses, key=lambda e: (e.submitted_at, e.id))

    phash_int: dict[str, int] = {}
    phash_bits: dict[str, int] = {}
    sha_of: dict[str, str] = {}
    for e in exps:
        r = receipts.get(e.receipt_id) if e.receipt_id else None
        if r is not None:
            phash_int[e.id] = int(r.phash, 16)
            phash_bits[e.id] = 4 * len(r.phash)
            sha_of[e.id] = r.sha256

    recurring = recurring_ids(exps, cfg, cfg.dup_amount_tolerance)
    lookalikes = lookalike_counts({r.id: r.phash for r in ctx.receipts}, cfg.phash_max_fraction)

    first_by_sha: dict[str, ExpenseRec] = {}
    by_merchant: dict[str, list[ExpenseRec]] = defaultdict(list)
    findings: list[FindingDraft] = []

    for e in exps:
        layer: str | None = None
        prior: ExpenseRec | None = None
        distance: int | None = None

        if e.id in sha_of:
            p = first_by_sha.get(sha_of[e.id])
            if p is not None:
                layer, prior = "EXACT", p

        if layer is None and e.id in phash_int and lookalikes.get(e.receipt_id, 0) <= cfg.phash_max_lookalikes:
            best: tuple[int, ExpenseRec] | None = None
            threshold = int(cfg.phash_max_fraction * phash_bits[e.id])
            # Corroboration requires the same merchant, so only that merchant's claims are compared.
            for p in by_merchant.get(e.merchant_key, []):
                pp = phash_int.get(p.id)
                if pp is None or lookalikes.get(p.receipt_id, 0) > cfg.phash_max_lookalikes:
                    continue
                d = _hamming(phash_int[e.id], pp)
                if d <= threshold and _corroborated(e, p, cfg):
                    if best is None or d < best[0]:
                        best = (d, p)
            if best is not None:
                layer, prior, distance = "IMAGE", best[1], best[0]

        if layer is None:
            for p in by_merchant.get(e.merchant_key, []):
                if _fields_match(p, e, recurring, cfg):
                    layer, prior = "FIELDS", p
                    break

        if layer is not None and prior is not None:
            cross = prior.user_id != e.user_id
            spec = RULES["DUP_RECEIPT_CROSS_USER" if cross else LAYER_RULE[layer]]
            layer_conf = RULES[LAYER_RULE[layer]].confidence
            # A cross-user match on file or image evidence is at least the cross-user confidence.
            # On fields alone it keeps the field layer's lower confidence, because two people at
            # one merchant for a similar amount can be coincidence, so it opens a case and cannot
            # place a hold.
            confidence = max(spec.confidence, layer_conf) if cross and layer != "FIELDS" else (layer_conf if cross else spec.confidence)
            if distance is None and layer == "EXACT":
                distance = 0
            findings.append(
                FindingDraft(
                    rule_id=spec.id,
                    subject_user_id=e.user_id,
                    confidence=confidence,
                    amount_at_risk_cents=e.amount_cents,
                    evidence={
                        "matched_layer": layer,
                        "hamming_distance": distance,
                        "amount_cents_prior": prior.amount_cents,
                        "amount_cents_this": e.amount_cents,
                        "days_apart": _days_apart(prior, e),
                        "same_user": not cross,
                        "prior_expense_id": prior.id,
                        "prior_user_id": prior.user_id,
                        "prior_submitted_at": prior.submitted_at.isoformat(),
                    },
                    dedupe_key=f"DUP:{prior.id}:{e.id}",
                    detected_at=ctx.now,
                    expense_ids=[prior.id, e.id],
                    receipt_ids=[
                        rid for rid in (prior.receipt_id, e.receipt_id) if rid is not None
                    ],
                )
            )

        by_merchant[e.merchant_key].append(e)
        if e.id in sha_of:
            first_by_sha.setdefault(sha_of[e.id], e)

    return findings
