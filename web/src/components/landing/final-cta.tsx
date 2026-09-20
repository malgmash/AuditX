import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingPhoto } from "./photo";
import { Container } from "./section";
import { finalCta, nav } from "./content";

export function FinalCta() {
  return (
    <section className="border-b border-line bg-surface">
      <Container className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-copper-text uppercase">
            {finalCta.eyebrow}
          </p>
          <h2 className="mt-3 max-w-[18ch] font-serif text-[clamp(28px,3.6vw,40px)] leading-[1.1] tracking-tight text-balance">
            {finalCta.headline}
          </h2>
          <p className="mt-4 max-w-[52ch] text-base leading-7 text-ink-muted">{finalCta.body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild className="h-10 px-5 transition-transform duration-150 active:translate-y-px">
              <Link href={nav.getStarted.href}>
                {nav.getStarted.label}
                <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
              </Link>
            </Button>
            <p className="text-sm text-ink-muted">
              {finalCta.haveAccount}{" "}
              <Link
                href={nav.logIn.href}
                className="rounded-control text-slate underline-offset-4 hover:underline"
              >
                {nav.logIn.label}
              </Link>
            </p>
          </div>
        </div>
        <LandingPhoto
          src={finalCta.imageSrc}
          alt={finalCta.imageAlt}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="aspect-[4/3] w-full lg:aspect-[5/4]"
        />
      </Container>
    </section>
  );
}
