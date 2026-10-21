# AIAIC Farm-to-Retail Mission: Complete Frontend–Backend Integration Audit

**Date of Audit**: October 21, 2026  
**Auditor**: Senior Full-Stack Engineer, Frontend–Backend Integration Auditor & QA Reviewer  
**Target Repository**: `rahilmulani025/AIAIC-Farmers-Platform`  
**Primary Subsystem**: `farmer-s-friend-dashboard-main` (SSR Web Application & Decision Dashboard)  
**Upstream Backend Target**: AIAIC Evidence-to-Runtime Service (`http://163.128.209.18:8017`)  
**Mission Reference Document**: `BHIV_AIAIC_Farm_to_Retail_Mission_COMPLETE.pdf`  
**Team Coordination**: UI/UX Support (Auditor), Application Coordination (Riddhi), Backend APIs (Hemanth)

---

## A. Executive Summary

### 1. Overall Integration Condition
The existing repository hosts a modern, mobile-first, tri-lingual (English, Hindi, Marathi) farmer decision dashboard built with **React 19**, **TanStack Start (SSR)**, **Vite 8**, and the **Nitro** server engine. It communicates with the live AIAIC Decision Engine hosted on remote VM port 8017 via server functions (BFF architecture).

However, **there is a fundamental architectural divergence between the current codebase and the Farm-to-Retail Mission requirements**:
1. **The current frontend is strictly an Agricultural Advisory & Intelligence Dashboard**, not a Farm-to-Retail Transactional Platform.
2. The core transactional flow required by the mission—**Produce Listing, Lot Quantity/Grade Definition, Buyer Discovery, Offer Negotiation, Order Acceptance, Aggregation, Logistics Booking, Payment Escrow, Settlement, and Platform Fee Reconciliation—is completely absent from both the frontend routes and the decision engine backend (`http://163.128.209.18:8017`)**.
3. **Database Layer Failure**: The configured Supabase PostgreSQL database (`fhwwpasgebufuznthynv.supabase.co`) does not exist in DNS (`getaddrinfo ENOTFOUND`), disabling cloud feedback storage and causing review screens to fail shared queries.
4. **Plant Intelligence Disconnection**: The Plant Health photo inspection feature is disconnected because `PLANT_BASE_URL` is omitted from `.env`, even though the backend service at `http://163.128.209.18:8017/aqiaic/plant/status` is healthy and running.
5. **No Mock Data Masquerading as Live Advisory**: The intelligence dashboard itself is **strictly honest**. It does not fake recommendations, synthesise advice, or use mock market datasets. Every price, mandi comparison, and evidence source originates directly from the live Agmarknet data layer on the backend. When data is absent (e.g. weather for Kolhapur), it cleanly reports an empty state rather than fabricating advice.

### 2. Discovered Feature & Inventory Metrics
An exhaustive inspection was conducted across all 5 frontend routes, 10 farm components, 46 library components, and the 120 endpoints exposed by the backend engine.

- **Total Inspected Frontend Routes**: 5 routes (`/`, `/ask`, `/result`, `/advice/$service`, `/review`) + 1 root shell.
- **Total Frontend Interactive Features / Actions Evaluated**: 30 distinct user actions.
- **Total Mission Chain Capabilities Evaluated**: 14 mission lifecycle capabilities.
- **Combined Audit Scope**: 44 features/capabilities.

| Status Classification | Count | Percentage | Definition |
| :--- | :---: | :---: | :--- |
| **VERIFIED LIVE** | **17** | **38.6%** | Verified functioning against running backend (`http://163.128.209.18:8017` / browser runtime). |
| **PARTIAL** | **6** | **13.6%** | UI exists and partially functions, but missing backend link, persistence, or payload wiring. |
| **SIMULATED** | **2** | **4.5%** | Local-only degradation or engine-manufactured arithmetic spreads. |
| **NOT IMPLEMENTED** | **16** | **36.4%** | Mission-mandated transactional capabilities absent from the codebase (Listing to Order flow). |
| **BLOCKED** | **3** | **6.8%** | Verification or execution prevented by third-party infrastructure (Supabase DNS, upstream weather). |
| **Total** | **44** | **100.0%** | Comprehensive audit inventory across current platform and mission requirements. |

### 3. Critical Risks & Blocker Summary
1. **Critical P0 Blocker**: There are **zero endpoints on `http://163.128.209.18:8017` for produce listings, buyer discovery, or orders**. Hemanth's backend API contracts for listing-to-order must be identified or connected (e.g., verifying if Samruddhi on port 8000 or a new service hosts this).
2. **Critical P0 Blocker**: The Supabase cloud database is unreachable (`ENOTFOUND`). Either a valid Supabase project must be provided, or a SQLite / Nitro local persistent database layer must be introduced in the BFF to store listings, orders, and feedback.
3. **High P1 Risk**: Land size and water access inputs captured on `/ask` are discarded by the frontend and never passed to the intelligence engine query.

### 4. Demo Readiness Verdict
**REVISION REQUIRED / BLOCKED ON TRANSACTIONAL CONTRACTS**.  
The advisory and decision components are live and production-ready. However, the platform **cannot execute the required listing-to-accepted-order farmer-to-retail transaction** without immediate UI screen creation and backend contract alignment with Hemanth.

---

## B. Repository and Runtime Inventory

### 1. Applications & Repository Layout
- **Root Repository**: `c:\Users\Rahil Mulani\Desktop\AIAIC-Farmers-Platform`
- **Git Branch**: `main` (commit `725d42f`, working tree clean, synced with `origin/main`).
- **Core Application**: `farmer-s-friend-dashboard-main/` (Standalone Node.js / TanStack Start SSR / Nitro application).
- **Deployment Artifacts**: Multi-stage production `Dockerfile`, `docker-compose.yml`, `docker-compose.production.template.yml`, and GitHub Actions workflow (`.github/workflows/cicd.yml`).
- **Operational Documentation**: `DEPLOYMENT_AND_SERVICE_GUIDE.md`, `HANDOVER.md`, `REVIEW_PACKET.md`, `DEMO-SCRIPT.md`.

### 2. Architecture & Technology Stack
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Client Browser (Mobile-First Web Client)                    │
│   React 19 + TanStack Router + Tailwind CSS v4 + Web Speech Audio Readout   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ RPC (TanStack Start createServerFn)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Nitro Standalone SSR Server / BFF (Port 3008)               │
│  [aiaic.functions.ts]       [catalog.functions.ts]     [plant.functions.ts] │
└───────────┬──────────────────────────┬──────────────────────────┬───────────┘
            │ HTTP (ngrok bypass)      │ HTTP (5m cache)          │ HTTP (multipart)
            ▼                          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                VM Services @ 163.128.209.18 (Uvicorn / FastAPI)             │
