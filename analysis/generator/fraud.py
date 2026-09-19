"""Injected problems: the scenarios the detectors are expected to catch.

Every scenario writes a GroundTruth row naming the records it touched and the rule that should
fire. `evaluate` reads those rows. Counts follow DATA-GENERATION.md. The last three scenarios,
holiday hours, round amounts and off-pattern timing, are additions: the original list left three
rules with nothing to measure them against.

Honest data is never edited here except to inflate a claim or rewrite a timesheet day, and each
such edit redraws the receipt so the claim and its image still agree.
"""

from __future__ import annotations

import dataclasses
import sys
from datetime import timedelta
from statistics import median

from generator.builder import Builder, at
from generator.dataset import GroundTruth
from generator.expenses import daterange
from generator.merchants import HQ_CITY, TRAVEL_CITIES

DEMO_EMAIL = "employee@auditx.local"


# ------------------------------------------------------------------ selection helpers


def _hold_line(b: Builder) -> dict[str, int]:
    """The claim size above which a high-confidence finding earns a hold, per employee."""
    if not hasattr(b, "_hold_line"):
        from app.detect.severity import high_amount_threshold_cents, monthly_average_cents

        ctx = b.ds.context()
        monthly = monthly_average_cents(ctx)
        b._hold_line = {u.id: high_amount_threshold_cents(monthly.get(u.id), ctx.config) for u in ctx.users}
    return b._hold_line


def _originals(
    b: Builder, *, min_cents: int, timed: bool | None = None, categories=None, room_days: int = 16, hold: bool = False
):
    """Honest claims that are good candidates to copy: a receipt, a real amount, not a recurring
    charge, and enough of the period left for the copy to be submitted later."""
    end = b.ds.period[1]
    out = []
    for x in b.ds.expenses:
        r = x.rec
        if r.id in b.used or r.receipt_id is None or r.amount_cents < min_cents:
            continue
        if hold and r.amount_cents < 1.15 * _hold_line(b)[r.user_id]:
            continue
        if "parking" in x.description.lower() or "subscription" in x.description.lower():
            continue
        if timed is not None and r.has_time != timed:
            continue
        if categories and r.category not in categories:
            continue
        if r.submitted_at.date() + timedelta(days=room_days) > end:
            continue
        out.append(x)
    return out


def _users(b: Builder, *, exclude=(), need_history: bool = True):
    start = b.ds.period[0]
    return [
        p for p in b.ds.profiles
        if p.user_id not in exclude and p.email != DEMO_EMAIL and p.role == "EMPLOYEE"
        and (not need_history or p.start_date < start)
    ]


def _copy_day_time(row):
    r = row.rec
    return r.incurred_at.date(), (r.incurred_at.strftime("%H:%M") if r.has_time else None)


def _later(b: Builder, base, lo: int, hi: int):
    end = at(b.ds.period[1], "20:00")
    return min(end, base + timedelta(days=b.rng.randint(lo, hi), hours=b.rng.randint(0, 5)))


def _truth(b: Builder, **kw) -> None:
    if str(kw.get("expected", "")).startswith("TS_"):
        b.ts_busy.add(kw["user_id"])
    b.used.update(kw.get("target_ids", []))
    b.ds.ground_truth.append(GroundTruth(**kw))


def _sample(b: Builder, pool, n: int, what: str):
    """rng.sample that survives a small population: warn and take what exists."""
    pool = list(pool)
    if len(pool) < n:
        print(f"warning: {what} wanted {n} candidates and found {len(pool)}", file=sys.stderr)
    return b.rng.sample(pool, min(n, len(pool)))


# ------------------------------------------------------------------ duplicate receipts


def _duplicate_of(b: Builder, src, *, user_id: str, receipt_id: str, submitted, printed=None, cents=None, style=None, make=False):
    day, hm = _copy_day_time(src)
    return b.add_expense(
        user_id, b.merchant_of[src.rec.id], src.rec.category,
        cents if cents is not None else src.rec.amount_cents, day, time_hm=hm,
        submitted=submitted, merchant_printed=printed or src.rec.merchant_raw,
        receipt_id=receipt_id, make_receipt=make, style=style,
    )


def _exact(b: Builder) -> None:
    for src in _sample(b, _originals(b, min_cents=6000, hold=True), 6, "exact duplicates"):
        b.used.add(src.rec.id)
        rid = b.add_receipt_copy(src.rec.user_id, src.rec.receipt_id)
        new = _duplicate_of(b, src, user_id=src.rec.user_id, receipt_id=rid, submitted=_later(b, src.rec.submitted_at, 14, 42))
        _truth(b, scenario="same_receipt_file_resubmitted", expected="DUP_RECEIPT_EXACT", user_id=src.rec.user_id,
               target_ids=[new.rec.id], min_severity="IMMEDIATE_HOLD")


