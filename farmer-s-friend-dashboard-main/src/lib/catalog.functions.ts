import { createServerFn } from "@tanstack/react-start";

import { catalogSchema, type Catalog, type CatalogResult } from "./aiaic-types";

/**
 * Reads `GET /catalog` — the engine's own list of valid services, crops,
 * regions and market mandis. Values are used exactly as the engine spells them;
 * only the display layer changes their casing.
 *
 * Cached in the worker for a few minutes so every page load does not hit the
 * tunnel. Never invents values: if the call fails, the caller falls back to the
 * built-in list and says so on screen.
 */
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; value: Catalog } | null = null;

export const getCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogResult> => {
    const { resolveBaseUrl, aiaicHeaders, isTunnelErrorBody } = await import("./aiaic-base.server");
    const { baseUrl, configured } = resolveBaseUrl();

    if (cache && Date.now() - cache.at < TTL_MS) {
      return { ok: true, catalog: cache.value, baseUrlConfigured: configured, cached: true };
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/catalog`, {
        method: "GET",
        headers: aiaicHeaders(),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      console.error("[aiaic] catalog request failed", error);
      return { ok: false, reason: "offline", baseUrlConfigured: configured };
    }

    const text = await response.text();

    // A down tunnel answers 404 with ngrok's own body (HTML, or plain
    // ERR_NGROK_3200 for JSON callers) — offline, not a catalog problem.
    if (isTunnelErrorBody(text)) {
      return {
        ok: false,
        reason: "offline",
        status: response.status,
        baseUrlConfigured: configured,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        reason: response.status >= 500 ? "offline" : "request_failed",
        status: response.status,
        detail: detailOf(text),
        baseUrlConfigured: configured,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        reason: "bad_response",
        status: response.status,
        baseUrlConfigured: configured,
      };
    }

    const result = catalogSchema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        reason: "bad_response",
        status: response.status,
        baseUrlConfigured: configured,
      };
    }

    cache = { at: Date.now(), value: result.data };
    return { ok: true, catalog: result.data, baseUrlConfigured: configured, cached: false };
  },
);

/** Errors come back as `{"detail": "..."}`; keep the message for the review page. */
function detailOf(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : undefined;
  } catch {
    return undefined;
  }
}
