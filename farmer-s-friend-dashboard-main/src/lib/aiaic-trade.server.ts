/**
 * AIAIC's sale, payment and transport routes, called from THIS SERVER only.
 *
 * - A FARMER SIGNED IN to this app (push 4b, `aiaic-identity.server.ts`) reads and writes HER OWN sale record
 *   (`/farmer/trade/*`, AIAIC's contract sections 17b and 17d) with her own AIAIC token. AIAIC's own rules govern it.
 * - A GUEST is asked to sign in to sell (`sign_in_to_sell`): no sale, offer, order, payment or sale price is read or
 *   written for a guest, and NO CALL IS EVER MADE AS ANOTHER ACCOUNT (28 Oct 2026; the audit's PRIVACY-09: a shared
 *   farmer account had been the fallback). The settings AIAIC_FARMER_USERNAME and AIAIC_FARMER_PASSWORD now only say
 *   that this app is connected to AIAIC's sale service (`tradeMode`); the password is read for its presence and sent
 *   nowhere.
 * - Her token crosses the network only over https, or to an address on this machine or its private network
 *   (`signInAllowed`; `aiaic_sign_in_needs_https` otherwise).
 * - Transport and storage (`/transport/*`, `/storage/*`, sections 19, 21 and 33) need no sign-in: public reads, sent
 *   with who asked (her token, else this device's id: AIAIC keeps a look), and kept here for 30 minutes so the road
 *   routes AIAIC asks Geoapify for are not spent twice on the same trip (a look served from here is not re-recorded).
 * - Nothing here falls back to the local store: when AIAIC is set up and does not answer, that is SAID.
 */
import {
  aiaicHeaders,
  isTunnelErrorBody,
  resolveBaseUrl,
  signInAllowed,
} from "./aiaic-base.server";
import {
  askerHeaders,
  deviceId,
  dropHerSession,
  herSession,
  type HerSession,
} from "./aiaic-identity.server";
import {
  evidenceKindOf,
  holdsOf,
  laneOf,
  namesOf,
  pricingOf,
  problem,
  type AiaicCrisis,
  type AiaicMine,
  type AiaicPool,
  type AiaicPricing,
  type Json,
  type AiaicProblem,
  type AiaicResult,
  type BuyerDemand,
  type BuyersLooking,
  type MineForScreen,
  type NearbyMandis,
  type ReferencePrice,
  type StoragePlan,
  type StorageVerdict,
  type TradeMode,
  type TransportEstimate,
  type TalukaRow,
  type OfferCompare,
  type XDestination,
  type MySharing,
  type ShareAnswer,
} from "./aiaic-trade";
import { buildKind, demoStoreAllowed } from "./demo-store.server";
import { isTimeout, outsideFetch } from "./outside-call.server";

export const USERNAME_ENV = "AIAIC_FARMER_USERNAME";
export const PASSWORD_ENV = "AIAIC_FARMER_PASSWORD";

const CALL_TIMEOUT_MS = 20_000;
/** A transport or storage answer is kept this long (the road routes AIAIC asks Geoapify for are not spent twice). */
const TRANSPORT_KEEP_MS = 30 * 60_000;
const NAMES_KEEP_MS = 30 * 60_000;

function settingSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** The rule now lives beside AIAIC's address (`aiaic-base.server.ts`): it holds for her sign-in too. */
export { signInAllowed };

/** Where a GUEST's sales live, from the settings alone (no network): see `TradeMode`. */
export function tradeMode(): TradeMode {
  const hasUser = settingSet(USERNAME_ENV);
  const hasPassword = settingSet(PASSWORD_ENV);
  // THE DEMO STORE IS FOR DEVELOPMENT ONLY (lane AN, item 1): without the settings, a built server says it is not
  // connected to AIAIC's sale service; only the development server keeps the demo store (`demo-store.server.ts`)
  if (!hasUser && !hasPassword)
    return demoStoreAllowed()
      ? { mode: "local" }
      : { mode: "aiaic", problem: problem("aiaic_not_connected") };
  if (!hasUser)
    return { mode: "aiaic", problem: problem("aiaic_setting_missing", { setting: USERNAME_ENV }) };
  if (!hasPassword)
    return { mode: "aiaic", problem: problem("aiaic_setting_missing", { setting: PASSWORD_ENV }) };
  if (!signInAllowed(resolveBaseUrl().baseUrl))
    return {
      mode: "aiaic",
      problem: problem("aiaic_sign_in_needs_https", { setting: "AIAIC_BASE_URL" }),
    };
  return { mode: "aiaic", problem: null };
}

/** Where HER sales live now: in AIAIC, as her own record, when she is signed in; else a guest's (`tradeMode`). */
export function tradeModeNow(): TradeMode {
  return herSession() ? { mode: "aiaic", problem: null } : tradeMode();
}

// ------------------------------------------------------------------------------------------------ what is kept

/** Each call's time limit: `CALL_TIMEOUT_MS`, unless a suite run from source shortened it (`callLimitForTests`). */
let callLimitMs = CALL_TIMEOUT_MS;

/** FOR HER SUITES ONLY, run from source: a shorter time limit for each call (null: `CALL_TIMEOUT_MS` again). */
export function callLimitForTests(ms: number | null): void {
  if (buildKind() !== "source")
    throw new Error("callLimitForTests is for the suites run from source only");
  callLimitMs = ms ?? CALL_TIMEOUT_MS;
}

/** For the tests only: forget what was kept. */
export function resetForTests(): void {
  transportKept.clear();
  namesKept.clear();
  pricingKept = null;
}

// ------------------------------------------------------------------------------------------------ one call

type Query = Record<string, string | number | boolean | null | undefined>;
type CallOpts = {
  path: string;
  method?: "GET" | "POST";
  query?: Query;
  body?: unknown;
  /** The press's Idempotency-Key (writes). */
  key?: string;
  /**
   * Who the call is made as (push 4b):
   * - `trade`: her sale. HER OWN token when she is signed in (her own record; AIAIC's rules govern it), else the
   *   server's practice account (a guest's sale screens, as before).
   * - `person`: a public read AIAIC keeps as what she looked at: her token, else this device's id (never both).
   * - `none`: a public list (places, the payment pricing): nobody named.
   */
  as: "trade" | "person" | "none";
};