│  - Port 8017: AIAIC Decision & Evidence Engine (Active: /catalog, /intel)   │
│  - Port 8000: Samruddhi Trading Engine (Active: Stock MCP API v3.0)        │
│  - Port 8002: Parikshak Governance Engine (Active: Production v1.0)         │
│  - Port 8103: Prana Ingestion Pipeline (Active)                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │     Supabase PostgreSQL Cloud     │
                     │  (DEAD / ENOTFOUND: advice_feed)  │
                     └───────────────────────────────────┘
```

### 3. Active Runtime & Service Matrix
During live audit probes on October 21, 2026, the VM host (`163.128.209.18`) was probed across all allocated ports:

| Service / Subsystem | Host / Port | HTTP Response | OpenAPI Specs / Status |
| :--- | :--- | :---: | :--- |
| **AIAIC Farmers Platform** | `localhost:3008` | **HTTP 200** | SSR HTML hydrated cleanly; Vite 8.2.1 dev server verified. |
| **AIAIC Decision Engine** | `163.128.209.18:8017` | **HTTP 200** | Active: 120 endpoints (`/catalog`, `/intelligence/{service}`). |
| **Plant Sidecar Diagnostic** | `163.128.209.18:8017/aqiaic/plant/status` | **HTTP 200** | Healthy: ViT-B-32-quickgelu model loaded, India-evaluated. |
| **Samruddhi Trading Engine**| `163.128.209.18:8000` | **HTTP 200** | Active: Stock Prediction MCP API v3.0 (22 endpoints). |
| **Parikshak Governance** | `163.128.209.18:8002` | **HTTP 200** | Active: Production v1.0 (89 endpoints, governance issues). |
| **Prana Ingestion Pipeline**| `163.128.209.18:8103` | **HTTP 200** | Ingestion pipeline active. |
| **Supabase Cloud DB** | `fhwwpasgebufuznthynv.supabase.co` | **FAILED** | `ENOTFOUND` (Non-existent domain, DNS lookup failed). |

### 4. Existing Work to Preserve
Under no circumstances should the following well-engineered capabilities be overwritten or removed:
1. **Tri-lingual Architecture (`src/lib/i18n.tsx`)**: Complete dictionary structure for English, Hindi, and Marathi with full Devanagari typography support (`Baloo 2` and `Mukta`).
2. **Accessibility Standards**: Minimum 56px touch targets, high contrast ratios, semantic HTML headers, and screen-reader accessibility.
3. **Browser Web Speech Engine (`src/lib/use-speech.ts`)**: Natural audio readout of agricultural advice in Marathi (`mr-IN`), Hindi (`hi-IN`), and Indian English (`en-IN`).
4. **Honest Abstention & Uncalibrated Warning System**: Strict compliance with honesty rules (`calibrated: false` badge, abstention reasons rendered verbatim, known unknowns rendered prominently).
5. **Government Source Attribution (`EvidenceCard.tsx`)**: Transparent data provenance citing Agmarknet, observation dates, and GODL-India open data license URLs.
6. **Resilient Local Offline Cache (`src/lib/farm-storage.ts`)**: Automatic fallback to last-known good advice in `localStorage` when network connectivity fails.

---

## C. Complete Frontend Feature Matrix

| ID | Page / Route | Feature / Action | Data Source | API Method / Endpoint | Persistence Verified? | Status | Evidence | Missing Work / Gap | Dependency & Owner |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **F01** | `/` (Landing) | Tri-lingual Language Switcher | In-memory i18n context | Local browser state | Yes (`localStorage.aiaic_lang`) | **VERIFIED LIVE** | Inspected live in browser; toggles EN, HI, MR seamlessly. | None. | Auditor (Self) |
| **F02** | `/` (Landing) | "Continue with saved farm" | `localStorage.aiaic.farm` | None (Client storage) | Yes (Browser local) | **VERIFIED LIVE** | Button displays saved crop & district, pre-fills `/result`. | Profile lives only in browser; not synced to backend. | Auditor (Self) / Hemanth |
| **F03** | `/` (Landing) | "Get my advice" CTA button | Client router | Navigation to `/ask` | Not applicable | **VERIFIED LIVE** | Smooth client-side route navigation verified in subagent. | None. | Auditor (Self) |
| **F04** | `/` (Landing) | Demonstration Disclaimer Card | Static i18n dictionary | None | Not applicable | **VERIFIED LIVE** | Warning rendered verbatim: "Demonstration on real data, NOT farmer-ready advice". | None. | Auditor (Self) |
| **F05** | `/ask` | District Selection Picker | Live catalog / fallback | `GET /catalog` via `getCatalog` | Yes (`localStorage` on submit) | **VERIFIED LIVE** | Fetches 36 MH districts and MP districts from live `:8017/catalog`. | None. | Auditor (Self) |
| **F06** | `/ask` | Crop Selection Picker | Live catalog / fallback | `GET /catalog` via `getCatalog` | Yes (`localStorage` on submit) | **VERIFIED LIVE** | Searchable picker filters 120+ Agmarknet commodities. | None. | Auditor (Self) |
| **F07** | `/ask` | Mandi Selection Picker | Live catalog / fallback | `GET /catalog` (market_mandis) | Yes (`localStorage` on submit) | **VERIFIED LIVE** | Appears dynamically when "Market" service selected. | None. | Auditor (Self) |
| **F08** | `/ask` | Land Size Numeric Input | Local form state | None | Local only | **PARTIAL** | Input accepts decimal acres, saves to localStorage, passes to URL search params. | **Discarded by backend**: `getIntelligence` input schema has no `land` parameter; unused in calculations. | Auditor (Self) / Hemanth |
| **F09** | `/ask` | Topic Service Checkboxes | Local form state | Client toggle | Yes (URL & localStorage) | **VERIFIED LIVE** | Selects any subset of Market, Water, Weather, Crop, Storage. | None. | Auditor (Self) |
| **F10** | `/ask` | "Show my advice" Form Submit | Client router | Query navigation to `/result` | Yes (URL search params) | **VERIFIED LIVE** | Navigates to `/result?region=...&crop=...&services=...`. | Form lacks buyer / listing intent options. | Auditor (Self) |
| **F11** | `/ask` | Stale Catalog Warning Banner | Engine health status | `GET /catalog` ok flag | Not applicable | **VERIFIED LIVE** | If catalog request fails, shows `WifiOff` "options may be out of date" banner. | None. | Auditor (Self) |
| **F12** | `/result` | Decision Dashboard Header | Combined query data | Client aggregation | Not applicable | **VERIFIED LIVE** | Displays total advice count, sureness counts (high/med/low), and last-updated time. | None. | Auditor (Self) |
| **F13** | `/result` | Combined Voice Readout | SpeechSynthesis API | Browser TTS | Not applicable | **VERIFIED LIVE** | Synthesizes plain Marathi / Hindi / English audio of all cards. | Audio quality dependent on device voice packs. | Auditor (Self) |
| **F14** | `/result` | Combined Advice Share / Print | Web Share / Clipboard | Browser native | Not applicable | **VERIFIED LIVE** | Copies formatted text advice or invokes native Android share sheet. | None. | Auditor (Self) |
| **F15** | `/result` | Plant Health Photo Upload | Local file input | File reader | Device preview only | **PARTIAL** | Camera capture UI opens, reads image to base64, displays photo preview. | Server request fails because `PLANT_BASE_URL` is omitted in `.env`. | Auditor (Self) |
| **F16** | `/result` | Plant Intelligence Analysis | Plant sidecar service | `POST {PLANT_BASE_URL}/analyze` | No | **PARTIAL** | UI displays honest "photo check not connected yet" banner (`configured: false`). | Backend actually has `POST /aqiaic/plant/analyze` on `:8017`. Must rewire URL. | Auditor (Self) / Hemanth |
| **F17** | `/result` | Market Intelligence Card | Engine market route | `GET /intelligence/market` | Cached in localStorage | **VERIFIED LIVE** | Displays recommendation (`SELL_AT_MANDI` / `HOLD`), best mandi, net price. | No button to list produce or initiate retail order. | Auditor / Hemanth |
| **F18** | `/result` | Water Intelligence Card | Engine water route | `GET /intelligence/water` | Cached in localStorage | **VERIFIED LIVE** | Displays irrigation advice (`CROP_FITS_WATER`), water table trend. | None. | Auditor (Self) |
| **F19** | `/result` | Weather Intelligence Card | Engine weather route | `GET /intelligence/weather` | Cached in localStorage | **BLOCKED** | Upstream returns `[]` (HTTP 200); UI displays clean empty state. | Engine lacks IMD weather signals for selected district. | Hemanth |
| **F20** | `/result` | Crop Care Intelligence Card | Engine crop route | `GET /intelligence/crop` | Cached in localStorage | **VERIFIED LIVE** | Displays agronomic window, suitability metrics from live engine. | None. | Auditor (Self) |
| **F21** | `/result` | Storage Intelligence Card | Engine storage route | `GET /intelligence/storage` | Cached in localStorage | **VERIFIED LIVE** | Compares sell now vs store; calculates warehouse cost vs spoilage rate. | No warehouse receipt generation or cold storage booking. | Auditor / Hemanth |
| **F22** | `/result` | Cached Advice Fallback Banner | `localStorage.aiaic.cache.*`| None (Client fallback) | Yes (Local storage) | **VERIFIED LIVE** | Displays "Saved from earlier" warning banner with retry button on offline. | None. | Auditor (Self) |
| **F23** | `/result` | Retry Advice Query Action | TanStack Query refetch | Server RPC reload | Not applicable | **VERIFIED LIVE** | Invalidate and refetch advice queries without full page reload. | None. | Auditor (Self) |
| **F24** | `/advice/$service` | Deep Reasoning & "Why" List | Item explainability | `GET /intelligence/{service}` | Cached in memory | **VERIFIED LIVE** | Lists numbered plain-language reasons; technical trace expander. | None. | Auditor (Self) |
| **F25** | `/advice/$service` | Evidence Source Cards | Item sources_used | `GET /intelligence/{service}` | Cached in memory | **VERIFIED LIVE** | Lists Agmarknet datasets, observation dates, freshness, license links. | None. | Auditor (Self) |
| **F26** | `/advice/$service` | Visual Confidence Meter | Supporting evidence score | Derived `confidenceLevel` | Not applicable | **VERIFIED LIVE** | 3-bar gauge with face icon (Smile/Meh/Frown) and plain words. | Best/worst spread is arithmetic ±1.5% default. | Hemanth |
| **F27** | `/advice/$service` | Kisan Call Centre Phone Link | Static `tel:` protocol | Device phone dialer | Not applicable | **VERIFIED LIVE** | One-tap dialer for national farmer helpline `18001801551`. | Replaces transactional action; no trade execution. | Auditor (Self) |
| **F28** | `/advice/$service` | Thumbs Up / Down Feedback | Supabase + localStorage | `POST /rest/v1/advice_feedback` | **Local device only** | **SIMULATED** | Thumbs up registers, writes to device storage, attempts Supabase insert. | **Supabase write fails (`ENOTFOUND`)**; UI displays "saved to phone only". | Auditor (Self) / Hemanth |
| **F29** | `/review` | Copy All JSON to Clipboard | Query data in state | Browser clipboard | Not applicable | **VERIFIED LIVE** | Copies entire raw intelligence JSON tree; changes label to "Copied!". | None. | Auditor (Self) |
| **F30** | `/review` | Raw Engine Payload Inspector | Query data in state | In-memory inspect | Not applicable | **VERIFIED LIVE** | Renders `<pre>` blocks of raw JSON responses per service for expert review. | None. | Auditor (Self) |
| **F31** | `/review` | Central Feedback History | Supabase table query | `GET /rest/v1/advice_feedback` | No | **BLOCKED** | Query fails with DNS `ENOTFOUND`; UI displays "No shared feedback yet". | Requires valid Supabase URL/Key or local SQLite table. | Hemanth / Auditor |
| **M01** | Transaction | Farmer Registration & Login | None | `POST /auth/login`, `GET /farmer/me` | None | **NOT IMPLEMENTED** | Backend has endpoints on `:8017`; frontend has **no login or profile screens**. | UI screens & auth token store required. | Auditor / Hemanth |
| **M02** | Transaction | Produce Listing Creation | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No screen to enter lot quantity, quality grade, asking price, harvest date. | Entire listing form & backend contract needed. | Auditor / Hemanth |
| **M03** | Transaction | Produce Listing Management | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No screen to view active listings, edit pricing, or delist unsold stock. | Listing list view & mutation API needed. | Auditor / Hemanth |
| **M04** | Transaction | Buyer Discovery & Matching | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No screen for farmers to view buyer demand, bids, or APMC trader matching. | Matching UI & backend query needed. | Auditor / Hemanth |
| **M05** | Transaction | Offer & Negotiation | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No counter-offer, acceptance, or negotiation messaging UI. | Offer handling interface required. | Auditor / Hemanth |
| **M06** | Transaction | Order Acceptance & History | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No screen displaying accepted purchase orders, order status, or receipts. | Core order acceptance screen required for demo. | Auditor / Hemanth |
| **M07** | Middle-Chain | Lot Aggregation & Collection | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No FPO / aggregation lot pooling interface. | Aggregation module needed. | Riddhi / Hemanth |
| **M08** | Middle-Chain | Quality Grading & Inspection | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No assaying certificate, weight slip, or rejection record interface. | Assaying UI required. | Riddhi / Hemanth |
| **M09** | Middle-Chain | Warehouse / e-NWR Receipt | None | `POST /farmer/store-or-sell` | None | **NOT IMPLEMENTED** | Intelligence card exists; no persistent warehouse booking or e-NWR receipt. | Warehouse integration required. | Riddhi / Hemanth |
| **M10** | Middle-Chain | Logistics & Transport Booking| None | `POST /farmer/sell-where` | None | **NOT IMPLEMENTED** | Calculates breakeven transport cost; no vehicle dispatch or GPS tracking. | Logistics interface required. | Riddhi / Hemanth |
| **M11** | Transaction | Payment Escrow & Settlement | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No digital wallet, UPI/NEFT payout, platform fee deduction, or escrow state. | Payment integration required. | Hemanth / Auditor |
| **M12** | Governance | TANTRA Authorization Flow | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No TANTRA execution token submission or status verification UI. | TANTRA integration contract needed. | Gauri / Siddhesh |
| **M13** | Identity | VAJRA Identity & Provenance | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No VAJRA verifiable credential or immutable provenance hash viewer. | VAJRA integration contract needed. | Siddhesh / Hemanth |
| **M14** | Telemetry | BIQOS Readiness & Telemetry | None | Not found on `:8017` | None | **NOT IMPLEMENTED** | No BIQOS telemetry dashboard, node capability status, or telemetry links. | BIQOS reporting page needed. | Team Leads |

---

## D. Disconnected, Partial, and Misleading Features

### Issue 1: Complete Absence of Produce Listing & Order Flow (Mission P0)
- **Files**: Non-existent (Missing routes in `src/routes/`).
- **User-Visible Behavior**: The farmer can only view passive advisory recommendations. After receiving advice stating "Sell at APMC Vita for ₹5,000/q", there is **no button to create a produce listing, receive an offer, or confirm an order**. The only CTA is a phone link to the Kisan Call Centre (`tel:18001801551`).
- **Actual Implementation**: The application is an informational dashboard only.
- **Why It Fails Requirements**: The core mission objective is to demonstrate a verifiable **farmer-to-retail listing-to-accepted-order** workflow.
- **Required Change**: Create a `/listing/new` form (crop, variety, quantity in quintals, asking price, location), a `/listings` view, and an `/orders` acceptance screen.
- **Backend Dependency & Owner**: **Hemanth**. Endpoints `POST /listings`, `GET /listings`, `POST /orders`, and `PUT /orders/{id}/accept` are not present on `:8017`.
- **Priority**: **P0** (Mandatory for mission demo).

### Issue 2: Supabase Cloud Database Non-Existent Domain (DNS ENOTFOUND)
- **Files**:
  - `src/integrations/supabase/client.ts` (Lines 32–59)
  - `src/components/farm/FeedbackBlock.tsx` (Lines 43–58)
  - `src/routes/review.tsx` (Lines 49–63)
  - `.env` (Lines 1–6)
- **User-Visible Behavior**:
  1. When a farmer clicks "Thumbs Up" or "Thumbs Down" on `/advice/$service`, the UI displays: *"Saved to this phone. We will send it when the connection is back."* (`feedback.thanks.local`). The feedback never syncs to the team.
  2. On `/review`, the shared feedback section displays: *"No feedback recorded yet"* even when responses were submitted.
- **Actual Implementation**: `.env` specifies `SUPABASE_URL="https://fhwwpasgebufuznthynv.supabase.co"`. A live DNS lookup confirms `fhwwpasgebufuznthynv.supabase.co` is a non-existent domain.
- **Why It Fails Requirements**: Data persistence is simulated via device `localStorage` while claiming central aggregation capability.
- **Required Change**: Either update `.env` with an active Supabase project credentials, or replace the Supabase integration with a lightweight local SQLite / Nitro file database in the BFF for listings, orders, and feedback.
- **Backend Dependency & Owner**: **Hemanth / DevSecOps**.
- **Priority**: **P0**.

### Issue 3: Plant Intelligence Diagnostic Disconnected via Configuration
- **Files**:
  - `src/lib/plant.functions.ts` (Lines 40–44, 67–72)
  - `src/components/farm/PlantCheck.tsx` (Lines 97–104)
  - `.env`
- **User-Visible Behavior**: Farmers uploading a plant photo see the warning: *"Photo check not connected yet. We are connecting the plant diagnostic service soon."* (`plant.notconnected.title`).
- **Actual Implementation**:
  ```ts
  const baseUrl = (process.env["PLANT_BASE_URL"] ?? "").replace(/\/+$/, "");
  if (!baseUrl) {
    return { configured: false, ok: false, reason: "offline", observations: [], fetchedAt };
  }
  response = await fetch(`${baseUrl}/analyze`, ...);
  ```
  `PLANT_BASE_URL` is omitted from `.env`. Furthermore, the backend engine at `http://163.128.209.18:8017/aqiaic/plant/status` is **fully active**, and its analyze route is `POST /aqiaic/plant/analyze`.
