import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { MapPlace } from "@/components/farm/aiaic/route-map";
import type { StorageVerdict, StorageWarehouse } from "@/lib/aiaic-trade";
import { getStorageVerdict } from "@/lib/aiaic-trade.functions";
import { estateOf } from "@/lib/aiaic-trip";
import { useI18n } from "@/lib/i18n";

/** How far a warehouse is: the verdict's own km, else its trip's distance. */
export const away = (w: StorageWarehouse | null | undefined): number | null =>
  w?.km ?? w?.trip?.distance?.km ?? null;

/** The same warehouse (by operator and name). */
export const sameWarehouse = (a: StorageWarehouse, b: StorageWarehouse | null | undefined) =>
  !!b && a.operator === b.operator && a.name === b.name;

/** The assumptions that decide a verdict, said in plain view under it (push 4); every other one is behind the tap. */
export const KEY_ASSUMED = ["loss_assumed", "quantity_example"];

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
