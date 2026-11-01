import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleHelp, IndianRupee, Warehouse } from "lucide-react";

import type { MapPlace } from "@/components/farm/aiaic/route-map";
import type { FarmSearch } from "@/lib/aiaic-query";
import type {
  AiaicProblem,
  AiaicResult,
  StoragePlan,
  StorageVerdict,
  StorageWarehouse,
} from "@/lib/aiaic-trade";
import { plainNumber } from "@/lib/aiaic-heard";
import { getStoragePlan, getStorageVerdict } from "@/lib/aiaic-trade.functions";
import { estateOf, type Estate } from "@/lib/aiaic-trip";
import { sameName, type SavedFarm } from "@/lib/farm-storage";
import { useI18n } from "@/lib/i18n";
import type { CropItem } from "@/lib/places.functions";

/** How far a warehouse is: the verdict's own km, else its trip's distance. */
export const away = (w: StorageWarehouse | null | undefined): number | null =>
  w?.km ?? w?.trip?.distance?.km ?? null;

/** The same warehouse (by operator and name). */
export const sameWarehouse = (a: StorageWarehouse, b: StorageWarehouse | null | undefined) =>
  !!b && a.operator === b.operator && a.name === b.name;

/** The verdict's mark by its code: a code this app does not know is marked as "not sure" would be. */
export const verdictMark = (code: string | null | undefined) =>
  code === "store" ? Warehouse : code === "sell_now" ? IndianRupee : CircleHelp;

/** The assumptions that decide a verdict, said in plain view under it (push 4); every other one is behind the tap. */
export const KEY_ASSUMED = ["loss_assumed", "quantity_example"];

/**
 * What a verdict's reader sees without a tap: the two above, and, under a store verdict, that no loan was asked about (the audit of
 * 1 Nov 2026, F9: a farmer whose loan falls due in two weeks read "Store 4 months" with no word of it above the fold).
 */
export const keyAssumed = (v: Pick<StorageVerdict["verdict"], "code" | "assumptions">) =>
  (v.assumptions ?? []).filter(
    (a) =>
      a.text &&
      (KEY_ASSUMED.includes(a.code) || (v.code === "store" && a.code === "no_loan_asked")),
  );

/** A map's places from a storage verdict: each listed warehouse that has a point, the one the verdict names `chosen`. */
export function warehousePlaces(card: StorageVerdict): MapPlace[] {
  const named = card.verdict.warehouse;
  return card.warehouses
    .filter((w) => w.point && w.point.lat != null && w.point.lon != null)
    .map((w) => ({
      lat: w.point?.lat,
      lon: w.point?.lon,
      label: `${w.place_shown || w.name_shown || w.name} · ${w.operator_shown || w.operator}`,
      kind: sameWarehouse(w, named) ? ("chosen" as const) : ("warehouse" as const),
    }));
}

/**
 * AIAIC's storage verdict for her crop and district (GET /storage/verdict), read once and shared by every part of a
 * page that shows it (the card, the answer at a glance): the same query key, so one request. `null` until AIAIC
 * answers, and on any refusal (an AIAIC server without the route included).
 */
export function useStorageVerdict({
  crop,
  district,
  state,
  quantityQ,
  taluka,
}: {
  crop: string | null | undefined;
  district: string | null | undefined;
  state?: string | null | undefined;
  quantityQ?: number | undefined;
  /** Her taluka (28 Oct 2026): the warehouses' trips start at its main town; the verdict stays the district's. */
  taluka?: string | null | undefined;
}): StorageVerdict | null {
  const { lang } = useI18n();
  const verdictFn = useServerFn(getStorageVerdict);
  const estate = estateOf(state);
  const q = useQuery({
    queryKey: [
      "aiaic-storage-verdict",
      estate,
      district,
      crop,
      quantityQ ?? null,
      lang,
      taluka ?? null,
    ],
    queryFn: () =>
      verdictFn({
        data: {
          crop: crop ?? "",
          district: district ?? "",
          state: estate,
          lang,
          ...(quantityQ && quantityQ > 0 ? { quantity_q: quantityQ } : {}),
          ...(taluka ? { taluka } : {}),
        },
      }),
    enabled: Boolean(crop && district),
    staleTime: 30 * 60_000,
    retry: 0,
  });
  return q.data?.ok ? q.data.data : null;
}

