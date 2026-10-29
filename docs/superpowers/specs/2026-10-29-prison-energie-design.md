# Prison (farm AFK solo) et énergie — spec

*Idée de Geoffrey, 29/10/2026 ; décisions prises avec lui le même jour (questions 1 à 9 et deux parties de conception
validées). Les choix marqués « (Claude) » sont des propositions à valider. Toutes les valeurs sont provisoires et vont
en config (`PRISON`, `ENERGY`).*

## En une phrase

La **prison** est un mode solo sans fin, le « farm AFK » du jeu : le mineur y mine une petite carte qui se remet à
neuf quand 80 % de ses minerais sont minés ; elle rapporte la moitié de ce que rapporte une mine à 3 et recharge
l'**énergie**, qui seule limite le nombre de sessions de mine classique.

## Intention

- Le joueur a toujours quelque chose qui avance pour lui, même absent (boucle longue).
- La mine en groupe reste la meilleure façon de gagner (×2 par heure, objets rares ×2) ; la prison est la caisse de
  ressources entre deux sessions.
- L'énergie limite les sessions de mine sans quota fixe : on la dépense en mine, on la regagne en prison. Le coût
  aléatoire (6 à 12) désynchronise les joueurs qui enchaînent ensemble.

## Énergie

- Une jauge par compte, de **0 à 100** (`ENERGY.max`) ; chaque compte démarre à **100** (Claude), y compris les comptes
  existants à la mise en ligne.
- **Coût** : lancer une **mine classique** coûte entre **6 et 12** (`ENERGY.cost`, entier tiré par le serveur), pour
  **chaque joueur** du groupe (bots du mode dev exclus). Aucun autre mode ne coûte d'énergie pour l'instant (mine
  instantanée, tours, instance, Bloc géant).
- **Refus** : un joueur sous **6** (`ENERGY.cost.min`) ne peut pas lancer ; dans un groupe, le lancement est refusé en
  nommant le ou les joueurs à court, comme les clés de l'instance (Claude). Rien n'est débité tant que tout le groupe
  n'a pas assez.
- **Pas de remboursement** si l'on quitte la session avant la fin (Claude).
- **Recharge** : seulement en prison, **8 par heure de jeu** passée en prison (`ENERGY.prisonPerHour`), soit 16 par
  heure réelle en beta (vitesse ×2), plafonnée à 100 (le surplus est perdu). Créditée à la fin de chaque run et à
  l'arrêt de la prison (au prorata du temps de jeu du run).
- **Affichage** : jauge dans la barre du haut ; au lobby, le coût possible (« 6 à 12 ») à côté de « Lancer » et la
  raison d'un refus.

## La prison, côté joueur

### Lancer, arrêter

- Lobby, « Où miner » : un choix **Prison** (solo seulement : grisé si l'on est dans un groupe de plusieurs joueurs au
  moment de lancer). On la lance ; elle tourne jusqu'à ce que le joueur clique **Sortir de prison** (barre du haut et
  lobby).
- **Hors ligne**, elle continue (voir « Rythme ») ; après **24 h** sans que le joueur revienne (`PRISON.offlineMax`,
  dernière visite = dernière fois que le jeu était ouvert sur son compte), elle **s'arrête et attend**. Au retour, elle
  repart d'où elle s'était arrêtée.
- Pendant la prison, le joueur peut : rejoindre ou former un groupe au lobby, s'inscrire et jouer à la **mine
  instantanée**, entrer au **Bloc géant** : la prison continue (ressources et énergie).
- **Lancer une mine classique, une tour ou une instance termine la prison** : le coffre de la prison et l'énergie du
  run en cours sont versés, **pas ce que le mineur porte sur lui** ; la prison est fermée. La prochaine prison repart
  sur une carte neuve (run 1).
- Une seule prison à la fois par compte ; une prison et une mine classique ne tournent jamais ensemble pour un même
  joueur.

### La carte

- **Une seule area de 25 × 25** *(29/10, Geoffrey)* (`PRISON.width`, `PRISON.height`), avec la **composition de
  l'area max débloquée** par le joueur (minerais, blocs, mobs de cette area). Area max d'un nouveau joueur : 0.
- **Plus petite que la mine** : la largeur du jeu reste 50 cases ; les colonnes de chaque côté sont des **barreaux
  incassables** (nouveau bloc « Barreaux de prison », non minable), et la carte s'arrête à 25 lignes (la barrière du
  fond de la mine en dessous). Donjon (10 × 10) et pièges (5 × 3) sont placés dans ces 25 × 25.
- **Pourcentage de minerais réglé** *(29/10, Geoffrey)* : la taille reste 25 × 25 ; c'est la part de minerais de la
  composition (`PRISON.oreMul`, au détriment de la pierre et de la terre) qui est ajustée par simulation pour tomber
  sur la cible (voir « Équilibrage »).
