import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Landmark,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { usePress } from "@/lib/aiaic-crisis";
import { useMine } from "@/lib/aiaic-hooks";
import {
  cropName,
  moneySaid,
  moneyTotals,
  newPressKey,
  paymentLine,
  payoutDetailsProblem,
  quintalWords,
  quintals,
  rupees,
  type AiaicProblem,
  type MineForScreen,
  type PayoutAccountBlock,
  type PayoutNotice,
} from "@/lib/aiaic-trade";
import { givePayoutAccount, withdrawPayoutAccount } from "@/lib/aiaic-trade.functions";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ModeChip, ProblemCard, WithMine } from "./AiaicBits";

/** Her money across her sales, at a glance, then each sale's line and where her money goes. */
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
            <PayoutAccountCard block={data.mine.payout_account} notice={data.mine.payout_notice} />
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

function EachSale({ data }: { data: MineForScreen }) {
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
          const said = moneySaid(t, "money", o.money?.say ?? null);
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

/** Synthetic values for a TEST server (AIAIC's own recorder uses the same kind): never a person's details. */
const TEST_VALUES = {
  name_on_pan: "Practice Payee Testname",
  pan: "AAAPZ4321K",
  account_number: "000123456789",
  ifsc: "RECT0000001",
  upi_id: "practicepayee@rzptest",
};

/**
 * Where her money goes (her Razorpay Route account, through AIAIC): its state in AIAIC's words, and, when AIAIC
 * offers it here, the form to give it. The details pass through this app's server to AIAIC and on to Razorpay; this
 * app keeps none of them, and the form forgets them once sent.
 */
function PayoutAccountCard({
  block,
  notice,
}: {
  block: PayoutAccountBlock | undefined;
  notice: PayoutNotice | undefined;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const giveFn = useServerFn(givePayoutAccount);
  const withdrawFn = useServerFn(withdrawPayoutAccount);
  const press = usePress();
  const [open, setOpen] = useState(false);
  const [readNotice, setReadNotice] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [destination, setDestination] = useState<"bank_account" | "upi_id">("bank_account");
  const [name, setName] = useState("");
  const [pan, setPan] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upi, setUpi] = useState("");
  const [badField, setBadField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AiaicProblem | null>(null);
  const [stopping, setStopping] = useState(false);

  const clear = () => {
    setName("");
    setPan("");
    setAccount("");
    setIfsc("");
    setUpi("");
    setAgreed(false);
  };

  if (!block || !block.offered) {
    const why = block?.why_not_offered?.code;
    return (
      <section className="space-y-1.5 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Landmark className="size-5 text-primary" aria-hidden />
          {t("aiaic.payout.title")}
        </h2>
        <p className="text-sm font-semibold text-foreground">{t("aiaic.payout.not_offered")}</p>
        {why ? <p className="text-xs text-muted-foreground">{t(`aiaic.refused.${why}`)}</p> : null}
      </section>
    );
  }

  const said = moneySaid(t, "payout", block.say);
  const lines = notice ? (notice[lang as Lang] ?? notice.en) : [];

  const send = async () => {
    if (!notice) return;
    const details = {
      destination,
      pan,
      name_on_pan: name,
      ...(destination === "bank_account" ? { account_number: account, ifsc } : { upi_id: upi }),
    };
    const bad = payoutDetailsProblem(details);
    setBadField(bad);
    if (bad) return;
    setBusy(true);
    setProblem(null);
    const r = await press(() =>
      giveFn({
        data: {
          key: newPressKey(),
          notice_version: notice.version,
          shown_in: lang,
          agreed: true,
          destination,
          pan: pan.replace(/\s+/g, "").toUpperCase(),
          name_on_pan: name.replace(/\s+/g, " ").trim(),
          ...(destination === "bank_account"
            ? { account_number: account.replace(/[\s-]+/g, ""), ifsc: ifsc.trim().toUpperCase() }
            : { upi_id: upi.trim() }),
        },
      }),
    );
    if (r.ok) {
      clear();
      setOpen(false);
    } else {
      setProblem(r.problem);
      const field = r.problem.facts?.["field"];
      if (typeof field === "string") setBadField(field);
    }
    setBusy(false);
    await queryClient.invalidateQueries({ queryKey: ["aiaic-mine"] });
  };

  const stop = async () => {
    setBusy(true);
    setProblem(null);
    const r = await press(() => withdrawFn({ data: { key: newPressKey() } }));
    setBusy(false);
    setStopping(false);
    if (!r.ok) setProblem(r.problem);
    await queryClient.invalidateQueries({ queryKey: ["aiaic-mine"] });
  };

  const input = (bad: boolean) =>
    cn(
      "mt-1 min-h-12 w-full rounded-xl border-2 bg-background px-3 text-base font-semibold text-foreground outline-none focus:border-ring",
      bad ? "border-destructive" : "border-input",
    );

  return (
    <section className="space-y-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Landmark className="size-5 text-primary" aria-hidden />
          {t("aiaic.payout.title")}
        </h2>
        {block.test_values_only ? <ModeChip kind="test" /> : null}
      </div>
      {said ? <p className="text-base font-bold text-foreground">{said}</p> : null}
      {problem ? <ProblemCard problem={problem} /> : null}

      {block.can_create ? (
        open ? (
          <form
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="space-y-3"
          >
            {block.test_values_only ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-2.5">
                <span className="text-xs font-bold text-foreground">
                  {t("aiaic.payout.test_values")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setName(TEST_VALUES.name_on_pan);
                    setPan(TEST_VALUES.pan);
                    setAccount(TEST_VALUES.account_number);
                    setIfsc(TEST_VALUES.ifsc);
                    setUpi(TEST_VALUES.upi_id);
                  }}
                  className="min-h-9 rounded-xl border border-amber-500/50 bg-card px-3 text-xs font-bold"
                >
                  {t("aiaic.payout.fill_test")}
                </button>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {(["bank_account", "upi_id"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={destination === d}
                  onClick={() => setDestination(d)}
                  className={cn(
                    "min-h-12 rounded-xl border-2 px-3 text-sm font-bold",
                    destination === d
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  {t(d === "bank_account" ? "aiaic.payout.bank" : "aiaic.payout.upi")}
                </button>
              ))}
            </div>
            <label className="block text-xs font-bold text-foreground">
              {t("aiaic.field.name_on_pan")}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={input(badField === "name_on_pan")}
              />
            </label>
            <label className="block text-xs font-bold text-foreground">
              {t("aiaic.field.pan")}
              <input
                value={pan}
                maxLength={10}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                className={cn(input(badField === "pan"), "font-mono uppercase")}
              />
            </label>
            {destination === "bank_account" ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block text-xs font-bold text-foreground">
                  {t("aiaic.field.account_number")}
                  <input
                    value={account}
                    inputMode="numeric"
                    onChange={(e) => setAccount(e.target.value)}
                    className={cn(input(badField === "account_number"), "font-mono")}
                  />
                </label>
                <label className="block text-xs font-bold text-foreground">
                  {t("aiaic.field.ifsc")}
                  <input
                    value={ifsc}
                    maxLength={11}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    className={cn(input(badField === "ifsc"), "font-mono uppercase")}
                  />
                </label>
              </div>
            ) : (
              <label className="block text-xs font-bold text-foreground">
                {t("aiaic.field.upi_id")}
                <input
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                  className={cn(input(badField === "upi_id"), "font-mono")}
                />
              </label>
            )}
            {badField ? (
              <p className="text-xs font-bold text-destructive">
                {t("aiaic.refused.payout_details_not_valid", {
                  field: t(`aiaic.field.${badField}`),
                })}
              </p>
            ) : null}

            <div className="rounded-2xl border border-border bg-secondary/40 p-3">
              <button
                type="button"
                onClick={() => setReadNotice((v) => !v)}
                aria-expanded={readNotice}
                className="inline-flex items-center gap-1 text-sm font-bold text-primary"
              >
                {readNotice ? (
                  <ChevronUp className="size-4" aria-hidden />
                ) : (
                  <ChevronDown className="size-4" aria-hidden />
                )}
                {t("aiaic.payout.read")}
              </button>
              {readNotice ? (
                <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-foreground/90">
                  {lines.map((line, i) => (
                    <p key={i} className={i === 0 ? "font-bold" : undefined}>
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
              <label className="mt-2 flex items-start gap-2 text-sm font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 size-5"
                />
                {t("aiaic.payout.agree")}
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("aiaic.payout.kept_none")}</p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !agreed || !readNotice || !notice}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                {t(busy ? "aiaic.payout.sending" : "aiaic.payout.send")}
              </button>
              <button
                type="button"
                onClick={() => {
                  clear();
                  setOpen(false);
                }}
                className="min-h-12 rounded-xl border-2 border-border bg-card px-4 font-bold"
              >
                {t("aiaic.back")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-12 w-full rounded-xl bg-primary px-4 font-bold text-primary-foreground"
          >
            {t("aiaic.payout.give")}
          </button>
        )
      ) : null}

      {block.can_withdraw ? (
        stopping ? (
          <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-3">
            <p className="text-sm font-bold">{t("aiaic.payout.withdraw.confirm")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void stop()}
                className="min-h-11 flex-1 rounded-xl bg-destructive px-3 text-sm font-bold text-destructive-foreground disabled:opacity-60"
              >
                {t("aiaic.payout.withdraw.yes")}
              </button>
              <button
                type="button"
                onClick={() => setStopping(false)}
                className="min-h-11 flex-1 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold"
              >
                {t("aiaic.back")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setStopping(true)}
            className="min-h-11 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold text-foreground"
          >
            {t("aiaic.payout.withdraw")}
          </button>
        )
      ) : null}
    </section>
  );
}
