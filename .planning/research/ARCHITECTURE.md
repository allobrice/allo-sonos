# Architecture Patterns

**Domain:** Sonos Controller Web App
**Researched:** 2026-02-25
**Confidence:** MEDIUM — Training data (Aug 2025 cutoff). Core Sonos UPnP/SOAP architecture is stable across years; confidence HIGH for browser constraints and UPnP protocol patterns. S2 Local HTTP API coverage and music service details flagged MEDIUM — verify against current Sonos developer docs.

---

## Recommended Architecture

```
+------------------+        HTTP REST         +-------------------+
|   Browser (SPA)  | -----------------------> |  Node.js Backend  |
|                  |                          |   (Proxy + API)   |
|  React UI        | <----------------------- |                   |
|  Zone picker     |    WebSocket (push)      |  Express REST     |
|  Now-playing     |                          |  WebSocket server |
|  Queue view      |                          |  State cache      |
+------------------+                          +--------+----------+
                                                       |
                              +------------------+     |  UPnP/SOAP (port 1400)
                              |  Sonos Speaker 1 | <---+  or S2 Local HTTP API
                              |  (Zone Player)   |     |
                              +------------------+     |  UPnP GENA events
                              +------------------+     |  (speaker → backend)
                              |  Sonos Speaker 2 | <---+
                              +------------------+     |
                              +------------------+     |
                              |  Sonos Speaker N | <---+
                              +------------------+
```

### Why a Backend Proxy Is Mandatory

Browsers cannot communicate with Sonos speakers directly. Three hard constraints make this impossible without a backend:

1. **CORS blocks UPnP/SOAP.** Sonos speakers on port 1400 return no CORS headers. Any `fetch()` from `localhost:3000` to `192.168.x.x:1400` is blocked before the request reaches the speaker.

2. **SSDP discovery requires UDP multicast.** Browsers have no UDP socket API. SSDP (the speaker discovery protocol) sends multicast datagrams on `239.255.255.250:1900`. Only a native process running on the LAN can do this.

3. **UPnP event callbacks require an HTTP listener.** When a speaker changes state, it pushes an HTTP NOTIFY callback to a URL you provide at subscription time. Browsers cannot act as HTTP servers; they have no publicly addressable URL on the LAN.

**Consequence:** A backend server (Node.js) running on the same LAN is the only viable architecture. It acts as:
- An SSDP discovery agent
- A UPnP/SOAP command translator (REST in, SOAP out)
- A UPnP event receiver (SOAP in, WebSocket push out)

**Confidence: HIGH** — These are fundamental browser security constraints, not Sonos-specific. They will not change.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Browser SPA** | Renders UI; handles user interaction; displays real-time zone state | Backend via HTTP REST (commands) + WebSocket (state) |
| **Backend REST API** | Translates JSON commands from browser into UPnP/SOAP calls to speakers; returns JSON | Browser (inbound JSON), Sonos speakers (outbound SOAP) |
| **Backend WebSocket Server** | Pushes zone state changes to all connected browser clients in real time | Browser (push outbound), State Cache (read) |
| **SSDP Discovery Service** | Multicast UDP discovery of all Sonos devices on LAN; builds device registry | LAN broadcast (`239.255.255.250:1900`), Speaker Registry |
| **Speaker Registry** | Maps UUID → IP, name, model, capabilities; updated on topology changes | SSDP Service (write), Zone Manager (read) |
| **UPnP Event Subscriber (GENA)** | Subscribes to speaker NOTIFY callbacks for AVTransport, RenderingControl, ZoneGroupTopology; renews subscriptions before expiry | Sonos speakers (outbound SUBSCRIBE, inbound NOTIFY), State Cache (write) |
| **State Cache** | In-memory snapshot of all zone states: playback status, current track, volume, group membership, queue position | Event Subscriber (write), REST API (read), WebSocket Server (read) |
| **Zone/Group Manager** | Tracks group topology; resolves coordinator for each group; handles group join/leave/separate | ZoneGroupTopology events (input), REST API (queried by) |
| **Music Service Adapter** | Formats service-specific content URIs and DIDL-Lite metadata for Sonos (Spotify URIs, TuneIn stream URLs, Deezer tracks) | REST API (called by), Sonos speakers (URI format consumed by) |

---

## Data Flow

### Command Flow (user action → speaker)

