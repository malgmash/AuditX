export type GuardDecision =
  | { type: "next" }
  | { type: "redirect"; to: string }
  | { type: "json"; status: 401 | 403; error: string };

function pathMatches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function home(role?: string): string {
  return role === "ADMIN" ? "/admin" : "/employee";
}

function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathMatches(pathname, "/register") ||
    pathMatches(pathname, "/api/auth")
  );
}

/**
 * First layer of route protection. Middleware applies this from the JWT claim only.
 * Pages and handlers still re-check the role with getSessionUser / withRole / withUser.
 */
export function decideRouteAccess(input: {
  pathname: string;
  search?: string;
  signedIn: boolean;
  role?: string;
  /** A session cookie was sent but no longer verifies, so the session has expired. */
  hadSessionCookie?: boolean;
}): GuardDecision {
  const { pathname, signedIn, role } = input;
  const search = input.search ?? "";
  const isApi = pathname.startsWith("/api/");

  if (isPublicAuthPath(pathname)) {
    if (signedIn && (pathname === "/login" || pathMatches(pathname, "/register"))) {
      return { type: "redirect", to: home(role) };
    }
    return { type: "next" };
  }

  const needsAdmin = pathMatches(pathname, "/admin") || pathMatches(pathname, "/api/admin");
  const needsSession =
    needsAdmin ||
    pathMatches(pathname, "/employee") ||
    pathMatches(pathname, "/account") ||
    pathMatches(pathname, "/api/employee") ||
    pathMatches(pathname, "/api/notifications");

  if (needsSession && !signedIn) {
    if (isApi) return { type: "json", status: 401, error: "Sign in required" };
    const callbackUrl = pathname + search;
    const expired = input.hadSessionCookie ? "&expired=1" : "";
    return { type: "redirect", to: `/login?callbackUrl=${encodeURIComponent(callbackUrl)}${expired}` };
  }

  if (needsAdmin && role !== "ADMIN") {
    if (isApi) return { type: "json", status: 403, error: "Not allowed" };
    return { type: "redirect", to: home(role) };
  }

  return { type: "next" };
}
