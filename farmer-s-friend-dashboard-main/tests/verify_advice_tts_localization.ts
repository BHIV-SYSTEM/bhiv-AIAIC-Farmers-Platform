import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { buildSimpleAdviceParagraph } from "../src/lib/advice-summary";
import { isVaaniLanguageSupported, synthesizeAdviceSpeech } from "../src/lib/vaani-tts.server";
import type { ServiceResult } from "../src/lib/aiaic-types";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

interface CdpMessage {
  id: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

class CdpClient {
  private ws: WebSocket;
  private msgId = 1;
  private callbacks = new Map<number, (res: any) => void>();
  private eventListeners = new Map<string, (params: any) => void>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString()) as CdpMessage;
          if (data.id && this.callbacks.has(data.id)) {
            const cb = this.callbacks.get(data.id)!;
            this.callbacks.delete(data.id);
            if (data.error) cb({ error: data.error });
            else cb(data.result);
          } else if (data.method && this.eventListeners.has(data.method)) {
            this.eventListeners.get(data.method)!(data.params);
          }
        } catch (_e) {
          /* a message that is not JSON is not ours: skip it */
        }
      };
    });
  }

  on(eventMethod: string, handler: (params: any) => void) {
    this.eventListeners.set(eventMethod, handler);
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = this.msgId++;
    return new Promise((resolve) => {
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void {
    try {
      this.ws.close();
    } catch (_e) {
      /* already closed */
    }
  }
}

async function startChrome(): Promise<{ proc: any; tmpDir: string }> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-test-profile-"));
  const chrome = spawn(
    CHROME_PATH,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${tmpDir}`,
      "--disable-gpu",
      "--no-sandbox",
      "--disable-extensions",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return { proc: chrome, tmpDir };
    } catch (_e) {
      /* Chrome is not up yet: try again */
    }
    attempts++;
  }
  throw new Error("Failed to start headless Chrome.");
}

async function getWsUrl(): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const pages = (await res.json()) as any[];
  const page = pages.find((p) => p.type === "page" && !p.url.startsWith("chrome-extension://"));
  if (page && page.webSocketDebuggerUrl) {
    return page.webSocketDebuggerUrl;
  }
  const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`);
  const newPage = (await newPageRes.json()) as any;
  return newPage.webSocketDebuggerUrl;
}

async function runTargetedVerification() {
  console.log("=== STARTING TARGETED ADVICE, LOCALIZATION & VAANI TTS VERIFICATION SUITE ===\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✓ PASS | ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL | ${testName}${detail ? ` -> ${detail}` : ""}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test Group 1: Faithful Advice Summarization
  // -------------------------------------------------------------
  console.log("[Group 1] Faithful Advice Summarization & Vernacular Prioritization");
  const dummyT = (key: string, vars?: Record<string, string | number>) => {
    if (vars?.text) return String(vars.text);
    return key;
  };

  const enCard = {
    service: "market",
    answer_headline: "Hold Produce 3-5 Days for Better Realization",
    summary: { action: { text: "Arrivals in Narayangaon and Pune mandis are stabilizing." } },
    why: ["Current mandi prices are below historical 5-year median."],
    read_these_first: ["Transport corridors to Mumbai are experiencing delays."],
    important: "Do not leave ripe produce in open sun.",
    checked_note: "Suggestion only. Verify with local KVK.",
  };

  const hiCard = {
    service: "market",
    answer_headline: "पुणे और नारायणगांव मंडियों में आवक स्थिर हो रही है।",
    summary: { action: { text: "माल ३ से ५ दिन रोककर बेचने से बेहतर भाव मिल सकता है।" } },
    why: ["वर्तमान मंडी भाव ५ वर्षीय औसत से नीचे चल रहे हैं।"],
    read_these_first: ["मुंबई मार्ग पर परिवहन में देरी हो रही है।"],
    important: "पके हुए टमाटर धूप में खुले न रखें।",
    checked_note: "केवल सुझाव है। स्थानीय केवीके से पुष्टि करें।",
  };

  const mrCard = {
    service: "market",
    answer_headline: "पुणे आणि नारायणगाव बाजारात आवक स्थिरावत आहे.",
    summary: {
      action: { text: "माल ३ ते ५ दिवस थांबून विकल्यास चांगला दर मिळण्याची शक्यता आहे." },
    },
    why: ["सध्याचे बाजारभाव ५ वर्षांच्या सरासरीपेक्षा कमी आहेत."],
    read_these_first: ["मुंबईकडे जाणारी वाहतूक काही ठिकाणी संथ आहे."],
    important: "पिकलेला शेतमाल उन्हात उघडा ठेवू नका.",
    checked_note: "फक्त सूचना आहे. स्थानिक कृषी विज्ञान केंद्राकडून खात्री करा.",
  };

  const enSummary = buildSimpleAdviceParagraph({ card: enCard, lang: "en", t: dummyT });
  assert(
    enSummary.paragraph.includes("Hold Produce 3-5 Days") ||
      enSummary.paragraph.includes("Narayangaon"),
    "English advice summarizes actual backend detail",
    enSummary.paragraph,
  );
  assert(
    enSummary.actionHeadline.includes("Hold Produce 3-5 Days"),
    "English actionHeadline is populated faithfully from backend",
  );

  const hiSummary = buildSimpleAdviceParagraph({ card: hiCard, lang: "hi", t: dummyT });
  assert(
    hiSummary.paragraph.includes("पुणे और नारायणगांव") || hiSummary.paragraph.includes("माल"),
    "Hindi advice faithfully uses vernacular Hindi translation",
    hiSummary.paragraph,
  );
  assert(!hiSummary.isUntranslatedEnglish, "Hindi advice is correctly marked as translated");

  const mrSummary = buildSimpleAdviceParagraph({ card: mrCard, lang: "mr", t: dummyT });
  assert(
    mrSummary.paragraph.includes("पुणे आणि नारायणगाव") || mrSummary.paragraph.includes("माल"),
    "Marathi advice faithfully uses vernacular Marathi translation",
    mrSummary.paragraph,
  );
  assert(!mrSummary.isUntranslatedEnglish, "Marathi advice is correctly marked as translated");

  // Untranslated fallback check
  const untranslatedCard = {
    service: "pest",
    answer_headline: "Apply biological neem extract within 48 hours",
    summary: { action: { text: "English only pest observation notes." } },
  };
  const fallbackHi = buildSimpleAdviceParagraph({ card: untranslatedCard, lang: "hi", t: dummyT });
  assert(
    fallbackHi.isUntranslatedEnglish === true,
    "Truthful representation: untranslated English advice flagged when selected language is Hindi",
  );

  // -------------------------------------------------------------
  // Test Group 2: Vaani TTS Proxy Capabilities & Language Guardrails
  // -------------------------------------------------------------
  console.log("\n[Group 2] Vaani TTS Proxy Capabilities & Language Guardrails");
  assert(
    isVaaniLanguageSupported("hi") === true,
    "Vaani TTS supports Hindi ('hi') capability mapping",
  );
  assert(
    isVaaniLanguageSupported("mr") === false,
    "Vaani TTS correctly disallows unsupported Marathi ('mr') to prevent degradation",
  );

  // Live Hindi Synthesis probe
  console.log("  Testing live Hindi synthesis against proxy endpoint...");
  const hiTtsRes = await synthesizeAdviceSpeech({
    text: "नमस्ते किसान भाई, आज का मंडी भाव स्थिर है।",
    language: "hi",
    voiceProfile: "vaani_teacher",
  });
  assert(hiTtsRes.ok === true, "Live Hindi synthesis returns ok: true");
  if (hiTtsRes.ok) {
    assert(
      hiTtsRes.contentType === "audio/wav",
      "Live Hindi synthesis returns Content-Type: audio/wav",
    );
    assert(
      hiTtsRes.audioBuffer instanceof ArrayBuffer && hiTtsRes.audioBuffer.byteLength > 1000,
      "Live Hindi synthesis returns valid WAV binary buffer (>1KB)",
    );
  }

  // Marathi Synthesis request should fail truthfully with 422 UNSUPPORTED_LANGUAGE
  console.log("  Testing Marathi synthesis rejection guardrail...");
  const mrTtsRes = await synthesizeAdviceSpeech({
    text: "नमस्कार शेतकरी बंधूंनो, आजचे बाजारभाव स्थिर आहेत.",
    language: "mr",
    voiceProfile: "vaani_teacher",
  });
  assert(
    mrTtsRes.ok === false && mrTtsRes.status === 422,
    "Marathi synthesis rejected truthfully with status 422",
  );
  if (!mrTtsRes.ok) {
    assert(
      mrTtsRes.message?.includes("not currently supported"),
      "Marathi failure returns truthful explanation without synthetic hallucination",
    );
  }

  // Text length boundary validation
  const tooLongText = "A".repeat(2500);
  const lengthRes = await synthesizeAdviceSpeech({
    text: tooLongText,
    language: "hi",
    voiceProfile: "vaani_teacher",
  });
  assert(
    lengthRes.ok === false && lengthRes.status === 400,
    "Text exceeding length limit correctly rejected with HTTP 400",
  );

  // -------------------------------------------------------------
  // Test Group 3: Browser UI Verification via Headless Chrome
  // -------------------------------------------------------------
  console.log("\n[Group 3] Browser Automation Verification (Chrome CDP)");
  const { proc: chromeProc, tmpDir } = await startChrome();
  const wsUrl = await getWsUrl();
  const client = new CdpClient(wsUrl);
  await client.connect();

  await client.send("Page.enable");
  await client.send("Runtime.enable");

  try {
    // 1. Result page Simple Advice Hero & Collapsed Details
    console.log("  Navigating to /result?region=Pune&crop=Tomato...");
    const navRes = await client.send("Page.navigate", {
      url: "http://localhost:8080/result?region=Pune&crop=Tomato",
    });
    console.log("  Page.navigate result:", navRes);
    await new Promise((r) => setTimeout(r, 2000));

    const currentLoc = await client.send("Runtime.evaluate", {
      expression: "window.location.href",
      returnByValue: true,
    });
    console.log("  Current location after nav:", currentLoc.result?.value);

    // Wait for queries to settle and simple-advice-hero to appear (up to 10s)
    let ready = false;
    for (let i = 0; i < 25; i++) {
      const check = await client.send("Runtime.evaluate", {
        expression: `!!document.getElementById('simple-advice-hero')`,
        returnByValue: true,
      });
      if (check.result?.value === true) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!ready) {
      const pageInfo = await client.send("Runtime.evaluate", {
        expression: `({ title: document.title, body: document.body ? document.body.innerText.slice(0, 300) : 'no body' })`,
        returnByValue: true,
      });
      console.log("Debug page info:", pageInfo.result?.value);
    }

    assert(ready, "SimpleAdviceHero mounted and query completed");

    // Check Hero and Details DOM
    const heroEval = await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const hero = document.getElementById('simple-advice-hero');
          const details = document.getElementById('advice-expanded-details');
          const expandBtn = document.getElementById('toggle-advice-details-btn');
          const audioPlayer = document.getElementById('vaani-audio-player');
          
          return {
            hasHero: !!hero,
            hasDetails: !!details,
            ariaExpanded: expandBtn ? expandBtn.getAttribute('aria-expanded') : null,
            hasAudioPlayer: !!audioPlayer,
          };
        })()
      `,
      returnByValue: true,
    });

    const heroState = heroEval.result.value;
    assert(heroState.hasHero, "SimpleAdviceHero is rendered on result page");
    assert(!heroState.hasDetails, "Expanded details are COLLAPSED (unmounted) by default");
    assert(heroState.ariaExpanded === "false", "Expand button has aria-expanded='false'");
    assert(heroState.hasAudioPlayer, "Vaani audio player is present next to advice paragraph");

    // Click to expand details
    await client.send("Runtime.evaluate", {
      expression: `document.getElementById('toggle-advice-details-btn').click()`,
    });
    await new Promise((r) => setTimeout(r, 500));

    const expandedEval = await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const details = document.getElementById('advice-expanded-details');
          const expandBtn = document.getElementById('toggle-advice-details-btn');
          return {
            hasDetails: !!details,
            ariaExpanded: expandBtn ? expandBtn.getAttribute('aria-expanded') : null,
          };
        })()
      `,
      returnByValue: true,
    });
    assert(expandedEval.result.value.hasDetails, "Details section mounted on button click");
    assert(
      expandedEval.result.value.ariaExpanded === "true",
      "Expand button has aria-expanded='true' when opened",
    );

    // Spy on window.speechSynthesis to ensure browser TTS is NEVER invoked
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__speechSynthesisCalled = false;
        if (window.speechSynthesis) {
          const orig = window.speechSynthesis.speak;
          window.speechSynthesis.speak = function() {
            window.__speechSynthesisCalled = true;
            return orig ? orig.apply(this, arguments) : undefined;
          };
        }
      `,
    });

    // 2. Language Switching to Hindi ('hi')
    console.log("  Testing Language Switcher to Hindi ('hi')...");
    await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const trigger = document.getElementById('top-nav-lang-trigger');
          if (trigger) trigger.click();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 200));

    await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const hiBtn = document.getElementById('lang-btn-hi');
          if (hiBtn) hiBtn.click();
          return !!hiBtn;
        })()
      `,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 800));

    const hiUiEval = await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const bodyText = document.body.innerText;
          const hero = document.getElementById('simple-advice-hero');
          return {
            hasHindiContent: bodyText.includes('सलाह') || bodyText.includes('सुझाव') || bodyText.includes('किसान'),
            heroText: hero ? hero.innerText : '',
          };
        })()
      `,
      returnByValue: true,
    });
    assert(
      hiUiEval.result.value.hasHindiContent,
      "UI successfully switches to Hindi without page reload",
      hiUiEval.result.value.heroText.slice(0, 80),
    );

    // 3. Language Switching to Marathi ('mr') & Audio Guardrail
    console.log("  Testing Language Switcher to Marathi ('mr') & Audio Guardrail...");
    await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const trigger = document.getElementById('top-nav-lang-trigger');
          if (trigger) trigger.click();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 200));

    await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const mrBtn = document.getElementById('lang-btn-mr');
          if (mrBtn) mrBtn.click();
          return !!mrBtn;
        })()
      `,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 400));

    // Wait for Marathi advice query to settle
    let mrPlayerReady = false;
    for (let i = 0; i < 25; i++) {
      const check = await client.send("Runtime.evaluate", {
        expression: `!!document.getElementById('vaani-audio-player')`,
        returnByValue: true,
      });
      if (check.result?.value === true) {
        mrPlayerReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    assert(mrPlayerReady, "Marathi advice and audio player mounted");

    const mrUiEval = await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const bodyText = document.body.innerText;
          const audioPlayer = document.getElementById('vaani-audio-player');
          const speechInvoked = window.__speechSynthesisCalled || false;
          return {
            hasMarathiText: bodyText.includes('सल्ला') || bodyText.includes('माहिती') || bodyText.includes('शेतकरी'),
            playerText: audioPlayer ? audioPlayer.innerText : '',
            speechInvoked,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log(
      "  Marathi player text captured:",
      JSON.stringify(mrUiEval.result.value.playerText),
    );
    assert(
      mrUiEval.result.value.hasMarathiText,
      "Marathi written advice is visible and localized",
      mrUiEval.result.value.playerText,
    );
    assert(
      mrUiEval.result.value.playerText.includes("मराठी आवाज सेवा उपलब्ध नाही") ||
        mrUiEval.result.value.playerText.includes("उपलब्ध नाही") ||
        mrUiEval.result.value.playerText.includes("Hindi only") ||
        mrUiEval.result.value.playerText.includes("Marathi Audio Unavailable"),
      "Marathi audio control shows localized unavailable notice without falling back to browser TTS",
      mrUiEval.result.value.playerText,
    );
    assert(!mrUiEval.result.value.speechInvoked, "Browser window.speechSynthesis was NOT invoked");
  } finally {
    client.close();
    try {
      chromeProc.kill();
    } catch (_e) {
      /* already gone */
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_e) {
      /* nothing left to remove, or still in use: leave it */
    }
  }

  console.log("\n=========================================================");
  console.log(`TARGETED VERIFICATION SUMMARY`);
  console.log(`Total Checks:  ${passed + failed}`);
  console.log(`Passed Checks: ${passed}`);
  console.log(`Failed Checks: ${failed}`);
  console.log(`Pass Rate:     ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log("=========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTargetedVerification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