```
User clicks "Play" in SPA
  │
  ▼
Browser: POST /api/zones/{roomName}/play
  │
  ▼
Backend REST API
  ├─ Looks up zone in Zone/Group Manager
  ├─ Resolves coordinator speaker (must command coordinator, not member)
  └─ Builds UPnP SOAP envelope: AVTransport:Play
       │
       ▼
     HTTP POST http://{coordinatorIP}:1400/MediaRenderer/AVTransport/Control
       │
       ▼
     Speaker executes, returns SOAP 200
       │
       ▼
     Backend returns JSON 200 to browser
       │
       ▼
     [Speaker state change triggers GENA event → see State Update Flow]
```

### State Update Flow (speaker → browser, real-time)

```
Speaker state changes (track advances, another app pauses, volume adjusted)
  │
  ▼
Speaker: HTTP NOTIFY POST to http://{backendIP}:{port}/events/avtransport
  Body: XML with LastChange element containing new transport state
  │
  ▼
Backend UPnP Event Subscriber
  ├─ Parses LastChange XML (AVTransport state variables)
  └─ Updates State Cache for affected zone
       │
       ▼
     Backend WebSocket Server
       ├─ Broadcasts state delta to ALL connected browser clients
       └─ Message format: { type: "zone:update", zoneId: "...", state: {...} }
              │
              ▼
            Browser WebSocket client
              ├─ Receives event
              ├─ Updates Zustand/Redux store
              └─ React re-renders affected zone components
```

### Initial Load Flow (startup / reconnect)

```
Backend starts
  │
  ├─ SSDP M-SEARCH multicast → discovers all Sonos speakers
  ├─ Fetches device descriptions (XML) from each speaker's port 1400
  ├─ Populates Speaker Registry (UUID → IP, name, model)
  ├─ Queries ZoneGroupTopology from any speaker → builds group map
  └─ Subscribes to UPnP events from each speaker (AVTransport, RenderingControl, ZoneGroupTopology)

Browser connects
  │
  ├─ GET /api/zones → full snapshot of all zones and their current state
  └─ Opens WebSocket → backend sends state:full snapshot immediately on connect
       │
       └─ Subsequent WebSocket messages are deltas only
```

### Music Service Flow

See dedicated section below for detail on Spotify Connect, Deezer, TuneIn.

---

## WebSocket vs. Polling: Why WebSocket Wins

This is the most important real-time design decision.

### Polling (rejected)

```
Browser: every 2 seconds → GET /api/zones
Backend: queries State Cache → returns JSON
```

**Problems:**
- State lag: up to 2 seconds between a track skip and the UI updating. Feels broken.
- Rapid transitions missed: if a speaker skips a track and auto-advances in < 2s, the intermediate track never appears in the UI.
- N clients × 1 poll/2s = wasted backend load with no quality benefit.
- No way to detect "speaker disappeared from LAN" quickly.

### WebSocket (recommended)

```
Backend → Browser: push on every state change (~100ms from event receipt)
```

**Benefits:**
- Sub-200ms UI updates after any speaker state change.
- Rapid transitions all captured (GENA fires for each state change).
- Server controls broadcast; all clients synchronized without individual polling.
- Connection state itself signals speaker connectivity (backend disconnects client if speaker goes offline).

**Implementation note:** WebSocket is one-directional for state (server → client). Commands remain HTTP REST (client → server). Do not mix commands into the WebSocket channel — request/response correlation over WebSocket adds complexity with no benefit.

**Confidence: HIGH** — GENA + WebSocket is the established pattern for all mature Sonos OSS controllers (node-sonos-http-api, Sonos Web, SoCo-based apps).

---

## Multi-Zone / Multi-Room Handling

Sonos groups speakers into "zone groups." This is the most Sonos-specific architectural concern.

### Key Concepts

| Term | Meaning |
|------|---------|
| Zone Player | A single physical Sonos speaker |
| Zone Group | One or more speakers playing in sync |
| Coordinator | The one speaker in a group that controls playback; all group commands go to it |
| Group Member | A speaker following a coordinator; ignores direct AVTransport commands |
| Standalone | A zone group with exactly one speaker (its own coordinator) |

### Why Coordinator Routing Matters

Sonos speakers in a group share audio state via the coordinator. Sending `AVTransport:Play` to a non-coordinator member is silently ignored. The Zone/Group Manager component exists specifically to resolve the coordinator before every group-level command.

