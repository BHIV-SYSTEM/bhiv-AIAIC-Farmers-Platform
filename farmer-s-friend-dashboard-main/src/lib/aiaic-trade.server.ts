/**
 * AIAIC's sale, payment and transport routes, called from THIS SERVER only.
 *
 * - Her sale (`/farmer/trade/*`, AIAIC's contract sections 17b and 17d) is read and written as ONE AIAIC farmer
 *   account, signed in from the server settings AIAIC_FARMER_USERNAME and AIAIC_FARMER_PASSWORD (read here by name;
 *   never logged, never sent to the browser). The token AIAIC gives is kept in this process's memory until shortly
 *   before it expires, and asked for again once when AIAIC says it is no longer valid.
 * - This app has no sign-in of its own: everyone who opens it acts as that one account. So it may be only AIAIC's
 *   PRACTICE farmer (her records are rehearsal data and no real money moves); a real farmer's account is refused before
 *   anything of hers is shown or written (`aiaic_account_not_practice`).
 * - The password crosses the network only over https, or to an address on this machine or its private network
 *   (`aiaic_sign_in_needs_https` otherwise).
 * - Transport (`/transport/*`, section 19) needs no sign-in: it is a public read, kept here for 30 minutes so the
 *   road routes AIAIC asks Geoapify for are not spent twice on the same trip.
 * - Nothing here falls back to the local store: when AIAIC is set up and does not answer, that is SAID.
 */
import { AIAIC_HEADERS, isTunnelErrorBody, resolveBaseUrl } from "./aiaic-base.server";
import {
  problem,
  type AiaicCrisis,
  type AiaicMine,
  type Json,
  type AiaicProblem,
  type AiaicResult,
  type MineForScreen,
  type NearbyMandis,
  type ReferencePrice,
  type TradeMode,
  type TransportEstimate,
} from "./aiaic-trade";

export const USERNAME_ENV = "AIAIC_FARMER_USERNAME";
export const PASSWORD_ENV = "AIAIC_FARMER_PASSWORD";

const SIGN_IN_TIMEOUT_MS = 15_000;
const CALL_TIMEOUT_MS = 20_000;
/** A sign-in AIAIC refused is not tried again for this long (AIAIC locks an address out after repeated failures). */
const REFUSED_PAUSE_MS = 5 * 60_000;
/** A token is used until this long before AIAIC's own expiry. */
const TOKEN_MARGIN_MS = 5 * 60_000;
/** Whether the account is a practice one is read again after this long. */
const PRACTICE_RECHECK_MS = 10 * 60_000;
const TRANSPORT_KEEP_MS = 30 * 60_000;
const NAMES_KEEP_MS = 30 * 60_000;

function settingSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * True when a password may be sent to this address: https anywhere; plain http only to this machine, its private
 * network (10/8, 172.16/12, 192.168/16), `host.docker.internal`, or a container's own name (no dot).
 */
