# Phase 2: Playback Commands - Research

**Researched:** 2026-02-27
**Domain:** Sonos UPnP/SOAP transport control + state reading (AVTransport, RenderingControl) over Fastify REST
**Confidence:** HIGH — based on existing working Phase 1 code in the repo, verified library type signatures, and confirmed SOAP patterns already in production.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**API Design (Endpoints)**
- Routes dediees par action, pas d'endpoint generique
- Supprimer l'ancien POST /speakers/:id/command (spike Phase 1)
- Play et Pause sont deux endpoints separes (POST /speakers/:id/play, POST /speakers/:id/pause)
- Mute et Unmute sont deux endpoints separes (POST /speakers/:id/mute, POST /speakers/:id/unmute)
- Volume en PUT /speakers/:id/volume avec body {level: N}
- Next et Previous en POST /speakers/:id/next, POST /speakers/:id/previous
- Ajouter GET /speakers/:id/state pour lire l'etat sans commande

**Volume Control**
- Volume absolu uniquement (pas de relatif +/-)
- Range natif Sonos 0-100, pas de cap cote serveur
- Validation stricte : 400 Bad Request si level manquant, non-numerique, ou hors 0-100
- Mute/unmute : comportement natif Sonos (preserve le volume automatiquement, pas de logique cote API)

**Response Format**
- Chaque commande retourne {ok: true, state: {playState, volume, muted}}
- State essentiel : playState, volume, muted (pas de track info dans cette phase)
- Si la commande reussit mais la lecture du state echoue : {ok: true, state: null}
- GET /speakers/:id/state retourne {playState, volume, muted}

**Zone vs Speaker Targeting**
- API cible des speakers par UUID uniquement, pas d'abstraction zone
- Le routing des commandes transport au coordinator reste transparent cote serveur
- GET /speakers retourne une liste plate (groupName et coordinatorUuid sont presents dans la reponse mais pas de groupement cote API)
- Speaker injoignable : 502 avec detail (message SOAP propage)
- Pas de codes d'erreur custom pour les cas metier (no track loaded, etc.) : le 502 generique avec le detail SOAP suffit

### Claude's Discretion
- Structure interne du code (services, helpers, organisation des fichiers)
- Implementation SOAP pour lire l'etat (GetTransportInfo, GetVolume, GetMute)
- Gestion des timeouts et retries SOAP
- Format exact des messages d'erreur dans le detail

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAY-01 | User can play/pause the current track on any zone | POST /speakers/:id/play → AVTransport Play (Speed=1), POST /speakers/:id/pause → AVTransport Pause. Both routed to coordinator. State returned in response. |
| PLAY-02 | User can adjust volume per zone via a slider | PUT /speakers/:id/volume {level: N} → RenderingControl SetVolume. Sent to target speaker directly (not coordinator). Strict 0-100 validation. |
| PLAY-03 | User can mute/unmute any zone | POST /speakers/:id/mute → SetMute DesiredMute=1, POST /speakers/:id/unmute → SetMute DesiredMute=0. Sonos natively preserves volume on mute/unmute. |
| PLAY-04 | User can skip to next/previous track on any zone | POST /speakers/:id/next → AVTransport Next, POST /speakers/:id/previous → AVTransport Previous. Both routed to coordinator. |
</phase_requirements>

---

## Summary

Phase 2 extends the working Phase 1 SOAP infrastructure. All the primitive building blocks are already proven: direct SOAP to port 1400, coordinator routing via `SpeakerRegistry.getCoordinator()`, and the split between AVTransport (play/pause/next/previous — to coordinator) and RenderingControl (volume/mute — to target speaker directly). The primary new work is: (1) replacing the single generic `POST /speakers/:id/command` with seven dedicated endpoints, (2) adding SOAP state-reading functions (`GetTransportInfo`, `GetVolume`, `GetMute`) to return state after each command, and (3) adding `GET /speakers/:id/state` as a standalone state endpoint.

