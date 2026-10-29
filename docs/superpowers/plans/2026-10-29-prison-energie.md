# Prison et énergie — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** ajouter l'énergie (0 à 100, la mine classique coûte 6 à 12) et la Prison, un mode solo sans fin fait de
runs qui se remettent à neuf à 80 % des minerais, qui tourne hors ligne (24 h au plus) et recharge l'énergie.

**Architecture :** un run de prison est une partie de mine (`newSession`) avec des options `prison` : une area 0 dont
le contenu est celui de l'area max du joueur, pas de fin à l'heure, et une fin de run qui réutilise la remontée et le
bilan de fin de session. Le serveur garde une prison par compte (ns `prison`) et fait tourner le run en cours dans le
même moteur que les sessions (`server/game/live.js`), en direct si le joueur regarde, par paquets sinon. L'énergie
est un enregistrement par compte (ns `energy`), débitée au lancement d'une mine sous verrou.

**Tech Stack :** JS vanilla (modules ES), Node ≥ 20, `node --test`. Aucune dépendance.

**Spec :** `docs/superpowers/specs/2026-10-29-prison-energie-design.md`

## Global Constraints

- Toutes les valeurs dans `src/config.js` (`ENERGY`, `PRISON`) ; aucun nombre magique dans la logique (CLAUDE.md §8).
- Simulation sans DOM, ticks de 0,1 s (`DT`), déterministe par seed ; le rendu lit sans modifier.
- Le serveur fait foi : coût, recharge, plafond de 24 h, versements calculés par le serveur.
- Anti-duplication : chaque versement de run passe par une clé `prison:<id>:<run>` (inventaire, XP, énergie) ; un
  lancement de mine ne débite l'énergie qu'une fois (clé = id de session).
- Énergie : `max: 100`, départ `100`, coût entier tiré dans `[6, 12]`, refus sous `6`, recharge `8` par heure de jeu
  en prison, plafonnée à 100, gardée au dixième, affichée arrondie.
- Prison : `resetAt: 0.8` (des minerais du run), `runMax: 3 h` de jeu, `treasureMul: 0.5`, `rareMul: 0.5`,
  `offlineMax: 24 h` réelles, `batchMs: 10 min` réelles, pas de k hole, pas de shrines, pas de Gallianix.
- Seule la mine classique coûte de l'énergie ; mode dev : pas de coût (comme les shrines) ; bots exclus.
- Lancer une mine, une tour ou une instance termine la prison du ou des joueurs concernés (coffre versé, pas le sac) ;
  la mine instantanée et le Bloc géant non.
- Commits : un sujet par commit, message qui finit par `Par : Geoffrey` ; push sur `geoffrey/prison` ; jamais sur main.
- Langue : textes du jeu et commentaires en français.

## Review Focus

- Un run rejoué après un redémarrage du serveur (même seed, mêmes specs) doit verser exactement une fois → test dans la Tâche 6.
- Un joueur qui revient après 30 h : la prison a joué 24 h puis attendu, elle reprend sans rejouer les 6 h d'attente → test dans la Tâche 7.
- Deux lancements de mine simultanés avec 10 d'énergie : un seul passe, l'énergie ne devient jamais négative → test dans la Tâche 2.
- Un run qui ne peut jamais atteindre 80 % (mineur de base, minerais inaccessibles) se termine à `runMax` et repart → test dans la Tâche 4.
- La prison ouverte pendant qu'un membre du groupe lance une mine : sa prison se termine avant que la mine démarre, et il ne tourne jamais deux parties → test dans la Tâche 6.

---

### Tâche 1 : Énergie, logique pure

**Files :**
- Modify : `src/config.js` (après `LEADERBOARD`) : `export const ENERGY = { max: 100, start: 100, cost: { min: 6, max: 12 }, prisonPerHour: 8, memory: 200 }`
- Create : `src/meta/energy.js`
- Test : `tests/energy.test.js`

