# Skills de l'appli (une classe à la fois, fiche d'un skill) — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dans l'appli, l'onglet Skills montre un arbre à la fois (onglets de classe), chaque skill avec son effet, des
maillons entre les cases, et une fiche qui monte du bas au lieu d'apprendre au premier toucher.

**Architecture:** `src/ui/skills.js` garde sa logique ; deux fonctions pures en plus (onglets, fiche) ; dans l'appli,
`render()` ne dessine que l'arbre de l'onglet choisi et un toucher ouvre `#skSheet`. Le style est dans `src/app/app.css`.

**Tech Stack:** JS vanilla, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-03-appli-skills-design.md`

## Global Constraints

- Tout ce qui se voit est derrière `body.app` ; sur le site, seul ajout : un `<span class="skTxt">` caché par `style.css`.
- Apprendre, reset et glyphes passent par le même `onOp` qu'aujourd'hui ; aucune règle nouvelle.
- Aucun trait par-dessus une case ; un maillon entre deux étages, orange si le skill du dessus est au max.

## Review Focus

1. Aucune classe choisie (`st.tree` null) : pas de « ★ ta classe », onglet de départ = Mineur, les trois arbres apprenables → test `skillTabsHtml` (Task 1).
2. Skill bloqué : la fiche dit pourquoi et n'a pas de bouton Apprendre → test `skillSheetHtml` (Task 1).
3. Skill au rang max : pas de ligne « Au rang suivant » → test (Task 1).
4. Pendant une session : apprendre reste possible, poser / retirer un glyphe non → test (Task 1).
5. Demande en cours (`busy`) : le bouton Apprendre est grisé → test (Task 1).

---

### Task 1 : onglets et fiche (fonctions pures)

**Files:**
- Modify: `src/ui/skills.js`
- Test: `tests/app-skills.test.js`

**Interfaces:**
- Produces :
  - `export function skillTabsHtml(view, { chosen = null, spec = {} } = {}) -> string` : un `<button data-sktab="<arbre>">` par
    arbre de `SKILLS.trees` (icône pixel `TREE_PX`, nom, « SP n » d'après `spec[arbre]?.level ?? 1`), `class="on"` sur `view`,
    « ★ ta classe » sur `chosen`.
  - `export function skillSheetHtml(st, nodeId, { inv = { slots:[] }, busy = false, session = false } = {}) -> string` :
    `data-act="close"` ✕ ; nom ; « <arbre> · étage <row> · rang r / max » ; « Maintenant » = `nodeText(id, r)` (« Pas encore
    appris » si r = 0) ; « Au rang suivant » = `nodeText(id, r + 1)` si r < max ; si le skill a un glyphe (`glyphSlot` ≠ 'none') :
    la ligne du glyphe et, si poser / retirer est possible hors session, un bouton `data-glyph` / `data-gact` ; puis
    `<button data-learn="<id>">APPRENDRE · 1 POINT</button>` si `blockedReason` est vide (désactivé si `busy`), sinon
    `<p class="skWhy">🔒 <raison WHY></p>` (rien de plus si 'maxed' : « Rang max »).

- [ ] **Step 1 : tests** (`tests/app-skills.test.js`, avec `st = { tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:2 }, points:20, spent:6, glyphs:{} }`) :
  - `skillTabsHtml('mineur', { chosen:'mineur', spec:{ mineur:{ level:72 } } })` : 3 `data-sktab`, `data-sktab="mineur" class="on"`, « ★ ta classe » une fois, « SP 72 » ;
    `skillTabsHtml('mineur')` : pas de « ta classe ».
  - `skillSheetHtml(st, 'ore_rush')` : « Ruée », « rang 2 / 5 », le texte de `nodeText('ore_rush', 2)` et celui de `nodeText('ore_rush', 3)`, `data-learn="ore_rush"`.
  - `skillSheetHtml(st, 'ore_rush', { busy:true })` : `data-learn="ore_rush" disabled`.
  - `skillSheetHtml(st, 'mine_speed')` (3/3) : pas de « Au rang suivant », pas de `data-learn`, « Rang max ».
  - `skillSheetHtml(st, 'travel_rush')` (autre arbre) : pas de `data-learn`, « Autre arbre choisi ».
  - `skillSheetHtml({ ...st, points:6 }, 'ore_rush')` : « Plus de points ».
  - un skill à glyphe au max avec le glyphe dans `inv` : bouton `data-gact="glyph_pose"` ; même chose avec `session:true` : pas de `data-gact`.
- [ ] **Step 2 : `node --test tests/app-skills.test.js`** → échec (exports absents).
- [ ] **Step 3 : écrire les deux fonctions** dans `src/ui/skills.js` (réutiliser `WHY`, `TREE_PX`, `NODE_PX`, `glyphSlot`, `glyphOf`, `GLYPHS.desc`).
- [ ] **Step 4 : `node --test tests/app-skills.test.js tests/skills.test.js tests/glyphs.test.js`** → tout passe.
- [ ] **Step 5 : commit** « Skills : onglets de classe et fiche d'un skill (fonctions pures) ».

### Task 2 : l'écran

**Files:**
- Modify: `src/ui/skills.js` (`setupSkills`, `treeHtml`), `src/ui/style.css` (`.skTxt{display:none}`), `src/app/app.css`, `src/app/device.js` (`PANELS`)

**Interfaces:**
- Consumes : `skillTabsHtml`, `skillSheetHtml` (Task 1).
- Produces : dans `treeHtml`, chaque case porte `data-nid="<id>"`, la classe `lk` si elle a un parent et `lk-on` si tous ses
  parents sont au max, et `<span class="skTxt">nodeText(id, max(r, 1))</span>` ; dans l'appli, `#skillTrees` =
  `skillTabsHtml(view, …)` + l'arbre `view` seul ; `#skSheet` (racine plein écran + `.box`), ouvert par un toucher sur une
  case, fermé par le fond / ✕ ; « Apprendre » et le glyphe appellent `send` ; la fiche reste ouverte et se redessine.

- [ ] **Step 1 :** `treeHtml` (données et effet), `style.css` (`.skTxt` caché sur le site) ; `setupSkills` : `view` (classe choisie,
  sinon 'mineur'), rendu appli, `#skSheet`, clics (`data-sktab`, `data-nid`, `data-learn`, `data-gact`, `close`, fond) ; sur le
  site le clic reste « apprendre » sur `data-node`.
- [ ] **Step 2 :** `device.js` : `'skSheet'` dans `PANELS`. `app.css` : onglets (3 colonnes), arbre en liste (`.skGraph` sans hauteur
  fixe, cases `position:static` en ligne : orbe 50 px + nom + effet sur 2 lignes, lignes SVG cachées), maillon `.lk::before`
  (gris, orange avec `lk-on`), étage double côte à côte, fiche en panneau du bas, `.skHead` sur une ligne.
- [ ] **Step 3 : `node --test tests/app-skills.test.js tests/skills.test.js tests/glyphs.test.js tests/app-device.test.js`** → tout passe.
- [ ] **Step 4 : à l'écran** (`?app`, 393 × 760) : onglets, arbre entier sans défiler (hors note de session / guide), maillons entre
  les cases, fiche d'un skill apprenable → Apprendre fait monter le rang et la fiche suit ; skill d'une autre classe → raison ;
  site sans `?app` inchangé.
- [ ] **Step 5 :** documentation (journal, debug, état du projet) et commit « Appli : Skills, une classe à la fois et fiche d'un skill ».
