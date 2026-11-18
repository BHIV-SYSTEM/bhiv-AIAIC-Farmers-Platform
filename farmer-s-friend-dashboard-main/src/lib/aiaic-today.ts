/**
 * HER DAY IN ONE PLACE (the Crowe Group EOD task, 16 Nov 2026, work package 1: the guided farmer home, `/today`).
 *
 * What each of her lots and sales needs now, read ONLY from AIAIC's own answer to her (`GET /farmer/trade` through
 * `getMyTrade`, the read her Listings, Orders and Payments pages already share): nothing here is worked out that AIAIC
 * does not say. For a sale, FOUR SEPARATE STATES, never one blended word:
 *  - the ORDER: AIAIC's lane (`laneOf`); from an AIAIC that sends none, its own order state;
 *  - the BUYER'S PAYMENT: `paymentLine` (paid only on the payment provider's verified word), as her sale's own page says it;
 *    on a GROUP SALE while no link is made, what the group sale's own page says at its money step ("The buyer says it pays
 *    within 3 days of delivery."), never "agree the payment with the buyer before you hand over" (`paymentNow`, the
 *    re-check's RC2-ANN-2);
 *  - the DELIVERY: each step AIAIC recorded (testing and grading, storage, transport, the delivery), its status, and whether
 *    it is a practice step (`simulated`);
 *  - HER MONEY: AIAIC's own steps for her money (`from_aiaic.steps`, in her bank only on the provider's word); from an AIAIC
 *    that sends none, the money step of the sale's five-step bar (`saleSteps`). WHERE AIAIC HOLDS PEOPLE'S WORD OF A PAYMENT
 *    MADE OUTSIDE IT and its own steps say nothing more (its `money.say`: her word that she got it or that it has not come,
 *    the buyer's that he paid; or the payment recorded as made outside AIAIC, `money.route` direct), her money is said in
 *    AIAIC's OWN SENTENCE, word for word as her sale's own money card says it ("You told us you got ₹23,880 on 2026-11-13.
 *    AIAIC did not see this payment itself."), never "The buyer has not paid", and never as confirmed (`told`: the
 *    re-check's RC-ANN-3).
 * Then HER NEXT STEP in the order's own terms (`her_next_step`), WHOM THE SALE WAITS ON (the lane's `waiting_on`), and, ON A
 * SALE SHE SELLS ALONE, its progress as "step n of 5" on the five steps her sale's own page draws (`saleSteps`). A GROUP
 * SALE says none here: its own five steps are on its page (`groupView`: invited, her answer, the group's decision, the
 * collection, paid), and the steps of a sale sold alone would say another step and another number (RC-ANN-1). Nor does
 * a sale whose payment AIAIC recorded as made outside it (`money.route` direct): two of its five steps, the buyer's
 * payment and her money, are then outside what AIAIC sees, so "step n of 5" could only say one of them is still to come
 * (RC-ANN-3).
 *
 * The money's parts are said apart: the agreed amount (gross: the order's price times its quantity), AIAIC's commission and
 * the GST on it, EACH ON ITS OWN LINE WITH ITS RATE (from the payment link's own record, only where AIAIC set them), and her
 * amount: AIAIC's figure, an ESTIMATE until AIAIC says it reached her bank. Transport is no part of AIAIC's figures for a
 * sale (its trip cost is an estimate on the sale's own page). ON A SALE CALLED OFF nothing is due to her (its payment goes
 * back to the buyer, G-28): no amount "to you" and no deductions are said, only that none is due (the skeptic's SK-ANN-5).
 * People's word of a payment made outside AIAIC, held before the call-off, stays said in AIAIC's own sentence beside it, as
 * her sale's own money card says it, never "No money moves on this sale" (the re-check's RC2-ANN-1).
 *
 * A SALE IS FINISHED only when it was called off, or when its quantities were checked (AIAIC's lane `reconciled`: a
 * reconciliation of the quantities delivered, accepted and rejected, "never a payment or a settlement", engine
 * `trade/store.py`) AND her money reached her bank on the payment company's word. A reconciled sale whose money has not
 * reached her stays among the sales under way (SK-ANN-1).
 *
 * A SALE SHE STARTED HERE AND LEFT (`SELL_STARTED_KEY`): the crop and district she came with, the time she started and
 * her newest lot's time AS AIAIC SAID IT then (`seen`); and, once her sale's own form has her answers, those answers
 * (`answers`, the night run's A1: her state, district, taluka, crop, quantity, grade, her own price and the open step, each
 * one checked as the form checks it): her NON-PERSONAL CHOICES ONLY, never a name, a phone number, a password or a word she
 * typed that is not her answer. KEPT FOR HER ACCOUNT ONLY (`who`, a mark made from the username AIAIC holds, never the
 * username: `accountMark`, the night audit's AUD-ANN-F1): offered back, and her answers given back to her sale's form, to
 * that account alone, until AIAIC holds a lot of ANY crop listed after that (read on AIAIC's own clock: SK-ANN-11), for at
 * most `SELL_STARTED_DAYS` days; forgotten when she says "Not now", once her lot is listed, when she signs out or erases
 * her account, and when another account signs in on the phone.
 */
