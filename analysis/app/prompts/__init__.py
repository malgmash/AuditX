"""Runtime prompts, one file each.

Prompts are files rather than inline strings so the text in PROMPTS.md and the text the service
sends can be diffed, and so a prompt change shows up in review as a prompt change.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_DIR = Path(__file__).resolve().parent


@lru_cache(maxsize=None)
def load(name: str) -> str:
    """Read a prompt by file stem. Cached: the files do not change while the process runs."""
    path = _DIR / f"{name}.txt"
    if not path.is_file():
        raise FileNotFoundError(f"no prompt named {name} in {_DIR}")
    return path.read_text(encoding="utf-8").strip()
