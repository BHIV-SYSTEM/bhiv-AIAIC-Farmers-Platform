/**
 * HER DAY IN ONE PLACE (the Crowe Group EOD task, 16 Nov 2026, work package 1: the guided farmer home, `/today`).
 *
 * What each of her lots and sales needs now, read ONLY from AIAIC's own answer to her (`GET /farmer/trade` through
 * `getMyTrade`, the read her Listings, Orders and Payments pages already share): nothing here is worked out that AIAIC
 * does not say. For a sale, FOUR SEPARATE STATES, never one blended word:
 *  - the ORDER: AIAIC's lane (`laneOf`); from an AIAIC that sends none, its own order state;
 *  - the BUYER'S PAYMENT: `paymentLine` (paid only on the payment provider's verified word);
 *  - the DELIVERY: each step AIAIC recorded (testing and grading, storage, transport, the delivery), its status, and whether
 *    it is a practice step (`simulated`);
 *  - HER MONEY: AIAIC's own steps for her money (`from_aiaic.steps`, in her bank only on the provider's word); from an AIAIC
 *    that sends none, the money step of the sale's five-step bar (`saleSteps`).
 * Then HER NEXT STEP in the order's own terms (`her_next_step`), and WHOM THE SALE WAITS ON (the lane's `waiting_on`).
 *
 * The money's parts are said apart: the agreed amount (gross: the order's price times its quantity), AIAIC's commission and
 * the GST on it (from the payment link's own record, only where AIAIC set them), and her amount: AIAIC's figure, an
 * ESTIMATE until AIAIC says it reached her bank. Transport is no part of AIAIC's figures for a sale (its trip cost is an
 * estimate on the sale's own page).
 *
 * A SALE SHE STARTED HERE AND LEFT (`SELL_STARTED_KEY`): only the crop and district she came with and the time she started,
 * never a price, a quantity or a typed word; offered back until AIAIC holds a lot she listed after that time, for at most
 * `SELL_STARTED_DAYS` days, and forgotten when she says "Not now".
 */
import {
  evidenceKindOf,
  holdsShown,
  offerViews,
  paymentLine,
  saleSteps,
  type AiaicListing,
  type AiaicMine,
  type AiaicOffer,
  type AiaicOrder,
  type FromAiaic,
  type Holds,
  type LaneCode,
  type WaitingOn,
} from "./aiaic-trade";

/** The handovers AIAIC names as her next step (its `her_next_step`), each worded by her app's `aiaic.sale.next.*`. */
export const NEXT_STEPS = [
  "buyer_collects",
  "farmer_delivers",
  "collection_point",
  "as_written",
  "delivered",
  "reconciliation",
] as const;
export type NextStep = (typeof NEXT_STEPS)[number];

