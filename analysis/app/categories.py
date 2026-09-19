"""The fixed category list. `Expense.categoryId` and `Merchant.categoryId` hold one of these names,
which is why the schema has no Category table. Matches the list in the category prompt (PROMPTS.md,
B5). "Other" is what a model falls back to when it is unsure, because a wrong category corrupts two
baselines at once."""

from __future__ import annotations

CATEGORIES: tuple[str, ...] = (
    "Meals",
    "Travel",
    "Lodging",
    "Transport",
    "Equipment",
    "Software",
    "Supplies",
    "Client Entertainment",
    "Training",
    "Other",
)
