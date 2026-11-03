# Appli mobile : les Sets en menu et le Stuff en mannequin (conception, 03/11/2026, Jules)

Étape 2, deuxième morceau, de l'interface téléphone (audit : `2026-11-03-appli-ux-audit.md`). **Appli seulement** : tout
est derrière `body.app`, le site ne change pas.

## Pourquoi

Notes de Jules (02/11) : « la page stuff est pas ouf : la partie preset / enregistrement de stuff prend la moitié de
l'écran, tout est en colonne, faut scroll 4 h pour voir tout son stuff » ; même reproche pour les sets dans Skills et Sorts.
Audit : Stuff ≈ 3,7 écrans ; avec 3 sets, le bloc Sets prend tout le premier écran (4 boutons par set) et répète
« Session en cours ».

## Ce que Jules a choisi (maquettes du 03/11)

- **Sets** : une seule ligne « Set : barb ▾ » ; le menu s'ouvre du bas (« niquel »).
- **Stuff** : la version **C, mannequin en grand** : le mineur au centre, les 13 cases autour, et les stats dans un
  onglet « Stats » à part (écartées : A, mannequin avec 6 stats dessous ; B, grille 4 × 4).

## Ce que voit le joueur

### La ligne des Sets (Stuff, Skills, Sorts, et le Lobby derrière « Changer ▸ »)

Une ligne pleine largeur à la place du bloc « Sets » : **« Set : barb ▾ »** (le set équipé, `equippedSet`), ou « Set :
aucun ▾ ». La toucher ouvre **le menu des Sets**, un panneau qui monte du bas, par-dessus l'écran assombri :
- une ligne par set : son nom (« ✔ équipé » sous le set porté), **Équiper** (grisé pour le set déjà porté) et **⋯** ;
- **⋯** déplie sous ce set trois boutons : Enregistrer (remplacer par l'équipement actuel), Renommer, Supprimer — avec
  les mêmes confirmations qu'aujourd'hui ;
- **+ Nouveau set (ton équipement actuel)** en bas, tant qu'on n'a pas atteint le maximum ;
- pendant une session, la phrase « un set équipé maintenant compte dès la prochaine session » ; une erreur du serveur
  s'affiche dans le panneau ;
- on le ferme en touchant l'écran assombri, le bouton ✕, ou le bouton retour d'Android. Après « Équiper », il se ferme et
  la confirmation habituelle s'affiche.

### Stuff

Sous la ligne des Sets, deux onglets **Équipement | Stats** (Équipement par défaut, retenu tant que l'appli est ouverte).

- **Équipement** : le mannequin, sans défiler à 393 × 760. À gauche Casque, Torse, Jambes, Pieds, Gants, Ceinture ; à
  droite Pioche, Épée, Cape, Boussole, Anneau, Anneau, Torche (l'ordre de `STUFF.slots`, comme sur PC). Cases de 56 px :
  icône de la pièce, contour de sa rareté, marque de rune, +N d'amélioration ; une case vide montre son icône grisée. Au
  centre, le mineur en grand avec son aura, et dessous son **gear score** (« 3 615 GS »). En bas : « Touche une case pour
  la changer ». Les noms des pièces ne sont pas écrits (on les voit en touchant).
- Toucher une case ouvre **la liste des pièces qui y vont** (celle d'aujourd'hui : la pièce portée et « Retirer », puis
  chaque pièce de l'inventaire avec « Équiper »), en panneau qui monte du bas.
- **Stats** : la carte « Stats du mineur » d'aujourd'hui (niveau, gear score, DPS, toutes les stats, légende des couleurs).
- La note « Session en cours : ce que tu équipes maintenant comptera à la prochaine session » reste une seule fois, en haut.

## Comment c'est construit

- `src/ui/sets.js` : deux fonctions pures en plus, `setsBarHtml(current)` et `setsSheetHtml(st, { current, locked, busy,
  msg, more })` (`more` : l'id du set dont « ⋯ » est déplié) ; dans l'appli (`body.app`), `setupSets` dessine la ligne dans
  les 4 hôtes et le panneau dans un `#setsSheet` ajouté à la page ; les actions passent par le même `onClick` / `send`
  (aucune nouvelle règle, aucun nouvel appel au serveur). Tests : `tests/sets-ui.test.js` (ou le fichier de tests des sets
  existant).
- `src/ui/stuff.js` : sous le portrait, `<p class="stuffHeroGs">` avec le gear score (caché sur le site par `style.css`).
- `src/app/perso.js` : les onglets « Équipement | Stats » ajoutés à la section Stuff (classe `stuffStats` sur la section
  quand Stats est choisi).
- `src/app/app.css` : le mannequin (`#stuffGrid` en 3 colonnes, cases de 56 px, libellés et noms cachés), l'onglet choisi
  montré, `#spick` et `#setsSheet` en panneau du bas, le bloc Sets d'origine remplacé par la ligne.

## Ce qu'on ne fait pas

- Rien sur le site, le serveur ou les règles des sets.
- Pas encore Skills (un seul arbre) ni Sorts (fiche en panneau) : prochains morceaux ; ils profitent déjà de la ligne des Sets.

## Ce qui serait un échec, même si ça marche

- Une action des sets qui ne passe plus par les confirmations d'aujourd'hui (remplacer, supprimer).
- Devoir défiler pour voir ses 13 cases à 393 × 760.
- Le site qui change.

## Laissé au constructeur

Taille exacte du portrait, placement de la marque de rune et du +N, animation du panneau (aucune ou très courte).

## Choix de Claude à vérifier

Gear score sous le mineur (pas à côté de la ligne des Sets, qui est la même dans Skills et Sorts) ; « ⋯ » qui déplie trois
boutons dans la ligne plutôt qu'un second menu ; onglet Stuff retenu seulement tant que l'appli est ouverte.
