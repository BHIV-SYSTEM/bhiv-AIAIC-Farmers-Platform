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

/** The engine is fronted by ngrok, which otherwise serves an HTML warning page. */
export const AIAIC_HEADERS = {
  accept: "application/json",
  "ngrok-skip-browser-warning": "true",
} as const;

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
