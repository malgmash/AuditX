"""Perceptual hashing for receipt photos.

A plain perceptual hash of a photographed receipt separates poorly. Receipts share a near-identical
layout, so different receipts land close together, and a slightly rotated photo shifts every line
of text, so two photos of one receipt land far apart. Normalising first fixes both: deskew,
crop to the printed area, stretch the contrast, then hash. The hash is 256 bits (hash size 16)
instead of the 64 in the original design, because at 64 bits about a quarter of all
pairs of different receipts fell within 8 bits of each other. Measured on rendered receipts, hash
size 16 puts photographs of one receipt within 22 bits and different receipts almost always
farther apart. The match threshold is a fraction of the hash length, so it scales with the size.
"""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageOps

HASH_SIZE = 16
_WORK_WIDTH = 256
_ANGLES = np.arange(-7.0, 7.01, 0.5)


def _ink(gray: Image.Image) -> np.ndarray:
    """Dark-on-light content as a float array in 0..1, where 1 is ink."""
    g = ImageOps.autocontrast(gray, cutoff=2)
    a = np.asarray(g, dtype=np.float32) / 255.0
    return 1.0 - a


def _skew_angle(ink: np.ndarray) -> float:
    """The rotation that makes text lines most horizontal: the angle where row sums vary most."""
    img = Image.fromarray((ink * 255).astype(np.uint8))
    best, best_score = 0.0, -1.0
    for angle in _ANGLES:
        rows = np.asarray(img.rotate(float(angle), resample=Image.BILINEAR), dtype=np.float32).sum(axis=1)
        score = float(rows.var())
        if score > best_score:
            best, best_score = float(angle), score
    return best


def normalize(image: Image.Image) -> Image.Image:
    gray = image.convert("L")
    scale = _WORK_WIDTH / gray.width
    gray = gray.resize((_WORK_WIDTH, max(1, int(gray.height * scale))), Image.BILINEAR)
    ink = _ink(gray)
    angle = _skew_angle(ink)
    rotated = Image.fromarray((ink * 255).astype(np.uint8)).rotate(angle, resample=Image.BILINEAR, expand=False)
    arr = np.asarray(rotated, dtype=np.float32)
    mask = arr > 0.35 * arr.max()
    if mask.any():
        ys, xs = np.where(mask)
        rotated = rotated.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    return rotated


def perceptual_hash(image: Image.Image) -> str:
    """256-bit pHash of the normalised image, as 64 hex characters."""
    import imagehash

    return str(imagehash.phash(normalize(image), hash_size=HASH_SIZE))
