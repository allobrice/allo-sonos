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

## Milestone: v1.1 — Zone Dashboard

**Shipped:** 2026-02-27
**Phases:** 2 | **Plans:** 4 | **Tasks:** 10

### What Was Built
- Pinia zones store with WebSocket snapshot loading, state_changed event dispatch, and Map<UUID, ZoneState> reactivity pattern
- ZoneCard component — responsive grid (2-col desktop, 1-col mobile), now playing info, inline SVG source icons (Spotify, Deezer, TuneIn, Library)
- Transport controls (play/pause, skip next/prev) with optimistic UI and 300ms anti-double-tap debounce
- Volume slider with debounced drag, decoupled localVolume ref, and accent-green WebKit fill
- Mute toggle with context-aware speaker icon (muted/low/medium/high volume levels)

### What Worked
- **Phase 5 infrastructure → Phase 6 controls** — clean layering: store + WebSocket first, then UI controls on top
- **Optimistic UI pattern** — toggling playState immediately on tap then reverting on error gives a responsive feel without spinners
- **localVolume ref decoupled from store** — solved the slider-jumping-while-dragging problem elegantly
- **Inline SVG icons** — monochrome SVGs with fill=currentColor adapt to theme naturally, zero external dependencies
- **Velocity** — 4 plans in ~6 minutes total execution time, very fast iteration

### What Was Inefficient
- **SUMMARY one_liner fields** still not populated in frontmatter — same issue as v1.0, gsd-tools summary-extract returns null
- **Dual WebSocket connections** (AppHeader + ZonesView) — intentional per architecture doc but may need refactoring if connection limits appear
- **Phase 6 plans marked incomplete in ROADMAP.md** — checkboxes showed `[ ]` despite both plans having SUMMARY.md files (metadata drift again)

### Patterns Established
- Map ref replacement for Pinia reactivity with Map<string, ZoneState> — O(1) lookups, no spread operator needed
- Optimistic UI with silent revert on API error — applicable to all future control actions
- localVolume + dragging ref pattern for decoupled slider state — reusable for any continuous input synced with WebSocket
- Dual-event volume handling: @input (debounced 250ms during drag) + @change (immediate on release)
- Transport controls gated by v-if="!isOffline" — offline zones show only status badge

### Key Lessons
1. **Decouple continuous input from store state** — sliders/dials that receive both user input and server updates need a local ref gated by interaction state
2. **Optimistic UI works best with simple state toggles** — play/pause is perfect for optimistic; track info (from skip) should wait for server
3. **Keep SUMMARY frontmatter complete** — two milestones in a row with missing one_liner fields; this is a recurring gap to address in workflow

### Cost Observations
- Model mix: ~30% opus, ~60% sonnet, ~10% haiku (estimated)
- Sessions: ~5 (context + plan + execute per phase, plus audit)
- Notable: Phase 5 executed in 2min 22s (2 plans) — store + WebSocket patterns from v1.0 made this very fast

---

## Milestone: v1.2 — Sonos Favorites

**Shipped:** 2026-03-04
**Phases:** 2 | **Plans:** 4 | **Tasks:** 7

### What Was Built
- ContentDirectory SOAP Browse FV:2 service with 5-minute in-memory TTL cache and stale fallback on error
- REST API: GET /api/favorites + POST /api/speakers/:id/play-favorite with coordinator routing and escapeXml
- Pinia favorites store with frontend cache guard (skip if already loaded) and fire-and-forget playFavorite
- FavoritesSheet bottom-sheet component: skeleton shimmer, error+retry, empty state, favorites list with SVG type icons
- ZoneCard heart button integration: pink heart opens sheet, tap-to-play-and-close, backdrop/X close without playing

### What Worked
- **Backend → UI layering** continued from v1.0/v1.1 — Phase 7 API complete before Phase 8 UI touched favorites
- **Direct SOAP pattern reuse** — ContentDirectory Browse followed the exact same raw fetch pattern as playback commands
- **Fire-and-forget with WebSocket update** — no optimistic UI needed for favorites; WebSocket state_changed pushes the update naturally
- **Gap closure process** — audit identified stale dist issue, 08-03 gap plan fixed it surgically in 5 minutes
- **Fast velocity** — 4 plans in ~16 minutes total execution time

### What Was Inefficient
- **Stale backend dist** not caught until UAT — adding new routes requires rebuilding dist, but this wasn't obvious until runtime 404 on /api/favorites
- **playFavorite silent catch** — initial implementation had empty catch block, caught by audit as tech debt
- **SUMMARY one_liner still missing from frontmatter** — third milestone in a row with this gap; gsd-tools summary-extract returns null
- **fav-btn touch target 28x28px** — below 44px accessibility guideline; inconsistent with other buttons

### Patterns Established
- ContentDirectory SOAP Browse pattern: raw fetch to `/MediaServer/ContentDirectory/Control`, DIDL-Lite double-parse
- Module-level cache with TTL + stale fallback: simple, effective, no external dependency
- Bottom-sheet pattern: Teleport to body + Transition + fixed overlay + slide-up CSS animation
- Watch props.visible for lazy data loading — sheet fetches only on first open
- Always rebuild backend dist after adding new routes before UAT

### Key Lessons
1. **Rebuild dist after every backend change** — gitignored dist can silently serve stale code, causing confusing 404s
2. **Never silently catch API errors** — even fire-and-forget patterns should log warnings for developer visibility
3. **Gap closure is cheap when caught by audit** — the 08-03 plan took 5 minutes; finding the root cause in UAT would have taken much longer without the audit
4. **SUMMARY frontmatter automation gap persists** — three milestones without one_liner field populated; should be addressed at workflow level

### Cost Observations
- Model mix: ~30% opus, ~60% sonnet, ~10% haiku (estimated)
- Sessions: ~6 (context + plan + execute per phase, plus audit + gap closure)
- Notable: Phase 7 backend executed in 8 minutes — direct SOAP patterns fully established from v1.0

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 4 | 7 | Initial project — established spike-first, inside-out phase ordering |
| v1.1 | 2 | 4 | Dashboard build — layered store→component→controls, optimistic UI patterns |
| v1.2 | 2 | 4 | Favorites — SOAP content browsing, bottom-sheet pattern, gap closure process validated |

### Top Lessons (Verified Across Milestones)

1. Spike hardware APIs before building production code on them
2. Keep SUMMARY frontmatter populated for downstream automation (failed in v1.0, v1.1, and v1.2)
3. Layered phase dependencies (infra → display → controls) deliver clean, fast iterations
4. Decouple continuous input (sliders) from server-synced state with local refs
5. Always rebuild dist after backend changes — stale compiled output causes silent failures (v1.2)
6. Milestone audit catches issues cheaply — gap closure is surgical when root cause is identified early (v1.2)
