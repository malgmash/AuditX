"""Merchant resolution.

Production resolves merchants with NeMo Retriever embeddings. This deterministic normaliser is the
fallback the product must work with when the model is unreachable, and it is what the detectors
use in tests and on the synthetic data.
"""

from __future__ import annotations

import re

_STORE_NUMBER = re.compile(r"(#|\bno\.?|\bstore|\bunit)\s*\d+|\b\d{3,}\b")
_LEGAL = re.compile(r"\b(inc|llc|ltd|co|corp|company|the)\b")


# Words that describe the kind of business rather than which one it is.
_GENERIC = re.compile(r"\b(coffee|cafe|restaurant|grill|kitchen|store|market|shop)\b")


def merchant_key(raw: str) -> str:
    """Reduce a printed merchant name to a stable identity. "Starbucks #4471" and
    "STARBUCKS COFFEE" resolve alike; different businesses stay apart."""
    v = raw.lower()
    v = _STORE_NUMBER.sub(" ", v)
    v = re.sub(r"[^a-z0-9 ]", " ", v)
    v = _LEGAL.sub(" ", v)
    v = _GENERIC.sub(" ", v)
    v = re.sub(r"\s+", " ", v).strip()
    tokens = [t for t in v.split(" ") if t]
    return " ".join(tokens[:2])
