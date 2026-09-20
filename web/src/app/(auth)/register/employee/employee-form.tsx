"use client";

import { useActionState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerFieldsSchema, type RegisterFields } from "@/lib/auth/register-schema";
import { registerAccount, type RegisterState } from "../actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-error">
      {message}
    </p>
  );
}

export function EmployeeForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(registerAccount, {});
  const [submitting, startTransition] = useTransition();
  const form = useForm<RegisterFields>({
    resolver: zodResolver(registerFieldsSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      department: "",
      jobTitle: "",
      startDate: "",
      joinCode: "",
    },
  });

  const password = form.watch("password") ?? "";
  const longEnough = password.length >= 10;
  const errors = form.formState.errors;

  const busy = pending || submitting;

  return (
    <form
      className="mt-4 flex flex-col gap-4"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        const data = new FormData();
        for (const [key, value] of Object.entries(values)) {
          data.set(key, value);
        }
        startTransition(() => {
          formAction(data);
        });
      })}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          autoComplete="name"
          aria-invalid={!!errors.name || !!state.fieldErrors?.name}
          {...form.register("name")}
        />
        <FieldError message={errors.name?.message ?? state.fieldErrors?.name?.[0]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email || !!state.fieldErrors?.email}
          {...form.register("email")}
        />
        <FieldError message={errors.email?.message ?? state.fieldErrors?.email?.[0]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password || !!state.fieldErrors?.password}
          aria-describedby="password-rule"
          {...form.register("password")}
        />
        <p id="password-rule" className={longEnough ? "text-xs text-sage-text" : "text-xs text-ink-muted"}>
          {longEnough ? "At least 10 characters. Met." : "At least 10 characters."}
        </p>
        <FieldError message={errors.password?.message ?? state.fieldErrors?.password?.[0]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword || !!state.fieldErrors?.confirmPassword}
          {...form.register("confirmPassword")}
        />
        <FieldError message={errors.confirmPassword?.message ?? state.fieldErrors?.confirmPassword?.[0]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="department">Department</Label>
        <Input
          id="department"
          autoComplete="organization"
          aria-invalid={!!errors.department || !!state.fieldErrors?.department}
          {...form.register("department")}
        />
        <FieldError message={errors.department?.message ?? state.fieldErrors?.department?.[0]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="jobTitle">Job title</Label>
        <Input
          id="jobTitle"
          aria-invalid={!!errors.jobTitle || !!state.fieldErrors?.jobTitle}
          {...form.register("jobTitle")}
        />
        <FieldError message={errors.jobTitle?.message ?? state.fieldErrors?.jobTitle?.[0]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startDate">Start date</Label>
        <Input
          id="startDate"
          type="date"
          aria-invalid={!!errors.startDate || !!state.fieldErrors?.startDate}
          {...form.register("startDate")}
        />
        <FieldError message={errors.startDate?.message ?? state.fieldErrors?.startDate?.[0]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="joinCode">Join code</Label>
        <Input
          id="joinCode"
          autoComplete="off"
          aria-invalid={!!errors.joinCode || !!state.fieldErrors?.joinCode}
          {...form.register("joinCode")}
        />
        <FieldError message={errors.joinCode?.message ?? state.fieldErrors?.joinCode?.[0]} />
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-error">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Creating account" : "Create account"}
      </Button>
      <p className="text-center text-xs text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-slate underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
