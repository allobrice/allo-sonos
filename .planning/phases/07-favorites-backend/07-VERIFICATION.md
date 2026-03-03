---
phase: 07-favorites-backend
verified: 2026-03-03T00:00:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase 7: Favorites Backend Verification Report

**Phase Goal:** L'API backend expose les favoris Sonos et permet de lancer un favori sur une zone
**Verified:** 2026-03-03
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                          | Status     | Evidence                                                                                                  |
|----|----------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------|
| 1  | GET /api/favorites returns a JSON array with title, type, uri, and albumArtURI                                 | VERIFIED   | Route defined in favorites.ts:69; schema enforces all four fields as required in response 200              |
| 2  | POST /api/speakers/:id/play-favorite accepts {uri, type} and starts playback on target zone                    | VERIFIED   | Route defined in favorites.ts:117; body schema requires uri+type; calls SetAVTransportURI then Play        |
| 3  | Favorites are fetched via ContentDirectory SOAP Browse FV:2                                                    | VERIFIED   | sonos-favorites.ts:43-66; SOAP envelope targets `http://${ip}:1400/MediaServer/ContentDirectory/Control`, ObjectID=FV:2 |
| 4  | Unknown type returns type 'other' — no favorites filtered or hidden                                            | VERIFIED   | classifyFavoriteType() at line 30-36: unmatched upnpClass returns 'other'; all items processed in items.map() |
| 5  | Favorites cached in memory with 5-minute TTL; ?refresh=true bypasses cache                                    | VERIFIED   | TTL=300_000 at line 21; forceRefresh path in fetchFavorites:143; route passes `request.query.refresh === 'true'` |
| 6  | play-favorite response follows command pattern: {ok, state: {playState, volume, muted}}                        | VERIFIED   | favorites.ts:154-156; commandResponseSchema matches speakers.ts pattern; returns `{ ok: true, state }`    |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact                                        | Expected                                              | Status     | Details                                                                 |
|-------------------------------------------------|-------------------------------------------------------|------------|-------------------------------------------------------------------------|
| `backend/src/services/sonos-favorites.ts`       | ContentDirectory SOAP Browse, parsing, TTL cache      | VERIFIED   | 165 lines; exports `Favorite` interface and `fetchFavorites`; substantive implementation |
| `backend/src/routes/favorites.ts`               | GET /favorites and POST /speakers/:id/play-favorite   | VERIFIED   | 167 lines; two real routes with schemas, error handling, and coordinator routing |
| `backend/src/app.ts`                            | Registration of favorites routes plugin               | VERIFIED   | Line 11: import; line 45: `await fastify.register(favoritesRoutes, { prefix: '/api' })` |

All artifacts exist and are substantive (no placeholders, no empty implementations).

---

### Key Link Verification

| From                           | To                                    | Via                                  | Status      | Details                                                                                        |
|--------------------------------|---------------------------------------|--------------------------------------|-------------|------------------------------------------------------------------------------------------------|
| `routes/favorites.ts`          | `services/sonos-favorites.ts`         | `import fetchFavorites`              | WIRED       | Line 2: import; line 103: `await fetchFavorites(speakers, forceRefresh)` — imported and called |
| `routes/favorites.ts`          | `services/sonos-commands.ts`          | `import soapAvTransport`             | WIRED       | Line 3: import; lines 145+152: called twice per play-favorite (SetAVTransportURI + Play)       |
| `routes/favorites.ts`          | `routes/speakers.ts`                  | handleCommand pattern replicated     | WIRED       | Pattern correctly replicated inline (speaker lookup → coordinator → execute → readSpeakerState → {ok, state}); handleCommand is not exported from speakers.ts so inline replication is the correct approach per PLAN |
| `app.ts`                       | `routes/favorites.ts`                 | `fastify.register(favoritesRoutes)`  | WIRED       | Line 11: import; line 45: registered with prefix '/api'                                         |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                  | Status    | Evidence                                                                     |
|-------------|-------------|--------------------------------------------------------------|-----------|------------------------------------------------------------------------------|
| FAV-04      | 07-01-PLAN  | Les favoris se chargent depuis le système Sonos (ContentDirectory SOAP) | SATISFIED | SOAP Browse FV:2 implemented in sonos-favorites.ts; FAV-04 marked `[x]` in REQUIREMENTS.md |

