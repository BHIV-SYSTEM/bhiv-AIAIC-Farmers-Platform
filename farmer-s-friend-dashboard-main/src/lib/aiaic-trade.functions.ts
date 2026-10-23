import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  PRESS_KEY_RE,
  type AiaicResult,
  type MineForScreen,
  type NearbyMandis,
  type ReferencePrice,
  type TradeMode,
  type TransportEstimate,
} from "./aiaic-trade";

/**
 * The browser's door to AIAIC's sale, payment and transport routes. Every call runs on this server
 * (`aiaic-trade.server.ts`): the AIAIC farmer account's password and token never reach the browser, and only
 * what the screens show comes back.
 */

const lang = z.enum(["en", "mr", "hi"]);
const state = z.enum(["mh", "mp"]);
const district = z.string().trim().min(1).max(64);
const pressKey = z.string().regex(PRESS_KEY_RE);
const offerId = z.string().regex(/^ofr_[0-9a-f]{20}$/);
const listingId = z.string().regex(/^lst_[0-9a-f]{20}$/);
const orderId = z.string().regex(/^ord_[0-9a-f]{20}$/);
const money = z.number().positive().max(1_000_000);
const qty = z.number().positive().max(100_000);

export const getTradeMode = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeMode> => {
    const { tradeMode } = await import("./aiaic-trade.server");
    return tradeMode();
  },
);

export const getMyTrade = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ lang }).parse(d))
  .handler(async ({ data }): Promise<AiaicResult<MineForScreen>> => {
    const { getMine } = await import("./aiaic-trade.server");
    return getMine(data.lang);
  });

export const getSalePrice = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z.object({ crop: z.string().trim().min(1).max(64), state, district }).parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<ReferencePrice>> => {
    const { getPrice } = await import("./aiaic-trade.server");
    return getPrice(data);
  });

export const sellProduce = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        key: pressKey,
        state,
        district,
        crop: z.string().trim().min(1).max(64),
        quantity_q: qty,
        ask_price_per_q: money.optional(),
        grade: z.enum(["A", "B", "C"]).nullable().optional(),
        price_confirmed: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<{ listing_id: string }>> => {
    const { sell } = await import("./aiaic-trade.server");
    const { key, ...rest } = data;
    return sell(key, rest);
  });

export const answerOffer = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ key: pressKey, offer_id: offerId, answer: z.enum(["accept", "reject"]) }).parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<{ order_id: string | null }>> => {
    const { answerOffer: answer } = await import("./aiaic-trade.server");
    return answer(data.key, data.offer_id, data.answer);
  });

export const stopSelling = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ key: pressKey, listing_id: listingId }).parse(d))
  .handler(async ({ data }): Promise<AiaicResult<true>> => {
    const { stopSelling: stop } = await import("./aiaic-trade.server");
    return stop(data.key, data.listing_id);
  });

export const givePayoutAccount = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        key: pressKey,
        notice_version: z.string().min(3).max(20),
        shown_in: lang,
        agreed: z.literal(true),
        destination: z.enum(["bank_account", "upi_id"]),
        pan: z.string().min(10).max(20),
        name_on_pan: z.string().min(2).max(100),
        account_number: z.string().max(40).optional(),
        ifsc: z.string().max(20).optional(),
        upi_id: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<{ status: string | null }>> => {
    const { givePayoutAccount: give } = await import("./aiaic-trade.server");
    const { key, agreed: _agreed, ...details } = data;
    return give(key, details);
  });

export const withdrawPayoutAccount = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ key: pressKey }).parse(d))
  .handler(async ({ data }): Promise<AiaicResult<true>> => {
    const { withdrawPayoutAccount: withdraw } = await import("./aiaic-trade.server");
    return withdraw(data.key);
  });

export const reportPayment = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({ key: pressKey, order_id: orderId, what: z.enum(["received", "not_received"]) })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<true>> => {
    const { reportPayment: report } = await import("./aiaic-trade.server");
    return report(data.key, data.order_id, data.what);
  });

export const getTransportEstimate = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z
      .object({
        mandi: z.string().trim().min(1).max(120),
        quantity_q: qty,
        district,
        state,
        mandi_state: state.optional(),
        mandi_district: z.string().trim().max(64).optional(),
        from_place: z.enum(["farm", "district_centre"]).default("farm"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<TransportEstimate>> => {
    const { transportEstimate } = await import("./aiaic-trade.server");
    return transportEstimate(data);
  });

export const getNearbyMandis = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z.object({ district, state, limit: z.number().int().min(1).max(50).default(15) }).parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<NearbyMandis>> => {
    const { nearbyMandis } = await import("./aiaic-trade.server");
    return nearbyMandis(data);
  });
