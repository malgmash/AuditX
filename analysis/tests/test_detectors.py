"""Detector tests. Each rule has a case it must fire on and, where the PRD names one, the
near-miss it must not fire on. Precision comes first: the near-misses are as important as the hits."""

from __future__ import annotations

from datetime import date, timedelta

from app.detect import abnormal, duplicates, timesheets
from app.detect.runner import detect_all
from app.detect.severity import assign_severity
from app.detect.types import DetectorConfig

from tests.builders import (
    by_rule, context, dt, entry, expense, receipt, sheet, user, week_of,
)

PHASH_A = "f0f0f0f0f0f0f0f0"
FAR_PHASH = "0123456789abcdef"


def flip(phash: str, bits: int) -> str:
    """A hash `bits` bits away from the original, as a re-photographed receipt would produce."""
    v = int(phash, 16)
    for i in range(bits):
        v ^= 1 << i
    return f"{v:016x}"


# ---------------------------------------------------------------- duplicate receipts


def test_exact_file_resubmitted_weeks_later_fires_exact():
    ctx = context(
        expenses=[
            expense("u1", dt(2026, 3, 2, 12), "Blue Door Cafe", 8500, receipt="r1"),
            expense("u1", dt(2026, 3, 30, 12), "Blue Door Cafe", 8500, receipt="r2", submitted=dt(2026, 3, 31)),
        ],
        receipts=[receipt("r1", "sha-a", PHASH_A), receipt("r2", "sha-a", PHASH_A)],
    )
    found = duplicates.detect(ctx)
    assert [f.rule_id for f in found] == ["DUP_RECEIPT_EXACT"]
    assert found[0].evidence["days_apart"] == 28


def test_rephotographed_receipt_fires_image_not_exact():
    ctx = context(
        expenses=[
            expense("u1", dt(2026, 3, 2, 12), "Blue Door Cafe", 8500, receipt="r1"),
            expense("u1", dt(2026, 3, 2, 12), "Blue Door Cafe", 8500, receipt="r2", submitted=dt(2026, 3, 20)),
        ],
        receipts=[receipt("r1", "sha-a", PHASH_A), receipt("r2", "sha-b", flip(PHASH_A, 5))],
    )
    found = duplicates.detect(ctx)
    assert [f.rule_id for f in found] == ["DUP_RECEIPT_IMAGE"]
    assert found[0].evidence["hamming_distance"] == 5


def test_hash_distance_over_threshold_is_not_a_duplicate():
    ctx = context(
        expenses=[
            expense("u1", dt(2026, 3, 2, 12), "Blue Door Cafe", 8500, receipt="r1"),
            expense("u1", dt(2026, 5, 9, 12), "Corner Hardware", 2300, receipt="r2", submitted=dt(2026, 5, 10)),
        ],
        receipts=[receipt("r1", "sha-a", PHASH_A), receipt("r2", "sha-b", flip(PHASH_A, 9))],
    )
    assert duplicates.detect(ctx) == []


def test_look_alike_receipts_from_different_merchants_and_amounts_are_not_duplicates():
    # Close hashes only because both are plain text receipts. Different merchant and amount.
    ctx = context(
        expenses=[
            expense("u1", dt(2026, 3, 2, 12), "Blue Door Cafe", 8500, receipt="r1"),
            expense("u1", dt(2026, 4, 9, 12), "Corner Hardware", 2300, receipt="r2", submitted=dt(2026, 4, 10)),
        ],
        receipts=[receipt("r1", "sha-a", PHASH_A), receipt("r2", "sha-b", flip(PHASH_A, 4))],
    )
    assert duplicates.detect(ctx) == []


def test_copied_receipt_with_inflated_amount_still_fires():
    ctx = context(
        expenses=[
            expense("u1", dt(2026, 3, 2, 12), "Blue Door Cafe", 8500, receipt="r1"),
            expense("u1", dt(2026, 3, 2, 12), "Blue Door Cafe", 13500, receipt="r2", submitted=dt(2026, 3, 9)),
        ],
        receipts=[receipt("r1", "sha-a", PHASH_A), receipt("r2", "sha-b", flip(PHASH_A, 3))],
    )
    assert [f.rule_id for f in duplicates.detect(ctx)] == ["DUP_RECEIPT_IMAGE"]


