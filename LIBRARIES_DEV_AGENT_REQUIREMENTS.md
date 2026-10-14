# Agent Requirements: Libraries.dev UI Implementation Guidelines

> **CRITICAL DIRECTIVE FOR AI AGENTS (Cursor, Claude Code, Antigravity, Copilot):**  
> This file establishes mandatory rules, technical constraints, and design standards when implementing or modifying UI components using **Libraries.dev** (`border-beam`, `thinking-orbs`, `voice-glow`, `liquid-gooey`, `metal-fx`, `img-fx`, `bot-avatars`) across Morphic (Mode 1 Web App & Mode 2 Floating Overlay).  
> **YOU MUST FOLLOW EVERY RULE IN THIS SPECIFICATION WITHOUT EXCEPTION.**

---

## 1. Core Principles & Philosophy

1. **Subtlety Over Spectacle**: Effects exist to communicate state (thinking, listening, streaming, focusing), NOT to create visual noise. Never distract the user from reading research.
2. **Zero Performance Regressions**: Maintain a strict 60–120 FPS target on mobile and desktop. Every animation must be GPU-accelerated and cleanly unmounted.
3. **Zero Structural Breakage**: Libraries.dev components are drop-in aesthetic enhancers. They must NEVER alter form submission, message streaming, keyboard accessibility, or input event bubbling.

---

## 2. Technical Stack & Package Registry

Install all packages using `bun` (the project package manager):
```bash
bun add border-beam thinking-orbs voice-glow liquid-gooey metal-fx img-fx bot-avatars
```

### 2.1 Next.js 16 SSR & Client Boundary Rules
All Libraries.dev packages rely on browser APIs (`window`, `Canvas`, `WebGL`, `requestAnimationFrame`, `AudioContext`).
* **RULE 1 (Mandatory `'use client'`):** Never import Libraries.dev components directly into React Server Components (RSC). Any file consuming them must have `'use client'` at the very top.
* **RULE 2 (Dynamic Import for Canvas/WebGL):** For WebGL-heavy components (`img-fx`, `metal-fx`), use Next.js dynamic imports with `ssr: false` if server rendering errors occur:
  ```tsx
  import dynamic from 'next/dynamic'

  const ImgFx = dynamic(() => import('img-fx').then((mod) => mod.ImgFx), {
    ssr: false,
    loading: () => <div className="skeleton animate-pulse bg-muted rounded-md" />
  })
  ```

---

## 3. Component-by-Component Rules & Contracts

### 3.1 `border-beam`
* **Purpose**: Indicates active state, focus, or AI generation in progress.
* **Approved Locations**:
  1. Main search input container (`components/chat-panel.tsx`) when focused or generating.
  2. Mode 2 Floating HUD perimeter during active deep research.
  3. Primary action chips in the overlay drawer (`[ 📋 Insert Summary ]`).
* **Implementation Rules**:
  * **Rule 3.1.1 (Container Isolation):** The parent element MUST have `relative` and `overflow-hidden` with a defined `rounded-*` border radius.
  * **Rule 3.1.2 (Lifecycle Throttling):** NEVER run `border-beam` indefinitely on idle elements. Toggle it conditionally:
    ```tsx
    {isGenerating && (
      <BorderBeam 
        size={80} 
        duration={6} 
        colorFrom="hsl(var(--primary))" 
        colorTo="hsl(var(--accent))" 
      />
    )}
    ```
  * **Rule 3.1.3 (Token Colors):** Always use theme tokens (`hsl(var(--primary))`, `hsl(var(--accent))`). Never hardcode foreign hex colors.

---

### 3.2 `thinking-orbs`
* **Purpose**: Communicates multi-step agent reasoning, crawling, and synthesis progress.
* **Approved Locations**:
  1. Header of the Mode 2 Floating HUD.
  2. Research process section (`components/research-process-section.tsx`).
  3. Collapsible reasoning headers (`components/reasoning-section.tsx`).
* **State Mapping Protocol**:
  You MUST strictly map Morphic's pipeline events to `thinking-orbs` states:
  | Morphic Pipeline Stage | `thinking-orbs` State Prop | Size |
  | :--- | :--- | :--- |
  | Voice Recording / Listening | `state="listening"` | `size="sm"` |
  | Querying SearXNG / Tavily | `state="searching"` | `size="sm"` |
  | Scraping / Reading Web Pages | `state="working"` | `size="sm"` |
  | LLM Token Streaming | `state="synthesizing"` | `size="sm"` |
  | Finished / Completed | `state="done"` (or fade out) | `size="sm"` |
* **Rule 3.2.1:** Never use large sizes (`size="lg"`) inside dense inline rows. Keep to `size="sm"` or `size="xs"`.

---

