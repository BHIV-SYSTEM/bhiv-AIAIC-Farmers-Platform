import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  placeShown,
  startDistrict,
  type NearbyMandi,
  type TransportEstimate,
} from "@/lib/aiaic-trade";
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

/** What AIAIC sends with a mandi, in its nearby list and as a trip's `to`: its name, its state and its district. */
export type MandiOfAList = {
  mandi?: string | null | undefined;
  state?: string | null | undefined;
  district_key?: string | null | undefined;
};

/**
 * A MANDI OF AIAIC'S LIST BY WHO IT IS: its state, its district and its name (AIAIC 4ed3229, its C10's AIAIC-05: one
 * name can be two towns, each in its own district, as Ramnagar APMC is a village in Satna and a town in Maihar; AIAIC
 * tells them apart by `state` and `district_key`, and finds the one asked for by the `mandi_state` and `mandi_district`
 * sent with it). What a choice of the "To" list carries, what the map and the trip match on, and what the caches are
 * keyed by; never shown. A trip's `to` is matched the same way: AIAIC sends its state and district beside its name.
 */
export function mandiIdentity(m: MandiOfAList | null | undefined): string {
  return m?.mandi ? `${estateOf(m.state)}|${m.district_key ?? ""}|${m.mandi}` : "";
}

/** One choice of the "To" list: the entry it is, its value (the entry's identity) and its words. */
export type MandiChoice = { entry: NearbyMandi; value: string; label: string };

/**
 * THE "TO" LIST'S CHOICES, in AIAIC's order (nearest first), each by its identity and said in her language (AIAIC's
 * names, else its label). A name two entries share (two towns of one name, or two mandis said alike in her language)
 * says its district beside it, by the name the page holds for that district in her language (AIAIC's own district
 * list, `districts`), else by AIAIC's own key for it, never a name made up: she can tell the two apart, and each is a
 * choice of its own (the audit of 6 Nov 2026, F2: the two were one choice, and either pick asked the first one's trip).
 */
export function mandiChoices(
  mandis: readonly NearbyMandi[],
  lang: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  districts: readonly { key: string; name: string }[] = [],
): MandiChoice[] {
  const shown = mandis.map((m) => placeShown(m.names, lang, m.mandi));
  return mandis.map((entry, i) => {
    const said = shown[i] ?? entry.mandi;
    const twice = mandis.some((x, j) => j !== i && (x.mandi === entry.mandi || shown[j] === said));
    const key = entry.district_key ?? "";
    const district = districts.find((d) => d.key === key)?.name || key;
    return {
      entry,
      value: mandiIdentity(entry),
      label:
        twice && district
          ? t("aiaic.transport.mandi_in_district", { mandi: said, district })
          : said,
    };
  });
}

/** The entries of AIAIC's list an answer's mandi names (names compared by their letters, "APMC" left out): none, one,
 * or two towns of one name. */
export function namedEntries(
  mandis: readonly NearbyMandi[],
  toMandi: string | null | undefined,
): NearbyMandi[] {
  const key = mandiKey(toMandi);
  return key ? mandis.filter((m) => mandiKey(m.mandi) === key) : [];
}

/** The entry her trip is asked for: her own choice (a choice's value) while the list holds it, else the mandi an answer
 * named, else the first far enough to measure a trip to (5 km from her district's centre), else the first. */
export function chosenEntry(
  mandis: readonly NearbyMandi[],
  picked: string,
  named: NearbyMandi | null,
): NearbyMandi | null {
  return (
    (picked ? mandis.find((m) => mandiIdentity(m) === picked) : undefined) ??
    named ??
    mandis.find((m) => m.straight_km >= 5) ??
    mandis[0] ??
    null
  );
}

/** Where her trip starts and what it carries: her state, her district as AIAIC's list names it, her taluka, the weight. */
export type TripFrom = {
  estate: Estate;
  district: string;
  weight: number;
  taluka?: string | null | undefined;
};

/** How many mandis near her are asked for: more when an answer named a mandi, so that mandi is more likely held. */
export const nearbyLimitFor = (toMandi: string | null | undefined): number => (toMandi ? 40 : 15);

/**
 * THE QUERY KEYS the transport card and the answer at a glance both ask under, with the requests they send (the audit
 * of 6 Nov 2026, N7: their keys had differed, so the two never shared an answer): one trip, one key, whichever is drawn
 * first fills the other. A trip's key holds the mandi's identity: two towns of one name are two trips.
 */
export const nearbyQueryKey = (from: Omit<TripFrom, "weight">, limit: number) =>
  ["aiaic-nearby", from.estate, from.district, limit, from.taluka || null] as const;

export const nearbyAsk = (from: Omit<TripFrom, "weight">, limit: number) => ({
  district: from.district,
  state: from.estate,
  limit,
  ...(from.taluka ? { taluka: from.taluka } : {}),
});

export const tripQueryKey = (entry: NearbyMandi | null, from: TripFrom) =>
  [
    "aiaic-transport",
    from.estate,
    from.district,
    mandiIdentity(entry),
    from.weight,
    from.taluka || null,
  ] as const;

/** THE TRIP ASKED for an entry of AIAIC's list: its own name, state and district (AIAIC finds one of two towns of one
 * name by them), from her farm. */
export const tripAsk = (entry: NearbyMandi, from: TripFrom) => ({
  mandi: entry.mandi,
  quantity_q: from.weight,
  district: from.district,
  state: from.estate,
  mandi_state: estateOf(entry.state),
  ...(entry.district_key ? { mandi_district: entry.district_key } : {}),
  from_place: "farm" as const,
  ...(from.taluka ? { taluka: from.taluka } : {}),
});

/**
 * THE TRIP TO THE MANDI AN ANSWER NAMES (push 4: the answer at a glance), asked exactly as the transport card asks it
 * (the same query keys and the same requests: `nearbyQueryKey` and `nearbyAsk`, `tripQueryKey` and `tripAsk`), so
 * whichever is drawn first fills the other: her district as AIAIC's list names it, the mandis near it (40 when a mandi
 * is named), the named mandi when that list holds it ONCE, 10 quintals unless given. `estimate` is null until AIAIC
 * answers, whenever the named mandi is not in the list, and whenever the list holds its name twice (two towns of one
 * name, AIAIC 4ed3229: an answer names a mandi by its name alone, so which of the two it means is not known): never
 * another mandi's trip under the named one.
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
  const from: TripFrom = { estate, district, weight: quantityQ && quantityQ > 0 ? quantityQ : 10 };
  const limit = nearbyLimitFor(toMandi);
  const nearby = useQuery({
    queryKey: nearbyQueryKey(from, limit),
    queryFn: () => nearbyFn({ data: nearbyAsk(from, limit) }),
    enabled: Boolean(district && toMandi),
    staleTime: 30 * 60_000,
  });
  const mandis = nearby.data?.ok ? nearby.data.data.mandis : [];
  const named = namedEntries(mandis, toMandi);
  const entry = named.length === 1 ? (named[0] ?? null) : null;
  const estimate = useQuery({
    queryKey: tripQueryKey(entry, from),
    queryFn: () => estimateFn({ data: tripAsk(entry as NearbyMandi, from) }),
    enabled: Boolean(district && entry && from.weight > 0),
    staleTime: 30 * 60_000,
  });
  return {
    mandi: entry?.mandi ?? "",
    estimate: entry && estimate.data?.ok ? estimate.data.data : null,
  };
}
