# Phase 7: Favorites Backend - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

L'API backend expose les favoris Sonos (via ContentDirectory SOAP Browse FV:2) et permet de lancer un favori sur une zone. Pas d'UI — c'est la Phase 8. Pas de gestion de file d'attente ni de recherche musicale.

</domain>

<decisions>
## Implementation Decisions

### Données retournées (GET /favorites)
- Chaque favori inclut : title, type, uri, albumArtURI
- Ordre : Sonos natif (tel que l'utilisateur l'a défini dans l'app Sonos)
- Les favoris de type inconnu sont exposés avec type `'other'` (aucun favori masqué)
- Aucun favori n'est filtré — tout ce que Sonos renvoie est transmis au frontend

### Identification et lancement (POST /speakers/:id/play-favorite)
- Le frontend envoie `{ uri, type }` dans le body
- URI brute Sonos (ex: `x-sonosapi-stream:...`) — pas d'ID synthétique
- Le type accompagne l'URI pour que le backend sache comment lancer (SetAVTransportURI vs AddURIToQueue)
- Route sous `/speakers/:id/play-favorite` — cohérent avec le pattern existant (play, pause, volume, etc.)
- Réponse : `{ ok, state: { playState, volume, muted } }` — même pattern que les autres commandes

### Caching des favoris
- Cache mémoire avec TTL de 5 minutes
- Query param `?refresh=true` pour forcer le rafraîchissement (bypass du cache)
- N'importe quel speaker joignable est utilisé pour récupérer la liste (favoris partagés sur le réseau Sonos)

### Claude's Discretion
- Classification des types de favoris (mapping des métadonnées Sonos → station/playlist/album/other)
- Choix du speaker pour les appels ContentDirectory (premier dispo dans le registry)
- Structure interne du service SOAP ContentDirectory
- Gestion d'erreur détaillée (retry, fallback)

</decisions>

<specifics>
## Specific Ideas

- Le pattern `handleCommand()` existant dans speakers.ts est réutilisable pour play-favorite (lookup speaker + coordinator routing + state return)
- Les fonctions SOAP existantes (`soapAvTransport`, `soapRenderingControl`) servent de modèle pour le nouveau `soapContentDirectory`
- `fast-xml-parser` déjà en dépendance pour le parsing XML

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sonos-commands.ts` : Pattern SOAP fetch + envelope XML + extractUpnpErrorCode — à reproduire pour ContentDirectory
- `sonos-state.ts` : `fast-xml-parser` avec `removeNSPrefix` — même parser réutilisable
- `speakers.ts` : `handleCommand()` helper — réutilisable pour play-favorite (speaker lookup + coordinator + error handling + state return)
- `registry.ts` : `SpeakerRegistry.getAll()` donne accès à tous les IPs de speakers pour le Browse SOAP

### Established Patterns
- Routes Fastify avec JSON Schema validation (params, body, response)
- Routes enregistrées comme plugins async dans app.ts avec prefix `/api`
- SOAP via fetch() brut (pas de bibliothèque SOAP)
- Erreurs : 404 (speaker not found), 502 (command failed) avec detail

### Integration Points
- Nouvelles routes à enregistrer dans `app.ts` via `fastify.register()`
- Accès au registry via `fastify.speakers` (décoration Fastify)
- Le cache favoris sera un nouveau service (comme state-cache.ts)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-favorites-backend*
*Context gathered: 2026-03-02*