def test_different_photo_of_same_meal_fires_fields():
    ctx = context(
        expenses=[
            expense("u1", dt(2026, 3, 2, 19), "Blue Door Cafe", 12000, receipt="r1"),
            expense("u1", dt(2026, 3, 2, 19, 5), "BLUE DOOR CAFE #12", 12100, receipt="r2", submitted=dt(2026, 3, 9)),
        ],
        receipts=[receipt("r1", "sha-a", PHASH_A), receipt("r2", "sha-b", FAR_PHASH)],
    )
    found = duplicates.detect(ctx)
    assert [f.rule_id for f in found] == ["DUP_RECEIPT_FIELDS"]


def test_two_people_submitting_the_same_receipt_fires_cross_user():
    ctx = context(
        users=[user("u1"), user("u2")],
        expenses=[
            expense("u1", dt(2026, 3, 2, 19), "Blue Door Cafe", 24000, receipt="r1"),
            expense("u2", dt(2026, 3, 2, 19), "Blue Door Cafe", 24000, receipt="r2", submitted=dt(2026, 3, 4)),
        ],
        receipts=[receipt("r1", "sha-a", PHASH_A), receipt("r2", "sha-a", PHASH_A, "u2")],
    )
    found = duplicates.detect(ctx)
    assert [f.rule_id for f in found] == ["DUP_RECEIPT_CROSS_USER"]
    assert found[0].subject_user_id == "u2"  # the later submitter
    assert found[0].confidence >= 0.99  # an exact match keeps its own confidence


def test_recurring_daily_charge_is_not_a_duplicate():
    """The daily parking fee. Same merchant, same amount, every weekday, distinct receipts."""
    expenses, receipts = [], []
    day, n = date(2026, 3, 2), 0
    while n < 30:
        if day.weekday() < 5:
            rid = f"park{n}"
            expenses.append(
                expense("u1", dt(day.year, day.month, day.day, 8, 30), "City Garage", 1800, "Transport", receipt=rid)
            )
            receipts.append(receipt(rid, f"sha-park-{n}", f"{(n * 0x9E3779B97F4A7C15) % (1 << 64):016x}"))
            n += 1
        day += timedelta(days=1)
    ctx = context(expenses=expenses, receipts=receipts)
    assert duplicates.detect(ctx) == []


def test_split_dinner_with_different_amounts_is_not_a_duplicate():
    ctx = context(
        users=[user("u1"), user("u2")],
        expenses=[
            expense("u1", dt(2026, 3, 2, 20), "Blue Door Cafe", 4200, receipt="r1"),
            expense("u2", dt(2026, 3, 2, 20), "Blue Door Cafe", 4600, receipt="r2", submitted=dt(2026, 3, 3)),
        ],
        receipts=[receipt("r1", "sha-a", PHASH_A), receipt("r2", "sha-b", FAR_PHASH, "u2")],
    )
    assert duplicates.detect(ctx) == []


# ---------------------------------------------------------------- abnormal expenses


def _meal_history(uid: str, start, n: int, cents: int = 4000, every_days: int = 5):
    """Irregular spending, as a person's really is: uneven gaps and amounts that do not repeat."""
    return [
        expense(
            uid,
            start + timedelta(days=i * every_days + (i * 7) % 4),
            f"Lunch Spot {i % 4}",
            cents + ((i * 37) % 13 - 6) * 110,
            "Meals",
        )
        for i in range(n)
    ]


def test_drifting_claims_fire_self_outlier_with_full_confidence_on_repeat():
    history = _meal_history("u1", dt(2026, 1, 5, 12), 30)  # about five months
    drift = [
        expense("u1", dt(2026, 6, 10, 12), "Steak House", 16500, "Meals"),
        expense("u1", dt(2026, 6, 17, 12), "Steak House", 16800, "Meals"),
        expense("u1", dt(2026, 6, 24, 12), "Steak House", 17000, "Meals"),
    ]
    found = by_rule(abnormal.detect(context(expenses=history + drift)), "EXP_AMOUNT_OUTLIER_SELF")
    assert len(found) >= 2
    assert max(f.confidence for f in found) == 0.70  # the pattern keeps full confidence
    assert min(f.confidence for f in found) == 0.35  # the first, isolated, is discounted


def test_legitimate_conference_ticket_never_exceeds_a_note():
    history = _meal_history("u1", dt(2026, 1, 5, 12), 30)
    ticket = expense("u1", dt(2026, 6, 10, 9), "Regional Dev Conference", 320000, "Training", city="Chicago")
    findings = detect_all(context(expenses=history + [ticket]))
    on_ticket = [f for f in findings if ticket.id in f.expense_ids]
    assert all(f.severity == "NOTE" for f in on_ticket)


