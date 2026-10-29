import { Link } from "@tanstack/react-router";
import { Ban, ChevronRight, RefreshCw, ShoppingBag, Wallet } from "lucide-react";

import { useMine, useMyNotices } from "@/lib/aiaic-hooks";
import {
  askDiffPct,
  buyerLine,
  closedReasonKey,
  cropName,
  dayOf,
  groupPaidWords,
  groupView,
  moreTimeGiven,
  offerViews,
  orderOfOffer,
  quintalWords,
  quintals,
  rupees,
  type AiaicOrder,
  type MineForScreen,
  type OfferView,
} from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ModeChip, WithMine } from "./AiaicBits";
import { GroupStepsLine } from "./GroupSteps";
import { PooledLine } from "./PooledLine";
import { SaleStepper } from "./SaleStepper";

/** Offers on her lots first (the ones she can answer now on top), then her sales with their five steps. */
export function AiaicOrders() {
  const { t } = useI18n();
  const mine = useMine();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-24 pt-6 sm:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          <ShoppingBag className="size-7 shrink-0 text-primary" aria-hidden />
          <span>{t("nav.orders")}</span>
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => mine.refetch()}
            disabled={mine.isFetching}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold disabled:opacity-60"
          >
            <RefreshCw className={cn("size-4", mine.isFetching && "animate-spin")} aria-hidden />
            {t("aiaic.refresh")}
          </button>
          <Link
            to="/payments"
            className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-primary/40 bg-primary/10 px-3 text-sm font-bold text-primary"
          >
            <Wallet className="size-4" aria-hidden />
            {t("nav.payments")}
          </Link>
        </div>
      </div>
      <WithMine>{(data) => <OffersAndSales data={data} />}</WithMine>
    </div>
  );
}

