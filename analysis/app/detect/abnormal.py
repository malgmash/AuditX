"""Detector 2: abnormal expenses.

Amounts far outside the employee's own history or their peer group's, category mismatches,
velocity spikes and off-pattern timing. Highest volume, so it fills the review queue.

Baselines use only data that existed before the claim under test, so a detector never sees the
future and re-running it on the same data gives the same answer.
"""

from __future__ import annotations

from bisect import bisect_right
from collections import defaultdict
from datetime import datetime, timedelta

from app.detect.recurring import recurring_ids
from app.detect.rules import RULES
from app.detect.stats import MAD_SCALE, amount_floor_cents, median_mad, robust_z
from app.detect.types import DetectionContext, ExpenseRec, FindingDraft

# Categories that can honestly describe the same purchase.
_COMPATIBLE = [
    {"Meals", "Client Entertainment"},
    {"Travel", "Lodging", "Transport"},
    {"Equipment", "Supplies", "Software"},
]


def _compatible(a: str, b: str) -> bool:
    if a == b or "Other" in (a, b):
        return True
    return any(a in g and b in g for g in _COMPATIBLE)


def _months_between(a: datetime, b: datetime) -> float:
    return (b - a).days / 30.4


def _persistence_factor(
    flag_times: list[datetime], at: datetime, cfg, *, window_days: int, full_count: int
) -> tuple[float, int]:
    """One isolated outlier is weak evidence, since legitimate one-off purchases exist. Repeated
    outliers in the same category within the window are a pattern and keep full confidence."""
    window = timedelta(days=window_days)
    n = sum(1 for t in flag_times if at - window <= t <= at)
    return (1.0 if n >= full_count else cfg.isolated_outlier_factor), n


def _amount_self(ctx: DetectionContext, exps: list[ExpenseRec], first_at: dict[str, datetime], recurring: set[str]):
    cfg = ctx.config
    spec = RULES["EXP_AMOUNT_OUTLIER_SELF"]
    history: dict[tuple[str, str], list[ExpenseRec]] = defaultdict(list)
    flagged: dict[str, dict] = {}
    for e in exps:
        if e.id in recurring:
            continue
        key = (e.user_id, e.category)
        months = _months_between(first_at[e.user_id], e.incurred_at)
        prior = history[key]
        if months >= 1 and len(prior) >= cfg.self_min_samples:
            threshold = cfg.self_z_full if months >= 3 else cfg.self_z_partial
            med, mad = median_mad([p.amount_cents for p in prior])
            z = robust_z(e.amount_cents, med, mad, floor=amount_floor_cents(med))
            excess = e.amount_cents - med
            if excess > 0 and z >= threshold and excess >= cfg.self_min_excess_cents:
                flagged[e.id] = {
                    "e": e, "z": z, "med": med, "mad": mad, "n": len(prior),
                    "threshold": threshold, "months": months,
                }
        prior.append(e)

    times: dict[tuple[str, str], list[datetime]] = defaultdict(list)
    for f in flagged.values():
        times[(f["e"].user_id, f["e"].category)].append(f["e"].incurred_at)

    out = []
    for f in flagged.values():
        e = f["e"]
        factor, n_recent = _persistence_factor(
            times[(e.user_id, e.category)], e.incurred_at, cfg,
            window_days=cfg.persistence_window_days, full_count=cfg.persistence_full_count,
        )
        out.append(
            FindingDraft(
                rule_id=spec.id,
                subject_user_id=e.user_id,
                confidence=round(spec.confidence * factor, 4),
                amount_at_risk_cents=int(e.amount_cents - f["med"]),
                evidence={
                    "category": e.category,
                    "amount_cents": e.amount_cents,
                    "median_cents": int(f["med"]),
                    "mad_cents": int(f["mad"]),
                    "robust_z": round(f["z"], 2),
                    "z_threshold": f["threshold"],
                    "sample_size": f["n"],
                    "months_of_history": round(f["months"], 1),
                    "outliers_in_window": n_recent,
                },
                dedupe_key=f"{spec.id}:{e.id}",
                detected_at=ctx.now,
                expense_ids=[e.id],
                receipt_ids=[e.receipt_id] if e.receipt_id else [],
            )
        )
    return out


