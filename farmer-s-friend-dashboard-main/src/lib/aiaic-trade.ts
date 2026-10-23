/**
 * AIAIC's farmer sale, payment and transport answers, as this app reads them, and the pure functions that turn
 * them into what the screens show.
 *
 * The answers are AIAIC's own (its backend contract, sections 17b, 17c, 17d and 19): GET /farmer/trade (her
 * listings with their offers, her orders with their payment and money, her payout account), GET /transport/estimate
 * and GET /transport/nearby-mandis. Only the fields this app reads are typed here; nothing in this file calls the
 * network, so the browser and the server share it, and the tests read it with recorded answers.
 */

// ------------------------------------------------------------------------------------------------ the answers

/** A JSON value (what a server function may send to the browser). */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type WhyNot = { code: string; why: string } | null;

export type ReferencePrice = {
  held: boolean;
  crop?: string | undefined;
  district?: string | undefined;
  price_day?: string | null | undefined;
  age_days?: number | null | undefined;
  mandis_reporting?: number | null | undefined;
  middle_of_all_per_q?: number | null | undefined;
  lowest_per_q?: number | null | undefined;
  highest_per_q?: number | null | undefined;
  source_name?: string | null | undefined;
  suggested_ask_per_q?: number | null | undefined;
  reason?: string | null | undefined;
};

export type AiaicOffer = {
  offer_id: string;
  listing_id: string;
  price_per_q: number;
  quantity_q: number;
  amount_inr?: number | null | undefined;
  terms_code: string | null;
  delivery_terms?: string | null | undefined;
  valid_until: string | null;
  status: string;
  closed_reason?: string | null | undefined;
  synthetic: boolean;
  expired: boolean;
  can_accept: boolean;
  why_not_accept: WhyNot;
  buyer_type?: string | null | undefined;
  buyer_district?: string | null | undefined;
  buyer_name?: string | null | undefined;
  created_at: string;
};

export type AiaicListing = {
  listing_id: string;
  crop: string;
  variety?: string | null | undefined;
  grade?: string | null | undefined;
  quantity_q: number;
  quantity_left_q: number;
  ask_price_per_q: number | null;
  district: string;
  state: string;
  status: string;
  synthetic: boolean;
  created_at: string;
  updated_at?: string | undefined;
  reference_price?: ReferencePrice | null | undefined;
  offers: AiaicOffer[];
};

export type AiaicStep = {
  event_id?: string | undefined;
  stage: string;
  status: string;
  simulated?: boolean | undefined;
  created_at: string;
};

export type AiaicPayment = {
  state: string;
  link_made: boolean;
  not_onward?: string | null | undefined;
  refund_owed_inr?: number | null | undefined;
  refund_note?: string | null | undefined;
};

export type AiaicSay = { key: string; values: Record<string, Json> } | null;

export type AiaicMoney = {
  route: string;
  settlement_state: string | null;
  timing?: string | null | undefined;
  say: AiaicSay;
  can_report: boolean;
  why_not_report: WhyNot;
  share_inr?: number | null | undefined;
  destination_kind?: string | null | undefined;
  destination_hint?: string | null | undefined;
  fee_on_top?: boolean | undefined;
  fee_line_key?: string | undefined;
  state?: string | null | undefined;
  utr?: string | null | undefined;
  settled_at?: string | null | undefined;
  held_until?: string | null | undefined;
  test_mode?: boolean | null | undefined;
  reports?:
    | {
        report_id: string;
        said_by: string;
        what: string;
        amount_inr: number | null;
        created_at: string;
      }[]
    | undefined;
};

export type AiaicOrder = {
  order_id: string;
  offer_id: string;
  listing_id: string;
  crop: string;
  quantity_q: number;
  price_per_q: number;
  amount_inr: number;
  terms_code: string | null;
  delivery_terms?: string | null | undefined;
  order_state: string;
  cancel_reason_code?: string | null | undefined;
  payment_state: string;
  settlement_state?: string | null | undefined;
  synthetic: boolean;
  created_at: string;
  updated_at?: string | undefined;
  buyer_name?: string | null | undefined;
  buyer_type?: string | null | undefined;
  buyer_district?: string | null | undefined;
  fulfilment: AiaicStep[];
  next_steps?: string[] | undefined;
  her_next_step?: string | null | undefined;
  payment: AiaicPayment;
  money?: AiaicMoney | undefined;
};

