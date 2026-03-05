---
phase: 08-favorites-ui
plan: "02"
subsystem: ui
tags: [vue, typescript, heart-button, favorites, bottom-sheet, zonecardintegration]

requires:
  - phase: 08-favorites-ui
    plan: "01"
    provides: FavoritesSheet component and useFavoritesStore with playFavorite action

provides:
  - ZoneCard with pink heart button trigger for favorites panel
  - Complete end-to-end favorites flow wired into ZoneCard

affects: []

tech-stack:
  added: []
  patterns:
    - "Heart button using absolute positioning to the left of zone-source-icon (calc(var(--space-sm) + 22px))"
    - "v-if='!isOffline' on heart button matches transport controls visibility pattern"
    - "FavoritesSheet mounted inside ZoneCard template — sheet manages its own Teleport to body"

key-files:
  created: []
  modified:
    - frontend/src/components/ZoneCard.vue

key-decisions:
  - "Heart button hidden on offline zones (v-if='!isOffline') — consistent with transport controls and volume row visibility"
  - "FavoritesSheet mounted inside ZoneCard but uses Teleport internally — no z-index layering issues"

patterns-established:
  - "showFavorites ref + toggleFavorites() pattern for sheet open/close local state in card component"

requirements-completed: [FAV-02, NAV-01, NAV-02]

duration: 1min
completed: 2026-03-03
---

# Phase 8 Plan 02: ZoneCard Heart Button Integration Summary

**Pink heart button wired into ZoneCard header, launching FavoritesSheet bottom-sheet with tap-to-play-and-close flow — completes the full favorites UI**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-03T09:48:38Z
- **Completed:** 2026-03-03T09:49:43Z
- **Tasks:** 1 auto (+ 1 human-verify checkpoint pending)
- **Files modified:** 1

## Accomplishments

- Added pink heart button (`fav-btn`) to ZoneCard header, positioned left of source icon via `position: absolute; right: calc(var(--space-sm) + 22px)`
- Heart button hidden on offline zones with `v-if="!isOffline"` — consistent with transport controls
- FavoritesSheet mounted inside ZoneCard template, receiving `visible`, `zone-name`, `zone-uuid` props and `@close` handler
- TypeScript compiles with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add heart button and FavoritesSheet to ZoneCard** - `dcc5e95` (feat)

## Files Created/Modified

- `frontend/src/components/ZoneCard.vue` — Added FavoritesSheet import, `showFavorites` ref, `toggleFavorites()` handler, heart button in header, FavoritesSheet component mount, and `.fav-btn` scoped CSS styles

## Decisions Made

- Heart button visibility follows the same `v-if="!isOffline"` pattern as transport controls and volume row — offline zones don't show interactive controls
- FavoritesSheet is mounted inside ZoneCard template but uses `<Teleport to="body">` internally, so the sheet renders above all other UI without z-index conflicts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Human Verification Status

**DEFERRED — pending next session**

Task 2 is a `checkpoint:human-verify` requiring a live Sonos environment. The user did not have access to the Sonos system on 2026-03-03. Verification is deferred to the next available session.

**Verification checklist (to complete next session):**
1. Start both backend and frontend dev servers
2. Navigate to zones dashboard — confirm each online zone card shows a pink heart icon
3. Confirm offline zone cards do NOT show the heart icon
4. Tap the heart on any online zone — confirm the bottom sheet slides up with "Favoris — {zone name}" header
5. Confirm skeleton shimmer appears briefly before favorites load
6. Confirm each favorite shows a type icon (radio/playlist/album) and title
7. Tap any favorite — confirm the sheet closes immediately
8. Confirm the zone card updates to reflect new playback (via WebSocket)
9. Re-open the sheet — confirm favorites load instantly (cached)
10. Tap backdrop — confirm sheet closes without playing anything
11. Open sheet and tap X close button — confirm sheet closes

## Next Phase Readiness

- Full favorites flow is code-complete: heart button opens sheet, tap a favorite plays and closes, backdrop/X closes without playing
- Human verification of the end-to-end flow is deferred to the next session (requires live Sonos environment)
- No further development phases planned for v1.2 Sonos Favorites milestone
- Once visual verification is confirmed, v1.2 milestone can be marked shipped

## Self-Check: PASSED

- FOUND: frontend/src/components/ZoneCard.vue (modified with heart button + FavoritesSheet)
- FOUND commit: dcc5e95 feat(08-02): add heart button and FavoritesSheet to ZoneCard

---
*Phase: 08-favorites-ui*
*Completed: 2026-03-03 (code-complete; visual verification deferred)*
