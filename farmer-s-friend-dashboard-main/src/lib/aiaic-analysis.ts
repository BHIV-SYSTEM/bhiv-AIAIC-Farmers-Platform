/**
 * AIAIC's analysis beside Get my advice, ported from AIAIC's own farmer app (aiaic-frontend/src/kit):
 *
 * - what AIAIC holds about her crop in her district (`GET /places/crop-signals`; kit/CropSignals.jsx): the crop's price
 *   against its usual range, its MSP, what storing it did in past years, its bad years, its water need, its season, its
 *   area and yield, how widely the district's mandis trade it, each with whose figure it is, its source and its date, or
 *   said as not held;
 * - the mandis AIAIC's market answer compared (`summary.price_compare` on the farmer card; kit/PriceCompare.jsx);
 * - the district's stored prices as a line inside the usual range (`GET /places/price-series`; kit/PriceBrief.jsx and
 *   kit/charts/LineBandChart.jsx).
 *
 * Shared by the server functions and the screens, and reaching AIAIC from neither. Every sentence is AIAIC's, in her
 * language: nothing is composed here, no figure is drawn without the source and the date AIAIC sent with it, and what
 * AIAIC does not hold is said as not held. Information beside the answers, never a decision.
 */

import type { Service } from "./aiaic-types";

export type Estate = "mh" | "mp";

/** The state as AIAIC's routes read it (`mh` or `mp`), from the farm's own `state`. */
export function estateOf(state: string | null | undefined): Estate {
  const s = (state ?? "").toLowerCase();
  return s === "mp" || s.includes("madhya") ? "mp" : "mh";
}

const named = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const textOf = (v: unknown): string | null => (named(v) ? v.trim() : null);
const recordOf = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

// ------------------------------------------------------------------------------------------- the crop's own facts

/** One fact AIAIC holds (or does not hold) about the crop in the district. */
export type SignalItem = {
  key: string;
  held: boolean;
  /** "caution" only where AIAIC's own rule says so; never "good". */
  tone: "caution" | "info";
  /** AIAIC's sentence, in her language. */
  sentence: string;
  /** Whose figure it is ("this district", "the whole state", "the crop"), in her language. */
  grain_text: string | null;
  source: string | null;
  as_of: string | null;
};

export type CropSignals = {
  district: string;
  crop_name: string;
  /** The first two held items, AIAIC's key indications (shown first on the results page). */
  key_indications: string[];
  items: SignalItem[];
  /** AIAIC's one line on what this is ("None of it is advice"), in her language. */
  note: string | null;
};

export type CropSignalsAnswer =
  | { kind: "held"; signals: CropSignals }
  /** AIAIC's list for the district does not hold the crop (or the district): said plainly, never as a failure. */
  | { kind: "not_offered" }
  /** AIAIC answered its crisis card first (it reads every box for distress): nothing is shown here. */
  | { kind: "distress" }
  | { kind: "failed"; why: "timeout" | "part" };

/** One item of AIAIC's answer, or null when it carries no sentence. */
export function signalItemOf(raw: unknown): SignalItem | null {
  const r = recordOf(raw);
  const key = textOf(r?.["key"]);
  const sentence = textOf(r?.["sentence"]);
  if (!r || !key || !sentence) return null;
  const held = r["held"] === true;
  return {
    key,
    held,
    tone: held && r["tone"] === "caution" ? "caution" : "info",
    sentence,
    grain_text: held ? textOf(r["grain_text"]) : null,
    source: held ? textOf(r["source"]) : null,
    as_of: held ? textOf(r["as_of"]) : null,
  };
}

/** A held fact is drawn only with its source (a claim with nothing behind it is not drawn); a fact not held is said. */
export function drawable(item: SignalItem): boolean {
  return item.held ? named(item.source) : true;
}

/** Which facts each answer's page leads with: the crop's own facts that bear on that service (AIAIC's FOR_SERVICE). */
export const FOR_SERVICE: Record<Service, readonly string[]> = {
  market: ["price_position", "msp", "trade", "bad_years"],
  storage: ["storing", "price_position", "msp"],
  water: ["water_need", "water_plan", "season"],
  weather: ["season", "water_need"],
  crop: ["area_yield", "season", "water_need", "trade"],
};

/**
 * Which facts lead and which wait behind "More about this crop" (AIAIC's CropSignals rule). On an answer's page
 * (`only`): that service's facts in that order, its first two HELD ones leading; on the results page: AIAIC's own key
 * indications. `pin`: facts that lead whether held or not (the results page pins the price line when no market answer
 * was given, so "why no prices" is said in AIAIC's words). Nothing is dropped: the rest wait behind the button.
 */
export function signalLayout(
  signals: CropSignals,
  only: readonly string[] | null,
  pin: readonly string[] = [],
): { first: SignalItem[]; rest: SignalItem[] } {
  const shown = signals.items.filter(drawable);
  const find = (k: string) => shown.find((i) => i.key === k);
  const pool = only ? only.map(find).filter((i): i is SignalItem => Boolean(i)) : shown;
  const own = only
    ? pool
        .filter((i) => i.held)
        .slice(0, 2)
        .map((i) => i.key)
    : signals.key_indications;
  const pinned = pin.filter((k) => shown.some((i) => i.key === k));
  const lead = [...pinned, ...own.filter((k) => !pinned.includes(k))];
  const keys = new Set(lead);
  const first = lead.map(find).filter((i): i is SignalItem => Boolean(i));
  const rest = shown.filter((i) => !keys.has(i.key));
  return { first, rest };
}

