---
status: testing
phase: 08-favorites-ui
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md
started: 2026-03-03T10:00:00Z
updated: 2026-03-03T10:00:00Z
---

## Current Test

number: 1
name: Bouton coeur visible sur les zones en ligne
expected: |
  Chaque carte de zone en ligne affiche un bouton coeur rose dans le header, positionne a gauche de l'icone source.
awaiting: user response

## Tests

### 1. Bouton coeur visible sur les zones en ligne
expected: Chaque carte de zone en ligne affiche un bouton coeur rose dans le header, positionne a gauche de l'icone source.
result: [pending]

### 2. Bouton coeur masque sur les zones hors ligne
expected: Les cartes de zone hors ligne n'affichent PAS le bouton coeur.
result: [pending]

### 3. Ouverture du panneau favoris
expected: Appuyer sur le coeur ouvre un bottom-sheet avec une animation slide-up, affichant le header "Favoris — {nom de la zone}".
result: [pending]

### 4. Etat de chargement skeleton
expected: Un shimmer skeleton (4 lignes avec animation pulse) apparait brievement avant que les favoris ne se chargent.
result: [pending]

### 5. Liste des favoris avec icones de type
expected: Chaque favori affiche une icone de type (radio/playlist/album) et son titre.
result: [pending]

### 6. Jouer un favori
expected: Appuyer sur un favori ferme le sheet immediatement. La zone commence a jouer ce contenu (mise a jour via WebSocket).
result: [pending]

### 7. Favoris en cache au re-ouverture
expected: Rouvrir le sheet affiche les favoris instantanement (pas de skeleton), grace au cache frontend.
result: [pending]

### 8. Fermeture via backdrop
expected: Appuyer sur le fond sombre ferme le sheet sans jouer quoi que ce soit.
result: [pending]

### 9. Fermeture via bouton X
expected: Appuyer sur le bouton X ferme le sheet sans jouer quoi que ce soit.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0

## Gaps

[none yet]
