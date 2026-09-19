"""The pure parts of the database adapter. Anything that needs Postgres is exercised by loading the
dataset and calling /internal/recompute once the database is up."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from app.config import Settings
from app.detect.baselines import compute_baselines
from app.repo import expense_from_row, finding_identity

from tests.builders import context, dt, expense, user

UTC = timezone.utc


def _row(extraction, incurred=datetime(2026, 3, 3, 12, 40)):
    """A stand-in for an Expense row, with the naive datetimes the database returns."""
    return SimpleNamespace(
        id="e1", user_id="u1", submitted_at=datetime(2026, 3, 10), incurred_at=incurred,
        merchant_raw="Deep Dish Place #12", category_id="Meals", amount_cents=1800,
        receipt_id="r1", extraction=extraction,
    )


def test_expense_row_takes_time_and_city_from_the_extraction():
    rec = expense_from_row(_row({"transaction_time": "12:40", "merchant_city": "Chicago"}), "Meals")
    assert rec.has_time and rec.city == "Chicago"
    assert rec.merchant_key == "deep dish"
    assert rec.incurred_at.tzinfo is UTC  # naive database values are read as UTC


def test_expense_without_extraction_carries_no_time_and_no_city():
    rec = expense_from_row(_row(None), None)
    assert not rec.has_time and rec.city is None and rec.merchant_category is None


def test_finding_identity_ignores_order():
    a = finding_identity("DUP_RECEIPT_EXACT", ["b", "a"], [])
    b = finding_identity("DUP_RECEIPT_EXACT", ["a", "b"], [])
    assert a == b
    assert a != finding_identity("DUP_RECEIPT_IMAGE", ["a", "b"], [])


def test_prisma_url_becomes_a_sqlalchemy_url():
    s = Settings(database_url="postgresql://auditx:auditx@localhost:5432/auditx?schema=public")
    assert s.sqlalchemy_url == "postgresql+psycopg://auditx:auditx@localhost:5432/auditx"


def test_baselines_use_median_and_mad_per_person_and_department():
    expenses = [expense("u1", dt(2026, 3, 1 + i, 12), "Deli", c, "Meals") for i, c in enumerate([2000, 2200, 2400, 9000, 2100])]
    ctx = context(users=[user("u1", "Sales")], expenses=expenses)
    rows = {(r["scopeType"], r["scopeKey"]): r for r in compute_baselines(ctx)}
    mine = rows[("user_category", "u1:Meals")]
    assert mine["medianCents"] == 2200  # one large claim does not move the median
    assert mine["sampleSize"] == 5
    assert ("department_category", "Sales:Meals") in rows
