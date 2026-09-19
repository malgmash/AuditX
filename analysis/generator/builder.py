"""Shared machinery for adding records, so the honest generators and the injectors write records
the same way. The injectors in fraud.py and near_miss.py use it to add what they plant."""

from __future__ import annotations

import dataclasses
import random
from datetime import date, datetime, timedelta, timezone

from app.detect.merchants import merchant_key
from app.detect.types import EntryRec, ExpenseRec, ReceiptRec, TimesheetRec
from generator.dataset import Dataset, ExpenseRow, ReceiptRow, TimesheetRow
from generator.merchants import Merchant
from generator.profiles import CATEGORY_MEDIAN, CATEGORY_SIGMA, Profile
from generator.receipts import ReceiptFactory, RenderedReceipt, RenderSpec, line_items_for

UTC = timezone.utc

# Categories whose receipts carry a printed time.
TIMED = {"Meals", "Client Entertainment", "Transport"}


def at(day: date, hm: str) -> datetime:
    h, m = hm.split(":")
    return datetime(day.year, day.month, day.day, int(h), int(m), tzinfo=UTC)


def noon(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, 12, 0, tzinfo=UTC)


class Builder:
    def __init__(self, ds: Dataset, factory: ReceiptFactory, rng: random.Random) -> None:
        self.ds = ds
        self.factory = factory
        self.rng = rng
        self.profile_of = {p.user_id: p for p in ds.profiles}
        self.merchant_by_name = {m.name: m for m in ds.merchants}
        self._e = 0
        self._r = 0
        self._t = 0
        self._n = 0
        self.spec_of: dict[str, RenderSpec] = {}  # receipt id -> spec, so a copy can be redrawn
        self.rendered: dict[str, RenderedReceipt] = {}
        self.merchant_of: dict[str, Merchant] = {}  # expense id -> merchant
        self.used: set[str] = set()  # expense ids an injector already took
        self.ts_busy: set[str] = set()  # users whose timesheets an injector rewrote

    # ------------------------------------------------------------------ ids
    def _id(self, prefix: str, n: int, width: int) -> str:
        return f"{prefix}_{n:0{width}d}"

    def next_expense_id(self) -> str:
        self._e += 1
        return self._id("exp", self._e, 5)

    def next_receipt_id(self) -> str:
        self._r += 1
        return self._id("rcp", self._r, 5)

    def next_timesheet_id(self) -> str:
        self._t += 1
        return self._id("ts", self._t, 4)

    def next_entry_id(self) -> str:
        self._n += 1
        return self._id("ent", self._n, 5)

    # ------------------------------------------------------------------ amounts
    def draw_amount(self, p: Profile, category: str, scale: float = 1.0) -> int:
        med = CATEGORY_MEDIAN[category] * p.amount_scale * scale
        cents = int(med * self.rng.lognormvariate(0, CATEGORY_SIGMA[category]))
        cents = max(150, cents)
        if cents >= 10_000 and cents % 5_000 == 0:  # honest amounts are not exactly round
            cents += self.rng.randint(1, 49)
        return cents

    # ------------------------------------------------------------------ receipts
    def add_receipt(self, uploader: str, spec: RenderSpec, pass_seed: int | None = None) -> str:
        r = self.factory.make(spec, pass_seed if pass_seed is not None else self.rng.randrange(1 << 30))
        rid = self.next_receipt_id()
        self.ds.receipts.append(
            ReceiptRow(ReceiptRec(rid, r.sha256, r.phash, uploader), f"receipts/{r.sha256}.jpg", r.mime)
        )
        self.spec_of[rid] = spec
        self.rendered[rid] = r
        return rid

    def add_receipt_copy(self, uploader: str, source_receipt_id: str) -> str:
        """The same file uploaded again: identical bytes, so identical hashes, but a new row."""
        src = self.rendered[source_receipt_id]
        rid = self.next_receipt_id()
        self.ds.receipts.append(
            ReceiptRow(ReceiptRec(rid, src.sha256, src.phash, uploader), f"receipts/{src.sha256}.jpg", src.mime)
        )
        self.spec_of[rid] = self.spec_of[source_receipt_id]
        self.rendered[rid] = src
        return rid

    def add_receipt_rephoto(self, uploader: str, source_receipt_id: str) -> str:
        """The same receipt photographed again: same clean render, a different degradation pass."""
        return self.add_receipt(uploader, self.spec_of[source_receipt_id], self.rng.randrange(1 << 30))

    # ------------------------------------------------------------------ expenses
    def add_expense(
        self,
        user_id: str,
        merchant: Merchant,
        category: str,
        cents: int,
        day: date,
        *,
        time_hm: str | None = None,
        submitted: datetime | None = None,
        merchant_printed: str | None = None,
        receipt_id: str | None = None,
        make_receipt: bool = True,
        style: int | None = None,
        description: str | None = None,
        city: str | None = None,
    ) -> ExpenseRow:
        printed = merchant_printed or (
            f"{merchant.name} #{self.rng.randint(100, 999)}" if merchant.chain and self.rng.random() < 0.6 else merchant.name
        )
        use_city = city if city is not None else merchant.city
        if receipt_id is None and make_receipt:
            spec = RenderSpec(
                printed, use_city, day, time_hm,
                line_items_for(category, cents, self.rng), cents,
                style if style is not None else self.rng.randrange(4), self.rng.randrange(1 << 30),
            )
            receipt_id = self.add_receipt(user_id, spec)
        incurred = at(day, time_hm) if time_hm else noon(day)
        if submitted is None:
            p = self.profile_of[user_id]
            delay = timedelta(days=self.rng.expovariate(1 / max(0.5, p.submit_delay_days)), hours=self.rng.uniform(1, 6))
            submitted = incurred + delay
        rec = ExpenseRec(
            id=self.next_expense_id(), user_id=user_id, submitted_at=submitted, incurred_at=incurred,
            has_time=time_hm is not None, merchant_raw=printed, merchant_key=merchant_key(printed),
            merchant_category=merchant.category, category=category, amount_cents=cents,
            receipt_id=receipt_id, city=use_city,
        )
        extraction = {
            "merchant_name": printed, "merchant_city": use_city,
            "transaction_date": day.isoformat(), "transaction_time": time_hm,
            "total": cents, "field_confidence": {"merchant_name": 0.95, "total": 0.97}, "legibility": 0.9,
        }
        row = ExpenseRow(rec, description or f"{category}: {merchant.name}", extraction, merchant_id=merchant.id)
        self.ds.expenses.append(row)
        self.merchant_of[rec.id] = merchant
        return row

    def expense_row(self, expense_id: str) -> ExpenseRow:
        return next(x for x in self.ds.expenses if x.rec.id == expense_id)

    def receipt_id_of(self, expense_id: str) -> str | None:
        return self.expense_row(expense_id).rec.receipt_id

    # ------------------------------------------------------------------ timesheets
    def add_timesheet(self, user_id: str, monday: date, entries: list[EntryRec], submitted: datetime | None = None) -> TimesheetRec:
        tid = self.next_timesheet_id()
        fixed = tuple(
            EntryRec(e.id, tid, e.user_id, e.work_date, e.start, e.end, e.hours, e.project, e.location, e.note)
            for e in entries
        )
        ts = TimesheetRec(tid, user_id, monday, submitted or at(monday + timedelta(days=4), "18:30"), fixed)
        self.ds.timesheets.append(TimesheetRow(ts))
        return ts

    def make_entry(
        self, user_id: str, day: date, start: datetime, end: datetime, project: str, location: str | None, note: str | None = None
    ) -> EntryRec:
        hours = round((end - start).total_seconds() / 3600, 2)
        return EntryRec(self.next_entry_id(), "", user_id, day, start, end, hours, project, location, note)

    def replace_timesheet(self, old_id: str, entries: list[EntryRec]) -> TimesheetRec:
        row = next(t for t in self.ds.timesheets if t.rec.id == old_id)
        rec = row.rec
        fixed = tuple(
            EntryRec(e.id, rec.id, e.user_id, e.work_date, e.start, e.end, e.hours, e.project, e.location, e.note)
            for e in entries
        )
        row.rec = TimesheetRec(rec.id, rec.user_id, rec.week_start, rec.submitted_at, fixed)
        return row.rec

    # ------------------------------------------------------------------ mutation
    def reprice(self, expense_id: str, new_cents: int) -> None:
        """Change what an expense claims, and redraw its receipt so the image agrees with it. Used
        to inflate honest claims, so the detectors see a real change and not a stale receipt."""
        row = self.expense_row(expense_id)
        old_rid = row.rec.receipt_id
        row.rec = dataclasses.replace(row.rec, amount_cents=new_cents)
        row.extraction = {**row.extraction, "total": new_cents}
        if old_rid is None:
            return
        spec = self.spec_of[old_rid]
        new_spec = dataclasses.replace(
            spec, total_cents=new_cents, items=line_items_for(row.rec.category, new_cents, self.rng)
        )
        r = self.factory.make(new_spec, self.rng.randrange(1 << 30))
        slot = next(i for i, x in enumerate(self.ds.receipts) if x.rec.id == old_rid)
        self.ds.receipts[slot] = ReceiptRow(
            ReceiptRec(old_rid, r.sha256, r.phash, row.rec.user_id), f"receipts/{r.sha256}.jpg", r.mime
        )
        self.spec_of[old_rid] = new_spec
        self.rendered[old_rid] = r

    def timesheet_for(self, user_id: str, day: date):
        """The timesheet row that covers `day`, or None."""
        monday = day - timedelta(days=day.weekday())
        return next((t for t in self.ds.timesheets if t.rec.user_id == user_id and t.rec.week_start == monday), None)

    def entries_on(self, user_id: str, day: date) -> list[EntryRec]:
        row = self.timesheet_for(user_id, day)
        return [e for e in row.rec.entries if e.work_date == day] if row else []

    def set_day(self, user_id: str, day: date, new_entries: list[EntryRec]) -> str:
        """Replace everything logged on `day` with `new_entries`, creating the week if needed.
        Returns the timesheet id."""
        row = self.timesheet_for(user_id, day)
        if row is None:
            return self.add_timesheet(user_id, day - timedelta(days=day.weekday()), new_entries).id
        kept = [e for e in row.rec.entries if e.work_date != day]
        self.replace_timesheet(row.rec.id, kept + new_entries)
        return row.rec.id
