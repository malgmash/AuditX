"""Plain data the detectors read and write.

Detectors are pure functions over a DetectionContext. They never touch the database, so each
one is unit-testable against a fixture. The database adapter in app/repo.py builds the context.

Money is integer cents. All datetimes are timezone-aware UTC.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal

Severity = Literal["IMMEDIATE_HOLD", "CASE", "NOTE"]


@dataclass(frozen=True)
class UserRec:
    id: str
    department: str
    job_title: str
    start_date: date


@dataclass(frozen=True)
class ReceiptRec:
    id: str
    sha256: str
    phash: str  # perceptual hash as hex, 256 bits in production (see app/imaging.py)
    uploaded_by: str


@dataclass(frozen=True)
class ExpenseRec:
    id: str
    user_id: str
    submitted_at: datetime
    incurred_at: datetime
    has_time: bool  # False when only the date is known
    merchant_raw: str
    merchant_key: str  # resolved, normalised merchant identity
    merchant_category: str | None  # the merchant's usual category, when the catalogue knows it
    category: str  # category the employee claimed
    amount_cents: int
    receipt_id: str | None
    city: str | None  # merchant city from extraction or the catalogue


@dataclass(frozen=True)
class EntryRec:
    id: str
    timesheet_id: str
    user_id: str
    work_date: date
    start: datetime | None
    end: datetime | None
    hours: float
    project: str | None
    location: str | None
    note: str | None = None


@dataclass(frozen=True)
class TimesheetRec:
    id: str
    user_id: str
    week_start: date
    submitted_at: datetime
    entries: tuple[EntryRec, ...]


@dataclass(frozen=True)
class DetectorConfig:
    """Every threshold in one place. Tuned only against the evaluate output, never by eye."""

    # severity
    high_confidence: float = 0.85
    high_amount_cents: int = 25_000
    high_amount_share_of_monthly: float = 0.03
    # Findings below this confidence are recorded as notes whatever the amount, because they are
    # too weak to spend a reviewer's time on.
    note_confidence_floor: float = 0.50
    # Labour is not priced anywhere in the data, so hours are valued at a flat estimate. It only
    # ranks the queue and never touches pay.
    hourly_cost_cents: int = 3_000

    # duplicates
    # Fraction of the hash length. 10 percent of a 256-bit hash is 25 bits, which the measured
    # re-photo spread (up to 22 bits) fits inside and different receipts almost never do.
    phash_max_fraction: float = 0.10
    # A receipt with more lookalikes than this cannot be identified by its image. Measured on
    # rendered receipts: most true copies have 8 or fewer, most false matches have far more.
    phash_max_lookalikes: int = 8
    dup_amount_tolerance: float = 0.02
    dup_date_window_days: int = 1
    dup_fields_min_cents: int = 1_500
    # Without a printed time on both claims nothing ties them to one purchase, so ask for more money.
    dup_fields_min_untimed_cents: int = 5_000
    dup_cross_user_fields_min_cents: int = 5_000
    dup_time_window_minutes: int = 60
    recurring_min_occurrences: int = 4
    recurring_max_gap_dispersion: float = 0.35
    # A subscription can change price at renewal, so a recurring series tolerates a wider band.
    recurring_amount_tolerance: float = 0.15

    # abnormal expenses
    self_min_samples: int = 8
    self_z_full: float = 2.5
    self_z_partial: float = 3.5
    self_min_excess_cents: int = 2_500
    peer_min_department_size: int = 5
    peer_min_samples: int = 10
    peer_min_users: int = 3
    peer_z: float = 3.5
    peer_min_ratio: float = 2.5
    peer_min_excess_cents: int = 5_000
    persistence_window_days: int = 90
    persistence_full_count: int = 2
    peer_persistence_window_days: int = 180
    isolated_outlier_factor: float = 0.5
    velocity_window_days: int = 7
    velocity_min_count: int = 12
    velocity_min_history_weeks: int = 4
    round_min_cents: int = 10_000
    round_multiple_cents: int = 5_000
    off_pattern_min_history: int = 15
    off_pattern_min_ratio: float = 1.5

    # timesheets
    overlap_tolerance_minutes: int = 5
    max_daily_hours: float = 16.0
    max_weekly_hours: float = 80.0
    copy_paste_min_matches: int = 2
    round_hours_min_weeks: int = 4


@dataclass(frozen=True)
class DetectionContext:
    now: datetime
    users: tuple[UserRec, ...]
    expenses: tuple[ExpenseRec, ...]
    receipts: tuple[ReceiptRec, ...]
    timesheets: tuple[TimesheetRec, ...]
    holidays: frozenset[date] = frozenset()
    config: DetectorConfig = field(default_factory=DetectorConfig)


@dataclass
class FindingDraft:
    """A finding before it is written to the database. Evidence holds raw values only."""

    rule_id: str
    subject_user_id: str
    confidence: float
    amount_at_risk_cents: int
    evidence: dict[str, Any]
    dedupe_key: str
    detected_at: datetime
    expense_ids: list[str] = field(default_factory=list)
    timesheet_ids: list[str] = field(default_factory=list)
    receipt_ids: list[str] = field(default_factory=list)
    severity: Severity = "NOTE"
    penalty_points: float = 0.0