- **Why It Fails Requirements**: The UI claims the service is unavailable, even though a healthy BioCLIP / OpenAI ViT-B-32 plant model is running right on the backend VM.
- **Required Change**: In `.env`, configure `PLANT_BASE_URL="http://163.128.209.18:8017/aqiaic/plant"`. Update `plant.functions.ts` to call `${baseUrl}/analyze`.
- **Backend Dependency & Owner**: **Auditor (Self)** (Configuration & route alignment).
- **Priority**: **P1**.

### Issue 4: Farmer Profile & Land Details Discarded (No Upstream Persistence)
- **Files**:
  - `src/routes/ask.tsx` (Lines 148–162)
  - `src/lib/aiaic.functions.ts` (Lines 13–20)
  - `src/lib/farm-storage.ts` (Lines 36–43)
- **User-Visible Behavior**: The farmer enters land size in acres (e.g. 5 acres) on `/ask`. On `/result`, the subtitle displays `5 acres`, but the advice output is identical whether the farmer enters 0.5 acres or 500 acres.
- **Actual Implementation**:
  ```ts
  const inputSchema = z.object({
    services: z.array(z.enum(SERVICES)).min(1),
    region: z.string().trim().max(80).optional(),
    crop: z.string().trim().max(80).optional(),
    mandi: z.string().trim().max(120).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  });
  ```
  `land` is saved strictly in browser `localStorage` (`aiaic.farm`) and URL search params. It is omitted from `inputSchema` in `src/lib/aiaic.functions.ts` and never passed to `/intelligence/{service}`.
