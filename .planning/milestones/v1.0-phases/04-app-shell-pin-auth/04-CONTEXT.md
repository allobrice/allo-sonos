# Phase 4: App Shell + PIN Auth - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Application Vue protégée par un PIN partagé, avec un layout responsive mobile-first. Le shell fournit la coquille (header, navigation, routing, auth gate) dans laquelle les futures fonctionnalités (zone dashboard Phase 5) vivront. Les contrôles de lecture et le dashboard des zones sont hors scope.

</domain>

<decisions>
## Implementation Decisions

### Écran de saisie du PIN
- Pavé numérique visuel (grille de chiffres 0-9 style digicode), pas de champ texte
- PIN à 4 chiffres
- Affichage par dots remplis (○ → ●) pendant la saisie — pattern universel
- En cas de PIN incorrect : message d'erreur texte simple sous les dots (pas d'animation shake)
- Retry illimité — outil LAN interne, pas de risque brute force externe

### Session & déconnexion
- Session sans expiration — une fois le PIN validé, l'utilisateur reste authentifié sur ce navigateur indéfiniment
- Bouton de déconnexion discret (dans un menu ou page settings, pas proéminent)
- PIN configuré via variable d'environnement (`APP_PIN`) dans le `.env` / docker-compose
- Vérification côté serveur via endpoint `POST /api/auth/pin` — le PIN ne circule jamais en clair dans le frontend, le backend valide et retourne un token/cookie

### Structure du shell
- Header fixe : logo de l'app + titre + indicateur de statut de connexion WebSocket (connecté/déconnecté)
- Bottom navigation avec 2 onglets : Zones (vue principale) + Settings (réglages, déconnexion)
- Sur desktop (grand écran) : contenu contraint à une largeur max (~480-600px) et centré — style app mobile sur grand écran
- Mobile-first : le layout est pensé pour 375px minimum, puis s'adapte vers le haut

### Identité visuelle
- Dark mode uniquement (pas de light mode ni toggle)
- Fond sombre (noir/gris très foncé)
- Deux couleurs d'accent : vert `#87DB78` et rose `#FF3C74`
- Typographie : Inter (chargée via Google Fonts ou self-hosted)
- Coins doux : border-radius 8px
- Cartes avec légère élévation (subtle box-shadow sur fond sombre)

### Claude's Discretion
- Teintes exactes du fond sombre (noir pur vs gris très foncé)
- Usage spécifique des couleurs vert vs rose (quel accent pour quoi)
- Design de l'indicateur WebSocket dans le header
- Taille et espacement du pavé numérique
- Exact spacing et tailles typographiques
- Animation de transition entre écran PIN et app
- Structure du routing Vue (vue-router setup)
- Mécanisme exact du token (JWT, cookie httpOnly, etc.)

</decisions>

<specifics>
## Specific Ideas

- Le pavé numérique doit fonctionner comme un digicode physique — familier et intuitif au toucher
- L'indicateur WebSocket dans le header permet de voir d'un coup d'œil si l'app reçoit les mises à jour en temps réel
- La bottom nav avec Zones + Settings prépare la structure pour la Phase 5 (zone dashboard) sans navigation superflue
- Largeur max centrée sur desktop : l'app doit rester compacte et lisible, pas s'étaler sur un écran 27 pouces

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-app-shell-pin-auth*
*Context gathered: 2026-02-27*
