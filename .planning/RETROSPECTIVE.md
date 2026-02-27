# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Sonos Pilot

**Shipped:** 2026-02-27
**Phases:** 4 | **Plans:** 7 | **Tasks:** 16

### What Was Built
- Fastify v5 backend with SSDP discovery, manual IP fallback, and SpeakerRegistry
- 8 dedicated playback REST endpoints (play, pause, next, previous, volume, mute, unmute, state) via direct SOAP
- Real-time state sync pipeline: GENA/UPnP events → StateCache (300ms debounce) → WebSocket broadcast
- Vue 3 SPA with PIN auth gate (httpOnly cookie + localStorage), responsive dark theme app shell
- Architecture validated by spike on real Sonos hardware before production code

### What Worked
- **Spike-first approach** for Sonos library evaluation — caught broken API before building on it, saved significant rework
- **Direct SOAP fallback** — when @svrooij/sonos command API failed on real hardware, having a raw fetch alternative was immediate
- **Phase ordering inside-out** (backend → API → real-time → UI) — each phase built cleanly on the previous one's deliverables
- **Human-verify checkpoints** in Phase 4 — caught visual/UX issues that static analysis cannot detect
- **Fast velocity** — 7 plans in 3 days (~107 min total execution time, ~15 min avg per plan)

### What Was Inefficient
- **SUMMARY frontmatter metadata** not populated (`requirements-completed`, `one_liner` fields) — reduced audit automation effectiveness
- **Phase 2 progress table** not updated in ROADMAP.md (showed "Not started" despite being complete) — metadata drift
- **dotenv: true vs false** decision documented one way, implemented another — minor config drift

### Patterns Established
- Direct SOAP for Sonos commands (raw fetch to port 1400) — @svrooij/sonos for SSDP discovery only
- StateCache with per-UUID debounce + broadcastFn injection pattern for decoupling
- Fastify plugin registration order: env → cookie → sonos → websocket → gena → routes
- CSS custom property design tokens for theming — all components reference var(--color-*)
- httpOnly cookie + localStorage dual persistence for auth (server session + flash prevention)

### Key Lessons
1. **Always spike hardware APIs** — library documentation doesn't guarantee runtime behavior on real devices
2. **Phase dependencies should be explicit in code** — Fastify plugin `dependencies` array catches registration order bugs
3. **Debounce at the cache layer, not the transport layer** — 300ms per-UUID debounce in StateCache is cleaner than WS-level batching
4. **Keep SUMMARY metadata populated** — audit/completion workflows depend on structured frontmatter fields

### Cost Observations
- Model mix: ~40% opus, ~50% sonnet, ~10% haiku (estimated from workflow agents)
- Sessions: ~8 (plan + execute per phase, plus audit)
- Notable: Phase 2 executed in 3 minutes — well-structured plan with clear SOAP patterns from Phase 1

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 4 | 7 | Initial project — established spike-first, inside-out phase ordering |

### Top Lessons (Verified Across Milestones)

1. Spike hardware APIs before building production code on them
2. Keep SUMMARY frontmatter populated for downstream automation
