# Domain Pitfalls: Sonos Controller Web App

**Domain:** Sonos local network controller (UPnP/SOAP + Sonos local Control API)
**Researched:** 2026-02-25
**Confidence:** MEDIUM — based on training data (cutoff August 2025). External tool access (WebSearch, WebFetch, Bash) was denied during this research session. All findings must be verified against current Sonos developer docs and library GitHub issue trackers before acting on them.

---

## Critical Pitfalls

Mistakes that cause rewrites, silent failures that users notice, or complete loss of control functionality.

---

### Pitfall 1: Choosing node-sonos (UPnP/SOAP) Without Verifying It Works Against Current Firmware

**What goes wrong:** `node-sonos` (npm: `node-sonos`, GitHub: `bencevans/node-sonos`) is the most-cited Node.js library for Sonos control and appears in most tutorials and StackOverflow answers. It wraps the legacy UPnP/SOAP interface on port 1400. The library has had periods of very low-to-no active maintenance (last meaningful commits reportedly 2020-2021). Sonos has introduced a newer local Control API (HTTPS REST + WebSocket on port 1443) that is the officially supported path for S2 hardware. Projects that build their entire backend on `node-sonos` without first verifying it against a live Sonos system on current firmware have discovered mid-project that commands silently fail or return unexpected responses.

**Why it happens:** `node-sonos` has high npm download counts from historical usage. Search results surface it heavily. The README does not prominently warn about maintenance status or S2 compatibility limitations.

**Consequences:**
- S2-generation speakers (Era 100, Era 300, Move 2, Roam SL, Arc Ultra, etc.) may fail silently or return partial data
- SOAP response parsing breaks without warning after Sonos firmware updates
- Zero upstream bug fixes — the project owns all maintenance of the wrapper
- Potential complete rewrite of the integration layer mid-project

**Prevention:**
- Before writing any application code, run a throwaway spike that calls play/pause, volume, and metadata retrieval against a live speaker and confirm all three work
- Check the GitHub repository's last commit date and open issues for firmware-related breakage reports
- Evaluate the **Sonos local Control API** (HTTPS on port 1443, officially supported, introduced ~2020) as an alternative — it is more stable and forward-compatible
- Treat `node-sonos` as read-only reference code; if UPnP SOAP is chosen, use thin raw HTTP calls (axios + xml parser) that you fully control rather than a library you cannot maintain

**Detection / Warning Signs:**
- `node-sonos` in `package.json`
- `<s:Envelope>` SOAP envelopes appearing in HTTP request logs with no error handling for malformed responses
- Calls to port `1400` without a version-compatibility check at startup

**Phase to address:** Phase 1 (foundation / API selection spike). Architecture decision must be locked before any integration work begins.

---

### Pitfall 2: SSDP/UPnP Discovery Fails Silently on Office Networks

**What goes wrong:** Sonos speakers are discovered via SSDP (Simple Service Discovery Protocol) which uses UDP multicast on `239.255.255.250:1900`. This works on flat home networks but silently returns zero results on:
- Networks with IGMP snooping on managed switches that drops multicast unless explicitly whitelisted
- Networks where the server is on a different VLAN than the speakers (very common in offices — speakers are on a "media" or "IoT" VLAN, the server is on a "servers" VLAN)
- Docker/container environments where the host network interface is not exposed
- Windows Firewall blocking UDP 1900

No error is thrown — the device list is simply empty. This is the exact context of this project: a company office network where the infrastructure is managed.

**Why it happens:** Discovery works on the developer's home network during development, breaks in the office when deployed. The failure mode is identical to "no Sonos speakers exist" — impossible to distinguish without network debugging.

**Consequences:**
- Zero speakers found; app shows an empty zone list and appears completely broken
- Hard to debug because it is infrastructure-dependent, not code-dependent
- Users blame the app, not the network

