"""The answering model, and the validation every response passes before anyone sees it.

The model explains a finding that already exists. It does not decide anything. That constraint
lives in the prompt (app/prompts/answer_system.txt) because a model told its job is to find
fraud will find fraud, and it lives here as well, because a prompt is a request and a validator
is a guarantee.
"""

from __future__ import annotations

import re
from typing import Protocol

from app.config import settings

# Rule 8 of WORKSTREAMS.md, enforced on the way out. A response using any of these is rejected
# and retried, and if the retry fails too the deterministic fallback answers instead.
BANNED = ("fraud", "fraudulent", "theft", "stealing", "stole", "dishonest", "guilty", "criminal")

_SENTENCE_END = re.compile(r"[.!?](?:\s|$)")
_FENCE = re.compile(r"^```[a-z]*\s*|\s*```$", re.IGNORECASE)

# Two or three sentences is the instruction. Four is a model being thorough; ten is a model
# that has stopped following the prompt, and the rest of it is not to be trusted either.
MAX_SENTENCES = 5
MAX_CHARS = 900


class AnswerProvider(Protocol):
    def complete(self, system: str, user: str) -> str | None:
        """Return the response text, or None when the model could not be reached."""
        ...


class OfflineAnswers:
    """No key, no network, no answer. Returning None hands the question to the deterministic
    fallback, which is a real answer built from the finding's stored reason and the passages."""

    def complete(self, system: str, user: str) -> str | None:
        return None


class NimAnswers:
    """Nemotron through the OpenAI-compatible endpoint."""

    def __init__(self, model: str | None = None, temperature: float | None = None) -> None:
        from openai import OpenAI  # imported here so the offline path never needs the package

        self.model = model or settings.answer_model
        self.temperature = settings.answer_temperature if temperature is None else temperature
        self._client = OpenAI(
            api_key=settings.nvidia_api_key,
            base_url=settings.nim_base_url,
            timeout=settings.model_timeout_seconds,
        )

    def complete(self, system: str, user: str) -> str | None:
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                max_tokens=300,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except Exception:
            # Any reason the model did not answer is the same reason to the caller: it is not
            # there, so fall back. The product works with the model unreachable.
            return None
        content = response.choices[0].message.content if response.choices else None
        return content.strip() if content else None


def validate_answer(text: str | None) -> str | None:
    """Return the answer if it is usable, None if it is not.

    None means retry once, then fall back. Rejecting is cheap; a sentence telling an employee
    they committed fraud is not.
    """
    if not text:
        return None
    cleaned = _FENCE.sub("", text.strip()).strip()
    if not cleaned or len(cleaned) > MAX_CHARS:
        return None
    if cleaned[0] in "{[":  # the prompt says prose, so JSON means it was not read
        return None
    lowered = cleaned.lower()
    if any(re.search(rf"\b{word}\b", lowered) for word in BANNED):
        return None
    if len(_SENTENCE_END.findall(cleaned)) > MAX_SENTENCES:
        return None
    return cleaned


def answer_provider() -> AnswerProvider:
    """Nemotron when a key is configured, the deterministic fallback when not."""
    return NimAnswers() if settings.nvidia_api_key else OfflineAnswers()
