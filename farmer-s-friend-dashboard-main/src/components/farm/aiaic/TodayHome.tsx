import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Banknote,
  CheckCheck,
  ChevronRight,
  Clock,
  ClipboardList,
  Handshake,
  Hourglass,
  Landmark,
  LifeBuoy,
  LogIn,
  Mail,
  PackageCheck,
  Phone,
  RefreshCw,
  RotateCcw,
  Scale,
  Send,
  ShoppingBag,
  Sprout,
  TrendingUp,
  Truck,
  Wallet,
  Warehouse,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { Loading } from "@/components/farm/aiaic/AiaicBits";
import { useRaiseCrisis } from "@/lib/aiaic-crisis";
import { useMine, useProblemText } from "@/lib/aiaic-hooks";
import { useMe } from "@/lib/aiaic-me";
import {
  forgetSellStart,
  keepSellStart,
  newestLotAt,
  readSellStart,
  sellStillOpen,
  todayItems,
  type DeliveryStep,
  type Fee,
  type LotNow,
  type MoneyState,
  type OfferNow,
  type SaleNow,
  type SellStarted,
  type TodayItem,
} from "@/lib/aiaic-today";
import {
  buyerLine,
  cropName,
  dayOf,
  mineShown,
  quintalWords,
  rupees,
  type AiaicProblem,
  type LaneCode,
  type MineForScreen,
} from "@/lib/aiaic-trade";
import { loadFarm, type SavedFarm } from "@/lib/farm-storage";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * HER GUIDED HOME, `/today` (the Crowe Group EOD task, 16 Nov 2026, work package 1).
 *
 * "What would you like to do today?": her sales and lots as AIAIC holds them now (`aiaic-today.ts`: the order, the
 * buyer's payment, the delivery and her money as four separate states, then her next step and whom the sale waits on),
 * then large cards for her routine tasks, ranked (`FARMER_JOURNEY_PRIORITISED.md`), each opening the EXISTING flow: this
 * page makes no decision of its own and holds no press that changes anything in AIAIC. A person closes the page.
 *
 * THE TASK'S FLOORS, IN CSS PIXELS WHATEVER THE ROOT SIZE: the app's root font is 15.1 px on a 360 px phone
 * (`styles.css`: `clamp(15px, 4.2vw, 18px)`), so `min-h-12` is 45 px there. Every control THIS PAGE draws is at least 48 px
 * tall and every word at least 16 px (`TARGET`, `BODY`), written as styles, so a test can read them on each element. The
 * app's shell around it (the top bar, the bottom bar, the footer) is not this page's: it keeps the root's sizes (the
 * audit's D1, the design owner's).
 *
 * A READ AGAIN THAT FAILS KEEPS WHAT SHE SAW (R5P-09, the app's rule for every sale page, `mineShown`): once her records
 * were shown, a failed read every 15 s or on her return to the page keeps them, with a quiet line and "Try again"; only a
 * first read that fails shows the problem; AIAIC's crisis answer always takes the page.
 */

/** Every control: at least 48 px, or the root's 3 rem where that is more. */
const TARGET: CSSProperties = { minHeight: "max(48px, 3rem)" };
/** Every word: at least 16 px, or the root's 1 rem where that is more. */
const BODY: CSSProperties = { fontSize: "max(16px, 1rem)" };
const LEAD: CSSProperties = { fontSize: "max(18px, 1.125rem)" };
const H2: CSSProperties = { fontSize: "max(21px, 1.3rem)" };
const TITLE: CSSProperties = { fontSize: "max(26px, 1.625rem)" };
/** How many of her sales and lots the page shows; the rest are one press away on Orders & Offers. */
export const MOST_SHOWN = 6;
/** A read refused because she is signed out: said with Sign in. */
const SIGN_IN_AGAIN = new Set(["sign_in_to_sell", "aiaic_signed_out"]);

const PRESS =
  "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-center focus:outline-none focus:ring-4 focus:ring-ring";
const PRIMARY = `${PRESS} bg-primary font-extrabold text-primary-foreground hover:bg-primary/90`;
const QUIET = `${PRESS} border-2 border-border bg-card font-bold text-foreground hover:bg-secondary`;
const PERSON =
  "flex items-center gap-2 rounded-2xl border-2 border-primary/40 bg-secondary px-4 py-2 font-bold text-foreground focus:outline-none focus:ring-4 focus:ring-ring";
const TASK =
  "flex w-full items-center gap-3 rounded-3xl border-2 border-primary/40 bg-card px-4 py-3 text-left transition-colors hover:bg-secondary focus:outline-none focus:ring-4 focus:ring-ring";
const TASK_SIZE: CSSProperties = { minHeight: "max(72px, 4.5rem)" };
const PRESS_STYLE: CSSProperties = { ...TARGET, ...BODY };

type Tone = "good" | "info" | "warn" | "stop" | "todo";
const TONE: Record<Tone, string> = {
  good: "border-primary bg-primary/10",
  info: "border-border bg-secondary",
  warn: "border-warning bg-warning-soft",
  stop: "border-destructive/60 bg-danger-soft",
  todo: "border-border bg-muted",
};
const LANE: Record<LaneCode, { icon: LucideIcon; tone: Tone }> = {
  agreed: { icon: Handshake, tone: "info" },
  being_readied: { icon: Hourglass, tone: "info" },
  on_the_way: { icon: Truck, tone: "info" },
  delivered: { icon: PackageCheck, tone: "good" },
  reconciled: { icon: Scale, tone: "good" },
  disputed: { icon: AlertTriangle, tone: "warn" },
  called_off: { icon: XCircle, tone: "stop" },
};
const MONEY: Record<MoneyState, { icon: LucideIcon; tone: Tone }> = {
  reached: { icon: CheckCheck, tone: "good" },
  sent: { icon: Send, tone: "info" },
  held: { icon: Landmark, tone: "info" },
  buyer_paid: { icon: Banknote, tone: "info" },
  not_paid: { icon: Clock, tone: "todo" },
  stopped: { icon: XCircle, tone: "stop" },
};
function payTone(state: string): { icon: LucideIcon; tone: Tone } {
  if (state === "paid") return { icon: Banknote, tone: "good" };
  if (state === "link_expired" || state === "link_cancelled")
    return { icon: XCircle, tone: "stop" };
  if (state === "link_created" || state === "partially_paid") return { icon: Clock, tone: "info" };
  return { icon: Clock, tone: "todo" };
}

/** A status: always an icon, a word and a colour together (never colour alone). */
function Status({
  icon: Icon,
  tone,
  code,
  children,
}: {
  icon: LucideIcon;
  tone: Tone;
  code: string;
  children: ReactNode;
}) {
  return (
    <span
      data-status={code}
      data-tone={tone}
      className={cn(
        "inline-flex items-start gap-1.5 rounded-xl border-2 px-2 py-1 font-bold text-foreground",
        TONE[tone],
      )}
      style={BODY}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function PracticeChip() {
  const { t } = useI18n();
  return (
    <span
      data-testid="today-practice-chip"
      className="inline-flex items-center gap-1 rounded-full border-2 border-warning bg-warning-soft px-2.5 py-0.5 font-bold text-warning-foreground"
      style={BODY}
    >
      <Sprout aria-hidden className="size-4 shrink-0" />
      {t("aiaic.chip.practice")}
    </span>
  );
}

function NeedsYouChip() {
  const { t } = useI18n();
  return (
    <span
      data-testid="today-needs-you"
      className="inline-flex items-center gap-1 rounded-full border-2 border-primary bg-primary px-2.5 py-0.5 font-extrabold text-primary-foreground"
      style={BODY}
    >
      <AlertTriangle aria-hidden className="size-4 shrink-0" />
      {t("aiaic.today.needs_you")}
    </span>
  );
}

/**
 * How one recorded step is drawn: done, failed, or under way. A PROBLEM REPORTED (`delivery_exception`) is never drawn as
 * a success: the warning's icon and colour, and no "done" after it (the skeptic's SK-ANN-6).
 */
function stepLook(s: DeliveryStep): { icon: LucideIcon; tone: Tone; sayStatus: boolean } {
  if (s.stage === "delivery_exception")
    return { icon: AlertTriangle, tone: "warn", sayStatus: s.status !== "done" };
  if (s.status === "done") return { icon: CheckCheck, tone: "good", sayStatus: true };
  if (s.status === "failed") return { icon: XCircle, tone: "stop", sayStatus: true };
  return { icon: Clock, tone: "todo", sayStatus: true };
}

/** A deduction's line: its name with its rate, as her sale's own money card says it, then its amount. */
function feeLine(
  t: (k: string, v?: Record<string, string | number>) => string,
  key: string,
  fee: Fee,
) {
  return `${t(key, { pct: fee.pct ?? "—" })}: ${rupees(fee.amount)}`;
}

/** A press's words, then its arrow: an icon and words, never an icon alone. */
function Go({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="min-w-0 break-words">{children}</span>
      <ChevronRight aria-hidden className="size-5 shrink-0" />
    </>
  );
}

// ------------------------------------------------------------------------------------------------ her items

function OfferCard({ item, data }: { item: OfferNow; data: MineForScreen }) {
  const { t } = useI18n();
  const o = item.offer;
  return (
    <article
      data-testid="today-item"
      data-kind="offer"
      data-id={item.id}
      className="rounded-3xl border-2 border-primary bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <NeedsYouChip />
        {item.practice ? <PracticeChip /> : null}
      </div>
      <h3 className="mt-2 font-extrabold text-foreground" style={LEAD}>
        {t("aiaic.today.offer.title")}
      </h3>
      <p className="mt-1 break-words text-foreground" style={BODY}>
        {t("aiaic.today.offer.line", {
          qty: quintalWords(t, o.quantity_q),
          crop: cropName(data.cropNames, item.listing.crop),
          price: rupees(o.price_per_q),
          total: rupees(item.total),
        })}
      </p>
      <p className="mt-1 break-words text-foreground" style={BODY} data-name="">
        {buyerLine(t, data.districtNames, o.buyer_type, o.buyer_district, o.buyer_name)}
      </p>
      {o.valid_until ? (
        <p className="mt-1 text-foreground" style={BODY}>
          {t("aiaic.offer.open_until", { day: dayOf(o.valid_until) })}
        </p>
      ) : null}
      <Link
        to="/orders/$orderId"
        params={{ orderId: o.offer_id }}
        data-testid="today-answer-offer"
        className={cn("mt-3", PRIMARY)}
        style={PRESS_STYLE}
      >
        <Go>{t("aiaic.today.offer.answer")}</Go>
      </Link>
    </article>
  );
}

function LotCard({ item, data }: { item: LotNow; data: MineForScreen }) {
  const { t } = useI18n();
  const l = item.listing;
  const crop = cropName(data.cropNames, l.crop);
  const qty = quintalWords(t, l.quantity_left_q);
  return (
    <article
      data-testid="today-item"
      data-kind="lot"
      data-id={item.id}
      className="rounded-3xl border-2 border-border bg-card p-4"
    >
      {item.practice ? <PracticeChip /> : null}
      <h3 className="mt-2 font-extrabold text-foreground" style={LEAD}>
        {t("aiaic.today.lot.title")}
      </h3>
      <p className="mt-1 break-words text-foreground" style={BODY}>
        {l.ask_price_per_q !== null
          ? t("aiaic.today.lot.line", { qty, crop, price: rupees(l.ask_price_per_q) })
          : t("aiaic.today.lot.line_no_price", { qty, crop })}
      </p>
      <Link
        to="/listing/$listingId"
        params={{ listingId: l.listing_id }}
        data-testid="today-see-lot"
        className={cn("mt-3", PRIMARY)}
        style={PRESS_STYLE}
      >
        <Go>{t("aiaic.today.lot.see")}</Go>
      </Link>
    </article>
  );
}

function SaleCard({ item, data }: { item: SaleNow; data: MineForScreen }) {
  const { t } = useI18n();
  const o = item.order;
  const lane = LANE[item.lane];
  const pay = payTone(item.payment.state);
  const m = item.money;
  const money = MONEY[m.state];
  return (
    <article
      data-testid="today-item"
      data-kind="sale"
      data-id={item.id}
      data-lane={item.lane}
      className={cn(
        "rounded-3xl border-2 bg-card p-4",
        item.needsHer ? "border-primary shadow-sm" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {item.needsHer ? <NeedsYouChip /> : null}
        {item.practice ? <PracticeChip /> : null}
      </div>
      <h3 className="mt-2 break-words font-extrabold text-foreground" style={LEAD}>
        {t("aiaic.today.sale.title", {
          qty: quintalWords(t, o.quantity_q),
          crop: cropName(data.cropNames, o.crop),
        })}
      </h3>
      <p className="mt-1 break-words text-foreground" style={BODY} data-name="">
        {buyerLine(t, data.districtNames, o.buyer_type, o.buyer_district, o.buyer_name)}
      </p>
      {/* "step n of 5" on the five steps her sale's own page draws (the brief's progress rule) */}
      {item.progress ? (
        <p
          className="mt-1 break-words font-bold text-foreground"
          style={BODY}
          data-testid="today-progress"
          data-step={item.progress.key}
        >
          {t("aiaic.store.step.of", { n: item.progress.n, total: item.progress.of })}{" "}
          {t(`aiaic.step.${item.progress.key}`)}
        </p>
      ) : null}

      {/* FOUR SEPARATE STATES: never one word for the order, the payment, the delivery and her money */}
      <dl className="mt-3 space-y-2.5" data-testid="today-states">
        <div data-testid="today-state-order">
          <dt className="font-bold text-foreground" style={BODY}>
            {t("aiaic.today.state.order")}
          </dt>
          <dd className="mt-1">
            <Status icon={lane.icon} tone={lane.tone} code={item.lane}>
              <span data-testid="today-lane-word">{t(`aiaic.today.lane.${item.lane}`)}</span>
              {item.since ? (
                <span className="block font-semibold" data-testid="today-lane-since">
                  {t("aiaic.today.lane.since", { day: dayOf(item.since) })}
                </span>
              ) : null}
            </Status>
          </dd>
        </div>
        <div data-testid="today-state-payment">
          <dt className="font-bold text-foreground" style={BODY}>
            {t("aiaic.today.state.payment")}
          </dt>
          <dd className="mt-1">
            <Status icon={pay.icon} tone={pay.tone} code={item.payment.state}>
              {t(item.payment.key)}
            </Status>
          </dd>
        </div>
        <div data-testid="today-state-delivery">
          <dt className="font-bold text-foreground" style={BODY}>
            {t("aiaic.today.state.delivery")}
          </dt>
          <dd className="mt-1">
            {item.delivery.length ? (
              <ul className="space-y-1.5">
                {item.delivery.map((s, i) => {
                  const look = stepLook(s);
                  // each step's day and how AIAIC knows it (its `evidence_kind`), as AIAIC recorded them (SK-ANN-4)
                  const known =
                    !s.simulated && s.evidence && s.evidence !== "simulated"
                      ? t(`aiaic.today.known.${s.evidence}`)
                      : null;
                  const facts = [dayOf(s.at), known].filter(Boolean).join(" · ");
                  return (
                    <li
                      key={`${s.stage}-${i}`}
                      data-stage={s.stage}
                      data-step-status={s.status}
                      data-evidence={s.evidence ?? ""}
                    >
                      <Status icon={look.icon} tone={look.tone} code={`${s.stage}:${s.status}`}>
                        {t(`aiaic.today.stage.${s.stage}`)}
                        {look.sayStatus ? `: ${t(`aiaic.today.step.${s.status}`)}` : null}
                        {s.simulated ? (
                          <span data-testid="today-practice-step">
                            {" "}
                            ({t("aiaic.today.step.practice")})
                          </span>
                        ) : null}
                        {facts ? (
                          <span className="block font-semibold" data-testid="today-step-known">
                            {facts}
                          </span>
                        ) : null}
                      </Status>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Status icon={Clock} tone="todo" code="none">
                {t("aiaic.today.delivery.none")}
              </Status>
            )}
          </dd>
        </div>
        <div data-testid="today-state-money">
          <dt className="font-bold text-foreground" style={BODY}>
            {t("aiaic.today.state.money")}
          </dt>
          <dd className="mt-1">
            <Status icon={money.icon} tone={money.tone} code={m.state}>
              {t(`aiaic.today.money.${m.state}`)}
              {m.state === "held" && m.holds ? (
                <span className="block font-semibold" data-testid="today-money-why">
                  {t(`aiaic.money.holds.waits_for.${m.holds.waits_for}`)}
                </span>
              ) : null}
            </Status>
          </dd>
        </div>
      </dl>

      {item.next || item.waitingOn || item.group ? (
        <div className="mt-3 rounded-2xl border-2 border-primary/40 bg-secondary p-3">
          {item.group ? (
            <p data-testid="today-group" className="font-bold text-foreground" style={BODY}>
              {t("aiaic.today.sale.group")}
            </p>
          ) : null}
          {item.next ? (
            <p data-testid="today-next" className="font-extrabold text-foreground" style={BODY}>
              {t(`aiaic.sale.next.${item.next}`)}
            </p>
          ) : null}
          {item.waitingOn ? (
            <p
              data-testid="today-waiting"
              data-waiting={item.waitingOn}
              className="mt-1 font-bold text-foreground"
              style={BODY}
            >
              {t(`aiaic.today.waiting.${item.waitingOn.replace(":", "_")}`)}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* the money's parts, behind one control: gross, deductions, transport, her amount (estimate or confirmed) */}
      <details className="mt-3 rounded-2xl border-2 border-border" data-testid="today-money-more">
        <summary
          className="flex cursor-pointer items-center gap-2 rounded-2xl px-3 font-bold text-foreground"
          style={PRESS_STYLE}
        >
          <Wallet aria-hidden className="size-5 shrink-0" />
          {t("aiaic.today.money.more")}
        </summary>
        <ul className="space-y-1.5 px-3 pb-3 text-foreground" style={BODY}>
          <li data-testid="today-money-gross">
            {t("aiaic.today.money.gross", { amount: rupees(m.gross) })}
          </li>
          {/* AIAIC's commission and the GST on it, each on its own line with its rate (SK-ANN-8) */}
          {m.commission ? (
            <li data-testid="today-money-commission">
              {feeLine(t, "aiaic.money.commission", m.commission)}
            </li>
          ) : null}
          {m.gst ? (
            <li data-testid="today-money-gst">{feeLine(t, "aiaic.money.gst", m.gst)}</li>
          ) : null}
          <li data-testid="today-money-transport">{t("aiaic.today.money.transport")}</li>
          {/* a sale called off: nothing is due to her, said plainly; no amount "to you" (SK-ANN-5) */}
          {m.noneDue ? (
            <li data-testid="today-money-none-due">{t("aiaic.today.money.none_due")}</li>
          ) : null}
          {m.toHer !== null ? (
            <li data-testid="today-money-to-her" data-confirmed={m.confirmed ? "yes" : "no"}>
              {t(
                m.confirmed
                  ? "aiaic.today.money.to_her_confirmed"
                  : "aiaic.today.money.to_her_estimate",
                { amount: rupees(m.toHer) },
              )}
            </li>
          ) : null}
        </ul>
      </details>

      <Link
        to="/orders/$orderId"
        params={{ orderId: o.order_id }}
        data-testid="today-see-sale"
        className={cn("mt-3", PRIMARY)}
        style={PRESS_STYLE}
      >
        <Go>{t("aiaic.sale.open")}</Go>
      </Link>
    </article>
  );
}

function ItemCard({ item, data }: { item: TodayItem; data: MineForScreen }) {
  if (item.kind === "offer") return <OfferCard item={item} data={data} />;
  if (item.kind === "lot") return <LotCard item={item} data={data} />;
  return <SaleCard item={item} data={data} />;
}

// --------------------------------------------------------------------------------------------- the page

/** What a task card shows: its icon, its name, one line of what it does, and (where advice shows) the warning. */
function TaskInner({
  icon: Icon,
  title,
  tip,
  kept = null,
  note = null,
  testid,
}: {
  icon: LucideIcon;
  title: string;
  tip: string;
  /** where the card opens what her phone kept (her saved crop and district): said, so she knows what it continues */
  kept?: string | null;
  note?: string | null;
  testid: string;
}) {
  return (
    <>
      <Icon aria-hidden className="size-8 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block break-words font-extrabold text-foreground" style={LEAD}>
          {title}
        </span>
        <span className="block break-words text-foreground" style={BODY}>
          {tip}
        </span>
        {kept ? (
          <span
            data-testid={`${testid}-kept`}
            className="mt-1 block break-words font-bold text-foreground"
            style={BODY}
          >
            {kept}
          </span>
        ) : null}
        {note ? (
          <span
            data-testid={`${testid}-note`}
            className="mt-1 block break-words font-semibold text-warning-foreground"
            style={BODY}
          >
            {note}
          </span>
        ) : null}
      </span>
      <ChevronRight aria-hidden className="size-6 shrink-0 text-primary" />
    </>
  );
}

/** Her saved farm as the advice page's address (the state goes with the place, F35), as the landing builds it. */
function adviceSearch(saved: SavedFarm) {
  return {
    ...(saved.region ? { region: saved.region } : {}),
    ...(saved.crop ? { crop: saved.crop } : {}),
    ...(saved.land ? { land: saved.land } : {}),
    ...(saved.services ? { services: saved.services } : {}),
    ...(saved.state ? { state: saved.state } : {}),
  };
}

export function TodayHome() {
  const { t } = useI18n();
  const say = useProblemText();
  const raise = useRaiseCrisis();
  const me = useMe();
  const signedIn = me.data?.signedIn === true;
  const mine = useMine(signedIn, "live");
  // the records last shown on this page (R5P-09): a read again that fails keeps them
  const [lastShown, setLastShown] = useState<MineForScreen | null>(null);
  const fresh = mine.data?.ok ? mine.data.data : null;
  useEffect(() => {
    if (fresh) setLastShown(fresh);
  }, [fresh]);
  // signed out: what she saw is no longer shown or kept
  useEffect(() => {
    if (!signedIn) setLastShown(null);
  }, [signedIn]);
  const [saved, setSaved] = useState<SavedFarm | null>(null);
  const [started, setStarted] = useState<SellStarted | null>(null);
  // what this phone keeps is read once the page is on screen (the server's first page and the browser's must match)
  useEffect(() => {
    const farm = loadFarm();
    if (farm && (farm.region || farm.crop)) setSaved(farm);
    setStarted(readSellStart());
  }, []);

  const shown = mineShown({ data: mine.data, isError: mine.isError }, lastShown);
  const data = shown.show === "records" ? shown.data : null;
  const failed: AiaicProblem | null = shown.show === "problem" ? shown.problem : null;
  const notRefreshed: AiaicProblem | null = shown.show === "records" ? shown.notRefreshed : null;
  // AIAIC's crisis answer takes the whole page (`CrisisFirst`), as on every AIAIC page
  useEffect(() => {
    if (failed?.crisis && raise) raise(failed);
  }, [failed, raise]);
  const items = data ? todayItems(data.mine) : [];
  const resume = started && data && sellStillOpen(started, data.mine) ? started : null;
  // a sale she started here and has listed since: forgotten
  useEffect(() => {
    if (started && data && !sellStillOpen(started, data.mine)) {
      forgetSellStart();
      setStarted(null);
    }
  }, [started, data]);

  const sellSearch = {
    ...(saved?.crop ? { crop: saved.crop } : {}),
    ...(saved?.region ? { region: saved.region } : {}),
  };
  const keptCrop = saved?.crop && data ? cropName(data.cropNames, saved.crop) : null;
  const adviceKept = saved?.region && saved.crop ? adviceSearch(saved) : null;
  const signInAgain = notRefreshed ? SIGN_IN_AGAIN.has(notRefreshed.code) : false;

  return (
    <div className="mx-auto w-full max-w-xl px-3.5 pb-16 pt-5 sm:px-4 sm:pt-6" data-testid="today">
      <header>
        <h1 className="break-words font-extrabold leading-tight text-foreground" style={TITLE}>
          {t("aiaic.today.title")}
        </h1>
        <p className="mt-2 break-words text-foreground" style={LEAD}>
          {t("aiaic.today.lead")}
        </p>
      </header>

      {/* her sales and lots, as AIAIC holds them now (signed in only: a guest has none of her own) */}
      {me.isPending ? null : !signedIn ? (
        <section
          data-testid="today-guest"
          className="mt-5 rounded-3xl border-2 border-warning bg-warning-soft p-4"
        >
          <p className="break-words font-semibold text-warning-foreground" style={BODY}>
            {t("aiaic.today.guest")}
          </p>
          <Link
            to="/signin"
            data-testid="today-sign-in"
            className={cn("mt-3", PRIMARY)}
            style={PRESS_STYLE}
          >
            <LogIn aria-hidden className="size-5 shrink-0" />
            {t("aiaic.account.sign_in")}
          </Link>
        </section>
      ) : (
        <section aria-labelledby="today-mine-title" className="mt-5" data-testid="today-mine">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="today-mine-title" className="font-extrabold text-foreground" style={H2}>
              {t("aiaic.today.mine.title")}
            </h2>
            {data?.mine.practice ? <PracticeChip /> : null}
          </div>
          {data?.mine.practice ? (
            <p className="mt-1 break-words text-foreground" style={BODY}>
              {t("aiaic.practice.tip")}
            </p>
          ) : null}

          {resume && data ? (
            <div
              data-testid="today-resume"
              className="mt-3 rounded-3xl border-2 border-primary bg-secondary p-4"
            >
              <p className="flex items-start gap-2 font-bold text-foreground" style={BODY}>
                <RotateCcw aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span className="min-w-0 break-words">
                  {resume.crop
                    ? t("aiaic.today.resume.sell_crop", {
                        crop: cropName(data.cropNames, resume.crop),
                      })
                    : t("aiaic.today.resume.sell")}
                </span>
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link
                  to="/listing/new"
                  search={{
                    ...(resume.crop ? { crop: resume.crop } : {}),
                    ...(resume.district ? { region: resume.district } : {}),
                  }}
                  data-testid="today-resume-go"
                  className={PRIMARY}
                  style={PRESS_STYLE}
                >
                  <ShoppingBag aria-hidden className="size-5 shrink-0" />
                  {t("aiaic.today.resume.go")}
                </Link>
                <button
                  type="button"
                  data-testid="today-resume-drop"
                  onClick={() => {
                    forgetSellStart();
                    setStarted(null);
                  }}
                  className={QUIET}
                  style={PRESS_STYLE}
                >
                  <XCircle aria-hidden className="size-5 shrink-0" />
                  {t("aiaic.today.resume.drop")}
                </button>
              </div>
            </div>
          ) : null}

          {/* her records stay; one quiet line says they could not be read again just now (R5P-09) */}
          {notRefreshed ? (
            <div
              role="status"
              data-testid="today-not-refreshed"
              data-code={notRefreshed.code}
              className="mt-3 rounded-2xl border-2 border-border bg-muted p-3"
            >
              <p className="flex items-start gap-2 font-semibold text-foreground" style={BODY}>
                <RefreshCw aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span className="min-w-0 break-words">
                  {signInAgain ? say(notRefreshed) : t("aiaic.not_refreshed")}
                </span>
              </p>
              {signInAgain ? (
                <Link
                  to="/signin"
                  data-testid="today-not-refreshed-sign-in"
                  className={cn("mt-2", QUIET)}
                  style={PRESS_STYLE}
                >
                  <LogIn aria-hidden className="size-5 shrink-0" />
                  {t("aiaic.account.sign_in")}
                </Link>
              ) : (
                <button
                  type="button"
                  data-testid="today-not-refreshed-retry"
                  onClick={() => void mine.refetch()}
                  className={cn("mt-2", QUIET)}
                  style={PRESS_STYLE}
                >
                  <RefreshCw aria-hidden className="size-5 shrink-0" />
                  {t("aiaic.retry")}
                </button>
              )}
            </div>
          ) : null}
          {failed ? (
            failed.crisis ? null : (
              <div
                role="alert"
                data-testid="today-problem"
                data-code={failed.code}
                className="mt-3 rounded-3xl border-2 border-destructive/60 bg-danger-soft p-4"
              >
                <p className="flex items-start gap-2 font-bold text-foreground" style={BODY}>
                  <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
                  <span className="min-w-0 break-words">{say(failed)}</span>
                </p>
                <p className="mt-1 break-words text-foreground" style={BODY}>
                  {t("aiaic.today.problem.kept")}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SIGN_IN_AGAIN.has(failed.code) ? (
                    <Link
                      to="/signin"
                      data-testid="today-problem-sign-in"
                      className={PRIMARY}
                      style={PRESS_STYLE}
                    >
                      <LogIn aria-hidden className="size-5 shrink-0" />
                      {t("aiaic.account.sign_in")}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      data-testid="today-retry"
                      onClick={() => void mine.refetch()}
                      className={cn(
                        PRESS,
                        "bg-destructive font-extrabold text-destructive-foreground",
                      )}
                      style={PRESS_STYLE}
                    >
                      <RefreshCw aria-hidden className="size-5 shrink-0" />
                      {t("aiaic.retry")}
                    </button>
                  )}
                  <Link
                    to="/help"
                    data-testid="today-problem-help"
                    className={QUIET}
                    style={PRESS_STYLE}
                  >
                    <LifeBuoy aria-hidden className="size-5 shrink-0" />
                    {t("aiaic.today.problem.person")}
                  </Link>
                </div>
              </div>
            )
          ) : !data ? (
            <div className="mt-3">
              <Loading />
            </div>
          ) : items.length === 0 ? (
            <p
              data-testid="today-empty"
              className="mt-3 rounded-3xl border-2 border-dashed border-border bg-card p-4 font-semibold text-foreground"
              style={BODY}
            >
              {t("aiaic.today.mine.empty")}
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-3" data-testid="today-items">
                {items.slice(0, MOST_SHOWN).map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <ItemCard item={item} data={data} />
                  </li>
                ))}
              </ul>
              {items.length > MOST_SHOWN ? (
                <Link
                  to="/orders"
                  data-testid="today-see-all"
                  className={cn("mt-3", PRIMARY)}
                  style={PRESS_STYLE}
                >
                  <Go>{t("aiaic.today.mine.more")}</Go>
                </Link>
              ) : null}
            </>
          )}
        </section>
      )}

      {/* her routine tasks, ranked: each opens the existing flow */}
      <section aria-labelledby="today-choose-title" className="mt-7">
        <h2 id="today-choose-title" className="font-extrabold text-foreground" style={H2}>
          {t("aiaic.today.choose.title")}
        </h2>
        <ul className="mt-3 space-y-3" data-testid="today-tasks">
          <li>
            <Link
              to="/listing/new"
              search={sellSearch}
              data-testid="today-task-sell"
              onClick={() =>
                keepSellStart(
                  saved?.crop ?? null,
                  saved?.region ?? null,
                  data ? newestLotAt(data.mine) : null,
                )
              }
              className={TASK}
              style={TASK_SIZE}
            >
              <TaskInner
                icon={ShoppingBag}
                title={t("aiaic.sell.title")}
                tip={
                  keptCrop
                    ? t("aiaic.today.card.sell_crop_tip", { crop: keptCrop })
                    : t("aiaic.today.card.sell_tip")
                }
                testid="today-task-sell"
              />
            </Link>
          </li>
          <li>
            <Link to="/orders" data-testid="today-task-orders" className={TASK} style={TASK_SIZE}>
              <TaskInner
                icon={ClipboardList}
                title={t("aiaic.today.card.orders")}
                tip={t("aiaic.today.card.orders_tip")}
                testid="today-task-orders"
              />
            </Link>
          </li>
          <li>
            {adviceKept ? (
              <Link
                to="/result"
                search={adviceKept}
                data-testid="today-task-price"
                className={TASK}
                style={TASK_SIZE}
              >
                <TaskInner
                  icon={TrendingUp}
                  title={t("aiaic.today.card.price")}
                  tip={t("aiaic.today.card.price_tip")}
                  kept={t("aiaic.today.card.price_kept")}
                  note={t("aiaic.today.card.price_note")}
                  testid="today-task-price"
                />
              </Link>
            ) : (
              <Link to="/ask" data-testid="today-task-price" className={TASK} style={TASK_SIZE}>
                <TaskInner
                  icon={TrendingUp}
                  title={t("aiaic.today.card.price")}
                  tip={t("aiaic.today.card.price_tip")}
                  note={t("aiaic.today.card.price_note")}
                  testid="today-task-price"
                />
              </Link>
            )}
          </li>
          <li>
            <Link to="/storage" data-testid="today-task-store" className={TASK} style={TASK_SIZE}>
              <TaskInner
                icon={Warehouse}
                title={t("aiaic.store.home")}
                tip={t("aiaic.store.home_tip")}
                note={t("aiaic.today.card.price_note")}
                testid="today-task-store"
              />
            </Link>
          </li>
          <li>
            <Link to="/payments" data-testid="today-task-money" className={TASK} style={TASK_SIZE}>
              <TaskInner
                icon={Wallet}
                title={t("aiaic.today.card.money")}
                tip={t("aiaic.today.card.money_tip")}
                testid="today-task-money"
              />
            </Link>
          </li>
          <li>
            <Link to="/help" data-testid="today-task-help" className={TASK} style={TASK_SIZE}>
              <TaskInner
                icon={LifeBuoy}
                title={t("aiaic.today.card.help")}
                tip={t("aiaic.today.card.help_tip")}
                testid="today-task-help"
              />
            </Link>
          </li>
        </ul>
      </section>

      {/* a person, always: AIAIC's team, AIAIC's own phone and e-mail, the Kisan Call Centre */}
      <section
        aria-labelledby="today-person-title"
        className="mt-7 rounded-3xl border-2 border-border bg-card p-4"
        data-testid="today-person"
      >
        <h2 id="today-person-title" className="font-extrabold text-foreground" style={H2}>
          {t("aiaic.today.person.title")}
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Link to="/help" data-testid="today-person-team" className={PERSON} style={PRESS_STYLE}>
            <LifeBuoy aria-hidden className="size-5 shrink-0 text-primary" />
            {t("aiaic.today.person.team")}
          </Link>
          <Link
            to="/contact"
            data-testid="today-person-contact"
            className={PERSON}
            style={PRESS_STYLE}
          >
            <Mail aria-hidden className="size-5 shrink-0 text-primary" />
            {t("aiaic.today.person.contact")}
          </Link>
          <a
            href="tel:18001801551"
            data-testid="today-person-kcc"
            className={PERSON}
            style={PRESS_STYLE}
          >
            <Phone aria-hidden className="size-5 shrink-0 text-primary" />
            {t("detail.next.call")}
          </a>
        </div>
      </section>
    </div>
  );
}
