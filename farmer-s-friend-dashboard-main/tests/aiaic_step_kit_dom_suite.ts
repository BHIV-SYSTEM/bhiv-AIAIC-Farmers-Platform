/**
 * THE STEP KIT, DRIVEN AS SHE DRIVES IT (Round 2, R2-3 lane A, 12 Nov 2026; DESIGN_UPDATE_2026-11-11 C.14, KA1 to KA11).
 *
 * Run:  npx tsx tests/aiaic_step_kit_dom_suite.ts   (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file;
 *       AIAIC_TEST_ONLY=KA1,KA9 runs only the tests whose names start so)
 *
 * The REAL storage page (`routes/storage.tsx`, its route, its gate and its steps, now drawn with the kit) is mounted in jsdom
 * under React's `act`, inside a TanStack Router of its own (memory history), and driven as she drives it: her finger lands
 * on what she taps (so the box she leaves gets blur), she types one character at a time, presses Enter on the keypad, and
 * the phone's back button is the history's back. Where the storage flow has no such part (a fact of two boxes, a check step
 * before money, a money button AIAIC holds shut, her phone or UPI ID), the kit's own parts are driven in a small flow drawn
 * here from them, as every later flow of her app will be: KA2's two boxes, KA4's branching flow, KA5, KA8 and KA11.
 * jsdom does no layout: "at 360 wide" (the window is set so) is the walk's to measure (DESIGN_UPDATE C.14's walk).
 *
 * WHAT ANSWERS HER PAGE, AND NOTHING LEAVES THIS MACHINE: AIAIC is a closed port of this machine (AIAIC_BASE_URL is set before
 * any app module loads); every connection is refused, and `fetch` answers only the scan's `/safety/check` (AIAIC's RECORDED
 * crisis answer when what is read holds a copied crisis phrase, a clean read otherwise), through the REAL `scanFirst` server
 * function. The page's other server functions are answered in this process, after each one's own validator, by AIAIC's
 * RECORDED answer to exactly what the page sent (tests/fixtures/aiaic, never written by hand):
 *   - districts (GET /places/districts): Maharashtra's in English, Madhya Pradesh's in en, mr and hi;
 *   - crops (GET /places/crops): Nashik's in Marathi;
 *   - the plan (GET /storage/plan): a storage sample asked with the same crop, district, state and language, and no
 *     quantity, taluka or loan (AIAIC's labelled example).
 * A read no recording answers is answered as AIAIC not answering (the page's own failed path, said in words with Try again),
 * and each one is kept (`missing`): the tests that meet one say so. No recording holds the talukas of a district
 * (GET /transport/talukas), Maharashtra's districts in Marathi or Hindi, Nashik's crops in English or Hindi, or a plan
 * asked with a quantity; these are listed for the main session to record from AIAIC.
 */
process.env["AIAIC_BASE_URL"] = "http://127.0.0.1:9";
// THE ROUTER'S BROWSER HALF IN JSDOM: under Node, TanStack Router's `isServer` is true unless NODE_ENV is "test" (router-core's
// isServer/server.js), and a router that thinks it is on a server never listens to its history, so the phone's back button
// would move the history and nothing else. "test" leaves the router to ask whether a document exists (jsdom's does). The
// app reads NODE_ENV only for "production" (aiaic-identity.server.ts), which this is not either way.
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
const SUITE = "aiaic_step_kit_dom_suite";

/** `assert.ok` with a message always: given none, Node reads the test's source to write one, and under tsx it names
 *  another line. */
const ok: (value: unknown, message: string) => asserts value = (value, message) => {
  assert.equal(Boolean(value), true, message);
};
/** An element said by what it is: its tag, its test id, its first words. A DOM node is never handed to `assert`'s own
 *  comparisons: Node's strict assert builds a diff of both values even when a message is given, and a node of a React
 *  page holds the whole tree (the plants of 12 Nov 2026 ran out of memory on one). */
const said = (el: unknown) => {
  if (!el || typeof el !== "object" || !("tagName" in el)) return String(el);
  const e = el as Element;
  const id = e.getAttribute("data-testid");
  return `<${e.tagName.toLowerCase()}${id ? ` ${id}` : ""}> "${(e.textContent ?? "").trim().slice(0, 40)}"`;
};
/** The same element, or a failure that names both. */
const sameEl = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) assert.fail(`${message}: ${said(actual)}, not ${said(expected)}`);
};
/** No such element on the page. */
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
/** AIAIC's real crisis answer (POST /safety/check), as its recorder recorded it. */
const CRISIS_ANSWER = recorded("safety_check_crisis")["answer"] as Record<string, unknown>;
const HELPLINES = (CRISIS_ANSWER["talk_to_someone"] as { phone: string }[]).map((h) => h.phone);
/** The copied crisis phrases (filled once the shared module loads: none is written here). */
const PHRASES: string[] = [];

/** What the scan read, in order, and every event of a press: "scan" each time the scan is asked. */
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

/** jsdom's window as this suite's globals; what jsdom has not (layout, scrolling, an observer) is stood in for, plainly:
 *  a scroll is recorded, never done, and an IntersectionObserver never fires (the answer's map stays unloaded). */
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
    innerWidth: number;
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
  const { Route: StorageRoute } = await import("../src/routes/storage");
  const kit = await import("../src/components/farm/aiaic/kit/StepFlow");
  const flowKit = await import("../src/components/farm/aiaic/kit/useStepFlow");
  const { CrisisFirst } = await import("../src/components/farm/aiaic/CrisisFirst");
  const { useRaiseCrisis } = await import("../src/lib/aiaic-crisis");
  const { useScanBeforeRefusing } = await import("../src/lib/aiaic-scan");
  const { scanFirst } = await import("../src/lib/aiaic-account.functions");
  const { getTripTalukas, getStoragePlan, getStorageVerdict } =
    await import("../src/lib/aiaic-trade.functions");
  const { getPlacesCrops, getPlacesDistricts } = await import("../src/lib/places.functions");
  const { problem } = await import("../src/lib/aiaic-trade");
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
    StorageRoute,
    kit,
    flowKit,
    CrisisFirst,
    useRaiseCrisis,
    useScanBeforeRefusing,
    scanFirst,
    getTripTalukas,
    getStoragePlan,
    getStorageVerdict,
    getPlacesCrops,
    getPlacesDistricts,
    problem,
    shared,
  };
}
type App = Awaited<ReturnType<typeof loadApp>>;

// ------------------------------------------------------------------------------------------------ the suite

