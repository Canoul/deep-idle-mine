# Instances — spec (Instance I : le roi gobelin)

*Concept de Geoffrey, 27/10/2026, réponses aux questions le même jour. Les choix marqués « (Claude) » sont à valider.
Toutes les valeurs sont provisoires (équilibrage, config `INSTANCE`).*

## Valeurs finales (27/10/2026, après simulation)

salle **28 × 24**, **3 rebords par côté** (6 de large, 5 cases d'air entre deux : à 6, 12 et 18 du sol), plateforme du roi à 21 ; **10 min de jeu** ; spawners **125 coups**, un gobelin toutes les **30 s** ; gobelins **150 PV** ; roi **3 500 PV**, **enfermement tous les 20 % de PV manquants** (80, 60, 40, 20 %).
Les valeurs ci-dessous sont celles du premier jet (remplacées par celles-ci).

## En une phrase

Un donjon de groupe à clé : 1 à 3 joueurs entrent avec une Clé d'instance chacun, cassent les 6 spawners à gobelins
de la salle, puis battent le roi gobelin, en 30 min de jeu au plus.

## Où il se trouve

- Lobby, « Où miner » : un nouveau choix **Instances**. Il ouvre une carte avec la liste des instances :
  **Instance I** (jouable) puis **Instance II** et **Instance III** grisées, « bientôt ».
- On choisit l'Instance I ; l'équipe du lobby s'affiche comme pour la Mine (groupe de **1 à 3**), et le chef **lance**.

## La clé

- Nouvel objet **Clé d'instance I** : rareté **inhabituel**, s'empile.
- Elle se trouve dans les **Treasure T3** : **5 %** de chance, **tirage à part** (en plus du reste du trésor).
- **Une clé par joueur du groupe**, **consommée au lancement**, même si l'instance est ratée ou quittée.
- Le serveur refuse le lancement si un joueur n'a pas sa clé (le chef voit qui en manque).

## La salle

- **20 de large × 20 de haut**, murs et sol indestructibles, tout éclairé (pas de torche), **pas d'oxygène**, **pas
  de pods**.
- **Rebords** : 6 cases de large, 1 de haut, collés au mur, à gauche et à droite, à **5, 10 et 15** cases au-dessus du
  sol : 3 par côté, 6 en tout. Indestructibles.
- **Spawners** : un par rebord, **posé sur le rebord, collé au mur**. Pour le frapper, le mineur doit monter sur le
  rebord et aller jusqu'au fond.
- **Plateforme du roi** : au centre, plus haute que les rebords : **4 cases de large à 17 cases du sol** (le roi,
  3 × 3, tient juste sous le plafond). (Claude)
- **Départ** : les mineurs apparaissent au sol, au centre. (Claude)
- **Monter** : échelles **illimitées**, posées par les mineurs, partagées (comme dans les tours). Gravité comme dans les
  tours.

## Les spawners

- Chacun fait apparaître **1 gobelin dès le lancement**, puis **1 toutes les 30 s**, sans limite (décision de
  Geoffrey : à surveiller en simulation).
- **50 « coups de pioche »** pour le casser, comptés comme au Bloc géant : chaque seconde de minage enlève la vitesse de
  minage effective du mineur. **La Dynamite compte pour 6 coups.** Barre de vie au-dessus du spawner.
- Cassé : il ne fait plus apparaître de gobelin.

## Les gobelins

- **125 PV**. Dès qu'ils apparaissent, ils foncent vers les mineurs ; ils **tombent des rebords** et **montent aux
  échelles**.
- Un coup **toutes les 2 s**. **Le premier coup tacle** le mineur : il doit tuer ce gobelin avant de refaire autre chose
  (comme un tacle en mine). Chaque coup a **30 %** de chance de le repousser de **0,5 case**.
- **Le recul va toujours vers le centre de la salle** : un mineur dans la moitié gauche est poussé vers la droite, et
  inversement.
- **Cible** : 1. le mineur qui l'a **provoqué** (barbare) ; 2. sinon un mineur qui **casse un spawner** à 10 cases ou
  moins ; 3. sinon le **mineur le plus proche**.
- Pas de butin, pas d'XP.

## Le roi gobelin

- Il attend sur sa plateforme, intouchable, tant qu'il reste un spawner. Les mineurs l'ignorent.
- **Les 6 spawners cassés** : il s'éveille, descend et vient se battre. Hitbox et déplacements comme le boss des tours :
  **3 × 3**, **3 fois** la vitesse de marche d'un mineur de base.
- **2 000 PV**, **résistance au recul 25 %**.
- **Un coup toutes les 1,5 s**, sur le même ordre de cibles que les gobelins (provocation d'abord). Chaque coup repousse
  de **0,5 case** (100 %), vers le centre.
- **Tous les 10 coups** (comptés sur tous ses coups) : un coup boosté qui projette en arc de **6 à 7 cases de haut et
  6 à 7 de long**, vers le centre, pour envoyer le mineur sur un rebord en hauteur.
- **Enfermement**, à 75 %, 50 % et 25 % de PV : il téléporte **chaque mineur sur un rebord différent** (au hasard) et
  l'entoure de blocs dans un rayon de 3 (pas du côté du mur ni dans le rebord), **dureté 10**. Les mineurs creusent pour
  sortir. Pendant ce temps le roi attend sans rien faire ; il reprend **dès qu'un mineur est sorti de sa cage**.
  (Claude, pour le moment où il reprend)
- **Rage à 33 % de PV** : chaque coup repousse de **1 case**, et sa vitesse passe à **× 2,5**.

## Fin

- **Victoire** : le roi est mort. **Pas de récompense pour l'instant** (décision de Geoffrey ; viendra plus tard).
- **Échec** : **30 min de jeu** écoulées.
- Pas de XP, pas de butin. Quitter : comme une tour (le mineur sort, la clé est perdue).
- Écran de fin : réussite ou échec, temps, spawners cassés, dégâts infligés au roi par joueur.

## Sorts et stats

- Tous les sorts marchent comme en mine (Dash, Cleave, Hand of Justice, Cri de guerre, Inspiration…). Dynamite sur un
  spawner : 6 coups. La provocation du barbare marche (voir les cibles).
- Ténacité et résistance au recul : comme en mine contre les mobs.
- **Niveau visé** : entre fer et acier, **≈ 3 200 de gear score**. Un groupe à ce niveau doit réussir de justesse en
  30 min ; à vérifier en simulation.

## Technique (résumé)

- Une session comme une tour (`mode: 'instance_1'`), lancée par le groupe, une partie en direct dans son fil
  d'exécution, rejouable après un redémarrage (seed + choix enregistrés).
- Simulation dans `src/sim/instance/`, en réutilisant ce qui existe dans les tours (gravité, échelles, recul, tacle,
  boss 3 × 3).
- Clé : objet dans `ITEMS`, tirage dans l'ouverture du Treasure T3, consommée par le serveur au lancement (même
  écriture que la création de la session : jamais de clé perdue sans session, ni de session sans clé), tests
  anti-triche.
- Config `INSTANCE` dans `src/config.js`.
