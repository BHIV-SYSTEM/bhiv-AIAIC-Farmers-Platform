import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { FailureReason } from "./aiaic-types";

const inputSchema = z.object({
  /** Data URL or bare base64 of the photo taken by the farmer. */
  image: z.string().min(32),
  filename: z.string().max(120).optional(),
  crop: z.string().trim().max(80).optional(),
  state: z.string().trim().max(10).default("mh"),
  lang: z.enum(["en", "mr", "hi"]).default("en"),
  mode: z.string().default("bioclip"),
});

export type PlantObservation = { label: string; value: string };

export type FarmerView = {
  lang?: string | undefined;
  headline: string;
  lines: string[];
  headline_from?: string | undefined;
  not_a_health_check: string;
  next_step?:
    | {
        text: string;
        phone?: string | undefined;
      }
    | undefined;
};

export type PlantResult = {
  /** False when no plant-intelligence URL is configured yet. */
  configured: boolean;
  ok: boolean;
  reason?: FailureReason | undefined;
  detail?: string | undefined;
  status?: number | undefined;
  farmerView?: FarmerView | undefined;
  distress?: boolean | undefined;
  requestId?: string | undefined;
  species?: string | undefined;
  stage?: string | undefined;
  observations: PlantObservation[];
  /** Raw engine JSON, kept as text for the expert review page. */
  raw?: string | undefined;
  fetchedAt: string;
};

/**
 * Sends a leaf/plant photo to the Plant Intelligence subsystem.
 * Confirmed contract:
 * - Base URL: http://163.128.209.18:8017/aqiaic/plant
 * - Endpoint: POST ${PLANT_BASE_URL}/analyze
 * - Multipart field: file
 * - Additional form fields: mode=bioclip, lang=en|mr|hi, crop (optional), state=mh|mp
 *
 * This provides plant identification/observations, NOT a confirmed disease diagnosis.
 */
