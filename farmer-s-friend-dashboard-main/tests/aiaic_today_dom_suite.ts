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
 * manifest fails the suite, naming it). AIAIC's Marathi crop and district names come from its recorded
 * `GET /places/crops` for Nashik in Marathi (`places_crops_nashik_mh_mr.json`, in no manifest: held here to the sha256 it
 * has at 11e7c1a).
 *
 * DERIVED, IN MEMORY, AND SAID IN EACH TEST: a failed read (`aiaic_unavailable`, `aiaic_signed_out`: this app's own
 * problem codes), AIAIC's crisis answer as her server reads it (`problem("crisis", ...)` with the helplines of AIAIC's
 * recorded crisis answer), a lot she listed after she started a sale here (a recorded lot, its `created_at` moved), an
 * AIAIC that sends no lane (a recorded order, its `lane` removed), and Hindi crop and district names (no Hindi place list
 * is recorded in her fixtures).
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
  const { problem, laneOf } = await import("../src/lib/aiaic-trade");
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
  const hrefOf = (el: Element | null) => el?.getAttribute("href") ?? null;
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

  test("TD2 her sale on AIAIC's recorded group journey: four separate states (the order being readied, no payment, the collection and the testing each a practice step done, her money not paid), said as part of a group sale with no stale handover step and no 'needs you' (AUD-3); and a direct sale waiting on her (AIAIC's recording of a real account): her next step in the order's own terms, whom it waits on (her), 'needs you', no practice word; the sale's own page one press away", async () => {
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
      assert.equal(order.text, words("en", "aiaic.today.lane.being_readied"));
      assert.deepEqual(pay.codes, ["not_connected"], "the buyer's payment: its own state");
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
  });

  // ============================================================================================ TD3

  test("TD3 her money's parts said apart on AIAIC's recorded sends: held for the pickup (her amount an estimate), sent but not reached (still an estimate), reached her bank (confirmed, the payment company's word); the agreed price gross, AIAIC's commission and GST apart, transport said as no part of AIAIC's figures", async () => {
    const cases: [Record<string, unknown>, string, string, "yes" | "no"][] = [
      [PAID, "collect_mine_paid", "held", "no"],
      [SENDING, "collect_mine_processing", "sent", "no"],
      [REACHED, "collect_mine_processed", "reached", "yes"],
    ];
    for (const [raw, name, state, confirmed] of cases) {
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
        if (state === "held") {
          const holds = fa["holds"] as Record<string, unknown>;
          assert.equal(
            p.q('[data-testid="today-money-why"]')?.textContent,
            words("en", `aiaic.money.holds.waits_for.${String(holds["waits_for"])}`),
            `${name}: why AIAIC holds it, AIAIC's own reason`,
          );
        }
        const toHer = p.q('[data-testid="today-money-to-her"]');
        ok(toHer, `${name}: her amount is said`);
        assert.equal(
          toHer.getAttribute("data-confirmed"),
          confirmed,
          `${name}: confirmed only once it reached her bank`,
        );
        const amount = fa["to_her_inr"] as number;
        const rupee = `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
        assert.equal(
          toHer.textContent,
          fill(
            "en",
            confirmed === "yes"
              ? "aiaic.today.money.to_her_confirmed"
              : "aiaic.today.money.to_her_estimate",
            {
              amount: rupee,
            },
          ),
          `${name}: ${confirmed === "yes" ? "confirmed" : "an estimate until it reaches her bank"}`,
        );
        ok(
          (p.q('[data-testid="today-money-gross"]')?.textContent ?? "").startsWith(
            fill("en", "aiaic.today.money.gross", { amount: "" }).trim(),
          ),
          `${name}: the agreed price, gross`,
        );
        const fees =
          (fa["commission_inr"] as number | null) !== null ||
          (fa["gst_inr"] as number | null) !== null;
        assert.equal(
          Boolean(p.q('[data-testid="today-money-deductions"]')),
          fees,
          `${name}: the deductions only where AIAIC set them`,
        );
        assert.equal(
          p.q('[data-testid="today-money-transport"]')?.textContent,
          words("en", "aiaic.today.money.transport"),
          `${name}: transport said, never folded in`,
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
    const crisisAnswer = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, "safety_check_crisis.json"), "utf-8"),
    ) as {
      answer: {
        answer: string;
        message: string;
        talk_to_someone: { name: string; phone: string }[];
      };
    };
    const crisis = app.problem("crisis", {
      crisis: {
        answer: crisisAnswer.answer.answer,
        message: crisisAnswer.answer.message,
        helplines: crisisAnswer.answer.talk_to_someone.map((x) => ({
          name: x.name,
          phone: x.phone,
        })),
      },
    });
    const c = await mount("en", { ok: false, problem: crisis });
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
        ["at", "crop", "district"],
        "only the crop, the district and when",
      );
      assert.deepEqual([kept["crop"], kept["district"]], ["onion", "Nashik"]);
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
    app.today.keepSellStart("onion", "Nashik", Date.now() - 60_000);
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
        words("en", "aiaic.today.guest"),
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
          words("en", "aiaic.today.card.price_note"),
          `${id}: the uncalibrated warning where advice is offered`,
        );
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
          '[role="radiogroup"], [data-testid="home-today-link"], a[href="/ask"]',
        ),
      ].map(
        (e) => e.getAttribute("data-testid") ?? e.getAttribute("role") ?? e.getAttribute("href"),
      );
      assert.deepEqual(
        order,
        ["radiogroup", "home-today-link", "/ask"],
        "her language first, then the new card, then Get my advice",
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
