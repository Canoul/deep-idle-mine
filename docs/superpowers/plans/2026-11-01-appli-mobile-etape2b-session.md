# Appli mobile, étape 2b : écran de session — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dans l'appli, afficher la mine en haut sur toute la largeur et, dessous, une seule carte à la fois (Équipe, Coffre, Area, Journal). Les autres écrans de jeu suivent la même mise en page. Le site ne change pas.

**Architecture:** tout passe par `src/app/` : `app.css` réorganise les écrans existants, `session.js` répartit les cartes de la mine classique en 4 onglets sans toucher à `index.html`. Le rendu, la caméra et les mises à jour du jeu ne changent pas.

**Tech Stack:** JavaScript en modules ES, CSS, sans dépendance ; tests `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-28-appli-mobile-design.md` (« Session »)

## Global Constraints

- **Le site ne change pas** : aucune modification de `index.html`, de `src/ui/style.css` ni de `src/render/`. Sans l'appli ni `?app`, `session.js` ne se charge pas.
- Chaque règle de `src/app/app.css` commence par `body.app`.
- La mine occupe 60 % de la hauteur disponible et toute la largeur.
- Pas de ligne oxygène / pods au-dessus de la mine (Geoffrey, 01/11) : ces chiffres restent dans la carte Mineur de l'onglet Équipe.
- Une carte que le jeu cache avec `hidden` reste cachée : la couche appli utilise sa propre classe, `appOff`.
- Commits : un sujet par commit, dernière ligne `Par : Geoffrey`. Branche `geoffrey/appli-session` (worktree `F:\dim-appli-session`). Pas de mise en ligne sans la demande de Geoffrey.

## Review Focus

1. **Bilan de fin de session** : il doit s'afficher en entier au-dessus de la barre du bas, avec ses boutons accessibles. À jouer en vrai en mode dev (Tâche 3).
2. **Téléphone en paysage** : à 740 × 360, la mine et ses onglets restent utilisables, sans défilement horizontal (Tâche 3).
3. **Session et Bloc géant en même temps** : la rangée « Ma session / Bloc géant » reste visible et les deux écrans s'échangent (Tâche 3).
4. **Prison** : son bandeau et sa carte de butin s'affichent ; la carte de butin est dans l'onglet Area (test Tâche 1, navigateur Tâche 3).
5. **Nouvelle carte ajoutée au site** : elle ne doit pas disparaître de l'appli (test garde-fou Tâche 1).

---

### Tâche 1 : les 4 onglets de la mine classique

**Files:**
- Create: `src/app/session.js`
- Modify: `src/app/main.js`
- Test: `tests/app-session.test.js`

**Interfaces:**
- Produces :
  - `SESSION_PANES` : tableau de `{ id, label, cards }`, où `cards` liste des sélecteurs d'un élément situé dans la carte.
  - `panesHtml(active) -> string` : un bouton `data-pane` par onglet, classe `on` sur `active`.
  - `setupSessionPanes(doc)` : ajoute `#appPanes` dans `#run .runGrid` et ouvre Équipe.

- [ ] **Étape 1 : écrire les tests qui échouent**

```js
test('onglets : Équipe, Coffre, Area, Journal', () => {
  assert.deepEqual(SESSION_PANES.map(p => p.label), ['Équipe', 'Coffre', 'Area', 'Journal']);
});
test('onglet actif marqué', () => {
  assert.match(panesHtml('coffre'), /class="on"[^>]*data-pane="coffre"/);
  assert.equal(panesHtml('coffre').match(/data-pane=/g).length, 4);
});
test('le butin de la prison est dans Area', () => {
  assert.ok(SESSION_PANES.find(p => p.id === 'area').cards.includes('#prisonLootCard'));
});
test('garde-fou : chaque carte de la mine classique a son onglet', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const run = html.slice(html.indexOf('<main class="runGrid">'), html.indexOf('</main>'));
  const parts = run.split('<div class="card"').slice(1);
  assert.ok(parts.length >= 8);
  const ids = SESSION_PANES.flatMap(p => p.cards).map(s => s.slice(1));
  for(const part of parts) assert.ok(ids.some(id => part.split('<div class="card"')[0].includes(`id="${id}"`)), part.slice(0, 80));
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/app-session.test.js`. Attendu : échec, module `session.js` introuvable.

- [ ] **Étape 3 : écrire `src/app/session.js`**

Répartition :

