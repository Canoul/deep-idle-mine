# Journal d'avancement

Où en est le jeu, qui a fait quoi, ce qui est en ligne. Écrit par Claude à la fin de chaque tâche, **le plus récent
en haut**, en langage simple. Le détail technique (fichiers, tests, chiffres) est dans `docs/debug.md`.

**Chantiers en cours** (pas encore en ligne) : ce sont les branches git. Demande à Claude « qu'est-ce qui est en
cours ? » ou lance `git branch -r --no-merged origin/main`.

Modèle d'entrée :

```
## JJ/MM/AAAA — Prénom — Titre court
- **Pour le joueur** : ce qui change en jeu (ou « rien, c'est de l'organisation »).
- **Décisions** : choix de design ou d'équilibrage tranchés (s'il y en a).
- **À suivre** : ce qui reste à faire ou à vérifier.
- **État** : 🧪 sur la branche `prénom/sujet` (pas en ligne) → ✅ en ligne le JJ/MM
```

---

## 22/10/2026 — Jules — Treuil : le seau va plus vite, les mineurs y restent
- **Pour le joueur** : le seau du treuil monte et descend **2 fois plus vite qu'une échelle** (avant : un peu moins
  vite qu'une échelle). Les mineurs ne sortent plus du treuil pour descendre par une colonne d'échelles ou un trou
  d'à côté, qui étaient plus rapides.
- **Effet mesuré** (5 parties à 3, un logisticien) : minerai rapporté **+19 %** (1 186 → 1 407), profondeur 200 →
  214. L'équipe atteint maintenant le donjon de l'area 4 avant la fin.
- **Décisions** : vitesse ×2 (choix de Jules ; valeur provisoire). En dessous de ×2, un trou à côté reste plus rapide.
- **À suivre** : +19 %, c'est un gros gain pour un seul skill : à surveiller avec la progression.
- **État** : 🧪 sur la branche `jules/treuil-vitesse` (pas en ligne)

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
