/**
 * HER SERVER'S OWN CALLS, HELD (push 2b-2, lane AN, 27 Nov 2026: Annapoorna's half of the VM report of 23 Nov 2026 and
 * its verdict of 24 Nov). Run: `npx tsx tests/aiaic_server_calls_suite.ts` (AIAIC_TEST_JUNIT=<file.xml> also writes a
 * JUnit file), from farmer-s-friend-dashboard-main/.
 *
 * - AN1-AN4 (item 1): a built server never uses the app's demo store; without AIAIC's farmer settings it says it is not
 *   connected to AIAIC's sale service, in the page's language. "Development" is read from Vite's compile-time constants.
 *
 * Every server here is a stand-in on 127.0.0.1 started by this suite: no request leaves this machine, and no account,
 * token or password is a real one.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";

import { TradeSwitch } from "../src/components/farm/aiaic/AiaicBits";
import { problem, type TradeMode } from "../src/lib/aiaic-trade";
import * as client from "../src/lib/aiaic-trade.server";
import * as identity from "../src/lib/aiaic-identity.server";
import {
  DEMO_STORE_CLOSED,
  buildKind,
  demoStoreAllowed,
  demoStoreForTests,
} from "../src/lib/demo-store.server";
import * as store from "../src/lib/transactions.server";
import { DICTS } from "../src/lib/i18n";
import { I18nProvider } from "../src/lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(here, "..");
const LANGS = ["en", "mr", "hi"] as const;

// ------------------------------------------------------------------------------------------- the runner

type Result = { name: string; ok: boolean; ms: number; error?: string };
const results: Result[] = [];
const tests: { name: string; run: () => void | Promise<void> }[] = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

const escHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

/** A word of hers in a language, as the page draws it. */
const words = (lang: (typeof LANGS)[number], key: string) => {
  const w = DICTS[lang][key];
  assert.ok(typeof w === "string" && w.length > 0, `${key} [${lang}] is one of her words`);
  return w;
};

/** No English on a Marathi or Hindi screen: her words may name AIAIC, nothing else in Latin letters. */
function noEnglish(lang: "mr" | "hi", text: string, what: string) {
  const rest = text.replace(/AIAIC/g, "");
  assert.ok(!/[A-Za-z]/.test(rest), `${what} [${lang}] holds English: ${text}`);
}

const sha256 = (b: Buffer | null) => (b ? createHash("sha256").update(b).digest("hex") : "absent");
const readOrNull = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file) : null);

function withSettings<T>(user: string | null, password: string | null, run: () => T): T {
  const saved = {
    AIAIC_FARMER_USERNAME: process.env["AIAIC_FARMER_USERNAME"],
    AIAIC_FARMER_PASSWORD: process.env["AIAIC_FARMER_PASSWORD"],
  };
  const set = (k: string, v: string | null | undefined) => {
    if (v === null || v === undefined) delete process.env[k];
    else process.env[k] = v;
  };
  set("AIAIC_FARMER_USERNAME", user);
  set("AIAIC_FARMER_PASSWORD", password);
  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(saved)) set(k, v);
  }
}

const appRouter = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/listings"] }),
});

/** A trade page's switch rendered on the server as her app holds it, with the server's answer of where sales live
 *  already in the page's cache (as `getTradeMode` answers). */
function tradePage(
  answer: TradeMode,
  lang: (typeof LANGS)[number],
): { html: string; aiaic: number; local: number } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["aiaic-trade-mode"], answer);
  const drawn = { aiaic: 0, local: 0 };
  const el: ReactElement = createElement(TradeSwitch, {
    aiaic: () => {
      drawn.aiaic += 1;
      return createElement("p", null, "AIAIC SCREENS");
    },
    local: () => {
      drawn.local += 1;
      return createElement("p", null, "DEMO STORE PAGE");
    },
  });
  const html = renderToString(
    createElement(RouterContextProvider, {
      router: appRouter as never,
      children: createElement(QueryClientProvider, {
        client: qc,
        children: createElement(I18nProvider, { initialLang: lang, children: el }),
      }),
    }),
  ).replaceAll("<!-- -->", "");
  return { html, ...drawn };
}

// ======================================================================= item 1: no demo store in production

