import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createListingInputSchema } from "../src/lib/transaction-types";
import {
  createProduceListing,
  getAllListings,
  getOrderById,
  acceptProduceOrder,
  declineProduceOrder,
} from "../src/lib/transactions.server";

// the app's store, as src/lib/transactions.server.ts finds it (from the working directory)
const STORE_FILE = path.resolve(process.cwd(), "data", "transactions.json");

async function runLifecycleTestSuite() {
  console.log("=== STARTING TRANSACTION LIFECYCLE AUTOMATED TEST SUITE ===");

  // 1. Test Input Validations
  console.log("\n[Test 1] Schema Validation: Invalid and boundary inputs");

  // 1a. Missing crop
  const invalidCrop = createListingInputSchema.safeParse({
    crop: "",
    quantityQuintals: 10,
    askingPricePerQuintal: 4000,
    district: "Kolhapur",
  });
  assert.strictEqual(invalidCrop.success, false, "Empty crop should fail schema validation");
  console.log("✓ Empty crop successfully rejected");

  // 1b. Negative / zero quantity
  const invalidQuantity = createListingInputSchema.safeParse({
    crop: "Wheat",
    quantityQuintals: 0,
    askingPricePerQuintal: 4000,
    district: "Kolhapur",
  });
  assert.strictEqual(invalidQuantity.success, false, "Zero quantity should fail schema validation");
  console.log("✓ Zero quantity successfully rejected");

  // 1c. Negative / zero price
  const invalidPrice = createListingInputSchema.safeParse({
    crop: "Wheat",
    quantityQuintals: 10,
    askingPricePerQuintal: -500,
    district: "Kolhapur",
  });
  assert.strictEqual(invalidPrice.success, false, "Negative price should fail schema validation");
  console.log("✓ Negative price successfully rejected");

  // 1d. Valid input
  const validLot = createListingInputSchema.safeParse({
    crop: "Soybean",
    variety: "JS-335",
    quantityQuintals: 20,
    askingPricePerQuintal: 4800,
    grade: "GRADE_A",
    district: "Indore",
    pickupLocation: "Depot A",
    decisionId: "dec_test_lifecycle_001",
  });
  assert.strictEqual(validLot.success, true, "Valid input should succeed schema validation");
  console.log("✓ Valid lot data schema successfully parsed");

  // 2. Test Listing Creation & Matching
  console.log("\n[Test 2] Produce Listing Creation & Matched Offer Generation");
  const listing = await createProduceListing({
    crop: "Soybean (Test Lot)",
    variety: "Test Variety",
    quantityQuintals: 20,
    grade: "GRADE_A",
    askingPricePerQuintal: 4800,
    district: "Indore",
    pickupLocation: "Farm Gate 1",
    harvestWindow: "Immediate",
    decisionId: "dec_test_001",
    farmerName: "Test Farmer",
    farmerPhone: "+91 99999 88888",
  });

  assert.ok(listing.id.startsWith("LST-"), `Listing ID should start with LST-, got ${listing.id}`);
  assert.strictEqual(
    listing.status,
    "MATCHED",
    "Listing should transition to MATCHED after buyer bid creation",
  );
  console.log(`✓ Created isolated test listing: ${listing.id}`);

  // Retrieve listing
  const allListings = await getAllListings();
  const retrievedListing = allListings.find((l) => l.id === listing.id);
  assert.ok(retrievedListing, "Listing must exist in store");
  assert.strictEqual(retrievedListing?.askingPricePerQuintal, 4800);
  console.log("✓ Listing successfully retrieved from server store");

  // Retrieve matching order
  const { getAllOrders } = await import("../src/lib/transactions.server");
  const allOrders = await getAllOrders();
  const matchedOrder = allOrders.find((o) => o.listingId === listing.id);
  assert.ok(matchedOrder, "Matched order must be generated for test listing");
  assert.strictEqual(
    matchedOrder?.isSandboxDemo,
    true,
    "Matched order must be flagged as sandbox demo",
  );
  assert.strictEqual(
    matchedOrder?.status,
    "PENDING_ACCEPTANCE",
    "Order must initially be PENDING_ACCEPTANCE",
  );
  assert.strictEqual(matchedOrder?.quantityQuintals, 20);
  assert.strictEqual(matchedOrder?.grossAmount, 20 * matchedOrder!.offeredPricePerQuintal);
  console.log(
    `✓ Generated demo buyer offer: ${matchedOrder?.id} with gross ₹${matchedOrder?.grossAmount}`,
  );

  // 3. Test Order Acceptance & Idempotency
  console.log("\n[Test 3] Order Acceptance & Idempotency");
  const acceptedOrder = await acceptProduceOrder(matchedOrder!.id);
  assert.strictEqual(acceptedOrder.status, "ACCEPTED", "Order status must transition to ACCEPTED");
  assert.ok(acceptedOrder.acceptedAt, "Order must have acceptedAt timestamp");

  // Check corresponding listing status
  const updatedListing = (await getAllListings()).find((l) => l.id === listing.id);
  assert.strictEqual(updatedListing?.status, "ORDERED", "Corresponding listing must be ORDERED");
  console.log("✓ Order accepted and listing transitioned to ORDERED");

  // Idempotency check: accept again
  const doubleAccepted = await acceptProduceOrder(matchedOrder!.id);
  assert.strictEqual(doubleAccepted.status, "ACCEPTED", "Double acceptance must be idempotent");
  assert.strictEqual(
    doubleAccepted.acceptedAt,
    acceptedOrder.acceptedAt,
    "Timestamp must not mutate on duplicate accept",
  );
  console.log("✓ Duplicate acceptance confirmed idempotent");

  // 4. Test Missing Order ID Error
  console.log("\n[Test 4] Missing Order ID Handling");
  await assert.rejects(
    async () => {
      await acceptProduceOrder("NONEXISTENT-ORDER-ID-9999");
    },
    {
      name: "Error",
      message: "Order NONEXISTENT-ORDER-ID-9999 not found",
    },
    "Accepting a non-existent order should throw an error",
  );
  console.log("✓ Non-existent order rejection verified");

  // 5. Test Decline Behavior
  console.log("\n[Test 5] Offer Decline Flow");
  // Create another listing to test decline
  const listingToDecline = await createProduceListing({
    crop: "Gram (Test Decline)",
    quantityQuintals: 15,
    askingPricePerQuintal: 5200,
    district: "Dewas",
    pickupLocation: "Farm Gate 2",
    farmerName: "Test Farmer 2",
    farmerPhone: "+91 99999 77777",
  });
  const orderToDecline = (await getAllOrders()).find((o) => o.listingId === listingToDecline.id);
  assert.ok(orderToDecline, "Order for decline test must exist");

  const declinedOrder = await declineProduceOrder(
    orderToDecline!.id,
    "Asking price not met by buyer",
  );
  assert.strictEqual(declinedOrder.status, "DECLINED", "Order status must be DECLINED");
  assert.strictEqual(declinedOrder.declineReason, "Asking price not met by buyer");

  const listingAfterDecline = (await getAllListings()).find((l) => l.id === listingToDecline.id);
  assert.strictEqual(
    listingAfterDecline?.status,
    "ACTIVE",
    "Listing should revert to ACTIVE after offer is declined",
  );
  console.log("✓ Offer declined, reason stored, and listing reverted to ACTIVE");

  // 6. Test Persistence (the store file is then put back byte for byte by main(), below)
  console.log("\n[Test 6] Verification of Disk Persistence");
  const rawDiskData = JSON.parse(await fs.readFile(STORE_FILE, "utf-8"));

  // Verify disk holds the records
  assert.ok(
    rawDiskData.listings.some((l: { id: string }) => l.id === listing.id),
    "Listing written to disk",
  );
  assert.ok(
    rawDiskData.orders.some((o: { id: string }) => o.id === matchedOrder!.id),
    "Order written to disk",
  );
  console.log("✓ Confirmed transactions.json accurately holds mutated records on disk");

  console.log("\n=== ALL TRANSACTION LIFECYCLE TESTS PASSED SUCCESSFULLY ===");
}

// The suite writes through the app's own store, data/transactions.json, a TRACKED file. Its old cleanup rebuilt the
// file without the test records but with a new lastUpdated and other line endings, so every run changed the file
// (found 29 Oct). Now the file's bytes from before the run are put back after it, passed or failed, and checked.
async function readBytes(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
}

async function main() {
  const before = await readBytes(STORE_FILE);
  let failure: unknown = null;
  try {
    await runLifecycleTestSuite();
  } catch (err) {
    failure = err;
  }
  // a store the run created is removed; one that was there gets its own bytes back
  if (before === null) await fs.rm(STORE_FILE, { force: true });
  else await fs.writeFile(STORE_FILE, before);
  const after = await readBytes(STORE_FILE);
  const restored = before === null ? after === null : after !== null && before.equals(after);
  if (failure) console.error("Test Suite Failed:", failure);
  if (restored) {
    console.log("✓ data/transactions.json is back to its exact bytes from before the run");
  } else {
    console.error(
      "Test Suite Failed: data/transactions.json is not back to its bytes from before the run",
    );
  }
  if (failure || !restored) process.exit(1);
}

main().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
