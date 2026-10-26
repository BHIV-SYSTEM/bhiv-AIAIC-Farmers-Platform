import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { whoAmI } from "./aiaic-account.functions";

/** Who is using the app here (push 4b): a signed-in farmer or a guest, read once per page view and after a sign-in or
 * out (every query is read again then). */
export function useMe() {
  const whoFn = useServerFn(whoAmI);
  return useQuery({ queryKey: ["aiaic-me"], queryFn: () => whoFn(), staleTime: 60_000, retry: 0 });
}
