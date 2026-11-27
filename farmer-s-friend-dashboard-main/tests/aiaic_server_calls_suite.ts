/**
 * HER SERVER'S OWN CALLS, HELD (push 2b-2, lane AN, 27 Nov 2026: Annapoorna's half of the VM report of 23 Nov 2026 and
 * its verdict of 24 Nov). Run: `npx tsx tests/aiaic_server_calls_suite.ts` (AIAIC_TEST_JUNIT=<file.xml> also writes a
 * JUnit file), from farmer-s-friend-dashboard-main/.
 *
 * - AN1-AN4 (item 1): a built server never uses the app's demo store; without AIAIC's farmer settings it says it is not
 *   connected to AIAIC's sale service, in the page's language. "Development" is read from Vite's compile-time constants.
 * - AN5-AN6 (item 2): a write the demo store's file does not take is thrown, memory keeps nothing of it, and her two
 *   demo-store pages say it in her words (the development server only, where the store still is).
 * - AN7-AN11 (item 3): after a deploy, a call to a server function the new build does not have is answered apart by
 *   the server, read apart by TanStack's own browser fetcher, said on the page ("The app was updated."), and the page
 *   opens the new version by itself once per build per tab, never in a loop; typed text or a storage that cannot be
 *   used gives her a button instead.
 * - AN12-AN15 (item 4): every call her server makes to another server goes through one door with its own time limit
 *   over the whole call (the answer's body included); a call past it is said as a failure in her words; a request
 *   slower than the threshold logs one line, its route and its slowest call, path only.
 * - AN16-AN17 (item 5): identical AIAIC reads running at the same moment share one call (the same address and every
 *   header, so two farmers or two devices never share); a write never shares; a failure reaches every caller sharing
 *   it; nothing is kept once the call has ended; each caller keeps its own time limit.
 * - The fix round of the lane's one check (27 Nov 2026): AN1 also sets a run-time NODE_ENV, DEV and MODE (AN-02); AN3
 *   also draws a failed first read (AN-02) and the not-connected line with her Sign in where she can sign in (AN-05);
 *   AN4 also reads her handover and both matrices (AN-07); AN14 also logs numbers as `:id` (AN-04); AN18 runs the
 *   typing watch in jsdom, started by the notice itself (AN-01); AN19 keeps two changes of the demo store made at the
 *   same moment (AN-03).
 *
 * Every server here is a stand-in on 127.0.0.1 started by this suite: no request leaves this machine, and no account,
 * token or password is a real one.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { runWithStartContext } from "@tanstack/start-storage-context";
import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";

import { ProblemCard, TradeSwitch } from "../src/components/farm/aiaic/AiaicBits";
import {
  OutsideCallTimeout,
  isTimeout,
  outsideFetch,
  readsRunningForTests,
} from "../src/lib/outside-call.server";
import { SLOW_PAGE_MS, nameServerFn, pathForLog, timedRequest } from "../src/lib/slow-page.server";
import { AppUpdatedLine, AppUpdatedNotice } from "../src/components/farm/AppUpdatedNotice";
import {
  APP_UPDATED_HEADER,
  APP_UPDATED_MARKER,
  OPENING_SHOWN_MS,
  RELOAD_MARK,
  RESOLVER_UNKNOWN,
  appUpdated,
  appUpdatedAnswer,
  appUpdatedLogLine,
  appUpdatedMiddleware,
  appUpdatedState,
  isAppUpdatedError,
  isUnknownServerFn,
  onAppUpdated,
  reloadOnce,
  resetAppUpdatedForTests,
  typedText,
  type AppUpdatedEnv,
} from "../src/lib/app-updated";
import { renderErrorPage } from "../src/lib/error-page";
import { withNoStoreForServerFns } from "../src/lib/server-fn-cache";
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

/** AIAIC's address as her server reads it (`AIAIC_BASE_URL`; null: unset, her built-in default). */
function withBase<T>(base: string | null, run: () => T): T {
  const saved = process.env["AIAIC_BASE_URL"];
  if (base === null) delete process.env["AIAIC_BASE_URL"];
  else process.env["AIAIC_BASE_URL"] = base;
  try {
    return run();
  } finally {
    if (saved === undefined) delete process.env["AIAIC_BASE_URL"];
    else process.env["AIAIC_BASE_URL"] = saved;
  }
}

const appRouter = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/listings"] }),
});

type Drawn = { html: string; aiaic: number; local: number };

/** A trade page's switch rendered on the server as her app holds it, with the server's answer of where sales live
 *  already in the page's cache (as `getTradeMode` answers). */
function tradePage(answer: TradeMode, lang: (typeof LANGS)[number]): Drawn {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["aiaic-trade-mode"], answer);
  return drawSwitch(qc, lang);
}

/**
 * A trade page's switch whose FIRST read of where sales live failed (her server or AIAIC not answering), as the page
 * shows it once that read has failed: React Query reads a failed query again when a page mounts on it (its
 * `retryOnMount`, with the loader meanwhile), so the page here is drawn as it stands after that read failed too.
 */
async function tradePageFailed(lang: (typeof LANGS)[number]): Promise<Drawn> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false } },
  });
  await qc.prefetchQuery({
    queryKey: ["aiaic-trade-mode"],
    queryFn: () => Promise.reject(new Error("her server did not answer")),
  });
  assert.equal(qc.getQueryState(["aiaic-trade-mode"])?.status, "error", "the first read failed");
  return drawSwitch(qc, lang);
}

