# Feature Landscape

**Domain:** Sonos controller web application (local network, company intranet, 2-5 zones)
**Researched:** 2026-02-25
**Overall confidence:** MEDIUM

**Confidence note:** WebSearch, WebFetch, and Bash tools were unavailable in this session. All findings
are drawn from training knowledge of: Sonos UPnP/SOAP local API (port 1400), the Sonos Local Control
HTTP API (~2020+), node-sonos npm library, Home Assistant Sonos integration, and third-party Sonos
controller apps (sonos-web, SonoPhone, Symfonisk). No live verification was possible. Critical API
availability claims are flagged explicitly. Verify against https://developer.sonos.com before
implementation.

---

## Table Stakes

Features users expect from any Sonos controller. Absence makes the product feel broken or incomplete.
These are the features where the official Sonos app sets the baseline expectation for any replacement.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Play / Pause | Core playback — every controller has it; first thing a user tries | Low | Toggle; reflect actual device state immediately after command |
| Per-zone volume control | Volume is the #1 interaction in multi-room audio; expect slider or +/- | Low | Reflect current level on mount; debounce rapid changes to avoid flooding API |
| Zone / room listing | Users need to see which speakers exist and whether they are active | Low | Show name, playback state (playing/paused/idle), current track per zone |
| Now Playing display | Users need to know what is playing without navigating away | Low | Track name + artist minimum; album title optional |
| Mute per zone | Instant silence without losing volume position | Low | Toggle; visually distinct from volume=0 |
| Source / service indicator | Users need to see which service is active (Spotify vs Deezer vs radio) | Low | Service icon + source name; changes when source switches |
| Skip track (Next) | Expected for queue-based sources (Spotify, Deezer) | Low | UPnP AVTransport Next action; N/A for live radio — disable gracefully |
| Skip track (Previous) | Less critical than Next but expected | Low | Same constraint as Next; may restart current track on first press |
| Real-time state sync | UI must reflect changes made from other clients (phone, web, another browser) | Medium | Polling every 3-5 s is acceptable for LAN; UPnP event subscriptions are more efficient but require callback server |
| Mobile-responsive layout | Team uses phones in the office; must work on any screen size | Low | CSS-only responsive; no separate mobile codebase |
| PIN authentication | Project requirement; prevents unauthorized access on company LAN | Low | Single shared PIN; session cookie with reasonable TTL (8h or until browser closes) |

---

## Differentiators

Features beyond baseline that provide genuine value for this specific use case:
company intranet, 2-5 zones, non-technical team, "control in under 3 seconds."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sub-3-second time-to-control | Core value prop from PROJECT.md; zero loading friction | Medium | Requires cached zone discovery on server startup; zone list must render without waiting for full discovery cycle |
| One-screen zone overview | All 2-5 zones visible without scrolling or navigation | Low | Card-per-zone layout; critical for a small fixed installation |
| Source switcher via Sonos Favorites | Switch between Spotify / Deezer / TuneIn presets with one tap | Medium | Sonos stores Favorites in ContentDirectory; enumerate them and present as launch buttons |
| Album art per zone | Richer "now playing" context; makes the app feel polished | Low | DIDL-Lite metadata in AVTransport GetPositionInfo includes album art URL; proxy through server to avoid CORS |
| Keyboard shortcuts | Power users at desks control without mouse | Low | Space=play/pause, arrow up/down=volume; trivial to add, measurable value for desktop users |
| Visual playing indicator | Animated icon or color accent shows which zones are active at a glance | Low | CSS animation on "playing" state; no API calls required beyond state sync |
| Optimistic UI updates | Commands feel instant; state update confirms silently | Low | Apply state change in UI immediately on user action; revert if server returns error |
| Zone grouping (play everywhere) | All zones play the same source for events or all-hands meetings | High | UPnP AVTransport group URIs; fragile edge cases around group coordinator; defer unless explicitly requested |

---

## Anti-Features

