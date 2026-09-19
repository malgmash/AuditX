"""Detector 3: suspicious timesheets.

Overlaps, copy-pasted weeks, impossible hours, round hours, holiday hours, and the cross-signal
rule: hours logged at one location while a receipt places the person in another city. That rule
needs expense data and timesheet data in one place, so no timesheet-only or expense-only tool can
find it, and it is the reason both sit in one system.
"""

from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import timedelta

from app.detect.geo import different_cities, normalize_city
from app.detect.rules import RULES
from app.detect.types import (
    DetectionContext,
    DetectorConfig,
    EntryRec,
    ExpenseRec,
    FindingDraft,
    TimesheetRec,
)


def _labour_cents(hours: float, cfg: DetectorConfig) -> int:
    return int(round(hours * cfg.hourly_cost_cents))


def _all_entries(ctx: DetectionContext) -> list[EntryRec]:
    return [e for ts in ctx.timesheets for e in ts.entries]


def _location_conflict(ctx: DetectionContext) -> list[FindingDraft]:
    cfg = ctx.config
    spec = RULES["TS_LOCATION_CONFLICT"]
    timed: dict[str, list[ExpenseRec]] = defaultdict(list)
    for x in ctx.expenses:
        if x.has_time and normalize_city(x.city):
            timed[x.user_id].append(x)

    out = []
    for entry in _all_entries(ctx):
        if entry.start is None or entry.end is None:
            continue
        declared = normalize_city(entry.location)
        # Plain "remote" names no city, so it can never conflict. A city the employee declared
        # honestly matches the receipt and does not fire either.
        if declared is None:
            continue
        clash = [
            x
            for x in timed.get(entry.user_id, [])
            if entry.start <= x.incurred_at <= entry.end and different_cities(entry.location, x.city)
        ]
        if not clash:
            continue
        out.append(
            FindingDraft(
                rule_id=spec.id,
                subject_user_id=entry.user_id,
                confidence=spec.confidence,
                amount_at_risk_cents=_labour_cents(entry.hours, cfg) + sum(x.amount_cents for x in clash),
                evidence={
                    "work_date": entry.work_date.isoformat(),
                    "declared_location": entry.location,
                    "declared_city": declared,
                    "entry_start": entry.start.isoformat(),
                    "entry_end": entry.end.isoformat(),
                    "hours": entry.hours,
                    "receipt_cities": sorted({normalize_city(x.city) or "" for x in clash}),
                    "receipt_times": [x.incurred_at.isoformat() for x in clash],
                    "receipt_amounts_cents": [x.amount_cents for x in clash],
                },
                dedupe_key=f"{spec.id}:{entry.id}",
                detected_at=ctx.now,
                expense_ids=[x.id for x in clash],
                timesheet_ids=[entry.timesheet_id],
                receipt_ids=[x.receipt_id for x in clash if x.receipt_id],
            )
        )
    return out


def _overlap(ctx: DetectionContext) -> list[FindingDraft]:
    cfg = ctx.config
    spec = RULES["TS_OVERLAP"]
    tol = timedelta(minutes=cfg.overlap_tolerance_minutes)
    by_user: dict[str, list[EntryRec]] = defaultdict(list)
    for e in _all_entries(ctx):
        if e.start is not None and e.end is not None:
            by_user[e.user_id].append(e)

    out = []
    for uid, entries in by_user.items():
        entries.sort(key=lambda e: (e.start, e.end, e.id))
        reach: EntryRec | None = None  # the earlier entry that ends latest
        for e in entries:
            if reach is not None and e.start < reach.end - tol:
                overlap_h = (min(reach.end, e.end) - e.start).total_seconds() / 3600
                out.append(
                    FindingDraft(
                        rule_id=spec.id,
                        subject_user_id=uid,
                        confidence=spec.confidence,
                        amount_at_risk_cents=_labour_cents(overlap_h, cfg),
                        evidence={
                            "overlap_hours": round(overlap_h, 2),
                            "entry_a_start": reach.start.isoformat(),
                            "entry_a_end": reach.end.isoformat(),
                            "entry_b_start": e.start.isoformat(),
                            "entry_b_end": e.end.isoformat(),
                            "work_date": e.work_date.isoformat(),
                        },
                        dedupe_key=f"{spec.id}:{reach.id}:{e.id}",
                        detected_at=ctx.now,
                        timesheet_ids=sorted({reach.timesheet_id, e.timesheet_id}),
                    )
                )
            if reach is None or e.end > reach.end:
                reach = e
    return out


def _impossible_hours(ctx: DetectionContext) -> list[FindingDraft]:
    cfg = ctx.config
    spec = RULES["TS_IMPOSSIBLE_HOURS"]
    out = []

    per_day: dict[tuple[str, object], list[EntryRec]] = defaultdict(list)
    for e in _all_entries(ctx):
        per_day[(e.user_id, e.work_date)].append(e)
    for (uid, day), entries in per_day.items():
        total = sum(e.hours for e in entries)
        if total > cfg.max_daily_hours:
            out.append(
                FindingDraft(
                    rule_id=spec.id,
                    subject_user_id=uid,
                    confidence=spec.confidence,
                    amount_at_risk_cents=_labour_cents(total - cfg.max_daily_hours, cfg),
                    evidence={"scope": "day", "date": day.isoformat(), "hours": round(total, 2), "limit_hours": cfg.max_daily_hours},
                    dedupe_key=f"{spec.id}:{uid}:{day.isoformat()}",
                    detected_at=ctx.now,
                    timesheet_ids=sorted({e.timesheet_id for e in entries}),
                )
            )

    for ts in ctx.timesheets:
        total = sum(e.hours for e in ts.entries)
        if total > cfg.max_weekly_hours:
            out.append(
                FindingDraft(
                    rule_id=spec.id,
                    subject_user_id=ts.user_id,
                    confidence=spec.confidence,
                    amount_at_risk_cents=_labour_cents(total - cfg.max_weekly_hours, cfg),
                    evidence={"scope": "week", "week_start": ts.week_start.isoformat(), "hours": round(total, 2), "limit_hours": cfg.max_weekly_hours},
                    dedupe_key=f"{spec.id}:{ts.user_id}:week:{ts.week_start.isoformat()}",
                    detected_at=ctx.now,
                    timesheet_ids=[ts.id],
                )
            )
    return out


