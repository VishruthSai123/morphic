# Morphic Android Re-Architecture & Implementation Plan
## Exact Next.js Web Integration & Native Ambient Floating Overlay Engine

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Pivot & Clarification
- **Previous Approach (Flawed):** Rebuilding Morphic's UI from scratch in native Jetpack Compose (`SearchScreen`, `ChatScreen`, `LoginScreen`, `SettingsScreen`). This resulted in a completely different, stripped-down application that lacked Morphic's GenerativeUI, dynamic tool rendering, markdown/LaTeX streaming, artifacts system, model selector, sidebar history, and active Supabase account features.
- **The Correct Architecture:**
  1. **Main App (`MainActivity`):** Hosts the **exact, real Morphic Next.js Web Application** (`https://superior21.vercel.app`) inside an ultra-optimized, hardware-accelerated, edge-to-edge native Android shell. The user experiences 100% of Morphic's production UI, Supabase authentication, cloud chat history, model selection, and rich artifact rendering.
  2. **Native Overlay Engine (`MorphicOverlayService`):** The native Android superpower that floats *above all third-party apps* (browsers, social media, messaging, documents). It has a 3-state ambient interface (**Pill**, **Drawer**, **HUD Mini-View**) styled **1:1 with Morphic's exact dark-mode design system**.
  3. **Bidirectional Wiring & Sync:** The Native Overlay and the Main Web App are deeply connected:
     - The Overlay queries the Morphic backend (`/api/assist/query`) using the **user's active Supabase session/cookies** extracted from the web shell.
     - Searches initiated from the Overlay immediately save to the user's Morphic account.
     - Tapping *"Open in Morphic"* on the Overlay brings up `MainActivity` and deep-links directly to the chat (`/search/[id]`) in the full web interface.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ANDROID OPERATING SYSTEM                        │
├────────────────────────────────────────────────────────────────────────┤
│  [MODE 1: MAIN LAUNCHER APP]                                           │
│  MainActivity (Edge-to-Edge Native Shell)                              │
│  └── MorphicWebView Container                                          │
│      ├── Direct Rendering of https://superior21.vercel.app/            │
│      │   ├── 100% Exact Morphic UI (GenerativeUI, Artifacts, Sidebar)  │
│      │   └── Supabase Multi-User Auth (Email, Password, OAuth)         │
│      ├── CookieManager (Persistent Session Sync)                       │
│      └── MorphicAndroidBridge (@JavascriptInterface)                   │
│          ├── Overlay State Controls (Toggle, Launch, Status)           │
│          ├── Permission Management (SYSTEM_ALERT_WINDOW)               │
│          └── Deep Link Routing (/search/[id])                          │
├────────────────────────────────────────────────────────────────────────┤
│  [MODE 2: NATIVE SYSTEM OVERLAY] (Floats over all Android Apps)        │
│  MorphicOverlayService (Foreground Service + WindowManager)            │
│  ├── State 1: Ambient Pill (52dp Frosted Bubble, Edge Snap)            │
│  ├── State 2: Quick Action Drawer (Search, Context, Open App)          │
│  └── State 3: Morphic HUD Mini-View (360dp × 480dp Research Window)     │
│      ├── 1:1 Morphic Aesthetics (zinc-950, zinc-800 borders, glows)    │
│      ├── Live Streaming Assistant (/api/assist/query SSE)              │
│      ├── Uses Synced User Session Cookies / Supabase JWT               │
│      └── "Open in Morphic" Deep Link -> Launches MainActivity          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. In-Depth Analysis of Morphic Next.js Web Architecture

### 2.1 Web Tech Stack & Entry Points
- **Framework:** Next.js 16.2.1 (App Router), React 19, Turbopack, Tailwind CSS 4.
- **Production URL:** `https://superior21.vercel.app/`
- **Root Layout (`app/layout.tsx`):**
  - Configures `ThemeProvider` (system/dark/light).
  - Renders `AppUserProvider`, `UserProvider`, `SidebarProvider`, `LibraryProvider`, `UsageBudgetProvider`.
  - Injects `Header` and `AppSidebar` (chat history, settings, user profile).
  - Wraps children in `ArtifactRoot` (side-by-side interactive code, diagrams, markdown artifacts).