**Prevention:**
- Implement a **manual IP fallback**: provide a `SONOS_SPEAKER_IPS=192.168.1.10,192.168.1.11` environment variable that bypasses discovery entirely — this is the recommended production deployment strategy for office networks
- Implement dual-mode discovery: try SSDP first (5-second timeout), then probe the configured IP list directly via HTTP to `http://[ip]:1400/xml/device_description.xml` (UPnP path) or `https://[ip]:1443/api/v1/players` (Control API path)
- Work with IT early to confirm multicast routing between the server VLAN and the speakers' VLAN, or confirm they share the same subnet
- Add a `/admin/discovery` debug endpoint showing discovery results and attempted methods

**Detection / Warning Signs:**
- Device list returns empty after a reasonable timeout (>5 s) in an environment where speakers are known to exist
- SSDP socket errors are swallowed without user-visible feedback
- Works on dev machine (same desk as speakers) but not on the deployment server (different rack or floor)

**Phase to address:** Phase 1 (network layer). Add manual IP fallback in the first working prototype; do not defer.

---

### Pitfall 3: TLS Verification for the Local Control API Disabled Globally

**What goes wrong:** The Sonos local Control API (port 1443) runs on HTTPS with a self-signed certificate. Developers encountering the immediate `UNABLE_TO_VERIFY_LEAF_SIGNATURE` error in Node.js take the fastest fix: setting `NODE_TLS_REJECT_UNAUTHORIZED=0` globally. This disables certificate verification for ALL outgoing HTTPS requests in the process — including any calls to Spotify, Deezer, or other services — creating a security vulnerability.

**Why it happens:** The global env var is the fix shown in Stack Overflow answers and quick tutorials. It immediately resolves the error and looks harmless in development.

**Consequences:**
- All HTTPS requests from the backend (including to Spotify and Deezer APIs) become vulnerable to man-in-the-middle attacks
- Cert-pinning approaches break silently after Sonos firmware updates that rotate the certificate
- Corporate security audits will flag this immediately

**Prevention:**
- Use a **custom HTTPS agent scoped only to Sonos requests**: `new https.Agent({ rejectUnauthorized: false })` passed to `fetch` or `axios` per-request — never set the global env var
- Encapsulate all Sonos HTTP calls behind a single client module so the scoped agent is not scattered across the codebase
- Document the trust decision in a code comment so future maintainers do not "fix" it by removing it
- If this project uses the UPnP path (port 1400, HTTP not HTTPS), this pitfall does not apply — but port 1400 should only be used for SOAP if the Control API is not suitable

**Detection / Warning Signs:**
- `NODE_TLS_REJECT_UNAUTHORIZED=0` anywhere in `.env`, startup scripts, or CI config
- Global `https.globalAgent` modifications in any file
- No `httpsAgent` option on Sonos-specific `fetch`/`axios` calls

**Phase to address:** Phase 1 (API client setup). Must be addressed before any integration testing.

---

### Pitfall 4: Zone Group State — Sending Commands to Group Members Instead of the Coordinator

**What goes wrong:** When Sonos speakers are grouped, the group has one "coordinator" speaker and one or more "member" speakers. All control commands (play, pause, volume for the group, skip) must be sent to the coordinator, not to member speakers directly. Sending a Play or SetVolume command to a member speaker either has no effect or returns an error with no useful message. Projects that display each discovered speaker as an independent zone without parsing group membership end up with controls that silently do nothing for member speakers.

**Why it happens:** UPnP discovery returns all speakers as peers. The `ZoneGroupTopology` service (UPnP path) or the `groups` API (Control API path) must be read separately to understand group structure. Quick implementations skip this and treat every discovered speaker IP as independently controllable.

**Consequences:**
- Play/pause/volume controls for a "member" speaker appear to work (no error) but do nothing
- Zone list shows duplicate zones: coordinator and member both visible, only coordinator is controllable
- Coordinator changes are not tracked: when the coordinator leaves a group, all commands break until the app is restarted

**Prevention:**
- Parse `ZoneGroupTopology` (UPnP) or subscribe to the `groups` WebSocket namespace (Control API) at startup and on every change event
- Always address the coordinator when issuing group-wide commands; address individual speakers only for per-speaker operations (individual volume when ungrouped)
- Model groups as **immutable snapshots** replaced entirely on each topology event, not patched incrementally
- Test with speakers in a grouped state from day one of development — do not test only with ungrouped speakers

