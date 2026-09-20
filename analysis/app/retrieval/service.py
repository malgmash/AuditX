"""Where the query path meets the database, the providers and the clock.

The access check runs first and it runs here, before anything is embedded and before any
passage is fetched. An employee asking about a finding that is not theirs gets `NotVisible`,
which the route turns into a 404 — not a 403, because the existence of another person's finding
is itself something they should not learn.

The asker's role and id are arguments because the caller derives them from the session. They
are never read out of the question.
"""

from __future__ import annotations

import time
from collections import OrderedDict, deque
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.config import settings
from app.llm import answer_provider, embedding_provider
from app.redact import redact
from app.retrieval import ask as ask_module
from app.retrieval import index
from app.retrieval.catalogue import rule_chunks
from app.retrieval.chunking import chunk_document
from app.retrieval.types import AskerRole, AskResult, FindingContext

NO_CASE = "no case opened"


class NotVisible(Exception):
    """The finding does not exist, or it is not this asker's to see. One exception for both,
    deliberately: telling them apart tells the asker something."""


class RateLimited(Exception):
    pass


class _RateLimiter:
    """A question per user per minute, counted in process. Good enough for one service, and
    the point is to stop a loop, not a determined attacker."""

    def __init__(self, per_minute: int) -> None:
        self._per_minute = per_minute
        self._seen: dict[str, deque[float]] = {}

    def check(self, user_id: str, now: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        window = self._seen.setdefault(user_id, deque())
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self._per_minute:
            raise RateLimited(f"more than {self._per_minute} questions in a minute")
        window.append(now)


_limiter = _RateLimiter(settings.ask_rate_limit_per_minute)
_answers: OrderedDict[str, AskResult] = OrderedDict()


def _org_names(session: Session, org_id: str) -> dict[str, str]:
    """Every name in the org, for redaction. Loaded whole rather than per finding so a name
    that appears in evidence by an unexpected route is still replaced."""
    rows = session.execute(
        select(m.User.id, m.User.name).where(m.User.org_id == org_id)
    ).all()
    return {user_id: name for user_id, name in rows}


def load_finding_context(
    session: Session,
    finding_id: str,
    asker_role: AskerRole,
    asker_user_id: str,
    org_id: str | None = None,
) -> FindingContext:
    """Fetch the finding by id, under the same access check as every other read.

    Raises NotVisible before any embedding or search happens. Personal data reaches a prompt
    only through this function, and only for a finding the asker is allowed to see.
    """
    org_id = org_id or settings.org_id
    finding = session.get(m.Finding, finding_id)
    if finding is None or finding.org_id != org_id:
        raise NotVisible(finding_id)
    if asker_role != "ADMIN" and finding.subject_user_id != asker_user_id:
        raise NotVisible(finding_id)

    case = session.execute(
        select(m.Case).where(m.Case.finding_ids.any(finding_id))
    ).scalars().first()

    return FindingContext(
        finding_id=finding.id,
        rule_id=finding.rule_id,
        subject_user_id=finding.subject_user_id,
        evidence=dict(finding.evidence or {}),
        amount_at_risk_cents=finding.amount_at_risk_cents,
        severity=finding.severity.value if hasattr(finding.severity, "value") else str(finding.severity),
        case_status=(case.status.value if case else NO_CASE),
        # An employee never receives the reviewer's note, so it is not loaded for one.
        decision_note=(case.decision_note if case and asker_role == "ADMIN" else None),
        names=_org_names(session, org_id),
    )


def _log_question(
    session: Session,
    finding: FindingContext,
    asker_user_id: str,
    asker_role: AskerRole,
    question: str,
    result: AskResult,
) -> None:
    """Every question and answer is logged with the asker. A system that explains itself to
    people has to be auditable by them too."""
    session.add(
        m.AuditLog(
            actor_id=asker_user_id,
            action="ASK_FINDING",
            target_type="Finding",
            target_id=finding.finding_id,
            before=None,
            after={
                "question": question,
                "answer": result.answer,
                "sources": [{"kind": s.kind, "label": s.label, "ref": s.ref} for s in result.sources],
                "fallback": result.fallback,
                "askerRole": asker_role,
            },
            is_self_review=(asker_role == "ADMIN" and asker_user_id == finding.subject_user_id),
            created_at=datetime.now(timezone.utc),
        )
    )


def ask(
    session: Session,
    finding_id: str,
    question: str,
    asker_role: AskerRole,
    asker_user_id: str,
    org_id: str | None = None,
) -> AskResult:
    org_id = org_id or settings.org_id
    # Order matters: access first, rate limit second, model last. A question about someone
    # else's finding must not consume a model call or leave a trace in the index.
    finding = load_finding_context(session, finding_id, asker_role, asker_user_id, org_id)
    _limiter.check(asker_user_id)

    normalised = ask_module.normalise_question(question, settings.ask_max_question_chars)
    if not normalised:
        raise ValueError("empty question")

    key = ask_module.cache_key(finding_id, asker_role, normalised)
    cached = _answers.get(key)
    if cached is not None:
        _answers.move_to_end(key)
        _log_question(session, finding, asker_user_id, asker_role, normalised, cached)
        return cached

    embedder = embedding_provider()
    query_vector = embedder.embed([normalised], kind="query")[0]
    passages = index.search(session, org_id, query_vector)
    result = ask_module.answer_question(
        finding, normalised, asker_role, passages, answer_provider()
    )

    # A fallback answer is not cached: it is what the service could manage with the model
    # away, and the model may be back before the next question.
    if not result.fallback:
        _answers[key] = result
        while len(_answers) > settings.ask_cache_size:
            _answers.popitem(last=False)

    _log_question(session, finding, asker_user_id, asker_role, normalised, result)
    return result


def reindex_rules(session: Session, org_id: str | None = None) -> dict[str, int]:
    """Rebuild the rule chunks from the registry. Safe to run on every start: unchanged rules
    are not re-embedded."""
    return index.index_chunks(
        session, org_id or settings.org_id, rule_chunks(), embedding_provider()
    )


def ingest_policy(
    session: Session,
    document_id: str,
    document: str,
    org_id: str | None = None,
) -> dict[str, int]:
    """Chunk, redact, embed and index one policy document.

    Redaction happens here, before embedding, rather than at the API boundary. A policy should
    contain no personal data at all, but this is an uploaded file and the index is searched on
    behalf of every employee, so it is not the place to assume.
    """
    chunks = chunk_document(document, document_id)
    redacted = [type(c)(c.source_kind, c.source_ref, c.heading, redact(c.text)) for c in chunks]
    return index.index_chunks(session, org_id or settings.org_id, redacted, embedding_provider())