/** The steps AIAIC records on an order (its `trade.store.STAGES`), each worded by `aiaic.today.stage.*`. */
export const STAGES = [
  "aggregation",
  "quality_grading",
  "storage",
  "processing",
  "pickup",
  "in_transit",
  "delivered",
  "delivery_exception",
  "reconciliation",
] as const;
export type Stage = (typeof STAGES)[number];
/** A step's status as AIAIC records it (its table's check: done, pending, failed). */
export const STEP_STATUSES = ["done", "pending", "failed"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export type DeliveryStep = {
  stage: Stage | "other";
  status: StepStatus | "other";
  /** a practice step, recorded to rehearse (AIAIC's `simulated`) */
  simulated: boolean;
  /** how AIAIC knows it (its closed list), or null */
  evidence: string | null;
  at: string;
};

export type MoneyState = "reached" | "sent" | "held" | "buyer_paid" | "not_paid" | "stopped";
export type MoneyNow = {
  state: MoneyState;
  /** the agreed amount: the order's price times its quantity (gross) */
  gross: number;
  /** AIAIC's commission and the GST on it, from the payment link's own record; null where AIAIC set none */
  deductions: number | null;
  /** her amount by AIAIC's figure; null where AIAIC sends none */
  toHer: number | null;
  /** her amount reached her bank, on the payment provider's word */
  confirmed: boolean;
  /** what AIAIC holds for her and why it waits (its closed reasons), only as AIAIC says it */
  holds: Holds | null;
};

export type SaleNow = {
  kind: "sale";
  id: string;
  order: AiaicOrder;
  lane: LaneCode;
  /** true when the lane is AIAIC's own; false when it was read from AIAIC's order state (an AIAIC that sends no lane) */
  laneFromAiaic: boolean;
  payment: { key: string; state: string };
  delivery: DeliveryStep[];
  money: MoneyNow;
  next: NextStep | null;
  waitingOn: WaitingOn | null;
  needsHer: boolean;
  practice: boolean;
  /** called off or settled: nothing more to do on it */
  closed: boolean;
  /** part of a group sale: its own steps are on the sale's page (see `saleNow`) */
  group: boolean;
  at: string;
};
export type OfferNow = {
  kind: "offer";
  id: string;
  offer: AiaicOffer;
  listing: AiaicListing;
  /** the offer's total: AIAIC's amount, else its price times its quantity */
  total: number;
  needsHer: true;
  practice: boolean;
  at: string;
};
export type LotNow = {
  kind: "lot";
  id: string;
  listing: AiaicListing;
  needsHer: false;
  practice: boolean;
  at: string;
};
export type TodayItem = SaleNow | OfferNow | LotNow;

/** Rupees to the paisa, added in paise so no rupee is mis-rounded. */
function plus(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (Math.round((a ?? 0) * 100) + Math.round((b ?? 0) * 100)) / 100;
}

/** The order's state as AIAIC's lane, else (an AIAIC that sends no lane) its order state's nearest lane word. */
function laneNow(order: AiaicOrder): { code: LaneCode; fromAiaic: boolean } {
  if (order.lane) return { code: order.lane.code, fromAiaic: true };
  const code: LaneCode =
    order.order_state === "cancelled"
      ? "called_off"
      : order.order_state === "delivered"
        ? "delivered"
        : "agreed";
  return { code, fromAiaic: false };
}

/** Each step AIAIC recorded on the order, in AIAIC's order; a stage or status outside AIAIC's lists is "other". */
export function deliverySteps(order: AiaicOrder): DeliveryStep[] {
  return order.fulfilment.map((s) => ({
    stage: (STAGES as readonly string[]).includes(s.stage) ? (s.stage as Stage) : "other",
    status: (STEP_STATUSES as readonly string[]).includes(s.status)
      ? (s.status as StepStatus)
      : "other",
    simulated: s.simulated === true,
    evidence: evidenceKindOf(s.evidence_kind),
    at: s.created_at,
  }));
}

/** Her money on one sale, only as AIAIC says it (see the file's head). */
export function moneyNow(order: AiaicOrder): MoneyNow {
  const calledOff = order.order_state === "cancelled";
  const fa = (order as { from_aiaic?: FromAiaic | null }).from_aiaic ?? null;
  const holds = holdsShown(fa, calledOff);
  const base = {
    gross: order.amount_inr,
    deductions: fa ? plus(fa.commission_inr, fa.gst_inr) : null,
    toHer: fa?.to_her_inr ?? null,
    holds,
  };
  if (fa) {
    const said = fa.steps ?? { buyer_paid: fa.buyer_paid, sent: false, reached: false };
    const state: MoneyState = said.reached
      ? "reached"
      : calledOff
        ? "stopped"
        : said.sent
          ? "sent"
          : holds
            ? "held"
            : said.buyer_paid
              ? "buyer_paid"
              : "not_paid";
    return { ...base, state, confirmed: said.reached };
  }
  const step = saleSteps(order).find((s) => s.key === "money")?.state ?? "todo";
  const state: MoneyState =
    step === "done"
      ? "reached"
      : step === "stopped"
        ? "stopped"
        : order.payment_state === "paid"
          ? "buyer_paid"
          : "not_paid";
  return { ...base, state, confirmed: step === "done" };
}

/** Her next step as AIAIC names it, on an order neither called off nor part of a group sale (whose own page says the
 *  step she is at: AIAIC's `her_next_step` still names the handover after a group's lot was collected, AUD-3). */
export function nextStepOf(order: AiaicOrder): NextStep | null {
  if (order.order_state === "cancelled" || order.pool || order.pool_id) return null;
  const n = order.her_next_step ?? null;
  return n && (NEXT_STEPS as readonly string[]).includes(n) ? (n as NextStep) : null;
}

/**
 * One sale as her page says it. A GROUP SALE'S ORDER (`pool`) names neither her next step nor whom it waits on here:
 * AIAIC's `her_next_step` still names the handover after her lot was collected (AUD-3), and so does its lane's
 * `waiting_on` (AIAIC's recorded group journey: the collection recorded done, `waiting_on: farmer`); the sale's own page
 * says the step she is at from the group's own steps (`GroupPages`).
 */
export function saleNow(order: AiaicOrder): SaleNow {
  const lane = laneNow(order);
  const closed = lane.code === "called_off" || lane.code === "reconciled";
  const group = Boolean(order.pool || order.pool_id);
  const waitingOn = closed || group ? null : (order.lane?.waiting_on ?? null);
  const pay = paymentLine(order);
  return {
    kind: "sale",
    id: order.order_id,
    order,
    lane: lane.code,
    laneFromAiaic: lane.fromAiaic,
    payment: { key: pay.key, state: pay.state },
    delivery: deliverySteps(order),
    money: moneyNow(order),
    next: nextStepOf(order),
    waitingOn,
    needsHer: waitingOn === "farmer",
    practice: order.synthetic === true,
    closed,
    group,
    at: order.updated_at ?? order.created_at,
  };
}

/**
 * EVERYTHING OF HERS THAT STANDS NOW, the most pressing first: offers waiting for her answer and sales waiting on her;
 * then her sales under way; then her lots listed with no offer; then sales called off or settled. Newest first within each.
 */
export function todayItems(mine: AiaicMine): TodayItem[] {
  const offers: OfferNow[] = offerViews(mine)
    .filter((v) => v.chip === "open" && v.canAnswer)
    .map((v) => ({
      kind: "offer" as const,
      id: v.offer.offer_id,
      offer: v.offer,
      listing: v.listing,
      total: v.offer.amount_inr ?? Math.round(v.offer.price_per_q * 100 * v.offer.quantity_q) / 100,
      needsHer: true as const,
      practice: v.offer.synthetic === true || v.listing.synthetic === true,
      at: v.offer.created_at,
    }));
  const answering = new Set(offers.map((o) => o.listing.listing_id));
  const lots: LotNow[] = mine.listings
    .filter((l) => l.status === "open" && l.quantity_left_q > 0 && !answering.has(l.listing_id))
    .map((l) => ({
      kind: "lot" as const,
      id: l.listing_id,
      listing: l,
      needsHer: false as const,
      practice: l.synthetic === true,
      at: l.updated_at ?? l.created_at,
    }));
  const sales = mine.orders.map(saleNow);
  const rank = (x: TodayItem) => (x.needsHer ? 0 : x.kind === "sale" ? (x.closed ? 3 : 1) : 2);
  return [...offers, ...sales, ...lots].sort(
    (a, b) => rank(a) - rank(b) || b.at.localeCompare(a.at),
  );
}

// ------------------------------------------------------------------------ a sale she started here and left

export const SELL_STARTED_KEY = "aiaic.today.sell_started";
export const SELL_STARTED_DAYS = 7;
export type SellStarted = { crop: string | null; district: string | null; at: string };
/** A crop or a district as her kept farm names it: letters, digits, spaces and ( ) _ - only, at most 60. */
const NAME_RE = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 ()_-]{0,59}$/u;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Keeps that she started a sale here: the crop and district she came with (or none), and when. */
export function keepSellStart(
  crop: string | null | undefined,
  district: string | null | undefined,
  now: number = Date.now(),
): void {
  const kept: SellStarted = {
    crop: crop && NAME_RE.test(crop) ? crop : null,
    district: district && NAME_RE.test(district) ? district : null,
    at: new Date(now).toISOString(),
  };
  try {
    storage()?.setItem(SELL_STARTED_KEY, JSON.stringify(kept));
  } catch {
    /* a phone that keeps nothing offers nothing back */
  }
}