**Detection / Warning Signs:**
- Clicking "Pause" on a speaker does nothing — it is a group member and the coordinator is being addressed by a different zone card
- Zone list shows the same room name appearing twice with slightly different IDs
- `GetTransportInfo` or `/api/v1/players/{id}/playback` returns unexpected state for certain speakers

**Phase to address:** Phase 1 (discovery and data model). Group topology parsing must be correct before building any UI controls.

---

### Pitfall 5: Real-Time State Sync — Polling Too Slow or UPnP Event Subscriptions Silently Expiring

**What goes wrong:** Sonos speakers change state from many concurrent sources: the official Sonos app, physical speaker buttons, Alexa/Google voice commands, and the custom web app. Without timely synchronization, the web app shows stale volume, wrong play/pause state, or "playing" when the speaker has been paused from elsewhere. Two failure modes:

1. **Polling interval too long** (>10 seconds): UI feels broken; play/pause state from the official app takes 10+ seconds to appear in the web app.
2. **UPnP event subscriptions expire silently**: The Sonos UPnP eventing model (SUBSCRIBE/NOTIFY) has a configurable timeout (default 1800 seconds = 30 minutes). If subscription renewal is not implemented, updates stop arriving after 30 minutes with no error.

**Why it happens:** REST polling is the easy path. UPnP eventing requires the backend server to accept incoming HTTP callbacks from the speakers — the speakers call the server, not the other way around — which requires knowing the server's LAN IP and having no firewall blocking the callback port.

**Consequences:**
- Volume slider snaps back to stale value after the user changes it via the Sonos app
- Play/pause button shows wrong state; users press it twice (first press apparently does nothing)
- After 30 minutes without renewal, UPnP event subscriptions silently expire and the UI freezes

**Prevention:**
- For MVP: server-side polling at **2-3 second intervals** is acceptable for 2-5 speakers. This is the safe, simple choice.
- If UPnP eventing is added: implement subscription renewal at 80% of the timeout interval (renew at ~1440 seconds for a 1800-second subscription). Track subscription SID per speaker.
- After issuing any control command (play, pause, volume), **optimistically update the UI immediately**, then re-poll after 1 second to confirm actual state
- Push state from backend to browser via **WebSocket or Server-Sent Events** (SSE) — browser-to-speaker polling is never correct
- Implement subscription renewal on a timer, not just on reconnect

**Detection / Warning Signs:**
- After pausing from the Sonos app, the web app still shows "playing" for more than 5 seconds
- UPnP NOTIFY events in logs stop arriving after ~30 minutes without a corresponding SUBSCRIBE renewal
- Users report volume "fighting back" to a previous level after changing it elsewhere

**Phase to address:** Phase 1/2 boundary. Decide polling vs. eventing architecture before building the UI. Polling is the safe MVP choice.

---

### Pitfall 6: Spotify/Deezer OAuth Confusion — These Services Are Sonos-Managed, Not App-Managed

**What goes wrong:** A common misunderstanding is that the web app needs to authenticate with Spotify or Deezer directly to control music playback. For this use case (resume playing, switch to a Sonos Favorite), the app does NOT need Spotify/Deezer OAuth credentials. Sonos speakers maintain their own internal link to music services. The web app only tells the Sonos speaker which service URI to play — the speaker handles service authentication itself. Teams that build OAuth flows for Spotify "to control what plays" are solving the wrong problem and wasting a sprint.

The Sonos Cloud API (which does require OAuth) is an entirely different surface from the local UPnP/Control API. Documentation for the Cloud API is prominent and misleads teams into thinking OAuth is always required.

**Why it happens:** Developers research "Sonos + Spotify integration" and find the Cloud API OAuth docs first. The local API path is less prominently documented.

