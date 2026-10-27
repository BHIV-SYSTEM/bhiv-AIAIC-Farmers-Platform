import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type {
  AiaicPricing,
  AiaicProblem,
  AiaicResult,
  BuyersLooking,
  MineForScreen,
  TradeMode,
} from "./aiaic-trade";
import {
  getAiaicPricing,
  getBuyersLooking,
  getMyTrade,
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

/** Her AIAIC sale records (GET /farmer/trade through this server), with names in her language. */
export function useMine(enabled = true) {
  const { lang } = useI18n();
  const fn = useServerFn(getMyTrade);
  return useQuery<AiaicResult<MineForScreen>>({
    queryKey: ["aiaic-mine", lang],
    queryFn: () => fn({ data: { lang } }),
    enabled,
    staleTime: 10_000,
  });
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