Features to explicitly NOT build for this project. Each one is deliberate — some because PROJECT.md
rules them out, others because they add complexity with no proportionate value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Individual user accounts / login | Trusted team environment; per-user auth is overengineering | Single shared PIN as env var; session cookie |
| Music library browsing (search, playlists, albums) | Enormous scope; Spotify/Deezer native apps already do this better | Surface Sonos Favorites only; deep browsing stays in native apps |
| Sonos Cloud API / OAuth flow | Adds OAuth redirect dance for a local-network app; unnecessary | Use local UPnP/SOAP (port 1400) or Local Control HTTP API directly |
| Multi-account Spotify / Deezer per user | Complex token management; company likely has shared service accounts already linked in Sonos | Resume whatever source is linked in the Sonos system |
| Advanced group management (stereo pairs, surrounds, arc/sub) | Speaker pairing is a one-time admin task; not daily use | Leave in official Sonos app |
| Scheduling / alarms / timers | No stated business need; adds clock and timezone complexity | Out of scope per PROJECT.md |
| Native mobile app (iOS / Android) | Responsive web app covers the need; eliminates app store distribution | Responsive web + optional PWA manifest for "add to home screen" |
| Equalizer / audio settings (bass, treble, loudness) | Rarely changed; per-speaker capability matrix is complex | Leave in official Sonos app |
| Voice control integration | Sonos already integrates Amazon Alexa and Google Assistant | Out of scope |
| External access beyond LAN | Increases attack surface without business need; team is on-site | LAN only; no DDNS, VPN tunnel, or reverse proxy for public internet |
| Sleep timer / snooze | Nice in a home context; no office use case stated | Out of scope |
| Sonos Favorites management (editing, reordering, deleting) | Editing stays in official app; this app is read-and-launch only | Display and launch Favorites; do not mutate them |
| Crossfade / gapless playback settings | Playback quality settings are set-once by admin | Leave in official Sonos app |

---

## Feature Dependencies

```
PIN auth
  └─> All other screens (nothing is accessible without passing PIN)

Zone discovery / listing
  └─> Play / Pause (per zone)
  └─> Volume control (per zone)
  └─> Mute (per zone)
  └─> Now Playing display (per zone)
  └─> Source indicator (per zone)
  └─> Skip track (per zone)
  └─> Zone grouping (requires zone list as foundation)

Now Playing display
  └─> Album art (album art is optional enhancement on top of Now Playing)
  └─> Skip track button visibility (disable skip for radio sources)

Sonos Favorites fetch (ContentDirectory browse)
  └─> Source switcher UI (Favorites are how you launch Spotify/Deezer/TuneIn without full browsing)

Real-time state sync (polling or UPnP events)
  └─> Now Playing freshness
  └─> Zone state indicators (playing/paused/idle)
  └─> Volume level accuracy after external changes
```

---

## MVP Recommendation

**Must ship at launch — table stakes core:**

1. PIN authentication (entry gate; blocks unauthorized use)
2. Zone overview — all 2-5 zones on one screen
3. Play / Pause per zone
4. Volume control per zone (slider or +/- buttons)
5. Mute per zone
6. Now Playing (track + artist + service indicator) per zone
7. Source switcher via Sonos Favorites (one-tap launch for Spotify / Deezer / TuneIn presets)
8. Real-time state polling (every 3-5 seconds)
9. Mobile-responsive layout

**Include in v1 — low complexity, high value:**

- Album art per zone (from DIDL-Lite metadata; visual polish, few lines of code)
- Skip Next per zone (disable gracefully for radio sources)
- Keyboard shortcuts (space, arrows; 1-2 hours of work)

**Defer until team asks for it:**

- Skip Previous (less used than Next; add when requested)
- Zone grouping (play everywhere): Technically possible via UPnP; defer because edge cases in group
  coordinator handoff are non-trivial and the 2-5 zone count makes manual re-selection acceptable
- Playback progress bar: Low value add; adds polling overhead; skip until UI feedback requests it

---

## Sonos API Feature Availability

**Confidence: MEDIUM** — based on training knowledge of Sonos UPnP/SOAP (port 1400) and the Sonos
Local Control HTTP API. No live verification was possible.

### UPnP / SOAP Interface (port 1400)

