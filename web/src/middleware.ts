import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { decideRouteAccess } from "@/lib/auth/route-guard";

// First layer of route protection. Runs on the edge, so it only reads the JWT claim.
// Every handler and page still re-checks the role server side (getSessionUser, withRole, withUser).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  const decision = decideRouteAccess({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    signedIn: Boolean(req.auth),
    role,
    hadSessionCookie: Boolean(
      req.cookies.get("authjs.session-token") ?? req.cookies.get("__Secure-authjs.session-token"),
    ),
  });

  switch (decision.type) {
    case "redirect":
      return NextResponse.redirect(new URL(decision.to, req.url));
    case "json":
      return NextResponse.json({ error: decision.error }, { status: decision.status });
    default:
      return NextResponse.next();
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
