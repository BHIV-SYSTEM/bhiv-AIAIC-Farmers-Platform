import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getIntelligence } from "./aiaic.functions";
import { estateOf } from "./aiaic-trip";
import { SERVICES, isService, type Service } from "./aiaic-types";

/**
 * A box of the address. The router reads `land=3` as a number, so a typed or shared link with a number in any box failed the whole
 * page ("This page didn't load"). A number stands as the text it was.
 */
export const addressBox = z.preprocess(
  (v) => (typeof v === "number" ? String(v) : v),
  z.string().optional(),
);

export const farmSearchSchema = z.object({
  region: addressBox,
  taluka: addressBox,
  crop: addressBox,
  mandi: addressBox,
  land: addressBox,
  services: addressBox,
  state: addressBox,
});

export type FarmSearch = z.infer<typeof farmSearchSchema>;

export function parseServices(value: string | undefined): Service[] {
  const list = (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(isService);
  return list.length ? Array.from(new Set(list)) : [...SERVICES];
}

export function intelligenceQueryOptions(search: FarmSearch) {
  const services = parseServices(search.services);
  const region = search.region?.trim() || undefined;
  const crop = search.crop?.trim() || undefined;
  const mandi = search.mandi?.trim() || undefined;
  // THE STATE GOES WITH THE PLACE (the audit of 1 Nov 2026, F35): with none, AIAIC reads Maharashtra, and every Madhya Pradesh farmer read
  // "no data" on `/advice/*`, the storage page's own fallback, for pairs AIAIC answers. 2,594 of 4,282 list pairs.
  const state = estateOf(search.state);

  return queryOptions({
    queryKey: ["aiaic", services.join(","), region ?? "", crop ?? "", mandi ?? "", state],
    queryFn: () =>
      getIntelligence({
        data: {
          services,
          ...(region ? { region } : {}),
          ...(crop ? { crop } : {}),
          ...(mandi ? { mandi } : {}),
          state,
          limit: 3,
        },
      }),
    staleTime: 60_000,
    retry: 0,
  });
}
