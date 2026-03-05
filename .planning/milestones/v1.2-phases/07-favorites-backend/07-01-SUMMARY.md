---
phase: 07-favorites-backend
plan: "01"
subsystem: backend
tags: [sonos, soap, favorites, cache, rest-api]
dependency_graph:
  requires: []
  provides: [GET /api/favorites, POST /api/speakers/:id/play-favorite]
  affects: [backend/src/app.ts]
tech_stack:
  added: []
  patterns: [ContentDirectory SOAP Browse FV:2, in-memory TTL cache, Fastify plugin pattern]
key_files:
  created:
    - backend/src/services/sonos-favorites.ts
    - backend/src/routes/favorites.ts
  modified:
    - backend/src/app.ts
decisions:
  - Empty metadata string for SetAVTransportURI — Sonos resolves stream/queue from URI internally
  - Use first available speaker for Browse — favorites are shared across the network
  - Stale cache returned on SOAP error rather than throwing — best-effort degraded mode
metrics:
  duration_minutes: 8
  completed_date: "2026-03-03"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 07 Plan 01: Favorites Backend Summary

**One-liner:** Sonos favorites REST API via ContentDirectory SOAP Browse FV:2 with 5-minute in-memory cache and SetAVTransportURI playback.

## What Was Built

Two new files and one modified file that expose Sonos favorites over HTTP:

**`backend/src/services/sonos-favorites.ts`** — ContentDirectory SOAP Browse service:
- Raw `fetch()` SOAP call to `http://{ip}:1400/MediaServer/ContentDirectory/Control` targeting `FV:2`
- Double-parse: outer SOAP envelope via `fast-xml-parser`, then the embedded DIDL-Lite XML string parsed a second time
- Type classification mapping `upnp:class` → `station | playlist | album | other` (unknown types exposed as `other`, never filtered)
- Handles parser edge cases: single-item array normalisation, `res` as object with `#text`
- Module-level in-memory cache with 5-minute TTL; stale cache returned on SOAP error as fallback

**`backend/src/routes/favorites.ts`** — Fastify plugin with two routes:
- `GET /api/favorites` — returns all favorites from cache or fresh SOAP Browse; `?refresh=true` bypasses cache; 502 on SOAP failure with no cache
- `POST /api/speakers/:id/play-favorite` — replicates the `handleCommand` pattern inline: speaker lookup, coordinator routing, `SetAVTransportURI` + `Play`, `readSpeakerState`, returns `{ok, state}`; 404/502 error handling
- `escapeXml()` helper applied to URI before SOAP embedding (handles `&` in stream URIs)

**`backend/src/app.ts`** — Added import and registration:
```typescript
import favoritesRoutes from './routes/favorites.js'
await fastify.register(favoritesRoutes, { prefix: '/api' })
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Empty `CurrentURIMetaData` in SetAVTransportURI | Sonos resolves stream/queue from the URI itself; no metadata template needed |
| Use first speaker from registry for Browse | Favorites are network-wide; any reachable speaker returns the same FV:2 list |
| Stale cache on SOAP error | Graceful degradation — avoids cascading 502s when speakers are temporarily unreachable |
| Inline handleCommand pattern (not extracted) | `handleCommand` is not exported from speakers.ts; replicating was simpler than refactoring for one new route |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 68cf03b | feat(07-01): add Sonos favorites service with ContentDirectory SOAP Browse |
| 2 | 8c6c707 | feat(07-01): add favorites routes and register in app.ts |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| backend/src/services/sonos-favorites.ts exists | FOUND |
| backend/src/routes/favorites.ts exists | FOUND |
| Commit 68cf03b exists | FOUND |
| Commit 8c6c707 exists | FOUND |
| TypeScript compiles without errors | CLEAN |
