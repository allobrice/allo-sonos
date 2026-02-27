# Phase 5: Zone Display - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Grille de cartes montrant toutes les zones Sonos découvertes avec état en temps réel. Chaque carte affiche le nom de la zone, le morceau en cours (titre + artiste), la source musicale active, et un indicateur offline si l'enceinte est injoignable. L'état se charge via WebSocket snapshot au démarrage et se met à jour en temps réel via events. Les contrôles de lecture (play/pause, skip, volume) appartiennent à la Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Apparence des cartes
- Carte avec ombre légère, coins arrondis, fond légèrement plus clair que le background
- Taille moyenne (~120px de haut) — bon équilibre lisibilité/densité
- Nom de zone visuellement dominant (hiérarchie principale)
- Accent de couleur (bordure ou barre latérale) sur les cartes avec lecture active — distinction visuelle entre zones actives et silencieuses

### Affichage Now Playing
- Quand rien ne joue : icône + texte discret (ex: icône note barrée + « Aucune lecture »)
- Titre en bold sur une ligne, artiste en dessous plus léger — deux lignes séparées
- Troncature avec `…` si le titre ou l'artiste est trop long (pas de défilement marquee)
- Petite icône play/pause discrète à côté du titre ou du nom de zone pour indiquer l'état de lecture

### Indicateur de source musicale
- Icône seule (pas de texte) — Spotify, Deezer, TuneIn, Library
- Positionnée en haut à droite de la carte
- Style monochrome (blanc/gris) — cohérent avec le dark theme, pas de couleurs de marque
- Icône générique (note de musique) si la source n'est pas identifiée

### État offline
- Carte grisée (opacité réduite) + badge « Offline »
- Position fixe dans la grille — pas de réordonnancement quand une zone passe offline
- Contenu vide : juste le nom de zone + badge offline, pas d'info now playing
- Transition douce (fade-in de l'opacité) quand une zone revient en ligne

### Claude's Discretion
- Design exact du loading skeleton
- Espacement et typographie précis
- Gestion des erreurs WebSocket (UI)
- Animation exacte de l'accent de couleur sur les cartes actives
- Choix de l'icône pour l'état idle (note barrée ou autre)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-zone-display*
*Context gathered: 2026-02-27*