def test_isolated_outlier_in_a_familiar_category_is_only_a_note():
    history = _meal_history("u1", dt(2026, 1, 5, 12), 30)
    big = expense("u1", dt(2026, 6, 10, 19), "Steak House", 55000, "Meals")
    findings = detect_all(context(expenses=history + [big]))
    on_big = [f for f in findings if big.id in f.expense_ids]
    assert on_big and all(f.severity == "NOTE" for f in on_big)


def test_new_employee_under_a_month_gets_no_baseline_rules():
    history = _meal_history("u1", dt(2026, 1, 5, 12), 5, every_days=2)  # ten days of data
    big = expense("u1", dt(2026, 1, 16, 19), "Steak House", 90000, "Meals")
    found = abnormal.detect(context(expenses=history + [big]))
    assert by_rule(found, "EXP_AMOUNT_OUTLIER_SELF") == []


def test_peer_comparison_is_skipped_below_five_people():
    users = [user(f"u{i}", "Ops") for i in range(3)]
    expenses = []
    for u in users[:2]:
        expenses += _meal_history(u.id, dt(2026, 1, 5, 12), 12, 3000)
    outlier = expense("u2", dt(2026, 3, 20, 12), "Steak House", 90000, "Meals")
    found = abnormal.detect(context(users=users, expenses=expenses + [outlier]))
    assert by_rule(found, "EXP_AMOUNT_OUTLIER_PEER") == []


def test_peer_outlier_fires_with_a_real_peer_group():
    users = [user(f"u{i}", "Sales") for i in range(6)]
    expenses = []
    for u in users[:5]:
        expenses += _meal_history(u.id, dt(2026, 1, 5, 12), 10, 4000, every_days=7)
    heavy = [
        expense("u5", dt(2026, 3, 16, 12), "Steak House", 20000, "Meals"),
        expense("u5", dt(2026, 3, 23, 12), "Steak House", 21000, "Meals"),
    ]
    # u5 needs a month of history of their own.
    early = expense("u5", dt(2026, 1, 6, 12), "Deli", 3500, "Meals")
    found = by_rule(abnormal.detect(context(users=users, expenses=expenses + [early] + heavy)), "EXP_AMOUNT_OUTLIER_PEER")
    assert {f.expense_ids[0] for f in found} == {h.id for h in heavy}


def test_burst_of_small_claims_fires_velocity_once():
    base = dt(2026, 1, 5, 12)
    normal = [expense("u1", base + timedelta(days=i * 3), "Deli", 1200, "Meals") for i in range(30)]
    burst = [expense("u1", dt(2026, 5, 4, 8) + timedelta(hours=4 * i), "Corner Store", 900, "Supplies") for i in range(14)]
    found = by_rule(abnormal.detect(context(expenses=normal + burst)), "EXP_VELOCITY")
    assert len(found) == 1
    assert found[0].evidence["claims_in_window"] >= 10


def test_electronics_store_claimed_as_meals_fires_category_mismatch():
    e = expense("u1", dt(2026, 3, 2, 12), "Best Buy", 24000, "Meals", merchant_category="Equipment")
    ok = expense("u1", dt(2026, 3, 3, 12), "Blue Door Cafe", 6000, "Client Entertainment", merchant_category="Meals")
    found = by_rule(abnormal.detect(context(expenses=[e, ok])), "EXP_CATEGORY_MISMATCH")
    assert [f.expense_ids[0] for f in found] == [e.id]


def test_round_amount_is_recorded_as_a_note():
    e = expense("u1", dt(2026, 3, 2, 12), "Vendor", 50000, "Supplies")
    findings = detect_all(context(expenses=[e]))
    round_findings = by_rule(findings, "EXP_ROUND_AMOUNT")
    assert round_findings and round_findings[0].severity == "NOTE"


def test_detectors_are_deterministic():
    history = _meal_history("u1", dt(2026, 1, 5, 12), 30)
    ctx = context(expenses=history + [expense("u1", dt(2026, 6, 10, 12), "Steak House", 16500)])
    first = [(f.rule_id, f.dedupe_key, f.confidence, f.severity) for f in detect_all(ctx)]
    second = [(f.rule_id, f.dedupe_key, f.confidence, f.severity) for f in detect_all(ctx)]
    assert first == second


