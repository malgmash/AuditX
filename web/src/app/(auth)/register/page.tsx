import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Create an account" };

// The two paths differ in what they create, so they are separate pages rather than a role field on
// one form. Nothing here decides a role: the employee form always creates an EMPLOYEE, and the
// organisation form only ever administers the organisation it creates in the same transaction.
const paths = [
  {
    href: "/register/employee",
    title: "Join your organisation",
    detail: "For employees. You will need the join code from your administrator.",
    action: "Continue as an employee",
    variant: "default" as const,
  },
  {
    href: "/register/organization",
    title: "Set up a new organisation",
    detail: "You become its administrator. Use this only if your organisation is not on AuditX yet.",
    action: "Set up an organisation",
    variant: "secondary" as const,
  },
];

export default function RegisterPage() {
  return (
    <>
      <h1 className="font-serif text-xl font-medium">Create an account</h1>
      <p className="mt-1 text-xs text-ink-muted">Choose how you are joining.</p>
      <div className="mt-4 flex flex-col gap-3">
        {paths.map((path) => (
          <div key={path.href} className="rounded-card border border-line p-4">
            <h2 className="text-base font-semibold">{path.title}</h2>
            <p className="mt-1 text-xs text-ink-muted">{path.detail}</p>
            <Button asChild variant={path.variant} className="mt-3 w-full">
              <Link href={path.href}>{path.action}</Link>
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-muted">
        To administer an organisation that is already on AuditX, ask one of its administrators to
        invite you. Administrator access cannot be requested here.
      </p>
      <p className="mt-4 text-center text-xs text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-slate underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
