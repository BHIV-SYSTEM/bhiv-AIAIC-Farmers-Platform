/**
 * WHAT THE TRADE SUITE AND THE PAYOUT FORMS' DOM SUITE SHARE, ONE COPY EACH (moved here as they were, `export` added,
 * from tests/aiaic_trade_integration_suite.ts on 5 Nov 2026, the re-check's round 4): AIAIC's own crisis phrases,
 * Cashfree's public test bank, and this app's server functions run in this process, the REAL `scanFirst` among them.
 * Nothing here is a suite of its own, and nothing here leaves this machine: a server function's handler runs only as a
 * suite asks.
 */
import assert from "node:assert/strict";

import { runWithStartContext } from "@tanstack/start-storage-context";

import type { AccountOutcome } from "../src/lib/aiaic-account";
import { scanFirst } from "../src/lib/aiaic-account.functions";
import type { AskTheScan } from "../src/lib/aiaic-scan";

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
