/**
 * THE STORAGE STEPS STAY ON THE SCREEN, BY REAL TAPS IN A REAL BROWSER (the audit of 1 Nov 2026, F32).
 *
 * A gate above a page that writes its own address unmounted that page at every choice: a tap on a district skipped the taluka and Next,
 * focus fell to the body, and on a slow network the steps left the screen for the scan's whole time. A test that reads source or renders
 * parts cannot see a remount. This one walks the page in headless Chrome at phone width, in Marathi, on a fresh phone, and watches the one
 * element: if it is ever replaced or leaves the screen, this fails.
 *
 * Needs the app running against an AIAIC API (no sign-in, nothing is written to AIAIC):
 *   ANNAPOORNA_URL=http://127.0.0.1:5192 npx tsx tests/verify_storage_steps_stay_by_taps.ts
 * Each scan and each other POST of the app is held back for SLOW_MS on the second walk, as a slow network holds them.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME =
  process.env["CHROME_PATH"] ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env["ANNAPOORNA_URL"] ?? "http://127.0.0.1:5192";
const PORT = Number(process.env["CDP_PORT"] ?? 9334);
const SLOW_MS = 1500;
const CRISIS_WORDS = "जगायचे नाही आता संपवायचे आहे";

type Json = Record<string, any>;

class Page {
  private next = 1;
  private waiting = new Map<number, (v: Json) => void>();
  private listeners: ((method: string, params: Json) => void)[] = [];
  private constructor(private ws: WebSocket) {
    ws.onmessage = (event) => {
      const m = JSON.parse(String(event.data)) as Json;
      if (m["id"]) {
        this.waiting.get(m["id"])?.(m["error"] ? { error: m["error"] } : m["result"]);
        this.waiting.delete(m["id"]);
      } else for (const l of this.listeners) l(m["method"], m["params"]);
    };
  }
  static open(url: string): Promise<Page> {
    const ws = new WebSocket(url);
    return new Promise((resolve, reject) => {
      ws.onopen = () => resolve(new Page(ws));
      ws.onerror = reject;
    });
  }
  send(method: string, params: Json = {}): Promise<Json> {
    const id = this.next++;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(listener: (method: string, params: Json) => void) {
    this.listeners.push(listener);
  }
  async js<T>(expression: string): Promise<T> {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r["exceptionDetails"]) throw new Error(JSON.stringify(r["exceptionDetails"]).slice(0, 400));
    return r["result"]["value"] as T;
  }
  close() {
    this.ws.close();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(page: Page, what: string, expression: string, ms = 25000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const got = await page.js<T>(expression);
    if (got) return got;
    if (Date.now() > end) throw new Error(`waited ${ms} ms for: ${what}`);
    await sleep(120);
  }
}

/** A real tap, by the browser's own touch input, at the middle of the element: nothing is clicked from inside the page. */
async function tap(page: Page, selector: string) {
  const at = await page.js<{ x: number; y: number } | null>(`(() => {
    const e = ${selector}; if (!e) return null;
    e.scrollIntoView({ block: "center" });
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!at) throw new Error(`nothing to tap: ${selector}`);
  await sleep(150);
  const again = await page.js<{ x: number; y: number }>(`(() => {
    const r = (${selector}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  const point = [{ x: again.x, y: again.y }];
  await page.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point });
  await sleep(40);
  await page.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const q = (s: string) => `document.querySelector(${JSON.stringify(s)})`;
const stateOf = (n: number) => `${q(`[data-testid="store-step-${n}"]`)}?.dataset.state`;

/** The page's own record: the steps element it first saw, and each frame it was gone or replaced. */
const WATCH = `(() => {
  window.__steps = { first: null, replaced: 0, gone: 0 };
  const tick = () => {
    const now = document.querySelector('[data-testid="store-steps"]');
    const s = window.__steps;
    if (now && !s.first) s.first = now;
    else if (now && now !== s.first) { s.replaced += 1; s.first = now; }
    else if (!now && s.first) s.gone += 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const failures: string[] = [];
function check(ok: unknown, what: string) {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
}

async function openPhone(version: Json, slow: boolean, lang = "mr"): Promise<Page> {
  const made = (await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })
  ).json()) as Json;
  const page = await Page.open(made["webSocketDebuggerUrl"]);
  void version;
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 360,
    height: 740,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    // a fresh phone for each walk: one browser's tabs share what the last walk saved
    source: `try { localStorage.removeItem("aiaic.farm"); localStorage.setItem("aiaic.lang", ${JSON.stringify(lang)}); } catch (e) {}`,
  });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: WATCH });
  if (slow) {
    // a server function's address is an id, not its name: every POST of the app is held, the scan among them
    await page.send("Fetch.enable", { patterns: [{ urlPattern: "*/_serverFn/*" }] });
    page.on((method, params) => {
      if (method !== "Fetch.requestPaused") return;
      const wait = params["request"]["method"] === "POST" ? SLOW_MS : 0;
      setTimeout(
        () => void page.send("Fetch.continueRequest", { requestId: params["requestId"] }),
        wait,
      );
    });
  }
  return page;
}

async function walk(version: Json, slow: boolean) {
  const label = slow ? `scans held ${SLOW_MS} ms` : "plain";
  const page = await openPhone(version, slow);
  await page.send("Page.navigate", { url: `${BASE}/storage` });
  await until(
    page,
    "the districts",
    `${q('[data-testid="store-districts"] button')} !== null`,
    60000,
  );
  check((await page.js(stateOf(1))) === "open", `${label}: step 1 is open on a fresh phone`);

  await tap(
    page,
    `[...document.querySelectorAll('[data-testid="store-districts"] button')].find((b) => /सांगली/.test(b.textContent))`,
  );
  await until(
    page,
    "the district's own line",
    `${q('[data-testid="store-place-chosen"]')} !== null`,
  );
  await sleep(slow ? SLOW_MS + 1200 : 1500);
  check((await page.js(stateOf(1))) === "open", `${label}: the district tapped, step 1 stays open`);
  check(
    await page.js(`${q('[data-testid="store-place-chosen"]')}?.textContent.includes("सांगली")`),
    `${label}: it names the district`,
  );
  check(
    await page.js(`${q('[data-testid="aiaic-taluka"]')} !== null`),
    `${label}: its taluka box is on the screen`,
  );
  check(await page.js(`${q('[data-testid="store-place-next"]')} !== null`), `${label}: and Next`);

  await tap(page, q('[data-testid="store-place-next"]'));
  await until(page, "step 2 open", `${stateOf(2)} === "open"`);
  await sleep(600);
  check(
    await page.js(`document.activeElement === ${q('[data-testid="store-step-2"] h2')}`),
    `${label}: Next takes the screen and a screen reader to the step that opens`,
  );

  await until(page, "the crops", `${q('[data-testid="store-crops"] button')} !== null`);
  await tap(
    page,
    `[...document.querySelectorAll('[data-testid="store-crops"] button')].find((b) => /गहू|ज्वारी|तूर|हळद/.test(b.textContent))`,
  );
  await until(
    page,
    "step 3 open, or the answer",
    `${stateOf(3)} === "open" || ${stateOf(4)} === "open"`,
  );
  await sleep(slow ? SLOW_MS + 600 : 800);
  const at = await page.js<string>(stateOf(3));
  if (at === "open") {
    check(
      await page.js(`document.activeElement === ${q('[data-testid="store-step-3"] h2')}`),
      `${label}: the crop tapped, focus moves on`,
    );
    await tap(page, `${q('[data-testid="store-step-3"] button')}`);
  }
  await until(
    page,
    "the answer",
    `${q('[data-testid="store-answer"]')} !== null || ${q('[data-testid="store-step-4"]')}?.dataset.state === "open"`,
    60000,
  );
  await sleep(800);

  const seen = await page.js<{ replaced: number; gone: number }>(
    `({ replaced: window.__steps.replaced, gone: window.__steps.gone })`,
  );
  check(seen.replaced === 0, `${label}: the steps were never replaced (${seen.replaced} times)`);
  check(seen.gone === 0, `${label}: the steps never left the screen (${seen.gone} frames)`);
  page.close();
}

/**
 * A tap removes the button it landed on, and the long list under a scrolled page (F39): focus fell to the body, and for a district low in
 * the list the chosen line stood above the screen with the taluka's label under the sticky header. The list's own places, top and bottom.
 */
async function aTapShowsWhatItChose(version: Json, position: "first" | "last" | number) {
  const label = `district ${position} in the list`;
  const page = await openPhone(version, false);
  await page.send("Page.navigate", { url: `${BASE}/storage` });
  await until(
    page,
    "the districts",
    `${q('[data-testid="store-districts"] button')} !== null`,
    60000,
  );
  const all = `[...document.querySelectorAll('[data-testid="store-districts"] button')]`;
  const at =
    position === "last"
      ? `${all}.at(-1)`
      : position === "first"
        ? `${all}[0]`
        : `${all}[${position}]`;
  await tap(page, at);
  await until(page, "the chosen line", `${q('[data-testid="store-place-chosen"]')} !== null`);
  await sleep(500);
  const seen = await page.js<Record<string, number | boolean>>(`(() => {
    const chosen = ${q('[data-testid="store-place-chosen"]')}.getBoundingClientRect();
    const box = ${q('[data-testid="aiaic-taluka"]')}.getBoundingClientRect();
    const next = ${q('[data-testid="store-place-next"]')}.getBoundingClientRect();
    const head = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    return { focused: document.activeElement === ${q('[data-testid="store-place-chosen"]')}, head,
      chosenTop: chosen.top, boxBottom: box.bottom, nextBottom: next.bottom, height: window.innerHeight };
  })()`);
  check(seen["focused"], `${label}: focus stands on the chosen line`);
  check(
    Number(seen["chosenTop"]) >= Number(seen["head"]),
    `${label}: the chosen line is below the sticky header (${seen["chosenTop"]} from ${seen["head"]})`,
  );
  check(
    Number(seen["nextBottom"]) <= Number(seen["height"]),
    `${label}: the taluka and Next are on the screen (Next ends at ${seen["nextBottom"]} of ${seen["height"]})`,
  );
  await tap(page, q('[data-testid="store-place-other"]'));
  await until(page, "the list again", `${q('[data-testid="store-districts"] button')} !== null`);
  await sleep(400);
  const back = await page.js<Record<string, number | boolean>>(`(() => {
    const line = ${q('[data-testid="store-district-label"]')};
    return { focused: document.activeElement === line, top: line.getBoundingClientRect().top,
      head: document.querySelector("header")?.getBoundingClientRect().bottom ?? 0 };
  })()`);
  check(back["focused"], `${label}: Another district takes focus to the list`);
  check(Number(back["top"]) >= Number(back["head"]), `${label}: and its line is on the screen`);
  page.close();
}

async function crisisStillTakesThePage(version: Json) {
  const page = await openPhone(version, false);
  await page.send("Page.navigate", {
    url: `${BASE}/storage?crop=${encodeURIComponent(CRISIS_WORDS)}`,
  });
  await until(page, "the crisis card", `${q("[data-crisis]")} !== null`, 30000);
  check(
    await page.js(`${q('[data-testid="store-steps"]')} === null`),
    "a crisis in the address: the card alone",
  );
  check(
    !(await page.js<string>("document.body.innerText")).includes(CRISIS_WORDS),
    "and the words are not printed",
  );
  page.close();
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aiaic_steps_"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--disable-gpu",
      "--no-first-run",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let code = 1;
  try {
    let version: Json | null = null;
    for (let i = 0; i < 50 && !version; i++) {
      await sleep(200);
      version = await fetch(`http://127.0.0.1:${PORT}/json/version`)
        .then((r) => r.json() as Promise<Json>)
        .catch(() => null);
    }
    if (!version) throw new Error("Chrome did not answer");
    await walk(version, false);
    await walk(version, true);
    for (const position of ["first", 17, 23, 29, "last"] as const)
      await aTapShowsWhatItChose(version, position);
    await crisisStillTakesThePage(version);
    console.log(`\n${failures.length ? `${failures.length} FAILED` : "all held"}`);
    code = failures.length ? 1 : 0;
  } catch (e) {
    console.log(`FAIL the walk stopped: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    chrome.kill();
    await sleep(600);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* Chrome may hold a file for a moment: a temp folder */
    }
  }
  process.exit(code);
}

void main();