// ------------------------------------------------------------------------------ the mandis the answer compared

export type PriceCompareRole = "chosen" | "compared" | "other_day" | "beyond_reach";

export type PriceCompareRow = {
  mandi: string;
  /** The mandi as her language says it, where AIAIC sends one. */
  mandi_shown: string | null;
  price: number;
  km_text: string | null;
  day: string | null;
  role: PriceCompareRole;
  badge: string | null;
};

/** AIAIC's `summary.price_compare`: built once by AIAIC from its answer's own table; drawn as it is. */
export type PriceCompare = {
  unit_text: string;
  basis: "gross" | "net";
  headline: string | null;
  compare: string | null;
  note: string | null;
  rows: PriceCompareRow[];
};

const ROLES: readonly PriceCompareRole[] = ["chosen", "compared", "other_day", "beyond_reach"];

/** The comparison AIAIC sent, or null when there is none (or nothing usable in it): AIAIC's `priceCompareOf`. */
export function priceCompareOf(raw: unknown): PriceCompare | null {
  const pc = recordOf(raw);
  if (!pc) return null;
  const rows: PriceCompareRow[] = [];
  for (const one of Array.isArray(pc["rows"]) ? pc["rows"] : []) {
    const r = recordOf(one);
    const price = r?.["price"];
    const mandi = textOf(r?.["mandi"]);
    if (!r || !mandi || typeof price !== "number" || !Number.isFinite(price) || price <= 0)
      continue;
    const role = ROLES.find((x) => x === r["role"]) ?? "compared";
    rows.push({
      mandi,
      mandi_shown: textOf(r["mandi_shown"]),
      price,
      km_text: textOf(r["km_text"]),
      day: textOf(r["day"]),
      role,
      badge: textOf(r["badge"]),
    });
  }
  if (!rows.length) return null;
  return {
    unit_text: textOf(pc["unit_text"]) ?? "/q",
    basis: pc["basis"] === "net" ? "net" : "gross",
    headline: textOf(pc["headline"]),
    compare: textOf(pc["compare"]),
    note: textOf(pc["note"]),
    rows,
  };
}

/** The first source an AIAIC summary names (`sections[id=sources].items[0]`), or null. */
export type SummarySource = {
  source_id: string | null;
  text: string | null;
  observed_on: string | null;
};

export function summarySourceOf(sections: unknown): SummarySource | null {
  if (!Array.isArray(sections)) return null;
  const block = sections.map(recordOf).find((s) => s?.["id"] === "sources");
  const items = block?.["items"];
  const first = Array.isArray(items) ? recordOf(items[0]) : null;
  if (!first) return null;
  const data = recordOf(first["data"]);
  const out = {
    source_id: textOf(data?.["source_id"]),
    text: textOf(first["text"]),
    observed_on: textOf(data?.["observed_on"]),
  };
  return out.source_id || out.text ? out : null;
}

// ------------------------------------------------------------------- the district's prices, a line in its band

export type DayPrice = { day: string; median: number | null };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The route's points (days with a price) spread over every calendar day of the window, a gap as `median: null`. */
export function everyDay(
  points: readonly { day: string; median: number }[],
  from: string,
  to: string,
): DayPrice[] {
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) {
    return points.map((p) => ({ day: p.day, median: p.median }));
  }
  const held = new Map(points.map((p) => [p.day, p.median]));
  const out: DayPrice[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  // at most 400 days: AIAIC's window is 7 to 90 days
  while (d <= end && out.length < 400) {
    const iso = d.toISOString().slice(0, 10);
    const median = held.get(iso);
    out.push({ day: iso, median: typeof median === "number" ? median : null });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const CHART = { W: 320, H: 140, PAD: { l: 60, r: 10, t: 12, b: 26 } } as const;

/** The drawing's scale and its runs of days with a price (a day with no price breaks the line), or null. */
export function chartGeometry(
  points: readonly DayPrice[],
  band: { p25: number; p75: number } | null,
) {
  const { W, H, PAD } = CHART;
  const values = points.flatMap((p) => (typeof p.median === "number" ? [p.median] : []));
  if (band) values.push(band.p25, band.p75);
  if (!values.length || points.length < 2) return null;
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (points.length - 1);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (typeof p.median === "number") run.push({ x: x(i), y: y(p.median) });
    else {
      if (run.length) runs.push(run);
      run = [];
    }
  });
  if (run.length) runs.push(run);
  return { lo, hi, x, y, runs };
}

// ------------------------------------------------------------------------------------------------- shared words

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A calendar day AIAIC sent as ISO, in Latin digits: "24 Sep 2026" in English, "24/9/2026" otherwise (AIAIC's
 *  `dateLabel`); anything else is said as AIAIC sent it. */
export function dayLabel(value: string | null | undefined, lang: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value ?? "";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return lang === "en" ? `${d} ${MONTH[m - 1] ?? m} ${y}` : `${d}/${m}/${y}`;
}

/** A fact's date: an ISO day as her apps write one, a period ("2016-17", "2004-2024") as AIAIC sent it. */
export function asOfLabel(value: string | null | undefined, lang: string): string {
  return value && ISO_DAY.test(value) ? dayLabel(value, lang) : (value ?? "");
}

/** Rupees in whole numbers, as AIAIC's charts and comparison write them. */
export const rupeesWhole = (v: number): string => `₹${Math.round(v).toLocaleString("en-IN")}`;
