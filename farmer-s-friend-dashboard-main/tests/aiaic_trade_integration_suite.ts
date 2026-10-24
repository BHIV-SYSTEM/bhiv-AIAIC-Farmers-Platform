/**
 * Annapoorna on AIAIC's sale, payment and transport routes: the rules, held.
 *
 * Run:  npx tsx tests/aiaic_trade_integration_suite.ts   (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file)
 *
 * - Part A reads AIAIC's own RECORDED answers (tests/fixtures/aiaic/*.json: real answers of AIAIC's real routes, made
 *   by AIAIC's recorders on a test database or in-process, never edited by hand) through this app's pure functions.
 *   One fixture is DERIVED, and says so (`_derived`, not `_recorded`): derived_mine_report_without_amount.json, a
 *   recording with only the fields AIAIC changes after her report sent without an amount (A16 re-derives it).
 * - Part B runs this app's server client (src/lib/aiaic-trade.server.ts) against a LOCAL STAND-IN for AIAIC on
 *   127.0.0.1: no request leaves this machine; the account and password are stand-ins, never a real one.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { CrisisOnly } from "../src/components/farm/aiaic/CrisisFirst";
import { NEARBY_DOTS, nameBelow, routeMapOf } from "../src/components/farm/aiaic/route-map";
import { priceCompareOf, rowShown } from "../src/lib/aiaic-analysis";
import {
  PRESS_KEY_RE,
  WITHOUT,
  asksHerWord,
  attributionsOf,
  dayOf,
  keyFor,
  moneyCard,
  moneySaid,
  moneyTotals,
  namesOf,
  newPressKey,
  offerViews,
  paymentLine,
  payoutDetailsProblem,
  placeShown,
  pressAndRaise,
  pressed,
  problem,
  rateSources,
  reasonKey,
  routeSketch,
  rupees,
  saleSteps,
  sayKey,
  sourcesSaid,
  startDistrict,
  vehicleName,
  type AiaicMine,
  type AiaicOrder,
  type AiaicProblem,
  type AiaicResult,
  type AiaicSay,
  type DistrictRow,
  type TransportEstimate,
} from "../src/lib/aiaic-trade";
import { FALLBACK_BASE_URL } from "../src/lib/aiaic-base.server";
import * as client from "../src/lib/aiaic-trade.server";
import { DICTS, I18nProvider } from "../src/lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(here, "fixtures", "aiaic");
const APP = path.join(here, "..");

type Recorded = { _recorded?: { route: string; status: number }; answer: unknown };
function recorded(name: string): Recorded {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf-8")) as Recorded;
}
function answer<T>(name: string): T {
  return recorded(name).answer as T;
}
function mineOf(name: string): AiaicMine {
  return client.mineForBrowser(answer<unknown>(name));
}

// ------------------------------------------------------------------------------------------- the runner

type Result = { name: string; ok: boolean; ms: number; error?: string };
const results: Result[] = [];
const tests: { name: string; run: () => void | Promise<void> }[] = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

// ------------------------------------------------------------------- A. AIAIC's recorded answers, read

/** Every recorded answer of GET /farmer/trade (her records), read from the fixtures folder. */
const MINE_FIXTURES = fs
  .readdirSync(FIXTURES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .filter((name) => {
    const r = recorded(name)._recorded;
    return r?.route === "GET /farmer/trade" && r.status === 200;
  });

test("A1 only what the screens show leaves the server (no contact path, no ids of other systems)", () => {
  assert.ok(
    MINE_FIXTURES.length >= 15,
    `only ${MINE_FIXTURES.length} recorded answers of her records`,
  );
  const allowedTop = new Set([
    "tenant_id",
    "profile_place",
    "practice",
    "practice_note",
    "party",
    "listings",
    "orders",
    "payout_account",
    "payout_notice",
  ]);
  for (const name of MINE_FIXTURES) {
    const raw = answer<Record<string, unknown>>(name);
    assert.ok(
      "contact_path" in raw || "trace" in raw,
      `${name}: the recording carries extra blocks`,
    );
    const mine = mineOf(name);
    const text = JSON.stringify(mine);
    for (const k of Object.keys(mine))
      assert.ok(allowedTop.has(k), `${name}: ${k} left the server`);
    for (const word of [
      '"contact',
      '"trace"',
      '"states_note"',
      '"consent_basis"',
      '"transaction_id"',
      '"vajra',
    ]) {
      assert.ok(!text.includes(word), `${name}: ${word} left the server`);
    }
    if (mine.party)
      assert.deepEqual(Object.keys(mine.party).sort(), [
        "district",
        "party_id",
        "state",
        "synthetic",
      ]);
    for (const o of mine.orders)
      assert.ok(!("buyer_id" in o), `${name}: an order's buyer id left the server`);
  }
});

test("A2 the sale's five steps are AIAIC's own states: paid only on Razorpay's word, sent is never received", () => {
  const sending = mineOf("payout_mine_sending").orders[0] as AiaicOrder;
  assert.equal(sending.payment_state, "paid");
  const s1 = saleSteps(sending);
  assert.deepEqual(
    s1.map((s) => s.key),
    ["agreed", "paid", "handover", "delivered", "money"],
  );
  assert.equal(s1[1]?.state, "done");
  assert.equal(s1[4]?.state, "now", "paid, her share not yet transferred: money is the step NOW");

  const settled = mineOf("payout_mine_settled").orders[0] as AiaicOrder;
  assert.equal(
    saleSteps(settled)[4]?.state,
    "done",
    "settled on Razorpay's word: her money is done",
  );
  for (const state of ["transferred", "released", "held"]) {
    const sent = {
      ...settled,
      money: { ...(settled.money as NonNullable<AiaicOrder["money"]>), settlement_state: state },
    };
    assert.equal(saleSteps(sent)[4]?.state, "now", `${state} is not received`);
  }

  const pickedUp = mineOf("farmer_app_mine_after_pickup").orders.find(
    (o) => o.order_state === "in_fulfilment",
  ) as AiaicOrder;
  const s3 = saleSteps(pickedUp);
  assert.equal(s3[2]?.state, "done", "the pickup was recorded: handed over");
  assert.equal(s3[3]?.state, "now", "delivery is the step now");
  assert.equal(s3[1]?.state, "todo", "no link was made: the buyer has not paid through AIAIC");

  const called = mineOf("farmer_app_mine_refund_owed").orders.find(
    (o) => o.order_state === "cancelled",
  ) as AiaicOrder;
  const s4 = saleSteps(called);
  assert.equal(s4[4]?.state, "stopped", "a reversed share stopped");
  assert.equal(s4[2]?.state, "stopped");
});

test("A3 a link that does not carry her share is said to pay AIAIC's account, never hers", () => {
  const settled = mineOf("payout_mine_settled");
  const route = settled.orders.find((o) => o.money?.route === "razorpay_route") as AiaicOrder;
  const plain = settled.orders.find(
    (o) => o.payment.link_made && o.money?.route !== "razorpay_route",
  ) as AiaicOrder;
  assert.ok(route && plain, "the recording has one order of each");
  assert.equal(paymentLine(route).notOnward, false);
  assert.equal(paymentLine(plain).notOnward, true);
  const noLink = mineOf("farmer_app_mine_after_pickup").orders[0] as AiaicOrder;
  assert.equal(noLink.payment.link_made, false);
  assert.deepEqual(paymentLine(noLink), {
    key: "aiaic.pay.no_link",
    state: noLink.payment.state,
    notOnward: false,
  });
});

test("A4 her money's sentence is AIAIC's key, with rupees and India's day filled in", () => {
  const settled = mineOf("payout_mine_settled").orders[0] as AiaicOrder;
  const said = sayKey(settled.money?.say ?? null);
  assert.ok(said);
  assert.equal(said.key, "aiaic.farmer.money.settled");
  assert.equal(said.values["amount"], "₹79,600");
  assert.equal(said.values["utr"], "UTRRECORDING01");
  // settled_at 2026-10-23T20:00:50+00:00 is 01:30 on 24 Oct in India
  assert.equal(said.values["day"], "2026-10-24");
  assert.equal(dayOf("2026-10-23T18:29:59+00:00"), "2026-10-23");
  assert.equal(dayOf("2026-10-23T18:30:00+00:00"), "2026-10-24");
  assert.equal(rupees(20261.36), "₹20,261.36");
  assert.equal(rupees(159200), "₹1,59,200");
});

/** Every key AIAIC's payout store answers with (engine/trade/payout_store.py, push 2): her app must word each. */
const AIAIC_SAY_KEYS = [
  "farmer.money.will_send_bank",
  "farmer.money.will_send_upi",
  "farmer.money.fee_on_top",
  "farmer.money.sending",
  "farmer.money.held",
  "farmer.money.sent_bank",
  "farmer.money.sent_upi",
  "farmer.money.settled",
  "farmer.money.settled_no_utr",
  "farmer.money.failed",
  "farmer.money.reversed",
  "farmer.money.partly_back",
  "farmer.money.direct.ask",
  "farmer.money.direct.said_got",
  "farmer.money.direct.said_not_yet",
  "farmer.money.direct.buyer_says",
  "farmer.payout.none",
  "farmer.payout.checking",
  "farmer.payout.needs_correction",
  "farmer.payout.name_check",
  "farmer.payout.cooling",
  "farmer.payout.ready_bank",
  "farmer.payout.ready_upi",
  "farmer.payout.refused",
  "farmer.payout.route_not_enabled",
  "farmer.payout.withdrawn",
];

test("A5 every money and payout key AIAIC says (recorded or listed) is worded in en, mr and hi", () => {
  const seen = new Set(AIAIC_SAY_KEYS);
  for (const name of MINE_FIXTURES) {
    const mine = mineOf(name);
    for (const o of mine.orders) if (o.money?.say?.key) seen.add(o.money.say.key);
    if (mine.payout_account?.say?.key) seen.add(mine.payout_account.say.key);
  }
  for (const key of seen) {
    for (const lang of ["en", "mr", "hi"] as const) {
      assert.ok(DICTS[lang][`aiaic.${key}`], `${lang} has no words for ${key}`);
    }
  }
});

test("A6 offers are AIAIC's own: Accept only where AIAIC says the offer can be accepted", () => {
  const withOffer = mineOf("practice_mine_with_offer");
  const views = offerViews(withOffer);
  assert.equal(views.length, 1);
  assert.equal(views[0]?.canAnswer, true);
  assert.equal(views[0]?.chip, "open");
  const expired = offerViews(mineOf("farmer_app_mine_offer_expired"));
  assert.ok(
    expired.some((v) => v.chip === "expired" && !v.canAnswer),
    "an expired offer has no Accept",
  );
  for (const v of [...views, ...expired]) {
    if (v.canAnswer) assert.equal(v.offer.can_accept, true);
  }
});

test("A7 the payments page's totals: agreed leaves out a called-off sale, sent counts only Razorpay's word", () => {
  const settled = mineOf("payout_mine_settled");
  const m = moneyTotals(settled.orders);
  assert.equal(m.settled, 79600);
  assert.equal(m.sentToHer, 79600);
  const refundOrders = mineOf("farmer_app_mine_refund_owed").orders;
  const refund = moneyTotals(refundOrders);
  assert.equal(refund.sentToHer, 0, "a reversed share was never sent to her");
  const standing = refundOrders.filter((o) => o.order_state !== "cancelled");
  assert.ok(standing.length < refundOrders.length, "the recording has a called-off sale");
  assert.equal(
    refund.agreed,
    standing.reduce((sum, o) => sum + o.amount_inr, 0),
    "a called-off sale is not agreed money",
  );
});

test("A15 every code her screens word from AIAIC's answers has words in en, mr and hi", () => {
  const keys = new Set<string>();
  for (const name of MINE_FIXTURES) {
    const mine = mineOf(name);
    for (const l of mine.listings) {
      keys.add(`aiaic.lots.status.${l.status}`);
      for (const o of l.offers) {
        if (o.why_not_accept) keys.add(`aiaic.refused.${o.why_not_accept.code}`);
        if (o.terms_code) keys.add(`aiaic.terms.${o.terms_code}`);
        if (o.buyer_type) keys.add(`aiaic.buyer.${o.buyer_type}`);
      }
    }
    for (const o of mine.orders) {
      keys.add(`aiaic.pay.state.${o.payment.state}`);
      if (o.her_next_step) keys.add(`aiaic.sale.next.${o.her_next_step}`);
      if (o.cancel_reason_code) keys.add(`aiaic.sale.cancel_reason.${o.cancel_reason_code}`);
      if (o.terms_code) keys.add(`aiaic.terms.${o.terms_code}`);
      if (o.buyer_type) keys.add(`aiaic.buyer.${o.buyer_type}`);
    }
    const why = mine.payout_account?.why_not_offered?.code;
    if (why) keys.add(`aiaic.refused.${why}`);
  }
  assert.ok(keys.size >= 15, `only ${keys.size} codes read`);
  for (const key of keys) {
    for (const lang of ["en", "mr", "hi"] as const)
      assert.ok(DICTS[lang][key], `${lang} has no words for ${key}`);
  }
});

function est(name: string): TransportEstimate {
  return answer<TransportEstimate>(name);
}

test("A8 the transport card: a road is drawn as a road, an estimate dashed, every credit kept", () => {
  const road = est("transport_estimate_road");
  const guess = est("transport_estimate_estimate");
  assert.equal(road.distance.method, "road");
  const r = routeSketch(road, 320, 110);
  assert.equal(r.dashed, false);
  assert.equal(r.path.split(" ").length, road.route?.coordinates.length);
  const g = routeSketch(guess, 320, 110);
  assert.equal(g.dashed, true, "an estimate is never drawn as a road");
  assert.equal(g.path.split(" ").length, 2);
  for (const p of [...r.path.split(" "), ...g.path.split(" ")]) {
    const [x, y] = p.slice(1).split(",").map(Number);
    assert.ok(x !== undefined && x >= 0 && x <= 320 && y !== undefined && y >= 0 && y <= 110);
  }
  const credits = attributionsOf(road.attribution).map((a) => a.text);
  assert.equal(credits[0], "© OpenStreetMap contributors");
  assert.ok(credits.includes("Powered by Geoapify"), "Geoapify's road keeps its credit");
  assert.deepEqual(
    attributionsOf(guess.attribution).map((a) => a.text),
    ["© OpenStreetMap contributors"],
  );
  assert.deepEqual(
    attributionsOf([], []).map((a) => a.text),
    ["© OpenStreetMap contributors"],
    "OpenStreetMap's credit stays even when an answer carries none",
  );
});

test("A9 the vehicle in her language, each rate source with its date, MSRTC's chart as its own", () => {
  const guess = est("transport_estimate_estimate");
  assert.equal(vehicleName(guess, "mr"), "एस / दोस्त / पिकअप (1.5 टन)");
  assert.equal(vehicleName(guess, "en"), "ACE / DOST / PICKUP (1.5 TON)");
  const sources = rateSources(guess);
  assert.ok(sources.length >= 2);
  for (const s of sources) assert.ok(s.url.startsWith("https://"), s.name);
  assert.ok(
    sources.some((s) => s.day === "2026-10-10"),
    "TruckGuru's page date is said",
  );
  const msrtc = est("transport_estimate_msrtc");
  assert.equal(msrtc.rate.kind, "official");
  assert.equal(rateSources(msrtc)[0]?.day, "2023-07-31");
  const several = est("transport_estimate_several_trips");
  assert.equal(several.trips, 2);
});

test("A10 every transport note and refusal AIAIC sends is worded in en, mr and hi", () => {
  const codes = new Set<string>();
  for (const name of [
    "transport_estimate_estimate",
    "transport_estimate_road",
    "transport_estimate_msrtc",
    "transport_estimate_several_trips",
    "transport_estimate_short_trip",
  ]) {
    for (const n of est(name).notes) codes.add(`aiaic.transport.note.${n.code}`);
  }
  const refused = answer<{ detail: { reason_code: string } }>("transport_refused_mandi_not_held");
  codes.add(`aiaic.refused.${refused.detail.reason_code}`);
  for (const route of ["urban_urban", "rural_urban", "rural_rural"])
    codes.add(`aiaic.transport.route.${route}`);
  for (const key of codes) {
    for (const lang of ["en", "mr", "hi"] as const)
      assert.ok(DICTS[lang][key], `${lang} has no words for ${key}`);
  }
});

/** Names and codes a Marathi or Hindi line may carry in Latin letters (the owner's rule: names and numbers only). */
const LATIN_ALLOWED = new Set([
  "AIAIC",
  "Razorpay",
  "Geoapify",
  "OpenStreetMap",
  "MSRTC",
  "PAN",
  "IFSC",
  "UPI",
  "https",
]);

test("A11 every new line is in en, mr and hi, with the same blanks, and mr/hi carry no English word", () => {
  const keys = Object.keys(DICTS.en).filter((k) => k.startsWith("aiaic."));
  assert.ok(keys.length > 150, `only ${keys.length} lines`);
  const blanks = (s: string) => (s.match(/\{[a-z_]+\}/g) ?? []).sort().join(",");
  for (const lang of ["mr", "hi"] as const) {
    const extra = Object.keys(DICTS[lang]).filter(
      (k) => k.startsWith("aiaic.") && !(k in DICTS.en),
    );
    assert.deepEqual(extra, [], `${lang} has lines English has not`);
    for (const key of keys) {
      const line = DICTS[lang][key];
      assert.ok(line, `${lang} has no ${key}`);
      assert.equal(blanks(line), blanks(DICTS.en[key] ?? ""), `${lang} ${key}: other blanks`);
      const words = line.replace(/\{[a-z_]+\}/g, "").match(/[A-Za-z]+/g) ?? [];
      for (const w of words) assert.ok(LATIN_ALLOWED.has(w), `${lang} ${key}: English word "${w}"`);
    }
  }
});

test("A12 her payout details are checked as AIAIC checks them; the field is named, never the value", () => {
  const good = {
    destination: "bank_account" as const,
    pan: "AAAPZ4321K",
    name_on_pan: "Practice Payee Testname",
    account_number: "000123456789",
    ifsc: "RECT0000001",
  };
  assert.equal(payoutDetailsProblem(good), null);
  assert.equal(payoutDetailsProblem({ ...good, pan: "AAAPZ4321" }), "pan");
  assert.equal(payoutDetailsProblem({ ...good, pan: "1AAPZ4321K" }), "pan");
  assert.equal(payoutDetailsProblem({ ...good, name_on_pan: "R" }), "name_on_pan");
  assert.equal(payoutDetailsProblem({ ...good, ifsc: "RECT1000001" }), "ifsc");
  assert.equal(payoutDetailsProblem({ ...good, account_number: "12" }), "account_number");
  assert.equal(payoutDetailsProblem({ ...good, upi_id: "a@b" }), "upi_id");
  const upi = {
    destination: "upi_id" as const,
    pan: "AAAPZ4321K",
    name_on_pan: "Practice Payee Testname",
    upi_id: "practicepayee@rzptest",
  };
  assert.equal(payoutDetailsProblem(upi), null);
  assert.equal(payoutDetailsProblem({ ...upi, upi_id: "no-at-sign" }), "upi_id");
  assert.equal(payoutDetailsProblem({ ...upi, ifsc: "RECT0000001" }), "account_number");
});

test("A13 one press, one key: AIAIC's key shape, never the same twice", () => {
  const a = newPressKey();
  const b = newPressKey();
  assert.match(a, PRESS_KEY_RE);
  assert.notEqual(a, b);
});

test("A14 AIAIC's refusals become codes with their facts; a plain detail never becomes a code it is not", () => {
  const far = recorded("farmer_app_price_far_refused");
  const p = client.refusalOf(far._recorded?.status ?? 0, far.answer);
  assert.equal(p.code, "price_far_from_market");
  const range = p.facts?.["range"] as Record<string, unknown>;
  assert.equal(range["lowest_per_q"], 3550);
  assert.equal(range["highest_per_q"], 4300);
  assert.equal(
    client.refusalOf(409, answer("farmer_app_accept_refused_lot_sold")).code,
    "lot_sold",
  );
  assert.equal(client.refusalOf(403, answer("farmer_app_not_a_farmer")).code, "farmers_only");
  assert.equal(
    client.refusalOf(422, answer("payout_mine_refused_no_press")).code,
    "payout_consent_required",
  );
  assert.equal(client.refusalOf(404, { detail: "That district is not held." }).code, "not_found");
  assert.equal(client.refusalOf(422, { detail: [{ loc: ["body"], msg: "x" }] }).code, "invalid");
  assert.equal(
    client.refusalOf(400, { detail: { error: "unknown query parameter(s)", unknown: ["x"] } }).code,
    "refused",
  );
  assert.equal(client.refusalOf(503, { detail: "database unavailable" }).code, "aiaic_unavailable");
});

// ---------------------------- A, push 2 audit fix round (24 Oct 2026): ANN-1 to ANN-6 and ENG-01's rule for her screen

const LANGS = ["en", "mr", "hi"] as const;
/** This app's `t()` (i18n.tsx) in one language: her words, else English, else the key; only the given blanks filled. */
function wordsIn(lang: (typeof LANGS)[number]) {
  return (key: string, vars?: Record<string, string | number>): string => {
    const template = DICTS[lang][key] ?? DICTS.en[key] ?? key;
    if (!vars) return template;
    return Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
      template,
    );
  };
}
const HOLE = /\{[a-z_]+\}/;
const blanksOf = (s: string | undefined) => new Set((s ?? "").match(/\{[a-z_]+\}/g) ?? []);