test("AN1 the demo store opens only on the development server: read from Vite's compile-time constants (DEV and MODE both), never from a setting; a built server without AIAIC's farmer settings answers 'not connected', and a signed-in farmer is unchanged", () => {
  // how the server was made, from Vite's own values (as `vite dev` and `vite build` write them)
  assert.equal(buildKind({ DEV: true, MODE: "development" }), "vite_dev", "vite dev");
  assert.equal(buildKind({ DEV: false, MODE: "production" }), "built", "vite build");
  assert.equal(
    buildKind({ DEV: true, MODE: "production" }),
    "built",
    "a build made with NODE_ENV=development alone",
  );
  assert.equal(
    buildKind({ DEV: false, MODE: "development" }),
    "built",
    "a build made with --mode development alone",
  );
  assert.equal(buildKind({ DEV: "true", MODE: "development" }), "built", "only the boolean true");
  assert.equal(buildKind(undefined), "source", "run from source without Vite");
  assert.equal(buildKind(), "source", "this suite runs from source");
  // a built server never; the development server always; from source only once a suite opens it
  assert.equal(demoStoreAllowed("vite_dev"), true);
  assert.equal(demoStoreAllowed("built"), false);
  assert.equal(demoStoreAllowed("source"), false, "closed until a suite opens it");
  demoStoreForTests(true);
  try {
    assert.equal(demoStoreAllowed("built"), false, "a suite's opening never opens a built server");
    assert.equal(demoStoreAllowed("source"), true);
  } finally {
    demoStoreForTests(false);
  }
  // a guest, no farmer setting: not connected outside development; the demo store only on the development server
  withSettings(null, null, () => {
    identity.sessionForTests(null);
    assert.deepEqual(client.tradeMode(), {
      mode: "aiaic",
      problem: problem("aiaic_not_connected"),
    });
    assert.deepEqual(client.tradeModeNow(), {
      mode: "aiaic",
      problem: problem("aiaic_not_connected"),
    });
    demoStoreForTests(true);
    try {
      assert.deepEqual(client.tradeMode(), { mode: "local" }, "the development server, as before");
    } finally {
      demoStoreForTests(false);
    }
    // a signed-in farmer: her sales are AIAIC's, whatever the settings say (unchanged)
    identity.sessionForTests({
      token: "standin-token-an1-000000",
      username: "standin_farmer",
      displayName: null,
      expiresAt: Date.now() + 60 * 60_000,
    });
    try {
      assert.deepEqual(client.tradeModeNow(), { mode: "aiaic", problem: null });
    } finally {
      identity.sessionForTests(null);
    }
  });
  // with both settings, as before: AIAIC (its own problems said, never the store)
  withSettings("standin_user", "standin_password", () => {
    const saved = process.env["AIAIC_BASE_URL"];
    process.env["AIAIC_BASE_URL"] = "https://aiaic.example.org/api";
    try {
      assert.deepEqual(client.tradeMode(), { mode: "aiaic", problem: null });
    } finally {
      if (saved === undefined) delete process.env["AIAIC_BASE_URL"];
      else process.env["AIAIC_BASE_URL"] = saved;
    }
  });
});

