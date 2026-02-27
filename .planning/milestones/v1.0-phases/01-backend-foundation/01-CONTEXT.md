# Phase 1: Backend Foundation - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend Node.js (Fastify) qui communique avec les enceintes Sonos sur le réseau local. Discovery SSDP + fallback IP manuel, commandes basiques (play/pause/volume/mute), identification des coordinateurs de zone. Pas d'UI dans cette phase — seulement l'API backend et le Dockerfile.

</domain>

<decisions>
## Implementation Decisions

### Environnement cible
- Déploiement via Docker (docker-compose) sur Linux
- Machine cible pas encore définie — le setup doit être portable et fonctionner sur n'importe quel hôte Linux avec Docker
- Auto-restart activé (restart: always dans docker-compose) — le service doit revenir automatiquement après un crash ou un reboot
- Le container doit être sur le même réseau que les enceintes Sonos (host network mode probable pour SSDP multicast)

### Configuration
- Toute la configuration dans docker-compose.yml (section environment) — un seul fichier à éditer
- PIN : 4 chiffres, défini comme variable d'environnement (ex: SONOS_PIN=1234)
- IPs manuelles des speakers en variable d'env (ex: SONOS_SPEAKER_IPS=192.168.1.10,192.168.1.11) — fallback si SSDP échoue
- Port exposé : 3000
- Logs informatifs : erreurs + actions importantes (enceinte découverte, commande envoyée, connexion perdue, etc.) — silencieux sur le trafic de routine

### Claude's Discretion
- Choix de la librairie Sonos (node-sonos vs alternatives) — décider après le spike de validation
- Architecture interne du backend (structure des dossiers, patterns)
- Stratégie de discovery (SSDP d'abord, fallback IP ensuite, ou l'inverse)
- Format des réponses API REST (structure JSON)
- Gestion des erreurs réseau (retry, timeout, fallback)

</decisions>

<specifics>
## Specific Ideas

- Docker doit utiliser `network_mode: host` ou équivalent pour que SSDP multicast fonctionne
- Le spike node-sonos est critique — tester sur matériel réel avant de construire quoi que ce soit dessus
- Si node-sonos est cassé avec le firmware actuel, pivoter vers node-sonos-http-api ou la Sonos Local Control API

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-backend-foundation*
*Context gathered: 2026-02-25*
