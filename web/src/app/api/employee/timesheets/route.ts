import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth/with-role";
import { submitEmployeeTimesheet } from "@/lib/employee/submit-timesheet";

export const runtime = "nodejs";

export const POST = withUser(async (req, { user }) => {
  const body: unknown = await req.json();
  const timesheet = await submitEmployeeTimesheet({ user, body });
  return NextResponse.json({ id: timesheet.id, status: timesheet.status }, { status: 201 });
});