// ----------------------------------------------------------------- 31 Oct 2026: the storage page, step by step

/** The storage page's steps: 1 where, 2 crop, 3 how much, 4 the answer. */
export type StoreStep = 1 | 2 | 3 | 4;
/** The quantity of a step skipped: AIAIC prices its labelled example of 10 quintals, and says so. */
export const EXAMPLE = "example";
export type StoreQuantity = number | typeof EXAMPLE;
export const QUANTITY_CHIPS = [10, 25, 50, 100] as const;
/** The most AIAIC reads (`quantity_out_of_range`, contract section 21). */
export const MAX_QUANTITY_Q = 100_000;

export const quantityFits = (q: unknown): q is number =>
  typeof q === "number" && Number.isFinite(q) && q > 0 && q <= MAX_QUANTITY_Q;

/**
 * What the "Other" box holds, read from a copy: the box keeps what was typed. `words`: anything but a plain number, which AIAIC
 * reads for distress before anything else is said (the platform's rule D-105: no box is blind to a person in crisis); the page
 * then asks for the number of quintals.
 */
export function quantityTyped(typed: string): { q: number | null; fits: boolean; words: boolean } {
  const q = plainNumber(typed);
  return { q, fits: quantityFits(q), words: typed.trim() !== "" && q === null };
}

/** What the page has been told so far: `region` is the district's key, `taluka` empty for the whole district. */
export type StoreChoice = {
  state: Estate;
  region: string;
  taluka: string;
  crop: string;
  quantity: StoreQuantity | null;
};

function quantityKept(saved: SavedFarm | null): StoreQuantity | null {
  const kept = saved?.storeQuantity;
  if (kept === EXAMPLE) return EXAMPLE;
  const q = kept ? Number(kept) : null;
  return quantityFits(q) ? q : null;
}

/**
 * What the page starts from: a link's own words first, then the saved farm, so a returning farmer lands on the answer. What
 * was saved for one district is not carried to another: a link to a new district takes no crop or taluka from the old one.
 * A place and crop known with no quantity kept use AIAIC's labelled example, one tap from a real quantity.
 */
export function choiceFrom(search: FarmSearch, saved: SavedFarm | null): StoreChoice {
  const region = search.region?.trim() || saved?.region?.trim() || "";
  const own = region && sameName(region, saved?.region) ? saved : null;
  const crop = search.crop?.trim() || own?.crop?.trim() || "";
  const talukaKept = own && sameName(own.talukaOf, region) ? own.taluka?.trim() : "";
  return {
    state: estateOf(search.state || saved?.state),
    region,
    taluka: search.taluka?.trim() || talukaKept || "",
    crop,
    quantity: quantityKept(saved) ?? (region && crop ? EXAMPLE : null),
  };
}

/** The first step not yet answered: the answer itself once all three are known. */
export const firstToDo = (c: StoreChoice): StoreStep =>
  !c.region ? 1 : !c.crop ? 2 : c.quantity === null ? 3 : 4;

/** The saved farm with what the page was told. A mandi belongs to its district, so it goes when the district changes. */
export function farmWith(saved: SavedFarm | null, c: StoreChoice): SavedFarm {
  const { mandi, ...rest } = saved ?? {};
  return {
    ...rest,
    ...(mandi && sameName(saved?.region, c.region) ? { mandi } : {}),
    state: c.state,
    region: c.region,
    crop: c.crop,
    taluka: c.taluka,
    talukaOf: c.taluka ? c.region : "",
    storeQuantity: c.quantity === null ? "" : String(c.quantity),
  };
}

/** The page's address: the same place and crop, so a reload or the Back button finds what is on the screen. */
export function searchOf(c: StoreChoice): FarmSearch {
  return {
    state: c.state,
    ...(c.region ? { region: c.region } : {}),
    ...(c.region && c.taluka ? { taluka: c.taluka } : {}),
    ...(c.crop ? { crop: c.crop } : {}),
  };
}

/** The crop of the district's list a saved or linked name means: by AIAIC's label, or by its plain English name. */
export const cropIn = (crops: readonly CropItem[], name: string | null | undefined) =>
  crops.find((c) => sameName(c.crop, name) || sameName(c.name_en, name)) ?? null;

