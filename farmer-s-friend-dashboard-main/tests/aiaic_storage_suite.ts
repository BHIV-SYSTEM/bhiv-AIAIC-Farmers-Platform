/**
 * Annapoorna's storage page (/storage): the rules, held.
 *
 * Run:  npx tsx tests/aiaic_storage_suite.ts   (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file)
 *
 * - The storage_plan_*.sample.json fixtures are real: what a local AIAIC answered on a test database, on the committed price
 *   slice judged at its own day (cotton in Dhar: Store, at Medium; tur in Akola: Sell now, at Medium; mataki in Sangli, wheat and
 *   soybean in Nashik: Not sure, their figures leaning one way under a band of Low; tomato: Sell now by a fixed rule; onion: Not sure, no published
 *   rate, published wastage; lentil: Not sure, no recent price; wheat on the calendar: Not sure, the newest price too old).
 *   They are samples: a test database's prices, never shown to a farmer; each is the file AIAIC recorded, byte for byte
 *   (recording_manifest.sample.json, held below). places_*.json are AIAIC's recorded answers.
 * - The parts of the page are rendered on the server, as the other suites do, so what is asserted is what the page writes.
 * - Calls to AIAIC go to a stand-in `fetch`: no request leaves this process and no port is opened.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterContextProvider,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";

import { AnswerAtAGlance } from "../src/components/farm/aiaic/AnswerAtAGlance";
import { CrisisOnly } from "../src/components/farm/aiaic/CrisisFirst";
import { BigSelect } from "../src/components/farm/BigSelect";
import { StorageCardBody } from "../src/components/farm/aiaic/StorageVerdictCard";
import { monthRuns, monthX, wholeRupees } from "../src/components/farm/aiaic/storage/storage-chart";
import {
  PlanEmpty,
  PlanFailed,
  StorageAnswer,
} from "../src/components/farm/aiaic/storage/StorageAnswer";
import {
  MonthsChart,
  StoragePriceChart,
  YearsChart,
} from "../src/components/farm/aiaic/storage/StoragePriceChart";
import {
  CropStep,
  PlaceStep,
  QuantityStep,
  StepRow,
  type ListRead,
} from "../src/components/farm/aiaic/storage/StorageSteps";
import {
  CROPS_FIRST,
  EXAMPLE,
  MAX_QUANTITY_Q,
  QUANTITY_CHIPS,
  choiceFrom,
  cropIn,
  cropStands,
  cropsOffered,
  farmWith,
  firstToDo,
  keyAssumed,
  planHolds,
  planShown,
  quantityFits,
  regionStands,
  quantityTyped,
  searchOf,
  warehousePlaces,
  type StoreChoice,
} from "../src/lib/aiaic-storage";
import { ADDRESS_KEYS, addressWords, farmToSave, heldOfAddress } from "../src/lib/aiaic-address";
import { plainNumber } from "../src/lib/aiaic-heard";
import { farmSearchSchema, type FarmSearch } from "../src/lib/aiaic-query";
import { problem, type AiaicProblem, type StoragePlan } from "../src/lib/aiaic-trade";
import * as client from "../src/lib/aiaic-trade.server";
import * as identity from "../src/lib/aiaic-identity.server";
import { farmKept, type SavedFarm } from "../src/lib/farm-storage";
import { DICTS, I18nProvider } from "../src/lib/i18n";
import type { CropItem, DistrictItem } from "../src/lib/places.functions";
import { Route as StorageRoute } from "../src/routes/storage";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(here, "fixtures", "aiaic");
const APP = path.join(here, "..");

/**
 * `assert.ok` with a message always: given none, Node reads the test's source to write one, and on this file a failing check
 * then hangs for minutes instead of failing.
 */
const ok: (value: unknown, message?: string) => asserts value = (value, message) => {
  assert.equal(Boolean(value), true, message ?? "expected a true value");
};

const sample = (name: string) =>
  JSON.parse(
    fs.readFileSync(path.join(FIXTURES, `storage_plan_${name}.sample.json`), "utf-8"),
  ) as StoragePlan;
const recorded = <T>(name: string) =>
  (JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf-8")) as { answer: T })
    .answer;
const sourceOf = (file: string) => fs.readFileSync(path.join(APP, file), "utf-8");

const SOY = sample("soybean_nashik_en");
const WHEAT = sample("wheat_nashik_en");
const ONION = sample("onion_nashik_en");
// mataki in Sangli reads Not sure: its figures lean to storing, under a band of Low. What was written for a store stands on it.
const STORE = sample("mataki_sangli_en");
// the real Store and Sell now of these prices, each at Medium
const COTTON = sample("cotton_dhar_en");
const COTTON_MR = sample("cotton_dhar_mr");
const COTTON_HI = sample("cotton_dhar_hi");
const TUR = sample("tur_akola_en");
const TOMATO = sample("tomato_nashik_en");
const TOMATO_MR = sample("tomato_nashik_mr");
const TOMATO_HI = sample("tomato_nashik_hi");
const SOY_MR = sample("soybean_nashik_mr");
const ONION_MR = sample("onion_nashik_mr");
const STORE_MR = sample("mataki_sangli_mr");
const SOY_HI = sample("soybean_nashik_hi");
const ONION_HI = sample("onion_nashik_hi");
const STORE_HI = sample("mataki_sangli_hi");
const NO_PRICE = sample("lentil_nashik_en");
const TOO_OLD = sample("wheat_nashik_prices_too_old_en");
const NO_PRICE_HI = sample("lentil_nashik_hi");
const TOO_OLD_MR = sample("wheat_nashik_prices_too_old_mr");
const PLANS = {
  mataki: STORE,
  soybean: SOY,
  wheat: WHEAT,
  onion: ONION,
  cotton: COTTON,
  tur: TUR,
};
const LANGUAGES = [
  ["mr", SOY_MR],
  ["mr", ONION_MR],
  ["mr", STORE_MR],
  ["mr", TOO_OLD_MR],
  ["hi", SOY_HI],
  ["hi", ONION_HI],
  ["hi", STORE_HI],
  ["hi", NO_PRICE_HI],
] as const;

// ------------------------------------------------------------------------------------------- the runner

type Result = { name: string; ok: boolean; ms: number; error?: string };
const results: Result[] = [];
const tests: { name: string; run: () => void | Promise<void> }[] = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

// -------------------------------------------------------------------------------- rendering on the server

/** React's own escaping of a text, so a sentence is found in the page as it is written there. */
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
const unesc = (s: string) =>
  s
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");

const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

/** A part of a page in English, with a router and a query cache around it, its texts joined. */
function page(el: ReactElement, queries?: QueryClient, lang: "en" | "mr" | "hi" = "en"): string {
  const withQueries = createElement(QueryClientProvider, {
    client: queries ?? new QueryClient(),
    children: createElement(I18nProvider, { initialLang: lang, children: el }),
  });
  return renderToString(
    createElement(RouterContextProvider, { router: router as never, children: withQueries }),
  ).replaceAll("<!-- -->", "");
}

/** The same page in another language. */
function pageIn(lang: "mr" | "hi", el: ReactElement): string {
  return page(el, undefined, lang);
}

/** What a page says: its texts, one to a line, the chart's text alternative and the table's cells included. */
const textsOf = (html: string) =>
  [...html.matchAll(/aria-label="([^"]*)"/g), ...html.matchAll(/>([^<>]+)</g)]
    .map((m) => unesc(m[1] ?? "").trim())
    .filter(Boolean);

/** The slice of a page from one test id to the next one named, to read one part alone. */
function partOf(html: string, from: string, to?: string): string {
  const at = html.indexOf(`data-testid="${from}"`);
  ok(at >= 0, `no ${from} on the page`);
  const end = to ? html.indexOf(`data-testid="${to}"`, at) : -1;
  return html.slice(at, end > at ? end : undefined);
}

function stringsOf(v: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof v === "string") into.add(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsOf(x, into));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => stringsOf(x, into));
  return into;
}

function numbersOf(v: unknown, into: number[] = []): number[] {
  if (typeof v === "number") into.push(v);
  else if (Array.isArray(v)) v.forEach((x) => numbersOf(x, into));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => numbersOf(x, into));
  return into;
}

/** Latin words a page's frame may say in Marathi or Hindi: names only, as the catalogue's own rule. */
const LATIN_ALLOWED = new Set(["AIAIC", "OpenStreetMap", "contributors"]);

/** The Latin words of a page that are not AIAIC's own sentences or names: the frame's. */
function frameLatin(html: string, plan: StoragePlan): string[] {
  const held = [...stringsOf(plan)].sort((a, b) => b.length - a.length);
  const left: string[] = [];
  for (const text of textsOf(html)) {
    let rest = text;
    for (const s of held) if (s && rest.includes(s)) rest = rest.replaceAll(s, " ");
    for (const w of rest.match(/[A-Za-z]{2,}/g) ?? []) if (!LATIN_ALLOWED.has(w)) left.push(w);
  }
  return left;
}

const answer = (plan: StoragePlan) => createElement(StorageAnswer, { plan });

// ------------------------------------------------------------------------- A. the answer, in the design's order

test("S1 the answer's order is the design's: verdict, tiles, prices, map, wastage, cold stores, Details", () => {
  for (const [name, plan] of Object.entries(PLANS)) {
    const html = page(answer(plan));
    const at = [
      "store-verdict",
      "store-tiles",
      "store-prices",
      "store-public",
      "store-wastage",
      "store-cold",
      "store-details",
    ].map((id) => html.indexOf(`data-testid="${id}"`));
    ok(
      at.every((v) => v >= 0),
      `${name}: a part is missing: ${at}`,
    );
    assert.deepEqual(
      [...at].sort((a, b) => a - b),
      at,
      `${name}: the parts are out of order: ${at}`,
    );
    ok(html.includes('lang="en"'), `${name}: the answer names its language`);
  }
});

test("S2 the verdict line is the first indicator, large, with its note; each of the three answers keeps its code", () => {
  const codes = {
    mataki: "unsure",
    soybean: "unsure",
    wheat: "unsure",
    onion: "unsure",
    cotton: "store",
    tur: "sell_now",
  };
  for (const [name, plan] of Object.entries(PLANS)) {
    const html = page(answer(plan));
    const head = plan.indicators[0];
    ok(head);
    assert.equal(head.key, "verdict");
    const line = partOf(html, "store-verdict", "store-tiles");
    assert.match(line, /text-3xl/, "large");
    ok(line.includes(esc(head.value)), `${name}: its value`);
    ok(line.replace(/<[^>]+>/g, "").includes(esc(head.note ?? "")), `${name}: its note`);
    ok(line.includes(`data-code="${codes[name as keyof typeof codes]}"`), name);
    ok(line.includes(`data-tone="${head.tone}"`), name);
  }
});

test("S3 the verdict's key assumptions and 'not yet checked' stay in plain view, outside Details", () => {
  const html = page(answer(STORE));
  const line = partOf(html, "store-verdict", "store-tiles");
  const said = (STORE.card?.verdict.assumptions ?? []).filter((a) =>
    ["loss_assumed", "quantity_example"].includes(a.code),
  );
  assert.equal(said.length, 2, "the sample assumes a loss and an example quantity");
  for (const a of said) ok(line.includes(esc(a.text ?? "")), a.code);
  ok(line.includes(esc(STORE.card?.verdict.uncalibrated ?? "")));
  // onion assumes nothing: no empty row of chips
  ok(!page(answer(ONION)).includes('data-testid="store-verdict-assumed"'));
});

