import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import type { Crisis } from "./aiaic-account";
import { scanFirst } from "./aiaic-account.functions";

type Lang = "en" | "mr" | "hi";

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
    if (words.trim()) {
      setScanning(true);
      try {
        const r = await scanFn({ data: { text: words.slice(0, 2000), lang } });
        if (!r.ok && r.code === "crisis") {
          setCrisis(r.crisis ?? null);
          setInCrisis(true);
          return;
        }
      } catch {
        /* the scan could not be asked: the refusal below is still said */
      } finally {
        setScanning(false);
      }
    }
    say(refusal);
  }

  function reset(): void {
    setInCrisis(false);
    setCrisis(null);
  }

  return { inCrisis, crisis, scanning, refuse, reset };
}