```typescript
// WRONG — sends play to arbitrary group member
await avTransportService(anyMember.ip).play();

// CORRECT — always resolve coordinator first
const coordinator = zoneManager.getCoordinator(groupId);
await avTransportService(coordinator.ip).play();
```

**Volume is different.** `RenderingControl:SetVolume` goes to the individual speaker, not the coordinator. Each speaker in a group has its own volume.

### ZoneGroupTopology Events

The `ZoneGroupTopology` UPnP service fires an event whenever:
- A speaker joins or leaves a group (user groups speakers in the Sonos app)
- A speaker goes offline or comes back online
- Group coordinator changes

**The backend must subscribe to this service and update its group map on every event.** If it does not, the coordinator routing breaks whenever the user rearranges groups in the Sonos app.

```
SUBSCRIBE http://{anySpkIP}:1400/ZoneGroupTopology/Event
  CALLBACK: <http://{backendIP}:{port}/events/topology>
  NT: upnp:event
  TIMEOUT: Second-1800

On NOTIFY to /events/topology:
  Parse ZoneGroupState XML
  Rebuild coordinator map: { groupId → coordinatorIP }
  Broadcast topology change to browser WebSocket clients
```

### API Surface for Multi-Zone

```
GET  /api/zones                        → all zone groups with state
GET  /api/zones/{roomName}             → single zone state
POST /api/zones/{roomName}/play        → play (routed to coordinator)
POST /api/zones/{roomName}/pause       → pause
POST /api/zones/{roomName}/volume      → body: { volume: 0-100 } (to specific speaker)
POST /api/zones/{roomName}/groupVolume → body: { volume: 0-100 } (to all group members)
POST /api/zones/{roomName}/join        → body: { targetRoom: "..." } (add to group)
POST /api/zones/{roomName}/leave       → remove from group (become standalone)
```

---

## Music Service Integration Architecture

### How Sonos Handles Music Services

Sonos speakers handle music service authentication and streaming directly. The web controller does not proxy audio streams. This is critical: your backend never touches audio data.

```
Speaker ←→ Spotify CDN   (audio stream, authenticated by speaker's Spotify token)
Speaker ←→ Deezer CDN    (audio stream)
Speaker ←→ TuneIn CDN    (audio stream)

Backend → Speaker        (only: "play this URI" commands)
```

### Option A: Spotify Connect (recommended for Spotify)

Spotify Connect is a protocol layer where Sonos speakers register as Spotify Connect targets. The user controls playback from the Spotify app or any Connect-aware client.

```
Architecture:
  [Spotify App / your SPA via Spotify Web Playback SDK]
    │
    │  Spotify Connect API (to Spotify cloud)
    ▼
  Spotify Cloud
    │
    │  Selects Sonos as target device
    ▼
  Sonos Speaker (fetches from Spotify CDN directly)

Your backend role:
  - None for audio control (Spotify handles it)
  - For "queue this track on Sonos," can send Spotify URI via UPnP:
      SetAVTransportURI: x-sonos-spotify:spotify:track:{id}
      + DIDL-Lite metadata with Spotify track info
```

**Confidence: MEDIUM** — Spotify Connect on Sonos is well-established, but URI format details should be verified against current node-sonos docs.

### Option B: TuneIn Radio (simplest integration)

```
Backend:
  - Constructs TuneIn URI: x-sonosapi-stream:s{stationId}?sid=254&flags=32
  - Sends SetAVTransportURI to speaker coordinator
  - No OAuth required; TuneIn is built into Sonos firmware

Browser UI:
  - Browses TuneIn via backend proxy to Sonos ContentDirectory service
  - Or uses TuneIn's own API for station search, then passes station ID to backend
```

### Option C: Deezer

```
Similar to Spotify:
  URI format: x-sonos-http:track:{deezerId}.mp3?sid={serviceId}
  + DIDL-Lite metadata required
  Deezer must be linked in user's Sonos account for speaker to have auth token

Backend role: URI formatting only
```

### Option D: Custom SMAPI Music Service (advanced, not recommended for v1)

SMAPI (Sonos Music API) allows you to expose a custom music library as a Sonos music source. The speaker calls your backend's SOAP endpoints for browse and playback. Very high complexity — implement only if you need to expose a local music library not already supported by Sonos.

### Music Service Integration Summary

