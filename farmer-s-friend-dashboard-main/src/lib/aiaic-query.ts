import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getIntelligence } from "./aiaic.functions";
import { SERVICES, isService, type Service } from "./aiaic-types";

export const farmSearchSchema = z.object({
  region: z.string().optional(),
  crop: z.string().optional(),
  mandi: z.string().optional(),
  land: z.string().optional(),
  services: z.string().optional(),
  state: z.string().optional(),
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
