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
 *
 * Every server here is a stand-in on 127.0.0.1 started by this suite: no request leaves this machine, and no account,
 * token or password is a real one.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
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

import { TradeSwitch } from "../src/components/farm/aiaic/AiaicBits";
import { AppUpdatedLine } from "../src/components/farm/AppUpdatedNotice";
import {
  APP_UPDATED_HEADER,
  APP_UPDATED_MARKER,
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
