import Link from "next/link";
import { EmployeeForm } from "./employee-form";

export const metadata = { title: "Join your organisation" };

export default function RegisterEmployeePage() {
  return (
    <>
      <h1 className="font-serif text-xl font-medium">Join your organisation</h1>
      <p className="mt-1 text-xs text-ink-muted">
        You will join as an employee.{" "}
        <Link href="/register" className="text-slate underline-offset-4 hover:underline">
          Change
        </Link>
      </p>
      <EmployeeForm />
    </>
  );
}
