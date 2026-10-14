# Morphic Production Implementation Roadmap: From Local Stack to Android Release

This document defines the prioritized, step-by-step master plan for taking **Morphic** from the current local Docker setup to a scalable multi-user cloud backend and a published Android mobile application.

---

## 0. Current Baseline vs. Production Gap Analysis

| Component | Current Local Setup | Production Requirement | Action Required |
| :--- | :--- | :--- | :--- |
| **Backend & Hosting** | Local Docker (`localhost:3000`) | Cloud Serverless / VPS (`https://api.morphic.sh`) | Deploy Next.js to Vercel or Fly.io |
| **Authentication** | `ENABLE_AUTH=false` (Anonymous) | Multi-User Supabase Auth (`ENABLE_AUTH=true`) | Connect Supabase Project & RLS policies |
| **Database** | Local Postgres container (`localhost:5432`) | Cloud PostgreSQL (Supabase / Neon DB with SSL) | Run `bun migrate` on Cloud DB |
| **Cache / Rate Limit** | Local Redis container (`localhost:6379`) | Upstash Serverless Redis REST | Set `UPSTASH_REDIS_REST_URL` & Token |
| **Search Engine** | Local SearXNG container (`localhost:8080`) | Cloud Search API (Tavily / Exa / VPS SearXNG) | Set `TAVILY_API_KEY` for serverless cloud |
| **Mobile API** | Web chat endpoint only (`/api/chat`) | Dedicated Mobile Assistant APIs with CORS | Create `/api/assist/query` & `/api/assist/images` |
| **Client** | Web browser only | Kotlin + Jetpack Compose Android Client | Build native app & overlay services |

---

## Master Step-by-Step Implementation Sequence

```
[ PHASE 1: BACKEND API & CORS BRIDGE ]
                  │
                  ▼
[ PHASE 2: DATABASE, AUTH & MULTI-USER CLOUD (Supabase) ]
                  │
                  ▼
[ PHASE 3: CLOUD INFRASTRUCTURE DEPLOYMENT (Vercel + Upstash) ]
                  │
                  ▼
[ PHASE 4: ANDROID CLIENT CORE & FLOATING OVERLAY (Compose) ]
                  │
                  ▼
[ PHASE 5: ACCESSIBILITY ENGINE & IN-PLACE INJECTION ]
                  │
                  ▼
[ PHASE 6: RICH MEDIA, IMAGES & LIBRARIES.DEV POLISH ]
                  │
                  ▼
[ PHASE 7: PRO TIER VISION AGENT (MediaProjection) ]
                  │
                  ▼
[ PHASE 8: PRODUCTION HARDENING & PLAY STORE SUBMISSION ]
```

---

## Phase 1: Backend Mobile Assistant API & CORS Bridge `[COMPLETED]`
*Target Timeline: Step 1 (Immediate) — Status: Verified & Tested*

Exposed endpoints tailored for the mobile assistant with full cross-origin and dual-mode auth capabilities:
1. **Implemented `/api/assist/query` Route (`app/api/assist/query/route.ts`)**:
   - Accepts prompt, mobile context (`packageName`, `selectedText`, `inputFieldText`), search depth, and model selection.
   - Emits structured Server-Sent Events (SSE):
     - `status`: Research progress step notifications (`searching`, `synthesizing`).
     - `answer_chunk`: Plain text summary stream tailored for mobile readability.
     - `links`: Array of top canonical links with domain names and Google favicon resolver.
     - `images`: Array of resolved image thumbnail and full URLs.
     - `done`: Session completion payload with execution timing and statistics.
     - `error`: Structured JSON error stream with retry indicators.
2. **Implemented `/api/assist/images` Route (`app/api/assist/images/route.ts`)**:
   - Lightweight direct image search endpoint for voice-to-image insertion workflows (<300ms latency).
   - Supports both `GET (?q=...)` and `POST (JSON body)` with full CORS.
3. **CORS & Dual-Mode Auth Resolver (`lib/api/mobile-cors.ts`, `lib/api/mobile-auth.ts`)**:
   - Dual-mode auth resolver supporting:
     - `X-Morphic-Anonymous-Id: <device-id>` for self-hosted Docker deployments.
     - `Authorization: Bearer <supabase_jwt>` for production cloud deployments.
   - Comprehensive CORS headers (`Access-Control-Allow-Origin: *`) with preflight OPTIONS (204 No Content).
4. **Automated Test Coverage**:
   - `lib/api/__tests__/mobile-cors.test.ts` (5 tests passing)
   - `lib/api/__tests__/mobile-auth.test.ts` (4 tests passing)
   - `app/api/assist/__tests__/assist-routes.test.ts` (6 tests passing)
   - Total: 15 passing unit tests, zero TypeScript errors.

