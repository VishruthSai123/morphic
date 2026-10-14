# Phase 4: Android Client Core & Floating Overlay Engine

> **Status:** PLANNED — Ready for Implementation  
> **Prerequisites:** Phases 1–3 COMPLETED (Backend API, Supabase Auth, Cloud Infra)  
> **Outcome:** A working Android APK that connects to the Morphic backend, authenticates via Supabase, streams AI search results, and renders a floating overlay on top of any app.

---

## CRITICAL RULES FOR IMPLEMENTING AGENTS

> [!CAUTION]
> Read these rules before writing ANY code. Violating any of them will break the build.

1. **Language:** Kotlin ONLY. No Java files. No Groovy-based build scripts — use Kotlin DSL (`.kts`).
2. **UI Framework:** Jetpack Compose ONLY. No XML layouts. No `View` system (except for `WindowManager` overlay views which MUST use Compose inside `ComposeView`).
3. **Min SDK:** 30 (Android 11). Target SDK: 35 (Android 15).
4. **AI Provider:** Google Gemini models ONLY via the Morphic backend. The Android app NEVER calls AI APIs directly — it always goes through `https://<MORPHIC_BACKEND>/api/assist/query` and `/api/assist/images`.
5. **Auth Provider:** Supabase Kotlin SDK. The app sends `Authorization: Bearer <supabase_jwt>` on every API request.
6. **Project Location:** `c:\Users\VISHRUTH\morphic\morphic-android\` (sibling to the web app, NOT inside it).
7. **Package Name:** `com.morphic.android`
8. **DO NOT** add any AI SDK (Gemini SDK, OpenAI SDK) to the Android app. The backend handles all AI inference.
9. **DO NOT** use `WebView` for Mode 1. Build native Compose UI.
10. **DO NOT** use deprecated APIs (`AsyncTask`, `Loader`, `LocalBroadcastManager`).

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     ANDROID APP LAYERS                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    UI LAYER (Compose)                     │   │
│  │  ┌──────────────────┐  ┌───────────────────────────────┐ │   │
│  │  │ Mode 1: Hub      │  │ Mode 2: Overlay Service       │ │   │
│  │  │ (MainActivity)   │  │ (MorphicOverlayService)       │ │   │
│  │  │ • SearchScreen   │  │ • State A: Pill (48dp)        │ │   │
│  │  │ • ChatScreen     │  │ • State B: Quick Drawer       │ │   │
│  │  │ • HistoryScreen  │  │ • State C: Full HUD           │ │   │
│  │  │ • SettingsScreen │  │                               │ │   │
│  │  └──────────────────┘  └───────────────────────────────┘ │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            │                                     │
│  ┌─────────────────────────▼────────────────────────────────┐   │
│  │                 DOMAIN LAYER (ViewModels)                 │   │
│  │  • SearchViewModel    • ChatViewModel                     │   │
│  │  • AuthViewModel      • OverlayViewModel                 │   │
│  │  • SettingsViewModel                                      │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            │                                     │
│  ┌─────────────────────────▼────────────────────────────────┐   │
│  │               DATA LAYER (Repositories)                   │   │
│  │  • MorphicApiClient (OkHttp + SSE)                        │   │
│  │  • SupabaseAuthRepository                                 │   │
│  │  • ChatHistoryRepository (Room DB)                        │   │
│  │  • SettingsRepository (DataStore)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                     HTTPS (TLS 1.3)                              │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │     MORPHIC BACKEND          │
              │  (Vercel / localhost:3000)    │
              │                              │
              │  /api/assist/query  (SSE)    │
              │  /api/assist/images (JSON)   │
              │  Supabase Auth validation    │
              │  Gemini 2.5 Flash + Tavily   │
              └──────────────────────────────┘
```

---

## Step 0: Deploy Backend to Vercel (Prerequisite)

> [!IMPORTANT]
> The Android app needs a live HTTPS URL. You MUST deploy the Morphic web app to Vercel before the Android client can work in production. For local development, `http://10.0.2.2:3000` (Android emulator) or your machine's local IP works.

### 0.1 Deploy to Vercel

```bash
# In the morphic web project directory
cd c:\Users\VISHRUTH\morphic\morphic

# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts to link to a project)
vercel --prod
```

### 0.2 Set Production Environment Variables in Vercel Dashboard

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add ALL of these:

