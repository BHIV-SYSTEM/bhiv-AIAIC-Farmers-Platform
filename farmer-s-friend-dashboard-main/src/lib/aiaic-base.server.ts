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
