import { redirect } from "next/navigation";
import { AppHeader } from "@/components/brand/AppHeader";
import { getSessionUser } from "@/lib/auth/session";

// Placeholder shell from the auth stream. The admin stream replaces this layout.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/employee");
  return (
    <>
      <AppHeader homeHref="/admin" userName={user.name} roleLabel="Administrator" />
      <main className="mx-auto max-w-[1200px] px-6 py-6">{children}</main>
    </>
  );
}
