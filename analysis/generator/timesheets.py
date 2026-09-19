"""Honest weekly timesheets, one per employee per week.

Times are recorded to the minute and vary from day to day, hours dip around holidays, and the
declared location follows the same day plan the expense generator used, so a receipt from a trip
city sits inside a timesheet entry declared in that city.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from generator.builder import Builder
from generator.expenses import active_from, daterange

UTC = timezone.utc


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def location_label(plan: str) -> str:
    return {"office": "Pittsburgh office", "remote": "remote"}.get(plan, plan)


def generate_timesheets(b: Builder) -> None:
    ds, rng = b.ds, b.rng
    start, end = ds.period
    for p in ds.profiles:
        first = active_from(p, start)
        monday = monday_of(first)
        while monday <= end:
            entries = []
            for i in range(5):
                day = monday + timedelta(days=i)
                plan = b.day_plan.get((p.user_id, day))
                if plan is None or day < first or day > end or rng.random() < 0.02:  # holidays, PTO
                    continue
                midnight = datetime(day.year, day.month, day.day, tzinfo=UTC)
                begin = midnight + timedelta(minutes=int(p.start_minute + rng.gauss(0, 20)))
                loc = location_label(plan)
                if rng.random() < 0.65:
                    hours = min(10.5, max(6.0, rng.gauss(8.1, 0.6)))
                    finish = begin + timedelta(minutes=int(hours * 60 + rng.randint(-7, 7)))
                    entries.append(b.make_entry(p.user_id, day, begin, finish, rng.choice(p.project_names), loc))
                else:
                    morning_end = begin + timedelta(minutes=int(180 + rng.randint(-20, 25)))
                    resume = morning_end + timedelta(minutes=rng.randint(37, 62))
                    finish = resume + timedelta(minutes=int(250 + rng.randint(-35, 40)))
                    entries.append(b.make_entry(p.user_id, day, begin, morning_end, rng.choice(p.project_names), loc))
                    entries.append(b.make_entry(p.user_id, day, resume, finish, rng.choice(p.project_names), loc))
            if entries:
                sunday = monday + timedelta(days=6)
                submitted = datetime(sunday.year, sunday.month, sunday.day, 20, 0, tzinfo=UTC) + timedelta(
                    hours=rng.randint(0, 60)
                )
                b.add_timesheet(p.user_id, monday, entries, submitted)
            monday += timedelta(days=7)