test("S4 the tiles are the rest of the indicators in the order sent, each with label, value and note as sent; one left out is not there", () => {
  for (const [name, plan] of Object.entries(PLANS)) {
    const tiles = partOf(page(answer(plan)), "store-tiles", "store-prices");
    const keys = [...tiles.matchAll(/data-testid="store-tile-([a-z_]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      keys,
      plan.indicators.slice(1).map((x) => x.key),
      `${name}: the order sent`,
    );
    for (const x of plan.indicators.slice(1)) {
      const tile = partOf(tiles, `store-tile-${x.key}`);
      ok(tile.includes(esc(x.label)), `${name} ${x.key}: label`);
      ok(tile.replace(/<\/?span[^>]*>/g, "").includes(esc(x.value)), `${name} ${x.key}: value`);
      if (x.note) ok(tile.includes(esc(x.note)), `${name} ${x.key}: note`);
    }
  }
  ok(!page(answer(ONION)).includes('data-testid="store-tile-net_gain"'), "onion has none");
  const soy = page(answer(SOY));
  const list = soy.slice(0, soy.indexOf('data-testid="store-tiles"'));
  assert.match(list.slice(list.lastIndexOf("<ul")), /grid-cols-2[^"]*md:grid-cols-4/);
});

test("S5 a tone is never colour alone: its own icon, its border and its words", () => {
  const tiles = partOf(page(answer(ONION)), "store-tiles", "store-prices");
  const tileOf = (key: string) => {
    const from = tiles.indexOf(`data-testid="store-tile-${key}"`);
    const next = tiles.indexOf('data-testid="store-tile-', from + 10);
    return tiles.slice(tiles.lastIndexOf("<li", from), next > 0 ? next : undefined);
  };
  const good = tileOf("price_now");
  ok(good.includes("border-primary") && good.includes("Good sign"), "good");
  assert.match(good, /lucide-circle-check/);
  const warn = tileOf("wastage");
  ok(warn.includes("border-warning") && warn.includes("Take care"), "warn");
  assert.match(warn, /lucide-triangle-alert/);
  const neutral = tileOf("distance");
  ok(!neutral.includes("Good sign") && !neutral.includes("Take care"), "neutral");
  assert.match(neutral, /lucide-info/);
});

test("S6 months: a band, the usual line, the two marked months with their figures, today's price on its own month, the short names", () => {
  const html = page(createElement(MonthsChart, { prices: SOY.prices as never }));
  const p = SOY.prices;
  ok(p);
  assert.equal([...html.matchAll(/data-testid="store-chart-band"/g)].length, 1, "one band");
  assert.equal([...html.matchAll(/data-testid="store-chart-line"/g)].length, 1, "one line");
  assert.equal(
    [...html.matchAll(/data-testid="store-chart-month-name"/g)].length,
    12,
    "twelve names",
  );
  for (const m of p.months) ok(html.includes(`>${m.short}<`), m.short);
  ok(html.includes('data-testid="store-chart-mark-best"'));
  ok(html.includes('data-testid="store-chart-mark-lowest"'));
  assert.equal([...html.matchAll(/data-testid="store-chart-month"/g)].length, 10, "ten dots");
  ok(partOf(html, "store-chart-best-figure").includes(wholeRupees(5161.5)));
  ok(partOf(html, "store-chart-low-figure").includes(wholeRupees(4620)));
  ok(partOf(html, "store-chart-now").includes(p.now?.text ?? "?"), "today's price");
  // the latest price sits in its own month's place (September, by its day)
  assert.equal(p.now?.day, "2026-09-24");
  const dot = /data-testid="store-chart-now"[^>]*><circle cx="([0-9.]+)"/.exec(html);
  ok(dot, "the dot");
  ok(Math.abs(Number(dot[1]) - monthX(9)) < 0.01, `on its own month: ${dot[1]}`);
});

test("S7 the chart has a text alternative: the frame's sentence and AIAIC's own; every figure is also in a table", () => {
  const html = page(createElement(StoragePriceChart, { prices: SOY.prices }));
  const p = SOY.prices;
  ok(p);
  const alt = /role="img" aria-label="([^"]*)"/.exec(html)?.[1] ?? "";
  for (const s of [p.best_month?.text, p.lowest_month?.text, p.now?.against_text])
    ok(alt.includes(esc(s ?? "?")), `alternative: ${s}`);
  const table = partOf(html, "store-chart-table");
  assert.match(
    html.slice(html.lastIndexOf("<details", html.indexOf("store-chart-table"))),
    /^<details/,
  );
  assert.equal([...table.matchAll(/data-testid="store-chart-row"/g)].length, 12);
  for (const m of p.months) ok(table.includes(wholeRupees(m.usual_rs)), m.name);
});

test("S8 a month not held is a gap: no name, no figure, the line broken and never joined across it", () => {
  const p = SOY.prices;
  ok(p);
  const months = p.months.filter((m) => m.month !== 5);
  assert.deepEqual(
    monthRuns(months).map((r) => r.map((m) => m.month)),
    [
      [1, 2, 3, 4],
      [6, 7, 8, 9, 10, 11, 12],
    ],
  );
  const html = page(createElement(MonthsChart, { prices: { ...p, months } }));
  assert.equal([...html.matchAll(/data-testid="store-chart-line"/g)].length, 2, "two lines");
  assert.equal([...html.matchAll(/data-testid="store-chart-month-name"/g)].length, 11);
  ok(!html.includes(">May<"));
  // a month alone is a band of its own, drawn with no line to join
  const alone = page(
    createElement(MonthsChart, {
      prices: { ...p, months: p.months.filter((m) => m.month === 3), best_month: null },
    }),
  );
  assert.equal([...alone.matchAll(/data-testid="store-chart-line"/g)].length, 0);
  assert.equal([...alone.matchAll(/data-testid="store-chart-band"/g)].length, 1);
});

test("S9 years: one row per year, the average's figure, a year part held dashed, hollow, starred and said", () => {
  const p = SOY.prices;
  ok(p);
  const html = page(createElement(YearsChart, { prices: p }));
  const rows = [...html.matchAll(/data-testid="store-chart-year" data-partial="(yes|no)"/g)];
  assert.equal(rows.length, p.years.length);
  assert.deepEqual(
    rows.map((m) => m[1]),
    p.years.map((y) => (y.partial ? "yes" : "no")),
  );
  for (const y of p.years) {
    ok(html.includes(y.partial ? `>${y.year}*<` : `>${y.year}<`), `${y.year}`);
    ok(html.includes(`>${wholeRupees(y.average_rs)}<`), `${y.year}: its average`);
  }
  const at = html.indexOf('data-partial="yes"');
  const part = html.slice(at, html.indexOf("</g>", at));
  ok(part.includes('stroke-dasharray="4 3"'), "dashed");
  ok(part.includes('fill="var(--card)"'), "hollow");
  const before = html.indexOf('data-partial="no"');
  const whole = html.slice(before, html.indexOf("</g>", before));
  ok(!whole.includes("stroke-dasharray"), "a whole year is not dashed");
  ok(html.includes(esc(DICTS.en["aiaic.store.chart.partial"] ?? "?")), "said in the key");
  const alt = /role="img" aria-label="([^"]*)"/.exec(html)?.[1] ?? "";
  ok(alt.includes(esc(DICTS.en["aiaic.store.chart.partial"] ?? "?")), "and in the text");
  // no year part held: nothing about it
  const done = { ...p, years: p.years.filter((y) => !y.partial) };
  ok(!page(createElement(YearsChart, { prices: done })).includes("archives stop"));
});

