# Roadmap: Sonos Pilot

## Overview

Sonos Pilot se construit de l'intérieur vers l'extérieur : d'abord le backend qui parle aux enceintes, ensuite les commandes de lecture, puis la synchronisation temps réel, puis le shell sécurisé de l'application, et enfin le tableau de bord complet des zones. Chaque phase livre une capacité vérifiable qui débloque la suivante.

## Milestones

- ✅ **v1.0 Sonos Pilot** — Phases 1-4 (shipped 2026-02-27)
- 📋 **v1.1** — Phase 5 (planned)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

<details>
<summary>✅ v1.0 Sonos Pilot (Phases 1-4) — SHIPPED 2026-02-27</summary>

- [x] **Phase 1: Backend Foundation** — Backend Fastify, SSDP discovery, speaker registry (2/2 plans) — completed 2026-02-26
- [x] **Phase 2: Playback Commands** — 8 REST endpoints play/pause/volume/mute/skip (1/1 plan) — completed 2026-02-27
- [x] **Phase 3: Real-time State Sync** — GENA/UPnP → StateCache → WebSocket broadcast (2/2 plans) — completed 2026-02-27
- [x] **Phase 4: App Shell + PIN Auth** — Vue 3 SPA, PIN auth, responsive dark theme (2/2 plans) — completed 2026-02-27

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 📋 Next (Planned)

- [ ] **Phase 5: Zone Dashboard** — Tableau de bord des zones avec état, now playing, et indicateur de source

### Phase 5: Zone Dashboard
**Goal**: Users can see all zones at a glance, know what is playing in each, and control any zone directly from the dashboard
**Depends on**: Phase 4
**Requirements**: ZONE-01, ZONE-02, SRC-01
**Success Criteria** (what must be TRUE):
  1. All discovered zones appear on a single screen, each showing whether it is playing, paused, or idle
  2. For each zone that is playing, the current track title and artist name are visible
  3. For each zone, the active music source (Spotify, Deezer, or TuneIn) is identifiable
  4. Playback controls (play/pause, volume slider, mute, skip) are accessible per zone without navigating away from the dashboard
  5. When state changes on any zone, the dashboard updates automatically without a page reload
**Plans**: TBD

Plans:
- [ ] 05-01: Zone card component (state, now playing, source indicator) + WebSocket integration
- [ ] 05-02: Per-zone transport controls (play/pause, volume slider, mute, skip) wired to backend API

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Foundation | v1.0 | 2/2 | Complete | 2026-02-26 |
| 2. Playback Commands | v1.0 | 1/1 | Complete | 2026-02-27 |
| 3. Real-time State Sync | v1.0 | 2/2 | Complete | 2026-02-27 |
| 4. App Shell + PIN Auth | v1.0 | 2/2 | Complete | 2026-02-27 |
| 5. Zone Dashboard | v1.1 | 0/2 | Not started | - |