No orphaned requirements: REQUIREMENTS.md traceability table maps only FAV-04 to Phase 7, and the PLAN claims exactly FAV-04. Complete coverage.

---

### Anti-Patterns Found

No anti-patterns detected in the modified files.

| File                                          | Pattern checked                        | Result  |
|-----------------------------------------------|----------------------------------------|---------|
| `backend/src/services/sonos-favorites.ts`     | TODO/FIXME/placeholder comments        | None    |
| `backend/src/services/sonos-favorites.ts`     | Empty implementations                  | None — `return []` guards are legitimate (no speakers, empty DIDL-Lite) |
| `backend/src/routes/favorites.ts`             | TODO/FIXME/placeholder comments        | None    |
| `backend/src/routes/favorites.ts`             | Stub handlers (console.log only, etc.) | None    |
| `backend/src/app.ts`                          | favoritesRoutes import and registration| Present and wired |

---

### Human Verification Required

#### 1. GET /api/favorites against live Sonos network

**Test:** `curl http://localhost:3000/api/favorites` with Sonos speakers online
**Expected:** JSON array containing favorites with title, type (station/playlist/album/other), uri, and albumArtURI (string or null)
**Why human:** Requires live Sonos hardware; SOAP parsing and DIDL-Lite handling cannot be verified statically

#### 2. Favorites cache behavior

**Test:** Call GET /api/favorites twice within 5 minutes; second call should return instantly (no SOAP network round-trip)
**Expected:** Second response is immediate; `?refresh=true` triggers a new SOAP call
**Why human:** Module-level cache state is runtime behavior; cannot verify timing statically

#### 3. POST /api/speakers/:id/play-favorite playback start

**Test:** `curl -X POST http://localhost:3000/api/speakers/{uuid}/play-favorite -H 'Content-Type: application/json' -d '{"uri":"x-sonosapi-stream:...","type":"station"}'`
**Expected:** Music starts playing on that zone; response is `{ok: true, state: {playState: "PLAYING", volume: N, muted: false}}`
**Why human:** Requires live Sonos speakers and a valid favorite URI to confirm actual playback

---

### Roadmap Wording Note

ROADMAP.md Success Criterion #2 reads `POST /zones/:id/play-favorite`, but the PLAN frontmatter and implementation consistently use `POST /speakers/:id/play-favorite`. The `/speakers/` prefix is correct — it is consistent with all other command routes (`/speakers/:id/play`, `/speakers/:id/pause`, etc.) and the existing API contract. The ROADMAP contains a wording error (using "zones" colloquially instead of the actual resource name). This is not an implementation gap.

---

### TypeScript Compilation

`cd backend && npx tsc --noEmit` — exits clean with no output (verified during verification run).

### Commits

Both commits documented in SUMMARY.md are confirmed present in git history:
- `68cf03b` — feat(07-01): add Sonos favorites service with ContentDirectory SOAP Browse
- `8c6c707` — feat(07-01): add favorites routes and register in app.ts

---

## Summary

Phase 7 goal is fully achieved. The backend exposes two working endpoints:

- `GET /api/favorites` — fetches Sonos favorites via ContentDirectory SOAP Browse FV:2, returns them as a typed JSON array, caches for 5 minutes with `?refresh=true` bypass
- `POST /api/speakers/:id/play-favorite` — accepts `{uri, type}`, routes to coordinator, issues SetAVTransportURI + Play, returns `{ok, state}`

All three artifacts are substantive implementations (no stubs). All four key links are wired (import + call-site). FAV-04 is satisfied. TypeScript compiles clean. No anti-patterns found.

Three items require human verification with live hardware: favorites list from real Sonos network, cache timing, and actual playback confirmation.

---

_Verified: 2026-03-03_
_Verifier: Claude (gsd-verifier)_