---

## Phase 2: Database, Multi-User Auth & Supabase Migration `[COMPLETED]`
*Target Timeline: Step 2 — Status: Applied, Hardened & Verified*

Connected Supabase cloud project (`ap-northeast-1`), applied all 19 Drizzle migrations, enabled multi-user authentication, and hardened Row-Level Security:
1. **Configured Environment Credentials (`.env.local`)**:
   - `NEXT_PUBLIC_SUPABASE_URL=https://tbyxsuudhwoomfareqen.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` configured.
   - `DATABASE_URL` routed through the IPv4 Supabase session connection pooler (`aws-0-ap-northeast-1.pooler.supabase.com:5432`) with SSL.
   - Switched from single-user `ENABLE_AUTH=false` to multi-user `ENABLE_AUTH=true` (`AUTH_PROVIDER=supabase`).
2. **Applied Database Migrations (`bun migrate`)**:
   - All 19 versioned Drizzle migrations applied successfully to the cloud database.
   - Verified existence of all 9 core application tables: `chats`, `messages`, `parts`, `notes`, `files`, `feedback`, `usage_grants`, `usage_events`, `additional_usage_interest`.
3. **Hardened Row-Level Security (`drizzle/0019_force_row_level_security.sql`)**:
   - Applied `FORCE ROW LEVEL SECURITY` to all user-sensitive tables (`chats`, `messages`, `parts`, `notes`, `files`, `usage_grants`).
   - Updated `withRLS()` to enforce the `authenticated` role on transactions in Supabase environments.
4. **Automated Smoke Test Suite (`scripts/verify-supabase.ts`)**:
   - Verified all 16 active RLS policies in PostgreSQL.
   - Ran live cross-tenant test: User B querying User A's private chat returns 0 rows (isolated).
   - Verified Supabase Auth API reachability and enabled providers.

---

## Phase 3: Cloud Infrastructure Deployment `[CONFIGURED & VERIFIED]`
*Target Timeline: Step 3 — All Cloud Services Live & Ready for Vercel Release*

The mobile app and web clients connect to a persistent HTTPS endpoint reachable worldwide:
1. **Pre-flight Build & Suite Verification**:
   - Resolved `@opentelemetry/exporter-trace-otlp-http` dependency for Turbopack compilation.
   - Verified Next.js 16.2.6 Turbopack production build (`bun run build`) with all 24 routes compiling in 17.3s.
   - Verified Vitest suite (1,027 unit/integration tests passing across 114 test files).
2. **Upstash Redis Configuration & Live Ping**:
   - Configured Upstash Serverless Redis REST (`giving-bullfrog-45363.upstash.io`).
   - Verified via `scripts/verify-cloud-infra.ts`: PING (PONG), SET (OK), and GET (verified).
3. **Production Search API Configuration & Live Search**:
   - Configured Tavily Search API (`tvly-dev-...`).
   - Verified via `scripts/verify-cloud-infra.ts`: 5 web results and 5 rich image results with titles & descriptions.
4. **End-to-End Live Mobile Assistant Verification (`scripts/verify-assist-live.ts`)**:
   - Verified authenticated Supabase JWT access.
   - Verified `/api/assist/images`: HTTP 200 with instant image previews.
   - Verified `/api/assist/query`: HTTP 200 with real-time SSE stream (`status`, `links`, `images`, `answer_chunk`, `done`) using Gemini 2.5 Flash + Tavily.
5. **Ready for Vercel Deployment**:
   - Production environment variables manifest assembled for Vercel project settings.
   - Ready to run `vercel --prod` or link via GitHub.



---

## Phase 4: Android Client Core & Floating Overlay Engine
*Target Timeline: Step 4*

Build the native Android application in Kotlin using Jetpack Compose:
1. **Scaffold Project (`com.morphic.android`)**:
   - Target SDK: 35 (Android 15), Min SDK: 30 (Android 11).
   - Dependencies: Jetpack Compose, Coil (images), Ktor/OkHttp (networking), Supabase Kotlin SDK.
2. **Build Mode 1: Native Research Hub**:
   - High-performance Compose UI or full-screen WebView wrapper connecting to your production URL with deep link interception (`morphic://hub/...`).
3. **Build Mode 2: Floating Window Service (`SYSTEM_ALERT_WINDOW`)**:
   - Implement `MorphicOverlayService` running with `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY`.
   - Build **State A (Ambient Pill `48dp × 48dp`)** with fluid touch drag handles and edge snapping.
   - Build **State C (Floating Morphic HUD Window)** with resizable bounds, mode selector (`[ Fast | Deep Research | Chat ]`), opacity slider, and window minimize/maximize controls.

