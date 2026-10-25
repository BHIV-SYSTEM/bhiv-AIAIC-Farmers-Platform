import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  SERVICES,
  intelligenceItemSchema,
  type FailureReason,
  type IntelligenceItem,
  type Service,
  type ServiceResult,
} from "./aiaic-types";

const inputSchema = z.object({
  services: z.array(z.enum(SERVICES)).min(1),
  region: z.string().trim().max(80).optional(),
  crop: z.string().trim().max(80).optional(),
  /** APMC market for the market service, from the engine catalog. */
  mandi: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

/**
 * Proxies the live AIAIC intelligence API.
 *
 * Runs server-side so the ngrok bypass header and the (changeable) tunnel base
 * URL stay out of the browser and CORS never applies. No recommendation value
 * is ever synthesised here: a failed or empty upstream response is reported as
 * a failure/empty state, never as advice.
 */
export const getIntelligence = createServerFn({ method: "GET" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ baseUrlConfigured: boolean; results: ServiceResult[] }> => {
    const { resolveBaseUrl } = await import("./aiaic-base.server");
    const { baseUrl, configured } = resolveBaseUrl();

    const results = await Promise.all(
      data.services.map((service) =>
        fetchService({
          baseUrl,
          service,
          region: data.region ?? undefined,
          crop: data.crop ?? undefined,
          mandi: data.mandi ?? undefined,
          limit: data.limit ?? 3,
        }),
      ),
    );

    return { baseUrlConfigured: configured, results };
  });

async function fetchService(args: {
  baseUrl: string;
  service: Service;
  region: string | undefined;
  crop: string | undefined;
  mandi: string | undefined;
  limit: number;
}): Promise<ServiceResult> {
  const { baseUrl, service, region, crop, mandi, limit } = args;
  const fetchedAt = new Date().toISOString();
  const url = new URL(`${baseUrl}/intelligence/${service}`);
  // The market service reasons about an APMC market; the others about a district.
  if (service === "market" && mandi) url.searchParams.set("region", mandi);
  else if (region) url.searchParams.set("region", region);
  if (crop) url.searchParams.set("crop", crop);
  url.searchParams.set("limit", String(limit));

  const fail = (reason: FailureReason, status?: number, detail?: string): ServiceResult => ({
    ok: false,
    service,
    reason,
    ...(status === undefined ? {} : { status }),
    ...(detail === undefined ? {} : { detail }),
    fetchedAt,
  });

  const { AIAIC_HEADERS, isTunnelErrorBody } = await import("./aiaic-base.server");

  let response: Response;
  try {
    // who asked (push 4b): her token when she is signed in, else this device's id
    const { fetchForHer } = await import("./aiaic-identity.server");
    response = await fetchForHer(url, { ...AIAIC_HEADERS }, 20_000);
  } catch (error) {
    console.error(`[aiaic] ${service} request failed`, error);
    return fail("offline", undefined, "network");
  }

  const text = await response.text();

  // When the tunnel is down ngrok answers 404 with its own error body. That is
  // "service unavailable", not "no data for this district" — classify it before
  // the status codes below, or an offline tunnel reads as an unknown subject.
  if (isTunnelErrorBody(text)) return fail("offline", response.status, "tunnel_error_page");

  // Errors come back as { "detail": "..." } — keep the message for the review page.
  const upstreamDetail = errorDetail(text);
  if (response.status === 404) return fail("not_found", 404, upstreamDetail);
  if (!response.ok) {
    console.error(`[aiaic] ${service} returned ${response.status}`, upstreamDetail ?? "");
    return fail(
      response.status >= 500 ? "offline" : "request_failed",
      response.status,
      upstreamDetail,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail("bad_response", response.status, "not_json");
  }

  const items = extractItems(parsed);
  if (items === null) return fail("bad_response", response.status, "unexpected_shape");

  return { ok: true, service, items, fetchedAt };
}

function errorDetail(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : undefined;
  } catch {
    return undefined;
  }
}

/** The API may return a single item, an array, or a wrapper object. */
function extractItems(payload: unknown): IntelligenceItem[] | null {
  const candidates: unknown[] = [];

  if (Array.isArray(payload)) {
    candidates.push(...payload);
  } else if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const listKey = ["items", "results", "recommendations", "data", "intelligence"].find((k) =>
      Array.isArray(obj[k]),
    );
    if (listKey) candidates.push(...(obj[listKey] as unknown[]));
    else candidates.push(obj);
  } else {
    return null;
  }

  const items: IntelligenceItem[] = [];
  for (const candidate of candidates) {
    const result = intelligenceItemSchema.safeParse(candidate);
    if (result.success) items.push(result.data);
  }
  if (!items.length && candidates.length) return null;
  return items;
}
