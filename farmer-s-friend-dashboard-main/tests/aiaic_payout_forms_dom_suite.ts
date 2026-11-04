/**
 * BOTH PAYOUT FORMS, DRIVEN AS SHE DRIVES THEM (the re-check of 5 Nov 2026, round 4: RC4-1 and RC4-2; the platform's
 * rule D-105: nothing answers a person in crisis before the scan does). Four rounds of compiler pins on the forms' source
 * each left an expression outside them that brought back AN-1's harm with every suite green, so the distress path's
 * guard on both payout forms is this behavioural test: the REAL `DestinationForm` (FromAiaicCard.tsx) and Route's REAL
 * card (AiaicPayments.tsx) are rendered in jsdom under React's `act`, typed into one character at a time and tapped, as
 * she does, and their presses ask the REAL `scanFirst` server function in this process (`askScanFirst`, shared with the
 * trade suite).
 *
 * Run:  npx tsx tests/aiaic_payout_forms_dom_suite.ts   (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file)
 * `bun install` gives it jsdom (a devDependency). Without jsdom the suite fails, and says so; it never skips.
 *
 * For each form, every combination of: every box she can type words in (the name, the account, the IFSC, the UPI ID,
 * Route's name on PAN), each copied crisis phrase, her tick on and off, the other fields valid and empty, bank and UPI.
 * In every case:
 *  (a) while she types, after each input event, nothing on the form changes but her boxes' own values and Save's
 *      enabled state (the form as the DOM holds it, its text and every alert or status region, against the empty form),
 *      and no box carries a validation message of the browser's;
 *  (b) Save is on the form, and open once any free box holds words, ticked or not, with nothing on it or around it that
 *      keeps her tap off it as far as the DOM says (jsdom does no layout: `inert`, `hidden`, a class that takes its taps);
 *  (c) her tap (a real click on Save, or the form's submit as the browser makes it) asks the scan FIRST, before her form
 *      is given to anything, in her chosen language, with her words as she typed them;
 *  (d) AIAIC's crisis card shows with its 3 helplines, no refusal is on screen, her form is never given, and Save is not
 *      stuck.
 * The one kind of press the re-check's RC2-3 decision sends to AIAIC as now (CRISIS_EN in a name box, every other field
 * valid and ticked: no rule of this phone refuses it, and AIAIC's own middleware reads the name first) is asserted
 * exactly as it is, so a change to it is seen. Not a crisis: a well-formed form is given with no scan; a 41-character
 * account is refused after the scan and Save is not stuck; an account number typed in the IFSC box sends no digit to
 * the scan.
 *
 * NOTHING LEAVES THIS MACHINE: AIAIC is a closed port of this machine (AIAIC_BASE_URL, set before any app module loads),
 * `fetch` answers only the scan's `/safety/check` (AIAIC's RECORDED crisis answer, safety_check_crisis.json, when what
 * the scan reads holds a copied phrase; a clean answer otherwise), and any other call, or any connection at all, is
 * refused and fails the test it happened in. Her form, when given, meets its server function's own validator in this
 * process; its handler never runs, so AIAIC is never asked. The crisis phrases are imported from the shared module,
 * copied there from AIAIC's and this app's own crisis tests: none is written here.
 */
process.env["AIAIC_BASE_URL"] = "http://127.0.0.1:9";
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
const SUITE = "aiaic_payout_forms_dom_suite";

// ------------------------------------------------------------------------------- the guard: nothing leaves

/** Every network call this suite did not answer, and every connection asked for: each one fails its test. */
const outside: string[] = [];
const SCAN_URL = `${process.env["AIAIC_BASE_URL"]}/safety/check`;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guarded(this: net.Socket, ...args: unknown[]) {
  const first = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0];
  const pipe =
    (typeof first === "object" && first !== null && "path" in first) ||
    (typeof first === "string" && Number.isNaN(Number(first)));
  if (pipe) return (connect as (...a: unknown[]) => net.Socket).apply(this, args);
  const where =
    typeof first === "object" && first !== null
      ? `${String((first as { host?: unknown }).host)}:${String((first as { port?: unknown }).port)}`
      : `${String(args[1])}:${String(first)}`;
  outside.push(`a connection to ${where}`);
  process.nextTick(() => this.destroy(new Error("refused by the suite's guard")));
  return this;
} as typeof net.Socket.prototype.connect;