def _image(b: Builder) -> None:
    for src in _sample(b, _originals(b, min_cents=6000, hold=True), 8, "image duplicates"):
        b.used.add(src.rec.id)
        rid = b.add_receipt_rephoto(src.rec.user_id, src.rec.receipt_id)
        new = _duplicate_of(b, src, user_id=src.rec.user_id, receipt_id=rid, submitted=_later(b, src.rec.submitted_at, 10, 35))
        _truth(b, scenario="receipt_rephotographed", expected="DUP_RECEIPT_IMAGE", user_id=src.rec.user_id,
               target_ids=[new.rec.id], min_severity="IMMEDIATE_HOLD", alt=["DUP_RECEIPT_EXACT", "DUP_RECEIPT_IMAGE", "DUP_RECEIPT_FIELDS", "DUP_RECEIPT_CROSS_USER"])


def _fields(b: Builder) -> None:
    """A different photo of the same meal: a fresh render, so the hash is unrelated, with the same
    merchant, time and nearly the same total."""
    for src in _sample(b, _originals(b, min_cents=6000, timed=True, categories={"Meals", "Client Entertainment"}), 5, "field duplicates"):
        b.used.add(src.rec.id)
        printed = src.rec.merchant_raw.upper()
        cents = int(src.rec.amount_cents * b.rng.choice([0.995, 1.0, 1.005]))
        new = _duplicate_of(b, src, user_id=src.rec.user_id, receipt_id=None, make=True, printed=printed, cents=cents,
                            style=(b.spec_of[src.rec.receipt_id].style + 1) % 4,
                            submitted=_later(b, src.rec.submitted_at, 5, 25))
        _truth(b, scenario="different_photo_of_same_meal", expected="DUP_RECEIPT_FIELDS", user_id=src.rec.user_id,
               target_ids=[new.rec.id], min_severity="CASE", alt=["DUP_RECEIPT_EXACT", "DUP_RECEIPT_IMAGE", "DUP_RECEIPT_FIELDS", "DUP_RECEIPT_CROSS_USER"])


def _cross_user(b: Builder) -> None:
    pool = _originals(b, min_cents=6000, timed=True, categories={"Meals", "Client Entertainment"}, hold=True)
    for i, src in enumerate(_sample(b, pool, 4, "cross-user duplicates")):
        b.used.add(src.rec.id)
        other = b.rng.choice(_users(b, exclude={src.rec.user_id}))
        # Two by file, two by re-photograph, since colleagues do both.
        rid = (b.add_receipt_copy if i % 2 == 0 else b.add_receipt_rephoto)(other.user_id, src.rec.receipt_id)
        new = _duplicate_of(b, src, user_id=other.user_id, receipt_id=rid, submitted=_later(b, src.rec.submitted_at, 2, 10))
        _truth(b, scenario="two_employees_same_dinner", expected="DUP_RECEIPT_CROSS_USER", user_id=other.user_id,
               target_ids=[new.rec.id], min_severity="IMMEDIATE_HOLD", alt=["DUP_RECEIPT_EXACT", "DUP_RECEIPT_IMAGE", "DUP_RECEIPT_FIELDS", "DUP_RECEIPT_CROSS_USER"])


# ------------------------------------------------------------------ abnormal expenses


def _drift(b: Builder) -> None:
    """Meal claims that climb to about four times the person's own median over two months."""
    end = b.ds.period[1]
    window_start = end - timedelta(days=56)
    picks = []
    for p in _users(b):
        meals = [x for x in b.ds.expenses if x.rec.user_id == p.user_id and x.rec.category == "Meals"
                 and x.rec.id not in b.used and "parking" not in x.description.lower()]
        recent = sorted((x for x in meals if x.rec.incurred_at.date() >= window_start), key=lambda x: x.rec.incurred_at)
        if len(meals) >= 25 and len(recent) >= 6:
            picks.append((p, recent))
    for p, recent in _sample(b, picks, 3, "drift"):
        ids = []
        for i, x in enumerate(recent):
            mult = 2.0 + 2.2 * i / max(1, len(recent) - 1)
            b.reprice(x.rec.id, int(x.rec.amount_cents * mult))
            b.used.add(x.rec.id)
            ids.append(x.rec.id)
        _truth(b, scenario="meal_claims_drift_to_4x", expected="EXP_AMOUNT_OUTLIER_SELF", user_id=p.user_id,
               target_ids=ids, min_severity="CASE", also=["EXP_AMOUNT_OUTLIER_PEER", "EXP_ROUND_AMOUNT"])


