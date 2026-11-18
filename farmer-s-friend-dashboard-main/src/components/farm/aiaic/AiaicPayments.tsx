import { Link } from "@tanstack/react-router";
import { ExternalLink, RefreshCw, Wallet } from "lucide-react";

import { useMine } from "@/lib/aiaic-hooks";
import {
  cropName,
  moneySaid,
  moneyTotals,
  paymentLine,
  quintalWords,
  rupees,
  sendingLine,
  type MineForScreen,
} from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ModeChip, WithMine } from "./AiaicBits";

/** Her money across her sales, at a glance, then each sale's line (where AIAIC sends her money is given on her sale's
 * own page, `FromAiaicCard`). */
export function AiaicPayments() {
  const { t } = useI18n();
  const mine = useMine();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-3.5 pb-24 pt-5 sm:px-4 sm:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          <Wallet className="size-7 shrink-0 text-primary" aria-hidden />
          <span>{t("aiaic.payments.title")}</span>
        </h1>
        <button
          type="button"
          onClick={() => mine.refetch()}
          disabled={mine.isFetching}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold disabled:opacity-60"
        >
          <RefreshCw className={cn("size-4", mine.isFetching && "animate-spin")} aria-hidden />
          {t("aiaic.retry")}
        </button>
      </div>
      <WithMine>
        {(data) => (
          <>
            <Totals data={data} />
            <EachSale data={data} />
          </>
        )}
      </WithMine>
    </div>
  );
}

function Totals({ data }: { data: MineForScreen }) {
  const { t } = useI18n();
  const m = moneyTotals(data.mine.orders);
  const bars: { key: string; value: number; tone: string }[] = [
    { key: "aiaic.payments.agreed", value: m.agreed, tone: "bg-muted-foreground/40" },
    { key: "aiaic.payments.paid", value: m.paidByBuyers, tone: "bg-chart-2" },
    { key: "aiaic.payments.sent", value: m.sentToHer, tone: "bg-primary/60" },
    { key: "aiaic.payments.settled", value: m.settled, tone: "bg-primary" },
  ];
  const top = Math.max(m.agreed, m.paidByBuyers, 1);
  return (
    <section className="space-y-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {data.mine.practice ? <ModeChip kind="practice" /> : null}
      </div>
      <ul className="space-y-2.5">
        {bars.map((b) => (
          <li key={b.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-muted-foreground">{t(b.key)}</span>
              <span className="font-black text-foreground">{rupees(b.value)}</span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className={cn("h-full rounded-full", b.tone)}
                style={{ width: `${Math.round((b.value / top) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">{t("aiaic.payments.source")}</p>
    </section>
  );
}

/** Each sale's card: what was agreed, the buyer's payment, AIAIC's own send of her money in its state (the audit of
 * 4 Nov 2026, AN-7), and what people said of her money (AIAIC's sentence). */
export function EachSale({ data }: { data: MineForScreen }) {
  const { t } = useI18n();
  const orders = [...data.mine.orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">{t("aiaic.payments.each")}</h2>
      {orders.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border bg-card p-5 text-center text-sm font-semibold text-muted-foreground">
          {t("aiaic.payments.empty")}
        </p>
      ) : (
        orders.map((o) => {
          const said = moneySaid(t, o.money?.say ?? null);
          // AIAIC's own send, as her group sale's page says it: under Cashfree `money.say` is empty while AIAIC sends
          const sent = sendingLine(t, o);
          return (
            <article
              key={o.order_id}
              className="space-y-1.5 rounded-3xl border-2 border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words font-extrabold text-foreground">
                  {cropName(data.cropNames, o.crop)} · {quintalWords(t, o.quantity_q)}
                </p>
                <p className="shrink-0 text-lg font-black text-foreground">
                  {rupees(o.amount_inr)}
                </p>
              </div>
              <p className="text-sm font-semibold text-foreground">{t(paymentLine(o).key)}</p>
              {sent ? (
                <p
                  className="text-sm font-semibold text-foreground"
                  data-testid="aiaic-payments-send"
                >
                  {sent}
                </p>
              ) : null}
              {said ? <p className="text-sm text-foreground/85">{said}</p> : null}
              <Link
                to="/orders/$orderId"
                params={{ orderId: o.order_id }}
                className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-primary"
              >
                {t("aiaic.sale.open")}
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            </article>
          );
        })
      )}
    </section>
  );
}
