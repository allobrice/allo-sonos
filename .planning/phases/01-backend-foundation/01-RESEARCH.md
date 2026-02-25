# Phase 1: Backend Foundation - Research

**Researched:** 2026-02-25
**Domain:** Node.js (Fastify) + Sonos UPnP/SSDP Discovery + Docker
**Confidence:** MEDIUM (Sonos library ecosystem is partially stale; UPnP protocol itself is stable)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Target environment**: Docker (docker-compose) on Linux. Machine TBD — must be portable across any Linux host with Docker.
- **Auto-restart**: `restart: always` in docker-compose — service must survive crashes and reboots.
- **Network**: Container must be on same network as Sonos speakers — `network_mode: host` is the probable requirement for SSDP multicast to work.
- **Configuration**: All config lives in docker-compose.yml `environment` section — single file to edit.
  - PIN: 4-digit, env var `SONOS_PIN=1234`
  - Manual speaker IPs: env var `SONOS_SPEAKER_IPS=192.168.1.10,192.168.1.11` — SSDP fallback
  - Exposed port: 3000
- **Logging**: Informative — errors + important actions (speaker discovered, command sent, connection lost). Silent on routine traffic.

### Claude's Discretion

- Choice of Sonos library (`node-sonos` vs alternatives) — **decide after the spike**
- Internal backend architecture (folder structure, patterns)
- Discovery strategy (SSDP first, fallback IP, or reverse)
- REST API response format (JSON structure)
- Network error handling (retry, timeout, fallback)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-04 | Backend automatically discovers Sonos speakers on the local network | SSDP via UDP multicast to 239.255.255.250:1900; `@svrooij/sonos` SonosManager.InitializeWithDiscovery() or raw dgram M-SEARCH; manual IP fallback via SonosManager.InitializeFromDevice() |
</phase_requirements>

---

## Summary

This phase establishes the Node.js/Fastify backend that discovers Sonos speakers via SSDP and can issue basic commands. The core technical risk is Sonos library compatibility: **all major community Node.js libraries (`sonos`, `@svrooij/sonos`) were last published 3–4 years ago** and the Sonos firmware has changed since. A spike on real hardware is mandatory before committing to any library.

The Sonos protocol underneath — UPnP/SOAP over HTTP on port 1400, discovered via SSDP — is stable and well-documented. If libraries fail, direct HTTP SOAP calls are a viable fallback. The `GetZoneGroupState` UPnP action (replaces the broken `getTopology`) returns coordinator information as XML and is the correct mechanism for identifying the coordinator of a zone group.

Docker `network_mode: host` is the standard and well-confirmed solution for SSDP multicast inside containers on Linux. There is no bridge-mode alternative that reliably handles UDP multicast without additional relay infrastructure.

**Primary recommendation:** Spike `@svrooij/sonos` first (TypeScript-native, better architecture), then `sonos` (bencevans) as fallback. If both fail on real firmware, implement thin direct SOAP/HTTP calls against port 1400 — the protocol is open and documented.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | v5.7.x (latest) | HTTP server framework | Faster than Express, built-in TypeScript support, JSON schema validation, plugin encapsulation |
| `typescript` | 5.x | Type safety | Stack decision (per STATE.md) |
| `@types/node` | 22.x | Node.js typings | Required for TS |
| `pino` | bundled with Fastify | Structured JSON logging | Built-in to Fastify; low-overhead, structured output matches logging requirements |
| `@svrooij/sonos` | 2.5.0 | Sonos UPnP control (spike candidate) | TypeScript-native, SonosManager handles discovery + coordinator tracking |
| `sonos` | 1.14.2 | Sonos UPnP control (fallback spike candidate) | Most recently published (3 months ago), `getAllGroups()` for coordinator lookup |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fastify-plugin` | 5.x | Break plugin encapsulation | When a plugin (e.g., Sonos service) must decorate the root Fastify instance |
| `@fastify/env` | latest | Env var validation + typing | Validate `SONOS_PIN`, `SONOS_SPEAKER_IPS`, `PORT` at startup with schema |
| `ts-node` | 10.x | Run TS in dev without compile | Development only |
| `tsx` | latest | Fast TS execution (alternative to ts-node) | Simpler HMR in dev, no tsconfig issues |
| `xml2js` or `fast-xml-parser` | latest | Parse SOAP XML responses | Only if doing raw SOAP calls instead of library |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@svrooij/sonos` | `sonos` (bencevans) | bencevans is more recently published but JavaScript-only; @svrooij is TypeScript but older publish date |
| Both libraries | Raw SOAP/HTTP to port 1400 | More work, but zero dependency risk; fully controlled; only option if both libraries fail on real firmware |
| `@fastify/env` | Manual `process.env` parsing | @fastify/env gives startup-time validation + TS typing; manual parsing silently passes bad config |
| `tsx` in dev | `ts-node` | `tsx` is faster and requires no tsconfig tweaks; either works |

