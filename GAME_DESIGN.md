# Deep Mine Idle — Game Design

Source de vérité des règles du jeu. Les valeurs marquées *(provisoire)* sont des estimations du prototype, à équilibrer. Les autres sont des décisions fermes.

## 1. Concept

Idle game sur navigateur. Le joueur ne contrôle pas directement le mineur : il le prépare (stats, équipement, préférences), puis le regarde explorer seul une mine 2D en blocs. Le but est d'aller le plus profond possible et de rapporter des ressources.

- Une **session dure 1h en temps réel**.
- Le mineur joue **tout seul** dans sa mine pendant la session.
- À la fin de la session, les ressources du **coffre** passent dans un **inventaire global** hors session.
- Hors session, une **UI de craft** permet de gérer les caractéristiques et le stuff du mineur.
- Boucle de méta-progression : récolter → crafter/améliorer → redescendre plus profond à la session suivante.

### Intention de progression *(décision ferme)*
- **Le but du jeu est l'évolution du mineur de session en session.** Le joueur doit **sentir** qu'il progresse d'une session à l'autre.
- **On ne veut pas qu'il finisse le contenu actuel (jusqu'à l'area 5) en une seule session.** Une session avec le mineur de base doit s'arrêter bien avant.
- L'évolution passe par **l'amélioration du stuff grâce aux ressources rapportées** pendant les sessions : chaque session finance la suivante, qui va plus loin.
- Conséquence pour l'équilibrage : une progression trop rapide (tout le contenu en un essai) est un défaut, pas une réussite. Les minerais profonds (or, diamant) sont des objectifs des sessions suivantes, pas de la première.

## 2. Monde

- Monde 2D en blocs, raisonnement en blocs (pas en pixels).
- **Surface plate**, 50 blocs de large. Le mineur démarre à la surface et creuse vers le bas.
- Le monde est découpé en **areas** de 50 blocs de haut sur 50 de large (2500 blocs par area).
- Chaque area a une **composition en pourcentages**, affichée dans un panneau quand le mineur y entre.
  - Exemple area 0 : 52% terre, 33% pierre, 10% charbon, 5% vide, soit 250 charbons sur 2500 blocs.
