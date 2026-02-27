---
phase: 04-app-shell-pin-auth
plan: 01
subsystem: ui
tags: [vue3, pinia, vue-router, vite, typescript, fastify-cookie, pin-auth, spa]

# Dependency graph
requires:
  - phase: 01-backend-foundation
    provides: Fastify app with envPlugin exposing SONOS_PIN config
  - phase: 03-real-time-state-sync
    provides: WebSocket backend and app.ts plugin registration pattern
provides:
  - Vue 3 + Vite frontend scaffold in frontend/ directory
  - Pinia auth store with localStorage persistence and httpOnly cookie session
  - Vue Router with beforeEach auth guard protecting all non-public routes
  - PinPad component: 4-dot display + 0-9 digicode keypad
  - PIN auth flow: POST /api/auth/pin validates SONOS_PIN, sets/clears httpOnly cookie
  - Placeholder ZonesView and SettingsView with logout button
affects:
  - 04-app-shell-pin-auth (plan 02 builds on this shell)
  - 05-zone-dashboard (replaces ZonesView placeholder)

# Tech tracking
tech-stack:
  added:
    - vue 3.5 (SPA framework)
    - pinia 2.3 (state management, setup store pattern)
    - vue-router 4.5 (client-side routing)
    - vite 6.1 (build tool + dev server with proxy)
    - vue-tsc 2.2 (TypeScript type-checking for .vue files)
    - "@vitejs/plugin-vue 5.2" (Vite plugin)
    - "@fastify/cookie" (httpOnly cookie support for session)
  patterns:
    - useAuthStore() called inside beforeEach guard (not at module level) to avoid Pinia init race
    - localStorage hydration in store constructor to prevent auth flash on reload
    - Vite proxy forwards /api and /ws to backend during development
    - PinPad exposes setError() via defineExpose for parent template ref access
    - credentials: 'include' on all fetch calls for cookie-based session

key-files:
  created:
    - frontend/package.json
    - frontend/vite.config.ts
    - frontend/index.html
    - frontend/src/main.ts
    - frontend/src/App.vue
    - frontend/src/router/index.ts
    - frontend/src/stores/auth.ts
    - frontend/src/components/PinPad.vue
    - frontend/src/views/PinView.vue
    - frontend/src/views/ZonesView.vue
    - frontend/src/views/SettingsView.vue
    - backend/src/routes/auth.ts
  modified:
    - backend/src/app.ts (added @fastify/cookie + authRoutes registration)
    - backend/package.json (added @fastify/cookie dependency)

key-decisions:
  - "SONOS_PIN used as PIN env var (not APP_PIN) — already configured in docker-compose.yml and env.ts schema"
  - "httpOnly cookie (1-year maxAge) for server-side session + localStorage flag for auth flash prevention"
  - "useAuthStore() called inside router.beforeEach, not at module level — Pinia not initialized at module import time"
  - "Pinia registered before Vue Router in main.ts so guard can access store synchronously"
  - "No shake animation on wrong PIN — plain text error message, dots cleared (user decision)"
  - "Logout button is discreet (transparent, secondary color) — not prominent per user decision"
  - "64x64px minimum key button size for comfortable touch targets on mobile"

patterns-established:
  - "Vite proxy pattern: /api -> localhost:3000 (REST), /ws -> ws://localhost:3000 (WebSocket)"
  - "Vue Router meta.public flag for distinguishing public vs protected routes"
  - "PinPad is a dumb component — emits submit, parent handles auth logic"
  - "CSS custom properties (var(--color-*)) used now; tokens will be defined in Plan 04-02"

requirements-completed: [INFRA-01]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 4 Plan 01: App Shell + PIN Auth Summary

