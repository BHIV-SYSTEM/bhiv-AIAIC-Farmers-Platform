import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getIntelligence } from "./aiaic.functions";
import { SERVICES, isService, type Service } from "./aiaic-types";

/**
 * A box of the address. The router reads `land=3` as a number, so a typed or shared link with a number in any box failed the whole
 * page ("This page didn't load"). A number stands as the text it was.
 */
const addressBox = z.preprocess(
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

  return queryOptions({
    queryKey: ["aiaic", services.join(","), region ?? "", crop ?? "", mandi ?? ""],
    queryFn: () =>
      getIntelligence({
        data: {
          services,
          ...(region ? { region } : {}),
          ...(crop ? { crop } : {}),
          ...(mandi ? { mandi } : {}),
          limit: 3,
        },
      }),
    staleTime: 60_000,
    retry: 0,
  });
}
