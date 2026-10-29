/**
 * HER ACCOUNT AND HER HELP QUERIES, on this server only (push 4b, 25 Oct 2026; AIAIC_BACKEND_CONTRACT.md sections
 * 22-24; the owner: "farmer registers in app and admin in dashboard get the registration and then the approval takes
 * place and then the farmer gets notified", "for now guest should also be there", "in app add the farmers help or query
 * tab ... reflected in the dashboard").
 *
 * - SIGNING IN sends her username and password to AIAIC's `/auth/login` (over https, or to this machine's own network:
 *   `signInAllowed`) and keeps AIAIC's token only in her httpOnly session cookie (`aiaic-identity.server.ts`). Only a
 *   FARMER's account belongs in this app. A registration still awaiting approval, or refused, is said as AIAIC says it
 *   (`awaiting_approval`, `registration_rejected` with the admin's reason): AIAIC tells that only after the password
 *   matched.
 * - REGISTERING sends her username, password, name (optional), state and district, and her agreement to the notice of
 *   this version (`REGISTRATION_NOTICE_VERSION`) to `/farmer/register`; her account then waits for AIAIC's team.
 *   Registration and sign-in carry neither her token nor this device's id: a guest's history is never joined to an
 *   account she makes.
 * - HER QUERIES go with her token when she is signed in, else with this device's id; the team's replies come back as the
 *   team's. A crisis typed anywhere gets AIAIC's crisis card first (`crisis`), and nothing of it is kept.
 * - A password is never logged, never kept, never returned; a token never leaves this server.
 */
import {
  aiaicHeaders,
  isTunnelErrorBody,
  resolveBaseUrl,
  signInAllowed,
} from "./aiaic-base.server";
import {
  type AccountOutcome,
  type Crisis,
  type HelpQuery,
  type Me,
  type Notice,
  type QueriesResult,
  type QueryResult,
  type TradeNoticeKind,
  REGISTRATION_NOTICE_VERSION,
  TRADE_NOTICE_KINDS,
  tradeFactsOf,
  wordsToScan,
} from "./aiaic-account";
import {
  asker,
  askerHeaders,
  deviceId,
  dropHerSession,
  forgetDevice,
  herSession,
  keepHerSession,
  takeNote,
  tokenExpiry,
} from "./aiaic-identity.server";
import { everyCropName } from "./aiaic-trade.server";

const TIMEOUT_MS = 15_000;

type Answer = { status: number; body: Record<string, unknown> | null; unreachable: boolean };

async function ask(
  path: string,
  init: {
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Answer> {
  const { baseUrl } = resolveBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...aiaicHeaders(),
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(init.headers ?? {}),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { status: 0, body: null, unreachable: true };
  }
  const text = await res.text().catch(() => "");
  if (isTunnelErrorBody(text)) return { status: res.status, body: null, unreachable: true };
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = text ? JSON.parse(text) : null;
    body =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
  } catch {
    body = null;
  }
  return { status: res.status, body, unreachable: false };
}

function crisisOf(body: Record<string, unknown> | null): Crisis | null {
  if (!body || body["distress"] !== true) return null;
  const lines = Array.isArray(body["talk_to_someone"]) ? body["talk_to_someone"] : [];
  return {
    answer: typeof body["answer"] === "string" ? body["answer"] : null,
    message: typeof body["message"] === "string" ? body["message"] : null,
    helplines: lines
      .map((h) => (h && typeof h === "object" ? (h as Record<string, unknown>) : {}))
      .filter((h) => typeof h["phone"] === "string")
      .map((h) => ({ name: String(h["name"] ?? ""), phone: String(h["phone"]) })),
  };
}

/** AIAIC's refusal code (`{detail: {reason_code}}`), else one of this app's by the status. */
function codeOf(a: Answer): { code: string; reason: string | null } {
  if (a.unreachable) return { code: "aiaic_unavailable", reason: null };
  const detail = a.body?.["detail"];
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as Record<string, unknown>;
    if (typeof d["reason_code"] === "string")
      return {
        code: d["reason_code"],
        reason: typeof d["reason"] === "string" ? d["reason"] : null,
      };
  }
  if (a.status === 401) return { code: "wrong_credentials", reason: null };
  // a 429 is a pause after many tries from here (hers, or this address's), said without blame and without a cause
  // AIAIC did not give (push 4b audit, R-07; re-check, E-03)
  if (a.status === 429) return { code: "busy", reason: null };
  if (a.status === 422) return { code: "not_accepted", reason: null };
  if (a.status >= 500 || a.status === 0) return { code: "aiaic_unavailable", reason: null };
  return { code: "other", reason: null };
}

// ------------------------------------------------------------------------------------------------ who is here

/** Who is using the app here. A signed-in farmer is checked with AIAIC (`/auth/me`): a token it no longer takes ends
 * her session, and she is told once. */