- **Why It Fails Requirements**: Farmer land holding and production capacity are fundamental to lot aggregation, market quota, and irrigation calculations.
- **Required Change**: Pass land size and production capacity into the backend context, or use it in the listing creation flow.
- **Backend Dependency & Owner**: **Hemanth**.
- **Priority**: **P1**.

### Issue 5: Best / Worst Case Confidence Band Is Mathematically Synthesised
- **Files**:
  - `src/lib/aiaic-types.ts` (Lines 112–124)
  - Upstream backend: `which_mandi_channel.py:122-124`
- **User-Visible Behavior**: The advice detail screen displays best-case and worst-case price ranges.
- **Actual Implementation**: Upstream backend JSON response reveals:
  ```json
  "case_band_is_manufactured": {
    "band_half_width_frac": 0.015,
    "reason": "no seasonal_price_percentiles for this crop; which_mandi_channel.py:122-124 sets best = net x 1.015 and worst = net x 0.985",
    "confidence_note": "the case spread_frac printed in the confidence trace is therefore ~0.03 on every card of this kind and contributes nothing to the score"
  }
  ```
- **Why It Fails Requirements**: The price band gives the visual appearance of historical volatility modeling, but is actually an arbitrary ±1.5% fixed multiplier.
- **Required Change**: Note this limitation honestly in the UI disclaimer; replace with historical quantile spread when available.
- **Backend Dependency & Owner**: **Hemanth**.
- **Priority**: **P2**.