/** The switch drawn from what the page's cache holds, counting which page it chose. */
function drawSwitch(qc: QueryClient, lang: (typeof LANGS)[number]): Drawn {
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
  // NOTHING SET WHEN THE SERVER RUNS opens it (lane AN's fix round, AN-02): the dev compose file runs the built image
  // with NODE_ENV=development, and a caller may set DEV or MODE too; the built constants stay what the build wrote
  const runtime = ["NODE_ENV", "DEV", "MODE", "VITE_DEV", "VITE_MODE"] as const;
  const savedRuntime = runtime.map((k) => [k, process.env[k]] as const);
  Object.assign(process.env, {
    NODE_ENV: "development",
    DEV: "true",
    MODE: "development",
    VITE_DEV: "true",
    VITE_MODE: "development",
  });
  try {
    const built = { DEV: false, MODE: "production" };
    assert.equal(
      buildKind(built),
      "built",
      "a run-time NODE_ENV, DEV or MODE changes no built constant",
    );
    assert.equal(demoStoreAllowed(buildKind(built)), false, "so a built server stays closed");
    assert.equal(buildKind(), "source", "from source: still source");
    assert.equal(demoStoreAllowed(), false, "and still closed until a suite opens it");
  } finally {
    for (const [k, v] of savedRuntime) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
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
    withBase(null, () => {
      // her built-in AIAIC address is plain http to a public address: nobody can sign in there, so no Sign in
      assert.deepEqual(client.tradeMode(), {
        mode: "aiaic",
        problem: problem("aiaic_not_connected"),
      });
      assert.deepEqual(client.tradeModeNow(), {
        mode: "aiaic",
        problem: problem("aiaic_not_connected"),
      });
    });
    // where a farmer can sign in here (https, or this machine's private network), the line carries her Sign in
    // (lane AN's fix round, AN-05): signed in, her sales are her own in AIAIC whatever these settings say
    for (const base of ["https://aiaic.example.org/api", "http://192.168.1.20:8017"])
      withBase(base, () => {
        assert.deepEqual(
          client.tradeMode(),
          {
            mode: "aiaic",
            problem: problem("aiaic_not_connected", { facts: { sign_in: true } }),
          },
          `${base}: not connected, and she can sign in`,
        );
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

test("AN3 a selling page on a built server without the settings says 'not connected' where the demo store was, in English, Marathi and Hindi: never the demo store's page or its line, with her Sign in only where she can sign in; a first read that failed says AIAIC is not answering, never the demo store; on the development server the demo store as before; with the settings, AIAIC's screens", async () => {
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
    assert.ok(!off.html.includes('href="/signin"'), `${lang}: no Sign in where nobody can sign in`);

    // where a farmer can sign in here, the same line carries her Sign in (lane AN's fix round, AN-05)
    const canSignIn = tradePage(
      { mode: "aiaic", problem: problem("aiaic_not_connected", { facts: { sign_in: true } }) },
      lang,
    );
    assert.ok(canSignIn.html.includes(escHtml(line)), `${lang}: the same line`);
    assert.ok(canSignIn.html.includes('href="/signin"'), `${lang}: her Sign in under it`);
    assert.ok(
      canSignIn.html.includes(`>${escHtml(words(lang, "aiaic.sign_in_to_sell.go"))}</a>`),
      `${lang}: in her words`,
    );
    assert.equal(canSignIn.local, 0, `${lang}: never the demo store`);
    assert.equal(canSignIn.aiaic, 0, `${lang}: nor AIAIC's screens before she signs in`);

    // the first read of where sales live failed: AIAIC is not answering, with "try again"; never the demo store's
    // page, which a built server would refuse (lane AN's fix round, AN-02)
    const failed = await tradePageFailed(lang);
    assert.equal(failed.local, 0, `${lang}: a failed first read never draws the demo store`);
    assert.equal(failed.aiaic, 0, `${lang}: nor AIAIC's screens`);
    assert.ok(
      failed.html.includes(escHtml(words(lang, "aiaic.problem.aiaic_unavailable"))),
      `${lang}: it says AIAIC is not answering`,
    );
    assert.ok(failed.html.includes(escHtml(words(lang, "aiaic.retry"))), `${lang}: try again`);
    assert.ok(
      !failed.html.includes(escHtml(words(lang, "aiaic.local.line"))),
      `${lang}: no demo store line`,
    );

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
  // her handover and both matrices say it too, dated (lane AN's fix round, AN-07): no matrix row names the demo
  // store's file without saying it is the development server's; dated reports keep their words with their date
  for (const rel of [
    "HANDOVER.md",
    "docs/CAPABILITY_TRUTH_MATRIX.md",
    "docs/INTEGRATION_MATRIX.md",
  ]) {
    const text = fs.readFileSync(path.join(APP, "..", rel), "utf8");
    assert.ok(
      /27 Nov 2026:\*\*[^\n]*a built server \(the Docker image\) uses no demo store/.test(text),
      `${rel} says a built server uses no demo store`,
    );
    if (rel.startsWith("docs/"))
      for (const row of text.split("\n").filter((l) => l.startsWith("|"))) {
        if (row.includes("data/transactions.json"))
          assert.ok(
            row.includes("(27 Nov 2026: the development server only.)"),
            `${rel}: a row names the file without saying it is the development server's: ${row}`,
          );
      }
  }
});

// ======================================================================= item 2: a failed write is said

/** A lot for the demo store (made-up, as the store's own records are). */
const LOT = {
  crop: "Onion (test lot)",
  quantityQuintals: 12,
  askingPricePerQuintal: 2100,
  district: "Nashik",
  pickupLocation: "Farm gate",
} as Parameters<typeof store.createProduceListing>[0];

test("AN5 on the development server a write the demo store's file does not take is thrown, never a quiet success: memory keeps nothing of it, the server's log says it, and once the file takes writes again a write is kept", async () => {
  demoStoreForTests(true);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aiaic-an5-"));
  const file = path.join(dir, "transactions.json");
  const said: string[] = [];
  const keep = { error: console.error, warn: console.warn };
  const grab = (...a: unknown[]) => said.push(a.map((x) => String(x)).join(" "));
  console.error = grab;
  console.warn = grab;
  try {
    store.storeFileForTests(file);
    await store.getAllListings(); // the first read writes the store's first records
    assert.ok(fs.existsSync(file), "the store's file was made");
    const first = await store.createProduceListing(LOT);
    const onDisk = () =>
      JSON.parse(fs.readFileSync(file, "utf8")) as {
        listings: { id: string; status: string }[];
        orders: { id: string; status: string }[];
      };
    assert.ok(
      onDisk().listings.some((l) => l.id === first.id),
      "a write the file took is kept",
    );
    const listingsBefore = JSON.stringify(await store.getAllListings());
    const ordersBefore = JSON.stringify(await store.getAllOrders());
    const pending = (await store.getAllOrders()).find((o) => o.status === "PENDING_ACCEPTANCE");
    assert.ok(pending, "an offer waits for her answer");

    // the file can no longer take a write: a folder stands where it was
    fs.rmSync(file);
    fs.mkdirSync(file);
    const failed = { message: store.DEMO_STORE_WRITE_FAILED };
    await assert.rejects(() => store.createProduceListing(LOT), failed, "a new lot");
    await assert.rejects(() => store.acceptProduceOrder(pending.id), failed, "her yes");
    await assert.rejects(() => store.declineProduceOrder(pending.id, "no"), failed, "her no");
    await assert.rejects(
      () => store.updateListingStatus(first.id, "DELISTED"),
      failed,
      "a lot taken off",
    );
    assert.equal(
      JSON.stringify(await store.getAllListings()),
      listingsBefore,
      "memory keeps no lot the file did not take, and no status it did not take",
    );
    assert.equal(
      JSON.stringify(await store.getAllOrders()),
      ordersBefore,
      "memory keeps no order or answer the file did not take",
    );
    const lines = said.filter((s) => s.includes("did not take a change"));
    assert.equal(lines.length, 4, `the server's log says each of the four: ${said.join(" | ")}`);
    assert.ok(!lines.some((s) => s.includes(dir)), "the log line names no path");

    // the file takes writes again (the folder gone): the next write makes it from what memory holds, which is all the
    // file had taken, and her yes is kept in memory and on disk
    fs.rmdirSync(file);
    const yes = await store.acceptProduceOrder(pending.id);
    assert.equal(yes.status, "ACCEPTED", "her yes is kept");
    assert.equal(
      onDisk().orders.find((o) => o.id === pending.id)?.status,
      "ACCEPTED",
      "and the file holds it",
    );
    assert.equal(
      onDisk().listings.length,
      (JSON.parse(listingsBefore) as unknown[]).length,
      "with every lot the file had taken, and no other",
    );
  } finally {
    console.error = keep.error;
    console.warn = keep.warn;
    store.storeFileForTests(null);
    demoStoreForTests(false);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("AN6 her two demo-store pages say a failed write in her words, one line in English, Marathi and Hindi: never the error's own English, never a quiet success", () => {
  for (const lang of LANGS) {
    const line = words(lang, "demo.not_saved");
    assert.ok(line.length < 60, `${lang}: one short line`);
    if (lang !== "en") noEnglish(lang, line, "demo.not_saved");
  }
  const read = (rel: string) => {
    const file = path.join(APP, "src", "routes", rel);
    return ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  };
  // the new lot (routes/listing.new.tsx): every way her press can fail sets the one line
  const lot = read("listing.new.tsx");
  const tries: import("typescript").TryStatement[] = [];
  const findTries = (n: import("typescript").Node) => {
    if (ts.isTryStatement(n) && n.tryBlock.getText(lot).includes("createListingFn(")) tries.push(n);
    ts.forEachChild(n, findTries);
  };
  findTries(lot);
  assert.equal(tries.length, 1, "the new lot's press is one try");
  const press = tries[0] as import("typescript").TryStatement;
  const caught = press.catchClause?.block.getText(lot) ?? "";
  assert.ok(caught.includes('setErrorMsg(t("demo.not_saved"))'), `a throw is said: ${caught}`);
  assert.ok(!/setErrorMsg\([^)]*message/.test(caught), "never the error's own words");
  assert.ok(
    press.tryBlock.getText(lot).includes('setErrorMsg(t("demo.not_saved"))'),
    "an answer without a lot is said too",
  );
  // her answer to an offer (routes/orders.$orderId.tsx): each press's failure sets the one line
  const order = read("orders.$orderId.tsx");
  const onErrors: string[] = [];
  const findOnError = (n: import("typescript").Node) => {
    if (ts.isPropertyAssignment(n) && n.name.getText(order) === "onError")
      onErrors.push(n.initializer.getText(order));
    ts.forEachChild(n, findOnError);
  };
  findOnError(order);
  assert.equal(onErrors.length, 2, "her yes and her no");
  for (const body of onErrors) {
    assert.ok(body.includes('setActionError(t("demo.not_saved"))'), `said: ${body}`);
    assert.ok(!body.includes("message"), `never the error's own words: ${body}`);
  }
});

test("AN19 on the development server changes of the demo store made at the same moment are each kept, in memory and in its file (each one is answered as saved, so none may be dropped); a change that fails ends its turn and the next one still runs", async () => {
  demoStoreForTests(true);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aiaic-an19-"));
  const file = path.join(dir, "transactions.json");
  type OnDisk = {
    listings: { id: string; crop: string }[];
    orders: { id: string; status: string }[];
  };
  const onDisk = (): OnDisk => {
    const text = fs.readFileSync(file, "utf8");
    try {
      return JSON.parse(text) as OnDisk;
    } catch {
      return assert.fail("the store's file holds one whole store (writes made at once mixed it)");
    }
  };
  try {
    store.storeFileForTests(file);
    const before = (await store.getAllListings()).length; // the first read writes the store's first records
    const offer = (await store.getAllOrders()).find((o) => o.status === "PENDING_ACCEPTANCE");
    assert.ok(offer, "an offer waits for her answer");
    // two new lots and her yes to the waiting offer, pressed at the same moment
    const [a, b, yes] = await Promise.all([
      store.createProduceListing({ ...LOT, crop: "Onion (lot A)" }),
      store.createProduceListing({ ...LOT, crop: "Onion (lot B)" }),
      store.acceptProduceOrder(offer.id),
    ]);
    assert.equal(yes.status, "ACCEPTED", "her yes is answered as saved");
    const lots = [
      ["lot A", a],
      ["lot B", b],
    ] as const;
    // memory first (what her pages read), then the file
    const memory = await store.getAllListings();
    for (const [what, lot] of lots)
      assert.ok(
        memory.some((l) => l.id === lot.id && l.crop === lot.crop),
        `memory keeps ${what}`,
      );
    assert.equal(memory.length, before + 2, "memory: both new lots, and no other");
    assert.equal((await store.getOrderById(offer.id))?.status, "ACCEPTED", "memory keeps her yes");
    const disk = onDisk();
    for (const [what, lot] of lots)
      assert.ok(
        disk.listings.some((l) => l.id === lot.id && l.crop === lot.crop),
        `the file keeps ${what}`,
      );
    assert.equal(disk.listings.length, before + 2, "the file: both new lots, and no other");
    assert.equal(
      disk.orders.find((o) => o.id === offer.id)?.status,
      "ACCEPTED",
      "the file keeps her yes",
    );
    // a change that fails (an offer the store does not hold) ends its turn: the change pressed with it still runs
    const [missing, c] = await Promise.allSettled([
      store.acceptProduceOrder("ORD-00000000-0000"),
      store.createProduceListing({ ...LOT, crop: "Onion (lot C)" }),
    ]);
    assert.equal(missing.status, "rejected", "an offer it does not hold is said");
    assert.ok(c.status === "fulfilled", "the next change still runs");
    assert.ok(
      (await store.getAllListings()).some((l) => l.id === c.value.id),
      "and memory keeps it",
    );
    assert.ok(
      onDisk().listings.some((l) => l.id === c.value.id),
      "and so does the file",
    );
  } finally {
    store.storeFileForTests(null);
    demoStoreForTests(false);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ======================================================================= item 3: an old server function after a deploy

const nodeModule = (...parts: string[]) =>
  fs.readFileSync(path.join(APP, "node_modules", ...parts), "utf8");

test("AN7 the evidence, pinned: TanStack Start names a server function by its file and its export only (the same in every build until one is renamed, moved or removed), and its resolver's own words are what her server reads", () => {
  const compiler = nodeModule(
    "@tanstack",
    "start-plugin-core",
    "dist",
    "esm",
    "start-compiler",
    "compiler.js",
  );
  assert.ok(
    compiler.includes("const entryId = `${opts.filename}--${opts.functionName}`;"),
    "a built id is made from the file and the function's name",
  );
  assert.ok(
    compiler.includes('functionId = crypto.createHash("sha256").update(entryId).digest("hex")'),
    "and from nothing else: their sha256",
  );
  const resolver = nodeModule(
    "@tanstack",
    "start-plugin-core",
    "dist",
    "esm",
    "start-compiler",
    "server-fn-resolver-module.js",
  );
  assert.ok(
    resolver.includes(`throw new Error('${RESOLVER_UNKNOWN}' + id)`),
    "the resolver's words, as her server reads them",
  );
  // and the resolver throws before the handler's own try, so only her error middleware can answer it
  const handler = nodeModule(
    "@tanstack",
    "start-server-core",
    "dist",
    "esm",
    "server-functions-handler.js",
  );
  const lookup = handler.indexOf("await getServerFnById(serverFnId");
  const firstTry = handler.indexOf("try {");
  assert.ok(lookup > 0 && firstTry > lookup, "the lookup comes before the handler's own try");
});

test("AN8 her server answers a call to a server function this build does not have apart from every other failure, and TanStack's own browser fetcher throws that word as it is; the log names a build's id and echoes nothing else", async () => {
  const id = "f".repeat(64);
  assert.equal(isUnknownServerFn(new Error(`${RESOLVER_UNKNOWN}${id}`)), true);
  assert.equal(isUnknownServerFn(new Error("Server function module not resolved for x")), false);
  assert.equal(isUnknownServerFn(`${RESOLVER_UNKNOWN}${id}`), false, "only a thrown Error");
  const answer = appUpdatedAnswer();
  assert.equal(answer.status, 410);
  assert.equal(answer.headers.get(APP_UPDATED_HEADER), "1");
  assert.equal(answer.headers.get("cache-control"), "no-store");
  assert.equal(await answer.clone().text(), APP_UPDATED_MARKER);
  assert.ok(appUpdatedLogLine(new Error(`${RESOLVER_UNKNOWN}${id}`)).includes(id), "a build's id");
  const junk = appUpdatedLogLine(new Error(`${RESOLVER_UNKNOWN}../../etc/passwd?token=abc`));
  assert.ok(!/passwd|token|abc/.test(junk), `nothing else it was sent is echoed: ${junk}`);
  // through TanStack's own browser fetcher (createClientRpc, as her pages call), the answer as her server.ts sends it
  const { createClientRpc } = await import("@tanstack/start-client-core/client-rpc");
  const call = createClientRpc(id) as unknown as (
    opts: Record<string, unknown>,
  ) => Promise<unknown>;
  const thrownBy = async (res: Response) => {
    try {
      await runWithStartContext({ startOptions: {} } as never, () =>
        call({ method: "POST", fetch: async () => res }),
      );
    } catch (e) {
      return e;
    }
    return null;
  };
  const updated = await thrownBy(withNoStoreForServerFns(`/_serverFn/${id}`, appUpdatedAnswer()));
  assert.ok(isAppUpdatedError(updated), `the page reads it apart: ${String(updated)}`);
  const other = await thrownBy(
    new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
  assert.ok(other instanceof Error, "any other failure still fails");
  assert.equal(isAppUpdatedError(other), false, "and is never read as an update");
});

/** The tab's storage, as a browser keeps it. */
const tabStorage = () => {
  const kept = new Map<string, string>();
  return {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => {
      kept.set(k, v);
    },
  };
};

test("AN9 the page opens the new version by itself once per build per tab and never loops: the same build again, typed text, or a storage that cannot be read or does not keep the mark each give her button instead; calls failing together decide once", () => {
  const A = "/assets/index-A1b2.js";
  const B = "/assets/index-C3d4.js";
  const tab = tabStorage();
  assert.equal(reloadOnce({ storage: tab, build: A, typed: false }), "reload", "once");
  assert.equal(tab.getItem(RELOAD_MARK), A, "the tab remembers the build it reloaded from");
  assert.equal(reloadOnce({ storage: tab, build: A, typed: false }), "press", "never twice");
  assert.equal(
    reloadOnce({ storage: tab, build: B, typed: false }),
    "reload",
    "a newer build: once",
  );
  assert.equal(reloadOnce({ storage: tab, build: B, typed: false }), "press");
  assert.equal(reloadOnce({ storage: null, build: A, typed: false }), "press", "no storage");
  const refusing = {
    getItem: (): string | null => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
  };
  assert.equal(reloadOnce({ storage: refusing, build: A, typed: false }), "press", "unreadable");
  const forgetful = { getItem: () => null, setItem: () => {} };
  assert.equal(
    reloadOnce({ storage: forgetful, build: A, typed: false }),
    "press",
    "a storage that keeps nothing: a button, so it cannot loop",
  );
  assert.equal(reloadOnce({ storage: tabStorage(), build: A, typed: true }), "press", "typed");

  // the page reloads and the same build meets the old function again, five times, in one tab: one reload
  const one = tabStorage();
  let reloads = 0;
  const env = (over: Partial<AppUpdatedEnv> = {}): AppUpdatedEnv => ({
    storage: () => one,
    build: A,
    typed: () => false,
    reload: () => {
      reloads += 1;
    },
    later: (run) => run(),
    ...over,
  });
  for (let load = 0; load < 5; load++) {
    resetAppUpdatedForTests();
    appUpdated(env());
  }
  assert.equal(reloads, 1, "five loads of the same build: one reload");
  assert.deepEqual(appUpdatedState(), { how: "press", typed: false }, "then her button");

  // three calls of one page failing together decide once
  resetAppUpdatedForTests();
  reloads = 0;
  const heard: unknown[] = [];
  const stop = onAppUpdated((s) => heard.push(s));
  const fresh = tabStorage();
  appUpdated(env({ storage: () => fresh }));
  appUpdated(env({ storage: () => fresh }));
  appUpdated(env({ storage: () => fresh }));
  stop();
  assert.equal(reloads, 1, "one reload");
  assert.equal(heard.length, 1, "said once");
  assert.deepEqual(appUpdatedState(), { how: "opening", typed: false });

  // she typed: no reload; her button, and the line that a reload clears what she typed
  resetAppUpdatedForTests();
  reloads = 0;
  appUpdated(env({ storage: () => tabStorage(), typed: () => true }));
  assert.equal(reloads, 0, "nothing she typed is cleared without her press");
  assert.deepEqual(appUpdatedState(), { how: "press", typed: true });
  resetAppUpdatedForTests();
});

test("AN10 every server function call from the browser goes through the middleware: a call that met the app-updated answer says so once and opens the new version once; the call still fails as it did; any other failure is passed on untouched", async () => {
  type Run = (o: { next: () => Promise<unknown> }) => Promise<unknown>;
  const run = (appUpdatedMiddleware as unknown as { options: { client: Run } }).options.client;
  const g = globalThis as unknown as Record<string, unknown>;
  const had = { window: g["window"], document: g["document"] };
  let reloads = 0;
  const later: (() => void)[] = [];
  g["window"] = {
    sessionStorage: tabStorage(),
    location: {
      reload: () => {
        reloads += 1;
      },
    },
    setTimeout: (fn: () => void) => later.push(fn),
  };
  g["document"] = { querySelectorAll: () => [], addEventListener: () => {} };
  resetAppUpdatedForTests();
  try {
    const updated = new Error(APP_UPDATED_MARKER);
    await assert.rejects(
      () => run({ next: () => Promise.reject(updated) }),
      (e) => e === updated,
    );
    await assert.rejects(
      () => run({ next: () => Promise.reject(updated) }),
      (e) => e === updated,
    );
    assert.deepEqual(appUpdatedState(), { how: "opening", typed: false }, "said, once");
    assert.equal(later.length, 1, "one opening of the new version, after the line is shown");
    later.forEach((fn) => fn());
    assert.equal(reloads, 1);
    resetAppUpdatedForTests();
    const other = new Error("AIAIC is not answering");
    await assert.rejects(
      () => run({ next: () => Promise.reject(other) }),
      (e) => e === other,
    );
    assert.equal(appUpdatedState(), null, "any other failure says nothing of an update");
    const fine = { result: "her answer" };
    assert.equal(
      await run({ next: () => Promise.resolve(fine) }),
      fine,
      "an answer passes as it is",
    );
  } finally {
    resetAppUpdatedForTests();
    g["window"] = had.window;
    g["document"] = had.document;
  }
});

test("AN11 the page says it in her words, in English, Marathi and Hindi: one line, her button only where it does not open by itself, the typed line only when she typed; her server and every page are wired to it", () => {
  const cases: NonNullable<ReturnType<typeof appUpdatedState>>[] = [
    { how: "opening", typed: false },
    { how: "press", typed: false },
    { how: "press", typed: true },
  ];
  for (const lang of LANGS) {
    for (const k of [
      "app.updated.line",
      "app.updated.opening",
      "app.updated.open",
      "app.updated.typed",
    ]) {
      const w = words(lang, k);
      assert.ok(w.length < 60, `${k} [${lang}]: one short line`);
      if (lang !== "en") noEnglish(lang, w, k);
    }
    for (const state of cases) {
      const html = renderToString(
        createElement(I18nProvider, {
          initialLang: lang,
          children: createElement(AppUpdatedLine, { state, onOpen: () => {} }),
        }),
      ).replaceAll("<!-- -->", "");
      const tag = `${lang} ${state.how}${state.typed ? " typed" : ""}`;
      assert.ok(html.includes('role="alert"'), `${tag}: said aloud`);
      assert.ok(html.includes(escHtml(words(lang, "app.updated.line"))), `${tag}: the line`);
      assert.equal(
        html.includes(escHtml(words(lang, "app.updated.opening"))),
        state.how === "opening",
        `${tag}: "opening" only when it opens by itself`,
      );
      assert.equal(html.includes("<button"), state.how === "press", `${tag}: her button`);
      assert.equal(
        html.includes(escHtml(words(lang, "app.updated.typed"))),
        state.typed,
        `${tag}: the typed line only when she typed`,
      );
    }
  }
  // the wiring: start.ts answers it apart and puts the middleware on every call; the root page draws the notice
  const start = fs.readFileSync(path.join(APP, "src", "start.ts"), "utf8");
  const sf = ts.createSourceFile("start.ts", start, ts.ScriptTarget.Latest, true);
  let branch = "";
  let functionMiddleware = "";
  const visit = (n: import("typescript").Node) => {
    if (ts.isIfStatement(n) && n.expression.getText(sf).includes("isUnknownServerFn(error)"))
      branch = n.getText(sf);
    if (ts.isPropertyAssignment(n) && n.name.getText(sf) === "functionMiddleware")
      functionMiddleware = n.initializer.getText(sf);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  assert.ok(
    branch.includes('handlerType === "serverFn"') && branch.includes("return appUpdatedAnswer()"),
    `the error middleware answers it apart: ${branch}`,
  );
  assert.ok(
    start.indexOf("isUnknownServerFn(error)") < start.indexOf("console.error(error)"),
    "before the error page",
  );
  assert.ok(functionMiddleware.includes("appUpdatedMiddleware"), "on every call from the browser");
  const root = fs.readFileSync(path.join(APP, "src", "routes", "__root.tsx"), "utf8");
  assert.ok(root.includes("<AppUpdatedNotice />"), "every page draws the notice");
});

test("AN18 in a browser's document (jsdom), the notice as every page draws it watches her typing: text she typed in a box (an input event) makes the page wait for her press, with the line that a reload clears it; nothing typed, a tick box, a choice, text the page set itself, or boxes she emptied again let the new version open by itself, once", async () => {
  // jsdom, as her DOM suites load it: a suite that cannot load it fails, and says why; it never skips
  const { JSDOM } = (await import("jsdom")) as {
    JSDOM: new (
      html: string,
      options: Record<string, unknown>,
    ) => { window: Window & typeof globalThis };
  };
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="notice"></div><form>' +
      '<input id="name" type="text"><input id="qty" type="number"><textarea id="notes"></textarea>' +
      '<input id="agree" type="checkbox"><select id="crop"><option value="onion">onion</option>' +
      '<option value="tur">tur</option></select></form></body></html>',
    { url: "http://localhost/listing/new" },
  );
  const win = dom.window;
  const doc = win.document;
  // the window's names as this test's globals (as her DOM suites set them), each put back after
  const g = globalThis as unknown as Record<string, unknown>;
  const added: string[] = [];
  for (const k of Object.getOwnPropertyNames(win)) {
    if (k in g) continue;
    try {
      Object.defineProperty(g, k, {
        value: (win as unknown as Record<string, unknown>)[k],
        configurable: true,
        writable: true,
      });
      added.push(k);
    } catch {
      /* a name the global keeps */
    }
  }
  const replaced = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"].map(
    (k) => [k, Object.getOwnPropertyDescriptor(g, k)] as const,
  );
  for (const [k, v] of [
    ["window", win],
    ["document", doc],
    ["navigator", win.navigator],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ] as const)
    Object.defineProperty(g, k, { value: v, configurable: true, writable: true });
  // the page opening the new version by itself is noted, never done
  const opened: number[] = [];
  Object.defineProperty(win, "setTimeout", {
    value: (_run: () => void, ms?: number) => {
      opened.push(ms ?? 0);
      return 0;
    },
    configurable: true,
    writable: true,
  });
  type Run = (o: { next: () => Promise<unknown> }) => Promise<unknown>;
  const run = (appUpdatedMiddleware as unknown as { options: { client: Run } }).options.client;
  const updated = new Error(APP_UPDATED_MARKER);
  let unmount: (() => Promise<void>) | null = null;
  resetAppUpdatedForTests();
  try {
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const reactRoot = createRoot(doc.getElementById("notice") as HTMLElement);
    // the notice as her root page draws it: its first paint starts the typing watch
    await React.act(async () => {
      reactRoot.render(
        createElement(I18nProvider, {
          initialLang: "en",
          children: createElement(AppUpdatedNotice),
        }),
      );
    });
    unmount = () => React.act(async () => reactRoot.unmount());
    const meetsTheUpdate = () =>
      React.act(async () => {
        await run({ next: () => Promise.reject(updated) }).catch((e: unknown) => {
          assert.equal(e, updated, "the call still fails as it did");
        });
      });
    const box = <T>(id: string) => doc.getElementById(id) as T;
    const name = box<HTMLInputElement>("name");
    const qty = box<HTMLInputElement>("qty");
    const notes = box<HTMLTextAreaElement>("notes");
    const agree = box<HTMLInputElement>("agree");
    const crop = box<HTMLSelectElement>("crop");
    /** Her keys in a box: the text goes in, and the browser fires an input event for it. */
    const typeInto = (el: HTMLInputElement | HTMLTextAreaElement, text: string) => {
      el.value = text;
      el.dispatchEvent(
        new win.InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }),
      );
    };

    assert.equal(typedText(doc), false, "nothing typed yet");
    // the page sets text itself (her saved farm filled in), she ticks a box and makes a choice: none is typed text
    name.value = "Sunita";
    agree.checked = true;
    agree.dispatchEvent(new win.Event("input", { bubbles: true }));
    agree.dispatchEvent(new win.Event("change", { bubbles: true }));
    crop.value = "tur";
    crop.dispatchEvent(new win.Event("input", { bubbles: true }));
    crop.dispatchEvent(new win.Event("change", { bubbles: true }));
    assert.equal(
      typedText(doc),
      false,
      "text the page set, a tick box and a choice are not typed text",
    );

    // she types in a box: the page waits for her press and says a reload clears what she typed
    typeInto(qty, "12");
    assert.equal(typedText(doc), true, "she typed in a box that still holds it");
    await meetsTheUpdate();
    assert.deepEqual(appUpdatedState(), { how: "press", typed: true }, "her button");
    assert.deepEqual(opened, [], "nothing opens by itself");
    const notice = () => doc.querySelector('[data-testid="app-updated"]');
    assert.ok(notice(), "the page says it");
    assert.ok(
      notice()?.textContent?.includes(words("en", "app.updated.typed")),
      "with the line that a reload clears what she typed",
    );
    assert.ok(notice()?.querySelector("button"), "and her button");

    // she empties the boxes again (the page's own text too): nothing a reload would clear, so it opens by itself, once
    name.value = "";
    qty.value = "";
    assert.equal(typedText(doc), false, "no box holds text");
    resetAppUpdatedForTests();
    await meetsTheUpdate();
    assert.deepEqual(appUpdatedState(), { how: "opening", typed: false });
    assert.deepEqual(
      opened,
      [OPENING_SHOWN_MS],
      "the new version opens once, after the line is shown",
    );
    assert.ok(win.sessionStorage.getItem(RELOAD_MARK), "the tab keeps the build it opened it from");
    assert.ok(
      notice()?.textContent?.includes(words("en", "app.updated.opening")),
      "the page says it is opening the new version",
    );
    assert.equal(notice()?.querySelector("button") ?? null, null, "no button while it opens");

    // a text area she types in counts as well
    typeInto(notes, "pickup after 4 pm");
    assert.equal(typedText(doc), true, "she typed in a text area");
  } finally {
    if (unmount) await unmount();
    resetAppUpdatedForTests();
    for (const [k, d] of replaced) {
      if (d) Object.defineProperty(g, k, d);
      else delete g[k];
    }
    for (const k of added) delete g[k];
    win.close();
  }
});

// ======================================================================= item 4: time limits, and the slow-page line

type StandIn = {
  url: string;
  hits: { path: string; method: string; auth: string | null; guest: string | null }[];
  close: () => Promise<void>;
};

/** A stand-in for AIAIC (and the other servers) on 127.0.0.1: `/slow-head/*` and `/storage/plan` answer after 2 s,
 *  `/slow-body/*` and `/farmer/trade/price` send their headers and half a body at once and the rest after 2 s; every
 *  other path answers its own path after `?wait=` ms. Nothing leaves this machine. */
async function standIn(): Promise<StandIn> {
  const s: StandIn = { url: "", hits: [], close: async () => {} };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const header = (k: string) => {
      const v = req.headers[k];
      return typeof v === "string" ? v : null;
    };
    s.hits.push({
      path: u.pathname,
      method: req.method ?? "GET",
      auth: header("authorization"),
      guest: header("x-aiaic-guest"),
    });
    const json = (status: number, body: unknown) => {
      if (res.destroyed) return;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (u.pathname.startsWith("/slow-head") || u.pathname === "/storage/plan") {
      setTimeout(() => json(200, { late: true }), 2000);
      return;
    }
    if (u.pathname.startsWith("/slow-body") || u.pathname === "/farmer/trade/price") {
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"part":');
      setTimeout(() => {
        if (!res.destroyed) res.end('"late"}');
      }, 2000);
      return;
    }
    const wait = Number(u.searchParams.get("wait") ?? "0");
    const status = Number(u.searchParams.get("status") ?? "200");
    setTimeout(() => json(status, { path: u.pathname, n: s.hits.length }), wait);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  s.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  s.close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  return s;
}

/** Her problem card as the page draws it. */
function problemCard(p: ReturnType<typeof problem>, lang: (typeof LANGS)[number]): string {
  return renderToString(
    createElement(RouterContextProvider, {
      router: appRouter as never,
      children: createElement(QueryClientProvider, {
        client: new QueryClient(),
        children: createElement(I18nProvider, {
          initialLang: lang,
          children: createElement(ProblemCard, { problem: p }),
        }),
      }),
    }),
  ).replaceAll("<!-- -->", "");
}

const asHer = () =>
  identity.sessionForTests({
    token: "standin-token-an-0000000001",
    username: "standin_farmer",
    displayName: null,
    expiresAt: Date.now() + 60 * 60_000,
  });

test("AN12 every call her server makes to another server goes through one door, each with its own time limit: no bare fetch in her server's code, every call listed (a new one is added here with its limit), and the generated Supabase server clients are imported by nothing", () => {
  const src = path.join(APP, "src");
  const lib = path.join(src, "lib");
  const files = [
    ...fs
      .readdirSync(lib)
      .filter((f) => /\.(server|functions)\.tsx?$/.test(f))
      .map((f) => path.join(lib, f)),
    path.join(src, "server.ts"),
    path.join(src, "start.ts"),
  ];
  const sites: Record<string, number> = {};
  const bare: string[] = [];
  const noLimit: string[] = [];
  for (const file of files) {
    const rel = path.relative(src, file).replaceAll("\\", "/");
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const at = (n: import("typescript").Node) =>
      `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
    const visit = (n: import("typescript").Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        if (n.expression.text === "fetch" && rel !== "lib/outside-call.server.ts") bare.push(at(n));
        if (n.expression.text === "outsideFetch") {
          sites[rel] = (sites[rel] ?? 0) + 1;
          const init = n.arguments[2];
          const limited =
            init !== undefined &&
            ts.isObjectLiteralExpression(init) &&
            init.properties.some(
              (p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === "limitMs",
            );
          if (!limited) noLimit.push(at(n));
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  assert.deepEqual(bare, [], "no call goes around the door");
  assert.deepEqual(noLimit, [], "each call names its time limit");
  assert.deepEqual(
    sites,
    {
      "lib/aiaic-account.server.ts": 1, // her sign-in, registration, Help, notices: 15 s
      "lib/aiaic-identity.server.ts": 1, // advice, intelligence, crop signals (fetchForHer): 15-20 s
      "lib/aiaic-trade.server.ts": 1, // sale, payment, transport, storage, places names: 20 s
      "lib/catalog.functions.ts": 1, // the catalogue: 15 s
      "lib/places.functions.ts": 5, // districts, crops, place, price series, brief: 10-15 s
      "lib/plant.functions.ts": 1, // the plant check: 45 s
      "lib/vaani-tts.server.ts": 1, // Vaani's speech: 15 s
    },
    "every outside call of her server, listed",
  );
  // the generated Supabase clients: the browser's only; nothing imports the server ones
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : /\.tsx?$/.test(e.name) ? [p] : [];
    });
  const importers = walk(src)
    .filter((f) => !f.includes(path.join("integrations", "supabase")))
    .filter((f) => /supabase\/(client\.server|auth-middleware)/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(importers, [], "no server code calls Supabase");
});

test("AN13 a call past its limit fails within it, a body still coming included, and is said as a failure in her words: the sale path's own line (never 'nothing was changed'), in English, Marathi and Hindi; the other paths fail in time into their 'not answering'", async () => {
  const s = await standIn();
  const savedBase = process.env["AIAIC_BASE_URL"];
  try {
    for (const p of ["/slow-head/x", "/slow-body/x"]) {
      const t0 = Date.now();
      await assert.rejects(
        () => outsideFetch("aiaic", `${s.url}${p}`, { limitMs: 300 }),
        (e: unknown) => e instanceof OutsideCallTimeout && isTimeout(e),
        `${p}: past its limit`,
      );
      const ms = Date.now() - t0;
      assert.ok(ms < 1500, `${p}: failed within its limit (${ms} ms), not after the 2 s answer`);
    }
    const ok = await outsideFetch("aiaic", `${s.url}/ok/1`, { limitMs: 2000 });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(await ok.text()), { path: "/ok/1", n: 3 }, "an answer, whole");
    await assert.rejects(
      () => outsideFetch("aiaic", "http://127.0.0.1:9/x", { limitMs: 3000 }),
      (e: unknown) => e instanceof Error && !isTimeout(e),
      "a server not reached is thrown as it was, never as a timeout",
    );
    // the sale path: her price (a body still coming) and a guest's storage plan (an answer not begun)
    process.env["AIAIC_BASE_URL"] = s.url;
    client.resetForTests();
    client.callLimitForTests(300);
    asHer();
    const price = await client.getPrice({ crop: "onion", state: "mh", district: "nashik" });
    assert.equal(!price.ok ? price.problem.code : "", "aiaic_timed_out", "her price");
    identity.sessionForTests(null);
    const plan = await client.storagePlan({
      crop: "onion",
      district: "nashik",
      state: "mh",
      lang: "en",
    });
    assert.equal(!plan.ok ? plan.problem.code : "", "aiaic_timed_out", "a guest's storage plan");
    for (const lang of LANGS) {
      const line = words(lang, "aiaic.problem.aiaic_timed_out");
      assert.ok(problemCard(problem("aiaic_timed_out"), lang).includes(escHtml(line)), lang);
      assert.ok(!line.includes(words(lang, "aiaic.problem.aiaic_unavailable")), `${lang}: its own`);
      if (lang !== "en") noEnglish(lang, line, "aiaic.problem.aiaic_timed_out");
    }
    assert.ok(
      !/changed/i.test(words("en", "aiaic.problem.aiaic_timed_out")),
      "no claim it changed nothing",
    );
    // advice, intelligence and crop signals go through fetchForHer: past its limit, in time
    const t0 = Date.now();
    await assert.rejects(
      () => identity.fetchForHer(`${s.url}/slow-body/advice`, {}, 300),
      (e: unknown) => isTimeout(e),
    );
    assert.ok(Date.now() - t0 < 1500, "fetchForHer fails within its limit");
  } finally {
    client.callLimitForTests(null);
    client.resetForTests();
    identity.sessionForTests(null);
    if (savedBase === undefined) delete process.env["AIAIC_BASE_URL"];
    else process.env["AIAIC_BASE_URL"] = savedBase;
    await s.close();
  }
});

test("AN14 a request slower than the threshold logs one line once its body ended: its route and its slowest outside call, path only (no query string, no token, no id, no person's detail); a fast one logs nothing; a stream stays a stream", async () => {
  const s = await standIn();
  try {
    assert.equal(SLOW_PAGE_MS, 8_000, "the threshold (UNCALIBRATED)");
    assert.equal(
      pathForLog("/farmer/trade/offers/ofr_0123456789abcdef0123/compare"),
      "/farmer/trade/offers/:id/compare",
    );
    assert.equal(pathForLog("/orders/ORD-20261019-8421"), "/orders/:id");
    assert.equal(pathForLog("/help/3fa85f64-5717-4562-b3fc-2c963f66afa6"), "/help/:id");
    assert.equal(pathForLog("/farmer/queries/deadbeefcafe"), "/farmer/queries/:id", "hex letters");
    // numbers are never kept: an id of digits, a phone number, a word with digits (lane AN's fix round, AN-04)
    assert.equal(pathForLog("/notifications/12345/read"), "/notifications/:id/read", "a number");
    assert.equal(pathForLog("/x/9876543210"), "/x/:id", "a phone number");
    assert.equal(pathForLog("/farmer/a1b2"), "/farmer/:id", "a word with digits");
    assert.equal(pathForLog("/transport/nearby-mandis"), "/transport/nearby-mandis");
    assert.equal(pathForLog("/v1/tts/synthesize"), "/v1/tts/synthesize");
    const lines: string[] = [];
    const slow = await timedRequest(
      new Request("http://localhost/orders/ord_00112233445566778899?phone=9876543210&t=secret"),
      async () => {
        nameServerFn("getMyTrade");
        const r = await outsideFetch(
          "aiaic",
          `${s.url}/farmer/trade/offers/ofr_0123456789abcdef0123/compare?wait=120&token=SECRET&phone=9876543210`,
          { headers: { authorization: "Bearer standin-token-secret-xyz" }, limitMs: 2000 },
        );
        await r.text();
        await outsideFetch("aiaic", `${s.url}/slow-head/late`, { limitMs: 60 }).catch(() => null);
        return new Response("her answer", { status: 200 });
      },
      { slowMs: 50, log: (l) => lines.push(l) },
    );
    assert.deepEqual(lines, [], "nothing until the body has ended");
    assert.equal(await slow.text(), "her answer", "the answer as it was");
    assert.equal(lines.length, 1, "then one line");
    const line = lines[0] ?? "";
    assert.ok(line.startsWith("[slow-page] GET serverFn getMyTrade "), line);
    assert.ok(line.includes("outside calls 2 (1 timed out)"), line);
    assert.ok(line.includes("slowest: aiaic /farmer/trade/offers/:id/compare"), line);
    for (const never of [
      "?",
      "phone",
      "9876543210",
      "SECRET",
      "secret",
      "standin-token",
      "ofr_",
      "ord_",
    ])
      assert.ok(!line.includes(never), `the line holds no "${never}": ${line}`);
    // a page (not a server function) is named by its path, ids written :id
    const page: string[] = [];
    await (
      await timedRequest(
        new Request("http://localhost/listing/LST-20261019-01?x=1"),
        async () => {
          await new Promise((r) => setTimeout(r, 70));
          return new Response(null, { status: 204 });
        },
        { slowMs: 50, log: (l) => page.push(l) },
      )
    ).text();
    assert.equal(page.length, 1);
    assert.ok((page[0] ?? "").startsWith("[slow-page] GET /listing/:id "), page[0]);
    assert.ok((page[0] ?? "").includes("outside calls 0"), page[0]);
    // a fast request logs nothing
    const fast: string[] = [];
    await (
      await timedRequest(new Request("http://localhost/"), async () => new Response("ok"), {
        log: (l) => fast.push(l),
      })
    ).text();
    assert.deepEqual(fast, [], "a fast page logs nothing");
    // a stream stays a stream: its first part is handed on before its second is written
    const source: { push: ReadableStreamDefaultController<Uint8Array> | null } = { push: null };
    const streamed = await timedRequest(
      new Request("http://localhost/today"),
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start: (c) => {
              source.push = c;
            },
          }),
          { status: 200, headers: { "content-type": "text/html" } },
        ),
      { slowMs: 0, log: () => {} },
    );
    const reader = streamed.body?.getReader();
    const push = source.push;
    if (!reader || !push) throw new Error("the answer holds no stream");
    push.enqueue(new TextEncoder().encode("part 1"));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const first = await Promise.race([
      reader.read(),
      new Promise<"held">((done) => {
        timer = setTimeout(() => done("held"), 2000);
      }),
    ]);
    clearTimeout(timer);
    assert.notEqual(first, "held", "the first part was held back: the answer is no stream");
    push.close();
    assert.equal((await reader.read()).done, true, "then the end");
  } finally {
    await s.close();
  }
});

test("AN15 her server times every answer (the speech route too) and still hands each through the no-store rule unread; a slow line names the server function a request ran", () => {
  const server = fs.readFileSync(path.join(APP, "src", "server.ts"), "utf8");
  assert.ok(
    /async fetch\(request: Request, env: unknown, ctx: unknown\) \{\s*return timedRequest\(request, \(\) => answer\(request, env, ctx\)\);\s*\}/.test(
      server,
    ),
    "the server's one door times every answer",
  );
  const body = server.slice(server.indexOf("async function answer("));
  assert.ok(
    body.indexOf("handleTtsApiRoute(request)") > 0,
    "the speech route is answered inside it",
  );
  const start = fs.readFileSync(path.join(APP, "src", "start.ts"), "utf8");
  assert.ok(
    /nameServerFn\(serverFnMeta\?\.name\)/.test(start) &&
      /functionMiddleware: \[[^\]]*nameServerFnMiddleware[^\]]*\]/.test(start),
    "every server function names itself for the line",
  );
});

// ======================================================================= item 5: identical reads share one call

test("AN16 two identical reads at once make one call and each gets the answer; two identities (two farmers, two devices) or two addresses make two; a write never shares; a failure reaches every caller sharing it; each caller keeps its own limit; nothing is kept once the call has ended", async () => {
  const s = await standIn();
  try {
    const at = (p: string) => s.hits.filter((h) => h.path === p).length;
    const read = (p: string, headers: Record<string, string> = {}, limitMs = 3000) =>
      outsideFetch("aiaic", `${s.url}${p}?wait=150`, { headers, limitMs, share: true });
    const g1 = { "x-aiaic-guest": "1".repeat(32) };
    const [a, b] = await Promise.all([
      read("/places/districts", g1),
      read("/places/districts", g1),
    ]);
    assert.equal(at("/places/districts"), 1, "two identical reads at once: one call");
    assert.equal(await a.text(), await b.text(), "the same answer to both, each its own");
    // two farmers, two devices: two calls each
    await Promise.all([
      read("/farmer/trade", { authorization: "Bearer standin-token-farmer-a" }),
      read("/farmer/trade", { authorization: "Bearer standin-token-farmer-b" }),
    ]);
    assert.equal(at("/farmer/trade"), 2, "two farmers never share");
    await Promise.all([
      read("/storage/verdict", { "x-aiaic-guest": "a".repeat(32) }),
      read("/storage/verdict", { "x-aiaic-guest": "b".repeat(32) }),
    ]);
    assert.equal(at("/storage/verdict"), 2, "two devices never share");
    // the whole address: another query is another read
    await Promise.all([
      outsideFetch("aiaic", `${s.url}/places/crops?wait=150&district=nashik`, {
        limitMs: 3000,
        share: true,
      }),
      outsideFetch("aiaic", `${s.url}/places/crops?wait=150&district=pune`, {
        limitMs: 3000,
        share: true,
      }),
    ]);
    assert.equal(at("/places/crops"), 2, "two addresses: two calls");
    // a write never shares, even asked to
    const write = () =>
      outsideFetch("aiaic", `${s.url}/farmer/trade/listings?wait=150`, {
        method: "POST",
        headers: { authorization: "Bearer standin-token-farmer-a" },
        body: '{"crop":"onion"}',
        limitMs: 3000,
        share: true,
      });
    await Promise.all([write(), write()]);
    assert.equal(at("/farmer/trade/listings"), 2, "a write never shares");
    // a failure reaches every caller sharing it: AIAIC's 500 to both, and a call past its limit to both
    const failing = () =>
      outsideFetch("aiaic", `${s.url}/places/fail?wait=150&status=500`, {
        limitMs: 3000,
        share: true,
      });
    const [f1, f2] = await Promise.all([failing(), failing()]);
    assert.deepEqual([f1.status, f2.status, at("/places/fail")], [500, 500, 1], "AIAIC's 500");
    const late = () =>
      outsideFetch("aiaic", `${s.url}/slow-head/shared`, { limitMs: 200, share: true });
    const settled = await Promise.allSettled([late(), late()]);
    assert.ok(
      settled.every((r) => r.status === "rejected" && isTimeout(r.reason)),
      "a call past its limit fails for both",
    );
    assert.equal(at("/slow-head/shared"), 1, "one call");
    // each caller keeps its own limit: one joining with a shorter limit gives up at its own
    const t0 = Date.now();
    const first = outsideFetch("aiaic", `${s.url}/slow-head/limits`, {
      limitMs: 2800,
      share: true,
    });
    await assert.rejects(
      () => outsideFetch("aiaic", `${s.url}/slow-head/limits`, { limitMs: 200, share: true }),
      (e: unknown) => isTimeout(e),
    );
    assert.ok(Date.now() - t0 < 1500, "the joiner gave up at its own limit, not the first one's");
    assert.equal((await first).status, 200, "the first one still gets its answer");
    assert.equal(at("/slow-head/limits"), 1);
    // nothing is kept once the call has ended
    await read("/places/districts", g1);
    assert.equal(at("/places/districts"), 2, "the same read after the call ended calls again");
    assert.equal(readsRunningForTests(), 0, "no read is left running");
  } finally {
    await s.close();
  }
});

test("AN17 her own calls share as the rule says: her sale record read twice at once is one call to AIAIC, two devices' advice reads are two, two sales are two; every AIAIC read door asks to share and the plant check and the speech never do", async () => {
  const s = await standIn();
  const savedBase = process.env["AIAIC_BASE_URL"];
  try {
    process.env["AIAIC_BASE_URL"] = s.url;
    client.resetForTests();
    asHer();
    const at = (p: string) => s.hits.filter((h) => h.path === p).length;
    const [m1, m2] = await Promise.all([client.getMine("en"), client.getMine("en")]);
    assert.ok(m1.ok && m2.ok, "both pages get her record");
    assert.equal(at("/farmer/trade"), 1, "her record read twice at once: one call");
    const w = (key: string) =>
      client.sell(key, { state: "mh", district: "nashik", crop: "onion", quantity_q: 10 });
    await Promise.all([w("ann-press-key-000000000001"), w("ann-press-key-000000000002")]);
    assert.equal(at("/farmer/trade/listings"), 2, "two sales: two calls");
    identity.sessionForTests(null);
    await Promise.all([
      identity.fetchForHer(
        `${s.url}/farmer/advice?wait=150`,
        { "x-aiaic-guest": "c".repeat(32) },
        3000,
      ),
      identity.fetchForHer(
        `${s.url}/farmer/advice?wait=150`,
        { "x-aiaic-guest": "d".repeat(32) },
        3000,
      ),
      identity.fetchForHer(
        `${s.url}/farmer/advice?wait=150`,
        { "x-aiaic-guest": "d".repeat(32) },
        3000,
      ),
    ]);
    assert.equal(at("/farmer/advice"), 2, "two devices: two calls; the same device twice: one");
  } finally {
    client.resetForTests();
    identity.sessionForTests(null);
    if (savedBase === undefined) delete process.env["AIAIC_BASE_URL"];
    else process.env["AIAIC_BASE_URL"] = savedBase;
    await s.close();
  }
  // the doors: every AIAIC read asks to share; the plant check and the speech (both writes) never do
  const asks: Record<string, string[]> = {};
  const lib = path.join(APP, "src", "lib");
  for (const f of fs.readdirSync(lib).filter((x) => /\.(server|functions)\.ts$/.test(x))) {
    const sf = ts.createSourceFile(
      f,
      fs.readFileSync(path.join(lib, f), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (n: import("typescript").Node): void => {
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === "outsideFetch"
      ) {
        const init = n.arguments[2];
        const share =
          init && ts.isObjectLiteralExpression(init)
            ? init.properties.find(
                (p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === "share",
              )
            : undefined;
        (asks[f] ??= []).push(
          share && ts.isPropertyAssignment(share) ? share.initializer.getText(sf) : "none",
        );
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  assert.deepEqual(asks, {
    "aiaic-account.server.ts": ['(init.method ?? "GET") === "GET"'],
    "aiaic-identity.server.ts": ["true"],
    "aiaic-trade.server.ts": ['(opts.method ?? "GET") === "GET"'],
    "catalog.functions.ts": ["true"],
    "places.functions.ts": ["true", "true", "true", "true", "true"],
    "plant.functions.ts": ["none"],
    "vaani-tts.server.ts": ["none"],
  });
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
