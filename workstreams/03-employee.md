# Stream 3: employee (user dashboard)

Branch `stream/employee`. Shared rules and contracts: [WORKSTREAMS.md](../WORKSTREAMS.md).

## Scope

The employee is the person the system makes judgements about, so their view is a requirement rather than a courtesy. Submission must be fast enough that nobody avoids it (three minutes), and the employee must always be able to see their own score, their own findings, and the plain reason for anything held.

**Owns:** `web/src/app/(employee)/**`, `web/src/app/api/employee/**`, `web/src/components/employee/**`, `web/src/lib/employee/**`, `web/src/contracts/employee.ts`, `web/src/fixtures/employee/**`

**Depends on:** `auth` section 1 for `requireUser` and `createNotification`. Those are on `main`, so no local stub. `NotificationBell` is not on `main` yet; section 2 will leave a header slot until auth delivers it.

**Delivers to others:** nothing directly.

## Decisions made for you

The PRD leaves two questions open. Defaults so you are not blocked, both behind a flag in `web/src/lib/employee/config.ts` so the team can flip them:

- `SHOW_SCORE_NUMBER = true`. The PRD requires the employee to see their score, and hiding it is the thing to avoid.
- `SHOW_DECLINED_FINDINGS = true`, shown as "Reviewed, no action taken" rather than as a flag. Transparency about the record wins, and the wording keeps it from reading as an accusation.

## Progress

| # | Section | Status |
|---|---|---|
| 1 | Contracts and fixtures | DONE |
| 2 | Shell and own-record overview | DONE |
| 3 | Expense submission | DONE |
| 4 | Timesheet submission | DONE |
| 5 | My submissions | DONE |
| 6 | My findings and reasons | DONE |
| 7 | Real data and live updates | IN PROGRESS |
| 8 | Ask why it was flagged, with retrieval (Tier 2) | REMOVED |

Status values: TODO, IN PROGRESS, DONE.

---

## Section 1. Contracts and fixtures

> Define the TypeScript types in `web/src/contracts/employee.ts` for everything the employee UI reads and writes: own expense (with status SUBMITTED, APPROVED, HELD, DECLINED, REIMBURSED and extraction with per-field confidence), own timesheet with entries, own score with six-month history, own finding with plain-language reason, and any current hold with its reason.
>
> Define a repository interface in `web/src/lib/employee/repo.ts` and implement it over fixtures in `web/src/fixtures/employee/`, selected by `AUDITX_DATA`. Every method takes the acting user id, so the `db` implementation can filter by it at the query layer.
>
> Fixtures: three employees. One clean record, one with a held duplicate receipt, one with a legitimate remote-work day in another city (must show no finding). Plain-language reasons written for someone with no finance background, never the words fraud, theft, guilty.

**Done when**
- [x] Types compile under strict mode with no `any`
- [x] Repository interface and fixture implementation exist; every method scoped by user id
- [x] Fixtures cover the three cases above
- [x] A test checks no fixture reason contains a forbidden word

## Section 2. Shell and own-record overview

> Build the employee layout and `/employee`: header with the notification bell slot (mount `NotificationBell` when `auth` delivers it), then the overview. Show the score (per `SHOW_SCORE_NUMBER`), a six-month Recharts sparkline, and anything currently held with the reason in plain language. Employees find out from the product, not from an awkward conversation later.
>
> A held expense reads like "This reimbursement is paused while a reviewer looks at it. Here is why." with the reason and what happens next. It never says or implies the employee did something wrong.

**Done when**
- [x] Overview shows score, sparkline and held items from fixtures
- [x] A held expense shows a plain reason and a next step
- [x] A clean employee sees a calm empty state, not a blank page

## Section 3. Expense submission

> Build `/employee/expenses/new`: merchant, date incurred, category, amount, description, and a receipt image upload with drag and drop and live preview. Amount is entered in dollars and converted to integer cents at the edge.
>
> On upload, call extraction and **prefill** merchant, date and total so the employee corrects rather than types. Mark low-confidence fields so they are easy to check. Record which fields the employee changed, since correction data is a free accuracy signal.
>
> `POST /api/employee/expenses` (multipart): validate with zod, guard with `requireUser`, store the file to object storage, compute SHA-256, write the `Expense` and `Receipt` rows for the acting user, and call the analysis service. Put extraction and perceptual hashing behind a provider interface. The mock returns fields from the fixture and a deterministic placeholder hash. If the service is unreachable, fall back to the employee's own entered fields and continue.
>
> A submit takes three minutes or less end to end.

**Done when**
- [x] Expense with an image submits and appears in the employee's own list
- [x] Extraction prefills fields; edited fields are recorded
- [x] Service unreachable: submission still succeeds with entered fields
- [x] Amount stored as integer cents; a test covers `$12.34`, `$0.10` and `$1,000.00`
- [x] Employee cannot submit on behalf of another user id (test)

## Section 4. Timesheet submission

