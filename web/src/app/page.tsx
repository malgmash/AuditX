import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingNav } from "@/components/landing/landing-nav";
import { Problem } from "@/components/landing/problem";
import { SiteFooter } from "@/components/landing/site-footer";
import { Who } from "@/components/landing/who";

export const metadata: Metadata = {
  title: { absolute: "AuditX: find what doesn’t add up" },
  description:
    "AuditX helps small businesses detect duplicate receipts, unusual transactions and out-of-pattern expenses, then explains what a reviewer should look at next.",
};

export default async function Root() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/employee");

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-control bg-ink px-4 py-2 text-bone focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main-content">
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <Who />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