---

## Phase 5: Accessibility Engine & Smart In-Place Injection
*Target Timeline: Step 5*

This connects the floating overlay directly to target apps on the device:
1. **Implement `MorphicAccessibilityService`**:
   - Declare `android.permission.BIND_ACCESSIBILITY_SERVICE` in `AndroidManifest.xml`.
   - Listen for `AccessibilityEvent.TYPE_VIEW_FOCUSED` and `TYPE_WINDOW_STATE_CHANGED`.
2. **Keyboard Inset Tracking & Docking**:
   - Query `WindowInsetsCompat.Type.ime()`. When keyboard pops up, glide the pill to rest **12dp above the keyboard**.
3. **Text Injection Engine**:
   - Implement cursor insertion (`ACTION_SET_TEXT`).
   - Implement selection replacement (`selectionStart != selectionEnd`).
   - Implement clipboard paste fallback for custom WebViews.
4. **Security & Privacy Shield**:
   - Implement auto-suppression on `TYPE_TEXT_VARIATION_PASSWORD` and package blocklists (banking, 2FA apps).

---

## Phase 6: Rich Media, Images & Libraries.dev Visual Polish
*Target Timeline: Step 6*

1. **Image Caching & FileProvider**:
   - Download images into `$CACHE_DIR/shared_images/`.
   - Configure `FileProvider` with temporary read permission grants.
   - Support `InputContentInfoCompat` (`CommitContent`) to inject images directly into WhatsApp/Telegram chats.
2. **Integrate Libraries.dev Components & Polish**:
   - Integrate `border-beam` on the floating window perimeter and active input fields.
   - Integrate `thinking-orbs` for real-time visual tracking of research steps (`searching` -> `reading` -> `synthesizing`).
   - Integrate `voice-glow` for speech decibel visualization.
   - Integrate `img-fx` for pixel-dissolve image reveals.

---

## Phase 7: Pro Tier Vision & Screen Automation
*Target Timeline: Step 7*

1. **MediaProjection Screen Capture**:
   - Initialize runtime screen capture session via `MediaProjectionManager`.
   - Ephemerally pass frame buffers to Gemini 2.5 Flash Vision API.
2. **Automated Gestures**:
   - Vision API returns target coordinates `(x, y)` $\rightarrow$ execute `AccessibilityService.dispatchGesture()`.
3. **Voice Response Back**:
   - Synthesize speech via Android TextToSpeech to confirm actions to the user.

---

## Phase 8: Production Hardening & Google Play Store Submission
*Target Timeline: Step 8 (Final Launch)*

1. **Google Play Accessibility Policy Compliance**:
   - Implement the prominent in-app disclosure modal explaining why Accessibility is used (text injection only, zero keystroke logging).
   - Record a demonstration video showing the voice-to-insertion flow for Google Play Reviewers.
2. **Battery & Background Survival**:
   - Implement `FOREGROUND_SERVICE_TYPE_SPECIAL_USE` with persistent notification channel.
   - Prompt user to exclude Morphic from OEM battery killers.
3. **Build & Release**:
   - Generate production signed Android App Bundle (AAB).
   - Submit to Google Play Console (Closed Testing $\rightarrow$ Open Beta $\rightarrow$ Production).

---

### Reference Architecture Specifications
- **Master PRD & System Blueprint**: [superior.md](file:///c:/Users/VISHRUTH/morphic/morphic/superior.md)
- **Complete Feature Catalog**: [features.md](file:///c:/Users/VISHRUTH/morphic/morphic/features.md)
- **Features & Media Pipeline**: [ANDROID_FEATURES_SPEC.md](file:///c:/Users/VISHRUTH/morphic/morphic/ANDROID_FEATURES_SPEC.md)
- **Overlay Lifecycle & Edge-Case Architecture**: [OVERLAY_EDGE_CASES_AND_LIFECYCLE.md](file:///c:/Users/VISHRUTH/morphic/morphic/OVERLAY_EDGE_CASES_AND_LIFECYCLE.md)
- **Libraries.dev UI Integration**: [UI_LIBRARIES_INTEGRATION.md](file:///c:/Users/VISHRUTH/morphic/morphic/UI_LIBRARIES_INTEGRATION.md)
- **Libraries.dev Agent Requirements & Rules**: [LIBRARIES_DEV_AGENT_REQUIREMENTS.md](file:///c:/Users/VISHRUTH/morphic/morphic/LIBRARIES_DEV_AGENT_REQUIREMENTS.md)