export function forgetSellStart(): void {
  try {
    storage()?.removeItem(SELL_STARTED_KEY);
  } catch {
    /* nothing kept */
  }
}

/** The sale she started here, while it is at most `SELL_STARTED_DAYS` old; null when none (an older one is forgotten). */
export function readSellStart(now: number = Date.now()): SellStarted | null {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(SELL_STARTED_KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    forgetSellStart();
    return null;
  }
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const at = typeof r["at"] === "string" ? Date.parse(r["at"]) : NaN;
  if (!Number.isFinite(at) || at > now || now - at > SELL_STARTED_DAYS * 86_400_000) {
    forgetSellStart();
    return null;
  }
  const name = (x: unknown) => (typeof x === "string" && NAME_RE.test(x) ? x : null);
  return { crop: name(r["crop"]), district: name(r["district"]), at: new Date(at).toISOString() };
}

/** Whether the sale she started is still to be offered back: AIAIC holds no lot she listed since (of that crop, when the
 *  crop is known). */
export function sellStillOpen(kept: SellStarted, mine: AiaicMine): boolean {
  const since = Date.parse(kept.at);
  const crop = kept.crop?.toLowerCase() ?? null;
  return !mine.listings.some(
    (l) => Date.parse(l.created_at) >= since && (crop === null || l.crop.toLowerCase() === crop),
  );
}