The state-reading layer is the most genuinely new work. The Phase 1 code only writes (issues commands) and never reads back state. Reading state requires three parallel SOAP calls with XML response parsing using `fast-xml-parser` (already in `package.json`). These reads are best effort — the user decision is that if state reading fails after a successful command, the response is `{ok: true, state: null}` rather than a 502 error.

The key architectural decision from Phase 1 that remains critical: volume and mute operations are sent to the **target speaker** (per-device rendering), while transport operations (play/pause/next/previous) are sent to the **zone group coordinator**. This routing must not regress when refactoring the generic command endpoint into dedicated routes.

**Primary recommendation:** Extract the SOAP helpers and command logic from `routes/speakers.ts` into a dedicated `services/sonos-commands.ts` module, add a `services/sonos-state.ts` for state reading, then rewrite `routes/speakers.ts` with the seven dedicated endpoints plus the state endpoint. Delete `POST /speakers/:id/command`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | ^5.7.4 | HTTP framework | Already installed, Phase 1 foundation |
| fast-xml-parser | ^5.4.1 | Parse SOAP XML responses | Already installed, needed for state reads |
| @svrooij/sonos | ^2.5.0 | SSDP discovery only (command API broken) | Already installed, confirmed working in Phase 1 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js native `fetch` | Built-in (Node 18+) | Send SOAP envelopes to port 1400 | Already used in Phase 1 SOAP helpers |
| TypeScript strict mode | ^5.9.3 | Type safety | Already configured in tsconfig.json |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fast-xml-parser | xml2js, DOMParser | fast-xml-parser is already installed and zero-dependency; xml2js is callback-based and heavier |
| Native fetch for SOAP | axios | axios adds a dependency with no advantage here; native fetch is sufficient for simple POST |
| Hand-rolled XML building | xmlbuilder2 | For the narrow set of Sonos SOAP envelopes, hand-rolled template literals are simpler and already working in Phase 1 |

**Installation:** No new packages needed. All dependencies are already in `backend/package.json`.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/
├── plugins/
│   ├── env.ts          # unchanged
│   └── sonos.ts        # unchanged
├── routes/
│   └── speakers.ts     # REWRITE: 7 action endpoints + GET /state; remove POST /command
├── services/
│   ├── discovery.ts    # unchanged
│   ├── registry.ts     # unchanged
│   ├── sonos-commands.ts  # NEW: SOAP write helpers (extracted from routes/speakers.ts)
│   └── sonos-state.ts     # NEW: SOAP read helpers (GetTransportInfo, GetVolume, GetMute)
├── app.ts              # unchanged
└── server.ts           # unchanged
```

### Pattern 1: SOAP State Reading

**What:** Three parallel SOAP GET calls to read current speaker state — `GetTransportInfo` (play state), `GetVolume`, `GetMute`. These are read operations on the **target speaker** (not coordinator — volume and mute are per-device; transport state must be read from the coordinator).

**When to use:** After every command to return `{ok: true, state: {...}}`, and for `GET /speakers/:id/state`.

**SOAP actions:**
- `GetTransportInfo` → AVTransport service on coordinator → returns `CurrentTransportState` (string: `"PLAYING"`, `"PAUSED_PLAYBACK"`, `"STOPPED"`, `"TRANSITIONING"`, `"NO_MEDIA_PRESENT"`)
- `GetVolume` → RenderingControl service on target → returns `CurrentVolume` (integer 0-100)
- `GetMute` → RenderingControl service on target → returns `CurrentMute` (`"0"` or `"1"` — note: string, not boolean, in raw SOAP XML)

**Example — SOAP read helper (state reading):**

```typescript
// Source: verified against @svrooij/sonos service type definitions
// and existing Phase 1 SOAP pattern in backend/src/routes/speakers.ts

