"""Rule chunks, generated from the rule registry in app/detect/rules.py.

One chunk per rule, built from the registry rather than written by hand, so the catalogue an
employee is shown and the rule that actually fired cannot drift apart. Change a threshold in
the registry, reindex, and the explanation changes with it.

Nothing here is personal. A rule chunk is the same for everyone in the company.
"""

from __future__ import annotations

from app.detect.rules import RULES, RuleSpec
from app.retrieval.types import Chunk

_FAMILY_LABEL = {
    "duplicate": "Duplicate submissions",
    "expense": "Expense claims",
    "timesheet": "Timesheets",
}


def rule_heading(rule: RuleSpec) -> str:
    return f"{_FAMILY_LABEL.get(rule.family, rule.family.title())}: {rule.id}"


def rule_text(rule: RuleSpec) -> str:
    """What the rule looks for, how it decides, and how much weight it carries.

    Confidence is included because a question is often really asking how sure the system is.
    Points are included because an employee can see their own score and deserves to know what
    moved it. Neither number is a judgement about the person.
    """
    return (
        f"Rule {rule.id}. {rule.description}\n"
        f"How it is checked: {rule.method}\n"
        f"Base confidence when this rule matches: {rule.confidence:.2f}. "
        f"Points this rule contributes to the review score: {rule.points:g}.\n"
        f"This rule flags a claim for a person to look at. It does not decide anything and it "
        f"does not conclude that a policy was broken."
    )


def rule_chunks() -> list[Chunk]:
    """Every rule in the registry, as one chunk each."""
    return [
        Chunk(
            source_kind="RULE",
            source_ref=rule.id,
            heading=rule_heading(rule),
            text=rule_text(rule),
        )
        for rule in RULES.values()
    ]