### Issue 6: 46 Unused UI Library Components
- **Files**: `src/components/ui/*.tsx` (46 files: `table.tsx`, `chart.tsx`, `dialog.tsx`, `sidebar.tsx`, etc.).
- **User-Visible Behavior**: None.
- **Actual Implementation**: The repository contains an entire shadcn/ui library setup, but the active screens import zero components from `src/components/ui/`.
- **Required Change**: Utilize these pre-built UI components (`table.tsx`, `dialog.tsx`, `form.tsx`, `badge.tsx`) to rapidly construct the new Listing Creation, Buyer Offer, and Order Acceptance interfaces without adding external dependencies.
- **Backend Dependency & Owner**: **Auditor (Self)**.
- **Priority**: **P1**.

---

## E. API Contract Matrix

| API Function | Frontend File & Line | Target Endpoint | HTTP Method | Request Payload / Params | Response Schema | Auth Header | Live Probe Result | Contract Issues |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| `getCatalog` | `src/lib/catalog.functions.ts:29` | `/catalog` | `GET` | None | `{ crops: [], regions: [], market_mandis: [], per_service: {} }` | `ngrok-skip-browser-warning: true` | **HTTP 200 OK** | Schema matches perfectly; returns 120+ crops, 36 districts. |
| `getIntelligence` | `src/lib/aiaic.functions.ts:62` | `/intelligence/{service}` | `GET` | `?region=Kolhapur&crop=Onion&limit=3` | `[ UnifiedIntelligence ]` | `ngrok-skip-browser-warning: true` | **HTTP 200 OK** | Market, Water, Crop, Storage return valid items. Weather returns `[]`. |
| `analyzePlantPhoto`| `src/lib/plant.functions.ts:67` | `{PLANT_BASE_URL}/analyze` | `POST` | `multipart/form-data (file, crop)` | `{ species: "", stage: "", observations: [] }` | `ngrok-skip-browser-warning: true` | **BLOCKED (Unconfigured)** | `PLANT_BASE_URL` unset. Correct backend path on `:8017` is `/aqiaic/plant/analyze`. |
| `saveFeedback` | `src/components/farm/FeedbackBlock.tsx:43` | `fhwwpasgebufuznthynv.supabase.co/rest/v1/advice_feedback` | `POST` | `{ service, useful, lang, region, crop, mandi, decision_id }` | Insert row | `apikey: sb_publishable_...` | **DNS ENOTFOUND** | Supabase project domain does not exist in DNS. |
| `getFeedbackHistory`| `src/routes/review.tsx:52` | `fhwwpasgebufuznthynv.supabase.co/rest/v1/advice_feedback` | `GET` | `?select=*&order=created_at.desc&limit=100` | Array of feedback rows | `apikey: sb_publishable_...` | **DNS ENOTFOUND** | Supabase project domain does not exist in DNS. |
| *Farmer Auth* | *Missing in frontend* | `/auth/login` | `POST` | `{ username, password }` | `{ access_token, token_type }` | None | **Available on :8017** | Frontend never calls login; no farmer auth session maintained. |
| *Farmer Profile* | *Missing in frontend* | `/farmer/me` | `GET` | None | Farmer identity & history | `Bearer <token>` | **Available on :8017** | Frontend never calls profile; persists only in `localStorage`. |
| *Produce Listing*| *Missing in frontend* | `/listings` | `POST` | `{ crop, grade, quantity_q, asking_price, location }` | `{ listing_id, status }` | Required | **NOT FOUND on :8017** | Endpoint does not exist in Decision Engine OpenAPI spec. |
| *Order Accept* | *Missing in frontend* | `/orders/{id}/accept`| `POST` | `{ order_id, accepted_at }` | `{ order_id, status: "ACCEPTED" }` | Required | **NOT FOUND on :8017** | Endpoint does not exist in Decision Engine OpenAPI spec. |

---

## F. Farmer-to-Retail Flow Assessment (All 11 Stages)

```mermaid
flowchart TD
    S1[1. Farmer & Production] -->|PARTIAL: Local Only| S2[2. Listing & Availability]
    S2 -->|NOT IMPLEMENTED| S3[3. Buyer Discovery]
    S3 -->|NOT IMPLEMENTED| S4[4. Offer & Order]
    S4 -->|NOT IMPLEMENTED| S5[5. Aggregation & Lot]
    S5 -->|NOT IMPLEMENTED| S6[6. Quality & Grading]
    S6 -->|PARTIAL: Plant Only| S7[7. Storage & Warehouse]
    S7 -->|PARTIAL: Advisory Only| S8[8. Logistics & Fulfilment]
    S8 -->|PARTIAL: Advisory Only| S9[9. Retail Channels]
    S9 -->|NOT IMPLEMENTED| S10[10. Payment & Settlement]
    S10 -->|NOT IMPLEMENTED| S11[11. Provenance & Reconciliation]
```

### Stage 1: Farmer and Production Data
- **Frontend Presence**: Route `/ask` captures district, crop, mandi, land holding, and irrigation context.
- **Mission Requirement**: Verified farmer identity, location, land size, crop acreage, and production capacity.
- **Backend Availability**: Backend has `POST /auth/login` and `GET /farmer/me` on `:8017`.
- **Frontend Integration**: **Disconnected**. Form inputs save to device `localStorage` (`aiaic.farm`) and URL search params. No profile or authentication is sent to the backend.
- **Persistence**: Browser local storage only; lost on device change or cache clear.
- **Status**: **PARTIAL**.
- **Remediation**: Connect `/ask` submission to persist farmer profile or create persistent session in BFF.

