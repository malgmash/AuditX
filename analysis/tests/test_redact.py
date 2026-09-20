"""Redaction. The test SYSTEM-DESIGN.md asks for: a full card number cannot survive.

Redaction runs during normalisation, not at the API boundary, so these cases are the guarantee
for every model call and every indexed chunk at once.
"""

from __future__ import annotations

import pytest

from app.redact import pseudonym, redact, redact_value

CARDS = [
    "4111111111111111",
    "4111 1111 1111 1111",
    "4111-1111-1111-1111",
    "378282246310005",  # 15 digits, Amex
    "3530111333300000",
    "6011111111111117",
]


@pytest.mark.parametrize("card", CARDS)
def test_a_full_card_number_cannot_survive(card: str) -> None:
    out = redact(f"Paid with card {card} at the counter")
    digits = card.replace(" ", "").replace("-", "")
    assert digits not in out
    assert digits[:12] not in out
    assert f"card ending {digits[-4:]}" in out


@pytest.mark.parametrize("card", CARDS)
def test_a_card_number_cannot_survive_inside_evidence(card: str) -> None:
    evidence = {"receipt": {"lines": [f"VISA {card}", "Total 42.00"]}}
    out = redact_value(evidence)
    assert card.replace(" ", "").replace("-", "") not in str(out)


def test_the_last_four_are_kept_because_they_identify_the_card_not_the_person() -> None:
    assert "card ending 1111" in redact("card 4111111111111111")


def test_national_id_is_removed_whole() -> None:
    assert "123-45-6789" not in redact("SSN 123-45-6789 on file")
    assert "national id removed" in redact("SSN 123-45-6789 on file")
    assert "987654321" not in redact("Social Security Number: 987654321")


def test_account_and_routing_numbers_are_stripped() -> None:
    out = redact("Account no. 000123456789, routing 021000021")
    assert "000123456789" not in out
    assert "021000021" not in out


def test_national_id_is_matched_before_the_card_rule_eats_it() -> None:
    # Both patterns can claim the same digits. The formatted national id wins, so the output
    # names what was removed rather than calling it a card.
    assert redact("123-45-6789") == "[national id removed]"


def test_names_become_a_stable_pseudonym() -> None:
    names = {"u1": "Dana Whitfield"}
    out = redact("Dana Whitfield submitted it, and Dana signed", names)
    assert "Dana" not in out
    assert "Whitfield" not in out
    assert out.count(pseudonym("u1")) == 2


def test_the_user_id_is_replaced_too() -> None:
    # Detector evidence identifies people by id. An id a reader can paste into a URL is as
    # identifying as a name.
    out = redact("other_user=cuser000000000000000000002", {"cuser000000000000000000002": "Ray Ng"})
    assert "cuser000000000000000000002" not in out
    assert pseudonym("cuser000000000000000000002") in out


def test_the_same_person_gets_the_same_token_every_time() -> None:
    assert pseudonym("u1") == pseudonym("u1")
    assert pseudonym("u1") != pseudonym("u2")


def test_short_numbers_are_left_alone() -> None:
    # Amounts, dates, hours and four digit years are not card numbers. Over-redaction makes
    # evidence useless, which is its own failure.
    for text in ("Total 42.00", "2026-09-19", "8.5 hours", "Invoice 4821"):
        assert redact(text) == text


def test_dict_keys_are_redacted_as_well_as_values() -> None:
    out = redact_value({"Dana Whitfield": 1}, {"u1": "Dana Whitfield"})
    assert list(out) == [pseudonym("u1")]