type Derived = {
  _derived: { from: string; changes: { path: (string | number)[]; value: unknown }[] };
  answer: unknown;
};
const DERIVED = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, "derived_mine_report_without_amount.json"), "utf-8"),
) as Derived;

test("A16 ANN-1 a sentence never shows a hole: a fact AIAIC did not send is said by the same sentence without it", () => {
  for (const [key, [facts, without]] of Object.entries(WITHOUT)) {
    for (const lang of LANGS) {
      const full = blanksOf(DICTS[lang][`aiaic.${key}`]);
      const any = DICTS[lang][`aiaic.${without}`];
      assert.ok(any, `${lang} has no words for ${without}`);
      for (const f of facts) {
        assert.ok(full.has(`{${f}}`), `${lang} ${key} prints no {${f}}`);
        assert.ok(!blanksOf(any).has(`{${f}}`), `${lang} ${without} still prints {${f}}`);
      }
      const none = Object.fromEntries(facts.map((f) => [f, null]));
      const prefix = key.startsWith("farmer.payout.") ? "payout" : "money";
      const said = moneySaid(wordsIn(lang), prefix, { key, values: { amount: 79600, ...none } });
      assert.ok(said && !HOLE.test(said), `${lang} ${key} without ${facts.join("/")}: "${said}"`);
    }
    assert.equal(keyFor(key, Object.fromEntries(facts.map((f) => [f, "x"]))), key);
    assert.equal(keyFor(key, {}), without);
  }

  // the derived fixture is its recording with only the listed changes (it cannot drift from either)
  const rebuilt = structuredClone(answer<unknown>(DERIVED._derived.from.replace(/\.json$/, "")));
  for (const c of DERIVED._derived.changes) {
    let node: any = rebuilt;
    for (const step of c.path.slice(0, -1)) node = node[step];
    node[c.path[c.path.length - 1] as string | number] = c.value;
  }
  assert.deepEqual(rebuilt, DERIVED.answer, "derived = its recording + the listed changes");

  // her report sent without an amount: AIAIC keeps no amount, and her sentence says none
  const direct = client
    .mineForBrowser(DERIVED.answer)
    .orders.find((o) => o.money?.route === "direct") as AiaicOrder;
  assert.equal(direct.money?.say?.key, "farmer.money.direct.said_got");
  assert.equal(direct.money?.say?.values["amount"], null);
  for (const lang of LANGS) {
    const said = moneySaid(wordsIn(lang), "money", direct.money?.say ?? null);
    assert.equal(said, DICTS[lang]["aiaic.farmer.money.direct.said_got_any"], lang);
  }

  // every sentence AIAIC said in the recordings, in each language: no hole, no raw key
  for (const name of MINE_FIXTURES) {
    const mine = mineOf(name);
    const says: ["money" | "payout", AiaicSay][] = [];
    for (const o of mine.orders) says.push(["money", o.money?.say ?? null]);
    says.push(["payout", mine.payout_account?.say ?? null]);
    for (const lang of LANGS) {
      for (const [prefix, say] of says) {
        const s = moneySaid(wordsIn(lang), prefix, say);
        if (s !== null)
          assert.ok(!HOLE.test(s) && !s.includes("aiaic."), `${name} ${lang}: "${s}"`);
      }
    }
  }

  // a reason is always said in words: AIAIC's code when this app has words for it, else "other"
  const en = wordsIn("en");
  assert.equal(reasonKey(en, "money", "vpa_inactive"), "aiaic.farmer.money.reason.vpa_inactive");
  assert.equal(reasonKey(en, "money", "account_frozen"), "aiaic.farmer.money.reason.other");
  assert.equal(reasonKey(en, "payout", undefined), "aiaic.farmer.payout.reason.other");
  const failed = moneySaid(en, "money", {
    key: "farmer.money.failed",
    values: { amount: 100, reason: "account_frozen" },
  });
  assert.ok(failed?.includes(DICTS.en["aiaic.farmer.money.reason.other"] ?? "?"), `"${failed}"`);
  const fix = moneySaid(en, "payout", {
    key: "farmer.payout.needs_correction",
    values: { hint: null, time: null, reason: null },
  });
  assert.ok(fix?.includes(DICTS.en["aiaic.farmer.payout.reason.other"] ?? "?"), `"${fix}"`);
});