test("S10 under the chart: the two months, where today's price sits, the note and the sources, in that order", () => {
  const p = SOY.prices;
  ok(p);
  const html = page(createElement(StoragePriceChart, { prices: p }));
  const order = [
    p.best_month?.text,
    p.lowest_month?.text,
    p.now?.against_text,
    p.note,
    p.sources[0]?.text,
    p.sources[1]?.text,
  ].map((s) => html.indexOf(esc(s ?? "?"), html.indexOf('data-testid="store-chart-key"')));
  ok(
    order.every((v) => v > 0),
    `${order}`,
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
  ok(html.includes('aria-pressed="true"'), "the switch says which is shown");
  ok(html.indexOf("store-chart-show-months") < html.indexOf("store-chart-show-years"));
  ok(html.includes('data-testid="store-chart-months"'), "Months first");
});

test("S11 no history held: AIAIC's headline instead of a chart, its note still shown; no prices at all is said", () => {
  const p = SOY.prices;
  ok(p);
  const none = {
    ...p,
    held: false,
    headline: "No past prices are held here.",
    months: [],
    years: [],
    best_month: null,
    lowest_month: null,
    now: null,
  };
  const html = page(createElement(StoragePriceChart, { prices: none }));
  ok(html.includes('data-testid="store-prices-none"'));
  ok(html.includes(none.headline));
  ok(html.includes(esc(p.note ?? "?")), "the note, always");
  ok(!html.includes('role="img"') && !html.includes("store-chart-switch"), "no chart");
  ok(!html.includes("store-chart-table"));
  const missing = page(createElement(StoragePriceChart, { prices: null }));
  ok(missing.includes(esc(DICTS.en["aiaic.store.chart.none"] ?? "?")));
});

test("S12 the map: the chosen warehouse named with its operator and distance, every placed warehouse listed, no map said in words", () => {
  const card = SOY.card;
  ok(card);
  const html = page(answer(SOY));
  const said = partOf(html, "store-chosen", "store-map");
  ok(said.includes("Ambad") && said.includes("MSWC") && said.includes("9 km"), said);
  const places = warehousePlaces(card);
  ok(places.length >= 2);
  assert.equal(places.filter((p) => p.kind === "chosen").length, 1, "one chosen");
  const map = partOf(html, "store-map", "store-wastage");
  for (const p of places) ok(map.includes(esc(p.label ?? "?")), `${p.label}`);
  const noPoints = { ...card, warehouses: card.warehouses.map((w) => ({ ...w, point: null })) };
  const bare = page(answer({ ...SOY, card: noPoints }));
  ok(bare.includes('data-testid="store-map-none"'));
  ok(bare.includes(esc(DICTS.en["aiaic.store.map_none"] ?? "?")));
});

test("S13 wastage: AIAIC's sentence; what institutes published behind a small fold, only when there is any", () => {
  const dry = partOf(page(answer(SOY)), "store-wastage", "store-cold");
  ok(dry.includes('data-kind="dry"'));
  ok(dry.includes(esc(SOY.wastage?.headline ?? "?")));
  ok(!dry.includes("store-wastage-published"), "nothing published for soybean");
  const onion = partOf(page(answer(ONION)), "store-wastage", "store-cold");
  ok(onion.includes('data-kind="with_loss"'));
  ok(onion.includes(esc(ONION.wastage?.headline ?? "?")));
  const fold = onion.indexOf('data-testid="store-wastage-published"');
  ok(onion.lastIndexOf("<details", fold) > 0, "behind a fold");
  ok(onion.includes(esc(ONION.wastage?.published[0]?.text ?? "?")));
});

test("S14 cold stores: headline, rows, how many not named, the rate that does not exist in plain view, caveat and source", () => {
  const cold = SOY.cold_storages;
  ok(cold);
  const html = partOf(page(answer(SOY)), "store-cold", "store-details");
  ok(html.includes(esc(cold.headline ?? "?")));
  assert.equal([...html.matchAll(/data-testid="store-cold-row"/g)].length, cold.near.length);
  for (const r of cold.near) {
    ok(html.includes(esc(r.name)), r.name);
    for (const part of [r.capacity_text, r.where_text, r.year_text])
      ok(html.includes(esc(part ?? "?")), `${part}`);
  }
  const order = [cold.not_named_text, cold.rate_text, cold.caveat, cold.source].map((s) =>
    html.indexOf(esc(s ?? "?")),
  );
  ok(
    order.every((v) => v > 0),
    `${order}`,
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
  const at = html.indexOf('data-testid="store-cold-rate"');
  ok(!html.slice(0, at).includes("<details"), "not folded");
  const tag = html.slice(html.lastIndexOf("<p", at), at);
  ok(tag.includes("text-base") && tag.includes("font-bold"), "not small print");
});

test("S15 one Details holds the card: the other warehouses, the rule, the assumptions and the sources, with no second map or fold", () => {
  const card = SOY.card;
  ok(card);
  const html = page(answer(SOY));
  const fold = html.slice(html.indexOf('data-testid="store-details"'));
  ok(html.lastIndexOf("<details", html.indexOf('data-testid="store-details"')) > 0);
  for (const w of card.warehouses)
    ok(fold.includes(esc(w.place_shown || w.name_shown || w.name)), w.name);
  ok(fold.includes(esc(card.verdict.chosen_by?.text ?? "?")), "the rule");
  for (const a of card.verdict.assumptions ?? []) ok(fold.includes(esc(a.text ?? "?")), a.code);
  for (const s of card.sources) ok(fold.includes(esc(s.text ?? "?")), `${s.text}`);
  ok(!fold.includes('data-testid="storage-map"'), "the page has its one map");
  ok(!fold.includes("aria-expanded"), "no fold inside the fold");
  // the card elsewhere keeps its map and its fold
  const alone = page(createElement(StorageCardBody, { card }));
  ok(alone.includes('data-testid="storage-map"'));
  ok(alone.includes('aria-expanded="false"'));
  ok(!alone.includes(esc(card.verdict.chosen_by?.text ?? "?")), "folded there");
});

test("S16 no figure is made up: every rupee figure on the page is one AIAIC sent", () => {
  for (const [name, plan] of [
    ...Object.entries(PLANS),
    ["soybean mr", SOY_MR] as const,
    ["soybean hi", SOY_HI] as const,
    ["mataki hi", STORE_HI] as const,
  ]) {
    const held = new Set<string>();
    const strings = [...stringsOf(plan)];
    for (const n of numbersOf(plan)) held.add(wholeRupees(n));
    const html = page(answer(plan));
    const year = page(createElement(YearsChart, { prices: plan.prices as never }));
    const seen = new Set(
      [...`${html}${year}`.matchAll(/₹[0-9][0-9,]*(?:\.[0-9]+)?/g)].map((m) => m[0]),
    );
    ok(seen.size > 20, `${name}: only ${seen.size} figures`);
    for (const f of seen)
      ok(held.has(f) || strings.some((s) => s.includes(f)), `${name}: ${f} is not AIAIC's`);
  }
  // a half goes to the even rupee, as AIAIC's own sentences round it: the tile says ₹5,162 for 5161.5
  assert.equal(wholeRupees(5161.5), "₹5,162");
  assert.equal(wholeRupees(5162.5), "₹5,162");
  assert.equal(wholeRupees(4620), "₹4,620");
  assert.equal(wholeRupees(159200.4), "₹1,59,200");
  ok(SOY.prices?.best_month?.text.includes(wholeRupees(SOY.prices.best_month.usual_rs)));
});

// ------------------------------------------------------------------------------- B. Marathi and Hindi

test("S17 a Marathi or Hindi page: the frame says no English word; the check itself finds English on an English page", () => {
  for (const [lang, plan] of LANGUAGES) {
    const html = pageIn(lang, answer(plan));
    assert.deepEqual(frameLatin(html, plan), [], `${lang}: ${plan.crop}`);
    const years = pageIn(lang, createElement(YearsChart, { prices: plan.prices as never }));
    assert.deepEqual(frameLatin(years, plan), [], `${lang}: ${plan.crop}`);
    // AIAIC's own sentences on the verdict and the tiles are in the language too: no Latin word there at all
    const head = partOf(html, "store-verdict", "store-prices");
    for (const text of textsOf(head))
      assert.deepEqual(text.match(/[A-Za-z]{2,}/g) ?? [], [], `${lang}: ${plan.crop}: ${text}`);
  }
  // the steps and the failures, which AIAIC has no words in: no Latin word at all
  const noWords = { busy: false, onRetry: () => undefined, advice: null };
  for (const el of [
    placeStep(NOTHING, listOf<DistrictItem>([])),
    placeStep(NOTHING, listOf<DistrictItem>([], { reading: true })),
    placeStep(NOTHING, listOf<DistrictItem>([], { failed: true })),
    createElement(QuantityStep, { value: 37, onChoose: () => undefined }),
    createElement(CropStep, {
      crops: listOf(CROPS.crops),
      firstPage: [],
      chosen: "",
      onChoose: () => undefined,
    }),
    createElement(StepRow, {
      n: 1,
      title: "",
      state: "done",
      summary: "",
      onChange: () => undefined,
    }),
    createElement(PlanFailed, { problem: problem("not_found"), ...noWords }),
    createElement(PlanFailed, { problem: null, ...noWords }),
    createElement(PlanEmpty, noWords),
  ])
    for (const lang of ["mr", "hi"] as const)
      for (const text of textsOf(pageIn(lang, el)))
        assert.deepEqual(
          (text.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => w !== "AIAIC"),
          [],
          `${lang}: ${text}`,
        );
  // the same check, on the same answer with an English frame: it must find the frame's words
  const planted = frameLatin(page(answer(SOY_MR)), SOY_MR);
  ok(planted.includes("Details") && planted.includes("Months"), `${planted.slice(0, 8)}`);
});

test("S18 a Marathi answer says it awaits a native reader, and the same in Hindi's words; a server's language note is shown", () => {
  const html = pageIn("mr", answer(SOY_MR));
  ok(html.includes('lang="mr"'));
  ok(html.includes(esc(DICTS.mr["aiaic.store.review_note"] ?? "?")));
  ok(pageIn("hi", answer(SOY_HI)).includes(DICTS.hi["aiaic.store.review_note"] ?? "?"));
  ok(!page(answer(SOY)).includes('data-testid="store-review-note"'));
  const note = page(answer({ ...SOY, lang_note: "Shown in English." }));
  ok(partOf(note, "store-lang-note").includes("Shown in English."));
});

test("S19 every frame word is in en, mr and hi, with the same blanks, and mr and hi carry no English word", () => {
  const keys = Object.keys(DICTS.en).filter((k) => k.startsWith("aiaic.store."));
  ok(keys.length > 70, `only ${keys.length}`);
  keys.push("aiaic.taluka.failed", "aiaic.refused.crop_required");
  keys.push("aiaic.refused.quantity_out_of_range");
  const blanks = (s: string) => (s.match(/\{[a-z_]+\}/g) ?? []).sort().join(",");
  for (const lang of ["mr", "hi"] as const) {
    for (const key of keys) {
      const line = DICTS[lang][key];
      ok(line, `${lang} has no ${key}`);
      assert.equal(blanks(line), blanks(DICTS.en[key] ?? ""), `${lang} ${key}`);
      for (const w of line.replace(/\{[a-z_]+\}/g, "").match(/[A-Za-z]+/g) ?? [])
        assert.equal(w, "AIAIC", `${lang} ${key}: English word "${w}"`);
    }
  }
});

// --------------------------------------------------------------------------- C. the steps and what they remember

const NOTHING: StoreChoice = { state: "mh", region: "", taluka: "", crop: "", quantity: null };
const FARM: SavedFarm = {
  state: "mp",
  region: "indore",
  crop: "soybean",
  land: "4",
  mandi: "APMC Indore",
  services: "market,storage",
  taluka: "Mhow",
  talukaOf: "indore",
  storeQuantity: "25",
};

test("S20 a returning farmer lands on the answer: the saved farm fills every step", () => {
  const c = choiceFrom({}, FARM);
  assert.deepEqual(c, {
    state: "mp",
    region: "indore",
    taluka: "Mhow",
    crop: "soybean",
    quantity: 25,
  });
  assert.equal(firstToDo(c), 4);
  // a farm saved by /ask or /result has no quantity: the labelled example, straight to the answer
  const { storeQuantity: _none, ...noQuantity } = FARM;
  assert.equal(choiceFrom({}, noQuantity).quantity, EXAMPLE);
  assert.equal(firstToDo(choiceFrom({}, noQuantity)), 4);
  assert.equal(choiceFrom({}, { ...FARM, storeQuantity: EXAMPLE }).quantity, EXAMPLE);
});

test("S21 the steps open in turn: nothing known, step 1; a place, step 2; a crop, step 3; a quantity, the answer", () => {
  assert.equal(firstToDo(choiceFrom({}, null)), 1);
  assert.deepEqual(choiceFrom({}, null), NOTHING);
  assert.equal(firstToDo({ ...NOTHING, region: "nashik" }), 2);
  assert.equal(firstToDo({ ...NOTHING, region: "nashik", crop: "onion" }), 3);
  assert.equal(firstToDo({ ...NOTHING, region: "nashik", crop: "onion", quantity: 10 }), 4);
  assert.equal(firstToDo({ ...NOTHING, region: "nashik", crop: "onion", quantity: EXAMPLE }), 4);
  assert.equal(firstToDo(choiceFrom({ region: "nashik" }, null)), 2, "a link with a place only");
});

test("S22 a link's own words win; what was saved for one district is never carried to another", () => {
  const same = choiceFrom({ crop: "wheat", region: "INDORE" }, FARM);
  assert.equal(same.crop, "wheat", "the link's crop");
  assert.equal(same.taluka, "Mhow", "the same district, whatever its case: its taluka stays");
  assert.equal(same.quantity, 25);
  const other = choiceFrom({ region: "ujjain", state: "mp" }, FARM);
  assert.deepEqual(
    { crop: other.crop, taluka: other.taluka },
    { crop: "", taluka: "" },
    "nothing of Indore goes to Ujjain",
  );
  assert.equal(firstToDo(other), 2, "the crop is asked again");
  assert.equal(choiceFrom({ taluka: "Sanwer" }, FARM).taluka, "Sanwer");
  assert.equal(
    choiceFrom({}, { ...FARM, talukaOf: "ujjain" }).taluka,
    "",
    "a taluka of another district is not used",
  );
  assert.equal(choiceFrom({ state: "madhya pradesh", region: "indore" }, null).state, "mp");
});

test("S23 a quantity kept is used only when it could be sent", () => {
  for (const bad of ["0", "-5", "abc", "100001", ""]) {
    const q = choiceFrom({}, { ...FARM, storeQuantity: bad }).quantity;
    assert.equal(q, EXAMPLE, `${bad}: not kept`);
  }
  assert.equal(choiceFrom({}, { ...FARM, storeQuantity: "100000" }).quantity, MAX_QUANTITY_Q);
  assert.equal(choiceFrom({}, { ...FARM, storeQuantity: "12.5" }).quantity, 12.5);
  ok(quantityFits(0.5) && !quantityFits(0) && !quantityFits(100_000.5));
  ok(!quantityFits(Number.NaN) && !quantityFits(null) && !quantityFits("10"));
  assert.deepEqual([...QUANTITY_CHIPS], [10, 25, 50, 100]);
});

test("S24 what is chosen goes into the same saved farm; the rest of it stays; a mandi goes with its district", () => {
  const stays = farmWith(FARM, { ...choiceFrom({}, FARM), quantity: 50 });
  assert.deepEqual(stays, { ...FARM, storeQuantity: "50" });
  const moved = farmWith(FARM, {
    state: "mh",
    region: "nashik",
    taluka: "",
    crop: "onion",
    quantity: EXAMPLE,
  });
  assert.equal(moved.mandi, undefined, "Indore's mandi is not Nashik's");
  assert.equal(moved.land, "4");
  assert.equal(moved.services, "market,storage");
  assert.equal(moved.taluka, "");
  assert.equal(moved.talukaOf, "");
  assert.equal(moved.storeQuantity, EXAMPLE);
  assert.deepEqual(choiceFrom({}, moved), {
    state: "mh",
    region: "nashik",
    taluka: "",
    crop: "onion",
    quantity: EXAMPLE,
  });
  assert.deepEqual(farmWith(null, { ...NOTHING, region: "nashik" }), {
    state: "mh",
    region: "nashik",
    crop: "",
    taluka: "",
    talukaOf: "",
    storeQuantity: "",
  });
});

test("S25 /ask and /result saving the farm keep what only the storage page knows, and a state with its own district", () => {
  // /result's save for the same farm: no taluka, no quantity, no state in its address
  const fromResult = farmKept(FARM, { region: "indore", crop: "soybean", services: "storage" });
  assert.equal(fromResult.storeQuantity, "25");
  assert.equal(fromResult.taluka, "Mhow");
  assert.equal(fromResult.state, "mp", "the state stays with its district");
  assert.deepEqual(choiceFrom({}, fromResult), choiceFrom({}, FARM));
  // /ask's save for another district: its own state, the old taluka not used there
  const fromAsk = farmKept(FARM, { region: "nashik", crop: "onion", state: "mh", services: "x" });
  assert.equal(choiceFrom({}, fromAsk).taluka, "", "Mhow is not in Nashik");
  assert.equal(choiceFrom({}, fromAsk).state, "mh");
  assert.equal(farmKept(FARM, { region: "nashik" }).state, undefined, "another district, no state");
  // a save that names a blank clears it; nothing saved before: as given
  assert.equal(farmKept(FARM, { region: "indore", taluka: "" }).taluka, "");
  assert.deepEqual(farmKept(null, { region: "nashik" }), { region: "nashik" });
});

test("S26 the address holds the place and crop, so a reload or Back finds the same page", () => {
  assert.deepEqual(searchOf({ ...NOTHING, region: "nashik", crop: "onion", quantity: 10 }), {
    state: "mh",
    region: "nashik",
    crop: "onion",
  });
  assert.deepEqual(searchOf(NOTHING), { state: "mh" });
  assert.deepEqual(searchOf(choiceFrom({}, FARM)), {
    state: "mp",
    region: "indore",
    taluka: "Mhow",
    crop: "soybean",
  });
});

const CROPS = recorded<{ crops: CropItem[]; first_page: string[] }>("places_crops_nashik_mh_mr");

test("S27 the crop step (AIAIC's recorded Nashik): the first page in AIAIC's order, twelve buttons, the rest behind More, nothing named twice", () => {
  const { crops, first_page: firstPage } = CROPS;
  ok(firstPage.length > CROPS_FIRST, "Nashik's first page is long");
  const { first, more } = cropsOffered(crops, firstPage, "");
  assert.equal(first.length, CROPS_FIRST);
  assert.deepEqual(
    first.map((c) => c.crop),
    firstPage.slice(0, CROPS_FIRST),
    "AIAIC's order, onion first",
  );
  assert.equal(first[0]?.crop, "onion");
  const all = [...first, ...more];
  assert.equal(new Set(all.map((c) => c.name_en)).size, all.length, "no product twice");
  for (const twin of crops.filter((c) => c.first_page_shown_as))
    ok(!all.includes(twin), `${twin.crop} is named under ${twin.first_page_shown_as}`);
  ok(all.length < crops.length && all.length >= firstPage.length);
  // a crop chosen further down stays in view
  const late = firstPage[40] ?? "";
  const kept = cropsOffered(crops, firstPage, late);
  assert.equal(kept.first.length, CROPS_FIRST + 1);
  assert.equal(kept.first[CROPS_FIRST]?.crop, late);
  ok(!kept.more.some((c) => c.crop === late));
  // a district with no record of a crop grown (a city): the crops held
  assert.equal(cropsOffered(crops, [], "").first.length, CROPS_FIRST);
  // a saved crop is found by label or plain name, whatever its case; one not offered is not
  assert.equal(cropIn(crops, "ONION")?.crop, "onion");
  assert.equal(cropIn(crops, "Moong")?.name, "मूग");
  assert.equal(cropIn(crops, "saffron"), null);
  ok(cropStands(crops, "onion") && !cropStands(crops, "saffron"));
  ok(cropStands(crops, ""), "no crop yet: nothing to check");
  ok(cropStands([], "saffron"), "no list read: AIAIC reads the crop itself");
});

const DISTRICTS = recorded<{ districts: DistrictItem[] }>("places_districts_mh_en").districts;
const listOf = <T>(rows: readonly T[], over: Partial<ListRead<T>> = {}): ListRead<T> => ({
  rows,
  reading: false,
  failed: false,
  onRetry: () => undefined,
  ...over,
});
const placeStep = (choice: StoreChoice, districts: ListRead<DistrictItem>) =>
  createElement(PlaceStep, {
    choice,
    districts,
    districtName: "",
    onState: () => undefined,
    onDistrict: () => undefined,
    onTaluka: () => undefined,
    onNext: () => undefined,
  });

test("S28 step 1 is big buttons: the two states, then every district in the reader's language; the chosen ones pressed", () => {
  const html = page(placeStep({ ...NOTHING, region: "nashik" }, listOf(DISTRICTS)));
  const states = partOf(html, "store-state", "store-districts");
  assert.equal([...states.matchAll(/aria-pressed="true"/g)].length, 1);
  ok(states.includes("Maharashtra") && states.includes("Madhya Pradesh"));
  const grid = partOf(html, "store-districts");
  assert.equal([...grid.matchAll(/<button/g)].length, DISTRICTS.length);
  assert.equal([...grid.matchAll(/aria-pressed="true"/g)].length, 1, "Nashik alone is pressed");
  ok(grid.includes("Ahilyanagar"), "the name, not the key ahmednagar");
  assert.equal([...grid.matchAll(/min-h-14/g)].length, DISTRICTS.length, "56 px tall");
  assert.match(html, /role="group" aria-label="[^"]+"/);
});

test("S29 a list reading, failed or empty is said in words; a failed one offers Try again", () => {
  const t = DICTS.en;
  const reading = page(placeStep(NOTHING, listOf<DistrictItem>([], { reading: true })));
  ok(reading.includes(esc(t["aiaic.store.where.reading"] ?? "?")));
  const failed = page(placeStep(NOTHING, listOf<DistrictItem>([], { failed: true })));
  ok(failed.includes(esc(t["aiaic.store.where.failed"] ?? "?")));
  ok(failed.includes(esc(t["aiaic.retry"] ?? "?")) && failed.includes('role="alert"'));
  const empty = page(placeStep(NOTHING, listOf<DistrictItem>([])));
  ok(empty.includes(esc(t["aiaic.store.where.empty"] ?? "?")));
  const crop = (over: Partial<ListRead<CropItem>>) =>
    page(
      createElement(CropStep, {
        crops: listOf<CropItem>([], over),
        firstPage: [],
        chosen: "",
        onChoose: () => undefined,
      }),
    );
  ok(crop({ reading: true }).includes(esc(t["aiaic.store.crop.reading"] ?? "?")));
  ok(crop({ failed: true }).includes(esc(t["aiaic.store.crop.failed"] ?? "?")));
  ok(crop({}).includes(esc(t["aiaic.store.crop.empty"] ?? "?")));
});

test("S30 step 2 is the district's crops as buttons, its names in the reader's language, the chosen one pressed, More counted", () => {
  const html = page(
    createElement(CropStep, {
      crops: listOf(CROPS.crops),
      firstPage: CROPS.first_page,
      chosen: "onion",
      onChoose: () => undefined,
    }),
  );
  const grid = partOf(html, "store-crops", "store-crops-more");
  assert.equal([...grid.matchAll(/aria-pressed=/g)].length, CROPS_FIRST);
  assert.equal([...grid.matchAll(/aria-pressed="true"/g)].length, 1);
  ok(grid.includes("कांदा"), "the name AIAIC sent, not its label");
  ok(!grid.includes(">onion<"));
  const { more } = cropsOffered(CROPS.crops, CROPS.first_page, "onion");
  ok(html.includes(`More crops (${more.length})`));
  ok(html.includes('aria-expanded="false"'), "More says it is folded");
  // a city's list says why it is not the crops grown there
  const city = page(
    createElement(CropStep, {
      crops: listOf(CROPS.crops),
      firstPage: [],
      chosen: "",
      onChoose: () => undefined,
    }),
  );
  ok(city.includes(esc(DICTS.en["aiaic.store.crop.not_grown"] ?? "?")));
});

test("S31 step 3: chips of 10, 25, 50 and 100 quintals, Other, and Skip for the labelled example; a kept quantity is shown", () => {
  const quantity = (value: StoreChoice["quantity"]) =>
    page(createElement(QuantityStep, { value, onChoose: () => undefined }));
  const html = quantity(null);
  for (const n of QUANTITY_CHIPS) {
    ok(html.includes(`data-testid="store-qty-${n}"`), `${n}`);
    ok(html.includes(`>${n} quintals<`), `${n} quintals`);
  }
  ok(html.includes('data-testid="store-qty-other"'));
  ok(html.includes(esc(DICTS.en["aiaic.store.qty.skip"] ?? "?")));
  ok(!html.includes('aria-pressed="true"'), "nothing chosen yet");
  ok(!html.includes("store-qty-typed"), "no box until asked");
  assert.equal([...quantity(25).matchAll(/aria-pressed="true"/g)].length, 1);
  const typed = quantity(37);
  ok(typed.includes('data-testid="store-qty-typed"'), "a kept 37 opens the box");
  ok(typed.includes('value="37"') && typed.includes("<label"), "with a real label");
  ok(typed.includes('inputMode="decimal"'));
});

test("S46 the Other box keeps what is typed: anything but a plain number is read for distress before the quantity is used", () => {
  // The walk of 1 Nov 2026, a real browser: this box kept only digits, so "I want to end my life" vanished as it was typed, its
  // button stayed grey and no helpline could come (the platform's rule D-105). The browser walk shows the crisis card now.
  assert.deepEqual(quantityTyped("37"), { q: 37, fits: true, words: false });
  assert.deepEqual(quantityTyped(" 37.5 "), { q: 37.5, fits: true, words: false });
  assert.deepEqual(quantityTyped("37.5kg"), { q: null, fits: false, words: true });
  assert.deepEqual(quantityTyped("I want to end my life"), { q: null, fits: false, words: true });
  assert.deepEqual(
    quantityTyped("100001"),
    { q: 100001, fits: false, words: false },
    "out of range: its sentence, no scan",
  );
  // THE AUDIT OF 1 NOV 2026, F13: "500 kg" was read as 500 quintals, "10 20" as 1,020 with no scan, "५०" was refused, and a quantity can
  // flip a verdict. A plain number only, Devanagari digits included; never a guess from the digits.
  for (const typed of ["500 kg", "2 tonnes", "10-20", "10 20", "-5", "1,000", "abc"])
    assert.deepEqual(quantityTyped(typed), { q: null, fits: false, words: true }, typed);
  assert.deepEqual(quantityTyped("५०"), { q: 50, fits: true, words: false });
  assert.deepEqual(quantityTyped("१२.५"), { q: 12.5, fits: true, words: false });
  assert.deepEqual(quantityTyped("२ टन"), { q: null, fits: false, words: true });
  assert.equal(
    quantityTyped("3 acres, I want to end my life").words,
    true,
    "a crisis beside a number",
  );
  assert.equal(quantityTyped("मी आत्महत्या करणार").words, true, "in Devanagari");
  assert.equal(quantityTyped("").words, false);
  const src = (file: string) => fs.readFileSync(path.join(here, "../src", file), "utf-8");
  ok(
    !src("components/farm/aiaic/storage/StorageSteps.tsx").includes('.replace(/[^0-9.]/g, "")'),
    "the box itself drops nothing",
  );
  const route = src("routes/storage.tsx");
  ok(
    route.includes("onWords=") && route.includes("useScanBeforeRefusing()"),
    "the page has AIAIC read the words",
  );
  ok(route.includes('raise?.(problem("crisis"'), "and AIAIC's crisis card takes the whole page");
});

const pageOf = (plan: StoragePlan) =>
  page(answer(plan), undefined, plan.lang as "en" | "mr" | "hi");
const DATIA = sample("groundnut_datia_en");
const DATIA_MR = sample("groundnut_datia_mr");
const LOAN_60 = sample("mataki_sangli_loan_60_en");
const LOAN_30 = sample("mataki_sangli_loan_30_en");

test("S48 how sure AIAIC is stands under the verdict with its reasons, in the reader's language, on every kind of answer (the audit of 1 Nov 2026, F2)", () => {
  for (const plan of [STORE, WHEAT, ONION, NO_PRICE, TOO_OLD, STORE_MR, STORE_HI, ONION_MR]) {
    const c = plan.card?.verdict.confidence;
    ok(c && c.text && c.label, `${plan.crop_shown}: the answer carries it`);
    const shown = partOf(pageOf(plan), "store-verdict-confidence");
    ok(shown.includes(esc(c!.text)) && shown.includes(esc(c!.label)), `${plan.crop_shown}: shown`);
    for (const reason of c!.reasons)
      ok(shown.includes(esc(reason)), `${plan.crop_shown}: ${reason}`);
    ok(
      pageOf(plan).indexOf("store-verdict-confidence") < pageOf(plan).indexOf("store-tiles"),
      "above the tiles",
    );
  }
  ok(STORE.card?.verdict.confidence?.band === "low", "the case the audit found");
});

test("S49 a lean to store AIAIC is not sure of is not shown green, on the page or on the card (F2)", () => {
  assert.equal(STORE.card?.verdict.tone, "neutral");
  const shown = pageOf(STORE);
  ok(shown.includes('data-testid="store-verdict" data-tone="neutral"'), "the verdict line");
  ok(!/data-testid="store-tile-net_gain" data-tone="good"/.test(shown), "the gain tile");
  const card = page(createElement(StorageCardBody, { card: STORE.card!, unfolded: true }));
  ok(!card.includes("bg-primary/10 text-primary"), "the card's chip");
  ok(card.includes("store-verdict-confidence"), "and the card says how sure");
});

test("S50 under a store verdict, that no loan was asked stands above the fold; a verdict that stores nothing does not say it (F9)", () => {
  const line = STORE.card?.verdict.assumptions?.find((a) => a.code === "no_loan_asked")?.text;
  ok(line, "the sentence exists");
  ok(
    partOf(pageOf(STORE), "store-verdict-assumed").includes(esc(line!)),
    "shown under the verdict",
  );
  const other = WHEAT.card?.verdict.assumptions?.find((a) => a.code === "no_loan_asked")?.text;
  ok(
    other && !partOf(pageOf(WHEAT), "store-verdict-assumed", "store-tiles").includes(esc(other)),
    "not under Sell now",
  );
  assert.deepEqual(
    keyAssumed({ code: "store", assumptions: [{ code: "no_loan_asked", text: "x" }] }).length,
    1,
  );
  assert.deepEqual(
    keyAssumed({ code: "sell_now", assumptions: [{ code: "no_loan_asked", text: "x" }] }).length,
    0,
  );
});

test("S51 the loan guard is one tap from a store verdict: a chip a length, and the question stays while a loan is set (F9)", () => {
  const chips = (plan: StoragePlan) =>
    page(createElement(StorageAnswer, { plan, onLoan: () => undefined }));
  const free = partOf(chips(STORE), "store-loan");
  ok(
    free.includes(esc(STORE.loan!.question)) && free.includes(esc(STORE.loan!.note)),
    "asked, and what happens to the answer said",
  );
  for (const c of STORE.loan!.choices)
    ok(free.includes(`store-loan-${c.due_in_days}`), `chip ${c.text}`);
  ok(!free.includes("store-loan-clear"), "nothing to take back yet");
  ok(
    chips(STORE).indexOf('"store-loan"') < chips(STORE).indexOf('"store-tiles"'),
    "above the tiles",
  );
  ok(!chips(WHEAT).includes('"store-loan"'), "no question under Sell now");
  ok(!page(answer(STORE)).includes('"store-loan"'), "a page that cannot ask again does not ask");
  const bound = partOf(chips(LOAN_60), "store-loan");
  ok(
    bound.includes("store-loan-clear") && bound.includes(esc(LOAN_60.loan!.clear)),
    "it can be taken back",
  );
  ok(
    /aria-pressed="true"[^>]*data-testid="store-loan-60"/.test(bound),
    "the choice stands pressed",
  );
  assert.equal(LOAN_60.card?.verdict.code, "sell_now", "the guard answered");
  assert.equal(LOAN_30.card?.verdict.reason_code, "loan_due_first");
  const route = sourceOf("src/routes/storage.tsx");
  ok(!/loanDueInDays[^\n]*saveFarm|farmWith[^\n]*loan/.test(route), "never saved");
  ok(
    !sourceOf("src/lib/aiaic-storage.ts").includes("loan_due_in_days: c."),
    "never in the address",
  );
});

test("S52 a loan reaches AIAIC for this answer only: sent, and not kept here even for a while (F9)", async () => {
  const q = { crop: "mataki", district: "Sangli", state: "mh", lang: "en", loan_due_in_days: 60 };
  await withAiaic(
    () => ({ status: 200, body: LOAN_60 }),
    async (asked) => {
      await client.storagePlan(q);
      await client.storagePlan(q);
      assert.equal(asked.length, 2, "asked each time: nothing kept");
      assert.equal(asked[0]?.url.searchParams.get("loan_due_in_days"), "60");
    },
  );
});

test("S53 a price from outside the district is said as whose it is, makes no claim, and is not drawn on its months (F3, F23)", () => {
  const now = DATIA.prices?.now;
  assert.equal(now?.outside, true);
  const tile = partOf(pageOf(DATIA), "store-tile-price_now");
  ok(tile.includes(esc(now!.whose_text!)), "whose it is");
  ok(tile.includes(esc("your own mandi may pay less")), "what that means under a store verdict");
  ok(!tile.includes("Price now"), "not called the price now");
  ok(
    partOf(pageOf(DATIA_MR), "store-tile-price_now").includes(
      esc(DATIA_MR.prices!.now!.whose_text!),
    ),
    "in Marathi",
  );
  ok(
    !page(createElement(MonthsChart, { prices: DATIA.prices! })).includes("store-chart-now"),
    "not on the chart",
  );
  // test data: a real answer whose month is held, its price marked as from outside
  const held = { ...STORE.prices!, now: { ...STORE.prices!.now!, outside: true } };
  ok(
    !page(createElement(MonthsChart, { prices: held })).includes("store-chart-now"),
    "even where the month is held",
  );
  ok(
    page(createElement(MonthsChart, { prices: STORE.prices! })).includes("store-chart-now"),
    "the district's own is",
  );
});

test("S54 the land box and every list's search box are heard; an address's crop is read before it is dropped (F12)", () => {
  const ask = sourceOf("src/routes/ask.tsx");
  ok(/id="land"\s+type="text"/.test(ask), "the land box holds what is typed");
  ok(ask.includes("useNumberBoxHeard(land, activeLang)"), "AIAIC reads anything but a number");
  ok(ask.includes("<FarmGate"), "and its card takes the page");
  ok(ask.includes("await readLand()"), "on the button too");
  ok((ask.match(/onUnmatched=\{hearWords\}/g) ?? []).length === 3, "every list's search box");
  const route = sourceOf("src/routes/storage.tsx");
  ok(
    /void scan\.refuse\(dropped, lang/.test(route),
    "the crop the list does not hold is read first",
  );
  ok(route.indexOf("scan.refuse(dropped") < route.indexOf('crop: "" } : c'), "then dropped");
  assert.equal(plainNumber("2.5"), 2.5);
  assert.equal(plainNumber("२.५"), 2.5);
  assert.equal(plainNumber("मला जगायचे नाही"), null);
  assert.equal(plainNumber("3 acres"), null);
});

/**
 * EVERY BOX OF THE APP THAT CAN HOLD WORDS IS HEARD BY THE CRISIS CHECK (the audit of 1 Nov 2026, F12; the dashboard has held this since
 * 13 Oct). This finds every <input> and <textarea> in the app's code and holds each to one of: it takes no text; a secret; `heard`: what
 * is typed reaches AIAIC, by a route that reads it first or by `/safety/check`; `demo`: a form of the app's own demo store, shown only
 * when this server is not set up for AIAIC (`TradeSwitch`), where no AIAIC stands behind it. A new box that is none of these fails here.
 */
const BOXES: Record<string, [count: number, how: "heard" | "demo" | "secret", why: string][]> = {
  "components/farm/BigSelect.tsx": [
    [1, "heard", "words that match nothing go to onUnmatched: useHearWords, or the page's scan"],
  ],
  "components/farm/aiaic/AiaicPayments.tsx": [
    [5, "heard", "the payout details: an AIAIC route, by `press`"],
  ],
  "components/farm/aiaic/AiaicSellForm.tsx": [
    [2, "heard", "useNumberBoxHeard: anything but a plain number is read"],
  ],
  "components/farm/aiaic/FromAiaicCard.tsx": [
    [4, "heard", "the payout destination: an AIAIC route, by `press`"],
  ],
  "components/farm/aiaic/storage/StorageSteps.tsx": [[1, "heard", "onWords: the page's scan"]],
  "components/farm/BankDetailsCard.tsx": [
    [3, "heard", "AIAIC's payout route, by `press`"],
    [1, "secret", "the account number typed again"],
  ],
  "routes/ask.tsx": [[1, "heard", "useNumberBoxHeard: anything but a plain number is read"]],
  "routes/help.$queryId.tsx": [[1, "heard", "a help query: an AIAIC route"]],
  "routes/help.index.tsx": [[1, "heard", "a help query: an AIAIC route, or the scan"]],
  "routes/listing.new.tsx": [
    [9, "demo", "LocalNewListingPage; AiaicSellForm when AIAIC is set up"],
  ],
  "routes/orders.$orderId.tsx": [
    [1, "demo", "the local order page; AIAIC's own when AIAIC is set up"],
  ],
  "routes/register.tsx": [[4, "heard", "AIAIC's registration, or the scan on a refusal"]],
  "routes/signin.tsx": [[2, "heard", "AIAIC's sign-in, or the scan on a refusal"]],
};

test("S55 every box of the app that can hold words is listed and heard; a new one fails here (F12)", () => {
  const found: Record<string, number> = {};
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        if (name !== "ui") walk(full);
      } else if (name.endsWith(".tsx")) {
        for (const m of fs
          .readFileSync(full, "utf-8")
          .matchAll(/<(input|textarea)\b([^>]*?)\/?>/gs)) {
          const type = /type="([^"]+)"/.exec(m[2] ?? "")?.[1] ?? "text";
          if (m[1] === "input" && ["checkbox", "file", "radio"].includes(type)) continue;
          const rel = path.relative(path.join(APP, "src"), full).replaceAll("\\", "/");
          const demo = BOXES[rel]?.every((r) => r[1] === "demo");
          ok(
            type !== "number" || demo,
            `${rel}: a number box holds "" for words: keep what is typed (useNumberBoxHeard)`,
          );
          found[rel] = (found[rel] ?? 0) + 1;
        }
      }
    }
  };
  walk(path.join(APP, "src"));
  const listed = Object.fromEntries(
    Object.entries(BOXES).map(([file, rows]) => [file, rows.reduce((n, r) => n + r[0], 0)]),
  );
  assert.deepEqual(found, listed, "every box listed, with how it is heard");
});

