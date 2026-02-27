# Roadmap: Sonos Pilot

## Overview

Sonos Pilot se construit de l'intérieur vers l'extérieur : d'abord le backend qui parle aux enceintes, ensuite les commandes de lecture, puis la synchronisation temps réel, puis le shell sécurisé de l'application, et enfin le tableau de bord complet des zones. Chaque phase livre une capacité vérifiable qui débloque la suivante.

## Milestones

- ✅ **v1.0 Sonos Pilot** — Phases 1-4 (shipped 2026-02-27)
- ✅ **v1.1 Zone Dashboard** — Phases 5-6 (shipped 2026-02-27)

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Foundation | v1.0 | 2/2 | Complete | 2026-02-26 |
| 2. Playback Commands | v1.0 | 1/1 | Complete | 2026-02-27 |
| 3. Real-time State Sync | v1.0 | 2/2 | Complete | 2026-02-27 |
| 4. App Shell + PIN Auth | v1.0 | 2/2 | Complete | 2026-02-27 |
| 5. Zone Display | v1.1 | 2/2 | Complete | 2026-02-27 |
| 6. Playback Controls | v1.1 | 2/2 | Complete | 2026-02-27 |
