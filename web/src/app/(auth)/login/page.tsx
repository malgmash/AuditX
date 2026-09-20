import { demoLoginEnabled } from "@/lib/auth/demo";
import { DemoAccess } from "./demo-access";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; expired?: string }>;
}) {
  const { callbackUrl, expired } = await searchParams;
  return (
    <>
      <h1 className="font-serif text-xl font-medium">Sign in</h1>
      {expired ? (
        <p role="status" className="mt-2 text-xs text-ink-muted">
          Your session ended. Please sign in again and you will return to where you were.
        </p>
      ) : null}
      <LoginForm callbackUrl={callbackUrl ?? ""} />
      {demoLoginEnabled() ? <DemoAccess /> : null}
    </>
  );
}
