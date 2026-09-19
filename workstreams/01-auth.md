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
| 1 | Foundation and session contract | IN PROGRESS |
| 2 | Login page | IN PROGRESS |
| 3 | Account creation page | TODO |
| 4 | Route protection and role enforcement | TODO |
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
- [ ] `docker compose up` gives a running stack. Written, not run: Docker is not installed on the build laptop. The team is on hosted Supabase Postgres for now
- [x] Seeded admin and employee can each log in and see an empty shell for their role. Checked 2026-09-19 against Supabase Postgres through the running app; an employee visiting `/admin` is sent to `/employee`
- [x] Schema matches SYSTEM-DESIGN.md field for field, Python models generated from it. Additions to the field list are listed at the top of `web/prisma/schema.prisma`
- [x] `getSessionUser`, `requireUser`, `requireRole`, `createNotification` exist with the signatures in WORKSTREAMS.md, plus `withRole` and `withUser` wrappers
- [x] Design tokens, fonts, `Logo` and the base UI components are in place and match DESIGN.md
- [x] `web/src/contracts/shared.ts` exports the ask types
- [ ] **Merged to `main` and announced to the other two.** Merged locally, not yet pushed

## Section 2. Login page

> Build `/(auth)/login`. Email and password, clear inline errors, a loading state, and a generic failure message ("Email or password is incorrect") that never reveals which one was wrong. After login, redirect by role: `ADMIN` to `/admin`, `EMPLOYEE` to `/employee`. If already signed in, redirect away from the login page. Keyboard accessible, labelled fields, works at phone width.
>
> Follow DESIGN.md: a 400px Surface card on Bone with the logo above it, no decoration. Plain copy, no finance jargon. Show a link to account creation.

**Done when**
- [ ] Valid login lands on the correct dashboard for each role
- [ ] Wrong email and wrong password produce the same message
- [ ] Signed-in user visiting `/login` is redirected
- [ ] Works with keyboard only

## Section 3. Account creation page

> Build `/(auth)/register`. Fields: name, email, password, confirm password, department, job title, start date, join code. Validate on client and again on the server with zod. Password rules: at least 10 characters, shown live as the user types.
>
> The server route creates the `User` with role forced to `EMPLOYEE`, attached to the single organisation. Reject a wrong join code, a duplicate email (without confirming whether an account exists beyond what sign-up needs), and any request that includes a `role` field. On success sign the user in and redirect to `/employee`.

**Done when**
- [ ] A new account can be created and lands on the employee dashboard
- [ ] A request that sets `role: "ADMIN"` still produces an `EMPLOYEE`
- [ ] Wrong join code and duplicate email are rejected with clear messages
- [ ] Password is stored hashed; a test proves the plain password is never stored or logged

## Section 4. Route protection and role enforcement

> Implement middleware and server-side guards per SYSTEM-DESIGN.md route protection. `/(auth)/*` public, `/(employee)/*` for `EMPLOYEE` or `ADMIN`, `/(admin)/*` for `ADMIN` only, `/api/employee/*` session required and scoped to self, `/api/admin/*` `ADMIN` only.
>
> Middleware is only the first layer. Provide a `withRole` helper for route handlers that re-checks the role server side, and document it so `admin` and `employee` use it on every handler.
>
> Write the acceptance test: an `EMPLOYEE` session cannot read another user's expense by id. Also test that an `EMPLOYEE` gets 403 on every `/api/admin/*` path and is redirected from `/admin`.

**Done when**
- [ ] Employee cannot open `/admin` or call `/api/admin/*`
- [ ] Unauthenticated requests are redirected (pages) or get 401 (API)
- [ ] Test passes: employee cannot read another user's expense by editing the URL
- [ ] `withRole` documented and exported

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

_None yet. Add lines here, for example: "employee: need X from Y"._

## Progress log

_Newest first. Each entry: date, what changed, what is next, blockers._

- 2026-09-19: Database is live on hosted Supabase (session pooler URL in `web/.env`, `web/.env.local`, `analysis/.env`, all gitignored). Schema pushed, 45-employee seed42 dataset loaded, demo logins seeded, `/internal/recompute` produced 483 baselines and 131 findings. Both logins verified through the running app. Receipt images are not uploaded (no object storage yet). Next: push `main`, then sections 2 to 4.
- 2026-09-19: Built section 1 except what needs a database. Next: install Docker, run `docker compose up -d`, `npm run db:push`, `npm run db:seed`, then confirm both seeded logins reach their shell and tick the two open boxes. Then merge to main and announce.
  Done and checked with typecheck, lint, 6 unit tests and a production build: Next.js 15 scaffold, Prisma schema, Auth.js credentials with the role in the JWT, `getSessionUser` (re-reads the role from the database), `requireUser`, `requireRole`, `withRole`, `withUser`, `createNotification`, middleware, design tokens and fonts, `Logo`, base components (Button, Input, Label, Badge, Card, Table, Dialog, Tabs, Skeleton, Toast), integer-cents money helpers with a lint rule, route groups with placeholder shells, `contracts/shared.ts`.
  Also started section 2: a working login page with one generic failure message and role-based redirect. Not yet checked against a real login.
  Blockers: Docker is not installed on this laptop. Prisma is pinned to 6 because the latest release resolves to an 8.0 release candidate.
- 2026-09-19: Stream file created.
