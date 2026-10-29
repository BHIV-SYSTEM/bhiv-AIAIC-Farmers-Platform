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

import { NotRefreshedLine } from "../src/components/farm/aiaic/AiaicBits";
import { CrisisOnly } from "../src/components/farm/aiaic/CrisisFirst";
import { GroupOfferSteps, GroupSaleSteps } from "../src/components/farm/aiaic/GroupPages";
import {
  GroupStepsLine,
  GroupSteps,
  type GroupPrices,
} from "../src/components/farm/aiaic/GroupSteps";
import { CompareBody } from "../src/components/farm/aiaic/OfferCompareBody";
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
  noteLines,
  sourcesSaid,
  startDistrict,
  vehicleName,
  type AiaicMine,
  type AiaicOrder,
  type AiaicProblem,
  type AiaicResult,
  type AiaicSay,
  type DistrictRow,
  type OfferCompare,
  type TransportEstimate,
  type FromAiaic,
  moneyMoving,
  sendingSaid,
  answerLanded,
  mineReadEvery,
  mineShown,
  pressKeyHolder,
} from "../src/lib/aiaic-trade";
import {
  GROUP_STEPS,
  OFFER_CLOSED_REASONS,
  askDiffPct,
  closedReasonKey,
  findOffer,
  groupFactsMissing,
  groupPaidWords,
  groupSaid,
  groupView,
  moreTimeGiven,
  needsDestination,
  orderOfOffer,
  type AiaicOffer,
  type AiaicPool,
  type OfferView,
  type ReferencePrice,
} from "../src/lib/aiaic-trade";
import {
  moneyNoticeLine,
  newsShown,
  tradeFactsOf,
  tradeNoticeLine,
  type Notice,
  type TradeNoticeKind,
} from "../src/lib/aiaic-account";
import * as account from "../src/lib/aiaic-account.server";
import { FALLBACK_BASE_URL } from "../src/lib/aiaic-base.server";
import * as client from "../src/lib/aiaic-trade.server";
import * as identity from "../src/lib/aiaic-identity.server";
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
    // 28 Oct 2026: where her money goes (a masked hint) and whether AIAIC collects, then pays her
    "x_destination",
    "collect_then_pay",
    // the notice she is shown before she gives her UPI ID or bank account (the audit's PRIVACY-03)
    "x_notice",
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

