"""The database adapter: rows in, a DetectionContext out, and findings back in.

The detectors never touch the database. This module is the only place they meet it, so the
detectors stay pure and unit-testable. It needs a running Postgres to exercise; the pure parts
(row conversion, identity) are covered by tests/test_repo_pure.py.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models as m
from app.detect.baselines import compute_baselines
from app.detect.merchants import merchant_key
from app.detect.runner import detect_all
from app.detect.types import (
    DetectionContext,
    DetectorConfig,
    EntryRec,
    ExpenseRec,
    FindingDraft,
    ReceiptRec,
    TimesheetRec,
    UserRec,
)
from app.holidays import US_HOLIDAYS

UTC = timezone.utc


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def expense_from_row(row: m.Expense, merchant_category: str | None) -> ExpenseRec:
    """`extraction` holds what the model read from the receipt. Its city and time feed the
    location rule. Without extraction the claim carries no time and no city, and stays out of it."""
    ex: dict[str, Any] = row.extraction or {}
    return ExpenseRec(
        id=row.id,
        user_id=row.user_id,
        submitted_at=_aware(row.submitted_at),
        incurred_at=_aware(row.incurred_at),
        has_time=bool(ex.get("transaction_time")),
        merchant_raw=row.merchant_raw,
        merchant_key=merchant_key(row.merchant_raw),
        merchant_category=merchant_category,
        category=row.category_id,
        amount_cents=row.amount_cents,
        receipt_id=row.receipt_id,
        city=ex.get("merchant_city"),
    )


def finding_identity(rule_id: str, expense_ids: list[str], timesheet_ids: list[str]) -> tuple:
    """A finding is the same finding if it names the same rule and the same records. The Finding
    table has no dedupe column and is frozen, so identity is derived from what it already holds."""
    return (rule_id, tuple(sorted(expense_ids)), tuple(sorted(timesheet_ids)))


def load_context(session: Session, config: DetectorConfig | None = None, now: datetime | None = None) -> DetectionContext:
    users = tuple(
        UserRec(u.id, u.department, u.job_title, u.start_date.date())
        for u in session.scalars(select(m.User)).all()
    )
    category_of_merchant = {mer.id: mer.category_id for mer in session.scalars(select(m.Merchant)).all()}
    expenses = tuple(
        expense_from_row(x, category_of_merchant.get(x.merchant_id) if x.merchant_id else None)
        for x in session.scalars(select(m.Expense)).all()
    )
    receipts = tuple(
        ReceiptRec(r.id, r.sha256, r.phash, r.uploaded_by_id) for r in session.scalars(select(m.Receipt)).all()
    )

    entries_by_ts: dict[str, list[EntryRec]] = {}
    sheets = session.scalars(select(m.Timesheet)).all()
    user_of_ts = {t.id: t.user_id for t in sheets}
    for e in session.scalars(select(m.TimesheetEntry)).all():
        entries_by_ts.setdefault(e.timesheet_id, []).append(
            EntryRec(
                id=e.id, timesheet_id=e.timesheet_id, user_id=user_of_ts[e.timesheet_id],
                work_date=e.work_date.date(),
                start=_aware(e.start_time) if e.start_time else None,
                end=_aware(e.end_time) if e.end_time else None,
                hours=float(e.hours), project=e.project, location=e.location, note=e.note,
            )
        )
    timesheets = tuple(
        TimesheetRec(t.id, t.user_id, t.week_start.date(), _aware(t.submitted_at), tuple(entries_by_ts.get(t.id, [])))
        for t in sheets
    )
    return DetectionContext(
        now=now or datetime.now(UTC), users=users, expenses=expenses, receipts=receipts,
        timesheets=timesheets, holidays=US_HOLIDAYS, config=config or DetectorConfig(),
    )


def persist_findings(session: Session, org_id: str, drafts: list[FindingDraft]) -> tuple[int, int]:
    """Insert findings that are not already stored. Existing findings are never touched: they are
    immutable once created. Returns (inserted, skipped)."""
    existing = {
        finding_identity(f.rule_id, list(f.expense_ids), list(f.timesheet_ids))
        for f in session.scalars(select(m.Finding)).all()
    }
    inserted = 0
    for d in drafts:
        if finding_identity(d.rule_id, d.expense_ids, d.timesheet_ids) in existing:
            continue
        session.add(
            m.Finding(
                org_id=org_id, rule_id=d.rule_id, subject_user_id=d.subject_user_id,
                expense_ids=d.expense_ids, timesheet_ids=d.timesheet_ids, receipt_ids=d.receipt_ids,
                confidence=d.confidence, amount_at_risk_cents=d.amount_at_risk_cents,
                severity=m.Severity(d.severity), penalty_points=d.penalty_points,
                evidence=d.evidence, detected_at=d.detected_at,
            )
        )
        inserted += 1
    return inserted, len(drafts) - inserted


def replace_baselines(session: Session, ctx: DetectionContext) -> int:
    """Baselines are derived, not history, so a fresh snapshot replaces the old one."""
    session.execute(delete(m.Baseline))
    rows = compute_baselines(ctx)
    for r in rows:
        session.add(
            m.Baseline(
                scope_type=r["scopeType"], scope_key=r["scopeKey"], median_cents=r["medianCents"],
                mad_cents=r["madCents"], median_hours=r["medianHours"], sample_size=r["sampleSize"],
                computed_at=r["computedAt"],
            )
        )
    return len(rows)


def recompute(session: Session, org_id: str, config: DetectorConfig | None = None) -> dict[str, int]:
    """Full rebaseline and redetect. Idempotent: running it twice inserts nothing new."""
    ctx = load_context(session, config)
    baselines = replace_baselines(session, ctx)
    drafts = detect_all(ctx)
    inserted, skipped = persist_findings(session, org_id, drafts)
    return {"baselines": baselines, "findings": len(drafts), "inserted": inserted, "already_stored": skipped}
