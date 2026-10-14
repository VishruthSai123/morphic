# Morphic Android Phase 5: Next-Level Overlay UI Revamp & Adaptive Settings Engine
## Complete Visual Overhaul & Native Configurability Plan

---

## 1. Executive Summary & Problem Breakdown

### 1.1 The Problems Identified in Current Overlay
1. **Visual Artifacts & Clipped Icon ("Feels Cut"):**
   - The WindowManager window was strictly sized to `(52 * density).toInt()`, while the Compose Box scaled to `1.06f` with borders and shadows. This caused the outer edges and drop shadows to be clipped by the WindowManager surface boundaries, resulting in a jagged, cut-off look.
   - The purple gradient with star icon was generic and did not reflect **Morphic's signature visual identity** (the iconic dual-orb dots `● ●`, pitch-black zinc-950 aesthetic, and subtle glowing borders).
2. **Awkward Fixed Placement ("Stuck at Bottom"):**
   - The pill spawned with fixed offsets (`y = 90 * density`), placing it directly over navigation buttons and web view elements without smart edge docking.
3. **Lack of User Adaptiveness (No Customization):**
   - Users currently have zero control over:
     - **Display Mode:** Always visible vs. Keyboard (IME) only vs. Smart Edge Dock.
     - **Pill Size:** Compact (44dp), Standard (52dp), Prominent (60dp).
     - **Window Opacity / Transparency:** Adjusting background visibility from 40% to 100%.
     - **Auto-Hide / Edge Docking:** Folding into a discreet translucent tab on the screen edge after 3 seconds of inactivity.
4. **Settings Missing from Native App Layer:**
   - The user needs these settings to be managed **natively on top of the app** (via a sleek bottom sheet / modal), synced with DataStore, and directly accessible from both `MainActivity` and the Overlay Drawer!

---

## 2. Morphic Visual Language & Design System Specifications

To achieve a **1:1 match with Morphic Next.js Web UI**:

### 2.1 Color Tokens & Materials
- **Background Glass:** Deep Zinc-950 (`#09090B`) with 85% to 92% alpha and hardware backdrop blur (RenderEffect on Android 12+).
- **Surface / Cards:** Zinc-900 (`#18181B`).
- **Inner Inputs:** Darker Zinc-925 (`#121215`).
- **Borders:** 1dp crisp stroke in Zinc-800 (`#27272A`) or subtle glowing white `rgba(255, 255, 255, 0.08)`.
- **Text:** Pure white (`#FFFFFF`) for headers/body; Zinc-400 (`#A1A1AA`) for secondary/hints; Zinc-600 (`#52525B`) for tertiary.
- **Accents:** Dual cyan/teal and indigo orbs representing Morphic's answer engine.

### 2.2 Signature Icon: The Morphic Dual-Orbs (`● ●`)
Instead of generic material icons, the Pill and Header feature Morphic's authentic dual-orb identity:
- Two perfectly rounded dots breathing horizontally.
- In idle state: subtle breathing luminance.
- In research state: glowing pulse and orbital rotation mimicking `thinking-orbs`.

---

## 3. Architecture & New Components

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ANDROID ARCHITECTURE                            │
├────────────────────────────────────────────────────────────────────────┤
│  [NATIVE SETTINGS ENGINE]                                              │
│  SettingsDataStore (Preferences DataStore)                             │
│  ├── overlayDisplayMode (ALWAYS | IME_ONLY | SMART_DOCK)               │
│  ├── overlaySize (COMPACT: 44dp | STANDARD: 52dp | PROMINENT: 60dp)    │
│  ├── overlayOpacity (0.4f .. 1.0f)                                     │
│  ├── autoHideToEdge (Boolean)                                          │
│  └── hapticFeedback (Boolean)                                          │
├────────────────────────────────────────────────────────────────────────┤
│  [NATIVE CONFIGURATION UI]                                             │
│  OverlaySettingsSheet (Jetpack Compose ModalBottomSheet)               │
│  ├── Accessible from:                                                  │
│  │   ├── MainActivity Top Bar / FAB Settings button                    │
│  │   └── Overlay Drawer Settings Quick Action                          │
│  └── Instant Real-Time Preview & Persistence                           │
├────────────────────────────────────────────────────────────────────────┤
│  [REVAMPED 3-STATE AMBIENT OVERLAY]                                    │
│  MorphicOverlayService (Foreground Service + WindowManager)            │
│  ├── Window Surface: Extra 16dp transparent padding (ZERO clipping)   │
│  ├── State 1: Morphic Pill (Dual-Orbs, Edge-Snapping, Smart Dock Tab)  │
│  ├── State 2: Quick Action Drawer (Search, Context, App, Settings)     │
│  └── State 3: Morphic Research HUD (1:1 Web Replica with Quick/Deep)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Component Design & Enhancements

