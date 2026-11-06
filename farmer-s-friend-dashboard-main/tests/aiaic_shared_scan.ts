/**
 * WHAT THE TRADE SUITE AND THE PAYOUT FORMS' DOM SUITE SHARE, ONE COPY EACH (moved here as they were, `export` added,
 * from tests/aiaic_trade_integration_suite.ts on 5 Nov 2026, the re-check's round 4): AIAIC's own crisis phrases,
 * Cashfree's public test bank, and this app's server functions run in this process, the REAL `scanFirst` among them;
 * and (6 Nov 2026) AIAIC's recorded answers to the transport card's reads, as its server functions return them
 * (`recordedTrip`). Nothing here is a suite of its own, and nothing here leaves this machine: a server function's
 * handler runs only as a suite asks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runWithStartContext } from "@tanstack/start-storage-context";

import type { AccountOutcome } from "../src/lib/aiaic-account";
import { scanFirst } from "../src/lib/aiaic-account.functions";
import type { AskTheScan } from "../src/lib/aiaic-scan";
import { nearbyForBrowser } from "../src/lib/aiaic-trade.server";

/** AIAIC's own crisis phrases, COPIED from crisis tests that exist (a crisis test set needs people: none is written here).
 * Hindi and English: CRISIS_HI and CRISIS_EN of AIAIC's engine/tests/test_every_route_reads_its_own_boxes_behind_the_middleware.py;
 * Marathi: AIAIC's engine/tests/test_farmer_distress_path.py, also this app's tests/aiaic_storage_suite.ts (S46). */
export const CRISIS_HI = "मुझे मरना है";
export const CRISIS_EN = "I want to die";
export const CRISIS_MR = "मी आत्महत्या करणार";
/** Cashfree's public test account and IFSC (its data-to-test page, as B20): a stand-in, never a person's. */
export const TEST_BANK = { account: "026291800001191", ifsc: "YESB0000262" };

/**
 * ONE OF THIS APP'S SERVER FUNCTIONS, RUN IN THIS PROCESS AS A PAGE CALLS IT (the re-check of 4 Nov 2026, RC2-1): Start's
 * RPC round trip, which only the Vite plugin builds, is stood in for by one function middleware (`runWithStartContext`
 * hands it to the function as Start's own options do) that runs the function's OWN validator on what the page sends,
 * then its OWN handler (a server function run without the plugin keeps its handler as `extractedFn`). Nothing of the
 * function is copied or replaced. `"validator"`: only what its validator lets through, and its handler is never run.
 */
export async function inProcess(
  fn: unknown,
  data: unknown,
  run: "validator" | "handler" = "handler",
) {
  const rpc = {
    options: {
      client: async (ctx: Record<string, unknown>) => {
        const validator = ctx["inputValidator"];
        const handler = ctx["extractedFn"];
        assert.ok(
          typeof validator === "function" && typeof handler === "function",
          "the server function's own validator and handler",
        );
        const valid = (validator as (d: unknown) => unknown)(ctx["data"]);
        const result =
          run === "validator"
            ? valid
            : await (handler as (p: unknown) => Promise<unknown>)({ data: valid, context: {} });
        return { ...ctx, result };
      },
    },
  };
  return runWithStartContext({ startOptions: { functionMiddleware: [rpc] } } as never, () =>
    (fn as (opts: { data: unknown }) => Promise<unknown>)({ data }),
  );
}

/** The scan as every page asks it (`useServerFn(scanFirst)` in the shared hook, and the address check): the REAL
 * `scanFirst` server function of aiaic-account.functions.ts, its validator and its handler, in this process. */
export const askScanFirst: AskTheScan = async ({ data }) =>
  (await inProcess(scanFirst, data)) as AccountOutcome;

// ------------------------------------ AIAIC's recorded trips (6 Nov 2026: the audit of bde7fa3, F2 and N7)

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "aiaic");
const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf-8")) as Record<
    string,
    unknown
  >;

/** The transport card's three reads, by the server function each asks (places.functions.ts and
 * aiaic-trade.functions.ts): `getPlacesDistricts`, `getNearbyMandis` and `getTransportEstimate`. */
export type TripRead = "districts" | "nearby" | "estimate";

/** The recordings a test reads (tests/fixtures/aiaic, by name; real answers, never edited by hand). A nearby list, or the
 * districts of the asked state and language, may be a parsed copy of a recording, changed in memory by the test, which
 * says so. */