export async function whoIsHere(): Promise<Me> {
  const her = herSession();
  if (her) {
    const a = await ask("/auth/me", { headers: { authorization: `Bearer ${her.token}` } });
    if (a.status === 401) dropHerSession("signed_out");
    else
      return {
        signedIn: true,
        username: her.username,
        displayName: her.displayName,
        signedOutNote: false,
        erasedNote: false,
      };
  } else deviceId(); // a guest's device gets its id on the first look
  const note = takeNote();
  return {
    signedIn: false,
    username: null,
    displayName: null,
    signedOutNote: note === "signed_out",
    erasedNote: note === "erased",
  };
}

// ------------------------------------------------------------------------------------------------ sign in, out

export async function signIn(q: {
  username: string;
  password: string;
  lang: string;
}): Promise<AccountOutcome> {
  if (!signInAllowed(resolveBaseUrl().baseUrl))
    return refusedAfterTheScan(
      { ok: false, code: "aiaic_sign_in_needs_https" },
      wordsToScan(q.username),
      q.lang,
    );
  const a = await ask("/auth/login", {
    method: "POST",
    body: { username: q.username, password: q.password, lang: q.lang },
  });
  const crisis = crisisOf(a.body);
  if (crisis) return { ok: false, code: "crisis", crisis };
  if (a.status !== 200 || !a.body) return { ok: false, ...codeOf(a) };
  const token = a.body["access_token"];
  if (typeof token !== "string" || !token) return { ok: false, code: "aiaic_answer_unreadable" };
  if (a.body["role"] !== "farmer") return { ok: false, code: "not_a_farmer" };
  // her name, for the account chip (AIAIC's own record of it)
  const me = await ask("/auth/me", { headers: { authorization: `Bearer ${token}` } });
  const name = me.body?.["display_name"];
  const kept = keepHerSession({
    token,
    username: typeof a.body["username"] === "string" ? a.body["username"] : q.username,
    displayName: typeof name === "string" && name.trim() ? name.trim() : null,
    expiresAt: tokenExpiry(a.body["expires_at"]),
  });
  return kept ? { ok: true } : { ok: false, code: "session_not_kept" };
}

export function signOut(): AccountOutcome {
  dropHerSession(null);
  return { ok: true };
}

/**
 * A refusal this server gives before AIAIC is asked, said only after what she typed was read for distress (push 4b
 * re-check, E-04; the platform's rule D-105: nothing answers a person in crisis before the scan does): AIAIC's crisis
 * card when her words read as one.
 */
async function refusedAfterTheScan(
  refusal: AccountOutcome,
  words: string,
  lang: string,
): Promise<AccountOutcome> {
  const crisis = await scanFirst({ text: words, lang });
  return crisis ? { ok: false, code: "crisis", crisis } : refusal;
}

// ------------------------------------------------------------------------------------------------ register

export async function register(q: {
  username: string;
  password: string;
  displayName: string | null;
  state: "mh" | "mp";
  district: string;
  lang: string;
  /** Her own tick on the notice's box, and the version of the notice the page showed her (push 4b audit, R-05). */
  agreed: true;
  noticeVersion: string;
}): Promise<AccountOutcome> {
  const early =
    q.noticeVersion !== REGISTRATION_NOTICE_VERSION
      ? "notice_changed"
      : !signInAllowed(resolveBaseUrl().baseUrl)
        ? "aiaic_sign_in_needs_https"
        : null;
  if (early)
    return refusedAfterTheScan(
      { ok: false, code: early },
      wordsToScan(q.username, q.displayName),
      q.lang,
    );
  const a = await ask("/farmer/register", {
    method: "POST",
    body: {
      username: q.username,
      password: q.password,
      ...(q.displayName ? { display_name: q.displayName } : {}),
      state: q.state,
      district: q.district,
      consent: q.agreed,
      notice_version: q.noticeVersion,
      lang: q.lang,
    },
  });
  const crisis = crisisOf(a.body);
  if (crisis) return { ok: false, code: "crisis", crisis };
  if (a.status === 201) return { ok: true };
  return { ok: false, ...codeOf(a) };
}

// ------------------------------------------------------------------------------------------------ her notices

/** The farmer's unread notices this app says (their approval, a reply from the team, AIAIC's send of their money, their
 * sale's news; a crop named in the reader's language `lang`), then the READ notices that said an offer was given more
 * time (`read: true`, never shown as news); none for a guest. */