test("S58 a number in any box of an address is that text, never a page that fails to load", () => {
  assert.deepEqual(farmSearchSchema.parse({ land: 3, crop: 5, region: "nashik" }), {
    land: "3",
    crop: "5",
    region: "nashik",
  });
});

test("S56 /result names the crop and district as the lists do, and acres in the reader's language (F11)", () => {
  const result = sourceOf("src/routes/result.tsx");
  ok(!result.includes("} acres`"), "no English word typed into the line");
  ok(result.includes('"result.acres.one" : "result.acres"'), "a key");
  ok(!result.includes("[search.crop, search.mandi ?? search.region]"), "no raw key in the subject");
  for (const lang of ["en", "mr", "hi"] as const) ok(DICTS[lang]?.["result.acres"], lang);
  ok(
    /[ऀ-ॿ]/.test(DICTS.mr?.["result.acres"] ?? "") &&
      /[ऀ-ॿ]/.test(DICTS.hi?.["ask.land.number"] ?? ""),
    "theirs",
  );
  ok(
    !sourceOf("src/components/farm/TopNav.tsx").includes("Farm-to-Retail"),
    "the header's line too (F22)",
  );
});

test("S59 the result page's standing warning has its heading in the reader's language, never a label's key (F11)", () => {
  const result = sourceOf("src/routes/result.tsx");
  ok(!result.includes("data.important_label ||"), "a label's key is never shown as its heading");
  ok(result.includes('t("result.important")'), "the page's own word");
  ok(
    /[ऀ-ॿ]/.test(DICTS.mr?.["result.important"] ?? "") &&
      /[ऀ-ॿ]/.test(DICTS.hi?.["result.important"] ?? ""),
    "theirs",
  );
});

