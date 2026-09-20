import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { getAdminRepo } from "@/lib/admin/repo";

export const dynamic = "force-dynamic";

/** Everything the dashboard figures and the four charts read. Administrators only. */
export const GET = withRole("ADMIN", async () => NextResponse.json(await getAdminRepo().getStats()));
