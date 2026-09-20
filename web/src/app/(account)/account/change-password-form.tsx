"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, type ChangePasswordState } from "./actions";

function Field({
  id,
  label,
  autoComplete,
  errors,
  hint,
}: {
  id: string;
  label: string;
  autoComplete: string;
  errors?: string[];
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type="password" autoComplete={autoComplete} required aria-invalid={!!errors?.length} />
      {hint && !errors?.length ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {errors?.length ? (
        <p role="alert" className="text-xs text-error">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field id="currentPassword" label="Current password" autoComplete="current-password" errors={fe.currentPassword} />
      <Field id="newPassword" label="New password" autoComplete="new-password" errors={fe.newPassword} hint="At least 10 characters." />
      <Field id="confirmPassword" label="Confirm new password" autoComplete="new-password" errors={fe.confirmPassword} />
      {state.error && !Object.keys(fe).length ? (
        <p role="alert" className="text-xs text-error">
          {state.error}
        </p>
      ) : null}
      {state.done ? (
        <p role="status" className="text-sm text-sage-text">
          Password changed. Use the new one next time you sign in.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving" : "Change password"}
      </Button>
    </form>
  );
}