def _peer(b: Builder) -> None:
    """Two employees whose travel claims run at three times their department's median."""
    dept_of = {p.user_id: p.department for p in b.ds.profiles}
    picks = []
    for p in _users(b):
        if p.department in ("Operations", "Finance"):
            continue
        trav = [x for x in b.ds.expenses if x.rec.user_id == p.user_id and x.rec.category == "Travel" and x.rec.id not in b.used]
        if len(trav) >= 3:
            picks.append((p, trav))
    for p, trav in _sample(b, picks, 2, "peer travel"):
        others = [
            x.rec.amount_cents for x in b.ds.expenses
            if x.rec.category == "Travel" and dept_of[x.rec.user_id] == p.department and x.rec.user_id != p.user_id
        ]
        dept_median = median(others)
        ids = []
        for x in trav:
            b.reprice(x.rec.id, int(3.0 * dept_median * b.rng.uniform(0.92, 1.12)))
            b.used.add(x.rec.id)
            ids.append(x.rec.id)
        _truth(b, scenario="travel_3x_department_median", expected="EXP_AMOUNT_OUTLIER_PEER", user_id=p.user_id,
               target_ids=ids, min_severity="CASE", also=["EXP_AMOUNT_OUTLIER_SELF", "EXP_ROUND_AMOUNT"])


def _velocity(b: Builder) -> None:
    """A burst of fourteen small claims in three days."""
    end = b.ds.period[1]
    commuters = set(getattr(b, "commuters", {}))
    users = [p for p in _users(b) if p.user_id not in commuters and p.monthly_rate < 11]
    meal_merchants = [m for m in b.ds.merchants if m.category == "Meals" and m.city == HQ_CITY]
    supply_merchants = [m for m in b.ds.merchants if m.category == "Supplies"]
    for p in _sample(b, users, 2, "velocity"):
        while True:
            d0 = end - timedelta(days=b.rng.randint(10, 60))
            days = [d0 + timedelta(days=i) for i in range(3)]
            if all(b.day_plan.get((p.user_id, d)) in ("office", "remote") for d in days):
                break
        ids = []
        for i in range(14):
            day = days[i % 3]
            if i % 2 == 0:
                m = b.rng.choice(meal_merchants)
                row = b.add_expense(p.user_id, m, "Meals", b.rng.randint(500, 1400) + b.rng.randint(1, 99) % 7, day,
                                    time_hm=f"{b.rng.randint(8, 19):02d}:{b.rng.randint(0, 59):02d}")
            else:
                m = b.rng.choice(supply_merchants)
                row = b.add_expense(p.user_id, m, "Supplies", b.rng.randint(500, 2400), day)
            row.rec = dataclasses.replace(row.rec, submitted_at=row.rec.incurred_at + timedelta(hours=b.rng.randint(1, 7)))
            ids.append(row.rec.id)
        _truth(b, scenario="burst_of_small_claims", expected="EXP_VELOCITY", user_id=p.user_id,
               target_ids=ids, min_severity="CASE")


def _mismatch(b: Builder) -> None:
    """An electronics store claimed as Meals."""
    stores = [m for m in b.ds.merchants if m.category == "Equipment"]
    start, end = b.ds.period
    for p in _sample(b, _users(b), 5, "category mismatch"):
        day = start + timedelta(days=b.rng.randint(35, (end - start).days - 5))
        day -= timedelta(days=max(0, day.weekday() - 4))  # a weekday
        row = b.add_expense(p.user_id, b.rng.choice(stores), "Meals", b.rng.randint(6000, 16000), day)
        _truth(b, scenario="electronics_expensed_as_meals", expected="EXP_CATEGORY_MISMATCH", user_id=p.user_id,
               target_ids=[row.rec.id], min_severity="CASE", also=["EXP_AMOUNT_OUTLIER_SELF", "EXP_AMOUNT_OUTLIER_PEER"])


def _round_amount(b: Builder) -> None:
    shops = [m for m in b.ds.merchants if m.category == "Supplies"]
    start, end = b.ds.period
    for p, cents in zip(_sample(b, _users(b), 3, "round amount"), (50000, 30000, 100000)):
        day = start + timedelta(days=b.rng.randint(40, (end - start).days - 5))
        row = b.add_expense(p.user_id, b.rng.choice(shops), "Supplies", cents, day)
        _truth(b, scenario="round_amount_claim", expected="EXP_ROUND_AMOUNT", user_id=p.user_id,
               target_ids=[row.rec.id], min_severity="NOTE", also=["EXP_AMOUNT_OUTLIER_SELF", "EXP_AMOUNT_OUTLIER_PEER"])