# ---------------------------------------------------------------- suspicious timesheets

TUESDAY = date(2026, 3, 3)


def _office_day(location: str = "Pittsburgh office"):
    return entry("u1", TUESDAY, "09:00", "17:00", location=location, tsid="ts1", eid="e-tue")


def test_office_hours_with_a_receipt_from_another_city_fires_location_conflict():
    lunch = expense("u1", dt(2026, 3, 3, 12, 40), "Deep Dish Place", 1800, "Meals", city="Chicago")
    ctx = context(expenses=[lunch], timesheets=[sheet("u1", "ts1", date(2026, 3, 2), [_office_day()])])
    found = detect_all(ctx)
    conflict = by_rule(found, "TS_LOCATION_CONFLICT")
    assert len(conflict) == 1
    assert conflict[0].expense_ids == [lunch.id]
    assert conflict[0].evidence["declared_city"] == "pittsburgh"
    assert conflict[0].evidence["receipt_cities"] == ["chicago"]
    assert conflict[0].severity == "IMMEDIATE_HOLD"


def test_honest_remote_day_in_another_city_does_not_fire():
    lunch = expense("u1", dt(2026, 3, 3, 12, 40), "Deep Dish Place", 1800, "Meals", city="Chicago")
    remote = entry("u1", TUESDAY, "09:00", "17:00", location="Chicago", tsid="ts1")
    ctx = context(expenses=[lunch], timesheets=[sheet("u1", "ts1", date(2026, 3, 2), [remote])])
    assert by_rule(timesheets.detect(ctx), "TS_LOCATION_CONFLICT") == []


def test_plain_remote_never_conflicts_and_neither_does_a_lunch_near_the_office():
    lunch_far = expense("u1", dt(2026, 3, 3, 12, 40), "Deep Dish Place", 1800, "Meals", city="Chicago")
    remote = entry("u1", TUESDAY, "09:00", "17:00", location="remote", tsid="ts1")
    lunch_near = expense("u1", dt(2026, 3, 3, 12, 40), "Corner Deli", 1200, "Meals", city="Pittsburgh")
    a = context(expenses=[lunch_far], timesheets=[sheet("u1", "ts1", date(2026, 3, 2), [remote])])
    b = context(expenses=[lunch_near], timesheets=[sheet("u1", "ts1", date(2026, 3, 2), [_office_day()])])
    assert by_rule(timesheets.detect(a), "TS_LOCATION_CONFLICT") == []
    assert by_rule(timesheets.detect(b), "TS_LOCATION_CONFLICT") == []


def test_receipt_outside_the_logged_window_does_not_fire():
    late = expense("u1", dt(2026, 3, 3, 21, 0), "Deep Dish Place", 1800, "Meals", city="Chicago")
    ctx = context(expenses=[late], timesheets=[sheet("u1", "ts1", date(2026, 3, 2), [_office_day()])])
    assert by_rule(timesheets.detect(ctx), "TS_LOCATION_CONFLICT") == []


def test_overlapping_entries_fire_and_back_to_back_entries_do_not():
    overlapping = [
        entry("u1", TUESDAY, "09:00", "13:00", tsid="ts1", eid="a"),
        entry("u1", TUESDAY, "11:00", "15:00", tsid="ts1", eid="b"),
    ]
    adjacent = [
        entry("u1", TUESDAY, "09:00", "12:00", tsid="ts1", eid="a"),
        entry("u1", TUESDAY, "12:00", "17:00", tsid="ts1", eid="b"),
    ]
    hit = timesheets.detect(context(timesheets=[sheet("u1", "ts1", date(2026, 3, 2), overlapping)]))
    miss = timesheets.detect(context(timesheets=[sheet("u1", "ts1", date(2026, 3, 2), adjacent)]))
    assert [f.evidence["overlap_hours"] for f in by_rule(hit, "TS_OVERLAP")] == [2.0]
    assert by_rule(miss, "TS_OVERLAP") == []


