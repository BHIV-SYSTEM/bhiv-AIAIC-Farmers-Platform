/**
 * AFTER A DEPLOY, AN OLD SERVER FUNCTION IS SAID, AND THE PAGE OPENS THE NEW VERSION ONCE (push 2b-2, lane AN, item 3;
 * the VM report of 23 Nov 2026: "Server function info not found").
 *
 * - WHY IT HAPPENS. TanStack Start names each server function `sha256("<file>--<export>_createServerFn_handler")` when it
 *   builds (start-plugin-core's `generateFunctionId`): the same in every build, until a function is renamed, moved to
 *   another file or removed (her deploy of 19 Nov removed two). A tab opened before such a deploy still holds the old
 *   name; the new server's resolver throws "Server function info not found for <id>" before the function's own handler.
 * - THE SERVER says it apart (`appUpdatedAnswer`, from `errorMiddleware` in `start.ts`): status 410 and one plain word,
 *   where any other failure is the HTML error page. TanStack's own fetcher in the browser throws that word as the
 *   error's message.
 * - THE PAGE (`appUpdatedMiddleware`, every server function call from the browser): the line "The app was updated."
 *   (`AppUpdatedNotice`), then the new version opens by itself ONCE per build per tab (the tab's own `sessionStorage`
 *   remembers the build it reloaded from). It never loops: the same build again, a storage that cannot be read or
 *   written, or text she typed on the page each give a button instead, and her typed text is named as what a reload
 *   clears (a form's typed text is what she loses; her saved farm, her sign-in and her sales are kept elsewhere).
 */
import { createMiddleware } from "@tanstack/react-start";

/** The server's one word for a call to a server function this build does not have (not a key of her words). */
export const APP_UPDATED_MARKER = "annapoorna:app-updated";
export const APP_UPDATED_HEADER = "x-annapoorna-app-updated";
/** TanStack Start's own words when its resolver does not know a server function's id (server-fn-resolver-module.js). */
export const RESOLVER_UNKNOWN = "Server function info not found for ";
/** How long "Opening the new version…" is shown before the page opens it (UNCALIBRATED: long enough to read). */
export const OPENING_SHOWN_MS = 1500;
/** The tab's own mark of the build it reloaded from (`sessionStorage` is the tab's alone). */
export const RELOAD_MARK = "annapoorna:reloaded-from-build";

// --------------------------------------------------------------------------------------------- the server's half

/** True for TanStack Start's throw when a page asks for a server function this build does not have. */
export function isUnknownServerFn(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith(RESOLVER_UNKNOWN);
}

/** The server's log line for it: the id only when it has a build's shape (64 hex), never anything else it was sent. */
export function appUpdatedLogLine(error: Error): string {
  const id = error.message.slice(RESOLVER_UNKNOWN.length);
  const shaped = /^[0-9a-f]{64}(?:_\d{1,3})?$/.test(id);
  return shaped
    ? `[app-updated] a page asked for server function ${id}, which this build does not have (a page from an earlier build)`
    : "[app-updated] a page asked for a server function id no build makes (not a page of this app)";
}

/** The answer a page can tell apart (the browser's fetcher throws its word as the error's message). */
export function appUpdatedAnswer(): Response {
  return new Response(APP_UPDATED_MARKER, {
    status: 410,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      [APP_UPDATED_HEADER]: "1",
    },
  });
}

// ------------------------------------------------------------------------------------------- the browser's half

/** True for the error a server function call threw on the server's app-updated answer. */
export function isAppUpdatedError(error: unknown): boolean {
  return error instanceof Error && error.message === APP_UPDATED_MARKER;
}

type MarkStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };

/**
 * OPEN THE NEW VERSION BY ITSELF, OR OFFER A BUTTON: by itself only once per build per tab, never when she typed text on
 * the page, and never where the tab's storage cannot be read or written (a button there, so it can never loop).
 */