**Interfaces :**
- Produces : `createEnergy() → { value: 100, keys: [] }` ; `sanitizeEnergy(e) → énergie valide` (enregistrement absent
  ou `value` non numérique → `createEnergy()` ; sinon `value` ramenée dans 0..max et arrondie au dixième ; `keys` :
  chaînes seulement, les `ENERGY.memory` dernières) ;
  `canPay(e) → bool` (`value >= ENERGY.cost.min`) ; `rollCost(random) → entier 6..12` ;
  `spendEnergy(e, key, cost) → bool` (false si clé déjà vue, coût invalide ou valeur < cost ; sinon débite, mémorise la
  clé) ; `creditEnergy(e, key, amount) → bool` (false si clé vue ou montant invalide ; plafonne à `max`) ;
  `energyOfTicks(ticks) → nombre` (`ticks × DT / 3600 × prisonPerHour`, au dixième) ; `publicEnergy(e) → { value: arrondi, max }`.

- [ ] **Step 1 : tests** — `tests/energy.test.js` :
  - `createEnergy()` vaut `{ value: 100, keys: [] }` ; `sanitizeEnergy(null)` et `sanitizeEnergy({ value: 'x' })` → 100 ; `{ value: -5 }` → 0 ; `{ value: 150 }` → 100 ; `{ value: 42.46 }` → 42.5.
  - `rollCost` : avec `random` = 0 → 6, 0.9999 → 12 ; 10 000 tirages d'un PRNG : tous entiers dans [6, 12], chaque valeur sortie.
  - `spendEnergy(e, 's1', 9)` → true, value 91 ; même clé → false, value 91 ; `spendEnergy(e, 's2', 200)` → false ; coûts `-1`, `0.5`, `NaN`, `'9'` → false.
  - `canPay({ value: 5.9 })` false, `{ value: 6 }` true.
  - `creditEnergy(e, 'prison:a:1', 8)` → true ; même clé → false ; à 98 + 8 → 100 ; montants `-1`, `Infinity`, `NaN` → false.
  - `energyOfTicks(36000)` → 8 ; `energyOfTicks(4500)` → 1.
- [ ] **Step 2 :** `node --test tests/energy.test.js` → échoue (module absent).
- [ ] **Step 3 :** écrire `src/meta/energy.js` et `ENERGY`.
- [ ] **Step 4 :** `node --test tests/energy.test.js` → vert.
- [ ] **Step 5 :** commit « Énergie : logique pure (ENERGY, src/meta/energy.js) ».

### Tâche 2 : Énergie sur le serveur (coût au lancement d'une mine)

**Files :**
- Modify : `server/game/store.js` : ns `energy` (mémoire, fichier, PostgreSQL ; `getEnergy(id)`, `putEnergy(id, e)`, snapshot `energy`, `db.load([... 'energy' ...])`), commentaire d'en-tête ; `server/db/postgres.js` (liste des ns dans le commentaire).
- Modify : `server/game/service.js` : `start()` ; `state()` renvoie `energy: publicEnergy(...)`.
- Test : `tests/energy-server.test.js`, `tests/anticheat/energy.test.js`

**Interfaces :**
- Consumes : Tâche 1.
- Produces : dans `start()`, pour `mode === 'mine'` et `!dev` : sous les verrous `'energy:' + compte` de chaque joueur
  (ajoutés à `withLock.many`), refus `fail('no_energy', 409, "Pas assez d'énergie (6 au moins) : Zoe, Max.")` si un
  joueur ne peut pas payer ; sinon coût tiré par `rollCost(random)` pour chacun et `spendEnergy(e, rec.id, cost)` ;
  `rec.energy = { [compte]: coût }` (affiché au bilan). Rien n'est débité si le lancement échoue avant la création de
  la session (débit juste avant `store.putGameSession(rec)`, après tous les autres refus). `loadEnergy(id)` (lecture
  + `sanitizeEnergy`, départ si absent).

