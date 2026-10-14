# Product Requirements Document (PRD): Morphic Superior AI for Android

**Product Name:** Morphic Superior AI (Android Edition)  
**Version:** 1.0.0 (Production Architecture)  
**Document Type:** Master Product Requirements Document & Technical Blueprint (`superior.md`)  
**Target Platform:** Android 11.0+ (API Level 30 – 35)

---

## 1. Executive Summary & Product Vision

### 1.1 The Problem
Smartphones are inherently siloed. When users type messages, craft emails, or write documents, accessing external knowledge or media requires context-switching: leaving the active application, launching a browser or AI chat app, prompting, copying results, returning to the original app, and pasting. This breaks focus, introduces friction, and creates mobile productivity fatigue.

### 1.2 The "Superior" Vision
**Morphic Superior AI** reimagines mobile AI by creating a unified dual-mode experience where the full power of Morphic is available everywhere:
1. **Mode 1 (The Native Research Hub):** A full-featured standalone application for in-depth iterative research, synthesized reports, model management, and visual canvas interaction.
2. **Mode 2 (The Adaptive Floating Morphic Engine & Ambient Companion):** 
   - A versatile floating layer accessible on top of any Android application.
   - **Full Floating Morphic Capabilities**: Conduct comprehensive web searches, multi-turn conversational chats, explore live sources via SearXNG/Tavily, and execute full multi-step **Deep Research** without leaving the host app.
   - **Zero-Friction Ambient Bridges**: Minimal voice-first mic pill auto-docked above the keyboard for instant answers, 1-click text injection, selection replacement, stock/web image insertion, and drag-and-drop.
3. **Pro Autonomous Vision Agent:** An optional screen-aware assistant capable of reading display state, executing minimal UI gestures (clicks, scrolls), and speaking back with voice.

---

## 2. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ANDROID OS RUNTIME                              │
│                                                                             │
│  ┌────────────────────────┐         ┌────────────────────────────────────┐  │
│  │  MODE 1: NATIVE HUB    │         │      MODE 2: FLOATING ENGINE       │  │
│  │  (Jetpack Compose UI)  │◄────────┤      (Floating WindowManager)      │  │
│  ├────────────────────────┤ DeepLink├────────────────────────────────────┤  │
│  │ • Deep Research Canvas │ Hand-off│ [State A] Minimalist Mic Pill      │  │
│  │ • Chat & Session Sync  │         │ [State B] Quick Assist Drawer      │  │
│  │ • Model Config & Keys  │         │ [State C] Full Floating Morphic HUD│  │
│  │ • Unified Workspace    │         │   ├── Full Web Search & Crawling   │  │
│  └───────────┬────────────┘         │   ├── Interactive Multi-Turn Chat  │  │
│              │                      │   ├── Deep Research Mode & Sources │  │
│              │                      │   ├── Generative UI & Code Blocks  │  │
│              │                      │   └── ↳ Universal Input Injection  │  │
│              │                      └──────────────────┬─────────────────┘  │
│              ▼                                         ▼                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │              BACKGROUND ENGINE & SYSTEM BRIDGE SERVICES               │  │
│  │                                                                       │  │
│  │  ┌───────────────────────┐ ┌───────────────────┐ ┌──────────────────┐ │  │
│  │  │ Accessibility Service │ │ Foreground Daemon │ │ Image Provider   │ │  │
│  │  │ (Node Read & Inject)  │ │ (Lifecycle Keep)  │ │ (Cache & Sharing)│ │  │
│  │  └───────────────────────┘ └───────────────────┘ └──────────────────┘ │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ HTTPS / WSS
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MORPHIC BACKEND (Docker / Cloud)                       │
│                                                                             │
│   Next.js 16 API Routes  •  SearXNG Search  •  Redis  •  PostgreSQL 17      │
│   AI Providers: Google Gemini (Primary) / OpenAI / Anthropic / Ollama       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. End-to-End User Journeys & Workflows

### Journey 0: Full Floating Search, Multi-Turn Chat & Deep Research (Over Any App)
```
[User working in Google Docs, Notion, or studying a PDF in Chrome]
       │
       ▼
1. User taps or pulls down the Morphic Pill:
   └── Expands into the resizable Floating Morphic HUD Window over the active app.
       │
       ▼
2. User types or speaks query: "Deep research on solid-state battery commercialization 2026".
   ├── Toggles [⚡ Quick Search] vs [🔬 Deep Research].
   └── Engine starts multi-query iterative crawling via SearXNG/Tavily.
       │
       ▼
3. Floating HUD renders:
   ├── Live multi-step research progress indicator.
   ├── Interactive citation chips with domain favicons and article previews.
   └── Comprehensive synthesized report with tables and bullet takeaways.
       │
       ▼
4. Multi-Turn Interactive Conversation:
   ├── User follows up: "How does QuantumScape compare with CATL in this report?"
   └── Morphic streams real-time comparative analysis inside the floating chat.
       │
       ▼
5. Universal Input Bridge (Selective Insertion):
   ├── User highlights a specific comparison table or summary paragraph.
   └── Taps [↳ Insert into Doc] ──► Automatically pasted into the active Google Doc below!
       │
       ▼
6. User taps [Minimize] (shrinks back to floating pill) or [Maximize] (opens in Mode 1 Hub).
```

