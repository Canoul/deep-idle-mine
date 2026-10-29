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

---

## 21/10/2026 — Jules — Démarrage raté : cadre d'erreur sur la page (`src/boot-check.js`)
- **Symptôme** : sur Opera GX (un joueur), page servie mais JavaScript du jeu jamais lancé : barre de gauche sans
  onglets, « Mineur » vide, « Où miner » = « . ». Reproduit à l'identique en local en bloquant un module
  (`page.route('**/src/ui/nav.js', abort)`) : un seul module du graphe qui échoue → `main.js` ne s'exécute pas.
- **Écarté** : aucun test du navigateur dans le code ; JS utilisé ≤ Chrome 98 (`structuredClone`, `Object.hasOwn`,
  `.at`) ; les 169 URL du jeu (fichiers + `/api/…`) testées contre les règles réseau EasyList + EasyPrivacy
  (téléchargées le 21/10, analyseur maison vérifié sur des cas connus) : aucune bloquée. Opera GX n'est pas installé
  sur le poste de Jules : cause réelle pas encore connue (pistes : extension, bloqueur avec d'autres listes, VPN,
  coupure pendant un redémarrage du serveur).
- **Ajout** : `src/boot-check.js`, script **classique** chargé avant `src/main.js` dans `index.html` (+ `<noscript>`).
  Écoute `error` (en capture, pour voir l'échec de chargement du `<script type=module>`) et `unhandledrejection`
  tant que `DIM_BOOT.started` n'est pas vrai (`main.js` le met après le bloc de démarrage ; ⚠️ pendant l'écran de
  connexion il n'est pas encore vrai). Échec d'un module → relit les imports depuis `main.js` (`findMissing`, fetch
  `no-store`) et liste les fichiers qui ne répondent pas. Erreur de code → message + fichier:ligne:colonne. Ignore
  les images (textures). Affiche toujours le `userAgent` (Opera : `OPR/<version>`).
- **Tests** : `tests/boot-check.test.js` (imports sur plusieurs lignes, ré-exports, `import './x.js'` ; parcours
  complet depuis `main.js` sans fichier manquant, chaque fichier lu une fois ; fichier bloqué nommé) ; nav et
  account-http relancés (lisent `index.html`) : 25/25.
- **Vérification** : ✅ Chromium headless (playwright-cli, serveur local) : chargement normal sans cadre (11 onglets) ;
  `nav.js` bloqué → « Fichier(s) bloqué(s) : /src/ui/nav.js (Failed to fetch) » ; `throw` ajouté à `tooltip.js` →
  « Uncaught Error: test plantage — /src/ui/tooltip.js:42:7 ». ✅ Opera GX (OPR/137, Chrome 153) : le cadre a affiché « /src/sim/miner.js (Failed to fetch) » chez le joueur → cause trouvée, voir l'entrée suivante.
- **Points fragiles** : la lecture des imports est une expression régulière (imports statiques seulement ; un
  `import(...)` dynamique ne serait pas suivi). Un nouveau fichier chargé hors de `main.js` n'est pas couvert.

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

### Mine instantanée, étape 4 : interface (Geoffrey) — branche `geoffrey/mine-instantanee`
- **Fusion de `main`** (Lobby / Session séparés, `mode` des sessions) : une MI est une session **`mode: 'mi'`** (plus de
  champ `kind`). `MINE_MODES` : la MI est `ready` (choisissable) et `scheduled` : `game.start` la refuse
  (`mode_scheduled`, 400). Test `game-service` (type de mine) et `lobby` (« Où miner ») adaptés.
- **Fichiers** :
  - `src/render/miner-sprite.js` : dessin du mineur sorti de `canvas.js` (rendu de la mine normale inchangé),
    partagé avec `src/render/instant.js` (toute la mine, 50 × 51 + une bande de ciel pour les pseudos ; fissure
    sur les blocs en cours de minage ; ton mineur entouré).
  - `src/ui/instant-lobby.js` : carte MI du lobby (`countdownText`, `crossedNotice` : rappels seulement quand le
    moment passe pendant que la page est ouverte, le plus proche si plusieurs) ; `#miNotice` ; bouton dev « Ouvrir
    maintenant » (`POST /api/instant/dev-open`). `window.MI._notice(30)` dans la console pour voir un rappel.
  - `src/ui/instant-hud.js` : panneaux pendant la mine, classement, bilan (`showInstantEnd`). Icône de plume en
    texture (l'emoji 🪶 s'affichait en carré vide).
  - `src/main.js` : `enterSession` / `pollView` / `frame` / `showResult` aiguillent selon `mode` ; `updateNavSession`
    et `showSettling` prennent la durée / le texte de la MI ; lancer une session normale relit l'état MI.
  - `index.html` (`#miCard`, `#teamCard`, `#prefsCard`, `#miRun`, `#miNotice`), `style.css`, `src/net/api.js`
    (`instantApi`), `src/ui/lobby.js` (cartes selon le mode, `onMode`), `wiki.html`, `GAME_DESIGN.md`.
- **Tests** : `tests/instant-ui.test.js` (4) ; avec `instant-*`, `anticheat/instant`, `game-service`, `live`,
  `game-http`, `game-replay`, `party`, `lobby`, `nav`, `view`, `camera`, `skins`, `rarity`, `wiki` : 160 verts.
- **Vérification** : ✅ Chrome headless piloté par CDP, serveur dev sur le port 8123 (dossier `F:\idledollexminer-mi`,
  données à part) : 2 invités inscrits, ouverture dev, mine affichée, B quitte, fin : bilan de A = son inventaire
  (23 charbons, 35 fers, 44 ors, 2 shiny, 11 plumes), B : rien ; rappel 30 s depuis l'onglet Inventaire →
  Rejoindre → inscrit, lobby sur la carte MI. 0 erreur JS. ⚠️ Pas vu sur mobile ; rappels « au vrai moment »
  vérifiés seulement par les tests (`crossedNotice`), pas en attendant une vraie heure pile.
- **Points fragiles** : l'envoi MI contient toute la carte à chaque fois (~3 Ko, toutes les 250 ms par joueur) : à
  revoir si une MI à 20 pèse trop sur le serveur. Conflit attendu avec `geoffrey/nom-mine-instantanee` (même ligne
  de `MINE_MODES` dans `src/config.js`).

### Onglet Amélioration : identification R1-R7, amélioration +1 à +3, nouvelles stats (Geoffrey) — branche `geoffrey/amelioration`
- **Quoi** :
  - `src/config.js` : `UPGRADE` (qualités, découverte R6/R7, liste des stats, prix en x, pas d'arrondi, paliers,
    opMemory), `STATS` + `mineSpeedPct, damagePct, crit, oneTap, piercing, looting` (0), `GEAR_RNG.salt`, libellés et
    unités, `shownStats`, matériaux `Plume d'ange` / `Pierre de pleine lune` (textures `angel_feather`, `moon_stone`) — **ancien** : la
    Pierre est remplacée par le `Cristal de pleine lune` (voir le correctif plus bas).
  - `src/meta/piece.js` (nouveau, pur) : `itemValue`, `linePoints`, `rollQuality`, `rollIdentity`, `pieceBonus`
    (lignes + multiplicateur du palier, `set` = base + apport × mult), `pieceName`, `pieceColor`, `sanitizePiece`
    (anti-triche : nombre de lignes, stats de la liste, % dans la fourchette de la qualité, une Découverte au plus en
    R6/R7, plus 0..3 ; sinon la pièce redevient non identifiée). Une ligne enregistre son **%** (`{ stat, pct }`,
    Découverte : `{ stat }`), pas sa valeur : `lineValue` la recalcule depuis la config.
  - `src/meta/upgrade.js` (nouveau, pur) : `identify`, `upgrade`, `inv.upgrades` (opId rejoué → même résultat, rien
    de tiré ni consommé deux fois). Seulement des pièces de l'inventaire (pas portées).
  - `src/meta/inventory.js` : `takePiece`/`putPiece` gardent q/lines/plus ; `deserialize` passe chaque pièce dans
    `sanitizePiece` (avant : `{...s}` gardait n'importe quel champ) ; champ `upgrades`.
  - `src/meta/stuff.js` : `statLines`, `statsOf`, `stuffTip` acceptent un nom ou une pièce ; `sanitizeStuff` garde
    les pièces revérifiées ; `sanitizeGear`, `gearOf`.
  - Session : `record.gear[compte]` (pièces portées au lancement, `server/game/service.js` start) ; `minerSpecs`
    (`src/shared/game.js`) calcule `carac` depuis `gear` (revérifié), sinon depuis `looks` (anciennes sessions).
  - Simulation : `mineRate` = mineSpeed × (1 + %) dans `mineT`/`baseMineT` (`src/sim/miner.js`) ;
    `src/sim/actions.js` : `hitDamage` (dégâts % + critique), `mineDuration` (coup unique), `pierce` (bloc derrière,
    via `breakBlock` extrait de `mineBlock`), `lootOf` + `carac.looting`. `G.gearRng` (session.js) tiré seulement si
    la stat > 0.
  - Serveur : `POST /api/game/upgrade` (`{ action:'identify', uid, sacrifice }` | `{ action:'upgrade', uid }`, opId),
    hasard `random` du service (crypto), verrou `inv:`.
  - UI : `src/ui/upgrade.js` (nouveau), onglet `amelioration` (nav, index.html, main.js, style.css) ; `pname`
    (rarity.js), `tipAttr(item, title, piece)` + `data-color` (tooltip.js) ; inventaire (« +N » dans la case,
    « non identifiée ») et stuff affichent la pièce.
  - Wiki : aides des nouvelles stats (`src/wiki/data.js`).
  - `scripts/give-admin.js` : une pièce de chaque qualité + matériaux (fichiers locaux ou `DATABASE_URL`).
- **Tests** : `tests/amelioration.test.js` (21) et `tests/anticheat/upgrade.test.js` (4) nouveaux ; `tests/nav.test.js`
  (onglet ajouté). Sujets touchés : 318/319 verts (session, mobs, level, focus, shiny, dungeon, game-service,
  game-http, game-replay, carac, wiki, goblin, skills, tier2, blueprint, iron-furnace, live, view, stuff, inventory,
  craft, anticheat). ❌ `tests/anticheat/skills.test.js` (« étape sans la précédente ») échoue **aussi sur `main`
  sans ce changement** (vérifié par `git stash`) : pas lié, à regarder à part.
- **Simulation** : `--miners 3 --count 5` : 0 blocage, areas 3,4, profondeur 183. Sans les nouvelles stats, sorties
  identiques avant/après au caractère près (seeds 7919, 15838, solo). Stress (perçage 60 %, coup unique 30 %, crit 50 %,
  minage +50 %, butin +100 %, 3 mineurs × 5) : 0 blocage, mais étourdissements 8,6 → 25,2 par session ⚠️ (le perçage
  vers le bas creuse sous le mineur : chutes imprévues). Négligeable aux valeurs réelles (quelques %), à surveiller.
- **Prix mesurés** (script jetable, 24 seeds solo, +50 %, bruit ± 25 % par seed) : minage % ≈ 11 x/% (13 calculé),
  coup unique ≈ 17 x/% → gardé 13, perçage ≈ 6,8 → 7, butin des mobs : 0 sur les minerais (+61 % de butin de mobs),
  laissé à 2 (provisoire, pas de valeur en x pour le butin de mobs).
- **Vérification** : ✅ routes testées en vrai (serveur dev local, compte de test, `give-admin.js`, amélioration +1,
  identification refusée sur une pièce déjà identifiée). ⚠️ onglet pas regardé dans le navigateur (pas d'outil
  navigateur dans la session) : modules chargés sans erreur (`node -e import`), `node --check src/main.js`.
- **Points fragiles** : une pièce trafiquée perd son identification à la relecture (voulu). Changer les prix ou la
  valeur d'un objet change les stats des pièces déjà tirées (voulu : la ligne garde son %) ; **changer les fourchettes
  min/max d'une qualité** peut sortir des pièces existantes de la fourchette → elles redeviennent non identifiées :
  prévoir une migration si on le fait un jour.
  `give-admin.js` écrit dans le stockage : serveur arrêté en local, redémarré en ligne (sinon écrasé).

### Amélioration : Cristal de pleine lune au lieu de la « Pierre de pleine lune » (Geoffrey) — branche `geoffrey/fix-pierre-pleine-lune`
- **Quoi** : `UPGRADE.levels[].cost` demandait `Pierre de pleine lune`, objet sans aucune source (malentendu : c'est le
  butin du minotaure, `DUNGEON.loot` = `Cristal de pleine lune`) → amélioration impossible en ligne. Coûts passés au
  Cristal ; objet `Pierre de pleine lune` et texture `moon_stone` retirés (`src/config.js`, `scripts/gen_textures.py`,
  `textures/moon_stone.png`) ; `scripts/give-admin.js`, tests, GAME_DESIGN, état du projet suivent.
- **Effet de bord** : une Pierre déjà présente dans un inventaire (seulement via give-admin, jamais distribuée en
  ligne) reste un objet empilable inconnu du catalogue, sans usage.
- **Tests** : `amelioration`, `anticheat/upgrade`, `wiki`, `dungeon`, `inventory`.

---

## 21/10/2026 — Jules — Opera GX : `src/sim/miner.js` bloqué par la liste anti-minage, renommé `mineur.js`
- **Cause** : capture du cadre de `boot-check.js` chez un joueur Opera GX (OPR/137) : « /src/sim/miner.js (Failed to
  fetch) ». La liste NoCoin (protection anti-minage de cryptomonnaie, active par défaut avec le bloqueur d'Opera ;
  aussi dans uBlock / Brave selon les réglages) contient la règle générique `/miner.js`. Un module bloqué → tout le
  graphe d'imports échoue → `main.js` ne tourne pas (lobby vide). Les 184 URL du jeu testées contre NoCoin : seule
  `miner.js` était visée.
- **Correction** : `git mv src/sim/miner.js src/sim/mineur.js` (commentaire en tête : ne pas le renommer), imports
  mis à jour (`render/canvas`, `sim/{actions,ai,path,session}`, commentaire de `meta/stuff`, 5 tests), CLAUDE.md §7.
  `tests/miner.test.js` garde son nom (pas servi au navigateur).
- **Garde-fou** : `tests/blocked-names.test.js` : règles génériques de chemin de NoCoin (relevées le 21/10) contre
  tous les fichiers servis (`index.html`, `wiki.html`, `src/`, `textures/`). À compléter si un autre bloqueur pose
  problème. ⚠️ Éviter aussi `deepMiner.*`, `miner.*`, `xmr.js`, `coinhive*`…
- **Tests** : blocked-names, boot-check, miner, carac, skills, tier2, winch : 71/71. Simulation 5 sessions × 3
  mineurs : ✅ 0 bloquée, areas 3,4, profondeur 183, 26 allers-retours (534 s : lente, sans lien avec ce renommage).
- **Vérification** : ✅ Chromium headless, serveur local, toute requête `/miner.js` refusée comme Opera : 11 onglets,
  pas de cadre, `mineur.js` chargé. ⚠️ À reconfirmer par le joueur Opera GX après la mise en ligne.

### Direction artistique « Forge noire » en pixel art (Jules) — branche `jules/da-pixel-forge`, ✅ en ligne le 21/10
- **Quoi** : interface réécrite d'après la maquette `design/poc/4-pixel-forge.html` (branche `jules/poc-design`).
  Aucune règle du jeu, simulation ou route serveur ne change ; les identifiants lus par `src/ui/*.js` sont gardés.
- **Fichiers** :
  - `scripts/gen_ui.py` → `textures/ui/` (mur, panneau 18×18 tranche 6, bouton 15×15 tranche 3, case 18×18
    tranche 3, barre 9×9, plaque de titre) ; `scripts/build_pxicons.py` → `src/ui/pxicons.js` (29 icônes du Kenney
    1-Bit Pack, CC0, planche dans `scripts/assets/`) ; commande `npm run textures:ui`.
  - `src/ui/style.css` réécrit : unité `--u` (taille d'un pixel d'art : 2 px, 3 px à partir de 1800×1000), tout en
    multiples de `--u`, cadres en `border-image`. Pas de `zoom` CSS : il décalerait la bulle d'info (`tooltip.js`)
    et le glisser de la caméra (coordonnées écran).
  - `index.html` : barre du haut (`.topbar` : compte, nom, `.navSession`, wiki) ; `#nav` devient la barre d'action
    en bas avec les orbes `#orbL` / `#orbR` ; lobby en deux colonnes (`.lobbyCols`) ; session en grille
    `.runGrid` (`.runL`, `#cvWrap`, `#depthRail`, `.runR`), `#run` et `#miRun` en `position:fixed` sous la barre ;
    émojis des titres → `<i data-pxi>` (remplis par `fillIcons` de `nav.js`).
  - `src/ui/nav.js` : icônes pixel (`TABS[].icon` = nom d'icône), touches `TAB_KEYS`, `fillIcons`.
  - Nouveaux : `src/ui/orbs.js` (orbes dessinés pixel par pixel), `src/ui/fit.js` (taille de la mine : la plus grande
    dans sa boîte, ×1 / ×2 exact si on perd ≤ 20 %), `src/render/portrait.js` (sprite du mineur + stuff hors mine).
  - `src/main.js` : orbes (O₂ / pods du mineur suivi pendant une session, sinon temps / XP), `fitCanvas` à chaque
    rafraîchissement du HUD, portrait de la barre du haut ; `src/ui/hud.js` : jauge de profondeur (`updateRail`,
    repères recréés seulement si l'équipe change) ; `stuff.js` : mineur au centre (`.stuffHero`, dernier enfant de
    `#stuffGrid` : le CSS place les cases 1-5 à gauche, 6-10 à droite) ; `skills.js` : icônes pixel ;
    `lobby.js` : sprites de l'équipe (toi avec ton stuff, option `look`), l'icône du bouton Lancer remplace le « ▶ »
    du texte ; `account.js` : portrait dans `.av`.
- **Tests** : nav, lobby, stuff, skills, blocked-names, boot-check, instant-mine, skins, research, blueprint,
  treasure, loot, tier2, account-http : 134/134 ✅. Les règles exigées par `nav.test.js` (`#end{position:absolute`,
  `.view[data-view="session"]{position:relative`) sont gardées.
- **Vérification** : ✅ partie complète en local (`npm run dev`, invité, 2 mineurs de test, ×300 jusqu'au bilan),
  captures des 11 onglets à 1440×900, lobby / session / stuff / inventaire à 1920×1080, 1280×720 et 390×844 sans
  défilement horizontal, 0 erreur console. Mine à ×1 exact à 1440×900.
  ⚠️ Pas vérifié : mine instantanée en cours (`#miRun`), fenêtres du four / concasseur / stuff avec de vrais objets,
  Safari / Firefox, le compte connecté (pseudo + mot de passe), un groupe à plusieurs vrais joueurs.
- **Points fragiles** : les boutons « conteneurs » (`.stuffSlot`, `.fopt`, cases de la barre d'action, `.navAccount`)
  annulent le `border-image` des boutons ; un nouveau bouton conteneur devra faire pareil. Polices Jersey chargées
  depuis Google Fonts (sans internet : police système). Le wiki garde son ancien style (`src/wiki/wiki.css`).
- **Mise en ligne (21/10)** : testé en local par Jules (« tout est bon ») ; `main` n'avait pas bougé ; tests de
  l'interface 134/134 relancés avant la fusion.
### 21/10/2026 — Onglet Social (amis, présence, pop-ups)
- **Quoi** : onglet Social (n'était qu'une page d'attente). Ajouter un ami par pseudo (ou ID : les invités n'ont pas
  de pseudo) → demande à accepter / refuser ; demandes croisées = amis tout de suite ; retirer / annuler. Liste des
  amis avec statut (hors ligne / en ligne / en session mine / dans le lobby n/3) et boutons Inviter / Rejoindre.
  Pop-ups en haut à gauche (`#notifs`, `src/ui/notify.js`) : « xxx vous a invité dans son lobby » (Rejoindre /
  Décliner) et « xxx vous a envoyé une demande d'ami » (Accepter / Refuser).
- **Présence** : `GET /api/social` appelé toutes les 4 s (20 s onglet caché) dans tous les onglets, même en session ;
  toute demande au service social = signe de vie ; en ligne si < 45 s (`SOCIAL_SERVER.onlineFor`). En mémoire.
- **Groupes** : `party.joinFriend` (rejoindre le groupe d'un ami, créé avec lui comme chef s'il n'en a pas) ;
  `party.invite` refuse maintenant un joueur en session (`friend_in_session`), y compris l'invitation par ID du lobby.
  `party.groupOf` / `party.invitesOf` pour l'onglet.
- **Stockage** : ns `social` par compte `{ friends, incoming, outgoing }`, relu par `sanitizeSocial` ; une demande
  écrit les deux comptes en une fois (`putSocial(entries)`) ; écritures du service en file (double clic = une demande).
- **Fichiers** : `server/social/{service,routes}.js`, `server/{app,main,config}.js`, `server/party/service.js`,
  `server/game/store.js`, `server/db/postgres.js`, `src/config.js` (SOCIAL), `src/net/api.js`, `src/main.js`,
  `src/ui/{social,notify,nav}.js`, `src/ui/style.css`, `index.html`, GAME_DESIGN §6, CLAUDE.md.
- **Tests** : `tests/social.test.js` (13 : pseudo / ID, croisées, refuser / annuler / retirer, statuts, inviter,
  invitation refusée en session côté groupes, rejoindre + complet + en session, limites, relecture trafiquée, écriture
  des deux comptes ensemble, double clic, HTTP). party, game-service, nav, postgres, game-http, account-http, anticheat
  party + server : verts.
- **Vérification** : ✅ Chromium headless à 3 joueurs (Zoe, Max, Lou) : demande → pop-up + pastille chez Max,
  acceptée depuis la pop-up ; Lou accepte depuis l'onglet ; Lou rejoint le lobby de Zoe (créé, Zoe chef) ; Zoe invite
  Max (sur l'onglet Inventaire) → pop-up → Rejoindre → lobby 3/3 ; mobile 390 px ; 0 erreur console. Statut « en
  session » vérifié par les tests seulement. ⚠️ Pas testé en ligne (PostgreSQL : nouveau ns `social`).

### Fusion de l'onglet Social (Geoffrey) + noms des onglets + nom du jeu (Jules) — branche `jules/social`, ✅ en ligne le 22/10
- **Fusion** de `origin/social` (1 commit signé « Claude », 21/10 15h20, base d'avant la mine instantanée et la refonte
  pixel ; 39 commits de retard). 11 conflits résolus en gardant les deux côtés : `server/app.js`, `server/main.js`
  (services `instant` et `social` côte à côte), `server/game/store.js` (Maps `signups` et `socials`, `db.load` avec
  `mi_signup` et `social`, `crushers` gardé), `server/db/postgres.js` (commentaire), `src/net/api.js` (`instantApi`
  et `socialApi`), `src/config.js` (`PARTY.pollInSession`, `MINE_MODES`, `SOCIAL`), `src/main.js` (imports,
  `startInstant()` et `pollSocial()`), `src/ui/nav.js` (Social `ready:true`), `src/ui/style.css` (Forge noire gardée,
  styles Social et pop-ups réécrits en pixel), `CLAUDE.md`, `docs/debug.md` (les deux entrées gardées).
- **Adaptations** : `nav.show('mine')` → `'lobby'` (l'onglet Mine n'existe plus) ; icônes pixel dans les pop-ups
  (`notify.js`) et les boutons Inviter / Rejoindre (`social.js`) ; titre de l'onglet en `data-pxi` ; GAME_DESIGN :
  barre d'action en bas (oubli de la refonte), renvois vers l'onglet Lobby.
- **Noms des onglets** toujours visibles sous l'icône (`.dock ul button .lbl` n'est plus une bulle) ; `--dock-h`
  58u ; orbes masqués sous 1100 px de large ; `TAB_KEYS` + « = » (12 onglets prêts).
- **Nom du jeu** : « Deep Mine Idle » dans `index.html`, `account.js`, `wiki.html`, le message du serveur, les titres
  de README / CLAUDE / GAME_DESIGN / état du projet ; `deepmineidle` ajouté aux pseudos réservés. Inchangés exprès :
  services systemd, dossiers et scripts de `deploy/ovh/` (`deep-idle-mine`), `package.json`, clés localStorage
  (`deepIdleMine.*` : les changer effacerait l'onglet mémorisé des joueurs), le prototype.
- **Tests** : social, nav, lobby, party, game-service, postgres (1 sauté sans base), game-http, instant-*, live,
  account-*, wiki, boot-check, blocked-names : tout vert. ✅ Test à deux joueurs en local (2 navigateurs) : demande
  d'ami par ID → pop-up chez l'autre → accepter → « En ligne » → Inviter → pop-up → Rejoindre → lobby à 2 avec le
  bon chef ; captures 1440, 1280, 390 sans débordement.
- ⚠️ **Pas vérifié** : le Social avec PostgreSQL (en ligne, nouveau ns `social`), un ami en session (boutons grisés),
  la présence « hors ligne » après 45 s, deux comptes avec pseudo.
- **Mine plus grande** (retour de Jules : trop petite) : `fitCanvas(cv, box, minShown)` ; pour la mine normale
  `CAMERA.minShown` = 0,65 (config) : elle remplit la largeur tant qu'au moins 65 % des lignes restent visibles, la
  boîte `#cvWrap` rogne le haut et le bas (`overflow:hidden`, `#cv` centré en absolu ; statique sur téléphone). La
  caméra centre déjà le mineur suivi (`fy - viewRows/2 + 2`). Glisser pour défiler reste juste (`clientHeight` = hauteur
  affichée entière). La mine instantanée reste entière (minShown 1). ✅ captures 1536×713, 1920×1080, 390×844 ;
  tests camera + nav verts.
- **Mise en ligne (22/10)** : demandée par Jules ; `main` n'avait pas bougé ; 224 tests du sujet verts (postgres sauté sans base).
  ⚠️ À surveiller au premier démarrage en ligne : chargement du ns `social` dans PostgreSQL (`createPgGameStore`).

### Revue de sécurité (Jules) — branche `jules/securite`, ✅ en ligne le 22/10
- **Vérifié, rien à corriger** : historique git (150 commits) sans secret (seulement des exemples `postgres://…` et des
  mots de passe de test) ; scrypt + sel + `timingSafeEqual`, jeton 256 bits haché, cookie HttpOnly / SameSite=Strict /
  Secure en ligne (`DIM_SECURE_COOKIE=1` posé par `install.sh`), sessions coupées au changement / à la récupération du
  mot de passe, purge horaire ; JSON obligatoire (CSRF) ; corps ≤ 16 Ko ; erreurs 500 sans détail ; X-Forwarded-For
  lu par la droite ; toutes les routes sauf `info` exigent `ctx.me` ; contrôles d'appartenance (kick, invite, join,
  ack) ; mode dev seulement par variable serveur ; requêtes SQL paramétrées ; `publicAccount` sans empreintes ; pas
  d'IP ni d'e-mail stockés ; pseudos limités à lettres / chiffres / - / _ et textes échappés ; `npm audit` : 0 ;
  OVH : 127.0.0.1 + Caddy, env 600, systemd durci, ufw, fail2ban, unattended-upgrades.
- **Corrigé** :
  - `server/config.js` `securityHeaders` (CSP `script-src 'self'`, styles et polices Google, `frame-ancestors 'none'`,
    nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP) posés par `server/app.js` sur toutes les
    réponses ; HSTS (`hsts`) seulement si le cookie est `Secure`. Aucun script en ligne ni `eval` dans le jeu : rien
    à adapter. ✅ 0 violation dans la console sur les 12 onglets, une session, le wiki ; polices chargées.
  - `/prototype/` retiré de `publicPaths` (inutile en ligne, et la CSP le casserait).
  - `server/accounts/ratelimit.js` : grand ménage des clés sans coup récent quand la taille double (mémoire bornée,
    sans parcours à chaque tentative).
  - `.gitignore` : `.env`, `*.env`, `.env.*`.
  - `tests/anticheat/skills.test.js` : la règle vérifiée était « le nœud d'avant dans la liste » (avant les arbres en
    étages, 2113f71) ; maintenant « au moins un nœud de l'étage d'avant au max », comme le serveur. Pas une faille.
- **Tests** : nouveau `tests/security.test.js` (en-têtes sur page / fichier / API / erreurs, HSTS, chemins non servis,
  limiteur) ; anticheat 67/67 ; account-*, game-http, social, wiki, blocked-names, boot-check, instant-server verts.
- ⚠️ **Hors code, non vérifiable d'ici** : protection de `main` et 2FA sur GitHub (dépôt public, mise à jour auto
  depuis `main`) ; sauvegardes Neon ; `sslmode=require` dans `DATABASE_URL`. E-mails de Geoffrey publics (commits,
  `.mailmap`) : impossible à retirer sans réécrire `main`.
- **Mise en ligne (22/10)** : demandée par Jules ; `main` n'avait pas bougé ; 105 tests du sujet + anticheat 67/67 verts.
  À surveiller : en ligne, l'en-tête HSTS n'apparaît que si `DIM_SECURE_COOKIE=1` (posé par `install.sh`).

### Session : colonnes jusqu'en bas, lignes visibles adaptées (Jules) — branche `jules/colonnes-session`, ✅ en ligne le 22/10
- **Bug** : la surface n'était plus visible. Cause : l'agrandissement du 21/10 (`CAMERA.minShown`) rognait le haut et
  le bas du canvas en CSS ; la caméra croyait montrer 34 lignes, et en haut de la mine c'est le ciel qui était coupé.
- **Correction** : plus de rognage. Le nombre de lignes dessinées s'adapte : `renderer.setRows(n)`
  (`src/render/canvas.js` : `cv.height`, boucle de dessin, `panPixels`) et `camera.setRows(n)`
  (`src/render/camera.js`) ; `fitMine` (`src/ui/fit.js`) remplit la largeur et prend `floor(hauteur / case)` lignes
  entre `CAMERA.minRows` (20) et `CAMERA.maxRows` (48), en se calant sur la hauteur sous 20. Sans hauteur imposée
  (téléphone), le nombre de lignes ne change pas. `fitCanvas` ne sert plus qu'à la mine instantanée.
- **Colonnes** : `#run` va jusqu'en bas (`bottom:0`) ; la mine, la jauge et les colonnes gardent une marge du bas
  égale à la barre d'action ; `clearDock` (fit.js) l'enlève à une colonne quand la barre (centrée) ne passe pas sous
  elle. Sous 1100 px (session qui défile), marges à 0.
- **Tests** : camera (nouveau test setRows), nav : verts. ✅ Captures : 1918×904 (24 lignes, ciel visible, colonnes
  jusqu'en bas), 1440×900 (40 lignes, ×1 exact, colonnes au-dessus de la barre), 390×844 sans débordement.


### Identification : nerf des qualités, butin des mobs, pièces existantes mises à jour (Geoffrey) — `main`, en ligne le 22/10
- **Demande** : butin des mobs à +10 % pour 100 x ; total max des qualités R1 à R7 = 25 / 30 / 35 / 40 / 50 / 75 / 100 %
  (avant 30 à 220 %) ; mettre à jour les pièces déjà identifiées ; vérifier le tirage (un joueur, Crousti, a eu 5 R4).
- **Tirage vérifié** : le serveur tire avec `crypto` (pas de seed) ; 1 million de tirages conformes aux chances
  (R4 13,98 % pour 14 %) ; le navigateur crée un identifiant de demande neuf à chaque clic (pas de réponse rejouée).
  5 R4 de suite ≈ 1 chance sur 19 000 : malchance (ou chance), pas un bug. Les données de Crousti n'ont pas été lues
  (pas d'accès à la base d'ici).
- **Config** (`UPGRADE`) : `prices.looting` 2 → 10 ; fourchettes d'une ligne R1 8-25, R2 15-30, R3 17,5-35, R4 12,5-20,
  R5 17,5-25, R6 15-25, R7 16-25 (max = total ÷ lignes ; min : même rapport min/max qu'avant).
- **Pièces existantes** : `UPGRADE.scale` (= 2) et `UPGRADE.oldScales[1]` (anciennes fourchettes). Une pièce tirée
  porte `s` ; sans `s` (= barème 1), `sanitizePiece` ramène chaque ligne à la même place dans la nouvelle fourchette
  (haut → haut, bas → bas), garde la Découverte et le niveau. Fait à chaque relecture de l'inventaire et du stuff,
  enregistré à la prochaine écriture. Sans ça, une ancienne ligne hors fourchette aurait dés-identifié la pièce.
  Une session déjà lancée garde ses stats figées jusqu'à la fin.
- **Tests** : `tests/amelioration.test.js` (nouveau test du barème, fixtures au barème 2) ; suite complète + anticheat
  620/620.

### Mine instantanée : gravité et échelles ; plumes 1-2 ; coûts d'amélioration ; identification ; donjons 100 % (Geoffrey) — branche `geoffrey/retours-22-10`, ✅ en ligne le 22/10
- **MI gravité** (`src/sim/instant/ai.js` réécrit, `session.js`) : `G.ladder[y][x]` (Uint8Array par ligne) ; `miSupported`
  = même règle que `supported` de la mine normale (vide dessous sans échelle ni sur la case ni juste dessous ; le fond
  ligne h porte). `decide` : sans appui → action `move` d'une case vers le bas (`data.fall`, 1/CFG.fallSpeed). `plan` :
  Dijkstra au temps sur les cases où il tient (marcher + chute, monter = échelle à poser `CFG.ladderTime × (1 −
  build_time)`, ×0,5 en planif si `tall_ladder`, + 1/climbSpeed ; descendre par l'échelle). Candidats = blocs pleins
  touchant une case atteinte (4 directions, comme avant), coût = temps + foule. Tas de plumes : `hops` (cases
  traversées, chute comprise) ≤ featherReach → `m.goal`. Chemin = suite de cases où il tient ; `step` fait une case à la
  fois, la gravité fait la chute ; un chemin qui ne colle plus est replanifié. Action `ladder` (pose sur sa case, +1
  au-dessus avec tall_ladder). `mineCell` : un mineur posé sur le bloc miné (sauf en marche) perd son action et tombe.
  `miMineT` compte maintenant `mineSpeedPct` (stat d'amélioration, oubliée avant). Pas de limite de chute ni
  d'étourdissement en MI (choix de Claude, à valider). Vue : `ladders` (liste de cases) dans `instant-view.js`, rendu
  par la texture `ladder` (`src/render/instant.js`).
- **Mesures** (5 seeds, 5 min) — avant / après : 1 mineur 107 / 107 blocs ; 3 : 105 / 108 ; 10 : 103 / 105 ; 20 : 100 / 95
  (min 85), ≈ 10 échelles par mineur à 20 ; 0 inactivité, jamais en l'air hors chute, jamais de montée sans échelle.
  Plumes par joueur et par mine (tas 1-2) : 4,8 seul, 3,5 à 3, 2,8 à 10, 1,9 à 20. Il faut 100 plumes pour +3.
- **Plumes** : `INSTANT_MINE.featherMax` 5 → 2. **Coûts** : `UPGRADE.levels` plumes 20 / 30 / 50 (cristaux 3 / 5 / 7).
- **Identification** (`src/ui/upgrade.js`) : état `pick` ('target' | 'sacrifice') ; clic sur une case = la choisir
  (`.sel`), re-clic sur la case choisie remplie = la vider ; la liste montre toutes les pièces sauf celle de l'autre
  case ; bouton grisé + raison si objets différents ou pièce déjà identifiée. Serveur inchangé (il refusait déjà :
  `not_same_item`, `already_identified`).
- **Lignes séparées** : `statLines` (`src/meta/stuff.js`) = effets de l'objet (`pieceBonus` sans lignes, × niveau), puis
  chaque ligne (`lineValue × plusMult`, arrondie au pas). Les totaux de session (`statsOf`, `pieceBonus`) ne changent pas.
- **Donjon** : `DUNGEON.areas` [4, 5], `chance` 1. Tests : `dungeon.test.js` (100 % en 4 et 5, plus de « seed sans
  donjon »), `helpers.js` (`G.dungeons=[]` dans worldFrom).
- **Tests** : instant-mine (+3 : jamais en l'air, chute, échelles jusqu'au dernier bloc), instant-ui (échelles dans la
  vue), amelioration (lignes séparées, coûts), anticheat/upgrade (quantités) ; 167 tests des sujets + anticheat 67/67
  verts. Simulation 3 mineurs × 5 : identique à main (base : l'area 4 est à peine atteinte), 0 blocage.
- ⚠️ Mineurs forts (minage 3, 4 seeds) : le détecteur de blocage signale 2 fois le barbare « Entre dans le donjon » /
  « Combat le minotaure » en area 4 (≈ 70 s de trajet + combat sans miner) : faux positif du détecteur (combat), pas
  un blocage ; la branche `geoffrey/retours-21-10` touche déjà ce détecteur.
- ✅ Chromium (1440 et 390) : identification (objets différents → grisé + raison, case choisie en doré, identification
  réussie, lignes séparées dans la liste), coûts +1 affichés 20 plumes ; MI ouverte en dev, le mineur tombe et creuse.
  ⚠️ Pas vu à l'écran : des échelles dans une MI à plusieurs (testé par la vue et la simulation seulement).
- ⚠️ **Conflit attendu** avec `geoffrey/retours-21-10` (pas fusionnée) : `DUNGEON.areas` et `tests/dungeon.test.js`
  (elle passait l'area 4 à 20 %) : garder [4, 5] et chance 1.
- **Mise en ligne (22/10)** : demandée par Geoffrey ; `main` avait reçu 1c67b15 (barème d'identification) : seul conflit
  `docs/debug.md` (deux entrées gardées) ; 168 tests du sujet + anticheat 67/67 verts après fusion.

### Identification : nouveau tableau de conversion des stats (Geoffrey) — `main`, en ligne le 22/10
- **Demande** (étape 1 du concept Ange vs Démon) : tableau « stat pour 100 x » du créateur, pour l'identification et les
  futures runes : vitesse de minage +0,05, minage % +5, dégâts +2,5, dégâts % +20, vitesse d'attaque +20, critique +7,
  fortune +2, coup unique +7, perçage +10, butin des mobs +10, marche +0,4, montée +0,3, pods +20, oxygène +25.
- **Config** : `UPGRADE.prices` = conversion d'une ligne (x par point = 100 ÷ valeur pour 100 x) ; nouveau
  `UPGRADE.worth` = l'ancien catalogue mesuré, qui sert seulement à la **valeur de l'objet** (`itemValue`). Choix de
  Claude : sans cette séparation, la pioche en pierre serait passée de 130 à 200 x (prix de la vitesse de minage 1300 →
  2000) et toutes ses lignes auraient grossi d'environ 54 %.
- Les pièces gardent leur %, elles suivent le tableau sans migration.
- **Tests** : `tests/amelioration.test.js` (valeurs attendues recalculées). Suite complète + anticheat : 622/623.
  ⚠️ L'échec restant (« chaque area (0 à 6) : blocs posés = comptes de l'area ») existe **sans** ce changement : il
  vient de `d40ce42` (donjons en areas 4 et 5 à 100 %), pas corrigé ici.

### Ange vs Démon, étape 2 : résidus, jauges, onglet Jugement (Geoffrey) — branche `claude/ange-demon`, fusionnée et en ligne le 22/10
- **Spec** du concept complet (validée en discussion) : `docs/superpowers/specs/2026-10-22-ange-demon-design.md`.
  Choix de Claude, non tranché par le créateur : projection du boss à **6 cases** (5 n'auraient jamais fait tomber).
- **Blocs** 12 `Résidu angélique` et 13 `Résidu démoniaque` (terrain, famille `residu`, poids 6, dureté 2,4, rareté
  rare). `placeResidues` (`src/sim/world.js`) : dès l'area 4, 0,5 % de chaque, tirage à part (`JUDGMENT.salt`), posés
  en dernier à la place de terrain : le reste de la mine est inchangé. Textures `residue_angel` / `residue_demon`
  (`scripts/gen_textures.py`). Icône `radiance` (Kenney 28,12) pour l'onglet.
- **Jauges** : `src/meta/judgment.js` (pur) ; ns `judgment` clé `state` dans le stockage ; ajout dans `settleWith`
  (`server/game/service.js`) seulement quand `creditSession` verse vraiment (une fois par session et par joueur) ;
  `GET /api/game/judgment`. Une tour pleine s'ouvre à la lecture suivante (`refresh`).
- **Onglet Jugement** (3e, après Session : les touches 3 à = se décalent, Social n'a plus de touche) :
  `src/ui/judgment.js`, styles `.jg` / `.jtower`. ✅ Captures 1440×900 et 390×844 (jauges 37/250 et 182/250, tour de
  l'Ange ouverte avec le temps restant). Bug trouvé à la capture : la jauge restait sur « Chargement… » (premier appel
  avant la connexion) → appel aussi au démarrage et à l'ouverture de l'onglet.
- **Test du créateur à faire** : le bouton « Aller au Lobby » d'une tour ouverte mène au Lobby, où la tour n'est pas
  encore proposée (étape 4).
- ⚠️ **Rythme** (simulation, 3 mineurs × 8 sessions, stuff de base) : **0 résidu**. Les mineurs s'arrêtent vers la
  case 190, l'area 4 commence à 202 : ils la débloquent parfois en fin de session sans y entrer. Même en faisant viser
  les résidus par l'IA (essai, pas gardé) : 0. Les jauges ne bougeront qu'avec des joueurs équipés qui minent en
  area 4-5 (13 résidus de chaque par area). Signalé au créateur.
- Le test « chaque area : blocs posés = comptes » échouait depuis `d40ce42` (murs de donjon pas comptés) : corrigé
  (donjon, treasure et résidus comptés à part). Suite complète + anticheat 632/632.
- Une session en cours déjà arrivée en area 4 au moment de la mise en ligne serait rejouée avec des résidus si le
  serveur redémarre (la génération de l'area 4+ a changé) : rare (stuff de base), sans perte de butin déjà versé.

### Ange vs Démon, étape 3 : coffres des tours, runes, Enchantement (Geoffrey) — branche `claude/ange-demon`, fusionnée et en ligne le 22/10
- **Config** `RUNE` + `chestItem(side, q)` : 14 objets `Coffre angélique R1` … `Coffre démoniaque R7` (cat treasure,
  empilables, `chest:{ side, q }`, rareté selon q) et `Rune` (cat rune, non empilable). Textures `chest_angel`,
  `chest_demon`, `rune`.
- **`src/meta/piece.js`** : `rollLines` (extrait de `rollIdentity`), `rollChestQuality`, `rollRune(q)`, `isRune` ;
  `sanitizePiece` accepte une Rune (toujours tirée, sans niveau) et `piece.rune` ({ q, lines, s }, revérifiée comme
  une identification, barème compris) ; `pieceBonus` additionne les lignes de la rune.
- **`src/meta/loot.js`** : un coffre de tour s'ouvre comme un Treasure et donne une Rune (lignes tirées à
  l'ouverture). **`src/meta/upgrade.js`** : `enchant` / `enchantError` (`not_stuff`, `not_rune`,
  `already_enchanted`) ; identification et amélioration refusent maintenant une rune (`not_stuff`).
- **Serveur** : action `enchant` de `POST /api/game/upgrade` ; `open` relit maintenant le stuff porté avant
  d'ouvrir (une rune reçoit un uid neuf : sans ça, elle pouvait prendre l'uid d'une pièce portée si le compteur de
  la base était trop bas. Test anticheat qui échoue sans la correction).
- **UI** : rubrique Enchantement (onglet Amélioration) : cases pièce + rune, aperçu de ce que la rune donnera sur
  CETTE pièce, confirmation ; infobulle d'une rune en « % de la valeur de la pièce ». ✅ Testé dans Chromium
  (1440×900) : 2 coffres ouverts par l'API, rune R4 posée sur une épée en fer (+3,1 % perçage, +0,15 marche), pièce
  marquée « déjà enchantée », aucune erreur de page.
- **Outil admin** : `node scripts/give-admin.js --name X --chests 1` donne un coffre de chaque qualité (ange et
  démon) pour tester sans tour.
- **Tests** : `tests/rune.test.js`, `tests/anticheat/rune.test.js`, rareté. Suite complète + anticheat 644/644.

### Ange vs Démon, étape 4 : tours de l'Ange et du Démon (Geoffrey) — branche `claude/ange-demon`, fusionnée et en ligne le 22/10
- **Config** `TOWER` ; blocs 14-17 (stonebrick ange / démon et leurs versions indestructibles) ; modes de lancement
  `tower_angel` / `tower_demon` dans `MINE_MODES` (champ `tower`).
- **Simulation** `src/sim/tower/` : `world.js` (carte : ciel, tour 15 × 30, portes, 5 % indestructible avec chemin
  garanti, toit sous le boss incassable), `session.js` (Dijkstra « en creusant » : à côté, monter en posant une
  échelle dans la tour, descendre par une échelle, chutes ≤ CFG.maxFall ; boss, ordre d'arrivée, coups, rage,
  projection de 6 cases, étourdissement à l'atterrissage, départs, fin). Déterministe (seed) : le serveur rejoue.
- **Partagé** `src/shared/tower.js` (construction depuis l'enregistrement, départs), `src/shared/tower-view.js`
  (envoi complet à chaque fois, comme la MI). `server/game/live-game.js` : 3e sorte de partie.
- **Serveur** : `start` refuse `tower_closed` / `tower_done`, note `rec.opening` ; durée `TOWER.duration` ;
  `settleWith` : réussite → un coffre par présent (qualité tirée par le serveur) puis `markDone` seulement si
  l'ouverture n'a pas changé ; pas d'XP ; pas de focus.
- **Navigateur** : bloc `#twRun` (chrono, Boss, Équipe, Journal, Quitter la tour), `src/render/tower.js`
  (ciel teinté, briques, boss 24 × 40 px, barre de vie, marqueur de cible), `src/ui/tower-hud.js` (HUD et bilan),
  Lobby (`mineModes` filtre les tours fermées, « Lancer la tour », texte d'explication, préférences cachées).
- ✅ **Essai complet dans Chromium** (serveur de dev, jauge de l'Ange ouverte à la main) : la tour apparaît dans
  « Où miner », lancement, partie affichée (creusement, échelles, boss), boss vaincu, bilan, **Coffre angélique R1**
  dans l'inventaire, aucune erreur de page. Captures 1440×900.
- **Équilibrage mesuré** (stuff de base) : à 3, ≈ 7 min, 5/5 ; seul, 1/5 (boss à 100-200 PV). Signalé au créateur.
- **Tests** : `tests/tower.test.js` (carte, chemin garanti sur 200 seeds, IA à 3, solo fort / faible, boss, rage,
  projection, barbare, départs, rejeu de la partie en direct), `tests/game-service.test.js` (circuit serveur :
  fermée, échec, réussite à deux avec un départ, déjà faite, groupe bloqué, fermeture), `tests/lobby.test.js`.
  `tests/helpers.js` : le faux gestionnaire finit une tour à `TOWER_TICKS`. Suite complète + anticheat : 655/655.

### État du projet : Ange vs Démon, branche identification-sans-stats signalée (Geoffrey) — en ligne le 22/10
- `claude/etat-du-projet.md` (dépôt et projet claude.ai) : section Ange contre Démon ; l'Amélioration décrit ce qui
  est sur `main` (identification AVEC lignes) et signale la branche `geoffrey/identification-sans-stats` (pas
  fusionnée, mêmes fichiers que les runes : `src/meta/piece.js`, `src/ui/upgrade.js`, `tests/amelioration.test.js`).
  ⚠️ À sa fusion : garder `rollLines` / `rollRune` (les runes tirent toujours des lignes) et le barème `scale` 2.
- Remarque de méthode : les commits `1c67b15` (nerf identification) et `fc86f1c` (tableau de stats) ont été faits
  directement sur `main`, sans « Par : » ni entrée dans `docs/journal.md` (CLAUDE.md pas lu en début de discussion).
  Rattrapé dans l'entrée du journal du 22/10 « Ange contre Démon ».

### Identification : qualité seule, plus de lignes (Geoffrey) — branche `geoffrey/identification-sans-stats`, fusionnée et en ligne le 22/10
- `rollIdentity` (`src/meta/piece.js`) renvoie `{ q }` (un seul tirage du hasard). `sanitizePiece` : qualité connue sans
  lignes (`lines` absent ou `[]`) → `{ q }` ; sinon, anciennes lignes revérifiées comme avant (barème, `validLines`).
  Les pièces identifiées avant le 22/10 **gardent** leurs lignes (confirmé par Geoffrey le 22/10 ; pour
  les retirer un jour : ne garder que `q` dans `sanitizePiece`). Pièce `{ q }` : mêmes stats qu'une pièce non identifiée (testé).
- UI (`src/ui/upgrade.js`) : texte sans « stats en plus », tableau des qualités = qualité + chance, message de réussite
  = nom seul. `UPGRADE.qualities` garde min / max / lines (relecture des anciennes pièces).
- Tests : amelioration (nouveau test « seulement la qualité ») + anticheat/upgrade : verts.

- **Fusion avec Ange vs Démon (22/10)** : conflits `src/meta/piece.js` (gardé `rollLines` / `rollChestQuality` / `rollRune` de main ; `rollIdentity` = `{ q }` ; `sanitizePiece` : `sanitizeLines` d'abord, sinon qualité seule, rune revérifiée) et `tests/amelioration.test.js` (tests de main gardés, titre du test identifier « sans lignes »). amelioration, rarity, rune, anticheat rune + upgrade : 44/44 ✅.

### Jugement dans le Lobby (Geoffrey) — branche `geoffrey/jugement-lobby`, en ligne le 22/10
- `index.html` : section `data-view="jugement"` retirée ; carte `#judgmentCard` (même `#judgmentBody`) dans la colonne
  gauche du Lobby. `src/ui/nav.js` : onglet retiré, `pickTab('#jugement')` → lobby. `src/ui/lobby.js` : `st.view`
  ('jugement' ou null), bouton `data-view` inséré après les modes non-tour, `showJudgment()`, `pickMode(mode)` ;
  cartes équipe / préférences / MI / dev cachées en vue Jugement. `src/ui/judgment.js` : « Choisir la tour »
  (`onTower(side)`) au lieu de « Aller au Lobby ». `src/main.js` : `wantJudgment` (hash lu avant la navigation),
  badge sur `lobby`, `judgmentPending` passé au lobby. Le serveur ne change pas (Jugement n'est pas un mode).
- Tests : nav (ordre des onglets, #jugement), lobby, judgment : 25/25 ✅. Chromium 1440×900 et 390×844 : bouton,
  carte, retour à Mine, lien #jugement ✅, aucune erreur. ⚠️ Pas vu à l'écran : une tour ouverte (« Choisir la tour »).
### Wiki à jour + vraies chances du concasseur (Geoffrey) — branche `geoffrey/wiki-nouveautes`
- **Concasseur** : `src/meta/crusher.js` gagne `dropOdds(bloc)` (par famille : somme des chances, `every` = 1/chance
  lots, `sec` = temps moyen) et `aboutTime(s)`. Utilisés par la fenêtre « ? » (`src/ui/crusher.js`, styles `.fodds`)
  et par le wiki (`crusherRows`). Les chances de la config ne changent pas : c'est l'affichage.
- **Wiki** : `data.js` (source Plume d'ange = MI, usages des matériaux d'`UPGRADE.levels`, stuff « s'identifie »,
  `qualityRows`, `upgradeRows`, `upgradeTotal`, `instantInfo`) ; `wiki.js` (sections MI et Amélioration, donjon à
  chance 1 / plusieurs areas, tableau concasseur) ; `wiki.html` (sommaire, onglets, textes).
- **Tests** : `tests/crusher.test.js` (dropOdds + contrôle contre `rollLoot`, 1 million de lots par bloc) et
  `tests/wiki.test.js` (nouveautés) : 21/21 ✅. Chromium : wiki et fenêtre « ? » vus, aucune erreur console ✅.
- ⚠️ Le texte d'identification suppose `geoffrey/identification-sans-stats` fusionnée (qualité seule).
- ⚠️ `geoffrey/retours-21-10` (non fusionnée) relève les chances du concasseur : le « ? » et le wiki suivront la
  config tout seuls si elle passe.
- **Ajout avant la mise en ligne (22/10)** : section `#ange` (`judgmentInfo`, `runeRows` dans `data.js` ; `judgment()`
  dans `wiki.js`) et rubrique Enchantement ; sources / usages des résidus, coffres (`ITEMS[x].chest`) et de la Rune ;
  résidus listés en areas ≥ `JUDGMENT.fromArea` dans le tableau des blocs. Plus aucun objet « Pas encore obtenable ».
  wiki + crusher 21/21 ✅, Chromium sans erreur ✅. Mis en ligne le 22/10.


### Tours du Jugement : labyrinthe, brouillard, caméra, 10 min ; vérification « donjon » (Geoffrey) — branche `geoffrey/jugement-patch`, en ligne le 22/10
- **Config** `TOWER` : `duration` 900 → 600 (5 min demandées, infaisables : voir mesures) ; `unbreakablePct`
  remplacé par `mazeEvery: 2`, `mazeHard: 11` ; `view: { cols: 19, rows: 15 }`.
- **`src/sim/tower/world.js`** : lignes de mur à partir de `floor - 2`, toutes les 2 lignes, passage d'un tenant de
  `width - mazeHard` = 4 cases, jamais chevauchant le précédent.
- **`src/sim/tower/session.js`** : `G.seen` (extérieur connu, intérieur à 0), `revealAround` (rayon `discoverMax`,
  sans lumière) au départ et après chaque action ; le Dijkstra raisonne sur ce qui est découvert (case inconnue de
  l'intérieur = brique ordinaire, inconnue = pas d'air pour les chutes) ; `startMine` refuse un bloc incassable
  (attente 0,1 s puis replanification). Essai « attendre l'équipier au lieu de creuser le même bloc » : pire
  (13 étages au lieu de 17 en 5 min), pas gardé.
- **Vue / rendu** : `seen` envoyé (lignes de 0/1) ; `src/render/tower.js` : caméra 19 × 15 cases qui suit son mineur
  (glisse, saute si l'écart dépasse 12 cases, ex. projection), intérieur non découvert en noir.
- **Mesures** (`runTower`, 10 seeds, à 3) : 5 min / 6 s : base 0/10 (17 étages sur 30), minage 1,6 0/10 (25),
  minage 2,5 + 20 dégâts 1/10 ; 5 min / 3 s : minage 1,6 + 14 dégâts 4/10. **Retenu 10 min / 6 s** : base 0/10,
  minage 1,27 + 11 dégâts 3/10, minage 1,6 + 14 dégâts + 120 % attaque 10/10 (≈ 7,5 min), le même seul 0/10.
- ✅ Chromium : caméra rapprochée, brouillard, murs du labyrinthe visibles ; seul en stuff de base : échec affiché.
- **Vérification « donjon »** : aucune référence croisée entre `src/sim/tower/` et `DUNGEON` / `src/sim/dungeon.js`.
  L'« erreur » de ce matin = test `world.test.js` pas à jour avec les donjons en areas 4 et 5 (corrigé dans l'étape
  2) ; `dungeon.test.js` et `world.test.js` verts ; l'IA gère plusieurs donjons (`dungeonGoal` boucle sur
  `G.dungeons`). Spec : « donjon » remplacé par « tour » à deux endroits. Simulation 3 mineurs × 6 (skills mixed,
  stuff de base) : areas 4,0 en moyenne, profondeur 200 : **l'area 4 (et donc ses donjons) n'est jamais atteinte**, les
  donjons n'y sont pas testés en conditions réelles (seulement par `dungeon.test.js`). ⚠️ **1 blocage sans lien avec
  les donjons** : seed 23757, Bleu (logisticien) « Retour (treuil) » à (32, 157), t = 3445 s. Pas corrigé ici.
- **Tests** : `tests/tower.test.js` (labyrinthe, équipe équipée, solo très équipé, brouillard). Suite complète +
  anticheat : 659/659.
### Mine instantanée : découverte et caméra (Geoffrey) — branche `geoffrey/mi-decouverte-camera`, en ligne le 22/10
- **Simulation** (`src/sim/instant/session.js`) : `G.seen` (surface à 1), `revealAround(G, m)` (rayon
  max(1, discoverMax), comme `revealAround` de la mine normale en pleine lumière) au départ, après chaque action
  (`finish`) et à chaque tick. `ai.js` : un tas de plumes n'est un but que s'il est découvert.
- **Envoi** (`src/shared/instant-view.js`) : `seen` (lignes de 0/1) ; une case cachée part en 0 ; seulement les tas
  découverts ; `heapsLeft` = vrai nombre de tas (HUD, `src/ui/instant-hud.js`).
- **Rendu** (`src/render/instant.js`) : caméra qui suit le mineur du joueur (à défaut le premier), `miFrame` (cadrage pur,
  testé), `setRows` ; config `INSTANT_MINE.camCols` 24, `camMinRows` 14, `camEase`. `src/ui/fit.js` : `fitInstant`
  (largeur = camCols colonnes, lignes selon la hauteur) ; `fitCanvas` ne sert plus qu'aux tours.
- **Tests** : instant-mine (découverte, tas caché), instant-ui (envoi, cadrage), instant-server, camera : 42/42 ✅.
  Simulation MI à 1, 3, 20 mineurs : butin identique à avant ✅. Chromium 1440×900 et 390×844 en mode dev (« Ouvrir
  maintenant ») : mine noire, découverte autour du mineur, caméra qui suit, aucune erreur ✅.
- ⚠️ Pas de déplacement libre de la caméra en MI (molette) : elle suit toujours ton mineur.

### Concasseur : chances du créateur, plus de moyenne ni de temps estimé (Geoffrey) — branche `geoffrey/concasseur-taux`, ✅ en ligne le 22/10
- `CRUSHER.loot` (`src/config.js`) : gemmes 0,002 / 0,003 / 0,004 par gemme (= 0,6 / 0,9 / 1,2 % d'en avoir une), treasure
  0,005 / 0,003 / 0,005. `dropOdds` ne renvoie plus que `chance` (plus de `every` ni `sec`) ; `aboutTime` supprimé.
  Retirés : « 1 lot sur N · ≈ toutes les X » et la phrase sur les moyennes dans le « ? » (`src/ui/crusher.js`), colonnes
  « En moyenne » / « Soit environ » et le paragraphe sur les moyennes du wiki (`src/wiki/wiki.js`, `wiki.html`).
- Tests : crusher (chances, aide sans moyenne, fréquence sur 200 000 et 1 million de lots), wiki, anticheat : verts.
  ✅ Chromium : « ? » et wiki affichés sans moyenne, 0 erreur console.
- **Mise en ligne (22/10)** : demandée par Geoffrey ; `main` avait reçu la MI cachée / caméra : conflits seulement dans les 3 docs
  (journal, debug, état du projet : tout gardé) ; 145 tests du sujet + anticheat 71/71 verts après fusion.

### Enchantement : rune de qualité ≤ pièce (Geoffrey) — branche `geoffrey/enchantement-rune-rarete`, ✅ en ligne le 22/10
- `enchantError` (`src/meta/upgrade.js`) : `not_identified` (pièce sans `q`) puis `rune_too_rare` (`rune.q > piece.q`),
  après `already_enchanted`. Messages serveur dans `server/game/service.js` (`UPGRADE_ERRORS`). UI (`src/ui/upgrade.js`,
  `enchantWhy`, même règle) : texte d'aide, étiquettes « jusqu'à Rn », « à identifier », « trop rare pour cette pièce »,
  raison sous les cases ; wiki : paragraphe Enchantement.
- Tests : `rune.test.js` (table pièce/rune de R1 à R7, rien ne bouge en cas de refus ; `withRune` identifie la pièce),
  `anticheat/rune.test.js` (refus serveur, rune non consommée, acceptée à qualité égale) : verts.
  ✅ Chromium : R3 + rune R7 refusé, R6 + R3 accepté avec aperçu, 0 erreur console.
- **Mise en ligne (22/10)** : demandée par Geoffrey ; `main` n'avait pas bougé ; tests du sujet et anticheat verts.

### Mine instantanée : inscriptions 30 min avant, possibles en session (Geoffrey) — branche `geoffrey/mi-inscription-30min`, en ligne le 22/10
- **Config** `INSTANT_MINE.signupBefore` (1 800 s). `src/shared/instant.js` : `signupOpensAt`, `signupOpen`.
- **Serveur** (`server/instant/service.js`) : `join` refuse `signup_closed` hors fenêtre (sauf dev), n'exige plus
  d'être hors session ; quitte le groupe seulement hors session ; `open` fait quitter leur groupe à ceux qui entrent
  (`party.leave({ id })`, erreurs ignorées). `state` renvoie `signupAt` / `signupOpen`. `server/main.js` : plus de
  `game.onStart(… instant.drop)` (lancer ne désinscrit plus ; `onStart` reste dans le service de jeu, inutilisé).
  Un inscrit en session à l'heure est écarté par `openInstant` (déjà le cas) et son inscription effacée.
- **Navigateur** : `src/ui/instant-lobby.js` (`canSignup`, `clockText`, bouton « 🔒 Inscriptions à … », avertissement en
  session, rappel « inscriptions ouvertes », re-rendu à l'ouverture de la fenêtre) ; `src/ui/lobby.js` : le mode
  `scheduled` (MI) reste cliquable en lecture seule ; `src/main.js` : `canNotify` = pas pendant la MI, `inSession`.
- **Tests** : instant-server (fenêtre 11 h 29 / 11 h 30, inscription en session + mine ratée, lancer ne désinscrit plus,
  groupe quitté à l'entrée, aucune session après la MI), instant-ui (`canSignup`, `clockText`), lobby, party,
  anticheat/instant (pas de réinscription pendant la mine ; inscrit en mine pour la suivante = écarté) : ✅.
  Chromium (dev) : session lancée, lobby → Mine instantanée → S'inscrire en session ✅, aucune erreur.
  ⚠️ Bouton fermé « 🔒 Inscriptions à … » pas vu à l'écran (testé seulement par `canSignup`).


### Faux blocage « Retour (treuil) » (seed 23757) : détecteur corrigé (Geoffrey) — branche `geoffrey/fix-treuil-retour`, en ligne le 22/10
- **Symptôme** : `simulate --miners 3 --count 6 --skills mixed`, seed 23757 : ⚠ BLOQUÉ Bleu (logisticien),
  `{"t":3445,"x":32,"y":157,"mode":"return","status":"Retour (treuil)"}`.
- **Cause** (trace tick par tick, `scratchpad/stuck.mjs`) : pas de blocage. De 3300 à 3443 s, il redescend au front par
  le puits du treuil (y 9 → 158, deux combats de 15 et 28 s), puis passe en `return` (fin de session) et remonte sans
  arrêt jusqu'à la surface (3548 s). Le détecteur (`src/sim/diagnostics.js`) n'exemptait une descente que si le mode
  en FIN de fenêtre n'était pas `return`, et une montée que si y avait baissé sur TOUTE la fenêtre : la bascule
  descente → retour ne passait ni l'un ni l'autre.
- **Correction** : si le mineur passe en `return` pendant la fenêtre, la partie avant (descente ≥ 3 couches) et la
  partie après (montée ≥ 3 couches) sont jugées séparément. Sans bascule : règle inchangée.
- **Tests** : `tests/diagnostics.test.js` (+2 : descente puis bascule = pas bloqué ; immobile puis bascule = bloqué ;
  le premier échouait avant la correction). session, team : verts. Seed 23757 : 0 blocage (partie identique).
- ⚠️ Inefficacité notée (pas corrigée) : redescente de 2 min 30 à 5 min de la fin, pour remonter aussitôt.

### Fin de session : profondeur maximale par trajet (Geoffrey) — branche `geoffrey/fin-de-session-plus-haut`, en ligne le 22/10
- **Demande** : en fin de session, le mineur doit miner plus haut au lieu d'aller au front (seed 23757 : le logisticien
  repartait à 3295 s, descendait 150 cases par le treuil et remontait sans travailler).
- **`src/sim/ai.js`** : `depthCap(G,m)` = couches telles que (descente + remontée × 1,25) × secondes par couche ≤
  (1 − `CFG.endWorkShare`) × temps restant − 12 s ; secondes par couche = `m.secPerRow` mesuré à la dernière remontée
  (`m.returnFromY`, ≥ 10 couches), sinon 1,25 / vitesse de montée. **`m.tripCap` fixé quand il décide de repartir**
  (`decideSurface`, avant de rejoindre son puits : il peut tomber dans le treuil en chemin et passer en `work` sans
  `decideDeparture`, ligne `departure && y>0`). `decideWork` : pas de cible ni de descente sous `tripCap` ;
  `explore(G,m,k,cap)` ne prend que des galeries au-dessus. Départ refusé si temps restant < `endStayMin` ou
  `depthCap` < 3 (avant : temps restant < 2 × dernier retour + `minWorkTime`, supprimé de la config).
- **Erreurs en route** : cap recalculé à chaque décision → il remontait sans cesse de galerie en galerie (Rouge,
  130 s « Change de galerie ») : fixé par trajet. Premier test mesurait l'action « mine » seule (les pas dans la
  galerie ne comptaient pas) : mesure = tout sauf le trajet pur (retour, « Descend par l'existant », chute).
- **Tests** : `tests/session.test.js` (+1 : départ tardif ≥ 1/3 du trajet à travailler ; échoue sans la correction :
  Bleu 26 %). Suite complète + anticheat 669/669.
- **Simulation avant / après** (6 seeds) : solo minerais 365 → 362, valeur 406 → 396, profondeur 120 → 119 ; à 3
  (skills mixed) minerais 1074 → 1073, valeur 1470 → 1458, areas 4,00 → 3,83, 0 blocage des deux côtés.
## 22/10/2026 — Geoffrey — MI : galeries verticales, tas de plumes ignorés
- **Cause** : coût = temps de trajet seul + foule ; un bloc voisin coûte 0, la gravité et la montée (échelles) coûteuse → puits vers le bas. Foule à 0 : inchangé (18/18 au fond). Tas : seulement via les cases vides à ≤ 3 pas.
- **Correction** : cap par mineur (`heading`, `headPenalty`) ; `featherChase` : tas découvert ≤ featherReach (8), le plus proche l'emporte, creusement glouton vers lui.
- **Tests** : `tests/instant-mine.test.js` (+2 ; test featherReach : sol plat). Mesure 3 mineurs : fond 4/18 (avant 18/18), blocs/mineur 104 (avant 108), tas pris 9,3/9,5.


### Chutes connues de plus de 3 cases sans étourdissement (Jules) — branche `jules/fix-chute`, ✅ en ligne le 22/10
- **Symptôme** (retour joueur) : un mineur tombe de plus de 3 cases dans un trou déjà creusé par un autre et n'est pas
  étourdi. Mesure (script de sonde, 8 parties à 3, skills mixed, seeds 1 à 8) : 8 chutes connues > 3 hors treuil
  (6 « Creuse vers le bas », ex. seed 5 Vert 4 fois en (42, 10) ; 2 « Combat (bestiole) »).
- **Cause** : `stepFall` (`src/sim/actions.js`) ne voyait que le pas de côté et le minage sous les pieds. Debout sur une
  échelle, descendre (dy = 1) dans une case VIDE sans appui n'était pas vérifié : `deepFall` renvoyait faux, `digDown`
  / `fight` faisaient le pas, il tombait dans le puits connu d'un autre. Le pathfinder (`path.js`) respectait déjà
  `maxFall` ; c'est le pas direct de `digDown` (`stepDir(0,1)`) qui passait outre.
- **Correction** : `stepFall` gère aussi `dx = 0, dy = 1` vers une case vide sans appui (`fallInfo` de la case du
  dessous). `deepFall` refuse donc ce pas ; `digDown` se décale ou explore (code existant). Filet de sécurité
  (`decide`, `src/sim/ai.js`) : à l'atterrissage, étourdi si chute imprévue ≥ `stunFall` **ou** chute de plus de
  `maxFall`, même connue ; jamais en chantier de treuil (`winchJob`). GAME_DESIGN §3 « Chutes » mis à jour.
- **Tests** : `tests/fall.test.js` +3 (sur une échelle au-dessus d'un puits connu de 5 : refusé ; échelle plus bas :
  permis ; puits caché : permis ; chute connue de 7 sans appui : étourdi ; chantier du treuil : jamais étourdi). Les
  deux premiers échouaient avant la correction. fall, winch, session, team, mobs, diagnostics, dungeon, focus, miner :
  102/102 ✅.
- **Mesures après** : mêmes 8 parties, chutes connues > 3 hors treuil : 0 ✅ (restent les chutes du logisticien dans
  le puits du treuil, permises). `simulate --miners 3 --count 5 --skills mixed` : 0 blocage ✅, areas 4,0, profondeur
  198,8, étourdissements 11,4 / session.
- ⚠️ Pas traité ici : allers-retours colonne → treuil au départ du coffre (39 sur les 8 parties) ; corrigé par le commit
  `7c36a32` de Geoffrey (branche `geoffrey/retours-21-10`, pas en ligne ; sonde : 0 sur les seeds 2 et 4).
- **Mise en ligne (22/10)** : demandée par Jules ; `main` avait reçu « fin de session plus haut » (Geoffrey, `ai.js`) :
  fusion automatique du code, conflit seulement dans le journal (les deux entrées gardées). Après fusion : tests de la
  simulation 103/103 ✅, `simulate --count 5 --skills mixed` : 0 blocage, profondeur 199,8, étourdissements 11,4.
### Voir le stuff d'un ami (Jules) — branche `jules/voir-stuff-ami`, ✅ en ligne le 22/10
- **Serveur** : `game.profile(accountId)` (`server/game/service.js`) renvoie `{ stuff (worn), progress (publicProgress),
  skills (skillRanks) }`, lecture seule, sans verrou (comme `state`). `social.profile(me, id)` (`server/social/service.js`)
  passe par `friendOf` (refus `not_friend` 404 si pas ami, ID invalide ou soi-même), ajoute `id`, `displayId`, `name`.
  Route `POST /api/social/profile { id }` (`server/social/routes.js`), `socialApi.profile` (`src/net/api.js`).
- **Navigateur** : `src/ui/stuff.js` exporte `renderSlots(el, worn, tag)` (cases + portrait ; `tag 'div'` = lecture
  seule) et `statsHTML(worn, effects)` (tableau des stats), utilisés par l'onglet Stuff (rendu identique à avant) et par
  la fiche `#fview` (`src/ui/social.js`, `showProfile`, bouton `data-profile` ; `index.html`, `style.css`).
- **Tests** : `tests/social.test.js` (+1 : fiche d'un ami hors ligne, pièce portée, niveau 2, skills ; rien de
  l'inventaire, clés exactes ; refus pas ami / ID bidon / soi-même / ami retiré ; HTTP 200 et 401) : 14/14 ✅.
- ✅ Chromium (mode dev, 2 comptes, pioche légendaire équipée) : fiche affichée à 1440×900 et 390×844, bulle d'info de
  la pièce, stats, niveau, « Fermer » et clic à côté ferment ; 0 erreur console. ⚠️ Spécialisation affichée pas vue à
  l'écran (le compte de test n'avait pas de point de skill ; `treeText` est simple).
- **Mise en ligne (22/10)** : demandée par Jules ; `main` avait reçu « fin de session plus haut » et `jules/fix-chute` :
  conflits seulement dans le journal et le debug (tout gardé).

### Treuil : l'IA sortait du seau (Jules) — branche `jules/treuil-vitesse`, ✅ en ligne le 22/10
- ❌ **Retiré le 22/10** (décision Geoffrey et Jules : la vitesse ne change pas) : voir « Treuil : retour à 0,85 » plus bas.
  Le correctif du détecteur (long combat) est gardé.
- **Symptôme** (retour joueur) : les mineurs sortent du treuil quand il y a une colonne d'échelles ou un trou profond
  à côté.
- **Cause** : pas un bug de l'IA, le coût était juste. Seau = `WINCH.speedFactor` 0,85 × `climbSpeed` = 1,9 case/s ;
  échelle = 2,25 ; chute = 8 (≤ 3 cases). `search` (`src/sim/path.js`) prenait donc l'échelle d'à côté, ou un trou
  avec des échelles espacées (chute de 2 + 1 case d'échelle ≈ 0,23 s/case contre 0,53 dans le seau).
- **Correction** : `WINCH.speedFactor` 0,85 → 2 (`src/config.js`) : 0,22 s/case, sous l'échelle (0,44) et sous le
  trou à échelles espacées. Pas d'« adhérence » au seau dans l'IA (choix de Jules : la vitesse seule).
- **Détecteur de blocage** (`src/sim/diagnostics.js`) : avec le seau plus rapide, l'équipe atteint le minotaure ;
  le combat dure > 90 s sans miner → faux blocage (seed 39595, Rouge, t = 3305). Nouveau : frapper (action `attack`)
  au moins `STUCK_FIGHT_SHARE` (50 %) de la fenêtre = pas un blocage.
- **Tests** : `tests/winch.test.js` +2 (descente / montée avec une colonne d'échelles collée au puits ; trou à échelles
  espacées : le chemin reste en x = 25 ; les deux échouaient avant, chemin en x = 26), valeurs 0,85 → 2 ;
  `tests/diagnostics.test.js` +2 (long combat : pas bloqué ; quelques coups puis immobile : bloqué). winch, fall,
  team, session, diagnostics : ✅.
- **Simulation** `--miners 3 --count 5 --skills mixed` : avant minerai 1 186 / partie, profondeur 199,8, 0 blocage ;
  après 1 407 (+19 %), profondeur 214,4, 0 blocage (après correction du détecteur ; seed 39595 rejouée seule).
- ⚠️ Gain d'équilibrage important pour un seul skill ; le solo sans skills ne change pas.

### Focus area « Plus profond » ne visait pas l'area la plus profonde (Jules) — branche `jules/focus-plus-profond`, ✅ en ligne le 22/10
- **Symptôme** (retour joueur) : « Plus profond » ne cible pas l'area la plus profonde. Mesure (sonde : part du temps
  en mode work hors de la dernière area débloquée, 50 premières minutes, seeds 7919…39595) : 29 % en solo, 55 % à 3.
- **Cause** : sans focus d'area, `focusArea` = null → aucune contrainte ; `decideWork` prend tout filon connu à portée
  (`oreReach`, `range` 3 en descente) dans n'importe quelle area avant de descendre.
- **Correction** (`src/sim/focus.js`) : `deepArea(G,m)` = dernière area débloquée, plafonnée à `areaOf(m.tripCap)` (fin
  de session, règle de Geoffrey) ; null si focus d'area, focus minerai actif, ou area vidée (`areaDepleted`).
  `workArea = focusArea ?? deepArea`, utilisée par `focusGoal`, `inFocus` et `focusStop` (`src/sim/ai.js`).
  `dropDepleted` ne touche qu'au focus d'area choisi. Texte du panneau (`src/ui/focus.js`).
- **Détecteur de blocage** (`src/sim/diagnostics.js`) : faux blocages en areas 4-5 (attente du barbare 77 s puis
  occultiste ; minotaure + étourdi) → `busy` = action `attack` ou `stun`, ou statut « Attend le barbare devant le
  donjon » ; ≥ `STUCK_BUSY_SHARE` (50 %, ancien `STUCK_FIGHT_SHARE`, attaque seule) de la fenêtre = pas bloqué.
- **Test fall « session complète »** : seed 23757 solo, chute connue de 4 = il tue le mimic sur lequel il se tient
  (appui disparu, voulu par la règle du 22/10). Ne compte plus que les chutes provoquées (action précédente `move` ou
  `mine`). Passe aussi sur `main`.
- **Tests** : focus +4 (deepArea et suivi des déblocages, exceptions, fin de session, il quitte un filon de l'area 0
  pour l'area 1 : échoue avec l'ancien comportement) ; diagnostics +2. diagnostics, focus, team, session, fall, winch,
  dungeon : ✅.
- **Mesures** (sonde valeur = coffre × val, 5 seeds ; main avec seau ×2) : solo valeur 414 → 352, minerai 393 → 356,
  hors dernière area 29 → 17 % ; à 3 (skills mixed) valeur 1 762 → 1 502, minerai 1 396 → 1 037, areas 4,0 → 5,0,
  profondeur 214 → 265, hors dernière area 53 → 23 %. `simulate --miners 3 --count 5 --skills mixed` : 0 blocage
  (après le détecteur ; seeds 23757 et 31676 rejouées).
- ⚠️ À voir : attente du barbare devant le donjon jusqu'à 0 d'oxygène (préexistant).

### Résidus visés par l'IA au poids du treasure (Jules) — branche `jules/residus-poids`, ✅ en ligne le 22/10
- **Demande** : poids des résidus dans le choix des cibles = celui du treasure.
- **Avant** : résidus = terrain sans `val`, `isTarget` faux → jamais visés, minés seulement sur le chemin.
- **Changement** : `src/config.js` : `TREASURE_VAL` (12) pour le treasure et `val` des résidus 12 et 13 ;
  `src/sim/world.js` : `isResidue` (family 'residu'), `isTarget` les inclut ; `src/sim/ai.js` : statut « Va chercher
  un résidu ». Comme le treasure : visés une fois découverts (`G.seen`), la boussole ne les signale pas, `targetVal`
  les garde en focus « Uniquement » (pas des minerais). Toujours `terrain` : pas de Fortune, pas de shiny, hors
  déblocage et hors focus minerai. Scripts `weights` / `stat-values` : inchangés (filtre type 'ore').
- **Tests** : `tests/judgment.test.js` +3 (poids = treasure, y compris en « Uniquement » ; visé face à un charbon plus
  proche ; non découvert = ignoré ; les deux premiers échouaient avant). judgment, treasure, focus, world : ✅.
- **Simulation** (sonde, 5 seeds à 3, skills mixed) : résidus au coffre 4,2 → 10,8 / session, valeur minerais 1 502 →
  1 457 (−3 %), minerai 1 037 → 1 042, 0 blocage (détecteur de `simulate`, mêmes seeds que `--count 5`) ✅.

### Chat de session (Jules) — branche `jules/chat-session`, ✅ en ligne le 22/10
- **Quoi** : chat des joueurs d'une session, en mémoire seulement.
- **Fichiers** : `CHAT` (`src/config.js` : maxLen 200, keep 50, gapMs 1000, poll 3000, ttlMs 3 h) ;
  `src/shared/chat.js` (`cleanChatText` : chaîne, caractères de contrôle / bidi / zéro largeur → espace, espaces
  resserrés, 1 à maxLen caractères comptés en points de code, sinon null) ; `server/game/chat.js` (`createChat` :
  salon par id de session, numéros croissants, cadence par compte, oubli après ttlMs sans message, `drop`) ;
  `server/game/service.js` (`chatPost` : session `running` de `activeOf`, nom pris dans `rec.players` ; `chatGet` :
  `running` ou `settling` ; `chat.drop` à la fin dans `settleWith` et quand tous sont partis) ; routes
  `GET /api/game/chat?after=N`, `POST /api/game/chat` ; `src/net/api.js` (`chat`, `say`) ; `src/ui/chat.js`
  (relu toutes les 3 s, ×5 onglet caché ; `gen` pour ignorer une réponse d'une session précédente ; texte échappé) ;
  `index.html` (#chatCard dans `.runR`) ; `src/main.js` (start dans `enterSession` hors MI / tour, stop dans
  `showNoSession` et `showResult`) ; style.
- **Tests** : `tests/chat.test.js` (9 : texte, balisage gardé tel quel, salon / keep / numéros, cadence, oubli,
  service : nom serveur, hors session / parti refusés, invalides et trop rapides, effacé à la fin) ;
  `tests/game-http.test.js` +1 (401 sans compte, 404 sans session, écrire / relire après N, 429, 400). chat,
  game-service, game-http, security, boot-check, blocked-names, nav : ✅. Vérifié dans le navigateur (`npm run dev`,
  playwright) : message affiché, `<b>` échappé, nom en vert pour soi.
- **Points fragiles** : perdu au redémarrage du serveur (en mémoire, voulu) ; la cadence est par compte, toutes
  sessions confondues ; pas d'affichage MI / tour.

### Treuil : retour à 0,85 (Jules) — branche `jules/treuil-vitesse-retour`, ✅ en ligne le 22/10
- **Quoi** : `WINCH.speedFactor` 2 → 0,85 (`src/config.js`). Le symptôme d'origine revient (l'IA peut quitter le seau
  pour une colonne d'échelles ou un trou à échelles espacées : coût réel plus faible, voir l'entrée « Treuil : l'IA
  sortait du seau »). Si l'équipe veut l'éviter sans toucher la vitesse : piste « adhérence » au seau dans `search`
  (`src/sim/path.js`), non faite.
- **Gardé** : détecteur de blocage (combat, étourdi, attente du barbare = occupé).
- **Tests** : `tests/winch.test.js` : valeurs 0,85, les 2 tests « il reste dans le seau » retirés (plus vrais).
  winch, fall, focus, diagnostics, judgment, team : 75/75 ✅.
- **Simulation** `--miners 3 --count 5 --skills mixed` (avec « Plus profond » et résidus) : 0 blocage, areas 4,0,
  profondeur 229,6. Les chiffres « Plus profond » et résidus du 22/10 mesurés avec le seau ×2 sont à relire avec
  ça : « Plus profond » à 3 = 1 431 → 1 087 de valeur (−24 %) au seau 0,85.

### Seuil d'ouverture 60 % (Geoffrey) — branche `geoffrey/quota-treuil`, ✅ en ligne le 22/10
- **Contexte** : seed 1102884141, équipe de 3 sans nouveau stuff jusqu'à l'objectif « Area 6 ». La seed est ordinaire
  (même résultat que 7919…31676) ; la cause est le seau ×2 (`314e651`) + « Plus profond » (`571a12b`). Mesure
  `simulate --miners 3 --skills mixed`, 5 seeds dont 1102884141 : main de 16 h 44 (`4ce6819`) areas 4,0, prof 198 ;
  main de 19 h areas 4,8, prof 262.
- **Fusion** : le retour du treuil à 0,85 avait été mis en ligne entre-temps par Jules (`6322421`, entrée
  précédente) ; conflits résolus en gardant ses textes pour le treuil, seul le seuil 60 % vient de cette branche.
- **Quoi** : `CFG.unlockRatio` 0.4 → 0.6 (`src/config.js`).
- **Tests** : `world.test.js` : objectif 12 / 240. `session.test.js` : sessions
  solo de régression (seeds 65361775, 823773703, 63352, 7919) : ≥ 1 area ouverte (avant ≥ 2 ; à 60 % un mineur de
  base solo n'ouvre que l'area 1). winch, wiki, focus, session, world, team, diagnostics, dungeon, fall : ✅ 107/107.
- **Simulation** (5 seeds de référence, 0 blocage) : 3 mineurs skills mixed : areas 4,0, prof 212,8 ; 2 mineurs skills mixed : areas 3,0, prof 165,8 ; 1 mineur de base :
  areas 1,0, prof 95,4 (area 1 : 159 à 235 / 240).
- **Points fragiles** : solo débutant limité aux areas 0-1 ; le wiki (`src/wiki/data.js`) lit `CFG.unlockRatio`, le
  texte de `wiki.html` est écrit à la main (mis à 60 %).

### Mine qui rétrécit et grandit en boucle sur téléphone (Jules) — branche `jules/fix-mine-mobile`, ✅ en ligne le 22/10
- **Cause** : `fitMine` (`src/ui/fit.js`) prend la hauteur de `#cvWrap` pour choisir le nombre de lignes. Sur
  téléphone (≤ 700 px), `#cv` est `position:static` : la boîte prend la hauteur du canvas affiché, donc la mine se
  calait sur sa propre taille. `H = floor(rows × 16 × s)` tombe sous `rows × 16 × s` → `floor(h / (16 s))` = une
  ligne de moins à chaque appel (toutes les 120 ms), jusqu'à minRows (20) ; et au 1er appel la boîte vaut la taille
  du dessin non calé (544 px) → 48 lignes. Le test `> 60` censé détecter « sans hauteur imposée » ne marchait donc
  jamais. Reproduit dans le navigateur (playwright, 393×852 dpr 2,625 : 37 → 20 lignes en 2 s, regrandit au
  rechargement) ; en simulant fit.js : la taille dérive dans 87 % des cas (largeurs 300–440, dpr 1,5–4).
- **Correction** : hauteur imposée seulement si `getComputedStyle(cv).position === 'absolute'` (ordinateur et
  écrans moyens) ; sinon le nombre de lignes ne bouge plus (34 = `VIEW_ROWS`), la mine se cale sur la largeur.
- **Tests** : `tests/fit.test.js` (nouveau, 3 : téléphone stable pour largeurs 300–440 × dpr 2 / 2,625 / 3, échouait
  avant ; largeur remplie ; écran large inchangé) ✅. Navigateur : 360 / 390 / 393 / 412 / 430 px stables à 34
  lignes ; 1280–1920 px inchangés (36–40 lignes selon la hauteur) ; écrans moyens (800–1024, et paysage 852×393) :
  la hauteur vient des panneaux, la barre d'adresse (±56 px) ne change rien ✅.
- **Non vérifié** : `fitInstant` (mine instantanée) et `fitCanvas` (tour) gardent le test `> 60` ; sur téléphone
  `#miRun` / `#twRun` restent `position:fixed`, leur boîte peut suivre le canvas quand il est plus petit que la place
  → même dérive possible. Pas reproduit (pas de signalement).

### Recherche de groupe (LFG) (Geoffrey) — branche `geoffrey/lfg`, ✅ en ligne le 22/10
- **Quoi** : file d'attente pour former un lobby de 3 (mine classique). Règle pure `matchLfg(queue, max)` dans
  `src/shared/lfg.js` (groupe le plus ancien + solos les plus anciens, sinon `max` solos, l'hôte = le premier) ;
  `queueTime(ms)` pour le timer.
- **Serveur** (`server/party/service.js`) : `queue` (en mémoire, clé = solo ou chef d'un groupe de 2 ; on garde la
  liste des membres à l'entrée), `found` (« groupe trouvé », `PARTY_SERVER.lfgNotice` = 1 min), `boot` (uuid du
  démarrage). `lfgValid` : l'équipe (membres) doit être identique à l'entrée, pas en lancement, et c'est le chef.
  `pruneLfg` : `lfgTimeout` 30 s sans `state()` du joueur, équipe changée, un membre en session. `runLfg` (verrou
  `matching`) est appelé dans `state()` et `lfg()` : forme les lobbys (`formLobby` : invités retirés de leur groupe
  d'un joueur, poussés dans celui de l'hôte, créé si besoin), puis `autoLaunch` si l'hôte a `auto` (même chemin que
  `launch` : `p.launching`, `grace`, erreur gardée dans `found.error`). Actions `lfg(me, { auto })` (refus :
  en session, groupe complet, pas chef ; re-cliquer garde `at`) et `lfgCancel`. `state()` renvoie `lfg: { boot, search,
  found }`. Routes `POST /api/party/lfg`, `POST /api/party/lfg/cancel`.
- **Navigateur** : `partyApi.lfg/lfgCancel` ; `lfgState()` exportée par `src/ui/lobby.js` (bouton, timer, annuler) ;
  `#lfgBtn`, `#lfgAutoRow`, `#lfgStatus` dans `index.html` ; `lfgWant` : si `boot` change pendant sa recherche
  (serveur redémarré), le lobby la relance. `src/main.js` : pop-up « Groupe trouvé » (`setLfgFound` / `syncNotifs`,
  fusionnée avec les notifications Social).
- **Tests** : `tests/lfg.test.js` (17 : règle, 3 solos, groupe de 2 prioritaire, solo avec code, membre, complet / en
  session, annuler / pas de double entrée, équipe changée, onglet fermé, auto du chef seulement, auto qui échoue,
  routes, boot) ; `tests/lobby.test.js` +2. lfg, lobby, party, server : 52/52 ✅. Essai HTTP sur un vrai serveur
  (`DIM_DATA_DIR` temporaire, 3 invités) : lobby formé chez le premier, session lancée pour les 3 ✅.
- **Pas vérifié** : ⚠️ rendu du panneau dans le navigateur (pas ouvert à l'œil).
- **Points fragiles** : la file est perdue au redémarrage (voulu, `boot`) ; le signe de vie est le `GET /api/party`
  du lobby (toutes les 2,5 s, ×2 en session) : un onglet en arrière-plan très ralenti par le navigateur peut sortir
  de la file après 30 s. Le groupe d'un membre peut changer pendant l'`await` de `pruneLfg` : `lfgValid` est relu
  juste avant de former le lobby.

### Trésors des tours au lieu des coffres (Geoffrey) — branche `geoffrey/tresor-tour`, ✅ en ligne le 22/10
- **Quoi** : le boss d'une tour donne `treasureItem(side, q)` (« Trésor démoniaque R5 ») au lieu de `chestItem`.
  `src/config.js` : `RUNE.treasures`, `RUNE.treasureRarity = 'unique'`, `TREASURE_ITEMS` (`stack:false`,
  `chest:{side,q}`, `treasure:true`) ; 6e rareté `unique` (`#c0480f`) dans `RARITY.tiers` (+ `style.css`, `wiki.css`).
  Anciens `CHEST_ITEMS` gardés (empilables, ouvrables, plus donnés, cachés du wiki).
- **Affichage** : `src/meta/piece.js` `treasureOf`, `itemName` (« Antique Trésor démoniaque »), `itemColor` (couleur
  de la qualité) ; `pieceName` / `pieceColor` s'en servent ; `src/ui/rarity.js` `rname` : texte par défaut =
  `itemName`, couleur de la qualité en style. Inventaire (bulle native), wiki (`item()`). Textes « coffre » des tours →
  « trésor » (wiki, lobby, Jugement, Amélioration, fin de tour, Quitter). `scripts/give-admin.js --chests` donne des
  trésors.
- **Anti-duplication** : un trésor est une case avec `uid` ; `sanitizePiece` le garde (`{ item, uid }`, sans
  qualité : elle est dans le nom). Sans ça, il disparaissait au rechargement de l'inventaire. uid en double refusé,
  quantité > 1 ramenée à 1 (comme le stuff). Ouverture inchangée (`openTreasure` par nom, idempotente par opId).
- **Tests** : `tests/rune.test.js` +2 (noms, couleurs, rareté, non empilable, relecture, ouverture, ancien coffre),
  `rarity`, `wiki`, `game-service` (tour → trésor) adaptés. rune, rarity, wiki, inventory, game-service, lobby,
  judgment : 99/99 ✅ ; `npm run test:anticheat` 72/72 ✅.
- **Pas vérifié** : ⚠️ rendu dans le navigateur (couleur du nom, contour Unique) pas regardé à l'œil.
- **Points fragiles** : le nom interne (« … R5 ») reste celui qui circule (sacs, historique, routes) ; tout nouvel
  affichage d'un nom d'objet doit passer par `rname` / `itemName` pour montrer « Antique Trésor démoniaque ».

### Piège (Geoffrey) — branche `geoffrey/piege`, ✅ en ligne le 22/10
- **Quoi** : `src/sim/trap.js` (nouveau) : `planTraps(seed, k, dungeon)` (rng `hash(seed,k+1) ^ TRAP.salt`, 2 tirages,
  30 essais de placement : marges, colonne du treuil ± 2, ni contre le donjon ni contre l'autre piège à 1 case près),
  `carveTrap` (salle → air, case d'air de la paroi → terrain principal), `registerTrap` (G.traps, G.veil = cases de la
  salle cachées), `updateTraps` (chaque tick : une case de paroi à 0 → `spring`), `spring` (tout `seen`, 5 mobs posés sur
  le sol de la salle avec `trap`, `hunt` = mineur le plus proche du trou, `speed`). Les mobs n'existent dans `G.mobs`
  qu'après le déclenchement (rien à cacher dans la vue, le rendu, l'IA). `world.js` : donjon et pièges partagent `put`
  (comptes de l'area). `session.js` : `revealAround` saute `veiled`, `updateTraps` entre les mineurs et les mobs.
  `mobs.js` : `preyOf` → `o.hunt` après la provocation ; `inChase` (pas de limite mobChaseRange pour la cible chassée) ;
  `stepOf` (mobStep / speed) ; walkerCap sans les mobs de piège. `ai.js` : `goFight` (sorti de `helpAlly`), `trapGoal`
  (barbare, dans `decideWork` avant `dungeonGoal`), `fight` : un mob de piège inapprochable est ignoré tout de suite.
  `TRAP` en config ; wiki (donjon → « Les pièges », `trapInfo`).
- **Tests** : `tests/trap.test.js` 12/12 (tirage, placement, génération et comptes, caché, déclenché, trou en hauteur,
  mob inapprochable, mimic, vitesse et chasse sans limite, hors quota et minuteur, barbare Fuir sans Aider allié, sans
  barbare). `world.test.js` : « minerais exacts » ne vaut plus pour une area avec piège (comme le donjon). Voisins :
  world, mobs, goblin, dungeon, treasure, judgment, view, diagnostics, focus, winch, team, session, wiki : ✅.
- **Vérification** : ✅ 5 sessions à 3 (seeds de référence) : ~3 pièges générés, ~2,8 ouverts, les 5 mobs toujours tués
  (70–250 s par piège) ; profondeur 212,8 (215,4 après la correction ci-dessous, 0 blocage) contre 214,6 sans pièges, areas 4,0 partout. `--skills mixed` :
  combat plus court (~110 s contre ~150 s). ❌→✅ seed 15838 : faux « BLOQUÉ » (Rouge au-dessus de la salle, mobs
  coincés dessous, 15 s d'attente par mob) corrigé par l'abandon immédiat du mob inapprochable.
- **Points fragiles** : les seeds de non-régression des areas ≥ 1 ne jouent plus exactement la même partie (cases de
  salle vidées) ; un mineur qui tombe par le haut dans la salle se bat à 5 contre 1 ; ⚠️ pas regardé dans le
  navigateur (coin noir, apparition des mobs).
- **Mise à jour (fusion du seuil 60 %)** : simulation 3 × 5 avec pièges → 2 blocages (sans pièges : 0), corrigés dans
  `src/sim/ai.js` (règles générales de l'IA, pas du piège) :
  - seed 23757 (Rouge, area 3) : `explore` reprenait à chaque décision la galerie la plus proche de SA ligne → 153 ↔ 152
    (le chemin de l'une passait par l'autre). Il garde maintenant `m.galleryRow` tant qu'elle est dans le pool. Puis le
    chemin vers la ligne 153 passait par la ligne 151 (area 2) : `focusGoal` (« Plus profond ») le rappelait → `onTheWay`
    vaut aussi pour la galerie (`m.exploring` et `galleryRow` dans l'area visée), comme pour une cible de minerai ;
  - seed 15838 (Bleu, t 3425) : galeries restantes toutes sous `depthCap` → « Plus rien à explorer » ~100 s avec
    45 de charge. S'il reste des lignes non finies plus bas que le plafond, il remonte (« fin de session »). Une area
    vraiment finie garde l'ancien comportement.
  - **Tests** : `team.test.js` +2 (seeds 23757 et 15838 à 3, aucun blocage) ; trap, world, mobs, dungeon, winch,
    session, focus, diagnostics, team, wiki : 120/120 ✅.
  - **Vérification** : ✅ 3 × 5 : areas 3,0, profondeur 192,0, 0 blocage (sans pièges : 3,6 / 199,8) ; `--skills
    mixed` : 3,6 / 201,0, 0 blocage (sans pièges : 4,0 / 212,8). ⚠️ les deux corrections changent l'IA pour toutes
    les parties (l'engagement sur la galerie surtout) : à surveiller.

### Équilibrage du 21/10 (Geoffrey) — branche `geoffrey/retours-21-10`
- **État au 22/10** : chances du concasseur remplacées à la fusion par celles de main (décision du 22/10) ; pioches ×2,
  ceinture +10 torches, passerelles illimitées gardées.
- **Quoi** : concasseur (terre gemmes 0,2 % / T1 0,1 % ; pierre 0,3 % / T2 0,1 % ; pierre dure 0,4 % / T2 0,15 %) ;
  pioches ×2 (pierre +0,2, fer +0,4) ; Ceinture en peau de gobelin `torches:+10` (au lieu de `discoverMax:+1`) ;
  passerelles illimitées : `STATS.bridges = Infinity` (la décrémentation laisse Infinity ; JSON → `null`, le HUD
  affiche « passerelles illimitées ») ; stat retirée de `shownStats`, du réglage dev et de `scripts/weights.js`.
- **Fichiers** : `src/config.js`, `src/ui/hud.js`, `scripts/weights.js`, `src/wiki/data.js`, GAME_DESIGN (§2, §3, §6).
- **Tests** : crusher, blueprint, stuff mis aux nouvelles valeurs ; fall (+1 : passerelles illimitées) ; tier2, view,
  wiki, craft, anticheat open/crusher : 89/89 + fall 12/12.
- **Vérification** : ✅ simulation 3 × 5 : areas 3,4, profondeur 182,2 (avant 183,2), allers-retours 26,6, 0 blocage.
- **Points fragiles** : un réglage dev qui remettrait `bridges` fini n'existe plus ; si un coût est ajouté un jour,
  remettre la stat dans `shownStats`.
- **Fusion de main (Jules, 21/10)** : ménage des textes intégré (conflits HUD / test de l'épée réglés). Deux tests
  attendaient encore les anciennes pioches : `tests/skills.test.js` (Stuff × skills : 1,27 → pierre, 1,48 → fer) et
  `tests/research.test.js` (Pioche en fer BP : +0,4). blueprint, wiki, world, research, lobby, stuff, crusher, skills,
  fall : 90/90 ✅. ⚠️ `npm run test:anticheat` pas relancé (le concasseur a bougé) : à faire avant la mise en ligne.

### Donjon aussi en area 4 (Geoffrey) — branche `geoffrey/retours-21-10`
- **État au 22/10** : remplacé à la fusion : main avait 100 % en areas 4 et 5 ; décision Geoffrey : **33 %** par area,
  tirages indépendants (`DUNGEON.chance` 0.33 ; `tests/dungeon.test.js` : taux 30–36 % par area, 8–14 % les deux).
- **Quoi** : `DUNGEON.areas = [4, 5]` ; tirage par area (`hash(seed, k+1) ^ salt`), donc indépendant (≈ 4 % des seeds
  en ont deux). Rien d'autre à changer : `planDungeon`/`registerDungeon` travaillaient déjà par area.
- **Piège corrigé au passage** : `tests/helpers.js` `worldFrom` vide aussi `G.dungeons` (la seed 1 a maintenant un
  donjon en area 4 : les mondes dessinés en texte gardaient sa fiche alors que ses cases avaient disparu).
- **Outil** : `scripts/simulate.js` affiche une ligne « donjon area k pas vu / découvert / vaincu » (areas débloquées).
- **Tests** : `tests/dungeon.test.js` 12/12 (taux ≈ 20 % en area 4 et en area 5, ≈ 4 % les deux, aucune autre area).
- **Vérification** : ✅ simulation 3 × 5 (seeds standard, aucune n'a de donjon en area 4) : identique, 0 blocage.
  ✅ seeds 3, 16, 20 (donjon en area 4) sans skills et `--skills barbare` : 0 blocage ; le donjon n'est pas vu dans ces
  sessions (seed 16 : area 4 atteinte mais pas la salle). ⚠️ Pas encore vu un donjon d'area 4 découvert en simulation.
- **Hors sujet, déjà là avant** : seed 16 `--skills mixed` → blocage « Retour (treuil) » (Bleu, t 3225 s, x 25 y 16) :
  voir l'entrée treuil.

### Ténacité, Force brute, provocation (Geoffrey) — branche `geoffrey/retours-21-10`
- **Quoi** : `STATS.tenacity = 0` (%) ; nœud Barbare `damage` : `adds:{ tenacity:5 }` (nouveau champ de nœud : points
  ajoutés par rang, appliqués par `withSkillStats` après les multiplicateurs ; `{tenacity}` dans `desc`, rendu par
  `nodeText`). `resists(G,m)` (src/sim/mobs.js) : un tirage `G.rng` par sort, **aucun tirage si ténacité 0** (parties
  sans ténacité : hasard identique). Vol du gobelin : le vol est sauté. Occultiste : il se téléporte, pose son
  cooldown, mais ne canalise pas. Provocation : `provoke` interrompt la canalisation à **chaque** coup (même déjà
  provoqué) et ne bloque plus le sort (`o.taunt` retiré des conditions de `occult`). Stats `resisted` (mineur, partie).
  Onglet Stuff : « Ténacité » affichée, apport des skills en « +x % » bleu. Wiki : texte de la stat, source Force brute.
  `scripts/simulate.js` : `giveTree` passe par `withSkillStats` (avant : calcul à la main, sans ténacité) ; « résisté ».
- **Fichiers** : `src/config.js`, `src/meta/skills.js`, `src/sim/mobs.js`, `src/ui/stuff.js`, `src/wiki/data.js`,
  `scripts/simulate.js`, GAME_DESIGN §3 et §5.
- **Tests** : mobs (provocation réécrite + 3 : interruption à chaque coup, ténacité 100 %, proportion 15 % et aucun
  tirage à 0), skills (+1 : texte, `withSkillStats`, onglet Stuff, session) ; stuff, wiki : 46/46.
- **Vérification** : ✅ simulation 3 × 5 sans skills : identique (182,2, 0 blocage). ✅ `--skills barbare` 3 × 5 : ≈ 15 %
  des vols ignorés (ex. 48 volés / 8 résistés) ; étourdissements 11,0 → 11,6, areas 3,6 → 3,4, profondeur 186 → 182,4
  (l'occultiste n'est plus neutralisé par la provocation), 0 blocage.
- **Points fragiles** : un sort ignoré coûte quand même le cooldown de l'occultiste (choix : « sort perdu »).

### IA : travailler dans la dernière area, focus minerai vers la plus profonde (Geoffrey) — branche `geoffrey/retours-21-10`
- **État au 22/10** : ❌ **pas mis en ligne**. À la fusion avec main, conflit avec « Plus profond » de Jules (même idée,
  déjà en ligne, `deepArea`/`workArea` dans `focus.js`) : on garde la version de main (décision Geoffrey). Ce qui suit
  est l'historique ; `CFG.transitReach` et les tests associés sont retirés.
- **Constat** (avant) : priorité « Minerais » (défaut) → en redescendant, le mineur visait tout filon à portée de
  boussole dans les areas du dessus. Mesures (3 mineurs, `arrive.mjs` : déblocage → 1re entrée) : seed 31676 area 4
  débloquée à 2985 s, jamais visitée ; seed 15838 area 3 débloquée à 2050 s, Rouge y entre à 3397 s.
- **Quoi** : `workArea(G,m)` (src/sim/focus.js) = focus d'area, sinon la plus profonde des areas débloquées qui a encore
  un minerai visé, sinon la dernière débloquée. `focusGoal` (focus minerai) renvoie `workArea` (avant : la plus proche).
  `decideWork` : `inFocus(y,x,t)` accepte une cible de l'area de travail, ou d'une area au-dessus si elle est à
  ≤ `CFG.transitReach` (1) du mineur ; sans focus, un coffre au trésor (non-ore) reste visé partout. Rien au-dessous.
  Décision du créateur : « il prend ceux collés à son chemin ».
- **Détecteur de blocage** (src/sim/diagnostics.js) : une descente de ≥ 3 couches compte comme progrès même si le
  mineur vient de passer en retour (faux positif seed 7919 : 90 s de descente sans miner puis « fin de session »).
- **Tests** : focus 25/25 (plus profonde, `workArea`, passage : charbon collé pris, or à 3 cases laissé, il atteint
  l'area 1) ; team, diagnostics, winch, fall, mobs, goblin, dungeon, miner, treasure, session, skills, world : 126/126.
- **Vérification** : ✅ simulation 3 × 5 : areas 3,4 → **4,0**, profondeur 182,2 → **225,8**, allers-retours 26,6 → 24,2,
  0 blocage ; minerai total en baisse (seed 31676 : 1 119 → 976) mais plus profond. Arrivée dans l'area 4 : 1 à 7 min
  après son déblocage (vers 37 min). ✅ `--focus coal:only` (7919, 31676) : profondeur 201 → 225, charbon −10 à −20 %,
  0 blocage.
- **Points fragiles / à surveiller** : ⚠️ équilibrage : l'area 4 est atteinte à chaque session avec 3 mineurs de base
  (≈ 150 / 500 minerais, 200 pour débloquer l'area 5, la dernière) → le cap « ne pas finir en un essai » est plus
  proche. Un mineur qui redescend alors qu'il reste peu de temps fait un aller-retour presque à vide (déjà là avant).

### Treuil pas pris à la redescente (seed 1250570735, Geoffrey) — branche `geoffrey/retours-21-10`
- **Cause** (`--skills mixed`, `winch.mjs` : chaque descente, temps dans le seau) : Rouge (secteur x 8) faisait 4
  descentes sur 7 en « 17 s jusqu'à y 6, Creuse vers le bas ». `decideDeparture` le faisait marcher jusqu'à sa colonne
  `homeX` ; il y tombait dans un trou (y 1-7) sans échelle, sans lien avec son puits (x 6) ni le treuil (on ne monte que
  par une échelle) → `planDown` ne trouvait plus rien → puits neuf depuis la surface. Autre facteur, pas un bug : le
  seau (0,85 × montée) est plus lent qu'une échelle posée, l'IA prend alors ses échelles.
- **Quoi** : `decideDeparture` : si `G.winch` existe et que `planDown` (même filtre que `digDown`, extrait en
  `downAvoid`) trouve une descente par l'existant, il part tout de suite en « Descend par l'existant ». Sans treuil :
  inchangé (essai sans condition : test team « même case » 5,3 % > 5 %, profondeur 225,8 → 222,0 ; l'ancien départ ne
  faisait que 2 puits neufs près de la surface en 3 sessions sans skills).
- **Détecteur de blocage** : un mob tué pendant la fenêtre, ou plus de la moitié du temps à frapper, n'est pas un blocage
  (faux positifs : barbare contre le minotaure ~2 min, seeds 16 et 23757 ; gobelins en série, seed 15838).
- **Tests** : winch (+1 : seed 1250570735 mixed, aucun puits neuf à y ≤ 10 après la pose du treuil sur 20 min, les
  non-logisticiens passent > 30 s dans le seau), diagnostics (+3 : boss, mob tué, descente puis retour), team, focus :
  47/47.
- **Vérification** : ✅ `winch.mjs` seed 1250570735 : plus aucune descente « jusqu'à y 6 » ; la plupart des descentes par
  le seau. ✅ simulation 3 × 5 sans skills : identique au commit précédent (225,8, 0 blocage). ✅ `--skills mixed` 3 × 5 :
  areas 4,6, profondeur 237,6, 0 blocage (avant correction du détecteur : 2 faux blocages). Ancien blocage seed 16
  mixed « Retour (treuil) » : disparu.
- **Points fragiles** : ⚠️ avec un arbre par mineur, l'area 5 (la dernière) est débloquée dans 3 sessions sur 5.

### Lobby : « Prêt » et passage de chef (Geoffrey) — branche `geoffrey/retours-21-10`
- **Quoi** : `server/party/service.js` : `m.ready` (enregistré, relu au démarrage) ; `ready(me, bool)` (valeur
  strictement booléenne, sinon `bad_request` ; refusé en session ou pendant un lancement) ; `promote(me, id)` (chef
  seulement, membre du groupe, pas soi ; nouveau et ancien chef « pas prêt ») ; `launch` en groupe : `not_ready` (409,
  noms des membres) si un non-chef n'est pas prêt ; après lancement et à chaque `join`, tout le monde « pas prêt ».
  Routes `POST /api/party/ready` `{ ready }` et `/api/party/promote` `{ id }` ; `partyApi.ready/promote`.
  `src/ui/lobby.js` : `launchState` → membre : bouton « ✋ Je suis prêt » / « ✔ Prêt (annuler) » (`action:'ready'`) ;
  chef : « ⏳ Pas prêt : … » ; places « ✔ prêt / pas prêt » ; bouton ★ (Nommer chef, confirmation) à côté du ×.
- **Tests** : party 29/29 (+4 : prêt avant de lancer, remis à zéro au lancement et à l'arrivée, valeurs invalides,
  passage de chef, redémarrage ; tests existants : `ready` avant chaque lancement en groupe ; « membre encore en
  session » → maintenant `not_ready`, il ne peut pas se dire prêt depuis sa session), lobby 5/5.
  Anti-triche 58/58 : `anticheat/party` (prêt avant de lancer) ; `anticheat/skills` : son contrôle « étape sans la
  précédente » ne connaissait pas les étages (Échelle de 2 / Treuil côte à côte) → échouait déjà avant cette branche ;
  aligné sur la règle (au moins un nœud de l'étage d'avant au max).
- **Vérification** : ⚠️ pas regardé dans le navigateur (deux comptes) : bouton, libellés, ★ à vérifier en vrai.
- **Points fragiles** : l'état « prêt » d'un membre ne se voit chez le chef qu'au prochain rafraîchissement du lobby.

### Descente commune en équipe (Geoffrey) — branche `geoffrey/descente-commune`
- **Quoi** : retour de partie (seed 1924731460, 3 joueurs) : un joueur « mine de son côté » pendant que les autres
  descendent ensemble. Cause : `downAvoid` refusait tout fond à plus de 16 colonnes de `homeX` (`outOfSector>1`), et
  sans treuil `decideDeparture` renvoyait chacun à sa colonne. La place 3 (x=42) est loin du coffre (x=22) et des
  puits des places 1–2 : en simulation, Vert allait en x=41 et recreusait 0→50 pendant que Rouge et Bleu reprenaient
  le puits en x≈13. `src/sim/ai.js` : `downAvoid` = seulement `crowdAt>0` ; `decideDeparture` prend la descente
  existante depuis le coffre dès que `planDown` la juge rentable, treuil ou pas (avant : treuil seulement). Le coût
  (`planDown`) décide toujours entre puits neuf et existant ; le secteur reste une pénalité sur les minerais.
- **Tests** : team 5/5 (+1 : seed 1924731460, aucun « Creuse vers le bas » à y ≤ 15 entre 300 s et 1200 s sans
  treuil ; échoue sans le correctif : « Vert t351 x41 y1 »). « Ne se marchent pas dessus » : ne compte plus les mineurs
  en descente par l'existant (`goingDown`) ou en chute (même case 6,5 % → la descente commune en fait 3,7 % ; au travail
  2,8 % contre 2,1 % avant). winch, miner, focus, skills, dungeon : 76/76.
- **Vérification** : ✅ simulation 3 × 5 : profondeur 225,8 → 228,4, allers-retours 24,2 → 24,0, 0 blocage.
  Temps pour rejoindre le front (profondeur max − 10) après un départ du coffre, 6 seeds : 100 s → 96 s.
  Variante intermédiaire (secteur retiré seulement, départ inchangé) : 224,6, et Vert allait à sa colonne avant de
  revenir au puits commun (aller-retour en surface).
- **Points fragiles** : ⚠️ gain modeste avec le stuff de base ; avec des mineurs de stuffs différents (cas réel) l'écart
  peut être plus grand, à vérifier en vrai. Le cas « en file par les mêmes échelles » (ancien −4 de profondeur) n'est
  pas revenu en simulation, à surveiller.
- **Mise en ligne (22/10)** : fusions de main (57 commits, puis LFG et Trésors des tours). Conflits : « Plus profond »
  (main) gardé, `CFG.transitReach` retiré ; donjons `DUNGEON.chance` 0.33 ; concasseur, détecteur de blocage, focus :
  main ; lobby : « Prêt » + avatars ; `statsHTML` (main) reprend l'affichage « +x % » de la ténacité. Tests venus de
  main mis à jour : pioches ×2 (`amelioration`, `carac` : valeur de la pioche en pierre 130 → 260 x, ses lignes
  doublent avec) ; bouton « Prêt » (`instant-server`, `social` : membre prêt avant `launch`). **LFG** : `formLobby` remet
  tout le monde « pas prêt » (nouveaux venus) ; `autoLaunch` ne demande pas « prêt » (entrer dans la file vaut accord) ;
  test `lfg` (+1). `npm test` 660/661 (0 échec), anti-triche 72/72.
  Simulation 3 × 5 : areas 3,2, profondeur 195,0, 0 blocage (main seul : 3,4 / 197,2) ; `--skills mixed` : areas 4,0,
  profondeur 207,8, 0 blocage. Temps pour rejoindre le front, 6 seeds : main seul **Vert 102 s** (Rouge 84, Bleu 88) →
  après **Vert 89 s** (Rouge 82, Bleu 84) ; seed 1924731460 : Vert 116 → 78 s.
- **Fusion des pièges (22/10)** : `mobs.js` : `stepOf(o)` (main) + ténacité gardée (le sort ignoré coûte quand même
  le cooldown). Test « ne se marchent pas dessus » : 5,7 % > 5 % ; en cause la descente commune (sans elle : 0,9 %) :
  groupés, ils combattent ensemble les mobs (pièges compris) sur la même case (4,9 % sur 5,7). Le test ne compte plus
  les mineurs en combat (`m.foe`) : au travail 0,9 % (main seul 0,5 %). Simulation 3 × 5 : areas 3,2 / profondeur 190,4
  (main seul : 3,0 / 192,0) ; `--skills mixed` : 3,6 / 201,4 (main : 3,6 / 201,0) ; 0 blocage. `npm test` : 673 + team
  7/7, anti-triche 72/72.

### Skin des autres dans le lobby (Geoffrey) — branche `geoffrey/skin-lobby`
- **Quoi** : le lobby dessinait les autres membres en tenue de base (`drawPortrait(c, {})`, commentaire « les autres en
  tenue de base ») : le serveur n'envoyait pas leur apparence. `server/game/service.js` : `lookFor(id)` = `lookOf` du
  stuff porté (noms des pièces). `server/party/service.js` : `state()` remplit une `Map` `looks` (comme `trees`),
  `publicParty` ajoute `look` à chaque membre (`{}` par défaut). `src/ui/lobby.js` : `portraitLook(slot, myLook)` →
  le sien = `h.look()` (stuff local, à jour tout de suite), les autres = `sanitizeLook(slot.look)` ; canvas repérés
  par `data-slot` (avant `data-me`).
- **Tests** : skins (+1 : `lookFor` vide puis casque porté), party (+1 : chaque membre a son `look`), lobby (+1 :
  `portraitLook`, pièces invalides ignorées, serveur sans `look`) ; lobby, skins, party, lfg, social : 80/80.
- **Vérification** : ⚠️ pas regardé dans le navigateur à deux comptes.
- **Points fragiles** : `state()` est appelé souvent par chaque lobby : `lookFor` relit inventaire + stuff de chaque
  membre à chaque appel (comme `skillTreeOf` relit les skills). Avec PostgreSQL, 3 lectures de plus par appel ; à
  mettre en cache si le serveur rame.

### Retours du 22/10 : fours, butin, skills, chutes, bilan (Geoffrey) — branche `geoffrey/retours-22-10`, ✅ en ligne le 22/10
- **Fours** : `src/meta/furnace.js` actions `empty` (un four) et `emptyAll` (tous) : chaque case (sortie comprise)
  repasse par `unload` ; une case qui ne rentre pas reste (compte `left`, renvoyé par le serveur et affiché). UI : bouton
  par four (`data-empty`), `#furnEmptyAll`, bouton `½` (floor(stock/2), au moins 1). `main.js` : onOp renvoie la réponse.
- **Rareté** : résidus retirés de `RARITY.items` (communs).
- **Butin** : `actions.js lootOf` : n + floor(b) + (rng < frac(b)) au lieu de n×(1+b). Test statistique sur 20 000 mobs.
- **Stats** : `SKILL_ADD` (looting ← loot ×100, affichage seulement : la partie lit toujours `m.skill.loot`),
  `behaviourSkills(effects)` (nœuds hors SKILL_STATS/SKILL_ADD, texte `nodeText`) ; `minerStats` → champ `add`.
  Vérifié : tous les skills sont lus en jeu (mine_speed/damage via carac ; ore_oxygen, ore_rush, build_time,
  tall_ladder, winch, travel_rush, taunt, loot dans sim/).
- **Chutes** : `world.js ontoLadder` ; `ai.js` : une case de chute dure climbT si la chute finit sur une échelle ;
  `path.js` : `drop` (même règle) et `side` (pas de côté depuis un seau ou une échelle : chute comptée au moins à la
  vitesse du puits). Mesure (3 seeds, skills mixed, motif « puits → côté → chute → retour au puits ») : 227 → 14.
- **Bilan** : `shared/game.js resultChoice(ended, waitingFor)` ; `main.js pollResult` attend le résultat de la session
  jouée (`waitingFor = rec.id`) ; un ancien jamais vu est `ack` sans être affiché. Cause : bilan de tour pas fermé, mine
  relancée depuis le lobby, `state()` renvoyait le plus récent « done » pendant le partage de la mine.
  `session.js` : `summary.lostBags` (détail par mineur), affiché dans `hud.js`.
- **Tests** : `bilan.test.js` (nouveau, 2), fall +2, skills +1 (et butin réécrit), furnace +2, anticheat/furnace
  (empty/emptyAll dans les suites au hasard), rarity, stuff. 253/253 sur les sujets touchés ; anti-triche 72/72.
- **Vérification** : ✅ simulation 3 × 5 : 3,0 areas, profondeur 186, 0 blocage (avant : 3,0 / 192) ; `--skills
  mixed` : 3,6 / 201, 0 blocage (inchangé). ⚠️ pas regardé dans le navigateur (boutons des fours, liste des skills).
- **Points fragiles** : `side` vaut pour toute chute depuis une échelle (pas seulement près du treuil) ; le bilan d'une
  session jamais vue est marqué vu sans affichage quand une autre se termine.
- **Fusion de main (descente commune, ténacité)** : `skills.js` garde `SKILL_ADD` / `behaviourSkills` à côté des `adds`
  de main (ténacité) ; `ui/stuff.js` : l'affichage « +skill » de main montre aussi Pillage (plus de ligne `add` en double).
  Après fusion : 291/291 sur les sujets, anti-triche 72/72, simulation 3 × 5 : 3,0 / 192,2, mixed 3,4 / 201,6, 0 blocage.

### Barbare : talent Braum (Geoffrey) — branche `geoffrey/braum`, ✅ en ligne le 22/10
- **Quoi** : nœud `braum` (`SKILLS.trees` barbare, row 4, max 3, per 0.1 ; `src/config.js`). `m.helping` (remis à false au
  début de `decide`) passe à vrai dans `helpAlly`, `trapGoal` (avec `m.helpFoe` = mob visé) et `dungeonGoal` (dès qu'il
  y a un barbare et un donjon actif : y aller, attendre devant, combattre le boss) ; le combat qui continue par
  `m.foe` garde le bonus si `th.id === m.helpFoe`. `helpBoost(m)` (`src/sim/mineur.js`) : ajouté à `walkBoost`
  (additif avec Ruée / Navette), multiplie `climbT` et `winchT`. Les itinéraires (`path.js`, vitesses de base) ne
  changent pas. Icône `shield` (`src/ui/skills.js`), wiki : Braum listé pour Vitesse et Vitesse sur échelle.
- **Tests** : skills (étage 4, Pillage au max requis, ×1/1,3 marche/échelle/seau), mobs (Aider allié : bonus en route,
  plus après le combat), trap (bonus pendant la rescousse). skills, mobs, trap, dungeon, wiki, winch, fall, team,
  focus, diagnostics, lobby, game-service : ✅ 187/187.
- **Simulation** `--miners 3 --count 5 --skills barbare` : 0 blocage ; profondeur 189,8 (main) → 191,4, areas 3,0 des
  deux côtés. Effet faible : `simulate` laisse « Aider allié » à non, seuls donjon et pièges déclenchent.
- **Points fragiles** : `m.helping` vaut aussi pour les non-barbares en route vers un donjon (sans effet : seul un
  barbare peut avoir `braum`). ⚠️ Pas regardé dans un navigateur (onglet Skills avec 4 étages).
- **Après fusion de main** (retours-22-10 : butin, chutes, skills de comportement) : 198/198 ✅ ; simulation 3 barbares
  profondeur 192,4, 0 blocage. Braum apparaît tout seul dans « Skills en partie » (`behaviourSkills`, onglet Stuff).

### Lobby : « Prêt tout le temps » (Geoffrey) — branche `geoffrey/pret-tout-le-temps`, ✅ en ligne le 23/10
- **Quoi** : champ `always` sur un membre de groupe (`server/party/service.js`). `unready` remet `ready = !!always`,
  `notReady` ignore les `always`, `promote` aussi (l'ancien chef garde son `always`). Nouvelle action
  `alwaysReady(me, bool)` (route `POST /api/party/always-ready` `{ always }`, `partyApi.alwaysReady`) : **pas** de
  `notInSession` (cochable pendant la session). `ready(me, false)` remet aussi `always` à faux. `always` enregistré
  avec le groupe (`saved` / `load`) et envoyé dans `publicParty`. Lobby : `alwaysReadyState` (pure, `src/ui/lobby.js`),
  case `#alwaysReady` dans `.lobbyActions` (`index.html`, style `.lobbyActions .chk`), tag « ✔ prêt tout le temps ».
- **Tests** : party (relance sans clic après session, nouveau venu, cochée en session, annulation, valeurs invalides,
  promote, redémarrage, route HTTP), lobby (`alwaysReadyState`) : ✅ 59/59 avec social.
- **Points fragiles** : ⚠️ pas regardé dans un navigateur. Un membre `always` absent (onglet fermé) compte comme prêt :
  le chef peut le lancer dans une session ; le partage anti-boosting et le retrait au bout de `memberTimeout` restent
  les garde-fous.

### Retours du 23/10 (Geoffrey) — branche `geoffrey/retours-23-10`, ✅ en ligne le 23/10
- **Socle du coffre** : bloc 18 `CHEST_BASE` (`special`, `unbreakable`, `noDrop`, tex `chest_base` générée par
  `gen_textures.py`), posé en `G.tiles[1][CHEST_X]` dans `newSession` (`src/sim/session.js`). Le coffre (`CHEST_X` = 22)
  n'est pas au milieu (`WINCH.x` = 25) : pas déplacé. Tests : blocks (posé, toujours là après 1 h), world (couche 1 =
  terre sauf le socle). Simulation 3 × 5 : 3,0 areas, profondeur 192,2, **0 blocage** (identique à avant).
- **Tainted gold** : `FURNACE.alloys` (`src/config.js`) or 5 + `Peau de gobelin` 20. Un four enregistré « or + chitine »
  garde ses cases (`sanitizeFurnaces`) mais `activeRecipe` → null : il ne tourne plus, le joueur décharge. Tests :
  iron-furnace-gold-compass (nouvelle recette, ancienne refusée, ancien four sans perte), wiki ; anticheat 72/72 ✅.
- **Temps d'un ami** : `game.activeSessionInfo(id)` → `{ mode, leftMs }` (`finishAt - now`, null en dev) ;
  `social.statusOf` renvoie `mode`, `leftMs` ; `statusText` / `leftText` (`src/ui/social.js`) : minute du dessus,
  « < 1 min ». Test social ✅.
- **Compteur LFG** : `lfgView` renvoie `players` (somme des `size` des entrées valides de la file) à tout le monde ;
  `lfgCountText` (pure, `src/ui/lobby.js`), `#lfgCount` dans `.lobbyActions`. Tests lfg ✅.
- **Vérification** : blocks, world, session, wiki, fall, winch, view, dungeon, furnace, craft, social, game-service,
  party, lfg, lobby ✅ ; anticheat 72/72. ⚠️ Rien regardé dans un navigateur.
- **Points fragiles** : le socle est un bloc `special` en couche 1 (hors area) : `rowDone` l'ignore (incassable).


### Graphite, Steel ingot, area 6 (Geoffrey) — branche `geoffrey/graphite`, ✅ en ligne le 23/10
- **Quoi** : bloc 19 `Graphite ore` (`ore`, tex `graphite`, w 3, hard 4.0, val 4, dot `#2f3b4d`), `IDS.graphite = 19`,
  `XP.ore.graphite = 4` (`src/config.js`). `AREAS[5]` revue (iron 9.5, diamond 0.5, graphite 5, plus de coal) et
  `AREAS[6]` ajoutée (répétée au-delà). `FURNACE.recipes['Graphite ore']` → `Graphite ingot` (60 s, tex
  `ingot_graphite`) ; `FURNACE.alloys` + `Steel ingot` = `Tainted iron` 3 + `Graphite ingot` 10, fuel 50, 180 s, tex
  `ingot_steel`. Les objets sont créés par le catalogue `ITEMS` (rien d'autre à déclarer). Textures `graphite`,
  `ingot_graphite`, `ingot_steel` (`scripts/gen_textures.py`, les autres PNG inchangés). Couleur du panneau d'area
  (`src/ui/hud.js`), wiki (`AREA_KEYS`, `BLOCK_NAME`).
- **Arrondis** : 9,5 % et 0,5 % de 2 500 = 237,5 et 12,5 → `Math.round` 238 et 13 : l'area 5 a **501** minerais (le
  terrain principal absorbe l'écart). Test wiki mis à jour (7 areas, 501).
- **Tests** : `tests/graphite.test.js` (nouveau : bloc, compositions = 100 %, génération, fonte, alliage), world,
  furnace, wiki, level, focus, inventory, iron-furnace-gold-compass ✅ ; anticheat 72/72 ✅. Simulation 3 × 5 :
  3,0 areas, profondeur 192,2, **0 blocage** (identique : en stuff de base personne n'atteint l'area 5).
- **Points fragiles** : ⚠️ pas regardé dans un navigateur. Pas de shiny pour le graphite (`SHINY.items` : fer et or
  seulement). `DUNGEON.areas` reste [4, 5] : pas de donjon en area 6. `MOBS.spawnTable` : l'area 6 reprend la ligne
  de l'area 5. Treasure en area 6 : T2 (dernier tier).

### Tours : refonte en étages (Geoffrey) — branche `geoffrey/tour-serpentin`, ✅ en ligne le 23/10
- **Quoi** : `src/sim/tower/world.js` réécrit : `floors` étages de `floorH` lignes + séparation (indestructible, porte
  de `gate` cases en brique au bord, côté alterné depuis `L.gate0` tiré par la seed), `kinds` (empty / blocks / mobs,
  premier tiré par la seed), helpers `floorBottom/Top/Ceil`, `floorOf`, `isCeil`, `gateCols`, `towerLight` (lumière
  partagée avec l'affichage). `TOWER` en config remplacé (plus de `height`, `mazeEvery`, `mazeHard` ; `mobs`, `gate`,
  `boss.speedMul`, `sides.*.mob/mobTex`). `src/sim/tower/session.js` réécrit : mobs (`placeMobs`, `stepMobs`, tacle
  `grab`, provocation si `skill.taunt`), porte scellée (`sealedFloor` dans `breakable`), `revealFloor` à l'entrée d'un
  étage (remplace `revealAround`), torches (`torchThreshold`, `darkSlow`), boss mobile (`stepBoss` : `engaged` au
  premier coup, marche si personne au contact ni derrière lui, `bossFits`), côté du barbare (`wantedSide`), on passe
  derrière le boss (`towerAir` n'exclut plus ses cases), pas de double échelle / double minage (`busy`).
  Vue : `tower-view.js` envoie boss.x/y, torches, mobs des étages découverts, `reached`, `mobsLeft` ; la lumière est
  recalculée côté navigateur par `towerLight`. Rendu (`render/tower.js`) : torches, ombre, mobs 16 × 32 et leur vie.
  Textures `seraph`, `imp` (`gen_textures.py`, `tower_mobs()`). Wiki, lobby, HUD : textes. `scripts/simulate-tower.js`.
- **Tests** : `tests/tower.test.js` réécrit (carte, mobs, porte scellée, tacle, boss 2000 / 20 % / déplacement /
  chute du bord, côté du barbare, torches, compo forte 5/5 sans blocage, base échoue, vue, partie en direct) ✅ 10/10 ;
  game-service 43, lobby 12, wiki 7, rarity 5, boot-check 3 ✅.
- **Simulation** (`--count 20`) : a) base 0/20 ; b) 18/20 ; c) 20/20 ; 0 attente « bloqué ».
- **Pas vérifié** : ⚠️ rendu dans le navigateur (mobs, ombre, caméra 22 × 16, boss qui se déplace). L'ombre est dessinée
  avant les mobs et les mineurs (ils ne sont pas assombris).
- **Points fragiles** : les seeds changent peu le résultat (tour symétrique, seuls le côté des portes et l'ordre
  blocs/mobs varient). Dans un étage de blocs, le 2e mineur creuse souvent la ligne du dessus en posant une échelle à
  chaque case (pénalité `taken`) : du temps perdu, mais pas de blocage.
- **Boss 5 000 PV** (`TOWER.boss.hp`, 23/10 11 h) : b 0/20 (reste 1 620 PV en moyenne), c 0/20 (1 267). Test « compo
  forte » changé : toit atteint et boss entamé (plus de victoire attendue). ✅ tower 10/10.
- **Boss 3 500 PV** (décision, mis en ligne) : b 0/20 (reste 10 à 660 PV), c 12/20 (victoire à 9:53). ✅ tower 10/10.

### Stuff en acier, Plastron de l'équilibre, Treasure T3 (Geoffrey) — branche `geoffrey/stuff-acier`, ✅ en ligne le 23/10
- **Quoi** : `STUFF.items` (6 pièces « … en acier », `Plastron de l'équilibre`), `RECIPES` (unlock = « … BP »),
  `RARITY.items` (acier inhabituel, plastron épique, BP compris), `TREASURE.tiers` (T2 maxArea 4, T3 maxArea 6),
  `LOOT['Treasure T3']` (always graphite / tissu / parts ; oneOf blueprint, gem, material = Cristal de pleine lune 10 %).
  Le catalogue `ITEMS` crée les BP (cat blueprint) et le Treasure T3 depuis la config. Skins (`src/skins.js`) et
  textures (`gen_textures.py` : armure `steel` dans la boucle des matériaux, pioche / épée acier, `chest_balance`,
  `treasure_t3` avec ferrures diamant, calques `skins/steel_*`, `skins/balance_chest`, `skins/pick_steel`,
  `skins/sword_steel`). `SHARE.copyToAll` suit `TREASURE.tiers` : le T3 est copié à chaque joueur comme T1 / T2.
- **Piège corrigé** : l'entrée `ITEMS['Cristal de pleine lune']` (w 1) était écrasée par la table LOOT (sans w) dès
  que le cristal entre dans un `oneOf` : déplacée après le spread de LOOT. Testé.
- **Tests** : `tests/steel-gear.test.js` (nouveau : stats fer × 1,2, recettes, blueprints, rareté, skins, table et
  ouverture du T3), treasure / wiki / loot / rarity mis à jour (T3 en areas 5+, « tier sans table » = T9), blueprint,
  craft, stuff, skins, upgrade, crusher ✅ ; anticheat 72/72 ✅.
- **Points fragiles / à vérifier** : ⚠️ pas regardé dans un navigateur. `RESEARCH.tiers` n'a pas de tier 3 :
  `tierOfBlueprint` rend null, le recyclage d'un BP T3 prend le barème du tier 1 (30-60). `UPGRADE.worth` n'a ni
  `tenacity` ni `torches` : la valeur du plastron pour l'identification ne les compte pas. Coûts : 10 Shiny iron par
  pièce d'armure (1 % de shiny par fer miné ≈ 1 000 fers), 10 diamants par outil (area 5 : 13 diamants, area 6 : 25).
- **Wiki** (même branche) : `wiki.html` (T1 / T2 / T3 dans l'aide des areas, bonus « un par famille » des treasures,
  inscriptions MI : 30 dernières minutes, en session possible, session pas désinscrite), `src/wiki/wiki.js` (libellé
  de la famille `material` → « matériau »). Tests wiki ✅. ⚠️ Page non ouverte dans un navigateur (pas de navigateur
  dans la session) : données vérifiées via `src/wiki/data.js`.

### Table de recherche : tier 3 (Geoffrey) — branche `geoffrey/recherche-t3`, ✅ en ligne le 23/10
- **Quoi** : `RESEARCH.tiers` + `{ tier:3, from:'Treasure T3', cost:150, recycle:{40,70}, weights:{ 'Plastron de
  l'équilibre BP':0.25 } }`. `src/meta/research.js` : `weightOf`, `researchOdds`, tirage pondéré `pick` (un seul
  `rng()`, comme avant : poids tous à 1 = même résultat que l'ancien tirage uniforme). Le verrou (`tierUnlocked`), le
  serveur et l'onglet étaient déjà génériques. Wiki : note « N fois moins de chance » (`researchRows().rarer`), astuce
  du tier d'avant généralisée.
- **Tests** : research (tier 3 fermé puis ouvert, 150 parts, poids 4× moins avec 20 000 tirages ≈ 4 %, dernier plan,
  recyclage 40-70 ; tier inconnu = 4), wiki ✅ ; anticheat ✅.
- **Points fragiles** : ⚠️ onglet non regardé dans un navigateur. Un poids invalide (≤ 0, NaN) compte pour 1.

### Résidus : 0,5 % en cumul, sur la pierre (Geoffrey) — branche `geoffrey/residus-cumul`, ✅ en ligne le 23/10
- **Constat** (mesure, seeds 1, 7919, 424242) : areas 4 à 6 = 13 anges + 13 démons = 1,04 %, pris sur pierre et pierre
  dure : `placeResidues` appliquait `JUDGMENT.pct` à chaque camp.
- **Quoi** : `placeResidues` (`src/sim/world.js`) : n = round(N × pct / 100) = 13 en tout, `floor(n/2)` par camp, le reste
  à un camp tiré par le RNG des résidus ; cases candidates = `IDS.stone` seulement (`counts.stone` décrémenté).
  Commentaire de `JUDGMENT` (config) ; textes du wiki (`data.js`, `wiki.js`). ⚠️ Une première version avait coupé la
  ligne de `JUDGMENT` par un commentaire (`openHours`, `salt` perdus) : repéré par judgment.test, corrigé.
- **Tests** : world (4 seeds : 13 en tout, écart ≤ 1, comptes = blocs posés, pierre dure intacte, déterministe),
  judgment, wiki, blocks, view, tower ✅ 52/52. Simulation 3 × 5 : 3,0 / 192,2, mixed 3,4 / 201,2, 0 blocage (inchangé).

### Mine instantanée : composition avec graphite et diamant (Geoffrey) — branche `geoffrey/mi-composition`, ✅ en ligne le 23/10
- **Quoi** : `INSTANT_MINE.comp` = { coal 20, iron 40, gold 33, graphite 5, diamond 1 } (+ feather 1). `genInstantMine`
  est générique (IDS) : rien d'autre à changer. Wiki : la ligne de la MI prend `BLOCK_NAME` (avant : charbon / fer / or
  seulement).
- **Tests** : instant-mine (500 / 1 000 / 825 / 125 / 25), instant-server, instant-ui, wiki ✅ 48/48.
- **Simulation** `simulate-instant.js` (5 seeds, 20 mineurs) : vidée 72-73 % (inchangé), 0 fuite, 0 s d'inactivité ;
  par mineur Fer 36,0, Or 30,1 (avant 35,6), Charbon 18,4, Graphite 4,5, Diamant 0,9, Plumes 1,9 (inchangé). À 3 :
  Graphite 5,3, Diamant 1,3, Plumes 4,9.

### Gallianix (Geoffrey) — branche `geoffrey/gallianix`, ✅ en ligne le 23/10
- **Quoi** : `DUCK` en config (type `gallianix`, 50 PV, names, range 8, step 1,2 s, pause 0,35, jump 3, heart 25 %,
  salt), `XP.mob.gallianix` 5, objet `Fragment de cœur` (material, w 1). `src/sim/duck.js` : `spawnDucks` (un canard
  par area débloquée depuis le lancement : `G.ducks` < `G.unlockedAreas − G.duckBase`, `duckBase` posé dans
  `newSession`), `updateDuck` (ligne 0, sol = couche 1 pleine ou échelle ; saut ≤ 3 cases ; sans sol sous lui →
  `nearestGround`), `duckName`. Branché dans `updateMobs` (avant la chute) ; mort dans `killMob` (actions.js). Hasard
  à part `G.duckRng` (seed ^ salt). Hors de `MOBS.hpBase` : ni `MOB_TYPES`, ni `walkerCap`, ni la liste « Aider allié ».
  `mobView` envoie `name` et `hop`. Rendu : `canvas.js` (sautillement, pseudo jaune, barre de vie au-dessus du nom).
  Textures `duck`, `heart_fragment`. Wiki : fiche à part (`duckCard`), source du fragment.
- **Bug trouvé et corrigé** : les mineurs creusent la couche 1 sur 7 cases sous un canard au bord de sa zone : il
  restait en l'air ~40 min (seed 7919) → `nearestGround`.
- **Tests** : `tests/duck.test.js` (config, naissance, pseudos en boucle, promenade : jamais en l'air ni hors zone,
  saut d'un trou étroit et demi-tour devant un large, envol, butin ≈ 25 % sur 2 000, déterminisme) ✅ ; mobs, session,
  view, world, trap, dungeon, game-service, game-replay, game-http, share, level, blocks, wiki ✅ ; anticheat 72/72 ✅.
  Simulation 3 × 5 : 3,0 areas, profondeur 182,4 (main : 192,2), **0 blocage** ; solo : 1,2 areas, 0 blocage.
- **Points fragiles** : ⚠️ rendu non regardé dans un navigateur. Le mineur qui poursuit le canard marche à la surface
  (trous possibles) : aucun blocage mesuré. Mode dev : des areas débloquées après le lancement font naître des canards.

### Treuil : boucle « Va installer le treuil » ↔ « Retour (treuil) » (Geoffrey) — branche `geoffrey/fix-treuil-boucle`, ✅ en ligne le 23/10
- **Symptôme** (seed 1209172417, logisticien solo avec le treuil) : à partir de ~50 min, il part du coffre vers
  `WINCH.x`, tombe en (24,1) (trou à côté du puits ; `noBridge:true` à la surface pour ne pas boucher le puits), et
  comme il n'est pas dans la colonne du treuil, `decideWinch` ne le laisse y retourner qu'à une hauteur `≤ winchDepth` ;
  `winchDepth` vaut null (nouveau chantier de prolongation, ou entraîné dans un combat dès la 1re case : seed 39595, le
  1er treuil jamais posé) → `reason='treuil'` → il remonte par l'échelle de (23,1) sans repasser au-dessus du trou →
  recommence. **Invisible pour `stuckDetector`** (il bouge tout le temps).
- **Correction** (`src/sim/ai.js`, `decideWinch`) : hauteur rejoignable = max(`winchDepth`, `G.winch.bottom`, nombre de
  cases déjà vides de la colonne du treuil depuis la ligne 1).
- **Tests** : winch (2 nouveaux : prolongement et premier treuil, trou à côté + échelle voisine ; ils échouent sans la
  correction), session, fall, skills, dungeon, mobs, trap, team.
- **Mesure** (script de comptage des passages en « Retour (treuil) », 8 seeds × 1 et 3 logisticiens complets) : avant
  1 à 1 755 par mineur (12 cas sur 16 > 100) ; après 1 à 4, treuil posé partout (52 à 204).
- **Simulation `--skills logisticien`** (5 seeds) : à 3, areas 3,2 → **3,6**, profondeur 190,2 → **199,2** ; seul,
  1,4 → 1,6 et 97 → 107 ; 0 blocage (avant = première correction seule). Tests liés ✅ 102/102.
- **Simulation sans skills** : 182,4 de profondeur à 3 (192,2 ce matin) : écart venu de `main` (Gallianix, fusionné
  entre-temps), la correction ne touche que le chantier du treuil.
- **Points fragiles** : la colonne du treuil « déjà vide » peut traverser une poche d'air naturelle : il peut alors
  rejoindre le puits plus bas, c'est voulu (il continue de creuser depuis là). Combats Gallianix longs (≥ 30 s, mineur
  souvent en `wait`) vus par un détecteur ciblé : pas traité ici.

### Plastrons : pods 30 / 50 / 80 / 125 (Geoffrey) — branche `geoffrey/pods-plastrons`, ✅ en ligne le 23/10
- **Quoi** : `STUFF.items` (`src/config.js`) : Plastron en chitine 25 → 30, fer 33 → 50, acier 40 → 80, équilibre 60 →
  125. Rien n'est stocké dans les pièces (`sanitizePiece` ne garde que item, uid, q, lines, rune, plus) : `pieceBonus`
  et `itemValue` relisent le catalogue, donc les pièces existantes changent seules. `itemValue` : chitine 180, fer 300,
  acier 480, équilibre 925,8 x → une ligne « pods 20 % » vaut 7 / 12 / 19 / 37 pods.
- **Tests** : carac, amelioration (30 × 1,03 → 31), stuff, blueprint, steel-gear (plus de « fer × 1,2 » pour les pods),
  craft, rarity, research, rune, tier2, wiki ✅.
- **Mesures d'équilibrage du 23/10** (scripts temporaires, équipe logisticien + mineur + barbare niv. 7 en fer, outils
  fer, arrêt à l'ouverture de l'area 5) : area 5 à 53-54 min ; seuil 50 % → 45 min 25 ; pods +100 → 47 min 56 ;
  dégâts +10 → 51 min ; rayon de torche +2 → 51 min ; oxygène +100 → 51 min 43 ; torches +20 → 53 min 39 ; pierre
  1,0 s / pierre dure 1,8 s → 51 min 29 ; pioche en fer +0,6 → 50 min 36.

### Retours de l'après-midi du 23/10 (Geoffrey) — branche `geoffrey/retours-23-10-apm`, ✅ en ligne le 23/10
- **Occultiste** : `MOBS.hpBase.occultiste` 100 → 150. Rien à corriger dans `mobs.js` : `provoke` met fin à la
  canalisation, `occult` relance au cooldown sur la cible provoquée. Nouveau test « combat réel » (mobs.test.js : 60 s,
  rien de forcé, ≥ 3 sorts dont ≥ 2 sur le barbare). Wiki : le texte « coupe son sort pour de bon » était faux.
- **Force brute zone** : nœud `damage` + `aoe:0.02` (config) ; `aoeOf(effects)` (`src/meta/skills.js`, rang × aoe) ;
  `splash` dans `src/sim/actions.js` (mobs à Manhattan ≤ 1 de la cible, pas un mimic caché, kill → `killMob` par le
  barbare) ; tour : `hitMob` / `mobDied` (`src/sim/tower/session.js`). `nodeText` remplace `{aoe}`.
- **Fragments** : `RUNE.fragment` ({ item:'Fragment de rune', tex, factor:0.5 }), objet `cat:'rune', fragment:true`
  (rareté rare). `isFragment`, `runeFactor` (`src/meta/piece.js`) ; `lineValue(item, l, f)` (discoverMax inchangé) ;
  `pieceBonus` applique le facteur aux lignes de `p.rune` si `rune.frag`. `sanitizePiece` garde `rune.frag`.
  `unenchant` / `unenchantError` (`src/meta/upgrade.js`, opId rejouable : `upgrades` garde `fragment`, relu par
  `deserialize`). Serveur : action `unenchant` (`/api/game/upgrade`), erreurs `no_rune`, `fragment_locked`. UI :
  bouton « Retirer la rune », aperçu du fragment ÷ 2. Texture `rune_fragment`.
- **Prêt tout le temps** : `alwaysOn` (Set de comptes, `server/party/service.js`), `newMember` le reprend partout ;
  `ready(false)` ne touche plus `always` ; reconstruit au `load`. Lobby : bouton principal « ✔ Prêt tout le temps »
  désactivé. ⚠️ Un joueur sans groupe au redémarrage perd le réglage (pas d'enregistrement par compte).
- **MI** : `server/instant/service.js` n'appelle plus `party.leave` (inscription, ouverture). Un membre en MI bloque le
  lancement du chef (`member_in_session`, déjà là).
- **Jugement** : `anyOpen`, `paused` (`src/meta/judgment.js`) ; `refresh` n'ouvre pas une tour si l'autre l'est ;
  `addResidues` ignore le camp en pause ; `publicJudgment` : `paused` par camp, `residues`. Serveur : `rec.residues =
  false` au lancement d'une mine classique si une tour est ouverte ; `buildSession` → `noResidues` → `genArea` saute
  `placeResidues`. UI Jugement : « en pause ».
- **Tests** : mobs, skills, tower, rune, anticheat/rune, rarity, inventory, party, lobby, instant-server, judgment,
  game-service, wiki, stuff, amelioration, anticheat complet ✅.
- **Simulation** `--miners 3 --count 5 --skills mixed` : areas 3,0, profondeur 194, allers-retours 28,8, 0 blocage ✅.

### Mineur : Légende de la flemme (Geoffrey) — branche `geoffrey/legende-flemme`, ✅ en ligne le 23/10
- **Quoi** : nœud `lazy_legend` (`SKILLS.trees` mineur, row 4, max 1, per 0.05). `lazyTeleport(G,m)` (`src/sim/ai.js`,
  appelé en tête de `decideReturn`) : un tirage par remontée (`m.lazyTry === m.returnStart`), jamais si
  `m.reason === 'fin de session'` ; RNG à part `G.lazyRng` (seed ^ 0x1a2e5e, créé au premier tirage). Réussi :
  `x = CHEST_X, y = 0`, remise à zéro de fall / target / foe / digCol / galleryRow / exploring ; `stats.lazy`.
  Tacle et étourdissement passent avant `decideReturn` (tirage après). MI et tours : autre IA, pas concernées.
  Icône `sparkle` (`src/ui/skills.js`).
- **Tests** : skills (structure de l'arbre, Ruée au max exigée, tirage unique, fin de session, en partie à 100 %) ✅.
- **Simulation** `--miners 3 --count 5 --skills mineur` : areas 3,2, profondeur 197, allers-retours 26,8, 0 blocage ✅.

### Mule, skill Logisticien étage 4 (Geoffrey) — branche `geoffrey/mule`, ✅ en ligne le 23/10
- **Quoi** : spec `docs/superpowers/specs/2026-10-23-mule-design.md`. Config : nœud `mule` (row 4), `MULE`
  { capacityPct 2, depositTime 1, pickTime 1, pickBelow 10 }, `needsAll` sur `travel_rush` (Navette exige tous les
  nœuds de l'étage 2 ; `blockedReason` dans `src/meta/skills.js`), texture `backpack`. `src/sim/mule.js` : état
  `G.mule` { carrier, placed, x, y, inv, by, load }, `muleCap` (calculée en direct sur les présents), `muleSpot`,
  `depositToMule` (partiel), `emptyMule` (crédite `chestBy` au déposant), `pickMule`, `placeMule`, `muleOnLeave`.
  IA (`ai.js`) : modes `mule` (aller déposer, pods pleins si le sac est plus près que le coffre et `muleFits`),
  `fetch` (aller ramasser), `m.muleJob` (pose après le treuil, `decideMulePlace`), `m.muleFetch` (prolongation : sac
  ≤ pickBelow couches sous lui), `planPickup` (fin de session : une décision par remontée, refaite si le sac vide se
  remplit), `muleEstT` (estimation sans recherche), détour de fin de session compté seulement s'il est possible,
  `decideSurface` va chercher le sac s'il n'aura plus le temps après un autre trajet. Actions `muleDeposit`,
  `mulePick`, `mulePlace` ; `deposit` vide le sac transporté. `world.js` : le treuil est prolongé de préférence par
  le porteur, puis un logisticien avec Mule. `session.js` : `muleOnLeave` avant la photo `shareMarks` ; sac pas
  rapporté → `summary.lostBags` (« Sac de X »). Vue : `mule` { x, y, load, cap } si posé ; `canvas.js` dessine sac et
  jauge. `simulate.js` : `--no-mule`, coffre en pods, ligne « sac (Mule) ».
- **Bugs trouvés en simulation et corrigés** : pickup à chaque reprise du chantier après un combat (descente
  de 80 couches) → `muleFetch` seulement au lancement ; plongée vers un sac vide (seed 79190) ; sac rempli juste
  après la décision de remontée (39595, perdu) ; allers-retours d'une case à la surface en comptant un détour
  impossible (39595).
- **Tests** : `tests/mule.test.js` (17), `tests/anticheat/mule.test.js` (conservation sur 2 000 suites, départ,
  fin), skills (Navette), winch, world, mobs, view, share, session, diagnostics, wiki, anticheat duplication/skills
  ✅ 145/145.
- **Simulation** 3 × 10 `--skills mixed` (seeds de référence) : avec Mule coffre 3 946 pods, profondeur 187,6,
  areas 3,1, 0 blocage, 0 perdu, 27 dépôts / 4 993 pods passés par le sac ; sans (`--no-mule`) 4 074, 187,3, 3,1.
  Logisticien 520 blocs minés contre 571 ; les autres 825 contre 839. **Écart du coffre pas significatif** (paires
  par seed : −128 pods en moyenne, écart type ≈ 380, Mule gagne 3/10). Temps du logisticien (minutes par partie,
  même 10 seeds, statuts regroupés) : statuts « sac » 1,5, dont 52 s de « Va ramasser son sac » qui est sa
  remontée normale par le treuil (remontée + coffre : 9,2 + 0,9 contre 9,9 sans Mule) et 33 s de « Va au sac » (le
  logisticien dépose lui-même : un gain) ; **coût réel ≈ 6 s** (mine la case 1,2, pose 2,1, ramasse 1,6) ;
  travail 14,9 contre 16,1 ; chantier du treuil 24,5 contre 23,6
  (≈ 40 % de sa session dans le chantier, avec ou sans Mule).
- **Fusion avec main** (23/10, avant mise en ligne) : main avait reçu les corrections de la boucle du treuil
  (`fix-treuil-boucle`) et la Légende de la flemme (Mineur, étage 4). Conflit dans `decideReturn` : Mule (planPickup,
  needsPickup) d'abord, puis `lazyTeleport` (arbres exclusifs : un logisticien n'a jamais la flemme). Les repères
  ci-dessus ont été mesurés avant ces corrections du treuil.
- **Points fragiles** : ⚠️ rendu (sac, jauge, icône du skill) pas regardé dans un navigateur. Gain non mesurable sur
  10 parties : décision de design en attente (vider à chaque remontée ?). Le porteur qui ne pose pas son sac (case inatteignable) le garde jusqu'au prochain
  passage au coffre.

### Fin de session : chasse au Gallianix ; treasure hors du focus d'area (Geoffrey) — branche `geoffrey/fin-session-canards-tresor`, ✅ en ligne le 23/10
- **Treasure** : seed 1384517703 (3 mineurs, `--skills mixed`), treasure en (24, 50), area 0, collé au puits du treuil
  (x 25) : vu à 400 s, jamais ouvert. Cause : `inFocus` (`decideWork`, `src/sim/ai.js`) écartait toute cible hors de
  `workArea` (« Plus profond » = area 1) ; le poids (`TREASURE_VAL` 12) n'y était pour rien. Correction : `inFocus(y,t)`
  laisse passer les cibles non-minerai (treasure, résidus) à portée (`CFG.oreReach`, filtre déjà là), toujours sous
  `tripCap` ; `onTheWay` compte une cible non-minerai, sinon `changeArea` effaçait la cible au premier pas dans l'area
  du dessus (oscillation).
- **Canard** : `huntDuck` (appelé en tête de `decideSurface`) : `fightMobs === true`, rien à déposer, fin de session
  (`left < endStayMin` ou `depthCap < 3`), pas de sac Mule à récupérer ; canard le plus proche à la surface joignable
  par `surfaceWalk` (chaque case de la ligne 0 `supported`) et `left ≥ (aller + retour au coffre) × moveT × 1,25 +
  DUCK.huntMargin` (20 s). Au contact (≤ 1 case) : `fight`. Le butin passe par le sac puis `deposit` comme d'habitude.
- **Tests** : `tests/duck.test.js` (+2 : chasse puis retour au coffre ; pas trop tard / Ignorer / trou),
  `tests/treasure.test.js` (+1, échoue sans la correction) ; focus, miner, mule, winch, team, mobs, skills,
  diagnostics ✅ (126).
- **Simulation** `--miners 3 --count 5 --skills mixed` : identique avant / après (areas 3,8, profondeur 207,8,
  coffre 4 531 pods, 0 blocage) : les seeds de référence ne tombent sur aucun des deux cas. Chasse observée sur
  3 parties sur 5 (90 à 130 ticks-mineur) ; 15838 : 2 canards vivants à la fin, personne n'était au coffre.
- **Points fragiles** : ⚠️ pas regardé dans le navigateur. Un treasure à portée dans une area au-dessus de `tripCap`
  reste ignoré (voulu : fin de session).

### Administration sans redémarrage : give-item (Geoffrey) — branche `geoffrey/give-item`, ✅ en ligne le 23/10
- **Quoi** : route `POST /api/admin/give` (`server/admin/routes.js`, branchée dans `server/app.js` quand le service de
  jeu existe) → `game.adminGive(accountId, item, qty)` (`server/game/service.js`) : sous le verrou `inv:<id>`, comme
  une action de joueur (mémoire + base ensemble). Compte par `nameKey`, objet exact d'`ITEMS`, qty entier 1..1000
  (`ADMIN_MAX_QTY`). Journal serveur : « Admin : +n objet pour pseudo ».
- **Accès** (`adminAllowed`) : clé `SERVER.adminToken` = `DIM_ADMIN_TOKEN` (≥ 32 caractères, sinon fermé), comparée
  à temps constant sur les empreintes ; connexion depuis 127.0.0.1 / ::1 seulement ; aucun en-tête de relais
  (X-Forwarded-For, Forwarded, X-Real-IP : Caddy en ajoute toujours un). Refus = 404 « Route inconnue ». Caddyfile
  modèle : `respond 404` sur `/api/admin*` (⚠️ ne s'applique qu'en relançant `install.sh` ; la route se défend seule).
- **Script** : `scripts/give-item.js` appelle la route ; clé et port lus dans `/etc/deep-idle-mine.env` (format
  systemd, d'où `sudo`), `--url` pour les tests. (Ancien, quelques minutes sur la branche : écriture directe en base,
  qui exigeait d'arrêter le jeu.)
- **Tests** : `tests/admin.test.js` (don, mémoire à jour, clés fausses / absentes / courtes, relais, garde-fous,
  adresses), `tests/give-item.test.js` (script contre un vrai serveur, clé lue dans le fichier, refus) ✅ ; game-http,
  account-http ✅ ; anticheat 72/72 ✅.
- **Point fragile** : pas d'opId : relancer la même commande donne deux fois.

### Anneaux : 2 cases, effet de groupe, butin des trésors de tour (Geoffrey) — branche `geoffrey/anneaux`, ✅ en ligne le 23/10
- **Config** : `RINGS` (`src/config.js`, avant `RARITY`) : `items` (tex, rarity, `mult` = % du total, `add` = points,
  `xp` = % du pot), `drops.angel|demon` (format `oneOf` de `rollLoot` : un tirage, au plus un anneau). Les anneaux
  entrent dans `STUFF.items` avec `slot:'anneau'` (aucune stat propre). `STUFF.slots` + `anneau1`, `anneau2` avec
  `fits:'anneau'` : **une case n'est plus forcément le `slot` de l'objet** → `fits(item, slot)` dans
  `src/meta/stuff.js` (remplace `slotOf(item) === slot` dans sanitizeLook/Gear, stuffOp, sanitizeStuff, piecesFor) ;
  `equipSlotFor` pour le bouton « Équiper » de l'inventaire.
- **Doublon** : `stuffOp` → `same_ring` ; `sanitizeLook`/`sanitizeGear` gardent le premier ; `sanitizeStuff` remet
  le second exemplaire dans l'inventaire (`putPiece`, pas de perte).
- **Effet** : `withRings(carac, rings)` après `withSkillStats` dans `minerSpecs` (`src/shared/game.js`, anneaux de
  tous les joueurs via `groupRings(record)`, donc aussi les tours) et `instantSpecs` (MI : ses propres anneaux).
  XP : `newSession({ xpMult })` → `G.xpMult`, appliqué dans `shareBySegments` (`Math.round(dxp × xpMult)` par
  segment). Sans anneau : `withRings` ne change rien, `xpMult` = 1 → parties identiques.
- **Verrous** : `isRing` (`src/meta/piece.js`) ; `sanitizePiece` enlève q/lines/plus/rune d'un anneau ;
  `identifyError`/`upgradeError`/`enchantError` → `'ring'` (messages dans `server/game/service.js`) ; l'onglet
  Amélioration ne liste pas les anneaux. Butin : `openTreasure` (`src/meta/loot.js`), seulement si
  `ITEMS[item].treasure` (pas les anciens coffres ni les Treasure TX), idempotent par opId (le loot rejoué contient
  l'anneau).
- **UI / wiki** : grille Stuff à 6 lignes (`style.css`), colonne violette `.ringStats` (`minerStats` → `ring`),
  textures `ring_*` (`scripts/gen_textures.py`), wiki (`statsOf`, `usesOf`, `sourcesOf`).
- **Tests** : `tests/anneaux.test.js` (11), `tests/anticheat/anneaux.test.js` (3) ; stuff, rarity mis à jour ;
  185 tests liés ✅ ; `npm run test:anticheat` 79/79 ✅. Simulation `--miners 3 --count 5` : 0 blocage, areas 3,0,
  profondeur 182,4 (aucun anneau en simulation : chemin inchangé).
- **Points fragiles** : ⚠️ onglet Stuff à 12 cases et icônes pas regardés dans un navigateur. Les stats affichées dans
  l'onglet Stuff ne montrent que ses propres anneaux (ceux du groupe ne sont connus qu'au lancement).

### Retours du 23/10 au soir : aide sans retour, Logisticien refait, donjon révélé (Geoffrey) — ✅ en ligne le 24/10
- **Aide** : `helpAlly` (`src/sim/ai.js`) remet `m.target` et `m.galleryRow` à null au départ : l'engagement de
  `decideWork` (cible gardée tant qu'elle existe) le renvoyait à son ancien minerai. `m.exploring` est gardé (levé au
  déblocage) : il reprend la galerie la plus proche de là où il est. Test `tests/mobs.test.js` (échouait avant).
- **Logisticien** : `build_time` supprimé de `SKILLS` et de tout le code (`buildT` retiré de `mineur.js`, `actions.js`,
  `ai.js`, `tower/session.js` ; `miLadderT`, `baseLadderT` sans réduction) : sinon `m.skill.build_time` undefined →
  NaN. `travel_rush` étage 1 max 3 ; `winch_speed` étage 3 (`needsAll`), per 0,05. `G.winchBoost` = max des
  `skill.winch_speed` des mineurs au lancement (`newSession`) ; `winchMult(G)` dans `winchT` et `baseWinchT(G,m)`
  (signature changée : `path.js`, `ai.js` Mule). Anciennes sauvegardes : `sanitizeSkills` rejoue étage par étage,
  test « Logisticien refait » (11 points → 5 gardés, 6 rendus, rachat à 11). Icône `hourglass`.
- **Donjon** : `updateDungeons` (`src/sim/dungeon.js`) : premier mineur dans `interior` → tout le carré `G.seen = 1`,
  `d.revealed`. Avant le test `d.cleared` (vaut aussi après la mort du boss). Test `tests/dungeon.test.js`.
- **Tests** : skills, mule, winch, mobs, trap, instant-mine, tower, team, miner, focus, wiki ✅ (171) ; dungeon ✅ (13).
- **Simulation** `--miners 3 --count 5 --skills mixed` (mêmes seeds) : `main` areas 3,8, profondeur 207,8, coffre
  4 531 ; **main sans Bâtisseur (per 0)** 3,0 / 198,0 / 4 356 ; **branche** 3,2 / 196,4 / 4 357 ; 0 blocage. La baisse
  vient de Bâtisseur (−15 % sur échelles, passerelles, torches) ; Escalateur 5/5 (+25 % sur le seau) rattrape peu.
- **Coffre traversable** : pas fait. `tiles[0]` est vide partout (le coffre n'est qu'un dessin) ; recherche de chemin
  de x 40 à x 5 sur la surface ✅, mineur Rouge à x 8 sur 3 seeds ✅. En attente d'un exemple (seed, capture).

### Gallianix chassé à chaque passage au coffre (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Panne** : seed 87312228, canards jamais tués (1 mineur : 1/1 en vie à la fin ; 3 mineurs : 2/3). Le combat de
  `decide` (`src/sim/ai.js`) est sous `if(m.y>0)` : rien à la surface ; `huntDuck` n'agissait que si
  `left<CFG.endStayMin || depthCap<3`, or à ce moment les mineurs sont encore en « Retour (fin de session) ».
- **Correctif** : `huntDuck` sans la condition de fin de session (gardé : `fightMobs===true`, sac vide, pas de sac de
  Mule à chercher, temps aller-retour ×1,25 + `DUCK.huntMargin`, `surfaceWalk`). Appelé en tête de `decideSurface` :
  il dépose d'abord (load>0 → false), chasse, revient au coffre, redépose le butin, repart.
- **Tests** : `tests/duck.test.js` (+2 : chasse en cours de session ; seed 87312228 à 3 mineurs, 0 canard en vie, ~16 s)
  ✅ ; `tests/session.test.js` ✅ (18 en tout). Simulation `--miners 3 --count 5` : 0 blocage, areas 3,0, profondeur
  189,6, coffre 4 079 ✅.
- **Point fragile** : un canard qui saute un trou pendant la chasse → `surfaceWalk` faux, le mineur rentre au coffre puis
  repart (pas de boucle : il ne rechasse qu'au prochain passage en mode surface).

### Aider allié : va-et-vient sur place (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Retour joueur** : seed 1928461225, deux joueurs en Aider allié, « on tournait sur nous-mêmes » (aider, filon, mob,
  échelle, aider…). Reproduit en simulation (2 et 3 mineurs, `helpAllies` forcé).
- **Causes** (`helpAlly`, `src/sim/ai.js`) : 1) `o.chase` = mineur le plus proche (`preyOf`, `src/sim/mobs.js`) ; en
  approchant, l'aidant devient la proie → exclu par `o.chase===m.id` ; mob à 6 cases, hors de sa lumière
  (`nearestThreat`) → retour au travail → l'allié redevient la proie → aide… (bascule toutes les ~0,5 s). 2) Seuil
  `HELP.range` : à 20 pile, un pas de contournement → 21 → travail → 20… Même chose à la nouvelle limite (seed 7919).
- **Correctif** : le mob `m.helpFoe` reste candidat même s'il chasse l'aidant (statut « Combat (type) ») ; sa portée
  passe à `HELP.keep` (30, config) et il est prioritaire ; au-delà de keep → `m.helpSkip = o.id`, `helpFoe = null` :
  plus jamais d'aide sur ce mob (nouveau champ `helpSkip` dans `createMiner`).
- **Mesure** (6 seeds × 2 et 3 mineurs, tous en Aider allié, bascules aide ↔ autre en moins de 6 s) : 1689 → 350 ; ce
  qui reste = « Va aider » ↔ « Tombe » / « Combat » en avançant vers le même mob (normal). Areas identiques, profondeur
  ±10.
- **Tests** : `tests/mobs.test.js` +2 (mob qui se retourne contre l'aidant, immobile : tué ; abandon au-delà de keep),
  échouent sans le correctif ✅ ; mobs, team, trap, dungeon, miner, skills ✅ (89). Simulation `--miners 3 --count 5` :
  0 blocage, chiffres inchangés (Aider allié désactivé par défaut).
- **Point fragile** : `helpSkip` ne garde qu'un mob ; `helpFoe` n'est jamais remis à null à la mort du mob (id unique,
  sans effet).

### Bonus d'XP personnel, après le partage du pot (Geoffrey, 24/10) — ✅ en ligne le 24/10 (avec les Sorts)
- **Avant** : `buildSession` passait `xpMult = ringXpMult(groupRings)` ; `shareBySegments` multipliait chaque tranche du
  pot avant `xpShare` → tout le groupe profitait de l'Anneau du nerd.
- **Maintenant** : `ringXpPct(rings)` (`src/meta/stuff.js`, somme des `RINGS.items[r].xp` des anneaux d'UN joueur) ;
  `minerSpecs` (`src/shared/game.js`) ajoute `xpPct` par mineur, depuis SON stuff (`ringsOf(gearOf(i))`) ;
  `createMiner` le garde (`m.xpPct`, fini et > 0 sinon 0) ; `shareBySegments` (`src/sim/session.js`) partage le pot
  sans bonus puis `floor(part × (1 + xpPct/100))` sur le total du joueur. `G.xpMult` / `opts.xpMult` supprimés.
  Texte de l'anneau : « XP +3 % (porteur seul) » (`statLines`).
- **Tests** : `tests/anneaux.test.js` (nerd : [515, 500] à 2 avec un porteur, [333, 342, 333] à 3) ; anneaux, level,
  session, stuff, wiki, share, party ✅ (92).
- **Point fragile** : le bonus est calculé sur le total des tranches (un seul arrondi), pas tranche par tranche.

### XP de spécialisation et Sorts (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **XP de spé** : `XP.specPct` (10) / `XP.specCurve` (100 ×1,5) ; `src/meta/level.js` : `specXpOf`, `specLevelOf`,
  `specLevels`, progression `{ xp, spec:{arbre:xp}, credited }`, `creditXp(p, id, xp, { tree, xp })` (même idempotence).
  `endSession` met `specTree`/`specXp` dans chaque part (affichage du bilan) ; le serveur **recalcule** (`settleWith` :
  arbre de `rec.skills`, `specXpOf(share.xp)`). `publicProgress.spec`, `game.specLevelOf` → `party.members[].specLevel`
  → `specLabel(tree, level)` (lobby). Skills : `specLevelHtml` (`src/ui/level.js`).
- **Sorts** : `SPELLS` (config), `src/meta/spells.js` (état `{ learned, slots, ops }`, `spellOp`, `learnScroll`,
  `equippedSpells`, `sessionSpells`), stockage ns `spells` (+ `putInventoryAndSpells` pour un parchemin : une seule
  écriture), `POST /api/game/spells`, figés dans `rec.spells[compte]` au lancement (revérifiés : `sessionSpells` dans
  `minerSpecs`). Parchemins : objets `cat:'scroll'`, texture `scroll`.
- **Simulation** (`src/sim/spells.js`) : `afterDecide` (après `decide` dans `stepMiner` : move → `dash`, mine →
  `dynamite`), `updateSpells` (après les mineurs dans `tick` : Illumination, Inspiration `G.inspire`, Ulti shen),
  `learnOnMine` (dans `mineBlock`, Fast learner → `m.learned`). `mineT` × (1 + Inspiration) × (1 + appris) ;
  `baseMineT` (plans) inchangé. `breakBlock` exporté (Dynamite). Vue : `spells`, `spellCd` par mineur ; rendu : `dash`
  interpolé comme `move`. `simulate.js --spells a,b`.
- **Tests** : `tests/spells.test.js` (14), `tests/anticheat/spells.test.js` (4), level, lobby, game-service, nav ✅ ;
  régression sim (miner, session, team, mobs, dungeon, fall, trap, winch, mule, view, skills, replay, live…) 195 ✅ ;
  anticheat 83 ✅.
- **Simulation** `--miners 3 --count 5 --skills mixed` sans / avec tous les sorts (2 par mineur) : areas 4,8 / 5,0 ;
  profondeur 200 / 203 ; minés 2390 / 2511 ; pods au coffre 4276 / 4563 ; sorts lancés ≈ 59 / 30 / 80 par mineur.
  1re version (Ulti shen aussi en remontée) : areas 4,0 et une alerte « Retour (oxygène) » à y 192 → Ulti limité au
  mode `work`. ⚠️ Détecteur de blocage : 3 alertes sur 2 seeds avec sorts (« Va au piège », « Descend par l'existant »,
  « Change d'area ») contre 1 sans : pas analysé, à vérifier (seeds 15838 / 39595, `--spells …`).
- **Points fragiles** : Dash peut dépasser l'objectif d'une IA qui n'a pas de `m.target` (retour, treuil) : quelques
  pas en arrière, recharge 30 s, pas de boucle. Dynamite casse sous les échelles (les échelles restent, `G.ladder`).
  Ulti shen téléporte sans chemin (pas dans un donjon interdit).

### Buff du stuff fer et acier (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Quoi** : `STUFF.items` (`src/config.js`) : fer × 1,75 (épée × 1,25), acier × 1,5 (épée × 1,25), Plastron de
  l'équilibre × 1,5 ; stats entières arrondies à l'unité (demi → au-dessus : 66,5 → 67, 87,5 → 88, 7,5 → 8, 1,5 → 2),
  vitesses gardées en décimales (0,7 ; 1,05 ; 1,08 ; 0,72). Rien d'autre ne change : `pieceBonus` relit `ITEMS` à chaque
  calcul, donc les pièces enregistrées (nom, qualité, lignes en %, niveau) ont les nouvelles stats, et `itemValue` suit
  (lignes et runes grandissent : 20 % sur le plastron en fer = 21 pods au lieu de 12).
- **Pourquoi** : mesure du 24/10 (script hors dépôt, 3 mineurs mineur/logisticien/barbare aux arbres complets, seeds
  7919 × k) : fer 5,0 areas sur 20/20 seeds (area 5 ouverte vers 49 min, 20 % du seuil de l'area suivante en fin de
  session). Buffs isolés sur 10 seeds (plastron 90, jambes 1,2, bottes 1,2, casque 90, pioche 0,8, épée 17) : 5,0
  partout. Tout × 1,5 : 5,1 ; × 1,75 : 5,5 (20 seeds) ; × 2 : 6,0. Pioche seule 1,5 : 5,3 (20 seeds). Chitine 4,1, base 4,0.
  Répartition du temps (5 seeds, fer) : remontée 19 %, redescente 15 %, minerai 17,5 %, blocs 9 %, combat 8 %.
- **Tests** : amelioration, anneaux, blueprint, game-service, iron-furnace-gold-compass, rarity, research, skills,
  steel-gear, stuff, wiki ✅ (156). Nouveau test (`tests/steel-gear.test.js`) : pièces déjà fabriquées (identifiée avec
  une ligne, acier, épée, équilibre) via `minerSpecs` → nouvelles stats. L'ancien test « acier ≈ fer × 1,2 » devient
  « acier au-dessus du fer sur chaque stat ». Pas d'anticheat : aucun chemin de ressources touché.
- **État de vérification** : ⚠️ la simulation avec les valeurs exactes du patch (arrondis : épée fer 14 au lieu de 15,5
  dans la mesure × 1,75) a été interrompue avant la fin, à la demande de Geoffrey (mise en ligne). Attendu ≈ 5,4–5,5
  areas pour l'équipe en fer : à confirmer sur 20 seeds.
- **Points fragiles** : l'acier dépasse à peine le fer (casque 69/67, jambes et bottes 1,08/1,05, pioche 0,72/0,7) ;
  le test « acier au-dessus du fer » cassera si on remonte encore le fer sans l'acier.

### Pioches : buff réduit à × 1,25 (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Quoi** : `STUFF.items` : Pioche en fer 0,7 → 0,5 (0,4 × 1,25), Pioche en acier 0,72 → 0,6 (0,48 × 1,25). Le reste du
  buff du 24/10 (entrée précédente) est inchangé.
- **Tests** : amelioration (valeur pioche en fer 650 x), blueprint, research, skills ((1 + 0,5) × 1,06 = 1,59),
  steel-gear mis à jour.
- **État de vérification** : ⚠️ pas de simulation. Repère des mesures du matin : pioche +0,4 → +0,8 seule = +17 lignes de
  profondeur ; le buff complet avec pioche 0,7 donnait ≈ 5,5 areas en fer. Avec 0,5, attendre un peu moins : à mesurer.

### Mise à jour mineure : dégâts de zone, XP de spé 50 %, cap des jauges 200 (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Dégâts de zone** : seule source = nœud barbare `damage` (Force brute, `aoe:0.02` par rang) → `aoeOf(m.skill)`
  (`src/meta/skills.js`) → `splash` (`src/sim/actions.js`, mine) et `hitMob` (`src/sim/tower/session.js`). Chaîne
  vérifiée de bout en bout : `buildSession` avec `skills:{A:{tree:'barbare',ranks:{damage:3}}}` → coup 5,75, voisin
  −0,345 (6 %), mob à 3 cases intact ✅. Mesure (5 seeds × 3 barbares 3/3) : 7350 coups, 20 % avec un mob voisin. Pas
  de bug ; effet trop faible pour se voir. Aucun retour visuel (pas de chiffre affiché). Test `tests/skills.test.js` (+1).
- **XP de spé** : `XP.specPct` 10 → 50. Tests `tests/level.test.js` (865 → 432) et `tests/game-service.test.js`
  (barbare 432, SP lvl 3).
- **Jauges** : `JUDGMENT.cap` 250 → 200. `sanitizeJudgment` borne `count` à cap : une jauge enregistrée au-dessus de
  200 est ramenée à 200 et ouvre sa tour au prochain `refresh` (si aucune autre tour n'est ouverte). Test
  `tests/game-service.test.js` (150 puis 300 ≥ 200).
- **Tests** : level, spells, judgment, game-service, tower, wiki ✅ (99) ; skills ✅ (21).
- **Affichage des dégâts de zone** (option 2 choisie) : `splash` (mine) et `hitMob` (tours) posent
  `q.splash = { v, t: G.t }` sur le mob touché par la zone ; `mobView` (`src/shared/view.js`) et la vue des tours
  (`src/shared/tower-view.js`) l'envoient ; `src/render/splash.js` (`drawSplash`, `splashText`) dessine « -0,3 » qui
  monte (`FX.splashRise` px) et s'efface en `FX.splashMs` ms, heure du navigateur (première fois qu'il voit ce coup :
  fluide entre deux envois) ; ignoré si plus vieux que `FX.splashGame` s de partie (reconnexion). Appelé dans
  `src/render/canvas.js` et `src/render/tower.js`. Tests `tests/skills.test.js` (+1, et le bout en bout vérifie
  `splash` et la vue) ; skills, tower, view, mobs, dungeon ✅ (72). ⚠️ pas regardé dans un navigateur.
- **Incident** : une autre discussion a basculé `F:\idledollexminer` sur `geoffrey/perf-chemin` pendant ce travail ;
  mes fichiers ont été déplacés dans un worktree séparé (patch), le sien n'a pas été touché (`path.js`).

### Retour au coffre guidé (A*) : simulation × 2 (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Diagnostic** (`node --cpu-prof`, seed 7919, 3 mineurs, 34 s) : `planReturn` 81 % du temps (dont `search` 35 % en
  propre, tas 15 %, `relax` 13 %, `landing` 10 %). ~14 000 appels par session à 3 mineurs (`decideWork` en appelle un
  à chaque décision pour `tRet`, `decideReturn` à chaque pas), ~100 millions de nœuds sortis du tas.
- **Quoi** : `search` (`src/sim/path.js`) prend une estimation optionnelle `h` (A*) : priorité du tas = dist + h, entrée
  périmée si `popD > dist[n]+h(n)`, arrêt `popD > maxCost`. `h=null` = Dijkstra inchangé (tous les autres appels).
  `planReturn` passe `returnH(G,m)` : |x − CHEST_X| × baseMoveT + y × min(baseClimbT, baseWinchT si treuil).
  Admissible et cohérente : tout pas horizontal coûte ≥ baseMoveT (marche, galerie, passerelle), toute montée ≥
  échelle ou seau ; `rowCrowdCost`, chutes et minage ne font qu'ajouter. Même coût de retour exact ; seul le choix entre
  deux itinéraires à égalité parfaite peut changer (ordre de sortie du tas différent).
- **Mesures** : nœuds sortis ÷ 2 à 2,5 ; session 3 mineurs 34 s → 15,5 s (seul) ; `--miners 3 --count 5` lancé en même
  temps que l'ancienne version : 267,7 s → 154,2 s. Parties identiques : 4/5 à 3 mineurs (seed 39595 : prof 187 → 186,
  coffre 3944 → 4024 pods environ, 0 blocage) ; prototype sur 6 seeds : 6/6 à 1 mineur, 4/6 à 3 mineurs (47514 : coffre
  4238 → 4104). Écarts dans les deux sens, du même ordre que le bruit entre seeds.
- **Tests** : nouveau `tests/path.test.js` (A* = Dijkstra sur ~20 instants de vraies sessions à 1 et 3 mineurs, et avec
  le treuil) ; régression miner, fall, winch, dungeon, mobs, tier2, research, game-replay, session, diagnostics, focus,
  mule, team, game-service, trap, treasure : 265 ✅.
- **État de vérification** : ✅ (temps de retour identique vérifié, simulation 5 sessions sans blocage).
- **Points fragiles** : si on ajoute un jour un déplacement plus rapide qu'un pas par colonne ou qu'une montée par ligne
  (téléport, saut, sort de déplacement dans l'itinéraire, treuil horizontal…), `returnH` doit en tenir compte, sinon le
  retour ne sera plus le plus rapide. `tests/path.test.js` le détecte. Prochaine piste (pas faite, change le
  comportement) : ne pas recalculer `planReturn` à chaque décision de `decideWork` quand la fin de session est loin.

### Méphite (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Quoi** : `MOBS.spawnTable` (méphite 0,05 / 0,15 / 0,2 en areas 3 / 4 / 5+, gobelin 0,55 / 0,55 / 0,3), `hpBase.mephite`
  70, `minArea.mephite` 3, `MOBS.mephite` { every 2, oxygen 5, flyReach 400, item, loot 1–2 }, `XP.mob.mephite` 12,
  objet `Vésicule de gaz` (material, tex `gas_vesicle`), `MOB_INFO.mephite`, textures `mephite` / `gas_vesicle`
  (`scripts/gen_textures.py`).
- `src/sim/mobs.js` : `FLYERS` / `isFlyer` (méphite aussi dans `WALKERS` : plafond walkerCap et poursuite) ; pas de
  chute pour un volant ; `flyStep` = BFS par les cases vides (4 directions, ni donjon ni intérieur de piège voilé, au plus
  `flyReach` cases) jusqu'à une case voisine de la proie, un pas par `mobStep` ; `asphyxia(G)` après la boucle des mobs :
  un compteur par mineur (`m.choke`) tant qu'au moins un méphite le tient, pulse → `resists` sinon `m.ox -= 5` (≥ 0),
  stats `choked`. Apparition : un volant peut naître en l'air (pas de `supported`). `src/sim/actions.js` : butin.
  Rendu : sprite qui flotte (±1 px, affichage seulement). Wiki : fiche, butin, texte de la Ténacité.
- **Tests** : `tests/mephite.test.js` (8 : table, PV 70/81/93, vol dans un puits sans échelle vs bestiole bloquée, ne
  tombe pas, asphyxie −5 / 2 s, non cumulable, ténacité 100 % → rien + plancher 0, butin 1–2, pièges) ✅ ;
  `tests/goblin.test.js` : tirages adaptés à la nouvelle table + cas méphite. ⚠️ Ce test échouait déjà sur main
  (occultiste attendu à 100 PV, 150 depuis le 23/10) : corrigé (150 / 173). Mobs, trap, wiki, rarity, inventory, view,
  session, team, dungeon, fall, winch, mule, skills, miner, duck, loot, crusher, lobby, diagnostics, skins, stuff… ✅ (348).
- **Mesure** (10 seeds, 3 mineurs en fer, arbres complets) : 7,1 méphites par session (dont 0,6 de piège), 7,3 s de
  combat par rencontre, 25 pulses d'asphyxie par session (127 s d'oxygène) → ≈ 25 s par rencontre. Pour comparer :
  gobelin ≈ 16 s (vol compris), occultiste ≈ 17,5 s. Areas 5,1 (inchangé à ±0,1).
- **Simulation standard** `--miners 3 --count 5 --skills mixed` : 5 sessions, 0 bloquée ✅ (areas 3,6, profondeur 200, 29 allers-retours). Effet sur la progression (même équipe, mêmes 10 seeds, arbres complets) : sans stuff 4,0 → 4,0 areas (2,4 méphites et 74 s d'oxygène perdues par session) ; en fer 5,1 → 5,1.
- **Points fragiles** : `flyStep` lance une recherche (≤ 400 cases) à chaque pas d'un méphite qui chasse : à surveiller
  pour la vitesse des simulations. Un méphite peut viser un mineur dans une galerie qu'il ne peut pas rejoindre par le
  vide (mineur entouré de roche) : il reste sur place, sans osciller.

### Sets (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Quoi** : `SETS` (config : max 20, nameMax 24) ; `src/meta/sets.js` (`snapshot`, `setOp` create/save/rename/delete,
  `applySet`, `sanitizeSets`) ; stockage ns `sets` + `putLoadout` (inventaire, stuff, skills, sorts, sets en un seul
  `changed`) ; `POST /api/game/sets` (verrous inv + skills + spells + sets, triés par `withLock.many` ; create/save/equip
  refusés en session) ; `src/ui/sets.js` (même panneau dans `#setsStuff`, `#setsSkills`, `#setsSpells`).
- **Équiper** : tout le stuff porté → `putPiece`, puis `takePiece` par uid (bonne case, pas deux fois le même objet) ;
  skills = `sanitizeSkills(set.skills, points)` (garde `ops`) ; sorts filtrés par `equipBlocked` avec l'arbre du set.
- **Tests** : `tests/sets.test.js` (7), `tests/anticheat/sets.test.js` (2 : 10 équipements en parallèle, set trafiqué).
- **Point fragile** : un set retient des uid ; une pièce améliorée garde son uid (OK), une pièce recyclée/sacrifiée
  disparaît (case vide). La réponse renvoie tout l'équipement : le navigateur remplace inventaire, stuff, skills, sorts.

### XP de spécialisation : même courbe que le niveau (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Quoi** : `XP.specCurve` passe de `{ first:100, factor:1.5 }` à `{ first:1000, factor:1.5 }` (= `XP.curve`) ;
  `XP.specPct` reste 50. Aucun code changé (`src/meta/level.js` lit déjà la config).
- **Tests** : `tests/level.test.js` (besoins 1000 / 2250 + test « même courbe que `levelOf` »),
  `tests/game-service.test.js` (432 XP de spé → niveau 1 ; Dash niveau 5 = 8125), `tests/sets.test.js` (8125) ;
  spells, lobby, anticheat/spells ✅ (95/95).
- **Point fragile** : les comptes existants gardent leur XP de spé brute, leur niveau recalculé baisse ; un sort
  déjà équipé dont le niveau n'est plus atteint ne part plus en session (`equipBlocked`, comme après un reset).
- ⚠️ **Incident** : la 1re mise en ligne (d3f3877) ne contenait que la doc : une autre discussion avait changé de
  branche dans le même dossier et mis `src/config.js` et les tests de côté (stash « xp-sp-courbe wip »). Code et tests
  remis par `geoffrey/fix-xp-sp` (95/95 ✅) — ✅ en ligne le 24/10. Leçon : une discussion par dossier (git worktree).

### Occultiste : butin de chitine (Geoffrey, 24/10) — ✅ en ligne le 24/10 (anticheat 85/85)
- **Quoi** : `MOBS.occult.chitin` (config : `rng => 1 + floor(rng()*2)`) ; `killMob` (`src/sim/actions.js`) crédite
  `MOBS.bugItem` via `lootOf` (Pillage compris), comme `goblinChitin` ; wiki `src/wiki/data.js` (2e ligne de butin).
  Un tirage `G.rng()` de plus par occultiste tué : les parties d'une même seed ne sont plus identiques à avant.
- **Tests** : `tests/mobs.test.js` (300 kills : Tissu {1,2,3}, Chitine {1,2}), `tests/wiki.test.js`, goblin,
  anticheat/mule ✅ (39/39). Simulation `--miners 3 --count 5` : 0 bloquée ✅ (areas 3,2, prof 193).

### MI : descente gratuite → puits jusqu'au fond (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Symptôme** (retour de Geoffrey) : les mineurs de la MI foncent au fond au lieu de creuser sur les côtés.
  Sonde (10 seeds, stats de base) : étalement horizontal/vertical des blocs minés 0,57 / 0,44 / 0,31 à 1 / 3 / 8
  mineurs ; 95 % atteignent y ≥ 40 à 8. Échelles rares (1 à 2 par mineur) : ce n'est pas la remontée qui coûte.
- **Cause** : `plan` (`src/sim/instant/ai.js`) cote un bloc voisin au temps de trajet jusqu'à la case d'où le miner.
  Le bloc du dessous coûte 0 (la gravité y amène le mineur gratuitement) ; le suivant sur le côté coûte un pas. Les
  caps diagonaux vers le bas (pénalité 0,22 dans les deux sens) dégénéraient donc en puits droits : bas + diagonales
  basses = 45 % des caps tirés.
- **Correction** : `+ MI.downWeight × mv` (mv = 1/speed) sur un bloc dy = 1, `downWeight: 1` en config. Proportionnel
  au pas : en secondes fixes, il y a un seuil à mv (0,3 → 0,4 s : 26/60 → 3/60 au fond), qui basculerait avec la stat
  vitesse.
- **Mesures** (20 seeds ; dw 0 → 1) : 1 mineur, au fond 8/20 → 1/20, moitié basse 35 → 18 %, h/v 0,61 → 0,90, plumes
  5,2 → 5,6 ; 3 mineurs, 26/60 → 2/60, 42 → 25 %, h/v 0,48 → 0,66, plumes 4,58 → 4,08 ; 8 mineurs, 56/160 → 34/160,
  51 → 40 %, h/v 0,32 → 0,39, plumes 3,66 → 3,27. Blocs/mineur ≈ 102 inchangé, grimpe ≈ 0,5 % du temps.
  dw 1,15 : h/v 1,12 à 3, plumes 3,8.
- **Tests** : `tests/instant-mine.test.js` +1 (« MI descente », 4 seeds × 3 mineurs : ≤ 15 % au fond, < 33 % des blocs
  dans la moitié basse ; échoue avec downWeight 0 : 2/12 au fond). instant-mine, instant-server, instant-ui, wiki :
  49/49 ✅. Pas de `npm run simulate` : la mine normale n'est pas touchée.
- **Mise en ligne** : deux discussions travaillaient dans le même dossier ; le code (config, ai.js, test) est parti
  dans le commit `e4397eb` de l'autre (« Journal : XP de spé… », fusionné dans `main` par `d3f3877`), avec une partie
  du chantier Occultiste/Chitine (`src/sim/actions.js`, `tests/mobs.test.js`, `MOBS.occult.chitin`). Doc ajoutée
  ensuite par la branche `geoffrey/ia-exploration-blocages`. Conseil : une discussion = un dossier (git worktree).
- **Points fragiles** : moins de plumes (zone couverte plus concentrée en haut). Le test « MI descente » a peu de marge
  sur sa première borne (2/12 sans la correction contre ≤ 1,8 permis).

### Armure en acier + Tainted gold (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Quoi** : `src/recipes.js`, casque / plastron / jambes / bottes en acier : + `'Tainted gold'` = ½ du `'Steel ingot'`
  (5 / 8 / 7 / 4). Wiki généré depuis les recettes (rien à faire). GAME_DESIGN : tableau du stuff en acier.
- **Tests** : `tests/steel-gear.test.js` (coûts attendus), craft, wiki ✅ (20) ; `npm run test:anticheat` ✅ (85).

### Wiki à jour + date dans le bandeau (Geoffrey, 24/10) — ✅ en ligne le 24/10
- **Quoi** : `wiki.html` (bandeau `.maj` « 🗓 Mis à jour le … », sections `#sorts`, `#spe`, `#anneaux`, `#sets`, textes
  corrigés : passerelles, touches, MI, aider allié) ; `src/wiki/data.js` (`spellRows`, `spellInfo`, `specInfo`,
  `ringDrop`, `helpInfo`, lus dans `SPELLS`, `XP`, `RINGS`, `HELP`) ; `src/wiki/wiki.js` (`spells()`, `#w-spec`,
  anneau des trésors, spans `w-help-*`) ; `src/wiki/wiki.css` (`.top .maj`). CLAUDE.md §3 : règle wiki + date.
- **Tests** : `tests/wiki.test.js` (8, dont 1 nouveau : sorts, XP de spé, anneaux, date du bandeau) ✅. Rendu vérifié
  avec un faux DOM (aucune erreur, aucun bloc `w-*` vide) ; ⚠️ pas regardé dans un vrai navigateur.
- **Point fragile** : la date du bandeau est écrite à la main dans `wiki.html` (pas de date de commit côté navigateur).

### Don d'administration avec qualité (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `server/game/service.js` `adminGive(accountId, item, qty, quality)` : `quality` facultative, entier 1 à 7
  (`qualityDef`), seulement pour une pièce de stuff hors anneau (`isStuff && !isRing`) ; les slots créés reçoivent
  `q` (identifiée, qualité seule, comme une identification depuis le 22/10). `server/admin/routes.js` lit `quality`
  dans le corps ; `scripts/give-item.js` option `--quality` (vérifiée avant l'appel). Sans `quality` : inchangé.
- **Tests** : `tests/admin.test.js` +1 (R5 et R7 donnés et relus, refus : Treasure, anneau, 0, 8, 4.5, '5'),
  `tests/give-item.test.js` +1 (`--quality 5`, refus 0 / 8 / R5) : 9/9 ✅.
- **Point fragile** : `give-admin.js` (hors ligne, avec redémarrage) reste l'outil pour R1 à R7 d'un coup.

### Combat dynamique : portée, recul, tacle refondu (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/sim/knock.js` (nouveau : `gap`, `inReach`, `push`, `knockOf`, `driftsAway`, `recenter`) : chaque
  entité garde un décalage `kx`/`ky` (−0,5…+0,5) dans sa case ; `push` passe sur la case voisine au-delà d'une
  demi-case si `canEnter`, sinon décalage remis à 0 (jamais à cheval sur un bloc). Config : `COMBAT` (reach 0,5,
  knock 0,25, tackleGiveUp 5 s, tackleLeash 6), `STATS.knockRes` (0), `MOBS.hitEvery` (1) / `MOBS.knock`
  ({ minotaure: 0,25 }), `TOWER.mobs.hitEvery/knock`, `TOWER.boss.push` ; stat ajoutée à `statLabels`, `statUnits`,
  `shownStats`, `DEV_TUNABLES`, wiki (`src/wiki/data.js`).
- **Mine** : `src/sim/mobs.js` : `mobCanEnter` (mimic jamais, canard sur le sol de sa zone via `duckCanEnter`, boss
  dans sa salle, pas sur un mineur), `keepsGrab`/`grab` (tacle à portée, gardé jusqu'à mort / provocation / soupape ;
  `o.grabHit` = dernier coup du mineur taclé, posé à la prise), `strike` (coups qui poussent), `closeIn` (le mob
  revient à portée : recentrage s'il est à côté, sinon un pas). Le mob garde son tacle en tombant ; `ky` remis à 0 hors
  échelle (il retombe). `src/sim/actions.js` : coup seulement si `inReach`, puis `push` du mob ; `o.grabHit` ; un pas
  remet `kx/ky` à 0 ; `fx/fy` d'un pas partent du décalage (affichage). `src/sim/ai.js` : `fight` frappe à portée,
  sinon se recentre (action `move` sur sa case) ou avance ; taclé → `data.fight` sur l'action, que
  `src/sim/session.js` n'interrompt plus. `goFight`, chasse au canard et boss du donjon : `|| inReach`.
- **Tours** : `src/sim/tower/session.js` : `mobReach` (depuis la case du mob la plus proche : 2 cases de haut),
  `mobFits`, `pushMiner` (jamais en plein pas), tacle comme dans la mine, mob qui suit, `hitMob` pousse, boss : recul
  0,25 quand il ne projette pas (projection 6 cases gardée), lui ne recule pas. IA : taclé → frappe / se recentre /
  `planTo` vers le mob ; un mineur repoussé à côté d'un mob se recentre (sinon `planTo` renvoyait un chemin vide :
  « Attend », compté dans `G.stats.blocked`, vu sur les seeds 11 et 15).
- **Affichage** : `kx/ky` dans `src/shared/view.js` et `tower-view.js` ; `src/render/canvas.js`, `tower.js`,
  `instant.js` (`instantPos`) les dessinent.
- **Tests** : `tests/knock.test.js` (7, nouveau), `tests/combat.test.js` (11, nouveau : recul, mur, mimic, combat réel
  sans séparation > 2 cases, tacle à portée, tacle qui dure, soupapes 5 s et 6 cases, vol du gobelin à distance,
  minotaure + résistance 100 %, vue), `tests/tower.test.js` (+2). Adaptés : `mobs.test.js` (le mob reste à 1 ou 2 cases
  au lieu d'exactement 1), `miner.test.js` (nom). Lancés : knock, combat, mobs, miner, goblin, mephite, skills, duck,
  dungeon, trap, spells, winch, mule, team, fall, session, tower, view, instant-ui, live, game-replay, carac, stuff,
  lobby, wiki, sets, steel-gear, amelioration, rune, anneaux, game-service ✅. Treuil, Mule, effroi au donjon :
  leurs tests passent sans changement.
- **Simulation** (5 sessions, branche / main) : solo coffre 1 623 / 1 703 pods, profondeur 99,6 / 99 ; à 3 coffre
  4 161 / 4 075, profondeur 196 / 193, mobs tués 398 / 422, tacles 173 / 187, vols 820 / 832 ; **0 blocage**.
  Tours (compo forte du test, seeds 11-15) : victoires 0/5 (main 2/5), PV du boss restants 45-1 350 (main 0-450),
  dégâts ≈ −8 %, toit atteint ≈ 15 s plus tard ; 0 blocage.
- **Points fragiles** : l'occultiste canalise 5 s = la soupape 5 s : un tacle d'un autre mob peut sauter pendant
  l'étourdissement (il se reprend aussitôt si le mob est à portée). Le coup du mineur est perdu si le mob a été
  repoussé hors de portée pendant l'élan (par un autre mineur). Le recentrage est une action `move` sur sa propre case
  (durée |k| × pas). ⚠️ Pas regardé dans un vrai navigateur.

### Aura du stuff (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `AURA` (config : seuil R4, paliers, rayon / opacité / pulsation) ; `src/meta/aura.js` (`auraQ`, `aurasOf`,
  `sanitizeAuras`, `auraLook`, pur) ; `src/render/aura.js` (halo pixel art calculé depuis les pixels de la texture,
  gardé en cache par texture + couleur + rayon ; `drawAura`). Dessiné **avant le corps** (`miner-sprite.js`,
  `portrait.js`) : un premier essai par-dessus le corps recouvrait le visage en R7. `skins.js` : `armorPieces`.
- **Données** : champ `auras: { case: qualité }` à côté de `look` (format de `look` inchangé). Calculé depuis
  `record.gear` : `minerSpecs` (session + tours), `instantSpecs` ; le record de la **MI enregistre maintenant `gear`**
  (`server/game/service.js`, seulement pour l'aura : les caractéristiques de la MI restent calculées depuis `look`).
  Sessions anciennes sans `gear` : pas d'aura. Copié dans le mineur (`mineur.js`, `instant/session.js`,
  `tower/session.js`) et envoyé par `view.js`, `instant-view.js`, `tower-view.js`. Lobby : `game.aurasFor` →
  `publicParty` (`auras`) → `portraitAuras` (revérifié par `sanitizeAuras`). Portrait : boucle `requestAnimationFrame`
  seulement s'il y a une aura, arrêtée quand le canvas change ou quitte la page.
- **Tests** : `tests/aura.test.js` (10 : seuils, plus basse des deux, fragment refusé, valeurs absurdes, cases
  visibles, palier/couleur, session → vue, MI, tours, lobby) ; `tests/party.test.js` +1. aura, party, lobby,
  instant-server, game-service, game-replay, view, skins, tower, instant-mine, session, miner, stuff, amelioration,
  anneaux ✅. Rendu vérifié ✅ dans Edge sans fenêtre (page d'aperçu temporaire, avec le vrai `createMinerSprite`,
  miroir compris). ⚠️ Pas vu dans une vraie partie (il faut une pièce R4+ runée sur un compte de test).
- **Points fragiles** : le halo lit les pixels de la texture (`getImageData`) : les textures doivent rester servies par
  le même site. Le portrait du haut est redemandé à chaque mise à jour du HUD : la clé (pièces + qualités d'aura) évite
  de relancer la boucle.
- **Mise en ligne** : simulation `--miners 3 --count 5` : 0 bloquée ✅ (areas 3,2, prof 193). Pas d'anti-triche :
  aucune ressource ne bouge.

### Treasures : 40 % par area (Geoffrey, 24/10) — ✅ en ligne le 25/10 (avec `geoffrey/tresor-60`)
- **Quoi** : `AREAS[*].chestChance` 0,3 → 0,4 (les 7 areas). Wiki : `D.treasureChanceText()` remplace le « 30 % »
  écrit à la main (`#w-treasure-chance`). GAME_DESIGN §2 Treasures.
- **Tests** : wiki (9, dont 1 nouveau), treasure, world, loot, game-replay ✅ (54).
- **Simulation** `--miners 3 --count 5`, mêmes seeds : 0 bloquée ✅ ; areas 3,2, profondeur 193,4, coffre 4 075 pods :
  identiques à 0,3 (le tirage du treasure ne change pas le reste de l'area) ; treasures présents dans les areas
  ouvertes 1,2 → 1,6, ouverts 0,4 → 0,4 (seed 7919 : 2/2 → 2/3).

### Treasure T1 : 60 % en areas 0-2, BP en fer 2 %, parts 5-10 (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/config.js` : `AREAS[0..2].chestChance` 0,4 → 0,6 (areas 3+ : 0,4, de `geoffrey/tresor-40`, inclus) ;
  `LOOT['Treasure T1']` : Blueprint parts 5-15 → 5-10, BP pioche / épée / casque / plastron / jambes / bottes en
  fer 0,01 → 0,02 (four, boussole, ceinture : 0,01). Total famille blueprint 9 % → 15 %. GAME_DESIGN §2 Treasures ;
  wiki : date du bandeau 25/10, « 40 à 60 % » vient de `treasureChanceText()`.
- **Tests** : wiki (chance par area, total blueprint 0,15), loot, treasure, world ✅ (46) ; `npm run test:anticheat` ✅ (85).
- **Simulation** `--miners 3 --count 5` : 0 bloquée ✅ ; areas 3,0, profondeur 190,2, coffre 4 063 pods ; treasures
  présents dans les areas ouvertes 2,0, ouverts 0,4.
- **Point fragile** : la hausse ne se voit presque pas en simulation (ouverts 0,4 à 30, 40 et 60 %) : c'est la
  découverte qui limite, pas la chance.
- **Ajout (25/10)** : `BLOCKS[5]` (Or) `w` 4 → 3 ; GAME_DESIGN §Poids. Tests level, steel-gear, tier2, wiki, inventory,
  share ✅ (78). Simulation `--count 5` : 0 bloquée, coffre 4 040 pods (4 063 avant) : l'or n'apparaît qu'en area 3,
  à peine atteinte sans stuff ; l'effet se verra sur les équipes équipées.

### Lobby : équipe visible sur Jugement (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/ui/lobby.js` : nouvelle fonction pure `lobbyCards({ view, mode, dev })` (cartes visibles : judgment, mi,
  team, launch, prefs, dev) ; `render()` l'utilise. Vue Jugement : `teamCard` visible, `launchBtn` caché, texte
  « choisis la Mine ou une tour ». GAME_DESIGN §Jugement.
- **Tests** : `tests/lobby.test.js` +1 ✅ (14). ⚠️ Pas regardé dans un vrai navigateur.

### Inventaire : trier et déplacer (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/meta/inventory.js` : `sortInventory(inv)` (clé : groupe `INVENTORY.sortGroups` par `ITEMS[].cat`, puis
  `-rarityDef().rank`, puis ordre de `ITEMS`, puis ordre actuel ; tassé, sans trous) et `moveSlot(inv, { from, to, item, uid })`
  (échange ; `to` < `gridSize` ; refuse si `slots[from]` n'est pas l'item/uid annoncé : un renvoi ne ré-échange pas).
  Serveur : `POST /api/game/inventory` `{ action:'sort' }` | `{ action:'move', … }` (`server/game/service.js` `inventory()`, verrou
  `inv:`). Navigateur : `gameApi.inventory`, bouton `#invSort`, glisser-déposer HTML5 dans `src/ui/inventory.js`, `arrangeInventory`
  dans `src/main.js` (refus → inventaire relu). Familles réelles : `bloc`, `combustible` (charbon), `ore`, `residu`…
- **Tests** : `tests/inventory-arrange.test.js` (6), `tests/inventory.test.js` ✅ ; `tests/anticheat/arrange.test.js` (300
  demandes en rafale / trafiquées : mêmes objets, mêmes quantités, mêmes uid) ✅.
- **⚠️ À vérifier** : pas essayé dans un vrai navigateur (glisser-déposer, bouton). Pas de tactile (le drag HTML5 ne
  marche pas au doigt).

### Recycler une pièce de stuff (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `RECYCLE.share` 0,6 (config). `src/meta/craft.js` : `recyclable(item)` (`isStuff` + recette), `recycleRefund(item)`
  (`floor(n × share / qty + 1e-9)`, les 0 retirés ; le 1e-9 évite 62,999… → 62), `recycleStuff(inv, uid, locked)`.
  `src/meta/sets.js` `inSomeSet`. Serveur `POST /api/game/recycle { uid }` (verrous `inv:` + `sets:`, sets relus). Pas d'opId :
  la pièce est unique, un renvoi tombe sur `not_owned`. Navigateur : bouton `.invRecycle`, fenêtre `showRecycle` (réutilise
  `#loot`), `setsUI.setsOf(uid)` pour prévenir avant d'envoyer, `recyclePiece` dans `src/main.js`. Wiki : carte Inventaire, date.
- **Tests** : `tests/recycle.test.js` (4) ✅ ; `tests/anticheat/recycle.test.js` (rafale de 8 → 1 seul versement ; portée,
  set, uid trafiqués refusés) ✅ ; suite anti-triche ✅ (89).
- **⚠️ À vérifier** : fenêtre et bouton pas vus dans un vrai navigateur.

### Donjon : barbare sur le seuil = entré (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Cause** : `d.barbIn` (`updateDungeons`, `src/sim/dungeon.js`) n'était vrai qu'avec un barbare à l'**intérieur**. Entrée sur
  la ligne du boss (`hry` = ligne du bas, 1 fois sur 3) et boss déjà contre l'entrée (`updateBoss` le fait marcher vers
  le barbare dès qu'il est sur le seuil) : le barbare se bat depuis la case d'entrée, n'entre jamais, `barbIn` reste faux,
  les autres restent « Attend le barbare devant le donjon » tout le combat.
- **Correction** : `barbIn` dès qu'un barbare `isIn` (intérieur ou seuil). La découverte de la structure reste sur l'intérieur.
- **Tests** : `tests/dungeon.test.js` +1 (seuil, boss en x 13 : les 2 autres combattent ; échouait avant) ✅ (14).

### Dash : chemin, visée, étourdissement (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/sim/spells.js` (bloc Dash réécrit) : `dashStep` (marche ; chute ≤ fallMax ; saut d'1 bloc si les deux cases
  du dessus sont libres ; jamais en case inconnue, piège caché, donjon interdit, ni à travers un mob), `aimOf` (helpFoe si
  helping, sinon foe, sinon boss du donjon rejoint), `dashTo` (Dijkstra ≤ range cases jusqu'au contact, chute ≤ CFG.maxFall),
  `tryDash` (tacleurs d'alliés d'abord, puis la cible ; rien à portée → sort gardé ; sans cible : course de terrain dans
  le sens du pas, marche d'1 vers le bas seulement), `finishDash` (pose aussi `m.y` ; coupe `o.channel` ; `o.stunUntil`).
  `src/sim/mobs.js` : un mob `stunUntil > G.t` est sauté dans `updateMobs` (grab = null), boss et Gallianix compris.
  Config `SPELLS.list.dash.stun = 2`, desc. `data.path` gardé dans l'action (pas envoyé au navigateur : le rendu reste
  linéaire, un Dash dure ≈ 0,3 s).
- **Tests** : `tests/spells.test.js` 18 ✅ (4 nouveaux : saut + marche, visée en contrebas / hors de portée gardé,
  priorité au tacleur, canalisation coupée + étourdi ; l'ancien test du trou utilise un trou de 2). dungeon, mobs, ai,
  trap, help, combat ✅ (67).
- **Simulation** `--miners 3 --count 5 --skills mixed --spells dash` : 0 bloquée ✅ ; areas 3,6 = 3,6, profondeur 194 → 202,
  coffre 4 449 → 4 468 pods ; sorts du barbare ≈ 59 → 57 par session ; mobs tués 432 → 434 au total.
- **⚠️ À vérifier** : nombre de Dash qui touchent un mob pas mesuré ; rendu d'un saut pas vu en vrai.
- **Fusion avec le combat dynamique (25/10)** : `finishDash` remet `kx`/`ky` à 0 comme un pas, et `fx`/`fy` partent du
  décalage. Le coup du Dash ne passe pas par `inReach` (contact en cases, comme avant). Tests spells, dungeon, mobs, combat,
  knock, trap, help, goblin, wiki ✅ (101) ; simulation normale et `--skills mixed --spells dash` : 0 bloquée.

### Aura des outils en main (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Symptôme** (retour de Geoffrey) : la pioche n'a pas d'aura quand le mineur mine. Pas un bug : la première version
  limitait l'aura aux calques du corps (`SKIN.layers`).
- **Quoi** : `src/meta/aura.js` (`SLOT_TEX` : armure + `pioche` → `SKIN.pickaxe`, `epee` → `SKIN.sword` ; `aurasOf` et
  `sanitizeAuras` lisent ces cases, jamais la pioche en bois `base`) ; `src/skins.js` `toolSlotOf(look, action)` (même
  choix que `toolOf`) ; `src/render/miner-sprite.js` : `drawAura` dans le repère tourné de l'outil, avant l'outil.
  Les données (`auras`) passaient déjà : rien à changer côté serveur ni vues.
- **Tests** : `tests/aura.test.js` (11 : cases dessinées avec pioche / épée, anneau exclu, `toolSlotOf`) ✅ ; skins,
  lobby ✅. Rendu vérifié ✅ dans Edge sans fenêtre (vrai `createMinerSprite` : pioche R5 / R7 en miroir, épée R6, bois).
- **Point fragile** : l'outil fait 13 px ; le halo faible (1 px × 13/16) est discret.

### Administration : régler une jauge du Jugement (Geoffrey, 25/10) — branche `geoffrey/admin-jauge`, ✅ en ligne le 25/10
- **Contexte** : la jauge du Démon était à 0 ce matin. Seule cause possible dans le code : la tour du Démon s'est
  ouverte (`refresh`, `src/meta/judgment.js`, seul endroit qui remet `count` à 0). En pause (tour de l'Ange ouverte),
  les résidus démoniaques versés sont ignorés et la jauge garde sa valeur ; pleine pendant la pause, elle attend la
  fermeture de l'Ange et s'ouvre à la première lecture (`withJudgment` appelle `refresh` à chaque lecture du lobby).
- **Quoi** : `setCount(j, side, count, now)` (`src/meta/judgment.js` : camp connu, entier 0..cap, même en pause, puis
  `refresh` → pleine = ouverture) ; `game.adminJudgment(side, count)` (`server/game/service.js`, sous le verrou
  `judgment`, enregistré) ; route `POST /api/admin/judgment` (`server/admin/routes.js`, même garde que `/give`, journal
  « Admin : jauge demon a → b / cap ») ; `scripts/set-judgment.js`. Lecture de la clé et appel mis en commun dans
  `scripts/admin-client.js` (`give-item.js` l'utilise, messages inchangés).
- **Tests** : `tests/judgment.test.js` (+2 : pause « 100 reste 100 » dans les deux sens, `setCount`), `tests/admin.test.js`
  (+1 : route, vue du lobby, relais refusé, 7 corps invalides), `tests/give-item.test.js` (+1 : script, refus avant
  l'appel) ✅ ; game-http ✅ ; anticheat 89/89 ✅.
- **Au passage** : `tests/game-http.test.js` « aucune route ne permet d'écrire dans un inventaire » échouait sur `main`
  depuis la route `POST /api/game/inventory` (trier / déplacer, 25/10) : elle répond 400 au corps piégé, le test
  n'acceptait que 404 / 405. Test élargi à 400 (l'inventaire reste vide, vérifié juste après). Pas un trou.
- **Point fragile** : pas d'opId, mais rejouer la même commande donne le même résultat (on règle une valeur, on n'ajoute
  pas). `--count 200` ouvre la tour tout de suite (ou dès la fermeture de l'autre).

### Groupe : ★ nommer chef pendant une session (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Cause** : `src/ui/lobby.js` cachait ★ et × avec le même drapeau `lead` (faux pendant une session). Le serveur
  (`server/party/service.js` `promote`) acceptait déjà, sauf pendant le lancement (`noChange`).
- **Correction** : fonction pure `slotButtons({ account, party, session }, slot)` → `{ promote, kick }` : ★ pour le chef
  sur un autre membre, même en session ; × hors session seulement (membre ou invité).
- **Tests** : `tests/lobby.test.js` +1 ✅ (15), `tests/party.test.js` ✅. ⚠️ Pas regardé dans un vrai navigateur.

### Tainted iron : 15 chitine (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `FURNACE.alloys` Tainted iron `in.Chitine` 20 → 15 (`src/config.js`) ; GAME_DESIGN (tableau des alliages) ;
  commentaire de `src/meta/furnace.js` ; wiki (tableau généré, date du bandeau).
- **Tests** : `tests/furnace.test.js` adapté (recette 15 ; chitine chargée 30 → 25 pour garder « la chitine limite à
  1 alliage » ; 20 → 15 pour finir les cases vides) ✅ (21) ; anticheat furnace, game-service, wiki ✅ ; `npm run
  test:anticheat` ✅ (89).

### Tour céleste : boss, étages de blocs, affichage fluide, mode dev (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Affichage** : la tour remplaçait sa copie à chaque envoi (250 ms) sans interpolation → sauts. `applyTowerView(v, prev,
  now)` (`src/shared/tower-view.js`) réutilise `glide` (exporté de `src/shared/view.js`) pour mineurs, mobs et boss
  (`lift`, `kx`) ; `src/main.js` passe la copie précédente ; `src/render/tower.js` lit `shownPos` ; arc du recul :
  `m.hop` (tick du coup) → `_hopAt` côté navigateur, `TOWER.boss.arcHigh/arcMs`.
- **Simulation** (`src/sim/tower/session.js`) : `G.blocksLeft[k]` (compteur, décrémenté dans `mineCell`) ; `sealedFloor`
  couvre « blocs » ; IA `blockFloorFor` (plus bas étage « blocs » pas vidé, à son étage ou au-dessus) + réservation
  `m.blockGoal` / `reservedBlocks` (avant : 12-16 s d'attente par étage à viser le même bloc ; 0 bloc partagé après) ;
  `planTo(..., avoid)`. `mobFits` sans mob ni mineur (empilement ; pareil pour `mobCanEnter` de la mine). Boss :
  `focusOf` (taunt sur le toit > focus sur le toit > 1er arrivé au contact > 1er arrivé sur le toit), marche vers le
  focus (`speedMul`), `contactSide` renvoie aussi `'in'` (dans sa hitbox : il frappe), `pushBoss` (seulement par le
  focus, `knockRes` 25), projection `knock(G, m, n)` 5 cases à `knockChance/knockBarb` (rage `rageKnock/rageKnockBarb`),
  sinon `pushMiner(..., B.push, arc)`. Saut : `startJump/stepJump/landBoss` (`jumpEvery` 0,25 → `phase` 0-3, `jumpFly`,
  `jumpHover` 3, `jumpFall`, `jumpKnock` 3 pour tous les mineurs du toit puis `jumpStun` 3 s, ténacité). IA pendant le
  saut : `landCells` (s'écarter, attendre à côté). Config : `TOWER.floors` 6, stonebrick `hard` 4, `TOWER.boss.*`.
- **Mode dev** : `DEV_SPEC`, `sanitizeDevSpecs` / `devSkills` (`src/shared/game.js`, arbre rempli avec niveau − 1 points),
  `rec.devSpecs` (serveur, dev seulement), `towerSpecs` garde `bots` (le serveur les met à 0 hors dev) ; lobby :
  `#devSpecs` ; `.speedBtns` / `.pauseBtn` (`src/ui/controls.js`) aussi dans `#twRun` ; `mineModes(..., dev)` et
  `start()` sautent `tower_closed` / `tower_done` en dev.
- **Tests** : `tests/tower-boss.test.js` (nouveau, 15), `tests/dev-spec.test.js` (nouveau, 7), `tests/controls.test.js`
  (nouveau, 2), `tests/tower.test.js` adapté (valeurs, focus). tower, tower-boss, dev-spec, controls, combat, mobs, view,
  live, game-replay, game-service, game-http, lobby, boot-check, team, skills, party, wiki ✅.
- **Mesures (avant les derniers réglages de Geoffrey, compo forte du test)** : toit ≈ 530 s (7 étages, briques 4 s) ;
  dégâts au boss 9 à 14 PV/s selon les versions (≈ 44 possibles) ; cause principale : le boss marche après son focus
  (25 PV/s s'il ne marche pas), croisements focus / boss. Le test « compo forte » repasse depuis projection 4 cases et
  chances 25 / 10 %. Simulation de la mine (5 × 3 mineurs, après l'empilement) : coffre 4 105, 0 blocage.
- **Points fragiles** : `contactSide` 'in' compte comme contact pour le focus (le boss ne marche pas s'il est dedans) ;
  un mineur dans la hitbox ne peut pas être « derrière » : la projection part du centre du boss. L'occultiste n'existe
  pas dans la tour. ⚠️ Pas regardé dans un vrai navigateur par Claude (Geoffrey l'a lancé en local).

### Donjon : rôle avant l'oxygène, révélation au seuil (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Bug « salle pas découverte »** : `updateDungeons` (`src/sim/dungeon.js`) ne révélait qu'avec un mineur à
  l'**intérieur**. Depuis le 25/10 (seuil = barbare entré), un boss contre l'entrée se bat avec le barbare sur le seuil :
  reproduit (scène de test, boss en x 13) : 2 s de combat sans révélation, jamais si personne d'autre n'entre.
  Correction : `isIn(d,m) || m.foe===d.boss`.
- **Oxygène** : `decideWork` (`src/sim/ai.js`) : une raison de remonter autre que la fin de session (oxygène, pods,
  torches), et pas la fin de session proche (`left>tRet+12`) → `dungeonGoal(G,m,true)` d'abord. `duty` saute la branche
  « sortir du donjon ». Pas de chemin (goTo échoue) → false → il remonte. Mode `return` déjà pris : inchangé (il finit).
  Mule : le donjon passe avant le sac.
- **Tests** : `tests/dungeon.test.js` (21 : seuil, combat au seuil barbare seul, barbare à 0 d'oxygène, attente avec
  oxygène 0 / pods pleins / sans torches, Fuir, sortie, fin de session, déjà en remontée) ✅. miner, mobs, combat, trap,
  spells, winch, session, skills, team, focus, wiki ✅. Simulation `--miners 3 --count 5` : 0 bloquée ✅ (areas 3,0,
  prof 194 ; donjons en areas 4-5, rarement atteintes).
- ⚠️ **Déjà cassé sur `main`, pas touché** : `tests/mule.test.js` « affichage : le navigateur reçoit le sac posé »
  (attend load 20, reçoit 15 ; sans doute l'or passé de poids 4 à 3, branche `geoffrey/tresor-60`).
- **Points fragiles** : la raison affichée reste « oxygène » quand l'oxygène et la fin de session tombent ensemble
  (vérifiée en premier). Un boss qu'on ne peut pas atteindre (toutes les cases autour prises) : `goTo` peut échouer et
  le mineur remonter.

### Piège : le barbare n'ignore plus les mobs (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Causes** (`src/sim/ai.js`, sonde sur 10 seeds à 3, arbres mixtes) : les mobs de piège entraient dans `m.ignored` (pour
  toute la session), et `trapGoal` saute les ignorés : le barbare retournait miner.
  1. `fight` (combat « Combattre ») ne fait qu'un pas droit vers le mob ; barbare debout sur la paroi du plafond (seed
     23757, 39595) : pas impossible → règle « mob de piège inapprochable : ignoré » (faite pour les autres, seed 15838).
  2. `decide`, `foeGiveUp` : en creusant vers la salle (« Va au piège »), aucun coup pendant 5 s → ignoré (seed 39595).
- **Correction** : barbare + mob de piège : `fight` passe par `goFight` (vrai chemin, minage, échelles ; ignore seulement
  si inatteignable) ; `foeGiveUp` lâche le mob sans l'ignorer (trapGoal le reprend). Les autres mineurs : inchangé.
- **Tests** : `tests/trap.test.js` +1 (barbare debout sur le plafond de la salle : aucun mob ignoré, tous morts ;
  échoue sans la correction) ✅ ; trap, combat, mobs, dungeon, spells, help, goblin, knock ✅ (93).
- **Sonde** (`trapprobe`, 10 seeds) : mobs de piège ignorés par le barbare 9 → 0. **Simulation** `--count 5` : 0 bloquée ;
  à 3 sans skills : identique (4 132 pods) ; arbres mixtes : coffre 4 380 pods, profondeur 200.

### Casque, jambes et bottes en acier ≈ 400 x (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/config.js` ITEMS : casque en acier oxygenMax 69 → 100 (400 x), jambes climbSpeed 1,08 → 1,6 (400 x),
  bottes speed 1,08 → 1,67 (400,8 x), avec `UPGRADE.worth` (4 / 250 / 240 x par point). Fer : 268 / 262,5 / 252 x.
  Stats relues dans le catalogue : les pièces déjà fabriquées et leurs runes suivent.
- **Tests** : `tests/steel-gear.test.js` (valeurs + nouveau test 390-410 x et > fer × 1,4) ✅, wiki, amelioration ✅.
  Pas de simulation : les mineurs simulés n'ont pas de stuff en acier. Pas d'anti-triche : aucune ressource ne bouge.
- **Nerf des pioches** (même branche) : fer mineSpeed 0,5 → 0,4 (520 x), acier 0,6 → 0,5 (650 x) ; valeurs attendues de
  `tests/steel-gear.test.js` mises à jour. ⚠️ Tests pas relancés (demande de Geoffrey : « juste update »).

### Runes : un % du tier de la pièce (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `UPGRADE.tiers` (config : { 1:{ x:100, items }, 2:{ x:250 }, 3:{ x:400 } }) ; `src/meta/piece.js` : `tierOf`,
  `lineBase` (x du tier ; sans tier : `itemValue`, ancien calcul), `linePoints` lit `lineBase`. Un seul point de calcul :
  runes, fragments et lignes d'identification d'avant le 22/10, en session comme à l'affichage (stuff.js, upgrade.js).
  Lignes gardées en % : les pièces existantes suivent sans migration. `itemValue` reste exporté (plus utilisé par les
  lignes).
- **Textes** : onglet Amélioration (`upgrade.js`), rune seule (`stuff.js`), wiki (`wiki.html`, `wiki.js`).
- **Tests** : `tests/rune.test.js` +2 (chaque pièce runable a un tier, une seule fois ; valeurs T1/T2/T3, fragment) ;
  `tests/amelioration.test.js` et `tests/steel-gear.test.js` : valeurs attendues recalculées au tier. rune, amelioration,
  steel-gear, stuff, wiki, sets, treasure, aura, social ✅ (110). Pas d'anti-triche : aucune ressource ne bouge.
- **Point fragile** : une nouvelle pièce de stuff doit être ajoutée à `UPGRADE.tiers` (sinon elle garde sa propre
  valeur) ; le test « chaque pièce qu'on peut runer a un tier » échoue tant qu'elle n'y est pas.

### Tours : treuil du logisticien (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `TOWER.winch.setup` (10 s). `src/sim/tower/session.js` : `G.winch` ({ x, top: roof − 1, bottom: floor }),
  `G.winchBoost` (Escalateur), `isWinch`, `winchT` (comme la mine : climbSpeed × WINCH.speedFactor × (1 + boost)) ;
  `towerSupported` vrai sur le treuil ; `planTo` (monter / descendre par le treuil, `fallFrom` s'y arrête) ; `follow`
  (pas d'échelle à poser, action `move` avec `data.winch`). Déclenchement dans `land` : logisticien `skill.winch`,
  pas de treuil, au sol hors de la tour, personne d'autre en chantier → `m.winchJob = 'L' | 'R'` ; `decide` : aller à
  (x0 − 1 ou x1 + 1, floor) puis action `winchSetup` (pas de chemin : il abandonne). `finishAction` pose le treuil.
  Vue (`tower-view.js` : `winch`, `data.winch`), rendu (`render/tower.js` : corde, poulie, seau ; textures existantes).
  Skill Treuil : description complétée. Wiki : phrase dans la section des tours.
- **Tests** : `tests/tower.test.js` +4 (installation en 10 s après l'étourdissement, colonne et hauteur ; sans skill /
  seconde chute : rien de plus ; on y tient, remontée 12,9 s avec contre 101 s sans dans une tour vidée sans échelles ;
  vue) ✅ 16/16. `npm run simulate:tower -- --count 5` (+ compo d) : 0 « bloqué », treuil posé dans 10/10 tours de d),
  retours après chute 28-43 s → 18 s ; d) boss 1 648 PV contre 1 824 en b).
- **Points fragiles** : le treuil n'a pas de chantier visible pendant les 10 s (seulement le statut « Installe le
  treuil »). Si le logisticien quitte la partie pendant l'installation, son chantier part avec lui : un autre
  logisticien pourra en poser un à sa propre chute. Le wiki lit `T.winch.setup` (T = TOWER via `judgmentInfo`).
- ⚠️ **Déjà cassé sur `main`, pas touché** : `tests/skills.test.js` « onglet Stuff : les stats montrent aussi les bonus
  des skills » (échoue aussi sans ce chantier).

### Tours : regroupement après une chute (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `TOWER.regroup.maxWait` (45 s). `src/sim/tower/session.js` : `m.fell` posé dans `land` (projeté, atterri
  sous le toit), effacé dans `updateArrivals` (sur le toit) ; `waitPoint` (y = roof + 1 sous une colonne de la porte
  du toit, ou treuil à y = top + 1) ; `mustWait` appelé dans `decide` juste avant le boss : tombé, à un point
  d'attente, ≥ 2 mineurs, personne sur le toit. Tous à un point d'attente → on efface `fell` de tous (sinon le premier
  qui part casse la condition pour les autres) ; `waitSince` + maxWait → il part seul. Wiki : une phrase (lit
  `T.regroup.maxWait`).
- **Tests** : `tests/tower.test.js` +4 (attente sous la porte / montée si quelqu'un est sur le toit ; tous là, porte
  + seau : montent ensemble ; 45 s ; seul ; marque posée et effacée) ✅ 20/20. `npm run simulate:tower -- --count 5` :
  0 « bloqué » ; b 1 824 → 1 702, c 1 292 → 1 404, d 1 648 → 1 598 PV (bruit). Sur 10 tours de d : ≈ 24 s
  d'attente par tour (mineur-secondes), 8 regroupements complets, boss moyen 1 492 → 1 412.
- **Point fragile** : un mineur qui ne passe par aucun point d'attente (chemin qui arriverait au toit autrement) ne
  serait jamais attendu comme « là » ; aujourd'hui tout chemin passe par la porte du toit ou par le treuil.

### Lance en fer, stats Portée et Recul (Geoffrey, 25/10) — ✅ en ligne le 25/10 (règle C, lance équilibrée : voir la suite)
- **Quoi** : `STATS.reach` / `STATS.knockback` (0 de base, ajoutés à `COMBAT.reach` / `COMBAT.knock` par `reachOf` /
  `knockbackOf`, `src/sim/knock.js`) : coups du mineur en mine (`actions.js` attaque, `ai.js` fight / goFight / boss /
  canard) et en tour (`tower/session.js` `hitReach`, recul des mobs et du boss). Les mobs gardent `COMBAT.reach` pour
  tacler. Objet `STUFF.items['Lance en fer']` (epee, `stats` damage 10, attackSpeed −10, knockback 0,25, reach 0,25), recette
  10 Tainted iron (provisoire), BP 2 % dans `LOOT['Treasure T1']` (tier 1 de la recherche : 10 BP), skin `skins/spear_iron`,
  textures `spear_iron` (gen_textures.py), labels, unités, `shownStats`, aide du wiki. Premier malus du jeu : un malus
  n'empire plus avec l'amélioration (`pieceBonus`) et s'affiche « −10 % » (`statLines`).
- **Tests** : 171 ✅ (tower, combat, knock, stuff, amelioration, craft, research (T1 = 10 BP), loot, wiki (total BP 17 %),
  spells, mobs, skins, rune).
- **Duel** (`duel.mjs` du scratchpad : 1 mineur sans autre stuff, couloir plat, mob qui arrive, 2 côtés) — temps pour
  tuer / temps taclé / vols :
  bestiole (66 PV) épée 5,1 s / 4,5 s, lance 5,8 / 5,2 ; gobelin (115) épée 8,6 / 8,0 / 3 vols, lance 8,8 / 8,2 / 4 ;
  occultiste (150) épée 10,2 / 9,6, lance 17,0 / 10,8 ; méphite (81) épée 5,9 / 5,3, lance 6,7 / 6,1. Le mob tacle
  toujours (2/2), au bout de 0,7 s. « Épée + portée seule » = épée ; « épée + recul seul » ≈ lance (le recul ralentit).
- **Pourquoi** : déplacements case par case → deux voisins sont à 0 d'écart, une portée de 0,75 ne frappe jamais avant
  le contact ; le tacle tient jusqu'à la mort du mob (soupapes 5 s / 6 cases) et le vol du gobelin marche à distance :
  repousser ne libère rien, ça oblige seulement à se recaler.
- **Prototype testé (non gardé)** : « un coup qui repousse le mob hors de SA portée lui fait lâcher le tacle ». Duel :
  vols du gobelin lance 0 (épée 2), temps taclé −10 à −20 % ; vitesse pour tuer inchangée (occultiste toujours 17 s
  avec du recul). Sessions (3 mineurs stuff fer, 5 seeds) : écarts dans le bruit (mobs tués 92-98, temps taclé
  556-627 s, volés 124-143 par partie, épée et lance mélangées).
- **À trancher** : la règle du tacle ; la recette ; la rareté. **À vérifier** : pourquoi le recul double le temps contre
  l'occultiste.
- **Mouvement continu (25/10, même branche)** : `src/sim/mobs.js` `walk()` : sur sa ligne, un mob glisse de DT/stepOf blocs
  par tick (`kx`), change de case au-delà d'une demi-case, s'arrête au contact (écart 0) ; bloc devant : pas au-delà du
  centre ; échelles : recentré puis case par case (cd) ; volants inchangés (case par case). `src/sim/knock.js` `offX` :
  un mineur en plein pas horizontal est à `fx + (x − fx) × avancée` pour la portée (sa case ne change qu'à la fin du pas).
  Tours inchangées. Tests adaptés : mobs « figés » par `speed: 1e-9` (cd ne bloque plus la marche) dans combat et
  mobs ; trap (vitesse mesurée en blocs/s) ; combat réel (repoussé = décalé). **Deux tests déjà rouges sur main corrigés** :
  `skills.test.js` (pioche en fer +0,4 depuis le nerf du 25/10 : 1,48) et `mule.test.js` (or poids 3 : sac 15, oubli de
  ma part le 25/10). 252 tests liés ✅.
- **Sessions** (5 seeds, moyenne ; référence → mouvement continu) : à 3 sans skills coffre 4 105 → 4 100 pods, profondeur
  195 → 188, tacles 36 → 43, tués 78 → 83 ; arbres mixtes 4 419 → 4 407, 200 → 204, tacles 37 → 43 ; solo 1 641 → 1 589,
  tacles 26 → 35, volés 41 → 51. 0 bloquée partout.
- **Duel corrigé** (couloir incassable : avant, le mineur creusait sous le couloir et le duel mesurait autre chose) —
  temps taclé (s), épée / lance : A (branche) bestiole 4,5 / 4,9, gobelin 7,7 / 7,6 (3 vols chacun), occultiste 9,3 / 9,4,
  méphite 5,6 / 6,5. B (+ coup au début de l'attaque + arrêt net du pas quand le mob entre dans sa portée) : 3,8 / 4,0,
  7,0 / 6,7, 8,6 / 8,5, 4,7 / 5,2 ; la lance frappe en premier (écart 0,67), repousse à 1,06, le mob tacle 0,5 s après.
  C (B + recul qui casse le tacle) : 3,6 / 3,2, 6,8 / 5,9 (vols 3 / 2), 8,4 / 7,7, 4,3 / 4,8 ; temps pour tuer ≈ égal.
  ⚠️ En B et C, un méphite contre un mineur à mains nues n'est jamais tué (595 s, blocage du prototype à comprendre).
- **Règle C (25/10, même branche)** : `src/sim/actions.js` `landHit` (coup du mineur, exporté) : recul puis, si le mob tacle ce
  mineur et n'est plus à SA portée (`inReach(G,o,m)`), `o.grab = null` ; verrou `o.knockLock` posé à chaque recul effectif,
  levé dans `updateGrab` (`src/sim/mobs.js`) quand le mob est revenu à portée de sa cible. `src/sim/ai.js` `fight` : coup
  immédiat (`m.atkReady`, action `attack` `done:true` qui ne fait qu'attendre) ; barbare + mob de piège à plus d'une case :
  toujours `goFight` (corrige des allers-retours entre pas droit et chemin, seed 23757 arbres mixtes, défaut probable aussi
  sur main). `src/sim/session.js` : arrêt net (pas vers m.foe coupé dès qu'il est à portée) ; `stopAction` (`knock.js`) : un
  pas coupé garde son avancée (sinon oscillation, seed 7919 mimic). Volants : au contact, ils reviennent en glissant.
  Lance : damage 8, attackSpeed −10, knockback 0,5, reach 0,25 ; dans `UPGRADE.tiers[2]` (runes). Tests : `tests/lance.test.js`
  (3 : stats, tacle lâché depuis le contact, +300 % de vitesse d'attaque et mob lent : il retacle), combat réécrits (verrou ;
  tacle gardé si le mob s'éloigne seul, lâché sur un coup), research (pioche +0,4, déjà rouge sur main) ; 344 tests liés ✅.
- **Balayage** (`sweep.mjs`, 4 mobs × 2 côtés × 3 départs, vs épée ; temps pour tuer / temps taclé) : actuelle (recul
  +0,25) +2 % / +3 % ; recul +0,5 +3 % / −46 % ; **retenue (dégâts +8, vit. −10 %, recul +0,5)** +16 % / −36 %, 0 vol
  (épée 3) ; dégâts +7, vit. 0 +14 % / −44 %. Portée +0,25 ou +0,5 : sans effet mesurable. Stress : +100 % de vit. att.
  +37 % / −65 % ; +300 % +58 % / −2 % (le mob tacle toujours : verrou ✅).
- **Sessions** (référence → final) : 3 sans skills (5) coffre 4 105 → 4 155, tacles 36 → 32, volés 172 → 157 ; arbres
  mixtes (10) 4 419 → 4 553, tacles 37 → 28, volés 179 → 160 ; solo (5) 1 641 → 1 567, tacles 26 → 23, volés 41 → 56.
  0 bloquée sur 20. Stuff fer complet (5, 3 mineurs, lance vs épée) : tués 94 / 98, temps taclé 490 / 496 s (beaucoup de
  tacles courts : 264 / 90), temps à frapper 684 / 589 s, volés 102 / 126, coffre 3 182 / 3 263.
- **Points fragiles** : solo : coffre −4,5 %, vols +37 % (5 seeds, à revoir sur plus). Tours non touchées (combat
  ancien). En session la lance ne réduit pas le temps taclé (le duel, si) : à surveiller.

### Treasure 50 % en areas 0-2, recyclage BP T1 15-30 (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/config.js` : `AREAS[0..2].chestChance` 0,6 → 0,5 ; `RESEARCH.tiers[0].recycle` { 30, 60 } → { 15, 30 }.
  Wiki : chance lue dans la config (« 40 à 50 % »), recyclage lu dans la config.
- **Tests** : `tests/research.test.js`, `tests/game-service.test.js`, `tests/wiki.test.js` (valeurs attendues) ;
  research, game-service, wiki, treasure, world ✅ (95). `npm run test:anticheat` ✅ (89) : `tests/anticheat/research.test.js`
  avait 30-60 en dur, il lit maintenant `RESEARCH.tiers[0].recycle`.

### Tours : mouvement continu, coup immédiat, le recul casse le tacle (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/sim/tower/session.js` : `walkMob` (glisse de DT/MB.step blocs par tick sur la ligne du bas de l'étage,
  `mobFits`, arrêt au contact mesuré depuis `mobCell` ; remplace le saut de case tous les MB.step s et le recentrage) ;
  `hitMob` : recul seulement sans `o.knockLock`, verrou posé sur un recul effectif, tacle lâché si le mob n'est plus à SA
  portée ; verrou levé dans `stepMobs` quand le mob est revenu à portée de sa cible ; `strike` (coup immédiat, `m.atkReady`,
  attack `done`) pour le mob qui tacle et le mob proche ; arrêt net dans `tickTower` (pas horizontal coupé si un mob réveillé
  est à portée) ; interruption par un tacle → `stopAction` (le pas garde son avancée). Boss inchangé.
- **Tests** : `tests/tower.test.js` +2 (glisse et s'arrête au contact ; recul +0,5 : tacle lâché, retacle ≥ 2 fois en 15 s ;
  les deux échouent sans la modification) ✅ ; tower, knock, combat, view, lance ✅ (62).
- **Simulation** `npm run simulate:tower -- --count 20` (main → branche) : a) toit 18/20 à 9:30 → 20/20 à 8:46, PV boss
  restants 3 251 → 3 021 ; b) 7:31 → 7:05, 1 545 → 1 569 ; c) 7:29 → 7:05, 1 327 → 1 113 ; d) 7:31 → 7:05, 1 328 → 1 110 ;
  0 victoire partout (déjà 0 sur main) ; attentes « bloqué » 0 ; projections un peu plus nombreuses (on reste plus
  longtemps sur le toit).

### Annonces Discord R7 : trésor de tour et identification (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `server/social/discord.js` (nouveau) : `treasureMessage(pseudo, item)` (objet `ITEMS[item].treasure` avec
  `chest.q >= ANNOUNCE.minQuality`, sinon null), `identifyMessage(pseudo, piece)`, `escapeMarkdown`, et
  `createDiscordAnnouncer({ url, fetch, log, timeoutMs })` : POST JSON `{ content, allowed_mentions:{ parse:[] } }`,
  `AbortSignal.timeout`, ne lève jamais (erreur → `console.error`). `src/config.js` : `ANNOUNCE = { minQuality:7, emoji:'🚨',
  timeoutMs:5000 }`. `server/config.js` : `SERVER.discordWebhook` = `DIM_DISCORD_WEBHOOK` (vide = aucune annonce).
  `server/main.js` : passe `announce` à `createGameService`. `server/game/service.js` : option `announce` (défaut : rien),
  helper `shout` (tâche de fond, une exception de `announce` est avalée) ; `settleWith` : après un `creditSession` réussi,
  une annonce par objet du sac (pseudo = `rec.players[].name`, donc `displayName` au lancement) ; `upgrade` : après une
  identification non rejouée (`!r.repeated`), `displayName(me)` + `r.piece`. `adminGive` n'annonce rien.
- **Tests** : `tests/discord.test.js` (11 : messages, échappement, envoi, pas de webhook, panne / 429, tour R7 à deux
  + fin rejouée par `recover` = pas de doublon, tour R6 = rien, `announce` qui lève = tour quand même versée,
  identification R7 + double clic = une annonce, R6 et don admin R7 = rien) ✅ ; avec game-service, anticheat/upgrade,
  admin, boot-check, amelioration, rune ✅ (109).
- **Vérifié** : webhook sur le VPS, message de test (curl) reçu dans #général ✅. Pas encore vu : une vraie annonce R7 en jeu. Les emoji sont envoyés en Unicode (un
  `:rotating_light:` envoyé par webhook pourrait rester en texte).
- **Points fragiles** : le webhook limite à ~30 messages/min (largement assez pour du R7). Si on baisse le seuil (R5),
  le salon peut devenir bruyant.

### Tour : étages de blocs en front, mob sonné après un recul, mesures ?perf (Geoffrey, 25/10 soir) — ✅ en ligne le 25/10
- **Contexte** : le dossier local était resté sur `cd6f90a` ; ensuite `tour-regroupe`, `lance-en-fer`,
  `tour-combat-continu` (marche continue `walkMob`, `knockLock`, `stopAction`) et `fdebd2d` (treuil de tour) ont
  changé la tour en ligne : d'où des écarts entre le local et le live.
- **Étages de blocs** (`src/sim/tower/session.js`, `blockFront`) : les candidats sont filtrés aux colonnes pas encore
  vidées les plus proches du centre de la porte d'entrée (`gateCols(G, k − 1)`), `TOWER.blockFront` (1) × nombre de
  mineurs. Avant (seed 3, 3 mineurs) : blocs du haut au-dessus de l'entrée minés à 100-104 s sur 104 (coût d'échelle :
  toujours repoussés) ; après : front régulier, 105 s ; solo 277 → 276 s, colonne par colonne.
- **Recul des mobs** : il marchait (+0,25) mais `walkMob` le ramenait au contact en ≈ 0,2 s. `o.stagger = G.t +
  MB.knockStun` (0,5 s) dans `hitMob` quand le push a bougé le mob ; `stepMobs` ne fait pas marcher un mob sonné.
- **Mesures** : `src/ui/perf.js` (`createPerf`, `perfText`, fenêtre 2 s) ; `src/main.js` (`?perf` : `perf.view` autour
  de `gameApi.view`, `perf.frame` dans `frame`, texte toutes les 120 ms) ; `.perfBox` (cachées) dans `#run` et `#twRun`.
- **Vérifié, pas un bug** : retour du boss au centre (fonctionne dès que personne n'est sur le toit et qu'il est
  engagé) ; saut à 74 % (se déclenche) ; treuil : textures présentes, servies en ligne (mêmes fichiers que `main`,
  `Cache-Control: no-store`) et dessinées (rendu sans navigateur : corde sur toute la hauteur, poulie, seau).
- **Tests** : `tests/tower-boss.test.js` (+2 : front depuis l'entrée en solo et à 3, mob sonné), `tests/perf.test.js`
  (nouveau, 3) ; tower, tower-boss, perf, boot-check, controls ✅. Pas de simulation (demande de Geoffrey).

### Tour : recul des mobs ×2, temps sonné retiré (Geoffrey, 25/10 soir) — ✅ en ligne le 25/10 (tests relancés ensuite : ✅, voir l'entrée suivante)
- `TOWER.mobs.knockRes: -100` (remplace `knockStun`) ; `hitMob` pousse de `knockbackOf(m) × (1 − MB.knockRes/100)`
  (la résistance n'est pas posée sur le mob : `knockOf` borne la résistance à 0–100) ; `o.stagger` et son test
  (`tests/tower-boss.test.js`, « mob sonné ») retirés. ⚠️ Tests non relancés à la demande de Geoffrey : à relancer
  (tower, tower-boss) à la prochaine modification de la tour.

### Tour : plus d'étourdissement à l'arrivée d'une chute, projection 4 cases (Geoffrey, 25/10 soir) — ✅ en ligne le 25/10
- `land()` (`src/sim/tower/session.js`) : plus d'action `stun` après une chute de `CFG.stunFall` cases ou plus (le
  message du journal reste) ; `fell`, chutes comptées et treuil du logisticien inchangés. `TOWER.boss.knock` 5 → 4.
- Tests adaptés (`tests/tower.test.js`) : l'arrivée en bas se repère à `!m.knocked` au lieu de l'étourdissement
  (treuil, regroupement), le treuil s'installe en 10 s sans les 5 s d'étourdissement, projection 4. tower,
  tower-boss ✅ (37) : ils couvrent aussi l'entrée précédente, mise en ligne sans tests.

### Armure en fer + 20 peaux de gobelin (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/recipes.js` : casque / plastron / jambes en fer + `'Peau de gobelin': 20` ; bottes 5 → 20. GAME_DESIGN
  (tableau du stuff en fer). Wiki : recettes générées depuis `RECIPES` (date du bandeau déjà au 25/10).
- **Tests** : `tests/blueprint.test.js` (recettes ; et pioche en fer 0,4 / 1,4 : **déjà rouge sur main** depuis le nerf du
  25/10), `tests/recycle.test.js` (bottes : 12 peaux) ; admin, anneaux, aura, discord, give-item, research, rune, craft,
  wiki, steel-gear ✅ (105) ; `npm run test:anticheat` ✅ (89).

### Amélioration : paliers 5 / 10 / 15 % (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `UPGRADE.levels[].pct` 3 / 5 / 7 → 5 / 10 / 15 (`src/config.js`) ; GAME_DESIGN (tableau des niveaux) ; wiki :
  tableau généré (`upgradeRows`). Le % est lu à l'affichage et en session (`plusMult`) : les pièces déjà améliorées
  suivent sans migration ; un malus (Lance) n'est pas multiplié.
- **Tests** : `tests/amelioration.test.js` (valeurs recalculées par le code : pioche +3 0,23, épée +3 15,4, plastron
  chitine +1 32, lignes +3 0,8 et 0,6, minage % 1,1) ; `tests/rune.test.js` lit le % dans la config (il passait par
  hasard d'arrondi avec 1,07 en dur) ; rune, stuff, lance, wiki, aura, anneaux ✅ (82).

### Inventaire : « Ouvrir tout » (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/meta/loot.js` : `openOne` (un exemplaire, sans mémoire) ; `openTreasure` l'utilise ; `openAll(inv, item, opId,
  rng)` ouvre min(nombre, `TREASURE.openAllMax` = 100) exemplaires, butin additionné, UNE entrée `inv.opened` { id, item,
  loot, count } (relue par `deserialize`). Serveur : `POST /api/game/open` avec `all:true` → `openAll`, réponse avec `count`.
  Navigateur : bouton « Ouvrir tout (N) » si N ≥ 2 (`src/ui/inventory.js`), `gameApi.open(item, opId, all)`, `showLoot(…, count)`
  (« 6 × Treasure T1 ouverts ! »).
- **Tests** : `tests/loot.test.js` +2 (7 ouverts, chacun son tirage, renvoi = même butin, relu ; plafond 100 ; objet qui
  ne s'ouvre pas) ; `tests/anticheat/open.test.js` +1 (rafale de 5 avec le même opId : une seule ouverture ; plus rien :
  refusé) ✅ ; anticheat ✅ (90). ⚠️ Bouton pas vu dans un vrai navigateur.

### Runes : banque + 5 stats, Découverte équiprobable, Double attaque (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/config.js` : `UPGRADE.pool` + tenacity, knockRes, reach, knockback, doubleAttack ; `UPGRADE.prices` (10, 5,
  1000, 1000, 20 : double attaque +5 % pour 100 x, Geoffrey ; d'abord 5) et `steps` (0,1 / 0,1 / 0,01 / 0,01 / 0,1) ; `UPGRADE.discover.chance` retirée ; `STATS.doubleAttack = 0`,
  label, unité, `shownStats`. `src/meta/piece.js` `rollLines` : en R6/R7, `discoverMax` est une entrée de plus du tirage
  (une au plus). Double attaque : `landHit` (`src/sim/actions.js`, second coup avec `gearChance`, son propre critique, un seul
  recul, `m.stats.doubleHits`) ; tours : `strikeDmg` (`hitMob` et `hitBoss`). Wiki : aide de la stat. La validation des
  lignes (`sanitizePiece`) lit la banque : les nouvelles stats sont acceptées à la relecture.
- **Tests** : `tests/rune-pool.test.js` (3 : banque complète avec prix / pas / nom ; Découverte sur 20 000 runes R7 ≈ une
  autre stat (écart < 12 %), une au plus, jamais en R5 ; double attaque 0 % / 100 % : 1 / 2 coups, un seul recul) ✅ ;
  rune, amelioration, stuff, wiki, lance, combat, tower, mobs, skills, aura, anneaux, give-item, admin ✅ (185).
- **⚠️** Tirage des runes changé (banque plus grande) : même seed ≠ même rune qu'avant (pas de conséquence : hasard serveur).

### Glyphes, étape 1 (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Spec / plan** : `docs/superpowers/specs/2026-10-25-glyphes-design.md`, `docs/superpowers/plans/2026-10-25-glyphes.md`.
- **Quoi** : `GLYPHS` + 9 objets `cat:'glyph'` (épiques, texture `glyph`). `src/meta/glyphs.js` : `glyphOf`, `nodeOfGlyph`,
  `glyphOp` (pose / retrait, idempotent via `st.ops`), `isActive`, `activeGlyphs`, `sessionSkills`, `withGlyphStats`,
  `glyphInfo`. `src/meta/skills.js` : `st.glyphs` relu par `sanitizeSkills` (nœud + nom exact, rang NON vérifié),
  `skillEffects` ajoute `glyph_<nœud>: 1` si actif. Serveur : route `skills` actions `glyph_pose` / `glyph_remove`
  (verrous inv + skills, refus en session, `store.putInventoryAndSkills`) ; `publicSkills.glyphs = { nœud: objet }` ;
  lancement mine / tour / MI : `sessionSkills` (glyphes actifs figés). Stats : `withGlyphStats` en dernier
  (game.js, instant.js, onglet Stuff). Partie : Second souffle et Ruée (`actions.js` `oreSkills`, `rushTime`), Navette
  (`session.js`, oxygène), Échelle de 2 (`ladderTime` : actions, instant, tower, `baseLadderT`), Pillage (`killMob`,
  `m.pillage`, `hitDamage`), Braum (`session.js` `braumGlyph`, `m.braumIn`). UI : case `glyphSlot` dans `skills.js`,
  fiche inventaire, section wiki `#glyphes`.
- **Tests** : `tests/glyphs.test.js` (25), `tests/anticheat/glyphs.test.js`, `tests/game-service.test.js` (+1),
  `tests/wiki.test.js` (+1), `tests/rarity.test.js` (glyphes épiques). Simulation `--miners 3 --count 5` : 0 bloquée,
  **identique** avec et sans les effets (sans glyphe posé, rien ne change). Rendu vérifié dans Edge sans fenêtre :
  onglet Skills (posé, à poser, inactif, sans case) et tableau du wiki (le premier rendu affichait les cellules
  séparées par des virgules : corrigé avec `tr()`).
- **Relecture finale** (auto-relecture, pas de relecteur indépendant) : Glyphe Mule appliqué en mine instantanée et dans
  les tours → corrigé (`withGlyphStats(carac, effects, mine)` : `false` en MI et en tour) ; test « Glyphe Mule : seulement
  dans la mine classique » rouge puis vert ; 313/313 + anti-triche 91/91.
- **Points fragiles** : Second souffle tire `G.rng` (seulement si glyphe et torches < max) : décale le hasard des
  parties qui l'ont. Braum compte le seuil du donjon comme « dedans » (comme la révélation du donjon).

### Glyphe Treuil, étape 2 (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `GLYPHS.items.winch`, `liftSpeed` (3), `liftEvery` (2), textures `lift_rail`, `lift_top`, `lift_cabin` (cabine
  vide au milieu : on voit le mineur). `src/sim/world.js` `tryUnlock` : porteur du glyphe prioritaire, `winchJob.lift`,
  `return` sans chantier aux déblocages k impair ; `ai.js` `decideWinch` : `G.winch.lift = true` (une fois posé, reste) ;
  `mineur.js` `winchMult` × `liftSpeed` si `G.winch.lift` (tous les calculs du seau : déplacement, chemins, Mule).
  Tours : `towerWinchT` = même `winchMult`, `winchSetup` pose `lift` si `glyph_winch`. Rendu `canvas.js` / `tower.js`.
  `scripts/simulate.js` : option `--glyphs`.
- **Tests** : `tests/glyphs.test.js` (+4 : priorité et rythme, sans glyphe inchangé, chantier + vitesse Escalateur
  compris, tours) ; glyphs, tower, winch, mule, focus, duck, treasure ✅. Simulation `--miners 3 --skills mixed --count 5` :
  sans glyphe areas 3,2 / prof 201 / coffre 4 510 ; `--glyphs winch` areas 4,0 / prof 226 / coffre 4 926 ; 0 bloquée.
  Rendu des textures vérifié dans Edge (rails, machinerie, cabine, à côté du treuil).
- **Point fragile** : `G.winch.lift` reste vrai une fois posé (un treuil prolongé ensuite par un logisticien sans glyphe,
  s'il quitte, resterait un ascenseur) ; sans glyphe, `G.winch` n'a pas de clé `lift` (tests du treuil inchangés).

### Case Torche, Lampe à incandescence (Geoffrey, 25/10 soir) — ✅ en ligne le 25/10
- **Config** : `STUFF.slots` + `torche` ; `STUFF.items['Lampe à incandescence']` (`stats.torches` 10, `set` torchRadius 8 et
  torchTime 0,5 : l'amélioration agit sur `set` comme sur les autres pièces) ; `STATS.torchTime` (1 s) remplace
  `CFG.torchTime` ; libellés, unités, `shownStats` (+ torchRadius, torchTime) ; rareté rare ; `TEXTURES` +
  `lamp_incandescent` (`scripts/gen_textures.py`, seule texture nouvelle, les autres inchangées). Recette
  `src/recipes.js`, `unlock: null`.
- **Rayon par torche** : `G.torches[i].r` = `m.carac.torchRadius` à la pose (`src/sim/actions.js`, tour
  `src/sim/tower/session.js`) ; `src/sim/light.js` et `towerLight` (`src/sim/tower/world.js`) lisent `T.r ??
  STATS.torchRadius` (anciennes parties). Vue de la tour : `torchR` à côté de `torches` (`src/shared/tower-view.js`) ;
  la mine envoie les objets torche tels quels. Temps de pose : `m.carac.torchTime` (IA mine x2, tour).
- **Interface** : grille du Stuff sur 7 rangées (`.stuffGrid`, `.stuffHero` 1/8) ; wiki : textes des 2 stats.
- **Tests** : `tests/lamp.test.js` (nouveau, 5 : case, recette sans BP, stats, mine 0,5 s et rayon 8 vs 5, tour + vue),
  `tests/stuff.test.js` (13 cases), `tests/rarity.test.js` (rare) ; lamp, wiki, stuff, carac, craft, light, tower,
  tower-boss, view, skins, sets, rarity, amelioration, boot-check, miner, session, game-service, inventory,
  give-item ✅ (210) ; `npm run test:anticheat` ✅ (90) ; simulation 5 sessions solo : coffre 1 598, 0 blocage.
- ⚠️ Pas vu dans un vrai navigateur (13e case dans la grille, icône de la lampe).

### K hole : mise en place (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/sim/khole.js` (nouveau). Principe : **échange de carte** dans la même partie. `enterKhole` met de côté
  dans `G.khole.world` les champs du monde (`WORLD` : tiles, ladder, seen, areas, unlockedAreas, winch, treasures,
  dungeons, traps, veil, mobs, torches, light, mimicCells, mule, ducks, duckBase, spawnTimer, spawnTurn, combat) et pour
  chaque mineur `SPOT` (position, action, cibles, chantiers… : liste tirée de tous les `m.x = …` de src/sim), remet ces
  champs à leur valeur de `createMiner`, pose la dimension (`dimension(seed, n)` : surface + coffre + `fillComp` de
  `KHOLE.comp`, `spawnTimer: Infinity`, pas de mobs) ; `exitKhole` remet tout, case du portail → 0, `updateLight`.
  `G.realm` change à chaque passage. `inMine(G, fn)` : exécute fn sur la mine pendant un k hole (Mule d'un partant).
- `src/sim/world.js` : `fillComp` extrait de `genArea` (même ordre de tirage : cartes inchangées) ; `placeKhole` en
  dernier (tirage `hash(seed ^ KHOLE.salt, k+1)`, terrain non résidu, hors boîtes donjon/piège + pourtour) ;
  `tryUnlock` refusé pendant un k hole. `src/sim/session.js` : `updateKhole` à chaque tick (après `updateDungeons`),
  `exitKhole` au début d'`endSession`, `leaveSession` → `inMine(muleOnLeave)`. `actions.js`, `spells.js` : maxDepth pas
  compté dans la dimension. `src/shared/view.js` : `prev.realm` différent → historique vidé, carte entière ; `khole:
  { until }` dans l'envoi. `src/render/canvas.js` : ciel violet, voile, compte à rebours. Config : bloc 20 `KHOLE_BLOCK`,
  `KHOLE`, texture `khole` (gen_textures.py, `import math`), `DEV_TUNABLES` + `KHOLE.chance` (TARGETS de
  src/shared/game.js). `scripts/simulate.js --khole <chance>` (k holes pris, blocs minés, coût d'un tick).
- **Tests** : `tests/khole.test.js` (9 : placement, tirage à part, aspiration, retour à la place exacte + mine figée,
  dimension sans déblocage ni mobs ni profondeur, fin et départ pendant le k hole, déterminisme, carte entière à
  l'aller et au retour) ✅ ; session, live, game-replay, dungeon, blocks, fall, focus, mule, duck, mobs, light, path,
  miner, diagnostics, dev-spec, world, view, trap, treasure, winch, team, spells, wiki, shiny, instant-mine, tower,
  lobby, game-service ✅ (391).
- **Simulation** `--miners 3 --count 5` : `--khole 1` : 10 pris (sur 20 enfouis : les autres jamais vus), 0 bloquée,
  135 à 318 blocs minés dans la dimension par session, tick 0,197 ms (dimension) / 0,560 ms (mine) ; `--khole 0` :
  coffre 4 140 → 4 330 pods avec k holes, étourdissements 9,6 → 16.
- **Pas vérifié** : en vrai dans le navigateur (transition, caméra, compte à rebours) ; reprise après redémarrage du
  serveur en plein k hole (déterministe, donc devrait se rejouer à l'identique ; pas de test serveur).
- **Points fragiles** : un nouveau champ de position ajouté au mineur doit aller dans `SPOT`, un nouveau champ du monde
  dans `WORLD`, sinon il fuit entre mine et dimension. Une Mule posée dans la dimension est perdue au retour (sac de la
  dimension jeté). Une action en cours au départ (pas, coup) reprend telle quelle au retour.

### K hole : la vraie dimension (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** (remplace la dimension provisoire de l'entrée précédente) : `buildDimension(G, n, k)` dans `src/sim/khole.js` :
  carte de `areaTop(k) + KHOLE.h` lignes, tout en barrière sauf KHOLE.w × KHOLE.h dans le coin gauche (lignes de l'area
  k : areaOf donne k, donc PV des mobs, table des pièges, tier des treasures de l'area) ; `areas` = k+1 areas vides + la
  dimension en k, `unlockedAreas` = k+1 ; arrivée = spawnCols colonnes vides (vues), mineurs en bas à gauche ; zone :
  `fillComp(r, comp, w, h)` (world.js : `fillComp` et `placeClusters` acceptent w, h ; valeurs par défaut = area, cartes
  inchangées), puis `layout` (donjons puis pièges, toutes les places essayées dans un ordre tiré, jusqu'à
  KHOLE.attempts dispositions : 200 seeds × 6 areas → toujours complète, 78 ms), `carve` / `carveTrap` (mobs :
  `trapMobs(k, r)`, nouvel export de trap.js avec `TRAP_BOX`), puis treasurePct % de treasures (G.treasures, item
  `treasureItem(k)`). Retour : `exitKhole` met tout le groupe à la surface (SPOT remis à zéro, x autour de SPAWN_X), lâche
  les tacles des mobs de la mine. Le portail ne garde plus les places (plus de `spots`).
- Règles de la dimension : `session.js` stepMiner (pas d'oxygène consommé si `G.khole`), `ai.js` decideWork (pas de
  `planReturn`, aucune raison de remonter : oxygène, pods, fin de session, torches), `focus.js` focusArea (null).
- **Tests** : `tests/khole.test.js` (10 : + contenu de la dimension (barrière autour, arrivée vide, 1 donjon, 5 pièges,
  PV de l'area, treasures du tier, % parmi les blocs restants à ±5), règles (oxygène, pods au-delà de la limite sans
  remontée, pas d'autres mobs), retour à la surface avec l'inventaire, mine figée à 0 case près) ✅ ; session, live,
  game-replay, dungeon, trap, world, view, focus, mule, fall, mobs, team, spells, treasure, lobby, miner, diagnostics,
  winch ✅ (249).
- **Simulation** `--miners 3 --count 5 --khole 1` : 9 pris, 0 bloquée, 140 à 269 blocs minés dans la dimension, coffre
  4 151 pods (4 140 sans k hole), treasures ouverts 2,8 (0,2 sans), tick 0,048 ms (dimension) / 0,552 ms (mine). Dans la
  dimension, les mineurs suivent des filons et combattent les mobs des pièges ; sans barbare, personne n'entre au donjon.
- **Points fragiles** : fin de session pendant un k hole = ce qu'ils portent est perdu (règle normale, à confirmer par
  l'équipe). Un mineur peut finir coincé (tout miné autour) : il attend, sans conséquence (retour au bout du compteur).

### K hole : fin de session (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `KHOLE.endMargin` (30 s) ; `enterKhole` : `until = min(t + duration, SESSION_LEN - endMargin)` ;
  `updateKhole` : plus d'ouverture à partir de `SESSION_LEN - endMargin`. Remplace le point fragile de l'entrée précédente
  (« fin de session pendant un k hole = ce qu'ils portent est perdu »).
- **Tests** : `tests/khole.test.js` +1 (k hole ouvert 2 min avant la fin : retour à 3 570 s, `lostBags` vide, butin au
  coffre ; découvert à 25 s de la fin : ne s'ouvre pas) ✅ (11). Sonde 5 seeds × 3 mineurs : 49 à 58 objets portés au
  retour, rien de perdu.
- **Correctif (25/10)** : l'option « Chance de k hole par area » n'apparaissait pas : `src/ui/lobby.js` avait sa propre
  liste `TARGETS = { STATS, CFG }` (sans KHOLE) → erreur en construisant le panneau dev. Liste unique `DEV_TARGETS` dans
  `src/config.js`, lue par le lobby et `src/shared/game.js`. Test : chaque ligne de `DEV_TUNABLES` pointe vers un nombre
  de `DEV_TARGETS` (`tests/khole.test.js`, 12) ✅.

### K hole : plusieurs cartes (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `KHOLE.maps` (config) : filons (l'ancienne dimension), arene, tresor, vagues ; chaque carte : w, h,
  duration, spawn ('left' | 'middle'), weight, et son contenu (comp/traps/dungeons/treasurePct, minotaurs, treasures,
  wave) ; `end` : 'bosses' | 'treasures'. `KHOLE.map` (réglage dev, `DEV_TUNABLES`) : 0 = tirage, 1-4 = imposée.
  `src/sim/khole.js` : `pickMap(seed, n)` (tirage à part, selon weight), `buildDimension(G, n, k, map)` → cadre commun
  puis `buildVeins` (filons) ou `buildRoom` (salle vide, toute vue ; minotaures `addMob` aux bouts, à découvert :
  `dungeon` absent, logique de mob normale, `hunt` = premier mineur ; treasures tier `TREASURE.tiers` au hasard) ; renvoie
  la case d'arrivée par rang. `updateKhole` : `finished` (fin anticipée), `updateWaves` (vague suivante quand aucun mob
  vivant ; types `trapMobs(k, G.rng, wave)`, hasard live G.rng). `G.khole.map` ; envoi `khole.label` ; rendu : nom de la
  carte dans le compte à rebours. `src/sim/actions.js` killMob : un minotaure à découvert (`type === DUNGEON.boss.type`)
  laisse le butin du donjon. `trap.js` : `trapMobs(k, r, n)`.
- **Tests** : `tests/khole.test.js` (17 : les anciens sur la carte filons imposée ; + tirage/poids/mode dev, arène
  (contenu, fin quand les minotaures meurent, cristaux), salle au trésor (contenu, tier au hasard, fin à l'ouverture),
  vagues (5 mobs de l'area sans mimic, vague suivante, fin au compteur)) ✅ ; session, live, dungeon, trap, world, view,
  mobs, combat, treasure, lobby, spells, team ✅ (154).
- **Sonde** (3 seeds × chaque carte, 3 mineurs, area 0) : filons 300 s, 133-154 blocs ; arène 117 s (2 minotaures
  tués, juste sous les 120 s : à 1 ou 2 mineurs, ils ne finiront sans doute pas) ; trésor 3 s ; vagues 180 s, 11-13
  vagues. Simulation `--miners 3 --count 5 --khole 1` (carte au hasard) : 10 pris, 0 bloquée, tick dimension 0,032 ms.
- **Points fragiles** : dans l'arène et les vagues, un mineur réglé sur « Ignorer » / « Fuir » ne se bat que s'il est
  taclé. Salle au trésor : 3 s pour 2 treasures possiblement T3, quelle que soit l'area.

### K hole : mise en ligne (Geoffrey, 25/10) — ✅ en ligne le 25/10
- `KHOLE.chance` 0,01 → 0,02. Section « Le k hole » du wiki (textes à la main, sans tableau généré).
- Fusion de main (Glyphes, Glyphe Treuil, Lampe) : conflits résolus (oxygène : k hole + Glyphe Navette ; imports ;
  simulate --khole et --glyphs). `m.braumIn` (Glyphe Braum, position) ajouté à `SPOT` ; `m.pillage` gardé (bonus gagné).
- **Vérifié après fusion** : khole + 20 sujets voisins ✅ (303), tests ajoutés par main ✅ (101), `npm run test:anticheat`
  ✅ (91), simulation `--miners 3 --count 5` (0 bloquée, chiffres identiques : aucun k hole sur ces seeds) et
  `--khole 1` (10 pris, 0 bloquée, tick dimension 0,030 ms).

### Admin : k hole imposé dans une session en cours (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `forceKhole(G, map)` (`src/sim/khole.js`) : pousse dans `G.kholes` un k hole à la case du premier mineur
  (`opensAt = t + warn`, `map` imposée 1-N ou 0), même log ; refusé si fini, déjà dans un k hole ou un k hole en attente,
  sans mineur, ou à moins de endMargin + warn de la fin. `enterKhole` : `h.map` impose la carte. Événement rejoué
  `record.kholes` [{ tick, map, at }] : `applyDueKholes` (`src/shared/game.js`, `G.kholeDone`, dans `applyDueEvents`) ;
  `live-game.js` `khole(map)` → `{ tick, ok }` ; `live-worker.js`, `live.js` (runner + inline). `service.adminKhole`
  (mine classique, session en cours, carte entière 0-N ; refus `khole_refused` → rien n'est enregistré). Route
  `POST /api/admin/khole` { name, map } (mêmes garde-fous que /give) ; `scripts/force-khole.js`. `tests/helpers.js`
  fakeLive : `khole`.
- **Tests** : `tests/admin-khole.test.js` (5 : ouverture et carte imposée, refus si déjà dedans, rejeu identique avec
  l'événement enregistré, refus près de la fin, carte invalide → tirée, service (enregistrement, refus sans session / mi /
  tour / carte invalide), route fermée sans clé, pseudo inconnu, pas de session) ✅ ; admin, live, game-service,
  game-replay, khole, session, game-http, instant-server, give-item ✅ (117) ; `npm run test:anticheat` ✅ (91).
- **Point fragile** : à la case du mineur visé, le k hole « disparaît » au retour (case mise à vide) : c'est sa propre
  case (déjà vide), sans effet.

### Drop des glyphes (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `GLYPHS.drop` ({ arbre: { event, chance } }), `GLYPHS.dropSalt`. `src/meta/glyphs.js` : `ownedGlyphs(st, inv)`,
  `glyphsOfTree(tree)`. Serveur (lancement mine / tour) : `record.skills[compte].owned = ownedGlyphs(...)`. `game.js` :
  `spec.glyphsOwned` (revérifié : noms de glyphes). `mineur.js` : `glyphsOwned`, `glyphFound`. `session.js` :
  `G.glyphRng` (hasard à part) ; `endSession` ajoute `glyphFound` à la part du mineur présent (`withFound`), pas au coffre.
  `actions.js` `glyphDrop(G,m,event)` : `breakBlock` ('block'), pose d'échelle ('ladder'), `killMob` ('kill') ; rien tiré
  sans spécialisation ni glyphe à trouver. Crédit : `creditSession` habituel (idempotent). Wiki : source générée.
  `scripts/simulate.js` : « glyphes trouvés » au résumé.
- **Tests** : `tests/glyph-drop.test.js` (7), `tests/game-service.test.js` (+1, owned figé ; attente du test des skills
  avec `owned`), `tests/wiki.test.js` (+1). Simulation `--miners 3 --count 5` **identique** avec et sans le drop ;
  `--skills mixed --count 5` : 0 glyphe (attendu ≈ 0,9 sur 5 sessions). Anti-triche 91/91.
- **Point fragile** : la tour et la mine instantanée ne tirent jamais (leurs simulations n'appellent pas `glyphDrop`).
### Correctif : arène du k hole, mineurs qui ne tapent pas (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Symptôme** (en ligne, capture) : arène, un minotaure tient un joueur au bout gauche ; deux joueurs au milieu ne
  font rien. **Cause** : `nearestThreat` (`src/sim/ai.js`) n'engage qu'un mob à moins de `lightR` (2,2 à 5,4 cases dans le
  noir) ; rien d'autre à faire dans la salle → attente. Reproduit (sonde : mineur à 7 cases, vision 5,4 → `wait`).
- **Premier essai** (seeAll seul : toute distance) : régression, 1 minotaure tué au lieu de 2 : les mineurs foncent au
  combat sans poser de torche → coups ralentis dans le noir (`CFG.darkSlow`), vision 2,2.
- **Correctif** : `nearestThreat` : un mob vu d'abord ; sinon, si `G.khole.map.seeAll`, le plus proche de la salle (le
  premier à égalité : tout le groupe tape le même). `seeAll` sur arene et vagues. `torchEvery: 5` sur arene, tresor,
  vagues : torches posées par `buildRoom` (rayon STATS.torchRadius, ligne du milieu) + `updateLight`.
- **Tests** : `tests/khole.test.js` +3 (mineur loin qui vient aider : échouait avant ; « Ignorer » respecté ; sol des
  salles éclairé) ✅ (20) ; combat, mobs, session, team, admin-khole, trap, dungeon, light, live ✅ (95). Sonde : arène
  108 s / 2 tués (avant 117 s), vagues 66 tués ; simulation `--khole 1` : 10 pris, 0 bloquée.

### Recherche : un tier demande tous les tiers inférieurs (Geoffrey, 25/10) — ✅ en ligne le 25/10
- **Quoi** : `src/meta/research.js` `tierUnlocked(inv, t)` = toutes les recettes des tiers < t apprises (avant : tier
  t - 1 seulement) ; `tiersBlocking(inv, t)` (nouveau) : tiers inférieurs incomplets et recettes manquantes. Onglet
  (`src/ui/research.js`) : le message 🔒 liste chaque tier incomplet. Serveur : message `tier_locked` (« des tiers
  inférieurs »). Le serveur appelle `research()` qui vérifie `tierUnlocked` : rien d'autre à changer.
- **Tests** : `tests/research.test.js` +1 (tout le T2 appris, une recette du T1 manque : T3 fermé, rien payé ; échouait
  avant) ✅. `tests/tier2.test.js` : 2 tests en retard sur main (T1 à 10 recettes depuis la Lance en fer, recyclage T1
  15-30) remis à jour (ils échouaient déjà sur main). research, tier2, anticheat/research, game-service, wiki, craft,
  blueprint ✅ (109) ; `npm run test:anticheat` ✅ (91).

### Glyphes : 3 % par glyphe et par session (Geoffrey) — branche `geoffrey/glyphes-1pct`, ✅ en ligne le 26/10
- **Quoi** : `GLYPHS.drop[*].chance` = chance PAR glyphe manquant et par événement ; `glyphDrop` (`src/sim/actions.js`)
  tire `chance × glyphes restants` puis un glyphe au hasard parmi les restants (un seul tirage de glyphRng pour le
  drop, comme avant). Valeurs = 1 − 0,97^(1/E) (3 % ; d'abord 1 − 0,99^(1/E), 1 %), E mesuré à 3 mineurs, arbre complet, 5 seeds : mineur 795 blocs,
  logisticien 91 échelles, barbare 30 mobs → 0,0000383 / 0,000335 / 0,00101 (1 % : 0,0000126 / 0,00011 / 0,000335). Wiki : `tiny()` (3 chiffres
  significatifs) dans `sourcesOf` ; texte de `wiki.html` et bandeau au 26/10.
- **Tests** : glyph-drop (valeurs, ≈ 3 % par session, chance × manquants), wiki ✅. Pas de nouvelle simulation (demande de Geoffrey : même E).
- **Points fragiles** : E dépend du stuff et des skills (plus de blocs = plus de chances) ; en solo, ≈ 1030 blocs /
  107 échelles / 52 mobs → ≈ 4 % / 3,5 % / 5 % par glyphe.

### Glyphes : 3 % pour UN glyphe par session (Geoffrey) — branche `geoffrey/glyphes-3pct`, ✅ en ligne le 26/10
- **Quoi** : `glyphDrop` revient à une seule chance `d.chance` pour tous les glyphes manquants (plus de × glyphes
  restants) ; valeurs inchangées (1 − 0,97^(1/E)) : ≈ 3 % d'en trouver un par session à 3. L'entrée précédente
  (« 3 % par glyphe ») est remplacée : malentendu, ≈ 9 à 11 % par session.
- **Tests** : glyph-drop (valeurs, chance unique quel que soit le nombre de manquants), wiki ✅.

### Social : sous-onglets Amis / Online (Geoffrey) — branche `geoffrey/social-online`, ✅ en ligne le 26/10
- **Quoi** : `social.online(me)` (`server/social/service.js`) parcourt la Map `seen` (signes de vie), oublie au passage
  les entrées de plus de `onlineFor`, renvoie `{ count, players }` (statut via `statusOf`, `me`, `friend`), tri : pas
  en session d'abord puis session, par pseudo ; bornée à `SOCIAL_SERVER.onlineListMax` (200). Route
  `GET /api/social/online` (appeler la route est aussi un signe de vie). Navigateur (`src/ui/social.js`) : sous-onglets
  `#socialTabs`, liste demandée seulement quand le sous-onglet Online est à l'écran (vérifié chaque seconde, rechargé
  toutes les `SOCIAL.onlinePoll` = 5 s) ; le signe de vie habituel (`GET /api/social`, 4 s) n'est pas alourdi.
  « Ajouter » = `h.request(id)` (le serveur accepte l'ID de compte).
- **Tests** : `tests/social.test.js` +2 (liste, ordre, hors ligne absents, borne + compteur) et route HTTP (200, 401)
  ✅ 17/17. Vérifié dans Chromium (Playwright) à 3 comptes, dont un en session : ordre, compteur, Ajouter ✅.
- **Points fragiles** : `online()` fait un `activeSessionInfo` par joueur en ligne (lecture du store) ; OK à quelques
  dizaines de joueurs, à revoir (cache) s'il y en a des centaines. Un joueur en session navigateur fermé n'apparaît
  pas (présence = signe de vie, comme chez les amis).

### Groupe : membre absent mais prêt gardé (Geoffrey) — branche `geoffrey/fix-absent-pret`, ✅ en ligne le 26/10
- **Quoi** : le ménage du groupe (`sweep`, `server/party/service.js`) retirait tout membre sans signe de vie depuis
  `memberTimeout` (5 min), même prêt / « prêt tout le temps » : onglet fermé = sorti du groupe, le chef ne pouvait
  plus le lancer. Désormais `sweep` saute un membre **non chef** avec `ready || always`. Rien d'autre ne bloquait :
  le lancement (`launch`, `game.start`) et `launchState` (lobby) ignorent `away`, qui reste un simple affichage.
- **Tests** : `tests/party.test.js` +2 (absents prêts lancés avec le groupe, « prêt » retiré après la session,
  « prêt tout le temps » gardé et relancé ; chef absent toujours retiré) ✅ 38/38 ; lobby, social, lfg ✅.
- **Points fragiles** : un « prêt tout le temps » qui ne revient jamais reste dans le groupe (et part en session) tant
  que le chef ne le retire pas ; c'est voulu. Il occupe aussi une place pour la recherche de groupe (LFG).

### Online : joueurs en session navigateur fermé oubliés (Geoffrey) — branche `geoffrey/fix-online-session`, ✅ en ligne le 26/10
- **Quoi** : bug signalé (plus d'amis en ligne que de joueurs dans Online). `online()` ne prenait que la Map `seen`
  (signes de vie) alors que `statusOf` (liste d'amis) dit « session » sans signe de vie. Ajout de
  `game.playersInSession()` (`server/game/service.js` : sessions `running` / `settling`, joueurs pas partis) ;
  `online()` = union `seen` ∪ en session. Le point fragile noté dans l'entrée précédente est réglé.
- **Tests** : `tests/social.test.js` +1 (session navigateur fermé comptée) et attente corrigée dans le test d'ordre ;
  social + game-service ✅ 66/66.
- **Points fragiles** : à chaque redémarrage du serveur (mise à jour de `main`), `seen` repart de zéro : pendant
  ~4 s, Online et la liste d'amis ne montrent que les joueurs en session.

### Lampe à incandescence par BP du T2, recherche T3 à 200 parts (Geoffrey) — branche `geoffrey/bp-lampe`, ✅ en ligne le 26/10
- **Quoi** : `src/recipes.js` : `unlock: 'Lampe à incandescence BP'` (avant `null`) ; `src/config.js` : BP ajouté au
  Treasure T2 (famille blueprint, 0,02 ; total BP du T2 6 % → 8 %), rareté `rare` ; `RESEARCH.tiers[2].cost` 150 → 200.
  La table de recherche lit les plans du Treasure T2 : le BP y entre tout seul, et le tier 3 demande maintenant aussi
  la recette de la lampe (`tierUnlocked`).
- **Tests** : lamp (verrouillée sans BP, apprise puis craftée), tier2 (liste et seuils des BP, fréquence 8 %, recherche),
  research (coûts, tier 3 à 200), rarity ✅ ; wiki, craft, loot, recycle, stuff ✅ ; `npm run test:anticheat` ✅ 91/91.
- **Points fragiles** : un joueur qui avait déjà tout le T2 appris perd l'accès à la recherche tier 3 jusqu'à ce qu'il
  apprenne la lampe. La lampe n'est pas dans `UPGRADE.tiers` (ligne de rune sur sa valeur propre).

### Amélioration +1 à +9 (Geoffrey) — branche `geoffrey/amelioration-plus9`, ✅ en ligne le 26/10
- **Quoi** : `UPGRADE.levels` passe de 3 à 9 paliers (`src/config.js`) ; le reste du code lit déjà `levels.length`
  (`MAX_PLUS`, `nextLevel`, `plusMult`, `sanitizePiece`, onglet Amélioration, wiki). Textes : `wiki.html`,
  `src/ui/upgrade.js`, `src/meta/piece.js`, GAME_DESIGN.
- **Tests** : `tests/amelioration.test.js` (9 paliers puis maximum, coûts, valeurs à 3 %/rang, plus:10 refusé),
  `tests/anticheat` (plumes du +1 = 6) ✅ ; amelioration, wiki, rune-pool ✅ 37 ; anticheat ✅ 91.
  ❌ préexistant sur main au moment du travail, sans lien : `tests/rune.test.js` « tier » (Lampe à incandescence sans tier).
- **Points fragiles** : pièces déjà +1 à +3 : bonus relu au nouveau barème (baisse : +3 = 9 % au lieu de 15 %).

### Steel ingot : 5 Graphite ingot (Geoffrey) — branche `geoffrey/steel-graphite-5`, ✅ en ligne le 26/10
- **Quoi** : `FURNACE` alliages, `src/config.js` : Steel ingot `'Graphite ingot':10` → `5`. Wiki (tableaux depuis la
  config), GAME_DESIGN, état du projet.
- **Tests** : `tests/graphite.test.js`, wiki, craft, anticheat.

### Bloc géant (Geoffrey) — branche `geoffrey/bloc-geant`, ✅ en ligne le 26/10
- **Quoi** : spec `docs/superpowers/specs/2026-10-26-bloc-geant-design.md`. Config `GIANT` (+ mode `giant` dans
  `MINE_MODES`, refusé par `game.start` : `mode_giant`). Règles pures `src/shared/giant.js` (jour de Paris : `dayOf`,
  `dayEnd`, délai, paliers cumulés `rewardFor`, `ranking`). Simulation `src/sim/giant/session.js` (salle sans fin :
  `joinGiant` / `leaveGiant` / `tickGiant`, visites finies dans `G.done`). `src/shared/giant-room.js` : fiche d'un joueur
  via `minerSpecs` (un par un ; `record.rings` = anneaux de tous les présents, nouveau paramètre de `minerSpecs`),
  recalcul des caractéristiques à chaque arrivée / départ. Serveur `server/giant/service.js` + `routes.js` (GET
  /api/giant, GET /api/giant/view, POST enter / leave / claim), branché dans `server/main.js` (pompe) et `app.js`.
  Service de jeu : `useGiant` (une visite compte comme une session : `start` refuse `in_giant`, `openInstant` écarte,
  `activeSessionInfo` et `playersInSession` la voient : Social), `giantEnter` (verrou `acct:`), `giantGrant` (verrou
  `inv:`, écriture inventaire + joueur). Stockage : ns `giant_day` (scores du jour) et `giant_player` (délai, visite en
  cours, jours réclamés), écritures groupées. Navigateur : `src/ui/giant.js` (carte du lobby, visite, fin),
  `src/render/giant.js`, `#giantCard`, `#gtRun`, `#gtDone` ; `lobbyCards` a une clé `giant`. Textures
  `giant_block` (80 × 80), `giant_fountain`, `giant_torch` (`gen_textures.py` : `giant()`).
- **Choix techniques** : la salle tourne dans le fil principal (pas de worker : 30 mineurs pendant 1 h de jeu ≈ 50 ms
  de calcul) ; pas de rejeu après un redémarrage : les visites pas finies reprennent avec le temps restant et les
  points enregistrés (toutes les `GIANT_SERVER.checkpointEvery` = 10 s), celles finies pendant l'arrêt sont closes avec
  ces points. Récompense d'un jour disponible à `dayEnd + durée d'une visite`. Mode dev (`npm run dev`) : pas de délai.
- **Tests** : giant-rules (8), giant-sim (12), giant-service (11), anticheat/giant (4), lobby (mis à jour), game-service
  (`mode_giant`) ✅. `npm run test:anticheat` ✅ 95. Vérifié dans Chromium (Playwright) à 2 puis 3 comptes : entrée,
  salle en direct, superposition (un pseudo + « ×3 »), fin de visite (155 points), carte du lobby (classement, paliers),
  aucune erreur dans la page ✅. `npm run simulate:giant` : 151 / 190 / 228 points par visite (sans stuff / fer /
  acier), une recharge par visite, pas de blocage.
- **Points fragiles** : la salle et les visites en mémoire du serveur (un seul serveur) ; les points d'une visite en
  cours depuis le dernier point d'étape sont perdus à un redémarrage (≤ 10 s) ; le jour d'une récompense se lit avec
  `Date.parse(jour + 'T12:00:00Z')`.
- **Après coup** : salle passée à 15 × 7 (`GIANT.w`, demande de Geoffrey) et mise en ligne **sans relancer les tests ni la
  simulation** (demande de Geoffrey). ⚠️ À revérifier : `node --test tests/giant-*.test.js` et `npm run simulate:giant`
  (le trajet plus long change les points par visite, la recharge d'oxygène et donc les repères des paliers).
  ✅ Vérifié le 26/10 (branche `geoffrey/fix-bloc-geant-fin`) : giant-sim et giant-rules verts ; simulate:giant à 15 × 7 :
  146 / 184 / 221 points par visite (sans stuff / fer / acier), une recharge par visite, pas de blocage.

### Bloc géant : fin de visite affichée trop tôt (Geoffrey) — branche `geoffrey/fix-bloc-geant-fin`, ✅ en ligne le 26/10
- **Bug** (signalé par Geoffrey) : écran de fin « Cette visite 91 points, total du jour 248 » pour une seule visite.
  Cause : après un redémarrage du serveur, `view()` et `leave()` ne reprenaient pas les visites d'avant (seuls `info`,
  `enter` et `pump` appelaient `restore`) ; si la vue arrivait avant, `me` = null et le navigateur concluait à la fin
  de la visite (points du dernier envoi), alors que le serveur la reprenait et la comptait en entier. Reproduit
  (scratch : une vue juste après un redémarrage → `me: null`).
- **Correction** : `sync()` (restore + advance) au début de chaque demande (`server/giant/service.js`) ; la fin d'une
  visite enregistre `p.last = { day, points, at }`, renvoyé dans `info.lastVisit` ; `src/ui/giant.js` : `me` absent →
  `refresh()` d'abord, fin seulement si `info.visit` est nul, points de l'écran de fin = `info.lastVisit.points`.
- **Tests** : giant-service +2 (première vue après redémarrage, `lastVisit`), anticheat/giant ✅ 17.

### Bloc géant : « Cette visite » < points réels, piste onglet en arrière-plan (Geoffrey) — branche `geoffrey/fix-bloc-geant-score`, ✅ en ligne le 26/10
- Même symptôme que l'entrée au-dessus, autre piste (onglet en arrière-plan : `lastMe` figé). Branche écrite en parallèle
  de `fix-bloc-geant-fin` ; au merge, **le code de `fix-bloc-geant-fin` est gardé** (`p.last`, `info.lastVisit` nul
  pendant une visite, qui couvre aussi ce cas). Seul le test « 2e visite seule, jour = somme des visites » est ajouté
  à `tests/giant-service.test.js`.

---

## 26/10/2026 — Tours : « Who ? » (branche `geoffrey/tour-who`) — ✅ en ligne le 26/10
- **Quoi** : `game.towerDone(side)` (`server/game/service.js`) : `{ open, done:Set }` sous le verrou du Jugement (done
  = comptes de l'ouverture en cours ; mode dev : toujours ouverte, comme au lancement). `social.towerWho(me, side)`
  (`server/social/service.js`) = `online(me)` moins moi et les `done` ; tour fermée → liste vide. Route
  `POST /api/social/tower-who { side }`, `socialApi.towerWho`. Lobby (`src/ui/lobby.js`) : bouton `#whoBtn` dans
  `#lobbyInfo` (tour choisie), liste `#towerWho` (`whoRows` : Inviter si pas en session/hors ligne et pas membre du
  groupe → `party.invite(displayId)`), refermée en changeant de mode. CSS `.towerWho`.
- **Tests** : `tests/tower-who.test.js` (nouveau, 3) ; tower-who, lobby, social, game-service, judgment : 97/97 ✅.
  Vérifié dans Chromium (mode dev, 2 invités) : la liste montre l'autre joueur, Inviter l'ajoute au groupe, 0 erreur JS.
- **Limites** : la liste suit `SOCIAL_SERVER.onlineListMax` (comme l'onglet Online) ; pas rafraîchie toute seule
  (reclic pour la mettre à jour).

### Tableau de bord des joueurs (Geoffrey, 26/10) — branche `geoffrey/tableau-de-bord`, ✅ en ligne le 26/10
- **Quoi** : `src/sim/mineur.js` + `src/sim/session.js` : `m.stats.hitTime` (+DT par tick où l'action est `attack`,
  compté avant `stepMiner`). `server/game/service.js` : au lancement d'une mine classique hors dev, `rec.statsAt[compte]
  = launchSnapshot({xp, tree, gear})` ; dans `settleWith`, après `status = 'done'`, `store.putSessionStats(statRows(…))`.
  `server/game/store.js` : ns `session_stat` (clé `session:compte`), jamais remplacée (idempotent), jamais effacée ;
  ajoutée au chargement PostgreSQL et au snapshot. `server/admin/dashboard.js` (logique pure + page HTML autonome,
  données en JSON échappé `<`). Route `POST /api/admin/stats` (mêmes gardes que les autres routes admin).
  `scripts/dashboard.js` (stdout ou `--out`). Config `DASHBOARD.ilvlStep` (250 x).
- **Tests** : `tests/dashboard.test.js` (8) ✅ ; game-service (48), live, admin, admin-khole, postgres ✅.
  Simulation 3 mineurs × 5 : 0 blocage, prof. 182, identique à avant ✅. Temps à frapper mesuré : 4 à 7 min par mineur
  et par session (20 à 35 mobs tués). Page vérifiée dans Chromium (données fictives, filtre joueur, aucune erreur JS).
- **Points fragiles** : `hitTime` compte la durée des actions `attack` au début de chaque tick (≈ au dixième de
  seconde près). Une session en cours au moment de la mise en ligne n'a pas de `statsAt` : pas de ligne (voulu).
  La profondeur est celle du groupe : dans un groupe de niveaux différents, chacun y contribue à son niveau.
- **Ajout (26/10, 9 h 50)** : courbe « profondeur par ilvl du groupe » (`depth_group_ilvl`) : `withGroupIlvl` (moyenne
  des ilvl des lignes de la même session = joueurs présents), calculé sur toutes les lignes avant le filtre par joueur ;
  une seule ligne par session (`perSession`), la profondeur étant celle du groupe. Colonne « ilvl groupe » dans
  l'historique. Test +1 (9) ✅ ; page revérifiée dans Chromium ✅.
- **Ajout (26/10, 10 h 20)** : prédiction sur `depth_group_ilvl` : `forecast(points)` = moindres carrés sur les sessions
  une par une (ilvl de groupe exact, pas les moyennes par tranche), ilvl où la droite atteint `DASHBOARD.forecastDepth`
  (350) ; null si moins de `forecastMin` (3) sessions, un seul ilvl ou pente ≤ 0 (la page l'écrit). Dessin : droite en
  pointillés décalée de `shift` = ilvlStep / 2 (un point de tranche est placé au début de sa tranche mais vaut pour son
  milieu), ligne de 350, cercle et étiquette « 350 ≈ ilvl N » (N en ilvl réel). Test +1 (10) ✅ ; Chromium ✅.
- **Point fragile** : une droite ; si la courbe réelle s'aplatit (rendement décroissant du stuff), la prédiction sera
  trop optimiste. À relire quand il y aura des sessions réelles sur plusieurs tranches d'ilvl.

---

## 26/10/2026 — Gear score (GS) et modulation des tours (branche `geoffrey/modulation`) — ✅ en ligne le 26/10
- **Quoi** : `src/meta/gearscore.js` (nouveau) : `pieceGS(entry)` = Σ stats de `pieceBonus` × `UPGRADE.prices` + Σ (set −
  STATS) × prix, arrondi ; anneau = 0 ; `gearScore(worn)` = somme. `TOWER.modulation.gsMax = 2000` (config).
  Serveur `server/game/service.js` `start` : `body.modulation === true` → refus `bad_request` hors tour, `gs_too_high`
  (409, noms et GS) si un joueur ≥ gsMax, GS calculé sur `gear` figé au lancement ; `rec.modulation = { gsMax }`, renvoyé
  par `publicSession`. `game.gsFor(compte)` ; `server/party/service.js` : `gs` par membre dans `publicParty`.
  Navigateur : `index.html` case `#modulationRow` ; `src/ui/lobby.js` `modulationState` (visible : tour choisie, pas en
  session, seul ou chef ; liste ceux qui dépassent), GS dans les tags de chaque place, `modulation:true` envoyé au
  lancement d'une tour ; `src/main.js` `gs()` ; `src/ui/stuff.js` ligne Gear score + GS dans la liste des pièces ;
  `src/meta/stuff.js` `stuffTip` : ligne `GS n` (pas pour un anneau).
- **Tests** : `tests/gearscore.test.js` (nouveau, 5) ; `tests/stuff.test.js` (bulle avec GS) ; gearscore, stuff,
  amelioration, lobby, party, game-service, tower : 159/159 ✅. Page chargée dans Chromium (onglets Stuff, Lobby) :
  aucune erreur JS.
- **Déjà cassé sur main, pas touché** : ❌ `tests/rune.test.js` « tier : chaque pièce qu'on peut runer a un tier »
  échoue aussi sans cette branche (une pièce sans tier dans `UPGRADE.tiers`).
- **Points fragiles** : prix en x provisoires de portée / recul (1000 x par point) : la Lance en fer ≈ 1 020 GS. Le GS
  des membres dans le lobby n'est rafraîchi qu'à l'état complet du groupe (les autres réponses du groupe ne le
  renvoient pas, comme le skin). Récompense de la modulation : rien (rec.modulation sert de marqueur pour la suite).

### Admin : retirer un objet (Geoffrey) — branche `geoffrey/admin-retirer`, ✅ en ligne le 26/10
- **Quoi** : `POST /api/admin/take {name, item, qty}` (`server/admin/routes.js`, même garde que give) → `adminTake`
  (`server/game/service.js`), outil `scripts/take-item.js`. Verrous inv puis skills (même ordre que glyph_pose).
  D'abord l'inventaire ; un glyphe posé (`st.glyphs[nœud]`) compte pour 1 et est retiré de la case s'il en manque.
  Tout ou rien (409 not_owned sinon). Stuff non empilable : retire les derniers exemplaires de l'inventaire (jamais une
  pièce portée).
- **Points fragiles** : un glyphe retiré de sa case pendant une session reste actif jusqu'à la fin de cette session
  (skills figés au lancement), comme pour un retrait par le joueur.
- **Tests** : `tests/admin-take.test.js` ✅ 3 (inventaire, tout ou rien, glyphe posé, garde-fous, clé/relais) ;
  admin ✅ 7.

## 26/10/2026 — Modulation cachée (branche `geoffrey/cacher-modulation`) — ✅ en ligne le 26/10
- **Quoi** : `TOWER.modulation.open = false` (src/config.js). `src/ui/lobby.js` `modulationState` : `show` exige
  `open || dev` (dev = `st.info.dev`). `server/game/service.js` `start` : `body.modulation === true` refusé
  (`bad_request`, « pas encore ouverte ») si `!open && !dev`, avant les autres vérifications de modulation. Le GS (pièces,
  Stuff, tags du lobby dans tous les modes, `gsFor` du groupe) n'est pas touché.
- **Tests** : `tests/gearscore.test.js` ✅ (refus hors dev, case cachée hors dev) ; lobby, party, tower, tower-who ✅ (82).
- **Pour rouvrir** : `open: true` ; les tests vérifient la case selon `open`, le test de refus attend `open === false`.

---

## 26/10/2026 — Glyphe Treuil : `GLYPHS.liftSpeed` 3 → 1,5 (branche `geoffrey/nerf-glyphe-treuil`) — ✅ en ligne le 26/10
- **Quoi** : `src/config.js` `GLYPHS.liftSpeed: 1.5` et texte `GLYPHS.desc.winch` ; `GAME_DESIGN.md` (tableau des
  glyphes : 1,28 × la montée, 1,59 × avec Escalateur 5/5) ; `claude/etat-du-projet.md` ; `tests/glyphs.test.js` (valeur).
- **Tests** : glyphs, glyph-drop, tower*, wiki : 82/82 ✅.
- **Note** : l'ascenseur est posé une area sur deux mais couvre 2 areas à chaque fois (moitié moins de remontées pour le
  construire) ; à × 1,5 il reste meilleur que le treuil (Geoffrey). Pas mesuré en simulation.

---

## 26/10/2026 — Bloc géant : `GIANT.oxygenPerHit = 1` (branche `geoffrey/nerf-glyphe-treuil`) — ✅ en ligne le 26/10
- **Quoi** : `src/sim/giant/session.js` `mine()` : chaque coup (`m.stats.hits++`) retire `GIANT.oxygenPerHit` (plancher 0).
  `oxToFountain` (seuil de départ vers la fontaine) ne compte que la marche : pas de coup en marchant, inchangé.
- **Tests** : `tests/giant-sim.test.js` +1 (perte = drain × t + coups × oxygenPerHit) ; giant-*, anticheat/giant : 37/37 ✅.
- **simulate:giant** (20 seeds) : sans stuff 146, fer 184, acier 221, résistance 50 % 189 (inchangés, 1 recharge) ;
  vitesse 2 + ténacité 20 % : 277 → 262, 2 recharges. Paliers non retouchés.

---

## 26/10/2026 — Bloc géant : paliers `GIANT.tiers` 1 000 / 5 000 / 10 000 / 15 000 / 20 000 (branche `geoffrey/paliers-bloc-geant`) — ✅ en ligne le 26/10
- **Quoi** : `src/config.js` `GIANT.tiers[].min` (avant 1 000 / 2 500 / 5 000 / 7 500 / 10 000), mêmes objets ;
  textes `GAME_DESIGN.md` et `wiki.html`.
- **Tests** : ⚠️ mis en ligne **sans relancer les tests** (demande de Geoffrey). À vérifier : `node --test
  tests/giant-*.test.js tests/anticheat/giant*.test.js` (un test peut lire un `min` en dur).
  Vérifié après la mise en ligne (26/10) : 3 tests lisaient les anciens paliers en dur (anticheat/giant, giant-rules,
  giant-service) ; scores des tests doublés (branche `geoffrey/tests-paliers-bloc-geant`) → giant-*, anticheat/giant 37/37 ✅.
  Le jeu lui-même n'était pas en cause.

---

## 26/10/2026 — Skin de la Cape de Naingui : calques derrière le corps (branche `geoffrey/skin-cape`) — ✅ en ligne le 26/10
- **Quoi** : `src/skins.js` : case `cape` ajoutée à `SKIN.layers` (entre torse et casque : le col) ; nouveau `SKIN.back`
  (calques dessinés derrière le corps : le dos de la cape) ; `backPieces(look)`, `auraPieces(look)` (l'aura d'une case se
  dessine sur son calque de dos s'il existe, sinon sur celui de devant). `src/render/miner-sprite.js` et
  `src/render/portrait.js` : aura → dos → corps → devant. Textures `skins/naingui_cape(_front)` dans
  `scripts/gen_textures.py` (régénéré : seulement ces deux PNG nouveaux). `src/meta/aura.js` lit `SKIN.layers` : la
  case cape a son aura sans autre changement.
- **Tests** : `tests/skins.test.js` +1 (ordre des calques, dos, aura) ; skins, aura 19/19 ✅. Aperçu agrandi vérifié
  (corps seul, avec cape, avec armure en fer). ⚠️ Pas regardé dans le navigateur (mine et portrait).


### Bloc géant consultable en session (Geoffrey) — branche `geoffrey/onglet-bloc-geant`, ✅ en ligne le 26/10
- **Quoi** : `mineModes` (`src/ui/lobby.js`) grisait tout sauf la MI pendant une session → le bouton Bloc géant
  aussi (demande de Geoffrey : la carte doit toujours s'ouvrir). Désormais `disabled` = `locked && !scheduled && !giant`.
  L'entrée reste refusée : carte (`src/ui/giant.js`, Entrer grisé si `h.session()`) et serveur (`game.giantEnter`).
- **Tests** : lobby ✅ 15 (assertion inversée : giant choisissable en session). giant-rules / giant-service : 2 échecs
  « récompense : paliers » déjà présents sur main (paliers relevés, d6a2dfa), corrigés par la branche
  `geoffrey/tests-paliers-bloc-geant` — sans lien avec ce changement. ✅ Après merge de main (9cb496c) : lobby +
  giant-rules + giant-service ✅ 35.

## 26/10/2026 — Butin rare des mobs : 4 pièces de stuff (branche `geoffrey/stuff-mobs`) — ✅ en ligne le 26/10
- **Quoi** : `src/config.js` : 4 entrées `STUFF.items` (stats en x = pièce en fer de la case via `UPGRADE.prices`,
  ceinture 250 x ; champ `recycle` = rendu fixe), `RARITY.items`, `UPGRADE.tiers[2]`, `TEXTURES`, nouveau `MOB_DROPS`
  (après `DUNGEON` : mob, item, chance, kholeChance). `src/sim/actions.js` : `rareDrop` appelé à la fin de `killMob`
  (tous les types), hasard `G.dropRng = mulberry32(seed ^ MOB_DROPS.salt)` créé au premier mob qui a un butin rare,
  `G.khole` → kholeChance, `collect` d'1 pièce (poids 0), sans `lootOf` ; chance × (1 + `lootBonus(m)`, même bonus que `lootOf` : skill loot +
  carac.looting/100), décision de Geoffrey le 26/10 (d'abord chance fixe). `src/meta/craft.js` : `recyclable` /
  `recycleRefund` acceptent un `recycle` fixe quand il n'y a pas de recette. Skins `src/skins.js` + dessins
  `scripts/gen_textures.py` (icônes straps_goblin, hood_dark, cloud_magic, belt_giant ; calques skins/goblin_straps,
  dark_hood, magic_cloud, giant_belt). Wiki : `sourcesOf`, `mobDropRows`, tableau `#w-mob-drops`.
- **Tests** : `tests/mob-drops.test.js` ✅ 6 (config, x, fréquences sur 40 000 morts, hasard à part, recyclage
  idempotent, wiki) ; `tests/anticheat/recycle.test.js` ✅ (rafale sur la Ceinture) ; rareté mise à jour ✅ ; 22 fichiers
  liés ✅ sauf `rune.test.js` « chaque pièce qu'on peut runer a un tier » ❌ **déjà sur main** (Lampe à incandescence
  sans tier, branche geoffrey/lampe-bp). Simulation 5 sessions ✅ 0 bloquée ; même seed = mêmes chiffres qu'avant.
- **Points fragiles** : une pièce lâchée suit le sac du mineur, comme le reste du butin. En tour,
  les mobs n'ont pas ces types : pas de drop. Le minotaure de l'arène du k hole compte comme « k hole » (G.khole).

---

## 26/10/2026 — Gear score aux prix mesurés (branche `geoffrey/gs-en-x`) — ✅ en ligne le 26/10
- **Quoi** : `src/meta/gearscore.js` `priceOf` = `UPGRADE.worth[k] ?? UPGRADE.gs[k] ?? 0` (avant : `UPGRADE.prices`).
  `src/config.js` `UPGRADE.gs = { doubleAttack:8, tenacity:5, knockRes:0, reach:0, knockback:120, torchRadius:27 }` :
  stats absentes de `worth`, simulées le 26/10 (script hors dépôt, 24 seeds `(i+1)×7919`, mineur de base, avec / sans,
  écart de valeur de minerai au coffre × 3 600 ; marges : double attaque +20 % = 162 ± 97 x, ténacité +20 % = 99 ± 72,
  résistance au recul : parties identiques, portée +0,5 = −60 ± 95, recul +1 = 120 ± 94) ; rayon des torches 27 =
  GAME_DESIGN §3. `worth` n'est pas modifié : ilvl, valeur des objets et runes inchangés.
- **Tests** : `tests/gearscore.test.js` +1 (prix = worth puis gs, pas de clé en double, Lance < 600) ; gearscore, stuff,
  lobby, party, game-service : 116/116 ✅. `gearScore(tout fer) = 2191` reste ≥ 2000 (test de modulation).
- **Chiffres** : tout fer 2 481 → 2 191, tout acier 3 391 → 3 011, Lance en fer 1 020 → 360, Pioche en acier 1 000 → 650,
  Plastron de l'équilibre 1 335 → 1 426 (sa ténacité +3 % compte : 15 x), Lampe à incandescence 0 → 81.
- **Points fragiles** : prix de `UPGRADE.gs` au bruit près (marges ci-dessus, mine classique seulement ; en tour, portée et
  recul valent sans doute plus). `TOWER.modulation.gsMax` (2000) choisi avec l'ancien barème, pas retouché.

## 26/10/2026 — Butin rare des mobs : recalage sur les prix mesurés (branche `geoffrey/stuff-mobs`) — ✅ en ligne le 26/10
- **Quoi** : après le merge de `geoffrey/gs-en-x` (GS aux prix mesurés), Nuage `speed` 1,4 → 1,1
  (263 x = Jambes en fer) et Ceinture `tenacity` 12,6 → 25 (250 x) ; Lanières et Capuche inchangées (tableau des runes :
  en prix mesurés, vitesse d'attaque +135 % et recul +1,1). GS : Lanières 306, Capuche 142 (sous le fer en prix mesurés).
  Test x réécrit en conséquence ✅.

## 26/10/2026 — Golem de sperme : mob 2 × 2 qui creuse (branche `geoffrey/golem`) — ✅ en ligne le 26/10
- **Quoi** : `src/sim/golem.js` (nouveau) : cases, `breakable`, `smash` (bloc perdu, `oreRemoved`, `updateLight`),
  `standing` (sol sous une colonne OU bloc contre un flanc, bord de la mine compris), `fitsAt`/`clearAt` (naissance),
  `golemFalls`, `golemStep` (escalier vers la proie, cheminée dessous, `o.stair` gardé en salle ouverte, demi-tour
  seulement contre un bord ou un incassable ; un bloc toutes les `dig` s via `o.dig`, à part de `o.cd`), `quake`
  (`m.quakeUntil`). `src/sim/mobs.js` : `updateGolem`, golem dans `WALKERS`, naissance dans `spawnMobs` (`fitsAt`,
  `clearAt`, `o.size`, `o.knockRes`, `o.speed` depuis `MOBS.speed`), `strike` lit `MOBS.hitEveryBy` et pousse depuis
  `nearCell`. `src/sim/knock.js` : `nearCell` (case la plus proche d'une entité de plusieurs cases), utilisée par `gap` et
  `inReach` : tout ce qui mesure la portée (tacle, coups, IA) marche pour le golem sans autre changement. `ai.js` /
  `session.js` : étourdi tant que `m.quakeUntil`. `actions.js` `killMob` : butin. `trap.js` : `MOBS.noTrap`. Config :
  `MOBS.golem`, `hpBase`/`minArea`/`spawnTable`/`speed`/`hitEveryBy`/`knock`, `XP.mob.golem`, objet `Pierre glissante`,
  textures `golem` (32 × 32) et `slippery_stone`. Rendu `src/render/canvas.js` (2 × 2, goutte animée). Wiki : fiche,
  vitesse de chaque mob (`MOB_INFO.speed`).
- **Piège évité** : un corps de 2 de large ne peut jamais faire demi-tour en montant un escalier qu'il creuse (la marche
  qui le porterait est toujours déjà creusée par lui) : il dépassait le mineur, glissait sur son escalier, remontait
  (boucle). D'où la cheminée et l'agrippement (`standing`).
- **Tests** : `tests/golem.test.js` (nouveau, 14) ; goblin, mephite : table de l'area 5 mise à jour ; combat, dungeon,
  goblin, khole, knock, lobby, loot, mephite, mobs, spells, trap, view, wiki, session, skins ✅ ; anticheat 95/95 ✅.
- **Simulation** : normale (`--miners 3 --count 5`) identique au chiffre près à avant (182,4 de profondeur, 4140 pods,
  0 bloquée) : rien ne change avant l'area 5. Stress (golem dès l'area 0, 30 % des apparitions, via un script chargé avant
  `simulate.js`) : 14 à 20 golems par session, tous tués sauf 3 en fin de session, ≈ 90 s de vie, 80 à 200 blocs cassés,
  0 session bloquée ; le seul golem immobile en chasse attendait devant un donjon où était le mineur (voulu).
- **À vérifier** : ⚠️ pas regardé dans le navigateur (dessin 2 × 2, barre de vie, goutte) ; ⚠️ la simulation standard
  n'atteint pas l'area 5 (3 areas) : à surveiller en vraie partie.


## 26/10/2026 — « Who ? » : joueurs hors ligne des dernières 24 h (branche `geoffrey/who-deconnectes`) — ✅ en ligne le 26/10
- **Quoi** : `server/accounts/store.js` `recentlySeen(since)` → { compte: max lastSeenAt } d'après les connexions
  (lastSeenAt prolongé au plus une fois par heure : à une heure près ; survit aux redémarrages). `server/social/service.js`
  : map `lastSeen` (signe de vie à la minute, gardée `SOCIAL_SERVER.whoRecentFor` = 24 h, perdue au redémarrage) ;
  `towerWho` ajoute après les joueurs en ligne les comptes vus depuis 24 h (max des deux sources), sans moi, sans ceux
  qui ont fait la tour, sans compte supprimé, `status:'offline'`, `lastSeenAt`, triés du plus récent ; renvoie aussi
  `online`. `src/ui/lobby.js` : `seenText` (« Hors ligne · vu il y a 3 h / 25 min »), pas d'Inviter, en-tête « n joueurs
  sans cette tour (x en ligne…) ».
- **Tests** : `tests/tower-who.test.js` ✅ 7 (ordre et filtres, mémoire à la minute puis oubli après 24 h, texte,
  recentlySeen) ; social, accounts, lobby ✅ (40).
- **Points fragiles** : un joueur qui garde le jeu ouvert sans recharger a un lastSeenAt de connexion jusqu'à 1 h en
  retard ; après un redémarrage du serveur, « vu il y a » peut donc être surestimé d'une heure au plus. Liste visible par
  tous les joueurs (comme l'onglet Online), pas seulement les amis.

---

## 26/10/2026 — Apparence des torches de la Lampe à incandescence (branche `geoffrey/skin-lampe`) — ✅ en ligne le 26/10
- **Quoi** : `src/sim/mineur.js` `placedTorch(m)` = { x, y, r, item? } (item = `m.look.torche`), utilisé par
  `src/sim/actions.js` (mine) et `src/sim/tower/session.js` (tour). `src/skins.js` : `SKIN.torch` (base 'torch', lampe
  'torch_lamp'), `torchTexOf(torche)`, ajouté à `SKIN_TEXTURES`. Rendu `src/render/canvas.js` et `src/render/tower.js`.
  Vue de la tour `src/shared/tower-view.js` : liste `torchItem` (seulement si une torche a un item). Vue de la mine :
  torches envoyées entières, rien à changer. Texture `torch_lamp` dans `scripts/gen_textures.py`.
- **Tests** : `tests/lamp.test.js` ✅ (item et apparence en mine et en tour, vue navigateur comprise) ; tours, k hole,
  lumière, vues ✅ (86). Simulation 5 sessions ✅ 0 bloquée, mêmes chiffres qu'avant (champ en plus, aucun hasard).
- **Points fragiles** : l'apparence suit `look` (équipement figé au lancement), le rayon suit `carac` : les deux
  viennent du même stuff. Torches du k hole (salle éclairée) : sans item, torches de base.

---

## 26/10/2026 — Tours : pods (branche `geoffrey/tour-pods`) — ✅ en ligne le 26/10
- **Quoi** : `src/config.js` : `TOWER.floors` 6 → 7 ; `TOWER.chest = { floor:0, deposit:1, max:500 }` ; BLOCKS 14 / 16
  (Stonebrick angélique / démoniaque) : `w:10`, `family:'material'`, plus de `noDrop` → ce sont des objets (ITEMS).
  `src/sim/tower/session.js` : `m.inv` / `m.load` ; `mineCell` met la brique du camp dans le sac (`G.bricks--`) ;
  `decide` : après les mobs, `bagFull` (load > 0 et load + w > pods) et `G.bricks > 0` → chemin vers `G.chestAt`
  (milieu de l'étage 0, ligne du bas), action `deposit` → `G.chest` ; pas de chemin : il continue (la brique suivante
  entre quand même : jamais perdue). `towerLoot(G)` = coffre + sacs des mineurs présents ; `summary.loot` (réussite
  seulement). `leaveTower` : sac perdu. `src/shared/tower.js` `splitTowerLoot(loot, n, side, random)` : parts égales,
  reste à des joueurs tirés au hasard, seule la brique du camp, entier 1…`TOWER.chest.max`. `server/game/service.js`
  `settleWith` : héritiers = présents d'une réussite ; bag = trésor + part. Vue (`tower-view.js` : `chestAt`, `chest`,
  `load`, `pods`), rendu (`render/tower.js` : texture `chest`), HUD (sac de chacun, ligne du coffre), bilan (tout le
  butin). Wiki (texte de la tour), GAME_DESIGN (Tours).
- **Tests** : `tests/tower.test.js` +4 (sac, vidage, conservation tick par tick, butin seulement en réussite et sans le
  sac d'un parti, partage : conservation, égalité à 1 près, quantités invalides et objets étrangers refusés, vue) ;
  `tests/game-service.test.js` (versement : 7 briques au seul présent, Fer inventé ignoré, rien en échec ni au parti).
  tower, tower-boss, tower-who, game-service, anticheat/*, inventory, wiki ✅.
- **Tests modifiés (équilibrage, à relire)** : « compo forte » ne vérifie plus « toit atteint et boss entamé de 20 % »
  mais « au moins le dernier étage » (seed 13 n'atteint plus le toit). Treuil et regroupement : seed 3 → 7 (avec 7
  étages, la porte du toit de la seed 3 passe à gauche, à côté du treuil : scène du test plus valable).
- **Simulation** (20 tours, 2 mineurs + 1 barbare, sans skill) : 1,1 / 10 : toit 5/20 à 9:52, 7 vidages, 0 blocage
  (sans limite de pods : 20/20 à 8:28 ; en ligne 20/20 à 7:11). Tout fer : 0/20 (en ligne 10/20). Tout acier : 7/20 à
  9:43, 3 vidages, ≈ 59 briques par joueur (en ligne 17/20).
- **Pas vérifié** : affichage dans un navigateur (coffre, sac dans le panneau, bilan).
- **Points fragiles** : le chemin vers le coffre passe par les échelles posées à la montée (planTo) ; un mineur plein
  pendant un combat de mobs combat d'abord. Rien d'autre ne lit encore les stonebricks (pas de recette).
- **Mise à jour (26/10, plus tard)** : 7e étage **retiré** à la demande de Geoffrey (`TOWER.floors` 7 → 6). Les trois tests
  adaptés (compo forte, seeds du treuil et du regroupement) sont revenus à leur version d'origine et passent ✅ (tower,
  tower-boss, tower-who : 48/48). Simulation 6 étages + pods : tout fer 4/20 à 9:38 (toit 6:38, 4,8 vidages, ≈ 40
  briques par joueur) ; tout acier 16/20 à 9:07 (toit 5:49, 3 vidages, ≈ 51 briques) ; 1,1 / 10 : toit 8:28 (sans
  limite de pods 7:11), 6,5 vidages, 0 blocage ; compos de `simulate:tower` 0/20 (d : 2/20 sans les pods).

## 26/10/2026 — Butin rare des mobs : `MOB_DROPS` 0,5 % → 0,1 %, minotaure 1 % / 2 % → 0,5 % / 1 % (branche `geoffrey/nerf-drops`)
- **Quoi** : `src/config.js` `MOB_DROPS.items` ; `GAME_DESIGN.md` (tableau du butin des mobs), `claude/etat-du-projet.md`.
  Wiki : tableaux et « d'où ça tombe » lus dans la config.
- **Tests** : `tests/mob-drops.test.js` : valeurs et textes du wiki mis à jour, N = 200 000 tirages (à 0,1 %, 40 000 ne
  suffisaient plus pour la marge de 25 %) ; le test du multiplicateur de butin lit la config. mob-drops, wiki 18/18 ✅.

### Glyphes : drop à ≈ 1 % par session (Geoffrey, 27/10) — ✅ en ligne le 27/10
- `GLYPHS.drop` (src/config.js) : mineur 0,0000126 /bloc, logisticien 0,000110 /échelle, barbare 0,000335 /mob
  (ancien 0,0000383 / 0,000335 / 0,00101 ≈ 3 %). Calcul 1 − 0,99^(1/E), E = 795 blocs, 91 échelles, 30 mobs par mineur
  et par session à 3 (mesures du 26/10, non remesurées).
- Mis à jour : tests/glyph-drop.test.js (taux + ≈ 1 % ± 0,02), wiki.html, GAME_DESIGN.md, claude/etat-du-projet.md.
- Tests : glyph-drop ✅, anticheat ✅. Aucune logique changée, seulement des valeurs.

### Groupe : chef absent jamais retiré (Geoffrey, 27/10) — ✅ en ligne le 27/10
- Signalé : chef AFK 1 h (onglet probablement endormi : le lobby continue d'envoyer des signes de vie onglet caché,
  donc veille / onglet suspendu / navigateur fermé), lobby vide au retour. Cause : `sweep()` retirait le chef au bout
  de `PARTY_SERVER.memberTimeout` (5 min), le suivant devenait chef.
- `server/party/service.js` `sweep()` : `if(m.account === p.leader) continue;` avant la règle des membres prêts.
- Test remplacé dans tests/party.test.js (chef absent 30 min gardé, affiché absent, les autres quittent). party ✅ (36),
  lfg ✅, lobby ✅, social ✅.
- Point fragile : un chef parti pour de bon garde son groupe en mémoire et dans le stockage (rien ne le nettoie) ;
  volume négligeable (un groupe par compte au plus).

### Stuff : armures = valeur du tier, combat du butin des mobs ÷ 2 (Geoffrey, 27/10) — branche `geoffrey/stuff-valeurs-tier`, ✅ en ligne le 27/10
- **Quoi** : `src/config.js` : stats des 12 armures (casque / plastron / jambes / bottes × chitine / fer / acier) réglées
  pour que `pieceGS` = `UPGRADE.tiers[t].x` à l'arrondi du pas près (102, 252, 402 au pire) ; butin des mobs recalculé :
  part = 250 x / nb de stats, stat = part ÷ prix mesuré (worth ?? gs) × `STUFF.combatOnStuff` (0,5) si elle est dans
  `STUFF.combatStats`. Nouvelles clés `STUFF.combatStats`, `STUFF.combatOnStuff` (seulement lues par le test).
- **Tests** : `tests/stuff-balance.test.js` (3, nouveau : garde la règle) ✅ ; chiffres mis à jour dans amelioration,
  anneaux, blueprint, carac, stuff, steel-gear ; `mob-drops` : ancien test de valeur retiré (remplacé) ; `gearscore` :
  l'exemple « au-dessus de 2 000 GS » passe de tout fer (1 884 désormais) à tout acier. 58 fichiers qui lisent le stuff :
  ✅ sauf 3 échecs **déjà présents sur main** (Lampe à incandescence sans tier dans rune.test ; source des glyphes dans
  wiki.test ; lobby dev « tours toujours dans Où miner »).
- **Simulation tours** (script jetable, 2 mineurs + 1 barbare, stuff complet, 20 tours, seeds 1-20) : fer 4/20 → 3/20,
  acier 16/20 → 11/20 ; avant = repères du 26/10, retrouvés à l'identique. La mine (simulate.js, mineur de base) ne bouge pas.
- **Points fragiles** : la règle dépend des prix mesurés : remesurer `UPGRADE.worth` / `gs` fera échouer
  stuff-balance.test.js tant que les pièces ne sont pas réajustées (voulu). Capuche : recul +0,52 (gs : 120 x / bloc).
- **Correction (27/10, 10 h 55, Geoffrey)** : plastrons remis à leurs valeurs (pods 30 / 88 / 120) : torse volontairement
  plus fort, hors règle du tier. stuff-balance.test.js : casque / jambes / bottes seulement + un test « plastron au-dessus
  de son tier » ; tests amelioration, carac, stuff, blueprint, steel-gear revenus aux anciens chiffres de pods ✅ (83).
  La simulation des tours du matin ne vaut plus (les pods n'ont plus bougé) : seuls casques / jambes / bottes changent
  un peu (fer : montée 3,3 → 3,25, marche 4,05 → 4,04).

### Sorts : Bonbonne de zipette, Cri de guerre, Cleave, Hand of Justice (Geoffrey, 27/10) — ✅ en ligne le 27/10
- Config `SPELLS.list` : `zipette`, `war_cry`, `cleave`, `hand_of_justice` (parchemins créés tout seuls dans ITEMS).
- `src/sim/spells.js` (`updateSpells`) : `warCry`, `cleave`, `handOfJustice`, `zipette`. « En combat » = `fighting()` :
  coup en cours (action attack, mob vivant) ou tacle, jamais pendant un étourdissement. `fair()` : un boss de donjon
  seulement si c'est sa cible ou celui qui le tacle.
- Cri de guerre : `m.warcry = { until, dmg, speed }` sur chaque mineur touché ; lu par `warcryOf` (src/sim/mineur.js)
  dans `hitDamage` (actions.js, × (1+dmg)) et l'intervalle d'attaque (ai.js `fight`, × (1+speed)). Recharge = fin + cd.
- Zipette : modes exclus `return`, `departure`, `surface`, `fetch` ; `o.ox < oxygenMax` ; gain `m.carac.pods × 0,2`
  plafonné. Hand of Justice : `stunUntil`, `grab = null`, `channel = null` (même étourdissement que le Dash, mobs.js).
- Pas de branchement dans le Bloc géant, les tours ni la MI (pas de sorts là-bas, ou seulement les leurs).
- Wiki : glyphes, texte « ≈ x % par session » lu dans `GLYPHS.dropPerSession` (restait à 3 % depuis le passage à 1 %).
- Tests : spells ✅ (25), wiki ✅ (11), combat, knock, mobs, session, giant-sim, mob-drops ✅. Simulation 5 sessions
  `--skills mixed` avec / sans `--spells zipette,war_cry,cleave,hand_of_justice` : 0 blocage, coffre 4 499 / 4 510 pods.
- À vérifier : effet réel de chaque sort sur le coffre et les combats (pas mesuré séparément).

### Discord : ouverture d'une tour annoncée (Geoffrey) — branche `geoffrey/discord-tour-ouverte`, ✅ en ligne le 27/10 (restée sur sa branche le 26/10 : c'est pour ça que le bot n'a rien écrit)
- **Quoi** : `towerOpenMessage(side)` (`server/social/discord.js`). Branché dans `withJudgment`
  (`server/game/service.js`) : on note `j[side].opening` avant, et après l'enregistrement on annonce chaque camp dont
  le numéro a avancé. Couvre les trois causes d'ouverture (`addResidues`, `refresh` à la lecture = réouverture après
  une ouverture pleine, `setCount` admin) ; sous le verrou 'judgment' → jamais deux annonces pour une ouverture.
- **Point fragile** : une réouverture automatique n'est vue (et annoncée) qu'à la prochaine lecture du Jugement
  (lobby, lancement, fin de session) ; en pratique quelques secondes, mais pas à la minute près si personne ne joue.
- **Tests** : discord ✅ (+4 : message, résidus + relectures/redémarrage, admin, réouverture ; 2 attentes existantes
  complétées par l'annonce d'ouverture), judgment, admin, tower* ✅ 75.

### Bloc géant pendant une session + récompense à 2 visites (Geoffrey) — branche `geoffrey/bloc-geant-session`, ✅ en ligne le 27/10
- **Quoi (serveur)** : `giantEnter` ne refuse plus un joueur en session ; `game.start` ne refuse plus un joueur au Bloc
  géant (`in_giant` supprimé) ; `openInstant` n'écarte plus un joueur en visite. `activeSessionInfo` (Social) montre la
  session d'abord, sinon la visite. Récompense : `minVisitsFor(day)` / `earnsReward(score, day)` (`src/shared/giant.js`),
  `GIANT.minVisits = 2` à partir de `GIANT.minVisitsFrom = '2026-10-27'` (avant : 1) ; `pendingRewards` les utilise,
  `info()` renvoie `minVisits`.
- **Quoi (navigateur)** : `#sessSwitch` (`index.html`) + `updatePanes()` (`src/main.js`, toutes les 300 ms) : quand une
  session (ou son bilan) ET une visite (ou son écran de fin) existent, l'onglet reçoit `.both` + `.paneGiant` /
  `.paneSession` ; le CSS cache l'autre groupe (`display:none!important`) sans toucher aux `hidden` des modules (le
  Bloc géant continue de dessiner et d'interroger le serveur, `visiting()` lit `#gtRun.hidden`). Les panneaux plein
  écran descendent de la hauteur de la barre. Ce qui vient de commencer passe devant. Carte : « Entrer » n'est plus
  grisé en session ; « Encore N visites… » (`visitsLeft` / `visitsText`, `src/ui/giant.js`).
- **Tests** : giant-service +3 (deux sens, MI pendant une visite, 2 visites dès le 27/10 dont « une seule : rien »),
  ancien test « une session à la fois » remplacé ; giant-rules +1 ; giant-sim, lobby, game-service, instant-server,
  party, social ✅ 167 ; anticheat ✅ 96. Vérifié dans Chromium (Playwright) : session puis entrée au Bloc géant, barre,
  aller-retour (canvas redessiné 944 × 503), « Entrer » actif en session, aucune erreur de page ✅.
- **Points fragiles** : le Social (`activeSessionInfo`) n'affiche qu'une des deux activités (la session). Un joueur au
  Bloc géant pendant sa session ne regarde pas sa session (sans effet : elle tourne sur le serveur).

### Instances : Instance I, le roi gobelin (Geoffrey) — branche `geoffrey/instances`, ✅ en ligne le 27/10
- **Quoi** : spec `docs/superpowers/specs/2026-10-27-instances-design.md`. Config `INSTANCE` (+ `MINE_MODES` 'instance_1',
  `instance: true`). Clé : `ITEMS['Clé d'instance I']` (cat 'key'), rareté inhabituel, famille `key` du `LOOT['Treasure
  T3']` (tirage à part, 5 %), texture `key_instance_1`. Simulation `src/sim/instance/world.js` (carte : AIR, ROCK, CAGE,
  SPAWNER ; rebords, plateforme) et `session.js` (spawners, gobelins avec BFS et gravité, IA des mineurs : Dijkstra
  comme les tours avec échelles et creusage des cages, perçage des spawners au tick près dans `stepMiner`, roi : sleep →
  drop → fight / wait, coup boosté, enfermements, rage ; sorts). Partagé : `src/shared/instances.js` (isInstanceMode,
  clés, buildInstanceGame, départs) et `instances-view.js`. Serveur : `live-game.js` (kind 'instance'), `service.start`
  (verrous `acct:` + `inv:` des joueurs, `no_key`, clés retirées et session écrite ensemble :
  `store.putGameSessionAndInventories`), pas d'XP au partage, pas de focus. Navigateur : carte `#instCard` (lobby.js,
  un seul bouton « Instances », `h.keys`), `#inRun`, `src/render/instance.js`, `src/ui/instance-hud.js`. Textures
  `instance_spawner`, `instance_cage`, `goblin_king` (48 × 48). Script `npm run simulate:instance`.
- **Au passage** : `service.start` avait une boucle `for(const p of players)` orpheline (laissée par une autre session) qui
  répétait la vérification « serveur plein » : retirée. `main.js` : la carte du lobby se redessine quand l'inventaire
  change, et l'inventaire est relu après le lancement d'une instance (clé consommée).
- **Tests** : instance-key (3), instance-sim (12), instance-server (6), anticheat/instance (3), lobby (mis à jour) ✅ ;
  game-service, live, party, tower, instant-server, social ✅ 146 ; `npm run test:anticheat` ✅ 99. Navigateur
  (Playwright, clés données par `give-item.js` avec un DIM_ADMIN_TOKEN de test) : carte, clés 2 → 1 après lancement,
  salle en direct, HUD, Quitter, aucune erreur ✅.
- **Équilibrage** (à 3, 20 seeds, stuff seul) : fer 0/20 ; fer + acier 13/20 (9:56) ; acier 20/20 (9:50). Seul :
  impossible (jusqu'à 124 gobelins vivants). Le temps varie peu d'une partie à l'autre (± 15 s).
- **Points fragiles** : la durée est lue au chargement du module (`INSTANCE_TICKS`) ; l'IA vise toujours le même spawner
  pour tout le groupe ; les spawners sans limite de gobelins font basculer la partie d'un coup si le groupe est trop
  faible ; pas de récompense (summary.loot vide, bag vide).

### Roi Gobelin : coffre, objets, gobelins asservis, Four en or, recette Chitine (Geoffrey) — branche `geoffrey/roi-gobelin-objets`, ✅ en ligne le 27/10
- **Quoi** : `GOBLIN_KING` (config) : table du coffre, `thrall { radius:10, life:30, reach:6 }`. Objets `ITEMS` :
  « Coffre du Roi Gobelin R1-R7 » (`chest:{ side:'goblin', q }`, `treasure:true`, Unique), « Four en or BP », « Recette :
  Chitine » (cat blueprint) ; `STUFF.items` : Couronne (`set.goblinThrall = 10`, fortune 10), Masse, Cape royale (tier 3
  dans `UPGRADE.tiers`). `STATS.goblinThrall = 0` (nouvelle stat, libellé, aide du wiki).
  - Coffre : `openGoblinChest` (`src/meta/loot.js`) ; `rollLoot(table, rng, skip)` : un objet `learnOnce` déjà appris
    ne sort pas (le tirage ne donne rien, pas de nouveau tirage). Stuff sorti : `slot.q = q` (identifié). Nom affiché :
    `itemName` lit `GOBLIN_KING.chest` pour side 'goblin'. Une annonce Discord R7 part comme pour un trésor de tour.
  - Four : `FURNACE.recipes['Peau de gobelin'] = { out:'Chitine', qty:5, time:60, unlock:'Recette : Chitine' }` ;
    `recipeOf` accepte un non-minerai ; `accepts(slot, item, mode, inv)` refuse une recette fermée pas apprise
    (`inv.unlocked` contient « Four : Chitine », mis par `learn` via `recipeOfBlueprint`) ; `qty` par fournée.
    **Corrigé au passage** : `sanitizeFurnaces` effaçait à la relecture un ingrédient non-minerai posé et une sortie qui
    n'est pas un lingot (la chitine) → relu sans l'inventaire (`recipeOf`) et sortie = toute sortie de recette. Et
    `deserialize` (`src/meta/inventory.js`) ne gardait dans `unlocked` que les recettes du Craft : « Four : Chitine » était
    perdu à l'enregistrement (recette consommée pour rien) → gardé aussi (`FURNACE_UNLOCKS`), test ajouté.
  - 3e four : `FURNACE.tiers[2] = Four en or ×1,5`, `unlockItems['Four en or'] = { slot:2 }`, recette dans `src/recipes.js`.
  - Asservis (`src/sim/thrall.js`) : `spawnMobs` (mobs.js) envoie un gobelin né à `goblinThrall` cases (cercle) d'un porteur
    sous terre vers `G.thralls` (pas dans `G.mobs` : aucun code de combat ne le voit). `updateThralls` (session.tick, après
    les mobs) : prise (golem), chute, cible = meilleur minerai à `reach` (Manhattan) par `targetVal(porteur)` / (distance +
    temps + 1), pas un minerai visé ou miné par un mineur ; il creuse droit (axe le plus long), temps = dureté /
    STATS.mineSpeed, pas = 1 / STATS.speed ; bloqué : minerai abandonné (`skip`). Bloc cassé → `G.chest` + `G.goblinChest`
    (+ déblocage d'area pour un minerai). Sans hasard. `thralls` gardés dans le k hole (WORLD) ; vue : `thralls`,
    `goblinChest` ; rendu : gobelin doré + couronne ; HUD : ligne « 👑 Gobelins asservis » sous le coffre.
  - Lampe à incandescence ajoutée au tier 2 de `UPGRADE.tiers` : `tests/rune.test.js` échouait déjà sur `main` (« sans tier »).
  - Textures (6 icônes, 4 calques de skin) dans `scripts/gen_textures.py`, branchées dans `src/skins.js`.
- **Tests** : `tests/goblin-king.test.js` (7 : objets, coffre R1-R7, seuils et fréquences, qualité, recette une seule fois,
  four Chitine + relecture, Four en or), `tests/goblin-thrall.test.js` (8 : porteur, minage, temps, creuse, laisse la cible
  d'un mineur, disparition, chute), `tests/anticheat/goblin-king.test.js` (2) ✅ ; furnace, craft, loot, stuff, rarity
  (couronne légendaire…), wiki, rune, research, mobs, golem, khole, session, view, share… ✅ ; anticheat ✅.
- **Simulation** (`--miners 3 --count 5`, 1er mineur avec `--crown`) : 0 blocage ; coffre 4 140 → 4 578 pods (+11 %),
  areas 3,0 → 3,2, profondeur 182 → 196 ; ≈ 12 gobelins asservis, 86 blocs, 184 pods par session (le reste du gain :
  fortune +10 et gobelins qui ne volent plus).
- **Points fragiles** : le boss n'existe pas (coffre seulement par l'admin) ; `--crown` ne met que la stat et la fortune
  (pas le stuff complet) ; un asservi peut casser le bloc qu'un mineur traverse (le mineur finit son action sur du vide,
  sans effet).
- **Vérifié dans Chromium** (Playwright, serveur local) : coffres donnés par l'admin et ouverts, recette apprise puis
  proposée au four (« Peau de gobelin 10 → 5 Chitine »), 3e four sous cadenas « Four en or » ; en mode dev ×300 avec la
  couronne portée : skin de la couronne, journal « Un gobelin s'incline… » puis « …disparaît », ligne « 👑 Gobelins asservis »
  du coffre ; aucune erreur de page ✅.
- **Ajout (Geoffrey, 15 h)** : famille `scroll` dans `GOBLIN_KING.loot` (Ulti shen 0,01, Fast learner 0,005, Cleave 0,01,
  Hand of Justice 0,01, `spellOnce`). `openTreasure` / `openAll` prennent un 5e argument `ctx = { spells }` (sorts appris) ;
  le serveur (`game.open`) relit `loadSpells(me.id).learned` et le passe. Un sort appris tiré = rien (comme la recette).
  Tests : goblin-king +1 (seuils, sort appris, fréquence 3,5 %), anticheat +1 (serveur : 400 coffres, tous les sorts
  appris → aucun parchemin) ✅. Merge de `main` (Instances) : journaux, wiki, état gardés des deux côtés ; `rarity.test.js`
  ne connaissait pas la Clé d'instance I (inhabituel) et échouait sur `main` → ajoutée.
- **Lien Instance I (15 h)** : `INSTANCE.list[0].chest = 'goblin'`. `settleWith` (`server/game/service.js`) : instance
  réussie → `share.bag = { goblinChestItem(rollChestQuality(random)) : 1 }` pour chaque joueur encore présent (le butin de
  la partie est ignoré) ; échec → `share.bag = { clé : 1 }` pour TOUS les joueurs de la session, partis compris (le
  versement ne saute plus les partis quand `refund`) ; `creditSession` garde l'idempotence. Bilan (`showInstanceEnd`) :
  « 🎁 Tu reçois : … » / « Ta clé t'est rendue ». Lobby : bouton Instances jamais grisé (Lancer l'est en session) ; carte :
  « rendue si le groupe perd », « Roi vaincu : un Coffre… ». Confirmation de départ mise à jour.
  Tests : instance-server +2 (victoire : coffre R1-R7 au présent, rien au parti, clés consommées ; échec : clé rendue à
  tous, fin rejouée sans double) et 2 attentes changées (clé rendue à l'échec), lobby (bouton en session) ✅ ; instance-*,
  goblin-*, wiki, rarity, game-service ✅ 111 ; anticheat ✅ 102. État : ✅ en ligne le 27/10.

### Wiki : objets secrets (Geoffrey) — branche `geoffrey/wiki-secrets`, ✅ en ligne le 27/10
- **Quoi** : `WIKI.secret` (config) = Couronne, Masse, Cape royale du Roi Gobelin. Serveur : `markFound` (service de jeu)
  à l'ouverture d'un coffre ou d'un trésor (`open`, hors demande rejouée) et au versement d'une fin de session
  (`settleWith`) ; ns `discovered` (clé = objet, `{ at }`, écrit une seule fois) ; `adminGive` ne marque rien. Route
  publique `GET /api/wiki` → `{ secret, discovered }`. Wiki : `src/wiki/data.js` (`setDiscovered`, `isHidden`,
  `HIDDEN_TEXT` ; `statsOf` renvoie le texte caché ; `statRows` retire les objets cachés et les stats qu'on ne trouve que
  sur eux), `src/wiki/wiki.js` (fetch au chargement, 2,5 s au plus ; sans réponse : tout reste caché ; `[data-secret]`
  dans wiki.html remplacé).
- **Tests** : `tests/wiki-secret.test.js` (3) ; `tests/wiki.test.js` adapté (toutes les stats une fois tout trouvé) ✅ ;
  game-service, loot, treasure ✅ ; anticheat ✅ 102. Navigateur : texte et tableaux cachés, stat asservis absente,
  aucune erreur ✅.
- **Points fragiles** : pas de rattrapage : un objet trouvé avant cette mise en ligne (≈ 15 h → 15 h 30) reste caché
  jusqu'à la prochaine trouvaille ; un objet ajouté plus tard n'est caché que si on l'ajoute à `WIKI.secret`.

### Clé d'instance I à 20 % (Geoffrey) — branche `geoffrey/cle-instance-20`, ✅ en ligne le 27/10 ⚠️
- **Quoi** : `LOOT['Treasure T3']`, famille `key` : 0,05 → 0,20 ; textes du lobby, wiki, GAME_DESIGN, état.
- **Tests** : ⚠️ **pas relancés** (demande de Geoffrey). `tests/instance-key.test.js` vérifie probablement 5 % : à mettre à 20 %.

### Runes : couronne au tier 4 (600 x) (Geoffrey) — branche `geoffrey/roi-gobelin-tiers`, ✅ en ligne le 27/10
- **Quoi** : `UPGRADE.tiers[4] = { x:600, items:['Couronne du Roi Gobelin'] }`, couronne retirée du tier 3 (masse, cape restent
  au 3). `lineBase` lit déjà `UPGRADE.tiers[t].x` : aucune autre logique. Tier 3 = 400 x (Geoffrey pensait 450 : inchangé).
- **Tests** : rune (valeurs des tiers), goblin-king (tier des 3 pièces) ✅.

### K hole : tout le monde se bat dans l'arène et les vagues (Geoffrey) — branche `geoffrey/fix-khole-arene`, ✅ en ligne le 27/10
- **Signalé** : seed 2026520156, vers 7-9 min, un joueur ne tape pas le minotaure dans le k hole (arène).
- **Cause** : réglage « Face aux mobs » sur Ignorer / Fuir respecté dans l'arène (choix du 25/10, test « réglage
  respecté ») ; les minotaures ne chassent que `G.miners[0]` (`addMob`, `hunt`), donc ce mineur n'est jamais taclé et
  reste « Plus rien à explorer ». Reproduit : Vert sur Ignorer → 0 dégât, Rouge + Bleu 1 485 / 2 000 en 120 s, arène ratée.
- **Quoi** : `KHOLE.maps` arene et vagues : `allFight:true` ; `src/sim/ai.js` (engagement) : `fightMobs===true ||
  G.khole?.map.allFight`. Filons : inchangé.
- **Tests** : `tests/khole.test.js` : le test « réglage respecté » remplacé (Ignorer et Fuir viennent se battre), groupe
  avec un Ignorer qui gagne l'arène avant le compteur, allFight sur arene / vagues et pas filons ; les 2 premiers échouent
  sans la correction ✅ 24/24. Seed 2026520156 rejouée : 670 / 665 / 665, arène gagnée en 108 s quel que soit le réglage
  de Vert ✅.
- **Point fragile** : les minotaures et les mobs des vagues chassent toujours le premier mineur (`hunt = miners[0]`) ;
  sans incidence ici, à revoir si une salle doit répartir les cibles.

### Barre d'argent et pépites d'argent du Bloc géant (Geoffrey) — ✅ en ligne le 27/10
- **Quoi** : `FURNACE.recipes['Pépite d\'argent']` → `Barre d'argent` (10 + 10 charbon, 60 s, sans `unlock`) ;
  `ITEMS['Pépite d\'argent']` (material, écrit en clair : `GIANT` est défini après `ITEMS`, cohérence vérifiée par
  `tierItemsKnown`) ; `GIANT.nugget = { item, per:100 }`. `src/shared/giant.js` : `nuggetsFor(points)` (floor, 0 pour
  NaN / négatif / Infinity / texte), `playerRewardFor(total, points)` = paliers + pépites. `server/giant/service.js`
  `pendingRewards` : `playerRewardFor(d.total, d.scores[account].points)` ; un jour sous le 1er palier donne quand même
  les pépites. Même condition qu'avant (`earnsReward` : 2 visites depuis le 27/10), même idempotence (`p.claimed`).
  `info()` renvoie `nugget: { item, per, n }` (carte du Lobby : « + 1 Pépite d'argent par 100 de tes points : N »).
  Textures `nugget_silver`, `ingot_silver` (`gen_textures.py`). Wiki : source de la pépite (`sourcesOf`), texte du Bloc géant.
- **Rétroactif** : les jours finis mais pas encore réclamés (26/10…) donnent aussi leurs pépites à la réclamation.
- **Tests** ✅ : `giant-rules` (nuggetsFor, playerRewardFor, valeurs invalides), `giant-service` (paliers + pépites,
  une seule fois, sous le 1er palier : pépites seules, 99,9 points : rien, 1 visite le 27/10 : rien même à 500 points,
  carte), `furnace` (25 pépites → 2 barres, recette ouverte de base) ; wiki, rarity, shiny, treasure : 141/141 ;
  `npm run test:anticheat` 102/102.
- **À vérifier** : pas testé dans le navigateur (carte du Bloc géant, icônes). La barre n'a aucun usage.

### Mode dev : presets de personnage par spé (Geoffrey) — branche `geoffrey/presets-dev`, ✅ en ligne le 27/10
- **Quoi** : `scripts/dev-presets.js` (`npm run dev:presets`, options `--keys`, `--password`) : un compte par arbre de
  `SKILLS.trees` (`PRESET.names`), créé par `createAccountService().register` sur le file store, sinon remis à neuf
  (`putProgress` + `putLoadout` : inventaire, stuff, skills, sorts, sets écrasés ; mot de passe gardé). Refuse de tourner
  si `DATABASE_URL` est présent (local seulement ; `DIM_DATA_DIR` respecté). `buildPreset` est pur : stuff équipé par
  `stuffOp` (vrais uid), arbre via `sanitizeSkills`, sorts `unlock.tree` de la spé dans les `openSlots`.
- **Niveau** : `maxStorableLevel()` = 72 (XP du niveau 73 > `Number.MAX_SAFE_INTEGER`, `sanitizeProgress` la remettrait
  à 0). Demandé : 100, impossible sans changer le stockage de l'XP. Même XP pour la spé (`specCurve` = `curve`).
- **Tests** : `tests/dev-presets.test.js` ✅ 5/5 (tout repasse les sanitize du serveur, clés invalides refusées).
  Vérifié de bout en bout ✅ : serveur dev sur données temporaires, connexion Test_Barbare, `/api/game/state` = niveau 72,
  spé barbare 72, 6 pièces acier, 5 clés (`--keys 5`), arbre 12/12, sorts dash + war_cry. Script lancé deux fois (création puis
  remise à neuf) ✅.
- **Point fragile** : si un nouvel arbre arrive sans entrée dans `PRESET.names`, son compte s'appelle `Test_<id>`
  (tronqué à 16 caractères).

### Presets : glyphes + preset au choix pour les mineurs de test (Geoffrey) — branche `geoffrey/presets-dev`, ✅ en ligne le 27/10
- **Quoi** : logique pure déplacée dans `src/shared/dev-presets.js` (`buildPreset`, `presetMiner`, `sanitizeBotPresets`,
  `maxStorableLevel`), noms / stuff / clés dans `DEV_PRESETS` (`src/config.js`) ; `scripts/dev-presets.js` ne garde que
  l'écriture des comptes. Glyphes : tous ceux des nœuds de l'arbre (`GLYPHS.items`), posés dans `skills.glyphs` (actifs :
  arbre au max) ; le mineur de test les a aussi en `glyphsOwned` (pas de drop d'un glyphe déjà là).
- **Session** : `record.botPresets` (arbre ou null par mineur de test ; serveur : `dev ? sanitizeBotPresets(body.botPresets) : null`).
  `minerSpecs` (`src/shared/game.js`) : pour un mineur de test avec preset → nom, look, gear, skills, sorts, auras, owned du
  preset ; `devSpecs[i]` reste prioritaire sur les skills. Le record ne stocke que l'arbre : `presetMiner` est recalculé à
  la reconstruction (déterministe ; changer `DEV_PRESETS` change le rejeu d'une vieille session dev).
  Lobby : `#devPresets` (un menu par mineur de test, `GAME.maxPlayers − 1`), envoyé dans `botPresets`.
- **Tests** : `tests/dev-presets.test.js` ✅ 9/9 (glyphes actifs, mineur de test avec preset et sans, devSpecs prioritaire,
  serveur dev / normal). dev-spec, glyphs, game, tower : 146/147 ; l'échec « lobby, mode dev : les tours sont toujours
  dans Où miner » (`tests/dev-spec.test.js:75`) **échoue aussi sur main sans ce chantier** (la liste attendue n'a pas
  `instance_1` ni `giant`) ⚠️ à corriger à part.
  De bout en bout ✅ : serveur dev sur données temporaires, Test_Mineur + 2 mineurs de test (logisticien, barbare) →
  `/api/game/view` : Test_Mineur / Test_Logisticien / Test_Barbare, acier, sorts de chaque spé.

### Buff de l'acier : 500 x, tier 3 des runes à 500 x (Geoffrey) — branche `geoffrey/acier-500`, ✅ en ligne le 27/10
- **Quoi** (`src/config.js`, `STUFF.items`) : +100 x par pièce au GS (`UPGRADE.worth`) : casque oxygène 100 → 125 (500),
  jambes montée 1,6 → 2 (500), bottes marche 1,67 → 2,08 (499), plastron pods 120 → 137 (822), pioche minage 0,5 → 0,58
  (754 ; 0,577 serait arrondi à 0,58 en session de toute façon : `carac.mineSpeed` au centième), épée dégâts 16 → 18,5 (540).
  `UPGRADE.tiers[3].x` 400 → 500 (choix de Geoffrey : lignes de rune / identification de toutes les pièces T3 +25 %,
  y compris déjà posées, gardées en %). Texte de l'onglet Amélioration (`src/ui/upgrade.js`), wiki (texte des tiers).
- **Tests** : steel-gear (valeurs du catalogue, « ≈ 500 x »), rune (tiers, ligne du Plastron de l'équilibre 16 → 20 pods),
  stuff-balance (libellé) mis à jour ; stuff-balance, rune, steel-gear, gearscore, goblin-king, stuff*, wiki, modulation ✅ 67/67.
- **À vérifier** : modulation des tours (`TOWER.modulation.gsMax`) : un stuff acier complet gagne ≈ 600 GS ; si le plafond
  était calé sur l'ancien acier, il laisse passer moins de joueurs. Pas de simulation lancée (valeurs de config seulement).

### Fin de session : profondeur max d'après la descente mesurée (Geoffrey) — branche `geoffrey/fix-fin-treuil`, ✅ en ligne le 27/10
- **Signalé** : à ~5 min de la fin, les mineurs minent plus haut alors que le treuil est rapide. Rejeu de la session dev
  `109abdac` (seed 468608167, Test_Mineur + mineurs de test logisticien / barbare) : à 390 s de la fin, Test_Mineur repart
  avec `tripCap` 245 (front 338), mine à 200-245 jusqu'à la fin.
- **Cause** : `depthCap` = budget / (2,25 × `secPerRow`) : descente comptée = remontée mesurée, remontée × 1,25 en plus
  alors qu'elle est déjà mesurée. Mesuré sur 40 trajets de deux sessions : descente ≈ 75-80 % de la remontée (treuil /
  ascenseur dans les deux sens). Estimation ≈ +25 % trop haute.
- **Quoi** (`src/sim/ai.js`) : `m.secPerRowDown` mesurée par `trackDescent` (appelée dans `decide`) : du départ de la
  surface (`decideSurface`, `m.descentStart`) jusqu'à la profondeur de sa dernière remontée − 5 (`m.lastReturnFromY`,
  bornée par `tripCap`, ≥ 10 couches), abandonnée s'il repasse en retour / fetch. `depthCap` = budget / (descente +
  remontée), descente = remontée tant qu'elle n'est pas mesurée. Champs ajoutés à `SPOT` (`src/sim/khole.js`).
- **Tests** : `tests/end-depth.test.js` ✅ 3/3. Rejeu de `109abdac` : `tripCap` 245 → 320, mine à 310-318, tous remontés
  à temps ; coffre +4 diamants, +17 graphite, +1 Treasure T3, XP 5 418 → 5 471 ; `19860e4f` : XP 5 258 → 5 328.
  Simulation 5 sessions (mineurs de base) : 0 bloquée ; profondeur 182,4 → 185,2, coffre 4 140 → 4 105 pods (−0,9 %, en
  pods et non en valeur) ✅.
- **Point fragile** : une descente interrompue par un chantier (treuil du logisticien) peut être très lente (mesuré jusqu'à
  1,3 s/couche) : la mesure suivante la remplace ; dans ce cas l'estimation redevient prudente, comme avant.

### Instance : vitesses dev, recul des gobelins à chaque coup (Geoffrey) — branche `geoffrey/instance-dev`, ✅ en ligne le 27/10
- **Vitesses** : la barre `#inRun` n'avait ni `.speedBtns` ni `.pauseBtn` (le serveur gérait déjà `rec.clock` pour tous
  les modes, `renderSpeeds` et `setupRunControls` prennent toutes les barres) : ajoutés dans `index.html` (+ `.perfBox`).
  `tests/controls.test.js` vérifie la tour et l'instance ✅.
- **Recul** : `INSTANCE.goblin.knockChance` 0,30 → 1 (0,5 case vers le centre). Avant : 130 reculs sur 464 coups
  (5 instances), et 0,5 case depuis le centre d'une case ne change pas de case : presque invisible. `G.stats.gobKnocks`
  ne compte plus que les reculs appliqués (`pushMiner` ne pousse pas en plein pas). `tests/instance-sim.test.js` : taux de
  recul > 95 % ; le test des échelles des gobelins donne knockRes 100 à son mineur (sinon poussé du rebord) ✅ 25/25.
- **Difficulté** (`node scripts/simulate-instance.js --count 10 --size 3`, sans skills) : main : fer 0/10, fer + acier
  7/10 → 0/10, acier 10/10 → 3/10 ⚠️. Avec `geoffrey/acier-500` : fer + acier et acier 10/10 avec ou sans (9:16 → 9:21,
  8:57 → 9:07). À mettre en ligne ensemble.
- **Spawners** (27/10, Geoffrey) : `INSTANCE.spawner.every` 30 → 20 s. **Tests et simulation non lancés** (demandé : direct sur
  la version dev) ⚠️ : `tests/instance-sim.test.js` et `scripts/simulate-instance.js` à relancer avant la mise en ligne.
- **Suite** (27/10, Geoffrey) : `targetSpawner` : un côté entier puis l'autre (`G.targetSide`), le plus proche du groupe
  d'abord ; `INSTANCE.goblin.step` 0,9 → 0,45 (vitesse × 2) ; caméra rapprochée `INSTANCE.view` 14 × 11 qui suit le mineur
  (`src/render/instance.js`, comme `src/render/tower.js`). `tests/instance-sim.test.js` ✅ 12/12 (spawn lu dans la config).
  `simulate-instance --size 3`, avec le buff de l'acier : **0/10** fer + acier et acier (roi à ≈ 700 PV) ; spawn remis à
  30 s : 10/10 (gobelins × 2 compris). ⚠️ Mis en ligne sans réglage, à la demande de Geoffrey ; les tests de la version
  fusionnée n'ont pas été relancés (refusé).

### Anneaux améliorables avec un doublon ; boussole et torche hors Amélioration (Geoffrey) — ✅ en ligne le 27/10
- **Quoi** : config `RINGS.upgrade = 0.5` (points par niveau ajoutés à chaque valeur mult / add / xp), `UPGRADE.plainSlots =
  ['boussole', 'torche']`. `src/meta/piece.js` : `isPlain`, `canIdentify` (stuff hors anneau et plain), `canUpgrade`
  (stuff hors plain) ; `sanitizePiece` : anneau garde `plus` (1 à 9, sinon rien), boussole / torche → `{ item, uid }`
  (q, lines, plus, rune effacés à la relecture : remise à zéro voulue, sans remboursement, rune comprise).
  `src/meta/upgrade.js` : `nextLevel` d'un anneau = palier normal (même `chance`) avec `cost:{ anneau:1 }, dupe:true` ;
  `ringDupes` (autres exemplaires de l'inventaire, plus bas niveau puis plus petit uid) ; `upgrade` retire `ringDupes[0]`
  (enregistré `sacrificed` dans l'op, rejouée = rien de plus) ; erreur `plain` pour identify / upgrade / enchant.
  `src/meta/stuff.js` : `ringsOf` renvoie `[{ item, plus }]` (un par anneau, **plus haut niveau**), `withRings`,
  `ringXpPct`, `ringLines(item, plus)` acceptent noms ou `{ item, plus }`. Serveur : message `plain`, message « doublon »,
  `adminGive` avec qualité refusé pour boussole / torche (`canIdentify`). UI : liste de l'Amélioration avec les anneaux
  (coût « (doublon) », effet au niveau suivant, confirmation si le doublon sacrifié a un niveau) ; Identification et
  Enchantement sans anneaux, boussoles ni torches. Wiki : textes et `usesOf`.
- **Tests** ✅ : `tests/anneaux.test.js` (sanitize, erreurs, coût / chance, +0,5 par niveau, plus haut niveau, XP),
  `tests/anticheat/anneaux.test.js` (double clic = un doublon, anneau porté jamais pris, plus bas niveau sacrifié, sans
  doublon rien ne change, boussole / torche refusées sans rien consommer) ; stuff, wiki, lampe, boussole, gearscore,
  runes, MI, bloc géant : 150/150 ; `npm run test:anticheat` 104/104.
- **Point fragile** : la mine instantanée calcule les stats depuis `look` (noms seuls, `src/shared/instant.js`) : un
  anneau amélioré y compte au niveau 0, comme toute pièce améliorée (déjà le cas avant). Pas vu dans le navigateur.

### Minerais profonds : mithril, cobalt, thorium ; areas 7 et 8 (Geoffrey) — branche `geoffrey/minerais-profonds`, ✅ en ligne le 27/10
- **Quoi** : blocs 21 `Mithril ore`, 22 `Cobalt ore`, 23 `Thorium ore` (`BLOCKS`, `IDS`, `XP.ore`, `TEXTURES`,
  `RARITY.items` pour cobalt et thorium) ; `AREAS[6]` retouchée, `AREAS[7]` et `AREAS[8]` ajoutées (la 8 se répète).
  Les résidus (`JUDGMENT.pct` 0,5) sont pris sur la pierre à la génération : la config met donc 0,5 de plus en pierre
  que le tableau de Geoffrey (35 / 20,5 / 15,5 ↔ 34,5 / 20 / 15). Le reste suit tout seul : objets d'inventaire
  (catégorie ore, depuis `BLOCKS`), focus minerai (`ORE_KEYS` depuis `IDS`), tableaux du wiki. Ajouts à la main : couleurs
  du panneau d'area (`src/ui/hud.js`), `AREA_KEYS` (`src/wiki/data.js`), noms courts (`src/wiki/wiki.js`), textures
  (`scripts/gen_textures.py`, même motif que les autres minerais ; `textures/mithril|cobalt|thorium.png`).
- **Tests** : `tests/deep-ores.test.js` (nouveau : blocs, rareté, compositions = tableau − résidus, comptes exacts de
  `fillComp`, génération jusqu'à l'area 9) ; mis à jour : `graphite.test.js` (area 6), `wiki.test.js` (9 areas, 500
  minerais en areas 7-8, T3 au-delà), `rarity.test.js` (cobalt, thorium). ✅ deep-ores, graphite, world, wiki, rarity,
  focus, level, blocks, khole, instant-mine, session, lobby.
- **Anti-triche** : `npm run test:anticheat` 102/102 ✅.
- **Simulation** : 5 sessions de base inchangées (areas 3,0, profondeur 185,2, 0 bloquée ; personne n'atteint l'area 6) ✅.
  Script à part (pas dans le dépôt) : mineurs ×6 minage, ×3 vitesse, seuil de déblocage 15 % : areas 13, 0 blocage,
  coffre ≈ 170-250 mithril, 100-150 cobalt et thorium ✅ (2 seeds sur 5, coupé par le temps).
- **Points fragiles** : `AREAS[8]` n'a ni fer ni or : un focus « fer » ou « or » en area 8+ ne trouve rien et saute (comportement
  normal du focus). Pas de recette de four : `SHINY` ne s'applique pas à ces minerais. Le tableau du wiki affiche la pierre
  de la config (35 / 20,5 / 15,5), sans les résidus, comme pour les areas 4 et 5.

### Onglet Stuff : « Gobelins asservis (rayon) » cachée (Geoffrey) — ✅ en ligne le 27/10
- **Quoi** : `goblinThrall` retirée de `STUFF.shownStats` (src/config.js). La stat existe toujours (Couronne du Roi
  Gobelin, simulation inchangée) ; la bulle de la couronne et le wiki (caché tant que personne ne l'a trouvée) l'affichent encore.
- **Tests** ✅ : `tests/goblin-thrall.test.js` (absente de `minerStats`, couronne portée), goblin-king, wiki, wiki-secret,
  stuff, tier2 : 65/65.

### Tier 4 : Treasure T4, mithril, thorium, cobalt (Geoffrey) — ✅ en ligne le 27/10
- **Config** : `TREASURE.tiers` (T4 maxArea 8, T3 s'arrête à 6), `LOOT['Treasure T4']` (always + 1er jet BP 12,5 %, 4
  familles `learnOnce` à 5 %, gemmes 1 %), `FURNACE.recipes` Mithril / Cobalt / Thorium ore (`ore:5` pour cobalt et
  thorium), `FURNACE.alloys` Cobalt / Thorium ingot, `STUFF.items` (16 pièces), `UPGRADE.tiers` 4 = 650 x (Couronne
  comprise, avant 600) et `'4.5'` = 750 x (clé texte : `tierOf` renvoie 4.5), `DUNGEON.leather`, `SHARE.copyToAll`
  (+ Cuir de minotaure), `ITEMS` (Cuir de minotaure, Rotten flesh), `RARITY`, `TEXTURES` ; `src/recipes.js` (21 recettes).
- **Code** : `oreFor(r)` (src/meta/furnace.js) remplace `FURNACE.orePerIngot` partout (four, UI, wiki) ; minotaure :
  `src/sim/actions.js` tire le cuir après les cristaux (même `G.rng` : les parties d'après un minotaure changent) ;
  `src/meta/loot.js` : `learnOnce` aussi dans les Treasure TX ; `src/meta/craft.js` : `plainestFirst`, une pièce de stuff
  en ingrédient est prise sans qualité / niveau / rune d'abord (`takePiece`). Textures : 41 nouvelles (gen_textures.py :
  lingots, trésor T4, gemmes, armures et calques de skin mithril / thorium / cobalt, pièces spéciales) ; `src/skins.js`
  pour les 12 armures.
- **Stats** : prix du GS (`UPGRADE.worth` / `gs`), combat × 0,5 (`STUFF.combatOnStuff`) ; `knockRes` a un gs de 0 :
  calculée avec `UPGRADE.prices` (5 x par point), donc son GS est sous-évalué (Doc Martins, Ceinture golémique,
  Jambières). Plastrons × 1,644 (rapport de l'acier : 137 pods pour 500 x).
- **Tests** ✅ : `tests/tier4.test.js` (four, table, learnOnce, valeurs, craft le plus simple d'abord + rejouée,
  recettes), `tests/dungeon.test.js` (cuir 1 à 3, partage), anciens tests mis à jour (rune : tiers, treasure et wiki : T4
  en areas 7–8, rarity). Série large 315/315, `npm run test:anticheat` 104/104, simulation 5 sessions à 3 : 0 blocage
  (areas 3,0, profondeur 185).
- **À vérifier** : rien vu dans le navigateur (icônes, onglet Craft, fenêtre du four). Personne n'atteint encore l'area 7
  en simulation sans stuff : le T4 n'a pas été vu sortir d'une vraie partie.

### Correctif : Lancer / Inviter grisés pour le chef, tout le groupe prêt (Geoffrey, 27/10) — ✅ en ligne le 27/10
- **Cause** : le lobby (`setupLobby`, `st.account`) ne recevait le compte que par `showNoSession()` ou `accountUI.onChange`.
  Page ouverte pendant une session → `refresh()` → `enterSession` (pas `showNoSession`) ; à la fin, `showResult` ne fait
  que `lobby.update({ session:null })` → `st.account` reste null → `launchState` renvoie `{ can:false, label:'▶ Lancer la
  session' }` (et `inviteBtn` grisé) tant que le bilan n'est pas fermé. Le groupe, lui, s'affichait (pollLobby lit `acct`).
- **Correctif** : `src/main.js`, juste après `bootAccount` : `lobby.update({ account, offline })`.
- **Tests** : `tests/lobby.test.js` (+2 : ordre au démarrage vérifié dans le source de main.js ; chef + « prêt tout le
  temps » absent → « Lancer à 3 ») ✅ 17/17 ; boot-check, nav ✅. Repéré : un membre « absent » ne bloque pas le lancement.

### Classements dans l'onglet Social (Geoffrey) — ✅ en ligne le 27/10
- **Quoi** : sous-onglet « Classements » (`index.html` `#socialBoardTab`, `src/ui/social.js` : `BOARD_INFO`, `towerDetail`,
  `rankText`, styles `.lrow`/`.lrank`/`.lval` dans `style.css`). Route `POST /api/social/leaderboard { board }`
  (`server/social/routes.js`) → `social.leaderboard(me, board)` : classe (`rankBoard`) et met les pseudos ;
  valeurs brutes de tous les comptes par `game.leaderboardData()` (cache `LEADERBOARD.cacheMs` 15 s). Logique pure :
  `src/meta/leaderboard.js` (`BOARDS` = gs, xp, spec:<arbre>, tower ; `rankBoard`, `sanitizeTowerRecord`,
  `betterTower`, `towerTime`). Config `LEADERBOARD` (`src/config.js`).
- **GS** : `gearScore(sanitizeStuff(stuff, createInventory()).worn)` pour chaque ligne du ns stuff. **XP / spé** :
  `sanitizeProgress` de chaque ligne du ns progress.
- **Tour** : nouveau ns `tower_record` (clé = compte : `{ t, at, side, team, session }`), ajouté au chargement
  PostgreSQL (`createPgGameStore`), au fichier local (`snapshot`) et au commentaire de `server/db/postgres.js`. Écrit en
  fin de session (`settleWith` → `recordTower`) pour chaque joueur présent à une victoire (`!left && !hasLeft`), si
  plus rapide (strict), verrou par compte ; jamais pour `rec.dev`. `t` = `summary.t` (secondes de jeu, au dixième).
  Rattrapage une fois par démarrage du serveur (`backfillTowers`) : les sessions `done` de tour encore gardées (30 jours).
- **Tests** : `tests/leaderboard.test.js` (9 : logique pure, affichage, records via de vraies fins de tour, joueur parti,
  mode dev, rattrapage, GS/XP/spé, classement inconnu) ✅ ; social 18, game-service 48, postgres 6, dashboard,
  gearscore, lobby, nav, security, game-http, giant-service, account-http, boot-check ✅. Serveur lancé sur un
  autre port : la route répond (vide pour un invité neuf, `bad_request` pour un nom inconnu) ✅.
  ⚠️ L'affichage n'a pas été regardé dans un navigateur.
- **Points fragiles** : en mode dev, le classement de la tour reste vide (sessions dev exclues). Le calcul parcourt tous
  les comptes à chaque expiration du cache : à surveiller si le nombre de comptes devient très grand.

### Classements : comptes cachés (Geoffrey, 27/10) — ✅ en ligne le 27/10
- **Quoi** : `LEADERBOARD.hidden` (`src/config.js`, pseudos, `['admin']`) ; `social.leaderboard` retrouve leurs comptes
  (`findAccountByName(nameKey(n))`) et les retire **avant** `rankBoard` : ni ligne, ni rang, ni `total`. Les coéquipiers
  d'un record de tour (`team`, des pseudos) ne sont pas filtrés : « admin » peut encore apparaître dans « avec … ».
- **Tests** : `tests/leaderboard.test.js` (+1 : admin premier partout → absent des 4 classements, `me` null, total 1) ✅ ;
  social ✅ (28/28 avec leaderboard).

### Prix des stats : ajustements de Geoffrey (UPGRADE.priceAdjust) ; tier 4 recalculé — ✅ en ligne le 27/10
- **Quoi** : `UPGRADE.priceAdjust` (multiplicateurs des prix mesurés, choix de Geoffrey du 27/10) et `UPGRADE.priceBase`
  (`knockRes` : 5, pas de mesure) ; `statPrice(k)` exportée par `src/meta/gearscore.js` (worth ?? (gs || priceBase)) × adjust,
  utilisée par `pieceGS`. `STUFF.combatOnStuff` 0,5 → 1. `piece.itemValue` (ilvl du tableau de bord admin, base des lignes
  des pièces sans tier) garde `UPGRADE.worth` brut, sans ajustement. Pièces du T4 recalculées (cobalt, thorium jambes,
  Doc Martins, Ceinture golémique, Jambières) ; butin des mobs inchangé (÷ 2 et demi-valeur s'annulent : GS = 250 juste).
- **GS** : pioche en pierre / fer / acier 260 / 520 / 754 → 780 / 1 560 / 2 262 ; épées × 2 ; Lance 360 → 721 ; Plastron de
  l'équilibre 1 426 → 1 546 ; Masse 555 → 1 110 ; Cape royale 75 → 225. Le plafond de GS des tours (modulation) et les
  classements lisent ces valeurs.
- **Tests** ✅ : gearscore (prix ajustés, nouveau test des diviseurs), stuff-balance (combatOnStuff 1, prix ajustés),
  steel-gear (oublié au tier 4 : 4 trésors) ; `npm test` 1 201 / 1 204. ❌ hors sujet, déjà en échec sur `main` sans ce
  chantier : `tests/dev-spec.test.js` (« les tours sont toujours dans Où miner », mode dev) et `tests/perf.test.js` (boîte
  de mesures dans les barres).
- **Point fragile** : `npm run weights` / `stat-values` mesurent des prix bruts : appliquer `priceAdjust` par-dessus et le
  dire dans le rapport (consigne de Geoffrey).

- **Mise à jour (27/10, demande de Geoffrey)** : les stats des pièces du T4 ne sont PAS recalculées avec les prix ajustés :
  ce sont les valeurs de la première version **divisées** par le diviseur de la stat (dégâts 7,7 → 3,85, dégâts % 93,8 →
  31,3, double attaque 23,4 → 11,7, critique 14,4 → 7,2, perçage 53,6 → 13,4, minage ÷ 3, ténacité 32,5 → 16,25, recul
  ÷ 3). Conséquence : le GS de ces pièces (prix ajustés) est sous la valeur de leur tier (thorium ≈ 563, Doc Martins 325,
  Gants de boucher 320) ; voulu tel quel.
- **Secrets du wiki et Discord** : `WIKI.secret` + 8 pièces thorium / cobalt et les 5 pièces spéciales ; `markFound(items,
  who)` (server/game/service.js) : un BP dont la recette donne une pièce secrète (`BP_SECRET`) révèle la pièce ;
  `putDiscovered` renvoie `true` la première fois (server/game/store.js) → `shout(blueprintMessage)` (BP) ou
  `discoveryMessage` (la pièce elle-même : stuff du Roi Gobelin), stats par `statLines`. Fin de session et ouverture d'un
  trésor passent le pseudo. Tests ✅ `tests/wiki-secret.test.js` (premier BP : révélé + 1 annonce, le 2e : rien ; Roi
  Gobelin : une annonce par pièce, une fois) ; discord, game-service, tier4, gearscore, stuff-balance, leaderboard,
  steel-gear, treasure, wiki : 135/135 puis 68/68 ; `npm run test:anticheat` 104/104.

## 28/10/2026 — Geoffrey — GS au prix mesuré, ajustements réservés au dessin des pièces
- **Quoi** : `statPrice` (src/meta/gearscore.js) ne multiplie plus par `UPGRADE.priceAdjust` ; nouveau `designPrice` =
  prix mesuré × ajustement (utilisé par `tests/stuff-balance.test.js` pour vérifier les pièces dessinées à la valeur de
  leur tier). Demande de Geoffrey : « la stat ne bouge pas, juste la valeur x (GS) associée est divisée ».
- **GS** : pioches 780 / 1 560 / 2 262 → 260 / 520 / 754 ; épées fer / acier 720 / 1 080 → 360 / 540 ; Lance 721 → 360 ;
  Casque thorium 563 → 470, Plastron cobalt 1 234 → 823, Jambes thorium 563 → 438 ; Gants de boucher 320 → 160 ; Lanières
  250 → 188, Capuche 250 → 125, Ceinture du Géant 253 → 127. Armures sans stat ajustée inchangées (casque acier 500).
- **Tests** ✅ gearscore (prix bruts dans le GS, test des diviseurs via `designPrice`), stuff-balance (`designPrice`),
  tier4 inchangé ; `npm test` 1 203 / 1 205. ❌ hors sujet, déjà en échec sur `main` : dev-spec (tours en mode dev),
  perf (boîte de mesures).
- **Point fragile** : les records du classement Gear score sont recalculés à la lecture (pas de valeur stockée) : rien à migrer.

## 28/10/2026 — Table de recherche : tier 4 et recyclage (Geoffrey)
- `src/config.js` `RESEARCH.tiers` : recycle T2 30–45, T3 45–60 (avant 40–70) ; nouveau `{ tier:4, from:'Treasure T4', cost:250, recycle 60–75 }`.
  Pool T4 = 1re famille `blueprint` du Treasure T4 (`tierBlueprints` prend `.find`) : les plans `learnOnce` du 2e jet
  (clé, gemmes) n'y sont pas, et recyclés ils tombent sur le tier 1 (`tierOfBlueprint` → null).
- `server/game/service.js` `research` : `markFound([item])` après une recherche (plan secret du T4 → wiki + Discord).
- Tests : `tests/research.test.js` (config, test tier 4, tier inconnu = 5), `tests/tier2.test.js` (recycle 30–45).
  `node --test` research, tier2, tier4, wiki, wiki-secret, anticheat/research : 59/59 ✅.
- Étapes (même jour) : `RESEARCH.tiers[3].stages` (8 / 8 / 1). `researchStage(inv, t)` = 1re étape avec une recette non apprise ;
  `researchPool` d'un tier à étapes = son pool. `tierBlueprints` reste la liste complète (recipesLeft, recycle, wiki).
  UI : « Étape x / 3 : n plans possibles ». Test : les étapes couvrent exactement le 1er jet du T4 (garde-fou si on ajoute un plan au trésor
  sans l'ajouter à une étape). 61/61 ✅.

## 28/10/2026 — Bloc géant : la réclamation met l'inventaire à jour (Geoffrey)
- **Symptôme** : après « Réclamer », l'inventaire n'affichait les objets qu'après rechargement (ou « Trier », qui renvoie
  l'inventaire du serveur). « Il faut cliquer 2 fois » rapporté aussi.
- **Cause** : `POST /api/giant/claim` renvoyait déjà `inventory` (`game.giantGrant`), mais `src/ui/giant.js` l'ignorait.
- **Correctif** : `setupGiant` reçoit `onInventory(inv, reçus)` (main.js → `setInventory(inv, bag)` : objets mis en
  évidence + pastille d'onglet) ; bouton « Réclamation… » pendant l'appel ; la carte n'est reconstruite (innerHTML) que
  si son HTML change (un bouton remplacé entre l'appui et le relâchement perdait son clic : rare, carte rafraîchie toutes
  les 3 s).
- **Double clic** ⚠️ non reproduit : Playwright (Chromium headless, dev local, appui 120–150 ms, latence réseau simulée
  200–1 400 ms) : 1 clic suffit 3/3, 0 clic perdu sur 10. Piste restante : retour visuel absent → le joueur recliquait.
- **Tests** ✅ `tests/giant-service.test.js` (la réponse de claim contient `inventory.slots`) + giant-rules : 26/26 ;
  vérifié dans le navigateur : Treasure et Blueprint parts présents dans l'onglet Inventaire sans recharger.

## 28/10/2026 — Skills : 5e étage, maîtrises de la pioche, de l'épée et du bench (Geoffrey)
- **Quoi** : nœuds `pick_mastery` (mineur, 0,05), `sword_mastery` (barbare, 0,05), `bench_mastery` (logisticien, 0,03),
  row 5, max 3, clé `slot` (case du stuff). `slotMastery(effects)` (src/meta/skills.js) → `{ case: part }` ;
  `pieceBonus(entry, extra)` (src/meta/piece.js) multiplie comme l'amélioration (`plusMult × extra`, malus intacts, `set` :
  base + écart × m, roundStat) ; `statsOf(items, mastery)` / `equippedStats(items, mastery)` (src/meta/stuff.js) trouvent
  la case par `STUFF.items[item].slot`. Appelants : src/shared/game.js `caracOf` (mine, tours, instances, Bloc géant),
  src/shared/instant.js (MI), `minerStats` (onglet Stuff : l'apport passe dans la colonne skill). `behaviourSkills`
  ignore les nœuds à `slot`. Icônes pixel : hammer / trophy / heart (src/ui/skills.js).
- **Pas touché** : gear score (pieceBonus sans extra), `scripts/simulate.js` (ses arbres complets ne reçoivent pas la
  maîtrise : leur stuff vient des presets, à brancher si on veut la mesurer).
- **Tests** ✅ `tests/skills.test.js` (nouveau test : déblocage, textes, slotMastery, stats pioche / épée / torse, onglet
  Stuff, session) ; stuff, gearscore, instant, glyphes, upgrade, game : 178/178 ; wiki, sets, tours, Bloc géant,
  instances : 139/140, ❌ hors sujet `tests/dev-spec.test.js` (déjà en échec sur `main`).

## 28/10/2026 — Clé d'instance I : recette de base, plan retiré du Treasure T4 (Geoffrey)
- **Quoi** : src/recipes.js `unlock: null` ; src/config.js : `Clé d'instance I BP` retiré du 2e jet du T4 (LOOT) et
  déclaré à la main dans ITEMS (il venait de LOOT : sans ça, un exemplaire gardé ne serait plus un blueprint). Il ne
  s'apprend plus (`canLearn` : recette déjà ouverte) et se recycle au tarif du tier 1 (`tierOfBlueprint` → null).
- **Effet de bord** : le T4 fait un tirage de moins, la suite des tirages d'une ouverture change (sans conséquence).
- **Tests** ✅ `tests/instance-key.test.js` (nouveau : craft sans plan, plus dans le T4, ancien plan recyclé) ; craft,
  loot, tier4, treasure, rarity, research, wiki : 75/75 ; `npm run test:anticheat` 104/104.

## 28/10/2026 — Discord : seuil des annonces à R6 (Geoffrey)
- **Quoi** : `ANNOUNCE.minQuality` 7 → 6 (src/config.js). `treasureMessage` couvre déjà les coffres du Roi Gobelin
  (`treasure:true`, `chest.q`) : versés par la même boucle de fin de session que les trésors de tour (server/game/service.js).
- **Tests** ✅ `tests/discord.test.js` (R6 trésor, coffre du Roi Gobelin R6/R7, R5 rien ; identification R6) + instance,
  goblin : 63/63.

## 28/10/2026 — Geoffrey — Mur de chair (mob 1 × 6)
- **Quoi** : `src/sim/flesh.js` (naissance `fleshSpot`, pas `fleshStep`, passif `fleshAura`, `fleshSlow`, cases `G.flesh`
  refaites à chaque tick par `syncFlesh` qui relance `updateLight` si elles changent). Config `MOBS.chair`, lignes 6 à 8 de
  `MOBS.spawnTable`, `hpBase` 200, `minArea` 6, `speed` 0,5, XP 40, `noTrap`. (o.x, o.y) = case du BAS, `o.h` = 6.
- **Le mur** : `world.isAir` est faux sur une case de `G.flesh` (on n'y entre pas, on y tient, la lumière ne passe pas) ;
  `path.search` : `brk` refuse une case recouverte (et `t` à 0), la montée exige `isAir` ; `stepDir`, `mineBlock`,
  `breakBlock` refusent un bloc recouvert ; l'IA ne vise pas un minerai recouvert (boussole, connus, galeries) ; golem et
  gobelins asservis (`golem.breakable`) ne cassent pas un bloc recouvert. Il ne couvre jamais une case avec un mineur
  (ni en train d'y entrer), un donjon, un piège caché, le puits du treuil.
- **Combat** : `knock.nearCell` lit `e.h` (hauteur) ; `mobs.reachDist` (proie, laisse du tacle, poursuite), `ai.fight`,
  `goFight`, `nearestThreat`, laisse `foeLeash` : depuis sa case la plus proche pour un mob à `o.h`. Golem inchangé.
  Vitesse d'attaque × `fleshSlow(m)` dans `ai.fight`. Vue : `h` du mob, `flesh` (stacks) du mineur ; rendu
  `canvas.js` (texture 16 × 96, pulsation), compteur 🩸 sur le mineur (`miner-sprite.js`), icône `flesh_icon`.
- **Tests** ✅ `tests/flesh.test.js` 9/9 (config, naissance, mur, avance, attente sous le mineur, stacks + Ténacité, pas de
  recul, butin, combat IA) ; `goblin.test.js` (table à 9 lignes) ; combat, golem, khole, knock, mephite, mob-drops, mobs,
  path, trap, view, wiki, textures : verts.
- **Simulation** ✅ `--miners 3 --count 5 --skills mixed` : résultats identiques à `main` (aucun mur avant l'area 6), 0
  blocage. Stress (script hors dépôt : 35 % de murs dès l'area 1, 3 mineurs à 14 dégâts, 5 seeds) : ≈ 20 murs par session,
  presque tous tués, 0 blocage.
- **Points fragiles** : le navigateur recalcule la lumière sans `G.flesh` (affichage seulement : la lumière passe à
  travers le mur à l'écran). Un mineur seul à 5 dégâts ne tue pas un mur de 200 PV avant −90 % (voulu : ça pousse au jeu à
  plusieurs ; la soupape du tacle reste celle de tous les mobs).

## 28/10/2026 — Mine instantanée : composition avec mithril, cobalt, thorium (Geoffrey)
- `INSTANT_MINE.comp` : iron 27, gold 20, graphite 5, diamond 1, mithril 3, cobalt 1.5, thorium 1.5, **coal 40 en dernier**
  (genInstantMine coupe le dépassement d'arrondi sur la dernière clé : 37,5 → 38 cobalts et 38 thoriums, charbon 999).
  Graphite, diamant et plumes gardés (non cités par Geoffrey, total = 100).
- Wiki : composition triée par % décroissant, nombres formatés (`f`).
- Mesure (script ponctuel, 8 seeds, `runInstant`) : 3 joueurs, blocs/joueur 102 → 108, plumes 3,63 → 4,83, au fond 1/24 → 5/24 ;
  10 joueurs, 103 → 107, 2,95 → 3,11, au fond 31/80 → 29/80.
- `tests/instant-mine.test.js` : quantités exactes ; test de descente relâché `bottom <= n*0.35` (avant 0,15 ; 4/12 avec la
  nouvelle mine), choix de Geoffrey. 30/30 ✅. ⚠️ À surveiller : plumes par MI (+30 % à 3, mesure bruitée).

## 28/10/2026 — Sets : équiper pendant une session (Geoffrey)
- `server/game/service.js` `sets` : `session_running` seulement pour create / save (avant : equip aussi). Sûr car tout ce que la
  session utilise est figé au lancement (`rec.gear`, `rec.skills`, `rec.spells`, `looks`, glyphes `owned`) et la fin de
  session ne relit ni stuff, ni skills, ni sorts (vérifié par grep des load*/get* du serveur). Bloc géant : figé à l'entrée.
- `src/ui/sets.js` : Équiper actif en session (grisé seulement pendant une demande), message « compte dès la prochaine session ».
- Tests `tests/sets.test.js` : équiper en session → compte changé, `rec.gear/skills/spells` identiques ; panneau. 8/8 ✅.
- ⚠️ Pendant la session, une pièce retirée par le set revient dans l'inventaire : on peut l'améliorer ou la recycler alors
  que la session en cours utilise encore ses stats figées (pas de duplication : la session ne la rend pas à la fin).
  Le lobby (lecture seule) montre l'apparence et le GS du nouveau set pendant la session.

## 28/10/2026 — Tours du Jugement : 4 h (Geoffrey)
- `JUDGMENT.openHours` 6 → 4 (lu partout : meta/judgment, Lobby, Discord, wiki). `openUntil` est enregistré à l'ouverture :
  une tour déjà ouverte garde sa fin. Tests judgment, discord, game-service, wiki : 87/87 ✅.
- ⚠️ `JUDGMENT.salt` retiré par erreur puis remis dans le même commit : aucun test ne vérifie sa présence.

## 28/10/2026 — Tours du Jugement : niveau 2 (Geoffrey)
- Config `TOWER.levels` { 1 neutre, 2 : hp ×2, hard ×2, weight ×1,5, mobKnock ×2, rageBelow 0,5 }. Sim (`src/sim/tower/session.js`) :
  `G.level` / `G.lv` (`towerLevel` : inconnu → 1), PV boss et mobs (`placeMobs(…, hp)`), `mineT(G, m, t)` (exporté), `brickW`
  (sac et `bagFull`), recul des mobs, rage. `buildTower` lit `record.level` (ancienne session sans level → 1).
- Serveur : `body.level` ∈ TOWER_LEVELS (sinon bad_request), `rec.level`, `publicSession.level` ; `hasDone/markDone(j, side,
  account, level)` : niveau 1 = compte seul (rétrocompatible), niveau n = « compte:n » dans `done.accounts`. `publicJudgment` :
  `done` = tous les niveaux faits, `doneLevels`. `towerDone` (Who ?) : niveau 1 seulement.
- UI : `towerLevelState` + `#towerLevelRow` (lobby), titre et rage (HUD, rendu) selon le niveau, texte de la carte Jugement.
- Tests : `tests/tower-level.test.js` (nouveau), `game-service` (niveau 2 lancé, gagné, refusé ensuite), `judgment` (vue publique).
  166/166 ✅ sur tower*, judgment, game-service, discord, wiki, lobby, sets. ⚠️ Aucune simulation (demande de Geoffrey) :
  faisabilité du niveau 2 inconnue. Classement des temps (`recordTower`) : les deux niveaux sont mélangés.

## 28/10/2026 — Shrines (Geoffrey)
- Config `SHRINES` (liste, `drawX`, `opMemory`). Logique pure `src/meta/shrines.js` : sanitize, give (idempotent par opId,
  ne prend que ce qui manque), consume (au lancement), `oreBonusComp` (points de terrain → minerais au prorata), effets.
- Génération : `newSession(…, { shrines })` → `G.shrines`, `G.oreBonus` ; `genArea` applique `oreBonusComp` à `areaComp(k)`
  (k hole non touché : sa propre composition). `buildSession` lit `record.shrines` (ancienne session : aucun).
- Stockage : ns `shrine` (mémoire, fichier, PostgreSQL) ; `putShrinesAndInventory` écrit le don en une fois.
- Serveur de jeu : `shrinesOf`, `shrineGive(me, leaderId, body, code)` (verrous inv:donneur + shrine:chef), `partyCodeFor`,
  consommation dans `start` (mode mine hors dev, verrou shrine:chef) → `rec.shrines`, `publicSession.shrines`.
- Groupes : `create` et `formLobby` deviennent async (code gardé via `game.partyCodeFor`, re-vérifie après l'attente),
  `state.shrines` (chef du groupe ou soi), action `shrineGive` + route `POST /api/party/shrine`.
- UI : carte `#shrinesCard` (lobby, mine classique), `shrinesHtml`, dessin à la surface (`render/canvas.js`, colonnes
  `SHRINES.drawX`), texture `shrine_abundance` (gen_textures.py, seul fichier ajouté).
- Tests : `tests/shrines.test.js` (11), `tests/anticheat/shrines.test.js` ; liés (game-service, party, lfg, social, world,
  session, khole, view, lobby, live, wiki) 216/216 ✅ ; anti-triche 105/105 ✅ ; simulation 5 sessions sans shrine : 0 blocage.
- ⚠️ Pas de simulation avec le shrine (effet sur la profondeur et le coffre non mesuré). Le don pendant une session est permis.


## 28/10/2026 (11 h) — Tours : niveau 2 revu, invocation au saut, descente des mobs (Geoffrey)
- **Config** : `TOWER.levels[2]` hp 2 → 2,5, hard 2 → 1,75, `summon: 2` (niveau 1 : 0) ; `TOWER.mobs.descend: true`.
- **Sim** (src/sim/tower/session.js) : `summonMobs(G, n)` appelé par `startJump` : mobs sur `roof - 1`, `floor = TOWER.floors`,
  `summoned: true`, réveillés, colonnes tirées par `G.rng` hors de [bx − 1, bx + w]. `descendMob` (stepMobs, quand le mob
  n'a pas de proie) : un mineur dans la tour à un étage plus bas (`lowerMiner`) → glisse vers la colonne la plus proche de
  `holeCols` (porte du plafond de l'étage du dessous, ouverte), recentré, puis tombe au sol suivant ; `o.floor` change
  (la porte de son ancien étage n'attend plus ce mob : pas de blocage si les mineurs remontent). `mobDied` : message
  « porte ouverte » seulement pour un étage « mobs ». Le recul et la marche normale ne font jamais tomber un mob (mobFits).
- **Script** : `npm run simulate:tower -- --level 2`.
- **Tests** ✅ `tests/tower-level.test.js` (valeurs, invocation niveau 1/2, saut par la porte puis tacle, porte fermée : reste) ;
  tower*, judgment, game-service : 118/118. Simulation niveau 1 (compos du script, 6 seeds) : comme avant, 0 « bloqué ».
- ⚠️ À regarder en jeu : rendu du saut (glissade du navigateur sur 4 lignes), mobs invoqués pendant l'atterrissage.

## 28/10/2026 — GS : stats offensives au tableau des lignes (Geoffrey)
- `UPGRADE.gsFromPrices` (dégâts, dégâts %, vitesse d'attaque, double attaque, critique, coup unique, perçage ; portée et recul
  retirés à la demande de Geoffrey : prix mesuré) ; `gsPrice(k)` dans `src/meta/gearscore.js` ; `pieceGS` l'utilise.
  `statPrice` et `designPrice` inchangés (dessin des pièces, stuff-balance).
- Diff du GS des objets : Gants tactique 39→100, Lanières 188→285, Casque thorium 470→610, Jambes thorium 438→532, Casque
  cobalt 470→510, Lance en fer 360→330 (malus vitesse d'attaque à 5 x), autres +1 à 8 %. Classements GS et modulation suivent.
- Tests : gearscore, stuff-balance, tier4, mob-drops, rune, social, lobby ✅.

## 28/10/2026 — Sorts dans les tours ; rework de la Dynamite (Geoffrey)
- Config `SPELLS` dynamite : `hardMul: 3`, `dmg: 0.5`. Mine (`src/sim/spells.js`) : `dynamiteHard(m)`, `blastCells` filtre la
  dureté, `finishDynamite` touche les mobs `fair` du rayon (hitDamage × dmg, killMob).
- Tour (`src/sim/tower/session.js`) : mineurs avec `spells/spellCd/learned`, `G.inspire/G.warcry`, `mineT` avec Inspiration et
  Fast learner, `hitT/hitDmg` avec Cri de guerre, mobs étourdis (`stunUntil` dans stepMobs), `damageBoss` (refactor de hitBoss)
  et `damageMob` ; sorts : mineBuffs + dynamite (action `dynamite`, `blast`) au début d'un minage, combatSpells dans `strike` et
  avant un coup sur le boss, supportSpells au début de `decide` (Illumination, Hand of Justice, Ulti shen), Dash vers un mob
  sur sa ligne. Dynamite : jamais le toit, dureté × niveau de tour. Zipette : jamais (pas d'oxygène).
- Instance (alignée, même jour) : `mineSpells` casse la cage seulement si `cageHard < dynHard(m)`, `blastHurt/blastDamage` (gobelins et roi
  du rayon, 50 %) aussi sur un spawner (toujours 6 coups). Test de scénario « cage » non retenu (un mineur seul ne mine pas sa cage
  dans ce montage). ⚠️ `npm run simulate:instance` donne 0/10 partout, même en acier (sans sorts : pas lié à ce changement ; le
  repère de l'état du projet dit acier 20/20 à 3) : à vérifier.
- Tests : `tests/tower-spells.test.js` (4), `tests/spells.test.js` (Dynamite 28/10) ; tower*, spells, instance*, game-service,
  khole, session, wiki 199/199 ✅. Simulation mine 5 sessions avec dynamite + fast_learner : 0 blocage. Tour 12 parties à 3
  avec sorts : 0 blocage, ≈ 16 sorts par partie, victoires 1/12 comme sans sorts (équipe de test faible).

### Événements qui rétrécissent / grandissent en boucle sur téléphone (Jules) — branche `jules/fix-canvas-mobile`, ✅ en ligne le 28/10
- **Cause** : suite de l'entrée du 22/10 (mine), non vérifiée alors pour les autres écrans. Sur téléphone
  (≤ 700 px), `.runGrid.mi` passe en colonne flex ; `#cvMiWrap`, `#cvTwWrap`, `#cvInWrap`, `#cvGtWrap` (base flex
  `auto` = hauteur du canvas, min-height 0) et l'`aside` se partagent la hauteur de `#miRun` / `#twRun` / `#inRun` /
  `#gtRun` (fixes) au prorata de leur contenu. La boîte dépendait donc du canvas, et `fitCanvas` / `fitInstant` se
  calaient sur elle → dérive à chaque appel, et saut quand le journal (aside) grandit. Sonde navigateur (vrai CSS,
  fit.js appelé toutes les 30 ms, journal qui grandit à mi-parcours) : 360×740, tour 87 → 24 px de large, 10 à 28
  tailles différentes en 1,2 s selon l'écran ; ordinateur stable.
- **Correction** : `src/ui/style.css` : `#cv,#cvMi,#cvTw,#cvGt,#cvIn` en `position:absolute` centré (la boîte ne
  dépend plus jamais du canvas ; `#cv` repasse `static` sur téléphone, page qui défile, lignes fixes) ; téléphone :
  boîtes des événements `flex:0 0 60%`, `aside` `flex:1 1 0` + `margin-bottom:var(--dock-h)!important` (avant, elle
  passait sous la barre d'action). `src/ui/fit.js` : `boxHeight(cv, box)` partagé par `fitMine`, `fitInstant`,
  `fitCanvas` : hauteur de la boîte seulement si le canvas est en `absolute`, sinon 0 (ligne fixe / calage largeur).
- **Tests** : `tests/fit.test.js` +4 (boîte qui suit le canvas : tours/instance/géant et MI stables, échouaient
  avant ; hauteur imposée : tient dans la boîte, stable) ; fit, instant-ui ✅. Navigateur (playwright, Pixel 7) :
  sonde 393 / 360 / 430 px, paysage 852×393, 1024×768, 1400×900 → 1 seule taille par écran ; tailles ordinateur et
  tablette identiques à avant (MI 1024×640, tour 242×646, instance 914×609, géant 975×609 à 1400×900). Vraie Tour de
  l'Ange en dev à 393 px : 380×277 fixe, aside au-dessus de la barre ; vraie mine 393 px 381×259 fixe, 1400 px 792×633
  (comme avant).
- **Piège de vérification** : `goto` vers la même page avec un autre `#` ne recharge pas → ancienne feuille de style ;
  faire `reload()`.

### Pop-ups qui restent tant qu'on ne clique pas (Jules) — branche `jules/notifs-auto`, ✅ en ligne le 28/10
- **Cause** : `src/ui/notify.js` n'avait aucun délai (une pop-up partait seulement après un clic ou quand le serveur
  cessait de l'envoyer) ; `src/ui/instant-lobby.js` `notice()` fermait les rappels MI après 12 s **sauf** celui avec
  Rejoindre / Décliner (`invite`), qui restait même après l'ouverture de la mine.
- **Correction** : `NOTIFY = { popupMs:20_000, noticeMs:12_000 }` (`src/config.js`). `setupNotify(root, ttl)` : minuterie
  par pop-up (`el._t`) ; à l'échéance `expire(key)` la met dans `done` (ne revient pas tant que le serveur envoie la
  même clé) ; si `busy` (action en cours), repoussée d'un ttl. `noticeTtl(s, invite)` : `noticeMs`, ou `s × 1000` pour
  l'invitation (fermée à l'ouverture). Clé des invitations de groupe = `p:<code>:<at>` : `invitesOf` (server/party/
  service.js) renvoie maintenant `at` (mis à jour à chaque nouvelle invitation), sinon une invitation renouvelée après
  expiration ne réapparaissait pas. Demande d'ami : clé `f:<id du demandeur>` inchangée (une seule demande en attente par
  paire ; elle reste visible dans l'onglet Social, pastille comprise).
- **Tests** : `tests/notify.test.js` (nouveau, faux DOM + `t.mock.timers`) : fermeture à popupMs, pas de retour, retour
  si nouvelle clé ou si oubliée puis renvoyée, action en cours qui repousse ; `noticeTtl`. notify, instant-ui, social ✅.
  ⚠️ Pas vérifié dans un vrai navigateur.

### Bulles d'aide « ? » (Jules) — branche `jules/aide-bulles`, ✅ en ligne le 28/10
- **Quoi** : `src/ui/help.js` (nouveau) : `HELP` (textes des pages fixes, 1re ligne = titre, chiffres du Four et du
  Concasseur lus dans la config), `qhelp(texte, label)` / `helpLine(texte, label)` (HTML d'une bulle, pour les écrans
  construits par le code), `fillHelp()` (remplace les `<i data-qhelp="clé">` d'`index.html` ; clé inconnue = console +
  retirée). Bulle = la bulle commune `src/ui/tooltip.js`, avec `data-tipkind="help"` → `#tip.help` (texte clair, plus
  large) ; un clic souris sur un « ? » le garde ouvert (avant : tout clic souris fermait la bulle) ; ouverture au
  focus clavier (`focusin` / `focusout`). Style `.qhelp`, `.helpLine`, `.nextNote` dans `src/ui/style.css`.
- **Bandeau « prochaine session »** : `<p class="nextNote">` en haut de Stuff, Skills, Sorts, caché par CSS sauf
  `body.inSession` ; classe posée par `sessionFlag()` (`src/main.js`) aux trois endroits où `rec` change
  (`enterSession`, `showNoSession`, `showResult`, à côté de `setsUI.refresh()`). ❌ **Cassait toute la page en
  session** (`.inSession` = bandeau du lobby) → renommée `body.sessionOn`, voir « Correctif : page déformée en session ».
- **Textes déplacés** : `index.html` (≈ 20 paragraphes et sous-titres → `data-qhelp`), `src/ui/lobby.js` (phrase des
  shrines : seulement la ligne « Shrines de X (chef) » reste ; clés d'instance → `qhelp`), `src/ui/upgrade.js` (3
  paragraphes → `helpLine`), `src/ui/instant-lobby.js` et `src/ui/giant.js` (règles → `helpLine(…, 'Règles')`),
  `src/ui/social.js` (`#boardHelp` passe dans le titre du classement). Four / Concasseur : boutons `.fhelp` renommés
  « Recettes » / « Butin ». `#teamTitle` et `#boardTitle` sont maintenant des `<span>` dans leur `<h2>`.
- **Tests** : `tests/help.test.js` (nouveau, 6) : chaque `data-qhelp` a son texte et inversement, format titre + lignes,
  échappement de `qhelp`, chiffres de la config, bandeau dans les 3 onglets et plus de paragraphe permanent, anciens
  sous-titres partis. help, nav, shrines, sets, lobby, social, instant-ui, giant-rules, research… ✅.
  ⚠️ **Échecs déjà présents sur `main`, sans lien** (vérifiés avec `git stash`) : `tests/perf.test.js` « la boîte de
  mesures… » (3 `perfBox` au lieu de 2 : l'instance en a ajouté une) et `tests/dev-spec.test.js` « lobby, mode dev :
  les tours sont toujours dans « Où miner » ».
- **Navigateur** (playwright, serveur local déjà lancé) : 23 « ? » remplis, 0 restant ; bulle de la Recherche au
  survol ✅ ; bandeau Skills avec `body.inSession` ✅ ; bulle du Four au toucher à 390 px ✅. Pas vérifié : une vraie
  session (bandeau posé / retiré par `sessionFlag`), les bulles construites par le code (amélioration, MI, Bloc géant,
  instances) affichées pour de vrai.
- **Point fragile** : un texte de `HELP` qui cite une règle (oxygène, pods, recherche, skills) doit suivre
  `GAME_DESIGN.md` si la règle change : c'est écrit à la main.
- **Correctif (même jour)** : dans Stuff, le `.nextNote` devenait une case de la grille `.furnWrap` et décalait tout →
  `grid-column:1/-1` comme `.invHead`. Vérifié en vraie session (invité local) : Stuff, Skills, Sorts ✅.

### Guide « Premiers pas » (Jules) — branche `jules/aide-bulles`, ✅ en ligne le 28/10
- **Quoi** : `src/ui/guide.js` (nouveau). `GUIDE_STEPS` (7 étapes : launch, loot, smelt, craft, equip, skill, research ;
  chacune un onglet, un titre, une aide, une condition `done(f)`), `guideView(f)` (étapes faites, étape en cours = la
  1re pas faite ; pas un couloir : skills / recherche se cochent même si le four n'est pas fait ; « loot » faite aussi
  dès qu'une étape suivante l'est), `nextSaved(saved, f, view)` (1re visite : `{ hidden: tout fait, open: !tout fait,
  seenInv:false }` ; `seenInv` quand l'onglet Inventaire est ouvert après avoir joué), `setupGuide(el, { facts, go,
  highlight })` (affichage, clics « replier », « Y aller », « Masquer »). Mémoire : `localStorage['deepIdleMine.guide']`
  = `{ <id de compte>: { hidden, open, seenInv } }`, lectures / écritures dans des try/catch.
- **Faits lus** (`src/main.js`, aucun appel serveur en plus) : `ready` = `progress` lu et pas hors ligne, `played` =
  XP > 0 ou inventaire non vide, `inv` (`ui.inv`, `unlocked`), `worn` (`stuff.worn()`), `skillsSpent` (`ui.skills`,
  posé dans `onChange` des skills), `inSession` (`rec`), `tab`. Relu toutes les `GUIDE.refreshMs` (1,5 s) et à chaque
  changement d'onglet ; ne redessine que si l'état change. Objets visés : `GUIDE` en config (`Pioche en pierre`,
  `Lingot de fer`, `Fer`) ; le nombre de lingots vient de `RECIPES`.
- **Barre** : `nav.highlight(tab)` (`src/ui/nav.js`) → classe `guideTab` (contour orange qui clignote, `steps(2)` ;
  coupé par `prefers-reduced-motion`). Page : `<aside id="guide" class="guide">` après `#notifs` ; CSS `.guide…`
  (fixe, à droite au-dessus de la barre ; téléphone : `right:8px`).
- **Tests** : `tests/guide.test.js` (nouveau, 9) : ordre et onglets des étapes, objets visés cohérents avec recettes et
  four, nouveau joueur, en session, four → craft → équiper, liste pas couloir, « loot » implicite, tout fait, mémoire
  (nouveau / ancien joueur masqué / inventaire vu), place dans la page. guide, help, nav ✅.
- **Navigateur** (playwright, serveur local de Jules, compte invité créé dans `data/`) : nouveau compte → guide ouvert
  0/7, accueil, Lobby en avant ✅ ; lancement → 1/7 « Regarde ton butin », Inventaire en avant ✅ ; replié en une ligne
  ✅ ; 390 px : lisible, au-dessus de la barre ✅. **Pas vérifié** : fin d'une vraie session (étape butin cochée à
  l'ouverture de l'inventaire), four / craft / équiper / skill / recherche en vrai (seulement par les tests).
- **Remarque sans lien** : à 1400 px, dans certains onglets (Stuff, Sorts), la barre du haut ne prend pas toute la
  largeur (800 à 1150 px) ; vu aussi sans les changements du guide. Pas cherché plus loin.
  → Expliqué et corrigé le 28/10 : c'était `body.inSession` (bulles d'aide), voir l'entrée suivante.

### Correctif : page déformée en session (Jules) — branche `jules/fix-classe-session`, ✅ en ligne le 28/10
- **Symptôme** (signalé par Jules, capture sur PC 1911 × 888) : pendant une session, sur tous les onglets, la barre du
  haut est rétrécie (~700 px) et descendue (~150 px), le contenu est collé à gauche, le mur du fond a disparu (fond uni).
  Hors session : normal. Le site en ligne servait bien les fichiers de `main` (comparés avec curl) : pas de fichier
  poussé à côté, et rien à voir avec le chantier de l'appli téléphone.
- **Cause** : `sessionFlag()` (`src/main.js`) posait `inSession` sur `<body>`, mais `.inSession` est déjà le bandeau
  « En session dans la mine » du lobby (`src/ui/style.css`, `display:flex; align-items:center;
  justify-content:space-between; padding; background:var(--sel); box-shadow`). En session, le `<body>` devenait ce
  bandeau : `.app` = élément flex rétréci à son contenu et centré en hauteur, fond `--sel` par-dessus le mur.
  Introduit par `c0bfcf0` (bulles d'aide), en ligne le 28/10 à 14:59.
- **Correctif** : classe du `<body>` renommée `sessionOn` (`src/main.js`, `body.sessionOn .nextNote` dans
  `src/ui/style.css`). Le bandeau du lobby garde `.inSession`.
- **Test** : `tests/help.test.js` « une classe posée sur <body> ne sert qu'à lui » : relève les
  `document.body.classList.toggle/add('…')` de `main.js`, `ui/guide.js`, `ui/nav.js` et refuse une règle `.classe` sans
  `body` devant dans le CSS, ou la même classe sur un élément d'`index.html`. ❌ avant le correctif (`.inSession{display:flex…`),
  ✅ après ; help + guide 16/16 ✅.
- **Navigateur** (playwright, fichiers statiques, 1911 × 888, onglet Inventaire) : `body.inSession` → barre du haut
  x=12 y=158 largeur 704, `body` en flex (= la capture de Jules) ; `body.sessionOn` → x=0 y=0 largeur 1911, `body` en
  block, mur visible ✅. Bandeau « prochaine session » de Stuff : affiché avec `sessionOn`, caché sans ✅.
  Pas vérifié : une vraie session en ligne après la mise à jour (à regarder par Jules).
- **Point fragile** : une classe posée sur `<body>` ailleurs que dans ces trois fichiers échappe au test.

## 28/10/2026 — Geoffrey — Vitesse d'attaque sans paliers de 0,1 s
- **Cause** : `fight` (src/sim/ai.js), `strike` (tours, instance) comparaient `G.t` (heure du tick ENTIER) à `m.atkReady`.
  Un coup fini au milieu d'un tick redécidait avec la même `G.t`, < atkReady, et attendait `max(DT, …)` : l'intervalle
  était arrondi au dixième au-dessus (0,32 s → 0,4 s). Trouvé par les bancs du GS expérimental (branche geoffrey/gs-bancs).
- **Correctif** : `nowOf(G, m)` (src/sim/mineur.js) = `m.now ?? G.t` ; les trois boucles `stepMiner` (mine, tours, instance)
  posent `m.now = G.t − budget` (heure exacte) le temps de `decide`. Les coups utilisent `now`, l'attente = `atkReady − now`
  (plus de minimum DT ; `startAction` / `act` gardent leur 0,05 s).
- **Tests** ✅ `tests/attack-speed.test.js` (100 à 400 % au rythme exact, 250 > 200) ; `tests/tower.test.js` : le test du
  verrou de recul compte les reprises de tacle par `stats.tackled` (le coup peut tomber dans le tick où le Séraphin
  revient : reprise et perte dans le même tick, invisibles en fin de tick) ; combat, knock, golem, goblin, mephite, mobs,
  flesh, dungeon, spells, khole, trap, instance-sim, tower-* : verts.
- **Simulation** ✅ 5 sessions à 3 : 0 blocage. `simulate:instance --size 3` identique avant / après (⚠️ acier 0/20 aujourd'hui,
  l'état du projet dit 20/20 : antérieur à ce correctif, à revoir).
- **Ajout (même branche)** : `rawDps(stats)` (src/meta/stuff.js) = dégâts × (1 + dégâts %) × (1 + critique, ≤ 100 %) ×
  (1 + double attaque, ≤ 100 %) × vitesse ÷ 100 ÷ `CFG.attackInterval` ; ligne « DPS (cible immobile) » sous le gear score
  (`statsHTML`, src/ui/stuff.js), avec les totaux affichés (stuff, skills, anneaux, glyphes ; sans Cri de guerre ni
  Pillage). Tests ✅ `tests/dps.test.js`.

## 28/10/2026 — Geoffrey — États visibles des mineurs et des mobs (✅ en ligne le 28/10)
- **Quoi** : `EFFECTS` en config (registre : sorte, nom, icône, couleur ; couleurs des sorts) ; `src/sim/effects.js`
  (`minerEffects`, `sessionBonuses`, `mobEffects`, `cleanRings`) LIT la partie, n'écrit rien. Envoyés dans `minerView` /
  `mobView` de la mine (`src/shared/view.js`), des tours, de l'instance (+ `spellCd`) et de la MI. Rangée d'icônes
  `src/ui/effects.js` (nœuds gardés : la bulle ouverte ne saute pas), `#fxBar*` dans index.html, posée en haut à droite
  du canvas par `placeEffectsBar` depuis la boucle de `src/main.js` (`updateEffects`, son propre mineur). Dessins sur le
  perso et les mobs : `src/render/effects.js`, appelé par `miner-sprite.js` (remplace le blit `stun` quand `m.effects`
  existe), `canvas.js`, `tower.js`, `instance.js`. Icônes : 14 de plus dans `scripts/build_pxicons.py` (+ `pxPath`).
- **Changements de simulation** (affichage seulement) : `data.cause` sur l'action `stun` (`fall`, `hex`, `quake` dans
  ai.js ; `land` dans la tour) ; `m.rings` (anneaux qui agissent sur lui, depuis `minerSpecs` / `instantSpecs` : le
  nerd seulement pour son porteur) ; exports `towerDark`, `warcryOf` (tours), `warcryOf` (instance). Les stats ne
  changent pas (les anneaux restent fondus dans `carac` avant la session).
- **Sorts** : détectés côté navigateur quand `spellCd[id]` augmente (`createCastWatch`), rien de plus envoyé.
- **Tests** ✅ `tests/effects.test.js` (14) ; view, tower, tower-boss, tower-spells, instance-sim, instant-mine, spells,
  flesh, golem, game-replay, mobs, stuff, help, guide, nav, camera, controls, boot-check… : verts. ❌ `tests/perf.test.js`
  « boîte de mesures… » : rouge AVANT ce chantier aussi (index.html de main), pas lié.
- **Simulation** ✅ 5 sessions à 3 : 0 blocage, chiffres habituels. Partie d'1 h (seed 7, 3 mineurs, sorts et skills) :
  dark, inspiration, ore_rush, war_cry, stun (cause fall), travel_rush, tackled, robbed vus ; mobs stun / taunt.
- **Navigateur** (playwright, page de démo locale non commitée, mine avec états forcés) : rangée en haut à droite,
  bulles « Étourdi / Ébranlement du golem / Encore 4 s » et « Bonus de session » (anneaux à leur niveau, shrine) ✅ ;
  étoiles, botte barrée, bulles, lueur du Cri de guerre, onde de sort, icônes du gobelin (étourdi + provoqué) ✅.
  Pas vérifié : une vraie session en ligne, tours et instance à l'écran (même code de dessin).
- **Points fragiles** : « Dans le noir » peut clignoter dans les galeries (à juger en jeu) ; `createCastWatch` garde
  les recharges par id de mineur d'une session à l'autre (au pire une onde manquée au début de la suivante).

## 28/10/2026 — Jules — Panneau de l'area : pourcentages de composition non arrondis (✅ en ligne le 28/10)
- **Cause** : `oreBonusComp` (src/meta/shrines.js, autel de minerais) répartit les points au prorata : area 3 à +5 points,
  terre 10 − 10/75 × 5 = 9,333…, pierre dure 4,666…, charbon 8,75. Valeurs justes (les comptes exacts en dépendent),
  mais `updateHUD` (src/ui/hud.js) les écrivait brutes.
- **Correctif** : `areaCompHtml(a)` (src/ui/hud.js, exporté) construit les barres de composition ; texte arrondi à
  1 décimale, virgule française (`pct`), largeur des barres inchangée (valeur exacte). Rien côté simulation ni serveur.
- **Tests** ✅ `tests/world.test.js` (nouveau test : area 3 + 5 points → « 9,3% », « 8,8% », « 56% », tout au format
  `\d+(,\d)?%`) ; ❌ avant le correctif (fonction absente), ✅ après ; world + spells + shrines 54/54.
- Pas vérifié dans le navigateur (rendu HTML contrôlé en Node : Terre 9,3 · Pierre 56 · Pierre dure 4,7 · Charbon 8,8 ·
  Fer 12,5 · Or 3,8 · Vide 5).

## 28/10/2026 — Geoffrey — Ceinture du Géant : dégâts 1,6 → 5
- `STUFF.items['Ceinture du Géant'].stats.damage` 5 (décision de Geoffrey, hors règle du butin des mobs à 250 x) ;
  `tests/stuff-balance.test.js` : exception `OFF_RULE`. GS 127 → 263. Tests ✅ stuff-balance, mob-drops, gearscore, wiki.

## 28/10/2026 — Geoffrey — Concasseur : minerai de fer
- `CRUSHER.loot['Fer']` : `always` charbon 1-50, Or 1-20, Diamant 1, Graphite ore 1-10 (`rollLoot` : quantité uniforme) ;
  `oneOf` gemmes `gems(0.01)`, treasure T1 0,02 / T2 0,01 / T3 0,005. `crushable` : tout objet qui a une table (plus
  seulement la famille bloc). `dropOdds` met le butin garanti en tête (`family:'fixed'`, `min`, `max`) ; aide « ? »
  (src/ui/crusher.js) et wiki l'affichent en fourchette.
- **Tests** ✅ `tests/crusher.test.js` (nouveau test : table, moyennes sur 100 000 lots, un lot réel ; « objet refusé » =
  l'or, « sortie invalide » = Lingot de fer, le diamant étant devenu une sortie), `tests/anticheat/crusher.test.js` (fer en
  entrée, lingot refusé, butin garanti ≤ max par lot) : `npm run test:anticheat` 105/105 ; wiki ✅.

## 28/10/2026 — Geoffrey — Onglet Stuff : stats à droite des cases
- Depuis les Sets (`.setLay` : Sets | colonne), cases et stats étaient empilées dans la 2e colonne, et l'ancienne grille
  2 colonnes sur `.view[data-view="stuff"] .furnWrap` laissait une colonne vide de 150u à droite.
- `index.html` : la colonne de droite du `.setLay` devient `<div class="stuffMain">`. `src/ui/style.css` : la grille
  « cases | stats 150u » passe sur `.stuffMain` (1 colonne sous 1100 px) ; `.furnWrap` de Stuff : simple max-width 720u.
- ✅ Vérifié en capture Chrome headless (page statique avec le vrai style.css) à 1600 px (3 colonnes) et 900 px (stats
  sous les cases). Pas de test unitaire (CSS seul). La fiche d'un ami (`#fview`, Social) n'est pas touchée.

## 28/10/2026 — Sets : enregistrer et créer pendant une session (Geoffrey)
- `server/game/service.js` `sets` : plus de `session_running` pour create / save (equip l'était déjà depuis ce matin). Sûr :
  un set ne déplace rien (il note les uid portés, les skills, les sorts via `snapshot`) ; la session en cours garde
  l'équipement figé à son lancement. Idempotence inchangée (`opId`).
- `src/ui/sets.js` : en session, plus aucun bouton grisé (seulement pendant une demande) ; message du bas raccourci.
- Tests `tests/sets.test.js` : enregistrer et créer en session (le set prend l'équipement actuel, demande rejouée = pas de
  3e set) ; panneau. 8/8 ✅. GAME_DESIGN §sets et wiki (#sets) mis à jour.

## 28/10/2026 — Geoffrey — Amélioration : pièces portées choisies sans les retirer (✅ en ligne le 28/10)
- **Quoi** : `src/meta/upgrade.js` : `identify/upgrade/enchant/unenchant` (et leurs `*Error`) prennent un dernier argument
  optionnel `worn` (= `st.worn`, modifié sur place) ; `findPiece` cherche l'uid dans l'inventaire puis dans les cases,
  `dropPiece` retire un sacrifice de l'inventaire ou vide sa case. Rune : toujours de l'inventaire ; `ringDupes` inchangé
  (doublon d'anneau = inventaire seulement). Sans `worn`, comportement d'avant (pièce portée = `not_owned`).
- **Serveur** (`server/game/service.js` `upgrade`) : passe `st.worn`, enregistre avec `putInventoryAndStuff` (avant :
  `putInventory`), renvoie `stuff`. Message « doublon » : l'anneau peut être porté (`ringAsked`).
- **Navigateur** : `src/ui/upgrade.js` liste pièces portées + inventaire (`worn()` fourni par main.js), libellé
  « équipée », confirmation avant de sacrifier une pièce portée ; `src/ui/stuff.js` `onWorn` → `upgradeUI.refresh()`
  (l'ordre stuff.set / setInventory varie selon les appels) ; main.js applique `r.stuff` avant l'inventaire.
- **Tests** ✅ `tests/amelioration.test.js` (5 nouveaux : identifier porté, sacrifice porté → case vide + rejeu sans effet,
  appel sans `worn`, améliorer porté, anneau : doublon porté jamais pris), `tests/rune.test.js` (enchanter / retirer sur
  pièce portée), `tests/anticheat/upgrade.test.js` (l'ancien test « porté refusé » devient « porté amélioré et
  enregistré » ; sacrifice porté en double clic = une seule case vidée) ; + stuff, sets, anneaux : 78/78 ;
  `npm run test:anticheat` 106/106.
- ⚠️ Pas vérifié dans le navigateur (affichage de la liste et de la confirmation). Point fragile : un set qui contenait
  la pièce sacrifiée laisse sa case vide à l'équipement (déjà le cas pour un sacrifice depuis l'inventaire).

## 28/10/2026 — Geoffrey — Four : choisir une recette (action `recipe`)
- `src/meta/furnace.js` : `recipeByOut(out)` (recette identifiée par son produit, tous différents), `allRecipes()`,
  `recipeUsable`, `recipePlan(f, inv, out, count)` → `{ mode, add }` ou `{ error }`, `recipeMax` (recherche dichotomique
  sur `recipePlan`), et l'action `furnaceOp({ action:'recipe', furnace, out, count })`. Règle : cible = fournées déjà
  possibles (min des cases, combustible compris) + count ; chaque case est complétée jusqu'à cible × besoin. Un
  ingrédient déjà posé garde sa case (alliage : a/b dans n'importe quel ordre) ; case d'ingrédient occupée par autre
  chose → `slot_busy` ; changement de mode avec ingrédients posés → `not_empty` ; recette fermée non apprise ou produit
  inconnu → `bad_item` ; quantité qui déborde (pas un entier sûr) → `bad_qty`. Inventaire vérifié en entier avant de
  retirer quoi que ce soit (tout ou rien). Combustible : celui déjà posé, sinon `FUEL` = 'Charbon'.
- `server/game/service.js` : `out` et `count` transmis à `furnaceOp` (messages d'erreur existants réutilisés).
- `src/ui/furnace.js` : le bouton « Recettes » ouvre `openRecipes(i)` (remplace la fenêtre d'aide `openHelp`) : liste
  Fondre / Alliage, max par recette, raison si grisée, fournées + ½ + Max + Lancer. `src/ui/style.css` : `.frecs`
  (liste défilante 45vh ; `flex-shrink:0` sinon les lignes se chevauchent), `.frow b`.
- **Tests** ✅ `tests/furnace.test.js` (5 nouveaux : fer, complément de l'existant, alliage, refus, max) 40/40 avec
  `tests/anticheat/furnace.test.js` (quantités trafiquées, produits bidon dont `__proto__`, rejeu du même opId, matière
  conservée) et `tests/iron-furnace-gold-compass.test.js` ; `tests/game-service.test.js` 49/49 (recette par le serveur,
  double envoi).
- ✅ Affichage vérifié en capture Chrome headless (vrai module + style.css, faux inventaire). ⚠️ Pas testé dans une
  vraie partie avec serveur (envoi réel de la demande), seulement par les tests du service.

## 28/10/2026 — Geoffrey — Fiche d'objet de l'inventaire sans le poids
- `src/ui/inventory.js` `infoHtml` : ligne `poids ${d.w}` retirée (affichage seulement ; `ITEMS[…].w` et les pods en
  session inchangés). Tests ✅ inventory + stuff 23/23. Pas vérifié dans le navigateur (une ligne de texte en moins).
- Suite (même jour) : `infoHtml` rend trois blocs : `.iiDesc` (description), `.iiStats` (`statLines` de src/meta/stuff.js,
  un `<li>` par stat ; texte du glyphe en `<p class="iiStats">`), `.iiActs` (boutons en flex-wrap, avec leurs petites
  notes : case visée, « recette déjà débloquée », « four déjà débloqué », sans le « · » de tête). CSS dans
  `src/ui/style.css` sous `.invInfo`. Tests ✅ inventory + stuff 23/23 ; ✅ capture Chrome headless (Nuage magique :
  description, « Vitesse (marche) +1,04 », puis Équiper / Recycler).

## 28/10/2026 — Geoffrey — Pop-up « Tu as obtenu » (objet obtenu ou amélioré)
- `src/ui/obtained.js` (nouveau) : `setupObtained(root)` → `show({ title, entry, qty })`, file d'attente (un objet après
  l'autre), fermeture clic / Entrée / Échap ; `obtainedLines(entry)` (pur) : stuff = `statLines` + GS (pas pour les
  anneaux), rune = `runeLines`, blueprint = « Débloque la recette : X » + stats de X, sinon rien. `#obtained` dans
  index.html, style dans style.css (z-index 65, au-dessus de #account 60).
- Branché dans `src/main.js` seulement (les onglets ne changent pas) : `onCraft` (qty de la recette), `research` (action
  research → `r.item`), `upgrade` (identify / upgrade si `success !== false` / enchant → `r.piece` ; unenchant →
  `r.fragment`). Rien côté serveur ; les trésors (showLoot) ne passent pas par là.
- **Tests** ✅ `tests/obtained.test.js` (5) + `tests/boot-check.test.js`. ⚠️ Pas vérifié dans le navigateur. ✅ en ligne le 28/10.

## 28/10/2026 — Lobby : carte Shrines sous « Ton groupe » (Geoffrey)
- `index.html` : `#shrinesCard` déplacée de la 1re `.lobbyCol` (après `#prefsCard`) vers la 2e, juste après `#teamCard`.
  Affichage inchangé (`src/ui/lobby.js` : visible si `cards.prefs` et shrines présents). Sur téléphone la colonne de
  droite passe en premier (`order:-1`) : Shrines y suit donc l'équipe et le bouton Lancer.
- ✅ Tests lobby + shrines 28/28 ; capture Chrome headless (page statique, vrai style.css) : Shrines sous Ton groupe.

## 28/10/2026 — Geoffrey — Correctif : `.frow b{text-align:right}` cassait les lignes de Social
- **Cause** : la fenêtre « Recettes » du four (même jour) utilisait la classe `frow`, déjà prise par les lignes de
  Social et du lobby (`src/ui/social.js`, `src/ui/lobby.js` : `.frow .fname b` = pseudo). Sa règle `.frow b{text-align:
  right}` alignait les pseudos à droite.
- **Correctif** : classe du four renommée `frecRow` (`src/ui/furnace.js`, `src/ui/style.css`). ✅ plus aucune règle
  du four sur `.frow`. **À retenir** : chercher une classe dans tout `src/ui/` avant de la créer.

## 28/10/2026 — Geoffrey — Fond de page : la session en cours (✅ en ligne le 28/10)
- **Quoi** : `src/ui/backdrop.js` (nouveau) : `createBackdrop(#bgSession)`, un canvas par mode (mine, mi, tower,
  instance) créé à la première image, avec son propre moteur de dessin (createRenderer…) ; mine et mine instantanée :
  `setRows` = lignes pour couvrir l'écran (≤ `CAMERA.maxRows`). `draw(G, visible, me, follow)` appelé à chaque image dans
  `frame` (src/main.js) avec `rec ? shown : null` et `ui.tab !== 'session'` : rien dessiné sur l'onglet Session ni hors
  session. CSS `.bgSession` : fixed, z-index −1 (sous la vignette `body::before`), `object-fit:cover`,
  `filter:brightness(.45) saturate(.7)` (sans flou : coût sur un canvas plein écran).
- **Option** : `src/ui/account.js` `optionsHtml` + handlers `options()` / `setOption(key, on)` (vue « Mon compte ») ;
  clé localStorage `dim.bgSession` ('0' = coupée, défaut activée, try/catch si stockage bloqué).
- **Tests** ✅ `tests/backdrop.test.js` (défaut, persistance, stockage bloqué, rien sans session / onglet Session /
  option coupée, cases d'options échappées) + account-client : 5/5.
- ✅ **Navigateur** (Chrome sans écran piloté par CDP, mode dev, invité, session lancée) : sur l'onglet Inventaire le fond
  montre la mine assombrie (surface et mineur), `#bgSession` visible avec 1 canvas ; la case « Session en cours en fond
  d'écran » dans « Mon compte », décochée → fond caché, `dim.bgSession = '0'` ; aucune erreur console. Pas vérifié :
  tours, instance, mine instantanée en fond, téléphone, fluidité sur une petite machine. Points fragiles : le fond dessine la mine en entier à chaque image (même coût que l'onglet Session) ;
  `src/render/splash.js` garde les éclaboussures vues dans une Map partagée par les deux canvas (sans effet : un seul
  dessiné à la fois).

## 28/10/2026 — Stats du mineur sans « Skills en partie » (Geoffrey)
- `src/ui/stuff.js` `statsHTML` : plus de bloc `behaviourSkills` (aussi utilisé par la fiche ami, `src/ui/social.js`).
  `behaviourSkills` reste dans `src/meta/skills.js` (testé, plus appelé par l'interface).
- ✅ `tests/dps.test.js` (nouveau : pas de « Skills en partie » avec un logisticien), skills, social : 44/44.

## 28/10/2026 — Geoffrey — Four : changer de recette sans vider (action `recipe`)
- `src/meta/furnace.js` : `cleared(f, inv, rec)` travaille sur des **copies** (structuredClone) du four et de
  l'inventaire : rend (`unload`) les ingrédients qui ne servent pas (tous si le mode change ; ceux hors `rec.in`
  sinon), la sortie si c'est un autre produit, passe au mode de la recette, et met `since = null` si quelque chose a
  été rendu (le chrono de l'ancienne recette ne compte pas pour la nouvelle). `placeRecipe` ne refuse plus
  (`slot_busy` / `not_empty` ne sortent plus de `recipe`). `recipePlan` renvoie aussi `back` (objets rendus) ;
  `recipeMax` compte ce qui serait rendu. `loadRecipe` recopie les copies dans `f` et `inv` seulement si tout a marché ;
  inventaire qui ne reprend pas → `inventory_full`, rien ne bouge.
- `src/ui/furnace.js` : plus de « vide le four d'abord » ; ligne « Reviennent dans l'inventaire : … » sous la quantité.
- **Tests** ✅ `tests/furnace.test.js` (4 nouveaux : or → fer en pleine fonte avec chrono remis à zéro, sortie d'une
  autre sorte rendue, Fondre → Alliage et alliage → alliage avec le mithril commun gardé, inventaire plein ; l'ancien
  test des refus `slot_busy` / `not_empty` retiré), `tests/anticheat/furnace.test.js` (300 suites de changements au
  hasard, rejeux : fer, or, charbon conservés), `tests/game-service.test.js` : 85/85 + 6/6. ✅ Capture Chrome headless
  (four d'or en marche, choix du fer : « Reviennent dans l'inventaire : Or ×30, Lingot d'or ×2 »).
- **Point fragile** : `loadRecipe` remplace le contenu de l'objet `inv` (clés supprimées puis recopiées) ; le serveur
  sérialise ce même objet ensuite, donc ça marche, mais garder `inv` comme simple objet de données.

## 28/10/2026 — Geoffrey — Fenêtres bornées à l'écran, défilement interne
- `src/ui/style.css` : `#loot,#spick,#fpick,#cpick,#fview` passent de `position:absolute;inset:0` (calque de la hauteur
  de l'onglet, boîte à 10vh du haut de l'onglet, sans hauteur max : sortait de l'écran si la page avait défilé ou si la
  liste était longue) à `position:fixed` entre `--top-h` et `--dock-h`. Elles restent dans leur `<section data-view>`,
  donc cachées avec leur onglet comme avant. `.box` : `max-height:100%;overflow:auto;overscroll-behavior:contain`.
  `#notifs` : `max-height` + `overflow-y:auto`. Barre de défilement fine (`scrollbar-color:var(--line)`) sur toutes les
  fenêtres qui défilent (#account, #end, #obtained, guide, recettes du four…).
- ✅ Captures Chrome headless (vrai style.css, 40 lignes de butin) : 1280×720 et 390×800 (dans une iframe : headless ne
  descend pas sous 500 px). Pas de test unitaire (CSS seul). ⚠️ Pas vérifié dans le vrai jeu pour chaque fenêtre. ✅ en ligne le 28/10.
- Non traité : la bulle d'aide « ? » (`#tip.help`) n'a pas de hauteur max (elle ne reçoit pas la souris, donc ne peut pas
  défiler).

## 28/10/2026 — Geoffrey — Fond de page à l'échelle de la session, puis transition (✅ en ligne le 28/10)
- **Quoi** : `src/ui/backdrop.js` `measure(mode, cv, rows)` appelé dans `frame` (src/main.js) juste après le fit de
  l'onglet Session : `getBoundingClientRect` du canvas de la session (cv, cvMi, cvTw, cvIn) + lignes du moteur
  (`renderer.rows` / `miRenderer.rows`) + `innerWidth/innerHeight`, gardé dans `localStorage['dim.bgPlace']` (relu et
  revérifié : nombres finis, w/h > 0, modes connus). `draw` : place valable (même taille de fenêtre) → canvas
  `position:absolute` à ces coordonnées, `setRows(place.rows)` ; sinon classe `.cover` (ancien comportement).
  CSS : plus de fond noir sous `.bgSession` (le mur se voit autour de la mine).
- **Tests** ✅ `tests/backdrop.test.js` 6/6 (mesure gardée, onglet caché ignoré, mode inconnu ignoré ; place reprise ;
  fenêtre redimensionnée / mesure abîmée / JSON invalide → `.cover`).
- ✅ **Navigateur** (Chrome sans écran, CDP, mode dev) : canvas de la session 274,136 776×543 → canvas du fond
  274,136 776×543 sur l'onglet Inventaire ; aucune erreur console. Pas vérifié : tours, instance, MI, téléphone
  (sur téléphone #cv est dans le flux et la page défile : la mesure dépend du défilement au moment du relevé).
- **Suite le 28/10 (même branche) : plein écran + transition** (demande de Geoffrey : garder le plein écran hors Session,
  mais une transition douce). `backdrop.js` : `coverRect` (plein écran calculé, plus d'`object-fit`), `lerpRect`,
  `switchTab(from, to, G)` appelé par le callback de `setupNav` (src/main.js) ; vers Session : `#cv` (ou cvMi/cvTw/cvIn,
  `SESSION_CV`) en `visibility:hidden` pendant `BACKDROP.transitionMs` (450 ms), le fond passe linéairement du plein écran
  à la place mesurée, luminosité `BACKDROP.dim` (0,4) → 1, puis `#cv` réapparaît ; depuis Session : l'inverse. Le fond
  dessine toujours `place.rows` lignes quand une place est connue (même image que la session : zoom pur). `enterPanels`
  : classe `.bgEnter` sur la vue Session (keyframes `bgFromL/R/T`, `.runL`, `.runR`, `.rail`, `#run>header`, asides des
  modes MI/tours/instance). `.bgSession` passe en `z-index:0` (au-dessus de la vignette `body::before`, sinon saut de
  luminosité à la fin). `prefers-reduced-motion` : pas de transition. Le fond s'affiche avant le dessin (`show` puis
  `draw`) : une erreur de dessin ne le laisse plus caché.
- **Tests** ✅ `tests/backdrop.test.js` 8/8 (+ account-client) : plein écran, interpolation, mesure, transition aller (mine
  de la session cachée puis rendue, mi-chemin exact) et retour, pas de transition entre deux autres onglets / sans
  session / option coupée / mesure abîmée.
- ✅ **Navigateur** (Chrome sans écran, CDP, localhost:8000) : captures à ~60 / 150 / 300 ms : fond 94 px → 216 px →
  271 px (place de #cv), luminosité 0,60 → 0,87 → fin, `#cv` caché puis visible, panneaux en glissement ; aucune erreur.
  Pas vérifié : MI, tours, instance, téléphone, petite machine.
- **Suite 2 (même branche)** : panneaux en `linear` (avant `ease-out` : ils semblaient arriver avant la mine) ; sortie
  de l'onglet Session : `leavePanels(vue, #views, () => ui.tab === 'session')` (nav cache la vue avant d'appeler
  onChange) ré-affiche la vue en `position:fixed` à la place de `#views`, `.bgLeave` (z-index 5, sans clics, keyframes
  en `reverse`), puis la cache après `transitionMs` sauf si on est revenu sur Session (`resetPanels` annule tout, aussi
  au début d'une entrée). `#cv` caché pendant les deux sens (le fond fait le zoom). Tests ✅ backdrop 9/9 (+ sortie des
  panneaux, retour pendant la sortie). ✅ Chrome : progression zoom / panneaux à chaque relevé, entrée 23/20 %, 44/41 %,
  87/83 % ; sortie 19/19 %, 40/39 %, 83/81 % ; vue cachée à la fin ; aucune erreur.

## 28/10/2026 — Fenêtres de validation du site au lieu de confirm / alert / prompt (Geoffrey)
- `src/ui/dialog.js` (nouveau) : `ask(text, { ok, cancel, danger })` → promesse booléenne, `tell(text)`, `askText(text,
  value, { maxLength, readOnly })` → texte ou null. File d'attente (une fenêtre à la fois), Entrée = oui, Échap / clic sur
  le fond = non (écouteur `keydown` en capture, retiré à la fermeture). `dialogHtml` pur (texte échappé, `
` → `<br>`).
  `#dialog` dans `index.html`, style dans `src/ui/style.css` (z-index 70, au-dessus de `#obtained` 65).
- 22 appels remplacés : `src/main.js` (quitter session / instance / tour / MI, déconnexion via `confirmLeave` devenu
  asynchrone dans `src/ui/account.js`, erreurs focus / horloge / lien d'invitation), account, giant, guide,
  instant-lobby, lobby (chef, quitter le groupe, copie de secours en lecture seule), sets (enregistrer, renommer 24 car.,
  supprimer), skills (reset), social (retirer un ami), upgrade (identifier, doublon, rune). Handlers rendus `async` ou
  `.then`. Plus aucun `confirm(` / `alert(` / `prompt(` dans `src/`.
- ✅ `tests/dialog.test.js` 4/4 ; sets, skills, lobby, social, obtained ✅ (75/75) ; `node --check` sur tous les modules.
  Captures Chrome headless (page statique, vrai style.css) : confirmation et saisie, 1000 px et 360 px.
- ⚠️ Pas testé en clic réel dans le jeu (serveur local refusé dans cette discussion) : à essayer une fois (quitter une
  session, renommer un set, sacrifier une pièce). Fenêtre ouverte = le fond n'est pas cliquable (overlay plein écran).

## 28/10/2026 — Geoffrey — Sets dans le Lobby
- `src/ui/sets.js` : `HOSTS` + `'setsLobby'` (même rendu, même clic que les trois autres listes). `index.html` : carte
  `.setsCard.lobbySets` dans la colonne de droite du lobby, après `#teamCard` (pas `lockable` : les sets sont permis en
  session). `src/ui/style.css` : `.lobbySets` (titre normal, nom du set sur la ligne des boutons ; sous 700 px, le nom
  repasse sur sa ligne). Wiki (#sets), GAME_DESIGN, état du projet : « et dans le Lobby ».
- **Tests** ✅ `tests/sets.test.js` + `tests/boot-check.test.js` 11/11. ✅ Captures Chrome headless (vrai `setsHtml` +
  style.css) à 1400 px et 390 px. ⚠️ Pas vérifié dans une vraie partie (clic Équiper depuis le lobby). ✅ en ligne le 28/10.

## 28/10/2026 — Geoffrey — Correctif : saut du mineur dans l'ascenseur (affichage)
- **Cause** : `glide` (src/shared/view.js) ne fait pas glisser au-delà de `TELEPORT` = 6 cases (Manhattan) entre la
  position affichée et la nouvelle position reçue : il apparaît directement. Envoi toutes les ~250 ms + réseau
  (~0,4 s réelle = 8 ticks à ×2). Mesure (script hors dépôt : partie du serveur, 3 seeds, 1 h, un envoi / 8 ticks,
  `climbSpeed` 5,25 = jambes de haut tier, Escalateur 5/5) : **ascenseur** 1 642 envois sur 2 704 dans le seau à plus
  de 6 cases (pire 7) ; treuil normal 0 (pire 5) ; aux stats de base, 0 dans les deux cas. La simulation (seau case par
  case, `stepDir` / `winchT`) est correcte.
- **Correctif** : `glide` garde la glissade quand le mineur est dans le seau (`action.data.winch`) dans l'envoi
  d'avant ou dans le nouveau (`riding`), quelle que soit la distance. Vaut aussi pour les tours et les instances (même
  `glide`). Les vraies téléportations hors du seau restent instantanées.
- **Tests** ✅ `tests/view.test.js` (nouveau test : 10 cases dans le seau → glisse ; sortie du seau → glisse ; 10 cases
  hors du seau → saut) ; ❌ avant le correctif, ✅ après ; view + camera 11/11. ⚠️ Pas vu à l'écran (bug visuel en
  mouvement, pas de capture possible) : à regarder en vrai dans une session avec l'ascenseur.

## 28/10/2026 — Focus en fin de session : va-et-vient « Change d'area » / « Change de galerie » (Geoffrey)
- **Symptôme** (joueur, focus graphite, couche 5) : sur l'échelle, monte et descend en boucle, 0 bloc miné.
- **Cause** : `focusGoal` (`src/sim/focus.js`) ignorait `m.tripCap` (profondeur max du trajet, fin de session). Minerai
  visé seulement dans une area plus basse → `changeArea` le fait descendre ; arrivé dans cette area, `focusGoal` = null,
  mais `decideWork` (`src/sim/ai.js`) n'y vise rien (`inFocus` : y ≤ cap), `down` faux (m.y ≥ cap) → `explore` borné à
  `areaOf(cap)` → galerie au-dessus, il remonte d'une ligne → `focusGoal` le renvoie en bas. Reproduit : 3 areas, charbon
  « only » seulement en area 2, tripCap en area 1, puits avec échelle : va-et-vient lignes 101 ↔ 102, 46 bascules.
- **Correctif** : `focusGoal` borne l'area visée à `capK = areaOf(tripCap)` : focus d'area / « Plus profond » →
  `min(area, capK)` (il remonte toujours s'il est trop bas) ; focus minerai → seules les areas ≤ capK comptent, sinon null
  (le focus n'est pas retiré). « Plus profond » inchangé (`deepArea` était déjà borné).
- ✅ `tests/focus.test.js` : 2 tests (focusGoal borné, et 600 ticks sans va-et-vient ni descente en area 2, pour
  `{coal:'only'}` et `{area:2}`), échouaient avant (46 bascules). focus, end-depth, deep-ores, miner, mule, path, session,
  winch : 93/93. Simulation 5 sessions × 3 mineurs : 0 bloquée (sans focus : chiffres identiques avant / après la 2e version).
- ⚠️ Pas de simulation avec focus minerai (le script n'en pose pas) ; à surveiller : focus « only » d'un minerai absent au
  dessus du cap → il creuse des galeries vides jusqu'à la fin (comme avant hors fin de session).

## 28/10/2026 — Chat global du Lobby (Jules)
- **Serveur** : `server/game/chat.js` `createChat({ clock, gapMs, ttlMs })` (avant : cadence et durée fixées à `CHAT`),
  + `room(id)` / `restore(id, raw)` (reprise revérifiée : numéros strictement croissants, `cleanChatText(text) === text`,
  champs typés, `CHAT.keep` derniers ; `next` = max(next enregistré, dernier + 1)). `server/social/service.js` : salon
  unique `'global'`, `ttlMs: Infinity`, cadence `CHAT.globalGapMs` (3 s), `chatPost` / `chatGet` ; nom = `displayName(me)`
  (jamais le navigateur) ; relu en base au premier appel (`chatReady`, une seule fois) ; chaque message réécrit l'état
  entier (`putGlobalChat`, via `serial`). Routes `GET|POST /api/social/chat` (`?after=`, comme le chat de session).
  Stockage : ns `chat_global`, clé `state` (`server/game/store.js` : mémoire, fichier, PostgreSQL `db.load`).
- **Navigateur** : `src/ui/chat.js` généralisé (`prefix` des ids, `paused()`, `poke()`, `time`), une relecture à la fois
  (`reading` = génération). `src/main.js` : `gchat` démarré une fois au démarrage (la déconnexion recharge la page), en
  pause hors onglet Lobby, relu tout de suite en y revenant. `index.html` : carte `#gchatCard` ; CSS `#chatLog` → `.chatLog`.
  Aide « ? » `gchat` (`src/ui/help.js`). `CHAT.globalGapMs` dans `src/config.js`.
- **Tests** ✅ `tests/chat.test.js` (5 nouveaux : tous les comptes et invités, nom du serveur, cadence, séparé du chat de
  session, 50 derniers + reprise après redémarrage avec numéros qui continuent, stockage trafiqué) + `tests/social.test.js`
  (HTTP : 401 sans compte, 429, 400, corps tableau) : 33/33 ; `tests/boot-check.test.js` ✅. ✅ Vérifié dans le navigateur (serveur local, 2 invités) :
  message reçu par l'autre en ≤ 3 s, balisage affiché en texte, « Doucement… » au 2e message rapide.
- ⚠️ Points fragiles : pas de modération ; chaque message réécrit `game.json` en local (normal pour ce stockage) ;
  `/api/social/chat` compte comme signe de vie (présence), comme toutes les routes Social ; pas vérifié sur téléphone.

## 28/10/2026 — Onglet Sorts refait, piste A « la barre de sorts » (Jules)
- **Quoi** : mise en page de l'onglet Sorts seulement ; règles, serveur et état du compte inchangés (`src/meta/spells.js`
  intact). `index.html` : `#spellSpec` (spé + SP lvl), carte « Ta barre de sorts » (`#spellSlots`), « Grimoire »
  (`#spellTabs`, `#spellList`, légende), « Fiche du sort » (`#spellInfo`, contenu entier rendu par le JS, `h2` compris).
- `src/ui/spells.js` réécrit : exports purs `treeOf(s)` (spé ou `'scroll'`), `spellStats(s)` (chiffres de la fiche tirés
  des champs de config, table `STATS`), `spellStatus(st, id, ctx, owned)` (equipped / ready / learn / other / locked,
  `bad` = équipé mais n'agit pas). Clic tuile = fiche ; double clic / glisser / bouton de la fiche = équiper ; clic sur un
  emplacement plein = le retirer. Emplacement visé (`target()`) : celui choisi s'il est libre, sinon le 1er libre, sinon
  celui choisi (bouton « Remplacer X »). Fiche par défaut tant que le joueur n'a rien choisi (`picked`) : 1er sort de la barre.
- `src/config.js` `SPELLS.list` : `px` (icône pixel, `src/ui/pxicons.js`) et `short` (ligne sous le nom) par sort ;
  `icon` (emoji) gardé pour le wiki. `src/ui/hud.js` `spellBarHtml` : `pxi(s.px)` + classe `tr-<famille>`.
- `src/ui/style.css` : bloc « onglet Sorts » remplacé (`.spSock`, `.spTile`, `.spInfo`…, couleurs `.tr-mineur` /
  `.tr-logisticien` / `.tr-barbare` / `.tr-scroll`), `.spGrid` à 2 colonnes (sets | contenu), `.spWrap` 680u ; `.spB .spIcon`
  pour la barre en session. Textes : aide « ? » (`src/ui/help.js`), wiki §Sorts, GAME_DESIGN §3 Sorts.
- **Tests** ✅ `tests/spells.test.js` (barre en session : classes et icônes pixel ; 3 nouveaux : `px`/`short`/famille de
  chaque sort, `spellStatus`, `spellStats`) + `tests/wiki.test.js` + `tests/world.test.js`. ✅ Vérifié dans le navigateur
  (serveur de dev sur un autre port, `DIM_DATA_DIR` à part, compte Test_Mineur) : affichage 1440×900, retirer / remettre
  par la barre et par la fiche, fiche d'un sort d'une autre spé ; téléphone 390 px : pas de défilement horizontal,
  3 tuiles par ligne.
- ⚠️ Pas vérifié en vrai : le bouton « Remplacer X » (barre pleine + un autre sort disponible), l'apprentissage d'un
  parchemin depuis la fiche (même appel serveur qu'avant), la barre de sorts pendant une session (couverte par le test).

## 28/10/2026 — Identification en deux temps : pièce non identifiée, puis sacrifice du même objet (Geoffrey)
- `src/ui/upgrade.js` : nouvel export pur `identifyChoices(list, t)` utilisé par `renderIdentify`. Sans cible : pièces
  `!isIdentified` ; avec cible : même `item`, uid ≠ cible (identifiées comprises). `pick` est recalculé à chaque rendu
  (`t ? 'sacrifice' : 'target'`) ; sans cible le sacrifice est vidé ; la case Sacrifice ne fait que se vider (rien avant
  la cible). Aide « ? » réécrite en 2 étapes. Le contrôle `why` reste en garde-fou, le serveur revérifie
  (`src/meta/upgrade.js`, inchangé).
- **Tests** ✅ `tests/amelioration.test.js` (29/29, 1 nouveau sur `identifyChoices`).
- ⚠️ Pas vérifié dans le navigateur (affichage seulement, même rendu qu'avant avec moins de lignes).

## 28/10/2026 — Focus minerai hors de portée du trajet : galeries en area 0 (graphite « only »)
- **Symptôme** (Geoffrey) : focus « Uniquement » graphite → « Creuse une galerie » en haut de la mine toute la session ;
  plus rien dès qu'on retire le focus. Reproduit : seed 7919, areas 0-6 débloquées, 1 mineur ; au 2e départ
  `m.tripCap` = 196 (area 3), graphite seulement en areas 5-6 → `focusGoal` null (rien à portée, correctif du matin
  c4a02b8), `focusStop` arrête la descente au-dessus de l'area 1 (sans graphite), `targetVal` ignore les autres
  minerais → `explore` dans l'area 0 jusqu'à la fin (1 606 décisions « Creuse une galerie » en area 0).
- **Correctif** `src/sim/focus.js` : `focusFar(G,m)` (aucune area de `focusAreas` ≤ area de `m.tripCap` n'a encore un
  minerai visé) et `oreFocus(G,m)` (focus en vigueur : sans les minerais quand `focusFar`, l'area gardée). Lu par
  `deepArea`, `focusGoal`, `targetVal` (**signature changée : `targetVal(G,m,t)`**, appelants `src/sim/ai.js`,
  `src/sim/thrall.js`) et `ai.js` (`decideWork` `act`, `focusStop`). Résultat : « Plus profond » borné au trajet.
  `dropDepleted` → `farNotice` : `m.focusFar` (nouveau, `src/sim/mineur.js`) suit le passage, `focusNotice` une fois
  par passage en veille, plans revus (exploring / skipRows / target) dans les deux sens. `m.prefs.focus` jamais modifié.
- **Tests** ✅ `tests/focus.test.js` (2 nouveaux : veille + message unique + reprise ; mineur qui descend jusqu'à l'area 3
  au lieu de creuser en area 0 ; 1 attente changée : déjà sous le trajet avec un focus minerai en veille, `focusGoal`
  le renvoie dans l'area du trajet au lieu de null), `tests/judgment.test.js` (nouvelle signature), `end-depth`,
  `goblin-thrall`, `khole` : 78 ✅. Simulation 3 mineurs × 5 : 0 blocage ; `--focus iron:only` × 5 : 0 blocage.
  Repro après correctif : area 3, « Suit un filon » fer / charbon / or.
- ⚠️ Pas vérifié en vrai (session en ligne) : le message dans le panneau Focus minerai. Point fragile : `m.tripCap`
  dépend de la remontée mesurée (`secPerRow`) ; une remontée lente (tacles) rend le trajet court et met le focus en
  veille plus tôt.

## 29/10/2026 — Geoffrey — Gants tactique et Ceinture du Géant : ≈ +10 % de DPS chacun
- `STUFF.items['Gants tactique'].stats.attackSpeed` 20 → 10 ; `STUFF.items['Ceinture du Géant'].stats.damage` 5 → 1,5
  (ténacité 12,5 inchangée ; toujours hors règle du butin des mobs, `OFF_RULE` de `tests/stuff-balance.test.js`).
- Vérifié avant : `rawDps` (src/meta/stuff.js) = formule des coups en session (`hitDamage` src/sim/actions.js, attente
  `ai.js`) ; les dégâts fixes du stuff sont dans `carac.damage`, donc multipliés par damagePct, critique, double attaque.
- DPS (`rawDps`, sans skills ni anneaux) : épée en fer 17,5 → ceinture 19,38 (+10,7 %), gants 19,25 (+10 %) ; épée en
  acier 23,13 → 25,00 (+8,1 %), 25,44 (+10 %). GS : Gants tactique 100 → 50, Ceinture du Géant 263 → 123.
- **Tests** ✅ tier2 (valeurs attendues 20 → 10, 39,2 x → 19,6 x, total 120 → 110), stuff-balance, mob-drops, gearscore,
  wiki, amelioration : 82/82. Ni simulation ni économie touchées.

## 29/10/2026 — Geoffrey — Couronne du Roi Gobelin : buff du porteur (✅ en ligne le 29/10)
- **Demande** : « c'est un buff individuel, ça n'impacte pas les autres mineurs à côté, hormis qu'ils ne doivent pas tuer
  les gobelins asservis ». Première version du matin (buff pour tout mineur à 10 cases du porteur) : mauvaise lecture,
  remplacée dans le même chantier.
- **Quoi** : `crownOf(G, m)` (src/sim/effects.js) → buff `crown` (EFFECTS.list, `kind:'buff'`) chez le porteur seul
  (`carac.goblinThrall > 0`, `y > 0`, `G.thralls` présent = la mine) ; `stacks` = ses asservis au travail. Retiré de
  `sessionBonuses` et `bonusLine` ; bulle dans `effectTip` (src/ui/effects.js). Simulation inchangée.
- **Asservis jamais frappés** : ils vivent dans `G.thralls`, jamais dans `G.mobs` ; coups, Cleave, Dynamite, Dash,
  Hand of Justice, Ulti shen ne lisent que `G.mobs`. Test « personne ne frappe un gobelin asservi » : partie d'1 h à 3
  barbares (Cleave, Dynamite, Dash, HoJ, 60 dégâts), le porteur au milieu : chaque asservi vit tout son temps ✅.
- **Tests** ✅ `tests/effects.test.js` 17/17 ; view ✅. Partie d'1 h (seed 7, couronne sur le premier) : buff 3 485 / 3 600
  échantillons chez le porteur (absent à la surface), 0 chez les deux autres, 0 dans les bonus ✅.

## 29/10/2026 — Geoffrey — Coffre du Roi Gobelin : Graphite ingot + Tainted iron au lieu de Graphite ore (✅ en ligne le 29/10)
- **Quoi** : `GOBLIN_KING.loot.always` (src/config.js) : `Graphite ore` 20-40 retiré ; `Graphite ingot` 5-15 et
  `Tainted iron` 10-20 ajoutés (avant les peaux). GAME_DESIGN.md (Roi Gobelin), wiki.html (texte du coffre). Les lignes
  « où le trouver » du wiki viennent de la config (src/wiki/data.js) : rien à changer.
- **Attention aux tests** : `rollLoot` tire un nombre par entrée `always`, puis un par famille : un `always` de plus
  décale le hasard rejoué ; `tests/goblin-king.test.js` a un 0,5 de plus dans chaque `seq` / `open`.
- **Tests** ✅ goblin-king 9/9, graphite, wiki, loot / treasure (44) ; `npm run test:anticheat` 108/108.
- **Probabilités** (calcul + 200 000 ouvertures avec `openTreasure`) : objet du boss 7,00 % (simulé 6,91 %), couronne
  1 % (0,97 %), au moins un rare toutes familles 17,30 % (17,35 %) ; moyennes 10 lingots, 15 Tainted iron, 75 peaux ✅.

## 29/10/2026 — Geoffrey — Glissade adaptative au Bloc géant et dans la MI (affichage)
- **Cause** Bloc géant : `src/render/giant.js` glissait sur `GIANT.viewPoll` (500 ms) fixes, alors que `pollView`
  (src/ui/giant.js) relance son délai de 500 ms après la réponse : un envoi toutes les ~600-800 ms → mineur figé ~100 à
  300 ms avant chaque envoi. Glissade en x seulement, saut au-delà de 4 cases. **MI** : `instantPos` (avancée du pas à
  l'envoi) sans glissade entre deux envois → petits bonds.
- **Correctif** : `src/shared/view.js` exporte `pace(M, prev, now)` (durée = moyenne lissée 0,7 / 0,3 du temps réel entre
  envois, bornée 80-1500 ms ; déjà utilisée par la mine, maintenant partagée). Bloc géant : `glide` + `pace` + `shownPos`
  sur une copie des mineurs (x et y, seuil de saut `TELEPORT` 6 comme partout). MI : `applyInstantView(v, prev, now)`
  fait `glide` avec `instantPos` (déplacé dans `src/shared/instant-view.js`, réexporté par `src/render/instant.js`) ;
  rendu et caméra lisent `shownPos`. `src/main.js` passe la copie d'avant à `applyInstantView`.
- **Tests** ✅ instant-ui (nouveau test : glissade départ / milieu / arrivée, durée qui converge vers 700 ms pour un envoi
  / 700 ms), view, camera, giant-service, giant-sim : 49/49. ⚠️ Pas vu à l'écran (pas de navigateur ici) ; le rendu du Bloc
  géant n'a pas de test (canvas), il réutilise `glide` / `pace` / `shownPos` testés.

## 29/10/2026 — Geoffrey — Classement « Roi gobelin » (✅ en ligne le 29/10)
- **Quoi** : board `instance` (src/meta/leaderboard.js : `BOARDS`, tri croissant comme `tower`, `sanitizeInstanceRecord`
  { t, fight, at, instance, team, session }, `betterInstance`) ; ns `instance_record` (server/game/store.js : mémoire,
  fichier, PostgreSQL, `get/list/putInstanceRecords`) ; `recordInstance(rec)` après `recordTower` à la fin de session
  (server/game/service.js) : instance réussie, pas dev, joueurs présents à la victoire ; `fight = r.t − r.awake`
  (`G.timeline.awake`, réveil du roi) ; rattrapage des sessions `done` gardées (`backfillTowers`, même passage) ;
  `leaderboardData().instance`. Social : ligne avec `team` et `fight` (server/social/service.js) ; `BOARD_INFO.instance`,
  `instanceDetail` (« combat 2:10.4 · avec Max »), bouton « Roi gobelin » (index.html).
- **Outil de test** : `fakeLive` (tests/helpers.js) termine maintenant une instance à `INSTANCE_TICKS` (avant : à la
  durée d'une mine classique, une instance hors mode dev ne finissait jamais dans les tests).
- **Tests** ✅ `tests/leaderboard.test.js` 14/14 (record revérifié, plus court gagne, présents seulement, échec et dev
  ignorés, record plus lent qui ne remplace rien, rattrapage, admin caché) ; 27 fichiers serveur / store / social :
  334 ✅, 1 ❌ `tests/dev-spec.test.js` « lobby, mode dev : les tours… » : rouge aussi sur main, pas lié.
  `npm run test:anticheat` 108/108 ✅. Pas vérifié à l'écran (onglet Social, il faut un serveur).

## 29/10/2026 — Jules — Police du corps de texte : VT323 au lieu de Jersey 10
- **Quoi** : `--f-body` (src/ui/style.css) passe de `'Jersey 10'` à `'VT323'` ; `--f-title` reste `'Jersey 15'` (repli
  VT323). index.html charge `Jersey 15` + `VT323` depuis Google Fonts (Jersey 10 n'est plus chargée). CSP inchangée.
- **Cause** : une police pixel n'est nette qu'aux multiples de sa grille. Jersey 10 est nette à 20 px, floue à
  `--fs-s` 15 px / `--fs` 17 px : 8 → 9, 5 → 6 (signalé sur l'orbe d'XP). Comparaison à taille réelle (captures agrandies
  sans lissage) : VT323 nette à 15/17/20/21 px ; Pixelify Sans : 5 ≈ S ; Tiny5 : 8 ≈ e.
- **Vérification** ✅ lobby, inventaire, stuff, orbe à 1366×768 (compte Test_Mineur, `npm run dev`), pas de défilement
  horizontal à 390×844 (lobby, stuff). Tests nav, controls, guide, help, perf, account-http : 40/41, le ❌ « la boîte de
  mesures est dans les barres… » échoue aussi sur main sans ce changement, pas lié.
- **Points fragiles** : VT323 est monospace, plus large que Jersey 10 : textes en `nowrap` un peu plus longs (boutons
  « Où miner » sur 3 lignes à 1366 px). Le canvas (mine) écrit toujours en `sans-serif`, non concerné. VT323 n'a qu'une
  graisse : le gras est simulé par le navigateur (déjà le cas avec Jersey).

## 29/10/2026 — Geoffrey — Tours niveau 2 : dureté × 2, poids × 2 (✅ en ligne le 29/10)
- **Quoi** : `TOWER.levels[2]` : `hard` 1,75 → 2, `weight` 1,5 → 2 (src/config.js). GAME_DESIGN.md, wiki.html, état du
  projet ; commentaire de `brickW` (src/sim/tower/session.js).
- **Tests** ✅ tower-level (config, brique 2 fois plus longue, sac plein au niveau 2 seulement), tower, tower-spells,
  tower-boss : 54/54.
- **Simulation** `npm run simulate:tower -- --level 2 --count 20`, avant → après : 0/20 victoires partout dans les deux
  cas (équipes de base) ; étage 4 atteint à 7:46-7:47 → 8:20-9:56, étage 5 à 9:49 (équipe a) → jamais. ⚠️ Aucune équipe
  mesurée ne gagne le niveau 2 (repère du 28/10 : 2,5 minage / 40 dégâts, 0/4, avant ce changement).

## 29/10/2026 — Geoffrey — Barre des sorts dans les tours, l'instance et le Bloc géant
- Seul `updateHUD` (mine classique, `#spellBar`) remplissait la barre ; les tours, l'instance et le Bloc géant jouent des
  sorts (`spellCd` dans leurs simulations) sans les montrer. MI : pas de sorts dans `src/sim/instant/`, pas de barre.
- `src/ui/hud.js` : `showSpellBar(el, m, t)` (cache sans sort / sans mineur) et `placeSpellBar(el, cv, wrap)` (bas du canvas
  quand il est centré plus petit que sa zone). `index.html` : `#spellBarTw`, `#spellBarIn`, `#spellBarGt`. `src/main.js` :
  `updateSpellBars` (son propre mineur, comme les états). `server/giant/service.js` viewOf : `me.spells`, `me.spellCd` ;
  `src/ui/giant.js` frame : barre à chaque image, temps = `view.t` (rafraîchi à chaque réception, ~0,5 s).
- **Tests** ✅ spells (showSpellBar), giant-service (me.spells / spellCd), tower-spells, giant-sim, instance-server : 72/72.
  ⚠️ Pas vu à l'écran (pas de navigateur ici) : vérifier la place de la barre dans une tour, une instance et au Bloc géant.

## 29/10/2026 — Geoffrey — Sets : ligne « Set équipé »
- `src/meta/sets.js` `equippedSet(list, worn, skills, spellSlots)` : premier set dont l'uid de chaque case, l'arbre, les
  rangs > 0 et les emplacements de sorts égalent l'équipement actuel ; null sinon. Rien de stocké (pas de « set actif »
  côté serveur) : comparaison à l'affichage.
- `src/ui/sets.js` : `setsHtml(…, { current })` (ligne `.setCur`, ligne du set `.setRow.on` + ✔), `setupSets({ current })`.
  `src/ui/spells.js` : `onChange`, `slots()`. `src/main.js` : `setsUI.refresh()` sur changement de stuff (`onWorn`), de
  skills (`onChange`) et de sorts (`onChange`) ; `let setsUI` déclaré avant `setupStuff`.
- **Tests** ✅ sets (nouveau test : correspondance, pièce / exemplaire / sort différent, rang à 0, HTML), spells, skills :
  61/61. ⚠️ Pas vu à l'écran (pas de navigateur ici).

## 29/10/2026 — Geoffrey — États du joueur regardé, et barre d'états au Bloc géant
- `src/ui/effects.js` : `focusedMiner(miners, me, focus)` (choisi s'il est là, sinon le sien — `account` ou `me` —,
  sinon le premier ; `name` si ce n'est pas le sien) ; `createEffectsBar` → `update(m, name)` ajoute un nœud `.fxWho`
  (nom, bulle) devant les icônes.
- `src/main.js` `updateEffects` : mine = `ui.follow` (déjà réglé par un clic dans `#teamBody`), tours / instance / MI =
  `ui.focus` (clic `pointerdown` sur `[data-id]` de `#twTeam`, `#inTeam`, `#miRank` ; sur soi ou le même = null ; remis à
  null au lancement d'une session). HUD : lignes `.pick` avec `data-id`, `.focus` sur le joueur choisi (4e paramètre).
- Bloc géant : `server/giant/service.js` viewOf, chaque mineur porte `effects` (`minerEffects`) et `bonus`
  (`sessionBonuses`) ; `index.html` `#fxBarGt` ; `src/ui/giant.js` `showEffects` à chaque image, choix dans `#gtPresent`.
- **Tests** ✅ effects (focusedMiner, lignes cliquables), giant-service (effets dans la vue), instant-ui, tower-spells :
  49/49. ⚠️ Pas vu à l'écran (pas de navigateur ici) : clic dans l'équipe, place du nom devant les icônes.

## 29/10/2026 — Geoffrey — Instance : recul vers le centre sans dépasser (aller-retour d'une demi-case)
- **Cause** : `pushMiner` (src/sim/instance/session.js) poussait de k (0,5 ; rage 1) dans le sens `toCenter(G, m.x)`,
  calculé sur la case seule. Au centre (mid = 14) : x 13 → poussé à 13,9 (case 14) → sens inverse → 13,4 → … Trace
  (seed 7919, 3 fer) : x+kx alterne 13,4 / 13,9 toutes les 1 à 4 s en combat. Mesure d'affichage (envoi / 8 ticks, glide) :
  135 demi-tours de l'image sur 5 min.
- **Correctif** : `centerX(G)` = milieu de la case du centre ; recul de min(k, écart) vers lui sur la position exacte
  (x + 0,5 + kx), rien si déjà au centre (renvoie false : pas compté dans gobKnocks). `boost` (coup boosté) inchangé.
  Après : 14 demi-tours (vrais déplacements).
- **Tests** ✅ instance-sim (nouveau test : arrêt au centre, 4 coups de 0,5 depuis 2 cases, coup de 1 à 0,7 du centre),
  instance-server, instance-key : 25/25. Simulation `simulate-instance --count 5 --size 3`, avant / après identiques
  (fer 0/5, roi 3 500 PV ; fer + acier 0/5, ≈ 685 PV ; acier 0/5, ≈ 700 PV ; 0 bloqué). ⚠️ Les repères du 27/10
  (fer + acier 13/20, acier 20/20) ne tiennent plus sur main, déjà avant ce correctif.

## 29/10/2026 — Jules — Four : bouton `½` → « Moitié »
- **Quoi** : `src/ui/furnace.js`, `#fpickHalf` (deux fenêtres : pose d'un objet, choix de recette) affiche « Moitié » au
  lieu de « ½ » : le glyphe ½ de VT323 est illisible à 15 px. Comportement inchangé. `GAME_DESIGN.md` mis à jour.
- **Vérification** ✅ capture de la fenêtre « choisir une recette » à 1366×768 (le bouton tient dans la ligne) ;
  tests furnace + help 38/38.
- **Point fragile** : avec VT323, éviter les glyphes spéciaux (fractions ½ ¼…) dans les boutons ; `×`, `·`, `→`, `✓` restent lisibles.

## 29/10/2026 — Le Carreau, la ville du spawn (Jules)
- **Quoi** : nouveau fond hors session + promenade. Config `TOWN` (`src/config.js` : plan, vitesses, cadences, bulles ;
  `buildings` = un par onglet de `TABS`, ordre de gauche à droite) et `TOWN_SERVER` (`server/config.js`).
  - `src/shared/town.js` (pur, partagé) : `townLayout` (x de chaque bâtiment, `door` = milieu), `restX(spot, id)` (porte
    ± `TOWN.spread` tiré de l'ID par `hash01`), `cleanTownPing` (revérification serveur : onglet connu, x fini ramené
    dans la ville, arrondi 1/100, sinon null), `buildingNear`, `stepToward` (vitesse `walk`, long trajet en ≤ `rush` s).
  - `server/town/service.js` + `routes.js` : `POST /api/town` `{ spot, x? }` → `{ players, say }`. Présence en mémoire
    (`presentFor` 40 s), joueurs en session exclus (`game.playersInSession`, relu au plus toutes les 3 s), moi exclu,
    pseudo + `look` + `auras` relus au plus toutes les 20 s, bulle = dernier message du chat global de moins de
    `TOWN.bubbleMs` (`social.recentChat(ms)`, ajouté hors de l'enveloppe « signe de vie » de `server/social/service.js`).
    Branché dans `server/app.js` (`town`) et `server/main.js`. Ne crée ni ne déplace aucune ressource.
  - `src/render/town.js` : canvas `TOWN.rows` cases de haut, largeur selon la fenêtre (`setCols`), dessiné en ×2
    (`HIRES`) pour des textes nets. Nuages et montagnes en parallaxe, maisons en tuiles (murs, toit en escalier avec
    bords en pente, porte, fenêtres, enseigne = texture du bâtiment), place (feu de camp + lueur), chevalement (sprite
    80 × 112) avec le puits (`tunnel`), lampadaires, mineurs via `createMinerSprite` (moi encadré), bulles (`bubbleLines`).
  - `src/ui/town.js` : `setupTown(root, { ping, me, onEnter })`, `frame(dt, { show, walk, tab })` appelé par la boucle
    de `src/main.js` (show = pas de `rec`, compte connecté ; walk = onglet Session et `#noSession` visible). Ping toutes
    les 2,5 s (1 s en promenade, 15 s onglet caché). `mergeOthers` : le x du serveur n'est qu'une cible (bug corrigé
    pendant le dev : `x: null` écrasait la place affichée → NaN, joueur invisible). Promenade : classe `townWalk` sur
    `<body>` (barre du haut, onglets et guide cachés, `.app` sans clics sauf la barre d'action et `#notifs`), `#bgTown.walk`
    reçoit les clics. Option `bgTown` (localStorage `dim.bgTown`) dans Mon compte. Débogage : `TOWN_UI.state()`.
  - Textures : `town()` dans `scripts/gen_textures.py` (15 nouvelles `town_*`, dont `town_headframe` 80 × 112,
    `town_lamppost` 16 × 32, `town_cloud` 48 × 16), ajoutées à `TEXTURES` ; régénération sans changer les anciennes.
- **Tests** ✅ `tests/town.test.js` (12 : plan, place, ping refusé : onglet inconnu / `__proto__` / NaN / Infinity /
  texte, marche, bâtiment proche, `mergeOthers`, bulles, service : moi exclu, en session exclu, départ après
  `presentFor`, bulles ≤ `bubbleMs`, cache de l'apparence, 400 / 401) + `boot-check`, `wiki`, `backdrop`, `social` :
  54/54. Voisins (`grep TEXTURES|createApp`) : 278/278.
  ✅ Vérifié dans le navigateur (serveur de dev sur le port 8123, `DIM_DATA_DIR` à part, 2 invités) : fond tamisé
  derrière le Lobby et le Four (le mineur marche jusqu'à la Fonderie), promenade ← →, E devant le chevalement → Lobby,
  clic sur la rue → marche, clic sur l'Entrepôt → Inventaire, l'autre invité visible sur la place, bulles (la mienne
  vue à l'écran, celle de l'autre vue dans la réponse du serveur).
- ⚠️ Pas vérifié : téléphone (largeur mini 8 cases, bandeau d'aide qui passe à la ligne), session lancée puis finie
  (le fond doit repasser de la mine à la ville, et la promenade revenir après la fermeture du bilan), Bloc géant (la
  visite garde l'onglet Session : `#noSession` caché, donc pas de promenade). Points fragiles : chaque ping relit la
  liste des joueurs en session au plus toutes les 3 s (requête base en ligne) ; 80 joueurs au plus renvoyés ; la
  présence en ville est séparée de la présence Social (`onlineFor` 45 s) : un onglet caché ne pinge que toutes les
  15 s et part au bout de 40 s sans ping.

## 29/10/2026 (après-midi) — Le Carreau : fiche joueur, groupes, émotes, statue, bannières (Jules)
- **Quoi** : suite de l'entrée du matin, même branche `jules/spawn-ville`.
  - Zoom : `TOWN.rows` 16 / `ground` 12 (ancien 18 / 13). Place `w` 11 (ancien 7), décor en colonnes `TOWN.place`.
  - Serveur `server/town/service.js` : la réponse du ping ajoute pour chaque joueur `level` (`game.levelFor`, nouveau),
    `tree` (`skillTreeOf`), `gs` (`gsFor`), `emote`, `group` (`{ tag, size, max }`, **repère donné par le service, jamais le
    code du lobby**, null seul dans son groupe ; `party.groupOf`), `lfg` (`party.searching`, nouveau dans
    `server/party/service.js` : membre d'une entrée valide de la file) ; et pour moi `group`, plus `statue` (n°1 de
    `TOWN.statueBoard` via `game.leaderboardData` + `rankBoard`, comptes `LEADERBOARD.hidden` exclus, relue toutes les
    `TOWN_SERVER.statueFor` 60 s). `POST /api/town/emote` `{ emote }` : id de `TOWN.emotes` (sinon 400), une toutes les
    `TOWN.emoteGapMs` (sinon 429), visible `TOWN.emoteMs`. Le corps d'une requête doit être un objet (tableau : 400).
  - `src/shared/town.js` : `restX(spot, id, group)` (sur la place, point du groupe ± `TOWN.group`), `emoteOf`.
  - `src/render/town.js` : place (statue = `createMinerSprite` ×2 avec `ctx.filter` gris, socle `town_pedestal` ;
    bannières `town_banner_angel` / `_demon` avec jauge dessinée, pulsation si ouverte), au-dessus du pseudo : marque de
    groupe ou « ? », émote (saut pour 👋 / 🎉), bulle ; textes de la place seulement devant soi (`scene.meX`, ≤ 1,8 case).
  - `src/ui/town.js` : `cardHtml` (fiche échappée), `.townCard` au clic sur un joueur (Échap / clic ailleurs : fermée),
    barre `.townEmotes` dans le bandeau, `setJudgment(sides)` (appelé par `pollJudgment` dans `src/main.js`),
    `mergeOthers(prev, list, now)` (`emoteAt`). `src/main.js` : `friend` = `socialApi.request(id)`, `invite` =
    `partyApi.invite(id)` puis `pollLobby()`.
  - Textures : `town_banner_angel`, `town_banner_demon` (16 × 32), `town_pedestal` (32 × 16).
- **Tests** ✅ `tests/town.test.js` 17/17 (5 nouveaux : fiche + groupe sans code + seul + lfg ; émotes 400 / 429 /
  expiration / 401 ; statue + compte caché + cache ; place d'un groupe ; fiche échappée) ; `party`, `social`,
  `boot-check`, `wiki`, `game-http` : 74/74.
  ✅ Vérifié dans le navigateur (port 8001, données à part, comptes Test_Mineur / Test_Barbare de `dev:presets`) : fiche
  au clic (« Niv. 72 · 🪓 Barbare · 3615 GS »), « Inviter dans mon groupe » → invitation reçue, groupe rejoint → marque
  2/3 chez les deux, émote 👋, « ? » d'un joueur en recherche de groupe, statue grise du n°1 (Test_Logisticien), bannières.
- ⚠️ Pas vérifié : « Ajouter en ami » depuis la fiche (même appel que l'onglet Social), une tour ouverte (pulsation de la
  bannière), téléphone. Points fragiles : `ctx.filter` (statue grise) absent des vieux Safari : statue en couleur ;
  `game.leaderboardData` lit tous les comptes (cache `LEADERBOARD.cacheMs`), appelé au plus une fois par minute ici.

## 29/10/2026 (soir) — Le Carreau : direction artistique « Crépuscule de forge » (Jules)
- **Quoi** : choix de Jules parmi 3 maquettes (outil de maquettes, `.superpowers/brainstorm/`, non versionné) puis un
  essai jetable de 3 bâtiments dans le jeu (validé : « plus sombre, ciel en dégradé »).
  - `scripts/gen_town.py` (nouveau, importé par `scripts/gen_textures.py`, qui perd son ancienne fonction `town()`) :
    classe `Pix` (polygones, briques, moellons, planches, tuiles, fenêtres, portes en arc, `finish()` = contour noir
    extérieur 1 px + lumière rasante orange sur les pixels sous le ciel). 12 sprites de bâtiments `town_<nom>` (largeur
    ≤ w × 16, hauteur dans `h`), et le décor redessiné sous les mêmes noms (`town_lamppost`, `town_campfire`,
    `town_pedestal`, `town_banner_*`, `town_cobble`, `town_cloud`, `town_headframe`). **Supprimées** : `town_plank`,
    `town_stone_blue`, `town_roof_*` (+ `_edge`), `town_door`, `town_window`, `town_sign`, `town_mug`. Régénérer ne change
    aucune autre texture (vérifié avec git status).
  - `src/config.js` `TOWN.buildings` : `{ tab, name, kind, w, h, sprite, glows: [[x, y, r, 'magic'?]], smoke: [x, y] }`
    (`h` = hauteur du sprite en cases ; anciens champs `wall` / `roof` / `sign` / `chimney` retirés) ; place `h` 3 ;
    `TOWN.sky` (4 couleurs du dégradé), `TOWN.far` (2 falaises), `TOWN.fog`, `TOWN.groundDim` (0,5).
  - `src/render/town.js` : `drawSky` (dégradé + soleil + halo), `drawFar` (couleurs de config), `drawBuilding` (sprite
    centré sur sa place, halos en `lighter` qui respirent, fumée), plus de `drawHouse` / toits en escalier / enseignes ;
    sol hors de la rue = terre (plus d'herbe). `src/ui/town.js` : clic sur un bâtiment = sa hauteur `h`.
- **Tests** ✅ `tests/town.test.js` 18/18 (nouveau : chaque sprite existe, est dans `TEXTURES`, tient dans `w × h`, un
  sprite différent par bâtiment, halos / fumée dans le sprite, décor présent) + `wiki`, `boot-check`.
  ✅ Vérifié dans le navigateur (port 8001, compte Test_Mineur) : promenade de la Taverne au Concasseur, labels, halos,
  fumée, et derrière l'onglet Craft (lisible, tamisé).
- ⚠️ Pas vérifié : téléphone ; la Fonderie et la Tour du mage, très hautes, ont leur nom près du bandeau d'aide en
  haut de l'écran en promenade (il peut passer dessous). `ctx.filter` (rue assombrie, statue grise) : sans effet sur de
  vieux Safari (rue plus claire).
- **Retouches (retours de Jules, même soir)** : `scripts/gen_town.py` `mage_tower` (penche de 4 px au sommet, chapeau
  posé sur le haut de la tour, 2 fenêtres au lieu de 3), `training` (refaite), `armory` (enclume), `crusher` (refait,
  cheminée dans l'emprise), `jeweler` (gemmes en losange alignées), nouveaux `cliff` (96 × 192) et `gate` (96 × 144) ;
  halos / fumée mis à jour dans `TOWN.buildings`. `TOWN.margin` 7 (ancien 6), `TOWN.edges` ; `clampX` = entre
  `margin - 0.5` et `TOWN_WIDTH - margin + 0.5` (ancien 1 et `TOWN_WIDTH - 1`) : le serveur ramène aussi la position
  d'un joueur en promenade entre la falaise et la porte. Rendu : falaise collée au bord gauche, porte au bord droit.
  Tests ✅ `tests/town.test.js` 19/19 (nouveau : bords dans les marges, toute place devant un bâtiment entre les deux).
  ✅ Vérifié dans le navigateur : arrêt au pied de la falaise et devant la porte.
- **Retouches 2 (même soir)** : ordre de `TOWN.buildings` : Entrepôt en premier, Taverne juste avant la place.
  `scripts/gen_town.py` : `rock()` partagé, `gate()` = falaise en strates + palissade (112 × 192), ruban vert de la tour
  retiré (et son halo), billot de l'enclume recentré. Chat global en promenade : `setupTown` `onWalk(on)` + `chatSlot`
  (`.townChat`), `src/main.js` déplace `#gchatCard` dans `chatSlot` puis le remet à sa place dans le Lobby (`gchatHome`) ;
  `gchat` relu aussi quand `town.walking`. ✅ Vérifié dans le navigateur : message envoyé depuis la promenade (bulle au-
  dessus de moi + ligne dans le chat), carte revenue dans le Lobby après la promenade, falaise de droite. Tests ✅ town,
  boot-check, chat : 36/36.
- **Retouches 3** : `scripts/gen_town.py` `gate()` remplacé par `slagheap()` (`town_slagheap`, 112 × 192 ; `town_gate`
  supprimée), `TOWN.edges.right`. Chat en promenade : `placeChat()` dans `src/ui/town.js` (à la mise en promenade et au
  redimensionnement) : en bas à gauche, largeur = place à gauche de `.dock` (au plus `TOWN.chatMax` 360 px) ; moins de
  `TOWN.chatMin` (220 px) : au-dessus de la barre. ✅ Vu à 1600 et 1920 px de large (≈ 225 px et 360 px).
- **Mise en ligne (29/10)** : fusion de `origin/main` dans la branche (conflits seulement dans `docs/journal.md` et
  `docs/debug.md` : les deux côtés gardés). `main` est passé à la police VT323 (Jersey 10 n'est plus chargée) : les
  textes du canvas de la ville (`src/render/town.js`, `FONT`) passent en VT323, 11 px (noms) / 10 px (bulles, interligne
  9). Tests ✅ town, social, party, chat, boot-check, wiki, game-http, backdrop, skins : 124/124 ; vu dans le navigateur.

## 29/10/2026 — Correctif : liste du chat remise en haut quand elle se réaffiche (Jules)
- **Cause** : une liste cachée (onglet fermé, `display:none`) ou déplacée dans la page (carte du chat global en
  promenade) est remise en haut par le navigateur ; l'ancien test « on était en bas » était fait au moment du rendu, sur
  cette position remise à zéro, donc la liste ne redescendait plus.
- **Correctif** `src/ui/chat.js` : `stuckToEnd(el, prev)` (exporté) suivi à chaque défilement du joueur, état gardé
  quand la liste est cachée (hauteur 0) ; `toEnd()` après chaque rendu, à chaque changement de taille (`ResizeObserver` :
  réaffichage) et après le déplacement de la carte (`src/main.js` onWalk). Vaut pour les deux chats (session et global).
- **Tests** ✅ `tests/chat.test.js` (nouveau : en bas / remontée / cachée), `boot-check`. ✅ Vérifié dans le navigateur
  (15 messages) : 0 px du bas dans le Lobby, en promenade et au retour au Lobby.

## 29/10/2026 — Le Carreau : couleur des noms des bâtiments (Jules, demande de Geoffrey)
- `src/render/town.js` : constantes `LABEL` (#ffc27a, `--acc-lt` de style.css) pour les noms des bâtiments, la statue et
  les bannières, `HINT` (#ff7a2e, `--acc`) pour « E : entrer » et « Tour ouverte ! » (ancien : #f2ece4 / #ffc27a / #ffd27a).
  Pseudos des joueurs inchangés (src/render/miner-sprite.js). Tests ✅ town, boot-check ; vu dans le navigateur.

## 29/10/2026 — Prison : rendement vs mine à 3 (simulate:prison) (Geoffrey, branche geoffrey/prison) 🧪
- `scripts/simulate-prison.js` (`npm run simulate:prison`) : chaînes de runs de prison par heure de jeu contre la part d'un joueur d'une mine à 3
  (`runSession`, mêmes presets via `minerSpecs` ; stuff base / fer / acier). Défauts rapides (~2,5 min) ; mesure complète :
  `--count 3 --chains 10 --gears base,fer,acier --areas 1,3,5 --cache refs.json` (la référence à 3 coûte ~55 s la session). Avertit sous 10 chaînes.
- Mesure en pods (première version) : ratio 0,8–0,95 quel que soit `oreMul` (0,25 à 3) : les pods comptent aussi pierre et terre, le sac se remplit au même
  rythme, `oreMul` y pesait peu. D'où le changement de mesure (décision du 29/10) : on compare le POIDS DES MINERAIS (blocs de type `ore`), pods affichés à titre d'info.
- Mesure en minerais (mineur, area 5, 5 chaînes, ±0,1) : acier : 0,6 → 0,48 ; 0,55 → 0,56 ; 0,5 → 0,55 (contrôleur : 0,46 à 3 chaînes) ; 1 → 0,67 (contrôleur).
  fer : 0,6 → 0,62 ; 0,55 → 0,57 ; 0,5 → 0,43. Références : acier 1388 minerais/h, fer 1149 (sur 2873 / 2418 pods).
- **`PRISON.oreMul` = 0,52** (acier ≈ 0,5, fer ≈ 0,5 par interpolation ; non mesuré tel quel, incertitude ±0,1). Tests ✅ `tests/prison-sim.test.js` 14/14, aucune assertion changée
  (elles lisent `PRISON.oreMul`). À vérifier : mesure à 10 chaînes à 0,52, arbres logisticien/barbare, areas 1/3, stuff de base (mineur étourdi par les occultistes).

## 29/10/2026 — Prison et énergie : documentation et vérification finale (Geoffrey, branche geoffrey/prison) 🧪
- **Quoi** : docs seulement (`GAME_DESIGN.md` sections Énergie et Prison, `wiki.html` section `#prison` + sommaire + lien du lobby,
  `src/wiki/wiki.js` remplit les valeurs depuis `ENERGY` / `PRISON` / `AREA_H`, `tests/wiki.test.js` vérifie les ids,
  `claude/etat-du-projet.md`, `docs/journal.md`). Aucune règle changée.
- **Fichiers du chantier** : `src/config.js` (`ENERGY`, `PRISON`), `src/meta/energy.js`, `src/sim/prison.js` (+ world, ai, session, dungeon, mobs, trap),
  `src/shared/prison.js`, `server/game/service.js` (énergie, prison, paquets), `live.js`, `store.js`, `routes.js`, `src/ui/prison.js`, `lobby.js`, `src/main.js`,
  `scripts/simulate-prison.js`.
- **Vérification (29/10)** ✅ `node --test tests/energy*.test.js tests/prison*.test.js tests/area-max.test.js` + wiki : 80/80 puis wiki et boot-check 19/19 ;
  `npm run test:anticheat` 115/115 ; `npm run simulate -- --miners 3 --count 5` : 0 bloquée (areas 3,0, profondeur 190, coffre 4141 pods, 226 s) ;
  `npm run simulate:prison` (défaut, 3 chaînes) : acier / mineur area 5 : ratio minerais 0,47, 2,48 runs/h, run moyen 24 min.
  Mesure de référence à 10 chaînes (T5) : acier 0,48, fer 0,43, runs ≈ 24–31 min. ⚠ `tests/dev-spec.test.js` « lobby, mode dev : les tours… » échoue déjà sur main (non lié).
- **Chiffres** : `oreMul` 0,52 = valeur provisoire (fer un peu sous la cible ; si besoin ≈ 0,55 : fer ≈ 0,46, acier ≈ 0,51, estimé). Coût serveur ≈ 7 min de CPU par joueur
  et par jour à ×2 pour une prison 24 h/24 ; les paquets ×300 le concentrent, ne le réduisent pas.
- **À vérifier** : mesure à 10 chaînes à 0,52 pour les arbres logisticien / barbare, areas 1/3, stuff de base (mineur étourdi sans fin par les occultistes en area 5, run fini à `runMax`) ;
  passage en ligne : rattrapage de `areaMax` depuis `session_stat` (parcours à chaque fin de mine tant que areaMax = 0).
- **Points fragiles (mineurs repoussés, encore ouverts)** :
  - Énergie : `sanitizeEnergy(-Infinity)` → 100 ; `rollCost` non borné si `random` hors [0,1) ; clés d'énergie : mémoire de 200, une clé plus vieille peut être rejouée ;
    énergie écrite juste avant `putGameSession` (plantage entre les deux = énergie perdue, jamais dupliquée) ; tests manquants : tour (énergie inchangée), éviction des clés.
  - Lancement : peut arrêter la prison puis échouer (shrines / écriture de session) : rien de dupliqué, prison arrêtée à tort.
  - Prison, paquets : `batching` jamais nettoyé pour une prison arrêtée en plein paquet ; `prisonIndex` garde une promesse rejetée ; `runsClosed` ne fait que grandir et `pump` relit
    toutes les prisons ; `totals` / `away` perdent un run si le versement échoue après l'inventaire ; un arrêt volontaire compte dans `away` (> 30 s sans vue) ;
    `lastAbsence` ne garde que la dernière absence, est effacé dès l'envoi (perdu si la réponse n'arrive pas) ; présence en mémoire perdue au redémarrage (≤ 60 s) ;
    pas de test de `prisonStop` après `live.closeAll()`.
  - Sim : `G.endAt` et `G.duckBase` valent Infinity (→ null en JSON) ; `simulate:prison` par défaut bruité (3 chaînes) ; pas de plafond de ticks dans sa boucle.
  - Navigateur (⚠ à corriger avant mise en ligne) : bandeau calculé avec l'horloge locale au lieu de `serverNow()` (`main.js`) ; `syncAccount` → `setProgress` sans garde `st.ended` ;
    erreurs du sondage de la prison (401 / 500) seulement en console ; finitions : panneau « Area 0 » contre journal « contenu de l'area N », « Coffre commun » / « XP de la session » en solo,
    « Voir la prison » pendant une MI, pas d'état « chargement », couleur rouge par regex, logique `setPrison` non testée.
  - Décisions à faire trancher : résidus de prison sans jauges du Jugement ni Discord ; refus d'énergie sans compter le run en cours (un joueur à 5 dont le run rendrait 2 est refusé) ;
    treuil absent en prison (la récupération du sac de Mule reste prête pour le jour où).
