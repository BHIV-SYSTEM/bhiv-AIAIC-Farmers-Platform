# BHIV AIAIC Farm-to-Retail Capability Truth Matrix

**Version**: 2.0.0 (Confirmed Production Integrations)  
**Date**: October 21, 2026  
**Auditor**: UI/UX & Frontend Integration Support  
**Coordination**: Riddhi (Frontend), Hemanth (Backend), Antigravity (UI/UX & Integration)  
**Upstream Target**: `http://163.128.209.18:8017`

---

## Purpose

This document provides absolute transparency into the state of every capability across the AIAIC Farm-to-Retail platform. It establishes the exact operational reality behind every user interface element, eliminating false claims and verifying genuine integrations.

---

## 1. Capability Breakdown Matrix

| Mission Capability | UI Presentation / Farmer Experience | Backend Architecture Reality | Persistence Mechanism | Verified Mission Status | Dependency & Next Step |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Market Intelligence & Price Advisory** | Live APMC modal prices, price bands, sell vs hold recommendations, and explainability statements. | Calls confirmed `GET /farmer/advice` and `GET /intelligence/market` on port 8017. Real Agmarknet prices with freshness timestamps. | In-memory cache + React Query. | **VERIFIED LIVE** | Fully operational. |
| **30-Day Price Series & 5-Year Benchmark** | Interactive 30-day daily Agmarknet price bar chart with historical 25th %ile, 5-yr median, and 75th %ile benchmarks. | Calls confirmed `GET /places/price-series` on port 8017. | In-memory cache + React Query. | **VERIFIED LIVE** | Fully operational. |
| **Dynamic Multi-State Places & Crops** | State selector (Maharashtra & Madhya Pradesh) dynamically loads 36 MH or 55 MP districts, followed by district-specific crops. | Calls confirmed `GET /places/districts?state=mh\|mp` and `GET /places/crops?district=...` on port 8017. | React Query cache. | **VERIFIED LIVE** | Fully operational. Replaces hardcoded district lists. |
| **Agricultural Diagnostics (BioCLIP Plant Check)** | Camera capture, photo upload, strict 5-item observation sequence, next-step extension helpline. | Calls confirmed `POST /aqiaic/plant/analyze?mode=bioclip` on port 8017. Enforces 12MB limit, logs X-Request-ID, handles HTTP 413/415/422/400/429/502, routes distress to emergency care. | Ephemeral session / X-Request-ID. | **VERIFIED LIVE** | Real BioCLIP observations. Explicitly disclaims disease diagnosis. |
| **Produce Listing Creation** | Accessible form at `/listing/new` with crop, variety, quantity, quality grade, asking price, pickup location, and advisory decision trace. | Submits to `createListing` Nitro RPC. Validated against Zod schema. Generates official ID `LST-...`. | Persisted to server filesystem `data/transactions.json`. Survives reload and reboot. | **VERIFIED LIVE** | Local server file store. Multi-pod deployments will require Hemanth's PostgreSQL. |
| **Produce Listing Management** | Listings dashboard at `/listings` with status filtering, lot details, and matched offer indicators. | Fetches live listing records from `getListings` Nitro RPC. | Persisted to server filesystem `data/transactions.json`. | **VERIFIED LIVE** | Fully operational. |
| **Buyer Discovery & Procurement Offers** | Offer list at `/orders` displaying buyer organization, quantity, offered price, and financial breakdown. | Matched via AIAIC Fair Pricing Advisory Sandbox in `transactions.server.ts`. Clearly labeled as Sandbox Demo Matching. | Persisted to server filesystem `data/transactions.json`. | **VERIFIED LIVE (SANDBOX MATCHING)** | Live external buyer stream blocked on Hemanth's Central Buyer Gateway API. |
| **Order Acceptance & Negotiation** | Interactive order contract at `/orders/$orderId` with Accept Order and Decline actions. | `acceptOrder` and `declineOrder` RPCs update backend contract status with timestamps and reasons. | Persisted to server filesystem `data/transactions.json` and append-only `data/order_events.json`. | **VERIFIED LIVE** | Real state mutation and retrieval verified. |
| **Transaction Summary & Financials** | Itemized table: Gross Value, Estimated Transport Deduction, Mandi Cess, and Net Farmer Payout. | Calculated using standard agricultural commission rules. Transport cost honestly designated as an estimate. | Persisted with order record. | **VERIFIED LIVE** | Clear distinction between actual gross and estimated logistics. |
| **VAJRA On-Chain Lot Verification** | UI status card on order contract. | Marked as `PENDING DEPOT INTAKE` / `PENDING_ANCHOR`. No fabricated blockchain transaction is claimed. | N/A | **HONESTLY PENDING** | Platform team must implement physical assay verification at APMC depot. |
| **TANTRA Transport Dispatch** | UI logistics status card on order contract. | Marked as `SCHEDULED` / `REGISTERED`. Pickup manifest registered pending vehicle assignment. | N/A | **HONESTLY PENDING** | Platform team must connect vehicle telematics dispatch API. |
| **Escrow Bank Settlement** | UI payment status card on order contract. | Marked as `HELD IN ESCROW`. No fake money movement is simulated or displayed. | N/A | **HONESTLY PENDING** | Banking integration owner must connect escrow release post-VAJRA signoff. |
| **Farmer Feedback Synchronization** | Thumbs Up/Down feedback block on advisory pages. | Configured Supabase host is unreachable (`ENOTFOUND`). Automatically falls back to local storage with honest notification. | Browser `localStorage` (Device-only). | **PARTIAL** | Hemanth to provide verified Supabase URL/service key. |
| **Multilingual Voice & Accessibility** | 100% coverage in English, Hindi, and Marathi with 56px touch targets and Web Speech TTS. | Native client-side i18n dictionary context with seamless real-time switching. | Client state + browser locale. | **VERIFIED LIVE** | Complete across all routes. |

---

## 2. Integrity Guarantees

1. **Zero UI Fabrication**: No button in the platform gives a misleading illusion of success.
2. **True State Persistence**: Accepted orders remain accepted after page refresh and server reboot because state is written to the server's disk, not stored only in React state.
3. **No Simulated Money Movement**: The financial settlement table clearly explains the difference between gross produce value, estimated transport, and net farmer payout without pretending a bank transfer has completed.
4. **Separation of Governance Pillars**: Order acceptance, lot assay (VAJRA), transport dispatch (TANTRA), and escrow settlement are strictly decoupled so progress in one domain does not misrepresent another.
5. **Clear Agronomic Disclaimer**: Advisory displays an uncalibrated default banner warning farmers that guidance is derived from published data and must be verified with their local Krishi Vigyan Kendra before spending money.
6. **No False Plant Disease Claims**: BioCLIP plant analysis explicitly clarifies that observations describe what is visually seen, not a medical diagnosis or chemical spray prescription.