**Installation (after spike determines library):**
```bash
# Core (always)
npm install fastify @fastify/env fastify-plugin

# Dev tools
npm install -D typescript @types/node tsx

# Sonos — spike candidate 1 (TypeScript)
npm install @svrooij/sonos

# Sonos — spike candidate 2 (fallback)
npm install sonos
```

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── src/
│   ├── app.ts               # Fastify instance creation, plugin registration
│   ├── server.ts            # Entry point — listen(), graceful shutdown
│   ├── plugins/
│   │   ├── env.ts           # @fastify/env — validates and exposes config
│   │   └── sonos.ts         # fastify-plugin — SonosManager, speaker registry
│   ├── routes/
│   │   ├── health.ts        # GET /health — liveness probe
│   │   └── speakers.ts      # GET /speakers, POST /speakers/:id/command
│   └── services/
│       ├── discovery.ts     # SSDP discovery + manual IP fallback logic
│       └── registry.ts      # In-memory speaker registry (Map<id, SonosDevice>)
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

### Pattern 1: Fastify Plugin for Sonos Service

**What:** Register the SonosManager as a Fastify plugin using `fastify-plugin`, which breaks Fastify's encapsulation so the decorated value (`fastify.sonos`) is available in all route handlers.

**When to use:** Any shared stateful service that routes need to access.

```typescript
// Source: https://fastify.dev/docs/latest/Reference/Plugins/
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { SonosManager } from '@svrooij/sonos'

const sonosPlugin: FastifyPluginAsync = async (fastify) => {
  const manager = new SonosManager()

  const speakerIps = fastify.config.SONOS_SPEAKER_IPS
    ? fastify.config.SONOS_SPEAKER_IPS.split(',').map(s => s.trim())
    : []

  try {
    await manager.InitializeWithDiscovery(10)
    fastify.log.info(`SSDP discovery found ${manager.Devices.length} speakers`)
  } catch (err) {
    fastify.log.warn('SSDP discovery failed, trying manual IPs')
    if (speakerIps.length > 0) {
      await manager.InitializeFromDevice(speakerIps[0])
      fastify.log.info(`Manual IP fallback: ${manager.Devices.length} speakers found`)
    } else {
      fastify.log.error('No speakers found and no manual IPs configured')
    }
  }

  fastify.decorate('sonos', manager)
}

export default fp(sonosPlugin, { name: 'sonos' })
```

### Pattern 2: Fastify Plugin Registration Order

**What:** Plugins must be registered before routes; schemas before routes. Plugin loading is sequential.

```typescript
// src/app.ts
import Fastify from 'fastify'
import envPlugin from './plugins/env'
import sonosPlugin from './plugins/sonos'
import healthRoutes from './routes/health'
import speakerRoutes from './routes/speakers'

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      // Pino pretty print in dev, JSON in prod
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined
    }
  })

  // 1. Ecosystem plugins
  await fastify.register(envPlugin)

  // 2. Custom plugins (depend on env)
  await fastify.register(sonosPlugin)

  // 3. Routes (depend on plugins)
  await fastify.register(healthRoutes)
  await fastify.register(speakerRoutes)

  return fastify
}
```

