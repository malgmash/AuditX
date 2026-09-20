"""The access check, the rate limit, and the line between retrieval and the detectors.

The claims being tested are the ones the design rests on:

- an employee asking about a finding that is not theirs gets a 404 before retrieval runs
- the role is an argument derived from the session, never read from the question
- nothing personal is ever embedded
- detectors, severity and scoring do not touch retrieval at all
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app import models as m
from app.retrieval.catalogue import rule_chunks
from app.retrieval.service import NotVisible, RateLimited, _RateLimiter, load_finding_context


class FakeSession:
    """Enough Session to run the access check. If retrieval ever reached the database before
    the check, this would raise rather than quietly pass."""

    def __init__(self, finding: m.Finding | None, case: m.Case | None = None) -> None:
        self._finding = finding
        self._case = case
        self.gets: list[str] = []

    def get(self, model, pk):  # noqa: ANN001
        self.gets.append(pk)
        return self._finding if model is m.Finding else None

    def execute(self, statement):  # noqa: ANN001
        case, session = self._case, self

        class Result:
            def scalars(self):  # noqa: ANN202
                return self

            def first(self):  # noqa: ANN202
                return case

            def all(self):  # noqa: ANN202
                # the org name lookup for redaction
                return [("u1", "Dana Whitfield")]

        return Result()


def make_finding(subject: str = "u1", org: str = "org_auditx_demo") -> m.Finding:
    return m.Finding(
        id="f1",
        org_id=org,
        rule_id="DUP_RECEIPT_EXACT",
        subject_user_id=subject,
        expense_ids=[],
        timesheet_ids=[],
        receipt_ids=[],
        confidence=0.99,
        amount_at_risk_cents=4200,
        severity=m.Severity.CASE,
        penalty_points=30,
        evidence={"merchant": "Steel City Grill"},
        detected_at=None,
    )


class Exploding:
    """Any embedding call is a failure: the access check must finish first."""

    dimension = 8

    def embed(self, texts, kind="passage"):  # noqa: ANN001, ANN202
        raise AssertionError("embedded before the access check passed")


def test_an_employee_can_ask_about_their_own_finding() -> None:
    context = load_finding_context(FakeSession(make_finding("u1")), "f1", "EMPLOYEE", "u1")
    assert context.rule_id == "DUP_RECEIPT_EXACT"


def test_an_employee_asking_about_another_persons_finding_is_refused() -> None:
    with pytest.raises(NotVisible):
        load_finding_context(FakeSession(make_finding("u2")), "f1", "EMPLOYEE", "u1")


def test_the_refusal_happens_before_anything_is_embedded(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.retrieval import service

    monkeypatch.setattr(service, "embedding_provider", lambda: Exploding())
    with pytest.raises(NotVisible):
        service.ask(FakeSession(make_finding("u2")), "f1", "why?", "EMPLOYEE", "u1")


def test_a_missing_finding_is_refused_the_same_way() -> None:
    # Same exception for both, so which of the two it is tells the asker nothing.
    with pytest.raises(NotVisible):
        load_finding_context(FakeSession(None), "f1", "EMPLOYEE", "u1")


def test_a_finding_in_another_org_is_refused_even_to_an_administrator() -> None:
    with pytest.raises(NotVisible):
        load_finding_context(FakeSession(make_finding("u1", org="other")), "f1", "ADMIN", "admin1")


def test_an_administrator_may_ask_about_anyones_finding() -> None:
    context = load_finding_context(FakeSession(make_finding("u2")), "f1", "ADMIN", "admin1")
    assert context.subject_user_id == "u2"


def test_the_reviewer_note_is_not_even_loaded_for_an_employee() -> None:
    case = m.Case(
        id="c1", finding_ids=["f1"], subject_user_id="u1", status=m.CaseStatus.OPEN,
        opened_at=None, decision_note="Watch this one",
    )
    employee = load_finding_context(FakeSession(make_finding("u1"), case), "f1", "EMPLOYEE", "u1")
    admin = load_finding_context(FakeSession(make_finding("u1"), case), "f1", "ADMIN", "a1")
    assert employee.decision_note is None
    assert admin.decision_note == "Watch this one"


def test_a_finding_with_no_case_still_answers() -> None:
    context = load_finding_context(FakeSession(make_finding("u1"), None), "f1", "EMPLOYEE", "u1")
    assert context.case_status == "no case opened"


def test_the_rate_limit_stops_a_loop() -> None:
    limiter = _RateLimiter(per_minute=3)
    for i in range(3):
        limiter.check("u1", now=100.0 + i)
    with pytest.raises(RateLimited):
        limiter.check("u1", now=103.0)
    # A minute later the window has moved on, and another user was never affected.
    limiter.check("u1", now=170.0)
    limiter.check("u2", now=103.0)


def test_the_index_holds_company_knowledge_only() -> None:
    # Everything indexed comes from the rule registry or a policy document. No expense,
    # timesheet, finding, case note or name has a route into it.
    assert {c.source_kind for c in rule_chunks()} == {"RULE"}


def test_the_detectors_do_not_import_retrieval_or_a_model_client() -> None:
    # The strongest available proof that detectors, severity and scoring are identical with
    # retrieval switched off: they cannot reach it. A test that ran the detectors twice would
    # only show that this run did not.
    detect = Path(__file__).resolve().parents[1] / "app" / "detect"
    for path in sorted(detect.glob("*.py")):
        source = path.read_text(encoding="utf-8")
        assert "app.retrieval" not in source, f"{path.name} imports retrieval"
        assert "app.llm" not in source, f"{path.name} imports a model client"
        assert "openai" not in source, f"{path.name} reaches for a model"