function suite(app: App, window: Window & typeof globalThis) {
  const { React, DICTS, shared, kit, flowKit } = app;
  const { act, createElement: h } = React;
  const { CRISIS_MR, CRISIS_EN, CRISIS_HI, TEST_BANK } = shared;
  PHRASES.push(CRISIS_HI, CRISIS_EN, CRISIS_MR);
  const document = window.document;
  const words = (lang: Lang, key: string) => DICTS[lang][key] ?? DICTS.en[key] ?? key;

  // --------------------------------------------- AIAIC's recorded answers to what the page sent, in this process
  const CROPS_NASHIK_MR = recorded("places_crops_nashik_mh_mr")["answer"] as {
    crops: unknown[];
    first_page: string[];
  };
  const MANIFEST = recorded("recording_manifest.sample") as {
    files: Record<string, { request: Record<string, unknown>; route: string }>;
  };
  /** Each read no recording answered, as `read: what was sent`. */
  const missing: string[] = [];
  const lower = (v: unknown) =>
    String(v ?? "")
      .trim()
      .toLowerCase();
  const answers = {
    getPlacesDistricts: (sent: Record<string, unknown>) => {
      const r = shared.recordedTrip("districts", sent, {});
      if (r) return r;
      missing.push(`districts: ${JSON.stringify(sent)}`);
      return { ok: false, districts: [], error: "AIAIC did not answer" };
    },
    getPlacesCrops: (sent: Record<string, unknown>) => {
      if (
        lower(sent["district"]) === "nashik" &&
        lower(sent["state"]) === "mh" &&
        sent["lang"] === "mr"
      )
        return { ok: true, crops: CROPS_NASHIK_MR.crops, firstPage: CROPS_NASHIK_MR.first_page };
      missing.push(`crops: ${JSON.stringify(sent)}`);
      return { ok: false, crops: [], firstPage: [], error: "AIAIC did not answer" };
    },
    getTripTalukas: (sent: Record<string, unknown>) => {
      missing.push(`talukas: ${JSON.stringify(sent)}`);
      return { ok: false, problem: app.problem("aiaic_unavailable") };
    },
    getStoragePlan: (sent: Record<string, unknown>) => {
      const plain = !("quantity_q" in sent) && !("taluka" in sent) && !("loan_due_in_days" in sent);
      const name = Object.keys(MANIFEST.files).find((n) => {
        const q = MANIFEST.files[n]?.request ?? {};
        return (
          plain &&
          n.startsWith("storage_plan_") &&
          Object.keys(q).length === 4 &&
          lower(q["crop"]) === lower(sent["crop"]) &&
          lower(q["district"]) === lower(sent["district"]) &&
          lower(q["state"]) === lower(sent["state"]) &&
          q["lang"] === sent["lang"]
        );
      });
      if (name) return { ok: true, data: recorded(name.replace(/\.json$/, "")) };
      missing.push(`plan: ${JSON.stringify(sent)}`);
      return { ok: false, problem: app.problem("aiaic_unavailable") };
    },
  } as const;
  /** Each read the page asked, in order, with what it sent. */
  const asked: { read: string; sent: Record<string, unknown> }[] = [];

  const handlers = new Map<unknown, string>();
  const named = {
    scanFirst: app.scanFirst,
    getPlacesDistricts: app.getPlacesDistricts,
    getPlacesCrops: app.getPlacesCrops,
    getTripTalukas: app.getTripTalukas,
    getStoragePlan: app.getStoragePlan,
    getStorageVerdict: app.getStorageVerdict,
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
          // the read's own validator first, as Start's RPC runs it on this server
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
  /** Her finger on an element: it takes the focus, so the box she leaves gets blur and focusout. */
  const land = async (el: Element) => {
    if (document.activeElement === el) return;
    await act(async () => {
      (el as HTMLElement).focus();
    });
  };
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
    ?.set as (this: HTMLInputElement, v: string) => void;
  /** She types, one character at a time, as a keyboard does (her finger in the box first). */
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
  /** Her tap: the focus moves to what she taps (Chrome on Android moves it to a button), then the click. */
  const tap = async (el: Element | null | undefined, what: string) => {
    ok(el, `there is ${what} to tap`);
    await land(el);
    await act(async () => {
      (el as HTMLElement).click();
    });
    await settle();
  };
  /** The keypad's Enter (its Next or Done key) in a box. */
  const enter = async (box: HTMLInputElement) => {
    await land(box);
    await act(async () => {
      box.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    await settle();
  };
  const wait = async (ms: number) => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
  };

  // ------------------------------------------------------------------------------------------- her page
  type Page = Awaited<ReturnType<typeof mountStorage>>;
  /** The storage page at an address, as she opens it: a phone of her own (its storage as given), her language. */
  const mountStorage = async (
    address: string,
    lang: Lang,
    farm: Record<string, string> | null = null,
  ) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("aiaic.lang", lang);
    if (farm) window.localStorage.setItem("aiaic.farm", JSON.stringify(farm));
    const qc = new app.QueryClient({ defaultOptions: { queries: { retry: false } } });
    const R = app.router;
    const root = R.createRootRoute({
      component: () =>
        h(app.QueryClientProvider, {
          client: qc,
          children: h(app.I18nProvider, { initialLang: lang, children: h(R.Outlet) }),
        }),
    });
    const page = app.StorageRoute.update({
      id: "/storage",
      path: "/storage",
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
      step: (n: number) => q(`[data-testid="store-step-${n}"]`),
      stateOf: (n: number) => q(`[data-testid="store-step-${n}"]`)?.getAttribute("data-state"),
      heading: (n: number) => q(`[data-testid="store-step-${n}"] h2`),
      search: () => router.state.location.search as Record<string, unknown>,
      said: () => container.textContent ?? "",
      unmount: async () => {
        await act(async () => reactRoot.unmount());
        container.remove();
        qc.clear();
      },
    };
  };
  const buttonNamed = (scope: Element | null, label: string) =>
    [...(scope?.querySelectorAll("button") ?? [])].find(
      (b) => (b.textContent ?? "").trim() === label,
    );
  const openSettledAt = async (p: Page, n: number) => {
    for (let i = 0; i < 40 && p.stateOf(n) !== "open"; i++) await settle(50);
    assert.equal(p.stateOf(n), "open", `step ${n} opens`);
  };
  /** The storage page in Marathi on a link to Nashik, Maharashtra: its crop step open (AIAIC's recorded Nashik crops). */
  const atNashikCrops = async (farm: Record<string, string> | null = null) => {
    const p = await mountStorage("/storage?state=mh&region=nashik", "mr", farm);
    await openSettledAt(p, 2);
    return p;
  };
  const cropButton = (p: Page, name: string) =>
    [...(p.q('[data-testid="store-crops"]')?.querySelectorAll("button") ?? [])].find((b) =>
      (b.textContent ?? "").includes(name),
    );
  /** Onion tapped on the crop step: step 3 opens. */
  const toQuantity = async (p: Page) => {
    await tap(cropButton(p, "कांदा"), "onion");
    await openSettledAt(p, 3);
  };
  const otherBox = (p: Page) => p.q('[data-testid="store-qty-typed"]') as HTMLInputElement | null;
  const openOther = async (p: Page) => {
    await tap(p.q('[data-testid="store-qty-other"]'), "Other");
    const box = otherBox(p);
    ok(box, "Other opens its box");
    return box;
  };
  const crisisCard = (p: Page) => p.q("[data-crisis]");
  const helplinesOn = (p: Page) =>
    HELPLINES.every((phone) =>
      [...(p.q("[data-crisis]")?.querySelectorAll("a[href^='tel:']") ?? [])].some((a) =>
        (a.textContent ?? "").includes(phone),
      ),
    );

  // ------------------------------------------------------------------- the kit's own flow, drawn from its parts
  type KitProps = {
    fixed: boolean;
    held: string | null;
    onSend: () => void;
    answer: string | null;
    personal: boolean;
  };
  /** Her details fit only the kind they were given for (a bank's number and IFSC are no UPI ID): a kind changed under
   *  them marks them "check again", through the kit's own `fits` (C.6). */
  const KIT_STEPS = [
    { id: "kind" },
    {
      id: "details",
      fits: (a: Readonly<Record<string, unknown>>) => {
        const d = (a["details"] ?? {}) as Record<string, string>;
        return a["kind"] === "upi" ? Boolean(d["upi"]) : Boolean(d["account"]);
      },
    },
    { id: "name" },
    { id: "check" },
  ];
  /** A flow as her payout details will be (DESIGN_UPDATE C.13 row 2): UPI or bank (a choice), the boxes of one fact,
   *  her name, then the check before money. Drawn here from the kit's parts only, with the page's real scan. */
  function KitFlow(props: KitProps) {
    const { lang } = app.useI18n();
    const scan = app.useScanBeforeRefusing();
    const raise = app.useRaiseCrisis();
    React.useEffect(() => {
      if (scan.inCrisis) raise?.(app.problem("crisis", { crisis: scan.crisis }));
    }, [scan.inCrisis, scan.crisis, raise]);
    const read = (w: string) => flowKit.readForCrisis(scan, w, lang);
    const flow = flowKit.useStepFlow("kit", KIT_STEPS, {
      fixedCount: props.fixed,
      title: "Kit",
    });
    const a = flow.answers as Record<string, Record<string, string> | string | undefined>;
    const details = (a["details"] ?? {}) as Record<string, string>;
    const name = (a["name"] ?? {}) as Record<string, string>;
    const step = (id: string, title: string, summary: string | null, body: unknown) => {
      const s = flow.stepProps(id);
      return h(
        kit.Step,
        {
          key: id,
          n: s.n,
          total: s.total,
          state: s.state,
          again: s.again,
          flowTitle: s.flowTitle,
          headingRef: s.headingRef,
          onChange: s.onChange,
          title,
          summary,
          testid: `kit-step-${id}`,
        },
        body as never,
      );
    };
    const bankBoxes = [
      {
        name: "account",
        label: "Account number",
        value: details["account"] ?? "",
        given: Boolean(details["account"]),
        inputMode: "numeric" as const,
        check: (v: string) => (/^\d{9,18}$/.test(v.trim()) ? null : "aiaic.store.qty.range"),
      },
      {
        name: "ifsc",
        label: "IFSC",
        value: details["ifsc"] ?? "",
        given: Boolean(details["ifsc"]),
        inputMode: "text" as const,
        check: (v: string) =>
          /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.trim()) ? null : "aiaic.store.qty.range",
      },
    ];
    return h(
      kit.Flow,
      { flow, label: "Kit steps", testid: "kit", listTestid: "kit-steps" },
      step(
        "kind",
        "UPI or bank",
        typeof a["kind"] === "string" ? a["kind"] : null,
        h(kit.ChoiceStep, {
          label: "UPI or bank",
          choices: [
            { value: "upi", label: "UPI", testid: "kit-kind-upi" },
            { value: "bank", label: "Bank", testid: "kit-kind-bank" },
          ],
          pressed: (v: string) => a["kind"] === v,
          onChoose: (v: string) => void flow.choose("kind", v),
          testid: "kit-kind",
        }),
      ),
      step(
        "details",
        "Where it goes",
        details["account"] ? "••••" : details["upi"] ? "••••" : null,
        h(kit.BoxStep, {
          testid: "kit-details",
          read,
          boxes:
            a["kind"] === "upi"
              ? [
                  {
                    name: "upi",
                    label: "UPI ID",
                    value: details["upi"] ?? "",
                    given: Boolean(details["upi"]),
                    inputMode: "email" as const,
                    check: (v: string) => (v.includes("@") ? null : "aiaic.store.qty.range"),
                  },
                ]
              : bankBoxes,
          boxRef: flow.stepProps("details").boxRef,
          onDone: (v: Record<string, string>) => void flow.choose("details", { ...v }),
        }),
      ),
      step(
        "name",
        "Name and phone",
        name["name"] ? "••••" : null,
        h(kit.BoxStep, {
          testid: "kit-name",
          read,
          boxes: [
            {
              name: "name",
              label: "Name",
              value: name["name"] ?? "",
              given: Boolean(name["name"]),
              inputMode: "text" as const,
              autoComplete: "name",
            },
            {
              name: "phone",
              label: "Phone",
              value: name["phone"] ?? "",
              given: Boolean(name["phone"]),
              type: "tel" as const,
              inputMode: "tel" as const,
              autoComplete: "tel",
            },
          ],
          boxRef: flow.stepProps("name").boxRef,
          onDone: (v: Record<string, string>) => void flow.choose("name", { ...v }),
        }),
      ),
      step(
        "check",
        "Check and send",
        null,
        h(kit.CheckStep, {
          testid: "kit-check",
          parts: [
            {
              key: "details",
              label: "Where it goes",
              value: "••••",
              onChange: () => void flow.change("details"),
            },
            {
              key: "name",
              label: "Name and phone",
              value: "••••",
              onChange: () => void flow.change("name"),
            },
          ],
          action: "Send ₹4,350 to UPI ••••",
          onPress: props.onSend,
          held: props.held,
          answer: props.answer,
        }),
      ),
    );
  }
  type KitPage = Awaited<ReturnType<typeof mountKit>>;
  /** The kit's flow on a page of its own (`/kit`, its step in the address), inside the app's crisis gate. */
  const mountKit = async (lang: Lang, over: Partial<KitProps> = {}, address = "/kit") => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("aiaic.lang", lang);
    const qc = new app.QueryClient({ defaultOptions: { queries: { retry: false } } });
    const R = app.router;
    const presses: number[] = [];
    let props: KitProps = {
      fixed: true,
      held: null,
      onSend: () => presses.push(Date.now()),
      answer: null,
      personal: true,
      ...over,
    };
    const listeners = new Set<() => void>();
    function Holder() {
      const [, force] = React.useState(0);
      React.useEffect(() => {
        const f = () => force((x) => x + 1);
        listeners.add(f);
        return () => {
          listeners.delete(f);
        };
      }, []);
      return h(app.CrisisFirst, { children: h(KitFlow, props) });
    }
    const root = R.createRootRoute({
      component: () =>
        h(app.QueryClientProvider, {
          client: qc,
          children: h(app.I18nProvider, { initialLang: lang, children: h(R.Outlet) }),
        }),
    });
    const kitRoute = R.createRoute({
      getParentRoute: () => root,
      path: "/kit",
      validateSearch: (s: Record<string, unknown>) =>
        typeof s["step"] === "string" ? { step: s["step"] } : {},
      component: Holder,
    });
    const entries = [address];
    const router = R.createRouter({
      routeTree: root.addChildren([kitRoute]),
      history: R.createMemoryHistory({ initialEntries: entries }),
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const reactRoot = app.createRoot(container);
    await act(async () => {
      await router.load();
      reactRoot.render(h(R.RouterProvider, { router: router as never }));
    });
    await settle(200);
    const q = (sel: string) => container.querySelector(sel);
    return {
      container,
      router,
      qc,
      entries,
      presses,
      q,
      stateOf: (id: string) => q(`[data-testid="kit-step-${id}"]`)?.getAttribute("data-state"),
      heading: (id: string) => q(`[data-testid="kit-step-${id}"] h2`),
      box: (step: string, name: string) =>
        q(`[data-testid="kit-${step}-${name}"]`) as HTMLInputElement | null,
      rerender: async (next: Partial<KitProps>) => {
        props = { ...props, ...next };
        await act(async () => {
          for (const f of listeners) f();
        });
        await settle();
      },
      unmount: async () => {
        await act(async () => reactRoot.unmount());
        container.remove();
        qc.clear();
      },
    };
  };
  /** Bank chosen, then the bank's two boxes given (Cashfree's public test account: a stand-in, never a person's). */
  const kitToName = async (k: KitPage) => {
    await tap(k.q('[data-testid="kit-kind-bank"]'), "Bank");
    const account = k.box("details", "account");
    ok(account, "the account box");
    await type(account, TEST_BANK.account);
    await enter(account);
    const ifsc = k.box("details", "ifsc");
    ok(ifsc, "the IFSC box");
    await type(ifsc, TEST_BANK.ifsc);
    await enter(ifsc);
    assert.equal(k.stateOf("name"), "open", "the name step opens");
  };

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
  /** Latin words a Marathi or Hindi screen may carry: the app's own name, and AIAIC's. */
  const LATIN_ALLOWED = new Set(["AIAIC"]);
  const englishIn = (texts: string[]) =>
    texts.flatMap((s) => (s.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !LATIN_ALLOWED.has(w)));

  // ======================================================================================== KA1
  test("KA1 K1 on the storage flow: opening it moves no focus; a choice opens the next step and takes the focus to it; typing to any length moves nothing; leaving a box checks nothing", async () => {
    await inStart(async () => {
      // a fresh phone: the page opens on step 1, and nothing takes the focus
      const fresh = await mountStorage("/storage", "en");
      try {
        await openSettledAt(fresh, 1);
        ok(fresh.q('[data-testid="store-districts"] button'), "AIAIC's recorded districts");
        sameEl(document.activeElement, document.body, "opening the page moves no focus");
        // a district tapped: the step stays open for its taluka, the focus on the chosen line (F39), never further
        await tap(buttonNamed(fresh.q('[data-testid="store-districts"]'), "Nashik"), "Nashik");
        assert.equal(fresh.stateOf(1), "open", "the district tapped, step 1 stays open");
        sameEl(
          document.activeElement,
          fresh.q('[data-testid="store-place-chosen"]'),
          "the focus on the chosen line",
        );
        // Next: step 2 opens, and the focus goes to its heading (its first control is a list's button)
        await tap(fresh.q('[data-testid="store-place-next"]'), "Next");
        await openSettledAt(fresh, 2);
        sameEl(document.activeElement, fresh.heading(2), "Next takes the focus to step 2");
        ok(
          fresh.q('[data-testid="store-crops-failed"]'),
          "Nashik's crops in English: no recording, said as AIAIC not answering",
        );
      } finally {
        await fresh.unmount();
      }
      // a returning farmer lands on the answer: nothing takes the focus either
      const back = await mountStorage("/storage", "mr", {
        state: "mh",
        region: "nashik",
        crop: "onion",
        storeQuantity: "example",
      });
      try {
        await openSettledAt(back, 4);
        sameEl(document.activeElement, document.body, "landing on the answer moves no focus");
      } finally {
        await back.unmount();
      }
      // a crop tapped (Marathi, AIAIC's recorded Nashik): step 3 opens with the focus on its heading
      const p = await atNashikCrops();
      try {
        sameEl(document.activeElement, document.body, "the link opens step 2: no focus");
        await toQuantity(p);
        sameEl(document.activeElement, p.heading(3), "the crop tapped: the focus on step 3");
        // Other: the cursor goes into its box (the phone's keypad opens)
        const box = await openOther(p);
        sameEl(document.activeElement, box, "Other puts the cursor in its box");
        // she types a long number one key at a time: nothing moves, nothing is checked
        await type(box, "12345678901234567890");
        sameEl(document.activeElement, box, "typing moves no focus, whatever its length");
        assert.equal(p.stateOf(3), "open", "and opens no step");
        noEl(p.q('[data-testid="store-qty-range"]'), "and says no error");
        // a number out of range, then she leaves the box: still nothing checked
        await clear(box);
        await type(box, "0");
        await land(p.heading(3) as Element);
        await settle();
        noEl(p.q('[data-testid="store-qty-range"]'), "leaving the box checks nothing");
        assert.equal(box.getAttribute("aria-invalid"), null, "no box marked in error");
        assert.equal(box.value, "0", "what was typed stays");
        assert.equal(p.stateOf(3), "open", "the step stays");
      } finally {
        await p.unmount();
      }
    });
  });

  // ======================================================================================== KA2
  test("KA2 K2: Enter in a box that is not its step's last goes to the next box and checks nothing; Continue or Enter in the last box checks the step: the next step focused, or the error beside the first box in error, described, marked, focused, every box's text kept", async () => {
    await inStart(async () => {
      // the kit's fact of two boxes (a bank account's number and IFSC)
      const k = await mountKit("en");
      try {
        await tap(k.q('[data-testid="kit-kind-bank"]'), "Bank");
        const account = k.box("details", "account");
        const ifsc = k.box("details", "ifsc");
        ok(account && ifsc, "the two boxes of one fact");
        sameEl(document.activeElement, account, "the choice put the cursor in the first box");
        await type(account, "12345");
        await enter(account);
        sameEl(document.activeElement, ifsc, "Enter in the first box: the next box");
        noEl(k.q('[data-testid="kit-details-account-error"]'), "nothing checked");
        assert.equal(k.stateOf("details"), "open", "the step stays");
        // Continue with the account too short and no IFSC: the first box in error
        await tap(k.q('[data-testid="kit-details-continue"]'), "Continue");
        const err = k.q('[data-testid="kit-details-account-error"]');
        ok(err, "the error beside the account box");
        ok(err.id, "the error has an id");
        ok(
          (account.getAttribute("aria-describedby") ?? "").split(" ").includes(err.id),
          "the box's aria-describedby names the error",
        );
        assert.equal(account.getAttribute("aria-invalid"), "true", "the box is marked in error");
        sameEl(document.activeElement, account, "the focus on the first box in error");
        assert.equal(account.value, "12345", "what was typed stays");
        ok(k.q('[data-testid="kit-details-ifsc-error"]'), "the IFSC's error too");
        ok(
          (err.compareDocumentPosition(account) & 4) !== 0,
          "the error sits before its box (between the question and the box)",
        );
        // corrected: Enter in the last box checks the step, and the next step takes the focus
        await clear(account);
        await type(account, TEST_BANK.account);
        await enter(account);
        sameEl(document.activeElement, ifsc, "Enter: the next box");
        await type(ifsc, TEST_BANK.ifsc);
        await enter(ifsc);
        assert.equal(k.stateOf("name"), "open", "Enter in the last box: the step passes");
        sameEl(
          document.activeElement,
          k.box("name", "name"),
          "the next step's first box takes the focus",
        );
      } finally {
        await k.unmount();
      }
      // the storage flow's own box: Continue with nothing that fits
      const p = await atNashikCrops();
      try {
        await toQuantity(p);
        const box = await openOther(p);
        await type(box, "0");
        await tap(p.q('[data-testid="store-qty-use"]'), "Use this quantity");
        const err = p.q('[data-testid="store-qty-range"]');
        ok(err, "the error beside the box");
        ok(
          (box.getAttribute("aria-describedby") ?? "").split(" ").includes(err.id),
          "named by the box's aria-describedby",
        );
        assert.equal(box.getAttribute("aria-invalid"), "true", "the box marked");
        sameEl(document.activeElement, box, "the focus back in the box");
        assert.equal(box.value, "0", "what was typed stays");
        ok(
          (err.textContent ?? "").includes(words("mr", "aiaic.store.qty.range")),
          "in her language",
        );
        // corrected, Enter (the keypad's Done): the answer opens, with the focus on its heading
        await clear(box);
        await type(box, "37");
        await enter(box);
        await openSettledAt(p, 4);
        sameEl(document.activeElement, p.heading(4), "the next step takes the focus");
      } finally {
        await p.unmount();
      }
    });
  });

  // ======================================================================================== KA3
  test("KA3 K3: three answers, Change on the first, then on: the later ones are kept; a change that no longer fits marks the later step check again and opens it; the address holds the step's name and never a quantity or typed words; the back button goes back one step", async () => {
    await inStart(async () => {
      // the storage flow: place (a link), crop, quantity; then Change on the place
      const p = await mountStorage("/storage?state=mh&region=nashik", "mr");
      try {
        await openSettledAt(p, 2);
        await toQuantity(p);
        await tap(p.q('[data-testid="store-qty-25"]'), "25 quintals");
        await openSettledAt(p, 4);
        assert.equal(p.search()["step"], "answer", "the address names the open step");
        ok(!("q" in p.search()) && !JSON.stringify(p.search()).includes("25"), "no quantity in it");
        // Change on the crop, the same crop again: the quantity is kept, the answer opens again
        await tap(p.q('[data-testid="store-step-2-change"]'), "Change on the crop");
        await openSettledAt(p, 2);
        await tap(cropButton(p, "कांदा"), "onion again");
        await openSettledAt(p, 4);
        assert.equal(p.stateOf(3), "done", "the quantity is kept");
        ok(
          (p.q('[data-testid="store-step-3-summary"]')?.textContent ?? "").includes("25"),
          "with its answer",
        );
        // Change on the place: another state clears the place, and the crop it held is "check again", said
        await tap(p.q('[data-testid="store-step-1-change"]'), "Change on the place");
        await openSettledAt(p, 1);
        await tap(p.q('[data-testid="store-state-mp"]'), "Madhya Pradesh");
        ok(p.q('[data-testid="store-districts"] button'), "Madhya Pradesh's recorded districts");
        assert.equal(p.stateOf(2), "again", "the crop's step says check again");
        ok(
          (p.step(2)?.textContent ?? "").includes(words("mr", "aiaic.kit.state.again")),
          "in words",
        );
        assert.equal(p.stateOf(3), "done", "the quantity still fits: kept");
        await tap(buttonNamed(p.q('[data-testid="store-districts"]'), "इंदूर"), "Indore");
        await tap(p.q('[data-testid="store-place-next"]'), "Next");
        await openSettledAt(p, 2);
        ok(p.q('[data-testid="store-step-2-again"]'), "it opens again in order, saying why");
        sameEl(document.activeElement, p.heading(2), "with the focus");
        // the back button goes back one step: the place again, with its answer
        await act(async () => p.router.history.back());
        await settle(300);
        assert.equal(p.stateOf(1), "open", "back: one step back");
        assert.equal(p.search()["step"], "where", "the address says so");
        // what the address ever held: step names and the farm's own choices, never a quantity or a typed text
        for (const href of p.entries) {
          const u = new URL(href, "http://x");
          for (const k of u.searchParams.keys())
            ok(["state", "region", "taluka", "crop", "step"].includes(k), `${href}: ${k}`);
          ok(!u.searchParams.has("q") && !/quantity=|quintal/.test(href), `${href}: no quantity`);
        }
      } finally {
        await p.unmount();
      }
      // the kit's own rule, with a step's `fits`: three answers, Change on the first, kept; a kind her details no longer fit
      // marks them "check again", and they open again in order, the name kept
      const k = await mountKit("en");
      try {
        await kitToName(k);
        const nameBox = k.box("name", "name");
        ok(nameBox, "the name box");
        await type(nameBox, "Recording Farmer");
        await type(k.box("name", "phone") as HTMLInputElement, "9000000001");
        await tap(k.q('[data-testid="kit-name-continue"]'), "Continue");
        assert.equal(k.stateOf("check"), "open", "the check step");
        await tap(k.q('[data-testid="kit-step-kind-change"]'), "Change on the first");
        assert.equal(k.stateOf("kind"), "open", "the first step opens with its answer");
        assert.equal(
          k.q('[data-testid="kit-kind-bank"]')?.getAttribute("aria-pressed"),
          "true",
          "its answer pressed",
        );
        await tap(k.q('[data-testid="kit-kind-bank"]'), "Bank again");
        assert.equal(k.stateOf("details"), "done", "the second answer kept");
        assert.equal(k.stateOf("name"), "done", "the third kept");
        assert.equal(k.stateOf("check"), "open", "and on to the check");
        // UPI instead: the bank's details no longer fit, so their step says check again and opens; the name still fits
        await tap(k.q('[data-testid="kit-step-kind-change"]'), "Change on the first, again");
        await tap(k.q('[data-testid="kit-kind-upi"]'), "UPI");
        assert.equal(k.stateOf("details"), "open", "the details that no longer fit open again");
        ok(k.q('[data-testid="kit-step-details-again"]'), "saying check again");
        assert.equal(k.stateOf("name"), "done", "the name still fits: kept");
        const upi = k.box("details", "upi");
        ok(upi, "the UPI box");
        sameEl(document.activeElement, upi, "the cursor in its box");
        await type(upi, "farmer9000@okicici");
        await enter(upi);
        assert.equal(k.stateOf("check"), "open", "then on to the check, in order");
        assert.equal(k.stateOf("name"), "done", "the name never asked again");
        // the address held the step's name and nothing else: never her phone, her UPI ID or her bank's details (C.6)
        const hers = [TEST_BANK.account, TEST_BANK.ifsc, "Recording", "9000000001", "farmer9000"];
        ok(
          k.entries.length > 3,
          `the flow's moves are in the history: ${k.entries.length} entries`,
        );
        for (const href of k.entries) {
          const u = new URL(href, "http://x");
          for (const key of u.searchParams.keys())
            ok(key === "step", `${href}: only the step's name`);
          const text = decodeURIComponent(href);
          for (const v of hers) ok(!text.includes(v), `${href}: none of her details`);
        }
      } finally {
        await k.unmount();
      }
    });
  });

  // ======================================================================================== KA4
  test("KA4 K4: a fixed flow shows 2 of 4, the hidden Step 2 of 4 and the page title; a branching flow shows no total; aria-current on one step only; each state in words", async () => {
    await inStart(async () => {
      const p = await atNashikCrops();
      try {
        assert.equal(
          p.q('[data-testid="store-step-2-count"]')?.textContent,
          words("mr", "aiaic.kit.n_of").replace("{n}", "2").replace("{total}", "4"),
          "2 of 4 in view",
        );
        ok(
          (p.heading(2)?.textContent ?? "").includes(
            words("mr", "aiaic.kit.step_of").replace("{n}", "2").replace("{total}", "4"),
          ),
          "the hidden Step 2 of 4 in its heading",
        );
        const title = words("mr", "aiaic.kit.title.fixed")
          .replace("{question}", words("mr", "aiaic.store.step.crop"))
          .replace("{n}", "2")
          .replace("{total}", "4")
          .replace("{flow}", words("mr", "aiaic.store.title"))
          .replace("{app}", words("mr", "app.name"));
        assert.equal(document.title, title, "the page title names the open step");
        assert.equal(p.container.querySelectorAll('[aria-current="step"]').length, 1, "one now");
        // each state in words: done, now, not yet
        const said = (n: number) =>
          p.q(`[data-testid="store-step-${n}-state-words"]`)?.textContent ?? "";
        ok(said(1).includes(words("mr", "aiaic.kit.state.done")), "done, in words");
        ok(said(2).includes(words("mr", "aiaic.kit.state.open")), "now, in words");
        ok(said(3).includes(words("mr", "aiaic.kit.state.todo")), "not yet, in words");
        for (const n of [1, 2, 3, 4])
          ok(
            p.q(`[data-testid="store-step-${n}"] span[aria-hidden]`),
            `step ${n}: its mark, an icon or its number, beside its words`,
          );
      } finally {
        await p.unmount();
      }
      // a branching flow: no total anywhere
      const k = await mountKit("en", { fixed: false });
      try {
        noEl(k.q('[data-testid="kit-step-kind-count"]'), "no 1 of 4");
        ok(!/\bStep 1 of\b/.test(k.heading("kind")?.textContent ?? ""), "no hidden total");
        ok(!/of 4/.test(document.title), `no total in the title: ${document.title}`);
        ok(
          (k.heading("kind")?.textContent ?? "").includes(words("en", "aiaic.kit.state.open")),
          "its state in words still",
        );
      } finally {
        await k.unmount();
      }
    });
  });

  // ======================================================================================== KA5
  test("KA5 K5: a money flow ends in a check step with Change on each part and one button that names the action and the amount; after the press the answer is said in role=status, the focus stays on the card, and no other card opens", async () => {
    await inStart(async () => {
      const k = await mountKit("en");
      try {
        await kitToName(k);
        await type(k.box("name", "name") as HTMLInputElement, "Recording Farmer");
        await tap(k.q('[data-testid="kit-name-continue"]'), "Continue");
        assert.equal(k.stateOf("check"), "open", "the check step");
        const check = k.q('[data-testid="kit-check"]');
        for (const part of ["details", "name"])
          ok(check?.querySelector(`[data-testid="kit-check-change-${part}"]`), `Change: ${part}`);
        const press = k.q('[data-testid="kit-check-press"]');
        assert.equal(press?.textContent, "Send ₹4,350 to UPI ••••", "the action and the amount");
        ok(press?.textContent !== words("en", "aiaic.kit.continue"), "never a Continue");
        await tap(press, "Send");
        assert.equal(k.presses.length, 1, "one press");
        await k.rerender({ answer: "Sent: AIAIC sends it after the pickup" });
        sameEl(document.activeElement, press, "the focus stays on the pressed button");
        const status = k.q('[data-testid="kit-check-answer"]');
        assert.equal(status?.getAttribute("role"), "status", "the answer in role=status");
        ok((status?.textContent ?? "").includes("Sent"), "with the answer");
        assert.equal(k.stateOf("check"), "open", "no other card opens");
        assert.equal(k.container.querySelectorAll('[aria-current="step"]').length, 1, "one open");
        // Change on a part opens that step with its answer
        await tap(k.q('[data-testid="kit-check-change-name"]'), "Change: name");
        assert.equal(k.stateOf("name"), "open", "Change opens its step");
        assert.equal(k.box("name", "name")?.value, "Recording Farmer", "with its answer");
      } finally {
        await k.unmount();
      }
    });
  });

  // ======================================================================================== KA6
  test("KA6 K6: a crisis typed in the storage box gets the helplines first, on its Continue, on Skip and on a chip, and the flow does not move", async () => {
    await inStart(async () => {
      for (const press of ["continue", "enter", "skip", "chip"] as const) {
        const p = await atNashikCrops();
        try {
          await toQuantity(p);
          const box = await openOther(p);
          const before = { search: JSON.stringify(p.search()), plans: asked.length };
          seen.scans.length = 0;
          await type(box, CRISIS_MR);
          if (press === "continue") await tap(p.q('[data-testid="store-qty-use"]'), "Use");
          if (press === "enter") await enter(box);
          if (press === "skip") await tap(p.q('[data-testid="store-qty-skip"]'), "Skip");
          if (press === "chip") await tap(p.q('[data-testid="store-qty-10"]'), "10 quintals");
          ok(
            seen.scans.some((s) => s.includes(CRISIS_MR)),
            `${press}: her words reach the scan at the press, before the pause`,
          );
          ok(crisisCard(p), `${press}: AIAIC's crisis card`);
          ok(helplinesOn(p), `${press}: with its helplines`);
          noEl(p.q('[data-testid="store-steps"]'), `${press}: the card alone`);
          const plans = asked.slice(before.plans).filter((a) => a.read === "getStoragePlan");
          assert.deepEqual(plans, [], `${press}: no answer is asked`);
          assert.equal(JSON.stringify(p.search()), before.search, `${press}: the address stays`);
          ok(
            !(window.localStorage.getItem("aiaic.farm") ?? "").includes(CRISIS_MR),
            `${press}: her words are not kept`,
          );
        } finally {
          await p.unmount();
        }
      }
    });
  });

  // ======================================================================================== KA7
  test("KA7 K7: every kit word in en, mr and hi with the same blanks; on a Marathi and a Hindi screen no English word, hidden text included; the scanner finds English on an English screen", async () => {
    const keys = Object.keys(DICTS.en).filter((k) => k.startsWith("aiaic.kit."));
    ok(keys.length >= 22, `the kit's words: ${keys.length}`);
    const blanks = (s: string) => (s.match(/\{[a-z_]+\}/g) ?? []).sort().join(",");
    for (const lang of ["mr", "hi"] as const)
      for (const key of keys) {
        const line = DICTS[lang][key];
        ok(line, `${lang} has ${key}`);
        assert.equal(blanks(line), blanks(DICTS.en[key] ?? ""), `${lang} ${key}: its blanks`);
        assert.deepEqual(englishIn([line.replace(/\{[a-z_]+\}/g, "")]), [], `${lang} ${key}`);
      }
    await inStart(async () => {
      for (const lang of ["mr", "hi", "en"] as const) {
        // every state of the flow on one screen: done, now, not yet, the box's error, the restarted line
        const p = await mountStorage("/storage?state=mh&region=nashik&step=quantity", lang);
        try {
          for (let i = 0; i < 40 && p.stateOf(2) !== "open" && p.stateOf(3) !== "open"; i++)
            await settle(50);
          ok(p.q('[data-testid="store-flow-restarted"]'), `${lang}: the restarted line`);
          const crops = p.q('[data-testid="store-crops"] button');
          if (crops) {
            await tap(crops, "a crop");
            await openSettledAt(p, 3);
            const box = await openOther(p);
            await type(box, "0");
            await tap(p.q('[data-testid="store-qty-use"]'), "Use");
            ok(p.q('[data-testid="store-qty-range"]'), `${lang}: the error, with its hidden word`);
          }
          const texts = everyText(p.container);
          ok(
            texts.some((s) => s.includes(words(lang, "aiaic.kit.state.done"))),
            `${lang}: the hidden state words are read`,
          );
          const english = englishIn(texts);
          if (lang === "en")
            ok(english.length > 10, "the scanner finds English on an English page");
          else assert.deepEqual(english, [], `${lang}: no English word on the screen`);
        } finally {
          await p.unmount();
        }
      }
    });
  });

  // ======================================================================================== KA8
  test("KA8 K8: a money button AIAIC holds shut is aria-disabled, reachable by Tab, its reason read with it; a press says why again and sends nothing", async () => {
    await inStart(async () => {
      const k = await mountKit("en", { held: "AIAIC holds this until the pickup is recorded." });
      try {
        await kitToName(k);
        await type(k.box("name", "name") as HTMLInputElement, "Recording Farmer");
        await tap(k.q('[data-testid="kit-name-continue"]'), "Continue");
        const press = k.q('[data-testid="kit-check-press"]') as HTMLButtonElement | null;
        ok(press, "the money button stays on the card");
        assert.equal(press.getAttribute("aria-disabled"), "true", "aria-disabled");
        assert.equal(press.hasAttribute("disabled"), false, "never the disabled attribute");
        ok(press.tabIndex >= 0, "reachable by Tab");
        const reason = k.q('[data-testid="kit-check-held"]');
        ok(reason?.id, "the reason has an id");
        ok(
          (press.getAttribute("aria-describedby") ?? "").split(" ").includes(reason.id),
          "and is read with the button",
        );
        await land(press);
        sameEl(document.activeElement, press, "it takes the focus");
        await tap(press, "the held button");
        assert.equal(k.presses.length, 0, "a press sends nothing");
        assert.equal(reason.getAttribute("role"), "alert", "and says why again");
      } finally {
        await k.unmount();
      }
    });
  });

  // ======================================================================================== KA9
  test("KA9 the step in the search parameters: each move adds one entry, the back button returns one step with its answer, a reload without the earlier answers opens the first missing step and says so; nothing but the flow's own step names opens a step", async () => {
    await inStart(async () => {
      const p = await atNashikCrops();
      try {
        assert.equal(p.search()["step"], undefined, "opening the page writes no step");
        const length = p.entries.length;
        await toQuantity(p);
        assert.equal(p.search()["step"], "quantity", "the step's name in the address");
        assert.equal(p.entries.length, length + 1, "one new entry for one move");
        ok(p.entries[length - 1]?.includes("step=crop"), "the entry left names its own step");
        await act(async () => p.router.history.back());
        await settle(300);
        assert.equal(p.stateOf(2), "open", "the back button: one step back");
        sameEl(document.activeElement, p.heading(2), "the focus on it");
        assert.equal(
          cropButton(p, "कांदा")?.getAttribute("aria-pressed"),
          "true",
          "with its answer",
        );
        assert.equal(p.search()["region"], "nashik", "still the page's place");
        await act(async () => p.router.history.forward());
        await settle(300);
        assert.equal(p.stateOf(3), "open", "forward: the next step again");
      } finally {
        await p.unmount();
      }
      // a reload of the quantity step with nothing known: the first missing step, said
      const lost = await mountStorage("/storage?step=quantity", "en");
      try {
        await openSettledAt(lost, 1);
        const line = lost.q('[data-testid="store-flow-restarted"]');
        ok(line, "it says the earlier answers were not kept");
        assert.equal(line.getAttribute("role"), "status", "as a status");
        sameEl(document.activeElement, document.body, "and moves no focus");
      } finally {
        await lost.unmount();
      }
      // a reload whose earlier answers the address holds: that step, with no line
      const kept = await mountStorage(
        "/storage?state=mh&region=nashik&crop=onion&step=quantity",
        "mr",
      );
      try {
        await openSettledAt(kept, 3);
        noEl(kept.q('[data-testid="store-flow-restarted"]'), "nothing to say");
      } finally {
        await kept.unmount();
      }
      // a step name of no flow opens nothing, and is never printed
      const odd = await mountStorage("/storage?state=mh&region=nashik&step=payout", "mr");
      try {
        await openSettledAt(odd, 2);
        ok(!odd.said().includes("payout"), "not printed");
      } finally {
        await odd.unmount();
      }
      // crisis words in the step's box of the address: the page's one gate reads them, the card alone
      const crisis = await mountStorage(`/storage?step=${encodeURIComponent(CRISIS_MR)}`, "mr");
      try {
        for (let i = 0; i < 40 && !crisisCard(crisis); i++) await settle(50);
        ok(crisisCard(crisis), "the gate reads ?step= as every box of an address");
        ok(!crisis.said().includes(CRISIS_MR), "and prints none of it");
      } finally {
        await crisis.unmount();
      }
    });
  });

  // ======================================================================================== KA10
  test("KA10 every box has its inputmode and enterkeyhint, none is a number box; Continue comes right after its box", async () => {
    const tabbable = (root: Element) =>
      [...root.querySelectorAll("button, input, select, textarea, a[href]")].filter(
        (el) => !(el as HTMLElement).hasAttribute("disabled"),
      );
    await inStart(async () => {
      const p = await atNashikCrops();
      try {
        await toQuantity(p);
        const box = await openOther(p);
        assert.equal(
          box.getAttribute("inputmode"),
          "decimal",
          "a quantity: the keypad with its point",
        );
        assert.equal(box.getAttribute("enterkeyhint"), "done", "its key says Done");
        assert.notEqual(box.getAttribute("type"), "number", "never a number box");
        const all = tabbable(p.container);
        sameEl(
          all[all.indexOf(box) + 1],
          p.q('[data-testid="store-qty-use"]'),
          "Continue comes right after its box",
        );
      } finally {
        await p.unmount();
      }
      const k = await mountKit("en");
      try {
        await tap(k.q('[data-testid="kit-kind-bank"]'), "Bank");
        const account = k.box("details", "account");
        const ifsc = k.box("details", "ifsc");
        assert.equal(account?.getAttribute("inputmode"), "numeric", "the account's keypad");
        assert.equal(account?.getAttribute("enterkeyhint"), "next", "not the last box: Next");
        assert.equal(ifsc?.getAttribute("enterkeyhint"), "done", "the last box: Done");
        const all = tabbable(k.container);
        sameEl(
          all[all.indexOf(ifsc as Element) + 1],
          k.q('[data-testid="kit-details-continue"]'),
          "Continue comes right after the last box",
        );
        for (const b of k.container.querySelectorAll("input"))
          ok(b.getAttribute("inputmode") && b.getAttribute("enterkeyhint"), "every box has both");
      } finally {
        await k.unmount();
      }
    });
  });

  // ======================================================================================== KA11
  test("KA11 her UPI ID, account number, IFSC, name and phone are never in the address, localStorage, sessionStorage or the query cache; the storage box's words never kept", async () => {
    const theirs = [TEST_BANK.account, TEST_BANK.ifsc, "Recording Farmer", "9000000001"];
    const kept = (k: { entries: string[]; qc: InstanceType<App["QueryClient"]> }) => {
      const stores = [window.localStorage, window.sessionStorage].flatMap((s) =>
        Array.from({ length: s.length }, (_, i) => {
          const key = s.key(i) ?? "";
          return `${key}=${s.getItem(key) ?? ""}`;
        }),
      );
      const cache = k.qc
        .getQueryCache()
        .getAll()
        .map((q) => JSON.stringify({ key: q.queryKey, data: q.state.data }));
      return [...k.entries, ...stores, ...cache, document.title].join("\n");
    };
    await inStart(async () => {
      const k = await mountKit("en");
      try {
        await kitToName(k);
        await type(k.box("name", "name") as HTMLInputElement, "Recording Farmer");
        await type(k.box("name", "phone") as HTMLInputElement, "9000000001");
        await tap(k.q('[data-testid="kit-name-continue"]'), "Continue");
        assert.equal(k.stateOf("check"), "open", "the check step");
        const held = kept(k);
        for (const v of theirs) ok(!held.includes(v), `${v}: kept nowhere`);
        ok(
          k.entries.some((e) => e.includes("step=check")),
          "the address holds the step's name",
        );
      } finally {
        await k.unmount();
      }
      // the UPI branch
      const u = await mountKit("en");
      try {
        await tap(u.q('[data-testid="kit-kind-upi"]'), "UPI");
        await type(u.box("details", "upi") as HTMLInputElement, "farmer9000@okicici");
        await enter(u.box("details", "upi") as HTMLInputElement);
        assert.equal(u.stateOf("name"), "open", "on to the name");
        ok(!kept(u).includes("farmer9000"), "the UPI ID kept nowhere");
      } finally {
        await u.unmount();
      }
      // the storage box: words typed there (no crisis) are read, refused beside the box, and never kept
      const p = await atNashikCrops();
      try {
        await toQuantity(p);
        const box = await openOther(p);
        await type(box, "37 bags");
        await tap(p.q('[data-testid="store-qty-use"]'), "Use");
        ok(p.q('[data-testid="store-qty-range"]'), "not a number: said beside the box");
        ok(!kept(p).includes("37 bags") && !kept(p).includes("bags"), "her words kept nowhere");
      } finally {
        await p.unmount();
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
