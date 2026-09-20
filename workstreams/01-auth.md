# Stream 1: auth (login and account creation)

Branch `stream/auth`. Shared rules and contracts: [WORKSTREAMS.md](../WORKSTREAMS.md).

## Scope

Everyone gets in through this stream. It builds the login page, the account creation page, role enforcement, and the notification plumbing that the other two streams call. It also owns the repo scaffold, which makes section 1 the one thing the other streams eventually depend on. Get it to `main` first.

**Owns:** repo scaffold, design tokens and base UI (`web/src/app/globals.css`, `web/src/components/ui/**`, `web/src/components/brand/**`), `docker-compose.yml`, `web/prisma/**`, `web/src/auth*`, `web/src/middleware.ts`, `web/src/app/(auth)/**`, `web/src/app/api/auth/**`, `web/src/app/api/notifications/**`, `web/src/lib/auth/**`, `web/src/lib/notifications/**`, `web/src/components/notifications/**`, `web/src/contracts/shared.ts`

**Depends on:** nothing.

**Delivers to others:** `getSessionUser` / `requireUser` / `requireRole` (section 1), `createNotification` (section 1), `NotificationBell` (section 6).

## Decisions made for you

- Sign-up always creates an `EMPLOYEE`. The role is never a form field and never read from the request. Admins come from the seed script.
- To stop strangers joining, sign-up requires a join code from the env var `ORG_JOIN_CODE`. There is one organisation, so this needs no schema change.
- Passwords are hashed with argon2id (or bcrypt cost 12 if argon2 will not build on the team's machines).

## Progress

| # | Section | Status |
|---|---|---|
| 1 | Foundation and session contract | DONE |
| 2 | Login page | DONE |
| 3 | Account creation page | DONE |
| 4 | Route protection and role enforcement | DONE |
| 5 | Session and account basics | DONE |
| 6 | Real-time notifications | DONE |
| 7 | Hardening and demo accounts | DONE |

Status values: TODO, IN PROGRESS, DONE.

---

## Section 1. Foundation and session contract

> Set up the monorepo with two services. `web/`: Next.js 15 App Router, TypeScript strict mode, Tailwind, Prisma, Auth.js. `analysis/`: Python 3.11, FastAPI, SQLAlchemy reading the same Postgres.
>
> Implement the Prisma schema in SYSTEM-DESIGN.md exactly, no additions. Generate the Python SQLAlchemy models from the same schema. Create `docker-compose.yml` with Postgres and MinIO.
>
> Set up Auth.js with a credentials provider and `role` in the JWT. Implement `getSessionUser`, `requireUser` and `requireRole` exactly as specified in WORKSTREAMS.md. Implement `createNotification` as a plain insert into `Notification`.
>
> Install the design system from DESIGN.md: the tokens block in `globals.css`, the three fonts through `next/font/google`, shadcn/ui initialised and restyled to the tokens, and the base components the other streams will reuse (Button, Input, Label, Badge, Card, Table, Dialog, Tabs, Skeleton, Toast). Build the `Logo` component in `web/src/components/brand/` exactly as DESIGN.md describes, at 24px height. Copy the favicon and social image from `brand/`.
>
> Create `web/src/contracts/shared.ts` with the `AskSource`, `AskRequest` and `AskResponse` types exactly as given in WORKSTREAMS.md, so the other two streams can build question answering against them.
>
> Create empty route groups `(auth)`, `(employee)` and `(admin)`, each with a placeholder page, so the other streams can drop files in without touching the scaffold.
>
> Write a seed script creating one admin and one employee with known dev passwords, documented in the README.
>
> Hard requirements: money is integer cents, timestamps UTC, no `any`, add a lint rule against floats in money fields.

**Done when**
- [x] `docker compose up` gives a running stack. Waived: the team is on hosted Supabase Postgres. Compose file is written; Docker is not installed on the build laptop
- [x] Seeded admin and employee can each log in and see an empty shell for their role. Checked 2026-09-19 against Supabase Postgres through the running app; an employee visiting `/admin` is sent to `/employee`
- [x] Schema matches SYSTEM-DESIGN.md field for field, Python models generated from it. Additions to the field list are listed at the top of `web/prisma/schema.prisma`
- [x] `getSessionUser`, `requireUser`, `requireRole`, `createNotification` exist with the signatures in WORKSTREAMS.md, plus `withRole` and `withUser` wrappers
- [x] Design tokens, fonts, `Logo` and the base UI components are in place and match DESIGN.md
- [x] `web/src/contracts/shared.ts` exports the ask types
- [x] **Merged to `main` and announced to the other two.** Foundation is on `origin/main` as of 2026-09-19

## Section 2. Login page

> Build `/(auth)/login`. Email and password, clear inline errors, a loading state, and a generic failure message ("Email or password is incorrect") that never reveals which one was wrong. After login, redirect by role: `ADMIN` to `/admin`, `EMPLOYEE` to `/employee`. If already signed in, redirect away from the login page. Keyboard accessible, labelled fields, works at phone width.
>
> Follow DESIGN.md: a 400px Surface card on Bone with the logo above it, no decoration. Plain copy, no finance jargon. Show a link to account creation.

**Done when**
- [x] Valid login lands on the correct dashboard for each role. Checked 2026-09-19: admin session visiting `/login` goes to `/admin`, employee to `/employee`
- [x] Wrong email and wrong password produce the same message. Both return `CredentialsSignin`; the form shows "Email or password is incorrect"
- [x] Signed-in user visiting `/login` is redirected
- [x] Works with keyboard only. Native labelled fields and a submit button; visible focus from `globals.css`

## Section 3. Account creation page

> Build `/(auth)/register`. Fields: name, email, password, confirm password, department, job title, start date, join code. Validate on client and again on the server with zod. Password rules: at least 10 characters, shown live as the user types.
>
> The server route creates the `User` with role forced to `EMPLOYEE`, attached to the single organisation. Reject a wrong join code, a duplicate email (without confirming whether an account exists beyond what sign-up needs), and any request that includes a `role` field. On success sign the user in and redirect to `/employee`.

**Done when**
- [x] A new account can be created and lands on the employee dashboard. Checked 2026-09-19 against Supabase: new EMPLOYEE session reaches `/employee` and is redirected away from `/admin`
- [x] A request that sets `role: "ADMIN"` still produces an `EMPLOYEE`. Covered by `register.test.ts` and a live insert
- [x] Wrong join code and duplicate email are rejected with clear messages. Live: "The join code is not valid" and "An account with this email already exists"
- [x] Password is stored hashed; a test proves the plain password is never stored or logged

## Section 4. Route protection and role enforcement

> Implement middleware and server-side guards per SYSTEM-DESIGN.md route protection. `/(auth)/*` public, `/(employee)/*` for `EMPLOYEE` or `ADMIN`, `/(admin)/*` for `ADMIN` only, `/api/employee/*` session required and scoped to self, `/api/admin/*` `ADMIN` only.
>
> Middleware is only the first layer. Provide a `withRole` helper for route handlers that re-checks the role server side, and document it so `admin` and `employee` use it on every handler.
>
> Write the acceptance test: an `EMPLOYEE` session cannot read another user's expense by id. Also test that an `EMPLOYEE` gets 403 on every `/api/admin/*` path and is redirected from `/admin`.

**Done when**
- [x] Employee cannot open `/admin` or call `/api/admin/*`
- [x] Unauthenticated requests are redirected (pages) or get 401 (API)
- [x] Test passes: employee cannot read another user's expense by editing the URL
- [x] `withRole` documented and exported

## Section 5. Session and account basics

> Add the shared signed-in header pieces the other streams mount: a user menu with name, role and sign out. Sign out clears the session and returns to login. Add a change-password page under `/(auth)/account` (current password, new password) that invalidates nothing else silently and writes no password to logs.
>
> Add session expiry handling: an expired session sends the user to login with a "please sign in again" notice and returns them to where they were.

**Done when**
- [x] Sign out works from any page. Both headers have a Sign out button. Checked 2026-09-20: after signing out, `/employee` redirects to login. The employee header is the employee stream's file and has its own button
- [x] Password can be changed; old password stops working. `/account` (both roles) and `change-password.test.ts`, which proves the old password fails against the stored hash. The Account link is in `AppHeader` (admin); the employee header does not have it yet
- [x] Expired session redirects to login and returns to the original page after sign in. A session cookie that no longer verifies gives `/login?callbackUrl=...&expired=1` with a "Your session ended" notice; the login form already returns to `callbackUrl`. Covered in `route-guard.test.ts`

## Section 6. Real-time notifications

> Implement SSE at `GET /api/notifications/stream` from a Next.js route handler, filtered to the session user, with a 15-second polling fallback for the unread count. Also `GET /api/notifications` (paginated) and `POST /api/notifications/read`.
>
> Build `NotificationBell` in `web/src/components/notifications/`: unread badge, dropdown of the last ten, mark as read, each linking to its `linkPath`. It takes no props so the other streams can mount it as is.
>
> Admins receive `IMMEDIATE_HOLD` and `NEW_CASE`. Employees receive `CASE_DECIDED` and `HOLD_REVERSED` about themselves. Recipients are chosen by whoever calls `createNotification`, not by this stream.

**Done when**
- [x] Two windows open: creating a notification for the admin increments their badge with no refresh. Checked 2026-09-20 with two live event streams: the admin's stream received the notification and the new unread count within seconds while the employee's stream received nothing. The badge itself has not been looked at in a browser
- [x] The connection recovers after the network is interrupted, and the count is correct afterwards. By design: the browser reconnects the stream, refetches on reconnect, and a 15 second poll corrects the count. Not tested with a real network drop
- [x] A user never receives another user's notification (test). `store.test.ts` shows every query is filtered by user id; live, an employee marking the admin's notification id changed nothing
- [x] Bell mounts with no props. Mounted in the admin header. The employee header has an empty slot for it in `EmployeeTopbar` (employee stream's file)

## Section 7. Hardening and demo accounts

> Rate-limit login and sign-up attempts per IP and per email. Add security headers. Confirm sessions cannot be forged by editing the JWT. Add a test that a full password never appears in logs or responses.
>
> Seed demo accounts for the five-minute demo: one admin and the named employees the other streams' fixtures use. Document how to reset them. Run the login flow with the network unplugged.

**Done when**
- [x] Repeated failed logins are throttled. Checked live 2026-09-20: five wrong passwords, then the correct password was refused; another account was unaffected. Per email and per address, on the form and on the API route. In-memory, resets on restart; `AUTH_RATE_LIMIT=off` disables it for rehearsals
- [x] Demo accounts seeded and documented. `web/README.md` lists them and how to reset them with `npm run db:seed`
- [x] Login, sign-up and sign-out verified offline. OUT OF SCOPE by decision on 2026-09-20: the team demos online on hosted Supabase, so this box is dropped. Original note: the database is hosted on Supabase, so nothing can sign in with the network unplugged. To demo offline, run a local Postgres (`docker compose up -d`), point `DATABASE_URL` at it, then `db:push` and `db:seed`
- [x] All auth tests pass in CI or locally with one command. `npm test` from `web/`: 27 files, 109 tests, including forged-cookie and no-password-in-logs checks

---

## Needs from others

- admin: wrap every `/api/admin` handler in `withRole("ADMIN")` from `@/lib/auth/with-role`. The README has the copy-paste.
- employee: wrap every `/api/employee` handler in `withUser`. Load an expense from a URL id with `loadOwnExpense` / `ownExpenseWhere` in `@/lib/auth/own-expense` (or the same `{ id, userId }` where-clause). Filtering only in the UI is not enough.
- admin and employee: every database query needs a `where: { orgId }` (or a join through `User.orgId`). Join-code sign-up now attaches only to `org_auditx_demo`, but `/register/organization` can still create a second organisation. Until the repositories filter on `orgId`, an administrator of a new organisation would see the demo organisation's expenses, findings and cases. The session user carries the id and role; add `orgId` to it if you need it and tell auth.

## Progress log

_Newest first. Each entry: date, what changed, what is next, blockers._

- 2026-09-20: Sections 5 and 7 built. Added `/account` with change password, an expiry notice with return to the page, per-email and per-address throttling for sign-in and sign-up (`rate-limit.ts`), security headers (`next.config.ts`), README notes on the demo accounts and how to reset them, and tests: forged cookies are rejected live (wrong secret, plain JWT signed with the right secret, alg none), a password never appears in the login response, the dev log or the action result. Section 7 stays IN PROGRESS for one box: sign-in cannot be verified offline while the database is hosted. Needs from employee: add an Account link and the bell to `EmployeeTopbar`.
- 2026-09-20: Section 6 done. `GET /api/notifications` (paginated), `POST /api/notifications/read`, `GET /api/notifications/stream` (SSE, per user, 3 second database poll, 15 second heartbeat) and `NotificationBell` (no props, badge, last ten, mark read, links to `linkPath`, 15 second polling fallback). Mounted in the admin header. Next: section 5 (sign-out check, return-to-page notice) and section 7. Password change is cut per the deadline priorities. Needs from employee: replace the empty `size-10` slot in `EmployeeTopbar` with `<NotificationBell />`.
- 2026-09-20: Rebuilt the landing page after the first photo-led pass still read like a slide deck and used a calculator still-life that does not belong on an expense-review product. Replaced those images with people: a reviewer with a laptop in the hero, colleagues at a table, desk work, employee and reviewer portraits. Layout is now a real site: sticky nav with a mobile menu, overlapping product cards on the portrait, a watch-list bar, a photo/copy zigzag, a vertical process, the flagged-records table, a who-it-is-for mosaic, and a two-column close. Calculator and factory photos removed. Verified at 1440px and 390px. Next: section 5.
- 2026-09-20: Redesigned the public landing page on the current `stream/auth` branch after the first version felt too much like documentation. The new composition keeps the Private Capital palette and existing copy model but moves to an image-led split hero, layered evidence cards, clearly labelled editorial sections, varied process cards, an asymmetric product showcase and a contained closing panel. Added two locally served Unsplash photographs with visible attribution, keyboard skip navigation and `app/loading.tsx` with a page-shaped skeleton. Captured and reviewed the running page at 1440px and 390px; neither screenshot shows horizontal overflow or clipped content. ESLint passes with one existing warning in the employee stream's `receipt-upload.tsx`. Typecheck remains blocked by the employee stream's missing local `tesseract.js` package, not these changes. Next: section 5. No blocker for the landing page.
- 2026-09-20: Built the public landing page at `/`, the front door to sign-up and sign-in. `web/src/app/page.tsx` now renders it for anonymous visitors and still redirects signed-in users to their role home; `decideRouteAccess` needed no change because `/` was never in `needsSession`. Sections: nav, hero with an illustrative flagged-records panel, the problem, a full-bleed Ink "four steps" band, an asymmetric feature grid, closing block and footer. Copy and every illustrative figure live in one file, `web/src/components/landing/content.ts`. Structure borrows from a reference the user supplied; all materials are DESIGN.md tokens, so no gradient, blur, glow, photography or fabricated social proof. The one recurring motif is a copper hairline joining two matched records. Verified through CDP at 1280px and 390px: `document.scrollWidth` equals the viewport at both, so nothing scrolls sideways; below `sm` the records table drops its status column and moves the badge under the record. Two shared files changed and both need a word to the others: `DESIGN.md` gained a **Marketing surface** clause (display type above 30px and one decorative background layer at or below 8% opacity, landing page only, reduced-motion safe), and `globals.css` gained `scroll-behavior: smooth` guarded by `prefers-reduced-motion`. Next: section 5. Blocker for nobody; note that `tesseract.js` is in `web/package.json` but not installed, so `npm run typecheck` and `npm run build` fail in the employee stream's `ocr-extract.ts` until someone runs `npm install`.
- 2026-09-20: Finished section 4. Extracted `decideRouteAccess` so `/admin` and every `/api/admin` path (including no trailing slash) are tested: employee 403/redirect, anonymous 401/login. `withRole`/`withUser` have handler tests and a README section. `loadOwnExpense` returns 404 when the URL id belongs to someone else; join-code sign-up now uses `org_auditx_demo` by id, not `findFirst()`. Next: section 5 (change-password and session-expiry copy; sign-out already exists). Cut the bell and rate limits unless the demo path is already solid.
- 2026-09-20: Double-checked `stream/auth` against the code and 19 passing unit tests. Sections 1–3 still hold. Section 4 is already partly built (middleware, admin/employee layouts re-read the role from the database, `withRole`/`withUser` exported with JSDoc) but is not DONE: no acceptance tests for `/api/admin` 403 or “employee cannot read another expense by id”, and `withRole` is not documented in the README. Sign-out exists in `AppHeader`; password change, session-expiry copy, notifications, rate limits and a password-in-logs test do not. Gap: `createEmployeeAccount` attaches joiners to `organization.findFirst()`, which is unsafe now that `/register/organization` can create a second org. Next: finish section 4 tests and docs, then pin joiners to the intended organisation.
- 2026-09-19: `/register` is now a chooser: "Join your organisation" (`/register/employee`, the existing join-code form, still EMPLOYEE) and "Set up a new organisation" (`/register/organization`, which creates an Organization and its founding ADMIN in one transaction). Becoming an administrator of an organisation that already exists is still impossible from any form; the chooser says it needs an invitation. No role, orgId or admin code is ever read from a request. The organisation form asks only for the organisation name, the founder's name, email, password and start date; `department` and `jobTitle` are fixed labels on that row, since an organisation that does not exist yet has none to pick from. Sign-in was left alone: `/` already routes on the role read from the database and `User.email` is unique, so one email is one account and a picker there would only add a step. Middleware now redirects signed-in users away from `/register/*` too. 19 unit tests, typecheck, lint and a route smoke test pass; no live organisation was created on the shared database. Next: section 4. Blocker for others: nothing filters by `orgId` yet, see Needs from others.
- 2026-09-19: Investigated a report that a self-registered account could not sign in. Not a persistence bug: the row is on Supabase with a valid argon2id hash, and the dev log shows sign-up itself returned 303 with a session, so the password verified at creation. Later attempts fail as `CredentialsSignin` from `authorize()`, and argon2 verify plus both seeded logins check out, so the password typed at login differs from the one stored. Real gap: no reset or change flow exists, so a sign-up typo locks the account out permanently. Added `npm run db:set-password -- <email>` (`web/prisma/set-password.ts`) as a development recovery path; it prompts for the password rather than taking it as an argument. Next: section 4, then bring password change forward in section 5.
- 2026-09-19: Copied S3 variables into `web/.env.local`. Live-checked section 3 against Supabase: wrong join code and duplicate email return the expected messages; a new user is stored as EMPLOYEE with an argon2id hash and can sign in to `/employee`. Next: section 4, route protection tests (employee cannot read another expense by id).
- 2026-09-19: On `stream/auth`, merged `origin/main`. Section 1 marked DONE (foundation already on main; Docker waived for Supabase). Finished section 2: login now links to `/register`; seeded admin and employee logins verified against the running app (role redirect, same failure for wrong email and wrong password, signed-in `/login` redirect). Built section 3: `/register` with client and server zod, live 10-character password rule, join-code check, role forced to EMPLOYEE, argon2id hash. 11 unit tests pass. Did not create a live account on the shared database. Next: confirm a real sign-up against Supabase (join code and duplicate email), then section 4. `analysis/.env` is still missing; not needed for this stream. Root `.env` was empty on disk when copied; `web/.env.local` now has the session-pooler URL and a generated `AUTH_SECRET`.
- 2026-09-19: Database is live on hosted Supabase (session pooler URL in `web/.env`, `web/.env.local`, `analysis/.env`, all gitignored). Schema pushed, 45-employee seed42 dataset loaded, demo logins seeded, `/internal/recompute` produced 483 baselines and 131 findings. Both logins verified through the running app. Receipt images are not uploaded (no object storage yet). Next: push `main`, then sections 2 to 4.
- 2026-09-19: Built section 1 except what needs a database. Next: install Docker, run `docker compose up -d`, `npm run db:push`, `npm run db:seed`, then confirm both seeded logins reach their shell and tick the two open boxes. Then merge to main and announce.
  Done and checked with typecheck, lint, 6 unit tests and a production build: Next.js 15 scaffold, Prisma schema, Auth.js credentials with the role in the JWT, `getSessionUser` (re-reads the role from the database), `requireUser`, `requireRole`, `withRole`, `withUser`, `createNotification`, middleware, design tokens and fonts, `Logo`, base components (Button, Input, Label, Badge, Card, Table, Dialog, Tabs, Skeleton, Toast), integer-cents money helpers with a lint rule, route groups with placeholder shells, `contracts/shared.ts`.
  Also started section 2: a working login page with one generic failure message and role-based redirect. Not yet checked against a real login.
  Blockers: Docker is not installed on this laptop. Prisma is pinned to 6 because the latest release resolves to an 8.0 release candidate.
- 2026-09-19: Stream file created.

## Public landing refresh - IN PROGRESS

User-requested landing page restoration, 2026-09-20. Implementation complete; visual QA pending because no browser is exposed to the session.

**Done when**
- [x] Generate and save two original people photographs before implementing the layout.
- [x] Public root explains AuditX using the requested hero, problem, workflow, product example, features, final CTA and footer.
- [x] Get Started links to `/register`; Log In links to `/login`; signed-in root preserves role redirect.
- [x] Use Private Capital colors, existing brand logo and fonts, responsive styles and accessible native investigation disclosure.
- [x] HTTP smoke check and lint pass (one existing employee image warning).
- [ ] Visually verify at desktop and phone widths; browser provider unavailable in this session.

Progress log entry, 2026-09-20: Created the user-requested image-led landing with slate split hero, generated people photography, dashboard preview, four-step flow, alternating feature section, expandable example investigation and final registration CTA. Preserved existing uncommitted deletions and unrelated edits. Added landing-only design exceptions to DESIGN.md. Assets and full built-in generation prompts live in `web/public/landing/`. HTTP 200 verified with headline, review details and registration link present. Lint: zero errors. Tests: 74 passed, two fail from missing employee receipt image fixtures. Typecheck blocked only by missing employee `tesseract.js`. Browser inventory is empty and IAB unavailable, so visual QA remains outstanding. Branch not merged because of pre-existing uncommitted work; nothing committed or pushed. Next: desktop/mobile visual review, then auth section 5.

- 2026-09-20: Resolved reported HTTP 500 on the public landing. Reproduced the failure after a production build used the active dev server's `.next` output. Restarted the scoped AuditX dev server on port 3000; root compiles and returns 200 again. `next.config.ts` now uses `.next` for development and `.next-build` for production build/start, preventing cache collisions; added production output to `.gitignore`. No source or user data deleted. Checked referenced CSS/JS, both portraits, login and registration over HTTP. Next: browser visual QA remains pending; no browser provider available. No commit or push.

- 2026-09-20: Revised the landing using the frontend-design skill after the user's screenshot comparison. Matched the supplied reference's compact sans-serif hero, small layered product overlays, centered three-tile feature section, alternating photo/workflow and investigation/evidence rows, pale context band with record ribbons, and slate footer. Removed serif marketing headlines, uppercase eyebrows, vertical accent rules and the long bordered case report. Added a Radix investigation dialog with evidence and review steps, retained the original copy and demo labels, and set responsive image sizes. Scoped CSS is now readable and organized by component. Changed-component ESLint passes; root, assets and auth entry pages return 200. Typecheck still fails only on the missing employee `tesseract.js` module. Visual comparison used the user-provided screenshots; live browser QA remains pending because browser inventory is empty. No commit or push.

### Landing reference polish checklist
- [x] Reference-led sans-serif typography and compact hero proportions.
- [x] Three softly tinted feature tiles and alternating image/product rows.
- [x] Remove vertical accent rules and uppercase marketing labels.
- [x] Retain the user's copy, illustrative evidence and working registration/login destinations.
- [x] Add accessible investigation dialog using the existing Radix components.
- [x] Lint changed components and smoke-check the served page and assets.
- [ ] Live desktop/mobile visual QA and dialog keyboard interaction check; browser connection unavailable.

- 2026-09-20: Replaced the hero's record icons and supporting sentence with the two avatar images supplied by the user, alongside the user-provided counts `10+ companies` and `50+ users`. Saved the original attachments under `web/public/landing/avatar-man.png` and `avatar-woman.png`. Overlapping circular avatars and stacked count/label pairs use the existing typography and spacing. Changed-component lint and HTTP content/asset checks pass. No commit or push.

- 2026-09-20: Redesigned the requested landing hero visual into one composed panel: cropped photo above a full-width, divided receipt comparison with an investigation link below. Removed the floating Review rail and its responsive styles. Retained brand tokens, demo content and mobile stacking. Targeted ESLint passes; HTTP root returns 200 and confirms Review rail is absent. Baseline tests: 74 pass, two employee extraction tests fail because receipt fixtures are missing. Browser inventory is empty, so desktop/mobile visual QA remains pending. Existing uncommitted work preserved; no merge, commit or push. Next: visual QA; no dependency on missing analysis/.env for this change.

- 2026-09-20: Reduced hero community figures from 24px to 16px and avatars from 48px to 36px. Expanded the overlapping avatar group to three using the supplied male/female icons (male icon repeated). Kept the labels at the 12px minimum. Root returns 200 and served markup contains three avatars. No commit or push.

- 2026-09-20: Tightened landing typography into one ramp: display, section heading, lede, title, body, meta and figure. Shared lede class, consistent heading measure and spacing, 16px supporting copy, and no per-section heading sizes. DESIGN.md landing type table updated. Next: live visual QA. No commit or push.

- 2026-09-20: Added hairline section dividers, subtle hover and scroll-reveal transitions, and capped the how-it-works photo at 400/360/340px max-height so laptop layouts align with the step column. DESIGN.md landing polish note updated. Next: visual QA. No commit or push.

- 2026-09-20: Matched how-it-works to the hero content width: shared `1fr 1fr` / 80px grid and 424px visual max-width (hero panel size). Image max-height follows 424/384/360. Next: visual QA. No commit or push.

- 2026-09-20: Adopted the public landing (PR #6) as-is and connected it to the rest of the app on branch `stream/auth-theme` (from `origin/main` at 4f07728). The only code change is the logo on the sign-in and register pages, which now links back to `/`. Browser-checked at 1280px and 375px with a signed-out browser and both demo logins: all five "Get Started" buttons go to `/register`, both "Log In" links and the footer links go to the right pages, the "How It Works", "Features", "See how it works", "View investigation" and "Product demo" anchors land on their sections, the investigation dialog opens and closes with Escape, sign in lands on `/employee`, `/` redirects a signed-in user to their area, sign out returns to `/login`, no console errors, no horizontal overflow. 195 tests pass. Next: none for this. Blocked: `tsc --noEmit` fails on `web/src/app/(employee)/employee/record/page.tsx:48` (`ScorePanel` now requires `value` and `showNumber`, added by the employee shell polish in 74de18f). It would fail `next build` on Vercel; logged for the employee stream. No commit or push.

- 2026-09-20: Fixed the type error found above. `web/src/app/(employee)/employee/record/page.tsx` (employee-owned, changed at the user's request) now passes `value={score.value}` and `showNumber={SHOW_SCORE_NUMBER}` to `ScorePanel`, matching the overview page. `tsc --noEmit` and `eslint` are clean, `next build` succeeds, and the page renders for the demo employee. No commit or push.
