# AuditX web

## Demo accounts

| Who | Email | Password | Lands on |
|---|---|---|---|
| Administrator | `admin@auditx.local` | `AuditX-admin-2026` | `/admin` |
| Employee with three holds | `employee@auditx.local` | `AuditX-employee-2026` | `/employee` |
| Any generated employee | `name.NN@auditx.demo`, for example `amanda.hansen.11@auditx.demo` | `AuditX-demo-2026` | `/employee` |

These are development passwords, defined in `prisma/seed.ts`. New people can also register: an employee with the organisation join code (`ORG_JOIN_CODE`), or a new organisation with its founding administrator.

**Reset them.** `npm run db:seed` from this folder puts the two named accounts back to the passwords above and re-enables any generated employee whose sign-in was disabled. It never overwrites a generated employee who has set a password. It is safe to run repeatedly. To change one account's password by hand, use `npm run db:set-password`.

**Do not run `npm run db:reset` against the shared database.** It drops every table.

## Checks

`npm test` runs every test (auth, notifications, employee, route guards). `npm run typecheck` and `npm run lint` check the rest.

## Sign-in protections

- Five failed sign-ins for one email lock that email for 15 minutes, and twenty from one address lock the address. Sign-up is limited to five attempts per email and ten per address per hour. The counters live in the server process and reset on restart.
- Set `AUTH_RATE_LIMIT=off` in `.env.local` while rehearsing a demo so a fumbled password cannot lock the demo account.
- Responses carry `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`, plus `Strict-Transport-Security` in production. There is no Content-Security-Policy yet.
- A session cookie that is not one Auth.js issued is ignored, and the role is re-read from the database on every protected request.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
