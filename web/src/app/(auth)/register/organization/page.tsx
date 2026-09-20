import Link from "next/link";
import { OrganizationForm } from "./organization-form";

export const metadata = { title: "Set up a new organisation" };

export default function RegisterOrganizationPage() {
  return (
    <>
      <h1 className="font-serif text-xl font-medium">Set up a new organisation</h1>
      <p className="mt-1 text-xs text-ink-muted">
        You will be its administrator. It starts empty, with you as its only member.{" "}
        <Link href="/register" className="text-slate underline-offset-4 hover:underline">
          Change
        </Link>
      </p>
      <OrganizationForm />
    </>
  );
}