### 4.1 Morphic Pill Revamp (`PillView.kt`)
- **No Window Clipping:** The WindowManager params include an extra `16dp` transparent margin buffer so scaling animations and elevation shadows never hit hard window boundaries.
- **Dual-Orbs Icon:** Renders Morphic's clean dual-orb logo (`● ●`) with smooth ambient glowing animation.
- **Smart Edge Docking:**
  - When released, snaps magnetically to the nearest screen edge (left or right).
  - When idle for 3.5 seconds in *Smart Dock* mode, smoothly transitions into a sleek half-docked edge tab (40% width exposed at the edge), instantly expanding when touched.
- **Dynamic Sizing:** Respects user's configured size: Compact (44dp), Standard (52dp), Prominent (60dp).

### 4.2 Quick Action Drawer Revamp (`DrawerView.kt`)
- **Visuals:** Sleek floating pill-capsule with Zinc-950 dark glass, 1dp Zinc-800 border, and soft drop shadow.
- **Header:** Morphic Dual-Orbs logo + "Morphic Quick Assist" + Collapse & Close buttons.
- **Action Capsules (Grid / Row):**
  1. 🔍 **Search** -> Expands to full HUD.
  2. ⚡ **Context** -> Reads foreground on-screen context / clipboard.
  3. 🌐 **Full App** -> Deep-links straight to the full Next.js web application.
  4. ⚙️ **Settings** -> Launches the native Overlay Settings modal!

### 4.3 Research HUD Revamp (`HudView.kt`)
- **Morphic Web Fidelity:**
  - **Header:** Dual-Orbs logo, "Morphic" wordmark, model badge ("Gemini 2.5 Flash"), and minimize/settings buttons.
  - **Input Box:** 1:1 replica of Morphic's web input:
    - Rounded-2xl container in `#18181B`.
    - Integrated mode selector badge (`[ Quick ▾ ]` or `[ Deep Research ▾ ]`).
    - Circular send arrow button.
  - **Live Streaming Answer:** Clean Geist-styled typography, formatted paragraphs, source count badge.
  - **Sources Flow:** Favicons + site domains in rounded Zinc-900 chips.
  - **Actions:** One-tap "Copy" and "Open in Morphic" (opens full chat in `MainActivity`).

### 4.4 Adaptive Display Modes in `MorphicOverlayService.kt`
1. **Mode A: Always Visible**
   - The pill is always visible across all apps on the screen.
2. **Mode B: Keyboard (IME) Only**
   - The overlay detects soft keyboard visibility. When the user taps an input field in any app (WhatsApp, Chrome, Docs) and the keyboard slides up, the pill automatically appears and glides **12dp above the keyboard**! When the keyboard closes, it gracefully hides.
3. **Mode C: Smart Edge Dock**
   - Pill is visible, but after 3.5s of no interaction, folds into a discreet edge tab on the screen border so it never obstructs app content.

### 4.5 Native Overlay Settings Bottom Sheet (`OverlaySettingsSheet.kt`)
A native Compose `ModalBottomSheet` on top of `MainActivity`:
- **Display Mode Selector:** Segmented control `[ Always | On Keyboard | Smart Dock ]`.
- **Pill Size:** Segmented control `[ Compact | Standard | Large ]`.
- **Opacity Slider:** Slider from 30% to 100% with live percentage label.
- **Auto-Snap to Edge:** Switch toggle.
- **Haptic Feedback:** Switch toggle.
- **Overlay State:** Big toggle button to start/stop service or grant permission.

