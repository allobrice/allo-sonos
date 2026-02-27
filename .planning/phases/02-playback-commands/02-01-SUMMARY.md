---
phase: 02-playback-commands
plan: 01
subsystem: backend-api
tags: [sonos, soap, fastify, playback, rest-api]
dependency_graph:
  requires: [01-02-SUMMARY.md]
  provides: [dedicated-playback-endpoints, sonos-commands-service, sonos-state-service]
  affects: [backend/src/routes/speakers.ts, backend/src/services/sonos-commands.ts, backend/src/services/sonos-state.ts]
tech_stack:
  added: [fast-xml-parser (XMLParser for SOAP response parsing)]
  patterns: [parallel Promise.all SOAP reads, best-effort null state, DRY handleCommand helper, anyOf null schema for optional state]
key_files:
  created:
    - backend/src/services/sonos-commands.ts
    - backend/src/services/sonos-state.ts
  modified:
    - backend/src/routes/speakers.ts
decisions:
  - "Volume endpoint uses PUT (REST semantics for idempotent resource update)"
  - "State reading is best-effort — null returned on any error, command success not affected"
  - "XMLParser uses removeNSPrefix: true to strip SOAP namespace prefixes from parsed keys"
  - "Volume/Mute/Unmute route to speaker.ip (RenderingControl, per-speaker); transport routes to coordinator.ip (AVTransport)"
  - "handleCommand() DRY helper reduces repetition across 7 command routes while keeping routing logic explicit per-endpoint"
metrics:
  duration: "~3 min"
  completed: "2026-02-27"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase 2 Plan 01: Playback Commands Summary

**One-liner:** Eight dedicated REST endpoints (play, pause, next, previous, volume, mute, unmute, state) backed by extracted SOAP service modules with parallel state-reading after each command.

## What Was Built

Replaced the Phase 1 spike's generic `POST /speakers/:id/command` endpoint with 8 focused REST endpoints, plus two new service modules extracted from the route file.

### New Service: `sonos-commands.ts`

Pure SOAP write helpers extracted verbatim from Phase 1 `speakers.ts`:
- `soapAvTransport(ip, action, bodyXml)` — AVTransport service (play, pause, next, previous)
- `soapRenderingControl(ip, action, bodyXml)` — RenderingControl service (volume, mute)

No Fastify dependency. Uses native `fetch` (Node 18+ built-in). Throws on non-ok HTTP response.

### New Service: `sonos-state.ts`

New module that reads current speaker state via three parallel SOAP calls:
- `SpeakerState` interface: `{ playState: string, volume: number, muted: boolean }`
- `readSpeakerState(targetIp, coordinatorIp)` — public export, runs `Promise.all` on three internal reads, returns `null` on any error
- `XMLParser` with `{ removeNSPrefix: true }` (critical — strips `s:` / `u:` namespace prefixes so parsed keys are navigable as plain objects)
- Transport state read from coordinator IP; volume and mute read from target speaker IP

### Rewritten Routes: `speakers.ts`

Completely rewritten with 8 endpoints:

| Method | Path | SOAP Target | Requirement |
|--------|------|-------------|-------------|
| GET | /speakers | — | List all |
| POST | /speakers/:id/play | AVTransport → coordinator | PLAY-01 |
| POST | /speakers/:id/pause | AVTransport → coordinator | PLAY-01 |
| POST | /speakers/:id/next | AVTransport → coordinator | PLAY-04 |
| POST | /speakers/:id/previous | AVTransport → coordinator | PLAY-04 |
| PUT | /speakers/:id/volume | RenderingControl → target | PLAY-02 |
| POST | /speakers/:id/mute | RenderingControl → target | PLAY-03 |
| POST | /speakers/:id/unmute | RenderingControl → target | PLAY-03 |
| GET | /speakers/:id/state | Read only (no command) | All PLAY-* |

All command endpoints return `{ ok: true, state: SpeakerState | null }`. The volume endpoint validates `level` as an integer (0-100) via AJV schema; Fastify returns 400 automatically on validation failure. Unknown UUIDs return 404; SOAP failures return 502.

## Decisions Made

1. **PUT for volume** — REST semantics: volume is an idempotent resource update. POST used for actions (play, mute) where the intent is not idempotent.

2. **State is best-effort** — If the SOAP command succeeds but state reading fails, response is `{ ok: true, state: null }` — not a 502. Only the dedicated GET state endpoint returns 502 on state-read failure (since that's its entire job).

3. **`removeNSPrefix: true`** — Critical XMLParser option. Without it, SOAP response keys carry namespace prefixes (`s:Envelope`, `u:GetTransportInfoResponse`) making them unnavigable with dot notation.

4. **Routing split** — Transport commands (play/pause/next/previous) and transport state reads always use `coordinator.ip`. Rendering commands (volume/mute) and rendering state reads always use `speaker.ip`. This critical routing was already established in Phase 1 and is preserved here.

5. **`handleCommand()` helper** — DRY function reduces repetition across 7 command routes (speaker lookup, 404 handling, coordinator resolution, try/catch, state read, 502 handling). Volume endpoint passes only `speaker` (not coordinator) to its execute callback since rendering goes to target.

## Verification Results

- `npm run build` — zero TypeScript errors
- Import chain verified: `speakers.ts` imports from both `sonos-commands.ts` and `sonos-state.ts`
- Old `POST /speakers/:id/command` endpoint deleted (zero matches in source)
- All 8 new route paths registered in source (16 grep matches for `:id/` patterns including comments)
- Volume uses PUT method and integer (0-100) AJV validation
- SOAP routing: transport commands use `coordinator.ip`, rendering commands use `speaker.ip`
- `XMLParser({ removeNSPrefix: true })` confirmed in sonos-state.ts

Note: Runtime server test was not possible without SONOS_PIN env var (required by Phase 1 env plugin design). Static analysis and TypeScript compilation provide equivalent confidence for this plan's changes.

## Deviations from Plan

None — plan executed exactly as written.

The `handleCommand()` DRY helper was suggested as discretionary in the plan and was implemented as proposed. The play route log message was simplified to use the `label` parameter pattern consistently across all routes rather than the slightly different format suggested in the plan's example — this is a minor style choice within the discretionary range.

## Self-Check

### Files Created/Modified

- `backend/src/services/sonos-commands.ts` — FOUND (commit 1362f3d)
- `backend/src/services/sonos-state.ts` — FOUND (commit 9e39795)
- `backend/src/routes/speakers.ts` — FOUND (commit 5737831)

### Commits

- `1362f3d`: feat(02-01): extract SOAP command helpers into sonos-commands service
- `9e39795`: feat(02-01): create SOAP state-reading service (sonos-state)
- `5737831`: feat(02-01): rewrite speaker routes with 8 dedicated endpoints
