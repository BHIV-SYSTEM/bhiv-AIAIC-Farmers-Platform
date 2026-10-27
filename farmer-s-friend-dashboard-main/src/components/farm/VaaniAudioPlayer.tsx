import { AlertCircle, Loader2, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n, type Lang } from "@/lib/i18n";
import {
  getMatchingBrowserVoice,
  isBrowserSpeechSupported,
  stopBrowserSpeech,
  VOICE_LOCALE,
} from "@/lib/use-speech";
import { cn } from "@/lib/utils";

/**
 * ONE PLAYER SPEAKS AT A TIME ACROSS THE APP. The audio element is shared; `owner` is the player whose sound it is
 * (Vaani's or the device voice). A player that starts takes the sound: the previous owner is told to let go, so its
 * pending answer is dropped and its buttons go back to Play (review of PR #10, F-07: a late answer of one card played
 * over another's, and a card kept saying "Pause" for a sound that had ended).
 */
type Owner = { release: () => void };
let sharedAudio: HTMLAudioElement | null = null;
let owner: Owner | null = null;
// Kept here so Chrome does not collect the utterance while it is speaking.
let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Stops all audio sources across the application (both HTML Audio and Browser Speech Synthesis), and tells the player
 * that owned the sound to let go.
 */
export function stopAnyActiveAudio() {
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
  }
  stopBrowserSpeech();
  activeUtterance = null;
  const previous = owner;
  owner = null;
  previous?.release();
}

export type AudioState = "idle" | "generating" | "playing" | "paused" | "unavailable";
export type AudioEngine = "vaani" | "browser" | null;
/** Whether this device has a voice for the language: not known until its voice list has loaded. */
type VoiceCheck = "unknown" | "yes" | "no";

/**
 * Verified languages supported by the deployed sovereign Vaani TTS service.
 * Live /health reports only pyttsx3 active; only Hindi ('hi') is verified and supported.
 */
const VAANI_ELIGIBLE_LANGUAGES = ["hi"] as const;
/** The client's wait for Vaani (its server waits 15 s). */
const VAANI_WAIT_MS = 14_000;
/** A device voice that has not started by then is stopped and said to have failed, never shown as playing. */
const START_WAIT_MS = 5_000;
/** Chrome's first voice list is empty: the voices are waited for this long before "no voice" is said. */
const VOICES_WAIT_MS = 1_500;

function isVaaniEligible(lang: Lang): boolean {
  return (VAANI_ELIGIBLE_LANGUAGES as readonly string[]).includes(lang);
}