- [ ] **Step 1 : tests** — `tests/energy-server.test.js` (même `setup` que `tests/leaderboard.test.js` : `createMemoryGameStore`, `fakeLive`) :
  - nouveau compte : `state(A).energy` → `{ value: 100, max: 100 }` ;
  - lancer une mine solo : énergie entre 88 et 94, `rec.energy[A.id]` entre 6 et 12 ;
  - à 5 d'énergie (posée dans le store) : `start` rejette `code: 'no_energy'`, message avec « Zoe » ; aucune session créée ; énergie inchangée ;
  - groupe Zoe (50) + Max (3) : refus nommant Max seulement ; énergie de Zoe inchangée ;
  - tour, instance, mine en mode dev : énergie inchangée.
- [ ] **Step 2 :** `tests/anticheat/energy.test.js` : deux `start` simultanés (`Promise.allSettled`) à 10 d'énergie → une seule session, énergie ≥ 0 ; `start` rejoué après une erreur `session_running` ne débite pas.
- [ ] **Step 3 :** `node --test tests/energy-server.test.js tests/anticheat/energy.test.js` → échoue.
- [ ] **Step 4 :** store + `start()` + `state()`.
- [ ] **Step 5 :** les deux fichiers verts ; `node --test tests/game-service.test.js tests/leaderboard.test.js tests/instance-server.test.js` verts (les sessions de mine des tests existants partent à 100 d'énergie).
- [ ] **Step 6 :** commit « Énergie : coût de 6 à 12 au lancement d'une mine classique, refus sous 6 ».

### Tâche 3 : Area max du joueur

**Files :**
- Modify : `src/meta/level.js` : `createProgress()` et `sanitizeProgress()` gardent `areaMax` (entier ≥ 0, 0 par défaut) ; `raiseAreaMax(progress, k) → bool` (garde le max : rejouer la même fin de session ne change rien, pas besoin de clé).
- Modify : `server/game/service.js` : dans `settleWith`, mine classique non dev, pour chaque joueur présent : `raiseAreaMax(pr, summary.areasUnlocked)` sous le verrou `xp:` ; rattrapage une fois au premier `prisonStart` d'un compte sans `areaMax` connu : max de `areas` dans `store.allSessionStats()` pour ce compte.
- Test : `tests/area-max.test.js`

**Interfaces :**
- Produces : `progress.areaMax` (nombre) ; `areaMaxOf(accountId) → Promise<number>` dans le service (avec rattrapage).

- [ ] **Step 1 : tests** — `sanitizeProgress({ areaMax: 4 }).areaMax` 4 ; `-1`, `2.5`, `'3'` → 0 ; `raiseAreaMax` : 3 → true, puis 2 → false et reste 3, puis 3 → false. Serveur : une mine finie avec `areasUnlocked: 3` → `areaMax` 3 pour les présents, 0 pour un joueur parti ; rattrapage : deux lignes `session_stat` (areas 2 et 5) → `areaMaxOf` 5.
- [ ] **Step 2 :** `node --test tests/area-max.test.js` → échoue ; **Step 3 :** implémenter ; **Step 4 :** `node --test tests/area-max.test.js` vert, et les tests de progression existants (`ls tests | grep -i level`) verts.
- [ ] **Step 5 :** commit « Area max du joueur : gardée dans la progression, rattrapée depuis l'historique ».

### Tâche 4 : Simulation d'un run de prison

**Files :**
- Modify : `src/config.js` : `PRISON = { width: 30, resetAt: 0.8, runMax: 3 * 3600, returnMax: 600, treasureMul: 0.5, rareMul: 0.5, offlineMax: 24 * 3600e3, batchMs: 10 * 60e3, presentFor: 30e3, seenWriteMs: 60e3, bars: 24, salt: 0x9a150e }` ; bloc `24: { name:'Barreaux de prison', type:'special', tex:'prison_bars', unbreakable:true, … }` dans `BLOCKS` (copier la forme de `7: Barrière`) ; `'prison_bars'` dans `TEXTURES` ; texture dans `scripts/gen_textures.py` (barreaux gris foncé sur fond sombre) puis `npm run textures`.
- Modify : `src/sim/world.js` : `export const contentOf = (G, k) => G.prison ? G.prison.areaMax : k;` et `contentAt = (G, y) => contentOf(G, areaOf(y))` ; `genArea` lit composition, `chestChance` (× `treasureMul` si prison), `planDungeon` / `planTraps` / `treasureItem` avec `contentOf(G, k)` (placement inchangé : `areaTop(k)`) ; prison : colonnes hors de `[x0, x0 + width)` (centrées sur `CHEST_X` ; `SPAWN_X` et la colonne du treuil doivent y tomber, test à l'appui) remplies de `PRISON.bars`, pas de `placeKhole`, `tryUnlock` sans effet.
- Modify : `src/sim/mobs.js` (`tableOf`, `minArea`, `mobHp`, mimic, mur de chair), `src/sim/actions.js:125` (treasure), `src/sim/trap.js` : `areaOf(y)` → `contentAt(G, y)` pour le contenu ; `src/sim/dungeon.js` `planDungeon` : chance × `rareMul` en prison (seed et `k` de contenu passés par `genArea`).
- Modify : `src/sim/actions.js` : shiny (`SHINY.chance`), `glyphDrop` (`d.chance`), `rareDrop` (`chance`) × `G.prison ? PRISON.rareMul : 1`.
- Modify : `src/sim/mineur.js` : `export const timeLeft = G => (G.endAt ?? SESSION_LEN) - G.t;` ; `src/sim/ai.js` : les 8 `SESSION_LEN-G.t` → `timeLeft(G)`.
- Modify : `src/sim/session.js` : `newSession` accepte `opts.prison = { areaMax }` (pose `G.prison`, `G.endAt = Infinity`, pas de shrines même si `opts.shrines`, `G.duckBase` neutralisé) ; `tick` : `if(!G.prison && G.ticks >= SESSION_TICKS) endSession(G)`.
- Create : `src/sim/prison.js`
- Test : `tests/prison-sim.test.js`

**Interfaces :**
- Produces : `newPrisonRun(seed, { miner: spec, areaMax, run }) → G` (une seule spec de mineur, seed du run =
  `hash(seed, run) ^ PRISON.salt`) ; `prisonGoal(G) → nombre` (`Math.ceil(resetAt × G.areas[0].oreTotal)`) ;
  `tickPrison(G)` (un tick ; but atteint → `G.endAt = G.t` et journal « Run n : 80 % des minerais, remontée » ;
  `G.t >= runMax` → idem ; fin quand `G.endAt` fini et (mineur à `y <= 0` sans rien sur lui, ou `G.t >= G.endAt + returnMax`)) ;
  `endPrisonRun(G)` = `endSession(G)` puis `G.summary.mode = 'prison'`, `G.summary.run`, `G.summary.t` (la part du
  joueur `shares[0].bag` = coffre + glyphes trouvés, son sac exclu, comme une session).
- Produces : `contentOf(G, k)`, `contentAt(G, y)`, `timeLeft(G)`.

- [ ] **Step 1 : tests** — `tests/prison-sim.test.js` :
  - `newPrisonRun(7, { miner: {}, areaMax: 3, run: 1 })` : une seule area (`G.areas.length` 1, lignes = surface + `AREA_H`), composition = `areaComp(3)` (`G.areas[0].comp`), colonnes hors largeur = `PRISON.bars`, `BLOCKS[24].unbreakable` ; `G.endAt` Infinity ; `timeLeft(G)` Infinity.
  - mobs : sur 10 000 tirages de `tableOf` via un mineur à la ligne 10 d'une prison areaMax 5, les types sont ceux de `MOBS.spawnTable[5]` (aucun type absent de cette ligne).
  - `treasureMul` : sur 400 seeds, part des runs avec un treasure ≈ `areaDef(k).chestChance × 0.5` (écart < 0,05) pour `k = 2`.
  - rareMul : `glyphDrop` sur 20 000 blocs en prison ≈ moitié de la mine (même seed, écart relatif < 20 %).
  - pas de k hole (aucune case `KHOLE_BLOCK`), pas de shrine (`G.shrines` vide même avec `opts.shrines`), pas de Gallianix ni de nouvelle area après minage de toute la carte (forcer `G.areas[0].oreMined = oreTotal` puis `tickPrison` : `G.unlockedAreas` 1).
  - fin de run : mineur avec `mineSpeed: 5`, `pods: 2000` : boucle `tickPrison` jusqu'à `G.over` (≤ `runMax / DT + returnMax / DT` ticks) ; `G.areas[0].oreMined >= prisonGoal(G)` ; le mineur a fini à la surface ; `G.summary.mode` 'prison' ; `G.summary.shares[0].bag` contient des minerais.
  - `runMax` : mineur `mineSpeed: 0.05` : fin à `G.t <= runMax + returnMax` avec `oreMined < prisonGoal(G)`.
  - rejeu : deux runs même seed / même spec, 20 000 ticks → `JSON.stringify(G.chest)` égaux.
- [ ] **Step 2 :** `node --test tests/prison-sim.test.js` → échoue.
- [ ] **Step 3 :** implémenter (ordre : `timeLeft` + `ai.js`, puis `contentOf` / `genArea` / mobs, puis `prison.js`).
- [ ] **Step 4 :** `node --test tests/prison-sim.test.js` vert ; non-régression : `node --test tests/session.test.js tests/mobs.test.js tests/dungeon.test.js tests/trap.test.js tests/khole.test.js tests/flesh.test.js tests/view.test.js` verts ; `npm run simulate -- --miners 3 --count 5` : 0 blocage, moyennes au niveau de `docs/debug.md` (≈ 3 areas, ≈ 4 100 pods).
- [ ] **Step 5 :** mettre à jour la ligne « cristaux de pleine lune » de la spec : « les donjons (donc leurs cristaux) ont une chance × 0,5 ».
- [ ] **Step 6 :** commit « Prison : simulation d'un run (area de contenu, barreaux, fin de run à 80 %) ».

### Tâche 5 : Réglage du rendement (simulate:prison)

**Files :**
- Create : `scripts/simulate-prison.js` ; `package.json` : `"simulate:prison": "node scripts/simulate-prison.js"`.
- Modify : `src/config.js` : `PRISON.width` (et au besoin un `PRISON.oreMul`, multiplicateur de densité de minerais appliqué dans `genArea` en prison, s'il faut plus que la largeur).

**Interfaces :**
- Consumes : `newPrisonRun`, `tickPrison` ; presets de stuff de `src/shared/dev-presets.js`.
- Produces : sortie texte : pour chaque (preset, areaMax ∈ {1, 3, 5}) : pods rapportés par heure de jeu, runs par heure, durée moyenne d'un run, énergie par heure ; et la référence « mine à 3, part d'un joueur par heure » calculée avec `runSession` sur les mêmes presets (3 mineurs, `--count`).

- [ ] **Step 1 :** écrire le script (arguments `--count 5 --hours 4 --seed 1`), sortie avec le ratio `prison / (mine à 3 ÷ 3)`.
- [ ] **Step 2 :** lancer `npm run simulate:prison -- --count 5`, régler `PRISON.width` (puis `oreMul` si la largeur seule ne suffit pas) jusqu'à un ratio entre 0,45 et 0,55 pour les presets acier et fer.
- [ ] **Step 3 :** relancer `node --test tests/prison-sim.test.js` (vert avec la valeur finale).
- [ ] **Step 4 :** commit « Prison : rendement réglé à ≈ 50 % d'une mine à 3 (simulate:prison) » avec les chiffres dans `docs/debug.md`.

### Tâche 6 : Prison sur le serveur (lancer, runs, arrêt)

**Files :**
- Modify : `src/config.js` : `MINE_MODES` + `{ id:'prison', label:'Prison', icon:'⛓', ready:true, prison:true, solo:true }`.
- Create : `src/shared/prison.js` : `sanitizePrison(p)`, `newPrisonRecord({ account, seed, specs, areaMax, now }) → p`, `runRecord(p) → rec` (pseudo-session pour le moteur : `{ id: 'prison:' + p.id + ':' + p.run, mode: 'prison', seed, run, specs, areaMax, players: [{ account }], leaves: [], focus: [] }`), `buildPrisonRun(rec) → G`.
- Modify : `server/game/live-game.js` : `KINDS.prison = { build: buildPrisonRun, tick: tickPrison, end: endPrisonRun, events: () => {}, viewer: createViewer, endNow: true }` ; `finish()` : si `K.endNow`, `K.end(G)` sans jouer la suite.
- Modify : `server/game/store.js` : ns `prison` (`getPrison(id)`, `putPrison(id, p)`, `listPrisons()`).
- Modify : `server/game/service.js` : `prisonStart(me)`, `prisonStop(me)`, `settlePrisonRun(p, summary, { stopped })` ; dans `start()` (mine, tour, instance) : pour chaque joueur, `await stopPrisonOf(account)` sous son verrou avant la création de la session ; `state()` renvoie `prison: publicPrison(p)`.
- Modify : `server/game/routes.js` : `'POST /api/game/prison/start'`, `'POST /api/game/prison/stop'`.
- Test : `tests/prison-server.test.js`

**Interfaces :**
- Consumes : Tâches 2, 3, 4.
- Produces : enregistrement `p = { id, account, seed, run, specs, areaMax, runStartedAt, pausedMs, state: 'running' | 'waiting' | 'done', lastSeenAt, lastBatchAt, totals: { runs, energy, bag } }` ;
  `prisonStart(me)` → refus `prison_running` (déjà une), `session_running` (une session de mine / tour / instance en cours), `not_solo` (groupe de plusieurs au lobby : lu dans le service des groupes, comme `start`) ; specs figées comme `start()` (prefs, skills, sorts, stuff, anneaux du joueur) ; seed `randomSeed()`.
  `settlePrisonRun(p, summary, { stopped })` : sous `inv:` + `xp:` + `energy:` : `creditSession(inv, runId, bag)`, `creditXp(pr, runId, xp, spec)`, `creditEnergy(e, runId, energyOfTicks(summary.t / DT))` ; puis `stopped` → `state: 'done'` ; sinon `run + 1`, `runStartedAt = runStartedAt + pausedMs + summary.t / speed × 1000`, `pausedMs = 0`.
  `prisonStop(me)` / `stopPrisonOf(account)` : rejoue le run jusqu'au tick dû (`ensureLive` + `advance`), `live.finish(runId)` (fin immédiate), `settlePrisonRun(..., { stopped: true })` ; idempotent (prison `done` ou absente : rien).

- [ ] **Step 1 : tests** — `tests/prison-server.test.js` (moteur `createInlineRunner`, horloge contrôlée, `GAME.speed`) :
  - lancer : `state(A).prison.state` 'running', run 1 ; relancer → `prison_running` ; prison et mine : `start(A, {})` termine la prison avant de créer la session (prison `done`, coffre versé, une seule partie en direct pour A) ;
  - groupe : B a une prison, A lance une mine avec B → la prison de B est `done` avant la création de la session, `live.size` ne compte jamais deux parties pour B ;
  - versement de run : avancer l'horloge jusqu'à la fin du run 1 (pump) → inventaire + XP + énergie crédités une fois, `run` 2 ; fermer le moteur (`live.closeAll()`), rejouer la même avance → rien versé deux fois ;
  - arrêt : `prisonStop(A)` au milieu d'un run → coffre versé, sac du mineur non versé (comparer avec `G.miners[0].inv` juste avant), énergie au prorata, `state` 'done' ; deuxième `prisonStop` → sans effet ;
  - une tour et une instance lancées terminent la prison ; une inscription à la MI et une entrée au Bloc géant ne la terminent pas ;
  - mode dev : pas de coût d'énergie mais la prison recharge normalement.
- [ ] **Step 2 :** échoue ; **Step 3 :** implémenter ; **Step 4 :** `node --test tests/prison-server.test.js tests/game-service.test.js tests/instance-server.test.js` vert.
- [ ] **Step 5 :** `tests/anticheat/prison.test.js` : run rejoué après redémarrage → un seul versement ; deux `prisonStart` simultanés → une prison ; `prisonStop` + fin de run au même moment → un seul versement.
- [ ] **Step 6 :** commit « Prison : lancer, runs versés un à un, arrêt (coffre sans le sac) ».

### Tâche 7 : Rythme de la prison (présent, absent, plafond de 24 h)

**Files :**
- Modify : `src/shared/prison.js` : `prisonDueMs(p, now) → ms de jeu réel dus` (`min(now, lastSeenAt + offlineMax) - runStartedAt - pausedMs`), `touchPrison(p, now) → bool changé` (met `lastSeenAt` ; en `waiting`, ajoute `now - (lastSeenAt_ancien + offlineMax)` à `pausedMs` et repasse `running`), `isPresent(p, now)` (`now - lastSeenAt <= presentFor`), `batchDue(p, now)` (`now - lastBatchAt >= batchMs`).
- Modify : `server/game/service.js` : `pump()` : après les sessions, avec le budget restant, les prisons `running` présentes (comme une session, cible = `tickAt(prisonDueMs)`), puis les absentes dont `batchDue` (cible pleine, `lastBatchAt = now`), et `state: 'waiting'` quand la cible est plafonnée par `offlineMax` ; moteur fermé (`live.close`) après un paquet d'une prison absente ; `prisonView(me, since)` : `touchPrison` (écrit en base au plus toutes les `seenWriteMs`), joue le retard, renvoie `{ prison: publicPrison(p), view }` ; `state()` appelle aussi `touchPrison`.
- Modify : `server/game/routes.js` : `'GET /api/game/prison'` (`since` comme `/api/game/view`).
- Test : `tests/prison-server.test.js` (suite)

**Interfaces :**
- Consumes : Tâche 6.
- Produces : `publicPrison(p) → { state, run, goal, mined, energy, waitAt: lastSeenAt + offlineMax, away }` ; `away` = totaux
  (`runs`, `energy`, `bag`) accumulés depuis la dernière présence, remis à zéro par `touchPrison` quand le joueur
  revient après plus de `presentFor` (le navigateur affiche le bilan reçu une fois) ; `prisonView`.

- [ ] **Step 1 : tests** :
  - présent : vue demandée toutes les 10 s → le run avance au rythme normal (tick de la vue = `tickAt` du temps écoulé, à un pump près) ;
  - absent : aucune vue pendant 2 h → au plus un paquet toutes les 10 min (compter les `advance`), et à la fin des 2 h la prison est à jour à 10 min près ; le moteur est fermé entre deux paquets ;
  - bilan : absent 2 h avec 3 runs finis → la première vue au retour renvoie `away.runs` 3, la suivante 0 ;
  - plafond : absent 30 h → `state` 'waiting' à 24 h ; temps de jeu joué = 24 h réelles × vitesse (à un run près) ; retour (vue) → `running`, `pausedMs` ≈ 6 h, le run reprend au tick où il s'était arrêté (pas de saut de 6 h) ;
  - les sessions passent avant : avec une session de mine à l'heure et un budget `perPump` serré, la session atteint sa cible, la prison absente attend.
- [ ] **Step 2 :** échoue ; **Step 3 :** implémenter ; **Step 4 :** `node --test tests/prison-server.test.js tests/game-service.test.js` vert.
- [ ] **Step 5 :** commit « Prison : en direct si regardée, par paquets sinon, attente après 24 h ».

### Tâche 8 : Affichage (lobby, barre du haut, vue de la prison)

**Files :**
- Modify : `index.html` (jauge d'énergie dans `#nav` ; bouton « Sortir de prison » ; bandeau prison au-dessus de la mine : run, minerais / seuil, énergie, « pause dans … ») ; `src/ui/lobby.js` (choix « Prison » dans « Où miner » : grisé en groupe de plusieurs ; « Lancer » appelle `prison/start` ; coût « 6 à 12 ⚡ » à côté de « Lancer » pour la Mine ; message de refus `no_energy` tel quel) ; `src/net/api.js` (`prisonStart`, `prisonStop`, `prisonView(since)`) ; `src/main.js` (vue de la prison dans l'onglet Session : `applyView` + `renderer.draw` de la mine, sondage `prisonView` ; bilan d'absence une fois au retour) ; `src/ui/hud.js` ou nouveau `src/ui/prison.js` (bandeau et bilan, fonctions pures de texte) ; `src/ui/style.css`.
- Test : `tests/prison-ui.test.js`

**Interfaces :**
- Consumes : `publicEnergy`, `publicPrison`, `GET /api/game/prison`.
- Produces : `energyText(e) → '72 / 100'` ; `prisonBanner(p, now) → 'Run 4 · 61 / 80 % · pause dans 23 h'` ; `awayText(totals) → 'Pendant ton absence : 14 runs, + 112 énergie, …'`.

- [ ] **Step 1 : tests** — `energyText({ value: 72, max: 100 })` → `'72 / 100'` ; `prisonBanner({ state: 'running', run: 4, mined: 61, goal: 80, waitAt: now + 23 * 3600e3 }, now)` → contient `'Run 4'`, `'61 / 80'`, `'23 h'` ; `state: 'waiting'` → contient `'en pause'` ; `awayText({ runs: 14, energy: 112.4 })` → contient `'14 runs'` et `'112'` ; `awayText({ runs: 0 })` → `''` ; le lobby propose le mode (`MINE_MODES.some(m => m.prison && m.solo)`).
- [ ] **Step 2 :** échoue ; **Step 3 :** implémenter ; **Step 4 :** tests verts + `node --test tests/instant-ui.test.js tests/help.test.js tests/nav.test.js` verts.
- [ ] **Step 5 :** vérification à l'écran : `npm run dev`, compte local, lancer la prison, regarder 1 min, sortir ; capture avec Playwright (`chromium.launch()`, page `http://localhost:8000`) : bandeau, jauge, barreaux visibles.
- [ ] **Step 6 :** commit « Prison : lobby, jauge d'énergie, vue de la prison et bilan d'absence ».

### Tâche 9 : Documentation et vérification finale

**Files :**
- Modify : `GAME_DESIGN.md` (nouvelles sections Énergie et Prison, d'après la spec), `wiki.html` (section Prison et Énergie, date du bandeau), `claude/etat-du-projet.md` (nouveau système), `docs/journal.md` (entrée du haut), `docs/debug.md` (entrée technique : fichiers, tests, chiffres de `simulate:prison`, points fragiles : coût serveur, rejeu d'un run, plafond).

- [ ] **Step 1 :** écrire les docs.
- [ ] **Step 2 :** `node --test tests/energy*.test.js tests/prison*.test.js tests/area-max.test.js` vert ; `npm run test:anticheat` vert ; `npm run simulate -- --miners 3 --count 5` sans blocage ; `npm run simulate:prison -- --count 5` dans la cible.
- [ ] **Step 3 :** commit « Prison et énergie : documentation » ; push ; prévenir Geoffrey (rien en ligne avant son « mets en ligne »).
