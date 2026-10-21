import { z } from "zod";

export const produceGradeSchema = z.enum(["GRADE_A", "GRADE_B", "GRADE_C", "UNVERIFIED"]);
export type ProduceQualityGrade = z.infer<typeof produceGradeSchema>;

export const listingStatusSchema = z.enum(["ACTIVE", "MATCHED", "ORDERED", "DELISTED"]);
export type ListingStatus = z.infer<typeof listingStatusSchema>;

export const produceListingSchema = z.object({
  id: z.string(),
  crop: z.string().min(1),
  variety: z.string().default("Standard Mandi Quality"),
  quantityQuintals: z.number().positive(),
  grade: produceGradeSchema.default("GRADE_B"),
  askingPricePerQuintal: z.number().positive(),
  district: z.string().min(1),
  mandi: z.string().optional(),
  pickupLocation: z.string().min(1),
  harvestWindow: z.string().default("Immediate (within 48 hours)"),
  decisionId: z.string().optional(),
  farmerName: z.string().default("Local Producer"),
  farmerPhone: z.string().default("+91 98765 43210"),
  notes: z.string().optional(),
  status: listingStatusSchema.default("ACTIVE"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProduceListing = z.infer<typeof produceListingSchema>;

export const orderStatusSchema = z.enum([
  "PENDING_ACCEPTANCE",
  "ACCEPTED",
  "DECLINED",
  "IN_TRANSIT",
  "DELIVERED",
  "SETTLED",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const buyerTypeSchema = z.enum(["RETAIL_CHAIN", "MANDI_AGGREGATOR", "FOOD_PROCESSOR"]);
export type BuyerType = z.infer<typeof buyerTypeSchema>;

export const produceOrderSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  buyerId: z.string(),
  buyerName: z.string(),
  buyerType: buyerTypeSchema,
  crop: z.string(),
  variety: z.string(),
  grade: produceGradeSchema,
  quantityQuintals: z.number().positive(),
  offeredPricePerQuintal: z.number().positive(),
  grossAmount: z.number().positive(),
  estimatedTransportCost: z.number().nonnegative(),
  estimatedPlatformFee: z.number().nonnegative(),
  estimatedNetPayout: z.number().positive(),
  pickupLocation: z.string(),
  deliveryDestination: z.string(),
  decisionId: z.string().optional(),
  status: orderStatusSchema,
  terms: z.string(),
  isSandboxDemo: z.boolean().default(true),
  createdAt: z.string(),
  acceptedAt: z.string().nullable().optional(),
  declinedAt: z.string().nullable().optional(),
  declineReason: z.string().nullable().optional(),
  traceability: z.object({
    listingId: z.string(),
    farmerPhone: z.string(),
    decisionId: z.string().optional(),
    vajraAttestation: z.literal("PENDING_ANCHOR"),
    tantraExecution: z.literal("REGISTERED"),
    escrowStatus: z.literal("FUNDS_HELD_DEMO_ESCROW"),
  }),
});

export type ProduceOrder = z.infer<typeof produceOrderSchema>;

export const createListingInputSchema = z.object({
  crop: z.string().trim().min(2, "Crop name is required"),
  variety: z.string().trim().min(1, "Variety is required").default("Standard"),
  quantityQuintals: z.number().positive("Quantity must be greater than 0"),
  grade: produceGradeSchema.default("GRADE_B"),
  askingPricePerQuintal: z.number().positive("Price must be greater than 0"),
  district: z.string().trim().min(2, "District is required"),
  mandi: z.string().trim().optional(),
  pickupLocation: z.string().trim().min(2, "Pickup location is required"),
  harvestWindow: z.string().trim().default("Immediate (within 48 hours)"),
  decisionId: z.string().trim().optional(),
  farmerName: z.string().trim().default("Farmer Producer"),
  farmerPhone: z.string().trim().default("+91 98000 00000"),
  notes: z.string().trim().optional(),
});

export type CreateListingInput = z.infer<typeof createListingInputSchema>;
