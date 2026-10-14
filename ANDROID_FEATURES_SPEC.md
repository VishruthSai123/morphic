# Morphic Android: Features Specification & Product Architecture

This document defines the extended feature set, user workflows, data pipelines, and media-handling capabilities for the Morphic Android dual-mode client (Native Hub + Adaptive Ambient Voice Overlay).

---

## 1. Feature Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MORPHIC ANDROID CLIENT                         │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                     AMBIENT OVERLAY ENGINE                     │   │
│   │                                                                │   │
│   │  [ Voice Input ] ──► [ Intent Analyzer ] ──► [ Morphic Cloud ] │   │
│   │                                                     │          │   │
│   │  ┌───────────────────┬───────────────────┬──────────┴────────┐ │   │
│   │  │ Direct Insertion  │ Smart Replacement │ Rich Media / Img  │ │   │
│   │  │ (Links/Text/Summ) │ (Selected/Full)   │ (Download/Cache)  │ │   │
│   │  └─────────┬─────────┴─────────┬─────────┴──────────┬────────┘ │   │
│   │            ▼                   ▼                    ▼          │   │
│   │   Accessibility API     Clipboard/KeyEvents    FileProvider    │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    ▼                                   │
│            TARGET APP INPUT FIELD (WhatsApp, Gmail, Slack...)          │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 The Floating Experience: Pill, Drawer, and Full Morphic HUD
The ambient overlay is not merely a single-use microphone button; it seamlessly scales across three distinct interactive layers:
* **State A (Ambient Mic Pill):** Minimal `48dp` docked widget for instant speech recognition.
* **State B (Quick Assist Drawer):** Direct answer cards, link pills, stock media, and 1-tap `[Insert]` buttons.
* **State C (Full Floating Morphic HUD / Mini-Window):**
  * Resizable floating window running on top of any host application.
  * **Full Morphic Web Search & Deep Research**: Progressive multi-query web crawling with live source previews and citations.
  * **Interactive Multi-Turn Chat**: Continued conversational exchanges without losing context of the underlying app.
  * **Inline Input Bridge**: Individual paragraphs, bullet points, code blocks, or links can be injected directly into the underlying app via `[↳ Insert into App]`.

---

## 2. Rich Media & Image Pipeline

### 2.1 The Image Download & Cache Architecture
When a user asks: *"Find me diagrams of human heart anatomy"* or *"Show me latest iPhone 16 camera module"*:

1. **Morphic Search Engine**:
   - Queries SearXNG/Tavily image indices via `/api/assist/images`.
   - Returns structured metadata:
     ```json
     {
       "images": [
         {
           "id": "img_01",
           "thumbnailUrl": "https://...",
           "fullUrl": "https://...",
           "title": "Heart Blood Flow Diagram",
           "sourceDomain": "scientificamerican.com",
           "width": 1200,
           "height": 900,
           "mimeType": "image/webp"
         }
       ]
     }
     ```

2. **On-Device Background Fetching**:
   - The overlay downloads high-res images in parallel using **Coil** (Kotlin Image Loading) with memory and disk LRU caching (`$CACHE_DIR/morphic_images/`).
   - Format conversion: Automatically converts AVIF/SVG to standard PNG or JPEG when target apps do not support modern formats.

3. **Secure Local File Provider**:
   - Stores downloaded assets in `cacheDir/shared_images/`.
   - Exposes them via Android `FileProvider` (`content://com.morphic.app.fileprovider/shared_images/heart.png`) with temporary `FLAG_GRANT_READ_URI_PERMISSION`.

### 2.2 Image Insertion & Drag-and-Drop Mechanics
Android applications handle image inputs through two distinct pathways:

| Method | Target Applications | Android API Mechanism |
| :--- | :--- | :--- |
| **Direct Rich Input (IME Content)** | Gboard-compatible fields (WhatsApp, Telegram, Messages, Discord) | `InputContentInfoCompat` via `CommitContent` protocol. Exposes image content URI directly to the target app's editor. |
| **System Clipboard (Image URI)** | Gmail, Slack, Notion, Word, Google Docs | Write image `content://` URI to `ClipData.newUri(resolver, "image/png", uri)`. Trigger automated `ACTION_PASTE`. |
| **Physical Drag-and-Drop** | Split-screen, Foldables, Samsung DeX, Tablet multi-window | Compose `View.startDragAndDrop()` with `ClipDescription.MIMETYPE_TEXT_URILIST`. Users can touch and drag an image directly into rich editor views. |

---

## 3. Text Insertion & Replacement Intelligence

Users don't just want to insert new text; they frequently need to **edit, summarize, or replace** existing drafts.

### 3.1 Insertion vs. Replacement Modes

```
User Action on Overlay Chips:
├── [ Insert ]      ──► Appends generated text at current cursor position
├── [ Replace ]     ──► Replaces active selection OR replaces entire field draft
├── [ Copy Links ]  ──► Copies formatted clean URLs to clipboard without modifying input
└── [ Transform ]   ──► Reads existing text, rewrites/refines it, and replaces field
```

