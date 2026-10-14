# Libraries.dev Integration Blueprint: Overlay & Morphic UI Polish

This document details the analysis of **[Libraries.dev](https://libraries.dev)** (by Jakub Antalik) and outlines how to utilize its lightweight, high-craft React & canvas UI effect packages across **Mode 2 (The Android Floating Overlay)** and **Mode 1 (The Morphic Main Web/Desktop UI)**.

---

## 1. Libraries.dev Component Inventory & Capabilities

Libraries.dev provides standalone, zero-dependency/lightweight effect primitives designed specifically for AI agent interfaces and modern tactile software:

| Package | npm Command | Core Aesthetic & Functionality | Best Use-Case in Morphic |
| :--- | :--- | :--- | :--- |
| **`voice-glow`** | `npm i voice-glow` | Decibel-reactive luminous glow that rises and breathes in sync with mic amplitude. | Floating Mic Pill & Web Chat Input voice dictation. |
| **`thinking-orbs`**| `npm i thinking-orbs` | Dotted, neural status indicators with hand-tuned states (`listening`, `searching`, `working`, `synthesizing`). | Live research milestones in Floating HUD & Deep Research sections. |
| **`border-beam`**  | `npm i border-beam` | Traveling perimeter laser/soft beam along card or window borders. | Floating HUD window during active streaming & web chat input focus. |
| **`liquid-gooey`** | `npm i liquid-gooey` | Organic fluid physics that merge and morph like mercury while preserving sharp text. | Edge-docking magnetic snap & Pill-to-Drawer expansion. |
| **`metal-fx`**     | `npm i metal-fx` | Refractive brushed/liquid metallic surfaces with interactive specular highlights. | Floating HUD window header, drag handles & Deep Research badges. |
| **`img-fx`**       | `npm i img-fx` | WebGL pixel mosaic dissolver that fluidly resolves into high-res photography. | SearXNG/Stock image search card reveal animations. |
| **`bot-avatars`**  | `npm i bot-avatars` | Glossy, expressive animated avatar faces reacting to agent status. | Floating HUD status badge & assistant profile header. |

---

## 2. Component Placement & UI Architecture in the Overlay (Mode 2)

```
┌────────────────────────────────────────────────────────────────────────┐
│               OVERLAY STATE C: FULL FLOATING MORPHIC HUD               │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ☰ [metal-fx] Header & Drag Grip       [thinking-orbs] Status ✕  │  │
│  │ ⚡ Fast Search | 🔬 Deep Research Mode                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│   ▲                                                                    │
│   │ [border-beam] Active perimeter glow during research streaming     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [bot-avatars] Assistant:                                         │  │
│  │ "I analyzed 5 sources on solid-state battery tech..."            │  │
│  │                                                                  │  │
│  │ ┌──────────────────────┐  ┌──────────────────────┐               │  │
│  │ │ [img-fx] Source Img 1│  │ [img-fx] Source Img 2│               │  │
│  │ └──────────────────────┘  └──────────────────────┘               │  │
│  │                                                                  │  │
│  │ [ ↳ Insert Paragraph into Host App ]  [ ✂ Replace Selection ]    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [voice-glow] Audio Reaction Waveform                             │  │
│  │ 🎙️ Speak or type follow-up...                    [metal-fx] Send │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 State A: Compact Ambient Pill (`48dp × 48dp`)
* **Base Texture (`metal-fx`)**: The floating pill is styled with a brushed dark titanium or liquid chrome finish (`#18181B` base with realistic specular edge light), making it visually distinct from any host app's background.
* **Magnetic Snapping (`liquid-gooey`)**: When dragged near screen edges, the pill stretches fluidly toward the bezel like a liquid droplet before snapping into place.
* **Active Voice Listening (`voice-glow`)**: When the user taps to speak, the pill expands into `48dp × 140dp` with a reactive `voice-glow` aura pulsing according to speech volume.

### 2.2 State B: Quick Assist Drawer (Above Keyboard)
* **Active Action Glow (`border-beam`)**: The primary action chip (`[ 📋 Insert Summary ]`) is wrapped with a subtle `border-beam` to draw immediate focus without demanding conscious cognitive load.
* **Instant Media Reveal (`img-fx`)**: When searching for images, incoming thumbnails don't pop in abruptly—they dissolve from an artistic pixel mosaic into the sharp thumbnail.

### 2.3 State C: Full Floating Morphic HUD / Window
* **Window Perimeter (`border-beam`)**: During multi-step deep research, a continuous soft beam traces the window's rounded rectangular border, providing non-intrusive feedback that background workers are actively crawling sources.
* **Status Header (`thinking-orbs`)**: Placed in the top-right of the HUD. Dynamically shifts states:
  * `state="listening"` when voice dictation is active.
  * `state="searching"` when query is dispatched to SearXNG/Tavily.
  * `state="working"` while parsing DOM trees.
  * `state="synthesizing"` when LLM tokens are streaming.
* **Top Header & Drag Handles (`metal-fx`)**: Tactile window drag bar and mode toggle pills (`[ Fast | Deep Research ]`) styled with liquid metallic sheen.

---

## 3. Minimal Modifications to Morphic Main Web UI (Mode 1)

Integrating Libraries.dev into Morphic's current web frontend requires **zero structural rewrites**. The modifications are targeted drop-in enhancements to 4 existing components:

### 3.1 Chat Input Panel (`components/chat-panel.tsx`)
* **Active Focus & Processing Beam (`border-beam`)**:
  * Wrap the main prompt textarea container (`div.relative.flex.w-full...`) with `<BorderBeam size={80} duration={8} colorFrom="#38bdf8" colorTo="#818cf8" />`.
  * Trigger: Activates when input is focused, or while AI generation status is `'streaming'`.
* **Voice Dictation Glow (`voice-glow`)**:
  * Add `<VoiceGlow />` anchored beneath the textarea. When speech-to-text is toggled, it casts a glowing violet/cyan ambient light upward across the input deck that scales with microphone input.

### 3.2 AI Reasoning & Research Section (`components/research-process-section.tsx`)
* **Neural Status Orbs (`thinking-orbs`)**:
  * Replace the static spinner / pulsing dots next to *"Researching..."* or *"Reading sources..."* with `<ThinkingOrbs state={currentStepState} size="sm" />`.
  * Automatically maps Morphic's research stages to orb animations:
    * `tool="search"` $\rightarrow$ `state="searching"`
    * `tool="fetch"` $\rightarrow$ `state="reading"`
    * `tool="synthesize"` $\rightarrow$ `state="working"`

### 3.3 Image Search Results Grid (`components/search-results-image.tsx`)
* **Mosaic Loader (`img-fx`)**:
  * Replace default skeleton pulse with `<ImgFx src={imageUrl} alt={title} mosaicSize={16} />`.
  * As images resolve from Tavily or SearXNG, they transition through a high-tech pixel-dissolve effect, completely eliminating jarring blank-to-image layout shifts.

### 3.4 Mode & Model Selectors (`components/search-mode-selector.tsx`)
* **Tactile Pill Reflection (`metal-fx`)**:
  * Wrap the **"Deep Research" / "Adaptive"** toggle pill with `<MetalFx texture="brushed-titanium" />`.
  * Gives the Pro/Deep research options an ultra-premium, tactile visual identity.

---

## 4. Implementation Code Snippets for Morphic

### A. Installing Libraries.dev Packages
```bash
bun add border-beam thinking-orbs voice-glow img-fx metal-fx liquid-gooey
```

### B. Minimal Edit to `chat-panel.tsx`:
```tsx
import { BorderBeam } from 'border-beam'
import { VoiceGlow } from 'voice-glow'

// Inside ChatPanel JSX, wrapping the prompt box:
<div className="relative rounded-2xl border bg-background shadow-sm overflow-hidden">
  {isGenerating && (
    <BorderBeam 
      size={100} 
      duration={6} 
      colorFrom="#06b6d4" 
      colorTo="#a855f7" 
    />
  )}
  <Textarea ... />
  {isVoiceActive && <VoiceGlow isRecording={isVoiceActive} />}
</div>
```

### C. Minimal Edit to `research-process-section.tsx`:
```tsx
import { ThinkingOrbs } from 'thinking-orbs'

// Inside step item header:
<div className="flex items-center gap-2">
  <ThinkingOrbs 
    state={status === 'in_progress' ? 'searching' : 'done'} 
    size="sm" 
  />
  <span className="text-sm font-medium">{step.title}</span>
</div>
```

---

## 5. Visual Hierarchy & Performance Guardrails

1. **Hardware Acceleration**:
   * Libraries.dev components use CSS transforms and WebGL shaders offloaded directly to the GPU.
   * On mobile devices (Android WebView and Compose), ensure `hardwareAccelerated="true"` is enabled in `AndroidManifest.xml` so effects maintain 60–120 FPS without CPU overhead.
2. **Reduced Motion Compliance**:
   * Honor `prefers-reduced-motion`: When users have system animations disabled, `border-beam` smoothly pauses into a static gradient border, and `voice-glow` scales statically without strobing.
3. **Contrast & Theming**:
   * All effects dynamically match Morphic's dark/light modes (`hsl(var(--background))` and `hsl(var(--primary))`).
