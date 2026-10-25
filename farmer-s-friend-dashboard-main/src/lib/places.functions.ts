import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Schema definitions
const districtsQuerySchema = z.object({
  state: z.string().trim().default("mh"),
  lang: z.enum(["en", "mr", "hi"]).default("en"),
});

const cropsQuerySchema = z.object({
  district: z.string().trim().min(1),
  state: z.string().trim().default("mh"),
  lang: z.enum(["en", "mr", "hi"]).default("en"),
});

const resolvePlaceQuerySchema = z.object({
  text: z.string().trim().min(1),
  state: z.string().trim().default("mh"),
  lang: z.enum(["en", "mr", "hi"]).default("en"),
});

const priceSeriesQuerySchema = z.object({
  district: z.string().trim().min(1),
  crop: z.string().trim().min(1),
  state: z.string().trim().default("mh"),
  days: z.number().int().min(7).max(90).default(30),
  lang: z.enum(["en", "mr", "hi"]).default("en"),
});

const viewBriefQuerySchema = z.object({
  district: z.string().trim().min(1),
  crop: z.string().trim().min(1),
  state: z.string().trim().default("mh"),
  lang: z.enum(["en", "mr", "hi"]).default("en"),
});

export type DistrictItem = {
  key: string;
  name: string;
  name_en: string;
  translated: boolean;
};

export type CropItem = {
  crop: string;
  name: string;
  name_en: string;
  name_translated: boolean;
  first_page: boolean;
  grown_here: boolean;
  services?: Record<string, { available: boolean; na_reason_code?: string | null }>;
};

export type PricePoint = {
  day: string;
  median: number;
  low: number;
  high: number;
  mandis: number;
  quotes: number;
};

export type PriceSeriesResponse = {
  ok: boolean;
  district: string;
  crop_name: string;
  days: number;
  from: string;
  to: string;
  unit: string;
  available: boolean;
  reading?: string;
  band?: {
    month: number;
    years: string;
    p25: number;
    p50: number;
    p75: number;
    commodity: string;
  };
  band_note?: string;
  note?: string;
  newest_day?: string;
  points: PricePoint[];
  error?: string;
  /** AIAIC's HTTP status when it refused (a 404 is a crop the district's own list does not hold). */
  status?: number;
  /** Why no line is drawn (`available: false`), in her language, and its code. */
  reason?: string;
  reason_code?: string;
  /** Whose prices these are: the dataset and its publisher (AIAIC's `source`). */
  source?: { dataset?: string; publisher?: string; licence?: string };
  counts?: { days_with_prices?: number; days_asked?: number; mandis?: number; quotes?: number };
  newest_age_days?: number;
  /** The days the grade rule left out, said (so a newer day named elsewhere never contradicts the line). */
  left_out_note?: string;
};

/**
 * 1. GET /places/districts?state=mh|mp&lang=en|mr|hi
 */
