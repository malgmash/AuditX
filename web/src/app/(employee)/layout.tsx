import { redirect } from "next/navigation";
import { HoldLiveRefresh } from "@/components/employee/hold-live-refresh";
import { EmployeeSidebar, EmployeeTopbar } from "@/components/employee/shell";
import { getSessionUser } from "@/lib/auth/session";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const roleLabel = user.role === "ADMIN" ? "Administrator" : "Employee";

  return (
    <div className="flex min-h-screen flex-col bg-bone md:flex-row">
      <EmployeeSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <EmployeeTopbar userName={user.name} roleLabel={roleLabel} />
        <HoldLiveRefresh />
        <main className="w-full flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