test("A28 a collect order's line never says the link does not send her money on: AIAIC's not_onward decides (MONEY-06)", () => {
  // AIAIC's real answer (recorded by its reports/handover_tools/record_trip_and_payout_answers.py): her paid collect order
  const collect = mineOf("collect_mine_paid").orders.find((o) => o.from_aiaic) as AiaicOrder;
  assert.ok(collect, "the recording holds a collect order");
  assert.ok(
    collect.payment.link_made && !collect.payment.not_onward,
    "paid by a collect link; AIAIC says nothing else",
  );
  assert.equal(paymentLine(collect).notOnward, false);
  // AIAIC's per-order fact for a UPI ID passes through this server as AIAIC said it (round 4, R3-MONEY-C)
  assert.equal(collect.from_aiaic?.upi_one_lakh_or_more, false);
  // a plain link's order still says it, as AIAIC does (A3's recording)
  const plain = mineOf("payout_mine_settled").orders.find(
    (o) => o.payment.link_made && o.payment.not_onward,
  ) as AiaicOrder;
  assert.equal(paymentLine(plain).notOnward, true);
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
  "RazorpayX",
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

test("A27 her trip's notes from a REAL 1 q estimate: every note said in mr and hi, no English word, each source once", () => {
  // recorded by AIAIC's reports/handover_tools/record_trip_and_payout_answers.py (from her taluka, Niphad, to Lasalgaon)
  const e = est("transport_estimate_niphad_lasalgaon_1q");
  assert.ok(
    e.notes.length >= 5 && e.notes.some((n) => n.source?.name),
    "the recording holds its notes and a source",
  );
  const named = [
    ...new Set(e.notes.filter((n) => n.source?.name).map((n) => n.source?.name ?? "")),
  ];
  for (const lang of LANGS) {
    const { notes, sources } = noteLines(wordsIn(lang), e, lang);
    assert.deepEqual(
      notes.map((n) => n.code),
      e.notes.map((n) => n.code),
      `${lang}: a note left unsaid`,
    );
    assert.deepEqual(
      sources.map((s) => s.name),
      named,
      `${lang}: each source named once`,
    );
    if (lang === "en") continue;
    // her taluka by the name held in her script; where none is held, its Latin name is a name, not an English word
    const own = e.from.taluka?.names?.[lang] ?? "";
    for (const n of notes) {
      const words = (own ? n.text.replaceAll(own, "") : n.text).match(/[A-Za-z]+/g) ?? [];
      for (const w of words)
        assert.ok(LATIN_ALLOWED.has(w), `${lang} ${n.code}: English word "${w}" in "${n.text}"`);
      assert.ok(!HOLE.test(n.text), `${lang} ${n.code}: a blank left in "${n.text}"`);
    }
  }
  const mr = noteLines(wordsIn("mr"), e, "mr").notes.find((n) => n.code === "from_taluka_town");
  assert.ok(
    mr?.text.includes(e.from.taluka?.names?.mr ?? "?"),
    `her taluka in Marathi: "${mr?.text}"`,
  );
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

test("A25 a group sale on her offer and her sale: only its listed facts pass; never the buyer's record or another farmer", () => {
  // AIAIC section 27 (27 Oct 2026): `pool` on her offers and orders, read from AIAIC's own recorded answers
  const POOL_KEYS = [
    "pool_id",
    "crop",
    "target_q",
    "joined_q",
    "joined_farmers",
    "left_q",
    "price_per_q",
    "grade",
    "collection_point",
    "district",
    "collect_on",
    "valid_until",
    "pay_within_days",
    "status",
    "simulated",
    "km",
    "her_crop",
  ];
  const raw = answer<{
    listings: { offers: { pool?: Record<string, unknown>; pool_id?: string }[] }[];
  }>("connected_farmer_mine_pool_offer");
  const rawPool = raw.listings.flatMap((l) => l.offers).find((o) => o.pool)?.pool;
  assert.ok(rawPool, "the recording holds a group sale's offer");
  // planted: a field AIAIC might add later, and another farmer's lot, must stay on the server
  const planted = JSON.parse(JSON.stringify(raw)) as typeof raw;
  for (const o of planted.listings.flatMap((l) => l.offers)) {
    if (o.pool)
      Object.assign(o.pool, {
        buyer_id: "byr_planted",
        other_farmer: "planted name",
        lots: ["lot_x"],
      });
  }
  const mine = client.mineForBrowser(planted);
  const offer = mine.listings.flatMap((l) => l.offers).find((o) => o.pool_id);
  assert.ok(offer && offer.pool, "her offer keeps its group sale");
  for (const k of Object.keys(offer.pool)) assert.ok(POOL_KEYS.includes(k), `${k} left the server`);
  assert.equal(offer.pool.collection_point, rawPool["collection_point"]);
  assert.equal(offer.pool.target_q, rawPool["target_q"]);
  const text = JSON.stringify(mine);
  for (const never of ["byr_planted", "planted name", "lot_x"])
    assert.ok(!text.includes(never), `${never} reached her`);
  const sale = mineOf("connected_farmer_mine_journey").orders.find((o) => o.pool_id);
  assert.ok(sale && sale.pool && sale.pool.joined_farmers >= 1, "her sale says what the group is");
});

test("A26 her sale step by step: each stage passes only its listed facts; a note, a reference or other lots never", () => {
  const SHOWN: Record<string, string[]> = {
    aggregation: ["collection_point", "quantity_q"],
    quality_grading: ["grade", "weight_q", "rejected_q", "sampled", "tested_on", "tested_at_apmc"],
    storage: ["facility", "facility_kind", "quantity_q", "stored_from", "stored_to"],
    processing: ["process", "input_q", "output_q"],
    pickup: ["quantity_q"],
    in_transit: ["expected_on"],
    delivered: ["received_q"],
    delivery_exception: ["kind", "quantity_q"],
    reconciliation: ["delivered_q", "accepted_q", "rejected_q"],
  };
  const raw = answer<{
    orders: { fulfilment: { stage: string; detail?: Record<string, unknown> }[] }[];
  }>("connected_farmer_mine_journey");
  const planted = JSON.parse(JSON.stringify(raw)) as typeof raw;
  const steps = planted.orders.flatMap((o) => o.fulfilment);
  assert.ok(
    steps.some((st) => st.stage === "aggregation") &&
      steps.some((st) => st.stage === "quality_grading"),
    "the recording holds her collection and her grading",
  );
  for (const st of steps) {
    st.detail = {
      ...(st.detail ?? {}),
      note: "planted team note",
      lots: ["lot_planted"],
      certificate_ref: "CERT-1",
    };
    Object.assign(st, { reference: "slip-planted", recorded_by: "user-planted" });
  }
  const mine = client.mineForBrowser(planted);
  for (const o of mine.orders) {
    for (const st of o.fulfilment) {
      for (const k of Object.keys(st.detail ?? {})) {
        assert.ok((SHOWN[st.stage] ?? []).includes(k), `${st.stage}.${k} reached her`);
      }
    }
  }
  const text = JSON.stringify(mine);
  for (const never of [
    "planted team note",
    "lot_planted",
    "CERT-1",
    "slip-planted",
    "user-planted",
  ]) {
    assert.ok(!text.includes(never), `${never} reached her`);
  }
  const graded = mine.orders
    .flatMap((o) => o.fulfilment)
    .find((st) => st.stage === "quality_grading");
  assert.equal(graded?.detail?.["grade"], "A", "her grade is said");
});

/** One read of the farmer's sale as the page gets it, from AIAIC's recorded GET /farmer/trade. */
const readOf = (name: string) =>
  ({ ok: true, data: { mine: mineOf(name), cropNames: {}, districtNames: {} } }) as const;

test("A29 R5P-09 a read again that fails keeps the page and what is typed on it: only a first read shows the problem; a crisis always does", () => {
  const good = readOf("collect_mine_processing");
  const newer = readOf("collect_mine_paid");
  const outage = { ok: false, problem: problem("aiaic_unavailable", { status: 503 }) } as const;
  // the first read: a loader, then the records; a first read that fails shows the problem
  assert.deepEqual(mineShown({ data: undefined, isError: false }, null), { show: "loading" });
  assert.deepEqual(mineShown({ data: good, isError: false }, null), {
    show: "records",
    data: good.data,
    notRefreshed: null,
  });
  assert.deepEqual(mineShown({ data: outage, isError: false }, null), {
    show: "problem",
    problem: outage.problem,
  });
  const lost = mineShown({ data: undefined, isError: true }, null);
  assert.equal(lost.show === "problem" ? lost.problem.code : lost.show, "aiaic_unavailable");
  // once shown: AIAIC refusing a read again (a restart, a 503, too many reads) keeps the records, with the reason
  assert.deepEqual(mineShown({ data: outage, isError: false }, good.data), {
    show: "records",
    data: good.data,
    notRefreshed: outage.problem,
  });
  // the phone's network lost: the query library keeps the old answer and says error; the records stay
  const offline = mineShown({ data: good, isError: true }, good.data);
  assert.equal(offline.show, "records");
  assert.equal(offline.show === "records" ? offline.notRefreshed?.code : "", "aiaic_unavailable");
  // a newer answer replaces the records, and the line goes
  assert.deepEqual(mineShown({ data: newer, isError: false }, good.data), {
    show: "records",
    data: newer.data,
    notRefreshed: null,
  });
  // the language changed: the new read on its way keeps the records (no loader in place of a form)
  assert.deepEqual(mineShown({ data: undefined, isError: false }, good.data), {
    show: "records",
    data: good.data,
    notRefreshed: null,
  });
  // the session ended: the records stay, with the reason (the line then offers to sign in)
  const out = { ok: false, problem: problem("aiaic_signed_out") } as const;
  const ended = mineShown({ data: out, isError: false }, good.data);
  assert.equal(
    ended.show === "records" ? ended.notRefreshed?.code : ended.show,
    "aiaic_signed_out",
  );
  // a crisis answer outranks everything: shown alone, even over records
  const crisis = {
    ok: false,
    problem: problem("crisis", { crisis: { answer: null, message: null, helplines: [] } }),
  } as const;
  assert.deepEqual(mineShown({ data: crisis, isError: false }, good.data), {
    show: "problem",
    problem: crisis.problem,
  });
  // the quiet line: a status, in the reader's words, offering to try again (nothing is taken off the page)
  const html = renderToString(
    createElement(I18nProvider, {
      children: createElement(NotRefreshedLine, {
        problem: outage.problem,
        onRetry: () => undefined,
      }),
    }),
  );
  assert.ok(html.includes('role="status"'), html);
  assert.ok(html.includes(DICTS.en["aiaic.not_refreshed"] ?? "?"), html);
  assert.ok(html.includes(DICTS.en["aiaic.retry"] ?? "?"), html);
  for (const lang of LANGS) assert.ok(DICTS[lang]["aiaic.not_refreshed"], lang);
  // the page's gate and the trade switch decide by this rule (never the problem card on a failed read again)
  const bits = fs.readFileSync(
    path.join(APP, "src", "components", "farm", "aiaic", "AiaicBits.tsx"),
    "utf-8",
  );
  const gate = bits.slice(
    bits.indexOf("export function WithMine"),
    bits.indexOf("export function TradeSwitch"),
  );
  assert.ok(gate.includes("mineShown(") && !gate.includes("isError ||"), "WithMine decides");
  const sw = bits.slice(bits.indexOf("export function TradeSwitch"));
  assert.ok(sw.includes("if (!mode.data)") && !sw.includes("isError ||"), "TradeSwitch keeps");
});

test("A30 R5P-09 only the order page reads every 5 s while money moves, the sell form never by itself; a sale's press key waits for its answer", () => {
  const moving = readOf("collect_mine_processing");
  const still = readOf("collect_mine_paid");
  assert.equal(mineReadEvery("money", moving), 5_000, "the order page, while the money moves");
  assert.equal(mineReadEvery("money", still), 15_000);
  assert.equal(mineReadEvery("money", undefined), 15_000);
  assert.equal(mineReadEvery("live", moving), 15_000, "a page of lots, offers or money: 15 s");
  assert.equal(mineReadEvery("opened", moving), false, "the sell form: never by itself");
  // each page's pace, as the pages pass it (no pace: live)
  const dir = path.join(APP, "src", "components", "farm", "aiaic");
  const paces: Record<string, string> = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
    const src = fs.readFileSync(path.join(dir, file), "utf-8");
    for (const m of src.matchAll(/<WithMine(?:\s+pace="([a-z]+)")?\s*>/g))
      paces[file] = m[1] ?? "live";
    assert.ok(!/useMine\([^)]*"money"/.test(src), `${file} reads every 5 s outside the order page`);
  }
  assert.deepEqual(paces, {
    "AiaicListingDetail.tsx": "live",
    "AiaicListings.tsx": "live",
    "AiaicOrderDetail.tsx": "money",
    "AiaicOrders.tsx": "live",
    "AiaicPayments.tsx": "live",
    "AiaicSellForm.tsx": "opened",
  });
  // AIAIC's answer landed (done, or a refusal it said): only then may a press's key go
  const after = (status: number | null) =>
    status === 201
      ? ({ ok: true, data: null } as const)
      : ({ ok: false, problem: problem("x", { status }) } as const);
  assert.deepEqual(
    [201, 409, 422, 429, 500, 503, null].map((st) => answerLanded(after(st))),
    [true, true, true, true, false, false, false],
  );
  // "List it for sale": its key held from the press until the answer lands; a form shown again starts with it
  const hold = pressKeyHolder();
  const k = hold.take();
  assert.match(k, PRESS_KEY_RE);
  assert.notEqual(hold.take(), k, "nothing in flight: a new key");
  hold.sent(k);
  assert.equal(hold.take(), k, "in flight: a form shown again starts with the same key");
  hold.answered(k, after(null));
  assert.equal(hold.take(), k, "no answer came: kept, the same press goes again");
  hold.answered(k, after(503));
  assert.equal(hold.take(), k, "AIAIC failed: kept");
  hold.answered("ann-another-press-key", after(201));
  assert.equal(hold.take(), k, "another press's answer does not drop it");
  hold.answered(k, after(422));
  assert.notEqual(hold.take(), k, "AIAIC answered: dropped");
  const k2 = hold.take();
  hold.sent(k2);
  hold.answered(k2, after(201));
  assert.notEqual(hold.take(), k2, "listed: dropped");
  // the sell form starts from the holder and holds its key from the press until the answer
  const form = fs.readFileSync(path.join(dir, "AiaicSellForm.tsx"), "utf-8");
  const sent = form.indexOf("SELL_PRESS.sent(pressKey)");
  const asked = form.indexOf("sellFn({", sent);
  const answered = form.indexOf("SELL_PRESS.answered(pressKey, r)", asked);
  assert.ok(form.includes("useState(SELL_PRESS.take)"), "the form starts from the held key");
  assert.ok(sent > 0 && asked > sent && answered > asked, "held from the press to the answer");
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
  /** The fixture GET /farmer/trade/offers/{id}/compare answers with. */
  compare: string;
  /** What GET /notifications answers with, when set (else AIAIC's recorded answer). */
  notices: unknown;
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
    compare: "offer_compare_depends_on_sharing",
    notices: null,
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
      if (
        u.pathname.startsWith("/places/") ||
        u.pathname.startsWith("/transport/") ||
        u.pathname === "/catalog"
      ) {
        s.gets.push({ path: u.pathname, query: u.searchParams });
        if (u.pathname === "/catalog") {
          // AIAIC's recorded catalogue (Maharashtra, in Marathi); this stand-in holds no other
          if (u.searchParams.get("state") === "mh" && u.searchParams.get("lang") === "mr")
            return send(200, answer("catalog_mh_mr"));
          return send(404, { detail: { reason_code: "not_found", message: "stand-in: not held" } });
        }
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
        if (u.pathname === "/notifications")
          return send(200, s.notices ?? answer("notices_money_processed"));
        if (/^\/farmer\/trade\/offers\/[^/]+\/compare$/.test(u.pathname))
          return send(200, answer(s.compare));
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

/** Act as HER, signed in (28 Oct 2026: a sale is hers only): the stand-in's own valid token for her session. */
function asHer(s?: StandIn): void {
  identity.sessionForTests({
    token: `standin-token-${s ? s.tokenNo : 0}`,
    username: USER,
    displayName: null,
    expiresAt: Date.now() + 60 * 60_000,
  } as unknown as Parameters<typeof identity.sessionForTests>[0]);
}

function asGuest(): void {
  identity.sessionForTests(null);
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
  asGuest();
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

test("B3 her own reads and her sale go as her: no shared account ever signs in; no token or password reaches the browser or the console", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    asHer(s);
    const { value, said } = await captured(async () => {
      const a = await client.getPrice({ crop: "onion", state: "mh", district: "nashik" });
      const b = await client.getPrice({ crop: "onion", state: "mh", district: "pune" });
      const mine = await client.getMine("mr");
      return [a, b, mine];
    });
    assert.equal(
      s.logins,
      0,
      "the server's farmer account never signed in (the audit's PRIVACY-09)",
    );
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
    const mine = value[2];
    if (mine.ok && "cropNames" in mine.data) {
      assert.equal(
        mine.data.cropNames["onion"],
        "कांदा",
        "her crop in her language, from AIAIC's list",
      );
      assert.equal(mine.data.districtNames["Nashik"], "नाशिक");
    }
  } finally {
    await s.close();
  }
});

test("B4 a guest's sale price is refused by name: no call goes as the server's farmer account (PRIVACY-09)", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    client.resetForTests();
    asGuest();
    const r = await client.getPrice({ crop: "onion", state: "mh", district: "nashik" });
    assert.equal(!r.ok ? r.problem.code : "", "sign_in_to_sell");
    assert.equal(s.logins, 0, "nothing signed in");
    assert.equal(s.gets.length, 0, "nothing was asked of AIAIC");
  } finally {
    await s.close();
  }
});

test("B5 her token AIAIC no longer takes: she is asked to sign in again; nothing is sent as anyone else", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    asHer(s);
    s.expireNext = true;
    const r = await client.getMine("en");
    assert.equal(!r.ok ? r.problem.code : "", "aiaic_signed_out");
    assert.equal(s.logins, 0, "no other account signed in instead");
  } finally {
    await s.close();
  }
});

test("B7 a guest is asked to sign in to sell: no shared account's sale is read or written (28 Oct 2026)", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    const r = await client.getMine("en");
    assert.equal(r.ok, false);
    assert.equal(!r.ok ? r.problem.code : "", "sign_in_to_sell");
    assert.ok(!JSON.stringify(r).includes("lst_"), "no listing reached the browser");
    assert.equal(s.logins, 0, "the server's account was not even signed in");
    client.resetForTests();
    const w = await client.sell(newPressKey(), {
      state: "mh",
      district: "nashik",
      crop: "onion",
      quantity_q: 10,
      ask_price_per_q: 3900,
    });
    assert.equal(!w.ok ? w.problem.code : "", "sign_in_to_sell");
    assert.equal(s.posts.length, 0, "no write reached AIAIC");
  } finally {
    await s.close();
  }
});