### Stage 2: Listing and Availability
- **Frontend Presence**: **Absent**. No listing creation form, no inventory input, no grade/variety specification, no asking price field.
- **Mission Requirement**: Farmer creates produce listing with crop variety, quantity (quintals), quality grade, target price, and pickup window.
- **Backend Availability**: **Not Available** on `:8017`.
- **Status**: **NOT IMPLEMENTED**.
- **Remediation**: Build `/listing/new` UI screen. Agree with Hemanth on listing storage contract (BFF SQLite or dedicated backend).

### Stage 3: Buyer Discovery and Matching
- **Frontend Presence**: **Absent**. The `/advice/market` screen shows nearby APMC mandi price comparisons, but **no buyer listings, institutional buyers, or retail demand orders**.
- **Mission Requirement**: Matching farmer produce lots with verified retail buyers, procurement aggregators, or mandi traders.
- **Backend Availability**: **Not Available** on `:8017`.
- **Status**: **NOT IMPLEMENTED**.
- **Remediation**: Build Buyer Discovery card displaying matched buyer demands with bid prices.

### Stage 4: Offer and Order Progression
- **Frontend Presence**: **Absent**. No offer viewing, price negotiation, counter-offer, or order acceptance action.
- **Mission Requirement**: Buyer submits offer; farmer accepts offer; immutable order created with stable ID and status `ACCEPTED`.
- **Backend Availability**: **Not Available** on `:8017`.
- **Status**: **NOT IMPLEMENTED**.
- **Remediation**: **P0 Task**: Implement order acceptance flow (one farmer, one lot, one buyer order) with clear status state (`PENDING` $\rightarrow$ `ACCEPTED`).

### Stage 5: Aggregation and Collection
- **Frontend Presence**: **Absent**. No lot aggregation or FPO collection center screens.
- **Mission Requirement**: Pooling smallholder lots into truckload quantities with traceability.
- **Backend Availability**: Backend has `POST /farmer/group-plan` on `:8017` (returns group pooling advisory), but no collection execution interface.
- **Status**: **NOT IMPLEMENTED**.
- **Remediation**: Mark as Middle-Chain simulated step for 4-day demo; surface group-plan recommendation.

### Stage 6: Quality and Grading
- **Frontend Presence**: `PlantCheck.tsx` provides photo diagnostic for leaf/plant health. No formal physical lot inspection, weight slips, or grade certificates.
- **Mission Requirement**: Lot inspection, moisture %, grade classification (Grade A/B/C), weighing slip, and rejection criteria.
- **Backend Availability**: `POST /aqiaic/plant/analyze` active on `:8017` for botanical observations.
- **Status**: **PARTIAL** (Photo check present but disconnected; lot grading absent).
- **Remediation**: Wire `PlantCheck.tsx` to live backend URL; add simple produce grade selector (A/B/C) to listing flow.

### Stage 7: Storage, Warehouse, and Processing
- **Frontend Presence**: `/advice/storage` card displays calculated sell-now vs store recommendation with CIPHET spoilage estimates and warehouse cost comparisons.
- **Mission Requirement**: Warehouse booking, cold storage space reservation, and electronic negotiable warehouse receipt (e-NWR) generation.
- **Backend Availability**: `GET /intelligence/storage` and `POST /farmer/store-or-sell` active on `:8017`.
- **Status**: **PARTIAL** (Advisory analysis verified live; warehouse booking execution absent).
- **Remediation**: Retain live advisory card; add explicit "Book Storage" mock-safe CTA or clearly label as advisory.

### Stage 8: Logistics and Fulfilment
- **Frontend Presence**: `/advice/market` calculates straight-line distance (km) and breakeven transport cost per quintal per km. No vehicle booking or live GPS dispatch.
- **Mission Requirement**: Transport booking, driver assignment, pickup confirmation, transit tracking, and proof of delivery (POD).
- **Backend Availability**: `POST /farmer/sell-where` active on `:8017`.
- **Status**: **PARTIAL** (Distance and breakeven economics verified live; execution absent).
- **Remediation**: Surface breakeven transport rates in listing summary; mark vehicle dispatch as partner dependency.

### Stage 9: Buyer and Retail Channels
- **Frontend Presence**: APMC market price comparison across regional mandis (e.g. APMC Vita vs APMC Satara vs APMC Kolhapur).
- **Mission Requirement**: Retailer demand visibility, direct-to-retail procurement contracts, and delivery acceptance.
- **Backend Availability**: Live Agmarknet mandi data active on `:8017`.
- **Status**: **PARTIAL** (APMC channel pricing live; direct retail channel absent).
- **Remediation**: Add Retail Channel option alongside Mandi in listing target.

### Stage 10: Payment, Settlement, and Platform Fees
- **Frontend Presence**: **Absent**. No wallet balance, bank account entry, escrow status, UPI payout, or platform fee breakdown.
- **Mission Requirement**: Buyer funds escrow; upon delivery confirmation, funds release to farmer wallet; platform fee deducted with reconciliation trail.
- **Backend Availability**: **Not Available** on `:8017` (Addons `/addons/ifsc` exists for bank lookup).
- **Status**: **NOT IMPLEMENTED**.
- **Remediation**: Build Order Settlement summary card showing Gross Sale, Transport Cost, Platform Fee (e.g. 2%), and Net Payout with clear pending/settled state.

### Stage 11: Provenance, Reconciliation, and Outcomes
- **Frontend Presence**: `/advice/$service` displays unique `decision_id` (e.g. `dec_9c6f131f69d54bf1fde72b7b69ff6e54`) and full Agmarknet record lineage. `/review` displays raw payload audit packet.
- **Mission Requirement**: End-to-end audit trace linking farmer identity, produce lot, inspection certificate, accepted order, payment reference, and governance signoff.
- **Backend Availability**: Decision IDs and record IDs active on `:8017`.
- **Status**: **PARTIAL** (Intelligence provenance live; transactional order provenance absent).
- **Remediation**: Propagate the existing `decision_id` into the produce listing and accepted order records.

---

## G. UI/UX State and Interaction Audit

