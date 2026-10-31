/**
 * Small localStorage helpers. All of these are browser-only and must be called
 * from an effect or an event handler, never during render or SSR.
 */
import type { ServiceResult } from "./aiaic-types";

const FARM_KEY = "aiaic.farm";
const CACHE_PREFIX = "aiaic.cache.";
const FEEDBACK_KEY = "aiaic.feedback";

export type SavedFarm = {
  region?: string;
  crop?: string;
  mandi?: string;
  land?: string;
  services?: string;
  state?: string;
  /** The taluka, and the district it is a taluka of: used only while that district is still this farm's. */
  taluka?: string;
  talukaOf?: string;
  /** The quintals the storage page last used, as text; "example" when the step was skipped. */
  storeQuantity?: string;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadFarm(): SavedFarm | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(FARM_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as SavedFarm;
  } catch {
    return null;
  }
}

/** Two names of one district, whatever their case. */
export const sameName = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * What a save leaves as it was. Every page saves the whole farm as it knows it, and only the storage page knows the taluka
 * and the quantity, so those stay unless a save names them; and the state stays with its own district, so a link that
 * names no state never turns a Madhya Pradesh farm into a Maharashtra one.
 */
export function farmKept(before: SavedFarm | null, farm: SavedFarm): SavedFarm {
  if (!before) return farm;
  const { taluka, talukaOf, storeQuantity, state } = before;
  return {
    ...(taluka ? { taluka } : {}),
    ...(talukaOf ? { talukaOf } : {}),
    ...(storeQuantity ? { storeQuantity } : {}),
    ...(state && sameName(before.region, farm.region) ? { state } : {}),
    ...farm,
  };
}

export function saveFarm(farm: SavedFarm): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(FARM_KEY, JSON.stringify(farmKept(loadFarm(), farm)));
  } catch {
    /* storage full or blocked — the app still works, just without memory */
  }
}

export function clearFarm(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(FARM_KEY);
  } catch {
    /* ignore */
  }
}

export type CachedAdvice = { savedAt: string; results: ServiceResult[] };

export function loadCachedAdvice(key: string): CachedAdvice | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as CachedAdvice).results) ||
      typeof (parsed as CachedAdvice).savedAt !== "string"
    ) {
      return null;
    }
    return parsed as CachedAdvice;
  } catch {
    return null;
  }
}

export function saveCachedAdvice(key: string, results: ServiceResult[]): void {
  if (!canUseStorage()) return;
  // Only worth keeping if at least one service actually answered.
  if (!results.some((r) => r.ok && r.items.length > 0)) return;
  try {
    const payload: CachedAdvice = { savedAt: new Date().toISOString(), results };
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export type FeedbackEntry = {
  at: string;
  service: string;
  decisionId?: string;
  useful: boolean;
};

export function saveFeedback(entry: FeedbackEntry): void {
  if (!canUseStorage()) return;
  try {
    const raw = window.localStorage.getItem(FEEDBACK_KEY);
    const list: FeedbackEntry[] = raw ? (JSON.parse(raw) as FeedbackEntry[]) : [];
    list.push(entry);
    window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* ignore */
  }
}

export function loadFeedback(): FeedbackEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(FEEDBACK_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

const PLANT_KEY = "aiaic.plant";

/** Last photo-check result, kept so the expert review page can show it too. */
export function savePlantResult(result: unknown): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(PLANT_KEY, JSON.stringify(result));
  } catch {
    /* ignore */
  }
}

export function loadPlantResult<T>(): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(PLANT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
