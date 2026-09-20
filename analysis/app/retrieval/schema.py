"""Database objects for the retrieval index that Prisma cannot declare.

`prisma db push` creates the `KnowledgeChunk` table and, with the postgresqlExtensions preview
feature, the `vector` extension. It has no syntax for an approximate-nearest-neighbour index,
so that is created here.

Idempotent. Run after every `db:push`:

    python -m app.retrieval.schema
"""

from __future__ import annotations

import sys

from sqlalchemy import text

from app.config import settings
from app.db import session_scope

# HNSW rather than IVFFlat: it needs no training pass over existing rows, which matters when
# the index starts empty and fills up as policies are uploaded. Cosine, to match the distance
# the search in app/retrieval/index.py orders by.
STATEMENTS = (
    'CREATE EXTENSION IF NOT EXISTS vector',
    'CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw" '
    'ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops)',
)


def apply() -> None:
    with session_scope() as session:
        for statement in STATEMENTS:
            session.execute(text(statement))


def main() -> int:
    apply()
    print(f"retrieval index ready, {settings.embedding_dim} dimensions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
