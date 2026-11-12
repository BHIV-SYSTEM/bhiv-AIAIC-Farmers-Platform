/**
 * WHAT BUYERS SEE ABOUT HER, AND HER ONE CHOICE, DRIVEN AS SHE DRIVES IT (Round 2, R2-3 lane A part A-c, 13 Nov 2026; DESIGN
 * 5.2's A1 to A3 and DESIGN_UPDATE_2026-11-11 C.14's KA tests on her sharing).
 *
 * Run:  npx tsx tests/aiaic_sharing_dom_suite.ts   (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file;
 *       AIAIC_TEST_ONLY=A1,KA8 runs only the tests whose names start so)
 *
 * The REAL page (`routes/sharing.tsx`: `SharingPage`, the card of her listings page) is mounted in jsdom under React's
 * `act`, inside a TanStack Router of its own (memory history), and driven as she drives it: her finger lands on what she
 * taps, and she reads in her own language. jsdom does no layout: "at 360 wide" (the window is set so) is the walk's.
 *
 * WHAT ANSWERS HER PAGE, AND NOTHING LEAVES THIS MACHINE: AIAIC is a closed port of this machine; every connection and every
 * fetch is refused. Her page's server functions are answered in this process: who she is (`whoAmI`: a farmer signed in),
 * her sharing (`getMySharing`) through this server's own reading (`sharingForBrowser`) of AIAIC's RECORDED answer, and her
 * press (`shareMyName`, after its own validator) by AIAIC's RECORDED answers to that press, through this server's own
 * reading (`refusalOf` for a refusal).
 *
 * AIAIC'S RECORDINGS (never written by hand): her sharing as AIAIC's role recorder answered it at AIAIC's b4ebc76
 * (`reports/handover_tools/record_role_portal_answers.py`): `role_sharing_mine` (GET 200: a practice farmer, her name offered
 * and not given, her phone and village `field_not_held`), `role_sharing_given` (POST 201: her yes, shown in Marathi) and
 * `role_sharing_ended` (POST 200: her stop). HER FIXTURES DO NOT HOLD THEM YET (the re-recorder of R2-2 copied no sharing
 * answer): the main session copies them into tests/fixtures/aiaic under these names. Until then a run names AIAIC's
 * recorded_trade folder of that commit in `AIAIC_TEST_RECORDED_TRADE`, and each file read from there is held to the sha256
 * of its LF text at b4ebc76 (`PINNED`); a file in her fixtures is held to the trade manifest's sha256. With neither the
 * suite fails, naming the file: never a silent skip.
 *
 * DERIVED, IN MEMORY, AND SAID IN EACH TEST: the positions of AIAIC's settings no recording holds (the owner's direction of
 * 12 Nov: every default changeable, the app working in every position): her yes as AIAIC's next read says it after its 201
 * (her `shared: true`, its `since` and version from the recorded 201); a notice changed since her yes; names switched off
 * for buyers (`buyer_sees.farmer_name` off); the district switched off (`buyer_sees.district`: her state only); a real farmer
 * before the owner opens names (`not_open_yet`); a yes that stands while names are switched off; AIAIC's refusal of an old
 * version (`unknown_notice_version`, with its newer notice), each as AIAIC's `trade.sharing` writes it.
 *
 * NOT HERE, AND WHY: KA2, KA6, KA9 and KA10 hold boxes, typed words and a flow's steps in the address; this card has no box
 * and no typed word (her press carries none) and is one decision, not a flow with steps, so it writes nothing in the address
 * (KA3 below holds that nothing of hers goes there).
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
const SUITE = "aiaic_sharing_dom_suite";

/** `assert.ok` with a message always (given none, Node names another line under tsx). */
const ok: (value: unknown, message: string) => asserts value = (value, message) => {
  assert.equal(Boolean(value), true, message);
};
const said = (el: unknown) => {
  if (!el || typeof el !== "object" || !("tagName" in el)) return String(el);
  const e = el as Element;
  const id = e.getAttribute("data-testid");
  return `<${e.tagName.toLowerCase()}${id ? ` ${id}` : ""}> "${(e.textContent ?? "").trim().slice(0, 40)}"`;
};
const sameEl = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) assert.fail(`${message}: ${said(actual)}, not ${said(expected)}`);
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
/** The server functions a test called that this suite does not answer (the suite fills it). */
let unansweredCalls: () => string[] = () => [];
process.on("unhandledRejection", (e) => {
  rejections.push(String(e).split("\n")[0] ?? "");
});

// ------------------------------------------------------------------------- AIAIC's recordings, held to their bytes

