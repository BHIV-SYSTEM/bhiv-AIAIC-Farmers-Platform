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
 */
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
};

/** Statuses whose answer carries no body (a Response made with one throws). */
const NO_BODY = new Set([101, 204, 205, 304]);

/** One call to another server, under its time limit, its answer's body already here when it comes back. */
export async function outsideFetch(
  service: Service,
  url: URL | string,
  init: OutsideInit,
): Promise<Response> {
  const target = new URL(String(url));
  const started = Date.now();
  const signal = AbortSignal.timeout(init.limitMs);
  let outcome: CallOutcome = "unreachable";
  let status: number | null = null;
  try {
    const res = await fetch(target, {
      method: init.method ?? "GET",
      ...(init.headers ? { headers: init.headers } : {}),
      ...(init.body === undefined ? {} : { body: init.body }),
      signal,
    });
    const bytes = await res.arrayBuffer();
    status = res.status;
    outcome = "answered";
    const headers = new Headers(res.headers);
    // the body is handed back as it was read: decoded, and of its own length
    headers.delete("content-encoding");
    headers.delete("content-length");
    return new Response(NO_BODY.has(res.status) ? null : bytes, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch (error) {
    if (signal.aborted) {
      outcome = "timed_out";
      throw new OutsideCallTimeout(service, init.limitMs);
    }
    throw error;
  } finally {
    noteCall({
      service,
      path: pathForLog(target.pathname),
      ms: Date.now() - started,
      outcome,
      status,
      shared: false,
    });
  }
}
