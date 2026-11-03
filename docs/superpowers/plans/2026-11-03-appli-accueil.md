# Accueil de l'appli — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dans l'appli seulement, remplacer le premier écran (le Lobby) par un Accueil : bande du Carreau avec l'équipe,
activité choisie, rendez-vous ouverts, gros bouton d'action.

**Architecture:** logique pure dans `src/app/home.js` (testée), affichage dans `src/app/home-ui.js`, styles dans
`src/app/app.css`. Le Lobby (`src/ui/lobby.js`) garde toute sa logique et expose un instantané de son état et son action
de lancement ; l'Accueil ne refait aucune règle. Le Lobby complet reste derrière « Changer ▸ ».

**Tech Stack:** JS vanilla en modules ES, `node --test`, aucune dépendance.

**Spec:** `docs/superpowers/specs/2026-11-03-appli-accueil-design.md`

## Global Constraints

- Tout ce qui se voit est derrière `body.app` ; le site (PC et navigateur du téléphone) ne change pas.
- Aucune route serveur, aucune règle, aucun calcul de valeur nouveau.
- Valeurs dans `src/config.js` : `APP_HOME = { rdvShown: 2, miSoonMin: 30, sceneH: 320, scale: 2.5, scene: ['social', 'session', 'four'] }`
  (onglets des bâtiments de `TOWN.buildings` : Taverne, Chevalement, Fonderie).
- Le gros bouton appelle la même fonction que `#launchBtn` du Lobby (jamais une copie de sa logique).
- À 393 × 760 (aperçu `?app`), le gros bouton est visible sans défiler.
- Textes en français ; polices et cadres de la DA « Forge noire » (`textures/ui/`).

## Review Focus

1. Membre d'un groupe dont la prison tourne : « Je suis prêt » doit passer par la même confirmation que le Lobby → couvert par
   l'appel de `lobby.launch()` (Task 1), vérifié à la main en Task 3.
2. Chef dont un membre n'est pas prêt : bouton grisé **avec** « Pas prêt : X » → test `homeHtml` (Task 3).
3. Aucun rendez-vous : pas de carte vide → test `homeHtml` (Task 3).
4. Tour ouverte déjà gagnée (`done`) : pas proposée comme rendez-vous → test `rendezVous` (Task 2).
5. Hors ligne / pas de compte : pas de bouton actif, pas de rendez-vous → test `homeView` (Task 2).

---

### Task 1 : le Lobby expose son état et son lancement

**Files:**
- Modify: `src/ui/lobby.js` (render du bouton, `$('launchBtn').onclick`, objet renvoyé par `setupLobby`)
- Test: `tests/lobby.test.js`

**Interfaces:**
- Produces :
  - `export function launchFor(st) -> { can:boolean, label:string, action?:'ready'|'start'|'view', ready?:boolean }` :
    exactement ce que `render()` calcule aujourd'hui pour `#launchBtn` (prison → `prisonLaunchState`, sinon `launchState`, avec
    les remplacements « la tour » / « l'instance » quand `can`). `st` = l'état du Lobby (`mode`, `party`, `account`, …).
  - Dans l'objet renvoyé par `setupLobby` : `homeSnapshot()`, `launch()`, `openInvite()`, `openMenu()`, `pickMode(mode)` (déjà là),
    `join(code)` (déjà là).
  - `homeSnapshot() -> { account, offline, busy, party, slots, myTree, mode, prefs, launch, session, prison, energy, giantReady,
    hcReady, judgment, invites, miRegistered }` ; `slots` = `lobbySlots(...)` où chaque place membre porte `look` et `auras`
    (les siens via `h.look()` / `h.auras()`, ceux des autres via `portraitLook` / `portraitAuras`) ; `launch` = `launchFor(st)`.

- [ ] **Step 1 : tests de `launchFor`** (dans `tests/lobby.test.js`)
  - `launchFor` sur la mine classique, seul → `{ can:true, label:'▶ Lancer la session' }` (même résultat que `launchState`).
  - tour (`mode:'tower_demon'`, seul) → `label` contient « la tour ».
  - instance (`mode:'instance_1'`, groupe de 2 prêt, chef) → `label` = « ▶ Lancer l'instance à 2 ».
  - prison (`mode:'prison'`, seul, pas de prison) → `label` = « ⛓ Entrer en prison », `action:'start'`.
- [ ] **Step 2 : lancer `node --test tests/lobby.test.js`** → échec « launchFor is not a function ».
- [ ] **Step 3 : écrire `launchFor`**, et faire calculer `ls` par `launchFor(st)` dans `render()` (le bouton du Lobby ne change pas).
- [ ] **Step 4 : extraire le corps de `$('launchBtn').onclick` dans `async function launch()`** ; `$('launchBtn').onclick = launch` ;
  ajouter à l'objet renvoyé `launch`, `homeSnapshot`, `openMenu()` (= `showMenu`), `openInvite()` (passe sur l'activité si on
  est au menu, `st.inviteOpen = true`, `render()`, crée le groupe s'il n'y en a pas, comme `#inviteBtn`).