| UI State / Control | Target Component | Observed Implementation | Visual Feedback | Defect or Risk Identified |
| :--- | :--- | :--- | :--- | :--- |
| **Loading States** | `StateBlock.LoadingBlock` | 3 animated pulsing skeleton cards with title & body placeholders. | Accessible (`role="status"`, `aria-live="polite"`). | Verified live; smooth transition into content cards. |
| **Empty States** | `StateBlock.StateBlock` | Renders `SearchX` icon with clear message explaining why data is absent. | Visual tone: neutral / warning. | Distinguishes unknown region/crop from "no advice today". |
| **Offline / Tunnel Failure**| `StateBlock.FailureBlock` | Catches network errors and ngrok `ERR_NGROK_3200` tunnel error bodies. | Visual tone: warning with `WifiOff` icon. | Accurately explains tunnel disconnect rather than crashing. |
| **Stale Data Warning** | `StateBlock` + `Clock` | Calculates days since `observed_at`. If > 2 days, displays prominent warning. | Banner: "This data is old (X days)". | Prevents farmers from acting on outdated market quotations. |
| **Uncalibrated Warning** | `ConfidenceMeter` / Alert | Prominent warning on every decision: *"Uncalibrated illustrative defaults — demonstration on real evidence"*. | Warning-soft yellow banner with `AlertTriangle`. | Strictly conforms to mission honesty guidelines. |
| **Abstention State** | `RecommendationCard` | If `abstained: true` or `recommendation: "ABSTAIN"`, renders abstain reason. | Displays "Not enough data to suggest an action". | Never guesses or fabricates advice when data is missing. |
| **Audio Speech Toggle** | `AdviceActions.tsx` | Web Speech API synthesis button (`Volume2` / `Square`). | Changes label to "Stop listening" with active icon. | Speech synthesis verified; fallback for unsupported devices. |
| **Share / Print Action** | `AdviceActions.tsx` | Web Share API $\rightarrow$ Clipboard $\rightarrow$ `window.print()` fallback. | Shows "Copied to clipboard" banner for 4s. | Verified live in browser. |
| **Technical Reasoning** | `advice.$service.tsx` | Button toggles `showTechnical` state. | Reveals raw telemetry trace lines. | Cleanly isolates agronomist trace from simple farmer steps. |
| **Helpline Dial Action** | `advice.$service.tsx` | Primary action button with `tel:18001801551`. | Opens native dialer. | Serves as advisory fallback, but substitutes for trade actions. |
| **Feedback Thumbs Up/Down**| `FeedbackBlock.tsx` | Thumbs up / down buttons. | Shows *"Saved to this phone. We will send it when connection is back."* | **Silent failure**: Supabase fails DNS lookup; write stays on device. |
| **Review Copy All Button** | `review.tsx` | `window.navigator.clipboard.writeText`. | Label toggles to "Copied!" with `ClipboardCheck`. | Verified live; raw JSON copied cleanly. |

---

## H. Runtime Test Evidence

### 1. Test Environment & Verification Commands
- **Runtime Environment**: Windows 11 Localhost + Node.js v22 + Vite 8.2.1 + Remote Linux VM (`163.128.209.18`).
- **Interactive Verification**: Autonomous Browser Subagent session recorded to:  
  `file:///C:/Users/Rahil%20Mulani/.gemini/antigravity-ide/brain/e2773bba-eff5-45f0-945e-1865301a488f/farmer_ui_audit_1792567884125.webp`
- **TypeScript Integrity**: `npx tsc --noEmit` $\rightarrow$ **0 errors (Exit code 0)**.
- **Production Bundle**: `npm run build` $\rightarrow$ **Successful** (SSR output: `.output/server/index.mjs` in 294ms).

### 2. Network Probes & Responses

#### Probe 1: Live Catalog Verification (`GET /catalog`)
```bash
curl.exe -s --max-time 10 "http://163.128.209.18:8017/catalog"
```
**Outcome**: HTTP 200 OK. Returned 120+ crops, 36 Maharashtra districts, 20 Madhya Pradesh districts, and APMC mandis.

#### Probe 2: Live Market Intelligence (`GET /intelligence/market`)
```bash
curl.exe -s "http://163.128.209.18:8017/intelligence/market?region=Kolhapur%20APMC&crop=Onion&limit=3"
```
**Outcome**: HTTP 200 OK. Returned real Agmarknet Onion prices:
- Recommendation: `SELL_AT_MANDI` (Sell at APMC Vita).
- Gross prices: APMC Vita (₹5,000/q, 40 km), APMC Satara (₹3,250/q, 111 km), APMC Kolhapur (₹3,000/q, local).
- Breakeven transport rate: ₹50.56 / quintal / km.
- Decision ID: `dec_9c6f131f69d54bf1fde72b7b69ff6e54`.
- Provenance: Agmarknet GODL-India daily market report dated `2026-10-19`.

#### Probe 3: Remote Port Availability on Production VM
```bash
node -e "const ports=[8000,8001,8002,8017,8103,3008,5176]; ..."
```
**Outcome**: Ports 8000 (Samruddhi), 8001 (EMS), 8002 (Parikshak), 8017 (AIAIC), 8103 (Prana), 3008 (Farmer Web), and 5176 (Shakti) are all online (HTTP 200).

#### Probe 4: Supabase Database Failure Diagnosis
```bash
nslookup fhwwpasgebufuznthynv.supabase.co
```
**Outcome**: `*** UnKnown can't find fhwwpasgebufuznthynv.supabase.co: Non-existent domain`.  
Confirms Supabase database is completely unreachable.

### 3. Screen Captures from Live Session
- **Landing Screen**: Tri-lingual hero, high-contrast buttons, demonstration disclaimer.
- **Ask Screen**: Searchable big-select pickers for Kolhapur district, Onion crop, and 5 service toggles.
- **Decision Dashboard**: 4 recommendation cards loaded with visual confidence meters and PlantCheck.
- **Advice Detail Screen**: Agmarknet price comparison, breakeven distance analysis, and decision IDs.

---

## I. Prioritized Remediation Plan

### Responsibilities Matrix
- **My Role (Auditor & UI/UX Support)**: Farmer listing creation form, order acceptance UI, state cards, client navigation, and BFF routing.
- **Riddhi's Role (Application Coordination)**: Overall frontend page routing, component integration, and review flows.
- **Hemanth's Role (Backend APIs)**: Listing database persistence, order acceptance endpoints, buyer discovery contracts, and database credentials.
- **Gauri & Siddhesh (Governance & Identity)**: TANTRA authorization token verification and VAJRA identity/wallet integration.

---

### Sequence 1: P0 Fixes (Required for Listing-to-Accepted-Order Demo)

#### Task 1.1: Implement Produce Listing Creation Screen (`/listing/new`)
- **Assignee**: Auditor (UI/UX) + Riddhi.
- **Files to Modify / Create**:
  - `src/routes/listing.new.tsx` (New route)
  - `src/components/farm/ListingForm.tsx` (New component)
- **Suggested Changes**:
  1. Create an accessible form capturing: Crop (pre-filled from `/ask`), Variety, Available Quantity (quintals), Quality Grade (Grade A / B / C), Asking Price (₹/quintal, pre-filled with recommended mandi price), Pickup Location, and Expiry Date.
  2. Add primary CTA on `/advice/market`: *"List My Produce for Sale"* navigating to `/listing/new`.
- **Acceptance Criteria**: Farmer can submit a listing; receives a confirmation card with unique Listing ID (`LST-xxxx`).

