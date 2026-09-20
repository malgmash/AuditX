import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingPhoto } from "./photo";
import { Container } from "./section";
import { hero, howItWorks, nav } from "./content";

function MatchSpark() {
  return (
    <svg viewBox="0 0 120 36" className="h-9 w-full" aria-hidden="true">
      <polyline
        fill="none"
        stroke="var(--color-copper)"
        strokeWidth="2"
        points="0,28 18,24 36,26 54,16 72,18 90,8 120,6"
      />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="overflow-x-clip border-b border-line">
      <Container className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <div>
          <h1 className="max-w-[14ch] font-serif text-[clamp(40px,6.5vw,64px)] leading-[1.02] tracking-[-0.03em] text-balance">
            {hero.headline}
          </h1>
          <p className="mt-5 max-w-[52ch] text-base leading-7 text-ink-muted">{hero.sub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild className="h-10 px-5 transition-transform duration-150 active:translate-y-px">
              <Link href={nav.getStarted.href}>
                {hero.primary}
                <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-10 px-5">
              <a href={`#${howItWorks.id}`}>{hero.secondary}</a>
            </Button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[460px] pb-16 sm:pb-8 lg:mx-0 lg:justify-self-end">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-6 right-0 size-64 rounded-full bg-sage/8 sm:size-80"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-4 -left-8 size-40 rounded-full bg-copper/8"
          />

          <LandingPhoto
            src={hero.imageSrc}
            alt={hero.imageAlt}
            priority
            sizes="(max-width: 1024px) 90vw, 420px"
            className="aspect-[4/5] w-full"
          />

          <aside className="absolute top-10 -left-2 w-[min(100%,220px)] rounded-card border border-line bg-surface p-4 sm:-left-16">
            <p className="text-xs text-ink-muted">{hero.matchCard.label}</p>
            <p className="mt-1 font-semibold text-2xl text-copper tabular-nums">{hero.matchCard.value}</p>
            <div className="mt-3">
              <MatchSpark />
            </div>
            <p className="mt-2 text-xs text-ink-muted">{hero.matchCard.detail}</p>
          </aside>

          <aside className="absolute right-0 -bottom-6 w-[min(100%,200px)] rounded-card bg-ink p-4 text-bone sm:right-[-24px]">
            <p className="text-xs text-bone/60">{hero.holdCard.label}</p>
            <p className="mt-2 font-semibold text-2xl whitespace-nowrap tabular-nums">
              {hero.holdCard.value}
            </p>
            <p className="mt-1 text-xs text-bone/50">{hero.holdCard.detail}</p>
          </aside>
        </div>
      </Container>

      <div className="border-t border-line bg-surface">
        <Container className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-8">
          <p className="shrink-0 text-xs font-semibold text-ink-muted">{hero.watchesLabel}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {hero.watches.map((item) => (
              <li key={item} className="text-sm">
                {item}
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </section>
  );
}
