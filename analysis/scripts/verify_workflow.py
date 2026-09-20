"""Run the whole workflow against the real database inside one transaction, print what it did,
and roll everything back. Nothing is kept. Use it to check the engine on the loaded data.

    PYTHONPATH=. python scripts/verify_workflow.py
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import any_, func, select

from app import models as m
from app import workflow as w
from app.config import settings
from app.db import SessionLocal

now = datetime.now(timezone.utc)
session = SessionLocal()
try:
    org = settings.org_id
    print("before:", {t.__name__: session.scalar(select(func.count()).select_from(t)) for t in (m.Case, m.Hold, m.Score, m.ScoreEvent)})
    first = w.run_all(session, org, now, notify=False)
    print("run 1: ", first)
    second = w.run_all(session, org, now, notify=False)
    print("run 2: ", second, "(cases_opened, holds_placed and score_events_written should all be 0)")
    print("after: ", {t.__name__: session.scalar(select(func.count()).select_from(t)) for t in (m.Case, m.Hold, m.Score, m.ScoreEvent)})

    held = Counter(e.status.value for e in session.scalars(select(m.Expense).where(m.Expense.status != m.ExpenseStatus.SUBMITTED)))
    print("expense statuses changed:", dict(held))
    no_case = session.scalar(
        select(func.count()).select_from(m.Hold).where(~m.Hold.finding_id.in_(select(func.unnest(m.Case.finding_ids))))
    )
    print("holds without a case:", no_case)

    scores = {
        s.scope_key: s.value
        for s in session.scalars(select(m.Score).where(m.Score.scope_type == "user").order_by(m.Score.as_of))
    }
    worst = sorted(scores.items(), key=lambda kv: kv[1])[:5]
    print("lowest scores:", [(k, round(v, 1)) for k, v in worst], "| range:", round(min(scores.values()), 1), "to", round(max(scores.values()), 1))

    # events sum to the score
    bad = 0
    for uid, value in scores.items():
        total = session.scalar(select(func.coalesce(func.sum(m.ScoreEvent.delta), 0.0)).where(m.ScoreEvent.scope_key == uid))
        if abs(100.0 + total - value) > 0.06:
            bad += 1
    print("employees whose events do not sum to their score:", bad)

    # decide and reverse on a real hold
    hold = session.scalars(select(m.Hold).where(m.Hold.released_at.is_(None))).first()
    if hold:
        case = session.scalars(select(m.Case).where(hold.finding_id == any_(m.Case.finding_ids))).first()
        admin = w._admins(session, org)[0]
        r = w.reverse_hold(session, org, hold.id, admin.id, "verification", now)
        print("reverse_hold:", r)
        print("audit rows:", session.scalar(select(func.count()).select_from(m.AuditLog)), "| notifications:", session.scalar(select(func.count()).select_from(m.Notification)))
        try:
            w.reverse_hold(session, org, hold.id, admin.id, None, now)
        except w.WorkflowError as e:
            print("second reversal refused:", e)
    case = session.scalars(select(m.Case).where(m.Case.status == m.CaseStatus.OPEN)).first()
    if case:
        r = w.decide_case(session, org, case.id, "ACCEPT", admin.id, "verification", now)
        print("decide_case ACCEPT:", r)
finally:
    session.rollback()
    session.close()
    print("rolled back: nothing was kept")
