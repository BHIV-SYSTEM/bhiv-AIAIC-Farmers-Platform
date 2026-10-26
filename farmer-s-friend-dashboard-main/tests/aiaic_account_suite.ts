/**
 * Her account's rules that need no server (push 4b audit, 25 Oct 2026). Run: `npx tsx tests/aiaic_account_suite.ts`.
 *
 * - R-05: the registration notice's version is tied to its words: their sha256 (en, mr, hi) must be the one recorded
 *   beside the version, so the words cannot change without a new version (AIAIC records her consent by version).
 * - R-03: what this phone would refuse in a registration form, in the order the page says it; and the words the scan
 *   reads first: a username's `_ . -` as spaces (a username holds no space).
 * - E-01 (the re-check, 26 Oct): the visitor's address this server sends AIAIC is never one the visitor wrote.
 * - E-02: with the farmer app's key, a device cookie this server did not issue is no device's.
 * - E-04: a refusal this server gives before asking AIAIC waits for the crisis check (AIAIC's real recorded answer).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  NOTICE_WORDS_SHA256,
  REGISTRATION_NOTICE_VERSION,
  registerRefusal,
  wordsToScan,
} from "../src/lib/aiaic-account";
import { register } from "../src/lib/aiaic-account.server";
import { aiaicHeaders, pickVisitorAddress } from "../src/lib/aiaic-base.server";
import { deviceCookieValue, deviceIdOfCookie } from "../src/lib/aiaic-identity.server";
import { AIAIC_EN, AIAIC_HI, AIAIC_MR } from "../src/lib/i18n-aiaic";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function equal<T>(got: T, want: T, what: string): void {
  if (got !== want)
    throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/** The notice's words in the three languages, as the app shows them. */
export function noticeWordsSha256(): string {
  const words = [AIAIC_EN, AIAIC_MR, AIAIC_HI].map((d) => d["aiaic.account.notice"]).join("\n");
  return createHash("sha256").update(words, "utf8").digest("hex");
}

test("R-05 the notice's words are the ones its version was given to", () => {
  equal(REGISTRATION_NOTICE_VERSION, "registration-2026-10-26", "the version AIAIC asks for");
  equal(
    NOTICE_WORDS_SHA256,
    noticeWordsSha256(),
    "the notice changed: give it a new version (both repositories)",
  );
});

test("R-03 a registration form's first refusal, in the page's order", () => {
  const ok = {
    username: "asha_patil",
    password: "longenough1",
    again: "longenough1",
    district: "nashik",
    agreed: true,
  };
  equal(registerRefusal(ok), null, "a complete form");
  equal(registerRefusal({ ...ok, username: "a b" }), "invalid_username", "a space");
  equal(
    registerRefusal({ ...ok, password: "short", again: "short" }),
    "password_too_short",
    "short",
  );
  equal(registerRefusal({ ...ok, again: "different1" }), "password_mismatch", "mismatch");
  equal(registerRefusal({ ...ok, district: "" }), "place_not_held", "no district");
  equal(registerRefusal({ ...ok, agreed: false }), "consent_required", "not agreed");
});

test("R-03 the scan reads a username's marks as spaces, then the other boxes as typed", () => {
  equal(wordsToScan("i_want_to-die", "My name"), "i want to die. My name", "username and name");
  equal(wordsToScan("", null, "  "), "", "nothing typed");
});

test("E-01 the visitor's address is the socket's unless the deployment names the proxy in front", () => {
  const sent = {
    "cf-connecting-ip": "198.51.100.7",
    "x-real-ip": "198.51.100.8",
    "x-forwarded-for": "198.51.100.9, 203.0.113.20",
  } as Record<string, string>;
  const header = (name: string) => sent[name];
  equal(pickVisitorAddress(undefined, header, "203.0.113.5"), "203.0.113.5", "unset: the socket");
  equal(pickVisitorAddress("", header, "203.0.113.5"), "203.0.113.5", "empty: the socket");
  equal(
    pickVisitorAddress("x-client-ip", header, "203.0.113.5"),
    "203.0.113.5",
    "unknown: the socket",
  );
  equal(
    pickVisitorAddress("cf-connecting-ip", header, "203.0.113.5"),
    "198.51.100.7",
    "Cloudflare",
  );
  equal(pickVisitorAddress("x-real-ip", header, "203.0.113.5"), "198.51.100.8", "x-real-ip");
  equal(
    pickVisitorAddress("x-forwarded-for", header, "203.0.113.5"),
    "203.0.113.20",
    "x-forwarded-for: the entry the proxy appended, never the visitor's own first one",
  );
  equal(pickVisitorAddress(undefined, header, "not an address"), null, "not an address");
  equal(
    pickVisitorAddress("x-real-ip", () => undefined, "203.0.113.5"),
    null,
    "named, absent",
  );
});