export type TripRecordings = {
  districts?: unknown[];
  nearby?: (string | { from: string; answer: unknown })[];
  estimates?: string[];
};

/** One of AIAIC's two states, however a request or a recording writes it ("mp", "madhya pradesh"). */
const stateOf = (s: unknown): string => {
  const v = String(s ?? "")
    .trim()
    .toLowerCase();
  if (v === "mp" || v.includes("madhya")) return "mp";
  if (v === "mh" || v.includes("maharashtra")) return "mh";
  return v;
};
const params = (rec: Record<string, unknown>) =>
  ((rec["_recorded"] as { request?: { params?: Record<string, unknown> } } | undefined)?.request
    ?.params ?? {}) as Record<string, unknown>;

/**
 * AIAIC'S OWN RECORDED ANSWER TO WHAT A PAGE SENT, as this app's server function returns it to the page, or null when no
 * recording answers it (never stood in for: the suite says so, and its test fails):
 * - districts (GET /places/districts): AIAIC's recorded lists, Maharashtra's in English (`places_districts_mh_en`, in
 *   its `_recorded` envelope) and Madhya Pradesh's in en, mr and hi (`places_districts_mp_<lang>`, AIAIC's answers as
 *   its recorder keeps them, with no envelope);
 * - nearby (GET /transport/nearby-mandis): a recording asked for the same district and state, through this server's own
 *   reading of it (`nearbyForBrowser`). One asked for another number of mandis (W2 asked for 12 of the same state; the
 *   card asks for 15, or 40 when an answer names a mandi) is AIAIC's real list for that district all the same;
 * - estimate (GET /transport/estimate): a recording asked for the same trip: the same mandi, quantity, district and
 *   state, the same mandi state and district (C10's AIAIC-05 at AIAIC 4ed3229: one name can be two towns, each found by
 *   its own district), from her farm and from no taluka.
 */
export function recordedTrip(
  read: TripRead,
  sent: Record<string, unknown>,
  recordings: TripRecordings,
): unknown {
  if (read === "districts") {
    const state = stateOf(sent["state"]);
    const lang = String(sent["lang"] ?? "en");
    if (recordings.districts) return { ok: true, districts: recordings.districts };
    if (state === "mh" && lang === "en") {
      const rec = fixture("places_districts_mh_en")["answer"] as { districts: unknown[] };
      return { ok: true, districts: rec.districts };
    }
    if (state === "mp" && ["en", "mr", "hi"].includes(lang)) {
      const rec = fixture(`places_districts_mp_${lang}`) as { districts: unknown[] };
      return { ok: true, districts: rec.districts };
    }
    return null;
  }
  if (read === "nearby") {
    for (const one of recordings.nearby ?? []) {
      const name = typeof one === "string" ? one : one.from;
      const rec = fixture(name);
      const p = params(rec);
      if (
        String(p["district"]).toLowerCase() !== String(sent["district"]).toLowerCase() ||
        stateOf(p["state"]) !== stateOf(sent["state"]) ||
        (p["taluka"] ?? null) !== (sent["taluka"] ?? null)
      )
        continue;
      return {
        ok: true,
        data: nearbyForBrowser(typeof one === "string" ? rec["answer"] : one.answer),
      };
    }
    return null;
  }
  for (const name of recordings.estimates ?? []) {
    const rec = fixture(name);
    const p = params(rec);
    const same =
      String(p["mandi"]) === String(sent["mandi"]) &&
      Number(p["quantity_q"]) === Number(sent["quantity_q"]) &&
      String(p["district"]).toLowerCase() === String(sent["district"]).toLowerCase() &&
      stateOf(p["state"]) === stateOf(sent["state"]) &&
      (p["mandi_state"] === undefined
        ? sent["mandi_state"] === undefined
        : stateOf(p["mandi_state"]) === stateOf(sent["mandi_state"])) &&
      (p["mandi_district"] ?? null) === (sent["mandi_district"] ?? null) &&
      String(p["from_place"] ?? "farm") === String(sent["from_place"] ?? "farm") &&
      (p["taluka"] ?? null) === (sent["taluka"] ?? null);
    const status = (rec["_recorded"] as { status?: number } | undefined)?.status;
    if (same && status === 200) return { ok: true, data: rec["answer"] };
  }
  return null;
}
