# Morphic Android: Complete Feature Catalog (`features.md`)

This document serves as the master feature inventory for **Morphic Android** ("Superior AI") — covering both **Mode 1 (Native Full-Screen Hub)** and **Mode 2 (Adaptive Ambient Voice Companion)**.

---

## 1. Feature Architecture Matrix

| Category | Feature Name | Mode | Tier | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Experience** | Full-Screen Research Hub | Mode 1 | Free & Pro | Deep multi-source research, canvas, research history, settings, and model switcher. |
| **Experience** | Full Floating Morphic HUD | Mode 2 | Free & Pro | Resizable floating window supporting full Morphic search, multi-turn chat, deep research, and sources over any app. |
| **Experience** | Adaptive Floating Voice Pill | Mode 2 | Free & Pro | Minimal square/pill mic interface auto-docked above the keyboard or floating on screen edges. |
| **Search & Chat**| In-Overlay Chat & Deep Research | Mode 2 | Free & Pro | Multi-turn conversational research, follow-up queries, sources list, and search engine right inside the floating view. |
| **Input** | Voice-First & Typing Inputs | Mode 2 | Free & Pro | Tap-and-speak mic input or optional compact keyboard input inside the floating HUD. |
| **Search** | Superior AI Search & Synthesis | Both | Free & Pro | Multi-engine web search (SearXNG/Tavily) with direct answer capsules and link extraction. |
| **Media** | High-Res Image Search & Fetch | Both | Free & Pro | Multi-provider image search (Web, Stock APIs) with background caching and format normalization. |
| **Media** | Rich Content IME Direct Insert | Mode 2 | Free & Pro | One-click image insertion directly into chat fields via Android `InputContentInfoCompat`. |
| **Media** | Multi-Window Drag-and-Drop | Mode 2 | Free & Pro | Touch-and-drag images directly into documents or split-screen apps. |
| **Editing** | In-Place Smart Text Injection | Mode 2 | Free & Pro | Atomic text insertion at cursor position via Android `AccessibilityNodeInfo`. |
| **Editing** | Selection-Aware Text Replace | Mode 2 | Free & Pro | Replaces only highlighted text or full drafts with rewritten/summarized variants. |
| **Editing** | Target-App Aware Formatting | Mode 2 | Free & Pro | Adapts formatting automatically (WhatsApp star-bold vs. Slack markdown vs. plain text). |
| **Ambient** | Proactive Auto-Sensing | Mode 2 | Free & Pro | Detects incomplete questions in input fields and offers 1-tap instant answer capsules. |
| **Clipboard** | Visual Clipboard & Quick Deck | Mode 2 | Free & Pro | Slide-out tray storing recent queries, extracted links, downloaded assets, and pinned prompts. |
| **Audio** | Bi-directional Voice Answers | Mode 2 | Free & Pro | Natural streaming TTS audio response back to the user while cards render on screen. |
| **Autonomous** | Screen Vision & Task Agent | Mode 2 | Pro | Reads screen state via `MediaProjection` and executes clicks/scrolls via `dispatchGesture()`. |
| **Security** | Dynamic Privacy Shield | Mode 2 | All | Auto-suppresses overlay on password fields (`FLAG_SECURE`, banking apps, OTP screens). |

---

## 2. Core Feature Specifications

### 2.1 Mode 1: Morphic Native Hub (Standalone App)
* **Deep Research Workflows**: Full iterative research loops with query breakdown, multi-step crawling, and consolidated reports.
* **Generative UI & Visual Canvas**: Interactive cards, tables, code blocks, and markdown diagrams rendered natively.
* **Unified History & Sync**: Shared chat and search history synced with local PostgreSQL/Docker backend.
* **Provider & Model Configurator**: Seamlessly switch between Google Gemini, OpenAI, Claude, or local Ollama models.
* **Ambient Companion Controller**: Toggle Mode 2 on/off, adjust floating pill sensitivity, handedness (left/right dock), and app inclusion/exclusion rules.

---

### 2.2 Mode 2: The Adaptive Floating Engine (3 Adaptive View States)

The Floating Engine operates across **3 adaptive view states**, allowing users to perform both ultra-fast 1-tap insertions AND complete interactive research/chat without leaving their current app:

```
┌──────────────────┐       Tap Mic       ┌────────────────────────┐      Expand Icon      ┌─────────────────────────────┐
│  STATE A: PILL   │ ──────────────────► │    STATE B: DRAWER     │ ────────────────────► │     STATE C: FLOATING HUD   │
│ (Minimal 48×48dp)│                     │ (Quick Action Capsule) │                       │ (Full Chat, Research & Web) │
└──────────────────┘ ◄────────────────── └────────────────────────┘ ◄──────────────────── └─────────────────────────────┘
                          Auto-Collapse                                 Minimize Window
```

#### State A: Minimalist Ambient Pill (`48dp × 48dp`)
* **Zero Visual Clutter**: Elegant, glowing microphone button docked unobtrusively 12dp above the soft keyboard or collapsed against the screen edge.
* **Instant Activation**: Single tap triggers real-time voice streaming with fluid audio waveform feedback.

#### State B: Quick Assist Drawer (Rapid Insertion Deck)
* **Targeted Synthesized Capsule**: Displays a 2-sentence direct answer.
* **One-Click Action Chips**:
  * `[ 📋 Insert Summary ]`: Injects synthesized answer directly into the active field.
  * `[ 🔗 Insert Links ]`: Injects clean, canonical source links with favicons.
  * `[ 🖼️ Insert Image ]`: Triggers rich media insertion protocol.
  * `[ ↗ Open Full HUD ]`: Transitions immediately to State C for deep work.

