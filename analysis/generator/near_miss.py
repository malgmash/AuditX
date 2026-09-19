"""Near-misses: cases that look like fraud and are not.

The detectors must not fire on these. Each writes a ground truth row with `expected=None`. Getting
these right is worth more than getting the true positives right: a false accusation against a
named employee is the failure that ends the product.

Kept apart from fraud.py on purpose. When someone asks whether the detectors only find data that
was planted for them, opening these two files side by side is a better answer than a paragraph.
"""

from __future__ import annotations

from datetime import timedelta

from generator.builder import Builder, at
from generator.dataset import GroundTruth
from generator.expenses import daterange
from generator.fraud import DEMO_EMAIL, _users

DUP_RULES = ["DUP_RECEIPT_EXACT", "DUP_RECEIPT_IMAGE", "DUP_RECEIPT_FIELDS", "DUP_RECEIPT_CROSS_USER"]


def _truth(b: Builder, **kw) -> None:
    b.ds.ground_truth.append(GroundTruth(expected=None, **kw))


def _free_day(b: Builder, user_id: str):
    """An office day with no timed receipts on it, so a rewritten timesheet cannot collide with
    an honest lunch."""
    start, end = b.ds.period
    timed_days = {x.rec.incurred_at.date() for x in b.ds.expenses if x.rec.user_id == user_id and x.rec.has_time}
    for d in daterange(start + timedelta(weeks=6), end - timedelta(days=14)):
        if b.day_plan.get((user_id, d)) == "office" and d not in timed_days and b.entries_on(user_id, d):
            return d
    return None


def _user_with_free_day(b: Builder):
    """A user whose timesheet was not rewritten by an injector and who has a free office day."""
    pool = _users(b, exclude=b.ts_busy)
    b.rng.shuffle(pool)
    for p in pool:
        d = _free_day(b, p.user_id)
        if d is not None:
            return p, d
    raise RuntimeError("no user has a free office day for the near-miss scenarios")


def _split_dinner(b: Builder) -> None:
    """Two colleagues split a dinner and each submit their own half: different amounts, the same
    merchant, the same night."""
    a, c = b.rng.sample(_users(b), 2)
    steak = b.merchant_by_name["Fifth Avenue Steakhouse"]
    start, end = b.ds.period
    d = start + timedelta(weeks=14)
    d += timedelta(days=(1 - d.weekday()) % 7)
    ids = []
    for user, cents, hm in ((a, 4210, "20:05"), (c, 4590, "20:08")):
        row = b.add_expense(user.user_id, steak, "Meals", cents, d, time_hm=hm, submitted=at(d + timedelta(days=1), "09:30"),
                            description="Team dinner, my half")
        ids.append(row.rec.id)
    _truth(b, scenario="split_dinner_two_halves", user_id=a.user_id, target_ids=ids, max_severity="NONE",
           watch_rules=DUP_RULES, note="Two people, one dinner, each claiming their own half")


def _conference_ticket(b: Builder) -> None:
    """A genuine $3,200 conference ticket from someone who normally spends about forty dollars."""
    training = {x.rec.user_id for x in b.ds.expenses if x.rec.category == "Training"}
    p = next(u for u in _users(b) if u.user_id not in training)
    conf = b.merchant_by_name["Regional Dev Conference"]
    d = b.ds.period[0] + timedelta(weeks=16, days=2)
    row = b.add_expense(p.user_id, conf, "Training", 320000, d, description="Regional developer conference, 3 day pass")
    _truth(b, scenario="legitimate_conference_ticket", user_id=p.user_id, target_ids=[row.rec.id], max_severity="NOTE",
           note="Large, round, one-off. Recorded, never a case")


