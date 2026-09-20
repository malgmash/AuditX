import { ExpenseForm } from "@/components/employee/expense-form";

export const metadata = { title: "Submit an expense" };

export default function NewExpensePage() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <ExpenseForm />
    </div>
  );
}
