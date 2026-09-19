"""Two-axis severity: confidence and amount at risk.

                       amount at risk
                    low            high
    high confidence  CASE       IMMEDIATE_HOLD
    low confidence   NOTE       CASE

One addition to the matrix: a finding below note_confidence_floor is a NOTE whatever the amount.
A large purchase that trips only a weak rule is recorded and does not spend a reviewer's time.
Severity is decided here by rules. A model never assigns it.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from app.detect.rules import RULES
from app.detect.types import DetectionContext, DetectorConfig, FindingDraft, Severity


def monthly_average_cents(ctx: DetectionContext) -> dict[str, int]:
    """Each employee's average monthly claimed spend, from their own history."""
    spans: dict[str, list[datetime]] = defaultdict(list)
    totals: dict[str, int] = defaultdict(int)
    for e in ctx.expenses:
        spans[e.user_id].append(e.incurred_at)
        totals[e.user_id] += e.amount_cents
    out: dict[str, int] = {}
    for uid, dates in spans.items():
        days = (max(dates) - min(dates)).days
        months = max(1.0, days / 30.4)
        out[uid] = int(totals[uid] / months)
    return out


def high_amount_threshold_cents(monthly_avg_cents: int | None, cfg: DetectorConfig) -> int:
    """The lower of a fixed amount and a share of the person's own monthly average."""
    fixed = cfg.high_amount_cents
    if not monthly_avg_cents:
        return fixed
    return min(fixed, int(monthly_avg_cents * cfg.high_amount_share_of_monthly))


def assign_severity(
    confidence: float, amount_cents: int, monthly_avg_cents: int | None, cfg: DetectorConfig
) -> Severity:
    if confidence < cfg.note_confidence_floor:
        return "NOTE"
    high_conf = confidence >= cfg.high_confidence
    high_amount = amount_cents >= high_amount_threshold_cents(monthly_avg_cents, cfg)
    if high_conf and high_amount:
        return "IMMEDIATE_HOLD"
    if high_conf or high_amount:
        return "CASE"
    return "NOTE"


def apply_severity(drafts: list[FindingDraft], ctx: DetectionContext) -> list[FindingDraft]:
    """Set severity and penalty points on every draft. Points before decay and status are the
    rule's base points times confidence. The scorer applies the rest."""
    monthly = monthly_average_cents(ctx)
    for d in drafts:
        d.severity = assign_severity(
            d.confidence, d.amount_at_risk_cents, monthly.get(d.subject_user_id), ctx.config
        )
        # A hold pauses a reimbursement. A finding that touches no expense has nothing to hold,
        # so it opens a case instead.
        if d.severity == "IMMEDIATE_HOLD" and not d.expense_ids:
            d.severity = "CASE"
        d.penalty_points = round(RULES[d.rule_id].points * d.confidence, 4)
    return drafts
