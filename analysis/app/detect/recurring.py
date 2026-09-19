"""Recurring charges: the same person, merchant and amount on a regular cadence, such as a daily
parking fee or a monthly subscription.

They are legitimate by nature. The duplicate field rule must not fire on them, and they must not
enter an amount baseline, where a fixed $4.50 fee would drag a person's transport median down and
make every taxi ride look like an outlier.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Iterable

from app.detect.stats import median_mad
from app.detect.types import DetectorConfig, ExpenseRec


def _clusters(items: list[ExpenseRec], tolerance: float) -> list[list[ExpenseRec]]:
    """Group items whose amounts are within `tolerance` of each other, smallest first."""
    out: list[list[ExpenseRec]] = []
    for x in sorted(items, key=lambda e: e.amount_cents):
        if out and x.amount_cents - out[-1][0].amount_cents <= tolerance * x.amount_cents:
            out[-1].append(x)
        else:
            out.append([x])
    return out


def recurring_ids(expenses: Iterable[ExpenseRec], cfg: DetectorConfig, tolerance: float) -> set[str]:
    """Ids of claims in a recurring series. `tolerance` is how far amounts may differ inside one
    series: narrow for the duplicate rule, where a wide band would hide a copied receipt among
    similar meals, and wide for baselines, where a subscription price change should not count."""
    groups: dict[tuple[str, str], list[ExpenseRec]] = defaultdict(list)
    for e in expenses:
        groups[(e.user_id, e.merchant_key)].append(e)

    found: set[str] = set()
    for items in groups.values():
        if len(items) < cfg.recurring_min_occurrences:
            continue
        for cluster in _clusters(items, tolerance):
            if len(cluster) < cfg.recurring_min_occurrences:
                continue
            days = sorted(x.incurred_at for x in cluster)
            gaps = [(b - a).total_seconds() / 86400 for a, b in zip(days, days[1:])]
            med, mad = median_mad(gaps)
            if med > 0 and mad / med <= cfg.recurring_max_gap_dispersion:
                found.update(x.id for x in cluster)
    return found
