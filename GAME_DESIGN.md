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
- **ingot** : les lingots sortis du four ;
- **bloc** (terre, pierre, pierre dure) : se concassent au concasseur (voir §6, Concasseur) *(famille créée le 21/10/2026)*.

**Shiny.** Quand un mineur mine un bloc de **fer** ou d'**or** (les minerais qui se fondent au four), il a **1 %** de chance *(provisoire)* d'obtenir à la place un **shiny** : « Shiny iron », « Shiny gold ». C'est l'objet **déjà cuit** (famille ingot, poids 1 dans les pods), dont l'icône porte une étincelle et **scintille**. Un bloc donne le minerai **ou** le shiny, jamais les deux ; il compte toujours comme minerai miné (déblocage, XP, skills). Pas de shiny pour le charbon, le diamant ni le butin des mimics. Le journal de la session l'annonce (« ✨ … trouve un Shiny iron ! »). Un shiny ne repasse pas au four. Ordre de grandeur : ~6 à 7 shiny par session à 3. **Usage hors session : à décider.**

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
- **Ouvrir un Treasure TX** *(décision ferme)* : hors session, depuis l'onglet Inventaire (sélectionner le Treasure, bouton « Ouvrir »). Le Treasure est consommé, son contenu arrive dans l'inventaire et une petite fenêtre présente le butin obtenu (objets rares en tête). C'est le **serveur** qui tire le contenu, avec un hasard qu'on ne peut pas prévoir (pas la seed). Un Treasure TX sans table de butin ne s'ouvre pas (T1 et T2 en ont une).
- **Contenu du Treasure T1** *(valeurs provisoires)* :

  | Objet | Quantité | Chance |
  |---|---|---|
  | Blueprint parts | 5 à 15 | 100 % |
  | Charbon | 100 à 150 | 100 % |
  | Fer | 50 à 80 | 100 % |
  | **Un blueprint** parmi : Pioche en fer, Épée en fer, Casque en fer, Plastron en fer, Jambes en fer, Bottes en fer, Four en fer, Boussole en or, Ceinture en peau de gobelin | 1 | 1 % chacun (9 % au total) |
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

- L'IA vise un treasure **une fois découvert** (comme un minerai très rentable) ; la boussole ne le signale pas.
- Le panneau d'area affiche la probabilité, puis le tier trouvé une fois le treasure ouvert.
- Dans l'inventaire, chaque tier a son icône (T1 : ferrures argent, T2 : ferrures or).

## 3. Le mineur

### Déplacement
- **Le mineur est soumis à la gravité** : s'il y a du vide sous lui, il tombe case par case (8 blocs/s *(provisoire)*) jusqu'à atterrir sur un bloc solide ou **sur une échelle**. Il ne tombe pas s'il est sur une case avec échelle, ni s'il est posé juste au-dessus d'une case avec échelle. *(À définir : dégâts ou ralentissement de chute, voir questions ouvertes.)*
- **Chutes** *(décision ferme ; valeurs provisoires)* :
  - le mineur **ne se jette jamais dans un trou de plus de 3 cases** qu'il connaît (cases découvertes) : l'IA ne prévoit aucune chute plus haute ; devant un tel trou, il pose une passerelle, passe ailleurs ou creuse un autre puits ;
  - une chute **imprévue** (dans du vide pas encore découvert) de **3 cases ou plus** l'**étourdit 5 s** : il ne peut plus rien faire (ni bouger, ni miner, ni frapper), même taclé ; l'oxygène continue de baisser. Des étoiles tournent au-dessus de sa tête. Une chute connue de 3 cases ne l'étourdit pas.
  - Repère (simulation, 5 sessions) : ≈ 6 étourdissements par session en solo, ≈ 12 à 3 mineurs (≈ 30 à 60 s perdues).
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
- **Plus profond** *(option de base)* : comportement normal, il descend jusqu'à l'area débloquée la plus profonde.
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

**Stats d'amélioration** *(21/10/2026, onglet Amélioration ; 0 de base, elles ne viennent que des lignes tirées à l'identification)* :

| Stat | Rôle |
|---|---|
| Vitesse de minage % | Bonus en % : **vitesse de minage = (base + bonus fixes) × (1 + bonus en %)**. Différente de la vitesse de minage « fixe » (+0,1 de la pioche) |
| Dégâts % | Même calcul pour les dégâts : (base ou épée + bonus fixes) × (1 + bonus en %) |
| Critique | Chance qu'un coup contre un mob fasse **le double** de dégâts |
| Coup unique | Chance de casser un bloc **instantanément** |
| Perçage | Chance de casser aussi **le bloc juste derrière** celui miné (dans la direction du coup) ; il rapporte son butin comme un bloc miné (fortune, shiny, déblocage), jamais une barrière, un mur de donjon ni un mimic, jamais en chaîne |
| Butin des mobs | Butin des mobs en plus, en % : s'ajoute au skill Pillage (même calcul) |

### Niveau et XP
Le mineur du joueur a un **niveau**, rattaché à son compte, qui monte avec l'**XP** gagnée en session.
- **Sources d'XP** *(valeurs provisoires, `XP` en config)* : minerai miné, charbon **1**, fer **2**, or **4**, diamant **7** ; mob vaincu, bestiole **5**, gobelin **10**, mimic **5**, occultiste **15** (mob de base, sans XP de minerai en plus).
- **Pot commun** : toute l'XP de la session (minerais et mobs) va dans un pot, **partagé à parts égales** entre les joueurs présents, comme le coffre (arrondi vers le bas), **par tranches** : l'XP gagnée avant un départ est divisée entre les présents d'alors, la part du partant est perdue. **Qui quitte la session ne reçoit pas d'XP.** Versée par le serveur, une seule fois par session.
- **Courbe** : 1000 XP pour passer du niveau 1 au niveau 2, puis **×1,5** à chaque niveau (1000, 1500, 2250, 3375…) ; niveau 5 à 8125 XP au total *(provisoire)*.
- **Récompense** : **1 point de skill par niveau**, à dépenser dans l'onglet Skills (ci-dessous).
- Affichage : carte « Mineur » du lobby et carte « Stats du mineur » de l'onglet Stuff (niveau, barre d'XP avec **pourcentage** et **XP / XP requise** pour le niveau suivant, points de talent ; « Niveau max » au dernier niveau) ; XP de la session pendant la partie ; XP gagnée et montée de niveau au bilan.
- Repères (simulation, mineur de base) : **≈ 860 XP par session en solo** (60 % minerais, 40 % bestioles) ; **≈ 740 par joueur à 3** (≈ 2220 au total) : les bestioles apparaissent au même rythme quelle que soit la taille de l'équipe, donc à 3 on se les partage. À surveiller : le jeu à 3 rapporte un peu moins d'XP par tête que le solo.

