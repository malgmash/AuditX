import { Logo } from "@/components/brand/Logo";

// Auth pages: a 400px Surface card on Bone with the logo above it, no decoration. The logo links
// back to the public landing page (signed-in people are sent on to their own area from there).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <Logo href="/" />
      <div className="w-full max-w-[400px] rounded-card border border-line bg-surface p-6">
        {children}
      </div>
    </main>
  );
}
