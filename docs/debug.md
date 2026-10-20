# Journal de debug

Ce que chaque session Claude a modifié, et **ce qui a été vérifié ou non**. À lire avant de lancer des tests ou des
simulations : si quelque chose casse, on sait d'où ça peut venir.

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
