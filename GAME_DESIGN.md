# Deep Idle Mine — Game Design

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
- **Déblocage de l'area suivante** : miner un seuil de minerais de l'area courante, par défaut **40%** des minerais.
  - Exemple area 0 : 40% de 250 charbons = 100 charbons.
  - Tant que le seuil n'est pas atteint, le fond de l'area est une **barrière infranchissable** : un bloc spécial « Barrière », incassable, qui délimite les deux areas. Pour l'IA c'est une case non franchissable, ignorée dans ses chemins. Quand l'area suivante se débloque, la barrière disparaît.
- L'area suivante se trouve **en dessous** de l'actuelle : l'expérience voulue est le « going deep ».
- Seules les areas débloquées ont besoin d'exister en mémoire ; la profondeur est quasi gratuite.
- **La couche 1 du monde (juste sous la surface) est toujours en terre.** Elle **ne fait partie d'aucune area** (pour ne pas fausser les pourcentages) : l'area 0 occupe les couches 2 à 51, l'area 1 les couches 52 à 101, etc.
- Le **coffre** est généré au spawn, sur la surface. Les ressources déposées dedans partent dans l'inventaire global à la fin de la session du joueur.

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
- **ingot** : les lingots sortis du four.

### Compositions des areas

| Area | Terre | Pierre | Pierre dure | Charbon | Fer | Or | Diamant | Vide |
|---|---|---|---|---|---|---|---|---|
| 0 | 52 | 33 | – | 10 | – | – | – | 5 |
| 1 | 30 | 49 | – | 15 | 1 | – | – | 5 |
| 2 | 20 | 55 | – | 10 | 10 | – | – | 5 |
| 3 | 10 | 60 | 5 | 7 | 10 | 3 | – | 5 |
| 4 | – | 60 | 15 | 5 | 10 | 5 | – | 5 |
| 5+ | – | 55 | 20 | 3 | 8 | 7 | 2 | 5 |

La dernière ligne se répète au-delà. Les comptes sont exacts, pas probabilistes (arrondis absorbés par le terrain principal).
- Les minerais sont générés en petits filons (1 à 4 blocs).
- Le **vide** est généré en petites poches (1 à 4 cases) : des cavités naturelles, cachées tant que le mineur ne les a pas découvertes. Le mineur peut y tomber (gravité). Les bestioles n'apparaissent pas dans une poche encore cachée.
- **Pierre dure** : roche des areas profondes, deux fois plus longue à miner que la pierre (dureté 2,4, poids 3 *(provisoire)*).

### Treasures
Vocabulaire : le **treasure** est l'entité enfouie dans la mine (on peut l'appeler « coffre » à l'oral, c'est bien un treasure, pas le coffre de dépôt de la surface) ; l'**objet** qu'il donne s'appelle **Treasure TX**, X étant son tier.
- Chaque area a une **probabilité** qu'un treasure y soit enfoui : **30 %** par défaut *(provisoire, réglable area par area)*. Le tirage dépend de la seed : même seed, même treasure.
- Le treasure remplace un bloc de terrain au hasard dans l'area.
- **Butin** *(décision ferme)* : **1 objet Treasure TX**, **aucun minerai**. Le tier dépend de l'area où le treasure est enfoui :

  | Areas | Objet |
  |---|---|
  | 0 à 2 | **Treasure T1** |
  | 3 à 5 | **Treasure T2** |

  Au-delà de l'area 5, le dernier tier s'applique (T2) *(provisoire, en attendant un T3)*. Poids 2 *(provisoire)*. Rien dans ce butin ne compte pour le déblocage de l'area.
