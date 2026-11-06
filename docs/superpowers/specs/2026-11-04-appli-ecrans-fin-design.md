# Appli mobile : les écrans qui restaient (conception, 04/11/2026, Jules)

**Appli seulement** (`body.app`) : le site ne change pas. Dernier morceau de l'étape 2 (audit :
`2026-11-03-appli-ux-audit.md`). Après : mise en ligne, appli iPhone fabriquée, essai de Jules sur son téléphone.

## Ce que Jules a choisi (maquettes du 04/11)

| Écran | Choix | Écarté |
|---|---|---|
| Inventaire | **A** : bouton « Déplacer » dans le détail, puis toucher la case d'arrivée | B : « Trier » seulement |
| Four | **B** : un onglet par four (Four 1 · 2 · 3, 🔥 s'il chauffe, 🔒 s'il est fermé), le four choisi en grand | A : les 3 fours empilés en petit |
| Concasseur | cases plus petites (52 px) ; « Dernières trouvailles » dans le panneau « Butin » | — |
| Recherche | 4 boutons de tier au lieu de la liste ; toucher un tier fermé dit ce qu'il manque (une ligne) | — |
| Amélioration | **B** : les pièces en grille d'icônes (cadre = rareté, petit carré = équipée) ; le nom et les stats de la pièce choisie en haut | A : une ligne par pièce |
| Amis | **A** : une ligne par ami, le bouton utile du moment (Rejoindre s'il a un groupe ouvert, sinon Inviter) et « ⋮ » qui ouvre sa fiche (Rejoindre, Inviter, Voir son stuff, Signaler / bloquer, Retirer en rouge) | B : rien sur la ligne |

Craft et Chat ne changent pas (déjà corrects). La pastille du guide laisse déjà la place en bas des pages.

## Détails

- **Déplacer** : même demande au serveur que le glisser-déposer du PC (`onMove`, une case pleine échange sa place). Pendant le
  choix, un bandeau « Touche la case où le poser · Annuler » ; toucher la case de départ ou « Annuler » arrête sans rien envoyer.
- **Four** : onglet ouvert au départ : le premier four ; retenu tant que l'appli est ouverte. Un onglet fermé montre le texte
  d'aujourd'hui (« À débloquer avec un Four en fer… »). « Recettes » et « Tout retirer » du four restent dans sa carte.
- **Amélioration** : les petits mots de la liste d'aujourd'hui deviennent des marques sur la tuile : « posée » = cadre
  orange, « max » = MAX, rune déjà posée = ✨, « à identifier » = ?, « jusqu'à R5 » = R5, rune trop rare = tuile grisée.
  Le détail complet reste en bulle et dans la case du haut.
- **Amis** : sans changement des règles (mêmes boutons, mêmes confirmations, le serveur revérifie tout). L'onglet « En
  ligne » garde ses lignes (« Ajouter », « ⋮ » = signaler), déjà sur une ligne.

## Construit comme

Fonctions pures testées (`tests/app-ecrans.test.js`) : `moveOp` et `infoHtml(…, moveFrom)` (inventory.js),
`furnTabsHtml` (furnace.js), `tierChipsHtml`, `tierWhyHtml` (research.js), `pieceTileHtml` (upgrade.js),
`friendRowAppHtml`, `friendSheetHtml` (social.js). Rendu appli dans chaque module derrière `body.app` ; style dans
`src/app/app.css` ; nouveau panneau `#frSheet` dans `PANELS` (`src/app/device.js`).

## Ce qui serait un échec

Un changement visible sur le site PC ; une action qui part sans que le joueur l'ait demandée (déplacer, retirer un ami) ;
Four, Concasseur ou Recherche qui défilent encore à 393 × 760 (hors note de session).