### Pattern 3: Zone Group Coordinator Identification

**What:** In a Sonos zone group, commands (play, pause, volume for the group) must be sent to the coordinator device, not any device in the group. `@svrooij/sonos` tracks this via `GroupName` and the coordinator flag.

**When to use:** Every playback command that affects a zone group.

```typescript
// Using @svrooij/sonos
// The manager.Devices array contains all speakers.
// Each device has a .coordinator property or GroupName tracking.
// For zone-group commands, find the coordinator:

const getCoordinator = (manager: SonosManager, groupName: string) => {
  return manager.Devices.find(d => d.GroupName === groupName && d.uuid === d.GroupName)
  // Alternatively: filter by group and pick the one with Coordinator flag
}
```

**Direct SOAP fallback (if library fails):**
```typescript
// GetZoneGroupState — POST to any speaker, returns all groups
// Source: https://sonos.svrooij.io/services/zone-group-topology
const response = await fetch(`http://${speakerIp}:1400/ZoneGroupTopology/Control`, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset="utf-8"',
    'soapaction': '"urn:schemas-upnp-org:service:ZoneGroupTopology:1#GetZoneGroupState"'
  },
  body: `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <u:GetZoneGroupState xmlns:u="urn:schemas-upnp-org:service:ZoneGroupTopology:1">
    </u:GetZoneGroupState>
  </s:Body>
</s:Envelope>`
})
// Parse XML: ZoneGroupState.ZoneGroups.ZoneGroup[]
// Each ZoneGroup has a Coordinator attribute (UUID of coordinator speaker)
```

### Pattern 4: SSDP Discovery (Raw, if library fails)

**What:** Send M-SEARCH UDP packet to multicast 239.255.255.250:1900, collect responses from Sonos devices.

```typescript
// Source: standard UPnP / Sonos communication docs
import dgram from 'dgram'

const SSDP_ADDRESS = '239.255.255.250'
const SSDP_PORT = 1900
const M_SEARCH = [
  'M-SEARCH * HTTP/1.1',
  `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`,
  'MAN: "ssdp:discover"',
  'MX: 3',
  'ST: urn:schemas-upnp-org:device:ZonePlayer:1',
  '', ''
].join('\r\n')

function discoverSonos(timeoutMs = 5000): Promise<string[]> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    const discovered: Set<string> = new Set()

    socket.on('message', (msg, rinfo) => {
      discovered.add(rinfo.address)
    })

    socket.bind(() => {
      socket.addMembership(SSDP_ADDRESS)
      socket.send(M_SEARCH, SSDP_PORT, SSDP_ADDRESS)
      setTimeout(() => {
        socket.close()
        resolve([...discovered])
      }, timeoutMs)
    })
  })
}
```

### Pattern 5: Docker + SSDP (host network)

```yaml
# docker-compose.yml
services:
  backend:
    build: .
    network_mode: host          # REQUIRED for SSDP multicast
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SONOS_PIN=1234
      - SONOS_SPEAKER_IPS=      # Leave blank to rely on SSDP
    # No ports: mapping needed — host network exposes directly
