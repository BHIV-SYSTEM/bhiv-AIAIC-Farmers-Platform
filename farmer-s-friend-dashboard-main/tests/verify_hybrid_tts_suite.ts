import assert from "node:assert/strict";
import {
  isVaaniLanguageSupported,
  synthesizeAdviceSpeech,
  VAANI_VERIFIED_LANGUAGES,
} from "../src/lib/vaani-tts.server";
import {
  getMatchingBrowserVoice,
  hasMatchingBrowserVoice,
  VOICE_LOCALE,
} from "../src/lib/use-speech";
import type { Lang } from "../src/lib/i18n";

async function runHybridTtsTestSuite() {
  console.log("=== STARTING RELIABLE HYBRID VAANI TTS TEST SUITE ===");
  // each check is counted as it passes, and the end says how many ran (it said 15 whatever ran)
  let passed = 0;
  const ok = (what: string) => {
    passed++;
    console.log(`✓ ${what}`);
  };

  // -------------------------------------------------------------
  // Test 1: Language Capability & Server Allowlist Enforcement
  // -------------------------------------------------------------
  console.log("\n[Test 1] Server Allowlist & Capability Verification");
  assert.strictEqual(
    isVaaniLanguageSupported("hi"),
    true,
    "Hindi ('hi') must be verified by Vaani server allowlist",
  );
  assert.strictEqual(
    isVaaniLanguageSupported("en"),
    false,
    "English ('en') must NOT be in Vaani server allowlist",
  );
  assert.strictEqual(
    isVaaniLanguageSupported("mr"),
    false,
    "Marathi ('mr') must NOT be in Vaani server allowlist",
  );
  assert.deepStrictEqual(
    [...VAANI_VERIFIED_LANGUAGES],
    ["hi"],
    "VAANI_VERIFIED_LANGUAGES must strictly be ['hi']",
  );

  // Server rejection for English
  const enRes = await synthesizeAdviceSpeech({
    text: "Tomato price is stable today.",
    language: "en",
    voiceProfile: "vaani_teacher",
  });
  assert.strictEqual(enRes.ok, false, "English must be rejected by synthesizeAdviceSpeech");
  assert.strictEqual(enRes.status, 422, "English must return HTTP 422");
  assert.strictEqual(
    enRes.code,
    "UNSUPPORTED_LANGUAGE",
    "English must return UNSUPPORTED_LANGUAGE code",
  );

  // Server rejection for Marathi
  const mrRes = await synthesizeAdviceSpeech({
    text: "टोमॅटोचे दर स्थिर आहेत.",
    language: "mr",
    voiceProfile: "vaani_teacher",
  });
  assert.strictEqual(mrRes.ok, false, "Marathi must be rejected by synthesizeAdviceSpeech");
  assert.strictEqual(mrRes.status, 422, "Marathi must return HTTP 422");
  assert.strictEqual(
    mrRes.code,
    "UNSUPPORTED_LANGUAGE",
    "Marathi must return UNSUPPORTED_LANGUAGE code",
  );
  ok("Server-side allowlist strictly rejects unverified languages with HTTP 422");

  // -------------------------------------------------------------
  // Test 2: Browser Voice Selection & Strict Marathi Guardrail
  // -------------------------------------------------------------
  console.log("\n[Test 2] Browser Voice Selection Algorithm");

  const mockVoices: SpeechSynthesisVoice[] = [
    {
      name: "Google English India",
      lang: "en-IN",
      default: false,
      localService: true,
      voiceURI: "Google en-IN",
    },
    {
      name: "Microsoft David",
      lang: "en-US",
      default: true,
      localService: true,
      voiceURI: "David",
    },
    {
      name: "Google Hindi",
      lang: "hi-IN",
      default: false,
      localService: true,
      voiceURI: "Google hi-IN",
    },
    {
      name: "Google Marathi",
      lang: "mr-IN",
      default: false,
      localService: true,
      voiceURI: "Google mr-IN",
    },
  ];

  // English selection (prefers en-IN)
  const enVoice = getMatchingBrowserVoice("en", mockVoices);
  assert.ok(enVoice, "English voice should be found");
  assert.strictEqual(enVoice?.lang, "en-IN", "Should prefer Indian English 'en-IN'");

  // Hindi selection
  const hiVoice = getMatchingBrowserVoice("hi", mockVoices);
  assert.ok(hiVoice, "Hindi voice should be found");
  assert.strictEqual(hiVoice?.lang, "hi-IN", "Should find 'hi-IN' voice");

  // Marathi selection
  const mrVoice = getMatchingBrowserVoice("mr", mockVoices);
  assert.ok(mrVoice, "Marathi voice should be found when available");
  assert.strictEqual(mrVoice?.lang, "mr-IN", "Should find 'mr-IN' voice");

  // STRICT GUARDRAIL: When NO Marathi voice exists on device
  const voicesWithoutMarathi = mockVoices.filter((v) => !v.lang.startsWith("mr"));
  const mrNoVoice = getMatchingBrowserVoice("mr", voicesWithoutMarathi);
  assert.strictEqual(
    mrNoVoice,
    null,
    "CRITICAL: Marathi MUST NOT fall back to an English or generic voice when no Marathi voice is installed",
  );
  assert.strictEqual(
    hasMatchingBrowserVoice("mr", voicesWithoutMarathi),
    false,
    "hasMatchingBrowserVoice('mr') must return false without Marathi voice",
  );
  ok("Marathi voice guardrail strictly prevents English/unintelligible voice fallback");

  // English fallback when en-IN is absent (uses en-US)
  const voicesWithOnlyUsEnglish = mockVoices.filter((v) => v.lang === "en-US");
  const enFallbackVoice = getMatchingBrowserVoice("en", voicesWithOnlyUsEnglish);
  assert.ok(enFallbackVoice, "English should fall back to another English voice");
  assert.strictEqual(enFallbackVoice?.lang, "en-US", "Fell back to en-US voice");
  ok("English voice selection correctly resolves regional and intelligible fallbacks");

  // -------------------------------------------------------------
  // Test 3: Concurrency, Cancellation & Stale Response Handling
  // -------------------------------------------------------------
  console.log(
    "\n[Test 3] A model of the player's request rules (it checks these rules, not the VaaniAudioPlayer component)",
  );

  // A model of the player's request rules (the component itself is not rendered here)
  class HybridPlayerSimulator {
    state: "idle" | "generating" | "playing" | "paused" | "unavailable" = "idle";
    activeEngine: "vaani" | "browser" | null = null;
    errorMessage: string | null = null;
    requestId = 0;
    mockAudioPlaying = false;
    mockSpeechSpeaking = false;
    spokenUtterance: { text: string; lang: string } | null = null;

    stop() {
      this.requestId++;
      this.mockAudioPlaying = false;
      this.mockSpeechSpeaking = false;
      this.state = "idle";
      this.activeEngine = null;
    }

    async play(
      text: string,
      lang: Lang,
      mockFetchResult: {
        behavior: "success" | "upstream_500" | "network_error" | "timeout";
        latencyMs: number;
      },
      availableVoices: SpeechSynthesisVoice[] = mockVoices,
    ) {
      this.stop();
      const currentReq = ++this.requestId;
      this.errorMessage = null;

      // Vaani eligible?
      if (isVaaniLanguageSupported(lang)) {
        this.state = "generating";

        try {
          if (mockFetchResult.behavior === "timeout") {
            // Simulated client timeout
            throw new Error("Client timeout after 14s");
          }
          if (mockFetchResult.behavior === "network_error") {
            throw new Error("Failed to fetch");
          }
          if (mockFetchResult.behavior === "upstream_500") {
            throw new Error("HTTP 502 Upstream Error");
          }

          // Latency delay
          await new Promise((r) => setTimeout(r, mockFetchResult.latencyMs));

          // Stale response check!
          if (this.requestId !== currentReq) {
            return; // Stale response discarded!
          }

          // Vaani success
          this.mockAudioPlaying = true;
          this.state = "playing";
          this.activeEngine = "vaani";
          return;
        } catch {
          if (this.requestId !== currentReq) return;
          // Fall back to browser speech!
          this.triggerBrowserSpeech(text, lang, currentReq, availableVoices);
          return;
        }
      }

      // Non-Vaani language (en, mr) -> direct to browser speech
      this.triggerBrowserSpeech(text, lang, currentReq, availableVoices);
    }

    triggerBrowserSpeech(text: string, lang: Lang, reqId: number, voices: SpeechSynthesisVoice[]) {
      if (this.requestId !== reqId) return;

      const voice = getMatchingBrowserVoice(lang, voices);
      if (!voice) {
        this.state = "unavailable";
        this.errorMessage = lang === "mr" ? "Marathi audio unavailable" : "No device voice found";
        this.activeEngine = null;
        return;
      }

      this.mockSpeechSpeaking = true;
      this.state = "playing";
      this.activeEngine = "browser";
      this.spokenUtterance = { text, lang: voice.lang };
    }
  }

  // Case 3a: Hindi Vaani success
  const player = new HybridPlayerSimulator();
  await player.play("नमस्ते", "hi", { behavior: "success", latencyMs: 5 });
  assert.strictEqual(player.state, "playing");
  assert.strictEqual(player.activeEngine, "vaani");
  assert.strictEqual(player.mockAudioPlaying, true);
  assert.strictEqual(player.mockSpeechSpeaking, false);
  ok("Hindi uses Vaani service when successful");

  // Case 3b: English directly uses browser speech (bypasses Vaani)
  await player.play("Hello farmer", "en", { behavior: "success", latencyMs: 0 });
  assert.strictEqual(player.state, "playing");
  assert.strictEqual(player.activeEngine, "browser");
  assert.strictEqual(player.spokenUtterance?.lang, "en-IN");
  ok("English bypasses Vaani and plays via browser speech");

  // Case 3c: Marathi with voice uses browser speech
  await player.play("नमस्कार", "mr", { behavior: "success", latencyMs: 0 });
  assert.strictEqual(player.state, "playing");
  assert.strictEqual(player.activeEngine, "browser");
  assert.strictEqual(player.spokenUtterance?.lang, "mr-IN");
  ok("Marathi with installed voice plays via browser speech");

  // Case 3d: Marathi WITHOUT voice shows clear unavailable state
  await player.play("नमस्कार", "mr", { behavior: "success", latencyMs: 0 }, voicesWithoutMarathi);
  assert.strictEqual(player.state, "unavailable");
  assert.strictEqual(player.activeEngine, null);
  assert.ok(player.errorMessage?.includes("Marathi"));
  ok("Marathi without installed voice shows truthful unavailable notification");

  // Case 3e: Hindi Vaani network failure triggers browser fallback
  await player.play("नमस्ते", "hi", { behavior: "network_error", latencyMs: 5 });
  assert.strictEqual(player.state, "playing");
  assert.strictEqual(player.activeEngine, "browser");
  assert.strictEqual(player.spokenUtterance?.lang, "hi-IN");
  ok("Vaani network error cleanly triggers browser speech fallback");

  // Case 3f: Vaani HTTP 500 triggers browser fallback
  await player.play("नमस्ते", "hi", { behavior: "upstream_500", latencyMs: 5 });
  assert.strictEqual(player.state, "playing");
  assert.strictEqual(player.activeEngine, "browser");
  assert.strictEqual(player.spokenUtterance?.lang, "hi-IN");
  ok("Vaani upstream HTTP 500 cleanly triggers browser speech fallback");

  // Case 3g: Vaani timeout triggers browser fallback
  await player.play("नमस्ते", "hi", { behavior: "timeout", latencyMs: 5 });
  assert.strictEqual(player.state, "playing");
  assert.strictEqual(player.activeEngine, "browser");
  assert.strictEqual(player.spokenUtterance?.lang, "hi-IN");
  ok("Vaani timeout cleanly triggers browser speech fallback");

  // Case 3h: User stops speech during synthesis
  const longPlayer = new HybridPlayerSimulator();
  const playPromise = longPlayer.play("नमस्ते", "hi", { behavior: "success", latencyMs: 50 });
  longPlayer.stop(); // User stops before response arrives
  await playPromise;
  assert.strictEqual(longPlayer.state, "idle");
  assert.strictEqual(longPlayer.mockAudioPlaying, false);
  assert.strictEqual(longPlayer.mockSpeechSpeaking, false);
  ok("Stop button halts synthesis and discards pending audio");

  // Case 3i: Language switch during synthesis
  const switchPlayer = new HybridPlayerSimulator();
  const req1 = switchPlayer.play("नमस्ते", "hi", { behavior: "success", latencyMs: 40 });
  await switchPlayer.play("Hello farmer", "en", { behavior: "success", latencyMs: 0 });
  await req1;
  assert.strictEqual(switchPlayer.activeEngine, "browser");
  assert.strictEqual(switchPlayer.spokenUtterance?.lang, "en-IN");
  ok("Language switch supersedes prior pending synthesis without audio collision");

  // Case 3j: Repeated Play clicks do not create duplicate speech
  const rapidPlayer = new HybridPlayerSimulator();
  rapidPlayer.play("One", "en", { behavior: "success", latencyMs: 0 });
  rapidPlayer.play("Two", "en", { behavior: "success", latencyMs: 0 });
  await rapidPlayer.play("Three", "en", { behavior: "success", latencyMs: 0 });
  assert.strictEqual(rapidPlayer.spokenUtterance?.text, "Three");
  assert.strictEqual(rapidPlayer.state, "playing");
  ok(
    "Plays started one after another: only the last one's words are spoken (a second tap on a playing card pauses it, which this model does not cover)",
  );

  console.log("\n==================================================================");
  console.log(`✓ ${passed} checks passed (Test 3 checks a model of the player, not the component)`);
  console.log("==================================================================\n");
}

runHybridTtsTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