---

### Journey 1: Ambient Link & Answer Injection (e.g., in WhatsApp)
```
[User typing in WhatsApp]
       │
       ▼
1. Keyboard opens ──► Morphic Mic Pill smoothly glides 12dp above keyboard.
       │
       ▼
2. User taps Mic and speaks: "Find the price and specs of Samsung S25 Ultra".
       │
       ▼
3. Voice Waveform visualizes speech ──► Query streamed to Morphic API.
       │
       ▼
4. Results Drawer expands above keyboard showing:
   ├── Answer Capsule: "Samsung S25 Ultra starts at $1,299 with Snapdragon 8 Elite..."
   └── Link Chips: [samsung.com] [gsmarena.com]
       │
       ▼
5. User taps [Insert Capsule & Links]:
   └── Morphic Accessibility Bridge injects formatted text directly into WhatsApp.
       │
       ▼
6. Overlay automatically collapses to minimal pill without dismissing keyboard.
```

---

### Journey 2: Rich Stock/Web Image Query & Insertion
```
[User composing an email in Gmail or drafting in Telegram]
       │
       ▼
1. User taps Mic: "Find diagram of plant cell structure".
       │
       ▼
2. Morphic queries image API ──► Downloads top 3 candidates into disk cache.
       │
       ▼
3. Horizontal Image Strip displays thumbnail cards with resolution badges.
       │
       ▼
4. User taps on thumbnail card:
   ├── For Telegram/WhatsApp: Injects via InputContentInfoCompat (IME Protocol).
   └── For Gmail/Slack: Copies FileProvider URI to ClipData and triggers ACTION_PASTE.
```

---

### Journey 3: In-Place Text Refinement & Replacement
```
[User writes a rough draft in Slack: "hey need update on backend asap"]
       │
       ▼
1. User highlights the sentence with finger.
       │
       ▼
2. Morphic detects active selection (selectionStart != selectionEnd).
       │
       ▼
3. Pill changes action to [Refine]. User speaks: "Make this polite and formal".
       │
       ▼
4. Morphic sends draft + instruction to AI.
       │
       ▼
5. Atomic Accessibility Update: Replaces highlighted text with:
   "Hi team, could you please share a quick update on the backend progress when possible?"
```

---

### Journey 4: Screen Vision & Autonomous Device Control (Pro Tier)
```
[User on a long web form or app page]
       │
       ▼
1. User holds Morphic Pill for 1.5s (triggers Vision Mode).
       │
       ▼
2. User speaks: "Scroll down and find the tracking number".
       │
       ▼
3. Morphic captures screen frame via MediaProjection API.
       │
       ▼
4. Vision model parses screen layout, detects target element at (x=540, y=1420).
       │
       ▼
5. Executes smooth fling gesture via dispatchGesture().
       │
       ▼
6. Voice Feedback speaks back: "Your tracking number is FedEX-948271. I've copied it."
```

---

## 4. App Redirection & Deep-Linking Engine

Morphic ensures users can transition frictionlessly between the ambient overlay and the full application.

### 4.1 "Open in Hub" Seamless Hand-Off
Every search result in the floating drawer features an **"Expand to Hub"** icon ($\nearrow$).
* When tapped:
  1. The overlay captures the current session token (`session_id`).
  2. Dispatches an Intent with deep-link URI:
     `morphic://hub/research?session_id=sess_928174&query=Samsung+S25`
  3. Launches the main Morphic app directly into the full multi-source canvas view without losing state.
  4. The floating overlay automatically collapses and hides itself to prevent visual clutter.

### 4.2 System Deep-Link Routing Map
| URI Scheme | Destination Screen | Parameters |
| :--- | :--- | :--- |
| `morphic://hub/home` | Main Home & Search Screen | None |
| `morphic://hub/research` | Full Research Canvas | `session_id`, `q` |
| `morphic://hub/history` | Research Archive | None |
| `morphic://hub/settings` | Companion Settings | `anchor`, `sensitivity`, `whitelist` |
| `morphic://hub/pro` | Subscription & Tier Manager | `feature=vision` |

---

## 5. Persistence & OS Lifecycle ("How the App Stays")

