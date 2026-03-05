---
status: awaiting_human_verify
trigger: "POST /api/speakers/:id/play returns 404 Route not found"
created: 2026-03-02T00:00:00Z
updated: 2026-03-02T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Backend registered routes without /api prefix; frontend sends /api/* paths
test: Fix applied: prefix '/api' added to healthRoutes, speakerRoutes, authRoutes in app.ts; auth.ts paths stripped of hardcoded /api
expecting: POST /api/speakers/:id/play now resolves to the registered route
next_action: Await human verification that play/pause/volume controls work end-to-end

## Symptoms

expected: POST /api/speakers/RINCON_949F3E5211A801400/play should trigger playback and return success
actual: Server returns 404 "Route POST:/api/speakers/RINCON_949F3E5211A801400/play not found"
errors: |
  [12:41:16.163] INFO (33060): Route POST:/api/speakers/RINCON_949F3E5211A801400/play not found
  reqId: "req-18"
  res: { "statusCode": 404 }
  Similar 404s for /previous and other action endpoints.
reproduction: Click play, previous track, or volume controls in the frontend UI
started: Unknown - may be a regression or routes never properly registered with /api prefix

## Eliminated

- hypothesis: Routes are not defined in the backend at all
  evidence: backend/src/routes/speakers.ts defines POST /speakers/:id/play, /pause, /next, /previous, PUT /speakers/:id/volume, POST /speakers/:id/mute, /unmute - all routes exist
  timestamp: 2026-03-02T00:00:00Z

- hypothesis: Frontend is calling wrong URLs
  evidence: frontend/src/stores/zones.ts uses fetch('/api/speakers/${uuid}/play') which is correct per the /api proxy convention
  timestamp: 2026-03-02T00:00:00Z

- hypothesis: Vite proxy strips /api prefix before forwarding
  evidence: vite.config.ts shows proxy '/api' -> 'http://localhost:3000' with NO rewrite rule, so /api/* is forwarded as-is to the backend
  timestamp: 2026-03-02T00:00:00Z

## Evidence

- timestamp: 2026-03-02T00:00:00Z
  checked: backend/src/routes/speakers.ts
  found: Routes registered as '/speakers/:id/play', '/speakers/:id/pause', etc. — no /api prefix
  implication: Backend expects requests at /speakers/* not /api/speakers/*

- timestamp: 2026-03-02T00:00:00Z
  checked: frontend/src/stores/zones.ts
  found: All fetch calls use /api/speakers/${uuid}/... pattern
  implication: Frontend expects routes at /api/speakers/*

- timestamp: 2026-03-02T00:00:00Z
  checked: frontend/vite.config.ts
  found: proxy config maps '/api' to 'http://localhost:3000' with changeOrigin:true but NO rewrite, meaning /api/speakers/... is forwarded verbatim as /api/speakers/...
  implication: Backend receives /api/speakers/* but only has /speakers/* registered — 404

- timestamp: 2026-03-02T00:00:00Z
  checked: backend/src/app.ts
  found: fastify.register(speakerRoutes) — no prefix option. fastify.register(healthRoutes) — no prefix. fastify.register(wsRoutes) — no prefix. fastify.register(authRoutes) — no prefix BUT auth.ts hardcodes /api/auth/pin in path
  implication: Only auth routes accidentally work because they include /api in the literal path string

- timestamp: 2026-03-02T00:00:00Z
  checked: backend/src/routes/auth.ts
  found: Routes are registered as '/api/auth/pin' and '/api/auth/logout' — literal /api prefix in path string
  implication: Auth works in dev because the /api prefix is in the path itself. All other routes lack this prefix and therefore fail.

## Resolution

root_cause: Backend route registration lacked the /api prefix. Frontend sends requests as /api/speakers/:id/... (via Vite dev proxy that forwards the path verbatim), but the backend only had /speakers/:id/... registered. Auth routes worked accidentally because they hardcoded /api in their literal path strings (/api/auth/pin). All speaker routes returned 404.
fix: |
  1. backend/src/app.ts: added { prefix: '/api' } to register() calls for healthRoutes, speakerRoutes, and authRoutes. wsRoutes left unprefixed (frontend WebSocket connects to /ws directly, not /api/ws).
  2. backend/src/routes/auth.ts: stripped hardcoded /api prefix from route paths (/api/auth/pin -> /auth/pin, /api/auth/logout -> /auth/logout) so the prefix option handles it uniformly.
  TypeScript build passes cleanly (npm run build: no errors).
verification: TypeScript build passes. Awaiting runtime confirmation.
files_changed:
  - backend/src/app.ts
  - backend/src/routes/auth.ts
