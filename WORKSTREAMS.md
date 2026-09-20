# Workstreams

Three people, three streams, working at the same time without blocking each other.

| Stream | Builds | Stream file | Branch |
|---|---|---|---|
| `auth` | Login, account creation, role enforcement, notifications plumbing | [01-auth.md](workstreams/01-auth.md) | `stream/auth` |
| `admin` | Administrator dashboard, case queue, holds, employee table, charts | [02-admin.md](workstreams/02-admin.md) | `stream/admin` |
| `employee` | Employee dashboard, expense and timesheet submission, own record | [03-employee.md](workstreams/03-employee.md) | `stream/employee` |

## Environment: hosted Supabase, not Docker

The team runs on hosted services. Docker is not installed on the main laptop, so ignore `docker compose up`, MinIO and `localhost:5432` in older instructions.

- **Postgres:** Supabase, through the Session pooler URL (the direct host is IPv6 only and does not connect from most networks). The schema is pushed and the 45-employee `seed42` dataset is loaded, with the two demo logins seeded. Do not run `db:push --force-reset`, the generator with `--db`, or anything that wipes tables without asking.
- **Receipt images:** a private Supabase Storage bucket named `receipts`, reached through its S3 API (path-style addressing). It uses the same `S3_*` variables as MinIO would. Read it from the server only, and show images through short-lived signed URLs.
- **Models:** NVIDIA NIM through the hosted API, `NIM_API_KEY` and `NIM_BASE_URL`. The nemotron models are reasoning models, so set a generous `max_tokens`.
- **Secrets are not in git.** The real values live in `web/.env`, `web/.env.local` and `analysis/.env`, which are gitignored. Ask the person who set up the project for them, and never paste them into a file that is committed. `.env.example` shows the variable names only.
- **Demo logins:** `admin@auditx.local` and `employee@auditx.local`, passwords in `web/prisma/seed.ts`.
- **Analysis service:** `uvicorn app.main:app --port 8000` from `analysis/`, using `analysis/.venv`. `POST /internal/recompute` with header `X-Internal-Token` rebuilds baselines and findings.

## How to start a session

Open your AI agent in this repo and say which stream you are on. That is all it needs:

> I'm working on the **auth** stream.
>
> I'm working on the **admin** stream.
>
> I'm working on the **employee** stream.

The agent reads [AGENTS.md](AGENTS.md), reads your stream file, checks the code and git history to see what is already built, tells you where things stand, and continues from the first unfinished section. To jump to a specific section, add it: "I'm working on the admin stream, section 4."

Agent not picking it up automatically? Paste this first: *"Read AGENTS.md in the repo root and follow its instructions. I'm working on the `<stream>` stream."*

## What is out of scope for the three streams

The analysis service and the synthetic data generator are not assigned to any of the three streams. The detectors, severity, baselines, the generator and the evaluation are built and measured (see [analysis/README.md](analysis/README.md)). Receipt extraction, scoring, cases, holds, the investigator and retrieval are not built. Each stream builds against fixtures and a thin interface, so the real thing can be swapped in with one change. Someone needs to own what is left.

## Ownership

Each stream edits only its own paths. This is what keeps three people from colliding.

| Stream | Owns |
|---|---|
| `auth` | Repo scaffold, design tokens and base UI (`web/src/app/globals.css`, `web/src/components/ui/**`, `web/src/components/brand/**`), `docker-compose.yml`, `web/prisma/**`, `web/src/auth*`, `web/src/middleware.ts`, `web/src/app/(auth)/**`, `web/src/app/api/auth/**`, `web/src/app/api/notifications/**`, `web/src/lib/auth/**`, `web/src/lib/notifications/**`, `web/src/components/notifications/**`, `web/src/contracts/shared.ts` |
| `admin` | `web/src/app/(admin)/**`, `web/src/app/api/admin/**`, `web/src/components/admin/**`, `web/src/lib/admin/**`, `web/src/contracts/admin.ts`, `web/src/fixtures/admin/**` |
| `employee` | `web/src/app/(employee)/**`, `web/src/app/api/employee/**`, `web/src/components/employee/**`, `web/src/lib/employee/**`, `web/src/contracts/employee.ts`, `web/src/fixtures/employee/**` |

Need a change outside your paths? Write it under **Needs from others** in your stream file and tell your user. The schema (`Expense`, `Timesheet`, `Finding`) is frozen and needs all three to agree.

## Shared contracts

These are the seams between streams. They are fixed here so nobody waits.

### Session

