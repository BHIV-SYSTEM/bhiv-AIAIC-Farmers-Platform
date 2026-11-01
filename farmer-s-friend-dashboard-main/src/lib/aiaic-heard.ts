import { useEffect, useRef } from "react";

import { useRaiseCrisis } from "./aiaic-crisis";
import { useScanBeforeRefusing } from "./aiaic-scan";
import { problem } from "./aiaic-trade";

/**
 * NO BOX IS BLIND TO A PERSON IN CRISIS (the platform's rule D-105; the audit of 1 Nov 2026, F12). A `type="number"` box holds "" for
 * words typed in it, and a list's search box keeps what it finds on the device, so neither could reach AIAIC's crisis card. These are
 * the one way a box here is heard: what is typed stays in the box, and anything that is not what the box asks for is read by AIAIC,
 * which keeps nothing, after a pause and on the button. A crisis takes the whole page (`CrisisFirst`).
 */
type Lang = "en" | "mr" | "hi";

/** How long a box waits after the last key before what is typed there is read for distress. */
export const WORDS_PAUSE_MS = 1200;

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/**
 * A box's text read as a plain number, or null. Devanagari digits count: a Marathi or Hindi phone keyboard types them. Nothing else
 * does, and nothing is guessed from the digits in a longer text: "500 kg" is not 500 quintals, "10 20" is not 1,020 (the audit of
 * 1 Nov 2026, F13), and a quantity can flip a verdict.
 */
export function plainNumber(typed: string): number | null {
  const said = typed.trim().replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
  return /^(\d+\.?\d*|\.\d+)$/.test(said) ? Number(said) : null;
}

/** Has AIAIC read some words, once each; its crisis card goes to the page's gate. */
export function useHearWords(lang: Lang) {
  const scan = useScanBeforeRefusing();
  const raise = useRaiseCrisis();
  useEffect(() => {
    if (scan.inCrisis) raise?.(problem("crisis", { crisis: scan.crisis }));
  }, [scan.inCrisis, scan.crisis, raise]);
  const read = useRef("");
  return async (words: string): Promise<void> => {
    const said = words.trim();
    if (!said || read.current === said) return;
    read.current = said;
    await scan.refuse(said, lang, "", () => undefined);
  };
}

/**
 * A box that asks for a number and keeps what is typed. `words`: it holds anything else, which AIAIC has read after a pause;
 * `heard()`, on the button, reads it at once. The caller reads the number with `plainNumber` and never uses anything else.
 */
export function useNumberBoxHeard(typed: string, lang: Lang) {
  const hear = useHearWords(lang);
  const said = typed.trim();
  const words = said !== "" && plainNumber(said) === null;
  useEffect(() => {
    if (!words) return undefined;
    const id = setTimeout(() => void hear(said), WORDS_PAUSE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said, words]);
  return { words, heard: () => hear(said) };
}
