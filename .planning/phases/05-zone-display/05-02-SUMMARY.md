---
phase: 05-zone-display
plan: "02"
subsystem: ui
tags: [vue, pinia, typescript, sonos, zones, websocket]

# Dependency graph
requires:
  - phase: 05-01
    provides: useZonesStore with ZoneState[], useWebSocket composable, ZonesView grid skeleton

provides:
  - ZoneCard.vue component with active/offline/idle state rendering
  - Monochrome source icons (Spotify, Deezer, TuneIn, Library, fallback) via inline SVG
  - ZonesView using ZoneCard for all zones in a 2-col/1-col responsive grid

affects:
  - 06-playback-controls (ZoneCard is the click target for zone selection)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Computed state flags (isPlaying, isOffline, isActive) derived from zone.playState + zone.reachable"
    - "Inline SVG icons kept under 5 lines per source for maintainability"
    - "CSS transition: opacity 0.3s ease on .zone-card for smooth online/offline state changes"

key-files:
  created:
    - frontend/src/components/ZoneCard.vue
  modified:
    - frontend/src/views/ZonesView.vue

key-decisions:
  - "Inline SVG icons chosen over Unicode/text labels for monochrome source indicators — provides better visual quality without external dependencies"
  - "isActive = isPlaying && !isOffline — accent only shown when zone is both reachable and playing"
  - "Play icon (▶) styled in --color-accent-green to reinforce active state alongside left border accent"

patterns-established:
  - "ZoneCard pattern: single zone prop, computed state flags, conditional template blocks for offline/playing/idle"
  - "Source icon pattern: v-if/v-else-if chain on zone.source with inline SVG per source type"

requirements-completed: [ZONE-01, ZONE-02, ZONE-03, ZONE-04, RT-01, RT-02, RT-03]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 5 Plan 02: ZoneCard Component Summary

**ZoneCard.vue with active/offline/idle states, monochrome inline SVG source icons, and CSS opacity transitions integrated into ZonesView responsive grid**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T17:59:39Z
- **Completed:** 2026-02-27T18:01:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- ZoneCard.vue component built: accepts `zone: ZoneState` prop, derives isPlaying/isOffline/isActive computed flags
- Three distinct visual states: active (left border in --color-accent-green + play icon), offline (opacity 0.4 + Offline badge), idle (music note + "Aucune lecture")
- Monochrome inline SVG source icons for Spotify, Deezer, TuneIn, Library; generic music note fallback for null/unknown sources
- Track title and artist truncated with text-overflow: ellipsis (no marquee/scroll)
- CSS transition: opacity 0.3s ease for smooth online/offline transitions
- ZonesView updated: zone-placeholder divs replaced with `<ZoneCard :zone="zone" />`, grid CSS unchanged from 05-01

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ZoneCard.vue component** - `aadfc06` (feat)
2. **Task 2: Replace zone-placeholder divs with ZoneCard in ZonesView** - `b8235a7` (feat)

**Plan metadata:** _(docs commit to follow)_

## Files Created/Modified

- `frontend/src/components/ZoneCard.vue` - Zone card component with active/offline/idle states, SVG source icons, and all design token CSS
- `frontend/src/views/ZonesView.vue` - Added ZoneCard import, replaced placeholder divs with ZoneCard component

## Decisions Made

- Used inline SVG icons over Unicode symbols or text labels — provides consistent monochrome rendering across browsers without external icon libraries
- Play icon (▶) colored in `--color-accent-green` rather than primary text color to create visual harmony with the left border accent
- `isActive` defined as `isPlaying && !isOffline` — ensures accent border never appears on unreachable zones even if playState is PLAYING

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ZoneCard is click-ready for Phase 6 (Playback Controls) — zone selection can be attached to the card's click handler
- Design tokens fully applied: all CSS uses var(--color-*), var(--space-*), var(--radius-*), var(--font-size-*) tokens
- TypeScript: vue-tsc passes without errors

---
*Phase: 05-zone-display*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: frontend/src/components/ZoneCard.vue
- FOUND: frontend/src/views/ZonesView.vue
- FOUND: .planning/phases/05-zone-display/05-02-SUMMARY.md
- FOUND commit: aadfc06 (feat(05-02): create ZoneCard.vue component)
- FOUND commit: b8235a7 (feat(05-02): integrate ZoneCard into ZonesView grid)