- **Déblocage de l'area suivante** : miner un seuil de minerais de l'area courante, par défaut **60%** des minerais (*valeur d'équilibrage* ; 40 % avant le 22/10/2026).
  - Exemple area 0 : 60% de 250 charbons = 150 charbons.
  - Tant que le seuil n'est pas atteint, le fond de l'area est une **barrière infranchissable** : un bloc spécial « Barrière », incassable, qui délimite les deux areas. Pour l'IA c'est une case non franchissable, ignorée dans ses chemins. Quand l'area suivante se débloque, la barrière disparaît.
- L'area suivante se trouve **en dessous** de l'actuelle : l'expérience voulue est le « going deep ».
- Seules les areas débloquées ont besoin d'exister en mémoire ; la profondeur est quasi gratuite.
- **La couche 1 du monde (juste sous la surface) est toujours en terre.** Elle **ne fait partie d'aucune area** (pour ne pas fausser les pourcentages) : l'area 0 occupe les couches 2 à 51, l'area 1 les couches 52 à 101, etc.
- Le **coffre** est généré au spawn, sur la surface. Les ressources déposées dedans partent dans l'inventaire global à la fin de la session du joueur. Il est en colonne 22 (sur 50), à côté du treuil (colonne 25, le milieu). **La case sous le coffre est un « socle » incassable** *(23/10/2026, Geoffrey)* : personne ne creuse sous le coffre, ce qui évite des bugs de chemin.

### Catégories de blocs

Chaque bloc appartient à une catégorie :

| Catégorie | Blocs | Rôle |
|---|---|---|
| `terrain` | terre, pierre, pierre dure | remplissage, se mine et se ramasse |
| `ore` | charbon, fer, or, diamant | minerais : comptent pour le déblocage, visés par l'IA, signalés par la boussole |
| `build` | passerelle, échelle, torche | posés par le mineur (l'échelle et la torche se posent par-dessus une case vide) |
| `treasure` | treasure | entité enfouie dans la mine, voir ci-dessous |
| `special` | barrière | bloc de jeu sans rôle de ressource |

**Familles d'objets (inventaire).** Une fois ramassé, un bloc devient un objet d'une **famille**, qui décide de son usage hors session. C'est en général sa catégorie, sauf exception :
- **charbon** : minerai dans la mine (il compte pour le déblocage, l'IA le vise, le gobelin le vole), mais **combustible** dans l'inventaire ;
- **ore** (fer, or, diamant) : minerais ; ceux qui ont une recette se fondent au four (fer, or ; pas le diamant pour l'instant) ;
- **ingot** : les lingots sortis du four ;
- **bloc** (terre, pierre, pierre dure) : se concassent au concasseur (voir §6, Concasseur) *(famille créée le 21/10/2026)*.

**Shiny.** Quand un mineur mine un bloc de **fer** ou d'**or** (les minerais qui se fondent au four), il a **1 %** de chance *(provisoire)* d'obtenir à la place un **shiny** : « Shiny iron », « Shiny gold ». C'est l'objet **déjà cuit** (famille ingot, poids 1 dans les pods), dont l'icône porte une étincelle et **scintille**. Un bloc donne le minerai **ou** le shiny, jamais les deux ; il compte toujours comme minerai miné (déblocage, XP, skills). Pas de shiny pour le charbon, le diamant ni le butin des mimics. Le journal de la session l'annonce (« ✨ … trouve un Shiny iron ! »). Un shiny ne repasse pas au four. Ordre de grandeur : ~6 à 7 shiny par session à 3. **Usage hors session : à décider.**

### Compositions des areas

| Area | Terre | Pierre | Pierre dure | Charbon | Fer | Or | Diamant | Graphite | Vide |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 52 | 33 | – | 10 | – | – | – | – | 5 |
| 1 | 30 | 49 | – | 15 | 1 | – | – | – | 5 |
| 2 | 20 | 55 | – | 10 | 10 | – | – | – | 5 |
| 3 | 10 | 60 | 5 | 7 | 10 | 3 | – | – | 5 |
| 4 | – | 60 | 15 | 5 | 10 | 5 | – | – | 5 |
| 5 | – | 55 | 20 | – | 9,5 | 5 | 0,5 | 5 | 5 |
| 6+ | – | 35 | 40 | – | 7 | 6 | 1 | 6 | 5 |

La dernière ligne se répète au-delà. Areas 5 et 6 : décision du 23/10/2026 (Geoffrey) ; ancienne area 5 (répétée
au-delà) : 55 pierre, 20 pierre dure, 3 charbon, 8 fer, 7 or, 2 diamant, 5 vide.
- **Graphite** (23/10/2026) : minerai `Graphite ore` des areas 5 et 6 (dureté 4, poids 3, attrait 4, 4 XP *(provisoire)*).
  Au four : **10 Graphite ore → 1 Graphite ingot** (10 charbons, 60 s). Alliage : **Steel ingot = 3 Tainted iron +
  10 Graphite ingot** (50 charbons, 3 min). Usage du steel : à définir (craft). Les comptes sont exacts, pas probabilistes (arrondis absorbés par le terrain principal).
- Les minerais sont générés en petits filons (1 à 4 blocs).
- Le **vide** est généré en petites poches (1 à 4 cases) : des cavités naturelles, cachées tant que le mineur ne les a pas découvertes. Le mineur peut y tomber (gravité). Les bestioles n'apparaissent pas dans une poche encore cachée.
- **Pierre dure** : roche des areas profondes, deux fois plus longue à miner que la pierre (dureté 2,4, poids 3 *(provisoire)*).

### Treasures
Vocabulaire : le **treasure** est l'entité enfouie dans la mine (on peut l'appeler « coffre » à l'oral, c'est bien un treasure, pas le coffre de dépôt de la surface) ; l'**objet** qu'il donne s'appelle **Treasure TX**, X étant son tier.
- Chaque area a une **probabilité** qu'un treasure y soit enfoui : **60 %** dans les areas 0 à 2 (celles du Treasure T1) et **40 %** au-delà *(25/10/2026, Geoffrey ; avant 40 % partout, et 30 % avant le 24/10 ; provisoire, réglable area par area)*. Le tirage dépend de la seed : même seed, même treasure.
- Le treasure remplace un bloc de terrain au hasard dans l'area.
- **Butin** *(décision ferme)* : **1 objet Treasure TX**, **aucun minerai**. Le tier dépend de l'area où le treasure est enfoui :

  | Areas | Objet |
  |---|---|
  | 0 à 2 | **Treasure T1** |
  | 3 et 4 | **Treasure T2** |
  | 5 et 6 | **Treasure T3** *(23/10/2026 ; avant : T2 en areas 3 à 5)* |

  Au-delà de l'area 6, le dernier tier s'applique (T3). Poids 2 *(provisoire)*. Rien dans ce butin ne compte pour le déblocage de l'area.
- **Ouvrir un Treasure TX** *(décision ferme)* : hors session, depuis l'onglet Inventaire (sélectionner le Treasure, bouton « Ouvrir »). Le Treasure est consommé, son contenu arrive dans l'inventaire et une petite fenêtre présente le butin obtenu (objets rares en tête). C'est le **serveur** qui tire le contenu, avec un hasard qu'on ne peut pas prévoir (pas la seed). Un Treasure TX sans table de butin ne s'ouvre pas (T1, T2 et T3 en ont une).
- **Contenu du Treasure T1** *(valeurs provisoires)* :

  | Objet | Quantité | Chance |
  |---|---|---|
  | Blueprint parts | 5 à 10 *(25/10 ; avant 5 à 15)* | 100 % |
  | Charbon | 100 à 150 | 100 % |
  | Fer | 50 à 80 | 100 % |
  | **Un blueprint** parmi : Pioche en fer, Épée en fer, Lance en fer, Casque en fer, Plastron en fer, Jambes en fer, Bottes en fer, Four en fer, Boussole en or, Ceinture en peau de gobelin | 1 | 2 % chacun pour les 7 pièces en fer (lance comprise, 25/10), 1 % pour le four, la boussole et la ceinture (17 % au total) *(25/10 ; avant 1 % chacun)* |
  | **Une gemme** parmi : Rubis inférieur, Jade inférieur, Saphir inférieur | 1 | 1 % chacune (3 % au total) |

  *(décision ferme)* un seul tirage par famille : jamais deux blueprints ni deux gemmes dans le même Treasure. Le charbon et le fer sont les mêmes objets que ceux de la mine (ils s'empilent avec). Usage des blueprints : débloquer une recette (§6, Craft). Usage des gemmes : défini plus tard.
- **Contenu du Treasure T2** *(valeurs provisoires, mêmes principes que le T1)* :

  | Objet | Quantité | Chance |
  |---|---|---|
  | Or (minerai) | 20 à 40 | 100 % |
  | Peau de gobelin | 3 à 10 | 100 % |
  | Blueprint parts | 8 à 18 | 100 % |
  | **Un blueprint** parmi : Gants tactique, Gants d'ouvrier, Cape de Naingui | 1 | 2 % chacun (6 % au total) |
  | **Une gemme** parmi : Rubis inférieur, Jade inférieur, Saphir inférieur | 1 | 1,5 % chacune (4,5 % au total) |

- **Contenu du Treasure T3** *(23/10/2026, Geoffrey ; mêmes principes)* :

  | Objet | Quantité | Chance |
  |---|---|---|
  | Graphite ore | 20 à 40 | 100 % |
  | Tissu sombre | 3 à 10 | 100 % |
  | Blueprint parts | 10 à 20 | 100 % |
  | **Un blueprint** parmi : Casque, Plastron, Jambes, Bottes, Pioche, Épée en acier (1 % chacun) ; Plastron de l'équilibre (0,5 %) | 1 | 6,5 % au total |
  | **Une gemme** parmi : Rubis inférieur, Jade inférieur, Saphir inférieur | 1 | 2 % chacune (6 % au total) |
  | Cristal de pleine lune | 1 | 10 % |
- L'IA vise un treasure **une fois découvert** (comme un minerai très rentable) ; la boussole ne le signale pas. Un treasure (ou un résidu) découvert **à portée** (12 cases) est visé **quel que soit le focus d'area** (« Plus profond » compris) *(23/10/2026, Geoffrey : un treasure d'une area du dessus, collé au puits du treuil où tout le monde passe, restait là toute la partie)*.
- Le panneau d'area affiche la probabilité, puis le tier trouvé une fois le treasure ouvert.
- Dans l'inventaire, chaque tier a son icône (T1 : ferrures argent, T2 : ferrures or).

## 3. Le mineur

### Déplacement
- **Le mineur est soumis à la gravité** : s'il y a du vide sous lui, il tombe case par case (8 blocs/s *(provisoire)*) jusqu'à atterrir sur un bloc solide ou **sur une échelle**. Il ne tombe pas s'il est sur une case avec échelle, ni s'il est posé juste au-dessus d'une case avec échelle. **Une chute qui finit sur une échelle se fait à la vitesse de l'échelle**, pas à 8 blocs/s *(22/10/2026)*. *(À définir : dégâts ou ralentissement de chute, voir questions ouvertes.)*
- **Chutes** *(décision ferme ; valeurs provisoires)* :
  - le mineur **ne se jette jamais dans un trou de plus de 3 cases** qu'il connaît (cases découvertes) : l'IA ne prévoit aucune chute plus haute ; devant un tel trou, il pose une passerelle, passe ailleurs ou creuse un autre puits. Vaut aussi quand il descend de son échelle dans le puits d'un autre mineur *(corrigé le 22/10/2026 : il s'y jetait)* ;
  - une chute de **plus de 3 cases** l'étourdit **toujours**, même dans un trou connu : puisqu'il ne s'y jette jamais, c'est que son appui a disparu *(22/10/2026)*. Seule exception : le chantier du treuil (§ Treuil) ;
  - **depuis le seau du treuil ou une échelle**, l'IA compte une chute à la vitesse du puits : elle ne sort plus du puits pour tomber à côté (plus vite) puis y revenir plus bas *(22/10/2026 : alternance treuil / chute sur le côté)* ;
  - une chute **imprévue** (dans du vide pas encore découvert) de **3 cases ou plus** l'**étourdit 5 s** : il ne peut plus rien faire (ni bouger, ni miner, ni frapper), même taclé ; l'oxygène continue de baisser. Des étoiles tournent au-dessus de sa tête. Une chute connue de 3 cases ne l'étourdit pas.
  - Repère (simulation, 5 sessions) : ≈ 6 étourdissements par session en solo, ≈ 12 à 3 mineurs (≈ 30 à 60 s perdues).
- Le mineur ne peut pas sauter. Actions possibles : **aller à gauche/droite, miner, poser une échelle**.
- **Descente** : le mineur creuse le bloc sous lui et se laisse tomber. **Il ne pose pas d'échelle en descendant.**
- **Échelles posées seulement au retour** : quand il doit remonter, il pose une échelle (2 s) sur chaque case où il en a besoin. Le chemin de retour est choisi au plus court en temps ; les échelles posées restent et servent aux trajets suivants. Un chemin de retour existe donc toujours (il peut toujours poser une échelle et creuser au-dessus de lui).
- Pour choisir où creuser, l'IA compte d'avance ce coût de retour : une case creusée vers le bas = une échelle à poser plus tard.
- **Vitesse de montée** : stat à part (2,25 blocs/s *(provisoire)*, soit ×0,75 de la marche), utilisée sur échelle dans les deux sens. Elle s'améliore indépendamment de la vitesse de marche. Conséquence voulue : pour remonter, l'IA choisit un chemin au **temps** le plus court et préfère marcher horizontalement vers une échelle existante plutôt que de remonter tout droit en posant de nouvelles échelles.
- **Creuser vers le bas ou vers le haut coûte plus cher qu'horizontalement** : chaque case verticale impose une échelle (2 s de pose) et se parcourt plus lentement (vitesse de montée), à l'aller comme au retour. L'IA compte ce coût (pose + trajets futurs) quand elle choisit un minerai : elle préfère donc les galeries.
- **Passerelle** : un bloc que le mineur pose (1 s *(provisoire)*) pour **combler un trou** et le traverser horizontalement. C'est plus rentable qu'une chute suivie d'échelles pour remonter. **Il ne peut la poser que s'il tient lui-même** (sur un bloc ou sur une échelle), jamais dans le vide ; depuis une échelle, il peut en poser à gauche ou à droite. Plus généralement, le mineur ne peut agir que depuis une case où il tient : l'IA ne prévoit jamais de s'arrêter dans le vide. Les passerelles sont **illimitées** (décision du 21/10) ; la passerelle est cassable et ne rapporte rien. *(À définir : faut-il un coût en ressource ?)*
- **Montée** : uniquement par échelle. Pour creuser vers le haut, il pose une échelle avant de miner le bloc du dessus.
- Les « fondations » (boucher un trou) sont prévues mais pas encore implémentées.

### Autonomie (IA)
Le mineur décide seul. Le joueur influence l'IA via les stats, l'équipement et les **préférences** (voir §7).
- Par défaut il creuse vers le bas.
- **Après un retour en surface, il repart de zéro** : il n'est pas obligé de retourner là où il s'était arrêté. Un minerai connu mais lointain (plus de 12 blocs *(provisoire)*) n'est pas plus attirant que creuser du neuf.
- **Réutiliser l'existant** : pour descendre ou changer de galerie, l'IA compare le temps d'un trajet par les échelles et galeries déjà posées au temps d'un nouveau puits (mine + échelle à chaque case), et prend le moins cher.
- La **boussole** aide l'IA à choisir : s'il vaut mieux aller sur les côtés vers un minerai plutôt que descendre.
- Quand le fond de l'area est verrouillé, il explore en **galeries** horizontales pour trouver les minerais manquants.
- **Fin de session** *(22/10/2026, Geoffrey ; `CFG.endWorkShare`)* : quand il repart de la surface, il fixe pour ce trajet une **profondeur maximale** : celle où l'aller et le retour depuis la surface prennent au plus **la moitié du temps restant**. Il ne descend pas plus bas et n'y vise pas de minerai : il mine **plus haut** (filons, galeries) au lieu d'aller au front pour remonter aussitôt. La vitesse de trajet est mesurée sur sa dernière remontée (échelles, treuil, détours compris). Il ne repart plus s'il reste moins de 45 s ou si cette profondeur est de moins de 3 couches. *(Avant : il repartait s'il restait 2 × son dernier retour + 30 s, et descendait toujours jusqu'au front.)*

### Focus minerai
Pendant la session, un panneau **Focus minerai** de l'onglet Session permet de choisir, minerai par minerai, ce que vise le mineur du joueur. Il ne propose que les minerais **présents dans les areas débloquées** (la liste grandit avec les déblocages) et affiche, pour chacun, le restant sur le nombre initial.
- Trois modes par minerai : **Aucun** (normal), **Cibler** (le minerai pèse plus lourd que le plus gros minerai : 2 × la valeur du diamant *(provisoire)*), **Uniquement** (l'IA ne vise que les minerais « Uniquement » et ignore les autres).
- **« Uniquement » écrase « Cibler »** : dès qu'un minerai est en « Uniquement », les minerais en « Cibler » sont ignorés aussi.
- **Seuls les blocs de type ore sont concernés** : les treasures découverts restent visés. D'autres cibles (coffres, pierres précieuses…) pourront s'ajouter plus tard.
- Le jeu connaît, pour chaque area, le **nombre initial et le restant** de chaque minerai.
- **Area épuisée** : s'il reste moins de **20 %** *(provisoire)* du nombre initial d'un minerai visé dans l'area du mineur, il part vers **l'area débloquée la plus proche** qui en a encore (au-dessus ou en dessous ; à égalité, celle du dessous). Il ne descend pas non plus dans une area épuisée : il explore la sienne en galeries.
- **Épuisé partout** : si toutes les areas débloquées sont sous le seuil pour ce minerai, son focus **saute** et un message prévient le joueur dans le panneau.
- Le changement est envoyé au serveur, qui l'**applique tout de suite** dans la partie (il n'y en a qu'une, sur le serveur) : tous les joueurs le voient en même temps. Il est enregistré avec son tick (comme un départ).

### Focus area
Pendant la session, un panneau **Focus area** de l'onglet Session permet de choisir **où** travaille le mineur du joueur :
- **Plus profond** *(option de base, active dès le début de la session ; décision du 22/10/2026)* : le mineur travaille dans **l'area débloquée la plus profonde**, comme avec un focus sur cette area, et **suit chaque déblocage** tout seul. Il ne finit plus les filons des areas du dessus (avant : il descendait en prenant tout ce qui était à portée, et passait plus de la moitié de son temps au-dessus). Exceptions : avec un **focus minerai**, c'est lui qui choisit l'area (la plus proche qui en a encore) ; si l'area la plus profonde est vidée (< 20 %), retour à l'ancien comportement ; en **fin de session**, l'area la plus profonde qu'il peut encore atteindre (profondeur maximale du trajet).
  - Repère (simulation, 5 parties, seau 0,85×) : solo, valeur rapportée 414 → 352 (−15 %) ; à 3, 1 431 → 1 087 (−24 %), profondeur 200 → 228, areas débloquées inchangées (4). Plus profond = moins de quantité, des minerais plus rares ; choisir une area précise reste possible.
- **Une area précise** (0, 1, 2…) : seules les **areas débloquées** sont proposées (la liste grandit avec les déblocages). Le mineur rejoint cette area (il descend ou remonte), y reste, ne descend pas plus bas et **ne vise que les cibles de cette area** (minerais et treasures).
- **Area vidée** *(décision ferme)* : s'il reste moins de **20 %** *(même seuil que le focus minerai, provisoire)* de tous les minerais de l'area choisie, le focus area **saute** : retour à « Plus profond », avec un message dans le panneau. Le mineur ne perd pas la fin de session à creuser des galeries vides (en simulation, 3 mineurs vident l'area 0 en ~25 min).
- **Avec le focus minerai** *(décision ferme)* : le focus area décide **où** va le mineur, le focus minerai décide **ce qu'il vise** dans cette area. Si l'area choisie passe sous le seuil pour un minerai visé, ce focus minerai saute (message dans le panneau), le focus area reste.
- Choisir une area plus haute empêche de débloquer les suivantes (rien n'est miné dans la dernière) : c'est un arbitrage du joueur.
- Même enregistrement que le focus minerai (clé `area`) : appliqué tout de suite par le serveur, enregistré avec son tick.

### Caractéristiques
| Stat | Rôle | Valeur de base |
|---|---|---|
| Oxygène | Temps passé sous terre | 300 *(ferme, soit 5 min)* |
| Vitesse | Déplacement horizontal (marche) | 3 blocs/s *(provisoire)* |
| Vitesse de montée | Déplacement sur échelle (montée et descente) | 2,25 blocs/s *(provisoire)* |
| Vitesse de minage | Divise le temps de minage | 1 *(provisoire)* |
| Dégâts | Dégâts par coup contre les mobs | 5 *(provisoire)* |
| Vitesse d'attaque | Rythme des coups contre un mob, **en %** (100 % = un coup toutes les 0,8 s, 200 % = deux fois plus vite ; ralentie dans le noir comme le reste) | 100 % *(provisoire)* |
| Fortune | **Chance, en %, de dupliquer le minerai obtenu en le minant** (le minerai, ou son shiny). Le doublon pèse dans les pods mais ne compte pas pour le déblocage de l'area. Au-delà de 100 % : un doublon sûr par tranche + une chance sur le reste. Ne s'applique ni à la terre/pierre ni au butin des mimics | 0 % *(provisoire)* |
| Pods | Poids d'inventaire | 200 *(provisoire)* |
| Ténacité *(21/10)* | **Chance, en %, d'ignorer un sort de mob qui le vise** : le vol du gobelin, la canalisation de l'occultiste, l'asphyxie du méphite *(24/10)*. **Un tirage à chaque sort** (chaque vol, chaque canalisation, chaque perte d'oxygène). Un sort ignoré est perdu (l'occultiste s'est téléporté et attend son prochain sort). Vient du skill Force brute (Barbare) | 0 % *(provisoire)* |

**Stats d'amélioration** *(21/10/2026, onglet Amélioration ; 0 de base, elles ne viennent que des lignes tirées à l'identification)* :

| Stat | Rôle |
|---|---|
| Vitesse de minage % | Bonus en % : **vitesse de minage = (base + bonus fixes) × (1 + bonus en %)**. Différente de la vitesse de minage « fixe » (+0,1 de la pioche) |
| Dégâts % | Même calcul pour les dégâts : (base ou épée + bonus fixes) × (1 + bonus en %) |
| Critique | Chance qu'un coup contre un mob fasse **le double** de dégâts |
| Coup unique | Chance de casser un bloc **instantanément** |
| Perçage | Chance de casser aussi **le bloc juste derrière** celui miné (dans la direction du coup) ; il rapporte son butin comme un bloc miné (fortune, shiny, déblocage), jamais une barrière, un mur de donjon ni un mimic, jamais en chaîne |
| Butin des mobs | **Chance, en %, d'un butin en plus** à chaque mob tué (pas un multiplicateur, 22/10/2026) : 9 % = 9 % de chance d'avoir 1 de plus ; au-delà de 100 %, la partie entière est sûre (150 % = +1, et 50 % de chance de +2). S'ajoute au skill Pillage ; l'onglet Stats montre le total |

### Niveau et XP
Le mineur du joueur a un **niveau**, rattaché à son compte, qui monte avec l'**XP** gagnée en session.
- **Sources d'XP** *(valeurs provisoires, `XP` en config)* : minerai miné, charbon **1**, fer **2**, or **4**, diamant **7** ; mob vaincu, bestiole **5**, gobelin **10**, mimic **5**, occultiste **15**, méphite **12** *(24/10)* (mob de base, sans XP de minerai en plus).
- **Pot commun** : toute l'XP de la session (minerais et mobs) va dans un pot, **partagé à parts égales** entre les joueurs présents, comme le coffre (arrondi vers le bas), **par tranches** : l'XP gagnée avant un départ est divisée entre les présents d'alors, la part du partant est perdue. **Qui quitte la session ne reçoit pas d'XP.** Versée par le serveur, une seule fois par session.
- **Bonus d'XP personnel** *(24/10/2026)* : un « % XP » (Anneau du nerd) s'applique à la part de son porteur **après** le partage ; il ne gonfle pas le pot des autres.
- **Courbe** : 1000 XP pour passer du niveau 1 au niveau 2, puis **×1,5** à chaque niveau (1000, 1500, 2250, 3375…) ; niveau 5 à 8125 XP au total *(provisoire)*.
- **Récompense** : **1 point de skill par niveau**, à dépenser dans l'onglet Skills (ci-dessous).
- **XP de spécialisation** *(24/10/2026, Geoffrey ; valeurs provisoires, `XP.specPct` / `XP.specCurve`)* : le joueur gagne aussi **50 % de sa part d'XP** *(24/10 ; ancien 10 %)* (après le partage et le bonus personnel, arrondi vers le bas) en **XP de spécialisation**, pour l'**arbre de skills figé au lancement** de la session (aucune sans arbre ; rien pour qui quitte). **Une XP par arbre** (Mineur, Logisticien, Barbare), gardée quand on change d'arbre. Courbe : **la même que le niveau du mineur** *(24/10 ; ancienne courbe 100 ×1,5)* : **1000** pour passer au niveau 2, puis **×1,5** (1000, 1500, 2250…) ; seul le gain change (50 % de l'XP). ≈ 430 XP de spé par session en solo (≈ 370 à 3) : niveau 2 en ≈ 3 sessions, niveau 5 (8 125 XP) en ≈ 19, niveau 10 (≈ 74 900 XP) en ≈ 174. Elle **débloque des sorts** (ci-dessous) ; pas d'autre récompense pour l'instant. Affichée dans l'onglet Skills (niveau « SP lvl » et barre d'XP de chaque arbre), dans le lobby (« 🪜 Logisticien (SP lvl : 3) », aussi pour les membres du groupe) et au bilan (« XP de spé (Logisticien) +12 »).
- Affichage : carte « Mineur » du lobby et carte « Stats du mineur » de l'onglet Stuff (niveau, barre d'XP avec **pourcentage** et **XP / XP requise** pour le niveau suivant, points de talent ; « Niveau max » au dernier niveau) ; XP de la session pendant la partie ; XP gagnée et montée de niveau au bilan.
- Repères (simulation, mineur de base) : **≈ 860 XP par session en solo** (60 % minerais, 40 % bestioles) ; **≈ 740 par joueur à 3** (≈ 2220 au total) : les bestioles apparaissent au même rythme quelle que soit la taille de l'équipe, donc à 3 on se les partage. À surveiller : le jeu à 3 rapporte un peu moins d'XP par tête que le solo.

### Skills *(règles fermes ; valeurs provisoires, par rang)*
Trois arbres **en étages** (3 étages chacun ; 4 pour le Barbare depuis le 22/10, pour le Mineur et le Logisticien depuis le 23/10). Un étage peut avoir **plusieurs cases côte à côte** (Logisticien, étage 2). Une case de l'étage r > 1 exige qu'**au moins une case de l'étage d'avant** soit **au rang max** ; on peut prendre les deux cases d'un même étage. **Exception : l'étage 3 du Logisticien (Escalateur, avant Navette) exige les deux cases de l'étage 2** (Échelle de 2 **et** Treuil) *(23/10/2026, Geoffrey : tout logisticien qui atteint Mule, à l'étage 4, a donc le Treuil ; une ancienne sauvegarde avec une seule des deux perd l'étage 3 et récupère ses points)*. Dépenser un point dans un arbre **bloque les deux autres**. Bouton **Reset** : gratuit, rend tous les points, **refusé pendant une session**. Les skills sont **figés au lancement** de la session (comme le stuff) ; c'est le serveur qui les vérifie (jamais plus de rangs que de points).

| Arbre | Étape 1 | Étape 2 | Étape 3 |
|---|---|---|---|
| **Mineur** | 0/3 : vitesse de minage +2 % | 0/1 : miner un minerai rend **1 d'oxygène** (tout court, pas un % de l'oxygène max) | 0/5 : marche +3 % pendant 3 s après un minerai (ne se cumule pas, remis à 3 s) |
| **Logisticien** *(refait le 23/10/2026 au soir, Geoffrey)* | 0/3 **Navette** : marche +3 % quand il remonte à la surface (retour, jusqu'au coffre) ou redescend au front (rejoint son puits, descend par l'existant) | **deux cases côte à côte** : 0/1 **Échelle de 2** (échelle de 2 de haut au lieu de 1, si la case du dessus est vide) · 0/1 **Treuil** (ci-dessous) | 0/5 **Escalateur** : vitesse du seau du treuil +5 % par rang **pour tout le groupe** (plusieurs logisticiens : le meilleur rang compte, pas de cumul) |
| **Barbare** | 0/3 : dégâts +5 % **et ténacité +5 %** *(21/10)* **et dégâts de zone +2 %** *(23/10)* : chaque coup touche aussi les mobs à 1 case de sa cible (Manhattan, boss compris, jamais un mimic caché) pour 2 / 4 / 6 % de ses dégâts ; un mob tué ainsi est à lui (butin, XP) | 0/1 : **provocation** : le mob qu'il frappe (tous les mobs, mimic compris) lâche les autres mineurs et, jusqu'à sa mort, ne peut plus poursuivre ni tacler que lui ; chaque coup sur un occultiste qui canalise **interrompt** la canalisation, mais il peut en relancer une (sur le barbare : en 1 contre 1, le barbare peut être étourdi, sauf si sa ténacité joue) *(changé le 21/10)* | 0/5 : butin des mobs +3 % (chance d'un butin en plus, voir la stat Butin des mobs ; affiché dans les stats, 22/10) |

- **Barbare, Force brute : dégâts de zone** *(23/10/2026, Geoffrey ; valeur provisoire)* : **2 % du coup par rang** (6 % à 3/3) touchent aussi les mobs vivants **à 1 case** de la cible (boss compris, jamais un mimic caché), en mine et dans les tours ; un mob tué ainsi compte pour le mineur. **Affichage** *(24/10/2026, Geoffrey)* : un petit chiffre orange (« -0,3 ») monte et s'efface au-dessus de chaque mob touché par la zone. Repère : ≈ 1 coup sur 5 a un mob voisin.
- **Barbare, étage 4 : Braum** *(22/10/2026, Geoffrey ; valeur provisoire)* : 0/3, exige Pillage 5/5. Vitesse de **marche et de montée** (échelle **et seau du treuil**) **+10 % par rang** (+30 % à 3/3) quand il **va aider un allié** et pendant le combat qui suit : un mob qui a pris un allié en chasse (préférence « Aider allié »), le boss d'un donjon découvert, les mobs sortis d'un piège. Le bonus s'arrête dès qu'il reprend son travail. Pas de nouvelle stat : c'est un bonus de skill, comme Ruée et Navette.
- **Mineur, étage 4 : Légende de la flemme** *(23/10/2026, Geoffrey ; valeur provisoire)* : 0/1, exige Ruée 5/5 (donc 10 points, niveau 11). Quand le mineur doit remonter à la surface (oxygène, pods pleins, plus de torches, chute en rejoignant le coffre ; **pas en fin de session**), **5 % de chance** de se **téléporter au-dessus du coffre commun**, sur la surface : il dépose et repart comme après une remontée normale. **Un seul tirage par remontée**, au moment où il part : s'il est taclé ou étourdi, il finit d'abord (le tirage vient après). Mine classique seulement (la mine instantanée et les tours n'ont ni coffre commun ni remontée). Hasard à part (même seed, même résultat).

- **Logisticien refait** *(23/10/2026 au soir, Geoffrey)* : **Bâtisseur** (ancien étage 1, temps de construction −5 %/rang) est **supprimé** ; **Navette** passe à l'étage 1 (**max 3**, avant 5 à l'étage 3) ; nouvel étage 3 : **Escalateur**. Le chemin jusqu'à Mule coûte toujours 11 points. Les sauvegardes de l'ancien arbre gardent ce qui tient encore (Navette ramenée à 3, Échelle de 2, Treuil) ; le reste (Bâtisseur, Navette au-delà de 3, Mule faute d'Escalateur) est rendu en points, à redépenser.
- **Logisticien, étage 4 : Mule** *(23/10/2026, Geoffrey ; capacité provisoire ; spec `docs/superpowers/specs/2026-10-23-mule-design.md`, `MULE` en config)* : 0/1, exige Escalateur 5/5 (donc le Treuil ; avant : Navette 5/5). Mine classique uniquement.
  - **Le sac** : quand le logisticien finit de poser ou de prolonger le treuil, il mine la case **à droite du bas du treuil** (à gauche si elle est incassable) et y pose un **sac** : pas de collision (on passe à travers), pas de gravité, ignoré des mobs, avec une **jauge de remplissage** au-dessus. Un seul sac par partie ; sa **capacité** = **2 × la somme des pods réels** des logisticiens présents qui ont Mule (un logisticien de base : 400).
  - **Dépôt** : tout le monde peut y déposer, logisticien compris, **tous les objets**. Un mineur qui doit remonter **parce que ses pods sont pleins** va au sac s'il est **plus près (en temps) que le coffre** et qu'il y reste de la place pour ce qu'il porte ; dépôt **partiel** (il garde ce qui ne tient pas). S'il a de nouveau de la place, il reprend son travail, sinon il remonte. Un sac plein est ignoré.
  - **Vidage** *(décision de Geoffrey : seulement dans ces cas, même plein entre-temps)* : à la **prolongation** du treuil, le logisticien repasse par son sac s'il est sur son chemin (au plus 10 couches sous lui ; sinon il le reprend en redescendant par le puits, sans le vider), le **vide au coffre** et le repose en bas du nouveau treuil ; en **fin de session**, sa **dernière remontée qui lui laisse le temps** de récupérer le sac passe par lui (son temps de retour compte ce détour ; remonté à la surface sans lui, il redescend le chercher s'il a encore le temps). Pendant le transport, le contenu **ne pèse rien** pour lui. Sac pas rapporté à la fin : **perdu** (affiché au bilan, comme ce que portent les mineurs).
  - **Bilan** : chaque objet du sac compte pour le mineur qui l'a déposé (détail « déposé par joueur »).
  - **Départ** : si le logisticien quitte la session, le contenu du sac part **dans le coffre commun** (avant la coupure du partage anti-boosting) et le sac disparaît ; s'il reste un logisticien avec Mule, il posera un nouveau sac à la prochaine prolongation.
  - **Treuil** : quand une area se débloque, c'est le porteur du sac qui prolonge le treuil, sinon le premier logisticien qui a Mule, sinon le premier qui a le Treuil.
  - Repère : voir `docs/debug.md` (entrée Mule).

- **Affichage** *(décision ferme)* : dans l'onglet Skills, chaque arbre est dessiné comme un **arbre de compétences de RPG** : une case ronde (icône, rang « 0/3 », nom) par skill, reliée par des **lignes** aux cases de l'étage d'avant. La ligne s'allume (dorée) quand la case du dessus est au max ; une case qu'on peut apprendre brille et porte un « + » (clic = un rang) ; une case verrouillée est grisée. Survoler (ou toucher) une case affiche sa description, son rang et ce qui la bloque.
- Noms des cases : Mineur = Pioche aiguisée, Second souffle, Ruée, Légende de la flemme ; Logisticien = Navette, Échelle de 2, Treuil, Escalateur, Mule ; Barbare = Force brute, Provocation, Pillage, Braum.
- **Les pourcentages des skills sont des multiplicateurs** *(décision ferme)* : ils s'appliquent après le stuff. Vitesse de minage = (base + stuff) × (1 + 2 % par rang) ; ex. pioche en fer et 3 rangs : (1 + 0,2) × 1,06 = 1,27. Idem pour les dégâts (+5 %/rang) et les vitesses de marche (+3 %/rang).
- « Vitesse de marche » = vitesse horizontale seulement (pas l'échelle) *(décision ferme)*.
- **Échelle de 2** : quand il monte en posant une échelle, il en pose 2 cases si celle du dessus est vide ; l'IA en tient compte dans ses itinéraires (en moyenne moitié moins d'échelles à poser).
- **Treuil** *(décision ferme ; vitesse provisoire)* : une sorte d'ascenseur, un seau en bois tiré par une poulie.
  - **Pose** : quand une nouvelle area est débloquée, le logisticien qui a le skill **Treuil** (le premier s'il y en a plusieurs ; de préférence celui qui porte le sac de la Mule) arrête ce qu'il fait, remonte à la surface (dépôt, oxygène), va **au milieu de la mine** (x = 25) et creuse tout droit vers le bas. Arrivé au **haut de la nouvelle area**, il pose **tout le treuil d'un coup**, de la surface jusque-là, et **retire les échelles** qui se trouvaient dans le puits (le treuil occupe toute la colonne ; plus personne n'y pose d'échelle, même la 2e case d'une échelle de 2). Pendant ce chantier il n'est **jamais étourdi** et peut tomber de plus de 3 cases dans son puits. S'il doit remonter (oxygène, pods, torches, fin de session), il reprend le chantier ensuite.
  - **Prolongement** : à l'area suivante, il redescend par le treuil et prolonge le **même puits**.
  - **Dans les tours** *(25/10/2026)* : un treuil contre le mur extérieur, posé à sa première chute au pied de la tour (voir Tours de l'Ange et du Démon).
  - **Utilisation** : tous les mineurs, en même temps, sans attente, **dans les deux sens**, à **0,85 × leur vitesse de montée** (stuff compris). *(22/10/2026 : ×2 essayé quelques heures pour que l'IA ne sorte plus du seau, refusé avec Geoffrey : la vitesse ne change pas.)* On peut s'arrêter à **n'importe quelle ligne** du puits pour miner à gauche ou à droite. Les itinéraires de l'IA le prennent en compte (pas d'échelle à poser, chemin tout droit).
  - **Départ du coffre** *(21/10, élargi le 22/10)* : s'il existe une descente (treuil ou puits déjà creusé) qui vaut mieux qu'un puits neuf, le mineur la prend directement au lieu de rejoindre d'abord sa colonne (voir « descente commune », §multijoueur). Il choisit le trajet le plus rapide : le seau (0,85×) étant plus lent qu'une échelle déjà posée, un mineur qui a ses échelles jusqu'à son chantier peut les préférer.
  - Repère (simulation, 3 logisticiens complets × 5 sessions) : profondeur 207 (186 sans skills), ≈ 15 min par mineur et par session dans le seau. À noter : le seau (0,85×) est plus lent qu'une échelle déjà posée ; il fait gagner du temps parce qu'il évite les échelles à poser et les détours. L'IA peut donc en sortir pour une colonne d'échelles ou un trou à côté.
- Provocation : un mineur taclé par ce mob est libéré tout de suite et reprend son travail (même s'il est réglé sur « Ignorer les mobs »).
- **Échelles au retour** *(décision ferme)* : quand plusieurs mineurs remontent au même endroit, c'est le **logisticien** qui pose les échelles. Un autre mineur qui devrait en poser une attend s'il y a un logisticien qui remonte à moins de 5 cases, en dessous de lui ou à sa hauteur ; au-delà de 4 s d'attente, il la pose lui-même (jamais bloqué).
- Repère (simulation, 3 mineurs × 5 sessions, un arbre complet chacun) : areas 3,6 → 4,0, profondeur 186 → 196.

### Sorts *(24/10/2026, Geoffrey ; valeurs provisoires, `SPELLS` en config)*
Onglet **Sorts** : **4 emplacements**, dont **2 ouverts** ; les 2 autres sont **verrouillés** (cadenas) en attendant une règle de déblocage. À droite, **tous les sorts** : un sort disponible s'équipe d'un **clic** (premier emplacement libre, sinon celui choisi) ou en le **glissant** sur un emplacement ; clic sur un sort équipé = le retirer. Un sort **verrouillé** est grisé avec un cadenas, son nom et sa condition visibles, pas sélectionnable.
- **Déblocage** : soit un **niveau de spécialisation** (sorts de classe), soit un **parchemin appris** dans l'onglet Sorts (bouton « Apprendre » quand on l'a : le parchemin est **consommé**, le sort reste acquis pour toujours ; un parchemin d'un sort déjà appris est gardé). **Pas encore de source de parchemins** (à décider ; on peut s'en donner avec l'outil d'administration).
- **Prérequis** : un sort de classe ne s'équipe qu'avec cette **spécialisation** (arbre de skills choisi). Après un reset des skills, il reste dans son emplacement mais **n'agit pas** (signalé en rouge).
- **En session** : les sorts équipés sont **figés au lancement** (comme les skills, vérifiés par le serveur). Chacun part **tout seul dès que sa recharge est finie**, mais **seulement s'il peut servir** ; sinon il reste prêt. Tous sont prêts au début de la session. Une **barre des sorts** en bas de la mine montre les sorts du mineur suivi, avec les **secondes restantes** sur un sort en recharge.

| Sort | Déblocage | Prérequis | Effet | Recharge |
|---|---|---|---|---|
| **Dash** | Barbare, spé niv. 5 | Barbare | Une course de **6 cases au plus**, à **600 %** de sa vitesse, qui **suit le terrain** *(25/10/2026, Geoffrey ; avant : ligne droite)* : il marche, descend (une marche en simple trajet, une chute de 3 cases au plus vers un mob) et **saute** un bloc qui lui barre la route. **En route vers un mob** (combat, aide, boss du donjon) : il le garde tant que le mob n'est pas à portée, puis fonce au contact ; un mob qui **tacle un allié** passe en priorité. En simple trajet : s'arrête devant ce qu'il ne franchit pas, au pied d'une échelle qui monte ou juste avant le minerai visé ; 2 cases au moins. Mob heurté : **500 % de ses dégâts**, recharge **divisée par 2**, son sort en cours est **coupé** (canalisation de l'occultiste) et il est **étourdi 2 s** (il lâche son tacle, boss compris). | 30 s |
| **Illumination** | Mineur, spé niv. 5 | Mineur | Révèle tous les blocs dans un **rayon de 5** (cercle) ; part dès qu'il y reste un bloc inconnu (pas l'intérieur d'un piège). | 90 s |
| **Inspiration** | Logisticien, spé niv. 5 | Logisticien | **Tous les mineurs** minent **10 % plus vite** pendant **60 s** ; la recharge commence **à la fin de l'effet**. Plusieurs logisticiens : pas de cumul, le suivant attend la fin de l'effet (ils s'enchaînent). | 180 s |
| **Ulti shen** | Parchemin « Ulti shen » | aucun | Quand **un autre mineur** du groupe se bat (il frappe un mob ou se fait tacler) : se **téléporte sur sa case**, inflige **20 % des PV max** du mob (**5 % sur un boss** : minotaure, Gallianix), puis se bat avec lui. Inutile en solo. Pas pendant un chantier de treuil, la Mule, une chute ou un étourdissement ; jamais dans un donjon où il n'a pas le droit d'entrer. | 180 s |
| **Fast learner** | Parchemin « Fast learner » | aucun | Le prochain bloc **miné** (pas la terre ni un trésor, qui ne consomment pas le sort) est « appris » : ce type de bloc se mine **10 % plus vite** jusqu'à la fin de la session, **cumulable** ; la recharge commence une fois le bloc appris. | 300 s |
| **Dynamite** | Mineur, spé niv. 10 | Mineur | Au lieu d'un coup de pioche, il lance une dynamite dans le sens du coup (2 cases au plus, s'arrête au premier bloc) ; elle casse **tous les blocs minables** dans un **rayon de 2** comme s'il les minait (butin, fortune, shiny, XP, déblocage de l'area, trésors). Jamais une construction (échelle, passerelle), l'incassable, un mimic caché, ni le **bloc sous les pieds d'un mineur**. Ne part que si elle casse au moins 2 blocs. | 150 s |

- **À surveiller** : Fast learner se cumule sans limite (au plus ≈ 12 fois par session) et finit presque toujours sur la pierre ; à mesurer.

### Oxygène
- 1 seconde dans la mine = 1 d'oxygène consommé.
- En surface : +30 par seconde.
- **Quand l'oxygène atteint 0, le mineur remonte** (il termine l'action en cours, puis part). Il n'anticipe pas le trajet de retour.
- **Il n'a pas besoin d'oxygène pour remonter** : à 0, il n'est ni mort ni ralenti, la remontée se fait à vitesse normale. L'oxygène mesure donc exactement son temps de travail sous terre.

### Pods (inventaire)
- Chaque bloc a un poids (terre 1, pierre 2, pierre dure 3, charbon 2, fer 3, or 3 *(25/10/2026 ; avant 4)*, diamant 5, Treasure TX 2 *(provisoire)*).
- Inventaire plein : remontée **automatique**, dépôt dans le coffre, puis retour au front.

### Valeur des stats : unité x *(méthode ferme, chiffres provisoires)*
Toutes les stats se comparent dans une seule unité : **x = 1 seconde de travail du mineur**. Une session vaut 3 600 x.
- Chaque stat gouverne un temps de la session (T_stat) : la vitesse de minage gouverne le temps de minage, les pods le temps des allers-retours qu'ils déclenchent, etc.
- **Un bonus b sur une stat de base B fait gagner T_stat × b / (B + b) x par session** (rendements décroissants : doubler une stat divise son temps par 2, pas plus). C'est l'**utilité réelle** (elle baisse quand la stat monte) ; le **prix** d'un point, lui, est linéaire et figé (catalogue ci-dessous).
- Les ressources se convertissent par le rendement du mineur de base : 522 points de valeur par session, soit **1 charbon ≈ 7 x**, 1 fer ≈ 14 x, 1 or ≈ 28 x, 1 diamant ≈ 55 x.
- Les valeurs dépendent du niveau du mineur (ex. : quand les pods augmentent, l'oxygène redevient limitant et prend de la valeur) : à recalculer par palier. Outil : `node scripts/stat-values.js`.

**Catalogue de prix** (figé le 20/10, mineur de base) : le **prix d'un point** est linéaire (comme le gold d'un item de LoL : +0,1 coûte toujours le dixième de +1), pris à T_stat / B.

| Stat | Base | Prix d'un point | Exemple |
|---|---|---|---|
| Vitesse de minage | 1 | 1 300 x | +0,4 = 520 x (Pioche en fer, 25/10 ; 24/10 : +0,5 = 650 x) |
| Vitesse (marche) | 3 | 240 x | +1,05 = 252 x (Bottes en fer, 24/10 ; avant +0,6 = 144 x) |
| Vitesse de montée | 2,25 | 250 x | +1,05 = 262,5 x (Jambes en fer, 24/10 ; avant +0,6 = 150 x) |
| Pods | 200 | 6 x *(prix « comme frein »)* | +88 = 528 x (Plastron en fer, 24/10 ; avant +50, et +33 avant le 23/10) |
| Oxygène | 300 | 4 x *(prix « comme frein »)* | +67 = 268 x (Casque en fer, 24/10 ; avant +38 = 152 x) |
| Dégâts | 5 | 40 x | 14 au lieu de 5 = 360 x (Épée en fer, 24/10 ; avant 11 = 240 x) ; 8 = 120 x (Épée en pierre) |
| Vitesse d'attaque | 100 % | **1,96 x par %** (196 s de combat / 100) | +20 % ≈ 39 x (Gants tactique) |
| Fortune | 0 % | **36 x par %** (1 % de minerai en plus = 1 % de 3 600 x) | +5 % = 180 x (Gants d'ouvrier) |
| Rayon des torches | 5 | 27 x | – |
| Découverte | 2 | ≈ 190 x *(estimation, effet indirect)* | +1 = Cape de Naingui |
| Vision, boussole, torches (passerelles : illimitées) | – | ≈ 0 (effet indirect ou trop faible) | – |

**Stats d'amélioration** *(21/10/2026)* :

| Stat | Prix d'un point | D'où vient le prix |
|---|---|---|
| Vitesse de minage % | 13 x par % | 1 % de la vitesse de base (1 300 / 100) ; mesuré : ≈ 11 x à +50 % (rendements décroissants) |
| Dégâts % | 2 x par % | 1 % des 5 dégâts de base (40 × 5 / 100) |
| Critique | 13 x par % | décision du créateur : 130 x (une pioche en pierre) = 10 % |
| Coup unique | 13 x par % | mesuré (24 sessions solo) : ≈ 17 x par % à +50 %, autant que la vitesse de minage % à petite dose |
| Perçage | 7 x par % | mesuré : ≈ 6,8 x par % à +50 % (les blocs percés sont surtout de la pierre, qui remplit le sac) |
| Butin des mobs | 10 x par % *(22/10, décision du créateur : 100 x = +10 %)* | mesuré : +50 % donne +61 % de butin de mobs, mais rien sur les minerais |

*Mesures bruitées : d'une seed à l'autre, la même partie diverge de ± 25 % ; d'où un gros bonus (+50 %) et 24 sessions.*

*Fortune : valeur calculée sans le coût en pods des doublons (un minerai en plus pèse dans le sac).* *Vitesse d'attaque : le temps de combat n'est que de ≈ 196 s par session, donc le gain réel plafonne bien en dessous du prix linéaire.* Les T_stat se remesurent avec `node scripts/stat-values.js` (≈ 1 min).

## 4. Outils

| Outil | Effet |
|---|---|
| **Pioche** | Mine les blocs ; temps de minage = dureté du bloc / vitesse de minage |
| **Boussole** | Indique les minerais sur la **ligne du mineur** (horizontalement) : pousse à creuser des galeries plutôt que dans tous les sens |
| **Torches** | Éclairage des cases creusées (luminosité). La luminosité fait varier la zone de découverte et la distance de détection des mobs |
| **Échelles / fondations** | Déplacement vertical ; fondation pour boucher un trou |
| **Épée** | Combat contre les mobs hostiles |

### Boussole
Portée de 8 blocs horizontalement *(provisoire)*, **uniquement sur la ligne où se trouve le mineur** (aucune info sur les lignes au-dessus ou en dessous).
- **Boussole en or** (case boussole) : la boussole voit aussi **1 ligne au-dessus et 1 ligne en dessous** (stat « Lignes boussole », 0 de base). Mesuré (21/10/2026, 8 sessions solo, mêmes seeds) : **≈ +300 x** par session, meilleure sur 7 seeds sur 8 ; 2 lignes n'apportent presque rien de plus (+330 x). Plus de portée, au contraire, est légèrement négatif (≈ −200 x à 12 ou 16 : le mineur part trop loin en galerie). Sans boussole : ≈ −1 400 x.

### Luminosité, torches et découverte
- La **luminosité** est une valeur de 0 à 1 à la position du mineur. En surface (le jour) elle vaut 1 ; sous terre elle vient uniquement des torches posées.
- **Torche** : éclaire dans un rayon de **5 blocs creusés** (la lumière se propage de case vide en case vide, **jamais à travers les murs**). L'intensité baisse avec la distance à la torche. **Les torches sont infinies** (pas de durée) et restent posées dans la mine.
- **Pose automatique** : le mineur pose une torche quand la luminosité tombe **sous 33 %**. Le mineur porte **20 torches maximum** ; rechargées gratuitement en surface. **À 0 torche, il remonte à la surface.**
- **Côté minage, l'IA ne peut viser que deux sortes de minerais** : ceux révélés par la découverte du mineur, et ceux signalés par la boussole (sur sa ligne). Aucun autre minerai ne l'influence.
- **Découverte** (révéler des blocs) : seul le mineur découvre des blocs, dans une zone autour de lui de rayon `discover max = 2 blocs` dans tous les axes, **multipliée par la luminosité** (de 0 à discover max). **Une torche ne découvre aucun bloc par elle-même.**
- **Sans lumière** (luminosité < 10 %) : boussole 2 fois moins précise, vitesse et vitesse de minage réduites (×0,65 dans le prototype).

*(À confirmer : « seul le jour découvre des blocs » a été compris comme « seul le mineur découvre des blocs ».)*

## 5. Ennemis et combat

- Quand un mob **entre dans le champ de vision** du mineur, un **trigger** se déclenche et il l'attaque.
- **Pas de points de vie pour le joueur** : uniquement des dégâts contre les PV du mob.
- Le but du combat est de **ralentir la progression**, pas de tuer le joueur.
- Combat automatique ; les dégâts sont une simple stat.
- **Engagement** : une fois le combat déclenché, le mineur poursuit le mob même s'il sort de son champ de vision. Il abandonne si le mob s'éloigne de plus de 10 blocs, et l'ignore s'il ne l'a pas touché depuis 15 s (mob inatteignable) *(provisoire)*.
- **Combat dynamique : portée et recul** *(25/10/2026, Geoffrey ; valeurs provisoires dans `COMBAT`)* :
  - **Portée d'attaque 0,5** : une entité frappe (ou tacle) une autre dès que l'**écart entre leurs bords** est de 0,5 bloc ou moins (au contact, l'écart vaut 0). Jamais en diagonale, jamais à travers un bloc.
  - **Recul** : chaque coup repousse la cible sur l'**axe du coup** (horizontal si même ligne, vertical si même colonne). Le mineur repousse de **0,25 bloc** ; les mobs repoussent de **0** par défaut, sauf le **minotaure** (0,25), les **Séraphins / Diablotins** et le **boss des tours** (0,25). La cible garde un petit décalage dans sa case ; au-delà d'une demi-case, elle passe sur la case voisine. **Contre un bloc, elle reste sur place.** Poussée vers le haut hors d'une échelle, elle retombe. Un pas la recentre.
  - Après un recul, les deux combattants **reviennent au corps à corps** (le mob marche vers sa cible, le mineur se recentre ou avance).
  - **Mouvement continu** *(25/10/2026, Geoffrey)* : sur sa ligne, un mob **glisse** vers sa cible (à sa vitesse, 1,1 bloc/s de base) au lieu de sauter de case en case ; il est vraiment entre deux cases pendant qu'il avance et s'arrête au contact. Un mineur en plein pas est, pour la portée, là où il en est de son pas ; un pas interrompu garde son avancée. Les échelles, les chutes et les mobs volants (sauf leur retour au contact) restent case par case ; les tours aussi, pour l'instant.
  - **Coup immédiat et arrêt net** *(25/10/2026)* : à portée, le coup du mineur **part tout de suite**, puis il attend son intervalle avant le suivant (avant : le coup partait à la fin de l'élan). En marche vers le mob qu'il combat, il **s'arrête dès que ce mob entre dans sa portée**, pour frapper le premier.
  - **Le recul casse le tacle** *(25/10/2026, Geoffrey)* : un coup qui repousse un mob **au-delà de sa portée de tacle** (0,5) lui fait lâcher le mineur ; il doit revenir pour le reprendre. **Verrou** : un mob repoussé ne peut plus l'être tant qu'il n'est pas revenu à portée de tacle (les coups font leurs dégâts, sans recul). Le mineur ne peut donc **jamais repousser un mob en boucle**, quelle que soit sa vitesse d'attaque : le mob revient le tacler à chaque cycle.
  - **Portée d'attaque** et **Recul** du mineur : stats en blocs, **0 de base**, ajoutées à la portée (0,5) et au recul (0,25). La Lance en fer les donne.
  - **Coups des mobs** : un mob qui tacle frappe sa cible toutes les **1 s** (à portée) ; son coup, c'est sa poussée (0 pour la plupart) et son effet, qui garde sa propre cadence : vol du gobelin (2 s), asphyxie du méphite (2 s), sort de l'occultiste (15 s).
  - **Résistance au recul** : nouvelle stat du mineur, en %, **0 de base** : recul subi × (1 − résistance). Aucune pièce ni skill ne la donne pour l'instant *(décision du 25/10)*.
- **Tacle (tous les mobs)** *(refonte du 25/10/2026, Geoffrey ; avant : immobilisé, à 1 case)* : un mob **à portée d'attaque** du mineur qu'il vise le tacle. Le mineur taclé **peut bouger, mais seulement pour combattre ce mob** (une sorte de provocation) : son action en cours est interrompue (sauf une chute), il ne mine plus, ne remonte plus, ne va plus aider, même réglé sur « Ignorer les mobs ». Le tacle dure **jusqu'à la mort du mob, jusqu'à ce qu'un barbare le provoque, ou jusqu'à ce qu'un coup le repousse hors de sa portée** *(25/10/2026 ; avant : même repoussé hors de portée)* ; s'il s'éloigne sans être frappé, il le garde ; le vol du gobelin et l'asphyxie du méphite continuent tant qu'il dure. **Soupape** *(choix de Claude validé le 25/10, provisoire)* : le tacle saute si le mineur n'a pas pu frapper ce mob depuis **5 s**, ou si le mob est à plus de **6 cases** (mob inatteignable, mineur téléporté par l'effroi…). **Un mob ne tacle qu'un seul mineur.** Un mob ne monte jamais sur la case de sa cible.
- **PV des mobs** *(décision du créateur, 21/10 ; k = area où le mob naît)* :
  | Mob | PV | Première area |
  |---|---|---|
  | Bestiole | 50 × 1,15^k | 0 |
  | Mimic | 50 × 1,15^k | 0 |
  | Gobelin | 100 × 1,15^(k − 1) | 1 |
  | Occultiste | **150** × 1,15^(k − 4) *(23/10 ; avant 100)* | 4 |
  | Méphite *(24/10)* | 70 × 1,15^(k − 3) | 3 |
  Repères (mineur de base : 5 dégâts, un coup toutes les 0,8 s) : bestiole 10 coups en area 0, 16 en area 3 ; gobelin 20 coups en area 1, 35 en area 5 ; occultiste 30 à 35 coups ; mimic 10 à 21 coups.
- **Apparitions** *(décision du créateur, 21/10)* : une tentative toutes les (40 à 70 s) ÷ (1 + 0,15 × dernière area débloquée), première à 25 s, autour des mineurs sous terre chacun son tour. Le type est tiré selon l'**area du mineur visé** :
  | Area | Bestiole | Gobelin | Occultiste | Méphite | Mimic |
  |---|---|---|---|---|---|
  | 0 | 80 % | – | – | – | 20 % |
  | 1 | 60 % | 20 % | – | – | 20 % |
  | 2 | 40 % | 40 % | – | – | 20 % |
  | 3 | 20 % | 55 % | – | 5 % | 20 % |
  | 4 | – | 55 % | 10 % | 15 % | 20 % |
  | 5 et plus | – | 30 % | 30 % | 20 % | 20 % |
  *(24/10 : méphite ajouté, pris sur le gobelin ; avant gobelin 60 / 70 / 50 % en areas 3 / 4 / 5)*
  Les mobs qui marchent naissent au sol (le méphite, qui vole, aussi en l'air) dans une galerie déjà découverte, à 5 à 10 cases du mineur visé, dans une area où leur type peut naître ; au plus 2 + (dernière area débloquée) en vie en même temps (les mimics ne comptent pas). Les **mimics** naissent autrement : **un minerai de la roche** à 5 à 10 cases du mineur devient un mimic caché (pas un minerai visé ou en train d'être miné). Ils ne sont plus placés à la génération des areas.
- Types :
  - **Bestioles** : se rapprochent du mineur. **Elles suivent la même physique que le mineur** : gravité, pas de saut, montée uniquement par une échelle (×0,75), descente par l'échelle ou en se laissant tomber. Elles ne creusent pas et ne posent rien. Butin : **chitine** (1 à 2, poids 1).
  - **Gobelins** : même physique et même tacle que les bestioles.
    - **Vol** : toutes les **2 secondes** de tacle, le gobelin vole **un minerai** (bloc de type ore : charbon, fer, or, diamant) tiré au hasard dans l'inventaire du mineur taclé, chaque unité ayant la même chance. Le minerai volé est **perdu**. Il ne vole ni terre, ni pierre, ni butin de mob, ni shiny, ni Treasure TX. Chaque vol peut être ignoré par la **ténacité** du mineur *(21/10)*.
    - **Butin** : **peau de gobelin** (1 à 2, poids 1) et **chitine** (1).
    - Intention : un mineur qui tue vite perd peu ; c'est une raison concrète d'améliorer ses dégâts pour les areas profondes.
  - **Mimics** : faux minerais, visibles à la boussole comme des minerais. Ils se dévoilent à 2,3 cases ou quand le mineur essaie de les miner. **Un mimic se combat, il ne se mine pas** : dévoilé, sa case n'est plus un minerai pour l'IA (ni cible, ni bloc à creuser). Il **tacle** le mineur à côté de lui. Butin : 3 minerais du type imité (ni shiny ni Fortune).
  - **Occultiste** *(21/10)* : mage noir humain terré sous terre, à partir de l'**area 4**. Même physique et même tacle que les bestioles. **Sort** : prêt toutes les **15 s** (la première fois 15 s après son apparition). Quand il est prêt, l'occultiste **se téléporte à 3 cases** (Manhattan) de sa cible, sur une case vide où l'on tient et qu'on rejoint depuis la cible sans miner (à défaut à 4, puis à 2 ; jamais au contact : il ne lance pas son sort au corps à corps), puis **canalise** un rayon de lumière noire : la cible est **étourdie 5 s** (elle ne fait plus rien, même pas frapper). Pendant la canalisation, il ne bouge pas et ne tacle pas. **Frappé par un barbare qui a la Provocation**, il arrête tout de suite sa canalisation (la cible est libérée) ; il peut relancer son sort quand il est prêt (sur le barbare, sa seule cible) *(21/10 ; avant : il ne lançait plus jamais son sort)*. **La provocation casse la canalisation, elle ne l'empêche pas** : un barbare peut se faire étourdir (vérifié le 23/10 : en 60 s de vrai combat, l'occultiste provoqué lance son sort au moins 3 fois, dont au moins 2 sur le barbare). La **ténacité** de la cible peut ignorer la canalisation. Butin : **Tissu sombre** (1 à 3) et **Chitine** (1 à 2) *(chitine ajoutée le 24/10)*. XP 15 *(provisoire)*.
  - **Méphite** *(24/10/2026, Geoffrey)* : masse de gaz verdâtre, ronde et flasque, deux yeux jaunes, traînée de volutes ; à partir de l'**area 3**, fragile (**70 PV** en area 3, +15 % par area). Il **vole** *(décision du créateur)* : pas de gravité, il se déplace dans les 4 directions par les **cases vides**, sans échelle (il rejoint un mineur en haut d'un puits, là où une bestiole reste en bas) ; il prend le plus court chemin par le vide jusqu'à une case voisine de sa cible, n'entre pas dans un donjon ni dans un piège encore caché. Même tacle que les autres. **Asphyxie** : tant qu'il tacle un mineur, celui-ci perd **5 d'oxygène toutes les 2 s** (en plus de sa respiration ; jamais sous 0). **Non cumulable** : plusieurs méphites sur le même mineur = toujours −5 toutes les 2 s. Chaque perte est ignorable par la **ténacité**. Il peut sortir d'un **piège** (areas 3 et plus). Butin : **Vésicule de gaz** (1 à 2, matériau, sans usage pour l’instant). XP **12** *(provisoire : entre le gobelin, 10, et l’occultiste, 15 ; mesuré ≈ 25 s perdues par rencontre en stuff fer, combat + oxygène)*. Difficulté ≈ **6/10**.
  - **Gallianix** *(23/10/2026, Geoffrey)* : canard jaune qui sautille **à la surface**, autour du coffre (8 cases au plus de la colonne du coffre). **Un Gallianix naît à chaque area débloquée pendant la session** (pas au lancement, pour l'area 0), sur une case de la surface qui a du sol. Il se promène au hasard, lentement ; il **ne tombe jamais dans la mine** : il saute par-dessus un trou de 3 cases au plus, sinon il fait demi-tour ; si les mineurs creusent sous lui, il s'envole vers le sol le plus proche *(choix de Claude)*. Il **ne tacle pas** et ne chasse personne. **50 PV** (fixes). Il a un **pseudo** affiché au-dessus de lui comme un joueur (en jaune) : 1er canard de la session = 1er nom de la liste « Cuiseuse de sperme », « Roxanne », « La brésilienne », « La thaïlandaise », 2e canard = 2e nom, etc., puis on recommence au 1er. Les mineurs le combattent comme les autres mobs (réglage « combat »). **À chaque passage au coffre** (pas seulement en fin de session), une fois son sac vidé, un mineur va chasser le Gallianix le plus proche avant de repartir (réglage « combat » sur Combattre), s'il a le temps de revenir au coffre ensuite (aller-retour + 20 s *(provisoire)*) et sans traverser de trou *(23/10/2026, Geoffrey ; à chaque passage depuis le 24/10 : en fin de session seulement, les mineurs encore en remontée laissaient les canards en vie, seed 87312228)*. Butin : **1 Fragment de cœur** avec **25 %** de chance (sans Pillage), dans le sac du mineur, donc au **coffre commun** (partagé comme le reste). XP 5 *(provisoire, choix de Claude)*. Hors des tirages d'apparition et du maximum de mobs. Repère (simulation à 3, 5 parties) : 3 canards par session, ≈ 2 vaincus, ≈ 130 s de combat cumulées pour les 3 mineurs, profondeur moyenne 192 → 182.
- **Donjon** *(décisions du créateur, 21/10/2026 ; valeurs provisoires, `DUNGEON` en config)* :
  - **Où** : **areas 4 et 5**, **33 %** de chance dans chacune, tirées indépendamment (décision du 22/10/2026, Geoffrey ; avant : 100 % en areas 4 et 5 quelques heures, encore avant : area 5 seulement, 20 %). Tirage à part de la seed : le reste de l'area ne change pas ; une partie peut avoir deux donjons. Un carré de **10 × 10** : murs en **briques de donjon** (pierre taillée violet sombre) **incassables**, intérieur vide, **une seule entrée** (une brique manquante) dans le mur de gauche ou de droite, sur l'une des 3 lignes du bas de l'intérieur (on y entre en marchant, chute de 2 cases au plus). Jamais à moins de 2 cases d'un bord de la mine ou d'une limite d'area (l'entrée ne donne jamais sur un bord), jamais sur la colonne du treuil ± 5. Les blocs qu'il remplace sortent des comptes de l'area (déblocage, focus).
  - **Minotaure** (boss) : mi-homme mi-taureau, debout. **1 000 PV**, ne fait que **tacler** (rien de spécial), **100 XP**. **Enfermé** : il ne sort jamais de sa salle et ne vise que les mineurs qui y sont (intérieur ou entrée). Aucun autre mob n'apparaît dans un donjon.
  - **Butin** : **1 à 3 Cristaux de pleine lune** (rareté rare, Pillage compris), **pas partagés** : comme les Treasure TX, chaque joueur présent à la fin en reçoit la quantité entière.
  - **Déclencheur** : un mineur **découvre** un bloc de la structure (mur, entrée ou intérieur). Avant, personne ne sait qu'il est là.
  - **Révélé en entier** *(23/10/2026 au soir, Geoffrey)* : dès qu'un mineur **entre** dans le donjon, toute la structure (murs, intérieur, boss) est découverte d'un coup. **Le seuil (l'entrée) compte, et combattre le minotaure aussi** *(25/10/2026, Geoffrey ; avant : l'intérieur seulement, et un combat au seuil, boss contre l'entrée, laissait la salle noire)*.
  - **Avec un barbare dans la partie** (un joueur qui a choisi l'arbre Barbare) : tous les mineurs vont à l'entrée (en creusant autour des murs s'il le faut) et **attendent devant**, sans entrer. Le **barbare entre le premier** (aucune restriction, même réglé sur Ignorer ou Fuir) et va combattre le minotaure. Une fois le barbare entré, les autres entrent l'aider, **sauf ceux réglés sur « Fuir »**, qui reprennent leur travail. **Tant que le boss vit, ce rôle (aller au donjon, attendre le barbare, le rejoindre, combattre) passe avant l'oxygène, les pods pleins et les torches** *(25/10/2026, Geoffrey ; avant : toutes les raisons de remonter passaient avant)* : le barbare va au boss même à 0 d'oxygène. **Seule la fin de session passe avant.** Ne comptent pas : sortir du donjon (effrayé, ou entré sans en avoir le droit) et les « Fuir » une fois le barbare entré, qui remontent normalement. Un mineur **déjà en train de remonter** (ou de recharger en surface) quand le donjon est découvert finit sa remontée. Le boss mort, chacun remonte pour ce qui lui manque.
  - **Sans barbare** : personne n'y entre (aucun itinéraire n'y passe), chacun mine comme d'habitude. Un mineur qui s'y retrouve quand même (avant de l'avoir vu, par exemple) est **effrayé 15 s** : si le minotaure le tacle pendant ce temps, il est **téléporté à la surface** (il garde son sac). Après les 15 s, il ressort seul ; s'il est taclé, il se bat (le tacle oblige).
  - Le minotaure vaincu, le donjon est libre : tout le monde peut y passer.
- **Piège** *(décisions du créateur, 22/10/2026 ; valeurs provisoires, `TRAP` en config)* :
  - **Où** : à partir de l'**area 1**, **2 tirages indépendants de 25 %** par area (0 piège 56 %, 1 piège 38 %, 2 pièges 6 % ; 0,5 en moyenne). Tirage à part de la seed : le reste de l'area ne change pas. Jamais à moins de 2 cases d'un bord de la mine ou d'une limite d'area, jamais sur la colonne du treuil ± 2, jamais contre un donjon ou un autre piège. Les blocs de la salle sortent des comptes de l'area (déblocage, focus).
  - **Forme** : une salle **vide de 5 × 3**, entourée d'une paroi d'une case faite des **blocs normaux de l'area** (même répartition, minerais compris : rien ne la distingue de la roche ; une poche d'air dans la paroi est bouchée par le terrain principal).
  - **Caché** : l'**intérieur** reste non découvert (la découverte du mineur l'ignore) tant que le piège n'est pas déclenché ; la paroi se découvre normalement.
  - **Déclencheur** : un **bloc de la paroi disparaît** (miné, ou mimic tué). Tout le piège se dévoile ; **5 mobs** sortent, tirés dans la table d'apparition de l'area **sans mimic**, avec **PV × 1,5** et **vitesse × 1,5**. Ils chassent le mineur le plus proche du trou, **sans limite de distance** (les autres mobs lâchent au-delà de 14 cases).
  - **Physique normale** (décision du 22/10) : ils ne grimpent pas. Si le trou est au-dessus du sol de la salle, ils restent dedans ; le mineur suit alors son réglage « Face aux mobs ». Un mob de piège qu'il ne peut pas approcher, il le laisse tout de suite.
  - **Hors quota** : ils ne comptent pas dans le maximum de mobs de l'area et ne changent pas le rythme des apparitions.
  - **Barbare à la rescousse** : un barbare dans la partie va tuer les mobs du piège, où qu'ils soient et **quels que soient ses réglages** (Ignorer, Fuir, Aider allié), comme au donjon ; les raisons de remonter (oxygène, pods, torches, fin de session) passent avant.
  - Butin et XP : ceux des mobs ordinaires.
- **Préférence « Face aux mobs »** : Combattre / Ignorer / **Fuir** *(21/10)*. Fuir = comme Ignorer (il n'engage pas les mobs, il se bat seulement s'il est taclé) + il n'entre jamais dans un donjon.
- **État « combat » de la session** : il est actif dès qu'un mob a pris un mineur en chasse (il le poursuit à 14 cases ou moins, le tacle, ou canalise sur lui).
- **Aider allié** *(préférence du lobby, 21/10)* : un mineur réglé sur « Aider allié : Oui » part **tout de suite** vers le mob qui a pris un **autre** mineur en chasse (le plus proche), en creusant s'il le faut, et le combat, **s'il est à 20 cases ou moins** *(provisoire, `HELP.range` ; sans limite, il traversait la mine pour des combats finis avant son arrivée)*. Jamais pendant le chantier du treuil. Le joueur peut **ignorer des types de mob** (liste avec leur dessin, ignoré oui / non) : il n'ira pas aider contre eux. Pas pendant un retour vers la surface. Le mob mort, le mineur reprend sa décision normale selon sa priorité **là où il est** : partir aider lui fait **lâcher sa cible et sa galerie** d'avant, il mine à côté au lieu de retraverser la mine *(23/10/2026 au soir, Geoffrey ; avant, il retournait à sa cible)*. Un mob inatteignable est laissé. **Une fois parti aider, il garde ce mob** *(24/10/2026, correctif, seed 1928461225)* : même si le mob se retourne contre lui en route (un mob chasse le mineur le plus proche), et jusqu'à **30 cases** *(provisoire, `HELP.keep`)* ; au-delà, il abandonne ce mob pour de bon. Avant, il faisait demi-tour dès que le mob changeait de proie ou qu'il passait la limite des 20 cases, puis revenait : des allers-retours sur place.

## 6. Hors session

- Les ressources du coffre sont transférées dans l'**inventaire global** en fin de session, **partagées entre les joueurs** de la session (voir ci-dessous).

### Partage du coffre en fin de session
Une session réunit **jusqu'à 3 mineurs, un par joueur** (chaque mineur est rattaché à un ID de compte). Le coffre est commun ; en fin de session, son contenu est réparti :
- **parts égales** : chaque joueur reçoit le même nombre de chaque ressource, quelle que soit sa contribution ;
- **reste** d'une division qui ne tombe pas juste : donné **au hasard**, une unité au plus par joueur (100 charbons à 3 → 33, 33, 34). Le tirage dépend de la seed : même partie, même partage ;
- **Treasure TX** : ne se partage pas, **chaque joueur en reçoit un exemplaire** par Treasure TX rapporté, quel que soit son tier (un treasure ouvert à 3 = 1 Treasure TX pour chacun) ;
- **solo** : le joueur garde tout ;
- ce qu'un mineur porte encore sur lui à la fin est perdu (il n'est pas dans le coffre), y compris les Cristaux de pleine lune *(confirmé le 22/10/2026)* ; le bilan en donne le détail par mineur.
- **un joueur qui quitte la session avant la fin ne reçoit rien** : son mineur disparaît de la mine, ce qu'il portait est perdu. Si tout le monde part, la session s'arrête et personne ne reçoit rien.
- **Partage par tranches (anti-boosting)** *(décision du créateur, 21/10/2026)* : chaque départ coupe la session en tranches. Le butin déposé pendant une tranche est partagé à parts égales entre les joueurs **présents pendant cette tranche** ; la part d'un joueur parti est **perdue** (elle ne revient pas aux autres). Ex. : 3 joueurs pendant 50 min, 2 partent, le dernier reste seul 10 min → il reçoit 1/3 du butin des 50 premières minutes + tout celui des 10 dernières ; les 2/3 restants des 50 min ne sont versés à personne. Sans départ, rien ne change (une seule tranche). Même règle pour l'XP.
- **le partage est calculé par le serveur** (anti-triche) : voir « Lancer une session » ci-dessous.
- Une **UI à part** (à concevoir) permet de crafter, de gérer les caractéristiques du mineur et son stuff.
- Ce qui n'est pas encore défini : recettes, objets, coûts, arbre d'amélioration.

### Lancer une session (onglets Lobby et Session) *(séparés à la demande du créateur, 21/10/2026)*
Une session **ne démarre jamais toute seule** à l'ouverture de la page. Pour en lancer une, le joueur doit être connecté (compte ou invité) et aller dans l'onglet **Lobby** :
- **Où miner** : **Mine** (la mine normale) ou **Mine instantanée (MI)** : choisir MI remplace l'équipe, les préférences et « Lancer » par la carte d'inscription de la MI (voir « Mine instantanée » plus bas). Le type choisi est envoyé au serveur au lancement, qui refuse la MI (elle s'ouvre à heure fixe, sur inscription) ;
- **3 places** (le jeu est prévu à 3) : le joueur, puis des places libres. Chaque joueur affiche sa **spécialisation** : l'arbre de skills choisi (⛏ Mineur, 🪜 Logisticien, 🪓 Barbare) ou « Sans spécialisation » ;
- **Lancer la session** : si des places sont vides, la session est jouée **à ceux qui sont là** (seul = 1 mineur, il garde tout le coffre ; pas de mineur fantôme) ;
- **Groupe** : on se réunit avant de lancer (voir « Jouer à plusieurs » ci-dessous) ; seul, on joue seul ;
- **Critères / préférences** : les préférences de l'IA du mineur du joueur (priorité minerais/descendre, combattre/ignorer les mobs, aider allié oui/non avec la liste des mobs ignorés ; voir §5 et §7). Enregistrées avec le compte, **figées pour toute la session** une fois lancée.

**Au lancement, tout le groupe bascule sur l'onglet Session** (le chef tout de suite, les autres dans les secondes qui suivent, quel que soit l'onglet ouvert).

**Onglet Session** : la mine en cours, le panneau **Focus minerai** (§3), puis le **bilan** à la fin (« Retour au lobby » ouvre le Lobby). Sans session : « Tu n'es pas en session » et un bouton vers le lobby. **Quitter la session** = le joueur ne reçoit rien (voir le partage).
- **Chat de session** *(décision du 22/10/2026, Jules ; valeurs provisoires)* : un panneau **Chat** dans l'onglet Session (mine classique). Seuls les **joueurs de la session encore présents** lisent et écrivent (pas les amis, pas le serveur entier ; quitter la session = plus de chat). Le nom affiché est celui de la session. **200 caractères** par message, **un message par seconde** au plus, les **50 derniers** messages gardés. Rien n'est conservé : le chat est **effacé à la fin de la session** (pas d'historique). Pas encore affiché dans la mine instantanée ni dans les tours.

**Le Lobby pendant une session : lecture seule.** Un bandeau « ⛏ En session dans la mine · temps restant · Voir la session » ; le groupe reste visible (chacun « en session »), mais on ne peut ni lancer, ni inviter, ni rejoindre, ni quitter le groupe, ni changer les préférences ou le type de mine. Dès la fin (pendant le bilan), il redevient utilisable.
- **Combat** : le mineur se tourne vers le mob et frappe avec l'arme qu'il a en main (l'épée équipée, sinon la pioche), en coups de taille animés.
- **Caméra** : elle suit le mineur du joueur. Un appui sur un mineur de l'équipe la fait suivre celui-ci. Le joueur peut **se déplacer dans la mine** (molette, glisser à la souris ou au doigt, flèches ↑ ↓, PageUp / PageDown) : la caméra ne suit plus personne jusqu'à ce qu'il appuie sur **Suivre** (ou Début). Elle va du ciel au fond de la mine connue.

### Jouer à plusieurs (groupe)
- **Inviter des joueurs** ouvre un panneau avec le **code du groupe** (6 caractères, ex. `K7Q4P2`) et un **lien** à envoyer (`https://deepmineidle.fr/#rejoindre=K7Q4P2`) : l'ami clique, se connecte (invité ou compte) et prend une place. On peut aussi taper un code dans « Tu as un code de groupe ? ».
- **Inviter par ID** : on tape l'ID de compte d'un ami (`7K3Q-9XHP`) ; il voit l'invitation en haut de son lobby (**Rejoindre** / **Refuser**). Inviter ne fait pas entrer : seul celui qui accepte joue. Une invitation dure 1 h.
- Places : le **chef** (celui qui a créé le groupe, ★) puis les membres, les invités en attente, les places libres (3 au total). Un membre absent (onglet fermé) est marqué « absent », puis retiré après 5 min sans nouvelles.
- **Prêt** *(21/10/2026)* : chaque membre (sauf le chef : lancer = prêt) clique « ✋ Je suis prêt » (et peut annuler). Les places affichent « ✔ prêt » / « pas prêt ». **Le chef ne peut lancer que si tous les autres sont prêts** (il voit « ⏳ Pas prêt : Max, Lou »). Au lancement, et quand quelqu'un rejoint le groupe, **tout le monde repasse « pas prêt »** : à la fin d'une session, le chef ne peut pas relancer tant que les autres n'ont pas redit qu'ils sont prêts.
- **Prêt tout le temps** *(23/10/2026, Geoffrey)* : un membre (pas le chef) peut cocher « Prêt tout le temps » dans le lobby, même pendant une session. Coché, il **reste prêt** : ni le lancement, ni la fin d'une session, ni l'arrivée d'un nouveau ne le remettent à « pas prêt » (sa place affiche « ✔ prêt tout le temps »), et le chef peut **enchaîner** sans attendre son clic. **Seul le joueur la décoche, en cliquant dessus** *(23/10 après-midi ; avant : « Prêt (annuler) » la décochait aussi)* : tant qu'elle est cochée, le bouton principal affiche « ✔ Prêt tout le temps » sans action. C'est un réglage du **joueur** : il le garde en changeant de groupe (invitation, code, recherche de groupe) et après un redémarrage du serveur *(s'il était dans un groupe à ce moment-là)*.
- **Seul le chef lance** (« Lancer à N »). La session est créée pour tous les membres présents dans le groupe ; le chef est le premier mineur (à gauche), puis les autres dans l'ordre d'arrivée. Chacun garde ses propres préférences.
- **Apparence des mineurs** : chaque mineur porte le **pseudo** de son joueur, affiché en petit au-dessus de sa tête (en doré pour celui que la caméra suit). Tous ont le **même corps** ; ce qui les distingue, c'est leur **stuff équipé**, dessiné sur eux (ex. chitine = armure rouge sur les parties équipées). Quand il mine ou frappe, le mineur sort sa **pioche** : en bois (marron) par défaut, en pierre (grise) s'il a la pioche en pierre. L'équipement visible est celui porté **au lancement** de la session. **Dans le lobby** *(22/10)*, chaque place du groupe montre le mineur avec l'équipement que le joueur porte en ce moment (le sien se met à jour tout de suite, celui des autres au rafraîchissement du lobby). Les skins sont décrits dans `src/skins.js`, les textures dans `textures/skins/`.
- Le chef peut **retirer** un membre ou annuler une invitation (×). **Quitter le groupe** = on se retrouve seul. Si le chef part, le membre suivant devient chef. Le chef peut aussi **donner sa place** à un membre (★ sur sa place, avec confirmation) ; l'ancien chef devient un membre comme les autres et doit se dire prêt *(21/10/2026)*. Il peut le faire **même pendant une session** *(25/10/2026, Geoffrey ; avant : seulement hors session)* ; retirer un membre reste impossible pendant une session.
- Pendant la session, tout le monde voit **la même partie** : il n'y en a qu'une, elle tourne sur le serveur. Un joueur qui quitte part **tout de suite** : son mineur disparaît de la partie, chez tous. Partir dans les toutes dernières secondes ne rapporte rien non plus.
- **Le groupe reste après la session** *(décision du créateur, 21/10/2026)* : à la fin, chacun revient au lobby **dans le même groupe**, et le chef peut relancer sans réinviter, dès que les autres sont prêts. Un joueur qui ne veut pas enchaîner **quitte le groupe** (bouton « Quitter le groupe »).
  - Pendant la session, personne n'est retiré pour absence (le navigateur ne parle plus au groupe pendant la partie) : le délai de 5 min repart de la fin de la session. Le bilan compte comme une présence.
  - Un membre encore dans la session (le chef a quitté tôt, par exemple) est affiché « en session » ; le chef voit « ⏳ Le groupe finit sa session… » et ne peut pas relancer avant la fin.
  - Si le chef relance pendant qu'un membre lit encore son bilan, ce membre passe directement à la nouvelle session (son mineur y joue déjà).
- **Chercher un groupe (LFG)** *(demande du créateur, 22/10/2026 ; mine classique seulement)* : un joueur seul, ou le **chef d'un groupe de 2**, clique **« Chercher un groupe »** dans le Lobby. Il est « en recherche » avec le **temps de queue** qui défile, et peut **annuler**. Le membre d'un groupe de 2 voit la recherche de son chef, sans bouton.
  - **Un lobby se complète d'un coup**, jamais une place à la fois : on ne rejoint pas quelqu'un pour attendre le dernier à deux.
  - **3 solos** dans la file → les 2 derniers rejoignent le lobby du **premier entré** (il devient chef).
  - **Un groupe de 2** dans la file → c'est le **solo le plus ancien** qui rejoint **leur** lobby, même s'il était dans la file avant eux. Deux groupes de 2 ne se combinent jamais.
  - **« Lancer dès que plein »** (case à cocher) : si **le chef du futur lobby** l'a cochée, la session Mine démarre dès que le lobby est complet ; sinon le chef lance comme d'habitude. Si le lancement échoue (serveur plein…), le lobby reste formé.
  - Pop-up « Groupe trouvé » pour les 3 joueurs. On sort de la file si l'équipe change (quelqu'un entre ou part), si on lance une session, ou **30 s** sans nouvelles du lobby (onglet fermé) *(valeur de config)*.
  - **Compteur** *(23/10/2026, Geoffrey)* : le Lobby affiche « **x joueurs en recherche** » (« Personne en recherche » à 0) **même quand on ne cherche pas**, pour savoir si ça vaut le coup de s'inscrire. Un groupe de 2 compte pour 2. Mine classique seulement, pas pendant une session.
  - La file n'est **pas** enregistrée : après un redémarrage du serveur, le navigateur relance la recherche tout seul (on perd sa place dans la file).
- **Les groupes survivent à un redémarrage du serveur** (la mise à jour automatique le redémarre à chaque nouvelle version) : ils sont enregistrés comme le reste (code, chef, membres, invitations) et retrouvés au démarrage.
- Absence : un membre silencieux est retiré au bout de 5 min, comptées depuis la **fin réelle** de sa dernière session (une session peut finir après l'heure prévue si le serveur a dû rattraper du retard, ou à tout moment en mode dev) : celui qui revient le premier du bilan ne fait jamais sortir les autres.

**Le serveur fait foi** (anti-triche) :
- c'est lui qui crée la session (seed, joueurs, préférences, heure de départ) et qui **fait tourner la partie** : une seule copie, sur le serveur. Le navigateur la reçoit et l'**affiche** ; il ne calcule rien. Il envoie seulement les choix du joueur (lancer, quitter, focus), appliqués tout de suite. Comme le navigateur ne produit aucun résultat, il n'y a rien à vérifier : ni rejeu, ni contrôle de vraisemblance ;
- **vitesse du jeu normal : ×2** *(valeur de config)* : une session de 60 min de jeu dure **30 min en temps réel**. Pas de pause : elle avance au rythme du temps réel, **même page fermée** ; en revenant, on voit directement où en est la partie ;
- la session se termine d'elle-même au dernier tick : le serveur partage aussitôt le coffre et verse les parts dans les inventaires. Un joueur absent à la fin reçoit quand même sa part ;
- après un redémarrage du serveur, une session en cours est reconstruite à l'identique (même seed + choix enregistrés avec leur tick), puis reprend ;
- le nombre de sessions en même temps est limité par la puissance du serveur *(valeur de config, 5 sur Render)* : au-delà, « serveur plein, réessaie dans quelques minutes » ;
- **l'inventaire est stocké sur le serveur** ; le navigateur le lit, il ne peut pas l'écrire ;
- une seule session en cours par joueur.

**Mode développeur** (serveur lancé avec `npm run dev`, jamais en ligne) : vitesses ×1 à ×300 et pause (réglées sur le serveur, qui fait tourner la partie ; à ×300, la partie va aussi vite que le serveur peut la calculer), seed au choix, mineurs de test sans compte (aussi dans les tours, 25/10), réglages des stats, **spécialisation imposée** par place de mineur (joueurs puis mineurs de test) avec un **niveau** qui remplit l'arbre étage par étage (25/10 ; ne touche ni aux skills du compte ni à l'XP) ; tours toujours ouvertes et illimitées ; la fin est libre (la partie est jouée jusqu'au bout d'un coup).

### Navigation
Une **barre d'action** est **toujours visible en bas** de l'écran, avec le nom de chaque onglet : **Lobby, Session, Inventaire, Stuff, Craft, Four, Concasseur, Amélioration, Recherche, Skills, Historique, Social** (touches 1 à 9, 0, - et =). Elle est encadrée de deux **orbes** : temps de session et XP ; pendant une session, oxygène et pods du mineur suivi *(direction artistique « Forge noire », 21/10/2026)*.
- **Lobby** : le groupe, les préférences, le type de mine, Lancer (lecture seule pendant une session). Onglet ouvert par défaut ; un lien d'invitation y mène.
- **Session** : la session en cours (les mineurs, la carte, le coffre commun), puis son bilan. L'ancienne adresse `#mine` y mène. Le minuteur de la barre du haut y mène aussi d'un clic.
- **Inventaire** : tout ce que possède le joueur (voir ci-dessous).
- **Four** : fondre les minerais en lingots (voir ci-dessous).
- **Concasseur** : concasser les blocs pour un peu de butin (voir ci-dessous).
- **Amélioration** : identifier et améliorer les pièces de stuff (voir ci-dessous).
- **Recherche** (table de recherche) : dépenser les Blueprint parts, recycler des blueprints (voir ci-dessous).
- **Craft** : fabriquer des objets (voir ci-dessous).
- **Stuff** : équiper les pièces du mineur (voir ci-dessous).
- **Skills** : dépenser les points gagnés aux niveaux (voir §3, Skills).
- **Historique** : les sessions terminées du joueur (gardées 30 jours), la plus récente en haut : date, durée, joueurs, **seed**, areas débloquées, profondeur, XP reçue et **sa part du butin** (« rien reçu » s'il est parti avant la fin).
- **Social** : les amis, ce qu'ils font, les inviter ou les rejoindre (voir ci-dessous).
- Changer d'onglet **ne met pas la session en pause** : la mine continue de tourner ; le minuteur de session reste visible dans la barre du haut.

### Social (onglet Social) *(demande du créateur, 21/10/2026)*
- **Ajouter un ami par son pseudo** (sans tenir compte des majuscules ni des accents). Un compte invité n'a pas de pseudo : il s'ajoute avec son **ID de compte** *(ajout de Claude)*. C'est une **demande** : l'autre joueur l'accepte ou la refuse. Deux joueurs qui se demandent l'un l'autre deviennent amis tout de suite. Un ami se retire (des deux côtés) ; une demande envoyée s'annule.
- L'onglet liste **les amis et ce qu'ils font** : **hors ligne**, **en ligne**, **en session mine**, **dans le lobby (x/3)** (dans un groupe de x joueurs). En ligne = le jeu est ouvert (même dans un onglet caché) depuis moins de 45 s *(valeur de config)*. Ordre : lobby, en ligne, en session, hors ligne. **Un ami en session affiche le temps qu'il lui reste** (« En session mine · reste 23 min », arrondi à la minute du dessus ; « En session · Tour de l'Ange · … » pour une tour ou la mine instantanée) *(23/10/2026, Geoffrey)*.
- Pour chaque ami **en ligne** (en ligne ou dans le lobby) : **Inviter** (invitation dans son groupe, comme l'invitation par ID du lobby) et **Rejoindre** (entrer dans son groupe ; s'il n'en a pas, un groupe est créé avec lui comme chef). Rejoindre est grisé si son groupe est complet ; les deux sont grisés si l'ami est déjà dans ton groupe, ou si toi-même es en session.
- **Un joueur en session ne peut pas être invité**, ni depuis l'onglet Social ni par ID depuis le lobby (le serveur refuse), ni rejoint.
- **Voir le stuff d'un ami** *(demande du créateur, 22/10/2026)* : bouton **Stuff** sur chaque ami (même hors ligne ou en session) → sa fiche, en lecture seule : **niveau**, **spécialisation**, **pièces portées** (qualité, amélioration, rune, avec leur bulle d'info) et **stats du mineur** (stuff + skills, comme son onglet Stuff). Jamais son inventaire. Réservé aux amis (le serveur refuse sinon).
- **Notifications en pop-up, en haut à gauche** de l'écran, sur n'importe quel onglet :
  - invitation de groupe : « **xxx vous a invité dans son lobby** », boutons **Rejoindre** (emmène à l'onglet Lobby) et **Décliner** ;
  - demande d'ami : « **xxx vous a envoyé une demande d'ami** », boutons **Accepter** et **Refuser**. La demande est aussi listée dans l'onglet Social (« Demandes d'ami reçues »), avec une pastille sur l'onglet.
- Limites *(config serveur)* : 100 amis, 20 demandes envoyées en attente, 30 demandes par heure.

### Inventaire global
Une grande grille de **slots** ; chaque slot contient un objet et sa quantité (ex. « Charbon × 100 »).
- Un objet **déjà présent s'empile** sur son slot, **sans taille maximum**.
- Un objet **absent prend un nouveau slot** : le premier slot libre (**ordre d'arrivée**, un objet garde sa place).
- Les objets de **stuff ne s'empilent pas** : chaque exemplaire prend son propre slot (chaque pièce pourra avoir ses propres stats).
- **Capacité illimitée** pour l'instant : au moins 48 slots affichés (8 colonnes), une ligne s'ajoute quand la grille est pleine. Une limite pourra devenir une amélioration plus tard *(valeur de config)*.
- Un slot vidé (objet consommé par le craft) reste un trou, réutilisé par le prochain nouvel objet.
- **Trier** *(25/10/2026, Geoffrey)* : un bouton range tout l'inventaire, une fois (les objets qui arrivent ensuite prennent le premier slot libre), et le tasse au début. Ordre : par **type** (**blocs** : terre, pierres, résidus ; **minerais** : charbon et minerais ; **matériaux** : lingots, butin de mob, matériaux, gemmes ; **stuff** : pièces et runes ; puis le reste : treasures, blueprints, four, parchemins), puis par **rareté** de l'objet (la plus rare d'abord). La qualité d'identification (R1 à R7) ne compte pas. *(Groupes : `INVENTORY.sortGroups`, provisoires.)*
- **Déplacer** *(25/10/2026, Geoffrey)* : on glisse un objet sur un autre slot ; s'il est occupé, les deux objets échangent leur place.
- Les objets arrivés en fin de session sont mis en évidence jusqu'à la prochaine visite de l'onglet (pastille sur l'onglet).
- Un Treasure TX sélectionné peut s'ouvrir (voir §2, Treasures) ; les objets reçus sont mis en évidence de la même façon.
- Un blueprint sélectionné peut s'**utiliser** : il débloque sa recette (voir Craft).
- **Recycler** *(25/10/2026, Geoffrey)* : une pièce de stuff **fabriquée** (qui a une recette de craft ; pas un objet du four, ni un anneau, ni une rune) sélectionnée a un bouton **Recycler**. Une fenêtre de confirmation montre ce qu'on récupère. La pièce est détruite et rend **60 %** de chaque ingrédient de sa recette, **arrondi vers le bas** (1 ingrédient → 0 ; ex. Bottes en fer : 2 Tainted iron et 3 peaux de gobelin). Son amélioration, sa rune et sa qualité sont perdues, sans compensation. **Interdit** pour une pièce portée ou enregistrée dans un set : la fenêtre prévient. *(60 % : `RECYCLE.share`, provisoire.)*
- Une pièce de stuff sélectionnée peut s'**équiper** directement (bouton **Équiper**, avec sa case et la pièce qu'elle remplace) : même effet que depuis l'onglet Stuff, la pièce remplacée revient dans l'inventaire.

**Rareté** *(décision du créateur, 21/10/2026)*. Chaque objet a une rareté : **commun** (gris), **inhabituel** (vert), **rare** (bleu), **épique** (violet), **légendaire** (orange).
- Partout où l'objet apparaît (inventaire, craft, four, stuff, recherche, coffre en session, bulles), le **contour de sa case** et la **couleur de son nom** suivent sa rareté. La fiche d'un objet de l'inventaire affiche aussi le libellé de la rareté.
- Par défaut, tout est **commun**. **Inhabituel** : Rubis inférieur, Saphir inférieur, Jade inférieur, Boussole en or (et son BP), Ceinture en peau de gobelin (et son BP), Four en fer (et son BP), Gants tactique et Gants d'ouvrier (et leurs BP), tous les **shiny**. Les **Résidus angélique et démoniaque** sont **communs** *(22/10/2026 ; avant : rares)*. **Rare** : Cape de Naingui (et son BP). *(23/10/2026)* **Inhabituel** aussi : les six pièces en acier et leurs BP ; **Épique** : Plastron de l'équilibre (et son BP).
- Le vert étant pris par la rareté : un objet tout juste arrivé brille d'un halo blanc, et une recette qu'on peut fabriquer porte une coche ✔.

### Craft (onglet Craft)
- Les **recettes** sont dans un fichier à part : `src/recipes.js` (ingrédients, quantité obtenue, déblocage).
- L'onglet montre une **icône par recette disponible**. Un clic montre la recette : chaque ingrédient en **x / besoin** (x = ce que le joueur a dans son inventaire ; rouge s'il en manque, vert sinon).
- Le bouton **Craft** est grisé tant qu'il manque un ingrédient. Sinon, un clic retire les ingrédients et met l'objet dans l'inventaire (tout ou rien, fait par le serveur ; un double clic ne fabrique qu'une fois).
- Certaines recettes sont **débloquées de base** ; les autres par un **blueprint** (champ `unlock`) *(décision ferme)* :
  - elles sont **secrètes** : l'onglet Craft ne les montre pas tant que le blueprint n'a pas été utilisé ;
  - dans l'Inventaire, un blueprint sélectionné a un bouton **Utiliser** : le blueprint est **consommé**, la recette est **débloquée pour toujours** sur le compte (fait par le serveur, en une fois ; un double clic n'en consomme qu'un) ;
  - recette déjà débloquée : le bouton n'apparaît pas, le blueprint est gardé. Un blueprint qui ne débloque encore rien l'indique (aucun pour l'instant : le Four en fer BP et la Boussole en or BP ont leur recette depuis le 21/10/2026).
- Recettes actuelles *(provisoires)* :

  | Objet | Recette | Bonus |
  |---|---|---|
  | Pioche en pierre | 30 lingots de fer (300 fer + 300 charbon, 30 min de four) | Vitesse de minage +0,2 *(×2 le 21/10)* |
  | Épée en pierre | 15 lingots de fer | Dégâts 8 (remplace les mains nues : 5 ; +3, moitié de l'épée en fer, ≈ 120 x) |
  | Casque en chitine | 5 lingots de fer + 70 chitine | Oxygène +30 |
  | Plastron en chitine | 8 lingots de fer + 30 chitine | Pods +30 *(23/10 ; avant +25)* |
  | Jambes en chitine | 7 lingots de fer + 30 chitine | Vitesse (échelle) +0,4 |
  | Bottes en chitine | 4 lingots de fer + 70 chitine | Vitesse (marche) +0,5 |

  Débloquées par leur blueprint (« Pioche en fer BP »…, Treasure T1). **Buff du 24/10/2026 (Geoffrey)** : pièces en fer
  × 1,75, épée et pioche × 1,25, arrondi à l'entier pour les stats entières (but : une équipe en fer ≈ 5,4 areas au lieu de 5,0,
  sans toucher aux équipes moins équipées) :

  | Objet | Recette | Effet |
  |---|---|---|
  | Pioche en fer | 20 Tainted iron | Vitesse de minage +0,4 *(25/10 : nerf, avant +0,5 ; 24/10 : × 1,25, avant +0,4 ; +0,7 pendant quelques heures le 24/10)* |
  | Épée en fer | 10 Tainted iron | Dégâts 14 (remplace les mains nues : 5) *(24/10 ; avant 11)* |
  | Lance en fer *(25/10/2026, Geoffrey)* | 10 Tainted iron *(provisoire)* | Dégâts +8 (13), vitesse d'attaque −10 %, **recul +0,5**, **portée d'attaque +0,25**. Variante de l'épée : elle **tue moins vite** (≈ +16 % de temps par mob) mais repousse assez pour faire **lâcher son tacle** au mob (≈ −36 % de temps taclé, plus de vol du gobelin). Case épée. |
  | Casque en fer | 5 Tainted iron | Oxygène +67 *(24/10 ; avant +38)* |
  | Plastron en fer | 8 Tainted iron | Pods +88 *(24/10 ; avant +50, et +33 avant le 23/10)* |
  | Jambes en fer | 7 Tainted iron | Vitesse (échelle) +1,05 *(24/10 ; avant +0,6)* |
  | Bottes en fer | 4 Tainted iron + 5 peau de gobelin + 1 lingot d'or | Vitesse (marche) +1,05 *(24/10 ; avant +0,6)* |
  | Ceinture en peau de gobelin | 20 peau de gobelin + 20 lingots d'or | Torches +10 *(avant le 21/10 : Découverte +1)* |
  | Four en fer | 1 000 charbon + 20 Tainted iron + 5 Shiny iron | « Utiliser » : ouvre le four 2 (×1,25) |
  | Boussole en or (case boussole) | 20 Tainted gold + 5 Shiny gold | Boussole : +1 ligne au-dessus et en dessous (≈ 300 x) |

  Tier 2 (blueprints du Treasure T2 : « Gants tactique BP », « Gants d'ouvrier BP », « Cape de Naingui BP ») :

  | Objet | Recette | Effet |
  |---|---|---|
  | Gants tactique (case gants) | 20 Shiny iron + 20 Tainted iron + 1 Jade inférieur | Vitesse d'attaque +20 % (≈ 39 x) |
  | Gants d'ouvrier (case gants) | 20 Shiny gold + 20 Tainted iron | Fortune +5 % (≈ 180 x) |
  | Cape de Naingui (case cape) | 20 Tissu sombre + 1 Rubis inférieur + 1 Saphir inférieur | Découverte +1 |

  Tier 3 (blueprints du Treasure T3, 23/10/2026, Geoffrey). **Acier** : rareté **inhabituel**. Au départ, la pièce en fer
  × 1,2 (plastron : Pods +80). **Buff du 24/10/2026 (Geoffrey)** : acier × 1,5, épée et pioche × 1,25 ; **Plastron de l'équilibre**
  × 1,5 ; arrondi à l'entier pour les stats entières. L'acier reste au-dessus du fer sur chaque stat, mais de peu
  depuis le buff du fer (casque +69 contre +67, jambes et bottes +1,08 contre +1,05 ; pioche +0,6 contre +0,5). **Plastron de l'équilibre** : rareté **épique**.

  | Objet | Recette | Effet |
  |---|---|---|
  | Casque en acier | 10 Steel ingot + 5 Tainted gold *(24/10)* + 10 Shiny iron + 10 Tissu sombre | Oxygène +100 *(25/10, ≈ 400 x ; avant +69, 24/10 : avant +46)* |
  | Plastron en acier | 16 Steel ingot + 8 Tainted gold *(24/10)* + 10 Shiny iron + 10 Tissu sombre | Pods +120 *(24/10 ; avant +80, et +40 avant le 23/10)* |
  | Jambes en acier | 14 Steel ingot + 7 Tainted gold *(24/10)* + 10 Shiny iron + 10 Tissu sombre | Vitesse (échelle) +1,6 *(25/10, ≈ 400 x ; avant +1,08, 24/10 : avant +0,72)* |
  | Bottes en acier | 8 Steel ingot + 4 Tainted gold *(24/10)* + 10 Shiny iron + 10 Tissu sombre | Vitesse (marche) +1,67 *(25/10, ≈ 400 x ; avant +1,08, 24/10 : avant +0,72)* |
  | Pioche en acier | 20 Steel ingot + 10 Shiny gold + 10 Diamant | Vitesse de minage +0,5 *(25/10 : nerf, avant +0,6 ; 24/10 : × 1,25, avant +0,48 ; +0,72 pendant quelques heures le 24/10)* |
  | Épée en acier | 10 Steel ingot + 10 Shiny gold + 10 Diamant | Dégâts 16 (remplace les mains nues : 5) *(24/10 ; avant 13)* |
  | Plastron de l'équilibre (case torse) | 50 Steel ingot + 20 Shiny gold + 1 Rubis, 1 Saphir, 1 Jade inférieurs + 50 Résidus angéliques + 50 Résidus démoniaques | Pods +188, oxygène +30, vitesse de minage +3 %, dégâts +3 %, vitesse d'attaque +8 %, ténacité +3 %, fortune +2 %, butin des mobs +3 %, torches +8 *(24/10 : × 1,5 arrondi ; avant pods +125, oxygène +20, 2 %, 2 %, 5 %, 2 %, 1 %, 2 %, torches +5)* |

  **Vésicule de gaz** *(24/10)* : matériau, butin du méphite (1 à 2), sans usage pour l'instant.
  **Tissu sombre** : matériau (catégorie « Matériau »), nécessaire à la Cape de Naingui. Il vient de l'**occultiste** (1 à 3 par occultiste vaincu, areas 4 et 5).

### Stuff (onglet Stuff)
- **12 cases** : casque, torse, jambes, pieds, gants, ceinture, pioche, épée, cape, boussole, et **2 cases d'anneau** (23/10/2026).
- **Anneaux** *(décisions du créateur, 23/10/2026 ; valeurs provisoires, `RINGS` en config)* :
  - Leur effet va à **tout le groupe de la session** (porteur compris), figé au lancement comme le reste du stuff. **Pas
    cumulable** : si deux joueurs du groupe portent le même anneau, l'effet ne compte qu'une fois. Un joueur ne peut pas
    porter **deux fois le même anneau** (deux anneaux différents, oui). Valable en mine classique et dans les tours ; en
    **mine instantanée** (chacun pour soi), l'anneau ne profite qu'à son porteur.
  - **Ni craft, ni identification, ni amélioration (+1 à +3), ni enchantement** : un anneau reste tel qu'il est tombé.
  - « +3 % » d'une stat sans version en % (vitesse, oxygène, pods) = **× 1,03 sur le total** (stuff et skills compris) ;
    dégâts et minage passent par leurs stats en % (+3), fortune et butin des mobs en points (+2).
  - **Exception, XP** *(décision du créateur, 24/10/2026)* : le bonus d'XP (Anneau du nerd) est **personnel**. Il
    s'applique **après** la répartition du pot commun, sur la part de son porteur : seul le bonus n'est pas partagé.
    Ex. à 3, pot de 1000 XP : 333 chacun, 342 pour le porteur (333 × 1,03, arrondi vers le bas). *(Ancien : +3 % sur
    le pot, pour tout le groupe.)*
  - Rares : **Anneau du tigre** (vitesse de marche et sur échelle +3 %), **du lion** (dégâts +3 %), **du rat** (vitesse
    de minage +3 %), **de la baleine** (oxygène +3 %), **du cuck** (pods +3 %), **du nerd** (XP +3 %). Épiques :
    **Anneau de Midas** (fortune +2 %), **Anneau du Bouffon** (butin des mobs +2 %).
  - **Obtention** : seulement en ouvrant un **Trésor angélique / démoniaque** (en plus de la rune), un seul tirage :
    au plus un anneau. Trésor angélique : chacun des 6 rares 1 %, Midas 0,5 % ; trésor démoniaque : les 6 rares 1 %,
    Bouffon 0,5 % (≈ 6,5 % d'avoir un anneau par trésor). Les anciens Coffres angélique / démoniaque n'en donnent pas.
- Un clic sur une case ouvre la liste des **pièces de l'inventaire qui vont dans cette case** (ex. case pioche → les pioches). Choisir une pièce l'équipe.
- Une pièce équipée **quitte l'inventaire** ; en équiper une autre dans la même case **renvoie l'ancienne** dans l'inventaire ; « Retirer » la remet aussi. Une pièce n'est jamais à deux endroits à la fois.
- **Effets en session** : chaque mineur a **ses propres caractéristiques** = stats de base + bonus des pièces qu'il porte. Le stuff est **figé au lancement** de la session (le même que son apparence) : changer de pièce pendant une session compte pour la suivante. C'est le serveur qui les calcule (depuis le stuff enregistré sur le compte).
- **Pods des plastrons** *(23/10/2026, Geoffrey)* : chitine +30, fer +50, acier +80, équilibre +125 (avant 25 / 33 / 40 / 60). *(24/10 : fer +88, acier +120, équilibre +188, buff du stuff fer et acier.)* Les stats d'une pièce sont lues dans le catalogue à chaque session : **les plastrons déjà fabriqués ont les nouvelles valeurs**, et comme la valeur d'un objet suit ses stats, les lignes d'identification et les runes posées sur un plastron grandissent aussi. Repère (simulation) : en stuff de base, chaque remontée au coffre coûte cher ; +100 pods sur les 3 mineurs d'une équipe en fer avançaient l'ouverture de l'area 5 de 6 min (dureté de la pierre, oxygène, torches : 0 à 3 min).
- Une pièce peut **ajouter** à une stat (ex. Pods +30) ou **remplacer** sa valeur de base (ex. l'Épée en fer : Dégâts 14 au lieu des 5 des mains nues).
- Pièces existantes : **Pioches en pierre et en fer** (case pioche) ; **Épées en pierre et en fer** (case épée) ; **Casque, Plastron, Jambes et Bottes en chitine ou en fer** (cases casque, torse, jambes, pieds) ; **Ceinture en peau de gobelin** (case ceinture) ; **Gants tactique et Gants d'ouvrier** (case gants) ; **Cape de Naingui** (case cape) ; **pièces en acier** (gris bleuté) et **Plastron de l'équilibre** (moitié blanc, moitié rouge) depuis le 23/10. En session, l'armure en fer est grise, la ceinture verte ; le mineur sort son épée pour frapper (sa pioche s'il n'en a pas). Leurs bonus (tableau ci-dessus) s'affichent dans les onglets Craft, Stuff et Inventaire et s'appliquent en session.
- **Bulle d'info** : survoler une pièce (ou la toucher sur mobile) dans l'Inventaire, le Craft ou le Stuff affiche son nom et ses effets, un par ligne (ex. « Pioche en pierre / Vitesse de minage +0,2 »).
- **Stats du mineur** : sous les cases, l'onglet liste les stats du mineur (oxygène, pods, vitesses, minage, dégâts, vitesse d'attaque, fortune, découverte, vision, boussole, torches, passerelles) : (base + bonus des pièces portées, en vert) × multiplicateur des skills (en bleu, ex. vitesse de minage ×1,06, dégâts ×1,15), puis l'effet de ses anneaux (en violet). Le total est exactement ce que le mineur a en session seul ; en groupe, les anneaux des autres s'y ajoutent.

### Sets (onglets Stuff, Skills et Sorts) *(24/10/2026, Geoffrey ; garde-fou provisoire, `SETS` en config)*
Un **set** enregistre l'équipement complet du moment : le **stuff porté** (les pièces exactes, avec leur qualité, leur niveau et leur rune), les **skills** (arbre et rangs) et les **sorts** (emplacements). **Une seule liste**, la même à gauche des onglets Stuff, Skills et Sorts :
```
Set 1  [Équiper] [Enregistrer] [✎] [×]
Set 2  [Équiper] [Enregistrer] [✎] [×]
[+ Nouveau set]
```
- **+ Nouveau set** : crée « Set n » (premier numéro libre) avec l'équipement actuel. **Enregistrer** : remplace le set par l'équipement actuel (confirmation). **✎** renommer (1 à 24 caractères), **×** supprimer (confirmation).
- **Équiper** agit toujours sur **tout le set** : tout le stuff porté revient dans l'inventaire puis chaque pièce du set retourne dans sa case ; une pièce **introuvable** (sacrifiée, recyclée…) laisse sa **case vide**, avec un message « n pièce(s) introuvable(s) » ; reset gratuit des skills puis les rangs du set, revérifiés avec les points du niveau ; les sorts du set qui sont encore équipables (débloqués, bonne spécialisation), les autres emplacements restent vides.
- **Pas pendant une session** (Enregistrer, Équiper, Nouveau set : comme le reset des skills) ; renommer et supprimer restent possibles.
- **Pas de limite voulue** pour le joueur ; garde-fou technique de **20 sets** (taille de la sauvegarde).
- Le serveur fait tout en une seule écriture (inventaire, stuff, skills, sorts) ; une demande renvoyée n'agit qu'une fois.

### Amélioration (onglet Amélioration) *(décisions du créateur, 21/10/2026 ; valeurs provisoires, `UPGRADE` en config)*
Trois rubriques : **Identification**, **Amélioration**, **Enchantement** (22/10, voir ci-dessous). Seulement les pièces de l'inventaire (une pièce portée se retire d'abord dans l'onglet Stuff). C'est le serveur qui tire le hasard.

**Identification** : deux cases. À gauche la pièce à identifier, à droite **un autre exemplaire du même objet, sacrifié** (peu importe sa qualité ou son niveau). La pièce reçoit une **qualité** (tirée selon les chances ci-dessous). **Définitif** : une pièce identifiée ne se ré-identifie pas.
- **Depuis le 22/10/2026 (décision du créateur) : l'identification ne donne plus que la qualité** (titre et couleur du nom), **aucune stat en plus**. Les lignes de stats décrites ci-dessous ne concernent que les **pièces identifiées avant** : elles les **gardent** *(décision du créateur, 22/10/2026)*. Les colonnes « Chaque ligne vaut / Lignes / Total max » ne servent plus qu'à revérifier ces anciennes pièces.
- *(22/10/2026)* **On choisit soi-même quelle pièce va dans quelle case** : un clic sur une case la sélectionne (cadre doré), puis un clic sur une pièce de la liste (toutes les pièces de l'inventaire) la pose dedans ; re-cliquer sur la case sélectionnée la vide. Si les deux pièces **ne sont pas le même objet** (ou si la pièce de gauche est déjà identifiée), on ne peut **juste pas identifier** : le bouton reste grisé et la raison est affichée.
- *(22/10/2026)* **Affichage des lignes** : partout (liste, bulles, résultat), les stats de base de l'objet d'abord, puis **chaque ligne tirée à part**, même quand deux lignes portent la même stat (ex. « Fortune +1,2 % · Fortune +0,9 % »). En session, le mineur a bien la somme.

| Qualité | Titre | Couleur du nom | Chance | Chaque ligne vaut | Lignes | Total max |
|---|---|---|---|---|---|---|
| R1 | Utile | #FFFFFF | 30 % | 8 à 25 % de la valeur de l'objet | 1 | 25 % |
| R2 | Bon | #00FF00 | 24 % | 15 à 30 % | 1 | 30 % |
| R3 | Haute qualité | #0080FF | 24 % | 17,5 à 35 % | 1 | 35 % |
| R4 | Excellent | #FF00FF | 14 % | 12,5 à 20 % | 2 | 40 % |
| R5 | Antique | #FFA500 | 4 % | 17,5 à 25 % | 2 | 50 % |
| R6 | Mystérieux | #FF0000 | 3 % | 15 à 25 % | 3 | 75 % |
| R7 | Légendaire | #FFFF00 | 1 % | 16 à 25 % | 4 | 100 % |

- **Nerf du 22/10/2026** *(décision du créateur)* : total max ramené à 25 / 30 / 35 / 40 / 50 / 75 / 100 % (avant 30 / 40 / 60 / 80 / 100 / 150 / 220 %) ; le minimum d'une ligne garde le même rapport au maximum qu'avant. **Les pièces déjà identifiées suivent** : chaque ligne est ramenée à la même place dans sa nouvelle fourchette (le haut de l'ancienne donne le haut de la nouvelle), à la relecture de l'inventaire et du stuff (`UPGRADE.scale` / `oldScales`, champ `s` de la pièce).
- Tirage de la qualité vérifié le 22/10 (hasard `crypto` du serveur, 1 million de tirages conformes aux chances ; identifiant de demande neuf à chaque clic).
- Une ligne garde **le % tiré**, pas sa valeur : si on rééquilibre un prix ou un objet, les pièces déjà identifiées suivent.
- **Valeur de l'objet** = ses stats en unité x (catalogue de prix §3) : pioche en pierre 0,1 × 1 300 = **130 x**, pioche en fer 260 x, épée en fer (11 − 5) × 40 = 240 x.
- **Une ligne** : une stat tirée au hasard (deux lignes peuvent tomber sur la même) parmi celles qui ont une valeur en x : vitesse de minage (fixe et %), dégâts (fixes et %), vitesse d'attaque, critique, fortune, coup unique, perçage, butin des mobs, marche, montée, pods, oxygène. Valeur = **valeur du tier de l'objet** × % tiré ÷ prix de la stat, arrondie (au moins un pas). **Tiers** *(décision du créateur, 25/10/2026 ; `UPGRADE.tiers` ; avant : la valeur de l'objet lui-même)* : **T1 = 100 x** (pierre, chitine, plans du Treasure T1 : ceinture en peau de gobelin, boussole en or), **T2 = 250 x** (fer, dont les plans sont pourtant dans le Treasure T1 : la matière compte ; plans du Treasure T2 : gants, cape), **T3 = 400 x** (acier et Plastron de l'équilibre, plans du Treasure T3). Ex. pioche en pierre (T1), ligne à 20 % : 20 x = +0,01 de vitesse de minage, **ou** +0,4 % de fortune, **ou** +4 pods, **ou** +2 % de butin des mobs. Les lignes gardent leur % : les pièces déjà runées suivent.
- **Conversion d'une ligne** *(tableau du créateur, 22/10/2026 ; `UPGRADE.prices`)* : ce que donne une ligne pour **100 x** : vitesse de minage +0,05 · minage % +5 % · dégâts +2,5 · dégâts % +20 % · vitesse d'attaque +20 % · critique +7 % · fortune +2 % · coup unique +7 % · perçage +10 % · butin des mobs +10 % · marche +0,4 · montée +0,3 · pods +20 · oxygène max +25. Ce tableau convertit la valeur du tier (ci-dessus) ; la **valeur de l'objet** (`UPGRADE.worth`) ne sert plus aux lignes depuis le 25/10. Les mêmes valeurs servent aux runes (Enchantement).
- **Jamais de Découverte**, sauf en **R6 et R7** : chaque ligne a 25 % de chance *(provisoire)* d'être « +1 Découverte », une au plus par objet.
- **Nom** : « Excellent : Pioche en pierre » dans la couleur de la qualité, qui passe avant la couleur de rareté du type. **Le contour de la case garde la rareté du type** (commun, inhabituel…).
- Une R7 ajoute au plus **+100 % de la valeur de l'objet** (22/10 ; avant +220 %) : une pioche en pierre R7 vaut au plus une pioche en fer brute.

**Amélioration** : +1 à **+3** pour l'instant (la suite viendra). Le % est le **bonus total du palier** sur **toutes les stats de la pièce** (de base et identifiées) ; une pièce non identifiée peut être améliorée et garde son niveau quand on l'identifie. **Un échec ne coûte que les matériaux** : la pièce ne perd rien.

| Niveau | Stats | Réussite | Coût |
|---|---|---|---|
| +1 | +3 % | 100 % | 20 Plumes d'ange, 3 Cristaux de pleine lune |
| +2 | +5 % | 95 % | 30 plumes + 5 cristaux |
| +3 | +7 % | 90 % | 50 plumes + 7 cristaux |

*(Plumes relevées le 22/10/2026 : 3 / 5 / 7 → 20 / 30 / 50.)*

Ex. pioche en pierre +3 : 0,1 × 1,07 = 0,107 de vitesse de minage. Épée en fer +3 : 5 + 6 × 1,07 = 11,4 dégâts. Les stats entières (pods, oxygène, découverte, lignes de boussole) sont arrondies.
- **Plume d'ange** : celle qu'on ramasse dans la **mine instantanée**. **Cristal de pleine lune** : le butin du **minotaure** (donjon, 1 à 3 par victoire, chaque joueur présent reçoit la quantité entière). Il faut donc 100 plumes et 15 cristaux pour monter une pièce à +3 (sans échec). Pour tester : `node scripts/give-admin.js --name <pseudo>` (une pièce de chaque qualité + des matériaux).

**Enchantement** *(concept Ange vs Démon, 22/10/2026 ; `RUNE` en config)* : une pièce de stuff de l'inventaire + une **Rune** → la rune est consommée et ses lignes s'ajoutent à la pièce. **Une seule rune par pièce.** **Retirer une rune** *(décision du créateur, 23/10/2026 ; avant : définitif)* : gratuit ; la rune revient dans l'inventaire en **Fragment de rune** (rareté rare) : même qualité, mêmes lignes, mais **chaque % compte pour moitié** (la ligne « +1 Découverte » n'est pas un % : inchangée). Un fragment se pose **comme une rune** (mêmes règles : une par pièce, qualité ≤ celle de la pièce, pièce identifiée) ; **un fragment posé ne se retire plus**. **Une pièce n'accepte qu'une rune de qualité égale ou inférieure à la sienne** *(décision du créateur, 22/10/2026)* : une pièce R6 peut recevoir une rune R1 à R6 (par exemple un casque R6 avec une rune R3), pas une R7. **Une pièce non identifiée** n'a pas de qualité : elle doit **d'abord être identifiée** *(confirmé par le créateur le 22/10/2026 ; avant : une pièce non identifiée pouvait être enchantée)*. Identification et rune s'additionnent pour les anciennes pièces qui ont des lignes. Chaque ligne de rune vaut un **% de la valeur du tier de la pièce enchantée** (T1 100 x, T2 250 x, T3 400 x, voir Identification ; 25/10/2026, avant : de la valeur de la pièce) ; le niveau (+1 à +3) s'applique aussi. L'écran montre ce que la rune donnera sur la pièce choisie avant de valider.
- **Trésors des tours** (depuis le 22/10/2026, avant : *Coffres*) : *Trésor angélique* et *Trésor démoniaque* de qualité R1 à R7. **Non empilables** (une case par trésor), **rareté Unique** (contour orange foncé) quelle que soit la qualité ; le nom affiché donne la qualité, dans sa couleur : « Antique Trésor démoniaque » (R5). Qualité tirée par le serveur avec les chances de l'identification. Ouverts depuis l'Inventaire, ils donnent **une Rune de la même qualité** ; ses lignes (stat et %) sont tirées à l'ouverture comme une identification de cette qualité (Découverte possible en R6-R7). Rune ange = rune démon.
  - *Ancien* : les *Coffre angélique / démoniaque R1 à R7* (empilables, contour selon la qualité) ne sont plus donnés ; ceux déjà gagnés restent tels quels et s'ouvrent comme avant (décision du 22/10 : pas de conversion).
- Une Rune est une pièce à part (ne s'empile pas, rareté épique) ; seule, elle affiche ses lignes en « % du tier de la pièce ».
- **Aura du stuff** *(décision du créateur, 25/10/2026 ; `AURA` en config)* : une pièce **dessinée sur le mineur** (casque, torse, ceinture, jambes, bottes ; **pioche et épée** quand il les a en main : la pioche en minant, l'épée en frappant, ajout du 25/10) **identifiée R4+** et portant une **vraie rune R4+** émet une aura : un halo de la **couleur de la qualité la plus basse des deux** (en pratique celle de la rune, qui ne dépasse jamais la pièce), qui pulse, dessiné derrière le mineur autour de la pièce. **R4-R5 : faible, R6 : moyenne, R7 : forte.** Un **fragment de rune n'allume pas d'aura**. Visible partout : mine, mine instantanée, tours, portraits (barre du haut, lobby, onglet Stuff). Purement visuel. Ex. : plastron R6 + rune R5 → halo orange faible ; casque R7 + rune R3 → rien.

### Four (onglet Four)
- **Un four au départ** (Four en pierre), jusqu'à **3** *(valeur de config)*. Les fours 2 et 3 sont affichés **sous cadenas**.
- **Four 2 : Four en fer** *(décision du créateur, 21/10/2026)*. L'objet « Four en fer » se fabrique (onglet Craft, recette débloquée par le Four en fer BP) ; dans l'inventaire, son bouton **Utiliser** le consomme et ouvre le four 2, un **Four en fer** qui fond **×1,25 plus vite** (lingot de fer en 48 s). Un seul Four en fer sert : une fois le four 2 ouvert, le bouton dit « four déjà débloqué ». Le **four 3 reste fermé** pour l'instant. Fait par le serveur, en une fois (un double clic ne consomme qu'un objet).
- Un four a **3 cases** :
  - **minerai** : seulement un objet de la famille **ore** ; une seule sorte à la fois ;
  - **combustible** : seulement un objet de la famille **combustible** (le charbon) ;
  - **sortie** : les lingots (fer → Lingot de fer). Une seule sorte : si elle contient d'autres lingots, la fonte attend qu'on les récupère.
- Cliquer une case minerai ou combustible : choisir l'objet, puis la quantité (**saisie libre**, bouton **½** = la moitié de son stock arrondie en dessous, ou **Max**). Cliquer la sortie : les lingots vont dans l'inventaire.
- **Tout retirer** *(22/10/2026)* : un bouton par four, et un en haut de l'onglet pour tous les fours. Toutes les cases (ingrédients, combustible, produits finis) reviennent dans l'inventaire ; une case qui n'y rentre pas reste dans le four, intacte.
- **1 lingot = 10 minerais + 10 charbons** *(provisoire)*. Temps par lingot : **fer 1 min, or 2 min, graphite 1 min** *(graphite : 23/10/2026)*. Le **diamant ne se fond pas** (pas de recette).
- La fonte avance **en temps réel, même page fermée** (le serveur calcule à partir de l'heure de départ). Une **barre de progression** montre l'avancée du lingot en cours.
- Minerais et charbon ne sont consommés qu'**à la fin** d'un lingot : **retirer** une case rend tout ce qu'elle contient, y compris ce qui fondait (le lingot en cours est annulé).
- **Le serveur fait foi** : chaque action est faite par lui, inventaire et four changent ensemble ; une demande renvoyée (double clic) ne s'applique qu'une fois.
- **Deux modes par four** (bouton **Fondre / Alliage** en haut de chaque four) :
  - **Fondre** : ce qui précède (case minerai + combustible) ;
  - **Alliage** : deux cases d'**ingrédients** (dans n'importe quel ordre, ils doivent former une recette) + combustible + sortie.
  - Changer de mode : seulement quand les cases d'ingrédients sont vides (le combustible et la sortie restent en place).
  - Un bouton **?** montre les recettes du mode choisi (ingrédients, combustible, durée).
- **Recettes d'alliage** *(valeurs provisoires ; d'autres viendront)* :

  | Produit | Ingrédients | Combustible | Durée |
  |---|---|---|---|
  | **Tainted iron** | 5 lingots de fer + 15 chitine *(25/10/2026 ; avant 20)* | 50 charbons | 3 min |
  | **Tainted gold** | 5 lingots d'or + 20 peaux de gobelin *(23/10/2026 ; avant : 20 chitine)* | 50 charbons | 3 min |
  | **Steel ingot** *(23/10/2026)* | 3 Tainted iron + 10 Graphite ingot | 50 charbons | 3 min |

### Concasseur (onglet Concasseur) *(demande du créateur, 21/10/2026 ; valeurs provisoires)*
- **8 cases d'entrée** (2 rangées de 4) pour les objets de la famille **bloc** : terre, pierre, pierre dure. Une sorte de bloc par case, quantité libre.
- **8 cases de sortie** en dessous pour le butin ; clic sur une case pour la récupérer, ou bouton « Tout récupérer ».
- Un **cycle par minute**, en temps réel, même page fermée : à la fin du cycle, il concasse **100 blocs** de la **première case qui en a au moins 100**, de haut en bas puis de gauche à droite (case 1 → 8). Une case de moins de 100 est sautée. Les blocs ne sont consommés qu'à la fin du cycle (retirer une case pendant le cycle ne coûte rien).
- **Butin pour 100 blocs** (un tirage par famille : au plus une gemme et un treasure par cycle ; la plupart des cycles ne donnent rien) *(chances données par le créateur le 22/10/2026 ; avant : gemme 0,3 / 0,45 / 0,36 %, treasure 0,01 / 0,015 / 0,02 %)* :

  | 100 blocs | Une gemme (rubis, saphir ou jade, 1/3 chacune) | Treasure |
  |---|---|---|
  | Terre | 0,6 % | T1 : 0,5 % |
  | Pierre | 0,9 % | T2 : 0,3 % |
  | Pierre dure | 1,2 % | T2 : 0,5 % |
- **L'aide « ? » et le wiki n'affichent que la chance par lot** : plus de « 1 lot sur N », ni de moyenne, ni de temps estimé avant un butin *(décision du 22/10/2026)*.
- Les **dernières trouvailles** et le nombre de lots concassés sont affichés sous la machine.
- **Le serveur fait foi** : il tire le butin avec un hasard imprévisible et l'enregistre dès qu'un cycle est fini (un cycle n'est tiré qu'une fois) ; inventaire et concasseur changent ensemble, une demande renvoyée ne s'applique qu'une fois.
- ⚠️ **Ordre de grandeur** (simulation 3 mineurs, 21/10) : une session rapporte ≈ 530 terre + 760 pierre au coffre commun, soit ≈ 4 lots par joueur. Avec les chances du 22/10 : ≈ 1 gemme toutes les 30 sessions par joueur, un treasure toutes les ≈ 60 sessions (avant : 60 et ≈ 2 000). À surveiller : le treasure est 25 à 50 fois plus fréquent qu'avant.

### Table de recherche (onglet Recherche)
Elle sert à **dépenser les Blueprint parts** et à **recycler des blueprints**. Deux sous-onglets :
- **Recherche** : on choisit le **tier**, on pose les parts dans la case (c'est **0 ou le prix du tier**, un clic pose ou retire), puis **Rechercher** : les parts sont dépensées et un **blueprint du tier** arrive dans l'inventaire. Le blueprint obtenu s'affiche dans la **case de résultat** de la table (à droite de la flèche), avec dessous sa **description** : la recette qu'il débloque et les effets de l'objet.

  | Tier | Prix | Blueprints possibles | Recycler un blueprint du tier |
  |---|---|---|---|
  | 1 | 100 parts | ceux d'un Treasure T1 (les 9) | 30 à 60 parts |
  | 2 | 150 parts | ceux d'un Treasure T2 (Gants tactique, Gants d'ouvrier, Cape de Naingui) | 40 à 70 parts |
  | 3 *(23/10/2026)* | 150 parts | ceux d'un Treasure T3 (les six pièces en acier, Plastron de l'équilibre) | 40 à 70 parts *(choix de Claude : comme le tier 2, même prix)* |

  - **Un tier ne s'ouvre que quand le joueur a appris TOUTES les recettes du tier d'avant** *(décision ferme)* : l'option « Tier 2 » est grisée (🔒) avec le nombre de recettes qui manquent, et le serveur refuse aussi. Les blueprints qui ne débloquent encore rien ne comptent pas. Le tier 1 est « fini » avec ses **9 recettes** (Four en fer et Boussole en or comprises depuis le 21/10/2026) ; le tier 2 avec ses **3 recettes** ouvre le tier 3.
  - Tiré au hasard *(décision ferme)* parmi ceux dont la recette **n'est pas encore apprise**. Tirage **pondéré** *(23/10/2026)* : chaque blueprint pèse 1, sauf le **Plastron de l'équilibre BP** (épique) qui pèse **0,25**, soit **4 fois moins** de chance que chaque autre plan (≈ 4 % quand les 7 plans du tier 3 sont possibles ; 100 % s'il est le dernier à apprendre) : un blueprint déjà en stock (pas encore utilisé) peut ressortir ; un blueprint qui ne débloquerait rien resterait toujours possible. Tier entièrement appris : plus rien à tirer.
  - Les blueprints possibles ne sont pas listés (les recettes restent secrètes) : l'onglet n'affiche que leur nombre.
- **Recycle** : on pose un blueprint (n'importe lequel) dans la case, **Recycler** : il est détruit et rend des Blueprint parts **selon le tier du blueprint** : 30 à 60 (tier 1), 40 à 70 (tiers 2 et 3) *(provisoire)*.
- C'est le **serveur** qui fait l'action et tire le hasard (imprévisible) ; un double clic n'agit qu'une fois.
- Repère : recherche puis recyclage = 100 parts contre 30 à 60 (tier 1), 150 contre 40 à 70 (tier 2) : on perd toujours au change (pas de boucle infinie).

### Jugement : Ange contre Démon (Lobby, « Où miner » → Jugement) *(décisions du créateur, 22/10/2026 ; valeurs provisoires, `JUDGMENT` en config ; spec `docs/superpowers/specs/2026-10-22-ange-demon-design.md`)*
Un effort commun à tous les joueurs du serveur.
- **Résidus** : à partir de l'**area 4**, **0,5 % des cases de chaque area au total** sont des résidus, moitié **Résidu angélique** (pierre sombre aux fissures bleu ciel lumineuses), moitié **Résidu démoniaque** (fissures rouges) : 13 par area (6 et 7, le camp du 13e tiré par la seed) *(23/10/2026, Geoffrey ; avant : 0,5 % de chaque, soit 13 + 13 = 1,04 %)*. Tirage à part de la seed, **à la place de pierre normale** *(avant : n'importe quel terrain, pierre dure comprise)* : le reste de la mine ne change pas. Dureté de la pierre dure, **poids 6**, rareté rare ; partagés en fin de session comme les autres blocs. Pas de Fortune, pas de shiny, pas volés par les gobelins, ne comptent pas pour le déblocage. **Visés par l'IA** une fois découverts, au **même poids qu'un treasure** (12 ; *décision du 22/10/2026*, avant : jamais visés, minés seulement en passant). Repère (simulation, 5 parties à 3, mesuré avec le seau ×2 retiré depuis) : 4,2 → 10,8 résidus rapportés par session, valeur des minerais −3 %.
- **Jauges** : en fin de session, le serveur ajoute à la jauge de chaque camp les résidus **versés aux joueurs** (quitter = rien ; une session n'est comptée qu'une fois). **Cap 200** *(24/10/2026 ; ancien 250)*. Jauge pleine → la **tour** de ce camp **ouvre pendant 6 h** et la jauge repart de 0 (surplus perdu) ; elle continue de se remplir pendant l'ouverture. Pleine pendant une ouverture, elle reste à 200 et la tour rouvre dès la fin de l'ouverture en cours.
- **Une tour à la fois** *(décision du créateur, 23/10/2026 ; avant : les deux tours pouvaient être ouvertes en même temps)* : pendant qu'une tour est ouverte, **la jauge de l'autre camp est en pause** (les résidus de ce camp versés pendant ce temps ne comptent pas, et même pleine elle n'ouvre pas) ; à la fermeture, elle reprend (pleine, sa tour ouvre à ce moment). Et **tant qu'une tour est ouverte, les résidus n'apparaissent plus dans les mines** : une mine classique lancée pendant une ouverture n'en contient aucun (décidé au lancement et enregistré dans la session ; à la place, de la pierre). Les mines lancées avant l'ouverture gardent les leurs. L'onglet Jugement affiche la tour de l'autre camp « en pause ».
- **Jugement, dans le Lobby** *(décision du créateur, 22/10/2026 ; avant : un onglet à part, après Session)* : « Où miner » propose **Mine, Mine instantanée, ⚖ Jugement**, puis les tours ouvertes. Jugement remplace les préférences par la carte des jauges, à gauche ; l'**équipe** (son groupe, inviter, quitter) reste à droite comme pour la Mine *(25/10/2026, Geoffrey ; avant : l'équipe disparaissait)*, sans le bouton Lancer (rien ne se lance d'ici ; « Choisir la tour » sélectionne la tour ouverte dans « Où miner »). L'ancienne adresse `#jugement` ouvre le Lobby sur cette carte. Les deux jauges **face à face**, l'Ange (blanc) remplie de la gauche vers le centre, le Démon (violet) de la droite vers le centre, avec « x / 250 ». Sous chacune : tour fermée, ou ouverte avec le temps restant (et « déjà faite » si le joueur a gagné son coffre pendant cette ouverture). Une tour ouverte pas encore faite est signalée par un point sur l'onglet **Lobby** et « ● tour ouverte » sur le bouton Jugement.
- **Tours de l'Ange et du Démon** *(22/10/2026 ; `TOWER` en config, `src/sim/tower/`)* :
  - **Lancement** : Lobby, « Où miner » propose la tour **seulement quand elle est ouverte** (en **mode développeur** : toujours, et sans limite, 25/10) (grisée « déjà faite » si le joueur a déjà gagné son coffre pendant cette ouverture). Groupe de 1 à 3 ; le serveur refuse une tour fermée ou déjà faite par un membre. Un échec ne consomme rien. **10 min de jeu** *(22/10 après-midi ; demandé à 5 min, mesuré infaisable avec le labyrinthe ; avant 15 min)*.
  - **La tour** *(refonte du 23/10/2026, Geoffrey ; avant : 15 × 30 pleine de stonebrick en labyrinthe, découverte autour de chaque mineur, sans lumière ni mobs)* : sur le sol, au milieu du ciel. **20 de large** (murs indestructibles compris) **× 28 de haut** : **6 étages** (0 à 5 ; *25/10/2026, Geoffrey ; avant : 7*) de **3 cases** de haut, chacun surmonté d'une **ligne de séparation indestructible**, puis le **toit** (la séparation du dernier étage) et, au-dessus, à ciel ouvert, le boss. Chaque séparation est percée d'une **porte de 3 cases** en **stonebrick** (4 s depuis le 25/10, avant 6), **collée au mur de gauche ou de droite, en alternance** d'un étage à l'autre (côté du premier tiré par la seed) : on doit **traverser chaque étage en serpentin**. La porte du toit est aussi au bord.
    - **Étage 0** : vide, sans mob ; les mineurs y apparaissent ; une **porte** de 2 cases en bas de chaque mur extérieur.
    - **Étages 1 à 5, en alternance** (le premier tiré par la seed : 3 étages de l'un, 2 de l'autre) : **« blocs »** = plein de stonebrick (4 s, ne rapporte rien) ; **« mobs »** = vide, gardé par **5 Séraphins** (tour de l'Ange) ou **5 Diablotins** (tour du Démon).
    - **Étage « blocs »** *(25/10/2026, Geoffrey)* : la porte du plafond reste **scellée tant qu'il reste un bloc** : il faut **vider tout l'étage**. L'IA mine les blocs du plus bas étage pas encore vidé, le plus proche d'abord ; **chaque mineur réserve le bloc qu'il vise**, les autres en prennent un autre (ils ne se gênent plus) ; en fin d'étage, ceux qui n'ont plus de bloc libre attendent.
    - **Séraphin / Diablotin** : **200 PV**, 2 cases de haut sur 1 de large. Endormis jusqu'à ce qu'un mineur entre dans leur étage ; ensuite ils marchent vers le mineur le plus proche de leur étage (vitesse d'un mob de la mine : 1 case / 0,9 s) et le **taclent** à portée (même tacle que dans la mine depuis le 25/10 : il ne fait que les combattre, jusqu'à leur mort) ; toutes les 1 s ils le **repoussent de 0,25**, et ses coups les repoussent aussi de 0,25. Ils ne quittent pas la ligne du bas de leur étage. **Ils ne s'entassent pas** : plusieurs peuvent être sur la même case, et sur celle d'un mineur *(25/10, Geoffrey ; vrai aussi des mobs de la mine)*. **La porte du plafond reste scellée tant qu'il en reste un vivant.** Pas de butin pour l'instant. La **Provocation** du barbare marche sur eux (comme dans la mine).
    - **Découverte étage par étage** : un mineur qui entre dans un étage découvre **tout l'étage** et son plafond. Le reste est noir.
    - **Lumière** comme dans la mine : il fait noir dans la tour ; les mineurs posent des **torches illimitées** (1 s) quand leur case est trop sombre ; dans le noir, ils vont plus lentement (×0,65).
    - Ni oxygène, ni pods, ni butin des blocs. Gravité ; échelles **dans la tour seulement** (illimitées, partagées ; deux mineurs ne posent pas la même échelle ni ne creusent le même bloc : le second attend).
  - **IA** : s'il y a des mobs réveillés, tous vont les combattre (taclé : il frappe celui qui le tient ; sinon un mob à son contact (le plus blessé), ou il va vers le plus proche). Sinon elle monte vers le toit au plus court avec ce qui est découvert (une case inconnue est supposée de la brique), puis va au contact du boss. **Le barbare se place du côté opposé aux autres mineurs** (la majorité ; tant qu'ils sont dans la tour : le côté de la porte du toit) ; deux barbares vont du même côté ; sans autre mineur, les barbares se répartissent (un de chaque côté). Si son côté n'existe pas (boss collé au bord), il frappe d'où il est. **On passe derrière le boss** pour changer de côté *(choix de Claude à valider : sans ça, le barbare ne peut pas rejoindre le côté opposé, la porte du toit étant au bord)*.
  - **Boss** (Ange / Démon) : **3 500 PV** *(23/10, Geoffrey ; essayés le matin : 2 000 puis 5 000 ; avant 1 000)*, 3 × 5 cases, au milieu du toit au départ. **Refonte du 25/10/2026 (Geoffrey)** ; valeurs provisoires dans `TOWER.boss` :
    - **Focus** : il vise **le premier arrivé à son contact**, ou **le barbare qui le provoque** (il est provocable depuis le 25/10 ; avant : non) ; il **ignore les autres mineurs**. Son focus tombé du toit, il en prend un autre (premier arrivé au contact, sinon premier arrivé sur le toit) ; plus personne sur le toit : il **retourne au centre**.
    - **Le combat commence au premier coup qu'il reçoit** ; ensuite il **suit son focus** quand celui-ci n'est plus à son contact (2 × la vitesse d'un mineur de base), **à travers les autres mineurs** : ceux qui se retrouvent dans sa hitbox **y restent** *(une règle « il les remet dans son dos » a été essayée puis retirée le 25/10)* et **peuvent le frapper de là**, comme depuis les cases à côté de lui.
    - **Coups** : toutes les **1 s** (**0,5 s sous 33 %** de ses PV, la rage), sur son focus seulement. Chaque coup a **25 %** de chance (**10 %** pour un barbare ; en rage **35 % / 20 %**) de le **projeter de 5 cases** vers l'extérieur *(25/10 : essayés 35 / 20 % puis 50 / 25 % en rage, 6 puis 4 cases)* ; sinon il le **repousse de 0,5** (petit arc de 0,5 bloc à l'écran). Projeté au-delà du bord de la tour, le mineur **tombe jusqu'au sol**, étourdi 5 s, et **remonte tout**.
    - **Treuil du logisticien** *(décision du créateur, 25/10/2026 ; `TOWER.winch`)* : la **première fois** qu'un logisticien qui a le skill **Treuil** tombe **au pied de la tour** (dehors), après son étourdissement il va contre le mur extérieur, **de son côté**, et y reste **10 s** : un **treuil** apparaît, du sol jusqu'à la hauteur du toit (un pas de côté en haut, et on est sur le toit). **Un seul par partie** (une chute suivante, ou d'un autre logisticien, n'en pose pas d'autre). Il marche **comme le treuil de la mine** : on y tient, chacun à son rythme, sans capacité, à 0,85 × la vitesse de montée, **Escalateur** du groupe compris. L'IA le prend d'elle-même quand c'est le plus court (tombé de l'autre côté, elle traverse l'étage 0 si ça vaut le coup). Repère (simulation, 2 mineurs 1,1 / 10 + 1 logisticien, 10 tours) : remontée après une chute **28 à 43 s** sans treuil (échelles déjà posées, étourdissement compris) → **18 s** avec ; le toit étant atteint vers 8 min, le treuil arrive tard (7 min 30 à 9 min 40) : boss laissé à ≈ 1 650 PV au lieu de ≈ 1 820 (5 tours).
    - **Recul du boss** : seuls les coups de **son focus** le repoussent (recul du mineur, avec **25 %** de résistance) ; les coups des autres, non.
    - **Saut** : à **75, 50 et 25 %** de ses PV (un seul saut si un coup en fait passer deux), il file au centre du toit et monte à **5 blocs** : **3 s en l'air**, **intouchable**, il ne frappe plus ; les mineurs **s'écartent** de sa zone d'atterrissage. À l'atterrissage, il **repousse tous les mineurs du toit de 3 cases** vers l'extérieur, puis **étourdit 3 s** ceux qui sont restés sur le toit (la **ténacité** peut l'éviter).
  - **Fin** : boss vaincu = fin, **chaque joueur présent reçoit un Trésor angélique / démoniaque** (qualité R1 à R7 tirée par le serveur, voir Enchantement ; à l'ouverture, une rune et parfois un anneau, voir Stuff) et la tour est « faite » pour lui jusqu'à la prochaine ouverture. 10 min écoulées = rien. Pas d'XP.
  - **Affichage** : caméra rapprochée **aussi large que la tour** (22 × 16 cases ; avant 19 × 15) qui suit ton mineur ; mineurs, mobs et boss **glissent** entre deux envois du serveur, comme dans la mine (25/10 : avant, ils avançaient par sauts) ; étages non découverts en noir, ombre selon la lumière des torches, mobs avec leur barre de vie.
  - Repères **à 3 500 PV** (23/10, 20 tours, sans skill) : 3 mineurs de base 0/20 ; 2 mineurs + 1 barbare à 1,1 / 10 **0/20** (il reste 10 à 660 PV) ; 2 barbares à 15 dégâts + 1 mineur à 1,3 **12/20** (victoire à 9 min 53). À 5 000 PV : b et c 0/20.
  - Repères à 2 000 PV (simulation `npm run simulate:tower -- --count 20`, 23/10, sans rang de skill) : **3 mineurs de base 0/20** (étage 6 atteint à 8 min 30, jamais le toit) ; **2 mineurs + 1 barbare à minage 1,1 / 10 dégâts : 18/20** (toit à 8 min 12, victoire à 9 min 19) ; **2 barbares à 15 dégâts + 1 mineur à minage 1,3 : 20/20** (toit à 8 min 20, victoire à 9 min 16). ≈ 85 % du temps passe à monter : un étage de blocs ≈ 1 min 40 à 3, un étage de mobs ≈ 1 min en stuff de base, 30 à 40 s avec 10-15 dégâts. *(Ancien, tour en labyrinthe : base 0/10, minage 1,6 + 14 dégâts 10/10 en ≈ 7,5 min.)*

### Mine instantanée (MI) *(décisions du créateur, 21/10/2026 ; valeurs provisoires, `INSTANT_MINE` en config)*
Un rendez-vous court et compétitif : tous les inscrits dans la même mine, **chacun pour soi**, quelques minutes pour tout piller.
- **Quand** : toutes les **2 h pile, heure de Paris** (0 h, 2 h, 4 h… ; heure d'été comprise). Dure **5 min de jeu** (2 min 30 réelles à ×2).
- **La mine** : **50 × 50** blocs, **que des minerais** : 20 % charbon, 40 % fer, 33 % or, 5 % graphite, 1 % diamant, et **1 % de tas de plumes d'ange** *(23/10/2026, Geoffrey ; avant : 39 % or, ni graphite ni diamant)*. Entièrement **éclairée**, mais **cachée au départ** *(22/10/2026, décision du créateur)* : comme dans la mine normale, chaque mineur **découvre** les cases autour de lui dans un rayon de sa stat **Découverte** (le rayon entier, puisque tout est éclairé) ; ce qui est découvert l'est pour tout le monde. Un mineur ne va chercher qu'un tas de plumes **déjà découvert**. Le navigateur ne reçoit jamais le contenu des cases cachées (seulement le nombre de tas restants) ; (pas de torche). Pas d'oxygène, pas de pods, pas de mobs. **Gravité comme dans la mine normale** *(22/10/2026 ; avant : il volait dans les galeries)* : sans appui, le mineur tombe ; pour **remonter**, il pose une **échelle** (temps de pose et skills comme dans la mine normale, échelle de 2 comprise). Échelles **illimitées** et **partagées** (tout le monde peut prendre celles des autres). Pas de limite de chute ni d'étourdissement ici (mine de 5 min).
- **Départ** : les mineurs apparaissent sur la ligne de surface, au-dessus de la mine, **espacés régulièrement**.
- **Tas de plumes d'ange** : une case **vide** portant un tas de plumes. Le **premier mineur qui arrive sur la case** le ramasse (le tas disparaît) et gagne **1 à 2 Plumes d'ange** *(22/10/2026 ; avant 1 à 5)* (rareté **rare**). **Priorité aux tas découverts** *(22/10/2026, décision du créateur ; avant : seulement à 3 pas par les galeries)* : dès qu'un tas **découvert** est à **8 cases ou moins** (à vol d'oiseau), le mineur le plus proche (égalité : le plus petit numéro) y va avant tout, **même s'il est enfermé dans la roche** : il creuse droit vers lui. Les autres mineurs continuent leur travail. **Galeries** *(22/10/2026)* : chaque mineur a un **cap** (gauche, droite, bas, haut, diagonales) qu'il garde 6 à 14 blocs puis change au hasard ; miner à contre-sens de son cap coûte une pénalité (`INSTANT_MINE.headingWeight`). Résultat : les galeries partent dans tous les sens au lieu d'un puits droit jusqu'au fond (3 mineurs : 4 sur 18 touchent le fond, contre 18 sur 18). **Descente** *(24/10/2026, Geoffrey)* : miner le bloc sous ses pieds compte comme un pas (`INSTANT_MINE.downWeight`, 1 × le temps d'un pas). Avant, descendre était gratuit (il tombe tout seul) alors qu'aller sur le côté demande un pas : les caps en diagonale vers le bas devenaient des puits et les mineurs fonçaient au fond (3 mineurs, 20 parties : 26 sur 60 au fond, 2 sur 60 après ; 42 % → 25 % des blocs dans la moitié basse). Plusieurs mineurs peuvent courir vers le même tas : le premier arrivé le prend.
- **Chacun son butin** : ce qu'un mineur mine est à lui, **pas de partage, pas d'XP**. Si deux mineurs minent le même bloc, **celui qui finit en premier** gagne le minerai ; l'autre perd son travail sur ce bloc.
- **Le stuff compte** : vitesse de minage, vitesse de marche, **Fortune** et **shiny** s'appliquent comme en session. Les spécialisations restent choisies mais n'ont pas d'effet particulier ici.
- **IA du mineur** : tous les blocs valent pareil (aucune priorité de minerai) ; il creuse dans tous les sens, vers le bloc le moins coûteux en temps, en **évitant les zones où il y a déjà d'autres mineurs** (pénalité par mineur proche et par bloc déjà visé par un autre). S'il perd **3 blocs d'affilée** (un autre les a finis avant lui), il **change de zone** (il ne suit pas indéfiniment un mineur plus rapide).
- **Plusieurs mines** : au plus **20 joueurs par mine** ; au-delà, les inscrits sont répartis en mines de tailles égales (21 inscrits → 11 + 10). Un inscrit seul joue seul.

**Lobby MI** (onglet **Lobby**, « Où miner » → **Mine instantanée** ; un joueur inscrit retrouve son lobby sur ce choix) :
- Un compte à rebours affiche « La mine instantanée commence dans Xh Xmin Xs ».
- **Inscriptions ouvertes seulement dans les 30 dernières minutes** *(décision du créateur, 22/10/2026 ; `INSTANT_MINE.signupBefore` ; avant : à toute heure)* : 11 h 29 fermé (bouton « 🔒 Inscriptions à 11 h 30 »), 11 h 30 ouvert, pour la mine de 12 h. Le serveur refuse aussi une inscription hors de cette fenêtre (mode dev : à toute heure).
- **On peut s'inscrire pendant une session** (normale ou tour) *(22/10/2026 ; avant : refusé)* : « Mine instantanée » reste choisissable dans le lobby en lecture seule, et la carte prévient « si ta session n'est pas finie à l'heure, tu rates la mine ». **Encore en session à l'heure pile** : le joueur **rate la mine instantanée**, sa session continue, son inscription est effacée. Lancer une session normale **ne désinscrit plus**.
- **La MI ne touche pas aux groupes** *(23/10/2026, Geoffrey)* : il n'y a pas de lobby de MI, on s'y inscrit **seul** (pas d'invitation pour la MI). S'inscrire ou entrer dans la mine **ne fait pas quitter son groupe** : pendant la MI, le joueur compte comme « en session » pour son groupe (le chef ne peut pas lancer sans lui), et après la mine il est **toujours dans le même lobby**. *(Ancien : s'inscrire hors session faisait quitter le groupe ; inscrit en session, on le quittait en entrant dans la mine.)*
- À l'heure dite, les inscrits (qui ne sont pas en session) partent tous dans la mine ; personne ne la rejoint après le début.
- **Après la mine instantanée, le joueur n'est dans aucune session** (ni mine instantanée ni mine normale) : il revient au lobby, libre *(règle du créateur, 22/10/2026 ; testée)*.
- **Fermer l'onglet ne change rien** (la partie tourne sur le serveur, le butin arrive à la fin). **Seul le bouton Quitter fait tout perdre** : quitter avant la fin = rien.

**Rappels** (seulement si la page du jeu est ouverte, dans n'importe quel onglet ; **aussi pendant une session normale** depuis le 22/10, puisqu'on peut s'y inscrire ; jamais pendant la mine instantanée elle-même) :
- « La mine instantanée commence dans 30 min » (« les inscriptions sont ouvertes »), puis 15 min, puis 5 min : simple information.
- « La mine instantanée commence dans 30 secondes » : information **et invitation**, boutons **Rejoindre** / **Décliner** (pour un joueur déjà inscrit : information seule).

**Pendant la mine** (onglet **Session**, tout le monde y bascule à l'ouverture) : la mine vue de près, **la caméra suit ton mineur** *(22/10/2026 ; avant : toute la mine à l'écran)*, environ 24 colonnes de large et autant de lignes que l'écran le permet (`INSTANT_MINE.camCols`), le chrono (5 min de jeu), ton butin, le classement (blocs minés, plumes), le journal, et **Quitter la mine**. À la fin, un bilan : ce qui est versé, le classement.

**Le serveur fait foi** : il ouvre la mine à l'heure, répartit les inscrits, fait tourner la partie et verse à chacun son butin **une seule fois** à la fin.

### Comptes joueur
Pas d'adresse e-mail. Détails techniques : `docs/comptes.md`.
- Au lancement, écran de connexion : **se connecter** (pseudo + mot de passe), **créer un compte**, ou **jouer en invité** (1 clic).
- Un **invité** n'a ni pseudo ni mot de passe : son compte n'existe que dans ce navigateur. Il peut le **sécuriser** à tout moment (pseudo + mot de passe) sans rien perdre.
- Chaque compte a un **ID de compte** public et définitif (ex. `7K3Q-9XHP`), qui sert à inviter un ami dans son groupe (et servira à ajouter un ami). C'est à cet ID qu'est rattaché tout ce que possède le joueur.
- **Pseudo** unique (sans tenir compte des majuscules ni des accents), 3 à 16 caractères *(valeurs de config)*.
- Mot de passe oublié : un **code de secours** est donné à la création (montré une seule fois) ; avec pseudo + code, on choisit un nouveau mot de passe.
- Le compte est visible en bas de la barre de navigation (pseudo + ID, ou « Invité · à sécuriser ») ; un clic ouvre « Mon compte ».
- L'inventaire est rattaché au compte et stocké **sur le serveur** : on le retrouve sur n'importe quel appareil.

## 7. Vision long terme (à ne pas casser)

### Multijoueur
- La mine s'explore à **3 joueurs** (lobby entre amis). Le monde est le même pour tous (même seed).
- **Coffre commun** : un seul coffre au spawn, tout le monde y dépose ; on affiche la contribution de chacun. En fin de session il est partagé à parts égales (§6, « Partage du coffre »).
- **Les mineurs se traversent** : deux mineurs peuvent être sur la même case (pas de blocage dans les galeries d'un bloc ni sur les échelles).
- **Coordination des IA (réservation)** : chaque mineur reste indépendant, mais ne vise pas un minerai déjà visé ou en cours de minage par un autre, évite une ligne de galerie qu'un autre creuse, et ne creuse pas dans un puits qu'un autre creuse sous lui (il se décale d'au moins 3 colonnes). En cas de conflit, le plus petit numéro garde la cible.
- **Répartition dans la mine** *(valeurs provisoires)* : pour ne pas se marcher dessus,
  - **filon réservé** : un minerai à moins de 4 blocs de la cible d'un autre est exclu ; un minerai proche d'un autre mineur vaut moins ;
  - **secteur de préférence** : chacun a un tiers de la largeur (1er mineur à gauche, 2e au centre, 3e à droite) ; un minerai hors secteur vaut moins. Préférence douce : il en sort si c'est plus rentable ;
  - **descente commune** : après le coffre, s'il existe déjà un chemin vers le fond (puits creusé, treuil) qui vaut mieux qu'un puits neuf, il le prend, même hors de son secteur (on se répartit au fond, pas pendant la descente) ; sinon il rejoint la colonne au centre de son secteur pour ouvrir son puits ;
  - pas de torche en double quand deux mineurs arrivent ensemble dans le noir.
- Les retours peuvent partager la même grande échelle (c'est le chemin le plus rapide) ; à l'écran, les mineurs sur la même case sont légèrement décalés.
- **Fin de session** (aussi en solo) : un mineur ne repart de la surface que s'il reste le temps de l'aller, de 30 s de travail et du retour (estimés d'après la durée de son dernier retour).
- Échelles, torches, passerelles et galeries sont partagées : chacun profite de ce que les autres ont construit. Le déblocage des areas est commun.
- Les bestioles poursuivent le mineur le plus proche ; n'importe quel mineur peut être taclé.
- Prototype actuel : les 3 mineurs ont la même IA et les mêmes stats (pas encore de spécialisation).

### Spécialisation
Chaque joueur se spécialise :
- **Mineur** : extrait les ressources.
- **Logisticien** : rend la mine plus navigable (échelles, fondations, galeries).
- **Fighter** : se débarrasse des mobs.

### Préférences de l'IA (options futures)
Le comportement du mineur est configurable. Exemples prévus :
- préfère miner dans un endroit navigable ?
- préfère fuir un mob plutôt que de se battre ?

Déjà en jeu, dans « Critères / préférences » du lobby : priorité `minerais` ou `descendre`, combattre les mobs oui/non, aider allié oui/non + mobs ignorés (`PREF_OPTIONS`, `PREFS.helpIgnore` en config). Les autres arriveront une par une, chacune avec ses tests de blocage.

### Questions ouvertes (gravité)
- ~~Une chute fait-elle perdre du temps ?~~ Réglé : chute imprévue de 3 cases ou plus = étourdi 5 s (§3, Chutes).
- Une échelle arrête-t-elle la chute ? (Recommandé : oui.)
- Le mineur peut-il remonter après une chute dans un trou sans échelle ? (L'IA doit poser des échelles pour revenir : cas de blocage à tester.)

## 8. Contraintes de dev

- Le temps de jeu est **réel (1h)** ; en dev, on doit pouvoir **accélérer** la simulation pour tester vite (x5 à x300 dans le prototype).
- Les valeurs d'équilibrage doivent être modifiables facilement.