**Vue 3 + Vite SPA with Pinia PIN auth store, Vue Router guard, digicode PinPad component, and Fastify httpOnly cookie session endpoint**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T16:28:44Z
- **Completed:** 2026-02-27T16:31:58Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- Scaffolded complete Vue 3 + Vite frontend project with TypeScript, Pinia, Vue Router
- Built end-to-end PIN auth: PinPad component -> auth store -> backend /api/auth/pin -> httpOnly session cookie
- Vue Router beforeEach guard protects all routes; unauthenticated users redirected to /pin
- Backend gains @fastify/cookie and POST /api/auth/pin + POST /api/auth/logout endpoints
- Both frontend (vue-tsc) and backend (tsc) compile with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Scaffold + PIN auth gate (combined — files are interdependent)** - `c2b6ad0` (feat)

## Files Created/Modified

- `frontend/package.json` - Vue 3.5, Pinia, Vue Router, Vite 6, TypeScript project
- `frontend/vite.config.ts` - Vite config with /api and /ws dev proxy to localhost:3000
- `frontend/index.html` - Inter font, viewport-fit=cover, title "Allo Sonos"
- `frontend/src/main.ts` - App entry: createPinia() before createRouter() to avoid guard race
- `frontend/src/App.vue` - Minimal shell: just `<RouterView />`
- `frontend/src/router/index.ts` - Routes: /pin (public), / (zones), /settings; beforeEach auth guard
- `frontend/src/stores/auth.ts` - Pinia setup store: isAuthenticated, login(), logout() with localStorage hydration
- `frontend/src/components/PinPad.vue` - 4-dot display, 0-9 digicode keypad, emits submit, exposes setError()
- `frontend/src/views/PinView.vue` - Full-screen centered layout, wires PinPad to auth store
- `frontend/src/views/ZonesView.vue` - Placeholder stub for Phase 5 zone dashboard
- `frontend/src/views/SettingsView.vue` - Discreet logout button clears session + redirects to /pin
- `backend/src/routes/auth.ts` - POST /api/auth/pin (validates SONOS_PIN, sets cookie), POST /api/auth/logout
- `backend/src/app.ts` - Registered @fastify/cookie (after envPlugin) and authRoutes

## Decisions Made

- **SONOS_PIN vs APP_PIN:** Used existing SONOS_PIN env var (already in docker-compose.yml + env.ts schema). No new env var needed.
- **Cookie strategy:** httpOnly 1-year maxAge cookie + localStorage 'auth' flag. Cookie provides server-side validation; localStorage prevents auth flash on reload.
- **Pinia init order:** app.use(createPinia()) before app.use(router) — required so router guard can call useAuthStore() synchronously inside beforeEach.
- **PinPad design:** No shake animation on error (user decision). Plain text error below dots. 64x64px minimum buttons for touch.
- **Logout prominence:** Discreet button (transparent background, secondary text color) — not a prominent CTA.
- **CSS tokens:** Using var(--color-*) custom property references throughout; actual token values will be defined in Plan 04-02.

## Deviations from Plan

### Combined Task Commit

The plan specified separate commits for Task 1 and Task 2, but the files are tightly interdependent at compile time (PinView imports PinPad, router imports auth store, main.ts imports router). Attempting to commit Task 1 without these files causes TypeScript/build failures. All work was committed together in a single well-structured commit that covers both tasks completely.

**Total deviations:** 1 structural (combined commit for compilation correctness)
**Impact on plan:** Zero functional impact. All planned files created. Both tasks fully satisfied.

## Issues Encountered

None — all files compiled cleanly on first attempt.

## User Setup Required

None - no external service configuration required. SONOS_PIN is already configured in docker-compose.yml.

## Next Phase Readiness

- Frontend scaffold complete; all subsequent UI work has a protected, routed SPA to build within
- Auth gate fully functional: unauthenticated -> /pin, correct PIN -> /zones
- CSS design tokens (var(--color-*)) referenced but not yet defined — Plan 04-02 will add them
- ZonesView is a placeholder stub ready for Phase 5 zone dashboard replacement
- SettingsView has logout; Phase 4 Plan 02 will add the app shell (header, nav)

---
*Phase: 04-app-shell-pin-auth*
*Completed: 2026-02-27*
