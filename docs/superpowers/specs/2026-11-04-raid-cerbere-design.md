# Raid 1 : Cerbère — conception (04/11/2026, Geoffrey)

Demande de Geoffrey du 04/11 (11 h 19) et ses réponses aux questions (11 h 25). Valeurs provisoires sauf mention.

## Accès
- **Depuis sa guilde**, onglet **Raid** : un lobby de raid propre à la guilde (les membres le rejoignent, le chef de raid lance).
- **1 à 10 joueurs** (plus dur à moins). **Gratuit** pour l'instant (ni clé, ni énergie). **Récompense : à définir plus tard.**
- Durée totale (minage + boss) : **30 min** (temps de jeu). Défaite : tout le monde mort, ou les 30 min écoulées.

## Carte : 3 areas
```
(0,0)
(0,-1) (1,-1)
```
- Areas de **50 × 50** comme la mine. Les joueurs apparaissent au-dessus de (0,0) (surface, avec un coffre : ce qui est
  rapporté n'est pas gardé, seul le temps compte).
- (0,0) et (0,−1) : **pleines, que du terrain** (ni minerai, ni mob, ni trésor), de haut en bas : terre, pierre, pierre dure,
  puis **pierre des enfers** (nouveau bloc, dureté 2 × pierre dure). Mêmes règles que la mine : pods, oxygène, allers-retours.
- **100 % du terrain des deux areas** miné → la **grande porte** entre (0,−1) et (1,−1) s'ouvre. Elle ne laisse entrer que
  quand **tous les vivants** sont devant (ceux qui ont quitté ne comptent pas).
- (1,−1) : l'arène du boss, **sans oxygène**. On y entre par la gauche (la porte).

## Cerbère (8 de large × 6 de haut)
Chien à trois têtes de lave et des enfers (Cerbère de la mythologie). Sprite dans la DA du Golbute et de Lucifer (Claude).
- **PV** : réglés à la simulation pour que l'équipe de référence gagne **1 fois sur 10**.
- **Passif** : attaque **3 cibles à la fois** (trois attaques), **en priorité ceux qui le provoquent** (taunt) ; ex. 2 barbares
  qui le provoquent + 1 autre au hasard.
- **Autoattaque** : toutes les **10 s**, sur ses 3 cibles, debuff **« Morsure »** (100 %, la ténacité peut l'éviter, chacun
  son tirage). **Si les 3 cibles sont mordues en même temps, les 3 meurent** (réponse 10 b). Précision de Geoffrey (04/11
  12:07) : si une seule résiste, la Morsure se dissipe pour les 3 ; **l'état ne persiste pas** d'une Morsure à l'autre.
  13:24 : une **seule** des 3 cibles meurt (au hasard), Morsure toutes les **20 s** (14 s enragé).
- **Sort 1, Balayage** : toutes les **5 s**, sa patte balaie le raid à **2 cases** : tout le monde est repoussé de **5 cases**
  et **3 de haut** ; la ténacité peut l'éviter.
- **Sort 2, Magma gazeux** : toutes les **30 s**, gaz de magma pour **tout le raid** : **50 %** de chance par joueur d'être
  **« Durci »**. La ténacité ne joue **que pour la spé Mineur**.
- **Durci** : le mineur devient de la pierre (**dureté 50**) jusqu'à ce que d'autres le **libèrent en le minant**. En pierre,
  il est **intouchable** (ni mordu, ni balayé). Les **tanks** (ceux qui provoquent le boss, donc ceux qu'il attaque ; souvent
  des barbares) n'aident pas, sauf si personne d'autre ne peut (mort ou déjà en pierre).
- **Enragé sous 33 % de PV** : autoattaque toutes les **7 s** ; balayage **6 cases et 4 de haut** ; magma **65 %**.
- **Morts** : jusqu'à la fin, pas de réanimation. Les sorts des joueurs marchent tous, comme à l'instance (pas mort, pas en pierre).

## Équilibrage de référence
10 mineurs : **4 barbares, 4 mineurs, 2 logisticiens**, stuff **T4.5** complet amélioré **+5** sur chaque pièce, runes **R4**
(lignes tirées au hasard comme en vrai) → **1 victoire sur 10**. Mesure du temps de minage : si les 2 areas prennent trop des
30 min, proposer d'abord de réduire les areas, pas de toucher au boss.

## Questions encore ouvertes (à trancher en route)
- ~~Durée de la Morsure~~ : sans objet, elle ne persiste pas (Geoffrey, 04/11). PV provisoires : 190 000 (~1 victoire sur 10, combat ~6-7 min ; tanks à 40 % de ténacité fixe). 13:37 : les tanks ne sont jamais la cible du Magma.
- Ce que voient les joueurs pendant l'attente devant la porte.
- Nom de l'activité et icône.
