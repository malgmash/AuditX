"""Generate a company and, optionally, plant problems in it.

    python -m generator.seed --employees 45 --months 6 --inject-fraud --seed 42

Always pass --seed. A reproducible dataset means a reproducible demo, and a failing detector test
is then a real failure and not yesterday's random draw.

Writes data/<run-id>/dataset.pkl and ground_truth.jsonl. With --receipts render it also draws
every receipt image into data/<run-id>/receipts/. With --db it loads the dataset into Postgres.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from generator.build import generate


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Generate the AuditX synthetic dataset")
    ap.add_argument("--employees", type=int, default=45)
    ap.add_argument("--months", type=int, default=6)
    ap.add_argument("--inject-fraud", action="store_true", help="plant problems and near-misses")
    ap.add_argument("--seed", type=int, required=True)
    ap.add_argument("--receipts", choices=["render", "synthetic"], default="render",
                    help="render draws real images and hashes them; synthetic derives hashes without pixels")
    ap.add_argument("--run-id", default=None)
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--db", action="store_true", help="also load the dataset into Postgres (DATABASE_URL)")
    args = ap.parse_args(argv)

    run_id = args.run_id or f"seed{args.seed}"
    out = Path(args.data_dir) / run_id
    t0 = time.time()
    ds = generate(
        args.employees, args.months, args.seed, inject=args.inject_fraud,
        receipt_mode=args.receipts, receipt_dir=out / "receipts" if args.receipts == "render" else None,
    )
    ds.save(out)
    positives = sum(1 for t in ds.ground_truth if t.expected)
    print(
        f"run {run_id}: {len(ds.profiles)} employees, {len(ds.expenses)} expenses, {len(ds.receipts)} receipts, "
        f"{len(ds.timesheets)} timesheets, {positives} injected problems, "
        f"{len(ds.ground_truth) - positives} near-misses in {time.time() - t0:.0f}s -> {out}"
    )
    if args.db:
        from generator.dbload import load

        load(ds)
        print("loaded into the database")
    return 0


if __name__ == "__main__":
    sys.exit(main())