Delivered by `auth` in section 1. Until it lands on `main`, `admin` and `employee` write against this signature.

```ts
// web/src/lib/auth/session.ts
export type SessionUser = {
  id: string;
  role: "EMPLOYEE" | "ADMIN";
  name: string;
  email: string;
  department: string;
};
export function getSessionUser(): Promise<SessionUser | null>;
export function requireUser(): Promise<SessionUser>;                    // throws 401
export function requireRole(role: "ADMIN"): Promise<SessionUser>;       // throws 401 or 403
```

The role in the JWT is a claim, not a permission. Every protected route re-checks it server side.

### Notifications

Delivered by `auth`: the function that writes a row in section 1, the real-time stream and bell in section 6. `admin` and `employee` only ever call the function.

```ts
// web/src/lib/notifications/create.ts
export type NotificationKind = "IMMEDIATE_HOLD" | "NEW_CASE" | "CASE_DECIDED" | "HOLD_REVERSED";
export function createNotification(n: {
  userId: string;          // recipient
  kind: NotificationKind;
  title: string;
  body: string;
  linkPath: string;
}): Promise<void>;
```

The bell component is `web/src/components/notifications/NotificationBell.tsx`. Mount it in your layout header and pass nothing.

### Data access

Each of `admin` and `employee` reads and writes through a small repository interface in its own `lib/` folder, with two implementations selected by `AUDITX_DATA=fixtures|db`. Start on `fixtures`. Swap to `db` in the final section. This means you never wait for a database, the analysis service, or another stream, and the demo can run with the network unplugged.

Fixtures must include the demo scenarios: a duplicate receipt with a hold, the location conflict (office hours in Pittsburgh, lunch receipt in Chicago, same Tuesday), a near-miss to dismiss, and the legitimate $3,200 conference ticket that stays a note.

### Retrieval and question answering (Tier 2)

Types are delivered by `auth` in `web/src/contracts/shared.ts`, in section 1. Both `admin` and `employee` call the same shape and never talk to the analysis service directly. Each puts an `AskProvider` behind its own `lib/` folder, with a fixture implementation that returns fixed answers, and swaps to the real `POST /internal/ask` in its final section.

```ts
// web/src/contracts/shared.ts
export type AskSource = {
  kind: "RULE" | "POLICY";
  label: string;   // heading shown as the citation
  ref: string;     // rule id or policy document id
};
export type AskRequest = { findingId: string; question: string };   // asker role is never in the body
export type AskResponse = {
  answer: string;
  sources: AskSource[];    // supplied by the service, not written by the model
  fallback: boolean;       // true when the model was unreachable
};
```

The server route derives the asker role and user id from the session. An employee asking about a finding that is not theirs gets a 404. The UI pattern is in DESIGN.md under grounded answers. The retrieval design itself belongs to the analysis service; see the Retrieval section of SYSTEM-DESIGN.md.

## Rules for everyone

1. **Money is integer cents.** No floats anywhere in the money path. Format only at the edge.
2. **Timestamps are timezone-aware UTC.**
3. **TypeScript strict, no `any`.** Validate every request body with zod.
4. **Employee data is filtered by `session.user.id` at the database layer**, never in the UI. An employee must not read another's anything by editing a URL.
5. **Every admin action writes an `AuditLog` row.** No silent admin actions. Stamp `isSelfReview` when the admin is the subject.
6. **Append-only.** `ScoreEvent` and `AuditLog` rows are never updated or deleted. A reversal is a new row.
7. **Holds, not fines.** Nothing touches payroll. A hold pauses an unpaid reimbursement.
8. **UI wording.** Never write fraud, theft, stealing, dishonest or guilty in any user-facing text. Say flagged, held, review, pattern. Never imply the employee did something wrong. Explain findings in plain language.
9. **The score ranks; it never acts.** No automatic consequence from a score.
10. **Do not add fields to the frozen models.**
11. **Follow [DESIGN.md](DESIGN.md) for every screen.** Its tokens, type scale, stack and banned patterns are mandatory. No emojis anywhere, including code comments and commit messages.

## Working agreement

- One branch per stream, `stream/<name>`, off `main`. Merge to `main` when a section is done and its acceptance passes.
- Section 1 of `auth` (scaffold, schema, session, seeded users) is the only thing the others depend on. It should reach `main` first. `admin` and `employee` start with their own section 1 (contracts and fixtures), which needs nothing from `auth`.
- Keep the stream file current. It is how the next session, and your teammates, know where you are.
