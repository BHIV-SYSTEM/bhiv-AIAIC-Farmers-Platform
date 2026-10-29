import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleCheck,
  ClipboardList,
  Handshake,
  Loader2,
  MailOpen,
  MapPin,
  Minus,
  Pause,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  askDiffPct,
  dayOf,
  groupSaid,
  quintalWords,
  rupees,
  type GroupStep,
  type GroupStepKey,
  type GroupStepState,
  type GroupView,
  type ReferencePrice,
} from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ModeChip } from "./AiaicBits";

type Words = (key: string, vars?: Record<string, string | number>) => string;

/** The prices she compares before she answers, all AIAIC's own: the buyer's price and what her lot comes to, her own
 * asking price (null when she named none), and her district's mandi prices as AIAIC holds them now (`reading` while
 * they are read; `mandi` null when AIAIC holds none recent enough). */
export type GroupPrices = {
  pricePerQ: number;
  amount: number;
  ask: number | null;
  mandi: ReferencePrice | null;
  reading: boolean;
};

const ICONS: Record<GroupStepKey, typeof Check> = {
  invited: MailOpen,
  answered: Handshake,
  finalized: Users,
  collection: MapPin,
  paid: Wallet,
};

/** The mark of a step's state: a colour, ALWAYS with its icon and its word (never a colour alone). */
function StateMark({ step, size = "lg" }: { step: GroupStep; size?: "lg" | "sm" }) {
  const Icon =
    step.state === "done"
      ? Check
      : step.state === "stopped"
        ? Pause
        : step.state === "none"
          ? Minus
          : ICONS[step.key];
  return (
    <span
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2",
        size === "lg" ? "size-10" : "size-8",
        step.state === "done" && "border-primary bg-primary text-primary-foreground",
        step.state === "now" && "border-primary bg-card text-primary ring-4 ring-primary/25",
        step.state === "todo" && "border-border bg-muted text-muted-foreground",
        step.state === "stopped" && "border-destructive/60 bg-danger-soft text-destructive",
        step.state === "none" && "border-dashed border-border bg-card text-muted-foreground",
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-4"} aria-hidden />
    </span>
  );
}

function stateWord(t: Words, state: GroupStepState): string {
  return state === "none" ? t("aiaic.gs.state.none") : t(`aiaic.step.state.${state}`);
}

/** Her price against the buyer's, as her offers list says it: "Your price: Rs 3,930 (-37.7%)". */
function yourPriceSaid(t: Words, pricePerQ: number, ask: number | null) {
  const diff = askDiffPct(pricePerQ, ask);
  if (ask === null || diff === null) return null;
  return (
    <>
      {t("aiaic.offer.your_price", { price: rupees(ask) })}{" "}
      <span className={diff >= 0 ? "text-primary" : "text-destructive"}>
        ({diff >= 0 ? "+" : ""}
        {diff}%)
      </span>
    </>
  );
}

/**
 * WHAT SHE COMPARES BEFORE SHE SAYS YES (the audit of 30 Oct 2026, AUD-1: the decision aid comes before the button): the
 * buyer's price and what her lot comes to, her own asking price with the difference, and her district's mandi middle
 * as AIAIC holds it (how many mandis, their range, the day, the source, how old), then (`note`) that her trip to the
 * collection point is not in the buyer's price (her answer says it under its Accept, keeping the button on her first
 * screen). A price being read, or none held, is said so: never a blank.
 */
