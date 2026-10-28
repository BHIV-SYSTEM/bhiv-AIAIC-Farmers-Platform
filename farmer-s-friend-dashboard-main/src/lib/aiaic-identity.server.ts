/**
 * WHO IS ASKING AIAIC, kept on this server only (push 4b, 25 Oct 2026; AIAIC_BACKEND_CONTRACT.md sections 22-24).
 *
 * - THIS DEVICE'S ID: the httpOnly cookie `aiaic_guest`, 32 lowercase hex characters made once by this server with Web
 *   Crypto (never personal: no name, no number). Sent to AIAIC as `X-AIAIC-Guest` on her reads while nobody is signed
 *   in, so AIAIC records what a guest looked at under her device (the owner: "all the working and analysis done under
 *   guest should be also recorded"), and so her help queries stay hers on this phone. With the farmer app's key set,
 *   the cookie holds the id and its HMAC under that key, and a cookie this server did not issue is no device's: an id
 *   read off the team's screen or a link opens nothing here (push 4b re-check, E-02).
 * - HER SESSION after she signs in: the httpOnly cookie `aiaic_session`, holding AIAIC's token with her username, her
 *   name and the token's expiry (for the account chip). Read and written only here, in server functions: never readable
 *   by the page's script, never in localStorage, never logged, never returned to the browser. It expires with the token.
 * - EXACTLY ONE OF THE TWO goes with a call: her token when she is signed in, else the device's id. A signed-in farmer's
 *   analysis is hers alone, never tied to the device; registration and sign-in send neither, so nothing here joins a
 *   guest's history to an account she makes later.
 * - When AIAIC answers 401 to her token, her session is dropped and she goes on as a guest; the account chip says so
 *   once (`aiaic_note`).
 * - Outside a request (the tests run this server's clients directly) there is no cookie: a guest with no device id.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import {
  deleteCookie,
  getCookie,
  getRequest,
  getRequestProtocol,
  setCookie,
} from "@tanstack/react-start/server";

import { farmerAppKey, resolveBaseUrl, signInAllowed } from "./aiaic-base.server";

export const GUEST_COOKIE = "aiaic_guest";
export const SESSION_COOKIE = "aiaic_session";
export const NOTE_COOKIE = "aiaic_note";
export const GUEST_HEADER = "x-aiaic-guest";

/** A device's id as AIAIC keeps it (its contract, section 23): 32 lowercase hex characters; anything else it ignores. */
export const GUEST_ID_RE = /^[0-9a-f]{32}$/;

/** Browsers keep a cookie at most 400 days. */
const GUEST_KEEP_S = 400 * 24 * 60 * 60;
const NOTE_KEEP_S = 24 * 60 * 60;
/** Her token is not sent in its last minute (it would expire on the way). */
const TOKEN_MARGIN_MS = 60_000;
/** A token whose answer named no readable expiry is kept an hour, never longer. */
const UNDATED_TOKEN_MS = 60 * 60_000;
/** AIAIC's token is a JWT (base64url parts and dots); a bound on its length keeps the cookie small. */
const TOKEN_RE = /^[A-Za-z0-9._~+/=-]{16,3000}$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,64}$/;

export type HerSession = {
  token: string;
  username: string;
  displayName: string | null;
  /** When AIAIC's token expires (ms since 1970). */
  expiresAt: number;
};

/** What the app says once: her session was dropped because AIAIC no longer took her token, or she erased her account. */
export type Note = "signed_out" | "erased";

export type Asker =
  { kind: "her"; session: HerSession } | { kind: "device"; id: string } | { kind: "nobody" };

// ------------------------------------------------------------------------------------------------ cookies

function thisRequest(): object | null {
  try {
    return getRequest();
  } catch {
    return null; // outside a request
  }
}

function read(name: string): string | undefined {
  try {
    return getCookie(name);
  } catch {
    return undefined;
  }
}

