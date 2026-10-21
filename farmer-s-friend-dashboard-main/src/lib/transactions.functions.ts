import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createListingInputSchema,
  type ProduceListing,
  type ProduceOrder,
} from "./transaction-types";

export const getListings = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProduceListing[]> => {
    const { getAllListings } = await import("./transactions.server");
    return getAllListings();
  },
);

export const getListingById = createServerFn({ method: "GET" })
  .validator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id }): Promise<ProduceListing | null> => {
    const { getListingById } = await import("./transactions.server");
    return getListingById(id);
  });

export const createListing = createServerFn({ method: "POST" })
  .validator((data: unknown) => createListingInputSchema.parse(data))
  .handler(async ({ data }): Promise<ProduceListing> => {
    const { createProduceListing } = await import("./transactions.server");
    return createProduceListing(data);
  });

export const getOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProduceOrder[]> => {
    const { getAllOrders } = await import("./transactions.server");
    return getAllOrders();
  },
);

export const getOrderById = createServerFn({ method: "GET" })
  .validator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id }): Promise<ProduceOrder | null> => {
    const { getOrderById } = await import("./transactions.server");
    return getOrderById(id);
  });

export const acceptOrder = createServerFn({ method: "POST" })
  .validator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: orderId }): Promise<ProduceOrder> => {
    const { acceptProduceOrder } = await import("./transactions.server");
    return acceptProduceOrder(orderId);
  });

export const declineOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ orderId: z.string(), reason: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }): Promise<ProduceOrder> => {
    const { declineProduceOrder } = await import("./transactions.server");
    return declineProduceOrder(data.orderId, data.reason);
  });
