"""Model access. One OpenAI-compatible client, because the hosted NIM API speaks that wire.

Every provider here has an offline twin. With no NVIDIA_API_KEY set the service still embeds,
still retrieves and still answers, using the deterministic embedder and the stored-reason
fallback. That is not a test convenience: the demo has to survive an unplugged network, and a
path that only ever runs under failure is a path nobody has run.
"""

from __future__ import annotations

from app.llm.answering import AnswerProvider, NimAnswers, OfflineAnswers, answer_provider
from app.llm.embeddings import (
    EmbeddingProvider,
    LocalEmbeddings,
    NimEmbeddings,
    embedding_provider,
)

__all__ = [
    "AnswerProvider",
    "EmbeddingProvider",
    "LocalEmbeddings",
    "NimAnswers",
    "NimEmbeddings",
    "OfflineAnswers",
    "answer_provider",
    "embedding_provider",
]
