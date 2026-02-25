# Project Research Summary

**Project:** Sonos Pilot
**Domain:** Sonos controller web application (local network, enterprise)
**Researched:** 2026-02-25
**Confidence:** MEDIUM

## Executive Summary

Sonos Pilot est une application web légère qui contrôle un réseau Sonos d'entreprise (2-5 zones) via le réseau local. L'architecture standard pour ce type d'outil est un **backend Node.js** qui communique avec les enceintes Sonos via le protocole **UPnP/SOAP** (port 1400) ou la **Sonos Local Control API** (port 1443), exposant une **API REST JSON + WebSocket** au navigateur. Le navigateur ne peut pas communiquer directement avec les enceintes (CORS), donc le backend proxy est obligatoire.

L'approche recommandée est de commencer par valider la communication avec les enceintes Sonos (discovery + commandes basiques), puis d'ajouter la mise à jour en temps réel (WebSocket), et enfin l'interface utilisateur avec les sources musicales. Le changement de source musicale (Spotify, Deezer, TuneIn) doit passer par les **Sonos Favorites** — des playlists/stations déjà configurées dans le système Sonos — ce qui évite toute complexité OAuth.

Le risque principal est la **compatibilité de la librairie node-sonos** avec le firmware Sonos actuel. Cette librairie n'est plus activement maintenue depuis ~2022. Un test précoce sur le matériel réel est critique. En fallback, `node-sonos-http-api` ou des appels HTTP directs à la Sonos Local Control API sont viables.

## Key Findings

### Recommended Stack

Le stack recommandé est **Fastify + Vue.js** avec la librairie `sonos` (node-sonos) pour l'intégration UPnP. Pas besoin de base de données — l'état est éphémère (vient des enceintes). Voir `STACK.md` pour les détails.

**Core technologies:**
- **Node.js 20 LTS + Fastify**: Backend léger, rapide, adapté à l'I/O événementiel nécessaire pour les subscriptions UPnP
- **sonos (node-sonos)**: Abstraction UPnP/SOAP la plus établie pour Node.js — **à vérifier contre le firmware actuel**
- **Vue.js 3 + Vite**: Frontend léger et réactif, idéal pour une petite SPA avec 3-5 vues
- **ws**: WebSocket natif, sans overhead de Socket.IO

### Expected Features

Voir `FEATURES.md` pour le détail complet.

**Must have (table stakes):**
- Play / Pause / Volume / Mute par zone
- Liste des zones avec état actuel
- Now Playing (titre, artiste, pochette)
- Changement de source via Sonos Favorites
- Synchronisation temps réel (état mis à jour quand un autre contrôleur change quelque chose)
- PIN partagé pour protéger l'accès
- Interface responsive (mobile + desktop)

**Should have (low effort, high value):**
- Skip track (suivant/précédent)
- Pochette d'album par zone
- Raccourcis clavier (Space = play/pause, flèches = volume)

**Defer (v2+):**
- Groupement de zones — complexe avec des edge cases, inutile pour 2-5 zones
- Barre de progression de lecture
- Gestion des Favorites (édition/réordonnancement)

### Architecture Approach

Architecture **client-serveur à 3 niveaux** : Browser SPA ↔ Backend Node.js (proxy + état) ↔ Enceintes Sonos (UPnP/SOAP). Le backend maintient un cache d'état en mémoire, souscrit aux événements UPnP GENA pour les mises à jour temps réel, et les diffuse aux navigateurs via WebSocket. Voir `ARCHITECTURE.md` pour les diagrammes de flux.

**Major components:**
1. **UPnP Discovery Service** — trouve les enceintes sur le LAN via SSDP multicast
2. **Speaker Command Layer** — traduit les commandes JSON en SOAP XML (AVTransport, RenderingControl)
3. **State Cache + Event Subscriber** — maintient l'état courant de chaque zone, reçoit les push des enceintes
4. **REST API + WebSocket Server** — expose JSON au navigateur, push les changements d'état
5. **Vue SPA** — interface épurée, une carte par zone, optimistic UI

### Critical Pitfalls

Voir `PITFALLS.md` pour le détail complet.

1. **node-sonos potentiellement cassé avec le firmware actuel** — Tester sur matériel réel dès le jour 1. Avoir un plan B (node-sonos-http-api ou HTTP direct)
2. **SSDP discovery échoue sur réseaux corporate** — Le multicast est souvent bloqué. Prévoir une saisie manuelle d'IP en fallback
3. **Commandes envoyées au mauvais speaker** — Dans un groupe, seul le coordinateur accepte les commandes. Toujours résoudre le coordinateur via ZoneGroupTopology
4. **Subscriptions UPnP expirent après 30 min** — Implémenter le renouvellement automatique, sinon l'UI se fige sur un état périmé
5. **URIs musicales opaques** — Utiliser les Sonos Favorites (URIs pré-formatées) plutôt que construire des URIs Spotify/Deezer manuellement

