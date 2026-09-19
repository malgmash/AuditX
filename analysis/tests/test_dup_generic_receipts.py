"""Generic receipts must not match by look alone. Found by evaluating against real rendered receipt
images: one-line receipts such as parking tickets and subscriptions look alike, so the image layer
fired on hundreds of unrelated pairs."""

from __future__ import annotations

from app.detect import duplicates

from tests.builders import context, dt, expense, receipt, user


def flip(h: str, bits: int) -> str:
    v = int(h, 16)
    for i in range(bits):
        v ^= 1 << i
    return f"{v:064x}"


BASE = "ab" * 32


def test_a_pair_among_many_lookalikes_does_not_match_by_image():
    # Twelve receipts that all look alike, two of them at the same merchant on the same day.
    expenses, receipts = [], []
    for i in range(12):
        expenses.append(
            expense("u1", dt(2026, 3, 2 + (i % 2), 12), "City Garage", 1600 + i * 300, "Transport", receipt=f"r{i}")
        )
        receipts.append(receipt(f"r{i}", f"sha-{i}", flip(BASE, i % 5)))
    assert [f for f in duplicates.detect(context(expenses=expenses, receipts=receipts)) if f.evidence["matched_layer"] == "IMAGE"] == []


def test_a_distinctive_pair_still_matches_by_image():
    ctx = context(
        expenses=[
            expense("u1", dt(2026, 3, 2, 12), "Blue Door Cafe", 8500, receipt="a"),
            expense("u1", dt(2026, 3, 2, 12), "Blue Door Cafe", 8500, receipt="b", submitted=dt(2026, 3, 20)),
            expense("u1", dt(2026, 3, 9, 12), "Corner Hardware", 2300, receipt="c"),
        ],
        receipts=[receipt("a", "s1", BASE), receipt("b", "s2", flip(BASE, 4)), receipt("c", "s3", "0123456789abcdef" * 4)],
    )
    assert [f.rule_id for f in duplicates.detect(ctx)] == ["DUP_RECEIPT_IMAGE"]


def test_a_cross_user_image_match_needs_the_same_amount():
    """Two colleagues at one restaurant on one night, looks alike, different totals."""
    ctx = context(
        users=[user("u1"), user("u2")],
        expenses=[
            expense("u1", dt(2026, 3, 2, 20), "Blue Door Cafe", 4200, receipt="a"),
            expense("u2", dt(2026, 3, 2, 20, 5), "Blue Door Cafe", 9900, receipt="b", submitted=dt(2026, 3, 3)),
        ],
        receipts=[receipt("a", "s1", BASE), receipt("b", "s2", flip(BASE, 4), "u2")],
    )
    assert duplicates.detect(ctx) == []


def test_an_image_match_needs_the_same_transaction_time_when_both_are_known():
    ctx = context(
        expenses=[
            expense("u1", dt(2026, 3, 2, 8, 30), "Blue Door Cafe", 8500, receipt="a"),
            expense("u1", dt(2026, 3, 2, 19, 30), "Blue Door Cafe", 8500, receipt="b", submitted=dt(2026, 3, 3)),
        ],
        receipts=[receipt("a", "s1", BASE), receipt("b", "s2", flip(BASE, 4))],
    )
    assert [f for f in duplicates.detect(ctx) if f.evidence["matched_layer"] == "IMAGE"] == []