test("A17 ENG-01 'Did the buyer pay you?' only where the money is outside AIAIC or her produce was handed over", () => {
  const en = wordsIn("en");
  const fresh = mineOf("payout_mine_offered").orders.find((o) => o.money?.can_report) as AiaicOrder;
  assert.ok(fresh, "the recording's practice order AIAIC takes her word on");
  assert.equal(fresh.order_state, "accepted");
  assert.equal(fresh.payment.link_made, false);
  assert.equal(
    asksHerWord(fresh),
    false,
    "just accepted, no link yet: no question (a 'Not yet' closes the link)",
  );
  assert.equal(moneyCard(en, fresh), null, "and no money card on that order");
  const step = (stage: string) => ({ stage, status: "done", created_at: fresh.created_at });
  const handed = { ...fresh, fulfilment: [step("pickup")] };
  assert.equal(asksHerWord(handed), true, "handed over: she is asked");
  assert.deepEqual(moneyCard(en, handed), {
    line: DICTS.en["aiaic.farmer.money.direct.ask"],
    asks: true,
  });
  assert.equal(asksHerWord({ ...fresh, fulfilment: [step("delivery_exception")] }), false);
  const direct = client
    .mineForBrowser(DERIVED.answer)
    .orders.find((o) => o.money?.route === "direct") as AiaicOrder;
  assert.equal(direct.fulfilment.length, 0);
  assert.equal(asksHerWord(direct), true, "the money recorded as outside AIAIC: she is asked");
  assert.equal(moneyCard(en, direct)?.line, DICTS.en["aiaic.farmer.money.direct.said_got_any"]);
  const money = handed.money as NonNullable<AiaicOrder["money"]>;
  assert.equal(asksHerWord({ ...handed, money: { ...money, can_report: false } }), false);
  for (const name of MINE_FIXTURES)
    for (const o of mineOf(name).orders)
      if (asksHerWord(o)) assert.equal(o.money?.can_report, true);
  // no screen reads `can_report` itself: her question and buttons come from `moneyCard` only
  const dir = path.join(APP, "src", "components", "farm", "aiaic");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".tsx")))
    assert.ok(!fs.readFileSync(path.join(dir, file), "utf-8").includes("can_report"), file);
  assert.ok(
    fs.readFileSync(path.join(dir, "AiaicOrderDetail.tsx"), "utf-8").includes("card?.asks"),
    "her buttons show only where moneyCard asks",
  );
});

