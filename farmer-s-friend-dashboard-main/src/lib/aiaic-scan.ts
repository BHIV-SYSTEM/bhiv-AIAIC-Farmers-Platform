import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import type { AccountOutcome, Crisis } from "./aiaic-account";
import { scanFirst } from "./aiaic-account.functions";

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
 * BEFORE THIS PHONE REFUSES A FORM FOR ANYTHING ELSE (push 4b audit, R-03; the platform's rule D-105: nothing answers a
 * person in crisis before the scan does): what she typed is read for distress first, by AIAIC, which keeps nothing.
 * `refuse` shows the crisis card when her words read as distress (`inCrisis`), else says the refusal it was given. A
 * scan that cannot be asked (no network) leaves the refusal said.
 */
export function useScanBeforeRefusing() {
  const scanFn = useServerFn(scanFirst);
  const [inCrisis, setInCrisis] = useState(false);
  const [crisis, setCrisis] = useState<Crisis | null>(null);
  const [scanning, setScanning] = useState(false);

  async function refuse(
    words: string,
    lang: Lang,
    refusal: string,
    say: (code: string) => void,
  ): Promise<void> {
    if (words.trim()) setScanning(true);
    try {
      await scanThenRefuse(scanFn, words, lang, refusal, {
        crisis: (c) => {
          setCrisis(c);
          setInCrisis(true);
        },
        say,
      });
    } finally {
      setScanning(false);
    }
  }

  function reset(): void {
    setInCrisis(false);
    setCrisis(null);
  }

  return { inCrisis, crisis, scanning, refuse, reset };
}
