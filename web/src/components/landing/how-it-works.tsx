import { LandingPhoto } from "./photo";
import { Container } from "./section";
import { howItWorks } from "./content";

export function HowItWorks() {
  return (
    <section id={howItWorks.id} className="scroll-mt-14 border-b border-line bg-surface">
      <Container className="grid gap-12 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-16 lg:py-24">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-copper-text uppercase">
            {howItWorks.eyebrow}
          </p>
          <h2 className="mt-3 max-w-[16ch] font-serif text-[clamp(28px,3.6vw,40px)] leading-[1.1] tracking-tight text-balance">
            {howItWorks.headline}
          </h2>
          <p className="mt-4 max-w-[42ch] text-base leading-7 text-ink-muted">{howItWorks.sub}</p>
          <LandingPhoto
            src={howItWorks.imageSrc}
            alt={howItWorks.imageAlt}
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="mt-8 aspect-[5/4] w-full"
          />
        </div>

        <ol className="relative">
          <span
            aria-hidden="true"
            className="absolute top-3 bottom-3 left-[11px] w-px bg-line-strong"
          />
          {howItWorks.steps.map((step) => (
            <li key={step.number} className="relative grid grid-cols-[24px_1fr] gap-4 pb-10 last:pb-0">
              <span className="relative z-10 mt-1 size-6 rounded-full border border-line-strong bg-surface">
                <span className="absolute inset-[6px] rounded-full bg-copper" />
              </span>
              <div>
                <p className="font-mono text-xs text-ink-muted tabular-nums">{step.number}</p>
                <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-[48ch] text-sm leading-6 text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