/** AIAIC's recorded list of Maharashtra's districts (GET /places/districts?state=mh&lang=en, copied from AIAIC). */
const MH_DISTRICTS = answer<{ districts: DistrictRow[] }>("places_districts_mh_en").districts;

test("A18 ANN-2 the transport card starts from the district her pickup names; none named: she chooses", () => {
  assert.equal(MH_DISTRICTS.length, 36);
  const store = JSON.parse(
    fs.readFileSync(path.join(APP, "data", "transactions.json"), "utf-8"),
  ) as { orders: { id: string; pickupLocation: string; deliveryDestination: string }[] };
  const start = (id: string) => {
    const o = store.orders.find((x) => x.id === id);
    assert.ok(o, id);
    return { pickup: startDistrict(MH_DISTRICTS, [], o.pickupLocation), o };
  };
  assert.equal(start("ORD-20261019-8421").pickup, "kolhapur", "'Shirol, Kolhapur District'");
  const gate = start("ORD-20261021-9964");
  assert.equal(gate.pickup, "", "'Main Farm Gate / APMC Depot' names no district: she chooses");
  assert.equal(
    startDistrict(MH_DISTRICTS, [], `${gate.o.pickupLocation} ${gate.o.deliveryDestination}`),
    "kolhapur",
    "with the destination read too it would start at the BUYER's district",
  );
  const page = fs.readFileSync(path.join(APP, "src", "routes", "orders.$orderId.tsx"), "utf-8");
  const at = page.indexOf("<TransportCostCard");
  const card = page.slice(at, page.indexOf("/>", at));
  assert.match(card, /fromText=\{order\.pickupLocation\}/, "the order page passes her pickup only");
  assert.ok(
    !card.includes("deliveryDestination"),
    "the buyer's end is never read for her district",
  );

  assert.equal(startDistrict(MH_DISTRICTS, [], "Near Pune road, Nashik"), "pune");
  assert.equal(startDistrict(MH_DISTRICTS, [], "Punerkar Wadi"), "", "whole words only");
  assert.equal(startDistrict(MH_DISTRICTS, [], "Mumbai Suburban depot"), "mumbai sub");
  assert.equal(startDistrict(MH_DISTRICTS, [], "near Aurangabad"), "aurangabad");
  assert.equal(startDistrict(MH_DISTRICTS, [], "Chhatrapati Sambhajinagar APMC"), "aurangabad");
  assert.equal(
    startDistrict(MH_DISTRICTS, ["Nashik"], "Kolhapur"),
    "nashik",
    "the sale's district first",
  );
  assert.equal(startDistrict(MH_DISTRICTS, [null, "Ahilyanagar"], null), "ahmednagar");
  assert.equal(startDistrict(MH_DISTRICTS, ["Indore"], null), "", "not in the list: she chooses");
  assert.equal(startDistrict(MH_DISTRICTS, [], ""), "");
  for (const file of ["TransportCostCard.tsx", "AiaicSellForm.tsx"]) {
    const src = fs.readFileSync(
      path.join(APP, "src", "components", "farm", "aiaic", file),
      "utf-8",
    );
    assert.ok(!src.includes("districtList[0]"), `${file} falls back to the list's first district`);
    assert.ok(src.includes("startDistrict("), `${file} does not start from startDistrict`);
  }
});

test("A19 ANN-3 MSRTC's official chart is said in her language; its full English name only in the link's title", () => {
  const msrtc = est("transport_estimate_msrtc");
  for (const lang of LANGS) {
    const t = wordsIn(lang);
    const links = sourcesSaid(t, msrtc);
    assert.equal(links.length, 1);
    assert.equal(links[0]?.text, t("aiaic.transport.source.official", { day: "2023-07-31" }));
    assert.equal(links[0]?.title, msrtc.rate.source?.name);
    if (lang === "en") continue;
    for (const w of (links[0]?.text ?? "").match(/[A-Za-z]+/g) ?? [])
      assert.ok(LATIN_ALLOWED.has(w), `${lang}: English word "${w}" in "${links[0]?.text}"`);
  }
  const several = est("transport_estimate_several_trips");
  assert.deepEqual(
    sourcesSaid(wordsIn("mr"), several).map((s) => s.text),
    [
      "TruckGuru (2026-10-10)",
      "Mukund Logistics (2026-09-09)",
      `fr8.in (${DICTS.mr["aiaic.transport.undated"]})`,
    ],
  );
  for (const s of sourcesSaid(wordsIn("hi"), several))
    assert.ok(s.url.startsWith("https://"), `${s.text}: ${s.url}`);
  const card = fs.readFileSync(
    path.join(APP, "src", "components", "farm", "aiaic", "TransportCostCard.tsx"),
    "utf-8",
  );
  assert.ok(card.includes("sourcesSaid(t, est)"), "the card's sources line is sourcesSaid's");
  assert.ok(!card.includes("rateSources("), "no source name printed as it comes");
});

