# Roadmap: Sonos Pilot

## Overview

Sonos Pilot se construit de l'intérieur vers l'extérieur : d'abord le backend qui parle aux enceintes, ensuite les commandes de lecture, puis la synchronisation temps réel, puis le shell sécurisé de l'application, et enfin le tableau de bord complet des zones. Chaque phase livre une capacité vérifiable qui débloque la suivante.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Backend Foundation** - Backend Fastify opérationnel, découverte SSDP des enceintes, registre des speakers
- [ ] **Phase 2: Playback Commands** - Contrôles de lecture complets (play/pause, volume, mute, skip) via REST API
- [ ] **Phase 3: Real-time State Sync** - Cache d'état, souscriptions GENA/UPnP, push WebSocket vers le navigateur
- [ ] **Phase 4: App Shell + PIN Auth** - Application Vue protégée par PIN, layout responsive mobile-first
- [ ] **Phase 5: Zone Dashboard** - Tableau de bord des zones avec état, now playing, et indicateur de source

## Phase Details

### Phase 1: Backend Foundation
**Goal**: Le backend Node.js tourne, découvre les enceintes Sonos sur le réseau local, et peut envoyer une commande basique
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-04
**Success Criteria** (what must be TRUE):
  1. The backend starts and logs discovered Sonos speakers on the local network
  2. A discovered speaker can be commanded (e.g., pause) via a direct API call and the speaker responds
  3. If SSDP discovery fails, the backend accepts a manually configured IP and treats it as a valid speaker
  4. The backend correctly identifies the coordinator of a zone group so commands reach the right speaker
**Plans**: TBD

Plans:
- [ ] 01-01: Project scaffold + Fastify server + node-sonos spike
- [ ] 01-02: SSDP discovery service + manual IP fallback + speaker registry

### Phase 2: Playback Commands
**Goal**: Every transport control (play, pause, volume, mute, skip) is available and works on any discovered zone via the API
**Depends on**: Phase 1
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04
**Success Criteria** (what must be TRUE):
  1. Sending a play or pause command to a zone via the API starts or stops playback on that speaker
  2. Adjusting volume via the API changes the speaker volume immediately
  3. Muting and unmuting a zone via the API silences and restores audio
  4. Sending a next or previous command via the API skips to the next or previous track
**Plans**: TBD

Plans:
- [ ] 02-01: REST API endpoints for play/pause, volume, mute/unmute, next/previous

### Phase 3: Real-time State Sync
**Goal**: The UI can always show the current state of every zone, even when changes are made from another controller (Sonos app, voice assistant, etc.)
**Depends on**: Phase 2
**Requirements**: INFRA-03
**Success Criteria** (what must be TRUE):
  1. When a track changes on a speaker (triggered by the Sonos app), the backend detects it within 2 seconds
  2. When the backend detects a state change, it pushes an update to all connected browser clients via WebSocket
  3. UPnP subscriptions are renewed before expiry so the backend never silently loses updates
  4. A browser client that reconnects after a disconnect immediately receives the current state
**Plans**: TBD

Plans:
- [ ] 03-01: State cache + GENA/UPnP event subscriptions with auto-renewal
- [ ] 03-02: WebSocket server + broadcast on state change + client reconnect handling

### Phase 4: App Shell + PIN Auth
**Goal**: The web app is accessible in any browser, protected by a PIN, and usable on both mobile and desktop
**Depends on**: Phase 3
**Requirements**: INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. A user visiting the app for the first time sees a PIN entry screen before any content
  2. Entering the correct PIN grants access and persists the session so the user is not asked again on the same browser
  3. The app layout works correctly on a phone screen (375px wide) and a desktop browser without horizontal scrolling
  4. All interactive controls are usable by touch on mobile (tap targets meet minimum size)
**Plans**: TBD

Plans:
- [ ] 04-01: Vue 3 + Vite project scaffold + routing + PIN auth gate + session persistence
- [ ] 04-02: Responsive layout system + mobile-first CSS + design tokens

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

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Foundation | 0/2 | Not started | - |
| 2. Playback Commands | 0/1 | Not started | - |
| 3. Real-time State Sync | 0/2 | Not started | - |
| 4. App Shell + PIN Auth | 0/2 | Not started | - |
| 5. Zone Dashboard | 0/2 | Not started | - |
