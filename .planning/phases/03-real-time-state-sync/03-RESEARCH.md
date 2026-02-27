# Phase 3: Real-time State Sync - Research

**Researched:** 2026-02-27
**Domain:** GENA/UPnP event subscriptions + WebSocket broadcast + in-memory state cache
**Confidence:** HIGH — core findings verified against installed library source code and official docs

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **State fields per zone:** play/pause, volume, mute, current track (title + artist + album), active source (Spotify/Deezer/TuneIn). No album art, no zone grouping.
- **Speaker offline behavior:** marked `unreachable` in cache, last state preserved. Events `speaker_online` / `speaker_offline` emitted over WebSocket.
- **WebSocket event format:** single event type `state_changed` with full zone state. No granular sub-events. ~300ms debounce on all event types.
- **Reconnection:** auto-reconnect with exponential backoff (1s, 2s, 4s…). Subtle UI indicator (color dot). On reconnect, server pushes full current state.
- **Concurrency target:** 5-20 simultaneous WebSocket clients (LAN internal tool).

### Claude's Discretion

- Fallback strategy when GENA fails (polling fallback vs retry with backoff)
- Initial snapshot delivery on WebSocket connection (full push vs separate REST call)
- Reconnect snapshot content (full state vs delta)

### Deferred Ideas (OUT OF SCOPE)

- Album art URL in synchronized state (v2, ZONE-03)
- Zone grouping in synchronization (v2, ZONE-04)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-03 | UI updates in real-time when state changes from another controller (Sonos app, voice, etc.) | GENA/UPnP via `@svrooij/sonos` SonosDevice.Events delivers push notifications within ~1s of real changes. WebSocket broadcast propagates immediately. Combined latency well under the 2s success criterion. |
</phase_requirements>

---

## Summary

Phase 3 has two distinct subsystems: (1) a **state cache + GENA event subscription layer** that watches every Sonos speaker for changes originating from any controller, and (2) a **WebSocket server** that broadcasts those changes to all connected browser clients with reconnection support.

The good news: the project already has `@svrooij/sonos@2.5.0` installed. Its `SonosDevice.Events` property provides typed, high-level events (`SonosEvents.Volume`, `SonosEvents.Mute`, `SonosEvents.CurrentTransportState`, `SonosEvents.CurrentTrackMetadata`, `SonosEvents.EnqueuedTransportUri`) driven by GENA/UPnP subscriptions. The library's `BaseService` handles subscription, auto-renewal every 10 minutes (for 3600s leases), and re-subscribe on renewal failure — so UPnP subscription lifecycle is fully handled. **We do not need to hand-roll GENA subscription management.**

For WebSocket, `@fastify/websocket@11.2.0` wraps `ws@8` and integrates cleanly with the existing Fastify v5 server. It exposes `fastify.websocketServer.clients` (a `Set<WebSocket>`) that allows broadcast from anywhere in the server process. This is the canonical approach for a simple broadcast server without Socket.IO overhead.

