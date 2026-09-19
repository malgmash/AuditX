"""City-level location matching.

A city string match is enough for the seeded data and would fail on real merchant addresses.
Swap this module for a geocoder when real data arrives. Comparison is at city granularity, so a
restaurant two blocks from the office is not a conflict.
"""

from __future__ import annotations

import re

_ALIASES = {
    "pgh": "pittsburgh",
    "nyc": "new york",
    "new york city": "new york",
    "ny": "new york",
    "chi": "chicago",
    "sf": "san francisco",
    "la": "los angeles",
}

# Words that describe the kind of place, not the city.
_NOISE = re.compile(r"\b(office|hq|headquarters|branch|campus|site|remote|wfh|home)\b")

# Declared locations that carry no city at all.
_NO_CITY = {"", "remote", "home", "wfh", "n/a", "none"}


def normalize_city(value: str | None) -> str | None:
    """Reduce a declared location or merchant city to a comparable city name, or None when the
    text names no city (for example plain "remote")."""
    if value is None:
        return None
    v = value.strip().lower()
    if v in _NO_CITY:
        return None
    v = v.split(",")[0]
    v = _NOISE.sub(" ", v)
    v = re.sub(r"[^a-z ]", " ", v)
    v = re.sub(r"\s+", " ", v).strip()
    if not v:
        return None
    return _ALIASES.get(v, v)


def different_cities(a: str | None, b: str | None) -> bool:
    """True only when both sides name a city and the cities differ. Unknown never conflicts."""
    ca, cb = normalize_city(a), normalize_city(b)
    return ca is not None and cb is not None and ca != cb
