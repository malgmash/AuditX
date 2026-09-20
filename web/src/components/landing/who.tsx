import { LandingPhoto } from "./photo";
import { Container } from "./section";
import { who } from "./content";

export function Who() {
  return (
    <section id={who.id} className="scroll-mt-14 border-b border-line">
      <Container className="py-16 lg:py-24">
        <div className="max-w-[54ch]">
          <p className="text-xs font-semibold tracking-[0.12em] text-copper-text uppercase">
            {who.eyebrow}
          </p>
          <h2 className="mt-3 font-serif text-[clamp(28px,3.6vw,40px)] leading-[1.1] tracking-tight text-balance">
            {who.headline}
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {who.roles.map((role) => (
            <article key={role.title} className="overflow-hidden rounded-card border border-line bg-surface">
              <LandingPhoto
                src={role.imageSrc}
                alt={role.imageAlt}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="aspect-[16/10] rounded-none"
              />
              <div className="p-5">
                <h3 className="text-base font-semibold">{role.title}</h3>
                <p className="mt-2 max-w-[48ch] text-sm leading-6 text-ink-muted">{role.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          <LandingPhoto
            src={who.mosaic.imageSrc}
            alt={who.mosaic.imageAlt}
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="aspect-[16/10] lg:col-span-7 lg:aspect-auto lg:min-h-[280px]"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            {who.mosaic.stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`flex flex-col justify-end rounded-card p-5 ${
                  index === 0 ? "bg-ink text-bone" : "bg-sage-tint"
                }`}
              >
                <p
                  className={`font-semibold text-3xl tabular-nums ${index === 0 ? "text-bone" : "text-ink"}`}
                >
                  {stat.value}
                </p>
                <p className={`mt-2 text-sm ${index === 0 ? "text-bone/70" : "text-ink-muted"}`}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-muted">{who.mosaic.note}</p>
      </Container>
    </section>
  );
}
