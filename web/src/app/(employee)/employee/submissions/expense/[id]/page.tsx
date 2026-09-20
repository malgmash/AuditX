import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExpenseDetailView } from "@/components/employee/expense-detail";
import { resolveActingUserId } from "@/lib/employee/acting-user";
import { loadExpenseDetail } from "@/lib/employee/submission-detail";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Expense" };

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const detail = await loadExpenseDetail(resolveActingUserId(user), id);
  if (!detail) notFound();

  return (
    <div className="grid max-w-5xl gap-6">
      <header className="grid gap-1">
        <Link href="/employee/submissions" className="text-xs text-slate underline-offset-4 hover:underline">
          Back to my submissions
        </Link>
        <h1 className="font-serif text-3xl font-medium">{detail.expense.merchantRaw}</h1>
        <p className="text-xs text-ink-muted">Expense, with the receipt and what was read from it.</p>
      </header>

      <ExpenseDetailView
        expense={detail.expense}
        receiptUrl={detail.receiptUrl}
        status={detail.status}
      />
    </div>
  );
}