export async function myNotices(lang = "en"): Promise<Notice[]> {
  const her = herSession();
  if (!her) return [];
  const a = await ask("/notifications", { headers: { authorization: `Bearer ${her.token}` } });
  if (a.status === 401) {
    dropHerSession("signed_out");
    return [];
  }
  const rows = Array.isArray(a.body?.["notifications"])
    ? (a.body?.["notifications"] as unknown[])
    : [];
  const out: Notice[] = [];
  const kept: Notice[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const n = r as Record<string, unknown>;
    const kind = String(n["kind"] ?? "");
    const trade = (TRADE_NOTICE_KINDS as readonly string[]).includes(kind);
    if (
      kind !== "account_approved" &&
      kind !== "query_answered" &&
      kind !== "trade_farmer_paid" &&
      !trade
    )
      continue;
    const body =
      n["body"] && typeof n["body"] === "object" ? (n["body"] as Record<string, unknown>) : {};
    // HER SALE'S NEWS (30 Oct 2026): an offer on her lot or more time to answer it, a step on her order, her order called
    // off; facts field by field (`tradeFactsOf`). A READ notice is kept only when it says an offer was given more time
    // (her step bar says so beside the offer's own last day); it is never shown as news again.
    if (trade) {
      const facts = tradeFactsOf(kind, body);
      if (!facts) continue;
      if (n["read_at"]) {
        if (kind === "trade_offer" && facts.moreTime)
          kept.push({
            id: Number(n["notification_id"]),
            kind: kind as TradeNoticeKind,
            queryId: null,
            at: String(n["created_at"] ?? ""),
            trade: facts,
            read: true,
          });
        continue;
      }
      // one notice per offer or per order: the newest (AIAIC lists the newest first); an older one is read with it
      const subject = facts.offerId ? `offer:${facts.offerId}` : `order:${facts.orderId}`;
      const newerNews = out.find(
        (o) =>
          o.trade &&
          (o.trade.offerId ? `offer:${o.trade.offerId}` : `order:${o.trade.orderId}`) === subject,
      );
      if (newerNews) {
        newerNews.alsoIds = [...(newerNews.alsoIds ?? []), Number(n["notification_id"])];
        continue;
      }
      out.push({
        id: Number(n["notification_id"]),
        kind: kind as TradeNoticeKind,
        queryId: null,
        at: String(n["created_at"] ?? ""),
        trade: facts,
      });
      continue;
    }
    if (n["read_at"]) continue;
    // AIAIC's send of her money moved (the payment buttons of 28 Oct 2026): its facts, field by field; a notice
    // without its order or state is not shown
    const money =
      n["kind"] === "trade_farmer_paid"
        ? typeof body["order_id"] === "string" && typeof body["status"] === "string"
          ? {
              orderId: body["order_id"],
              crop: typeof body["crop"] === "string" ? body["crop"] : null,
              status: body["status"],
              amountInr: typeof body["amount_inr"] === "number" ? body["amount_inr"] : null,
              utr: typeof body["utr"] === "string" ? body["utr"] : null,
              testMode: body["test_mode"] === true,
            }
          : undefined
        : null;
    if (money === undefined) continue;
    // one notice per sale's money: the newest (AIAIC lists the newest first); an older one is read with it
    const newer = money ? out.find((o) => o.money?.orderId === money.orderId) : undefined;
    if (newer) {
      newer.alsoIds = [...(newer.alsoIds ?? []), Number(n["notification_id"])];
      continue;
    }
    out.push({
      id: Number(n["notification_id"]),
      kind: n["kind"] as Notice["kind"],
      queryId: typeof body["query_id"] === "string" ? body["query_id"] : null,
      at: String(n["created_at"] ?? ""),
      money,
    });
  }
  // THE CROP BY AIAIC'S NAME IN THE READER'S LANGUAGE (R5P-10, 28 Oct 2026), asked only when a notice shown names one
  if (out.some((o) => o.money?.crop || o.trade?.crop)) {
    const names = await everyCropName(lang);
    for (const o of out) {
      if (o.money?.crop) o.money.cropName = names[o.money.crop] ?? null;
      if (o.trade?.crop) o.trade.cropName = names[o.trade.crop] ?? null;
    }
  }
  return [...out, ...kept];
}

export async function noticeRead(id: number): Promise<void> {
  const her = herSession();
  if (!her) return;
  await ask(`/notifications/${encodeURIComponent(String(id))}/read`, {
    method: "POST",
    headers: { authorization: `Bearer ${her.token}` },
  });
}

// ------------------------------------------------------------------------------------------------ her queries

/**
 * One call for her queries, with who asked; a token AIAIC no longer takes ends her session (said once). A READ is then
 * asked again as this device; a WRITE never is (push 4b audit, R-09): her words are never filed under the phone, where
 * a later guest would read them and erasing her account would not remove them. She is told she was signed out.
 */