test("S57 the answer at a glance says how sure the verdict is, beside the verdict's word (F2)", () => {
  ok(
    sourceOf("src/components/farm/aiaic/AnswerAtAGlance.tsx").includes("v.confidence.text"),
    "read from the card",
  );
});

test("S47 the chart's key writes the latest price's day as the apps do, never an ISO day", () => {
  const html = page(createElement(MonthsChart, { prices: STORE.prices }));
  ok(html.includes("24 Sep 2026"), "the day as the apps write it");
  ok(!/\d{4}-\d{2}-\d{2}/.test(html), "no ISO day on the chart");
  const marathi = pageIn("mr", createElement(MonthsChart, { prices: STORE_MR.prices }));
  ok(marathi.includes("24/9/2026") && !/\d{4}-\d{2}-\d{2}/.test(marathi), "and in Marathi");
});

test("S32 a finished step folds to one line with a Change button; aria-current names the open step alone", () => {
  const row = (state: "done" | "open" | "todo") =>
    page(
      createElement(StepRow, {
        n: 1,
        title: "Where",
        state,
        summary: "Nashik, Maharashtra",
        onChange: () => undefined,
        children: createElement("p", null, "the buttons"),
      }),
    );
  const done = row("done");
  ok(done.includes("Nashik, Maharashtra") && !done.includes("the buttons"));
  ok(done.includes('aria-label="Change: Where"') && done.includes(">Change<"));
  ok(done.includes("min-h-11"), "44 px");
  ok(!done.includes("aria-current"));
  const open = row("open");
  ok(open.includes('aria-current="step"') && open.includes("the buttons"));
  ok(!open.includes(">Change<") && !open.includes("Nashik, Maharashtra"));
  const todo = row("todo");
  ok(todo.includes("Where") && !todo.includes("the buttons") && !todo.includes(">Change<"));
  ok(open.includes("Step 1 of 4:"), "said to a screen reader");
});

