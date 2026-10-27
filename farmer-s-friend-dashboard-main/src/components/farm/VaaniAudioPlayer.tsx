import { AlertCircle, Loader2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n, type Lang } from "@/lib/i18n";
import {
  getMatchingBrowserVoice,
  isBrowserSpeechSupported,
  stopBrowserSpeech,
  VOICE_LOCALE,
} from "@/lib/use-speech";
import { cn } from "@/lib/utils";

// Shared global audio instance to ensure only one audio plays at any time across the app
let globalAudioInstance: HTMLAudioElement | null = null;
let currentStopCallback: (() => void) | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let globalRequestId = 0;

/**
 * Stops all audio sources across the application (both HTML Audio and Browser Speech Synthesis).
 */
export function stopAnyActiveAudio() {
  globalRequestId++;

  if (globalAudioInstance) {
    globalAudioInstance.pause();
    globalAudioInstance.currentTime = 0;
  }

  stopBrowserSpeech();
  activeUtterance = null;

  if (currentStopCallback) {
    currentStopCallback();
    currentStopCallback = null;
  }
}

export type AudioState = "idle" | "generating" | "playing" | "paused" | "unavailable";
export type AudioEngine = "vaani" | "browser" | null;

/**
 * Verified languages supported by the deployed sovereign Vaani TTS service.
 * Live /health reports only pyttsx3 active; only Hindi ('hi') is verified and supported.
 */