function options(keepS: number) {
  let https = false;
  try {
    https = getRequestProtocol() === "https";
  } catch {
    /* outside a request */
  }
  return { httpOnly: true, secure: https, sameSite: "lax" as const, path: "/", maxAge: keepS };
}

function write(name: string, value: string, keepS: number): boolean {
  try {
    setCookie(name, value, options(keepS));
    return true;
  } catch {
    return false;
  }
}

function remove(name: string): void {
  try {
    deleteCookie(name, options(0));
  } catch {
    /* outside a request */
  }
}

// ------------------------------------------------------------------------------------------------ the device

/** A new device id: 16 random bytes from Web Crypto, as 32 lowercase hex characters. */
export function newDeviceId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function deviceIdMac(id: string, key: string): string {
  return createHmac("sha256", key).update(`aiaic_guest:${id}`).digest("base64url");
}

/** The cookie's value for a device id: with the farmer app's key, the id and its HMAC under it; without, the bare id. */
export function deviceCookieValue(id: string, key: string | null): string {
  return key ? `${id}.${deviceIdMac(id, key)}` : id;
}

/**
 * The device id a cookie holds when this server issued it (push 4b re-check, E-02): with the key, only an id whose HMAC
 * matches; without the key, the id as it is (as before the key). Null otherwise.
 */
export function deviceIdOfCookie(value: string | undefined, key: string | null): string | null {
  if (!value) return null;
  const [id, mac, extra] = value.split(".");
  if (!id || !GUEST_ID_RE.test(id) || extra !== undefined) return null;
  if (!key) return id;
  if (!mac) return null;
  const want = Buffer.from(deviceIdMac(id, key));
  const got = Buffer.from(mac);
  return got.length === want.length && timingSafeEqual(got, want) ? id : null;
}

/** The id made in a request that came without one, so every call of that request sends the same id. */
const madeIn = new WeakMap<object, string>();

/** Requests in which this device's id was forgotten (push 4b audit, R-10): none is read or made for the rest of it. */
const forgottenIn = new WeakSet<object>();

/** This device's id: the one it keeps, else one made now and kept (null outside a request, or when it cannot be kept). */
export function deviceId(): string | null {
  const req0 = thisRequest();
  if (req0 && forgottenIn.has(req0)) return null;
  const key = farmerAppKey();
  const kept = deviceIdOfCookie(read(GUEST_COOKIE), key);
  if (kept) return kept;
  const req = thisRequest();
  if (!req) return null;
  const made = madeIn.get(req);
  if (made) return made;
  const id = newDeviceId();
  if (!write(GUEST_COOKIE, deviceCookieValue(id, key), GUEST_KEEP_S)) return null;
  madeIn.set(req, id);
  return id;
}

/** Made on a device's first request (the request layer in `start.ts`), so its first page's reads share one id. */
export function ensureDeviceId(): void {
  deviceId();
}

/** This device's id forgotten (push 4b audit, R-10: a guest's questions and looks were just erased under it): its
 * cookie removed, so the next request makes a new id and nothing joins what comes next to what was forgotten. */
export function forgetDevice(): void {
  remove(GUEST_COOKIE);
  const req = thisRequest();
  if (req) forgottenIn.add(req);
}

// ------------------------------------------------------------------------------------------------ her session

/** Requests in which her session was dropped: the rest of that request goes on as a guest (its incoming cookie is
 * still in its headers). */
const droppedIn = new WeakSet<object>();

/** AIAIC's `expires_at` as ms since 1970; unreadable: an hour from now. */
export function tokenExpiry(expiresAt: unknown): number {
  const t = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
  return Number.isNaN(t) ? Date.now() + UNDATED_TOKEN_MS : t;
}

/** A session set by the tests only (`sessionForTests`); never set by the app. */
let testSession: HerSession | null | undefined;

