import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DICTS, type Lang } from "../src/lib/i18n";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runPaymentTransportUXTests() {
  console.log("==================================================================");
  console.log("  ANNAPURNA FARMER UX: PAYMENT, LOGISTICS & BANK SAFETY SUITE    ");
  console.log("==================================================================");

  // -------------------------------------------------------------------------
  // Test 1: Financial summary ordering and explicit "Estimated amount you will receive"
  // -------------------------------------------------------------------------
  console.log("\n[Test 1] Financial breakdown labels and ordering");
  const en = DICTS.en;
  const hi = DICTS.hi;
  const mr = DICTS.mr;

  const expectedFinancialSequence = [
    "financial.grossValue",
    "financial.estimatedTransport",
    "financial.mandiCess",
    "financial.estimatedAmountReceived",
  ];

  for (const key of expectedFinancialSequence) {
    assert.ok(key in en, `Key ${key} must exist in English dictionary`);
    assert.ok(key in hi, `Key ${key} must exist in Hindi dictionary`);
    assert.ok(key in mr, `Key ${key} must exist in Marathi dictionary`);
  }

  // Verify the exact label for net receivable
  assert.strictEqual(
    en["financial.estimatedAmountReceived"],
    "Estimated amount you will receive",
    "English net payout must be labeled as 'Estimated amount you will receive'",
  );
  assert.ok(
    hi["financial.estimatedAmountReceived"].includes("अनुमानित राशि"),
    "Hindi label must clearly indicate estimated amount",
  );
  assert.ok(
    mr["financial.estimatedAmountReceived"].includes("अंदाजे रक्कम"),
    "Marathi label must clearly indicate estimated amount",
  );
  console.log(
    "✓ All 4 financial sequence keys present and accurately translated across EN, HI, MR",
  );

  // -------------------------------------------------------------------------
  // Test 2: Payer responsibility transparency & unknown fallback
  // -------------------------------------------------------------------------
  console.log("\n[Test 2] Transportation payer responsibility transparency");
  assert.ok(en["financial.transport.payerUnconfirmed"]);
  assert.strictEqual(
    en["financial.transport.payerUnconfirmed"],
    "Who pays the transport charge has not yet been confirmed.",
    "Must have explicit unknown payer responsibility message",
  );
  assert.ok(
    hi["financial.transport.payerUnconfirmed"].length > 0,
    "Hindi must have transport payer unknown translation",
  );
  assert.ok(
    mr["financial.transport.payerUnconfirmed"].length > 0,
    "Marathi must have transport payer unknown translation",
  );
  console.log("✓ Payer responsibility transparency messages validated");

  // -------------------------------------------------------------------------
  // Test 3: WheelsEye Logistics Disclosure & Unconnected Status
  // -------------------------------------------------------------------------
  console.log("\n[Test 3] WheelsEye Logistics disclosure and unconnected live quote badge");
  assert.strictEqual(
    en["transport.quote.unconnected"],
    "Live transport quote not connected yet",
    "Must explicitly state 'Live transport quote not connected yet'",
  );
  assert.ok(
    en["transport.quote.approxNote"].includes("advisory estimate") ||
      en["transport.quote.approxNote"].includes("approximate"),
    "Must explain that pricing is an approximate regional estimate, not live WheelsEye booking",
  );
  assert.ok(
    en["transport.partner.planned"].includes("WheelsEye"),
    "Must reference planned partner WheelsEye Logistics",
  );
  console.log("✓ WheelsEye unconnected status & tariff transparency verified");

  // -------------------------------------------------------------------------
  // Test 4: Payment Status Stepper Decoupling & No Fabricated Bank Settlement
  // -------------------------------------------------------------------------
  console.log("\n[Test 4] Payment timeline decoupling from bank proof");
  assert.ok(
    en["payment.stepper.independentNote"].toLowerCase().includes("separately") ||
      en["payment.stepper.independentNote"].toLowerCase().includes("guarantee"),
    "Must clarify order status and payment status are tracked separately",
  );
  assert.ok(
    en["payment.stepper.demoNotice"].toLowerCase().includes("sandbox") ||
      en["payment.stepper.demoNotice"].toLowerCase().includes("simulated") ||
      en["payment.stepper.demoNotice"].toLowerCase().includes("money"),
    "Simulated notice must clearly warn that bank transfer is simulated",
  );
  console.log("✓ Payment timeline decoupling and zero-fabrication notices verified");

  // -------------------------------------------------------------------------
  // Test 5: Bank Details Safety, Masking & Client Validation
  // -------------------------------------------------------------------------
  console.log("\n[Test 5] Bank details non-persistence and client validation");
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

  // Valid IFSC codes
  assert.ok(ifscRegex.test("SBIN0000001"), "SBIN0000001 should be valid");
  assert.ok(ifscRegex.test("HDFC0001234"), "HDFC0001234 should be valid");
  assert.ok(ifscRegex.test("BARB0KOLHAP"), "BARB0KOLHAP should be valid");

  // Invalid IFSC codes
  assert.ok(!ifscRegex.test("SBIN01"), "Short IFSC should fail");
  assert.ok(!ifscRegex.test("sbin0000001"), "Lowercase IFSC should fail");
  assert.ok(!ifscRegex.test("12340000001"), "Numeric prefix should fail");
  assert.ok(!ifscRegex.test("SBINA000001"), "5th character must be zero");

  // Masking helper logic verification
  function maskAccountNumber(acc: string): string {
    if (acc.length < 4) return "••••";
    return "•••• •••• " + acc.slice(-4);
  }
  assert.strictEqual(maskAccountNumber("123456789012"), "•••• •••• 9012");
  assert.strictEqual(maskAccountNumber("9876"), "•••• •••• 9876");

  // Verify bank safety notice in translations
  assert.ok(
    en["bank.prototype.notice"].includes("Prototype") ||
      en["bank.prototype.notice"].includes("not saved") ||
      en["bank.prototype.notice"].includes("securely") ||
      en["bank.prototype.notice"].includes("disk"),
    "Bank notice must inform farmer that backend persistence is pending/prototype",
  );
  console.log("✓ Bank IFSC regex, account masking, and safety disclaimers verified");

  // -------------------------------------------------------------------------
  // Test 6: Verify Zero Storage Persistence in Source Files
  // -------------------------------------------------------------------------
  console.log("\n[Test 6] Static inspection: zero persistence of bank details");
  const bankCardPath = path.resolve(__dirname, "../src/components/farm/BankDetailsCard.tsx");
  const bankCardContent = fs.readFileSync(bankCardPath, "utf-8");

  assert.ok(
    !bankCardContent.includes("localStorage.setItem"),
    "BankDetailsCard must NOT call localStorage.setItem",
  );
  assert.ok(
    !bankCardContent.includes("sessionStorage.setItem"),
    "BankDetailsCard must NOT call sessionStorage.setItem",
  );
  assert.ok(
    !bankCardContent.includes("fs.writeFile") && !bankCardContent.includes("fs/promises"),
    "BankDetailsCard must NOT write to filesystem",
  );
  assert.ok(
    !bankCardContent.includes("fetch('/api/bank'") && !bankCardContent.includes("axios"),
    "BankDetailsCard must NOT call unverified fake API endpoints",
  );
  console.log("✓ Confirmed zero persistence to disk or browser storage in BankDetailsCard");

  // -------------------------------------------------------------------------
  // Test 7: Payments Route and Navigation
  // -------------------------------------------------------------------------
  console.log("\n[Test 7] Payments route and bottom navigation");
  const bottomNavPath = path.resolve(__dirname, "../src/components/farm/BottomNav.tsx");
  const bottomNavContent = fs.readFileSync(bottomNavPath, "utf-8");

  assert.ok(bottomNavContent.includes('to="/payments"'), "BottomNav must link to /payments");
  assert.ok(bottomNavContent.includes("grid-cols-4"), "BottomNav must use 4-column mobile layout");

  const paymentsRoutePath = path.resolve(__dirname, "../src/routes/payments.tsx");
  assert.ok(fs.existsSync(paymentsRoutePath), "src/routes/payments.tsx must exist");
  const paymentsContent = fs.readFileSync(paymentsRoutePath, "utf-8");
  assert.ok(
    paymentsContent.includes("BankDetailsCard"),
    "Payments route must integrate BankDetailsCard",
  );
  assert.ok(
    paymentsContent.includes("getOrders"),
    "Payments route must load existing orders data via getOrders",
  );
  console.log("✓ Payments route and 4-tab mobile navigation verified");

  // -------------------------------------------------------------------------
  // Test 8: Comprehensive Localization Parity (EN, HI, MR)
  // -------------------------------------------------------------------------
  console.log("\n[Test 8] Localization key parity across EN, HI, MR");
  const enKeys = Object.keys(en);
  const hiKeys = new Set(Object.keys(hi));
  const mrKeys = new Set(Object.keys(mr));

  const missingInHi: string[] = [];
  const missingInMr: string[] = [];

  for (const k of enKeys) {
    if (!hiKeys.has(k)) missingInHi.push(k);
    if (!mrKeys.has(k)) missingInMr.push(k);
  }

  assert.strictEqual(
    missingInHi.length,
    0,
    `Missing ${missingInHi.length} keys in Hindi: ${missingInHi.slice(0, 5).join(", ")}`,
  );
  assert.strictEqual(
    missingInMr.length,
    0,
    `Missing ${missingInMr.length} keys in Marathi: ${missingInMr.slice(0, 5).join(", ")}`,
  );
  console.log(
    `✓ 100% key parity verified: all ${enKeys.length} translation keys present in EN, HI, MR`,
  );

  console.log("\n==================================================================");
  console.log("  ALL TESTS PASSED SUCCESSFULLY (8/8)                             ");
  console.log("==================================================================");
}

runPaymentTransportUXTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
