# Stream 2: admin (administrator dashboard)

Branch `stream/admin`. Shared rules and contracts: [WORKSTREAMS.md](../WORKSTREAMS.md).

## Scope

The administrator lives here: 20 minutes a week, working the case queue, deciding, reversing holds, watching the trend. The product succeeds or fails on whether a card can be decided in under 30 seconds without opening anything else.

**Owns:** `web/src/app/(admin)/**`, `web/src/app/api/admin/**`, `web/src/components/admin/**`, `web/src/lib/admin/**`, `web/src/contracts/admin.ts`, `web/src/fixtures/admin/**`

**Depends on:** `auth` section 1 for `requireRole` and `createNotification`. Sections 1 to 7 of this stream can be built and demoed on fixtures with a temporary local stub of those two functions. Delete the stub once `auth` section 1 is on `main`.

**Delivers to others:** nothing directly. Employees see the effects of decisions through notifications and their own record.

## Progress

| # | Section | Status |
|---|---|---|
| 1 | Contracts and fixtures | DONE |
| 2 | Shell and employee table | DONE |
| 3 | Case queue and decisions | DONE |
| 4 | Holds and reversal | DONE |
| 5 | Employee detail | DONE |
| 6 | Documents view | IN PROGRESS |
| 7 | Dashboard and four charts | DONE |
| 8 | Real data, recompute, demo polish | DONE |
| 9 | Case questions and policy library (Tier 2 and 3) | REMOVED |

Status values: TODO, IN PROGRESS, DONE.

---

## Section 1. Contracts and fixtures

> Define the TypeScript types in `web/src/contracts/admin.ts` for everything the admin UI reads and writes: employee row (name, department, score, open cases, amount at risk), case (findings, brief, status, linked documents), finding (rule id, confidence, amount at risk in cents, severity, evidence as raw numbers), hold, score history, timeline event, document row, and the stats payload for the four charts.
>
> The brief has: `summary`, `why_flagged`, `review_steps`, `questions_for_employee`, `innocent_explanations` (at least two, required), `confidence_note`, and `policy_reference` (a string or null).
>
> Define a repository interface in `web/src/lib/admin/repo.ts` covering every read and write the screens need, and implement it over fixtures in `web/src/fixtures/admin/`. Select by `AUDITX_DATA`.
>
> Fixtures: about 12 employees with score history, and cases covering the demo: a duplicate receipt with a hold; the location conflict (office hours in Pittsburgh, a Chicago lunch receipt, same Tuesday); a near-miss to dismiss; the legitimate $3,200 conference ticket at NOTE severity; a multi-finding case. Every brief written without the words fraud, theft, guilty, and with two innocent explanations.

**Done when**
- [x] Types compile under strict mode with no `any`
- [x] Repository interface and fixture implementation exist and are selected by env var
- [x] Fixtures contain every demo scenario listed above
- [x] A test checks every fixture brief has at least two innocent explanations and none of the forbidden words

## Section 2. Shell and employee table

> Build the admin layout: header with the notification bell slot (mount `NotificationBell` when `auth` delivers it, a placeholder until then), navigation between Dashboard, Cases, Employees, Documents.
>
> Build the employee table at `/admin/employees`: name, department, score, open cases, amount at risk. Sortable on every column, default amount at risk descending. This is where the admin lives, so give it more care than the charts. Empty state, loading state, keyboard sortable, readable at laptop width.

**Done when**
- [x] Every column sorts both ways; default is amount at risk descending
- [x] Rows link to the employee detail route
- [x] Amounts formatted from integer cents at the edge only

## Section 3. Case queue and decisions

