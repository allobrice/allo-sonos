# Roadmap: Sonos Pilot

## Overview

Sonos Pilot se construit de l'intérieur vers l'extérieur : d'abord le backend qui parle aux enceintes, ensuite les commandes de lecture, puis la synchronisation temps réel, puis le shell sécurisé de l'application, et enfin le tableau de bord complet des zones. Chaque phase livre une capacité vérifiable qui débloque la suivante.

## Milestones

- ✅ **v1.0 Sonos Pilot** — Phases 1-4 (shipped 2026-02-27)
- ✅ **v1.1 Zone Dashboard** — Phases 5-6 (shipped 2026-02-27)
- 🚧 **v1.2 Sonos Favorites** — Phases 7-8 (UAT gap closure in progress)

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

<details>
<summary>✅ v1.1 Zone Dashboard (Phases 5-6) — SHIPPED 2026-02-27</summary>

- [x] **Phase 5: Zone Display** — Grille de zones live : nom, now playing, source musicale, indicateur offline, WebSocket temps réel (2/2 plans) — completed 2026-02-27
- [x] **Phase 6: Playback Controls** — Contrôles interactifs par zone : play/pause, skip, volume slider, mute (2/2 plans) — completed 2026-02-27

**Archive:** `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v1.2 Sonos Favorites (UAT gap closure in progress)

**Milestone Goal:** Permettre de parcourir et lancer les favoris Sonos directement depuis chaque zone card.

- [x] **Phase 7: Favorites Backend** — Endpoints REST pour récupérer les favoris (ContentDirectory SOAP) et lancer un favori sur une zone (1/1 plan) — completed 2026-03-03
- [x] **Phase 8: Favorites UI** — Panneau favoris intégré à la ZoneCard : ouverture/fermeture, liste typée, lancement en un tap (3 plans — 2 complete, 1 gap closure pending) (completed 2026-03-04)

## Phase Details

### Phase 7: Favorites Backend
**Goal**: L'API backend expose les favoris Sonos et permet de lancer un favori sur une zone
**Depends on**: Phase 6
**Requirements**: FAV-04
**Success Criteria** (what must be TRUE):
  1. GET /favorites returns a list of all Sonos favorites with title, type (station/playlist/album), and URI
  2. POST /zones/:id/play-favorite accepts a favorite URI and starts playback on the target zone
  3. The favorites list is fetched via ContentDirectory SOAP (Browse FV:2) from a reachable speaker
  4. A favorite with an unknown type falls back to a safe default type rather than failing
**Plans**: 1/1 complete

### Phase 8: Favorites UI
**Goal**: L'utilisateur peut parcourir et lancer un favori directement depuis la ZoneCard
**Depends on**: Phase 7
**Requirements**: FAV-01, FAV-02, FAV-03, NAV-01, NAV-02
**Success Criteria** (what must be TRUE):
  1. User sees a button on each ZoneCard that opens a favorites panel for that zone
  2. User sees the full list of Sonos favorites (station, playlist, album) inside the panel
  3. Each favorite in the list displays a visual indicator of its type (station, playlist, album)
  4. Tapping a favorite starts playback on that zone and closes the panel automatically
  5. User can close the panel without selecting a favorite using the same button or an explicit close control
**Plans**: 3 plans
Plans:
- [x] 08-01-PLAN.md — Favorites store + FavoritesSheet bottom-sheet component
- [x] 08-02-PLAN.md — ZoneCard integration (code-complete)
- [ ] 08-03-PLAN.md — Gap closure: rebuild stale backend dist + add error logging to playFavorite

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Foundation | v1.0 | 2/2 | Complete | 2026-02-26 |
| 2. Playback Commands | v1.0 | 1/1 | Complete | 2026-02-27 |
| 3. Real-time State Sync | v1.0 | 2/2 | Complete | 2026-02-27 |
| 4. App Shell + PIN Auth | v1.0 | 2/2 | Complete | 2026-02-27 |
| 5. Zone Display | v1.1 | 2/2 | Complete | 2026-02-27 |
| 6. Playback Controls | v1.1 | 2/2 | Complete | 2026-02-27 |
| 7. Favorites Backend | v1.2 | 1/1 | Complete | 2026-03-03 |
| 8. Favorites UI | 3/3 | Complete   | 2026-03-04 | — |