def _amount_peer(ctx: DetectionContext, exps: list[ExpenseRec], first_at: dict[str, datetime], recurring: set[str]):
    cfg = ctx.config
    spec = RULES["EXP_AMOUNT_OUTLIER_PEER"]
    dept_of = {u.id: u.department for u in ctx.users}
    dept_size: dict[str, int] = defaultdict(int)
    for u in ctx.users:
        dept_size[u.department] += 1

    history: dict[tuple[str, str], list[ExpenseRec]] = defaultdict(list)
    flagged: dict[str, dict] = {}
    for e in exps:
        dept = dept_of.get(e.user_id)
        if dept is None or e.id in recurring:
            continue
        key = (dept, e.category)
        # Under one month of the employee's own data only the baseline-free rules run.
        has_history = _months_between(first_at[e.user_id], e.incurred_at) >= 1
        if has_history and dept_size[dept] >= cfg.peer_min_department_size:
            others = [p for p in history[key] if p.user_id != e.user_id]
            if len(others) >= cfg.peer_min_samples and len({p.user_id for p in others}) >= cfg.peer_min_users:
                med, mad = median_mad([p.amount_cents for p in others])
                z = robust_z(e.amount_cents, med, mad, floor=amount_floor_cents(med))
                excess = e.amount_cents - med
                if (
                    z >= cfg.peer_z
                    and e.amount_cents >= cfg.peer_min_ratio * med
                    and excess >= cfg.peer_min_excess_cents
                ):
                    flagged[e.id] = {"e": e, "z": z, "med": med, "mad": mad, "n": len(others), "dept": dept}
        history[key].append(e)

    times: dict[tuple[str, str], list[datetime]] = defaultdict(list)
    for f in flagged.values():
        times[(f["e"].user_id, f["e"].category)].append(f["e"].incurred_at)

    out = []
    for f in flagged.values():
        e = f["e"]
        factor, n_recent = _persistence_factor(
            times[(e.user_id, e.category)], e.incurred_at, cfg,
            window_days=cfg.peer_persistence_window_days, full_count=cfg.persistence_full_count,
        )
        out.append(
            FindingDraft(
                rule_id=spec.id,
                subject_user_id=e.user_id,
                confidence=round(spec.confidence * factor, 4),
                amount_at_risk_cents=int(e.amount_cents - f["med"]),
                evidence={
                    "category": e.category,
                    "amount_cents": e.amount_cents,
                    "department_median_cents": int(f["med"]),
                    "department_mad_cents": int(f["mad"]),
                    "robust_z": round(f["z"], 2),
                    "z_threshold": cfg.peer_z,
                    "sample_size": f["n"],
                    "department_size": dept_size[f["dept"]],
                    "outliers_in_window": n_recent,
                },
                dedupe_key=f"{spec.id}:{e.id}",
                detected_at=ctx.now,
                expense_ids=[e.id],
                receipt_ids=[e.receipt_id] if e.receipt_id else [],
            )
        )
    return out