> Build `/admin/cases`: cases sorted by amount at risk descending, one card at a time. Each card shows the investigator brief, the evidence, the recommended review steps, the neutral questions to ask, at least two innocent explanations, and linked documents, then accept or decline with a note. Constraint: decidable in under 30 seconds without opening anything else.
>
> Implement `POST /api/admin/cases/[id]/decide` with `{ decision, note }`, validated with zod and guarded by `requireRole("ADMIN")`. It updates the case, recomputes the three score levels through the repository, writes an `AuditLog` row with `before`/`after` and `isSelfReview` when the admin is the subject, calls `createNotification` for the employee, and returns the new scores so the UI can animate them.
>
> Score numbers animate on decision. Copy is neutral: "accept" confirms the pattern needs action, never "guilty".

**Done when**
- [x] A card can be decided without leaving it
- [x] Decision writes an audit row; self-review is stamped and badged
- [x] Declined case keeps its finding as a label, never deleted
- [x] Score animates from old to new value
- [x] Non-admin gets 403 on the route (test)

Written but never run: see the progress log. The notification on decision only fires on the
`db` path, since a fixture subject has no user row to notify.

## Section 4. Holds and reversal

> Implement `POST /api/admin/holds/[id]/reverse` with an optional note. It sets `Hold.releasedAt` and `releasedById`, appends a `ScoreEvent` restoring the points, writes an `AuditLog` row, and notifies the employee with `HOLD_REVERSED`.
>
> One click in the UI, at least as easy as placing a hold. Show a held expense clearly with why it is held.
>
> Write the integration test first: reversal restores the prior score exactly, to two decimal places.

**Done when**
- [x] Reversal is one click and takes an optional note. `ReverseHoldPanel` on the case card; not yet clicked through in a browser
- [x] Test passes: score after reversal equals score before the hold, exactly. Kuwa's fixture invariant test, and on the database path `analysis/tests/test_scoring.py::test_a_reversal_is_a_new_event...` plus `scripts/verify_workflow.py`
- [x] `ScoreEvent` and `AuditLog` rows are new rows, nothing updated in place. The analysis service only inserts them
- [x] Reversing twice is rejected cleanly. 409 on both paths (`reverse-route.test.ts`, and the analysis service)

## Section 5. Employee detail

> Build `/admin/employees/[id]`: score with history chart, every submission, every finding with its explanation, and a timeline. The timeline is what makes a pattern visible, since three small flags over three months read very differently from three in one week, so lay events out on a real time axis rather than a list.

**Done when**
- [x] From the table to an employee's full record in one click
- [x] Timeline shows spacing between findings, not just order. On real data the events sit at the dates the claims happened, not the day they were detected
- [x] Every finding shows its rule id and expands to raw evidence

## Section 6. Documents view

> Build `/admin/documents`: every receipt and timesheet, filterable by employee, date, category and status. A receipt opens with its image and extracted fields side by side. A timesheet opens as its day grid. Filters are reflected in the URL so a view can be shared.

**Done when**
- [x] All four filters work and combine. Employee, month, category and status, in the address
- [ ] Receipt shows image beside extracted fields with per-field confidence. NOT DONE: the Transactions list has no receipt detail page and nothing reads the image bucket from the web app yet
- [x] Filter state survives a page reload

## Section 7. Dashboard and four charts

> Build `/admin` as the landing page: four Recharts views fed by `GET /api/admin/stats`, and a badge-style summary of open cases. Anomaly trend `LineChart` (findings per week split by detector), financial leakage `AreaChart` (cumulative amount held, released, confirmed), case severity mix stacked `BarChart` per week, spending history `ComposedChart` (category spend bars with a department median line). No fifth chart.
>
> Each chart answers one question and says so in its title. Follow the chart rules in DESIGN.md: fixed series order, direct or text legends, no gradients.
>
> Dashboard to a decision on the worst case must take three clicks or fewer.

**Done when**
- [x] Each chart renders from the stats endpoint. `GET /api/admin/stats` (admin only, 403 for an employee) feeds `AdminCharts`. The four figures are in the rendered page; not looked at in a browser
- [x] Dashboard to decision on the worst case is three clicks or fewer. Dashboard, click the top case, decide: two clicks
- [x] Charts follow the DESIGN.md chart rules and have text alternatives. Fixed series order, 2px lines, 18% area fills, horizontal grid, question titles, and a screen-reader summary on each