> Build `/employee/timesheets/new`: a weekly grid, one row per day, with start time, end time, computed hours, project and location. Location is a select of the office locations plus "remote" plus a free-text city. The declared location must be captured honestly and clearly, because the location-conflict rule reads it. Total hours shown live.
>
> `POST /api/employee/timesheets` writes one `Timesheet` and its `TimesheetEntry` rows for the acting user. Validate that end is after start, hours match the times to two decimals, and the week starts on the expected day.

**Done when**
- [x] A week can be submitted and appears in the employee's own list
- [x] Hours compute from times; total updates live
- [x] Location choice, including remote and a free-text city, is saved per day
- [x] Invalid times are rejected with clear messages

## Section 5. My submissions

> Build `/employee/submissions`: own expenses and timesheets with status, newest first, filterable by type and status. A detail page per item shows the receipt image and fields, or the timesheet grid, and its status history.
>
> Filtering by the session user id happens in the repository query, never in the UI. Requesting another user's item by id returns 404, not 403, so ids cannot be probed.

**Done when**
- [x] Both lists show only the acting user's items
- [x] Editing another user's id in the URL returns 404 (test)
- [x] Detail page shows receipt and extracted fields, or the timesheet grid

## Section 6. My findings and reasons

> Build `/employee/record`: every finding against them, each with the plain-language reason, the amount, the date, and its current status (pending review, reviewed and no action taken, or confirmed), plus the score history and what changed the score. Use the `ScoreEvent` list so "why did my score change" is answerable without recomputation.
>
> Reasons are written for someone with no finance training. A duplicate becomes "This receipt looks the same as one submitted on 3 March." A location pattern becomes "Your timesheet says Pittsburgh office on Tuesday, and a receipt that day is from Chicago." Then, always, what the employee can do: reply to the reviewer's question or correct the location.

**Done when**
- [x] Every finding shows reason, amount, date and status
- [x] Score history lists each change with its reason
- [x] The remote-work fixture shows no finding
- [x] No user-facing text contains a forbidden word, checked by a test across all reason templates

## Section 7. Real data and live updates

> Add the `db` implementation of the repository with Prisma, every query filtered by the acting user id, and switch `AUDITX_DATA` default to `db`. Keep `fixtures` working for offline demos.
>
> Mount `NotificationBell` for real. When an admin reverses a hold, the employee's dashboard updates and the "held" banner clears without a refresh.

**Done when**
- [ ] Every screen works on both `fixtures` and `db`
- [ ] Held banner clears live after a reversal
- [ ] The demo path (submit a receipt, see it clear or hold) runs with the network unplugged
- [ ] Temporary stubs for `requireUser` and `createNotification` are deleted

## Section 8. Ask why it was flagged, with retrieval (Tier 2)

> REMOVED FROM SCOPE 2026-09-20. Do not build this. The decision was made on 2026-09-20 to cut Tier 2 from the demo. The plain-language reason on each finding stays.

Build only if sections 1 to 7 are stable. Background: the Retrieval section of SYSTEM-DESIGN.md and the `AskProvider` contract in WORKSTREAMS.md.

> On each finding in `/employee/record`, add an "Ask about this finding" panel following the grounded answers pattern in DESIGN.md. It is a single question box, not a chat: one question, one answer, no history, no avatar, no typing indicator. Cap the question at 500 characters.
>
> Create `web/src/lib/employee/ask.ts` with an `AskProvider` using the types in `web/src/contracts/shared.ts`. The fixture implementation returns fixed, plain answers with sources for the demo findings, and a "the available material does not cover this" answer for anything else. The real implementation calls `POST /internal/ask` through the route below.
>
> `POST /api/employee/findings/[id]/ask`: validate the body with zod, guard with `requireUser`, and load the finding filtered by the acting user id. If it is not theirs, return 404 before doing anything else. Never accept an asker role or user id from the body. Rate limit per user.
>
> Show the answer in prose with the sources listed beneath it as mono labels ("Rule TS_LOCATION_CONFLICT", "Travel policy, section 2"). When the response is marked `fallback`, say the answer was prepared without the assistant and show the finding's stored reason. Never present the answer as a decision: end every answer area with a fixed line that a reviewer makes the decision and shows the current case status.

**Done when**
- [ ] A question returns a two-to-three sentence answer with its sources listed
- [ ] A question the material does not cover returns the plain "not covered" answer with no sources
- [ ] Asking about another user's finding returns 404 (test)
- [ ] With the service unreachable, the fallback answer appears and is labelled
- [ ] The answer area never contains a forbidden word, checked by a test over the fixture answers

---

## Needs from others

- auth: `NotificationBell` at `web/src/components/notifications/NotificationBell.tsx` for the employee header in section 2. Slot is ready to mount; do not block the overview on it.

## Progress log

_Newest first. Each entry: date, what changed, what is next, blockers._

