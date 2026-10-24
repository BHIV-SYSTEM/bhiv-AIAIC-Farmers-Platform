import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  tradeMode,
  getMine,
  getPrice,
  nearbyMandis,
  transportEstimate,
  USERNAME_ENV,
} from "../src/lib/aiaic-trade.server";
import { synthesizeAdviceSpeech, isVaaniLanguageSupported } from "../src/lib/vaani-tts.server";
import { getAllListings, getAllOrders } from "../src/lib/transactions.server";

async function verifyAllLiveFeatures() {
  console.log("==================================================================");
  console.log("       LIVE API CONNECTION & WORKFLOW VERIFICATION SUITE          ");
  console.log("==================================================================");
  console.log("Timestamp:", new Date().toISOString());
  console.log("AIAIC_BASE_URL:", process.env.AIAIC_BASE_URL);
  console.log("AIAIC_FARMER_USERNAME:", process.env.AIAIC_FARMER_USERNAME);
  console.log("PLANT_BASE_URL:", process.env.PLANT_BASE_URL);
  console.log("VAANI_BASE_URL:", process.env.VAANI_BASE_URL);
  console.log("------------------------------------------------------------------");

  let passed = 0;
  let failed = 0;

  // 1. Trade Mode Check
  try {
    const mode = tradeMode();
    assert.equal(mode.mode, "aiaic", `Trade mode must be 'aiaic', got ${mode.mode}`);
    assert.equal(
      mode.problem,
      null,
      `Trade mode problem should be null, got: ${JSON.stringify(mode.problem)}`,
    );
    console.log("✓ [1] Trade Mode: Configured for live AIAIC over HTTPS (practice mode enabled)");
    passed++;
  } catch (err: any) {
    console.error("✗ [1] Trade Mode Failed:", err.message);
    failed++;
  }

  // 2. Farmer App Trade Data (getMine) Live Check
  try {
    const mineResult = await getMine("en");
    assert.equal(
      mineResult.ok,
      true,
      `getMine('en') failed: ${JSON.stringify(mineResult.ok ? null : mineResult.problem)}`,
    );
    if (mineResult.ok) {
      assert.equal(mineResult.data.mine.practice, true, "Account must be practice account");
      console.log(`✓ [2] Live Farmer Account & Trade Data: OK`);
      console.log(`      - Practice Mode: ${mineResult.data.mine.practice}`);
      console.log(`      - Tenant: ${mineResult.data.mine.tenant_id}`);
      console.log(`      - Listings count: ${mineResult.data.mine.listings.length}`);
      console.log(`      - Orders count: ${mineResult.data.mine.orders.length}`);
      console.log(
        `      - Profile District: ${mineResult.data.mine.profile_place.district || "None"}`,
      );
      console.log(
        `      - Localized crops loaded: ${Object.keys(mineResult.data.cropNames).length}`,
      );
      console.log(
        `      - Localized districts loaded: ${Object.keys(mineResult.data.districtNames).length}`,
      );
    }
    passed++;
  } catch (err: any) {
    console.error("✗ [2] getMine Failed:", err.message);
    failed++;
  }

  // 3. Multi-language Localization via Live Places API
  try {
    const [mineHi, mineMr] = await Promise.all([getMine("hi"), getMine("mr")]);
    assert.equal(mineHi.ok, true, "getMine('hi') should succeed");
    assert.equal(mineMr.ok, true, "getMine('mr') should succeed");
    console.log("✓ [3] Live Localization (HI & MR): OK");
    if (mineHi.ok) {
      console.log(
        `      - Hindi districts mapped: ${Object.keys(mineHi.data.districtNames).length}`,
      );
    }
    if (mineMr.ok) {
      console.log(
        `      - Marathi districts mapped: ${Object.keys(mineMr.data.districtNames).length}`,
      );
    }
    passed++;
  } catch (err: any) {
    console.error("✗ [3] Localization Failed:", err.message);
    failed++;
  }

  // 4. Live Reference Price API
  try {
    const priceRes = await getPrice({ crop: "Soybean", state: "MH", district: "Kolhapur" });
    assert.equal(
      priceRes.ok,
      true,
      `getPrice failed: ${JSON.stringify(priceRes.ok ? null : priceRes.problem)}`,
    );
    if (priceRes.ok) {
      console.log("✓ [4] Live Reference Price Lookup: OK");
      console.log(`      - Crop: ${priceRes.data.crop}`);
      console.log(`      - Suggested Ask: ₹${priceRes.data.suggested_ask_per_q}/q`);
      console.log(`      - Source: ${priceRes.data.source_name || "Agmarknet"}`);
      console.log(`      - Mandis Reporting: ${priceRes.data.mandis_reporting}`);
    }
    passed++;
  } catch (err: any) {
    console.error("✗ [4] getPrice Failed:", err.message);
    failed++;
  }

  // 5. Live Transport Mandis & Distance API
  let pickedMandi = "Kolhapur(Malkapur)";
  try {
    const mandisRes = await nearbyMandis({ district: "Kolhapur", state: "MH", limit: 3 });
    assert.equal(
      mandisRes.ok,
      true,
      `nearbyMandis failed: ${JSON.stringify(mandisRes.ok ? null : mandisRes.problem)}`,
    );
    if (mandisRes.ok) {
      console.log("✓ [5] Live Transport Mandis: OK");
      console.log(`      - Mandis returned: ${mandisRes.data.mandis.length}`);
      for (const m of mandisRes.data.mandis) {
        console.log(`        • ${m.mandi}: ~${m.road_km_estimate || m.straight_km} km`);
      }
      const eligible =
        mandisRes.data.mandis.find((m) => m.straight_km >= 5) ?? mandisRes.data.mandis[0];
      if (eligible) pickedMandi = eligible.mandi;
    }
    passed++;
  } catch (err: any) {
    console.error("✗ [5] nearbyMandis Failed:", err.message);
    failed++;
  }

  // 6. Live Transport Cost Estimation API
  try {
    // Test 6a: Inter-mandi estimate for produce transit (as TransportCostCard executes)
    const estRes = await transportEstimate({
      mandi: pickedMandi,
      quantity_q: 15,
      district: "Kolhapur",
      state: "MH",
      from_place: "farm",
    });
    assert.equal(
      estRes.ok,
      true,
      `transportEstimate failed: ${JSON.stringify(estRes.ok ? null : estRes.problem)}`,
    );
    if (estRes.ok) {
      console.log(`✓ [6] Live Transport Cost Estimation (${pickedMandi}): OK`);
      console.log(
        `      - Estimated Cost: ₹${estRes.data.cost.low_rs} - ₹${estRes.data.cost.high_rs}`,
      );
      console.log(
        `      - Vehicle Recommended: ${estRes.data.vehicle.name} (${estRes.data.vehicle.key})`,
      );
      console.log(`      - Trips needed: ${estRes.data.trips}`);
      console.log(
        `      - Distance: ${estRes.data.distance.km} km (${estRes.data.distance.method})`,
      );
    }

    // Test 6b: Verification of AIAIC boundary condition (APMC Kolhapur from farm returns too_near_to_measure)
    const localEst = await transportEstimate({
      mandi: "APMC Kolhapur",
      quantity_q: 15,
      district: "Kolhapur",
      state: "MH",
      from_place: "farm",
    });
    assert.equal(localEst.ok, false, "Local farm-to-centre trip must return structured refusal");
    if (!localEst.ok) {
      assert.equal(
        localEst.problem.code,
        "too_near_to_measure",
        "Expected too_near_to_measure code",
      );
      console.log(
        `      - Boundary Guard (Local Center): Correctly returned '${localEst.problem.code}'`,
      );
    }

    passed++;
  } catch (err: any) {
    console.error("✗ [6] transportEstimate Failed:", err.message);
    failed++;
  }

  // 7. Live Plant Photo Intelligence API
  try {
    const form = new FormData();
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const blob = new Blob([tinyPng], { type: "image/png" });
    form.append("file", blob, "test_leaf.png");
    form.append("crop", "tomato");
    form.append("mode", "bioclip");
    form.append("lang", "en");
    form.append("state", "mh");

    const plantRes = await fetch(
      "https://krishisampada.blackholeinfiverse.com/api/aqiaic/plant/analyze",
      {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      },
    );
    assert.equal(plantRes.status, 200, `Plant API returned ${plantRes.status}`);
    const plantJson = await plantRes.json();
    assert.ok(plantJson && typeof plantJson === "object", "Plant JSON must be an object");
    console.log("✓ [7] Live Plant Diagnostic Intelligence: OK");
    console.log(`      - Status: HTTP ${plantRes.status}`);
    console.log(`      - Subject crop: ${plantJson.subject?.crop}`);
    console.log(`      - Verdict: ${plantJson.image_resolution?.verdict}`);
    passed++;
  } catch (err: any) {
    console.error("✗ [7] Plant Intelligence Failed:", err.message);
    failed++;
  }

  // 8. Sovereign Vaani TTS Service
  try {
    assert.equal(isVaaniLanguageSupported("hi"), true, "Hindi must be supported by Vaani");
    assert.equal(
      isVaaniLanguageSupported("mr"),
      false,
      "Marathi is known to not be supported by Vaani",
    );

    const ttsRes = await synthesizeAdviceSpeech({
      text: "नमस्ते किसान भाई। आज आपकी फसल के लिए मौसम अनुकूल है।",
      language: "hi",
      voiceProfile: "vaani_teacher",
    });
    assert.equal(ttsRes.ok, true, `Vaani TTS failed: ${ttsRes.ok ? null : ttsRes.message}`);
    if (ttsRes.ok) {
      assert.ok(ttsRes.audioBuffer.byteLength > 1000, "Audio buffer must be > 1000 bytes");
      console.log("✓ [8] Sovereign Vaani TTS Engine: OK");
      console.log(`      - Language: Hindi ('hi')`);
      console.log(`      - Audio format: ${ttsRes.contentType}`);
      console.log(`      - Audio size: ${ttsRes.audioBuffer.byteLength} bytes`);
    }
    passed++;
  } catch (err: any) {
    console.error("✗ [8] Vaani TTS Failed:", err.message);
    failed++;
  }

  // 9. Local Transaction Data Store & Fallback Integrity
  try {
    const listings = await getAllListings();
    const orders = await getAllOrders();
    assert.ok(Array.isArray(listings), "Listings must be an array");
    assert.ok(Array.isArray(orders), "Orders must be an array");
    console.log("✓ [9] Local Store & Transactions Fallback: OK");
    console.log(`      - Seed listings: ${listings.length}`);
    console.log(`      - Seed orders: ${orders.length}`);
    passed++;
  } catch (err: any) {
    console.error("✗ [9] Local Store Failed:", err.message);
    failed++;
  }

  console.log("==================================================================");
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
}

verifyAllLiveFeatures().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
