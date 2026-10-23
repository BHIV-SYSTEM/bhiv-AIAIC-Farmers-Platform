/**
 * Annapoorna on AIAIC's sale, payment and transport routes: the rules, held.
 *
 * Run:  npx tsx tests/aiaic_trade_integration_suite.ts   (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file)
 *
 * - Part A reads AIAIC's own RECORDED answers (tests/fixtures/aiaic/*.json: real answers of AIAIC's real routes, made
 *   by AIAIC's recorders on a test database or in-process, never edited by hand) through this app's pure functions.
 * - Part B runs this app's server client (src/lib/aiaic-trade.server.ts) against a LOCAL STAND-IN for AIAIC on
 *   127.0.0.1: no request leaves this machine; the account and password are stand-ins, never a real one.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRESS_KEY_RE,
  attributionsOf,
  dayOf,
  moneyTotals,
  newPressKey,
  offerViews,
  paymentLine,
  payoutDetailsProblem,
  rateSources,
  routeSketch,
  rupees,
  saleSteps,
  sayKey,
  vehicleName,
  type AiaicMine,
  type AiaicOrder,
  type TransportEstimate,
} from "../src/lib/aiaic-trade";
import * as client from "../src/lib/aiaic-trade.server";
import { DICTS } from "../src/lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(here, "fixtures", "aiaic");

type Recorded = { _recorded: { route: string; status: number }; answer: unknown };
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
    return r.route === "GET /farmer/trade" && r.status === 200;
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
  const p = client.refusalOf(far._recorded.status, far.answer);
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
        if (u.pathname === "/transport/nearby-mandis")
          return send(200, answer("transport_nearby_nashik"));
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
            answer(s.practice ? "practice_mine_with_offer" : "farmer_app_mine_with_offer"),
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
