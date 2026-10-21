# Journal de debug

Ce que chaque session Claude a modifié, et **ce qui a été vérifié ou non**. À lire avant de lancer des tests ou des
simulations : si quelque chose casse, on sait d'où ça peut venir. (Le résumé lisible par toute l'équipe, lui, est
dans `docs/journal.md`.)

Règles (voir CLAUDE.md) :
- une entrée par modification, ajoutée **à la fin du jour concerné**, la plus récente en bas ;
- toujours dire l'état de vérification : ✅ vérifié (avec les chiffres), ⚠️ non vérifié, ❌ cassé connu ;
- quand une session vérifie ou corrige une entrée plus ancienne, elle met à jour son état (sans effacer l'historique).

---

## 2026-10-20

### Mob gobelin (area 3+) — commit `b70323f`
- **Quoi** : nouveau mob « gobelin » à partir de l'area 3 (25 % des apparitions de bestioles). Il tacle et vole un
  minerai toutes les 2 s, le minerai est perdu. Il laisse une peau de gobelin et de la chitine.
- **Fichiers** : `src/sim/mobs.js`, `src/sim/actions.js`, `src/sim/ai.js`, `src/sim/miner.js`, `src/sim/session.js`,
  `src/config.js` (`MOBS.goblin*`), `src/ui/hud.js`, `src/render/canvas.js`, texture `goblin.png`.
- **Tests** : `tests/goblin.test.js`, `tests/anticheat/duplication.test.js`.
- **Vérification** : ✅ vérifié par la session du four, avec le Node intégré à VS Code (v24) :
  `ELECTRON_RUN_AS_NODE=1 /snap/code/current/usr/share/code/code`. `tests/goblin.test.js` et la suite anti-triche
  passent. Simulation 3 mineurs × 5 sessions : `volés` vaut de 0 à 6 par mineur, 0 session bloquée, 4 areas en moyenne.
- **Équilibrage** : le vol pèse peu (environ 1 % du minerai). Pistes : plus de PV, ou une part plus grande des apparitions.

### Ouverture des Treasure T1 depuis l'inventaire — commit `e12c591`
- **Quoi** : un Treasure T1 s'ouvre dans l'onglet Inventaire, et le serveur tire le butin. Toujours : Blueprint parts
  5–15, charbon 100–150, fer 50–80. Plus un tirage par famille : blueprints (9 × 1 %) et gemmes (3 × 1 %). La demande
  est rejouable sans duplication (`opId`).
- **Fichiers** : `src/meta/loot.js` (nouveau), `src/meta/inventory.js`, `src/config.js` (`LOOT`, `ITEMS`),
  `server/game/service.js` (`open`), `server/game/routes.js` (`POST /api/game/open`), `src/net/api.js`, `src/main.js`,
  `src/ui/inventory.js`, `src/ui/style.css`, `index.html`, nouvelles textures (blueprint, bp_parts, gemmes).
- **Tests** : `tests/loot.test.js`, `tests/anticheat/open.test.js`.
- **Vérification** : ✅ `tests/loot.test.js` et `tests/anticheat/` (dont `open.test.js`) passent (session du four).
- ❌ **Cassé connu** : le test « fin à l'heure : rejeu, part versée… » de `tests/game-service.test.js` échoue depuis
  ce commit. Il utilise `TREASURE.item`, qui n'existe plus (les treasures sont en tiers `TREASURE.tiers`). Le test
  est à corriger, le code du jeu n'est pas en cause.
  → ✅ **corrigé** : le test utilise maintenant `TREASURE.tiers[0].item`. `tests/game-service.test.js` : 23/23.

### Focus minerai (pendant la session) — commit `59e0737`
- **Quoi** : panneau « Focus minerai » dans l'onglet Mine, pendant la session. Modes Aucun / Cibler / Uniquement par
  minerai. Il ne propose que les minerais des areas débloquées. Règles complètes dans GAME_DESIGN §3 « Focus minerai ».
  - Cibler : poids = `FOCUS.valFactor` × la plus grosse valeur de minerai (2 × 8 = 16).
  - Uniquement : les autres minerais sont ignorés, et cela écrase « Cibler ». Les treasures restent visés.
  - Moins de 20 % (`FOCUS.minLeft`) du minerai visé dans l'area du mineur : il part vers l'area débloquée la plus
    proche qui en a encore (à égalité, celle du dessous). Il ne descend pas dans une area épuisée : il explore la
    sienne en galeries.
  - Sous le seuil dans toutes les areas débloquées : ce focus saute, avec un message dans le panneau
    (`m.focusNotice`) et dans le journal.
  - Comptage : `G.areas[k].ores[clé] = { total, left }`, décrémenté quand un minerai est miné ou qu'un mimic est vaincu.
  - Serveur : `POST /api/game/focus`. Il enregistre `{account, tick, focus}` dans `rec.focus` (ticks croissants,
    500 changements max, focus nettoyé) et le rejoue (`applyDueFocus`). En jeu normal, le changement prend effet au
    tick serveur + `FOCUS.delayTicks` (20).
- **Fichiers** : `src/sim/focus.js` et `src/ui/focus.js` (nouveaux) ; modifiés : `src/sim/ai.js` (`changeArea`,
  `focusStop`, `digDown` extrait, `explore(G,m,k)` prend l'area), `src/sim/world.js` (`ores`, `oreKey`,
  `oreRemoved`), `src/sim/actions.js`, `src/sim/miner.js` (`prefs.focus`, `focusNotice`, `exploreArea`),
  `src/shared/game.js` (`applyDueFocus`, `applyDueEvents`), `server/game/service.js` et `routes.js`,
  `src/net/api.js`, `src/main.js`, `index.html`, `src/ui/style.css`, `src/config.js` (`FOCUS`), `GAME_DESIGN.md`,
  `scripts/simulate.js` (option `--focus coal:only`).
- **Tests** : `tests/focus.test.js` (nouveau) et 4 tests ajoutés à la fin de `tests/game-service.test.js`.
- **Vérification** : ⚠️ **partielle** : `tests/focus.test.js` et les 4 tests focus de `tests/game-service.test.js`
  passent (session du four, après la fusion). Simulation sans focus identique à avant (point 2 ✅). Pas encore
  lancés : `game-replay`, `session`, ni les simulations avec `--focus` (point 3).
- **À vérifier** :
  1. `node --test tests/focus.test.js tests/game-service.test.js tests/game-replay.test.js tests/session.test.js`
  2. `npm run simulate -- --count 5` : les chiffres doivent être **identiques à avant** (sans focus, rien ne doit
     changer). Pour comparer : `git stash`, lancer avec `--json`, `git stash pop`, relancer, comparer.
  3. `npm run simulate -- --count 5 --focus coal:only`, puis `--focus iron:target` : pas de « ⚠ BLOQUÉ », coffre
     orienté vers le minerai visé.
- **Points fragiles connus** :
  - Le test « son area est épuisée : il remonte… » dépend du terrain de la seed 2. S'il échoue, regarder d'abord
    s'il est tombé dans une poche de vide (toléré à 10 %) avant de soupçonner l'IA.
  - Exploration d'une area non la plus profonde (`explore` avec `k` ≠ dernière area) : surveiller un éventuel
    « Plus rien à explorer » en boucle si les minerais restants sont inatteignables.
  - En jeu normal, si le réseau a plus d'environ 1 s de retard, le navigateur applique le focus après le tick
    enregistré. La partie affichée peut alors différer un peu du rejeu du serveur (c'est le serveur qui fait foi).
  - Pas de test dans `tests/anticheat/` : le focus ne crée ni ne déplace aucune ressource.

### Onglet Four — commit `75a75d5`, fusionné dans `main` par `28524ee`
- **Quoi** : fondre les minerais en lingots, hors session. Un four au départ (3 max, les fours 2 et 3 sous cadenas).
  Chaque four a 3 cases : minerai (famille `ore`), combustible (famille `combustible` = le charbon) et sortie.
  1 lingot = 10 minerais + 10 charbons. Fer 1 min, or 2 min (le diamant ne fond pas : recette retirée, commit suivant). La fonte avance en temps
  réel, même page fermée : `advance(f, now)` calcule tout depuis `since`. Les matières ne sont consommées qu'à la fin
  d'un lingot, donc retirer une case rend tout. Si la sortie contient un autre lingot, la fonte attend.
- **Familles d'objets** : `ITEMS[x].cat` = `family` du bloc si elle existe, sinon son type. Le charbon est
  `combustible` dans l'inventaire mais reste `ore` dans la mine (déblocage, IA, focus inchangés). Le gobelin lit
  maintenant le type de bloc (`ORE_W` dans `mobs.js`) : il vole toujours le charbon.
- **Serveur** : `POST /api/game/furnace` `{action: load|unload|collect, furnace, slot, item, qty, opId}`. Il prend
  le verrou de l'inventaire, écrit inventaire + fours en une seule fois (`store.putInventoryAndFurnaces`) et
  n'applique qu'une fois une demande rejouée (`opId`). `state()` renvoie `furnaces: {list, max, now}`.
- **Fichiers** : `src/meta/furnace.js` et `src/ui/furnace.js` (nouveaux), `src/config.js` (`FURNACE`, `family`,
  lingots), `server/game/{service,routes,store}.js`, `src/net/api.js`, `src/main.js`, `src/ui/{nav,inventory}.js`,
  `src/ui/style.css`, `index.html`, `src/sim/mobs.js`, textures `ingot_*`, `GAME_DESIGN.md` §6 « Four ».
- **Tests** : `tests/furnace.test.js`, `tests/anticheat/furnace.test.js`, 3 tests « four » dans `tests/game-service.test.js`.
- **Vérification** : ✅ après la fusion, 101/102 sur furnace, goblin, focus, inventory, nav, game-service, game-http,
  loot et treasure (le seul échec est « fin à l'heure », ❌ ci-dessus). Anti-triche 34/34. API testée de bout en bout
  sur un vrai serveur (poser, rejouer, refus, retirer). Simulation 3 mineurs × 5 sessions après la fusion (four + focus) : areas 4,0 · profondeur 196,2 ·
  allers-retours 26,8 · 0 bloquée. **Identique à avant le focus et le four**, au chiffre près.
- **Pas vérifié** : ⚠️ l'onglet n'a pas été regardé dans un navigateur (les modules se chargent sans erreur).

### Lobby partagé et invitations (onglet Mine + onglet Social) — commit `ae9ba67`
- ❌ **Retiré** (commit `3ca4c1f`, revert) : une session cloud avait fait en parallèle les **Groupes** (GitHub,
  `725087b` + `895ce18`). Le créateur a choisi de garder les Groupes ; cette entrée reste pour l'historique.
- **Quoi** : vérifié d'abord que la création de compte marche et s'enregistre (`data/accounts.json`, pseudo unique
  sans casse ni accents, reconnexion après redémarrage). Puis lobby partagé : clic sur une place libre, saisie d'un
  pseudo ou d'un ID, invitation dans l'onglet Social (pastille rouge), Rejoindre / Refuser. Lobby synchronisé toutes
  les 2 s (`LOBBY.pollMs`). Seul l'hôte lance, avec tous les membres, et chaque membre entre seul dans la session
  (`inSession` → `refresh()`). Si l'hôte part (ou n'est plus vu depuis 3 min, `LOBBY_SERVER.idle`), le plus ancien
  membre prend la main. Une invitation dure jusqu'au lancement.
- **Fichiers** : `server/lobby/service.js` et `routes.js` (nouveaux, lobbies **en mémoire**) ; `server/app.js`
  (option `lobby`, qui remplace `POST /api/game/start`) ; `server/main.js` ; `server/config.js` (`LOBBY_SERVER`) ;
  `server/game/service.js` (`start(me, body, group)`, `hasActive`, code `member_busy`) ; `src/config.js` (`LOBBY`) ;
  `src/net/api.js` (`lobbyApi`) ; `src/ui/lobby.js` (places, champ d'invitation, hôte, Quitter le lobby, erreur qui
  ne s'efface plus à chaque relecture) ; `src/ui/social.js` (nouveau) ; `src/ui/nav.js` (Social prêt) ;
  `src/main.js` (relecture, pastille, entrée auto) ; `index.html` ; `src/ui/style.css` ; GAME_DESIGN §6 ;
  `docs/comptes.md` ; CLAUDE.md.
- **Tests** : `tests/lobby.test.js` (13), `tests/anticheat/lobby.test.js` (5).
- **Vérification** : ✅ `lobby`, `anticheat/lobby`, `game-service`, `game-http`, `nav` : 51/51 ; toute la suite
  anti-triche : 39/39. ✅ De bout en bout sur un vrai serveur (deux comptes, cookies séparés) : invitation par
  « leo » → notif chez Léo → il rejoint → les deux voient le même lobby → Léo ne peut pas lancer → Zoe lance →
  `inSession:true` chez Léo, session à 2 joueurs. ⚠️ **Interface non testée dans un navigateur** (syntaxe vérifiée
  seulement) : champ d'invitation, pastille rouge, bascule automatique dans la mine du membre.
- **À vérifier** : `npm start`, deux navigateurs (ou une fenêtre privée), deux comptes, puis le parcours complet.
- **Points fragiles** :
  - Lobbies en mémoire : un redémarrage du serveur les vide (invitations comprises). C'est voulu, mais à savoir.
  - Onglet en arrière-plan : les navigateurs ralentissent les minuteries (Chrome ~1/min après 5 min). Un membre
    reste dans le lobby tant qu'il est relu au moins toutes les 3 min.
  - La relecture du lobby redessine les préférences toutes les 2 s (sans effet visible connu).

### Focus area (pendant la session) — commit « Focus area : choisir l'area où travaille le mineur »
- **Quoi** : panneau « Focus area » dans l'onglet Mine. Choix : « Plus profond » (par défaut) ou une area débloquée
  (0, 1, 2…). Le mineur rejoint cette area, y reste, et ne vise que les cibles de cette area. Le focus area décide
  **où** il va, le focus minerai **ce qu'il vise** (il ne cherche alors que dans cette area). Sous 20 %
  (`FOCUS.minLeft`) de tous les minerais de l'area choisie, le focus area saute et repasse en « Plus profond », avec
  un message dans le panneau (`focusNotice.kind = 'area'`).
  - Même enregistrement que le focus minerai : une clé `area` dans l'objet focus (`sanitizeFocus` : entier de 0 à
    `FOCUS.maxArea`). Aucune nouvelle route serveur.
  - Correctif d'oscillation à la frontière : un mineur qui suit une cible de l'area visée n'est plus rappelé quand
    son chemin passe par la ligne de l'area voisine (`onTheWay` dans `decideWork`).
- **Fichiers** : `src/sim/focus.js` (`focusArea`, `areaOreLeft`, `areaDepleted`, `dropDepleted`, `focusGoal`),
  `src/sim/ai.js` (filtre des cibles, `focusStop`, `onTheWay`), `src/ui/focus.js` (panneau area, message par
  panneau), `index.html` (`focusAreaCard`), `src/ui/style.css`, `src/config.js` (`FOCUS.maxArea`),
  `scripts/simulate.js` (`--focus area:1`), `GAME_DESIGN.md` §3 « Focus area ».
- **Tests** : 7 tests « focus d'area » dans `tests/focus.test.js`.
- **Vérification** : ✅ 59/59 sur focus, game-service, game-replay et session (Node de VS Code). Simulation 3 mineurs ×
  5 sessions : sans focus, **identique à avant** (areas 4,0 · profondeur 196,2 · allers-retours 26,8 · 0 bloquée) ;
  `--focus area:1` : areas 4,0 · profondeur 191,8 · 0 bloquée (avant le correctif `onTheWay` : 1 bloquée, seed
  23757, oscillation lignes 51/52).
- **Pas vérifié** : ⚠️ le panneau n'a pas été regardé dans un navigateur ; `--focus area:1,coal:only` pas simulé.
- **Point fragile** : le focus d'area 0 saute vite (3 mineurs vident l'area 0 en ~25 min), c'est voulu.

### Fusion avec GitHub (groupes, PostgreSQL/Render, stats) — commit `90b9b5b`
- **Quoi** : `main` local (gobelin, treasures, focus minerai + area, four) fusionné avec `origin/main` (groupes,
  stockage PostgreSQL/Neon, déploiement Render, `climbSpeed`, valeur des stats en x). Le lobby partagé local a été
  retiré avant (voir ci-dessus).
- **Conflits réglés** : `CLAUDE.md` (structure : les deux), `src/main.js` (`applyDueEvents` = départs + focus, avec le
  rattrapage `catchUp` des groupes), `tests/game-service.test.js` (même correctif `T1` des deux côtés).
- **Bug de fusion corrigé** : `putInventoryAndFurnaces` appelait `changed()` sans changements. Sur PostgreSQL, rien
  n'était écrit, et le four aurait été perdu en ligne. Il écrit maintenant les lignes `inventory` et `furnace`, en
  **une seule requête** (`apply` de `server/db/postgres.js` : un INSERT multi-lignes, tout ou rien). `furnace` est
  aussi relu au démarrage. Tests ajoutés dans `tests/postgres.test.js`.
- **Vérification** : ✅ 166/166 (game-service, game-http, game-replay, party, lobby, postgres, proxy, furnace, focus,
  goblin, inventory, nav, loot, treasure, miner). Anti-triche 40/40. Simulation 3 mineurs × 5 sessions : areas 4,0 · profondeur 196,2 · allers-retours 26,8 · 0 bloquée (identique à avant).
- **Pas vérifié** : ⚠️ rien n'a été regardé dans un navigateur ; pas testé contre une vraie base PostgreSQL
  (seulement la fausse base des tests).

### Bug : la session ne se terminait pas (jeu normal) — non commité
- **Symptôme** : arrivée à 60:00, la session restait bloquée (« fin dans 00:00 »), sans bilan ni versement visible.
- **Cause** : `tick()` additionnait `G.t += 0,1`. Après les 36 000 ticks, `G.t` valait 3599,9999999978 < 3600 : la
  condition de fin `G.t >= SESSION_LEN` restait fausse. En jeu normal, le navigateur s'arrête au dernier tick
  (`tickAt` plafonné à `TOTAL_TICKS`) : la partie n'était jamais finie, et le serveur jamais prévenu. En mode dev et
  sur le serveur, la boucle allait jusqu'au tick 36 001, d'où un bug invisible là.
- **Correction** (`src/sim/session.js`) : fin au compteur, `G.ticks >= SESSION_TICKS`, et temps recalculé
  `G.t = G.ticks*DT` (aucune dérive). `TOTAL_TICKS` (`src/shared/game.js`) = `SESSION_TICKS`. Conséquence : une session
  dure exactement 36 000 ticks partout (avant : 36 001 au serveur).
- **Tests** : `tests/session.test.js`, « fin de session : exactement au dernier tick… ».
- **Vérification** : ✅ calcul direct du bug (3599,9999999978 après 36 000 ticks) ; 99/99 sur session, game-replay,
  game-service, focus et anticheat ; simulation 3 mineurs × 5 sessions **identique** avant et après (areas 4,0 ·
  profondeur 196,2 · allers-retours 26,8 · 0 bloquée). Fin de session réelle en jeu normal (30 min) pas rejouée dans un
  navigateur.
- **Point fragile** : un départ ou un focus enregistré au tick 36 000 exactement n'est plus appliqué (la session est
  déjà finie). Sans effet sur les parts : le serveur ignore de toute façon un joueur parti au versement.

