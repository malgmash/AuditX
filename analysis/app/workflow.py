"""Cases, holds, scores and decisions: the part of the service that writes.

The detectors are pure and only produce findings. This module turns stored findings into work for
an administrator and keeps every score explainable:

    finding  ->  Case (severity CASE or IMMEDIATE_HOLD), Hold (IMMEDIATE_HOLD only)
    cases    ->  penalties  ->  ScoreEvent rows (append only)  ->  Score snapshots
    decide / reverse  ->  new rows, never edits: AuditLog, ScoreEvent, Notification

A hold pauses a reimbursement. Nothing here touches payroll, and a score never triggers anything.
Every function is idempotent: run twice, the second run writes nothing.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Literal

from sqlalchemy import any_, delete, select
from sqlalchemy.orm import Session

from app import models as m
from app import scoring
from app.detect.rules import RULES

UTC = timezone.utc

CAP_REASON = "Pending reviews take at most 15 points off in total"
VOL_REASON = "A score falls by at most 15 points in a month"

_STATUS = {
    m.CaseStatus.OPEN: "PENDING",
    m.CaseStatus.ESCALATED: "PENDING",
    m.CaseStatus.ACCEPTED: "CONFIRMED",
    m.CaseStatus.DECLINED: "DISMISSED",
}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _money(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def _description(rule_id: str) -> str:
    spec = RULES.get(rule_id)
    return spec.description if spec else "Something on this record needs a closer look."


def _admins(session: Session, org_id: str) -> list[m.User]:
    return list(session.scalars(select(m.User).where(m.User.org_id == org_id, m.User.role == m.Role.ADMIN)))


def _notify(session: Session, user_id: str, kind: str, title: str, body: str, link: str, now: datetime) -> None:
    session.add(m.Notification(user_id=user_id, kind=kind, title=title, body=body, link_path=link, created_at=now))


# ---------------------------------------------------------------------------------------------
# findings -> cases and holds


def hold_target(subject_user_id: str, expense_ids: list[str], expenses: dict[str, m.Expense]) -> m.Expense | None:
    """The expense a hold pauses: the subject's own, latest submitted. A finding that names no
    expense of the subject has nothing to pause, so it opens a case and no hold."""
    own = [expenses[i] for i in expense_ids if i in expenses and expenses[i].user_id == subject_user_id]
    if not own:
        return None
    return max(own, key=lambda e: (_aware(e.submitted_at), e.id))


def process_findings(session: Session, org_id: str, now: datetime | None = None, notify: bool = False) -> dict[str, int]:
    """Open a case for every finding at CASE or above that has none, and a hold for each immediate
    hold. `notify` tells the administrators. A backfill leaves it off so the bell is not flooded."""
    now = now or datetime.now(UTC)
    findings = list(
        session.scalars(
            select(m.Finding).where(m.Finding.severity != m.Severity.NOTE).order_by(m.Finding.detected_at, m.Finding.id)
        )
    )
    with_case = {fid for c in session.scalars(select(m.Case)) for fid in c.finding_ids}
    with_hold = {h.finding_id for h in session.scalars(select(m.Hold))}
    todo = [f for f in findings if f.id not in with_case or (f.severity == m.Severity.IMMEDIATE_HOLD and f.id not in with_hold)]
    if not todo:
        return {"cases_opened": 0, "holds_placed": 0, "notified": 0}

    ids = {i for f in todo for i in f.expense_ids}
    expenses = {e.id: e for e in session.scalars(select(m.Expense).where(m.Expense.id.in_(ids)))} if ids else {}
    admins = _admins(session, org_id) if notify else []

    cases = holds = notified = 0
    for f in todo:
        case_id: str | None = None
        if f.id not in with_case:
            case = m.Case(
                finding_ids=[f.id], subject_user_id=f.subject_user_id, status=m.CaseStatus.OPEN,
                opened_at=_aware(f.detected_at),
            )
            session.add(case)
            session.flush()
            case_id = case.id
            cases += 1

        held: m.Expense | None = None
        if f.severity == m.Severity.IMMEDIATE_HOLD and f.id not in with_hold:
            held = hold_target(f.subject_user_id, list(f.expense_ids), expenses)
            if held is not None:
                session.add(m.Hold(expense_id=held.id, finding_id=f.id, placed_at=_aware(f.detected_at)))
                if held.status == m.ExpenseStatus.SUBMITTED:
                    held.status = m.ExpenseStatus.HELD
                holds += 1

        if case_id and notify:
            what = f"{held.merchant_raw}, {_money(held.amount_cents)}" if held else f"{_money(f.amount_at_risk_cents)} at risk"
            for admin in admins:
                _notify(
                    session, admin.id,
                    "IMMEDIATE_HOLD" if held else "NEW_CASE",
                    "Reimbursement held" if held else "New case to review",
                    f"{what}. {_description(f.rule_id)}",
                    "/admin/cases", now,
                )
                notified += 1
    session.flush()
    return {"cases_opened": cases, "holds_placed": holds, "notified": notified}


# ---------------------------------------------------------------------------------------------
# scoring


def _occurred_at(f: m.Finding, expenses: dict[str, m.Expense], sheets: dict[str, m.Timesheet], now: datetime) -> datetime:
    dates = [_aware(expenses[i].incurred_at) for i in f.expense_ids if i in expenses and expenses[i].user_id == f.subject_user_id]
    if not dates:
        dates = [_aware(sheets[i].week_start) for i in f.timesheet_ids if i in sheets]
    at = max(dates) if dates else _aware(f.detected_at)
    return min(at, now)


def _event_key(e: m.ScoreEvent) -> str:
    if e.finding_id:
        return e.finding_id
    return scoring.VOL_KEY if e.reason == VOL_REASON else scoring.CAP_KEY


def rescore(session: Session, org_id: str, now: datetime | None = None) -> dict[str, int]:
    """Recompute every score from the findings and their cases. Writes only the ScoreEvent rows
    still needed, then replaces the Score snapshots, which are derived."""
    now = now or datetime.now(UTC)
    users = list(session.scalars(select(m.User).where(m.User.org_id == org_id)))
    findings = list(session.scalars(select(m.Finding).where(m.Finding.penalty_points > 0)))
    case_of: dict[str, m.Case] = {}
    for c in session.scalars(select(m.Case)):
        for fid in c.finding_ids:
            case_of[fid] = c
    ids = {i for f in findings for i in f.expense_ids}
    sheet_ids = {i for f in findings for i in f.timesheet_ids}
    expenses = {e.id: e for e in session.scalars(select(m.Expense).where(m.Expense.id.in_(ids)))} if ids else {}
    sheets = {t.id: t for t in session.scalars(select(m.Timesheet).where(m.Timesheet.id.in_(sheet_ids)))} if sheet_ids else {}

    penalties: dict[str, list[scoring.Penalty]] = defaultdict(list)
    finding_by_id = {f.id: f for f in findings}
    for f in findings:
        case = case_of.get(f.id)
        if case is None:
            continue  # a note: it carries no points
        penalties[f.subject_user_id].append(
            scoring.Penalty(
                finding_id=f.id, user_id=f.subject_user_id, points=f.penalty_points,
                occurred_at=_occurred_at(f, expenses, sheets, now), opened_at=_aware(case.opened_at),
                status=_STATUS[case.status],  # type: ignore[arg-type]
            )
        )

    balances: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for e in session.scalars(select(m.ScoreEvent).where(m.ScoreEvent.scope_type == "user")):
        balances[e.scope_key][_event_key(e)] += e.delta

    snaps: dict[str, scoring.Snapshot] = {}
    written = 0
    for u in users:
        snap = scoring.snapshot(penalties.get(u.id, []), now)
        snaps[u.id] = snap
        status_of = {p.finding_id: p.status for p in penalties.get(u.id, [])}
        for key, delta in scoring.plan_events(dict(balances[u.id]), snap):
            first = key not in balances[u.id]
            if key == scoring.CAP_KEY:
                reason, at = CAP_REASON, now
            elif key == scoring.VOL_KEY:
                reason, at = VOL_REASON, now
            else:
                f = finding_by_id[key]
                p = next(p for p in penalties[u.id] if p.finding_id == key)
                if first:
                    reason, at = f"Flagged: {_description(f.rule_id)}", min(p.occurred_at, now)
                elif status_of[key] == "DISMISSED":
                    reason, at = "Reviewed and no action taken: the penalty was removed", now
                elif status_of[key] == "CONFIRMED":
                    reason, at = "A reviewer confirmed this, so the full penalty applies", now
                else:
                    reason, at = "Penalty adjusted for the age of the flag", now
            session.add(
                m.ScoreEvent(
                    scope_type="user", scope_key=u.id, finding_id=None if key in (scoring.CAP_KEY, scoring.VOL_KEY) else key,
                    delta=delta, reason=reason, created_at=at,
                )
            )
            balances[u.id][key] += delta
            written += 1

    _write_snapshots(session, users, snaps, penalties, now)
    session.flush()
    return {"score_events_written": written, "employees_scored": len(users)}


def _write_snapshots(
    session: Session,
    users: list[m.User],
    snaps: dict[str, scoring.Snapshot],
    penalties: dict[str, list[scoring.Penalty]],
    now: datetime,
) -> None:
    session.execute(delete(m.Score).where(m.Score.scope_type.in_(("user", "department", "category"))))
    open_amount: dict[str, int] = defaultdict(int)
    cases = {c.id: c for c in session.scalars(select(m.Case).where(m.Case.status.in_((m.CaseStatus.OPEN, m.CaseStatus.ESCALATED))))}
    finding_amount = {
        f.id: f.amount_at_risk_cents
        for f in session.scalars(select(m.Finding).where(m.Finding.subject_user_id.in_([u.id for u in users])))
    }
    for c in cases.values():
        open_amount[c.subject_user_id] += sum(finding_amount.get(fid, 0) for fid in c.finding_ids)

    by_dept: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for u in users:
        snap = snaps[u.id]
        for i, (end, value) in enumerate(snap.history):
            last = i == len(snap.history) - 1
            session.add(
                m.Score(scope_type="user", scope_key=u.id, as_of=end, value=value, amount_at_risk_cents=open_amount[u.id] if last else 0)
            )
        by_dept[u.department].append((u.id, snap.value))
    for dept, members in by_dept.items():
        session.add(
            m.Score(scope_type="department", scope_key=dept, as_of=now, value=scoring.department_score([v for _, v in members]),
                    amount_at_risk_cents=sum(open_amount[uid] for uid, _ in members))
        )

    claimed: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    user_ids = {u.id for u in users}
    for user_id, category, cents in session.execute(
        select(m.Expense.user_id, m.Expense.category_id, m.Expense.amount_cents)
    ):
        if user_id in user_ids:
            claimed[category][user_id] += cents
    values = {u.id: snaps[u.id].value for u in users}
    for category, per_user in claimed.items():
        session.add(
            m.Score(scope_type="category", scope_key=category, as_of=now,
                    value=scoring.category_score({u: values[u] for u in per_user}, per_user), amount_at_risk_cents=0)
        )


def current_score(session: Session, user_id: str) -> float:
    row = session.scalars(
        select(m.Score).where(m.Score.scope_type == "user", m.Score.scope_key == user_id).order_by(m.Score.as_of.desc())
    ).first()
    return row.value if row else 100.0


# ---------------------------------------------------------------------------------------------
# decisions and reversals


Decision = Literal["ACCEPT", "DECLINE"]


class WorkflowError(ValueError):
    """A request the workflow refuses, with a message safe to show."""


def _release_holds(session: Session, finding_ids: list[str], admin_id: str, note: str | None, now: datetime) -> list[m.Hold]:
    released: list[m.Hold] = []
    for h in session.scalars(select(m.Hold).where(m.Hold.finding_id.in_(finding_ids), m.Hold.released_at.is_(None))):
        h.released_at, h.released_by_id, h.reverse_note = now, admin_id, note
        expense = session.get(m.Expense, h.expense_id)
        if expense is not None and expense.status == m.ExpenseStatus.HELD:
            expense.status = m.ExpenseStatus.SUBMITTED
        released.append(h)
    return released


def _audit(
    session: Session, admin_id: str, action: str, target_type: str, target_id: str,
    before: Any, after: Any, subject_user_id: str, now: datetime,
) -> None:
    session.add(
        m.AuditLog(
            actor_id=admin_id, action=action, target_type=target_type, target_id=target_id,
            before=before, after=after, is_self_review=admin_id == subject_user_id, created_at=now,
        )
    )


def _merchant_of(session: Session, finding_ids: list[str], subject: str) -> str:
    for f in session.scalars(select(m.Finding).where(m.Finding.id.in_(finding_ids))):
        for eid in f.expense_ids:
            e = session.get(m.Expense, eid)
            if e is not None and e.user_id == subject:
                return e.merchant_raw
    return "your claim"


def decide_case(
    session: Session, org_id: str, case_id: str, decision: Decision, admin_id: str, note: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Accept keeps the hold and confirms the penalty. Decline releases the hold, removes the
    penalty and keeps the finding as a label. Both write an AuditLog row and tell the employee."""
    now = now or datetime.now(UTC)
    case = session.get(m.Case, case_id)
    if case is None:
        raise WorkflowError("That case does not exist")
    if case.status not in (m.CaseStatus.OPEN, m.CaseStatus.ESCALATED):
        raise WorkflowError("That case has already been decided")
    if decision not in ("ACCEPT", "DECLINE"):
        raise WorkflowError("Decision must be ACCEPT or DECLINE")

    before_score = current_score(session, case.subject_user_id)
    before = {"status": case.status.value}
    case.status = m.CaseStatus.ACCEPTED if decision == "ACCEPT" else m.CaseStatus.DECLINED
    case.closed_at = now
    case.decision_note = note
    released = _release_holds(session, list(case.finding_ids), admin_id, note, now) if decision == "DECLINE" else []

    _audit(
        session, admin_id, "CASE_ACCEPTED" if decision == "ACCEPT" else "CASE_DECLINED", "Case", case.id,
        before, {"status": case.status.value, "note": note, "holds_released": [h.id for h in released]},
        case.subject_user_id, now,
    )
    merchant = _merchant_of(session, list(case.finding_ids), case.subject_user_id)
    if decision == "ACCEPT":
        _notify(session, case.subject_user_id, "CASE_DECIDED", "A review is complete",
                f"A reviewer looked at your claim at {merchant} and confirmed the flag. Your reimbursement stays paused.",
                "/employee/record", now)
    else:
        _notify(session, case.subject_user_id, "CASE_DECIDED", "Reviewed, no action taken",
                f"A reviewer looked at your claim at {merchant} and took no action. Nothing is paused.",
                "/employee/record", now)
    session.flush()
    rescore(session, org_id, now)
    return {
        "case_id": case.id, "status": case.status.value, "holds_released": len(released),
        "subject_user_id": case.subject_user_id, "is_self_review": admin_id == case.subject_user_id,
        "score_before": before_score, "score_after": current_score(session, case.subject_user_id),
    }


