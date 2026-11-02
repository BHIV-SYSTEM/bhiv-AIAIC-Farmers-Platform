import { ChevronDown, PackageX } from "lucide-react";

import type { StorageWastage } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

/**
 * WASTAGE AND SPOILAGE OF A STORAGE PLAN (31 Oct 2026; contract section 33, `wastage`): AIAIC's one sentence, and what
 * institutes published behind a small fold. Never a figure of the farm's own, and nothing computed here.
 */
export function WastagePanel({ wastage }: { wastage: StorageWastage | null | undefined }) {
  const { t } = useI18n();
  if (!wastage) return null;
  const published = (wastage.published ?? []).filter((p) => p.text);
  return (
    <section
      className="space-y-2 rounded-3xl border-2 border-border bg-card p-4 sm:p-5"
      data-testid="store-wastage"
      data-kind={wastage.kind}
      aria-labelledby="store-wastage-title"
    >
      <h2
        id="store-wastage-title"
        className="flex items-center gap-2 text-lg font-extrabold text-foreground sm:text-xl"
      >
        <PackageX aria-hidden className="size-5 shrink-0 text-primary" />
        {t("aiaic.store.wastage.title")}
      </h2>
      <p className="text-base text-foreground" data-testid="store-wastage-headline">
        {wastage.headline}
      </p>
      {published.length ? (
        <details
          className="group rounded-2xl border-2 border-border bg-secondary/40"
          data-testid="store-wastage-published"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-bold text-foreground">
            {t("aiaic.store.wastage.published")}
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <ul className="space-y-2 border-t border-border px-3 py-2 text-sm text-foreground/80">
            {published.map((p) => (
              <li key={p.text}>{p.text}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