- [ ] **Step 5 : `src/main.js`** : `onState` de la mine instantanée fait aussi `lobby.update({ miRegistered: !!st.registered })`.
- [ ] **Step 6 : `node --test tests/lobby.test.js`** → tout passe.
- [ ] **Step 7 : commit** « Lobby : launchFor, launch() et homeSnapshot() pour l'Accueil de l'appli ».

### Task 2 : la logique de l'Accueil

**Files:**
- Create: `src/app/home.js`
- Modify: `src/config.js` (ajout `APP_HOME`, voir Global Constraints)
- Test: `tests/app-home.test.js`

**Interfaces:**
- Consumes : `homeSnapshot()` (Task 1) ; `appData = { now, sessionTimes: { startedAt, finishAt } | null, furnaces: [...] }`
  (heures du serveur) ; `MINE_MODES`, `PREF_OPTIONS`, `APP_HOME` ; `nextSlot`, `signupOpen` (src/shared/instant.js) ;
  `advance` (src/meta/furnace.js).
- Produces :
  - `rendezVous(snap, data) -> [{ id, title, state, button, act, now:boolean, at:number }]` ; `act` ∈
    `{ kind:'mode', mode }` · `{ kind:'tab', tab:'four' }` · `{ kind:'join', code }`. Ids : `giant`, `hescoming`,
    `tower_angel` / `tower_demon`, `mi`, `four`, `invite:<code>`. Tri : `now` d'abord, puis `at` croissant.
  - `mainButton(snap, data) -> { label, can, act, hint }` ; `act` ∈ `'launch'` · `{ kind:'mode', mode }` · `{ kind:'tab', tab:'session' }`.
  - `sceneTeam(snap) -> { away:boolean, places:[{ free:boolean, name, me, leader, ready, look, auras }] }` (3 places).
  - `activityLine(snap) -> { icon, title, sub }` (sub = libellés `PREF_OPTIONS` de `priority` et `fightMobs`, « Minerais · Combattre », pour la mine classique ; vide sinon).
  - `homeView(snap, data) -> { team, activity, session:{ title, left, pct } | null, rdv, more:number, main }` ; `rdv` = les
    `APP_HOME.rdvShown` premiers, `more` = le reste.

- [ ] **Step 1 : tests** (`tests/app-home.test.js`, avec un `snap` de base : seul, en ligne, mine classique)
  - `rendezVous` : `giantReady:true` → un `giant` « Prêt », `now:true`, bouton « Entrer », `act {kind:'mode', mode:'giant'}` ;
    `hcReady:true` → `hescoming` « Prêt », « Entrer ».
  - tour : `judgment.sides.demon = { open:true, done:false, openUntil: now + 3*3600e3 + 12*60e3 }` → `tower_demon`, état
    « Ouverte · encore 3 h 12 », bouton « Préparer » ; même tour avec `done:true` → absente.
  - mine instantanée : créneau dans 12 min → `mi` « Dans 12 min », « S'inscrire » ; créneau dans 50 min et pas inscrit →
    absente ; `miRegistered:true` → « Inscrit », bouton « Voir ».
  - four : un four dont `advance(f, now).out.qty > 0` → `four` « Lingots prêts », `act {kind:'tab', tab:'four'}`.
  - invitation `{ code:'K7Q4P2', from:'Brakk', members:['Brakk'], full:false }` → `invite:K7Q4P2` « Brakk t'invite », « Rejoindre ».
  - tri : giant (now) avant mi (dans 12 min).
  - `mainButton` : seul, mine classique → « LANCER », `act:'launch'`, `can:true`, hint « Coûte 6 à 12 ⚡ » (texte de
    `launchCostText`) ; membre pas prêt → « JE SUIS PRÊT » ; chef avec un membre pas prêt → `can:false` et label
    « Pas prêt : Brakk » ; `mode:'giant'` → « ENTRER », `act {kind:'mode', mode:'giant'}` ; `mode:'mi'` → « S'INSCRIRE » ;
    `session:{id}` → « VOIR LA SESSION », `act {kind:'tab', tab:'session'}` ; prison active → « VOIR LA PRISON ».
  - `homeView` : `offline:true` → `main.can === false` et `rdv` vide ; 5 rendez-vous → `rdv.length === 2`, `more === 3` ;
    en session → `session.left` = « fin dans 06:14 » pour `finishAt - now = 374 s` ; prison active (`prison.run = 3`) →
    `session.title` = « Prison · run 3 ». Le hint de LANCER est `launchCostText(snap.energy)` (src/ui/prison.js).