### Skills *(règles fermes ; valeurs provisoires, par rang)*
Trois arbres **en étages** (3 étages chacun). Un étage peut avoir **plusieurs cases côte à côte** (Logisticien, étage 2). Une case de l'étage r > 1 exige qu'**au moins une case de l'étage d'avant** soit **au rang max** ; on peut prendre les deux cases d'un même étage. Dépenser un point dans un arbre **bloque les deux autres**. Bouton **Reset** : gratuit, rend tous les points, **refusé pendant une session**. Les skills sont **figés au lancement** de la session (comme le stuff) ; c'est le serveur qui les vérifie (jamais plus de rangs que de points).

| Arbre | Étape 1 | Étape 2 | Étape 3 |
|---|---|---|---|
| **Mineur** | 0/3 : vitesse de minage +2 % | 0/1 : miner un minerai rend **1 d'oxygène** (tout court, pas un % de l'oxygène max) | 0/5 : marche +3 % pendant 3 s après un minerai (ne se cumule pas, remis à 3 s) |
| **Logisticien** | 0/3 : temps de construction (échelle, passerelle, torche) −5 % | **deux cases côte à côte** : 0/1 **Échelle de 2** (échelle de 2 de haut au lieu de 1, si la case du dessus est vide) · 0/1 **Treuil** (ci-dessous) | 0/5 : marche +3 % quand il remonte à la surface (retour, jusqu'au coffre) ou redescend au front (rejoint son puits, descend par l'existant) |
| **Barbare** | 0/3 : dégâts +5 % | 0/1 : **provocation** : le mob qu'il frappe (tous les mobs, mimic compris) lâche les autres mineurs et, jusqu'à sa mort, ne peut plus poursuivre ni tacler que lui ; un occultiste provoqué ne lance plus son sort | 0/5 : butin des mobs +3 % (la part décimale est tirée au hasard) |

- **Affichage** *(décision ferme)* : dans l'onglet Skills, chaque arbre est dessiné comme un **arbre de compétences de RPG** : une case ronde (icône, rang « 0/3 », nom) par skill, reliée par des **lignes** aux cases de l'étage d'avant. La ligne s'allume (dorée) quand la case du dessus est au max ; une case qu'on peut apprendre brille et porte un « + » (clic = un rang) ; une case verrouillée est grisée. Survoler (ou toucher) une case affiche sa description, son rang et ce qui la bloque.
- Noms des cases : Mineur = Pioche aiguisée, Second souffle, Ruée ; Logisticien = Bâtisseur, Échelle de 2, Treuil, Navette ; Barbare = Force brute, Provocation, Pillage.
- **Les pourcentages des skills sont des multiplicateurs** *(décision ferme)* : ils s'appliquent après le stuff. Vitesse de minage = (base + stuff) × (1 + 2 % par rang) ; ex. pioche en fer et 3 rangs : (1 + 0,2) × 1,06 = 1,27. Idem pour les dégâts (+5 %/rang) et les vitesses de marche (+3 %/rang).
- « Vitesse de marche » = vitesse horizontale seulement (pas l'échelle) *(décision ferme)*.
- **Échelle de 2** : quand il monte en posant une échelle, il en pose 2 cases si celle du dessus est vide ; l'IA en tient compte dans ses itinéraires (en moyenne moitié moins d'échelles à poser).
- **Treuil** *(décision ferme ; vitesse provisoire)* : une sorte d'ascenseur, un seau en bois tiré par une poulie.
  - **Pose** : quand une nouvelle area est débloquée, le logisticien qui a le skill **Treuil** (le premier s'il y en a plusieurs) arrête ce qu'il fait, remonte à la surface (dépôt, oxygène), va **au milieu de la mine** (x = 25) et creuse tout droit vers le bas. Arrivé au **haut de la nouvelle area**, il pose **tout le treuil d'un coup**, de la surface jusque-là, et **retire les échelles** qui se trouvaient dans le puits (le treuil occupe toute la colonne ; plus personne n'y pose d'échelle, même la 2e case d'une échelle de 2). Pendant ce chantier il n'est **jamais étourdi** et peut tomber de plus de 3 cases dans son puits. S'il doit remonter (oxygène, pods, torches, fin de session), il reprend le chantier ensuite.
  - **Prolongement** : à l'area suivante, il redescend par le treuil et prolonge le **même puits**.
  - **Utilisation** : tous les mineurs, en même temps, sans attente, **dans les deux sens**, à **0,85 × leur vitesse de montée** (stuff compris). On peut s'arrêter à **n'importe quelle ligne** du puits pour miner à gauche ou à droite. Les itinéraires de l'IA le prennent en compte (pas d'échelle à poser, chemin tout droit).
  - Repère (simulation, 3 logisticiens complets × 5 sessions) : profondeur 207 (186 sans skills), ≈ 15 min par mineur et par session dans le seau. À noter : le seau (0,85×) est plus lent qu'une échelle déjà posée ; il fait gagner du temps parce qu'il évite les échelles à poser et les détours.
