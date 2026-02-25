# Sonos Pilot

## What This Is

Une application web légère permettant de piloter le réseau Sonos d'entreprise (2-5 zones) depuis n'importe quel navigateur sur le réseau local. Conçue pour toute l'équipe, elle remplace l'usage de l'app Sonos officielle jugée trop chargée en ne gardant que l'essentiel : lecture, volume et changement de source.

## Core Value

Contrôler la musique de n'importe quelle zone en moins de 3 secondes, sans friction ni surcharge visuelle.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Contrôle basique par zone (play, pause, volume)
- [ ] Changement de source musicale (Spotify, Deezer, TuneIn)
- [ ] Vue d'ensemble de toutes les zones en un coup d'œil
- [ ] Protection par PIN partagé
- [ ] Interface épurée, mobile-first, utilisable par toute l'équipe

### Out of Scope

- Gestion avancée des groupes d'enceintes — complexité inutile pour 2-5 zones
- Planification horaire (programmation de musique) — pas un besoin actuel
- Comptes utilisateurs individuels — un PIN partagé suffit
- Application mobile native — une web app responsive couvre le besoin
- Gestion de la bibliothèque musicale — on navigue dans les sources existantes (Spotify, Deezer, TuneIn)

## Context

- Le réseau Sonos est déjà en place dans l'entreprise (2-5 zones/enceintes)
- L'app Sonos officielle est utilisée aujourd'hui mais jugée trop complexe (trop de fonctions inutilisées)
- Les sources musicales sont Spotify, Deezer et les radios web via TuneIn
- L'outil sera accessible uniquement sur le réseau local de l'entreprise
- Toute l'équipe doit pouvoir l'utiliser sans formation

## Constraints

- **Réseau**: L'app doit communiquer avec les enceintes Sonos sur le réseau local (API Sonos / UPnP/SOAP ou node-sonos)
- **Simplicité**: L'interface doit rester minimale — chaque écran ne montre que ce qui est nécessaire
- **Compatibilité**: Doit fonctionner sur mobile et desktop (responsive)
- **Sécurité**: Accès protégé par un PIN simple, pas d'authentification lourde

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| App web plutôt que native | Accessible à tous sans installation, responsive couvre mobile + desktop | — Pending |
| PIN partagé plutôt que comptes individuels | Simplicité maximale, contexte d'entreprise de confiance | — Pending |
| Sources limitées à Spotify/Deezer/TuneIn | Ce sont les services utilisés aujourd'hui | — Pending |

---
*Last updated: 2026-02-25 after initialization*
