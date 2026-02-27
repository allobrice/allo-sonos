# Phase 3: Real-time State Sync - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Pipeline de synchronisation temps réel de l'état des zones Sonos. Le backend détecte les changements d'état via GENA/UPnP, maintient un cache, et pousse les updates aux navigateurs connectés via WebSocket. Ce n'est PAS l'UI — c'est la plomberie qui alimente le dashboard (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Données d'état par zone
- Play/pause, volume, mute status
- Piste en cours : titre + artiste + album
- Source active : Spotify, Deezer, TuneIn (couvre SRC-01 dès cette phase)
- PAS d'album art URL (v2, ZONE-03)
- PAS de groupement de zones (v2, ZONE-04)

### Comportement en cas de perte
- Speaker offline : marqué `unreachable` dans le cache, dernier état conservé
- Événements WebSocket bidirectionnels : `speaker_online` et `speaker_offline`
- Le dashboard peut griser les speakers offline tout en montrant leur dernier état connu
- Quand un speaker revient en ligne : événement `speaker_online` explicite pour permettre un toast/indicateur côté frontend

### Granularité des updates WebSocket
- Debounce uniforme (~300ms) sur tous les types d'événements (volume, transport, piste)
- Format : un seul type d'événement `state_changed` avec l'état complet de la zone
- Pas d'événements granulaires (pas de volume_changed, track_changed séparés)
- Un changement = remplacement complet de l'état de la zone côté frontend

### Reconnexion
- Reconnexion WebSocket automatique côté client avec backoff exponentiel (1s, 2s, 4s...)
- Indicateur subtil de déconnexion (pastille colorée, non intrusif)
- Dimensionné pour 5-20 clients WebSocket simultanés (outil interne LAN)

### Claude's Discretion
- Stratégie de repli quand GENA échoue (polling de secours vs retry avec backoff)
- Snapshot initiale à la connexion WebSocket (full state push vs REST séparé)
- Contenu du snapshot à la reconnexion (état complet vs delta)

</decisions>

<specifics>
## Specific Ideas

- La philosophie du projet est "contrôler la musique en moins de 3 secondes, sans friction ni surcharge visuelle" — l'indicateur de déconnexion doit être subtil (pastille), pas une bannière intrusive
- Les success criteria exigent détection < 2 secondes pour les changements d'état

</specifics>

<deferred>
## Deferred Ideas

- Album art URL dans l'état synchronisé — v2, ZONE-03
- Groupement de zones dans la synchronisation — v2, ZONE-04

</deferred>

---

*Phase: 03-real-time-state-sync*
*Context gathered: 2026-02-27*
