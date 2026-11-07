# Sorts de spécialisation niveau 15 — design

*07/11/2026, Geoffrey (demande) ; rédigé par Claude. Valeurs provisoires, toutes dans `SPELLS` (src/config.js).*

Trois sorts de classe, un par spé, débloqués au **SP lvl 15** (`unlock:{ tree, level:15 }`, `needTree`), comme Dash /
Dynamite. Ils partent tout seuls quand la recharge est finie et qu'ils servent (règle de tous les sorts). Le 3e
emplacement de sort s'ouvre au niveau 15 du mineur : bon moment pour un nouveau sort.

## 1. Fracasse Armure (Barbare)

- **Quand** : il se bat (il frappe un mob ou un mob le tacle) et la cible (celle qu'il frappe, sinon celle qui le
  tacle) n'a **pas** déjà « Fracassé ». Sinon il garde le sort.
- **Effet** : debuff **Fracassé** sur la cible, `duration: 15` s : elle prend `dmgTaken: 0.03` (+3 %) de dégâts de
  **toutes les sources** (tous les joueurs, coups, double coup, splash, Cleave, Dash, Dynamite, Rafale, Désarmement…).
  Pas de cumul (jamais deux Fracassé ; le sort ne part pas sur une cible déjà fracassée).
- **Boss** : oui, même effet.
- `cd: 30` (depuis le lancement). Pas de dégâts propres.

## 2. Rafale de pioche (Mineur)

Une action à incantation (`burst`), comme la Dynamite est une action.

**En minant** (l'IA vient de choisir un coup de pioche, `afterDecide`) :
- Direction du coup = celle du coup de pioche choisi ; **jamais vers le bas** (dy > 0 : il garde le sort). Gauche,
  droite et haut : oui.
- **Ligne** : à partir du bloc visé, les blocs consécutifs dans cette direction, **5 au plus** (`blocks: 5`). La ligne
  s'arrête au premier vide, bord de carte, bloc incassable, construction, mimic caché ou case inconnue.
- **Lancement** seulement si la ligne compte au moins `minBlocks: 3` blocs. Sinon coup de pioche normal.
- **Incantation** = `blocks` × temps de minage du **bloc visé** ÷ `mineSpeed: 1.25` (temps de minage = `mineT`, avec
  tous ses bonus). Choix du créateur : c'est la durabilité du premier bloc qui compte, même si les suivants sont plus
  durs. L'IA ne cherche pas exprès un bloc tendre : elle lance la Rafale sur le bloc qu'elle minait de toute façon.
- **Fin** : les blocs de la ligne (recalculée à la fin : un bloc disparu entre-temps arrête la ligne) cassent comme
  s'il les minait (`breakBlock` : butin, fortune, XP, minerai compté, Fast learner, glyphes). Pas de perçage en plus.
- **Interruption** : un mob le tacle pendant l'incantation → l'action s'arrête (règle actuelle de la session pour
  toute action non-combat), **rien ne casse, pas de recharge** : le sort reste prêt.

**En combat** (il frappe un mob, au moment où une attaque devrait partir, `fight` dans src/sim/ai.js) :
- **Incantation** = le temps de `hits: 5` attaques à vitesse d'attaque × `atkSpeed: 1.25` (même formule que
  l'intervalle normal, Cri de guerre compris). Il ne frappe pas pendant ce temps.
- **Fin** : 5 coups d'un coup, chacun comme un coup normal (`landHit`) : critique, double coup, splash, Cleave possible,
  Fracassé compté ; un seul recul (verrou existant). Puis il reprend ses attaques normales.
- **Cible morte avant la fin** : les coups vont au mob le plus proche qu'il peut frapper (à portée) ; aucun : sort
  annulé, **pas de recharge**. La cible meurt au milieu des 5 coups : les coups restants vont au suivant, de même.
- `cd: 30`, compté **à la fin** de l'incantation (une Rafale annulée ne coûte rien).

## 3. Désarmement (Logisticien)

- **Quand** : il se bat et la cible (celle qu'il frappe, sinon celle qui le tacle) n'a pas « Désarmé ».
- **Effet** : un coup à `dmg: 2` × ses dégâts (critique possible, comme le Cleave ; Fracassé compté), puis debuff
  **Désarmé** `duration: 15` s : les recharges du mob sont `slow: 0.10` plus longues (+10 %) : ses coups (tacle,
  cadence `hitEvery`), ses sorts (vol du gobelin, asphyxie du méphite, canalisation de l'occultiste, morsure du chien,
  charge du minotaure, sorts des boss). Pas de cumul.
- **Boss** : oui, même effet.
- `cd: 30`. Remplace son coup normal à ce moment-là (il ne frappe pas deux fois).

## 4. Affichage

- Deux nouveaux états de mob dans `EFFECTS` : `shattered` « Fracassé » (debuff) et `disarmed` « Désarmé » (debuff),
  calculés par src/sim/effects.js depuis `o.shatterUntil` / `o.disarmUntil` (comme l'Étourdi).
- Rafale : le mineur affiche « Rafale de pioche » pendant l'incantation ; barre de sorts, grimoire, fiche, wiki :
  icônes pixel existantes, textes `short` / `desc` en config.

## 5. Où ça agit

- **Mine classique, k hole, prison, exploration du raid** : tout ce qui est écrit ci-dessus.
- **Modes à boss** (tours du Jugement, instance Golbute, arène de Cerbère, Bloc géant, He's coming) : leurs boss ont
  des PV ou des cadences à part (Lucifer n'a pas de PV). **Premier temps : Fracasse et Désarmement agissent sur les boss
  dont les dégâts / cadences passent par les fonctions communes ; les autres modes sont listés « sans effet »** dans le
  wiki et GAME_DESIGN, à brancher dans une 2e étape si on le veut. La Rafale en combat marche partout où il y a des
  coups normaux.

## 6. Code (principes)

- `hurtMob(G,m,o,d)` dans src/sim/actions.js : **un seul endroit** applique Fracassé (× 1,03) avant de retirer les PV.
  Les 12 endroits qui font `o.hp -= …` (coups, splash, Dash, Dynamite, Cleave, Ralliement, boss) passent par lui.
- `mobSlow(G,o)` : 1,10 si Désarmé, sinon 1 ; multiplié là où une recharge de mob est **remise** (pas à chaque tick).
- Sorts dans src/sim/spells.js (Fracasse et Désarmement dans `updateSpells`, Rafale dans `afterDecide` + `fight`).
- Aucun nouveau tirage au hasard : critiques et doubles coups comme un coup normal (partie identique sans ces sorts).

## 7. Tests et vérification

- tests/spells-sp15.test.js (mines dessinées) : chaque sort part / ne part pas (debuff déjà là, pas en combat, ligne
  < 3, vers le bas), durée et fin des debuffs, +3 % sur toutes les sources, +10 % de recharge, ligne arrêtée au bon
  endroit, incantation interrompue sans recharge, cible morte → mob suivant / annulation, déblocage SP 15.
- Tests existants des sorts, combat, mobs ; simulation `--count 5 --spells …` pour chaque sort (pas de blocage, pas de
  Rafale relancée en boucle, gain chiffré).

## 8. Équilibrage (à juger après simulation)

Ordre de grandeur sans simulation : Fracasse ≈ +1,5 % de dégâts du groupe en moyenne ; Rafale en combat ≈ +3 % de
dégâts du mineur ; Rafale en minant ≈ +25 % sur 5 blocs toutes les 30 s (plus si de la terre précède du minerai). Ce
sont des valeurs à régler, pas des décisions de design.
