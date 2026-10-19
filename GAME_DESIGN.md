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
| `treasure` | coffre au trésor | trésor enfoui, voir ci-dessous |
| `special` | barrière | bloc de jeu sans rôle de ressource |

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

### Coffres au trésor
- Chaque area a une **probabilité** qu'un coffre au trésor y soit enfoui : **30 %** par défaut *(provisoire, réglable area par area)*. Le tirage dépend de la seed : même seed, même coffre.
- Le coffre remplace un bloc de terrain au hasard dans l'area.
- **Butin** *(provisoire)* : 6 minerais tirés parmi ceux de l'area (au prorata de leur nombre) + 1 objet **Trésor** (poids 2, usage défini plus tard avec le craft). Ce butin **ne compte pas** pour le déblocage de l'area.
- L'IA vise un coffre au trésor **une fois découvert** (comme un minerai très rentable) ; la boussole ne le signale pas.
- Le panneau d'area affiche la probabilité, et « trouvé » une fois le coffre ouvert.

## 3. Le mineur

### Déplacement
- **Le mineur est soumis à la gravité** : s'il y a du vide sous lui, il tombe case par case (8 blocs/s *(provisoire)*) jusqu'à atterrir sur un bloc solide ou **sur une échelle**. Il ne tombe pas s'il est sur une case avec échelle, ni s'il est posé juste au-dessus d'une case avec échelle. *(À définir : dégâts ou ralentissement de chute, voir questions ouvertes.)*
- Le mineur ne peut pas sauter. Actions possibles : **aller à gauche/droite, miner, poser une échelle**.
- **Descente** : le mineur creuse le bloc sous lui et se laisse tomber. **Il ne pose pas d'échelle en descendant.**
- **Échelles posées seulement au retour** : quand il doit remonter, il pose une échelle (2 s) sur chaque case où il en a besoin. Le chemin de retour est choisi au plus court en temps ; les échelles posées restent et servent aux trajets suivants. Un chemin de retour existe donc toujours (il peut toujours poser une échelle et creuser au-dessus de lui).
- Pour choisir où creuser, l'IA compte d'avance ce coût de retour : une case creusée vers le bas = une échelle à poser plus tard.
- **Vitesse sur échelle : ×0,75** de la vitesse de marche, dans les deux sens. Conséquence voulue : pour remonter, l'IA choisit un chemin au **temps** le plus court et préfère marcher horizontalement vers une échelle existante plutôt que de remonter tout droit en posant de nouvelles échelles.
- **Creuser vers le bas ou vers le haut coûte plus cher qu'horizontalement** : chaque case verticale impose une échelle (2 s de pose) et se parcourt plus lentement (×0,75), à l'aller comme au retour. L'IA compte ce coût (pose + trajets futurs) quand elle choisit un minerai : elle préfère donc les galeries.
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

### Caractéristiques
| Stat | Rôle | Valeur de base |
|---|---|---|
| Oxygène | Temps passé sous terre | 300 *(ferme, soit 5 min)* |
| Vitesse | Déplacement | 3 blocs/s *(provisoire)* |
| Vitesse de minage | Divise le temps de minage | 1 *(provisoire)* |
| Dégâts | Dégâts par coup contre les mobs | 5 *(provisoire)* |
| Pods | Poids d'inventaire | 200 *(provisoire)* |

### Oxygène
- 1 seconde dans la mine = 1 d'oxygène consommé.
- En surface : +30 par seconde.
- À court d'oxygène, l'IA remonte pour se recharger. (Le prototype remonte un peu avant 0, quand l'oxygène restant ne couvre plus que le trajet de retour plus une marge, pour ne pas rester coincé.)
- À 0 le mineur n'est pas mort : il est fortement ralenti.

### Pods (inventaire)
- Chaque bloc a un poids (terre 1, pierre 2, pierre dure 3, charbon 2, fer 3, or 4, diamant 5, Trésor 2 *(provisoire)*).
- Inventaire plein : remontée **automatique**, dépôt dans le coffre, puis retour au front.

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
  - **Mimics** : faux minerais, visibles à la boussole comme des minerais. Ils se dévoilent à proximité. Les vaincre rapporte des minerais. Comme les bestioles, un mimic dévoilé ne déclenche le combat que s'il est dans le champ de vision du mineur.

## 6. Hors session

- Les ressources du coffre sont transférées dans l'**inventaire global** en fin de session, **partagées entre les joueurs** de la session (voir ci-dessous).

### Partage du coffre en fin de session
Une session réunit **jusqu'à 3 mineurs, un par joueur** (chaque mineur est rattaché à un ID de compte). Le coffre est commun ; en fin de session, son contenu est réparti :
- **parts égales** : chaque joueur reçoit le même nombre de chaque ressource, quelle que soit sa contribution ;
- **reste** d'une division qui ne tombe pas juste : donné **au hasard**, une unité au plus par joueur (100 charbons à 3 → 33, 33, 34). Le tirage dépend de la seed : même partie, même partage ;
- **Trésor** : ne se partage pas, **chaque joueur en reçoit un exemplaire** par Trésor rapporté (un coffre au trésor ouvert à 3 = 1 Trésor pour chacun) ;
- **solo** : le joueur garde tout ;
- ce qu'un mineur porte encore sur lui à la fin est perdu (il n'est pas dans le coffre).
- **un joueur qui quitte la session avant la fin ne reçoit rien** : son mineur disparaît de la mine, ce qu'il portait est perdu, et le coffre est partagé entre les joueurs **présents à la fin** (sa part leur revient). Si tout le monde part, la session s'arrête et personne ne reçoit rien.
- **le partage est calculé par le serveur** (anti-triche) : décision prise ; pour l'instant la session tourne encore dans le navigateur (voir le plan « session côté serveur »).
- Tant qu'il n'y a pas de lobby, les 3 mineurs tournent sur la machine du joueur : **il contrôle Rouge** et ne reçoit que **sa part** ; Bleu et Vert sont des coéquipiers sans compte.
- Une **UI à part** (à concevoir) permet de crafter, de gérer les caractéristiques du mineur et son stuff.
- Ce qui n'est pas encore défini : recettes, objets, coûts, arbre d'amélioration.

