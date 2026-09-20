import { TimesheetForm } from "@/components/employee/timesheet-form";

export const metadata = { title: "Submit a timesheet" };

export default function NewTimesheetPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <TimesheetForm />
    </div>
  );
}
