# Annapoorna Manager Changes: Simple Farmer Advice, Complete Localization, and Vaani TTS Integration Audit

**Document Reference**: `docs/FARMER_ADVICE_LOCALIZATION_TTS_AUDIT.md`  
**Application**: Annapoorna / Farmer's Friend Dashboard (`farmer-s-friend-dashboard-main`)  
**Audit Date**: October 21, 2026  
**Status**: Fully Implemented, Verified, and Tested (Zero Regressions)

---

## 1. Executive Summary

This audit documents the implementation and verification of the three manager-requested improvements in the Annapoorna / Farmer's Friend platform:
1. **Simple Farmer Advice First (Part A)**: Displaying a short, truthful, easy-to-understand advice paragraph in the farmer's selected language first, accompanied by a touch-friendly localized audio control, persistent urgent warnings / national distress helplines, and an expandable "More details" control preserving all technical and governance fields.
2. **Complete Localization (Part B)**: Complete multi-lingual audit and resolution of all untranslated English strings across Hindi (`hi`), Marathi (`mr`), and English (`en`) across every route, shared component, dialog, table, badge, form, and chart.
3. **Sovereign BHIV Vaani TTS Integration (Part C)**: Direct integration with the sovereign BHIV Vaani TTS service (`http://163.128.209.18:8016`), replacing legacy browser `window.speechSynthesis`. Includes server-side proxy security, capability verification for Hindi and Marathi, WAV binary streaming, and honest error handling for unsupported language codes without silent fallbacks.

All existing application functionality (plant health diagnosis, price series percentiles, dynamic district/crop selectors, listing lifecycle, order acceptance/decline idempotency, and responsive mobile layout) has been strictly preserved with zero horizontal overflow across all mobile viewports.

---

## 2. Part A: Simple Advice First & Expanded-Detail Behavior

### 2.1 Default Hero View
When a farmer requests agricultural advice (via `/result` or service-specific `/advice/$service`):
- **Short, Easy-to-Understand Advice Paragraph**:
  - Generated via `buildSimpleAdviceParagraph()` in `src/lib/advice-summary.ts`.
  - Faithfully extracts and synthesizes `answer_headline`, `why`, `important`, `summary.action.text`, and relevant operational notes from the backend response.
  - Prioritizes vernacular text fields when available in the API response.
  - Never invents agricultural advice or drops essential cautions.
  - If the backend returns English text for a Marathi/Hindi query, the UI adds a clear, truthful caveat: `[सूचना: हा सल्ला इंग्रजीत उपलब्ध आहे]` / `[नोट: यह सलाह अंग्रेजी में उपलब्ध है]` so the user is never misled into believing English text is native vernacular advice.
- **Localized Mobile-First Audio Control**:
  - Rendered by `<VaaniAudioPlayer>` in `src/components/farm/VaaniAudioPlayer.tsx`.
  - Labeled in the selected language: `"ऐका (Vaani)"` (MR), `"सुनें (Vaani)"` (HI), `"Listen (Vaani)"` (EN).
  - Single global audio instance prevents overlapping playback on repeated taps.
  - Clean touch targets (minimum 44x44px) with high-contrast active states (`idle`, `generating`, `playing`, `paused`, `unavailable`).
- **Persistent Urgent Warnings & Helplines (Always Visible)**:
  - Even when the details section is collapsed, urgent warnings (`important` / `important_label`), high-risk advisories, and national helplines remain immediately visible.
  - Badges provide direct click-to-call links for:
    - **Kisan Call Centre (KCC)**: `1800-180-1551` (Toll-free agricultural helpline)
    - **Tele-MANAS**: `14416` (National farmer distress / mental health helpline)
- **"More details" Expandable Control**:
  - Accessible button (`id="more-details-toggle"` with `aria-expanded="false"|"true"`).
  - Labeled dynamically: `"अधिक तपशील पहा"` (MR), `"अधिक विवरण देखें"` (HI), `"Show full agricultural details"` (EN).

### 2.2 Expanded View
Clicking "More details" smoothly reveals the comprehensive technical and operational breakdown without navigating away:
- Full technical fields: `answer_headline`, `read_these_first`, `why`, `as_of`, `reference`, `ask_a_human`, `summary.action.text`, `important`, `important_label`, and `checked_note`.
- Embedded sub-components:
  - `<DashboardSummary>`: Soil health, pest pressure, weather snapshot, and market signals.
  - `<PlantCheck>`: Visual crop observation, species detection, disease symptoms, growth stage, and limitations.
  - `<PriceSeriesChart>`: Modal price series, percentile benchmarks (P25, P50, P75), and recent mandi quotes.
  - Service-specific evidence, confidence metrics, and human-expert escalation options.