**Consequences:**
- Wasted implementation time on OAuth that is never needed
- App breaks when access tokens expire — except the tokens were never needed
- Spotify refresh token rotation (introduced 2024) breaks naive implementations that store a single static refresh token
- Security exposure from Spotify tokens stored in browser localStorage

**Prevention:**
- Document clearly in the architecture: "We use the local API (UPnP port 1400 or Control API port 1443). No OAuth to Spotify or Deezer is needed for playback control."
- For the source switcher, use **Sonos Favorites** (stored on the speakers, retrievable via ContentDirectory Browse / Control API). These are playable via AVTransport URI without any music service credentials.
- The only scenario where Spotify/Deezer tokens are needed is deep music browsing (search, playlist navigation). This is explicitly out of scope per PROJECT.md.
- If Spotify Web API is needed in future: use PKCE flow (not implicit), store tokens server-side (not localStorage), and handle refresh token rotation.

**Detection / Warning Signs:**
- A team member starts researching "Spotify OAuth with PKCE for Node.js" or "Deezer OAuth flow"
- Someone mentions "we need to refresh the Spotify token every hour"
- A `localStorage.setItem('spotify_token', ...)` call in the frontend code
- Any code calling `api.spotify.com` or `api.deezer.com` directly rather than sending URIs to port 1400/1443

**Phase to address:** Phase 1/2. Clarify in the architecture document before any integration work starts.

---

## Moderate Pitfalls

Issues that cause frustrating bugs or poor UX but do not require a full rewrite.

---

### Pitfall 7: DIDL-Lite Metadata Parsing — Fragile Nested XML, Per-Service Differences

**What goes wrong:** Track metadata (title, artist, album art URL) is returned by the Sonos local API as a percent-encoded XML string (DIDL-Lite format) embedded inside a SOAP XML response or a JSON field. This nested XML-in-XML structure is fragile to parse. More critically, the field names and album art URL patterns differ by music service: Spotify returns different metadata paths than TuneIn radio, which differs from Deezer, which differs from line-in sources.

**Why it happens:** DIDL-Lite is a complex standard that Sonos implements inconsistently per service. Tutorials show the happy path for one service.

**Consequences:**
- "Now Playing" shows track/artist for Spotify but blank for TuneIn radio (different metadata path)
- Album art URL works locally but shows broken images when proxied incorrectly
- Parser crashes on edge cases: no track loaded, line-in input, pairing mode

**Prevention:**
- Build a dedicated metadata parsing module with unit tests against captured response fixtures from each service (Spotify, Deezer, TuneIn)
- Handle the null/empty case explicitly: "no track loaded" is a valid state, not an error. Use optional chaining (`?.`) on every metadata field.
- Define expected DIDL-Lite field paths per source type and fall back gracefully when a field is absent
- Check `playbackState.currentItem.track.type` (Control API) or the transport URI scheme (UPnP: `x-sonos-spotify:`, `x-sonosapi-radio:`, `x-rincon-mp3radio:`) to know which parsing path to use

**Detection / Warning Signs:**
- "Now playing" works for Spotify but shows blank for TuneIn
- Console errors on XML/JSON parse when switching sources
- Crashes when the speaker is idle (no track loaded)

**Phase to address:** Phase 2 (now playing / metadata display). Build and test the parser against fixture data from all three services before wiring to the UI.

---

### Pitfall 8: Volume Slider Race Conditions

**What goes wrong:** Volume sliders that fire an API call on every `input` event (continuous drag) flood the speaker with requests at 30-60 per second. Sonos speakers process each but may handle them out of order over the network, causing volume to "bounce" — the user drags to 80%, and it jumps between 60% and 80% as out-of-order responses arrive.

**Why it happens:** Naive implementation: `input[type=range] onChange → POST /volume`. No debouncing.

**Consequences:**
- Volume "rubberbands" rather than following the drag position
- Speaker gets flooded with requests; other Sonos apps running simultaneously experience degraded performance
- Battery drain on mobile devices