**Primary recommendation:** Use `SonosDevice.Events` (already in the project) for GENA push events. Add `@fastify/websocket` and `@types/ws` for the WebSocket layer. The state cache is a plain `Map<uuid, ZoneState>` in a Fastify plugin. Debounce with `setTimeout`/`clearTimeout`, no external library needed.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@svrooij/sonos` | 2.5.0 (installed) | GENA subscriptions via `SonosDevice.Events` | Already in project; handles UPnP subscribe/renew/unsubscribe automatically |
| `@fastify/websocket` | ^11.2.0 | WebSocket server on top of Fastify's HTTP server | Official Fastify plugin; shares same HTTP server — no extra port; exposes `fastify.websocketServer` |
| `ws` | ^8.19.0 (peer dep) | Underlying WebSocket engine | Already peer of `@fastify/websocket` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/ws` | latest | TypeScript types for `ws` client objects | Required when working with `fastify.websocketServer.clients` in TypeScript |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fastify/websocket` | Raw `ws.Server` attached manually | More control; but duplicates HTTP server setup and loses Fastify lifecycle integration |
| `@fastify/websocket` | `Socket.IO` | Auto-reconnect rooms; +50KB client bundle, unnecessary complexity for 5-20 LAN clients |
| `@svrooij/sonos` Events | Raw GENA HTTP server (hand-rolled) | Full control; but 200+ lines of HTTP SUBSCRIBE/NOTIFY handling, renewal timers, XML parsing — all already done by the library |
| In-memory debounce | `p-debounce` or `lodash.debounce` | External dependency; `setTimeout`/`clearTimeout` is sufficient for this use case |

**Installation:**
```bash
cd backend
npm install @fastify/websocket
npm install -D @types/ws
```

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/
├── plugins/
│   ├── env.ts            # existing
│   ├── sonos.ts          # existing — add: start GENA subscriptions, init state cache
│   └── websocket.ts      # NEW — registers @fastify/websocket, exposes fastify.broadcast()
├── services/
│   ├── discovery.ts      # existing
│   ├── registry.ts       # existing
│   ├── sonos-commands.ts # existing
│   ├── sonos-state.ts    # existing — extend SpeakerState type with track + source fields
│   └── state-cache.ts    # NEW — Map<uuid, ZoneState>, debounce logic, speaker_online/offline
├── routes/
│   ├── health.ts         # existing
│   ├── speakers.ts       # existing
│   └── ws.ts             # NEW — GET /ws WebSocket route handler (handshake + initial snapshot)
└── server.ts             # existing
```

### Pattern 1: SonosDevice.Events Subscription

**What:** Access `device.Events` to trigger GENA subscription automatically. Subscribe to specific typed events. The library's internal `SonosEventListener` singleton starts an HTTP server on port 6329 (env: `SONOS_LISTENER_PORT`) that Sonos speakers call back to.

**When to use:** For every coordinator device (transport events) and every speaker device (volume/mute events). Coordinators emit transport state and track changes; individual speakers emit volume/mute changes.

**Important architecture constraint:** `SonosDevice.Events.TransportState` is only emitted on coordinators that are NOT themselves a member of another group (i.e., `coordinator === undefined`). Zone members use `handleCoordinatorSimpleStateEvent`. Subscribe to transport events on the coordinator device obtained from the registry.

```typescript
// Source: @svrooij/sonos lib/sonos-device.js (verified in installed node_modules)
import { SonosEvents } from '@svrooij/sonos'

// On coordinator: transport state + track metadata
coordinator.Events.on(SonosEvents.CurrentTransportState, (state) => {
  // state: 'PLAYING' | 'PAUSED_PLAYBACK' | 'STOPPED' | 'TRANSITIONING'
  updateCache(coordinatorUuid, { playState: state })
})

coordinator.Events.on(SonosEvents.CurrentTrackMetadata, (track) => {
  // track: { Title?, Artist?, Album?, AlbumArtUri?, TrackUri?, ... }
  updateCache(coordinatorUuid, {
    title: track.Title ?? null,
    artist: track.Artist ?? null,
    album: track.Album ?? null,
  })
})

coordinator.Events.on(SonosEvents.EnqueuedTransportUri, (uri) => {
  // uri: identifies source — parse to determine Spotify/Deezer/TuneIn
  updateCache(coordinatorUuid, { source: parseSource(uri) })
})

// On each speaker: volume + mute (per-speaker, not coordinator)
device.Events.on(SonosEvents.Volume, (volume) => {
  // volume: number 0-100
  updateCache(speakerUuid, { volume })
})

device.Events.on(SonosEvents.Mute, (muted) => {
  // muted: boolean
  updateCache(speakerUuid, { muted })
})

// Subscription error handling
device.Events.on(SonosEvents.SubscriptionError, (error) => {
  fastify.log.warn('[gena] Subscription error for %s: %o', device.Name, error)
  // Mark as unreachable — see offline detection pattern below
})
```

### Pattern 2: State Cache with Debounce

