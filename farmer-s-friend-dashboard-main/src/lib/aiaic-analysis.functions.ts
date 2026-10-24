import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { CropSignalsAnswer } from "./aiaic-analysis";

/**
 * The browser's door to AIAIC's analysis routes: each call runs on this server (`aiaic-analysis.server.ts`), so AIAIC's
 * address and headers stay out of the browser, and only what the screen shows comes back.
 */

const input = z.object({
  district: z.string().trim().min(1).max(64),
  crop: z.string().trim().min(1).max(64),
  state: z.enum(["mh", "mp"]),
  lang: z.enum(["en", "mr", "hi"]),
});

/** GET /places/crop-signals: what AIAIC holds about this crop in this district (information, never a decision). */
export const getCropSignals = createServerFn({ method: "GET" })
  .validator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<CropSignalsAnswer> => {
    const { cropSignals } = await import("./aiaic-analysis.server");
    return cropSignals(data);
  });