test("A20 ANN-4/ANN-6 a press never hangs, and AIAIC's crisis card turns the whole page into it", async () => {
  const thrown = await pressed<true>(() => Promise.reject(new Error("this server not reached")));
  assert.equal(!thrown.ok ? thrown.problem.code : "", "aiaic_unavailable");
  assert.deepEqual(await pressed(() => Promise.resolve({ ok: true as const, data: 7 })), {
    ok: true,
    data: 7,
  });
  const raised: AiaicProblem[] = [];
  const raise = (p: AiaicProblem) => void raised.push(p);
  const crisis = problem("crisis", {
    status: 200,
    crisis: { answer: null, message: null, helplines: [{ name: "Tele-MANAS", phone: "14416" }] },
  });
  const refusal: AiaicResult<true> = { ok: false, problem: crisis };
  assert.deepEqual(await pressAndRaise(() => Promise.resolve(refusal), raise), refusal);
  assert.deepEqual(raised, [crisis], "the crisis card is raised to the page");
  await pressAndRaise<true>(
    () => Promise.resolve({ ok: false, problem: problem("lot_sold", { status: 409 }) }),
    raise,
  );
  await pressAndRaise<true>(() => Promise.reject(new Error("lost")), raise);
  assert.equal(raised.length, 1, "a refusal or a lost call raises nothing");

  // every press of the AIAIC screens goes through `press` (never hanging; the crisis raised)
  const WRITES = [
    "sellProduce",
    "answerOffer",
    "stopSelling",
    "givePayoutAccount",
    "withdrawPayoutAccount",
    "reportPayment",
  ];
  const dir = path.join(APP, "src", "components", "farm", "aiaic");
  let presses = 0;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
    const src = fs.readFileSync(path.join(dir, file), "utf-8");
    for (const m of src.matchAll(/const (\w+) = useServerFn\((\w+)\)/g)) {
      if (!WRITES.includes(m[2] ?? "")) continue;
      const calls = [...src.matchAll(new RegExp(`(press\\(\\(\\) =>\\s*)?\\b${m[1]}\\(`, "g"))];
      assert.ok(calls.length > 0, `${file}: ${m[1]} is never called`);
      for (const c of calls)
        assert.ok(c[1], `${file}: ${m[1]}(...) is not inside press(() => ...)`);
      presses += calls.length;
    }
  }
  assert.equal(
    presses,
    6,
    "sell, answer an offer, stop selling, give and stop her payout account, her report",
  );

  // the page's gate: with a crisis raised, the crisis card alone; without, the page
  const page = (raisedCrisis: AiaicProblem | null) =>
    renderToString(
      createElement(I18nProvider, {
        children: createElement(CrisisOnly, {
          crisis: raisedCrisis,
          children: createElement("p", null, "Paid by buyers ₹79,600"),
        }),
      }),
    );
  const on = page(crisis);
  assert.ok(
    on.includes("14416") && on.includes(DICTS.en["aiaic.crisis.title"] ?? "?"),
    "the helplines lead",
  );
  assert.ok(!on.includes("Paid by buyers"), "nothing of the page beside the crisis card");
  const off = page(null);
  assert.ok(off.includes("Paid by buyers") && !off.includes("14416"), "no crisis: the page");
  const bits = fs.readFileSync(path.join(dir, "AiaicBits.tsx"), "utf-8");
  assert.match(
    bits,
    /<CrisisFirst>\{aiaic\(\)\}<\/CrisisFirst>/,
    "every AIAIC page sits in the gate",
  );
  assert.match(
    bits,
    /if \(problem\.crisis && raise\) raise\(problem\);/,
    "a crisis problem is raised",
  );
});

test("A21 ANN-5 the demo store says where its sales are kept; the doc names its order page's AIAIC calls", () => {
  // (each assertion carries its message: a failing one without it ran for minutes in a planted-defect run, 24 Oct;
  // node:assert words such a failure from this file's source)
  const said = "its order page reads AIAIC's transport routes";
  assert.ok(!/not connected/i.test(DICTS.en["aiaic.local.line"] ?? "not connected"), said);
  assert.ok(!(DICTS.mr["aiaic.local.line"] ?? "जोडलेले नाही").includes("जोडलेले नाही"), said);
  assert.ok(!(DICTS.hi["aiaic.local.line"] ?? "जुड़ा नहीं").includes("जुड़ा नहीं"), said);
  const doc = fs.readFileSync(path.join(APP, "..", "ANNAPOORNA_INTEGRATION.md"), "utf-8");
  assert.ok(!/without the settings nothing changes/i.test(doc), "the doc names the exception");
  assert.match(doc, /transport cost card/);
  assert.ok(doc.includes(FALLBACK_BASE_URL), "the default address it calls is named");
});

// ------------------ A, push 2n (24 Oct 2026): places said in her language from AIAIC's names (contract section 20)

/**
 * AIAIC's push-2n recordings (real answers of its routes as they answer once push 2n is deployed, copied from AIAIC's
 * repo unchanged): the mandis near Nashik and a trip from Nashik to Lasalgaon with each place's `names`, and two Get my
 * advice answers whose market card compares mandis with `mandi_shown`, in Marathi (onion, Nashik) and Hindi (soybean,
 * Indore). The answers of the server deployed before it (`transport_nearby_nashik`, `transport_estimate_estimate`)
 * carry no names: the page then says every place as before.
 */
const NAMED_NEARBY = "transport_nearby_nashik_named";
const NAMED_TRIP = "transport_estimate_lasalgaon_named";
const NAMED_ADVICE = {
  mr: "farmer_advice_onion_nashik_mr_named",
  hi: "farmer_advice_soybean_indore_hi_named",
} as const;
type RawNames = { en: string; mr: string; hi: string; translated: { mr: boolean; hi: boolean } };
type RawNearby = { mandis: { mandi: string; names: RawNames }[] };
const LATIN = /[A-Za-z]/;
const APMC = /\bAPMC\b/i;

test("A22 a mandi near her is said in her language from AIAIC's names; its key stays; no names: as before", () => {
  const raw = answer<RawNearby>(NAMED_NEARBY);
  const kept = client.nearbyForBrowser(raw);
  assert.ok(kept.mandis.length >= 10, `only ${kept.mandis.length} mandis`);
  assert.equal(kept.mandis.length, raw.mandis.length);
  const allowed = new Set([
    "mandi",
    "state",
    "district_key",
    "straight_km",
    "road_km_estimate",
    "lat",
    "lon",
    "names",
  ]);
  const said = { mr: { whole: 0, latinKept: 0 }, hi: { whole: 0, latinKept: 0 } };
  kept.mandis.forEach((m, i) => {
    const r = raw.mandis[i]!;
    for (const k of Object.keys(m)) assert.ok(allowed.has(k), `${k} left the server`);
    assert.equal(m.mandi, r.mandi, "the key is AIAIC's label, unchanged");
    assert.deepEqual(m.names, r.names, `${r.mandi}: the names as AIAIC sent them`);
    assert.equal(placeShown(m.names, "en", m.mandi), r.names.en);
    for (const lang of ["mr", "hi"] as const) {
      const shown = placeShown(m.names, lang, m.mandi);
      assert.equal(shown, r.names[lang], `${r.mandi} in ${lang}`);
      assert.notEqual(
        shown,
        m.mandi,
        `${lang}: the market committee "${m.mandi}" is said in her words`,
      );
      assert.ok(!APMC.test(shown), `${lang}: "${shown}" says APMC`);
      if (r.names.translated[lang]) {
        assert.ok(
          !LATIN.test(shown),
          `${lang}: "${shown}" is said whole yet carries Latin letters`,
        );
        said[lang].whole += 1;
      } else said[lang].latinKept += 1;
    }
  });
  // both kinds are in the recording: a town said whole, and a town with no name held kept as written (never guessed)
  for (const lang of ["mr", "hi"] as const) {
    assert.ok(
      said[lang].whole > 0 && said[lang].latinKept > 0,
      `${lang}: ${JSON.stringify(said[lang])}`,
    );
  }

  // a server not yet updated: no names leave this server, and every mandi is said by its label, as before
  const before = client.nearbyForBrowser(answer("transport_nearby_nashik"));
  assert.ok(before.mandis.length > 0, "today's recorded answer holds mandis");
  for (const m of before.mandis) {
    assert.equal("names" in m, false, `${m.mandi}: names made up`);
    for (const lang of LANGS) assert.equal(placeShown(m.names, lang, m.mandi), m.mandi);
  }

  // names of another shape are not passed on, and a blank name is no name
  assert.equal(namesOf(null), null);
  assert.equal(namesOf("Nashik"), null);
  assert.equal(namesOf({ mr: 5, hi: ["x"], en: " " }), null);
  assert.deepEqual(namesOf({ en: "Nashik", translated: { mr: "yes", hi: true }, extra: "x" }), {
    en: "Nashik",
    translated: { hi: true },
  });
  assert.equal(placeShown({ en: "Nashik", mr: "  " }, "mr", "Nashik"), "Nashik");
  assert.equal(placeShown(null, "hi", null), "");
});