export type PayoutAccountView = {
  payout_account_id: string;
  status: string;
  refused_code?: string | null | undefined;
  destination_kind: string;
  destination_hint?: string | null | undefined;
  ready: boolean;
  why_not_ready: (WhyNot & { until?: string | null | undefined }) | null;
  test_mode?: boolean | undefined;
  synthetic?: boolean | undefined;
};

export type PayoutAccountBlock = {
  offered: boolean;
  why_not_offered: WhyNot;
  test_mode: boolean | null;
  test_values_only: boolean;
  account: PayoutAccountView | null;
  say: AiaicSay;
  can_create: boolean;
  can_withdraw: boolean;
};

export type PayoutNotice = { version: string; en: string[]; mr: string[]; hi: string[] };

export type AiaicMine = {
  tenant_id: string;
  profile_place: { state: string | null; district: string | null };
  practice: boolean;
  practice_note: string | null;
  party: { party_id: string; synthetic: boolean; district: string; state: string } | null;
  listings: AiaicListing[];
  orders: AiaicOrder[];
  payout_account?: PayoutAccountBlock | undefined;
  payout_notice?: PayoutNotice | undefined;
};

/** What the server adds to her answer: the names of crops and districts in her language, from AIAIC's own lists. */
export type MineForScreen = {
  mine: AiaicMine;
  cropNames: Record<string, string>;
  districtNames: Record<string, string>;
};

// -------------------------------------------------------------------------------------- what the server says

/** Why something did not work, said as facts the screen words in her language (never a raw error text). */
export type AiaicProblem = {
  /** AIAIC's own reason code, or one of this app's (`aiaic_*`, below). */
  code: string;
  /** AIAIC's own sentence, kept for the review page; the screen words `code` instead. */
  message: string | null;
  status: number | null;
  /** The setting a problem of this app's names (a setting's NAME, never its value). */
  setting: string | null;
  /** AIAIC's facts beside a refusal (e.g. the price range of `price_far_from_market`). */
  facts: Record<string, Json> | null;
  /** AIAIC answered with its crisis card instead: the helplines lead, nothing else is shown. */
  crisis: AiaicCrisis | null;
};

export type AiaicCrisis = {
  answer: string | null;
  message: string | null;
  helplines: { name: string; phone: string }[];
};

export type AiaicResult<T> = { ok: true; data: T } | { ok: false; problem: AiaicProblem };

/**
 * Where this app's sales live. `local`: neither AIAIC farmer setting is set, so the app's own demo store
 * (data/transactions.json) is used, as before. `aiaic`: the settings are set, so every sale, offer, order,
 * payment and transport screen reads AIAIC; a problem (a setting missing, a sign-in refused) is SAID, and the
 * local store is never used in its place.
 */
export type TradeMode = { mode: "local" } | { mode: "aiaic"; problem: AiaicProblem | null };

/** This app's own problem codes (AIAIC's are its contract's). */
export const APP_PROBLEMS = [
  "aiaic_setting_missing",
  "aiaic_sign_in_needs_https",
  "aiaic_sign_in_refused",
  "aiaic_sign_in_locked",
  "aiaic_account_not_a_farmer",
  "aiaic_account_not_practice",
  "aiaic_unavailable",
  "aiaic_answer_unreadable",
] as const;

export function problem(
  code: string,
  extra: Partial<Omit<AiaicProblem, "code">> = {},
): AiaicProblem {
  return {
    code,
    message: extra.message ?? null,
    status: extra.status ?? null,
    setting: extra.setting ?? null,
    facts: extra.facts ?? null,
    crisis: extra.crisis ?? null,
  };
}

// ------------------------------------------------------------------------------------------------ one press

/** AIAIC's Idempotency-Key: 8 to 128 of A-Z a-z 0-9 . _ : - (contract section 17). */
export const PRESS_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * A new key for one press of a button: the same key goes again when the SAME press is sent again (a lost answer,
 * or her price confirmed after AIAIC asked it back), so a repeat never makes a second record. Built from
 * `crypto.getRandomValues`, which a page served over plain http has too (`crypto.randomUUID` it has not).
 */
