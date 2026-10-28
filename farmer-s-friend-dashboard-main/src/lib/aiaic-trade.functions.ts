import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  PRESS_KEY_RE,
  type AiaicPricing,
  type AiaicResult,
  type BuyersLooking,
  type MineForScreen,
  type NearbyMandis,
  type ReferencePrice,
  type StorageVerdict,
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
const planId = z.string().regex(/^gpl_[0-9a-f]{20}$/);
const money = z.number().positive().max(1_000_000);
const qty = z.number().positive().max(100_000);

export const getTradeMode = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeMode> => {
    // a signed-in farmer's sales are her own record in AIAIC; a guest's, the server's settings (push 4b)
    const { tradeModeNow } = await import("./aiaic-trade.server");
    return tradeModeNow();
  },
);

export const getMyTrade = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ lang }).parse(d))
  .handler(async ({ data }): Promise<AiaicResult<MineForScreen>> => {
    const { getMine } = await import("./aiaic-trade.server");
    return getMine(data.lang);
  });

/** Buyers looking for produce near her (AIAIC section 25): the demand AIAIC's team chose to show farmers. */
export const getBuyersLooking = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ lang }).parse(d))
  .handler(async ({ data }): Promise<AiaicResult<BuyersLooking>> => {
    const { buyersLooking } = await import("./aiaic-trade.server");
    return buyersLooking(data.lang);
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
        taluka: z.string().trim().max(80).optional(),
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

/** Her answer to a group's sale plan with her lot (AIAIC section 26). */
export const answerGroupPlan = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ key: pressKey, plan_id: planId, answer: z.enum(["joined", "declined"]) }).parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<true>> => {
    const { answerGroupPlan: answer } = await import("./aiaic-trade.server");
    return answer(data.key, data.plan_id, data.answer);
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

/** AIAIC's commission as its server holds it now (its public GET /payments/pricing), for the pricing page. */
export const getAiaicPricing = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiaicResult<AiaicPricing>> => {
    const { aiaicPricing } = await import("./aiaic-trade.server");
    return aiaicPricing();
  },
);

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
        taluka: z.string().trim().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<TransportEstimate>> => {
    const { transportEstimate } = await import("./aiaic-trade.server");
    return transportEstimate(data);
  });

/** AIAIC's storage verdict card (GET /storage/verdict): store or sell now and the nearest warehouses by name. */
export const getStorageVerdict = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z
      .object({
        crop: z.string().trim().min(1).max(80),
        district,
        state,
        quantity_q: qty.optional(),
        lang,
        taluka: z.string().trim().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<StorageVerdict>> => {
    const { storageVerdict } = await import("./aiaic-trade.server");
    return storageVerdict(data);
  });

export const getNearbyMandis = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z
      .object({
        district,
        state,
        limit: z.number().int().min(1).max(50).default(15),
        taluka: z.string().trim().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AiaicResult<NearbyMandis>> => {
    const { nearbyMandis } = await import("./aiaic-trade.server");
    return nearbyMandis(data);
  });

// ------------------------------------------------------------------------- 28 Oct 2026: talukas, her offer, her money
/** The talukas of a district (AIAIC's official list), for the dropdown right after the district. */
export const getTripTalukas = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ state, district }).parse(d))
  .handler(async ({ data }) => {
    const { tripTalukas } = await import("./aiaic-trade.server");
    return tripTalukas(data);
  });

/** HER offer weighed against the mandi, after her trip. */
export const compareMyOffer = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ offer_id: offerId }).parse(d))
  .handler(async ({ data }) => {
    const { compareOffer } = await import("./aiaic-trade.server");
    return compareOffer(data.offer_id);
  });

/** Where AIAIC sends her money: her UPI ID or bank account, by her own press. */
export const giveMyDestination = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        key: pressKey,
        kind: z.enum(["upi_id", "bank_account"]),
        upi_id: z.string().trim().max(300).optional(),
        name: z.string().trim().max(120).optional(),
        account_number: z.string().trim().max(40).optional(),
        ifsc: z.string().trim().max(20).optional(),
        agreed: z.literal(true),
        replace: z.boolean().optional(),
        notice_version: z.string().trim().min(3).max(40),
        read_in: z.enum(["en", "mr", "hi"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { giveDestination } = await import("./aiaic-trade.server");
    const { key, ...rest } = data;
    return giveDestination(key, rest);
  });

/** She removes her UPI ID or bank account by her own press (audit of 28 Oct 2026, PRIVACY-04). */
export const endMyDestination = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ key: pressKey }).parse(d))
  .handler(async ({ data }) => {
    const { endDestination } = await import("./aiaic-trade.server");
    return endDestination(data.key);
  });
