# AuditX: agent instructions

Read [WORKSTREAMS.md](WORKSTREAMS.md) for the shared rules. **All frontend work must follow [DESIGN.md](DESIGN.md)**: the logo, colour palette, type scale, components and banned patterns. No emojis anywhere, and no generic AI-dashboard styling. Product context is in [AuditX-PRD.md](AuditX-PRD.md), [SYSTEM-DESIGN.md](SYSTEM-DESIGN.md), [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) and [PROMPTS.md](PROMPTS.md).

## When the user says which stream they are working on

Up to four people work in parallel, one stream each. The user will usually just say what they are working on. Match it to a stream file:

| User says | Stream | File |
|---|---|---|
| auth, login, sign up, account creation, access | `auth` | [workstreams/01-auth.md](workstreams/01-auth.md) |
| admin, administrator dashboard | `admin` | [workstreams/02-admin.md](workstreams/02-admin.md) |
| employee, user dashboard, user | `employee` | [workstreams/03-employee.md](workstreams/03-employee.md) |
| analysis, scoring, cases, holds, detectors, extraction, investigator, backend, python | `analysis` | [workstreams/04-analysis.md](workstreams/04-analysis.md) |

If it is unclear which one they mean, ask. Do not guess.

Then, before writing any code:

0. Get on the right branch. Run `git fetch`. Work on `stream/<name>`. If it does not exist, create it from the latest `origin/main` (`git switch -c stream/<name> origin/main`). If it exists, `git switch` to it and merge `origin/main` into it so you start current. Never work on `main` directly and never switch branches with uncommitted changes. If other people or agents share this folder, suggest a git worktree (`git worktree add ../AuditX-<name> stream/<name>`) so branches do not collide.
1. Read WORKSTREAMS.md (including the **Environment** section) and the stream file in full. Check that `web/.env.local` and `analysis/.env` exist. If they do not, tell the user which values are missing and ask them for the files. Never invent secrets and never commit them.
2. Establish the real state. Run `git fetch`, then `git log --oneline -- <the stream's owned paths>`, list those paths, and run the stream's tests if any exist. Compare against each section's **Done when** checklist. Trust the code over the checkboxes. If they disagree, correct the checkboxes.
3. Tell the user, in five lines or fewer: sections done, the section in progress, what you will do next, and anything blocked on another stream.
4. Continue from the first section that is not DONE, or the section the user names, using that section's prompt.

While working:

- Edit only the stream's owned paths. If you need something from another stream or a shared file, add it to the stream file's **Needs from others** list and tell the user. Do not edit the other stream's files.
- Code against the fixtures and interfaces in WORKSTREAMS.md so you never block on another stream. `admin` and `employee` stay on `AUDITX_DATA=fixtures` until their last section.
- The database on Supabase is shared by everyone. Never wipe, reset, reseed or reload it, and never run the generator with `--db`, without asking the user first.
- Time is short. Follow the **Deadline priorities** in WORKSTREAMS.md: build the demo path first, skip what it marks as cut, and say so when you skip something.

When you stop, or finish a section:

- Update the section's status and tick its **Done when** boxes.
- Append a dated entry to the stream file's **Progress log**: what changed, what is next, any blockers.
- Ask before committing or pushing. Commits go on branch `stream/<name>`.
