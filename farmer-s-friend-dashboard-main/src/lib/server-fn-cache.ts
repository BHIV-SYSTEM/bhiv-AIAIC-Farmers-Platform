/**
 * Her server's answers to a server-function call carry her records (her sale, her money, what buyers see of her), so no
 * browser or proxy may keep them: each goes out with `Cache-Control: no-store`. Pages and the app's own files keep their
 * own headers, so a phone still keeps the app's files. (Round 2, push 1, the audit's AP4-05: the owner's default of
 * 12 Nov 2026, "defaults built".)
 *
 * TanStack Start answers every server function under one base: "/" + the router's basepath + its serverFnBase
 * ("/_serverFn" unless the Vite config changes it) + "/" (`createServerFnBasePath` in start-plugin-core).
 * `vite.config.ts` changes neither, and tests/aiaic_server_fn_cache_suite.ts fails if that changes.
 */
export const SERVER_FN_BASE = "/_serverFn/";

/** True for a request to one of her server functions. */
export function isServerFnPath(pathname: string, base: string = SERVER_FN_BASE): boolean {
  return pathname.startsWith(base);
}

/** The answer as it was, but for a server function's: that one with `Cache-Control: no-store` in place of its own. */
export function withNoStoreForServerFns(
  pathname: string,
  response: Response,
  base: string = SERVER_FN_BASE,
): Response {
  if (!isServerFnPath(pathname, base)) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