**Prevention:**
- Debounce or throttle volume API calls: send at most one command per 150-200 ms
- Apply **optimistic UI updates** locally on every drag event (immediate feedback)
- Suppress incoming state sync updates for the specific zone for 1-2 seconds after issuing a volume command to prevent sync from overwriting the optimistic update
- Use the volume ramp endpoint (`/api/v1/players/{id}/playerVolume/ramp`) for smooth fade transitions where available

**Detection / Warning Signs:**
- Network tab shows dozens of requests while dragging the slider
- Volume jumps unpredictably mid-drag
- `SetVolume` SOAP calls or volume API POSTs visible at more than 5 per second

**Phase to address:** Phase 2 (volume controls). Debounce from the very first implementation.

---

### Pitfall 9: TuneIn / Radio Sources — Skip Button Has No Effect

**What goes wrong:** The skip-track (Next/Previous) command works for queue-based sources (Spotify, Deezer) but has no effect — or returns an error — for TuneIn radio streams, which are continuous. Showing a skip button that silently does nothing erodes trust in the interface.

**Prevention:**
- Detect the active source type from the transport URI scheme: `x-sonosapi-radio:` and `x-rincon-mp3radio:` indicate radio streams (UPnP path); the Control API exposes `currentItem.track.service.name` or similar
- Hide or disable the skip button when the active source is a radio stream
- TuneIn is one of the three explicit sources in PROJECT.md — this case must be handled from the start

**Detection / Warning Signs:**
- Skip button visible in the UI while TuneIn is playing and pressing it produces no visible effect
- No source-type check before rendering transport controls

**Phase to address:** Phase 2 (playback controls).

---

### Pitfall 10: Album Art URLs Are Local-Network-Only

**What goes wrong:** Album art URLs returned in DIDL-Lite metadata or the Control API are often served from the Sonos speaker itself (`http://192.168.x.x:1400/getaa?...`). The browser successfully loads these if it is on the same LAN subnet as the speakers. If the server is on a different VLAN, or if the user ever accesses the web app from outside the LAN, the image URLs fail silently (broken image icon, no error).

**Prevention:**
- Proxy all album art through the backend server: expose a `/api/art?url=…` endpoint that fetches the image from the speaker and forwards it to the browser. This also avoids browser CORS issues since the speaker does not serve CORS headers for cross-origin image requests.
- Do not cache album art URLs in persistent storage — they are time-limited signed URLs from streaming services. Re-fetch on each metadata update.

**Detection / Warning Signs:**
- Album art works when testing from the same desk as the speakers but breaks from a different room or VLAN
- `<img src="http://192.168.x.x:1400/...">` in the rendered HTML
- No `/api/art` proxy endpoint in the backend

**Phase to address:** Phase 2 (now playing display).

---

### Pitfall 11: Sonos Firmware Updates Break Undocumented Behaviors

**What goes wrong:** Sonos's local UPnP/SOAP API is technically undocumented and unsupported. Sonos has no backward-compatibility obligation for it. Firmware updates have historically changed album art URL formats, ContentDirectory Browse response structure, and AVTransport URI formats for specific services. Third-party controllers that relied on specific response field positions broke silently after updates.

**Why it happens:** The local API is stable enough for community use, but Sonos can change it without notice.

**Consequences:**
- App worked yesterday, nothing in the app changed, something is now broken
- Album art stops loading (URL format changed)
- Favorites stop playing (AVTransport URI format for a specific service changed)

**Prevention:**
- Centralize all SOAP response parsing in a single module so firmware regressions require changes in one place, not throughout the codebase
- Log the Sonos speaker firmware version at startup (available in `device_description.xml`) to the debug output — knowing the firmware version at time of breakage is essential for debugging
- Add integration tests that run against a real Sonos speaker (not mocks) so firmware regressions are caught immediately after an update
- Monitor the Sonos community forum and node-sonos GitHub issues for firmware breakage reports

**Detection / Warning Signs:**
- App worked with no code changes but something stopped working
- Sonos app showed an update notification in the last 48 hours
- XML response contains unexpected field ordering or new elements

**Phase to address:** Phase 2+. Establish the centralized parsing module in Phase 1. Add firmware version logging in Phase 1.

