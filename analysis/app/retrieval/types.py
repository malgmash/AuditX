"""Plain data the retrieval path reads and writes.

Same shape as the detectors: the work is pure functions over these, and the database adapter in
app/retrieval/index.py is the only place they meet Postgres.

The split that matters is between what is embedded and what is not. `Chunk` and `Passage` hold
company-wide knowledge only, and that is all the vector index ever contains. `FindingContext`
holds personal data, is fetched by id under the normal access checks, and is never embedded and
never searched.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

SourceKind = Literal["RULE", "POLICY"]
AskerRole = Literal["EMPLOYEE", "ADMIN"]


@dataclass(frozen=True)
class Chunk:
    """A unit of company-wide knowledge, before it is embedded and indexed."""

    source_kind: SourceKind
    source_ref: str  # rule id, or policy document id
    heading: str | None  # travels with the chunk and is shown as the citation
    text: str


@dataclass(frozen=True)
class Passage:
    """A chunk that came back from a search, with how close it was."""

    chunk: Chunk
    similarity: float


@dataclass(frozen=True)
class FindingContext:
    """The finding being asked about. Fetched by id. Never embedded, never searched.

    `decision_note` is the administrator's own words about the case. It is loaded for an
    administrator and left out entirely for an employee, so it cannot reach an employee's
    answer even if a prompt goes wrong.
    """

    finding_id: str
    rule_id: str
    subject_user_id: str
    evidence: dict[str, Any]
    amount_at_risk_cents: int
    severity: str
    case_status: str  # a CaseStatus, or "no case opened"
    decision_note: str | None = None
    # user id to name, for redaction. Names never reach a prompt.
    names: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class AskSource:
    """A citation. Supplied by the service from what it retrieved, never written by the
    model. Matches AskSource in web/src/contracts/shared.ts."""

    kind: SourceKind
    label: str
    ref: str


@dataclass(frozen=True)
class AskResult:
    """Matches AskResponse in web/src/contracts/shared.ts."""

    answer: str
    sources: list[AskSource]
    fallback: bool
