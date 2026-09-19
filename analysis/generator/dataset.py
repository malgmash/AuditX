"""The generated dataset, and the ground truth that describes what was injected into it."""

from __future__ import annotations

import json
import pickle
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from app.detect.types import (
    DetectionContext,
    DetectorConfig,
    ExpenseRec,
    ReceiptRec,
    TimesheetRec,
    UserRec,
)
from generator.merchants import Merchant
from generator.profiles import Profile

UTC = timezone.utc


@dataclass
class ExpenseRow:
    rec: ExpenseRec
    description: str
    extraction: dict[str, Any]
    status: str = "SUBMITTED"
    merchant_id: str | None = None


@dataclass
class ReceiptRow:
    rec: ReceiptRec
    storage_key: str
    mime: str


@dataclass
class TimesheetRow:
    rec: TimesheetRec
    status: str = "SUBMITTED"


@dataclass
class GroundTruth:
    """One injected scenario. `expected` is the rule that should fire, or None for a near-miss
    the detectors must not fire on. `target_ids` are the records a matching finding must touch.
    `min_severity` is the least a finding must reach to count as caught. `max_severity` is the
    most a near-miss may reach: NONE means no finding at all is acceptable."""

    scenario: str
    expected: str | None
    user_id: str
    target_ids: list[str]
    min_severity: str = "CASE"
    max_severity: str = "NONE"
    note: str = ""
    demo: bool = False
    # Rules that may fire on the same records as a side effect of the scenario without counting
    # as false positives, for example a padded claim that is also a category mismatch.
    also: list[str] = field(default_factory=list)
    # Other rules that count as catching this scenario. A receipt too generic to identify by its
    # look is still caught as a duplicate by the field layer.
    alt: list[str] = field(default_factory=list)
    # For a near-miss: the rules it is a near-miss for. Empty means every rule.
    watch_rules: list[str] = field(default_factory=list)


@dataclass
class Dataset:
    profiles: list[Profile]
    merchants: list[Merchant]
    expenses: list[ExpenseRow] = field(default_factory=list)
    receipts: list[ReceiptRow] = field(default_factory=list)
    timesheets: list[TimesheetRow] = field(default_factory=list)
    holidays: set[date] = field(default_factory=set)
    ground_truth: list[GroundTruth] = field(default_factory=list)
    period: tuple[date, date] = (date(2026, 3, 16), date(2026, 9, 13))
    seed: int = 0

    def context(self, config: DetectorConfig | None = None, now: datetime | None = None) -> DetectionContext:
        return DetectionContext(
            now=now or datetime.combine(self.period[1], datetime.min.time(), tzinfo=UTC),
            users=tuple(
                UserRec(p.user_id, p.department, p.job_title, p.start_date) for p in self.profiles
            ),
            expenses=tuple(x.rec for x in self.expenses),
            receipts=tuple(r.rec for r in self.receipts),
            timesheets=tuple(t.rec for t in self.timesheets),
            holidays=frozenset(self.holidays),
            config=config or DetectorConfig(),
        )

    def save(self, directory: Path) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        with (directory / "dataset.pkl").open("wb") as fh:
            pickle.dump(self, fh)
        with (directory / "ground_truth.jsonl").open("w", encoding="utf-8") as fh:
            for gt in self.ground_truth:
                fh.write(json.dumps(asdict(gt)) + "\n")

    @staticmethod
    def load(directory: Path) -> "Dataset":
        with (directory / "dataset.pkl").open("rb") as fh:
            return pickle.load(fh)
