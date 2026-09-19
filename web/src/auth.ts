import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { dummyHash, verifyPassword } from "@/lib/auth/password";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        // When the email is unknown, verify against a real dummy hash so a wrong email and a wrong
        // password take about the same time.
        const user = await db.user.findUnique({ where: { email } });
        const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash()), parsed.data.password);
        if (!user || !ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