- Même surface que la mine : coffre, départ, treuil, échelles, torches, lumière, oxygène, pods.
- **Contenu** : comme la mine de cette area, avec :
  - **2 fois moins de treasures** (`PRISON.treasureMul` 0,5 : chance d'un treasure dans l'area) ;
  - **chaque chance de butin rare × 0,5** (`PRISON.rareMul`) : glyphes, butin rare des mobs (`MOB_DROPS`) ; aussi les
    shiny et les cristaux de pleine lune des donjons (Claude) ; le **contenu** d'un treasure ouvert ne change pas (Claude : déjà divisé par le nombre de
    treasures) ;
  - **pas de k hole**, **pas de shrines** (même si le joueur en a d'actifs), pas de Gallianix (Claude : il naît d'une
    area débloquée, il n'y en a qu'une) ;
  - mobs, pièges, donjons et murs de chair : comme dans cette area.
- **Tous les sorts, skills, glyphes et anneaux** du joueur marchent (anneaux : les siens seulement, il est seul),
  figés au lancement comme en mine.

### Les runs

- Un **run** = une carte, de sa création à sa remise à neuf.
- Quand **80 % des minerais** de la carte (`PRISON.resetAt`, en nombre de blocs de minerai au départ du run) sont
  minés, le mineur **remonte déposer**, comme à la fin d'une session de mine (même remontée, raison « fin de run » ;
  il passe prendre son sac de Mule s'il en a un). Le run se termine une fois le dépôt fait (ou s'il ne peut plus
  remonter : comme une fin de session).
- **Sécurité** : un run qui n'atteint pas les 80 % en `PRISON.runMax` (3 h de jeu) se termine de la même façon.
- **Fin de run** : le coffre du run est **versé dans l'inventaire**, l'**XP** du run est créditée (comme une session
  solo : XP du mineur et de sa spécialisation), l'**énergie** du run est créditée ; puis le run suivant démarre sur une
  carte neuve, le mineur à la surface. Le journal de la prison note « Run n terminé : … ».
- **Arrêt en cours de run** (bouton « Sortir de prison », ou lancement d'une mine, d'une tour ou d'une instance) :
  coffre et énergie du run en cours versés, sac du mineur perdu, prison fermée. Le plafond de 24 h, lui, ne termine
  rien : il **met en attente** le run en cours, qui reprend au retour du joueur.

### À l'écran

- La prison s'affiche comme la mine (même rendu, états, barre de sorts, journal, coffre), avec en haut : **numéro du
  run**, **minerais minés / seuil** (« 61 / 80 % »), **énergie**, et le temps avant l'attente (« pause dans 23 h » si
  le joueur ne revient pas).
- Au retour après une absence : un bilan court « Pendant ton absence : 14 runs, + … ressources, + 112 énergie »
  (Claude).

## Équilibrage

- **Cible** : une heure de jeu en prison ≈ **50 % de la part d'un joueur dans une mine à 3** de même stuff, en pods
  rapportés. Repère du 29/10 : session à 3 ≈ 4 100 pods de coffre, soit ≈ 1 380 par joueur → **≈ 690 pods par heure
  de jeu** en prison.
- Réglage par `npm run simulate:prison` (nouveau script) : rendement par heure de jeu, durée moyenne d'un run, runs
  par heure, énergie par heure, pour plusieurs stuffs et areas max ; la taille reste 25 × 25, c'est la part de
  minerais (`PRISON.oreMul`) qui est réglée pour tomber sur la cible.
- Énergie : à 8 par heure de jeu en prison et 9 en moyenne par session, un joueur qui alterne tient ≈ 11 sessions de
  mine par jour (≈ 22 en beta, vitesse ×2) ; en partant de 100, ≈ 11 sessions d'affilée.

## Technique

### Simulation (`src/sim/prison.js`)

- Un run = une partie de mine (`newSession`) avec des options `prison` : une area de 25 lignes générée avec la
  composition de `areaMax` (part des minerais × `oreMul` ; la génération prend l'area à copier en paramètre, son
  numéro de profondeur reste 0 ; donjon et pièges tirés dans la largeur et la hauteur de la prison), colonnes de barreaux,
  `treasureMul`, `rareMul`, pas de k hole, pas de shrines, pas de Gallianix, pas d'autre area à débloquer, **pas de
  fin à l'heure** (`SESSION_LEN` ignoré ; l'IA ne voit pas de « fin de session » à l'heure).
- `G.resetGoal` (minerais à miner) ; quand il est atteint, l'IA reçoit la fin de run (même chemin que la fin de session,
  `m.reason = 'fin de run'`). Fin du run (`G.over`, `G.summary` avec coffre, XP, temps de jeu) quand le mineur est à
  la surface et a déposé, ou à `runMax`.
- Graine d'un run : `seed de la prison + numéro du run` (hasard « live » à part, comme la mine). Un run se rejoue à
  l'identique depuis son début (mêmes options figées au lancement de la prison).

### Serveur

