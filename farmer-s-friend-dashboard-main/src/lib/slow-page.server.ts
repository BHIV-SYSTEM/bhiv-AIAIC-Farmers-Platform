/**
 * A SLOW PAGE IS LOGGED, PATH ONLY (push 2b-2, lane AN, item 4; the VM report of 23 Nov 2026 saw "SSR stream exceeded
 * 120 s", TanStack's own warning when a page's stream stays open 120 s).
 *
 * Every request her server answers (`src/server.ts`) runs with a note: its route, when it began, and each call her server
 * made to another server for it (`outside-call.server.ts` writes them). When the answer's body has ended (a page's
 * stream included), a request slower than `SLOW_PAGE_MS` logs ONE line: its route, how long until the answer began and
 * until its body ended, and its slowest outside call.
 *
 * What a line never holds: a query string (a server function's GET carries its data there, the speech route its text),
 * a token or header, or a person's detail: every part of a path that is not a plain word (an id, a number, a name) is
 * written `:id`, and a server function is named by its name in her code, never by what it was sent.
 */
import { AsyncLocalStorage } from "node:async_hooks";

/** UNCALIBRATED (lane AN, 27 Nov 2026): longer than a page of hers takes when AIAIC answers (a few seconds), shorter
 *  than the shortest time limit of her calls to AIAIC (10 s) and far under TanStack's 120 s stream lifetime. */
export const SLOW_PAGE_MS = 8_000;

export type CallOutcome = "answered" | "timed_out" | "unreachable";

export type CallNote = {
  service: string;
  /** Path only, written by `pathForLog`. */
  path: string;
  ms: number;
  outcome: CallOutcome;
  status: number | null;
  /** Joined a call already running for the same read (item 5), so it waited rather than called. */
  shared: boolean;
};

type RequestNote = { route: string; method: string; started: number; calls: CallNote[] };

const notes = new AsyncLocalStorage<RequestNote>();
/** A request's calls noted at most (a page makes a handful). */
const MOST_CALLS = 40;
/** Plain words of a path that are kept as they are: letters and hyphens, short, not a run of hex letters. */
const PLAIN = /^[a-z]+(?:-[a-z]+)*$/;
const KEPT_AS_IS = new Set(["v1"]);

/** A path as a log line may hold it: its plain words kept, every other part (an id, a number, a name) written `:id`. */
export function pathForLog(pathname: string): string {
  return pathname
    .split("/")
    .map((part) =>
      part === "" ||
      KEPT_AS_IS.has(part) ||
      (PLAIN.test(part) && part.length <= 24 && !/^[a-f]{8,}$/.test(part))
        ? part
        : ":id",
    )
    .join("/");
}

/** A request's route as the line names it: a server function's path is `/_serverFn/<id>` until its name is known. */
function routeOf(pathname: string): string {
  if (pathname.startsWith("/_serverFn/")) return "/_serverFn/:id";
  return pathForLog(pathname);
}

/** An outside call of the request running now (none outside a request: the suites call the clients directly). */
export function noteCall(call: CallNote): void {
  const note = notes.getStore();
  if (note && note.calls.length < MOST_CALLS) note.calls.push(call);
}

/** The server function this request runs, by its name in her code (`start.ts`'s function middleware). */
export function nameServerFn(name: unknown): void {
  const note = notes.getStore();
  if (note && typeof name === "string" && /^[A-Za-z0-9_]{1,80}$/.test(name))
    note.route = `serverFn ${name}`;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** The one line a slow request logs. */
export function slowLine(
  note: { route: string; method: string; calls: CallNote[] },
  totalMs: number,
  answeredMs: number,
  ended: string,
): string {
  const timedOut = note.calls.filter((c) => c.outcome === "timed_out").length;
  const slowest = [...note.calls].sort((a, b) => b.ms - a.ms)[0];
  const calls = `outside calls ${note.calls.length}${timedOut ? ` (${timedOut} timed out)` : ""}`;
  const worst = slowest
    ? `; slowest: ${slowest.service} ${slowest.path} ${seconds(slowest.ms)} ${slowest.outcome.replace("_", " ")}${slowest.status ? ` ${slowest.status}` : ""}${slowest.shared ? " (shared)" : ""}`
    : "";
  return `[slow-page] ${note.method} ${note.route} ${seconds(totalMs)} (answer began ${seconds(answeredMs)}, body ${ended}); ${calls}${worst}`;
}

type Ended = "done" | "error" | "cancelled" | "empty";

/** The answer's body as it was, chunk by chunk as it comes (a stream stays a stream), with its end noted once. */
function watchedBody(
  body: ReadableStream<Uint8Array>,
  ended: (how: Ended) => void,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let over = false;
  const end = (how: Ended) => {
    if (over) return;
    over = true;
    ended(how);
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          end("done");
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
        end("error");
      }
    },
    cancel(reason) {
      end("cancelled");
      return reader.cancel(reason);
    },
  });
}

/**
 * ONE REQUEST, TIMED (`src/server.ts`): `run` answers it with a note its outside calls write to; once the answer's body
 * has ended, a request slower than `slowMs` logs its one line.
 */
export async function timedRequest(
  request: Request,
  run: () => Promise<Response>,
  opts: { slowMs?: number; log?: (line: string) => void; now?: () => number } = {},
): Promise<Response> {
  const slowMs = opts.slowMs ?? SLOW_PAGE_MS;
  const log = opts.log ?? ((line: string) => console.warn(line));
  const now = opts.now ?? Date.now;
  const note: RequestNote = {
    route: routeOf(new URL(request.url).pathname),
    method: request.method,
    started: now(),
    calls: [],
  };
  const answer = await notes.run(note, run);
  const answeredMs = now() - note.started;
  const ended = (how: Ended) => {
    const totalMs = now() - note.started;
    if (totalMs >= slowMs) log(slowLine(note, totalMs, answeredMs, how));
  };
  if (!answer.body) {
    ended("empty");
    return answer;
  }
  return new Response(watchedBody(answer.body, ended), {
    status: answer.status,
    statusText: answer.statusText,
    headers: answer.headers,
  });
}
