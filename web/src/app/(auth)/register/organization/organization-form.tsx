"use client";

import { useActionState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { organizationFieldsSchema, type OrganizationFields } from "@/lib/auth/register-schema";
import { registerOrganization, type RegisterState } from "../actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-error">
      {message}
    </p>
  );
}

export function OrganizationForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerOrganization,
    {},
  );
  const [submitting, startTransition] = useTransition();
  const form = useForm<OrganizationFields>({
    resolver: zodResolver(organizationFieldsSchema),
    mode: "onChange",
    defaultValues: {
      organizationName: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      startDate: "",
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
        <Label htmlFor="organizationName">Organisation name</Label>
        <Input
          id="organizationName"
          autoComplete="organization"
          aria-invalid={!!errors.organizationName || !!state.fieldErrors?.organizationName}
          {...form.register("organizationName")}
        />
        <FieldError
          message={errors.organizationName?.message ?? state.fieldErrors?.organizationName?.[0]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          autoComplete="name"
          aria-invalid={!!errors.name || !!state.fieldErrors?.name}
          {...form.register("name")}
        />
        <FieldError message={errors.name?.message ?? state.fieldErrors?.name?.[0]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Work email</Label>
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
        <FieldError
          message={errors.confirmPassword?.message ?? state.fieldErrors?.confirmPassword?.[0]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startDate">Your start date</Label>
        <Input
          id="startDate"
          type="date"
          aria-invalid={!!errors.startDate || !!state.fieldErrors?.startDate}
          {...form.register("startDate")}
        />
        <FieldError message={errors.startDate?.message ?? state.fieldErrors?.startDate?.[0]} />
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-error">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Creating organisation" : "Create organisation"}
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
