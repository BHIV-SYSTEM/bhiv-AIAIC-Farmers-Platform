import { useCallback, useEffect, useState } from "react";

import type { Lang } from "./i18n";

export const VOICE_LOCALE: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};

/**
 * Checks if browser speech synthesis APIs are available in the current window.
 */
export function isBrowserSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

/**
 * Selects an intelligible, matching speech synthesis voice for the requested language.
 *
 * Strict Guardrails:
 * 1. For Marathi ('mr'): ONLY returns a Marathi voice ('mr' or 'mr-IN'). Never falls
 *    back to an English or generic system voice to prevent unintelligible gibberish.
 * 2. For Hindi ('hi'): ONLY returns a Hindi voice ('hi' or 'hi-IN').
 * 3. For English ('en'): Prefers Indian English ('en-IN'), falls back to any English voice ('en-*').
 */
export function getMatchingBrowserVoice(
  lang: Lang,
  customVoices?: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (
    (!customVoices || customVoices.length === 0) &&
    (typeof window === "undefined" || !("speechSynthesis" in window))
  ) {
    return null;
  }
  const voices =
    customVoices && customVoices.length > 0 ? customVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }

  const targetLocale = (VOICE_LOCALE[lang] || "en-IN").toLowerCase().replace("_", "-");
  const langPrefix = lang.toLowerCase();

  // 1. Exact BCP-47 match (e.g. "en-in", "hi-in", "mr-in")
  const exactMatch = voices.find((v) => v.lang.toLowerCase().replace("_", "-") === targetLocale);
  if (exactMatch) return exactMatch;

  // 2. Prefix match for regional variants (e.g. "hi_IN" or "hi-*" or "mr-*")
  const prefixMatch = voices.find((v) => {
    const vLang = v.lang.toLowerCase().replace("_", "-");
    return vLang.startsWith(`${langPrefix}-`) || vLang === langPrefix;
  });
  if (prefixMatch) return prefixMatch;

  // 3. Strict guard for Marathi ('mr'):
  // NEVER fall back to Hindi, English, or an arbitrary default system voice!
  if (lang === "mr") {
    return null;
  }

  // 4. Strict guard for Hindi ('hi'):
  // NEVER fall back to non-Hindi voice!
  if (lang === "hi") {
    return null;
  }

  // 5. English ('en'): Any English voice (e.g. en-US, en-GB, en-AU) is acceptable and intelligible
  if (lang === "en") {
    const anyEnglish = voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith("en"));
    if (anyEnglish) return anyEnglish;
  }

  return null;
}

/**
 * Checks whether a compatible browser voice exists for the given language.
 */
export function hasMatchingBrowserVoice(
  lang: Lang,
  customVoices?: SpeechSynthesisVoice[],
): boolean {
  return Boolean(getMatchingBrowserVoice(lang, customVoices));
}

// Module-level reference to the active utterance to prevent Chrome garbage-collection cancellation bug
let activeBrowserUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Stops any currently active browser speech synthesis.
 */
export function stopBrowserSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  activeBrowserUtterance = null;
}

/**
 * Read-out of the advice using the browser's built-in speech synthesis.
 * Support is checked after hydration so SSR stays clean.
 */
export function useSpeech(lang: Lang) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  useEffect(() => {
    const isAvail = isBrowserSpeechSupported();
    setSupported(isAvail);
    if (!isAvail) return;

    const onVoicesChanged = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoicesLoaded(true);
    };

    onVoicesChanged();
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      stopBrowserSpeech();
    };
  }, []);

  const stop = useCallback(() => {
    stopBrowserSpeech();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isBrowserSpeechSupported()) return;
      const synth = window.speechSynthesis;
      synth.cancel();

      const voice = getMatchingBrowserVoice(lang);
      if (!voice && (lang === "mr" || lang === "hi")) {
        console.warn(`[useSpeech] No suitable voice installed for language: ${lang}`);
        return;
      }

      const locale = VOICE_LOCALE[lang];
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale;
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        activeBrowserUtterance = null;
      };
      utterance.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.warn("[useSpeech] Speech error:", e.error);
        }
        setSpeaking(false);
        activeBrowserUtterance = null;
      };

      activeBrowserUtterance = utterance;
      synth.speak(utterance);
    },
    [lang],
  );

  const toggle = useCallback(
    (text: string) => {
      if (speaking) stop();
      else speak(text);
    },
    [speaking, speak, stop],
  );

  return { supported, speaking, speak, stop, toggle, voicesLoaded };
}