- **Core Chat (`app/page.tsx` & `components/chat.tsx`):**
  - Uses `@ai-sdk/react` (`useChat`).
  - Model selection: Gemini 2.5 Flash, Gemini Pro, OpenAI, Claude, etc.
  - Streaming GenerativeUI: Renders markdown, source links, search status, dynamic tools, and generated artifacts.

### 2.2 Authentication & Session Flow
- **Provider:** Supabase Auth (`@supabase/ssr`).
- **Session Storage:** Browser cookies (`sb-<project-ref>-auth-token`, chunked cookies).
- **Client Supabase Client:** `createBrowserClient(url, key)` in `lib/supabase/client.ts`.
- **Server Middleware:** `updateSession(request)` in `lib/supabase/middleware.ts` reads and refreshes cookies.
- **Auth Routes:**
  - `/auth/login` (Email + password, OAuth redirect)
  - `/auth/sign-up`
  - `/auth/reset-password`
  - `/auth/oauth` (Callback handler)
- **Key Insight for Android:**
  Because Supabase session tokens are stored in standard HTTP cookies, Android's `android.webkit.CookieManager` retains the full session automatically! When the user signs in on the WebView, the cookies can be extracted in Kotlin and passed directly to `/api/assist/query` or other backend routes.

---

## 3. Component Architecture: Main App Native Web Shell

### 3.1 Responsibilities of `MainActivity`
`MainActivity` will no longer render custom Compose search or login screens. Instead, it serves as the host for `MorphicWebViewContainer`:
1. **Edge-to-Edge Layout:** Extends under system status and navigation bars with proper window insets handling.
2. **Modern WebView Configuration:**
   - `javaScriptEnabled = true`
   - `domStorageEnabled = true` (critical for Next.js, React hydration, and Supabase client storage)
   - `databaseEnabled = true`
   - `useWideViewPort = true`, `loadWithOverviewMode = true`
   - Hardware acceleration enabled at the window level.
3. **Session Persistence:**
   - `CookieManager.getInstance().setAcceptCookie(true)`
   - `CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)`
   - Synchronize cookies to disk via `CookieManager.getInstance().flush()` on lifecycle pauses.
4. **File Chooser Support:**
   - Overrides `WebChromeClient.onShowFileChooser(...)` using native `ActivityResultContracts.StartActivityForResult()` to support file uploads (images, PDFs, documents) in Morphic web.
5. **Back Navigation:**
   - Intercepts system back press via `OnBackPressedDispatcher`.
   - If `webView.canGoBack()`, navigates back in web history; otherwise finishes or minimizes the activity.
6. **Error & Offline Handling:**
   - Custom `WebViewClient.onReceivedError(...)` that presents a sleek, dark-themed Morphic offline screen with a "Retry Connection" button rather than Android's raw `net::ERR_CACHE_MISS` or `ERR_INTERNET_DISCONNECTED` page.
7. **Native Floating Action / Settings Menu:**
   - A non-intrusive native floating toggle or drawer button that allows the user to turn on/off the **Ambient Floating Overlay** and check/request `SYSTEM_ALERT_WINDOW` permission.

### 3.2 Bidirectional JavaScript Bridge (`MorphicAndroidBridge`)
Exposed to the web page via `window.MorphicAndroidBridge`:
```kotlin
class MorphicAndroidBridge(
    private val activity: ComponentActivity,
    private val onSessionExtracted: (String) -> Unit
) {
    @JavascriptInterface
    fun getBridgeVersion(): String = "1.0.0"

    @JavascriptInterface
    fun isOverlayEnabled(): Boolean {
        return Settings.canDrawOverlays(activity) && MorphicOverlayService.isRunning
    }

    @JavascriptInterface
    fun requestOverlayPermission() {
        if (!Settings.canDrawOverlays(activity)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${activity.packageName}")
            )
            activity.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun toggleOverlayService() {
        if (MorphicOverlayService.isRunning) {
            MorphicOverlayService.stop(activity)
        } else {
            MorphicOverlayService.start(activity)
        }
    }

    @JavascriptInterface
    fun notifySessionChanged() {
        // Trigger cookie extraction to update Overlay's authenticated state
        val cookies = CookieManager.getInstance().getCookie("https://superior21.vercel.app")
        onSessionExtracted(cookies ?: "")
    }
}
```

