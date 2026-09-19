import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  return (
    <>
      <h1 className="font-serif text-xl font-medium">Sign in</h1>
      <LoginForm callbackUrl={callbackUrl ?? ""} />
    </>
  );
}
