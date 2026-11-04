import { useServerFn } from "@tanstack/react-start";
import { useReducer } from "react";

import type { AccountOutcome, Crisis } from "./aiaic-account";
import { scanFirst } from "./aiaic-account.functions";
import { problem, type AiaicProblem } from "./aiaic-trade";

type Lang = "en" | "mr" | "hi";

/** The scan as a page asks it (`scanFirst`: AIAIC's `/safety/check`, which keeps nothing). */
export type AskTheScan = (q: { data: { text: string; lang: Lang } }) => Promise<AccountOutcome>;

/**
 * The scan's own order, with no React in it (the hook below runs it, and the tests run it as it is): what she typed goes
 * to the scan first; a crisis goes to `crisis` and nothing else is said; otherwise, or when the scan cannot be asked,
 * the refusal is said.
 */
export async function scanThenRefuse(
  ask: AskTheScan,
  words: string,
  lang: Lang,
  refusal: string,
  on: { crisis: (crisis: Crisis | null) => void; say: (code: string) => void },
): Promise<void> {
  if (words.trim()) {
    try {
      const r = await ask({ data: { text: words.slice(0, 2000), lang } });
      if (!r.ok && r.code === "crisis") {
        on.crisis(r.crisis ?? null);
        return;
      }
    } catch {
      /* the scan could not be asked: the refusal below is still said */
    }
  }
  on.say(refusal);
}

/**
 * A FORM'S SCAN AS STATE, WITH NO REACT IN IT (the re-check of 4 Nov 2026, RC-1: the crisis card of every form that uses
 * the hook below hangs on this state, so the tests hold this very state): `inCrisis` once AIAIC read her words as a
 * crisis (`crisis`: its card, with the helplines), `scanning` while the scan is asked. The hook keeps it with React's
 * `useReducer`; nothing else changes it.
 */
export type ScanState = { inCrisis: boolean; crisis: Crisis | null; scanning: boolean };
export type ScanEvent =
  | { type: "asking" }
  | { type: "asked" }
  | { type: "crisis"; crisis: Crisis | null }
  | { type: "reset" };
export const SCAN_START: ScanState = { inCrisis: false, crisis: null, scanning: false };

/** How each event changes a form's scan; a state that does not change stays the same object (no render for nothing). */
export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case "asking":
      return state.scanning ? state : { ...state, scanning: true };
    case "asked":
      return state.scanning ? { ...state, scanning: false } : state;
    case "crisis":
      return { ...state, inCrisis: true, crisis: event.crisis };
    case "reset":
      return state.inCrisis || state.crisis ? { ...state, inCrisis: false, crisis: null } : state;
  }
}

/** What a form is handed by the hook: its scan's state, `refuse` and `reset`. */
export type FormScan = ScanState & {
  /** Her words to the scan first: a crisis raises `inCrisis` and nothing else is said; otherwise `say(refusal)`. */
  refuse: (
    words: string,
    lang: Lang,
    refusal: string,
    say: (code: string) => void,
  ) => Promise<void>;
  /** A new press: the crisis card of the last one is no longer shown. */
  reset: () => void;
};

/**
 * The hook's whole behaviour, from its state and the one way to change it (`dispatch`: React's in the hook, the tests'
 * own holder in the tests): `refuse` marks the scan asked while `scanThenRefuse` runs, and a crisis raises `inCrisis`
 * with AIAIC's card.
 */
export function formScan(
  state: ScanState,
  dispatch: (event: ScanEvent) => void,
  ask: AskTheScan,
): FormScan {
  return {
    ...state,
    refuse: async (words, lang, refusal, say) => {
      if (words.trim()) dispatch({ type: "asking" });
      try {
        await scanThenRefuse(ask, words, lang, refusal, {
          crisis: (crisis) => dispatch({ type: "crisis", crisis }),
          say,
        });
      } finally {
        dispatch({ type: "asked" });
      }
    },
    reset: () => dispatch({ type: "reset" }),
  };
}

/**
 * The problem a form shows: AIAIC's crisis card first (it outranks everything; `ProblemCard` raises it to the page's
 * gate), else the form's own. Both payout forms show what this gives, so the tests read what they show.
 */
export function problemShown(
  scan: Pick<ScanState, "inCrisis" | "crisis">,
  own: AiaicProblem | null,
): AiaicProblem | null {
  return scan.inCrisis ? problem("crisis", { crisis: scan.crisis }) : own;
}

/**
 * BEFORE THIS PHONE REFUSES A FORM FOR ANYTHING ELSE (push 4b audit, R-03; the platform's rule D-105: nothing answers a
 * person in crisis before the scan does): what she typed is read for distress first, by AIAIC, which keeps nothing.
 * `refuse` shows the crisis card when her words read as distress (`inCrisis`), else says the refusal it was given. A
 * scan that cannot be asked (no network) leaves the refusal said. Its state is `scanReducer`'s and its behaviour
 * `formScan`'s, nothing else: the tests run those two and pin these three lines.
 */
export function useScanBeforeRefusing(): FormScan {
  const ask = useServerFn(scanFirst);
  const [state, dispatch] = useReducer(scanReducer, SCAN_START);
  return formScan(state, dispatch, ask);
}
