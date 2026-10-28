/**
 * WHAT SHE RECEIVES FROM AIAIC, BEFORE ANYTHING HAPPENS, AND WHERE IT GOES (28 Oct 2026; the owner: "the farmer needs to
 * see the final price clearly that will be received from AIAIC platform once the buyers pays this will increase trust
 * and reliability with clear visibility of what will happen").
 *
 * AIAIC's own figures for her order (`from_aiaic`): her amount, large; how it is worked out (her price, less her part of
 * AIAIC's commission and 18% GST on it); then each step as AIAIC says it (`steps`: a transfer the team recorded by hand
 * is "sent", never "reached"), with a TEST mark when no real money moved. The order's own link decides whether the card
 * shows, not today's setting. Her UPI ID or bank account is given here by her own press, after the notice AIAIC holds
 * (`x_notice`, in her language; its version and the language are said back with her press); it goes to Razorpay and
 * AIAIC keeps only a masked hint. She removes it here by her own press too, and AIAIC asks RazorpayX to switch it off
 * (the audit of 28 Oct 2026: MONEY-07, -11; PRIVACY-03, -04, -05, -14).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, IndianRupee, Loader2 } from "lucide-react";
import { useState } from "react";

import type { FromAiaic, XDestination, XNotice } from "@/lib/aiaic-trade";
import { sendingSaid } from "@/lib/aiaic-trade";
import { endMyDestination, giveMyDestination } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ProblemCard } from "./AiaicBits";

const rupees = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// a new key for EVERY press (PRIVACY-05): a corrected detail after a refusal is a new request, never a replay
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `ann-${crypto.randomUUID()}`
    : `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const INPUT =
  "mt-1 block min-h-12 w-full rounded-xl border-2 border-border bg-background px-3 text-base font-semibold";
type Problem = Parameters<typeof ProblemCard>[0]["problem"];

function NoticeText({ notice }: { notice: XNotice }) {
  const { lang } = useI18n();
  const paragraphs = notice[lang === "mr" || lang === "hi" ? lang : "en"];
  return (
    <div
      className="space-y-1 rounded-xl bg-muted p-3 text-sm text-foreground"
      data-testid="aiaic-x-notice"
    >
      {paragraphs.map((p, i) => (
        <p key={i} className={i === 0 ? "font-extrabold" : ""}>
          {p}
        </p>
      ))}
    </div>
  );
}

function RemoveDestination() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fn = useServerFn(endMyDestination);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const remove = async () => {
    setBusy(true);
    setProblem(null);
    const r = await fn({ data: { key: newKey() } });
    setBusy(false);
    setAsking(false);
    if (r.ok) {
      setSaid(r.data.closure === "done" ? "aiaic.dest.removed" : "aiaic.dest.removed_pending");
      await qc.invalidateQueries({ queryKey: ["aiaic-mine"] });
    } else setProblem(r.problem);
  };
  if (said) return <p className="text-sm font-bold text-foreground">{t(said)}</p>;
  return (
    <div className="space-y-2">
      {asking ? (
        <div
          className="space-y-2 rounded-xl border-2 border-border p-3"
          data-testid="aiaic-dest-remove-ask"
        >
          <p className="text-sm font-semibold text-foreground">{t("aiaic.dest.remove_ask")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-destructive px-3 text-sm font-bold text-destructive-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("aiaic.dest.remove_yes")}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="min-h-11 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold"
            >
              {t("aiaic.dest.keep")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="min-h-11 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold"
          data-testid="aiaic-dest-remove"
        >
          {t("aiaic.dest.remove")}
        </button>
      )}
      {problem ? <ProblemCard problem={problem} /> : null}
    </div>
  );
}

export function DestinationForm({
  dest,
  notice,
  largeAmount = false,
}: {
  dest: XDestination | null | undefined;
  notice: XNotice | null | undefined;
  /** AIAIC says her amount is Rs 1,00,000 or more: a UPI ID cannot receive it in one payment (R3-MONEY-C) */
  largeAmount?: boolean;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const fn = useServerFn(giveMyDestination);
  const [kind, setKind] = useState<"upi_id" | "bank_account">(
    largeAmount ? "bank_account" : "upi_id",
  );
  const tooLarge = (
    <p className="text-sm font-bold text-amber-900" data-testid="aiaic-dest-upi-too-large">
      {t("aiaic.dest.upi_one_lakh")}
    </p>
  );
  const [upi, setUpi] = useState("");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [changing, setChanging] = useState(false);
  if (dest && dest.ready && !changing) {
    return (
      <div className="space-y-2 rounded-2xl bg-muted p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-foreground">
            {t(`aiaic.dest.kind.${dest.kind}`)}: <span className="font-black">{dest.hint}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setAgreed(false); // a replacement needs her own fresh press (PRIVACY-14)
              setChanging(true);
            }}
            className="min-h-11 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold"
          >
            {t("aiaic.dest.change")}
          </button>
        </div>
        {largeAmount && dest.kind === "upi_id" ? tooLarge : null}
        <RemoveDestination />
      </div>
    );
  }
  const ready =
    Boolean(notice) &&
    agreed &&
    (kind === "upi_id"
      ? upi.includes("@")
      : name.trim().length >= 4 && account.length >= 5 && ifsc.length === 11);
  const send = async () => {
    if (!notice) return;
    setBusy(true);
    setProblem(null);
    const body =
      kind === "upi_id"
        ? { kind, upi_id: upi.trim() }
        : {
            kind,
            name: name.trim(),
            account_number: account.trim(),
            ifsc: ifsc.trim().toUpperCase(),
          };
    const r = await fn({
      data: {
        key: newKey(),
        agreed: true,
        replace: Boolean(dest),
        notice_version: notice.version,
        read_in: lang === "mr" || lang === "hi" ? lang : "en",
        ...body,
      },
    });
    setBusy(false);
    if (r.ok) {
      setUpi("");
      setAccount("");
      setIfsc("");
      setName("");
      setAgreed(false);
      setChanging(false);
      await qc.invalidateQueries({ queryKey: ["aiaic-mine"] });
    } else {
      setProblem(r.problem);
      if (r.problem.code === "unknown_notice_version") {
        setAgreed(false);
        await qc.invalidateQueries({ queryKey: ["aiaic-mine"] });
      }
    }
  };
  return (
    <div
      className="space-y-3 rounded-2xl border-2 border-primary/40 p-3"
      data-testid="aiaic-destination-form"
    >
      <p className="text-base font-extrabold text-foreground">{t("aiaic.dest.title")}</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("aiaic.dest.title")}>
        {(["upi_id", "bank_account"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "min-h-14 rounded-xl border-2 px-3 text-base font-extrabold",
              kind === k ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card",
            )}
          >
            {t(`aiaic.dest.kind.${k}`)}
          </button>
        ))}
      </div>
      {largeAmount && kind === "upi_id" ? tooLarge : null}
      {kind === "upi_id" ? (
        <label className="block text-sm font-bold">
          {t("aiaic.dest.upi")}
          <input
            className={INPUT}
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            autoComplete="off"
          />
        </label>
      ) : (
        <>
          <label className="block text-sm font-bold">
            {t("aiaic.dest.name")}
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm font-bold">
            {t("aiaic.dest.account")}
            <input
              className={INPUT}
              value={account}
              inputMode="numeric"
              onChange={(e) => setAccount(e.target.value.replace(/\s/g, ""))}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm font-bold">
            {t("aiaic.dest.ifsc")}
            <input
              className={INPUT}
              value={ifsc}
              maxLength={11}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              autoComplete="off"
            />
          </label>
        </>
      )}
      {notice ? <NoticeText notice={notice} /> : null}
      <label className="flex min-h-12 items-start gap-3 text-sm font-semibold text-foreground">
        <input
          type="checkbox"
          className="mt-0.5 size-6 shrink-0"
          checked={agreed}
          disabled={!notice}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        {t("aiaic.dest.agree")}
      </label>
      {problem ? <ProblemCard problem={problem} /> : null}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => void send()}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-lg font-extrabold text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        {t("aiaic.dest.save")}
      </button>
    </div>
  );
}