- **Ouvrir un Treasure TX** *(décision ferme)* : hors session, depuis l'onglet Inventaire (sélectionner le Treasure, bouton « Ouvrir »). Le Treasure est consommé, son contenu arrive dans l'inventaire et une petite fenêtre présente le butin obtenu (objets rares en tête). C'est le **serveur** qui tire le contenu, avec un hasard qu'on ne peut pas prévoir (pas la seed). Un Treasure TX sans table de butin ne s'ouvre pas encore (T2 pour l'instant).
- **Contenu du Treasure T1** *(valeurs provisoires)* :

  | Objet | Quantité | Chance |
  |---|---|---|
  | Blueprint parts | 5 à 15 | 100 % |
  | Charbon | 100 à 150 | 100 % |
  | Fer | 50 à 80 | 100 % |
  | **Un blueprint** parmi : Pioche en fer, Épée en fer, Casque en fer, Plastron en fer, Jambes en fer, Bottes en fer, Four en fer, Boussole en or, Ceinture en peau de gobelin | 1 | 1 % chacun (9 % au total) |
  | **Une gemme** parmi : Rubis inférieur, Jade inférieur, Saphir inférieur | 1 | 1 % chacune (3 % au total) |

  *(décision ferme)* un seul tirage par famille : jamais deux blueprints ni deux gemmes dans le même Treasure. Le charbon et le fer sont les mêmes objets que ceux de la mine (ils s'empilent avec). Usage des blueprints et des gemmes : défini plus tard avec le craft.
- L'IA vise un treasure **une fois découvert** (comme un minerai très rentable) ; la boussole ne le signale pas.
- Le panneau d'area affiche la probabilité, puis le tier trouvé une fois le treasure ouvert.
- Dans l'inventaire, chaque tier a son icône (T1 : ferrures argent, T2 : ferrures or).

## 3. Le mineur

### Déplacement
- **Le mineur est soumis à la gravité** : s'il y a du vide sous lui, il tombe case par case (8 blocs/s *(provisoire)*) jusqu'à atterrir sur un bloc solide ou **sur une échelle**. Il ne tombe pas s'il est sur une case avec échelle, ni s'il est posé juste au-dessus d'une case avec échelle. *(À définir : dégâts ou ralentissement de chute, voir questions ouvertes.)*
- Le mineur ne peut pas sauter. Actions possibles : **aller à gauche/droite, miner, poser une échelle**.
- **Descente** : le mineur creuse le bloc sous lui et se laisse tomber. **Il ne pose pas d'échelle en descendant.**
- **Échelles posées seulement au retour** : quand il doit remonter, il pose une échelle (2 s) sur chaque case où il en a besoin. Le chemin de retour est choisi au plus court en temps ; les échelles posées restent et servent aux trajets suivants. Un chemin de retour existe donc toujours (il peut toujours poser une échelle et creuser au-dessus de lui).
- Pour choisir où creuser, l'IA compte d'avance ce coût de retour : une case creusée vers le bas = une échelle à poser plus tard.
- **Vitesse de montée** : stat à part (2,25 blocs/s *(provisoire)*, soit ×0,75 de la marche), utilisée sur échelle dans les deux sens. Elle s'améliore indépendamment de la vitesse de marche. Conséquence voulue : pour remonter, l'IA choisit un chemin au **temps** le plus court et préfère marcher horizontalement vers une échelle existante plutôt que de remonter tout droit en posant de nouvelles échelles.
- **Creuser vers le bas ou vers le haut coûte plus cher qu'horizontalement** : chaque case verticale impose une échelle (2 s de pose) et se parcourt plus lentement (vitesse de montée), à l'aller comme au retour. L'IA compte ce coût (pose + trajets futurs) quand elle choisit un minerai : elle préfère donc les galeries.
- **Passerelle** : un bloc que le mineur pose (1 s *(provisoire)*) pour **combler un trou** et le traverser horizontalement. C'est plus rentable qu'une chute suivie d'échelles pour remonter. **Il ne peut la poser que s'il tient lui-même** (sur un bloc ou sur une échelle), jamais dans le vide ; depuis une échelle, il peut en poser à gauche ou à droite. Plus généralement, le mineur ne peut agir que depuis une case où il tient : l'IA ne prévoit jamais de s'arrêter dans le vide. Le mineur en porte 10 *(provisoire)*, rechargées en surface ; la passerelle est cassable et ne rapporte rien. *(À définir : faut-il un coût en ressource ?)*
- **Montée** : uniquement par échelle. Pour creuser vers le haut, il pose une échelle avant de miner le bloc du dessus.
- Les « fondations » (boucher un trou) sont prévues mais pas encore implémentées.

### Autonomie (IA)
Le mineur décide seul. Le joueur influence l'IA via les stats, l'équipement et les **préférences** (voir §7).
- Par défaut il creuse vers le bas.
- **Après un retour en surface, il repart de zéro** : il n'est pas obligé de retourner là où il s'était arrêté. Un minerai connu mais lointain (plus de 12 blocs *(provisoire)*) n'est pas plus attirant que creuser du neuf.
- **Réutiliser l'existant** : pour descendre ou changer de galerie, l'IA compare le temps d'un trajet par les échelles et galeries déjà posées au temps d'un nouveau puits (mine + échelle à chaque case), et prend le moins cher.
- La **boussole** aide l'IA à choisir : s'il vaut mieux aller sur les côtés vers un minerai plutôt que descendre.
- Quand le fond de l'area est verrouillé, il explore en **galeries** horizontales pour trouver les minerais manquants.

### Focus minerai
Pendant la session, un panneau **Focus minerai** de l'onglet Mine permet de choisir, minerai par minerai, ce que vise le mineur du joueur. Il ne propose que les minerais **présents dans les areas débloquées** (la liste grandit avec les déblocages) et affiche, pour chacun, le restant sur le nombre initial.
- Trois modes par minerai : **Aucun** (normal), **Cibler** (le minerai pèse plus lourd que le plus gros minerai : 2 × la valeur du diamant *(provisoire)*), **Uniquement** (l'IA ne vise que les minerais « Uniquement » et ignore les autres).
- **« Uniquement » écrase « Cibler »** : dès qu'un minerai est en « Uniquement », les minerais en « Cibler » sont ignorés aussi.
- **Seuls les blocs de type ore sont concernés** : les treasures découverts restent visés. D'autres cibles (coffres, pierres précieuses…) pourront s'ajouter plus tard.
- Le jeu connaît, pour chaque area, le **nombre initial et le restant** de chaque minerai.
- **Area épuisée** : s'il reste moins de **20 %** *(provisoire)* du nombre initial d'un minerai visé dans l'area du mineur, il part vers **l'area débloquée la plus proche** qui en a encore (au-dessus ou en dessous ; à égalité, celle du dessous). Il ne descend pas non plus dans une area épuisée : il explore la sienne en galeries.
- **Épuisé partout** : si toutes les areas débloquées sont sous le seuil pour ce minerai, son focus **saute** et un message prévient le joueur dans le panneau.
- Le serveur **enregistre chaque changement avec son tick** (comme un départ) et le rejoue : la partie affichée et la partie du serveur restent identiques. Un changement prend effet ~1 s de jeu après le clic *(valeur de config)*.

### Focus area
Pendant la session, un panneau **Focus area** de l'onglet Mine permet de choisir **où** travaille le mineur du joueur :
- **Plus profond** *(option de base)* : comportement normal, il descend jusqu'à l'area débloquée la plus profonde.
- **Une area précise** (0, 1, 2…) : seules les **areas débloquées** sont proposées (la liste grandit avec les déblocages). Le mineur rejoint cette area (il descend ou remonte), y reste, ne descend pas plus bas et **ne vise que les cibles de cette area** (minerais et treasures).
- **Area vidée** *(décision ferme)* : s'il reste moins de **20 %** *(même seuil que le focus minerai, provisoire)* de tous les minerais de l'area choisie, le focus area **saute** : retour à « Plus profond », avec un message dans le panneau. Le mineur ne perd pas la fin de session à creuser des galeries vides (en simulation, 3 mineurs vident l'area 0 en ~25 min).
- **Avec le focus minerai** *(décision ferme)* : le focus area décide **où** va le mineur, le focus minerai décide **ce qu'il vise** dans cette area. Si l'area choisie passe sous le seuil pour un minerai visé, ce focus minerai saute (message dans le panneau), le focus area reste.
- Choisir une area plus haute empêche de débloquer les suivantes (rien n'est miné dans la dernière) : c'est un arbitrage du joueur.
- Même enregistrement que le focus minerai (clé `area`) : changement enregistré avec son tick par le serveur, puis rejoué.

### Caractéristiques
| Stat | Rôle | Valeur de base |
|---|---|---|
| Oxygène | Temps passé sous terre | 300 *(ferme, soit 5 min)* |
| Vitesse | Déplacement horizontal (marche) | 3 blocs/s *(provisoire)* |
| Vitesse de montée | Déplacement sur échelle (montée et descente) | 2,25 blocs/s *(provisoire)* |
| Vitesse de minage | Divise le temps de minage | 1 *(provisoire)* |
| Dégâts | Dégâts par coup contre les mobs | 5 *(provisoire)* |
| Pods | Poids d'inventaire | 200 *(provisoire)* |

### Oxygène
- 1 seconde dans la mine = 1 d'oxygène consommé.
- En surface : +30 par seconde.
- **Quand l'oxygène atteint 0, le mineur remonte** (il termine l'action en cours, puis part). Il n'anticipe pas le trajet de retour.
- **Il n'a pas besoin d'oxygène pour remonter** : à 0, il n'est ni mort ni ralenti, la remontée se fait à vitesse normale. L'oxygène mesure donc exactement son temps de travail sous terre.

### Pods (inventaire)
- Chaque bloc a un poids (terre 1, pierre 2, pierre dure 3, charbon 2, fer 3, or 4, diamant 5, Treasure TX 2 *(provisoire)*).
- Inventaire plein : remontée **automatique**, dépôt dans le coffre, puis retour au front.

### Valeur des stats : unité x *(méthode ferme, chiffres provisoires)*
Toutes les stats se comparent dans une seule unité : **x = 1 seconde de travail du mineur**. Une session vaut 3 600 x.
- Chaque stat gouverne un temps de la session (T_stat) : la vitesse de minage gouverne le temps de minage, les pods le temps des allers-retours qu'ils déclenchent, etc.
- **Un bonus b sur une stat de base B fait gagner T_stat × b / (B + b) x par session** (rendements décroissants : doubler une stat divise son temps par 2, pas plus). Pour un petit bonus, 1 point ≈ T_stat / B.
- Les ressources se convertissent par le rendement du mineur de base : 522 points de valeur par session, soit **1 charbon ≈ 7 x**, 1 fer ≈ 14 x, 1 or ≈ 28 x, 1 diamant ≈ 55 x.
- Les valeurs dépendent du niveau du mineur (ex. : quand les pods augmentent, l'oxygène redevient limitant et prend de la valeur) : à recalculer par palier. Outil : `node scripts/stat-values.js`.

Mineur de base, 1 mineur, 5 sessions :

| Stat | Base | T_stat (s/session) | 1 point = | +10 % = |
|---|---|---|---|---|
| Vitesse de minage | 1 | 1 301 | 1 301 x (+0,1 = 118 x) | 118 x |
| Vitesse (marche) | 3 | 718 | 239 x (+0,1 = 24 x) | 65 x |
| Vitesse de montée | 2,25 | 555 | 247 x (+0,1 = 25 x) | 50 x |
| Pods | 200 | 1 036 | 5,2 x | 94 x |
| Oxygène | 300 | 109 | 0,4 x | 10 x |
| Dégâts | 5 | 202 | 40 x | 18 x |
| Rayon des torches | 5 | 136 | 27 x | 12 x |
| Torches (nombre) | 20 | 16 | 0,8 x | 1 x |
| Découverte, vision, boussole, passerelles | – | effet indirect | à mesurer (`npm run weights`) | – |

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
- Types prévus :
  - **Bestioles** : apparaissent dans les tunnels (posées au sol) et se rapprochent du mineur. **Elles suivent la même physique que le mineur** : gravité, pas de saut, montée uniquement par une échelle (×0,75), descente par l'échelle ou en se laissant tomber. Elles ne creusent pas et ne posent rien.
    - **Tacle** : la bestiole va jusque sur la case du mineur. Tant qu'elle est sur lui, **il ne peut plus bouger** (son action en cours est interrompue, sauf une chute) et il la combat obligatoirement, même si l'option « combat les mobs » est désactivée et même s'il remonte. C'est le mécanisme principal de ralentissement. Elles laissent de la **chitine** (1 à 2, poids 1) *(provisoire : ressource du prototype, sans usage tant que le craft n'est pas défini)*.
  - **Gobelins** : bestioles voleuses des areas profondes. Même physique et même **tacle** que les bestioles, un peu plus résistants (30 PV en area 3, contre 20 *(provisoire)*). Ils remplacent une partie des apparitions de bestioles (même minuterie, même plafond de mobs) : à partir de l'**area 3**, **25 %** des apparitions sont des gobelins *(provisoire)*.
    - **Vol** : toutes les **2 secondes** de tacle, le gobelin vole **un minerai** (bloc de type ore : charbon, fer, or, diamant) tiré au hasard dans l'inventaire du mineur taclé, chaque unité ayant la même chance. Le minerai volé est **perdu** (il ne revient pas quand on tue le gobelin). Il ne vole ni terre, ni pierre, ni butin de mob, ni Treasure TX. Rien à voler : rien ne se passe.
    - **Butin** : **peau de gobelin** (1 à 2, poids 1) et **chitine** (1) *(provisoire : sans usage tant que le craft n'est pas défini)*.
    - Intention : un mineur qui tue vite perd peu ; c'est une raison concrète d'améliorer ses dégâts pour les areas profondes.
  - **Mimics** : faux minerais, visibles à la boussole comme des minerais. Ils se dévoilent à proximité. Les vaincre rapporte des minerais. Comme les bestioles, un mimic dévoilé ne déclenche le combat que s'il est dans le champ de vision du mineur.

## 6. Hors session

- Les ressources du coffre sont transférées dans l'**inventaire global** en fin de session, **partagées entre les joueurs** de la session (voir ci-dessous).

### Partage du coffre en fin de session
Une session réunit **jusqu'à 3 mineurs, un par joueur** (chaque mineur est rattaché à un ID de compte). Le coffre est commun ; en fin de session, son contenu est réparti :
- **parts égales** : chaque joueur reçoit le même nombre de chaque ressource, quelle que soit sa contribution ;
- **reste** d'une division qui ne tombe pas juste : donné **au hasard**, une unité au plus par joueur (100 charbons à 3 → 33, 33, 34). Le tirage dépend de la seed : même partie, même partage ;
- **Treasure TX** : ne se partage pas, **chaque joueur en reçoit un exemplaire** par Treasure TX rapporté, quel que soit son tier (un treasure ouvert à 3 = 1 Treasure TX pour chacun) ;
- **solo** : le joueur garde tout ;
- ce qu'un mineur porte encore sur lui à la fin est perdu (il n'est pas dans le coffre).
- **un joueur qui quitte la session avant la fin ne reçoit rien** : son mineur disparaît de la mine, ce qu'il portait est perdu, et le coffre est partagé entre les joueurs **présents à la fin** (sa part leur revient). Si tout le monde part, la session s'arrête et personne ne reçoit rien.
- **le partage est calculé par le serveur** (anti-triche) : voir « Lancer une session » ci-dessous.
- Une **UI à part** (à concevoir) permet de crafter, de gérer les caractéristiques du mineur et son stuff.
- Ce qui n'est pas encore défini : recettes, objets, coûts, arbre d'amélioration.

### Lancer une session (onglet Mine)
Une session **ne démarre jamais toute seule** à l'ouverture de la page. Pour en lancer une, le joueur doit être connecté (compte ou invité) et aller dans l'onglet **Mine**, qui affiche un **lobby** :
- **3 places** (le jeu est prévu à 3) : le joueur, puis des places libres ;
- **Lancer la session** : si des places sont vides, la session est jouée **à ceux qui sont là** (seul = 1 mineur, il garde tout le coffre ; pas de mineur fantôme) ;
- **Groupe** : on se réunit avant de lancer (voir « Jouer à plusieurs » ci-dessous) ; seul, on joue seul ;
- **Critères / préférences** : les préférences de l'IA du mineur du joueur (priorité minerais/descendre, combattre/ignorer les mobs ; voir §7). Enregistrées avec le compte, **figées pour toute la session** une fois lancée.

Pendant la session, l'onglet Mine montre la mine et le panneau **Focus minerai** (§3) ; **Quitter la session** = le joueur ne reçoit rien (voir le partage).

### Jouer à plusieurs (groupe)
- **Inviter des joueurs** ouvre un panneau avec le **code du groupe** (6 caractères, ex. `K7Q4P2`) et un **lien** à envoyer (`…/#rejoindre=K7Q4P2`) : l'ami clique, se connecte (invité ou compte) et prend une place. On peut aussi taper un code dans « Tu as un code de groupe ? ».
- **Inviter par ID** : on tape l'ID de compte d'un ami (`7K3Q-9XHP`) ; il voit l'invitation en haut de son lobby (**Rejoindre** / **Refuser**). Inviter ne fait pas entrer : seul celui qui accepte joue. Une invitation dure 1 h.
- Places : le **chef** (celui qui a créé le groupe, ★) puis les membres, les invités en attente, les places libres (3 au total). Un membre absent (onglet fermé) est marqué « absent », puis retiré après 5 min sans nouvelles.
- **Seul le chef lance** (« Lancer à N ») ; les autres voient « En attente du chef… ». La session est créée pour tous les membres présents dans le groupe ; le chef est le mineur Rouge, puis Bleu, Vert dans l'ordre d'arrivée. Chacun garde ses propres préférences.
- Le chef peut **retirer** un membre ou annuler une invitation (×). **Quitter le groupe** = on se retrouve seul. Si le chef part, le membre suivant devient chef.
- Pendant la session, chaque navigateur affiche la même mine (même partie, calculée à l'identique). Un joueur qui quitte part **15 s plus tard** (préavis, `GAME.leaveNotice`) : son mineur disparaît au même moment chez tous et dans le rejeu du serveur. Partir dans les toutes dernières secondes ne rapporte rien non plus (le départ a lieu au plus tard au dernier tick).
- Les groupes sont une salle d'attente : un redémarrage du serveur les vide (chacun se retrouve seul), sans rien perdre d'autre.

**Le serveur fait foi** (anti-triche) :
- c'est lui qui crée la session (seed, joueurs, préférences, heure de départ) ; le navigateur ne fait que l'afficher ;
- **vitesse du jeu normal : ×2** *(valeur de config)* : une session de 60 min de jeu dure **30 min en temps réel**. Pas de pause : elle avance au rythme du temps réel, **même page fermée** ; en revenant, le navigateur rattrape le temps écoulé ;
- le serveur **refuse la fin d'une session avant l'heure** ; à la fin, il **rejoue lui-même la partie** depuis son enregistrement, partage le coffre et verse les parts dans les inventaires. Un joueur absent à la fin reçoit quand même sa part ;
- **l'inventaire est stocké sur le serveur** ; le navigateur le lit, il ne peut pas l'écrire ;
- une seule session en cours par joueur.

**Mode développeur** (serveur lancé avec `npm run dev`, jamais en ligne) : vitesses ×1 à ×300 et pause, seed au choix, mineurs de test sans compte, réglages des stats ; la fin est libre. Le serveur rejoue avec les mêmes réglages.

### Navigation
Une barre d'onglets est **toujours ouverte à gauche** de l'écran : **Mine, Inventaire, Stuff, Craft, Four, Talents, Social**.
- **Mine** : le lobby, puis la session en cours (les mineurs, la carte, le coffre commun).
- **Inventaire** : tout ce que possède le joueur (voir ci-dessous).
- **Four** : fondre les minerais en lingots (voir ci-dessous).
- **Craft** : fabriquer des objets (voir ci-dessous).
- **Stuff** : équiper les pièces du mineur (voir ci-dessous).
- Talents, Social : à concevoir (page d'attente pour l'instant).
- Changer d'onglet **ne met pas la session en pause** : la mine continue de tourner ; un mini-minuteur de session reste visible dans la barre.

### Inventaire global
Une grande grille de **slots** ; chaque slot contient un objet et sa quantité (ex. « Charbon × 100 »).
- Un objet **déjà présent s'empile** sur son slot, **sans taille maximum**.
- Un objet **absent prend un nouveau slot** : le premier slot libre (**ordre d'arrivée**, un objet garde sa place).
- Les objets de **stuff ne s'empilent pas** : chaque exemplaire prend son propre slot (chaque pièce pourra avoir ses propres stats).
- **Capacité illimitée** pour l'instant : au moins 48 slots affichés (8 colonnes), une ligne s'ajoute quand la grille est pleine. Une limite pourra devenir une amélioration plus tard *(valeur de config)*.
- Un slot vidé (objet consommé par le craft) reste un trou, réutilisé par le prochain nouvel objet.
- Les objets arrivés en fin de session sont mis en évidence jusqu'à la prochaine visite de l'onglet (pastille sur l'onglet).
- Un Treasure TX sélectionné peut s'ouvrir (voir §2, Treasures) ; les objets reçus sont mis en évidence de la même façon.

### Craft (onglet Craft)
- Les **recettes** sont dans un fichier à part : `src/recipes.js` (ingrédients, quantité obtenue, déblocage).
- L'onglet montre une **icône par recette disponible**. Un clic montre la recette : chaque ingrédient en **x / besoin** (x = ce que le joueur a dans son inventaire ; rouge s'il en manque, vert sinon).
- Le bouton **Craft** est grisé tant qu'il manque un ingrédient. Sinon, un clic retire les ingrédients et met l'objet dans l'inventaire (tout ou rien, fait par le serveur ; un double clic ne fabrique qu'une fois).
- Recettes **débloquées de base** pour l'instant ; plus tard, d'autres seront débloquées par les blueprints (champ `unlock`).
- Recette actuelle : **Pioche en pierre = 30 lingots de fer** *(provisoire)*, soit 300 fer + 300 charbon et 30 min de four.

### Stuff (onglet Stuff)
- **10 cases** : casque, torse, jambes, pieds, gants, ceinture, pioche, épée, cape, boussole.
- Un clic sur une case ouvre la liste des **pièces de l'inventaire qui vont dans cette case** (ex. case pioche → les pioches). Choisir une pièce l'équipe.
- Une pièce équipée **quitte l'inventaire** ; en équiper une autre dans la même case **renvoie l'ancienne** dans l'inventaire ; « Retirer » la remet aussi. Une pièce n'est jamais à deux endroits à la fois.
- **Pas encore d'effet** sur le mineur en session : les stats des pièces viendront à l'étape suivante (stats par mineur, stuff figé au lancement de la session pour le rejeu du serveur).
- Pièces existantes : **Pioche en pierre** (case pioche).

### Four (onglet Four)
- **Un four au départ**, jusqu'à **3** *(valeur de config)*. Les fours 2 et 3 sont affichés **sous cadenas** ; leur déblocage (coût) sera défini avec le craft. Des **fours plus puissants** (plus rapides) pourront être conçus.
- Un four a **3 cases** :
  - **minerai** : seulement un objet de la famille **ore** ; une seule sorte à la fois ;
  - **combustible** : seulement un objet de la famille **combustible** (le charbon) ;
  - **sortie** : les lingots (fer → Lingot de fer). Une seule sorte : si elle contient d'autres lingots, la fonte attend qu'on les récupère.
- Cliquer une case minerai ou combustible : choisir l'objet, puis la quantité (**saisie libre** ou bouton **Max**). Cliquer la sortie : les lingots vont dans l'inventaire.
- **1 lingot = 10 minerais + 10 charbons** *(provisoire)*. Temps par lingot : **fer 1 min, or 2 min**. Le **diamant ne se fond pas** (pas de recette).
- La fonte avance **en temps réel, même page fermée** (le serveur calcule à partir de l'heure de départ). Une **barre de progression** montre l'avancée du lingot en cours.
- Minerais et charbon ne sont consommés qu'**à la fin** d'un lingot : **retirer** une case rend tout ce qu'elle contient, y compris ce qui fondait (le lingot en cours est annulé).
- **Le serveur fait foi** : chaque action est faite par lui, inventaire et four changent ensemble ; une demande renvoyée (double clic) ne s'applique qu'une fois.
- Plus tard : un système d'**alliages**.

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
  - **secteur de préférence** : chacun a un tiers de la largeur (Rouge à gauche, Bleu au centre, Vert à droite) ; un minerai hors secteur vaut moins, et il ne « descend par l'existant » que dans son secteur. Préférence douce : il en sort si c'est plus rentable ;
  - **départ de son puits** : après le coffre, chacun rejoint la colonne au centre de son secteur avant de redescendre ;
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
- se déplace vers un mob déclenché par un allié ?

Déjà en jeu, dans « Critères / préférences » du lobby : priorité `minerais` ou `descendre`, combattre les mobs oui/non (`PREF_OPTIONS` en config). Les autres arriveront une par une, chacune avec ses tests de blocage.

### Questions ouvertes (gravité)
- Une chute fait-elle perdre du temps/de l'oxygène, ou est-elle gratuite ? (Recommandé : un petit ralentissement après la chute, pour que boucher un trou avec une fondation ait un intérêt.)
- Une échelle arrête-t-elle la chute ? (Recommandé : oui.)
- Le mineur peut-il remonter après une chute dans un trou sans échelle ? (L'IA doit poser des échelles pour revenir : cas de blocage à tester.)

## 8. Contraintes de dev

- Le temps de jeu est **réel (1h)** ; en dev, on doit pouvoir **accélérer** la simulation pour tester vite (x5 à x300 dans le prototype).
- Les valeurs d'équilibrage doivent être modifiables facilement.
