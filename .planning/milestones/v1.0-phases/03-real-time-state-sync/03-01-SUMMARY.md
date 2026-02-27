---
phase: 03-real-time-state-sync
plan: 01
subsystem: api
tags: [websocket, fastify, state-cache, debounce, sonos, real-time]

# Dependency graph
requires:
  - phase: 02-playback-commands
    provides: Speaker registry, SpeakerState service, direct SOAP command layer
  - phase: 01-backend-foundation
    provides: Fastify app scaffolding, plugin registration pattern, env/sonos plugins

provides:
  - ZoneState interface with 11 locked fields
  - StateCache class with per-UUID 300ms debounced broadcast
  - parseSource() helper mapping Sonos URIs to spotify/deezer/tunein/library
  - WebSocket Fastify plugin with fastify.broadcast() and fastify.stateCache decorators
  - GET /ws route that pushes full state snapshot on connect
  - @fastify/websocket integration with correct pre-route registration order

affects:
  - 03-02-gena-event-processing
  - 03-03-frontend-websocket

# Tech tracking
tech-stack:
  added:
    - "@fastify/websocket ^11.2.0 — WebSocket upgrade support for Fastify"
    - "@types/ws ^8.18.1 — TypeScript types for ws WebSocket library"
  patterns:
    - "Broadcast-callback injection: StateCache receives broadcastFn in constructor — no circular dependency with plugin"
    - "Per-UUID debounce: clearTimeout/setTimeout pattern with Map<string, ReturnType<typeof setTimeout>>"
    - "Synchronous WS handler: socket.on('close') attached before any await — @fastify/websocket requirement"
    - "Plugin registration order: @fastify/websocket must be registered before routes to intercept HTTP upgrade requests"
    - "WebSocket.OPEN as literal 1 — avoids importing ws constant just for numeric comparison"

key-files:
  created:
    - backend/src/services/state-cache.ts
    - backend/src/plugins/websocket.ts
    - backend/src/routes/ws.ts
  modified:
    - backend/package.json
    - backend/src/app.ts

key-decisions:
  - "broadcastFn injected via StateCache constructor — decouples cache from WS plugin, avoids circular dependency"
  - "300ms debounce per UUID — multiple rapid GENA patches (e.g., volume + mute) collapse into single broadcast"
  - "Partial<Omit<ZoneState, 'uuid' | 'name'>> in patch() — prevents accidentally overwriting identity fields"
  - "ReturnType<typeof setTimeout> instead of NodeJS.Timeout — broader TS compatibility across environments"
  - "GET /ws is server-to-client only — clients issue commands via REST, no incoming WS message handling"
  - "stateCache.clearTimers() on fastify.close() — prevents memory leaks from dangling debounce timers"

patterns-established:
  - "Snapshot-on-connect: client always gets full state on WS connect, no polling needed"
  - "State preserved on unreachable: markReachable(false) preserves last known state for display continuity"
  - "lastSeen auto-updated: every patch() and markReachable(true) refreshes lastSeen timestamp"

requirements-completed: [INFRA-03]

# Metrics
duration: 8min
completed: 2026-02-27
---

# Phase 3 Plan 01: Real-Time State Sync Infrastructure Summary

**In-memory ZoneState cache with 300ms per-UUID debounce, @fastify/websocket plugin with broadcast decorator, and GET /ws snapshot-on-connect route — foundation for GENA event wiring in Plan 03-02.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-27T15:36:11Z
- **Completed:** 2026-02-27T15:44:00Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- ZoneState interface (11 fields: uuid, name, playState, volume, muted, title, artist, album, source, reachable, lastSeen) and StateCache class with full CRUD, debounce, and reachability tracking
- parseSource() helper correctly maps Sonos EnqueuedTransportURI strings to spotify/deezer/tunein/library/null
- WebSocket plugin registering @fastify/websocket before routes and decorating fastify.broadcast() and fastify.stateCache with onClose cleanup
- GET /ws route that synchronously sends full zone snapshot on connect and logs disconnect
- app.ts updated with correct plugin registration order (wsPlugin between sonosPlugin and routes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install WebSocket dependencies and create state cache service** - `807805e` (feat)
2. **Task 2: Create WebSocket plugin and /ws route, wire into app.ts** - `3f4c3c8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/src/services/state-cache.ts` — ZoneState interface, parseSource() helper, StateCache class with debounce
- `backend/src/plugins/websocket.ts` — Fastify plugin: @fastify/websocket registration, broadcast decorator, stateCache decorator, onClose cleanup
- `backend/src/routes/ws.ts` — GET /ws WebSocket handler: snapshot-on-connect, synchronous close handler
- `backend/package.json` — Added @fastify/websocket (dep) and @types/ws (devDep)
- `backend/src/app.ts` — Added wsPlugin (before routes) and wsRoutes imports and registrations

## Decisions Made

- broadcastFn injected via StateCache constructor — avoids circular dependency between cache and WebSocket plugin; cache is testable in isolation
- 300ms debounce per UUID — user decision from planning; multiple GENA events arriving in quick succession (e.g., volume + mute in one batch) collapse to one WS push
- GET /ws is server-to-client only — no incoming message handling; clients use REST for commands (user decision)
- WebSocket.OPEN as literal `1` — avoids importing ws constant for a single numeric comparison

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled cleanly on first attempt. npm install resolved @fastify/websocket and its transitive dependencies (ws, @types/ws) without conflict.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- State cache is ready to receive initialize() calls at startup and patch() calls from GENA event handlers
- fastify.broadcast() is wired and ready for Plan 03-02 to call after GENA events
- GET /ws will return an empty snapshot array until Plan 03-02 initialises zones at startup
- Plan 03-02 (GENA event processing) can now wire GENA subscriptions to StateCache.patch() + scheduleUpdate()

---
*Phase: 03-real-time-state-sync*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: backend/src/services/state-cache.ts
- FOUND: backend/src/plugins/websocket.ts
- FOUND: backend/src/routes/ws.ts
- FOUND: .planning/phases/03-real-time-state-sync/03-01-SUMMARY.md
- FOUND commit: 807805e (Task 1)
- FOUND commit: 3f4c3c8 (Task 2)