### 3.3 `voice-glow`
* **Purpose**: Real-time visual feedback for voice dictation and speech input.
* **Approved Locations**:
  1. Floating Mic Pill (Mode 2) during speech capture.
  2. Anchored beneath the web chat input deck in Mode 1.
* **Implementation Rules**:
  * **Rule 3.3.1 (Non-Interference):** Must have `pointer-events: none` and `aria-hidden="true"`. It must never capture click or touch events intended for buttons or textareas.
  * **Rule 3.3.2 (Decibel Scaling):** When Web Audio API is available, feed live audio levels (`volume={decibels}`). If unavailable, fall back to smooth pulsating animation.
  * **Rule 3.3.3 (AudioContext Cleanup):** Always close or suspend the `AudioContext` stream when voice recording ends or component unmounts to prevent mic hardware lock.

---

### 3.4 `liquid-gooey`
* **Purpose**: Organic fluid morphing for edge-docking, pill expansion, and dismissal targets.
* **Approved Locations**:
  1. Floating pill edge-docking snap (Mode 2).
  2. Dismissal circular target zone `(X)`.
* **Implementation Rules**:
  * **Rule 3.4.1 (Text Sharpness Protection):** Never place typography directly inside a container with SVG gooey filters. Always structure as siblings:
    ```tsx
    <div className="relative">
      {/* Gooey filter applied only to background shape */}
      <div className="gooey-container absolute inset-0">
        <div className="blob-1" />
        <div className="blob-2" />
      </div>
      {/* Text and icons sit above with isolation */}
      <div className="relative z-10 isolate flex items-center">
        <IconMicrophone />
      </div>
    </div>
    ```

---

### 3.5 `metal-fx`
* **Purpose**: Tactile, premium liquid/brushed metallic texture with realistic specular reflections.
* **Approved Locations**:
  1. Floating HUD window drag handle / top bar.
  2. Deep Research toggle badge (`components/search-mode-selector.tsx`).
  3. Resting state of the Mode 2 floating pill.
* **Implementation Rules**:
  * **Rule 3.5.1 (Restraint):** Never apply to body text, chat message cards, or normal buttons.
  * **Rule 3.5.2 (Theme Harmony):** Use `texture="dark-titanium"` in Dark Mode and `texture="liquid-chrome"` in Light Mode.

---

### 3.6 `img-fx`
* **Purpose**: Seamless WebGL pixel mosaic transition into photography.
* **Approved Locations**:
  1. Image search results gallery (`components/search-results-image.tsx`).
  2. Overlay horizontal image carousel cards.
* **Implementation Rules**:
  * **Rule 3.6.1 (Layout Shift Zero-Tolerance):** The parent container MUST have explicit aspect ratio (`aspect-video` or `aspect-square`) so the layout never jumps when the image resolves.
  * **Rule 3.6.2 (Fallback):** Always provide standard Next.js `<Image />` or `<img>` fallback if WebGL is disabled or throws context errors.

---

## 4. Accessibility & Performance Guardrails

1. **Respect `prefers-reduced-motion`**:
   Agents MUST include reduced motion overrides:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .border-beam-anim, .thinking-orbs-anim {
       animation: none !important;
     }
   }
   ```
2. **Resource Throttling**:
   * Limit simultaneous `border-beam` instances to **at most 1 per screen**.
   * Limit WebGL canvas contexts to **at most 4 concurrent instances**; virtualize image grids with `@tanstack/react-virtual` if rendering $>10$ images.
3. **Contrast Compliance**:
   * Text on top of `metal-fx` or `liquid-gooey` surfaces must meet **WCAG AA (4.5:1)** contrast ratios against the background.

---

## 5. Strict Anti-Patterns (What the Agent Must NEVER Do)

- ❌ **DO NOT** add `border-beam` to every card, sidebar item, or button.
- ❌ **DO NOT** modify the underlying search logic, AI SDK hooks (`useChat`), or API route contracts when wrapping components with visual effects.
- ❌ **DO NOT** hardcode random neon hex values like `#FF00FF` or `#00FF00`. Always anchor gradients to Morphic's palette tokens.
- ❌ **DO NOT** introduce dependencies that require Python build tools or node-gyp. Libraries.dev packages are pure JS/TS + CSS/WebGL.
- ❌ **DO NOT** remove existing shadcn/ui components or Tailwind utilities. Libraries.dev wraps them; it does NOT replace them.

---

## 6. Verification Checklist for Agents

Before completing any task touching Libraries.dev components, verify:
- [ ] `bun typecheck` passes with zero TypeScript errors.
- [ ] Next.js build (`bun run build`) completes without SSR or `window is not defined` errors.
- [ ] All animated components cleanly stop RAF loops when unmounted.
- [ ] Visual polish works seamlessly across both Dark Mode and Light Mode.
- [ ] Core chat, search, and deep research functionalities remain 100% operational.