def _off_pattern(b: Builder) -> None:
    """A large weekend claim from someone who has never claimed on a weekend, after a long enough
    history for that to mean something."""
    end = b.ds.period[1]
    meal_merchants = [m for m in b.ds.merchants if m.category == "Meals" and m.city == HQ_CITY]
    picks = []
    for p in _users(b):
        if p.weekend_share > 0:
            continue
        meals = sorted(x.rec.incurred_at for x in b.ds.expenses if x.rec.user_id == p.user_id and x.rec.category == "Meals")
        # A Saturday in the last five weeks with at least 18 meal claims before it.
        for back in range(0, 5):
            saturday = end - timedelta(days=(end.weekday() - 5) % 7 + 7 * back)
            if sum(1 for t in meals if t.date() < saturday) >= 18:
                picks.append((p, saturday))
                break
    for p, saturday in _sample(b, picks, 2, "off-pattern"):
        row = b.add_expense(p.user_id, b.rng.choice(meal_merchants), "Meals", b.rng.randint(7500, 9500), saturday, time_hm="13:10")
        _truth(b, scenario="weekend_claim_never_seen_before", expected="EXP_OFF_PATTERN", user_id=p.user_id,
               target_ids=[row.rec.id], min_severity="CASE", also=["EXP_AMOUNT_OUTLIER_SELF", "EXP_AMOUNT_OUTLIER_PEER"])


# ------------------------------------------------------------------ suspicious timesheets


def _office_days(b: Builder, user_id: str, lo: int = 3, hi: int = 24):
    """Weekdays in the period when the person was at the office, with no trip."""
    start, end = b.ds.period
    out = []
    for d in daterange(start + timedelta(weeks=lo), end - timedelta(days=2)):
        if b.day_plan.get((user_id, d)) == "office" and b.entries_on(user_id, d):
            out.append(d)
    return out


def _overlap(b: Builder) -> None:
    for p in _sample(b, _users(b, exclude=b.ts_busy), 6, "overlap"):
        days = [d for d in _office_days(b, p.user_id) if len(b.entries_on(p.user_id, d)) == 1]
        if not days:
            continue
        d = b.rng.choice(days)
        first = b.entries_on(p.user_id, d)[0]
        start = first.end - timedelta(hours=2)
        extra = b.make_entry(p.user_id, d, start, start + timedelta(hours=3, minutes=b.rng.randint(0, 20)),
                             b.rng.choice([x for x in p.project_names if x != first.project] or p.project_names), first.location)
        tid = b.set_day(p.user_id, d, [first, extra])
        _truth(b, scenario="timesheet_entries_overlap_two_hours", expected="TS_OVERLAP", user_id=p.user_id,
               target_ids=[tid], min_severity="CASE")


def _copy_paste(b: Builder) -> None:
    start, end = b.ds.period
    done = 0
    for p in _sample(b, _users(b, exclude=b.ts_busy), len(_users(b, exclude=b.ts_busy)), "copy-paste"):
        if done == 3:
            break
        weeks = [start + timedelta(weeks=w) for w in range(4, 20)]
        for w0 in b.rng.sample(weeks, len(weeks)):
            span = [w0 + timedelta(weeks=k) for k in range(4)]
            rows = [b.timesheet_for(p.user_id, m) for m in span]
            clean = all(
                r is not None and len(r.rec.entries) >= 3
                and not any(day in b.ds.holidays for day in daterange(m, m + timedelta(days=4)))
                and all(b.day_plan.get((p.user_id, day)) in ("office", "remote", None) for day in daterange(m, m + timedelta(days=4)))
                for r, m in zip(rows, span)
            )
            if not clean:
                continue
            base = rows[0].rec.entries
            ids = [rows[0].rec.id]
            for k in range(1, 4):
                shift = timedelta(weeks=k)
                copies = [b.make_entry(p.user_id, e.work_date + shift, e.start + shift, e.end + shift, e.project or "", e.location) for e in base]
                ids.append(b.replace_timesheet(rows[k].rec.id, copies).id)
            _truth(b, scenario="week_copied_verbatim_four_times", expected="TS_COPY_PASTE", user_id=p.user_id,
                   target_ids=ids, min_severity="CASE")
            done += 1
            break


