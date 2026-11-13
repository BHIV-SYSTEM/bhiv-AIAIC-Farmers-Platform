/**
 * HER SALE ON THE STEP KIT, DRIVEN AS SHE DRIVES IT (Round 2, R2-3 lane A part A-b, 12 Nov 2026; DESIGN 5.2's A9 and
 * DESIGN_UPDATE_2026-11-11 C.14's KA1 to KA12 on her sell flow).
 *
 * Run:  npx tsx tests/aiaic_sell_kit_dom_suite.ts   (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file;
 *       AIAIC_TEST_ONLY=KA1,KA9 runs only the tests whose names start so)
 *
 * The REAL sale page (`routes/listing.new.tsx`: its route, its gate, AIAIC's switch and `AiaicSellForm`, now the kit's flow)
 * is mounted in jsdom under React's `act`, inside a TanStack Router of its own (memory history), and driven as she drives
 * it: her finger lands on what she taps (so the box she leaves gets blur), she types one character at a time, presses Enter
 * on the keypad, and the phone's back button is the history's back. jsdom does no layout: "at 360 wide" (the window is set
 * so) is the walk's to measure. A9's other half, "every existing test of the form passes", is run by the suites that hold
 * them (the trade suite's A18, A20, A30, A61 and B8; the storage suite's S55 and S60), never assumed here.
 *
 * WHAT ANSWERS HER PAGE, AND NOTHING LEAVES THIS MACHINE: AIAIC is a closed port of this machine (AIAIC_BASE_URL is set before
 * any app module loads); every connection is refused, and `fetch` answers only the scan's `/safety/check` (AIAIC's RECORDED
 * crisis answer when what is read holds a copied crisis phrase, a clean read otherwise), through the REAL `scanFirst` server
 * function. Where sales live is this server's own answer, AIAIC (`getTradeMode`, put in the page's cache as the server would
 * answer it). Her page's other server functions are answered in this process, after each one's own validator, by AIAIC's
 * RECORDED answers (tests/fixtures/aiaic, never written by hand), as this server reads them:
 *   - her records (GET /farmer/trade): `practice_mine_empty` (a practice account, her profile's district Nashik), through
 *     this server's `mineForBrowser`;
 *   - districts (GET /places/districts): Maharashtra's in English and Madhya Pradesh's in en, mr and hi;
 *   - crops (GET /places/crops): Nashik's in Marathi;
 *   - her district's mandi prices (GET /farmer/trade/price): `practice_price`, onion, which AIAIC answered for her record's
 *     district, Nashik (its recorder named the crop only), so it answers what the page asks for onion in Nashik,
 *     Maharashtra, through this server's `referencePriceShown`;
 *   - her sale (POST /farmer/trade/listings): `practice_listed` (onion, 40 quintals at Rs 3,930: 201) and
 *     `farmer_app_price_far_refused` (onion, 10 quintals at Rs 3,94,200: 422 `price_far_from_market`, with its range),
 *     each recorded for her record's district, Nashik, so each answers the same sale the page sends for Nashik, through
 *     this server's own reading (`listing_id`; `refusalOf`).
 * A read no recording answers is answered as AIAIC not answering (the page's own failed path, said in words with Try
 * again), and each one is kept (`missing`): the tests that meet one say so. No recording holds Maharashtra's districts in
 * Marathi or Hindi, Nashik's crops in English or Hindi, a district's talukas, another crop's prices, or AIAIC's answer to a
 * far price confirmed; listed for the main session to record from AIAIC. So her sale is driven from its first screen in
 * English (Nashik from her profile, held by AIAIC's English list) and from the crop on in Marathi, after her language is
 * changed on the page: a real path of her app, and one that keeps every answer given (C.6).
 *
 * HER PAYOUT DETAILS, AS THE FORM IS TODAY (KA7P, KA11P): the REAL `DestinationForm` of FromAiaicCard.tsx, not yet on
 * the kit (its distress guards, the trade suite's A52 to A64 and the payout forms' DOM suite, hold its present shape; its
 * conversion is left for a part of its own, as part A-b's progress file says), driven as the DOM suite drives it: AIAIC's
 * notice of `collect_mine_paid` and the destination given before of `collect_mine_processing`, through `mineForBrowser`;
 * her press given to `giveMyDestination`'s own validator, its handler never run (AIAIC is never asked).
 */
process.env["AIAIC_BASE_URL"] = "http://127.0.0.1:9";
// THE ROUTER'S BROWSER HALF IN JSDOM (as the kit suite): under Node, TanStack Router's `isServer` is true unless NODE_ENV is
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
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(here, "fixtures", "aiaic");
const SUITE = "aiaic_sell_kit_dom_suite";

/** `assert.ok` with a message always (given none, Node names another line under tsx). */
const ok: (value: unknown, message: string) => asserts value = (value, message) => {
  assert.equal(Boolean(value), true, message);
};
/** An element said by what it is; a DOM node is never handed to `assert`'s own comparisons (a React page's node holds
 *  the whole tree, and Node's strict assert diffs both values). */
const said = (el: unknown) => {
  if (!el || typeof el !== "object" || !("tagName" in el)) return String(el);
  const e = el as Element;
  const id = e.getAttribute("data-testid");
  return `<${e.tagName.toLowerCase()}${id ? ` ${id}` : ""}> "${(e.textContent ?? "").trim().slice(0, 40)}"`;
};
const sameEl = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) assert.fail(`${message}: ${said(actual)}, not ${said(expected)}`);
};
const noEl = (el: unknown, message: string) => {
  if (el) assert.fail(`${message}: ${said(el)} is there`);
};

// ------------------------------------------------------------------------------- the guard: nothing leaves

const outside: string[] = [];
const SCAN_URL = `${process.env["AIAIC_BASE_URL"]}/safety/check`;
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

const recorded = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf-8")) as Record<
    string,
    unknown
  >;
const CRISIS_ANSWER = recorded("safety_check_crisis")["answer"] as Record<string, unknown>;
const HELPLINES = (CRISIS_ANSWER["talk_to_someone"] as { phone: string }[]).map((h) => h.phone);
const PHRASES: string[] = [];

