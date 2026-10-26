# Bloc géant — spec

*Concept de Geoffrey, 26/10/2026. Réponses aux questions le même jour. Les choix marqués « (Claude) » sont à valider.*

## En une phrase

Un mode commun à tout le serveur : pendant 24 h, chaque joueur peut venir, seul, toutes les 3 h, frapper 3 minutes
un bloc géant indestructible. Les coups s'additionnent dans un score collectif ; à la fin des 24 h, chaque joueur venu
au moins une fois reçoit une récompense qui dépend de ce score.

## Où il se trouve

- Un nouveau choix dans le Lobby, « Où miner », à côté de Mine, Mine instantanée et Jugement : **Bloc géant**.
- Ce choix ouvre le panneau du Bloc géant (voir « Écran »). On y entre **seul**, sans groupe ni lobby : chaque joueur a
  son propre délai.
- On ne peut pas y entrer pendant une session mine, une MI ou une tour, ni l'inverse : **une seule session à la fois**.

## Le cycle de 24 h

- Une **session Bloc géant** dure 24 h, de **minuit à minuit, heure de Paris**. Elle est la même pour tout le serveur.
- À minuit : la session se ferme, les récompenses sont calculées, une nouvelle session commence à 0.
- Un mineur encore dans la carte à minuit : sa visite s'arrête là, ses coups comptent pour la session qui se ferme.
  (Claude)

## Entrer

- **Délai de 3 h par joueur**, compté **depuis sa dernière entrée** (pas sa sortie).
- Le délai ne dépend pas de la session : entrer à 23 h 00 bloque jusqu'à 2 h 00 le lendemain. (Claude)
- **30 mineurs au plus** en même temps dans la carte (valeur de config). Plein : le bouton est grisé, on réessaie plus
  tard ; le délai n'est pas consommé.

## La carte

- **10 de large × 7 de haut**, tout en air, sol et murs indestructibles autour.
- **Le bloc géant** : 5 × 5, collé en bas à droite. Indestructible.
- **Spawn** : en bas à gauche.
- **Fontaine à oxygène** : près du spawn, en bas à gauche. Un mineur à côté recharge son oxygène.
- **Grosse torche centrale** : toute la carte est éclairée, les mineurs ne posent pas de torche.
- On mine le bloc **seulement par le côté gauche** : les 5 cases de contact sont dans la colonne juste à gauche du bloc.
  Les mineurs **se superposent sans se gêner** (comme dans les tours). Pas d'échelle, pas besoin de monter.
- Tout le monde voit les autres mineurs présents, en direct.

## Une visite (3 min)

1. Le mineur apparaît au spawn, marche jusqu'au bloc et le mine.
2. **Score** : chaque seconde passée à miner le bloc ajoute **x** points à son compteur, où x = sa **vitesse de minage
   effective** (stuff, skills, anneaux, sorts, comme en mine normale). Une vitesse de 1,3 donne 1,3 point par seconde.
   Les points se comptent par tick (0,1 s).
3. **Recul** : chaque **coup** a **10 %** de chance de le repousser en arc de **1 à 3 cases** vers la gauche (tirage au
   hasard). Il y a x coups par seconde : un mineur rapide est repoussé plus souvent.
   - **Ténacité** : chance d'ignorer complètement le recul.
   - **Résistance au recul** : réduit la distance (3 cases à 50 % → 1,5, arrondi à l'entier le plus proche, 1 au moins
     tant que le recul n'est pas ignoré). (Claude pour l'arrondi)
   - Repoussé, il revient au bloc à pied.
4. **Oxygène** : il baisse **2 fois plus vite** qu'en mine (2 par seconde ; 300 de base → 150 s). À court, le mineur
   va à la fontaine, qui recharge **20 par seconde** (voir question 1), puis il revient au bloc. À 0, il ne peut plus
   miner jusqu'à la recharge. (Claude)
5. **Pas de pods** (rien à ramasser), **pas d'XP**, pas de glyphe, pas de mob, pas de butin.
6. Au bout de **3 min**, il sort. Un écran affiche : **ses points de la visite**, **son total sur la session** de 24 h,
   et le score collectif.