| Feature | Available | Service / Action | Notes |
|---------|-----------|-----------------|-------|
| Play | YES | AVTransport / Play | |
| Pause | YES | AVTransport / Pause | |
| Stop | YES | AVTransport / Stop | |
| Next track | YES | AVTransport / Next | Throws error on live radio — handle gracefully |
| Previous track | YES | AVTransport / Previous | |
| Get volume | YES | RenderingControl / GetVolume | Channel: Master |
| Set volume | YES | RenderingControl / SetVolume | |
| Get mute | YES | RenderingControl / GetMute | |
| Set mute | YES | RenderingControl / SetMute | |
| Now Playing metadata | YES | AVTransport / GetPositionInfo | Returns DIDL-Lite XML with track, artist, album art URL |
| Zone / group topology | YES | ZoneGroupTopology / GetZoneGroupState | Lists all zones and their group membership |
| SSDP discovery | YES | UPnP SSDP (port 1900) | Discover all Sonos devices on LAN |
| Browse Favorites | YES | ContentDirectory / Browse | ObjectID: FV:2 for favorites |
| Browse Favorite Radio | YES | ContentDirectory / Browse | ObjectID: R:0/0 for radio favorites |
| UPnP event subscriptions | YES | Any service / SUBSCRIBE | HTTP callbacks; requires server to expose a callback endpoint |
| Create zone group | YES | AVTransport / SetAVTransportURI with group URI | Fragile; group coordinator changes affect all members |
| Leave zone group | YES | AVTransport / BecomeCoordinatorOfStandaloneGroup | |
| Queue management | YES | Queue service | Out of scope for this project |

### Source Integration Specifics

| Source | Integration Pattern | Auth Required | Notes |
|--------|-------------------|--------------|-------|
| Spotify | Resume via AVTransport (Spotify URI already in Sonos) | None (already linked) | Cannot deep-browse Spotify tracks without Spotify access token; resume last played or launch a Favorite |
| Deezer | Same as Spotify — resume via AVTransport | None (already linked) | Same constraints as Spotify |
| TuneIn | Native to Sonos; tuneIn:// URIs in ContentDirectory | None | Radio stations available as Favorites; direct TuneIn URI playback via AVTransport |
| Apple Music | Out of scope (not in PROJECT.md) | — | |
| Amazon Music | Out of scope (not in PROJECT.md) | — | |

### Authentication Patterns for Web Controller Apps

| Pattern | Complexity | Security | Recommendation |
|---------|------------|---------|----------------|
| Shared PIN (env var) + session cookie | Low | Adequate for trusted LAN | **USE THIS** — PROJECT.md decision |
| Per-user accounts (username + password) | High | Strong | Overkill for use case |
| No authentication | None | None | Unacceptable even on LAN |
| IP allowlist only | Low | Weak (spoofable) | Insufficient alone |
| Sonos Cloud OAuth | Very high | Strong (over-engineered) | Wrong tool for LAN app |

**PIN implementation notes (MEDIUM confidence):**
- Store hashed PIN in server env var (bcrypt or argon2; not plain text)
- On successful PIN entry, issue a signed session token (JWT or signed cookie) with TTL of 8-24h
- All API routes verify session token; unauthenticated requests return 401 and redirect to PIN screen
- No CSRF concern for same-origin API calls; add CSRF token if form POST is used for PIN submission

---

## Sources

- Project context: `C:/Users/Admin/WebstormProjects/.planning/PROJECT.md`
- Training knowledge: Sonos UPnP/SOAP local API documentation (AVTransport 1.0, RenderingControl 1.0,
  ZoneGroupTopology, ContentDirectory services), node-sonos npm package (github.com/bencevans/node-sonos),
  Home Assistant Sonos integration feature set, third-party Sonos controller apps (sonos-web,
  SonoPhone, Symfonisk), Sonos Local Control API release notes (~2020)
- **Verify at:** https://developer.sonos.com (current API docs and deprecation notices)
- **IMPORTANT:** No live web verification was available in this session. All API availability claims
  are MEDIUM confidence. Before implementation, verify: (1) current firmware compatibility with UPnP
  SOAP interface, (2) node-sonos maintenance status vs. direct HTTP alternatives, (3) Sonos Local
  Control HTTP API maturity as an alternative to raw UPnP/SOAP.
