# Appli : écrans qui restaient — plan

**Spec :** `docs/superpowers/specs/2026-11-04-appli-ecrans-fin-design.md` · exécution inline, un commit par écran, branche
`jules/appli-ecrans-fin`. Tests : `node --test tests/app-ecrans.test.js` (+ les tests du module touché).

## Contraintes
Appli seulement (`body.app` ou fonction appelée seulement dans l'appli) ; mêmes demandes au serveur qu'aujourd'hui ;
pas de nouvelle règle de jeu.

## Tâches
1. **Inventaire** — `moveOp(inv, from, to)` → `{ from, to, item, uid? }` ou `null` (même case, case de départ vide) ;
   `infoHtml(s, pinned, inv, worn, furn, moveFrom)` exporté, bouton `.invMove` quand `moveFrom` est un nombre. Mode
   déplacement dans `renderInventory` (bandeau `#invMoveBar`, grille `.moving`). Tests : moveOp (3 cas), bouton présent / absent.
2. **Four** — `furnTabsHtml(list, max, sel)` : un bouton `data-ftab` par four, `on` sur le choisi, 🔥 si `since !== null`,
   `locked` + 🔒 si absent. Rendu appli : onglets puis la seule carte choisie. Tests : 3 boutons, 🔥, 🔒, on.
3. **Concasseur** — appli : pas de carte « Dernières trouvailles » dans la page, elle passe en tête du panneau « Butin » ;
   cases 52 px (CSS). Vérifié à l'écran.
4. **Recherche** — `tierChipsHtml(inv, tier)` (boutons `data-rtier`, `locked` si fermé) et `tierWhyHtml(inv, t)` (la phrase
   « 🔒 Tier n : apprends encore… »). Rendu appli : chips au lieu du `<select>`, une seule phrase (tier fermé touché).
5. **Amélioration** — `pieceTileHtml(p, { worn, tag, sel, dim })` : bouton `upPick upTile` `data-uid`, `.upEq` si portée,
   `.upTag` si tag, `sel`, `dim`. Rendu appli : grille `.upTiles` ; stats de la pièce posée sous son nom (`.upStat`, caché sur
   le site).
6. **Amis** — `friendRowAppHtml(f)` (bouton `data-join` si `canJoin`, sinon `data-invite` grisé si `!canInvite` ;
   « ⋮ » `data-fsheet`) et `friendSheetHtml(f)` (data-join, data-invite, data-profile, data-mod + data-name, data-remove +
   data-name). `#frSheet` ; un toucher dans la fiche la ferme puis passe par le même traitement que la liste.
7. **Fin** — CSS, aperçu 393 × 760 de chaque écran, site PC 1280 × 800, journal / debug / état du projet.

## Points à surveiller
Déplacer vers la même case ; une action dans la fiche d'un ami alors que la liste a changé (le serveur revérifie) ;
Four sans aucun four (liste vide) ; Recherche quand tous les tiers sont ouverts (pas de phrase).