import {
  asksHerWord,
  evidenceKindOf,
  groupView,
  holdsShown,
  offerViews,
  paymentLine,
  saleSteps,
  type AiaicListing,
  type AiaicMine,
  type AiaicOffer,
  type AiaicOrder,
  type AiaicSay,
  type FromAiaic,
  type Holds,
  type LaneCode,
  type SaleStep,
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

export type MoneyState =
  "reached" | "sent" | "held" | "buyer_paid" | "told" | "not_paid" | "stopped";
/** AIAIC's sentences of people's word of a payment made outside it (engine `trade/payout_store.py` `money_for_her`: her
 *  word that she got it, that it has not come, the buyer's that he paid, or its question where nobody said), each worded
 *  by her app's `aiaic.farmer.money.direct.*`; an `_any` sentence is the same one
 *  without a fact AIAIC did not send. A key outside this list is never said here (no raw key on her page). */
export const TOLD_SAYS = [
  "farmer.money.direct.said_got",
  "farmer.money.direct.said_got_any",
  "farmer.money.direct.said_not_yet",
  "farmer.money.direct.buyer_says",
  "farmer.money.direct.buyer_says_any",
  "farmer.money.direct.ask",
] as const;
/** AIAIC's own sentence for her money where the state is `told`. */
export type ToldSay = NonNullable<AiaicSay>;
/** One deduction as the payment link's own record holds it: its amount and its rate (null where AIAIC sends no rate). */
export type Fee = { amount: number; pct: number | null };
export type MoneyNow = {
  state: MoneyState;
  /** the agreed amount: the order's price times its quantity (gross) */
  gross: number;
  /** AIAIC's commission with its rate, from the payment link's own record; null where AIAIC set none, or none is due */
  commission: Fee | null;
  /** the GST on that commission with its rate, from the same record; null where AIAIC set none, or none is due */
  gst: Fee | null;
  /** her amount by AIAIC's figure; null where AIAIC sends none, or none is due */
  toHer: number | null;
  /** her amount reached her bank, on the payment provider's word (never on people's word: `told` is never confirmed) */
  confirmed: boolean;
  /** a sale called off whose money never reached her: nothing is due to her on it (SK-ANN-5) */
  noneDue: boolean;
  /** what AIAIC holds for her and why it waits (its closed reasons), only as AIAIC says it */
  holds: Holds | null;
  /** state `told`: AIAIC's own sentence of people's word of a payment made outside it, said word for word as her sale's
   *  own money card says it (`toldOf`, RC-ANN-3); null in every other state */
  told: ToldSay | null;
};
/** Where her sale is on the five steps her sale's own page draws (`saleSteps`): "step n of m", the step in progress
 *  (never said as reached: "Step 2 of 5: the buyer's payment"), or every step done. Only on a sale she sells alone whose
 *  payment AIAIC can see (`progressOf`). */
export type Progress = {
  n: number;
  of: number;
  key: SaleStep["key"];
  allDone: boolean;
  /** the buyer's payment UNDER WAY (its step "now": a link sent, not paid) beside the step AIAIC names as hers (the night
   *  run's A2): said with it; never a payment merely to come, with no link made (the night audit's AUD-ANN-F2) */
  beside?: { n: number; key: SaleStep["key"] } | null;
};
/** The buyer's payment as her page says it (`paymentNow`): a key of her app's words and the values it fills in (said as
 *  the group sale's page says its steps, `groupSaid`), and the payment's own state (its status code). */
export type PaymentNow = { key: string; values: Record<string, string | number>; state: string };

export type SaleNow = {
  kind: "sale";
  id: string;
  order: AiaicOrder;
  lane: LaneCode;
  /** true when the lane is AIAIC's own; false when it was read from AIAIC's order state (an AIAIC that sends no lane) */
  laneFromAiaic: boolean;
  /** since when the lane holds its word, as AIAIC records it (its `since`); null when AIAIC sends none */
  since: string | null;
  /** "step n of 5"; null on a sale whose steps stopped (called off, or the buyer's link expired), on a group sale (its own
   *  steps are on its page, RC-ANN-1), and on a sale whose payment AIAIC recorded as made outside it (RC-ANN-3) */
  progress: Progress | null;
  /** the buyer's payment as her sale's own page says it (`paymentNow`) */
  payment: PaymentNow;
  delivery: DeliveryStep[];
  money: MoneyNow;
  next: NextStep | null;
  waitingOn: WaitingOn | null;
  needsHer: boolean;
  practice: boolean;
  /** FINISHED: called off, or its quantities checked AND her money in her bank (see the file's head); nothing more to come */
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

/** One deduction from the payment link's own record, with its rate; null where AIAIC set none. */
function feeOf(amount: number | null | undefined, pct: number | null | undefined): Fee | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  return { amount, pct: typeof pct === "number" && Number.isFinite(pct) ? pct : null };
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

/** Whether AIAIC recorded the sale's payment as made outside it (`money.route` direct). AIAIC sets that route only on her
 *  word, or its team's for her, that she got the money (engine `trade/payout_store.py` `claim_report`). */
export function paidOutside(order: AiaicOrder): boolean {
  return order.money?.route === "direct";
}

/**
 * PEOPLE'S WORD OF A PAYMENT MADE OUTSIDE AIAIC, AS AIAIC SAYS IT (RC-ANN-3): its own sentence for her money where it is one
 * of `TOLD_SAYS` (the sentence her sale's own money card says, `moneyCard`); on a sale whose payment AIAIC recorded as made
 * outside it with no such sentence (an AIAIC that sends none), AIAIC's own sentence for that case, its question "Did the
 * buyer pay you?" (`money_for_her`: `key or "farmer.money.direct.ask"`), which her sale's own page then asks with her two
 * answers; else null. Never "The buyer has not paid" on a payment AIAIC did not see.
 */
export function toldOf(order: AiaicOrder): ToldSay | null {
  const say = order.money?.say ?? null;
  if (say && (TOLD_SAYS as readonly string[]).includes(say.key)) return say;
  // where AIAIC asks her word (`money.can_report`, once her produce is handed over or on a payment made outside it:
  // `asksHerWord`, the rule her sale's money card asks by), her home asks it too, never "The buyer has not paid"
  // (the night run's A3, ANN-8e-2)
  return paidOutside(order) || asksHerWord(order)
    ? { key: "farmer.money.direct.ask", values: {} }
    : null;
}

/** Her money on one sale, only as AIAIC says it (see the file's head). People's word of a payment made outside AIAIC
 *  (`told`) is said only where AIAIC's own facts say nothing more of her money: never before "reached", "sent", "held"
 *  or the provider's "the buyer paid", and always in place of "The buyer has not paid" (RC-ANN-3). ON A SALE CALLED OFF
 *  it is said in place of "No money moves on this sale": her sale's own money card says it whatever the order's state
 *  (`moneyCard`), and AIAIC keeps the word on the call-off (`money_for_her`); nothing is due to her there all the same
 *  (`noneDue`: no amount to her, no deductions). "No money moves" stays only where nobody's word is held (RC2-ANN-1). */
export function moneyNow(order: AiaicOrder): MoneyNow {
  const calledOff = order.order_state === "cancelled";
  const fa = (order as { from_aiaic?: FromAiaic | null }).from_aiaic ?? null;
  const holds = holdsShown(fa, calledOff);
  const told = toldOf(order);
  // a sale called off: people's word where AIAIC holds it, else no money moves (RC2-ANN-1)
  const off: MoneyState = told ? "told" : "stopped";
  let state: MoneyState;
  let confirmed: boolean;
  if (fa) {
    const said = fa.steps ?? { buyer_paid: fa.buyer_paid, sent: false, reached: false };
    state = said.reached
      ? "reached"
      : calledOff
        ? off
        : said.sent
          ? "sent"
          : holds
            ? "held"
            : said.buyer_paid
              ? "buyer_paid"
              : told
                ? "told"
                : "not_paid";
    confirmed = said.reached;
  } else {
    const step = saleSteps(order).find((s) => s.key === "money")?.state ?? "todo";
    state =
      step === "done"
        ? "reached"
        : step === "stopped"
          ? calledOff
            ? off
            : "stopped"
          : order.payment_state === "paid"
            ? "buyer_paid"
            : told
              ? "told"
              : "not_paid";
    confirmed = step === "done";
  }
  // A SALE CALLED OFF: nothing is due to her (its payment goes back to the buyer, G-28), whatever the payment link's record
  // once said: no amount "to you" and no deductions from it (SK-ANN-5); said beside people's word where AIAIC holds it
  // (RC2-ANN-1), which is never confirmed
  const noneDue = calledOff && !confirmed;
  return {
    state,
    confirmed,
    gross: order.amount_inr,
    commission: fa && !noneDue ? feeOf(fa.commission_inr, fa.commission_percent) : null,
    gst: fa && !noneDue ? feeOf(fa.gst_inr, fa.gst_percent) : null,
    toHer: noneDue ? null : (fa?.to_her_inr ?? null),
    noneDue,
    holds,
    told: state === "told" ? told : null,
  };
}

/** Her sale's five steps' step that AIAIC's `her_next_step` names (AIAIC's delivery chain, never the money: engine
 *  `trade/store.py`): a handover, in the terms agreed, is the handover step; the delivery, the delivery step; anything
 *  else (the quantities checked, none) names none of the five. */
function stepOfNext(next: NextStep | null): SaleStep["key"] | null {
  if (next === "delivered") return "delivered";
  if (
    next === "buyer_collects" ||
    next === "farmer_delivers" ||
    next === "collection_point" ||
    next === "as_written"
  )
    return "handover";
  return null;
}

/** "Step n of 5" on her sale's five steps (`saleSteps`): THE STEP AIAIC NAMES AS HERS (its `her_next_step`, the "Next"
 *  beside it on her card) when it is one of the five and not done, so the line and "Next" never point two ways (the
 *  night run's A2, TRACE's T1-07 and T2-ANN-03: "Step 2 of 5: the buyer's payment" beside "Next: the delivery to the
 *  buyer."); and where the buyer's payment is under way beside it (its step "now", a link sent and not paid, as her sale's
 *  bar says it: AIAIC's payment is a state of its own, never a step of its delivery chain), the payment is said with it as
 *  running at the same time (`beside`); a payment merely to come (no link made) is never said so (AUD-ANN-F2). Where AIAIC names none,
 *  the first step not done is the one she is at (all done: the last). None on a sale whose steps stopped (called off, or the buyer's link expired or cancelled). NONE ON A GROUP SALE:
 *  its own five steps are on its page (`groupView`), and these would say another step there, the stale handover among
 *  them (RC-ANN-1). NONE ON A SALE WHOSE PAYMENT AIAIC RECORDED AS MADE OUTSIDE IT: its buyer's payment and her money are
 *  then never done on AIAIC's word, so the line could only say one of them is still to come (RC-ANN-3). */
export function progressOf(order: AiaicOrder): Progress | null {
  if (order.pool || order.pool_id || paidOutside(order)) return null;
  const steps = saleSteps(order);
  if (steps.some((s) => s.state === "stopped")) return null;
  const named = stepOfNext(nextStepOf(order));
  const ni = named ? steps.findIndex((s) => s.key === named && s.state !== "done") : -1;
  const at = ni >= 0 ? ni : steps.findIndex((s) => s.state !== "done");
  const i = at < 0 ? steps.length - 1 : at;
  const step = steps[i];
  if (!step) return null;
  const pay = steps.findIndex((s) => s.key === "paid");
  // the payment said beside her step ONLY WHILE IT IS UNDER WAY (its step "now": the buyer's link sent and not paid, as
  // her sale's bar says it, `stepsTogether`); a payment merely to come (no link made: "No payment link yet", "No payment
  // yet") runs beside nothing (the night audit's AUD-ANN-F2)
  const beside =
    ni >= 0 && pay >= 0 && pay < i && steps[pay]?.state === "now"
      ? { n: pay + 1, key: "paid" as const }
      : null;
  return { n: i + 1, of: steps.length, key: step.key, allDone: at < 0, beside };
}

/**
 * THE BUYER'S PAYMENT, AS HER SALE'S OWN PAGE SAYS IT (`paymentLine`, its `PaymentCard`), except ON A GROUP SALE WHILE NO
 * LINK IS MADE (RC2-ANN-2). There the no-link line, "agree the payment with the buyer before you hand over", is false once
 * the group's lot is collected (AIAIC's "handed over" counts only a pickup, the road or the delivery: AUD-3), and the group
 * sale's own page draws no payment card until a link is made (`AiaicOrderDetail`, since 30 Oct 2026). Her page then says
 * what that page says at its money step while the buyer's payment is awaited (`groupView`'s paid step, with the group's
 * facts: "The buyer says it pays within 3 days of delivery."); else (no group facts sent, or that step not awaited) the
 * payment's line with the no-link line said as the payment's own state ("No payment yet"). Never "before you hand over"
 * on a group sale; every sale she sells alone, and every sale with a link, keeps its page's line.
 */
export function paymentNow(order: AiaicOrder): PaymentNow {
  const line = paymentLine(order);
  const said: PaymentNow = { key: line.key, values: {}, state: line.state };
  if (order.payment.link_made || !(order.pool || order.pool_id)) return said;
  // the group's money step as its page draws it (an order is there, so the offer changes none of that step)
  const paid = order.pool
    ? groupView(order.pool, null, order).steps.find((s) => s.key === "paid")
    : undefined;
  if (paid?.state === "todo" && paid.say)
    return { key: paid.say.key, values: paid.say.values, state: line.state };
  return line.key === NO_LINK ? { ...said, key: `aiaic.pay.state.${order.payment.state}` } : said;
}
/** The payment line that tells her to agree the payment with the buyer before she hands over (`paymentLine`, WF-05). */
const NO_LINK = "aiaic.pay.no_link";

/** Her next step as AIAIC names it, on an order neither called off nor part of a group sale (whose own page says the
 *  step she is at: AIAIC's `her_next_step` still names the handover after a group's lot was collected, AUD-3). */
export function nextStepOf(order: AiaicOrder): NextStep | null {
  if (order.order_state === "cancelled" || order.pool || order.pool_id) return null;
  const n = order.her_next_step ?? null;
  return n && (NEXT_STEPS as readonly string[]).includes(n) ? (n as NextStep) : null;
}

/**
 * One sale as her page says it. A GROUP SALE'S ORDER (`pool`) names neither her next step nor whom it waits on here, nor
 * a "step n of 5" of a sale sold alone (`progressOf`, RC-ANN-1): AIAIC's `her_next_step` still names the handover after
 * her lot was collected (AUD-3), and so does its lane's `waiting_on` (AIAIC's recorded group journey: the collection
 * recorded done, `waiting_on: farmer`); the sale's own page says the step she is at from the group's own steps
 * (`GroupPages`). Nor, while no link is made, the no-link payment line's "before you hand over" (`paymentNow`, RC2-ANN-2).
 */
export function saleNow(order: AiaicOrder): SaleNow {
  const lane = laneNow(order);
  const money = moneyNow(order);
  // FINISHED (see the file's head): a reconciled sale is finished only once her money reached her bank (SK-ANN-1)
  const closed = lane.code === "called_off" || (lane.code === "reconciled" && money.confirmed);
  const group = Boolean(order.pool || order.pool_id);
  const waitingOn = closed || group ? null : (order.lane?.waiting_on ?? null);
  return {
    kind: "sale",
    id: order.order_id,
    order,
    lane: lane.code,
    laneFromAiaic: lane.fromAiaic,
    since: order.lane?.since ?? null,
    progress: progressOf(order),
    payment: paymentNow(order),
    delivery: deliverySteps(order),
    money,
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
 * then her sales under way (a reconciled sale whose money has not reached her among them); then her lots listed with no
 * offer; then sales finished (called off, or quantities checked and her money in her bank). Newest first within each.
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

/**
 * THE ACCOUNT A KEPT SALE BELONGS TO (the night audit's AUD-ANN-F1: on a phone two people share, a sale kept under one
 * fixed key was offered to the next person who signed in, her answers with it, and outlived her sign-out and her
 * account's erasure): a mark made from the username AIAIC holds for the account signed in (`useMe`), a one-way digest of
 * it, never the username itself (a typed personal field is never kept on the phone past its tab). A sale is kept only
 * with this mark, and offered back and given back only to the account whose mark it carries (`readSellStart`); null with
 * nobody signed in, so nothing is kept for a guest and nothing kept is offered to one. A mark for matching, not a secret:
 * anyone holding the phone holds what it keeps.
 */
export function accountMark(username: string | null | undefined): string | null {
  const u = typeof username === "string" ? username.trim() : "";
  if (!u) return null;
  // two 32-bit FNV-1a lanes over the name's UTF-16 units, each mixed at its end (murmur3's fmix32): 64 bits as hex
  let a = 0x811c9dc5;
  let b = 0x9747b28c;
  for (let i = 0; i < u.length; i++) {
    const c = u.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  const mix = (x: number) => {
    let h = x;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  return `${mix(a)}${mix(b)}`;
}
/** Where AIAIC's answer was not on the page at her press, "since" is read on the phone's clock less this much: a phone
 *  whose clock runs ahead would otherwise keep offering a sale she already listed (SK-ANN-11). */
export const CLOCK_SLACK_MS = 24 * 3_600_000;
/** `seen`: her newest lot's `created_at` in AIAIC's answer at her press (AIAIC's own clock), "" when AIAIC held none, null
 *  when AIAIC's answer was not on the page. */
export type SellStarted = {
  /** the account it belongs to (`accountMark`): offered back and given back to that account only (AUD-ANN-F1) */
  who: string;
  crop: string | null;
  district: string | null;
  at: string;
  seen: string | null;
  /** Her answers in her sale's own form (absent until the form has one). */
  answers?: SellAnswers | null;
};
/** The steps of her sale's form, by the names its address uses (`AiaicSellForm`'s `SELL_STEPS`). */
export const SELL_STEP_NAMES = ["where", "crop", "quantity", "grade", "price", "check"] as const;
/** Her answers in her sale's form, as kept on her phone: her choices only, each as the form takes it (null: not given). */
export type SellAnswers = {
  state: "mh" | "mp" | null;
  district: string | null;
  taluka: string | null;
  crop: string | null;
  /** quintals, above 0 and at most 100,000 (the form's own bounds) */
  quantity: number | null;
  grade: "none" | "A" | "B" | "C" | null;
  /** her own price, rupees a quintal, above 0 and at most 10,00,000 (the form's own bounds) */
  price: number | null;
  /** the step that was open */
  step: (typeof SELL_STEP_NAMES)[number] | null;
};
/** A crop or a district as her kept farm names it: letters, digits, spaces and ( ) _ - only, at most 60. */
const NAME_RE = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 ()_-]{0,59}$/u;
const GRADES = ["none", "A", "B", "C"] as const;
const within = (x: unknown, top: number): number | null =>
  typeof x === "number" && Number.isFinite(x) && x > 0 && x <= top ? x : null;
/** Her kept answers, read back field by field: anything else, or anything out of the form's bounds, is not given. */
export function answersOf(x: unknown): SellAnswers | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const r = x as Record<string, unknown>;
  const name = (v: unknown) => (typeof v === "string" && NAME_RE.test(v) ? v : null);
  const step = r["step"];
  const grade = r["grade"];
  return {
    state: r["state"] === "mh" || r["state"] === "mp" ? r["state"] : null,
    district: name(r["district"]),
    taluka: name(r["taluka"]),
    crop: name(r["crop"]),
    quantity: within(r["quantity"], 100_000),
    grade: GRADES.includes(grade as never) ? (grade as SellAnswers["grade"]) : null,
    price: within(r["price"], 1_000_000),
    step: SELL_STEP_NAMES.includes(step as never) ? (step as SellAnswers["step"]) : null,
  };
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Her newest lot's `created_at` as AIAIC said it ("" when AIAIC holds none): the mark a sale started here is read against. */
export function newestLotAt(mine: AiaicMine): string {
  let newest = "";
  let at = -Infinity;
  for (const l of mine.listings) {
    const t = Date.parse(l.created_at);
    if (Number.isFinite(t) && t > at) {
      at = t;
      newest = l.created_at;
    }
  }
  return newest;
}

/** A kept `seen`: AIAIC's time of her newest lot, "" for none, else null (nothing from AIAIC was on the page). */
function seenOf(x: unknown): string | null {
  return x === "" || (typeof x === "string" && Number.isFinite(Date.parse(x))) ? x : null;
}

/** Keeps that she started a sale here, for the account signed in (`who`, its `accountMark`; with none, nothing is kept):
 *  the crop and district she came with (or none), when, and her newest lot then as AIAIC said it (`seen`, from AIAIC's
 *  answer on the page; null when there was none). */
export function keepSellStart(
  who: string | null,
  crop: string | null | undefined,
  district: string | null | undefined,
  seen: string | null = null,
  now: number = Date.now(),
): void {
  if (!who) return;
  const kept: SellStarted = {
    who,
    crop: crop && NAME_RE.test(crop) ? crop : null,
    district: district && NAME_RE.test(district) ? district : null,
    at: new Date(now).toISOString(),
    seen: seenOf(seen),
  };
  try {
    storage()?.setItem(SELL_STARTED_KEY, JSON.stringify(kept));
  } catch {
    /* a phone that keeps nothing offers nothing back */
  }
}

/** Keeps her answers in her sale's form beside her start (A1), for the account signed in (`who`; with none, nothing is
 *  kept): the start's own time and mark when one is kept for that account, else a new start now, with her newest lot as
 *  AIAIC said it on the form's page (`seen`). Her crop and district, once given, are the ones her home names. Only
 *  `answersOf`'s fields are written: nothing else she typed. */
export function keepSellAnswers(
  who: string | null,
  answers: SellAnswers,
  seen: string | null = null,
  now: number = Date.now(),
): void {
  if (!who) return;
  const before = readSellStart(who, now);
  const clean = answersOf(answers);
  if (!clean) return;
  const kept: SellStarted = {
    who,
    crop: clean.crop ?? before?.crop ?? null,
    district: clean.district ?? before?.district ?? null,
    at: before?.at ?? new Date(now).toISOString(),
    seen: before && before.seen !== null ? before.seen : seenOf(seen),
    answers: clean,
  };
  try {
    storage()?.setItem(SELL_STARTED_KEY, JSON.stringify(kept));
  } catch {
    /* a phone that keeps nothing offers nothing back */
  }
}

/** Forgets the sale she started here: once her lot is listed, on "Not now", and when she signs out or erases her account
 *  (AUD-ANN-F1). */
export function forgetSellStart(): void {
  try {
    storage()?.removeItem(SELL_STARTED_KEY);
  } catch {
    /* nothing kept */
  }
}

/** At a sign-in (AUD-ANN-F1): a sale kept for ANOTHER account, or for none, is forgotten before anything is read for the
 *  account now signed in (`who`, the mark of the username she signed in with); hers, kept before her session ended, stays
 *  (a username AIAIC holds otherwise written forgets it: erring this way only loses what was kept). */
export function forgetOthersSellStart(who: string | null): void {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(SELL_STARTED_KEY) ?? null;
  } catch {
    return;
  }
  if (!raw) return;
  let mark: unknown = null;
  try {
    const v: unknown = JSON.parse(raw);
    mark = v && typeof v === "object" ? (v as Record<string, unknown>)["who"] : null;
  } catch {
    /* unreadable: forgotten below */
  }
  if (!who || mark !== who) forgetSellStart();
}

/** The sale she started here, FOR THE ACCOUNT SIGNED IN (`who`, its `accountMark`), while it is at most
 *  `SELL_STARTED_DAYS` old; null when none. With nobody signed in (or not known yet: `who` null) nothing is read and
 *  nothing forgotten. A sale kept for ANOTHER account, or for none (kept before the mark), is never offered or given
 *  back: it is forgotten (AUD-ANN-F1), as an older one is. */
export function readSellStart(who: string | null, now: number = Date.now()): SellStarted | null {
  if (!who) return null;
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
  if (r["who"] !== who) {
    forgetSellStart();
    return null;
  }
  const at = typeof r["at"] === "string" ? Date.parse(r["at"]) : NaN;
  if (!Number.isFinite(at) || at > now || now - at > SELL_STARTED_DAYS * 86_400_000) {
    forgetSellStart();
    return null;
  }
  const name = (x: unknown) => (typeof x === "string" && NAME_RE.test(x) ? x : null);
  const answers = answersOf(r["answers"]);
  return {
    who,
    crop: name(r["crop"]),
    district: name(r["district"]),
    at: new Date(at).toISOString(),
    seen: seenOf(r["seen"]),
    ...(answers ? { answers } : {}),
  };
}

/**
 * Whether the sale she started is still to be offered back: AIAIC holds no lot she listed since, OF ANY CROP (a lot of
 * another crop listed since ends it too). "Since" is read on AIAIC's own clock where AIAIC's answer was on the page at her
 * press (`seen`); else on the phone's, less `CLOCK_SLACK_MS` (SK-ANN-11). Erring this way only forgets an offer back; it
 * never invites her to list the same produce twice.
 */
export function sellStillOpen(kept: SellStarted, mine: AiaicMine): boolean {
  if (kept.seen !== null) {
    const seen = kept.seen === "" ? -Infinity : Date.parse(kept.seen);
    return !mine.listings.some((l) => Date.parse(l.created_at) > seen);
  }
  const since = Date.parse(kept.at) - CLOCK_SLACK_MS;
  return !mine.listings.some((l) => Date.parse(l.created_at) >= since);
}
