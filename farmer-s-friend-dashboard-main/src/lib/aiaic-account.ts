/**
 * HER ACCOUNT AND HER HELP QUERIES, the shapes the screens read (push 4b, 25 Oct 2026; AIAIC_BACKEND_CONTRACT.md
 * sections 22 and 24). Shared by the server (`aiaic-account.server.ts`) and the screens; nothing secret is in here.
 */

/** The registration notice's version this app shows (AIAIC refuses another with `notice_changed`). Tied to the
 * notice's words: `tests/aiaic_account_suite.ts` checks `NOTICE_WORDS_SHA256` against the three languages' text, so the
 * words cannot change without a new version (push 4b audit, R-05). */
export const REGISTRATION_NOTICE_VERSION = "registration-2026-10-26";
/** sha256 of the notice's words in en, mr and hi (`aiaic.account.notice` each), joined by a newline. */
export const NOTICE_WORDS_SHA256 =
  "b626f6ed38ebbd36cbbd892202e67d03ecf05f26df2a3970619bfdce84121cd7";

/** The first thing this phone would refuse in a registration form, or null. What she typed is read for distress
 * BEFORE any of these is said (push 4b audit, R-03). */
export function registerRefusal(f: {
  username: string;
  password: string;
  again: string;
  district: string;
  agreed: boolean;
}): string | null {
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(f.username.trim())) return "invalid_username";
  if (f.password.length < 8) return "password_too_short";
  if (f.password !== f.again) return "password_mismatch";
  if (!f.district) return "place_not_held";
  if (!f.agreed) return "consent_required";
  return null;
}

/** The words of a form for the distress scan: a username's `_ . -` read as spaces (a username holds no space, so a
 * phrase joined by them would match nothing), then the other boxes as typed. */
export function wordsToScan(...boxes: (string | null | undefined)[]): string {
  return boxes
    .map((b, i) => (i === 0 ? (b ?? "").replace(/[_.-]+/g, " ") : (b ?? "")).trim())
    .filter(Boolean)
    .join(". ");
}

/** Who is using the app on this device: a signed-in farmer, or a guest. */
export type Me = {
  signedIn: boolean;
  username: string | null;
  displayName: string | null;
  /** Said once: her session ended because AIAIC no longer took her token. */
  signedOutNote: boolean;
  /** Said once: she erased her account on this phone (push 4b audit, R-10). */
  erasedNote: boolean;
};

export type Crisis = {
  answer: string | null;
  message: string | null;
  helplines: { name: string; phone: string }[];
};

/** How a sign-in, a registration or a help query went, by a code the screens word in her language. */
export type AccountOutcome =
  { ok: true } | { ok: false; code: string; reason?: string | null; crisis?: Crisis | null };

export const TOPICS = [
  "price",
  "storage",
  "transport",
  "sale",
  "payment",
  "crop",
  "app",
  "other",
] as const;
export type Topic = (typeof TOPICS)[number];

export type QueryMessage = {
  message_id: string;
  author: "farmer" | "operator";
  body: string;
  created_at: string;
};
export type HelpQuery = {
  query_id: string;
  topic: Topic;
  status: "open" | "answered" | "closed";
  urgent: boolean;
  state: string | null;
  district: string | null;
  crop: string | null;
  created_at: string;
  updated_at: string;
  last_author?: "farmer" | "operator" | null;
  last_body?: string | null;
  messages?: QueryMessage[];
};

export type QueriesResult =
  { ok: true; queries: HelpQuery[] } | { ok: false; code: string; crisis?: Crisis | null };
export type QueryResult =
  { ok: true; query: HelpQuery } | { ok: false; code: string; crisis?: Crisis | null };

/** A notice AIAIC keeps for her (only the kinds this app says): her approval, a reply from the team. */
export type Notice = {
  id: number;
  kind: "account_approved" | "query_answered";
  queryId: string | null;
  at: string;
};

type Words = (key: string, vars?: Record<string, string | number>) => string;

/** The words for an outcome's code, AIAIC's or this app's, from a family of keys (a code with no words: the family's
 * general sentence). */
export function accountWords(t: Words, code: string, family = "aiaic.account.code"): string {
  const key = `${family}.${code}`;
  const said = t(key);
  return said && said !== key ? said : t("aiaic.account.code.other");
}