type Recorded = { answer: Record<string, unknown> };
const recorded = (name: string) =>
  (JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf-8")) as Recorded).answer;
/** AIAIC's real crisis answer (POST /safety/check), as its recorder recorded it. */
const CRISIS_ANSWER = recorded("safety_check_crisis");
/** AIAIC's helplines in that answer: her crisis card must show these three (the card's own fallback shows two). */
const HELPLINES = (CRISIS_ANSWER["talk_to_someone"] as { phone: string }[]).map((h) => h.phone);
/** A clean read: AIAIC's answer with no distress in it (as the trade suite's scan bench answers one). */
const CLEAN_ANSWER = { distress: false };

/** What one press did, in order: "scan" each time the scan is asked, "give" when her form goes to its server function. */
const seen = {
  events: [] as string[],
  scans: [] as { text: string; lang: string }[],
  given: [] as {
    fn: string;
    sent: Record<string, unknown>;
    taken: boolean;
    refusal?: string;
  }[],
  unanswered: [] as string[],
  rejections: [] as string[],
  reset() {
    this.events.length = 0;
    this.scans.length = 0;
    this.given.length = 0;
  },
};
/** The copied crisis phrases, as the scan stand-in reads them (filled in once the shared module loads). */
const PHRASES: string[] = [];

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url !== SCAN_URL || (init?.method ?? "GET") !== "POST") {
    outside.push(`fetch ${init?.method ?? "GET"} ${url}`);
    throw new TypeError("refused by the suite's guard");
  }
  const body = JSON.parse(String(init?.body ?? "{}")) as { text?: unknown; lang?: unknown };
  const text = String(body.text ?? "");
  seen.events.push("scan");
  seen.scans.push({ text, lang: String(body.lang) });
  const crisis = PHRASES.some((p) => text.toLowerCase().includes(p.toLowerCase()));
  return new Response(JSON.stringify(crisis ? CRISIS_ANSWER : CLEAN_ANSWER), {
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
function test(name: string, run: () => Promise<void>) {
  tests.push({ name, run });
}

type Lang = "en" | "mr" | "hi";
type Phrase = "CRISIS_HI" | "CRISIS_EN" | "CRISIS_MR";
const LANG_OF: Record<Phrase, Lang> = { CRISIS_HI: "hi", CRISIS_EN: "en", CRISIS_MR: "mr" };

/** jsdom's window as this suite's globals: React and the app's modules load only after it (their imports are below). */
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
}

async function loadApp() {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const { RouterContextProvider, createMemoryHistory, createRootRoute, createRouter } =
    await import("@tanstack/react-router");
  const { runWithStartContext } = await import("@tanstack/start-storage-context");
  const { DICTS, I18nProvider } = await import("../src/lib/i18n");
  const { DestinationForm } = await import("../src/components/farm/aiaic/FromAiaicCard");
  const { AiaicPayments } = await import("../src/components/farm/aiaic/AiaicPayments");
  const { CrisisFirst } = await import("../src/components/farm/aiaic/CrisisFirst");
  const { scanFirst } = await import("../src/lib/aiaic-account.functions");
  const { getMyTrade, giveMyDestination, givePayoutAccount } =
    await import("../src/lib/aiaic-trade.functions");
  const { mineForBrowser } = await import("../src/lib/aiaic-trade.server");
  const shared = await import("./aiaic_shared_scan");
  return {
    React,
    createRoot,
    QueryClient,
    QueryClientProvider,
    RouterContextProvider,
    createMemoryHistory,
    createRootRoute,
    createRouter,
    runWithStartContext,
    DICTS,
    I18nProvider,
    DestinationForm,
    AiaicPayments,
    CrisisFirst,
    scanFirst,
    getMyTrade,
    giveMyDestination,
    givePayoutAccount,
    mineForBrowser,
    shared,
  };
}
type App = Awaited<ReturnType<typeof loadApp>>;

// ------------------------------------------------------------------------------------------------ the suite

function suite(app: App, window: Window & typeof globalThis) {
  const { React, DICTS, shared } = app;
  const { act, createElement } = React;
  const { CRISIS_EN, CRISIS_HI, CRISIS_MR, TEST_BANK } = shared;
  const PHRASE: Record<Phrase, string> = { CRISIS_HI, CRISIS_EN, CRISIS_MR };
  PHRASES.push(CRISIS_HI, CRISIS_EN, CRISIS_MR);
  const words = (lang: Lang, key: string) => DICTS[lang][key] ?? DICTS.en[key] ?? key;
  const document = window.document;

  // what she sees: the forms read AIAIC's recorded answers through this server's own reading of them
  const notice = (app.mineForBrowser(recorded("collect_mine_paid")) as { x_notice?: unknown })
    .x_notice as never;
  const mineAnswer = {
    ok: true,
    data: {
      mine: app.mineForBrowser(recorded("payout_mine_offered")),
      cropNames: {},
      districtNames: {},
    },
  };

  // ------------------------------------------------- her presses through this app's server functions, in this process
  /** Each server function by its own handler (learnt once, below): the forms' calls are told apart by it. */
  const handlers = new Map<unknown, string>();
  const named = {
    scanFirst: app.scanFirst,
    giveMyDestination: app.giveMyDestination,
    givePayoutAccount: app.givePayoutAccount,
    getMyTrade: app.getMyTrade,
  };
  const rpc = {
    options: {
      client: async (ctx: Record<string, unknown>) => {
        const name = handlers.get(ctx["extractedFn"]);
        if (name === "scanFirst")
          // the REAL scanFirst: its own validator, then its own handler (`scanRead`, asking `fetch` above)
          return {
            ...ctx,
            result: await shared.askScanFirst({
              data: ctx["data"] as { text: string; lang: Lang },
            }),
          };
        if (name === "giveMyDestination" || name === "givePayoutAccount") {
          seen.events.push("give");
          const sent = { ...(ctx["data"] as Record<string, unknown>) };
          try {
            // its OWN validator, as Start's RPC runs it on this server; its handler never runs (AIAIC is not asked)
            await shared.inProcess(named[name], ctx["data"], "validator");
            seen.given.push({ fn: name, sent, taken: true });
          } catch (e) {
            seen.given.push({ fn: name, sent, taken: false, refusal: String(e).slice(0, 300) });
            throw e;
          }
          return { ...ctx, result: { ok: true, data: { status: null } } };
        }
        // her records, read again after a press: AIAIC's recorded answer, as the page was given it
        if (name === "getMyTrade") return { ...ctx, result: mineAnswer };
        seen.unanswered.push(String(name ?? "a server function this suite does not know"));
        throw new Error("a server function this suite does not answer");
      },
    },
  };
  const inStart = <T>(fn: () => Promise<T>) =>
    app.runWithStartContext({ startOptions: { functionMiddleware: [rpc] } } as never, fn);
  /** Each server function's own handler, learnt by calling it once through a middleware that only reads it (a call on
   * the page's side runs no validator and no handler). */
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
      new Set([...handlers.keys()].filter((h) => typeof h === "function")).size,
      Object.keys(named).length,
      "each server function the forms call is told apart by its own handler",
    );
  };

  // ------------------------------------------------------------------------------------------- the page, driven
  const settle = async () => {
    for (let i = 0; i < 30; i++)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
  };
  /** One input event, as her keyboard makes it: the box's value set through the browser's own setter. */
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
    ?.set as (this: HTMLInputElement, v: string) => void;
  const input = async (box: HTMLInputElement, value: string) => {
    await act(async () => {
      valueSetter.call(box, value);
      box.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  };
  const tap = async (el: Element) => {
    await act(async () => {
      (el as HTMLElement).click();
    });
  };

  const mount = async (
    el: ReturnType<typeof createElement>,
    lang: Lang,
    seed?: (qc: InstanceType<App["QueryClient"]>) => void,
  ) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const router = app.createRouter({
      routeTree: app.createRootRoute(),
      history: app.createMemoryHistory({ initialEntries: ["/"] }),
    });
    const qc = new app.QueryClient({ defaultOptions: { queries: { retry: false } } });
    seed?.(qc);
    const root = app.createRoot(container);
    await act(async () => {
      root.render(
        createElement(app.RouterContextProvider, {
          router: router as never,
          children: createElement(app.QueryClientProvider, {
            client: qc,
            children: createElement(app.I18nProvider, { initialLang: lang, children: el }),
          }),
        }),
      );
    });
    return {
      container,
      unmount: async () => {
        await act(async () => root.unmount());
        container.remove();
        qc.clear();
      },
    };
  };

  type Box = "name" | "account" | "ifsc" | "upi";
  type Kind = "bank" | "upi";
  /** A payout form, opened as she opens it: its own area, her boxes by their labels, Save, her tick. */
  type Opened = {
    scope: () => Element;
    box: (b: Box | "pan") => HTMLInputElement;
    save: () => HTMLButtonElement | null;
    choose: (k: Kind) => Promise<void>;
    tick: () => Promise<void>;
    /** the other fields valid; each change through what she does (a box's input event, or Route's TEST values button) */
    restValid: (except: Box, kind: Kind, after: () => void) => Promise<void>;
    container: HTMLElement;
    unmount: () => Promise<void>;
  };
  const boxByLabel = (scope: Element, label: string) => {
    const found = [...scope.querySelectorAll("label")]
      .find((l) => (l.firstChild?.textContent ?? "").trim() === label)
      ?.querySelector("input");
    assert.ok(found, `the box labelled "${label}"`);
    return found as HTMLInputElement;
  };
  const radio = (scope: Element, label: string) => {
    const found = [...scope.querySelectorAll('[role="radio"]')].find(
      (b) => (b.textContent ?? "").trim() === label,
    );
    assert.ok(found, `the choice "${label}"`);
    return found;
  };

  const openCashfree = async (lang: Lang, gate = false): Promise<Opened> => {
    const form = createElement(app.DestinationForm, { dest: null, notice, largeAmount: false });
    const m = await mount(gate ? createElement(app.CrisisFirst, { children: form }) : form, lang);
    const scope = () =>
      m.container.querySelector('[data-testid="aiaic-destination-form"]') ?? m.container;
    const LABEL: Record<Box | "pan", string> = {
      name: "aiaic.dest.name",
      account: "aiaic.dest.account",
      ifsc: "aiaic.dest.ifsc",
      upi: "aiaic.dest.upi",
      pan: "-",
    };
    return {
      scope,
      box: (b) => boxByLabel(scope(), words(lang, LABEL[b])),
      save: () =>
        [...scope().querySelectorAll("button")].find(
          (b) => (b.textContent ?? "").trim() === words(lang, "aiaic.dest.save"),
        ) ?? null,
      choose: (k) =>
        tap(
          radio(
            scope(),
            words(lang, k === "bank" ? "aiaic.dest.kind.bank_account" : "aiaic.dest.kind.upi_id"),
          ),
        ),
      tick: async () => {
        const tick = scope().querySelector('input[type="checkbox"]');
        assert.ok(tick, "her tick");
        await tap(tick);
      },
      restValid: async (except, kind, after) => {
        if (kind === "upi") return; // a UPI ID is the form's only box
        const valid: Record<string, string> = {
          name: "Recording Farmer",
          account: TEST_BANK.account,
          ifsc: TEST_BANK.ifsc,
        };
        for (const [b, v] of Object.entries(valid))
          if (b !== except) {
            await input(boxByLabel(scope(), words(lang, LABEL[b as Box])), v);
            after();
          }
      },
      container: m.container,
      unmount: m.unmount,
    };
  };

  const openRoute = async (lang: Lang, gate = false): Promise<Opened> => {
    const page = createElement(app.AiaicPayments);
    const m = await mount(
      gate ? createElement(app.CrisisFirst, { children: page }) : page,
      lang,
      (qc) => qc.setQueryData(["aiaic-mine", lang], mineAnswer),
    );
    const give = [...m.container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === words(lang, "aiaic.payout.give"),
    );
    assert.ok(give, "Route's card offers her form");
    await tap(give);
    const scope = () => m.container.querySelector("form")?.closest("section") ?? m.container;
    const LABEL: Record<Box | "pan", string> = {
      name: "aiaic.field.name_on_pan",
      account: "aiaic.field.account_number",
      ifsc: "aiaic.field.ifsc",
      upi: "aiaic.field.upi_id",
      pan: "aiaic.field.pan",
    };
    return {
      scope,
      box: (b) => boxByLabel(scope(), words(lang, LABEL[b])),
      save: () => scope().querySelector('form button[type="submit"]'),
      choose: (k) =>
        tap(radio(scope(), words(lang, k === "bank" ? "aiaic.payout.bank" : "aiaic.payout.upi"))),
      tick: async () => {
        const read = scope().querySelector("form button[aria-expanded]");
        assert.ok(read, "the notice's own button");
        if (read.getAttribute("aria-expanded") !== "true") await tap(read);
        const tick = scope().querySelector('form input[type="checkbox"]');
        assert.ok(tick, "her tick");
        await tap(tick);
      },
      restValid: async (except, _kind, after) => {
        // Route's own TEST values (its card is offered on a TEST server only), then her box emptied, as she would
        const fill = [...scope().querySelectorAll("button")].find(
          (b) => (b.textContent ?? "").trim() === words(lang, "aiaic.payout.fill_test"),
        );
        assert.ok(fill, "Route's TEST values button");
        await tap(fill);
        after();
        await input(boxByLabel(scope(), words(lang, LABEL[except])), "");
        after();
      },
      container: m.container,
      unmount: m.unmount,
    };
  };

  // ----------------------------------------------------------------------------------------- what is on screen
  const refusalLines = (lang: Lang) =>
    Object.entries(DICTS[lang])
      .filter(([k]) => k.startsWith("aiaic.refused.") || k === "aiaic.problem.aiaic_unavailable")
      .map(([k, v]) => [k, String(v).split("{")[0]?.trim() ?? ""] as const)
      .filter(([, v]) => v.length >= 8);
  const RED = (cls: string) =>
    cls.split(/\s+/).some((c) => c === "text-destructive" || c.startsWith("border-destructive"));
  /** What on her form says a refusal: a refusal's words, an alert, aria-invalid, a red line or box, or a box the browser
   * marks invalid. AIAIC's crisis card is left out (it is red and an alert by design). */
  const refusalOnScreen = (scope: Element, lang: Lang): string[] => {
    const copy = scope.cloneNode(true) as Element;
    for (const c of copy.querySelectorAll("[data-crisis]")) c.remove();
    const text = copy.textContent ?? "";
    const why: string[] = [];
    for (const [k, v] of refusalLines(lang)) if (text.includes(v)) why.push(`the words of ${k}`);
    if (copy.querySelector('[role="alert"]')) why.push("an alert");
    if (copy.querySelector('[aria-invalid="true"]')) why.push("aria-invalid");
    for (const el of [copy, ...copy.querySelectorAll("[class]")])
      if (RED(el.getAttribute("class") ?? "")) {
        why.push(`a red ${el.tagName.toLowerCase()}`);
        break;
      }
    for (const i of scope.querySelectorAll("input, select, textarea")) {
      const box = i as HTMLInputElement;
      if (box.validationMessage || !box.validity.valid)
        why.push(`a box the browser marks invalid ("${box.validationMessage.slice(0, 40)}")`);
    }
    return why;
  };
  /** The form as the DOM holds it, but for her boxes' own values and Save's enabled state. */
  const formAsHeld = (f: Opened) => {
    const scope = f.scope();
    const copy = scope.cloneNode(true) as Element;
    for (const i of copy.querySelectorAll("input")) i.removeAttribute("value");
    const save = f.save();
    if (save) {
      const at = [...scope.querySelectorAll("button")].indexOf(save);
      copy.querySelectorAll("button")[at]?.removeAttribute("disabled");
    }
    return copy.outerHTML;
  };
  const regions = (scope: Element) =>
    [...scope.querySelectorAll('[role="alert"], [role="status"], [aria-live]')].map(
      (r) => `${r.getAttribute("role") ?? "live"}: ${(r.textContent ?? "").trim()}`,
    );
  /** What keeps her tap off Save, as far as the DOM can say (jsdom does no layout, and a script's `click()` reaches an
   * element a browser would not let her tap): disabled (its own, or a fieldset's), or on Save or around it `inert`,
   * `hidden`, `aria-hidden`, an inline style that hides it or takes its taps, or a class that does, read by its name. */
  const NO_TAP = new Set(["hidden", "invisible", "pointer-events-none"]);
  const untappable = (save: HTMLButtonElement): string[] => {
    const why: string[] = [];
    if (save.disabled || save.matches(":disabled")) why.push("disabled");
    for (let e: Element | null = save; e; e = e.parentElement) {
      const tag = `<${e.tagName.toLowerCase()}>`;
      for (const a of ["inert", "hidden"]) if (e.hasAttribute(a)) why.push(`${a} on ${tag}`);
      if (e.getAttribute("aria-hidden") === "true") why.push(`aria-hidden on ${tag}`);
      const style = window.getComputedStyle(e);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.pointerEvents === "none"
      )
        why.push(`a style on ${tag} that hides it or takes its taps`);
      for (const c of (e.getAttribute("class") ?? "").split(/\s+/))
        if (NO_TAP.has(c)) why.push(`${c} on ${tag}`);
    }
    return why;
  };
  /** (a) and (b), after each input event: against the empty form. */
  const watchTyping = (f: Opened, lang: Lang) => {
    const empty = {
      held: formAsHeld(f),
      text: f.scope().textContent ?? "",
      regions: regions(f.scope()),
    };
    assert.deepEqual(refusalOnScreen(f.scope(), lang), [], "the empty form says no refusal");
    let events = 0;
    return {
      check: (what: string, open: boolean) => {
        events += 1;
        const scope = f.scope();
        const where = `${what} (input event ${events})`;
        assert.equal(
          scope.textContent ?? "",
          empty.text,
          `${where}: the form's words are the empty form's`,
        );
        assert.deepEqual(
          regions(scope),
          empty.regions,
          `${where}: no alert or status region changed`,
        );
        for (const i of scope.querySelectorAll("input")) {
          const box = i as HTMLInputElement;
          assert.equal(
            box.validationMessage,
            "",
            `${where}: no box carries the browser's own message`,
          );
          assert.ok(box.validity.valid, `${where}: no box the browser marks invalid`);
        }
        assert.equal(
          formAsHeld(f),
          empty.held,
          `${where}: nothing but her boxes' values and Save's state changed`,
        );
        const save = f.save();
        assert.ok(save, `${where}: Save is on her form`);
        if (open)
          assert.deepEqual(
            untappable(save),
            [],
            `${where}: Save is open on her words, and nothing keeps her tap off it`,
          );
      },
    };
  };

  // ---------------------------------------------------------------------------------------- one case, all of it
  type Case = {
    id: string;
    form: "cashfree" | "route";
    kind: Kind;
    box: Box;
    phrase: Phrase;
    ticked: boolean;
    rest: "valid" | "empty";
    /** inside the app's own gate (`CrisisFirst`, as `TradeSwitch` puts every AIAIC page): the card then stands alone */
    gate?: boolean;
  };
  /** The press the re-check's RC2-3 decision sends to AIAIC as now: no rule of this phone refuses it, and AIAIC's own
   * middleware reads the name in its body first (the trade suite's B21). Asserted exactly, so a change to it is seen. */
  const sentAsNow = (c: Case) =>
    c.phrase === "CRISIS_EN" && c.box === "name" && c.ticked && c.rest === "valid";

  const crisisCase = (c: Case) => async () => {
    const lang = LANG_OF[c.phrase];
    const phrase = PHRASE[c.phrase];
    await inStart(async () => {
      const f =
        c.form === "cashfree" ? await openCashfree(lang, c.gate) : await openRoute(lang, c.gate);
      try {
        await f.choose(c.kind);
        if (c.ticked) await f.tick();
        const typing = watchTyping(f, lang);
        if (c.rest === "valid") {
          await f.restValid(c.box, c.kind, () => typing.check("the other fields", false));
          // a name, or Route's UPI ID, among the valid fields is words already: Save is open on them
          typing.check(
            "the other fields filled",
            c.box !== "name" || (c.form === "route" && c.kind === "upi"),
          );
        }
        const box = f.box(c.box);
        for (const ch of Array.from(phrase)) {
          await input(box, box.value + ch);
          typing.check(`her ${c.box} box, typed`, true);
        }
        const typed = box.value;
        // her tap
        seen.reset();
        const save = f.save();
        assert.ok(save, "Save is on her form");
        assert.deepEqual(untappable(save), [], "her tap can reach Save");
        await tap(save);
        await settle();
        if (sentAsNow(c)) {
          assert.deepEqual(
            seen.events,
            ["give"],
            "sent to AIAIC as now: no scan on this phone, given",
          );
          const sent = seen.given[0]?.sent ?? {};
          assert.equal(
            sent[c.form === "cashfree" ? "name" : "name_on_pan"],
            phrase,
            "the name's words reach AIAIC intact",
          );
          assert.equal(seen.given[0]?.taken, true, "its server function's validator takes it");
          return;
        }
        // (c) the scan first, in her language, with her words as she typed them
        assert.equal(
          seen.events[0],
          "scan",
          `her tap asks the scan first (it did: ${seen.events.join(", ") || "nothing"})`,
        );
        assert.equal(seen.scans[0]?.lang, lang, "the scan is asked in her chosen language");
        assert.ok(
          seen.scans[0]?.text.includes(typed.trim()),
          `the scan reads her words as she typed them ("${seen.scans[0]?.text}")`,
        );
        for (const scan of seen.scans)
          assert.doesNotMatch(scan.text, /\p{Nd}/u, "no digit she typed goes to the scan");
        // (d) AIAIC's crisis card, nothing refused, never given, Save not stuck
        assert.deepEqual(seen.events, ["scan"], "her form is never given");
        const card = f.scope().querySelector("[data-crisis]");
        assert.ok(card, "AIAIC's crisis card shows");
        for (const phone of HELPLINES)
          assert.ok((card.textContent ?? "").includes(phone), `helpline ${phone}`);
        assert.deepEqual(refusalOnScreen(f.scope(), lang), [], "no refusal is on screen");
        if (c.gate) {
          // the page is the card alone: nothing of her form, and no Save to be stuck
          assert.equal(f.container.querySelector("input, form"), null, "the card stands alone");
          return;
        }
        const after = f.save();
        assert.ok(after, "Save is still on her form");
        assert.deepEqual(untappable(after), [], "Save is not stuck");
        assert.equal(after.querySelector(".animate-spin"), null, "Save does not spin");
      } finally {
        await f.unmount();
      }
    });
  };

  test("A0 the guard: a fetch to anything but the scan, and any connection at all, is refused and fails the test it happens in", async () => {
    // both asked of this machine's own closed port: even an unguarded call could not leave it
    await assert.rejects(fetch("http://127.0.0.1:9/farmer/trade"), /refused by the suite's guard/);
    const socket = net.connect({ host: "127.0.0.1", port: 9 });
    const refused = await new Promise<Error>((resolve) => socket.on("error", resolve));
    assert.match(refused.message, /refused by the suite's guard/);
    assert.deepEqual(outside, [
      "fetch GET http://127.0.0.1:9/farmer/trade",
      "a connection to 127.0.0.1:9",
    ]);
    outside.length = 0; // its own two, seen
    assert.equal(HELPLINES.length, 3, "AIAIC's recorded crisis answer holds its three helplines");
  });

  // the matrix: each form, each box she types words in, each phrase, her tick on and off, the rest valid and empty
  const boxes: { form: Case["form"]; kind: Kind; box: Box; rests: Case["rest"][] }[] = [
    { form: "cashfree", kind: "bank", box: "name", rests: ["valid", "empty"] },
    { form: "cashfree", kind: "bank", box: "account", rests: ["valid", "empty"] },
    { form: "cashfree", kind: "bank", box: "ifsc", rests: ["valid", "empty"] },
    // the Cashfree UPI form has no other box: the rest valid and the rest empty are the same form
    { form: "cashfree", kind: "upi", box: "upi", rests: ["empty"] },
    { form: "route", kind: "bank", box: "name", rests: ["valid", "empty"] },
    { form: "route", kind: "bank", box: "account", rests: ["valid", "empty"] },
    { form: "route", kind: "bank", box: "ifsc", rests: ["valid", "empty"] },
    { form: "route", kind: "upi", box: "name", rests: ["valid", "empty"] },
    { form: "route", kind: "upi", box: "upi", rests: ["valid", "empty"] },
  ];
  const FORM_SAID = { cashfree: "Cashfree", route: "Route" };
  const BOX_SAID = { name: "name", account: "account", ifsc: "IFSC", upi: "UPI ID" };
  let n = 0;
  for (const b of boxes)
    for (const phrase of ["CRISIS_HI", "CRISIS_EN", "CRISIS_MR"] as const)
      for (const ticked of [true, false])
        for (const rest of b.rests) {
          n += 1;
          const c: Case = { id: `M${String(n).padStart(3, "0")}`, ...b, phrase, ticked, rest };
          const what = sentAsNow(c)
            ? "given with no scan on this phone, as the RC2-3 decision sends it to AIAIC"
            : "the scan first, AIAIC's crisis card and helplines, never given";
          test(
            `${c.id} ${FORM_SAID[c.form]} ${c.kind === "bank" ? "bank" : "UPI"} form, ${b.form === "route" && b.box === "name" ? "name on PAN" : BOX_SAID[c.box]} box: ${c.phrase} (${LANG_OF[c.phrase]}), ${ticked ? "ticked" : "not ticked"}, the rest ${rest === "valid" ? "valid" : "empty"}: ${what}`,
            crisisCase(c),
          );
        }

  // inside the app's own gate, a crisis in each box of each form: the page becomes the card alone
  const GATED: [Case["form"], Kind, Box, Phrase][] = [
    ["cashfree", "bank", "name", "CRISIS_MR"],
    ["cashfree", "bank", "account", "CRISIS_HI"],
    ["cashfree", "bank", "ifsc", "CRISIS_EN"],
    ["cashfree", "upi", "upi", "CRISIS_MR"],
    ["route", "bank", "name", "CRISIS_HI"],
    ["route", "bank", "account", "CRISIS_EN"],
    ["route", "bank", "ifsc", "CRISIS_MR"],
    ["route", "upi", "name", "CRISIS_MR"],
    ["route", "upi", "upi", "CRISIS_HI"],
  ];
  GATED.forEach(([form, kind, box, phrase], i) => {
    const c: Case = {
      id: `G${i + 1}`,
      form,
      kind,
      box,
      phrase,
      ticked: false,
      rest: form === "cashfree" && kind === "upi" ? "empty" : "valid",
      gate: true,
    };
    test(
      `${c.id} inside the app's own gate, ${FORM_SAID[form]} ${kind === "bank" ? "bank" : "UPI"} form, ${form === "route" && box === "name" ? "name on PAN" : BOX_SAID[box]} box: ${phrase} (${LANG_OF[phrase]}), not ticked: the scan first, then the page is AIAIC's crisis card alone`,
      crisisCase(c),
    );
  });

  // ------------------------------------------------------------------------------------- not a crisis
  /** Route's TEST values (AiaicPayments.tsx's own; AIAIC's recorder uses the same kind): never a person's. */
  const ROUTE_VALID = {
    name: "Practice Payee Testname",
    pan: "AAAPZ4321K",
    account: "000123456789",
    ifsc: "RECT0000001",
    upi: "practicepayee@rzptest",
  };
  const CASHFREE_VALID = { name: "Recording Farmer", ...TEST_BANK, upi: "success@upi" };
  const ACCOUNT_41 = `${TEST_BANK.account}${TEST_BANK.account}02629180000`;
  /** Her form filled box by box, each change an input event held to (a), then her tap: the form, for what it shows. */
  const pressFilled = async (
    form: Case["form"],
    lang: Lang,
    kind: Kind,
    values: Partial<Record<Box | "pan", string>>,
  ) => {
    const f = form === "cashfree" ? await openCashfree(lang) : await openRoute(lang);
    await f.choose(kind);
    await f.tick();
    const typing = watchTyping(f, lang);
    for (const [b, v] of Object.entries(values)) {
      await input(f.box(b as Box | "pan"), v);
      typing.check(`the ${b} box`, false);
    }
    seen.reset();
    const save = f.save();
    assert.ok(save, "Save is on her form");
    assert.deepEqual(untappable(save), [], "her tap can reach Save");
    await tap(save);
    await settle();
    return f;
  };
  const notStuck = (f: Opened) => {
    const save = f.save();
    assert.ok(save, "Save is still on her form");
    assert.deepEqual(untappable(save), [], "Save is not stuck");
    assert.equal(save.querySelector(".animate-spin"), null, "Save does not spin");
  };
  /** Refused after the scan read her words (none of them a digit): the refusal said, never given, Save not stuck. */
  const refusedAfterScan = (f: Opened, said: string) => {
    assert.equal(seen.events[0], "scan", "her words are read first");
    assert.deepEqual(seen.events, ["scan"], "her form is never given");
    for (const scan of seen.scans)
      assert.doesNotMatch(scan.text, /\p{Nd}/u, `no digit goes to the scan ("${scan.text}")`);
    assert.equal(f.scope().querySelector("[data-crisis]"), null, "no crisis card for a clean read");
    assert.ok((f.scope().textContent ?? "").includes(said), `the refusal is said: "${said}"`);
    notStuck(f);
  };
  const givenAtOnce = (fn: string, fields: Record<string, string>) => {
    assert.deepEqual(seen.events, ["give"], "given at once: no scan is asked");
    assert.equal(seen.given[0]?.fn, fn);
    assert.equal(seen.given[0]?.taken, true, "its server function's validator takes it");
    for (const [k, v] of Object.entries(fields))
      assert.equal(seen.given[0]?.sent[k], v, `${k} as she typed it`);
  };
  const routeSaid = (lang: Lang, field: string) =>
    words(lang, "aiaic.refused.payout_details_not_valid").replace(
      "{field}",
      words(lang, `aiaic.field.${field}`),
    );
  const quietly = (run: () => Promise<Opened>, then: (f: Opened) => void) => async () => {
    await inStart(async () => {
      const f = await run();
      try {
        then(f);
      } finally {
        await f.unmount();
      }
    });
  };

  test(
    "N1 Cashfree bank form, well formed and ticked: given at once with no scan, and its server function's validator takes it",
    quietly(
      () =>
        pressFilled("cashfree", "en", "bank", {
          name: CASHFREE_VALID.name,
          account: CASHFREE_VALID.account,
          ifsc: CASHFREE_VALID.ifsc,
        }),
      () =>
        givenAtOnce("giveMyDestination", {
          name: CASHFREE_VALID.name,
          account_number: CASHFREE_VALID.account,
          ifsc: CASHFREE_VALID.ifsc,
        }),
    ),
  );
  test(
    "N2 Cashfree UPI form, a UPI ID and ticked: given at once with no scan",
    quietly(
      () => pressFilled("cashfree", "mr", "upi", { upi: CASHFREE_VALID.upi }),
      () => givenAtOnce("giveMyDestination", { upi_id: CASHFREE_VALID.upi, read_in: "mr" }),
    ),
  );
  test(
    "N3 Route bank form, well formed, read and ticked: given at once with no scan",
    quietly(
      () =>
        pressFilled("route", "en", "bank", {
          name: ROUTE_VALID.name,
          pan: ROUTE_VALID.pan,
          account: ROUTE_VALID.account,
          ifsc: ROUTE_VALID.ifsc,
        }),
      () =>
        givenAtOnce("givePayoutAccount", {
          name_on_pan: ROUTE_VALID.name,
          account_number: ROUTE_VALID.account,
          ifsc: ROUTE_VALID.ifsc,
        }),
    ),
  );
  test(
    "N4 Route UPI form, well formed, read and ticked: given at once with no scan",
    quietly(
      () =>
        pressFilled("route", "hi", "upi", {
          name: ROUTE_VALID.name,
          pan: ROUTE_VALID.pan,
          upi: ROUTE_VALID.upi,
        }),
      () => givenAtOnce("givePayoutAccount", { upi_id: ROUTE_VALID.upi, shown_in: "hi" }),
    ),
  );
  test(
    "N5 Cashfree, a 41-character account: refused after the scan read her name, never given, Save not stuck",
    quietly(
      () =>
        pressFilled("cashfree", "en", "bank", {
          name: CASHFREE_VALID.name,
          account: ACCOUNT_41,
          ifsc: CASHFREE_VALID.ifsc,
        }),
      (f) => {
        assert.equal(ACCOUNT_41.length, 41);
        assert.deepEqual(seen.scans, [{ text: CASHFREE_VALID.name, lang: "en" }]);
        refusedAfterScan(f, words("en", "aiaic.refused.account_number_not_valid"));
      },
    ),
  );
  test(
    "N6 Route, a 41-character account: refused after the scan read her name, never given, Save not stuck",
    quietly(
      () =>
        pressFilled("route", "en", "bank", {
          name: ROUTE_VALID.name,
          pan: ROUTE_VALID.pan,
          account: ACCOUNT_41,
          ifsc: ROUTE_VALID.ifsc,
        }),
      (f) => {
        assert.deepEqual(seen.scans, [{ text: ROUTE_VALID.name, lang: "en" }]);
        refusedAfterScan(f, routeSaid("en", "account_number"));
      },
    ),
  );
  // an account number typed where the IFSC goes: no digit of it reaches the scan (the re-check's RC2-4)
  const MISTYPED: [string, "empty" | "number" | "ifsc", string, string][] = [
    ["the account box empty", "empty", "account_number_not_valid", "account_number"],
    ["the account number in both boxes", "number", "ifsc_not_valid", "ifsc"],
    ["the IFSC in the account box", "ifsc", "ifsc_not_valid", "ifsc"],
  ];
  MISTYPED.forEach(([what, account, cashfreeCode, routeField], i) => {
    const accountBox = (valid: { account: string; ifsc: string }) =>
      account === "empty" ? "" : account === "ifsc" ? valid.ifsc : valid.account;
    test(
      `N${7 + 2 * i} Cashfree, an account number typed in the IFSC box, ${what}: no digit goes to the scan, then the refusal`,
      quietly(
        () =>
          pressFilled("cashfree", "en", "bank", {
            name: CASHFREE_VALID.name,
            account: accountBox(CASHFREE_VALID),
            ifsc: CASHFREE_VALID.account,
          }),
        (f) => refusedAfterScan(f, words("en", `aiaic.refused.${cashfreeCode}`)),
      ),
    );
    test(
      `N${8 + 2 * i} Route, an account number typed in the IFSC box, ${what}: no digit goes to the scan, then the refusal`,
      quietly(
        () =>
          pressFilled("route", "en", "bank", {
            name: ROUTE_VALID.name,
            pan: ROUTE_VALID.pan,
            account: accountBox(ROUTE_VALID),
            ifsc: ROUTE_VALID.account,
          }),
        (f) => refusedAfterScan(f, routeSaid("en", routeField)),
      ),
    );
  });

  // ---------------------------------------- what she gives is what its server function's own validator takes
  /**
   * EVERY FIELD OF BOTH FORMS AGAINST ITS SERVER FUNCTION'S OWN VALIDATOR (aiaic-trade.functions.ts: `giveMyDestination`
   * for the Cashfree form, `givePayoutAccount` for Route's; the re-check of 4 Nov 2026, round 3's observation): each
   * field's boundary values, typed into the real form with every other field valid and her tick on, then tapped. The
   * phone's rule and the validator agree: what the phone gives, the validator takes (a validator's refusal reaches her
   * as "AIAIC is not answering", a refusal AIAIC never made); what the validator would refuse, the phone refuses after
   * the scan, in its own existing words. Each validator's own bounds are then read from it directly, on one taken press
   * with that field at its bound and one past it.
   */
  type Edge = { typed: string; then: "taken" | { refused: string }; sent?: string };
  const agree =
    (
      form: Case["form"],
      kind: Kind,
      field: Box | "pan",
      valid: Partial<Record<Box | "pan", string>>,
      edges: Edge[],
      bounds: { key: string; most: number; least?: number },
      langs: Lang[] = ["en"],
    ) =>
    async () => {
      const fn = form === "cashfree" ? "giveMyDestination" : "givePayoutAccount";
      let taken: Record<string, unknown> | null = null;
      for (const lang of langs)
        for (const edge of edges) {
          const what = `${JSON.stringify(edge.typed.length > 40 ? `${edge.typed.slice(0, 20)}... (${edge.typed.length})` : edge.typed)} in ${lang}`;
          await inStart(async () => {
            const f = await pressFilled(form, lang, kind, { ...valid, [field]: edge.typed });
            try {
              const shown = f.scope().textContent ?? "";
              assert.ok(
                !shown.includes(words(lang, "aiaic.problem.aiaic_unavailable")),
                `${what}: never "AIAIC is not answering" for a refusal AIAIC never made`,
              );
              for (const g of seen.given)
                assert.ok(
                  g.taken,
                  `${what}: given, and its own validator refused it: ${g.refusal}`,
                );
              if (edge.then === "taken") {
                assert.deepEqual(seen.events, ["give"], `${what}: given at once`);
                assert.equal(seen.given[0]?.fn, fn);
                if (edge.sent !== undefined)
                  assert.equal(
                    seen.given[0]?.sent[bounds.key],
                    edge.sent,
                    `${what}: sent as checked`,
                  );
                taken = seen.given[0]?.sent ?? null;
              } else refusedAfterScan(f, edge.then.refused);
            } finally {
              await f.unmount();
            }
          });
        }
      // the validator's own bounds, read from it: one taken press with the field at its bound, and one past it
      assert.ok(taken, "one press of these was taken");
      const at = (n: number) => ({
        ...(taken as Record<string, unknown>),
        [bounds.key]: "x".repeat(n),
      });
      const own = named[fn];
      await shared.inProcess(own, at(bounds.most), "validator");
      await assert.rejects(
        shared.inProcess(own, at(bounds.most + 1), "validator"),
        `${fn}'s validator takes ${bounds.key} of ${bounds.most} at most`,
      );
      if (bounds.least !== undefined) {
        await shared.inProcess(own, at(bounds.least), "validator");
        await assert.rejects(
          shared.inProcess(own, at(bounds.least - 1), "validator"),
          `${fn}'s validator takes ${bounds.key} of ${bounds.least} at least`,
        );
      }
    };
  const cf = (code: string) => ({ refused: words("en", `aiaic.refused.${code}`) });
  const rt = (field: string) => ({ refused: routeSaid("en", field) });
  const cashfreeBank = {
    name: CASHFREE_VALID.name,
    account: CASHFREE_VALID.account,
    ifsc: CASHFREE_VALID.ifsc,
  };
  const routeBank = {
    name: ROUTE_VALID.name,
    pan: ROUTE_VALID.pan,
    account: ROUTE_VALID.account,
    ifsc: ROUTE_VALID.ifsc,
  };
  const routeUpi = { name: ROUTE_VALID.name, pan: ROUTE_VALID.pan, upi: ROUTE_VALID.upi };
  const upiOf = (n: number) => `${"a".repeat(n - 4)}@upi`;
  const routeUpiOf = (n: number) => `${"a".repeat(256)}@${"b".repeat(n - 257)}`;

  test(
    "V01 Cashfree name: the phone gives only what giveMyDestination's validator takes; her words go joined by single spaces, as Cashfree's rule read them",
    agree(
      "cashfree",
      "bank",
      "name",
      cashfreeBank,
      [
        { typed: "A".repeat(100), then: "taken" },
        { typed: "A".repeat(101), then: cf("account_name_letters_only") },
        {
          typed: `Recording${" ".repeat(120)}Farmer`,
          then: "taken",
          sent: "Recording Farmer",
        },
        {
          typed: `${" ".repeat(60)}Recording Farmer${" ".repeat(60)}`,
          then: "taken",
          sent: "Recording Farmer",
        },
        {
          typed: `${"A".repeat(50)}${" ".repeat(100)}${"B".repeat(49)}`,
          then: "taken",
          sent: `${"A".repeat(50)} ${"B".repeat(49)}`,
        },
      ],
      { key: "name", most: 120 },
    ),
  );
  test(
    "V02 Cashfree account: the phone gives only what giveMyDestination's validator takes",
    agree(
      "cashfree",
      "bank",
      "account",
      cashfreeBank,
      [
        { typed: "9".repeat(35), then: "taken" },
        { typed: "9".repeat(36), then: cf("account_number_not_valid") },
        { typed: "99999 ".repeat(7).trim(), then: "taken", sent: "9".repeat(35) },
        { typed: ACCOUNT_41, then: cf("account_number_not_valid") },
      ],
      { key: "account_number", most: 40 },
    ),
  );
  test(
    "V03 Cashfree IFSC: the phone gives only what giveMyDestination's validator takes",
    agree(
      "cashfree",
      "bank",
      "ifsc",
      cashfreeBank,
      [
        { typed: CASHFREE_VALID.ifsc, then: "taken" },
        { typed: `   ${CASHFREE_VALID.ifsc}   `, then: "taken", sent: CASHFREE_VALID.ifsc },
        { typed: CASHFREE_VALID.ifsc.slice(0, 10), then: cf("ifsc_not_valid") },
        { typed: `${CASHFREE_VALID.ifsc}0`, then: cf("ifsc_not_valid") },
      ],
      { key: "ifsc", most: 20 },
    ),
  );
  test(
    "V04 Cashfree UPI ID: the phone refuses, after the scan, one longer than giveMyDestination's validator takes",
    agree(
      "cashfree",
      "upi",
      "upi",
      {},
      [
        { typed: upiOf(300), then: "taken" },
        { typed: upiOf(301), then: cf("upi_id_not_valid") },
        { typed: `  ${upiOf(300)}  `, then: "taken", sent: upiOf(300) },
        { typed: CASHFREE_VALID.upi, then: "taken" },
        { typed: "no-at-sign", then: cf("upi_id_not_valid") },
      ],
      { key: "upi_id", most: 300 },
    ),
  );
  test(
    "V05 Cashfree, the rest of her press (its key, AIAIC's notice version, her language, the kind, her tick): taken in en, mr and hi",
    agree(
      "cashfree",
      "bank",
      "name",
      cashfreeBank,
      [{ typed: CASHFREE_VALID.name, then: "taken" }],
      { key: "notice_version", most: 40, least: 3 },
      ["en", "mr", "hi"],
    ),
  );
  test(
    "V06 Route name on PAN: the phone gives only what givePayoutAccount's validator takes; her words go as its rule read them",
    agree(
      "route",
      "bank",
      "name",
      routeBank,
      [
        { typed: "A".repeat(100), then: "taken" },
        { typed: "A".repeat(101), then: rt("name_on_pan") },
        { typed: `Practice${" ".repeat(120)}Payee`, then: "taken", sent: "Practice Payee" },
        { typed: "Ab", then: "taken" },
        { typed: "A", then: rt("name_on_pan") },
      ],
      { key: "name_on_pan", most: 100, least: 2 },
    ),
  );
  test(
    "V07 Route PAN: the phone gives only what givePayoutAccount's validator takes",
    agree(
      "route",
      "bank",
      "pan",
      routeBank,
      [
        { typed: ROUTE_VALID.pan, then: "taken" },
        { typed: ROUTE_VALID.pan.toLowerCase(), then: "taken", sent: ROUTE_VALID.pan },
        { typed: ROUTE_VALID.pan.slice(0, 9), then: rt("pan") },
      ],
      { key: "pan", most: 20, least: 10 },
    ),
  );
  test(
    "V08 Route account: the phone gives only what givePayoutAccount's validator takes",
    agree(
      "route",
      "bank",
      "account",
      routeBank,
      [
        { typed: "9".repeat(20), then: "taken" },
        { typed: "9".repeat(21), then: rt("account_number") },
        { typed: "0001-2345-6789", then: "taken", sent: "000123456789" },
        { typed: "9".repeat(41), then: rt("account_number") },
      ],
      { key: "account_number", most: 40 },
    ),
  );
  test(
    "V09 Route IFSC: the phone gives only what givePayoutAccount's validator takes; the IFSC goes as its rule read it, its spaces out",
    agree(
      "route",
      "bank",
      "ifsc",
      routeBank,
      [
        { typed: ROUTE_VALID.ifsc, then: "taken" },
        { typed: "RECT 0000001", then: "taken", sent: ROUTE_VALID.ifsc },
        { typed: Array.from(ROUTE_VALID.ifsc).join(" "), then: "taken", sent: ROUTE_VALID.ifsc },
        { typed: ROUTE_VALID.ifsc.slice(0, 10), then: rt("ifsc") },
      ],
      { key: "ifsc", most: 20 },
    ),
  );
  test(
    "V10 Route UPI ID: the phone refuses, after the scan, one longer than givePayoutAccount's validator takes",
    agree(
      "route",
      "upi",
      "upi",
      routeUpi,
      [
        { typed: routeUpiOf(300), then: "taken" },
        { typed: routeUpiOf(301), then: rt("upi_id") },
        { typed: routeUpiOf(321), then: rt("upi_id") },
        { typed: ROUTE_VALID.upi, then: "taken" },
      ],
      { key: "upi_id", most: 300 },
    ),
  );
  test(
    "V11 Route, the rest of her press (its key, AIAIC's notice version, her language, the destination, her tick): taken in en, mr and hi",
    agree(
      "route",
      "bank",
      "name",
      routeBank,
      [{ typed: ROUTE_VALID.name, then: "taken" }],
      { key: "notice_version", most: 20, least: 3 },
      ["en", "mr", "hi"],
    ),
  );
  return learn;
}

// ------------------------------------------------------------------------------------------------ run

async function main() {
  const started = Date.now();
  let ready = false;
  try {
    // jsdom, as a normal dependency: a suite that cannot load it fails, and says why; it never skips
    const { JSDOM } = (await import("jsdom")) as {
      JSDOM: new (html: string, options: Record<string, unknown>) => { window: unknown };
    };
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
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
      name: "the suite starts: jsdom (a devDependency: `bun install` gives it) and the app's modules load",
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
        assert.deepEqual(
          outside,
          [],
          "nothing left this machine, and nothing was asked of the network",
        );
        assert.deepEqual(
          seen.unanswered,
          [],
          "no server function this suite does not answer was called",
        );
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
