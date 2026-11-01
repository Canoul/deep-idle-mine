# He's coming — design

Date : 01/11/2026, Geoffrey. Valeurs provisoires, dans `HES_COMING` (src/config.js).

## Idée

He's coming est le Bloc géant version combat : même salle commune, mêmes visites, même récompense à minuit. Au lieu de miner
un bloc, on frappe Lucifer. C'est le DPS qui compte, plus la vitesse de minage. Le Barbare y a sa place, comme le Mineur au Bloc.

## Repris tel quel du Bloc géant

- Journée de minuit à minuit (Paris), score collectif, classement du jour (top 10 + ma place).
- Entrée seul depuis la carte du Lobby, une fois toutes les 3 h, aussi possible pendant une session. 30 joueurs au plus.
- Visite de 3 min de jeu. Quitter : les points faits comptent, l'entrée reste utilisée.
- Oxygène : 2 par seconde, 1 de plus par coup, fontaine près du spawn à 30 par seconde.
- Pas de pods, d'XP, de mob, de butin ni de glyphe. Anneaux : pour tous les présents, une fois par anneau.
- Récompense : au moins 2 visites dans la journée, paliers cumulés. Réclamée une seule fois, comme au Bloc.

## Différent du Bloc géant

**Indépendant** : son propre compteur de 3 h, son score, son classement et sa récompense. On peut faire les deux modes le même jour.

**Points** : 1 dégât infligé = 1 point. Compte tout le calcul d'un coup de la mine : dégâts, dégâts %, critiques, double attaque, vitesse d'attaque.

**Paliers** : ceux du Bloc × 8 (décision après simulation, avant : × 25).

| Score collectif | Récompense |
|---|---|
| 8 000 | 1 Treasure T1 |
| 40 000 | 1 Treasure T1 + 15 Blueprint parts |
| 80 000 | 1 Treasure T2 |
| 120 000 | 1 Treasure T2 + 30 Blueprint parts |
| 160 000 | 1 Treasure T3 |

**Pépites d'argent** : 1 par tranche de 800 points (celles du Bloc ÷ 8).

**Salle** : 15 × 7, spawn et fontaine à gauche. Lucifer à droite : gros démon charismatique, seuls son torse, ses bras et sa tête sortent du sol, qui est un portail de lave. Il ne meurt jamais, il ne se déplace pas. Le recul à 10 % par coup du Bloc disparaît, remplacé par les attaques de Lucifer.

**Combat** : le mineur marche vers Lucifer et frappe dès qu'il est à portée (`reachOf`, sur la ligne du sol). La portée compte : une lance ou un arc reste plus loin.

**Rugissement** : toutes les 30 s (horloge de la salle), une aura violette se propage autour de lui. Chaque mineur à 3 cases ou moins (depuis le bord de Lucifer) passe en **Fear** 15 s : il se déplace au hasard, ne frappe plus, ne va pas à la fontaine, l'oxygène continue de baisser. Un Fear en cours n'est pas prolongé. La **ténacité** l'ignore (un tirage par mineur).

**Autoattaque** : toutes les 5 s, chaque mineur à portée de contact de Lucifer est projeté de 4 cases vers la gauche, en arc de 2 de haut, sans dégâts. Ténacité : l'ignore. Résistance au recul : réduit la distance, comme au Bloc. Le contact est mesuré avec `COMBAT.reach` : un mineur qui tire de plus loin n'est pas touché.

**Sorts et skills** : les bonus passifs de dégâts et de vitesse d'attaque comptent. Inspiration comme au Bloc, Cri de guerre pour les présents. Dynamite, Dash, Illumination et Ulti shen : sans effet. À ajuster à la simulation.

## Conséquences d'équilibrage à surveiller

- Une visite en fer fait environ 3 200 points (18 dégâts par seconde sur 3 min), Fear et oxygène non comptés. Le Bloc en fer fait 184 points, soit 4 600 une fois × 25 : Lucifer est plus dur à remplir, à mesurer à la simulation.
- Sans ténacité, un mineur au contact perd jusqu'à la moitié de ses frappes. La ténacité devient une vraie stat de ce mode.
- L'Arc de l'Admin (portée 8,5) échappe au Fear et à l'autoattaque. Accepté : arme donnée seulement par l'administration. Une portée de 3,5 ou plus échappe au rugissement ; aucune arme de craft n'y arrive aujourd'hui.

## Code

- `MINE_MODES` : entrée `hescoming`, carte dans le Lobby comme le Bloc géant.
- Service : `server/giant/service.js` paramétré par sa config et ses clés de stockage, une seconde instance pour Lucifer, au lieu d'en recopier 250 lignes.
- Simulation : `src/sim/hescoming/session.js`, pure, avec le même contrat que `src/sim/giant/session.js`. Les règles communes restent dans `src/shared/giant.js`.
- Rendu : `src/render/hescoming.js`, textures PNG générées par `scripts/gen_textures.py`. Interface : `src/ui/giant.js` réutilisé si possible.
- Fear : état du mineur, ajouté à `minerEffects` (icône et temps restant).

## Tests

- Rugissement : rayon 3, 15 s, 30 s entre deux, Fear non prolongé, ténacité.
- Autoattaque : 5 s, 4 cases, 2 de haut, contact seulement, ténacité, résistance au recul.
- Points = dégâts ; Fear : aucun point ; déterminisme.
- Paliers × 25, pépites, deux visites, compteurs séparés du Bloc.
- Anti-triche : récompense réclamée une seule fois, visite rejouée, jamais créditée deux fois (`tests/anticheat/`).
- Simulation : points par visite en fer, acier, avec et sans ténacité.