/** Read transport state from coordinator IP */
async function soapGetTransportInfo(coordinatorIp: string): Promise<string> {
  const url = `http://${coordinatorIp}:1400/MediaRenderer/AVTransport/Control`
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetTransportInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:GetTransportInfo>
  </s:Body>
</s:Envelope>`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: '"urn:schemas-upnp-org:service:AVTransport:1#GetTransportInfo"',
    },
    body: envelope,
  })

  if (!res.ok) throw new Error(`GetTransportInfo HTTP ${res.status}`)
  const text = await res.text()
  // Parse with fast-xml-parser
  const parser = new XMLParser({ ignoreAttributes: false })
  const parsed = parser.parse(text)
  // Navigate: s:Envelope > s:Body > u:GetTransportInfoResponse > CurrentTransportState
  const body = parsed?.['s:Envelope']?.['s:Body']
  return body?.['u:GetTransportInfoResponse']?.['CurrentTransportState'] ?? 'UNKNOWN'
}

/** Read volume from target speaker IP */
async function soapGetVolume(targetIp: string): Promise<number> {
  const url = `http://${targetIp}:1400/MediaRenderer/RenderingControl/Control`
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
    </u:GetVolume>
  </s:Body>
</s:Envelope>`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: '"urn:schemas-upnp-org:service:RenderingControl:1#GetVolume"',
    },
    body: envelope,
  })

  if (!res.ok) throw new Error(`GetVolume HTTP ${res.status}`)
  const text = await res.text()
  const parser = new XMLParser({ ignoreAttributes: false })
  const parsed = parser.parse(text)
  const body = parsed?.['s:Envelope']?.['s:Body']
  return Number(body?.['u:GetVolumeResponse']?.['CurrentVolume'] ?? 0)
}

/** Read mute state from target speaker IP */
async function soapGetMute(targetIp: string): Promise<boolean> {
  const url = `http://${targetIp}:1400/MediaRenderer/RenderingControl/Control`
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
    </u:GetMute>
  </s:Body>
</s:Envelope>`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: '"urn:schemas-upnp-org:service:RenderingControl:1#GetMute"',
    },
    body: envelope,
  })

  if (!res.ok) throw new Error(`GetMute HTTP ${res.status}`)
  const text = await res.text()
  const parser = new XMLParser({ ignoreAttributes: false })
  const parsed = parser.parse(text)
  const body = parsed?.['s:Envelope']?.['s:Body']
  // CurrentMute returns "0" or "1" in XML — fast-xml-parser may return number 0/1 or string
  const rawMute = body?.['u:GetMuteResponse']?.['CurrentMute']
  return rawMute === 1 || rawMute === '1' || rawMute === true
}
```

**Reading all three in parallel (best effort):**
```typescript
// Source: verified user decision — if state read fails, return null, not 502
interface SpeakerState {
  playState: string
  volume: number
  muted: boolean
}

async function readSpeakerState(
  targetIp: string,
  coordinatorIp: string,
): Promise<SpeakerState | null> {
  try {
    const [playState, volume, muted] = await Promise.all([
      soapGetTransportInfo(coordinatorIp),
      soapGetVolume(targetIp),
      soapGetMute(targetIp),
    ])
    return { playState, volume, muted }
  } catch {
    return null
  }
}
```

### Pattern 2: Dedicated Action Endpoints

**What:** Each Sonos command gets its own route instead of a generic `/command` dispatcher.

**When to use:** Always — this is the locked user decision.

**Example — play endpoint:**
```typescript
// Source: Fastify v5 pattern (same as Phase 1 GET /speakers)
fastify.post<{ Params: { id: string } }>(
  '/speakers/:id/play',
  {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            state: {
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    playState: { type: 'string' },
                    volume: { type: 'number' },
                    muted: { type: 'boolean' },
                  },
                  required: ['playState', 'volume', 'muted'],
                },
                { type: 'null' },
              ],
            },
          },
          required: ['ok'],
        },
        404: { type: 'object', properties: { error: { type: 'string' }, uuid: { type: 'string' } } },
        502: { type: 'object', properties: { error: { type: 'string' }, detail: { type: 'string' } } },
      },
    },
  },
  async (request, reply) => {
    const { id } = request.params
    const speaker = fastify.speakers.getById(id)
    if (!speaker) return reply.status(404).send({ error: 'Speaker not found', uuid: id })

    const coordinator = fastify.speakers.getCoordinator(id) ?? speaker

    try {
      await soapAvTransport(coordinator.ip, 'Play', '<Speed>1</Speed>')
      const state = await readSpeakerState(speaker.ip, coordinator.ip)
      return { ok: true, state }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      fastify.log.error(`[sonos] play failed: ${detail}`)
      return reply.status(502).send({ error: 'Command failed', detail })
    }
  },
)
```

### Pattern 3: Volume PUT with Strict Validation

**What:** PUT (not POST) for volume, with Fastify JSON Schema validation to enforce 0-100 range and required `level` field.

**Why PUT:** Volume sets an absolute resource property — idiomatic REST uses PUT for state assignment.

**Example — volume schema:**
```typescript
// Source: Fastify JSON Schema validation, verified user decision on validation rules
{
  schema: {
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    body: {
      type: 'object',
      properties: {
        level: { type: 'number', minimum: 0, maximum: 100 },
      },
      required: ['level'],
      // Note: Fastify's AJV validator will reject non-integer numbers by default
      // but the user decision is "non-numeric → 400". AJV handles this automatically.
    },
    response: { /* same 200/404/502 shape as play */ },
  },
}
```

**Important:** The user decision is to pass the range 0-100 directly to Sonos with no cap — the Phase 1 code had `Math.min(100, Math.max(0, value ?? 20))` as a safety clamp; Phase 2 replaces this with schema validation that rejects out-of-range values with a 400, instead of silently clamping.

### Anti-Patterns to Avoid

- **Keeping POST /speakers/:id/command:** Must be removed. It is the spike endpoint from Phase 1. Leaving it alongside the new dedicated routes creates an inconsistent API surface.
- **Sending transport commands to the target instead of coordinator:** Play/pause/next/previous MUST go to the coordinator IP. The `SpeakerRegistry.getCoordinator()` method handles this. Do not bypass it.
- **Sending volume/mute to the coordinator:** Volume and mute are per-speaker operations sent to the target IP, not the coordinator. Sending to the coordinator would affect the entire zone's volume, not the individual speaker's.
- **Reading GetTransportInfo from the target speaker:** Transport state must be read from the coordinator (same routing rule as write commands). Reading from a member speaker returns the coordinator's queue state, not the member's individual state — but for consistency and correctness, always read transport from coordinator.
- **Throwing a 502 when state reading fails post-command:** The user decision is `{ok: true, state: null}` — the command succeeded, state is best effort. Don't turn a successful command into an error response because the state poll failed.
- **Using `anyOf` null in Fastify response schema without explicit null type:** Fastify v5 / AJV strict mode requires `{ type: 'null' }` explicitly in the `anyOf` array when `state` can be null. Using `nullable: true` is OpenAPI 3 syntax, not JSON Schema.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML response parsing | Custom regex/string split on SOAP XML | `fast-xml-parser` (already installed) | SOAP responses have namespaced elements and nested XML — regex is brittle and will break on edge cases |
| Volume range validation | `Math.min/Math.max` clamps | Fastify JSON Schema (`minimum: 0, maximum: 100`) | Schema validation returns a proper 400 with error detail; silent clamping hides bad client calls |
| Coordinator routing | Custom IP lookup logic | `SpeakerRegistry.getCoordinator()` (Phase 1) | Already handles the fallback case when coordinator is not in registry |
| Parallel state reads | Sequential await chains | `Promise.all([...])` | Three independent SOAP calls run 3x faster in parallel; sequential adds ~150ms latency per command |

**Key insight:** The SOAP command layer already works. Phase 2 is primarily about (1) API surface refactoring and (2) adding read-back state. The risk is in the XML parsing of SOAP responses — use fast-xml-parser rather than any string manipulation.

---

## Common Pitfalls

### Pitfall 1: SOAP Response XML Namespace Key Names

**What goes wrong:** `fast-xml-parser` by default strips XML namespaces from element names. The SOAP response body element is `<u:GetTransportInfoResponse xmlns:u="...">`. With default parser settings, the key in the parsed object might appear as `GetTransportInfoResponse` (stripped) OR as `u:GetTransportInfoResponse` (preserved) depending on parser configuration. If the code assumes one form and the parser returns the other, all state reads silently return `undefined`.

**Why it happens:** The default `ignoreAttributes: false` setting affects attributes only. The `removeNSPrefix` option (default `false`) controls whether namespace prefixes like `u:` are removed from element names. With `removeNSPrefix: false` (default), the key is `u:GetTransportInfoResponse`. With `removeNSPrefix: true`, it is `GetTransportInfoResponse`.

**How to avoid:** Pick one parser configuration and use it consistently across all SOAP read functions. Recommended: use `removeNSPrefix: true` so element keys match their UPnP service action names without namespace clutter:

```typescript
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true })
const parsed = parser.parse(xmlText)
// Keys are now: Envelope > Body > GetTransportInfoResponse > CurrentTransportState
```

**Warning signs:** State reads return `undefined` or the `playState` field in the response is always `'UNKNOWN'`.

### Pitfall 2: CurrentTransportState Values Are All-Caps Strings

**What goes wrong:** The `CurrentTransportState` SOAP field returns values like `"PLAYING"`, `"PAUSED_PLAYBACK"`, `"STOPPED"`, `"TRANSITIONING"`, `"NO_MEDIA_PRESENT"`. Code that normalizes to lowercase or compares with `"playing"` will never match.

**How to avoid:** The API response exposes `playState` as the raw Sonos string (`"PLAYING"`, `"PAUSED_PLAYBACK"`, etc.). Document this in the route response schema comment so the frontend knows what to expect. Do not transform or normalize the value in Phase 2.

**Warning signs:** Frontend play/pause button always shows the wrong state because the comparison uses `=== 'playing'` instead of `=== 'PLAYING'`.

### Pitfall 3: CurrentMute Returns Integer 0/1, Not Boolean

**What goes wrong:** The Sonos SOAP `GetMuteResponse` returns `<CurrentMute>0</CurrentMute>` or `<CurrentMute>1</CurrentMute>`. `fast-xml-parser` will parse this as the **number** `0` or `1`, not the boolean `false`/`true`. A strict `=== true` check always fails; a falsy `if (!muted)` check accidentally passes for both `0` and `false`.

**How to avoid:** Explicit coercion: `const muted = rawMute === 1 || rawMute === '1'`. This handles both numeric and string representations.

**Warning signs:** Mute state always shows as `false` even when the speaker is muted.

### Pitfall 4: Routing Volume/Mute Commands to Coordinator Instead of Target

**What goes wrong:** A refactor that generalizes "always use coordinator" for simplicity will silently send volume changes to the wrong speaker in a grouped zone. The coordinator will get a volume command intended for a member speaker, changing the wrong device.

**Why it happens:** Transport command routing (play/pause/next/prev → coordinator) is a different rule from rendering command routing (volume/mute → target). Merging these into a single routing strategy is incorrect.

**How to avoid:** The existing Phase 1 code already has this correct. When extracting to `sonos-commands.ts`, preserve the dual routing pattern:
- Transport: `await soapAvTransport(coordinator.ip, ...)`
- Rendering: `await soapRenderingControl(speaker.ip, ...)`

**Warning signs:** Volume changes in a grouped zone affect the whole group instead of only the targeted speaker.

### Pitfall 5: Fastify Schema `state: null` Serialization

**What goes wrong:** When `state` is `null` in the response and the Fastify response schema declares `state` as only an object type, Fastify's fast-json-stringify serializer will either omit `state` or throw a serialization error. The schema must explicitly allow `null`.

**How to avoid:** Use `anyOf` with `{ type: 'null' }`:
```typescript
state: {
  anyOf: [
    {
      type: 'object',
      properties: {
        playState: { type: 'string' },
        volume: { type: 'number' },
        muted: { type: 'boolean' },
      },
      required: ['playState', 'volume', 'muted'],
    },
    { type: 'null' },
  ],
}
```

**Warning signs:** `state: null` responses cause a 500 internal error or silently serialize as `state: {}`.

---

## Code Examples

Verified patterns from Phase 1 source code and library type definitions:

### Existing Phase 1 SOAP Write Helpers (to extract into sonos-commands.ts)

```typescript
// Source: backend/src/routes/speakers.ts (Phase 1 — confirmed working on real hardware)

// AVTransport — transport commands to coordinator
async function soapAvTransport(ip: string, action: string, bodyXml: string): Promise<void> {
  const url = `http://${ip}:1400/MediaRenderer/AVTransport/Control`
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      ${bodyXml}
    </u:${action}>
  </s:Body>
</s:Envelope>`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: `"urn:schemas-upnp-org:service:AVTransport:1#${action}"`,
    },
    body: envelope,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SOAP AVTransport ${action} failed: HTTP ${res.status} — ${text.slice(0, 200)}`)
  }
}