### Navigation
Une barre d'onglets est **toujours ouverte à gauche** de l'écran : **Mine, Inventaire, Stuff, Craft, Four, Talents, Social**.
- **Mine** : la session en cours (les mineurs, la carte, le coffre commun).
- **Inventaire** : tout ce que possède le joueur (voir ci-dessous).
- Stuff, Craft, Four, Talents, Social : à concevoir (page d'attente pour l'instant).
- Changer d'onglet **ne met pas la session en pause** : la mine continue de tourner ; un mini-minuteur de session reste visible dans la barre.

### Inventaire global
Une grande grille de **slots** ; chaque slot contient un objet et sa quantité (ex. « Charbon × 100 »).
- Un objet **déjà présent s'empile** sur son slot, **sans taille maximum**.
- Un objet **absent prend un nouveau slot** : le premier slot libre (**ordre d'arrivée**, un objet garde sa place).
- Les objets de **stuff ne s'empilent pas** : chaque exemplaire prend son propre slot (chaque pièce pourra avoir ses propres stats).
- **Capacité illimitée** pour l'instant : au moins 48 slots affichés (8 colonnes), une ligne s'ajoute quand la grille est pleine. Une limite pourra devenir une amélioration plus tard *(valeur de config)*.
- Un slot vidé (objet consommé par le craft) reste un trou, réutilisé par le prochain nouvel objet.
- Les objets arrivés en fin de session sont mis en évidence jusqu'à la prochaine visite de l'onglet (pastille sur l'onglet).

### Comptes joueur
Pas d'adresse e-mail. Détails techniques : `docs/comptes.md`.
- Au lancement, écran de connexion : **se connecter** (pseudo + mot de passe), **créer un compte**, ou **jouer en invité** (1 clic).
- Un **invité** n'a ni pseudo ni mot de passe : son compte n'existe que dans ce navigateur. Il peut le **sécuriser** à tout moment (pseudo + mot de passe) sans rien perdre.
- Chaque compte a un **ID de compte** public et définitif (ex. `7K3Q-9XHP`), qui servira à ajouter un ami ou à l'inviter dans un lobby. C'est à cet ID qu'est rattaché tout ce que possède le joueur.
- **Pseudo** unique (sans tenir compte des majuscules ni des accents), 3 à 16 caractères *(valeurs de config)*.
- Mot de passe oublié : un **code de secours** est donné à la création (montré une seule fois) ; avec pseudo + code, on choisit un nouveau mot de passe.
- Le compte est visible en bas de la barre de navigation (pseudo + ID, ou « Invité · à sécuriser ») ; un clic ouvre « Mon compte ».
- Pour l'instant l'inventaire reste sauvegardé dans le navigateur (une sauvegarde par compte) ; l'inventaire d'avant les comptes est repris par le premier compte connecté.

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

Déjà dans le prototype : priorité `minerais` ou `descendre`, combattre les mobs oui/non.

### Questions ouvertes (gravité)
- Une chute fait-elle perdre du temps/de l'oxygène, ou est-elle gratuite ? (Recommandé : un petit ralentissement après la chute, pour que boucher un trou avec une fondation ait un intérêt.)
- Une échelle arrête-t-elle la chute ? (Recommandé : oui.)
- Le mineur peut-il remonter après une chute dans un trou sans échelle ? (L'IA doit poser des échelles pour revenir : cas de blocage à tester.)

## 8. Contraintes de dev

- Le temps de jeu est **réel (1h)** ; en dev, on doit pouvoir **accélérer** la simulation pour tester vite (x5 à x300 dans le prototype).
- Les valeurs d'équilibrage doivent être modifiables facilement.
