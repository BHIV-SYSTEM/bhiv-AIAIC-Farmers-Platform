import { useQueryClient } from "@tanstack/react-query";
import type { FromAiaic, XDestination, XNotice } from "@/lib/aiaic-trade";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Banknote, CheckCircle2, Loader2, Wallet, XCircle } from "lucide-react";
import { useState } from "react";

import { usePress } from "@/lib/aiaic-crisis";
import {
  buyerLine,
  commissionFromHer,
  commissionParts,
  cropName,
  dayOf,
  findOffer,
  findOrder,
  listingOfOrder,
  moneyCard,
  newPressKey,
  orderOfOffer,
  paymentLine,
  quintalWords,
  quintals,
  rupees,
  type AiaicCommission,
  type AiaicOrder,
  type AiaicProblem,
  type MineForScreen,
  type OfferView,
} from "@/lib/aiaic-trade";
import { answerOffer, reportPayment } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ModeChip, ProblemCard, WithMine } from "./AiaicBits";
import { GroupSaleCard } from "./GroupSaleCard";
import { PooledLine } from "./PooledLine";
import { SaleJourney } from "./SaleJourney";
import { SaleStepper } from "./SaleStepper";
import { FromAiaicCard } from "./FromAiaicCard";
import { OfferCompareBox } from "./OfferCompareBox";
import { TransportCostCard } from "./TransportCostCard";

/** One offer (`ofr_…`) or one sale (`ord_…`) of hers, from AIAIC. */
export function AiaicOrderDetail({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6 sm:pt-8">
      <Link
        to="/orders"
        className="inline-flex min-h-10 items-center gap-2 text-base font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-5" aria-hidden />
        {t("nav.orders")}
      </Link>
      {/* the page that shows AIAIC's send of the farmer's money: read again every 5 s while it moves (R5P-09) */}
      <WithMine pace="money">
        {(data) => {
          if (id.startsWith("ofr_")) {
            const view = findOffer(data.mine, id);
            if (view) return <OfferDetail view={view} data={data} />;
          } else {
            const order = findOrder(data.mine, id);
            if (order) return <SaleDetail order={order} data={data} />;
          }
          return (
            <ProblemCard
              problem={{
                code: id.startsWith("ofr_") ? "offer_not_found" : "order_not_found",
                message: null,
                status: 404,
                setting: null,
                facts: null,
                crisis: null,
              }}
            />
          );
        }}
      </WithMine>
    </div>
  );
}

function TermsLine({ code, words }: { code: string | null; words?: string | null | undefined }) {
  const { t } = useI18n();
  if (code)
    return <p className="text-sm font-semibold text-foreground">{t(`aiaic.terms.${code}`)}</p>;
  return (
    <p className="text-sm text-foreground">
      <span className="font-semibold">{t("aiaic.terms.as_written")}:</span>{" "}
      {words ? <q className="italic">{words}</q> : null}
    </p>
  );
}