| Variable | Value | Notes |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | `AQ.Ab8RN6JT...` | Your Gemini key |
| `ENABLE_AUTH` | `true` | |
| `AUTH_PROVIDER` | `supabase` | |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tbyxsuudhwoomfareqen.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGci...` | The anon key |
| `SUPABASE_SECRET_KEY` | `eyJhbGci...` | The service_role key |
| `DATABASE_URL` | `postgresql://postgres.tbyxsuudhwoomfareqen:Vishruth.2008@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require` | |
| `DATABASE_SSL_DISABLED` | `false` | |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` | |
| `SEARCH_API` | `tavily` | |
| `TAVILY_API_KEY` | `tvly-dev-...` | |
| `UPSTASH_REDIS_REST_URL` | `https://giving-bullfrog-45363.upstash.io` | |
| `UPSTASH_REDIS_REST_TOKEN` | `AbEzAAIg...` | |
| `MORPHIC_CLOUD_DEPLOYMENT` | `true` | **true** in production! |
| `NEXT_PUBLIC_ENABLE_SHARE` | `true` | |

### 0.3 Verify Production URL

After deploy completes, Vercel gives you a URL like `https://morphic-xxxx.vercel.app`. Test:

```bash
curl https://morphic-xxxx.vercel.app/api/assist/images?q=hello
# Should return JSON with image results
```

Save this URL. The Android app will use it as `BASE_URL`.

---

## Step 1: Scaffold the Android Project

### 1.1 Create Project via Android Studio

> [!NOTE]
> If using the `android` CLI tool, run `android create-project`. Otherwise use Android Studio GUI.

**Project Settings:**
- **Name:** Morphic
- **Package:** `com.morphic.android`
- **Save location:** `c:\Users\VISHRUTH\morphic\morphic-android`
- **Language:** Kotlin
- **Minimum SDK:** API 30 (Android 11)
- **Build configuration language:** Kotlin DSL (`.kts`)
- **Template:** Empty Compose Activity

### 1.2 Project Directory Structure (Target State)

After scaffolding, the project MUST have this structure. Create any missing directories.

```
morphic-android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/morphic/android/
│   │   │   │   ├── MorphicApp.kt                    # Application class
│   │   │   │   ├── MainActivity.kt                   # Mode 1 entry point
│   │   │   │   │
│   │   │   │   ├── data/                             # DATA LAYER
│   │   │   │   │   ├── api/
│   │   │   │   │   │   ├── MorphicApiClient.kt       # HTTP client for backend
│   │   │   │   │   │   ├── SseParser.kt              # Server-Sent Events parser
│   │   │   │   │   │   └── models/                   # API request/response models
│   │   │   │   │   │       ├── AssistQueryRequest.kt
│   │   │   │   │   │       ├── AssistQueryEvent.kt
│   │   │   │   │   │       └── ImageSearchResponse.kt
│   │   │   │   │   ├── auth/
│   │   │   │   │   │   └── SupabaseAuthRepository.kt # Supabase auth wrapper
│   │   │   │   │   ├── local/
│   │   │   │   │   │   ├── MorphicDatabase.kt        # Room database
│   │   │   │   │   │   ├── ChatDao.kt                # Chat history DAO
│   │   │   │   │   │   └── entities/                 # Room entities
│   │   │   │   │   │       ├── ChatEntity.kt
│   │   │   │   │   │       └── MessageEntity.kt
│   │   │   │   │   └── settings/
│   │   │   │   │       └── SettingsDataStore.kt      # Preferences DataStore
│   │   │   │   │
│   │   │   │   ├── domain/                           # DOMAIN LAYER
│   │   │   │   │   ├── model/
│   │   │   │   │   │   ├── SearchResult.kt           # Domain models
│   │   │   │   │   │   ├── ChatMessage.kt
│   │   │   │   │   │   ├── ImageResult.kt
│   │   │   │   │   │   └── ResearchState.kt
│   │   │   │   │   └── repository/
│   │   │   │   │       ├── SearchRepository.kt       # Search data access
│   │   │   │   │       └── ChatRepository.kt         # Chat data access
│   │   │   │   │
│   │   │   │   ├── ui/                               # UI LAYER
│   │   │   │   │   ├── theme/
│   │   │   │   │   │   ├── Theme.kt                  # Material 3 dark theme
│   │   │   │   │   │   ├── Color.kt                  # Color palette
│   │   │   │   │   │   └── Type.kt                   # Typography (Inter font)
│   │   │   │   │   ├── navigation/
│   │   │   │   │   │   └── MorphicNavGraph.kt        # Navigation routes
│   │   │   │   │   ├── screens/
│   │   │   │   │   │   ├── search/
│   │   │   │   │   │   │   ├── SearchScreen.kt       # Main search UI
│   │   │   │   │   │   │   └── SearchViewModel.kt
│   │   │   │   │   │   ├── chat/
│   │   │   │   │   │   │   ├── ChatScreen.kt         # Chat detail UI
│   │   │   │   │   │   │   └── ChatViewModel.kt
│   │   │   │   │   │   ├── history/
│   │   │   │   │   │   │   ├── HistoryScreen.kt      # Chat history list
│   │   │   │   │   │   │   └── HistoryViewModel.kt
│   │   │   │   │   │   ├── auth/
│   │   │   │   │   │   │   ├── LoginScreen.kt        # Login UI
│   │   │   │   │   │   │   ├── SignupScreen.kt       # Signup UI
│   │   │   │   │   │   │   └── AuthViewModel.kt
│   │   │   │   │   │   └── settings/
│   │   │   │   │   │       ├── SettingsScreen.kt
│   │   │   │   │   │       └── SettingsViewModel.kt
│   │   │   │   │   └── components/                   # Shared UI components
│   │   │   │   │       ├── SearchBar.kt
│   │   │   │   │       ├── MessageBubble.kt
│   │   │   │   │       ├── SourceChip.kt
│   │   │   │   │       ├── ImageGrid.kt
│   │   │   │   │       ├── StreamingText.kt          # Animated text streaming
│   │   │   │   │       └── LoadingIndicator.kt
│   │   │   │   │
│   │   │   │   └── services/                         # SYSTEM SERVICES
│   │   │   │       ├── overlay/
│   │   │   │       │   ├── MorphicOverlayService.kt  # Foreground overlay service
│   │   │   │       │   ├── OverlayStateManager.kt    # State machine (A→B→C)
│   │   │   │       │   ├── PillView.kt               # State A: 48dp pill
│   │   │   │       │   ├── DrawerView.kt             # State B: Quick drawer
│   │   │   │       │   └── HudView.kt                # State C: Full HUD
│   │   │   │       └── MorphicForegroundService.kt   # Keep-alive foreground svc
│   │   │   │
│   │   │   ├── res/
│   │   │   │   ├── drawable/                         # Icons, shapes
│   │   │   │   ├── values/
│   │   │   │   │   ├── strings.xml
│   │   │   │   │   ├── colors.xml
│   │   │   │   │   └── themes.xml
│   │   │   │   └── xml/
│   │   │   │       └── file_provider_paths.xml       # FileProvider config
│   │   │   │
│   │   │   └── AndroidManifest.xml
│   │   │
│   │   └── test/                                     # Unit tests
│   │
│   └── build.gradle.kts                              # App-level build config
│
├── build.gradle.kts                                  # Project-level build config
├── settings.gradle.kts                               # Settings
├── gradle.properties                                 # Gradle properties
└── local.properties                                  # SDK path (auto-generated)
```