/** FOR THE TESTS ONLY: act as a signed-in farmer (`null`: a guest; `undefined`: read the request's cookie again). */
export function sessionForTests(s: HerSession | null | undefined): void {
  // never in a production build (audit of 28 Oct 2026, PRIVACY-12): it would make every request act as one farmer
  if (process.env["NODE_ENV"] === "production")
    throw new Error("sessionForTests is for the tests only");
  testSession = s;
}

/** Her session when she is signed in and her token may be sent to AIAIC's address (`signInAllowed`), else null. */
export function herSession(): HerSession | null {
  if (testSession !== undefined) return testSession;
  const req = thisRequest();
  if (req && droppedIn.has(req)) return null;
  const raw = read(SESSION_COOKIE);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const token = o["t"];
  const username = o["u"];
  const name = o["n"];
  const expiresAt = o["e"];
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  if (typeof username !== "string" || !USERNAME_RE.test(username)) return null;
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return null;
  if (expiresAt - TOKEN_MARGIN_MS <= Date.now()) return null;
  if (!signInAllowed(resolveBaseUrl().baseUrl)) return null;
  return {
    token,
    username,
    displayName: typeof name === "string" && name.trim() ? name.trim() : null,
    expiresAt,
  };
}

/** Keeps her session (after she signed in, or with her name read again), until her token expires. */
export function keepHerSession(s: HerSession): boolean {
  const keepS = Math.floor((s.expiresAt - Date.now()) / 1000);
  if (keepS <= 0 || !TOKEN_RE.test(s.token) || !USERNAME_RE.test(s.username)) return false;
  const value = JSON.stringify({ t: s.token, u: s.username, n: s.displayName, e: s.expiresAt });
  if (!write(SESSION_COOKIE, value, keepS)) return false;
  remove(NOTE_COOKIE);
  const req = thisRequest();
  if (req) droppedIn.delete(req);
  return true;
}

/** Drops her session: she signed out (no note), or AIAIC no longer took her token (`signed_out`, said once). */
export function dropHerSession(note: Note | null): void {
  remove(SESSION_COOKIE);
  const req = thisRequest();
  if (req) droppedIn.add(req);
  if (note) write(NOTE_COOKIE, note, NOTE_KEEP_S);
}

/** The note a dropped session left, said once: read and removed. */
export function takeNote(): Note | null {
  const v = read(NOTE_COOKIE);
  if (v !== "signed_out" && v !== "erased") return null;
  remove(NOTE_COOKIE);
  return v;
}

/** Removes a note this request wrote (it is said by this request's own answer instead). */
export function clearNote(): void {
  remove(NOTE_COOKIE);
}

// ------------------------------------------------------------------------------------------------ one call

/** Who a call is made for: her when she is signed in, else this device, else nobody (outside a request). */
export function asker(): Asker {
  const her = herSession();
  if (her) return { kind: "her", session: her };
  const id = deviceId();
  return id ? { kind: "device", id } : { kind: "nobody" };
}

/** The one header that names who asked: her token, or the device's id (never both). */
export function askerHeaders(a: Asker): Record<string, string> {
  if (a.kind === "her") return { authorization: `Bearer ${a.session.token}` };
  if (a.kind === "device") return { [GUEST_HEADER]: a.id };
  return {};
}

/**
 * A read made for her: her token when she is signed in, else this device's id. AIAIC records `/farmer/advice` and
 * `/intelligence/*` as analyses under it; `/places/crop-signals` goes this way too but AIAIC does not record it (its
 * contract, section 23; push 4b audit, R-22). A token AIAIC refuses (401) drops her session (the account chip
 * says so once) and the read goes again, once, as a guest: the answer does not depend on who asked.
 */
export async function fetchForHer(
  url: URL | string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Response> {
  const once = (who: Asker) =>
    fetch(url, {
      method: "GET",
      headers: { ...headers, ...askerHeaders(who) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  const who = asker();
  const first = await once(who);
  if (first.status !== 401 || who.kind !== "her") return first;
  await first.body?.cancel().catch(() => undefined);
  dropHerSession("signed_out");
  return once(asker());
}