export function GroupPriceRows({ prices, note = true }: { prices: GroupPrices; note?: boolean }) {
  const { t } = useI18n();
  const { mandi } = prices;
  const yours = yourPriceSaid(t, prices.pricePerQ, prices.ask);
  const age = typeof mandi?.age_days === "number" ? mandi.age_days : null;
  return (
    <div
      className="divide-y divide-border rounded-2xl border-2 border-border bg-card px-3 text-sm"
      data-testid="aiaic-gs-prices"
    >
      <div className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted-foreground">{t("aiaic.gs.price")}</p>
          <p className="text-xs font-semibold text-foreground">
            {t("aiaic.gs.amount", { amount: rupees(prices.amount) })}
          </p>
        </div>
        <p className="shrink-0 text-right text-lg font-black leading-tight text-primary">
          {t("aiaic.lots.price", { price: rupees(prices.pricePerQ) })}
        </p>
      </div>
      {yours ? (
        <p className="py-2 font-bold text-foreground" data-testid="aiaic-gs-your-price">
          {yours}
        </p>
      ) : null}
      <div className="py-2" data-testid="aiaic-gs-mandi">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-xs font-bold text-muted-foreground">
            {t("aiaic.group.mandi_title")}
          </p>
          {mandi ? (
            <p className="shrink-0 text-right text-base font-black leading-tight text-foreground">
              {t("aiaic.lots.price", { price: rupees(mandi.middle_of_all_per_q ?? null) })}
            </p>
          ) : null}
        </div>
        {mandi ? (
          <p className="text-xs text-muted-foreground">
            {typeof mandi.mandis_reporting === "number"
              ? `${t("aiaic.group.mandi_middle", { n: String(mandi.mandis_reporting) })} · `
              : ""}
            {t("aiaic.group.mandi_line", {
              low: rupees(mandi.lowest_per_q ?? null),
              high: rupees(mandi.highest_per_q ?? null),
              day: dayOf(mandi.price_day ?? null),
              source: mandi.source_name ?? "Agmarknet",
            })}
            {age !== null
              ? ` · ${t(age === 1 ? "aiaic.gs.mandi_age.one" : "aiaic.gs.mandi_age", { n: age })}`
              : ""}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t(prices.reading ? "aiaic.sell.price.reading" : "aiaic.group.mandi_none")}
          </p>
        )}
      </div>
      {note ? (
        <p className="py-2 text-xs font-semibold text-muted-foreground">
          {t("aiaic.gs.trip_not_in_price")}
        </p>
      ) : null}
    </div>
  );
}

/** What has joined against what the buyer wants: the bar and its numbers (the agreed quantities: "joined"; the weighed
 * one is "gathered", on her collection step). */