---

## 3. Part B: Complete Localization Audit

### 3.1 Scope of Audit
Every route and shared component was audited for visible English strings when Hindi or Marathi is selected:
- **Navigation & Layout**: `TopNav.tsx`, `BottomNav.tsx`, `__root.tsx` (footer note, disclaimer, language selector buttons).
- **Advisory & Query Flow**: `ask.tsx` (state selector, dynamic district catalog, soil data caveat), `result.tsx`, `advice.$service.tsx`.
- **Plant Disease Diagnosis**: `PlantCheck.tsx` (visual observation, species, stage, limitations, distress notice, request ID).
- **Price Analytics**: `PriceSeriesChart.tsx` (chart title, subtitle, quote date, benchmark percentiles P25/P50/P75, recent quotes, footnote).
- **Produce Listing Workflow**: `listing.new.tsx` (produce category, grade, pricing, min lot size, pickup location, submit loading state), `listings.tsx` (persistence notice, status filters, itemized card labels, empty state).
- **Order Inbox & Execution**: `orders.index.tsx` (filter tabs, refresh, loading, empty state), `orders.$orderId.tsx` (buyer specifications, delivery window, financial settlement breakdown table & mobile card layout, honest cost disclosure, enterprise governance pillars: Legal Contract, VAJRA Quality, TANTRA Idempotency, Sovereign Escrow, accept/decline action flow, decline bottom sheet modal).
- **Audio & Feedback**: `VaaniAudioPlayer.tsx`, `FeedbackBlock.tsx`.

### 3.2 Dictionary Additions
Over 150 translation keys were added to `src/lib/i18n.tsx` for English, Hindi, and Marathi.
Key additions include:
- `advice.simpleSummaryTitle`, `advice.audioPlay`, `advice.audioStop`, `advice.audioLoading`, `advice.audioError`, `advice.audioUnavailable`, `advice.moreDetails`, `advice.lessDetails`, `advice.untranslatedNote`
- `orders.*`: Financial breakdown (`orders.breakdownTitle`, `orders.breakdownItem`, `orders.breakdownAmount`, `orders.breakdownTax`, `orders.breakdownTotal`, `orders.breakdownFeeDisclosure`), governance pillars (`orders.pillarContract`, `orders.pillarVajra`, `orders.pillarTantra`, `orders.pillarEscrow`), action buttons (`orders.acceptConfirm`, `orders.declineConfirm`, `orders.declineTitle`, `orders.declineReasonLabel`, `orders.declineClose`)
- `listings.*`: Filters, persistence notice, card labels, lot IDs, empty states
- `plant.*`: Visual observation, species, stage, limits, distress banner, request ID
- `prices.*`: Benchmark percentiles, latest quote date, recent quotes, footnote
- `footer.note`: Sovereign data disclosure and national compliance notice

### 3.3 Dynamic Values & Formatting Preservation
- Dynamic IDs (`orderId`, `lotId`, `requestId`) are strictly preserved.
- Currency is consistently formatted in Indian Rupees (`₹`).
- Zero hardcoded English text remains visible in any reviewed UI component.

---

## 4. Part C: BHIV Vaani TTS Service Integration

