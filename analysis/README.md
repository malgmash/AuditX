# AuditX analysis service

Python 3.11 or newer. Owns the three detectors, severity, baselines, the synthetic data generator and the evaluation. Extraction, scoring, cases and the investigator are not built yet.

Detectors are pure functions of a `DetectionContext`. They never touch the database, so each one is unit-tested against a fixture. `app/repo.py` is the only place they meet Postgres.

## Setup

```bash
cd analysis
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS, Linux
```

## Tests

```bash
python -m pytest -q
```

43 tests. Each rule has a case it must fire on and, where the PRD names one, the near-miss it must not fire on.

## Measure the detectors

```bash
# Real rendered receipt images and real perceptual hashes. About four minutes.
python -m generator.seed --employees 45 --months 6 --inject-fraud --seed 42 --receipts render
python -m generator.evaluate --run-id seed42 --verbose

# Fast: derives hashes without drawing pixels. Optimistic for the image layer, fine for the rest.
python -m generator.seed --employees 45 --months 6 --inject-fraud --seed 7 --receipts synthetic --run-id synth7
python -m generator.evaluate --run-id synth7
```

Always pass `--seed`. `evaluate` prints per-rule precision and recall against `ground_truth.jsonl`, the precision on holds, overall recall, and the near-miss table. Run it before tuning anything.

Precision is given three ways because they answer different questions: every finding, actionable findings (case or hold), and holds only. The hold figure is the one the product depends on.

## Where it stands

Targets from the PRD: precision on holds above 0.90, overall recall above 0.70, every near-miss passing.

| Run | Findings | Precision, holds | Precision, actionable | Recall | Near-misses |
|---|---|---|---|---|---|
| **seed 42, real images** | 131 | 0.95 (20 of 21) | 0.91 | 0.97 | 8 of 8 |
| **seed 7, real images** | 111 | 1.00 | 0.98 | 0.95 | 8 of 8 |
| seed 42, fast | 130 | 1.00 | 0.92 | 1.00 | 8 of 8 |
| seed 7, fast | 111 | 1.00 | 0.98 | 1.00 | 8 of 8 |
| seed 99, fast | 108 | 1.00 | 0.99 | 1.00 | 8 of 8 |
| seed 123, fast | 135 | 1.00 | 0.99 | 1.00 | 8 of 8 |
| seed 2024, fast | 124 | 0.96 | 0.91 | 1.00 | 8 of 8 |

Read these with care.

- The data is synthetic and written by the same people as the detectors. Thresholds were tuned on seed 42 and checked on the other seeds, but a real company will look different.
- Real images are the honest measure for the image layer. Fast mode gives unrelated receipts unrelated hashes, which flatters it.
- On real images only five or six of the eight re-photographed receipts reach a hold. The rest look too much like other receipts to identify by image, so the field layer catches them and opens a case instead. That is by design. See decision 11 in DESIGN-DECISIONS.md.
- The one false hold on seed 42 is two colleagues at the same steakhouse on the same night with amounts $1.73 apart and receipts 18 bits apart. A reviewer would look at it too. It was created by chance in the honest data.
- Amount-outlier rules produce most of the remaining false positives. Most are notes and never reach the queue.

## Endpoints

All `/internal/*` calls need the `X-Internal-Token` header (`INTERNAL_TOKEN`, default `dev-internal-token`) and are meant for the web service only.

