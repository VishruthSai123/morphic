# Morphic Android: Overlay Lifecycle, State Machine & Edge-Case Architecture

This document details the exact technical workflows, state machine transitions, and defensive engineering requirements needed to handle Android system overlays (`SYSTEM_ALERT_WINDOW`) and `AccessibilityService` edge cases reliably in production.

---

## 1. Overlay State Machine & Lifecycle Steps

```
                        ┌────────────────────────┐
                        │     DORMANT / IDLE     │
                        │  (Background Service)  │
                        └───────────┬────────────┘
                                    │ Accessibility: Editable field focused
                                    ▼
                        ┌────────────────────────┐
                        │   DOCKING EVALUATION   │
                        │ (Check Secure/Excluded)│
                        └─────┬────────────┬─────┘
          In secure app/field │            │ Valid editable field
                              ▼            ▼
                   ┌─────────────┐  ┌────────────────────────┐
                   │ AUTO-SUPPRESS│  │    OVERLAY MOUNTED     │
                   │ (Stay hidden)│  │ (Minimal Mic Pill UI) │
                   └─────────────┘  └─────┬────────────┬─────┘
                                          │            │ User taps Mic
                Keyboard dismissed / Blur │            ▼
                                          │  ┌────────────────────────┐
                                          │  │   LISTENING & SEARCH   │
                                          │  │  (Waveform + Streaming)│
                                          │  └───────────┬────────────┘
                                          │              │ Results ready
                                          │              ▼
                                          │  ┌────────────────────────┐
                                          │  │    EXPANDED DRAWER     │
                                          │  │  (Chips, Links, Media) │
                                          │  └───────────┬────────────┘
                                          │              │ User taps [Insert]
                                          ▼              ▼
                               ┌───────────────────────────────┐
                               │       CONTENT INJECTED        │
                               │  (Auto-collapse to mini pill) │
                               └───────────────────────────────┘
```

---

## 2. Step-by-Step Lifecycle Handlers

### Step 1: On-Open (Detection & Positioning)
1. **Event Capture**:
   - `AccessibilityService` receives `AccessibilityEvent.TYPE_VIEW_FOCUSED` or `TYPE_WINDOW_STATE_CHANGED`.
2. **Field Inspection**:
   - Inspect `event.source`:
     - Confirm `isEditable == true`.
     - Read `inputType`. If `InputType.TYPE_TEXT_VARIATION_PASSWORD`, `WEB_PASSWORD`, or `NUMBER_PASSWORD` $\rightarrow$ **Abide by Privacy Rule (Abort mounting)**.
3. **Coordinate Calculation**:
   - Read screen display metrics and current window insets:
     ```kotlin
     val imeHeight = rootWindowInsets?.getInsets(WindowInsetsCompat.Type.ime())?.bottom ?: 0
     val navBarHeight = rootWindowInsets?.getInsets(WindowInsetsCompat.Type.navigationBars())?.bottom ?: 0
     ```
   - Calculate anchor: Position the pill **12dp above the top edge of the soft keyboard**, docked right or left according to user handedness preferences.
4. **Window Attachment**:
   - Add view using `WindowManager.addView(overlayView, layoutParams)`.
   - Apply smooth spring enter animation (Scale `0.8 -> 1.0`, Alpha `0 -> 1.0`).

### Step 2: On-Close & Dismissal Triggers
The overlay must dismiss cleanly without leaving phantom touches or blocking user taps.
* **Trigger A: Field Unfocused / Keyboard Hidden**:
  - `AccessibilityEvent.TYPE_VIEW_FOCUSED` fires for a non-editable container, or IME insets drop to 0.
  - Transition: Gracefully shrink into a minimal edge-docked tab or hide completely (configurable in Settings).
* **Trigger B: Back Button Pressed**:
  - Intercept back button when the expanded results tray is open:
    - 1st press: Collapses expanded tray $\rightarrow$ returns to small mic pill.
    - 2nd press: Passes through to close keyboard.
