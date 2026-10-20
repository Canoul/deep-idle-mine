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
- **Vérification** : ⚠️ inconnue (le message de commit ne le dit pas, et Node est absent de la machine ce jour-là).
- **À vérifier** : `node --test tests/goblin.test.js`. Simulation 5 sessions : regarder si `volés` est non nul en area 3+
  et si le mineur ne reste pas bloqué en tacle.

### Ouverture des Treasure T1 depuis l'inventaire — commit `e12c591`
- **Quoi** : un Treasure T1 s'ouvre dans l'onglet Inventaire, et le serveur tire le butin. Toujours : Blueprint parts
  5–15, charbon 100–150, fer 50–80. Plus un tirage par famille : blueprints (9 × 1 %) et gemmes (3 × 1 %). La demande
  est rejouable sans duplication (`opId`).
- **Fichiers** : `src/meta/loot.js` (nouveau), `src/meta/inventory.js`, `src/config.js` (`LOOT`, `ITEMS`),
  `server/game/service.js` (`open`), `server/game/routes.js` (`POST /api/game/open`), `src/net/api.js`, `src/main.js`,
  `src/ui/inventory.js`, `src/ui/style.css`, `index.html`, nouvelles textures (blueprint, bp_parts, gemmes).
- **Tests** : `tests/loot.test.js`, `tests/anticheat/open.test.js`.
- **Vérification** : ⚠️ **non lancée** (le commit le dit : Node absent).
- **À vérifier** : `node --test tests/loot.test.js`, `npm run test:anticheat` (ça touche l'inventaire).

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
- **Vérification** : ⚠️ **rien n'a tourné** (Node absent). Code relu seulement.
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
