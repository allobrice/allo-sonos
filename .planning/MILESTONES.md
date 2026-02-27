# Milestones

## v1.0 Sonos Pilot (Shipped: 2026-02-27)

**Phases completed:** 4 phases, 7 plans, 16 tasks
**Timeline:** 3 days (2026-02-25 → 2026-02-27)
**LOC:** 2,059 (TypeScript + Vue + CSS)
**Git range:** `c01f725` (feat(01-01)) → `4814e01` (feat(04-02))

**Key accomplishments:**
- Fastify v5 backend with SSDP discovery, manual IP fallback, and speaker registry
- 8 dedicated playback REST endpoints with direct SOAP command layer (validated on real hardware)
- Real-time state sync pipeline: GENA/UPnP → StateCache (300ms debounce) → WebSocket broadcast
- Vue 3 SPA with PIN auth gate, httpOnly cookie session, and localStorage flash prevention
- Responsive mobile-first app shell with dark theme, design tokens, and WebSocket status indicator
- Architecture validated by spike on real Sonos hardware — direct SOAP for commands, @svrooij/sonos for discovery only

---

