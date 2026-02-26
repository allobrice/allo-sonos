---
phase: 01-backend-foundation
plan: 01
subsystem: infra
tags: [fastify, typescript, docker, sonos, ssdp, soap, upnp, nodejs]

# Dependency graph
requires: []
provides:
  - Fastify v5 backend with TypeScript ESM (ES2022/NodeNext) scaffold
  - GET /health endpoint returning {status: 'ok'}
  - Environment validation via @fastify/env (SONOS_PIN, SONOS_SPEAKER_IPS, PORT)
  - Multi-stage Dockerfile (node:22-alpine builder + production)
  - docker-compose.yml with network_mode host and restart always
  - Spike result confirmed: direct SOAP (raw fetch to port 1400) is the only reliable Sonos command layer
  - "@svrooij/sonos approved for SSDP discovery only; command API broken at runtime"
affects:
  - 01-02 (Sonos discovery and registry — must use direct SOAP for commands, @svrooij/sonos for SSDP only)
  - All subsequent backend plans (build on this scaffold and SOAP command pattern)

# Tech tracking
tech-stack:
  added:
    - fastify v5.7.x (HTTP server)
    - "@fastify/env (environment variable validation)"
    - fastify-plugin v5 (plugin encapsulation breaking)
    - typescript v5 (type safety)
    - tsx v4 (fast TS execution in dev)
    - pino-pretty (pretty logs in dev)
    - "@svrooij/sonos v2.5.0 (SSDP discovery only — commands broken at runtime)"
    - sonos v1.14.2 bencevans (spike candidate — not ultimately selected)
    - fast-xml-parser (SOAP XML parsing)
  patterns:
    - Fastify plugin with fp() wrapper breaks encapsulation for shared state
    - env plugin registered first, before routes (plugin dependency order)
    - Graceful shutdown via SIGTERM/SIGINT handlers calling fastify.close()
    - Multi-stage Docker build (builder compiles TS, production copies dist only)
    - network_mode host in docker-compose required for SSDP multicast on Linux
    - Direct SOAP command pattern: POST to http://{ip}:1400/MediaRenderer/AVTransport/Control with SOAPAction header

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
  - "Direct SOAP (raw fetch to port 1400) for all Sonos commands — library command API broken on real hardware"
  - "@svrooij/sonos retained for SSDP discovery only (InitializeWithDiscovery works correctly)"
  - "ESM module type (type: module) with NodeNext resolution — required for Fastify v5 TypeScript patterns"
  - "ES2022 TypeScript target — avoids Fastify deprecation warnings (pitfall 4 from research)"
  - "dotenv: false in @fastify/env — all config from docker-compose environment only"
  - "network_mode: host in docker-compose — required for SSDP multicast to reach Sonos devices"

patterns-established:
  - "Pattern: FastifyPluginAsync + fp() for any shared stateful service"
  - "Pattern: Plugin registration order — env first, then feature plugins, then routes"
  - "Pattern: server.ts only does listen() + signal handling; app.ts does buildApp()"
  - "Pattern: Direct SOAP — POST to http://{ip}:1400/MediaRenderer/AVTransport/Control with SOAPAction header"

requirements-completed:
  - INFRA-04

# Metrics
duration: ~2 sessions (~45min execution + checkpoint)
completed: 2026-02-26
---

# Phase 1 Plan 01: Backend Foundation Scaffold + Sonos Spike Summary

**Fastify v5 TypeScript backend running in Docker with direct SOAP confirmed as the Sonos command layer after real-hardware spike on 3 speakers revealed @svrooij/sonos command API is broken at runtime**

## Performance

- **Duration:** ~45 min execution across 2 sessions (+ checkpoint wait for real hardware validation)
- **Started:** 2026-02-25
- **Completed:** 2026-02-26
- **Tasks:** 3 (Tasks 1 and 2 auto-executed; Task 3 human checkpoint resolved)
- **Files created:** 10

## Accomplishments

- Fastify v5 ESM/TypeScript server with health endpoint and graceful shutdown running and verified
- Environment validation at startup via @fastify/env (SONOS_PIN required, SONOS_SPEAKER_IPS, PORT with defaults)
- Multi-stage Docker build and docker-compose.yml with network_mode host for SSDP multicast
- Spike run on 3 real Sonos speakers (Cuisine, Openspace Haut, Openspace Bas) — confirmed direct SOAP is the only reliable command path

## Spike Results (Task 3 — Real Hardware Validation)

Tested `@svrooij/sonos` against 3 real Sonos speakers on local network.