async function askAsHer(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<Answer> {
  const who = asker();
  const a = await ask(path, { ...init, headers: askerHeaders(who) });
  if (a.status === 401 && who.kind === "her") {
    dropHerSession("signed_out");
    if ((init.method ?? "GET") !== "GET")
      return {
        status: 401,
        body: { detail: { reason_code: "aiaic_signed_out" } },
        unreachable: false,
      };
    return ask(path, { ...init, headers: askerHeaders(asker()) });
  }
  return a;
}

export async function myQueries(): Promise<QueriesResult> {
  const a = await askAsHer("/farmer/queries");
  if (a.status !== 200 || !a.body) return { ok: false, code: codeOf(a).code };
  return {
    ok: true,
    queries: (Array.isArray(a.body["queries"]) ? a.body["queries"] : []) as HelpQuery[],
  };
}

export async function myQuery(id: string): Promise<QueryResult> {
  const a = await askAsHer(`/farmer/queries/${encodeURIComponent(id)}`);
  if (a.status !== 200 || !a.body) return { ok: false, code: codeOf(a).code };
  return { ok: true, query: a.body as unknown as HelpQuery };
}

export async function askTheTeam(q: {
  topic: string;
  text: string;
  state: "mh" | "mp" | null;
  district: string | null;
  crop: string | null;
  lang: string;
}): Promise<QueryResult> {
  const a = await askAsHer("/farmer/queries", {
    method: "POST",
    body: {
      topic: q.topic,
      text: q.text,
      ...(q.state ? { state: q.state } : {}),
      ...(q.district ? { district: q.district } : {}),
      ...(q.crop ? { crop: q.crop } : {}),
      lang: q.lang,
    },
  });
  const crisis = crisisOf(a.body);
  if (crisis) return { ok: false, code: "crisis", crisis };
  if (a.status !== 201 || !a.body) return { ok: false, code: codeOf(a).code };
  return { ok: true, query: a.body as unknown as HelpQuery };
}

export async function writeAgain(q: {
  id: string;
  text: string;
  lang: string;
}): Promise<QueryResult> {
  const a = await askAsHer(`/farmer/queries/${encodeURIComponent(q.id)}/messages`, {
    method: "POST",
    body: { text: q.text, lang: q.lang },
  });
  const crisis = crisisOf(a.body);
  if (crisis) return { ok: false, code: "crisis", crisis };
  if (a.status !== 200 || !a.body) return { ok: false, code: codeOf(a).code };
  return { ok: true, query: a.body as unknown as HelpQuery };
}

// ------------------------------------------------------------------------------------------------ before a refusal

/**
 * WORDS SHE TYPED, READ FOR DISTRESS BEFORE ANY REFUSAL ON THIS PHONE (push 4b audit, R-03; the platform's rule D-105:
 * nothing answers a person in crisis before the scan does). When the page would refuse a form for something else (no
 * topic chosen, a username of the wrong shape, the notice not ticked, no password yet), what she typed goes first to
 * AIAIC's `/safety/check`, which keeps nothing: its crisis card, or null.
 */
export async function scanFirst(q: { text: string; lang: string }): Promise<Crisis | null> {
  const text = q.text.trim().slice(0, 2000);
  if (!text) return null;
  const a = await ask("/safety/check", { method: "POST", body: { text, lang: q.lang } });
  return crisisOf(a.body);
}

// ------------------------------------------------------------------------------------------------ her erasure

/**
 * Her account erased, by herself (push 4b audit, R-10; AIAIC's `DELETE /farmer/me`): her account, profile, notices,
 * help questions and looks go; each past answer is kept with no link to her; her sales stay as records of the sale
 * without her name. Her session ends here.
 */
export async function eraseMyAccount(): Promise<AccountOutcome> {
  const her = herSession();
  if (!her) return { ok: false, code: "not_signed_in" };
  const a = await ask("/farmer/me", {
    method: "DELETE",
    headers: { authorization: `Bearer ${her.token}` },
  });
  if (a.status === 200) {
    dropHerSession("erased"); // said once on the next page: her account is erased
    return { ok: true };
  }
  if (a.status === 401) dropHerSession("signed_out");
  return { ok: false, ...codeOf(a) };
}

/**
 * A guest's questions and looks forgotten (push 4b audit, R-10; AIAIC's `POST /farmer/guest/forget`): removed under
 * this phone's id; each past answer kept without it. The phone then gets a new id, so nothing joins what comes next to
 * what was forgotten.
 */
export async function forgetThisPhone(): Promise<AccountOutcome> {
  if (herSession()) return { ok: false, code: "signed_in" };
  const id = deviceId();
  if (!id) return { ok: false, code: "aiaic_unavailable" };
  const a = await ask("/farmer/guest/forget", {
    method: "POST",
    body: {},
    headers: askerHeaders({ kind: "device", id }),
  });
  if (a.status !== 200) return { ok: false, ...codeOf(a) };
  forgetDevice();
  return { ok: true };
}
