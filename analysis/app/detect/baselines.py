"""Baselines: median and MAD of amounts per employee and category and per department and
category, and median weekly hours per employee. Robust statistics only.

The detectors compute their baselines inline from data that existed before each claim, so this
snapshot is not an input to them. It is what the admin views show as "usual", and it is stored
in the Baseline table so a reviewer can see what a finding was compared against.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from statistics import median
from typing import Any

from app.detect.stats import median_mad
from app.detect.types import DetectionContext


def compute_baselines(ctx: DetectionContext, at: datetime | None = None) -> list[dict[str, Any]]:
    at = at or ctx.now
    dept_of = {u.id: u.department for u in ctx.users}
    by_uc: dict[tuple[str, str], list[int]] = defaultdict(list)
    by_dc: dict[tuple[str, str], list[int]] = defaultdict(list)
    for e in ctx.expenses:
        by_uc[(e.user_id, e.category)].append(e.amount_cents)
        dept = dept_of.get(e.user_id)
        if dept:
            by_dc[(dept, e.category)].append(e.amount_cents)

    rows: list[dict[str, Any]] = []
    for scope, groups in (("user_category", by_uc), ("department_category", by_dc)):
        for (owner, category), amounts in groups.items():
            med, mad = median_mad(amounts)
            rows.append(
                {
                    "scopeType": scope, "scopeKey": f"{owner}:{category}",
                    "medianCents": int(med), "madCents": int(mad), "medianHours": None,
                    "sampleSize": len(amounts), "computedAt": at,
                }
            )

    weekly: dict[str, list[float]] = defaultdict(list)
    for ts in ctx.timesheets:
        weekly[ts.user_id].append(sum(e.hours for e in ts.entries))
    for uid, hours in weekly.items():
        rows.append(
            {
                "scopeType": "user_hours", "scopeKey": uid, "medianCents": None, "madCents": None,
                "medianHours": round(median(hours), 2), "sampleSize": len(hours), "computedAt": at,
            }
        )
    return rows
