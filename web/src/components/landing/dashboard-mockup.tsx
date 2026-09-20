import { Badge } from "@/components/ui/badge";
import { PairMark } from "./evidence-lines";
import { mockup } from "./content";

/**
 * A composed still of the flagged records queue, not a screenshot. It shows the shape of the product
 * under the hero, so the figures are illustrative, stated as such on screen, and never fetched.
 */
export function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-serif text-xl">{mockup.title}</h2>
          <p className="text-xs text-ink-muted">{mockup.subtitle}</p>
        </div>
        <dl className="flex items-baseline gap-6">
          {mockup.stats.map((stat) => (
            <div key={stat.label} className="text-right">
              <dd className="text-xl font-semibold tabular-nums">{stat.value}</dd>
              <dt className="text-xs text-ink-muted">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* Three columns do not fit a phone, so below sm the status moves into the record cell and the
          status column is dropped. Every status still carries its text label. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left sm:min-w-[520px]">
          <caption className="sr-only">
            An illustrative queue of flagged records ranked by score, with two matched records joined
          </caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="px-4 py-2 text-xs font-semibold text-ink-muted sm:px-5">
                Record
              </th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-semibold text-ink-muted">
                Score
              </th>
              <th
                scope="col"
                className="hidden px-4 py-2 text-right text-xs font-semibold text-ink-muted sm:table-cell sm:px-5"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {mockup.rows.map((row) => (
              <tr key={`${row.title}-${row.meta}`} className="border-b border-line last:border-0">
                <td className="px-4 py-3 sm:px-5">
                  <div className="flex items-stretch gap-3">
                    {row.pair ? <PairMark position={row.pair} /> : <span className="w-2" />}
                    <div>
                      <div className="text-sm font-semibold">{row.title}</div>
                      <div className="text-xs text-ink-muted">{row.meta}</div>
                      <div className="mt-2 sm:hidden">
                        <Badge variant={row.variant}>{row.status}</Badge>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right align-middle">
                  <span
                    className={`text-2xl font-semibold tabular-nums ${
                      row.variant === "note" ? "text-ink-muted" : "text-copper"
                    }`}
                  >
                    {row.score}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right align-middle sm:table-cell sm:px-5">
                  <Badge variant={row.variant}>{row.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line px-4 py-3 text-xs text-ink-muted sm:px-5">{mockup.note}</p>
    </div>
  );
}