---

## 5. Implementation Sequence

### Step 1: DataStore Expansion
- Update [SettingsDataStore.kt](file:///c:/Users/VISHRUTH/morphic/morphic/android/app/src/main/java/com/morphic/android/data/settings/SettingsDataStore.kt) to support:
  - `KEY_OVERLAY_DISPLAY_MODE` (String: `ALWAYS`, `IME_ONLY`, `SMART_DOCK`)
  - `KEY_OVERLAY_SIZE` (String: `COMPACT`, `STANDARD`, `LARGE`)
  - `KEY_OVERLAY_OPACITY` (Float: `0.3f .. 1.0f`)
  - `KEY_AUTO_SNAP` (Boolean)
  - `KEY_HAPTIC_ENABLED` (Boolean)

### Step 2: Signature Morphic UI Components
- Create `MorphicLogo.kt`: Animated vector rendering of Morphic's dual-orb dots `● ●` with breathing and pulsing animation states.
- Refactor `PillView.kt`:
  - Replace purple circle with sleek frosted Zinc-950 pill containing the dual-orbs.
  - Fix window bounds with transparent padding to eliminate all clipping.
  - Add edge-docked tab visual state.

### Step 3: Overlay Drawer & HUD Redesign
- Update `DrawerView.kt`:
  - 1:1 dark glass styling, Lucide-style icons.
  - Add native settings shortcut button.
- Update `HudView.kt`:
  - Morphic web input replica with mode chip (`Quick` / `Deep`).
  - Improved research step progress indicator.

### Step 4: Native Overlay Settings Modal
- Create `OverlaySettingsSheet.kt` in `ui/settings/`:
  - Polished Material 3 `ModalBottomSheet` with Morphic aesthetics.
  - Segmented buttons, sliders, and switches connected to `SettingsDataStore`.
- Update `MainActivity.kt`:
  - Add settings gear icon to the overlay control badge.
  - Open `OverlaySettingsSheet` on tap.

### Step 5: Service Adaptiveness & WindowManager Polish
- Update `MorphicOverlayService.kt`:
  - Listen to `SettingsDataStore` flows in real-time.
  - Dynamically adjust window width/height based on `overlaySize`.
  - Apply configured opacity to view alpha.
  - Implement edge-snap physics and smart dock timers.

---

## 6. Strict Quality Guardrails

1. **NO WINDOW CLIPPING:** WindowManager layout parameters MUST include adequate padding around scaled or elevated Compose views.
2. **ZERO HARDCODED MAGIC SIZES:** Pill sizes must derive from the centralized `OverlaySize` enum.
3. **MAIN THREAD INTEGRITY:** All `WindowManager.updateViewLayout` and `renderState` calls must run on `Looper.getMainLooper()`.
4. **SMOOTH ANIMATIONS:** All state transitions between Pill, Drawer, and HUD must use spring-based physics (`dampingRatio = 0.8f`, `stiffness = 380f`).
5. **NATIVE OVERLAY SETTINGS NEVER INTERFERE WITH WEB:** The settings modal is rendered as a native Compose layer floating above the WebView without reloading the web page.

---

## 7. Acceptance Criteria

1. **Pill Aesthetics:** The pill appears as a crisp, premium, frosted dark capsule with Morphic's dual-orb logo—zero clipped edges or awkward shadows.
2. **Edge Snapping:** Releasing the pill smoothly glides and snaps it to the screen border.
3. **Native Settings:** User can tap the settings icon on `MainActivity`'s badge or on the Overlay Drawer to open the native settings sheet and change size, opacity, or mode.
4. **Adaptive Modes:** Changing size or opacity in settings updates the floating overlay in real-time.
5. **HUD Experience:** The floating HUD feels like a mini-Morphic answer engine with authentic typography, dual-orb status, and one-tap deep linking to the full web app.