test("E-07 the app's key goes only where a password may go: https, or this machine or its network", () => {
  const before = { key: process.env["AIAIC_FARMER_APP_KEY"], base: process.env["AIAIC_BASE_URL"] };
  const sent = (base: string) => {
    process.env["AIAIC_BASE_URL"] = base;
    return "x-aiaic-app-key" in aiaicHeaders();
  };
  try {
    process.env["AIAIC_FARMER_APP_KEY"] = "q".repeat(40);
    equal(sent("http://203.0.113.10:8017"), false, "plain http to a public address");
    equal(sent("https://aiaic.example.org"), true, "https");
    equal(sent("http://127.0.0.1:8791"), true, "this machine");
    equal(sent("http://host.docker.internal:8017"), true, "the host of this container");
    process.env["AIAIC_FARMER_APP_KEY"] = "short";
    equal(sent("https://aiaic.example.org"), false, "a key under 32 characters is no key");
  } finally {
    for (const [name, value] of [
      ["AIAIC_FARMER_APP_KEY", before.key],
      ["AIAIC_BASE_URL", before.base],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("E-02 with the key, only a device cookie this server issued names a device", () => {
  const key = "k".repeat(40);
  const id = "0123456789abcdef0123456789abcdef";
  const issued = deviceCookieValue(id, key);
  equal(issued.startsWith(`${id}.`), true, "the id and its signature");
  equal(deviceIdOfCookie(issued, key), id, "issued here");
  equal(deviceIdOfCookie(id, key), null, "a bare id (read off a screen)");
  equal(
    deviceIdOfCookie(deviceCookieValue(id, "z".repeat(40)), key),
    null,
    "signed with another key",
  );
  equal(deviceIdOfCookie(`${issued}.x`, key), null, "a third part");
  equal(
    deviceIdOfCookie(`${id.toUpperCase()}.${issued.split(".")[1]}`, key),
    null,
    "not lowercase hex",
  );
  equal(deviceCookieValue(id, null), id, "without the key: the bare id, as before");
  equal(deviceIdOfCookie(id, null), id, "without the key: taken as it is");
});

// AIAIC's real answer to a crisis (POST /safety/check, recorded by AIAIC's recorder; tests/fixtures/aiaic/)
const crisisRecorded = JSON.parse(
  readFileSync(new URL("./fixtures/aiaic/safety_check_crisis.json", import.meta.url), "utf8"),
) as { answer: Record<string, unknown> };

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await testAsync(
  "E-04 a notice that changed is said only after her words were read for distress",
  async () => {
    const realFetch = globalThis.fetch;
    const asked: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      asked.push(String(url));
      return new Response(JSON.stringify(crisisRecorded.answer), { status: 200 });
    }) as typeof fetch;
    try {
      const form = {
        password: "longenough1",
        displayName: null,
        state: "mh" as const,
        district: "nashik",
        lang: "en",
        agreed: true as const,
        noticeVersion: "registration-2026-10-01",
      };
      const crisis = await register({ ...form, username: "i_want_to_end_my_life" });
      equal(
        crisis.ok === false && crisis.code,
        "crisis",
        "her words read as distress: the crisis card first",
      );
      equal(
        asked.length === 1 && asked[0].endsWith("/safety/check"),
        true,
        "only the scan was asked",
      );
      asked.length = 0;
      globalThis.fetch = (async (url: string | URL | Request) => {
        asked.push(String(url));
        return new Response(JSON.stringify({ distress: false }), { status: 200 });
      }) as typeof fetch;
      const changed = await register({ ...form, username: "asha_patil" });
      equal(
        changed.ok === false && changed.code,
        "notice_changed",
        "nothing in distress: the refusal",
      );
      equal(
        asked.some((u) => u.endsWith("/farmer/register")),
        false,
        "never registered on an old notice",
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  },
);

console.log(`\n${passed} passed, ${failed} failed, of ${passed + failed}`);
if (failed) process.exit(1);
