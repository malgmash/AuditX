"""Redaction. Nothing reaches a model, or the retrieval index, without passing through here.

This runs during normalisation rather than at the API boundary, so no code path can skip it by
calling a client directly. The rule is blunt on purpose: a digit run that could be a card number
is reduced whether or not the surrounding text says it is one.

Money is not touched. Amounts are integer cents and never travel as free text with separators.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

CARD_REDACTED = "[card ending {last4}]"
ACCOUNT_REDACTED = "[account number removed]"
ROUTING_REDACTED = "[routing number removed]"
NATIONAL_ID_REDACTED = "[national id removed]"

# 13 to 19 digits, optionally grouped by a single space or hyphen. Anchored on non-digit
# boundaries so a long id is not clipped into a match.
_CARD = re.compile(r"(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])")

# Labelled account and routing numbers. The label is what makes a 9 digit run identifiable,
# so the label carries the match.
_ACCOUNT = re.compile(
    r"\b(?:a/?c|acct|account)\s*(?:number|no\.?|#|:)?\s*[:#]?\s*(?:x+|\*+)?\d{4,17}\b",
    re.IGNORECASE,
)
_ROUTING = re.compile(
    r"\b(?:aba|routing|rtn)\s*(?:number|no\.?|#|:)?\s*[:#]?\s*\d{9}\b",
    re.IGNORECASE,
)

# National ID. The formatted US pattern, and the labelled bare form.
_NATIONAL_ID = re.compile(
    r"\b(?:\d{3}-\d{2}-\d{4}|(?:ssn|social security)\s*(?:number|no\.?|#|:)?\s*[:#]?\s*\d{9})\b",
    re.IGNORECASE,
)

_DIGITS = re.compile(r"\D")


def pseudonym(user_id: str) -> str:
    """A stable pseudonymous id for one person. The same person gets the same token every time,
    so a model can follow who is who across a prompt without ever learning a name."""
    return "EMP-" + hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:8].upper()


def _card_sub(match: re.Match[str]) -> str:
    digits = _DIGITS.sub("", match.group(0))
    return CARD_REDACTED.format(last4=digits[-4:])


def redact(text: str, names: dict[str, str] | None = None) -> str:
    """Redact one string.

    `names` maps a user id to that person's name. Every name given is replaced by the
    pseudonymous id for that user, including the first and last name on their own, because a
    receipt or a note rarely prints the full name.
    """
    if not text:
        return text
    # National ID first: its formatted pattern contains digit runs the card rule would eat.
    out = _NATIONAL_ID.sub(NATIONAL_ID_REDACTED, text)
    out = _ROUTING.sub(ROUTING_REDACTED, out)
    out = _ACCOUNT.sub(ACCOUNT_REDACTED, out)
    out = _CARD.sub(_card_sub, out)
    for user_id, name in (names or {}).items():
        token = pseudonym(user_id)
        parts = [p for p in re.split(r"\s+", name.strip()) if len(p) > 2]
        # The id goes too. Detector evidence identifies people by id, and an id a reader can
        # paste into a URL is as identifying as a name.
        for needle in sorted([user_id, name.strip(), *parts], key=len, reverse=True):
            if not needle:
                continue
            out = re.sub(rf"\b{re.escape(needle)}\b", token, out, flags=re.IGNORECASE)
    return out


def redact_value(value: Any, names: dict[str, str] | None = None) -> Any:
    """Walk a JSON-shaped value and redact every string in it.

    Finding evidence is a JSON blob written by the detectors and it goes into the answering
    prompt whole, so it is redacted the same as any other text. Keys are redacted too: a field
    name built from a merchant string is still text.
    """
    if isinstance(value, str):
        return redact(value, names)
    if isinstance(value, dict):
        return {redact(str(k), names): redact_value(v, names) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact_value(v, names) for v in value]
    return value