```

**Note:** `network_mode: host` is Linux-only. It works on any standard Linux Docker host. Mac and Windows Docker Desktop do not support host networking — this is fine since the target is Linux.

### Anti-Patterns to Avoid

- **Using `getTopology()`:** Broken since Sonos firmware 9.1. Use `getAllGroups()` (bencevans) or `GetZoneGroupState` SOAP directly.
- **Sending zone commands to any device:** Must send to the group coordinator. Sending pause to a satellite in a stereo pair does nothing.
- **Using `ports:` with host network mode:** Unnecessary and conflicting — `network_mode: host` bypasses Docker NAT entirely.
- **Skipping startup env validation:** Missing `SONOS_SPEAKER_IPS` with failed SSDP = silent broken state. Validate at startup.
- **Hardcoding speaker IPs in source code:** Config belongs in docker-compose environment only (per user decision).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sonos UPnP SOAP formatting | Custom XML builder | `@svrooij/sonos` or `sonos` library | Sonos has ~40 UPnP services, each with specific XML envelopes; hand-rolling is error-prone and months of work |
| SSDP socket management | Custom UDP socket lifecycle | Library or dgram (only if no library works) | Multicast group membership, socket reuse, platform quirks are tricky |
| JSON schema validation for routes | Manual req.body checks | Fastify's built-in JSON schema (`schema:` on route) | Fastify compiles schemas to validators — faster, declarative, documented |
| Env var validation | `if (!process.env.X) throw` | `@fastify/env` | Typed at startup, surfaces missing config immediately with clear error messages |
| HTTP logging | `console.log(req, res)` | Fastify's built-in pino logger | Already wired to request context, structured JSON, correct log levels |

**Key insight:** The Sonos UPnP protocol has ~40 services (AVTransport, RenderingControl, ZoneGroupTopology, etc.) each with multiple actions and events. Implementing even basic control from scratch takes weeks and requires handling XML encoding, subscription lifecycle (GENA events), and coordinator routing. Use a library for the spike even if you ultimately pivot to direct SOAP calls — the library code teaches you what raw calls to make.

---

## Common Pitfalls

### Pitfall 1: SSDP fails silently in Docker bridge mode

**What goes wrong:** Container starts, `InitializeWithDiscovery()` times out with zero devices, no error thrown, app continues with empty speaker list.

**Why it happens:** SSDP uses UDP multicast. Docker bridge networking does not forward multicast packets from the host network to containers. The socket binds and sends but no responses arrive.

**How to avoid:** Always use `network_mode: host` in docker-compose. Test SSDP discovery on the actual target machine before treating it as working. The manual IP fallback (`SONOS_SPEAKER_IPS`) is the safety net.

**Warning signs:** Zero devices discovered despite speakers being reachable by IP from the host machine.

---

### Pitfall 2: Library incompatibility with current Sonos firmware

**What goes wrong:** `@svrooij/sonos` (v2.5.0, published 2022) or `sonos` (v1.14.2) returns errors or empty data on current firmware.

**Why it happens:** Both libraries are community-maintained and last updated 3–4 years ago. Sonos continuously updates firmware. Known breakage: `getTopology()` broke on firmware 9.1. Newer firmware changes are not tracked by either library.

**How to avoid:** The spike (Plan 01-01) must run on actual Sonos hardware before any further work. If `InitializeWithDiscovery()` works and basic play/pause commands work → proceed with that library. If not → evaluate `jishi/node-sonos-http-api` (a standalone service) or implement direct SOAP calls to port 1400.

**Warning signs:** `UPnPError 500`, `getTopology is not a function`, connection refused, or empty device list from a working network.

---

### Pitfall 3: Sending commands to wrong speaker (not coordinator)

**What goes wrong:** Play/pause command appears to succeed (HTTP 200) but speaker does not respond, or only one speaker in a pair responds.

**Why it happens:** In a Sonos zone group, all UPnP commands for group playback must go to the group coordinator. Sending to a satellite device results in no action or partial action.

**How to avoid:** Always resolve the coordinator before issuing playback commands. With `@svrooij/sonos`, the `SonosDevice` has coordinator tracking built in. With raw SOAP, parse `GetZoneGroupState` XML and look for the `Coordinator` attribute in `<ZoneGroup>` elements.

**Warning signs:** HTTP 200 but speaker does not respond; commands work on one speaker but not others in the same room.

---

### Pitfall 4: TypeScript `target` too low causes Fastify deprecation warnings

**What goes wrong:** Fastify logs `FastifyDeprecation: Passing logger as 'Logger' interface is deprecated...` or similar.

**Why it happens:** Fastify v5 requires ES2017+ target in tsconfig.json. Lower targets cause async/await desugaring patterns that conflict with internal type expectations.

**How to avoid:** Set `"target": "ES2020"` or higher in `tsconfig.json`.

---

### Pitfall 5: Discovery runs at plugin registration, blocks startup

**What goes wrong:** Fastify startup hangs for 10+ seconds waiting for SSDP timeout when no speakers are reachable.

**Why it happens:** SSDP discovery is async with a timeout. If the timeout is set high (10 seconds) and no speakers respond, startup blocks.

**How to avoid:** Keep SSDP timeout low (3–5 seconds) for startup. Run a background periodic rediscovery after startup for new devices. If manual IPs are configured, try those first (faster, no timeout). Log clearly when discovery yields zero devices — don't silently proceed.

---

## Code Examples

Verified patterns from official sources:

### Fastify Server Startup (TypeScript)
```typescript
// Source: https://fastify.dev/docs/latest/Guides/Getting-Started/
import Fastify from 'fastify'