export function FromAiaicCard({
  money,
  dest,
  collectThenPay,
  notice,
}: {
  money: FromAiaic | null | undefined;
  dest: XDestination | null | undefined;
  collectThenPay: boolean;
  notice?: XNotice | null | undefined;
}) {
  const { t } = useI18n();
  // the order's own link decides (MONEY-07): a sale already fixed by AIAIC's link shows even after the setting changed
  if (!money || (!collectThenPay && !money.fixed_by_link)) return null;
  const sending = money.sending;
  // each step as AIAIC says it (MONEY-11); an AIAIC that does not say them ticks only what it said: the buyer paid
  const said = money.steps ?? { buyer_paid: money.buyer_paid, sent: false, reached: false };
  const steps = [
    { key: "buyer_paid", done: said.buyer_paid },
    { key: "sending", done: said.sent },
    { key: "reached", done: said.reached },
  ];
  return (
    <section
      className="rounded-3xl border-2 border-primary bg-card p-4"
      data-testid="aiaic-from-aiaic"
    >
      <p className="flex items-center gap-2 text-base font-extrabold text-foreground">
        <IndianRupee className="size-5" aria-hidden />
        {t("aiaic.money.title")}
      </p>
      <p className="mt-1 text-3xl font-black text-primary">{rupees(money.to_her_inr)}</p>
      <p className="text-sm font-semibold text-muted-foreground">
        {t(money.fixed_by_link ? "aiaic.money.fixed" : "aiaic.money.now")}
      </p>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="font-semibold text-foreground">{t("aiaic.money.price")}</dt>
          <dd className="font-bold">{rupees(money.price_inr)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="font-semibold text-foreground">
            {t("aiaic.money.commission", { pct: money.commission_percent ?? "—" })}
          </dt>
          <dd className="font-bold">− {rupees(money.commission_inr)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="font-semibold text-foreground">
            {t("aiaic.money.gst", { pct: money.gst_percent ?? "—" })}
          </dt>
          <dd className="font-bold">− {rupees(money.gst_inr)}</dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-border pt-1">
          <dt className="font-extrabold text-foreground">{t("aiaic.money.to_you")}</dt>
          <dd className="font-black">{rupees(money.to_her_inr)}</dd>
        </div>
      </dl>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm font-bold text-foreground">
            {s.done ? (
              <CheckCircle2 className="size-5 text-primary" aria-hidden />
            ) : (
              <Circle className="size-5 text-muted-foreground" aria-hidden />
            )}
            {t(`aiaic.money.step.${s.key}`)}
          </li>
        ))}
      </ol>
      {sending ? (
        <p className="mt-2 text-sm font-semibold text-foreground">
          {t(`aiaic.money.status.${sendingSaid(sending)}`, { rs: rupees(sending.amount_inr) })}
          {sending.utr ? <span className="ml-1 font-bold">· UTR {sending.utr}</span> : null}
        </p>
      ) : null}
      {sending?.test_mode ? (
        <p
          className="mt-1 inline-block rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-900"
          data-testid="aiaic-money-test"
        >
          {t("aiaic.money.test")}
        </p>
      ) : null}
      <div className="mt-3">
        <DestinationForm
          dest={dest}
          notice={notice}
          largeAmount={money.upi_one_lakh_or_more === true && !said.sent}
        />
      </div>
    </section>
  );
}
