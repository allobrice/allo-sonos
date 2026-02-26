---
phase: 01-backend-foundation
plan: 02
subsystem: infra
tags: [fastify, typescript, sonos, ssdp, soap, upnp, discovery, registry, rest-api]

# Dependency graph
requires:
  - 01-01 (Fastify scaffold, @svrooij/sonos installed, direct SOAP confirmed)
provides:
  - SSDP speaker discovery via @svrooij/sonos SonosManager.InitializeWithDiscovery(5)
  - Manual IP fallback via SONOS_SPEAKER_IPS env var
  - In-memory SpeakerRegistry with coordinator identification
  - GET /speakers REST endpoint returning full speaker list
  - POST /speakers/:id/command REST endpoint with transport + rendering command support
  - INFRA-04 fully satisfied
affects:
  - Phase 2+ (WebSocket push, playback state) — consume fastify.speakers registry

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: SSDP-first with manual IP fallback — discoverSpeakers() returns empty array (degraded mode) instead of throwing"
    - "Pattern: SpeakerRegistry.getCoordinator(uuid) for transport command routing — never send play/pause/stop to zone members"
    - "Pattern: Direct SOAP fetch to http://{ip}:1400/MediaRenderer/AVTransport/Control for transport commands"
    - "Pattern: Direct SOAP fetch to http://{ip}:1400/MediaRenderer/RenderingControl/Control for volume/mute"
    - "Pattern: fastify.decorate() for sonosDevices Map (UUID->SonosDevice) — raw device references for IP lookup"

key-files:
  created:
    - backend/src/services/discovery.ts
    - backend/src/services/registry.ts
    - backend/src/plugins/sonos.ts
    - backend/src/routes/speakers.ts
  modified:
    - backend/src/app.ts

key-decisions:
  - "Direct SOAP for all commands — @svrooij/sonos command API confirmed broken on real hardware (plan 01-01 spike)"
  - "Coordinator routing enforced in registry.getCoordinator() — transport commands always go to zone group coordinator"
  - "Degraded mode on discovery failure — empty array returned, server starts without speakers rather than crashing"
  - "sonosDevices Map decorated on fastify — raw SonosDevice objects stored for IP access (Host property)"

# Metrics
duration: ~10 min
completed: 2026-02-26
---

# Phase 1 Plan 02: Discovery Service + Speaker Registry + REST API Summary

**SSDP discovery + manual IP fallback + in-memory speaker registry + GET /speakers + POST /speakers/:id/command using direct SOAP to port 1400 — INFRA-04 complete**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-26T15:42Z
- **Completed:** 2026-02-26T15:53Z
- **Tasks:** 2 (both auto-executed, no checkpoints)
- **Files created:** 4 (discovery.ts, registry.ts, sonos.ts, speakers.ts)
- **Files modified:** 1 (app.ts)

## Accomplishments

- SSDP discovery via `@svrooij/sonos` `SonosManager.InitializeWithDiscovery(5)` with 5s timeout
- Manual IP fallback from `SONOS_SPEAKER_IPS` env var using `InitializeFromDevice` (discovers all speakers from one seed IP)
- `SpeakerRegistry` class with `getCoordinator(uuid)` — critical for correct transport command routing
- GET /speakers returning all speakers with JSON schema validation
- POST /speakers/:id/command routing transport commands to coordinator, rendering commands directly
- Direct SOAP calls to port 1400 for all Sonos commands (play, pause, stop, next, previous, volume, mute, unmute)
- Structured error responses: 400 unknown command, 404 unknown speaker, 502 SOAP failure

## Task Commits

1. **Task 1: Discovery service + speaker registry + Sonos plugin** — `04ff2fb` (feat)
2. **Task 2: Speaker REST endpoints** — `1a0839b` (feat)

## Files Created/Modified

- `backend/src/services/discovery.ts` — `discoverSpeakers(manualIps?)`: SSDP-first, manual fallback, degraded mode on total failure
- `backend/src/services/registry.ts` — `SpeakerRegistry` class: `populate()`, `getAll()`, `getById()`, `getCoordinator()`, `clear()`, `count`
- `backend/src/plugins/sonos.ts` — Fastify plugin: calls discovery, populates registry, decorates `fastify.speakers` + `fastify.sonosDevices`
- `backend/src/routes/speakers.ts` — GET /speakers (JSON schema validated), POST /speakers/:id/command (SOAP dispatch)
- `backend/src/app.ts` — Added `sonosPlugin` and `speakerRoutes` registrations (envPlugin → sonosPlugin → healthRoutes → speakerRoutes)

## Decisions Made

- **Direct SOAP for all commands:** Confirmed from Plan 01-01 spike — `@svrooij/sonos` command API broken at runtime. All commands implemented as `fetch` POST to `http://{ip}:1400/MediaRenderer/AVTransport/Control` or `RenderingControl/Control`.
- **Coordinator routing in registry:** `SpeakerRegistry.getCoordinator(uuid)` always returns the zone group coordinator. Transport commands (play/pause/stop/next/previous) go to coordinator; rendering commands (volume/mute/unmute) go directly to target speaker.
- **Degraded mode:** `discoverSpeakers()` never throws — returns empty array and logs error. Server starts without speakers, `GET /speakers` returns `[]`, commands return 404. No crash on startup.
- **sonosDevices Map on fastify:** Raw `SonosDevice` objects stored by UUID for IP address access. Commands use `device.Host` to construct SOAP URL. The map is co-located with the registry for clean separation of concerns.

## Verification Results

All checks passed in dev environment (no Sonos speakers on network):

| Check | Result |
|-------|--------|
| `npm run build` | PASS — zero TypeScript errors |
| GET /speakers returns 200 + `[]` | PASS |
| POST /speakers/fake-uuid/command → 404 | PASS |
| POST /speakers/uuid/command {command: 'invalid'} → 400 | PASS |

Network-bound checks (require real Sonos hardware):
- SSDP discovery logs 3 speakers (Cuisine, Openspace Haut, Openspace Bas)
- POST /speakers/{uuid}/command {command: 'pause'} → 200 and speaker pauses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SonosDevice import path**

- **Found during:** Task 1 compilation
- **Issue:** Initially imported `SonosDevice` type from deep path `@svrooij/sonos/lib/sonos-device.js` which caused `TS2709: Cannot use namespace 'SonosDevice' as a type` error. The deep path export is a CommonJS namespace, not a proper ESM type.
- **Fix:** Changed to `import { SonosDevice } from '@svrooij/sonos'` using the package's main index export which correctly exposes the class type.
- **Files modified:** `backend/src/services/discovery.ts`, `backend/src/plugins/sonos.ts`
- **Commit:** Part of `04ff2fb`

## Self-Check: PASSED

- `backend/src/services/discovery.ts` — FOUND (created in 04ff2fb)
- `backend/src/services/registry.ts` — FOUND (created in 04ff2fb)
- `backend/src/plugins/sonos.ts` — FOUND (created in 04ff2fb)
- `backend/src/routes/speakers.ts` — FOUND (created in 04ff2fb, updated in 1a0839b)
- `backend/src/app.ts` — FOUND (modified in 04ff2fb)
- Commit `04ff2fb` confirmed in git log
- Commit `1a0839b` confirmed in git log

---
*Phase: 01-backend-foundation*
*Completed: 2026-02-26*
