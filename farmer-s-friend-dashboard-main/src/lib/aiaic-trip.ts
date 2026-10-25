import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { startDistrict, type TransportEstimate } from "@/lib/aiaic-trade";
import { getNearbyMandis, getTransportEstimate } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";
import { getPlacesDistricts } from "@/lib/places.functions";

export type Estate = "mh" | "mp";

/** AIAIC's two states by the words a page may hold ("mh", "mp", "Madhya Pradesh"). */
export function estateOf(state: string | null | undefined): Estate {
  const s = (state ?? "").toLowerCase();
  return s === "mp" || s.includes("madhya") ? "mp" : "mh";
}

/** A mandi's name by its letters only, without "APMC", to match a name an answer wrote to AIAIC's list. */
export function mandiKey(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/\bapmc\b/g, "")
    .replace(/[^a-z]/g, "");
}

/**
 * THE TRIP TO THE MANDI AN ANSWER NAMES (push 4: the answer at a glance), asked exactly as the transport card asks it
 * (the same query keys and the same request), so whichever is drawn first fills the other: her district as AIAIC's list
 * names it, the mandis near it (40 when a mandi is named), the named mandi when that list holds it, 10 quintals unless
 * given. `estimate` is null until AIAIC answers, and whenever the named mandi is not in the list: never another mandi's
 * trip under the named one.
 */
export function useMandiTrip({
  district: fromDistrict,
  state,
  toMandi,
  quantityQ,
}: {
  district: string | null | undefined;
  state?: string | null | undefined;
  toMandi: string | null | undefined;
  quantityQ?: number | undefined;
}): { mandi: string; estimate: TransportEstimate | null } {
  const { lang } = useI18n();
  const districtsFn = useServerFn(getPlacesDistricts);
  const nearbyFn = useServerFn(getNearbyMandis);
  const estimateFn = useServerFn(getTransportEstimate);
  const estate = estateOf(state);
  const districts = useQuery({
    queryKey: ["places-districts", estate, lang],
    queryFn: () => districtsFn({ data: { state: estate, lang } }),
    staleTime: 30 * 60_000,
    enabled: Boolean(fromDistrict && toMandi),
  });
  const list = districts.data?.ok ? districts.data.districts : [];
  const lower = (fromDistrict ?? "").toLowerCase();
  const district = !list.length
    ? ""
    : list.some((d) => d.key === lower)
      ? lower
      : startDistrict(list, [fromDistrict]);
  const nearbyLimit = toMandi ? 40 : 15;
  const nearby = useQuery({
    queryKey: ["aiaic-nearby", estate, district, nearbyLimit],
    queryFn: () => nearbyFn({ data: { district, state: estate, limit: nearbyLimit } }),
    enabled: Boolean(district && toMandi),
    staleTime: 30 * 60_000,
  });
  const mandis = nearby.data?.ok ? nearby.data.data.mandis : [];
  const key = mandiKey(toMandi);
  const mandiRow = key ? mandis.find((m) => mandiKey(m.mandi) === key) : undefined;
  const mandi = mandiRow?.mandi ?? "";
  const weight = quantityQ && quantityQ > 0 ? quantityQ : 10;
  const estimate = useQuery({
    queryKey: ["aiaic-transport", estate, district, mandi, weight],
    queryFn: () =>
      estimateFn({
        data: {
          mandi,
          quantity_q: weight,
          district,
          state: estate,
          mandi_state: estateOf(mandiRow?.state),
          ...(mandiRow?.district_key ? { mandi_district: mandiRow.district_key } : {}),
          from_place: "farm",
        },
      }),
    enabled: Boolean(district && mandi && weight > 0),
    staleTime: 30 * 60_000,
  });
  return { mandi, estimate: mandi && estimate.data?.ok ? estimate.data.data : null };
}
