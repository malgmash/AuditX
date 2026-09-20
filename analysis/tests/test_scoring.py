from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app import scoring as s

UTC = timezone.utc
NOW = datetime(2026, 9, 20, 12, tzinfo=UTC)


def pen(fid="f1", points=30.0, status="PENDING", occurred=NOW, opened=None, user="u1"):
    return s.Penalty(fid, user, points, occurred, opened if opened is not None else occurred, status)


def test_decay_halves_every_six_months() -> None:
    assert s.decay(NOW, NOW) == 1.0
    assert s.decay(NOW - timedelta(days=s.DAYS_PER_MONTH * 6), NOW) == pytest.approx(0.5)
    assert s.decay(NOW - timedelta(days=s.DAYS_PER_MONTH * 12), NOW) == pytest.approx(0.25)


def test_status_factors() -> None:
    assert s.status_factor("CONFIRMED", NOW, NOW) == 1.0
    assert s.status_factor("DISMISSED", NOW, NOW) == 0.0
    assert s.status_factor("PENDING", NOW, NOW) == s.PENDING_FACTOR


def test_a_pending_case_escalates_after_fourteen_days_and_reaches_full_weight() -> None:
    opened = NOW - timedelta(days=14)
    assert s.status_factor("PENDING", opened, NOW) == pytest.approx(0.35)
    mid = s.status_factor("PENDING", NOW - timedelta(days=21), NOW)
    assert 0.35 < mid < 1.0
    assert s.status_factor("PENDING", NOW - timedelta(days=28), NOW) == pytest.approx(1.0)
    assert s.status_factor("PENDING", NOW - timedelta(days=90), NOW) == pytest.approx(1.0)


def test_a_fresh_pending_penalty_is_points_times_the_pending_factor() -> None:
    snap = s.snapshot([pen(points=20)], NOW)
    assert snap.contributions["f1"] == pytest.approx(7.0, abs=0.01)
    assert snap.value == pytest.approx(93.0, abs=0.01)


def test_a_confirmed_penalty_takes_full_points_and_a_dismissed_one_takes_nothing() -> None:
    assert s.snapshot([pen(status="CONFIRMED", points=10)], NOW).value == pytest.approx(90.0, abs=0.01)
    assert s.snapshot([pen(status="DISMISSED", points=10)], NOW).value == 100.0


def test_an_old_penalty_counts_for_less() -> None:
    fresh = s.snapshot([pen(status="CONFIRMED", points=20)], NOW).value
    old = s.snapshot([pen(status="CONFIRMED", points=20, occurred=NOW - timedelta(days=180))], NOW).value
    assert old > fresh


def test_pending_penalties_are_capped_together_at_fifteen_points() -> None:
    many = [pen(f"f{i}", points=40) for i in range(10)]  # 10 x 14 uncapped
    snap = s.snapshot(many, NOW)
    assert snap.value == pytest.approx(85.0, abs=0.05)
    assert snap.cap_restore > 0


def test_confirmed_penalties_are_not_subject_to_the_pending_cap() -> None:
    snap = s.snapshot([pen(f"f{i}", points=10, status="CONFIRMED") for i in range(4)], NOW)
    assert snap.raw == pytest.approx(60.0, abs=0.01)  # 40 points, well past the pending cap of 15
    assert snap.cap_restore == 0.0


def test_the_score_never_goes_below_zero() -> None:
    snap = s.snapshot([pen(f"f{i}", points=60, status="CONFIRMED") for i in range(5)], NOW, months=1)
    assert snap.raw == 0.0
    assert 0.0 <= snap.value <= 100.0


def test_the_score_cannot_fall_more_than_fifteen_points_in_a_month() -> None:
    hits = [pen(f"f{i}", points=30, status="CONFIRMED", occurred=NOW - timedelta(days=2)) for i in range(3)]
    snap = s.snapshot(hits, NOW)
    assert snap.raw < 85.0
    assert snap.value == pytest.approx(85.0, abs=0.01)
    assert snap.vol_restore == pytest.approx(snap.value - snap.raw, abs=0.01)


def test_a_recovery_is_not_limited() -> None:
    hits = [pen(f"f{i}", points=30, status="CONFIRMED", occurred=NOW - timedelta(days=45)) for i in range(3)]
    dismissed = [s.Penalty(p.finding_id, p.user_id, p.points, p.occurred_at, p.opened_at, "DISMISSED") for p in hits]
    assert s.snapshot(dismissed, NOW).value == 100.0


def test_history_has_one_point_per_month_ending_now() -> None:
    snap = s.snapshot([pen()], NOW, months=6)
    assert len(snap.history) == 6
    assert snap.history[-1][0] == NOW
    assert [h[0] for h in snap.history] == sorted(h[0] for h in snap.history)


def test_a_finding_only_counts_from_the_month_it_happened() -> None:
    snap = s.snapshot([pen(status="CONFIRMED", occurred=NOW - timedelta(days=5))], NOW, months=6)
    assert snap.history[0][1] == 100.0
    assert snap.history[-1][1] < 100.0


# events


def test_first_plan_writes_one_event_per_contributing_finding() -> None:
    snap = s.snapshot([pen("a", 20), pen("b", 10)], NOW)
    events = dict(s.plan_events({}, snap))
    assert events["a"] == pytest.approx(-7.0, abs=0.01)
    assert events["b"] == pytest.approx(-3.5, abs=0.01)


def test_planning_again_after_writing_the_events_writes_nothing() -> None:
    snap = s.snapshot([pen("a", 20), pen("b", 10)], NOW)
    balances: dict[str, float] = {}
    for key, delta in s.plan_events(balances, snap):
        balances[key] = balances.get(key, 0.0) + delta
    assert s.plan_events(balances, snap) == []


def test_the_events_sum_to_the_score() -> None:
    hits = [pen(f"f{i}", points=30, status="CONFIRMED", occurred=NOW - timedelta(days=2)) for i in range(3)]
    snap = s.snapshot(hits, NOW)
    balances: dict[str, float] = {}
    for key, delta in s.plan_events(balances, snap):
        balances[key] = balances.get(key, 0.0) + delta
    assert 100.0 + sum(balances.values()) == pytest.approx(snap.value, abs=0.05)


def test_a_reversal_is_a_new_event_that_returns_the_score_to_where_it_was() -> None:
    before = s.snapshot([pen("a", 20, status="CONFIRMED")], NOW)
    balances: dict[str, float] = {}
    for key, delta in s.plan_events(balances, before):
        balances[key] = balances.get(key, 0.0) + delta
    after = s.snapshot([pen("a", 20, status="DISMISSED")], NOW)
    reversal = s.plan_events(balances, after)
    by_key = dict(reversal)
    assert by_key["a"] == pytest.approx(before.contributions["a"], abs=0.01)
    for key, delta in reversal:
        balances[key] = balances.get(key, 0.0) + delta
    assert 100.0 + sum(balances.values()) == pytest.approx(100.0, abs=0.01)


def test_department_score_is_the_mean_and_category_score_is_amount_weighted() -> None:
    assert s.department_score([100, 90, 80]) == 90.0
    assert s.department_score([]) == 100.0
    assert s.category_score({"a": 100, "b": 50}, {"a": 100, "b": 300}) == pytest.approx(62.5)
    assert s.category_score({"a": 100}, {}) == 100.0