* **Trigger C: Touch-Outside (Dismiss Expanded Tray)**:
  - If user taps the main app text area or message list, dismiss the expanded drawer while keeping the focused input untouched.
* **Trigger D: Flick-to-Dismiss ("X" Target Zone)**:
  - When dragging the floating pill, render a semi-transparent circular dismissal target `(X)` at the bottom-center of the screen.
  - If dragged into the target radius, trigger haptic feedback (`VibrationEffect.EFFECT_HEAVY_CLICK`) and animate collapse into the circle.

---

## 3. Deep Edge Cases & Defensive Engineering

### Edge Case 1: Password & Banking Application Clashes
* **Risk**: Overlay could be flagged as a tapjacking/screen-scraping malware by banking, payment, or authentication apps.
* **Mitigation**:
  1. **Password Field Filter**:
     ```kotlin
     val isPassword = (node.inputType and InputType.TYPE_MASK_VARIATION) == InputType.TYPE_TEXT_VARIATION_PASSWORD
         || (node.inputType and InputType.TYPE_MASK_VARIATION) == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
         || node.isPassword
     if (isPassword) {
         hideOverlayImmediate()
         return
     }
     ```
  2. **Package Blocklist**: Maintain an internal blacklist of sensitive package prefixes:
     - `com.google.android.apps.authenticator2`
     - Banking and crypto wallet namespaces (`*.banking`, `*.upi`, `com.binance.*`, etc.).
  3. **FLAG_SECURE Detection**: If the underlying window sets `FLAG_SECURE`, avoid reading screen node text.

### Edge Case 2: Soft Keyboard Collisions & Dynamic Height Shifts
* **Risk**: Gboard, SwiftKey, and Samsung Keyboard resize dynamically when voice input opens, clipboard history opens, or emojis are toggled. If the overlay has static coordinates, it will overlap keys or block the send button.
* **Mitigation**:
  - Use `ViewTreeObserver.OnGlobalLayoutListener` or listen to `WindowInsetsAnimation.Callback`.
  - Animate overlay Y-position in sync with keyboard expansion/shrink:
    ```kotlin
    val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
    params.y = screenHeight - imeBottom - overlayHeight - margin
    windowManager.updateViewLayout(overlayView, params)
    ```
  - **Floating Keyboard Support**: When users switch Gboard to "Floating Keyboard Mode", keyboard insets report 0. Detect this case and snap Morphic pill to the right-hand screen edge instead of anchoring to the bottom.

### Edge Case 3: Screen Orientation Changes (Portrait $\leftrightarrow$ Landscape)
* **Risk**: Landscape mode severely compresses vertical height; the keyboard often covers 80% of the screen.
* **Mitigation**:
  - Register `onConfigurationChanged(newConfig: Configuration)` in the Service.
  - In landscape: Switch overlay from vertical pill to a **compact horizontal toolbar** anchored to the extreme right or left bezel.
  - Re-verify coordinates against `display.getRealMetrics()`. Clamps ensure the pill never spawns off-screen.

### Edge Case 4: Fullscreen & Immersive Media Mode
* **Risk**: Watching YouTube, playing games, or taking photos while an input field is triggered should not show an intrusive AI pill.
* **Mitigation**:
  - Check system UI visibility flags:
    ```kotlin
    val isImmersive = (decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY) != 0
    ```
  - If the active window is categorized as `GAME` or `MEDIA` in package manager $\rightarrow$ Remain hidden unless user explicitly summons via Quick Settings tile.

### Edge Case 5: Android System Gesture Navigation Clashes
* **Risk**: On modern Android devices, swiping from the left or right edge triggers "Back". If the Morphic pill is docked at the screen edge, users trying to swipe "Back" will accidentally drag Morphic.
* **Mitigation**:
  - Reserve edge padding: Keep the pill docked **at least 16dp inside** the system gesture exclusion zone.
  - Use Android 10+ Gesture Exclusion Rects:
    ```kotlin
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val exclusionRects = listOf(Rect(pillX, pillY, pillX + pillWidth, pillY + pillHeight))
        overlayView.systemGestureExclusionRects = exclusionRects
    }
    ```