/**
 * False for a crop the district's own list does not offer (a change of district, or a crop saved long ago): it is not asked
 * about, and step 2 opens. A list that is empty or could not be read decides nothing: AIAIC reads the crop itself.
 */
export const cropStands = (crops: readonly CropItem[], name: string) =>
  !name || crops.length === 0 || cropIn(crops, name) !== null;

/** How many crops a district's step shows before "More crops". */
export const CROPS_FIRST = 12;

/**
 * The crops the step offers: the district's own first page in AIAIC's order (`firstPage`: an official record of being grown
 * there, most widely traded first), then the other crops held. AIAIC's first page runs to 55 crops in Nashik, so the first
 * twelve are buttons and the rest wait behind "More crops". A product named twice under two labels is offered once, and a
 * crop already chosen stays in view.
 */
export function cropsOffered(
  crops: readonly CropItem[],
  firstPage: readonly string[],
  chosen: string,
): { first: CropItem[]; more: CropItem[] } {
  const grown = firstPage.flatMap((label) => crops.filter((c) => c.crop === label));
  const listed = new Set(grown.map((c) => c.name_en || c.name));
  const others = crops.filter((c) => {
    const product = c.name_en || c.name;
    if (firstPage.includes(c.crop) || c.first_page_shown_as || listed.has(product)) return false;
    listed.add(product);
    return true;
  });
  const all = [...grown, ...others];
  const first = all.slice(0, CROPS_FIRST);
  const more = all.slice(CROPS_FIRST);
  const held = cropIn(more, chosen);
  return held ? { first: [...first, held], more: more.filter((c) => c !== held) } : { first, more };
}

/** True when the answer holds something to show: a failure of its shape is said, never drawn as an empty page. */
export const planHolds = (plan: StoragePlan | null | undefined): plan is StoragePlan =>
  Array.isArray(plan?.indicators) && plan.indicators.length > 0;

export type PlanShown =
  | { show: "loading" }
  | { show: "failed"; problem: AiaicProblem | null }
  | { show: "empty" }
  | { show: "answer"; plan: StoragePlan };

/** What the page shows from its read of the plan: never a blank. `problem` null: this app's own server could not be read. */
export function planShown(read: {
  data: AiaicResult<StoragePlan> | undefined;
  isError: boolean;
}): PlanShown {
  if (!read.data) return read.isError ? { show: "failed", problem: null } : { show: "loading" };
  if (!read.data.ok) return { show: "failed", problem: read.data.problem };
  return planHolds(read.data.data) ? { show: "answer", plan: read.data.data } : { show: "empty" };
}

/**
 * AIAIC's storage plan for the crop and district (GET /storage/plan). The whole read is returned, unlike the verdict's: the
 * page says a failure in words and offers Try again. `quantity` EXAMPLE sends none, so AIAIC prices and labels its example.
 */
export function useStoragePlan({
  crop,
  district,
  state,
  quantity,
  taluka,
  loanDueInDays,
  enabled = true,
}: {
  crop: string;
  district: string;
  state: string;
  quantity: StoreQuantity | null;
  taluka?: string | undefined;
  /** What the farmer said of a loan on the answer's own question: used for this read only, never saved. */
  loanDueInDays?: number | null | undefined;
  enabled?: boolean | undefined;
}) {
  const { lang } = useI18n();
  const planFn = useServerFn(getStoragePlan);
  const estate = estateOf(state);
  const quantityQ = typeof quantity === "number" ? quantity : undefined;
  return useQuery({
    queryKey: [
      "aiaic-storage-plan",
      estate,
      district,
      crop,
      quantityQ ?? null,
      lang,
      taluka || null,
      loanDueInDays ?? null,
    ],
    queryFn: () =>
      planFn({
        data: {
          crop,
          district,
          state: estate,
          lang,
          ...(quantityQ ? { quantity_q: quantityQ } : {}),
          ...(taluka ? { taluka } : {}),
          ...(loanDueInDays ? { loan_due_in_days: loanDueInDays } : {}),
        },
      }),
    enabled: enabled && Boolean(crop && district),
    staleTime: 10 * 60_000,
    retry: 0,
  });
}
