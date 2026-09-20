"""The vector index. The only place retrieval meets Postgres.

`KnowledgeChunk` holds company-wide knowledge and nothing else: the rule catalogue and policy
documents. No expense, timesheet, finding, case note or name is ever written here. That is what
makes the index safe to search on behalf of any employee, because there is nothing in it that
one employee could pull about another.

Writes replace by source: reindexing a rule or re-ingesting a policy document leaves exactly
the chunks that document currently produces, so a deleted section stops being retrievable.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models as m
from app.config import settings
from app.llm.embeddings import EmbeddingProvider, text_hash
from app.retrieval.types import Chunk, Passage


def _stored_hashes(session: Session, org_id: str, source_refs: set[str]) -> dict[str, set[str]]:
    rows = session.execute(
        select(m.KnowledgeChunk.source_ref, m.KnowledgeChunk.text_hash).where(
            m.KnowledgeChunk.org_id == org_id,
            m.KnowledgeChunk.source_ref.in_(source_refs),
        )
    ).all()
    out: dict[str, set[str]] = {}
    for source_ref, hashed in rows:
        out.setdefault(source_ref, set()).add(hashed)
    return out


def index_chunks(
    session: Session,
    org_id: str,
    chunks: list[Chunk],
    embedder: EmbeddingProvider,
) -> dict[str, int]:
    """Index a set of chunks, replacing whatever is stored for the same sources.

    Unchanged text is never re-embedded: the text hash on the stored row is the cache key, so
    re-ingesting a policy after a one-line edit costs one embedding, not fifty.
    """
    if not chunks:
        return {"indexed": 0, "reused": 0, "removed": 0}

    source_refs = {c.source_ref for c in chunks}
    stored = _stored_hashes(session, org_id, source_refs)
    # Keyed by (source, hash) so a document that repeats a paragraph indexes it once.
    wanted = {(c.source_ref, text_hash(c.text)): c for c in chunks}
    fresh = [c for (ref, hashed), c in wanted.items() if hashed not in stored.get(ref, set())]

    # Drop what these sources no longer produce, including chunks whose text changed.
    keep = {hashed for _, hashed in wanted}
    removed = session.execute(
        delete(m.KnowledgeChunk).where(
            m.KnowledgeChunk.org_id == org_id,
            m.KnowledgeChunk.source_ref.in_(source_refs),
            m.KnowledgeChunk.text_hash.notin_(keep),
        )
    ).rowcount

    if fresh:
        vectors = embedder.embed([c.text for c in fresh], kind="passage")
        now = datetime.now(timezone.utc)
        session.add_all(
            [
                m.KnowledgeChunk(
                    org_id=org_id,
                    source_kind=c.source_kind,
                    source_ref=c.source_ref,
                    heading=c.heading,
                    text=c.text,
                    text_hash=text_hash(c.text),
                    embedding=vector,
                    created_at=now,
                )
                for c, vector in zip(fresh, vectors)
            ]
        )
    session.flush()
    return {"indexed": len(fresh), "reused": len(wanted) - len(fresh), "removed": removed or 0}


def search(
    session: Session,
    org_id: str,
    query_vector: list[float],
    top_k: int | None = None,
    min_similarity: float | None = None,
) -> list[Passage]:
    """The top chunks above the similarity floor, closest first.

    Below the floor nothing comes back and the answer says the available material does not
    cover the question. A weak passage is worse than none: it invites an answer built on
    something that does not apply.
    """
    top_k = settings.retrieval_top_k if top_k is None else top_k
    floor = settings.retrieval_min_similarity if min_similarity is None else min_similarity
    distance = m.KnowledgeChunk.embedding.cosine_distance(query_vector)
    rows = session.execute(
        select(m.KnowledgeChunk, distance.label("distance"))
        .where(m.KnowledgeChunk.org_id == org_id)
        .order_by(distance)
        .limit(top_k)
    ).all()
    passages = [
        Passage(
            chunk=Chunk(
                source_kind=row.KnowledgeChunk.source_kind,  # type: ignore[arg-type]
                source_ref=row.KnowledgeChunk.source_ref,
                heading=row.KnowledgeChunk.heading,
                text=row.KnowledgeChunk.text,
            ),
            similarity=1.0 - float(row.distance),
        )
        for row in rows
    ]
    return [p for p in passages if p.similarity >= floor]


def count_chunks(session: Session, org_id: str) -> dict[str, int]:
    """What is currently indexed, by kind. Used by the health view and the reindex response."""
    counts = {"RULE": 0, "POLICY": 0}
    rows = session.execute(
        select(m.KnowledgeChunk.source_kind).where(m.KnowledgeChunk.org_id == org_id)
    ).all()
    for (kind,) in rows:
        counts[kind] = counts.get(kind, 0) + 1
    return counts
