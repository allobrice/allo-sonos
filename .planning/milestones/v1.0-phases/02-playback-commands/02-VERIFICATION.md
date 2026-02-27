---
phase: 02-playback-commands
verified: 2026-02-27T00:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
human_verification:
  - test: "Send POST /speakers/:id/play to a live Sonos speaker"
    expected: "Speaker begins playing, response body contains {ok: true, state: {playState: 'PLAYING', volume: N, muted: false}}"
    why_human: "Cannot verify real SOAP round-trip without hardware; TypeScript compilation and code inspection are sufficient for structural confidence"
  - test: "Send PUT /speakers/:id/volume with {level: 150} to a running server"
    expected: "HTTP 400 with AJV validation error (maximum: 100)"
    why_human: "Validation is schema-driven (AJV); confirmed in code but runtime behaviour requires a live server"
---

# Phase 2: Playback Commands Verification Report

**Phase Goal:** Every transport control (play, pause, volume, mute, skip) is available and works on any discovered zone via the API
**Verified:** 2026-02-27
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /speakers/:id/play sends AVTransport Play to the coordinator and returns {ok: true, state: {playState, volume, muted}} | VERIFIED | `speakers.ts:115–124` — `soapAvTransport(coordinator.ip, 'Play', '<Speed>1</Speed>')`, response via `handleCommand` returns `{ ok: true, state }` |
| 2 | POST /speakers/:id/pause sends AVTransport Pause to the coordinator and returns {ok: true, state} | VERIFIED | `speakers.ts:129–138` — `soapAvTransport(coordinator.ip, 'Pause', '')` via `handleCommand` |
| 3 | PUT /speakers/:id/volume with {level: N} sends RenderingControl SetVolume to the target speaker (not coordinator) and returns {ok: true, state} | VERIFIED | `speakers.ts:171–197` — `soapRenderingControl(speaker.ip, 'SetVolume', ...)`, comment explicitly notes "per-speaker rendering, NOT coordinator" |
| 4 | PUT /speakers/:id/volume rejects missing, non-numeric, or out-of-range level with 400 Bad Request | VERIFIED | `speakers.ts:176–181` — AJV schema: `{ type: 'integer', minimum: 0, maximum: 100, required: ['level'] }` |
| 5 | POST /speakers/:id/mute sends SetMute DesiredMute=1 to the target speaker and returns {ok: true, state} | VERIFIED | `speakers.ts:202–215` — `soapRenderingControl(speaker.ip, 'SetMute', '...DesiredMute>1...')` |
| 6 | POST /speakers/:id/unmute sends SetMute DesiredMute=0 to the target speaker and returns {ok: true, state} | VERIFIED | `speakers.ts:220–233` — `soapRenderingControl(speaker.ip, 'SetMute', '...DesiredMute>0...')` |
| 7 | POST /speakers/:id/next sends AVTransport Next to the coordinator and returns {ok: true, state} | VERIFIED | `speakers.ts:143–152` — `soapAvTransport(coordinator.ip, 'Next', '')` |
| 8 | POST /speakers/:id/previous sends AVTransport Previous to the coordinator and returns {ok: true, state} | VERIFIED | `speakers.ts:157–166` — `soapAvTransport(coordinator.ip, 'Previous', '')` |
| 9 | GET /speakers/:id/state returns {playState, volume, muted} by reading from the Sonos speaker via SOAP | VERIFIED | `speakers.ts:238–279` — calls `readSpeakerState(speaker.ip, coordinator.ip)`, returns state object directly; 502 if state is null |
| 10 | If a command succeeds but state reading fails, the response is {ok: true, state: null} — not a 502 | VERIFIED | `sonos-state.ts:148–150` — `readSpeakerState` catches all errors and returns `null`; `handleCommand` returns `{ ok: true, state }` with no error check on state |
| 11 | The old POST /speakers/:id/command endpoint no longer exists | VERIFIED | `grep -rn` across `backend/src/` found zero matches for `/:id/command` as a route; last commit touching it was `1a0839b` (Phase 1) |
| 12 | Unknown speaker UUID returns 404, unreachable speaker returns 502 with SOAP detail | VERIFIED | `handleCommand` (line 59–60): `getById(id)` missing → 404 `{error: 'Speaker not found', uuid: id}`; SOAP throw caught → 502 `{error: 'Command failed', detail: err.message}` |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/services/sonos-commands.ts` | SOAP write helpers — exports `soapAvTransport`, `soapRenderingControl` | VERIFIED | 57 lines; both functions exported as named exports; uses native `fetch`, throws on non-ok HTTP |
| `backend/src/services/sonos-state.ts` | SOAP read helpers — exports `SpeakerState`, `readSpeakerState` | VERIFIED | 151 lines; `XMLParser({ removeNSPrefix: true })` at module level; three internal read functions; `Promise.all` in `readSpeakerState`; returns `null` on any error |
| `backend/src/routes/speakers.ts` | 8 dedicated endpoints (play, pause, next, previous, volume, mute, unmute, state) | VERIFIED | 282 lines (min 100); 9 routes registered (GET /speakers + 8 new); all endpoint paths confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/src/routes/speakers.ts` | `backend/src/services/sonos-commands.ts` | `import { soapAvTransport, soapRenderingControl }` | WIRED | Line 2: `import { soapAvTransport, soapRenderingControl } from '../services/sonos-commands.js'`; both functions called in route handlers |
| `backend/src/routes/speakers.ts` | `backend/src/services/sonos-state.ts` | `import { readSpeakerState }` | WIRED | Line 3: `import { readSpeakerState } from '../services/sonos-state.js'`; called in `handleCommand` (line 66) and in the GET state handler (line 273) |
| `backend/src/routes/speakers.ts` | `backend/src/services/registry.ts` | `fastify.speakers.getById()` and `fastify.speakers.getCoordinator()` | WIRED | Lines 59, 62 (`handleCommand`), lines 108, 267, 270 (GET /speakers and state handlers); pattern `fastify.speakers.get(ById|Coordinator)` matched |
| `backend/src/services/sonos-state.ts` | `fast-xml-parser` | `import { XMLParser }` | WIRED | Line 1: `import { XMLParser } from 'fast-xml-parser'`; package present in `package.json` (`^5.4.1`) and installed in `node_modules` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLAY-01 | 02-01-PLAN.md | User can play/pause the current track on any zone | SATISFIED | `POST /speakers/:id/play` (line 115) and `POST /speakers/:id/pause` (line 129) registered; both use `soapAvTransport` on `coordinator.ip`; marked `[x]` in REQUIREMENTS.md |
| PLAY-02 | 02-01-PLAN.md | User can adjust volume per zone via a slider | SATISFIED | `PUT /speakers/:id/volume` (line 171); AJV validates `integer 0-100`; sends `SetVolume` to `speaker.ip`; marked `[x]` in REQUIREMENTS.md |
| PLAY-03 | 02-01-PLAN.md | User can mute/unmute any zone | SATISFIED | `POST /speakers/:id/mute` (line 202) and `POST /speakers/:id/unmute` (line 220); both send `SetMute` to `speaker.ip` with `DesiredMute 1/0`; marked `[x]` in REQUIREMENTS.md |
| PLAY-04 | 02-01-PLAN.md | User can skip to next/previous track on any zone | SATISFIED | `POST /speakers/:id/next` (line 143) and `POST /speakers/:id/previous` (line 157); both use `soapAvTransport` on `coordinator.ip`; marked `[x]` in REQUIREMENTS.md |

