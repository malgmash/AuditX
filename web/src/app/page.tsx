import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Root() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/employee");
  return <LandingPage />;
}
