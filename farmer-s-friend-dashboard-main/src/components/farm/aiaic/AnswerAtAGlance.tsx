import { IndianRupee, MapPin, Sprout, Truck, Warehouse } from "lucide-react";

import type { PriceCompare } from "@/lib/aiaic-analysis";
import { away, useStorageVerdict } from "@/lib/aiaic-storage";
import { rupeeRange, rupees } from "@/lib/aiaic-trade";
import { useMandiTrip } from "@/lib/aiaic-trip";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * THE ANSWER AT A GLANCE (push 4; the owner, 25 Oct 2026: "below the paragraph can we add a visually good analysis with
 * critical answer in a very visual manner like crop, district, sell at with distance price and transportation, and
 * storage at with per quintal rate and distance"). Two tiles right under the analysis paragraph, every figure AIAIC's own:
 *   - SELL AT: the mandi the market answer chose (its price comparison's `chosen` row: the name in her language, the
 *     price a quintal, how far), and the trip there for 10 quintals (asked as the transport card asks it: one request);
 *   - STORE AT: the warehouse the storage verdict names (name, operator), its farmer rate a month, how far, and the
 *     verdict's word.
 * A part AIAIC has not answered is said so, never guessed; nothing at all when neither part has an answer.
 */
export function AnswerAtAGlance({
  crop,
  cropLabel,
  district,
  districtLabel,
  state,
  compare,
  toMandi,
  className = "",
}: {
  crop: string;
  cropLabel?: string | null | undefined;
  district: string;
  districtLabel?: string | null | undefined;
  state?: string | null | undefined;
  /** The market card's `summary.price_compare`, as `priceCompareOf` reads it; null: no market answer. */
  compare: PriceCompare | null;
  /** The mandi the market answer's label names, used when the comparison has no `chosen` row. */
  toMandi?: string | null | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  const chosen = compare?.rows.find((r) => r.role === "chosen") ?? null;
  const trip = useMandiTrip({ district, state, toMandi: chosen?.mandi ?? toMandi ?? null });
  const storage = useStorageVerdict({ crop, district, state });
  const v = storage?.verdict ?? null;
  const w = v?.warehouse ?? null;
  if (!chosen && !w) return null;
  const km = away(w);
  return (
    <section
      className={cn("mt-4 rounded-2xl border border-border bg-muted/40 p-3 sm:p-4", className)}
      aria-label={t("aiaic.glance.title")}
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sprout className="size-4 text-primary" aria-hidden="true" />
          {cropLabel || crop}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 text-primary" aria-hidden="true" />
          {districtLabel || district}
        </span>
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-primary/40 bg-card p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <IndianRupee className="size-4" aria-hidden="true" />
            {t("aiaic.glance.sell_at")}
          </p>
          {chosen ? (
            <div className="mt-1 space-y-1">
              <p className="text-lg font-extrabold leading-tight text-foreground">
                {chosen.mandi_shown || chosen.mandi}
              </p>
              <p className="text-2xl font-extrabold tabular-nums text-foreground">
                {t("aiaic.transport.per_q", { range: rupees(chosen.price) })}
              </p>
              {chosen.km_text ? (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {chosen.km_text}
                </p>
              ) : null}
              {trip.estimate ? (
                <p className="flex items-start gap-1.5 text-sm text-foreground">
                  <Truck
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {t("aiaic.glance.trip", {
                    range: rupeeRange(
                      trip.estimate.per_quintal.low_rs,
                      trip.estimate.per_quintal.high_rs,
                    ),
                    q: trip.estimate.quantity_q,
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{t("aiaic.glance.no_sell")}</p>
          )}
        </div>
        <div className="rounded-xl border-2 border-violet-700/30 bg-card p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-800">
            <Warehouse className="size-4" aria-hidden="true" />
            {t("aiaic.glance.store_at")}
          </p>
          {v && w ? (
            <div className="mt-1 space-y-1">
              <p className="text-lg font-extrabold leading-tight text-foreground">
                {w.place_shown || w.name_shown || w.name}{" "}
                <span className="text-sm font-semibold text-muted-foreground">
                  {w.operator_shown || w.operator}
                </span>
              </p>
              {w.farmer_rate?.text ? (
                <p className="text-base font-bold text-foreground">{w.farmer_rate.text}</p>
              ) : null}
              {km != null ? (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {t("aiaic.storage.km", { km: Math.round(Number(km)) })}
                </p>
              ) : null}
              <p className="text-sm font-bold text-foreground">
                {v.word}
                {v.code === "store" && v.months_text ? ` · ${v.months_text}` : ""}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{t("aiaic.glance.no_store")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