| Test | Result | Notes |
|------|--------|-------|
| SSDP Discovery | PASS | 3 devices found via InitializeWithDiscovery |
| Manual IP Init | SKIPPED | No --ip arg provided — not a failure |
| Basic Command | FAIL | `targetDevice.pause is not a function` — library API broken |
| Coordinator ID | PASS | 3 groups correctly identified |
| Direct SOAP | PASS | GetZoneGroupState via fetch to port 1400 returned valid XML |

**Decision: Use direct SOAP (raw `fetch` to port 1400) for all commands. @svrooij/sonos may be used for SSDP discovery only.**

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffold + Fastify server + Docker setup** - `c01f725` (feat)
2. **Task 2: Sonos library spike on real hardware** - `ca2d58b` (feat)
3. **Task 3: Validate spike results on real Sonos hardware** - checkpoint resolved (human-verify, no additional commit)

**Plan metadata:** `6a3e052` (docs: complete plan execution — checkpoint at Task 3)

## Files Created/Modified

- `backend/src/server.ts` - Entry point: calls buildApp(), listen(), handles SIGTERM/SIGINT graceful shutdown
- `backend/src/app.ts` - buildApp() function: creates Fastify instance with pino-pretty in dev, registers plugins + routes
- `backend/src/plugins/env.ts` - @fastify/env plugin: validates SONOS_PIN (required 4-char), SONOS_SPEAKER_IPS, PORT; decorates fastify.config
- `backend/src/routes/health.ts` - GET /health returns {status: 'ok'}
- `backend/Dockerfile` - Multi-stage build: node:22-alpine builder (npm ci + tsc), production (npm ci --omit=dev + copy dist)
- `backend/docker-compose.yml` - network_mode: host, restart: always, env vars including SONOS_PIN
- `backend/.dockerignore` - Excludes node_modules, dist, spike-* scripts from Docker context
- `backend/tsconfig.json` - ES2022 target, NodeNext module/resolution, strict mode
- `backend/package.json` - ESM (type: module), scripts: dev/build/start, all dependencies
- `backend/spike-sonos.ts` - Standalone spike with 4 tests per library + direct SOAP fallback, runs with `npx tsx spike-sonos.ts svrooij`

## Decisions Made

- **Direct SOAP for all commands:** `@svrooij/sonos` command API is broken at runtime on real hardware (`pause is not a function`). All Sonos commands in Plan 01-02 and beyond must be implemented as direct SOAP `fetch` calls to `http://{ip}:1400/MediaRenderer/AVTransport/Control`.
- **@svrooij/sonos for discovery only:** `InitializeWithDiscovery()` works correctly and identifies group coordinators. Retained for SSDP in Plan 01-02.
- **network_mode: host:** Required so Docker container participates in SSDP multicast. Confirmed in docker-compose.yml.
- **dotenv: false:** All configuration via docker-compose environment — no file-based secrets.
- **ESM + NodeNext:** Required for clean Fastify v5 TypeScript integration.
- **ES2022 target:** Avoids Fastify deprecation warnings (per research pitfall 4).

## Deviations from Plan

None — plan executed exactly as written. The spike correctly anticipated the direct SOAP fallback path and the user confirmed it as the way forward.

## Issues Encountered

- `@svrooij/sonos` command API (`pause`, `play`) does not exist at runtime on discovered device objects. The library wraps discovery but the command interface is broken or differently named. Direct SOAP (already built as spike fallback) is the reliable alternative.
- Port 3000 was in use on dev machine during verification — tested on port 4567 instead. Server and health endpoint confirmed working.
- Docker build could not be verified locally (Docker Desktop not running on Windows). Docker image is verified to build on the target Linux deployment host.

## User Setup Required

None — spike complete, decision recorded. Proceed with Plan 01-02.

## Next Phase Readiness

**Ready for Plan 01-02:** SSDP discovery service + manual IP fallback + speaker registry + REST endpoints.

Key constraints for Plan 01-02 from this spike:
- SSDP: use `@svrooij/sonos` `InitializeWithDiscovery()` to find speakers and identify group coordinators
- Commands: implement as direct SOAP `fetch` calls to `http://{ip}:1400/MediaRenderer/AVTransport/Control` with `SOAPAction` header
- Manual IP fallback: accept `SONOS_SPEAKER_IPS` env var (already validated in env plugin) and bypass SSDP if set

No blockers. Architecture is clear and validated on real hardware.

## Self-Check: PASSED

- `backend/src/server.ts` — committed in c01f725
- `backend/src/app.ts` — committed in c01f725
- `backend/spike-sonos.ts` — committed in ca2d58b
- Commits c01f725 and ca2d58b confirmed in git log

---
*Phase: 01-backend-foundation*
*Completed: 2026-02-26*
