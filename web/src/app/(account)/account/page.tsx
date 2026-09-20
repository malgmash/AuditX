import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="max-w-[420px]">
      <h1 className="font-serif text-3xl font-medium">Account</h1>
      <p className="mt-1 text-xs text-ink-muted">Change the password you use to sign in.</p>
      <div className="mt-6 rounded-card border border-line bg-surface p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
