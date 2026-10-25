/**
 * HER ACCOUNT AND HER HELP QUERIES, the shapes the screens read (push 4b, 25 Oct 2026; AIAIC_BACKEND_CONTRACT.md
 * sections 22 and 24). Shared by the server (`aiaic-account.server.ts`) and the screens; nothing secret is in here.
 */

/** The registration notice's version this app shows (AIAIC refuses another with `notice_changed`). */
export const REGISTRATION_NOTICE_VERSION = "registration-2026-10-25";

/** Who is using the app on this device: a signed-in farmer, or a guest. */
export type Me = {
  signedIn: boolean;
  username: string | null;
  displayName: string | null;
  /** Said once: her session ended because AIAIC no longer took her token. */
  signedOutNote: boolean;
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
