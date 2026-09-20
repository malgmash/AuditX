import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth/with-role";
import { submitEmployeeExpense } from "@/lib/employee/submit-expense";

export const runtime = "nodejs";

export const POST = withUser(async (req, { user }) => {
  const form = await req.formData();
  const result = await submitEmployeeExpense({ user, form });
  return NextResponse.json(
    {
      id: result.expense.id,
      status: result.expense.status,
      fallback: result.fallback,
    },
    { status: 201 },
  );
});