- **Mode** `prison` dans `MINE_MODES` (solo). Enregistrement de prison (ns `prison`, clé = compte) : `{ id, seed,
  specs figées (stuff, skills, sorts, anneaux, préférences, areaMax), run, runStartedAt, ticks du run, lastSeenAt,
  state: running | waiting | done, credited:[clés], totaux pour le bilan }`.
- **Rythme** (dans la boucle `pump` actuelle, après les sessions) :
  - joueur présent (vue demandée récemment) : le run avance au rythme normal, comme une session ;
  - joueur absent : toutes les `PRISON.batchMs` (10 min réelles), un **paquet** joue le retard d'un coup, au plus vite
    (≈ ×300), sans dépasser `lastSeenAt + 24 h` ; les paquets passent **après** les vraies sessions (budget de calcul
    `perPump`), une prison en retard n'est jamais un problème ;
  - au retour du joueur : le retard restant (≤ 10 min réelles) est joué avant d'envoyer la vue (2 à 4 s au plus).
- **Fil de calcul** : celui des sessions (`server/game/live.js`). Fermé quand la prison est à jour et le joueur absent ;
  le paquet suivant rejoue le run en cours depuis son début (coût borné par la durée d'un run).
- **Fin de run** : coffre versé par `creditSession(inv, 'prison:<id>:<run>', coffre)`, XP par `creditXp` (même clé),
  énergie (même clé) ; idempotent : un run rejoué après un redémarrage ne verse rien deux fois. Puis run + 1.
- **Arrêt** (`POST /api/game/prison/stop`, ou lancement d'une mine / tour / instance) : le run en cours est arrêté au
  tick atteint, son coffre (pas le sac) et son énergie versés, `state: done`.
- **Énergie** (ns `energy`, clé = compte : `{ value, credited:[clés récentes], spent:[sessions récentes] }`) : au
  lancement d'une mine, sous le verrou de chaque joueur : coût tiré (`random` du serveur), refus si < 6, débit ; clé =
  id de session (un lancement rejoué ne débite pas deux fois). La valeur est gardée au dixième (la recharge est au
  prorata du temps de jeu) et affichée arrondie à l'entier (Claude).
- **Area max** : nouvelle valeur `areaMax` dans la progression du compte (`progress`), mise à jour à la fin de chaque
  mine classique (areas débloquées de la session, pour chaque joueur présent) ; à la mise en ligne, rattrapée depuis
  l'historique `session_stat` (gardé sans limite). La prison la lit à son lancement.
- **Présence** : `lastSeenAt` mis à jour par les demandes du jeu ouvert (celles qui marquent déjà « en ligne »,
  `SOCIAL`).

### Navigateur

- Vue de la prison = vue de la mine (`src/shared/view.js`) avec `mode: 'prison'`, `run`, `resetGoal`, `mined`,
  `energy`, `waitAt`. Rendu de la mine (`src/render/canvas.js`) + texture des barreaux.
- Barre du haut : jauge d'énergie, bouton « Sortir de prison » (et « Prison » pendant qu'elle tourne, pour la voir).
- Lobby : choix « Prison », coût d'énergie au lancement, refus nommé.

## Anti-triche

- Énergie : jamais négative, jamais au-dessus de 100, débitée par le serveur seul (le navigateur ne choisit ni le coût
  ni la recharge) ; un lancement refusé ne débite rien ; deux lancements simultanés ne passent pas avec une seule
  dose d'énergie (verrou par compte).
- Prison : un run versé une seule fois (clé de run), même rejoué ; une prison par compte ; l'arrêt rejoué ne verse rien
  deux fois ; le plafond de 24 h est calculé par le serveur (`lastSeenAt` serveur).
- Tests dans `tests/anticheat/` (énergie, versements de prison).

## Tests

- `tests/prison-sim.test.js` : carte (barreaux, une area de la composition de areaMax), fin de run à 80 % avec
  remontée et dépôt, `runMax`, treasures et chances rares × 0,5, pas de k hole ni shrine ni Gallianix, run rejoué à
  l'identique.
- `tests/prison-server.test.js` : lancer / arrêter, versement à chaque run, arrêt sans le sac, mine / tour / instance qui
  terminent la prison, MI et Bloc géant qui ne la terminent pas, rattrapage hors ligne par paquets plafonné à 24 h,
  attente puis reprise au retour, redémarrage du serveur au milieu d'un run.
- `tests/energy.test.js` : départ à 100, coût 6 à 12, refus sous 6 (nom du joueur), groupe, recharge 8 par heure de
  jeu plafonnée à 100, aucun débit hors mine classique.
- Simulation : `npm run simulate:prison` (réglage de la cible) ; `npm run simulate -- --miners 3 --count 5` (la mine ne
  change pas).

## Hors périmètre (pour l'instant)

- Coût d'énergie des autres modes ; autres sources d'énergie ; prison à plusieurs ; améliorations propres à la prison.