### Edge Case 6: Focus Stealing & Keyboard Auto-Dismissal Bug
* **Risk**: In Android, adding an overlay window can accidentally steal input focus from the underlying EditText, causing the soft keyboard to immediately close.
* **Mitigation**:
  - Always configure `WindowManager.LayoutParams`:
    ```kotlin
    params.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                   WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                   WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH or
                   WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
    ```
  - Only toggle off `FLAG_NOT_FOCUSABLE` if the user opens an explicit nested typing field inside Morphic (rare, as this companion is voice-first).

### Edge Case 7: Multi-Window & Foldables / Split-Screen
* **Risk**: On devices like Samsung Galaxy Z Fold or tablets, two apps are open simultaneously (e.g., Slack on top, Chrome on bottom).
* **Mitigation**:
  - Listen for which multi-window region currently holds input focus (`AccessibilityNodeInfo.getWindow()`).
  - Read `window.getBoundsInScreen(rect)`.
  - Anchor Morphic specifically within the active window partition, rather than using full display coordinates.

### Edge Case 8: AccessibilityService Termination & Battery Optimization
* **Risk**: Aggressive OEM battery killers (Xiaomi MIUI/HyperOS, Samsung OneUI, OnePlus OxygenOS) kill background accessibility services after prolonged screen-off time.
* **Mitigation**:
  1. Pair `AccessibilityService` with an ongoing **Foreground Service** running a persistent sticky notification (`startForeground()` with `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`).
  2. For Android 14+ (API 34+), the `AndroidManifest.xml` must declare:
     ```xml
     <service
         android:name=".services.MorphicForegroundService"
         android:foregroundServiceType="specialUse"
         android:exported="false">
         <property
             android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
             android:value="ambient_assistant_overlay" />
     </service>
     ```
  3. Implement an auto-restart check on boot (`RECEIVE_BOOT_COMPLETED`) and on unlock (`ACTION_USER_PRESENT`).
  4. Include an in-app "OEM Battery Guide" using libraries like `DontKillMyApp` to prompt users to disable battery optimization (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`).

### Edge Case 9: Rapid Target App Switching & Race Conditions
* **Risk**: User speaks *"Find budget flights to Tokyo"*, but before results arrive, they switch from WhatsApp to Instagram. When the AI finishes, injecting text into Instagram would paste in the wrong place.
* **Mitigation**:
  - Store a snapshot token of the target field:
    ```kotlin
    data class TargetContext(
        val packageName: String,
        val viewId: String?,
        val nodeWindowId: Int,
        val capturedAt: Long
    )
    ```
  - Prior to executing `ACTION_SET_TEXT`, verify:
    ```kotlin
    val currentNode = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
    if (currentNode?.packageName != targetContext.packageName) {
        // App switched! Abort direct injection, store in Morphic Clipboard tray instead.
        notifyUser("Result saved to Morphic Tray (App changed)")
    }
    ```

---

## 4. Summary Checklist for Production Release

- [x] Password fields automatically suppress overlay without reading text.
- [x] Package blocklist covers financial, crypto, and auth applications.
- [x] Overlay adapts dynamically to Gboard/keyboard height changes without jitter.
- [x] Screen rotation repositions and clamps overlay to safe insets.
- [x] Edge gesture exclusion rects prevent back-swipe hijacking on Android 10+.
- [x] Input focus is never stolen from underlying app (`FLAG_NOT_FOCUSABLE`).
- [x] Fallback to system clipboard if target app utilizes custom non-standard WebViews.
- [x] Target context verification prevents cross-app injection race conditions.
