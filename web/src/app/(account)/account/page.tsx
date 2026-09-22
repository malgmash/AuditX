import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ChangePasswordForm } from "./change-password-form";
import { JoinCode } from "./join-code";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getSessionUser();
  const org =
    user?.role === "ADMIN"
      ? await db.organization.findUnique({ where: { id: user.orgId }, select: { name: true, joinCode: true } })
      : null;

  return (
    <div className="max-w-[420px]">
      <h1 className="font-serif text-3xl font-medium">Account</h1>
      <p className="mt-1 text-xs text-ink-muted">Change the password you use to sign in.</p>
      <div className="mt-6 rounded-card border border-line bg-surface p-6">
        <ChangePasswordForm />
      </div>
      {org ? (
        <div className="mt-6 rounded-card border border-line bg-surface p-6">
          <h2 className="text-base font-semibold">{org.name}</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Share this join code with new employees so they can create their own account.
          </p>
          <div className="mt-3">
            {org.joinCode ? (
              <JoinCode code={org.joinCode} />
            ) : (
              <p className="text-xs text-ink-muted">No join code on this organisation yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
