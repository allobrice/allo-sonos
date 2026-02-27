# Roadmap: Sonos Pilot

## Overview

Sonos Pilot se construit de l'intérieur vers l'extérieur : d'abord le backend qui parle aux enceintes, ensuite les commandes de lecture, puis la synchronisation temps réel, puis le shell sécurisé de l'application, et enfin le tableau de bord complet des zones. Chaque phase livre une capacité vérifiable qui débloque la suivante.

## Milestones

- ✅ **v1.0 Sonos Pilot** — Phases 1-4 (shipped 2026-02-27)
- 🚧 **v1.1 Zone Dashboard** — Phases 5-6 (in progress)

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

### 🚧 v1.1 Zone Dashboard (In Progress)

**Milestone Goal:** Dashboard grille montrant toutes les zones Sonos avec état en temps réel et contrôle direct par zone.

- [ ] **Phase 5: Zone Display** — Grille de zones live : nom, now playing, source musicale, indicateur offline, WebSocket temps réel
- [ ] **Phase 6: Playback Controls** — Contrôles interactifs par zone : play/pause, skip, volume slider, mute

## Phase Details

### Phase 5: Zone Display
**Goal**: Users can see every zone at a glance with live state — what is playing, the source, and whether the speaker is reachable
**Depends on**: Phase 4
**Requirements**: ZONE-01, ZONE-02, ZONE-03, ZONE-04, RT-01, RT-02, RT-03
**Success Criteria** (what must be TRUE):
  1. All discovered zones appear as cards in a responsive grid (2 columns on desktop, 1 column on mobile at 375px)
  2. Each zone card shows the zone name, current track title and artist name when something is playing
  3. Each zone card shows which music source is active (Spotify, Deezer, TuneIn, or Library)
  4. A zone card shows a distinct offline indicator when the speaker is unreachable
  5. Zone state loads immediately on page open without manual refresh, and updates automatically when state changes on any zone
**Plans**: TBD

Plans:
- [ ] 05-01: Zone store (Pinia) + WebSocket integration — snapshot load, state_changed events, reconnect logic
- [ ] 05-02: ZoneCard component — grid layout, now playing, source indicator, offline state, design tokens

### Phase 6: Playback Controls
**Goal**: Users can control any zone directly from the dashboard card without navigating away
**Depends on**: Phase 5
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04
**Success Criteria** (what must be TRUE):
  1. Tapping the play/pause button on a zone card toggles playback on that zone and the button state updates immediately
  2. Tapping skip-next or skip-previous on a zone card advances or steps back the track on that zone
  3. Dragging the volume slider on a zone card adjusts the zone volume, and the slider reflects the current level after a WebSocket update
  4. Tapping the mute button on a zone card toggles mute and the button reflects the current mute state
**Plans**: TBD

Plans:
- [ ] 06-01: Transport controls (play/pause, skip prev/next) — ZoneCard integration, REST API wiring, optimistic UI
- [ ] 06-02: Volume slider + mute control — debounced slider, mute toggle, synced from WebSocket state

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Foundation | v1.0 | 2/2 | Complete | 2026-02-26 |
| 2. Playback Commands | v1.0 | 1/1 | Complete | 2026-02-27 |
| 3. Real-time State Sync | v1.0 | 2/2 | Complete | 2026-02-27 |
| 4. App Shell + PIN Auth | v1.0 | 2/2 | Complete | 2026-02-27 |
| 5. Zone Display | 1/2 | In Progress|  | - |
| 6. Playback Controls | v1.1 | 0/2 | Not started | - |
