---
phase: 08-favorites-ui
plan: "03"
subsystem: ui
tags: [vue, pinia, typescript, sonos, favorites]

# Dependency graph
requires:
  - phase: 07-favorites-backend
    provides: "Favorites backend routes and services (src/)"
  - phase: 08-favorites-ui
    provides: "08-01 store + components, 08-02 ZoneCard integration"
provides:
  - "Freshly compiled backend dist/ containing favorites routes and services"
  - "frontend playFavorite with console.warn on error (no silent swallow)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dist/ rebuild after adding new source routes — never ship without recompiling"
    - "Fire-and-forget with console.warn — silent swallow replaced by visible dev console output"

key-files:
  created: []
  modified:
    - "frontend/src/stores/favorites.ts"
    - "backend/dist/ (build artifact, gitignored)"

key-decisions:
  - "dist/ is gitignored — the fix is to rebuild, not to track compiled output"
  - "console.warn not console.error in playFavorite — failure is non-fatal, fire-and-forget pattern preserved"

patterns-established:
  - "Always rebuild backend after adding new routes before UAT — stale dist causes silent 404s"

requirements-completed: [FAV-02]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 8 Plan 03: Gap Closure — Stale Backend Dist Summary

**Rebuilt stale backend dist/ to include favorites routes, and added console.warn to playFavorite so API failures are visible instead of silently swallowed**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T11:47:03Z
- **Completed:** 2026-03-04T11:52:00Z
- **Tasks:** 2
- **Files modified:** 1 source file (+ dist/ rebuild artifact)

## Accomplishments

- Rebuilt `backend/dist/` with `npm run build` — now contains `routes/favorites.js`, `services/sonos-favorites.js`, and `app.js` with favorites import/registration
- Fixed silent catch in `playFavorite` — now logs `console.warn('[favorites] playFavorite failed:', err)` for dev visibility
- Named the `catch` parameter in `loadFavorites` for consistency (minor cleanup)
- TypeScript compiles cleanly for both backend and frontend

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebuild backend dist** — no git commit (dist/ is gitignored; build artifact only)
2. **Task 2: Add console.warn to playFavorite** — `f86e171` (fix)

**Plan metadata:** (final docs commit)

## Files Created/Modified

- `frontend/src/stores/favorites.ts` — playFavorite catch now logs console.warn; loadFavorites catch uses named parameter
- `backend/dist/routes/favorites.js` — compiled from src/routes/favorites.ts (gitignored)
- `backend/dist/services/sonos-favorites.js` — compiled from src/services/sonos-favorites.ts (gitignored)
- `backend/dist/app.js` — recompiled with favorites import and registration (gitignored)

## Decisions Made

- `dist/` remains gitignored — the correct fix is to rebuild, not to commit compiled output. The CI/CD process (or server restart) triggers a fresh build.
- `console.warn` rather than `console.error` in `playFavorite` — the fire-and-forget pattern is preserved (no UI error state); the warning is for developer visibility only.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- The verification command from the plan used bash `!` which was escaped by the shell. Manual file listing confirmed all artifacts were present — no actual issue with the build.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Backend dist/ is freshly compiled and includes all favorites routes
- Frontend store surfaces API errors to the dev console
- UAT test 6 ("Jouer un favori") should now pass: tapping a favorite closes the sheet AND starts playback
- v1.2 milestone is ready for final verification — all 9 UAT tests should pass with the rebuilt dist

---
*Phase: 08-favorites-ui*
*Completed: 2026-03-04*
