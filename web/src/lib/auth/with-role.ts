import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/http";
import { requireRole, requireUser, type SessionUser } from "@/lib/auth/session";

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: Request, ctx: Ctx<P> & { user: SessionUser }) => Promise<Response | NextResponse>;

/**
 * Wrap every route handler under /api/admin in this. Middleware is only the first layer;
 * this re-checks the role server side and turns guard failures into 401 and 403 responses.
 * See the "Guarding API routes" section of the repo README.
 *
 *   export const POST = withRole("ADMIN", async (req, { user, params }) => { ... });
 */
export function withRole<P = Record<string, never>>(role: "ADMIN", handler: Handler<P>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await requireRole(role);
      return await handler(req, { ...ctx, user });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/**
 * Wrap every route handler under /api/employee in this. Any signed-in user passes, and the
 * handler must scope every query by user.id at the database layer.
 */
export function withUser<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await requireUser();
      return await handler(req, { ...ctx, user });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
