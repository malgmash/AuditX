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
| 5 | Session and account basics | TODO |
| 6 | Real-time notifications | TODO |
| 7 | Hardening and demo accounts | TODO |

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
- [ ] Sign out works from any page
- [ ] Password can be changed; old password stops working
- [ ] Expired session redirects to login and returns to the original page after sign in

## Section 6. Real-time notifications

> Implement SSE at `GET /api/notifications/stream` from a Next.js route handler, filtered to the session user, with a 15-second polling fallback for the unread count. Also `GET /api/notifications` (paginated) and `POST /api/notifications/read`.
>
> Build `NotificationBell` in `web/src/components/notifications/`: unread badge, dropdown of the last ten, mark as read, each linking to its `linkPath`. It takes no props so the other streams can mount it as is.
>
> Admins receive `IMMEDIATE_HOLD` and `NEW_CASE`. Employees receive `CASE_DECIDED` and `HOLD_REVERSED` about themselves. Recipients are chosen by whoever calls `createNotification`, not by this stream.

**Done when**
- [ ] Two windows open: creating a notification for the admin increments their badge with no refresh
- [ ] The connection recovers after the network is interrupted, and the count is correct afterwards
- [ ] A user never receives another user's notification (test)
- [ ] Bell mounts with no props

## Section 7. Hardening and demo accounts

> Rate-limit login and sign-up attempts per IP and per email. Add security headers. Confirm sessions cannot be forged by editing the JWT. Add a test that a full password never appears in logs or responses.
>
> Seed demo accounts for the five-minute demo: one admin and the named employees the other streams' fixtures use. Document how to reset them. Run the login flow with the network unplugged.

**Done when**
- [ ] Repeated failed logins are throttled
- [ ] Demo accounts seeded and documented
- [ ] Login, sign-up and sign-out verified offline
- [ ] All auth tests pass in CI or locally with one command

---

## Needs from others

- admin: wrap every `/api/admin` handler in `withRole("ADMIN")` from `@/lib/auth/with-role`. The README has the copy-paste.
- employee: wrap every `/api/employee` handler in `withUser`. Load an expense from a URL id with `loadOwnExpense` / `ownExpenseWhere` in `@/lib/auth/own-expense` (or the same `{ id, userId }` where-clause). Filtering only in the UI is not enough.
- admin and employee: every database query needs a `where: { orgId }` (or a join through `User.orgId`). Join-code sign-up now attaches only to `org_auditx_demo`, but `/register/organization` can still create a second organisation. Until the repositories filter on `orgId`, an administrator of a new organisation would see the demo organisation's expenses, findings and cases. The session user carries the id and role; add `orgId` to it if you need it and tell auth.

## Progress log

_Newest first. Each entry: date, what changed, what is next, blockers._

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