**What:** An in-memory `Map<string, ZoneState>` where keys are speaker UUIDs. A separate debounce timer per UUID prevents broadcasting multiple events when volume + track change simultaneously in one Sonos event batch.

**When to use:** Always — even if only one event type changes, the debounce coalesces rapid successive changes (e.g., Sonos fires volume + mute in quick succession).

```typescript
// Source: design pattern, verified against user decision (300ms debounce, full state push)
interface ZoneState {
  uuid: string
  name: string
  playState: string          // 'PLAYING' | 'PAUSED_PLAYBACK' | 'STOPPED' | 'TRANSITIONING' | 'UNKNOWN'
  volume: number
  muted: boolean
  title: string | null
  artist: string | null
  album: string | null
  source: string | null      // 'spotify' | 'deezer' | 'tunein' | 'library' | null
  reachable: boolean
  lastSeen: number           // Date.now()
}

// Debounce map: uuid → NodeJS.Timeout
const debounceTimers = new Map<string, NodeJS.Timeout>()

function scheduleUpdate(uuid: string): void {
  const existing = debounceTimers.get(uuid)
  if (existing) clearTimeout(existing)
  debounceTimers.set(uuid, setTimeout(() => {
    debounceTimers.delete(uuid)
    broadcastStateChanged(uuid)
  }, 300))
}
```

### Pattern 3: WebSocket Broadcast via @fastify/websocket

**What:** Register `@fastify/websocket` plugin. Add a GET /ws route with `{ websocket: true }`. On connection, push full state snapshot. Decorate Fastify with a `broadcast(event, data)` helper that iterates `fastify.websocketServer.clients`.

**When to use:** Single broadcast function used by the state cache layer whenever debounce fires.

```typescript
// Source: github.com/fastify/fastify-websocket README (verified Feb 2026)
// plugins/websocket.ts
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import websocketPlugin from '@fastify/websocket'
import type { WebSocket } from 'ws'

declare module 'fastify' {
  interface FastifyInstance {
    broadcast(event: string, data: unknown): void
  }
}

const websocketPluginWrapper: FastifyPluginAsync = async (fastify) => {
  await fastify.register(websocketPlugin)

  fastify.decorate('broadcast', (event: string, data: unknown) => {
    const message = JSON.stringify({ event, data })
    for (const client of fastify.websocketServer.clients) {
      if (client.readyState === (client as WebSocket).OPEN) {
        client.send(message)
      }
    }
  })
}

export default fp(websocketPluginWrapper, { name: 'websocket-plugin' })
```

```typescript
// routes/ws.ts — WebSocket handshake route
const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket, _req) => {
    // On connect: immediately push full state snapshot
    const snapshot = fastify.stateCache.getAll()
    socket.send(JSON.stringify({ event: 'snapshot', data: snapshot }))

    socket.on('close', () => {
      fastify.log.info('[ws] Client disconnected')
    })
    // No incoming message handling needed — server→client only
  })
}
```

### Pattern 4: Source Detection from EnqueuedTransportURI

**What:** Parse the `EnqueuedTransportURI` string emitted by `SonosEvents.EnqueuedTransportUri` to determine which streaming service is active.

**Verified URI schemes** (from WebSearch, MEDIUM confidence — community-verified patterns):

```typescript
// Source: community docs + HomeSeer forum (MEDIUM confidence — multi-source agreement)
function parseSource(uri: string | undefined | null): string | null {
  if (!uri) return null
  if (uri.startsWith('x-sonos-spotify:'))       return 'spotify'
  if (uri.startsWith('x-deezer-user:') ||
      uri.includes('deezer'))                    return 'deezer'
  if (uri.startsWith('x-sonosapi-radio:') ||
      uri.startsWith('x-sonosapi-stream:') ||
      uri.startsWith('x-rincon-mp3radio:') ||
      uri.startsWith('hls-radio:'))              return 'tunein'
  if (uri.startsWith('x-file-cifs:') ||
      uri.startsWith('x-rincon-playlist:'))      return 'library'
  return null  // Unknown source — do not guess
}
```