---

### Pitfall 12: WebSocket / SSE Reconnection — Full State Snapshot Not Sent on Reconnect

**What goes wrong:** When using WebSocket or SSE to push state from the backend to browsers, developers often handle the "connected" state well but not the "disconnected and reconnected" case. When a phone's screen locks, a browser tab goes into the background, or the network blips, the connection drops. On reconnect, the browser receives no snapshot of current state and displays stale data until the next incremental event.

**Why it happens:** The happy path is obvious (push events as they arrive). The reconnect snapshot is a secondary concern that gets deferred and forgotten.

**Consequences:**
- A phone that locked shows wrong play state when the user unlocks it
- After a server restart, all browser clients are stale until manually refreshed
- State shows last known value from before disconnection indefinitely

**Prevention:**
- Always send a **complete state snapshot** immediately upon connection or reconnection (not just incremental diffs)
- Implement exponential backoff reconnection on the client (socket.io handles this automatically; native WebSocket requires manual implementation: 1s, 2s, 4s, 8s, cap at 30s)
- Show a visible "reconnecting" indicator in the UI when the connection is not established
- Re-subscribe to all event namespaces after reconnection (WebSocket subscriptions do not survive disconnection)

**Detection / Warning Signs:**
- Refreshing the browser immediately corrects stale state (confirms push sync is broken on reconnect)
- Volume slider shows an old value after locking and unlocking a phone
- No "reconnecting" UI state in the design

**Phase to address:** Phase 2/3 (real-time sync). Design reconnection from the start, not as a retrofit.

---

### Pitfall 13: Deezer API Rate Limits Are Poorly Documented

**What goes wrong:** Deezer imposes request rate limits that are not prominently documented. Developers hit limits during development and mistake them for API errors, losing time debugging the wrong thing.

**Prevention:**
- Implement request queuing with exponential backoff for all Deezer API calls
- Cache search results and track metadata aggressively (Deezer metadata is stable)
- Test with realistic request volumes rather than single-call tests
- Read Deezer's terms of service before building: some countries restrict Deezer API commercial use

**Detection / Warning Signs:**
- HTTP 429 responses from Deezer API intermittently
- Errors that appear only under concurrent user load, not in solo testing

**Phase to address:** Phase 2 (music service integration).

---

### Pitfall 14: Browser CORS Blocks Direct Calls to Sonos Speaker

**What goes wrong:** Browser security policy blocks requests from the web app's origin (e.g., `http://192.168.1.50:3000`) to a Sonos speaker's IP (`https://192.168.1.10:1443` or `http://192.168.1.10:1400`) because Sonos speakers do not send CORS headers permitting cross-origin requests from arbitrary browser origins.

**Prevention:**
- Route **all** Sonos API calls through the backend proxy — the browser never calls the speaker directly
- This is the correct architecture regardless of CORS: the proxy holds credentials and speaker IP configuration; the browser receives a clean REST/WebSocket API from the backend
- In development, the proxy runs on the same origin as the dev server

**Detection / Warning Signs:**
- `fetch` calls to a speaker IP directly from React/Vue/Svelte components
- CORS errors in browser console during development
- No backend proxy layer in the architecture

**Phase to address:** Phase 1 (architecture). Must be a proxy-first design from the start.

---

## Minor Pitfalls

Small issues that cause debugging time or minor UX problems with straightforward fixes.

---

### Pitfall 15: PIN Authentication — No Brute-Force Protection

**What goes wrong:** A 4-digit shared PIN has 10,000 combinations. Without rate limiting, a script on the company network can brute-force it in seconds. On a trusted company LAN this is low risk, but if a guest VLAN bridges to the same network segment, or if someone runs a script as a prank, the protection provides no real security.

**Prevention:** Lock out an IP for 15 minutes after 5 failed attempts. This is a one-middleware implementation (e.g., `express-rate-limit`), not a major feature. Implement it from the first sprint alongside the PIN auth itself.

**Phase to address:** Phase 1 (authentication).

---

