import Link from "next/link";
import { signOut } from "@/auth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { EmployeeNav } from "@/components/employee/nav";
import { EmployeeParticles } from "@/components/employee/particles";
import { NotificationBell } from "@/components/notifications/NotificationBell";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function EmployeeSidebar({
  userName,
  userEmail,
  department,
  roleLabel,
}: {
  userName: string;
  userEmail: string;
  department: string;
  roleLabel: string;
}) {
  const initials = initialsFromName(userName);

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-surface px-4 py-4 md:sticky md:top-0 md:h-[100dvh] md:w-60 md:border-b-0 md:border-r md:px-5 md:py-6">
      <Logo href="/employee" />
      <nav aria-label="Main" className="mt-4 flex flex-row flex-wrap items-center md:mt-8 md:flex-col md:items-stretch">
        <EmployeeNav />
      </nav>

      <div className="mt-6 border-t border-line pt-4 md:mt-auto md:pt-6">
        <p className="text-xs font-semibold text-ink-muted">Profile</p>
        <div className="mt-3 flex items-start gap-3">
          <div
            className="grid size-10 shrink-0 place-items-center rounded-control bg-slate-tint text-sm font-semibold text-slate"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5">{userName}</p>
            <p className="truncate text-xs leading-4 text-ink-muted">{userEmail}</p>
            <p className="mt-1 text-xs leading-4 text-ink-muted">
              {department || "No department"} · {roleLabel}
            </p>
          </div>
        </div>
      </div>
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

export function EmployeeShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] bg-bone">
      <EmployeeParticles />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