#### State C: Full Floating Morphic HUD / Mini-Window (Full Search, Research & Chat)
* **Complete Morphic Functionality Floating Over Any App**:
  * **Search & Deep Research Engine**: Run standard fast searches or toggle **Deep Research Mode** right inside the floating window. The engine performs multi-query web crawling, fetches live sources via SearXNG/Tavily, and compiles comprehensive reports while you stay in your active app.
  * **Interactive Multi-Turn Chat**: Ask follow-up questions, debate, brainstorm, or refine answers iteratively without switching out of WhatsApp, Slack, Twitter/X, or Docs.
  * **Sources & Citation Explorer**: Tap any source citation chip inside the floating window to view snippet previews, domain credibility, and raw URLs.
  * **Generative UI in Floating Mode**: Formatted markdown tables, syntax-highlighted code blocks, and comparison charts render in crisp, responsive floating cards.
  * **Universal Input Bridge**: Every chat message and research block inside the floating window features an instant **`[ ↳ Insert into App ]`** button, allowing users to extract individual paragraphs, bullet points, code blocks, or links directly into the underlying app's text field.
  * **Window Mechanics**:
    * Floating Picture-in-Picture (PiP) style with resizable handles.
    * Minimize to Pill, Pin/Float, or Fullscreen expansion into Mode 1 Hub.
    * Transparent backdrop slider to view the underlying app while reading Morphic reports.

---

### 2.3 Rich Media & Image Pipeline

#### A. Stock & Web Image Search
* Connects to SearXNG, Unsplash, Pexels, and web engines.
* When a user queries *"Find a high-res illustration of mitochondria"* or *"Show me cute cat reaction stickers"*, the overlay expands a horizontal preview strip of high-res image cards.

#### B. Parallel Caching & Format Normalization
* Downloads images in background memory/disk cache (`$CACHE_DIR/shared_images/`).
* Automatically converts unhandled formats (SVG, AVIF) to standard **PNG/JPEG** to ensure target apps accept the payload.

#### C. Multi-Channel Insertion Protocol
1. **Direct IME Rich Content (`InputContentInfoCompat`)**:
   * Uses Android's native content commitment API to inject images directly into WhatsApp, Telegram, Discord, and Google Messages without opening external pickers.
2. **FileProvider URI Clipboard**:
   * Exposes cached files via secure `content://com.morphic.app.fileprovider/...` with temporary read flags for apps like Slack, Gmail, and Notion.
3. **Physical Touch Drag-and-Drop**:
   * On foldable devices (Galaxy Z Fold, Pixel Fold) and tablets, users can press and drag any image card from the Morphic deck straight into split-screen documents.

---

### 2.4 Smart In-Place Editing & Transformation

#### A. Cursor Insertion vs. Selection Replacement
* **Normal Cursor**: Tapping `[ Insert ]` injects text at the current cursor point without disturbing existing drafts.
* **Highlighted Selection**: If the user selects a sentence or paragraph, Morphic's button dynamically changes to `[ Replace Selection ]`.

#### B. Contextual In-Place Transformation
* Users can highlight their draft and speak instructions:
  * *"Make this sound professional and polite"*
  * *"Translate this message to German"*
  * *"Condense this into 3 bullet points"*
* Morphic fetches the refined copy and applies an atomic replacement directly within the target application.

#### C. App-Aware Output Formatting
* **Chat Mode (WhatsApp / Telegram)**: Replaces complex markdown headers with single-line breaks, converts `**bold**` to `*bold*`, and formats links cleanly.
* **Workspace Mode (Slack / Notion / Docs)**: Preserves rich markdown, bullet hierarchies, and code blocks.
* **Browser Search Mode (Chrome / Brave)**: Converts outputs to concise plain text keywords.

---

### 2.5 Pro Tier: Vision & Device Control Agent

* **Screen Understanding**:
  * Ephemeral screen capture via Android `MediaProjection API` or raw Accessibility Node hierarchy parsing.
  * Understands what the user is looking at without requiring them to type or describe the screen.
* **Autonomous Task Completion (Minimal/Focused Actions)**:
  * User commands: *"Fill in today's date and submit this form"* or *"Find the unsubscribe button on this page"*.
  * Vision model calculates coordinate bounding boxes `(x, y)`.
  * Executes targeted clicks and smooth scrolls using `AccessibilityService.dispatchGesture()`.
* **Voice Confirmation & Safety Guardrail**:
  * Before performing final actions (e.g., clicking "Send", "Delete", or "Pay"), Morphic halts and asks via voice: *"I have filled the form. Should I tap Submit for you?"*

---

### 2.6 Privacy, Safety & Security Guardrails

* **Auto-Suppression on Sensitive Fields**: Automatically conceals the overlay whenever a field is marked with `TYPE_TEXT_VARIATION_PASSWORD`, `WEB_PASSWORD`, or `NUMBER_PASSWORD`.
* **Package Blocklist**: Financial apps, crypto wallets, and 2FA authenticators are permanently excluded.
* **FLAG_SECURE Compliance**: Honors Android's system-level screenshot protection; screen capture and node reading are blocked on secure screens.
* **Zero Permanent Storage of Ephemeral Queries**: Audio buffers and screen captures are evaluated ephemerally in RAM and wiped immediately after inference.
