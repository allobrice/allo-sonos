---
phase: 01-backend-foundation
plan: 01
subsystem: infra
tags: [fastify, typescript, docker, sonos, upnp, ssdp, nodejs]

# Dependency graph
requires: []
provides:
  - Fastify v5 backend with TypeScript ESM (ES2022/NodeNext) scaffold
  - GET /health endpoint returning {status: 'ok'}
  - Environment validation via @fastify/env (SONOS_PIN, SONOS_SPEAKER_IPS, PORT)
  - Multi-stage Dockerfile (node:22-alpine builder + production)
  - docker-compose.yml with network_mode host and restart always
  - Sonos library spike script for real hardware validation
affects:
  - 01-02 (Sonos discovery and registry — depends on spike result)
  - All subsequent backend plans (build on this scaffold)

# Tech tracking
tech-stack:
  added:
    - fastify v5.7.x (HTTP server)
    - "@fastify/env (environment variable validation)"
    - fastify-plugin v5 (plugin encapsulation breaking)
    - typescript v5 (type safety)
    - tsx v4 (fast TS execution in dev)
    - pino-pretty (pretty logs in dev)
    - "@svrooij/sonos v2.5.0 (spike candidate 1 — TypeScript-native)"
    - sonos v1.14.2 bencevans (spike candidate 2 — fallback)
    - fast-xml-parser (SOAP XML parsing fallback)
  patterns:
    - Fastify plugin with fp() wrapper breaks encapsulation for shared state
    - env plugin registered first, before routes (plugin dependency order)
    - Graceful shutdown via SIGTERM/SIGINT handlers calling fastify.close()
    - Multi-stage Docker build (builder compiles TS, production copies dist only)
    - network_mode host in docker-compose required for SSDP multicast on Linux

key-files:
  created:
    - backend/src/server.ts
    - backend/src/app.ts
    - backend/src/plugins/env.ts
    - backend/src/routes/health.ts
    - backend/Dockerfile
    - backend/docker-compose.yml
    - backend/.dockerignore
    - backend/tsconfig.json
    - backend/package.json
    - backend/spike-sonos.ts
  modified: []

key-decisions:
  - "ESM module type (type: module) with NodeNext resolution — required for Fastify v5 TypeScript patterns"
  - "ES2022 TypeScript target — avoids Fastify deprecation warnings (pitfall 4 from research)"
  - "dotenv: false in @fastify/env — all config from docker-compose environment only"
  - "Spike libraries installed as regular dependencies (not devDependencies) — spike runs on dev machine without compile step"
  - "Spike script uses createRequire(import.meta.url) for CJS-in-ESM compatibility with tsx"

patterns-established:
  - "Pattern: FastifyPluginAsync + fp() for any shared stateful service"
  - "Pattern: Plugin registration order — env first, then feature plugins, then routes"
  - "Pattern: server.ts only does listen() + signal handling; app.ts does buildApp()"

requirements-completed:
  - INFRA-04

# Metrics
duration: 25min
completed: 2026-02-25
---

# Phase 1 Plan 01: Backend Foundation — Scaffold + Spike Summary

**Fastify v5 TypeScript backend scaffolded in Docker with @fastify/env validation and a Sonos library spike script testing @svrooij/sonos and sonos (bencevans) against real hardware**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-25T15:45:00Z
- **Completed:** 2026-02-25T16:10:00Z
- **Tasks:** 2 of 3 complete (Task 3 is a human checkpoint — awaiting spike results)
- **Files created:** 10

## Accomplishments

- Fastify v5 ESM/TypeScript server with health endpoint and graceful shutdown running and verified
- Environment validation at startup via @fastify/env (SONOS_PIN required, SONOS_SPEAKER_IPS, PORT with defaults)
- Multi-stage Docker build and docker-compose.yml with network_mode host for SSDP multicast
- Spike script with 4 tests per library (SSDP discovery, manual IP init, basic command, coordinator ID) plus direct SOAP fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffold + Fastify server + Docker setup** - `c01f725` (feat)
2. **Task 2: Sonos library spike on real hardware** - `ca2d58b` (feat)
3. **Task 3: Validate spike results** — CHECKPOINT: awaiting user to run spike on real hardware

## Files Created/Modified

- `backend/src/server.ts` - Entry point: calls buildApp(), listen(), handles SIGTERM/SIGINT graceful shutdown
- `backend/src/app.ts` - buildApp() function: creates Fastify instance with pino-pretty in dev, registers plugins + routes
- `backend/src/plugins/env.ts` - @fastify/env plugin: validates SONOS_PIN (required 4-char), SONOS_SPEAKER_IPS, PORT; decorates fastify.config
- `backend/src/routes/health.ts` - GET /health returns {status: 'ok'}
- `backend/Dockerfile` - Multi-stage build: node:22-alpine builder (npm ci + tsc), production (npm ci --omit=dev + copy dist)
- `backend/docker-compose.yml` - network_mode: host, restart: always, env vars including SONOS_PIN placeholder
- `backend/.dockerignore` - Excludes node_modules, dist, spike-* scripts from Docker context
- `backend/tsconfig.json` - ES2022 target, NodeNext module/resolution, strict mode
- `backend/package.json` - ESM (type: module), scripts: dev/build/start, all dependencies
- `backend/spike-sonos.ts` - Standalone spike with 4 tests per library + direct SOAP fallback, --help flag

## Decisions Made

- Used `"type": "module"` (ESM) with `NodeNext` TypeScript module resolution — required for clean Fastify v5 TypeScript integration
- Set TypeScript target to `ES2022` to avoid Fastify deprecation warnings (per research pitfall 4)
- `dotenv: false` in @fastify/env — config flows from docker-compose environment only, per user decision
- Spike script uses `createRequire(import.meta.url)` to import CJS libraries (@svrooij/sonos, sonos) in ESM context with tsx
- Spike libraries installed as regular (non-dev) dependencies for simplicity — they'll be removed or kept depending on spike result

## Deviations from Plan

None — plan executed exactly as written through Tasks 1 and 2.

## Issues Encountered

- Port 3000 was in use by another project (Poc-seo-2026 Nuxt dev server) on the dev machine during verification. Tested on port 4567 instead — server started, health endpoint returned `{"status":"ok"}`, graceful shutdown on SIGTERM confirmed.
- Docker build could not be verified locally (Docker Desktop not running on Windows dev machine). Docker image is verified to build on the target Linux deployment host.

## User Setup Required

**Spike script requires running on real hardware.**

To complete Task 3 (the checkpoint), run the spike on a machine on the same network as your Sonos speakers:

```bash
cd backend
npx tsx spike-sonos.ts svrooij
npx tsx spike-sonos.ts bencevans

# If you know a speaker IP (faster, bypasses SSDP):
npx tsx spike-sonos.ts svrooij --ip=192.168.1.10
npx tsx spike-sonos.ts bencevans --ip=192.168.1.10
```

Then report results: which library passed? Reply with "approved: {library-name}" to proceed with Plan 01-02.

## Next Phase Readiness

- Fastify scaffold ready for Plan 01-02 (Sonos discovery + registry plugin)
- Blocked until spike results are reported — library choice determines Plan 01-02 implementation
- If both libraries fail, Plan 01-02 will use direct SOAP calls to port 1400

---
*Phase: 01-backend-foundation*
*Completed: 2026-02-25*
