import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type {
  AiaicPricing,
  AiaicProblem,
  AiaicResult,
  BuyersLooking,
  MinePace,
  MineForScreen,
  TradeMode,
} from "./aiaic-trade";
import { mineReadEvery } from "./aiaic-trade";
import type { Notice } from "./aiaic-account";
import { getMyNotices } from "./aiaic-account.functions";
import { useMe } from "./aiaic-me";
import { estateOf } from "./aiaic-analysis";
import {
  getAiaicPricing,
  getBuyersLooking,
  getMyTrade,
  getSalePrice,
  getTradeMode,
} from "./aiaic-trade.functions";
import { useI18n } from "./i18n";

/** AIAIC's commission as its server holds it now (public GET /payments/pricing through this server). */
export function useAiaicPricing() {
  const fn = useServerFn(getAiaicPricing);
  return useQuery<AiaicResult<AiaicPricing>>({
    queryKey: ["aiaic-pricing"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Where this app's sales live (from the server's settings): AIAIC, or the app's own demo store. */
export function useTradeMode() {
  const fn = useServerFn(getTradeMode);
  return useQuery<TradeMode>({
    queryKey: ["aiaic-trade-mode"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
}

/** The farmer's AIAIC sale records (GET /farmer/trade through this server), with names in their language, read again
 * at the page's pace (`MinePace`). */
export function useMine(enabled = true, pace: MinePace = "live") {
  const { lang } = useI18n();
  const fn = useServerFn(getMyTrade);
  return useQuery<AiaicResult<MineForScreen>>({
    queryKey: ["aiaic-mine", lang],
    queryFn: () => fn({ data: { lang } }),
    enabled,
    staleTime: 10_000,
    // THE FARMER'S SALE, READ AGAIN BY ITSELF (28 Oct 2026; the owner: "the farmer is also having the updates ...
    // instant updates"; the payment buttons: "instant updation in the app ... with regards to every transaction"), at
    // the page's pace (`mineReadEvery`): every 5 seconds only on the order page while AIAIC's send of their money moves,
    // never under the sell form (R5P-09); and when the farmer comes back to the page
    refetchInterval: (query) => mineReadEvery(pace, query.state.data),
    refetchOnWindowFocus: true,
  });
}

/**
 * HER NOTICES FROM AIAIC (GET /notifications through this server), read only while AIAIC knows who she is (signed in):
 * the news strip shows the unread ones on every page, and her offer's step bar reads the same answer for "more time
 * given". Read again every 30 s and when she comes back to the page (`staleTime` 15 s: a quick return asks nothing).
 */
export function useMyNotices() {
  const { lang } = useI18n();
  const me = useMe();
  const fn = useServerFn(getMyNotices);
  return useQuery<Notice[]>({
    // the language is part of the read: a notice names its crop in the reader's language (R5P-10)
    queryKey: ["aiaic-notices", lang],
    queryFn: () => fn({ data: { lang } }),
    enabled: Boolean(me.data?.signedIn),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 0,
  });
}

/** The reads that belong to ONE person: their sale, their notices, their help questions, the buyers near them, an
 * offer of theirs weighed. */
export const PERSONAL_READS = [
  "aiaic-mine",
  "aiaic-notices",
  "aiaic-buyers-looking",
  "aiaic-help",
  "aiaic-offer-compare",
] as const;

/** Who is signed in changed (signed in, signed out, account erased): one person's reads are dropped, so the next person
 * on this phone is never shown them, not even while their own are read (a page keeps its last records on a failed read
 * again: `mineShown`). */
export function forgetPersonalReads(qc: QueryClient): void {
  for (const key of PERSONAL_READS) qc.removeQueries({ queryKey: [key] });
}

/** Buyers looking for produce near her (AIAIC section 25, 27 Oct 2026). */
export function useBuyersLooking(enabled = true) {
  const { lang } = useI18n();
  const fn = useServerFn(getBuyersLooking);
  return useQuery<AiaicResult<BuyersLooking>>({
    queryKey: ["aiaic-buyers-looking", lang],
    queryFn: () => fn({ data: { lang } }),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * HER DISTRICT'S MANDI PRICES AS AIAIC HOLDS THEM NOW (GET /farmer/trade/price through this server; the sell form's
 * own question and cache): a group sale's offer and sale show them beside the buyer's price, so she compares before
 * she says yes. `mandi` is null while they are read (`reading`) and when AIAIC holds none recent enough.
 */
export function useDistrictPrice(
  place: { state?: string | null | undefined; district?: string | null | undefined },
  crop: string,
  enabled = true,
) {
  const fn = useServerFn(getSalePrice);
  const estate = estateOf(place.state);
  const district = place.district ?? "";
  const read = useQuery({
    queryKey: ["aiaic-sale-price", estate, district, crop],
    queryFn: () => fn({ data: { crop, state: estate, district } }),
    enabled: enabled && Boolean(district && crop),
    staleTime: 10 * 60_000,
  });
  const got = read.data?.ok ? read.data.data : null;
  return {
    mandi: got && got.held ? got : null,
    reading: read.isFetching && !got,
  };
}

/** One sentence for a problem, in her language: this app's own words for its codes and AIAIC's, else the code. */
export function useProblemText() {
  const { t } = useI18n();
  return (p: AiaicProblem): string => {
    const field = typeof p.facts?.["field"] === "string" ? String(p.facts["field"]) : "";
    const vars = {
      setting: p.setting ?? "",
      code: p.code,
      field: field ? t(`aiaic.field.${field}`) : "",
    };
    for (const key of [`aiaic.problem.${p.code}`, `aiaic.refused.${p.code}`]) {
      const said = t(key, vars);
      if (said !== key) return said;
    }
    return t("aiaic.problem.other", vars);
  };
}
