# Rule: Libraries.dev UI Implementation Standards

When implementing or modifying UI components using **Libraries.dev** (`border-beam`, `thinking-orbs`, `voice-glow`, `liquid-gooey`, `metal-fx`, `img-fx`, `bot-avatars`) in this repository:

1. **Client Boundary**: Always ensure files importing these components have `'use client'`. For WebGL-heavy components (`img-fx`, `metal-fx`), use Next.js dynamic import with `{ ssr: false }`.
2. **Subtlety & Performance**: Never animate idle elements. Limit `border-beam` to at most 1 active instance per screen (e.g., active input focus or active generation stream).
3. **State Mapping**: Map Morphic's streaming states directly to `thinking-orbs`:
   - `searching` -> SearXNG/Tavily query
   - `working` -> DOM scraping / source reading
   - `synthesizing` -> Token streaming
4. **Isolate Text from Filters**: Never put typography inside containers with `liquid-gooey` SVG filters; keep text in a sibling layer with `isolate` to prevent distortion.
5. **No Logic Disruption**: Visual effects must strictly wrap components and never alter form submission, message streams, or input event bubbling.
6. **Detailed Reference**: Follow all constraints defined in [LIBRARIES_DEV_AGENT_REQUIREMENTS.md](file:///c:/Users/VISHRUTH/morphic/morphic/LIBRARIES_DEV_AGENT_REQUIREMENTS.md).
