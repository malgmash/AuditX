"""Company holidays. One organisation and one calendar for now. A per-organisation table comes
with the policy documents."""

from __future__ import annotations

from datetime import date

US_HOLIDAYS = frozenset(
    {
        date(2026, 1, 1), date(2026, 1, 19), date(2026, 2, 16), date(2026, 5, 25),
        date(2026, 6, 19), date(2026, 7, 3), date(2026, 9, 7), date(2026, 11, 26), date(2026, 12, 25),
    }
)
