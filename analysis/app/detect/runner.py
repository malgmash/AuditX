"""Run all three detectors and assign severity.

Same signature as each detector: a pure function of the context. Output order is fixed so two
runs over the same data give the same list.
"""

from __future__ import annotations

from app.detect import abnormal, duplicates, timesheets
from app.detect.severity import apply_severity
from app.detect.types import DetectionContext, FindingDraft


def detect_all(ctx: DetectionContext) -> list[FindingDraft]:
    drafts = [*duplicates.detect(ctx), *abnormal.detect(ctx), *timesheets.detect(ctx)]
    apply_severity(drafts, ctx)
    drafts.sort(key=lambda d: (d.rule_id, d.dedupe_key))
    return drafts
