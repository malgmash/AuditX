"""Receipt rendering and degradation.

Receipts are drawn with Pillow so we control exactly what is on them and can generate duplicates
deliberately. A duplicate is the same clean render put through two different degradation passes,
which is what a re-photographed receipt looks like and what separates an image-hash match from a
file-hash match.

Two modes:
  render     draws real images and hashes them with SHA-256 and app.imaging.perceptual_hash
  synthetic  derives the hashes directly from the receipt content, with the same structure
             (identical file, near image, unrelated image). Fast enough for unit tests.
"""

from __future__ import annotations

import hashlib
import io
import random
from dataclasses import dataclass
from datetime import date
from pathlib import Path

STYLES = 4


@dataclass(frozen=True)
class RenderSpec:
    """Everything needed to redraw a receipt exactly."""

    merchant_printed: str
    city: str | None
    day: date
    time_hm: str | None
    items: tuple[tuple[str, int], ...]  # (description, cents)
    total_cents: int
    style: int
    seed: int


@dataclass(frozen=True)
class RenderedReceipt:
    sha256: str
    phash: str  # 64 hex chars, a 256-bit hash from app.imaging
    mime: str
    data: bytes | None  # None in synthetic mode


def _font(size: int):
    from PIL import ImageFont

    for name in ("consola.ttf", "DejaVuSansMono.ttf", "cour.ttf", "LiberationMono-Regular.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def line_items_for(category: str, total_cents: int, rng: random.Random) -> tuple[tuple[str, int], ...]:
    """Plausible line items that sum to the total, so the printed subtotal and tax are honest."""
    catalogue = {
        "Meals": ["House salad", "Chicken sandwich", "Soup of the day", "Iced tea", "Cobb salad", "Burrito bowl", "Espresso"],
        "Client Entertainment": ["Ribeye 12oz", "Wine pairing", "Shared appetizer", "Sparkling water", "Dessert flight", "Salmon entree"],
        "Transport": ["Fare", "Tip", "Booking fee"],
        "Equipment": ["Wireless keyboard", "USB-C hub", "Monitor arm", "Webcam"],
        "Software": ["Monthly subscription"],
        "Supplies": ["Printer paper", "Toner cartridge", "Notebooks", "Markers", "Binder clips"],
        "Training": ["Registration"],
        "Travel": ["Airfare", "Seat selection", "Bag fee"],
        "Lodging": ["Room charge", "Resort fee", "Parking"],
        "Other": ["Service fee", "Handling"],
    }
    names = catalogue.get(category, ["Item"])
    n = min(len(names), max(1, rng.randint(1, 3)))
    picks = rng.sample(names, n)
    if n == 1:
        return ((picks[0], total_cents),)
    weights = [rng.random() + 0.5 for _ in picks]
    total_w = sum(weights)
    cents = [int(total_cents * w / total_w) for w in weights]
    cents[-1] += total_cents - sum(cents)
    return tuple(zip(picks, cents))


def _money(cents: int) -> str:
    return f"{cents // 100:,}.{cents % 100:02d}"


def _clean_render(spec: RenderSpec):
    from PIL import Image, ImageDraw

    rng = random.Random(spec.seed)
    width = (440, 480, 520, 460)[spec.style % STYLES]
    lines: list[tuple[str, str]] = []
    lines.append(("center", spec.merchant_printed.upper() if spec.style % 2 else spec.merchant_printed))
    if spec.city:
        lines.append(("center", f"{spec.city}, USA"))
    lines.append(("center", f"Store {rng.randint(100, 999)}   Reg {rng.randint(1, 9)}"))
    lines.append(("center", ""))
    stamp = spec.day.strftime("%m/%d/%Y") + (f"  {spec.time_hm}" if spec.time_hm else "")
    lines.append(("left", stamp))
    lines.append(("left", f"Order #{rng.randint(1000, 99999)}"))
    lines.append(("center", "-" * 30))
    for desc, cents in spec.items:
        lines.append(("row", f"{desc[:22]}|{_money(cents)}"))
    subtotal = sum(c for _, c in spec.items)
    lines.append(("center", "-" * 30))
    lines.append(("row", f"Subtotal|{_money(subtotal)}"))
    lines.append(("row", f"TOTAL|{_money(spec.total_cents)}"))
    lines.append(("center", ""))
    lines.append(("center", f"VISA ****{rng.randint(1000, 9999)}"))
    lines.append(("center", "Thank you"))

    font = _font(17 + (spec.style % 3))
    lead = 26 + (spec.style % 2) * 3
    height = 40 + lead * len(lines) + 30
    img = Image.new("RGB", (width, height), (252, 250, 245))
    draw = ImageDraw.Draw(img)
    y = 24
    for kind, text in lines:
        if kind == "row":
            left, right = text.split("|")
            draw.text((24, y), left, fill=(30, 30, 30), font=font)
            w = draw.textlength(right, font=font)
            draw.text((width - 24 - w, y), right, fill=(30, 30, 30), font=font)
        elif kind == "center":
            w = draw.textlength(text, font=font)
            draw.text(((width - w) / 2, y), text, fill=(30, 30, 30), font=font)
        else:
            draw.text((24, y), text, fill=(30, 30, 30), font=font)
        y += lead
    return img


def _degrade(img, rng: random.Random):
    """Slight rotation, brightness and contrast jitter, an occasional partial crop and a paper
    texture, as a phone photo of a receipt would show."""
    from PIL import Image, ImageEnhance

    img = img.rotate(rng.uniform(-3.0, 3.0), expand=True, fillcolor=(236, 233, 226), resample=Image.BICUBIC)
    img = ImageEnhance.Brightness(img).enhance(rng.uniform(0.92, 1.06))
    img = ImageEnhance.Contrast(img).enhance(rng.uniform(0.9, 1.08))
    if rng.random() < 0.12:
        w, h = img.size
        dx, dy = int(w * rng.uniform(0.0, 0.03)), int(h * rng.uniform(0.0, 0.03))
        img = img.crop((dx, dy, w - dx, h - dy))
    noise = Image.effect_noise(img.size, rng.uniform(4, 9)).convert("RGB")
    return Image.blend(img, noise, 0.04)


def _phash_hex(data: bytes) -> str:
    """Hash the decoded file, as the upload path would, not the in-memory image."""
    from PIL import Image

    from app.imaging import perceptual_hash

    return perceptual_hash(Image.open(io.BytesIO(data)))


def render(spec: RenderSpec, pass_seed: int) -> RenderedReceipt:
    """Draw the receipt and apply one degradation pass. Two passes over one spec give a
    re-photographed copy: different bytes, near-identical perceptual hash."""
    rng = random.Random(pass_seed)
    img = _degrade(_clean_render(spec), rng)
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=rng.randint(60, 85))
    data = buf.getvalue()
    return RenderedReceipt(hashlib.sha256(data).hexdigest(), _phash_hex(data), "image/jpeg", data)