function OfferDetail({ view, data }: { view: OfferView; data: MineForScreen }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const answerFn = useServerFn(answerOffer);
  const press = usePress();
  const [asking, setAsking] = useState<"accept" | "reject" | null>(null);
  const [pressKey, setPressKey] = useState(newPressKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AiaicProblem | null>(null);
  const o = view.offer;
  const crop = cropName(data.cropNames, view.listing.crop);
  const order = orderOfOffer(data.mine, o.offer_id);
  const amount = o.amount_inr ?? o.price_per_q * o.quantity_q;

  const answer = async (which: "accept" | "reject") => {
    setBusy(true);
    setProblem(null);
    const r = await press(() =>
      answerFn({ data: { key: pressKey, offer_id: o.offer_id, answer: which } }),
    );
    await queryClient.invalidateQueries({ queryKey: ["aiaic-mine"] });
    if (!r.ok) {
      setProblem(r.problem);
      if (r.problem.status !== null && r.problem.status < 500) setPressKey(newPressKey());
    } else if (which === "accept" && r.data.order_id) {
      void navigate({ to: "/orders/$orderId", params: { orderId: r.data.order_id } });
    }
    setBusy(false);
    setAsking(null);
  };

  return (
    <>
      <section className="rounded-3xl border-2 border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-extrabold text-warning-foreground">
            {t(`aiaic.offer.chip.${view.chip}`)}
          </span>
          {o.synthetic ? <ModeChip kind="practice" /> : null}
        </div>
        <h1 className="mt-2 break-words text-2xl font-extrabold text-foreground">
          {crop} · {quintalWords(t, o.quantity_q)}
        </h1>
        <p className="break-words text-sm text-muted-foreground">
          {buyerLine(t, data.districtNames, o.buyer_type, o.buyer_district, o.buyer_name)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-primary/10 p-3">
            <p className="text-[11px] font-bold text-muted-foreground">{t("aiaic.sell.total")}</p>
            <p className="text-2xl font-black text-primary">{rupees(amount)}</p>
          </div>
          <div className="rounded-2xl bg-secondary p-3">
            <p className="text-[11px] font-bold text-muted-foreground">
              {t("aiaic.offer.your_price", { price: rupees(view.listing.ask_price_per_q) })}
            </p>
            <p className="text-lg font-black text-foreground">
              {t("aiaic.lots.price", { price: rupees(o.price_per_q) })}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <TermsLine code={o.terms_code} words={o.delivery_terms} />
          {o.valid_until ? (
            <p className="text-xs text-muted-foreground">
              {t("aiaic.offer.open_until", { day: dayOf(o.valid_until) })}
            </p>
          ) : null}
        </div>
      </section>

      {o.pool ? (
        <GroupSaleCard
          pool={o.pool}
          cropLabel={crop}
          districtNames={data.districtNames}
          place={{ state: view.listing.state, district: view.listing.district }}
          mine={{ quantity_q: o.quantity_q, amount }}
        />
      ) : null}

      {problem ? <ProblemCard problem={problem} /> : null}

      {order ? (
        <Link
          to="/orders/$orderId"
          params={{ orderId: order.order_id }}
          className="flex min-h-12 items-center justify-center rounded-2xl bg-primary px-4 font-bold text-primary-foreground"
        >
          {t("aiaic.offer.became_sale")}
        </Link>
      ) : view.canAnswer ? (
        asking ? (
          <div
            role="alertdialog"
            className="space-y-3 rounded-3xl border-2 border-primary bg-card p-4 shadow-md"
          >
            <h2 className="text-xl font-black text-foreground">
              {t(asking === "accept" ? "aiaic.offer.confirm.title" : "aiaic.offer.reject.confirm")}
            </h2>
            {asking === "accept" ? (
              <>
                <p className="text-base font-bold text-foreground">
                  {crop} · {quintalWords(t, o.quantity_q)} ·{" "}
                  {t("aiaic.lots.price", { price: rupees(o.price_per_q) })} · {rupees(amount)}
                </p>
                <p className="text-sm text-muted-foreground">{t("aiaic.offer.confirm.final")}</p>
                {o.synthetic ? (
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("aiaic.practice.tip")}
                  </p>
                ) : null}
              </>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => void answer(asking)}
                className={cn(
                  "flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-lg font-extrabold disabled:opacity-60",
                  asking === "accept"
                    ? "bg-primary text-primary-foreground"
                    : "bg-destructive text-destructive-foreground",
                )}
              >
                {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                {t(asking === "accept" ? "aiaic.offer.confirm.yes" : "aiaic.offer.reject.yes")}
              </button>
              <button
                type="button"
                onClick={() => setAsking(null)}
                className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-border bg-card px-5 font-bold"
              >
                {t("aiaic.back")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => setAsking("accept")}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-lg font-extrabold text-primary-foreground shadow-md"
            >
              <CheckCircle2 className="size-6" aria-hidden />
              {t("aiaic.offer.accept")}
            </button>
            <button
              type="button"
              onClick={() => setAsking("reject")}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-5 text-base font-bold"
            >
              <XCircle className="size-5 text-muted-foreground" aria-hidden />
              {t("aiaic.offer.reject")}
            </button>
          </div>
        )
      ) : o.why_not_accept ? (
        <p className="rounded-2xl border border-border bg-muted p-3 text-sm font-semibold text-foreground">
          {t(`aiaic.refused.${o.why_not_accept.code}`)}
        </p>
      ) : null}

      {/* HER OFFER AGAINST THE MANDI, AFTER HER TRIP (28 Oct 2026): one press, AIAIC's figures */}
      <OfferCompareBox offerId={o.offer_id} />
      <TransportCostCard
        crop={view.listing.crop}
        cropLabel={crop}
        quantityQ={o.quantity_q}
        fromState={view.listing.state}
        fromDistrict={view.listing.district}
        fromTaluka={(view.listing as { taluka?: string | null }).taluka ?? null}
      />
    </>
  );
}

function SaleDetail({ order, data }: { order: AiaicOrder; data: MineForScreen }) {
  const { t } = useI18n();
  const listing = listingOfOrder(data.mine, order);
  const crop = cropName(data.cropNames, order.crop);
  const next = order.her_next_step;
  return (
    <>
      <section className="rounded-3xl border-2 border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-primary">
            {t("aiaic.sale.ref", { ref: order.order_id })}
          </span>
          {order.synthetic ? <ModeChip kind="practice" /> : null}
        </div>
        <h1 className="mt-2 break-words text-2xl font-extrabold text-foreground">
          {crop} · {quintalWords(t, order.quantity_q)}
        </h1>
        <p className="break-words text-sm text-muted-foreground">
          {buyerLine(
            t,
            data.districtNames,
            order.buyer_type,
            order.buyer_district,
            order.buyer_name,
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2 rounded-2xl bg-primary/10 p-3">
          <p className="text-3xl font-black text-primary">{rupees(order.amount_inr)}</p>
          <p className="text-sm font-bold text-foreground">
            {t("aiaic.lots.price", { price: rupees(order.price_per_q) })}
          </p>
        </div>
        <div className="mt-2">
          <TermsLine code={order.terms_code} words={order.delivery_terms} />
        </div>
        {order.order_state === "cancelled" ? (
          <p className="mt-3 rounded-2xl bg-danger-soft p-3 text-sm font-bold text-destructive">
            {t("aiaic.sale.cancelled")}{" "}
            {order.cancel_reason_code
              ? t(`aiaic.sale.cancel_reason.${order.cancel_reason_code}`)
              : null}
          </p>
        ) : null}
        <SaleStepper order={order} />
        {order.pooled ? <PooledLine pooled={order.pooled} /> : null}
        {next && order.order_state !== "cancelled" ? (
          <p className="mt-3 text-sm font-bold text-foreground">{t(`aiaic.sale.next.${next}`)}</p>
        ) : null}
      </section>

      {order.pool ? (
        <GroupSaleCard
          pool={order.pool}
          cropLabel={crop}
          districtNames={data.districtNames}
          place={{
            state: listing?.state ?? data.mine.profile_place.state,
            district: listing?.district ?? data.mine.profile_place.district,
          }}
          mine={{ quantity_q: order.quantity_q, amount: order.amount_inr }}
        />
      ) : null}

      <SaleJourney order={order} />

      <PaymentCard order={order} />
      {/* WHAT SHE RECEIVES FROM AIAIC, BEFORE ANYTHING HAPPENS (28 Oct 2026), and where it goes */}
      <FromAiaicCard
        money={(order as { from_aiaic?: FromAiaic | null }).from_aiaic}
        dest={(data.mine as { x_destination?: XDestination | null }).x_destination}
        collectThenPay={(data.mine as { collect_then_pay?: boolean }).collect_then_pay === true}
        notice={(data.mine as { x_notice?: XNotice | null }).x_notice}
      />
      <MoneyCard order={order} />

      {listing ? (
        <TransportCostCard
          crop={order.crop}
          cropLabel={crop}
          quantityQ={order.quantity_q}
          fromState={listing.state}
          fromDistrict={listing.district}
        />
      ) : null}
    </>
  );
}

function PaymentCard({ order }: { order: AiaicOrder }) {
  const { t } = useI18n();
  const line = paymentLine(order);
  return (
    <section className="space-y-2 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Banknote className="size-5 text-primary" aria-hidden />
        {t("aiaic.pay.title")}
      </h2>
      <p
        className={cn(
          "text-base font-bold",
          line.state === "paid" ? "text-primary" : "text-foreground",
        )}
      >
        {t(line.key)}
      </p>
      {line.notOnward ? (
        <p className="text-xs text-muted-foreground">{t("aiaic.pay.not_onward")}</p>
      ) : null}
      {typeof order.payment.refund_owed_inr === "number" && order.payment.refund_owed_inr > 0 ? (
        <p className="text-xs font-semibold text-foreground">
          {t("aiaic.pay.refund_owed", { amount: rupees(order.payment.refund_owed_inr) })}
        </p>
      ) : null}
    </section>
  );
}

/** What reached her, in AIAIC's own words for its state (`money.say`), and her word of a payment made outside AIAIC
 * where AIAIC takes it AND the money is outside AIAIC or her produce was handed over (`moneyCard`, `asksHerWord`). */
function MoneyCard({ order }: { order: AiaicOrder }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const reportFn = useServerFn(reportPayment);
  const press = usePress();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AiaicProblem | null>(null);
  const money = order.money;
  const card = moneyCard(t, order);
  // a refusal of her last press stays in sight even when the card has nothing else to say
  if (!money || (!card && !problem && !money.commission)) return null;

  const report = async (what: "received" | "not_received") => {
    setBusy(true);
    setProblem(null);
    const r = await press(() =>
      reportFn({ data: { key: newPressKey(), order_id: order.order_id, what } }),
    );
    setBusy(false);
    if (!r.ok) setProblem(r.problem);
    await queryClient.invalidateQueries({ queryKey: ["aiaic-mine"] });
  };

  return (
    <section className="space-y-2 rounded-3xl border-2 border-primary/40 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Wallet className="size-5 text-primary" aria-hidden />
          {t("aiaic.money.title")}
        </h2>
        {money.test_mode ? <ModeChip kind="test" /> : null}
      </div>
      {card ? <p className="text-base font-bold text-foreground">{card.line}</p> : null}
      <CommissionBlock commission={money.commission} />
      {money.fee_on_top && typeof money.share_inr === "number" ? (
        <p className="text-xs font-semibold text-muted-foreground">
          {t(
            commissionFromHer(money.commission)
              ? "aiaic.farmer.money.fee_on_top_after_commission"
              : "aiaic.farmer.money.fee_on_top",
            { amount: rupees(money.share_inr) },
          )}
        </p>
      ) : null}
      {problem ? <ProblemCard problem={problem} /> : null}
      {card?.asks ? (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => void report("received")}
            className="min-h-12 flex-1 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60"
          >
            {t("aiaic.money.got")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void report("not_received")}
            className="min-h-12 flex-1 rounded-xl border-2 border-border bg-card px-4 font-bold disabled:opacity-60"
          >
            {t("aiaic.money.not_yet")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * AIAIC's commission on this sale, from its payment link's own record (AIAIC's `money.commission`): the agreed price,
 * the commission and who pays it, and what she receives, all AIAIC's own numbers. Nothing when AIAIC sends none (no
 * share of hers at Razorpay yet, or an AIAIC not yet updated).
 */
function CommissionBlock({ commission }: { commission: AiaicCommission | null | undefined }) {
  const { t } = useI18n();
  if (!commission) return null;
  if (!commission.set)
    return (
      <p className="text-xs font-semibold text-muted-foreground">{t("aiaic.commission.none")}</p>
    );
  const c = commissionParts(commission);
  const who =
    c.payer === "buyer"
      ? t("aiaic.commission.by_buyer")
      : c.payer === "farmer"
        ? t("aiaic.commission.by_farmer")
        : c.payer === "split"
          ? c.fromHer !== null && c.fromBuyer !== null
            ? t("aiaic.commission.by_both", { buyer: rupees(c.fromBuyer), her: rupees(c.fromHer) })
            : t("aiaic.commission.by_both_plain")
          : null;
  return (
    <div className="space-y-1.5 rounded-2xl border-2 border-border bg-card p-3 text-sm">
      {commission.price_inr !== null ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-muted-foreground">
            {t("aiaic.commission.agreed")}
          </span>
          <span className="font-bold text-foreground">{rupees(commission.price_inr)}</span>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-muted-foreground">
          {c.rate
            ? t("aiaic.commission.title", { rate: c.rate })
            : t("aiaic.commission.title_no_rate")}
        </span>
        <span className="font-bold text-foreground">{rupees(c.amount)}</span>
      </div>
      {who ? <p className="text-xs text-muted-foreground">{who}</p> : null}
      {c.youReceive !== null ? (
        <div className="flex items-baseline justify-between gap-2 border-t border-border pt-1.5">
          <span className="font-bold text-foreground">{t("aiaic.commission.you_receive")}</span>
          <span className="text-base font-black text-primary">{rupees(c.youReceive)}</span>
        </div>
      ) : null}
    </div>
  );
}