// --------------------------------------------------------------------------- D. reading the plan, and failing

const adviceLink = createElement("a", { href: "/advice/storage" }, "advice");
const noPress = { busy: false, onRetry: () => undefined, advice: adviceLink };

test("S33 what the page shows from a read of the plan: loading, a failure, nothing to show, or the answer; never a blank", () => {
  assert.deepEqual(planShown({ data: undefined, isError: false }), { show: "loading" });
  assert.deepEqual(planShown({ data: undefined, isError: true }), {
    show: "failed",
    problem: null,
  });
  const refused = problem("not_found", { status: 404 });
  assert.deepEqual(planShown({ data: { ok: false, problem: refused }, isError: false }), {
    show: "failed",
    problem: refused,
  });
  assert.deepEqual(
    planShown({ data: { ok: true, data: { ...SOY, indicators: [] } }, isError: false }),
    { show: "empty" },
  );
  assert.equal(planShown({ data: { ok: true, data: SOY }, isError: false }).show, "answer");
  ok(planHolds(SOY) && !planHolds(null) && !planHolds({} as StoragePlan));
});

test("S34 an AIAIC server without the route, or any refusal: said plainly, with Try again and the farmer's advice page", () => {
  const notThere = page(
    createElement(PlanFailed, { problem: problem("not_found", { status: 404 }), ...noPress }),
  );
  ok(notThere.includes(esc(DICTS.en["aiaic.store.plan_failed"] ?? "?")));
  ok(partOf(notThere, "store-why").includes(esc(DICTS.en["aiaic.refused.not_found"] ?? "?")));
  ok(notThere.includes('data-testid="store-plan-retry"') && notThere.includes(">Try again<"));
  ok(notThere.includes('href="/advice/storage"'));
  ok(notThere.includes('role="alert"'));
  for (const code of ["taluka_not_known", "quantity_out_of_range", "crop_required"])
    ok(
      partOf(
        page(createElement(PlanFailed, { problem: problem(code), ...noPress })),
        "store-why",
      ).includes(esc(DICTS.en[`aiaic.refused.${code}`] ?? "?")),
      code,
    );
  // AIAIC down, and this app's own server not answering
  const down = page(
    createElement(PlanFailed, { problem: problem("aiaic_unavailable"), ...noPress }),
  );
  ok(down.includes(esc(DICTS.en["aiaic.problem.aiaic_unavailable"] ?? "?")));
  const own = page(createElement(PlanFailed, { problem: null, ...noPress }));
  ok(own.includes(">Try again<") && !own.includes('data-testid="store-why"'));
  const empty = page(createElement(PlanEmpty, noPress));
  ok(empty.includes(esc(DICTS.en["aiaic.store.plan_empty"] ?? "?")));
  ok(empty.includes(">Try again<") && empty.includes('href="/advice/storage"'));
  const busy = page(createElement(PlanFailed, { problem: null, ...noPress, busy: true }));
  assert.match(busy, /<button[^>]*disabled/, "no second press while it is asked again");
});

test("S35 a code the app has no words for is never shown to the farmer, in any language", () => {
  const unknown = problem("some_new_code");
  for (const html of [
    page(createElement(PlanFailed, { problem: unknown, ...noPress })),
    pageIn("mr", createElement(PlanFailed, { problem: unknown, ...noPress })),
  ]) {
    ok(!html.includes("some_new_code"));
    ok(!html.includes('data-testid="store-why"'));
  }
  ok(
    pageIn("mr", createElement(PlanFailed, { problem: unknown, ...noPress })).includes(
      esc(DICTS.mr["aiaic.store.plan_failed"] ?? "?"),
    ),
  );
});

test("S36 AIAIC's crisis card stands alone: helplines, no storage answer, no Try again", () => {
  const crisis: AiaicProblem = problem("crisis", {
    crisis: {
      answer: null,
      message: null,
      helplines: [{ name: "Tele-MANAS", phone: "14416" }],
    },
  });
  const failed = page(createElement(PlanFailed, { problem: crisis, ...noPress }));
  ok(failed.includes("data-crisis") && failed.includes("14416"));
  ok(!failed.includes(">Try again<") && !failed.includes('href="/advice/storage"'));
  const gate = page(createElement(CrisisOnly, { crisis, children: answer(SOY) as ReactElement }));
  ok(gate.includes("data-crisis") && !gate.includes('data-testid="store-answer"'));
});

// ---------------------------------------------------------------------- E. this server's call to AIAIC

