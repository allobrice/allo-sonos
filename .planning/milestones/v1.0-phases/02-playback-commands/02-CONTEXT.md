# Phase 2: Playback Commands - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Controles de lecture complets (play/pause, volume, mute, skip) disponibles via REST API pour tout speaker decouvert. L'endpoint generique POST /speakers/:id/command du spike Phase 1 est remplace par des routes dediees. Un endpoint GET /speakers/:id/state permet de lire l'etat courant.

</domain>

<decisions>
## Implementation Decisions

### API Design (Endpoints)
- Routes dediees par action, pas d'endpoint generique
- Supprimer l'ancien POST /speakers/:id/command (spike Phase 1)
- Play et Pause sont deux endpoints separes (POST /speakers/:id/play, POST /speakers/:id/pause)
- Mute et Unmute sont deux endpoints separes (POST /speakers/:id/mute, POST /speakers/:id/unmute)
- Volume en PUT /speakers/:id/volume avec body {level: N}
- Next et Previous en POST /speakers/:id/next, POST /speakers/:id/previous
- Ajouter GET /speakers/:id/state pour lire l'etat sans commande

### Volume Control
- Volume absolu uniquement (pas de relatif +/-)
- Range natif Sonos 0-100, pas de cap cote serveur
- Validation stricte : 400 Bad Request si level manquant, non-numerique, ou hors 0-100
- Mute/unmute : comportement natif Sonos (preserve le volume automatiquement, pas de logique cote API)

### Response Format
- Chaque commande retourne {ok: true, state: {playState, volume, muted}}
- State essentiel : playState, volume, muted (pas de track info dans cette phase)
- Si la commande reussit mais la lecture du state echoue : {ok: true, state: null}
- GET /speakers/:id/state retourne {playState, volume, muted}

### Zone vs Speaker Targeting
- API cible des speakers par UUID uniquement, pas d'abstraction zone
- Le routing des commandes transport au coordinator reste transparent cote serveur
- GET /speakers retourne une liste plate (groupName et coordinatorUuid sont presents dans la reponse mais pas de groupement cote API)
- Speaker injoignable : 502 avec detail (message SOAP propage)
- Pas de codes d'erreur custom pour les cas metier (no track loaded, etc.) : le 502 generique avec le detail SOAP suffit

### Claude's Discretion
- Structure interne du code (services, helpers, organisation des fichiers)
- Implementation SOAP pour lire l'etat (GetTransportInfo, GetVolume, GetMute)
- Gestion des timeouts et retries SOAP
- Format exact des messages d'erreur dans le detail

</decisions>

<specifics>
## Specific Ideas

- L'API doit etre un remplacement complet du spike : memes capacites mais avec des routes propres
- Le state dans la reponse permet au frontend de mettre a jour l'UI immediatement sans attendre le WebSocket (Phase 3)
- GET /speakers/:id/state permet le chargement initial de l'etat au demarrage du frontend

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-playback-commands*
*Context gathered: 2026-02-27*