/** The sha256 of each recording's LF text at AIAIC's b4ebc76 (`aiaic-frontend/src/test/recorded_trade/<name>.json`). */
const PINNED: Record<string, string> = {
  role_sharing_mine: "e5b69fe183232e793c66fd8ede19fb0d2a09aeba70ed20d583b2d29827b0a636",
  role_sharing_given: "ef9ca70584133081b0903580f267c6b5a7e767e453d62dac71cc372d5a1db54f",
  role_sharing_ended: "68bc7eaf603625b233548cf3958211619597d5d0354312cb43a454c33688e51c",
};
/** Where each recording was read from, said in the run's first test. */
const readFrom: Record<string, string> = {};
const lfSha = (file: string) =>
  createHash("sha256")
    .update(Buffer.from(fs.readFileSync(file, "utf-8").replace(/\r\n/g, "\n"), "utf-8"))
    .digest("hex");
function recording(name: string): Record<string, unknown> {
  const hers = path.join(FIXTURES, `${name}.json`);
  if (fs.existsSync(hers)) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, "trade_recording_manifest.json"), "utf-8"),
    ) as { files: Record<string, { sha256?: string }> };
    const held = manifest.files[`${name}.json`]?.sha256;
    ok(
      held,
      `${name}.json is in her fixtures but named by no manifest: copy it by the re-recorder`,
    );
    assert.equal(lfSha(hers), held, `${name}.json is not the file the trade manifest names`);
    readFrom[name] = "her fixtures (the trade manifest's sha256)";
    return JSON.parse(fs.readFileSync(hers, "utf-8")) as Record<string, unknown>;
  }
  const dir = process.env["AIAIC_TEST_RECORDED_TRADE"];
  ok(
    dir,
    `${name}.json: not in her fixtures yet (the main session copies AIAIC's recorded_trade/${name}.json there by the re-recorder); until then name AIAIC's recorded_trade folder of b4ebc76 in AIAIC_TEST_RECORDED_TRADE`,
  );
  const file = path.join(dir, `${name}.json`);
  ok(fs.existsSync(file), `${file}: not there`);
  assert.equal(lfSha(file), PINNED[name], `${file} is not AIAIC's recording at b4ebc76`);
  readFrom[name] = `AIAIC's recorded_trade at b4ebc76 (${dir}), its pinned sha256`;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
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
/** Each test runs inside the Start context the page's server functions are answered in (set by the suite). */
let around: ((fn: () => Promise<void>) => Promise<void>) | null = null;

type Lang = "en" | "mr" | "hi";
const LANGS: Lang[] = ["en", "mr", "hi"];

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
  const { Route: SharingRoute } = await import("../src/routes/sharing");
  const { whoAmI } = await import("../src/lib/aiaic-account.functions");
  const { getMySharing, shareMyName } = await import("../src/lib/aiaic-trade.functions");
  const { sharingForBrowser, refusalOf } = await import("../src/lib/aiaic-trade.server");
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
    SharingRoute,
    whoAmI,
    getMySharing,
    shareMyName,
    sharingForBrowser,
    refusalOf,
    problem,
    shared,
  };
}
type App = Awaited<ReturnType<typeof loadApp>>;

// ------------------------------------------------------------------------------------------------ the suite