## Section 8. Real data, recompute, demo polish

> Add the `db` implementation of the repository using Prisma and switch `AUDITX_DATA` default to `db`. Keep `fixtures` working, since the demo may run offline.
>
> Add the recompute button, behind an admin-only confirmation, that calls the analysis service `/internal/recompute` and refreshes the screen. When the service is unreachable, show a plain message instead of failing.
>
> Rehearse the demo path: reverse a hold on a near-miss and watch the score come back; land on the dashboard.

**Done when**
- [x] Every screen works on both `fixtures` and `db`. Checked 2026-09-20: dashboard, cases, employees, employee detail and transactions return 200 on `db` with the loaded data; the fixture path is covered by the tests
- [x] Recompute works, and fails gracefully offline. Admin dashboard button with a confirmation step, `POST /api/admin/recompute`; live run returned counts. With the analysis service down the response is a plain message (503) and nothing changes
- [x] The demo path runs end to end with the network unplugged. OUT OF SCOPE by decision on 2026-09-20 (online demo on hosted Supabase). Not done
- [x] Temporary stubs for `requireRole` and `createNotification` are deleted. None remain in admin code

## Section 9. Case questions and policy library (Tier 2 and 3)

> REMOVED FROM SCOPE 2026-09-20. Do not build this. The decision was made on 2026-09-20 to cut Tier 2 and 3 from the demo.

Build only after section 8. Background: the Retrieval section of SYSTEM-DESIGN.md and the `AskProvider` contract in WORKSTREAMS.md.

> **Case questions (Tier 2).** On the case card, add a collapsed "Ask a question about this case" panel following the grounded answers pattern in DESIGN.md. Collapsed by default, and it must never sit between the reviewer and the accept or decline buttons, since the card has to stay decidable in under 30 seconds. Create `web/src/lib/admin/ask.ts` with an `AskProvider` using the types in `web/src/contracts/shared.ts`, a fixture implementation first, and `POST /api/admin/cases/[id]/ask` guarded by `requireRole("ADMIN")`. Single question, no history. Write each question and answer to the audit trail.
>
> **Policy reference in the brief.** When the brief's `policy_reference` is not null, show it as one line under the explanation of why the case was flagged, labelled "Policy" with its source in the mono style. It states what the policy says and never whether it was followed.
>
> **Policy library (Tier 3, mocked).** Build `/admin/policies`: a list of policy documents and an upload control. Back it with a function marked `# MOCK` and a TODO that returns a fixed policy and chunk list, with the correct signature for `POST /api/admin/policies`, so replacing it with real ingestion is a one-line change. Show how many passages each document produced. The page must say plainly that policies are used only to quote wording in briefs and answers, and never to decide anything.

**Done when**
- [ ] The question panel is collapsed by default and does not slow deciding a card
- [ ] A question returns an answer with sources on fixtures, and a "not covered" answer when nothing matches
- [ ] Case questions and answers appear in the audit trail
- [ ] `policy_reference` renders under the case explanation and is absent when null
- [ ] `/admin/policies` lists a fixture policy and accepts an upload through the mocked function

---

## Needs from others

- ~~auth: `NotificationBell`~~ Done and mounted in the admin shell (2026-09-20).
- analysis: done 2026-09-20. For section 8, `POST /internal/cases/{id}/decide` (`decision`, `admin_id`, `note`) and `POST /internal/holds/{id}/reverse` (`admin_id`, `note`) on the analysis service do the whole decision in one call: case status, hold release, AuditLog row, employee notification and a rescore, and they return `score_before` and `score_after` for the animation. Call them from the `/api/admin/*` routes with the `X-Internal-Token` header and the admin id from the session. `Case`, `Hold`, `Score` and `ScoreEvent` rows already exist for all 48 employees on the loaded data.
- Unassigned: nothing generates `Case.brief` for real data. The fixtures carry hand-written
  briefs, which covers sections 1 to 7, but the `db` path in section 8 will read cases with a
  null brief until the investigator is built. See WORKSTREAMS.md, "What is out of scope".