test("A23 the map names her district and every mandi in her language; places are told apart by their keys", () => {
  const trip = est(NAMED_TRIP);
  const near = client.nearbyForBrowser(answer(NAMED_NEARBY)).mandis;
  const pageName = "her district, as the page's own list names it";
  assert.ok(
    near.some((m) => m.mandi === trip.to.mandi),
    "the chosen mandi is in the list near her",
  );
  for (const lang of LANGS) {
    const map = routeMapOf(trip, lang, pageName, near);
    const [home, chosen, ...dots] = map.places;
    assert.equal(home?.kind, "home");
    assert.equal(home?.label, trip.from.names?.[lang], `${lang}: her district by AIAIC's names`);
    assert.equal(chosen?.kind, "chosen");
    assert.equal(chosen?.label, trip.to.names?.[lang], `${lang}: the mandi chosen`);
    const others = near.filter((m) => m.mandi !== trip.to.mandi).slice(0, NEARBY_DOTS);
    assert.equal(others.length, near.length - 1, "the chosen mandi is not drawn twice");
    assert.deepEqual(
      dots.map((d) => d.label),
      others.map((m) => m.names?.[lang]),
      `${lang}: every dot by its names`,
    );
    if (lang !== "en") {
      for (const p of map.places) assert.ok(!APMC.test(String(p.label)), `${lang}: ${p.label}`);
    }
  }
  // names change no line and no distance
  const en = routeMapOf(trip, "en", pageName, near);
  for (const lang of ["mr", "hi"] as const) {
    const said = routeMapOf(trip, lang, pageName, near);
    assert.deepEqual(said.route, en.route);
    assert.deepEqual(said.distance, en.distance);
    assert.deepEqual(
      said.places.map((p) => [p.lat, p.lon, p.kind]),
      en.places.map((p) => [p.lat, p.lon, p.kind]),
    );
  }

  // the two names on the map never cover each other: the more southern one is said below its dot, every other above
  const drawn = en.places.map((p) => ({ lat: Number(p.lat), kind: p.kind }));
  const below = drawn.map((p) => nameBelow(p, drawn));
  assert.equal(
    below[0],
    drawn[0]!.lat < drawn[1]!.lat,
    "her district below when it is the more southern",
  );
  assert.equal(below[1], !below[0], "one of the two names above its dot, the other below");
  assert.ok(
    below.slice(2).every((b) => !b),
    "every other mandi's name above its dot",
  );
  const level = [
    { lat: 20, kind: "home" as const },
    { lat: 20, kind: "chosen" as const },
  ];
  assert.deepEqual(
    level.map((p) => nameBelow(p, level)),
    [false, true],
    "on one latitude: still one below",
  );
  assert.equal(nameBelow(drawn[0]!, drawn.slice(0, 1)), false, "one name alone: above its dot");

  // a server not yet updated: her district by the page's own name, else AIAIC's; a mandi by its label, as before
  const old = est("transport_estimate_estimate");
  const oldNear = client.nearbyForBrowser(answer("transport_nearby_nashik")).mandis;
  for (const lang of LANGS) {
    const map = routeMapOf(old, lang, pageName, oldNear);
    assert.equal(map.places[0]?.label, pageName);
    assert.equal(map.places[1]?.label, old.to.mandi);
    assert.deepEqual(
      map.places.slice(2).map((p) => p.label),
      oldNear
        .filter((m) => m.mandi !== old.to.mandi)
        .slice(0, NEARBY_DOTS)
        .map((m) => m.mandi),
    );
    assert.equal(routeMapOf(old, lang, null, oldNear).places[0]?.label, old.from.district);
  }
});

test("A24 the mandis an advice compared: AIAIC's rows[].mandi_shown, the key kept; mr and hi say no APMC", () => {
  type RawCompare = {
    headline: string;
    rows: { mandi: string; mandi_shown: string; role: string }[];
  };
  for (const lang of ["mr", "hi"] as const) {
    const raw = answer<{ lang?: string; cards: { summary?: { price_compare?: RawCompare } }[] }>(
      NAMED_ADVICE[lang],
    );
    const compared = raw.cards.flatMap((c) =>
      c.summary?.price_compare ? [c.summary.price_compare] : [],
    );
    assert.ok(compared.length >= 1, `${lang}: no card compares mandis`);
    for (const pc of compared) {
      const compare = priceCompareOf(pc);
      assert.ok(compare, `${lang}: the comparison is read`);
      assert.equal(compare.rows.length, pc.rows.length);
      compare.rows.forEach((row, i) => {
        const r = pc.rows[i]!;
        assert.equal(row.mandi, r.mandi, "the key stays AIAIC's label");
        assert.equal(row.mandi_shown, r.mandi_shown, "read by the contract's own field name");
        assert.equal(rowShown(row), r.mandi_shown);
        assert.notEqual(rowShown(row), row.mandi, `${lang}: "${row.mandi}" is said in her words`);
        assert.ok(!APMC.test(rowShown(row)), `${lang}: "${rowShown(row)}" says APMC`);
      });
      // the bars and AIAIC's own sentence name the chosen mandi the same way
      const chosen = compare.rows.find((r) => r.role === "chosen");
      assert.ok(chosen, `${lang}: no chosen mandi`);
      assert.ok(compare.headline?.includes(rowShown(chosen)), `${lang}: ${compare.headline}`);
      // a server not yet updated sends no mandi_shown: each mandi is said by its label, as before
      const before = priceCompareOf({
        ...pc,
        rows: pc.rows.map(({ mandi_shown: _shown, ...rest }) => rest),
      });
      assert.deepEqual(
        before?.rows.map(rowShown),
        pc.rows.map((r) => r.mandi),
      );
    }
  }
});

// --------------------------------------------------------- B. the server client against a stand-in AIAIC

const USER = "standin-practice-farmer";
const PASSWORD = "standin-password-not-real-41f9";
const PAN = "AAAPZ4321K";

type StandIn = {
  url: string;
  logins: number;
  tokenNo: number;
  posts: { path: string; key: string | undefined; body: Record<string, unknown> }[];
  gets: { path: string; query: URLSearchParams }[];
  practice: boolean;
  role: string;
  wrongPassword: boolean;
  expireNext: boolean;
  distressOnWrite: boolean;
  /** The fixture GET /farmer/trade answers with, when set (else by `practice`). */
  mine: string | null;
  /** The fixture GET /transport/nearby-mandis answers with. */
  nearby: string;
  close: () => Promise<void>;
};