def _week_signature(ts: TimesheetRec) -> tuple | None:
    """The week reduced to days, times, project and location. None when it carries too little
    detail, or when every time falls on a quarter hour, since a tidy 9 to 5 schedule repeating is
    ordinary and not evidence of copying. Identical to the minute is the signal."""
    if len(ts.entries) < 3 or any(e.start is None or e.end is None for e in ts.entries):
        return None
    rows = sorted(
        (
            e.work_date.weekday(),
            e.start.strftime("%H:%M"),
            e.end.strftime("%H:%M"),
            e.project or "",
            e.location or "",
        )
        for e in ts.entries
    )
    if all(int(r[1][3:]) % 15 == 0 and int(r[2][3:]) % 15 == 0 for r in rows):
        return None
    return tuple(rows)


def _copy_paste(ctx: DetectionContext) -> list[FindingDraft]:
    cfg = ctx.config
    spec = RULES["TS_COPY_PASTE"]
    by_user: dict[str, list[TimesheetRec]] = defaultdict(list)
    for ts in ctx.timesheets:
        by_user[ts.user_id].append(ts)

    out = []
    for uid, sheets in by_user.items():
        groups: dict[tuple, list[TimesheetRec]] = defaultdict(list)
        for ts in sorted(sheets, key=lambda t: t.week_start):
            sig = _week_signature(ts)
            if sig is not None:
                groups[sig].append(ts)
        for sig, group in groups.items():
            if len(group) >= 1 + cfg.copy_paste_min_matches:
                digest = hashlib.sha256(repr(sig).encode()).hexdigest()[:12]
                hours = sum(e.hours for e in group[-1].entries)
                out.append(
                    FindingDraft(
                        rule_id=spec.id,
                        subject_user_id=uid,
                        confidence=spec.confidence,
                        amount_at_risk_cents=_labour_cents(hours * (len(group) - 1), cfg),
                        evidence={
                            "identical_weeks": len(group),
                            "week_starts": [t.week_start.isoformat() for t in group],
                            "entries_per_week": len(sig),
                            "hours_per_week": round(hours, 2),
                        },
                        dedupe_key=f"{spec.id}:{uid}:{digest}",
                        detected_at=ctx.now,
                        timesheet_ids=[t.id for t in group],
                    )
                )
    return out


def _round_hours(ctx: DetectionContext) -> list[FindingDraft]:
    cfg = ctx.config
    spec = RULES["TS_ROUND_HOURS"]
    by_user: dict[str, list[TimesheetRec]] = defaultdict(list)
    for ts in ctx.timesheets:
        by_user[ts.user_id].append(ts)

    def all_eight(ts: TimesheetRec) -> bool:
        return len(ts.entries) >= 3 and all(abs(e.hours - 8.0) < 1e-9 for e in ts.entries)

    out = []
    for uid, sheets in by_user.items():
        sheets.sort(key=lambda t: t.week_start)
        run: list[TimesheetRec] = []
        runs: list[list[TimesheetRec]] = []
        for ts in sheets:
            if all_eight(ts) and (not run or (ts.week_start - run[-1].week_start).days == 7):
                run.append(ts)
                continue
            if run:
                runs.append(run)
            run = [ts] if all_eight(ts) else []
        if run:
            runs.append(run)
        for r in runs:
            if len(r) >= cfg.round_hours_min_weeks:
                hours = sum(e.hours for t in r for e in t.entries)
                out.append(
                    FindingDraft(
                        rule_id=spec.id,
                        subject_user_id=uid,
                        confidence=spec.confidence,
                        amount_at_risk_cents=0,  # rounding suggests imprecision, not an identifiable loss
                        evidence={
                            "consecutive_weeks": len(r),
                            "first_week": r[0].week_start.isoformat(),
                            "last_week": r[-1].week_start.isoformat(),
                            "total_hours": round(hours, 2),
                        },
                        dedupe_key=f"{spec.id}:{uid}:{r[0].week_start.isoformat()}",
                        detected_at=ctx.now,
                        timesheet_ids=[t.id for t in r],
                    )
                )
    return out


def _holiday(ctx: DetectionContext) -> list[FindingDraft]:
    cfg = ctx.config
    spec = RULES["TS_HOLIDAY"]
    out = []
    for e in _all_entries(ctx):
        if e.work_date in ctx.holidays and e.hours > 0:
            note = (e.note or "").lower()
            if "approv" in note:
                continue
            out.append(
                FindingDraft(
                    rule_id=spec.id,
                    subject_user_id=e.user_id,
                    confidence=spec.confidence,
                    amount_at_risk_cents=_labour_cents(e.hours, cfg),
                    evidence={"work_date": e.work_date.isoformat(), "hours": e.hours, "approval_noted": False},
                    dedupe_key=f"{spec.id}:{e.id}",
                    detected_at=ctx.now,
                    timesheet_ids=[e.timesheet_id],
                )
            )
    return out


def detect(ctx: DetectionContext) -> list[FindingDraft]:
    return [
        *_location_conflict(ctx),
        *_overlap(ctx),
        *_impossible_hours(ctx),
        *_copy_paste(ctx),
        *_round_hours(ctx),
        *_holiday(ctx),
    ]
