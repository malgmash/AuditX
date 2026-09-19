# Workstreams

Three people, three streams, working at the same time without blocking each other.

| Stream | Builds | Stream file | Branch |
|---|---|---|---|
| `auth` | Login, account creation, role enforcement, notifications plumbing | [01-auth.md](workstreams/01-auth.md) | `stream/auth` |
| `admin` | Administrator dashboard, case queue, holds, employee table, charts | [02-admin.md](workstreams/02-admin.md) | `stream/admin` |
| `employee` | Employee dashboard, expense and timesheet submission, own record | [03-employee.md](workstreams/03-employee.md) | `stream/employee` |

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

The analysis service (extraction, detectors, baselines, scoring engine, investigator) and the synthetic data generator are not assigned to any stream. Each stream builds against fixtures and a thin interface, so the real thing can be swapped in with one change. If nobody owns them yet, that is the next thing to assign.

## Ownership

Each stream edits only its own paths. This is what keeps three people from colliding.

| Stream | Owns |
|---|---|
| `auth` | Repo scaffold, design tokens and base UI (`web/src/app/globals.css`, `web/src/components/ui/**`, `web/src/components/brand/**`), `docker-compose.yml`, `web/prisma/**`, `web/src/auth*`, `web/src/middleware.ts`, `web/src/app/(auth)/**`, `web/src/app/api/auth/**`, `web/src/app/api/notifications/**`, `web/src/lib/auth/**`, `web/src/lib/notifications/**`, `web/src/components/notifications/**` |
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