export function signInAllowed(baseUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    return false;
  }
  if (u.protocol === "https:") return true;
  if (u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "host.docker.internal" || host === "::1") return true;
  if (!host.includes(".") && !host.includes(":")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Where this app's sales live, from the settings alone (no network): see `TradeMode`. */
export function tradeMode(): TradeMode {
  const hasUser = settingSet(USERNAME_ENV);
  const hasPassword = settingSet(PASSWORD_ENV);
  if (!hasUser && !hasPassword) return { mode: "local" };
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

// ------------------------------------------------------------------------------------------------ the session

type Session = { token: string; expiresAt: number };

let session: Session | null = null;
let signingIn: Promise<Session | AiaicProblem> | null = null;
let refusal: { problem: AiaicProblem; until: number } | null = null;
let practice: { is: boolean; at: number } | null = null;

/** For the tests only: forget the session, a refusal and the practice reading. */
export function resetForTests(): void {
  session = null;
  signingIn = null;
  refusal = null;
  practice = null;
  transportKept.clear();
  namesKept.clear();
}

function isProblem(x: Session | AiaicProblem): x is AiaicProblem {
  return (x as AiaicProblem).code !== undefined;
}

async function signIn(baseUrl: string): Promise<Session | AiaicProblem> {
  if (refusal && Date.now() < refusal.until) return refusal.problem;
  if (signingIn) return signingIn;
  signingIn = (async (): Promise<Session | AiaicProblem> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { ...AIAIC_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({
          username: (process.env[USERNAME_ENV] ?? "").trim(),
          password: process.env[PASSWORD_ENV] ?? "",
        }),
        signal: AbortSignal.timeout(SIGN_IN_TIMEOUT_MS),
      });
    } catch {
      return problem("aiaic_unavailable");
    }
    const text = await res.text();
    if (isTunnelErrorBody(text)) return problem("aiaic_unavailable", { status: res.status });
    const refuse = (code: string): AiaicProblem => {
      const p = problem(code, { status: res.status, setting: USERNAME_ENV });
      refusal = { problem: p, until: Date.now() + REFUSED_PAUSE_MS };
      return p;
    };
    if (res.status === 401 || res.status === 422) return refuse("aiaic_sign_in_refused");
    if (res.status === 429) return refuse("aiaic_sign_in_locked");
    if (!res.ok) return problem("aiaic_unavailable", { status: res.status });
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return problem("aiaic_answer_unreadable", { status: res.status });
    }
    const token = body["access_token"];
    if (typeof token !== "string" || !token) {
      // AIAIC's crisis card is answered to a username that reads as distress: it is not a sign-in.
      return problem("aiaic_answer_unreadable", { status: res.status });
    }
    if (body["role"] !== "farmer") return refuse("aiaic_account_not_a_farmer");
    const expires = Date.parse(String(body["expires_at"] ?? ""));
    const made: Session = {
      token,
      expiresAt: Number.isNaN(expires) ? Date.now() + 60 * 60_000 : expires,
    };
    session = made;
    refusal = null;
    return made;
  })().finally(() => {
    signingIn = null;
  });
  return signingIn;
}