def render_exact_copy(original: RenderedReceipt) -> RenderedReceipt:
    """The same file resubmitted. Identical bytes, identical hashes."""
    return original


def synthetic(spec: RenderSpec, pass_seed: int) -> RenderedReceipt:
    """Hashes with the same structure as real ones, derived from content instead of pixels."""
    content = repr((spec.merchant_printed, spec.city, spec.day, spec.time_hm, spec.items, spec.total_cents, spec.style, spec.seed))
    base = int.from_bytes(hashlib.blake2b(content.encode(), digest_size=32).digest(), "big")
    rng = random.Random(pass_seed)
    v = base
    for bit in rng.sample(range(256), rng.randint(2, 12)):  # a re-photo moves a few bits
        v ^= 1 << bit
    sha = hashlib.sha256(f"{content}|{pass_seed}".encode()).hexdigest()
    return RenderedReceipt(sha, f"{v:064x}", "image/jpeg", None)


class ReceiptFactory:
    def __init__(self, mode: str = "synthetic", out_dir: Path | None = None) -> None:
        if mode not in ("render", "synthetic"):
            raise ValueError("mode must be render or synthetic")
        self.mode = mode
        self.out_dir = out_dir
        if out_dir is not None and mode == "render":
            out_dir.mkdir(parents=True, exist_ok=True)

    def make(self, spec: RenderSpec, pass_seed: int) -> RenderedReceipt:
        r = render(spec, pass_seed) if self.mode == "render" else synthetic(spec, pass_seed)
        if self.mode == "render" and self.out_dir is not None and r.data is not None:
            (self.out_dir / f"{r.sha256}.jpg").write_bytes(r.data)
        return r
