"""Analysis service. The web service calls the internal endpoints; nothing else does.

Run: uvicorn app.main:app --port 8000
"""

from __future__ import annotations

import hmac

from fastapi import Depends, FastAPI, Header, HTTPException

from app import repo
from app.config import settings
from app.db import session_scope

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
