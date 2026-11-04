# Appli mobile : le Classement, podium et sa place en bas (conception, 04/11/2026, Jules)

**Appli seulement** (`body.app`). Audit : pas de mise en valeur du haut du classement ; sa place n'apparaît qu'après les 50
premiers (« … »). L'étape 1 a déjà mis une ligne par joueur et les filtres sur une rangée.

## Ce que Jules a choisi (maquettes du 04/11)
**A** : un **podium** pour le top 3 (marches or, argent, bronze ; 2ᵉ à gauche, 1ᵉʳ au centre, 3ᵉ à droite), la suite en
lignes, et **sa place collée en bas de l'écran** (toujours visible en défilant, même hors du top 50). Écartée : B (liste simple).

## Détails
- Chaque marche : un mineur (apparence de base : le serveur n'envoie pas le stuff des joueurs classés ; choix de Claude, à
  enrichir plus tard), le pseudo, la valeur du classement (« 5 410 GS », « Niv. 72 · … », un temps…), le rang.
- Les lignes à partir du 4ᵉ : celles d'aujourd'hui (« ⋮ » pour signaler / bloquer, détails des tours et du roi gobelin).
- Sa place : sa ligne, mise en couleur, collée au-dessus de la barre de l'appli ; si on est dans le top 3, elle reste aussi
  en bas (rappel). « N joueurs classés » sous la liste.
- Moins de 3 joueurs classés : les marches manquantes restent vides.

## Construit comme
`src/ui/leaderboard.js` : `podiumHtml(top, value)` et `boardAppHtml(board, { value, row })` (purs, testés) ; `renderBoard`
les utilise dans l'appli. Style : `src/app/app.css`.
