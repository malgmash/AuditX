import type { NextAuthConfig } from "next-auth";

// Edge-safe half of the Auth.js config. It must not import the database or argon2, because
// middleware runs on the edge runtime. The Credentials provider is added in auth.ts.
export type AppRole = "EMPLOYEE" | "ADMIN";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // The role in the token is a claim, not a permission. Server code re-checks it against the
      // database in getSessionUser().
      if (user) {
        token.uid = user.id;
        token.role = (user as { role: AppRole }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      if (token.role) (session.user as { role?: AppRole }).role = token.role as AppRole;
      return session;
    },
  },
} satisfies NextAuthConfig;
