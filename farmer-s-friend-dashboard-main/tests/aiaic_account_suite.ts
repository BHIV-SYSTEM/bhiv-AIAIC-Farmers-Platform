/**
 * Her account's rules that need no server (push 4b audit, 25 Oct 2026). Run: `npx tsx tests/aiaic_account_suite.ts`.
 *
 * - R-05: the registration notice's version is tied to its words: their sha256 (en, mr, hi) must be the one recorded
 *   beside the version, so the words cannot change without a new version (AIAIC records her consent by version).
 * - R-03: what this phone would refuse in a registration form, in the order the page says it; and the words the scan
 *   reads first: a username's `_ . -` as spaces (a username holds no space).
 */
import { createHash } from "node:crypto";

import {
  NOTICE_WORDS_SHA256,
  REGISTRATION_NOTICE_VERSION,
  registerRefusal,
  wordsToScan,
} from "../src/lib/aiaic-account";
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
  equal(REGISTRATION_NOTICE_VERSION, "registration-2026-10-25b", "the version AIAIC asks for");
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

console.log(`\n${passed} passed, ${failed} failed, of ${passed + failed}`);
if (failed) process.exit(1);