const fastify = Fastify({
  logger: {
    level: 'info'
  }
})

fastify.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
```

### @fastify/env for Config Validation
```typescript
// Source: https://github.com/fastify/fastify-env
import fp from 'fastify-plugin'
import fastifyEnv from '@fastify/env'

const schema = {
  type: 'object',
  required: ['SONOS_PIN'],
  properties: {
    SONOS_PIN: { type: 'string', minLength: 4, maxLength: 4 },
    SONOS_SPEAKER_IPS: { type: 'string', default: '' },
    PORT: { type: 'integer', default: 3000 }
  }
}

export default fp(async (fastify) => {
  await fastify.register(fastifyEnv, { schema, dotenv: false })
})
```

### @svrooij/sonos Discovery + Manual Fallback
```typescript
// Source: https://github.com/svrooij/node-sonos-ts/blob/main/README.md
import { SonosManager } from '@svrooij/sonos'

const manager = new SonosManager()

// Try SSDP first
let discovered = false
try {
  await manager.InitializeWithDiscovery(5) // 5 second timeout
  if (manager.Devices.length > 0) {
    discovered = true
    console.log(`Found ${manager.Devices.length} speakers via SSDP`)
  }
} catch (_) {}

// Fallback to manual IP
if (!discovered) {
  const manualIp = process.env.SONOS_SPEAKER_IPS?.split(',')[0]?.trim()
  if (manualIp) {
    await manager.InitializeFromDevice(manualIp)
    console.log(`Manual IP: found ${manager.Devices.length} speakers`)
  }
}

