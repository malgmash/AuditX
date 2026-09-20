"""The query path, as pure functions. No database, no network, no clock.

The order is deliberate and the tests depend on it:

1. the caller has already checked the finding belongs to the asker, and has derived the role
   from the session, never from the request body
2. the question is embedded and passages are retrieved, over company-wide knowledge only
3. the prompt is assembled: the finding's evidence fetched by id, plus the passages, each in a
   delimited block that the prompt names as data
4. the response is validated, retried once, and then replaced by a deterministic answer built
   from the rule's own description and the passages verbatim

The model explains a finding that already exists. It does not decide whether the flag is right,
and it never runs before step 1.
"""

from __future__ import annotations

import hashlib
import json
import re

from app.detect.rules import RULES
from app.llm.answering import AnswerProvider, validate_answer
from app.prompts import load as load_prompt
from app.redact import redact, redact_value
from app.retrieval.types import AskerRole, AskResult, AskSource, FindingContext, Passage

NO_MATERIAL = (
    "The available rule descriptions and policy documents do not cover that question. "
    "The flag itself is described below, and a reviewer can answer anything beyond it."
)

# A passage is untrusted text from an uploaded document. Neutralising the delimiter stops a
# document closing its own block and writing what looks like prompt. The prompt also states
# that passages are data, and the validator checks the response: three layers, because a
# document nobody reviewed ends up in this index.
_DELIMITER = re.compile(r"</?\s*passage\b[^>]*>", re.IGNORECASE)
_WHITESPACE = re.compile(r"\s+")


def normalise_question(question: str, max_chars: int) -> str:
    """Collapse whitespace, strip delimiters, cap the length.

    The cap is not only abuse control. A question is single turn with no memory, so anything
    long enough to need a scrollbar is not a question.
    """
    cleaned = _DELIMITER.sub(" ", question)
    cleaned = _WHITESPACE.sub(" ", cleaned).strip()
    return cleaned[:max_chars]


def cache_key(finding_id: str, asker_role: AskerRole, question: str) -> str:
    """Answers are cached by finding, asker role and normalised question. The role is part of
    the key because the same question gets a different answer for the two roles."""
    digest = hashlib.sha256(question.lower().encode("utf-8")).hexdigest()[:16]
    return f"{finding_id}:{asker_role}:{digest}"


def _passage_block(passages: list[Passage]) -> str:
    return "\n".join(
        f'<passage id="P{i}" source="{_DELIMITER.sub(" ", p.chunk.heading or p.chunk.source_ref)}">'
        f"{_DELIMITER.sub(' ', p.chunk.text)}</passage>"
        for i, p in enumerate(passages, start=1)
    )


def sources_for(passages: list[Passage]) -> list[AskSource]:
    """The citations shown beside the answer. Built from what was retrieved, never from what
    the model wrote, so a citation cannot be invented."""
    return [
        AskSource(
            kind=p.chunk.source_kind,
            label=p.chunk.heading or p.chunk.source_ref,
            ref=p.chunk.source_ref,
        )
        for p in passages
    ]


def build_prompt(
    finding: FindingContext,
    passages: list[Passage],
    question: str,
    asker_role: AskerRole,
) -> tuple[str, str]:
    """The B4 prompt from PROMPTS.md. Returns (system, user)."""
    rule = RULES.get(finding.rule_id)
    evidence = dict(redact_value(finding.evidence, finding.names))
    evidence["amount_at_risk_cents"] = finding.amount_at_risk_cents
    evidence["severity"] = finding.severity
    # The administrator's own words about the case. Loaded only for an administrator, and
    # checked again here, because this is the line that must not move.
    if asker_role == "ADMIN" and finding.decision_note:
        evidence["reviewer_note"] = redact(finding.decision_note, finding.names)

    user = load_prompt("answer_user").format(
        rule_id=finding.rule_id,
        rule_description=rule.description if rule else "no description on file",
        evidence_json=json.dumps(evidence, sort_keys=True, default=str),
        case_status=finding.case_status,
        asker_role=asker_role,
        passages=_passage_block(passages) or "(none retrieved)",
        question=question,
    )
    return load_prompt("answer_system"), user


def deterministic_answer(finding: FindingContext, passages: list[Passage]) -> str:
    """The answer when the model is unreachable or its response failed validation.

    Not an error message. It is the rule's own plain description and the passages exactly as
    they are stored, which is everything the model would have been working from. The product
    works with the network unplugged, and this is the sentence that makes that true.
    """
    rule = RULES.get(finding.rule_id)
    parts = []
    if rule:
        parts.append(f"This was flagged by {rule.id}: {rule.description} {rule.method}")
    else:
        parts.append(f"This was flagged by rule {finding.rule_id}.")
    parts.append(
        "A reviewer decides what happens next; the flag on its own decides nothing."
        if finding.case_status.lower() in ("open", "no case opened")
        else f"The case status is {finding.case_status}."
    )
    if passages:
        quoted = "\n\n".join(
            f"{p.chunk.heading or p.chunk.source_ref}:\n{p.chunk.text}" for p in passages
        )
        parts.append(f"The related material says, in full:\n\n{quoted}")
    return "\n\n".join(parts)


def answer_question(
    finding: FindingContext,
    question: str,
    asker_role: AskerRole,
    passages: list[Passage],
    provider: AnswerProvider,
) -> AskResult:
    """Assemble, call, validate, retry once, fall back. The sources come from `passages`
    either way, so an answer always shows what it was grounded in."""
    sources = sources_for(passages)
    if not passages:
        # Nothing above the similarity floor. Saying so is the honest answer, and it costs no
        # model call.
        return AskResult(
            answer=f"{NO_MATERIAL}\n\n{deterministic_answer(finding, [])}",
            sources=[],
            fallback=True,
        )

    system, user = build_prompt(finding, passages, question, asker_role)
    for _ in range(2):  # one call, one retry
        answer = validate_answer(provider.complete(system, user))
        if answer:
            return AskResult(answer=answer, sources=sources, fallback=False)
    return AskResult(answer=deterministic_answer(finding, passages), sources=sources, fallback=True)