def _velocity(ctx: DetectionContext):
    cfg = ctx.config
    spec = RULES["EXP_VELOCITY"]
    by_user: dict[str, list[ExpenseRec]] = defaultdict(list)
    for e in sorted(ctx.expenses, key=lambda x: (x.submitted_at, x.id)):
        by_user[e.user_id].append(e)

    week = timedelta(days=cfg.velocity_window_days)
    out = []
    for uid, items in by_user.items():
        times = [e.submitted_at for e in items]
        start = times[0]
        suppressed_until: datetime | None = None
        for i, e in enumerate(items):
            t = e.submitted_at
            if suppressed_until is not None and t < suppressed_until:
                continue
            lo = bisect_right(times, t - week)
            window = items[lo : i + 1]
            count = len(window)
            if count < cfg.velocity_min_count:
                continue
            # Weekly baseline from complete blocks that ended before this window began.
            complete_blocks = int(((t - week) - start).days // cfg.velocity_window_days)
            if complete_blocks < cfg.velocity_min_history_weeks:
                continue
            counts = [0] * complete_blocks
            for x in items[:lo]:
                idx = int((x.submitted_at - start).days // cfg.velocity_window_days)
                if idx < complete_blocks:
                    counts[idx] += 1
            med, mad = median_mad(counts)
            # Counts are Poisson-like, so their natural spread is at least the square root of the level.
            spread = max(mad * MAD_SCALE, med**0.5, 1.0)
            threshold = max(cfg.velocity_min_count, med + 4 * spread)
            if count >= threshold:
                suppressed_until = t + week
                out.append(
                    FindingDraft(
                        rule_id=spec.id,
                        subject_user_id=uid,
                        confidence=spec.confidence,
                        amount_at_risk_cents=sum(x.amount_cents for x in window),
                        evidence={
                            "claims_in_window": count,
                            "window_days": cfg.velocity_window_days,
                            "weekly_median": med,
                            "weekly_mad": mad,
                            "threshold": round(threshold, 1),
                            "baseline_weeks": complete_blocks,
                        },
                        dedupe_key=f"{spec.id}:{uid}:{window[0].id}",
                        detected_at=ctx.now,
                        expense_ids=[x.id for x in window],
                        receipt_ids=[x.receipt_id for x in window if x.receipt_id],
                    )
                )
    return out


def _category_mismatch(ctx: DetectionContext, exps: list[ExpenseRec]):
    spec = RULES["EXP_CATEGORY_MISMATCH"]
    out = []
    for e in exps:
        usual = e.merchant_category
        if usual and not _compatible(usual, e.category):
            out.append(
                FindingDraft(
                    rule_id=spec.id,
                    subject_user_id=e.user_id,
                    confidence=spec.confidence,
                    amount_at_risk_cents=e.amount_cents,
                    evidence={
                        "claimed_category": e.category,
                        "merchant_usual_category": usual,
                        "amount_cents": e.amount_cents,
                    },
                    dedupe_key=f"{spec.id}:{e.id}",
                    detected_at=ctx.now,
                    expense_ids=[e.id],
                    receipt_ids=[e.receipt_id] if e.receipt_id else [],
                )
            )
    return out


def _round_amount(ctx: DetectionContext, exps: list[ExpenseRec]):
    cfg = ctx.config
    spec = RULES["EXP_ROUND_AMOUNT"]
    out = []
    for e in exps:
        if e.amount_cents >= cfg.round_min_cents and e.amount_cents % cfg.round_multiple_cents == 0:
            out.append(
                FindingDraft(
                    rule_id=spec.id,
                    subject_user_id=e.user_id,
                    confidence=spec.confidence,
                    amount_at_risk_cents=e.amount_cents,
                    evidence={"amount_cents": e.amount_cents, "round_multiple_cents": cfg.round_multiple_cents},
                    dedupe_key=f"{spec.id}:{e.id}",
                    detected_at=ctx.now,
                    expense_ids=[e.id],
                    receipt_ids=[e.receipt_id] if e.receipt_id else [],
                )
            )
    return out


def _off_pattern(ctx: DetectionContext, exps: list[ExpenseRec], recurring: set[str]):
    cfg = ctx.config
    spec = RULES["EXP_OFF_PATTERN"]

    def off_day(e: ExpenseRec) -> bool:
        d = e.incurred_at.date()
        return d.weekday() >= 5 or d in ctx.holidays

    history: dict[tuple[str, str], list[ExpenseRec]] = defaultdict(list)
    out = []
    for e in exps:
        if e.id in recurring:  # a subscription bills on its own calendar, not the person's
            continue
        key = (e.user_id, e.category)
        prior = history[key]
        med = median_mad([p.amount_cents for p in prior])[0] if prior else 0
        # A first weekend claim of an ordinary size is ordinary. Ask for a larger one.
        if (
            off_day(e)
            and len(prior) >= cfg.off_pattern_min_history
            and e.amount_cents >= cfg.off_pattern_min_ratio * med
            and not any(off_day(p) for p in prior)
        ):
            out.append(
                FindingDraft(
                    rule_id=spec.id,
                    subject_user_id=e.user_id,
                    confidence=spec.confidence,
                    amount_at_risk_cents=e.amount_cents,
                    evidence={
                        "category": e.category,
                        "weekday": e.incurred_at.weekday(),
                        "prior_claims_in_category": len(prior),
                        "prior_off_day_claims": 0,
                        "amount_cents": e.amount_cents,
                    },
                    dedupe_key=f"{spec.id}:{e.id}",
                    detected_at=ctx.now,
                    expense_ids=[e.id],
                    receipt_ids=[e.receipt_id] if e.receipt_id else [],
                )
            )
        prior.append(e)
    return out


def detect(ctx: DetectionContext) -> list[FindingDraft]:
    exps = sorted(ctx.expenses, key=lambda e: (e.incurred_at, e.id))
    recurring = recurring_ids(exps, ctx.config, ctx.config.recurring_amount_tolerance)
    first_at: dict[str, datetime] = {}
    for e in exps:
        first_at.setdefault(e.user_id, e.incurred_at)

    # History tiers: under one month only category mismatch and round amount run. From one to
    # three months the self and peer z thresholds are wider. Velocity and off-pattern need their
    # own minimum histories and skip themselves until they have them.
    return [
        *_amount_self(ctx, exps, first_at, recurring),
        *_amount_peer(ctx, exps, first_at, recurring),
        *_velocity(ctx),
        *_category_mismatch(ctx, exps),
        *_round_amount(ctx, exps),
        *_off_pattern(ctx, exps, recurring),
    ]
