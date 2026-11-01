# Appli mobile, étape 2a : navigation en 5 familles — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dans l'appli (et avec `?app`), remplacer la barre de 15 onglets par 5 familles en bas de l'écran, et afficher l'Historique dans Session hors partie. Le site ne change pas.

**Architecture:** la couche `src/app/` n'est chargée que dans l'appli (import dynamique). Elle pilote la navigation existante (`nav.show`) sans la remplacer : la logique pure est dans `families.js`, l'affichage dans `bar.js` et `app.css`, l'assemblage dans `main.js`. `src/main.js` et `src/ui/nav.js` ne reçoivent que de petits points d'accroche.

**Tech Stack:** JavaScript en modules ES, sans dépendance ni bundler ; tests `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-28-appli-mobile-design.md`

**Découpage de l'étape 2** : 2a (ce plan) → 2b Session 1 → 2c Accueil et rendez-vous → 2d Stuff et Skills → 2e gestes au doigt. Le bouton retour d'Android est hors de ce plan : il demande un plugin, donc une nouvelle APK.

## Global Constraints

- **Le site ne change pas** : sans l'appli ni `?app`, seuls `src/app/boot.js` et `src/app/mode.js` se chargent ; jamais le CSS ni les écrans de la couche appli.
- Chaque règle CSS de `src/app/app.css` commence par `body.app`.
- Aucun import npm dans `src/`, aucune dépendance nouvelle, aucun script en ligne (`script-src 'self'`).
- Tout nouvel onglet de `TABS` doit être rangé dans une famille (test garde-fou).
- Les adresses `#inventaire`, `#craft`… continuent de marcher.
- Tout accès à `localStorage` est dans un `try/catch`.
- Commits : un sujet par commit, dernière ligne `Par : Geoffrey`. Branche `geoffrey/appli-interface` (worktree `F:\dim-appli-interface`). Pas de mise en ligne sans la demande de Geoffrey.
- Textes de l'interface en français.

## Review Focus

1. **Page rechargée pendant une session** : au démarrage, la session n'est pas encore connue ; le joueur doit revenir sur la mine, pas rester sur l'Historique (test Tâche 4).
2. **Fin de session** : le bilan s'affiche dans l'onglet Session alors que la partie est finie ; il ne doit pas être remplacé par l'Historique (test Tâche 4).
3. **Pastilles et guide** : l'ancienne barre est cachée ; une pastille (invitation, nouvel objet) ou l'onglet du guide doit se voir sur le bouton de famille et le sous-onglet (test Tâche 3).
4. **Tablette ou téléphone en paysage** : hors du format `CHAT.dock.phone`, le site renvoie Chat vers le Lobby ; dans l'appli, Chat doit s'ouvrir (test Tâche 3).
5. **Stockage indisponible ou périmé** : `localStorage` qui échoue, ou sous-onglet retenu qui n'existe plus, doit donner le premier sous-onglet, sans erreur (test Tâche 1).

---

### Tâche 1 : les familles (logique pure)

**Files:**
- Create: `src/app/families.js`
- Test: `tests/app-families.test.js`

**Interfaces:**
- Consumes: `TABS`, `CHAT_TAB` de `src/ui/nav.js`.
- Produces :
  - `FAMILIES` : tableau de `{ id, label, icon, tabs }`.
  - `familyOf(tabId) -> string | null`.
  - `tabsOf(familyId, { inSession }) -> string[]` : retire `session` de la famille Session si `inSession` est faux.
  - `targetTab(familyId, remembered, { inSession }) -> string` : le sous-onglet retenu s'il est valable, sinon le premier.
  - `tabLabel(tabId) -> string`.
  - `familyMarks(marks) -> Set<string>` : `marks` est un `Set` d'onglets marqués, le résultat un `Set` de familles.

- [ ] **Étape 1 : écrire le test qui échoue**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TABS, CHAT_TAB } from '../src/ui/nav.js';
import { FAMILIES, familyOf, tabsOf, targetTab, familyMarks } from '../src/app/families.js';