def test_nineteen_hour_day_fires_and_fourteen_hour_launch_day_does_not():
    long_day = [entry("u1", TUESDAY, "05:00", "24:00".replace("24", "23"), hours=19.0, tsid="ts1")]
    launch_day = [entry("u1", TUESDAY, "07:00", "21:00", tsid="ts1")]
    hit = timesheets.detect(context(timesheets=[sheet("u1", "ts1", date(2026, 3, 2), long_day)]))
    miss = timesheets.detect(context(timesheets=[sheet("u1", "ts1", date(2026, 3, 2), launch_day)]))
    assert len(by_rule(hit, "TS_IMPOSSIBLE_HOURS")) == 1
    assert by_rule(miss, "TS_IMPOSSIBLE_HOURS") == []


def _jittered_week(uid, tsid, monday):
    times = [("08:47", "17:12"), ("09:03", "17:41"), ("08:52", "16:58"), ("09:11", "17:26"), ("08:39", "16:50")]
    return week_of(uid, tsid, monday, times)


def test_a_week_copied_verbatim_fires_once():
    weeks = [_jittered_week("u1", f"w{i}", date(2026, 3, 2) + timedelta(days=7 * i)) for i in range(4)]
    found = by_rule(timesheets.detect(context(timesheets=weeks)), "TS_COPY_PASTE")
    assert len(found) == 1
    assert found[0].evidence["identical_weeks"] == 4


def test_a_tidy_nine_to_five_schedule_is_not_copy_paste():
    tidy = [("09:00", "17:00")] * 5
    weeks = [week_of("u1", f"w{i}", date(2026, 3, 2) + timedelta(days=7 * i), tidy) for i in range(4)]
    assert by_rule(timesheets.detect(context(timesheets=weeks)), "TS_COPY_PASTE") == []


def test_exactly_eight_hours_for_many_weeks_fires_round_hours():
    def weekly(i, starts):
        times = [(s, f"{int(s[:2]) + 8:02d}:{s[3:]}") for s in starts]
        return week_of("u1", f"w{i}", date(2026, 3, 2) + timedelta(days=7 * i), times)

    variety = [
        ["08:00", "09:00", "08:30", "09:30", "08:00"],
        ["09:00", "08:00", "09:30", "08:30", "09:00"],
        ["08:30", "09:30", "08:00", "09:00", "08:30"],
        ["09:30", "08:30", "09:00", "08:00", "09:30"],
        ["08:00", "08:30", "09:00", "09:30", "08:00"],
    ]
    five = [weekly(i, s) for i, s in enumerate(variety)]
    three = five[:3]
    assert len(by_rule(timesheets.detect(context(timesheets=five)), "TS_ROUND_HOURS")) == 1
    assert by_rule(timesheets.detect(context(timesheets=three)), "TS_ROUND_HOURS") == []


def test_hours_on_a_holiday_fire_unless_approval_is_noted():
    holiday = date(2026, 7, 3)
    plain = entry("u1", holiday, "09:00", "17:00", tsid="ts1")
    approved = entry("u1", holiday, "09:00", "17:00", tsid="ts1", note="Approved by manager for launch")
    hit = timesheets.detect(context(timesheets=[sheet("u1", "ts1", date(2026, 6, 29), [plain])], holidays={holiday}))
    miss = timesheets.detect(context(timesheets=[sheet("u1", "ts1", date(2026, 6, 29), [approved])], holidays={holiday}))
    assert len(by_rule(hit, "TS_HOLIDAY")) == 1
    assert by_rule(miss, "TS_HOLIDAY") == []


# ---------------------------------------------------------------- severity


def test_severity_matrix():
    cfg = DetectorConfig()
    # monthly average 1000 dollars, so the high amount line is min(250 dollars, 3 percent = 30 dollars)
    monthly = 100_000
    assert assign_severity(0.95, 5_000, monthly, cfg) == "IMMEDIATE_HOLD"
    assert assign_severity(0.95, 1_000, monthly, cfg) == "CASE"
    assert assign_severity(0.70, 5_000, monthly, cfg) == "CASE"
    assert assign_severity(0.70, 1_000, monthly, cfg) == "NOTE"
    # A weak rule is a note whatever the amount.
    assert assign_severity(0.45, 500_000, monthly, cfg) == "NOTE"


def test_high_amount_line_is_the_lower_of_the_fixed_and_relative_amounts():
    cfg = DetectorConfig()
    big_spender = 5_000_000  # 3 percent is 1500 dollars, so the fixed 250 dollars applies
    assert assign_severity(0.95, 24_999, big_spender, cfg) == "CASE"
    assert assign_severity(0.95, 25_000, big_spender, cfg) == "IMMEDIATE_HOLD"