export const getPlacesDistricts = createServerFn({ method: "GET" })
  .validator((params: unknown) => districtsQuerySchema.parse(params))
  .handler(
    async ({ data }): Promise<{ ok: boolean; districts: DistrictItem[]; error?: string }> => {
      const { resolveBaseUrl, aiaicHeaders } = await import("./aiaic-base.server");
      const { baseUrl } = resolveBaseUrl();

      const url = new URL(`${baseUrl}/places/districts`);
      url.searchParams.set("state", data.state.toLowerCase());
      url.searchParams.set("lang", data.lang);

      try {
        const res = await fetch(url.toString(), {
          headers: aiaicHeaders(),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return { ok: false, districts: [], error: `HTTP ${res.status}` };
        const json = await res.json();
        return { ok: true, districts: Array.isArray(json.districts) ? json.districts : [] };
      } catch (err: any) {
        console.error("[places] getDistricts error", err);
        return { ok: false, districts: [], error: err?.message };
      }
    },
  );

/**
 * 2. GET /places/crops?district=<key>&state=<state>&lang=<lang>
 */
export const getPlacesCrops = createServerFn({ method: "GET" })
  .validator((params: unknown) => cropsQuerySchema.parse(params))
  .handler(
    async ({
      data,
    }): Promise<{ ok: boolean; crops: CropItem[]; firstPage: string[]; error?: string }> => {
      const { resolveBaseUrl, aiaicHeaders } = await import("./aiaic-base.server");
      const { baseUrl } = resolveBaseUrl();

      const url = new URL(`${baseUrl}/places/crops`);
      url.searchParams.set("district", data.district.toLowerCase());
      url.searchParams.set("state", data.state.toLowerCase());
      url.searchParams.set("lang", data.lang);

      try {
        const res = await fetch(url.toString(), {
          headers: aiaicHeaders(),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return { ok: false, crops: [], firstPage: [], error: `HTTP ${res.status}` };
        const json = await res.json();
        return {
          ok: true,
          crops: Array.isArray(json.crops) ? json.crops : [],
          firstPage: Array.isArray(json.first_page) ? json.first_page : [],
        };
      } catch (err: any) {
        console.error("[places] getCrops error", err);
        return { ok: false, crops: [], firstPage: [], error: err?.message };
      }
    },
  );

/**
 * 3. GET /places/resolve?text=<text>&state=<state>&lang=<lang>
 */
export const resolvePlace = createServerFn({ method: "GET" })
  .validator((params: unknown) => resolvePlaceQuerySchema.parse(params))
  .handler(
    async ({ data }): Promise<{ ok: boolean; status?: string; place?: any; error?: string }> => {
      const { resolveBaseUrl, aiaicHeaders } = await import("./aiaic-base.server");
      const { baseUrl } = resolveBaseUrl();

      const url = new URL(`${baseUrl}/places/resolve`);
      url.searchParams.set("text", data.text);
      url.searchParams.set("state", data.state.toLowerCase());
      url.searchParams.set("lang", data.lang);

      try {
        const res = await fetch(url.toString(), {
          headers: aiaicHeaders(),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const json = await res.json();
        return { ok: true, status: json.status, place: json.place };
      } catch (err: any) {
        console.error("[places] resolvePlace error", err);
        return { ok: false, error: err?.message };
      }
    },
  );

/**
 * 4. GET /places/price-series?district=<district>&crop=<crop>&state=<state>&days=<7-90>&lang=<lang>
 */
export const getPriceSeries = createServerFn({ method: "GET" })
  .validator((params: unknown) => priceSeriesQuerySchema.parse(params))
  .handler(async ({ data }): Promise<PriceSeriesResponse> => {
    const { resolveBaseUrl, aiaicHeaders } = await import("./aiaic-base.server");
    const { baseUrl } = resolveBaseUrl();

    const url = new URL(`${baseUrl}/places/price-series`);
    url.searchParams.set("district", data.district.toLowerCase());
    url.searchParams.set("crop", data.crop.toLowerCase());
    url.searchParams.set("state", data.state.toLowerCase());
    url.searchParams.set("days", String(data.days));
    url.searchParams.set("lang", data.lang);

    try {
      const res = await fetch(url.toString(), {
        headers: aiaicHeaders(),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return {
          ok: false,
          district: data.district,
          crop_name: data.crop,
          days: data.days,
          from: "",
          to: "",
          unit: "INR/q",
          available: false,
          points: [],
          error: `HTTP ${res.status}`,
          status: res.status,
        };
      }
      const json = await res.json();
      return {
        ok: true,
        district: json.district ?? data.district,
        crop_name: json.crop_name ?? data.crop,
        days: json.days ?? data.days,
        from: json.from ?? "",
        to: json.to ?? "",
        unit: json.unit ?? "INR/q",
        available: Boolean(json.available),
        reading: json.reading,
        band: json.band,
        band_note: json.band_note,
        note: json.note,
        newest_day: json.newest_day,
        points: Array.isArray(json.points) ? json.points : [],
        reason: json.reason,
        reason_code: json.reason_code,
        source: json.source,
        counts: json.counts,
        newest_age_days: json.newest_age_days,
        left_out_note: json.left_out_note,
      };
    } catch (err: any) {
      console.error("[places] getPriceSeries error", err);
      return {
        ok: false,
        district: data.district,
        crop_name: data.crop,
        days: data.days,
        from: "",
        to: "",
        unit: "INR/q",
        available: false,
        points: [],
        error: err?.message,
      };
    }
  });

/**
 * 5. GET /view/brief?district=<district>&crop=<crop>&state=<state>&lang=<lang>
 */
export const getViewBrief = createServerFn({ method: "GET" })
  .validator((params: unknown) => viewBriefQuerySchema.parse(params))
  .handler(async ({ data }): Promise<{ ok: boolean; brief?: any; error?: string }> => {
    const { resolveBaseUrl, aiaicHeaders } = await import("./aiaic-base.server");
    const { baseUrl } = resolveBaseUrl();

    const url = new URL(`${baseUrl}/view/brief`);
    url.searchParams.set("district", data.district.toLowerCase());
    url.searchParams.set("crop", data.crop.toLowerCase());
    url.searchParams.set("state", data.state.toLowerCase());
    url.searchParams.set("lang", data.lang);

    try {
      const res = await fetch(url.toString(), {
        headers: aiaicHeaders(),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = await res.json();
      return { ok: true, brief: json };
    } catch (err: any) {
      console.error("[view] getViewBrief error", err);
      return { ok: false, error: err?.message };
    }
  });
