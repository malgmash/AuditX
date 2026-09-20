import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminRepo } from "@/lib/admin/repo";

/**
 * The administrator shell. Middleware is the first layer of protection; this re-reads the user
 * and role server side, so a stale token cannot reach these screens.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/employee");

  const openCases = (await getAdminRepo().listOpenCases()).length;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar openCases={openCases} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-end gap-3 px-6 pt-4">
          <NotificationBell />
          <Link href="/account" className="text-xs font-semibold text-slate underline-offset-4 hover:underline">
            Account
          </Link>
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-ink-muted">Administrator</div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        </div>
        <main className="max-w-[1200px] px-6 pb-12 pt-4">{children}</main>
      </div>
    </div>
  );
}