| Call | What it does |
|---|---|
| `GET /health` | `{"status": "ok"}` |
| `POST /internal/detect` | One call after a submission. Runs the detectors, stores new findings, opens a case for each finding at CASE or above, places a hold for each immediate hold, notifies the administrators and rescores. Returns counts. |
| `POST /internal/recompute` | Rebuilds baselines, re-runs the detectors, opens missing cases and holds, rescores everyone. Does not notify. Idempotent. |
| `POST /internal/cases/{id}/decide` | Body `{decision: "ACCEPT" or "DECLINE", admin_id, note}`. Accept keeps the hold and confirms the penalty. Decline releases the hold and removes the penalty. Both write an AuditLog row, notify the employee and rescore. Returns `score_before` and `score_after`. `409` if the case is missing or already decided. |
| `POST /internal/holds/{id}/reverse` | Body `{admin_id, note}`. Sets `Hold.releasedAt`, restores the points with a new ScoreEvent, writes an AuditLog row, notifies the employee and closes the case as declined. `409` if the hold is missing or already released. |
| `POST /internal/ask`, `/internal/policy/ingest`, `/internal/knowledge/reindex` | Retrieval (Tier 2 and 3). Need the pgvector extension and `python -m app.retrieval.schema` first. |

The admin id always comes from the session in the web service. `is_self_review` is stamped on the AuditLog row when it equals the case's subject.

## Scoring

`app/scoring.py` holds the formulas as pure functions and `app/workflow.py` writes the results. A score is 100 minus the penalties, where `penalty = points x status_factor x decay(age)`. Pending cases hold back 0.35 of the points, rising to 1.0 over the 14 days after they turn 14 days old, capped at 15 points in total. A score falls by at most 15 points in a month. The score ranks and never acts. Scores are stored as append-only `ScoreEvent` rows whose sum is the score, so a reversal is a new row.

`PYTHONPATH=. python scripts/verify_workflow.py` runs the whole workflow on the loaded data inside a transaction, prints what it did, and rolls everything back.

## Load a database

The shared database is hosted Supabase and is already loaded, so you normally skip this. Do not re-run the loader against it. See the Environment section of WORKSTREAMS.md. To build a separate local copy instead, this needs Docker for Postgres. From the repo root:

```bash
docker compose up -d
cd web && npm run db:push                      # create tables from the Prisma schema
cd ../analysis
python -m generator.seed --seed 42 --inject-fraud --db
python scripts/upload_receipts.py seed42       # images to MinIO
cd ../web && npm run db:seed                   # real passwords for the two demo logins
uvicorn app.main:app --port 8000               # from analysis/, then POST /internal/recompute
```

`/internal/recompute` needs the `X-Internal-Token` header (`INTERNAL_TOKEN`, default `dev-internal-token`). It rebuilds baselines and runs every detector. Running it twice inserts nothing new: stored findings are immutable.

## Layout

```
app/
  detect/           the three detectors and what they share
    duplicates.py   exact file, image, fields, cross-user
    abnormal.py     self and peer outliers, velocity, category mismatch, round amount, off-pattern
    timesheets.py   location conflict, overlap, impossible hours, copy-paste, round hours, holiday
    severity.py     the two-axis matrix and its two additions
    rules.py        the rule registry: ids, base confidence, points, plain descriptions
    recurring.py    recurring charges, kept out of baselines and the duplicate rule
    hashing.py      how distinctive a receipt image is
    baselines.py    median and MAD snapshots for the Baseline table
    runner.py       run all three and assign severity
  imaging.py        deskew, crop and 256-bit perceptual hash of a receipt photo
  models.py         GENERATED from web/prisma/schema.prisma. Do not edit
  repo.py           database rows in, findings out
  main.py           FastAPI: /health, /internal/detect, /internal/recompute
generator/
  fraud.py          the planted problems, one function per scenario
  near_miss.py      the innocent lookalikes, kept apart on purpose
  evaluate.py       precision and recall against ground truth
  seed.py           command line entry point
scripts/
  gen_models.py     regenerate app/models.py after a schema change
```

After any change to `web/prisma/schema.prisma`, run `python scripts/gen_models.py`.

## Things to know

- Rule descriptions live in `app/detect/rules.py` and nowhere else. The retrieval index and the briefs are meant to read from it.
- Every threshold is in `DetectorConfig` in `app/detect/types.py`.
- `app/detect/geo.py` matches cities by string, which is enough for the seeded data and fails on real addresses. Swap it for a geocoder when real data arrives.
- Findings are identified by rule and record ids, because the `Finding` table is frozen and has no dedupe column.
