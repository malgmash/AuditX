# AuditX

**Your AI finance investigator for small businesses.**

---

## What it is

AuditX is an AI powered financial investigation platform that helps small businesses identify suspicious financial activity across employee expenses, receipts, invoices, and timesheets.

Instead of requiring a finance manager to manually review thousands of records, AuditX audits and analyzes financial activity, identifies unusual patterns, groups related anomalies into investigation cases, and explains why each case deserves attention.

AuditX does not determine whether fraud occurred. It highlights suspicious patterns, presents supporting evidence, and allows a human reviewer to make the final decision.

---

## The user story

As a small business finance manager, I want AuditX to automatically analyze financial records so I can quickly identify suspicious activity without manually reviewing every transaction.

I also want AuditX to explain why something was flagged so that I can investigate it fairly before making any decision.

---

## The problem

Small businesses generate more financial activity than any one person can inspect. Expenses, receipts, invoices, and timesheets stack up every week. The finance manager is expected to protect the company, but there is no team of analysts behind them.

So reviews stay shallow. Unusual patterns go unnoticed. And when something does stand out, there is often not enough context to investigate it properly.

The bottleneck is not missing data. It is missing investigation capacity.

---

## What the AI investigator does

Think of AuditX as an AI finance investigator working alongside you.

**It reads the records.** Expenses, receipt images, invoices, and timesheets are analyzed automatically as they come in.

**It finds what is unusual.** Duplicate receipts, abnormal spending, inconsistent timesheets, and cross record signals that are hard to spot by hand, like hours logged in one city while a receipt places the same person somewhere else on the same day.

**It builds cases.** Related anomalies are grouped into investigation cases, not loose alerts. Each case is a structured file ready for review.

**It writes the investigation brief.** For every case, AuditX explains what was found, why it stands out, what evidence supports it, what review steps to take, what questions to ask, and what innocent explanations are plausible. You get context, not just a flag.

**It stops before the verdict.** The AI investigator never decides guilt. It prepares the case. You make the call.

---

## A day in the workflow

You log in and see a ranked queue of investigation cases, not thousands of raw transactions.

Open a case. The investigation brief is already written. The evidence is attached. The pattern is explained. You can accept, decline, or dig deeper into the employee's full record and timeline.

What used to take days of manual review becomes a focused investigation you can work through in minutes.

---

## For employees

AuditX keeps the process fair. Employees can see their own record: what was flagged, why it was flagged, and the status of anything under review. The AI investigates activity. It does not pass judgment on people.

---

## Why AuditX

Most tools record transactions or enforce rules at submission. AuditX investigates after the fact, at scale, with AI that does the analytical work a small finance team cannot do alone.

It is not a fraud detection verdict machine. It is an AI finance investigator that finds the patterns, builds the case, explains the evidence, and hands you a fair starting point for every decision.

---

## One line

**AuditX is an AI finance investigator that analyzes financial records, groups suspicious activity into cases, and explains why each one deserves your attention, so you can investigate fairly without reviewing every transaction yourself.**

---

## Documents

| | |
|---|---|
| [AuditX-PRD.md](AuditX-PRD.md) | What we are building and why |
| [SYSTEM-DESIGN.md](SYSTEM-DESIGN.md) | Services, data model, detectors, scoring, routes |
| [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) | The hard calls, including what the evaluation found |
| [PROMPTS.md](PROMPTS.md) | Build prompts and the runtime prompts the app sends to the model |
| [DATA-GENERATION.md](DATA-GENERATION.md) | The synthetic company and the planted problems |
| [DESIGN.md](DESIGN.md) | Frontend design system: logo, colours, type, components |
| [WORKSTREAMS.md](WORKSTREAMS.md) | Three people, three streams, how to pick up where you left off |

## Layout

```
web/         Next.js 15, Auth.js, Prisma, Tailwind. Everything a user touches.
analysis/    FastAPI. Detectors, severity, baselines, synthetic data, evaluation.
brand/       Logo and palette reference images.
workstreams/ One file per stream: sections, prompts, progress.
```

## Run it

Needs Node 20+ and Python 3.11+. The team uses hosted Supabase Postgres and Storage in place of Docker, so see the Environment section of WORKSTREAMS.md before running anything. Docker is optional and only needed for the local `docker compose` stack.

```bash
docker compose up -d                      # Postgres and MinIO
cp .env.example web/.env.local            # then edit the secrets
cd web && npm install && npm run db:push && npm run db:seed && npm run dev
```

Sign in at http://localhost:3000/login.

| | Email | Password |
|---|---|---|
| Administrator | admin@auditx.local | AuditX-admin-2026 |
| Employee | employee@auditx.local | AuditX-employee-2026 |

These are development passwords. The analysis service, the 45-employee synthetic dataset and the evaluation are documented in [analysis/README.md](analysis/README.md).

## Working on it

Three streams, one per person: `auth`, `admin`, `employee`. Tell your AI agent which one you are on and it reads [AGENTS.md](AGENTS.md), finds your stream file, checks what is already built and carries on.

## Guarding API routes

Middleware is only the first layer: it reads the role claim in the JWT. Every handler must re-check the session against the database.

Wrap every `/api/admin` handler:

```ts
import { withRole } from "@/lib/auth/with-role";

export const POST = withRole("ADMIN", async (req, { user, params }) => {
  // ...
});
```

Wrap every `/api/employee` handler with `withUser`. Scope every query by `user.id` at the database layer (never filter in the UI). For an expense loaded from a URL id, use `loadOwnExpense` or `ownExpenseWhere` from `@/lib/auth/own-expense` so another employee's row is a 404, not a hit.

```ts
import { withUser } from "@/lib/auth/with-role";
import { loadOwnExpense } from "@/lib/auth/own-expense";

export const GET = withUser<{ id: string }>(async (_req, { user, params }) => {
  const { id } = await params;
  const expense = await loadOwnExpense(user.id, id);
  return Response.json(expense);
});
```
