import Link from "next/link";
import { signOut } from "@/auth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { EmployeeNav } from "@/components/employee/nav";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function EmployeeSidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-surface px-4 py-3 md:sticky md:top-0 md:h-screen md:w-52 md:border-b-0 md:border-r md:py-6">
      <Logo href="/employee" />
      <nav aria-label="Main" className="mt-3 flex flex-row flex-wrap items-center md:mt-8 md:flex-col md:items-stretch">
        <EmployeeNav />
      </nav>
    </aside>
  );
}

export function EmployeeTopbar({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-line bg-surface px-6">
      <NotificationBell />
      <Link
        href="/account"
        className="inline-flex min-h-10 items-center text-sm text-slate underline-offset-4 hover:underline"
      >
        Account
      </Link>
      <div className="text-right leading-tight">
        <div className="text-sm font-semibold">{userName}</div>
        <div className="text-xs text-ink-muted">{roleLabel}</div>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="secondary" className="min-h-10">
          Sign out
        </Button>
      </form>
    </header>
  );
}