| Service | Auth Held By | Backend Role | Complexity |
|---------|-------------|--------------|------------|
| Spotify | Sonos speaker | Format URI + metadata | Low |
| Deezer | Sonos speaker | Format URI + metadata | Low |
| TuneIn | None (built-in) | Format URI | Very Low |
| Apple Music | Sonos speaker | Format URI + metadata | Low |
| Custom library | Your backend (SMAPI) | Full SMAPI server | Very High |

**Recommendation:** For v1, support TuneIn (no auth friction) and Spotify URI queueing (user must have Spotify linked in Sonos app). Defer Deezer to v2. Do not implement SMAPI.

---

## Patterns to Follow

### Pattern 1: UPnP Service Abstraction Layer

**What:** Wrap each Sonos UPnP service (AVTransport, RenderingControl, ContentDirectory, ZoneGroupTopology) behind typed TypeScript classes. Never write raw SOAP XML in business logic — only in the service layer.

**When:** Always. Raw SOAP XML scattered across REST handlers is unmaintainable and error-prone (Sonos has non-standard namespaces).

**Example:**

```typescript
// services/AVTransportService.ts
export class AVTransportService {
  constructor(private readonly deviceIP: string) {}

  async play(instanceId = 0): Promise<void> {
    await this.soapRequest('AVTransport', 'Play', {
      InstanceID: instanceId,
      Speed: '1',
    });
  }

  async setAVTransportURI(uri: string, metadata: string): Promise<void> {
    await this.soapRequest('AVTransport', 'SetAVTransportURI', {
      InstanceID: 0,
      CurrentURI: uri,
      CurrentURIMetaData: metadata,
    });
  }

  private async soapRequest(service: string, action: string, args: Record<string, unknown>) {
    // builds SOAP envelope, POSTs to http://{this.deviceIP}:1400/..., parses response
  }
}
```

### Pattern 2: ZoneGroupTopology as Source of Truth

**What:** Always use the ZoneGroupTopology data to route commands. Cache and update on topology events. Never hardcode speaker-to-group relationships.

**When:** Before every group-level command. On every topology NOTIFY event.

**Example:**

```typescript
// zone-manager.ts
class ZoneGroupManager {
  private groups: Map<string, ZoneGroup> = new Map();

  onTopologyEvent(xml: string): void {
    const parsed = parseTopologyXML(xml);
    this.groups = buildGroupMap(parsed);
    this.emit('topology:changed', this.getAllZones());
  }

  getCoordinator(groupId: string): ZonePlayer {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`Unknown group: ${groupId}`);
    return group.coordinator; // throws if coordinator not found
  }
}

// REST handler
app.post('/api/zones/:roomName/play', async (req, res) => {
  const group = zoneManager.getGroupByRoom(req.params.roomName);
  const coordinator = zoneManager.getCoordinator(group.id);
  await new AVTransportService(coordinator.ip).play();
  res.json({ ok: true });
});
```

### Pattern 3: UPnP Event Subscription with Auto-Renewal

**What:** GENA subscriptions expire (default 1800 seconds / 30 minutes). Track subscription SIDs and schedule renewal before expiry. Re-subscribe from scratch if a subscription is lost (speaker reboot, network blip).

**When:** Always. Lost subscriptions = blind to state changes = stale UI.

**Example:**

```typescript
class GENASubscriptionManager {
  async subscribe(speakerIP: string, service: SonosService): Promise<void> {
    const response = await this.sendSubscribe(speakerIP, service);
    const sid = response.headers['sid'];
    const timeout = parseTimeout(response.headers['timeout']); // e.g. 1800s

    // Renew 60s before expiry
    setTimeout(() => this.renew(speakerIP, service, sid, timeout), (timeout - 60) * 1000);
  }

  async renew(speakerIP: string, service: SonosService, sid: string, timeout: number): Promise<void> {
    try {
      await this.sendRenew(speakerIP, service, sid, timeout);
      setTimeout(() => this.renew(speakerIP, service, sid, timeout), (timeout - 60) * 1000);
    } catch {
      // Subscription lost — resubscribe fresh
      await this.subscribe(speakerIP, service);
    }
  }
}
```

### Pattern 4: State Snapshot on WebSocket Connect

**What:** When a browser client opens a WebSocket connection, immediately send the full current state of all zones. All subsequent messages are deltas. This ensures the UI is never blank after connect or reconnect.

**When:** On every WebSocket connection event (initial load, tab focus, network reconnect).

**Example:**

