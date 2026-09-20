import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { parseCredentials } from "@/lib/auth/credentials";
import { dummyHash, verifyPassword } from "@/lib/auth/password";
import { clientIp, loginThrottle } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = parseCredentials(raw);
        if (!parsed) return null;
        // Direct calls to /api/auth/callback/credentials skip the login form, so they are throttled here too.
        // The form path also checks the address in its own action, where the request headers are known.
        const viaApi = Boolean(request?.url?.includes("/api/auth/callback"));
        const ip = viaApi ? clientIp(request.headers) : undefined;
        if (loginThrottle.check(parsed.email, ip).blocked) return null;
        // When the email is unknown, verify against a real dummy hash so a wrong email and a wrong
        // password take about the same time.
        const user = await db.user.findUnique({ where: { email: parsed.email } });
        const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash()), parsed.password);
        if (!user || !ok) {
          loginThrottle.fail(parsed.email, ip);
          return null;
        }
        loginThrottle.succeed(parsed.email);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
