"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { demoLogin, type LoginState } from "./actions";

/** Sample accounts on synthetic data. Each button signs in on the server, so no password is typed or sent to the browser. */
export function DemoAccess() {
  const [state, action, pending] = useActionState<LoginState, FormData>(demoLogin, {});
  return (
    <section aria-labelledby="demo-heading" className="mt-6 border-t border-line pt-4">
      <h2 id="demo-heading" className="text-base font-semibold">
        Try the demo
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Sample accounts with made-up data. Pick a role to look around.
      </p>
      <form action={action} className="mt-3 flex flex-col gap-2">
        <Button type="submit" name="role" value="admin" variant="secondary" disabled={pending}>
          {pending ? "Signing in" : "Continue as the demo administrator"}
        </Button>
        <Button type="submit" name="role" value="employee" variant="secondary" disabled={pending}>
          {pending ? "Signing in" : "Continue as the demo employee"}
        </Button>
        {state.error ? (
          <p role="alert" className="text-xs text-error">
            {state.error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
