import { Link } from "@tanstack/react-router";
import { Megaphone, PlusCircle } from "lucide-react";

import { useBuyersLooking } from "@/lib/aiaic-hooks";
import {
  buyerLine,
  cropName,
  dayOf,
  demandQuantity,
  districtName,
  rupees,
  type BuyerDemand,
  type BuyersLooking,
} from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

import { ModeChip, ProblemCard } from "./AiaicBits";

/**
 * BUYERS LOOKING FOR PRODUCE NEAR HER (AIAIC, 27 Oct 2026): the demand AIAIC's team chose to show farmers, for her
 * district: the crop, how much, the most the buyer says it pays, by when, and the kind of buyer and its district.
 * Never the buyer's name, and never an offer (said under the list). Nothing to show: no card. An AIAIC not yet updated
 * has no such list (it answers 404): no card either; any other problem is said.
 */
export function BuyersLookingCard() {
  const { t } = useI18n();
  const q = useBuyersLooking();
  if (q.isPending || !q.data) return null;
  if (!q.data.ok) {
    if (q.data.problem.code === "not_found") return null;
    return <ProblemCard problem={q.data.problem} onRetry={() => q.refetch()} />;
  }
  const data = q.data.data;
  if (!data.buyers.length) return null;
  return (
    <section
      aria-labelledby="aiaic-demand-heading"
      className="space-y-3 rounded-3xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5"
      data-testid="aiaic-buyers-looking"
    >
      <h2
        id="aiaic-demand-heading"
        className="flex items-center gap-2 text-lg font-extrabold text-foreground sm:text-xl"
      >
        <Megaphone className="size-5 shrink-0 text-primary" aria-hidden />
        <span>{t("aiaic.demand.title")}</span>
      </h2>
      <p className="text-sm text-foreground/85">
        {t("aiaic.demand.intro", { district: districtName(data.districtNames, data.district) })}
      </p>
      <ul className="space-y-2.5">
        {data.buyers.map((b) => (
          <Demand key={b.demand_id} demand={b} data={data} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("aiaic.demand.not_offer")}</p>
    </section>
  );
}

function Demand({ demand: b, data }: { demand: BuyerDemand; data: BuyersLooking }) {
  const { t } = useI18n();
  const crops = b.crops.length
    ? b.crops.map((c) => cropName(data.cropNames, c)).join(", ")
    : t("aiaic.demand.any_crop");
  const qty = demandQuantity(t, b);
  const needed = b.needed_to
    ? t("aiaic.demand.needed_by", { day: dayOf(b.needed_to) })
    : b.needed_from
      ? t("aiaic.demand.needed_from", { day: dayOf(b.needed_from) })
      : null;
  const first = b.crops[0];
  return (
    <li className="space-y-2 rounded-2xl border-2 border-border bg-card p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 break-words text-base font-extrabold text-foreground">{crops}</p>
        {b.synthetic ? <ModeChip kind="practice" /> : null}
      </div>
      <p className="text-sm text-foreground/85">
        {buyerLine(t, data.districtNames, b.buyer_type, b.buyer_district, null)}
      </p>
      <div className="flex flex-wrap gap-1.5 text-sm font-bold text-foreground">
        {b.max_price_per_q ? (
          <span className="rounded-full border border-primary/40 bg-success-soft px-2.5 py-0.5">
            {t("aiaic.demand.up_to", { price: rupees(b.max_price_per_q) })}
          </span>
        ) : null}
        {qty ? (
          <span className="rounded-full border border-border px-2.5 py-0.5">{qty}</span>
        ) : null}
        {needed ? (
          <span className="rounded-full border border-border px-2.5 py-0.5">{needed}</span>
        ) : null}
      </div>
      <Link
        to="/listing/new"
        search={{ crop: first ?? undefined, region: data.district ?? undefined }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-bold text-primary-foreground"
      >
        <PlusCircle className="size-4" aria-hidden />
        {first
          ? t("aiaic.demand.sell", { crop: cropName(data.cropNames, first) })
          : t("aiaic.demand.sell_any")}
      </Link>
    </li>
  );
}
