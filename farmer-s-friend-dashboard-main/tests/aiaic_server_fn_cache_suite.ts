/**
 * No browser or proxy keeps her records (Round 2, push 1, the audit's AP4-05; the owner's default of 12 Nov 2026).
 * Run: `npx tsx tests/aiaic_server_fn_cache_suite.ts` (AIAIC_TEST_JUNIT=<file.xml> also writes a JUnit file).
 *
 * - A server function's answer (her sale, her money, her sharing) goes out with `Cache-Control: no-store`, whatever it
 *   said before, error answers too, with its status, words and other headers unchanged.
 * - Pages and the app's own files keep their headers: a phone still keeps the app's files.
 * - A path that only looks like the base is not one.
 * - The base is TanStack Start's own: `vite.config.ts` sets no server-function base and no router basepath.
 * - `src/server.ts` passes every answer of its handler through the rule.
 *
 * Her built server's real answers are read by the walk (the header on a GET of her sharing).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    for (const p of ["/_serverFnX/abc", "/x/_serverFn/abc", "/_serverfn/abc", "/_serverFn"]) {
      equal(isServerFnPath(p), false, p);
    }
    equal(isServerFnPath(`${SERVER_FN_BASE}abc`), true, "the base itself");
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
