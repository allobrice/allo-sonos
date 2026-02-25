# Stack Research

**Domain:** Sonos controller web application (local network)
**Researched:** 2026-02-25
**Confidence:** MEDIUM — based on training knowledge. Library versions should be verified against npm/GitHub before implementation.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20 LTS+ | Backend runtime | Stable LTS, native ES modules, excellent for event-driven I/O needed for UPnP subscriptions |
| TypeScript | ~5.x | Type safety | Sonos UPnP responses are complex XML — types prevent runtime bugs in parsing |
| Fastify | ~5.x | HTTP server + REST API | Fastest Node.js framework, plugin architecture, built-in JSON schema validation. Lighter than Express for a small API surface |
| ws | ~8.x | WebSocket server | Minimal, fast, zero-dependency WebSocket library. No need for Socket.IO overhead |
| sonos (node-sonos) | ~1.x | Sonos UPnP/SOAP abstraction | Most established Node.js Sonos library — handles SSDP discovery, SOAP envelopes, event subscriptions. **VERIFY: maintenance status post-2023** |
| Vue.js | 3.x | Frontend SPA | Lightweight, reactive, fast to scaffold a simple UI. Less boilerplate than React for a small app with 3-5 views |
| Vite | ~6.x | Frontend build tool | Instant HMR, fast builds, Vue first-class support |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xml2js | ~0.6.x | XML parsing | Parse Sonos SOAP responses and DIDL-Lite metadata into JS objects |
| fast-xml-parser | ~4.x | Alternative XML parsing | Faster than xml2js, no callbacks — preferred if xml2js feels slow |
| pinia | ~2.x | Vue state management | Store zone states, playback info, WebSocket-driven reactive updates |
| @vueuse/core | ~11.x | Vue composables | Useful utilities: useWebSocket, useStorage (PIN session), useMediaControls |
| bcrypt | ~5.x | PIN hashing | Hash the shared PIN at rest, compare on login |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsx | Run TypeScript directly | Fast dev iteration without compile step |
| vitest | Testing | Fast, Vite-native, works for both backend and frontend tests |
| ESLint + Prettier | Code quality | Standard config, no debate |

## Installation

```bash
# Core backend
npm install fastify ws sonos xml2js

# Core frontend
npm install vue pinia @vueuse/core

# Dev dependencies
npm install -D typescript tsx vite vitest @vitejs/plugin-vue eslint prettier
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Fastify | Express | If team already knows Express — performance difference is marginal for this scale |
| sonos (node-sonos) | node-sonos-http-api | If you want a standalone HTTP proxy without writing custom backend. Pre-built REST API for Sonos. Simpler but less control |
| sonos (node-sonos) | @svrooij/sonos2mqtt | If you already have MQTT infrastructure (Home Assistant). Overkill for a standalone web app |
| Vue 3 | React | If team has React experience. Both work fine for this scope. Vue is lighter for small apps |
| Vue 3 | Vanilla JS + HTMX | If you want zero-framework. Works for very simple UI but loses reactivity benefits for real-time state |
| ws | Socket.IO | If you need auto-reconnection and rooms. Socket.IO adds 50KB+ client bundle for features this app doesn't need |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Sonos Cloud API | Requires OAuth app registration, adds cloud latency (200-500ms), needs internet even on LAN. Overkill for local control | Local UPnP/SOAP via node-sonos |
| Next.js / Nuxt | SSR frameworks are unnecessary overhead for a single-page control panel on LAN. No SEO needed | Vite + Vue SPA |
| Socket.IO | Adds 50KB+ client bundle, namespace/room abstraction unnecessary for 1-5 concurrent users | ws (native WebSocket) |
| MongoDB / PostgreSQL | No persistent data needed — zone state is ephemeral (from speakers), PIN is an env var | In-memory state cache |
| Redis | Single Node.js process per LAN, no horizontal scaling needed | In-memory Map |
| Tailwind CSS | Adds build complexity for a small UI. 10-15 components don't justify a utility framework | Scoped CSS or a minimal CSS file |
| Electron | Desktop wrapper unnecessary — this is a web app accessed via browser on LAN | Vite dev server or static files behind Fastify |

## Stack Patterns by Variant

**If node-sonos is unmaintained or broken with current firmware:**
- Use `node-sonos-http-api` as a standalone sidecar process
- Your Fastify backend proxies to it instead of using node-sonos directly
- More moving parts but decouples from library maintenance

**If you want the absolute simplest deployment:**
- Use `node-sonos-http-api` as the entire backend (it's already a REST server)
- Build Vue frontend as static files served by it
- Trade-off: less control over API shape and WebSocket behavior

**If Sonos S2 Local HTTP API covers all needed features:**
- Skip node-sonos entirely
- Call the Sonos speaker's local REST API (port 1443) directly from Fastify
- Simpler, but only works with S2 firmware speakers

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| node-sonos@1.x | Sonos S1 + S2 firmware | Uses UPnP/SOAP which works on both. Verify against latest firmware |
| Fastify@5.x | Node.js 20+ | Dropped Node 18 support |
| Vue@3.x | Vite@6.x | First-class integration via @vitejs/plugin-vue |
| ws@8.x | Node.js 18+ | Native Buffer handling |

## Sources

- node-sonos GitHub (https://github.com/bencevans/node-sonos) — MEDIUM confidence, verify current status
- node-sonos-http-api GitHub (https://github.com/jishi/node-sonos-http-api) — MEDIUM confidence
- Sonos Developer Portal (https://developer.sonos.com) — verify S2 local API coverage
- Fastify docs (https://fastify.dev) — HIGH confidence
- Vue.js docs (https://vuejs.org) — HIGH confidence

---
*Stack research for: Sonos controller web app*
*Researched: 2026-02-25*
