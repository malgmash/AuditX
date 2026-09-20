import { redirect } from "next/navigation";
import { HoldLiveRefresh } from "@/components/employee/hold-live-refresh";
import {
  EmployeeShellFrame,
  EmployeeSidebar,
  EmployeeTopbar,
} from "@/components/employee/shell";
import { getSessionUser } from "@/lib/auth/session";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const roleLabel = user.role === "ADMIN" ? "Administrator" : "Employee";

  return (
    <EmployeeShellFrame>
      <div className="flex min-h-[100dvh] flex-col md:flex-row">
        <EmployeeSidebar
          userName={user.name}
          userEmail={user.email}
          department={user.department}
          roleLabel={roleLabel}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <EmployeeTopbar userName={user.name} roleLabel={roleLabel} />
          <HoldLiveRefresh />
          <main className="mx-auto w-full max-w-[960px] flex-1 px-6 py-6 pb-12">{children}</main>
        </div>
      </div>
    </EmployeeShellFrame>
  );
}
