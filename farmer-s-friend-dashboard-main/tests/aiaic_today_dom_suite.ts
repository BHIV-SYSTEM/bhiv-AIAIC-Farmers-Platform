/**
 * HER GUIDED HOME, DRIVEN AS SHE USES IT (the Crowe Group EOD task, 16 Nov 2026, work package 1: `/today`).
 *
 * Run:  npx tsx tests/aiaic_today_dom_suite.ts   (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file;
 *       AIAIC_TEST_ONLY=TD1,TD4 runs only the tests whose names start so)
 *
 * The REAL page (`routes/today.tsx`: `CrisisFirst` around `TodayHome`) and the REAL landing (`routes/index.tsx`) are
 * mounted in jsdom under React's `act`, inside a TanStack Router of their own (memory history), and used as she uses them:
 * she reads, taps a card or a button, and comes back. jsdom does no layout: the 48 px and 16 px floors are read here from
 * each element's own style, and measured on the running stack by the walk's screenshots.
 *
 * WHAT ANSWERS HER PAGE, AND NOTHING LEAVES THIS MACHINE: AIAIC is a closed port of this machine; every connection and
 * every fetch is refused. Her page's two server functions are answered in this process: who she is (`whoAmI`), and her
 * sale records (`getMyTrade`) as this server's own reading (`mineForBrowser`) of AIAIC's RECORDED answers to
 * `GET /farmer/trade` (her fixtures, each held to the sha256 her trade manifest names; a file missing or named by no
 * manifest fails the suite, naming it). One of them is DERIVED and says so (`_derived`, never `_recorded`):
 * `derived_mine_report_without_amount.json`, the recording `payout_mine_dlite_direct.json` with only the fields AIAIC sets
 * after her word "I got the money" sent without an amount (the trade suite's A16 re-derives it field by field); it is held
 * to the manifest's sha256 too, and to the recording the manifest says it comes from. AIAIC's Marathi crop and district
 * names come from its recorded
 * `GET /places/crops` for Nashik in Marathi (`places_crops_nashik_mh_mr.json`, in no manifest: held here to the sha256 it
 * has at 11e7c1a).
 *
 * DERIVED, IN MEMORY, AND SAID IN EACH TEST: a failed read (`aiaic_unavailable`, `aiaic_signed_out`: this app's own
 * problem codes; a read that throws, the phone's network lost), AIAIC's crisis answer as her server reads it
 * (`problem("crisis", ...)` with the helplines of AIAIC's recorded crisis answer), a lot she listed after she started a sale
 * here (a recorded lot, its `created_at` moved), an AIAIC that sends no lane (a recorded order, its `lane` removed), a
 * sale whose quantities were checked (a recorded collect order given a pickup, a delivery and a reconciliation, and
 * AIAIC's lane for that), a sale called off after its link was made (a recorded collect order, its state cancelled), a
 * sale called off after people's word of a payment made outside AIAIC (TD18: recorded orders given only the fields AIAIC's
 * call-off sets, after a word as AIAIC keeps it), the recorded group journey with the buyer's pay terms not said, with its
 * link sent and not paid, and called off before any link with only the fields AIAIC's call-off sets (TD2), a lot with no
 * offer (a recorded practice lot, its offer removed), and Hindi crop and district names (no Hindi place list is recorded
 * in her fixtures).
 *
 * THE ENGLISH SAFETY WORDS AND THE MONEY FIGURES ARE PINNED LITERALLY (the fix round of 16 Nov 2026, the skeptic's
 * SK-ANN-2): an estimate said as an estimate, the uncalibrated warning, the guest's practice line, the practice labels,
 * the Kisan Call Centre's number, and every figure the recorded one (`EN`, `inr`): never read from the dictionary the page
 * renders, so a changed safety word fails here.
 */
process.env["AIAIC_BASE_URL"] = "http://127.0.0.1:9";
// THE ROUTER'S BROWSER HALF IN JSDOM (as the kit suites): under Node, TanStack Router's `isServer` is true unless NODE_ENV is
// "test", and such a router never listens to its history. The app reads NODE_ENV only for "production".
process.env["NODE_ENV"] = "test";
for (const k of [
  "AIAIC_FARMER_USERNAME",
  "AIAIC_FARMER_PASSWORD",
  "AIAIC_FARMER_APP_KEY",
  "AIAIC_VISITOR_ADDRESS_FROM",
])
  delete process.env[k];

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(here, "fixtures", "aiaic");
const SUITE = "aiaic_today_dom_suite";

/** `assert.ok` with a message always (given none, Node names another line under tsx). */
const ok: (value: unknown, message: string) => asserts value = (value, message) => {
  assert.equal(Boolean(value), true, message);
};

// ------------------------------------------------------------------------------- the guard: nothing leaves

const outside: string[] = [];
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guarded(this: net.Socket, ...args: unknown[]) {
  const first = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0];
  const pipe =
    (typeof first === "object" && first !== null && "path" in first) ||
    (typeof first === "string" && Number.isNaN(Number(first)));
  if (pipe) return (connect as (...a: unknown[]) => net.Socket).apply(this, args);
  outside.push("a connection");
  process.nextTick(() => this.destroy(new Error("refused by the suite's guard")));
  return this;
} as typeof net.Socket.prototype.connect;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  outside.push(`fetch ${init?.method ?? "GET"} ${url}`);
  throw new TypeError("refused by the suite's guard");
}) as typeof fetch;
const rejections: string[] = [];
let unansweredCalls: () => string[] = () => [];
process.on("unhandledRejection", (e) => {
  rejections.push(String(e).split("\n")[0] ?? "");
});

// ------------------------------------------------------------------------- AIAIC's recordings, held to their bytes

const readFrom: Record<string, string> = {};
const lfSha = (file: string) =>
  createHash("sha256")
    .update(Buffer.from(fs.readFileSync(file, "utf-8").replace(/\r\n/g, "\n"), "utf-8"))
    .digest("hex");
/** AIAIC's recorded answer to GET /farmer/trade, from her fixtures, held to the trade manifest's sha256. */
function recording(name: string): Record<string, unknown> {
  const file = path.join(FIXTURES, `${name}.json`);
  ok(fs.existsSync(file), `${name}.json is not in her fixtures`);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, "trade_recording_manifest.json"), "utf-8"),
  ) as { files: Record<string, { sha256?: string }> };
  const held = manifest.files[`${name}.json`]?.sha256;
  ok(held, `${name}.json is in her fixtures but named by no manifest`);
  assert.equal(lfSha(file), held, `${name}.json is not the file the trade manifest names`);
  const r = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
  const route = (r["_recorded"] as { route?: string } | undefined)?.route;
  assert.equal(route, "GET /farmer/trade", `${name}.json is AIAIC's answer to GET /farmer/trade`);
  readFrom[name] = "her fixtures (the trade manifest's sha256)";
  return r["answer"] as Record<string, unknown>;
}
/** A DERIVED answer to GET /farmer/trade in her fixtures (`_derived`: AIAIC's recording named in its `from`, with only the
 *  fields in its `changes` set as AIAIC's engine sets them), held to the trade manifest's sha256 and to the recording the
 *  manifest says it is derived from. */
function derived(name: string): Record<string, unknown> {
  const file = path.join(FIXTURES, `${name}.json`);
  ok(fs.existsSync(file), `${name}.json is not in her fixtures`);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, "trade_recording_manifest.json"), "utf-8"),
  ) as { files: Record<string, { sha256?: string; derived_from?: string }> };
  const held = manifest.files[`${name}.json`];
  ok(held?.sha256, `${name}.json is in her fixtures but named by no manifest`);
  assert.equal(lfSha(file), held.sha256, `${name}.json is not the file the trade manifest names`);
  const r = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
  ok(!r["_recorded"], `${name}.json is derived, never said as a recording`);
  const d = r["_derived"] as { route?: string; from?: string } | undefined;
  assert.equal(
    d?.route,
    "GET /farmer/trade",
    `${name}.json is derived from an answer to GET /farmer/trade`,
  );
  ok(held.derived_from, `the manifest says what ${name}.json is derived from`);
  assert.equal(
    d?.from,
    held.derived_from,
    `${name}.json comes from the recording the manifest names`,
  );
  ok(
    manifest.files[held.derived_from]?.sha256,
    `${held.derived_from} is a recording the manifest holds`,
  );
  readFrom[name] = `her fixtures (DERIVED from ${held.derived_from}; the trade manifest's sha256)`;
  return r["answer"] as Record<string, unknown>;
}
/** AIAIC's Marathi crop and district names for Nashik (its recorded GET /places/crops), held to its bytes at 11e7c1a. */
const MR_CROPS_SHA = "b063d73d68e8834737016791e3e6e6019d7ff22d80a1b4f3b12da11b87387798";
function marathiNames(): { crops: Record<string, string>; districts: Record<string, string> } {
  const file = path.join(FIXTURES, "places_crops_nashik_mh_mr.json");
  ok(fs.existsSync(file), "places_crops_nashik_mh_mr.json is not in her fixtures");
  assert.equal(
    lfSha(file),
    MR_CROPS_SHA,
    "places_crops_nashik_mh_mr.json is the recording of 11e7c1a",
  );
  const a = (JSON.parse(fs.readFileSync(file, "utf-8")) as { answer: Record<string, unknown> })
    .answer as { district: string; crops: { crop: string; name: string }[] };
  readFrom["places_crops_nashik_mh_mr"] = "her fixtures (sha256 pinned in this suite)";
  return {
    crops: Object.fromEntries(a.crops.map((c) => [c.crop, c.name])),
    districts: { Nashik: a.district, nashik: a.district },
  };
}

// ------------------------------------------------------------------------------------------------ the runner