def _launch_day(b: Builder) -> None:
    """A real 14 hour day before a product launch, with a late meal receipt that corroborates it."""
    p, d = _user_with_free_day(b)
    first = b.entries_on(p.user_id, d)[0]
    long_day = b.make_entry(p.user_id, d, at(d, "07:00"), at(d, "21:00"), first.project or "", "Pittsburgh office")
    tid = b.set_day(p.user_id, d, [long_day])
    diner = next(m for m in b.ds.merchants if m.category == "Meals" and m.city == "Pittsburgh")
    row = b.add_expense(p.user_id, diner, "Meals", 3140, d, time_hm="20:15", description="Late dinner at the office, launch night")
    _truth(b, scenario="fourteen_hour_launch_day", user_id=p.user_id, target_ids=[tid, row.rec.id], max_severity="NONE",
           watch_rules=["TS_IMPOSSIBLE_HOURS", "TS_LOCATION_CONFLICT", "TS_OVERLAP"],
           note="14 hours is long, not impossible, and the meal receipt corroborates it")


def _recurring_parking(b: Builder) -> None:
    """The same $16.00 garage receipt every office day. The field layer must recognise a schedule."""
    uid, cents = next((u, c) for u, c in b.commuters.items() if c == 1600)
    ids = [x.rec.id for x in b.ds.expenses if x.rec.user_id == uid and "parking" in x.description.lower()]
    _truth(b, scenario="recurring_daily_parking", user_id=uid, target_ids=ids, max_severity="NONE",
           watch_rules=DUP_RULES, note=f"{len(ids)} identical charges on a weekday schedule")


def _remote_in_another_city(b: Builder) -> None:
    """Working remotely from Chicago with the location field set honestly. Same shape as a location
    conflict, except the declared city matches the receipt."""
    p, d = _user_with_free_day(b)
    entry = b.make_entry(p.user_id, d, at(d, "09:00"), at(d, "17:00"), p.project_names[0], "Chicago")
    tid = b.set_day(p.user_id, d, [entry])
    eatery = next(m for m in b.ds.merchants if m.category == "Meals" and m.city == "Chicago")
    row = b.add_expense(p.user_id, eatery, "Meals", 2150, d, time_hm="12:30", submitted=at(d + timedelta(days=6), "16:00"))
    _truth(b, scenario="remote_work_in_another_city", user_id=p.user_id, target_ids=[tid, row.rec.id], max_severity="NONE",
           watch_rules=["TS_LOCATION_CONFLICT"], note="Timesheet location says Chicago, receipt is from Chicago")


def _laptop(b: Builder) -> None:
    p = next(u for u in _users(b) if u.department == "Engineering")
    shop = b.merchant_by_name["Circuit Depot"]
    d = b.ds.period[0] + timedelta(weeks=18, days=1)
    row = b.add_expense(p.user_id, shop, "Equipment", 214037, d, description="Replacement laptop, previous one failed")
    _truth(b, scenario="legitimate_laptop_replacement", user_id=p.user_id, target_ids=[row.rec.id], max_severity="NOTE",
           note="A large one-off equipment purchase")


def _offsite(b: Builder) -> None:
    mgr = next(u for u in _users(b) if any(w in u.job_title.lower() for w in ("manager", "lead", "director")))
    chop = b.merchant_by_name["Grant Street Chophouse"]
    d = b.ds.period[0] + timedelta(weeks=12, days=3)
    row = b.add_expense(mgr.user_id, chop, "Client Entertainment", 185000, d, time_hm="19:00", description="Team offsite dinner")
    _truth(b, scenario="legitimate_team_offsite", user_id=mgr.user_id, target_ids=[row.rec.id], max_severity="NOTE",
           note="A large, round team dinner")


def _approved_holiday(b: Builder) -> None:
    d = sorted(b.ds.holidays)[0]
    for p in _users(b, exclude=b.ts_busy):
        if b.timesheet_for(p.user_id, d) is not None:
            entry = b.make_entry(p.user_id, d, at(d, "09:00"), at(d, "14:00"), p.project_names[0], "Pittsburgh office",
                                 note="Approved by manager for the release")
            tid = b.set_day(p.user_id, d, [entry])
            _truth(b, scenario="approved_holiday_work", user_id=p.user_id, target_ids=[tid], max_severity="NONE",
                   watch_rules=["TS_HOLIDAY"], note="Holiday hours with the approval noted")
            return


def inject(b: Builder) -> None:
    for step in (
        _split_dinner, _conference_ticket, _launch_day, _recurring_parking,
        _remote_in_another_city, _laptop, _offsite, _approved_holiday,
    ):
        step(b)