def _impossible(b: Builder) -> None:
    for p in _sample(b, _users(b, exclude=b.ts_busy), 2, "impossible hours"):
        d = b.rng.choice(_office_days(b, p.user_id))
        first = b.entries_on(p.user_id, d)[0]
        long_day = b.make_entry(p.user_id, d, at(d, "04:30"), at(d, "23:30"), first.project or "", first.location)
        tid = b.set_day(p.user_id, d, [long_day])
        _truth(b, scenario="nineteen_hours_in_one_day", expected="TS_IMPOSSIBLE_HOURS", user_id=p.user_id,
               target_ids=[tid], min_severity="CASE")


def _round_hours(b: Builder) -> None:
    start, end = b.ds.period
    done = 0
    for p in _sample(b, _users(b, exclude=b.ts_busy), len(_users(b, exclude=b.ts_busy)), "round hours"):
        if done == 3:
            break
        w0 = start + timedelta(weeks=b.rng.randint(3, 15))
        span = [w0 + timedelta(weeks=k) for k in range(7)]
        rows = [b.timesheet_for(p.user_id, m) for m in span]
        if any(r is None or len({e.work_date for e in r.rec.entries}) < 3 for r in rows):
            continue
        ids = []
        for r in rows:
            entries = []
            for day in sorted({e.work_date for e in r.rec.entries}):
                first = next(e for e in r.rec.entries if e.work_date == day)
                s = at(day, b.rng.choice(["08:00", "08:30", "09:00", "09:30"]))
                entries.append(b.make_entry(p.user_id, day, s, s + timedelta(hours=8), first.project or "", first.location))
            ids.append(b.replace_timesheet(r.rec.id, entries).id)
        _truth(b, scenario="exactly_eight_hours_seven_weeks", expected="TS_ROUND_HOURS", user_id=p.user_id,
               target_ids=ids, min_severity="NOTE")
        done += 1


def _location_conflict(b: Builder) -> None:
    """Office hours logged in Pittsburgh while a lunch receipt places the person in another city
    the same day. The first is the demo case: Jamie, a Tuesday, a lunch in Chicago at 12:40."""
    end = b.ds.period[1]
    demo = next(p for p in b.ds.profiles if p.email == DEMO_EMAIL)
    others = _sample(b, _users(b, exclude=b.ts_busy), 3, "location conflict")
    cities = ["Chicago", *b.rng.sample([c for c in TRAVEL_CITIES if c != "Chicago"], 3)]
    for i, (p, city) in enumerate(zip([demo, *others], cities)):
        days = [d for d in _office_days(b, p.user_id) if (d.weekday() == 1 if i == 0 else True) and d < end - timedelta(days=12)]
        d = days[len(days) // 2] if i == 0 else b.rng.choice(days)
        office = b.make_entry(p.user_id, d, at(d, "09:00"), at(d, "17:00"), p.project_names[0], "Pittsburgh office")
        tid = b.set_day(p.user_id, d, [office])
        eatery = next(m for m in b.ds.merchants if m.category == "Meals" and m.city == city)
        cents, hm = (1860, "12:40") if i == 0 else (b.rng.randint(1400, 2800), f"{b.rng.randint(12, 13):02d}:{b.rng.randint(0, 59):02d}")
        row = b.add_expense(p.user_id, eatery, "Meals", cents, d, time_hm=hm, submitted=at(d + timedelta(days=7), "10:15"))
        _truth(b, scenario="office_hours_but_receipt_in_another_city", expected="TS_LOCATION_CONFLICT", user_id=p.user_id,
               target_ids=[row.rec.id, tid], min_severity="IMMEDIATE_HOLD", demo=i == 0,
               note=f"Pittsburgh office 09:00-17:00 on {d.isoformat()}, lunch receipt in {city} at {hm}")


def _holiday(b: Builder) -> None:
    for d, p in zip(sorted(b.ds.holidays)[-2:], _sample(b, _users(b, exclude=b.ts_busy), 2, "holiday")):
        if b.timesheet_for(p.user_id, d) is None:
            continue
        entry = b.make_entry(p.user_id, d, at(d, "09:00"), at(d, "15:30"), p.project_names[0], "Pittsburgh office")
        tid = b.set_day(p.user_id, d, [entry])
        _truth(b, scenario="hours_on_a_company_holiday", expected="TS_HOLIDAY", user_id=p.user_id,
               target_ids=[tid], min_severity="CASE")


def inject(b: Builder) -> None:
    for step in (
        _exact, _image, _fields, _cross_user,
        _drift, _peer, _velocity, _mismatch, _round_amount, _off_pattern,
        _overlap, _copy_paste, _impossible, _round_hours, _location_conflict, _holiday,
    ):
        step(b)
