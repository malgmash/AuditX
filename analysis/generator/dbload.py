"""Load a generated dataset into Postgres.

    python -m generator.seed --seed 42 --inject-fraud --db

Order for a fresh database:
    1. cd web && npm run db:push          create the tables from the Prisma schema
    2. python -m generator.seed ... --db  this loader: 45 employees and their history
    3. cd web && npm run db:seed          sets real passwords on the two demo logins

The 43 other employees are created with a disabled password. They exist to be viewed, not to sign
in. Only admin@auditx.local and employee@auditx.local can log in.

The tables are cleared first, so this is the way to reset the demo to a known state.
"""

from __future__ import annotations

from sqlalchemy import delete, text

from app import models as m
from app.config import settings
from app.db import session_scope
from generator.dataset import Dataset

DISABLED_PASSWORD = "!disabled"

# Tables the loader owns, children first.
_CLEAR = [
    m.AuditLog, m.Notification, m.ScoreEvent, m.Score, m.Hold, m.Case, m.Finding, m.Baseline,
    m.TimesheetEntry, m.Timesheet, m.Expense, m.Receipt, m.MerchantAlias, m.Merchant, m.User,
]


def load(ds: Dataset) -> None:
    org_id = settings.org_id
    with session_scope() as s:
        for table in _CLEAR:
            s.execute(delete(table))

        org = s.get(m.Organization, org_id)
        if org is None:
            s.add(m.Organization(id=org_id, name="Demo Company", headcount=len(ds.profiles)))
        else:
            org.headcount = len(ds.profiles)

        s.add_all(
            m.User(
                id=p.user_id, org_id=org_id, email=p.email, password_hash=DISABLED_PASSWORD, name=p.name,
                role=m.Role(p.role), department=p.department, job_title=p.job_title,
                start_date=_midnight(p.start_date),
            )
            for p in ds.profiles
        )
        s.add_all(
            m.Merchant(id=x.id, org_id=org_id, canonical_name=x.name, category_id=x.category, embedding=[])
            for x in ds.merchants
        )
        s.flush()

        s.add_all(
            m.Receipt(
                id=r.rec.id, uploaded_by_id=r.rec.uploaded_by, storage_key=r.storage_key, sha256=r.rec.sha256,
                phash=r.rec.phash, mime_type=r.mime, extracted_at=None, embedding=[],
            )
            for r in ds.receipts
        )
        s.flush()

        s.add_all(
            m.Expense(
                id=x.rec.id, user_id=x.rec.user_id, submitted_at=x.rec.submitted_at, incurred_at=x.rec.incurred_at,
                merchant_raw=x.rec.merchant_raw, merchant_id=x.merchant_id, category_id=x.rec.category,
                amount_cents=x.rec.amount_cents, currency="USD", description=x.description,
                receipt_id=x.rec.receipt_id, status=m.ExpenseStatus(x.status), extraction=x.extraction,
            )
            for x in ds.expenses
        )
        for t in ds.timesheets:
            s.add(
                m.Timesheet(
                    id=t.rec.id, user_id=t.rec.user_id, week_start=_midnight(t.rec.week_start),
                    submitted_at=t.rec.submitted_at, status=m.TimesheetStatus(t.status),
                )
            )
        s.flush()
        s.add_all(
            m.TimesheetEntry(
                id=e.id, timesheet_id=e.timesheet_id, work_date=_midnight(e.work_date), start_time=e.start,
                end_time=e.end, hours=round(e.hours, 2), project=e.project, location=e.location, note=e.note,
            )
            for t in ds.timesheets for e in t.rec.entries
        )


def _midnight(d):
    from datetime import datetime, timezone

    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def reset_sequences() -> None:  # kept for symmetry; ids are text, so there is nothing to reset
    with session_scope() as s:
        s.execute(text("select 1"))