### Pitfall 16: SOAP Action Name and Namespace Case Sensitivity

**What goes wrong:** When writing raw Sonos UPnP SOAP calls, action names are case-sensitive. Sending `setvolume` instead of `SetVolume`, or getting the `SOAPAction` header namespace wrong, causes the speaker to return a HTTP 500 with an unhelpful body. This is a common debugging pitfall when first writing raw SOAP without the library wrapper.

**Prevention:**
- Copy action names and namespace URIs verbatim from the UPnP service description XML retrieved from the speaker itself (`http://[speaker-ip]:1400/xml/device_description.xml` and linked service description XMLs)
- Never guess or lowercase action names
- Log the full SOAP request and response during development so errors are immediately visible

**Phase to address:** Phase 1 (backend integration spike).

---

### Pitfall 17: "Now Playing" Metadata Missing for Line-In and Non-Music Sources

**What goes wrong:** When a speaker plays from line-in (TV ARC, optical, 3.5mm) or is in a pairing/setup state, playback metadata is empty or returns a stub object. UI code that assumes metadata always has a track title, artist, and album art throws errors or shows blank screens.

**Prevention:**
- Treat every metadata field as optional; render graceful fallbacks for title ("Unknown"), artist (empty), and album art (placeholder)
- Check source type before attempting to render music-specific metadata

**Phase to address:** Phase 2 (metadata display).

---

### Pitfall 18: node-sonos Transitive Dependency CVEs

**What goes wrong:** If `node-sonos` is included as a dependency (even for reference), its unpinned transitive dependencies accumulate CVEs over time. `npm audit` flags the project constantly.

**Prevention:** Do not include `node-sonos` as a runtime dependency. If SOAP-level patterns from the library are needed as reference, copy specific utility functions with attribution rather than taking the full package.

**Phase to address:** Phase 1 (dependency selection).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: API/protocol selection | Choosing node-sonos (UPnP/SOAP) without verifying it against current firmware | Run live spike against real speaker before committing (Pitfall 1) |
| Phase 1: Network discovery | SSDP multicast blocked on office managed-switch VLANs | Implement `SONOS_SPEAKER_IPS` env-var fallback from day one (Pitfall 2) |
| Phase 1: API client | TLS cert verification disabled globally | Scoped HTTPS agent per-request, never global env var (Pitfall 3) |
| Phase 1: Data model | Zone group membership ignored; commands to wrong speaker | Parse ZoneGroupTopology / `groups` API immediately (Pitfall 4) |
| Phase 1: Architecture | Browser calling speaker IP directly, CORS errors | Proxy-first architecture — no direct browser-to-speaker calls (Pitfall 14) |
| Phase 1: Authentication | PIN brute-forceable with no rate limiting | Add rate limiting in auth middleware from first sprint (Pitfall 15) |
| Phase 1: SOAP (if used) | Action name case-sensitivity causes silent 500 errors | Copy action names from device description XML (Pitfall 16) |
| Phase 2: State sync | Polling too slow or UPnP subscription expiring silently | 2-3s server-side poll for MVP; subscription renewal at 80% timeout (Pitfall 5) |
| Phase 2: Metadata | DIDL-Lite parsing breaks per service type | Per-service fixture-tested parser module (Pitfall 7) |
| Phase 2: Volume | Slider events flood speaker; out-of-order processing | Debounce 150-200ms from first implementation (Pitfall 8) |
| Phase 2: Transport controls | Skip button shown for TuneIn radio with no effect | Detect radio URI scheme; hide skip button conditionally (Pitfall 9) |
| Phase 2: Album art | Speaker-served image URLs fail from different VLAN/subnet | Proxy all album art through backend `/api/art` endpoint (Pitfall 10) |
| Phase 2: Now playing | Metadata undefined for line-in / idle state | Optional-chain every field; graceful fallback display (Pitfall 17) |
| Phase 2/3: Real-time sync | Reconnect shows stale state; no snapshot on reconnect | Send full state snapshot on every connection (Pitfall 12) |
| Phase 3: Source switching | Oauth for Spotify/Deezer mistakenly built | Document clearly: local API, no OAuth needed for playback (Pitfall 6) |
| Ongoing | Firmware update silently breaks parsing | Centralize all SOAP/metadata parsing; log firmware version at startup (Pitfall 11) |