```typescript
wss.on('connection', (ws: WebSocket) => {
  // Send full snapshot immediately
  ws.send(JSON.stringify({
    type: 'state:full',
    payload: stateCache.getAllZones(),
  }));

  // Subscribe to future deltas
  const unsubscribe = stateCache.onChange((delta) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'zone:update', payload: delta }));
    }
  });

  ws.on('close', unsubscribe);
});
```

### Pattern 5: Optimistic UI Updates

**What:** Apply the expected state change in the browser immediately on user action, then reconcile with the authoritative state when the WebSocket event arrives.

**When:** All playback and volume controls. Eliminates perceived latency.

**Example:**

```typescript
function useZoneControls(zoneId: string) {
  const setState = useZoneStore((s) => s.setZoneState);

  async function play() {
    // Optimistic: update UI immediately
    setState(zoneId, { isPlaying: true });

    try {
      await api.post(`/api/zones/${zoneId}/play`);
      // WS event will arrive ~100-200ms later confirming actual state
    } catch {
      // Rollback optimistic update on command failure
      setState(zoneId, { isPlaying: false });
    }
  }

  return { play };
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Browser-to-Speaker Communication

**What:** Browser calls `http://192.168.1.50:1400/...` directly via `fetch()`.

**Why bad:** CORS blocks this unconditionally. Even with `--disable-web-security` (dev-only hack), it breaks in production, fails over HTTPS (mixed content), and exposes LAN IP topology to XSS attackers.

**Instead:** All speaker communication must go through the backend proxy. The backend maintains IP-to-name mappings.

### Anti-Pattern 2: Polling for Speaker State

**What:** Browser calls `GET /api/zones` every N seconds to get current state.

**Why bad:** 2s polling = up to 2s lag on every state change. Track skips appear sluggish. Rapid transitions (skip + pause in < 2s) produce incorrect intermediate state. N concurrent browser tabs = N × polling load.

**Instead:** GENA subscriptions on the backend, WebSocket push to browser. State arrives within ~100ms of the actual change.

### Anti-Pattern 3: Commanding Group Members Instead of Coordinator

**What:** Sending `AVTransport:Play` or `AVTransport:SetAVTransportURI` to a speaker that is a group member, not the coordinator.

**Why bad:** Silently ignored by Sonos firmware. Your app appears to do nothing.

**Instead:** Always resolve coordinator via Zone/Group Manager before group commands. Volume commands go to individual speakers, not coordinators.

### Anti-Pattern 4: Rebuilding UPnP/SSDP From Scratch

**What:** Manually constructing SOAP XML envelopes, SSDP UDP listeners, GENA subscription handlers, and DIDL-Lite metadata from raw Node.js.

**Why bad:** Sonos uses non-standard SOAP patterns, specific XML namespaces, vendor-extended services, and quirky DIDL-Lite metadata requirements. This takes weeks to get right, and OSS libraries already handle it.

**Instead:** Use the `sonos` npm package (or `node-sonos`) as the UPnP transport layer. Build REST API, state management, and WebSocket server on top of it.

### Anti-Pattern 5: Single Global WebSocket Channel with Untyped Messages

**What:** Broadcasting all events on a single WebSocket with loosely typed or unversioned messages.

**Why bad:** When you add new event types (queue changes, music service events, topology changes), clients break if they don't know how to handle unknown types.

**Instead:** Use a typed message envelope from day 1:

```typescript
type WSMessage =
  | { type: 'state:full'; payload: AllZonesState }
  | { type: 'zone:update'; payload: ZoneStateDelta }
  | { type: 'topology:changed'; payload: ZoneGroup[] }
  | { type: 'error'; payload: { code: string; message: string } };
```

Clients should ignore unknown `type` values — forward-compatible by design.

---

## Component Build Order (Dependencies)

Build order is driven by hard dependencies. Each layer requires the previous.