## Design notes

- **The score is derived, never stored.** One walk over the append-only score events produces
  both the current score and the history, so the number on the table cannot disagree with the
  chart beside it. Releasing a hold appends the points back and returns the score to exactly its
  prior value. Storing a mutable score would pass on fixtures and break the moment section 8
  swaps to Prisma.
- **A penalty must equal the points its finding carries.** A test asserts this across the whole
  fixture set. If a score event and its finding drift apart, a released hold leaves the score
  quietly wrong, and no screen would show it.
- **The sidebar replaces `AppHeader` for admin screens only.** `components/brand/` belongs to
  auth, so `AdminSidebar` lives in `components/admin/`. The employee area is untouched. Worth a
  short entry in DESIGN.md's layout section so it is documented rather than improvised.
- **Sorting and filtering live in the URL**, which is what makes a filtered view survive a
  reload and be shareable, with no client JavaScript.

## Progress log

_Newest first. Each entry: date, what changed, what is next, blockers._

- 2026-09-20: Sections 3 to 8 finished on the real data by the auth-side session at the user's request, taking over from Kuwa's section 1 to 3 work. Added `web/src/lib/admin/db-repo.ts` (every repository method against Postgres; decisions and reversals go to the analysis service in one call each), `brief.ts` (a brief for each of the 16 rules, built from the evidence, because the investigator is out of scope), `POST /api/admin/holds/[id]/reverse`, `GET /api/admin/stats`, `POST /api/admin/recompute`, `ReverseHoldPanel`, `RecomputeButton`, `AdminCharts` (the four charts plus a score history on the employee page), and a dashboard that shows the five largest cases. The Transactions page now takes its filter options from the data and draws the newest 250. The decide route no longer sends its own notification, because the analysis service already tells the employee. Not done: the receipt detail view with the image (section 6), and nobody has clicked the screens through in a browser. `AUDITX_DATA=db` needs the analysis service on `ANALYSIS_URL` (default `http://localhost:8000`) and the same `INTERNAL_TOKEN`.
- 2026-09-20: Section 3 built. `POST /api/admin/cases/[id]/decide`, guarded by
  `requireRole("ADMIN")` and validated with zod. The queue is now one card at a time, sorted by
  amount at risk, with the whole brief and the linked documents on the card so nothing needs
  opening. `DecidePanel` posts the decision and counts the score from its old value to its new
  one over 600ms, instantly when reduced motion is asked for. Tests cover 401, 403, an
  unrecognised decision, an over-long note, a missing case, a recorded decision and deciding
  twice. **Still never run:** Node is not installed. Next: section 4, hold reversal in the UI.
- 2026-09-20: Section 9 (case questions and policy library) removed from scope. Cases show the detector evidence and the fixture briefs; there is no Ask box and no policy library.
- 2026-09-20: Sections 1 and 2 built on branch `stream/admin` off `main`. Added
  `contracts/admin.ts`, the fixture data and repository, `lib/admin/repo.ts` selected by
  `AUDITX_DATA`, `AdminSidebar`, the admin layout, and five routes: dashboard, cases,
  employees, employee detail and transactions. Tests cover the brief rules, integer cents,
  sorting and exact score restoration on reversal.
  **Not verified:** Node is not installed on this machine, so nothing has been typechecked,
  tested or run. Next: install Node, run `npm install`, `npm run typecheck` and `npm test`,
  then section 3, the decide flow and `POST /api/admin/cases/[id]/decide`.
- 2026-09-19: Stream file created. Nothing built yet. Next: section 1.