---

## 4. Component Architecture: Native Floating Overlay Engine

### 4.1 Native Superpower Requirements
The Floating Overlay is an ambient assistant that runs continuously across the entire Android OS via `MorphicOverlayService`. It must match Morphic's web interface aesthetic with mathematical precision.

### 4.2 Exact Visual Style Tokens (Matching Morphic Web)
From `app/globals.css`:
- **Background:** Deep dark zinc-950 (`#09090b` / `Color(0xFF09090B)`) with 95% opacity and subtle backdrop blur.
- **Card / Surface:** Zinc-900 (`#18181b` / `Color(0xFF18181B)`).
- **Borders:** 1dp subtle stroke in Zinc-800 (`#27272a` / `Color(0xFF27272A)`).
- **Primary Text:** Crisp pure white (`#FFFFFF` / `Color(0xFFFFFFFF)`).
- **Muted Text:** Zinc-400 (`#A1A1AA` / `Color(0xFFA1A1AA)`).
- **Accent Glow:** Subtle cyan/emerald/indigo glow for active research states (mimicking Morphic's `thinking-orbs`).
- **Corner Radii:**
  - Pill: Fully rounded circular capsule (52dp circle).
  - Drawer: Capsule (rounded 24dp).
  - HUD Mini-View: Modern card radius (20dp).

### 4.3 The 3 Overlay States
1. **State 1: Ambient Pill (52dp)**
   - Unobtrusive floating badge displaying the Morphic logo.
   - Smooth edge snapping: magnets to left or right screen border when released.
   - Draggable across the screen with touch physics.
   - Tap -> Expands to State 2 (Drawer) or directly to State 3 (HUD).
2. **State 2: Quick Action Drawer**
   - Compact horizontal or vertical capsule:
     - 🔍 *Search* -> Opens HUD.
     - 📋 *Ask About Screen / Context* -> Grabs active clipboard/context and initiates research.
     - 🌐 *Open Full Morphic* -> Launches `MainActivity` to the web app.
     - ✖ *Dismiss / Hide*.
3. **State 3: HUD Mini-View (Floating Research Window, ~360dp × 480dp)**
   - Draggable header with title and close/minimize buttons.
   - Compact search input with auto-focus.
   - Live streaming response from `/api/assist/query` (SSE).
   - Source chips showing domain names and favicons.
   - **"Open in Morphic" Action:** Tapping this launches `MainActivity` with deep link `https://superior21.vercel.app/search/[id]`, immediately loading the full chat in the web app where the user can see all rich artifacts and continue the conversation.

---

## 5. Wiring Overlay to User Account & Backend

### 5.1 Authentication Synchronization Pipeline
```
[User logs in on Web (MainActivity)]
                 │
                 ▼
[CookieManager stores sb-*-auth-token]
                 │
                 ▼
[SessionSyncManager extracts cookies/token]
                 │
                 ▼
[MorphicApiClient passes Cookie / Bearer header]
                 │
                 ▼
[/api/assist/query executes under authenticated User ID]
                 │
                 ▼
[Chat saved in Supabase database & visible in Web Sidebar]
```

1. **`SessionSyncManager` (Singleton / DataStore):**
   - Reads cookies for `https://superior21.vercel.app` via `CookieManager.getInstance().getCookie(...)`.
   - Parses the Supabase access token (or passes the full Cookie header).
   - Injects the authenticated credentials into `MorphicApiClient` for all overlay requests.
2. **Dual-Mode Fallback:**
   - If the user is logged in: Queries execute under their Supabase user ID, and chat history appears in their account.
   - If the user is browsing as a guest: Queries execute with a persistent `X-Morphic-Anonymous-Id` device ID, preserving functionality.

---

## 6. Implementation Steps & Exact Changes Required

### Phase 4.1: Main Web App Container Implementation
- [ ] Create `MorphicWebViewContainer.kt` in `ui/web/`:
  - Compose `AndroidView` wrapping a configured `WebView`.
  - Configure `WebChromeClient` with file chooser and load progress.
  - Configure `WebViewClient` with custom URL routing and error handling.
  - Inset padding for status and navigation bars.
- [ ] Create `MorphicAndroidBridge.kt` in `bridge/`:
  - Implement `@JavascriptInterface` methods for overlay control and session sync.
- [ ] Refactor `MainActivity.kt`:
  - Remove obsolete custom Compose navigation screens (`SearchScreen`, `LoginScreen`, `SettingsScreen`).
  - Render `MorphicWebViewContainer` as the primary UI.
  - Add floating overlay toggle FAB or top status chip.
  - Handle deep-link intents (`android.intent.action.VIEW` for `https://superior21.vercel.app/*`).

### Phase 4.2: Session Synchronization Layer
- [ ] Create `SessionSyncManager.kt` in `data/auth/`:
  - Interface between Android `CookieManager` and `MorphicApiClient`.
  - Extract and cache Supabase auth tokens.
- [ ] Update `MorphicApiClient.kt`:
  - Ensure all calls to `/api/assist/query` and `/api/assist/images` include the extracted `Cookie` and `Authorization` headers.

### Phase 4.3: Overlay Visual & Functional Polish (1:1 Morphic Theme)
- [ ] Refactor `HudView.kt`:
  - Apply exact zinc-950 (`#09090b`), zinc-900 (`#18181b`), and zinc-800 (`#27272a`) design tokens.
  - Modernize search bar and source chip components to match Morphic web styling.
  - Add "Open in Morphic" action button that opens `MainActivity` at `/search/[id]`.
- [ ] Refactor `DrawerView.kt` and `PillView.kt`:
  - Enhance touch physics, spring animations, and edge-magnetic snapping.
- [ ] Update `MorphicOverlayService.kt`:
  - Ensure lifecycle robustness and graceful handling of orientation changes and keyboard input.

### Phase 4.4: Cleanup of Obsolete Code
- [ ] Remove unused Compose screens in `ui/screens/*` that conflict with the web app.
- [ ] Ensure all Gradle dependencies and build files remain pristine and error-free.

---

## 7. Strict Rules & Guardrails for Implementation

1. **NO UI RE-CREATION FOR MAIN APP:**
   - Under no circumstances should we create custom mock screens for Morphic's core features. The Next.js web application is the ground truth.
2. **WEBVIEW COOKIE & CACHE INTEGRITY:**
   - Never disable cookies or DOM storage.
   - Always call `CookieManager.getInstance().flush()` on pause.
3. **WINDOW_MANAGER LIFECYCLE SAFETY:**
   - All `WindowManager` calls (`addView`, `removeView`, `updateViewLayout`) MUST be executed on `Looper.getMainLooper()`.
   - Always verify `view.isAttachedToWindow` before removal to prevent runtime crashes.
4. **SECURE AUTH & SECRETS:**
   - No hardcoded API keys or secrets in the APK. The app talks exclusively to the Morphic backend endpoints.
5. **KEYBOARD INSET HANDLING IN OVERLAY:**
   - The HUD overlay window must use `WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL` and `SOFT_INPUT_ADJUST_RESIZE` so the soft keyboard does not clip or hide the search bar.
6. **PRESERVE GRADLE & JDK COMPATIBILITY:**
   - Always compile with JDK 17 LTS (`C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`) and Gradle 8.11.1 / AGP 8.8.2.

---

## 8. Verification & Acceptance Criteria

1. **Main App Verification:**
   - Launching the app on physical phone `4ac4a06f` loads `https://superior21.vercel.app/` cleanly.
   - Header, search input, model selector, and sidebar are 100% identical to the production web app.
   - Logging in via email/password or OAuth works seamlessly and persists after closing and reopening the app.
   - File attachment dialog triggers Android's native file picker.
2. **Overlay Verification:**
   - Floating Pill appears on screen over other apps (e.g., Settings, Chrome, Home Screen).
   - Tapping Pill opens Drawer; tapping Search opens HUD.
   - Running a search in HUD streams answer and source links from the live backend.
   - Tapping "Open in Morphic" brings up `MainActivity` and loads the conversation directly.
3. **Session Verification:**
   - Searches made in HUD are authenticated with the user's account and appear in the web sidebar history.
