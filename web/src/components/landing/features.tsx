import { Container } from "./section";
import { DashboardMockup } from "./dashboard-mockup";
import { deviation, features } from "./content";

function DeviationScale() {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-5">
      <div className="relative h-8">
        <span aria-hidden="true" className="absolute top-4 right-0 left-0 h-px bg-line-strong" />
        <span aria-hidden="true" className="absolute top-2 left-0 h-4 w-3/5 bg-sage-tint" />
        <span
          aria-hidden="true"
          className="absolute top-2 left-[88%] h-4 w-px -translate-x-1/2 bg-copper"
        />
        <span
          aria-hidden="true"
          className="absolute top-3 left-[88%] size-2 -translate-x-1/2 rounded-full bg-copper"
        />
      </div>
      <dl className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <dt className="text-xs text-ink-muted">{deviation.rangeLabel}</dt>
          <dd className="text-sm font-semibold tabular-nums">{deviation.rangeValue}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-ink-muted">{deviation.claimLabel}</dt>
          <dd className="text-sm font-semibold text-copper-text tabular-nums">{deviation.claimValue}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-ink-muted">{deviation.note}</p>
    </div>
  );
}

export function Features() {
  const [duplicates, anomalies, briefs] = features.items;

  return (
    <section id={features.id} className="scroll-mt-14 border-b border-line">
      <Container className="py-16 lg:py-24">
        <div className="max-w-[62ch]">
          <p className="text-xs font-semibold tracking-[0.12em] text-copper-text uppercase">
            {features.eyebrow}
          </p>
          <h2 className="mt-3 font-serif text-[clamp(28px,3.6vw,40px)] leading-[1.1] tracking-tight text-balance">
            {features.headline}
          </h2>
          <p className="mt-4 text-base leading-7 text-ink-muted">{features.sub}</p>
        </div>

        <div className="mt-10">
          <DashboardMockup />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <article className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold">{duplicates.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{duplicates.body}</p>
          </article>
          <article className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold">{anomalies.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{anomalies.body}</p>
            <div className="mt-4">
              <DeviationScale />
            </div>
          </article>
          <article className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold">{briefs.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{briefs.body}</p>
            <ul className="mt-4">
              {features.briefParts.map((part) => (
                <li key={part} className="border-b border-line py-2 text-sm last:border-0">
                  {part}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </Container>
    </section>
  );
}