## Implications for Roadmap

### Phase 1: Backend Foundation + Discovery
**Rationale:** Rien ne fonctionne sans le backend. La communication avec les enceintes est la brique de base.
**Delivers:** Backend Fastify, discovery SSDP + fallback IP manuel, commandes basiques (play/pause/volume/mute), speaker registry
**Addresses:** Zone listing, Play/Pause/Volume/Mute
**Avoids:** Pitfall 1 (valide node-sonos dès le départ), Pitfall 2 (SSDP fallback), Pitfall 3 (coordinator resolution)

### Phase 2: Real-time State + WebSocket
**Rationale:** Sans mise à jour temps réel, l'UI affiche un état périmé — l'expérience est cassée.
**Delivers:** Subscription GENA ou polling, state cache, WebSocket server, now playing metadata
**Uses:** UPnP event subscriber, ws library
**Avoids:** Pitfall 4 (subscription renewal)

### Phase 3: Frontend SPA + PIN Auth
**Rationale:** Le backend est stable, on peut construire l'interface dessus.
**Delivers:** Vue SPA, zone cards, transport controls, volume sliders, PIN login, responsive layout
**Implements:** Browser SPA, optimistic UI pattern

### Phase 4: Source Switching + Favorites
**Rationale:** Fonctionnalité qui complète le produit — passe de "contrôleur basique" à "remplacement de l'app Sonos".
**Delivers:** Browse Sonos Favorites, lancer une source (Spotify/Deezer/TuneIn) en un tap, album art
**Avoids:** Pitfall 5 (utilise Favorites au lieu de construire des URIs)

### Phase 5: Polish + Robustesse
**Rationale:** Fiabiliser pour un usage quotidien en entreprise.
**Delivers:** WebSocket auto-reconnect, gestion d'erreurs gracieuse, debounce volume, skip track, raccourcis clavier

### Phase Ordering Rationale

- Backend avant frontend : le navigateur ne peut rien faire sans le proxy
- État temps réel avant UI : construire l'UI sur des données fraîches, pas du polling naïf
- Source switching en dernier : fonctionne via Favorites, ne bloque pas l'usage basique
- Polish en dernier : consolide tout ce qui fonctionne déjà

### Research Flags

Phases nécessitant une recherche approfondie pendant la planification :
- **Phase 1:** Spike de validation node-sonos vs firmware actuel. Décision critique avant de continuer.
- **Phase 4:** Format exact des URIs Sonos Favorites pour chaque service (Spotify, Deezer, TuneIn)

Phases avec patterns standards (pas besoin de recherche) :
- **Phase 3:** Vue SPA + PIN auth — patterns web classiques, bien documentés
- **Phase 5:** Reconnection WebSocket, debounce — patterns standards

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Choix solides mais versions à vérifier (surtout node-sonos) |
| Features | MEDIUM-HIGH | Table stakes bien définis, alignés avec PROJECT.md |
| Architecture | MEDIUM-HIGH | Pattern backend proxy bien établi dans l'écosystème Sonos |
| Pitfalls | MEDIUM | Pièges connus de la communauté, mais firmware actuel non vérifié |

**Overall confidence:** MEDIUM

### Gaps to Address

- **node-sonos maintenance status** : Vérifier dernière version, issues ouvertes, compatibilité firmware 2025/2026. Spike Phase 1 Day 1.
- **Sonos Local Control API coverage** : Est-ce que l'API REST (port 1443) couvre tous les besoins ? Si oui, elle est préférable à UPnP/SOAP.
- **Réseau corporate cible** : Tester SSDP multicast sur le réseau réel de l'entreprise avant de compter dessus.
- **Sonos Favorites format** : Capturer des exemples de Favorites existants pour comprendre le format URI attendu.

## Sources

### Primary (HIGH confidence)
- UPnP Device Architecture specification — GENA subscription lifecycle, SSDP discovery
- Fastify documentation (https://fastify.dev)
- Vue.js documentation (https://vuejs.org)

### Secondary (MEDIUM confidence)
- node-sonos GitHub (https://github.com/bencevans/node-sonos) — UPnP abstraction patterns
- node-sonos-http-api (https://github.com/jishi/node-sonos-http-api) — reference implementation
- Sonos Developer Portal (https://developer.sonos.com) — API surface documentation
- Home Assistant Sonos integration — known quirks and workarounds

### Tertiary (LOW confidence)
- Sonos S2 Local Control API details — port numbers, endpoint paths need live verification
- Deezer API rate limits — limited documentation available

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