Note: The exact Deezer URI prefix is MEDIUM confidence. `x-deezer-user:` appears in community docs; fall back to checking for `deezer` in the string as a safety net. Validate against real hardware during implementation.

### Pattern 5: Speaker Offline Detection

**What:** GENA subscriptions silently stop delivering events when a speaker goes offline. Two complementary approaches are needed.

**Recommended approach (Claude's discretion):**

1. **Heartbeat poll per speaker** — a simple `setInterval` every 30s that sends a lightweight SOAP `GetTransportInfo` (or similar) to each speaker. On `ECONNREFUSED`/timeout, mark `reachable: false` and emit `speaker_offline` WebSocket event.
2. **GENA `SubscriptionError` handler** — `device.Events.on(SonosEvents.SubscriptionError, ...)` fires when renewal fails, signaling the speaker may be unreachable. Use as an early warning trigger.
3. **Recovery** — when heartbeat succeeds again after `unreachable`, mark `reachable: true`, re-read full state via existing `readSpeakerState()`, update cache, emit `speaker_online`.

This avoids a full polling fallback for all state (which would bypass the <2s latency requirement) while still detecting offline speakers.

```typescript
// Heartbeat pattern
const HEARTBEAT_INTERVAL_MS = 30_000

function startHeartbeat(fastify: FastifyInstance): void {
  setInterval(async () => {
    for (const speaker of fastify.speakers.getAll()) {
      try {
        await soapGetTransportInfo(speaker.ip) // lightweight ping
        if (!fastify.stateCache.isReachable(speaker.uuid)) {
          fastify.stateCache.markReachable(speaker.uuid, true)
          fastify.broadcast('speaker_online', { uuid: speaker.uuid })
        }
      } catch {
        if (fastify.stateCache.isReachable(speaker.uuid)) {
          fastify.stateCache.markReachable(speaker.uuid, false)
          fastify.broadcast('speaker_offline', { uuid: speaker.uuid })
        }
      }
    }
  }, HEARTBEAT_INTERVAL_MS)
}
```

### Pattern 6: Client-side Exponential Backoff Reconnection

**What:** Browser-side vanilla JS auto-reconnect with exponential backoff (no library needed).

**When to use:** In the Vue frontend (Phase 5), not in the backend. Document here so the planner knows the client pattern.

```javascript
// Source: standard pattern, verified across multiple 2024-2025 sources
function connectWebSocket(url) {
  let delay = 1000
  const MAX_DELAY = 16000

  function connect() {
    const ws = new WebSocket(url)

    ws.onopen = () => {
      delay = 1000  // reset on success
      updateIndicator('connected')
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      handleMessage(msg)  // dispatch to state store
    }

    ws.onclose = () => {
      updateIndicator('disconnected')
      setTimeout(connect, delay)
      delay = Math.min(delay * 2, MAX_DELAY)
    }

    ws.onerror = () => ws.close()  // triggers onclose → reconnect
  }

  connect()
}
```

### Anti-Patterns to Avoid

- **Subscribing to `SonosDevice.Events` on every speaker for transport state:** Only coordinators emit `CurrentTransportState`. Zone members only emit volume/mute. Get the coordinator via `SpeakerRegistry.getCoordinator(uuid)` and subscribe there for transport.
- **Sharing one SonosDevice instance between discovery and event subscriptions without the library's event wiring:** The `SonosDevice` objects from `SonosManager.Devices` are the same instances used for events — do NOT create new `SonosDevice(ip)` instances; reuse from `sonosDevices` map (already in `fastify.sonosDevices`).
- **Calling `device.Events` on zone group members for transport:** Zone members with a coordinator emit simplified group transport state, not full `TransportState`. Subscribe transport events on the coordinator only.
- **Registering `@fastify/websocket` after routes:** Per the plugin README, `@fastify/websocket` must be registered before any routes so it can intercept upgrade requests. Register it in `buildApp()` before `speakerRoutes`.
- **Sending WebSocket messages without checking `readyState === WebSocket.OPEN`:** Dead/half-open connections exist in `clients` set until cleaned up. Always guard with `client.readyState === WebSocket.OPEN`.
- **Not cleaning up `setInterval` and event listeners on Fastify close:** Memory leaks and duplicate events on restart. Use `fastify.addHook('onClose', ...)` to call `device.CancelEvents()` and `clearInterval()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GENA HTTP server for UPnP event callbacks | Custom `http.createServer` NOTIFY handler | `@svrooij/sonos` `SonosDevice.Events` | Library already handles SUBSCRIBE, auto-renew (every 10min for 3600s lease), re-subscribe on failure, XML parsing of NOTIFY bodies |
| UPnP subscription renewal timers | `setInterval` with SUBSCRIBE HTTP calls | `@svrooij/sonos` BaseService `eventRenewInterval` | Already implemented: renews at 10-minute intervals, falls back to re-subscribe if renewal fails |
| WebSocket server lifecycle (upgrade, close, ping/pong) | Raw `ws.Server` instance | `@fastify/websocket` | Shares Fastify's HTTP server, proper lifecycle hooks, TypeScript types included |
| Debounce library | `lodash.debounce` or `p-debounce` | `setTimeout`/`clearTimeout` per UUID | Zero deps; 3 lines; exactly sufficient for this use case |

**Key insight:** The GENA subscription lifecycle (subscribe → notify → renew → unsubscribe) has been the hardest part of Sonos integrations historically. `@svrooij/sonos` encapsulates it entirely. The only work is wiring the emitted events into the state cache.

---

## Common Pitfalls

### Pitfall 1: SonosEventListener Port Conflict or Wrong Host IP

**What goes wrong:** `@svrooij/sonos` SonosEventListener starts an internal HTTP server on port 6329 (configurable via `SONOS_LISTENER_PORT` env var). This is separate from Fastify's port 3000. In Docker with `network_mode: host`, the speakers on the LAN can reach the container's host IP directly — this works. In a Docker bridge network, the container IP may not be routable from the speakers.

**Why it happens:** The library auto-detects host IP using `os.networkInterfaces()`, filtering out `vEthernet` and `tun*` interfaces on Windows. The detected IP is what gets sent to speakers as the NOTIFY callback URL. If detection picks the wrong interface, events never arrive.

**How to avoid:** Set `SONOS_LISTENER_HOST` env var to the explicit LAN IP of the machine running the backend. Already mitigated by `network_mode: host` in docker-compose, but add the env var explicitly for clarity. The `sonosPlugin` should call `SonosEventListener.DefaultInstance.UpdateSettings({ host: explicitIp, port: 6329 })` if `SONOS_LISTENER_HOST` is not set.

**Warning signs:** GENA subscriptions succeed (HTTP 200 with `sid` header) but no events are received. Check `SonosEventListener.DefaultInstance.GetStatus()` for the `subscriptionUrl` and verify it's reachable from a speaker.

### Pitfall 2: Transport State Only Fires on Coordinators

**What goes wrong:** Subscribing to `SonosEvents.CurrentTransportState` on a zone member device (not the coordinator) yields no events. Zone members emit a simplified `GroupTransportState` via `handleCoordinatorSimpleStateEvent`, not the full `TransportState`.

**Why it happens:** The library only processes `data.TransportState` in `handleAvTransportEvent` when `this.coordinator === undefined` (i.e., the device itself is a coordinator). Zone members delegate to the coordinator's state.

**How to avoid:** Always subscribe transport events on the coordinator. Use `SpeakerRegistry.getCoordinator(uuid)` then get the `SonosDevice` from `fastify.sonosDevices.get(coordinator.uuid)`.

### Pitfall 3: Volume/Mute Changes Not Firing for Zone Group Members

**What goes wrong:** Volume events from `SonosEvents.Volume` don't fire on the coordinator — only on the individual speaker device that received the volume change. Group coordinators only emit `Volume` if they themselves were the target of the volume SOAP command.

**Why it happens:** Volume is per-speaker RenderingControl, not group-level. Each speaker has its own `RenderingControlService` subscription.

**How to avoid:** Subscribe `SonosEvents.Volume` and `SonosEvents.Mute` on EVERY discovered device (not just coordinators). The UUID in the event callback must be the individual speaker's UUID to correctly update per-speaker volume in the cache.

### Pitfall 4: Debounce Race — State Cache Read Before Write Completes

**What goes wrong:** When both a transport state change and a track metadata change arrive in the same GENA notification batch, the debounce fires once but reads the cache before the second write has been applied.

**Why it happens:** GENA `LastChange` XML can contain multiple changed properties in one NOTIFY call. `@svrooij/sonos` processes them sequentially and emits events one at a time. All 300ms debounce timers are reset on each write, so the broadcast fires after the last write — which is correct. But if writes happen in different microtasks, the timing depends on event loop scheduling.

**How to avoid:** Mutate the cache synchronously before calling `scheduleUpdate()`. Never do async reads in the update path. The cache write and `scheduleUpdate` call must be in the same synchronous block.

### Pitfall 5: WebSocket Events Attachment Must Be Synchronous

**What goes wrong:** Attaching `socket.on('message')` or `socket.on('close')` inside an `await` causes dropped messages during the async gap.

**Why it happens:** `@fastify/websocket` README explicitly warns: "Websocket route handlers must attach event handlers synchronously during handler execution."

**How to avoid:** All `socket.on(...)` calls in the ws route handler must be synchronous, before any `await`.

### Pitfall 6: `CancelEvents()` Not Called on Shutdown

**What goes wrong:** On `fastify.close()`, GENA subscriptions are not cancelled. The Sonos speaker continues sending NOTIFY callbacks to the now-dead listener port, accumulating failed deliveries. On restart, the `SonosEventListener` may receive stale NOTIFY messages before re-subscribing.

**Why it happens:** `SonosDevice.CancelEvents()` sends an HTTP UNSUBSCRIBE to the speaker — this must be called explicitly on shutdown.

**How to avoid:**
```typescript
fastify.addHook('onClose', async () => {
  for (const [, device] of fastify.sonosDevices) {
    device.CancelEvents()
  }
})
```

### Pitfall 7: SpeakerState Type Is Incomplete for Phase 3

**What goes wrong:** The existing `SpeakerState` in `sonos-state.ts` only has `playState`, `volume`, `muted`. Phase 3 introduces a richer `ZoneState` with `title`, `artist`, `album`, `source`, `reachable`. Forgetting to extend or replace the type causes the cache to broadcast incomplete state.

**Why it happens:** Phase 2 built state reading as best-effort after commands. Phase 3 promotes state to a first-class long-lived cache object.

**How to avoid:** Define a new `ZoneState` interface (in `state-cache.ts`) distinct from the existing `SpeakerState`. Don't modify `sonos-state.ts` — that service is still used for post-command state reads in Phase 2 routes.

---

## Code Examples

Verified patterns from official sources and installed library source:

### Subscribe to coordinator events (transport + track)

```typescript
// Source: @svrooij/sonos lib/sonos-device.js (installed node_modules, verified 2026-02-27)
import { SonosEvents } from '@svrooij/sonos'

function subscribeCoordinator(
  device: SonosDevice,
  coordinatorUuid: string,
  stateCache: StateCache,
  broadcast: (event: string, data: unknown) => void,
): void {
  device.Events.on(SonosEvents.CurrentTransportState, (state) => {
    stateCache.patch(coordinatorUuid, { playState: state })
    stateCache.scheduleUpdate(coordinatorUuid)
  })

  device.Events.on(SonosEvents.CurrentTrackMetadata, (track) => {
    stateCache.patch(coordinatorUuid, {
      title: track.Title ?? null,
      artist: track.Artist ?? null,
      album: track.Album ?? null,
    })
    stateCache.scheduleUpdate(coordinatorUuid)
  })

  device.Events.on(SonosEvents.EnqueuedTransportUri, (uri) => {
    stateCache.patch(coordinatorUuid, { source: parseSource(uri) })
    stateCache.scheduleUpdate(coordinatorUuid)
  })

  device.Events.on(SonosEvents.SubscriptionError, (err) => {
    stateCache.markReachable(coordinatorUuid, false)
    broadcast('speaker_offline', { uuid: coordinatorUuid })
  })
}
```

### Subscribe to per-speaker volume/mute

```typescript
// Source: @svrooij/sonos lib/sonos-device.js (installed node_modules, verified 2026-02-27)
function subscribeSpeaker(
  device: SonosDevice,
  speakerUuid: string,
  stateCache: StateCache,
): void {
  device.Events.on(SonosEvents.Volume, (volume) => {
    stateCache.patch(speakerUuid, { volume })
    stateCache.scheduleUpdate(speakerUuid)
  })

  device.Events.on(SonosEvents.Mute, (muted) => {
    stateCache.patch(speakerUuid, { muted })
    stateCache.scheduleUpdate(speakerUuid)
  })
}
```

### Broadcast from Fastify plugin

```typescript
// Source: github.com/fastify/fastify-websocket README (verified Feb 2026)
import type { WebSocket } from 'ws'

// In websocket plugin:
fastify.decorate('broadcast', (event: string, data: unknown) => {
  const message = JSON.stringify({ event, data })
  for (const client of fastify.websocketServer.clients) {
    if ((client as WebSocket).readyState === 1 /* WebSocket.OPEN */) {
      client.send(message)
    }
  }
})
```

### Initial snapshot on WebSocket connect

```typescript
// Source: design pattern (Claude's discretion — full state push on connect)
fastify.get('/ws', { websocket: true }, (socket, _req) => {
  // Push full state synchronously on connect (before any awaits)
  const snapshot = fastify.stateCache.getAll() // ZoneState[]
  socket.send(JSON.stringify({ event: 'snapshot', data: snapshot }))

  socket.on('close', () => {
    fastify.log.info('[ws] Client disconnected')
  })
})
```

### Initial state hydration (on server start, before events begin)

```typescript
// Read initial state for all speakers via existing readSpeakerState()
// so cache is populated immediately (not empty until first GENA event)
for (const speaker of fastify.speakers.getAll()) {
  const coordinator = fastify.speakers.getCoordinator(speaker.uuid)!
  const state = await readSpeakerState(speaker.ip, coordinator.ip).catch(() => null)
  fastify.stateCache.initialize(speaker.uuid, {
    uuid: speaker.uuid,
    name: speaker.name,
    playState: state?.playState ?? 'UNKNOWN',
    volume: state?.volume ?? 0,
    muted: state?.muted ?? false,
    title: null,
    artist: null,
    album: null,
    source: null,
    reachable: state !== null,
    lastSeen: Date.now(),
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling Sonos REST every N seconds | GENA/UPnP push events | N/A (GENA always existed) | Sub-second latency; no unnecessary traffic |
| Raw GENA HTTP server (hand-rolled) | `@svrooij/sonos` SonosDevice.Events | Library available since ~2020 | 200+ lines of subscription boilerplate eliminated |
| Socket.IO for WebSocket | `ws` + `@fastify/websocket` | ~2021 for LAN-scale apps | 50KB+ client bundle savings; no overhead for rooms/namespaces |
| `fastify-websocket` (unofficial) | `@fastify/websocket` (official) | v4+ Fastify era | Official plugin with Fastify 5 compatibility |

**Deprecated/outdated:**
- `fastify-ws`: Unofficial, unmaintained, not compatible with Fastify v5. Use `@fastify/websocket`.
- `ServiceEvents.Data` and `ServiceEvents.LastChange` in `@svrooij/sonos`: Deprecated aliases for `ServiceEvents.ServiceEvent`. Use `ServiceEvents.ServiceEvent` or preferably `SonosEvents.*` on `SonosDevice.Events`.

---

## Open Questions

1. **Deezer URI prefix on current Sonos firmware**
   - What we know: `x-deezer-user:` appears in community docs; `deezer` substring match is a fallback
   - What's unclear: Whether current Deezer integration on S2 firmware uses a different URI scheme
   - Recommendation: Log the raw `EnqueuedTransportURI` value during development when Deezer is playing; verify against the parseSource() implementation before shipping

2. **GENA subscription success on actual hardware (first connection)**
   - What we know: `@svrooij/sonos` BaseService sends SUBSCRIBE and expects `sid` header back. If speaker returns non-OK or missing `sid`, it throws. The Phase 1 spike confirmed direct SOAP works, but GENA was not tested.
   - What's unclear: Whether the SonosEventListener's auto-detected IP will be correct in the dev environment (Windows with multiple virtual interfaces)
   - Recommendation: Set `SONOS_LISTENER_HOST` explicitly in `.env` / docker-compose to the LAN IP. Add a log statement in the `sonosPlugin` that prints `SonosEventListener.DefaultInstance.GetStatus()` during startup.

3. **How to wire subscription start into existing sonosPlugin lifecycle**
   - What we know: `sonosPlugin` runs at startup, populates `fastify.speakers` and `fastify.sonosDevices`. GENA subscriptions should start after the WebSocket plugin is ready (so broadcast is available).
   - What's unclear: Whether GENA subscriptions should start in `sonosPlugin` (after decorating) or in a separate `genaPlugin` that depends on both `sonos` and `websocket-plugin`.
   - Recommendation: Create a dedicated `gena.ts` Fastify plugin with `dependencies: ['sonos', 'websocket-plugin']`. This keeps concerns separate and avoids circular dependency between event wiring and broadcast.

4. **State cache lifetime for offline speakers**
   - What we know: User decision: last state preserved when speaker goes unreachable.
   - What's unclear: What happens when a speaker comes back with different track (e.g., user was playing from the Sonos app while backend was down). The heartbeat recovery path calls `readSpeakerState()` (volume/play/mute), but track metadata comes from GENA.
   - Recommendation: On `speaker_online`, call `readSpeakerState()` for volume/play/mute, then also fire `GetPositionInfo` SOAP to get current track metadata, update cache fully before broadcasting `speaker_online`.

---

## Sources

### Primary (HIGH confidence)

- `@svrooij/sonos@2.5.0` installed source: `backend/node_modules/@svrooij/sonos/lib/` — `sonos-device.js`, `services/base-service.js`, `sonos-event-listener.js`, `models/sonos-events.js` — all event types, subscription lifecycle, renewal timing, host detection verified by direct inspection
- `@fastify/websocket` GitHub README (github.com/fastify/fastify-websocket) — registration, `websocketServer.clients`, TypeScript requirements, sync handler attachment rule

### Secondary (MEDIUM confidence)

- WebSearch: `@fastify/websocket` current version is 11.2.0 (per npm metadata, published ~7 months ago), `ws` is 8.19.0 — matches peer dependency chain
- WebSearch + community docs (HomeSeer, webCoRE, SoCo): Sonos URI scheme patterns for source identification (`x-sonos-spotify:`, `x-sonosapi-radio:`, etc.) — multi-source agreement raises confidence to MEDIUM
- svrooij.io events documentation (sonos-ts.svrooij.io/sonos-device/events.html) — confirms `SonosEvents.Volume`, `SonosEvents.CurrentTrackUri`, subscription pattern

### Tertiary (LOW confidence)

- Deezer URI prefix (`x-deezer-user:`) — single source, not independently verified against current firmware. Must validate on real hardware.
- GENA subscription reliability (33% success rate claim from WebSearch) — single blog post, not verified. The project already confirmed UPnP works on real hardware (Phase 1 spike), so this is low concern.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against installed node_modules and official Fastify docs
- Architecture: HIGH — patterns derived from actual library internals, not docs
- Pitfalls: HIGH (transport/volume subscription rules), MEDIUM (GENA host detection on specific network), LOW (Deezer URI)
- Source detection: MEDIUM — community-verified patterns, real-hardware validation required

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (30 days — stable libraries, Sonos UPnP protocol rarely changes)
