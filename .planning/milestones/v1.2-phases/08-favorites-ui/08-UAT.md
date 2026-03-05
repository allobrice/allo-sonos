---
status: diagnosed
phase: 08-favorites-ui
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md
started: 2026-03-03T10:00:00Z
updated: 2026-03-04T10:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Bouton coeur visible sur les zones en ligne
expected: Chaque carte de zone en ligne affiche un bouton coeur rose dans le header, positionne a gauche de l'icone source.
result: pass

### 2. Bouton coeur masque sur les zones hors ligne
expected: Les cartes de zone hors ligne n'affichent PAS le bouton coeur.
result: pass

### 3. Ouverture du panneau favoris
expected: Appuyer sur le coeur ouvre un bottom-sheet avec une animation slide-up, affichant le header "Favoris — {nom de la zone}".
result: pass

### 4. Etat de chargement skeleton
expected: Un shimmer skeleton (4 lignes avec animation pulse) apparait brievement avant que les favoris ne se chargent.
result: pass

### 5. Liste des favoris avec icones de type
expected: Chaque favori affiche une icone de type (radio/playlist/album) et son titre.
result: pass

### 6. Jouer un favori
expected: Appuyer sur un favori ferme le sheet immediatement. La zone commence a jouer ce contenu (mise a jour via WebSocket).
result: issue
reported: "le sheet se ferme au clic sur un favori mais le contenu n'est pas joué, la musique en cours continue."
severity: major

### 7. Favoris en cache au re-ouverture
expected: Rouvrir le sheet affiche les favoris instantanement (pas de skeleton), grace au cache frontend.
result: pass

### 8. Fermeture via backdrop
expected: Appuyer sur le fond sombre ferme le sheet sans jouer quoi que ce soit.
result: pass

### 9. Fermeture via bouton X
expected: Appuyer sur le bouton X ferme le sheet sans jouer quoi que ce soit.
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Appuyer sur un favori ferme le sheet et la zone commence a jouer ce contenu"
  status: failed
  reason: "User reported: le sheet se ferme au clic sur un favori mais le contenu n'est pas joué, la musique en cours continue."
  severity: major
  test: 6
  root_cause: "backend dist/ directory is stale (Mar 2) and predates favorites feature (Mar 3). dist/app.js missing favorites import/registration, dist/routes/favorites.js and dist/services/sonos-favorites.js do not exist. API returns 404 silently swallowed by frontend catch block."
  artifacts:
    - path: "backend/dist/app.js"
      issue: "Stale build - missing favorites import and route registration"
    - path: "frontend/src/stores/favorites.ts"
      issue: "Lines 51-53: bare catch {} silently swallows 404 errors"
  missing:
    - "Rebuild backend dist (npm run build) to include favorites routes"
    - "Add minimal error feedback in playFavorite catch block"
  debug_session: ".planning/debug/favorite-not-playing.md"
