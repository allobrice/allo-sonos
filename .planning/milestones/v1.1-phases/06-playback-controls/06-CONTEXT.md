# Phase 6: Playback Controls - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add playback controls directly on each zone card in the dashboard. Users can play/pause, skip tracks, adjust volume, and toggle mute on any zone without navigating away. The ZoneCard component already displays zone info (name, source, track); this phase adds interactive controls below that info.

</domain>

<decisions>
## Implementation Decisions

### Control layout
- Controls always visible on each card (no hover/tap reveal)
- Transport buttons (prev, play/pause, next) placed as a row below the track info (title/artist)
- Volume slider placed below the transport buttons
- Structure: header → now-playing info → transport controls → volume row
- Play/pause button centered and larger than skip prev/next buttons (visual hierarchy)

### Volume slider
- Thin track (2-3px) with round draggable handle — Spotify/Apple Music style
- Speaker icon to the left of the slider acts as mute toggle
- Speaker icon changes based on volume level (muted, low, medium, high)
- Filled portion of the slider uses --color-accent-green (consistent with active playback indicator)
- No numeric percentage displayed — slider alone is sufficient

### Visual states
- Offline zones: controls completely hidden, only "Offline" badge shown (current behavior preserved)
- Idle zones (online, not playing): all controls visible — user can resume playback directly
- Transport icon color: --color-text-primary (white on dark background), consistent with existing design
- State change is immediate on tap (optimistic) — play icon switches to pause instantly

### Feedback & responsiveness
- Optimistic UI for transport (play/pause, skip): icon/state changes immediately, reverts on API failure
- Optimistic UI for volume: slider follows finger in real-time during drag, API calls debounced, WebSocket confirms final position after release
- Error handling: silent revert to previous state, no toast or error message
- Anti-double-tap: buttons ignored for ~300ms after a tap to prevent duplicate commands (no visual change, just debounce)

### Claude's Discretion
- Exact icon set (SVG paths for play, pause, skip, speaker)
- Exact sizing and spacing of buttons and slider
- Debounce timing for volume API calls
- Touch target sizes for mobile
- Transition/animation details for state changes

</decisions>

<specifics>
## Specific Ideas

- Play/pause should feel like a remote control — instant, no lag, always ready
- Volume slider inspired by Spotify's clean slider aesthetic
- The card should remain compact despite adding controls — avoid making it too tall

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-playback-controls*
*Context gathered: 2026-02-27*
