import { NextResponse } from "next/server";
import { DEMO_ACCOUNTS, demoLoginEnabled } from "@/lib/auth/demo";

// A setup check for the demo deployment: open /api/health and read which part is wrong. It returns
// yes or no answers and short error codes only. It never returns a secret, a connection string, a
// host name, or a password hash. Off when DEMO_LOGIN=off.
export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail: string };

function envCheck(): Record<string, Check> {
  const url = process.env.DATABASE_URL ?? "";
  let port = "";
  let pooler = false;
  let username = "";
  try {
    const parsed = new URL(url);
    port = parsed.port;
    pooler = parsed.searchParams.get("pgbouncer") === "true";
    username = decodeURIComponent(parsed.username);
  } catch {
    /* reported below as unreadable */
  }
  return {
    AUTH_SECRET: { ok: Boolean(process.env.AUTH_SECRET), detail: process.env.AUTH_SECRET ? "set" : "missing" },
    AUTH_TRUST_HOST: {
      ok: process.env.AUTH_TRUST_HOST === "true",
      detail: process.env.AUTH_TRUST_HOST ? `is "${process.env.AUTH_TRUST_HOST}", should be "true"` : "missing",
    },
    AUDITX_DATA: { ok: process.env.AUDITX_DATA === "db", detail: `is "${process.env.AUDITX_DATA ?? ""}", should be "db"` },
    DATABASE_URL: {
      ok: Boolean(url) && port === "6543" && pooler && username.includes("."),
      detail: !url
        ? "missing"
        : `port ${port || "?"} (want 6543), pgbouncer=true ${pooler ? "yes" : "no"}, pooler-style username ${username.includes(".") ? "yes" : "no (want postgres.<project-ref>)"}`,
    },
    ANALYSIS_URL: { ok: Boolean(process.env.ANALYSIS_URL), detail: process.env.ANALYSIS_URL ? "set" : "missing" },
    INTERNAL_TOKEN: { ok: Boolean(process.env.INTERNAL_TOKEN), detail: process.env.INTERNAL_TOKEN ? "set" : "missing" },
    S3_BUCKET: { ok: Boolean(process.env.S3_BUCKET && process.env.S3_ENDPOINT), detail: process.env.S3_ENDPOINT ? "set" : "missing" },
  };
}

function safeError(err: unknown): string {
  const e = err as { name?: string; code?: string; message?: string };
  const message = String(e?.message ?? "");
  const hints: [RegExp, string][] = [
    [/Tenant or user not found/i, "the database username or project ref in DATABASE_URL is wrong"],
    [/password authentication failed|Authentication failed/i, "the database password in DATABASE_URL is wrong"],
    [/prepared statement/i, "DATABASE_URL needs ?pgbouncer=true"],
    [/max clients|too many/i, "too many database connections; use the transaction pooler on port 6543"],
    [/Can't reach database server|ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i, "the database host cannot be reached"],
    [/does not exist/i, "the database has no tables; the schema has not been pushed to this database"],
  ];
  const hint = hints.find(([re]) => re.test(message))?.[1];
  return [e?.name ?? "Error", e?.code, hint].filter(Boolean).join(" | ");
}

export async function GET() {
  if (!demoLoginEnabled()) return new NextResponse(null, { status: 404 });

  const checks: Record<string, Check> = envCheck();

  try {
    const { db } = await import("@/lib/db");
    const users = await db.user.findMany({
      where: { email: { in: Object.values(DEMO_ACCOUNTS).map((a) => a.email) } },
      select: { email: true, passwordHash: true },
    });
    checks.database = { ok: true, detail: "connected" };
    try {
      const { verifyPassword } = await import("@/lib/auth/password");
      for (const account of Object.values(DEMO_ACCOUNTS)) {
        const user = users.find((u) => u.email === account.email);
        if (!user) {
          checks[account.email] = { ok: false, detail: "no such user in this database; run the seed" };
          continue;
        }
        const matches = await verifyPassword(user.passwordHash, account.password);
        checks[account.email] = {
          ok: matches,
          detail: matches ? "found, password matches" : "found, but the password does not match (or the hash cannot be read)",
        };
      }
    } catch (err) {
      checks.passwordCheck = { ok: false, detail: safeError(err) };
    }
  } catch (err) {
    checks.database = { ok: false, detail: safeError(err) };
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