---

## Sonos API Technical Reference

**Local UPnP/SOAP API (port 1400, HTTP — legacy but widely used):**

Key services (accessible at `http://[speaker-ip]:1400/MediaRenderer/[Service]/Control`):
- `AVTransport` — play, pause, stop, next, previous, set URI, get position info
- `RenderingControl` — volume, mute, bass, treble
- `ZoneGroupTopology` — discover zones, group membership, coordinator IDs
- `ContentDirectory` — browse Favorites, queue, music library
- `AlarmClock`, `SystemProperties` — rarely needed for this use case

SOAP call structure:
```
POST http://[speaker-ip]:1400/MediaRenderer/AVTransport/Control
SOAPAction: "urn:schemas-upnp-org:service:AVTransport:1#Play"
Content-Type: text/xml; charset="utf-8"
```

UPnP eventing (push notifications — alternative to polling):
```
SUBSCRIBE http://[speaker-ip]:1400/MediaRenderer/AVTransport/Event
CALLBACK: <http://[your-server-ip]/notify>
NT: upnp:event
TIMEOUT: Second-1800
```
MUST renew before 1800 seconds or the subscription silently expires.

**Local Control API (port 1443, HTTPS + WebSocket — newer, officially supported):**
- REST: `https://[speaker-ip]:1443/api/v1/`
- WebSocket events: `wss://[speaker-ip]:1443/api/v1/websocket`
- Requires trust-on-first-use of self-signed cert
- Subscribe to namespaces: `playbackStatus`, `playbackMetadata`, `volume`, `groups`

**Node.js library options (MEDIUM confidence — verify current maintenance status):**
- `node-sonos` (npm) — most popular historically; UPnP/SOAP; maintenance status uncertain
- Raw HTTP + `fast-xml-parser` / `xml2js` — most resilient; thin wrapper fully under project control
- Official Sonos Control API via direct HTTPS — most forward-compatible; requires more setup

---

## Sources

**Confidence:** All web search, WebFetch, and external tool calls were denied during this research session. Findings are based on training data (cutoff August 2025) from public Sonos developer documentation, GitHub issue trackers for `node-sonos` and related projects, Home Assistant Sonos integration engineering, and community resources known as of that cutoff.

The following must be verified before implementation:

| Claim | Confidence | Verification Action |
|-------|------------|---------------------|
| node-sonos maintenance / last commit | MEDIUM | Check github.com/bencevans/node-sonos — last commit date and open firmware issues |
| Local Control API on port 1443 / WebSocket namespace list | MEDIUM | Verify at developer.sonos.com |
| S2 speaker incompatibility with node-sonos | MEDIUM | Check node-sonos GitHub issues for S2 reports |
| Spotify refresh token rotation (2024) | MEDIUM | Check developer.spotify.com/changelog |
| SSDP multicast blocked on managed switches | HIGH | Standard networking behavior, well-documented |
| CORS blocked for direct browser-to-speaker calls | HIGH | Standard browser security model |
| UPnP subscription default timeout 1800 seconds | MEDIUM | Verify in Sonos UPnP service description XML |
| DIDL-Lite format per-service differences | MEDIUM | Verify by capturing live responses from Spotify, Deezer, TuneIn |

**Recommended verification URLs:**
- https://developer.sonos.com — official Sonos developer documentation
- https://github.com/bencevans/node-sonos — maintenance status and open issues
- https://developer.spotify.com/changelog — Spotify API changes
- https://developers.deezer.com/api — Deezer rate limits and OAuth
- https://community.sonos.com — practitioner reports of API changes

**Cross-referenced with:**
- `C:/Users/Admin/WebstormProjects/.planning/PROJECT.md`
- `C:/Users/Admin/WebstormProjects/.planning/research/FEATURES.md`
