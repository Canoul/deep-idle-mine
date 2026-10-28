# Journal d'avancement

Où en est le jeu, qui a fait quoi, ce qui est en ligne. Écrit par Claude à la fin de chaque tâche, **le plus récent
en haut**, en langage simple. Le détail technique (fichiers, tests, chiffres) est dans `docs/debug.md`.

**Chantiers en cours** (pas encore en ligne) : ce sont les branches git. Demande à Claude « qu'est-ce qui est en
cours ? » ou lance `git branch -r --no-merged origin/main`.

Modèle d'entrée :

```
## 27/10/2026 — Geoffrey — Correctif : « Lancer » grisé alors que tout le monde est prêt
- **Pour le joueur** : si on avait ouvert (ou rechargé) la page pendant une session, le bouton **Lancer** et
  « Inviter des joueurs » restaient grisés après la fin de la session, tant qu'on n'avait pas fermé le bilan avec le
  bouton de retour. C'est corrigé : le lobby connaît le joueur dès l'ouverture de la page.
- **État** : ✅ en ligne le 27/10

## JJ/MM/AAAA — Prénom — Titre court
- **Pour le joueur** : ce qui change en jeu (ou « rien, c'est de l'organisation »).
- **Décisions** : choix de design ou d'équilibrage tranchés (s'il y en a).
- **À suivre** : ce qui reste à faire ou à vérifier.
- **État** : 🧪 sur la branche `prénom/sujet` (pas en ligne) → ✅ en ligne le JJ/MM
```

---