def reverse_hold(
    session: Session, org_id: str, hold_id: str, admin_id: str, note: str | None = None, now: datetime | None = None
) -> dict[str, Any]:
    """Release a hold. Writes Hold.releasedAt, restores the points with a new ScoreEvent, writes an
    AuditLog row and tells the employee. The case it belongs to closes as declined."""
    now = now or datetime.now(UTC)
    hold = session.get(m.Hold, hold_id)
    if hold is None:
        raise WorkflowError("That hold does not exist")
    if hold.released_at is not None:
        raise WorkflowError("That hold has already been released")
    expense = session.get(m.Expense, hold.expense_id)
    subject = expense.user_id if expense else ""
    before_score = current_score(session, subject)

    hold.released_at, hold.released_by_id, hold.reverse_note = now, admin_id, note
    if expense is not None and expense.status == m.ExpenseStatus.HELD:
        expense.status = m.ExpenseStatus.SUBMITTED
    closed = []
    for c in session.scalars(select(m.Case).where(hold.finding_id == any_(m.Case.finding_ids))):
        if c.status in (m.CaseStatus.OPEN, m.CaseStatus.ESCALATED):
            c.status, c.closed_at, c.decision_note = m.CaseStatus.DECLINED, now, note or "Hold reversed"
            closed.append(c.id)
    _audit(session, admin_id, "HOLD_REVERSED", "Hold", hold.id, {"releasedAt": None},
           {"releasedAt": now.isoformat(), "note": note, "cases_closed": closed}, subject, now)
    _notify(session, subject, "HOLD_REVERSED", "Reimbursement released",
            f"The pause on your claim at {expense.merchant_raw if expense else 'a merchant'} was lifted.", "/employee/record", now)
    session.flush()
    rescore(session, org_id, now)
    return {
        "hold_id": hold.id, "cases_closed": closed, "subject_user_id": subject,
        "is_self_review": admin_id == subject, "score_before": before_score, "score_after": current_score(session, subject),
    }


def run_all(session: Session, org_id: str, now: datetime | None = None, notify: bool = False) -> dict[str, int]:
    """Cases and holds for new findings, then scores. One call after a submission."""
    now = now or datetime.now(UTC)
    out = process_findings(session, org_id, now, notify)
    out.update(rescore(session, org_id, now))
    return out