- Provocation : un mineur taclé par ce mob est libéré tout de suite et reprend son travail (même s'il est réglé sur « Ignorer les mobs »).
- **Échelles au retour** *(décision ferme)* : quand plusieurs mineurs remontent au même endroit, c'est le **logisticien** qui pose les échelles. Un autre mineur qui devrait en poser une attend s'il y a un logisticien qui remonte à moins de 5 cases, en dessous de lui ou à sa hauteur ; au-delà de 4 s d'attente, il la pose lui-même (jamais bloqué).
- Repère (simulation, 3 mineurs × 5 sessions, un arbre complet chacun) : areas 3,6 → 4,0, profondeur 186 → 196.

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
- **Un bonus b sur une stat de base B fait gagner T_stat × b / (B + b) x par session** (rendements décroissants : doubler une stat divise son temps par 2, pas plus). C'est l'**utilité réelle** (elle baisse quand la stat monte) ; le **prix** d'un point, lui, est linéaire et figé (catalogue ci-dessous).
- Les ressources se convertissent par le rendement du mineur de base : 522 points de valeur par session, soit **1 charbon ≈ 7 x**, 1 fer ≈ 14 x, 1 or ≈ 28 x, 1 diamant ≈ 55 x.
- Les valeurs dépendent du niveau du mineur (ex. : quand les pods augmentent, l'oxygène redevient limitant et prend de la valeur) : à recalculer par palier. Outil : `node scripts/stat-values.js`.

**Catalogue de prix** (figé le 20/10, mineur de base) : le **prix d'un point** est linéaire (comme le gold d'un item de LoL : +0,1 coûte toujours le dixième de +1), pris à T_stat / B.

| Stat | Base | Prix d'un point | Exemple |
|---|---|---|---|
| Vitesse de minage | 1 | 1 300 x | +0,2 = 260 x (Pioche en fer) |
| Vitesse (marche) | 3 | 240 x | +0,6 = 144 x (Bottes en fer) |
| Vitesse de montée | 2,25 | 250 x | +0,6 = 150 x (Jambes en fer) |
| Pods | 200 | 6 x *(prix « comme frein »)* | +33 = 198 x (Plastron en fer) |
| Oxygène | 300 | 4 x *(prix « comme frein »)* | +38 = 152 x (Casque en fer) |
| Dégâts | 5 | 40 x | 11 au lieu de 5 = 240 x (Épée en fer) ; 8 = 120 x (Épée en pierre) |
| Vitesse d'attaque | 100 % | **1,96 x par %** (196 s de combat / 100) | +20 % ≈ 39 x (Gants tactique) |
| Fortune | 0 % | **36 x par %** (1 % de minerai en plus = 1 % de 3 600 x) | +5 % = 180 x (Gants d'ouvrier) |
| Rayon des torches | 5 | 27 x | – |
| Découverte | 2 | ≈ 190 x *(estimation, effet indirect)* | +1 = Ceinture, Cape de Naingui |
| Vision, boussole, passerelles, torches | – | ≈ 0 (effet indirect ou trop faible) | – |

**Stats d'amélioration** *(21/10/2026)* :

| Stat | Prix d'un point | D'où vient le prix |
|---|---|---|
| Vitesse de minage % | 13 x par % | 1 % de la vitesse de base (1 300 / 100) ; mesuré : ≈ 11 x à +50 % (rendements décroissants) |
| Dégâts % | 2 x par % | 1 % des 5 dégâts de base (40 × 5 / 100) |
| Critique | 13 x par % | décision du créateur : 130 x (une pioche en pierre) = 10 % |
| Coup unique | 13 x par % | mesuré (24 sessions solo) : ≈ 17 x par % à +50 %, autant que la vitesse de minage % à petite dose |
| Perçage | 7 x par % | mesuré : ≈ 6,8 x par % à +50 % (les blocs percés sont surtout de la pierre, qui remplit le sac) |
| Butin des mobs | 2 x par % *(provisoire)* | mesuré : +50 % donne +61 % de butin de mobs, mais rien sur les minerais ; le butin des mobs n'a pas encore de valeur en x |

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
- **Tacle (tous les mobs)** *(décision ferme, 21/10)* : un mob à **1 case ou moins** (Manhattan, pas en diagonale) du mineur qu'il vise l'immobilise : son action en cours est interrompue (sauf une chute) et il doit combattre le mob, même réglé sur « Ignorer les mobs » et même s'il remonte. **Un mob ne tacle qu'un seul mineur** ; il le garde tant qu'il reste à côté. Un mob qui marche s'arrête à côté de sa cible (il ne monte plus sur sa case).
- **PV des mobs** *(décision du créateur, 21/10 ; k = area où le mob naît)* :
  | Mob | PV | Première area |
  |---|---|---|
  | Bestiole | 50 × 1,15^k | 0 |
  | Mimic | 50 × 1,15^k | 0 |
  | Gobelin | 100 × 1,15^(k − 1) | 1 |
  | Occultiste | 100 × 1,15^(k − 4) | 4 |
  Repères (mineur de base : 5 dégâts, un coup toutes les 0,8 s) : bestiole 10 coups en area 0, 16 en area 3 ; gobelin 20 coups en area 1, 35 en area 5 ; occultiste 20 à 23 coups ; mimic 10 à 21 coups.
- **Apparitions** *(décision du créateur, 21/10)* : une tentative toutes les (40 à 70 s) ÷ (1 + 0,15 × dernière area débloquée), première à 25 s, autour des mineurs sous terre chacun son tour. Le type est tiré selon l'**area du mineur visé** :
  | Area | Bestiole | Gobelin | Occultiste | Mimic |
  |---|---|---|---|---|
  | 0 | 80 % | – | – | 20 % |
  | 1 | 60 % | 20 % | – | 20 % |
  | 2 | 40 % | 40 % | – | 20 % |
  | 3 | 20 % | 60 % | – | 20 % |
  | 4 | – | 70 % | 10 % | 20 % |
  | 5 | – | 50 % | 30 % | 20 % |
  Les mobs qui marchent naissent au sol dans une galerie déjà découverte, à 5 à 10 cases du mineur visé, dans une area où leur type peut naître ; au plus 2 + (dernière area débloquée) en vie en même temps (les mimics ne comptent pas). Les **mimics** naissent autrement : **un minerai de la roche** à 5 à 10 cases du mineur devient un mimic caché (pas un minerai visé ou en train d'être miné). Ils ne sont plus placés à la génération des areas.
- Types :
  - **Bestioles** : se rapprochent du mineur. **Elles suivent la même physique que le mineur** : gravité, pas de saut, montée uniquement par une échelle (×0,75), descente par l'échelle ou en se laissant tomber. Elles ne creusent pas et ne posent rien. Butin : **chitine** (1 à 2, poids 1).
  - **Gobelins** : même physique et même tacle que les bestioles.
    - **Vol** : toutes les **2 secondes** de tacle, le gobelin vole **un minerai** (bloc de type ore : charbon, fer, or, diamant) tiré au hasard dans l'inventaire du mineur taclé, chaque unité ayant la même chance. Le minerai volé est **perdu**. Il ne vole ni terre, ni pierre, ni butin de mob, ni shiny, ni Treasure TX.
    - **Butin** : **peau de gobelin** (1 à 2, poids 1) et **chitine** (1).
    - Intention : un mineur qui tue vite perd peu ; c'est une raison concrète d'améliorer ses dégâts pour les areas profondes.
  - **Mimics** : faux minerais, visibles à la boussole comme des minerais. Ils se dévoilent à 2,3 cases ou quand le mineur essaie de les miner. **Un mimic se combat, il ne se mine pas** : dévoilé, sa case n'est plus un minerai pour l'IA (ni cible, ni bloc à creuser). Il **tacle** le mineur à côté de lui. Butin : 3 minerais du type imité (ni shiny ni Fortune).
  - **Occultiste** *(21/10)* : mage noir humain terré sous terre, à partir de l'**area 4**. Même physique et même tacle que les bestioles. **Sort** : prêt toutes les **15 s** (la première fois 15 s après son apparition). Quand il est prêt, l'occultiste **se téléporte à 3 cases** (Manhattan) de sa cible, sur une case vide où l'on tient et qu'on rejoint depuis la cible sans miner (à défaut à 4, puis à 2 ; jamais au contact : il ne lance pas son sort au corps à corps), puis **canalise** un rayon de lumière noire : la cible est **étourdie 5 s** (elle ne fait plus rien, même pas frapper). Pendant la canalisation, il ne bouge pas et ne tacle pas. **Provoqué** (Barbare), il arrête tout de suite sa canalisation (la cible est libérée) et ne lance plus jamais son sort. Butin : **Tissu sombre** (1 à 3). XP 15 *(provisoire)*.
- **Donjon** *(décisions du créateur, 21/10/2026 ; valeurs provisoires, `DUNGEON` en config)* :
  - **Où** : **area 5 seulement**, **20 %** de chance (tirage à part de la seed : le reste de l'area ne change pas). Un carré de **10 × 10** : murs en **briques de donjon** (pierre taillée violet sombre) **incassables**, intérieur vide, **une seule entrée** (une brique manquante) dans le mur de gauche ou de droite, sur l'une des 3 lignes du bas de l'intérieur (on y entre en marchant, chute de 2 cases au plus). Jamais à moins de 2 cases d'un bord de la mine ou d'une limite d'area (l'entrée ne donne jamais sur un bord), jamais sur la colonne du treuil ± 5. Les blocs qu'il remplace sortent des comptes de l'area (déblocage, focus).
  - **Minotaure** (boss) : mi-homme mi-taureau, debout. **1 000 PV**, ne fait que **tacler** (rien de spécial), **100 XP**. **Enfermé** : il ne sort jamais de sa salle et ne vise que les mineurs qui y sont (intérieur ou entrée). Aucun autre mob n'apparaît dans un donjon.
  - **Butin** : **1 à 3 Cristaux de pleine lune** (rareté rare, Pillage compris), **pas partagés** : comme les Treasure TX, chaque joueur présent à la fin en reçoit la quantité entière.
  - **Déclencheur** : un mineur **découvre** un bloc de la structure (mur, entrée ou intérieur). Avant, personne ne sait qu'il est là.
  - **Avec un barbare dans la partie** (un joueur qui a choisi l'arbre Barbare) : tous les mineurs vont à l'entrée (en creusant autour des murs s'il le faut) et **attendent devant**, sans entrer. Le **barbare entre le premier** (aucune restriction, même réglé sur Ignorer ou Fuir) et va combattre le minotaure. Une fois le barbare entré, les autres entrent l'aider, **sauf ceux réglés sur « Fuir »**, qui reprennent leur travail. Les raisons de remonter (oxygène, pods, torches, fin de session) passent avant.
  - **Sans barbare** : personne n'y entre (aucun itinéraire n'y passe), chacun mine comme d'habitude. Un mineur qui s'y retrouve quand même (avant de l'avoir vu, par exemple) est **effrayé 15 s** : si le minotaure le tacle pendant ce temps, il est **téléporté à la surface** (il garde son sac). Après les 15 s, il ressort seul ; s'il est taclé, il se bat (le tacle oblige).
  - Le minotaure vaincu, le donjon est libre : tout le monde peut y passer.
- **Préférence « Face aux mobs »** : Combattre / Ignorer / **Fuir** *(21/10)*. Fuir = comme Ignorer (il n'engage pas les mobs, il se bat seulement s'il est taclé) + il n'entre jamais dans un donjon.
- **État « combat » de la session** : il est actif dès qu'un mob a pris un mineur en chasse (il le poursuit à 14 cases ou moins, le tacle, ou canalise sur lui).
- **Aider allié** *(préférence du lobby, 21/10)* : un mineur réglé sur « Aider allié : Oui » part **tout de suite** vers le mob qui a pris un **autre** mineur en chasse (le plus proche), en creusant s'il le faut, et le combat, **s'il est à 20 cases ou moins** *(provisoire, `HELP.range` ; sans limite, il traversait la mine pour des combats finis avant son arrivée)*. Jamais pendant le chantier du treuil. Le joueur peut **ignorer des types de mob** (liste avec leur dessin, ignoré oui / non) : il n'ira pas aider contre eux. Pas pendant un retour vers la surface. Le mob mort, le mineur reprend sa décision normale selon sa priorité (il ne revient pas où il était). Un mob inatteignable est laissé.

## 6. Hors session

- Les ressources du coffre sont transférées dans l'**inventaire global** en fin de session, **partagées entre les joueurs** de la session (voir ci-dessous).

### Partage du coffre en fin de session
Une session réunit **jusqu'à 3 mineurs, un par joueur** (chaque mineur est rattaché à un ID de compte). Le coffre est commun ; en fin de session, son contenu est réparti :
- **parts égales** : chaque joueur reçoit le même nombre de chaque ressource, quelle que soit sa contribution ;
- **reste** d'une division qui ne tombe pas juste : donné **au hasard**, une unité au plus par joueur (100 charbons à 3 → 33, 33, 34). Le tirage dépend de la seed : même partie, même partage ;
- **Treasure TX** : ne se partage pas, **chaque joueur en reçoit un exemplaire** par Treasure TX rapporté, quel que soit son tier (un treasure ouvert à 3 = 1 Treasure TX pour chacun) ;
- **solo** : le joueur garde tout ;
- ce qu'un mineur porte encore sur lui à la fin est perdu (il n'est pas dans le coffre).
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

**Le Lobby pendant une session : lecture seule.** Un bandeau « ⛏ En session dans la mine · temps restant · Voir la session » ; le groupe reste visible (chacun « en session »), mais on ne peut ni lancer, ni inviter, ni rejoindre, ni quitter le groupe, ni changer les préférences ou le type de mine. Dès la fin (pendant le bilan), il redevient utilisable.
- **Combat** : le mineur se tourne vers le mob et frappe avec l'arme qu'il a en main (l'épée équipée, sinon la pioche), en coups de taille animés.
- **Caméra** : elle suit le mineur du joueur. Un appui sur un mineur de l'équipe la fait suivre celui-ci. Le joueur peut **se déplacer dans la mine** (molette, glisser à la souris ou au doigt, flèches ↑ ↓, PageUp / PageDown) : la caméra ne suit plus personne jusqu'à ce qu'il appuie sur **Suivre** (ou Début). Elle va du ciel au fond de la mine connue.

### Jouer à plusieurs (groupe)
- **Inviter des joueurs** ouvre un panneau avec le **code du groupe** (6 caractères, ex. `K7Q4P2`) et un **lien** à envoyer (`https://deepmineidle.fr/#rejoindre=K7Q4P2`) : l'ami clique, se connecte (invité ou compte) et prend une place. On peut aussi taper un code dans « Tu as un code de groupe ? ».
- **Inviter par ID** : on tape l'ID de compte d'un ami (`7K3Q-9XHP`) ; il voit l'invitation en haut de son lobby (**Rejoindre** / **Refuser**). Inviter ne fait pas entrer : seul celui qui accepte joue. Une invitation dure 1 h.
- Places : le **chef** (celui qui a créé le groupe, ★) puis les membres, les invités en attente, les places libres (3 au total). Un membre absent (onglet fermé) est marqué « absent », puis retiré après 5 min sans nouvelles.
- **Seul le chef lance** (« Lancer à N ») ; les autres voient « En attente du chef… ». La session est créée pour tous les membres présents dans le groupe ; le chef est le premier mineur (à gauche), puis les autres dans l'ordre d'arrivée. Chacun garde ses propres préférences.
- **Apparence des mineurs** : chaque mineur porte le **pseudo** de son joueur, affiché en petit au-dessus de sa tête (en doré pour celui que la caméra suit). Tous ont le **même corps** ; ce qui les distingue, c'est leur **stuff équipé**, dessiné sur eux (ex. chitine = armure rouge sur les parties équipées). Quand il mine ou frappe, le mineur sort sa **pioche** : en bois (marron) par défaut, en pierre (grise) s'il a la pioche en pierre. L'équipement visible est celui porté **au lancement** de la session. Les skins sont décrits dans `src/skins.js`, les textures dans `textures/skins/`.
- Le chef peut **retirer** un membre ou annuler une invitation (×). **Quitter le groupe** = on se retrouve seul. Si le chef part, le membre suivant devient chef.
- Pendant la session, tout le monde voit **la même partie** : il n'y en a qu'une, elle tourne sur le serveur. Un joueur qui quitte part **tout de suite** : son mineur disparaît de la partie, chez tous. Partir dans les toutes dernières secondes ne rapporte rien non plus.
- **Le groupe reste après la session** *(décision du créateur, 21/10/2026)* : à la fin, chacun revient au lobby **dans le même groupe**, et le chef peut relancer tout de suite, sans réinviter. Un joueur qui ne veut pas enchaîner **quitte le groupe** (bouton « Quitter le groupe »).
  - Pendant la session, personne n'est retiré pour absence (le navigateur ne parle plus au groupe pendant la partie) : le délai de 5 min repart de la fin de la session. Le bilan compte comme une présence.
  - Un membre encore dans la session (le chef a quitté tôt, par exemple) est affiché « en session » ; le chef voit « ⏳ Le groupe finit sa session… » et ne peut pas relancer avant la fin.
  - Si le chef relance pendant qu'un membre lit encore son bilan, ce membre passe directement à la nouvelle session (son mineur y joue déjà).
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

**Mode développeur** (serveur lancé avec `npm run dev`, jamais en ligne) : vitesses ×1 à ×300 et pause (réglées sur le serveur, qui fait tourner la partie ; à ×300, la partie va aussi vite que le serveur peut la calculer), seed au choix, mineurs de test sans compte, réglages des stats ; la fin est libre (la partie est jouée jusqu'au bout d'un coup).

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
- L'onglet liste **les amis et ce qu'ils font** : **hors ligne**, **en ligne**, **en session mine**, **dans le lobby (x/3)** (dans un groupe de x joueurs). En ligne = le jeu est ouvert (même dans un onglet caché) depuis moins de 45 s *(valeur de config)*. Ordre : lobby, en ligne, en session, hors ligne.
- Pour chaque ami **en ligne** (en ligne ou dans le lobby) : **Inviter** (invitation dans son groupe, comme l'invitation par ID du lobby) et **Rejoindre** (entrer dans son groupe ; s'il n'en a pas, un groupe est créé avec lui comme chef). Rejoindre est grisé si son groupe est complet ; les deux sont grisés si l'ami est déjà dans ton groupe, ou si toi-même es en session.
- **Un joueur en session ne peut pas être invité**, ni depuis l'onglet Social ni par ID depuis le lobby (le serveur refuse), ni rejoint.
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
- Les objets arrivés en fin de session sont mis en évidence jusqu'à la prochaine visite de l'onglet (pastille sur l'onglet).
- Un Treasure TX sélectionné peut s'ouvrir (voir §2, Treasures) ; les objets reçus sont mis en évidence de la même façon.
- Un blueprint sélectionné peut s'**utiliser** : il débloque sa recette (voir Craft).
- Une pièce de stuff sélectionnée peut s'**équiper** directement (bouton **Équiper**, avec sa case et la pièce qu'elle remplace) : même effet que depuis l'onglet Stuff, la pièce remplacée revient dans l'inventaire.

**Rareté** *(décision du créateur, 21/10/2026)*. Chaque objet a une rareté : **commun** (gris), **inhabituel** (vert), **rare** (bleu), **épique** (violet), **légendaire** (orange).
- Partout où l'objet apparaît (inventaire, craft, four, stuff, recherche, coffre en session, bulles), le **contour de sa case** et la **couleur de son nom** suivent sa rareté. La fiche d'un objet de l'inventaire affiche aussi le libellé de la rareté.
- Par défaut, tout est **commun**. **Inhabituel** : Rubis inférieur, Saphir inférieur, Jade inférieur, Boussole en or (et son BP), Ceinture en peau de gobelin (et son BP), Four en fer (et son BP), Gants tactique et Gants d'ouvrier (et leurs BP), tous les **shiny**. **Rare** : Cape de Naingui (et son BP).
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
  | Pioche en pierre | 30 lingots de fer (300 fer + 300 charbon, 30 min de four) | Vitesse de minage +0,1 |
  | Épée en pierre | 15 lingots de fer | Dégâts 8 (remplace les mains nues : 5 ; +3, moitié de l'épée en fer, ≈ 120 x) |
  | Casque en chitine | 5 lingots de fer + 70 chitine | Oxygène +30 |
  | Plastron en chitine | 8 lingots de fer + 30 chitine | Pods +25 |
  | Jambes en chitine | 7 lingots de fer + 30 chitine | Vitesse (échelle) +0,4 |
  | Bottes en chitine | 4 lingots de fer + 70 chitine | Vitesse (marche) +0,5 |

  Débloquées par leur blueprint (« Pioche en fer BP »…, Treasure T1) :

  | Objet | Recette | Effet |
  |---|---|---|
  | Pioche en fer | 20 Tainted iron | Vitesse de minage +0,2 |
  | Épée en fer | 10 Tainted iron | Dégâts 11 (remplace les mains nues : 5) |
  | Casque en fer | 5 Tainted iron | Oxygène +38 |
  | Plastron en fer | 8 Tainted iron | Pods +33 |
  | Jambes en fer | 7 Tainted iron | Vitesse (échelle) +0,6 |
  | Bottes en fer | 4 Tainted iron + 5 peau de gobelin + 1 lingot d'or | Vitesse (marche) +0,6 |
  | Ceinture en peau de gobelin | 20 peau de gobelin + 20 lingots d'or | Découverte +1 |
  | Four en fer | 1 000 charbon + 20 Tainted iron + 5 Shiny iron | « Utiliser » : ouvre le four 2 (×1,25) |
  | Boussole en or (case boussole) | 20 Tainted gold + 5 Shiny gold | Boussole : +1 ligne au-dessus et en dessous (≈ 300 x) |

  Tier 2 (blueprints du Treasure T2 : « Gants tactique BP », « Gants d'ouvrier BP », « Cape de Naingui BP ») :

  | Objet | Recette | Effet |
  |---|---|---|
  | Gants tactique (case gants) | 20 Shiny iron + 20 Tainted iron + 1 Jade inférieur | Vitesse d'attaque +20 % (≈ 39 x) |
  | Gants d'ouvrier (case gants) | 20 Shiny gold + 20 Tainted iron | Fortune +5 % (≈ 180 x) |
  | Cape de Naingui (case cape) | 20 Tissu sombre + 1 Rubis inférieur + 1 Saphir inférieur | Découverte +1 |

  **Tissu sombre** : matériau (catégorie « Matériau »), nécessaire à la Cape de Naingui. Il vient de l'**occultiste** (1 à 3 par occultiste vaincu, areas 4 et 5).

### Stuff (onglet Stuff)
- **10 cases** : casque, torse, jambes, pieds, gants, ceinture, pioche, épée, cape, boussole.
- Un clic sur une case ouvre la liste des **pièces de l'inventaire qui vont dans cette case** (ex. case pioche → les pioches). Choisir une pièce l'équipe.
- Une pièce équipée **quitte l'inventaire** ; en équiper une autre dans la même case **renvoie l'ancienne** dans l'inventaire ; « Retirer » la remet aussi. Une pièce n'est jamais à deux endroits à la fois.
- **Effets en session** : chaque mineur a **ses propres caractéristiques** = stats de base + bonus des pièces qu'il porte. Le stuff est **figé au lancement** de la session (le même que son apparence) : changer de pièce pendant une session compte pour la suivante. C'est le serveur qui les calcule (depuis le stuff enregistré sur le compte).
- Une pièce peut **ajouter** à une stat (ex. Pods +25) ou **remplacer** sa valeur de base (ex. l'Épée en fer : Dégâts 11 au lieu des 5 des mains nues).
- Pièces existantes : **Pioches en pierre et en fer** (case pioche) ; **Épées en pierre et en fer** (case épée) ; **Casque, Plastron, Jambes et Bottes en chitine ou en fer** (cases casque, torse, jambes, pieds) ; **Ceinture en peau de gobelin** (case ceinture) ; **Gants tactique et Gants d'ouvrier** (case gants) ; **Cape de Naingui** (case cape). En session, l'armure en fer est grise, la ceinture verte ; le mineur sort son épée pour frapper (sa pioche s'il n'en a pas). Leurs bonus (tableau ci-dessus) s'affichent dans les onglets Craft, Stuff et Inventaire et s'appliquent en session.
- **Bulle d'info** : survoler une pièce (ou la toucher sur mobile) dans l'Inventaire, le Craft ou le Stuff affiche son nom et ses effets, un par ligne (ex. « Pioche en pierre / Vitesse de minage +0,1 »).
- **Stats du mineur** : sous les cases, l'onglet liste les stats du mineur (oxygène, pods, vitesses, minage, dégâts, vitesse d'attaque, fortune, découverte, vision, boussole, torches, passerelles) : (base + bonus des pièces portées, en vert) × multiplicateur des skills (en bleu, ex. vitesse de minage ×1,06, dégâts ×1,15). Le total est exactement ce que le mineur a en session.

### Amélioration (onglet Amélioration) *(décisions du créateur, 21/10/2026 ; valeurs provisoires, `UPGRADE` en config)*
Trois rubriques : **Identification**, **Amélioration**, **Enchantement** (plus tard). Seulement les pièces de l'inventaire (une pièce portée se retire d'abord dans l'onglet Stuff). C'est le serveur qui tire le hasard.

**Identification** : deux cases. À gauche la pièce à identifier, à droite **un autre exemplaire du même objet, sacrifié** (peu importe sa qualité ou son niveau). La pièce reçoit une **qualité** (tirée selon les chances ci-dessous), puis des **lignes de stats** en plus de ses stats de base. **Définitif** : une pièce identifiée ne se ré-identifie pas.

| Qualité | Titre | Couleur du nom | Chance | Chaque ligne vaut | Lignes |
|---|---|---|---|---|---|
| R1 | Utile | #FFFFFF | 30 % | 10 à 30 % de la valeur de l'objet | 1 |
| R2 | Bon | #00FF00 | 24 % | 20 à 40 % | 1 |
| R3 | Haute qualité | #0080FF | 24 % | 30 à 60 % | 1 |
| R4 | Excellent | #FF00FF | 14 % | 25 à 40 % | 2 |
| R5 | Antique | #FFA500 | 4 % | 35 à 50 % | 2 |
| R6 | Mystérieux | #FF0000 | 3 % | 30 à 50 % | 3 |
| R7 | Légendaire | #FFFF00 | 1 % | 35 à 55 % | 4 |

- Une ligne garde **le % tiré**, pas sa valeur : si on rééquilibre un prix ou un objet, les pièces déjà identifiées suivent.
- **Valeur de l'objet** = ses stats en unité x (catalogue de prix §3) : pioche en pierre 0,1 × 1 300 = **130 x**, pioche en fer 260 x, épée en fer (11 − 5) × 40 = 240 x.
- **Une ligne** : une stat tirée au hasard (deux lignes peuvent tomber sur la même) parmi celles qui ont une valeur en x : vitesse de minage (fixe et %), dégâts (fixes et %), vitesse d'attaque, critique, fortune, coup unique, perçage, butin des mobs, marche, montée, pods, oxygène. Valeur = valeur de l'objet × % tiré ÷ prix de la stat, arrondie (au moins un pas). Ex. R4 sur pioche en pierre, ligne à 32 % : 41,6 x = +0,032 de vitesse de minage, **ou** +1,2 % de fortune, **ou** +7 pods.
- **Jamais de Découverte**, sauf en **R6 et R7** : chaque ligne a 25 % de chance *(provisoire)* d'être « +1 Découverte », une au plus par objet.
- **Nom** : « Excellent : Pioche en pierre » dans la couleur de la qualité, qui passe avant la couleur de rareté du type. **Le contour de la case garde la rareté du type** (commun, inhabituel…).
- Une R7 (4 lignes de 35 à 55 %) ajoute jusqu'à **+220 % de la valeur de l'objet** : une pioche en pierre R7 peut valoir plus qu'une pioche en fer brute. Assumé (1 % de chance), à surveiller.

**Amélioration** : +1 à **+3** pour l'instant (la suite viendra). Le % est le **bonus total du palier** sur **toutes les stats de la pièce** (de base et identifiées) ; une pièce non identifiée peut être améliorée et garde son niveau quand on l'identifie. **Un échec ne coûte que les matériaux** : la pièce ne perd rien.

| Niveau | Stats | Réussite | Coût |
|---|---|---|---|
| +1 | +3 % | 100 % | 3 Plumes d'ange, 3 Cristaux de pleine lune |
| +2 | +5 % | 95 % | 5 + 5 |
| +3 | +7 % | 90 % | 7 + 7 |

Ex. pioche en pierre +3 : 0,1 × 1,07 = 0,107 de vitesse de minage. Épée en fer +3 : 5 + 6 × 1,07 = 11,4 dégâts. Les stats entières (pods, oxygène, découverte, lignes de boussole) sont arrondies.
- **Plume d'ange** : celle qu'on ramasse dans la **mine instantanée**. **Cristal de pleine lune** : le butin du **minotaure** (donjon, 1 à 3 par victoire, chaque joueur présent reçoit la quantité entière). Il faut donc 15 cristaux pour monter une pièce à +3. Pour tester : `node scripts/give-admin.js --name <pseudo>` (une pièce de chaque qualité + des matériaux).

### Four (onglet Four)
- **Un four au départ** (Four en pierre), jusqu'à **3** *(valeur de config)*. Les fours 2 et 3 sont affichés **sous cadenas**.
- **Four 2 : Four en fer** *(décision du créateur, 21/10/2026)*. L'objet « Four en fer » se fabrique (onglet Craft, recette débloquée par le Four en fer BP) ; dans l'inventaire, son bouton **Utiliser** le consomme et ouvre le four 2, un **Four en fer** qui fond **×1,25 plus vite** (lingot de fer en 48 s). Un seul Four en fer sert : une fois le four 2 ouvert, le bouton dit « four déjà débloqué ». Le **four 3 reste fermé** pour l'instant. Fait par le serveur, en une fois (un double clic ne consomme qu'un objet).
- Un four a **3 cases** :
  - **minerai** : seulement un objet de la famille **ore** ; une seule sorte à la fois ;
  - **combustible** : seulement un objet de la famille **combustible** (le charbon) ;
  - **sortie** : les lingots (fer → Lingot de fer). Une seule sorte : si elle contient d'autres lingots, la fonte attend qu'on les récupère.
- Cliquer une case minerai ou combustible : choisir l'objet, puis la quantité (**saisie libre** ou bouton **Max**). Cliquer la sortie : les lingots vont dans l'inventaire.
- **1 lingot = 10 minerais + 10 charbons** *(provisoire)*. Temps par lingot : **fer 1 min, or 2 min**. Le **diamant ne se fond pas** (pas de recette).
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
  | **Tainted iron** | 5 lingots de fer + 20 chitine | 50 charbons | 3 min |
  | **Tainted gold** | 5 lingots d'or + 20 chitine | 50 charbons | 3 min |

### Concasseur (onglet Concasseur) *(demande du créateur, 21/10/2026 ; valeurs provisoires)*
- **8 cases d'entrée** (2 rangées de 4) pour les objets de la famille **bloc** : terre, pierre, pierre dure. Une sorte de bloc par case, quantité libre.
- **8 cases de sortie** en dessous pour le butin ; clic sur une case pour la récupérer, ou bouton « Tout récupérer ».
- Un **cycle par minute**, en temps réel, même page fermée : à la fin du cycle, il concasse **100 blocs** de la **première case qui en a au moins 100**, de haut en bas puis de gauche à droite (case 1 → 8). Une case de moins de 100 est sautée. Les blocs ne sont consommés qu'à la fin du cycle (retirer une case pendant le cycle ne coûte rien).
- **Butin pour 100 blocs** (un tirage par famille : au plus une gemme et un treasure par cycle ; la plupart des cycles ne donnent rien) :

  | 100 blocs | Chaque gemme inférieure (rubis, saphir, jade) | Treasure |
  |---|---|---|
  | Terre | 0,1 % | T1 : 0,01 % |
  | Pierre | 0,15 % | T2 : 0,015 % |
  | Pierre dure | 0,12 % | T2 : 0,02 % |
- Les **dernières trouvailles** et le nombre de lots concassés sont affichés sous la machine.
- **Le serveur fait foi** : il tire le butin avec un hasard imprévisible et l'enregistre dès qu'un cycle est fini (un cycle n'est tiré qu'une fois) ; inventaire et concasseur changent ensemble, une demande renvoyée ne s'applique qu'une fois.
- ⚠️ **Ordre de grandeur** (simulation 3 mineurs, 21/10) : une session rapporte ≈ 530 terre + 760 pierre au coffre commun, soit ≈ 4 lots par joueur. Avec ces chances : ≈ 1 gemme toutes les 60 sessions par joueur (≈ 20 en solo), un treasure toutes les ≈ 2 000 sessions. À rééquilibrer si le concasseur doit servir.

### Table de recherche (onglet Recherche)
Elle sert à **dépenser les Blueprint parts** et à **recycler des blueprints**. Deux sous-onglets :
- **Recherche** : on choisit le **tier**, on pose les parts dans la case (c'est **0 ou le prix du tier**, un clic pose ou retire), puis **Rechercher** : les parts sont dépensées et un **blueprint du tier** arrive dans l'inventaire. Le blueprint obtenu s'affiche dans la **case de résultat** de la table (à droite de la flèche), avec dessous sa **description** : la recette qu'il débloque et les effets de l'objet.

  | Tier | Prix | Blueprints possibles | Recycler un blueprint du tier |
  |---|---|---|---|
  | 1 | 100 parts | ceux d'un Treasure T1 (les 9) | 30 à 60 parts |
  | 2 | 150 parts | ceux d'un Treasure T2 (Gants tactique, Gants d'ouvrier, Cape de Naingui) | 40 à 70 parts |

  - **Un tier ne s'ouvre que quand le joueur a appris TOUTES les recettes du tier d'avant** *(décision ferme)* : l'option « Tier 2 » est grisée (🔒) avec le nombre de recettes qui manquent, et le serveur refuse aussi. Les blueprints qui ne débloquent encore rien ne comptent pas. Le tier 1 est « fini » avec ses **9 recettes** (Four en fer et Boussole en or comprises depuis le 21/10/2026).
  - Tiré au hasard *(décision ferme)* parmi ceux dont la recette **n'est pas encore apprise** : un blueprint déjà en stock (pas encore utilisé) peut ressortir ; un blueprint qui ne débloquerait rien resterait toujours possible. Tier entièrement appris : plus rien à tirer.
  - Les blueprints possibles ne sont pas listés (les recettes restent secrètes) : l'onglet n'affiche que leur nombre.
- **Recycle** : on pose un blueprint (n'importe lequel) dans la case, **Recycler** : il est détruit et rend des Blueprint parts **selon le tier du blueprint** : 30 à 60 (tier 1), 40 à 70 (tier 2) *(provisoire)*.
- C'est le **serveur** qui fait l'action et tire le hasard (imprévisible) ; un double clic n'agit qu'une fois.
- Repère : recherche puis recyclage = 100 parts contre 30 à 60 (tier 1), 150 contre 40 à 70 (tier 2) : on perd toujours au change (pas de boucle infinie).

### Mine instantanée (MI) *(décisions du créateur, 21/10/2026 ; valeurs provisoires, `INSTANT_MINE` en config)*
Un rendez-vous court et compétitif : tous les inscrits dans la même mine, **chacun pour soi**, quelques minutes pour tout piller.
- **Quand** : toutes les **2 h pile, heure de Paris** (0 h, 2 h, 4 h… ; heure d'été comprise). Dure **5 min de jeu** (2 min 30 réelles à ×2).
- **La mine** : **50 × 50** blocs, **que des minerais** : 20 % charbon, 40 % fer, 39 % or, et **1 % de tas de plumes d'ange**. Entièrement **éclairée** (pas de torche). Pas d'oxygène, pas de pods, pas de mobs, pas d'échelle : le mineur **se déplace librement** dans les galeries qu'il a creusées (haut, bas, côtés, sans gravité).
- **Départ** : les mineurs apparaissent sur la ligne de surface, au-dessus de la mine, **espacés régulièrement**.
- **Tas de plumes d'ange** : une case **vide** portant un tas de plumes. Le **premier mineur qui arrive sur la case** le ramasse (le tas disparaît) et gagne **1 à 5 Plumes d'ange** (rareté **rare**). L'IA ne les cherche pas au loin, mais **dès qu'un tas est accessible à 3 pas ou moins** par les galeries, le mineur va le prendre avant de reprendre son minage *(décision du 21/10 : sinon, mesuré, un mineur seul passait à côté de tous les tas)*. Plusieurs mineurs peuvent courir vers le même tas : le premier arrivé le prend.
- **Chacun son butin** : ce qu'un mineur mine est à lui, **pas de partage, pas d'XP**. Si deux mineurs minent le même bloc, **celui qui finit en premier** gagne le minerai ; l'autre perd son travail sur ce bloc.
- **Le stuff compte** : vitesse de minage, vitesse de marche, **Fortune** et **shiny** s'appliquent comme en session. Les spécialisations restent choisies mais n'ont pas d'effet particulier ici.
- **IA du mineur** : tous les blocs valent pareil (aucune priorité de minerai) ; il creuse dans tous les sens, vers le bloc le moins coûteux en temps, en **évitant les zones où il y a déjà d'autres mineurs** (pénalité par mineur proche et par bloc déjà visé par un autre). S'il perd **3 blocs d'affilée** (un autre les a finis avant lui), il **change de zone** (il ne suit pas indéfiniment un mineur plus rapide).
- **Plusieurs mines** : au plus **20 joueurs par mine** ; au-delà, les inscrits sont répartis en mines de tailles égales (21 inscrits → 11 + 10). Un inscrit seul joue seul.

**Lobby MI** (onglet **Lobby**, « Où miner » → **Mine instantanée** ; un joueur inscrit retrouve son lobby sur ce choix) :
- On peut s'y inscrire **quand on veut** ; un compte à rebours affiche « La mine instantanée commence dans Xh Xmin Xs ».
- S'inscrire **fait quitter le groupe** de la session normale. On ne peut **pas s'inscrire pendant une session** (il faut d'abord la quitter). **Lancer une session normale désinscrit** du MI.
- À l'heure dite, les inscrits partent tous dans la mine ; personne ne la rejoint après le début.
- **Fermer l'onglet ne change rien** (la partie tourne sur le serveur, le butin arrive à la fin). **Seul le bouton Quitter fait tout perdre** : quitter avant la fin = rien.

**Rappels** (seulement si la page du jeu est ouverte, dans n'importe quel onglet ; jamais pendant une session normale) :
- « La mine instantanée commence dans 30 min », puis 15 min, puis 5 min : simple information.
- « La mine instantanée commence dans 30 secondes » : information **et invitation**, boutons **Rejoindre** / **Décliner** (pour un joueur déjà inscrit : information seule).

**Pendant la mine** (onglet **Session**, tout le monde y bascule à l'ouverture) : **toute la mine à l'écran**, le chrono (5 min de jeu), ton butin, le classement (blocs minés, plumes), le journal, et **Quitter la mine**. À la fin, un bilan : ce qui est versé, le classement.

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
  - **secteur de préférence** : chacun a un tiers de la largeur (1er mineur à gauche, 2e au centre, 3e à droite) ; un minerai hors secteur vaut moins, et il ne « descend par l'existant » que dans son secteur. Préférence douce : il en sort si c'est plus rentable ;
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

Déjà en jeu, dans « Critères / préférences » du lobby : priorité `minerais` ou `descendre`, combattre les mobs oui/non, aider allié oui/non + mobs ignorés (`PREF_OPTIONS`, `PREFS.helpIgnore` en config). Les autres arriveront une par une, chacune avec ses tests de blocage.

### Questions ouvertes (gravité)
- ~~Une chute fait-elle perdre du temps ?~~ Réglé : chute imprévue de 3 cases ou plus = étourdi 5 s (§3, Chutes).
- Une échelle arrête-t-elle la chute ? (Recommandé : oui.)
- Le mineur peut-il remonter après une chute dans un trou sans échelle ? (L'IA doit poser des échelles pour revenir : cas de blocage à tester.)

## 8. Contraintes de dev

- Le temps de jeu est **réel (1h)** ; en dev, on doit pouvoir **accélérer** la simulation pour tester vite (x5 à x300 dans le prototype).
- Les valeurs d'équilibrage doivent être modifiables facilement.