export function VaaniAudioPlayer({
  text,
  lang,
  className,
}: {
  /** The short advice paragraph to synthesize */
  text: string;
  lang: Lang;
  className?: string;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<AudioState>("idle");
  const [activeEngine, setActiveEngine] = useState<AudioEngine>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceVoice, setDeviceVoice] = useState<VoiceCheck>("unknown");
  // Hindi only: Vaani did not answer, so the device voice read the words (said, review F-10)
  const [fellBack, setFellBack] = useState(false);

  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const startTimerRef = useRef<number | null>(null);

  const clearStartTimer = useCallback(() => {
    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  }, []);

  // What another player (or Stop) calls to take the sound from this one: its pending work is dropped (a late answer
  // is never played) and its buttons go back to Play.
  const release = useCallback(() => {
    requestIdRef.current++;
    abortControllerRef.current?.abort();
    clearStartTimer();
    setState("idle");
    setActiveEngine(null);
  }, [clearStartTimer]);
  const me = useMemo<Owner>(() => ({ release }), [release]);

  const takeSound = useCallback(() => {
    stopAnyActiveAudio();
    owner = me;
  }, [me]);

  const letGo = useCallback(() => {
    if (owner === me) owner = null;
  }, [me]);

  // THE DEVICE'S VOICES, CHECKED AFTER THE PAGE LOADS (review F-12): read once at once, again when the list changes
  // (Chrome fills it a moment later), and settled after VOICES_WAIT_MS; until then nothing says "unavailable". The
  // listener is added only where the browser has one (review F-16: an older WebKit has no addEventListener there).
  useEffect(() => {
    if (!isBrowserSpeechSupported()) {
      setDeviceVoice("no");
      return;
    }
    const synth = window.speechSynthesis;
    const check = (final: boolean) => {
      if (!final && synth.getVoices().length === 0) return;
      setDeviceVoice(getMatchingBrowserVoice(lang) ? "yes" : "no");
    };
    check(false);
    const onVoicesChanged = () => check(true);
    const listens = typeof synth.addEventListener === "function";
    if (listens) synth.addEventListener("voiceschanged", onVoicesChanged);
    const settle = window.setTimeout(() => check(true), VOICES_WAIT_MS);
    return () => {
      window.clearTimeout(settle);
      if (listens) synth.removeEventListener("voiceschanged", onVoicesChanged);
    };
  }, [lang]);

  const hasDeviceVoice = deviceVoice === "yes";
  // A language is supported if either Vaani supports it (hi) or the device has a matching voice
  const isAudioAvailable = isVaaniEligible(lang) || hasDeviceVoice;
  const knownUnavailable = !isVaaniEligible(lang) && deviceVoice === "no";

  // THE WORDS OR THE LANGUAGE CHANGED, OR THE PLAYER IS LEAVING (review F-08, F-09): what it was doing ends with it.
  // A pending answer is dropped and the buttons go back to Play (a change mid-request left a spinner forever), and a
  // sound it was playing stops (it kept reading on the next page, with no button there to stop it).
  useEffect(() => {
    const urlRef = audioUrlRef;
    return () => {
      if (owner === me) stopAnyActiveAudio();
      else me.release();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setFellBack(false);
      setErrorMessage(null);
    };
  }, [text, lang, me]);

  /**
   * Browser Speech Synthesis player (English and Marathi, and Hindi when Vaani does not answer).
   */
  const playBrowserSpeech = useCallback(
    (speechText: string, speechLang: Lang, reqId: number) => {
      if (requestIdRef.current !== reqId) return;

      const fail = (message: string) => {
        clearStartTimer();
        letGo();
        setState("unavailable");
        setActiveEngine(null);
        setErrorMessage(message);
      };

      if (!isBrowserSpeechSupported()) {
        fail(t("tts.browserSpeechUnavailable"));
        return;
      }

      const voice = getMatchingBrowserVoice(speechLang);
      if (!voice) {
        fail(speechLang === "mr" ? t("tts.marathiUnavailable") : t("tts.deviceVoiceMissing"));
        return;
      }

      stopBrowserSpeech();

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.voice = voice;
      utterance.lang = VOICE_LOCALE[speechLang] || voice.lang;
      utterance.rate = 0.95;
      activeUtterance = utterance;

      utterance.onstart = () => {
        if (requestIdRef.current !== reqId) return;
        clearStartTimer();
        setState("playing");
        setActiveEngine("browser");
        setErrorMessage(null);
      };

      utterance.onend = () => {
        if (requestIdRef.current !== reqId) return;
        clearStartTimer();
        activeUtterance = null;
        letGo();
        setState("idle");
        setActiveEngine(null);
      };

      utterance.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        if (requestIdRef.current !== reqId) return;
        console.warn("[VaaniPlayer] Browser speech synthesis error:", e.error);
        activeUtterance = null;
        fail(t("tts.playbackFailed"));
      };

      // SAID AS PLAYING ONLY ONCE IT STARTS (review F-06): until the device voice starts, the button says it is
      // getting ready; one that has not started within START_WAIT_MS (a browser that ignores speech outside a tap, a
      // stuck queue) is stopped and said to have failed.
      setState("generating");
      clearStartTimer();
      startTimerRef.current = window.setTimeout(() => {
        startTimerRef.current = null;
        if (requestIdRef.current !== reqId) return;
        requestIdRef.current++;
        stopBrowserSpeech();
        activeUtterance = null;
        fail(t("tts.playbackFailed"));
      }, START_WAIT_MS);

      try {
        // a queue left paused (a Pause, then Stop) speaks nothing in Chrome until it is resumed
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error("[VaaniPlayer] Browser speak() invocation failed:", err);
        fail(t("tts.playbackFailed"));
      }
    },
    [t, clearStartTimer, letGo],
  );

  /**
   * Plays a Vaani sound in the shared element with THIS player's own handlers, every time (review F-07: a replay kept
   * another card's handlers). False when the browser refused to play it.
   */
  const playVaani = useCallback(
    async (url: string, reqId: number): Promise<boolean> => {
      if (!sharedAudio) sharedAudio = new Audio();
      const audio = sharedAudio;
      audio.src = url;
      let fellBackHere = false;

      audio.onended = () => {
        if (requestIdRef.current !== reqId) return;
        letGo();
        setState("idle");
        setActiveEngine(null);
      };
      audio.onerror = () => {
        if (fellBackHere || requestIdRef.current !== reqId) return;
        fellBackHere = true;
        console.warn("[VaaniPlayer] Audio element error, falling back to the device voice");
        setFellBack(true);
        playBrowserSpeech(text, lang, reqId);
      };

      try {
        await audio.play();
        if (requestIdRef.current === reqId && !fellBackHere) {
          setState("playing");
          setActiveEngine("vaani");
          setErrorMessage(null);
        }
        return true;
      } catch (err) {
        if (requestIdRef.current !== reqId || fellBackHere) return true;
        audio.onerror = null;
        console.warn("[VaaniPlayer] audio.play() blocked or failed:", err);
        return false;
      }
    },
    [text, lang, letGo, playBrowserSpeech],
  );

  /**
   * Main Play / Pause / Resume toggle handler
   */
  const handlePlayPause = useCallback(async () => {
    if (!text || text.trim().length === 0) {
      return;
    }

    // 1. If currently playing, pause active source
    if (state === "playing") {
      if (activeEngine === "vaani" && sharedAudio) {
        sharedAudio.pause();
        setState("paused");
        return;
      }
      if (activeEngine === "browser" && isBrowserSpeechSupported()) {
        window.speechSynthesis.pause();
        setState("paused");
        return;
      }
    }

    // 2. If paused, resume active source (only while the sound is still this player's)
    if (state === "paused" && owner === me) {
      if (activeEngine === "vaani" && sharedAudio && audioUrlRef.current) {
        try {
          await sharedAudio.play();
          setState("playing");
          return;
        } catch (err) {
          console.warn("[VaaniPlayer] Resume failed on audio buffer:", err);
        }
      }
      if (
        activeEngine === "browser" &&
        isBrowserSpeechSupported() &&
        window.speechSynthesis.paused
      ) {
        window.speechSynthesis.resume();
        setState("playing");
        return;
      }
    }

    // 3. If Vaani audio was already made for these words in Hindi, play it again
    if (lang === "hi" && audioUrlRef.current) {
      takeSound();
      const replayId = ++requestIdRef.current;
      setErrorMessage(null);
      if (await playVaani(audioUrlRef.current, replayId)) return;
      // the browser refused the kept sound: it is made again below
    }

    // 4. Start fresh audio generation
    takeSound();
    const currentReqId = ++requestIdRef.current;
    setErrorMessage(null);
    setFellBack(false);

    // Branch A: Vaani eligible (Hindi) -> Try Vaani service first with client timeout & fallback
    if (isVaaniEligible(lang)) {
      setState("generating");

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), VAANI_WAIT_MS);

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
            language: lang,
            voiceProfile: "vaani_teacher",
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Vaani synthesis returned status ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("audio/")) {
          throw new Error(`Unexpected audio content-type: ${contentType}`);
        }

        const blob = await response.blob();
        window.clearTimeout(timeoutId);
        if (requestIdRef.current !== currentReqId) return;

        // the new sound replaces the one kept before, which is let go (review F-17)
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        audioUrlRef.current = objectUrl;

        if (!(await playVaani(objectUrl, currentReqId))) {
          setFellBack(true);
          playBrowserSpeech(text, lang, currentReqId);
        }
      } catch (err) {
        window.clearTimeout(timeoutId);
        if (requestIdRef.current !== currentReqId) return;

        console.warn(
          "[VaaniPlayer] Vaani service error or timeout, engaging browser speech fallback:",
          err instanceof Error ? err.message : err,
        );
        setFellBack(true);
        playBrowserSpeech(text, lang, currentReqId);
      }
      return;
    }

    // Branch B: Non-Vaani language (English or Marathi) -> Direct to browser speech synthesis
    playBrowserSpeech(text, lang, currentReqId);
  }, [state, activeEngine, text, lang, me, takeSound, playVaani, playBrowserSpeech]);

  // Stop: also while the sound is being made, which drops the pending answer (review F-02's case 3h)
  const handleStop = useCallback(() => {
    if (owner === me) stopAnyActiveAudio();
    else me.release();
  }, [me]);

  const vaaniBadge = activeEngine === "browser" || fellBack;

  return (
    <div id="vaani-audio-player" className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Main Audio Button */}
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={state === "generating" || (!isAudioAvailable && state === "idle")}
          aria-label={
            state === "playing"
              ? t("speak.pause")
              : state === "generating"
                ? t("tts.generating")
                : t("speak.play")
          }
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-bold transition-all shadow-sm sm:min-h-14 sm:rounded-2xl sm:px-5 sm:text-lg touch-manipulation",
            state === "playing"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary/40"
              : state === "generating"
                ? "bg-muted text-muted-foreground cursor-wait"
                : !isAudioAvailable
                  ? "border-2 border-border bg-card text-muted-foreground hover:bg-muted cursor-not-allowed opacity-80"
                  : "border-2 border-primary bg-card text-primary hover:bg-primary/10",
          )}
        >
          {state === "generating" ? (
            <Loader2 aria-hidden className="size-5 shrink-0 animate-spin" />
          ) : state === "playing" ? (
            <Pause aria-hidden className="size-5 shrink-0" />
          ) : (
            <Volume2 aria-hidden className="size-5 shrink-0" />
          )}

          <span className="truncate">
            {state === "generating"
              ? t("tts.generating")
              : state === "playing"
                ? t("speak.pause")
                : state === "paused"
                  ? t("speak.resume")
                  : t("speak.play")}
          </span>
        </button>

        {/* Stop button while the sound is being made, playing or paused */}
        {state === "generating" || state === "playing" || state === "paused" ? (
          <button
            type="button"
            onClick={handleStop}
            aria-label={t("speak.stop")}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card px-3.5 text-sm font-bold text-foreground hover:bg-muted sm:min-h-14 sm:rounded-2xl sm:px-4 sm:text-base touch-manipulation"
          >
            <RotateCcw aria-hidden className="size-4 shrink-0" />
            <span>{t("speak.stop")}</span>
          </button>
        ) : null}

        {/* Audio service label & engine badge, in her language (review F-05) */}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground sm:text-xs">
          <span>{t("tts.voiceName")}</span>
          {isVaaniEligible(lang) ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                vaaniBadge ? "bg-primary/10 text-primary" : "bg-success-soft text-success",
              )}
            >
              {vaaniBadge ? t("tts.badgeDevice") : t("tts.badgeVaani")}
            </span>
          ) : hasDeviceVoice ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {t("tts.badgeDevice")}
            </span>
          ) : knownUnavailable ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              {lang === "mr" ? t("tts.badgeHindiOnly") : t("tts.badgeUnavailable")}
            </span>
          ) : null}
        </span>
      </div>

      {/* Localized Message when audio is genuinely unavailable or an error occurred */}
      {knownUnavailable && state === "idle" ? (
        <div
          role="note"
          className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-xs text-warning-foreground sm:text-sm"
        >
          <VolumeX aria-hidden className="size-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">
              {lang === "mr" ? t("tts.marathiUnavailableTitle") : t("tts.unavailableTitle")}
            </span>
            <span>{lang === "mr" ? t("tts.marathiUnavailable") : t("tts.deviceVoiceMissing")}</span>
          </div>
        </div>
      ) : errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2 text-xs text-danger-foreground sm:text-sm"
        >
          <AlertCircle aria-hidden className="size-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      ) : fellBack && isVaaniEligible(lang) ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("tts.fellBackNote")}
        </p>
      ) : null}
    </div>
  );
}
