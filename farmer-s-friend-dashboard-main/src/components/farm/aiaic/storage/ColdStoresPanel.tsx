import { AlertTriangle, Snowflake } from "lucide-react";

import type { StorageColdStores } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

/**
 * COLD STORES NEARBY (31 Oct 2026; contract section 33, `cold_storages`): how many are on record, the ones an organisation
 * holds by name, and how many more are counted and not named. NO RATE EXISTS in any file AIAIC holds, so `rate_text` stands
 * in plain view, in a box of its own; the caveat (subsidy records, which do not show that a store still runs) and the
 * source stay beside the list. Every sentence is AIAIC's; a name stays as its owner wrote it.
 */
export function ColdStoresPanel({ cold }: { cold: StorageColdStores | null | undefined }) {
  const { t } = useI18n();
  if (!cold) return null;
  const near = (cold.near ?? []).filter((r) => r.name);
  return (
    <section
      className="space-y-2 rounded-3xl border-2 border-border bg-card p-4 sm:p-5"
      data-testid="store-cold"
      aria-labelledby="store-cold-title"
    >
      <h2
        id="store-cold-title"
        className="flex items-center gap-2 text-lg font-extrabold text-foreground sm:text-xl"
      >
        <Snowflake aria-hidden className="size-5 shrink-0 text-primary" />
        {t("aiaic.store.cold.title")}
      </h2>
      <p className="text-base font-semibold text-foreground" data-testid="store-cold-headline">
        {cold.headline}
      </p>
      {near.length ? (
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="store-cold-near">
          {near.map((r) => (
            <li
              key={`${r.name}-${r.year_sanctioned}`}
              className="min-w-0 rounded-2xl border-2 border-border bg-background p-2.5"
              data-testid="store-cold-row"
            >
              <p className="break-words text-base font-bold text-foreground">{r.name}</p>
              <p className="text-sm text-foreground/80">
                {[r.capacity_text, r.where_text, r.year_text].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {cold.not_named_text ? (
        <p className="text-sm text-foreground/80" data-testid="store-cold-not-named">
          {cold.not_named_text}
        </p>
      ) : null}
      {cold.rate_text ? (
        <p
          className="flex items-start gap-2 rounded-2xl border-2 border-warning bg-warning-soft p-2.5 text-base font-bold text-warning-foreground"
          data-testid="store-cold-rate"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>{cold.rate_text}</span>
        </p>
      ) : null}
      {cold.caveat ? (
        <p className="text-xs text-foreground/80" data-testid="store-cold-caveat">
          {cold.caveat}
        </p>
      ) : null}
      {cold.source ? (
        <p className="text-xs text-muted-foreground" data-testid="store-cold-source">
          {cold.source}
        </p>
      ) : null}
    </section>
  );
}
