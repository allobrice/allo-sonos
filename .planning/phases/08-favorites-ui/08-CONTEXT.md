# Phase 8: Favorites UI - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

L'utilisateur peut parcourir et lancer un favori directement depuis la ZoneCard. Un bouton sur chaque ZoneCard ouvre un bottom sheet listant tous les favoris Sonos. Taper un favori lance la lecture sur cette zone et ferme le panneau. La gestion de favoris (ajout/suppression) et la recherche musicale sont hors scope.

</domain>

<decisions>
## Implementation Decisions

### Style du panneau
- Bottom sheet glissant depuis le bas de l'ecran, ~50% viewport height
- Backdrop sombre semi-transparent derriere le sheet (clic sur backdrop = fermeture)
- Animation slide-up ~250ms ease-out a l'ouverture, slide-down a la fermeture
- Le sheet a un header affichant "Favoris — {nom de la zone}" pour confirmer la zone ciblee

### Affichage des favoris
- Chaque favori affiche une icone SVG selon le type (station radio, playlist, album) + le titre
- Pas de pochette album (albumArtURI ignore)
- Liste plate sans groupement par type — tous les favoris dans l'ordre de l'API
- Tap sur un favori = fermeture immediate du sheet (pas de feedback visuel intermediaire)
- La ZoneCard se met a jour via WebSocket quand la lecture demarre

### Bouton declencheur
- Icone coeur dans le header de la ZoneCard, coin haut-droit
- Couleur accent pink (--color-accent-pink, #FF3C74)
- Cache sur les zones offline (coherent avec les controles transport deja caches)
- Le meme bouton ou un controle explicite du sheet permet de fermer le panneau

### Chargement et erreurs
- Skeleton shimmer (3-4 lignes animees pulse) pendant le chargement initial
- Cache frontend : fetch une fois, reutiliser ensuite (le backend a deja un cache 5 min)
- Erreur API (502) : message "Impossible de charger les favoris" + bouton "Reessayer"
- Liste vide : message "Aucun favori Sonos" simple et sobre

### Claude's Discretion
- Taille exacte des icones de type dans la liste
- Espacement et typographie internes du sheet
- Gestion du scroll si la liste depasse la hauteur du sheet
- Animation exacte de fermeture
- Position exacte du bouton coeur par rapport a l'icone source existante dans le header

</decisions>

<specifics>
## Specific Ideas

- Le coeur en pink (#FF3C74) cree une association naturelle coeur/rose et utilise la couleur d'accent secondaire de l'app
- Le skeleton shimmer est coherent avec le pattern de loading deja utilise dans ZonesView pour les zones
- Fermeture immediate au tap = confiance dans le systeme, reactivite maximale — pas d'attente API

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ZoneCard.vue` : composant card existant avec header (zone-name + source-icon), body, transport-controls, volume-row. Le bouton coeur s'integre dans zone-header, le bottom sheet est un nouveau composant
- `useZonesStore` (Pinia) : store zones avec pattern optimistic update + revert. Le play-favorite suivra le meme pattern
- `useWebSocket` composable : sync temps reel — le state_changed mettra a jour la card apres play-favorite
- CSS variables completes dans `main.css` : --color-accent-pink, --color-surface, --color-border, --shadow-card, --radius-md, etc.
- Pattern d'icones SVG inline dans les templates (source icons, transport icons, speaker icon)

### Established Patterns
- Composition API `<script setup lang="ts">` partout
- Pinia stores en composition style avec `defineStore`
- API calls via `fetch('/api/...')` avec `credentials: 'include'`
- `withDebounce` pour les actions rapides (boutons transport)
- Scoped styles CSS avec variables custom
- Skeleton pulse animation pour les etats de chargement

### Integration Points
- Backend `GET /api/favorites` : retourne `{ title, type, uri, albumArtURI }[]` (cache 5 min)
- Backend `POST /api/speakers/:id/play-favorite` : body `{ uri, type }` — lance la lecture
- `ZoneCard` recoit `zone: ZoneState` avec `uuid` et `name` — necessaires pour le header du sheet et l'appel API
- Le source-icon est en `position: absolute; top; right` dans le header — le bouton coeur devra cohabiter

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-favorites-ui*
*Context gathered: 2026-03-03*
