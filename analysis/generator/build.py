"""Assemble a dataset: honest data first, then optional injected problems and near-misses."""

from __future__ import annotations

import random
from datetime import date, timedelta
from pathlib import Path

from generator.builder import Builder
from generator.dataset import Dataset
from generator.expenses import US_HOLIDAYS_2026, apply_new_hires, generate_expenses, plan_days
from generator.merchants import build_catalogue
from generator.profiles import build_profiles
from generator.receipts import ReceiptFactory
from generator.timesheets import generate_timesheets

PERIOD_END = date(2026, 9, 13)


def generate(
    employees: int = 45,
    months: int = 6,
    seed: int = 42,
    inject: bool = True,
    receipt_mode: str = "synthetic",
    receipt_dir: Path | None = None,
) -> Dataset:
    rng = random.Random(seed)
    start = PERIOD_END - timedelta(days=round(months * 30.4)) + timedelta(days=1)
    start -= timedelta(days=start.weekday())  # begin on a Monday
    ds = Dataset(
        profiles=build_profiles(rng, employees, start),
        merchants=build_catalogue(rng),
        holidays={d for d in US_HOLIDAYS_2026 if start <= d <= PERIOD_END},
        period=(start, PERIOD_END),
        seed=seed,
    )
    b = Builder(ds, ReceiptFactory(receipt_mode, receipt_dir), rng)
    apply_new_hires(b)
    plan_days(b)
    generate_expenses(b)
    generate_timesheets(b)
    if inject:
        # Kept in separate modules so anyone can open two files and see exactly what was planted.
        from generator import fraud, near_miss

        fraud.inject(b)
        near_miss.inject(b)
    ds.expenses.sort(key=lambda x: (x.rec.submitted_at, x.rec.id))
    return ds
