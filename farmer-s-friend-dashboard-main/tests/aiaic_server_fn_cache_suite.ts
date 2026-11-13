/**
 * No browser or proxy keeps her records (Round 2, push 1, the audit's AP4-05; the owner's default of 12 Nov 2026).
 * Run: `npx tsx tests/aiaic_server_fn_cache_suite.ts` (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file).
 *
 * - A server function's answer (her sale, her money, her sharing) goes out with `Cache-Control: no-store`, whatever it
 *   said before, error answers too, with its status, words and other headers unchanged.
 * - Her cookies go out one by one (two Set-Cookie headers, a comma in one's Expires); an answer with no body goes with
 *   none, and a streamed answer stays a stream (R2-4's VFX2-2).
 * - Pages and the app's own files keep their headers: a phone still keeps the app's files.
 * - A path that only looks like the base is not one.
 * - The path is read as TanStack Start reads it (decoded), so `/%5FserverFn/<id>` gets no-store too; on a sweep of paths
 *   the rule says a server function exactly when Start's own `getNormalizedURL` routes one (R2-4's VFX2-3).
 * - The base is TanStack Start's own: `vite.config.ts` sets no server-function base and no router basepath.
 * - `src/server.ts` passes every answer of its handler through the rule.
 *
 * Her built server's real answers are read by the walk (the header on a GET of her sharing).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// TanStack Start's own reading of a request's URL (createStartHandler routes by it), from router-core's public export
import { getNormalizedURL } from "@tanstack/router-core/ssr/server";

import {
  SERVER_FN_BASE,
  isServerFnPath,
  withNoStoreForServerFns,
} from "../src/lib/server-fn-cache";

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const started = Date.now();
const results: { name: string; ok: boolean; ms: number; error?: string }[] = [];
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, ms: Date.now() - t0, error: message });
    console.log(`FAIL ${name}: ${message}`);
  }
}
function equal<T>(got: T, want: T, what: string): void {
  if (got !== want)
    throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

function answer(body: string | null, status: number, headers: Record<string, string>): Response {
  return new Response(body, {
    status,
    statusText: status === 200 ? "OK" : "Server Error",
    headers,
  });
}

async function main(): Promise<void> {
  await test("a server function's answer is kept by no one, and is otherwise unchanged", async () => {
    const before = answer('{"held_as":"Asha"}', 200, {
      "content-type": "application/json",
      "x-request-id": "r1",
    });
    const after = withNoStoreForServerFns(`${SERVER_FN_BASE}abc123`, before);
    equal(after.headers.get("cache-control"), "no-store", "cache-control");
    equal(after.status, 200, "status");
    equal(after.statusText, "OK", "status text");
    equal(after.headers.get("content-type"), "application/json", "content-type");
    equal(after.headers.get("x-request-id"), "r1", "another header");
    equal(await after.text(), '{"held_as":"Asha"}', "the words");
  });

  await test("a server function's own caching is replaced by no-store", () => {
    const before = answer("{}", 200, { "cache-control": "public, max-age=600" });
    equal(
      withNoStoreForServerFns(`${SERVER_FN_BASE}getMySharing`, before).headers.get("cache-control"),
      "no-store",
      "cache-control",
    );
  });

  await test("a server function's error answer is kept by no one either, its status kept", () => {
    const after = withNoStoreForServerFns(`${SERVER_FN_BASE}x`, answer('{"ok":false}', 500, {}));
    equal(after.headers.get("cache-control"), "no-store", "cache-control");
    equal(after.status, 500, "status");
  });

  // HER COOKIES GO THROUGH THE RULE WHOLE (R2-4's VFX2-2): her identity module sets her session, her device id and its
  // note on a server function's answer (aiaic-identity.server.ts, through h3's setCookie), so two Set-Cookie headers can
  // ride on one answer. Each must go out as its own header: a cookie's Expires holds a comma, so two joined into one
  // header are not two cookies again. The values are stand-ins, no one's.
  await test("her two cookies go out one by one after the rule: two Set-Cookie headers, one with a comma in its Expires, each whole", async () => {
    const cookies = [
      "aiaic_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax",
      "aiaic_note=signed_out; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax",
    ];
    const headers = new Headers({ "content-type": "application/json", "x-tss-serialized": "true" });
    for (const cookie of cookies) headers.append("set-cookie", cookie);
    const after = withNoStoreForServerFns(
      `${SERVER_FN_BASE}abc123`,
      new Response('{"ok":true}', { status: 200, headers }),
    );
    equal(
      JSON.stringify(after.headers.getSetCookie()),
      JSON.stringify(cookies),
      "her cookies, one header each, as they were set",
    );
    equal(after.headers.get("cache-control"), "no-store", "cache-control");
    equal(after.headers.get("x-tss-serialized"), "true", "Start's own header");
    equal(await after.text(), '{"ok":true}', "the words");
  });

  await test("a server function's answer with no body (204) goes out with none, its status kept, kept by no one", () => {
    const after = withNoStoreForServerFns(
      `${SERVER_FN_BASE}x`,
      new Response(null, { status: 204 }),
    );
    equal(after.status, 204, "status");
    equal(after.body, null, "no body");
    equal(after.headers.get("cache-control"), "no-store", "cache-control");
  });

  await test("a server function's streamed answer stays a stream: its first part is handed on before its second is written", async () => {
    const source: { push: ReadableStreamDefaultController<Uint8Array> | null } = { push: null };
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        source.push = controller;
      },
    });
    const after = withNoStoreForServerFns(
      `${SERVER_FN_BASE}x`,
      new Response(stream, {
        status: 200,
        headers: { "content-type": "application/x-tss-framed" },
      }),
    );
    equal(after.headers.get("cache-control"), "no-store", "cache-control");
    const reader = after.body?.getReader();
    const push = source.push;
    if (!reader || !push) throw new Error("the answer holds no stream");
    const bytes = new TextEncoder();
    const text = new TextDecoder();
    push.enqueue(bytes.encode("part 1"));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const first = await Promise.race([
      reader.read(),
      new Promise<"held">((done) => {
        timer = setTimeout(() => done("held"), 2000);
      }),
    ]);
    clearTimeout(timer);
    if (first === "held")
      throw new Error(
        "the first part was held back until the stream ends: the answer is no stream",
      );
    equal(text.decode(first.value), "part 1", "the first part, as it was written");
    push.enqueue(bytes.encode("part 2"));
    push.close();
    const second = await reader.read();
    equal(text.decode(second.value), "part 2", "the second part");
    equal((await reader.read()).done, true, "then the end");
  });

  await test("pages keep their own headers", () => {
    for (const page of ["/", "/sell", "/sharing", "/money"]) {
      const before = answer("<html></html>", 200, {
        "content-type": "text/html",
        "cache-control": "private, max-age=0",
      });
      const after = withNoStoreForServerFns(page, before);
      equal(after, before, `${page}: the same answer`);
      equal(after.headers.get("cache-control"), "private, max-age=0", `${page}: cache-control`);
    }
  });

  await test("the app's own files keep theirs: a phone still keeps them", () => {
    const before = answer("js", 200, { "cache-control": "public, max-age=31536000, immutable" });
    const after = withNoStoreForServerFns("/assets/index-3f2a.js", before);
    equal(after, before, "the same answer");
    equal(
      after.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
      "cache-control",
    );
  });

  await test("a path that only looks like the base is not one", () => {
    for (const p of [
      "/_serverFnX/abc",
      "/x/_serverFn/abc",
      "/_serverfn/abc",
      "/_serverFn",
      // the same, escaped (R2-4's VFX2-3): read as TanStack Start reads them, still not the base
      "/%5FserverFnX/abc",
      "/x/%5FserverFn/abc",
      "/%5Fserverfn/abc",
      "/%5FserverFn",
      "/%255FserverFn/abc", // an escaped percent sign: decoded once, never into the base
      "/%5FserverFn%2Fabc", // an escaped slash: Start keeps it escaped, and the base ends in a slash of its own
      "/%5FserverFn%/abc", // a malformed escape inside the base
      "/%5C_serverFn/abc", // an escaped backslash: Start keeps it escaped
      "//_serverFn/abc", // a doubled slash: Start answers it with a redirect, never as a server function
    ]) {
      equal(isServerFnPath(p), false, p);
    }
    equal(isServerFnPath(`${SERVER_FN_BASE}abc`), true, "the base itself");
  });

  // THE PATH AS TANSTACK START READS IT (R2-4's VFX2-3): Start decodes a request's path before it routes it
  // (`getNormalizedURL`), so an escaped base is served as a server function, and its answer is kept by no one either.
  await test("a server function's path as TanStack Start reads it gets no-store too: the base escaped, in capitals or not, a letter of it escaped, and a malformed escape after the function's id", () => {
    for (const p of [
      "/%5FserverFn/abc123",
      "/%5fserverFn/abc123",
      "/%5F%73erverFn/abc123",
      "/_serverFn/abc123/%",
      "/%5FserverFn/abc123/%",
      "/%5FserverFn/abc123/%E0%A4",
    ]) {
      equal(isServerFnPath(p), true, p);
      const before = answer("{}", 200, { "cache-control": "public, max-age=600" });
      equal(
        withNoStoreForServerFns(p, before).headers.get("cache-control"),
        "no-store",
        `${p}: cache-control`,
      );
    }
  });

  await test("a malformed escape in a page's path never throws: the page keeps its own answer", () => {
    for (const page of ["/sell/%", "/listing/%E0%A4", "/%ZZ"]) {
      const before = answer("<html></html>", 200, { "cache-control": "private, max-age=0" });
      equal(withNoStoreForServerFns(page, before), before, `${page}: the same answer`);
    }
  });

  await test("the rule says a server function exactly when TanStack Start serves one: each path of a sweep, read as her server reads it and as Start's own getNormalizedURL reads it", () => {
    const paths: string[] = [];
    for (const head of ["/", "//", "/x/"])
      for (const under of ["_", "%5F", "%5f", "%255F", "%5C_", ""])
        for (const s of ["s", "%73", "S"])
          for (const rest of ["erverFn", "erverfn", "erverFnX"])
            for (const slash of ["/", "%2F", "", "%/"])
              for (const tail of ["abc123", "abc123/%", "abc123/%E0%A4", "%ZZ", ""])
                paths.push(`${head}${under}${s}${rest}${slash}${tail}`);
    let served = 0;
    const wrong: string[] = [];
    for (const p of paths) {
      const requestUrl = new Request(`http://localhost${p}`).url;
      // createStartHandler: a doubled slash is answered with a redirect; else a path under the base is a server function
      const start = getNormalizedURL(requestUrl);
      const startServes =
        !start.handledProtocolRelativeURL && start.url.pathname.startsWith(SERVER_FN_BASE);
      if (startServes) served += 1;
      const ours = isServerFnPath(new URL(requestUrl).pathname);
      if (ours !== startServes) wrong.push(`${p}: the rule ${ours}, Start ${startServes}`);
    }
    equal(
      wrong.slice(0, 5).join("; "),
      "",
      `paths the rule reads otherwise than Start (${wrong.length} of ${paths.length})`,
    );
    equal(
      served > 0 && served < paths.length,
      true,
      `the sweep holds both kinds (${served} of ${paths.length} served as server functions)`,
    );
  });

  await test("the base is TanStack Start's own: the Vite config sets no server-function base or basepath", () => {
    equal(SERVER_FN_BASE, "/_serverFn/", "start-plugin-core's default base");
    const config = fs.readFileSync(path.join(APP, "vite.config.ts"), "utf-8");
    for (const word of ["serverFns", "serverFnBase", "basepath", "base:"]) {
      equal(
        config.includes(word),
        false,
        `vite.config.ts names ${word}: the base may have moved, so update SERVER_FN_BASE`,
      );
    }
  });

  await test("src/server.ts passes every answer of its handler through the rule", () => {
    const server = fs.readFileSync(path.join(APP, "src", "server.ts"), "utf-8");
    equal(server.includes('from "./lib/server-fn-cache"'), true, "server.ts imports the rule");
    equal(
      /withNoStoreForServerFns\(\s*url\.pathname,\s*await normalizeCatastrophicSsrResponse\(response\)\s*,?\s*\)/.test(
        server,
      ),
      true,
      "server.ts sends the handler's answer through withNoStoreForServerFns",
    );
  });

  const junit = process.env["AIAIC_TEST_JUNIT"];
  if (junit) {
    const xml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const cases = results
      .map(
        (r) =>
          `  <testcase classname="aiaic_server_fn_cache_suite" name="${xml(r.name)}" time="${(r.ms / 1000).toFixed(3)}">` +
          (r.ok ? "" : `<failure message="failed">${xml(r.error ?? "")}</failure>`) +
          "</testcase>",
      )
      .join("\n");
    fs.writeFileSync(
      junit,
      `<?xml version="1.0" encoding="utf-8"?>\n<testsuite name="aiaic_server_fn_cache_suite" tests="${results.length}" failures="${failed}" errors="0" skipped="0" timestamp="${new Date(started).toISOString()}" time="${((Date.now() - started) / 1000).toFixed(3)}">\n${cases}\n</testsuite>\n`,
      "utf-8",
    );
  }
  console.log(`${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

void main();
