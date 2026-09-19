"""Precision and recall of every rule against the injected ground truth, plus the near-miss table.

    python -m generator.evaluate --run-id seed42

Run this before tuning anything. Tuning thresholds by eye against a demo dataset is how you end
up with a system that works only on the demo dataset.

How findings are scored
  A finding "touches" the expense and timesheet ids it lists. It is a true positive when its rule
  is the one a ground truth row expects and it touches that row's target ids.
  A finding on a row's records from a rule the row lists under `also` is neutral: a padded claim
  that is also a category mismatch is not a false alarm.
  Every other finding is a false positive, on honest data or on a near-miss.

Three precision figures are given because they answer different questions:
  all         every finding, notes included
  actionable  CASE and IMMEDIATE_HOLD, what an administrator is asked to look at
  holds       IMMEDIATE_HOLD only, the one that pauses someone's reimbursement
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from app.detect.rules import RULES
from app.detect.runner import detect_all
from app.detect.types import DetectorConfig, FindingDraft
from generator.dataset import Dataset, GroundTruth

ORDER = {"NONE": 0, "NOTE": 1, "CASE": 2, "IMMEDIATE_HOLD": 3}

TARGET_HOLD_PRECISION = 0.90
TARGET_RECALL = 0.70


def touches(f: FindingDraft) -> set[str]:
    return set(f.expense_ids) | set(f.timesheet_ids)


@dataclass
class RuleScore:
    rule: str
    positives: int = 0  # ground truth rows expecting this rule
    caught: int = 0  # rows with a finding at or above the row's minimum severity
    noted: int = 0  # rows with any matching finding
    tp: dict[str, int] = field(default_factory=lambda: {"all": 0, "actionable": 0, "holds": 0})
    fp: dict[str, int] = field(default_factory=lambda: {"all": 0, "actionable": 0, "holds": 0})
    neutral: int = 0

    def precision(self, kind: str) -> float | None:
        n = self.tp[kind] + self.fp[kind]
        return None if n == 0 else self.tp[kind] / n


@dataclass
class NearMissResult:
    scenario: str
    passed: bool
    max_severity_allowed: str
    offenders: list[FindingDraft]
    recorded: list[FindingDraft]


@dataclass
class Report:
    rules: dict[str, RuleScore]
    near_misses: list[NearMissResult]
    missed: list[GroundTruth]
    false_positives: list[FindingDraft]
    total_findings: int
    severity_counts: dict[str, int]

    def overall_recall(self) -> float:
        pos = sum(r.positives for r in self.rules.values())
        return sum(r.caught for r in self.rules.values()) / pos if pos else 0.0

    def hold_precision(self) -> float | None:
        tp = sum(r.tp["holds"] for r in self.rules.values())
        fp = sum(r.fp["holds"] for r in self.rules.values())
        return None if tp + fp == 0 else tp / (tp + fp)

    def actionable_precision(self) -> float | None:
        tp = sum(r.tp["actionable"] for r in self.rules.values())
        fp = sum(r.fp["actionable"] for r in self.rules.values())
        return None if tp + fp == 0 else tp / (tp + fp)


def evaluate(findings: list[FindingDraft], truth: list[GroundTruth]) -> Report:
    positives = [t for t in truth if t.expected is not None]
    near = [t for t in truth if t.expected is None]
    scores = {rid: RuleScore(rid) for rid in RULES}
    for t in positives:
        scores[t.expected].positives += 1

    by_target: dict[str, list[GroundTruth]] = defaultdict(list)
    for t in truth:
        for i in t.target_ids:
            by_target[i].append(t)

    near_by_target: dict[str, list[GroundTruth]] = defaultdict(list)
    for t in near:
        for i in t.target_ids:
            near_by_target[i].append(t)

    def allowed_on_near_miss(f: FindingDraft) -> bool:
        """A note on a near-miss the scenario permits is recorded, not a false alarm."""
        return any(
            ORDER[f.severity] <= ORDER[t.max_severity] and (not t.watch_rules or f.rule_id in t.watch_rules)
            for i in touches(f) for t in near_by_target.get(i, [])
        )

    matched_rows: dict[int, list[FindingDraft]] = defaultdict(list)
    false_positives: list[FindingDraft] = []
    sev_counts: dict[str, int] = defaultdict(int)

    for f in findings:
        sev_counts[f.severity] += 1
        kinds = ["all"]
        if ORDER[f.severity] >= ORDER["CASE"]:
            kinds.append("actionable")
        if f.severity == "IMMEDIATE_HOLD":
            kinds.append("holds")
        rows = {id(t): t for i in touches(f) for t in by_target.get(i, [])}
        hit = [t for t in rows.values() if t.expected == f.rule_id or f.rule_id in t.alt]
        if hit:
            for t in hit:
                matched_rows[id(t)].append(f)
            for k in kinds:
                scores[f.rule_id].tp[k] += 1
        elif any(f.rule_id in t.also for t in rows.values()) or allowed_on_near_miss(f):
            scores[f.rule_id].neutral += 1
        else:
            for k in kinds:
                scores[f.rule_id].fp[k] += 1
            false_positives.append(f)

    missed: list[GroundTruth] = []
    for t in positives:
        got = matched_rows.get(id(t), [])
        if got:
            scores[t.expected].noted += 1
        if any(ORDER[f.severity] >= ORDER[t.min_severity] for f in got):
            scores[t.expected].caught += 1
        else:
            missed.append(t)

    results: list[NearMissResult] = []
    for t in near:
        ids = set(t.target_ids)
        watch = set(t.watch_rules)
        on_it = [f for f in findings if touches(f) & ids and (not watch or f.rule_id in watch)]
        offenders = [f for f in on_it if ORDER[f.severity] > ORDER[t.max_severity]]
        results.append(NearMissResult(t.scenario, not offenders, t.max_severity, offenders, on_it))

    return Report(scores, results, missed, false_positives, len(findings), dict(sev_counts))


def _fmt(x: float | None) -> str:
    return "  n/a" if x is None else f"{x:5.2f}"


def render(report: Report, verbose: bool = False) -> str:
    out: list[str] = []
    out.append(f"{'rule':26s} {'rows':>4s} {'caught':>6s} {'recall':>6s} | {'P(all)':>6s} {'P(act)':>6s} {'P(hold)':>7s} | {'FP':>3s} {'neutral':>7s}")
    out.append("-" * 92)
    for rid, s in report.rules.items():
        recall = f"{s.caught / s.positives:6.2f}" if s.positives else "   n/a"
        out.append(
            f"{rid:26s} {s.positives:4d} {s.caught:6d} {recall} | {_fmt(s.precision('all')):>6s} "
            f"{_fmt(s.precision('actionable')):>6s} {_fmt(s.precision('holds')):>7s} | {s.fp['all']:3d} {s.neutral:7d}"
        )
    out.append("-" * 92)
    hp, ap, rc = report.hold_precision(), report.actionable_precision(), report.overall_recall()
    out.append(f"findings {report.total_findings}   by severity {dict(sorted(report.severity_counts.items()))}")
    out.append(f"precision on holds       {_fmt(hp).strip():>5s}   target above {TARGET_HOLD_PRECISION:.2f}   {'PASS' if hp is None or hp > TARGET_HOLD_PRECISION else 'FAIL'}")
    out.append(f"precision actionable     {_fmt(ap).strip():>5s}")
    out.append(f"overall recall           {rc:5.2f}   target above {TARGET_RECALL:.2f}   {'PASS' if rc > TARGET_RECALL else 'FAIL'}")
    out.append("")
    out.append("Near-miss set: the detectors must not fire on these")
    for r in report.near_misses:
        limit = "no finding" if r.max_severity_allowed == "NONE" else f"at most a {r.max_severity_allowed.lower()}"
        status = "PASS" if r.passed else "FAIL"
        extra = f"   recorded: {', '.join(f'{f.rule_id} ({f.severity})' for f in r.recorded)}" if r.recorded else ""
        out.append(f"  {status}  {r.scenario:34s} allowed: {limit}{extra}")
        for f in r.offenders:
            out.append(f"        fired {f.rule_id} as {f.severity}")
    if report.missed:
        out.append("")
        out.append("Missed")
        for t in report.missed:
            out.append(f"  {t.expected:26s} {t.scenario} ({t.user_id}), needed {t.min_severity}")
    if verbose and report.false_positives:
        out.append("")
        out.append("False positives")
        for f in report.false_positives:
            out.append(f"  {f.rule_id:26s} {f.severity:14s} conf {f.confidence:.2f}  {f.subject_user_id}  {sorted(touches(f))[:3]}  {f.evidence}")
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Per-rule precision and recall against ground truth")
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args(argv)
    ds = Dataset.load(Path(args.data_dir) / args.run_id)
    findings = detect_all(ds.context(DetectorConfig()))
    print(render(evaluate(findings, ds.ground_truth), args.verbose))
    return 0


if __name__ == "__main__":
    sys.exit(main())