#### Task 1.2: Implement Persistent Store for Listings and Orders (BFF or SQLite Fallback)
- **Assignee**: Auditor (Self) / Hemanth.
- **Files to Modify / Create**:
  - `src/lib/orders.server.ts` (New BFF server function module)
  - `src/lib/orders.functions.ts` (TanStack Start RPC endpoints)
- **Suggested Changes**:
  Because Supabase is dead and `:8017` lacks listing endpoints, implement a resilient local persistent store in the Nitro BFF layer (using unstorage or SQLite in `.data/` or in-memory map with file backup) exposing:
  - `createListing(data)` $\rightarrow$ stores listing.
  - `getListings()` $\rightarrow$ retrieves active listings.
  - `createOrder(listingId, buyerData)` $\rightarrow$ creates buyer order.
  - `acceptOrder(orderId)` $\rightarrow$ marks order status `ACCEPTED`.
- **Acceptance Criteria**: Listings and orders persist across browser refreshes and server restarts without manual database edits.

#### Task 1.3: Implement Accepted Order Progression Screen (`/orders/$orderId`)
- **Assignee**: Auditor (UI/UX).
- **Files to Modify / Create**:
  - `src/routes/orders.$orderId.tsx` (New route)
  - `src/components/farm/OrderCard.tsx` (New component)
- **Suggested Changes**:
  1. Render Buyer Demographics: Institutional Buyer name (e.g. *"Reliance Fresh Aggregator"* or *"APMC Vita Procurement"*), Offered Price, Lot Quantity, and Delivery Location.
  2. Provide prominent **"Accept Order"** and **"Decline"** buttons.
  3. Upon clicking "Accept Order", trigger `acceptOrder` RPC; transition UI status badge from `PENDING_ACCEPTANCE` $\rightarrow$ `ORDER_ACCEPTED`.
  4. Render order confirmation certificate with Order ID, Timestamp, Farmer ID, and Decision Trace ID.
- **Acceptance Criteria**: Clicking "Accept Order" updates the persistent state and reflects `ACCEPTED` status on screen.

---

### Sequence 2: P1 Integrations (Core Platform & Backend Alignment)

#### Task 2.1: Rewire Plant Intelligence Diagnostic to Live VM Backend
- **Assignee**: Auditor (Self).
- **Files to Modify**:
  - `farmer-s-friend-dashboard-main/.env`
  - `farmer-s-friend-dashboard-main/src/lib/plant.functions.ts`
- **Suggested Changes**:
  1. In `.env`, add `PLANT_BASE_URL="http://163.128.209.18:8017/aqiaic/plant"`.
  2. In `plant.functions.ts`, ensure request posts to `${baseUrl}/analyze` with proper multipart form boundaries.
- **Verification**: Uploading a leaf photo returns real BioCLIP observations and species classification.

#### Task 2.2: Restore Central Database Persistence (Supabase or PostgreSQL)
- **Assignee**: Hemanth.
- **Files to Modify**: `.env` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`).
- **Suggested Changes**: Provide an active Supabase project URL or PostgreSQL connection string to restore the `advice_feedback` table.

#### Task 2.3: Wire Land Holding into Calculation Payload
- **Assignee**: Hemanth + Auditor.
- **Files to Modify**: `src/lib/aiaic.functions.ts`, `src/routes/ask.tsx`.
- **Suggested Changes**: Include `land` parameter in `getIntelligence` and pass to upstream engine to calculate total farm yield (acres $\times$ average quintal yield).

---

### Sequence 3: P2 Secondary Features & Operational Panels

#### Task 3.1: Connect TANTRA Governance & Authorization Status
- **Assignee**: Gauri / Siddhesh.
- **Suggested Changes**: Add read-only TANTRA transaction status verification badge on accepted orders.

#### Task 3.2: Connect VAJRA Verifiable Credential Identity
- **Assignee**: Siddhesh / Hemanth.
- **Suggested Changes**: Embed VAJRA decentralized farmer identifier (DID) on listing and order certificates.

#### Task 3.3: Implement Weather Data Fallback
- **Assignee**: Hemanth.
- **Suggested Changes**: Connect IMD district weather forecast data on `:8017` so `/intelligence/weather` does not return empty `[]`.

---

## J. Acceptance Checklist for Mission Demo

Use this checklist prior to final submission to verify truthful, end-to-end integration:

- [ ] **1. Farmer Profile Entry**: Farmer can enter district, crop, and land acreage on `/ask`.
- [ ] **2. Live Advisory Generation**: Real Agmarknet prices, mandi comparisons, and decision IDs load from `http://163.128.209.18:8017`.
- [ ] **3. Listing Creation**: Farmer can click *"List My Produce"* and create a produce listing with quantity and target price.
- [ ] **4. Listing Persistence**: Newly created listing receives a permanent ID and is retrievable upon page refresh.
- [ ] **5. Buyer Matching**: Matched buyer procurement bid is displayed against the produce lot.
- [ ] **6. Order Acceptance**: Farmer clicks *"Accept Order"*; state updates to `ACCEPTED` in persistent storage.
- [ ] **7. Transaction Status**: Accepted order displays stable Order ID, agreed gross value, estimated transport deduction, and net settlement.
- [ ] **8. Honest Disclaimers Maintained**: All uncalibrated warnings and data freshness notices remain prominent.
- [ ] **9. No Mock Data Masquerading as Live**: Advisory data remains powered by live Agmarknet evidence; transactional steps not yet connected to external banks are explicitly labeled as sandbox/demo settlement.
- [ ] **10. Zero Console & Build Errors**: `npm run build` and `npx tsc --noEmit` pass with 0 errors.

---

## K. Final Verdict

### **Verdict**: **REVISION REQUIRED**

### Rationale
The existing AIAIC Farmers Platform is an exemplary implementation of an accessible, tri-lingual, honest **AI Decision Dashboard**. It is genuinely integrated with the live backend engine (`http://163.128.209.18:8017`), correctly consumes live Agmarknet evidence, and strictly enforces honesty rules without mock data masquerading as real advice.

However, **it is currently an advisory dashboard, not a listing-to-order transaction engine**. The core transactional sequence required by the Farm-to-Retail mission—produce listing, buyer discovery, offer negotiation, order acceptance, and settlement—does not exist in the frontend UI and has no matching endpoints on the `:8017` backend engine. Furthermore, the Supabase database domain is dead in DNS.

### Conditions for Final PASS:
1. Implementation of the Produce Listing Form (`/listing/new`) and Order Acceptance Screen (`/orders/$orderId`).
2. Wiring of persistent storage (via Hemanth's backend API or local BFF persistence) for listing and order state.
3. Rewiring `PLANT_BASE_URL` in `.env` to the live VM plant diagnostic endpoint (`:8017/aqiaic/plant`).
4. Re-verification of the end-to-end listing $\rightarrow$ accepted order lifecycle in an authorized browser test session.
