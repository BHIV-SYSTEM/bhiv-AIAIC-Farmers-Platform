import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

async function handleTtsApiRoute(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/tts/health") {
    const { getVaaniServerConfig, VAANI_VERIFIED_LANGUAGES } =
      await import("./lib/vaani-tts.server");
    const { baseUrl, hasApiKey } = getVaaniServerConfig();
    return new Response(
      JSON.stringify({
        ok: true,
        service: "Vaani TTS Proxy",
        configuredBaseUrl: baseUrl,
        hasApiKeyConfigured: hasApiKey,
        verifiedLanguages: VAANI_VERIFIED_LANGUAGES,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  if (request.method !== "POST" && request.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    let payload: any = {};
    if (request.method === "POST") {
      payload = await request.json().catch(() => ({}));
    } else {
      payload = {
        text: url.searchParams.get("text") || "",
        language: url.searchParams.get("language") || url.searchParams.get("lang") || "hi",
        voiceProfile:
          url.searchParams.get("voiceProfile") ||
          url.searchParams.get("voice_profile") ||
          "vaani_teacher",
      };
    }

    const { synthesizeAdviceSpeech } = await import("./lib/vaani-tts.server");
    const result = await synthesizeAdviceSpeech(payload);

    if (!result.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: result.code,
          message: result.message,
          details: result.details,
        }),
        {
          status: result.status,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const headers: Record<string, string> = {
      "content-type": result.contentType || "audio/wav",
      "cache-control": "no-store, no-cache, must-revalidate",
    };
    if (result.engine) headers["x-tts-engine"] = result.engine;
    if (result.durationSeconds) headers["x-tts-duration-seconds"] = result.durationSeconds;

    return new Response(result.audioBuffer, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        code: "SERVER_ERROR",
        message: err?.message || "Internal server error during audio proxying",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/api/tts" || url.pathname === "/api/tts/health") {
      return handleTtsApiRoute(request);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