### 1.3 Dependencies (`app/build.gradle.kts`)

These are the EXACT dependencies to use. Do NOT substitute different libraries.

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.morphic.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.morphic.android"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // Build config field for backend URL
        buildConfigField("String", "MORPHIC_BASE_URL", "\"https://YOUR_VERCEL_URL.vercel.app\"")
        buildConfigField("String", "SUPABASE_URL", "\"https://tbyxsuudhwoomfareqen.supabase.co\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRieXhzdXVkaHdvb21mYXJlcWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDUwOTEsImV4cCI6MjEwNzQ4MTA5MX0.0WfBz65ZB2rYaVm6eW0t7o5In-zasc5T1F1xq8AzFo8\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // ── Compose BOM ──────────────────────────────────────────────
    val composeBom = platform("androidx.compose:compose-bom:2025.05.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
    implementation("androidx.navigation:navigation-compose:2.9.0")

    // ── Kotlin & Coroutines ──────────────────────────────────────
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")

    // ── Networking (OkHttp for SSE + Ktor for REST) ──────────────
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:okhttp-sse:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // ── Image Loading ────────────────────────────────────────────
    implementation("io.coil-kt.coil3:coil-compose:3.1.0")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.1.0")

    // ── Supabase Kotlin SDK ──────────────────────────────────────
    implementation(platform("io.github.jan-tennert.supabase:bom:3.1.4"))
    implementation("io.github.jan-tennert.supabase:gotrue-kt")
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.ktor:ktor-client-okhttp:3.1.3")

    // ── Local Database (Room) ────────────────────────────────────
    implementation("androidx.room:room-runtime:2.7.1")
    implementation("androidx.room:room-ktx:2.7.1")
    ksp("androidx.room:room-compiler:2.7.1")

    // ── DataStore (Settings) ─────────────────────────────────────
    implementation("androidx.datastore:datastore-preferences:1.1.7")

    // ── Markdown Rendering ───────────────────────────────────────
    implementation("com.mikepenz:multiplatform-markdown-renderer-android:0.37.0")
    implementation("com.mikepenz:multiplatform-markdown-renderer-m3:0.37.0")

    // ── Splash Screen ────────────────────────────────────────────
    implementation("androidx.core:core-splashscreen:1.0.1")

    // ── Debug ────────────────────────────────────────────────────
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
```

> [!WARNING]
> The exact version numbers above are correct as of October 2026. If a dependency fails to resolve, check Maven Central for the latest stable version of THAT EXACT artifact. Do NOT switch to a different library.

---

## Step 2: Core Networking Layer (THE FOUNDATION)

> [!IMPORTANT]
> This is the most critical layer. Everything else depends on it. Build this FIRST and test it BEFORE touching UI.

### 2.1 API Request/Response Models

**File: `data/api/models/AssistQueryRequest.kt`**

```kotlin
@Serializable
data class AssistQueryRequest(
    val query: String? = null,
    val messages: List<AssistMessage>? = null,
    val chatId: String? = null,
    val mode: String = "ambient_companion",  // "ambient_companion" | "hub_research" | "chat"
    val targetContext: TargetContext? = null,
    val options: QueryOptions = QueryOptions()
)

@Serializable
data class AssistMessage(
    val role: String,    // "user" | "assistant" | "system"
    val content: String
)

@Serializable
data class TargetContext(
    val packageName: String? = null,
    val selectedText: String? = null,
    val inputFieldText: String? = null
)

@Serializable
data class QueryOptions(
    val includeLinks: Boolean = true,
    val includeImages: Boolean = true,
    val searchDepth: String = "basic",   // "basic" | "advanced"
    val maxResults: Int = 5
)
```

**File: `data/api/models/AssistQueryEvent.kt`**

These match the SSE events emitted by `/api/assist/query`:

```kotlin
// The backend emits these SSE event types:
//   event: status        → { "step": "searching", "message": "Searching..." }
//   event: answer_chunk  → { "text": "partial answer text" }
//   event: links         → { "links": [...] }
//   event: images        → { "images": [...] }
//   event: done          → { "sessionId": "...", "timing": {...} }
//   event: error         → { "message": "...", "retryable": true }

@Serializable
data class StatusEvent(
    val step: String,           // "searching" | "reading" | "synthesizing"
    val message: String
)

@Serializable
data class AnswerChunkEvent(
    val text: String
)

@Serializable
data class LinkItem(
    val title: String,
    val url: String,
    val domain: String,
    val favicon: String? = null
)

@Serializable
data class LinksEvent(
    val links: List<LinkItem>
)

@Serializable
data class ImageItem(
    val id: String,
    val thumbnailUrl: String,
    val fullUrl: String,
    val title: String,
    val domain: String? = null
)

@Serializable
data class ImagesEvent(
    val images: List<ImageItem>
)

@Serializable
data class DoneEvent(
    val sessionId: String? = null,
    val totalDurationMs: Long? = null
)

@Serializable
data class ErrorEvent(
    val message: String,
    val retryable: Boolean = false
)
```

### 2.2 SSE Parser

**File: `data/api/SseParser.kt`**

The backend sends standard Server-Sent Events. Each event looks like:
```
event: answer_chunk
data: {"text":"The latest..."}

event: links
data: {"links":[{"title":"...","url":"...","domain":"..."}]}
```

```kotlin
/**
 * Parses a raw SSE text stream into structured events.
 * 
 * SSE format: Lines starting with "event:" define the event type.
 *             Lines starting with "data:" contain the JSON payload.
 *             A blank line terminates the event.
 *
 * This parser reads lines from an InputStream and emits SseEvent objects
 * via a Flow. It handles multi-line data fields by joining them with "\n".
 */
data class SseEvent(
    val event: String,      // "status", "answer_chunk", "links", "images", "done", "error"
    val data: String         // Raw JSON string
)

fun InputStream.asSseFlow(): Flow<SseEvent> = flow {
    bufferedReader(Charsets.UTF_8).use { reader ->
        var eventType = ""
        val dataLines = mutableListOf<String>()

        reader.forEachLine { line ->
            when {
                line.startsWith("event:") -> {
                    eventType = line.removePrefix("event:").trim()
                }
                line.startsWith("data:") -> {
                    dataLines.add(line.removePrefix("data:").trim())
                }
                line.isBlank() -> {
                    // Blank line = end of event
                    if (eventType.isNotEmpty() && dataLines.isNotEmpty()) {
                        val data = dataLines.joinToString("\n")
                        emit(SseEvent(event = eventType, data = data))
                    }
                    eventType = ""
                    dataLines.clear()
                }
            }
        }

        // Handle final event without trailing blank line
        if (eventType.isNotEmpty() && dataLines.isNotEmpty()) {
            emit(SseEvent(event = eventType, data = dataLines.joinToString("\n")))
        }
    }
}.flowOn(Dispatchers.IO)
```

### 2.3 Main API Client

**File: `data/api/MorphicApiClient.kt`**

```kotlin
/**
 * Central HTTP client for all Morphic backend communication.
 * 
 * Two endpoints:
 *   POST /api/assist/query   → Returns SSE stream (search + AI answer)
 *   GET  /api/assist/images  → Returns JSON (image search results)
 *
 * Authentication: Every request includes "Authorization: Bearer <jwt>"
 * where <jwt> is the Supabase access token from SupabaseAuthRepository.
 */
class MorphicApiClient(
    private val baseUrl: String = BuildConfig.MORPHIC_BASE_URL,
    private val getAccessToken: suspend () -> String?
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)     // SSE streams can be long
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.HEADERS
                    else HttpLoggingInterceptor.Level.NONE
        })
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Streams a search query to the backend and emits parsed SSE events.
     * 
     * The caller collects this flow and updates UI state accordingly:
     *   - "status"       → show progress indicator
     *   - "answer_chunk" → append text to answer display
     *   - "links"        → show source chips
     *   - "images"       → show image grid
     *   - "done"         → mark complete
     *   - "error"        → show error message
     */
    fun streamQuery(request: AssistQueryRequest): Flow<SseEvent> = flow {
        val token = getAccessToken()
            ?: throw IllegalStateException("Not authenticated")

        val requestBody = json.encodeToString(request)
            .toRequestBody("application/json".toMediaType())

        val httpRequest = Request.Builder()
            .url("$baseUrl/api/assist/query")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Accept", "text/event-stream")
            .build()

        val response = client.newCall(httpRequest).execute()

        if (!response.isSuccessful) {
            throw IOException("Query failed: HTTP ${response.code} ${response.message}")
        }

        val body = response.body
            ?: throw IOException("Empty response body")

        // Parse the SSE stream and emit each event
        body.byteStream().asSseFlow().collect { event ->
            emit(event)
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Fetches image search results (non-streaming, JSON response).
     */
    suspend fun searchImages(query: String, count: Int = 8): List<ImageItem> =
        withContext(Dispatchers.IO) {
            val token = getAccessToken()
                ?: throw IllegalStateException("Not authenticated")

            val url = "$baseUrl/api/assist/images?q=${URLEncoder.encode(query, "UTF-8")}&count=$count"

            val request = Request.Builder()
                .url(url)
                .get()
                .addHeader("Authorization", "Bearer $token")
                .build()

            val response = client.newCall(request).execute()

            if (!response.isSuccessful) {
                throw IOException("Image search failed: HTTP ${response.code}")
            }

            val responseBody = response.body?.string()
                ?: throw IOException("Empty response")

            val parsed = json.decodeFromString<ImageSearchResponse>(responseBody)
            parsed.images
        }
}
```

---

## Step 3: Supabase Authentication

### 3.1 Auth Repository

**File: `data/auth/SupabaseAuthRepository.kt`**

```kotlin
/**
 * Wraps the Supabase Kotlin SDK for authentication.
 *
 * Provides:
 *   - Email/password sign up and sign in
 *   - Access token retrieval for API requests
 *   - Auth state observation (logged in / logged out)
 *   - Sign out
 *
 * The Supabase client is initialized with:
 *   - SUPABASE_URL from BuildConfig
 *   - SUPABASE_ANON_KEY from BuildConfig
 *   - GoTrue plugin for auth
 *   - Ktor OkHttp engine for networking
 */
class SupabaseAuthRepository {

    private val supabase = createSupabaseClient(
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseKey = BuildConfig.SUPABASE_ANON_KEY
    ) {
        install(Auth)
        // Use OkHttp engine
        httpEngine = OkHttp.create()
    }

    val authState: Flow<AuthState> = supabase.auth.sessionStatus.map { status ->
        when (status) {
            is SessionStatus.Authenticated -> AuthState.Authenticated(
                userId = status.session.user?.id ?: "",
                email = status.session.user?.email ?: ""
            )
            is SessionStatus.NotAuthenticated -> AuthState.NotAuthenticated
            is SessionStatus.LoadingFromStorage -> AuthState.Loading
            is SessionStatus.NetworkError -> AuthState.Error("Network error")
        }
    }

    suspend fun signUp(email: String, password: String): Result<Unit> = runCatching {
        supabase.auth.signUpWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signIn(email: String, password: String): Result<Unit> = runCatching {
        supabase.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signOut(): Result<Unit> = runCatching {
        supabase.auth.signOut()
    }

    /**
     * Returns the current Supabase access token (JWT).
     * This is attached to every API request as "Authorization: Bearer <token>".
     * Returns null if not authenticated.
     */
    suspend fun getAccessToken(): String? {
        return supabase.auth.currentAccessTokenOrNull()
    }

    fun getCurrentUserId(): String? {
        return supabase.auth.currentUserOrNull()?.id
    }
}

sealed class AuthState {
    data object Loading : AuthState()
    data object NotAuthenticated : AuthState()
    data class Authenticated(val userId: String, val email: String) : AuthState()
    data class Error(val message: String) : AuthState()
}
```

---

## Step 4: Local Database (Room)

### 4.1 Room Entities & DAO

**File: `data/local/entities/ChatEntity.kt`**

```kotlin
@Entity(tableName = "chats")
data class ChatEntity(
    @PrimaryKey val id: String,
    val title: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val userId: String
)

@Entity(
    tableName = "messages",
    foreignKeys = [ForeignKey(
        entity = ChatEntity::class,
        parentColumns = ["id"],
        childColumns = ["chatId"],
        onDelete = ForeignKey.CASCADE
    )]
)
data class MessageEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val chatId: String,
    val role: String,          // "user" | "assistant"
    val content: String,
    val links: String? = null, // JSON-serialized List<LinkItem>
    val images: String? = null,// JSON-serialized List<ImageItem>
    val createdAt: Long = System.currentTimeMillis()
)
```

**File: `data/local/ChatDao.kt`**

```kotlin
@Dao
interface ChatDao {
    @Query("SELECT * FROM chats WHERE userId = :userId ORDER BY updatedAt DESC")
    fun getChatsByUser(userId: String): Flow<List<ChatEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertChat(chat: ChatEntity)

    @Query("SELECT * FROM messages WHERE chatId = :chatId ORDER BY createdAt ASC")
    fun getMessagesByChat(chatId: String): Flow<List<MessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity)

    @Query("DELETE FROM chats WHERE id = :chatId")
    suspend fun deleteChat(chatId: String)
}
```

**File: `data/local/MorphicDatabase.kt`**

```kotlin
@Database(
    entities = [ChatEntity::class, MessageEntity::class],
    version = 1,
    exportSchema = false
)
abstract class MorphicDatabase : RoomDatabase() {
    abstract fun chatDao(): ChatDao

    companion object {
        @Volatile private var INSTANCE: MorphicDatabase? = null

        fun getInstance(context: Context): MorphicDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    MorphicDatabase::class.java,
                    "morphic_db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
```

---

## Step 5: Mode 1 — Native Research Hub UI

### 5.1 Theme & Design System

**Design Requirements:**
- **Dark mode** by default (matches Morphic web)
- **Primary color:** Deep indigo/violet (`#6366F1`) — matches Morphic branding
- **Surface:** Near-black (`#0A0A0F`)
- **Font:** Inter (from Google Fonts, bundled as resource)
- **Cards:** Glassmorphic style with slight blur, translucent backgrounds (`Surface.copy(alpha = 0.6f)`)
- **Animations:** Spring-based enter/exit transitions, smooth text streaming

### 5.2 Screens to Build (Priority Order)

| Priority | Screen | Description |
|:---:|---|---|
| 1 | **LoginScreen** | Email + password fields, "Sign In" / "Create Account" buttons. Uses `AuthViewModel`. |
| 2 | **SearchScreen** | Main home screen. Large centered search bar. Recent searches below. User taps search bar → keyboard opens → types query → results stream in. |
| 3 | **ChatScreen** | Shows streaming AI response with sources, images, links. Supports follow-up questions (multi-turn). Messages rendered with markdown. |
| 4 | **HistoryScreen** | List of past chats from Room database. Swipe to delete. Tap to reopen. |
| 5 | **SettingsScreen** | Backend URL config, sign out button, overlay toggle, app version. |

### 5.3 SearchViewModel Pattern

Every ViewModel follows this exact pattern for streaming:

```kotlin
class SearchViewModel(
    private val apiClient: MorphicApiClient
) : ViewModel() {

    // UI state
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    fun submitQuery(query: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, answer = "") }

            try {
                val request = AssistQueryRequest(query = query)

                apiClient.streamQuery(request).collect { event ->
                    when (event.event) {
                        "status" -> {
                            val status = Json.decodeFromString<StatusEvent>(event.data)
                            _uiState.update { it.copy(statusMessage = status.message) }
                        }
                        "answer_chunk" -> {
                            val chunk = Json.decodeFromString<AnswerChunkEvent>(event.data)
                            _uiState.update { it.copy(answer = it.answer + chunk.text) }
                        }
                        "links" -> {
                            val links = Json.decodeFromString<LinksEvent>(event.data)
                            _uiState.update { it.copy(links = links.links) }
                        }
                        "images" -> {
                            val images = Json.decodeFromString<ImagesEvent>(event.data)
                            _uiState.update { it.copy(images = images.images) }
                        }
                        "done" -> {
                            _uiState.update { it.copy(isLoading = false) }
                        }
                        "error" -> {
                            val error = Json.decodeFromString<ErrorEvent>(event.data)
                            _uiState.update { it.copy(isLoading = false, error = error.message) }
                        }
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }
}

data class SearchUiState(
    val isLoading: Boolean = false,
    val statusMessage: String = "",
    val answer: String = "",
    val links: List<LinkItem> = emptyList(),
    val images: List<ImageItem> = emptyList(),
    val error: String? = null
)
```

---

## Step 6: Mode 2 — Floating Overlay Service

> [!WARNING]
> This is the most complex part of the entire app. Follow the instructions EXACTLY.

### 6.1 AndroidManifest.xml Permissions & Services

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application ...>
        <!-- Mode 1: Main Activity -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.Morphic">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Mode 2: Floating Overlay Service -->
        <service
            android:name=".services.overlay.MorphicOverlayService"
            android:foregroundServiceType="specialUse"
            android:exported="false">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="ambient_assistant_overlay" />
        </service>

        <!-- Keep-alive foreground service -->
        <service
            android:name=".services.MorphicForegroundService"
            android:foregroundServiceType="specialUse"
            android:exported="false">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="ambient_assistant_overlay" />
        </service>

        <!-- FileProvider for sharing images -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_provider_paths" />
        </provider>
    </application>
</manifest>
```

### 6.2 Overlay State Machine

**File: `services/overlay/OverlayStateManager.kt`**

```kotlin
/**
 * Manages the 3-state overlay lifecycle:
 *
 *   HIDDEN → PILL → DRAWER → HUD
 *     ↑       ↓       ↓       ↓
 *     └───────┴───────┴───────┘
 *            (collapse/dismiss)
 *
 * State A (PILL):    48dp floating circle, draggable, edge-snapping
 * State B (DRAWER):  Quick result capsule with action chips
 * State C (HUD):     Full floating window with chat/search/research
 */
enum class OverlayState {
    HIDDEN,     // Service running but no UI visible
    PILL,       // Minimal 48dp floating microphone button
    DRAWER,     // Quick assist drawer with answer + action chips
    HUD         // Full floating Morphic mini-window
}
```

### 6.3 Overlay Service Core

**File: `services/overlay/MorphicOverlayService.kt`**

The service MUST:
1. Create a persistent notification (required for foreground service)
2. Add overlay view via `WindowManager` with `TYPE_APPLICATION_OVERLAY`
3. Use `FLAG_NOT_FOCUSABLE` to avoid stealing focus from the active app
4. Use `ComposeView` inside the overlay to render Compose UI
5. Handle drag gestures for the pill
6. Transition between states A → B → C

```kotlin
/**
 * Key implementation rules:
 *
 * 1. The overlay MUST use WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
 * 2. The overlay MUST set FLAG_NOT_FOCUSABLE to avoid stealing input focus
 * 3. The overlay MUST check Settings.canDrawOverlays() before adding views
 * 4. Compose UI is rendered inside a ComposeView attached to the WindowManager
 * 5. The service runs as a foreground service with a persistent notification
 */
class MorphicOverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private var overlayView: ComposeView? = null
    private val stateManager = OverlayStateManager()

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        startForegroundWithNotification()
    }

    fun showPill() {
        if (!Settings.canDrawOverlays(this)) return

        val params = WindowManager.LayoutParams(
            dpToPx(48), dpToPx(48),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.END or Gravity.BOTTOM
            x = dpToPx(16)
            y = dpToPx(100)
        }

        overlayView = ComposeView(this).apply {
            setContent {
                MorphicTheme {
                    PillContent(
                        onTap = { expandToDrawer() },
                        onLongPress = { expandToHud() }
                    )
                }
            }
        }

        // Required for Compose in a Service
        overlayView?.let {
            it.setViewTreeLifecycleOwner(/* service lifecycle owner */)
            it.setViewTreeSavedStateRegistryOwner(/* saved state owner */)
            windowManager.addView(it, params)
        }
    }

    // ... expand/collapse methods, drag handling, etc.
}
```

> [!IMPORTANT]
> Using Compose inside a Service requires setting `ViewTreeLifecycleOwner` and `ViewTreeSavedStateRegistryOwner` on the `ComposeView`. The service must implement `LifecycleOwner`. This is a known Android pattern — search for "ComposeView in Service" if unclear.

---

## Step 7: Implementation Order (Build Sequence)

> [!CAUTION]
> Build in THIS order. Do NOT skip ahead. Each step depends on the previous one.

| Order | Task | Estimated Time | Test Criteria |
|:---:|---|---|---|
| **7.1** | Create project scaffold (Step 1) | 30 min | Project compiles, empty Compose activity shows on emulator |
| **7.2** | Add all dependencies (Step 1.3) | 15 min | `./gradlew assembleDebug` succeeds with no dependency errors |
| **7.3** | Build SSE parser (Step 2.2) | 30 min | Unit test: parse sample SSE text → correct event objects |
| **7.4** | Build API client (Step 2.3) | 45 min | Integration test: `streamQuery("hello")` → events flow from localhost:3000 |
| **7.5** | Build Supabase auth (Step 3) | 45 min | Can sign in, get JWT token, token works with API client |
| **7.6** | Build Room database (Step 4) | 30 min | Insert/query chats and messages works |
| **7.7** | Build Theme + Design system (Step 5.1) | 30 min | Dark theme renders correctly |
| **7.8** | Build LoginScreen + AuthViewModel | 45 min | Can sign in and navigate to SearchScreen |
| **7.9** | Build SearchScreen + SearchViewModel | 1.5 hr | Type query → see streaming answer + links + images |
| **7.10** | Build ChatScreen + multi-turn | 1.5 hr | Follow-up questions work, history persists in Room |
| **7.11** | Build HistoryScreen | 30 min | Past chats listed, tap to reopen |
| **7.12** | Build SettingsScreen | 30 min | Backend URL editable, sign out works |
| **7.13** | Build overlay permission flow | 30 min | App requests SYSTEM_ALERT_WINDOW, user grants it |
| **7.14** | Build MorphicOverlayService + Pill | 2 hr | 48dp pill appears over other apps, draggable |
| **7.15** | Build Drawer (State B) | 1.5 hr | Tap pill → drawer shows quick answer |
| **7.16** | Build HUD (State C) | 2 hr | Full floating window with search + chat |
| **7.17** | Polish + animations | 1 hr | Spring transitions, text streaming animation |

**Total estimated: ~14 hours of focused implementation**

---

## Backend API Contract Reference

### `POST /api/assist/query`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <supabase_jwt>
Accept: text/event-stream
```

**Request Body:**
```json
{
  "query": "What is quantum computing?",
  "mode": "ambient_companion",
  "options": {
    "includeLinks": true,
    "includeImages": true,
    "searchDepth": "basic",
    "maxResults": 5
  }
}
```

**Response:** SSE stream with events:
```
event: status
data: {"step":"searching","message":"Searching the web..."}

event: links
data: {"links":[{"title":"...","url":"...","domain":"...","favicon":"..."}]}

event: images
data: {"images":[{"id":"...","thumbnailUrl":"...","fullUrl":"...","title":"..."}]}

event: answer_chunk
data: {"text":"Quantum computing is "}

event: answer_chunk
data: {"text":"a type of computation..."}

event: done
data: {"sessionId":"abc123","totalDurationMs":4200}
```

### `GET /api/assist/images?q=<query>&count=<n>`

**Request Headers:**
```
Authorization: Bearer <supabase_jwt>
```

**Response:** JSON
```json
{
  "images": [
    {
      "id": "img_01",
      "thumb": "https://...",
      "thumbnailUrl": "https://...",
      "full": "https://...",
      "fullUrl": "https://...",
      "title": "...",
      "domain": "...",
      "sourceUrl": "..."
    }
  ]
}
```

---

## Testing Checklist

Before marking Phase 4 complete, ALL of these must pass:

- [ ] App compiles and runs on Android 11+ emulator (API 30)
- [ ] User can create a Supabase account from the app
- [ ] User can sign in and receive a valid JWT
- [ ] Search query streams answer text in real-time
- [ ] Source links display with correct titles and domains
- [ ] Images display in a horizontal scrollable grid
- [ ] Follow-up questions work (multi-turn chat)
- [ ] Chat history persists across app restarts (Room DB)
- [ ] History screen shows past chats sorted by recency
- [ ] Settings screen allows sign out
- [ ] Overlay permission is requested and handled gracefully
- [ ] 48dp pill appears over other apps when overlay is enabled
- [ ] Pill is draggable and snaps to screen edges
- [ ] Tapping pill expands to drawer with quick answer
- [ ] Drawer can expand to full HUD
- [ ] HUD supports full search and chat
- [ ] Back button collapses HUD → Drawer → Pill → Hidden (sequential)
- [ ] App handles network errors gracefully (shows toast/snackbar)
- [ ] App handles auth token expiry (prompts re-login)