All 4 requirements declared in `02-01-PLAN.md` frontmatter are covered. REQUIREMENTS.md traceability table shows all four as "Complete". No orphaned requirements found — REQUIREMENTS.md maps no additional Phase 2 IDs beyond PLAY-01 through PLAY-04.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `sonos-state.ts` | 149 | `return null` | Info | Intentional — documented as best-effort state reading per design decision; `readSpeakerState` is specified to return `null` on any error, not a stub |

No TODOs, FIXMEs, placeholders, unimplemented handlers, or console.log stubs found in any of the three files.

### Human Verification Required

#### 1. Live play/pause round-trip

**Test:** With a real Sonos speaker on the network, send `POST /speakers/{uuid}/play`.
**Expected:** Speaker starts playing; response is `{"ok":true,"state":{"playState":"PLAYING","volume":N,"muted":false}}`.
**Why human:** SOAP transport round-trip to real hardware cannot be verified by static analysis. TypeScript compilation and code structure confirm the implementation is correct.

#### 2. Volume AJV rejection at runtime

**Test:** Send `PUT /speakers/fake-uuid/volume` with `{"level": 150}` to a running server.
**Expected:** HTTP 400 with AJV validation error body (maximum exceeded).
**Why human:** AJV schema enforcement requires a live Fastify instance. The schema `{ type: 'integer', minimum: 0, maximum: 100 }` is confirmed present in code but runtime rejection needs a server.

### Gaps Summary

None. All 12 must-have truths are verified. All 3 artifacts exist and are substantive (non-stub). All 4 key links are wired (imports present and functions actively called). All 4 requirements (PLAY-01 through PLAY-04) are satisfied with implementation evidence. TypeScript compilation produces zero errors. The compiled `dist/` directory contains `sonos-commands.js`, `sonos-state.js`, and an updated `speakers.js` with no trace of the old `/command` route.

---

_Verified: 2026-02-27_
_Verifier: Claude (gsd-verifier)_
