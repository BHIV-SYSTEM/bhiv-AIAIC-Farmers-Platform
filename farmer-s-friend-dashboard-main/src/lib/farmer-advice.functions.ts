import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const farmerAdviceQuerySchema = z.object({
  crop: z.string().trim().min(1),
  region: z.string().trim().min(1),
  state: z.string().trim().default("mh"),
  lang: z.enum(["en", "mr", "hi"]).default("en"),
});

export type FarmerAdviceAction = {
  code?: string | undefined;
  text?: string | undefined;
  tone?: string | undefined;
};

export type FarmerAdviceSummary = {
  action?: FarmerAdviceAction | undefined;
  decision_id?: string | undefined;
};

export type FarmerAdviceCard = {
  service: string;
  answer_headline: string;
  read_these_first?: string[] | undefined;
  why?: string[] | undefined;
  as_of?: string | undefined;
  reference?: string | undefined;
  checked_note?: string | undefined;
  action?: FarmerAdviceAction | undefined;
  summary?: FarmerAdviceSummary | undefined;
  abstained?: boolean | undefined;
  abstain_note?: string | undefined;
};

export type AskAHuman = {
  kisan_call_centre?: string | undefined;
  tele_manas?: string | undefined;
  tele_manas_toll_free?: string | undefined;
};

export type FarmerAdviceTrace = {
  request_id?: string | undefined;
  decision_ids?: string[] | undefined;
  price_day?: string | undefined;
};

export type FarmerAdviceResponse = {
  ok: boolean;
  crop?: string | undefined;
  place?: string | undefined;
  state?: string | undefined;
  lang?: string | undefined;
  distress?: boolean | undefined;
  distress_message?: string | undefined;
  important?: string | undefined;
  important_label?: string | undefined;
  ask_a_human?: AskAHuman | undefined;
  cards?: FarmerAdviceCard[] | undefined;
  service_errors?: Record<string, string> | null | undefined;
  trace?: FarmerAdviceTrace | undefined;
  error?: string | undefined;
  fetchedAt: string;
};

/**
 * Confirmed Farmer-Facing Advice Endpoint:
 * GET /farmer/advice?crop=<crop>&region=<region>&state=<mh|mp>&lang=<en|mr|hi>
 *
 * Rules:
 * 1. If distress=true, prominently show distress alert without caching.
 * 2. Does not invent advice; preserves honest error and empty states.
 */
export const getFarmerAdvice = createServerFn({ method: "GET" })
  .validator((params: unknown) => farmerAdviceQuerySchema.parse(params))
  .handler(async ({ data }): Promise<FarmerAdviceResponse> => {
    const fetchedAt = new Date().toISOString();
    const { resolveBaseUrl, AIAIC_HEADERS } = await import("./aiaic-base.server");
    const { baseUrl } = resolveBaseUrl();

    const url = new URL(`${baseUrl}/farmer/advice`);
    url.searchParams.set("crop", data.crop);
    url.searchParams.set("region", data.region);
    url.searchParams.set("state", data.state.toLowerCase());
    url.searchParams.set("lang", data.lang);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: AIAIC_HEADERS,
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `Engine returned HTTP ${response.status}`,
          fetchedAt,
        };
      }

      const json = await response.json();
      const isDistress = Boolean(json.distress);

      const parsedCards: FarmerAdviceCard[] = Array.isArray(json.cards)
        ? json.cards.map((c: any) => ({
            service: typeof c.service === "string" ? c.service : "",
            answer_headline: typeof c.answer_headline === "string" ? c.answer_headline : "",
            read_these_first: Array.isArray(c.read_these_first) ? c.read_these_first : undefined,
            why: Array.isArray(c.why) ? c.why : undefined,
            as_of: typeof c.as_of === "string" ? c.as_of : undefined,
            reference: typeof c.reference === "string" ? c.reference : undefined,
            checked_note: typeof c.checked_note === "string" ? c.checked_note : undefined,
            action:
              c.action && typeof c.action === "object"
                ? {
                    code: typeof c.action.code === "string" ? c.action.code : undefined,
                    text: typeof c.action.text === "string" ? c.action.text : undefined,
                    tone: typeof c.action.tone === "string" ? c.action.tone : undefined,
                  }
                : undefined,
            summary:
              c.summary && typeof c.summary === "object"
                ? {
                    action:
                      c.summary.action && typeof c.summary.action === "object"
                        ? {
                            code:
                              typeof c.summary.action.code === "string"
                                ? c.summary.action.code
                                : undefined,
                            text:
                              typeof c.summary.action.text === "string"
                                ? c.summary.action.text
                                : undefined,
                            tone:
                              typeof c.summary.action.tone === "string"
                                ? c.summary.action.tone
                                : undefined,
                          }
                        : undefined,
                    decision_id:
                      typeof c.summary.decision_id === "string" ? c.summary.decision_id : undefined,
                  }
                : undefined,
            abstained: typeof c.abstained === "boolean" ? c.abstained : undefined,
            abstain_note: typeof c.abstain_note === "string" ? c.abstain_note : undefined,
          }))
        : [];

      return {
        ok: true,
        crop: typeof json.crop === "string" ? json.crop : undefined,
        place: typeof json.place === "string" ? json.place : undefined,
        state: typeof json.state === "string" ? json.state : undefined,
        lang: typeof json.lang === "string" ? json.lang : undefined,
        distress: isDistress,
        distress_message:
          typeof json.distress_message === "string" ? json.distress_message : undefined,
        important: typeof json.important === "string" ? json.important : undefined,
        important_label:
          typeof json.important_label === "string" ? json.important_label : undefined,
        ask_a_human:
          json.ask_a_human && typeof json.ask_a_human === "object"
            ? {
                kisan_call_centre:
                  typeof json.ask_a_human.kisan_call_centre === "string"
                    ? json.ask_a_human.kisan_call_centre
                    : undefined,
                tele_manas:
                  typeof json.ask_a_human.tele_manas === "string"
                    ? json.ask_a_human.tele_manas
                    : undefined,
                tele_manas_toll_free:
                  typeof json.ask_a_human.tele_manas_toll_free === "string"
                    ? json.ask_a_human.tele_manas_toll_free
                    : undefined,
              }
            : undefined,
        cards: parsedCards,
        service_errors: json.service_errors ?? null,
        trace:
          json.trace && typeof json.trace === "object"
            ? {
                request_id:
                  typeof json.trace.request_id === "string" ? json.trace.request_id : undefined,
                decision_ids: Array.isArray(json.trace.decision_ids)
                  ? json.trace.decision_ids
                  : undefined,
                price_day:
                  typeof json.trace.price_day === "string" ? json.trace.price_day : undefined,
              }
            : undefined,
        fetchedAt,
      };
    } catch (err: any) {
      console.error("[farmerAdvice] failed to fetch", err);
      return {
        ok: false,
        error: err?.message || "Communication failure with advice engine",
        fetchedAt,
      };
    }
  });