### Craft, Stuff et pioche en pierre — branche `craft`
- **Quoi** : onglet Craft (icônes des recettes, recette en x/besoin, bouton grisé s'il manque un ingrédient) et onglet
  Stuff (10 cases ; un clic liste les pièces de l'inventaire qui y vont). Premier objet : **Pioche en pierre** =
  30 lingots de fer (débloquée de base). Une pièce équipée quitte l'inventaire. **Aucun effet en session pour l'instant.**
- **Recettes** : `src/recipes.js` (fichier séparé). Pièces et cases : `STUFF` dans `src/config.js`.
- **Serveur** : `POST /api/game/craft` `{item, opId}` et `POST /api/game/stuff` `{action: equip|unequip, slot, uid, opId}`,
  sous le verrou de l'inventaire. Demandes rejouables sans effet (`inv.crafted`, `stuff.ops`). Inventaire + stuff
  écrits ensemble (`putInventoryAndStuff`, ns `stuff` dans PostgreSQL, une seule requête). `state()` renvoie `stuff`.
  Une pièce portée garde son uid ; la relecture (`sanitizeStuff`) retire du stuff une pièce aussi présente dans
  l'inventaire et garde `nextUid` au-dessus de tous les uid.
- **Fichiers** : `src/recipes.js`, `src/meta/{craft,stuff}.js`, `src/ui/{craft,stuff}.js` (nouveaux) ; `src/config.js`,
  `src/meta/inventory.js` (`takePiece`, `putPiece`, `crafted`), `server/game/{service,routes,store}.js`,
  `server/db/postgres.js` (commentaire), `src/net/api.js`, `src/main.js`, `src/ui/nav.js`, `src/ui/style.css`,
  `index.html`, texture `pickaxe_stone`, `GAME_DESIGN.md`, `CLAUDE.md`.
- **Tests** : `tests/craft.test.js`, `tests/stuff.test.js`, `tests/anticheat/craft.test.js`, 1 test dans
  `game-service.test.js`, 1 dans `postgres.test.js`.
- **Vérification** : ✅ 122/122 (craft, stuff, game-service, postgres, inventory, nav, furnace + toute la suite
  anti-triche). API testée de bout en bout sur un serveur temporaire (craft, double clic, manque, équiper, relecture).
- **Pas vérifié** : ⚠️ les onglets n'ont pas été regardés dans un navigateur. Pas de simulation : la mine n'est pas touchée.

### Pièces en chitine (craft + stuff) — commit « Craft : casque, plastron, jambes et bottes en chitine »
- **Quoi** : 4 pièces d'équipement et leurs recettes (onglet Craft) : Casque (5 lingots de fer + 70 chitine,
  Oxygène +30), Plastron (8 + 30, Pods +25), Jambes (7 + 30, Vitesse échelle +0,4), Bottes (4 + 70, Vitesse
  marche +0,5). Les bonus sont rangés dans `STUFF.items[…].stats` (clés de `STATS` : oxygenMax, pods, climbSpeed,
  speed), et sont **affichés** (Craft, Stuff, Inventaire) via `statsText`, mais **pas appliqués en session**.
- **Fichiers** : `src/recipes.js`, `src/config.js` (`STUFF.items`, `STUFF.statLabels`, `ITEMS[…].stats`,
  `TEXTURES`), `src/meta/stuff.js` (`statsText`), `src/ui/{craft,stuff,inventory}.js`, `src/ui/style.css`,
  `scripts/gen_textures.py` + 4 textures `*_chitin.png`, `GAME_DESIGN.md` §6 Craft / Stuff.
- **Tests** : 1 test dans `tests/craft.test.js`, 1 dans `tests/stuff.test.js`.
- **Vérification** : ✅ craft + stuff 13/13, anti-triche craft 1/1 (Node de VS Code). Pas de simulation : la
  simulation n'est pas touchée.
- **Pas vérifié** : ⚠️ les onglets n'ont pas été regardés dans un navigateur.

### Une seule partie, sur le serveur — branche `serveur-live`
- **Pourquoi** : deux joueurs d'un même groupe voyaient des coffres différents (seed 1823878970, focus changé par l'un
  d'eux). Chaque navigateur calculait sa propre copie et ne recevait pas les focus des autres ; le serveur rejouait
  tout à la fin (lent : ~10 min sur Render gratuit). Décision du créateur : une seule copie, sur le serveur.
- **Quoi** :
  1. `941caba` : file de priorité des itinéraires sans tableaux temporaires (parties identiques au caractère près,
     vérifié en `--json` sur 5 sessions ; ~×1,2).
  2. `0b643be` : le serveur fait tourner chaque session en direct (`server/game/live.js`, `live-game.js`,
     `live-worker.js` : un fil d'exécution par partie). `pump` (toutes les 200 ms) la fait avancer au rythme du temps
     réel, par blocs de `maxStep` ticks. Départs et focus appliqués tout de suite, enregistrés avec leur tick
     (reconstruction identique après un redémarrage). Fin au dernier tick : partage et versement immédiats, plus de
     rejeu. Dev : horloge de session (vitesse, pause) sur le serveur (`POST /api/game/clock`). `maxLive` (2 sur Render).
  3. Diffusion : `src/shared/view.js` (`createViewer` côté serveur, `applyView` côté navigateur), route
     `GET /api/game/view?since=tick` : la carte entière la première fois, puis les cases changées ; mineurs, mobs,
     coffre, areas à chaque envoi ; lumière recalculée par le navigateur. `src/main.js` ne simule plus rien : il
     interroge toutes les 250 ms (1,5 s onglet caché) et lisse les actions entre deux envois.
- **Supprimé** : `server/game/replay*.js`, `GAME.leaveNotice`, `FOCUS.delayTicks`, le rattrapage (`catchUp`,
  `syncLeaves`) du navigateur.
- **Tests** : `tests/live.test.js`, `tests/view.test.js` (copies identiques à la partie du serveur : navigateur
  rapide, lent, arrivé en route ; envoi moyen ~2,8 Ko au rythme normal), faux gestionnaire `fakeLive` dans
  `tests/helpers.js` (game-service, game-http, party, anticheat adaptés). Anti-triche : fin signalée 3 fois en même
  temps (une seule fin, la partie n'est pas relancée), serveur plein, horloge dev refusée en jeu normal.
- **Vérification** : ✅ tests liés et anti-triche (voir le commit). Serveur réel en dev par HTTP : affichage en 89 ms
  en moyenne (max 253), focus appliqué tout de suite, fin libre en 21 s, coffre versé = coffre de la partie.
- **Pas vérifié** : ⚠️ pas regardé dans un navigateur (rendu, lissage, groupes à 3 en vrai) ; pas mesuré sur Render.
- **Points fragiles** : Render gratuit (0,1 CPU) : ~37 % du processeur par session ; serveur endormi si tout le monde
  ferme la page (la session rattrape au réveil). Mode dev à ×300 : la partie va aussi vite que le serveur peut.

### Bulle d'info des pièces de stuff + stats du mineur — commit « Stuff : bulle d'info des effets et stats du mineur »
- **Quoi** : survoler une pièce de stuff (ou la toucher sur mobile) dans l'Inventaire, le Craft ou le Stuff affiche
  une bulle : le nom, puis un effet par ligne. La Pioche en pierre reçoit son effet : Vitesse de minage +0,1
  (`stats:{ mineSpeed:0.1 }`), affiché seulement, comme les autres bonus (pas encore appliqué en session).
- **Fichiers** : `src/ui/tooltip.js` (nouveau : `setupTooltips`, `tipAttr`), `src/meta/stuff.js` (`statLines`,
  `stuffTip`, `minerStats`), `src/ui/{inventory,craft,stuff}.js`, `index.html` (`stuffStatsBody`) (data-tip au lieu de title pour le stuff), `src/main.js`,
  `src/ui/style.css` (`#tip`), `src/config.js` (pioche, `statLabels.mineSpeed`), `GAME_DESIGN.md` §6.
- **Stats du mineur** (onglet Stuff) : carte sous les cases, base `STATS` + bonus des pièces portées
  (`minerStats(worn)`, arrondi au centième), stats listées dans `STUFF.shownStats` (libellés `STUFF.statLabels`).
- **Tests** : `tests/stuff.test.js` (bulle, effet de la pioche, stats du mineur).
- **Vérification** : ✅ stuff + craft 15/15 ; les modules d'interface se chargent sans erreur.
- **Pas vérifié** : ⚠️ pas regardé dans un navigateur (souris ni écran tactile).
- **Point fragile** : sur mobile, toucher une case du Stuff ouvre aussi le choix des pièces (qui affiche déjà les
  effets) ; la bulle se ferme au toucher suivant.

### Niveau du mineur et XP — commit « Niveau du mineur : XP des minerais et des mobs, pot partagé, 1 point de talent par niveau »
- **Quoi** : XP gagnée en session (minerai miné : charbon 1, fer 2, or 4, diamant 7 ; mob vaincu : bestiole 5, gobelin 10,
  mimic 5), dans un **pot commun** (`G.stats.xp`) partagé à parts égales entre les présents à la fin
  (`summary.shares[].xp`, arrondi vers le bas, 0 pour qui est parti). Le serveur verse la part une seule fois par session
  (`creditXp`, mémoire des sessions comme `creditSession`). Niveau : 1000 XP pour le niveau 2, puis ×1,5 ; 1 point de
  talent par niveau (rien à dépenser encore). Affiché : carte « Mineur » du lobby, XP de la session (carte du coffre),
  XP gagnée et montée de niveau au bilan.
- **Fichiers** : `src/config.js` (`XP`), `src/meta/level.js` (nouveau : courbe, `levelOf`, `xpShare`, `creditXp`),
  `src/sim/actions.js` (`gainXp`), `src/sim/session.js` et `src/sim/miner.js` (`stats.xp`, part dans le bilan),
  `server/game/store.js` (sorte `progress`, aussi chargée depuis PostgreSQL), `server/game/service.js` (versement,
  `progress` dans `state`), `src/ui/level.js` (nouveau), `src/ui/hud.js`, `src/main.js`, `index.html`,
  `src/ui/style.css`, GAME_DESIGN §3 « Niveau et XP ».
- **Tests** : `tests/level.test.js` (8), `tests/anticheat/xp.test.js` (4).
- **Vérification** : ✅ 156/156 sur level, session, live, view, game-service, game-http, party, goblin, focus, team et
  toute la suite anti-triche. Simulation solo × 5 **identique** avant / après (areas 2,0 · profondeur 125,2 ·
  allers-retours 9,8). XP réelle par session solo : 832 · 882 · 886 · 818 · 885 (moyenne 861). Datamining à 3 mineurs
  (avant le code, mêmes valeurs) : ≈ 2220 par session, ≈ 740 par joueur. ⚠️ Interface pas regardée dans un navigateur.
- **Points fragiles** : l'XP d'un mob va au pot quel que soit le mineur qui l'achève ; `stats.xp` du mineur n'est
  qu'indicatif. Les bestioles ne sont pas plus nombreuses à 3 : moins d'XP par tête en équipe (voir GAME_DESIGN).

### Niveau et barre d'XP dans les stats du mineur (onglet Stuff) — inclus dans le commit `5d60b91` (skins)
- **Quoi** : la carte « Stats du mineur » de l'onglet Stuff affiche en tête le niveau et la barre d'XP (même rendu que
  la carte « Mineur » du lobby). La ligne d'avancement montre maintenant le **pourcentage** (arrondi vers le bas) et
  **XP / XP requise** : « 4 % · 100 / 2 250 XP » ; au dernier niveau : « Niveau max » (plus de « / 0 XP »). Le
  changement de `renderLevel` vaut aussi pour le lobby.
- **Fichiers** : `src/ui/level.js` (`renderLevel`), `src/main.js` (`setProgress` remplit `levelBody` et
  `stuffLevelBody`), `index.html` (`stuffLevelBody`), `src/ui/style.css` (`.stuffLevel`), GAME_DESIGN §3.
- **Tests** : 1 test « affichage » ajouté dans `tests/level.test.js`.
- **Vérification** : ✅ `tests/level.test.js` 9/9. ⚠️ Pas regardé dans un navigateur.
- **Point fragile** : le niveau max (200) est hors d'atteinte avec la courbe ×1,5 (l'XP maximale représentable donne
  le niveau 72) : « Niveau max » ne s'affichera jamais tant que la courbe ou `XP.maxLevel` ne changent pas.

### Pseudos et skins des mineurs
- **Quoi** : plus d'équipe Rouge / Bleu / Vert en session : chaque mineur porte le pseudo de son joueur (affiché au-dessus
  de sa tête, doré pour le mineur suivi). Même corps pour tous ; le stuff porté au lancement est dessiné dessus (chitine
  = armure rouge, calque par case) et la pioche sortie pour miner suit la pioche équipée (bois marron par défaut,
  pierre grise). `TEAM` garde ses noms pour les simulations sans joueurs (simulate.js, tests).
- **Fichiers** : `src/skins.js` et `textures/skins/*.png` (nouveaux, générés par `scripts/gen_textures.py`) ;
  `src/render/canvas.js` (`drawMiner`), `src/render/textures.js`, `src/shared/game.js` (`minerSpecs` : pseudo + look),
  `src/sim/miner.js` (`look`), `src/shared/view.js` (look envoyé), `src/meta/stuff.js` (`sanitizeLook`, `lookOf`),
  `server/game/service.js` (`rec.looks` figé au lancement), `src/ui/hud.js` (noms sans doublon), `src/config.js` (TEAM sans couleurs).
- **Tests** : `tests/skins.test.js` (textures présentes, calques, pseudos, look transmis, figé au lancement).
- **Vérification** : ✅ 153/153 (skins, view, share, team, game-service, game-replay, live, party, stuff, session,
  anti-triche). Vu dans Firefox (invisible) : armure de chitine rouge, pioche en pierre grise en train de miner, pseudo lisible.

### Serveur : 5 sessions en même temps sur Render (au lieu de 2)
- **Quoi** : `GAME_SERVER.maxLive` passe de 2 à 5 sur Render (12 en local, inchangé). `DIM_MAX_LIVE` le change toujours.
- **Fichiers** : `server/config.js`, GAME_DESIGN §6.
- **Tests** : `tests/game-service.test.js`, `tests/anticheat/server.test.js` (45/45, ils fixent leur propre maxLive).
- **Vérification** : ✅ tests liés. ⚠️ Pas mesuré sur Render.
- **Point fragile** : le budget de calcul (`tickBudget` = 45 ticks/s sur Render, toutes sessions confondues) n'a pas
  changé. Une session à x2 en demande 20 : au-delà de 2 sessions à 3 mineurs, les parties prennent du retard sur le
  temps réel (affiché « connexion… ») sur l'offre gratuite. Il faut une offre Render plus puissante (et monter
  `DIM_TICK_BUDGET`) pour que 5 sessions tournent à l'heure.

