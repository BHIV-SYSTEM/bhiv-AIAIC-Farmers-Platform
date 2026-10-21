import fs from "node:fs/promises";
import path from "node:path";
import type {
  CreateListingInput,
  ListingStatus,
  ProduceListing,
  ProduceOrder,
} from "./transaction-types";

type DatabaseStore = {
  listings: ProduceListing[];
  orders: ProduceOrder[];
  lastUpdated: string;
};

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.resolve(DB_DIR, "transactions.json");

let memoryCache: DatabaseStore | null = null;

async function ensureDb(): Promise<DatabaseStore> {
  if (memoryCache) return memoryCache;

  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const content = await fs.readFile(DB_FILE, "utf-8");
    memoryCache = JSON.parse(content) as DatabaseStore;
    return memoryCache;
  } catch {
    const initial: DatabaseStore = {
      listings: [
        {
          id: "LST-20261019-01",
          crop: "Onion",
          variety: "Nashik Red / Garwa",
          quantityQuintals: 35,
          grade: "GRADE_B",
          askingPricePerQuintal: 4900,
          district: "Kolhapur",
          mandi: "APMC Vita",
          pickupLocation: "Shirol, Kolhapur District",
          harvestWindow: "Immediate pickup (harvested 2 days ago)",
          decisionId: "dec_9c6f131f69d54bf1fde72b7b69ff6e54",
          farmerName: "Balasaheb Patil",
          farmerPhone: "+91 98220 12345",
          notes: "Well-cured onion lots, average bulb diameter 55mm+",
          status: "MATCHED",
          createdAt: "2026-10-19T08:30:00.000Z",
          updatedAt: "2026-10-19T08:30:00.000Z",
        },
      ],
      orders: [
        {
          id: "ORD-20261019-8421",
          listingId: "LST-20261019-01",
          buyerId: "BUY-RETAIL-04",
          buyerName: "Sahyadri Agro Retail Aggregators (Demo Procurement Sandbox)",
          buyerType: "RETAIL_CHAIN",
          crop: "Onion",
          variety: "Nashik Red / Garwa",
          grade: "GRADE_B",
          quantityQuintals: 35,
          offeredPricePerQuintal: 4950,
          grossAmount: 173250,
          estimatedTransportCost: 4000,
          estimatedPlatformFee: 3465, // 2%
          estimatedNetPayout: 165785,
          pickupLocation: "Shirol, Kolhapur District",
          deliveryDestination: "APMC Regional Distribution Centre, Vita (40 km)",
          decisionId: "dec_9c6f131f69d54bf1fde72b7b69ff6e54",
          status: "PENDING_ACCEPTANCE",
          terms:
            "Sandbox Demo Procurement: 100% digital payment held in verified mock escrow. Weighing and quality verification at collection center.",
          isSandboxDemo: true,
          createdAt: "2026-10-19T10:00:00.000Z",
          acceptedAt: null,
          declinedAt: null,
          traceability: {
            listingId: "LST-20261019-01",
            farmerPhone: "+91 98220 12345",
            decisionId: "dec_9c6f131f69d54bf1fde72b7b69ff6e54",
            vajraAttestation: "PENDING_ANCHOR",
            tantraExecution: "REGISTERED",
            escrowStatus: "FUNDS_HELD_DEMO_ESCROW",
          },
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    try {
      await fs.writeFile(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
    } catch (e) {
      console.warn("[transactions.server] Could not write initial DB file:", e);
    }
    memoryCache = initial;
    return initial;
  }
}

async function saveDb(store: DatabaseStore): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  memoryCache = store;
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("[transactions.server] Failed to save DB to file:", err);
  }
}

export async function getAllListings(): Promise<ProduceListing[]> {
  const db = await ensureDb();
  return [...db.listings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getListingById(id: string): Promise<ProduceListing | null> {
  const db = await ensureDb();
  return db.listings.find((l) => l.id === id) ?? null;
}

export async function createProduceListing(input: CreateListingInput): Promise<ProduceListing> {
  const db = await ensureDb();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const id = `LST-${dateStr}-${randomSuffix}`;

  const newListing: ProduceListing = {
    id,
    crop: input.crop,
    variety: input.variety || "Standard Mandi Quality",
    quantityQuintals: input.quantityQuintals,
    grade: input.grade || "GRADE_B",
    askingPricePerQuintal: input.askingPricePerQuintal,
    district: input.district,
    mandi: input.mandi,
    pickupLocation: input.pickupLocation,
    harvestWindow: input.harvestWindow || "Immediate (within 48 hours)",
    decisionId: input.decisionId,
    farmerName: input.farmerName || "Farmer Producer",
    farmerPhone: input.farmerPhone || "+91 98000 00000",
    notes: input.notes,
    status: "MATCHED",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  db.listings.unshift(newListing);

  // Automatically generate a matched buyer procurement offer in sandbox mode to facilitate the full listing-to-order flow
  const orderId = `ORD-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
  const offeredPrice = Math.round(input.askingPricePerQuintal * 1.01); // Competitive buyer bid slightly above asking price
  const grossAmount = Math.round(input.quantityQuintals * offeredPrice);
  const estimatedTransport = Math.round(input.quantityQuintals * 50); // ₹50/q estimated regional transport
  const estimatedPlatformFee = Math.round(grossAmount * 0.02); // 2% platform fee
  const estimatedNetPayout = grossAmount - estimatedTransport - estimatedPlatformFee;

  const matchedOrder: ProduceOrder = {
    id: orderId,
    listingId: id,
    buyerId: "BUY-RETAIL-01",
    buyerName: "Sahyadri Fresh Procurement Network (Demo Sandbox)",
    buyerType: "RETAIL_CHAIN",
    crop: input.crop,
    variety: input.variety,
    grade: input.grade,
    quantityQuintals: input.quantityQuintals,
    offeredPricePerQuintal: offeredPrice,
    grossAmount,
    estimatedTransportCost: estimatedTransport,
    estimatedPlatformFee,
    estimatedNetPayout,
    pickupLocation: input.pickupLocation,
    deliveryDestination: input.mandi
      ? `${input.mandi} Hub`
      : `${input.district} APMC Regional Trade Hub`,
    decisionId: input.decisionId,
    status: "PENDING_ACCEPTANCE",
    terms:
      "Demo Sandbox Bid: Matched via AIAIC price discovery. 100% digital payment reserved in mock escrow. Farmgate pickup scheduled within 48h.",
    isSandboxDemo: true,
    createdAt: now.toISOString(),
    acceptedAt: null,
    declinedAt: null,
    traceability: {
      listingId: id,
      farmerPhone: input.farmerPhone || "+91 98000 00000",
      decisionId: input.decisionId,
      vajraAttestation: "PENDING_ANCHOR",
      tantraExecution: "REGISTERED",
      escrowStatus: "FUNDS_HELD_DEMO_ESCROW",
    },
  };

  db.orders.unshift(matchedOrder);
  await saveDb(db);

  return newListing;
}

export async function updateListingStatus(
  id: string,
  status: ListingStatus,
): Promise<ProduceListing | null> {
  const db = await ensureDb();
  const listing = db.listings.find((l) => l.id === id);
  if (!listing) return null;
  listing.status = status;
  listing.updatedAt = new Date().toISOString();
  await saveDb(db);
  return listing;
}

export async function getAllOrders(): Promise<ProduceOrder[]> {
  const db = await ensureDb();
  return [...db.orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getOrderById(id: string): Promise<ProduceOrder | null> {
  const db = await ensureDb();
  return db.orders.find((o) => o.id === id) ?? null;
}

export async function acceptProduceOrder(orderId: string): Promise<ProduceOrder> {
  const db = await ensureDb();
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status === "ACCEPTED") {
    return order; // Idempotent
  }

  const now = new Date().toISOString();
  order.status = "ACCEPTED";
  order.acceptedAt = now;

  // Update corresponding listing to ORDERED
  const listing = db.listings.find((l) => l.id === order.listingId);
  if (listing) {
    listing.status = "ORDERED";
    listing.updatedAt = now;
  }

  await saveDb(db);
  return order;
}

export async function declineProduceOrder(orderId: string, reason?: string): Promise<ProduceOrder> {
  const db = await ensureDb();
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const now = new Date().toISOString();
  order.status = "DECLINED";
  order.declinedAt = now;
  order.declineReason = reason ?? "Farmer declined offer terms";

  // Revert listing to ACTIVE
  const listing = db.listings.find((l) => l.id === order.listingId);
  if (listing && listing.status === "MATCHED") {
    listing.status = "ACTIVE";
    listing.updatedAt = now;
  }

  await saveDb(db);
  return order;
}
