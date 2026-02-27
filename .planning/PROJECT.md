# Sonos Pilot

## What This Is

Une application web légère permettant de piloter le réseau Sonos d'entreprise (2-5 zones) depuis n'importe quel navigateur sur le réseau local. Backend Fastify avec découverte SSDP, commandes SOAP directes, et push WebSocket en temps réel. Frontend Vue 3 avec dashboard de zones interactif — grille responsive affichant l'état de chaque zone avec contrôles de playback directs (play/pause, skip, volume, mute).

## Core Value

Contrôler la musique de n'importe quelle zone en moins de 3 secondes, sans friction ni surcharge visuelle.

## Requirements

### Validated

- ✓ Contrôle basique par zone (play, pause, volume, mute, skip) — v1.0 (API complète, 8 endpoints REST)
- ✓ Protection par PIN partagé — v1.0 (httpOnly cookie + localStorage persistence)
- ✓ Interface épurée, mobile-first, utilisable par toute l'équipe — v1.0 (dark theme, design tokens, 44px+ touch targets)
- ✓ Synchronisation temps réel des changements d'état — v1.0 (GENA → StateCache → WebSocket < 2s)
- ✓ Découverte automatique des enceintes Sonos — v1.0 (SSDP + fallback IP manuel)
- ✓ Dashboard grille de toutes les zones avec état en temps réel — v1.1 (grille responsive 2-col/1-col, now playing, source icons)
- ✓ Contrôles de playback par zone : play/pause, skip, volume slider, mute — v1.1 (optimistic UI, debounced volume, 300ms anti-double-tap)
- ✓ Indicateur de source musicale par zone — v1.1 (inline SVG icons: Spotify, Deezer, TuneIn, Library)
- ✓ Mises à jour temps réel via WebSocket — v1.1 (snapshot load + state_changed dispatch, auto-reconnect)

### Active

(No active requirements — next milestone not yet defined)

### Out of Scope

- Gestion avancée des groupes d'enceintes — complexité inutile pour 2-5 zones
- Planification horaire (programmation de musique) — pas un besoin actuel
- Comptes utilisateurs individuels — un PIN partagé suffit
- Application mobile native — une web app responsive couvre le besoin
- Gestion de la bibliothèque musicale — on navigue dans les sources existantes
- Accès externe (hors LAN) — augmente la surface d'attaque, l'équipe est sur site
- Sonos Cloud API / OAuth — complexité inutile pour un outil LAN

## Context

Shipped v1.1 avec 3,526 LOC (TypeScript + Vue + CSS) en 5 jours (v1.0 + v1.1).
Tech stack: Fastify v5, Vue 3, Pinia, @svrooij/sonos (SSDP only), direct SOAP, @fastify/websocket.

Le backend expose 8 endpoints de playback, un pipeline WebSocket temps réel (GENA → StateCache → broadcast), et une auth par PIN. Le frontend est un SPA Vue 3 avec un dashboard de zones interactif : grille responsive montrant chaque zone avec now playing, source musicale, transport controls (play/pause, skip), volume slider et mute toggle. Toutes les interactions sont optimistes avec revert silencieux en cas d'erreur API.

## Constraints

- **Réseau**: Communication directe avec les enceintes via SOAP/UPnP sur le LAN (port 1400)
- **Simplicité**: Interface minimale — chaque écran ne montre que ce qui est nécessaire
- **Compatibilité**: Responsive mobile (375px) et desktop (max-width 540px centré)
- **Sécurité**: PIN partagé via env var SONOS_PIN, cookie httpOnly, pas d'auth lourde

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| App web plutôt que native | Accessible à tous sans installation, responsive couvre mobile + desktop | ✓ Good — SPA Vue 3 fonctionne sur tous les navigateurs |
| PIN partagé plutôt que comptes individuels | Simplicité maximale, contexte d'entreprise de confiance | ✓ Good — httpOnly cookie + localStorage flash prevention |
| Direct SOAP plutôt que @svrooij/sonos commands | Spike a révélé que l'API de commande @svrooij/sonos est cassée sur hardware réel | ✓ Good — SOAP fiable, @svrooij/sonos conservé pour SSDP uniquement |
| ESM + NodeNext TS resolution | Requis par Fastify v5, évite les deprecation warnings | ✓ Good — aucun problème de compatibilité |
| 300ms debounce per UUID dans StateCache | Évite les broadcasts excessifs lors de rafales d'événements GENA | ✓ Good — collapse les mises à jour rapides |
| GET /ws server-to-client only | Simplification — les commandes passent par REST, pas par WebSocket | ✓ Good — séparation claire des responsabilités |
| Dark theme avec design tokens CSS | Base réutilisable, cohérence visuelle, personnalisation facile | ✓ Good — tous les composants utilisent var(--color-*) |
| Map<string, ZoneState> keyed by UUID | O(1) lookup, Map ref replaced on mutation pour Pinia reactivity | ✓ Good — performant et réactif |
| Optimistic UI avec revert silencieux | Feedback instantané, pas de spinner, revert si erreur API | ✓ Good — UX fluide sans latence perçue |
| localVolume ref découpée du store | Empêche les sauts pendant le drag, WebSocket sync gated par dragging ref | ✓ Good — slider smooth sans conflits |
| Dual WebSocket instances (AppHeader + ZonesView) | Architecture simple, chaque composant gère sa connexion | — Acceptable — à revisiter si limites de connexion |

---
*Last updated: 2026-02-27 after v1.1 milestone*
