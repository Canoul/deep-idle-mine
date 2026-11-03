# Sets en menu et Stuff en mannequin (appli) — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dans l'appli, les Sets deviennent une ligne « Set : x ▾ » avec un menu qui monte du bas, et le Stuff un
mannequin avec deux onglets Équipement | Stats.

**Architecture:** `src/ui/sets.js` gagne deux fonctions d'affichage pures et, dans l'appli seulement, dessine la ligne et
le menu ; les actions restent celles d'aujourd'hui (même `onClick` / `send`). Le mannequin est surtout du CSS
(`src/app/app.css`) sur la grille existante `#stuffGrid` ; les onglets viennent de `src/app/perso.js`.

**Tech Stack:** JS vanilla, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-03-appli-perso-sets-stuff-design.md`

## Global Constraints

- Tout ce qui se voit est derrière `body.app` ; le site ne change pas (seul ajout côté site : un élément caché par `style.css`).
- Aucun appel serveur ni règle de set nouveaux ; Remplacer et Supprimer gardent leurs confirmations (`ask`).
- À 393 × 760 (`?app`), l'onglet Équipement montre les 13 cases sans défiler.

## Review Focus

1. Aucun set : la ligne dit « Set : aucun ▾ » et le menu propose « + Nouveau set » → test `setsBarHtml` / `setsSheetHtml` (Task 1).
2. Maximum de sets atteint : pas de « + Nouveau set » dans le menu → test (Task 1).
3. Demande en cours (`busy`) : boutons du menu grisés → test (Task 1).
4. Nom de set avec du HTML : échappé dans la ligne et le menu → test (Task 1).
5. Bouton retour Android menu ouvert : le menu se ferme (`setsSheet` dans `PANELS`) → vérifié à l'écran (Task 1).

---

### Task 1 : la ligne et le menu des Sets

**Files:**
- Modify: `src/ui/sets.js`, `src/app/device.js` (`PANELS`), `src/app/app.css`
- Test: `tests/sets.test.js`

**Interfaces:**
- Produces :
  - `export function setsBarHtml(current) -> string` : un `<button class="setBar" data-act="sheet">` avec « Set : <b>nom</b> » ou
    « Set : <span class="mut">aucun</span> » et « ▾ » ; `current` = `{ id, name } | null`.
  - `export function setsSheetHtml({ list, max }, { current = null, locked = false, busy = false, msg = '', more = null } = {}) -> string` :
    titre « Sets » et ✕ (`data-act="close"`) ; une `.setRow[data-set]` par set : nom (« ✔ équipé » sous le set porté),
    `data-act="equip"` (désactivé si porté ou `busy`), `data-act="more"` « ⋯ » ; si `more === id`, sous la ligne :
    `data-act="save"` Enregistrer, `data-act="rename"` Renommer, `data-act="delete"` Supprimer ; `data-act="create"`
    « + Nouveau set (ton équipement actuel) » si `list.length < max` ; phrase de session si `locked` ; `msg` en `.err`.
  - Dans l'appli, `setupSets` dessine `setsBarHtml` dans les hôtes et le menu dans `#setsSheet` (racine plein écran, enfant
    `.box`) ; clic sur la racine elle-même ou `close` → fermé ; `sheet` → ouvert ; `more` → déplie / replie ; après une
    réponse réussie à `equip`, fermé.

- [ ] **Step 1 : tests** (dans `tests/sets.test.js`) :
  - `setsBarHtml({ id:1, name:'barb' })` contient `data-act="sheet"`, « barb » et « ▾ » ; `setsBarHtml(null)` contient « aucun » ;
    `setsBarHtml({ id:1, name:'<b>' })` contient `&lt;b&gt;`.
  - `setsSheetHtml({ list:[{id:1,name:'barb'},{id:2,name:'Mineur'}], max:20 }, { current:{id:1} })` : 2 `data-act="equip"`,
    le premier `disabled`, « ✔ équipé » une fois, 2 `data-act="more"`, aucun `data-act="delete"`, « + Nouveau set » présent.
  - même liste avec `{ more:2 }` → exactement un `data-act="save"`, un `rename`, un `delete`, tous dans la ligne `data-set="2"`.
  - `max:2` → pas de « Nouveau set » ; `{ busy:true }` → `data-act="equip" disabled` pour les deux ; `{ locked:true }` →
    « prochaine session » ; `{ msg:'Oups' }` → `class="err"` et « Oups » ; liste vide → « + Nouveau set » et un texte
    « Aucun set ».