function OffersAndSales({ data }: { data: MineForScreen }) {
  const { t } = useI18n();
  const notices = useMyNotices();
  const all = offerViews(data.mine);
  const offers = all
    .filter((v) => v.chip === "open" || v.chip === "expired")
    .sort((a, b) => Number(b.canAnswer) - Number(a.canAnswer));
  // CLOSED BEFORE SHE ANSWERED (30 Oct 2026): an offer AIAIC closed stays in sight with why, in plain words; the newest 5
  const closed = all.filter((v) => v.chip === "withdrawn").slice(0, 5);
  const sales = [...data.mine.orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("aiaic.offers.title")}</h2>
        {offers.length ? (
          offers.map((v) => (
            <OfferRow
              key={v.offer.offer_id}
              view={v}
              data={data}
              moreTime={moreTimeGiven(notices.data, v.offer.offer_id)}
            />
          ))
        ) : (
          <p className="rounded-2xl border-2 border-dashed border-border bg-card p-5 text-center text-sm font-semibold text-muted-foreground">
            {t("aiaic.offers.empty")}
          </p>
        )}
      </section>
      {closed.length ? (
        <section className="space-y-3" data-testid="aiaic-offers-closed">
          <h2 className="text-lg font-bold text-foreground">{t("aiaic.offers.closed_title")}</h2>
          {closed.map((v) => (
            <OfferRow key={v.offer.offer_id} view={v} data={data} />
          ))}
        </section>
      ) : null}
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

export function OfferRow({
  view,
  data,
  moreTime = false,
}: {
  view: OfferView;
  data: MineForScreen;
  /** AIAIC's notice said this offer was given more time (`moreTimeGiven`). */
  moreTime?: boolean;
}) {
  const { t } = useI18n();
  const o = view.offer;
  const ask = view.listing.ask_price_per_q;
  const diff = askDiffPct(o.price_per_q, ask);
  // a group sale's invitation: its steps on one line (30 Oct 2026)
  const group = o.pool
    ? groupView(o.pool, o, orderOfOffer(data.mine, o.offer_id), {
        moreTime,
        districtNames: data.districtNames,
      })
    : null;
  const closedWhy = closedReasonKey(o);
  return (
    <Link
      to="/orders/$orderId"
      params={{ orderId: o.offer_id }}
      className={cn(
        "block rounded-3xl border-2 bg-card p-4 shadow-sm transition hover:border-primary/60",
        view.canAnswer ? "border-primary/50" : "border-border opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                view.chip === "open"
                  ? "bg-warning-soft text-warning-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {t(`aiaic.offer.chip.${view.chip}`)}
            </span>
            {o.pool_id ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold text-primary-foreground">
                {t("aiaic.group.chip")}
              </span>
            ) : null}
            {o.synthetic ? <ModeChip kind="practice" /> : null}
          </div>
          <p className="mt-1 break-words text-lg font-extrabold text-foreground">
            {cropName(data.cropNames, view.listing.crop)} · {quintalWords(t, o.quantity_q)}
          </p>
          <p className="break-words text-xs text-muted-foreground">
            {buyerLine(t, data.districtNames, o.buyer_type, o.buyer_district, o.buyer_name)}
          </p>
          {o.valid_until && !group && !closedWhy ? (
            <p className="text-xs text-muted-foreground">
              {t("aiaic.offer.open_until", { day: dayOf(o.valid_until) })}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-black text-primary">
            {rupees(o.amount_inr ?? o.price_per_q * o.quantity_q)}
          </p>
          <p className="text-xs font-bold text-foreground">
            {t("aiaic.lots.price", { price: rupees(o.price_per_q) })}
          </p>
          {diff !== null ? (
            <p
              className={cn(
                "text-[11px] font-bold",
                diff >= 0 ? "text-primary" : "text-destructive",
              )}
            >
              {t("aiaic.offer.your_price", { price: rupees(ask) })} ({diff >= 0 ? "+" : ""}
              {diff}%)
            </p>
          ) : null}
        </div>
      </div>
      {closedWhy ? (
        <p
          className="mt-2 flex items-start gap-1.5 rounded-xl bg-muted p-2 text-sm font-semibold text-foreground"
          data-testid="aiaic-offer-closed-why"
        >
          <Ban className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          {t(closedWhy)}
        </p>
      ) : group ? (
        <GroupStepsLine view={group} />
      ) : null}
      <p className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary">
        {t("aiaic.offer.see")}
        <ChevronRight className="size-4" aria-hidden />
      </p>
    </Link>
  );
}

export function SaleRow({ order, data }: { order: AiaicOrder; data: MineForScreen }) {
  const { t } = useI18n();
  return (
    <Link
      to="/orders/$orderId"
      params={{ orderId: order.order_id }}
      className="block rounded-3xl border-2 border-border bg-card p-4 shadow-sm transition hover:border-primary/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {order.order_state === "cancelled" ? (
              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-extrabold text-destructive">
                {t("aiaic.sale.cancelled")}
              </span>
            ) : null}
            {order.synthetic ? <ModeChip kind="practice" /> : null}
          </div>
          <p className="mt-1 break-words text-lg font-extrabold text-foreground">
            {cropName(data.cropNames, order.crop)} · {quintalWords(t, order.quantity_q)}
          </p>
          <p className="break-words text-xs text-muted-foreground">
            {buyerLine(
              t,
              data.districtNames,
              order.buyer_type,
              order.buyer_district,
              order.buyer_name,
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-black text-foreground">{rupees(order.amount_inr)}</p>
          <p className="text-xs font-bold text-muted-foreground">
            {t("aiaic.lots.price", { price: rupees(order.price_per_q) })}
          </p>
        </div>
      </div>
      {/* a group sale's order: her group steps on one line (30 Oct 2026); any other sale: its own five steps */}
      {order.pool ? (
        <GroupStepsLine
          view={groupView(order.pool, null, order, { districtNames: data.districtNames })}
          paidWords={groupPaidWords(t, order)}
        />
      ) : (
        <SaleStepper order={order} />
      )}
      {order.pooled ? <PooledLine pooled={order.pooled} /> : null}
    </Link>
  );
}
