import { Users } from "lucide-react";

import { pooledLine, type AiaicPooled } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

/**
 * Her produce gathered at a collection point with other farmers' produce (AIAIC's aggregation step, 27 Oct 2026):
 * where, how many other farmers, and the quantity when AIAIC's team recorded one. Never another farmer's name.
 */
export function PooledLine({ pooled }: { pooled: AiaicPooled }) {
  const { t } = useI18n();
  return (
    <p
      className="mt-2 flex items-start gap-1.5 rounded-xl bg-secondary/60 px-3 py-2 text-sm font-semibold text-foreground"
      data-testid="aiaic-pooled"
    >
      <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 break-words">{pooledLine(t, pooled)}</span>
    </p>
  );
}