- 2026-09-20: Section 8 (ask why it was flagged) removed from scope. The reason and next step on each finding remain.
- 2026-09-20: Merged `origin/main`, which already carries the `db` repository from `stream/employee-db`, so section 7 is part built and is now IN PROGRESS. The code merged cleanly; only this file conflicted, and both progress logs are kept. Reviewed `db-repo.ts` against the section 5 and 6 screens: hours arrive as two-decimal strings and the statuses and shapes line up, but `statusHistory` on the `db` path holds only the current status, and a generator-seeded receipt has a row with no retrievable bytes, so the expense detail page now says the image is not available to view rather than claiming none was attached. The forbidden-word test now also covers `ruleCopy` for all sixteen rules at every severity. Still open for section 7: verify every screen on `db`, clear the held banner live after a reversal, and delete the temporary stubs.
- 2026-09-20: Section 6 done. `/employee/record` lists every finding newest first with its plain reason, the amount, the date of the expense, the date it was flagged, its review status and the rule id, and links to the submission it concerns. "Why your score changed" lists each `ScoreEvent` with its reason and shows a zero delta as "No change"; the six-month sparkline sits below it. A reviewed finding reads "Reviewed, no action taken" and disappears if `SHOW_DECLINED_FINDINGS` is turned off. Forbidden words are now checked against the fixture copy and every status and severity label. Next: section 7 real data and live updates, which needs the `db` repository. Auth still needs `NotificationBell`.
- 2026-09-20: Section 5 done. `/employee/submissions` lists expenses and timesheets together, newest first, filterable by type and status from the query string, with the repository scoping every read to the acting user. Detail pages at `/employee/submissions/expense/[id]` and `/employee/submissions/timesheet/[id]` show the receipt image with the read-back fields, or the day-by-day grid, plus status history; another employee's id returns 404. `GET /api/employee/receipts/[id]` serves only the acting user's own image, falling back to the committed sample photographs in fixtures mode. Next: section 6 my findings and reasons. Auth still needs `NotificationBell`.
- 2026-09-20: Section 4 done. `/employee/timesheets/new` weekly grid (Monday start), live hours, location as Pittsburgh office / remote / another city. `POST /api/employee/timesheets` is guarded by `requireUser`, ignores body user id, stores hours to two decimals, and rejects invalid times or a week that is not Monday. Next: section 5 my submissions. Auth still needs `NotificationBell`.
- 2026-09-20: Added the database repository behind `AUDITX_DATA=db` (`web/src/lib/employee/db-repo.ts`). The overview, expenses, timesheets, findings, holds and score now read the signed-in employee's own rows, and expense and timesheet submission write to Postgres. Until the analysis service writes `Score` and `Hold` rows, score and holds are derived from stored findings (`provisional-score.ts`), following SYSTEM-DESIGN.md for pending findings. Plain-language wording for all 16 rules is in `rule-copy.ts`. Done by the auth-side session at the user's request, on branch `stream/employee-db`. Next: the My submissions and My findings pages, and swapping the derived score for real rows. The sample receipt images the extract tests read are tracked in git (commit c8428e2, taken from `stream/employee`), so all 84 web tests pass on a fresh clone.
- 2026-09-20: Receipt prefill reads the image. Known files still match by SHA-256. Other images are OCR'd and the text is retrieved against the receipt catalog (merchants, dates, totals from samples and fixtures), then merchant, date and amount are parsed. No NVIDIA call. Next: section 4 timesheet submission.
- 2026-09-19: Section 3 done. `/employee/expenses/new` with drag-and-drop, live preview, Choose image (`accept="image/*"`) and Take a photo (`capture="environment"`). Upload prefills merchant, date and total from the mock extractor; low-confidence fields are marked; corrections are stored. `POST /api/employee/expenses` is guarded by `requireUser`, ignores any body user id, stores SHA-256 and a placeholder phash in memory (no S3 until section 7), and keeps going when analysis is unreachable. Real extraction is mocked per the deadline. Next: section 4 timesheet submission. Auth still needs `NotificationBell`.
- 2026-09-19: Employee home rebuilt to match the analytics screenshot structure: left sidebar, top user bar, KPI cards with icons, bar chart, two donuts, line chart, recent table. AuditX colours only (no purple, no dark theme). Next: section 3 expense submission.
- 2026-09-19: Section 2 done. Employee layout with nav and a notification-bell slot, `/employee` overview from fixtures (score, six-month Recharts sparkline, held reimbursement with reason and next step). Demo login `employee@auditx.local` maps to the held fixture. Clean empty copy: "Nothing is paused. New flags will appear here." Next: section 3 expense submission. Auth still needs `NotificationBell`.
- 2026-09-19: Section 1 done. Types in `web/src/contracts/employee.ts`, repo selected by `AUDITX_DATA` in `web/src/lib/employee/repo.ts`, fixtures for clean / held-duplicate / remote-work (no finding), plus the shared demo cases on the held employee (location conflict, parking near-miss, $3,200 conference note). Forbidden-word and user-scoping tests pass (13 tests). Next: section 2 shell and own-record overview. Blocker: keep `AUDITX_DATA=fixtures` until section 7; `db` throws on purpose.
- 2026-09-19: Stream file created. Nothing built yet. Next: section 1.