## 28/10/2026 — Geoffrey — Nouveau mob : le mur de chair
- **Pour le joueur** : à partir de l'area 6, un **mur de chair** (une colonne de 6 cases) peut sortir de la roche à
  quelques colonnes du mineur et avancer vers lui en balayant la mine à l'horizontale. On ne peut ni le traverser ni
  miner ce qu'il recouvre : il faut le tuer (200 PV). Près de lui, le mineur perd 10 % de vitesse d'attaque toutes les
  2 s (jusqu'à −90 %). Il laisse de la Rotten flesh (1 à 3) et de la chitine (1 à 5).
- **Décisions** : 2 / 5 / 8 % des apparitions en areas 6 / 7 / 8+, pris sur le gobelin ; plafond à −90 % (un joueur seul
  n'est jamais bloqué pour de bon) ; stacks de 10 s, perdus hors du rayon ; Ténacité par stack ; naissance à 8 à 12
  colonnes pour qu'on le voie arriver. Texture originale (pas celle d'un autre jeu).
- **À suivre** : à observer en vrai dans les areas 6-8 (les sessions simulées n'y vont pas encore).
- **État** : ✅ en ligne le 28/10

## 28/10/2026 — Geoffrey — Discord : annonces dès R6
- **Pour le joueur** : le bot Discord annonce aussi les **R6** (plus seulement les R7) : un trésor de tour ou un coffre
  du Roi Gobelin (instance) R6 ou R7 obtenu par un joueur, et une pièce identifiée R6 ou R7.
- **État** : ✅ en ligne le 28/10

## 28/10/2026 — Geoffrey — Clé d'instance I : craft de base
- **Pour le joueur** : la **Clé d'instance I** se fabrique dès le départ dans l'onglet Craft (250 peaux de gobelin,
  20 pierres glissantes, 50 tissus sombres, 1 Barre d'argent), sans plan. Le **Treasure T4** ne donne plus son plan
  (il garde les plans du Saphir, du Rubis et du Jade). Un plan déjà trouvé reste dans l'inventaire et se recycle en
  parts (15 à 30). La clé sort toujours des Treasure T3 (20 %).
- **Décisions** : Geoffrey (avant : plan du Treasure T4, 5 %).
- **État** : ✅ en ligne le 28/10

## 28/10/2026 — Geoffrey — Skills : 5e étage, les maîtrises
- **Pour le joueur** : une nouvelle case au bas de chaque arbre (0/3, débloquée quand l'étage 4 est au max).
  **Mineur : Maîtrise de la pioche**, les stats de la pioche portée +5 % par rang ; **Barbare : Maîtrise de l'épée**,
  +5 % par rang sur l'épée ; **Logisticien : Maîtrise du bench**, +3 % par rang sur le torse. À 3/3 : pioche en fer
  +0,4 → +0,46 de minage, épée en fer 14 → 15,4 dégâts, plastron en fer +88 → +96 pods. Visible dans l'onglet Stuff
  (colonne des skills).
- **Décisions** : valeurs de Geoffrey. Choix de Claude, à valider : ça marche comme l'amélioration (lignes et rune
  comprises, l'épée compte ce qu'elle ajoute aux mains nues, un malus n'empire pas) ; **pas compté dans le gear score**.
- **À suivre** : 3 points de plus par arbre (Mineur 13, Logisticien 14, Barbare 15 au total).
- **État** : ✅ en ligne le 28/10

## 28/10/2026 — Geoffrey — Gear score : les ajustements de prix ne gonflent plus le GS
- **Pour le joueur** : le GS des pioches et des armes redescend (pioche en fer 1 560 → 520, pioche en acier 2 262 →
  754, épée en fer 720 → 360) ; les stats ne bougent pas. Les pièces aux stats divisées le 27/10 (thorium, cobalt,
  butin rare des mobs, Gants de boucher…) ont un GS plus bas qu'hier. Les classements Gear score et le plafond de la
  modulation suivent.
- **Décisions** : les diviseurs du 27/10 (offensives ÷ 2, minage ÷ 3…) divisent la stat ET sa valeur en GS : ils
  servent seulement à dessiner les pièces ; le GS reste au prix mesuré.
- **État** : ✅ en ligne le 28/10

## 28/10/2026 — Geoffrey — Correctif : réclamer le butin du Bloc géant
- **Pour le joueur** : après « Réclamer », les objets apparaissent tout de suite dans l'inventaire (mis en évidence,
  pastille sur l'onglet) : plus besoin d'actualiser la page ni de trier. Pendant la réclamation, le bouton affiche
  « Réclamation… » et le message dit « C'est dans ton inventaire » : on voit que le premier clic a marché.
- **À suivre** : le « il faut cliquer 2 fois » n'a pas été reproduit (un seul clic suffit, même avec un réseau lent) ;
  le plus probable : sans retour visible, le joueur recliquait. Si ça revient, demander sur quel appareil (mobile ?).
- **État** : ✅ en ligne le 28/10

## 28/10/2026 — Geoffrey — Tours du Jugement : ouvertes 4 h au lieu de 6
- **Pour le joueur** : quand une jauge est pleine, la tour de l'Ange ou du Démon reste ouverte **4 h** (avant 6 h). Le
  message Discord et le Lobby suivent. Une tour déjà ouverte au moment de la mise en ligne garde son heure de fermeture.
- **État** : ✅ en ligne le 28/10

## 28/10/2026 — Geoffrey — Sets : équiper pendant une session, pour la suivante
- **Pour le joueur** : le bouton **Équiper** d'un set marche maintenant **pendant une session**. La session en cours
  continue avec l'équipement de son lancement ; le set compte **dès la prochaine session**. Enregistrer et Nouveau set
  restent après la session ; renommer et supprimer, toujours possibles.
- **État** : ✅ en ligne le 28/10

## 28/10/2026 — Geoffrey — Mine instantanée : nouvelle composition avec les minerais du tier 4
- **Pour le joueur** : la mine instantanée contient maintenant **40 % de charbon, 27 % de fer, 20 % d'or**, 5 % de
  graphite, **3 % de mithril, 1,5 % de cobalt, 1,5 % de thorium**, 1 % de diamant et 1 % de tas de plumes (avant : 20 %
  charbon, 40 % fer, 33 % or). Par joueur et par mine à 3 : environ 3 mithrils, 1 à 2 cobalts et 1 à 2 thoriums. La mine
  est plus tendre (plus de charbon) : un peu plus de blocs creusés et de plumes ramassées à 3 (≈ 4,8 au lieu de 3,6).
- **Décisions** : Geoffrey accepte que les mineurs descendent un peu plus souvent jusqu'au fond à 3 joueurs.
- **État** : ✅ en ligne le 28/10

## 28/10/2026 — Geoffrey — Table de recherche : tier 4, recyclage revu
- **Pour le joueur** : un **tier 4** arrive à la table de recherche : **250 parts** pour un plan du Treasure T4
  (stuff en mithril, thorium, cobalt et pièces spéciales), ouvert quand on a appris **toutes** les recettes des tiers 1
  à 3. Recycler un plan rend maintenant **30 à 45 parts** (tier 2, avant 40 à 70), **45 à 60** (tier 3, avant 40 à 70),
  **60 à 75** (tier 4). Le tier 4 se fait **en 3 étapes** : d'abord les 4 pièces en mithril et les 4 pièces spéciales
  (Lunettes, Doc Martins, Ceinture, Gants), puis, quand ces recettes sont apprises, les 8 pièces en thorium et en
  cobalt, et enfin les Jambières titanesques. L'onglet affiche « Étape x / 3 ». Un plan secret sorti de la recherche révèle la pièce dans le wiki et l'annonce sur Discord.
- **Décisions** : valeurs de Geoffrey. Les plans du 2e jet du T4 (Clé d'instance I, gemmes) ne sortent pas de la
  recherche ; recyclés, ils rendent comme le tier 1 (15 à 30).
- **État** : ✅ en ligne le 28/10

## 27/10/2026 — Geoffrey — Tier 4 : stats ajustées par Geoffrey ; plans secrets annoncés sur Discord
- **Pour le joueur** : les stats offensives et de minage des nouvelles pièces sont divisées (choix de Geoffrey) :
  offensives ÷ 2 (plastron en thorium : dégâts +3,85 au lieu de +7,7), dégâts % ÷ 3 (jambes en thorium +31,3 % au lieu
  de +93,8 %), perçage ÷ 4, vitesse de minage ÷ 3, ténacité ÷ 2, résistance au recul ÷ 3. Dans le wiki, les effets des
  pièces en thorium, en cobalt et des pièces spéciales restent **cachés tant que personne n'a trouvé leur plan** (le
  mithril reste visible). Le premier plan trouvé est **annoncé sur Discord avec les stats** de la pièce ; pareil pour le
  premier exemplaire trouvé de la Couronne, de la Masse et de la Cape royale du Roi Gobelin. Le **GS** compte les mêmes
  diviseurs : pioches × 3, épées × 2 (classements compris), sans que les pièces existantes changent de stats.
- **Décisions** : **ajustements de Geoffrey** (ses choix, pas des mesures), dans la config (`UPGRADE.priceAdjust`). À
  réappliquer si on resimule les poids des stats, et à signaler dans le rapport.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Classements : le compte « admin » n'y figure plus
- **Pour le joueur** : le compte « admin » (celui de l'équipe pour tester) n'apparaît plus dans aucun classement et ne
  compte pas dans le nombre de joueurs classés.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Classements dans l'onglet Social
- **Pour le joueur** : un 3e sous-onglet **Classements** dans Social, avec quatre classements de tous les joueurs :
  **Gear score**, **Niveau** (XP), **Spécialisation** (un classement par arbre : Mineur, Logisticien, Barbare) et
  **Tour céleste** (meilleur temps pour battre le boss, Ange et Démon confondus). On voit les 50 premiers, et sa propre
  place en bas si on n'y est pas. Pour la tour, chaque joueur de l'équipe garde son meilleur temps, et on voit avec qui
  il l'a fait.
- **Décisions** : un classement par spé, temps de tour par joueur avec l'équipe, top 50 + sa place (Geoffrey). Les
  victoires en tour du dernier mois (encore gardées par le serveur) sont reprises ; les plus anciennes sont perdues.
  Les parties du mode dev ne comptent pas.
- **À suivre** : rien d'obligatoire ; idées possibles : bouton « Ajouter » sur une ligne, classement du Bloc géant.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Tier 4 : Treasure T4, mithril, thorium, cobalt
- **Pour le joueur** : un **Treasure T4** se cache dans les areas 7 et 8. Il donne toujours du mithril, du cobalt, du
  thorium et des BP parts, et parfois un plan : armures en **mithril**, **thorium** ou **cobalt**, **Lunettes Gucci**,
  **Doc Martins**, **Ceinture golémique**, **Gants de boucher**, **Jambières titanesques** (épique), ou les plans de la
  **Clé d'instance I** et des gemmes (seulement si on ne les a pas encore appris). Nouvelles gemmes : **Topaze, Saphir,
  Rubis, Jade**. Au four : Mithril ingot, Refined cobalt, Refined thorium, puis les alliages Cobalt ingot et Thorium
  ingot. Le minotaure donne aussi **1 à 3 Cuir de minotaure**. Les armures en thorium et en cobalt se fabriquent à partir
  de la pièce en mithril : c'est toujours l'exemplaire le plus simple de l'inventaire qui est utilisé.
- **Décisions** : T4 = 650 x (la Couronne du Roi Gobelin passe de 600 à 650 x), T4.5 = 750 x ; seulement les 4
  armures (pas d'épée, lance ni pioche : pas de recette) ; Lunettes Gucci dans la case casque ; BP mithril 1 %, thorium et
  cobalt 0,5 %. Choix de Claude, à valider : durées du four (1 min), alliages à 50 charbons et 3 min, les 4 BP du 2e jet
  tirés chacun à part, « vitesse % » des jambes en cobalt = vitesse de minage %.
- **À suivre** : le **Rotten flesh** n'a pas de source (mob à concevoir) : pas de Gants de boucher pour l'instant. Pas de
  tier 4 à la Table de recherche. Les pièces spéciales n'ont pas d'apparence sur le mineur (icônes seulement).
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Onglet Stuff : « Gobelins asservis » cachée
- **Pour le joueur** : la ligne « Gobelins asservis (rayon) » n'apparaît plus dans les stats de l'onglet Stuff. La
  Couronne du Roi Gobelin fait toujours le même effet, et sa bulle le montre encore.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Nouveaux minerais : mithril, cobalt, thorium (areas 7 et 8)
- **Pour le joueur** : trois nouveaux minerais tout en bas de la mine. Le **mithril** (rareté commun) apparaît dès
  l'area 6, le **cobalt** et le **thorium** (rareté inhabituel, nom en vert) dès l'area 7. Deux nouvelles areas : la **7** et la
  **8** (la 8 se répète ensuite), surtout faites de pierre dure, donc lentes à creuser. L'area 6 change un peu : moins
  de fer (7 % → 5 %), 2 % de mithril. On peut déjà les miner et les rapporter, mais **ils ne servent à rien pour
  l'instant** (pas de four ni de craft).
- **Décisions** : compositions des areas 6 à 8 et raretés : Geoffrey. Dureté, poids, attrait pour l'IA et XP : valeurs
  provisoires proposées par Claude (mithril un peu plus dur que le graphite, cobalt et thorium plus durs que le diamant).
- **À suivre** : à quoi servent ces minerais (four, alliages, stuff du tier 4) ; faut-il des mobs, un Treasure T4 ou
  des donjons propres aux areas 7-8 (pour l'instant : ceux des areas précédentes).
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Anneaux améliorables avec un doublon ; boussole et torche hors Amélioration
- **Pour le joueur** : un **anneau** s'améliore de +1 à +9 en sacrifiant un **doublon du même anneau** (pas de plumes ni
  de cristaux), avec les mêmes chances de réussite que les autres pièces. Chaque niveau ajoute **+0,5** à chacun de ses
  effets : +3 % → **+7,5 % au +9**. Si deux joueurs du groupe portent le même anneau, le plus haut niveau compte. La
  **boussole** et la **torche** (Lampe à incandescence) ne s'identifient, ne s'améliorent et ne s'enchantent plus.
- **Décisions** : +0,5 point par niveau (provisoire) ; le plus haut niveau compte ; boussoles et torches déjà
  identifiées, améliorées ou enchantées **remises à zéro**, sans remboursement (rune comprise) ; le doublon de plus bas
  niveau est sacrifié, même en cas d'échec (choix de Claude).
- **À suivre** : un anneau tombe à 1 % par trésor ; un +9 demande ≈ 11 doublons à cause des échecs.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Mode dev : presets de personnage par spécialisation
- **Pour le joueur** : rien, c'est un outil de test. Trois presets, un par spé : **Test_Mineur**, **Test_Logisticien**,
  **Test_Barbare**. Chacun : stuff complet en acier porté, arbre de sa spé rempli avec **tous les glyphes de sa spé posés**,
  sorts de la spé équipés.
  - **Mineurs de test** : dans le panneau dev du lobby, chaque mineur de test a un menu « Preset » : il part avec le nom,
    le stuff, l'arbre, les glyphes et les sorts du preset (mine, tours, instance). Sans preset : stats de base, comme avant.
  - **Comptes** : `npm run dev:presets` (serveur arrêté) crée ou remet à neuf les trois comptes locaux (mot de passe
    `preset1234`), avec en plus 10 Clés d'instance I, pour jouer à plusieurs navigateurs.
- **Décisions** : niveau et niveau de spé à **72**, pas 100 : au-delà, l'XP ne tient plus dans un nombre que le serveur
  accepte. Ça ne change rien en pratique : un arbre coûte 10 à 12 points et les sorts de spé s'ouvrent au niveau 5.
  Une spé imposée dans le panneau dev passe avant celle du preset (le stuff reste).
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Buff du stuff en acier : 400 x → 500 x
- **Pour le joueur** : chaque pièce en acier gagne l'équivalent de +100 x (≈ 100 s de travail par session) :
  casque oxygène **+125** (avant +100), jambes montée **+2** (1,6), bottes marche **+2,08** (1,67), plastron pods **+137**
  (120), pioche minage **+0,58** (0,5), épée **18,5** dégâts (16). Les pièces déjà fabriquées sont buffées aussi.
  Les **runes** posées sur une pièce du tier 3 (acier, Plastron de l'équilibre, masse et cape du Roi Gobelin) donnent
  **25 % de plus**, celles déjà posées comprises.
- **Décisions** : le tier 3 des runes passe à **500 x** avec l'acier (la règle « casque, jambes, bottes = valeur du tier »
  reste vraie). La couronne (tier 4, 600 x) n'est plus que 100 x au-dessus.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Fin de session : les mineurs ne s'arrêtent plus trop tôt au-dessus du front
- **Pour le joueur** : dans les dernières minutes, les mineurs restaient miner bien au-dessus du front « pour avoir le
  temps de remonter », même avec un treuil rapide (session du 27/10 : 90 couches au-dessus du front dès 6 min 30 de la
  fin). Ils comptaient la descente aussi lente que la remontée, plus 25 % de marge. Maintenant ils mesurent aussi leur
  vraie descente : ils restent juste sous le front jusqu'à la remontée finale. Rejoué sur cette session : +4 diamants,
  +17 graphite, +1 Treasure T3, XP +1 %.
- **Décisions** : la règle ne change pas (un dernier trajet doit laisser au moins autant de temps à miner que de trajet,
  `endWorkShare` 0,5) ; seule l'estimation du trajet est corrigée.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Instance : vitesses en mode dev, recul des gobelins à chaque coup
- **Pour le joueur** : les gobelins de l'instance repoussent de 0,5 case **à chaque coup** (avant : 30 % des coups, presque
  invisible). Mode dev : la barre de l'instance a enfin les vitesses (×1 à ×300) et la pause, comme la mine et les tours.
  Les spawners font apparaître un gobelin toutes les **20 s** (avant 30 s).
  Le groupe casse les spawners **un côté entier puis l'autre** (avant : en zigzag d'un mur à l'autre), les gobelins
  avancent **2 fois plus vite**, et la **caméra est rapprochée** (14 × 11 cases, elle suit ton mineur, comme dans la tour).
  ⚠️ Simulation à 3 (sans skills ni sorts, avec le buff de l'acier) : 0/10 réussites avec le spawn à 20 s ; 10/10 avec
  30 s. Mis en ligne tel quel, à la demande de Geoffrey.
- **Décisions** : recul à chaque coup (choix de Geoffrey). Simulation à 3 sans skills : sans le buff de l'acier,
  fer + acier passe de 7/10 à 0/10 réussites et acier de 10/10 à 3/10 ; **avec** le buff de l'acier (branche
  `geoffrey/acier-500`), 10/10 dans les deux cas (+5 à 10 s). À mettre en ligne avec le buff de l'acier.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Barre d'argent : les pépites du Bloc géant
- **Pour le joueur** : la récompense de minuit du **Bloc géant** donne en plus **1 Pépite d'argent par tranche de 100 de
  tes points** du jour (les tiens, pas ceux de tous), même si le score collectif n'atteint aucun palier. Au **four**
  (mode Fondre, sans rien débloquer) : **10 pépites + 10 charbon → 1 Barre d'argent**, en 1 min. La carte du Bloc géant
  affiche les pépites déjà gagnées dans la journée.
- **Décisions** : il faut toujours être venu 2 fois dans la journée pour toucher la récompense (pépites comprises).
  Choix de Claude, à valider : durée de fonte 1 min (comme le fer) ; les jours finis pas encore réclamés donnent aussi
  leurs pépites.
- **À suivre** : la barre d'argent n'a pas encore d'usage. Repère : ≈ 146 points par visite sans stuff, donc ≈ 2 à 3
  pépites pour 2 visites : une barre tous les 3 à 4 jours pour un joueur qui fait le minimum.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — K hole : dans l'arène et les vagues, tout le monde se bat
- **Pour le joueur** : un mineur réglé sur « Ignorer » ou « Fuir » les mobs se bat quand même dans l'**Arène des
  minotaures** et dans les **Vagues** du k hole. Avant, il restait planté pendant 2 min (« Plus rien à explorer ») et
  l'arène était souvent perdue (seed 2026520156 : 1 485 dégâts sur 2 000 à deux). Dans la mine et la carte Filons, le
  réglage est toujours respecté.
- **Décisions** : option 1 recommandée par Claude, retenue par Geoffrey.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Runes : stuff du Roi Gobelin au tier 3, couronne au tier 4
- **Pour le joueur** : une rune posée sur la masse ou la cape du Roi Gobelin vaut un % de **400 x** (tier 3) ; sur la
  **couronne**, de **600 x** (nouveau **tier 4**). Ces pièces sortent déjà identifiées à la qualité de leur coffre.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Wiki : effets des nouveaux objets cachés tant que personne ne les a trouvés
- **Pour le joueur** : dans le wiki, la **Couronne du Roi Gobelin**, la **Masse du Roi Gobelin** et la **Cape royale du
  Gobelin** s'affichent avec « ❓ Effets inconnus : personne ne l'a encore trouvé ». Dès qu'un joueur en obtient une en
  jeu (ouverture d'un coffre ou d'un trésor, fin de session), ses effets apparaissent pour tout le monde.
- **Décisions** : un don d'administration ne compte pas (on peut tester sans rien révéler). Choix de Claude : la stat
  « Gobelins asservis » (seulement sur la Couronne) est cachée elle aussi ; le nom et la chance de chaque objet dans le
  coffre restent visibles.
- **À suivre** : pour cacher un autre objet plus tard, ajouter son nom à `WIKI.secret` (config).
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Clé d'instance I : 20 % dans les Treasure T3
- **Pour le joueur** : un Treasure T3 donne une Clé d'instance I **1 fois sur 5** (avant 1 sur 20).
- **État** : ✅ en ligne le 27/10 (sans relancer les tests, demande de Geoffrey)

## 27/10/2026 — Geoffrey — Roi Gobelin : son coffre et 5 nouveaux objets
- **Pour le joueur** : un **Coffre du Roi Gobelin** (qualité R1 à R7) s'ouvre dans l'inventaire : graphite, peaux de
  gobelin, et au plus un objet rare : **Couronne du Roi Gobelin** (1 %), **plan du Four en or** (2 %), **Masse du Roi
  Gobelin** (2 %), **Cape royale du Gobelin** (2 %) ; plus la **Recette : Chitine** (5 %, si pas encore apprise), au plus
  un **parchemin de sort** (Ulti shen 1 %, Fast learner 0,5 %, Cleave 1 %, Hand of Justice 1 % ; jamais un sort déjà
  appris) et une gemme (1 % chacune). Les pièces arrivent identifiées à la qualité du coffre.
  - **Couronne** (casque, légendaire) : fortune +10 %, et les gobelins qui apparaissent à 10 cases du porteur sont
    **asservis** : 30 s à miner autour d'eux pour le coffre commun (ligne « 👑 Gobelins asservis »), puis ils disparaissent.
  - **Masse** (14 dégâts, critique +15 %), **Cape royale** (dégâts +5 %, minage +5 %), **Four en or** (3e four, ×1,5),
    **Recette : Chitine** (10 peaux + 10 charbon → 5 chitine au four).
- **Décisions** : le **boss n'existe pas encore** ; en attendant, le coffre n'est donné que par l'équipe. Asservis : à
  10 cases du porteur, quand ils apparaissent. Choix de Claude, à valider : objets au tier 3 pour les runes ; les asservis
  n'ont ni fortune ni shiny ; Lampe à incandescence passée au tier 2 des runes (un test l'exigeait).
- **Lien avec l'Instance I** (15 h) : **roi vaincu → un Coffre du Roi Gobelin par joueur encore présent** ; **si le
  groupe perd, la clé est rendue à tous** ; le bouton « 🗝 Instances » reste cliquable pendant une session (on regarde
  la carte ; choix de Claude, la demande « rend disponible le bouton » ne disait pas lequel).
- **À suivre** : rien.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Instances : l'Instance I, le roi gobelin
- **Pour le joueur** : nouveau choix « 🗝 Instances » dans « Où miner ». L'Instance I se joue en groupe de 1 à 3, avec
  une **Clé d'instance I** chacun (dans les Treasure T3, 5 %), consommée au lancement. En 10 min : monter aux 6 rebords
  et casser leurs spawners à gobelins (les gobelins taclent et repoussent vers le centre), puis vaincre le roi gobelin
  (3 500 PV), qui enferme tout le monde sur les rebords tous les 20 % de ses PV et enrage à la fin. Pas encore de
  récompense.
- **Décisions** : valeurs réglées par Geoffrey en simulation (salle 28 × 24, 3 rebords par côté avec 5 cases d'air
  entre deux, spawners 125 coups, gobelins 150 PV, roi 3 500 PV, 10 min). Choix de Claude à valider : le groupe casse
  les spawners ensemble (le plus bas d'abord), le roi reprend dès qu'un mineur est sorti de sa cage (90 s au plus), départ
  au sol au centre, Hand of Justice ne marche pas sur le roi.
- **À suivre** : la récompense ; à 3, fer 0/20, fer + acier 13/20, acier 20/20 (sans skills ni sorts) ; seul, impossible.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Bloc géant : aussi pendant une session, récompense à partir de 2 visites
- **Pour le joueur** : on peut **entrer au Bloc géant pendant une session**, et le chef peut **lancer une session
  pendant une visite** (la Mine instantanée aussi prend un joueur en visite). Les deux continuent chacune de leur côté.
  Dans l'onglet Session, une barre « ⛏ Ma session / 🌈 Bloc géant » permet de passer de l'une à l'autre.
  La **récompense de minuit** demande maintenant d'être venu **au moins 2 fois dans la journée** ; la carte affiche
  « Encore N visites aujourd'hui pour avoir la récompense de minuit ».
- **Décisions** : les deux sens (session → Bloc géant et Bloc géant → session) ; 2 visites au Bloc géant (pas
  2 sessions de mine) ; compté à partir de la journée du 27/10, les journées déjà finies gardent l'ancienne règle.
- **À suivre** : rien.
- **État** : ✅ en ligne le 27/10

## 26/10/2026 — Geoffrey — Discord : annonce de l'ouverture des tours
- **Pour le joueur** : quand la Tour de l'Ange ou la Tour du Démon s'ouvre, le bot Discord poste
  « 🚨 La Tour du Démon est ouverte pendant 6 h ! 🚨 ». Une seule fois par ouverture, quelle qu'en soit la cause
  (jauge remplie par les résidus, réouverture automatique, commande d'admin).
- **État** : ✅ en ligne le 27/10 (codée le 26/10, oubliée sur sa branche)

## 27/10/2026 — Geoffrey — 4 nouveaux sorts
- **Pour le joueur** : dans l'onglet Sorts,
  - **Bonbonne de zipette** (Logisticien niveau de spé 10) : le prochain allié à 3 cases ou moins qui travaille dans la
    mine et à qui il manque de l'oxygène regagne 20 % des pods max du logisticien en oxygène ; recharge 180 s, comptée
    une fois l'oxygène donné ;
  - **Cri de guerre** (Barbare niveau de spé 10) : quand il entre en combat, lui et les mineurs à 10 cases ou moins font
    +10 % de dégâts et attaquent 5 % plus vite pendant 30 s ; recharge 180 s après l'effet ;
  - **Cleave** (parchemin) : en combat, 50 % de ses dégâts à tous les mobs à 2 cases ou moins, critique possible ; 10 s ;
  - **Hand of Justice** (parchemin) : étourdit 3 s un mob qui se bat à 3 cases ou moins (d'abord celui qui tacle un
    allié) ; 30 s.
  Les parchemins de Cleave et Hand of Justice n'ont pas encore de source (outil d'admin pour tester). Wiki : les sorts et
  parchemins s'affichent tout seuls depuis la config.
- **Au passage** : le wiki affichait encore « ≈ 3 % par session » pour les glyphes (oubli de ce matin) : corrigé, le
  texte suit maintenant la config.
- **Décisions** (Geoffrey) ; choix de Claude à valider : zipette sur l'allié qui a le moins d'oxygène (en %) quand il y
  en a plusieurs, et seulement s'il lui en manque ; Cleave ne touche pas un boss de donjon qu'il ne combat pas (mur de
  la salle) ; Hand of Justice coupe aussi la canalisation de l'occultiste, comme le Dash ; un 2e Cri de guerre prolonge
  l'effet sans le cumuler.
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Stuff : armures à la valeur de leur tier, combat du butin des mobs divisé par 2
- **Pour le joueur** : casque, jambes et bottes valent maintenant exactement leur tier : chitine 100 x, fer 250 x,
  acier 400 x (petits ajustements : casque en chitine +25, casque en fer +63, jambes en fer +1, bottes +0,42 / +1,04).
  Les **plastrons ne changent pas** : la pièce de torse est volontairement plus forte. Le butin rare
  des mobs a ses **stats de combat divisées par 2** (Lanières : attaque +31,9 %, butin +12,5 % ; Capuche : recul +0,52,
  critique +4,8 % ; Ceinture du Géant : dégâts +1,6, ténacité +12,5 % ; Nuage : marche +1,04).
- **Décisions** (Geoffrey) : règle permanente, gardée par un test : casque, jambes, bottes = valeur du tier, plastron
  au-dessus (torse plus fort, hors règle) ; butin des mobs = 250 x à
  parts égales, une stat de combat n'en reçoit que la moitié. Les pièces dessinées à la main (épées, pioches, Plastron
  de l'équilibre, gants, cape…) ne bougent pas.
- **À suivre** : la Capuche passe de recul +0,13 à +0,52 (l'équation, même divisée par 2, donne plus qu'avant). Tout
  en fer = 2 160 GS, tout en acier = 3 011 GS (seuil de la modulation : 2 000).
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Groupe : le chef absent n'est plus retiré
- **Pour le joueur** : un chef qui part (onglet fermé, PC en veille, téléphone verrouillé) **reste chef** de son groupe,
  même des heures, affiché « absent » ; à son retour il retrouve son groupe. Avant, il était retiré au bout de 5 min et
  le suivant devenait chef (le chef revenait dans un lobby vide). Les autres joueurs quittent s'ils ne veulent pas
  l'attendre. Les membres : inchangé (retirés après 5 min sans nouvelles, sauf s'ils sont prêts).
- **Décisions** (Geoffrey).
- **État** : ✅ en ligne le 27/10

## 27/10/2026 — Geoffrey — Glyphes : 1 % par session au lieu de 3 %
- **Pour le joueur** : trouver un glyphe dans la mine est 3 fois plus rare : environ **1 % par session** dans un groupe de
  3 (avant 3 %), ≈ 1,5 % en solo. Spé Mineur 0,00126 % par bloc cassé, Logisticien 0,011 % par échelle posée, Barbare
  0,0335 % par mob tué. Un arbre de 3 glyphes demande ≈ 300 sessions en moyenne (avant ≈ 100). Wiki mis à jour.
- **Décisions** (Geoffrey).
- **État** : ✅ en ligne le 27/10

## 26/10/2026 — Geoffrey — Butin rare des mobs : chances baissées
- **Pour le joueur** : les pièces lâchées par les mobs tombent bien moins souvent. Lanières en cuir du gobelin, Capuche
  sombre et Nuage magique : **0,1 %** (avant 0,5 %) ; Ceinture du Géant : **0,5 %** sur le minotaure (avant 1 %), **1 %**
  dans un k hole (avant 2 %). Le butin du mineur (stat Butin, Pillage) multiplie toujours ces chances. Le wiki suit tout
  seul.
- **Décisions** (Geoffrey) ; choix de Claude à valider : la chance en k hole reste le double de la chance normale.
- **État** : ✅ en ligne le 27/10

## 26/10/2026 — Geoffrey — Tours : le retour des pods
- **Pour le joueur** : les **briques minées vont dans le sac** (10 pods chacune) ;
  sac plein, le mineur redescend le vider au **coffre commun**, au milieu de l'étage 0, puis repart. **Si le boss
  tombe**, toutes les briques (coffre + sacs) sont partagées **en parts égales** entre les joueurs présents ; un joueur
  qui part perd son sac. Le panneau de la tour montre le sac de chacun et le coffre.
- **Décisions** : coffre à l'étage 0 ; durée gardée à 10 min ; sacs comptés à la victoire ; parts égales (reste au hasard).
  Un 7e étage a été essayé puis **retiré** (trop dur : tout fer 0/20, tout acier 7/20) : la tour garde 6 étages.
- **À suivre** : en simulation (2 mineurs + 1 barbare, 20 tours), tout fer 10/20 → **4/20** victoires, tout acier
  17/20 → **16/20** (≈ 51 briques par joueur). Les vidages coûtent ≈ 1 min 15 de montée. Pas encore vérifié dans un
  vrai navigateur.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Lampe à incandescence : ses torches deviennent des lampes de mine
- **Pour le joueur** : un mineur qui porte la Lampe à incandescence n'accroche plus des torches mais des **lampes de
  mine** (une ampoule dans sa cage, suspendue à un câble), dans la mine comme dans les tours. Les torches des autres
  mineurs restent des torches.
- **État** : ✅ en ligne le 26/10


## 26/10/2026 — Geoffrey — « Who ? » : aussi les joueurs hors ligne des dernières 24 h
- **Pour le joueur** : le bouton « Who ? » des tours liste, après les joueurs en ligne, ceux qui sont **hors ligne** mais
  venus dans les **dernières 24 h** et qui n'ont pas fait la tour, avec « vu il y a 3 h ». Pas de bouton Inviter pour
  eux (ils ne sont pas là) : c'est pour savoir qui contacter.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Nouveau mob : le golem de sperme (area 5+)
- **Pour le joueur** : à partir de l'area 5, un golem de pierre qui sue un liquide blanc, **2 × 2 cases**, 300 PV (+15 %
  par area), deux fois plus lent qu'un gobelin (10 % des apparitions, pris sur le gobelin). Il **creuse jusqu'à ton
  mineur** (un bloc toutes les 2 s ; les blocs cassés sont perdus, même les minerais ; jamais les treasures, passerelles,
  murs de donjon ni échelles), en escalier pour monter. Ses coups repoussent de 0,5 toutes les 1,5 s, et chaque fois qu'il
  perd un tiers de ses PV il **ébranle la mine** : les mineurs à 3 cases sont étourdis 3 s (Ténacité). Butin : 1 à 3
  **Pierres glissantes**, 30 XP. Wiki à jour, avec en plus la **vitesse de chaque mob**.
- **Décisions** (Geoffrey) : 10 % pris sur le gobelin ; blocs perdus, il ne casse pas l'intouchable ; escalier ; 3
  étourdissements, Ténacité oui. **Choix de Claude à valider** : il monte tout droit une fois sous le mineur et
  s'agrippe à la roche (sinon il tournait en rond dans son propre escalier), il ne se fait pas repousser, pas de golem
  dans les pièges ni dans le k hole.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Gear score calculé avec les x mesurés
- **Pour le joueur** : le GS des pièces baisse un peu et colle mieux à ce qu'elles font vraiment gagner en session. Tout
  fer : 2 481 → 2 191 GS ; tout acier : 3 391 → 3 011. Les plus grosses baisses : Lance en fer 1 020 → 360, Pioche en
  acier 1 000 → 650, Gants tactique 100 → 39. La Lampe à incandescence compte enfin (81 GS, pour son rayon).
- **Décisions** : le GS suit la colonne « mesuré » du document « Valeurs en x » (secondes gagnées par session), plus
  six stats simulées le 26/10. Le tableau « pour 100 x » reste celui des runes. Les anneaux restent à 0 GS.
- **À suivre** : le plafond de la modulation (2 000 GS) n'a pas bougé ; à revoir quand la case sera ouverte.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Bloc géant : on peut le regarder pendant une session
- **Pour le joueur** : pendant une session, « Où miner » → 🌈 Bloc géant n'est plus grisé : on voit la carte (temps
  restant, scores, classement, récompenses à réclamer). Le bouton « Entrer » reste grisé (« Termine d'abord ta
  session ») ; le temps d'attente de 3 h et les autres activités bloquent toujours l'entrée, côté serveur aussi.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Skin de la Cape de Naingui
- **Pour le joueur** : la Cape de Naingui se voit sur le mineur (dans la mine, la mine instantanée, le lobby, la barre
  du haut et l'onglet Stuff) : une cape violet sombre qui flotte dans son dos jusqu'aux chevilles, avec un col et un
  fermoir doré sur l'épaule. Elle reste visible par-dessus une armure complète, et son aura (qualité) l'entoure.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Bloc géant : paliers de récompense relevés
- **Pour le joueur** : les paliers du score collectif passent à **1 000 / 5 000 / 10 000 / 15 000 / 20 000** (avant
  1 000 / 2 500 / 5 000 / 7 500 / 10 000), mêmes récompenses. Le Treasure T3 demande donc ≈ 90 à 140 visites dans la
  journée (≈ 150 à 220 points par visite). Wiki à jour.
- **État** : ✅ en ligne le 26/10 (mis en ligne sans relancer les tests, demande de Geoffrey)

## 26/10/2026 — Geoffrey — Bloc géant : chaque coup coûte 1 oxygène
- **Pour le joueur** : au Bloc géant, chaque coup sur le bloc coûte **1 oxygène** en plus de la baisse habituelle
  (2 par seconde). Sans stuff ou avec une pioche en fer / acier, ça ne change presque rien (toujours une recharge
  par visite, mêmes points) ; un mineur très rapide (vitesse 2) va boire deux fois et fait ≈ 262 points au lieu de 277.
  Wiki à jour.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Glyphe Treuil : ascenseur 1,5 fois plus rapide (avant 3)
- **Pour le joueur** : l'ascenseur du Glyphe Treuil monte et descend **1,5 fois** plus vite que le treuil (avant 3 fois),
  toujours posé une nouvelle area sur deux, et pareil dans les tours. Le wiki suit tout seul (texte lu dans la config).
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Butin rare des mobs : 4 nouvelles pièces
- **Pour le joueur** : quatre pièces qu'on ne peut pas fabriquer, lâchées par les mobs. Chacune vaut autant que la pièce
  en fer de sa case, avec d'autres stats :
  - **Lanières en cuir du gobelin** (torse, inhabituel) : vitesse d'attaque +44 %, butin des mobs +22 %. Gobelin : 0,5 %.
  - **Capuche sombre** (casque, rare) : recul +0,13, critique +9,7 %. Occultiste : 0,5 %.
  - **Nuage magique** (jambes, rare) : vitesse de marche +1,1. Méphite : 0,5 %.
  - **Ceinture du Géant** (ceinture, épique) : dégâts +3,1, ténacité +25 %. Minotaure : 1 % (2 % dans un k hole).
  Chacune a son apparence sur le mineur, se recycle en matériaux (ex. Ceinture : 50 chitine + 5 Steel ingot), et
  apparaît dans le wiki (Mobs → Butin rare).
- **Décisions** (Geoffrey) : ceinture à 250 x (pas de ceinture en fer) ; Nuage et Ceinture calés sur les nouveaux prix
  mesurés du gear score, Lanières et Capuche gardées (sinon vitesse d'attaque +135 % et recul +1,1 bloc) ; deux stats moitié / moitié ; en groupe, un seul
  joueur reçoit la pièce ; le **Butin des mobs** multiplie la chance (1 % avec +50 % de butin → 1,5 %), toujours une
  seule pièce.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Modulation cachée (pas encore prête)
- **Pour le joueur** : la case « Modulation » n'apparaît plus au lancement d'une tour (elle ne donnait encore aucune
  récompense). Le **gear score reste affiché** : GS de chaque pièce, GS total dans l'onglet Stuff, GS de chaque joueur
  dans le lobby, quel que soit le mode.
- **Décision** (Geoffrey) : la modulation revient quand ses récompenses sont décidées. En mode développeur, la case reste
  là pour tester.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Admin : retirer un objet à un joueur
- **Pour le joueur** : rien. Nouvel outil sur le serveur : `take-item.js` retire un objet à un joueur sans redémarrer
  le jeu (l'inverse de `give-item.js`). Un glyphe posé sur un skill est retiré de sa case.
- **À suivre** : retirer les glyphes en trop (Infernatiwar : Braum, LeTaz : Échelle de 2, Nbrick : Ruée).
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Gear score et modulation des tours (en test)
- **Pour le joueur** : chaque pièce de stuff affiche son **GS** (gear score) dans sa bulle et dans la liste de l'onglet
  Stuff, et l'onglet Stuff affiche le **GS total** en haut des stats. Le GS d'une pièce, c'est ce qu'elle ajoute aux
  stats de base, en x (stats de l'objet, identification, rune, amélioration). Dans le lobby, chaque joueur montre son GS.
  En lançant une tour, une case **« Modulation »** : cochée, chaque joueur doit avoir **moins de 2000 GS**, sinon le
  lancement est refusé et le jeu dit qui dépasse, et de combien. Repères : stuff complet T1 ≈ 1 350 GS, tout en fer
  ≈ 2 480, tout en acier ≈ 3 390.
- **Décisions** (Geoffrey) : GS = stats (x) − stats de base (x) ; pièce = stats + rune + amélioration ; test à 2000 GS.
  Choix de Claude à valider : skills, sorts, glyphes et anneaux ne comptent pas ; torches, lumière et boussole non plus
  (pas de prix en x) ; la Lance en fer vaut ≈ 1 020 GS (portée et recul sont chers en x, prix provisoires du 25/10).
- **À suivre** : **les meilleures récompenses de la modulation ne sont pas faites** (à décider) ; wiki pas encore mis à jour.
- **État** : ✅ en ligne le 26/10 (en test : la case est visible des joueurs, sans récompense en plus)

## 26/10/2026 — Geoffrey — Tableau de bord des joueurs (équipe)
- **Pour le joueur** : rien de visible. Pour l'équipe : une page de courbes sur tous les joueurs (mine classique) :
  Mineur = blocs récupérés par niveau ; Logisticien = profondeur par niveau ; Barbare = blocs et temps à frapper les
  mobs par niveau ; tous = profondeur par niveau et par **ilvl** ; groupe = profondeur par **ilvl du groupe** (moyenne des joueurs
  présents, une fois par session), prolongée par une **prédiction** jusqu'à 350 de profondeur (droite de tendance,
  avec l'ilvl de groupe estimé pour y arriver) ; plus l'historique, avec un filtre par joueur.
- **Décisions** (Geoffrey) : réservé à l'équipe ; mine classique seule (pas les tours, la MI ni le mode dev ; un joueur
  parti avant la fin ne compte pas) ; barbare = temps passé à **frapper** (pas le tacle ni la marche vers le mob).
  **ilvl** = somme des valeurs en x des pièces portées au lancement (qualité, amélioration et rune non comptées).
- **Comment l'ouvrir** : sur ton ordinateur, `ssh VPS "sudo node /opt/deep-idle-mine/scripts/dashboard.js" >
  tableau-de-bord.html`, puis ouvre le fichier.
- **À suivre** : les courbes partent de zéro à la mise en ligne (les anciennes sessions n'ont ni niveau ni ilvl) ; ces
  lignes sont gardées sans limite (les sessions, elles, 30 jours).
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Tours : bouton « Who ? » pour trouver des alliés
- **Pour le joueur** : dans le Lobby, une tour ouverte choisie dans « Où miner », un bouton **Who ?** à côté de sa
  description. Il liste les joueurs **en ligne** qui n'ont **pas encore fait cette tour** pendant cette ouverture (toi
  exclu), avec ce qu'ils font (en ligne, dans un lobby, en session et le temps qui leur reste) et « ami » si c'en est un.
  Bouton **Inviter** (par leur ID, ami ou non) pour ceux qui ne sont pas en session ni déjà dans ton groupe. Un second
  clic sur Who ? ferme la liste. Wiki à jour.
- **Décisions** : choix de Claude à valider : seulement les joueurs en ligne (ou en session), pas tous les comptes.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Correction : Bloc géant, fin de visite affichée trop tôt
- **Pour le joueur** : après un redémarrage du serveur pendant une visite, l'écran « Visite terminée » pouvait
  s'afficher trop tôt avec les points du moment (91), alors que la visite continuait et comptait tous ses points
  (248). Maintenant la visite reste à l'écran jusqu'au bout, et l'écran de fin montre les points comptés par le serveur.
  Aucun point n'était perdu. Même chose si l'onglet du jeu passait en arrière-plan pendant la visite (le navigateur
  ralentit alors les relevés) : l'écran de fin lit maintenant toujours les points du serveur.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Bloc géant
- **Pour le joueur** : nouveau mode dans « Où miner » : le **Bloc géant**. Une session commune à tout le serveur, de
  minuit à minuit. On y entre seul, une fois toutes les 3 h, pour 3 min de jeu : son mineur frappe un énorme bloc
  multicolore avec les autres joueurs présents. Chaque seconde rapporte sa vitesse de minage en points ; chaque coup
  peut le repousser ; il va boire à la fontaine quand l'oxygène manque. À minuit, chaque joueur venu reçoit des
  Treasures (T1 à T3) et des Blueprint parts selon le score de tous, à réclamer sur la carte du Bloc géant.
- **Décisions** : paliers cumulés ; seul le Mineur a une vraie plus-value ; fontaine 30/s ; une visite à cheval sur
  minuit compte pour la session qui se ferme. Choix de Claude à valider : 30 mineurs au plus, la fontaine ne recharge
  que le mineur qui s'y arrête (sinon la résistance au recul faisait perdre des points), quitter garde les points mais
  consomme l'entrée, la torche posée au sol. Salle de 15 × 7 (Geoffrey, avant 10 × 7) : plus de chemin entre le
  départ, la fontaine et le bloc.
- **À suivre** : les paliers (≈ 150 à 230 points par visite : il faut ≈ 50 à 65 visites pour le Treasure T3).
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Steel ingot : 5 Graphite ingot au lieu de 10
- **Pour le joueur** : un Steel ingot demande **3 Tainted iron + 5 Graphite ingot** (avant 10), toujours 50 charbons et
  3 min. Les pièces en acier coûtent donc deux fois moins de graphite.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Amélioration jusqu'à +9
- **Pour le joueur** : on peut améliorer une pièce jusqu'à **+9** (avant +3). Chaque rang donne +3 % de toutes les
  stats (+27 % au +9) ; la réussite baisse de 5 % par rang (100 % au +1, 60 % au +9). Les premiers rangs coûtent
  beaucoup moins de plumes (6 au lieu de 20 pour le +1).
- **Décisions** : coût 3 cristaux / 6 plumes au +1, puis ×1,5 (+2, +3), ×1,33 (+4 à +6), ×1,25 (+7 à +9), arrondi au
  dessus : 129 cristaux et 256 plumes pour un +9. Le bonus passe de 5 / 10 / 15 % à 3 / 6 / 9 % pour +1 à +3 : les
  pièces déjà améliorées perdent un peu.
- **À suivre** : les cristaux (minotaure) risquent d'être le vrai frein à partir de +6.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Lampe à incandescence par blueprint, recherche tier 3 à 200 parts
- **Pour le joueur** : la **Lampe à incandescence** ne se fabrique plus de base : il faut d'abord trouver son
  **blueprint** dans un **Treasure T2** (2 %, comme les autres plans du T2) ou l'obtenir à la **table de recherche
  (tier 2)**. La recherche d'un blueprint du **tier 3** coûte **200 parts** (avant 150).
- **Décisions** : la lampe devient la 4e recette du tier 2 : il faut l'apprendre aussi pour ouvrir la recherche tier 3.
  Les lampes déjà fabriquées sont gardées.
- **À suivre** : la lampe n'a pas de tier de rune (valeur propre) ; la passer en T2 (250 x) comme les autres plans du T2 ?
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Joueur absent mais prêt : le chef peut toujours le lancer
- **Pour le joueur** : un membre qui ferme l'onglet du jeu est toujours affiché « absent », mais s'il était **prêt** ou
  **prêt tout le temps**, il n'est plus sorti du groupe au bout de 5 min : le chef peut lancer la session avec lui.
  Avant, au bout de 5 min, il disparaissait du groupe et le chef ne pouvait plus le lancer.
- **Décisions** : un simple « prêt » redevient « pas prêt » après la session (comme avant), donc il finit retiré s'il
  ne revient pas ; un « prêt tout le temps » reste jusqu'à ce que le chef le retire. Le chef absent est toujours
  retiré (sinon le groupe serait bloqué).
- **À suivre** : rien.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Correction : Online oubliait les joueurs en session
- **Pour le joueur** : la liste Online compte maintenant tous les joueurs en session, même s'ils ont fermé le jeu
  (avant, on pouvait voir plus d'amis en ligne que de joueurs dans Online).
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Social : sous-onglets Amis et Online
- **Pour le joueur** : l'onglet Social a deux sous-onglets. **Amis** : comme avant. **Online** : le nombre de joueurs
  en ligne et la liste de tous les joueurs connectés (amis ou non) ; ceux qui ne font rien en haut, ceux en session
  en dessous (avec le temps qu'il leur reste). Bouton **Ajouter** pour demander un joueur en ami.
- **Décisions** : on se voit soi-même dans la liste (« toi ») ; le bouton Ajouter est un ajout de Claude, à valider.
- **À suivre** : rien.
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Glyphes : 3 % de trouver un glyphe par session (correction)
- **Pour le joueur** : **≈ 3 % de chance de trouver un glyphe par session** (groupe de 3), peu importe lequel ; il est
  tiré au hasard parmi ceux qui manquent. La chance ne dépend plus du nombre de glyphes déjà trouvés.
- **Décisions** (Geoffrey) : 3 % pour « un glyphe », pas par glyphe (la version de 9 h, 3 % par glyphe, était un
  malentendu : ≈ 9 à 11 % d'en trouver un). Mêmes chances par événement : 0,00383 % par bloc, 0,0335 % par échelle,
  0,101 % par mob.
- **À suivre** : compléter un arbre de 3 glyphes ≈ 100 sessions en moyenne (4 : ≈ 130).
- **État** : ✅ en ligne le 26/10

## 26/10/2026 — Geoffrey — Glyphes : chaque glyphe à 3 % par session (ancien, remplacé à 9 h 15)
- **Pour le joueur** : chaque glyphe qui manque a maintenant **≈ 3 % de chance par session** (groupe de 3), quelle que
  soit la spécialisation et le nombre de glyphes déjà trouvés. Tant qu'on n'en a aucun : ≈ 8,7 % d'en trouver un
  (Mineur, Barbare) ou ≈ 11,5 % (Logisticien). Avant : ≈ 7,6 % (Mineur), 6,2 % (Logisticien), 2,9 % (Barbare) pour
  « un glyphe », et chaque glyphe devenait plus facile à mesure qu'on complétait l'arbre.
- **Décisions** (Geoffrey) : la chance est **par glyphe manquant**, 3 % par glyphe (essayé à 1 % juste avant, pas mis
  en ligne). Par événement : 0,00383 % par bloc (Mineur), 0,0335 % par échelle (Logisticien), 0,101 % par mob (Barbare).
- **À suivre** : un glyphe donné ≈ 1 session sur 33 ; compléter un arbre de 3 ≈ 60 sessions en moyenne (4 : ≈ 70).
- **État** : ✅ en ligne le 26/10

## 25/10/2026 — Geoffrey — Recherche : le tier 3 demande tout le T1 et tout le T2
- **Pour le joueur** : la recherche du tier 3 reste fermée tant qu'il manque une recette du tier 1 **ou** du tier 2.
  Avant, seul le tier 2 comptait : en apprenant des BP du T2 trouvés dans des Treasures, on ouvrait le T3 avec un T1
  incomplet. L'onglet Recherche dit ce qui manque, tier par tier (« apprends encore 2 recettes du Tier 1 »).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Correctif : l'arène du k hole (mineurs qui ne tapent pas)
- **Pour le joueur** : dans l'Arène des minotaures (et les Vagues), un mineur loin du combat restait planté au milieu
  sans taper : il ne voyait pas le minotaure, dans le noir. Maintenant, dans ces salles, les mineurs voient toute la salle
  et vont aider (sauf s'ils sont réglés sur « Ignorer » ou « Fuir »), et les trois salles (arène, trésor, vagues) sont
  éclairées dès l'arrivée (une torche toutes les 5 cases).
- **Chiffres** (3 mineurs, 3 seeds) : arène finie en 108 s, 2 minotaures tués (avant : 117 s) ; vagues : 66 mobs tués
  (avant : 41 à 63).
## 25/10/2026 — Geoffrey — On trouve des glyphes en minant
- **Pour le joueur** : dans la mine, ton mineur peut trouver un glyphe de sa spécialisation, parmi ceux que tu n'as
  pas encore : spé Mineur 0,01 % par bloc cassé, spé Logisticien 0,07 % par échelle posée, spé Barbare 0,1 % par mob
  tué. Il est à toi seul, annoncé dans le journal de la partie, et arrive dans ton inventaire à la fin de la session
  (perdu si tu quittes avant). En moyenne : environ 8 % de chance par session pour un mineur, 6 % pour un
  logisticien, 3 % pour un barbare.
- **Décisions** (Geoffrey) : 0,07 % par échelle posée ; « pas débloqué » = pas possédé ; mine classique ; pour lui seul.
- **À suivre** : le barbare en trouve 2 à 3 fois moins que le mineur (taux à revoir si besoin, `GLYPHS.drop`).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Commande d'admin : ouvrir un k hole chez un joueur
- **Pour le joueur** : rien de nouveau, sauf si un créateur du jeu le décide : un k hole peut s'ouvrir dans sa mine.
- **Pour l'équipe** : sur le VPS, `sudo node /opt/deep-idle-mine/scripts/force-khole.js --name PSEUDO --map 2` ouvre un
  k hole dans la session en cours de ce joueur (mine classique) : « Un k hole s'ouvre… », puis le groupe est aspiré 3 s
  plus tard. `--map` : 0 au hasard, 1 Filons, 2 Arène, 3 Salle au trésor, 4 Vagues. Enregistré dans la session : un
  redémarrage du serveur rejoue la partie à l'identique.
- **État** : ✅ en ligne le 25/10


## 25/10/2026 — Geoffrey — K hole : le portail vers une autre dimension (4 cartes)
- **Pour le joueur** : rarement (2 % par area), un trou noir est enfoui dans la mine. Dès qu'un mineur le voit, il
  s'ouvre, et 3 s plus tard tout le groupe est aspiré dans une autre dimension, une carte tirée au hasard parmi 4 :
  **Filons** (petite mine très riche, 5 min), **Arène des minotaures** (2 minotaures à tuer, 2 min), **Salle au trésor**
  (2 treasures de tier au hasard, 2 min) et **Vagues** (vagues de 5 mobs, 3 min). Pas besoin d'oxygène, pas de limite de
  pods, on ne remonte pas ; à la fin (ou quand l'arène / la salle au trésor est finie), tout le groupe revient à la
  surface de la mine avec son butin. Voile violet et compte à rebours (avec le nom de la carte) à l'écran.
- **Décisions** : la durée compte dans l'heure de session ; tout le groupe part ; déclenchement à la découverte, sans
  réglage ; même contenu quelle que soit l'area (jackpot assumé, c'est rare) ; à 30 s de la fin de session, retour à la
  surface pour tout déposer.
- **Chiffres** (3 mineurs, k hole en area 0) : Filons ≈ 45-50 fers, 30-47 ors, 2 à 10 diamants ; Arène : minotaures tués
  en 117 s (sur 120), 4 à 6 cristaux ; Salle au trésor : finie en 3 s ; Vagues : 11 à 13 vagues, 54 à 63 mobs. 5 sessions
  simulées, k hole à chaque area : 0 blocage. Un tick dans la dimension coûte 0,03 à 0,2 ms contre 0,55 ms dans la mine.
- **Choix de Claude à valider** : le minotaure de l'arène laisse 1 à 3 Cristaux de pleine lune (comme au donjon) ; les 4
  cartes ont la même chance (poids modifiables).
- **À suivre** : nom affiché ; mode dev : « Carte de k hole » (0 = au hasard, 1 à 4) pour tester chaque carte.
- **État** : ✅ en ligne le 25/10 (2 % par area)
## 25/10/2026 — Geoffrey — Nouvelle case Torche et Lampe à incandescence
- **Pour le joueur** : une 13e case dans l'onglet Stuff, **Torche**. Premier objet : la **Lampe à incandescence**,
  fabricable sans blueprint (200 vésicules de gaz, 2 000 charbon, 20 fragments de cœur) : +10 torches, ses torches
  éclairent à 8 cases au lieu de 5, et il les pose deux fois plus vite. Chaque torche garde le rayon de celui qui l'a
  posée. Deux nouvelles stats dans l'onglet Stuff : Rayon des torches et Pose d'une torche. Wiki à jour (tableaux).
- **Décisions** (Geoffrey) : l'objet, sa recette et ses effets ; rareté **rare**.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Glyphe Treuil : l'ascenseur
- **Pour le joueur** : 10ᵉ glyphe. Posé sur le skill Treuil (au max), le logisticien construit un **ascenseur** au lieu
  du treuil : 3 fois plus rapide (Escalateur compris), avec rails, machinerie et cabine. Il ne le pose ou ne le
  prolonge qu'une nouvelle area sur deux (1re, 3e, 5e…), donc il s'interrompt deux fois moins pour creuser. Dans les
  tours aussi. En simulation, une équipe mixte descend d'une area de plus (3,2 → 4,0) et rapporte 9 % de plus.
- **Décisions** (Geoffrey) : 1er, 3e, 5e déblocages ; Escalateur compris ; son porteur construit en priorité ; Mule
  inchangée ; aussi dans les tours ; nouvelles textures.
- **À suivre** : c'est un glyphe fort (une area de plus) : à surveiller quand les glyphes auront une source en jeu.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Glyphes (étape 1 : 9 glyphes)
- **Pour le joueur** : nouvel objet, le **glyphe** : un parchemin lié à un skill. Dans l'onglet Skills, une petite case
  sous chaque skill permet d'y poser son glyphe quand le skill est au rang max ; il ajoute un effet (Pioche aiguisée,
  Second souffle, Ruée, Navette, Échelle de 2, Mule, Force brute, Pillage, Braum). On le retire quand on veut hors
  session, il revient dans l'inventaire ; un reset ou un set ne le retire pas (il devient inactif). Le wiki a une
  section « Les glyphes ». Pas encore obtenable en jeu (on les donne avec l'outil d'admin).
- **Décisions** (Geoffrey) : skill au rang max ; un glyphe par skill ; retirable sans perte ; Braum à chaque entrée ;
  Pillage plafonné à +25 % ; Force brute sur les dégâts totaux ; Glyphe Treuil (ascenseur) à part, étape 2.
- **À suivre** : la source des glyphes en jeu ; le Glyphe Treuil.
- **État** : ✅ en ligne le 25/10


## 25/10/2026 — Geoffrey — Runes : 5 stats de plus, Découverte, Double attaque
- **Pour le joueur** : une rune peut maintenant tomber sur **ténacité, résistance au recul, portée d'attaque, recul** et la
  nouvelle **double attaque** (chance qu'un coup frappe deux fois). Sur une rune R6 ou R7, la Découverte est aussi
  probable que n'importe quelle autre stat (avant : 25 % de chance par ligne, bien plus fréquente).
- **Décisions** (Geoffrey) : les 5 stats dans la banque ; Découverte au même rang que les autres ; double attaque.
  Choix de Claude à valider : leur valeur pour 100 x (ténacité +10 %, résistance au recul +20 %, portée +0,1, recul
  +0,1) ; double attaque +5 % pour 100 x (Geoffrey).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Inventaire : « Ouvrir tout »
- **Pour le joueur** : quand on a plusieurs treasures du même type (ou plusieurs trésors de tour identiques), un bouton
  **Ouvrir tout (N)** apparaît à côté de « Ouvrir ». Il les ouvre tous d'un coup (100 au plus par clic), chacun avec son
  propre tirage, et la fenêtre montre tout le butin additionné.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Amélioration : +5 / +10 / +15 %
- **Pour le joueur** : améliorer une pièce rapporte plus : +1 = **+5 %** de toutes ses stats (avant +3 %), +2 = **+10 %**
  (avant +5 %), +3 = **+15 %** (avant +7 %). Coûts et chances de réussite inchangés. Les pièces déjà améliorées en
  profitent tout de suite.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Armure en fer : 20 peaux de gobelin
- **Pour le joueur** : casque, plastron, jambes et bottes en fer demandent **20 peaux de gobelin** chacun en plus de
  leurs Tainted iron (les bottes : 20 au lieu de 5, toujours avec leur lingot d'or). L'armure complète coûte donc 80
  peaux. Recycler des bottes en fer rend 12 peaux (avant 3).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Tour : plus étourdi en tombant, projection du boss à 4 cases
- **Pour le joueur** : un mineur projeté hors de la tour tombe jusqu'en bas mais n'est plus étourdi : il remonte tout
  de suite. Le boss projette de 4 cases au lieu de 5. Wiki à jour.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Tour : les mobs reculent deux fois plus, sans temps sonné
- **Pour le joueur** : un Séraphin ou un Diablotin frappé recule de 0,5 bloc (avant 0,25) et revient aussitôt au
  contact : plus de pause de 0,5 s après un recul.
- **Décisions** (Geoffrey) : résistance au recul des mobs de la tour à −100 % ; temps sonné retiré. Mis en ligne sans
  relancer les tests (demande de Geoffrey).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Tour : étages de blocs sans retour en arrière, recul des mobs visible, mesures ?perf
- **Pour le joueur** : dans un étage de briques, les mineurs avancent maintenant depuis l'entrée, colonne par colonne :
  ils ne laissent plus les briques du haut au-dessus de l'entrée pour revenir les chercher à la fin. Un Séraphin ou un
  Diablotin repoussé reste un instant sur place (0,5 s) : le recul se voit enfin.
- **Outil** : en ouvrant le jeu avec `?perf` (https://deepmineidle.fr/?perf), la barre du haut affiche les images par
  seconde, le délai entre deux envois du serveur, le temps de réponse et les ticks par envoi (pour comprendre la
  fluidité en ligne). Invisible sans `?perf`.
- **À suivre** : regarder les mesures `?perf` en ligne pendant une tour. Boss qui ne saute pas : il descend rarement
  sous 75 % avec l'équilibrage actuel (à confirmer). Treuil « sans texture » : pas reproduit (dessiné dans le test),
  capture attendue.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Annonces Discord des R7
- **Pour le joueur** : quand quelqu'un loot un trésor de tour R7 ou identifie une pièce R7, un message part dans le
  salon #général du Discord : « 🚨 Zoe a loot un trésor démoniaque R7 🚨 », « 🚨 Zoe a identifié Plastron en fer R7 🚨 ».
- **Décisions** : pseudo visible en jeu ; nom de la pièce dans le message ; seuil R7 réglable dans la config ; un objet
  donné par l'admin n'est jamais annoncé ; personne n'est mentionné (un « @everyone » dans un pseudo ne sonne pas).
- **À suivre** : avant la mise en ligne, créer le webhook dans Discord et mettre son adresse dans les réglages du
  serveur OVH (`DIM_DISCORD_WEBHOOK`, voir `docs/deploiement-ovh.md`). Sans ça, rien ne casse, mais rien n'est annoncé.
- **État** : ✅ en ligne le 25/10 (webhook vérifié sur le VPS : message de test reçu)

## 25/10/2026 — Geoffrey — Tours : le nouveau combat aussi
- **Pour le joueur** : dans les tours, les Séraphins et les Diablotins avancent en glissant, le coup du mineur part tout
  de suite, il s'arrête net pour frapper le premier, et un coup qui repousse assez un mob lui fait lâcher son tacle
  (jamais en boucle). La Lance en fer marche aussi dans les tours. Le boss ne change pas.
- **Chiffres** (20 tours par équipe) : les étages se vident plus vite, le toit est atteint 25 à 45 s plus tôt (3 mineurs
  de base 9:30 → 8:46 ; barbares 7:30 → 7:05) ; PV du boss restants 1 327 → 1 113 (2 barbares). Toujours 0 victoire sur
  ces équipes de test (déjà le cas avant). Aucun blocage.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Moins de Treasure T1, recyclage des plans T1 réduit
- **Pour le joueur** : un treasure a maintenant 50 % de chance d'être enfoui dans les areas 0 à 2 (avant 60 %), et
  recycler un blueprint du tier 1 rend 15 à 30 Blueprint parts (avant 30 à 60). Les tiers 2 et 3 ne changent pas.
- **Décisions** (Geoffrey) : valeurs d'équilibrage, ajustables.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Combat : mouvement continu, le recul casse le tacle, Lance en fer
- **Pour le joueur** : les mobs avancent en continu (plus de saut de case en case). Le coup du mineur part tout de
  suite, et il s'arrête net pour frapper un mob qui entre dans sa portée. Un coup qui repousse un mob au-delà d'un
  demi-bloc lui fait **lâcher son tacle** ; repoussé une fois, il ne peut plus l'être avant d'être revenu : impossible
  de le tenir à distance pour toujours, même avec beaucoup de vitesse d'attaque. Nouvelle arme **Lance en fer** (BP 2 %
  dans le Treasure T1, 10 Tainted iron) : dégâts +8, vitesse d'attaque −10 %, recul +0,5, portée +0,25. Elle tue moins
  vite que l'épée mais fait lâcher les tacles.
- **Décisions** (Geoffrey) : règle C (le recul casse le tacle) ; la lance tue moins vite mais subit moins. Choix de
  Claude : le verrou anti-boucle ; recette et rareté comme l'épée en fer (provisoire).
- **Chiffres** : en duel contre 4 mobs, la lance tue 16 % moins vite et fait passer 36 % de temps en moins taclé, sans
  vol du gobelin. En sessions (3 mineurs en fer) : 4 % de mobs tués en moins, 19 % de vols en moins, temps taclé égal.
  Toute la mine (20 sessions) : coffre stable, moins de tacles, aucun blocage.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Lance en fer (première version, remplacée par l'entrée ci-dessus)
- **Pour le joueur** : nouvel objet **Lance en fer** (case épée), BP à 2 % dans le Treasure T1, recette provisoire
  10 Tainted iron (comme l'épée). Dégâts +10, vitesse d'attaque −10 %, recul +0,25, portée d'attaque +0,25. Deux
  nouvelles stats : **Portée d'attaque** et **Recul**.
- **À décider** : avec les règles de combat actuelles, la lance ne remplit pas son but (le mob tacle toujours en
  premier et garde son tacle même repoussé) : en duel, elle tue moins vite que l'épée et ne réduit ni le tacle ni les
  vols. Voir les chiffres dans `docs/debug.md`.
- **Mouvement continu** (25/10, même branche) : les mobs avancent en glissant sur leur ligne (ils sont vraiment entre
  deux cases) et la portée d'un mineur suit son pas. En simulation, l'économie ne bouge pas, mais on se fait un peu plus
  tacler (les mobs attrapent dès 0,5 bloc en arrivant). Avec ça seul, la lance vaut l'épée, sans faire mieux.
- **À décider** : pour que la portée et le recul protègent vraiment, il faut aussi changer le coup du mineur (il part
  tout de suite, et le mineur s'arrête net pour frapper un mob qui entre dans sa portée), et peut-être que le recul
  casse le tacle. Prototypes mesurés, pas gardés : chiffres dans `docs/debug.md`.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Tours : on remonte au sommet ensemble
- **Pour le joueur** : dans les tours, un mineur tombé qui remonte et trouve le toit vide attend les autres juste
  avant le toit (sous la porte, ou dans le seau du treuil). Quand tout le groupe est là, ils montent ensemble. Si
  quelqu'un se bat déjà sur le toit, il y va directement. Il n'attend jamais plus de 45 s.
- **Décisions** (Geoffrey) : on attend tous les mineurs encore dans la tour ; limite de 45 s (ajustable).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Tours : le logisticien installe un treuil
- **Pour le joueur** : dans les tours de l'Ange et du Démon, la première fois qu'un logisticien qui a le skill Treuil
  est projeté hors de la tour, il installe au pied du mur (10 s) un treuil qui monte jusqu'au toit. Ensuite, tous ceux
  qui tombent le prennent : environ 18 s pour revenir au combat au lieu de 28 à 43 s.
- **Décisions** (Geoffrey) : il faut le skill Treuil ; un seul treuil par partie, du côté de sa chute ; même vitesse et
  mêmes règles que le treuil de la mine.
- **À suivre** : le toit est atteint vers 8 min, donc le treuil arrive tard (7 min 30 à 9 min 40) et ne change pas
  encore l'issue des tours simulées (0 victoire sur 5 avec ou sans, boss à ≈ 1 650 PV au lieu de ≈ 1 820).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Runes : un % du tier de la pièce
- **Pour le joueur** : une ligne de rune ne vaut plus un % de la valeur de la pièce, mais un % de son **tier** : T1
  (pierre, chitine, ceinture en peau de gobelin, boussole en or) = 100 x, T2 (fer, gants, cape) = 250 x, T3 (acier,
  Plastron de l'équilibre) = 400 x. Toutes les pièces d'un même tier donnent la même chose pour une même rune. Les
  runes déjà posées (et les lignes des pièces identifiées avant le 22/10) passent tout de suite à cette règle. Les
  runes sur le stuff en fer et en acier valent moins qu'avant, celles sur les gants et la cape plus.
- **Décisions** (Geoffrey) : le fer est T2 même si ses plans tombent dans le Treasure T1 ; le Plastron de l'équilibre
  est T3 ; les anciennes lignes d'identification suivent la même règle.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Casque, jambes et bottes en acier renforcés
- **Pour le joueur** : le casque en acier donne +100 d'oxygène (avant +69), les jambes +1,6 de montée (avant +1,08) et
  les bottes +1,67 de marche (avant +1,08). Avant, ils valaient à peine 3 % de plus que le fer ; maintenant environ
  50 % de plus. Les pièces déjà fabriquées en profitent tout de suite, et les runes posées dessus grandissent aussi.
- **Nerf des pioches** : pioche en fer +0,4 de vitesse de minage (avant +0,5), pioche en acier +0,5 (avant +0,6).
- **Décisions** (Geoffrey) : ces trois pièces valent environ 400 x chacune (valeur d'équilibrage, ajustable) ; pioches nerfées.
- **État** : ✅ en ligne le 25/10


## 25/10/2026 — Geoffrey — Piège : le barbare vient vraiment aider
- **Pour le joueur** : quand un allié déclenche un piège, le barbare vient tuer les mobs jusqu'au bout. Avant, s'il
  était juste au-dessus de la salle ou devait creuser pour y arriver, il « oubliait » les mobs au bout de quelques
  secondes et retournait miner.


## 25/10/2026 — Geoffrey — Donjon : on reste même sans oxygène, la salle se révèle au seuil
- **Pour le joueur** : quand un donjon est découvert, le barbare y va même s'il n'a plus d'oxygène, et les autres
  attendent, le rejoignent et se battent sans remonter, même sans oxygène, le sac plein ou sans torches. Seule la fin
  de session les fait remonter. Le boss mort, ils remontent. Corrigé : quand le minotaure est collé contre l'entrée,
  on se battait sur le seuil et la salle restait noire ; elle apparaît maintenant dès qu'un mineur passe l'entrée ou
  frappe le boss.
- **Décisions** (Geoffrey) : seule la fin de session passe avant le donjon ; sortir du donjon (effrayé) et les « Fuir »
  une fois le barbare entré remontent normalement ; un mineur déjà en train de remonter finit sa remontée.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Tour céleste : boss refait, étages de blocs à vider, affichage fluide
- **Pour le joueur** : la tour s'affiche **sans saccades**. Elle a **6 étages** (avant 7) et les briques se cassent en
  4 s. Un **étage de briques** doit être **entièrement vidé** pour ouvrir la porte du dessus (les mineurs se répartissent
  les briques). Les mobs peuvent être plusieurs sur la même case. Le **boss** vise un seul mineur (le premier arrivé, ou
  le barbare qui le provoque) et ignore les autres ; il le repousse (petit saut à l'écran) ou le projette de 5 cases
  (25 %, 10 % sur un barbare, plus en rage), puis le **suit** en traversant les autres mineurs. On peut le frapper à côté
  de lui ou dans lui ; seul le mineur qu'il vise le fait reculer un peu. À 75, 50 et 25 % de ses PV, il **s'envole** 3 s
  au centre du toit (intouchable), puis retombe : tout le monde est repoussé de 3 cases et étourdi 3 s. Le wiki est à jour.
- **Mode développeur** : spécialisation imposée à chaque mineur (mineurs de test compris) avec un niveau, mineurs de test
  dans les tours, vitesse et pause dans la barre de la tour, tours toujours ouvertes et sans limite.
- **Décisions** (Geoffrey) : toutes les valeurs ci-dessus ; règle « le boss remet hors de lui les mineurs sur sa hitbox »
  essayée puis retirée.
- **À suivre** : l'**équilibrage** de la tour (Geoffrey fait ses simulations). La stat Résistance au recul n'a toujours
  aucune source.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Tainted iron : 15 chitine au lieu de 20
- **Pour le joueur** : l'alliage Tainted iron demande **15 chitine** (avant 20), toujours avec 5 lingots de fer,
  50 charbons et 3 min. Toutes les pièces en fer coûtent donc un quart de chitine en moins.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Groupe : donner le lead même en session
- **Pour le joueur** : le chef peut donner sa place de chef (★) même pendant une session. Retirer un membre (×) reste
  impossible pendant une session.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Régler une jauge Ange / Démon à la main
- **Pour le joueur** : rien de nouveau en jeu. Les créateurs peuvent maintenant régler une jauge du Jugement depuis le
  serveur, sans le redémarrer : `sudo node /opt/deep-idle-mine/scripts/set-judgment.js --side demon --count 175`.
- **Décisions** : confirmé, une jauge en pause garde sa valeur : à 100 quand la tour de l'Ange s'ouvre, celle du Démon
  est toujours à 100 à la fermeture, et vice versa. C'était déjà le cas, c'est maintenant testé noir sur blanc. Si une
  jauge revient à 0, c'est que sa tour s'est ouverte.
- **À suivre** : une fois en ligne, mettre la jauge du Démon à 175 / 200 (demande de Geoffrey).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Aura aussi sur la pioche et l'épée
- **Pour le joueur** : une pioche ou une épée R4+ runée R4+ a aussi son aura, quand le mineur s'en sert en session (la
  pioche quand il mine, l'épée quand il frappe). La pioche en bois de base n'en a jamais. Les portraits ne montrent
  pas les outils, donc pas d'aura d'outil dessus.

## 25/10/2026 — Geoffrey — Dash : il suit le terrain, vise juste, étourdit
- **Pour le joueur** : le Dash du barbare n'est plus une ligne droite : il descend, et saute un bloc qui lui barre la
  route. Quand le barbare va combattre ou aider un allié, il garde son Dash jusqu'à ce que le mob soit à 6 cases ou moins,
  puis fonce dessus ; un mob qui tacle un allié passe en priorité. Le mob touché perd son sort en cours (l'occultiste
  arrête sa canalisation) et il est étourdi 2 s, boss compris.
- **Décisions** (Geoffrey) : étourdissement 2 s ; priorité au mob qui tacle un allié à 6 cases ou moins. Choix de Claude
  à valider : en simple trajet, il ne descend qu'une marche (pas de chute), pour ne pas quitter le chemin de l'IA ;
  l'étourdissement vaut aussi pour les boss.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Donjon : les mineurs aident vraiment le barbare
- **Pour le joueur** : quand le minotaure attend juste derrière l'entrée, le barbare se bat sur le seuil. Avant, les
  autres mineurs restaient dehors à « attendre le barbare » jusqu'à la fin du combat ; maintenant ils viennent taper
  le boss avec lui (sauf ceux réglés sur « Fuir »).

- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Inventaire : recycler une pièce de stuff
- **Pour le joueur** : clique une pièce fabriquée dans l'inventaire, bouton **♻ Recycler** ; une fenêtre montre ce que
  tu récupères. La pièce est détruite et rend **60 %** de sa recette, arrondi vers le bas (un ingrédient demandé à 1
  ne rend rien). Son amélioration et sa rune sont perdues. Impossible pour une pièce portée ou enregistrée dans un set :
  la fenêtre le dit.
- **Décisions** (Geoffrey) : seulement le stuff fabriqué avec une recette ; seulement la recette (pas le coût
  d'amélioration) ; interdit si la pièce est portée ou dans un set.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Inventaire : trier et déplacer les objets
- **Pour le joueur** : bouton **Trier** en haut de l'inventaire. Il range par type (blocs, minerais, matériaux,
  stuff, puis treasures, blueprints…), du plus rare au plus commun, et bouche les trous. On peut aussi **glisser un
  objet** dans un autre slot ; si le slot est pris, les deux objets échangent leur place.
- **Décisions** (Geoffrey) : le tri suit la rareté de l'objet (commun, inhabituel…), pas la qualité R1-R7.
  Choix de Claude à valider : treasures, blueprints, four et parchemins viennent après le stuff ; la plus rare d'abord.
- **À suivre** : le glisser-déposer ne marche qu'à la souris (pas au doigt sur téléphone).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Lobby : l'équipe reste visible sur Jugement
- **Pour le joueur** : en choisissant « ⚖ Jugement » dans « Où miner », on voit toujours son groupe à droite (comme pour
  la Mine) : inviter, quitter, voir qui est prêt. Le bouton Lancer n'y est pas : on lance depuis la Mine ou une tour.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Treasure T1 : plus de treasures, plus de blueprints, moins de parts
- **Pour le joueur** : dans les areas 0 à 2 (celles du Treasure T1), **60 %** de chance de trouver un treasure (40 %
  au-delà). Dans un Treasure T1 : les blueprints des 6 pièces en fer (pioche, épée, casque, plastron, jambes, bottes)
  tombent à **2 %** chacun (avant 1 %) ; four en fer, boussole en or et ceinture gobelin restent à 1 %. Les
  Blueprint parts passent à **5 à 10** (avant 5 à 15). Le minerai d'**or** pèse **3** dans le sac (avant 4). Wiki à jour.
- **Décisions** (Geoffrey) : valeurs ci-dessus.
- **À suivre** : en simulation (3 mineurs sans stuff), 2 treasures par partie dans les areas ouvertes mais toujours
  0,4 ramené : les mineurs ne trouvent pas ceux qui sont loin de leurs galeries.
- **État** : ✅ en ligne le 25/10

## 24/10/2026 — Geoffrey — Plus de treasures : 40 % par area
- **Pour le joueur** : chaque area a maintenant **40 %** de chance de cacher un treasure (avant 30 %), dans toutes
  les areas. Le wiki suit tout seul (le chiffre est lu dans le jeu).
- **Décisions** (Geoffrey) : chance de treasure 30 % → 40 %.
- **À suivre** : en simulation (équipe de 3 sans stuff, 5 parties), il y a plus de treasures dans les areas ouvertes
  (1,2 → 1,6 par partie), mais les mineurs en ouvrent autant (0,4) : un treasure n'est visé qu'une fois découvert,
  et les nouveaux tombent souvent dans des coins qu'ils ne fouillent pas. L'effet sera plus net pour une équipe
  équipée qui explore plus. Si ça ne se sent pas, le levier est la découverte, pas la chance.
- **État** : ✅ en ligne le 25/10 (avec `geoffrey/tresor-60`, puis 60 % en areas 0 à 2)


## 25/10/2026 — Geoffrey — Aura du stuff runé
- **Pour le joueur** : une pièce visible (casque, torse, ceinture, jambes, bottes) identifiée R4+ avec une rune R4+
  s'entoure d'un halo qui pulse, de la couleur de la qualité (magenta R4, orange R5, rouge R6, jaune R7) : faible en
  R4-R5, moyen en R6, fort en R7. On le voit dans la mine, la mine instantanée, les tours, et sur les portraits (barre
  du haut, lobby, onglet Stuff). Purement visuel.
- **Décisions** (Geoffrey) : pièce ET rune R4+, la plus basse des deux donne couleur et force (en pratique la rune,
  qui ne dépasse jamais la pièce) ; un fragment de rune ne compte pas ; halo dessiné derrière le mineur pour ne jamais
  cacher sa texture ; visible partout.
- **À suivre** : regarder en vrai en jeu si le halo « faible » se voit assez à la taille de la mine (réglable en
  config, `AURA.looks`).
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Combats plus vivants : portée, recul, tacle refondu
- **Pour le joueur** : les combats bougent. Chaque coup du mineur **repousse le mob d'un quart de bloc** ; le mob
  revient au contact, le mineur le suit. On frappe dès qu'on est à **un demi-bloc** (plus besoin d'être collé), jamais
  en diagonale. **Le tacle ne bloque plus le mineur sur place** : il peut bouger, mais seulement pour combattre le mob
  qui le tient, jusqu'à sa mort (ou une provocation du barbare). Le **minotaure**, les **Séraphins / Diablotins** et le
  **boss des tours** repoussent aussi le mineur (le boss garde sa projection de 6 blocs). Nouvelle stat **Résistance
  au recul** (0 de base, aucune pièce ne la donne encore). Le wiki est à jour.
- **Décisions** (Geoffrey) : recul 0,25 pour le mineur, 0 pour les mobs sauf minotaure / mobs et boss des tours
  (0,25) ; portée 0,5 bord à bord, sans diagonale ; recul sur l'axe du coup, bloqué par un bloc ; résistance en % ;
  tacle jusqu'à la mort du mob ou une provocation, avec une soupape anti-blocage (5 s sans pouvoir frapper, ou mob à
  plus de 6 cases) ; cadence de coup des mobs 1 s (le gobelin, le méphite et l'occultiste gardent la leur).
- **À suivre** : les **tours sont plus dures** (compo forte : 2 victoires sur 5 → 0 sur 5, ≈ 8 % de dégâts en
  moins) : à rééquilibrer si besoin (recul du boss, PV). Où donner la Résistance au recul. Le boss des tours ne recule
  pas sous les coups (choix de Claude, à valider). Regarder un combat en vrai dans le navigateur.
- **État** : ✅ en ligne le 25/10

## 25/10/2026 — Geoffrey — Don d'administration : choisir la qualité d'une pièce
- **Pour le joueur** : rien. Outil des créateurs : `give-item.js` peut maintenant donner une pièce de stuff déjà
  identifiée dans la qualité voulue (`--quality 5` → un Plastron en fer R5), toujours sans redémarrer le jeu.
- **État** : ✅ en ligne le 25/10

## 24/10/2026 — Geoffrey — Wiki à jour, avec sa date
- **Pour le joueur** : le wiki affiche en haut « 🗓 Mis à jour le 24/10/2026 ». Nouveau : une section **Les sorts**
  (tableau des 6 sorts : déblocage, spécialisation, effet, recharge), **l'XP de spécialisation** (50 % de ta part en
  plus, mêmes paliers que le niveau), **les anneaux** et **les sets** ; onglets Stuff (12 cases), Skills (SP lvl) et
  Sorts. Corrigé : passerelles illimitées (le wiki disait 10), touches de la barre, mine instantanée (priorité aux
  tas de plumes découverts, galeries dans tous les sens), « Aider allié » (garde son mob jusqu'à 30 cases), trésors de
  tour (parfois un anneau). Les recettes (acier + Tainted gold), le butin (chitine de l'occultiste) et les stats
  étaient déjà à jour : ces tableaux viennent du jeu.
- **Décisions** (Geoffrey) : la date du bandeau se met à jour à chaque changement du wiki (règle ajoutée à CLAUDE.md).
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — Armure en acier : il faut aussi du Tainted gold
- **Pour le joueur** : casque, plastron, jambes et bottes en acier demandent en plus du **Tainted gold**, la moitié du
  Steel ingot de la recette : casque 5, plastron 8, jambes 7, bottes 4 (24 pour l'armure complète, soit 120 lingots
  d'or et 480 peaux de gobelin au four). Pioche, épée et Plastron de l'équilibre : inchangés.
- **Décisions** (Geoffrey) : Tainted gold = ½ du Steel ingot sur l'armure en acier.
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — Mine instantanée : les mineurs ne foncent plus au fond
- **Pour le joueur** : dans la mine instantanée, les mineurs creusent davantage sur les côtés au lieu de faire des
  puits jusqu'au fond. À 3 mineurs, ceux qui finissent au fond passent de 43 % à 3 %. La moitié basse de la mine ne
  représente plus que 25 % des blocs creusés, contre 42 % avant. Le nombre de blocs creusés ne change pas (≈ 102 par
  mineur).
- **Décisions** : creuser sous ses pieds compte maintenant comme un pas. Avant, c'était gratuit (le mineur tombe tout
  seul dans le trou), donc il préférait toujours descendre.
- **À suivre** : un peu moins de plumes ramassées (à 3 : 4,6 → 4,1 par mineur), car les mineurs restent plus dans la
  même zone. On peut compenser avec plus de tas, ou aller plus loin vers l'horizontal (plus de galeries, encore moins
  de plumes).
- **État** : ✅ en ligne le 24/10 (le code est parti avec le commit `e4397eb` d'une autre discussion ; doc ajoutée ensuite)

## 24/10/2026 — Geoffrey — Les occultistes lâchent aussi de la chitine

L'occultiste vaincu donne maintenant **1 à 2 Chitine** en plus de ses 1 à 3 Tissu sombre (comme le gobelin, qui donne
déjà de la chitine en plus de sa peau). Wiki et règles du jeu à jour. ✅ en ligne le 24/10.

## 24/10/2026 — Geoffrey — XP de spécialisation : même courbe que le niveau
- **Pour le joueur** : monter un niveau de spécialisation (SP lvl) demande maintenant autant d'XP que monter un niveau
  de mineur (1000 pour le niveau 2, puis ×1,5). On en gagne toujours la moitié de son XP. En solo : niveau 2 en ≈ 3
  sessions, niveau 5 (sorts Dash, Illumination, Inspiration) en ≈ 19, niveau 10 (Dynamite) en ≈ 174.
- **Décisions** (Geoffrey) : courbe de l'XP de spé = courbe du niveau (avant : 10 fois moins chère, 100 ×1,5).
- **À suivre** : les sorts de classe deviennent lointains (Dynamite ≈ 174 sessions) : revoir leurs niveaux de
  déblocage si c'est trop. Les comptes qui avaient déjà de l'XP de spé gardent leur XP, mais leur niveau baisse.
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — Nouveau mob : le Méphite
- **Pour le joueur** : un nouveau mob à partir de l'**area 3**, le **Méphite**, une masse de gaz verte aux yeux jaunes.
  Il **vole** : pas besoin d'échelle, il traverse les galeries vides et rattrape le mineur même en haut d'un puits.
  Fragile (70 PV en area 3), mais tant qu'il tacle, le mineur perd **5 d'oxygène toutes les 2 s** (plusieurs méphites ne
  se cumulent pas ; la Ténacité peut ignorer chaque perte). Il laisse **1 à 2 Vésicules de gaz** (sans usage pour
  l'instant) et donne 12 XP. Il peut aussi sortir des pièges.
- **Décisions** : apparition 5 % en area 3, 15 % en area 4, 20 % en area 5 et au-delà, pris sur la part du gobelin.
  Vol réel (choix de Geoffrey). XP 12 (entre gobelin et occultiste). Difficulté mesurée ≈ 6/10 : environ 25 s
  perdues par rencontre avec une équipe en fer (7 s de combat + 18 s d'oxygène).
- **À suivre** : un usage pour la Vésicule de gaz. Vérifié : aucune partie bloquée, et pas d’effet sur la progression (sans stuff 4,0 areas, en fer 5,1 : comme avant).
- **État** : ✅ en ligne le 24/10


## 24/10/2026 — Geoffrey — Simulations deux fois plus rapides
- **Pour le joueur** : rien ne change en jeu. Le mineur remonte au même moment et prend les mêmes décisions. Le serveur
  consomme moins de processeur pendant les parties.
- **Décisions** : le calcul du chemin de retour au coffre (81 % du temps d'une session) est guidé vers le haut : même
  temps de retour, deux fois moins de calcul. Session simulée à 3 mineurs : 34 s → 15 s. Quand deux chemins prennent
  exactement le même temps, le mineur peut prendre l'autre : une seed rejouée à 3 mineurs peut donc donner une partie
  très légèrement différente de celle d'avant (1 sur 5 en simulation).
- **À suivre** : une étape 2 (recalculer ce chemin moins souvent quand la fin de session est loin) pourrait gagner
  encore, mais elle changerait le comportement du mineur : pas faite, à décider.
- **État** : ✅ en ligne le 24/10

---

## 24/10/2026 — Geoffrey — Mise à jour mineure : dégâts de zone vérifiés, XP de spé ×5, jauges à 200
- **Pour le joueur** :
  - **XP de spécialisation** : 50 % de sa part d'XP au lieu de 10 %. En solo, ≈ 430 par session : niveau 5 en ≈ 2
    sessions, niveau 10 (Dynamite) en ≈ 17 (avant ≈ 87).
  - **Jauges Ange / Démon** : la tour s'ouvre à **200** résidus au lieu de 250. Une jauge déjà au-dessus de 200 en
    ligne ouvrira sa tour tout de suite.
  - **Dégâts de zone** (Force brute, barbare) : vérifiés, ils sont bien codés et appliqués (mine et tours), depuis les
    skills du compte jusqu'au coup. Mais c'est minuscule : 2 % du coup par rang (6 % à 3/3), soit ≈ 0,35 PV sur un mob
    voisin pour un coup de 5,75. Un coup sur cinq environ a un mob voisin. D'où l'impression que ça ne marche pas.
    **Nouveau** : un petit chiffre orange (« -0,3 ») monte au-dessus de chaque mob touché par la zone (mine et tours).
- **Décisions** (Geoffrey) : XP de spé 50 %, cap des jauges 200 ; dégâts de zone : valeur inchangée, mais affichés.
- **À suivre** : ⚠️ le chiffre n'a pas été regardé dans un navigateur.
- **État** : ✅ en ligne le 24/10

---

## 24/10/2026 — Geoffrey — Pioches en fer et en acier : buff réduit
- **Pour le joueur** : le buff des pioches du jour est revu à la baisse : **pioche en fer +0,5** (au lieu de +0,7 ce
  matin, +0,4 avant), **pioche en acier +0,6** (au lieu de +0,72, +0,48 avant). Les pièces déjà fabriquées suivent.
- **Décisions** : pioches × 1,25 au lieu de × 1,75 (fer) et × 1,5 (acier). Le reste du buff du jour ne change pas.
- **À suivre** : l'équipe en fer avancera un peu moins loin que les ~5,5 areas visées par le buff complet (la pioche
  était le plus gros levier) : à mesurer.
- **État** : ✅ en ligne le 24/10

---

## 24/10/2026 — Geoffrey — Buff du stuff en fer et en acier
- **Pour le joueur** : les pièces en fer, en acier et le Plastron de l'équilibre sont nettement plus fortes, **y compris
  celles déjà fabriquées** (et leurs lignes d'identification et runes, qui suivent la valeur de la pièce).
  - Fer (× 1,75, épée × 1,25) : pioche +0,7 (avant +0,4), épée 14 (11), casque +67 (+38), plastron +88 (+50),
    jambes et bottes +1,05 (+0,6).
  - Acier (× 1,5, épée × 1,25) : pioche +0,72 (+0,48), épée 16 (13), casque +69 (+46), plastron +120 (+80),
    jambes et bottes +1,08 (+0,72).
  - Plastron de l'équilibre (× 1,5) : pods +188 (+125), oxygène +30, minage +3 %, dégâts +3 %, vitesse d'attaque +8 %,
    ténacité +3 %, fortune +2 %, butin +3 %, torches +8.
- **Décisions** : le but est qu'une équipe en fer (mineur, logisticien, barbare) arrive en moyenne à ~5,4 areas au lieu
  de 5,0, sans changer les équipes moins équipées (sans stuff ≈ 4,0, chitine ≈ 4,1 : elles ne portent pas ces pièces).
  Mesures avant le patch : aucune stat seule, même doublée, ne suffisait ; tout le fer × 1,75 donnait 5,5 sur 20 parties.
- **À suivre** : l'acier n'est plus qu'à peine au-dessus du fer (casque +69 contre +67, pioche +0,72 contre +0,7) alors
  qu'il coûte des diamants : à revoir. L'écart chitine → fer devient grand (plastron +30 → +88). Vérification par
  simulation avec les valeurs exactes du patch interrompue (mise en ligne demandée) : à refaire.
- **État** : ✅ en ligne le 24/10

---

## 24/10/2026 — Geoffrey — Sets (stuff, skills et sorts)
- **Pour le joueur** : à gauche des onglets Stuff, Skills et Sorts, une liste de **sets**. « + Nouveau set » enregistre
  ton stuff porté, tes skills et tes sorts ; « Équiper » remet tout d'un coup, « Enregistrer » remplace le set par ton
  équipement du moment ; on peut renommer (✎) et supprimer (×). Pratique pour passer d'un équipement « farm » à un
  équipement « donjon ».
- **Décisions** (Geoffrey) : une seule liste, qui agit toujours sur tout (stuff + skills + sorts) ; une pièce disparue
  laisse sa case vide ; impossible pendant une session ; pas de limite (garde-fou technique : 20).
- **À suivre** : rien.
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — XP de spécialisation et Sorts
- **Pour le joueur** :
  - **XP de spécialisation** : chaque session rapporte aussi 10 % de ton XP à ta spécialisation (Mineur,
    Logisticien ou Barbare), avec un niveau par spécialisation. Il s'affiche dans l'onglet Skills (barre d'XP), dans le
    lobby (« 🪜 Logisticien (SP lvl : 3) ») et au bilan.
  - **Nouvel onglet Sorts** : 4 emplacements (2 ouverts, 2 verrouillés), et la liste de tous les sorts (cadenas sur
    ceux qu'on n'a pas encore). On équipe d'un clic ou en glissant le sort. En session, les sorts partent tout seuls
    dès qu'ils sont rechargés et utiles ; une barre en bas de la mine montre le compte à rebours.
  - 6 sorts : **Dash** (Barbare niv. 5), **Illumination** (Mineur niv. 5), **Inspiration** (Logisticien niv. 5),
    **Dynamite** (Mineur niv. 10), **Ulti shen** et **Fast learner** (à apprendre avec un parchemin).
- **Décisions** (Geoffrey) : une XP par spécialisation, gardée si on change ; 10 % de sa part après le partage et le
  bonus de l'anneau ; courbe 100 puis ×1,5 ; le niveau de spé ne donne rien d'autre que les sorts pour l'instant. Sorts
  déclenchés tout seuls (pas de clic), mais seulement quand ils servent ; Dynamite ne casse que ce que le mineur peut
  miner (jamais une échelle ni le sol sous un mineur) ; Ulti shen limité à 5 % des PV sur un boss, seulement pour un
  allié (rien en solo).
- **À suivre** : d'où viennent les parchemins (aucune source pour l'instant) ; comment s'ouvrent les emplacements 3
  et 4. Fast learner se cumule sans limite, à surveiller. En simulation (3 mineurs, 5 parties) avec les sorts :
  ≈ +7 % de ressources rapportées, même profondeur ; le détecteur de blocage signale un peu plus d'alertes, à revoir.
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — Bonus d'XP personnel (Anneau du nerd)
- **Pour le joueur** : le « +3 % d'XP » de l'Anneau du nerd ne profite plus qu'à celui qui le porte. L'XP de la session
  est d'abord partagée à parts égales, puis le porteur gagne +3 % sur sa part. Ex. à 3 avec 1000 XP : 333 chacun,
  342 pour le porteur. Avant, le pot entier gagnait +3 % et tout le groupe en profitait.
- **Décisions** (Geoffrey) : le bonus d'XP est personnel et s'applique après la répartition ; seul le bonus n'est pas
  partagé. Les autres anneaux restent des effets de groupe.
- **À suivre** : rien.
- **État** : ✅ en ligne le 24/10 (avec les Sorts)

## 24/10/2026 — Geoffrey — Aider allié : fini les allers-retours sur place
- **Pour le joueur** : deux mineurs en « Aider allié » ne tournent plus en rond entre « aller aider », « retourner au
  filon » et « reprendre l'échelle ». Celui qui part aider va jusqu'au bout, même si le mob se retourne contre lui en
  route. S'il s'éloigne trop (plus de 30 cases, par exemple à cause d'un grand détour), il abandonne ce mob pour de bon.
- **Décisions** : correctif, pas de nouvelle règle. Valeur provisoire : 30 cases de marge (l'aide démarre toujours à
  20 cases au plus).
- **À suivre** : à revoir en jeu sur la seed 1928461225 avec Galia.
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — Les mineurs tuent les canards en remontant
- **Pour le joueur** : quand un mineur remonte déposer au coffre, il va tuer le Gallianix qui traîne à côté avant de
  redescendre (si « combat » est sur Combattre). Avant, il ne le chassait qu'en toute fin de session, et comme les
  mineurs sont souvent encore en train de remonter à ce moment-là, les canards restaient en vie (seed 87312228).
- **Décisions** : aucune nouvelle ; la chasse garde ses limites (temps de revenir au coffre, pas de trou à traverser).
- **À suivre** : rien.
- **État** : ✅ en ligne le 24/10

## 23/10/2026 — Geoffrey — Retours du soir : aide sans retour, Logisticien refait, donjon révélé
- **Pour le joueur** :
  - **Aider allié** : après avoir aidé, le mineur se remet au travail là où il est, au lieu de retraverser la mine pour
    retrouver le minerai ou la galerie qu'il avait avant.
  - **Logisticien** : **Bâtisseur supprimé**. Étage 1 : **Navette** (max 3). Étage 3 : **Escalateur** (max 5), le seau du
    treuil va +5 % par rang plus vite **pour tout le groupe** (deux logisticiens : le meilleur rang compte). Mule demande
    Escalateur 5/5. Le chemin complet coûte toujours 11 points ; les logisticiens existants récupèrent les points qui ne
    tiennent plus (Bâtisseur, Navette 4 et 5, Mule) et doivent les replacer.
  - **Donjon** : dès qu'un mineur entre dedans, tout le donjon (murs, intérieur, minotaure) apparaît d'un coup.
- **Décisions** (Geoffrey) : celles ci-dessus. Choix de Claude à valider : Escalateur ne se cumule pas entre
  logisticiens (comme les anneaux).
- **À suivre** : ⚠️ **équilibrage** : retirer Bâtisseur coûte cher (simulation, 5 parties à 3, un arbre par mineur au
  max : areas 3,8 → 3,2, coffre −4 %) et Escalateur au max ne le rattrape presque pas. Le coffre « traversable » à la
  surface n'est pas fait : je n'ai pas reproduit de blocage, exemple demandé.
- **État** : ✅ en ligne le 24/10

## 23/10/2026 — Geoffrey — Anneaux : 2 cases de stuff, effet pour tout le groupe
- **Pour le joueur** : deux nouvelles cases **Anneau** dans l'onglet Stuff. Un anneau ne donne rien à son porteur seul :
  son effet va à **tout le groupe** de la session. Deux joueurs avec le même anneau = l'effet compte une fois ; on ne
  peut pas porter deux fois le même anneau. 8 anneaux : tigre (vitesse +3 %), lion (dégâts +3 %), rat (minage +3 %),
  baleine (oxygène +3 %), cuck (pods +3 %), nerd (XP +3 %), Midas (fortune +2 %, épique), Bouffon (butin +2 %, épique).
  On les trouve **en ouvrant un Trésor** de l'Ange ou du Démon (en plus de la rune) : ≈ 6,5 % par trésor, Midas
  seulement chez l'Ange, Bouffon chez le Démon. Pas de craft, pas d'identification, d'amélioration ni d'enchantement.
- **Décisions** (Geoffrey) : amélioration +1 à +3 interdite aussi ; « +3 % » = ×1,03 sur le total (stuff et skills
  compris) ; en mine instantanée, l'anneau ne sert qu'à son porteur ; l'anneau tombe à l'ouverture du trésor, pas à la
  victoire. Choix de Claude à valider : **un seul tirage par trésor** (jamais deux anneaux d'un coup).
- **À suivre** : regarder l'onglet Stuff (12 cases) et les icônes des anneaux dans le navigateur.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Outil : donner un objet à un joueur, sans redémarrer
- **Pour le joueur** : rien (outil d'administration) ; un cadeau apparaît tout de suite dans son inventaire.
- **Pour l'équipe** : sur le VPS, `sudo node /opt/deep-idle-mine/scripts/give-item.js --name crousti --item
  "Treasure T3"` donne n'importe quel objet du jeu à un compte **sans arrêter ni redémarrer le jeu**. Il faut une
  fois la clé `DIM_ADMIN_TOKEN` dans les réglages du serveur (mode d'emploi dans `docs/deploiement-ovh.md`).
- **Sécurité** : la commande ne marche que depuis le VPS lui-même, avec la clé ; depuis internet, elle n'existe pas.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Petites corrections : canards en fin de partie, treasure oublié
- **Pour le joueur** : en fin de session, au lieu d'attendre au coffre sans rien faire, les mineurs vont tuer les
  Gallianix (canards) de la surface, s'ils ont le temps de revenir au coffre ensuite (le Fragment de cœur n'est pas
  perdu). Ils ne le font pas en « Ignorer » ou « Fuir », ni si le canard est de l'autre côté d'un trou.
- **Pour le joueur** : un treasure découvert dans une area du dessus (ex. collé au puits du treuil, où tout le monde
  passe) restait là toute la partie : avec « Plus profond », le mineur ne regardait que l'area la plus profonde. Ce
  n'était pas une question de poids (le treasure est déjà la cible la plus attirante). Maintenant, un treasure ou un
  résidu découvert à 12 cases ou moins est pris quel que soit le focus d'area.
- **Décisions** : treasures et résidus passent avant le focus d'area quand ils sont à portée (Geoffrey).
- **À suivre** : rien de visible sur les 5 parties de référence (aucune ne tombe sur ces cas) ; la seed 1384517703
  ouvre maintenant son treasure.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Mineur : skill « Légende de la flemme »
- **Pour le joueur** : 4e étage de l'arbre Mineur, 0/1 (après Ruée 5/5) : quand le mineur doit remonter à la surface,
  **5 % de chance de se téléporter au-dessus du coffre commun**.
- **Décisions** (Geoffrey) : un tirage par remontée ; toutes les raisons sauf la fin de session ; taclé ou étourdi, le
  tirage se fait après ; mine classique seulement.
- **À suivre** : regarder l'onglet Skills (4e étage du Mineur, icône).
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Retours de l'après-midi : occultiste, Force brute, fragments de rune, prêt, MI, Jugement
- **Pour le joueur** :
  - **Occultiste** : 150 PV de base (avant 100). La Provocation du barbare **casse** son rayon mais ne l'empêche pas
    de le relancer : un barbare peut se faire étourdir (vérifié en vrai combat ; le wiki disait l'inverse, corrigé).
  - **Force brute** (barbare) : en plus, **2 % de dégâts de zone par rang** : chaque coup touche aussi les mobs à
    1 case de sa cible (boss compris).
  - **Runes** : on peut **retirer** une rune d'une pièce (gratuit, onglet Amélioration). Elle revient en **Fragment de
    rune** : mêmes lignes, **% divisés par 2**. Un fragment se repose comme une rune ; posé, il ne se retire plus.
  - **Prêt tout le temps** : ne se décoche plus tout seul, seulement en cliquant sur la case ; il suit le joueur
    d'un groupe à l'autre.
  - **Mine instantanée** : ne fait plus quitter son groupe. On s'y inscrit seul ; après la mine, on est toujours dans
    son lobby.
  - **Jugement** : **une tour à la fois**. Pendant qu'une tour est ouverte, la jauge de l'autre est en pause et les
    mines lancées pendant ce temps n'ont plus de résidus. À la fermeture, tout reprend.
- **Décisions** (Geoffrey, réponses aux questions) : zone = mobs à 1 case de la cible ; fragment reposable comme une
  rune ; retrait gratuit ; fragment posé définitif. Choix de Claude : la ligne « +1 Découverte » d'un fragment n'est
  pas divisée (ce n'est pas un %) ; fragment de rareté « rare ».
- **À suivre** : regarder dans le navigateur le bouton « Retirer la rune » et la jauge « en pause ».
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Plastrons : plus de pods
- **Pour le joueur** : les plastrons donnent plus de pods : chitine **+30** (avant 25), fer **+50** (33), acier **+80**
  (40), équilibre **+125** (60). Les plastrons **déjà fabriqués** ont les nouvelles valeurs (les stats sont lues
  dans le catalogue à chaque session) ; les lignes d'identification et les runes sur un plastron grandissent aussi
  (elles valent un % de la valeur de la pièce).
- **Décisions** : les pods sont le levier de la progression (simulation : +100 pods sur une équipe en fer = area 5
  ouverte 6 min plus tôt ; dureté de la pierre, oxygène, torches, dégâts : 0 à 3 min). L'acier ne suit plus
  « fer × 1,2 » pour le plastron.
- **À suivre** : mesurer l'effet sur l'ouverture de l'area 5 (cible : ~45 min pour une équipe stuffée).
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Correction : le logisticien tournait en boucle autour du treuil
- **Pour le joueur** : un logisticien qui part installer ou prolonger le treuil pouvait tomber dans un trou juste à
  côté du puits (près du coffre), remonter, retomber, remonter… toutes les 2 secondes, souvent jusqu'à la fin de la
  session (seed 1209172417, capture de Geoffrey : « coincé entre le coffre et l'échelle »). Maintenant, tombé à côté,
  il rejoint le puits du treuil et continue son chantier.
- **Ampleur** (simulation, 8 seeds × 1 et 3 logisticiens) : avant, jusqu'à **1 755 remontées** dans une session et, sur
  une seed, le treuil n'était **jamais posé** ; après, **1 à 4** remontées par session (les vrais retours : pods,
  oxygène), treuil posé et prolongé partout. Ce n'était pas le socle du coffre.
  Des logisticiens à 3 descendent en moyenne de 190 à 199 couches.
- **À suivre** : la simulation montre aussi des combats contre le Gallianix qui durent 30 s ou plus près de la surface
  (le mineur attend beaucoup) : à regarder à part.
- **État** : ✅ en ligne le 23/10


## 23/10/2026 — Geoffrey — Mine instantanée : graphite et diamant
- **Pour le joueur** : la mine instantanée contient maintenant 20 % charbon, 40 % fer, **33 % or** (avant 39 %),
  **5 % graphite** et **1 % diamant** (nouveaux), plus 1 % de tas de plumes. Par mine : 125 graphites et 25 diamants.
- **Repères** (simulation, 5 mines) : à 20 joueurs, par joueur ≈ 4,5 graphites et 0,9 diamant, l'or passe de 35,6 à
  30,1, le reste ne bouge pas ; à 3 joueurs ≈ 5,3 graphites et 1,3 diamant.
- **À suivre** : un diamant par MI et par joueur environ, soit ~12 diamants par jour en faisant toutes les MI : à
  comparer aux 10 diamants par outil en acier.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Résidus : 0,5 % au total, à la place de la pierre
- **Pour le joueur** : à partir de l'area 4, chaque area a **13 résidus** (6 d'un camp, 7 de l'autre), soit 0,5 % des
  blocs, au lieu de 26 (13 + 13, 1,04 %). Ils remplacent uniquement de la **pierre normale** ; la pierre dure et le
  reste ne bougent plus.
- **Décisions** (Geoffrey) : 0,5 % en cumul, pris sur la pierre normale. 0,5 % de 2 500 blocs = 12,5 : on arrondit à
  13, et le camp du 13e est tiré par la seed (équilibré en moyenne).
- **À suivre** : deux fois moins de résidus rapportés → les jauges (cap 250) mettront environ deux fois plus de temps à
  se remplir.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Skill Mule (Logisticien, étage 4)
- **Pour le joueur** : nouveau skill **Mule** (0/1) au 4e étage du Logisticien. Quand il pose le treuil, le
  logisticien pose un **sac** à côté du bas du treuil (jauge de remplissage au-dessus). Un mineur aux pods pleins y
  dépose si le sac est plus près que la surface (dépôt partiel si la place manque). Capacité : 2 × les pods des
  logisticiens qui ont Mule (400 de base). Le logisticien le vide au coffre quand il prolonge le treuil et en fin de
  session ; s'il quitte la partie, le sac part au coffre. Un sac pas rapporté à la fin est perdu (bilan).
- **Aussi** : **Navette** (étage 3) exige maintenant **Échelle de 2 et Treuil** : tout logisticien qui prend Mule a
  le Treuil. Une sauvegarde qui n'avait qu'une des deux perd Navette et récupère ses points.
- **Décisions** (Geoffrey) : sac vidé seulement à la prolongation et en fin de session, même plein entre-temps ;
  capacité = somme des pods des logisticiens avec Mule ; tous les objets acceptés ; mine classique seulement.
  Choix de Claude à valider : case de gauche si la droite est incassable ; chaque objet compte pour celui qui l'a
  déposé ; en fin de session, le logisticien passe par le sac lors de sa dernière remontée qui le permet.
- **Repères** (simulation, 10 parties à 3, un arbre complet chacun) : ≈ 2,7 dépôts et 500 pods par partie passent
  par le sac, 0 sac perdu, 0 blocage. Le sac ne coûte au logisticien que **≈ 6 s par partie** (miner la case, poser, ramasser) : il le
  reprend en remontant par le treuil, sur son chemin. Coffre
  3 946 pods contre 4 074 sans Mule : écart dans le hasard (±15 % d'une partie à l'autre, Mule gagne 3 paires sur
  10) ; **pas d'effet mesurable** sur 10 parties. Le sac, plein après une vague de dépôts, attend la prolongation
  suivante : il rapporte peu.
- **À savoir** : sans lien avec Mule, le logisticien passe ≈ 24 min sur 60 dans le chantier du treuil.
- **Décision** (Geoffrey) : mis en ligne tel quel (vider le sac à chaque remontée : pas retenu pour l'instant).
- **État** : ✅ en ligne le 23/10

---

## 23/10/2026 — Geoffrey — Nouveau mob : le Gallianix
- **Pour le joueur** : à chaque nouvelle area débloquée, un **Gallianix** (canard jaune qui sautille) apparaît à la
  surface, près du coffre. Il a un pseudo comme un joueur (« Cuiseuse de sperme », « Roxanne », « La brésilienne »,
  « La thaïlandaise », dans l'ordre puis en boucle), 50 PV, ne tacle pas, saute par-dessus les trous et ne tombe jamais
  dans la mine. Vaincu, il laisse un **Fragment de cœur** une fois sur 4, qui va au coffre commun.
- **Décisions** : pas de canard au lancement (seulement aux déblocages) ; les mineurs le frappent comme un autre mob ;
  fragment dans le coffre commun. Choix de Claude : 5 XP, s'envole vers le sol le plus proche si on creuse sous lui.
- **À suivre** : le Fragment de cœur ne sert à rien pour l'instant. Les canards coûtent un peu de temps (profondeur
  moyenne à 3 : 192 → 182 en simulation).
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Table de recherche : tier 3
- **Pour le joueur** : la Table de recherche a un **Tier 3** (150 parts) qui donne les plans du Treasure T3 (pièces
  en acier, Plastron de l'équilibre). Il s'ouvre quand toutes les recettes du tier 2 sont apprises, comme le tier 2
  après le tier 1. Le **plan du Plastron de l'équilibre** sort **4 fois moins souvent** que chaque autre plan (≈ 4 %
  tant que les 7 sont possibles). Recycler un plan T3 rend 40 à 70 parts.
- **Décisions** : rareté du plan épique = poids 0,25 (4× moins, dans la fourchette 3 à 5 demandée) ; recyclage du tier
  3 = celui du tier 2 (même prix), choix de Claude à valider.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Stuff en acier, Plastron de l'équilibre, Treasure T3
- **Pour le joueur** :
  - **Treasure T3** dans les areas 5 et 6 (le T2 ne sort plus qu'en areas 3 et 4). Il contient toujours 20 à 40
    Graphite ore, 3 à 10 Tissu sombre et 10 à 20 Blueprint parts ; parfois un blueprint d'acier (1 % chacun), celui du
    Plastron de l'équilibre (0,5 %), une gemme (2 % chacune) ou un Cristal de pleine lune (10 %).
  - **Six pièces en acier** (inhabituelles, gris bleuté), recettes secrètes débloquées par leur blueprint : la pièce en
    fer × 1,2. Casque 46 d'oxygène, plastron 40 pods, jambes et bottes +0,72, pioche +0,48, épée 13 dégâts. Armure :
    Steel ingot + 10 Shiny iron + 10 Tissu sombre ; pioche et épée : Steel ingot + 10 Shiny gold + 10 Diamant.
  - **Plastron de l'équilibre** (épique, moitié ange moitié démon) : 50 Steel ingot, 20 Shiny gold, une gemme de
    chaque, 50 résidus de chaque camp. Pods +60, oxygène +20, minage et dégâts +2 %, attaque +5 %, ténacité +2 %,
    fortune +1 %, butin des mobs +2 %, torches +5.
- **Décisions** : arrondis à l'entier (46, 40, 13) ; oxygène du Plastron de l'équilibre +20 ; noms « … en acier ».
- **À suivre** : pas de tier 3 dans la Table de recherche (un blueprint T3 recyclé rend 30 à 60 parts, comme le
  tier 1) ; coût en Shiny et en Diamant à surveiller ; les résidus du plastron ne remplissent pas les jauges du Jugement.
- **Wiki** : mention du T3 dans les areas et les treasures (le reste se met à jour tout seul depuis la config) ;
  section Mine instantanée corrigée (inscriptions dans les 30 dernières minutes, possibles en session).
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Tours : étages en serpentin, Séraphins et Diablotins, boss qui bouge
- **Pour le joueur** : la tour du Jugement est refaite. 20 de large, **7 étages** séparés par des planchers
  incassables percés d'une **porte de 3 cases** collée à gauche puis à droite : on traverse chaque étage en serpentin.
  Étage 0 vide, puis un étage sur deux **plein de briques** ou **gardé par 5 Séraphins / Diablotins** (200 PV, ils
  taclent ; la porte du plafond ne s'ouvre qu'une fois tous morts). Chaque étage se découvre en entier quand on y
  entre, il fait noir (torches illimitées). Le boss a **2 000 PV**, **se déplace** vers le mineur le plus proche quand
  personne n'est à son contact, projette à **20 %** (10 % pour un barbare) ; projeté depuis le bord, on tombe en bas
  et on remonte tout. Le **barbare se met du côté opposé** aux autres. Caméra aussi large que la tour.
- **Décisions** : celles de Geoffrey ci-dessus. Choix de Claude à valider : on **passe derrière le boss** (sinon le
  barbare ne peut pas rejoindre l'autre côté) ; le combat (et donc le déplacement du boss) commence au **premier coup
  reçu** ; deux mineurs ne posent pas la même échelle (le second attend).
- **Mesures** (20 tours par compo, sans skills) : 3 mineurs de base **0 %** ; 2 mineurs + 1 barbare à 1,1 / 10
  **90 %** ; 2 barbares à 15 dégâts + 1 mineur à 1,3 **100 %**. Victoires vers 9 min 15-9 min 20 sur 10 : peu de marge.
  Nouveau : `npm run simulate:tower`.
- **Boss à 5 000 PV** (demande de Geoffrey, 11 h) : b et c **0/20** (arrivée sur le toit vers 8 min 15 : il reste
  ~100 s, les deux compos font au mieux 3 750 et 4 400 dégâts). À trancher : durée à 12-13 min, briques plus rapides,
  ou 5 000 PV visés pour un stuff plus fort.
- **Boss à 3 500 PV** (décision de Geoffrey, 11 h 10) : base 0/20, compo b **0/20** (il reste ≈ 300 PV), compo c
  **12/20** (victoire vers 9 min 53).
- **À suivre** : regarder la tour dans le navigateur (mobs, lumière, caméra) ; ajuster ensemble les chiffres.

## 23/10/2026 — Geoffrey — Graphite, Steel ingot, nouvelle area 6
- **Pour le joueur** :
  - Nouveau minerai **Graphite ore** (veines gris-bleu), dans les **areas 5 et 6**. Plus dur que l'or (dureté 4),
    poids 3, 4 XP.
  - **Four** : 10 Graphite ore + 10 charbons → **1 Graphite ingot** en 1 min.
  - **Alliage** : 3 Tainted iron + 10 Graphite ingot + 50 charbons → **1 Steel ingot** en 3 min. Le steel ne sert à
    rien pour l'instant (recettes à venir).
  - **Area 5 revue** : 55 % pierre, 20 % pierre dure, 9,5 % fer, 5 % or, 0,5 % diamant, 5 % graphite, 5 % vide
    (plus de charbon). **Nouvelle area 6** (et au-delà) : 35 % pierre, 40 % pierre dure, 7 % fer, 6 % or, 1 % diamant,
    6 % graphite, 5 % vide.
- **Décisions** : ligne de l'area 5 ramenée à 100 % par le fer (9,5 % au lieu de 10). Graphite 60 s au four, steel
  3 min et 50 charbons comme les autres alliages.
- **À suivre** : à quoi sert le steel (craft) ; plus de charbon à partir de l'area 5 (il faudra le ramener d'en haut
  pour le four) ; l'area 6 n'a pas de donjon (donjon en areas 4 et 5) et garde les mobs de l'area 5.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Retours du 23/10 : socle du coffre, Tainted gold, temps d'un ami, compteur LFG
- **Pour le joueur** :
  - La case **sous le coffre** de la surface est un **socle incassable** (dalle grise cerclée de fer) : plus personne ne
    creuse sous le coffre. Le coffre n'a pas bougé : il est en colonne 22, le treuil en colonne 25 (le milieu), ils ne
    se gênent pas.
  - **Tainted gold** : 5 lingots d'or + **20 peaux de gobelin** (au lieu de 20 chitine). Un four déjà chargé avec
    l'ancienne recette s'arrête, rien n'est perdu : on reprend ses lingots et sa chitine.
  - **Social** : un ami en session affiche le **temps qui lui reste** (« En session mine · reste 23 min » ; pour une
    tour ou la mine instantanée, son nom).
  - **Chercher un groupe** : le Lobby affiche **combien de joueurs cherchent** un groupe, même si on ne cherche pas.
- **Décisions** (Geoffrey) : les 4 points ci-dessus. Choix de Claude à valider : le temps d'un ami est le temps
  **restant** (pas le temps écoulé) ; un groupe de 2 en recherche compte pour 2 joueurs.
- **À suivre** : regarder le socle, le compteur et la ligne Social dans le navigateur.

- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Lobby : « Prêt tout le temps »
- **Pour le joueur** : dans un groupe, un membre peut cocher **« Prêt tout le temps »** (à côté du bouton Prêt). Il
  reste alors prêt d'une session à l'autre, même quand quelqu'un rejoint : le chef relance sans attendre de clic. On
  peut la cocher pendant une session, pour la suivante. Décocher ou « Prêt (annuler) » l'arrête.
- **Décisions** : réservée aux membres (le chef n'a pas d'état « prêt ») ; reste cochée tant qu'on est dans le groupe
  (choix de Claude à valider : on pourrait aussi la décocher quand un inconnu rejoint).
- **À suivre** : regarder la case dans le navigateur.
- **État** : ✅ en ligne le 23/10

## 22/10/2026 — Geoffrey — Barbare : nouveau talent « Braum »
- **Pour le joueur** : l'arbre Barbare a un **4e étage**, **Braum** (0/3, il faut Pillage au max). Quand le barbare
  va aider un allié (mob qui le poursuit, boss d'un donjon découvert, mobs d'un piège), il marche et grimpe (échelle
  et seau du treuil) **10 % plus vite par point**, soit +30 % à 3/3, jusqu'à la fin de ce combat.
- **Décisions** (Geoffrey) : étage 4 sous Pillage ; +10 % par point ; actif pendant le trajet et le combat ; le seau
  compte aussi ; pas de nouvelle stat.
- **À suivre** : l'effet est faible sur une session entière (simulation, 3 barbares complets : profondeur 189,8 →
  191,4, dans le bruit), car ces trajets sont courts et rares. Il se sentira surtout quand un piège ou un donjon est
  loin du barbare.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Petits retours : fours, butin, skills, chutes, bilan
- **Pour le joueur** :
  - fours : bouton **Tout retirer** (un par four, et un pour tous les fours) et bouton **½** à côté de Max ;
  - Résidus angélique et démoniaque : rareté **commune** (contour gris) ;
  - **butin des mobs** (Pillage, stat Butin des mobs) : 9 % = 9 % de chance d'avoir **1 butin en plus**, plus une
    multiplication (avant : 3 cristaux × 1,09 donnait 27 % de chance d'en avoir 4) ;
  - onglet Stats : Pillage apparaît dans « Butin des mobs » (le bonus comptait bien en jeu, il n'était pas affiché), et
    les skills de comportement (Bâtisseur, Navette, Provocation…) sont listés sous les stats ;
  - chute : une chute qui finit sur une échelle se fait à la vitesse de l'échelle ; l'IA ne sort plus du treuil (ni
    d'une échelle) pour tomber à côté et y revenir plus bas (227 détours sur 3 sessions → 14) ;
  - bilan : la fin d'une mine n'affiche plus le bilan d'une tour restée ouverte ; le bilan détaille ce qui était
    encore dans les sacs (perdu).
- **Décisions** : les Cristaux de pleine lune restent dans le sac jusqu'au dépôt (perdus s'ils ne sont pas déposés à
  la fin).
- **À suivre** : regarder en jeu le bouton ½ et Tout retirer ; sans skills, profondeur 192 → 186 (les raccourcis par
  chute étaient un peu plus rapides).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Le lobby montre le skin des autres
- **Pour le joueur** : dans le lobby, chaque membre du groupe apparaît avec son équipement (casque, armure, pioche…).
  Avant, on ne voyait que son propre skin ; les autres étaient en tenue de base.
- **À suivre** : regarder à deux comptes dans le navigateur. Quand un ami change de stuff, son skin change au
  rafraîchissement suivant du lobby (quelques secondes).
- **État** : ✅ en ligne le 22/10


## 22/10/2026 — Geoffrey — Les mineurs reprennent le puits des autres
- **Pour le joueur** : en équipe, après un passage au coffre, un mineur reprend le puits déjà creusé par les autres
  (ou le treuil) au lieu de retourner à sa colonne pour recreuser un puits depuis la surface. Le mineur de droite
  (3ᵉ place, loin du coffre) n'est plus isolé au début de chaque descente ; on se répartit une fois au fond.
- **Décisions** (Geoffrey) : option « C » : plus de limite de secteur pour descendre par l'existant. À la mise en
  ligne (fusion avec main) : on garde « Plus profond » de Jules plutôt que « travailler dans la dernière area » ;
  donjons à **33 %** en areas 4 et 5 (au lieu de 100 %).
- **À suivre** : regarder une vraie partie à 3. Au tout premier départ, aucun puits n'existe : chacun creuse le sien
  (ça ne change pas). Un mineur en priorité « Minerais » suit toujours les filons proches de la surface avant de
  descendre.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Pièges dans la mine
- **Pour le joueur** : à partir de l'area 1, une area peut cacher 0, 1 ou 2 **pièges** : une petite salle vide de
  5 × 3 entourée de roche normale (on ne la voit pas, seul un coin reste noir). Le mineur qui mine un bloc de la paroi
  libère **5 mobs** de l'area (jamais de mimic), plus solides (PV × 1,5) et plus rapides (× 1,5), qui le chassent
  partout. Un **barbare** dans le groupe vient à la rescousse, quels que soient ses réglages. Le wiki l'explique.
- **Décisions** : 2 tirages de 25 % par area ; seul l'intérieur est caché (la paroi se découvre comme de la roche) ;
  barbare « comme au donjon » ; physique normale : les mobs ne grimpent pas, un trou en hauteur les laisse dans leur
  salle (le mineur choisit alors selon son réglage de combat).
- **IA corrigée au passage** (deux défauts que les trous des pièges faisaient apparaître) : un mineur pouvait
  tourner en rond entre deux galeries à la limite de deux areas ; en fin de session, s'il n'avait plus le temps
  de creuser plus bas, il attendait sur place, le sac plein, au lieu de remonter déposer.
- **À suivre** : ~3 pièges ouverts par session à 3, chacun prend 1 à 4 min de combat. Avec le seuil à 60 %, les
  pièges coûtent ~0,5 area par session (sans skills 3,0 au lieu de 3,6 ; skills mélangés 3,6 au lieu de 4,0),
  aucun blocage. À juger en jeu : trop dur ? trop long ?

## 22/10/2026 — Geoffrey — Trésors des tours (au lieu des coffres)
- **Pour le joueur** : battre le boss d'une tour donne maintenant un **Trésor** angélique ou démoniaque. Son nom dit
  sa qualité, écrit dans la couleur de la qualité : « **Antique** Trésor démoniaque » (R5), « **Mystérieux** Trésor
  démoniaque » (R6)… Chaque trésor prend sa case (ne s'empile pas), avec un contour **Unique** orange foncé, une
  nouvelle rareté. Ouvert, il donne toujours une rune de sa qualité.
- **Pourquoi** : un joueur a cru recevoir une rune « Légendaire » parce que son coffre R6 avait le contour
  Légendaire, et il a eu une rune Mystérieux. Avec les Trésors, ce qu'on lit est ce qu'on obtient.
- **Décisions** : les noms de qualité restent ceux d'aujourd'hui (R5 = Antique) ; même règle pour l'Ange et le
  Démon ; les anciens coffres déjà gagnés **restent tels quels** et s'ouvrent comme avant (Geoffrey).
- **À suivre** : regarder l'inventaire dans le navigateur (couleurs, contour).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Chercher un groupe (LFG)
- **Pour le joueur** : dans le Lobby (mine classique), un bouton **« Chercher un groupe »**. On est mis en file avec
  un timer, on peut annuler. Dès qu'il y a de quoi faire un lobby de 3, il se forme **d'un coup** : 3 solos → chez le
  premier entré ; un groupe de 2 → le solo le plus ancien les rejoint. Pop-up « Groupe trouvé ». Case **« Lancer dès
  que plein »** : si le chef du lobby formé l'a cochée, la session démarre toute seule.
- **Décisions** : seul le chef d'un groupe de 2 lance ou annule la recherche ; le lancement automatique suit le choix
  du chef seulement (Geoffrey).
- **À suivre** : regarder le panneau dans le navigateur avec 3 vrais joueurs (testé côté serveur, pas encore à l'œil).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Téléphone : la mine ne rétrécit plus en boucle
- **Pour le joueur** : sur téléphone, la mine de la session rapetissait d'une ligne à chaque instant puis se
  remettait à grandir (au rechargement, en tournant le téléphone, en changeant d'onglet) : un effet « respiration »
  qui donnait mal au cœur. Elle a maintenant une taille fixe : toute la largeur, 34 lignes de haut.
- **À suivre** : la mine instantanée et la tour, sur téléphone, n'ont pas été vérifiées en vrai (pas de signalement).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Mine plus longue : seuil d'ouverture d'une area à 60 %
- **Pour le joueur** : il faut maintenant miner **60 % des minerais** de la dernière area ouverte pour ouvrir la
  suivante (40 % avant). (Le seau du treuil est revenu à 0,85 × en même temps, mis en ligne par Jules : entrée suivante.)
- **Pourquoi** : depuis les mises en ligne de cet après‑midi (seau ×2 et focus « Plus profond »), une équipe de 3
  atteignait l'area 5, la dernière, dès la première partie (vu en jeu sur la seed 1102884141, sans nouveau stuff).
  Le cap du jeu, c'est de progresser de session en session grâce au stuff.
- **Chiffres** (5 parties simulées, mineurs de base) : à 3 avec skills, la dernière area ouverte est la 4 à chaque
  partie (avant ce changement : la 5 dans 4 parties sur 5), profondeur 262 → 213 ; à 2 avec skills, la 3 (profondeur ≈ 166) ; en solo, seule l'area 1
  s'ouvre (avant : la 2), profondeur ≈ 95.
- **Décisions** (Geoffrey) : seuil 60 % (valeur d'équilibrage). Le focus « Plus profond » de Jules est gardé.
- **À suivre** : ⚠️ en solo, un débutant ne voit plus que les areas 0 et 1 à sa première partie : à surveiller (on
  pourrait garder 40 % pour les premières areas et 60 % pour les profondes).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Treuil : retour à la vitesse d'avant
- **Pour le joueur** : le seau du treuil reprend sa vitesse d'avant (0,85 × la vitesse sur échelle). Le seau à ×2,
  en ligne quelques heures, est retiré. Les mineurs peuvent de nouveau sortir du seau pour une colonne d'échelles ou
  un trou à côté.
- **Décisions** : la vitesse du treuil ne change pas (Geoffrey et Jules).
- **Conséquence** : sans le seau rapide, « Plus profond » coûte plus à 3 (≈ −24 % de valeur au lieu de −15 %) et
  l'area 5 ne s'ouvre plus. Simulation (5 parties à 3) : 0 blocage, profondeur 230, areas 4.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Chat de session
- **Pour le joueur** : un panneau **Chat** dans l'onglet Session (à droite, au-dessus du journal). On écrit aux
  joueurs de sa session ; ses propres messages sont en vert. 200 caractères par message, un par seconde au plus.
- **Décisions** (Jules) : seulement les joueurs de la session ; panneau dans l'onglet Session ; rien n'est gardé
  (effacé à la fin de la session).
- **À suivre** : pas encore dans la mine instantanée ni dans les tours (le serveur l'accepte déjà, il manque
  l'affichage). Le chat est perdu si le serveur redémarre pendant la session (mise en ligne d'un changement).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Les mineurs vont chercher les résidus
- **Pour le joueur** : un résidu angélique ou démoniaque découvert attire maintenant le mineur autant qu'un
  treasure : il fait le détour pour le miner (avant : il ne les prenait qu'en passant). Statut « Va chercher un
  résidu ».
- **Effet mesuré** (5 parties à 3) : **2,6 fois plus de résidus** rapportés (4,2 → 10,8 par session), donc des
  jauges du Jugement qui se remplissent plus vite ; valeur des minerais −3 %.
- **Décisions** : poids du résidu = poids du treasure (Jules).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Focus area : « Plus profond » vise vraiment l'area la plus profonde
- **Pour le joueur** : avec « Plus profond » (choisi de base au début de la session), le mineur va travailler dans
  l'area la plus profonde ouverte et y redescend à chaque nouvelle area. Avant, il finissait les filons des areas du
  haut et passait plus de la moitié de son temps au-dessus.
- **Prix à payer** (5 parties) : environ **15 % de valeur rapportée en moins** (solo 414 → 352 ; à 3 : 1 762 →
  1 502), mais à 3 l'**area 5** s'ouvre à chaque partie (avant : la 4), profondeur 214 → 265.
- **Décisions** : c'est le comportement voulu pour le bouton (Jules). Avec un focus minerai, c'est lui qui choisit
  l'area, comme avant.
- **À suivre** : si la perte de quantité gêne, on peut ajouter un bouton « Auto » (l'ancien comportement).
  L'attente du barbare devant le donjon peut aller jusqu'à 0 d'oxygène (déjà le cas avant, vu plus souvent ici).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Treuil : le seau va plus vite, les mineurs y restent
- **Pour le joueur** : le seau du treuil monte et descend **2 fois plus vite qu'une échelle** (avant : un peu moins
  vite qu'une échelle). Les mineurs ne sortent plus du treuil pour descendre par une colonne d'échelles ou un trou
  d'à côté, qui étaient plus rapides.
- **Effet mesuré** (5 parties à 3, un logisticien) : minerai rapporté **+19 %** (1 186 → 1 407), profondeur 200 →
  214. L'équipe atteint maintenant le donjon de l'area 4 avant la fin.
- **Décisions** : vitesse ×2 (choix de Jules ; valeur provisoire). En dessous de ×2, un trou à côté reste plus rapide.
- **À suivre** : +19 %, c'est un gros gain pour un seul skill : à surveiller avec la progression.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Voir le stuff de ses amis
- **Pour le joueur** : dans l'onglet **Social**, chaque ami a un bouton **Stuff**. Il ouvre sa fiche : son niveau, sa
  spécialisation, les pièces qu'il porte (avec leur bulle d'info : qualité, amélioration, rune) et ses stats de mineur,
  exactement comme dans son propre onglet Stuff. Ça marche même si l'ami est hors ligne ou en session. On ne voit
  jamais son inventaire, et seulement pour un ami.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Chutes : plus de saut dans le puits d'un autre, et toujours étourdi au-delà de 3 cases
- **Pour le joueur** : un mineur debout sur son échelle se jetait parfois dans le puits déjà creusé par un autre (4 à
  6 cases), sans être étourdi puisque le trou était « connu ». Il ne le fait plus : comme pour les autres trous, il
  passe ailleurs ou creuse son propre puits. Et si un mineur tombe quand même de plus de 3 cases (son appui disparaît),
  il est maintenant **étourdi 5 s**, même dans un trou déjà découvert. Le logisticien qui creuse le puits du treuil
  reste exempté.
- **Mesures** (8 parties à 3) : chutes connues de plus de 3 cases hors treuil 8 → 0. Simulation 5 sessions :
  0 blocage, profondeur ≈ 199, ≈ 11 étourdissements par session (inchangé).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Fin de session : le mineur mine plus haut au lieu de descendre au front
- **Pour le joueur** : quand un mineur repart de la surface peu avant la fin, il ne descend plus jusqu'au front pour
  remonter aussitôt. Il se fixe une profondeur maximale (aller + retour = au plus la moitié du temps restant) et mine
  au-dessus : filons, galeries.
- **Mesures** (6 parties) : seul, 362 minerais contre 365 avant ; à 3, 1 073 contre 1 074 ; aucun blocage. Une partie
  à 3 sur 6 ne débloque plus l'area 4 dans les dernières minutes (on ne fonce plus au front à la fin).
- **Réglage** : la part du temps restant à garder pour miner (`endWorkShare`, 50 %) se change dans la config.


## 22/10/2026 — Geoffrey — Mine instantanée : galeries dans tous les sens, tas de plumes prioritaires
- **Pour le joueur** : les mineurs ne creusent plus tous droit vers le bas : chacun suit un cap qu'il change de temps en temps. Un tas de plumes découvert à 8 cases ou moins passe avant tout, même enfermé dans la roche : le mineur le plus proche creuse vers lui.
- **Décisions** : la pénalité de proximité n'était pas la cause (testée à 0 : rien ne change). La cause : un bloc voisin ne coûte rien, la gravité et la montée coûteuse font le reste.
- **À suivre** : régler `headingWeight` / `turnBlocks` si les galeries sont trop droites ou trop erratiques.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — « Blocage au treuil » : fausse alerte du détecteur
- **Pour le joueur** : rien ne change. Le logisticien n'était pas coincé : il redescendait au front par le treuil, y
  arrivait en fin de session et remontait aussitôt. C'est l'outil de test (détecteur de blocage des simulations) qui
  se trompait quand un mineur passe de « descend » à « remonte » ; il est corrigé.
- **À suivre** (pas un bug) : ce logisticien part pour 2 min 30 de descente à 5 min de la fin (deux combats en route),
  pour remonter dès son arrivée. Une règle « ne pas redescendre si le temps restant ne permet pas de travailler »
  ferait gagner un peu ; à décider.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Mine instantanée : inscriptions 30 min avant, même en session
- **Pour le joueur** :
  - on ne peut s'inscrire à la mine instantanée que **dans les 30 dernières minutes** : pour celle de 12 h, fermé à
    11 h 29 (« 🔒 Inscriptions à 11 h 30 »), ouvert à 11 h 30 ;
  - on peut maintenant **s'inscrire pendant une session** : « Mine instantanée » reste cliquable dans le lobby. Si la
    session n'est pas finie à l'heure, on **rate la mine** et la session continue (la carte prévient) ;
  - lancer une session normale ne désinscrit plus ; inscrit en session, on garde son groupe jusqu'à l'entrée dans la
    mine ;
  - les rappels (30, 15, 5 min, 30 s) arrivent aussi pendant une session normale ;
  - après une mine instantanée, on n'est dans aucune session (vérifié par un test).
- **Décisions** : celles ci-dessus (Geoffrey).
- **État** : ✅ en ligne le 22/10
## 22/10/2026 — Geoffrey — Tours du Jugement : labyrinthe, brouillard, caméra, 10 minutes
- **Pour le joueur** :
  - **Labyrinthe** : dans les tours, une ligne sur deux est un mur incassable percé d'un seul passage (4 cases), jamais
    au-dessus du précédent : on zigzague au lieu de monter tout droit.
  - **Brouillard** : l'intérieur de la tour est noir au départ ; chaque mineur découvre autour de lui (sa Découverte),
    comme dans la mine.
  - **Caméra** : rapprochée, elle suit ton mineur (avant : toute la tour à l'écran).
  - **Durée** : 10 min (avant 15).
- **Décisions** : Geoffrey ; 5 min demandées, mais mesuré infaisable avec le labyrinthe (même bien équipés : 0/10) →
  10 min, briques gardées à 6 s (choix de Geoffrey). Choix de Claude : le passage est d'un seul tenant.
- **Mesures** (10 tours, à 3) : stuff de base 0/10 ; petit stuff 3/10 ; minage 1,6 + 14 dégâts 10/10 en ≈ 7,5 min ;
  le même seul 0/10.
- **Vérifié** : aucune confusion dans le code entre la **tour** du Jugement et le **donjon** (minotaure) de la mine
  classique. L'« erreur » signalée plus tôt était un test pas à jour depuis les donjons en areas 4 et 5 (corrigé
  ce midi), pas un bug du jeu. La spec disait « donjon » pour la tour à deux endroits : corrigé.
## 22/10/2026 — Geoffrey — Enchantement : la qualité de la rune dépend de la pièce
- **Pour le joueur** : une pièce n'accepte qu'une rune de qualité **égale ou inférieure** à la sienne : une pièce R6
  (un casque, par exemple) peut recevoir une rune R1 à R6, pas une R7. L'onglet l'explique, marque dans la liste « jusqu'à R6 »
  / « trop rare pour cette pièce », et dit pourquoi le bouton est grisé. Le serveur refuse aussi.
- **Décisions** : cette règle (Geoffrey, 22/10). Confirmé par Geoffrey : une pièce **non
  identifiée** ne peut pas avoir de rune, elle doit d'abord être identifiée (avant, elle pouvait).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Concasseur : nouvelles chances, plus de moyennes
- **Pour le joueur** : chances par lot de 100 blocs : **terre** gemme 0,6 % / treasure 0,5 % ; **pierre** 0,9 % / 0,3 % ;
  **pierre dure** 1,2 % / 0,5 %. Dans l'aide « ? » et le wiki, on ne voit plus que la chance par lot : plus de
  « 1 lot sur N », de moyenne ni de temps estimé.
- **Décisions** : ces chances (Geoffrey, 22/10). « Une gemme » = chance d'en avoir une, partagée à parts égales entre
  rubis, jade et saphir (choix de lecture de Claude : 0,6 % = 3 × 0,2 %).
- **À suivre** : le treasure devient 25 à 50 fois plus fréquent (≈ 1 par 60 sessions et par joueur, avant ≈ 2 000).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Mine instantanée : mine cachée et caméra de près
- **Pour le joueur** :
  - la mine instantanée est **cachée au départ**, comme la mine normale : chaque mineur découvre les cases autour de
    lui selon sa stat **Découverte** (2 de base), et ce qu'il découvre, tout le monde le voit ;
  - la **caméra suit ton mineur** de près (environ 24 colonnes au lieu de toute la mine) : on ne voit plus toute la
    carte d'un coup ;
  - le classement affiche « x tas de plumes restants dans la mine ».
- **Décisions** : celles ci-dessus (Geoffrey). Choix de Claude : la découverte est commune à tous (comme la mine
  normale) ; un mineur ne va chercher qu'un tas déjà découvert ; zoom de 24 colonnes (réglable).
- **Mesuré** : aucun effet sur le butin (simulation à 1, 3 et 20 mineurs : mêmes plumes et minerais qu'avant).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Wiki à jour, vraies chances du concasseur
- **Pour le joueur** :
  - **Concasseur, bouton « ? »** : pour chaque bloc, la chance d'avoir **une gemme** (les trois s'additionnent :
    0,3 % par lot de terre, pas 0,1 %), « 1 lot sur N » et le temps moyen de concassage (ex. terre : une gemme toutes
    les ≈ 5 h 30, un Treasure T1 tous les ≈ 7 jours), puis le détail gemme par gemme. Même tableau dans le wiki.
  - **Wiki** : nouvelles sections **Mine instantanée** (horaires, mine, plumes, gravité et échelles, rappels) et
    **Amélioration** (qualités R1 à R7, paliers +1 à +3 et leur coût) ; donjon « à chaque partie, area 4 et area 5 » ;
    onglets à jour (barre d'action en bas, Amélioration, Historique, vrai Social) ; la Plume d'ange n'est plus « pas
    encore obtenable » ; plumes et cristaux affichent leur usage.
  - **Ange contre Démon** dans le wiki : résidus, jauges du Jugement (dans le Lobby), tours et boss, coffres, runes et
    **Enchantement** (lignes d'une rune selon sa qualité) ; résidus, coffres et rune ont leur source et leur usage.
- **État** : ✅ en ligne le 22/10 (après l'identification sans stats et le Jugement dans le Lobby)
## 22/10/2026 — Geoffrey — Le Jugement passe dans le Lobby
- **Pour le joueur** : plus d'onglet Jugement dans la barre. Dans le **Lobby**, « Où miner » propose **Mine, Mine
  instantanée, ⚖ Jugement** : Jugement affiche les deux jauges et l'état des tours à la place de l'équipe. Quand une tour
  est ouverte, « Choisir la tour » la sélectionne directement ; un point sur l'onglet Lobby et « ● tour ouverte » sur
  le bouton le signalent. L'ancien lien `#jugement` mène au Lobby, sur les jauges. Social reprend la touche « = ».
- **Décisions** : Jugement dans le Lobby (Geoffrey).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Identification : la qualité seule, plus de stats
- **Pour le joueur** : identifier une pièce lui donne toujours une qualité (R1 Utile à R7 Légendaire : titre et couleur
  du nom), mais **plus aucune stat en plus**. Le tableau des qualités dans l'onglet ne montre plus que les chances.
- **Décisions** : celle-ci (Geoffrey, 22/10) ; les pièces identifiées avant **gardent** leurs lignes de stats (Geoffrey).
- **État** : ✅ en ligne le 22/10 (les runes, elles, tirent toujours des lignes)

## 22/10/2026 — Geoffrey — Ange contre Démon : résidus, Jugement, tours, coffres, runes et Enchantement
- **Pour le joueur** :
  - **Résidus** : à partir de l'area 4, des blocs de **Résidu angélique** (fissures bleu ciel) et **démoniaque**
    (fissures rouges) dans la roche. Rapportés au coffre, ils remplissent deux **jauges communes à tous les joueurs**.
  - **Onglet Jugement** (3e onglet) : les deux jauges face à face (Ange blanc, Démon violet), 250 chacune.
  - **Tours** : une jauge pleine **ouvre la tour de son camp pendant 6 h**. On la lance depuis le Lobby (« Où miner »),
    seul ou à 3 : on creuse une tour de 30 de haut jusqu'au toit, où l'**Ange** (ou le **Démon**, 1 000 PV) attend. Il
    vise le premier arrivé et peut le projeter en bas de la tour (moins souvent un barbare). 15 min pour le battre.
  - **Victoire** : chacun reçoit un **coffre** (qualité R1 à R7). Ouvert, il donne une **Rune**. Une seule victoire par
    joueur et par ouverture ; un échec ne coûte rien.
  - **Enchantement** (onglet Amélioration) : on pose une rune sur une pièce de stuff ; ses lignes s'ajoutent à la pièce
    (une rune par pièce, définitif). L'écran montre ce que la rune donnera avant de valider.
  - **Identification** : nouveau tableau de conversion des stats (Geoffrey) ; total max des qualités ramené à
    25 / 30 / 35 / 40 / 50 / 75 / 100 % ; butin des mobs à +10 % pour 100 x. Les pièces déjà identifiées ont suivi.
- **Décisions** : concept et règles de Geoffrey (spec `docs/superpowers/specs/2026-10-22-ange-demon-design.md`).
  Choix de Claude à valider : projection du boss de **6 cases** (5 n'aurait jamais fait tomber) ; la valeur d'un
  objet reste celle du catalogue (pioche en pierre 130 x), le nouveau tableau sert seulement à convertir les lignes.
- **À suivre** : avec un stuff de base, **personne ne mine en area 4** (simulation : 0 résidu en 8 sessions à 3) : les
  jauges ne monteront qu'avec des joueurs équipés. Une tour se gagne à 3 en ≈ 7 min, mais **seul, 1 fois sur 5**
  (stuff de base). Pour tester l'Enchantement sans tour : `node scripts/give-admin.js --name X --chests 1`.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Mine instantanée avec gravité, plumes, Amélioration, donjons partout
- **Pour le joueur** :
  - **Mine instantanée** : les mineurs ne volent plus. Ils tombent quand il n'y a rien sous eux et posent des
    **échelles** pour remonter (illimitées, chacun peut prendre celles des autres). Pas d'étourdissement en cas de chute.
  - **Tas de plumes d'ange** : 1 à 2 plumes par tas (avant 1 à 5).
  - **Amélioration** : coût en plumes relevé à **20 / 30 / 50** pour +1 / +2 / +3 (cristaux inchangés : 3 / 5 / 7).
  - **Identification** : on clique sur une case, puis sur une pièce pour l'y poser (n'importe laquelle) ; si les deux
    pièces ne sont pas le même objet, le bouton reste grisé avec la raison. Les lignes tirées s'affichent **une par
    une** (« Fortune +1,2 % · Fortune +0,9 % ») au lieu d'être additionnées.
  - **Donjon** : il y en a un en **area 4 et un en area 5 à chaque partie** (avant : area 5, 20 %).
- **Décisions** : celles ci-dessus (Geoffrey, 22/10). Choix de Claude à valider : en mine instantanée, pas de limite
  de chute ni d'étourdissement.
- **À suivre** : avec 1-2 plumes par tas et 100 plumes pour une pièce à +3, il faut beaucoup de mines instantanées
  (mesuré : ≈ 2 à 5 plumes par joueur et par mine, voir debug.md). La vitesse de minage en % des pièces améliorées compte
  maintenant aussi en mine instantanée.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Session : colonnes jusqu'en bas, surface de nouveau visible
- **Pour le joueur** : pendant une session, les panneaux de gauche et de droite descendent jusqu'en bas de l'écran
  quand la barre d'action ne passe pas dessous (grands écrans) ; la mine montre de nouveau la surface et le ciel en
  début de session (bug de l'agrandissement de la veille : le haut de la vue était rogné). La mine remplit toujours
  la largeur, et montre plus ou moins de lignes selon la hauteur de l'écran.
- **État** : ✅ en ligne le 22/10

---

## 22/10/2026 — Jules — Revue de sécurité
- **Pour le joueur** : rien de visible. Le jeu est mieux protégé contre les sites malveillants (il ne peut plus être
  affiché dans un cadre d'un autre site, seuls nos propres scripts peuvent tourner sur la page).
- **Bilan** : pas de faille trouvée dans les comptes, les mots de passe, les droits, la base ou l'économie ; aucun
  secret dans le dépôt ni dans son historique. Corrigé : en-têtes de sécurité, ancien prototype plus servi en ligne,
  fichiers `.env` ignorés par git, limiteur de tentatives à mémoire bornée, un test anti-triche des skills qui était
  resté sur l'ancienne règle des arbres.
- **Décisions** : mémo `docs/securite.md` (ce qui est protégé, règles à garder, à faire hors code).
- **À suivre (hors code)** : protéger la branche `main` sur GitHub et activer la double authentification ; le dépôt
  est public ; les adresses e-mail de Geoffrey sont visibles dans les commits (voir le mémo).
- **État** : ✅ en ligne le 22/10

---

## 21/10/2026 — Jules — Onglet Social, noms des onglets visibles, nouveau nom « Deep Mine Idle »
- **Pour le joueur** :
  - **onglet Social** (fait par Geoffrey, fusionné et mis au style pixel par Jules) : ajouter un ami par pseudo (ou
    par ID pour un invité), accepter / refuser, voir si ses amis sont en ligne, en session ou dans un lobby, les
    inviter ou les rejoindre ; demandes d'ami et invitations arrivent en **pop-up** en haut à gauche ;
  - la barre d'action affiche **le nom de chaque onglet en permanence** (plus seulement au survol) ; touche « = »
    pour le 12e onglet (Social) ;
  - le jeu s'appelle **Deep Mine Idle** (titre de la page, logo, écran de connexion, wiki).
  - **la mine est plus grande** pendant la session : elle remplit toute la largeur entre les panneaux (le haut et
    le bas de la vue peuvent être un peu rognés ; la caméra garde ton mineur au milieu).
- **Décisions** : l'onglet Social fait partie du jeu (retiré du « hors périmètre ») ; nom du jeu : Deep Mine Idle
  (les noms techniques du serveur, `deep-idle-mine`, ne changent pas).
- **À suivre** : tester le Social à deux vrais joueurs en ligne.
- **État** : ✅ en ligne le 22/10

---

## 21/10/2026 — Jules — Nouvelle direction artistique : la Forge noire en pixel art
- **Pour le joueur** : tout le jeu passe en pixel art « Forge noire » (brique brune, fer riveté, braise), choisie
  parmi les maquettes de `design/poc/` (branche `jules/poc-design`).
  - Les onglets sont dans une **barre d'action en bas** (touches 1 à 9, 0 et -), entre deux **orbes** : temps de
    session et XP, ou oxygène et pods de ton mineur pendant une session. Le menu de gauche disparaît.
  - En haut : ton mineur (avec son stuff), le temps de la session en cours, le wiki.
  - **Session** : panneaux à gauche et à droite, la mine entière au centre (on voit toute sa largeur, moins
    zoomée qu'en plein écran), et une **jauge de profondeur** avec un repère par mineur. L'écran de session tient
    exactement dans la fenêtre.
  - **Stuff** : ton mineur au centre, équipé, entouré de ses 10 cases. **Lobby** : les sprites de l'équipe.
  - Cadres, boutons, cases et icônes en vrais pixels ; s'adapte à l'écran (plus grand au-delà de 1800×1000) et au
    téléphone.
- **Décisions** : direction artistique Forge noire en pixel art (Jules) ; la mine se voit en entier pendant la
  session (pas de gros plan).
- **À suivre** : le wiki (`wiki.html`) garde l'ancien look ; la mine instantanée a été vérifiée seulement à
  l'affichage du lobby ; retours des joueurs sur la taille de l'interface.
- **État** : ✅ en ligne le 21/10
## 21/10/2026 — Geoffrey — Retours lobby, IA, donjon, ténacité, équilibrage
- **Pour le joueur** :
  - concasseur plus généreux (gemmes ×2 à ×3, treasures ×7 à ×10) ; *remplacé par les chances décidées le 22/10* ;
  - pioches deux fois plus efficaces (pierre +0,2, fer +0,4 de vitesse de minage) ;
  - Ceinture en peau de gobelin : +10 torches (au lieu de Découverte +1) ;
  - passerelles illimitées.
  - le donjon peut aussi apparaître en area 4 (20 %, tiré à part de l'area 5 : une partie peut en avoir deux) ;
    *à la mise en ligne : 33 % en areas 4 et 5*.
  - nouvelle stat **Ténacité** : chance d'ignorer un sort de mob (vol du gobelin, canalisation de l'occultiste) ;
    Force brute (Barbare) donne +5 % de dégâts **et** +5 % de ténacité par rang ;
  - Provocation : frapper un occultiste qui canalise l'interrompt, mais il peut relancer son sort (sur le barbare).
  - ~~IA : le mineur travaille dans la dernière area débloquée~~ : *pas mis en ligne*, « Plus profond » de Jules
    (déjà en ligne) fait la même chose ; on garde le sien (décision Geoffrey, 22/10).
  - Treuil (seed 1250570735) : en repartant du coffre, un mineur allait d'abord à « sa » colonne, tombait parfois dans
    un trou sans échelle près de la surface et creusait un nouveau puits au lieu de prendre le treuil. Corrigé : quand le
    treuil existe, il prend directement la descente existante. Le treuil reste plus lent qu'une échelle déjà posée
    (règle actuelle) : un mineur qui a ses échelles jusqu'à son chantier peut encore les préférer.
  - Lobby : bouton « ✋ Je suis prêt » pour les membres ; le chef ne lance que si tout le monde est prêt, et tout le
    monde repasse « pas prêt » à chaque lancement (pas de relance sans l'accord des autres) ; le chef peut donner sa
    place (★).
- **Décisions** : le chef n'a pas besoin de cocher « Prêt » (lancer = prêt) ; la ténacité se tire à chaque sort ;
  la ceinture garde son nom.
- **À suivre** : le bouton « Prêt » n'a pas encore été essayé à deux comptes dans le navigateur.
- **État** : ✅ en ligne le 22/10

## 21/10/2026 — Jules — Opera GX : le jeu démarre de nouveau
- **Pour le joueur** : sur Opera GX (et avec certains bloqueurs de pubs), le jeu restait bloqué sur un lobby vide.
  C'est corrigé. La cause : la protection « anti-minage de cryptomonnaie » d'Opera bloque tout fichier nommé
  `miner.js` (le nom typique des scripts qui minent du Bitcoin en cachette), et notre fichier du mineur s'appelait
  justement comme ça. Il s'appelle maintenant `mineur.js`.
- **Décisions** : un test vérifie désormais qu'aucun fichier du jeu ne porte un nom visé par cette liste.
- **À suivre** : faire confirmer au joueur Opera GX que tout marche (Ctrl+F5).
- **État** : ✅ en ligne le 21/10

---

## 21/10/2026 — Geoffrey — Amélioration : le Cristal de pleine lune du minotaure remplace la « Pierre »
- **Pour le joueur** : l'amélioration coûte des Plumes d'ange (mine instantanée) et des **Cristaux de pleine lune**
  (minotaure du donjon). Avant ce correctif, elle demandait une « Pierre de pleine lune » que rien ne donnait : on ne
  pouvait rien améliorer.
- **Décisions** : la Pierre de pleine lune n'existe plus (c'était un malentendu : c'est le cristal du minotaure).
- **À suivre** : 15 cristaux pour un +3, avec un donjon dans 20 % des parties et 1 à 3 cristaux par minotaure : c'est
  lent, à surveiller.
- **État** : ✅ en ligne le 21/10

---

## 21/10/2026 — Geoffrey — Onglet Amélioration : identification R1 à R7 et amélioration +1 à +3
- **Pour le joueur** : nouvel onglet 💎 **Amélioration**.
  - **Identification** : on pose une pièce de stuff et on sacrifie un deuxième exemplaire du même objet. La pièce
    reçoit une qualité, de R1 « Utile » (30 %) à R7 « Légendaire » (1 %), et 1 à 4 lignes de stats en plus. Son nom
    prend la couleur de la qualité (« Excellent : Pioche en pierre »), la case garde la couleur de rareté du type.
  - **Amélioration** : +1, +2, +3 (+3 %, +5 %, +7 % sur toutes les stats de la pièce), avec des Plumes d'ange et des
    Pierres de pleine lune ; ça peut rater (95 % puis 90 %), on ne perd alors que les matériaux.
  - Nouvelles stats possibles : vitesse de minage en %, dégâts en %, critique (coup double), coup unique (bloc cassé
    d'un coup), perçage (casse aussi le bloc derrière), butin des mobs.
- **Décisions** : la valeur d'une ligne se calcule sur la valeur de l'objet lui-même (une pièce de haut niveau donne
  de plus gros bonus) ; la fourchette vaut pour chaque ligne ; l'identification est définitive ; toutes les stats qui
  ont une valeur en x peuvent tomber, sur n'importe quelle pièce ; +1 à +3 seulement pour l'instant ; critique :
  10 % = la valeur d'une pioche en pierre. Pas d'ID dérivé « 113:4 » : chaque pièce garde sa qualité, ses lignes et
  son niveau sur elle-même (deux R4 n'ont pas les mêmes stats).
- **À suivre** :
  - ~~décider d'où viennent les Pierres de pleine lune~~ → Cristal de pleine lune du minotaure (correctif plus haut) ;
    les Plumes d'ange se ramassent dans la mine instantanée (c'est le même objet) ;
  - les paliers +4 à +15 ;
  - la chance d'avoir « +1 Découverte » en R6/R7 (25 % par ligne, provisoire) ;
  - le prix du butin des mobs (provisoire) ;
  - regarder l'onglet dans le navigateur (pas encore vérifié à l'écran) ;
  - un test anti-triche des skills échoue déjà sur `main` (sans rapport) : à regarder.
- **Tester** : `node scripts/give-admin.js --name <pseudo>` donne une pioche en pierre de chaque qualité et
  50 matériaux. Serveur arrêté en local, ou redémarré après en ligne.
- **État** : ✅ en ligne le 21/10

---

## 21/10/2026 — Geoffrey — Mine instantanée (MI)
- **Pour le joueur** : rien encore en jeu. Les règles de la **mine instantanée** sont écrites (GAME_DESIGN §6) :
  toutes les 2 h pile (heure de Paris), tous les inscrits dans une mine 50×50 remplie de minerais, chacun pour soi,
  5 min de jeu (2 min 30 réelles). 1 % de tas de **Plumes d'ange** (nouvel objet rare, 1 à 5 par tas, au premier qui
  passe dessus). Lobby dans un sous-onglet de l'onglet Mine, rappels à 30, 15, 5 min et 30 s (avec Rejoindre).
- **Décisions** : butin non réduit (le MI devient une très bonne source d'or, à surveiller) ; déplacement libre dans
  les galeries (pas d'échelle ni de gravité) ; départ espacé en surface ; pas d'XP ; stats de minage, de marche,
  Fortune et shiny comptent ; 20 joueurs max par mine, répartis à parts égales au-delà ; fermer l'onglet ne fait rien
  perdre, seul « Quitter » fait tout perdre. La plume n'a pas encore d'usage (idée de Geoffrey à venir).
- **Simulation (étape 2)** : la mine instantanée tourne (sans serveur ni affichage pour l'instant). Chiffres avec le
  stuff de base (`npm run simulate:mi`) : ~100 blocs par mineur en 5 min ; à 20 mineurs, 80 % de la mine vidée,
  0 bloc disputé, chacun entre 93 et 110 blocs ; butin moyen par mineur ≈ 40 fers, 39 ors, 20 charbons, 2,3 plumes.
  Seul : 4 % de la mine, et quasiment jamais de plume. Sans la pénalité « éviter les autres », 500 blocs disputés et
  15 % de butin en moins : elle sert. Pioche +30 % de vitesse → +30 % de blocs (le stuff compte).
- **Plumes** (décision de Geoffrey) : le mineur va chercher un tas accessible à 3 pas ou moins (avant, seul, il
  passait à côté de tous). Résultat : ~4 plumes par MI seul, ~3 chacun à 20, presque plus de tas laissé par terre.
- **Serveur (étape 3)** : la mine s'ouvre toute seule toutes les 2 h pile (heure de Paris, heures d'été et d'hiver
  comprises ; la nuit où 2 h existe deux fois, une seule mine). Inscriptions gardées même si le serveur redémarre ;
  s'inscrire fait quitter son groupe, refusé en session ; lancer une session normale désinscrit. 21 inscrits → 2 mines
  (11 + 10). Le butin de chacun arrive dans son inventaire à la fin, une seule fois ; pas d'XP ; Quitter = rien. Si le
  serveur redémarre pendant la mine, elle reprend à l'identique.
- **Interface (étape 4)** : dans le **Lobby**, « Où miner » → **Mine instantanée** affiche le compte à rebours, le
  nombre d'inscrits et **S'inscrire / Se désinscrire** (à la place de l'équipe et de Lancer). Rappels en bas à
  droite, depuis n'importe quel onglet : 30 min, 15 min, 5 min, puis 30 s avec **Rejoindre / Décliner** (pas pendant
  une session normale). À l'ouverture, tout le monde bascule sur **Session** : toute la mine à l'écran, chrono, ton
  butin, classement, journal, **Quitter la mine** ; puis un bilan. Essayé dans Chrome à deux joueurs (mode dev,
  bouton « Ouvrir maintenant ») : butin bien versé, rien pour celui qui quitte, aucune erreur.
- **À suivre** : l'usage de la Plume d'ange (idée de Geoffrey) ; surveiller l'or rapporté par la MI une fois en ligne.
- **État** : ✅ en ligne le 21/10

## 21/10/2026 — Jules — Message d'erreur quand le jeu ne démarre pas (Opera GX)
- **Pour le joueur** : si le jeu ne démarre pas (page avec le menu de gauche vide), un cadre rouge s'affiche en
  haut et dit pourquoi : quel fichier est bloqué (bloqueur de pubs, extension…) ou quelle erreur l'a fait planter,
  avec le navigateur utilisé. Il suffit d'en faire une capture pour l'équipe. Si JavaScript est coupé, un message le
  dit aussi. Quand tout va bien, rien ne change.
- **Pourquoi** : un joueur sur Opera GX voit le lobby vide. Le jeu ne vérifie pas le navigateur et n'utilise rien
  de récent ; nos fichiers ne sont pas dans les listes anti-pubs EasyList / EasyPrivacy. Sans son message d'erreur,
  impossible de savoir ce qui bloque chez lui : ce cadre nous le donnera.
- **À suivre** : une fois en ligne, demander au joueur Opera GX une capture du cadre, puis corriger la vraie cause.
- **État** : ✅ en ligne le 21/10

---

## 21/10/2026 — Geoffrey — Lobby et Session : deux onglets séparés
- **Pour le joueur** : l'onglet « Mine » est remplacé par deux onglets.
  - **🏠 Lobby** : le groupe, les invitations, les préférences, **où miner** (Mine ; la **Mine instantanée** est
    affichée grisée « bientôt ») et le bouton Lancer. Pendant une session, il reste consultable en **lecture
    seule**, avec un bandeau « ⛏ En session dans la mine · temps restant · Voir la session ».
  - **⛏ Session** : la mine en direct, puis le bilan. Sans session : « Tu n'es pas en session ».
  - Au lancement, **tout le groupe bascule sur Session**, quel que soit l'onglet ouvert. « Retour au lobby » après
    le bilan ramène au Lobby. Le minuteur de session de la barre de gauche ouvre Session d'un clic.
- **Décisions** : lobby en lecture seule pendant la session ; bascule automatique au lancement ; bilan dans Session ;
  choix « Mine / MI » visible dès maintenant, MI grisée.
- **À suivre** : la Mine instantanée elle-même. La branche `origin/social` touche aussi `main.js` et `nav.js` :
  conflits à résoudre quand l'une des deux sera fusionnée après l'autre.
- **État** : ✅ en ligne le 21/10


---

## 21/10/2026 — Jules — Ménage des textes du jeu
- **Pour le joueur** : des textes plus courts et plus propres. L'épée affiche « Dégâts 8 » (plus « au lieu de 5 ») ;
  plus de phrases techniques (« Résultat vérifié par le serveur », « luminosité 80 % », « 50×50 = 2500 blocs »,
  « npm start » quand le serveur ne répond pas) ; plus de « Bientôt : aider un allié » alors que l'option existe ;
  plus de « Les valeurs sont provisoires » dans Skills ; l'objectif de la mine tient en une ligne
  (« 🔒 Area 2 : minerais de l'area 1 — 12 / 160 ») ; explications raccourcies (Stuff, lobby, Historique, Concasseur).
- **À suivre** : le journal de session (« Session démarrée (seed …) ») et le wiki n'ont pas été retouchés, à part
  les effets des épées dans le wiki.
- **Décisions** : le bilan à plusieurs ne précise plus que les Treasure sont « un pour chacun » (pas utile).
- **État** : ✅ en ligne le 21/10

---

## 21/10/2026 — Jules — Organisation du dépôt et méthode de travail
- **Pour le joueur** : rien ne change.
- **Décisions** :
  - on ne travaille plus directement sur `main` (le jeu en ligne se met à jour tout seul depuis `main`) : chaque
    tâche a sa branche `prénom/sujet`, gérée par Claude, et passe en ligne quand on dit « mets en ligne » ;
  - ce journal, en plus du journal technique `docs/debug.md` ;
  - CLAUDE.md réorganisé : début de discussion, git, fin de tâche, puis le projet ;
  - l'état du projet vit dans `claude/etat-du-projet.md` (une seule copie, aussi pour les projets claude.ai) ;
  - la spécialisation des rôles fait partie du jeu (retirée du « hors périmètre ») ;
  - on garde une seule page avec des onglets (`#mine`, `#inventaire`…) : des pages séparées couperaient
    l'affichage de la session à chaque changement d'onglet.
- **Ménage** : fichier parasite `deep-idle-mine` supprimé, doc Render rangée dans `docs/archive/`, `README.md`,
  identités git de Geoffrey regroupées (`canoul` = Geoffrey Boilay), fins de ligne fixées (LF).
- **À suivre** : décider du sort de la branche `social`.
- **Branches** : `concasseur` (déjà fusionnée) supprimée sur GitHub.
- **État** : ✅ en ligne le 21/10

---

## Avant le journal (18/10 → 21/10/2026)

Résumé reconstitué depuis git (commits de Geoffrey et de sessions Claude signées « Claude », dont on ne connaît
pas le demandeur) ; le détail est dans `docs/debug.md` et `git log`.

- **18–19/10** : version modulaire du prototype, catégories de blocs, areas de 50 blocs de haut, coffres
  au trésor, oxygène, inventaire en grille, barre d'onglets, comptes joueur (invité, pseudo + mot de passe, code de
  secours, ID), serveur qui fait foi, partage du coffre, lobby.
- **20/10** : gobelin, ouverture des Treasure T1, Four, focus minerai et focus area, stockage PostgreSQL
  (Neon), groupes de 3 et sessions communes, partie qui tourne sur le serveur, craft et stuff (pioche en pierre,
  pièces en fer, épée, ceinture), table de recherche, skills (Mineur, Logisticien, Barbare), treuil, skins des
  mineurs, caméra libre, hébergement OVH et domaine deepmineidle.fr.
- **21/10** : Shiny, rareté des objets, tier 2 (gants, cape, Treasure T2), four en fer, boussole en or,
  refonte des mobs (occultiste, mimics, « Aider allié »), wiki du joueur, partage anti-boosting, onglet Historique,
  donjon et minotaure (area 5), onglet Concasseur.
