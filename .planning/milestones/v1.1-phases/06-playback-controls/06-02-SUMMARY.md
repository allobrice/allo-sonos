---
phase: 06-playback-controls
plan: 02
subsystem: ui
tags: [vue, pinia, volume-slider, mute-toggle, optimistic-ui, debounce, svg-icons, range-input]

# Dependency graph
requires:
  - phase: 06-playback-controls
    plan: 01
    provides: Transport controls and zones store with sendPlay/sendPause/sendNext/sendPrevious
provides:
  - Volume and mute actions (sendVolume, sendMute, sendUnmute) in zones store
  - Volume slider with debounced API calls and accent-green fill on ZoneCard
  - Mute toggle with context-aware speaker icon (muted/low/medium/high) on ZoneCard
affects: [06-playback-controls, any future UI work on ZoneCard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Range input with inline linear-gradient style for WebKit filled-portion (accent-green)
    - localVolume ref decoupled from store — tracks slider position during drag
    - dragging ref gates WebSocket sync — prevents slider jump while user is interacting
    - Dual-event volume handling: @input debounced 250ms, @change immediate on release
    - speakerIconPath computed from mute state + localVolume level (muted/low/medium/high)

key-files:
  created: []
  modified:
    - frontend/src/stores/zones.ts
    - frontend/src/components/ZoneCard.vue

key-decisions:
  - "localVolume ref decouples slider from store — prevents jarring jumps during drag"
  - "Dual-event approach: @input fires during drag (debounced 250ms), @change fires on release (immediate)"
  - "speakerIconPath uses localVolume not zone.volume — icon reflects slider position during drag"
  - "Volume row uses v-if=!isOffline consistent with transport controls — offline zones show nothing"
  - "inline linear-gradient on slider element for WebKit filled portion (CSS pseudo-element not sufficient)"

patterns-established:
  - "Volume debounce: setTimeout/clearTimeout closure, 250ms, cleared on @change"
  - "dragging ref gates WebSocket watch sync — localVolume not updated while user drags"

requirements-completed: [CTRL-03, CTRL-04]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 6 Plan 02: Volume and Mute Controls Summary

**Volume slider with accent-green fill and debounced API calls, plus mute toggle with four-state speaker icon, added to ZoneCard completing all playback controls**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T18:28:19Z
- **Completed:** 2026-02-27T18:30:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added three async volume/mute actions to useZonesStore: sendVolume, sendMute, sendUnmute
- All three follow established optimistic-update + silent-revert pattern with Map-replace reactivity
- ZoneCard now shows a volume row below transport controls for all online zones
- Volume slider filled portion uses --color-accent-green via inline linear-gradient (WebKit compatible)
- Slider tracks finger in real-time via localVolume ref; debounced 250ms API calls during drag, immediate on release
- Mute toggle renders context-aware SVG speaker icon: muted, low (1-33), medium (34-66), high (67-100)
- WebSocket zone.volume updates sync to slider when user is not dragging (dragging ref guard)
- Offline zones have no volume row — consistent with transport controls gate

## Task Commits

Each task was committed atomically:

1. **Task 1: Add volume and mute actions to zones store** - `a263cdd` (feat)
2. **Task 2: Add volume slider and mute toggle to ZoneCard** - `aae018e` (feat)

## Files Created/Modified

- `frontend/src/stores/zones.ts` - Added sendVolume, sendMute, sendUnmute async actions with optimistic UI, REST API calls, and silent revert on failure
- `frontend/src/components/ZoneCard.vue` - Added volume-row template section, localVolume/dragging/speakerIconPath state, handleVolumeInput/handleVolumeCommit/handleMuteToggle handlers, and volume/mute CSS styles

## Decisions Made

- localVolume ref decoupled from store prevents jarring slider jumps during drag
- Dual-event approach: @input fires continuously (debounced 250ms), @change fires on mouse/touch release (immediate, clears pending debounce)
- speakerIconPath computed uses localVolume not zone.volume so icon reflects slider position in real time during drag
- Inline linear-gradient on the slider element handles WebKit filled-portion since ::-webkit-slider-progress is not supported
- Volume row v-if="!isOffline" is consistent with transport controls gating

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All playback controls complete: play/pause, skip prev, skip next, volume, mute
- Phase 6 fully implemented — ZoneCard is feature-complete for v1.1 milestone
- Both CTRL-03 and CTRL-04 requirements fulfilled

## Self-Check: PASSED

- FOUND: frontend/src/stores/zones.ts
- FOUND: frontend/src/components/ZoneCard.vue
- FOUND commit a263cdd (Task 1: zones store volume/mute actions)
- FOUND commit aae018e (Task 2: ZoneCard volume slider and mute toggle)
- TypeScript check passes (vue-tsc --noEmit exits 0)
- ZoneCard template contains .volume-row with .mute-btn and .volume-slider
- zones.ts exports sendVolume, sendMute, sendUnmute

---
*Phase: 06-playback-controls*
*Completed: 2026-02-27*