type Asked = { url: URL; headers: Record<string, string> };
/** A stand-in for AIAIC at `fetch`, in this process: no port is opened. */
async function withAiaic(
  answer: (url: URL) => { status: number; body: unknown },
  run: (asked: Asked[]) => Promise<void>,
) {
  const realFetch = globalThis.fetch;
  const base = process.env["AIAIC_BASE_URL"];
  process.env["AIAIC_BASE_URL"] = "http://127.0.0.1:1";
  client.resetForTests();
  identity.sessionForTests(null);
  const asked: Asked[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    asked.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const { status, body } = answer(url);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  try {
    await run(asked);
  } finally {
    globalThis.fetch = realFetch;
    if (base === undefined) delete process.env["AIAIC_BASE_URL"];
    else process.env["AIAIC_BASE_URL"] = base;
    client.resetForTests();
  }
}

const ASK = { crop: "soybean", district: "nashik", state: "mh", lang: "en" };

test("S37 the plan is asked of /storage/plan with only its declared boxes, needs no sign-in, and is kept like the card", async () => {
  await withAiaic(
    () => ({ status: 200, body: SOY }),
    async (asked) => {
      const a = await client.storagePlan({ ...ASK, quantity_q: 25, taluka: "Niphad" });
      const b = await client.storagePlan({ ...ASK, quantity_q: 25, taluka: "Niphad" });
      ok(a.ok && b.ok);
      assert.equal(a.data.indicators[0]?.value, SOY.indicators[0]?.value);
      assert.equal(asked.length, 1, "the same question was asked once");
      assert.equal(asked[0]?.url.pathname, "/storage/plan");
      assert.deepEqual([...(asked[0]?.url.searchParams.keys() ?? [])].sort(), [
        "crop",
        "district",
        "lang",
        "quantity_q",
        "state",
        "taluka",
      ]);
      // the labelled example: no quantity sent at all
      await client.storagePlan(ASK);
      assert.equal(asked.length, 2, "another question is asked");
      assert.equal(asked[1]?.url.searchParams.has("quantity_q"), false);
      assert.equal(asked[1]?.url.searchParams.has("taluka"), false);
      // the card's own answer is kept apart from the plan's
      await client.storageVerdict(ASK);
      assert.equal(asked[2]?.url.pathname, "/storage/verdict");
    },
  );
});

test("S38 a refusal or AIAIC not answering is said and asked again; a server without the route says not_found", async () => {
  await withAiaic(
    () => ({ status: 404, body: { detail: "Not Found" } }),
    async (asked) => {
      const a = await client.storagePlan(ASK);
      const b = await client.storagePlan(ASK);
      assert.equal(a.ok ? "" : a.problem.code, "not_found");
      assert.equal(b.ok ? "" : b.problem.code, "not_found");
      assert.equal(asked.length, 2, "a refusal is not kept");
    },
  );
  await withAiaic(
    () => ({
      status: 422,
      body: { detail: { reason_code: "taluka_not_known", message: "Pick one from the list." } },
    }),
    async () => {
      const a = await client.storagePlan({ ...ASK, taluka: "Nowhere" });
      assert.equal(a.ok ? "" : a.problem.code, "taluka_not_known");
    },
  );
  await withAiaic(
    () => ({ status: 503, body: {} }),
    async () => {
      const a = await client.storagePlan(ASK);
      assert.equal(a.ok ? "" : a.problem.code, "aiaic_unavailable");
    },
  );
});

test("S39 a crisis answer comes back as the crisis, with its helplines, never as a plan", async () => {
  await withAiaic(
    () => ({
      status: 200,
      body: { distress: true, talk_to_someone: [{ name: "Tele-MANAS", phone: "14416" }] },
    }),
    async () => {
      const a = await client.storagePlan(ASK);
      assert.equal(a.ok, false);
      assert.equal(a.ok ? null : a.problem.code, "crisis");
      assert.equal(a.ok ? null : a.problem.crisis?.helplines[0]?.phone, "14416");
      // a crisis is never kept to be served to the next person
      const again = await client.storagePlan(ASK);
      assert.equal(again.ok ? null : again.problem.code, "crisis");
    },
  );
});

// ---------------------------------------------------------------------------- F. the ways into the page

test("S40 the storage tile on /result leads to the page, with its crop, district, state and taluka", () => {
  const queries = new QueryClient();
  // the card as the tile reads it: the same query key, so its one request
  queries.setQueryData(["aiaic-storage-verdict", "mh", "nashik", "soybean", null, "en", null], {
    ok: true,
    data: SOY.card,
  });
  const html = page(
    createElement(AnswerAtAGlance, {
      crop: "soybean",
      district: "nashik",
      state: "mh",
      taluka: "Niphad",
      compare: null,
    }),
    queries,
  );
  const link = partOf(html, "glance-storage-link");
  const at = html.indexOf('data-testid="glance-storage-link"');
  const tag = html.slice(html.lastIndexOf("<a", at), html.indexOf(">", at));
  const href = unesc(/href="([^"]*)"/.exec(tag)?.[1] ?? "");
  ok(href.startsWith("/storage?"), `the link: ${tag}`);
  for (const part of ["region=nashik", "crop=soybean", "state=mh", "taluka=Niphad"])
    ok(href.includes(part), `${part} in ${href}`);
  ok(link.includes(esc(DICTS.en["aiaic.store.open"] ?? "?")));
  ok(html.includes("min-h-11"));
});

test("S41 the home page, the storage advice page, the route tree and the bottom navigation all know the page", () => {
  const home = sourceOf("src/routes/index.tsx");
  ok(home.includes('to="/storage"') && home.includes('t("aiaic.store.home")'));
  const advice = sourceOf("src/routes/advice.$service.tsx");
  const part = advice.slice(advice.indexOf('data-testid="advice-storage-link"') - 900);
  ok(part.includes('to="/storage"') && part.includes('service === "storage" && !distress'));
  const tree = sourceOf("src/routeTree.gen.ts");
  ok(tree.includes("import { Route as StorageRouteImport } from './routes/storage'"));
  ok(tree.includes("'/storage': typeof StorageRoute"));
  ok(tree.includes("declare module '@tanstack/react-start'"), "the Start block stays");
  const nav = sourceOf("src/components/farm/BottomNav.tsx");
  ok(nav.includes('currentPath.startsWith("/storage")'), "it belongs to the advice tab");
  const route = sourceOf("src/routes/storage.tsx");
  ok(route.includes('createFileRoute("/storage")') && route.includes("<FarmGate"));
  ok(route.includes('to="/advice/$service"') && route.includes('service: "storage"'));
});

/** The real route's first paint, at an address, as this app's server writes it: no saved farm is read until the browser. */
async function firstPaint(address: string): Promise<string> {
  const root = createRootRoute({
    component: () =>
      createElement(QueryClientProvider, {
        client: new QueryClient(),
        children: createElement(I18nProvider, { children: createElement(Outlet) }),
      }),
  });
  const storage = StorageRoute.update({
    id: "/storage",
    path: "/storage",
    getParentRoute: () => root,
  } as never);
  const inMemory = createRouter({
    routeTree: root.addChildren([storage]),
    history: createMemoryHistory({ initialEntries: [address] }),
  });
  await inMemory.load();
  return renderToString(createElement(RouterProvider, { router: inMemory as never })).replaceAll(
    "<!-- -->",
    "",
  );
}

test("S44 AIAIC's abstentions as they came: no recent price, or the newest too old: Not sure, no price tile and no latest price drawn", () => {
  for (const [name, plan, reason] of [
    ["no recent price", NO_PRICE, "no_prices"],
    ["too old", TOO_OLD, "prices_too_old"],
  ] as const) {
    assert.equal(plan.card?.verdict.code, "unsure", name);
    assert.equal(plan.card?.verdict.reason_code, reason, name);
    assert.equal(plan.card?.price, null, name);
    const html = page(answer(plan));
    const line = partOf(html, "store-verdict", "store-tiles");
    ok(line.includes('data-code="unsure"'), name);
    ok(line.includes(esc(plan.card?.verdict.text ?? "?")), `${name}: the reason is said`);
    ok(!html.includes('data-testid="store-tile-price_now"'), `${name}: no price tile`);
    ok(!html.includes('data-testid="store-tile-net_gain"'), `${name}: no gain tile`);
    ok(!html.includes('data-testid="store-chart-latest"'), `${name}: no latest price drawn`);
  }
});

test("S45 every storage sample here is the file AIAIC recorded, byte for byte, and says it is a sample", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, "recording_manifest.sample.json"), "utf-8"),
  ) as { files: Record<string, { sha256: string }> };
  const here = fs.readdirSync(FIXTURES).filter((n) => n.endsWith(".sample.json"));
  const samples = here.filter((n) => n !== "recording_manifest.sample.json");
  ok(samples.length >= 18, `only ${samples.length}`);
  for (const name of samples) {
    const held = manifest.files[name];
    ok(held, `${name} is not a recording of AIAIC's`);
    // the text AIAIC wrote: a Windows checkout may write CRLF over the file's LF (core.autocrlf)
    const text = fs.readFileSync(path.join(FIXTURES, name), "utf-8").replace(/\r\n/g, "\n");
    const sha = createHash("sha256").update(text, "utf-8").digest("hex");
    assert.equal(sha, held?.sha256, `${name} is not the file AIAIC recorded`);
  }
});

test("S43 the page's first paint: its title, its four steps and the words that it is reading, never a blank", async () => {
  const html = await firstPaint("/storage");
  ok(html.includes(esc(DICTS.en["aiaic.store.title"] ?? "?")), "the title");
  ok(html.includes('data-testid="store-settling"'), "it says it is reading");
  for (const n of [1, 2, 3, 4]) ok(html.includes(`data-testid="store-step-${n}"`), `step ${n}`);
  ok(html.includes('data-state="todo"') && !html.includes('aria-current="step"'), "none open yet");
  // a link's address is read by AIAIC before the page mounts (F12): the first paint says it is reading, and prints nothing of it
  const link = await firstPaint("/storage?region=nashik&crop=onion&state=mh");
  ok(link.includes(esc(DICTS.en["result.loading"] ?? "?")), "it says it is reading");
  ok(!link.includes('data-testid="store-step-1"'), "no step on words not yet read");
  ok(!link.includes('data-testid="store-answer"'), "nothing is shown before AIAIC answers");
});

const WORDS = "जगायचे नाही आता संपवायचे आहे";

test("S60 every farm page reads its whole address at one gate, every key of the schema, before anything of it mounts (F12)", async () => {
  // every route that takes a farm address
  const routes = fs.readdirSync(path.join(APP, "src/routes")).filter((f) => f.endsWith(".tsx"));
  const farm = routes.filter((f) =>
    /validateSearch: (farmSearchSchema|detailSearchSchema)/.test(sourceOf(`src/routes/${f}`)),
  );
  assert.deepEqual(farm.sort(), [
    "advice.$service.tsx",
    "ask.tsx",
    "result.tsx",
    "review.tsx",
    "storage.tsx",
  ]);
  for (const f of farm) {
    const source = sourceOf(`src/routes/${f}`);
    ok(source.includes("<FarmGate search={search}>"), `${f}: the gate, with the whole address`);
    ok(!/<CrisisFirst>/.test(source), `${f}: one gate`);
  }
  // every key of the schema is read, from the schema, so a key added there needs no line here
  assert.deepEqual([...ADDRESS_KEYS].sort(), Object.keys(farmSearchSchema.shape).sort());
  for (const key of ["region", "taluka", "crop", "mandi", "land", "services", "state"])
    ok(ADDRESS_KEYS.includes(key as keyof FarmSearch), key);
  for (const key of ADDRESS_KEYS) {
    assert.equal(addressWords({ [key]: WORDS }), WORDS, `${key} is read`);
  }
  assert.equal(addressWords({}), "", "an empty address asks nothing");
  assert.equal(addressWords({ crop: "  ", region: "nashik" }), "nashik");
  // the first paint of the page holds nothing of an address, whatever its box
  for (const key of ADDRESS_KEYS) {
    const html = await firstPaint(`/storage?${key}=${encodeURIComponent(WORDS)}`);
    ok(!html.includes(WORDS), `/storage?${key}= is not printed on the first paint`);
  }
});

const LISTS = {
  districts: [{ key: "nashik", name: "Nashik" }] as DistrictItem[],
  crops: [{ crop: "onion", name: "Onion", name_en: "Onion" }] as CropItem[],
  mandis: ["lasalgaon"],
};

test("S61 what the lists do not hold is neither printed nor saved: a value of the address, in any box (F12)", () => {
  const every = Object.fromEntries(ADDRESS_KEYS.map((k) => [k, WORDS])) as FarmSearch;
  const held = heldOfAddress(every, LISTS);
  ok(!JSON.stringify(held).includes(WORDS), "no box's words are held");
  ok(!JSON.stringify(farmToSave(held)).includes(WORDS), "and none is saved");
  const good: FarmSearch = {
    region: "Nashik",
    crop: "onion",
    mandi: "Lasalgaon",
    land: "2.5",
    state: "mp",
    services: "market,storage",
  };
  assert.deepEqual(
    farmToSave(heldOfAddress(good, LISTS)),
    good,
    "what the lists hold stays, as it was",
  );
  assert.deepEqual(
    heldOfAddress(good, { districts: null, crops: null, mandis: null }).region,
    undefined,
    "a list not read holds nothing",
  );
  assert.equal(heldOfAddress({ land: "२" }, LISTS).land, "2", "a phone's digits are a number");
  assert.equal(heldOfAddress({ land: "0" }, LISTS).land, undefined, "no land is no land");
  ok(
    regionStands(LISTS.districts, "Nashik") && !regionStands(LISTS.districts, WORDS),
    "a district",
  );
  ok(regionStands([], WORDS), "an empty list decides nothing");
});