function crisisOf(body: Record<string, unknown>): AiaicCrisis {
  const lines = Array.isArray(body["talk_to_someone"]) ? body["talk_to_someone"] : [];
  const helplines = lines
    .map((h) => (h && typeof h === "object" ? (h as Record<string, unknown>) : {}))
    .filter((h) => typeof h["phone"] === "string")
    .map((h) => ({ name: String(h["name"] ?? ""), phone: String(h["phone"]) }));
  return {
    answer: typeof body["answer"] === "string" ? body["answer"] : null,
    message: typeof body["message"] === "string" ? body["message"] : null,
    helplines,
  };
}

/**
 * AIAIC's refusal, as facts: `{detail: {reason_code, message, ...facts}}` (its contract), or a plain detail. A 429 is said as what it
 * is, never as "AIAIC did not accept this", which points at what they did (the audit of 1 Nov 2026, F30): `refused` is AIAIC's
 * `X-AIAIC-Refused`, `server_busy` where the heavy slots were full for everyone.
 */
export function refusalOf(status: number, body: unknown, refused?: string | null): AiaicProblem {
  if (status === 429)
    return problem(refused === "server_busy" ? "aiaic_server_busy" : "aiaic_busy", { status });
  const detail =
    body && typeof body === "object" ? (body as Record<string, unknown>)["detail"] : undefined;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as Record<string, unknown>;
    if (typeof d["reason_code"] === "string") {
      const facts: Record<string, Json> = {};
      for (const [k, v] of Object.entries(d))
        if (k !== "reason_code" && k !== "message") facts[k] = v as Json;
      return problem(d["reason_code"], {
        status,
        message: typeof d["message"] === "string" ? d["message"] : null,
        facts: Object.keys(facts).length ? facts : null,
      });
    }
    if (typeof d["error"] === "string") return problem("refused", { status, message: d["error"] });
  }
  if (Array.isArray(detail)) return problem("invalid", { status });
  return problem(status >= 500 ? "aiaic_unavailable" : status === 404 ? "not_found" : "refused", {
    status,
    message: typeof detail === "string" ? detail : null,
  });
}