manager.Devices.forEach(d =>
  console.log(`Speaker: ${d.Name} | Group: ${d.GroupName} | UUID: ${d.uuid}`)
)
```

### Dockerfile (Multi-Stage, TypeScript)
```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getTopology()` for zone discovery | `getAllGroups()` or `GetZoneGroupState` SOAP directly | Sonos firmware 9.1 (~2019) | Must not use getTopology in new code |
| `node-sonos` (0.12.6, 8 years old) | `sonos` (bencevans 1.14.2) or `@svrooij/sonos` (2.5.0) | 2019–2022 | Prefer either over the original package |
| Docker bridge networking for SSDP | `network_mode: host` on Linux | Confirmed pattern | Only reliable option for UDP multicast |
| ts-node for TS execution | tsx (faster) or compile+run | 2023–2024 | Either works; tsx simpler for dev |

**Deprecated/outdated:**
- `node-sonos` (npm package name, not `sonos`): 0.12.6, 8 years old, 1 downstream dependent. Do not use.
- `getTopology()`: Explicitly deprecated in `sonos` library README. Broken since firmware 9.1.
- `@svrooij/sonos` npm package (same as `node-sonos-ts`): v2.5.0 published 4 years ago. Still functional but unverified on latest firmware — hence the mandatory spike.

---

## Open Questions

1. **Does `@svrooij/sonos` work with current Sonos S2 firmware (2025/2026)?**
   - What we know: Last published June 2022. Issues were still being opened in 2025 (April, August). The UPnP protocol underneath is stable.
   - What's unclear: Whether any firmware changes since 2022 broke specific service calls.
   - Recommendation: Spike must test `InitializeWithDiscovery()` AND a basic `pause()` command on real hardware. This is the first task of Plan 01-01.

2. **Does `sonos` (bencevans 1.14.2) work better than `@svrooij/sonos` on current firmware?**
   - What we know: Published 3 months ago (late 2025), so there may be recent fixes. `getAllGroups()` is the replacement for `getTopology()`.
   - What's unclear: Whether the last publish was a real fix release or just a dependency bump.
   - Recommendation: Spike both in Plan 01-01. Pick whichever completes the success criteria: discovery + basic command + coordinator identification.

3. **Will SSDP discovery work on the specific corporate network?**
   - What we know: SSDP requires UDP multicast. Corporate networks sometimes block or isolate multicast traffic. Sonos itself requires this to work (it uses SSDP for its own app), so the network probably supports it.
   - What's unclear: Whether Docker on the target host machine will be able to use `network_mode: host` (requires Linux, not Windows/Mac Docker Desktop).
   - Recommendation: Manual IP fallback (`SONOS_SPEAKER_IPS`) is the safety net. Always implement it.

4. **Is the fallback to `node-sonos-http-api` (jishi) viable if both libraries fail?**
   - What we know: `node-sonos-http-api` is a standalone Node.js service that exposes an HTTP API over UPnP. It would run as a sidecar alongside the Fastify backend. Last meaningful update 2022–2023, Docker image maintained separately.
   - What's unclear: Whether running it as a sidecar adds unacceptable complexity.
   - Recommendation: If the spike fails on both libraries, direct SOAP calls (raw fetch to port 1400) are cleaner than running a sidecar. The SOAP protocol is documented at `sonos.svrooij.io`.

---

## Sources

### Primary (HIGH confidence)
- [Fastify v5 Getting Started](https://fastify.dev/docs/latest/Guides/Getting-Started/) — setup, plugin registration, route patterns
- [Fastify TypeScript Reference](https://fastify.dev/docs/latest/Reference/TypeScript/) — TypeScript integration, generic constraints
- [Fastify Logging Reference](https://fastify.dev/docs/v5.4.x/Reference/Logging/) — Pino configuration, log levels
- [node-sonos-ts README](https://github.com/svrooij/node-sonos-ts/blob/main/README.md) — SonosManager API, InitializeWithDiscovery, InitializeFromDevice
- [Sonos ZoneGroupTopology service](https://sonos.svrooij.io/services/zone-group-topology) — GetZoneGroupState SOAP call, coordinator identification
- [Sonos communication protocol](https://sonos.svrooij.io/sonos-communication) — port 1400, SSDP port 1900, SOAP format

### Secondary (MEDIUM confidence)
- [bencevans/node-sonos GitHub](https://github.com/bencevans/node-sonos) — `getAllGroups()` as getTopology replacement, AsyncDeviceDiscovery
- [Docker multicast documentation](https://forums.docker.com/t/receive-udp-multicast-stream-inside-container-without-setting-network-to-host/104010) — confirmed host network is required for UDP multicast in containers
- [NPM sonos package](https://www.npmjs.com/package/sonos) — v1.14.2, published ~3 months ago
- [@svrooij/sonos npm](https://www.npmjs.com/package/@svrooij/sonos) — v2.5.0, published ~4 years ago, issues still active in 2025

### Tertiary (LOW confidence)
- Community reports of `getAllGroups()` throwing UPnPError 500 on some firmware versions — not verified with official source, flagged as risk for spike
- node-sonos-ts issue tracker shows issues filed August 2025 — suggests some users still actively using it, but specific firmware compatibility unclear

---

## Metadata

**Confidence breakdown:**
- Standard stack (Fastify): HIGH — official docs confirm v5.7.x, TypeScript support, plugin system
- Sonos library choice: LOW-MEDIUM — all options are community libraries, last published 2–4 years ago; real-hardware spike is mandatory
- SSDP/UPnP protocol: HIGH — stable protocol, well-documented, port 1400 and 1900 confirmed
- Docker host networking for SSDP: HIGH — multiple independent sources confirm host mode is the only reliable option for UDP multicast
- Zone coordinator pattern: HIGH — GetZoneGroupState SOAP action documented, getTopology deprecation confirmed

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days) for stable parts (Fastify, Docker); 7 days for Sonos library landscape — re-verify before proceeding if spike is delayed