test("S62 no page prints or keeps an address's words: the list, the subject line, the saved farm, the cached answer's key (F12)", () => {
  const select = page(
    createElement(BigSelect, {
      label: "x",
      anyLabel: "Any crop",
      options: ["onion"],
      value: WORDS,
      onChange: () => undefined,
    }),
  );
  ok(!select.includes(WORDS) && select.includes("Any crop"), "a list prints only what it holds");
  const result = sourceOf("src/routes/result.tsx");
  ok(
    result.includes("[cropShown, mandiShown || districtShown]") && !result.includes("{search.land"),
    "the subject line",
  );
  ok(!result.includes("displayName("), "no raw key made to look like a name");
  ok(result.includes("saveFarm(farmToSave(held))"), "the saved farm: what the lists hold");
  ok(result.includes("if (!place.settled || isDistress) return;"), "and nothing on a crisis");
  ok(
    result.includes('held.region ?? ""}|${held.crop'),
    "the cached answer's key, kept on the phone",
  );
  const ask = sourceOf("src/routes/ask.tsx");
  ok(ask.includes("useState(landOf(search.land))"), "words are not put back in the land box");
  ok(
    ask.includes("const talukaHeld =") && ask.includes("talukaHeld ? placeHeld"),
    "a taluka only once its list holds it",
  );
  // every save of the farm, listed: a new one fails here until it says what it keeps
  const saves: Record<string, number> = {};
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && name !== "farm-storage.ts") {
        const n = (fs.readFileSync(full, "utf-8").match(/\bsaveFarm\(/g) ?? []).length;
        if (n) saves[path.relative(path.join(APP, "src"), full).replaceAll("\\", "/")] = n;
      }
    }
  };
  walk(path.join(APP, "src"));
  assert.deepEqual(saves, { "routes/ask.tsx": 1, "routes/result.tsx": 1, "routes/storage.tsx": 1 });
  ok(ask.includes("forgetFarmValues(["), "words left on a phone by an older page go");
  const storage = sourceOf("src/routes/storage.tsx");
  ok(
    storage.includes("if (ready && held) saveFarm"),
    "the storage page saves only what the lists hold",
  );
  ok(!storage.includes("displayName("), "and prints no raw key");
  ok(!sourceOf("src/routes/review.tsx").includes("{search.crop ||"), "the review packet");
});

test("S63 AIAIC's crisis answer takes the page by the one card, never a banner over money cards (F12)", () => {
  for (const file of ["src/routes/result.tsx", "src/routes/advice.$service.tsx"]) {
    const source = sourceOf(file);
    ok(source.includes('raise?.(problem("crisis"))'), `${file}: raised to the gate`);
    ok(!source.includes("advice.distress.title"), `${file}: no second wording`);
    ok(!source.includes("tel:14416"), `${file}: the helplines are the card's`);
  }
  const card = page(
    createElement(CrisisOnly, {
      crisis: problem("crisis"),
      children: createElement("p", null, "money"),
    }),
  );
  ok(
    card.includes("14416") && card.includes("1800-180-1551"),
    "with no list sent, the helplines stand",
  );
  ok(!card.includes("money"), "and the card alone");
});

test("S64 a refusal for pace is said as what it is, in three languages, never as something they did (F30)", () => {
  assert.equal(client.refusalOf(429, { detail: "Too many" }).code, "aiaic_busy");
  assert.equal(client.refusalOf(429, { detail: "Busy" }, "server_busy").code, "aiaic_server_busy");
  for (const lang of ["en", "mr", "hi"] as const)
    for (const key of ["aiaic.problem.aiaic_busy", "aiaic.problem.aiaic_server_busy"]) {
      ok(DICTS[lang]?.[key], `${lang} ${key}`);
      assert.notEqual(DICTS[lang]?.[key], DICTS[lang]?.["aiaic.refused.refused"]);
    }
  ok(/[ऀ-ॿ]/.test(DICTS.mr?.["aiaic.problem.aiaic_busy"] ?? ""), "theirs");
  const failed = page(
    createElement(PlanFailed, {
      problem: problem("aiaic_busy", { status: 429 }),
      busy: false,
      onRetry: () => undefined,
      advice: null,
    }),
    undefined,
    "mr",
  );
  ok(failed.includes(esc(DICTS.mr?.["aiaic.problem.aiaic_busy"] ?? "?")), "the page says it");
  ok(!failed.includes(esc(DICTS.mr?.["aiaic.refused.refused"] ?? "?")), "never that AIAIC refused");
});

test("S65 a sign keeps to its figure on the card's own range line and in the verdict's sentence (F22)", () => {
  const card = page(createElement(StorageCardBody, { card: STORE.card!, unfolded: true }));
  const gain = STORE.card!.verdict.net_gain_per_q as { low_rs: number; high_rs: number };
  // the card's own line, by its label: the warehouses listed under it print the same range
  const label = card.indexOf(esc(DICTS.en?.["aiaic.storage.net"] ?? "?"));
  ok(label >= 0, "the card's range line");
  const own = card.slice(label, card.indexOf("</p>", label));
  ok(
    own.includes(`<span class="whitespace-nowrap">-₹${Math.abs(gain.low_rs)}</span>`),
    "the low end",
  );
  const high = gain.high_rs.toLocaleString("en-IN");
  ok(own.includes(`<span class="whitespace-nowrap">+₹${high}</span>`), "the high end");
  const line = partOf(pageOf(STORE), "store-verdict-note", "store-tiles");
  ok(line.includes('<span class="whitespace-nowrap">'), "the verdict's sentence");
});

test("S66 what the audit's one rule leaves on a card: Not sure, or a Store and a Sell now that say what section 3 asks (F1, F27, F31)", () => {
  const v = STORE.card!.verdict;
  assert.equal(v.code, "unsure");
  assert.equal(v.leans, "store");
  ok(!pageOf(STORE).includes(`data-code="store"`), "no card says store under Low");
  ok(STORE.loan?.question, "the loan question stays on the lean");
  ok(WHEAT.loan === null, "and is not asked of a lean to sell");
  ok(
    partOf(pageOf(STORE), "store-verdict-assumed", "store-verdict-uncalibrated").includes(
      esc(v.assumptions?.find((a) => a.code === "no_loan_asked")?.text ?? "?"),
    ),
    "and that none was asked",
  );
  ok(partOf(pageOf(STORE), "store-tile-price_now").includes('data-tone="warn"'), "and the warning");
  // an older server sends no `leans`
  const line = { code: "no_loan_asked", text: "No loan was asked about" };
  assert.deepEqual(keyAssumed({ code: "store", assumptions: [line] }), [line]);
  assert.deepEqual(keyAssumed({ code: "unsure", leans: "store", assumptions: [line] }), [line]);
  assert.deepEqual(keyAssumed({ code: "unsure", leans: "sell_now", assumptions: [line] }), []);
  for (const [lang, plan, words] of [
    ["en", COTTON, "KVK or FPO"],
    ["mr", COTTON_MR, "कृषी विज्ञान केंद्राकडे"],
    ["hi", COTTON_HI, "कृषि विज्ञान केंद्र"],
  ] as const) {
    ok(plan.card?.verdict.text.includes(words), `${lang}: confirm with a person`);
    ok(plan.card?.verdict.text.includes("₹"), `${lang}: its figures`);
  }
  for (const [lang, plan] of [
    ["en", TOMATO],
    ["mr", TOMATO_MR],
    ["hi", TOMATO_HI],
  ] as const) {
    const sure = plan.card?.verdict.confidence;
    assert.equal(sure?.band, "rule", lang);
    assert.notEqual(sure?.text, DICTS[lang]?.["advice.confidence.unknown"], lang);
  }
  for (const [lang, imperative] of [
    ["en", "Store at"],
    ["mr", "साठवा"],
    ["hi", "रखें"],
  ] as const)
    ok(
      !(DICTS[lang]?.["aiaic.glance.store_at"] ?? "").includes(imperative),
      `${lang}: the glance's label tells nobody to store`,
    );
  ok(
    !sourceOf("src/routes/index.tsx").includes("[saved.crop, saved.region]"),
    "no raw keys at home",
  );
  ok(
    !sourceOf("src/routes/advice.$service.tsx").includes("[item.subject?.crop || farm.crop"),
    "or on /advice (F11)",
  );
});

/** The words the repositories were cleaned of, spelled apart so this file holds none of them. */
const GENDERED = new RegExp(
  `\\b(${["s" + "he", "h" + "ers?", "hi" + "m", "hi" + "s"].join("|")})\\b`,
  "i",
);

test("S42 nothing new carries a gendered word, and every control of the page is at least 44 px tall", () => {
  const files = [
    "src/routes/storage.tsx",
    "src/components/farm/aiaic/storage/StorageAnswer.tsx",
    "src/components/farm/aiaic/storage/StoragePriceChart.tsx",
    "src/components/farm/aiaic/storage/StorageSteps.tsx",
    "src/components/farm/aiaic/storage/StorageTiles.tsx",
    "src/components/farm/aiaic/storage/WastagePanel.tsx",
    "src/components/farm/aiaic/storage/ColdStoresPanel.tsx",
    "src/components/farm/aiaic/storage/storage-chart.ts",
    "tests/aiaic_storage_suite.ts",
  ];
  for (const f of files) {
    ok(!GENDERED.test(sourceOf(f)), `${f}: ${GENDERED.exec(sourceOf(f))?.[0]}`);
  }
  for (const [key, line] of Object.entries(DICTS.en))
    if (key.startsWith("aiaic.store.")) ok(!GENDERED.test(line), `${key}: ${line}`);
  // every control the page draws names a height of 44 px (min-h-11) or more
  const html = [
    page(answer(SOY)),
    page(answer(ONION)),
    page(placeStep(NOTHING, listOf(DISTRICTS))),
    page(placeStep(NOTHING, listOf<DistrictItem>([], { failed: true }))),
    page(
      createElement(CropStep, {
        crops: listOf(CROPS.crops),
        firstPage: CROPS.first_page,
        chosen: "",
        onChoose: () => undefined,
      }),
    ),
    page(createElement(QuantityStep, { value: 37, onChoose: () => undefined })),
    page(
      createElement(StepRow, {
        n: 1,
        title: "Where",
        state: "done",
        summary: "Nashik",
        onChange: () => undefined,
      }),
    ),
    page(createElement(PlanFailed, { problem: null, ...noPress })),
  ].join("");
  const controls = [...html.matchAll(/<(button|summary|input|select)\b[^>]*>/g)];
  ok(controls.length > 60, `only ${controls.length} controls`);
  for (const c of controls) {
    const cls = /class="([^"]*)"/.exec(c[0])?.[1] ?? "";
    assert.match(cls, /min-h-(11|12|14|16)/, c[0].slice(0, 120));
  }
});

// ------------------------------------------------------------------------------------------------ run

async function main() {
  const started = Date.now();
  for (const t of tests) {
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
    const xml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const cases = results
      .map(
        (r) =>
          `  <testcase classname="aiaic_storage_suite" name="${xml(r.name)}" time="${(r.ms / 1000).toFixed(3)}">` +
          (r.ok ? "" : `<failure message="failed">${xml(r.error ?? "")}</failure>`) +
          "</testcase>",
      )
      .join("\n");
    fs.writeFileSync(
      junit,
      `<?xml version="1.0" encoding="utf-8"?>\n<testsuite name="aiaic_storage_suite" tests="${results.length}" failures="${failed}" errors="0" skipped="0" timestamp="${new Date(started).toISOString()}" time="${((Date.now() - started) / 1000).toFixed(3)}">\n${cases}\n</testsuite>\n`,
      "utf-8",
    );
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed, of ${results.length}`);
  process.exit(failed ? 1 : 0);
}

void main();
