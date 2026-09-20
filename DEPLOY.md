# Deploying AuditX

Two services, one database.

| Service | Host | Folder |
|---|---|---|
| Web app (Next.js) | Vercel | `web/` |
| Analysis service (FastAPI) | Render, Railway or Fly | `analysis/` |
| Database and receipt images | Supabase (already set up) | |

Deploy the analysis service first, because the web app needs its address.

## 1. Analysis service on Render

1. On render.com choose **New > Blueprint** and pick this repository. Render reads `render.yaml`.
   Or create a **Web Service** by hand: root directory `analysis`, build `pip install -r requirements.txt`,
   start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/health`.
2. Set `DATABASE_URL` to the Supabase **Session pooler** URL (port 5432). The Prisma-only parameters
   such as `connection_limit` are ignored by the Python side.
3. `INTERNAL_TOKEN` is generated for you. Copy it, because the web app needs the same value.
   Never deploy with the default `dev-internal-token`: it is public in the code.
4. Open `https://<your-service>.onrender.com/health`. It should say `{"status":"ok"}`.

The free plan sleeps after a quiet spell and the first request afterwards takes 30 to 60 seconds. Open
`/health` a minute before a demo. `render.yaml` pins Python 3.13.5. The dependency pins are the ones that run
on Python 3.14 locally, and a 3.13 install has not been tried.

## 2. Web app on Vercel

1. On vercel.com choose **Add New > Project** and import this repository.
2. Set the **Root Directory** to `web`. The framework is detected as Next.js. `prisma generate` runs on install.
3. Add these environment variables in **Settings > Environment Variables**. Do not put them in git.

| Name | Value |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler**: same host as the session URL, port **6543**, ending `?pgbouncer=true&connection_limit=1` |
| `AUTH_SECRET` | a new random string: `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` |
| `ORG_JOIN_CODE` | the code new employees use to sign up |
| `AUDITX_DATA` | `db` |
| `S3_ENDPOINT` | `https://<project-ref>.storage.supabase.co/storage/v1/s3` |
| `S3_REGION` | `us-west-2` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | the Supabase Storage S3 keys |
| `S3_BUCKET` | `receipts` |
| `ANALYSIS_URL` | the Render address, with no trailing slash |
| `INTERNAL_TOKEN` | the same value as on the analysis service |

`web/vercel.json` puts the functions in `sfo1`, which is closest to a Supabase project in us-west-2. Every
database call crosses that distance, so keep the region matched to the database.

4. Deploy, open the site, sign in as `admin@auditx.local`, and check the dashboard, one case, and the recompute button.

## Why the transaction pooler

Vercel runs many short-lived copies of the app and each opens its own database connection. The session pooler
allows 15 in total and would run out. The transaction pooler shares connections between requests. Keep the
**session** pooler URL for the analysis service and for `db push` and `db seed`, which need it.

## What behaves differently on a serverless host

- **Receipt uploads** go to the private `receipts` bucket, not to memory, so they survive between requests.
- **Notification bell:** the live stream closes itself after 50 seconds and the browser reconnects at once. The
  bell also polls every 15 seconds, so it stays correct.
- **Receipt reading (OCR)** runs on the server with `tesseract.js` and downloads its language data on first use.
  It may be slow or fail. The form then falls back to typing the fields by hand. Test it once after deploying.
- **Sign-in throttling** counts attempts in one server's memory, so on Vercel it only limits loosely.
- **Time limits:** a decision or a recompute takes about 10 seconds. Check your plan allows functions to run that long.

## Before a public demo

- Rotate the database password, the storage keys and any API keys that have been pasted into chat or notes.
- Use a fresh `AUTH_SECRET` and `INTERNAL_TOKEN`. Change the demo passwords in `web/prisma/seed.ts`, then run `npm run db:seed`.
- Set `AUTH_RATE_LIMIT=off` only for a rehearsal, never on a public site.
- The sign-in page has "Continue as the demo administrator" and "Continue as the demo employee" buttons that sign in as the two seeded accounts with no password. They are on by default. Set `DEMO_LOGIN=off` in Vercel for any site that holds real people's data, since anyone who can open the page can use them.
