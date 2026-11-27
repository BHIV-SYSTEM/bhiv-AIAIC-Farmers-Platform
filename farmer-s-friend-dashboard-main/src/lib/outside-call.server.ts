/**
 * EVERY CALL HER SERVER MAKES TO ANOTHER SERVER GOES THROUGH HERE (push 2b-2, lane AN, item 4): AIAIC (its sale,
 * payment, transport, storage, places, catalogue, account, Help and advice routes), the plant check and Vaani's speech.
 *
 * - ONE TIME LIMIT OVER THE WHOLE CALL, its answer's body included: the body is read here, whole, under the limit, and
 *   handed back in a Response of its own. Before, a body still coming when the limit passed could throw outside a
 *   caller's try (`aiaic-trade.server.ts`, `aiaic.functions.ts`): a failure the page could not say.
 * - A CALL PAST ITS LIMIT throws `OutsideCallTimeout`, named "TimeoutError" as `AbortSignal.timeout`'s own is, so each
 *   caller says it as its failure in her words (the sale path: `aiaic_timed_out`; the others: their "not answering").
 *   Any other failure is thrown as it was (the caller's "not reachable").
 * - EACH CALL IS NOTED for the slow-page line (`slow-page.server.ts`): its service, its path (no query string, ids
 *   written `:id`), its time and how it ended.
 * - IDENTICAL READS AT THE SAME MOMENT SHARE ONE CALL (lane AN, item 5): a GET asked with `share`, while the very same
 *   GET is still running, waits for that call's answer instead of making its own. "The very same" is the service, the
 *   method, the whole address with its query, and EVERY header it is sent with (her token, the device's id, the
 *   farmer app's key and the visitor's address among them), so two farmers or two devices never share an answer. Its
 *   failure reaches every caller sharing it; a write (anything but a GET, or a call with a body) never shares; nothing
 *   is kept once the call has ended (the next identical read calls again). Each caller keeps its own time limit.
 *   What it saves depends on the farmer app's key (lane AN's fix round, AN-06). Without the key, the public reads
 *   (catalogue, places, pricing) carry no visitor's detail, so identical ones from different visitors share. With the
 *   key and an AIAIC address it may travel to (https, or this machine's private network: `signInAllowed`), every call
 *   carries the visitor's address (`aiaicHeaders`), so identical reads share only within one visitor's address:
 *   AIAIC's limit for one address must never reach another visitor. Then the relief comes mainly from the number AIAIC
 *   itself allows her server (AIAIC's `AIAIC_INFLIGHT_SERVERS`).
 */
import { createHash } from "node:crypto";

import { noteCall, pathForLog, type CallOutcome } from "./slow-page.server";

export type Service = "aiaic" | "plant" | "vaani";

/** A call that ran past its time limit. Its name is `AbortSignal.timeout`'s own, so a caller's check reads it. */
export class OutsideCallTimeout extends Error {
  override name = "TimeoutError";
  constructor(service: Service, limitMs: number) {
    super(`the ${service} call took longer than its ${limitMs} ms`);
  }
}

/** True for a call that ran past its time limit. */
export function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

export type OutsideInit = {
  method?: "GET" | "POST" | "DELETE";
  headers?: Record<string, string>;
  body?: BodyInit;
  /** The call's time limit, over all of it (required: no call goes without one). */
  limitMs: number;
  /** A read that may share a running identical call (item 5); ignored for anything but a GET without a body. */
  share?: boolean;
};

/** An answer as read, whole: what each caller sharing it gets a Response of its own from. */
type Answer = {
  status: number;
  statusText: string;
  headers: [string, string][];
  bytes: ArrayBuffer;
};

/** Statuses whose answer carries no body (a Response made with one throws). */
const NO_BODY = new Set([101, 204, 205, 304]);

/** The identical reads running now, by their key (each entry goes the moment its call has ended). */
const running = new Map<string, Promise<Answer>>();

/** How many identical reads run now (for her suites: none is left once every call has ended). */
export function readsRunningForTests(): number {
  return running.size;
}

/** The key of a read: the service, the method, the whole address and every header it is sent with. */
function shareKey(
  service: Service,
  method: string,
  href: string,
  headers: Record<string, string> | undefined,
): string {
  const sent = Object.entries(headers ?? {})
    .map(([k, v]) => [k.toLowerCase(), v] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return createHash("sha256")
    .update(JSON.stringify([service, method, href, sent]))
    .digest("hex");
}

/** The call itself, under its limit, its body read whole. */
async function callOnce(service: Service, target: URL, init: OutsideInit): Promise<Answer> {
  const signal = AbortSignal.timeout(init.limitMs);
  try {
    const res = await fetch(target, {
      method: init.method ?? "GET",
      ...(init.headers ? { headers: init.headers } : {}),
      ...(init.body === undefined ? {} : { body: init.body }),
      signal,
    });
    const bytes = await res.arrayBuffer();
    return { status: res.status, statusText: res.statusText, headers: [...res.headers], bytes };
  } catch (error) {
    if (signal.aborted) throw new OutsideCallTimeout(service, init.limitMs);
    throw error;
  }
}

/** A running call's answer, waited for at most this caller's own limit. */
function withinLimit(call: Promise<Answer>, service: Service, limitMs: number): Promise<Answer> {
  return new Promise<Answer>((resolve, reject) => {
    const timer = setTimeout(() => reject(new OutsideCallTimeout(service, limitMs)), limitMs);
    call.then(
      (answer) => {
        clearTimeout(timer);
        resolve(answer);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** A Response of this caller's own from an answer read whole: decoded, and of its own length. */
function responseOf(answer: Answer): Response {
  const headers = new Headers(answer.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return new Response(NO_BODY.has(answer.status) ? null : answer.bytes.slice(0), {
    status: answer.status,
    statusText: answer.statusText,
    headers,
  });
}

/** One call to another server, under its time limit, its answer's body already here when it comes back. */
export async function outsideFetch(
  service: Service,
  url: URL | string,
  init: OutsideInit,
): Promise<Response> {
  const target = new URL(String(url));
  const method = init.method ?? "GET";
  const key =
    init.share === true && method === "GET" && init.body === undefined
      ? shareKey(service, method, target.href, init.headers)
      : null;
  const started = Date.now();
  let outcome: CallOutcome = "unreachable";
  let status: number | null = null;
  let joined = false;
  try {
    let answer: Answer;
    const already = key ? running.get(key) : undefined;
    if (already) {
      joined = true;
      answer = await withinLimit(already, service, init.limitMs);
    } else {
      const call = callOnce(service, target, init);
      if (key) {
        running.set(key, call);
        const ended = () => {
          if (running.get(key) === call) running.delete(key);
        };
        call.then(ended, ended);
      }
      answer = await call;
    }
    status = answer.status;
    outcome = "answered";
    return responseOf(answer);
  } catch (error) {
    if (isTimeout(error)) outcome = "timed_out";
    throw error;
  } finally {
    noteCall({
      service,
      path: pathForLog(target.pathname),
      ms: Date.now() - started,
      outcome,
      status,
      shared: joined,
    });
  }
}