test("AN2 outside development every read and write of the demo store refuses before it touches anything: its file keeps its bytes, and nothing is kept in memory", async () => {
  const file = path.join(process.cwd(), "data", "transactions.json");
  const before = readOrNull(file);
  const calls: [string, () => Promise<unknown>][] = [
    ["getAllListings", () => store.getAllListings()],
    ["getListingById", () => store.getListingById("LST-20261019-01")],
    [
      "createProduceListing",
      () =>
        store.createProduceListing({
          crop: "Onion",
          quantityQuintals: 10,
          askingPricePerQuintal: 2000,
          district: "Nashik",
          pickupLocation: "Farm gate",
        } as Parameters<typeof store.createProduceListing>[0]),
    ],
    ["updateListingStatus", () => store.updateListingStatus("LST-20261019-01", "DELISTED")],
    ["getAllOrders", () => store.getAllOrders()],
    ["getOrderById", () => store.getOrderById("ORD-20261019-8421")],
    ["acceptProduceOrder", () => store.acceptProduceOrder("ORD-20261019-8421")],
    ["declineProduceOrder", () => store.declineProduceOrder("ORD-20261019-8421", "no")],
  ];
  for (const [name, call] of calls)
    await assert.rejects(call, { message: DEMO_STORE_CLOSED }, `${name} refuses`);
  assert.equal(sha256(readOrNull(file)), sha256(before), "the demo store's file keeps its bytes");
  // the server functions are its only door, and each goes through it
  const doors = fs.readFileSync(path.join(APP, "src", "lib", "transactions.functions.ts"), "utf8");
  const imports = [...doors.matchAll(/import\(\s*"([^"]+)"\s*\)|from\s+"([^"]+)"/g)].map(
    (m) => m[1] ?? m[2],
  );
  assert.deepEqual(
    [...new Set(imports)].sort(),
    ["./transaction-types", "./transactions.server", "@tanstack/react-start", "zod"].sort(),
    "the demo store's server functions reach nothing but the store",
  );
});

test("AN3 a selling page on a built server without the settings says 'not connected' where the demo store was, in English, Marathi and Hindi: never the demo store's page or its line; on the development server the demo store as before; with the settings, AIAIC's screens", () => {
  for (const lang of LANGS) {
    const off = tradePage({ mode: "aiaic", problem: problem("aiaic_not_connected") }, lang);
    const line = words(lang, "aiaic.problem.aiaic_not_connected");
    assert.ok(off.html.includes(escHtml(line)), `${lang}: the page says it is not connected`);
    assert.ok(off.html.includes('data-testid="aiaic-not-connected"'), `${lang}: in its place`);
    assert.equal(off.local, 0, `${lang}: the demo store's page is never drawn`);
    assert.equal(off.aiaic, 0, `${lang}: nor AIAIC's screens, which a guest cannot use there`);
    assert.ok(!off.html.includes("DEMO STORE PAGE"), `${lang}: no demo store`);
    assert.ok(
      !off.html.includes(escHtml(words(lang, "aiaic.local.line"))),
      `${lang}: no demo store line`,
    );
    if (lang !== "en") noEnglish(lang, line, "the not-connected line");

    const dev = tradePage({ mode: "local" }, lang);
    assert.equal(dev.local, 1, `${lang}: the development server keeps its demo store page`);
    assert.ok(dev.html.includes(escHtml(words(lang, "aiaic.local.line"))), `${lang}: said so`);

    const on = tradePage({ mode: "aiaic", problem: null }, lang);
    assert.equal(on.aiaic, 1, `${lang}: AIAIC's screens`);
    assert.equal(on.local, 0, `${lang}: never the demo store`);
  }
});

test("AN4 the not-connected line is one line in her words in all three languages (drafts for a native reader), and her integration guide says the rule", () => {
  for (const lang of LANGS) {
    const line = words(lang, "aiaic.problem.aiaic_not_connected");
    assert.ok(!/[\n]/.test(line) && line.length < 90, `${lang}: one short line`);
    if (lang !== "en") noEnglish(lang, line, "aiaic.problem.aiaic_not_connected");
  }
  const doc = fs.readFileSync(path.join(APP, "..", "ANNAPOORNA_INTEGRATION.md"), "utf8");
  assert.ok(
    /a built server \(the Docker image\) uses no demo store/.test(doc),
    "the guide says a built server uses no demo store",
  );
  assert.ok(/Only the development server \(`vite dev`\)/.test(doc), "and where it stays");
});

// ------------------------------------------------------------------------------------------- run

/** AIAIC_TEST_ONLY=AN1,AN3 runs only the tests whose names start so (as her DOM suites do). */
const ONLY = (process.env["AIAIC_TEST_ONLY"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const started = Date.now();
  for (const t of tests) {
    if (ONLY.length && !ONLY.some((p) => t.name.startsWith(`${p} `))) continue;
    const t0 = Date.now();
    try {
      await t.run();
      results.push({ name: t.name, ok: true, ms: Date.now() - t0 });
      console.log(`PASS ${t.name}`);
    } catch (e) {
      const error = e instanceof Error ? (e.stack ?? e.message) : String(e);
      results.push({ name: t.name, ok: false, ms: Date.now() - t0, error });
      console.log(`FAIL ${t.name}\n${error}`);
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  const junit = process.env["AIAIC_TEST_JUNIT"];
  if (junit) {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const cases = results
      .map(
        (r) =>
          `  <testcase classname="aiaic_server_calls_suite" name="${esc(r.name)}" time="${(r.ms / 1000).toFixed(3)}">` +
          (r.ok ? "" : `<failure message="failed">${esc(r.error ?? "")}</failure>`) +
          "</testcase>",
      )
      .join("\n");
    fs.writeFileSync(
      junit,
      `<?xml version="1.0" encoding="utf-8"?>\n<testsuite name="aiaic_server_calls_suite" tests="${results.length}" failures="${failed}" errors="0" skipped="0" timestamp="${new Date(started).toISOString()}" time="${((Date.now() - started) / 1000).toFixed(3)}">\n${cases}\n</testsuite>\n`,
      "utf-8",
    );
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed, of ${results.length}`);
  process.exit(failed ? 1 : 0);
}

void main();
