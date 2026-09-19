import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// First layer of route protection. Runs on the edge, so it only reads the JWT claim.
// Every handler and page still re-checks the role server side (getSessionUser, requireRole).
const { auth } = NextAuth(authConfig);

const home = (role?: string) => (role === "ADMIN" ? "/admin" : "/employee");

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isApi = pathname.startsWith("/api/");

  const deny = (status: 401 | 403) =>
    isApi
      ? NextResponse.json({ error: status === 401 ? "Sign in required" : "Not allowed" }, { status })
      : null;

  if (pathname === "/login" || pathname === "/register") {
    return session ? NextResponse.redirect(new URL(home(role), req.url)) : NextResponse.next();
  }

  const needsAdmin =
    pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  const needsUser =
    needsAdmin ||
    pathname === "/employee" ||
    pathname.startsWith("/employee/") ||
    pathname.startsWith("/api/employee/") ||
    pathname.startsWith("/api/notifications");

  if (needsUser && !session) {
    const res = deny(401);
    if (res) return res;
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (needsAdmin && role !== "ADMIN") {
    return deny(403) ?? NextResponse.redirect(new URL(home(role), req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
