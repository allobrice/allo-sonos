---
status: diagnosed
trigger: "Le clic sur un favori dans le FavoritesSheet ferme le sheet correctement, mais le contenu n'est pas joué"
created: 2026-03-04T00:00:00Z
updated: 2026-03-04T00:01:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - stale dist build is missing the favorites route entirely
test: compared dist/app.js with src/app.ts, checked dist/routes/ and dist/services/
expecting: dist missing favorites files -> confirmed
next_action: report root cause

## Symptoms

expected: Clicking a favorite in FavoritesSheet closes the sheet AND the zone starts playing that content (update via WebSocket)
actual: The sheet closes on click but the content is not played, current music continues
errors: Silent — frontend catch block swallows all errors including 404
reproduction: click on a favorite in FavoritesSheet
started: Since favorites feature was added (post Mar 2 build)

## Eliminated

- hypothesis: Frontend click handler not wired correctly
  evidence: handleSelect() at FavoritesSheet.vue:39-42 correctly calls favStore.playFavorite() then emit('close'). Sheet closes = click works.
  timestamp: 2026-03-04T00:00:30Z

- hypothesis: Frontend store playFavorite missing or misconfigured
  evidence: favorites.ts store exports playFavorite, calls correct endpoint /api/speakers/${zoneUuid}/play-favorite with POST, JSON body {uri, type}
  timestamp: 2026-03-04T00:00:30Z

- hypothesis: Backend route path mismatch or Fastify conflict
  evidence: favorites.ts defines POST /speakers/:id/play-favorite under prefix /api. No radix tree conflict with speakers.ts routes. Path segments differ (play vs play-favorite).
  timestamp: 2026-03-04T00:00:40Z

- hypothesis: Auth middleware blocking the request
  evidence: No preHandler/onRequest hooks in any plugin. Auth is only PIN-based cookie, no route guard.
  timestamp: 2026-03-04T00:00:40Z

- hypothesis: Vite proxy not forwarding request
  evidence: vite.config.ts correctly proxies /api to localhost:3000
  timestamp: 2026-03-04T00:00:40Z

- hypothesis: Component unmount cancels fetch
  evidence: fetch() is a browser API, once initiated it completes regardless of component lifecycle. playFavorite is async but not awaited, fetch() is called synchronously before first await suspends.
  timestamp: 2026-03-04T00:00:45Z

## Evidence

- timestamp: 2026-03-04T00:00:30Z
  checked: FavoritesSheet.vue handleSelect function
  found: Correctly calls favStore.playFavorite(props.zoneUuid, fav) then emit('close')
  implication: Frontend click handler is wired correctly

- timestamp: 2026-03-04T00:00:35Z
  checked: favorites.ts store playFavorite function
  found: Makes POST to /api/speakers/${zoneUuid}/play-favorite with {uri, type}. catch block silently swallows ALL errors.
  implication: Any failure (404, 502, network error) would be invisible to the user

- timestamp: 2026-03-04T00:00:40Z
  checked: backend/src/routes/favorites.ts route definition
  found: POST /speakers/:id/play-favorite correctly defined, calls SetAVTransportURI + Play
  implication: Source code is correct

- timestamp: 2026-03-04T00:00:45Z
  checked: backend/src/app.ts vs backend/dist/app.js
  found: Source app.ts imports and registers favoritesRoutes (lines 11, 45). Compiled dist/app.js does NOT import or register favoritesRoutes at all (missing both import and register call).
  implication: If running from dist, the play-favorite route does not exist

- timestamp: 2026-03-04T00:00:50Z
  checked: backend/dist/routes/ directory listing
  found: No favorites.js or favorites.d.ts files. All other routes (auth, health, speakers, ws) are present. dist was compiled Mar 2 13:48.
  implication: Backend was last compiled before favorites feature was added

- timestamp: 2026-03-04T00:00:50Z
  checked: backend/dist/services/ directory listing
  found: No sonos-favorites.js file. The service dependency is also missing from dist.
  implication: Even if app.js imported favorites route, it would fail at service import

- timestamp: 2026-03-04T00:00:55Z
  checked: backend/src/routes/favorites.ts file timestamp
  found: Last modified Mar 3 08:33, while dist/ was compiled Mar 2 13:48
  implication: Favorites source was added ~19 hours after last build

## Resolution

root_cause: The backend dist/ directory contains a stale build from Mar 2 13:48 that predates the favorites feature addition (Mar 3 08:33). The compiled dist/app.js is missing both the import of favoritesRoutes and its registration. The dist/routes/favorites.js and dist/services/sonos-favorites.js files do not exist. If the backend is running from the compiled dist (via `npm start` or `node dist/server.js`), the POST /api/speakers/:id/play-favorite endpoint does not exist. The request returns 404, which the frontend silently swallows (catch block at favorites.ts:51-53). The user sees the sheet close (emit fires synchronously) but no playback change because the API call failed silently. Running in dev mode (tsx watch) would work fine since tsx resolves .ts sources directly.
fix: Run `cd backend && npm run build` to recompile dist/ with favorites support. If running dev mode and issue persists, the problem is elsewhere (SOAP/Sonos level).
verification:
files_changed: []