async function call<T>(opts: CallOpts): Promise<AiaicResult<T>> {
  const { baseUrl } = resolveBaseUrl();
  // her own session, for her sale and her looks (none outside a request, or once AIAIC refused her token)
  let her: HerSession | null = opts.as === "none" ? null : herSession();
  // A SALE CALL IS HERS OR NONE (audit of 28 Oct 2026, PRIVACY-09): it never falls back to a shared account, so her
  // payment details or her sale can never go under another account's record
  if (opts.as === "trade" && !her) return { ok: false, problem: problem("sign_in_to_sell") };
  const url = new URL(`${baseUrl}${opts.path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = aiaicHeaders();
    if (her) {
      Object.assign(headers, askerHeaders({ kind: "her", session: her }));
    } else if (opts.as === "person") {
      const id = deviceId();
      if (id) Object.assign(headers, askerHeaders({ kind: "device", id }));
    }
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.key) headers["idempotency-key"] = opts.key;
    let res: Response;
    try {
      // one time limit over the whole call, its answer included (lane AN, item 4: `outside-call.server.ts`)
      res = await outsideFetch("aiaic", url, {
        method: opts.method ?? "GET",
        headers,
        ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
        limitMs: callLimitMs,
        // the same read, running now as the same asker, is shared (item 5); a write never is
        share: (opts.method ?? "GET") === "GET",
      });
    } catch (error) {
      // a call past its limit is said as such: AIAIC may have taken a write it did not answer, so never "nothing was
      // changed"; the same press goes again with its same key (`answerLanded`)
      return {
        ok: false,
        problem: problem(isTimeout(error) ? "aiaic_timed_out" : "aiaic_unavailable"),
      };
    }
    const text = await res.text();
    if (isTunnelErrorBody(text))
      return { ok: false, problem: problem("aiaic_unavailable", { status: res.status }) };
    if (res.status === 401 && her) {
      // HER token is no longer taken (expired, or her account is no longer in use): her session is dropped and the app
      // says so once. A public read goes again as this device (its answer does not depend on who asked); her sale is
      // never sent again as anyone else: she is asked to sign in again.
      dropHerSession("signed_out");
      her = null;
      if (opts.as === "person" && attempt === 0) continue;
      return { ok: false, problem: problem("aiaic_signed_out") };
    }
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        return { ok: false, problem: problem("aiaic_answer_unreadable", { status: res.status }) };
      }
    }
    if (
      json &&
      typeof json === "object" &&
      (json as Record<string, unknown>)["distress"] === true
    ) {
      // THE CRISIS CARD OUTRANKS EVERYTHING (AIAIC reads every typed box for distress first).
      return {
        ok: false,
        problem: problem("crisis", {
          status: res.status,
          crisis: crisisOf(json as Record<string, unknown>),
        }),
      };
    }
    if (!res.ok)
      return {
        ok: false,
        problem: refusalOf(res.status, json, res.headers.get("x-aiaic-refused")),
      };
    return { ok: true, data: json as T };
  }
  return { ok: false, problem: problem("aiaic_unavailable") };
}

// ------------------------------------------------------------------------------------- her records, kept small

function pick<T extends object>(obj: unknown, keys: readonly string[]): T {
  const src = obj && typeof obj === "object" ? (obj as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in src) out[k] = src[k];
  return out as T;
}

const OFFER_KEYS = [
  "offer_id",
  "listing_id",
  "price_per_q",
  "quantity_q",
  "amount_inr",
  "terms_code",
  "delivery_terms",
  "valid_until",
  "status",
  "closed_reason",
  "synthetic",
  "expired",
  "can_accept",
  "why_not_accept",
  "buyer_type",
  "buyer_district",
  "buyer_name",
  "created_at",
  "pool_id",
] as const;
const LISTING_KEYS = [
  "listing_id",
  "taluka",
  "crop",
  "variety",
  "grade",
  "quantity_q",
  "quantity_left_q",
  "ask_price_per_q",
  "district",
  "state",
  "status",
  "synthetic",
  "created_at",
  "updated_at",
  "reference_price",
] as const;
const REFERENCE_KEYS = [
  "held",
  "crop",
  "district",
  "price_day",
  "age_days",
  "mandis_reporting",
  "middle_of_all_per_q",
  "lowest_per_q",
  "highest_per_q",
  "source_name",
  "suggested_ask_per_q",
  "reason",
] as const;
const ORDER_KEYS = [
  "order_id",
  "offer_id",
  "listing_id",
  "crop",
  "quantity_q",
  "price_per_q",
  "amount_inr",
  "terms_code",
  "delivery_terms",
  "order_state",
  "cancel_reason_code",
  "payment_state",
  "synthetic",
  "created_at",
  "updated_at",
  "buyer_name",
  "buyer_type",
  "buyer_district",
  "next_steps",
  "her_next_step",
  "pool_id",
] as const;
const STEP_KEYS = ["event_id", "stage", "status", "simulated", "created_at"] as const;
/**
 * THE FACTS OF EACH STEP HER APP SHOWS (27 Oct 2026; the owner: "Pls let me know if farmer is able to see ... processing"),
 * a closed list per stage: quantities, the grade, the place, the days. A note (free text), a certificate's or a vehicle's
 * reference and the lots gathered with hers (other farmers') stay on AIAIC's side.
 */
const STEP_DETAIL_KEYS: Record<string, readonly string[]> = {
  aggregation: ["collection_point", "quantity_q"],
  quality_grading: ["grade", "weight_q", "rejected_q", "sampled", "tested_on", "tested_at_apmc"],
  storage: ["facility", "facility_kind", "quantity_q", "stored_from", "stored_to"],
  processing: ["process", "input_q", "output_q"],
  pickup: ["quantity_q"],
  in_transit: ["expected_on"],
  delivered: ["received_q"],
  delivery_exception: ["kind", "quantity_q"],
  reconciliation: ["delivered_q", "accepted_q", "rejected_q"],
};
function stepOf(x: unknown): Record<string, unknown> {
  const out = pick<Record<string, unknown>>(x, STEP_KEYS);
  const src = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  const keys = STEP_DETAIL_KEYS[String(src["stage"])] ?? [];
  const detail =
    src["detail"] && typeof src["detail"] === "object"
      ? (src["detail"] as Record<string, unknown>)
      : {};
  const kept: Record<string, unknown> = {};
  for (const k of keys) {
    const v = detail[k];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") kept[k] = v;
  }
  out["detail"] = kept;
  // HOW THE STEP IS KNOWN (Round 2, R2-3): AIAIC's code from its closed list, else none (`buyer_confirmed`: the buyer's
  // own "It arrived", said to her as such)
  out["evidence_kind"] = evidenceKindOf(src["evidence_kind"]);
  const loss = src["loss"];
  out["loss"] = loss && typeof loss === "object" ? pick(loss, ["q", "pct"] as const) : null;
  return out;
}
/** A group sale (AIAIC section 27): counts, the place, the price and the days; never another farmer, never the buyer's record. */
const POOL_KEYS = [
  "pool_id",
  "crop",
  "target_q",
  "joined_q",
  "joined_farmers",
  "left_q",
  "price_per_q",
  "grade",
  "collection_point",
  "district",
  "collect_on",
  "valid_until",
  "pay_within_days",
  "status",
  "simulated",
  "km",
  "her_crop",
] as const;
function poolOf(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" ? pick<Record<string, unknown>>(x, POOL_KEYS) : null;
}
/** A sale gathered with others (AIAIC section 25): counts and the place, never another farmer. */
const POOLED_KEYS = [
  "collection_point",
  "lots",
  "farmers",
  "quantity_q",
  "recorded_at",
  "simulated",
] as const;
function pooledOf(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" ? pick<Record<string, unknown>>(x, POOLED_KEYS) : null;
}
/** A group's sale plan with her lot (AIAIC section 26): where it would go, what it keeps, her answer. */
const GROUP_PLAN_KEYS = [
  "plan_id",
  "price_day",
  "crop",
  "quantity_q",
  "kept_rs",
  "kept_basis",
  "not_sent_q",
  "with_farmers",
  "group_farmers",
  "group_lots",
  "answer",
  "answered_at",
  "can_answer",
  "sent_at",
  "simulated",
  "note",
] as const;
const GOES_TO_KEYS = ["mandi", "quantity_q", "gross_price", "km", "truckloads", "trip_rs"] as const;
function groupPlanOf(x: unknown): Record<string, unknown> | null {
  if (!x || typeof x !== "object") return null;
  const out = pick<Record<string, unknown>>(x, GROUP_PLAN_KEYS);
  const goes = (x as Record<string, unknown>)["goes_to"];
  out["goes_to"] = Array.isArray(goes) ? goes.map((g) => pick(g, GOES_TO_KEYS)) : [];
  return out;
}
const PAYMENT_KEYS = [
  "state",
  "link_made",
  "not_onward",
  "refund_owed_inr",
  "refund_note",
] as const;
/** Her order's money as people said it (AIAIC's `payout_store.money_for_her`): the keys passed on. AIAIC also sends
 * `settlement_state` (the order's own: `not_connected`, `direct`, or a history order's earlier value); nothing here
 * reads it, and it stays on this server. */
const MONEY_KEYS = ["route", "say", "can_report", "why_not_report", "reports"] as const;

/**
 * Only what this app shows leaves the server: the answer is copied field by field (the contact path's blocks, ids of
 * other systems and every later field AIAIC may add stay here).
 */
const FROM_AIAIC_KEYS = [
  "fixed_by_link",
  "to_her_inr",
  "price_inr",
  "commission_inr",
  "gst_inr",
  "commission_percent",
  "gst_percent",
  "buyer_paid",
  "upi_one_lakh_or_more",
] as const;
const SENDING_KEYS = [
  "status",
  "rail",
  "amount_inr",
  "utr",
  "updated_at",
  "test_mode",
  "stale",
] as const;

/** Her steps as AIAIC says them (audit of 28 Oct 2026, MONEY-11): three facts, never worked out here. */
function stepsOf(raw: unknown): { buyer_paid: boolean; sent: boolean; reached: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    buyer_paid: r["buyer_paid"] === true,
    sent: r["sent"] === true,
    reached: r["reached"] === true,
  };
}

/** The notice she is shown before she gives her UPI ID or bank account (PRIVACY-03): its version and its paragraphs
 * in each language, strings only. */
function noticeOf(
  raw: unknown,
): { version: string; en: string[]; mr: string[]; hi: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lines = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  if (typeof r["version"] !== "string") return null;
  return { version: r["version"], en: lines(r["en"]), mr: lines(r["mr"]), hi: lines(r["hi"]) };
}
// 4 Nov 2026: `provider`, the name of the payments provider her details went to ("cashfree"), so her words name it
const X_DEST_KEYS = ["kind", "hint", "status", "ready", "provider"] as const;

export function mineForBrowser(raw: unknown): AiaicMine {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const listings = Array.isArray(r["listings"]) ? r["listings"] : [];
  const orders = Array.isArray(r["orders"]) ? r["orders"] : [];
  const party = r["party"] && typeof r["party"] === "object" ? r["party"] : null;
  const place =
    r["profile_place"] && typeof r["profile_place"] === "object"
      ? (r["profile_place"] as Record<string, unknown>)
      : {};
  const mine: AiaicMine = {
    tenant_id: String(r["tenant_id"] ?? ""),
    profile_place: {
      state: typeof place["state"] === "string" ? place["state"] : null,
      district: typeof place["district"] === "string" ? place["district"] : null,
    },
    practice: r["practice"] === true,
    practice_note: typeof r["practice_note"] === "string" ? r["practice_note"] : null,
    party: party
      ? pick<NonNullable<AiaicMine["party"]>>(party, ["party_id", "synthetic", "district", "state"])
      : null,
    listings: listings.map((l) => {
      const listing = pick<Record<string, unknown>>(l, LISTING_KEYS);
      const ref = (l as Record<string, unknown>)["reference_price"];
      listing["reference_price"] = ref ? pick(ref, REFERENCE_KEYS) : null;
      const offers = (l as Record<string, unknown>)["offers"];
      listing["offers"] = Array.isArray(offers)
        ? offers.map((o) => ({
            ...pick<Record<string, unknown>>(o, OFFER_KEYS),
            pool: poolOf((o as Record<string, unknown>)["pool"]),
          }))
        : [];
      listing["pooled_in"] = pooledOf((l as Record<string, unknown>)["pooled_in"]);
      listing["group_plan"] = groupPlanOf((l as Record<string, unknown>)["group_plan"]);
      return listing as unknown as AiaicMine["listings"][number];
    }),
    orders: orders.map((o) => {
      const src = o as Record<string, unknown>;
      const order = pick<Record<string, unknown>>(o, ORDER_KEYS);
      order["fulfilment"] = Array.isArray(src["fulfilment"])
        ? src["fulfilment"].map((s) => stepOf(s))
        : [];
      order["payment"] = pick(src["payment"], PAYMENT_KEYS);
      order["pooled"] = pooledOf(src["pooled"]);
      order["pool"] = poolOf(src["pool"]);
      // WHERE IT STANDS AND WHOM IT WAITS ON, AIAIC's own word (Crowe EOD, 16 Nov 2026: her guided home), field by field
      order["lane"] = laneOf(src["lane"]);
      // WHAT AIAIC SENDS HER, AND WHERE IT IS (28 Oct 2026): AIAIC's own figures, field by field
      const fa = src["from_aiaic"];
      if (fa && typeof fa === "object") {
        const m = pick<Record<string, unknown>>(fa, FROM_AIAIC_KEYS);
        const s = (fa as Record<string, unknown>)["sending"];
        m["sending"] = s && typeof s === "object" ? pick(s, SENDING_KEYS) : null;
        m["steps"] = stepsOf((fa as Record<string, unknown>)["steps"]);
        // WHAT AIAIC HOLDS FOR HER NOW (Round 2, R2-2's `holds`): her own amount, since when, why it waits (a closed code)
        m["holds"] = holdsOf((fa as Record<string, unknown>)["holds"]);
        order["from_aiaic"] = m;
      }
      if (src["money"] && typeof src["money"] === "object")
        order["money"] = pick<Record<string, unknown>>(src["money"], MONEY_KEYS);
      return order as unknown as AiaicMine["orders"][number];
    }),
  };
  const xd = r["x_destination"];
  Object.assign(mine, {
    x_destination: xd && typeof xd === "object" ? pick(xd, X_DEST_KEYS) : null,
    collect_then_pay: r["collect_then_pay"] === true,
    x_notice: noticeOf(r["x_notice"]),
  });
  return mine;
}

// --------------------------------------------------------------------------------- names in her language

const namesKept = new Map<string, { at: number; names: Record<string, string> }>();

async function keptNames(
  key: string,
  read: () => Promise<Record<string, string>>,
): Promise<Record<string, string>> {
  const kept = namesKept.get(key);
  if (kept && Date.now() - kept.at < NAMES_KEEP_MS) return kept.names;
  const names = await read();
  if (Object.keys(names).length) namesKept.set(key, { at: Date.now(), names });
  return names;
}

function estateKey(state: string | null | undefined): "mh" | "mp" {
  const s = (state ?? "").toLowerCase();
  return s === "mp" || s.includes("madhya") ? "mp" : "mh";
}

async function cropNamesOf(state: string, district: string, lang: string) {
  return keptNames(`crops:${state}:${district.toLowerCase()}:${lang}`, async () => {
    const r = await call<{ crops?: { crop: string; name: string }[] }>({
      path: "/places/crops",
      query: { district: district.toLowerCase(), state, lang },
      as: "none",
    });
    const out: Record<string, string> = {};
    if (r.ok) for (const c of r.data.crops ?? []) if (c.crop && c.name) out[c.crop] = c.name;
    return out;
  });
}

async function districtNamesOf(state: string, lang: string) {
  return keptNames(`districts:${state}:${lang}`, async () => {
    const r = await call<{ districts?: { key: string; name: string; name_en: string }[] }>({
      path: "/places/districts",
      query: { state, lang },
      as: "none",
    });
    const out: Record<string, string> = {};
    if (r.ok)
      for (const d of r.data.districts ?? []) {
        if (d.name_en && d.name) out[d.name_en] = d.name;
        if (d.key && d.name) out[d.key] = d.name;
      }
    return out;
  });
}

/**
 * EVERY CROP'S NAME IN THE READER'S LANGUAGE, from AIAIC's own catalogue of each state (public `GET /catalog`, its
 * `crop_names`: the names `/places/crops` gives a district's crops), for a line that names a crop with no district
 * beside it: the farmer's money notice (R5P-10, 28 Oct 2026). Kept 30 minutes; a name AIAIC does not send is not made
 * up here (the line then names no crop).
 */
export async function everyCropName(lang: string): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const state of ["mp", "mh"] as const) {
    const held = await keptNames(`catalog:${state}:${lang}`, async () => {
      const r = await call<{ crop_names?: Record<string, unknown> }>({
        path: "/catalog",
        query: { state, lang },
        as: "none",
      });
      const out: Record<string, string> = {};
      if (r.ok)
        for (const [crop, name] of Object.entries(r.data?.crop_names ?? {}))
          if (typeof name === "string" && name) out[crop] = name;
      return out;
    });
    Object.assign(names, held);
  }
  return names;
}

// ------------------------------------------------------------------------------------------------ her sale

/** GET /farmer/trade, kept small, with the names of her crops and districts in her language. A real farmer's
 * account is refused here, before anything of hers leaves this server. */
export async function getMine(lang: string): Promise<AiaicResult<MineForScreen>> {
  // HER OWN SALE ONLY (28 Oct 2026; real payments): a guest is asked to sign in, never shown a shared account's records
  if (!herSession()) return { ok: false, problem: problem("sign_in_to_sell") };
  const r = await call<unknown>({ path: "/farmer/trade", as: "trade" });
  if (!r.ok) return r;
  const mine = mineForBrowser(r.data);
  const places = new Map<string, { state: string; district: string }>();
  const add = (state: string | null | undefined, district: string | null | undefined) => {
    if (!district) return;
    const s = estateKey(state);
    places.set(`${s}:${district.toLowerCase()}`, { state: s, district });
  };
  add(mine.profile_place.state, mine.profile_place.district);
  for (const l of mine.listings) add(l.state, l.district);
  const cropNames: Record<string, string> = {};
  for (const p of places.values())
    Object.assign(cropNames, await cropNamesOf(p.state, p.district, lang));
  const districtNames: Record<string, string> = {
    ...(await districtNamesOf("mp", lang)),
    ...(await districtNamesOf("mh", lang)),
  };
  return { ok: true, data: { mine, cropNames, districtNames } };
}

const DEMAND_KEYS = [
  "demand_id",
  "buyer_type",
  "buyer_district",
  "crops",
  "min_q",
  "max_q",
  "room_q",
  "max_price_per_q",
  "needed_from",
  "needed_to",
  "grades",
  "km",
  "synthetic",
] as const;

/**
 * GET /farmer/trade/buyers-looking (AIAIC section 25, 27 Oct 2026): the demand AIAIC's team chose to show farmers
 * near her (her district, her kind of records), never a buyer's name, with the names of crops and districts in her
 * language. A guest reads it as the server's practice account, so that account is checked first, as for her sales.
 */
export async function buyersLooking(lang: string): Promise<AiaicResult<BuyersLooking>> {
  const refused = await practiceFirst();
  if (refused) return { ok: false, problem: refused };
  const r = await call<unknown>({ path: "/farmer/trade/buyers-looking", as: "trade" });
  if (!r.ok) return r;
  const src = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : {};
  const list = Array.isArray(src["buyers"]) ? src["buyers"] : [];
  const buyers = list.map((b) => {
    const d = pick<Record<string, unknown>>(b, DEMAND_KEYS);
    d["crops"] = Array.isArray(d["crops"]) ? d["crops"].map((c) => String(c)) : [];
    d["grades"] = Array.isArray(d["grades"]) ? d["grades"].map((g) => String(g)) : [];
    return d as unknown as BuyerDemand;
  });
  const state = typeof src["state"] === "string" ? src["state"] : null;
  const district = typeof src["district"] === "string" ? src["district"] : null;
  // group sales being gathered near her (AIAIC section 27; an AIAIC not yet updated sends none)
  const pools = (Array.isArray(src["pools"]) ? src["pools"] : [])
    .map((p) => poolOf(p))
    .filter((p): p is Record<string, unknown> => p !== null) as unknown as AiaicPool[];
  const cropNames = district ? await cropNamesOf(estateKey(state), district, lang) : {};
  const districtNames: Record<string, string> = {
    ...(await districtNamesOf("mp", lang)),
    ...(await districtNamesOf("mh", lang)),
  };
  return {
    ok: true,
    data: {
      state,
      district,
      practice: src["practice"] === true,
      buyers,
      pools,
      cropNames,
      districtNames,
    },
  };
}

/** Every sale write is HERS, signed in (28 Oct 2026: real payments; no guest writes through a shared account). */
async function practiceFirst(): Promise<AiaicProblem | null> {
  return herSession() ? null : problem("sign_in_to_sell");
}

export async function getPrice(q: {
  crop: string;
  state: string;
  district: string;
}): Promise<AiaicResult<ReferencePrice>> {
  const refused = await practiceFirst();
  if (refused) return { ok: false, problem: refused };
  const r = await call<unknown>({ path: "/farmer/trade/price", query: q, as: "trade" });
  if (!r.ok) return r;
  return { ok: true, data: referencePriceShown(r.data) };
}

/** What of AIAIC's mandi prices for her sale leaves this server (`GET /farmer/trade/price`): its reference keys only.
 *  Exported so her sale's page test reads AIAIC's recorded answer as this server reads it (R2-3 lane A part A-b). */
export function referencePriceShown(answer: unknown): ReferencePrice {
  return pick<ReferencePrice>(answer, REFERENCE_KEYS);
}

async function write<T>(path: string, key: string, body: unknown): Promise<AiaicResult<T>> {
  const refused = await practiceFirst();
  if (refused) return { ok: false, problem: refused };
  return call<T>({ path, method: "POST", body, key, as: "trade" });
}

export type SellInput = {
  state: string;
  district: string;
  crop: string;
  quantity_q: number;
  ask_price_per_q?: number | undefined;
  grade?: string | null | undefined;
  price_confirmed?: boolean | undefined;
  taluka?: string | undefined;
};

export async function sell(
  key: string,
  d: SellInput,
): Promise<AiaicResult<{ listing_id: string }>> {
  const body: Record<string, unknown> = {
    crop: d.crop,
    quantity_q: d.quantity_q,
    state: d.state,
    district: d.district,
  };
  if (typeof d.ask_price_per_q === "number") body["ask_price_per_q"] = d.ask_price_per_q;
  if (d.taluka) body["taluka"] = d.taluka;
  if (d.grade) body["grade"] = d.grade;
  if (d.price_confirmed) body["price_confirmed"] = true;
  const r = await write<Record<string, unknown>>("/farmer/trade/listings", key, body);
  if (!r.ok) return r;
  return { ok: true, data: { listing_id: String(r.data["listing_id"] ?? "") } };
}

export async function answerOffer(
  key: string,
  offerId: string,
  answer: "accept" | "reject",
): Promise<AiaicResult<{ order_id: string | null }>> {
  const r = await write<Record<string, unknown>>(
    `/farmer/trade/offers/${encodeURIComponent(offerId)}/${answer}`,
    key,
    {},
  );
  if (!r.ok) return r;
  return {
    ok: true,
    data: { order_id: typeof r.data["order_id"] === "string" ? r.data["order_id"] : null },
  };
}

export async function stopSelling(key: string, listingId: string): Promise<AiaicResult<true>> {
  const r = await write<unknown>(
    `/farmer/trade/listings/${encodeURIComponent(listingId)}/withdraw`,
    key,
    {},
  );
  return r.ok ? { ok: true, data: true } : r;
}

/** Her answer to a group's sale plan with her lot (AIAIC section 26): she joins, or not this time. */
export async function answerGroupPlan(
  key: string,
  planId: string,
  answer: "joined" | "declined",
): Promise<AiaicResult<true>> {
  const r = await write<unknown>(
    `/farmer/trade/group-plans/${encodeURIComponent(planId)}/answer`,
    key,
    { answer },
  );
  return r.ok ? { ok: true, data: true } : r;
}

export async function reportPayment(
  key: string,
  orderId: string,
  what: "received" | "not_received",
): Promise<AiaicResult<true>> {
  const r = await write<unknown>(
    `/farmer/trade/orders/${encodeURIComponent(orderId)}/payment-report`,
    key,
    { what },
  );
  return r.ok ? { ok: true, data: true } : r;
}

// ------------------------------------------------------------------------------------------- AIAIC's pricing

const PRICING_KEEP_MS = 5 * 60_000;
let pricingKept: { at: number; answer: AiaicResult<AiaicPricing> } | null = null;

/**
 * GET /payments/pricing (AIAIC's contract, section 17c; public, no sign-in, and it sends no key, person or order):
 * AIAIC's commission as its server holds it now, for the pricing page's sentence. Only those facts leave this server.
 * An answer is kept 5 minutes; a refusal (an AIAIC not yet updated answers 404) or an unreadable answer is SAID, and
 * asked again next time.
 */
export async function aiaicPricing(): Promise<AiaicResult<AiaicPricing>> {
  if (pricingKept && Date.now() - pricingKept.at < PRICING_KEEP_MS) return pricingKept.answer;
  const r = await call<unknown>({ path: "/payments/pricing", as: "none" });
  if (!r.ok) return r;
  const pricing = pricingOf(r.data);
  if (!pricing) return { ok: false, problem: problem("aiaic_answer_unreadable") };
  const answer = { ok: true as const, data: pricing };
  pricingKept = { at: Date.now(), answer };
  return answer;
}

// ------------------------------------------------------------------------------------------------ transport

const transportKept = new Map<string, { at: number; answer: AiaicResult<unknown> }>();

async function keptTransport<T>(cacheKey: string, read: () => Promise<AiaicResult<T>>) {
  const kept = transportKept.get(cacheKey);
  if (kept && Date.now() - kept.at < TRANSPORT_KEEP_MS) return kept.answer as AiaicResult<T>;
  const answer = await read();
  // Only an answer is kept: a refusal for a cause that can pass (AIAIC down) is asked again next time.
  if (answer.ok) {
    if (transportKept.size > 500) transportKept.clear();
    transportKept.set(cacheKey, { at: Date.now(), answer });
  }
  return answer;
}

export type EstimateInput = {
  mandi: string;
  quantity_q: number;
  district: string;
  state: string;
  mandi_state?: string | undefined;
  mandi_district?: string | undefined;
  from_place: "farm" | "district_centre";
  taluka?: string | undefined;
};

/** GET /transport/estimate: a dated, sourced range (contract section 19); only its declared parameters are sent. */
export async function transportEstimate(q: EstimateInput): Promise<AiaicResult<TransportEstimate>> {
  const query: Query = {
    mandi: q.mandi,
    quantity_q: q.quantity_q,
    district: q.district,
    state: q.state,
    mandi_state: q.mandi_state,
    mandi_district: q.mandi_district,
    taluka: q.taluka,
    from_place: q.from_place,
  };
  return keptTransport(`estimate:${JSON.stringify(query)}`, () =>
    call<TransportEstimate>({ path: "/transport/estimate", query, as: "person" }),
  );
}

/** What a storage question asks: the card and the plan read the same boxes. */
export type StorageAsk = {
  crop: string;
  district: string;
  state: string;
  quantity_q?: number | undefined;
  taluka?: string | undefined;
  lang: string;
  /** What the farmer said of a loan: for the plan, and for that one answer. */
  loan_due_in_days?: number | undefined;
};

const storageQuery = (q: StorageAsk): Query => ({
  crop: q.crop,
  district: q.district,
  state: q.state,
  quantity_q: q.quantity_q,
  taluka: q.taluka,
  lang: q.lang,
});

/**
 * GET /storage/verdict: store or sell now, and the nearest public warehouses by name (contract section 21); only its
 * declared parameters are sent, and an answer is kept for a while, like the transport card's.
 */
export async function storageVerdict(q: StorageAsk): Promise<AiaicResult<StorageVerdict>> {
  const query = storageQuery(q);
  return keptTransport(`storage:${JSON.stringify(query)}`, () =>
    call<StorageVerdict>({ path: "/storage/verdict", query, as: "person" }),
  );
}

/**
 * GET /storage/plan: the storage page's whole answer, the verdict card with the key tiles, the prices by month and by year,
 * the wastage and the cold stores around it (contract section 33). The same boxes as the card, kept the same way: its
 * road distances are the same paid routes. What she said of a loan is used for this answer only, as the page tells her: an answer
 * read with one is not kept here, even for a while.
 */
export async function storagePlan(q: StorageAsk): Promise<AiaicResult<StoragePlan>> {
  const query = storageQuery(q);
  if (q.loan_due_in_days)
    return call<StoragePlan>({
      path: "/storage/plan",
      query: { ...query, loan_due_in_days: q.loan_due_in_days },
      as: "person",
    });
  return keptTransport(`storage-plan:${JSON.stringify(query)}`, () =>
    call<StoragePlan>({ path: "/storage/plan", query, as: "person" }),
  );
}

const NEARBY_KEYS = [
  "mandi",
  "state",
  "district_key",
  "straight_km",
  "road_km_estimate",
  "lat",
  "lon",
] as const;

/**
 * GET /transport/nearby-mandis, kept to what the transport card shows: each mandi's key, place and distance, and its
 * names in Marathi and Hindi when AIAIC sends them (contract section 20; a server not yet updated sends none and the
 * card says the label, as before), and every credit.
 */
export function nearbyForBrowser(raw: unknown): NearbyMandis {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mandis = Array.isArray(r["mandis"]) ? r["mandis"] : [];
  return {
    mandis: mandis.map((m) => {
      const row = pick<NearbyMandis["mandis"][number]>(m, NEARBY_KEYS);
      const names = namesOf((m as Record<string, unknown> | null)?.["names"]);
      return names ? { ...row, names } : row;
    }),
    attribution: Array.isArray(r["attribution"])
      ? (r["attribution"] as NearbyMandis["attribution"])
      : [],
  };
}

export async function nearbyMandis(q: {
  district: string;
  state: string;
  limit: number;
  taluka?: string | undefined;
}): Promise<AiaicResult<NearbyMandis>> {
  const query: Query = { district: q.district, state: q.state, limit: q.limit, taluka: q.taluka };
  return keptTransport(`nearby:${JSON.stringify(query)}`, async () => {
    const r = await call<Record<string, unknown>>({
      path: "/transport/nearby-mandis",
      query,
      as: "none",
    });
    if (!r.ok) return r;
    return { ok: true as const, data: nearbyForBrowser(r.data) };
  });
}

// ------------------------------------------------------------------------- 28 Oct 2026: talukas, her offer, her money
const TALUKA_KEYS = ["taluka", "taluka_key", "names", "placed", "located_by"] as const;

/** GET /transport/talukas: the talukas of her district, each named in every language. A place list: no sign-in. */
export async function tripTalukas(q: {
  state: string;
  district: string;
}): Promise<AiaicResult<{ talukas: TalukaRow[]; count: number }>> {
  const r = await call<Record<string, unknown>>({
    path: "/transport/talukas",
    query: { state: q.state, district: q.district },
    as: "none",
  });
  if (!r.ok) return r;
  const rows = Array.isArray(r.data["talukas"]) ? (r.data["talukas"] as unknown[]) : [];
  return {
    ok: true,
    data: { talukas: rows.map((x) => pick<TalukaRow>(x, TALUKA_KEYS)), count: rows.length },
  };
}

const CMP_OFFER_KEYS = [
  "price_per_q",
  "terms_code",
  "commission_per_q",
  "commission",
  "net_per_q",
] as const;
const CMP_TRIP_KEYS = [
  "measured",
  "least_counted",
  "km",
  "method",
  "alone_per_q",
  "shared_per_q",
] as const;
const CMP_MANDI_KEYS = [
  "mandi",
  "names",
  "modal_per_q",
  "price_day",
  "net_per_q",
  "net_per_q_shared",
] as const;
const CMP_GAP_KEYS = ["per_q", "total", "for_her"] as const;

/** GET /farmer/trade/offers/{id}/compare: HER offer weighed against the mandi after her trip (her own offer only). */
export async function compareOffer(offerId: string): Promise<AiaicResult<OfferCompare>> {
  if (!herSession()) return { ok: false, problem: problem("sign_in_to_sell") };
  const r = await call<Record<string, unknown>>({
    path: `/farmer/trade/offers/${encodeURIComponent(offerId)}/compare`,
    as: "trade",
  });
  if (!r.ok) return r;
  const d = r.data;
  const rawOffer = (d["offer"] && typeof d["offer"] === "object" ? d["offer"] : {}) as Record<
    string,
    unknown
  >;
  const offer = pick<Record<string, unknown>>(rawOffer, CMP_OFFER_KEYS);
  offer["trip"] = pick(rawOffer["trip"], CMP_TRIP_KEYS);
  const mandis = Array.isArray(d["mandis"])
    ? (d["mandis"] as unknown[]).map((m) => {
        const row = pick<Record<string, unknown>>(m, CMP_MANDI_KEYS);
        // whether her trip there is only the least a trip costs (not measured from her farm)
        const trip = (m as Record<string, unknown>)["trip"];
        row["trip"] =
          trip && typeof trip === "object" ? pick(trip, ["least_counted", "km"] as const) : null;
        return row;
      })
    : [];
  const gap = d["gap"] && typeof d["gap"] === "object" ? pick(d["gap"], CMP_GAP_KEYS) : null;
  const gapShared =
    d["gap_if_shared"] && typeof d["gap_if_shared"] === "object"
      ? pick(d["gap_if_shared"], CMP_GAP_KEYS)
      : null;
  const saved =
    d["trip_saved"] && typeof d["trip_saved"] === "object"
      ? pick(d["trip_saved"], ["km_one_way", "least_counted"] as const)
      : null;
  return {
    ok: true,
    data: {
      verdict: String(d["verdict"] ?? ""),
      gap,
      gap_if_shared: gapShared,
      quantity_q: typeof d["quantity_q"] === "number" ? d["quantity_q"] : null,
      verdict_if_shared: typeof d["verdict_if_shared"] === "string" ? d["verdict_if_shared"] : null,
      assumes: typeof d["assumes"] === "string" ? d["assumes"] : null,
      offer,
      mandis,
      best_mandi: typeof d["best_mandi"] === "string" ? d["best_mandi"] : null,
      price_day: typeof d["price_day"] === "string" ? d["price_day"] : null,
      price_age_days: typeof d["price_age_days"] === "number" ? d["price_age_days"] : null,
      trip_saved: saved,
    } as unknown as OfferCompare,
  };
}

/** POST /farmer/trade/payout-destination: where AIAIC sends HER money, by her own press. Her details go to AIAIC once,
 * over this server's own call; nothing of them is kept here or sent back to the browser but the masked hint. */
export async function giveDestination(
  key: string,
  d: {
    kind: "upi_id" | "bank_account";
    upi_id?: string | undefined;
    name?: string | undefined;
    account_number?: string | undefined;
    ifsc?: string | undefined;
    agreed: boolean;
    replace?: boolean | undefined;
    notice_version: string;
    read_in: "en" | "mr" | "hi";
  },
): Promise<AiaicResult<{ destination: XDestination | null }>> {
  if (!herSession()) return { ok: false, problem: problem("sign_in_to_sell") };
  // her consent as she gave it (PRIVACY-03): the notice's version she was shown and its language
  const body: Record<string, unknown> = {
    kind: d.kind,
    agreed: d.agreed === true,
    replace: d.replace === true,
    notice_version: d.notice_version,
    read_in: d.read_in,
  };
  if (d.kind === "upi_id") body["upi_id"] = d.upi_id;
  else Object.assign(body, { name: d.name, account_number: d.account_number, ifsc: d.ifsc });
  const r = await write<Record<string, unknown>>("/farmer/trade/payout-destination", key, body);
  if (!r.ok) return r;
  const dest = r.data["destination"];
  return {
    ok: true,
    data: {
      destination: dest && typeof dest === "object" ? pick<XDestination>(dest, X_DEST_KEYS) : null,
    },
  };
}

/** POST /farmer/trade/payout-destination/end: she removes her UPI ID or bank account by her own press (audit of 28 Oct
 * 2026, PRIVACY-04); AIAIC asks the payments provider that holds them (since 4 Nov 2026 Cashfree) to delete them.
 * `closure`: `done` once the provider said so, else `to_be_asked` (a person finishes it). `provider`: the provider's
 * name as AIAIC gives it on the ended destination (a name, never an id), or null. */
export async function endDestination(
  key: string,
): Promise<AiaicResult<{ closure: string | null; provider: string | null }>> {
  if (!herSession()) return { ok: false, problem: problem("sign_in_to_sell") };
  const r = await write<Record<string, unknown>>("/farmer/trade/payout-destination/end", key, {});
  if (!r.ok) return r;
  const closure = r.data["closure"];
  const dest = r.data["destination"];
  const provider =
    dest && typeof dest === "object" ? (dest as Record<string, unknown>)["provider"] : null;
  return {
    ok: true,
    data: {
      closure: typeof closure === "string" ? closure : null,
      provider: typeof provider === "string" ? provider : null,
    },
  };
}

// -------------------------------------------------------------- what buyers see of her, and her one choice (Round 2)

/**
 * HER SHARING AS HER SCREEN READS IT (Round 2, R2-3; AIAIC's routes 4 and 5, contract 17n): field by field, strings and
 * booleans only (the answer's workspace, its trace and every later field AIAIC may add stay here). `held_as` is what a
 * buyer would read of her (her own name as her AIAIC account holds it, or a practice name): shown to her only, on her
 * own card, as her account chip shows her name.
 */
export function sharingForBrowser(raw: unknown): MySharing {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const text = (v: unknown) => (typeof v === "string" && v ? v : null);
  const fields = (Array.isArray(r["fields"]) ? r["fields"] : [])
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .filter((f) => typeof f["field"] === "string")
    .map((f) => ({
      field: String(f["field"]),
      offered: f["offered"] === true,
      why_not: text(f["why_not"]),
      held_as: text(f["held_as"]),
      shared: f["shared"] === true,
      since: text(f["since"]),
      version_given: text(f["version_given"]),
    }));
  return {
    practice: r["practice"] === true,
    real_names_open: r["real_names_open"] === true,
    notice: noticeOf(r["notice"]),
    fields,
    buyers_see_now: (Array.isArray(r["buyers_see_now"]) ? r["buyers_see_now"] : []).filter(
      (c): c is string => typeof c === "string",
    ),
  };
}

/** GET /farmer/trade/sharing with HER OWN token: what buyers see of her, and her one choice (her name). */
export async function mySharing(): Promise<AiaicResult<MySharing>> {
  if (!herSession()) return { ok: false, problem: problem("sign_in_to_sell") };
  const r = await call<unknown>({ path: "/farmer/trade/sharing", as: "trade" });
  if (!r.ok) return r;
  return { ok: true, data: sharingForBrowser(r.data) };
}

/**
 * HER ONE PRESS (POST /farmer/trade/sharing, her own token, one key a press): her yes for one field with the version of
 * the notice she was shown and the language it was shown in, or her stop, which asks no version (stopping is as easy as
 * giving). Only AIAIC's answer says it is on or off.
 */
export async function shareMyField(
  key: string,
  body: {
    field: "name";
    share: boolean;
    notice_version?: string | undefined;
    shown_in?: string | undefined;
  },
): Promise<AiaicResult<ShareAnswer>> {
  const refused = await practiceFirst();
  if (refused) return { ok: false, problem: refused };
  const r = await call<Record<string, unknown>>({
    path: "/farmer/trade/sharing",
    method: "POST",
    body,
    key,
    as: "trade",
  });
  if (!r.ok) return r;
  const a = r.data && typeof r.data === "object" ? r.data : {};
  const text = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    ok: true,
    data: {
      shared: a["shared"] === true,
      since: text(a["since"]),
      ended_at: text(a["ended_at"]),
      notice_version: text(a["notice_version"]),
      unchanged: a["unchanged"] === true,
    },
  };
}
