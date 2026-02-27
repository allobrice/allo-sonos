---
phase: 04-app-shell-pin-auth
plan: 02
subsystem: ui
tags: [vue3, css-custom-properties, design-tokens, websocket, dark-theme, responsive, mobile-first]

# Dependency graph
requires:
  - phase: 04-app-shell-pin-auth
    plan: 01
    provides: Vue 3 SPA scaffold, Pinia auth store, Vue Router guard, PinPad component
  - phase: 03-real-time-state-sync
    provides: WebSocket backend at /ws endpoint
provides:
  - CSS design token system (main.css) with all custom properties for colors, spacing, layout, radius
  - useWebSocket() composable: /ws connection, reactive connected ref, exponential backoff reconnect
  - WsIndicator.vue: green dot+Live / pink dot+Offline status display
  - AppHeader.vue: fixed header with "Allo Sonos" title and WebSocket status indicator
  - AppNav.vue: fixed bottom nav with Zones and Settings RouterLink tabs, iOS safe area support
  - App.vue shell: conditional render — full-screen PIN (no shell) vs authenticated app shell
  - Responsive layout: max-width 540px centered on desktop, full-width on mobile
  - Polish on PinPad, PinView, SettingsView using design tokens throughout
affects:
  - 05-zone-dashboard (will build within this app shell, use design tokens)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSS custom property design token system — all colors/spacing/layout referenced via var(--*)
    - useWebSocket composable per-component (not global store) — appropriate scope for Phase 4
    - App.vue conditional v-if/v-else layout based on auth state — clean shell vs bare view routing
    - iOS safe area inset: env(safe-area-inset-bottom, 0px) on bottom nav
    - dvh with vh fallback: height 100vh + height 100dvh for proper mobile viewport height

key-files:
  created:
    - frontend/src/assets/main.css
    - frontend/src/composables/useWebSocket.ts
    - frontend/src/components/WsIndicator.vue
    - frontend/src/components/AppHeader.vue
    - frontend/src/components/AppNav.vue
  modified:
    - frontend/src/main.ts (added main.css import)
    - frontend/src/App.vue (full app shell conditional layout)
    - frontend/src/components/PinPad.vue (design token polish, min-height error msg)
    - frontend/src/views/PinView.vue (100dvh, design token typography)
    - frontend/src/views/SettingsView.vue (design tokens, pink logout btn, min-height 44px)

key-decisions:
  - "useWebSocket composable is minimal in Phase 4 — only exposes connected ref; Phase 5 will expand it to parse zone state messages"
  - "AppNav uses RouterLink with active-class for active tab highlighting — relies on Vue Router built-in class management"
  - "error-msg always renders in DOM (not v-if) — min-height prevents layout shift when error appears/disappears"
  - "100vh then 100dvh ordering: last-wins in CSS means dvh applies in supporting browsers, vh is the fallback"

patterns-established:
  - "Design token pattern: all component styles reference var(--color-*), var(--space-*), var(--radius-*) — no hardcoded values"
  - "App shell pattern: App.vue owns layout switch between full-screen view and header+content+nav shell"
  - "Composable per-component mounting: useWebSocket called inside AppHeader, not at app root — each component manages its own lifecycle"

requirements-completed: [INFRA-02]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 4 Plan 02: App Shell + Design Tokens Summary

**Mobile-first responsive app shell with CSS design token system, dark theme, fixed header with WebSocket status indicator, bottom nav, and 100dvh layout using Vue 3 conditional rendering**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T16:35:05Z
- **Completed:** 2026-02-27T16:37:21Z
- **Tasks:** 2 auto tasks complete (Task 3 is human-verify checkpoint)
- **Files modified:** 10

## Accomplishments

- Built complete CSS design token system with all locked user values (#87DB78 green, #FF3C74 pink, #111111 bg, 8px radius)
- Implemented useWebSocket composable with auto-reconnect (exponential backoff: 1s -> 2s -> 4s -> 8s max)
- Created AppHeader (fixed top, WS indicator) and AppNav (fixed bottom, iOS safe area, Zones/Settings tabs) components
- App.vue now conditionally renders: bare PIN view (unauthenticated) vs full app shell (header + content + nav)
- All component styles migrated to CSS custom properties — zero hardcoded color/spacing values

## Task Commits

Each task was committed atomically:

1. **Task 1: Design tokens, CSS global, useWebSocket, WsIndicator, AppHeader, AppNav** - `1695137` (feat)
2. **Task 2: App.vue shell, PinPad polish, PinView polish, SettingsView polish** - `4814e01` (feat)

## Files Created/Modified

- `frontend/src/assets/main.css` - Complete CSS design token system: 7 color tokens, spacing scale, layout vars, radius scale, elevation, typography
- `frontend/src/main.ts` - Added `import './assets/main.css'` as first import
- `frontend/src/composables/useWebSocket.ts` - WebSocket connection with reactive connected ref, exponential backoff reconnect
- `frontend/src/components/WsIndicator.vue` - 8px dot indicator: green+Live connected, pink+Offline disconnected
- `frontend/src/components/AppHeader.vue` - Fixed header: "Allo Sonos" title left, WsIndicator right, z-index 100
- `frontend/src/components/AppNav.vue` - Fixed bottom nav: Zones and Settings RouterLink tabs, env(safe-area-inset-bottom) iOS support
- `frontend/src/App.vue` - Conditional layout: unauthenticated=bare RouterView, authenticated=shell with header+content+nav
- `frontend/src/components/PinPad.vue` - Polished with design tokens: 16px dots, var(--color-border) empty/var(--color-accent-green) filled, error always rendered with min-height
- `frontend/src/views/PinView.vue` - 100dvh/100vh full-screen, design token typography, var(--color-bg) background
- `frontend/src/views/SettingsView.vue` - Design tokens throughout, logout button: var(--color-accent-pink) color, min-height 44px

## Decisions Made

- **useWebSocket scope:** Minimal in Phase 4 (only `connected` ref). Intentionally not a global store — Phase 5 will expand it to parse zone state messages. AppHeader is the only consumer for now.
- **AppNav active-class:** Uses Vue Router's built-in `active-class` prop on RouterLink — no manual `useRoute()` comparison needed; cleaner declarative approach.
- **Error message always in DOM:** PinPad error-msg rendered without v-if, just with min-height — prevents layout shift when error appears/disappears on wrong PIN.
- **dvh fallback ordering:** `height: 100vh` then `height: 100dvh` — CSS last-wins means dvh applies in supporting browsers, vh is the safe fallback for older browsers.

## Deviations from Plan

None - plan executed exactly as written. PinPad already had good structure from Plan 01; only style polish was needed (token values now defined).

## Issues Encountered

None — both type-check (vue-tsc) and build (vite) passed cleanly on first attempt.

## User Setup Required

None - no external service configuration required. Dev server startup instructions are in the checkpoint below.

## Next Phase Readiness

- App shell is complete: authenticated users see header + scrollable content + bottom nav
- Design tokens fully defined in main.css — Phase 5 zone dashboard components can immediately use var(--color-*) etc.
- WebSocket composable ready; Phase 5 will expand it to parse zone state messages into a Pinia store
- ZonesView is still a placeholder — Phase 5 replaces it with the full zone dashboard
- Human verification checkpoint (Task 3) needs visual confirmation before phase is marked fully complete

---
*Phase: 04-app-shell-pin-auth*
*Completed: 2026-02-27*
