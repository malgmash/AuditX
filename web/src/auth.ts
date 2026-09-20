import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { parseCredentials } from "@/lib/auth/credentials";
import { dummyHash, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = parseCredentials(raw);
        if (!parsed) return null;
        // When the email is unknown, verify against a real dummy hash so a wrong email and a wrong
        // password take about the same time.
        const user = await db.user.findUnique({ where: { email: parsed.email } });
        const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash()), parsed.password);
        if (!user || !ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
