from app.detect.hashing import lookalike_counts


def flip(h: str, bits: int) -> str:
    v = int(h, 16)
    for i in range(bits):
        v ^= 1 << i
    return f"{v:064x}"


def test_a_receipt_with_many_lookalikes_is_generic():
    base = "ab" * 32
    hashes = {f"r{i}": flip(base, i % 4) for i in range(6)}  # six near copies of one look
    hashes["unique"] = "0123456789abcdef" * 4
    counts = lookalike_counts(hashes, 0.10)
    assert counts["r0"] == 5
    assert counts["unique"] == 0


def test_two_copies_of_one_receipt_count_each_other_once():
    h = "f0" * 32
    counts = lookalike_counts({"a": h, "b": flip(h, 3), "c": "0f" * 32}, 0.10)
    assert counts == {"a": 1, "b": 1, "c": 0}


def test_hashes_of_different_lengths_are_compared_only_within_their_length():
    counts = lookalike_counts({"a": "f0" * 8, "b": "f0" * 32}, 0.10)
    assert counts == {"a": 0, "b": 0}