// RenderingControl — per-speaker volume/mute commands to target
async function soapRenderingControl(ip: string, action: string, bodyXml: string): Promise<void> {
  const url = `http://${ip}:1400/MediaRenderer/RenderingControl/Control`
  const envelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      ${bodyXml}
    </u:${action}>
  </s:Body>
</s:Envelope>`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: `"urn:schemas-upnp-org:service:RenderingControl:1#${action}"`,
    },
    body: envelope,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SOAP RenderingControl ${action} failed: HTTP ${res.status} — ${text.slice(0, 200)}`)
  }
}
```

### Phase 1 Command Switch (to be replaced by individual functions)

```typescript
// Source: backend/src/routes/speakers.ts (Phase 1)
// These individual cases become the body of dedicated command functions:

// play: await soapAvTransport(coordinatorIp, 'Play', '<Speed>1</Speed>')
// pause: await soapAvTransport(coordinatorIp, 'Pause', '')
// next: await soapAvTransport(coordinatorIp, 'Next', '')
// previous: await soapAvTransport(coordinatorIp, 'Previous', '')
// volume: await soapRenderingControl(targetIp, 'SetVolume',
//   `<Channel>Master</Channel><DesiredVolume>${level}</DesiredVolume>`)
// mute: await soapRenderingControl(targetIp, 'SetMute',
//   '<Channel>Master</Channel><DesiredMute>1</DesiredMute>')
// unmute: await soapRenderingControl(targetIp, 'SetMute',
//   '<Channel>Master</Channel><DesiredMute>0</DesiredMute>')
```

### SOAP Response Parsing with fast-xml-parser

```typescript
// Source: fast-xml-parser v5 API + verified SOAP response structure
import { XMLParser } from 'fast-xml-parser'

