"""Analysis service. The web service calls the internal endpoints; nothing else does.

Run: uvicorn app.main:app --port 8000
"""

from __future__ import annotations

import hmac

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app import repo
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
    """Rebuild baselines and re-run every detector. Behind an admin button in the web app: when a
    demo goes sideways, one click rebuilds everything."""
    with session_scope() as session:
        return repo.recompute(session, settings.org_id)


@app.post("/internal/detect", dependencies=[Depends(require_internal)])
def detect() -> dict[str, int]:
    """Run the detectors over current data. Findings already stored are left alone, so calling this
    after each submission only adds what is new."""
    with session_scope() as session:
        ctx = repo.load_context(session)
        from app.detect.runner import detect_all

        drafts = detect_all(ctx)
        inserted, skipped = repo.persist_findings(session, settings.org_id, drafts)
        return {"findings": len(drafts), "inserted": inserted, "already_stored": skipped}


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
