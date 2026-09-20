import { redirect } from "next/navigation";
import { AppHeader } from "@/components/brand/AppHeader";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { getSessionUser } from "@/lib/auth/session";

// Shared by both roles. The page is the same for an employee and an administrator.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=%2Faccount");
  const admin = user.role === "ADMIN";
  return (
    <>
      <AppHeader
        homeHref={admin ? "/admin" : "/employee"}
        userName={user.name}
        roleLabel={admin ? "Administrator" : "Employee"}
        actions={<NotificationBell />}
      />
      <main className="mx-auto max-w-[1200px] px-6 py-6">{children}</main>
    </>
  );
}