// IMPORTANT: removeNSPrefix: true strips "s:", "u:" prefixes from element names
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true })

function parseTransportState(xmlText: string): string {
  const parsed = parser.parse(xmlText)
  return parsed?.Envelope?.Body?.GetTransportInfoResponse?.CurrentTransportState ?? 'UNKNOWN'
}

function parseVolume(xmlText: string): number {
  const parsed = parser.parse(xmlText)
  return Number(parsed?.Envelope?.Body?.GetVolumeResponse?.CurrentVolume ?? 0)
}

function parseMute(xmlText: string): boolean {
  const parsed = parser.parse(xmlText)
  const raw = parsed?.Envelope?.Body?.GetMuteResponse?.CurrentMute
  return raw === 1 || raw === '1'
}
```

### New Route Shape (7 endpoints summary)

```
POST   /speakers/:id/play       → AVTransport Play (coordinator)
POST   /speakers/:id/pause      → AVTransport Pause (coordinator)
POST   /speakers/:id/next       → AVTransport Next (coordinator)
POST   /speakers/:id/previous   → AVTransport Previous (coordinator)
PUT    /speakers/:id/volume      → RenderingControl SetVolume (target) — body: {level: N}
POST   /speakers/:id/mute       → RenderingControl SetMute 1 (target)
POST   /speakers/:id/unmute     → RenderingControl SetMute 0 (target)
GET    /speakers/:id/state      → Read-only: {playState, volume, muted}

