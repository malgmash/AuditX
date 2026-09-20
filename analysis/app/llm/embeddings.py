"""Embeddings for the retrieval index.

Two providers behind one interface. `NimEmbeddings` calls the NeMo Retriever model already in
the stack. `LocalEmbeddings` is a deterministic hashing embedder that needs no network.

The local one is not a stub that returns zeros. It hashes word unigrams and bigrams into the
same dimension the real model uses and L2-normalises, so cosine similarity still rewards shared
vocabulary. Retrieval degrades from semantic to lexical, which is worse but honest, and every
code path downstream behaves identically.

Only company-wide knowledge is ever embedded: the rule catalogue and policy documents. Personal
data is fetched by id under the normal access checks. See the Retrieval section of
SYSTEM-DESIGN.md.
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import Iterable, Literal, Protocol, Sequence

from app.config import settings

# A passage and a question are embedded for different jobs. The NeMo Retriever asymmetric
# models need to be told which, and get measurably worse when they are not.
InputKind = Literal["passage", "query"]

_WORD = re.compile(r"[a-z0-9]+")


def text_hash(text: str) -> str:
    """The embedding cache key. Stored on the chunk, so re-indexing unchanged text costs
    nothing."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class EmbeddingProvider(Protocol):
    dimension: int

    def embed(self, texts: Sequence[str], kind: InputKind = "passage") -> list[list[float]]: ...


def _l2_normalise(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        # An empty or symbol-only string. A zero vector would be similar to nothing, which is
        # the right answer, but pgvector cosine distance is undefined on it.
        vector[0] = 1.0
        return vector
    return [v / norm for v in vector]


class LocalEmbeddings:
    """Deterministic, offline, no dependencies. Same text in, same vector out, forever."""

    def __init__(self, dimension: int | None = None) -> None:
        self.dimension = dimension or settings.embedding_dim

    def embed(self, texts: Sequence[str], kind: InputKind = "passage") -> list[list[float]]:
        return [self._one(t) for t in texts]

    def _one(self, text: str) -> list[float]:
        vector = [0.0] * self.dimension
        tokens = _WORD.findall(text.lower())
        # Bigrams carry the phrases that make a policy passage distinctive: "per diem",
        # "same receipt", "round amount".
        grams: Iterable[str] = [*tokens, *(f"{a} {b}" for a, b in zip(tokens, tokens[1:]))]
        for gram in grams:
            digest = hashlib.blake2b(gram.encode("utf-8"), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            sign = 1.0 if digest[4] & 1 else -1.0
            # Sublinear: a word repeated thirty times is not thirty times the evidence.
            vector[index] += sign
        return _l2_normalise([math.copysign(math.log1p(abs(v)), v) for v in vector])


class NimEmbeddings:
    """NeMo Retriever through the OpenAI-compatible endpoint."""

    def __init__(self, model: str | None = None, dimension: int | None = None) -> None:
        from openai import OpenAI  # imported here so the offline path never needs the package

        self.model = model or settings.embedding_model
        self.dimension = dimension or settings.embedding_dim
        self._client = OpenAI(
            api_key=settings.nvidia_api_key,
            base_url=settings.nim_base_url,
            timeout=settings.model_timeout_seconds,
        )

    def embed(self, texts: Sequence[str], kind: InputKind = "passage") -> list[list[float]]:
        if not texts:
            return []
        response = self._client.embeddings.create(
            model=self.model,
            input=list(texts),
            extra_body={"input_type": kind, "truncate": "END"},
        )
        vectors = [list(item.embedding) for item in sorted(response.data, key=lambda d: d.index)]
        for vector in vectors:
            if len(vector) != self.dimension:
                raise ValueError(
                    f"{self.model} returned {len(vector)} dimensions, the index column holds "
                    f"{self.dimension}. Change EMBEDDING_DIM, the vector(N) column in "
                    f"web/prisma/schema.prisma and reindex, all three together."
                )
        return vectors


class CachingEmbeddings:
    """Caches by text hash, so re-indexing an unchanged policy is free and a repeated question
    costs one dictionary lookup."""

    def __init__(self, inner: EmbeddingProvider, max_entries: int = 4096) -> None:
        self._inner = inner
        self._max = max_entries
        self._cache: dict[tuple[str, str], list[float]] = {}
        self.dimension = inner.dimension

    def embed(self, texts: Sequence[str], kind: InputKind = "passage") -> list[list[float]]:
        missing = [t for t in texts if (kind, text_hash(t)) not in self._cache]
        # dict.fromkeys rather than set: order is what makes the zip below line up.
        for text, vector in zip(
            dict.fromkeys(missing), self._inner.embed(list(dict.fromkeys(missing)), kind)
        ):
            if len(self._cache) >= self._max:
                self._cache.pop(next(iter(self._cache)))
            self._cache[(kind, text_hash(text))] = vector
        return [self._cache[(kind, text_hash(t))] for t in texts]


def embedding_provider() -> EmbeddingProvider:
    """NeMo Retriever when a key is configured, the deterministic embedder when not."""
    inner: EmbeddingProvider = NimEmbeddings() if settings.nvidia_api_key else LocalEmbeddings()
    return CachingEmbeddings(inner)