### Caméra libre dans la session + bouton « suivre » qui ne marchait qu'une fois sur deux
- **Quoi** : on peut se déplacer dans la mine pendant la session (molette, glisser souris / doigt, flèches ↑ ↓,
  PageUp / PageDown) ; la caméra ne suit plus personne, un bouton « ⌖ Suivre » (ou Début, ou un mineur de l'équipe)
  la ramène. Bornée du ciel au fond de la mine connue (`CAMERA` en config).
- **Bug « suivre un joueur »** (deux causes) : 1) la liste Équipe était redessinée toutes les 120 ms ; un clic dont
  l'appui et le relâchement tombaient sur deux versions de la liste était perdu → appui (`pointerdown`) au lieu du clic,
  et liste redessinée seulement si elle change ; 2) la caméra suivait un **rang** dans la liste : quand un joueur
  quittait, elle passait sur un autre mineur → elle suit l'**id** du mineur (`ui.follow`, `followedMiner`).
- **Fichiers** : `src/render/camera.js` (nouveau), `src/render/canvas.js`, `src/ui/{controls,hud}.js`, `src/main.js`,
  `index.html` (`cvWrap`, `followBtn`), `src/ui/style.css`, `src/config.js` (`CAMERA`), GAME_DESIGN §6.
- **Tests** : `tests/camera.test.js` (4) + view, skins : 15/15. Les modules d'interface se chargent sans erreur.
- **Vérification** : ⚠️ pas encore regardé dans un navigateur (molette, glisser, tactile).

