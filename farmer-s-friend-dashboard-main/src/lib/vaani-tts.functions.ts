import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { synthesizeAdviceSpeech, ttsRequestSchema } from "./vaani-tts.server";

export interface SpeechSynthesisResult {
  ok: boolean;
  audioBase64?: string | undefined;
  contentType?: string | undefined;
  engine?: string | undefined;
  durationSeconds?: string | undefined;
  code?: string | undefined;
  message?: string | undefined;
}

/**
 * Server Function RPC for synthesizing short farmer advice into WAV audio.
 * Accepts only text and language; returns base64-encoded WAV on success.
 */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .validator((data: unknown) => ttsRequestSchema.parse(data))
  .handler(async ({ data }): Promise<SpeechSynthesisResult> => {
    const result = await synthesizeAdviceSpeech(data);

    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
      };
    }

    const base64 = Buffer.from(result.audioBuffer).toString("base64");
    return {
      ok: true,
      audioBase64: base64,
      contentType: result.contentType,
      engine: result.engine,
      durationSeconds: result.durationSeconds,
    };
  });