- [ ] **Step 2 : `node --test tests/sets.test.js`** → échec (fonctions absentes).
- [ ] **Step 3 : écrire les deux fonctions** ; dans `setupSets`, si `document.body.classList.contains('app')` : hôtes =
  `setsBarHtml(current)`, `#setsSheet` créé une fois (`hidden` par défaut) et redessiné par `render()` ; `onClick` gère
  `sheet`, `close`, `more` puis délègue le reste comme aujourd'hui ; fermeture après `equip` réussi.
- [ ] **Step 4 : `src/app/device.js`** : `'setsSheet'` ajouté à `PANELS`. **`src/app/app.css`** : `.setsCard` sans cadre ni
  titre dans l'appli, `.setBar` pleine largeur, `#setsSheet` (fond assombri, `.box` collée en bas au-dessus de la barre de
  l'appli, lignes de 52 px).
- [ ] **Step 5 : `node --test tests/sets.test.js tests/app-device.test.js`** → tout passe.
- [ ] **Step 6 : à l'écran** (`npm run dev`, `?app`) : Stuff, Skills, Sorts montrent la ligne ; le menu s'ouvre, « ⋯ » déplie,
  ✕ et l'écran assombri ferment ; « + Nouveau set » crée un set (pop-up habituelle) ; Équiper ferme le menu.
- [ ] **Step 7 : commit** « Appli : les Sets en une ligne, menu qui monte du bas ».

### Task 2 : le Stuff en mannequin

**Files:**
- Create: `src/app/perso.js`
- Modify: `src/ui/stuff.js` (`renderSlots` : gear score sous le portrait), `src/ui/style.css` (`.stuffHeroGs{display:none}`),
  `src/app/main.js` (démarrage de `perso.js`), `src/app/app.css`
- Test: `tests/app-perso.test.js`

**Interfaces:**
- Consumes : `gearScore(worn)` (src/meta/gearscore.js, déjà importé par stuff.js).
- Produces :
  - `renderSlots(el, worn, tag)` ajoute `<p class="stuffHeroGs">3 615 GS</p>` dans `.stuffHero`, sous le canvas.
  - `export function stuffTabsHtml(tab) -> string` (src/app/perso.js) : deux boutons `data-stab="gear"` « Équipement » et
    `data-stab="stats"` « Stats », la classe `on` sur `tab`.
  - `export function startPerso({ doc })` : insère `.stuffTabs` sous la ligne des Sets de la section Stuff ; un clic met la
    classe `stuffOnStats` sur la section quand « Stats » est choisi (retenu tant que la page est ouverte).

- [ ] **Step 1 : tests** (`tests/app-perso.test.js`) : `stuffTabsHtml('gear')` → `data-stab="gear"` a la classe `on`,
  pas `stats` ; `stuffTabsHtml('stats')` → l'inverse ; les textes « Équipement » et « Stats ».
- [ ] **Step 2 : lancer** → échec (module absent).
- [ ] **Step 3 : écrire `src/app/perso.js`**, l'appeler dans `startApp` ; `renderSlots` : la ligne du gear score ; `style.css` : cachée sur le site.
- [ ] **Step 4 : `src/app/app.css`** : `#stuffGrid` en 3 colonnes (6 cases à gauche, portrait, 7 à droite, `grid-auto-flow:column`,
  comme le PC), cases de 56 px, `.slbl` et `.sname` cachés, portrait agrandi (canvas ≈ 144 px), `.stuffHeroGs` montré ; onglet
  Équipement : `.stuffStatsCard` caché ; onglet Stats (`.stuffOnStats`) : `#stuffGrid` caché ; « Touche une case pour la
  changer » sous le mannequin ; `#spick .box` collée en bas (panneau qui monte du bas), pleine largeur.
- [ ] **Step 5 : `node --test tests/app-perso.test.js tests/stuff.test.js tests/app-families.test.js`** → tout passe.
- [ ] **Step 6 : à l'écran** : Stuff (Équipement) sans défiler à 393 × 760, 13 cases autour du mineur, gear score dessous ;
  Stats montre la carte complète ; toucher une case ouvre la liste en bas ; le site (sans `?app`) inchangé.
- [ ] **Step 7 : documentation** (journal en haut, debug en bas, état du projet) et commit « Appli : le Stuff en mannequin,
  onglets Équipement / Stats ».
