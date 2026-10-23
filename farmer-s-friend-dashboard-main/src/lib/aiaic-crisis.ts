import { createContext, useCallback, useContext } from "react";

import { pressAndRaise, type AiaicProblem, type AiaicResult } from "./aiaic-trade";

/**
 * THE CRISIS CARD OUTRANKS EVERYTHING ON THE PAGE. AIAIC reads every typed box for distress first and answers with its
 * helplines instead. Every AIAIC page sits inside one gate (`CrisisFirst`, put there by `TradeSwitch`): a press AIAIC
 * answers with its crisis card raises it to that gate, and the page then shows the crisis card alone (no sale, total,
 * payment line or form beside it).
 */
export const RaiseCrisis = createContext<((crisis: AiaicProblem) => void) | null>(null);

/** The page's gate (null outside one). */
export function useRaiseCrisis(): ((crisis: AiaicProblem) => void) | null {
  return useContext(RaiseCrisis);
}

/** One press of an AIAIC screen: never left hanging (`pressed`), and AIAIC's crisis card raised to the page. */
export function usePress() {
  const raise = useContext(RaiseCrisis);
  return useCallback(
    <T>(run: () => Promise<AiaicResult<T>>): Promise<AiaicResult<T>> => pressAndRaise(run, raise),
    [raise],
  );
}
