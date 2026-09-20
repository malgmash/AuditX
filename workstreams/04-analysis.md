# Stream 4: analysis (scoring, cases, holds, extraction, investigator)

Branch `stream/analysis`. Shared rules and contracts: [WORKSTREAMS.md](../WORKSTREAMS.md). Design: [SYSTEM-DESIGN.md](../SYSTEM-DESIGN.md) sections Scoring, Cases holds and reversal, and Retrieval.

## Scope

The Python service that turns submitted data into findings, scores, cases and holds. The detectors, severity, baselines, the synthetic generator and the evaluation are already built and measured (see [analysis/README.md](../analysis/README.md)). What is left is everything that makes the admin and employee screens show real numbers: the scoring engine, case and hold creation, receipt extraction, the investigator brief, and retrieval.

**Owns:** `analysis/**`. Nothing under `web/`. If the schema needs a change, write it under **Needs from others** and tell the user, because `web/prisma/schema.prisma` belongs to `auth` and is frozen.

**Depends on:** the database on hosted Supabase (see the Environment section of WORKSTREAMS.md), already loaded with the `seed42` data.

**Delivers to others:** rows in `Finding`, `Case`, `Hold`, `Score`, `ScoreEvent`, `Notification`, and the `/internal/*` endpoints. `admin` and `employee` read those rows and call the endpoints from the server only. They start on fixtures and swap to these in their last section, so nobody is blocked by this stream, but the demo needs it.

## Rules specific to this stream

- Detectors stay pure functions with no database writes. Only `app/repo.py` touches Postgres.
- Never wipe or reload the shared database. Test on a local copy or inside a transaction you roll back. Do not run the generator with `--db` against Supabase.
- `ScoreEvent` and `AuditLog` are append-only. A reversal is a new row.
- The score ranks and never acts. No automatic consequence from a score.
- Models produce text, never a decision or a score. `NIM_API_KEY` and `NIM_BASE_URL` are in `analysis/.env`. The nemotron models are reasoning models, so set a generous `max_tokens`. Every model call needs a timeout and a fallback that returns something usable, so a slow API never breaks the demo.
- `app/models.py` is generated from the Prisma schema. Never edit it. Regenerate with `python scripts/gen_models.py`.
- Tests run with `analysis/.venv/Scripts/python -m pytest`. Keep them passing.

## Progress

| # | Section | Status |
|---|---|---|
| 1 | Detectors, severity, baselines, generator, evaluation | DONE |
| 2 | Scoring engine and score events | TODO |
| 3 | Cases and holds from findings, with notifications | TODO |
| 4 | Endpoints wired for the web app | TODO |
| 5 | Receipt extraction | TODO |
| 6 | Investigator brief | TODO |
| 7 | Retrieval and question answering (Tier 2 and 3) | TODO |

Status values: TODO, IN PROGRESS, DONE.

---

## Section 1. Detectors, severity, baselines, generator, evaluation

Built. 44 tests pass. Hold precision 0.95 and recall 0.97 on seed 42, 1.00 and 0.95 on seed 7, all 8 near-misses passed. Decisions and spec deviations are in [DESIGN-DECISIONS.md](../DESIGN-DECISIONS.md).

**Done when**
- [x] Three detectors with 16 rules, severity, baselines
- [x] Synthetic company with planted problems and near-misses, and an evaluate script
- [x] `/internal/detect` and `/internal/recompute` written and run against the database (131 findings)

## Section 2. Scoring engine and score events

> Implement the scoring formulas from the Scoring section of SYSTEM-DESIGN.md in `analysis/app/scoring.py` as pure functions: `penalty = base_points x confidence x status_factor x decay(age)`, pending cases at 0.35 escalating toward 1.00 over 14 days after they turn 14 days old and capped at 15 points per employee, the 15-point monthly downward cap, employee score as 100 minus the penalties clamped to 0 to 100, department score headcount-weighted, category score amount-weighted.
>
> Persist a `ScoreEvent` for every contributing penalty and update the `Score` row. Recompute must be idempotent: running it twice adds no duplicate events. Add unit tests for each formula, including decay, the pending escalation, both caps, and a dismissed finding contributing nothing.

