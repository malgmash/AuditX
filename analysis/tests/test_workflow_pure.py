from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from app import models as m
from app import workflow as w

UTC = timezone.utc


def exp(eid: str, user: str, submitted_day: int, status=m.ExpenseStatus.SUBMITTED):
    return SimpleNamespace(id=eid, user_id=user, submitted_at=datetime(2026, 3, submitted_day, tzinfo=UTC), status=status)


def test_a_hold_pauses_the_subjects_latest_submitted_expense() -> None:
    expenses = {"a": exp("a", "u1", 2), "b": exp("b", "u1", 9), "c": exp("c", "u2", 20)}
    target = w.hold_target("u1", ["a", "b", "c"], expenses)  # type: ignore[arg-type]
    assert target is not None and target.id == "b"


def test_a_cross_user_finding_pauses_only_the_subjects_own_expense() -> None:
    expenses = {"theirs": exp("theirs", "u2", 1), "mine": exp("mine", "u1", 5)}
    target = w.hold_target("u1", ["theirs", "mine"], expenses)  # type: ignore[arg-type]
    assert target is not None and target.id == "mine"


def test_a_finding_that_names_none_of_the_subjects_expenses_has_nothing_to_hold() -> None:
    expenses = {"theirs": exp("theirs", "u2", 1)}
    assert w.hold_target("u1", ["theirs"], expenses) is None  # type: ignore[arg-type]
    assert w.hold_target("u1", [], expenses) is None  # type: ignore[arg-type]


def test_case_statuses_map_onto_score_statuses() -> None:
    assert w._STATUS[m.CaseStatus.OPEN] == "PENDING"
    assert w._STATUS[m.CaseStatus.ESCALATED] == "PENDING"
    assert w._STATUS[m.CaseStatus.ACCEPTED] == "CONFIRMED"
    assert w._STATUS[m.CaseStatus.DECLINED] == "DISMISSED"


def test_the_employee_wording_never_accuses() -> None:
    import inspect
    import re

    banned = re.compile(r"\b(fraud\w*|theft|steal\w*|dishonest\w*|guilty)\b", re.IGNORECASE)
    assert not banned.search(inspect.getsource(w))
    from app.detect.rules import RULES

    for spec in RULES.values():
        assert not banned.search(spec.description)