7. Quitter avant la fin : la visite s'arrête, les points déjà faits comptent, le délai de 3 h reste consommé. (Claude)

## Buffs, sorts, spécialisations

- Tous les bonus s'appliquent comme en mine normale.
- **Les buffs de groupe** (sorts comme Inspiration, anneaux) s'appliquent à **tous les joueurs présents dans la carte**
  au même moment, une fois par buff différent (comme en session de groupe).
- **Dash** : sans effet. **Dynamite** : compte pour **1 coup de plus** (+1 point pour celui qui la lance), ne casse
  rien. Les autres sorts : sans effet sauf s'ils augmentent la vitesse de minage.
- **Seul le Mineur a une vraie plus-value** ici (décision de Geoffrey) : c'est voulu.

## Récompenses

À la fermeture, chaque joueur venu **au moins une fois** pendant la session reçoit une récompense selon le **score
collectif**. **Les paliers s'additionnent** :

| Score collectif | Ce palier donne | Total reçu |
|---|---|---|
| ≥ 1 000 | 1 Treasure T1 | 1 T1 |
| ≥ 2 500 | 1 Treasure T1 + 15 Blueprint parts | 2 T1, 15 parts |
| ≥ 5 000 | 1 Treasure T2 | 2 T1, 1 T2, 15 parts |
| ≥ 7 500 | 1 Treasure T2 + 30 Blueprint parts | 2 T1, 2 T2, 45 parts |
| ≥ 10 000 | 1 Treasure T3 | 2 T1, 2 T2, 1 T3, 45 parts |

- La récompense se **réclame avec un bouton** dans le panneau du Bloc géant. Elle reste disponible **tant qu'elle n'est
  pas réclamée** (une par session ; plusieurs sessions non réclamées s'additionnent).
- Le score personnel ne donne rien de plus pour l'instant.
- Repères (≈ 160 points par visite sans stuff, ≈ 210 avec une pioche en fer et les skills) : 1 000 ≈ 6 visites,
  10 000 ≈ 50 à 60 visites, soit 7 ou 8 joueurs qui viennent toutes les 3 h.

## Écran (panneau Bloc géant du Lobby)

- **Temps restant** de la session (jusqu'à minuit).
- **Prochaine entrée** : « Entrer » si le délai est fini, sinon le temps qui reste avant de pouvoir entrer.
- **Mon score** sur la session, **score collectif** avec les 5 paliers (atteints ou non).
- **Classement** : top 10 de la session, plus ta place si tu n'y es pas. Pas de classement des sessions passées.
- **Récompenses à réclamer**, avec le bouton.
- Pendant une visite : l'onglet Session montre la carte en direct (comme une tour), avec le compteur de la visite et
  le temps restant.

## Texture

- Le bloc géant : **un seul motif 5 × 5 généré** (minerai de toutes les couleurs, comme les autres textures), qui
  **pulse**. Fontaine et grosse torche : textures générées aussi.

## Technique (résumé)

- Une **seule partie commune**, en direct sur le serveur, pendant 24 h ; des mineurs **entrent et sortent** en cours de
  partie (nouveau : les tours et la MI démarrent avec tous leurs joueurs). La partie ne tourne que quand au moins un
  mineur est dedans.
- Chaque visite est enregistrée côté serveur (joueur, entrée, points) : le serveur calcule les points, le délai et les
  récompenses, jamais le navigateur.
- Anti-triche : une entrée refusée pendant le délai ou une autre session ; récompense versée **une seule fois** par
  joueur et par session (bouton cliqué deux fois, requête renvoyée) ; pas de récompense sans visite.
- Config `GIANT` dans `src/config.js` (taille de carte, durée de visite, délai, recul, oxygène, fontaine, paliers,
  maximum de joueurs).

## Questions encore ouvertes

1. **Fontaine** : en surface, la recharge est de **30 par seconde** (pas 10). « 2 × la surface » ferait **60 par
   seconde** ; « 20 par seconde » serait plus lent que la surface. Laquelle ?
2. **Minuit** : un mineur en plein milieu de sa visite à minuit, ses points vont à la session qui se ferme (proposé
   ci-dessus). OK ?