**Done when**
- [ ] Formulas match SYSTEM-DESIGN.md and each has a unit test
- [ ] Every contributing penalty has a `ScoreEvent`, and an employee's score equals 100 minus the sum of their current events
- [ ] Running recompute twice changes nothing the second time
- [ ] A dismissed finding contributes zero and a reversal restores the points with a new row

## Section 3. Cases and holds from findings, with notifications

> From each stored finding, apply the severity result. `IMMEDIATE_HOLD` places a `Hold` on the expense and opens a `Case`. `CASE` opens a `Case`. `NOTE` only records. Write a `Notification` row for every admin on a hold or new case, in the `Notification` table directly, using the kinds in WORKSTREAMS.md. Cases carry the amount at risk so the admin queue can sort by it.
>
> Provide the functions the web app's decide and reverse routes will call, or document the exact rows they must write: accept keeps the hold and confirms the penalty, decline releases the hold and removes the penalty and stores the finding as a label, reversal sets `Hold.releasedAt` and writes a `ScoreEvent`, an `AuditLog` row and a notification to the employee.

**Done when**
- [ ] Recompute on seed42 produces holds only for immediate-hold findings, and cases and notes for the rest
- [ ] No hold exists without a case, and a hold never attaches to a finding that names no expense
- [ ] Notifications are written for admins on hold and new case
- [ ] Decide and reverse behaviour is covered by tests

## Section 4. Endpoints wired for the web app

> Make `POST /internal/detect` run after each submission: detect, persist findings, create cases and holds, update scores, all in one call that the web upload route can make. `POST /internal/recompute` rebuilds everything. Both require `X-Internal-Token`. Add `GET /health`. Keep responses small and stable, and document them in `analysis/README.md`.

**Done when**
- [ ] One call after a new submission produces its finding, case, hold, score change and notification
- [ ] Responses documented, and an unreachable service leaves the web app working on its own fields

## Section 5. Receipt extraction

> `POST /internal/extract`: receipt image in, structured fields out (merchant, total in integer cents, date, time if printed, line items) with a confidence per field, using the extraction model in the PRD through the hosted NIM API. Keep a mock provider behind the same interface that returns the fixture fields, and select with an env var. Degraded or unreadable receipts must return low confidence and never crash.

**Done when**
- [ ] Mock provider works with no network
- [ ] Real provider returns correct merchant and total on 8 of 10 fixture receipts, and degraded ones do not crash
- [ ] A timeout falls back to the mock

## Section 6. Investigator brief

> `POST /internal/investigate`: finding in, brief out. Neutral tone, the evidence, recommended review steps, neutral questions to ask, and at least two plausible innocent explanations. The model writes the wording only. Never a verdict and never a score. Fall back to a template brief built from the rule description in `app/detect/rules.py` when the model is unreachable.

**Done when**
- [ ] Every brief contains the evidence, steps, questions and two innocent explanations
- [ ] No brief uses the banned wording in WORKSTREAMS.md rule 8
- [ ] The template fallback works with no network

## Section 7. Retrieval and question answering (Tier 2 and 3)

> Implement the Retrieval section of SYSTEM-DESIGN.md: index the rule descriptions, embed the question, retrieve the top four chunks above a minimum similarity, and answer from them with sources supplied by the service and not written by the model. `POST /internal/ask` for Tier 2. `POST /internal/policy/ingest` for Tier 3 is optional. If nothing clears the threshold, the answer says the material does not cover it.

**Done when**
- [ ] Answers cite rule sources, and an out-of-scope question gets the "not covered" answer
- [ ] An employee asking about a finding that is not theirs is refused by the web route, not this service

---

## Needs from others

_None yet._

## Progress log

_Newest first. Each entry: date, what changed, what is next, blockers._

- 2026-09-19: Stream file created from the work already done. Section 1 is built and pushed. Next: section 2, the scoring engine, because both dashboards depend on it.
