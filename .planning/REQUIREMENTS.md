# Requirements: Sonos Pilot

**Defined:** 2026-02-25
**Core Value:** Contrôler la musique de n'importe quelle zone en moins de 3 secondes, sans friction ni surcharge visuelle.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Playback

- [x] **PLAY-01**: User can play/pause the current track on any zone
- [x] **PLAY-02**: User can adjust volume per zone via a slider
- [x] **PLAY-03**: User can mute/unmute any zone
- [x] **PLAY-04**: User can skip to next/previous track on any zone

### Zones

- [ ] **ZONE-01**: User can see all zones on a single screen with their current state (playing/paused/idle)
- [ ] **ZONE-02**: User can see the now playing info (title + artist) per zone

### Sources

- [ ] **SRC-01**: User can see which music source is active per zone (Spotify, Deezer, TuneIn)

### Infrastructure

- [ ] **INFRA-01**: User must enter a shared PIN to access the app
- [ ] **INFRA-02**: Interface is responsive and usable on both mobile and desktop
- [x] **INFRA-03**: UI updates in real-time when state changes from another controller (Sonos app, voice, etc.)
- [x] **INFRA-04**: Backend automatically discovers Sonos speakers on the local network

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Sources

- **SRC-02**: User can switch source via Sonos Favorites (launch a preset playlist/radio station in one tap)

### Zones

- **ZONE-03**: User can see album art per zone
- **ZONE-04**: User can group/ungroup zones to play the same music everywhere

### Playback

- **PLAY-05**: User can see a playback progress bar per zone
- **PLAY-06**: User can use keyboard shortcuts (Space = play/pause, arrows = volume)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Music library browsing (search, playlists, albums) | Enormous scope; Spotify/Deezer apps do this better |
| Individual user accounts | PIN partagé suffit pour un outil interne de confiance |
| Scheduling / alarms / timers | Pas de besoin identifié |
| Native mobile app (iOS/Android) | Web app responsive couvre le besoin |
| Equalizer / audio settings | Rarement touché, rester dans l'app Sonos officielle |
| External access (beyond LAN) | Augmente la surface d'attaque, l'équipe est sur site |
| Sonos Cloud API / OAuth | Complexité inutile pour un outil LAN |
| Advanced group management (stereo pairs, surrounds) | Setup unique fait par admin dans l'app Sonos |
| Voice control integration | Sonos a déjà Alexa/Google, pas de valeur ajoutée |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-04 | Phase 1 | Complete |
| PLAY-01 | Phase 2 | Complete |
| PLAY-02 | Phase 2 | Complete |
| PLAY-03 | Phase 2 | Complete |
| PLAY-04 | Phase 2 | Complete |
| INFRA-03 | Phase 3 | Complete |
| INFRA-01 | Phase 4 | Pending |
| INFRA-02 | Phase 4 | Pending |
| ZONE-01 | Phase 5 | Pending |
| ZONE-02 | Phase 5 | Pending |
| SRC-01 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation — all 11 requirements mapped*