DELETE /speakers/:id/command    → (not an HTTP verb for delete, just remove the route)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic POST /command dispatcher (Phase 1 spike) | 7 dedicated endpoints per action | Phase 2 | Clean REST API; each route has its own schema and logging |
| No state read-back | State returned in every command response | Phase 2 | Frontend can update UI optimistically without needing a separate GET |
| Math.min/max volume clamp | JSON Schema validation (400 on invalid) | Phase 2 | Proper error reporting to clients instead of silent correction |

**Deprecated/outdated:**
- `POST /speakers/:id/command`: Removed in Phase 2. The spike endpoint served its purpose for Phase 1 verification. It must be deleted, not kept for backward compatibility.
- `executeCommand()` function in `routes/speakers.ts`: Replaced by individual command functions in `services/sonos-commands.ts`.
- `TRANSPORT_COMMANDS` and `RENDERING_COMMANDS` Sets: No longer needed when each route knows its own command type.

---

## Open Questions

1. **fast-xml-parser namespace handling in practice**
   - What we know: `removeNSPrefix: true` removes `s:`, `u:` prefixes; without it, keys include the prefix
   - What's unclear: Whether fast-xml-parser v5 has any behavior changes compared to v4 for SOAP-style responses
   - Recommendation: Write the SOAP read functions with `removeNSPrefix: true` and test against a real Sonos response. Add a single integration smoke test that POSTs a known SOAP response XML and verifies the parsed output matches expected structure.

