# Ange vs Démon — spec (22/10/2026)

Concept du créateur (Geoffrey), validé en discussion le 22/10/2026. **Vocabulaire** : le créateur a dit « donjon »
pour deux choses ; ici, **tour** = le donjon du mode Jugement (Ange / Démon), **donjon** = la structure du minotaure
dans la mine classique (`DUNGEON`, `src/sim/dungeon.js`), qui n'est pas concernée par ce document. Valeurs provisoires, en config (`JUDGMENT`,
`TOWER`, `RUNE`). Ce document fait foi pour l'implémentation ; `GAME_DESIGN.md` en reprend l'essentiel.

## Étape 1 — tableau de conversion des stats (fait, `fc86f1c`)
`UPGRADE.prices` = x par point pour convertir une ligne (identification et runes), d'après le tableau « stat pour
100 x » du créateur. `UPGRADE.worth` = catalogue mesuré, sert seulement à la valeur d'un objet.

## Étape 2 — résidus, jauges, onglet Jugement
- **Blocs** `Résidu angélique` et `Résidu démoniaque` (famille « bloc rare », poids 6, dureté de la pierre dure).
  Dès l'area 4 : 0,5 % des cases de chaque area pour chacun. Tirage à part de la seed (le reste de l'area est
  inchangé), posés à la place de pierre / pierre dure (jamais d'un minerai, d'un treasure, d'un donjon). Ils comptent
  comme un bloc ordinaire (pas un minerai) : pas de Fortune, pas de shiny, pas de vol de gobelin, pas de déblocage.
- Texture : pierre sombre, fissures bleu ciel lumineuses (ange) / rouges lumineuses (démon).
- **Jauges** (serveur, ns `judgment`, clé `state`) : `{ angel:{ count, openUntil, opening }, demon:{…} }`.
  - En fin de session, le serveur ajoute à chaque jauge les résidus **versés aux joueurs** (part de chacun après le
    partage ; quitter = rien). Une session n'est comptée qu'une fois (même mémoire que le versement du coffre).
  - Cap 250. Atteint → `openUntil = now + 6 h`, `opening` = nouveau numéro d'ouverture, `count = 0` (surplus perdu).
    Pendant l'ouverture la jauge continue de se remplir ; si elle atteint 250 pendant une ouverture, la nouvelle
    ouverture commence à la fin de l'actuelle (pas de cumul : `openUntil` repart de max(now, openUntil)).
  - Les deux tours peuvent être ouvertes en même temps.
- **Onglet Jugement** (barre d'action, groupe des onglets de session) : deux jauges face à face, blanche (ange, à
  gauche) et violette (démon, à droite), « x / 250 ». Tour ouverte : bandeau « Tour de l'Ange ouverte — 5 h 12 min »,
  et « Déjà fait pour cette ouverture » si le joueur a déjà gagné un coffre. `GET /api/judgment` (lecture publique
  pour un compte connecté).

## Étape 3 — coffre, rune, Enchantement
- **Coffre angélique / démoniaque** : objet empilable **par rareté** (`Coffre angélique R4`…), gagné à la fin d'une
  tour. Rareté R1 à R7 tirée par le serveur avec les chances de l'identification (`UPGRADE.qualities[].chance`).
- **Ouverture** (Inventaire, comme un Treasure, `POST /api/game/open`) : donne **une rune** de la même rareté. La rune
  est une pièce à part (non empilable, `uid`) : `{ item:'Rune', uid, q, lines:[{ stat, pct }], s }`, lignes tirées à
  l'ouverture comme une identification de cette qualité (nombre de lignes, fourchettes, pool ; Découverte en R6/R7).
  Rune ange = rune démon (même objet ; seul le coffre diffère).
- **Enchantement** (3e rubrique de l'onglet Amélioration, `POST /api/game/upgrade { action:'enchant', uid, rune }`) :
  une pièce de stuff de l'inventaire + une rune → la rune est consommée, la pièce reçoit `rune:{ q, lines, s }`.
  Définitif : une pièce enchantée ne l'est plus. Une pièce non identifiée peut l'être. Valeur d'une ligne de rune =
  % de la valeur de **cette pièce** ÷ prix de la stat (comme une ligne d'identification). Le niveau (+1 à +3)
  s'applique aussi aux lignes de la rune. Revérifié à chaque relecture (`sanitizePiece`), comme l'identification.
- Nom affiché : inchangé ; une icône « rune » à côté du nom et ses lignes listées à part (« Rune R4 : … »).

## Patch du 22/10/2026 (après-midi, Geoffrey)
- **Labyrinthe** : une ligne sur 2 est un mur de 11 blocs indestructibles sur 15 (murs extérieurs compris), soit un
  seul passage de 4 cases, jamais au-dessus du passage précédent (choix de Claude : passage d'un tenant, pour forcer
  le zigzag). Remplace les 5 % de blocs indestructibles au hasard.
- **Brouillard** : l'intérieur n'est pas découvert au départ ; chaque mineur découvre autour de lui (`discoverMax`,
  sans lumière). L'IA planifie avec ce qu'elle a découvert (case inconnue = brique ordinaire).
- **Caméra** rapprochée qui suit le mineur du joueur (`TOWER.view`, 19 × 15 cases).
- **Durée** : demandée à 5 min ; mesuré infaisable avec le labyrinthe (3 bien équipés : 0/10) → **10 min**
  (décision du créateur, briques gardées à 6 s). Mesures (10 tours) : stuff de base 0/10, petit stuff 3/10,
  minage 1,6 + 14 dégâts 10/10 en ≈ 7,5 min, le même seul 0/10.

## Étape 4 — tours de l'Ange et du Démon
- **Lancement** : Lobby, « Où miner » propose `Tour de l'Ange` / `Tour du Démon` seulement quand elle est ouverte.
  Groupe de 1 à 3, le chef lance. Le serveur refuse le lancement si un membre a déjà gagné un coffre pour cette
  ouverture (`judgment.done[opening]` contient son compte). Un échec ne consomme rien.
- **Partie** (`src/sim/tower/`, `mode:'tower'`, même interface que la MI dans `live-game.js`) : 15 min de jeu.
  - Carte : sol plein à la ligne `h`, ciel au-dessus. Tour au milieu : murs extérieurs incassables d'1 case,
    **intérieur 15 × 30** rempli de stonebrick (dureté 6 s), 5 % incassable (tirage qui garantit un chemin vers le
    haut : chaque ligne garde au moins une case cassable sous une case cassable). Portes : l'ouverture du bas des
    deux murs (rez-de-chaussée, 2 de haut), vides. Les mineurs apparaissent au rez-de-chaussée (ligne du bas,
    vidée).
  - Toit : la dernière rangée de l'intérieur est le **plancher de la plateforme** (stonebrick cassable : on y perce un
    trou pour arriver dessus) ; au-dessus, plateforme à ciel ouvert de 15 de large, sans garde-corps. Le boss
    (3 × 5) est au milieu (colonnes 6 à 8 de l'intérieur).
  - Règles : gravité, échelles et passerelles illimitées, posées seulement dans l'intérieur de la tour et sur la
    plateforme ; ni oxygène, ni pods, ni lumière, ni butin des blocs, ni mobs. Chute imprévue ≥ 3 cases = étourdi
    5 s (comme en mine).
  - IA : monte au plus court (Dijkstra comme la MI, en visant la plateforme) ; si elle est dehors (tombée), elle
    rentre par la porte la plus proche et reprend le chemin creusé. Sur la plateforme : va au contact du boss
    (devant ou derrière) et frappe (dégâts, vitesse d'attaque, critique comme en mine).
- **Boss** (Ange / Démon, 1000 PV, 3 × 5, immobile, pas provocable) : cible = le premier arrivé sur la plateforme
  encore dessus (ordre d'arrivée). Un coup par seconde (0,5 s sous 33 % des PV) : 10 % de chance (5 % si la cible est
  barbare) de **projeter la cible de 6 cases** vers l'extérieur (choix par défaut de Claude, le créateur n'a pas
  tranché : avec 6 cases de chaque côté, 5 n'auraient jamais fait tomber) → elle tombe de la tour. Le coup ne fait
  rien d'autre.
- **Fin** : boss mort → fin, chaque joueur présent reçoit un coffre (rareté tirée par joueur) et son compte est noté
  « fait » pour cette ouverture. 15 min écoulées → rien.

## Tests
`tests/judgment.test.js` (jauges, ouverture, une seule fois par session, concurrence), `tests/rune.test.js` (coffre,
rune, enchantement, relecture), `tests/tower.test.js` (carte, chemin garanti, IA monte et tue le boss en 15 min à 1
et à 3, projection), anticheat : rune dupliquée, enchantement deux fois, lancement d'une tour fermée ou déjà faite.