const seen = {
  scans: [] as string[],
  unanswered: [] as string[],
  rejections: [] as string[],
};
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url !== SCAN_URL || (init?.method ?? "GET") !== "POST") {
    outside.push(`fetch ${init?.method ?? "GET"} ${url}`);
    throw new TypeError("refused by the suite's guard");
  }
  const body = JSON.parse(String(init?.body ?? "{}")) as { text?: unknown };
  const text = String(body.text ?? "");
  seen.scans.push(text);
  const crisis = PHRASES.some((p) => text.toLowerCase().includes(p.toLowerCase()));
  return new Response(JSON.stringify(crisis ? CRISIS_ANSWER : { distress: false }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;
process.on("unhandledRejection", (e) => {
  seen.rejections.push(String(e).split("\n")[0] ?? "");
});

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

type Lang = "en" | "mr" | "hi";

/** jsdom's window as this suite's globals; what jsdom has not (layout, scrolling, an observer) is stood in for, plainly. */
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
  const w = window as unknown as {
    HTMLElement: { prototype: Record<string, unknown> };
    IntersectionObserver: unknown;
  };
  w.HTMLElement.prototype["scrollIntoView"] = function scrollIntoView() {
    /* jsdom does no layout */
  };
  const noScroll = () => undefined;
  for (const k of ["scrollTo", "scroll", "scrollBy"]) {
    Object.defineProperty(window, k, { value: noScroll, configurable: true, writable: true });
    Object.defineProperty(g, k, { value: noScroll, configurable: true, writable: true });
  }
  class NeverSeen {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  w.IntersectionObserver = NeverSeen;
  g["IntersectionObserver"] = NeverSeen;
  Object.defineProperty(window, "innerWidth", { value: 360, configurable: true });
}

async function loadApp() {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const router = await import("@tanstack/react-router");
  const { runWithStartContext } = await import("@tanstack/start-storage-context");
  const { DICTS, I18nProvider, useI18n } = await import("../src/lib/i18n");
  const { Route: SaleRoute } = await import("../src/routes/listing.new");
  const { scanFirst } = await import("../src/lib/aiaic-account.functions");
  const { getMyTrade, getSalePrice, getTripTalukas, giveMyDestination, sellProduce } =
    await import("../src/lib/aiaic-trade.functions");
  const { DestinationForm } = await import("../src/components/farm/aiaic/FromAiaicCard");
  const { getPlacesCrops, getPlacesDistricts } = await import("../src/lib/places.functions");
  const { mineForBrowser, referencePriceShown, refusalOf } =
    await import("../src/lib/aiaic-trade.server");
  const { problem, quintalWords, rupees } = await import("../src/lib/aiaic-trade");
  const shared = await import("./aiaic_shared_scan");
  return {
    React,
    createRoot,
    QueryClient,
    QueryClientProvider,
    router,
    runWithStartContext,
    DICTS,
    I18nProvider,
    useI18n,
    SaleRoute,
    scanFirst,
    getMyTrade,
    getSalePrice,
    getTripTalukas,
    giveMyDestination,
    DestinationForm,
    sellProduce,
    getPlacesCrops,
    getPlacesDistricts,
    mineForBrowser,
    referencePriceShown,
    refusalOf,
    problem,
    quintalWords,
    rupees,
    shared,
  };
}
type App = Awaited<ReturnType<typeof loadApp>>;

// ------------------------------------------------------------------------------------------------ the suite

function suite(app: App, window: Window & typeof globalThis) {
  const { React, DICTS, shared } = app;
  const { act, createElement: h } = React;
  const { CRISIS_MR, CRISIS_EN, CRISIS_HI } = shared;
  PHRASES.push(CRISIS_HI, CRISIS_EN, CRISIS_MR);
  const document = window.document;
  const words = (lang: Lang, key: string) => DICTS[lang][key] ?? DICTS.en[key] ?? key;
  /** A word file's line with its blanks filled, as the page's `t` fills them. */
  const fill = (lang: Lang, key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      words(lang, key),
    );
  const tOf = (lang: Lang) => (key: string, values?: Record<string, string | number>) =>
    values ? fill(lang, key, values) : words(lang, key);

  // --------------------------------------------- AIAIC's recorded answers to what the page sent, in this process
  const CROPS_NASHIK_MR = recorded("places_crops_nashik_mh_mr")["answer"] as {
    crops: unknown[];
    first_page: string[];
  };
  const MINE = recorded("practice_mine_empty")["answer"];
  const PRICE = recorded("practice_price");
  const LISTED = recorded("practice_listed");
  const FAR = recorded("farmer_app_price_far_refused");
  const requestBody = (rec: Record<string, unknown>) =>
    ((rec["_recorded"] as { request?: { body?: Record<string, unknown> } }).request?.body ??
      {}) as Record<string, unknown>;
  const lower = (v: unknown) =>
    String(v ?? "")
      .trim()
      .toLowerCase();
  const inNashik = (sent: Record<string, unknown>) =>
    lower(sent["state"]) === "mh" && lower(sent["district"]) === "nashik";
  /** The sale a recording holds is the one sent: the same crop, quantity and price, unconfirmed, no grade or taluka,
   *  sent for her record's district (Nashik, Maharashtra), as the recording's sale was. */
  const sameSale = (rec: Record<string, unknown>, sent: Record<string, unknown>) => {
    const r = requestBody(rec);
    return (
      inNashik(sent) &&
      lower(sent["crop"]) === lower(r["crop"]) &&
      Number(sent["quantity_q"]) === Number(r["quantity_q"]) &&
      Number(sent["ask_price_per_q"]) === Number(r["ask_price_per_q"]) &&
      !sent["price_confirmed"] &&
      !sent["grade"] &&
      !sent["taluka"]
    );
  };
  /** Each read no recording answered, as `read: what was sent`. */
  const missing: string[] = [];
  /** Each sale she sent, in order: its key and what the validator let through. */
  const sales: Record<string, unknown>[] = [];
  const unavailable = () => ({ ok: false, problem: app.problem("aiaic_unavailable") });
  /** AIAIC's answer to her price read when a case sets it (R2-4's AP4-04: a read that fails three ways, or one that holds
   *  no price); null, AIAIC's recordings as below. Each case sets it back to null in its `finally`. */
  let priceAnswer: ((sent: Record<string, unknown>) => unknown) | null = null;
  const answers = {
    getMyTrade: () => ({
      ok: true,
      data: { mine: app.mineForBrowser(MINE), cropNames: {}, districtNames: {} },
    }),
    getPlacesDistricts: (sent: Record<string, unknown>) => {
      const r = shared.recordedTrip("districts", sent, {});
      if (r) return r;
      missing.push(`districts: ${JSON.stringify(sent)}`);
      return { ok: false, districts: [], error: "AIAIC did not answer" };
    },
    getPlacesCrops: (sent: Record<string, unknown>) => {
      if (inNashik(sent) && sent["lang"] === "mr")
        return { ok: true, crops: CROPS_NASHIK_MR.crops, firstPage: CROPS_NASHIK_MR.first_page };
      missing.push(`crops: ${JSON.stringify(sent)}`);
      return { ok: false, crops: [], firstPage: [], error: "AIAIC did not answer" };
    },
    getTripTalukas: (sent: Record<string, unknown>) => {
      missing.push(`talukas: ${JSON.stringify(sent)}`);
      return unavailable();
    },
    getSalePrice: (sent: Record<string, unknown>) => {
      if (priceAnswer) return priceAnswer(sent);
      if (inNashik(sent) && lower(sent["crop"]) === "onion")
        return { ok: true, data: app.referencePriceShown(PRICE["answer"]) };
      missing.push(`price: ${JSON.stringify(sent)}`);
      return unavailable();
    },
    sellProduce: (sent: Record<string, unknown>) => {
      sales.push(sent);
      if (sameSale(LISTED, sent))
        return {
          ok: true,
          data: { listing_id: String((LISTED["answer"] as { listing_id: string }).listing_id) },
        };
      if (sameSale(FAR, sent)) return { ok: false, problem: app.refusalOf(422, FAR["answer"]) };
      missing.push(`sale: ${JSON.stringify({ ...sent, key: "(her key)" })}`);
      return unavailable();
    },
    // her payout details: its OWN validator has let them through (above); its handler never runs, so AIAIC is never asked
    giveMyDestination: (sent: Record<string, unknown>) => {
      given.push(sent);
      return { ok: true, data: { status: null } };
    },
  } as const;
  /** Each payout destination she gave, as its validator let it through. */
  const given: Record<string, unknown>[] = [];
  /** Each read the page asked, in order, with what it sent. */
  const asked: { read: string; sent: Record<string, unknown> }[] = [];

  const handlers = new Map<unknown, string>();
  const named = {
    scanFirst: app.scanFirst,
    getMyTrade: app.getMyTrade,
    getPlacesDistricts: app.getPlacesDistricts,
    getPlacesCrops: app.getPlacesCrops,
    getTripTalukas: app.getTripTalukas,
    getSalePrice: app.getSalePrice,
    sellProduce: app.sellProduce,
    giveMyDestination: app.giveMyDestination,
  };
  const rpc = {
    options: {
      client: async (ctx: Record<string, unknown>) => {
        const name = handlers.get(ctx["extractedFn"]);
        if (name === "scanFirst")
          return {
            ...ctx,
            result: await shared.askScanFirst({
              data: ctx["data"] as { text: string; lang: Lang },
            }),
          };
        if (name && name in answers) {
          // the call's own validator first, as Start's RPC runs it on this server
          const sent = (await shared.inProcess(
            named[name as keyof typeof named],
            ctx["data"],
            "validator",
          )) as Record<string, unknown>;
          asked.push({ read: name, sent });
          return { ...ctx, result: answers[name as keyof typeof answers](sent) };
        }
        seen.unanswered.push(String(name ?? "a server function this suite does not know"));
        throw new Error("a server function this suite does not answer");
      },
    },
  };
  const inStart = <T>(fn: () => Promise<T>) =>
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
        () => (fn as (opts: { data: unknown }) => Promise<unknown>)({ data: null }),
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
  const SETTLE_MS = 150;
  const settle = async (ms = SETTLE_MS) => {
    const from = Date.now();
    for (let i = 0; i < 30 || Date.now() - from < ms; i++)
      await act(async () => {
        await turn();
      });
  };
  const land = async (el: Element) => {
    if (document.activeElement === el) return;
    await act(async () => {
      (el as HTMLElement).focus();
    });
  };
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
    ?.set as (this: HTMLInputElement, v: string) => void;
  const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")
    ?.set as (this: HTMLSelectElement, v: string) => void;
  const type = async (box: HTMLInputElement, text: string) => {
    await land(box);
    for (let i = 1; i <= [...text].length; i++)
      await act(async () => {
        valueSetter.call(box, [...text].slice(0, i).join(""));
        box.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
  };
  const clear = async (box: HTMLInputElement) => {
    await land(box);
    await act(async () => {
      valueSetter.call(box, "");
      box.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  };
  const pick = async (list: HTMLSelectElement, value: string) => {
    await land(list);
    await act(async () => {
      selectSetter.call(list, value);
      list.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await settle();
  };
  const tap = async (el: Element | null | undefined, what: string) => {
    ok(el, `there is ${what} to tap`);
    await land(el);
    await act(async () => {
      (el as HTMLElement).click();
    });
    await settle();
  };
  const enter = async (box: HTMLInputElement) => {
    await land(box);
    await act(async () => {
      box.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    await settle();
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
  type Page = Awaited<ReturnType<typeof mountSale>>;
  /** The sale page at an address, as she opens it: a phone of her own, her language, AIAIC set up on this server. */
  const mountSale = async (address: string, lang: Lang) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("aiaic.lang", lang);
    const qc = new app.QueryClient({ defaultOptions: { queries: { retry: false } } });
    // where sales live: this server's own answer, AIAIC (as getTradeMode answers once the farmer settings are set)
    qc.setQueryData(["aiaic-trade-mode"], { mode: "aiaic", problem: null });
    const R = app.router;
    const language: { set: ((l: Lang) => void) | null } = { set: null };
    function Language() {
      const { setLang } = app.useI18n();
      language.set = setLang;
      return null;
    }
    const root = R.createRootRoute({
      component: () =>
        h(app.QueryClientProvider, {
          client: qc,
          children: h(app.I18nProvider, {
            initialLang: lang,
            children: [h(Language, { key: "lang" }), h(R.Outlet, { key: "page" })],
          }),
        }),
    });
    const page = app.SaleRoute.update({
      id: "/listing/new",
      path: "/listing/new",
      getParentRoute: () => root,
    } as never);
    const entries = [address];
    const router = R.createRouter({
      routeTree: root.addChildren([page as never]),
      history: R.createMemoryHistory({ initialEntries: entries }),
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const reactRoot = app.createRoot(container);
    await act(async () => {
      await router.load();
      reactRoot.render(h(R.RouterProvider, { router: router as never }));
    });
    await settle(300);
    const q = (sel: string) => container.querySelector(sel);
    return {
      container,
      router,
      qc,
      entries,
      q,
      step: (id: string) => q(`[data-testid="sell-step-${id}"]`),
      stateOf: (id: string) => q(`[data-testid="sell-step-${id}"]`)?.getAttribute("data-state"),
      heading: (id: string) => q(`[data-testid="sell-step-${id}"] h2`),
      box: (testid: string) => q(`[data-testid="${testid}"]`) as HTMLInputElement | null,
      search: () => router.state.location.search as Record<string, unknown>,
      said: () => container.textContent ?? "",
      setLang: async (l: Lang) => {
        await act(async () => {
          language.set?.(l);
        });
        await settle(300);
      },
      unmount: async () => {
        await act(async () => reactRoot.unmount());
        container.remove();
        qc.clear();
      },
    };
  };
  const openSettled = async (p: Page, id: string) => {
    for (let i = 0; i < 60 && p.stateOf(id) !== "open"; i++) await settle(50);
    assert.equal(p.stateOf(id), "open", `the ${id} step opens`);
  };
  const crisisCard = (p: Page) => p.q("[data-crisis]");
  const helplinesOn = (p: Page) =>
    HELPLINES.every((phone) =>
      [...(p.q("[data-crisis]")?.querySelectorAll("a[href^='tel:']") ?? [])].some((a) =>
        (a.textContent ?? "").includes(phone),
      ),
    );
  /** Her sale up to its crop step in Marathi: Nashik from her profile (AIAIC's English list of Maharashtra holds it), the
   *  crop step open with Nashik's crops in English unrecorded, then her language changed to Marathi on the page. */
  const toCrop = async () => {
    const p = await mountSale("/listing/new", "en");
    await openSettled(p, "crop");
    ok(
      p.q('[data-testid="sell-crops-failed"]'),
      "Nashik's crops in English: no recording, said as AIAIC not answering",
    );
    await p.setLang("mr");
    await waitFor(() => p.q('[data-testid="sell-crop-onion"]'), "AIAIC's recorded crops of Nashik");
    return p;
  };
  /** On to the price step: onion, a quantity chip, the grade as it stands (not graded). */
  const toPrice = async (quintals = 40) => {
    const p = await toCrop();
    await tap(p.q('[data-testid="sell-crop-onion"]'), "onion");
    await openSettled(p, "quantity");
    await tap(p.q(`[data-testid="sell-qty-${quintals}"]`), `${quintals} quintals`);
    await openSettled(p, "price");
    await waitFor(() => p.box("sell-price-typed"), "the price box");
    return p;
  };
  /** On to the check step, at the price in the box (AIAIC's suggestion unless one is given). */
  const toCheck = async (quintals = 40, price: string | null = null) => {
    const p = await toPrice(quintals);
    if (price !== null) {
      const box = p.box("sell-price-typed") as HTMLInputElement;
      await clear(box);
      await type(box, price);
    }
    await tap(p.q('[data-testid="sell-price-use"]'), "Use this price");
    await openSettled(p, "check");
    return p;
  };
  const press = (p: Page) => p.q('[data-testid="sell-check-press"]') as HTMLButtonElement | null;
  const priceReads = () => asked.filter((a) => a.read === "getSalePrice").map((a) => a.sent);

  /** Every text a page holds, hidden ones included: each text node, each aria-label and title, the page title. */
  const everyText = (root: Element) => {
    const out: string[] = [];
    const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      if ((n.textContent ?? "").trim()) out.push((n.textContent ?? "").trim());
    for (const el of root.querySelectorAll("[aria-label],[title],[placeholder]"))
      for (const at of ["aria-label", "title", "placeholder"]) {
        const v = el.getAttribute(at);
        if (v) out.push(v);
      }
    out.push(document.title);
    return out;
  };
  /** Latin words a Marathi or Hindi screen of her sale may carry: AIAIC's name, and the name of the source AIAIC says its
   *  mandi prices come from, as AIAIC names it (a source's own name, as the trade suite holds Cashfree and MSRTC). */
  const latinAllowed = () =>
    new Set(["AIAIC", String((PRICE["answer"] as { source_name: string }).source_name)]);
  const englishIn = (texts: string[]) => {
    const allowed = latinAllowed();
    return texts.flatMap((s) => (s.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !allowed.has(w)));
  };
  /** The sell flow's new words (part A-b), each a key of en, mr and hi. */
  const SELL_KEYS = [
    "aiaic.sell.step.list",
    "aiaic.sell.step.where",
    "aiaic.sell.step.crop",
    "aiaic.sell.step.quantity",
    "aiaic.sell.step.grade",
    "aiaic.sell.step.price",
    "aiaic.sell.step.check",
    "aiaic.sell.list_named",
    "aiaic.sell.price.use",
    "aiaic.sell.price.hint",
    "aiaic.sell.price.range",
    "aiaic.sell.price.source_no_n",
    "aiaic.sell.price.failed",
    "aiaic.sell.far.held",
  ];
  /** The sentence on her one button, in her language: the quantity, the crop and the price. */
  const saleSentence = (lang: Lang, quintals: number, crop: string, price: number) =>
    fill(lang, "aiaic.sell.list_named", {
      qty: app.quintalWords(tOf(lang), quintals),
      crop,
      price: app.rupees(price),
    });
  const ONION_MR = "कांदा";

  // ======================================================================================== A9 / KA12
  test("KA12 A9 her sale on the kit keeps the price check against her district's mandis: the read asks for the flow's own crop and district, AIAIC's range is drawn before her box, the box starts from its middle, and a price far from them is asked back, her yes the SAME press with its same key", async () => {
    await inStart(async () => {
      const p = await toPrice(40);
      try {
        const reads = priceReads();
        ok(reads.length > 0, "her district's mandi prices are asked");
        for (const r of reads)
          assert.deepEqual(
            r,
            { crop: "onion", state: "mh", district: "nashik" },
            "asked for the flow's own crop, state and district",
          );
        const answer = PRICE["answer"] as Record<string, number | string>;
        const range = p.q('[data-testid="sell-price-range"]');
        ok(range, "the range of her district's mandi prices, on the price step");
        const box = p.box("sell-price-typed") as HTMLInputElement;
        ok(
          (range.compareDocumentPosition(box) & 4) !== 0,
          "the range is drawn before her box: she sees the mandis first",
        );
        const t = tOf("mr");
        assert.equal(
          p.q('[data-testid="sell-price-low"]')?.textContent,
          `${t("aiaic.sell.price.low")} ${app.rupees(Number(answer["lowest_per_q"]))}`,
          "AIAIC's lowest",
        );
        assert.equal(
          p.q('[data-testid="sell-price-middle"]')?.textContent,
          `${t("aiaic.sell.price.middle")} ${app.rupees(Number(answer["middle_of_all_per_q"]))}`,
          "AIAIC's middle",
        );
        assert.equal(
          p.q('[data-testid="sell-price-high"]')?.textContent,
          `${t("aiaic.sell.price.high")} ${app.rupees(Number(answer["highest_per_q"]))}`,
          "AIAIC's highest",
        );
        assert.equal(
          p.q('[data-testid="sell-price-source"]')?.textContent,
          t("aiaic.sell.price.source", {
            n: Number(answer["mandis_reporting"]),
            source: String(answer["source_name"]),
            day: String(answer["price_day"]),
          }),
          "how many mandis, whose prices and of which day",
        );
        assert.equal(
          box.value,
          String(Math.round(Number(answer["suggested_ask_per_q"]))),
          "the box starts from AIAIC's suggestion, the middle",
        );
        ok(p.q('[data-testid="sell-price-yours"]'), "her price is marked among them");
        // her price used: the check step says the sale, and her press sends it as the flow holds it
        await tap(p.q('[data-testid="sell-price-use"]'), "Use this price");
        await openSettled(p, "check");
        const suggested = Number(answer["suggested_ask_per_q"]);
        assert.equal(
          (press(p)?.textContent ?? "").trim(),
          saleSentence("mr", 40, ONION_MR, suggested),
          "her one button says the sale",
        );
        sales.length = 0;
        await tap(press(p), "her sale's button");
        assert.equal(sales.length, 1, "one sale sent");
        const sent = { ...sales[0] };
        ok(typeof sent["key"] === "string", "with its press key");
        delete sent["key"];
        assert.deepEqual(
          sent,
          {
            state: "mh",
            district: "nashik",
            crop: "onion",
            quantity_q: 40,
            ask_price_per_q: suggested,
            grade: null,
          },
          "the sale as the flow holds it",
        );
        ok(p.q('[data-testid="sell-done"]'), "AIAIC's 201: listed, said");
      } finally {
        await p.unmount();
      }
      // a price far from her district's mandis: AIAIC's recorded 422, with its range, asked back
      const f = await toCheck(10, "394200");
      try {
        sales.length = 0;
        await tap(press(f), "her sale's button");
        const far = await waitFor(() => f.q('[data-testid="sell-far"]'), "AIAIC's question back");
        const range = (FAR["answer"] as { detail: { range: Record<string, number | string> } })
          .detail.range;
        assert.equal(
          (far.querySelector("p")?.textContent ?? "").trim(),
          fill("mr", "aiaic.sell.far.ask", {
            price: app.rupees(394200),
            day: String(range["price_day"]),
            low: app.rupees(Number(range["lowest_per_q"])),
            high: app.rupees(Number(range["highest_per_q"])),
          }),
          "asked back with AIAIC's own range and day",
        );
        assert.equal(sales.length, 1, "AIAIC kept nothing; one sale sent so far");
        const key = sales[0]?.["key"];
        await tap(f.q('[data-testid="sell-far-yes"]'), "Yes, list it at that price");
        assert.equal(sales.length, 2, "her yes sends the sale again");
        assert.equal(sales[1]?.["key"], key, "the SAME press: its same key");
        assert.equal(sales[1]?.["price_confirmed"], true, "saying her price is right");
        assert.equal(sales[1]?.["ask_price_per_q"], 394200, "at her price");
        // no recording holds AIAIC's answer to a far price confirmed: AIAIC not answering, said; her yes keeps its key
        ok(
          missing.some((m) => m.startsWith("sale:") && m.includes('"price_confirmed":true')),
          "a confirmed far price: no recording (listed for the main session)",
        );
        ok(f.q('[data-testid="sell-far"]'), "the question stays while no answer came");
        await tap(f.q('[data-testid="sell-far-yes"]'), "Yes again");
        assert.equal(sales[2]?.["key"], key, "again the same key");
        // No: her price step opens again, with her price as she typed it
        await tap(f.q('[data-testid="sell-far-change"]'), "No, change my price");
        await openSettled(f, "price");
        assert.equal(
          (f.box("sell-price-typed") as HTMLInputElement).value,
          "394200",
          "her price kept",
        );
      } finally {
        await f.unmount();
      }
    });
  });

  // ================================================================== KA12F, KA12N (R2-4's AP4-04)
  // HER PRICE STEP WHEN AIAIC'S PRICE READ FAILS, OR HOLDS NO PRICE. DESIGN_UPDATE E.0: "a read that fails says so". The
  // failed card says the mandi prices could not be read, with Try again; "none held" is a claim about the mandis, so a
  // failed read is never drawn as it (it would be false and would take her Try again away), and a read that holds no
  // price is never drawn as failed. The price step is reached in Marathi (no recording holds Nashik's crops in English),
  // then her language is changed to English on the page: the price read's key holds no language, so nothing is read again.
  /** The parts of AIAIC's range on the price step: none of them is drawn when AIAIC's range is not held. */
  const RANGE_PARTS = [
    "sell-price-range",
    "sell-price-low",
    "sell-price-middle",
    "sell-price-high",
    "sell-price-source",
    "sell-price-yours",
  ];
  /** The price step holds no rupee figure (its box's label says "(₹)", a sign with no amount) and no total. */
  const noFigureOnPrice = (p: Page, what: string) => {
    for (const id of RANGE_PARTS) noEl(p.q(`[data-testid="${id}"]`), `${what}: no ${id}`);
    ok(
      !/₹\s*[0-9०-९]/.test(p.step("price")?.textContent ?? ""),
      `${what}: no rupee figure on the step`,
    );
    assert.equal(
      (p.box("sell-price-typed") as HTMLInputElement | null)?.value,
      "",
      `${what}: the box empty`,
    );
    ok((p.q('[data-testid="sell-total"]')?.textContent ?? "").includes("—"), `${what}: no total`);
  };
  /** The three ways AIAIC's price read fails: each as her server hands it to her page. */
  const PRICE_FAILS: [string, string, () => unknown][] = [
    ["KA12F1", "AIAIC unreachable", () => unavailable()],
    [
      "KA12F2",
      "refused: AIAIC's 422 district_required, the contract's refusal of this read, handed on by her server unchanged",
      () => ({ ok: false, problem: app.problem("district_required", { status: 422 }) }),
    ],
    [
      "KA12F3",
      "a read that throws on its way (her page's query in error)",
      () => {
        throw new Error(
          "the price read threw (this suite's stand-in for a read that fails on its way)",
        );
      },
    ],
  ];
  for (const [id, how, failing] of PRICE_FAILS)
    test(`${id} her sale's price step when AIAIC's price read fails, ${how}: in Marathi and English the failed card in role=alert with its words and Try again; never "none held"; no range and no figure; the box empty; Try again reads once more`, async () => {
      await inStart(async () => {
        priceAnswer = failing;
        const p = await toPrice(40);
        try {
          for (const lang of ["mr", "en"] as const) {
            if (lang === "en") await p.setLang("en");
            const what = `${how}, ${lang}`;
            const card = await waitFor(
              () => p.q('[data-testid="sell-price-failed"]'),
              `${what}: the failed card`,
            );
            assert.equal(card.getAttribute("role"), "alert", `${what}: role=alert`);
            ok(
              (card.textContent ?? "").includes(words(lang, "aiaic.sell.price.failed")),
              `${what}: aiaic.sell.price.failed's words`,
            );
            const again = [...card.querySelectorAll("button")].find(
              (b) => (b.textContent ?? "").trim() === words(lang, "aiaic.retry"),
            );
            ok(again, `${what}: Try again, in her words`);
            noEl(p.q('[data-testid="sell-price-none"]'), `${what}: never "none held"`);
            noFigureOnPrice(p, what);
            const reads = priceReads().length;
            await tap(again, "Try again");
            assert.equal(priceReads().length, reads + 1, `${what}: Try again reads once more`);
            ok(p.q('[data-testid="sell-price-failed"]'), `${what}: failed again, said again`);
            noEl(p.q('[data-testid="sell-price-none"]'), `${what}: and still never "none held"`);
          }
        } finally {
          priceAnswer = null;
          await p.unmount();
        }
      });
    });

  /**
   * DERIVED, labelled (R2-4's AP4-04): AIAIC's recorded `practice_price` as AIAIC answers when it holds no mandi price for
   * the crop in the district: `held` false and its figures removed (its day, its age and its mandis as AIAIC's not-held
   * reference keeps them, null and empty; how many reported, the lowest, middle, highest and suggested prices, and the
   * sentences that say them, taken out). No recording holds AIAIC's answer to this read with nothing held.
   */
  const PRICE_NOT_HELD = (() => {
    const answer = { ...(PRICE["answer"] as Record<string, unknown>) };
    for (const k of [
      "mandis_reporting",
      "middle_of_all_per_q",
      "lowest_per_q",
      "highest_per_q",
      "suggested_ask_per_q",
      "note",
      "suggestion_is",
      "trace",
    ])
      delete answer[k];
    return { ...answer, held: false, price_day: null, age_days: null, mandis: [] };
  })();
  test('KA12N her sale\'s price step when AIAIC holds no mandi price for her crop in her district (DERIVED from practice_price, held false): in Marathi and English "none held" is said, never the failed card; no range and no figure; the box empty', async () => {
    await inStart(async () => {
      priceAnswer = () => ({ ok: true, data: app.referencePriceShown(PRICE_NOT_HELD) });
      const p = await toPrice(40);
      try {
        for (const lang of ["mr", "en"] as const) {
          if (lang === "en") await p.setLang("en");
          const what = `none held, ${lang}`;
          const none = await waitFor(
            () => p.q('[data-testid="sell-price-none"]'),
            `${what}: "none held"`,
          );
          assert.equal(
            (none.textContent ?? "").trim(),
            words(lang, "aiaic.sell.price.none"),
            `${what}: aiaic.sell.price.none's words`,
          );
          noEl(p.q('[data-testid="sell-price-failed"]'), `${what}: never the failed card`);
          noEl(
            p.step("price")?.querySelector('[role="alert"]'),
            `${what}: nothing said as an alert`,
          );
          noFigureOnPrice(p, what);
        }
      } finally {
        priceAnswer = null;
        await p.unmount();
      }
    });
  });

  // ======================================================================================== KA1
  test("KA1 K1 on her sale: opening it moves no focus; a choice opens the next step and takes the focus to it (its heading, or its box); typing to any length moves nothing; leaving a box checks nothing", async () => {
    await inStart(async () => {
      const p = await toCrop();
      try {
        sameEl(document.activeElement, document.body, "opening the page moves no focus");
        await tap(p.q('[data-testid="sell-crop-onion"]'), "onion");
        await openSettled(p, "quantity");
        sameEl(
          document.activeElement,
          p.heading("quantity"),
          "the crop tapped: the focus on step 3",
        );
        await tap(p.q('[data-testid="sell-qty-other"]'), "Other");
        const box = p.box("sell-qty-typed");
        ok(box, "Other opens its box");
        sameEl(document.activeElement, box, "Other puts the cursor in its box");
        await type(box, "12345678901234567890");
        sameEl(document.activeElement, box, "typing moves no focus, whatever its length");
        assert.equal(p.stateOf("quantity"), "open", "and opens no step");
        noEl(p.q('[data-testid="sell-qty-range"]'), "and says no error");
        await clear(box);
        await type(box, "0");
        await land(p.heading("quantity") as Element);
        await settle();
        noEl(p.q('[data-testid="sell-qty-range"]'), "leaving the box checks nothing");
        assert.equal(box.getAttribute("aria-invalid"), null, "no box marked in error");
        assert.equal(box.value, "0", "what was typed stays");
        // a chip: the price step opens with the cursor in its box (AIAIC's prices are read by then)
        await tap(p.q('[data-testid="sell-qty-40"]'), "40 quintals");
        await openSettled(p, "price");
        const price = p.box("sell-price-typed");
        sameEl(document.activeElement, price, "the chip tapped: the cursor in the price box");
        await clear(price as HTMLInputElement);
        await type(price as HTMLInputElement, "39301234567890");
        sameEl(document.activeElement, price, "typing moves nothing");
        noEl(p.q('[data-testid="sell-price-error"]'), "and checks nothing");
        assert.equal(p.stateOf("price"), "open", "the step stays");
      } finally {
        await p.unmount();
      }
    });
  });

  // ======================================================================================== KA2
  test("KA2 K2 on her sale: Continue, or Enter in the step's box, checks the step: the next step focused, or the error beside the box (described, marked, focused, in her language, what was typed kept); the place's Continue with no district says so beside the list", async () => {
    await inStart(async () => {
      const p = await toPrice(40);
      try {
        const box = p.box("sell-price-typed") as HTMLInputElement;
        await clear(box);
        await type(box, "0");
        await tap(p.q('[data-testid="sell-price-use"]'), "Use this price");
        const err = p.q('[data-testid="sell-price-error"]');
        ok(err, "the error beside the box");
        ok(
          (box.getAttribute("aria-describedby") ?? "").split(" ").includes(err.id),
          "the box's aria-describedby names the error",
        );
        assert.equal(box.getAttribute("aria-invalid"), "true", "the box is marked in error");
        sameEl(document.activeElement, box, "the focus on the box in error");
        assert.equal(box.value, "0", "what was typed stays");
        ok(
          (err.textContent ?? "").includes(words("mr", "aiaic.sell.price.range")),
          "in her language",
        );
        ok(
          (err.compareDocumentPosition(box) & 4) !== 0,
          "the error sits before its box (between the question and the box)",
        );
        assert.equal(p.stateOf("price"), "open", "the step stays");
        // corrected, Enter (the keypad's Done): the check step opens, the focus on its heading
        await clear(box);
        await type(box, "3930");
        await enter(box);
        await openSettled(p, "check");
        sameEl(document.activeElement, p.heading("check"), "the next step takes the focus");
      } finally {
        await p.unmount();
      }
      // the place: another state holds no district of hers, and Continue says so beside the list
      const w = await mountSale("/listing/new", "en");
      try {
        await openSettled(w, "crop");
        await tap(w.q('[data-testid="sell-step-where-change"]'), "Change on the place");
        await openSettled(w, "where");
        await tap(w.q('[data-testid="sell-state-mp"]'), "Madhya Pradesh");
        await waitFor(
          () =>
            ((w.q('[data-testid="sell-district"]') as HTMLSelectElement | null)?.options.length ??
              0) > 1,
          "Madhya Pradesh's recorded districts",
        );
        await tap(w.q('[data-testid="sell-where-continue"]'), "Continue");
        const err = w.q('[data-testid="sell-district-error"]');
        ok(err, "no district: said beside the list");
        const list = w.q('[data-testid="sell-district"]') as HTMLSelectElement;
        ok(
          (list.getAttribute("aria-describedby") ?? "").includes(err.id),
          "the list's aria-describedby names it",
        );
        assert.equal(list.getAttribute("aria-invalid"), "true", "the list is marked");
        sameEl(document.activeElement, list, "the focus on the list");
        ok((err.textContent ?? "").includes(words("en", "aiaic.kit.choose_one")), "what to do");
        assert.equal(w.stateOf("where"), "open", "the step stays");
        // a district chosen: Continue finishes the step
        await pick(list, "indore");
        await tap(w.q('[data-testid="sell-where-continue"]'), "Continue");
        await openSettled(w, "crop");
        sameEl(document.activeElement, w.heading("crop"), "the crop step takes the focus");
      } finally {
        await w.unmount();
      }
    });
  });

  // ======================================================================================== KA3
  test("KA3 K3 on her sale: three answers, Change on the first, then on: the later ones are kept; a change that no longer fits marks the later step check again and opens it; the address holds the step's name and nothing she gave; the back button goes back one step", async () => {
    await inStart(async () => {
      const p = await toCheck(40);
      try {
        assert.equal(p.search()["step"], "check", "the address names the open step");
        // what the page reads of its address, and every entry the history holds, as written
        const addresses = [JSON.stringify(p.search()), ...p.entries].join("\n");
        for (const v of ["40", "3930", "onion", "nashik"])
          ok(!addresses.includes(v), `${v} is not in the address`);
        ok(
          p.entries.every((e) =>
            [...new URL(e, "http://x").searchParams.keys()].every((k) => k === "step"),
          ),
          "each entry holds the step's name alone",
        );
        // Change on the crop, the same crop again: the quantity and the price are kept
        await tap(p.q('[data-testid="sell-step-crop-change"]'), "Change on the crop");
        await openSettled(p, "crop");
        await tap(p.q('[data-testid="sell-crop-onion"]'), "onion again");
        await openSettled(p, "check");
        assert.equal(p.stateOf("quantity"), "done", "the quantity is kept");
        assert.equal(p.stateOf("price"), "done", "the price is kept");
        ok(
          (p.q('[data-testid="sell-step-quantity-summary"]')?.textContent ?? "").includes("40"),
          "with its answer",
        );
        // Change on the crop, another crop: the price was for onion, so it says check again and opens again in order
        await tap(p.q('[data-testid="sell-step-crop-change"]'), "Change on the crop");
        await openSettled(p, "crop");
        const crops = [...(p.q('[data-testid="sell-crops"]')?.querySelectorAll("button") ?? [])];
        const other = crops.find((b) => b.getAttribute("data-testid") !== "sell-crop-onion");
        await tap(other, "another crop");
        assert.equal(p.stateOf("quantity"), "done", "the quantity still fits: kept");
        await openSettled(p, "price");
        ok(p.q('[data-testid="sell-step-price-again"]'), "the price says check again");
        ok(
          (p.step("price")?.textContent ?? "").includes(words("mr", "aiaic.kit.check_again")),
          "in words",
        );
        // the back button goes back one step: the crop again, with its answer
        await act(async () => p.router.history.back());
        await settle();
        await openSettled(p, "crop");
        assert.equal(p.search()["step"], "crop", "the address follows");
      } finally {
        await p.unmount();
      }
    });
  });

  // ======================================================================================== KA4
  test("KA4 K4 on her sale: a fixed flow of six shows 2 of 6, the hidden Step 2 of 6 and the page title; aria-current on one step only; each state in words", async () => {
    await inStart(async () => {
      const p = await toCrop();
      try {
        const t = tOf("mr");
        assert.equal(
          p.q('[data-testid="sell-step-crop-count"]')?.textContent,
          t("aiaic.kit.n_of", { n: 2, total: 6 }),
          "2 of 6, in view",
        );
        ok(
          (p.heading("crop")?.textContent ?? "").includes(
            t("aiaic.kit.step_of", { n: 2, total: 6 }),
          ),
          "the hidden Step 2 of 6 in its heading",
        );
        assert.equal(
          document.title,
          t("aiaic.kit.title.fixed", {
            question: t("aiaic.sell.step.crop"),
            n: 2,
            total: 6,
            flow: t("aiaic.sell.title"),
            app: t("app.name"),
          }),
          "the page title says the open step",
        );
        const current = p.container.querySelectorAll('[aria-current="step"]');
        assert.equal(current.length, 1, "aria-current on one step only");
        sameEl(current[0], p.step("crop"), "the open one");
        const stateWords: Record<string, string> = {
          where: "done",
          crop: "open",
          quantity: "todo",
          grade: "done",
          price: "todo",
          check: "todo",
        };
        for (const [id, state] of Object.entries(stateWords)) {
          assert.equal(p.stateOf(id), state, `${id}: ${state}`);
          assert.equal(
            (p.q(`[data-testid="sell-step-${id}-state-words"]`)?.textContent ?? "").trim(),
            `(${t(`aiaic.kit.state.${state}`)})`,
            `${id}: its state in words`,
          );
        }
      } finally {
        await p.unmount();
      }
    });
  });

  // ======================================================================================== KA5
  test("KA5 K5 on her sale: it ends in a check step with Change on each part and one button that says the sale (never Continue); after the press the answer is said in role=status, the focus on it, and no other card opens", async () => {
    await inStart(async () => {
      const p = await toCheck(40);
      try {
        for (const part of ["where", "crop", "quantity", "grade", "price"])
          ok(p.q(`[data-testid="sell-check-change-${part}"]`), `${part}: its Change`);
        ok(p.q('[data-testid="sell-check-part-total"]'), "the total, said");
        noEl(p.q('[data-testid="sell-check-change-total"]'), "the total has no Change");
        const button = press(p);
        ok(button, "one button");
        const text = (button.textContent ?? "").trim();
        assert.notEqual(text, words("mr", "aiaic.kit.continue"), "never Continue");
        assert.equal(text, saleSentence("mr", 40, ONION_MR, 3930), "it says the sale");
        ok(text.includes(app.rupees(3930)) && text.includes("40"), "the amounts on it");
        await tap(button, "her sale's button");
        const done = await waitFor(() => p.q('[data-testid="sell-done"]'), "the answer");
        assert.equal(done.getAttribute("role"), "status", "said in role=status");
        sameEl(
          document.activeElement,
          p.q('[data-testid="sell-listed"]'),
          "the focus on the answer",
        );
        noEl(p.q('[aria-current="step"]'), "no step opens by itself after the sale");
        noEl(p.q('[data-testid="sell-flow"]'), "and no other card");
        assert.equal(p.search()["step"], undefined, "the flow's step goes out of the address");
      } finally {
        await p.unmount();
      }
    });
  });

  // ======================================================================================== KA6
  test("KA6 K6 on her sale: a crisis typed in her price box or her quantity box gets the helplines first, on Continue and on a chip, and her sale does not move", async () => {
    await inStart(async () => {
      const p = await toPrice(40);
      try {
        const box = p.box("sell-price-typed") as HTMLInputElement;
        await clear(box);
        await type(box, CRISIS_MR);
        seen.scans.length = 0;
        sales.length = 0;
        await tap(p.q('[data-testid="sell-price-use"]'), "Use this price");
        await waitFor(() => crisisCard(p), "AIAIC's crisis card");
        ok(
          seen.scans.some((s) => s.includes(CRISIS_MR)),
          "her words reach the scan at the press",
        );
        ok(helplinesOn(p), "the helplines, each a number she can dial");
        assert.equal(sales.length, 0, "no sale sent");
        noEl(p.q('[data-testid="sell-step-check"][data-state="open"]'), "the flow does not move");
      } finally {
        await p.unmount();
      }
      // the quantity's Other box: words in it, then a chip pressed: read first
      const q = await toCrop();
      try {
        await tap(q.q('[data-testid="sell-crop-onion"]'), "onion");
        await openSettled(q, "quantity");
        await tap(q.q('[data-testid="sell-qty-other"]'), "Other");
        await type(q.box("sell-qty-typed") as HTMLInputElement, CRISIS_MR);
        seen.scans.length = 0;
        await tap(q.q('[data-testid="sell-qty-40"]'), "40 quintals");
        await waitFor(() => crisisCard(q), "AIAIC's crisis card");
        ok(
          seen.scans.some((s) => s.includes(CRISIS_MR)),
          "the box's words read before the chip leaves it",
        );
        ok(helplinesOn(q), "the helplines");
        noEl(
          q.q('[data-testid="sell-step-price"][data-state="open"]'),
          "the price step never opens",
        );
      } finally {
        await q.unmount();
      }
    });
  });

  // ======================================================================================== KA7
  test("KA7 K7 on her sale: every new word in en, mr and hi with the same blanks; on Marathi screens of each step, and a Hindi one, no English word, hidden text included", async () => {
    const blanks = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of SELL_KEYS) {
      for (const lang of ["en", "mr", "hi"] as const)
        ok(DICTS[lang][key], `${key}: ${lang} has it`);
      assert.deepEqual(blanks(words("mr", key)), blanks(words("en", key)), `${key}: mr's blanks`);
      assert.deepEqual(blanks(words("hi", key)), blanks(words("en", key)), `${key}: hi's blanks`);
      for (const lang of ["mr", "hi"] as const)
        assert.deepEqual(
          (
            words(lang, key)
              .replace(/\{\w+\}/g, "")
              .match(/[A-Za-z]{2,}/g) ?? []
          ).filter((w) => !latinAllowed().has(w)),
          [],
          `${key}: no English word in ${lang}`,
        );
    }
    await inStart(async () => {
      const p = await toCrop();
      try {
        const screens: [string, () => Promise<void>][] = [
          ["the crop step", async () => undefined],
          [
            "the quantity step, its Other box and its error",
            async () => {
              await tap(p.q('[data-testid="sell-crop-onion"]'), "onion");
              await openSettled(p, "quantity");
              await tap(p.q('[data-testid="sell-qty-other"]'), "Other");
              await tap(p.q('[data-testid="sell-qty-use"]'), "Use, with nothing typed");
              ok(p.q('[data-testid="sell-qty-range"]'), "its error");
            },
          ],
          [
            "the grade step",
            async () => {
              await tap(p.q('[data-testid="sell-qty-40"]'), "40 quintals");
              await openSettled(p, "price");
              await tap(p.q('[data-testid="sell-step-grade-change"]'), "Change on the grade");
              await openSettled(p, "grade");
            },
          ],
          [
            "the price step, its range and its error",
            async () => {
              await tap(p.q('[data-testid="sell-grade-none"]'), "not graded");
              await openSettled(p, "price");
              const box = p.box("sell-price-typed") as HTMLInputElement;
              await clear(box);
              await tap(p.q('[data-testid="sell-price-use"]'), "Use, with nothing typed");
              ok(p.q('[data-testid="sell-price-error"]'), "its error");
              await type(box, "3930");
            },
          ],
          [
            "the check step",
            async () => {
              await tap(p.q('[data-testid="sell-price-use"]'), "Use this price");
              await openSettled(p, "check");
            },
          ],
          [
            "the place, opened again",
            async () => {
              await tap(p.q('[data-testid="sell-check-change-where"]'), "Change on the place");
              await openSettled(p, "where");
            },
          ],
          [
            "her sale listed",
            async () => {
              await tap(p.q('[data-testid="sell-where-continue"]'), "Continue");
              await openSettled(p, "check");
              await tap(press(p), "her sale's button");
              await waitFor(() => p.q('[data-testid="sell-done"]'), "listed");
            },
          ],
        ];
        for (const [what, go] of screens) {
          await go();
          assert.deepEqual(englishIn(everyText(p.container)), [], `mr, ${what}: no English word`);
        }
      } finally {
        await p.unmount();
      }
      // Hindi: AIAIC's recorded lists hold no Maharashtra in Hindi; the page says so in Hindi, and nothing in English
      const hi = await mountSale("/listing/new", "hi");
      try {
        await openSettled(hi, "where");
        ok(hi.q('[data-testid="sell-districts-failed"]'), "the districts could not be read: said");
        await tap(hi.q('[data-testid="sell-where-continue"]'), "Continue, with nothing chosen");
        assert.deepEqual(englishIn(everyText(hi.container)), [], "hi: no English word");
      } finally {
        await hi.unmount();
      }
    });
  });

  // ======================================================================================== KA8
  test("KA8 K8 on her sale: while AIAIC's question about her price is up, her sale's button is held: aria-disabled, reachable, its reason read with it; a press says why again and sends nothing", async () => {
    await inStart(async () => {
      const f = await toCheck(10, "394200");
      try {
        await tap(press(f), "her sale's button");
        await waitFor(() => f.q('[data-testid="sell-far"]'), "AIAIC's question back");
        const button = press(f) as HTMLButtonElement;
        assert.equal(button.getAttribute("aria-disabled"), "true", "aria-disabled");
        assert.equal(button.hasAttribute("disabled"), false, "never the disabled attribute");
        assert.notEqual(button.tabIndex, -1, "reachable by Tab");
        const reason = f.q('[data-testid="sell-check-held"]');
        ok(reason, "its reason beside it");
        ok(
          (button.getAttribute("aria-describedby") ?? "").includes(reason.id),
          "read with it (aria-describedby)",
        );
        assert.equal(
          (reason.textContent ?? "").trim(),
          words("mr", "aiaic.sell.far.held"),
          "in her words",
        );
        const before = sales.length;
        await tap(button, "the held button");
        assert.equal(sales.length, before, "a press sends nothing");
        assert.equal(reason.getAttribute("role"), "alert", "and says why again");
      } finally {
        await f.unmount();
      }
    });
  });

  // ======================================================================================== KA9
  test("KA9 on her sale: the step in the search parameters; each move adds one entry, the back button returns one step with its answer; a link without the earlier answers opens the first missing step and says so; nothing but the flow's own step names opens a step", async () => {
    await inStart(async () => {
      const p = await toPrice(40);
      try {
        assert.equal(p.search()["step"], "price", "the address names the open step");
        const moves = p.entries.filter((e) => e.includes("step=")).length;
        ok(moves >= 2, "each move added its entry");
        await tap(p.q('[data-testid="sell-price-use"]'), "Use this price");
        await openSettled(p, "check");
        assert.equal(p.search()["step"], "check", "one more step");
        await act(async () => p.router.history.back());
        await settle();
        await openSettled(p, "price");
        assert.equal(
          (p.box("sell-price-typed") as HTMLInputElement).value,
          "3930",
          "back: the price step, with her answer",
        );
        await act(async () => p.router.history.back());
        await settle();
        await openSettled(p, "quantity");
        assert.equal(
          p.q('[data-testid="sell-qty-40"]')?.getAttribute("aria-pressed"),
          "true",
          "back again: the quantity, with her chip pressed",
        );
      } finally {
        await p.unmount();
      }
      // a link that names a later step, with no earlier answers: the first missing step, and it says so
      const r = await mountSale("/listing/new?step=price", "en");
      try {
        await openSettled(r, "crop");
        ok(r.q('[data-testid="sell-flow-restarted"]'), "it says the earlier answers were not kept");
      } finally {
        await r.unmount();
      }
      // anything else in ?step= opens nothing of its own and says nothing
      const n = await mountSale("/listing/new?step=nonsense", "en");
      try {
        await openSettled(n, "crop");
        noEl(n.q('[data-testid="sell-flow-restarted"]'), "a name that is no step: nothing said");
        ok(!n.said().includes("nonsense"), "and nothing of it printed");
      } finally {
        await n.unmount();
      }
      // and the step's box of the address is read by the page's one gate, as every box of it (F12): words of a crisis
      // in a link's ?step= get AIAIC's crisis card first, and nothing of them is printed
      seen.scans.length = 0;
      const c = await mountSale(`/listing/new?step=${encodeURIComponent(CRISIS_MR)}`, "mr");
      try {
        await waitFor(() => crisisCard(c), "AIAIC's crisis card, from the address");
        ok(
          seen.scans.some((s) => s.includes(CRISIS_MR)),
          "the gate read the step's box of the address",
        );
        ok(helplinesOn(c), "the helplines");
        noEl(c.q('[data-testid="sell-flow"]'), "nothing of the sale beside the card");
      } finally {
        await c.unmount();
      }
    });
  });

  // ======================================================================================== KA10
  test("KA10 on her sale: each box has its inputmode and enterkeyhint, none is a number box; Continue comes right after its box", async () => {
    await inStart(async () => {
      const p = await toCrop();
      try {
        await tap(p.q('[data-testid="sell-crop-onion"]'), "onion");
        await openSettled(p, "quantity");
        await tap(p.q('[data-testid="sell-qty-other"]'), "Other");
        const check = (box: HTMLInputElement | null, cont: string, what: string) => {
          ok(box, what);
          assert.equal(
            box.getAttribute("inputmode"),
            "decimal",
            `${what}: the keypad with its point`,
          );
          assert.equal(box.getAttribute("enterkeyhint"), "done", `${what}: its key says Done`);
          assert.notEqual(box.getAttribute("type"), "number", `${what}: never a number box`);
          const next = box.parentElement?.nextElementSibling;
          sameEl(next, p.q(`[data-testid="${cont}"]`), `${what}: Continue right after it`);
        };
        check(p.box("sell-qty-typed"), "sell-qty-use", "the quantity's box");
        await tap(p.q('[data-testid="sell-qty-40"]'), "40 quintals");
        await openSettled(p, "price");
        check(p.box("sell-price-typed"), "sell-price-use", "the price's box");
        for (const b of p.container.querySelectorAll("input"))
          assert.notEqual(b.getAttribute("type"), "number", "no number box anywhere on the page");
      } finally {
        await p.unmount();
      }
    });
  });

  // ======================================================================================== KA11
  test("KA11 on her sale: what she types is kept nowhere: never in the address, localStorage, sessionStorage or the query cache", async () => {
    await inStart(async () => {
      const p = await toCrop();
      const kept = () => {
        const stores = [window.localStorage, window.sessionStorage].flatMap((s) =>
          Array.from({ length: s.length }, (_, i) => {
            const key = s.key(i) ?? "";
            return `${key}=${s.getItem(key) ?? ""}`;
          }),
        );
        const cache = p.qc
          .getQueryCache()
          .getAll()
          .map((q) => JSON.stringify({ key: q.queryKey, data: q.state.data }));
        return [...p.entries, ...stores, ...cache, document.title].join("\n");
      };
      try {
        await tap(p.q('[data-testid="sell-crop-onion"]'), "onion");
        await openSettled(p, "quantity");
        await tap(p.q('[data-testid="sell-qty-other"]'), "Other");
        await type(p.box("sell-qty-typed") as HTMLInputElement, "37 bags");
        await tap(p.q('[data-testid="sell-qty-use"]'), "Use");
        ok(p.q('[data-testid="sell-qty-range"]'), "not a number: said beside the box");
        await clear(p.box("sell-qty-typed") as HTMLInputElement);
        await type(p.box("sell-qty-typed") as HTMLInputElement, "37.5");
        await tap(p.q('[data-testid="sell-qty-use"]'), "Use");
        await openSettled(p, "price");
        const box = p.box("sell-price-typed") as HTMLInputElement;
        await clear(box);
        await type(box, "3931 rupees");
        await tap(p.q('[data-testid="sell-price-use"]'), "Use");
        ok(p.q('[data-testid="sell-price-error"]'), "not a number: said beside the box");
        const held = kept();
        for (const v of ["37 bags", "bags", "37.5", "3931", "rupees"])
          ok(!held.includes(v), `${v}: kept nowhere`);
      } finally {
        await p.unmount();
      }
    });
  });

  // ======================================================= her payout details, as the form is today (not yet on the kit)
  const NOTICE = (
    app.mineForBrowser(recorded("collect_mine_paid")["answer"]) as { x_notice?: unknown }
  ).x_notice;
  const GIVEN_BEFORE = (
    app.mineForBrowser(recorded("collect_mine_processing")["answer"]) as { x_destination?: unknown }
  ).x_destination;
  type DestState = "first" | "replace" | "nonotice";
  /** The REAL `DestinationForm`, as the DOM suite opens it: her first destination, her replacement (Change tapped on the
   *  one given before) or a form AIAIC sent no notice for; inside a router at "/" (its memory history kept). */
  const mountDestination = async (lang: Lang, state: DestState = "first") => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("aiaic.lang", lang);
    const qc = new app.QueryClient({ defaultOptions: { queries: { retry: false } } });
    const R = app.router;
    const entries = ["/"];
    const router = R.createRouter({
      routeTree: R.createRootRoute(),
      history: R.createMemoryHistory({ initialEntries: entries }),
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const reactRoot = app.createRoot(container);
    await act(async () => {
      reactRoot.render(
        h(R.RouterContextProvider, {
          router: router as never,
          children: h(app.QueryClientProvider, {
            client: qc,
            children: h(app.I18nProvider, {
              initialLang: lang,
              children: h(app.DestinationForm, {
                dest: state === "replace" ? (GIVEN_BEFORE as never) : null,
                notice: state === "nonotice" ? null : (NOTICE as never),
                largeAmount: false,
              }),
            }),
          }),
        }),
      );
    });
    await settle();
    const q = (sel: string) => container.querySelector(sel);
    const t = tOf(lang);
    const byText = (sel: string, text: string) =>
      [...container.querySelectorAll(sel)].find((b) => (b.textContent ?? "").trim() === text);
    if (state === "replace") await tap(byText("button", t("aiaic.dest.change")), "Change");
    const scope = () => q('[data-testid="aiaic-destination-form"]') ?? container;
    return {
      container,
      qc,
      entries,
      scope,
      box: (key: string) =>
        [...scope().querySelectorAll("label")]
          .find((l) => (l.firstChild?.textContent ?? "").trim() === t(key))
          ?.querySelector("input") as HTMLInputElement | null,
      choose: (kind: "upi_id" | "bank_account") =>
        tap(byText('[role="radio"]', t(`aiaic.dest.kind.${kind}`)), kind),
      tick: () => tap(scope().querySelector('input[type="checkbox"]'), "her tick"),
      save: () => byText("button", t("aiaic.dest.save")) as HTMLButtonElement | undefined,
      unmount: async () => {
        await act(async () => reactRoot.unmount());
        container.remove();
        qc.clear();
      },
    };
  };
  /** Payout words a Marathi or Hindi screen may carry: AIAIC's name, its payments provider's (as AIAIC names it), and the
   *  codes of a payment's kinds and a bank's branch, as the trade suite's word tests hold them (UPI, IFSC, PAN). */
  const PAYOUT_LATIN = new Set(["AIAIC", "Cashfree", "UPI", "IFSC", "PAN"]);

  test("KA11P her payout details, as the form is today: her UPI ID, account number, IFSC and name are kept nowhere, never in the address, localStorage, sessionStorage or the query cache, after her press as before it", async () => {
    await inStart(async () => {
      const VALUES = {
        name: "Recording Farmer",
        account: shared.TEST_BANK.account,
        ifsc: shared.TEST_BANK.ifsc,
        upi: "success@upi",
      };
      for (const kind of ["bank_account", "upi_id"] as const) {
        const f = await mountDestination("en");
        const kept = () => {
          const stores = [window.localStorage, window.sessionStorage].flatMap((s) =>
            Array.from({ length: s.length }, (_, i) => {
              const key = s.key(i) ?? "";
              return `${key}=${s.getItem(key) ?? ""}`;
            }),
          );
          const cache = f.qc
            .getQueryCache()
            .getAll()
            .map((q) => JSON.stringify({ key: q.queryKey, data: q.state.data }));
          const mutations = f.qc
            .getMutationCache()
            .getAll()
            .map((m) => JSON.stringify(m.state));
          return [...f.entries, ...stores, ...cache, ...mutations, document.title].join("\n");
        };
        try {
          given.length = 0;
          await f.choose(kind);
          const fill =
            kind === "upi_id"
              ? [["aiaic.dest.upi", VALUES.upi]]
              : [
                  ["aiaic.dest.name", VALUES.name],
                  ["aiaic.dest.account", VALUES.account],
                  ["aiaic.dest.ifsc", VALUES.ifsc],
                ];
          for (const [key, value] of fill) {
            const box = f.box(key as string);
            ok(box, `${kind}: the box ${key}`);
            await type(box, value as string);
          }
          await f.tick();
          const typedValues = fill.map(([, v]) => v as string);
          for (const v of typedValues) ok(!kept().includes(v), `${kind}, typed: ${v} kept nowhere`);
          await tap(f.save(), "Save");
          assert.equal(given.length, 1, `${kind}: her details given to AIAIC's route, once`);
          for (const v of typedValues)
            ok(!kept().includes(v), `${kind}, after her press: ${v} kept nowhere`);
          ok(
            !kept().includes(VALUES.account.slice(0, 8)),
            `${kind}: no part of her account number`,
          );
        } finally {
          await f.unmount();
        }
      }
    });
  });

  test("KA7P her payout details, as the form is today: on Marathi and Hindi screens no English word, hidden text included, in each of its states (her first, a replacement, no notice), for a UPI ID and a bank, and with a refusal said", async () => {
    await inStart(async () => {
      for (const lang of ["mr", "hi"] as const)
        for (const state of ["first", "replace", "nonotice"] as const)
          for (const kind of ["upi_id", "bank_account"] as const) {
            const f = await mountDestination(lang, state);
            try {
              await f.choose(kind);
              if (state !== "nonotice") await f.tick();
              // a UPI ID with no @, or a name of two letters (Cashfree's rule takes it; AIAIC's four letters do not):
              // this phone's own refusal, said after the scan
              const box = f.box(kind === "upi_id" ? "aiaic.dest.upi" : "aiaic.dest.name");
              ok(box, `${lang} ${state} ${kind}: her box`);
              await type(box, kind === "upi_id" ? "abc" : "Ra");
              await tap(f.save(), "Save");
              const refusal = words(
                lang,
                kind === "upi_id"
                  ? "aiaic.refused.upi_id_not_valid"
                  : "aiaic.refused.account_name_not_valid",
              );
              ok(
                (f.scope().textContent ?? "").includes(refusal),
                `${lang} ${state} ${kind}: the refusal said, in her words`,
              );
              const english = everyText(f.container).flatMap((s) =>
                (s.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !PAYOUT_LATIN.has(w)),
              );
              assert.deepEqual(english, [], `${lang} ${state} ${kind}: no English word`);
            } finally {
              await f.unmount();
            }
          }
    });
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
      name: "the suite starts: jsdom and the app's modules load",
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
      seen.unanswered.length = 0;
      seen.rejections.length = 0;
      try {
        await t.run();
        assert.deepEqual(outside, [], "nothing left this machine");
        assert.deepEqual(seen.unanswered, [], "no server function this suite does not answer");
        assert.deepEqual(seen.rejections, [], "no press ended in an unhandled rejection");
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