type Result = { name: string; ok: boolean; ms: number; error?: string };
const results: Result[] = [];
const tests: { name: string; run: () => Promise<void> }[] = [];
const ONLY = (process.env["AIAIC_TEST_ONLY"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
function test(name: string, run: () => Promise<void>) {
  if (ONLY.length && !ONLY.some((p) => name.startsWith(`${p} `))) return;
  tests.push({ name, run });
}
let around: ((fn: () => Promise<void>) => Promise<void>) | null = null;

type Lang = "en" | "mr" | "hi";

function domGlobals(window: Record<string, unknown>) {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const k of Object.getOwnPropertyNames(window)) {
    if (k in g) continue;
    try {
      Object.defineProperty(g, k, { value: window[k], configurable: true, writable: true });
    } catch {
      /* a name the global keeps */
    }
  }
  for (const k of ["window", "document", "navigator", "localStorage", "sessionStorage"])
    Object.defineProperty(g, k, {
      value: k === "window" ? window : window[k],
      configurable: true,
      writable: true,
    });
  g["IS_REACT_ACT_ENVIRONMENT"] = true;
  const w = window as unknown as { HTMLElement: { prototype: Record<string, unknown> } };
  w.HTMLElement.prototype["scrollIntoView"] = function scrollIntoView() {
    /* jsdom does no layout */
  };
  const noScroll = () => undefined;
  for (const k of ["scrollTo", "scroll", "scrollBy"]) {
    Object.defineProperty(window, k, { value: noScroll, configurable: true, writable: true });
    Object.defineProperty(g, k, { value: noScroll, configurable: true, writable: true });
  }
  Object.defineProperty(window, "innerWidth", { value: 360, configurable: true });
}

async function loadApp() {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const router = await import("@tanstack/react-router");
  const { runWithStartContext } = await import("@tanstack/start-storage-context");
  const { DICTS, I18nProvider } = await import("../src/lib/i18n");
  const { Route: TodayRoute } = await import("../src/routes/today");
  const { Route: IndexRoute } = await import("../src/routes/index");
  const { whoAmI } = await import("../src/lib/aiaic-account.functions");
  const { getMyTrade } = await import("../src/lib/aiaic-trade.functions");
  const { mineForBrowser } = await import("../src/lib/aiaic-trade.server");
  const { problem, laneOf, moneyCard, paymentLine, groupView, groupSaid, groupPaidWords } =
    await import("../src/lib/aiaic-trade");
  const today = await import("../src/lib/aiaic-today");
  return {
    React,
    createRoot,
    QueryClient,
    QueryClientProvider,
    router,
    runWithStartContext,
    DICTS,
    I18nProvider,
    TodayRoute,
    IndexRoute,
    whoAmI,
    getMyTrade,
    mineForBrowser,
    problem,
    laneOf,
    moneyCard,
    paymentLine,
    groupView,
    groupSaid,
    groupPaidWords,
    today,
  };
}
type App = Awaited<ReturnType<typeof loadApp>>;

// ------------------------------------------------------------------------------------------------ the suite

function suite(app: App, window: Window & typeof globalThis) {
  const { React, DICTS } = app;
  const { act, createElement: h } = React;
  const document = window.document;
  const words = (lang: Lang, key: string) => DICTS[lang][key] ?? `(no ${lang} word for ${key})`;
  const fill = (lang: Lang, key: string, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      words(lang, key),
    );
  /** A day as India's (UTC+5:30), worked out here apart from the app's own `dayOf`. */
  const istDay = (iso: string) =>
    new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 10);
  /** Rupees as her pages write them, worked out here apart from the app's own `rupees`. */
  const inr = (n: number) => {
    const whole = Number.isInteger(n);
    return `₹${n.toLocaleString("en-IN", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    })}`;
  };
  /** THE ENGLISH SAFETY WORDS, PINNED LITERALLY (SK-ANN-2): never read from the dictionary the page renders. */
  const EN = {
    estimate: (amount: string) => `To you: ${amount} (an estimate until it reaches your bank)`,
    reached: (amount: string) => `Reached your bank: ${amount}`,
    gross: (amount: string) => `Agreed price: ${amount}`,
    commission: (pct: number, amount: string) => `AIAIC's commission (${pct}%): ${amount}`,
    gst: (pct: number, amount: string) => `GST on the commission (${pct}%): ${amount}`,
    transport: "Transport: no part of AIAIC's figures for this sale",
    noneDue: "Nothing is due to you on this sale: it was called off.",
    held: "AIAIC holds your money",
    stopped: "No money moves on this sale",
    warning:
      "A demonstration, not checked by farm scientists: a suggestion to discuss, never an instruction.",
    guest: "Sign in to see your own sales here. As a guest, selling in this app is practice only.",
    practice: "Practice",
    practiceTip: "A practice account: no real money, no real produce.",
    practiceStep: "(practice step)",
    kcc: "Kisan Call Centre 1800-180-1551",
    kccTel: "tel:18001801551",
    reconciled: "Quantities checked",
    problemStep: "A problem reported",
    seenByTeam: "seen by AIAIC's team",
    notRefreshed: "Could not refresh just now: this is what AIAIC said last.",
    savedFarm: "For your saved crop and district",
    // people's word of a payment made outside AIAIC, in AIAIC's own sentences (RC-ANN-3), and the words never said beside it
    saidGot: (amount: string, day: string) =>
      `You told us you got ${amount} on ${day}. AIAIC did not see this payment itself.`,
    saidGotAny: "You told us you got the money. AIAIC did not see this payment itself.",
    saidNotYet: "You told us the money has not come. This is on the AIAIC team's list.",
    buyerSays: (amount: string) =>
      `The buyer says they paid ${amount}. Check your own bank's message or UPI app.`,
    ask: "Did the buyer pay you? First check your own bank's message or UPI app.",
    notPaid: "The buyer has not paid",
    buyerPaid: "The buyer paid",
    inBank: "In your bank (the payment company's word)",
    // the buyer's payment on a group sale while no link is made, as the group sale's own page says it at its money step
    // (RC2-ANN-2), and the no-link line never said there
    groupPays: (days: number) => `The buyer says it pays within ${days} days of delivery.`,
    groupAwaited: "The buyer's payment is awaited.",
    noPayment: "No payment yet",
    paidByProvider: "The buyer paid (the payment company's word)",
    linkSent: "Link sent to the buyer: not paid yet",
    beforeHandover: "before you hand over",
  };
  /** A read that throws: the phone lost its network (DERIVED). */
  const LOST = Symbol("the phone lost its network");

  // --------------------------------------------------------------- AIAIC's recorded answers, read by her server
  const JOURNEY = recording("connected_farmer_mine_journey");
  const PAID = recording("collect_mine_paid");
  const SENDING = recording("collect_mine_processing");
  const REACHED = recording("collect_mine_processed");
  const OFFER = recording("practice_mine_with_offer");
  const EMPTY = recording("practice_mine_empty");
  const MANY = recording("buyer_farmer_mine_more_time");
  const REAL = recording("farmer_app_mine_offer_expired");
  const HELD = recording("farmer_app_refund_mine_held");
  const DIRECT = recording("payout_mine_dlite_direct");
  const NO_AMOUNT = derived("derived_mine_report_without_amount");
  const MR = marathiNames();
  /** DERIVED: Hindi names standing for AIAIC's (no Hindi place list is recorded in her fixtures). */
  const HI = {
    crops: { onion: "प्याज", tur: "तूर" },
    districts: { Nashik: "नासिक", nashik: "नासिक" },
  };
  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  type Raw = Record<string, unknown> & {
    listings: Record<string, unknown>[];
    orders: Record<string, unknown>[];
  };
  const screenOf = (raw: Record<string, unknown>, lang: Lang = "en") => ({
    ok: true as const,
    data: {
      mine: app.mineForBrowser(copy(raw)),
      cropNames: lang === "mr" ? MR.crops : lang === "hi" ? HI.crops : {},
      districtNames: lang === "mr" ? MR.districts : lang === "hi" ? HI.districts : {},
    },
  });

  const world = {
    signedIn: true,
    trade: null as unknown,
    calls: 0,
  };
  const handlers = new Map<unknown, string>();
  const named = { whoAmI: app.whoAmI, getMyTrade: app.getMyTrade };
  const unanswered: string[] = [];
  unansweredCalls = () => unanswered.splice(0);
  const rpc = {
    options: {
      client: async (ctx: Record<string, unknown>) => {
        const name = handlers.get(ctx["extractedFn"]);
        if (name === "whoAmI")
          return {
            ...ctx,
            result: {
              signedIn: world.signedIn,
              username: world.signedIn ? "practice-farmer" : null,
              displayName: null,
              signedOutNote: false,
              erasedNote: false,
            },
          };
        if (name === "getMyTrade") {
          world.calls += 1;
          if (world.trade === LOST) throw new TypeError("the phone lost its network");
          return { ...ctx, result: world.trade };
        }
        unanswered.push(String(name ?? "a server function this suite does not know"));
        throw new Error("a server function this suite does not answer");
      },
    },
  };
  around = (fn) =>
    app.runWithStartContext({ startOptions: { functionMiddleware: [rpc] } } as never, fn);
  const learn = async () => {
    for (const [name, fn] of Object.entries(named)) {
      const reader = {
        options: {
          client: async (ctx: Record<string, unknown>) => {
            handlers.set(ctx["extractedFn"], name);
            return { ...ctx, result: null };
          },
        },
      };
      await app.runWithStartContext(
        { startOptions: { functionMiddleware: [reader] } } as never,
        () => (fn as (opts: { data: unknown }) => Promise<unknown>)({ data: { lang: "en" } }),
      );
    }
    assert.equal(
      new Set([...handlers.keys()].filter((x) => typeof x === "function")).size,
      Object.keys(named).length,
      "each server function the page calls is told apart by its own handler",
    );
  };

  // ------------------------------------------------------------------------------------------- her finger
  const turn = () =>
    new Promise<void>((done) => {
      let fired = false;
      setTimeout(() => {
        fired = true;
        done();
      }, 0);
      const spin = () => {
        if (!fired) setImmediate(spin);
      };
      setImmediate(spin);
    });
  const settle = async (ms = 150) => {
    const from = Date.now();
    for (let i = 0; i < 30 || Date.now() - from < ms; i++)
      await act(async () => {
        await turn();
      });
  };
  const waitFor = async <T>(find: () => T, what: string): Promise<NonNullable<T>> => {
    for (let i = 0; i < 60; i++) {
      const v = find();
      if (v) return v as NonNullable<T>;
      await settle(50);
    }
    assert.fail(`${what}: not there after 3 s`);
  };

  // ------------------------------------------------------------------------------------------- her page
  type Page = Awaited<ReturnType<typeof mount>>;
  const mount = async (
    lang: Lang,
    trade: unknown,
    { signedIn = true, at = "/today", keep = false } = {},
  ) => {
    world.signedIn = signedIn;
    world.trade = trade;
    world.calls = 0;
    if (!keep) {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
    window.localStorage.setItem("aiaic.lang", lang);
    const qc = new app.QueryClient({ defaultOptions: { queries: { retry: false } } });
    const R = app.router;
    const root = R.createRootRoute({
      component: () =>
        h(app.QueryClientProvider, {
          client: qc,
          children: h(app.I18nProvider, { initialLang: lang, children: h(R.Outlet) }),
        }),
    });
    const todayRoute = app.TodayRoute.update({
      id: "/today",
      path: "/today",
      getParentRoute: () => root,
    } as never);
    const indexRoute = app.IndexRoute.update({
      id: "/",
      path: "/",
      getParentRoute: () => root,
    } as never);
    const router = R.createRouter({
      routeTree: root.addChildren([todayRoute as never, indexRoute as never]),
      history: R.createMemoryHistory({ initialEntries: [at] }),
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const reactRoot = app.createRoot(container);
    await app.runWithStartContext(
      { startOptions: { functionMiddleware: [rpc] } } as never,
      async () => {
        await act(async () => {
          await router.load();
          reactRoot.render(h(R.RouterProvider, { router: router as never }));
        });
      },
    );
    await settle(300);
    const q = (sel: string) => container.querySelector(sel);
    const all = (sel: string) => [...container.querySelectorAll(sel)];
    return {
      container,
      router,
      q,
      all,
      text: () => (container.textContent ?? "").replace(/\s+/g, " "),
      items: () => all('[data-testid="today-item"]'),
      /** Her records read again, as the page does every 15 s and when she comes back to it. */
      reread: async () => {
        await app.runWithStartContext(
          { startOptions: { functionMiddleware: [rpc] } } as never,
          async () => {
            await act(async () => {
              await qc.refetchQueries({ queryKey: ["aiaic-mine"] });
            });
            await settle(200);
          },
        );
      },
      unmount: async () => {
        await act(async () => reactRoot.unmount());
        container.remove();
        qc.clear();
      },
    };
  };
  const press = async (el: Element | null | undefined, what: string) => {
    ok(el, `there is ${what} to press`);
    await app.runWithStartContext(
      { startOptions: { functionMiddleware: [rpc] } } as never,
      async () => {
        await act(async () => {
          (el as HTMLElement).click();
        });
        await settle(200);
      },
    );
  };
  /** Her page once AIAIC's records are on it (or its problem, or its empty state). */
  const ready = (p: Page) =>
    waitFor(
      () =>
        p.q('[data-testid="today-items"]') ??
        p.q('[data-testid="today-empty"]') ??
        p.q('[data-testid="today-problem"]') ??
        p.q("[data-crisis]") ??
        p.q('[data-testid="today-guest"]'),
      "her page, read",
    );
  const statusOf = (scope: Element, testid: string) => {
    const box = scope.querySelector(`[data-testid="${testid}"]`);
    ok(box, `${testid} is on her sale`);
    return {
      codes: [...box.querySelectorAll("[data-status]")].map((s) => s.getAttribute("data-status")),
      text: (box.querySelector("dd")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  };
  /** What her GROUP sale's own page says at its money step (`GroupSaleSteps`: AIAIC's sentence for her money,
   *  `groupPaidWords`, else the step's own words, `groupSaid`), from AIAIC's answer as her server reads it and the offer
   *  the page finds for the order (`AiaicOrderDetail`); and whether that page draws a payment card (only once a link is
   *  made). */
  const groupPage = (lang: Lang, raw: Record<string, unknown>) => {
    const mine = app.mineForBrowser(copy(raw));
    const order = mine.orders[0];
    ok(order?.pool, "a group sale's order with its group facts");
    const offer =
      mine.listings.flatMap((l) => l.offers).find((o) => o.offer_id === order.offer_id) ?? null;
    const t = (k: string, v?: Record<string, string | number>) => fill(lang, k, v ?? {});
    const paid = app.groupView(order.pool, offer, order, {}).steps.find((s) => s.key === "paid");
    ok(paid && paid.state !== "none", "the group page's money step is part of her sale");
    return {
      moneyStep: app.groupPaidWords(t, order) ?? app.groupSaid(t, paid.say),
      paymentCard: order.payment.link_made,
    };
  };
  const hrefOf = (el: Element | null) => el?.getAttribute("href") ?? null;
  /** AIAIC's crisis answer as her server reads it, with the helplines of AIAIC's recorded crisis answer (DERIVED). */
  const crisisProblem = () => {
    const crisisAnswer = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, "safety_check_crisis.json"), "utf-8"),
    ) as {
      answer: {
        answer: string;
        message: string;
        talk_to_someone: { name: string; phone: string }[];
      };
    };
    return app.problem("crisis", {
      crisis: {
        answer: crisisAnswer.answer.answer,
        message: crisisAnswer.answer.message,
        helplines: crisisAnswer.answer.talk_to_someone.map((x) => ({
          name: x.name,
          phone: x.phone,
        })),
      },
    });
  };
  const latinIn = (root: Element) => {
    const out: string[] = [];
    const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest("[data-name]")) continue;
      for (const w of (n.textContent ?? "").match(/[A-Za-z]{2,}/g) ?? [])
        if (w !== "AIAIC") out.push(w);
    }
    for (const el of root.querySelectorAll("[aria-label],[title],[placeholder]"))
      for (const at of ["aria-label", "title", "placeholder"])
        for (const w of el.getAttribute(at)?.match(/[A-Za-z]{2,}/g) ?? [])
          if (w !== "AIAIC") out.push(w);
    return out;
  };

  // ============================================================================================ TD1

  test("TD1 AIAIC's lane reaches her page through her server's own reading, field by field: its code and whom the sale waits on, from AIAIC's recorded answer; a code or a waiting word outside AIAIC's lists is none", async () => {
    const raw = JOURNEY as Raw;
    const recorded = raw.orders[0]?.["lane"] as Record<string, unknown>;
    assert.deepEqual(
      { code: recorded["code"], waiting_on: recorded["waiting_on"] },
      { code: "being_readied", waiting_on: "farmer" },
      "the recording: being readied, waiting on her",
    );
    const read = app.mineForBrowser(copy(raw)).orders[0]?.lane;
    assert.deepEqual(
      read,
      { code: "being_readied", since: recorded["since"], waiting_on: "farmer", synthetic: true },
      "her server passes AIAIC's lane, field by field",
    );
    assert.equal(
      app.laneOf({ ...recorded, code: "shipped" }),
      null,
      "a code outside AIAIC's list is no lane",
    );
    assert.equal(
      app.laneOf({ ...recorded, waiting_on: "partner:courier" })?.waiting_on,
      null,
      "a waiting word outside AIAIC's list is none",
    );
    assert.equal(app.laneOf("agreed"), null, "a lane that is not a block is none");
    const withExtra = app.mineForBrowser({
      ...copy(raw),
      orders: [{ ...copy(raw.orders[0]), lane: { ...recorded, note: "kept on AIAIC's side" } }],
    }).orders[0]?.lane as Record<string, unknown> | null | undefined;
    ok(
      withExtra && !("note" in withExtra),
      "nothing else of AIAIC's lane block reaches her browser",
    );
  });

  // ============================================================================================ TD2

  test("TD2 her sale on AIAIC's recorded group journey: four separate states (the order being readied, no payment, the collection and the testing each a practice step done, her money not paid), said as part of a group sale with no stale handover step and no 'needs you' (AUD-3), and no 'step n of 5' of a sale sold alone, on the recording, on a copy whose buyer paid and on one whose group facts AIAIC did not send (RC-ANN-1); the buyer's payment while no link is made said as the group sale's own page says it at its money step ('The buyer says it pays within 3 days of delivery.', in English, Marathi and Hindi; the buyer's terms not said: 'awaited'; no group facts sent: the payment's own state), never 'agree the payment with the buyer before you hand over', a link made (paid, or sent and not paid): the sale page's own line, which the group page's payment card says too, called off before any link: the sale page's own line there (the payment's own state), and a sale sold alone keeps its page's line (RC2-ANN-2); and a direct sale waiting on her (AIAIC's recording of a real account): her next step in the order's own terms, whom it waits on (her), 'needs you', no practice word; the sale's own page one press away", async () => {
    const direct = await mount("en", screenOf(HELD));
    try {
      await ready(direct);
      const raw = (HELD as Raw).orders.find(
        (o) => o["her_next_step"] === "farmer_delivers" && !o["pool_id"],
      ) as Record<string, unknown>;
      ok(raw, "the recording holds a direct sale she delivers");
      const sale = direct
        .items()
        .find((i) => i.getAttribute("data-id") === String(raw["order_id"])) as Element;
      ok(sale, "that sale is on her page");
      assert.equal(
        sale.querySelector('[data-testid="today-next"]')?.textContent,
        words("en", "aiaic.sale.next.farmer_delivers"),
        "her next step, in the order's own terms",
      );
      assert.equal(
        sale.querySelector('[data-testid="today-waiting"]')?.getAttribute("data-waiting"),
        "farmer",
      );
      assert.equal(
        sale.querySelector('[data-testid="today-waiting"]')?.textContent,
        words("en", "aiaic.today.waiting.farmer"),
      );
      ok(sale.querySelector('[data-testid="today-needs-you"]'), "it says it needs her");
      ok(
        !sale.querySelector('[data-testid="today-practice-chip"]'),
        "a real sale: no practice word",
      );
      const firstNeeds = direct.items()[0]?.querySelector('[data-testid="today-needs-you"]');
      ok(firstNeeds, "what needs her leads the page");
    } finally {
      await direct.unmount();
    }
    const p = await mount("en", screenOf(JOURNEY));
    try {
      await ready(p);
      const items = p.items();
      assert.equal(items.length, 1, "one sale");
      const sale = items[0] as Element;
      assert.equal(sale.getAttribute("data-kind"), "sale");
      const order = statusOf(sale, "today-state-order");
      const pay = statusOf(sale, "today-state-payment");
      const delivery = statusOf(sale, "today-state-delivery");
      const money = statusOf(sale, "today-state-money");
      assert.deepEqual(order.codes, ["being_readied"], "the order: AIAIC's lane");
      const recordedLane = (JOURNEY as Raw).orders[0]?.["lane"] as Record<string, unknown>;
      assert.equal(
        sale.querySelector('[data-testid="today-lane-word"]')?.textContent,
        "Being readied",
        "the order's word",
      );
      assert.equal(
        sale.querySelector('[data-testid="today-lane-since"]')?.textContent,
        `since ${istDay(String(recordedLane["since"]))}`,
        "since when, as AIAIC records it (SK-ANN-4)",
      );
      assert.deepEqual(pay.codes, ["not_connected"], "the buyer's payment: its own state");
      // ITS WORDS (RC2-ANN-2): her lot was collected at the collection centre, no link is made, and AIAIC still says
      // `not_handed_over_yet`; the group sale's own page draws no payment card here and says, at its money step, how
      // fast the buyer pays. Never the no-link line's "agree the payment with the buyer before you hand over"
      const recordedMoney = (JOURNEY as Raw).orders[0]?.["money"] as Record<string, unknown>;
      assert.deepEqual(
        [
          ((JOURNEY as Raw).orders[0]?.["pool"] as Record<string, unknown>)["pay_within_days"],
          (recordedMoney["why_not_report"] as Record<string, unknown>)["code"],
        ],
        [3, "not_handed_over_yet"],
        "the recording: the buyer pays within 3 days; AIAIC still says her produce is not handed over",
      );
      assert.equal(
        pay.text,
        EN.groupPays(3),
        `the buyer's payment on a group sale with no link: the group page's money step, never "before you hand over" (RC2-ANN-2; it said "${pay.text}")`,
      );
      const page = groupPage("en", JOURNEY);
      assert.deepEqual(
        [pay.text, page.paymentCard],
        [page.moneyStep, false],
        "as the group sale's own page says it at its money step, where it draws no payment card",
      );
      ok(
        !(sale.textContent ?? "").includes(EN.beforeHandover),
        "nothing on her group sale says 'before you hand over'",
      );
      assert.deepEqual(
        delivery.codes,
        ["aggregation:done", "quality_grading:done"],
        "the delivery: each step AIAIC recorded, testing among them",
      );
      ok(
        delivery.text.includes(words("en", "aiaic.today.stage.quality_grading")) &&
          sale.querySelectorAll('[data-testid="today-practice-step"]').length === 2,
        "each recorded step says it is a practice step",
      );
      const recordedSteps = (JOURNEY as Raw).orders[0]?.["fulfilment"] as Record<string, unknown>[];
      assert.deepEqual(
        [...sale.querySelectorAll('[data-testid="today-step-known"]')].map((e) => e.textContent),
        recordedSteps.map((x) => istDay(String(x["created_at"]))),
        "each step's day, as AIAIC recorded it (SK-ANN-4)",
      );
      assert.deepEqual(money.codes, ["not_paid"], "her money: its own state");
      const four = new Set([order.text, pay.text, delivery.text, money.text]);
      assert.equal(four.size, 4, "four states, four different words: never one blended state");
      const recorded = (JOURNEY as Raw).orders[0] as Record<string, unknown>;
      assert.deepEqual(
        [recorded["her_next_step"], (recorded["lane"] as Record<string, unknown>)["waiting_on"]],
        ["collection_point", "farmer"],
        "the recording: AIAIC still names her handover after the collection was recorded",
      );
      assert.equal(
        p.q('[data-testid="today-group"]')?.textContent,
        words("en", "aiaic.today.sale.group"),
        "said as part of a group sale, its steps on the sale's page",
      );
      ok(
        !p.q('[data-testid="today-next"]') && !p.q('[data-testid="today-waiting"]'),
        "no stale handover step, nobody named as waited on (AUD-3)",
      );
      ok(!sale.querySelector('[data-testid="today-needs-you"]'), "no 'needs you' on a stale word");
      ok(
        !sale.querySelector('[data-testid="today-progress"]'),
        `a group sale: no 'step n of 5' of a sale sold alone, whose steps say another step and number than the group's own page (RC-ANN-1; it said "${p.q('[data-testid="today-progress"]')?.textContent ?? ""}")`,
      );
      ok(
        sale.querySelector('[data-testid="today-practice-chip"]'),
        "a practice sale says practice",
      );
      const orderId = String((JOURNEY as Raw).orders[0]?.["order_id"]);
      assert.equal(
        hrefOf(p.q('[data-testid="today-see-sale"]')),
        `/orders/${orderId}`,
        "the sale's own page",
      );
      for (const s of sale.querySelectorAll("[data-status]"))
        ok(
          s.querySelector("svg") && (s.textContent ?? "").trim().length > 2,
          `the status ${s.getAttribute("data-status")} has an icon and a word, never colour alone`,
        );
    } finally {
      await p.unmount();
    }
    // DERIVED, in memory: the same recorded group order with the buyer's payment made (in a group sale the payment comes
    // after the collection: `payment_state` and the payment's state paid, a link made; the re-check's RC-ANN-1 case, where
    // the page said "Step 3 of 5: handing over your produce" while her produce was at the collection point), and the same
    // order with AIAIC's group facts not sent (`pool` removed, `pool_id` kept: an AIAIC that sends none)
    const paidCopy = copy(JOURNEY) as Raw;
    const paidOrder = paidCopy.orders[0] as Record<string, unknown>;
    paidOrder["payment_state"] = "paid";
    paidOrder["payment"] = {
      ...(paidOrder["payment"] as Record<string, unknown>),
      state: "paid",
      link_made: true,
    };
    const bare = copy(JOURNEY) as Raw;
    delete (bare.orders[0] as Record<string, unknown>)["pool"];
    ok((bare.orders[0] as Record<string, unknown>)["pool_id"], "the bare copy keeps its pool_id");
    // DERIVED, in memory: the same recorded group order with the buyer's pay terms not said (`pool.pay_within_days` null)
    const noTerms = copy(JOURNEY) as Raw;
    ((noTerms.orders[0] as Record<string, unknown>)["pool"] as Record<string, unknown>)[
      "pay_within_days"
    ] = null;
    // DERIVED, in memory: the same recorded group order with the buyer's link made and not paid (`payment_state` and the
    // payment's state link_created, a link made). Its group page then draws its payment card, and its money step is
    // still awaited, so only the link decides what is said (the paid copy's money step is not awaited)
    const linkCopy = copy(JOURNEY) as Raw;
    const linkOrder = linkCopy.orders[0] as Record<string, unknown>;
    linkOrder["payment_state"] = "link_created";
    linkOrder["payment"] = {
      ...(linkOrder["payment"] as Record<string, unknown>),
      state: "link_created",
      link_made: true,
    };
    // DERIVED, in memory: the same recorded group order called off before any link, with only the fields AIAIC's call-off
    // sets (`store.cancel_order`: the state, the reason's code, the time, the lane called off; `money_for_her`: no report
    // taken, order_closed). Its money step is no longer awaited (stopped), and nobody's word is held
    const offCopy = copy(JOURNEY) as Raw;
    const offOrder = offCopy.orders[0] as Record<string, unknown>;
    const offAt = "2026-11-14T06:00:00+00:00";
    offOrder["order_state"] = "cancelled";
    offOrder["cancel_reason_code"] = "buyer_called_off";
    offOrder["updated_at"] = offAt;
    offOrder["lane"] = { code: "called_off", since: offAt, waiting_on: null, synthetic: true };
    const offMoney = offOrder["money"] as Record<string, unknown>;
    offMoney["can_report"] = false;
    offMoney["why_not_report"] = {
      code: "order_closed",
      why: "The order was called off: it takes no payment report.",
    };
    // the buyer's payment on each (RC2-ANN-2): a link made (paid, or sent and not paid), the sale page's own line, which
    // the group page's payment card says too; no group facts sent, the payment's own state; the buyer's terms not said,
    // the group page's money step for that; called off before any link, the sale page's own line on a sale called off
    // (the payment's own state, as before the fix); never "before you hand over"
    for (const [raw, what, code, paySaid, says] of [
      [paidCopy, "the buyer paid", "paid", EN.paidByProvider, "line"],
      [linkCopy, "a link sent to the buyer, not paid", "link_created", EN.linkSent, "line"],
      [bare, "AIAIC's group facts not sent", "not_connected", EN.noPayment, "state"],
      [noTerms, "the buyer's pay terms not said", "not_connected", EN.groupAwaited, "step"],
      [offCopy, "her sale called off before any link", "not_connected", EN.noPayment, "line"],
    ] as const) {
      const g = await mount("en", screenOf(raw));
      try {
        await ready(g);
        const s = g.items().find((i) => i.getAttribute("data-kind") === "sale");
        ok(s, `${what}: her group sale is on her page`);
        const payNow = statusOf(s, "today-state-payment");
        assert.deepEqual(payNow.codes, [code], `${what}: the buyer's payment, its own state`);
        assert.equal(
          payNow.text,
          paySaid,
          `${what}: the buyer's payment's words (RC2-ANN-2; it said "${payNow.text}")`,
        );
        const read = app.mineForBrowser(copy(raw)).orders[0];
        ok(read, `${what}: her order, as her server reads it`);
        if (says === "line") {
          assert.equal(
            payNow.text,
            words("en", app.paymentLine(read).key),
            `${what}: the sale page's own payment line`,
          );
          if (read.payment.link_made)
            assert.equal(
              groupPage("en", raw).paymentCard,
              true,
              `${what}: a link made, the group sale's own page draws its payment card with that line`,
            );
          else
            assert.equal(
              s.getAttribute("data-lane"),
              "called_off",
              `${what}: the order, called off`,
            );
        } else if (says === "state")
          assert.equal(
            payNow.text,
            words("en", `aiaic.pay.state.${read.payment.state}`),
            `${what}: the payment's own state, with no group page to say more`,
          );
        else
          assert.equal(
            payNow.text,
            groupPage("en", raw).moneyStep,
            `${what}: as the group sale's own page says it at its money step`,
          );
        ok(
          !(s.textContent ?? "").includes(EN.beforeHandover),
          `${what}: never "before you hand over" on a group sale`,
        );
        ok(
          !s.querySelector('[data-testid="today-progress"]'),
          `${what}: no 'step n of 5' on a group sale (RC-ANN-1; it said "${s.querySelector('[data-testid="today-progress"]')?.textContent ?? ""}")`,
        );
        assert.equal(
          s.querySelector('[data-testid="today-group"]')?.textContent,
          words("en", "aiaic.today.sale.group"),
          `${what}: said as part of a group sale, its steps on the sale's page`,
        );
        ok(
          !s.querySelector('[data-testid="today-next"]') &&
            !s.querySelector('[data-testid="today-waiting"]'),
          `${what}: no stale handover step, nobody named as waited on`,
        );
      } finally {
        await g.unmount();
      }
    }
    // Marathi and Hindi: the group page's own sentence for the buyer's terms, never the no-link line, no English word
    for (const lang of ["mr", "hi"] as const) {
      const m = await mount(lang, screenOf(JOURNEY, lang));
      try {
        await ready(m);
        const s = m.items().find((i) => i.getAttribute("data-kind") === "sale");
        ok(s, `${lang}: her group sale is on her page`);
        const payL = statusOf(s, "today-state-payment");
        assert.equal(
          payL.text,
          fill(lang, "aiaic.group.pay_within", { days: "3" }),
          `${lang}: the buyer's terms in AIAIC's words (it said "${payL.text}")`,
        );
        assert.equal(
          payL.text,
          groupPage(lang, JOURNEY).moneyStep,
          `${lang}: as the group sale's own page says it`,
        );
        ok(payL.text !== words(lang, "aiaic.pay.no_link"), `${lang}: never the no-link line`);
        const box = s.querySelector('[data-testid="today-state-payment"]');
        ok(box, `${lang}: the payment line`);
        assert.deepEqual(latinIn(box), [], `${lang}: no English word in the buyer's payment`);
      } finally {
        await m.unmount();
      }
    }
    // A SALE SOLD ALONE keeps its own page's payment line (`paymentLine`, WF-05), the no-link line among them: the only sale
    // sold alone in her fixtures that says it (AIAIC's recording of a payment recorded as made outside AIAIC)
    const soloRaw = (DIRECT as Raw).orders.find(
      (o) => (o["money"] as Record<string, unknown> | undefined)?.["route"] === "direct",
    );
    ok(soloRaw && !soloRaw["pool"] && !soloRaw["pool_id"], "the recording holds a sale sold alone");
    const soloRead = app
      .mineForBrowser(copy(DIRECT))
      .orders.find((o) => o.order_id === soloRaw["order_id"]);
    ok(soloRead, "that sale, as her server reads it");
    assert.equal(
      app.paymentLine(soloRead).key,
      "aiaic.pay.no_link",
      "its own page's payment line there: the no-link line",
    );
    const solo = await mount("en", screenOf(DIRECT));
    try {
      await ready(solo);
      const s = solo.items().find((i) => i.getAttribute("data-id") === String(soloRaw["order_id"]));
      ok(s, "the sale sold alone is on her page");
      assert.equal(
        statusOf(s, "today-state-payment").text,
        words("en", app.paymentLine(soloRead).key),
        "a sale sold alone: her sale page's own payment line, unchanged",
      );
    } finally {
      await solo.unmount();
    }
  });

  // ============================================================================================ TD3

  test("TD3 her money's parts said apart on AIAIC's recorded sends, every figure the recorded one and every safety word pinned: held for the pickup (her amount an estimate), sent but not reached (still an estimate), reached her bank (confirmed, the payment company's word); the agreed price gross, AIAIC's commission and the GST on it each on its own line with its rate, transport said as no part of AIAIC's figures; the sale's step n of 5", async () => {
    const cases: [Record<string, unknown>, string, string, "yes" | "no", string][] = [
      [PAID, "collect_mine_paid", "held", "no", "Step 3 of 5: handing over your produce"],
      [SENDING, "collect_mine_processing", "sent", "no", "Step 4 of 5: the delivery to the buyer"],
      [
        REACHED,
        "collect_mine_processed",
        "reached",
        "yes",
        "Step 4 of 5: the delivery to the buyer",
      ],
    ];
    for (const [raw, name, state, confirmed, progress] of cases) {
      const order = (raw as Raw).orders.find((o) => o["from_aiaic"]) as Record<string, unknown>;
      const fa = order["from_aiaic"] as Record<string, unknown>;
      const one = { ...copy(raw), orders: [copy(order)] };
      const p = await mount("en", screenOf(one));
      try {
        await ready(p);
        const sale = p.items()[0] as Element;
        assert.deepEqual(
          statusOf(sale, "today-state-money").codes,
          [state],
          `${name}: her money ${state}`,
        );
        const text = (id: string) => p.q(`[data-testid="${id}"]`)?.textContent ?? null;
        if (state === "held") {
          const holds = fa["holds"] as Record<string, unknown>;
          ok(statusOf(sale, "today-state-money").text.startsWith(EN.held), `${name}: said as held`);
          assert.equal(
            p.q('[data-testid="today-money-why"]')?.textContent,
            words("en", `aiaic.money.holds.waits_for.${String(holds["waits_for"])}`),
            `${name}: why AIAIC holds it, AIAIC's own reason`,
          );
        }
        assert.equal(
          text("today-progress"),
          progress,
          `${name}: step n of 5, said as the step in progress, never as a milestone reached`,
        );
        const toHer = p.q('[data-testid="today-money-to-her"]');
        ok(toHer, `${name}: her amount is said`);
        assert.equal(
          toHer.getAttribute("data-confirmed"),
          confirmed,
          `${name}: confirmed only once it reached her bank`,
        );
        const amount = inr(fa["to_her_inr"] as number);
        assert.equal(
          toHer.textContent,
          confirmed === "yes" ? EN.reached(amount) : EN.estimate(amount),
          `${name}: ${confirmed === "yes" ? "confirmed" : "an estimate until it reaches her bank"}, AIAIC's own figure`,
        );
        assert.equal(
          text("today-money-gross"),
          EN.gross(inr(order["amount_inr"] as number)),
          `${name}: the agreed price, gross (the order's own amount, never her net)`,
        );
        assert.equal(
          text("today-money-commission"),
          EN.commission(fa["commission_percent"] as number, inr(fa["commission_inr"] as number)),
          `${name}: AIAIC's commission, its rate and amount as the payment link's record holds them`,
        );
        assert.equal(
          text("today-money-gst"),
          EN.gst(fa["gst_percent"] as number, inr(fa["gst_inr"] as number)),
          `${name}: the GST on it, on its own line (SK-ANN-8)`,
        );
        assert.equal(
          text("today-money-transport"),
          EN.transport,
          `${name}: transport said, never folded in`,
        );
        ok(
          !p.q('[data-testid="today-money-none-due"]'),
          `${name}: a sale under way is not said called off`,
        );
        const details = p.q('[data-testid="today-money-more"]') as HTMLDetailsElement | null;
        ok(details && !details.open, `${name}: the money's parts sit behind one control, folded`);
      } finally {
        await p.unmount();
      }
    }
  });

  // ============================================================================================ TD4

  test("TD4 the most pressing first: an offer waiting for her answer leads, with its total and one press to its existing offer page; then her sales; then lots with no offer; at most six shown, the rest one press away on Orders & Offers", async () => {
    const one = await mount("en", screenOf(OFFER));
    try {
      await ready(one);
      const first = one.items()[0] as Element;
      assert.equal(first.getAttribute("data-kind"), "offer", "her open offer leads");
      const listing = (OFFER as Raw).listings[0] as Record<string, unknown>;
      const offer = (listing["offers"] as Record<string, unknown>[])[0] as Record<string, unknown>;
      assert.equal(
        hrefOf(first.querySelector('[data-testid="today-answer-offer"]')),
        `/orders/${String(offer["offer_id"])}`,
      );
      const total =
        (offer["amount_inr"] as number | null) ??
        Math.round((offer["price_per_q"] as number) * 100 * (offer["quantity_q"] as number)) / 100;
      ok(
        (first.textContent ?? "").includes(
          `₹${total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
        ),
        "the offer's total is said",
      );
      ok(first.querySelector('[data-testid="today-needs-you"]'), "it says it needs her");
    } finally {
      await one.unmount();
    }
    const p = await mount("en", screenOf(MANY));
    try {
      await ready(p);
      const kinds = p.items().map((i) => i.getAttribute("data-kind"));
      const all = app.today.todayItems(app.mineForBrowser(copy(MANY)));
      ok(all.length > 6, `the recording holds more than six (${all.length})`);
      assert.equal(kinds.length, 6, "six shown");
      const rank = (k: string | null) => (k === "offer" ? 0 : k === "sale" ? 1 : 2);
      ok(
        kinds.every((k, i) => i === 0 || rank(kinds[i - 1] ?? null) <= rank(k)),
        `offers, then sales, then lots: ${kinds.join(", ")}`,
      );
      assert.equal(
        hrefOf(p.q('[data-testid="today-see-all"]')),
        "/orders",
        "the rest on Orders & Offers",
      );
    } finally {
      await p.unmount();
    }
  });

  // ============================================================================================ TD5

  test("TD5 a real account's sales called off and disputed (AIAIC's recording): called off says so with no next step and no money moving; a problem reported waits on AIAIC's team with its recorded steps; nothing on a real sale says practice; an expired offer is not offered to answer", async () => {
    const p = await mount("en", screenOf(REAL));
    try {
      await ready(p);
      const sales = p.items().filter((i) => i.getAttribute("data-kind") === "sale");
      const off = sales.find((s) => s.getAttribute("data-lane") === "called_off");
      const disputed = sales.find((s) => s.getAttribute("data-lane") === "disputed");
      ok(off && disputed, "both sales are on her page");
      assert.deepEqual(
        statusOf(off, "today-state-money").codes,
        ["stopped"],
        "called off: no money moves",
      );
      ok(
        !off.querySelector('[data-testid="today-next"]') &&
          !off.querySelector('[data-testid="today-waiting"]'),
        "called off: no next step, nobody waited on",
      );
      assert.equal(
        disputed.querySelector('[data-testid="today-waiting"]')?.getAttribute("data-waiting"),
        "team",
      );
      assert.deepEqual(
        statusOf(disputed, "today-state-delivery").codes,
        ["pickup:done", "delivery_exception:done"],
        "its recorded steps, the problem among them",
      );
      const drawn = (stage: string) =>
        disputed.querySelector(`[data-stage="${stage}"] [data-status]`) as HTMLElement | null;
      assert.equal(
        drawn("pickup")?.getAttribute("data-tone"),
        "good",
        "a pickup done: drawn as done",
      );
      assert.equal(
        drawn("delivery_exception")?.getAttribute("data-tone"),
        "warn",
        "a problem reported: the warning's colour and icon, never drawn as a success (SK-ANN-6)",
      );
      const problemWords = (drawn("delivery_exception")?.textContent ?? "").replace(/\s+/g, " ");
      ok(
        problemWords.startsWith(EN.problemStep) && !problemWords.includes(": done"),
        `a problem reported is never said "done" (${problemWords})`,
      );
      const recorded = (REAL as Raw).orders.find(
        (o) => o["order_id"] === disputed.getAttribute("data-id"),
      ) as Record<string, unknown>;
      assert.deepEqual(
        [...disputed.querySelectorAll('[data-testid="today-step-known"]')].map(
          (e) => e.textContent,
        ),
        (recorded["fulfilment"] as Record<string, unknown>[]).map(
          (x) => `${istDay(String(x["created_at"]))} · ${EN.seenByTeam}`,
        ),
        "each step's day and how AIAIC knows it, as AIAIC recorded them (its operator_observed, SK-ANN-4)",
      );
      ok(!off.querySelector('[data-testid="today-progress"]'), "called off: no step n of 5");
      ok(
        !p.q('[data-testid="today-practice-chip"]') && !p.q('[data-testid="today-practice-step"]'),
        "nothing on a real account's page says practice",
      );
      ok(
        !p.items().some((i) => i.getAttribute("data-kind") === "offer"),
        "an expired offer is not offered to answer",
      );
      const order = sales.indexOf(off) > sales.indexOf(disputed);
      ok(order, "a sale under way comes before one called off");
    } finally {
      await p.unmount();
    }
  });

  // ============================================================================================ TD6

  test("TD6 empty, failure and recovery: nothing to do says what she can do next; AIAIC not answering says so in the app's own words, what still works and a person, and Try again reads again and shows her sales; signed out offers Sign in; AIAIC's crisis answer takes the whole page", async () => {
    const empty = await mount("en", screenOf(EMPTY));
    try {
      await ready(empty);
      assert.equal(
        empty.q('[data-testid="today-empty"]')?.textContent,
        words("en", "aiaic.today.mine.empty"),
      );
      assert.equal(
        empty.all('[data-testid^="today-task-"]').filter((e) => e.tagName === "A").length,
        6,
        "the six task cards stay",
      );
    } finally {
      await empty.unmount();
    }
    const down = await mount("en", { ok: false, problem: app.problem("aiaic_unavailable") });
    try {
      await ready(down);
      const alert = down.q('[data-testid="today-problem"]');
      ok(alert && alert.getAttribute("role") === "alert", "said as an alert");
      ok(
        (alert.textContent ?? "").includes(words("en", "aiaic.problem.aiaic_unavailable")),
        "the app's own words for the problem",
      );
      ok(
        (alert.textContent ?? "").includes(words("en", "aiaic.today.problem.kept")),
        "what still works, and a person",
      );
      assert.equal(hrefOf(down.q('[data-testid="today-problem-help"]')), "/help", "a person: Help");
      assert.equal(
        down.all('[data-testid^="today-task-"]').filter((e) => e.tagName === "A").length,
        6,
        "the task cards stay",
      );
      const before = world.calls;
      world.trade = screenOf(JOURNEY);
      await press(down.q('[data-testid="today-retry"]'), "Try again");
      await waitFor(() => down.q('[data-testid="today-items"]'), "her sales after Try again");
      ok(world.calls > before, "Try again read her records again");
      ok(!down.q('[data-testid="today-problem"]'), "the problem is gone once AIAIC answered");
    } finally {
      await down.unmount();
    }
    const out = await mount("en", { ok: false, problem: app.problem("aiaic_signed_out") });
    try {
      await ready(out);
      assert.equal(
        hrefOf(out.q('[data-testid="today-problem-sign-in"]')),
        "/signin",
        "signed out: Sign in",
      );
      ok(!out.q('[data-testid="today-retry"]'), "no Try again that cannot work");
    } finally {
      await out.unmount();
    }
    const c = await mount("en", { ok: false, problem: crisisProblem() });
    try {
      await ready(c);
      await waitFor(() => c.q("[data-crisis]"), "the crisis card");
      ok(
        !c.q('[data-testid="today-tasks"]') && !c.q('[data-testid="today-problem"]'),
        "the crisis card alone: nothing else of the page",
      );
      ok(c.text().includes("14416"), "the helplines AIAIC answered with");
    } finally {
      await c.unmount();
    }
  });

  // ============================================================================================ TD7

  test("TD7 a sale she started here and left is offered back with the crop and district she came with, and nothing else is kept; Not now forgets it; once AIAIC holds a lot she listed since, it is forgotten by itself", async () => {
    // her farm as the advice page keeps it on her phone (`aiaic.farm`), from an earlier ask
    window.localStorage.clear();
    window.localStorage.setItem(
      "aiaic.farm",
      JSON.stringify({ region: "Nashik", crop: "onion", state: "mh" }),
    );
    const first = await mount("en", screenOf(EMPTY), { keep: true });
    let kept: Record<string, unknown> | null = null;
    try {
      await ready(first);
      assert.equal(
        first.q('[data-testid="today-task-price-kept"]')?.textContent,
        EN.savedFarm,
        "the price card says it opens her saved crop and district (SK-ANN-10)",
      );
      ok(
        (hrefOf(first.q('[data-testid="today-task-price"]')) ?? "").startsWith("/result?"),
        "and opens that answer",
      );
      const sell = first.q('[data-testid="today-task-sell"]');
      assert.equal(
        hrefOf(sell),
        "/listing/new?crop=onion&region=Nashik",
        "the sale opens on what she told before",
      );
      await press(sell, "Sell my produce");
      kept = JSON.parse(
        window.localStorage.getItem(app.today.SELL_STARTED_KEY) ?? "null",
      ) as Record<string, unknown> | null;
      ok(kept, "her start is kept");
      assert.deepEqual(
        Object.keys(kept).sort(),
        ["at", "crop", "district", "seen"],
        "only the crop, the district, when, and her newest lot as AIAIC said it",
      );
      assert.deepEqual([kept["crop"], kept["district"]], ["onion", "Nashik"]);
      assert.equal(
        kept["seen"],
        "",
        "AIAIC held no lot of hers at her press: the mark is AIAIC's own answer, never the phone's clock (SK-ANN-11)",
      );
    } finally {
      await first.unmount();
    }
    const back = await mount("en", screenOf(EMPTY), { keep: true });
    try {
      await ready(back);
      const resume = await waitFor(
        () => back.q('[data-testid="today-resume"]'),
        "her sale offered back",
      );
      ok(
        (resume.textContent ?? "").includes(
          fill("en", "aiaic.today.resume.sell_crop", { crop: "Onion" }),
        ),
        "it names the crop",
      );
      assert.equal(
        hrefOf(back.q('[data-testid="today-resume-go"]')),
        "/listing/new?crop=onion&region=Nashik",
      );
      await press(back.q('[data-testid="today-resume-drop"]'), "Not now");
      ok(!back.q('[data-testid="today-resume"]'), "Not now: gone");
      assert.equal(
        window.localStorage.getItem(app.today.SELL_STARTED_KEY),
        null,
        "Not now: forgotten",
      );
    } finally {
      await back.unmount();
    }
    // DERIVED: she started again, then listed: AIAIC's recorded lot, its `created_at` moved after her start
    app.today.keepSellStart("onion", "Nashik", null, Date.now() - 60_000);
    const listed = copy(OFFER) as Raw;
    (listed.listings[0] as Record<string, unknown>)["created_at"] = new Date().toISOString();
    const after = await mount("en", screenOf(listed), { keep: true });
    try {
      await ready(after);
      await settle(200);
      ok(!after.q('[data-testid="today-resume"]'), "listed since: not offered back");
      assert.equal(
        window.localStorage.getItem(app.today.SELL_STARTED_KEY),
        null,
        "listed since: forgotten by itself",
      );
    } finally {
      await after.unmount();
    }
  });

  // ============================================================================================ TD8

  test("TD8 a guest: told that her own sales need her account and that a guest's selling is practice only, with Sign in; her records are never asked for; the six task cards and a person are there", async () => {
    const p = await mount("en", screenOf(JOURNEY), { signedIn: false });
    try {
      await ready(p);
      assert.equal(
        p.q('[data-testid="today-guest"] p')?.textContent,
        EN.guest,
        "a guest's selling is practice only, word for word",
      );
      assert.equal(hrefOf(p.q('[data-testid="today-sign-in"]')), "/signin");
      await settle(300);
      assert.equal(world.calls, 0, "a guest's page never asks for her records");
      assert.equal(
        p.all('[data-testid^="today-task-"]').filter((e) => e.tagName === "A").length,
        6,
      );
      ok(
        p.q('[data-testid="today-person-team"]') && p.q('[data-testid="today-person-kcc"]'),
        "a person, always",
      );
    } finally {
      await p.unmount();
    }
  });

  // ============================================================================================ TD9

  test("TD9 her words: every new word in English, Marathi and Hindi; no English word on her Marathi or Hindi page (names AIAIC sends excepted, and AIAIC's own name), on her sale, her offer, the empty, guest and problem states; no 'not yet', 'later', 'pending', 'coming soon' or 'planned' in the new English words", async () => {
    const keys = Object.keys(DICTS.en).filter((k) => k.startsWith("aiaic.today."));
    ok(keys.length >= 80, `the new words are there (${keys.length})`);
    for (const lang of ["mr", "hi"] as const) {
      const missing = keys.filter((k) => !(k in DICTS[lang]));
      assert.deepEqual(missing, [], `every new word in ${lang}`);
      const same = keys.filter(
        (k) =>
          DICTS[lang][k] === DICTS.en[k] &&
          /[a-z]{3}/.test(String(DICTS.en[k]).replace(/\{\w+\}/g, "")),
      );
      assert.deepEqual(same, [], `no ${lang} word left as its English`);
    }
    const banned = /\b(not yet|later|pending|coming soon|planned|push 2)\b/i;
    assert.deepEqual(
      keys.filter((k) => banned.test(String(DICTS.en[k]))),
      [],
      "no word of the D-296 list",
    );
    for (const lang of ["mr", "hi"] as const) {
      for (const [what, trade, signedIn] of [
        ["her sale", JOURNEY, true],
        ["her offer", OFFER, true],
        ["her money held", PAID, true],
        ["nothing to do", EMPTY, true],
        ["a guest", EMPTY, false],
      ] as const) {
        const p = await mount(lang, screenOf(trade, lang), { signedIn });
        try {
          await ready(p);
          await settle(100);
          const today = p.q('[data-testid="today"]');
          ok(today, "her page");
          assert.deepEqual(latinIn(today), [], `${lang}, ${what}: no English word`);
        } finally {
          await p.unmount();
        }
      }
      const down = await mount(lang, { ok: false, problem: app.problem("aiaic_unavailable") });
      try {
        await ready(down);
        const today = down.q('[data-testid="today"]');
        ok(today, "her page");
        assert.deepEqual(latinIn(today), [], `${lang}, AIAIC not answering: no English word`);
      } finally {
        await down.unmount();
      }
    }
  });

  // ============================================================================================ TD10

  test("TD10 the task's floors on every control and word, the ranked cards opening the existing flows, the advice warning where advice is offered, and the landing: its new card to her guided home, everything it had before still there", async () => {
    const p = await mount("en", screenOf(JOURNEY));
    try {
      await ready(p);
      const today = p.q('[data-testid="today"]') as Element;
      const presses = [...today.querySelectorAll("a, button, summary")];
      // one sale (its money's control and its page), the six tasks, the three ways to a person
      assert.equal(presses.length, 11, "her page's presses");
      for (const el of presses) {
        const min = (el as HTMLElement).style.minHeight;
        ok(
          /^max\((48|72)px, (3|4\.5)rem\)$/.test(min),
          `${el.textContent?.trim().slice(0, 40)}: at least 48 px (${min || "none"})`,
        );
        ok((el.textContent ?? "").trim().length > 1, "a press has words, never an icon alone");
      }
      const sizeOf = (el: Element | null): number | null => {
        for (let e = el; e && e !== today.parentElement; e = e.parentElement) {
          const f = (e as HTMLElement).style?.fontSize;
          const m = f ? /^max\((\d+)px/.exec(f) : null;
          if (m) return Number(m[1]);
        }
        return null;
      };
      const walker = document.createTreeWalker(today, 4 /* NodeFilter.SHOW_TEXT */);
      let seen = 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!(n.textContent ?? "").trim()) continue;
        seen += 1;
        const px = sizeOf(n.parentElement);
        ok(
          px !== null && px >= 16,
          `"${(n.textContent ?? "").trim().slice(0, 40)}" is at least 16 px (${px})`,
        );
      }
      ok(seen > 30, `her page's words were read (${seen})`);
      const tasks = p.all('[data-testid="today-tasks"] > li > a');
      assert.deepEqual(
        tasks.map((a) => a.getAttribute("data-testid")),
        [
          "today-task-sell",
          "today-task-orders",
          "today-task-price",
          "today-task-store",
          "today-task-money",
          "today-task-help",
        ],
        "the ranked tasks, in order",
      );
      assert.deepEqual(
        tasks.map((a) => (hrefOf(a) ?? "").split("?")[0]),
        ["/listing/new", "/orders", "/ask", "/storage", "/payments", "/help"],
        "each opens the existing flow",
      );
      for (const id of ["today-task-price-note", "today-task-store-note"])
        assert.equal(
          p.q(`[data-testid="${id}"]`)?.textContent,
          EN.warning,
          `${id}: the uncalibrated warning, word for word, where advice is offered`,
        );
      const kcc = p.q('[data-testid="today-person-kcc"]');
      assert.equal(hrefOf(kcc), EN.kccTel, "the Kisan Call Centre's own number is dialled");
      assert.equal((kcc?.textContent ?? "").trim(), EN.kcc, "and said");
    } finally {
      await p.unmount();
    }
    const home = await mount("en", screenOf(EMPTY), { at: "/", signedIn: false });
    try {
      const card = await waitFor(
        () => home.q('[data-testid="home-today-link"]'),
        "the landing's new card",
      );
      assert.equal(hrefOf(card), "/today", "the landing opens her guided home");
      ok(
        (card.textContent ?? "").includes(words("en", "aiaic.today.title")),
        "the card asks her question",
      );
      ok(home.q('a[href="/ask"]'), "the landing's own Get my advice stays");
      ok(home.q('[data-testid="home-storage-link"]'), "the landing's own Store or sell now stays");
      ok(home.q('[role="radiogroup"]'), "the landing's language buttons stay");
      const order = [
        ...home.container.querySelectorAll(
          '[role="radiogroup"], a[href="/ask"], [data-testid="home-storage-link"], [data-testid="home-today-link"]',
        ),
      ].map(
        (e) => e.getAttribute("data-testid") ?? e.getAttribute("role") ?? e.getAttribute("href"),
      );
      assert.deepEqual(
        order,
        ["radiogroup", "/ask", "home-storage-link", "home-today-link"],
        "her language, the landing's own two actions where they were, then the new card (SK-ANN-7: the first screen she knew is unchanged)",
      );
      assert.equal(world.calls, 0, "the landing asks AIAIC for nothing of hers");
    } finally {
      await home.unmount();
    }
  });

  // ============================================================================================ TD11

  test("TD11 an AIAIC that sends no lane: the order said by its own order state, never a step worked out from the recorded steps; a sale called off by its state alone stays called off", async () => {
    const order = copy((JOURNEY as Raw).orders[0]) as Record<string, unknown>;
    delete order["lane"];
    const noLane = { ...copy(JOURNEY), orders: [order] };
    const read = app.mineForBrowser(copy(noLane)).orders[0];
    assert.equal(read?.lane, null, "no lane sent: none read");
    const now = app.today.saleNow(read as never);
    assert.deepEqual(
      [now.lane, now.laneFromAiaic, now.waitingOn],
      ["agreed", false, null],
      "its order state's word, nobody named as waited on",
    );
    const off = app.today.saleNow({ ...(read as object), order_state: "cancelled" } as never);
    assert.deepEqual(
      [off.lane, off.closed, off.next],
      ["called_off", true, null],
      "called off by its state alone",
    );
  });

  // ============================================================================================ TD12

  test("TD12 a sale whose quantities were checked (AIAIC's lane reconciled: never a payment or a settlement) while AIAIC still holds her money: said as 'Quantities checked', never 'Settled', and kept among her sales under way, before her lots; once her money reached her bank it is finished and comes last", async () => {
    // DERIVED, in memory: AIAIC's recorded collect order (her money held, or reached her bank), given a pickup, a delivery
    // and a reconciliation recorded done (practice steps), and what AIAIC answers for that (its lane `reconciled`, waiting
    // on nobody: engine `trade/store.py` `lane_of`; no next step for her: `her_next_step`); AIAIC's team's press is what the
    // held money waits for after the delivery; and a lot of hers listed with no offer (AIAIC's recorded practice lot, its
    // offer removed)
    const reconciledFrom = (raw: Record<string, unknown>) => {
      const r = copy(raw) as Raw;
      const order = r.orders.find((o) => o["from_aiaic"]) as Record<string, unknown>;
      const at = (m: number) =>
        new Date(Date.parse(String(order["created_at"])) + m * 60_000).toISOString();
      const step = (stage: string, m: number, detail: Record<string, unknown> = {}) => ({
        stage,
        status: "done",
        simulated: true,
        evidence_kind: "simulated",
        created_at: at(m),
        detail,
      });
      order["order_state"] = "delivered";
      order["fulfilment"] = [
        step("pickup", 10),
        step("delivered", 20),
        step("reconciliation", 30, {
          delivered_q: order["quantity_q"],
          accepted_q: order["quantity_q"],
          rejected_q: 0,
        }),
      ];
      order["lane"] = { code: "reconciled", since: at(30), waiting_on: null, synthetic: true };
      // nothing comes next on a reconciled order (engine `trade/store.py` `her_next_step`: None once it is reconciled)
      order["her_next_step"] = null;
      const fa = order["from_aiaic"] as Record<string, unknown>;
      if (fa["holds"]) (fa["holds"] as Record<string, unknown>)["waits_for"] = "aiaic_team";
      const lot = copy((OFFER as Raw).listings[0]) as Record<string, unknown>;
      lot["offers"] = [];
      return { ...r, orders: [order], listings: [lot] };
    };
    const held = await mount("en", screenOf(reconciledFrom(PAID)));
    try {
      await ready(held);
      assert.deepEqual(
        held.items().map((i) => i.getAttribute("data-kind")),
        ["sale", "lot"],
        "her money not in her bank: the sale stays among those under way, before her lot",
      );
      const sale = held.items()[0] as Element;
      assert.equal(sale.getAttribute("data-lane"), "reconciled");
      assert.equal(
        sale.querySelector('[data-testid="today-lane-word"]')?.textContent,
        EN.reconciled,
        "the order: its quantities checked",
      );
      ok(
        !/settled/i.test(sale.textContent ?? ""),
        "never 'Settled' on a sale whose money AIAIC holds",
      );
      assert.deepEqual(
        statusOf(sale, "today-state-money").codes,
        ["held"],
        "her money: its own state",
      );
      ok(statusOf(sale, "today-state-money").text.startsWith(EN.held), "said as held");
      const fa = ((PAID as Raw).orders.find((o) => o["from_aiaic"]) as Record<string, unknown>)[
        "from_aiaic"
      ] as Record<string, unknown>;
      assert.equal(
        sale.querySelector('[data-testid="today-money-to-her"]')?.textContent,
        EN.estimate(inr(fa["to_her_inr"] as number)),
        "her amount: still an estimate",
      );
    } finally {
      await held.unmount();
    }
    const done = await mount("en", screenOf(reconciledFrom(REACHED)));
    try {
      await ready(done);
      assert.deepEqual(
        done.items().map((i) => i.getAttribute("data-kind")),
        ["lot", "sale"],
        "her money in her bank: the sale is finished and comes last",
      );
      const sale = done.items()[1] as Element;
      assert.equal(
        sale.querySelector('[data-testid="today-lane-word"]')?.textContent,
        EN.reconciled,
      );
      assert.deepEqual(statusOf(sale, "today-state-money").codes, ["reached"]);
      assert.equal(
        sale.querySelector('[data-testid="today-progress"]')?.textContent,
        "All 5 steps done",
        "every step done, said so",
      );
    } finally {
      await done.unmount();
    }
    const read = (raw: Record<string, unknown>) =>
      app.today.saleNow(app.mineForBrowser(copy(reconciledFrom(raw))).orders[0] as never);
    assert.deepEqual(
      [read(PAID).closed, read(REACHED).closed],
      [false, true],
      "finished only once her money reached her bank",
    );
  });

  // ============================================================================================ TD13

  test("TD13 a read again that fails keeps what she saw (R5P-09, the app's rule for every sale page): her sale stays with one quiet line and Try again, whether AIAIC refused or the phone lost its network; signed out says Sign in; Try again reads again and the line goes; AIAIC's crisis answer still takes the whole page", async () => {
    const p = await mount("en", screenOf(JOURNEY));
    try {
      await ready(p);
      const id = String((JOURNEY as Raw).orders[0]?.["order_id"]);
      const her = () => p.items().find((i) => i.getAttribute("data-id") === id);
      ok(her(), "her sale is on the page");
      world.trade = { ok: false, problem: app.problem("aiaic_unavailable") };
      const before = world.calls;
      await p.reread();
      ok(world.calls > before, "her records were read again");
      ok(her(), "AIAIC refused the read again: her sale stays");
      ok(!p.q('[data-testid="today-problem"]'), "no problem card in place of her sales");
      const line = p.q('[data-testid="today-not-refreshed"]');
      ok(line, "one quiet line says so");
      ok((line.textContent ?? "").includes(EN.notRefreshed), "in the app's own words");
      const retry = p.q('[data-testid="today-not-refreshed-retry"]') as HTMLElement | null;
      ok(retry && retry.style.minHeight === "max(48px, 3rem)", "Try again, at least 48 px");
      world.trade = LOST;
      await p.reread();
      ok(her(), "the phone lost its network: her sale stays");
      ok(p.q('[data-testid="today-not-refreshed"]'), "with the quiet line");
      world.trade = screenOf(JOURNEY);
      await press(p.q('[data-testid="today-not-refreshed-retry"]'), "Try again");
      await waitFor(
        () => !p.q('[data-testid="today-not-refreshed"]'),
        "the line gone once AIAIC answered",
      );
      ok(her(), "her sale, read again");
      world.trade = { ok: false, problem: app.problem("aiaic_signed_out") };
      await p.reread();
      ok(her(), "signed out on a read again: what she saw stays");
      assert.equal(
        hrefOf(p.q('[data-testid="today-not-refreshed-sign-in"]')),
        "/signin",
        "with Sign in",
      );
      world.trade = { ok: false, problem: crisisProblem() };
      await p.reread();
      await waitFor(() => p.q("[data-crisis]"), "the crisis card");
      ok(!p.q('[data-testid="today-items"]'), "AIAIC's crisis answer: the crisis card alone");
    } finally {
      await p.unmount();
    }
  });

  // ============================================================================================ TD14

  test("TD14 a sale called off after AIAIC made the buyer's link: no money moves and nothing is due to her, said plainly; no amount 'to you' and no deductions from it; the agreed price stays a fact of the order; no step n of 5", async () => {
    // DERIVED, in memory: AIAIC's recorded collect order (from_aiaic: her amount by AIAIC's figure), its state cancelled and
    // its lane called off (AIAIC still sends from_aiaic for it: engine `trade/farmer_payout.py` `_her_view`)
    const r = copy(PAID) as Raw;
    const order = r.orders.find((o) => o["from_aiaic"]) as Record<string, unknown>;
    order["order_state"] = "cancelled";
    order["lane"] = {
      code: "called_off",
      since: order["created_at"],
      waiting_on: null,
      synthetic: true,
    };
    const p = await mount("en", screenOf({ ...r, orders: [order] }));
    try {
      await ready(p);
      const sale = p.items().find((i) => i.getAttribute("data-kind") === "sale") as Element;
      ok(sale, "the sale is on her page");
      assert.deepEqual(statusOf(sale, "today-state-money").codes, ["stopped"]);
      ok(statusOf(sale, "today-state-money").text.startsWith(EN.stopped), "no money moves");
      assert.equal(
        p.q('[data-testid="today-money-none-due"]')?.textContent,
        EN.noneDue,
        "nothing is due to her, said plainly",
      );
      ok(!p.q('[data-testid="today-money-to-her"]'), "no amount 'to you' on a sale called off");
      ok(
        !p.q('[data-testid="today-money-commission"]') && !p.q('[data-testid="today-money-gst"]'),
        "no deductions from money she will not get",
      );
      ok(!/estimate/i.test(sale.textContent ?? ""), "no estimate of money that will not come");
      assert.equal(
        p.q('[data-testid="today-money-gross"]')?.textContent,
        EN.gross(inr(order["amount_inr"] as number)),
        "the agreed price stays a fact of the order",
      );
      ok(!p.q('[data-testid="today-progress"]'), "no step n of 5 on a sale called off");
    } finally {
      await p.unmount();
    }
  });

  // ============================================================================================ TD15

  test("TD15 a sale she started is forgotten once AIAIC holds a lot of any crop listed since, read on AIAIC's own clock (her newest lot then, as AIAIC said it): a phone whose clock runs ahead, or a lot of another crop, never keeps inviting a second listing", async () => {
    const T = app.today;
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    // DERIVED: AIAIC's recorded practice lot, as many lots as asked, each with its crop and its time on AIAIC's clock
    const mineWith = (lots: { crop: string; at: string }[]) => {
      const base = app.mineForBrowser(copy(OFFER));
      const one = base.listings[0];
      return {
        ...base,
        listings: lots.map((l, i) => ({
          ...one,
          listing_id: `lst_derived_${i}`,
          crop: l.crop,
          created_at: l.at,
        })),
      } as never;
    };
    const kept = (at: number, seen: string | null) => ({
      crop: "onion",
      district: "Nashik",
      at: iso(at),
      seen,
    });
    assert.equal(
      T.sellStillOpen(kept(now + 2 * 86_400_000, ""), mineWith([{ crop: "onion", at: iso(now) }])),
      false,
      "the phone's clock two days ahead: a lot listed since, on AIAIC's clock, ends it",
    );
    assert.equal(
      T.sellStillOpen(kept(now + 2 * 3_600_000, null), mineWith([{ crop: "onion", at: iso(now) }])),
      false,
      "no mark of AIAIC's at her press: the phone's clock less the slack still finds the lot",
    );
    assert.equal(
      T.sellStillOpen(kept(now - 60_000, ""), mineWith([{ crop: "tur", at: iso(now) }])),
      false,
      "a lot of another crop listed since ends it too",
    );
    const then = iso(now - 3_600_000);
    assert.equal(
      T.sellStillOpen(kept(now - 60_000, then), mineWith([{ crop: "onion", at: then }])),
      true,
      "nothing listed since her press: still offered back",
    );
    assert.equal(
      T.newestLotAt(
        mineWith([
          { crop: "tur", at: iso(now - 7_200_000) },
          { crop: "onion", at: then },
        ]),
      ),
      then,
      "her newest lot, as AIAIC said it",
    );
    // on her page: AIAIC held none of her lots at her press; the phone stamped it a minute after AIAIC's clock says she listed
    window.localStorage.clear();
    T.keepSellStart("onion", "Nashik", "", now - 5_000);
    const listed = copy(OFFER) as Raw;
    (listed.listings[0] as Record<string, unknown>)["created_at"] = iso(now - 65_000);
    const p = await mount("en", screenOf(listed), { keep: true });
    try {
      await ready(p);
      await settle(200);
      ok(!p.q('[data-testid="today-resume"]'), "listed since on AIAIC's clock: not offered back");
      assert.equal(window.localStorage.getItem(T.SELL_STARTED_KEY), null, "and forgotten");
    } finally {
      await p.unmount();
    }
  });

  // ============================================================================================ TD16

  test("TD16 practice is said on every kind of item a practice account has, word for word: an offer, a lot, a sale and each of its steps, with the page's practice line", async () => {
    const chipOf = (el: Element | undefined) =>
      el?.querySelector('[data-testid="today-practice-chip"]')?.textContent ?? null;
    const offer = await mount("en", screenOf(OFFER));
    try {
      await ready(offer);
      const o = offer.items().find((i) => i.getAttribute("data-kind") === "offer");
      assert.equal(chipOf(o), EN.practice, "a practice offer says Practice");
      ok(offer.text().includes(EN.practiceTip), "the page's practice line");
    } finally {
      await offer.unmount();
    }
    // DERIVED: AIAIC's recorded practice lot, its offer removed (a lot with no offer)
    const lotOnly = copy(OFFER) as Raw;
    (lotOnly.listings[0] as Record<string, unknown>)["offers"] = [];
    const lot = await mount("en", screenOf(lotOnly));
    try {
      await ready(lot);
      const l = lot.items().find((i) => i.getAttribute("data-kind") === "lot");
      ok(l, "her lot is on her page");
      assert.equal(chipOf(l), EN.practice, "a practice lot says Practice");
    } finally {
      await lot.unmount();
    }
    const sale = await mount("en", screenOf(JOURNEY));
    try {
      await ready(sale);
      const s = sale.items()[0];
      assert.equal(chipOf(s), EN.practice, "a practice sale says Practice");
      assert.deepEqual(
        [...(s?.querySelectorAll('[data-testid="today-practice-step"]') ?? [])].map((e) =>
          (e.textContent ?? "").trim(),
        ),
        [EN.practiceStep, EN.practiceStep],
        "each practice step says so",
      );
    } finally {
      await sale.unmount();
    }
  });

  // ============================================================================================ TD17

  test("TD17 a sale the buyer paid her outside AIAIC (AIAIC's recording payout_mine_dlite_direct: her word, recorded for her, that she got ₹23,880; and its DERIVED copy, her word sent without an amount): her money said in AIAIC's own sentence, word for word as her sale's own money card says it, never 'The buyer has not paid', never confirmed, never drawn as a success, and no step n of 5; her word that the money has not come said in AIAIC's sentence too, beside the step n of 5 of a payment AIAIC can see; AIAIC's own words where nobody said anything; the buyer's word beside AIAIC's own figure keeps it an estimate; an AIAIC that sends no sentence on a payment made outside it: its own question; in Marathi and Hindi AIAIC's own sentences, no English word (RC-ANN-3)", async () => {
    type Said = { key: string; values: Record<string, unknown> } | null | undefined;
    const moneyOf = (o: Record<string, unknown> | undefined) =>
      (o?.["money"] ?? {}) as Record<string, unknown> & { say?: Said };
    /** What her sale's own page says of her money (`moneyCard`, AiaicOrderDetail's money card), as her server reads it. */
    const salePageSays = (lang: Lang, raw: Record<string, unknown>, id: string) => {
      const order = (
        app.mineForBrowser(copy(raw)).orders as unknown as Record<string, unknown>[]
      ).find((o) => o["order_id"] === id);
      ok(order, `${id} is read by her server`);
      return (
        app.moneyCard(
          (k: string, v?: Record<string, string | number>) => fill(lang, k, v ?? {}),
          order as never,
        )?.line ?? null
      );
    };
    const saleOn = (p: Page, id: string) => {
      const s = p.items().find((i) => i.getAttribute("data-id") === id);
      ok(s, `${id} is on her page`);
      return s;
    };
    const moneyBox = (s: Element) =>
      s.querySelector('[data-testid="today-state-money"] [data-status]') as HTMLElement | null;

    // AIAIC's recording: five practice sales of one account, as AIAIC keeps them
    const raw = DIRECT as Raw;
    const direct = raw.orders.find((o) => moneyOf(o)["route"] === "direct");
    ok(direct, "the recording holds a sale whose payment AIAIC recorded as made outside it");
    const directId = String(direct["order_id"]);
    assert.equal(
      moneyOf(direct).say?.key,
      "farmer.money.direct.said_got",
      "the recording: AIAIC's sentence for her word that she got it",
    );
    const reports = moneyOf(direct)["reports"] as {
      what: string;
      amount_inr: number | null;
      created_at: string;
    }[];
    const her = reports[reports.length - 1];
    ok(her?.what === "received" && her.amount_inr === 23880, "the recording: received, ₹23,880");
    ok(!direct["from_aiaic"], "the recording: no from_aiaic on a payment made outside AIAIC");
    const notYet = raw.orders.find(
      (o) => moneyOf(o).say?.key === "farmer.money.direct.said_not_yet",
    );
    ok(notYet, "the recording holds her word that the money has not come");
    const settled = raw.orders.find((o) => moneyOf(o).say?.key === "farmer.money.settled");
    const paidLink = raw.orders.find((o) => o["payment_state"] === "paid" && !moneyOf(o).say);
    const nobody = raw.orders.find(
      (o) => o["payment_state"] === "not_connected" && !moneyOf(o).say,
    );
    ok(settled && paidLink && nobody, "the recording's other three sales");

    const p = await mount("en", screenOf(DIRECT));
    try {
      await ready(p);
      const s = saleOn(p, directId);
      const money = statusOf(s, "today-state-money");
      assert.deepEqual(money.codes, ["told"], "her money: people's word, a state of its own");
      assert.equal(
        money.text,
        EN.saidGot(inr(23880), istDay(her.created_at)),
        "AIAIC's own sentence, word for word: 'you told us', never AIAIC's confirmation",
      );
      assert.equal(
        money.text,
        salePageSays("en", DIRECT, directId),
        "as her sale's own money card says it",
      );
      ok(
        !(s.textContent ?? "").includes(EN.notPaid),
        "never 'The buyer has not paid' beside her word that she got it",
      );
      const box = moneyBox(s);
      ok(box?.querySelector("svg"), "an icon with the words, never colour alone");
      assert.equal(
        box?.getAttribute("data-tone"),
        "info",
        "never drawn as a success: AIAIC did not see this payment",
      );
      assert.equal(box?.style.fontSize, "max(16px, 1rem)", "at least 16 px");
      ok(
        !s.querySelector('[data-testid="today-progress"]'),
        `no step n of 5 on a payment AIAIC did not see (it said "${s.querySelector('[data-testid="today-progress"]')?.textContent ?? ""}")`,
      );
      ok(
        !s.querySelector('[data-confirmed="yes"]') &&
          !s.querySelector('[data-testid="today-money-to-her"]'),
        "never confirmed; no amount of AIAIC's to her (AIAIC sends no figure on it)",
      );
      // her word that the money has not come, on a sale whose buyer's link AIAIC can see
      const ny = saleOn(p, String(notYet["order_id"]));
      const nyMoney = statusOf(ny, "today-state-money");
      assert.deepEqual(nyMoney.codes, ["told"], "her word that it has not come: people's word");
      assert.equal(nyMoney.text, EN.saidNotYet, "in AIAIC's own sentence");
      assert.equal(
        nyMoney.text,
        salePageSays("en", DIRECT, String(notYet["order_id"])),
        "as her sale's own money card says it",
      );
      ok(
        ny.querySelector('[data-testid="today-progress"]'),
        "a payment AIAIC can see (the buyer's link): its step n of 5 stays",
      );
      // AIAIC's own words where nobody said anything: unchanged
      for (const [o, code, said] of [
        [settled, "reached", EN.inBank],
        [paidLink, "buyer_paid", EN.buyerPaid],
        [nobody, "not_paid", EN.notPaid],
      ] as const) {
        const m = statusOf(saleOn(p, String(o["order_id"])), "today-state-money");
        assert.deepEqual(m.codes, [code], `${String(o["order_id"])}: AIAIC's own state`);
        assert.equal(m.text, said, `${String(o["order_id"])}: its word`);
      }
    } finally {
      await p.unmount();
    }

    // the DERIVED copy: her word "I got the money" sent without an amount
    const q = await mount("en", screenOf(NO_AMOUNT));
    try {
      await ready(q);
      const s = saleOn(q, directId);
      const money = statusOf(s, "today-state-money");
      assert.deepEqual(money.codes, ["told"]);
      assert.equal(money.text, EN.saidGotAny, "without an amount: the same sentence without it");
      assert.equal(
        money.text,
        salePageSays("en", NO_AMOUNT, directId),
        "as her sale's page says it",
      );
      ok(!(s.textContent ?? "").includes(EN.notPaid), "never 'The buyer has not paid'");
      ok(!s.querySelector('[data-testid="today-progress"]'), "no step n of 5");
    } finally {
      await q.unmount();
    }

    // DERIVED, in memory: the recording's sale paid outside AIAIC with AIAIC's sentence not sent (an AIAIC that sends none)
    const silent = copy(DIRECT) as Raw;
    moneyOf(silent.orders.find((o) => o["order_id"] === directId))["say"] = null;
    const r = await mount("en", screenOf(silent));
    try {
      await ready(r);
      const s = saleOn(r, directId);
      const money = statusOf(s, "today-state-money");
      assert.deepEqual(money.codes, ["told"], "a payment recorded as made outside AIAIC");
      assert.equal(money.text, EN.ask, "AIAIC's own question for that case");
      assert.equal(money.text, salePageSays("en", silent, directId), "as her sale's page asks it");
      ok(!(s.textContent ?? "").includes(EN.notPaid), "never 'The buyer has not paid'");
    } finally {
      await r.unmount();
    }

    // DERIVED, in memory: AIAIC's recorded collect order with no link yet (her amount by AIAIC's figure, `from_aiaic`), and
    // the buyer's word that he paid as AIAIC keeps it (engine `trade/payout_store.py` `money_for_her`: its sentence from the
    // last report; the buyer's word changes no route)
    const withWord = copy(MANY) as Raw;
    const wo = withWord.orders.find(
      (o) => o["from_aiaic"] && o["payment_state"] === "not_connected",
    );
    ok(wo, "the recording holds a collect order with no link yet");
    const saidAt = new Date(Date.parse(String(wo["created_at"])) + 3_600_000).toISOString();
    const amount = wo["amount_inr"] as number;
    const wm = moneyOf(wo);
    ok(wm["route"] === "none", "its money moves through AIAIC");
    wm["say"] = {
      key: "farmer.money.direct.buyer_says",
      values: { amount, day: saidAt, ref: "UPIREF778899" },
    };
    wm["reports"] = [
      {
        report_id: "prp_derivedbuyerword0001",
        said_by: "operator_for_buyer",
        what: "buyer_says_paid",
        amount_inr: amount,
        reference: "UPIREF778899",
        simulated: true,
        created_at: saidAt,
      },
    ];
    const one = { ...withWord, orders: [wo], listings: [] };
    const b = await mount("en", screenOf(one));
    try {
      await ready(b);
      const s = saleOn(b, String(wo["order_id"]));
      const money = statusOf(s, "today-state-money");
      assert.deepEqual(money.codes, ["told"], "the buyer's word: people's word");
      assert.equal(money.text, EN.buyerSays(inr(amount)), "in AIAIC's own sentence");
      assert.equal(
        money.text,
        salePageSays("en", one, String(wo["order_id"])),
        "as her sale's page",
      );
      ok(!(s.textContent ?? "").includes(EN.notPaid), "never 'The buyer has not paid'");
      const toHer = s.querySelector('[data-testid="today-money-to-her"]');
      const fa = wo["from_aiaic"] as Record<string, unknown>;
      assert.equal(
        toHer?.textContent,
        EN.estimate(inr(fa["to_her_inr"] as number)),
        "AIAIC's own figure for her stays an estimate",
      );
      assert.equal(toHer?.getAttribute("data-confirmed"), "no", "never confirmed on a word");
      ok(
        s.querySelector('[data-testid="today-progress"]'),
        "a payment AIAIC can see: its step n of 5 stays",
      );
    } finally {
      await b.unmount();
    }

    // Marathi and Hindi: AIAIC's own sentences, as her sale's page says them, and no English word on her page
    for (const lang of ["mr", "hi"] as const) {
      const m = await mount(lang, screenOf(DIRECT, lang));
      try {
        await ready(m);
        await settle(100);
        const today = m.q('[data-testid="today"]');
        ok(today, "her page");
        assert.deepEqual(
          latinIn(today),
          [],
          `${lang}, her sales paid outside AIAIC: no English word`,
        );
        const said = statusOf(saleOn(m, directId), "today-state-money");
        assert.deepEqual(said.codes, ["told"]);
        assert.equal(
          said.text,
          salePageSays(lang, DIRECT, directId),
          `${lang}: AIAIC's own sentence, as her sale's own money card says it`,
        );
        ok(
          !said.text.includes(words(lang, "aiaic.today.money.not_paid")),
          `${lang}: never 'The buyer has not paid'`,
        );
      } finally {
        await m.unmount();
      }
    }
  });

  // ============================================================================================ TD18

  test("TD18 a sale called off after people's word of a payment made outside AIAIC (AIAIC keeps the word on the call-off, and her sale's own money card says it whatever the order's state): her money said in AIAIC's own sentence, word for word as that card says it, never 'No money moves on this sale', with 'Nothing is due to you on this sale: it was called off.' beside it, no amount to her, no deductions, never confirmed, never drawn as a success, no step n of 5; on AIAIC's recording of her word that she got ₹23,880 and on a collect order after the buyer's word and after her word that it has not come, each DERIVED then called off with only the fields AIAIC's call-off sets; in Marathi and Hindi AIAIC's own sentences, no English word (RC2-ANN-1)", async () => {
    type Said = { key: string; values: Record<string, unknown> } | null | undefined;
    const moneyOf = (o: Record<string, unknown> | undefined) =>
      (o?.["money"] ?? {}) as Record<string, unknown> & { say?: Said };
    /** AIAIC'S CALL-OFF OF ONE ORDER (DERIVED, in memory): only what its `store.cancel_order` and
     *  `payout_store.money_for_her` change (engine, read only): the order's state cancelled, with the reason's code and the
     *  time; its lane called off (`lane_of`); no report taken on it any more (`report_refusal`: order_closed). People's word
     *  stays as AIAIC keeps it (`say`, `reports`). Its lot's quantity, which goes back to the listing, is not this test's. */
    const calledOff = (raw: Record<string, unknown>, id: string, at: string): Raw => {
      const c = copy(raw) as Raw;
      const o = c.orders.find((x) => x["order_id"] === id);
      ok(o, `${id} is in the answer`);
      o["order_state"] = "cancelled";
      o["cancel_reason_code"] = "buyer_called_off";
      o["updated_at"] = at;
      o["lane"] = { code: "called_off", since: at, waiting_on: null, synthetic: true };
      const m = moneyOf(o);
      m["can_report"] = false;
      m["why_not_report"] = {
        code: "order_closed",
        why: "The order was called off: it takes no payment report.",
      };
      return c;
    };
    /** What her sale's own page says of her money (`moneyCard`, AiaicOrderDetail's money card), as her server reads it. */
    const salePageSays = (lang: Lang, raw: Record<string, unknown>, id: string) => {
      const order = app.mineForBrowser(copy(raw)).orders.find((o) => o.order_id === id);
      ok(order, `${id} is read by her server`);
      return (
        app.moneyCard(
          (k: string, v?: Record<string, string | number>) => fill(lang, k, v ?? {}),
          order,
        )?.line ?? null
      );
    };
    const saleOn = (p: Page, id: string) => {
      const s = p.items().find((i) => i.getAttribute("data-id") === id);
      ok(s, `${id} is on her page`);
      return s;
    };
    /** Her called-off sale where AIAIC holds people's word: that word, and every safety word of a called-off sale. */
    const heldWord = async (raw: Raw, id: string, said: string, what: string) => {
      const p = await mount("en", screenOf(raw));
      try {
        await ready(p);
        const s = saleOn(p, id);
        assert.equal(s.getAttribute("data-lane"), "called_off", `${what}: the order, called off`);
        const money = statusOf(s, "today-state-money");
        assert.deepEqual(
          money.codes,
          ["told"],
          `${what}: people's word, a state of its own (RC2-ANN-1; it said "${money.text}")`,
        );
        assert.equal(money.text, said, `${what}: AIAIC's own sentence, word for word`);
        assert.equal(
          money.text,
          salePageSays("en", raw, id),
          `${what}: as her sale's own money card says it`,
        );
        ok(
          !(s.textContent ?? "").includes(EN.stopped),
          `${what}: never "No money moves on this sale" beside people's word`,
        );
        assert.equal(
          s.querySelector('[data-testid="today-money-none-due"]')?.textContent,
          EN.noneDue,
          `${what}: nothing is due to her, said plainly`,
        );
        ok(!s.querySelector('[data-testid="today-money-to-her"]'), `${what}: no amount "to you"`);
        ok(
          !s.querySelector('[data-testid="today-money-commission"]') &&
            !s.querySelector('[data-testid="today-money-gst"]'),
          `${what}: no deductions from money she will not get`,
        );
        ok(!s.querySelector('[data-confirmed="yes"]'), `${what}: never confirmed`);
        ok(!s.querySelector('[data-testid="today-progress"]'), `${what}: no step n of 5`);
        const box = s.querySelector(
          '[data-testid="today-state-money"] [data-status]',
        ) as HTMLElement | null;
        assert.equal(box?.getAttribute("data-tone"), "info", `${what}: never drawn as a success`);
        ok(box?.querySelector("svg"), `${what}: an icon with the words, never colour alone`);
      } finally {
        await p.unmount();
      }
    };

    // A1: AIAIC's recording, the team's word for her that she got ₹23,880 (route direct). No step recorded, no link, not
    // paid, nothing at VAJRA: AIAIC's `cancel_blockers` names nothing that stops its call-off
    const raw = DIRECT as Raw;
    const direct = raw.orders.find((o) => moneyOf(o)["route"] === "direct");
    ok(direct, "the recording holds a sale whose payment AIAIC recorded as made outside it");
    const directId = String(direct["order_id"]);
    assert.deepEqual(
      [
        (direct["fulfilment"] as unknown[]).length,
        direct["payment_state"],
        direct["vajra_state"],
        direct["order_state"],
      ],
      [0, "not_connected", "not_connected", "accepted"],
      "the recording: no step, no link, nothing at VAJRA, accepted: AIAIC can call it off",
    );
    const reports = moneyOf(direct)["reports"] as {
      what: string;
      amount_inr: number | null;
      created_at: string;
    }[];
    const her = reports[reports.length - 1];
    ok(her?.what === "received" && her.amount_inr === 23880, "the recording: received, ₹23,880");
    const offDirect = calledOff(raw, directId, "2026-11-14T06:00:00+00:00");
    await heldWord(
      offDirect,
      directId,
      EN.saidGot(inr(23880), istDay(her.created_at)),
      "her word that she got it, then called off",
    );

    // A2 and A3: AIAIC's recorded collect order with no link (`from_aiaic`: her amount by AIAIC's figure), with the
    // buyer's word that he paid (as TD17 derives it), or the team's record of her word that it has not come, as AIAIC
    // keeps each (`claim_report` takes it there: no link live, nothing paid; `money_for_her` says it), then called off
    const many = copy(MANY) as Raw;
    const wo = many.orders.find((o) => o["from_aiaic"] && o["payment_state"] === "not_connected");
    ok(wo, "the recording holds a collect order with no link yet");
    const woId = String(wo["order_id"]);
    assert.deepEqual(
      [(wo["fulfilment"] as unknown[]).length, wo["vajra_state"], wo["order_state"]],
      [0, "not_connected", "accepted"],
      "the recording: no step, nothing at VAJRA, accepted: AIAIC can call it off",
    );
    const saidAt = new Date(Date.parse(String(wo["created_at"])) + 3_600_000).toISOString();
    const offAt = new Date(Date.parse(saidAt) + 3_600_000).toISOString();
    const amount = wo["amount_inr"] as number;
    const withWord = (what: "buyer_says_paid" | "not_received"): Raw => {
      const c = copy(many) as Raw;
      const o = c.orders.find((x) => x["order_id"] === woId) as Record<string, unknown>;
      const m = moneyOf(o);
      const buyer = what === "buyer_says_paid";
      m["say"] = buyer
        ? {
            key: "farmer.money.direct.buyer_says",
            values: { amount, day: saidAt, ref: "UPIREF778899" },
          }
        : {
            key: "farmer.money.direct.said_not_yet",
            values: { amount: null, day: saidAt, ref: null },
          };
      m["reports"] = [
        {
          report_id: buyer ? "prp_derivedbuyerword0001" : "prp_derivednotcome00001",
          said_by: buyer ? "operator_for_buyer" : "operator_for_farmer",
          what,
          amount_inr: buyer ? amount : null,
          reference: buyer ? "UPIREF778899" : null,
          simulated: true,
          created_at: saidAt,
        },
      ];
      return { ...c, orders: [o], listings: [] };
    };
    await heldWord(
      calledOff(withWord("buyer_says_paid"), woId, offAt),
      woId,
      EN.buyerSays(inr(amount)),
      "the buyer's word that he paid, then called off",
    );
    await heldWord(
      calledOff(withWord("not_received"), woId, offAt),
      woId,
      EN.saidNotYet,
      "her word that it has not come, then called off",
    );

    // Marathi and Hindi: A1, AIAIC's own sentence as her sale's page says it, and no English word on her page
    for (const lang of ["mr", "hi"] as const) {
      const m = await mount(lang, screenOf(offDirect, lang));
      try {
        await ready(m);
        await settle(100);
        const page = m.q('[data-testid="today"]');
        ok(page, "her page");
        assert.deepEqual(
          latinIn(page),
          [],
          `${lang}, her sale called off after her word: no English word`,
        );
        const s = saleOn(m, directId);
        const said = statusOf(s, "today-state-money");
        assert.deepEqual(said.codes, ["told"], `${lang}: people's word`);
        assert.equal(
          said.text,
          salePageSays(lang, offDirect, directId),
          `${lang}: AIAIC's own sentence, as her sale's own money card says it`,
        );
        ok(
          !said.text.includes(words(lang, "aiaic.today.money.stopped")),
          `${lang}: never 'No money moves on this sale'`,
        );
        assert.equal(
          s.querySelector('[data-testid="today-money-none-due"]')?.textContent,
          words(lang, "aiaic.today.money.none_due"),
          `${lang}: nothing is due to her, said plainly`,
        );
      } finally {
        await m.unmount();
      }
    }
  });

  return learn;
}

// ------------------------------------------------------------------------------------------------ run

async function main() {
  const started = Date.now();
  let ready = false;
  try {
    const { JSDOM } = (await import("jsdom")) as {
      JSDOM: new (html: string, options: Record<string, unknown>) => { window: unknown };
    };
    const dom = new JSDOM("<!doctype html><html><head><title></title></head><body></body></html>", {
      url: "http://localhost/",
      pretendToBeVisual: true,
    });
    const window = dom.window as Window & typeof globalThis;
    domGlobals(window as unknown as Record<string, unknown>);
    const app = await loadApp();
    await suite(app, window)();
    ready = true;
  } catch (e) {
    const error = e instanceof Error ? (e.stack ?? e.message) : String(e);
    results.push({
      name: "the suite starts: jsdom, the app's modules and AIAIC's recordings load",
      ok: false,
      ms: Date.now() - started,
      error,
    });
    console.log(`FAIL the suite could not start\n${error}`);
  }
  if (ready)
    for (const t of tests) {
      const t0 = Date.now();
      outside.length = 0;
      rejections.length = 0;
      try {
        await (around ? around(t.run) : t.run());
        assert.deepEqual(unansweredCalls(), [], "no server function this suite does not answer");
        assert.deepEqual(outside, [], "nothing left this machine");
        assert.deepEqual(rejections, [], "no press ended in an unhandled rejection");
        results.push({ name: t.name, ok: true, ms: Date.now() - t0 });
        console.log(`PASS ${t.name}`);
      } catch (e) {
        const error = e instanceof Error ? (e.stack ?? e.message) : String(e);
        results.push({ name: t.name, ok: false, ms: Date.now() - t0, error });
        console.log(`FAIL ${t.name}\n${error}`);
      }
    }
  for (const [name, from] of Object.entries(readFrom)) console.log(`(${name}: read from ${from})`);
  const failed = results.filter((r) => !r.ok).length;
  const junit = process.env["AIAIC_TEST_JUNIT"];
  if (junit) {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const cases = results
      .map(
        (r) =>
          `  <testcase classname="${SUITE}" name="${esc(r.name)}" time="${(r.ms / 1000).toFixed(3)}">` +
          (r.ok ? "" : `<failure message="failed">${esc(r.error ?? "")}</failure>`) +
          "</testcase>",
      )
      .join("\n");
    fs.writeFileSync(
      junit,
      `<?xml version="1.0" encoding="utf-8"?>\n<testsuite name="${SUITE}" tests="${results.length}" failures="${failed}" errors="0" skipped="0" timestamp="${new Date(started).toISOString()}" time="${((Date.now() - started) / 1000).toFixed(3)}">\n${cases}\n</testsuite>\n`,
      "utf-8",
    );
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed, of ${results.length}`);
  process.exit(failed ? 1 : 0);
}

void main();
