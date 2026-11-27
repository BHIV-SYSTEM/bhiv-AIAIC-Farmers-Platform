import fs from "node:fs/promises";
import path from "node:path";
import { buildKind, refuseUnlessDemoStoreAllowed } from "./demo-store.server";
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

/** Where the store is kept: its file, unless a suite run from source moved it (`storeFileForTests`). */
let dbDir = DB_DIR;
let dbFile = DB_FILE;

let memoryCache: DatabaseStore | null = null;

/** What a write the store's file did not take throws (lane AN, item 2): the page then says it was not saved. */
export const DEMO_STORE_WRITE_FAILED =
  "demo_store_write_failed: the demo store's file did not take the change; nothing was changed";

/**
 * FOR HER SUITES ONLY, run from source with the store opened (`demoStoreForTests`): keep the store in this file instead
 * (null: its own file again), and forget what memory held.
 */
export function storeFileForTests(file: string | null): void {
  if (buildKind() !== "source")
    throw new Error("storeFileForTests is for the suites run from source only");
  refuseUnlessDemoStoreAllowed();
  dbFile = file ?? DB_FILE;
  dbDir = file ? path.dirname(file) : DB_DIR;
  memoryCache = null;
}

async function ensureDb(): Promise<DatabaseStore> {
  // THE DEMO STORE IS FOR DEVELOPMENT ONLY (lane AN, item 1): every read and write starts here, so outside development
  // nothing is read, kept or written, whoever calls (`demo-store.server.ts`)
  refuseUnlessDemoStoreAllowed();
  if (memoryCache) return memoryCache;

  try {
    await fs.mkdir(dbDir, { recursive: true });
    const content = await fs.readFile(dbFile, "utf-8");
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
      await fs.writeFile(dbFile, JSON.stringify(initial, null, 2), "utf-8");
    } catch (e) {
      console.warn("[transactions.server] Could not write initial DB file:", e);
    }
    memoryCache = initial;
    return initial;
  }
}

/**
 * A FAILED WRITE IS SAID, NEVER A QUIET SUCCESS (lane AN, item 2; the VM report's first finding): the store in memory
 * becomes `store` only once its file took it. A write that fails throws `DEMO_STORE_WRITE_FAILED`, and memory keeps what
 * the file holds.
 */
async function saveDb(store: DatabaseStore): Promise<void> {
  refuseUnlessDemoStoreAllowed();
  store.lastUpdated = new Date().toISOString();
  try {
    await fs.mkdir(dbDir, { recursive: true });
    await fs.writeFile(dbFile, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "unknown";
    console.error(
      `[transactions.server] the demo store's file did not take a change (${code}): not kept`,
    );
    throw new Error(DEMO_STORE_WRITE_FAILED, { cause: err });
  }
  memoryCache = store;
}

/** The last write of the store to begin (kept or failed: the next one starts once it has ended). */
let lastWrite: Promise<unknown> = Promise.resolve();

/**
 * THE STORE'S WRITES RUN ONE AFTER ANOTHER (lane AN's fix round, AN-03): each write, its own checks included, starts
 * only once the one before it has ended, from what memory then holds, so two changes made at the same moment are both
 * kept (each change is made on a copy, and a copy made while another change was still being written would drop it). A
 * write that fails ends its turn too: the next one still runs. Reads never wait: memory holds only what the file took.
 */
function inTurn<T>(write: () => Promise<T>): Promise<T> {
  const mine = lastWrite.then(write);
  lastWrite = mine.catch(() => undefined);
  return mine;
}

/** One change to the store, made on a copy, inside a write's turn (`inTurn`): memory keeps it only once the file took
 * it (`saveDb`). */
async function change<T>(edit: (draft: DatabaseStore) => T): Promise<T> {
  const draft = structuredClone(await ensureDb());
  const result = edit(draft);
  await saveDb(draft);
  return result;
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
  return inTurn(() => change((db) => listOne(db, input)));
}

function listOne(db: DatabaseStore, input: CreateListingInput): ProduceListing {
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

  return newListing;
}

export async function updateListingStatus(
  id: string,
  status: ListingStatus,
): Promise<ProduceListing | null> {
  return inTurn(async () => {
    if (!(await ensureDb()).listings.some((l) => l.id === id)) return null;
    return change((db) => {
      const listing = db.listings.find((l) => l.id === id) as ProduceListing;
      listing.status = status;
      listing.updatedAt = new Date().toISOString();
      return listing;
    });
  });
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
  return inTurn(async () => {
    const found = (await ensureDb()).orders.find((o) => o.id === orderId);
    if (!found) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (found.status === "ACCEPTED") {
      return found; // Idempotent
    }

    return change((db) => {
      const order = db.orders.find((o) => o.id === orderId) as ProduceOrder;
      const now = new Date().toISOString();
      order.status = "ACCEPTED";
      order.acceptedAt = now;

      // Update corresponding listing to ORDERED
      const listing = db.listings.find((l) => l.id === order.listingId);
      if (listing) {
        listing.status = "ORDERED";
        listing.updatedAt = now;
      }
      return order;
    });
  });
}

export async function declineProduceOrder(orderId: string, reason?: string): Promise<ProduceOrder> {
  return inTurn(async () => {
    if (!(await ensureDb()).orders.some((o) => o.id === orderId)) {
      throw new Error(`Order ${orderId} not found`);
    }

    return change((db) => {
      const order = db.orders.find((o) => o.id === orderId) as ProduceOrder;
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
      return order;
    });
  });
}
