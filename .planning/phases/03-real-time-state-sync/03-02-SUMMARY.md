---
phase: 03-real-time-state-sync
plan: 02
subsystem: infra
tags: [gena, upnp, sonos, websocket, event-driven, fastify-plugin]

# Dependency graph
requires:
  - phase: 03-real-time-state-sync plan 01
    provides: StateCache with debounced broadcast, WebSocket broadcast decoration, ws route

provides:
  - GENA/UPnP event subscriptions wired from @svrooij/sonos to state cache
  - State cache hydration at startup via SOAP readSpeakerState()
  - Heartbeat poll every 30s for offline speaker detection
  - speaker_offline / speaker_online WebSocket events
  - SONOS_LISTENER_HOST env var for explicit GENA callback IP
  - Clean shutdown via CancelEvents() on all SonosDevices

affects: [04-vue-frontend, any phase using WebSocket state_changed events]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GENA subscription split: coordinator-only for transport/track/source, every speaker for volume/mute"
    - "subscribedCoordinators Set prevents duplicate event subscriptions on shared coordinators"
    - "Heartbeat as offline detection fallback — GENA events go silent on speaker disconnect"
    - "SonosEventListener.DefaultInstance.UpdateSettings for explicit GENA callback host"
    - "Pino object-style logging for unknown error args: log.warn({ err }, msg)"

key-files:
  created:
    - backend/src/plugins/gena.ts
  modified:
    - backend/src/plugins/env.ts
    - backend/src/app.ts
    - backend/docker-compose.yml

key-decisions:
  - "Track type inferred from device.Events.on callback — Track not exported from @svrooij/sonos top-level"
  - "SonosEventListener imported directly (not dynamically) — it is in the main @svrooij/sonos export"
  - "Pino log.warn uses object-first style ({ err }, msg) to avoid unknown type rejection"

patterns-established:
  - "GENA plugin depends on ['sonos', 'websocket-plugin'] — explicit Fastify plugin dependency chain"
  - "Coordinator subscription guard: if (speaker.isCoordinator && !subscribedCoordinators.has(uuid))"

requirements-completed: [INFRA-03]

# Metrics
duration: 12min
completed: 2026-02-27
---

# Phase 03 Plan 02: GENA Plugin Summary

**GENA/UPnP event pipeline complete: Sonos hardware changes push to WebSocket clients within 2s via @svrooij/sonos subscriptions, 300ms debounce, and heartbeat offline detection**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-27T15:32:00Z
- **Completed:** 2026-02-27T15:44:10Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Created gena.ts Fastify plugin (226 lines) wiring all five responsibilities: GENA host config, state hydration, event subscriptions, heartbeat, shutdown cleanup
- Subscriptions correctly split: transport/track/source on coordinators only, volume/mute on every speaker
- Heartbeat detects offline speakers within 30s and broadcasts speaker_offline/speaker_online with state recovery
- SONOS_LISTENER_HOST env var added to env schema and docker-compose for explicit GENA callback IP

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SONOS_LISTENER_HOST to env plugin and docker-compose** - `36e3c08` (feat)
2. **Task 2: Create GENA plugin with event subscriptions, state hydration, and heartbeat** - `a30ba38` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified

- `backend/src/plugins/gena.ts` - GENA plugin: startup hydration, SonosEvents subscriptions, 30s heartbeat, onClose cleanup
- `backend/src/plugins/env.ts` - Added SONOS_LISTENER_HOST optional string to schema and FastifyInstance.config type
- `backend/src/app.ts` - Registered genaPlugin after wsPlugin and before routes (step 4 in numbered sequence)
- `backend/docker-compose.yml` - Added SONOS_LISTENER_HOST= placeholder in environment section

## Decisions Made

- **Track type by inference:** The `Track` model is not exported from the `@svrooij/sonos` main entry (`lib/index.d.ts`). Rather than importing from the internal subpath, the callback parameter type is inferred from `device.Events.on(SonosEvents.CurrentTrackMetadata, (track) => ...)` via `StrongSonosEvents` interface — TypeScript resolves the type correctly.
- **SonosEventListener imported at module level:** The plan suggested a dynamic import for SonosEventListener, but it is available in the main `@svrooij/sonos` export. Static import is cleaner and avoids async import overhead.
- **Pino object-first logging for errors:** Pino's `warn(msg, ...args)` overload rejects `unknown` as `args_1` when using `%o`. Using `warn({ err }, msg)` (object-first style) is idiomatic Pino and passes TypeScript validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Track not exported from @svrooij/sonos main entry**
- **Found during:** Task 2 (Create GENA plugin)
- **Issue:** Plan imports `type { Track } from '@svrooij/sonos'` but `Track` is not in the main entry's exports — TypeScript error TS2305
- **Fix:** Removed explicit `Track` import; let TypeScript infer the callback type from `StrongSonosEvents` interface via `device.Events.on`
- **Files modified:** backend/src/plugins/gena.ts
- **Verification:** `npx tsc --noEmit` passes, build succeeds
- **Committed in:** a30ba38 (Task 2 commit)

**2. [Rule 1 - Bug] Pino logger rejects `unknown` in `%o` format string position**
- **Found during:** Task 2 (Create GENA plugin)
- **Issue:** `fastify.log.warn('[gena] Subscription error for "%s": %o', speaker.name, err)` fails — `err: unknown` is not assignable to `{} | null` in pino's overload matching
- **Fix:** Changed to object-first style: `fastify.log.warn({ err }, '[gena] Subscription error for "%s"', speaker.name)` — used in two places (SubscriptionError handler and CancelEvents catch block)
- **Files modified:** backend/src/plugins/gena.ts
- **Verification:** `npx tsc --noEmit` passes, build succeeds
- **Committed in:** a30ba38 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — TypeScript type bugs)
**Impact on plan:** Both fixes required for correct TypeScript compilation. No scope change, no behavioral difference.

## Issues Encountered

None — all issues resolved via auto-fix during task execution.

## Next Phase Readiness

- Full real-time state sync pipeline operational: Sonos event -> GENA push -> StateCache.patch() -> debounced broadcast -> WebSocket `{event: 'state_changed', data: ZoneState}`
- Phase 03 complete — ready for Phase 04 (Vue.js frontend)
- WebSocket clients connecting to GET /ws will receive initial snapshot + live state_changed events
- speaker_offline/speaker_online events available for frontend indicators

## Self-Check: PASSED

- FOUND: backend/src/plugins/gena.ts
- FOUND: backend/src/plugins/env.ts
- FOUND: backend/src/app.ts
- FOUND: backend/docker-compose.yml
- FOUND: .planning/phases/03-real-time-state-sync/03-02-SUMMARY.md
- FOUND: commit 36e3c08 (feat(03-02): add SONOS_LISTENER_HOST to env plugin and docker-compose)
- FOUND: commit a30ba38 (feat(03-02): create GENA plugin wiring Sonos events to state cache)

---
*Phase: 03-real-time-state-sync*
*Completed: 2026-02-27*
