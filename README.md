# AuditX

Instead of requiring a finance manager to manually review thousands of records, AuditX audits and analyzes financial activity, identifies unusual patterns, groups related anomalies into investigation cases, and explains why each case deserves attention.

Built for companies of 20 to 100 employees, large enough for expense and timesheet submissions to go unchecked and too small to employ anyone to check them.

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

Needs Node 20+, Python 3.11+ and Docker.

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
