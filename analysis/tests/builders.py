"""Small builders so each test states only what it cares about."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.detect.merchants import merchant_key
from app.detect.types import (
    DetectionContext,
    DetectorConfig,
    EntryRec,
    ExpenseRec,
    ReceiptRec,
    TimesheetRec,
    UserRec,
)

UTC = timezone.utc
NOW = datetime(2026, 9, 1, tzinfo=UTC)


def dt(y: int, m: int, d: int, h: int = 0, mi: int = 0) -> datetime:
    return datetime(y, m, d, h, mi, tzinfo=UTC)


def user(uid: str, dept: str = "Sales", title: str = "Account executive") -> UserRec:
    return UserRec(id=uid, department=dept, job_title=title, start_date=date(2025, 1, 6))


_seq = 0


def _next() -> str:
    global _seq
    _seq += 1
    return f"x{_seq}"


def expense(
    uid: str,
    when: datetime,
    merchant: str,
    cents: int,
    category: str = "Meals",
    *,
    receipt: str | None = None,
    city: str | None = None,
    has_time: bool = True,
    merchant_category: str | None = None,
    submitted: datetime | None = None,
    eid: str | None = None,
) -> ExpenseRec:
    return ExpenseRec(
        id=eid or _next(),
        user_id=uid,
        submitted_at=submitted or when,
        incurred_at=when,
        has_time=has_time,
        merchant_raw=merchant,
        merchant_key=merchant_key(merchant),
        merchant_category=merchant_category,
        category=category,
        amount_cents=cents,
        receipt_id=receipt,
        city=city,
    )


def receipt(rid: str, sha: str, phash: str, uploader: str = "u1") -> ReceiptRec:
    return ReceiptRec(id=rid, sha256=sha, phash=phash, uploaded_by=uploader)


def entry(
    uid: str,
    day: date,
    start: str | None,
    end: str | None,
    *,
    hours: float | None = None,
    project: str = "Core",
    location: str | None = "Pittsburgh office",
    note: str | None = None,
    tsid: str = "ts",
    eid: str | None = None,
) -> EntryRec:
    def at(hm: str | None) -> datetime | None:
        if hm is None:
            return None
        h, m = hm.split(":")
        return datetime(day.year, day.month, day.day, int(h), int(m), tzinfo=UTC)

    s, e = at(start), at(end)
    if hours is None:
        hours = round((e - s).total_seconds() / 3600, 2) if s and e else 0.0
    return EntryRec(
        id=eid or _next(), timesheet_id=tsid, user_id=uid, work_date=day, start=s, end=e,
        hours=hours, project=project, location=location, note=note,
    )


def sheet(uid: str, tsid: str, week_start: date, entries: list[EntryRec]) -> TimesheetRec:
    return TimesheetRec(
        id=tsid, user_id=uid, week_start=week_start,
        submitted_at=datetime(week_start.year, week_start.month, week_start.day, tzinfo=UTC) + timedelta(days=7),
        entries=tuple(entries),
    )


def week_of(
    uid: str, tsid: str, monday: date, times: list[tuple[str, str]], *, location: str = "Pittsburgh office"
) -> TimesheetRec:
    entries = [
        entry(uid, monday + timedelta(days=i), s, e, location=location, tsid=tsid, eid=f"{tsid}-{i}")
        for i, (s, e) in enumerate(times)
    ]
    return sheet(uid, tsid, monday, entries)


def context(
    *,
    users: list[UserRec] | None = None,
    expenses: list[ExpenseRec] | None = None,
    receipts: list[ReceiptRec] | None = None,
    timesheets: list[TimesheetRec] | None = None,
    holidays: set[date] | None = None,
    config: DetectorConfig | None = None,
) -> DetectionContext:
    return DetectionContext(
        now=NOW,
        users=tuple(users or [user("u1")]),
        expenses=tuple(expenses or []),
        receipts=tuple(receipts or []),
        timesheets=tuple(timesheets or []),
        holidays=frozenset(holidays or set()),
        config=config or DetectorConfig(),
    )


def by_rule(findings, rule_id: str):
    return [f for f in findings if f.rule_id == rule_id]