function JoinedBar({ view }: { view: GroupView }) {
  const { t } = useI18n();
  const g = view.gathered;
  return (
    <div className="rounded-2xl bg-secondary p-3" data-testid="aiaic-gs-numbers">
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Users className="size-4 shrink-0 text-primary" aria-hidden />
        {t("aiaic.gs.joined_title")}
      </p>
      <div
        className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={g.pct}
        aria-label={t("aiaic.gs.joined_title")}
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${g.pct}%` }} />
      </div>
      <p className="mt-1 text-sm font-bold text-foreground">
        {t("aiaic.gs.gathered", {
          joined: quintalWords(t, g.joined_q),
          target: quintalWords(t, g.target_q),
          pct: String(g.pct),
        })}
      </p>
      <p className="text-xs font-semibold text-muted-foreground">
        {t(g.farmers === 1 ? "aiaic.gs.farmers.one" : "aiaic.gs.farmers", {
          n: String(g.farmers),
          left: quintalWords(t, g.left_q),
        })}
      </p>
    </div>
  );
}

/**
 * HER GROUP SALE, STEP BY STEP (30 Oct 2026; the owner: "clear button in UI a farmer, a buyer or operator can follow
 * step by step with clear visibility and key indication with good UX"; Annapoorna is the phone app, so 390 px first):
 * the offer's or sale's own head (`heading`, `subline`, `chips`), then the step she is at NOW with her one
 * clear thing to do (`children`: the page's buttons) on the first screen, then the prices she compares (beside the
 * buttons instead when the page's answer shows them: `pricesInAnswer`), the quantity joined, and the five steps
 * (`groupView`), each marked by a colour WITH its icon and its word. `extra`: a line the page adds under a step (her
 * lot gathered with others, on the collection); `record`: every step AIAIC recorded on her sale, behind one press.
 * `paidWords`: AIAIC's own sentence for her money on this sale, said as the money step's line when there is one.
 */
export function GroupSteps({
  view,
  prices,
  pricesInAnswer = false,
  practice,
  paidWords,
  heading,
  subline,
  chips,
  extra,
  record,
  children,
}: {
  view: GroupView;
  prices: GroupPrices;
  pricesInAnswer?: boolean | undefined;
  practice?: boolean | undefined;
  paidWords?: string | null | undefined;
  /** The page's own title (the crop and her quantity) and the line under it (the buyer). */
  heading?: string | undefined;
  subline?: string | undefined;
  /** The page's own marks beside the group sale's (the offer's state, the order's number). */
  chips?: ReactNode;
  extra?: Partial<Record<GroupStepKey, ReactNode>> | undefined;
  record?: { count: number; node: ReactNode } | null | undefined;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const current = view.steps.find((s) => s.key === view.current) ?? null;
  // her money said in AIAIC's own words when the page has them (more exact than the step's own), else the step's
  const lineOf = (s: GroupStep) =>
    s.key === "paid" && paidWords && s.state !== "none" ? paidWords : groupSaid(t, s.say);
  const answered = view.steps.find((s) => s.key === "answered") ?? null;
  const last = view.steps[view.steps.length - 1] ?? null;
  return (
    <section
      className="space-y-3 rounded-3xl border-2 border-primary/40 bg-card p-4 shadow-sm sm:p-5"
      data-testid="aiaic-group-steps"
      data-current={view.current ?? (view.declined ? "said_no" : "all_done")}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-extrabold text-primary-foreground">
          <Users className="size-3.5" aria-hidden />
          {t("aiaic.group.chip")}
        </span>
        {chips}
        {practice ? <ModeChip kind="practice" /> : null}
      </div>
      {heading ? (
        <div>
          <h1 className="break-words text-2xl font-extrabold text-foreground">{heading}</h1>
          {subline ? <p className="break-words text-sm text-muted-foreground">{subline}</p> : null}
        </div>
      ) : null}

      {/* WHERE SHE IS NOW, and her one thing to do */}
      <div
        className={cn(
          "rounded-2xl border-2 p-3",
          current?.state === "stopped"
            ? "border-destructive/50 bg-danger-soft"
            : "border-primary bg-primary/5",
        )}
        data-testid="aiaic-gs-now"
      >
        {current ? (
          <div className="flex items-start gap-3">
            <StateMark step={current} />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-xs font-extrabold uppercase tracking-wide",
                  current.state === "stopped" ? "text-destructive" : "text-primary",
                )}
              >
                {current.state === "stopped" ? stateWord(t, "stopped") : t("aiaic.gs.now")}
              </p>
              <p className="text-base font-extrabold text-foreground">
                {t(`aiaic.gs.step.${current.key}`)}
              </p>
              <p className="break-words text-sm font-semibold text-foreground">{lineOf(current)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground">
              <CircleCheck className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              {/* she said no: nothing more to do, her lot is hers (never "all steps done") */}
              <p className="text-base font-extrabold text-foreground">
                {t(view.declined ? "aiaic.gs.said_no_end" : "aiaic.gs.all_done")}
              </p>
              <p className="break-words text-sm font-semibold text-foreground">
                {view.declined ? groupSaid(t, answered?.say ?? null) : last ? lineOf(last) : ""}
              </p>
            </div>
          </div>
        )}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>

      {pricesInAnswer ? null : <GroupPriceRows prices={prices} />}
      <JoinedBar view={view} />

      {/* THE FIVE STEPS */}
      <h2 className="pt-1 text-base font-extrabold text-foreground">{t("aiaic.gs.title")}</h2>
      <ol className="space-y-0" aria-label={t("aiaic.gs.title")}>
        {view.steps.map((s, i) => (
          <li
            key={s.key}
            className="relative flex gap-3 pb-3 last:pb-0"
            aria-current={s.key === view.current ? "step" : undefined}
            data-state={s.state}
            data-step={s.key}
          >
            {i < view.steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-5 top-10 h-[calc(100%-2.5rem)] w-1 -translate-x-1/2 rounded-full",
                  s.state === "done" ? "bg-primary/60" : "bg-border",
                )}
              />
            ) : null}
            <StateMark step={s} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                  className={cn(
                    "text-base font-extrabold",
                    s.state === "todo" || s.state === "none"
                      ? "text-muted-foreground"
                      : "text-foreground",
                  )}
                >
                  {t(`aiaic.gs.step.${s.key}`)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                    s.state === "done" && "bg-primary/15 text-primary",
                    s.state === "now" && "bg-primary text-primary-foreground",
                    s.state === "todo" && "bg-muted text-muted-foreground",
                    s.state === "stopped" && "bg-danger-soft text-destructive",
                    s.state === "none" && "bg-muted text-muted-foreground",
                  )}
                >
                  {stateWord(t, s.state)}
                </span>
              </p>
              {s.say ? <p className="break-words text-sm text-foreground">{lineOf(s)}</p> : null}
              {extra?.[s.key] ?? null}
            </div>
          </li>
        ))}
      </ol>

      {/* EVERY STEP AIAIC RECORDED ON HER SALE (its facts and days), kept, behind one press */}
      {record && record.count > 0 ? (
        <details
          className="rounded-2xl border-2 border-border bg-secondary/40 px-3 py-2"
          data-testid="aiaic-gs-record"
        >
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-foreground">
            <ClipboardList className="size-4 shrink-0 text-primary" aria-hidden />
            {t("aiaic.gs.record", { n: String(record.count) })}
          </summary>
          <div className="pb-1 pt-2">{record.node}</div>
        </details>
      ) : null}
    </section>
  );
}

/** The same steps on one line, for a list (her offers, her sales): five marks, then the step she is at and its words
 * (her money in AIAIC's own words when given: `paidWords`, as on her order's page), and the quantity joined. */
export function GroupStepsLine({
  view,
  paidWords,
}: {
  view: GroupView;
  paidWords?: string | null | undefined;
}) {
  const { t } = useI18n();
  const current = view.steps.find((s) => s.key === view.current) ?? null;
  const g = view.gathered;
  return (
    <div className="mt-2 space-y-1.5" data-testid="aiaic-group-steps-line">
      <ol
        className="grid grid-cols-5 gap-1"
        aria-label={view.steps
          .map((s) => `${t(`aiaic.gs.step.${s.key}`)}: ${stateWord(t, s.state)}`)
          .join(", ")}
      >
        {view.steps.map((s, i) => (
          <li
            key={s.key}
            className="relative flex flex-col items-center text-center"
            aria-current={s.key === view.current ? "step" : undefined}
          >
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute right-1/2 top-4 h-1 w-full -translate-y-1/2",
                  s.state === "done" || s.state === "now" ? "bg-primary/60" : "bg-border",
                )}
              />
            ) : null}
            <StateMark step={s} size="sm" />
            <span
              className={cn(
                "mt-1 text-[11px] font-bold leading-tight",
                s.key === view.current ? "text-primary" : "text-muted-foreground",
              )}
            >
              {t(`aiaic.gs.step.${s.key}`)}
            </span>
          </li>
        ))}
      </ol>
      {current ? (
        <p className="break-words text-sm font-bold text-foreground">
          <span className="text-primary">{t(`aiaic.gs.step.${current.key}`)}:</span>{" "}
          {current.key === "paid" && paidWords ? paidWords : groupSaid(t, current.say)}
        </p>
      ) : null}
      <p className="text-xs font-semibold text-muted-foreground">
        {t("aiaic.gs.gathered", {
          joined: quintalWords(t, g.joined_q),
          target: quintalWords(t, g.target_q),
          pct: String(g.pct),
        })}{" "}
        · {t("aiaic.gs.left_short", { left: quintalWords(t, g.left_q) })}
      </p>
    </div>
  );
}

/**
 * HER ANSWER TO A GROUP SALE (30 Oct 2026): first what she compares (`GroupPriceRows`: the buyer's price, hers, her
 * district's mandi middle; the audit's AUD-1), then Accept or Decline, each saying what happens next, and each asked
 * again before it is sent (neither can be undone in this app): yes makes her sale; no closes the invitation, her lot
 * stays hers. The accept confirm says her price and the mandi middle again, beside its "cannot be undone".
 */
export function GroupAnswer({
  asking,
  setAsking,
  busy,
  onAnswer,
  qty,
  crop,
  prices,
  practice,
  place,
  day,
}: {
  asking: "accept" | "reject" | null;
  setAsking: (a: "accept" | "reject" | null) => void;
  busy: boolean;
  onAnswer: (which: "accept" | "reject") => void;
  qty: number;
  crop: string;
  prices: GroupPrices;
  practice: boolean;
  place: string;
  day: string;
}) {
  const { t } = useI18n();
  const q = quintalWords(t, qty);
  const { mandi } = prices;
  if (asking)
    return (
      <div
        role="alertdialog"
        aria-labelledby="aiaic-gs-confirm-title"
        className="space-y-3 rounded-2xl border-2 border-primary bg-card p-3"
        data-testid={`aiaic-gs-confirm-${asking}`}
      >
        <h3 id="aiaic-gs-confirm-title" className="text-lg font-black text-foreground">
          {asking === "accept"
            ? t("aiaic.gs.confirm_accept", { qty: q })
            : t("aiaic.gs.confirm_decline")}
        </h3>
        {asking === "accept" ? (
          <div className="space-y-1">
            <p className="text-base font-bold text-foreground">
              {crop} · {q} · {t("aiaic.lots.price", { price: rupees(prices.pricePerQ) })} ·{" "}
              {rupees(prices.amount)}
            </p>
            {prices.ask !== null ? (
              <p className="text-sm font-bold text-foreground">
                {yourPriceSaid(t, prices.pricePerQ, prices.ask)}
              </p>
            ) : null}
            <p className="text-sm font-semibold text-foreground">
              {mandi
                ? t("aiaic.gs.mandi_short", {
                    price: t("aiaic.lots.price", {
                      price: rupees(mandi.middle_of_all_per_q ?? null),
                    }),
                    day: dayOf(mandi.price_day ?? null),
                    source: mandi.source_name ?? "Agmarknet",
                  })
                : t(prices.reading ? "aiaic.sell.price.reading" : "aiaic.group.mandi_none")}
            </p>
          </div>
        ) : null}
        <p className="text-sm font-semibold text-foreground">
          {asking === "accept" ? t("aiaic.offer.confirm.final") : t("aiaic.gs.decline_final")}
        </p>
        {asking === "accept" && practice ? (
          <p className="text-xs font-semibold text-muted-foreground">{t("aiaic.practice.tip")}</p>
        ) : null}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAnswer(asking)}
            className={cn(
              "flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 text-lg font-extrabold disabled:opacity-60",
              asking === "accept"
                ? "bg-primary text-primary-foreground"
                : "bg-destructive text-destructive-foreground",
            )}
            data-testid={`aiaic-gs-confirm-${asking}-yes`}
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : asking === "accept" ? (
              <CheckCircle2 className="size-5" aria-hidden />
            ) : (
              <XCircle className="size-5" aria-hidden />
            )}
            {asking === "accept" ? t("aiaic.gs.confirm_accept_yes") : t("aiaic.offer.reject.yes")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setAsking(null)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-5 font-bold disabled:opacity-60"
          >
            <ArrowLeft className="size-5" aria-hidden />
            {t("aiaic.back")}
          </button>
        </div>
      </div>
    );
  return (
    <div className="space-y-2.5" data-testid="aiaic-gs-answer">
      <GroupPriceRows prices={prices} note={false} />
      <div>
        <button
          type="button"
          onClick={() => setAsking("accept")}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-lg font-extrabold text-primary-foreground shadow-md"
          data-testid="aiaic-gs-accept"
        >
          <CheckCircle2 className="size-6" aria-hidden />
          {t("aiaic.gs.accept", { qty: q })}
        </button>
        <p className="mt-1 px-1 text-xs font-semibold text-foreground">
          {place
            ? t(day ? "aiaic.gs.accept_next" : "aiaic.gs.accept_next_no_day", { place, day })
            : t("aiaic.gs.accept_next_plain")}
        </p>
        <p className="px-1 text-xs font-semibold text-muted-foreground">
          {t("aiaic.gs.trip_not_in_price")}
        </p>
      </div>
      <div>
        <button
          type="button"
          onClick={() => setAsking("reject")}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-4 text-base font-bold text-foreground"
          data-testid="aiaic-gs-decline"
        >
          <XCircle className="size-5 text-muted-foreground" aria-hidden />
          {t("aiaic.gs.decline")}
        </button>
        <p className="mt-1 px-1 text-xs font-semibold text-muted-foreground">
          {t("aiaic.gs.decline_next")}
        </p>
      </div>
    </div>
  );
}