async function currentSession(baseUrl: string): Promise<Session | AiaicProblem> {
  if (session && session.expiresAt - TOKEN_MARGIN_MS > Date.now()) return session;
  session = null;
  return signIn(baseUrl);
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
  auth: boolean;
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

/** AIAIC's refusal, as facts: `{detail: {reason_code, message, ...facts}}` (its contract), or a plain detail. */
export function refusalOf(status: number, body: unknown): AiaicProblem {
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
  if (opts.auth) {
    const mode = tradeMode();
    if (mode.mode !== "aiaic")
      return { ok: false, problem: problem("aiaic_setting_missing", { setting: USERNAME_ENV }) };
    if (mode.problem) return { ok: false, problem: mode.problem };
  }
  const url = new URL(`${baseUrl}${opts.path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = { ...AIAIC_HEADERS };
    if (opts.auth) {
      const s = await currentSession(baseUrl);
      if (isProblem(s)) return { ok: false, problem: s };
      headers["authorization"] = `Bearer ${s.token}`;
    }
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.key) headers["idempotency-key"] = opts.key;
    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? "GET",
        headers,
        ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, problem: problem("aiaic_unavailable") };
    }
    const text = await res.text();
    if (isTunnelErrorBody(text))
      return { ok: false, problem: problem("aiaic_unavailable", { status: res.status }) };
    if (res.status === 401 && opts.auth && attempt === 0) {
      // The token is no longer good (expired early, or AIAIC's signing key changed): sign in again, once. A 401 wrote
      // nothing, so the same press goes again with its same key.
      session = null;
      continue;
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
    if (!res.ok) return { ok: false, problem: refusalOf(res.status, json) };
    return { ok: true, data: json as T };
  }
  return { ok: false, problem: problem("aiaic_sign_in_refused", { setting: USERNAME_ENV }) };
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
] as const;
const LISTING_KEYS = [
  "listing_id",
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
  "settlement_state",
  "synthetic",
  "created_at",
  "updated_at",
  "buyer_name",
  "buyer_type",
  "buyer_district",
  "next_steps",
  "her_next_step",
] as const;
const STEP_KEYS = ["event_id", "stage", "status", "simulated", "created_at"] as const;
const PAYMENT_KEYS = [
  "state",
  "link_made",
  "not_onward",
  "refund_owed_inr",
  "refund_note",
] as const;
const MONEY_KEYS = [
  "route",
  "settlement_state",
  "timing",
  "say",
  "can_report",
  "why_not_report",
  "share_inr",
  "destination_kind",
  "destination_hint",
  "fee_on_top",
  "fee_line_key",
  "state",
  "utr",
  "settled_at",
  "held_until",
  "test_mode",
  "reports",
] as const;
const ACCOUNT_KEYS = [
  "payout_account_id",
  "status",
  "refused_code",
  "destination_kind",
  "destination_hint",
  "ready",
  "why_not_ready",
  "test_mode",
  "synthetic",
] as const;
const PAYOUT_KEYS = [
  "offered",
  "why_not_offered",
  "test_mode",
  "test_values_only",
  "say",
  "can_create",
  "can_withdraw",
] as const;

/**
 * Only what this app shows leaves the server: the answer is copied field by field (the contact path's blocks, ids of
 * other systems and every later field AIAIC may add stay here).
 */
export function mineForBrowser(raw: unknown): AiaicMine {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const listings = Array.isArray(r["listings"]) ? r["listings"] : [];
  const orders = Array.isArray(r["orders"]) ? r["orders"] : [];
  const party = r["party"] && typeof r["party"] === "object" ? r["party"] : null;
  const payout =
    r["payout_account"] && typeof r["payout_account"] === "object"
      ? (r["payout_account"] as Record<string, unknown>)
      : null;
  const notice =
    r["payout_notice"] && typeof r["payout_notice"] === "object"
      ? (r["payout_notice"] as Record<string, unknown>)
      : null;
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
      listing["offers"] = Array.isArray(offers) ? offers.map((o) => pick(o, OFFER_KEYS)) : [];
      return listing as unknown as AiaicMine["listings"][number];
    }),
    orders: orders.map((o) => {
      const src = o as Record<string, unknown>;
      const order = pick<Record<string, unknown>>(o, ORDER_KEYS);
      order["fulfilment"] = Array.isArray(src["fulfilment"])
        ? src["fulfilment"].map((s) => pick(s, STEP_KEYS))
        : [];
      order["payment"] = pick(src["payment"], PAYMENT_KEYS);
      if (src["money"] && typeof src["money"] === "object") {
        order["money"] = pick(src["money"], MONEY_KEYS);
      }
      return order as unknown as AiaicMine["orders"][number];
    }),
  };
  if (payout) {
    const block = pick<Record<string, unknown>>(payout, PAYOUT_KEYS);
    block["account"] =
      payout["account"] && typeof payout["account"] === "object"
        ? pick(payout["account"], ACCOUNT_KEYS)
        : null;
    mine.payout_account = block as unknown as NonNullable<AiaicMine["payout_account"]>;
  }
  if (notice && typeof notice["version"] === "string") {
    const lines = (k: string) =>
      Array.isArray(notice[k]) ? (notice[k] as unknown[]).map((x) => String(x)) : [];
    mine.payout_notice = {
      version: notice["version"],
      en: lines("en"),
      mr: lines("mr"),
      hi: lines("hi"),
    };
  }
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
      auth: false,
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
      auth: false,
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

// ------------------------------------------------------------------------------------------------ her sale

/** Notes whether the account is a practice one; a real farmer's account is refused (`aiaic_account_not_practice`). */
function notePractice(mine: AiaicMine): AiaicProblem | null {
  practice = { is: mine.practice, at: Date.now() };
  return mine.practice ? null : problem("aiaic_account_not_practice", { setting: USERNAME_ENV });
}

/** GET /farmer/trade, kept small, with the names of her crops and districts in her language. A real farmer's
 * account is refused here, before anything of hers leaves this server. */
export async function getMine(lang: string): Promise<AiaicResult<MineForScreen>> {
  const r = await call<unknown>({ path: "/farmer/trade", auth: true });
  if (!r.ok) return r;
  const mine = mineForBrowser(r.data);
  const refused = notePractice(mine);
  if (refused) return { ok: false, problem: refused };
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

/** Every write is made only for a practice account (read again every 10 minutes). */
async function practiceFirst(): Promise<AiaicProblem | null> {
  if (practice && Date.now() - practice.at < PRACTICE_RECHECK_MS) {
    return practice.is ? null : problem("aiaic_account_not_practice", { setting: USERNAME_ENV });
  }
  const r = await call<unknown>({ path: "/farmer/trade", auth: true });
  if (!r.ok) return r.problem;
  return notePractice(mineForBrowser(r.data));
}

export async function getPrice(q: {
  crop: string;
  state: string;
  district: string;
}): Promise<AiaicResult<ReferencePrice>> {
  const r = await call<unknown>({ path: "/farmer/trade/price", query: q, auth: true });
  if (!r.ok) return r;
  return { ok: true, data: pick<ReferencePrice>(r.data, REFERENCE_KEYS) };
}

async function write<T>(path: string, key: string, body: unknown): Promise<AiaicResult<T>> {
  const refused = await practiceFirst();
  if (refused) return { ok: false, problem: refused };
  return call<T>({ path, method: "POST", body, key, auth: true });
}

export type SellInput = {
  state: string;
  district: string;
  crop: string;
  quantity_q: number;
  ask_price_per_q?: number | undefined;
  grade?: string | null | undefined;
  price_confirmed?: boolean | undefined;
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

export type PayoutAccountInput = {
  notice_version: string;
  shown_in: "en" | "mr" | "hi";
  destination: "bank_account" | "upi_id";
  pan: string;
  name_on_pan: string;
  account_number?: string | undefined;
  ifsc?: string | undefined;
  upi_id?: string | undefined;
};

/**
 * Her payout details go to AIAIC, which sends them to Razorpay and keeps none of them: this server passes them on in
 * the request's memory only, never logs them, never keeps them, and says back only AIAIC's account state.
 */
export async function givePayoutAccount(
  key: string,
  d: PayoutAccountInput,
): Promise<AiaicResult<{ status: string | null }>> {
  const body: Record<string, unknown> = {
    notice_version: d.notice_version,
    shown_in: d.shown_in,
    agreed: true,
    destination: d.destination,
    pan: d.pan,
    name_on_pan: d.name_on_pan,
  };
  if (d.destination === "bank_account") {
    body["account_number"] = d.account_number ?? "";
    body["ifsc"] = d.ifsc ?? "";
  } else {
    body["upi_id"] = d.upi_id ?? "";
  }
  const r = await write<Record<string, unknown>>("/farmer/trade/payout-account", key, body);
  if (!r.ok) return r;
  const account = r.data["account"];
  const status =
    account && typeof account === "object"
      ? String((account as Record<string, unknown>)["status"] ?? "")
      : r.data["requesting"]
        ? "requesting"
        : null;
  return { ok: true, data: { status } };
}

export async function withdrawPayoutAccount(key: string): Promise<AiaicResult<true>> {
  const r = await write<unknown>("/farmer/trade/payout-account/withdraw", key, {});
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
    from_place: q.from_place,
  };
  return keptTransport(`estimate:${JSON.stringify(query)}`, () =>
    call<TransportEstimate>({ path: "/transport/estimate", query, auth: false }),
  );
}

export async function nearbyMandis(q: {
  district: string;
  state: string;
  limit: number;
}): Promise<AiaicResult<NearbyMandis>> {
  const query: Query = { district: q.district, state: q.state, limit: q.limit };
  return keptTransport(`nearby:${JSON.stringify(query)}`, async () => {
    const r = await call<Record<string, unknown>>({
      path: "/transport/nearby-mandis",
      query,
      auth: false,
    });
    if (!r.ok) return r;
    const mandis = Array.isArray(r.data["mandis"]) ? r.data["mandis"] : [];
    return {
      ok: true as const,
      data: {
        mandis: mandis.map((m) =>
          pick<NearbyMandis["mandis"][number]>(m, [
            "mandi",
            "state",
            "district_key",
            "straight_km",
            "road_km_estimate",
            "lat",
            "lon",
          ]),
        ),
        attribution: Array.isArray(r.data["attribution"])
          ? (r.data["attribution"] as NearbyMandis["attribution"])
          : [],
      },
    };
  });
}