| Onglet | `cards` |
|---|---|
| Équipe (`equipe`) | `#teamBody`, `#minerTitle`, `#focusAreaCard`, `#focusCard` |
| Coffre (`coffre`) | `#chestBox` |
| Area (`area`) | `#areaCard`, `#prisonLootCard` |
| Journal (`journal`) | `#log` |

`setupSessionPanes` retrouve chaque carte avec `closest('.card')`, et un clic bascule la classe `appOff` sur les cartes des autres onglets.

- [ ] **Étape 4 : appeler `setupSessionPanes(doc)` dans `startApp`, vérifier**

Lancer `node --test tests/app-session.test.js tests/app-families.test.js`. Attendu : tout passe.

- [ ] **Étape 5 : commiter**

Ajouter les fichiers de la tâche, message `Appli mobile : 4 onglets sous la mine`.

### Tâche 2 : la mise en page des écrans de jeu

**Files:**
- Modify: `src/app/app.css`
- Test: `tests/app-session.test.js`

- [ ] **Étape 1 : écrire le test qui échoue**

```js
test('chaque règle de app.css vise body.app', () => {
  const css = readFileSync(new URL('../src/app/app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = css.replace(/\{[^{}]*\}/g, '\n').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  for(const s of selectors) assert.match(s, /^body\.app/, s);
});
test('la mine prend 60 % de la hauteur', () => {
  const css = readFileSync(new URL('../src/app/app.css', import.meta.url), 'utf8');
  assert.match(css, /--mine-h:60%/);
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/app-session.test.js`. Attendu : échec sur `--mine-h:60%`.

- [ ] **Étape 3 : écrire le CSS**

- `#run, #miRun, #twRun, #gtRun, #hcRun, #inRun` : `position:fixed`, `bottom:var(--dock-h)`, sans redéfinir `top` (la rangée « Ma session / Bloc géant » en dépend).
- En-tête sur une ligne : temps, barre, bouton Quitter réduit à son icône. Cachés : `#realLeft`, `#seedLbl`, `.perfBox`, et leurs équivalents des autres écrans.
- `.runGrid` : une colonne ; zone de mine à `flex:0 0 var(--mine-h)` ; `.rail` cachée ; canvas en `position:absolute` (l'ancienne règle téléphone le met `static`, ce qui empêche `fitMine` de lire la hauteur).
- Marges basses du jeu remises à 0 : `#run` s'arrête déjà au-dessus de la barre.
- Sous la mine : `#appPanes` (zone de toucher de 44 px) puis une zone défilante pour les cartes, les deux `aside` de la mine classique partageant cette zone.
- `body.app .appOff{display:none}`.
- Mine instantanée, tours, instance, Bloc géant et He's coming : mêmes règles, sans onglets, leurs cartes défilant sous le jeu.

- [ ] **Étape 4 : vérifier**

Lancer `node --test tests/app-session.test.js`. Attendu : tout passe.

- [ ] **Étape 5 : commiter**

Ajouter les fichiers de la tâche, message `Appli mobile : mine en haut sur les écrans de jeu`.

### Tâche 3 : vérification et documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-10-28-appli-mobile-design.md`, `docs/journal.md`, `docs/debug.md`, `claude/etat-du-projet.md`

- [ ] **Étape 1 : jouer les écrans en navigateur**

En `npm run dev` depuis le worktree, avec `?app`, à 393 × 659, 360 × 740 et 740 × 360 : mine classique (les 4 onglets), mine instantanée, tour, instance, Bloc géant, He's coming, session + Bloc géant ensemble, prison. Pour chacun : `scrollWidth` égal à la largeur de l'écran, canvas à la largeur de l'écran, aucune erreur, capture vérifiée à l'œil.

- [ ] **Étape 2 : jouer un bilan de fin de session**

En mode dev, aller jusqu'à la fin d'une session : bilan visible, boutons au-dessus de la barre et cliquables, retour au Lobby correct.

- [ ] **Étape 3 : vérifier le site**

Sans `?app`, à 393 × 659 et 1440 × 900 : `session.js` n'est pas chargé, écran de session inchangé, aucune erreur.

- [ ] **Étape 4 : lancer les tests du sujet**

Lancer `node --test tests/app-session.test.js tests/app-families.test.js tests/app-bar.test.js tests/app-mode.test.js tests/nav.test.js tests/fit.test.js`. Si `tests/fit.test.js` n'existe pas, le retirer de la liste. Attendu : aucun échec.

- [ ] **Étape 5 : écrire la documentation et commiter**

Dans la spec, retirer la ligne compacte oxygène / pods (décision du 01/11). Entrées du journal et de debug, état du projet. Message `Appli mobile : écran de session, documentation`.
