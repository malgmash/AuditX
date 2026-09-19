"""The rule registry. One entry per rule id.

This is the single source for rule descriptions. The retrieval index builds its rule chunks from
it, and the briefs quote from it, so the documentation cannot drift from the code.
Base confidence and points come from SYSTEM-DESIGN.md.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RuleSpec:
    id: str
    family: str  # duplicate | expense | timesheet
    confidence: float
    points: float
    description: str  # plain language, written for someone with no finance training
    method: str


RULES: dict[str, RuleSpec] = {
    r.id: r
    for r in [
        RuleSpec(
            "DUP_RECEIPT_EXACT", "duplicate", 0.99, 30,
            "The same receipt file was submitted more than once.",
            "SHA-256 of the receipt file matches an earlier receipt.",
        ),
        RuleSpec(
            "DUP_RECEIPT_IMAGE", "duplicate", 0.90, 28,
            "A photo of a receipt looks the same as an earlier receipt, for example a re-photographed copy.",
            "Perceptual hash of the normalised image within 10 percent of its bits, for receipts with few lookalikes, at the same merchant on the same or next day and at the same transaction time.",
        ),
        RuleSpec(
            "DUP_RECEIPT_FIELDS", "duplicate", 0.80, 25,
            "Two claims name the same merchant, on the same or the next day, for almost the same amount.",
            "Same resolved merchant, date within one day, amount within 2 percent. Recurring charges with a regular schedule are excluded.",
        ),
        RuleSpec(
            "DUP_RECEIPT_CROSS_USER", "duplicate", 0.85, 32,
            "Two different people submitted what looks like the same receipt.",
            "Any duplicate layer where the two submitters differ.",
        ),
        RuleSpec(
            "EXP_AMOUNT_OUTLIER_SELF", "expense", 0.70, 14,
            "An amount is well above what this person usually claims in that category.",
            "Robust z-score against the person's own median and MAD, threshold 2.5.",
        ),
        RuleSpec(
            "EXP_AMOUNT_OUTLIER_PEER", "expense", 0.65, 12,
            "An amount is well above what colleagues in the same department usually claim in that category.",
            "Robust z-score against the department median and MAD. Skipped below five people.",
        ),
        RuleSpec(
            "EXP_VELOCITY", "expense", 0.60, 10,
            "Many claims were submitted in a short period, more than this person usually submits.",
            "Claims in a rolling seven days compared with the person's own weekly baseline.",
        ),
        RuleSpec(
            "EXP_CATEGORY_MISMATCH", "expense", 0.75, 12,
            "The claimed category does not match what this merchant normally sells.",
            "Merchant's usual category differs from the claimed category.",
        ),
        RuleSpec(
            "EXP_ROUND_AMOUNT", "expense", 0.45, 5,
            "A high-value claim is for an exactly round amount.",
            "Amount at or above 100 dollars and a multiple of 50 dollars.",
        ),
        RuleSpec(
            "EXP_OFF_PATTERN", "expense", 0.50, 6,
            "A claim was made on a weekend or holiday in a category where this person has never claimed on one.",
            "Weekend or holiday claim against a history with none.",
        ),
        RuleSpec(
            "TS_LOCATION_CONFLICT", "timesheet", 0.85, 26,
            "Hours were logged at one location while a receipt places the person in another city at the same time.",
            "A timesheet entry's declared city differs from the merchant city of an expense inside the logged window.",
        ),
        RuleSpec(
            "TS_OVERLAP", "timesheet", 0.95, 22,
            "Two timesheet entries cover the same time.",
            "Entries by one person with overlapping start and end times.",
        ),
        RuleSpec(
            "TS_IMPOSSIBLE_HOURS", "timesheet", 0.90, 20,
            "More hours were logged than a day or a week can reasonably hold.",
            "More than 16 hours in a day, or more than 80 in a week.",
        ),
        RuleSpec(
            "TS_COPY_PASTE", "timesheet", 0.70, 16,
            "A week is identical, to the minute, to at least two earlier weeks.",
            "Week signature of days, times, project and location repeated.",
        ),
        RuleSpec(
            "TS_ROUND_HOURS", "timesheet", 0.50, 8,
            "Every entry is exactly eight hours for several weeks in a row.",
            "All entries exactly 8.0 hours for four or more consecutive weeks.",
        ),
        RuleSpec(
            "TS_HOLIDAY", "timesheet", 0.65, 12,
            "Hours were logged on a company holiday with no approval noted.",
            "Entry on a company holiday without an approval note.",
        ),
    ]
}