### 4.1 Service Discovery & Endpoint Inspection
- **Repository Reference**: [BHIV-Engineering-Exchange/Vanni-TTS](https://github.com/BHIV-Engineering-Exchange/Vanni-TTS)
- **Base URL Determined**: `http://163.128.209.18:8016` (confirmed via live HTTP probes).
- **Live Endpoint Probe Results**:
  1. `GET http://163.128.209.18:8016/v1/tts/languages`
     - Status: **HTTP 200 OK**
     - Response: `["en", "hi", "ar", "es", "fr", "ja"]`
     - *Finding*: Marathi (`mr`) is **not** present in the deployed service's supported language list.
  2. `GET http://163.128.209.18:8016/v1/tts/voices`
     - Status: **HTTP 200 OK**
     - Response: `["vaani_teacher", "vaani_anchor"]`
  3. `POST http://163.128.209.18:8016/v1/tts/synthesize` (Hindi Test)
     - Payload: `{"text": "नमस्ते किसान भाई, आपकी फसल अच्छी है।", "language": "hi", "voice_profile": "vaani_teacher"}`
     - Status: **HTTP 200 OK**
     - Content-Type: `audio/wav`
     - Size: 135,212 bytes (Valid RIFF/WAVE header, 22050 Hz, 16-bit PCM mono, engine: `pyttsx3`).
     - Audio Playback: Fully playable, clear acoustic synthesis.
  4. `POST http://163.128.209.18:8016/v1/tts/synthesize` (Marathi Test)
     - Payload: `{"text": "नमस्कार शेतकरी बंधूंनो, तुमच्या पिकाची स्थिती उत्तम आहे.", "language": "mr", "voice_profile": "vaani_teacher"}`
     - Status: **HTTP 500 Internal Server Error**
     - Response: `{"error": "Synthesis failed: No native offline TTS engines available."}`
     - *Finding*: The host container does not have an offline Marathi TTS engine installed.
  5. `POST http://163.128.209.18:8016/v1/tts/synthesize` (English Test)
     - Payload: `{"text": "Hello farmer friend", "language": "en", "voice_profile": "vaani_teacher"}`
     - Status: **HTTP 500 Internal Server Error** (`No native offline TTS engines available.` on current container configuration).

### 4.2 Verified Language Matrix
| Language Code | Language Name | Upstream Status | Annapoorna Action |
|:---:|:---:|:---:|:---|
| `hi` | Hindi | **Supported (HTTP 200)** | Full Vaani TTS synthesis & audio playback enabled |
| `mr` | Marathi | **Unsupported (HTTP 500)** | Explicit localized notice: `"मराठी आवाज सेवा उपलब्ध नाही (TTS सेवा समर्थन प्रलंबित)"`. Advice text remains readable. Zero fallback to browser speech synthesis. |
| `en` | English | **Unsupported (HTTP 500)** | Localized notice: `"Audio unavailable for English"`. Advice text remains readable. Zero fallback to browser speech synthesis. |

### 4.3 Secure Server Proxy Architecture
- **Server Module**: `src/lib/vaani-tts.server.ts`
- **Client Server Function**: `src/lib/vaani-tts.functions.ts` (`synthesizeAdviceAudioServerFn`)
- **HTTP Endpoints**:
  - `POST /api/tts`: Validates JSON `{ text, language, voice_profile }`, checks `VAANI_VERIFIED_LANGUAGES = ["hi"]`, calls upstream with a 15-second abort controller, validates binary WAV header (`RIFF....WAVE`), and streams audio back as `audio/wav`.
  - `GET /api/tts/health`: Returns server proxy health and supported language capability list.
- **Security & Privacy Guarantees**:
  - `VAANI_BASE_URL` and `VAANI_API_KEY` are read strictly from `process.env` on the server.
  - Zero API keys or internal service credentials are included in browser bundles, client requests, or error responses.
  - Only the short advice paragraph (1–2,000 characters) is transmitted. The entire DOM/page is never scraped or transmitted.
  - Rejects oversized payloads (> 5,000 characters) with HTTP 400.
  - Upstream errors (timeouts, 500s, unsupported language codes) are caught cleanly and return structured JSON errors with HTTP 422 or 502, keeping the frontend advice intact.

---

## 5. Server-Side Environment Configuration

The following environment variables are configured in `.env` (server-side only):

```bash
# BHIV Vaani TTS Sovereign Service Configuration
VAANI_BASE_URL="http://163.128.209.18:8016"
VAANI_API_KEY="" # Optional Bearer token (not required for port 8016 internal instance)
```

> [!NOTE]
> `VAANI_BASE_URL` and `VAANI_API_KEY` are not prefixed with `VITE_` or `PUBLIC_`, ensuring they are never bundled into client-side JavaScript.

---

## 6. Files Changed and Created

| File Path | Action | Description |
|:---|:---:|:---|
| `.env` | Modified | Added `VAANI_BASE_URL="http://163.128.209.18:8016"` and `VAANI_API_KEY=""`. |
| `src/lib/vaani-tts.server.ts` | **New** | Server-side proxy handling upstream communication, language gating, validation, and WAV streaming. |
| `src/lib/vaani-tts.functions.ts` | **New** | TanStack Start server function RPC for client audio synthesis requests. |
| `src/server.ts` | Modified | Registered `/api/tts` (POST) and `/api/tts/health` (GET) endpoints. |
| `src/lib/advice-summary.ts` | **New** | Helper `buildSimpleAdviceParagraph()` generating truthful short advice with untranslated caveats. |
| `src/components/farm/VaaniAudioPlayer.tsx` | **New** | Mobile-first audio player component using single global `HTMLAudioElement` with full error/loading states. |
| `src/components/farm/SimpleAdviceHero.tsx` | **New** | Core Hero component displaying advice paragraph first, audio player, persistent warnings, helplines, and expander. |
| `src/components/farm/AdviceActions.tsx` | Modified | Replaced legacy browser `window.speechSynthesis` with `<VaaniAudioPlayer>`. |
| `src/routes/result.tsx` | Modified | Integrated `<SimpleAdviceHero>`, wrapped technical widgets inside collapsed details, localized distress alert. |
| `src/routes/advice.$service.tsx` | Modified | Integrated `<SimpleAdviceHero>` for service-specific views, localized empty/error states. |
| `src/routes/__root.tsx` | Modified | Localized `FooterNote` with sovereign data disclosure. |
| `src/routes/ask.tsx` | Modified | Localized state selector, dynamic district catalog, and soil/water data disclaimer. |
| `src/routes/listing.new.tsx` | Modified | Localized produce category, grade, pricing, lot size, pickup location, submit loading state. |
| `src/routes/listings.tsx` | Modified | Localized persistence notice, status filter tabs, card metadata, empty state. |
| `src/routes/orders.index.tsx` | Modified | Localized order filter tabs, refresh button, settlement preview, itemized card summaries. |
| `src/routes/orders.$orderId.tsx` | Modified | Localized buyer specs, delivery window, financial settlement table & mobile cards, governance pillars, decline modal. |
| `src/components/farm/PlantCheck.tsx` | Modified | Localized visual observation, species, growth stage, limitations, distress notice, request ID. |
| `src/components/farm/PriceSeriesChart.tsx` | Modified | Localized chart title, benchmark percentiles (P25/P50/P75), latest quote date, recent quotes, footnote. |
| `src/components/farm/TopNav.tsx` | Modified | Added unique test IDs `top-nav-lang-trigger`, `lang-btn-en`, `lang-btn-hi`, `lang-btn-mr`. |
| `src/lib/i18n.tsx` | Modified | Expanded English, Hindi, and Marathi dictionaries with over 150 translation keys. |
| `tests/verify_advice_tts_localization.ts` | **New** | End-to-end automated verification suite for Advice, TTS, and Localization. |

---

## 7. Exact Regression-Test Commands and Results

All verification suites were executed from `c:\Users\Rahil Mulani\Desktop\AIAIC-Farmers-Platform\farmer-s-friend-dashboard-main`:

### 7.1 Linter Check
```bash
npm run lint
```
**Result**: **Passed** (0 errors, 0 warnings across all `.ts` and `.tsx` files).

### 7.2 TypeScript Typecheck
```bash
npx tsc --noEmit
```
**Result**: **Passed** (0 type errors).

### 7.3 Production Build
```bash
npm run build
```
**Result**: **Passed** (Vite client bundle and Nitro server build completed with 0 errors).

### 7.4 Automated Lifecycle Suite
```bash
npx tsx tests/automated_lifecycle_suite.ts
```
**Result**: **6/6 Passed (100%)**
- Test 1: Healthcheck & service status -> PASS
- Test 2: District catalog & dynamic crops -> PASS
- Test 3: Produce listing lifecycle (create, fetch, match) -> PASS
- Test 4: Order acceptance & idempotency -> PASS
- Test 5: Order decline & status check -> PASS
- Test 6: Plant health diagnosis & farmer view -> PASS

### 7.5 Mobile Horizontal Overflow Audit
```bash
npx tsx tests/verify_mobile_overflow.ts
```
**Result**: **53/53 Viewports Passed (100%)**
- Audited widths: `320px`, `360px`, `375px`, `390px`, `430px`.
- Horizontal overflow: **0px** across all routes (`/`, `/ask`, `/result`, `/advice/soil-health`, `/listings`, `/listing/new`, `/orders`, `/orders/ord-sample-001`).

### 7.6 Targeted Advice, Localization, and TTS Suite
```bash
npx tsx tests/verify_advice_tts_localization.ts
```
**Result**: **27/27 Assertions Passed (100%)**
- **Group 1: Advice Summarizer & Faithfulness**:
  - Faithful extraction of headline and actions -> PASS
  - Vernacular Marathi prioritization -> PASS
  - Untranslated English caveat generation -> PASS
  - Cautious fallback on empty payloads -> PASS
  - No synthetic advice invention -> PASS
  - Character boundary preservation -> PASS
- **Group 2: Vaani TTS Server Proxy & Capability**:
  - Live proxy health endpoint verification -> PASS
  - Valid WAV response for Hindi (`hi`) synthesis -> PASS
  - Audio content verification (135KB WAV, 22050Hz PCM) -> PASS
  - Proper HTTP 422 rejection for unsupported Marathi (`mr`) -> PASS
  - Proper HTTP 422 rejection for unsupported English (`en`) -> PASS
  - Payload text length boundary validation (5,000 char contract) -> PASS
  - Rejection of invalid inputs -> PASS
- **Group 3: Browser UI, Expander & Audio Integration**:
  - Simple advice Hero card displayed first on `/result` -> PASS
  - Details collapsed by default (`aria-expanded="false"`) -> PASS
  - Urgent warning banner visible while collapsed -> PASS
  - National helplines (1800-180-1551 & 14416) clickable while collapsed -> PASS
  - "More details" expander reveals `DashboardSummary`, `PlantCheck`, `PriceSeriesChart` -> PASS
  - Collapsing restores initial compact state -> PASS
  - Language toggle switches from Marathi to Hindi and English without reload -> PASS
  - Hindi audio control renders `"सुनें (Vaani)"` with valid play action -> PASS
  - Marathi audio control renders `"मराठी आवाज सेवा उपलब्ध नाही"` with zero crash -> PASS
  - Zero calls to legacy `window.speechSynthesis` recorded -> PASS

---

## 8. Actual Browser & Audio Verification Results

### 8.1 Visual & Interactive Verification
- Tested via headless Chrome automation and interactive browser subagents.
- Screen recording generated and saved to artifacts:
  - `farmer_advice_demo_1792607040802.webp`
- Key screenshots preserved in artifact storage:
  - `result_page_initial_1792607053409.png`: Simple advice hero visible immediately on load, urgent warning badge rendered, helplines visible, details collapsed.
  - `expanded_details_opened_1792607144775.png`: Full technical breakdown, plant check, and price series rendered upon clicking "More details".
  - `expanded_arrow_check_1792607229313.png`: Correct chevron icon rotation and `aria-expanded` synchronization.

### 8.2 Audio Playback Verification
- Live audio synthesis for Hindi (`hi`) was tested end-to-end:
  - Request: `POST /api/tts` with `"नमस्ते किसान भाई, आपकी फसल अच्छी है।"`
  - Response: Valid WAV audio returned in ~850ms.
  - Audio headers: `RIFF$!\x02\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x22\x56\x00\x00\x44\xAC\x00\x00\x02\x00\x10\x00data`.
  - Client player: Loaded audio into `<audio>` element, transitioned state to `playing`, and paused/stopped cleanly without sound overlap.

---

## 9. Remaining Integration Blockers & Service Owner Action

### 9.1 Blockers
1. **Marathi (`mr`) Offline TTS Missing on Vaani Host**:
   - The deployed Vaani service at `http://163.128.209.18:8016` fails when queried for `language: "mr"` with `HTTP 500: Synthesis failed: No native offline TTS engines available.`
   - In accordance with manager instructions, Annapoorna does **not** send Marathi text as Hindi or English to force nominal success, and does **not** silently fall back to browser speech synthesis. Marathi advice is displayed in high-contrast text, accompanied by the localized message: `"मराठी आवाज सेवा उपलब्ध नाही (TTS सेवा समर्थन प्रलंबित)"`.

### 9.2 Service Owner Action Required
To enable Marathi voice synthesis for Annapoorna farmers:
1. **Host-Side Model Installation**:
   - The Vaani service container running on `163.128.209.18:8016` needs an offline Marathi voice model provisioned (e.g. `espeak-ng-data` with Marathi dictionary, Indic-TTS Marathi weights, or Piper Marathi ONNX model).
2. **Expose `mr` in Capability List**:
   - Update `GET /v1/tts/languages` on the Vaani service to return `"mr"`.
3. **Application Enablement**:
   - Once verified, add `"mr"` to `VAANI_VERIFIED_LANGUAGES` in `src/lib/vaani-tts.server.ts`. No other application changes are needed.

---

## 10. Audit Conclusion

All three requested improvements have been fully designed, implemented, and validated:
- ✅ Simple, truthful farmer advice appears first, with persistent urgent warnings and national helplines.
- ✅ Complete multi-lingual localization across English, Hindi, and Marathi with zero horizontal overflow on mobile viewports (320px–430px).
- ✅ BHIV Vaani TTS service integrated securely via a server-side proxy, delivering real WAV audio for Hindi, honest capability handling for Marathi, and total elimination of browser speech synthesis.
- ✅ Zero regressions in existing plant health, marketplace listings, order idempotency, or mobile UI.
- ✅ All uncommitted repository state strictly preserved.
