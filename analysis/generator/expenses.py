"""The honest expense stream.

Roughly ten claims per employee per month, Poisson distributed, drawn from each person's spending
personality. Travel and lodging come from trips, so an employee's timesheet location and their
receipts agree by construction. Injected problems are added later by fraud.py.
"""

from __future__ import annotations

import random
from datetime import date, timedelta

from generator.builder import TIMED, Builder
from generator.merchants import HQ_CITY, TRAVEL_CITIES
from generator.profiles import Profile, choose, poisson

US_HOLIDAYS_2026 = {
    date(2026, 5, 25): "Memorial Day",
    date(2026, 6, 19): "Juneteenth",
    date(2026, 7, 3): "Independence Day observed",
    date(2026, 9, 7): "Labor Day",
}

# Travel is busier in the first quarter and in the third quarter.
TRAVEL_SEASON = {3: 1.25, 7: 1.20, 8: 1.20, 9: 1.15}

NEW_HIRE_WEEKS = (5, 10)  # two employees start this many weeks into the period


def daterange(a: date, b: date):
    d = a
    while d <= b:
        yield d
        d += timedelta(days=1)


def is_workday(d: date, holidays: set[date]) -> bool:
    return d.weekday() < 5 and d not in holidays


def apply_new_hires(b: Builder) -> None:
    """Two employees join partway through, so the under-one-month history tier is exercised."""
    start = b.ds.period[0]
    candidates = [p for p in b.ds.profiles if p.role == "EMPLOYEE" and p.email != "employee@auditx.local"]
    for p, weeks in zip(b.rng.sample(candidates, len(NEW_HIRE_WEEKS)), NEW_HIRE_WEEKS):
        p.start_date = start + timedelta(weeks=weeks)


def active_from(p: Profile, period_start: date) -> date:
    return max(period_start, p.start_date)


def choose_commuters(b: Builder) -> dict[str, int]:
    """Three people park at the same garage every office day, at a fixed price. The last one pays
    an amount high enough that the duplicate field rule has to exclude it on its schedule."""
    pool = [p for p in b.ds.profiles if p.department != "Sales" and p.role == "EMPLOYEE"
            and p.start_date < b.ds.period[0]]
    picks = b.rng.sample(pool, 3)
    return {picks[0].user_id: 450, picks[1].user_id: 450, picks[2].user_id: 1600}


def plan_days(b: Builder) -> None:
    """Where each person is on each work day: the office, remote, or a trip city."""
    ds, rng = b.ds, b.rng
    start, end = ds.period
    b.day_plan = {}
    b.trips = []  # (user_id, first_day, last_day, city)
    for p in ds.profiles:
        first = active_from(p, start)
        for d in daterange(first, end):
            if is_workday(d, ds.holidays):
                b.day_plan[(p.user_id, d)] = "remote" if rng.random() < p.remote_share else "office"
        workdays = [d for d in daterange(first, end - timedelta(days=3)) if d.weekday() < 4 and d not in ds.holidays]
        for _ in range(p.trips):
            if not workdays:
                break
            d0 = rng.choice(workdays)
            length = rng.choice([1, 2, 2])
            days = [d0 + timedelta(days=i) for i in range(length)]
            if any(b.day_plan.get((p.user_id, d)) not in ("office", "remote") for d in days):
                continue
            city = rng.choice(TRAVEL_CITIES)
            for d in days:
                b.day_plan[(p.user_id, d)] = city
            b.trips.append((p.user_id, days[0], days[-1], city))


def _merchant_pool(b: Builder, category: str, city: str | None):
    return [m for m in b.ds.merchants if m.category == category and (city is None or m.city == city or m.city is None)]


def _pick(rng: random.Random, pool):
    total = sum(m.weight for m in pool)
    x = rng.random() * total
    for m in pool:
        x -= m.weight
        if x <= 0:
            return m
    return pool[-1]


def _time_for(rng: random.Random, category: str, dinner_ok: bool) -> str:
    if category == "Client Entertainment":
        return f"{rng.randint(18, 20):02d}:{rng.randint(0, 59):02d}"
    if category == "Transport":
        return f"{rng.randint(7, 19):02d}:{rng.randint(0, 59):02d}"
    r = rng.random()
    if r < 0.72:
        return f"{rng.randint(11, 13):02d}:{rng.randint(0, 59):02d}"
    if r < 0.86:
        return f"{rng.randint(7, 8):02d}:{rng.randint(15, 59):02d}"
    return f"{rng.randint(18, 20):02d}:{rng.randint(0, 59):02d}" if dinner_ok else f"{rng.randint(11, 13):02d}:{rng.randint(0, 59):02d}"


def generate_expenses(b: Builder) -> None:
    ds, rng = b.ds, b.rng
    start, end = ds.period
    commuters = choose_commuters(b)
    b.commuters = commuters
    garage = b.merchant_by_name["Steel City Parking"]

    for p in ds.profiles:
        first = active_from(p, start)
        random_weights = {k: v for k, v in p.category_weights.items() if k not in ("Travel", "Lodging")}

        for d in daterange(first, end):
            plan = b.day_plan.get((p.user_id, d))
            weekday = d.weekday() < 5
            lam = (
                p.monthly_rate * (1 - p.weekend_share) / 21.7
                if plan is not None
                else p.monthly_rate * p.weekend_share / 8.7 if not weekday else 0.0
            )
            for _ in range(poisson(rng, lam)):
                cat = choose(rng, random_weights if plan is not None else {"Meals": 0.8, "Transport": 0.2})
                city = HQ_CITY if plan in (None, "office", "remote") else plan
                timed = cat in TIMED
                pool = _merchant_pool(b, cat, city if timed else None)
                if not pool:
                    continue
                m = _pick(rng, pool)
                cents = b.draw_amount(p, cat)
                b.add_expense(p.user_id, m, cat, cents, d, time_hm=_time_for(rng, cat, plan not in ("office",)) if timed else None)

            if p.user_id in commuters and plan == "office":
                b.add_expense(p.user_id, garage, "Transport", commuters[p.user_id], d, time_hm="08:30", description="Daily parking")

        # Trips: one airfare, and one night in a hotel on two-day trips.
        for uid, d0, d1, city in [t for t in b.trips if t[0] == p.user_id]:
            season = TRAVEL_SEASON.get(d0.month, 1.0)
            air = _pick(rng, _merchant_pool(b, "Travel", None))
            b.add_expense(p.user_id, air, "Travel", int(b.draw_amount(p, "Travel") * season), d0 - timedelta(days=rng.randint(1, 4)))
            if d1 > d0:
                hotel = next(m for m in ds.merchants if m.category == "Lodging" and m.city == city)
                b.add_expense(p.user_id, hotel, "Lodging", b.draw_amount(p, "Lodging"), d1)

        # A monthly software subscription for about a third of employees. Fixed price, fixed day.
        if rng.random() < 0.33:
            sub = _pick(rng, _merchant_pool(b, "Software", None))
            base = rng.choice([1200, 1500, 2500, 4500])
            day_of_month = rng.randint(1, 27)
            for month in range(start.month, end.month + 1):
                d = date(start.year, month, day_of_month)
                if first <= d <= end:
                    hike = 1.10 if sub.name in ("CloudDesk", "DocuSuite") and month >= 7 else 1.0
                    b.add_expense(p.user_id, sub, "Software", int(base * hike), d, description="Monthly subscription")