```
Stage 1 — Speaker Discovery & Command Foundation
  ├─ SSDP Discovery Service
  │    ↓ produces: Speaker Registry (IP + UUID + name)
  ├─ UPnP Service Abstraction (AVTransport, RenderingControl)
  │    ↓ enables: raw play/pause/volume commands by speaker IP
  └─ Backend REST API skeleton (thin wrapper over UPnP services)
       ↓ enables: manual testing via curl before any UI exists

Stage 2 — Real-Time State Pipeline
  ├─ UPnP Event Subscriber / GENA Manager
  │    ↓ enables: receiving state push from speakers
  ├─ State Cache (in-memory zone state snapshot)
  │    ↓ enables: REST API can return current state without querying speaker
  └─ WebSocket Server
       ↓ enables: browser receives state changes in real time

Stage 3 — Zone & Group Management
  ├─ ZoneGroupTopology service + event handler
  │    ↓ enables: accurate coordinator routing
  ├─ Zone/Group Manager (coordinator resolution, group map)
  └─ Group join/leave/separate APIs

Stage 4 — Queue & Content
  ├─ ContentDirectory service (browse speaker queue)
  ├─ Queue manipulation APIs (add, remove, reorder, clear)
  └─ Music service URI formatters (TuneIn, Spotify, Deezer)

Stage 5 — Browser SPA
  ├─ React SPA scaffold + TypeScript setup
  ├─ WebSocket client + typed state management (Zustand)
  ├─ Zone list + now-playing view
  ├─ Volume + transport controls (with optimistic updates)
  ├─ Queue browser
  └─ Music service browse UI (TuneIn first, Spotify second)
```

**Parallel work possible:** Stage 5 browser SPA can begin development in parallel with Stage 4 once the REST API contract (Stage 1) is defined. Mock the backend with fixture data.

---

## Sonos API Landscape

**Confidence: MEDIUM** — This area evolves. Verify against current Sonos developer docs before implementation.

| API | Protocol | Location | Notes |
|-----|----------|----------|-------|
| UPnP/SOAP (port 1400) | SOAP over HTTP | LAN only | Works on S1 and S2 firmware. Not officially documented but stable; used by all major OSS controllers. |
| S2 Local HTTP Control API | REST + WebSocket | LAN only | Introduced ~2021 for S2 speakers only. Better DX than UPnP. May lack some advanced features. |
| Sonos Cloud API | REST over HTTPS | Internet | Full control via Sonos cloud servers. Requires OAuth app registration and Sonos developer approval. Adds ~200-500ms cloud latency even on LAN. |
| SMAPI (Sonos Music API) | SOAP | Backend server | Used by Spotify, Deezer, etc. to integrate into Sonos. Required only for custom music library integration. |

**Recommendation:** Target UPnP/SOAP via the `sonos` npm package as primary transport. Battle-tested, covers S1 and S2, full feature coverage. The S2 Local HTTP API is a future enhancement once UPnP layer is stable — do not attempt to support both simultaneously in v1.

---

## Scalability Considerations

| Concern | Home LAN (1-10 speakers) | Multi-room (10-30 speakers) |
|---------|--------------------------|------------------------------|
| SSDP discovery | Single listener, trivial | Same — broadcast-based |
| GENA subscriptions | One per speaker per service; fine | Linear growth; still fits in memory |
| State Cache | In-memory Map, ~1KB per speaker | In-memory remains correct |
| WebSocket connections | 1-5 browser tabs typically | Same — browser count is small |
| Backend instances | 1 Node.js process per LAN | 1 process (still correct — do not run multiple) |
| Remote access | Not applicable (LAN only) | VPN required; or use Sonos Cloud API (reduced capability) |

This architecture does not require Redis, message queues, or horizontal scaling for home/small-venue use. A single Node.js process handles the entire LAN control plane without bottlenecks. The primary constraint is LAN locality, not compute.

---

## Sources

| Source | Type | Confidence | Notes |
|--------|------|------------|-------|
| Browser CORS specification (W3C) | Standard | HIGH | Explains why direct browser-to-speaker is impossible |
| UPnP Device Architecture / GENA (UPnP Forum) | Standard | HIGH | SUBSCRIBE/NOTIFY pattern is stable |
| node-sonos-http-api (github.com/jishi/node-sonos-http-api) | OSS reference | MEDIUM | Training data; verify project is still maintained |
| sonos npm package (github.com/bencevans/node-sonos) | OSS library | MEDIUM | Training data; check current version and maintenance status |
| Sonos Developer Portal (developer.sonos.com) | Official docs | MEDIUM | Verify S2 Local API coverage and Cloud API capabilities |
| SMAPI documentation (Sonos) | Official docs | MEDIUM | Verify current version |

**Note:** Web research tools were unavailable during this research session. All Sonos-specific implementation details (UPnP endpoint paths, DIDL-Lite format, URI schemes for Spotify/Deezer) should be verified against current node-sonos library source and Sonos developer documentation before implementation begins.
