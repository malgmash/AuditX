import { LandingPhoto } from "./photo";
import { PairMark } from "./evidence-lines";
import { Container } from "./section";
import { matchedPair, problem } from "./content";

export function Problem() {
  return (
    <section id={problem.id} className="scroll-mt-14 border-b border-line">
      <Container className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="relative order-2 lg:order-1">
          <LandingPhoto
            src={problem.imageSrc}
            alt={problem.imageAlt}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="aspect-[4/3] w-full lg:aspect-[5/4]"
          />
          <div className="mt-4 rounded-card border border-line bg-surface p-4 sm:absolute sm:-right-6 sm:-bottom-8 sm:mt-0 sm:w-[min(100%,280px)]">
            <p className="text-sm font-semibold">{matchedPair.heading}</p>
            <div className="mt-3 space-y-2">
              {matchedPair.records.map((record, index) => (
                <div key={record.label} className="flex items-stretch gap-3">
                  <PairMark position={index === 0 ? "top" : "bottom"} />
                  <div className="flex flex-1 items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm">{record.merchant}</p>
                      <p className="text-xs text-ink-muted">{record.label}</p>
                    </div>
                    <span className="font-mono text-xs tabular-nums">{record.amount}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-muted">{matchedPair.note}</p>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-xs font-semibold tracking-[0.12em] text-copper-text uppercase">
            {problem.eyebrow}
          </p>
          <h2 className="mt-3 max-w-[18ch] font-serif text-[clamp(28px,3.6vw,40px)] leading-[1.1] tracking-tight text-balance">
            {problem.headline}
          </h2>
          <p className="mt-5 max-w-[52ch] text-base leading-7 text-ink-muted">{problem.body}</p>
          <ul className="mt-8 space-y-5">
            {problem.points.map((point) => (
              <li key={point.title} className="border-t border-line pt-4">
                <h3 className="text-sm font-semibold">{point.title}</h3>
                <p className="mt-1 max-w-[48ch] text-sm leading-6 text-ink-muted">{point.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