### 3.2 Technical Replacement Workflow

1. **Active Selection Check**:
   - The `AccessibilityService` queries `AccessibilityNodeInfo.getTextSelectionStart()` and `getTextSelectionEnd()`.
   - If `selectionStart != selectionEnd`, Morphic replaces **only the highlighted text**.
2. **Contextual Rewrite ("Make this formal" / "Fix grammar")**:
   - The overlay reads the node's existing content (`node.text.toString()`).
   - Sends: `{ text: node.text, instruction: "Fix grammar & make punchy" }` to Morphic API.
   - Replaces content in one atomic Accessibility update:
     ```kotlin
     val bundle = Bundle().apply {
         putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, rewrittenText)
     }
     node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, bundle)
     ```
3. **Format Adaptation by App Category**:
   - **Chat Apps (WhatsApp, Telegram)**: Strips complex Markdown headers (`#`), converts bold to `*text*` and bullet lists to `• item`.
   - **Productivity Apps (Notion, Google Docs, Slack)**: Retains standard Markdown or rich HTML formatted output.
   - **Browser Search Bars (Chrome, Brave)**: Inserts clean plain text without formatting or conversational filler.

---

## 4. Ambient Assistant: Next-Level User Features

### 4.1 Proactive Contextual Search ("Auto-Sensing")
* Instead of waiting for voice instructions, when the user pauses typing after entering a question (e.g., *"What is the boiling point of ethanol at..."*), Morphic's pill displays a subtle pulse.
* Tapping the pulse displays the instant answer chip: `[ 78.37 °C — Insert ]`.

### 4.2 Multi-Citation Link Drawer
* For research inquiries (e.g., *"Find latest benchmarks comparing M4 Max vs RTX 4090"*):
* The overlay renders:
  1. **Quick Answer Capsule** (2-sentence direct answer).
  2. **Link Badges**: Mini pills showing favicon, domain name, and publication date.
  3. **Batch Insert Button**: Injects citations as footnote-style clean markdown `[1](url), [2](url)` or hyperlinked text.

### 4.3 Voice Response & Bi-directional Audio
* **Continuous Streaming Feedback**: Uses lightweight streaming Text-to-Speech (TTS) via Android's local engine or WebSocket audio stream.
* Example: User speaks *"Find me a good Mexican restaurant near Indiranagar"*.
  * Overlay displays 3 venue cards with Google Maps links and phone numbers.
  * Voice replies concurrently: *"Found three top-rated spots nearby. The first two are open now."*
  * User can simply say *"Insert the second one"* or tap `[ Insert ]`.

### 4.4 Quick Actions Clipboard Deck
* A persistent sliding tray attached to the floating overlay:
  * **Recent Queries**: 1-tap re-use of search results generated earlier.
  * **Pinned Prompts**: Custom quick templates (e.g., `"Summarize this"`, `"Generate meeting follow-up"`, `"Translate to Japanese"`).
  * **Image History**: Recent media fetched in the current session.

---

## 5. Pro Tier: Vision & Screen Automation Specification

| Capability | Technical Mechanism | Safety & Privacy Guardrail |
| :--- | :--- | :--- |
| **Screen Reading ("Explain this error")** | `MediaProjection` single screenshot or Accessibility Node Hierarchy dump | Screenshots are processed ephemerally in RAM; never stored on disk or used for training. |
| **Guided Click / Fill** | Calculate target element bounding box (`Rect`) $\rightarrow$ `AccessibilityService.dispatchGesture()` | Restricted to non-financial, non-system settings apps. Explicit confirmation required before tapping "Submit" or "Send". |
| **Voice-Directed Scrolling** | User says *"Scroll down"* or *"Next page"* $\rightarrow$ Accessibility `ACTION_SCROLL_FORWARD` | Operates at the OS window manager level with smooth animated fling gestures. |

---

## 6. Target App Compatibility Matrix

| Target Application | Direct Text (`SET_TEXT`) | Selection Replace | Image Direct Insert | Fallback Pathway |
| :--- | :---: | :---: | :---: | :--- |
| **WhatsApp / Telegram** | ✅ Supported | ✅ Supported | ✅ Supported (`InputContentInfo`) | Clipboard Paste |
| **Gmail / Outlook** | ✅ Supported | ✅ Supported | ✅ Supported (`ClipData URI`) | Intent Send / Share |
| **Slack / Teams** | ✅ Supported | ✅ Supported | ✅ Supported | System Clipboard |
| **Google Docs / Notion** | ⚠️ Partial (Custom WebView) | ⚠️ Partial | ✅ Supported (Drag/Drop) | `ACTION_PASTE` via Clipboard |
| **Chrome / Firefox Address Bar** | ✅ Supported | ✅ Supported | ❌ Not applicable | Direct `SET_TEXT` |
| **Banking / Auth Apps** | ⛔ Blocked by design | ⛔ Blocked | ⛔ Blocked | Overlay auto-dismisses |
