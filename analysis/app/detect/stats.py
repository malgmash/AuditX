"""Robust statistics. Median and MAD, never mean and standard deviation, so one legitimate
large purchase does not widen a band enough to hide what follows it."""

from __future__ import annotations

from statistics import median
from typing import Sequence

# Scales MAD to match a standard deviation for normally distributed data.
MAD_SCALE = 1.4826


def median_mad(values: Sequence[float]) -> tuple[float, float]:
    """Return (median, raw MAD). MAD is the median absolute deviation from the median."""
    m = median(values)
    return m, median(abs(v - m) for v in values)


def robust_z(x: float, med: float, mad: float, *, floor: float) -> float:
    """Robust z-score. MAD is floored so a run of identical past values does not make every
    small difference look infinite."""
    spread = max(mad, floor) * MAD_SCALE
    return (x - med) / spread


def amount_floor_cents(med: float) -> float:
    """Smallest spread we treat as real for an amount: 20 percent of the median, at least $3.
    People's ordinary claims in one category vary by about that much, so a smaller measured
    spread, from a short or very regular history, is noise and not evidence."""
    return max(0.20 * med, 300.0)
