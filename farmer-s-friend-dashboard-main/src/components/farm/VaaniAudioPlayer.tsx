import { AlertCircle, Loader2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Shared global audio instance to ensure only one audio plays at any time across the app
let globalAudioInstance: HTMLAudioElement | null = null;
let currentStopCallback: (() => void) | null = null;

export function stopAnyActiveAudio() {
  if (globalAudioInstance) {
    globalAudioInstance.pause();
    globalAudioInstance.currentTime = 0;
  }
  if (currentStopCallback) {
    currentStopCallback();
    currentStopCallback = null;
  }
}

export type AudioState = "idle" | "generating" | "playing" | "paused" | "unavailable";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Marathi is not supported by the deployed Vaani service (only 'hi' verified).
  const isLanguageUnsupported = lang === "mr";

  // Clean up on unmount or when text/lang changes
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [text, lang]);

  const handlePlayPause = useCallback(async () => {
    // If Marathi, it is not supported by deployed service — show explicit localized message
    if (isLanguageUnsupported) {
      setState("unavailable");
      setErrorMessage(t("tts.marathiUnavailable"));
      return;
    }

    if (!text || text.trim().length === 0) {
      return;
    }

    // 1. If currently playing, pause
    if (state === "playing" && globalAudioInstance) {
      globalAudioInstance.pause();
      setState("paused");
      return;
    }

    // 2. If paused, resume
    if (state === "paused" && globalAudioInstance && audioUrlRef.current) {
      try {
        await globalAudioInstance.play();
        setState("playing");
      } catch (err) {
        console.warn("[VaaniPlayer] Resume failed:", err);
        setState("idle");
      }
      return;
    }

    // 3. If audio was already fetched for this text, play it
    if (audioUrlRef.current && globalAudioInstance) {
      stopAnyActiveAudio();
      globalAudioInstance.src = audioUrlRef.current;
      currentStopCallback = () => setState("idle");
      try {
        await globalAudioInstance.play();
        setState("playing");
        return;
      } catch (err) {
        console.warn("[VaaniPlayer] Playback of existing buffer failed:", err);
      }
    }

    // 4. Otherwise, generate audio from Vaani TTS service
    stopAnyActiveAudio();
    setState("generating");
    setErrorMessage(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

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
        let errJson: any = {};
        try {
          errJson = await response.json();
        } catch {
          // ignore
        }

        if (errJson?.code === "UNSUPPORTED_LANGUAGE") {
          setState("unavailable");
          setErrorMessage(t("tts.languageUnsupported"));
          return;
        }

        setState("unavailable");
        setErrorMessage(
          errJson?.message || t("tts.failed") || "Audio synthesis currently unavailable.",
        );
        return;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("audio/wav") && !contentType.includes("audio/")) {
        setState("unavailable");
        setErrorMessage(t("tts.invalidFormat"));
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      audioUrlRef.current = objectUrl;

      // Initialize shared audio instance if needed
      if (!globalAudioInstance) {
        globalAudioInstance = new Audio();
      }

      const audio = globalAudioInstance;
      audio.src = objectUrl;

      audio.onended = () => {
        setState("idle");
      };

      audio.onerror = () => {
        setState("unavailable");
        setErrorMessage(t("tts.playbackFailed"));
      };

      currentStopCallback = () => setState("idle");
      await audio.play();
      setState("playing");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("[VaaniPlayer] Synthesis error:", err);
      setState("unavailable");
      setErrorMessage(t("tts.failed"));
    }
  }, [state, text, lang, isLanguageUnsupported, t]);

  const handleStop = useCallback(() => {
    stopAnyActiveAudio();
    setState("idle");
  }, []);

  return (
    <div id="vaani-audio-player" className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Main Audio Button */}
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={state === "generating"}
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
                : state === "unavailable"
                  ? "border-2 border-border bg-card text-muted-foreground hover:bg-muted"
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

        {/* Audio service label */}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground sm:text-xs">
          <span>BHIV Vaani Voice</span>
          {isLanguageUnsupported ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              Hindi only
            </span>
          ) : (
            <span className="rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">
              Live
            </span>
          )}
        </span>
      </div>

      {/* Localized Capability or Unavailable Message */}
      {isLanguageUnsupported ? (
        <div
          role="note"
          className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-xs text-warning-foreground sm:text-sm"
        >
          <VolumeX aria-hidden className="size-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">{t("tts.marathiUnavailableTitle")}</span>
            <span>{t("tts.marathiUnavailable")}</span>
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