export function newPressKey(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `ann-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// ------------------------------------------------------------------------------------------------ numbers

/** Rupees, Indian grouping, whole rupees unless paise are there: "₹79,600", "₹20,261.36". */
export function rupees(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

export function rupeeRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  if (typeof low === "number" && typeof high === "number" && low === high) return rupees(low);
  return `${rupees(low)} – ${rupees(high)}`;
}

export function quintals(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** A day as YYYY-MM-DD from an ISO time or a day (India's day for a time: the answers' times are UTC). */
export function dayOf(iso: string | null | undefined): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  // India is UTC+5:30 all year.
  return new Date(t + 330 * 60_000).toISOString().slice(0, 10);
}

/** The quantities her dropdown offers (quintals); "another" opens a number box. */
export const QUANTITY_CHOICES = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200] as const;

/** Annapoorna's grades and the grade AIAIC is sent (a trade grade the mandis do not print is set aside there). */
export const GRADE_TO_AIAIC: Record<string, string | null> = {
  GRADE_A: "A",
  GRADE_B: "B",
  GRADE_C: "C",
  UNVERIFIED: null,
};

// ------------------------------------------------------------------------------------------- her sale's steps

export type StepState = "done" | "now" | "todo" | "stopped";
export type SaleStep = {
  key: "agreed" | "paid" | "handover" | "delivered" | "money";
  state: StepState;
};

function stepDone(order: AiaicOrder, stages: string[]): boolean {
  return order.fulfilment.some((s) => stages.includes(s.stage) && s.status === "done");
}

/**
 * The five steps of one sale, the transaction in order: agreed -> paid by the buyer -> handed over -> delivered ->
 * her money. Each is read from AIAIC's own states, never assumed: "paid" only on Razorpay's verified word
 * (`payment_state`), her money only on Razorpay's word about her share (`settlement_state`), and "sent" is never
 * "received" (only `settled` is done).
 */
export function saleSteps(order: AiaicOrder): SaleStep[] {
  const cancelled = order.order_state === "cancelled";
  const pay = order.payment_state;
  const paid: StepState =
    pay === "paid"
      ? "done"
      : pay === "link_created" || pay === "partially_paid"
        ? cancelled
          ? "stopped"
          : "now"
        : pay === "link_expired" || pay === "link_cancelled"
          ? "stopped"
          : "todo";
  const handedOver = stepDone(order, ["pickup", "in_transit", "delivered"]);
  const delivered = order.order_state === "delivered" || stepDone(order, ["delivered"]);
  const handover: StepState = handedOver ? "done" : cancelled ? "stopped" : "now";
  const deliveredState: StepState = delivered
    ? "done"
    : cancelled
      ? "stopped"
      : handedOver
        ? "now"
        : "todo";
  const settlement = order.money?.settlement_state ?? order.settlement_state ?? "not_connected";
  const money: StepState =
    settlement === "settled"
      ? "done"
      : settlement === "failed" || settlement === "reversed" || settlement === "partially_reversed"
        ? "stopped"
        : settlement === "held" ||
            settlement === "transferred" ||
            settlement === "released" ||
            (settlement === "no_transfer_yet" && pay === "paid")
          ? "now"
          : cancelled
            ? "stopped"
            : "todo";
  return [
    { key: "agreed", state: "done" },
    { key: "paid", state: paid },
    { key: "handover", state: handover },
    { key: "delivered", state: deliveredState },
    { key: "money", state: money },
  ];
}

/** Whether her order's link carries her share to her (Razorpay Route): only then is "what reached you" AIAIC's to say. */
export function moneyGoesThroughAiaic(order: AiaicOrder): boolean {
  return order.money?.route === "razorpay_route";
}

/**
 * The payment line's key and values: a link that does not carry her share is said to reach AIAIC's payment account,
 * never hers (`payment.not_onward`, said only when a link was made and her share is not in it).
 */
export function paymentLine(order: AiaicOrder): { key: string; state: string; notOnward: boolean } {
  const notOnward = order.payment.link_made && !moneyGoesThroughAiaic(order);
  if (!order.payment.link_made)
    return { key: "aiaic.pay.no_link", state: order.payment.state, notOnward };
  return { key: `aiaic.pay.state.${order.payment.state}`, state: order.payment.state, notOnward };
}

// --------------------------------------------------------------------------------------- her money, in words

/** The key her money's sentence is worded from (AIAIC's own key, `farmer.money.*` or `farmer.payout.*`, under this
 * app's `aiaic.` prefix), and the values it fills in; null when AIAIC says nothing of her money on this order. */
export function sayKey(say: AiaicSay): { key: string; values: Record<string, string> } | null {
  if (!say || typeof say.key !== "string" || !say.key) return null;
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(say.values ?? {})) {
    if (v === null || v === undefined) continue;
    if (k === "amount" || k === "back" || k === "left") values[k] = rupees(Number(v));
    else if (k === "day" || k === "time") values[k] = dayOf(String(v));
    else values[k] = String(v);
  }
  return { key: `aiaic.${say.key}`, values };
}

/** The reason inside a money or payout sentence, as a key of its own (a code, never English text). */
export function reasonKey(prefix: "money" | "payout", code: string | undefined): string {
  return `aiaic.farmer.${prefix}.reason.${code && /^[a-z_]+$/.test(code) ? code : "other"}`;
}

// ------------------------------------------------------------------------------------------------ names

/** A crop's name in her language (AIAIC's list), else the crop as AIAIC names it. */
export function cropName(names: Record<string, string>, crop: string): string {
  return names[crop] ?? crop.charAt(0).toUpperCase() + crop.slice(1);
}

/** A district's name in her language (AIAIC's list), else as AIAIC names it. */
export function districtName(names: Record<string, string>, district: string | null | undefined) {
  if (!district) return "";
  return names[district] ?? names[district.toLowerCase()] ?? district;
}

type Words = (key: string, vars?: Record<string, string | number>) => string;

/** "1 quintal" or "{n} quintals", in her language. */
export function quintalWords(t: Words, n: number): string {
  return n === 1 ? t("aiaic.sell.quintals.one") : t("aiaic.sell.quintals", { n: quintals(n) });
}

/** "Buyer: <name> · A wholesaler from Pune": a buyer of the kind `consumer` is a person and is never named (AIAIC
 * sends no name for one). */
export function buyerLine(
  t: Words,
  names: Record<string, string>,
  kind: string | null | undefined,
  district: string | null | undefined,
  name: string | null | undefined,
): string {
  const kindWord = t(`aiaic.buyer.${kind ?? "consumer"}`);
  const from = t("aiaic.offer.from", { kind: kindWord, district: districtName(names, district) });
  return name ? `${t("aiaic.buyer.named", { name })} · ${from}` : from;
}

// ------------------------------------------------------------------------------------------- an offer's view

export type OfferView = {
  offer: AiaicOffer;
  listing: AiaicListing;
  /** The press she can make now: accept only when AIAIC says it can be accepted (its own rule). */
  canAnswer: boolean;
  chip: "open" | "expired" | "accepted" | "rejected" | "withdrawn";
};

export function offerViews(mine: AiaicMine): OfferView[] {
  const out: OfferView[] = [];
  for (const listing of mine.listings) {
    for (const offer of listing.offers) {
      const chip: OfferView["chip"] =
        offer.status === "open"
          ? offer.expired
            ? "expired"
            : "open"
          : offer.status === "accepted"
            ? "accepted"
            : offer.status === "rejected"
              ? "rejected"
              : "withdrawn";
      out.push({ offer, listing, canAnswer: offer.status === "open" && offer.can_accept, chip });
    }
  }
  return out.sort((a, b) => b.offer.created_at.localeCompare(a.offer.created_at));
}

export function findOffer(mine: AiaicMine, offerId: string): OfferView | null {
  return offerViews(mine).find((v) => v.offer.offer_id === offerId) ?? null;
}

export function findOrder(mine: AiaicMine, orderId: string): AiaicOrder | null {
  return mine.orders.find((o) => o.order_id === orderId) ?? null;
}

/** The order an accepted offer became (an accepted offer's page leads to its order). */
export function orderOfOffer(mine: AiaicMine, offerId: string): AiaicOrder | null {
  return mine.orders.find((o) => o.offer_id === offerId) ?? null;
}

export function listingOfOrder(mine: AiaicMine, order: AiaicOrder): AiaicListing | null {
  return mine.listings.find((l) => l.listing_id === order.listing_id) ?? null;
}

/** Money summed over her orders, for the payments page's bars: what was agreed, what buyers paid (Razorpay's
 * verified word), what was sent to her and what settled (Razorpay's word about her share). Called-off orders are
 * left out of "agreed". */
export function moneyTotals(orders: AiaicOrder[]): {
  agreed: number;
  paidByBuyers: number;
  sentToHer: number;
  settled: number;
  orders: number;
} {
  let agreed = 0;
  let paidByBuyers = 0;
  let sentToHer = 0;
  let settled = 0;
  for (const o of orders) {
    if (o.order_state !== "cancelled") agreed += o.amount_inr;
    if (o.payment_state === "paid") paidByBuyers += o.amount_inr;
    const s = o.money?.settlement_state;
    const share = o.money?.share_inr ?? 0;
    if (s === "transferred" || s === "released" || s === "settled") sentToHer += share;
    if (s === "settled") settled += share;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    agreed: r(agreed),
    paidByBuyers: r(paidByBuyers),
    sentToHer: r(sentToHer),
    settled: r(settled),
    orders: orders.length,
  };
}

// ---------------------------------------------------------------------------------- her payout details (TEST)

export type PayoutDetailsIn = {
  destination: "bank_account" | "upi_id";
  pan: string;
  name_on_pan: string;
  account_number?: string | undefined;
  ifsc?: string | undefined;
  upi_id?: string | undefined;
};

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^[0-9A-Z]{5,20}$/;
const UPI_RE = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{0,98}[A-Za-z.]$/;

/**
 * The same checks AIAIC makes (its `trade/payouts.py`), so she is told at once which box to correct; the field is
 * named, never the value. AIAIC checks again, and only AIAIC's answer counts.
 */
export function payoutDetailsProblem(d: PayoutDetailsIn): string | null {
  const pan = d.pan.replace(/\s+/g, "").toUpperCase();
  if (!PAN_RE.test(pan)) return "pan";
  const name = d.name_on_pan.replace(/\s+/g, " ").trim();
  if (!NAME_RE.test(name)) return "name_on_pan";
  if (d.destination === "bank_account") {
    const acc = (d.account_number ?? "").replace(/[\s-]+/g, "").toUpperCase();
    if (!ACCOUNT_RE.test(acc)) return "account_number";
    if (!IFSC_RE.test((d.ifsc ?? "").replace(/\s+/g, "").toUpperCase())) return "ifsc";
    if (d.upi_id) return "upi_id";
    return null;
  }
  if (!UPI_RE.test((d.upi_id ?? "").trim())) return "upi_id";
  if (d.account_number || d.ifsc) return "account_number";
  return null;
}

// ------------------------------------------------------------------------------------------------ transport

export type TransportAttribution = { text: string; url: string };

export type TransportEstimate = {
  from: {
    district: string;
    district_key?: string | undefined;
    state: string;
    lat: number;
    lon: number;
    place_class?: string | null | undefined;
  };
  to: {
    mandi: string;
    district?: string | null | undefined;
    state: string;
    lat: number;
    lon: number;
    located_by?: string | undefined;
  };
  quantity_q: number;
  route_type: {
    key: string | null;
    from_area?: string | null | undefined;
    to_area?: string | null | undefined;
    factor_low: number | null;
    factor_high: number | null;
    applied: boolean;
  };
  distance: {
    km: number;
    method: "road" | "estimate";
    straight_km?: number | undefined;
    provider?: string | undefined;
    mode?: string | undefined;
    minutes?: number | null | undefined;
    why_not_road?: string | undefined;
  };
  route: { type: string; coordinates: [number, number][] } | null;
  vehicle: {
    key: string;
    name: string;
    names: Record<string, string>;
    capacity_kg: number;
    capacity_q: number;
  };
  trips: number;
  rate: {
    kind: "market" | "official";
    n_sources?: number | undefined;
    sources?:
      | {
          key: string;
          name: string;
          url: string;
          page_date: string | null;
          read_on?: string | undefined;
        }[]
      | undefined;
    source?:
      | {
          name: string;
          url: string;
          page_date?: string | null | undefined;
          label?: string | undefined;
        }
      | undefined;
    label?: string | undefined;
    applied_per_km_low?: number | undefined;
    applied_per_km_high?: number | undefined;
  };
  fare_per_trip: { low_rs: number; high_rs: number };
  cost: { low_rs: number; high_rs: number };
  per_quintal: { low_rs: number; high_rs: number };
  notes: { code: string; text?: string | undefined; values?: Record<string, Json> | undefined }[];
  attribution: TransportAttribution[];
  information_only?: boolean | undefined;
};

export type NearbyMandi = {
  mandi: string;
  state: string;
  district_key?: string | undefined;
  straight_km: number;
  road_km_estimate?: number | undefined;
};

export type NearbyMandis = {
  mandis: NearbyMandi[];
  attribution: TransportAttribution[];
};

/** The vehicle's name in her language (AIAIC's own names; English when a name is missing). */
export function vehicleName(est: TransportEstimate, lang: string): string {
  const names = est.vehicle.names ?? {};
  return names[lang] ?? names["en"] ?? est.vehicle.name;
}

/** The line of sources under the fare: each rate source's name and its page date ("undated" when it has none). */
export function rateSources(
  est: TransportEstimate,
): { name: string; url: string; day: string | null }[] {
  if (est.rate.kind === "official" && est.rate.source) {
    return [
      {
        name: est.rate.source.name,
        url: est.rate.source.url,
        day: est.rate.source.page_date ?? null,
      },
    ];
  }
  return (est.rate.sources ?? []).map((s) => ({
    name: s.name,
    url: s.url,
    day: s.page_date ?? null,
  }));
}

/** Every attribution the answer carries, OpenStreetMap's first, none dropped (OSM's and Geoapify's terms). */
export function attributionsOf(
  ...lists: (TransportAttribution[] | undefined)[]
): TransportAttribution[] {
  const seen = new Map<string, TransportAttribution>();
  for (const list of lists) {
    for (const a of list ?? []) {
      if (a && typeof a.text === "string" && !seen.has(a.text)) seen.set(a.text, a);
    }
  }
  if (!seen.size) {
    seen.set("© OpenStreetMap contributors", {
      text: "© OpenStreetMap contributors",
      url: "https://www.openstreetmap.org/copyright",
    });
  }
  return [...seen.values()].sort((a, b) =>
    a.text.includes("OpenStreetMap") === b.text.includes("OpenStreetMap")
      ? 0
      : a.text.includes("OpenStreetMap")
        ? -1
        : 1,
  );
}

/**
 * The route's sketch for an inline SVG of `width` x `height`: the road's own line when AIAIC had one from Geoapify,
 * else the straight line between the two ends (drawn dashed: an estimate is never drawn as a road).
 */
export function routeSketch(
  est: TransportEstimate,
  width: number,
  height: number,
  pad = 14,
): { path: string; dashed: boolean; from: [number, number]; to: [number, number] } {
  const road = est.route && est.distance.method === "road" ? est.route.coordinates : null;
  const pts: [number, number][] =
    road && road.length >= 2
      ? road
      : [
          [est.from.lon, est.from.lat],
          [est.to.lon, est.to.lat],
        ];
  const lats = pts.map((p) => p[1]);
  const lons = pts.map((p) => p[0]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = lons.map((x) => x * k);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const at = (p: [number, number]): [number, number] => [
    Math.round((offX + (p[0] * k - minX) * scale) * 10) / 10,
    Math.round((offY + (maxY - p[1]) * scale) * 10) / 10,
  ];
  const xy = pts.map(at);
  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const first = xy[0] ?? [pad, height / 2];
  const last = xy[xy.length - 1] ?? [width - pad, height / 2];
  return { path, dashed: !road, from: first, to: last };
}
