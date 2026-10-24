import {
  dayLabel,
  rupeesWhole,
  type PriceCompare as Compare,
  type PriceCompareRole,
  type SummarySource,
} from "@/lib/aiaic-analysis";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Whole class names (a name built at run time is dropped from the built stylesheet).
const BAR: Record<PriceCompareRole, string> = {
  chosen: "bg-primary",
  compared: "bg-slate-500",
  other_day: "bg-amber-600",
  beyond_reach: "bg-slate-300",
};
const BADGE: Record<PriceCompareRole, string> = {
  chosen: "bg-success-soft text-foreground",
  compared: "bg-muted text-foreground/80",
  other_day: "bg-amber-100 text-amber-900",
  beyond_reach: "bg-muted text-foreground/80",
};

/**
 * THE PRICE ON THE FIRST LINE, AND THE OPTIONS BESIDE IT (AIAIC's kit/PriceCompare.jsx): the answer's price large, then
 * the mandis AIAIC's market answer compared, each at its own price and day, the farmer's own district marked, and the
 * quotes of another day apart (dashed, "another day, not compared"). Everything is AIAIC's `summary.price_compare`
 * (which mandis, in what order, the words in her language, the badges): this draws bars and writes the day, and chooses
 * nothing. The bars are a picture of the numbers beside them (hidden from screen readers, which read the numbers). The
 * source and its date close it (AIAIC's action card's source line).
 */
export function PriceCompare({
  compare,
  source = null,
  className = "",
}: {
  compare: Compare | null | undefined;
  source?: SummarySource | null | undefined;
  className?: string;
}) {
  const { t, lang } = useI18n();
  if (!compare || !compare.rows.length) return null;
  const chosen = compare.rows.find((r) => r.role === "chosen") ?? compare.rows[0]!;
  const top = Math.max(...compare.rows.map((r) => r.price));
  const per = compare.unit_text || "/q";
  const srcKey = source?.source_id ? `aiaic.src.${source.source_id}` : "";
  const srcName = srcKey && t(srcKey) !== srcKey ? t(srcKey) : null;
  const sourceLine = srcName
    ? t("aiaic.compare.source", {
        name: srcName,
        date: source?.observed_on ? dayLabel(source.observed_on, lang) : "",
      })
    : source?.text
      ? t("aiaic.compare.source_text", { text: source.text })
      : null;
  return (
    <section
      aria-label={compare.headline ?? undefined}
      data-testid="aiaic-price-compare"
      className={cn("min-w-0", className)}
    >
      <p className="leading-none">
        <span className="text-3xl font-extrabold tracking-tight text-foreground">
          {rupeesWhole(chosen.price)}
        </span>
        <span className="ml-1 text-sm font-semibold text-foreground/80">{per}</span>
      </p>
      {compare.headline ? (
        <p className="mt-1 break-words text-sm text-foreground">{compare.headline}</p>
      ) : null}
      {compare.rows.length > 1 ? (
        <ul className="mt-2 space-y-1.5">
          {compare.rows.map((r, i) => (
            <li
              key={`${r.mandi}-${r.day ?? ""}-${i}`}
              data-role={r.role}
              className={
                r.role === "other_day"
                  ? "rounded-lg border border-dashed border-amber-600/60 p-1.5"
                  : undefined
              }
            >
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 break-words">
                  <span
                    className={
                      r.role === "chosen"
                        ? "font-extrabold text-foreground"
                        : "font-semibold text-foreground"
                    }
                  >
                    {r.mandi_shown ?? r.mandi}
                  </span>
                  {r.badge ? (
                    <span
                      className={cn(
                        "ml-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-bold",
                        BADGE[r.role],
                      )}
                    >
                      {r.badge}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-foreground">
                  {rupeesWhole(r.price)}
                </span>
              </div>
              <div aria-hidden className="mt-0.5 h-2 w-full rounded-full bg-muted">
                <div
                  className={cn("h-2 rounded-full", BAR[r.role])}
                  style={{ width: `${Math.max(4, Math.round((r.price / top) * 100))}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[r.km_text, r.day ? dayLabel(r.day, lang) : ""].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {compare.compare ? (
        <p className="mt-2 break-words text-sm font-semibold text-foreground">{compare.compare}</p>
      ) : null}
      {compare.note ? <p className="mt-1 text-xs text-muted-foreground">{compare.note}</p> : null}
      {sourceLine ? <p className="mt-1 text-xs text-muted-foreground">{sourceLine}</p> : null}
    </section>
  );
}
