"""Splitting a policy document into chunks worth retrieving.

Split on headings first, because a policy heading is the citation an employee needs to see.
Only then split on length, and only when a section is too long to pass whole. The heading
travels with every chunk it produced, so a fragment from the middle of a long section still
cites the section it came from.

Token counts are approximate: words times 1.3, which is close enough for English prose and
needs no tokeniser at index time. The range is 300 to 500 tokens with a small overlap, so a
sentence split across a boundary still appears whole in one of the two chunks.
"""

from __future__ import annotations

import re

from app.retrieval.types import Chunk

TARGET_TOKENS = 400
MAX_TOKENS = 500
MIN_TOKENS = 300
OVERLAP_TOKENS = 50
# Below this a chunk is a stray line, usually a heading with no body under it.
MIN_CHUNK_WORDS = 8

_TOKENS_PER_WORD = 1.3
_HEADING = re.compile(r"^\s{0,3}(#{1,6})\s+(.*\S)\s*$")
_WORDS = re.compile(r"\S+")


def token_estimate(text: str) -> int:
    return round(len(_WORDS.findall(text)) * _TOKENS_PER_WORD)


def _words_for_tokens(tokens: int) -> int:
    return max(1, round(tokens / _TOKENS_PER_WORD))


def split_sections(document: str) -> list[tuple[str | None, str]]:
    """Split on markdown headings into (heading, body) pairs.

    A document with no headings is one section with no heading. Text before the first heading
    is kept: it is usually the scope paragraph, which is worth retrieving.
    """
    sections: list[tuple[str | None, list[str]]] = []
    heading: str | None = None
    body: list[str] = []
    for line in document.splitlines():
        match = _HEADING.match(line)
        if match:
            if any(ln.strip() for ln in body):
                sections.append((heading, body))
            heading = match.group(2).strip()
            body = []
            continue
        body.append(line)
    if any(ln.strip() for ln in body):
        sections.append((heading, body))
    return [(h, "\n".join(b).strip()) for h, b in sections]


def _split_long(text: str) -> list[str]:
    """Break a section that exceeds MAX_TOKENS into overlapping windows.

    Paragraph boundaries are preferred. A single paragraph longer than the window is cut on
    word count, because the alternative is passing a whole chapter to the model.
    """
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    current: list[str] = []

    def flush() -> None:
        if current:
            chunks.append("\n\n".join(current))
            current.clear()

    for paragraph in paragraphs:
        if token_estimate(paragraph) > MAX_TOKENS:
            flush()
            words = _WORDS.findall(paragraph)
            window = _words_for_tokens(TARGET_TOKENS)
            step = max(1, window - _words_for_tokens(OVERLAP_TOKENS))
            for start in range(0, len(words), step):
                piece = words[start : start + window]
                if not piece:
                    break
                chunks.append(" ".join(piece))
                if start + window >= len(words):
                    break
            continue
        if current and token_estimate("\n\n".join([*current, paragraph])) > MAX_TOKENS:
            flush()
            current.append(paragraph)
            continue
        current.append(paragraph)
        if token_estimate("\n\n".join(current)) >= TARGET_TOKENS:
            flush()
    flush()

    # A trailing scrap is appended to the chunk before it rather than indexed on its own,
    # where it would match everything weakly and nothing well.
    if len(chunks) > 1 and token_estimate(chunks[-1]) < MIN_TOKENS // 2:
        tail = chunks.pop()
        chunks[-1] = f"{chunks[-1]}\n\n{tail}"
    return chunks


def chunk_document(document: str, source_ref: str) -> list[Chunk]:
    """Chunk one policy document. `source_ref` is the document id, shown as the citation ref."""
    chunks: list[Chunk] = []
    for heading, body in split_sections(document):
        if not body.strip():
            continue
        pieces = [body] if token_estimate(body) <= MAX_TOKENS else _split_long(body)
        for piece in pieces:
            if len(_WORDS.findall(piece)) < MIN_CHUNK_WORDS:
                continue
            # The heading goes into the embedded text as well as the citation. "Meals" under
            # "Per diem limits" means something the paragraph alone does not say.
            text = f"{heading}\n\n{piece}" if heading else piece
            chunks.append(
                Chunk(source_kind="POLICY", source_ref=source_ref, heading=heading, text=text)
            )
    return chunks
