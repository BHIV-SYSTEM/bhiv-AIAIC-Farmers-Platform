import { AIAIC_HEADERS, isTunnelErrorBody, resolveBaseUrl } from "./aiaic-base.server";
import {
  signalItemOf,
  type CropSignalsAnswer,
  type Estate,
  type SignalItem,
} from "./aiaic-analysis";

/**
 * AIAIC's `GET /places/crop-signals`, read on this server (never from the browser): what AIAIC holds about one crop in
 * one district (AIAIC_BACKEND_CONTRACT.md, "A crop's own answers in one district"). Only what the screen shows comes
 * back. The district and the crop are AIAIC's own keys, from its lists; AIAIC reads every box for distress first and
 * then answers its crisis card, which this passes on as `distress` (the page's crisis box leads; nothing is shown here).
 */

/** AIAIC's own farmer app waits 15 s for its first page's small lists (`FIRST_PAGE_WAIT_MS`). */
const WAIT_MS = 15_000;

export async function cropSignals(q: {
  district: string;
  crop: string;
  state: Estate;
  lang: "en" | "mr" | "hi";
}): Promise<CropSignalsAnswer> {
  const { baseUrl } = resolveBaseUrl();
  const url = new URL(`${baseUrl}/places/crop-signals`);
  url.searchParams.set("district", q.district.toLowerCase());
  url.searchParams.set("crop", q.crop.toLowerCase());
  url.searchParams.set("state", q.state);
  url.searchParams.set("lang", q.lang);

  let res: Response;
  try {
    res = await fetch(url, { headers: AIAIC_HEADERS, signal: AbortSignal.timeout(WAIT_MS) });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    console.error("[aiaic-analysis] crop-signals not reached", name);
    return { kind: "failed", why: name === "TimeoutError" ? "timeout" : "part" };
  }
  const text = await res.text().catch(() => "");
  // ngrok's own page when the tunnel is down: "not answering", never "nothing held"
  if (isTunnelErrorBody(text)) return { kind: "failed", why: "part" };
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    return { kind: "failed", why: "part" };
  }
  const body =
    json && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : null;
  // THE CRISIS CARD OUTRANKS EVERYTHING: AIAIC answered it instead of the facts.
  if (body?.["distress"] === true) return { kind: "distress" };
  // A crop the district's own list does not hold is a 404 by design (`crop_not_offered_here`).
  if (res.status === 404) return { kind: "not_offered" };
  if (!res.ok || !body || !Array.isArray(body["items"])) {
    console.error("[aiaic-analysis] crop-signals answered", res.status);
    return { kind: "failed", why: "part" };
  }
  const items = body["items"].map(signalItemOf).filter((i): i is SignalItem => i !== null);
  const keys = Array.isArray(body["key_indications"])
    ? body["key_indications"].filter((k): k is string => typeof k === "string")
    : [];
  const said = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;
  return {
    kind: "held",
    signals: {
      district: said(body["district"], q.district),
      crop_name: said(body["crop_name"], q.crop),
      key_indications: keys,
      items,
      note: said(body["note"], "") || null,
    },
  };
}
