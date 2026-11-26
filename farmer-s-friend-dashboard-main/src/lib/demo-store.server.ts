/**
 * THE APP'S OWN DEMO STORE IS FOR DEVELOPMENT ONLY (push 2b-2, lane AN, item 1; the VM report of 23 Nov 2026 and its
 * verdict of 24 Nov). The demo store (`transactions.server.ts`, `data/transactions.json`) holds made-up sales for a
 * developer's own machine. A farmer never meets it: a signed-in farmer's sales are AIAIC's, and a built server without
 * AIAIC's farmer settings says it is not connected to AIAIC's sale service (`tradeMode`).
 *
 * "Development" is decided by the build itself, never by anything read when the server runs:
 * - `vite dev`, the development server: Vite's `import.meta.env.DEV` is true and its `MODE` is "development". Open.
 * - a built server (`vite build`, as the Docker image is built): Vite writes `DEV: false` and `MODE: "production"` into
 *   the bundle when it builds it, so no environment variable, header, cookie or setting read when it runs (the dev
 *   compose file's run-time NODE_ENV included) can change them. Closed, always.
 * - run from source with no Vite at all (her suites, through tsx): there is no `import.meta.env`. Closed, unless a suite
 *   opens it with `demoStoreForTests`, which refuses everywhere else.
 * Both constants are needed: a build made with NODE_ENV=development alone keeps MODE "production", and one made with
 * `--mode development` alone keeps DEV false.
 */

export type BuildKind = "vite_dev" | "built" | "source";

type ViteEnv = { DEV?: unknown; MODE?: unknown };

/** Vite's own constants for this file (written in by Vite when it serves or builds it); none when run from source. */
function viteEnv(): ViteEnv | undefined {
  return import.meta.env as ViteEnv | undefined;
}

/** How this server was made: `vite dev`, a built bundle, or source run without Vite. */
export function buildKind(env: ViteEnv | undefined = viteEnv()): BuildKind {
  if (!env) return "source";
  return env.DEV === true && env.MODE === "development" ? "vite_dev" : "built";
}

/** Opened by a suite run from source (`demoStoreForTests`); read nowhere else. */
let openedForTests = false;

/**
 * FOR HER SUITES ONLY, run from source: open (or close) the demo store as the development server has it. Refused in a
 * built server and under `vite dev` (which needs no opening), so it can never open the store where a farmer could reach
 * it.
 */
export function demoStoreForTests(open: boolean): void {
  if (buildKind() !== "source")
    throw new Error("demoStoreForTests is for the suites run from source only");
  openedForTests = open;
}

/** Whether the demo store may be read or written here: under `vite dev` yes; in a built server never; run from source
 * only once a suite opened it. */
export function demoStoreAllowed(kind: BuildKind = buildKind()): boolean {
  if (kind === "vite_dev") return true;
  if (kind === "source") return openedForTests;
  return false;
}

/** What a refused read or write of the demo store throws (it reaches the log, never a farmer's page). */
export const DEMO_STORE_CLOSED = "demo_store_closed: the app's demo store is for development only";

/** The first line of every read and write of the demo store: outside development it throws, before any file is touched. */
export function refuseUnlessDemoStoreAllowed(): void {
  if (!demoStoreAllowed()) throw new Error(DEMO_STORE_CLOSED);
}