- [ ] **Step 2 : `node --test tests/app-home.test.js`** → échec (module absent).
- [ ] **Step 3 : écrire `src/app/home.js` et `APP_HOME`**. Libellés du gros bouton : majuscules, sans l'emoji de tête de
  `launchFor` (`label.replace(/^[^\p{L}\d]+/u, '')`, comme le Lobby).
- [ ] **Step 4 : `node --test tests/app-home.test.js tests/lobby.test.js`** → tout passe.
- [ ] **Step 5 : commit** « Appli : logique de l'Accueil (rendez-vous, gros bouton, équipe) ».

### Task 3 : l'écran

**Files:**
- Create: `src/app/home-ui.js`
- Modify: `src/app/main.js` (démarrage, famille Accueil), `src/main.js` (passe `lobby` et `appData` à `startApp`),
  `src/app/app.css`
- Test: `tests/app-home.test.js` (ajouts pour `homeHtml`)

**Interfaces:**
- Consumes : `homeView` (Task 2) ; `lobby.homeSnapshot / launch / openMenu / openInvite / pickMode / join` (Task 1) ;
  `drawPortrait(canvas, look, auras)` (src/render/portrait.js) ; `TOWN.sky`, `TOWN.buildings` (sprites des onglets d'`APP_HOME.scene`).
- Produces : `export function homeHtml(view) -> string` (pur) ; `export function startHome({ doc, nav, lobby, data }) -> { render(), show(), hide(), shown() }`.

- [ ] **Step 1 : tests de `homeHtml`** : gros bouton `can:false` → `disabled` **et** le texte « Pas prêt : Brakk » dans le HTML ;
  aucun rendez-vous → pas de `class="card hRdv"` ; `more:3` → « + 3 rendez-vous ».
- [ ] **Step 2 : lancer** → échec.
- [ ] **Step 3 : `homeHtml`** : `#appHome` > `.hScene` (ciel en bandes `TOWN.sky`, bâtiments `<img>` des sprites à × `APP_HOME.scale`,
  sol `town_cobble`, une `.hWho` par place : pseudo, « ✓ Prêt » / « pas prêt », `<canvas width="16" height="16">` ;
  « ? » doré pour une place libre ; en session, l'étiquette « ⛏ Ton équipe est au fond de la mine » à la place de l'équipe ;
  bouton Inviter) > `.card.hAct` (ou la carte de suivi en session) > `.card.hRdv` (si `rdv.length`) > `.hGo` (gros bouton + `hint`).
- [ ] **Step 4 : `startHome`** : insère `#appHome` en tête de `section[data-view="lobby"]`, `body.appHomeOn` quand il est montré ;
  redessine si le HTML a changé (comme `bar.js`) et redessine les portraits quand les `look` changent ; clics : `data-h="launch"` →
  `lobby.launch()`, `mode` → `hide(); lobby.pickMode(mode)`, `tab` → `nav.show(tab)`, `join` → `lobby.join(code)`, « Changer ▸ » →
  `hide(); lobby.openMenu()`, Inviter / « ? » → `hide(); lobby.openInvite()` ; un bouton « ← Accueil » en tête du Lobby quand
  l'Accueil est caché.
- [ ] **Step 5 : `src/app/main.js`** : `startApp` reçoit `lobby` et `appData` ; démarre `startHome` ; le `sync` par seconde appelle
  `home.render()` ; toucher la famille Accueil appelle `home.show()` (car `nav.show('lobby')` ne fait rien si on y est déjà).
  `src/main.js` : `appData: () => ({ now: serverNow(), sessionTimes: rec ? { startedAt: rec.startedAt, finishAt: rec.finishAt } : null, furnaces: furnace.state().list })`.
- [ ] **Step 6 : `src/app/app.css`** : styles de la maquette validée (`body.app #appHome …`), `body.app.appHomeOn .lobbyWrap{display:none}`.
- [ ] **Step 7 : `node --test tests/app-home.test.js tests/lobby.test.js tests/app-families.test.js tests/app-bar.test.js`** → tout passe.
- [ ] **Step 8 : vérification à l'écran** (`npm run dev`, `?app`, 393 × 760) : seul ; chef d'un groupe de 3 (Test_Mineur + 2
  comptes de test) ; membre ; en session ; avec rendez-vous (Bloc géant, four) ; Changer ▸ → activité → ← Accueil ; gros bouton
  visible sans défiler dans chaque cas. Captures comparées à la maquette.
- [ ] **Step 9 : documentation** dans le même commit : `docs/journal.md` (en haut), `docs/debug.md` (en bas),
  `claude/etat-du-projet.md` (Appli mobile → Accueil). Commit « Appli : écran d'Accueil (Carreau, activité, rendez-vous, gros bouton) ».