export function reloadOnce(opts: {
  storage: MarkStore | null;
  build: string;
  typed: boolean;
}): "reload" | "press" {
  if (opts.typed || !opts.storage) return "press";
  try {
    if (opts.storage.getItem(RELOAD_MARK) === opts.build) return "press";
    opts.storage.setItem(RELOAD_MARK, opts.build);
    return opts.storage.getItem(RELOAD_MARK) === opts.build ? "reload" : "press";
  } catch {
    return "press";
  }
}

/** What the page says: opening the new version now, or her button (`typed`: what a reload clears is named). */
export type AppUpdatedState = { how: "opening" | "press"; typed: boolean } | null;

let state: AppUpdatedState = null;
const listeners = new Set<(s: AppUpdatedState) => void>();

export function appUpdatedState(): AppUpdatedState {
  return state;
}

export function onAppUpdated(listener: (s: AppUpdatedState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type AppUpdatedEnv = {
  storage: () => MarkStore | null;
  build: string;
  typed: () => boolean;
  reload: () => void;
  later: (run: () => void, ms: number) => void;
};

/** A call met the app-updated answer: decided once per page (several calls failing together decide once), then said. */
export function appUpdated(env: AppUpdatedEnv): void {
  if (state) return;
  const typed = env.typed();
  const how = reloadOnce({ storage: env.storage(), build: env.build, typed });
  state = { how: how === "reload" ? "opening" : "press", typed };
  for (const listener of listeners) listener(state);
  if (how === "reload") env.later(env.reload, OPENING_SHOWN_MS);
}

/** FOR HER SUITES ONLY: forget what this page decided. */
export function resetAppUpdatedForTests(): void {
  state = null;
}

/** A box she types words in (not a tick box, a choice or a button). */
function isTextBox(el: unknown): el is HTMLInputElement | HTMLTextAreaElement {
  if (typeof HTMLTextAreaElement !== "undefined" && el instanceof HTMLTextAreaElement) return true;
  if (typeof HTMLInputElement === "undefined" || !(el instanceof HTMLInputElement)) return false;
  return ["", "text", "search", "tel", "email", "number", "url", "password"].includes(
    el.type.toLowerCase(),
  );
}

let typedSinceLoad = false;
let watching = false;

/** From the page's first paint: notes that she typed in a box (`AppUpdatedNotice` starts it once). */
export function watchTyping(doc: Document): void {
  if (watching) return;
  watching = true;
  doc.addEventListener(
    "input",
    (e) => {
      if (isTextBox(e.target)) typedSinceLoad = true;
    },
    true,
  );
}

/** Whether a reload now would clear text she typed: she typed since the page opened, and a box still holds text. */
export function typedText(doc: Document): boolean {
  if (!typedSinceLoad) return false;
  return Array.from(doc.querySelectorAll("input, textarea")).some(
    (el) => isTextBox(el) && el.value.trim() !== "",
  );
}

/** This build, as the browser loaded it: the address of this file's own built chunk (it changes with each build). */
function thisBuild(): string {
  try {
    return new URL(import.meta.url).pathname;
  } catch {
    return "unknown";
  }
}

function tabStorage(): MarkStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** The browser's own env for `appUpdated`. */
export function browserEnv(): AppUpdatedEnv {
  return {
    storage: tabStorage,
    build: thisBuild(),
    typed: () => typedText(document),
    reload: () => window.location.reload(),
    later: (run, ms) => {
      window.setTimeout(run, ms);
    },
  };
}

/**
 * EVERY SERVER FUNCTION CALL FROM THE BROWSER (`start.ts`'s functionMiddleware): a call that met the app-updated answer
 * says so on the page (`appUpdated`), and the call still fails as it did, so the page's own failure stays honest.
 */
export const appUpdatedMiddleware = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (isAppUpdatedError(error) && typeof window !== "undefined") appUpdated(browserEnv());
      throw error;
    }
  },
);
