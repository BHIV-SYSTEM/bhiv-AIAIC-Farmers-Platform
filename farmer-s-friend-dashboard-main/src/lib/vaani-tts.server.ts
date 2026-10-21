/**
 * Server-Side Vaani TTS Proxy Service
 *
 * Integrates with the sovereign BHIV Vaani TTS service:
 * POST /v1/tts/synthesize
 * Payload: { "text": "...", "language": "hi", "voice_profile": "vaani_teacher" }
 * Returns: audio/wav binary bytes
 *
 * Mandatory Security & Operational Rules:
 * 1. VAANI_BASE_URL and VAANI_API_KEY remain server-only environment variables.
 * 2. Never exposes credentials to client bundles, responses, or error logs.
 * 3. Enforces strict input validation: min 1 char, max 2000 chars.
 * 4. Verifies language capability: Marathi ('mr') is not supported by the deployed Vaani service.
 *    Rejects unsupported languages with explicit error instead of silent browser fallback
 *    or misrepresenting language codes.
 * 5. Validates upstream HTTP 200 and audio/wav content type.
 */

import { z } from "zod";

export const ttsRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Advice text is required for audio synthesis")
    .max(2000, "Text length exceeds maximum allowed limit for short advice summary"),
  language: z.enum(["en", "hi", "mr"]).default("hi"),
  voiceProfile: z.string().default("vaani_teacher"),
});

export type TTSRequestInput = z.infer<typeof ttsRequestSchema>;

export interface TTSResultSuccess {
  ok: true;
  audioBuffer: ArrayBuffer;
  contentType: string;
  engine?: string | undefined;
  durationSeconds?: string | undefined;
}

export interface TTSResultError {
  ok: false;
  status: number;
  code:
    | "UNSUPPORTED_LANGUAGE"
    | "UPSTREAM_TIMEOUT"
    | "UPSTREAM_ERROR"
    | "INVALID_INPUT"
    | "INVALID_MEDIA_TYPE";
  message: string;
  details?: string | undefined;
}

export type TTSResult = TTSResultSuccess | TTSResultError;

/**
 * Returns server-side configuration without leaking sensitive keys.
 */
export function getVaaniServerConfig() {
  const baseUrl = process.env["VAANI_BASE_URL"]?.trim() || "http://163.128.209.18:8016";
  const hasApiKey = Boolean(process.env["VAANI_API_KEY"]?.trim());
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    hasApiKey,
  };
}

/**
 * Verified languages supported by the deployed Vaani service on VM (host port 8016).
 * Live /v1/tts/languages reports: ["en", "hi", "ar", "es", "fr", "ja"]
 * Live synthesis verification:
 *   - 'hi' (Hindi): 200 OK via pyttsx3 engine (WAV binary).
 *   - 'mr' (Marathi): 500 Error (unsupported by deployed offline engine).
 *   - 'en' (English): 500 Error (no native offline English voice on degraded CPU host).
 */
export const VAANI_VERIFIED_LANGUAGES = ["hi"] as const;

export function isVaaniLanguageSupported(lang: string): boolean {
  return (VAANI_VERIFIED_LANGUAGES as readonly string[]).includes(lang);
}

/**
 * Synthesizes short farmer advice text into WAV audio using the deployed Vaani TTS service.
 */
export async function synthesizeAdviceSpeech(input: TTSRequestInput): Promise<TTSResult> {
  const parsed = ttsRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message || "Invalid TTS request payload",
    };
  }

  const { text, language, voiceProfile } = parsed.data;

  // Marathi capability verification rule:
  // If Marathi is requested, reject with explicit capability gap.
  // Never send Marathi text as Hindi or English.
  if (language === "mr") {
    return {
      ok: false,
      status: 422,
      code: "UNSUPPORTED_LANGUAGE",
      message:
        "Marathi ('mr') text-to-speech is not currently supported by the deployed Vaani TTS service.",
    };
  }

  const { baseUrl } = getVaaniServerConfig();
  const apiKey = process.env["VAANI_API_KEY"]?.trim();

  const synthesizeUrl = `${baseUrl}/v1/tts/synthesize`;
  const requestBody = JSON.stringify({
    text,
    language,
    voice_profile: voiceProfile || "vaani_teacher",
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "audio/wav, audio/*;q=0.9, */*;q=0.5",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(synthesizeUrl, {
      method: "POST",
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(15_000), // 15-second upstream timeout
    });

    if (!response.ok) {
      let upstreamDetail = "";
      try {
        const errJson = (await response.json()) as { detail?: string };
        upstreamDetail = errJson.detail || "";
      } catch {
        upstreamDetail = await response.text().catch(() => "");
      }

      console.warn(
        `[VaaniTTS] Upstream synthesis HTTP ${response.status} for lang=${language}: ${upstreamDetail.slice(0, 150)}`,
      );

      return {
        ok: false,
        status: response.status >= 500 ? 502 : response.status,
        code: "UPSTREAM_ERROR",
        message:
          response.status === 404
            ? "Vaani TTS synthesize endpoint not found"
            : `Vaani TTS synthesis failed (HTTP ${response.status})`,
        details: upstreamDetail || undefined,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("audio/wav") &&
      !contentType.includes("audio/x-wav") &&
      !contentType.includes("audio/")
    ) {
      console.warn(`[VaaniTTS] Upstream returned unexpected content-type: ${contentType}`);
      return {
        ok: false,
        status: 502,
        code: "INVALID_MEDIA_TYPE",
        message: `Expected audio/wav from Vaani TTS, but received Content-Type: ${contentType}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const engine = response.headers.get("x-tts-engine") || undefined;
    const durationSeconds = response.headers.get("x-tts-duration-seconds") || undefined;

    return {
      ok: true,
      audioBuffer: arrayBuffer,
      contentType: "audio/wav",
      engine,
      durationSeconds,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    console.error(`[VaaniTTS] Network error calling ${synthesizeUrl}:`, err?.message);

    return {
      ok: false,
      status: isTimeout ? 504 : 502,
      code: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
      message: isTimeout
        ? "Vaani TTS service request timed out after 15 seconds"
        : "Failed to connect to the Vaani TTS service",
      details: err?.message,
    };
  }
}
