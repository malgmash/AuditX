"""Policy documents.

Upload is Tier 3 and is not built, so the company policy is a fixture here. It is a real
document in the shape a real one arrives in, with headings the chunker splits on, so the
retrieval path is exercised end to end rather than against a paragraph written to suit it.

When upload lands, these are seeded the same way any uploaded document is, through
`POST /internal/policy/ingest`, and nothing else changes.
"""

from __future__ import annotations

from pathlib import Path

_DIR = Path(__file__).resolve().parent


def fixture_documents() -> dict[str, str]:
    """Document id to text. The id is the citation ref stored on every chunk."""
    return {path.stem: path.read_text(encoding="utf-8") for path in sorted(_DIR.glob("*.md"))}
