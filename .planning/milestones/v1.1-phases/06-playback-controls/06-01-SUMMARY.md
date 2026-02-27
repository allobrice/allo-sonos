---
phase: 06-playback-controls
plan: 01
subsystem: ui
tags: [vue, pinia, transport-controls, optimistic-ui, debounce, svg-icons]

# Dependency graph
requires:
  - phase: 05-zone-display
    provides: ZoneCard component and useZonesStore with ZoneState interface
provides:
  - Transport command actions (sendPlay, sendPause, sendNext, sendPrevious) in zones store
  - Play/pause, skip-previous, skip-next buttons on ZoneCard with optimistic UI and debounce
affects: [06-playback-controls, any future UI work on ZoneCard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optimistic UI with silent revert on API failure using Map-replace for Pinia reactivity
    - Anti-double-tap debounce (300ms busy ref) on touch/click handlers
    - Inline SVG icons (monochrome, fill=currentColor) for transport controls
    - Transport controls gated by v-if="!isOffline" — offline zones show only badge

key-files:
  created: []
  modified:
    - frontend/src/stores/zones.ts
    - frontend/src/components/ZoneCard.vue

key-decisions:
  - "Transport controls shown for all online zones (both playing and idle) — per plan spec"
  - "sendNext/sendPrevious do not apply optimistic playState (track change is async)"
  - "sendPlay/sendPause save previous playState before optimistic update, revert silently on error"
  - "300ms busy ref debounce prevents duplicate API commands on rapid taps"
  - "Play/pause 48px min touch target, skip buttons 44px — WCAG accessibility compliance"

patterns-established:
  - "Optimistic update pattern: save old value, apply new, fetch, revert on catch"
  - "Map-replace reactivity: _zones.value = new Map(_zones.value) after any mutation"

requirements-completed: [CTRL-01, CTRL-02]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 6 Plan 01: Transport Controls Summary

**Play/pause, skip-previous, and skip-next buttons added to ZoneCard with optimistic UI, 300ms debounce, and silent revert on API failure**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T18:24:34Z
- **Completed:** 2026-02-27T18:25:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added four async transport actions to useZonesStore: sendPlay, sendPause, sendNext, sendPrevious
- sendPlay/sendPause use optimistic UI — icon updates instantly, silently reverts on API failure
- ZoneCard now shows a transport button row for all online zones (both playing and idle)
- Buttons use 300ms debounce to prevent duplicate commands on rapid taps
- Offline zones still show only the Offline badge — transport controls fully hidden

## Task Commits

Each task was committed atomically:

1. **Task 1: Add transport command actions to zones store** - `8503345` (feat)
2. **Task 2: Add transport control buttons to ZoneCard** - `4371525` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `frontend/src/stores/zones.ts` - Added sendPlay, sendPause, sendNext, sendPrevious async actions with optimistic UI and revert logic
- `frontend/src/components/ZoneCard.vue` - Added transport controls section, useZonesStore import, busy ref, debounce wrapper, and handler functions

## Decisions Made

- Transport controls shown for all online zones (both playing and idle) per user decision in plan
- sendNext/sendPrevious make no optimistic playState changes since track info arrives async via WebSocket
- Inline SVG icons (monochrome, fill=currentColor) consistent with existing source indicator icons
- Play/pause uses 48px min-height/width; skip buttons use 44px — WCAG touch target compliance

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Transport controls functional for all online zones
- Optimistic UI pattern established for future volume/mute controls
- Ready for Phase 6 Plan 02 (if applicable — volume controls or other playback features)

## Self-Check: PASSED

- FOUND: frontend/src/stores/zones.ts
- FOUND: frontend/src/components/ZoneCard.vue
- FOUND: .planning/phases/06-playback-controls/06-01-SUMMARY.md
- FOUND commit 8503345 (Task 1: zones store transport actions)
- FOUND commit 4371525 (Task 2: ZoneCard transport buttons)
- FOUND commit 350fece (docs: plan metadata)
- TypeScript check passes (vue-tsc --noEmit exits 0)

---
*Phase: 06-playback-controls*
*Completed: 2026-02-27*