function suite(app: App, window: Window & typeof globalThis) {
  const { React, DICTS, shared } = app;
  const { act, createElement: h } = React;
  const document = window.document;
  const words = (lang: Lang, key: string) => DICTS[lang][key] ?? DICTS.en[key] ?? key;
  const fill = (lang: Lang, key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      words(lang, key),
    );

  // --------------------------------------------- AIAIC's recorded answers, and the positions no recording holds
  const MINE = recording("role_sharing_mine");
  const GIVEN = recording("role_sharing_given");
  const ENDED = recording("role_sharing_ended");
  type Raw = {
    practice: boolean;
    real_names_open: boolean;
    notice: { version: string; en: string[]; mr: string[]; hi: string[] };
    fields: {
      field: string;
      offered: boolean;
      why_not: string | null;
      held_as: string | null;
      shared: boolean;
      since: string | null;
      version_given: string | null;
    }[];
    buyers_see_now: string[];
  };
  const mineRaw = () => JSON.parse(JSON.stringify(MINE["answer"])) as Raw;
  const givenAnswer = GIVEN["answer"] as { since: string; notice_version: string };
  const endedAnswer = ENDED["answer"] as { ended_at: string };
  const givenBody = (GIVEN["_recorded"] as { request: { body: Record<string, unknown> } }).request
    .body;
  const endedBody = (ENDED["_recorded"] as { request: { body: Record<string, unknown> } }).request
    .body;
  const nameOf = (r: Raw) => {
    const f = r.fields.find((x) => x.field === "name");
    ok(f, "AIAIC's answer names her name's field");
    return f;
  };
  /** DERIVED: her sharing as AIAIC's next read says it after its 201 (`trade.sharing.mine` over the kept row). */
  const derivedGiven = (): Raw => {
    const r = mineRaw();
    Object.assign(nameOf(r), {
      shared: true,
      since: givenAnswer.since,
      version_given: givenAnswer.notice_version,
    });
    return r;
  };
  /** DERIVED: one position of AIAIC's settings or her record, by `trade.sharing.why_not`'s own order. */
  const derived = (change: (r: Raw) => void): Raw => {
    const r = mineRaw();
    change(r);
    return r;
  };
  const world = {
    sharing: mineRaw() as Raw,
    /** her press's answer: AIAIC's recorded 201 or 200 by what she sent, else what a test sets */
    press: null as null | ((sent: Record<string, unknown>) => Promise<unknown> | unknown),
  };
  /** Each press she sent, as its validator let it through. */
  const presses: Record<string, unknown>[] = [];
  const recordedPress = (sent: Record<string, unknown>) => {
    const { key: _key, ...body } = sent;
    if (body["share"] === true) {
      assert.deepEqual(
        { field: body["field"], share: true, notice_version: body["notice_version"] },
        { field: givenBody["field"], share: true, notice_version: givenBody["notice_version"] },
        "her yes is the one AIAIC's recording answered",
      );
      world.sharing = derivedGiven();
      return {
        ok: true,
        data: {
          shared: true,
          since: givenAnswer.since,
          ended_at: null,
          notice_version: givenAnswer.notice_version,
          unchanged: false,
        },
      };
    }
    assert.deepEqual(body, endedBody, "her stop is the one AIAIC's recording answered");
    world.sharing = mineRaw();
    return {
      ok: true,
      data: {
        shared: false,
        since: null,
        ended_at: endedAnswer.ended_at,
        notice_version: null,
        unchanged: false,
      },
    };
  };

  const handlers = new Map<unknown, string>();
  const named = {
    whoAmI: app.whoAmI,
    getMySharing: app.getMySharing,
    shareMyName: app.shareMyName,
  };
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
              signedIn: true,
              username: "practice-farmer",
              displayName: null,
              signedOutNote: false,
              erasedNote: false,
            },
          };
        if (name === "getMySharing")
          return { ...ctx, result: { ok: true, data: app.sharingForBrowser(world.sharing) } };
        if (name === "shareMyName") {
          // the call's own validator first, as Start's RPC runs it on this server
          const sent = (await shared.inProcess(
            app.shareMyName,
            ctx["data"],
            "validator",
          )) as Record<string, unknown>;
          presses.push(sent);
          return { ...ctx, result: await (world.press ?? recordedPress)(sent) };
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
  const settle = async (ms = 150) => {
    const from = Date.now();
    for (let i = 0; i < 30 || Date.now() - from < ms; i++)
      await act(async () => {
        await turn();
      });
  };
  const tap = async (el: Element | null | undefined, what: string) => {
    ok(el, `there is ${what} to tap`);
    if (document.activeElement !== el)
      await act(async () => {
        (el as HTMLElement).focus();
      });
    await act(async () => {
      (el as HTMLElement).click();
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
  type Page = Awaited<ReturnType<typeof mount>>;
  const mount = async (lang: Lang, sharing: Raw) => {
    world.sharing = sharing;
    world.press = null;
    presses.length = 0;
    window.localStorage.clear();
    window.sessionStorage.clear();
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
    const page = app.SharingRoute.update({
      id: "/sharing",
      path: "/sharing",
      getParentRoute: () => root,
    } as never);
    const router = R.createRouter({
      routeTree: root.addChildren([page as never]),
      history: R.createMemoryHistory({ initialEntries: ["/sharing"] }),
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
    await waitFor(
      () => q('[data-testid="aiaic-sharing"]:not([data-state="reading"])'),
      "her card, read",
    );
    return {
      container,
      router,
      qc,
      q,
      card: () => q('[data-testid="aiaic-sharing"]'),
      choice: () => q('[data-testid="aiaic-share-name"]')?.getAttribute("data-choice") ?? null,
      verdict: () => q('[data-testid="aiaic-share-verdict"]'),
      give: () => q('[data-testid="aiaic-share-give-press"]') as HTMLButtonElement | null,
      stop: () => q('[data-testid="aiaic-share-stop-press"]') as HTMLButtonElement | null,
      answer: () => q('[data-testid="aiaic-share-answer"]'),
      text: () => container.textContent ?? "",
      unmount: async () => {
        await act(async () => reactRoot.unmount());
        container.remove();
        qc.clear();
      },
    };
  };
  /** A press made inside the Start context the page's server functions run in. */
  const press = (p: Page, el: Element | null | undefined, what: string) =>
    app.runWithStartContext({ startOptions: { functionMiddleware: [rpc] } } as never, () =>
      tap(el, what),
    );
  const shownWords = (p: Page) => p.verdict()?.getAttribute("data-shown") ?? null;
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
  /** Latin words a Marathi or Hindi screen of her card may carry: AIAIC's name, and the grievance contact AIAIC's notice
   *  names (AIAIC's own fill of its `AIAIC_GRIEVANCE_CONTACT` setting, the test desk and its address in this recording:
   *  the same words in every language of the notice). */
  const latinAllowed = () => {
    const n = (MINE["answer"] as Raw).notice;
    const contact = new Set((n.en[n.en.length - 1] ?? "").match(/[A-Za-z]{2,}/g) ?? []);
    const mrLast = new Set((n.mr[n.mr.length - 1] ?? "").match(/[A-Za-z]{2,}/g) ?? []);
    return new Set(["AIAIC", ...[...mrLast].filter((w) => contact.has(w))]);
  };
  const englishIn = (texts: string[]) => {
    const allowed = latinAllowed();
    return texts.flatMap((s) => (s.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !allowed.has(w)));
  };

  // ======================================================================================== A1, A2, A3

  test("A1 her card on AIAIC's recorded answer, not given: the verdict first (her name not shown), never her phone number, what buyers see behind one counted button with the fields AIAIC holds none of, and her one choice after AIAIC's notice", async () => {
    const raw = MINE["answer"] as Raw;
    assert.equal(nameOf(raw).offered, true, "the recording: her name offered");
    assert.equal(nameOf(raw).shared, false, "the recording: not given");
    for (const name of Object.keys(PINNED)) ok(readFrom[name], `${name} read: ${readFrom[name]}`);
    const p = await mount("en", mineRaw());
    try {
      assert.equal(p.choice(), "ask", "asked");
      assert.equal(shownWords(p), "no", "the verdict: not shown");
      ok(
        (p.verdict()?.textContent ?? "").includes(words("en", "aiaic.share.name_off")),
        "the verdict in words",
      );
      ok(p.text().includes(words("en", "aiaic.share.never_phone")), "never your phone number");
      const toggle = p.q('[data-testid="aiaic-share-sees-toggle"]');
      const notHeld = raw.fields.filter((f) => f.why_not === "field_not_held").length;
      assert.equal(notHeld, 2, "the recording: her phone and village not held");
      ok(
        (toggle?.textContent ?? "").includes(`(${raw.buyers_see_now.length + notHeld})`),
        `the button counts what is behind it: ${toggle?.textContent}`,
      );
      assert.equal(p.q('[data-testid="aiaic-share-sees"]'), null, "folded at first");
      await tap(toggle, "what buyers see");
      const items = [...p.container.querySelectorAll('[data-testid="aiaic-share-sees"] li')];
      assert.deepEqual(
        items
          .filter((li) => li.hasAttribute("data-code"))
          .map((li) => li.getAttribute("data-code")),
        raw.buyers_see_now,
        "each of AIAIC's codes, in its order",
      );
      for (const li of items) {
        const code = li.getAttribute("data-code");
        if (code)
          assert.equal(
            li.textContent,
            words("en", `aiaic.share.sees.${code}`),
            `${code} in her words`,
          );
      }
      assert.deepEqual(
        items.map((li) => li.getAttribute("data-not-held")).filter(Boolean),
        ["phone", "village"],
        "the fields AIAIC holds none of, said plainly",
      );
      const notice = p.q('[data-testid="aiaic-share-notice"]');
      assert.equal(
        notice?.getAttribute("data-version"),
        raw.notice.version,
        "AIAIC's notice, its version",
      );
      assert.equal(
        notice?.textContent,
        raw.notice.en.join(""),
        "every line of it, in her language",
      );
      ok(p.give(), "her yes");
      ok(p.q('[data-testid="aiaic-share-no"]'), "and her no");
      assert.equal(p.stop(), null, "nothing to stop");
      ok(
        (p.q('[data-testid="aiaic-share-give-part-shown_as"]')?.textContent ?? "").includes(
          words("en", "aiaic.share.practice_name"),
        ),
        "a practice farmer: buyers would see a practice name, never her own (before the owner opens names)",
      );
      assert.equal(presses.length, 0, "nothing sent by opening");
    } finally {
      await p.unmount();
    }
  });

  test("A1 \"on\" only after AIAIC's 201: while her press is on its way nothing says on; AIAIC's recorded 201, then its next read (DERIVED from it), say on; her stop is AIAIC's recorded 200, with no version", async () => {
    const p = await mount("en", mineRaw());
    try {
      let release: (() => void) | null = null;
      world.press = (sent) =>
        new Promise((done) => {
          release = () => done(recordedPress(sent));
        });
      await press(p, p.give(), "her yes");
      assert.equal(presses.length, 1, "one press sent");
      assert.equal(shownWords(p), "no", "on its way: not on");
      assert.equal(p.choice(), "ask", "on its way: still asked");
      assert.equal(p.stop(), null, "on its way: no stop offered");
      assert.equal(p.give()?.getAttribute("aria-disabled"), "true", "Sending...: held");
      ok((p.give()?.textContent ?? "").includes(words("en", "aiaic.kit.sending")), "Sending...");
      ok(release, "the press waits for AIAIC");
      await act(async () => {
        (release as unknown as () => void)();
      });
      await settle(300);
      assert.equal(shownWords(p), "yes", "after AIAIC's 201: on");
      ok(p.stop(), "her stop is offered");
      const done = `${fill("en", "aiaic.kit.done_on", { day: givenAnswer.since.slice(0, 10) })} ${words("en", "aiaic.share.done_on")}`;
      assert.equal(p.answer()?.textContent, done, "AIAIC's answer said, with its day");
      // her stop: one press, AIAIC's recorded 200, no version asked
      world.press = null;
      await press(p, p.stop(), "her stop");
      assert.equal(presses.length, 2, "her stop sent");
      const { key: _k, ...stop } = presses[1] as Record<string, unknown>;
      assert.deepEqual(
        stop,
        { field: "name", share: false },
        "a stop sends no version and no language",
      );
      assert.equal(shownWords(p), "no", "after AIAIC's 200: not shown");
      ok((p.answer()?.textContent ?? "").includes(words("en", "aiaic.share.done_off")), "said so");
    } finally {
      await p.unmount();
    }
  });

  test("A1 every position AIAIC's settings and her record can take (DERIVED from AIAIC's recorded answer by `trade.sharing`'s rule): not open yet, names switched off, a yes that stands while switched off, the district switched off, a notice changed since her yes (she is asked again), no name held, a code her app does not hold", async () => {
    const cases: { what: string; raw: Raw; choice: string; why?: string }[] = [
      {
        what: "a real farmer before the owner opens names (not_open_yet)",
        raw: derived((r) => {
          r.practice = false;
          Object.assign(nameOf(r), { offered: false, why_not: "not_open_yet" });
        }),
        choice: "held",
        why: "not_open_yet",
      },
      {
        what: "names switched off for buyers (buyer_sees.farmer_name off)",
        raw: derived((r) => Object.assign(nameOf(r), { offered: false, why_not: "switched_off" })),
        choice: "held",
        why: "switched_off",
      },
      {
        what: "no name held",
        raw: derived((r) =>
          Object.assign(nameOf(r), { offered: false, why_not: "no_name_held", held_as: null }),
        ),
        choice: "held",
        why: "no_name_held",
      },
      {
        what: "a code her app does not hold",
        raw: derived((r) =>
          Object.assign(nameOf(r), { offered: false, why_not: "a_code_not_held" }),
        ),
        choice: "held",
        why: "other",
      },
      {
        what: "her yes stands while names are switched off",
        raw: derived((r) =>
          Object.assign(nameOf(r), {
            offered: false,
            why_not: "switched_off",
            shared: true,
            since: givenAnswer.since,
            version_given: givenAnswer.notice_version,
          }),
        ),
        choice: "on_held",
        why: "switched_off",
      },
    ];
    for (const c of cases) {
      const p = await mount("en", c.raw);
      try {
        assert.equal(p.choice(), c.choice, `${c.what}: ${c.choice}`);
        assert.equal(shownWords(p), "no", `${c.what}: buyers do not see her name`);
        ok(
          p.text().includes(words("en", `aiaic.share.why.${c.why}`)),
          `${c.what}: AIAIC's reason in her words`,
        );
        ok(p.text().includes(words("en", "aiaic.share.never_phone")), `${c.what}: never her phone`);
        if (c.choice === "on_held") ok(p.stop(), `${c.what}: she can still stop`);
        else
          assert.equal(
            p.q('[data-testid="aiaic-share-notice"]'),
            null,
            `${c.what}: no notice to agree to`,
          );
      } finally {
        await p.unmount();
      }
    }
    // the district switched off: buyers read her state, and the card says so
    const state = await mount(
      "en",
      derived((r) => {
        r.buyers_see_now = r.buyers_see_now.map((c) => (c === "district" ? "state" : c));
      }),
    );
    try {
      ok(
        (state.q('[data-testid="aiaic-share-give-part-shown_as"]')?.textContent ?? "").length > 0,
        "what buyers would see",
      );
      await tap(state.q('[data-testid="aiaic-share-sees-toggle"]'), "what buyers see");
      ok(
        state.text().includes(words("en", "aiaic.share.sees.state")),
        "her state, not her district",
      );
      assert.ok(!state.text().includes(words("en", "aiaic.share.sees.district")), "no district");
    } finally {
      await state.unmount();
    }
    // a notice changed since her yes: asked again, and her yes goes with the CURRENT version
    const older = derived((r) =>
      Object.assign(nameOf(r), {
        shared: false,
        since: givenAnswer.since,
        version_given: "shn-000000000000",
      }),
    );
    const again = await mount("en", older);
    try {
      assert.equal(again.choice(), "ask", "asked again");
      ok(again.q('[data-testid="aiaic-share-again"]'), "the words changed since her yes: said");
      assert.equal(
        shownWords(again),
        "no",
        "her name not shown until she says yes again (Q7's default)",
      );
      await press(again, again.give(), "her yes again");
      assert.equal(
        presses[0]?.["notice_version"],
        (MINE["answer"] as Raw).notice.version,
        "her yes goes with the current notice's version",
      );
      assert.equal(shownWords(again), "yes", "on after AIAIC's answer");
    } finally {
      await again.unmount();
    }
  });

  test("A2 the notice in her language, its version sent back with her press: in Marathi and Hindi AIAIC's own lines; her press says the version and the language shown; AIAIC's refusal of an old version (DERIVED, `unknown_notice_version` with its newer notice) shows the newer words, and her next press sends their version", async () => {
    const raw = MINE["answer"] as Raw;
    for (const lang of ["mr", "hi"] as const) {
      const p = await mount(lang, mineRaw());
      try {
        const notice = p.q('[data-testid="aiaic-share-notice"]');
        assert.equal(notice?.textContent, raw.notice[lang].join(""), `${lang}: AIAIC's own lines`);
        await press(p, p.give(), "her yes");
        assert.equal(presses.length, 1, `${lang}: her press passed this server's door, once`);
        const { key: _k, ...body } = presses[0] as Record<string, unknown>;
        assert.deepEqual(
          body,
          { field: "name", share: true, notice_version: raw.notice.version, shown_in: lang },
          `${lang}: the version and the language she was shown`,
        );
      } finally {
        await p.unmount();
      }
    }
    // the recorded 201 was given to the press shown in Marathi
    assert.deepEqual(
      { notice_version: givenBody["notice_version"], shown_in: givenBody["shown_in"] },
      { notice_version: raw.notice.version, shown_in: "mr" },
      "AIAIC's recorded yes: the same version, shown in Marathi",
    );
    const p = await mount("mr", mineRaw());
    try {
      const newer = JSON.parse(JSON.stringify(raw.notice)) as Raw["notice"];
      newer.version = "shn-111111111111";
      newer.mr[1] = `${newer.mr[1]} (बदल)`;
      world.press = (sent) =>
        sent["notice_version"] === raw.notice.version
          ? {
              ok: false,
              problem: app.refusalOf(409, {
                detail: {
                  reason_code: "unknown_notice_version",
                  message:
                    "The notice changed since it was shown: read the notice again (it is in this answer, as `notice`), then choose. Nothing was changed.",
                  notice: newer,
                  values: { field: "notice_version", notice_version: newer.version },
                },
              }),
            }
          : recordedPressFor(sent, newer.version);
      await press(p, p.give(), "her yes, to an old version");
      assert.equal(shownWords(p), "no", "refused: not on");
      const shown = p.q('[data-testid="aiaic-share-notice"]');
      assert.equal(shown?.getAttribute("data-version"), newer.version, "the newer notice shown");
      assert.equal(shown?.textContent, newer.mr.join(""), "its words, in her language");
      ok(
        (p.answer()?.textContent ?? "").includes(words("mr", "aiaic.share.changed_now")),
        "said that the words changed, in her language",
      );
      await press(p, p.give(), "her yes, to the newer words");
      assert.equal(presses.length, 2, "a second press");
      assert.equal(
        presses[1]?.["notice_version"],
        newer.version,
        "her next press sends the newer version",
      );
      assert.notEqual(presses[1]?.["key"], presses[0]?.["key"], "a new press: a new key");
    } finally {
      await p.unmount();
    }
  });
  /** AIAIC's recorded 201 for a yes to another version: the same answer with that version (DERIVED). */
  const recordedPressFor = (sent: Record<string, unknown>, version: string) => {
    world.sharing = derived((r) => {
      r.notice.version = version;
      Object.assign(nameOf(r), { shared: true, since: givenAnswer.since, version_given: version });
    });
    assert.equal(sent["notice_version"], version, "the version AIAIC holds now");
    return {
      ok: true,
      data: {
        shared: true,
        since: givenAnswer.since,
        ended_at: null,
        notice_version: version,
        unchanged: false,
      },
    };
  };

  test("A3 \"never your phone number\" kept in every state and language; no English word on her Marathi and Hindi screens of it, hidden text and the page's title included (but AIAIC, and the grievance contact AIAIC's notice names)", async () => {
    const states: [string, () => Raw][] = [
      ["asked", mineRaw],
      ["on", derivedGiven],
      [
        "held",
        () => derived((r) => Object.assign(nameOf(r), { offered: false, why_not: "switched_off" })),
      ],
      [
        "on_held",
        () =>
          derived((r) =>
            Object.assign(nameOf(r), {
              offered: false,
              why_not: "switched_off",
              shared: true,
              since: givenAnswer.since,
            }),
          ),
      ],
    ];
    for (const lang of LANGS)
      for (const [state, raw] of states) {
        const p = await mount(lang, raw());
        try {
          ok(
            p.text().includes(words(lang, "aiaic.share.never_phone")),
            `${lang} ${state}: never your phone number`,
          );
          await tap(p.q('[data-testid="aiaic-share-sees-toggle"]'), "what buyers see");
          if (lang !== "en")
            assert.deepEqual(
              englishIn(everyText(p.container)),
              [],
              `${lang} ${state}: no English word`,
            );
        } finally {
          await p.unmount();
        }
      }
    for (const key of Object.keys(DICTS.en).filter((k) => k.startsWith("aiaic.share."))) {
      for (const lang of LANGS) ok(DICTS[lang][key], `${key}: words in ${lang}`);
      const blanks = (s: string) => [...s.matchAll(/\{[a-z_]+\}/g)].map((m) => m[0]).sort();
      assert.deepEqual(
        blanks(DICTS.mr[key] ?? ""),
        blanks(DICTS.en[key] ?? ""),
        `${key}: mr, the same blanks`,
      );
      assert.deepEqual(
        blanks(DICTS.hi[key] ?? ""),
        blanks(DICTS.en[key] ?? ""),
        `${key}: hi, the same blanks`,
      );
    }
  });

  // ======================================================================================== the kit's tests on her card

  test("KA1 opening her card moves no focus, nor does AIAIC's read arriving; after AIAIC answers her press, the focus is on its answer", async () => {
    const before = document.activeElement;
    const p = await mount("en", mineRaw());
    try {
      sameEl(document.activeElement, before, "opening the page moves no focus");
      await press(p, p.give(), "her yes");
      const target = p.q('[data-testid="aiaic-share-said"]');
      ok(target, "AIAIC's answer");
      sameEl(document.activeElement, target, "the focus on AIAIC's answer");
      ok(p.answer()?.getAttribute("role") === "status", "said as a status");
    } finally {
      await p.unmount();
    }
  });

  test("KA3 nothing of hers goes in the address or the phone's storage: her name as AIAIC holds it, the notice's version, her answer", async () => {
    const p = await mount("en", mineRaw());
    try {
      await press(p, p.give(), "her yes");
      await press(p, p.stop(), "her stop");
      const held = String(nameOf(MINE["answer"] as Raw).held_as);
      const entries =
        JSON.stringify(p.router.history.location) + JSON.stringify(p.router.state.location);
      for (const v of [held, (MINE["answer"] as Raw).notice.version, "share"])
        assert.ok(!entries.includes(v), `${v}: not in the address`);
      const stored =
        JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage });
      for (const v of [held, (MINE["answer"] as Raw).notice.version])
        assert.ok(!stored.includes(v), `${v}: kept nowhere on the phone`);
    } finally {
      await p.unmount();
    }
  });

  test("KA4 each state is said in words, never by colour alone: the verdict's words for shown and not shown, AIAIC's reason for a held press", async () => {
    const on = await mount("en", derivedGiven());
    const off = await mount("en", mineRaw());
    try {
      assert.equal(
        on.verdict()?.textContent,
        words("en", "aiaic.share.name_on"),
        "shown: in words",
      );
      assert.equal(
        off.verdict()?.textContent,
        words("en", "aiaic.share.name_off"),
        "not shown: in words",
      );
      assert.notEqual(
        on.verdict()?.textContent,
        off.verdict()?.textContent,
        "the two told apart by their words",
      );
    } finally {
      await on.unmount();
      await off.unmount();
    }
  });

  test("KA5 her press names its action, never Continue; one press sends one request with one key though she presses twice; a press that got no answer says Try again and sends the same key; after AIAIC's answer, no other card opens", async () => {
    const p = await mount("en", mineRaw());
    try {
      assert.equal(p.give()?.textContent, words("en", "aiaic.share.yes"), "the action, named");
      assert.notEqual(p.give()?.textContent, words("en", "aiaic.kit.continue"), "never Continue");
      // a lost answer: AIAIC did not answer (the press's call threw); its key is kept
      world.press = () => {
        throw new Error("the connection dropped");
      };
      await press(p, p.give(), "her yes");
      assert.equal(presses.length, 1, "sent once");
      ok(
        (p.give()?.textContent ?? "").includes(
          fill("en", "aiaic.kit.try_again_named", { action: words("en", "aiaic.share.yes") }),
        ),
        "Try again, naming the press",
      );
      assert.equal(shownWords(p), "no", "no answer: not on");
      world.press = null;
      // two quick presses: one request, the SAME key as the lost one
      const give = p.give();
      ok(give, "her yes");
      await app.runWithStartContext(
        { startOptions: { functionMiddleware: [rpc] } } as never,
        async () => {
          await act(async () => {
            give.click();
            give.click();
          });
          await settle(300);
        },
      );
      assert.equal(presses.length, 2, "one more request for two presses");
      assert.equal(presses[1]?.["key"], presses[0]?.["key"], "the same press: its same key");
      assert.equal(shownWords(p), "yes", "on after AIAIC's answer");
      assert.equal(
        p.container.querySelectorAll('[data-testid="aiaic-sharing"]').length,
        1,
        "one card",
      );
      assert.equal(
        p.container.querySelectorAll('[role="dialog"]').length,
        0,
        "no other card opens",
      );
    } finally {
      await p.unmount();
    }
  });

  test("KA7 every word of her card in en, mr and hi (A3 holds the screens); her card's own words name no English beside AIAIC on a Marathi screen of each state (A3)", async () => {
    const keys = Object.keys(DICTS.en).filter((k) => k.startsWith("aiaic.share."));
    assert.ok(keys.length >= 40, `her card's words: ${keys.length}`);
    for (const key of keys)
      for (const lang of ["mr", "hi"] as const) {
        // (a blank, `{day}`, is filled with a figure: not a word on her screen)
        const latin =
          (DICTS[lang][key] ?? "").replace(/\{[a-z_]+\}/g, "").match(/[A-Za-z]{2,}/g) ?? [];
        assert.deepEqual(
          latin.filter((w) => w !== "AIAIC"),
          [],
          `${key}: no English word in ${lang}`,
        );
      }
  });

  test("KA8 a press AIAIC holds shut (names switched off: DERIVED) stays visible and reachable, aria-disabled with AIAIC's reason named by aria-describedby; pressed, it says why again and sends nothing", async () => {
    const p = await mount(
      "en",
      derived((r) => Object.assign(nameOf(r), { offered: false, why_not: "switched_off" })),
    );
    try {
      const b = p.give();
      ok(b, "her yes is there");
      assert.equal(b.hasAttribute("disabled"), false, "never the disabled attribute");
      assert.equal(b.getAttribute("aria-disabled"), "true", "aria-disabled");
      assert.ok(b.tabIndex >= 0, "reachable by Tab");
      const reason = document.getElementById(String(b.getAttribute("aria-describedby")));
      assert.equal(
        reason?.textContent,
        words("en", "aiaic.share.why.switched_off"),
        "its reason, named",
      );
      await press(p, b, "her yes, held");
      assert.equal(presses.length, 0, "nothing sent");
      assert.equal(reason?.getAttribute("role"), "alert", "said again");
    } finally {
      await p.unmount();
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
