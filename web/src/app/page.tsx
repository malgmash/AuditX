import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export default async function Root() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" ? "/admin" : "/employee");
}
