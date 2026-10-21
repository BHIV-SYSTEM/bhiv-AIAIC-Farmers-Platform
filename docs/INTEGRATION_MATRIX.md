# AIAIC Farm-to-Retail Integration Matrix

**Version**: 2.0.0 (Confirmed Production Integrations)  
**Date**: October 21, 2026  
**Auditor & Implementation Role**: UI/UX & Frontend Integration Support  
**Coordination**: Riddhi (Application Lead), Hemanth (Backend Lead), Antigravity (UI/UX & Integration Support)  
**Upstream Backend**: `http://163.128.209.18:8017`

---

## Complete Frontend–Backend Integration Matrix

| Frontend Route / Component | User Action / Trigger | Backend Interface / Target | Protocol / Contract | Data Payload Schema | Status | Persistent Store | Responsible Owner | Notes / Honesty Disclosure |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` (`index.tsx`) | Select service, input district/crop | Client-side routing to `/ask` | Navigation | Search params: `{ region, crop }` | **VERIFIED LIVE** | Browser state | Riddhi | Clean entry point with bilingual support. |
| `/ask` (`ask.tsx`) | State selector (MH vs MP) | `GET /places/districts?state=mh\|mp` | HTTP GET `:8017` | `Array<{ district, localized_name, state }>` | **VERIFIED LIVE** | React Query Cache | Hemanth / Antigravity | Dynamic district population (36 MH, 55 MP). Replaces hardcoded lists. |
| `/ask` (`ask.tsx`) | Select district | `GET /places/crops?district={d}` | HTTP GET `:8017` | `{ district, crops: string[], first_page: string[] }` | **VERIFIED LIVE** | React Query Cache | Hemanth / Antigravity | Dynamic crop list for selected district with primary commodity pagination. |
| `/ask` (`ask.tsx`) | Submit farm profile | Navigates to `/result` | Navigation | `farmSearchSchema` (`crop`, `district`, `state`, `acreage`, `soil`, `services`) | **VERIFIED LIVE** | `localStorage` | Riddhi / Antigravity | Displays CGWB groundwater/soil caveat. Records acreage without claiming prediction influence. |
| `/result` (`result.tsx`) | View multi-service overview | `GET /farmer/advice` | HTTP GET `:8017` | `{ answer_headline, read_these_first, why, as_of, reference, ask_a_human, important, checked_note, distress }` | **VERIFIED LIVE** | React Query Cache (no-cache if distress) | Hemanth / Antigravity | Verified live composite decision cards, uncalibrated guidance banner, and distress routing. |
| `/result` & `/advice/market` (`PriceSeriesChart.tsx`) | Inspect price trends & benchmarks | `GET /places/price-series?crop={c}&district={d}&state={s}` | HTTP GET `:8017` | `{ points: [{ date, price, volume_quintals }], p25, p50, p75, reading }` | **VERIFIED LIVE** | React Query Cache | Hemanth / Antigravity | 30-day historical daily mandi quotes visualized against 5-year benchmark percentile band. |
| Plant Intelligence (`PlantCheck.tsx`) | Upload leaf / plant photo | `POST /aqiaic/plant/analyze?mode=bioclip` | HTTP POST `:8017` multipart/form-data | Payload: image file (≤12MB). Returns `{ farmer_view: { headline, lines, not_a_health_check, next_step }, bioclip_species, feedback, trace }` | **VERIFIED LIVE** | Ephemeral session / X-Request-ID | Hemanth / Antigravity | Strict farmer_view order rendering, HTTP 413/415/422/400/429/502 handling, X-Request-ID logging, distress emergency routing. |
| `/advice/$service` (`advice.$service.tsx`) | View specific service intelligence | `GET /farmer/advice` & `GET /intelligence/{service}` | HTTP GET `:8017` | `FarmerAdviceCard` + `IntelligenceItem` | **VERIFIED LIVE** | React Query Cache | Hemanth / Antigravity | Real decision IDs, reasoning bullets, freshness timestamps, and KCC direct phone dialing links. |
| `/advice/$service` (`advice.$service.tsx`) | Click "List My Produce for Sale" | Navigates to `/listing/new` | Navigation | Prefills `crop`, `region`, `price`, `decisionId` | **VERIFIED LIVE** | URL search params | Antigravity / Riddhi | Connects agricultural advisory directly to listing workflow. |
| `/advice/$service` (`FeedbackBlock.tsx`) | Thumbs Up / Down vote | Supabase `advice_feedback` | HTTP POST | `{ service, useful, lang, decision_id }` | **PARTIAL** | Local storage fallback | Hemanth | Supabase host is unreachable; honestly degrades to local device storage. |
| `/listing/new` (`listing.new.tsx`) | Submit produce listing form | `createListing` (Server Fn) | Nitro RPC | `createListingInputSchema` | **VERIFIED LIVE** | `data/transactions.json` | Antigravity / Hemanth | Validates lot, creates listing ID, generates demo buyer offer. |
| `/listings` (`listings.tsx`) | Browse / filter listings | `getListings` (Server Fn) | Nitro RPC | Returns `ProduceListing[]` | **VERIFIED LIVE** | `data/transactions.json` | Antigravity / Hemanth | Full CRUD retrieval across reloads and server restarts. |
| `/orders` (`orders.index.tsx`) | View matched buyer offers | `getOrders` (Server Fn) | Nitro RPC | Returns `ProduceOrder[]` | **VERIFIED LIVE** | `data/transactions.json` | Antigravity / Hemanth | Displays honest Sandbox Matching notice. |
| `/orders/$orderId` (`orders.$orderId.tsx`) | Inspect order contract | `getOrderById` (Server Fn) | Nitro RPC | Returns `ProduceOrder` | **VERIFIED LIVE** | `data/transactions.json` | Antigravity / Hemanth | Full itemized financial table and 4 governance pillars. |
| `/orders/$orderId` (`orders.$orderId.tsx`) | Click "Accept Order" | `acceptOrder` (Server Fn) | Nitro RPC | `{ orderId: string }` | **VERIFIED LIVE** | `data/transactions.json` & `data/order_events.json` | Antigravity / Hemanth | Updates status to `ACCEPTED`, sets `acceptedAt`, logs to immutable audit trail on disk. |
| `/orders/$orderId` (`orders.$orderId.tsx`) | Click "Decline Offer" | `declineOrder` (Server Fn) | Nitro RPC | `{ orderId, reason }` | **VERIFIED LIVE** | `data/transactions.json` & `data/order_events.json` | Antigravity / Hemanth | Updates status to `DECLINED`, stores decline reason in event log. |
| Central Buyer Gateway | Stream live buyer procurement tenders | TBD | HTTP / WebSocket | TBD | **BLOCKED** | External DB | Hemanth | Central retail buyer API not yet deployed on port 8017. Sandboxed matching active. |
| VAJRA Lot Verification | Depot quality assay | TBD | Blockchain / RPC | TBD | **NOT IMPLEMENTED** | Ledger | Platform Owner | Honestly marked as `PENDING DEPOT INTAKE`. |
| TANTRA Logistics Dispatch | Driver manifest allocation | TBD | Microservice | TBD | **NOT IMPLEMENTED** | TANTRA DB | Platform Owner | Honestly marked as `SCHEDULED`. |
| Bank Payment Settlement | Escrow release to farmer UPI | TBD | Banking Gateway | TBD | **NOT IMPLEMENTED** | Bank Core | Platform Owner | Honestly marked as `HELD IN ESCROW`. |

---

## Status Legend
- **VERIFIED LIVE**: Implemented, executed, and validated with real backend response and persisted state.
- **PARTIAL**: Operates with honest client-side degradation when upstream dependency is unavailable.
- **SIMULATED / SANDBOX**: Operational matching sandbox running on real backend RPCs with explicit honest disclosures.
- **NOT IMPLEMENTED**: Future capability clearly separated and labeled so users and reviewers are not misled.
- **BLOCKED**: Implementation waiting on upstream backend contract from responsible owner.
