"""Analysis service. The web service calls the internal endpoints; nothing else does.

Run: uvicorn app.main:app --port 8000
"""

from __future__ import annotations

import hmac

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app import repo
from app import workflow
from app.config import settings
from app.db import session_scope
from app.retrieval import service as retrieval

app = FastAPI(title="AuditX analysis", version="0.1.0")


def require_internal(x_internal_token: str | None = Header(default=None)) -> None:
    if not x_internal_token or not hmac.compare_digest(x_internal_token, settings.internal_token):
        raise HTTPException(status_code=401, detail="internal endpoints are for the web service only")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/recompute", dependencies=[Depends(require_internal)])
def recompute() -> dict[str, int]:
    """Rebuild baselines, re-run every detector, open cases and holds for new findings and rescore
    everyone. Behind an admin button in the web app: when a demo goes sideways, one click rebuilds
    everything. Idempotent, and it does not notify administrators, so a rebuild never floods the bell."""
    with session_scope() as session:
        out = repo.recompute(session, settings.org_id)
        out.update(workflow.run_all(session, settings.org_id, notify=False))
        return out


@app.post("/internal/detect", dependencies=[Depends(require_internal)])
def detect() -> dict[str, int]:
    """One call after a submission. Runs the detectors, stores new findings, opens a case for each
    finding at CASE or above, places a hold for each immediate hold, tells the administrators and
    rescores. Findings already stored are left alone, so calling it again adds only what is new."""
    with session_scope() as session:
        ctx = repo.load_context(session)
        from app.detect.runner import detect_all

        drafts = detect_all(ctx)
        inserted, skipped = repo.persist_findings(session, settings.org_id, drafts)
        session.flush()
        out = {"findings": len(drafts), "inserted": inserted, "already_stored": skipped}
        out.update(workflow.run_all(session, settings.org_id, notify=True))
        return out


class DecideBody(BaseModel):
    """The admin id comes from the authenticated session in the web service, never from the browser."""

    decision: str = Field(pattern="^(ACCEPT|DECLINE)$")
    admin_id: str
    note: str | None = Field(default=None, max_length=1000)


class ReverseBody(BaseModel):
    admin_id: str
    note: str | None = Field(default=None, max_length=1000)


@app.post("/internal/cases/{case_id}/decide", dependencies=[Depends(require_internal)])
def decide_case(case_id: str, body: DecideBody) -> dict[str, object]:
    """Accept keeps the hold and confirms the penalty. Decline releases the hold and removes the
    penalty. Either way: AuditLog row, notification to the employee, scores rescored. Returns the
    subject's score before and after so the screen can animate."""
    try:
        with session_scope() as session:
            return workflow.decide_case(session, settings.org_id, case_id, body.decision, body.admin_id, body.note)  # type: ignore[arg-type]
    except workflow.WorkflowError as err:
        raise HTTPException(status_code=409, detail=str(err)) from err


@app.post("/internal/holds/{hold_id}/reverse", dependencies=[Depends(require_internal)])
def reverse_hold(hold_id: str, body: ReverseBody) -> dict[str, object]:
    """Release a hold in one call: Hold.releasedAt, a ScoreEvent restoring the points, an AuditLog
    row and a notification to the employee."""
    try:
        with session_scope() as session:
            return workflow.reverse_hold(session, settings.org_id, hold_id, body.admin_id, body.note)
    except workflow.WorkflowError as err:
        raise HTTPException(status_code=409, detail=str(err)) from err


class AskBody(BaseModel):
    """The asker's role and user id come from the authenticated session in the web service and
    are sent here as separate fields. They are never read out of the question."""

    finding_id: str
    question: str = Field(min_length=1)
    asker_role: str = Field(pattern="^(EMPLOYEE|ADMIN)$")
    asker_user_id: str


@app.post("/internal/ask", dependencies=[Depends(require_internal)])
def ask(body: AskBody) -> dict[str, object]:
    """Tier 2. A grounded answer about one finding.

    404 when the finding does not exist or is not the asker's, and the two are the same reply
    on purpose: which of the two it is would itself tell an employee something about another
    person's record. The check runs before anything is embedded.
    """
    with session_scope() as session:
        try:
            result = retrieval.ask(
                session,
                finding_id=body.finding_id,
                question=body.question,
                asker_role=body.asker_role,  # type: ignore[arg-type]
                asker_user_id=body.asker_user_id,
            )
        except retrieval.NotVisible:
            raise HTTPException(status_code=404, detail="no such finding")
        except retrieval.RateLimited as exc:
            raise HTTPException(status_code=429, detail=str(exc))
        return {
            "answer": result.answer,
            "sources": [{"kind": s.kind, "label": s.label, "ref": s.ref} for s in result.sources],
            "fallback": result.fallback,
        }


class PolicyBody(BaseModel):
    document_id: str
    text: str = Field(min_length=1)


@app.post("/internal/policy/ingest", dependencies=[Depends(require_internal)])
def ingest_policy(body: PolicyBody) -> dict[str, int]:
    """Tier 3. Chunk, redact, embed and index one policy document.

    Re-ingesting the same document id replaces its chunks, so a deleted section stops being
    retrievable. Unchanged text is not re-embedded.
    """
    with session_scope() as session:
        return retrieval.ingest_policy(session, body.document_id, body.text)


@app.post("/internal/knowledge/reindex", dependencies=[Depends(require_internal)])
def reindex_knowledge(include_fixture_policy: bool = True) -> dict[str, object]:
    """Rebuild the retrieval index: one chunk per rule from the registry, plus the fixture
    policy document until upload exists. Safe to run repeatedly."""
    from app.policies import fixture_documents

    with session_scope() as session:
        result = {"rules": retrieval.reindex_rules(session)}
        if include_fixture_policy:
            result["policies"] = {
                doc_id: retrieval.ingest_policy(session, doc_id, text)
                for doc_id, text in fixture_documents().items()
            }
        return result
