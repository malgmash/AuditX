"""The scoring engine. Pure functions: no database, no clock, so every formula is unit-tested.

    penalty = base_points x confidence x status_factor x decay(age)

    status_factor   confirmed 1.00 | pending 0.35 | dismissed 0.00
    decay(age)      0.5 ** (months_since / 6)

`points` on a Penalty is base_points x confidence, the value stored on the finding. Pending cases
hold back only 0.35 of it, escalating to 1.00 over the 14 days after they turn 14 days old, and
all pending penalties for one person are capped at 15 points together. Without the escalation an
unworked queue leaves everyone with a clean score. Net downward movement is capped at 15 points
per calendar month, so one bad week cannot make anyone look like a career problem.

The score ranks. It never triggers anything.

The score is stored as append-only events. Their sum is the current score, and a reversal is a
new event, never an edit. `plan_events` turns the target contribution of each finding into the
events that still need to be written, so running the engine twice writes nothing the second time.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

Status = Literal["PENDING", "CONFIRMED", "DISMISSED"]

PENDING_FACTOR = 0.35
PENDING_CAP = 15.0
MONTHLY_DROP_CAP = 15.0
ESCALATION_START_DAYS = 14
ESCALATION_DAYS = 14
DAYS_PER_MONTH = 30.4375
CAP_KEY = "CAP"  # restores points hidden by the pending cap
VOL_KEY = "VOL"  # restores points hidden by the monthly cap

UTC = timezone.utc


@dataclass(frozen=True)
class Penalty:
    finding_id: str
    user_id: str
    points: float
    occurred_at: datetime
    opened_at: datetime | None
    status: Status


def decay(occurred_at: datetime, at: datetime) -> float:
    months = max(0.0, (at - occurred_at).total_seconds() / 86400 / DAYS_PER_MONTH)
    return 0.5 ** (months / 6)


def status_factor(status: Status, opened_at: datetime | None, at: datetime) -> float:
    if status == "CONFIRMED":
        return 1.0
    if status == "DISMISSED":
        return 0.0
    if opened_at is None:
        return PENDING_FACTOR
    age_days = max(0.0, (at - opened_at).total_seconds() / 86400)
    if age_days <= ESCALATION_START_DAYS:
        return PENDING_FACTOR
    progress = min(1.0, (age_days - ESCALATION_START_DAYS) / ESCALATION_DAYS)
    return PENDING_FACTOR + (1.0 - PENDING_FACTOR) * progress


def contribution(p: Penalty, at: datetime) -> float:
    """What one finding takes off the score at `at`, before any cap. Never negative."""
    if p.occurred_at > at:
        return 0.0
    return p.points * status_factor(p.status, p.opened_at, at) * decay(p.occurred_at, at)


@dataclass(frozen=True)
class Snapshot:
    value: float  # the score after every cap
    raw: float  # before the monthly cap
    contributions: dict[str, float]  # finding id -> points taken off (>= 0)
    cap_restore: float  # points given back by the pending cap
    vol_restore: float  # points given back by the monthly cap
    history: list[tuple[datetime, float]]  # month end -> score, oldest first


def _raw_score(penalties: list[Penalty], at: datetime) -> tuple[float, dict[str, float], float]:
    parts = {p.finding_id: contribution(p, at) for p in penalties}
    pending = sum(v for p in penalties if p.status == "PENDING" for v in [parts[p.finding_id]])
    confirmed = sum(parts.values()) - pending
    capped = confirmed + min(PENDING_CAP, pending)
    return max(0.0, min(100.0, 100.0 - capped)), parts, pending - min(PENDING_CAP, pending)


def _month_ends(now: datetime, months: int) -> list[datetime]:
    ends: list[datetime] = []
    for back in range(months - 1, 0, -1):
        first = datetime(now.year, now.month, 1, tzinfo=UTC)
        year, month = first.year, first.month - back
        while month <= 0:
            month += 12
            year -= 1
        nxt_year, nxt_month = (year + 1, 1) if month == 12 else (year, month + 1)
        ends.append(datetime(nxt_year, nxt_month, 1, tzinfo=UTC) - timedelta(microseconds=1))
    ends.append(now)
    return ends


def snapshot(penalties: list[Penalty], now: datetime, months: int = 6) -> Snapshot:
    """The score now, and month by month, for one person."""
    raw_now, parts, cap_restore = _raw_score(penalties, now)
    value_prev = 100.0
    history: list[tuple[datetime, float]] = []
    for end in _month_ends(now, months):
        raw, _, _ = _raw_score(penalties, end)
        value = max(raw, value_prev - MONTHLY_DROP_CAP)  # a fall is limited, a recovery is not
        history.append((end, round(value, 2)))
        value_prev = value
    final = history[-1][1]
    return Snapshot(
        value=final,
        raw=round(raw_now, 2),
        contributions={k: round(v, 2) for k, v in parts.items()},
        cap_restore=round(cap_restore, 2),
        vol_restore=round(max(0.0, final - raw_now), 2),
        history=history,
    )


def plan_events(balances: dict[str, float], snap: Snapshot) -> list[tuple[str, float]]:
    """Events still needed so that each key's running total matches its target.

    A finding's target is minus its contribution. The pending cap and the monthly cap each have a
    target that gives points back. The result is a list of (key, delta), empty when nothing has
    changed, which is what makes recompute idempotent.
    """
    targets: dict[str, float] = {k: -v for k, v in snap.contributions.items()}
    targets[CAP_KEY] = snap.cap_restore
    targets[VOL_KEY] = snap.vol_restore
    out: list[tuple[str, float]] = []
    for key, target in sorted(targets.items()):
        delta = round(target - balances.get(key, 0.0), 2)
        if abs(delta) >= 0.01:
            out.append((key, delta))
    return out


def department_score(user_scores: list[float]) -> float:
    """Headcount-weighted mean: every person in the department counts once."""
    return round(sum(user_scores) / len(user_scores), 2) if user_scores else 100.0


def category_score(user_scores: dict[str, float], claimed_cents: dict[str, int]) -> float:
    """Amount-weighted across the people who claimed in the category."""
    total = sum(claimed_cents.get(u, 0) for u in user_scores)
    if total <= 0:
        return 100.0
    return round(sum(user_scores[u] * claimed_cents.get(u, 0) for u in user_scores) / total, 2)
