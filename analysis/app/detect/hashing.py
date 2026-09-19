"""How distinctive a receipt image is.

A perceptual hash identifies a receipt only if few other receipts look like it. A parking ticket
or a one-line subscription receipt looks like hundreds of others, so two of them being close says
nothing about being the same receipt. Counting the lookalikes in the corpus measures this
directly, and a receipt with many is ignored by the image layer.
"""

from __future__ import annotations

import numpy as np

_M1 = np.uint64(0x5555555555555555)
_M2 = np.uint64(0x3333333333333333)
_M4 = np.uint64(0x0F0F0F0F0F0F0F0F)
_H01 = np.uint64(0x0101010101010101)


def _popcount(x: np.ndarray) -> np.ndarray:
    x = x - ((x >> np.uint64(1)) & _M1)
    x = (x & _M2) + ((x >> np.uint64(2)) & _M2)
    x = (x + (x >> np.uint64(4))) & _M4
    return (x * _H01) >> np.uint64(56)


def _words(h: str, n_words: int) -> list[int]:
    v = int(h, 16)
    return [(v >> (64 * i)) & ((1 << 64) - 1) for i in range(n_words)]


def lookalike_counts(hashes: dict[str, str], fraction: float) -> dict[str, int]:
    """For each receipt id, how many other receipts are within `fraction` of the hash bits."""
    out: dict[str, int] = {}
    by_len: dict[int, list[str]] = {}
    for rid, h in hashes.items():
        by_len.setdefault(len(h), []).append(rid)

    for length, ids in by_len.items():
        bits = 4 * length
        n_words = (bits + 63) // 64
        limit = int(fraction * bits)
        arr = np.array([_words(hashes[i], n_words) for i in ids], dtype=np.uint64)
        n = len(ids)
        chunk = max(1, 4_000_000 // max(1, n * n_words))
        for start in range(0, n, chunk):
            block = arr[start : start + chunk]
            dist = np.zeros((len(block), n), dtype=np.uint64)
            for w in range(n_words):
                dist += _popcount(block[:, None, w] ^ arr[None, :, w])
            counts = (dist <= limit).sum(axis=1) - 1  # exclude itself
            for offset, c in enumerate(counts):
                out[ids[start + offset]] = int(c)
    return out
