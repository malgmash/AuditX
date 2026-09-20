import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TimesheetDetailView } from "@/components/employee/timesheet-detail";
import { resolveActingUserId } from "@/lib/employee/acting-user";
import { loadTimesheetDetail } from "@/lib/employee/submission-detail";
import { weekLabel } from "@/lib/employee/submissions";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Timesheet" };

export default async function TimesheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const detail = await loadTimesheetDetail(resolveActingUserId(user), id);
  if (!detail) notFound();

  return (
    <div className="grid max-w-5xl gap-6">
      <header className="grid gap-1">
        <Link href="/employee/submissions" className="text-xs text-slate underline-offset-4 hover:underline">
          Back to my submissions
        </Link>
        <h1 className="font-serif text-3xl font-medium">{weekLabel(detail.timesheet.weekStart)}</h1>
        <p className="text-xs text-ink-muted">Timesheet, day by day, as you submitted it.</p>
      </header>

      <TimesheetDetailView timesheet={detail.timesheet} />
    </div>
  );
}
