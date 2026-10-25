import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";

import {
  cropName,
  dayOf,
  districtName,
  offerViews,
  quintals,
  rupees,
  type AiaicListing,
  type MineForScreen,
} from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ModeChip, ProblemCard, WithMine } from "./AiaicBits";
import { OfferRow, SaleRow } from "./AiaicOrders";

/**
 * ONE OF HER LISTINGS, IN FULL (push 4; the owner: "in the listings the crops listed are static, can we make them
 * clickable which will lead to more details"): the lot as AIAIC holds it (crop, place, status, sold and left, her
 * price), every offer it received (open, expired, accepted, refused, closed), and the sales it became, each opening its
 * own page. Read from her one `GET /farmer/trade` answer (`useMine`): nothing else is asked.
 */
export function AiaicListingDetail({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6 sm:pt-8">
      <Link
        to="/listings"
        className="inline-flex min-h-10 items-center gap-2 text-base font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-5" aria-hidden />
        {t("nav.listings")}
      </Link>
      <WithMine>
        {(data) => {
          const lot = data.mine.listings.find((l) => l.listing_id === id);
          if (!lot) {
            return (
              <ProblemCard
                problem={{
                  code: "listing_not_found",
                  message: null,
                  status: 404,
                  setting: null,
                  facts: null,
                  crisis: null,
                }}
              />
            );
          }
          return <LotDetail lot={lot} data={data} />;
        }}
      </WithMine>
    </div>
  );
}

function LotDetail({ lot, data }: { lot: AiaicListing; data: MineForScreen }) {
  const { t } = useI18n();
  const sold = Math.max(lot.quantity_q - lot.quantity_left_q, 0);
  const soldPct = lot.quantity_q > 0 ? Math.round((sold / lot.quantity_q) * 100) : 0;
  const offers = offerViews(data.mine)
    .filter((v) => v.listing.listing_id === lot.listing_id)
    .sort((a, b) => b.offer.created_at.localeCompare(a.offer.created_at));
  const sales = data.mine.orders
    .filter((o) => o.listing_id === lot.listing_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      <article className="rounded-3xl border-2 border-primary/40 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-extrabold",
              lot.status === "open"
                ? "border border-primary/30 bg-success-soft text-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t(`aiaic.lots.status.${lot.status}`)}
          </span>
          {lot.synthetic ? <ModeChip kind="practice" /> : null}
        </div>
        <h1 className="mt-1.5 break-words text-2xl font-extrabold text-foreground">
          {cropName(data.cropNames, lot.crop)}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" aria-hidden />
            {districtName(data.districtNames, lot.district)}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" aria-hidden />
            {t("aiaic.lot.listed_on", { day: dayOf(lot.created_at) })}
          </span>
        </p>
        <p className="mt-3 text-3xl font-black text-foreground">
          {t("aiaic.lots.price", { price: rupees(lot.ask_price_per_q) })}
        </p>
        <div className="mt-3 space-y-1">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${soldPct}%` }} />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {t("aiaic.lots.left", {
              left: quintals(lot.quantity_left_q),
              qty: quintals(lot.quantity_q),
            })}
          </p>
        </div>
      </article>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("aiaic.offers.title")}</h2>
        {offers.length ? (
          offers.map((v) => <OfferRow key={v.offer.offer_id} view={v} data={data} />)
        ) : (
          <p className="rounded-2xl border-2 border-dashed border-border bg-card p-5 text-center text-sm font-semibold text-muted-foreground">
            {t("aiaic.offers.empty")}
          </p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("aiaic.sales.title")}</h2>
        {sales.length ? (
          sales.map((o) => <SaleRow key={o.order_id} order={o} data={data} />)
        ) : (
          <p className="rounded-2xl border-2 border-dashed border-border bg-card p-5 text-center text-sm font-semibold text-muted-foreground">
            {t("aiaic.sales.empty")}
          </p>
        )}
      </section>
    </>
  );
}