Android aggressively terminates background tasks unless strictly architected to meet system foreground criteria.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PERSISTENCE ARCHITECTURE                        │
│                                                                        │
│   ┌──────────────────────────┐        ┌────────────────────────────┐   │
│   │   STICKY FOREGROUND      │        │    ACCESSIBILITY SERVICE   │   │
│   │   DAEMON SERVICE         │        │    (OS-Level Bound Engine) │   │
│   ├──────────────────────────┤        ├────────────────────────────┤   │
│   │ • Notification channel   │◄──────►│ • BIND_ACCESSIBILITY_PERM  │   │
│   │ • START_STICKY policy    │        │ • Auto-reconnect on crash  │   │
│   │ • Watchdog heartbeat     │        │ • Low-memory priority      │   │
│   └─────────────┬────────────┘        └─────────────┬──────────────┘   │
│                 │                                   │                  │
│                 ▼                                   ▼                  │
│   ┌──────────────────────────┐        ┌────────────────────────────┐   │
│   │   BOOT / UNLOCK RECEIVER │        │   OEM BATTERY WHITELIST    │   │
│   │   (RECEIVE_BOOT_COMPLETED│        │   (ACTION_REQUEST_IGNORE_  │   │
│   │    ACTION_USER_PRESENT)  │        │    BATTERY_OPTIMIZATIONS)  │   │
│   └──────────────────────────┘        └────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 The Two-Engine Reliability Model
1. **The Accessibility Core (`AccessibilityService`)**:
   - Because `AccessibilityService` is an OS-bound system accessibility engine, Android grants it elevated process priority (low OOM adjustment score).
   - The OS automatically restarts the service if it is killed under extreme RAM pressure.
2. **The Companion Foreground Service**:
   - Runs with `startForeground()` under Android 14's `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`.
   - Displays a low-priority persistent silent notification in the system drawer:
     *Title: "Morphic Assistant Active"*  
     *Subtitle: "Tap to configure or pause overlay"*

### 5.2 Boot & Unlock Survival
* **`BOOT_COMPLETED`**: Initializes background hooks upon device startup.
* **`USER_PRESENT`**: Re-verifies overlay state whenever the device is unlocked.
* **OEM Battery Shield**: Guides users during onboarding to exclude Morphic from aggressive OEM killers (Xiaomi HyperOS, Samsung OneUI, OnePlus OxygenOS).

---

## 6. Interface & UI/UX Specifications

### 6.1 Mode 2 Floating Mic Pill Specs
* **Resting Dimensions:** `48dp × 48dp` (Compact Circle or Rounded Square, Corner Radius `16dp`).
* **Active Dimensions:** `48dp × 140dp` (Stretches smoothly to reveal audio visualizer waveform).
* **Elevation & Shadow:** `8dp` shadow elevation; glassmorphic translucent acrylic background (`#1A1A1A` with 85% opacity and dynamic blur).
* **Color Accents:**
  - Idle: Subtle pearl white mic icon.
  - Listening: Neon teal/violet gradient pulsing ring.
  - Processing: Smooth rotating shimmer border.
* **Haptics:**
  - Tap Mic: Subtle click (`HapticFeedbackConstants.CLOCK_TICK`).
  - Search Complete: Light bump (`HapticFeedbackConstants.CONFIRM`).
  - Drag into Dismiss Zone: Heavy snap (`VibrationEffect.EFFECT_HEAVY_CLICK`).

### 6.2 Expanded Results Tray Specs
* **Maximum Height:** `220dp` (Strictly budgeted so it never obscures the active typing field).
* **Horizontal Action Chips:**
  - `[ 📋 Insert Text ]` — Accent background (`#2563EB`), bold label.
  - `[ 🔗 Insert Links ]` — Ghost border, domain favicon badges.
  - `[ 🖼️ Images (3) ]` — Badge counter opening image carousel.
  - `[ ↗ Full HUD ]` — Expands immediately into the resizable Floating Morphic Window.

### 6.3 Mode 2 Full Floating Morphic HUD / Mini-Window Specs
* **Window Geometry:**
  - Default Size: `340dp (width) × 480dp (height)`.
  - Resizable: Diagonal corner grip allows dragging to adjust dimensions from `280dp × 360dp` up to `90% screen bounds`.
  - Windowing Mode: Runs as a non-modal `TYPE_APPLICATION_OVERLAY` window with independent touch dispatch.
* **Top Navigation & Window Bar:**
  - **Drag Anchor & Handle**: Center pill handle allowing effortless repositioning anywhere on screen.
  - **Engine Mode Selector**: Pill toggle `[ ⚡ Fast Search | 🔬 Deep Research | 💬 Chat ]`.
  - **Opacity Slider**: Adjustable backdrop transparency (60% to 100%) so users can inspect underlying documents while reading Morphic results.
  - **Window Controls**:
    - `[ − ] Minimize`: Collapses smoothly back to the resting `48dp × 48dp` mic pill.
    - `[ ⤢ ] Maximize`: Dispatches deep link `morphic://hub/research?session_id=...` to transfer session to the full-screen Native Hub.
    - `[ ✕ ] Dismiss`: Unmounts overlay window.