test("B8 a price far from the mandis is asked back; confirmed, the SAME press goes again with its same key", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    asHer(s);
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
    asHer(s);
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
    asHer(s);
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
  asHer();
  const r = await client.getMine("en");
  assert.equal(r.ok, false);
  assert.equal(!r.ok ? r.problem.code : "", "aiaic_unavailable");
  settings(null, null, null);
});

test("B13 ANN-1 her 'I got the money' goes with no amount, and AIAIC's answer to it is said with no hole", async () => {
  const s = await standIn();
  try {
    settings(s.url, USER, PASSWORD);
    asHer(s);
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

test("B15 a small load whose answer depends on sharing: both ways said, never a hiring-alone total on its own (HONESTY-R1)", async () => {
  // AIAIC's real answers (recorded by its reports/handover_tools/record_trip_and_payout_answers.py: 1 q from Niphad,
  // priced between the mandi less a hired vehicle and less a shared one; and a 4 q offer), through the real server pick
  const s = await standIn();
  const body = (a: OfferCompare) =>
    renderToString(createElement(I18nProvider, { children: createElement(CompareBody, { a }) }));
  try {
    settings(s.url, null, null);
    asHer(s);
    const r = await client.compareOffer("ofr_0123456789abcdef0123");
    assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
    assert.equal(r.data.verdict, "depends_on_sharing");
    const html = body(r.data);
    assert.ok(html.includes('data-testid="aiaic-compare-both-ways"'), "both ways are said");
    assert.ok(
      !html.includes('data-testid="aiaic-compare-for-her"'),
      "no hiring-alone total on its own",
    );
    assert.ok(
      !html.includes(DICTS.en["aiaic.compare.assumes_alone"] ?? "?"),
      "not said as hiring alone",
    );
    // the check is not vacuous: an answer that does not depend on sharing keeps its total
    s.compare = "offer_compare_buyer_collects";
    const plain = await client.compareOffer("ofr_0123456789abcdef0124");
    assert.ok(plain.ok && plain.data.verdict !== "depends_on_sharing" && plain.data.gap?.for_her);
    assert.ok(
      body(plain.data).includes('data-testid="aiaic-compare-for-her"'),
      "a plain answer keeps its total",
    );
  } finally {
    await s.close();
  }
});

test("B18 a send that stopped while AIAIC asked is said as not known, never 'Sending', and is not read every 5 s (NEW-2)", () => {
  // AIAIC's real answer (recorded by its reports/handover_tools/record_trip_and_payout_answers.py): the farmer's sale while
  // a send stays stopped (still "requesting" past AIAIC's 90 s)
  const mine = mineOf("collect_mine_stale");
  const stopped = mine.orders.find(
    (o) => (o as { from_aiaic?: FromAiaic | null }).from_aiaic?.sending?.stale === true,
  );
  assert.ok(stopped, "the recording holds the stopped send");
  const sending = (stopped as { from_aiaic: FromAiaic }).from_aiaic.sending;
  assert.equal(sending?.status, "requesting");
  assert.equal(sendingSaid(sending), "no_answer", "said as not known");
  for (const lang of ["en", "mr", "hi"] as const) {
    assert.ok(DICTS[lang]["aiaic.money.status.no_answer"], `the words exist in ${lang}`);
  }
  const only = {
    ok: true,
    data: { mine: { ...mine, orders: [stopped] }, cropNames: {}, districtNames: {} },
  } as const;
  assert.equal(moneyMoving(only as never), false, "a stopped send is no reason to read every 5 s");
  // the check is not vacuous: the same send, not stale, is moving and is said as being sent
  const fresh = { ...sending, stale: false } as FromAiaic["sending"];
  assert.equal(sendingSaid(fresh), "requesting");
  const moving = {
    ok: true,
    data: {
      mine: {
        ...mine,
        orders: [
          {
            ...stopped,
            from_aiaic: { ...(stopped as { from_aiaic: FromAiaic }).from_aiaic, sending: fresh },
          },
        ],
      },
      cropNames: {},
      districtNames: {},
    },
  } as const;
  assert.equal(moneyMoving(moving as never), true);
});

test("B16 the farmer's money: one notice per sale (the newest, with its amount, crop and TEST); read every 5 s while it moves", async () => {
  // AIAIC's real answers (recorded by its reports/handover_tools/record_trip_and_payout_answers.py: the farmer's
  // notifications after the send reached them; their sale while it was on its way, and once the buyer paid)
  const s = await standIn();
  type Row = { notification_id: number; kind: string; body: Record<string, unknown> };
  const rows = answer<{ notifications: Row[] }>("notices_money_processed").notifications.filter(
    (n) => n.kind === "trade_farmer_paid",
  );
  try {
    settings(s.url, null, null);
    asHer(s);
    assert.ok(rows.length >= 2, "the recording holds the send on its way and reached");
    const money = (await account.myNotices()).filter((n) => n.kind === "trade_farmer_paid");
    assert.equal(money.length, 1, "one notice for the sale's money");
    const m = money[0];
    assert.equal(m.id, rows[0].notification_id, "the newest is said");
    assert.deepEqual(
      [m.money?.status, m.money?.amountInr, m.money?.crop, m.money?.testMode, m.money?.orderId],
      [
        rows[0].body["status"],
        rows[0].body["amount_inr"],
        rows[0].body["crop"],
        true,
        rows[0].body["order_id"],
      ],
    );
    assert.deepEqual(
      [...(m.alsoIds ?? [])].sort(),
      rows
        .slice(1)
        .map((r) => r.notification_id)
        .sort(),
      "the older notice is read with it",
    );
    // her sale is read every 5 s while AIAIC's send is moving, else every 15 s
    const asRead = (name: string) =>
      ({ ok: true, data: { mine: mineOf(name), cropNames: {}, districtNames: {} } }) as const;
    assert.equal(moneyMoving(asRead("collect_mine_processing")), true, "on its way: moving");
    assert.equal(
      moneyMoving(asRead("collect_mine_paid")),
      false,
      "paid, nothing sent yet: not moving",
    );
    assert.equal(moneyMoving(undefined), false);
  } finally {
    await s.close();
  }
});

test("B17 the money notice names its crop by AIAIC's name in the reader's language, says a stopped send, never a code (R5P-10, N-R5-8)", async () => {
  // AIAIC's real answers: the farmer's notifications (record_trip_and_payout_answers.py) and its catalogue of
  // Maharashtra's crops in Marathi (GET /catalog?state=mh&lang=mr, record_plan_answers.py, copied from AIAIC)
  type Row = { notification_id: number; kind: string; body: Record<string, unknown> };
  const recorded = answer<{ unread: number; notifications: Row[] }>("notices_money_processed");
  const names = answer<{ crop_names: Record<string, string> }>("catalog_mh_mr").crop_names;
  const onion = names["onion"] ?? "";
  const s = await standIn();
  const moneyOf = async (lang: (typeof LANGS)[number]) => {
    const n = (await account.myNotices(lang)).find((x) => x.kind === "trade_farmer_paid");
    assert.ok(n?.money, `${lang}: the money notice is read`);
    return n.money;
  };
  try {
    settings(s.url, null, null);
    asHer(s);
    assert.ok(onion && !LATIN.test(onion), "the recording names onion in Marathi");
    const mr = await moneyOf("mr");
    assert.equal(mr.crop, "onion");
    assert.equal(mr.cropName, onion, "AIAIC's own name, from its catalogue");
    assert.ok(
      s.gets.some(
        (g) =>
          g.path === "/catalog" && g.query.get("state") === "mh" && g.query.get("lang") === "mr",
      ),
      "AIAIC's names asked in the reader's language",
    );
    const said = moneyNoticeLine(wordsIn("mr"), mr);
    const reached = wordsIn("mr")("aiaic.money.status.processed", { rs: rupees(mr.amountInr) });
    assert.equal(said, `${onion}: ${reached} ${DICTS.mr["aiaic.money.test"]}`);
    for (const w of said.match(/[A-Za-z]+/g) ?? [])
      assert.ok(LATIN_ALLOWED.has(w), `English word "${w}" in "${said}"`);
    // no name held in the reader's language (this stand-in holds no Hindi catalogue): the line names no crop, never
    // its code; the sale page's names, when this app has read them, name it
    const hi = await moneyOf("hi");
    assert.equal(hi.cropName, null);
    const hiSaid = moneyNoticeLine(wordsIn("hi"), hi);
    assert.ok(!/onion/i.test(hiSaid), hiSaid);
    assert.ok(
      hiSaid.startsWith(
        wordsIn("hi")("aiaic.money.status.processed", { rs: rupees(hi.amountInr) }),
      ),
      hiSaid,
    );
    assert.ok(moneyNoticeLine(wordsIn("mr"), hi, names).startsWith(`${onion}: `));
    // a send RazorpayX stopped is said with its own words, and a state this app has no words for as news to open:
    // DERIVED in memory from the recording (the newest notice of the sale with another state), never written to a file
    for (const [status, key] of [
      ["cancelled", "aiaic.money.status.cancelled"],
      ["a_state_not_known_here", "aiaic.money.status.other"],
    ] as const) {
      const derived = JSON.parse(JSON.stringify(recorded)) as typeof recorded;
      const newest = derived.notifications[0];
      assert.ok(newest && newest.kind === "trade_farmer_paid", "the newest is the money notice");
      newest.body["status"] = status;
      s.notices = derived;
      for (const lang of LANGS) {
        const m = await moneyOf(lang);
        assert.equal(m.status, status);
        const line = moneyNoticeLine(wordsIn(lang), m);
        const words = wordsIn(lang)(key, { rs: rupees(m.amountInr) });
        assert.ok(DICTS[lang][key] && line.includes(words), `${lang} ${status}: "${line}"`);
        assert.ok(!line.includes("aiaic.") && !HOLE.test(line), `${lang}: "${line}"`);
      }
    }
  } finally {
    s.notices = null;
    await s.close();
  }
});

// ---------------------------------------- A, her group sale step by step (30 Oct 2026; the owner of 29 Oct: "clear button
// in UI a farmer ... can follow step by step with clear visibility and key indication with good UX")

/** Every sentence of her steps, in each language: whole (no blank left, never a key), and mr/hi with no English word
 * of this app's (a place AIAIC's team typed, "FPO collection centre", or a district AIAIC names in its own list, is
 * said as AIAIC holds it: the page names a district in her language from AIAIC's names). */
function saidWhole(steps: ReturnType<typeof groupView>["steps"]) {
  for (const lang of LANGS) {
    for (const s of steps) {
      if (!s.say) continue;
      const said = groupSaid(wordsIn(lang), s.say);
      assert.ok(said && !said.startsWith("aiaic."), `${lang} ${s.key}: no words for ${s.say.key}`);
      assert.ok(!HOLE.test(said), `${lang} ${s.key}: a blank left in "${said}"`);
      const ours = Object.values(s.say.values)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .reduce((acc, v) => acc.replaceAll(v, ""), said);
      if (lang !== "en")
        for (const w of ours.match(/[A-Za-z]+/g) ?? [])
          assert.ok(LATIN_ALLOWED.has(w), `${lang} ${s.key}: English word "${w}" in "${said}"`);
    }
  }
}
const stateOf = (g: ReturnType<typeof groupView>) => g.steps.map((s) => `${s.key}:${s.state}`);

test("A36 a group sale's invitation, from AIAIC's recorded answer: invited, her answer NOW (Accept), the group's numbers", () => {
  // AIAIC's real answer: her offer of a group sale nobody has joined yet (connected_farmer_mine_pool_offer)
  const mine = mineOf("connected_farmer_mine_pool_offer");
  const v = offerViews(mine).find((x) => x.offer.pool);
  assert.ok(v?.offer.pool, "the recording holds a group sale's offer with its facts");
  const pool = v.offer.pool;
  const g = groupView(pool, v.offer, orderOfOffer(mine, v.offer.offer_id));
  assert.deepEqual(stateOf(g), [
    "invited:done",
    "answered:now",
    "finalized:todo",
    "collection:todo",
    "paid:todo",
  ]);
  assert.deepEqual(
    g.steps.map((s) => s.key),
    [...GROUP_STEPS],
  );
  assert.equal(g.current, "answered", "her answer is the step marked now");
  assert.equal(g.action, "answer", "her one thing to do: Accept or Decline");
  assert.deepEqual(g.steps[0]?.say, {
    key: "aiaic.gs.invited.until",
    values: { day: dayOf(v.offer.valid_until) },
  });
  assert.equal(g.steps[1]?.say?.values["day"], dayOf(v.offer.valid_until));
  // the key numbers are AIAIC's own: what the buyer wants, what has joined, what is left
  assert.deepEqual(
    [g.gathered.target_q, g.gathered.joined_q, g.gathered.left_q, g.gathered.farmers],
    [
      Number(pool.target_q),
      Number(pool.joined_q),
      Number(pool.left_q),
      Number(pool.joined_farmers),
    ],
  );
  assert.equal(g.gathered.pct, 0);
  // where and when, from the group's own place and day
  const plan = g.steps[3]?.say;
  assert.equal(plan?.key, "aiaic.gs.collection.plan");
  assert.equal(plan?.values["place"], pool.collection_point);
  assert.equal(plan?.values["day"], dayOf(pool.collect_on));
  saidWhole(g.steps);
  // an AIAIC that sends the group's id without its facts is said, never broken
  assert.equal(groupFactsMissing({ pool_id: v.offer.pool_id, pool: null }), true);
  assert.equal(groupFactsMissing(v.offer), false);
});

test("A37 her yes moves the steps (AIAIC's recorded answer): her sale, the group still gathering waited for, her lot collected and weighed", () => {
  // AIAIC's real answer after her yes and the group's collection and grading (connected_farmer_mine_journey)
  const mine = mineOf("connected_farmer_mine_journey");
  const order = mine.orders.find((o) => o.pool);
  assert.ok(order?.pool, "the recording holds her order of a group sale");
  const offer = findOffer(mine, order.offer_id)?.offer ?? null;
  const g = groupView(order.pool, offer, order);
  assert.deepEqual(stateOf(g), [
    "invited:done",
    "answered:done",
    "finalized:now",
    "collection:done",
    "paid:todo",
  ]);
  assert.equal(g.current, "finalized");
  assert.equal(g.action, "wait", "nothing to do: AIAIC's team finalizes the group");
  assert.deepEqual(g.steps[1]?.say, {
    key: "aiaic.gs.answered.yes",
    values: { qty: order.quantity_q },
  });
  const collected = order.fulfilment.find((s) => s.stage === "aggregation");
  assert.equal(g.steps[3]?.say?.key, "aiaic.gs.collection.done_qty");
  assert.equal(g.steps[3]?.say?.values["place"], collected?.detail?.["collection_point"]);
  assert.equal(g.steps[3]?.say?.values["qty"], collected?.detail?.["quantity_q"]);
  saidWhole(g.steps);
  // DERIVED from that answer, and said so: the group finalized (AIAIC's `closed`) moves her to the payment
  const closed = groupView({ ...order.pool, status: "closed" }, offer, order);
  assert.deepEqual(stateOf(closed).slice(2), ["finalized:done", "collection:done", "paid:todo"]);
  assert.equal(closed.current, "paid");
  // DERIVED: finalized before her lot was collected: bring it, where and when
  const before = groupView({ ...order.pool, status: "closed" }, offer, {
    ...order,
    fulfilment: [],
  });
  assert.equal(before.current, "collection");
  assert.equal(before.action, "bring");
  assert.equal(before.steps[3]?.say?.key, "aiaic.gs.collection.bring");
  // DERIVED: called off after her yes: said kindly, her own sale stays (AIAIC keeps a group's orders as sales), so the
  // group's decision is behind her and her sale goes on (her lot already collected: her money next)
  const off = groupView({ ...order.pool, status: "cancelled" }, offer, order);
  assert.equal(off.steps[2]?.state, "done");
  assert.equal(off.steps[2]?.say?.key, "aiaic.gs.finalized.called_off_yours");
  assert.equal(off.current, "paid");
  saidWhole([...closed.steps, ...before.steps, ...off.steps]);
});

test("A38 an invitation AIAIC will not take a yes for (recorded: pool_full) says why and offers no button", () => {
  const mine = mineOf("connected_farmer_mine_pool_full");
  const v = offerViews(mine).find((x) => x.offer.pool);
  assert.ok(
    v?.offer.pool && v.offer.why_not_accept?.code === "pool_full",
    "the recording's refusal",
  );
  const g = groupView(v.offer.pool, v.offer, null);
  assert.equal(g.steps[1]?.state, "stopped");
  assert.equal(g.steps[1]?.say?.key, "aiaic.refused.pool_full");
  assert.equal(g.action, "none", "no Accept where AIAIC refuses it");
  assert.equal(g.current, "answered");
  saidWhole(g.steps);
});

test("A39 every closing AIAIC holds is said in plain words (finalized and called off apart), never as its code", () => {
  // DERIVED from a recorded open offer, and said so: only its status, reason and the group's state are set
  const mine = mineOf("connected_farmer_mine_pool_offer");
  const v = offerViews(mine).find((x) => x.offer.pool);
  assert.ok(v?.offer.pool);
  const closedAs = (reason: string | null, poolStatus: string): AiaicOffer => ({
    ...v.offer,
    status: "withdrawn",
    closed_reason: reason,
    can_accept: false,
    pool: { ...(v.offer.pool as AiaicPool), status: poolStatus },
  });
  const keys = new Set<string>();
  for (const reason of OFFER_CLOSED_REASONS) {
    for (const poolStatus of ["open", "closed", "cancelled"]) {
      const o = closedAs(reason, poolStatus);
      const key = closedReasonKey(o);
      assert.ok(key, `${reason}: said`);
      keys.add(key);
      const g = groupView(o.pool as AiaicPool, o, null);
      assert.deepEqual(stateOf(g), [
        "invited:done",
        "answered:stopped",
        "finalized:none",
        "collection:none",
        "paid:none",
      ]);
      assert.equal(g.steps[1]?.say?.key, key);
      assert.equal(g.action, "none");
    }
  }
  assert.equal(
    closedReasonKey(closedAs("pool_closed", "closed")),
    "aiaic.offer.closed.pool_finalized",
  );
  assert.equal(
    closedReasonKey(closedAs("pool_closed", "cancelled")),
    "aiaic.offer.closed.pool_called_off",
  );
  assert.equal(closedReasonKey(closedAs("a_reason_not_held", "open")), "aiaic.offer.closed.other");
  assert.equal(closedReasonKey(closedAs(null, "open")), "aiaic.offer.closed.other");
  assert.equal(closedReasonKey(v.offer), null, "an open offer is not closed");
  keys.add("aiaic.offer.closed.other");
  for (const key of keys)
    for (const lang of LANGS) assert.ok(DICTS[lang][key], `${lang} has no words for ${key}`);
  // her no: the rest is not hers
  const no = groupView(v.offer.pool, { ...v.offer, status: "rejected", can_accept: false }, null);
  assert.deepEqual(stateOf(no).slice(1), [
    "answered:done",
    "finalized:none",
    "collection:none",
    "paid:none",
  ]);
  assert.equal(no.steps[1]?.say?.key, "aiaic.gs.answered.no");
});

test("A40 MORE TIME (AIAIC's recorded notice and answer): said with the offer's own new last day; her news, once per open offer, no id of another", () => {
  // AIAIC's real answers after its team gave more time (record_buyer_portal_answers.py): her notifications and her sale
  type Row = {
    notification_id: number;
    kind: string;
    created_at: string;
    read_at: string | null;
    body: Record<string, unknown>;
  };
  const rows = answer<{ notifications: Row[] }>("buyer_farmer_notices_more_time").notifications;
  const mine = mineOf("buyer_farmer_mine_more_time");
  const moved = rows.find((r) => r.body["more_time"] === true);
  assert.ok(moved, "the recording holds the more-time notice");
  const notices: Notice[] = rows.map((r) => ({
    id: r.notification_id,
    kind: r.kind as Notice["kind"],
    queryId: null,
    at: r.created_at,
    trade: tradeFactsOf(r.kind, r.body),
  }));
  for (const n of notices) {
    assert.ok(n.trade, "every trade notice keeps its facts");
    assert.ok(!("farmer_id" in n.trade), "the farmer's record id stays on AIAIC's side");
  }
  const offerId = String(moved.body["offer_id"]);
  const v = findOffer(mine, offerId);
  assert.ok(v?.offer.pool && v.chip === "open", "the offer given more time is open again");
  assert.equal(dayOf(v.offer.valid_until), dayOf(String(moved.body["valid_until"])));
  assert.equal(moreTimeGiven(notices, offerId), true);
  const other = offerViews(mine).find((x) => x.offer.offer_id !== offerId);
  assert.ok(other);
  assert.equal(moreTimeGiven(notices, other.offer.offer_id), false);
  const g = groupView(v.offer.pool, v.offer, null, { moreTime: true });
  assert.deepEqual(g.steps[0]?.say, {
    key: "aiaic.gs.invited.more_time",
    values: { day: dayOf(v.offer.valid_until) },
  });
  // said where she answers too (the step now, on the first screen)
  assert.deepEqual(g.steps[1]?.say, {
    key: "aiaic.gs.answered.more_time",
    values: { day: dayOf(v.offer.valid_until) },
  });
  assert.equal(g.action, "answer");
  // the live AIAIC before its buyer branch sends no such notice: the step still says the offer's own last day
  assert.equal(groupView(v.offer.pool, v.offer, null).steps[0]?.say?.key, "aiaic.gs.invited.until");
  saidWhole(g.steps);
  // her news strip: open offers only (an offer she answered is no news to act on)
  const open = new Set(
    offerViews(mine)
      .filter((x) => x.chip === "open")
      .map((x) => x.offer.offer_id),
  );
  const shown = newsShown(notices, open).map((n) => n.trade?.offerId);
  assert.ok(shown.length > 0 && shown.every((id) => id && open.has(id)));
  assert.ok(shown.length < notices.length, "news of answered offers is not shown");
  assert.deepEqual(
    newsShown([{ ...notices[0], read: true } as Notice], null),
    [],
    "read: never news",
  );
  // the line in each language: the crop by name, the quantity, the price, the NEW day; mr/hi no English word (the
  // crop's names here stand in for AIAIC's catalogue, which this app asks in the reader's language)
  const onion = { en: "Onion", mr: "कांदा", hi: "प्याज" } as const;
  for (const lang of LANGS) {
    const line = tradeNoticeLine(
      wordsIn(lang),
      "trade_offer",
      tradeFactsOf("trade_offer", moved.body) as NonNullable<Notice["trade"]>,
      { onion: onion[lang] },
    );
    assert.ok(line.startsWith(`${onion[lang]}: `), `${lang}: the crop by its name`);
    assert.ok(line.includes(dayOf(String(moved.body["valid_until"]))), `${lang}: the new day`);
    assert.ok(line.includes(rupees(Number(moved.body["price_per_q"]))), `${lang}: the price`);
    assert.ok(!HOLE.test(line), `${lang}: a blank left in "${line}"`);
    if (lang !== "en")
      for (const w of line.match(/[A-Za-z]+/g) ?? [])
        assert.ok(LATIN_ALLOWED.has(w), `${lang}: English word "${w}" in "${line}"`);
  }
});

test("A41 her sale's other news (a step, a call-off) is said whole in each language; a code not held is never shown", () => {
  const kinds: [TradeNoticeKind, Record<string, unknown>][] = [
    [
      "trade_order_step",
      { order_id: "ord_x", crop: "onion", stage: "aggregation", status: "done" },
    ],
    [
      "trade_order_step",
      { order_id: "ord_x", crop: "onion", stage: "a_stage_not_held", status: "odd" },
    ],
    [
      "trade_order_step",
      {
        order_id: "ord_x",
        stage: "delivery_exception",
        status: "done",
        problem_kind: "shortage",
        simulated: true,
      },
    ],
    [
      "trade_order_cancelled",
      { order_id: "ord_x", quantity_q: 4, reason_code: "buyer_called_off", listing_status: "open" },
    ],
    ["trade_order_cancelled", { order_id: "ord_x", reason_code: "a_code_not_held" }],
    ["trade_offer", { offer_id: "ofr_x", quantity_q: 1, price_per_q: 2500 }],
  ];
  for (const lang of LANGS) {
    for (const [kind, body] of kinds) {
      const facts = tradeFactsOf(kind, body);
      assert.ok(facts);
      const line = tradeNoticeLine(wordsIn(lang), kind, facts);
      assert.ok(line && !line.includes("aiaic.") && !HOLE.test(line), `${lang} ${kind}: "${line}"`);
      assert.ok(!line.includes("a_code_not_held") && !line.includes("a_stage_not_held"));
      if (lang !== "en")
        for (const w of line.match(/[A-Za-z]+/g) ?? [])
          assert.ok(LATIN_ALLOWED.has(w), `${lang}: English word "${w}" in "${line}"`);
    }
  }
  assert.equal(tradeFactsOf("trade_offer", { crop: "onion" }), null, "no offer id: not shown");
  assert.equal(
    tradeFactsOf("trade_order_step", { stage: "pickup" }),
    null,
    "no order id: not shown",
  );
});

test("A42 the step bar on a phone: the step now is marked, each state has its icon AND its word, Accept says what happens next", () => {
  const mine = mineOf("connected_farmer_mine_pool_offer");
  const v = offerViews(mine).find((x) => x.offer.pool);
  assert.ok(v?.offer.pool);
  const g = groupView(v.offer.pool, v.offer, null);
  const html = renderToString(
    createElement(I18nProvider, {
      children: createElement(GroupSteps, {
        view: g,
        prices: {
          pricePerQ: v.offer.price_per_q,
          amount: v.offer.amount_inr ?? v.offer.price_per_q * v.offer.quantity_q,
          ask: null,
          mandi: null,
          reading: false,
        },
        children: createElement("button", null, "Accept"),
      }),
    }),
  );
  assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1, "one step marked now");
  assert.ok(html.includes('data-step="answered"'));
  assert.ok(/aria-current="step"[^>]*data-state="now"[^>]*data-step="answered"/.test(html));
  for (const s of g.steps) {
    const word =
      s.state === "none"
        ? DICTS.en["aiaic.gs.state.none"]
        : DICTS.en[`aiaic.step.state.${s.state}`];
    assert.ok(word && html.includes(`>${word}<`), `${s.key}: its state said in words`);
  }
  assert.ok(html.includes(DICTS.en["aiaic.gs.now"] ?? "?"), "the step now is said as now");
  assert.ok(
    html.includes('role="progressbar"'),
    "the group's gathered share as a bar with its numbers",
  );
  assert.ok(html.includes(">Accept<"), "her one thing to do sits in the step now");
});

// ------------------------------------- A, the audit of 30 Oct 2026 (AUD-1 to AUD-9): her group sale, each fix checked

/** React's own escaping of a text (its server render), so a sentence is found in the page as it is written there. */
const escHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
/** A part of a page rendered on the server, its texts joined (React marks two texts side by side with an empty
 * comment), in English. */
const rendered = (el: ReturnType<typeof createElement>) =>
  renderToString(createElement(I18nProvider, { children: el })).replaceAll("<!-- -->", "");
/** A sentence of this app in English, escaped as the page writes it. */
const enSaid = (key: string, vars?: Record<string, string | number>) =>
  escHtml(wordsIn("en")(key, vars));
const noPress = {
  setAsking: () => undefined,
  busy: false,
  onAnswer: () => undefined,
};

test("A43 AUD-1 a group offer: her price (with the difference) and her district's mandi middle (its day, its source) come BEFORE Accept, and the accept confirm says them again", () => {
  // AIAIC's real answers: her open group offer (connected_farmer_mine_pool_offer, onion in Nashik) and Nashik's onion
  // prices as AIAIC held them (practice_price, GET /farmer/trade/price)
  const mine = mineOf("connected_farmer_mine_pool_offer");
  const v = offerViews(mine).find((x) => x.offer.pool);
  assert.ok(v?.offer.pool && v.canAnswer, "the recording holds a group offer she can answer");
  const mandi = answer<ReferencePrice>("practice_price");
  assert.ok(
    mandi.held && typeof mandi.middle_of_all_per_q === "number" && mandi.price_day,
    "the recording holds a mandi middle and its day",
  );
  // DERIVED in memory, and said so: her asking price set to the price answer's own suggestion (the recorded lot has none)
  const ask = Number(mandi.suggested_ask_per_q);
  const view: OfferView = { ...v, listing: { ...v.listing, ask_price_per_q: ask } };
  const o = v.offer;
  const group = groupView(o.pool as AiaicPool, o, null);
  assert.equal(group.action, "answer");
  const prices: GroupPrices = {
    pricePerQ: o.price_per_q,
    amount: o.amount_inr ?? o.price_per_q * o.quantity_q,
    ask,
    mandi,
    reading: false,
  };
  const page = (asking: "accept" | "reject" | null, p: GroupPrices) =>
    rendered(
      createElement(GroupOfferSteps, {
        view,
        group,
        crop: "Onion",
        buyer: "A buyer",
        chip: null,
        order: null,
        prices: p,
        press: { ...noPress, asking },
      }),
    );
  const html = page(null, prices);
  const accept = html.indexOf('data-testid="aiaic-gs-accept"');
  assert.ok(
    accept > 0 && html.indexOf('data-testid="aiaic-gs-decline"') > accept,
    "Accept, then Decline",
  );
  const diff = askDiffPct(o.price_per_q, ask);
  assert.ok(diff !== null && diff < 0, "the buyer offers less than she asked");
  const hers = enSaid("aiaic.offer.your_price", { price: rupees(ask) });
  const middle = enSaid("aiaic.lots.price", { price: rupees(mandi.middle_of_all_per_q ?? null) });
  const dayAndSource = enSaid("aiaic.group.mandi_line", {
    low: rupees(mandi.lowest_per_q ?? null),
    high: rupees(mandi.highest_per_q ?? null),
    day: dayOf(mandi.price_day ?? null),
    source: mandi.source_name ?? "",
  });
  for (const [what, said] of [
    ["her price", hers],
    ["the difference", `${diff}%`],
    ["the mandi middle", middle],
    ["the mandi's day and source", dayAndSource],
  ] as const) {
    const i = html.indexOf(said);
    assert.ok(i > 0 && i < accept, `${what} ("${said}") is said before Accept`);
  }
  // the step she is at stays first: her answer, then the prices, then the buttons
  const now = html.indexOf('data-testid="aiaic-gs-now"');
  assert.ok(now > 0 && now < html.indexOf(hers), "the step now comes first");
  // the accept confirm says them again, before its yes
  const confirm = page("accept", prices);
  const yes = confirm.indexOf('data-testid="aiaic-gs-confirm-accept-yes"');
  for (const said of [
    hers,
    `${diff}%`,
    rupees(mandi.middle_of_all_per_q ?? null),
    dayOf(mandi.price_day ?? null),
  ]) {
    const i = confirm.indexOf(said);
    assert.ok(i > 0 && i < yes, `the accept confirm says "${said}" before its yes`);
  }
  // the lot as AIAIC recorded it (no asking price): no "Your price"; the mandi still before Accept
  const none = page(null, { ...prices, ask: null });
  assert.ok(
    !none.includes(escHtml((DICTS.en["aiaic.offer.your_price"] ?? "?").split("{")[0] ?? "?")),
    "no price of hers when she named none",
  );
  assert.ok(
    none.indexOf(middle) > 0 &&
      none.indexOf(middle) < none.indexOf('data-testid="aiaic-gs-accept"'),
    "the mandi middle before Accept, with no price of hers",
  );
  // the mandi prices being read, or none held: said so before Accept, never a blank
  for (const reading of [true, false]) {
    const h = page(null, { ...prices, mandi: null, reading });
    const said = enSaid(reading ? "aiaic.sell.price.reading" : "aiaic.group.mandi_none");
    assert.ok(
      h.indexOf(said) > 0 && h.indexOf(said) < h.indexOf('data-testid="aiaic-gs-accept"'),
      `${reading ? "reading" : "none held"}: said before Accept`,
    );
  }
  // her news strip: the news of the page she is on waits while she reads it (its Open would open this page, and it
  // pushed her button below the first screen in the walk); elsewhere it is shown (AIAIC's recorded notices)
  type Row = {
    notification_id: number;
    kind: string;
    created_at: string;
    body: Record<string, unknown>;
  };
  const rows = answer<{ notifications: Row[] }>("buyer_farmer_notices_more_time").notifications;
  const notices: Notice[] = rows.map((r) => ({
    id: r.notification_id,
    kind: r.kind as Notice["kind"],
    queryId: null,
    at: r.created_at,
    trade: tradeFactsOf(r.kind, r.body),
  }));
  const offerId = notices.find((n) => n.kind === "trade_offer" && n.trade?.offerId)?.trade?.offerId;
  assert.ok(offerId, "the recording holds an offer's news");
  assert.ok(
    newsShown(notices, null).some((n) => n.trade?.offerId === offerId),
    "an offer's news is shown on other pages",
  );
  assert.ok(
    !newsShown(notices, null, offerId).some((n) => n.trade?.offerId === offerId),
    "it waits on the offer's own page",
  );
});

test("A44 AUD-2 her own sale's state first: a sale called off is never 'still gathering' or 'your own sale stays', never asked for a payout account; a call-off with her sale standing says bring", () => {
  // AIAIC's real answer: her order of a group sale, the group open, her lot collected (connected_farmer_mine_journey)
  const mine = mineOf("connected_farmer_mine_journey");
  const order = mine.orders.find((x) => x.pool);
  assert.ok(order?.pool && order.order_state !== "cancelled", "her group order, standing");
  const offer = findOffer(mine, order.offer_id)?.offer ?? null;
  const pool = (status: string): AiaicPool => ({ ...(order.pool as AiaicPool), status });
  // DERIVED in memory, and said so: what AIAIC's cancel_order changes (the state and its reason code), before her lot
  // was collected
  const cancelled: AiaicOrder = {
    ...order,
    order_state: "cancelled",
    cancel_reason_code: "buyer_called_off",
    fulfilment: [],
  };
  const reason = DICTS.en["aiaic.sale.cancel_reason.buyer_called_off"] ?? "?";
  const never = [
    "aiaic.gs.finalized.waiting",
    "aiaic.gs.finalized.todo",
    "aiaic.gs.finalized.called_off_yours",
  ];
  // (a) her sale called off while the group gathers; (b) the group called off too; and the group finalized first
  for (const status of ["open", "cancelled", "closed"]) {
    const g = groupView(pool(status), offer, cancelled);
    const all = g.steps.map((s) => groupSaid(wordsIn("en"), s.say)).join(" | ");
    for (const s of g.steps)
      assert.ok(!never.includes(s.say?.key ?? ""), `${status}: ${s.key} says ${s.say?.key}`);
    assert.equal(g.action, "none", `${status}: nothing for her to do`);
    assert.ok(!g.steps.some((s) => s.state === "now"), `${status}: no step is hers now: ${all}`);
    const at = g.steps.find((s) => s.key === g.current);
    assert.equal(at?.state, "stopped", `${status}: the step she is at is where her sale stopped`);
    assert.ok(
      groupSaid(wordsIn("en"), at.say).includes(reason),
      `${status}: AIAIC's reason is said there: ${all}`,
    );
    saidWhole(g.steps);
    // her sales list says the same
    const line = rendered(createElement(GroupStepsLine, { view: g }));
    assert.ok(line.includes(escHtml(reason)), `${status}: the list line says why`);
  }
  // (c) the group called off while her sale stands (AIAIC keeps it as a sale, pools.close; its decision rule puts the
  // collection now): before her lot is collected, bring it
  const standing = groupView(pool("cancelled"), offer, { ...order, fulfilment: [] });
  assert.equal(standing.steps[2]?.say?.key, "aiaic.gs.finalized.called_off_yours");
  assert.notEqual(standing.steps[2]?.state, "stopped", "her sale did not stop");
  assert.equal(standing.current, "collection");
  assert.equal(standing.steps[3]?.state, "now");
  assert.equal(standing.action, "bring");
  saidWhole(standing.steps);
  // (d) AIAIC attaches her money's facts whatever the order's state (farmer_payout.her_money): AIAIC's real answer where
  // it collects, then pays her, and holds no UPI ID or bank account of hers (collect_mine_paid)
  const paid = mineOf("collect_mine_paid");
  const real = paid.orders[0];
  const fa = (real as { from_aiaic?: FromAiaic | null } | undefined)?.from_aiaic;
  assert.ok(real && fa, "the recording holds AIAIC's facts of her money");
  assert.equal(needsDestination(real, paid), true, "her one thing to do while her sale stands");
  assert.equal(
    needsDestination({ ...real, order_state: "cancelled" }, paid),
    false,
    "never on a sale called off",
  );
  // the group's page: DERIVED, her group order with those facts attached, called off (none asked) and standing (asked)
  const prices: GroupPrices = {
    pricePerQ: order.price_per_q,
    amount: order.amount_inr,
    ask: null,
    mandi: null,
    reading: false,
  };
  const pageOf = (o: AiaicOrder, status: string) =>
    rendered(
      createElement(GroupSaleSteps, {
        order: o,
        data: { mine: { ...paid, orders: [o] }, cropNames: {}, districtNames: {} },
        group: groupView(pool(status), offer, o),
        crop: "Onion",
        buyer: "A buyer",
        prices,
      }),
    );
  const asked = 'data-testid="aiaic-gs-give-destination"';
  assert.ok(
    !pageOf({ ...cancelled, from_aiaic: fa } as AiaicOrder, "open").includes(asked),
    "never asked on a sale called off",
  );
  assert.ok(
    pageOf({ ...order, from_aiaic: fa } as AiaicOrder, "closed").includes(asked),
    "asked while it stands",
  );
});

test("A45 AUD-3 her lot collected: the group order page never says 'Next: you hand it over at the collection point' under a done collection", () => {
  // AIAIC's real answer: her lot collected and graded, and its her_next_step still naming the handover
  const mine = mineOf("connected_farmer_mine_journey");
  const order = mine.orders.find((x) => x.pool);
  assert.ok(order?.pool, "her group order");
  assert.equal(order.her_next_step, "collection_point", "AIAIC's answer names the handover next");
  assert.ok(
    order.fulfilment.some((s) => s.stage === "aggregation" && s.status === "done"),
    "her lot collected",
  );
  const offer = findOffer(mine, order.offer_id)?.offer ?? null;
  const handOver = enSaid("aiaic.sale.next.collection_point");
  // the recording as it is (the group open), and DERIVED: the group finalized
  for (const status of ["open", "closed"]) {
    const html = rendered(
      createElement(GroupSaleSteps, {
        order,
        data: { mine, cropNames: {}, districtNames: {} },
        group: groupView({ ...(order.pool as AiaicPool), status }, offer, order),
        crop: "Onion",
        buyer: "A buyer",
        prices: {
          pricePerQ: order.price_per_q,
          amount: order.amount_inr,
          ask: null,
          mandi: null,
          reading: false,
        },
      }),
    );
    assert.ok(/data-state="done" data-step="collection"/.test(html), `${status}: collection done`);
    assert.ok(
      !html.includes(handOver),
      `${status}: no "Next: you hand it over" under a done collection`,
    );
  }
});

test("A46 AUD-4..AUD-9 her steps' words and page: stages, the team decides, a no ends kindly, the list says AIAIC's sending words, joined apart from gathered, one step list", () => {
  // AUD-4: beside NOW a step's name is a stage, never a state that has not happened (English: "Group finalized", "Paid")
  assert.ok(
    !(DICTS.en["aiaic.gs.step.finalized"] ?? "?").toLowerCase().includes("finalized"),
    `the group step is named as a stage: "${DICTS.en["aiaic.gs.step.finalized"]}"`,
  );
  assert.notEqual(DICTS.en["aiaic.gs.step.paid"], "Paid", "the money step is named as a stage");
  // AUD-5: while answers come in, AIAIC's team decides (finalize, more time, more farmers or call off), never "finalizes it"
  const claims = { en: "finalizes", mr: "अंतिम करते", hi: "तय करती" } as const;
  for (const lang of LANGS)
    for (const key of ["aiaic.gs.finalized.waiting", "aiaic.gs.finalized.todo"]) {
      const said = DICTS[lang][key] ?? "?";
      assert.ok(!said.includes(claims[lang]), `${lang} ${key}: "${said}"`);
    }
  // AUD-6: she said no (DERIVED from the recorded open offer: only its status): the end is said, never "All steps done"
  const open = mineOf("connected_farmer_mine_pool_offer");
  const v = offerViews(open).find((x) => x.offer.pool);
  assert.ok(v?.offer.pool, "an open group offer");
  const no = groupView(v.offer.pool, { ...v.offer, status: "rejected", can_accept: false }, null);
  const prices: GroupPrices = {
    pricePerQ: v.offer.price_per_q,
    amount: v.offer.price_per_q * v.offer.quantity_q,
    ask: null,
    mandi: null,
    reading: false,
  };
  const noHtml = rendered(createElement(GroupSteps, { view: no, prices }));
  assert.ok(!noHtml.includes(enSaid("aiaic.gs.all_done")), "a no is not 'all steps done'");
  assert.ok(noHtml.includes(enSaid("aiaic.gs.said_no_end")), "a no ends with nothing more to do");
  // AUD-7: her sales list says AIAIC's own words for its send (queued, pending, processing are not "sent"): AIAIC's real
  // send on its way (collect_mine_processing), DERIVED onto her collected group order (connected_farmer_mine_journey)
  const sending = mineOf("collect_mine_processing").orders[0];
  const fa = (sending as { from_aiaic?: FromAiaic | null } | undefined)?.from_aiaic;
  assert.ok(
    fa?.sending && fa.steps?.sent === true && fa.steps.reached !== true,
    "the recording holds a send on its way",
  );
  const mine = mineOf("connected_farmer_mine_journey");
  const order = mine.orders.find((x) => x.pool);
  assert.ok(order?.pool, "her group order");
  const moving = { ...order, from_aiaic: fa } as AiaicOrder;
  const g = groupView({ ...order.pool, status: "closed" }, null, moving);
  assert.equal(g.current, "paid");
  const words = groupPaidWords(wordsIn("en"), moving);
  assert.equal(
    words,
    wordsIn("en")("aiaic.money.status.processing", { rs: rupees(fa.sending.amount_inr) }),
  );
  const line = rendered(createElement(GroupStepsLine, { view: g, paidWords: words }));
  assert.ok(line.includes(escHtml(words ?? "?")), "the list line says AIAIC's sending words");
  assert.ok(
    !(DICTS.en["aiaic.gs.paid.sent"] ?? "?").includes("sent your money"),
    "a send on its way is never said as done",
  );
  // AUD-9: one step list on her order's page (the older journey folded behind one press), the pooled line inside the
  // collection step, one bar; the agreed quantity "joined", the weighed one "gathered"
  const page = rendered(
    createElement(GroupSaleSteps, {
      order,
      data: { mine, cropNames: {}, districtNames: {} },
      group: groupView({ ...order.pool, status: "closed" }, null, order),
      crop: "Onion",
      buyer: "A buyer",
      prices: {
        pricePerQ: order.price_per_q,
        amount: order.amount_inr,
        ask: null,
        mandi: null,
        reading: false,
      },
    }),
  );
  assert.ok(!page.includes(enSaid("aiaic.journey.title")), "no second 'step by step' list");
  assert.ok(page.includes("<details"), "every recorded step kept, behind one press");
  assert.equal(page.split('role="progressbar"').length - 1, 1, "one bar");
  const c = page.indexOf('data-step="collection"');
  const p = page.indexOf('data-testid="aiaic-pooled"');
  assert.ok(
    c > 0 && p > c && p < page.indexOf('data-step="paid"'),
    "the pooled line sits in the collection step",
  );
  const finalized = groupSaid(
    wordsIn("en"),
    groupView({ ...order.pool, status: "closed" }, null, order).steps[2]?.say ?? null,
  );
  assert.ok(finalized.includes("joined") && !finalized.includes("gathered"), `"${finalized}"`);
  assert.ok(
    (DICTS.en["aiaic.gs.joined_title"] ?? "").includes("Joined"),
    "the bar names the agreed quantity joined",
  );
});

test("B19 her sale's news through this server: one per offer (the newest, more time), the older read with it; a READ more-time notice only says more time; no farmer id", async () => {
  // AIAIC's real answer of GET /notifications after its team gave more time (record_buyer_portal_answers.py)
  type Row = {
    notification_id: number;
    kind: string;
    read_at: string | null;
    body: Record<string, unknown>;
  };
  const recordedNotices = answer<{ unread: number; notifications: Row[] }>(
    "buyer_farmer_notices_more_time",
  );
  const rows = recordedNotices.notifications;
  const moved = rows.find((r) => r.body["more_time"] === true);
  assert.ok(moved, "the recording holds the more-time notice");
  const sameOffer = rows.filter((r) => r.body["offer_id"] === moved.body["offer_id"]);
  assert.ok(sameOffer.length >= 2, "the offer's first notice and its more-time notice");
  const s = await standIn();
  try {
    settings(s.url, null, null);
    asHer(s);
    s.notices = recordedNotices;
    const all = await account.myNotices("en");
    const offers = all.filter((n) => n.kind === "trade_offer");
    const ids = new Set(rows.map((r) => r.body["offer_id"]));
    assert.equal(offers.length, ids.size, "one notice per offer");
    const n = offers.find((x) => x.trade?.offerId === moved.body["offer_id"]);
    assert.ok(n?.trade?.moreTime, "the newest of that offer: more time");
    assert.equal(n.id, moved.notification_id);
    assert.equal(n.trade.validUntil, moved.body["valid_until"]);
    assert.deepEqual(
      n.alsoIds,
      sameOffer.filter((r) => r !== moved).map((r) => r.notification_id),
      "its older notice is read with it",
    );
    assert.ok(!JSON.stringify(all).includes("frm_"), "no farmer's record id leaves this server");
    // DERIVED in memory from the recording, never written: the more-time notice READ elsewhere (her other phone)
    const derived = JSON.parse(JSON.stringify(recordedNotices)) as typeof recordedNotices;
    const read = derived.notifications.find((r) => r.notification_id === moved.notification_id);
    assert.ok(read);
    read.read_at = "2026-10-29T18:06:00+00:00";
    s.notices = derived;
    const after = await account.myNotices("en");
    const kept = after.filter((x) => x.read);
    assert.deepEqual(
      kept.map((x) => [x.id, x.trade?.moreTime]),
      [[moved.notification_id, true]],
      "kept only to say more time",
    );
    assert.equal(moreTimeGiven(after, String(moved.body["offer_id"])), true);
    assert.ok(
      newsShown(after, null).every((x) => !x.read),
      "never shown as news again",
    );
  } finally {
    s.notices = null;
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