test('familles : les 5 de la spec, dans l\'ordre', () => {
  assert.deepEqual(FAMILIES.map(f => [f.id, f.tabs]), [
    ['accueil', ['lobby']],
    ['session', ['session', 'historique']],
    ['sac', ['inventaire', 'four', 'concasseur', 'craft', 'recherche']],
    ['perso', ['stuff', 'amelioration', 'skills', 'sorts']],
    ['social', ['social', 'guilde', 'chat']],
  ]);
});
test('garde-fou : chaque onglet du jeu est dans une seule famille', () => {
  for(const t of [...TABS, CHAT_TAB])
    assert.equal(FAMILIES.filter(f => f.tabs.includes(t.id)).length, 1, t.id);
});
test('adresses : #craft ouvre Sac, onglet inconnu : aucune famille', () => {
  assert.equal(familyOf('craft'), 'sac');
  assert.equal(familyOf('nimporte'), null);
});
test('hors session, la famille Session ne garde que l\'Historique', () => {
  assert.deepEqual(tabsOf('session', { inSession: false }), ['historique']);
  assert.equal(targetTab('session', 'session', { inSession: false }), 'historique');
  assert.equal(targetTab('session', 'historique', { inSession: true }), 'historique');
  assert.equal(targetTab('session', null, { inSession: true }), 'session');
});
test('sous-onglet retenu périmé : le premier de la famille', () => {
  assert.equal(targetTab('sac', 'ancien-onglet', { inSession: false }), 'inventaire');
  assert.equal(targetTab('sac', 'stuff', { inSession: false }), 'inventaire');
  assert.equal(targetTab('sac', 'four', { inSession: false }), 'four');
});
test('une pastille d\'onglet marque sa famille', () => {
  assert.deepEqual([...familyMarks(new Set(['guilde', 'craft', 'inconnu']))].sort(), ['sac', 'social']);
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/app-families.test.js`. Attendu : échec, module `families.js` introuvable.

- [ ] **Étape 3 : écrire `src/app/families.js`**

Libellés : Accueil, Session, Sac, Perso, Social. Icônes : `house`, `pickaxe`, `bag`, `helmet`, `group`. `tabLabel` lit `label` dans `[...TABS, CHAT_TAB]`.

- [ ] **Étape 4 : vérifier le succès**

Lancer `node --test tests/app-families.test.js`. Attendu : tous les tests passent.

- [ ] **Étape 5 : commiter**

`git add src/app/families.js tests/app-families.test.js`, message `Appli mobile : les 5 familles d'onglets`.

### Tâche 2 : charger la couche appli, seulement dans l'appli

**Files:**
- Create: `src/app/main.js`, `src/app/app.css`
- Modify: `src/app/boot.js`, `src/main.js:85-89` et `:288-291`
- Test: `tests/app-mode.test.js`

**Interfaces:**
- Produces :
  - `bootApp({ doc, win }) -> { status, app }` : inchangé pour le site.
  - `startApp({ doc, win, nav, shown }) -> { onTab(id) }` dans `src/app/main.js`, importé dynamiquement. `shown()` dit si l'onglet Session a quelque chose à montrer.

- [ ] **Étape 1 : écrire les tests qui échouent**

Dans `tests/app-mode.test.js`, avec le faux document du fichier :
- `bootApp sur le site : ni classe, ni lien CSS, viewport inchangé` ;
- `bootApp avec ?app : classe app, lien src/app/app.css, viewport-fit=cover` ;
- `bootApp pont ok : pas de badge` (retirer ou adapter le test du badge vert) ;
- `bootApp pont bloqué : le badge d'alerte reste`.

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/app-mode.test.js`. Attendu : échec sur le lien CSS, le viewport et le badge vert.

- [ ] **Étape 3 : modifier `boot.js`, créer `app.css` et `main.js`**

- `boot.js` : en mode appli, ajouter le `<link rel="stylesheet">` et `viewport-fit=cover` sur la balise viewport, par le code. Ne garder le badge que pour `blocked`.
- `app.css` : pour l'instant `body.app #nav{display:none}`.
- `main.js` : `startApp` renvoie `{ onTab(){} }`, rempli aux tâches 3 et 4.

- [ ] **Étape 4 : brancher `src/main.js`**

Garder le retour de `bootApp` dans `appBoot`, déclarer `let appLayer = null`, appeler `appLayer?.onTab(id)` à la fin du rappel de `setupNav`. Juste après `setupNav` :

```js
if(appBoot.app) import('./app/main.js').then(m => { appLayer = m.startApp({ doc:document, win:window, nav,
  shown: () => !!rec || inRoom() || prisonShown() || !$('end').hidden }); });
```

Vérifier que `inRoom` et `prisonShown` sont utilisables à cet endroit ; sinon, placer ce bloc après leur déclaration.

- [ ] **Étape 5 : vérifier**

Lancer `node --test tests/app-mode.test.js tests/mobile-config.test.js`. Attendu : tout passe.

- [ ] **Étape 6 : commiter**

`git add src/app tests/app-mode.test.js src/main.js`, message `Appli mobile : la couche appli se charge seulement dans l'appli`.

### Tâche 3 : la barre des familles et les sous-onglets

**Files:**
- Create: `src/app/bar.js`
- Modify: `src/app/main.js`, `src/app/app.css`, `src/ui/nav.js`, `src/ui/chat-dock.js:75`
- Test: `tests/app-bar.test.js`, `tests/nav.test.js` (fichier existant du sujet s'il y en a un ; sinon le créer)

**Interfaces:**
- Consumes: Tâche 1 ; `nav.show`, `nav.current`.
- Produces :
  - `barHtml({ active, marks }) -> string` : un bouton `data-family` par famille, classe `on` sur `active`, `<i class="dot">` si la famille est dans `marks`.
  - `subHtml({ family, current, marks, inSession }) -> string` : vide si la famille n'a qu'un sous-onglet, sinon un bouton `data-subtab` par onglet.
  - `nav.onMark(fn)` : `fn({ badges:Set, guide:string|null })` à chaque appel de `badge` ou `highlight`.
  - `phoneMode(media, body) -> boolean` exporté par `src/ui/nav.js` : vrai si le format correspond ou si `body` a la classe `app`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```js
test('barre : 5 boutons, famille active, pastille', () => {
  const h = barHtml({ active:'sac', marks:new Set(['social']) });
  assert.equal(h.match(/data-family=/g).length, 5);
  assert.match(h, /class="on"[^>]*data-family="sac"/);
  assert.match(h, /data-family="social"[\s\S]*class="dot"/);
});
test('sous-onglets : rien pour une famille d\'un seul onglet', () => {
  assert.equal(subHtml({ family:'accueil', current:'lobby', marks:new Set(), inSession:false }), '');
});
test('sous-onglets : la pastille est sur le bon onglet', () => {
  const h = subHtml({ family:'social', current:'social', marks:new Set(['guilde']), inSession:false });
  assert.equal(h.match(/data-subtab=/g).length, 3);
  assert.match(h, /data-subtab="guilde"[\s\S]*class="dot"/);
});
test('hors session, Session n\'a pas de sous-onglet à afficher', () => {
  assert.equal(subHtml({ family:'session', current:'historique', marks:new Set(), inSession:false }), '');
});
test('Chat s\'ouvre dans l\'appli sur un grand écran', () => {
  const body = { classList:{ contains: c => c === 'app' } };
  assert.equal(phoneMode({ matches:false }, body), true);
  assert.equal(phoneMode({ matches:false }, { classList:{ contains: () => false } }), false);
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/app-bar.test.js`. Attendu : échec, module `bar.js` introuvable.

- [ ] **Étape 3 : écrire `src/app/bar.js`**

Icônes avec `pxi` de `src/ui/pxicons.js`, libellés avec `tabLabel`. Le guide compte comme une marque : l'onglet `guide` est ajouté à `marks` avant l'affichage.

- [ ] **Étape 4 : ajouter les accroches de `src/ui/nav.js`**

Ajouter `onMark` et `phoneMode` ; remplacer `phone.matches` par `phoneMode(phone, document.body)` dans `nav.js`, et la même condition dans `chat-dock.js`. Sur le site, `phoneMode` rend `phone.matches` : le comportement ne change pas. Aucune écoute ne fonctionne sans `onMark`.

- [ ] **Étape 5 : assembler dans `src/app/main.js`**

- Ajouter `#appBar` en bas du `body` et `#appSub` en haut de `#views`.
- `onTab(id)` : retenir le sous-onglet par famille (clé `deepIdleMine.appFamilyTab`, `try/catch`), redessiner.
- Clic famille : `nav.show(targetTab(famille, retenu, { inSession: shown() }))`. Clic sous-onglet : `nav.show(id)`.
- Dessiner une première fois avec `nav.current()` : l'onglet de départ s'ouvre avant `startApp`.

- [ ] **Étape 6 : écrire le CSS**

Dans `app.css`, en « Forge noire » avec les variables existantes : `#appBar` fixe en bas, 5 colonnes égales, `padding-bottom:env(safe-area-inset-bottom)` ; `--dock-h` redéfini à la hauteur de cette barre ; `#appSub` défilant à l'horizontale si besoin ; haut de page avec `env(safe-area-inset-top)`. Zone de toucher d'au moins 44 px.

- [ ] **Étape 7 : vérifier**

Lancer `node --test tests/app-bar.test.js tests/app-families.test.js`, plus le test de `nav` et du chat s'il existe. Attendu : tout passe.

- [ ] **Étape 8 : commiter**

Ajouter les fichiers de la tâche, message `Appli mobile : barre des 5 familles et sous-onglets`.

### Tâche 4 : hors session, l'Historique à la place du Carreau

**Files:**
- Modify: `src/app/families.js`, `src/app/main.js`, `src/app/app.css`
- Test: `tests/app-families.test.js`

**Interfaces:**
- Produces: `sessionRedirect({ tab, shown, wasShown }) -> 'historique' | 'session' | null`.

- [ ] **Étape 1 : écrire le test qui échoue**

```js
test('Session sans rien à montrer : Historique', () => {
  assert.equal(sessionRedirect({ tab:'session', shown:false, wasShown:false }), 'historique');
});
test('bilan affiché : on reste sur Session', () => {
  assert.equal(sessionRedirect({ tab:'session', shown:true, wasShown:true }), null);
});
test('session retrouvée après rechargement : retour à la mine depuis l\'Historique', () => {
  assert.equal(sessionRedirect({ tab:'historique', shown:true, wasShown:false }), 'session');
});
test('Historique ouvert exprès pendant une session : on y reste', () => {
  assert.equal(sessionRedirect({ tab:'historique', shown:true, wasShown:true }), null);
});
test('session démarrée pendant qu\'on est dans le Sac : on ne bouge pas', () => {
  assert.equal(sessionRedirect({ tab:'craft', shown:true, wasShown:false }), null);
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/app-families.test.js`. Attendu : échec, `sessionRedirect` n'existe pas.

- [ ] **Étape 3 : écrire `sessionRedirect` et le brancher**

Dans `main.js` : appel dans `onTab`, et toutes les secondes par un `setInterval`, car aucun événement unique ne couvre mine, instantanée, tours, instance, Bloc géant et prison. Le sous-onglet Session réapparaît avec le même passage.

- [ ] **Étape 4 : cacher le Carreau**

Dans `app.css` : `body.app #bgTown{display:none}`. Vérifier que le fond de la page reste propre, et que le bouton de retour du bilan (qui mène au Lobby) marche.

- [ ] **Étape 5 : vérifier**

Lancer `node --test tests/app-families.test.js`. Attendu : tout passe.

- [ ] **Étape 6 : commiter**

Ajouter les fichiers de la tâche, message `Appli mobile : Historique hors session, pas de Carreau`.

### Tâche 5 : vérification et documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-10-28-appli-mobile-design.md` (si l'écart est constaté), `docs/journal.md`, `docs/debug.md`, `claude/etat-du-projet.md`, `docs/appli-mobile.md`, `CLAUDE.md` §7

- [ ] **Étape 1 : vérifier le site**

Avec `npm start` depuis le worktree, à 393 × 659 et 1440 × 900 sans `?app` : barre d'origine, Carreau présent, seuls `boot.js` et `mode.js` chargés depuis `src/app/`, aucune erreur en console.

- [ ] **Étape 2 : vérifier l'appli**

Avec `?app`, à 393 × 659 et 360 × 740 : chaque onglet s'ouvre en 2 touchers au plus, `document.documentElement.scrollWidth` égale la largeur de l'écran pour la barre et les sous-onglets, `#craft` ouvre Sac / Craft. Les débordements dans le contenu des écrans relèvent des plans 2b à 2d : les noter dans `docs/debug.md`.

- [ ] **Étape 3 : lancer les tests du sujet**

Lancer `node --test tests/app-families.test.js tests/app-bar.test.js tests/app-mode.test.js tests/mobile-config.test.js tests/mobile-icon.test.js`, plus le test de `nav` et du chat s'il existe. Attendu : aucun échec.

- [ ] **Étape 4 : écrire la documentation et commiter**

Entrées du journal et de debug, état du projet, structure dans `CLAUDE.md`. Message `Appli mobile : navigation en 5 familles, documentation`.

- [ ] **Étape 5 : demander l'essai à Geoffrey**

Pas de nouvelle APK : l'appli charge le site. L'essai sur Android se fait après la mise en ligne, que seul Geoffrey demande.
