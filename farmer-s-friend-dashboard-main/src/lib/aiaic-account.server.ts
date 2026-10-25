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
  AIAIC_HEADERS,
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
  REGISTRATION_NOTICE_VERSION,
} from "./aiaic-account";
import {
  asker,
  askerHeaders,
  deviceId,
  dropHerSession,
  herSession,
  keepHerSession,
  takeNote,
  tokenExpiry,
} from "./aiaic-identity.server";

const TIMEOUT_MS = 15_000;

type Answer = { status: number; body: Record<string, unknown> | null; unreachable: boolean };

async function ask(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Answer> {
  const { baseUrl } = resolveBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...AIAIC_HEADERS,
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
  if (a.status === 429) return { code: "too_many_tries", reason: null };
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
      };
  } else deviceId(); // a guest's device gets its id on the first look
  return {
    signedIn: false,
    username: null,
    displayName: null,
    signedOutNote: takeNote() === "signed_out",
  };
}

// ------------------------------------------------------------------------------------------------ sign in, out

export async function signIn(q: {
  username: string;
  password: string;
  lang: string;
}): Promise<AccountOutcome> {
  if (!signInAllowed(resolveBaseUrl().baseUrl))
    return { ok: false, code: "aiaic_sign_in_needs_https" };
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

// ------------------------------------------------------------------------------------------------ register

export async function register(q: {
  username: string;
  password: string;
  displayName: string | null;
  state: "mh" | "mp";
  district: string;
  lang: string;
}): Promise<AccountOutcome> {
  if (!signInAllowed(resolveBaseUrl().baseUrl))
    return { ok: false, code: "aiaic_sign_in_needs_https" };
  const a = await ask("/farmer/register", {
    method: "POST",
    body: {
      username: q.username,
      password: q.password,
      ...(q.displayName ? { display_name: q.displayName } : {}),
      state: q.state,
      district: q.district,
      consent: true,
      notice_version: REGISTRATION_NOTICE_VERSION,
      lang: q.lang,
    },
  });
  const crisis = crisisOf(a.body);
  if (crisis) return { ok: false, code: "crisis", crisis };
  if (a.status === 201) return { ok: true };
  return { ok: false, ...codeOf(a) };
}

// ------------------------------------------------------------------------------------------------ her notices

/** Her unread notices this app says (her approval, a reply from the team); none for a guest. */
export async function myNotices(): Promise<Notice[]> {
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
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const n = r as Record<string, unknown>;
    if (n["read_at"] || (n["kind"] !== "account_approved" && n["kind"] !== "query_answered"))
      continue;
    const body =
      n["body"] && typeof n["body"] === "object" ? (n["body"] as Record<string, unknown>) : {};
    out.push({
      id: Number(n["notification_id"]),
      kind: n["kind"] as Notice["kind"],
      queryId: typeof body["query_id"] === "string" ? body["query_id"] : null,
      at: String(n["created_at"] ?? ""),
    });
  }
  return out;
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

/** One call for her queries, with who asked; a token AIAIC no longer takes ends her session (said once). */
async function askAsHer(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<Answer> {
  const who = asker();
  const a = await ask(path, { ...init, headers: askerHeaders(who) });
  if (a.status === 401 && who.kind === "her") {
    dropHerSession("signed_out");
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
