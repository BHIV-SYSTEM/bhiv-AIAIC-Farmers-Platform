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
const IP_RE = /^[0-9A-Fa-f:.]{2,45}$/;

/**
 * The visitor's address as the hosting platform names it on THIS server's incoming request (Cloudflare's
 * `cf-connecting-ip`, else `x-real-ip`, else the first `x-forwarded-for` entry, else the socket): never a header
 * forwarded from the browser's own call to AIAIC. A platform that let a browser set these would let a visitor choose the
 * address AIAIC's limits see for her, never more than that. Null outside a request, or when none reads as an address.
 */
function visitorAddress(): string | null {
  try {
    for (const name of ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"] as const) {
      const first = (getRequestHeader(name) ?? "").split(",")[0]?.trim();
      if (first && IP_RE.test(first)) return first;
    }
    const ip = getRequestIP();
    return ip && IP_RE.test(ip) ? ip : null;
  } catch {
    return null; // outside a request (the tests call the clients directly)
  }
}

/**
 * The headers of every call this server makes to AIAIC. With the farmer app's key set on this server (at least 32
 * characters, the same value as AIAIC's own `AIAIC_FARMER_APP_KEY`), each call carries it with the visitor's address, so
 * AIAIC keeps each farmer's own sign-in, registration and Help limits (without it every farmer shares this server's
 * address: 30 mistyped passwords pause everyone's sign-in) and believes a guest's device id only from this app. The key
 * is never logged, never sent anywhere but AIAIC, never put in the page.
 */
export function aiaicHeaders(): Record<string, string> {
  const key = (process.env[APP_KEY_ENV] ?? "").trim();
  if (key.length < MIN_APP_KEY_LENGTH) return { ...AIAIC_HEADERS };
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