* **Scrollable Content Body:**
  - **Live Step Visualizer**: Displays ongoing research milestones in real-time (*"Querying 3 engines..."*, *"Analyzing 5 web sources..."*, *"Extracting citations..."*).
  - **Interactive Citation Carousel**: Tap any source chip to preview article snippets and verified domains without leaving the overlay.
  - **Generative UI Rendering**: Markdown tables, code snippets with syntax highlighting, and collapsible research sections.
  - **Selective Injection Hooks**: Every generated message or subsection features an inline **`[ ↳ Insert into Host App ]`** button, injecting that specific paragraph or bullet list into whatever app is open in the background (WhatsApp, Slack, Docs, etc.).
* **Bottom Input Deck:**
  - **Dual Input Modes**: Prominent Voice Mic button for instant speech input, plus a compact text field with auto-complete for quiet environments.
  - **Model Selector Capsule**: Quick pill displaying the current active model (`Gemini 2.5 Flash ▼`, `Claude 3.5 Sonnet ▼`).

---

## 7. Technical Specifications & API Contracts

### 7.1 Mobile Network & Origin Topology
* **Local Emulator Dev:** Android Emulator reaches host machine via `http://10.0.2.2:3000`.
* **Physical Device Local LAN Dev:** Uses host Wi-Fi IP (e.g. `http://192.168.1.50:3000`).
* **Production Cloud:** HTTPS endpoint (e.g. `https://api.morphic.sh` or Vercel/Fly.io deployment).

### 7.2 Morphic Mobile Assistant Endpoint (`/api/assist/query`)

#### Request Headers:
```http
POST /api/assist/query HTTP/1.1
Host: api.morphic.sh
Content-Type: application/json
Accept: text/event-stream
Authorization: Bearer <SUPABASE_JWT_TOKEN>      # Required in Production Cloud mode
X-Morphic-Anonymous-Id: docker-anonymous        # Used in Self-Hosted Docker mode
Access-Control-Allow-Origin: *
```

#### Request Payload:
```json
{
  "query": "What are the key specs of Nothing Phone 3?",
  "mode": "ambient_companion",
  "targetContext": {
    "packageName": "com.whatsapp",
    "selectedText": null,
    "inputFieldText": "Hey check out this new phone: "
  },
  "options": {
    "includeLinks": true,
    "includeImages": true,
    "maxResults": 3
  }
}
```

#### Streaming Response (Server-Sent Events / SSE):
```
event: answer_chunk
data: {"text": "Nothing Phone 3 features Snapdragon 8s Gen 3, a 6.7\" 120Hz OLED, and 50MP triple cameras."}

event: links
data: {"links": [{"title": "Nothing Tech", "url": "https://nothing.tech", "domain": "nothing.tech"}]}

event: images
data: {"images": [{"id": "img_1", "thumb": "https://...thumb.jpg", "full": "https://...full.png"}]}

event: done
data: {"sessionId": "sess_98214"}
```

---

## 8. Tiering & Monetization Structure

| Feature | Free Tier | Pro Tier ($9.99/mo) |
| :--- | :---: | :---: |
| **Mode 1: Native Research Hub** | Standard Web Search | Deep Iterative Multi-step Research |
| **Mode 2: Ambient Voice Overlay** | Unlimited Voice Searches | Unlimited Voice Searches |
| **Text Insertion & Replacement** | Unlimited | Unlimited |
| **Image Search & IME Insert** | 15 / day | Unlimited High-Res |
| **Screen Vision & Device Control** | ❌ Not included | ✅ 100 Autonomous Actions / mo |
| **Model Selection** | Gemini 2.5 Flash / Default | Gemini Pro, Claude 3.5 Sonnet, GPT-4o |
| **Custom Prompts & Pinning** | Up to 3 shortcuts | Unlimited Shortcut Deck |

---

## 9. Google Play Store Compliance & Policy Blueprint

To prevent rejection during Google Play App Review:
1. **Accessibility Declaration (`BIND_ACCESSIBILITY_SERVICE`)**:
   - Google requires a prominent in-app disclosure modal **before** prompting for accessibility settings.
   - Disclosure text: *"Morphic uses the Accessibility Service solely to detect when you type in text fields and insert your requested research answers directly into your chosen app. Morphic never records passwords, keystrokes, or personal messages."*
   - Submit a mandatory video demonstration in Google Play Console showing the voice-to-insertion flow.
2. **Overlay Permission (`SYSTEM_ALERT_WINDOW`)**:
   - Provide a 1-tap onboarding screen leading directly to `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`.
3. **Data Safety Section**:
   - Declare audio processing as ephemeral; no voice recordings are retained on external servers.