### Le stuff s'applique en session (caractéristiques par mineur)
- **Quoi** : chaque mineur a ses caractéristiques `m.carac` = STATS + bonus des pièces portées au lancement (le même
  équipement que son apparence : `record.looks`, figé et revérifié par `sanitizeLook`). La simulation lit `m.carac`
  au lieu des STATS globales : oxygène max, vitesses (marche, échelle), minage, dégâts, pods, vision, boussole,
  torches, passerelles, découverte. `torchRadius` reste global (la lumière est celle du monde, pas d'un mineur).
  Une pièce peut aussi **remplacer** une base (`set`, pour l'épée à venir). Le HUD affiche O₂ / pods du mineur suivi
  avec son stuff (`carac` envoyé au navigateur).
- **Fichiers** : `src/meta/stuff.js` (`statsOf`, `equippedStats`, `minerStats` réécrit dessus, `statLines` avec `set`),
  `src/shared/game.js` (`minerSpecs` : `carac`), `src/sim/{miner,path,actions,ai,session}.js`, `src/shared/view.js`,
  `src/ui/hud.js`, `src/config.js` (`ITEMS[…].set`, commentaires), `index.html` (texte de l'onglet Stuff),
  GAME_DESIGN §6 Stuff, CLAUDE.md (retiré du hors périmètre).
- **Tests** : `tests/carac.test.js` (6) ; `miner.test.js` adapté (durées de base par mineur). 45/45 avec stuff, miner,
  skins, view, craft.
- **Vérification** : ✅ simulation 3 mineurs × 5 seeds **identique au caractère près** avant / après (`--json`) : le
  mineur sans stuff ne change pas. Un mineur avec plastron fait une autre partie (test).
- **Pas vérifié** : ⚠️ effet chiffré des pièces sur une session complète (à mesurer avec `npm run weights` si besoin).

### Chutes : jamais plus de 3 cases en connaissance de cause ; chute imprévue ≥ 3 = étourdi 5 s
- **Quoi** (décisions du créateur) : l'IA ne prévoit jamais une chute de plus de `CFG.maxFall` = 3 cases (itinéraires,
  creuser sous ses pieds, marcher vers un trou : passerelle si possible, sinon il refuse le pas et choisit autre chose).
  Une chute dans du vide **pas découvert** (`fallInfo(...).known` faux au début de la chute) d'au moins
  `CFG.stunFall` = 3 cases → action `stun` de `CFG.stunTime` = 5 s : il ne fait rien, un tacle ne l'interrompt pas.
  Texture `textures/stun.png` (étoiles au-dessus de la tête), `m.stats.stuns`, `G.stats.stuns`, ligne au journal.
- **Deux blocages trouvés par le détecteur et corrigés** : « Suit un filon » en boucle quand le minerai visé est juste
  sous le mineur, au-dessus d'un trou connu profond : 1) `nbrBest` ne propose plus la case du dessus comme accès ;
  2) `goOre` ne mine plus directement un voisin si ça le ferait tomber (il passe par la case d'accès).
  Repli de `digDown` : trou connu trop profond sous lui → se décale (`shiftColumn` avec condition), sinon galeries.
- **Fichiers** : `src/config.js` (`maxFall`, `stunFall`, `stunTime`, texture), `src/sim/{world,path,actions,ai,miner,session}.js`,
  `src/render/canvas.js`, `scripts/gen_textures.py` (+ `textures/stun.png`), `scripts/simulate.js` (étourdissements
  affichés), GAME_DESIGN §3 « Chutes ».
- **Tests** : `tests/fall.test.js` (11). Avec miner, session, path, team, goblin, focus, treasure, carac, live, view : 90/90.
- **Vérification** : ✅ simulation 5 sessions, 0 blocage.
  - 3 mineurs : areas 3,6 (avant 4,0), profondeur 185,8 (196,2), allers-retours 27,0 (26,8), étourdi 12,2 fois par session.
  - 1 mineur : areas 2,0 (2,0), profondeur 118,8 (125,2), allers-retours 10,0 (9,8), étourdi 6,0 fois.
- **Points fragiles** : l'itinéraire connaît le vrai terrain (même non découvert, comme avant) : il évite aussi les trous
  profonds cachés quand il PLANIFIE ; les chutes imprévues viennent surtout de creuser sous ses pieds dans une poche
  cachée, ou d'une chute de 3 prévue à travers des cases pas encore vues. ⚠️ Étoiles pas regardées dans un navigateur.

### Bug : va-et-vient sur l'échelle avec un focus minerai (seed 770973224, signalé par un joueur)
- **Symptôme** : « sur une échelle, il veut miner sur le côté, il monte et descend en boucle ; focus or, il restait sur
  la couche de l'or ». Reproduit (focus or activé à l'ouverture de l'area 3) : navette entre la ligne 151 (area 2) et
  152 (area 3). En area 3 il visait un charbon de l'area 2 ; un pas vers le haut le faisait entrer en area 2,
  « épuisée » pour l'or → `changeArea` effaçait sa cible et le renvoyait en area 3, où il revoyait le charbon.
  Le garde-fou `onTheWay` n'existait que pour le focus d'area.
- **Correction** (`src/sim/ai.js`) : avec un focus minerai, pas de cible dans une area épuisée pour ses minerais visés
  (`inFocus` lit `areaGood`) ; `onTheWay` vaut aussi pour le focus minerai.
- **Tests** : `tests/focus.test.js` « frontière entre deux areas » (échoue sans la correction : il remonte en area 0),
  23/23.
- **Vérification** : ✅ seed 770973224, focus or (`target`) : 20 va-et-vient → 0 (3 mineurs), 12 → 0 (2 mineurs).
  Simulation 3 mineurs × 5, focus charbon : **5 sessions bloquées sur 5 sans la correction → 0** (areas 3,6 → 4,0,
  profondeur 183 → 193). Sans focus, rien ne change (le code n'agit que si un focus minerai est actif).

### Four : modes Fondre / Alliage, bouton « ? » des recettes, Tainted iron
- **Quoi** : chaque four a un mode (`f.mode` : `smelt` / `alloy`), choisi par un bouton Fondre / Alliage. Alliage :
  cases `a` et `b` (deux ingrédients, n'importe quel ordre, doivent former une recette, sinon `no_recipe`) +
  combustible + sortie. Recettes dans `FURNACE.alloys` ; première : **Tainted iron = 5 lingots de fer + 20 chitine +
  50 charbons, 3 min** (décision du créateur). Changer de mode exige des cases d'ingrédients vides (`not_empty`).
  Bouton « ? » : fenêtre des recettes du mode. Un four enregistré avant (sans mode) est un four Fondre, rien de perdu.
  La logique est généralisée (`activeRecipe`, `batches`) : la fonte suit exactement les mêmes règles qu'avant.
- **Fichiers** : `src/meta/furnace.js` (réécrit), `src/config.js` (`FURNACE.alloys`, objet `Tainted iron`, texture),
  `src/ui/furnace.js`, `src/ui/style.css`, `server/game/service.js` (champ `mode`, 3 messages d'erreur),
  `scripts/gen_textures.py` + `textures/ingot_tainted.png`, GAME_DESIGN §6 Four.
- **Tests** : `tests/furnace.test.js` (+5), `tests/anticheat/furnace.test.js` (+1 : matière conservée sur 300 suites
  au hasard avec modes et quantités trafiquées), `tests/game-service.test.js` (+1 par le serveur). 67/67 avec
  postgres et game-http. Suite anti-triche complète verte avant la modification (47/47).
- **Vérification** : ✅ tests. ⚠️ Onglet Four pas regardé dans un navigateur.

### Pièces en fer, épée, ceinture ; recettes secrètes débloquées par blueprint
- **Quoi** (objets et recettes du créateur ; recette de l'épée = 10 Tainted iron, choisie par lui) : Pioche en fer
  (minage +0,2, 20 Tainted iron), Épée en fer (dégâts 11 au lieu de 5 : `set`, 10 Tainted iron), Casque (O₂ +38, 5),
  Plastron (pods +33, 8), Jambes (échelle +0,6, 7), Bottes en fer (marche +0,6 ; 4 Tainted iron + 5 peau de gobelin +
  1 lingot d'or), Ceinture en peau de gobelin (découverte +1 ; 20 peau + 20 lingots d'or). Recettes `unlock: '<nom> BP'`.
  **Blueprint** : bouton « Utiliser » dans l'Inventaire → `POST /api/game/learn` : le BP est consommé, le nom de la
  recette rejoint `inv.unlocked` (même inventaire, une seule écriture ; opId dans `inv.crafted`). Refus sans
  consommer : `known`, `no_use` (Four en fer BP, Boussole en or BP), `not_owned`. **Recettes secrètes** (demande du
  créateur) : l'onglet Craft ne montre que les recettes débloquées. L'inventaire envoyé au navigateur porte `unlocked`.
- **Apparence** : armure en fer grise, ceinture (nouveau calque, case ceinture), pioche en fer, épée sortie pour frapper
  (`toolOf`). `gen_textures.py` : pièces d'armure dessinées par matériau (chitine identique au pixel près).
- **Fichiers** : `src/recipes.js`, `src/config.js` (`STUFF.items`, `discoverMax` affiché, textures), `src/meta/{craft,inventory}.js`,
  `src/skins.js`, `src/render/canvas.js`, `src/ui/{craft,inventory}.js`, `src/main.js`, `src/net/api.js`,
  `server/game/{service,routes}.js`, `scripts/gen_textures.py` + 14 textures, GAME_DESIGN §2, §6.
- **Tests** : `tests/blueprint.test.js` (7), `tests/anticheat/craft.test.js` (+1 : 300 suites au hasard, chaque
  blueprint gardé ou transformé en UNE recette, matière conservée), `tests/game-service.test.js` (+1).
- **Vérification** : ✅ 101/101 tests liés, anti-triche complète 49/49, modules d'interface chargés sans erreur.
  ⚠️ Inventaire / Craft / nouvelles textures pas regardés dans un navigateur.
- **Points d'équilibrage à surveiller** : une pièce en fer coûte 4 à 20 Tainted iron = 20 à 100 lingots de fer +
  80 à 400 chitine (+ 200 à 1 000 charbons) ; la ceinture (+1 découverte, +50 % de la base) est probablement la pièce
  la plus forte, à mesurer avec `npm run weights`. Les blueprints sortent à 1 % chacun par Treasure T1 : très rares.

### Onglet « Table de recherche » : rechercher un blueprint (100 parts), recycler un blueprint (30 à 60 parts)
- **Quoi** (demande du créateur) : nouvel onglet Recherche, deux sous-onglets. **Recherche** : tier (seulement 1),
  case de parts (0 ou 100, un clic), « Rechercher » → un blueprint du Treasure T1 dont la recette n'est pas apprise
  (décisions du créateur : les 9 BP du T1, un BP en stock peut ressortir ; Four en fer BP et Boussole en or BP
  toujours possibles). Les BP possibles ne sont pas listés (seulement leur nombre : recettes secrètes).
  **Recycle** : un blueprint (case + choix) → détruit, rend 30 à 60 parts. Hasard du serveur (`random`).
  Mémoire `inv.research` (opId → même résultat, même après relecture ; même opId pour une autre action : refusé).
- **Fichiers** : `src/meta/research.js`, `src/ui/research.js` (nouveaux) ; `src/config.js` (`RESEARCH`),
  `src/meta/inventory.js` (`research`), `server/game/{service,routes}.js` (`POST /api/game/research`),
  `src/net/api.js`, `src/main.js`, `src/ui/nav.js`, `index.html`, `src/ui/style.css`, GAME_DESIGN §6, CLAUDE.md.
- **Tests** : `tests/research.test.js` (7), `tests/anticheat/research.test.js` (400 suites au hasard : parts =
  450 − 100 × recherches + parts rendues, blueprints = 1 + recherches − recyclages), `game-service` (+1), `nav` adapté.
  81/81 liés, anti-triche complète 50/50.
- **Vérification** : ✅ tests. ⚠️ Onglet pas regardé dans un navigateur.

### Inventaire : bouton « Équiper » sur une pièce de stuff sélectionnée
- **Quoi** (demande du créateur) : une pièce de stuff sélectionnée dans l'Inventaire a un bouton « Équiper » (avec sa
  case et la pièce qu'elle remplace). Même demande au serveur que l'onglet Stuff (`POST /api/game/stuff`, `equip`) :
  rien de nouveau côté serveur ni anti-triche. `renderInventory` prend maintenant ses actions dans un objet
  (`onOpen`, `onLearn`, `onEquip`, `worn`).
- **Fichiers** : `src/ui/inventory.js` (`equipHtml`), `src/ui/stuff.js` (`worn()`), `src/main.js`, GAME_DESIGN §6.
- **Tests** : 1 test dans `tests/stuff.test.js` ; stuff + inventory 23/23.
- **Vérification** : ✅ tests, modules chargés. ⚠️ Pas regardé dans un navigateur.

### Onglet Skills : 3 arbres (Mineur, Logisticien, Barbare), provocation, échelles posées par le logisticien
- **Quoi** (demande du créateur) : 1 point par niveau ; 3 arbres de 3 étapes (3 / 1 / 5 rangs), étape suivante =
  précédente au max, un seul arbre (les autres bloqués), reset gratuit hors session. Décisions : vitesse = marche
  seulement ; Logisticien 3 = retour + redescente (`travelling` : modes return / surface / departure, `goingDown` par
  l'existant) ; provocation = le mob ne vise plus que le barbare (`o.taunt`, `canTackle`). Ajouts du créateur pendant
  le travail : le mineur libéré par la provocation reprend son travail ; au retour, un non-logisticien laisse le
  logisticien proche (≤ 5 cases, en dessous ou à sa hauteur, en retour) poser l'échelle, au plus 4 s (`yieldLadder`).
  Effets : `m.skill` (`skillEffects`), multiplicateurs minage / dégâts dans `carac`, `buildT`, `walkBoost`, `lootOf`
  (G.rng seulement si le skill est pris), échelle de 2 (`tall_ladder`), oxygène / rush après un minerai.
- **Serveur** : skills stockés à part (ns `skills`, pas dans la progression : un versement d'XP n'écrase rien),
  revérifiés avec les points du niveau à chaque lecture ; `POST /api/game/skills` (learn / reset, opId) ; reset refusé
  en session ; figés dans `rec.skills` au lancement et revérifiés à la construction de la partie.
- **Trou trouvé par le test anti-triche et corrigé** : un nœud « __proto__ » faisait planter le calcul (500) →
  `Object.hasOwn`.
- **Fichiers** : `src/meta/skills.js`, `src/ui/skills.js` (nouveaux) ; `src/config.js` (`SKILLS`, `CFG.torchTime`),
  `src/sim/{miner,actions,ai,mobs}.js`, `src/shared/game.js`, `server/game/{service,routes,store}.js`,
  `server/db/postgres.js`, `src/net/api.js`, `src/main.js`, `src/ui/{nav,level}.js` (onglet Talents → Skills,
  « points de skill »), `index.html`, `src/ui/style.css`, `scripts/simulate.js` (`--skills mixed|<arbre>`),
  GAME_DESIGN §3 « Skills », §6, CLAUDE.md.
- **Tests** : `tests/skills.test.js` (10), `tests/anticheat/skills.test.js` (2), `game-service` (+1), `nav` adapté.
  138/138 liés, anti-triche complète 52/52.
- **Vérification** : ✅ sans skills, simulation 3 × 5 **identique au caractère près**. `--skills mixed` (3 × 5) :
  0 blocage, areas 4,0 (3,6 sans), profondeur 196,2 (185,8), étourdissements 9,4 (12,2).
  ⚠️ Onglet pas regardé dans un navigateur.

### Treuil (Logisticien, étape 2) et échelle de 2 prise en compte par l'itinéraire
- **Quoi** (demande du créateur) : l'étape 2 du Logisticien donne l'échelle de 2 ET le treuil. À chaque déblocage
  d'area, le premier logisticien qui a le skill reçoit `winchJob` (`tryUnlock`) : il remonte, mode `winch`
  (`decideWinch`) : va en x = `WINCH.x` (25), descend (par le treuil existant), creuse tout droit, pose `G.winch =
  { x, bottom }` d'un coup en arrivant au haut de la nouvelle area. Jamais étourdi pendant le chantier, peut tomber
  plus de 3 cases dans son puits (seulement en creusant tout droit : en marchant, la passerelle reste). Le puits tient
  le mineur (`supported`, `isWinch`) ; seau dans les deux sens à 0,85 × vitesse de montée (`winchT`) ; itinéraires :
  arêtes du treuil sans échelle (`baseWinchT`), nouvelle échelle à `baseLadderT` (build_time, ÷2 avec l'échelle de 2).
  Affichage : corde, poulie, seau sous le mineur (`winch_rope`, `winch_top`, `bucket`), `G.winch` envoyé au navigateur.
- **Fichiers** : `src/config.js` (`WINCH`, textures, texte du skill), `src/sim/{world,miner,path,actions,ai,session}.js`,
  `src/shared/view.js`, `src/render/canvas.js`, `scripts/gen_textures.py` (+3 textures), GAME_DESIGN §3 Skills.
- **Tests** : `tests/winch.test.js` (8). 40/40 avec skills, fall, view, skins ; 75/75 simulation.
- **Vérification** : ✅ sans skills, simulation 3 × 5 **identique au caractère près**. `--skills logisticien` (3 × 5) :
  0 blocage, areas 4,0, profondeur 207,0 (196,2 en mixed, 185,8 sans), allers-retours 31,4 (27,0). Seed 7919 : treuil
  jusqu'à la couche 202, ≈ 915 à 975 s dans le seau par mineur. ⚠️ Pas regardé dans un navigateur.
- **Points fragiles** : le seau (0,85×) est plus lent qu'une échelle déjà posée ; le gain vient des échelles évitées.
  Un mob peut tomber dans le puits (il tient comme une échelle, les mobs ne le montent pas).

### Onglet Stuff : les stats montrent aussi les bonus des skills (signalé par le créateur)
- **Symptôme** : points mis dans « vitesse de minage », la carte « Stats du mineur » ne bougeait pas. Les skills
  étaient bien appliqués en session, mais l'onglet Stuff ne les affichait pas.
- **Quoi** : un seul calcul pour la session et l'affichage : `withSkillStats` (src/meta/skills.js, stats multipliées
  par les skills : `SKILL_STATS`). `minerStats(worn, effects)` renvoie aussi `skill` ; l'onglet affiche base + stuff
  (vert) + skills (bleu). L'onglet Skills prévient l'onglet Stuff à chaque changement (`onChange` → `setSkills`).
- **Fichiers** : `src/meta/{skills,stuff}.js`, `src/shared/game.js`, `src/ui/{stuff,skills}.js`, `src/main.js`,
  `src/ui/style.css`, `index.html`, GAME_DESIGN §6 Stuff.
- **Tests** : 1 test dans `tests/skills.test.js` (même valeur que dans la partie), `stuff.test.js` adapté ; 44/44.
- **Vérification** : ✅ chaîne réelle vérifiée par script : 3 rangs de vitesse de minage appris par le serveur → figés
  dans l'enregistrement de la session → partie du serveur (`createLiveGame`) : vitesse de minage 1,06, le mineur mine
  normalement. ⚠️ Pas regardé dans un navigateur.

### Nom de domaine : https://deepmineidle.fr/ (liens d'invitation)
- **Quoi** : `SITE.url` en config ; `joinLink` construit le lien d'invitation sur cette adresse, quelle que soit
  l'adresse de la page (ex. ancienne adresse Render), sauf en local (localhost, 127.x, 192.168.x, 10.x : adresse de la
  page). Le serveur ne contenait aucune adresse du site (rien d'autre à changer). `docs/deploiement.md` : section nom
  de domaine (reconnexion, invités, relais Cloudflare → `DIM_TRUST_PROXY=2`).
- **Fichiers** : `src/config.js`, `src/shared/party.js`, `tests/party.test.js`, GAME_DESIGN §6, `docs/deploiement.md`.
- **Tests** : party, lobby, nav 25/25.
- **Vérification** : ✅ tests. ⚠️ Pas vérifié en ligne (domaine, cookie, proxy).

### Onglet Stuff : le bonus des skills affiché en multiplicateur (×1,06) et non en ajout (+0,07)
- **Remarque du créateur** : « vitesse de minage +2 % est un multiplicateur : (1 + bonus) × multiplicateur, pas +0,02 ».
  Le calcul l'était déjà ((base + stuff) × (1 + 2 % × rang), en session comme dans l'onglet) ; seul l'affichage montrait
  l'écart (+0,07), qui ressemblait à un ajout. Maintenant : « 1,27 (1 +0,2) ×1,06 ». `minerStats` renvoie `mult`.
- **Fichiers** : `src/meta/stuff.js`, `src/ui/stuff.js`, `index.html`, GAME_DESIGN §3 Skills et §6 Stuff.
- **Tests** : skills, stuff, carac 27/27 (dont (1 + 0,2) × 1,06 = 1,27 avec la pioche en fer).
- **Vérification** : ✅ tests ; calcul de la partie inchangé. ⚠️ Pas regardé dans un navigateur.

## 21/10/2026

### Shiny : 1 % des fers et ors minés tombent déjà cuits (« Shiny iron », « Shiny gold »)
- **Quoi** : `SHINY` en config (chance 0,01, minerai → shiny, poids 1). `mineBlock` tire avec `G.shinyRng` (hasard
  « live » à part, dérivé de la seed : ne décale ni les mobs ni le reste) ; le shiny remplace le minerai, le bloc compte
  toujours (déblocage, XP, skills). Journal « ✨ … », `G.stats.shiny` et `m.stats.shiny`. Objets famille ingot
  (`shiny:true`). Textures `shiny_iron`, `shiny_gold` (lingot + étincelle) ; scintillement CSS sur toute icône
  `textures/shiny_*` (inventaire, craft, four, butin), coupé si « réduire les animations ».
- **Fichiers** : `src/config.js`, `src/sim/{actions,session}.js`, `src/ui/style.css`, `scripts/gen_textures.py`,
  `textures/shiny_*.png`, GAME_DESIGN §2 (familles d'objets).
- **Tests** : `tests/shiny.test.js` (6), `tests/anticheat/shiny.test.js` (2) ; goblin, blocks, session, inventory,
  furnace, share, view, game-replay : 80/80.
- **Vérification** : ✅ simulation 3 × 5 : 0 blocage, areas 4,0, profondeur 190,0, allers-retours 27,0. Seeds 7919 et
  15838 : 6 et 7 shiny au coffre. Taux mesuré ≈ 1 % sur 20 000 fers. ⚠️ Scintillement pas regardé dans un navigateur.
- **Points fragiles** : aucun usage hors session pour l'instant (ni recette, ni four). Le gobelin ne vole pas les shiny
  (ce ne sont pas des minerais).

### Rareté des objets (commun → légendaire) : contour de case et couleur du nom
- **Quoi** : `RARITY` en config (5 raretés, couleurs, liste des inhabituels) ; `SHINY.rarity` pour tous les shiny.
  `src/meta/rarity.js` (`rarityOf`, `rarityDef` : commun par défaut, valeur inconnue → commun). `src/ui/rarity.js`
  (`rcls` classe de case, `rname` nom coloré échappé, `rlabel`, `applyRarityColors` : couleurs CSS tirées de la config).
  Appliqué : inventaire (cases, fiche + libellé, fenêtre de butin), craft, four (cases pleines, choix, recettes), stuff,
  recherche, pastilles du coffre en session, bulle du stuff. Survol / sélection d'une case = contour extérieur orange
  (le bord garde la rareté) ; objet arrivé = halo blanc ; recette prête = ✔ (le vert est pris).
- **Fichiers** : `src/config.js`, `src/meta/rarity.js`, `src/ui/{rarity,inventory,craft,furnace,stuff,research,hud,tooltip}.js`,
  `src/main.js`, `src/ui/style.css`, GAME_DESIGN (Inventaire global).
- **Tests** : `tests/rarity.test.js` (5) ; inventory, craft, stuff, research, furnace, nav, loot, blueprint, shiny : 88/88.
- **Vérification** : ✅ regardé dans Chromium headless (serveur local, inventaire de test) : inventaire (contours vert /
  gris, fiche « Shiny iron · Inhabituel » en vert), craft (coches ✔), four. ⚠️ Pas regardé : onglets Stuff et Recherche,
  pastilles en session, mobile.
- **Points fragiles** : « Boussole en or » n'existe pas encore comme objet (sa rareté est prête).

### Le groupe reste après la session (enchaîner sans se réinviter)
- **Quoi** : `launch` ne dissout plus le groupe (solo ou à plusieurs). Ménage (`sweep`, devenu asynchrone) : un membre
  silencieux n'est retiré qu'après `max(seenAt, graceUntil) + memberTimeout`, `graceUntil` = fin prévue de la session
  posée au lancement ; un membre encore en session (pause dev) compte comme vu. `state` renvoie `members[].playing`
  (encore en session) ; lobby : « en session », et le chef voit « ⏳ Le groupe finit sa session… » (pas de relance).
  Navigateur : le lobby continue d'interroger le groupe pendant le bilan (signe de vie) ; si le chef relance pendant
  le bilan, le bilan est acquitté et on passe à la session.
- **Bug évité** (trouvé par les tests) : sans `graceUntil`, sur un serveur calme personne ne fait le ménage pendant la
  session, et tous les membres étaient retirés d'un coup à la fin (30 min sans signe de vie).
- **Fichiers** : `server/party/service.js`, `src/main.js`, `src/ui/lobby.js`, GAME_DESIGN §6, `docs/comptes.md`.
- **Tests** : `tests/party.test.js` (5 nouveaux, 1 adapté), `tests/lobby.test.js` (+1) ; party, lobby, game-service 61/61 ;
  anticheat/party 6/6.
- **Vérification** : ✅ deux Chromium headless, serveur dev local : groupe à 2, lancement, fin, bilan (les deux restent
  « présents » pendant le bilan), retour au lobby avec le même groupe (A « ▶ Lancer à 2 », B « En attente du chef… »),
  relance → les deux dans la nouvelle session. ⚠️ Pas vérifié : relance pendant qu'un membre lit son bilan (testé
  seulement par la logique).
- **À regarder** : dans ce test headless, après une fin forcée par l'API (`/api/game/finish`), l'affichage de la session
  restait figé jusqu'au rechargement — **même chose avec le code d'avant**, pas lié à ce changement. À vérifier avec le
  vrai bouton de fin / la fin normale.

### Four en fer (ouvre le 2e four, ×1,25), Boussole en or (+1 ligne), Tainted gold
- **Quoi** : alliage **Tainted gold** (5 lingots d'or + 20 chitine + 50 charbon, 3 min). Recettes **Four en fer**
  (1 000 charbon + 20 Tainted iron + 5 Shiny iron, BP Four en fer) et **Boussole en or** (20 Tainted gold + 5 Shiny
  gold, BP Boussole en or) ; tous deux inhabituels avec leur BP. Four en fer : objet famille `furnace`
  (`FURNACE.unlockItems`), action de four `unlock` (consomme l'objet, ouvre le four n° 2 au tier « Four en fer »,
  speed 1,25 ; refus `already_unlocked` / `locked_before` / `not_enough` / `bad_item` sans rien consommer ; opId :
  une seule fois ; inventaire et fours écrits ensemble). Bouton « Utiliser » dans la fiche de l'inventaire ; onglet
  Four : vitesse affichée, four 2 fermé dit comment l'ouvrir. Boussole en or : stuff case boussole, stat
  `compassRows` +1 (0 de base), lue par `compassScan` (lignes y−rows à y+rows).
- **Conséquence** : le tier 1 compte maintenant **9 recettes** (avant 7) pour ouvrir la recherche tier 2, et une fois
  tout appris, la recherche tier 1 n'a plus rien à donner (`nothing_left`). Tests adaptés (blueprint, game-service,
  research, tier2, anticheat/craft) : ils prenaient le Four en fer BP comme « BP qui ne débloque rien ».
- **Fichiers** : `src/config.js`, `src/recipes.js`, `src/meta/furnace.js`, `src/sim/ai.js`, `src/ui/{inventory,furnace}.js`,
  `src/main.js`, `server/game/service.js`, `scripts/gen_textures.py` (+3 textures), GAME_DESIGN (Boussole, Craft,
  Four, Recherche, Rareté).
- **Tests** : `tests/iron-furnace-gold-compass.test.js` (7), anticheat/furnace +1 (300 suites d'unlock trafiquées) ;
  rarity, furnace, craft, stuff, research, inventory, blueprint, loot, carac, skills, skins, game-service, game-http,
  tier2 : tous verts ; anticheat craft/furnace/research 7/7.
- **Vérification** : ✅ simulation 3 × 5 identique (areas 4,0, profondeur 190,0, allers-retours 27,0, 0 blocage).
  Valeur de la Boussole en or mesurée avant (≈ +300 x, 8 sessions solo). ✅ Chromium headless : fiche « Four en fer ·
  Utiliser · ouvre le four 2 » → « ✔ Four 2 débloqué », onglet Four (four 2 « Four en fer (vitesse ×1,25) »), Stuff
  (boussole équipée, « Lignes boussole 1 (0 +1) »). ⚠️ Cadre jaune de la boussole sur 3 lignes pas regardé en session.
### Mobs : PV ×5 à ×10, table d'apparition par area, tacle à 1 case, mimics créés en jeu, Occultiste, « Aider allié »
- **Quoi** (décisions du créateur) :
  - PV = base × 1,15^(k − première area du mob), **k = area où naît le mob** (avant : dernière area débloquée).
    Bestiole 50, mimic 50, gobelin 100 (dès l'area 1), occultiste 100 (dès l'area 4). `MOBS.hpBase/minArea/hpGrowth`,
    `mobHp(type, k)` en config.
  - Type tiré dans `MOBS.spawnTable` selon l'area du mineur visé (0 : 80 % bestiole / 20 % mimic … 5 : 50 % gobelin /
    30 % occultiste / 20 % mimic). Rythme et plafond inchangés (`spawnDelay`, `walkerCap`, mimics hors plafond).
  - **Mimics** : plus placés à la génération ; une apparition « mimic » change un minerai de la roche à 5-10 cases en
    mimic caché (pas un minerai visé ou en train d'être miné). Dévoilé : `G.mimicCells`, plus une cible ni un bloc à
    creuser (`path.js` `brk`, `compassScan`, cibles connues). Il se combat, ne se mine pas, et tacle à côté.
  - **Tacle** : tous les mobs, à 1 case ou moins (Manhattan) de leur cible, un seul mineur par mob (`o.grab`, gardé tant
    qu'il reste à côté). Les mobs qui marchent s'arrêtent à côté. `tackler` déplacé dans `mobs.js` (réexporté par ai.js).
  - **Occultiste** : sort toutes les 15 s (`MOBS.occult`) → téléportation à 3 cases (case vide, où l'on tient, rejointe
    depuis la cible sans miner ; sinon 4, puis 2) puis canalisation 5 s = cible étourdie (action `stun` `hex`, même un coup
    est interrompu). Provoqué : canalisation coupée tout de suite, plus jamais de sort. Butin 1-3 Tissu sombre, XP 15
    (provisoire). Texture `occultist.png` ; rayon noir dessiné (`mobView.channel`).
  - **Provocation** : vaut pour tous les mobs (`provoke`), plus seulement ceux qui marchent.
  - **Aider allié** : `PREFS.helpAllies` + `helpIgnore` (types connus, sans doublon : `sanitizePrefs`), lobby avec la liste
    des mobs et leur dessin. `G.combat` (état « combattrigger ») = un mob a pris un mineur en chasse (`o.chase`). Le
    mineur va vers le mob le plus proche qui chasse un autre mineur, sauf types ignorés, pas en retour, pas pendant le
    chantier du treuil, **à 20 cases au plus** (`HELP.range`, ajout provisoire à faire valider, voir mesures).
  - Gants tactique : vitesse d'attaque +20 % (au lieu de +150 %).
- **Corrections trouvées en simulation** :
  - Aider allié pendant le chantier du treuil → le logisticien repartait de la surface à chaque fois : boucle.
  - Sans portée, l'aide faisait traverser la mine pour des combats déjà finis (détecteur : 2 sessions sur 5).
  - Chantier du treuil : un combat qui le sortait du puits le renvoyait à la surface recommencer ; avec des mobs 5-10×
    plus résistants ça tournait en rond. Il retourne maintenant au puits par le plus court s'il est proche
    (`m.winchDepth`), sinon comme avant.
- **Provocation vérifiée** (demande du créateur) : 5 sessions × 3 mineurs, 135 provocations, **0 tacle** d'un mob
  provoqué sur un autre mineur que le barbare. Mais avant « Aider allié », le barbare ne libérait un allié que 4 fois en
  5 sessions (il ne va pas vers les alliés).
- **Fichiers** : `src/config.js` (MOBS, mobHp, PREFS, HELP, MOB_INFO, PREF_OPTIONS, XP, Gants tactique, textures),
  `src/sim/{mobs,ai,actions,session,path,world}.js`, `src/shared/{game,view}.js`, `src/render/canvas.js`,
  `src/ui/{lobby}.js`, `src/ui/style.css`, `scripts/gen_textures.py` + `textures/occultist.png`, GAME_DESIGN §3, §5, §6, §7,
  CLAUDE.md.
- **Tests** : `tests/mobs.test.js` (14 : PV, tacle à 1 case, un mineur par mob, mimic, occultiste ×4, aide ×4, treuil),
  `goblin.test.js` (apparitions réécrites : table, PV par area, mimic), miner, skills, game-service, game-http
  (préférences), tier2. `npm test` 417/417. Anti-triche 53/54 : **skills 500 suites échoue déjà sur `main` avant ce
  travail** (« étape sans la précédente », depuis la refonte de l'arbre `2113f71`) ; `open.test` corrigé (le Treasure T2
  s'ouvre depuis ce matin).
- **Mesures** (3 mineurs × 5 seeds, 0 blocage) :
  - sans aide : areas 3,4 (4,0 avant), profondeur 183 (190), 69 mobs tués, **139 minerais volés** par session.
  - aide (portée 20) + skills mixtes : areas 3,4, profondeur 180, ≈ 122 volés.
  - aide sans portée : profondeur 158 (la portée a été ajoutée pour ça).
  - sessions boostées (minage ×7) jusqu'à l'area 5 : occultistes apparus, sort lancé, Tissu sombre au coffre, 0 blocage.
- **Vérification visuelle** : ✅ Chromium headless : scène de test (occultiste + rayon noir, mimic dévoilé, gobelin qui
  tacle) ; lobby (« Aider allié : Oui » → liste des 4 mobs avec dessin, Gobelin ignoré, relu après rechargement).
  ⚠️ Pas vu en vraie session en ligne ; étoiles d'étourdissement cachées par le pseudo (déjà le cas pour les chutes).
- **Points d'équilibrage à surveiller** : les gobelins (100 à 175 PV) restent longtemps sur un mineur de base et volent
  1 minerai / 2 s : ≈ 45 minerais volés par mineur et par session. XP des mobs inchangée malgré des PV ×5-10.

### Wiki du joueur (wiki.html, lien « 📖 Wiki du jeu » dans la barre du jeu)
- **Quoi** : page `wiki.html` servie par le jeu (`/wiki.html` ajouté à `publicPaths`). Textes écrits pour un joueur lambda
  (le jeu en bref, comment ça marche, les onglets, conseils). **Tous les chiffres sont générés depuis la config**
  (`src/wiki/data.js`, logique pure) : areas (%, minerais, seuil, treasure), blocs (dureté, temps, poids, XP), mobs (PV,
  apparitions, butin par area), objets (rareté, usages, sources, stats, recette ; recherche par texte), four (fonte,
  alliages, fours), recettes, recherche, stats (explication + ce qui les améliore), treasures (contenu), XP, niveaux,
  skills ; mobs suivant la nouvelle table d'apparition (occultiste compris, Tissu sombre = son butin). Un changement
  d'équilibrage se voit donc dans le wiki sans rien réécrire ; seuls les textes en prose
  (wiki.html) sont à relire quand une règle change.
- **Fichiers** : `wiki.html`, `src/wiki/{data,wiki}.js`, `src/wiki/wiki.css`, `server/config.js`, `index.html` + `src/ui/style.css`
  (lien), CLAUDE.md (structure).
- **Tests** : `tests/wiki.test.js` (6 : chaque objet listé avec usage et source, sources/usages, areas, mobs, stats,
  treasures, niveaux, page servie) ; nav, game-http, account-http : 27/27.
- **Vérification** : ✅ Chromium headless : aucune erreur, toutes les sections remplies, recherche « gants » → 8 lignes,
  pas de défilement horizontal sur mobile (390 px). ⚠️ Textes à faire relire par le créateur.

### Donjon (area 5, 20 %), minotaure, Cristal de pleine lune, option « Fuir »
- **Quoi** (décisions du créateur, questions posées) : `DUNGEON` en config, `src/sim/dungeon.js`. Génération en area 5
  seulement, tirage à part (`hash(seed, k+1) ^ salt`) : le reste de l'area est identique. Carré 10×10 de `DUNGEON_WALL`
  (bloc 11, incassable), intérieur vide, une entrée côté gauche ou droit sur les 3 lignes du bas de l'intérieur ;
  x0 ∈ [2, 10] ∪ [31, 38] (marge 2, jamais x 20..30 = treuil ± 5), y à 2 cases des limites d'area. Comptes de l'area
  recalculés (déblocage, focus). Minotaure : mob `o.dungeon`, 1000 PV, enfermé (`updateBoss` : ne vise que les mineurs
  dans la salle, marche sur son sol, tacle à 1 case), 100 XP, butin 1-3 cristaux (rare, `SHARE.copyToAll`).
  Déclencheur = un bloc du carré découvert (`updateDungeons`, après la découverte de chaque tick). Entrée interdite
  (`noEntry` dans `stepDir`, `forbidMask` dans `search`) sans barbare, ou avant que le barbare soit entré, ou pour
  « Fuir » ; jamais pour celui qui est déjà dedans (il doit pouvoir sortir). IA (`dungeonGoal` dans `decideWork`,
  après les raisons de remonter) : sortir si dedans sans droit ; avec barbare : barbare → combat le boss, autres →
  attendent à ≤ 2 cases de l'entrée puis entrent après lui, Fuir reprend son travail. Effroi sans barbare : 15 s,
  taclé pendant ce temps → téléporté au coffre avec son sac. Option `fightMobs: 'flee'` (Fuir = Ignorer + jamais de
  donjon) : le combat spontané ne se fait plus que si `fightMobs === true`.
- **Corrections au passage** : un bloc incassable sous les pieds (mur) faisait piétiner `digDown` → il se décale ou
  explore ; `explore` ne vise plus une galerie le long d'un mur ; `rowDone` ignore les blocs incassables (et une ligne
  absente). Détecteur de blocage : l'attente voulue devant un donjon n'est pas un blocage.
- **Fichiers** : `src/config.js`, `src/sim/{dungeon,world,mobs,ai,actions,path,session,diagnostics}.js`,
  `src/render/canvas.js`, `scripts/gen_textures.py` (+3 : dungeon_brick, minotaur, moon_crystal), wiki (section Le donjon,
  source du cristal), GAME_DESIGN §5, CLAUDE.md.
- **Tests** : `tests/dungeon.test.js` (12) ; rarity (cristal rare) ; mobs, goblin, fall, focus, winch, team, world,
  blocks, miner, light, treasure, share, lobby, view, skills 153/153 ; game-replay, game-service, live, view, session,
  wiki, anticheat duplication/xp/server 99/99 ; diagnostics 4/4.
- **Vérification** : ✅ simulation 3 × 5 identique au code d'avant (areas 3,4, profondeur 183,2, 0 blocage : les sessions
  normales n'atteignent pas l'area 5). ✅ sessions complètes jusqu'à l'area 5 (mineurs renforcés, seeds 8, 13, 14) :
  avec barbare, découvert → barbare entré (≈ 3 à 5 min plus tard : il était en train de remonter) → minotaure vaincu,
  1 à 3 cristaux au coffre ; sans barbare, personne n'entre, 0 blocage. ⚠️ Pas regardé en vrai dans le navigateur
  (aperçu reconstitué depuis la carte générée et les textures).
- **Points fragiles** : l'attente devant l'entrée peut être longue (le barbare finit d'abord son aller-retour) ; un
  mineur sans barbare qui se retrouve dans le donjon après ses 15 s d'effroi et qui se fait tacler doit vaincre seul
  1000 PV (règle du tacle) ; l'effroi ne se déclenche que par accident (entrée dans le noir avant d'avoir vu le mur).
### Onglet Concasseur
- **Quoi** : nouvel onglet entre Four et Recherche. 8 cases d'entrée (2×4) pour les objets de la nouvelle famille
  **bloc** (Terre, Pierre, Pierre dure : `family:'bloc'` dans BLOCKS, rien ne change dans la mine), 8 cases de sortie.
  Un cycle de 60 s concasse 100 blocs de la première case qui en a ≥ 100 (index 0 → 7). Butin = tables `CRUSHER.loot`
  (format LOOT, tiré par `rollLoot`) : gemmes inférieures 0,1 / 0,15 / 0,12 % chacune, treasure T1 0,01 % (terre),
  T2 0,015 % (pierre) / 0,02 % (pierre dure). « Dernières trouvailles » (10) et total de lots affichés.
- **Hasard / anti-triche** : `advance(c, now, rng)` reçoit le hasard ; le serveur avance sous le verrou de
  l'inventaire et **enregistre dès qu'un cycle est fait** (`withCrusher` dans service.js, aussi dans `state()`), donc un
  cycle n'est tiré qu'une fois. Le navigateur n'avance jamais : il redemande `GET /api/game/crusher` quand la barre est
  pleine (au plus toutes les 3 s, onglet visible). Sortie pleine : le lot n'est pas consommé (jamais atteint en
  pratique : 5 objets de sortie possibles, 8 cases).
- **Fichiers** : `src/config.js` (CRUSHER, family bloc), `src/meta/crusher.js`, `src/ui/crusher.js`, `src/ui/nav.js`,
  `src/ui/style.css`, `src/ui/inventory.js` (libellé Bloc), `src/main.js`, `src/net/api.js`, `index.html`,
  `server/game/{service,store,routes}.js`, `server/db/postgres.js` (ns `crusher`), `src/wiki/{data,wiki}.js`,
  `wiki.html`, GAME_DESIGN §2 et §6, CLAUDE.md.
- **Tests** : `tests/crusher.test.js` (13 : famille, tables, poser, ordre des cases, cycle hors ligne, butin, fréquence
  sur 200 000 lots, retirer/récupérer/opId, retrait en cours de cycle, sortie pleine, relecture trafiquée, serveur ×2),
  `tests/anticheat/crusher.test.js` (500 suites au hasard : blocs consommés = lots × 100, butin ≤ 2 par lot).
  furnace, postgres, game-service, inventory, wiki, nav (onglet ajouté), blocks : tous verts.
- **Vérification** : ✅ Chromium headless (serveur dev, compte invité avec blocs) : poser 300 pierre dure, tout
  récupérer, fenêtre « ? », cycle fini → état redemandé, mobile 390 px, wiki (tableau + sources des gemmes), 0 erreur
  console. ⚠️ Pas testé en ligne (PostgreSQL : nouveau ns `crusher`, chargé par `createPgGameStore`).
- **Point d'équilibrage** : ≈ 530 terre + 760 pierre par session à 3 (≈ 4 lots par joueur) → ≈ 1 gemme / 60 sessions
  par joueur, 1 treasure / ≈ 2 000 sessions. Signalé au créateur.

### Organisation du dépôt et méthode git (Jules) — branche `jules/organisation-repo`
- **Quoi** : CLAUDE.md réorganisé (début de discussion, git par branches `prénom/sujet`, fin de tâche, puis le
  projet) ; nouveau `docs/journal.md` (avancement, le plus récent en haut) ; `README.md` ; `.gitattributes`
  (LF partout, PNG binaires) ; `.mailmap` (`canoul` et l'adresse opensee = Geoffrey Boilay) ; fichier parasite
  `deep-idle-mine` (contenait `/root/deep-idle-mine`) supprimé ; `docs/deploiement.md` → `docs/archive/
  deploiement-render.md` (références mises à jour dans `docs/comptes.md`) ; titre de l'entrée Concasseur aligné.
- **Code** : aucun changement de code du jeu ni du serveur.
- **Tests** : aucun à lancer (documentation et réglages git). `git ls-files --eol` : tous les fichiers texte déjà en
  LF, le `.gitattributes` ne change aucun fichier.
- **Vérification** : ✅ `git shortlog -sn` regroupe bien Geoffrey (48 commits) ; liens du README vérifiés.
- **Suite** : « État actuel » déplacé de CLAUDE.md vers `claude/etat-du-projet.md` (une seule copie, lue en début
  de discussion) ; spécialisation des rôles retirée du « hors périmètre » (décision de l'équipe) ; branche distante
  `concasseur` supprimée.
- **Note** : `deploy/ovh/update.sh` redémarre le serveur à chaque changement de `main`, même doc seule. D'après
  l'équipe, ça ne casse pas les parties en cours : laissé tel quel. ⚠️ Pas vérifié par Claude.

### Ménage des textes affichés au joueur (Jules) — branche `jules/nettoyage-textes`
- **Quoi** : textes de développeur ou redondants retirés de l'interface. Aucune règle du jeu ne change.
  - `src/meta/stuff.js` `statLines` et `src/wiki/data.js` `statsOf` : une stat `set` (épées) s'affiche « Dégâts 8 »,
    sans « (au lieu de 5) ».
  - `src/ui/hud.js` : luminosité retirée de la ligne Torches ; taille de l'area (« 50×50 = 2500 blocs ») retirée ;
    `objectiveHtml` sur une ligne (« 🔒 Area N+1 : minerais de l'area N » + compteur + barre), plus de « X % » ni de
    ligne « s'ouvre à » ; bilan : plus de « (reste tiré au hasard ; Treasure… : un pour chacun) » ni de « Résultat
    vérifié par le serveur ». Imports inutiles retirés (`W`, `AREA_H`, `CFG`, `SHARE`, `curLum`).
  - `src/ui/lobby.js` : infos de session raccourcies (plus de « vitesse ×2 », « Seul, tu gardes tout le coffre ») ;
    serveur injoignable → « Serveur injoignable. Réessaie dans un instant. » (avant : « lance npm start »).
  - `index.html` : « Bientôt : fuir les mobs… aider un allié » retiré (les options existent) ; légende de Stuff
    raccourcie ; « Les valeurs sont provisoires » retiré de Skills ; sous-titre de l'Historique raccourci.
  - `src/ui/skills.js`, `src/main.js` (équiper), `src/ui/research.js` (message après recherche, l'aide reste sous la
    table), `src/ui/crusher.js` (aucune trouvaille) : phrases raccourcies.
- **Pas touché** : messages du journal de session (`src/sim/`, pour ne pas toucher à la simulation), wiki (hors
  effets des épées), seed dans le bilan et l'Historique (utile pour signaler un bug).
- **Tests** : `blueprint`, `wiki`, `world` (attendus mis à jour : « Dégâts 11 », « Area 2 »), `research`, `lobby`,
  `stuff`, `crusher`, `skills` : 78/78 verts. `node --check` sur les modules modifiés.
- **Vérification** : ⚠️ pas regardé dans le navigateur (textes seulement, aucun changement de mise en page attendu).

### Lobby et Session : deux onglets (Geoffrey) — branche `geoffrey/lobby-session`
- **Quoi** : l'onglet `mine` devient `lobby` (🏠) + `session` (⛏). `#mine` → Session, `#rejoindre=…` → Lobby, onglet
  par défaut Lobby. Lobby en lecture seule pendant une session (`launchState({session})` → « ⛏ Session en cours »,
  inviter / rejoindre / quitter / retirer / préférences / type de mine / panneau dev désactivés). Bandeau
  `#lobbySession` (temps restant mis à jour par la boucle d'affichage). Section Session : `#noSession`, `#run`, `#end`.
  Choix « Où miner » (`MINE_MODES` dans config : `mine` prêt, `mi` pas prêt) envoyé au lancement (`mode`) ; le
  serveur le vérifie (`bad_request` inconnu, `mode_not_ready` pas prêt), l'enregistre (`rec.mode`) et le renvoie dans
  la session publique (`'mine'` par défaut pour les anciennes sessions).
- **Rafraîchissement du lobby pendant la session** : `pollLobby` ne s'arrête plus quand une session tourne
  (`PARTY.pollInSession` = 5 s au lieu de 2,5 s). Il ne relance `refresh()` que si le serveur annonce une session
  **différente** de celle affichée (`st.session !== rec?.id`), puis bascule sur Session : c'est ce qui fait basculer
  les membres du groupe. Ça touche `seenAt` pendant la partie (signe de vie), sans effet sur la grâce existante.
  Un lien `#rejoindre` n'est traité qu'hors session.
- **Fichiers** : `index.html`, `src/config.js` (MINE_MODES, PARTY.pollInSession), `src/ui/{nav,lobby,style.css}`,
  `src/main.js` (`showLobby` → `showNoSession`), `server/game/service.js` (mode), `wiki.html`, GAME_DESIGN §3 et §6,
  `claude/etat-du-projet.md`.
- **Tests** : nav (onglets, `#mine`, défaut, sections Lobby / Session, bilan dans Session), lobby (Lancer pendant une
  session, `mineModes`), game-service (mode : défaut, MI refusée, types invalides, rien créé), party : 82/82.
- **Vérification** : ✅ Chrome headless piloté par CDP (deux joueurs, serveur dev, 2 contextes) : Lobby par défaut,
  MI grisée, « pas en session », lancement → A et B (qui était sur Inventaire) basculent sur Session, lobby en
  lecture seule avec bandeau et « en session » sur les places, le rafraîchissement lent ne renvoie pas sur Session,
  bilan chez les deux dans Session, lobby de nouveau utilisable pendant le bilan, « Retour au lobby », `#mine` →
  Session ; mobile 390 px ; 0 erreur console. ⚠️ Pas testé en ligne (PostgreSQL : `mode` est un champ de plus dans
  l'enregistrement de session, sérialisé comme le reste).
- **Points fragiles** : conflit attendu avec `origin/social` (`main.js`, `nav.js`). Piège pour les essais headless :
  passer de `/` à `/#onglet` ne recharge pas la page (même document), et un onglet en arrière-plan ne tourne pas sans
  `Emulation.setFocusEmulationEnabled`.

### Mine instantanée, étape 1 : règles et contenu (Geoffrey) — branche `geoffrey/mine-instantanee`
- **Quoi** : `GAME_DESIGN.md` §6 « Mine instantanée (MI) » ; `src/config.js` `INSTANT_MINE` (horaire, durée 300 s de
  jeu, 50×50, composition, plumes, 20/mine, poids de l'IA de dispersion, rappels) ; objet `Plume d'ange` (ITEMS,
  `RARITY` rare) ; textures `angel_feather` (objet) et `angel_feathers` (tas, transparent, dessiné par-dessus le
  tunnel) dans `scripts/gen_textures.py`.
- **Choix technique** : le tas de plumes n'est **pas** un bloc de `BLOCKS` (case vide + surcouche, comme échelles et
  torches) : rien ne change pour la mine normale (ITEMS, wiki, mobs parcourent `BLOCKS`).
- **Travail dans un worktree** `F:\idledollexminer-mi` : une autre discussion travaillait en même temps dans
  `F:\idledollexminer` (branche `geoffrey/retours-21-10`, modifications non commitées).
- **Tests** : `tests/instant-mine.test.js` (nouveau), `rarity` (plume ajoutée aux rares), `inventory`, `wiki` : 26/26.
- **Vérification** : ✅ textures regardées agrandies. Rien en jeu pour l'instant.

### Mine instantanée, étape 2 : simulation et IA (Geoffrey) — branche `geoffrey/mine-instantanee`
- **Quoi** : `src/sim/instant/` (séparé de la mine normale) :
  - `world.js` : `genInstantMine(seed)` (ligne 0 = surface vide, lignes 1-50 = mine ; composition **exacte** par
    mélange : 500 charbons, 1 000 fers, 975 ors, 25 tas ; `G.feathers` Map case → plumes), `spawnColumns(n)`.
  - `session.js` : `newInstant`, `tickInstant`, `leaveInstant`, `endInstant` (idempotents), `runInstant`,
    `INSTANT_TICKS` (3 000). Déplacement libre 4 directions dans les cases vides. **Ordre des mineurs dans un tick :
    celui dont l'action finit le plus tôt d'abord** (sinon le premier de la liste gagnait les blocs disputés finis
    dans le même tick), égalités en ordre tournant. Bloc fini → les autres qui le minaient perdent leur action
    (`stats.lost`, `interrupts++`) ; à `interruptMax` → `m.flee = {x, y, until}`. Shiny et Fortune par
    `shinyOf` / `fortuneExtra` de `src/sim/actions.js` (`fortuneExtra` exportée, rien d'autre ne change) ; Ruée
    (ore_rush) appliquée ; Pioche aiguisée passe par `carac.mineSpeed` comme en session.
  - `ai.js` : `plan` = parcours en largeur dans les cases vides, chaque bloc plein au bord coté
    `trajet + foule (+ takenPenalty) + hasard 0,01` ; **le temps de minage n'entre pas dans le choix** (tous les
    blocs valent pareil, sinon il préfère le charbon) ; zone fuie exclue tant qu'il existe un autre candidat.
- **Script** : `scripts/simulate-instant.js` (`npm run simulate:mi`, options `--miners`, `--count`, `--seeds`,
  `--mine-speed`, `--no-crowd`). 20 mineurs × 5 min ≈ 0,2 s de calcul.
- **Chiffres** (5 seeds) : 20 mineurs → 80 % vidée, 0 disputé, 93-110 blocs/mineur, 0 s inactif, 0 fuite ;
  `--no-crowd` → ~500 disputés, 68 % vidée, ~16 fuites ; 1 mineur → 102-110 blocs, 4 %.
- **Point de design ouvert** : un tas de plumes n'est ramassé que si le mineur **passe** sur la case (règle de
  Geoffrey : n'influe pas sur le chemin). Mesuré : seul, 5 tas atteints par une galerie / 5 seeds, 0 ramassé ; à 3,
  37 plumes laissées pour 17 ramassées.
- **Tests** : `tests/instant-mine.test.js` (13) ; `shiny`, `session`, `rarity` : 30/30. `npm run simulate -- --miners
  3 --count 2` : 0 bloquée (mine normale inchangée).
- **Vérification** : ✅ simulation. ⚠️ Pas encore de serveur ni d'affichage.
- **Suite (même jour)** : ramassage opportuniste des plumes (option b de Geoffrey) : `MI.featherReach` = 3 ; dans
  `plan`, le premier tas atteint par le parcours à ≤ 3 pas devient `m.goal` (chemin jusqu'au tas, `target` = null) ;
  `decide` abandonne `goal` si le tas a disparu (pris par un autre). Mesuré (5 seeds) : seul 0 → 19 plumes, tas
  atteints laissés 5 → 1 ; à 3 : 17 → 46, laissés 14 → 0 ; à 20 : 233 → 314. Blocs par mineur inchangés.
  Tests : 2 de plus (15/15).

### Mine instantanée, étape 3 : serveur (Geoffrey) — branche `geoffrey/mine-instantanee`
- **Principe** : une MI est une **session de sorte `kind: 'instant'`** du service de jeu (`server/game/service.js`) :
  même partie en direct (fil d'exécution), même reprise après redémarrage, même `leave` (Quitter = rien), même
  versement idempotent (`creditSession` par id de session) ; **pas d'XP** (`settleWith` saute `creditXp`), focus
  refusé (400). `publicSession` et `history` renvoient `kind`.
- **Fichiers** :
  - `src/shared/instant.js` : `localHour`, `nextSlot` / `lastSlot` (heures pleines UTC dont l'heure de Paris est
    paire ; **l'heure répétée du passage à l'heure d'hiver est écartée**, `isSlot`), `splitMines` (tailles égales),
    `instantDurationMs`, `instantSpecs` (stuff + skills comme `minerSpecs`), `buildInstant`,
    `applyDueInstantLeaves`.
  - `src/shared/instant-view.js` : envoi = carte entière à chaque fois (~2,6 Ko), plumes, mineurs, journal ;
    `applyInstantView` pour le navigateur (étape 4).
  - `server/game/live-game.js` : table `KINDS` (session / instant) ; rien ne change pour les sessions.
  - `server/game/service.js` : `openInstant(id, slot, joueurs)` (id fixe `mi-<heure>-<n>` : jamais deux fois ;
    doublons et joueurs déjà en session écartés ; `startedAt = heure d'ouverture`, `finishAt` = +150 s ; pas de
    limite `maxLive`) ; `onStart(fn)` : appelé après chaque session normale lancée.
  - `server/instant/service.js` + `routes.js` : `GET /api/instant`, `POST /api/instant/join | quit | dev-open`.
    Inscriptions en mémoire + stockage (`mi_signup`, mémoire / fichier / PostgreSQL). `tick()` (dans la boucle du
    serveur, `server/main.js`) ouvre l'heure `lastSlot(now)` si elle n'a pas été traitée ; au démarrage, une heure
    passée pendant l'arrêt avec des inscrits d'avant est rattrapée (`startedAt` = l'heure prévue).
  - `server/game/store.js`, `server/db/postgres.js` (commentaire), `server/app.js`, `server/main.js`.
- **Tests** : `tests/instant-server.test.js` (12, vraie simulation via `createInlineRunner`),
  `tests/anticheat/instant.test.js` (5). `game-service`, `live`, `game-http`, `game-replay`, `party`, `postgres`,
  `view` : 91 verts (1 ignoré : PostgreSQL absent). `npm run test:anticheat` : 62 verts, **1 rouge déjà rouge sur
  `origin/main`** : `skills : 500 suites de demandes au hasard` (« étape sans la précédente ») — pas lié au MI, ⚠️ à
  regarder par qui touche aux skills.
- **Vérification** : ✅ tests. ⚠️ Pas encore lancé dans un vrai serveur (étape 4, avec l'interface).
- **Points fragiles** : `GAME_SERVER.pumpEvery` (200 ms) fait aussi tourner `instant.tick()` ; un joueur inscrit
  puis en session au moment de l'ouverture est écarté **et désinscrit** (pas reporté à la mine suivante).