export const analyzePlantPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<PlantResult> => {
    const fetchedAt = new Date().toISOString();
    const envUrl = process.env["PLANT_BASE_URL"];
    const baseUrl = (envUrl || "http://163.128.209.18:8017/aqiaic/plant").replace(/\/+$/, "");
    if (!baseUrl) {
      return { configured: false, ok: false, reason: "offline", observations: [], fetchedAt };
    }

    const { isTunnelErrorBody } = await import("./aiaic-base.server");

    let body: FormData;
    try {
      body = new FormData();
      const base64 = data.image.includes(",") ? data.image.split(",")[1]! : data.image;
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      // Client-side size guard: 12MB limit check
      if (bytes.length > 12 * 1024 * 1024) {
        return {
          configured: true,
          ok: false,
          status: 413,
          reason: "request_failed",
          detail: "Image exceeds 12 MB limit. Please take or choose a smaller photo.",
          observations: [],
          fetchedAt,
        };
      }

      body.append("file", new Blob([bytes], { type: "image/jpeg" }), data.filename ?? "plant.jpg");
      body.append("mode", data.mode || "bioclip");
      body.append("lang", data.lang || "en");
      if (data.state) body.append("state", data.state.toLowerCase());
      if (data.crop) body.append("crop", data.crop);
    } catch {
      return {
        configured: true,
        ok: false,
        reason: "bad_response",
        detail: "image_unreadable",
        observations: [],
        fetchedAt,
      };
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/analyze`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body,
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      console.error("[plant] request failed", error);
      return {
        configured: true,
        ok: false,
        reason: "offline",
        detail: "Could not connect to plant intelligence service",
        observations: [],
        fetchedAt,
      };
    }

    const requestId = response.headers.get("x-request-id") ?? undefined;
    if (requestId) {
      console.info(`[plant] X-Request-ID: ${requestId} status: ${response.status}`);
    }

    const text = await response.text();
    if (isTunnelErrorBody(text)) {
      return {
        configured: true,
        ok: false,
        reason: "offline",
        status: response.status,
        detail: "tunnel_error_page",
        requestId,
        observations: [],
        fetchedAt,
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        configured: true,
        ok: false,
        reason: "bad_response",
        status: response.status,
        detail: "Service returned a non-JSON response",
        requestId,
        observations: [],
        fetchedAt,
      };
    }

    // Specific documented HTTP error code mappings
    if (!response.ok) {
      let detailMsg = parsed?.detail || parsed?.message;
      if (response.status === 413) {
        detailMsg =
          "Image exceeds maximum allowed size (12 MB / 40 MP). Please upload a smaller photo.";
      } else if (response.status === 415) {
        detailMsg = "Unsupported image format. Please upload JPEG, PNG, or WebP.";
      } else if (response.status === 422) {
        detailMsg = "Missing photo or incorrect form parameters.";
      } else if (response.status === 400) {
        detailMsg = "The uploaded file could not be recognized as a valid plant photo.";
      } else if (response.status === 429) {
        detailMsg = "Plant analysis rate limit reached. Please wait a moment before trying again.";
      } else if (response.status === 502) {
        detailMsg =
          "Plant intelligence upstream model is temporarily unavailable. Please try again shortly.";
      }

      return {
        configured: true,
        ok: false,
        reason: response.status >= 500 ? "offline" : "request_failed",
        status: response.status,
        detail: detailMsg || `Request failed with status ${response.status}`,
        requestId: requestId ?? parsed?.trace?.request_id ?? undefined,
        observations: [],
        fetchedAt,
        raw: text,
      };
    }

    const obj = (parsed ?? {}) as Record<string, any>;
    const traceObj = obj["trace"] as { request_id?: string } | undefined;
    const traceRequestId = requestId ?? traceObj?.request_id ?? undefined;
    const isDistress = Boolean(obj["distress"]);

    // Extract farmer_view following the confirmed contract
    let farmerView: FarmerView | undefined;
    if (obj["farmer_view"] && typeof obj["farmer_view"] === "object") {
      const fv = obj["farmer_view"];
      const nextStepObj =
        fv["next_step"] && typeof fv["next_step"] === "object" ? fv["next_step"] : undefined;
      farmerView = {
        lang: typeof fv.lang === "string" ? fv.lang : data.lang,
        headline: typeof fv.headline === "string" ? fv.headline : "",
        lines: Array.isArray(fv.lines)
          ? fv.lines.filter((l: any): l is string => typeof l === "string")
          : [],
        headline_from: typeof fv.headline_from === "string" ? fv.headline_from : undefined,
        not_a_health_check:
          typeof fv.not_a_health_check === "string"
            ? fv.not_a_health_check
            : "This only says which plant it looks like. It does not check for disease, pests or spots.",
        next_step: nextStepObj
          ? {
              text: typeof nextStepObj.text === "string" ? nextStepObj.text : "",
              phone: typeof nextStepObj.phone === "string" ? nextStepObj.phone : undefined,
            }
          : undefined,
      };
    }

    const species =
      pickString(obj, ["plant_species", "species", "plant", "crop"]) ||
      (obj["bioclip_species"]?.name_en ?? obj["bioclip_species"]?.name);
    const stage = pickString(obj, ["growth_stage", "stage"]);

    return {
      configured: true,
      ok: true,
      farmerView,
      distress: isDistress,
      requestId: traceRequestId,
      ...(species ? { species } : {}),
      ...(stage ? { stage } : {}),
      observations: flattenObservations(
        obj["observations"] ?? obj["analysis"] ?? obj["verdict"] ?? obj["bioclip_species"],
      ),
      raw: text,
      fetchedAt,
    };
  });

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

const SKIP_KEYS = new Set([
  "plant_species",
  "species",
  "growth_stage",
  "stage",
  "observations",
  "analysis",
  "farmer_view",
  "trace",
  "feedback",
]);

function flattenObservations(source: unknown, prefix = ""): PlantObservation[] {
  if (source === null || source === undefined) return [];
  if (Array.isArray(source)) {
    return source.flatMap((entry, index) =>
      typeof entry === "object" && entry !== null
        ? flattenObservations(entry, prefix)
        : [{ label: prefix || `#${index + 1}`, value: String(entry) }],
    );
  }
  if (typeof source !== "object") {
    return prefix ? [{ label: prefix, value: String(source) }] : [];
  }

  const out: PlantObservation[] = [];
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (!prefix && SKIP_KEYS.has(key)) continue;
    const label = prefix ? `${prefix} — ${humanize(key)}` : humanize(key);
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") out.push(...flattenObservations(value, label));
    else out.push({ label, value: String(value) });
  }
  return out.slice(0, 30);
}

function humanize(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
