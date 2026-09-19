import { redirect } from "next/navigation";
import { AppHeader } from "@/components/brand/AppHeader";
import { getSessionUser } from "@/lib/auth/session";

// Placeholder shell from the auth stream. The employee stream replaces this layout.
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <>
      <AppHeader
        homeHref="/employee"
        userName={user.name}
        roleLabel={user.role === "ADMIN" ? "Administrator" : "Employee"}
      />
      <main className="mx-auto max-w-[960px] px-6 py-6">{children}</main>
    </>
  );
}
