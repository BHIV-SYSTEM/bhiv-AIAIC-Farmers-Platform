import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { scanFirst } from "./aiaic-account.functions";
import { useRaiseCrisis } from "./aiaic-crisis";
import { plainNumber } from "./aiaic-heard";
import { farmSearchSchema, parseServices, type FarmSearch } from "./aiaic-query";
import { cropIn } from "./aiaic-storage";
import { problem } from "./aiaic-trade";
import { estateOf } from "./aiaic-trip";
import { sameName, type SavedFarm } from "./farm-storage";
import {
  getPlacesCrops,
  getPlacesDistricts,
  type CropItem,
  type DistrictItem,
} from "./places.functions";

/**
 * THE ADDRESS OF A FARM PAGE, READ ONCE, AT THE ROOT (the audit of 1 Nov 2026, F12; the platform's rule D-105: no box is blind to a
 * person in crisis). A link is a box anyone can type into. Crisis words in `/result?mandi=`, `?land=`, `/storage?state=`,
 * `/ask?crop=`, `?region=`, `?mandi=` raised no card: the pages printed them beside money cards, held them as a choice, and kept the
 * sentence on a phone a family may share. So no page reads the address for itself:
 * - every value of it, whatever its key, goes through AIAIC's scan first, once (`FarmGate`), and a crisis takes the page;
 * - nothing of a page mounts before that, so nothing is printed or saved on a crisis;
 * - what a page prints or saves is what the lists hold (`heldOfAddress`), never what was in the address.
 */

/** Every box of the address, from the schema itself, so a box added there is read here with no line added. */
export const ADDRESS_KEYS = Object.keys(farmSearchSchema.shape) as (keyof FarmSearch)[];

/** Every value of an address, one to a line: what AIAIC reads for distress. */
export function addressWords(search: FarmSearch): string {
  return ADDRESS_KEYS.map((k) => search[k]?.trim())
    .filter(Boolean)
    .join("\n");
}

/** How long a page waits on the scan. Past this it opens, and a crisis read later still takes it: a slow scan never blanks the app. */
export const ADDRESS_WAIT_MS = 4000;

/** The addresses already read clean in this tab: a move between pages of one farm asks nothing again. */
const readClean = new Set<string>();

type Lang = "en" | "mr" | "hi";

/** False while an address is being read for the first time. A crisis goes to the page's gate (`CrisisFirst`). */
export function useAddressHeard(search: FarmSearch, lang: Lang): boolean {
  const scanFn = useServerFn(scanFirst);
  const raise = useRaiseCrisis();
  const words = addressWords(search);
  const [opened, setOpened] = useState(() => !words || readClean.has(words));
  useEffect(() => {
    if (!words || readClean.has(words)) {
      setOpened(true);
      return undefined;
    }
    let current = true;
    setOpened(false);
    const late = setTimeout(() => {
      if (current) setOpened(true);
    }, ADDRESS_WAIT_MS);
    void scanFn({ data: { text: words.slice(0, 2000), lang } })
      .then((r) => {
        if (!r.ok && r.code === "crisis") {
          raise?.(problem("crisis", { crisis: r.crisis ?? null }));
          return;
        }
        readClean.add(words);
        if (current) setOpened(true);
      })
      .catch(() => {
        // The scan could not be asked: the page opens, and AIAIC reads what it is sent ahead of every route that answers it.
        if (current) setOpened(true);
      });
    return () => {
      current = false;
      clearTimeout(late);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);
  return opened;
}

/** The lists an address is held against. Null: not read, or not readable: then it holds nothing. */
export type AddressLists = {
  districts: readonly DistrictItem[] | null;
  crops: readonly CropItem[] | null;
  mandis: readonly string[] | null;
};

/** The values of an address the lists hold: the only values a page prints or saves. A plain number for the land, the two states. */
export function heldOfAddress(search: FarmSearch, lists: AddressLists): FarmSearch {
  const state = (search.state ?? "").trim().toLowerCase();
  const land = plainNumber(search.land ?? "");
  const region = lists.districts?.some(
    (d) => sameName(d.key, search.region) || sameName(d.name, search.region),
  );
  const crop = lists.crops && cropIn(lists.crops, search.crop);
  const mandi = lists.mandis?.some((m) => sameName(m, search.mandi));
  return {
    ...(region ? { region: search.region } : {}),
    ...(region && search.taluka ? { taluka: search.taluka } : {}),
    ...(crop ? { crop: search.crop } : {}),
    ...(mandi ? { mandi: search.mandi } : {}),
    ...(land !== null && land > 0 ? { land: String(land) } : {}),
    ...(state === "mh" || state === "mp" ? { state } : {}),
    services: parseServices(search.services).join(","),
  };
}

/** What a farm page may save of its address. */
export const farmToSave = (held: FarmSearch): SavedFarm => ({
  ...(held.region ? { region: held.region } : {}),
  ...(held.crop ? { crop: held.crop } : {}),
  ...(held.mandi ? { mandi: held.mandi } : {}),
  ...(held.land ? { land: held.land } : {}),
  ...(held.state ? { state: held.state } : {}),
  ...(held.services ? { services: held.services } : {}),
});

/**
 * An address's crop and district by the names the lists show, in the reader's language, and what of it the lists hold. Never the raw
 * key: "mataki • sangli" stood on a Marathi screen (F11). `subject`: the answer's own names, used where a list does not name it.
 * `settled`: every list it needs has been read, so `held` is final.
 */
export function useAddressNames(
  search: FarmSearch,
  lang: Lang,
  subject?: { crop?: string | undefined; place?: string | undefined } | undefined,
  mandis: readonly string[] | null = null,
) {
  const state = estateOf(search.state);
  const region = search.region?.trim() ?? "";
  const districtsRead = useQuery({
    queryKey: ["places-districts", state, lang],
    queryFn: () => getPlacesDistricts({ data: { state, lang } }),
    enabled: Boolean(region),
    staleTime: 5 * 60_000,
  });
  const cropsRead = useQuery({
    queryKey: ["places-crops", region, state, lang],
    queryFn: () => getPlacesCrops({ data: { district: region, state, lang } }),
    enabled: Boolean(region),
    staleTime: 5 * 60_000,
  });
  const districts = districtsRead.data?.ok ? districtsRead.data.districts : null;
  const crops = cropsRead.data?.ok ? cropsRead.data.crops : null;
  const held = heldOfAddress(search, { districts, crops, mandis });
  return {
    held,
    settled: !region || (!districtsRead.isPending && !cropsRead.isPending),
    crop: (held.crop && cropIn(crops ?? [], held.crop)?.name) || subject?.crop || "",
    district:
      (held.region &&
        districts?.find((d) => sameName(d.key, held.region) || sameName(d.name, held.region))
          ?.name) ||
      subject?.place ||
      "",
  };
}