async function standIn(): Promise<StandIn> {
  const s: StandIn = {
    url: "",
    logins: 0,
    tokenNo: 0,
    posts: [],
    gets: [],
    practice: true,
    role: "farmer",
    wrongPassword: false,
    expireNext: false,
    distressOnWrite: false,
    mine: null,
    nearby: "transport_nearby_nashik",
    close: async () => {},
  };
  const valid = () => `standin-token-${s.tokenNo}`;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const u = new URL(req.url ?? "/", "http://127.0.0.1");
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      const text = Buffer.concat(chunks).toString("utf-8");
      const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (u.pathname === "/auth/login" && req.method === "POST") {
        s.logins += 1;
        if (s.wrongPassword || body["password"] !== PASSWORD || body["username"] !== USER) {
          return send(401, { detail: "invalid credentials" });
        }
        s.tokenNo += 1;
        return send(200, {
          access_token: valid(),
          token_type: "bearer",
          expires_at: new Date(Date.now() + 12 * 3600_000).toISOString(),
          role: s.role,
          username: USER,
        });
      }
      if (u.pathname.startsWith("/places/") || u.pathname.startsWith("/transport/")) {
        s.gets.push({ path: u.pathname, query: u.searchParams });
        if (u.pathname === "/places/crops")
          return send(200, { crops: [{ crop: "onion", name: "कांदा" }] });
        if (u.pathname === "/places/districts")
          return send(200, { districts: [{ key: "nashik", name: "नाशिक", name_en: "Nashik" }] });
        if (u.pathname === "/transport/nearby-mandis") return send(200, answer(s.nearby));
        if (u.pathname === "/transport/estimate") {
          if (u.searchParams.get("mandi") === "No Such Mandi Anywhere")
            return send(404, answer("transport_refused_mandi_not_held"));
          return send(200, answer("transport_estimate_road"));
        }
      }
      const auth = req.headers["authorization"];
      if (auth !== `Bearer ${valid()}` || s.expireNext) {
        s.expireNext = false;
        return send(401, answer("farmer_app_session_expired"));
      }
      if (req.method === "GET") {
        s.gets.push({ path: u.pathname, query: u.searchParams });
        if (u.pathname === "/farmer/trade")
          return send(
            200,
            answer(
              s.mine ?? (s.practice ? "practice_mine_with_offer" : "farmer_app_mine_with_offer"),
            ),
          );
        if (u.pathname === "/farmer/trade/price") return send(200, answer("practice_price"));
      }
      if (req.method === "POST") {
        const key = req.headers["idempotency-key"];
        s.posts.push({ path: u.pathname, key: typeof key === "string" ? key : undefined, body });
        if (s.distressOnWrite) {
          return send(200, {
            distress: true,
            answer: "It sounds like things are very hard right now.",
            talk_to_someone: [{ name: "Tele-MANAS (24x7, free)", phone: "14416" }],
          });
        }
        if (u.pathname === "/farmer/trade/listings") {
          if (!body["price_confirmed"]) return send(422, answer("farmer_app_price_far_refused"));
          return send(201, answer("practice_listed"));
        }
        if (u.pathname.endsWith("/accept")) return send(201, answer("practice_accepted"));
        if (u.pathname === "/farmer/trade/payout-account")
          return send(200, answer("farmer_app_refund_payout_account"));
        if (u.pathname.endsWith("/payment-report"))
          return send(201, {
            order_id: u.pathname.split("/")[4] ?? "",
            report: { what: body["what"], amount_inr: body["amount_inr"] ?? null },
            payment_route: "direct",
            settlement_state: "direct",
          });
      }
      return send(404, {
        detail: { reason_code: "not_found", message: "stand-in: no such route" },
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  s.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  s.close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  return s;
}

/** Everything written to the console while `run` runs. */
async function captured<T>(run: () => Promise<T>): Promise<{ value: T; said: string }> {
  const said: string[] = [];
  const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  const grab = (...args: unknown[]) =>
    said.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  console.log = grab;
  console.warn = grab;
  console.error = grab;
  console.info = grab;
  try {
    return { value: await run(), said: said.join("\n") };
  } finally {
    Object.assign(console, keep);
  }
}

function settings(base: string | null, user: string | null, password: string | null) {
  const set = (k: string, v: string | null) => {
    if (v === null) delete process.env[k];
    else process.env[k] = v;
  };
  set("AIAIC_BASE_URL", base);
  set("AIAIC_FARMER_USERNAME", user);
  set("AIAIC_FARMER_PASSWORD", password);
  client.resetForTests();
}

test("B1 no farmer setting: the app's own store; one setting: said by name; a public http address: refused", () => {
  settings(null, null, null);
  assert.deepEqual(client.tradeMode(), { mode: "local" });
  settings("https://aiaic.example.org/api", USER, null);
  const one = client.tradeMode();
  assert.equal(one.mode, "aiaic");
  assert.equal(one.mode === "aiaic" ? one.problem?.code : "", "aiaic_setting_missing");
  assert.equal(one.mode === "aiaic" ? one.problem?.setting : "", "AIAIC_FARMER_PASSWORD");
  settings("http://163.128.209.18:8017", USER, PASSWORD);
  const open = client.tradeMode();
  assert.equal(open.mode === "aiaic" ? open.problem?.code : "", "aiaic_sign_in_needs_https");
  settings("https://krishisampada.example.org/api", USER, PASSWORD);
  assert.deepEqual(client.tradeMode(), { mode: "aiaic", problem: null });
});

test("B2 the password goes only over https or to this machine and its private network", () => {
  const yes = [
    "https://krishisampada.example.org/api",
    "http://127.0.0.1:8017",
    "http://localhost:8017",
    "http://10.1.2.3:8017",
    "http://172.20.0.5:8017",
    "http://192.168.1.20:8017",
    "http://host.docker.internal:8017",
    "http://aiaic-api:8017",
  ];
  const no = [
    "http://163.128.209.18:8017",
    "http://172.32.0.1:8017",
    "http://aiaic.example.org",
    "ftp://127.0.0.1",
    "not a url",
  ];
  for (const u of yes) assert.equal(client.signInAllowed(u), true, u);
  for (const u of no) assert.equal(client.signInAllowed(u), false, u);
});

test("B3 one sign-in serves many calls; the token and password never reach the browser or the console", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    const { value, said } = await captured(async () => {
      const a = await client.getMine("mr");
      const b = await client.getMine("en");
      const c = await client.getPrice({ crop: "onion", state: "mh", district: "nashik" });
      return [a, b, c];
    });
    assert.equal(s.logins, 1, "signed in once");
    for (const r of value) assert.equal(r.ok, true);
    const text = JSON.stringify(value);
    assert.ok(
      !text.includes(PASSWORD) && !text.includes("standin-token"),
      "no password or token in an answer",
    );
    assert.ok(
      !said.includes(PASSWORD) && !said.includes("standin-token"),
      "no password or token logged",
    );
    const first = value[0];
    assert.ok(first?.ok);
    if (first?.ok && "mine" in first.data) {
      assert.equal(
        first.data.cropNames["onion"],
        "कांदा",
        "her crop in her language, from AIAIC's list",
      );
      assert.equal(first.data.districtNames["Nashik"], "नाशिक");
    }
  } finally {
    await s.close();
  }
});

test("B4 a token AIAIC no longer takes is replaced once, and the same press goes again with its same key", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    assert.equal((await client.getMine("en")).ok, true);
    s.expireNext = true;
    const key = newPressKey();
    const r = await client.answerOffer(key, "ofr_dcef2ffada3bd1744a7c", "accept");
    assert.equal(r.ok, true);
    assert.equal(s.logins, 2, "signed in again once");
    const accepts = s.posts.filter((p) => p.path.endsWith("/accept"));
    assert.equal(accepts.length, 1);
    assert.equal(accepts[0]?.key, key, "the press's own key reached AIAIC");
  } finally {
    await s.close();
  }
});

test("B5 a refused sign-in is said and not tried again for a while (AIAIC locks out repeated failures)", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, "a-wrong-password");
    const a = await client.getMine("en");
    const b = await client.getMine("en");
    assert.equal(a.ok, false);
    assert.equal(!a.ok ? a.problem.code : "", "aiaic_sign_in_refused");
    assert.equal(!b.ok ? b.problem.code : "", "aiaic_sign_in_refused");
    assert.equal(s.logins, 1, "the second call did not try the password again");
  } finally {
    await s.close();
  }
});

test("B6 an account that is not a farmer's is refused", async () => {
  const s = await standIn();
  try {
    s.role = "admin";
    settings(s.url, USER, PASSWORD);
    const r = await client.getMine("en");
    assert.equal(!r.ok ? r.problem.code : "", "aiaic_account_not_a_farmer");
  } finally {
    await s.close();
  }
});

test("B7 a real farmer's account is refused: nothing of hers is shown, nothing is written", async () => {
  const s = await standIn();
  try {
    s.practice = false;
    settings(s.url, USER, PASSWORD);
    const r = await client.getMine("en");
    assert.equal(r.ok, false);
    assert.equal(!r.ok ? r.problem.code : "", "aiaic_account_not_practice");
    assert.ok(!JSON.stringify(r).includes("lst_"), "none of her listings reached the browser");
    client.resetForTests();
    const w = await client.sell(newPressKey(), {
      state: "mh",
      district: "nashik",
      crop: "onion",
      quantity_q: 10,
      ask_price_per_q: 3900,
    });
    assert.equal(!w.ok ? w.problem.code : "", "aiaic_account_not_practice");
    assert.equal(s.posts.length, 0, "no write reached AIAIC");
  } finally {
    await s.close();
  }
});