const VAANI_ELIGIBLE_LANGUAGES = ["hi"] as const;

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
  const [voicesVersion, setVoicesVersion] = useState(0);

  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);

  // Monitor browser voices loading asynchronously (common in Chrome/Edge)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const onVoicesChanged = () => {
      setVoicesVersion((v) => v + 1);
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
    };
  }, []);

  // Check if browser speech has an intelligible voice for this language
  const hasDeviceVoice = isBrowserSpeechSupported() && Boolean(getMatchingBrowserVoice(lang));

  // A language is supported if either Vaani supports it (hi) or browser has a compatible voice
  const isAudioAvailable = isVaaniEligible(lang) || hasDeviceVoice;

  // Clean up on unmount or when text / lang changes
  useEffect(() => {
    const reqRef = requestIdRef;
    const abortRef = abortControllerRef;
    const urlRef = audioUrlRef;
    return () => {
      reqRef.current++;
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [text, lang]);

  /**
   * Browser Speech Synthesis fallback player
   */
  const playBrowserSpeech = useCallback(
    (speechText: string, speechLang: Lang, reqId: number) => {
      if (requestIdRef.current !== reqId) return;

      if (!isBrowserSpeechSupported()) {
        setState("unavailable");
        setErrorMessage(t("tts.browserSpeechUnavailable") || t("tts.failed"));
        setActiveEngine(null);
        return;
      }

      const voice = getMatchingBrowserVoice(speechLang);
      if (!voice) {
        setState("unavailable");
        const msg =
          speechLang === "mr"
            ? t("tts.marathiUnavailable")
            : t("tts.deviceVoiceMissing") || t("tts.failed");
        setErrorMessage(msg);
        setActiveEngine(null);
        return;
      }

      stopBrowserSpeech();

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.voice = voice;
      utterance.lang = VOICE_LOCALE[speechLang] || voice.lang;
      utterance.rate = 0.95;
      activeUtterance = utterance;

      utterance.onstart = () => {
        if (requestIdRef.current !== reqId) {
          stopBrowserSpeech();
          return;
        }
        setState("playing");
        setActiveEngine("browser");
        setErrorMessage(null);
      };

      utterance.onend = () => {
        if (requestIdRef.current === reqId) {
          setState("idle");
          setActiveEngine(null);
          activeUtterance = null;
        }
      };

      utterance.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") {
          return;
        }
        console.warn("[VaaniPlayer] Browser speech synthesis error:", e.error);
        if (requestIdRef.current === reqId) {
          setState("unavailable");
          setErrorMessage(t("tts.playbackFailed"));
          setActiveEngine(null);
          activeUtterance = null;
        }
      };

      currentStopCallback = () => {
        setState("idle");
        setActiveEngine(null);
        activeUtterance = null;
      };

      try {
        window.speechSynthesis.speak(utterance);
        // Ensure UI immediately enters playing state
        setState("playing");
        setActiveEngine("browser");
      } catch (err) {
        console.error("[VaaniPlayer] Browser speak() invocation failed:", err);
        setState("unavailable");
        setErrorMessage(t("tts.playbackFailed"));
        setActiveEngine(null);
      }
    },
    [t],
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
      if (activeEngine === "vaani" && globalAudioInstance) {
        globalAudioInstance.pause();
        setState("paused");
        return;
      }
      if (
        activeEngine === "browser" &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.pause();
        setState("paused");
        return;
      }
    }

    // 2. If paused, resume active source
    if (state === "paused") {
      if (activeEngine === "vaani" && globalAudioInstance && audioUrlRef.current) {
        try {
          await globalAudioInstance.play();
          setState("playing");
          return;
        } catch (err) {
          console.warn("[VaaniPlayer] Resume failed on audio buffer:", err);
          setState("idle");
        }
      }
      if (
        activeEngine === "browser" &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setState("playing");
          return;
        }
      }
    }

    // 3. If pre-fetched Vaani audio exists for this exact text in Hindi, play it directly
    if (lang === "hi" && audioUrlRef.current && globalAudioInstance) {
      stopAnyActiveAudio();
      globalAudioInstance.src = audioUrlRef.current;
      currentStopCallback = () => {
        setState("idle");
        setActiveEngine(null);
      };
      try {
        await globalAudioInstance.play();
        setState("playing");
        setActiveEngine("vaani");
        return;
      } catch (err) {
        console.warn("[VaaniPlayer] Playback of existing buffer failed:", err);
      }
    }

    // 4. Start fresh audio generation
    stopAnyActiveAudio();
    const currentReqId = ++requestIdRef.current;
    setErrorMessage(null);

    // Branch A: Vaani eligible (Hindi) -> Try Vaani service first with client timeout & fallback
    if (isVaaniEligible(lang)) {
      setState("generating");

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 14-second client timeout (server timeout is 15s)
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, 14_000);

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

        window.clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Vaani synthesis returned status ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("audio/wav") && !contentType.includes("audio/")) {
          throw new Error(`Unexpected audio content-type: ${contentType}`);
        }

        const blob = await response.blob();
        if (requestIdRef.current !== currentReqId) return;

        const objectUrl = URL.createObjectURL(blob);
        audioUrlRef.current = objectUrl;

        if (!globalAudioInstance) {
          globalAudioInstance = new Audio();
        }

        const audio = globalAudioInstance;
        audio.src = objectUrl;

        audio.onended = () => {
          if (requestIdRef.current === currentReqId) {
            setState("idle");
            setActiveEngine(null);
          }
        };

        audio.onerror = () => {
          if (requestIdRef.current === currentReqId) {
            console.warn("[VaaniPlayer] Audio element error, attempting browser fallback");
            playBrowserSpeech(text, lang, currentReqId);
          }
        };

        currentStopCallback = () => {
          setState("idle");
          setActiveEngine(null);
        };

        try {
          await audio.play();
          if (requestIdRef.current === currentReqId) {
            setState("playing");
            setActiveEngine("vaani");
          }
        } catch (playErr) {
          if (requestIdRef.current !== currentReqId) return;
          console.warn(
            "[VaaniPlayer] audio.play() blocked or failed, attempting browser fallback:",
            playErr,
          );
          playBrowserSpeech(text, lang, currentReqId);
        }
      } catch (err: any) {
        window.clearTimeout(timeoutId);
        if (requestIdRef.current !== currentReqId) return;

        console.warn(
          "[VaaniPlayer] Vaani service error or timeout, engaging browser speech fallback:",
          err?.message,
        );
        playBrowserSpeech(text, lang, currentReqId);
      }
      return;
    }

    // Branch B: Non-Vaani language (English or Marathi) -> Direct to browser speech synthesis
    playBrowserSpeech(text, lang, currentReqId);
  }, [state, activeEngine, text, lang, playBrowserSpeech]);

  const handleStop = useCallback(() => {
    stopAnyActiveAudio();
    setState("idle");
    setActiveEngine(null);
  }, []);

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
              ? t("speak.stop")
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

        {/* Stop button when playing or paused */}
        {state === "playing" || state === "paused" ? (
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

        {/* Audio service label & engine badge */}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground sm:text-xs">
          <span>BHIV Vaani Voice</span>
          {isVaaniEligible(lang) ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                activeEngine === "browser"
                  ? "bg-primary/10 text-primary"
                  : "bg-success-soft text-success",
              )}
            >
              {activeEngine === "browser"
                ? t("tts.badgeDevice") || "Device Voice"
                : t("tts.badgeVaani") || "Vaani Live"}
            </span>
          ) : hasDeviceVoice ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {t("tts.badgeDevice") || "Device Voice"}
            </span>
          ) : (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              {lang === "mr" ? "Hindi only" : "Unavailable"}
            </span>
          )}
        </span>
      </div>

      {/* Localized Message when audio is genuinely unavailable or an error occurred */}
      {!isAudioAvailable && state === "idle" ? (
        <div
          role="note"
          className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-xs text-warning-foreground sm:text-sm"
        >
          <VolumeX aria-hidden className="size-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">
              {lang === "mr"
                ? t("tts.marathiUnavailableTitle")
                : t("advice.audioUnavailable") || "Audio Unavailable"}
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
      ) : null}
    </div>
  );
}
