import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

/**
 * Where the AIAIC engine lives. The demo runs behind an ngrok tunnel whose URL
 * changes on every restart, so this is a server-side setting (`AIAIC_BASE_URL`)
 * that can be updated without a code change. The bundled default is the last
 * URL we were given.
 */
export const FALLBACK_BASE_URL = "http://163.128.209.18:8017";

export function resolveBaseUrl(): { baseUrl: string; configured: boolean } {
  const fromEnv = process.env["AIAIC_BASE_URL"];
  const baseUrl = (fromEnv ?? FALLBACK_BASE_URL).replace(/\/+$/, "");
  return { baseUrl, configured: Boolean(fromEnv) };
}

/**
 * True when a password, or a token AIAIC gave for one, may be sent to this address: https anywhere; plain http only to
 * this machine, its private network (10/8, 172.16/12, 192.168/16), `host.docker.internal`, or a container's own name
 * (no dot). Held for the server's own AIAIC account and for every farmer's sign-in, registration and token alike.
 */
export function signInAllowed(baseUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    return false;
  }
  if (u.protocol === "https:") return true;
  if (u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "host.docker.internal" || host === "::1") return true;
  if (!host.includes(".") && !host.includes(":")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * The engine is fronted by ngrok, which otherwise serves an HTML warning page. The channel (push 4b) labels every
 * analysis AIAIC records for this app's calls as the farmer app's, not as an unnamed caller's ("api"); it is a label
 * from AIAIC's closed list and changes no answer.
 */
export const AIAIC_HEADERS = {
  accept: "application/json",
  "ngrok-skip-browser-warning": "true",
  "x-aiaic-channel": "farmer_app",
} as const;

/** The farmer app's key, shared with AIAIC only (push 4b audit, R-07; AIAIC_BACKEND_CONTRACT.md section 24). */
const APP_KEY_ENV = "AIAIC_FARMER_APP_KEY";
const MIN_APP_KEY_LENGTH = 32;
/** Where this server learns its visitor's address (push 4b re-check, E-01); unset: its own socket's peer. */
const ADDRESS_FROM_ENV = "AIAIC_VISITOR_ADDRESS_FROM";
const IP_RE = /^[0-9A-Fa-f:.]{2,45}$/;

/** The farmer app's key when it is set on this server (at least 32 characters), else null. */
export function farmerAppKey(): string | null {
  const key = (process.env[APP_KEY_ENV] ?? "").trim();
  return key.length >= MIN_APP_KEY_LENGTH ? key : null;
}

/**
 * THE VISITOR'S ADDRESS, ONLY AS THIS SERVER CAN VOUCH FOR IT (push 4b re-check, E-01). A visitor can send any
 * `cf-connecting-ip`, `x-real-ip` or `x-forwarded-for` she likes, so none is read unless the deployment names the proxy
 * in front of this server, the only way in, and the header it sets (`AIAIC_VISITOR_ADDRESS_FROM`): `cf-connecting-ip`
 * (Cloudflare in front), `x-real-ip`, or `x-forwarded-for` (its LAST entry, the one that proxy appended; the ones
 * before it are hers to write). Unset, or anything else: the address of the socket the request came in on (the
 * repository's deployment publishes this server's own port). Null when none reads as an address.
 */
export function pickVisitorAddress(
  from: string | undefined,
  header: (name: string) => string | undefined,
  socketAddress: string | undefined,
): string | null {
  const how = (from ?? "").trim().toLowerCase();
  let ip: string | undefined;
  if (how === "cf-connecting-ip" || how === "x-real-ip") ip = (header(how) ?? "").trim();
  else if (how === "x-forwarded-for")
    ip = (header(how) ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .pop();
  else ip = socketAddress;
  return ip && IP_RE.test(ip) ? ip : null;
}

function visitorAddress(): string | null {
  try {
    return pickVisitorAddress(
      process.env[ADDRESS_FROM_ENV],
      (name) => getRequestHeader(name) ?? undefined,
      getRequestIP() ?? undefined,
    );
  } catch {
    return null; // outside a request (the tests call the clients directly)
  }
}

/**
 * The headers of every call this server makes to AIAIC. With the farmer app's key set on this server (the same value as
 * AIAIC's own `AIAIC_FARMER_APP_KEY`) AND an AIAIC address the key may travel to (`signInAllowed`: https, or this
 * machine or its private network; push 4b re-check, E-07), each call carries the key with the visitor's address, so
 * AIAIC keeps each farmer's own sign-in, registration and Help limits and believes a guest's device id only from this
 * app. Otherwise the calls go without it, and every farmer shares this server's address, as before the key. The key is
 * never logged, never sent over plain http to a public address, never put in the page.
 */
export function aiaicHeaders(): Record<string, string> {
  const key = farmerAppKey();
  if (!key || !signInAllowed(resolveBaseUrl().baseUrl)) return { ...AIAIC_HEADERS };
  const ip = visitorAddress();
  return {
    ...AIAIC_HEADERS,
    "x-aiaic-app-key": key,
    ...(ip ? { "x-aiaic-client-address": ip } : {}),
  };
}

/**
 * True when a response body came from ngrok itself rather than the engine.
 * When the tunnel is down ngrok answers HTTP 404 — with an HTML page for
 * browsers, and plain text `ERR_NGROK_3200` when we ask for JSON. Either way
 * that means "service not answering", never "no data for this subject", so it
 * must be classified before any status-code handling.
 */
export function isTunnelErrorBody(text: string): boolean {
  const head = text.trimStart().slice(0, 400);
  if (head.startsWith("<")) return true;
  if (/ERR_NGROK_\d+/.test(head)) return true;
  return /\bendpoint\b[^\n]*\bis offline\b/i.test(head);
}