2. **GetTransportInfo on a member speaker vs coordinator**
   - What we know: Transport state must be read from the coordinator for grouped zones
   - What's unclear: Whether reading from a member speaker returns an error, stale state, or correct state
   - Recommendation: Always read transport state from `coordinator.ip`. If `coordinator === speaker` (ungrouped), this is the same IP. This is consistent with the write routing and safe.

3. **Timeout for SOAP state reads**
   - What we know: The three state reads run in parallel after a command; if they timeout, the response is `{ok: true, state: null}`
   - What's unclear: Whether a timeout wrapper around `readSpeakerState()` is needed, or whether Sonos speakers always respond quickly
   - Recommendation: Phase 1 SOAP writes have no explicit timeout (relying on Node.js defaults ~120s). For state reads, consider wrapping `readSpeakerState()` in a short timeout (e.g., 3 seconds) using `AbortController` + `signal` on the fetch calls, so a slow speaker state read doesn't delay the API response. This is discretionary — implement if the planner judges it worth the complexity.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` — the config has `workflow.research`, `workflow.plan_check`, and `workflow.verifier`, but not `nyquist_validation`. Skipping this section.

---

## Sources

### Primary (HIGH confidence)

- `backend/src/routes/speakers.ts` — Phase 1 working SOAP implementation; all command patterns derived from this
- `backend/src/services/registry.ts` — SpeakerRegistry API: `getById()`, `getCoordinator()`, `getAll()`
- `@svrooij/sonos` type definitions (`av-transport.service.d.ts`, `rendering-control.service.d.ts`) — verified SOAP action names and response field names (`CurrentTransportState`, `CurrentVolume`, `CurrentMute`)
- `.planning/phases/02-playback-commands/02-CONTEXT.md` — locked user decisions

### Secondary (MEDIUM confidence)

- `fast-xml-parser` v5 source (`node_modules/fast-xml-parser/src/xmlparser/XMLParser.js`) — XMLParser constructor confirmed; `removeNSPrefix` option confirmed
- `.planning/research/PITFALLS.md` — Sonos SOAP quirks: SOAPAction header quotes, InstanceID=0, Channel=Master requirements

### Tertiary (LOW confidence)

- Training data on SOAP response XML structure for GetTransportInfo/GetVolume/GetMute — field names cross-verified against @svrooij/sonos type definitions but actual XML wire format not verified against live Sonos speaker in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and working in Phase 1
- Architecture: HIGH — refactoring existing working code with clear seams; new state-reading layer uses same SOAP pattern
- Pitfalls: HIGH for SOAP write (Phase 1 confirmed); MEDIUM for SOAP reads (XML parsing structure inferred from type definitions, not live response)

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable — Sonos SOAP port 1400 interface is frozen; fast-xml-parser API is stable)