test("B8 a price far from the mandis is asked back; confirmed, the SAME press goes again with its same key", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    const key = newPressKey();
    const sale = {
      state: "mh",
      district: "nashik",
      crop: "onion",
      quantity_q: 10,
      ask_price_per_q: 394200,
    };
    const first = await client.sell(key, sale);
    assert.equal(!first.ok ? first.problem.code : "", "price_far_from_market");
    const range = !first.ok ? (first.problem.facts?.["range"] as Record<string, unknown>) : {};
    assert.equal(range["highest_per_q"], 4300);
    const second = await client.sell(key, { ...sale, price_confirmed: true });
    assert.equal(second.ok, true);
    assert.deepEqual(
      s.posts.map((p) => [p.key, p.body["price_confirmed"] ?? false]),
      [
        [key, false],
        [key, true],
      ],
    );
  } finally {
    await s.close();
  }
});

test("B9 her payout details pass through to AIAIC and are never said back or logged", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    const { value, said } = await captured(() =>
      client.givePayoutAccount(newPressKey(), {
        notice_version: "pn-0b66a47d1399",
        shown_in: "mr",
        destination: "bank_account",
        pan: PAN,
        name_on_pan: "Practice Payee Testname",
        account_number: "000123456789",
        ifsc: "RECT0000001",
      }),
    );
    assert.equal(value.ok, true);
    assert.deepEqual(value.ok ? value.data : null, { status: "created" });
    const sent = s.posts.find((p) => p.path === "/farmer/trade/payout-account");
    assert.equal(sent?.body["pan"], PAN, "AIAIC got her details");
    assert.equal(sent?.body["agreed"], true);
    assert.ok(!JSON.stringify(value).includes(PAN), "her PAN is not said back to the browser");
    assert.ok(
      !said.includes(PAN) && !said.includes("000123456789"),
      "her details are never logged",
    );
  } finally {
    await s.close();
  }
});

test("B10 AIAIC's crisis card outranks everything: the helplines come back, nothing else", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    s.distressOnWrite = true;
    const r = await client.sell(newPressKey(), {
      state: "mh",
      district: "nashik",
      crop: "onion",
      quantity_q: 10,
    });
    assert.equal(r.ok, false);
    const p = !r.ok ? r.problem : null;
    assert.equal(p?.code, "crisis");
    assert.equal(p?.crisis?.helplines[0]?.phone, "14416");
  } finally {
    await s.close();
  }
});

test("B11 transport: kept 30 minutes so a road is not asked twice; a refusal is asked again; no extra parameter", async () => {
  const s = await standIn();
  try {
    settings(s.url, null, null);
    const q = {
      mandi: "APMC Ahilyanagar",
      quantity_q: 5,
      district: "nashik",
      state: "mh",
      mandi_state: "mh",
      from_place: "farm" as const,
    };
    const a = await client.transportEstimate(q);
    const b = await client.transportEstimate(q);
    assert.equal(a.ok && b.ok, true, "transport needs no farmer sign-in");
    const estimates = s.gets.filter((g) => g.path === "/transport/estimate");
    assert.equal(estimates.length, 1, "the same trip was asked once");
    const declared = new Set([
      "mandi",
      "quantity_q",
      "district",
      "state",
      "mandi_state",
      "mandi_district",
      "from_place",
    ]);
    for (const k of estimates[0]?.query.keys() ?? []) assert.ok(declared.has(k), `undeclared ${k}`);
    assert.equal(
      estimates[0]?.query.has("mandi_district"),
      false,
      "an unset parameter is not sent",
    );
    const nope = { ...q, mandi: "No Such Mandi Anywhere" };
    const r1 = await client.transportEstimate(nope);
    const r2 = await client.transportEstimate(nope);
    assert.equal(!r1.ok ? r1.problem.code : "", "mandi_not_held");
    assert.equal(!r2.ok ? r2.problem.code : "", "mandi_not_held");
    assert.equal(s.gets.filter((g) => g.path === "/transport/estimate").length, 3);
    assert.equal(s.logins, 0, "no sign-in for a public read");
  } finally {
    await s.close();
  }
});

test("B12 AIAIC not answering is said as such; nothing of the app's own store is shown instead", async () => {
  const s = await standIn();
  const url = s.url;
  await s.close();
  settings(url, USER, PASSWORD);
  const r = await client.getMine("en");
  assert.equal(r.ok, false);
  assert.equal(!r.ok ? r.problem.code : "", "aiaic_unavailable");
  settings(null, null, null);
});

test("B13 ANN-1 her 'I got the money' goes with no amount, and AIAIC's answer to it is said with no hole", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    const order = "ord_6e5c6a9c56d2cb56fce7";
    assert.equal((await client.reportPayment(newPressKey(), order, "received")).ok, true);
    const sent = s.posts.find((p) => p.path === `/farmer/trade/orders/${order}/payment-report`);
    assert.deepEqual(sent?.body, { what: "received" }, "she said no amount: none is sent");
    s.mine = "derived_mine_report_without_amount";
    for (const lang of LANGS) {
      const got = await client.getMine(lang);
      assert.ok(got.ok, lang);
      const o = got.data.mine.orders.find((x) => x.order_id === order);
      const said = moneySaid(wordsIn(lang), "money", o?.money?.say ?? null);
      assert.equal(said, DICTS[lang]["aiaic.farmer.money.direct.said_got_any"], lang);
      assert.ok(said && !HOLE.test(said), `${lang}: "${said}"`);
    }
  } finally {
    await s.close();
  }
});

test("B14 push 2n: the nearby mandis' names pass through this server; nothing else new leaves it", async () => {
  const s = await standIn();
  try {
    settings(s.url, null, null);
    s.nearby = NAMED_NEARBY;
    const r = await client.nearbyMandis({ district: "nashik", state: "mh", limit: 12 });
    assert.ok(r.ok, "the names' answer is read");
    const raw = answer<RawNearby>(NAMED_NEARBY);
    assert.deepEqual(
      r.data.mandis.map((m) => [m.mandi, m.names]),
      raw.mandis.map((m) => [m.mandi, m.names]),
    );
    const text = JSON.stringify(r.data);
    for (const word of ['"also_named"', '"geocoder"', '"located_by"', '"point_kind"', '"place"'])
      assert.ok(!text.includes(word), `${word} left the server`);
    s.nearby = "transport_nearby_nashik";
    const before = await client.nearbyMandis({ district: "nashik", state: "mh", limit: 15 });
    assert.ok(before.ok, "a server not yet updated is read as before");
    assert.ok(
      before.data.mandis.every((m) => !("names" in m)),
      "it sends no names: none are made up",
    );
    assert.equal(s.logins, 0, "no sign-in for a public read");
  } finally {
    await s.close();
  }
});

// ------------------------------------------------------------------------------------------------ run

async function main() {
  const saved = {
    AIAIC_BASE_URL: process.env["AIAIC_BASE_URL"],
    AIAIC_FARMER_USERNAME: process.env["AIAIC_FARMER_USERNAME"],
    AIAIC_FARMER_PASSWORD: process.env["AIAIC_FARMER_PASSWORD"],
  };
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
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const failed = results.filter((r) => !r.ok).length;
  const junit = process.env["AIAIC_TEST_JUNIT"];
  if (junit) {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const cases = results
      .map(
        (r) =>
          `  <testcase classname="aiaic_trade_integration_suite" name="${esc(r.name)}" time="${(r.ms / 1000).toFixed(3)}">` +
          (r.ok ? "" : `<failure message="failed">${esc(r.error ?? "")}</failure>`) +
          "</testcase>",
      )
      .join("\n");
    fs.writeFileSync(
      junit,
      `<?xml version="1.0" encoding="utf-8"?>\n<testsuite name="aiaic_trade_integration_suite" tests="${results.length}" failures="${failed}" errors="0" skipped="0" timestamp="${new Date(started).toISOString()}" time="${((Date.now() - started) / 1000).toFixed(3)}">\n${cases}\n</testsuite>\n`,
      "utf-8",
    );
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed, of ${results.length}`);
  process.exit(failed ? 1 : 0);
}

void main();
