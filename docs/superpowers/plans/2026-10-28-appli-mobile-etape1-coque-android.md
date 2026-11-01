# Appli mobile, étape 1 : la coque Android — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une APK Android de test, fabriquée par GitHub, qui ouvre deepmineidle.fr dans une coque Capacitor, sait
qu'elle tourne dans l'appli, et montre une page « pas de connexion » hors réseau ; le site reste identique.

**Architecture:** dossier `mobile/` (Capacitor 8, projet `android/` généré, page locale `www/offline.html`) qui charge
`https://deepmineidle.fr` par `server.url`. Côté jeu, un module `src/app/` importé par `src/main.js` détecte l'appli
(pont natif ou `?app`) et ne touche à rien d'autre sur le site. L'APK sort d'un workflow GitHub Actions (Java 21,
Node 22, `assembleDebug`).

**Tech Stack:** Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`), GitHub Actions, Python +
Pillow (icône), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-28-appli-mobile-design.md` (étape 1 de « Les étapes »).

## Global Constraints

- **Le site ne change pas** : sans appli ni `?app`, aucune classe, aucun élément, aucun CSS ajouté ; `index.html` n'est
  pas modifié.
- Racine : `package.json` garde `dependencies` = `{ pg }` seul. Capacitor seulement dans `mobile/package.json`.
- Aucun import npm dans `src/`, pas de bundler ; le jeu parle au natif par `window.Capacitor` (injecté par le pont).
- Capacitor **8.x** ; CI : **Node 22**, **Java 21 (temurin)** ; Android minSdk 24, compile/target 36 (valeurs du
  modèle Capacitor 8, ne pas les changer).
- Identité : `appId` **`fr.deepmineidle.app`**, `appName` **`Deep Mine Idle`**, `server.url`
  **`https://deepmineidle.fr`**, pas de `cleartext`.
- Dépôt public : aucun secret, aucune clé de signature dans git (étape 1 : clé de debug générée par la CI).
- Branche `jules/appli-mobile`, jamais `main`. Chaque commit finit par `Par : Jules` puis la ligne
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code et commentaires en français, un commentaire d'en-tête par fichier, comme le reste de `src/`.

## Review Focus

1. **Le pont natif bloqué par la politique de sécurité du serveur** (`script-src 'self'`) : l'APK doit le **dire à
   l'écran** (badge « APPLI ⚠ pont bloqué »), pas se comporter comme le site en silence → test `nativeStatus` cas
   `androidBridge` sans `Capacitor` (Task 1).
2. **Un joueur du site touché par la couche appli** : sans pont ni `?app`, `bootApp` ne doit faire **aucun** appel au
   document → test « site : aucun appel » (Task 1).
3. **Pas de réseau au lancement ou serveur en train de redémarrer** (chaque mise en ligne le redémarre) : page locale
   avec un lien « Réessayer » vers le jeu → test de `offline.html` (Task 2) + essai en mode avion (Task 5).
4. **Le joueur doit se reconnecter à chaque ouverture** : le cookie a un `Max-Age`, il doit survivre à la fermeture de
   l'appli → essai sur téléphone (Task 5, pas testable hors appareil).
5. **Mise à jour de l'APK refusée** (« Application non installée ») : chaque build CI a une clé de debug différente →
   écrit dans le guide : désinstaller avant de réinstaller (Task 5).

---

### Task 1: Détection de l'appli (`src/app/`)

**Files:**
- Create: `src/app/mode.js` (logique pure), `src/app/boot.js` (pose la classe et le badge)
- Modify: `src/main.js` (un import, un appel, près des autres réglages de démarrage)
- Test: `tests/app-mode.test.js`

**Interfaces:**
- Produces: `nativeStatus(win) → 'ok' | 'blocked' | 'web'` ; `isAppMode({ status, search }) → boolean` ;
  `bootApp({ doc, win }) → { status, app }`. La classe `app` sur `<body>` est ce que l'étape 2 utilisera.

- [ ] **Step 1: Écrire les tests**

```js
/* Couche appli (src/app/) : détection de l'appli, et rien sur le site. */
import { nativeStatus, isAppMode } from '../src/app/mode.js';
import { bootApp } from '../src/app/boot.js';

test('appli : pont natif présent', () => {
  assert.equal(nativeStatus({ Capacitor: { isNativePlatform: () => true } }), 'ok');
});
test('appli : pont Android sans Capacitor = bloqué', () => {
  assert.equal(nativeStatus({ androidBridge: {} }), 'blocked');
});
test('appli : navigateur', () => {
  assert.equal(nativeStatus({}), 'web');
  assert.equal(nativeStatus({ Capacitor: { isNativePlatform: () => false } }), 'web');
});
test('appli : ?app force la couche dans un navigateur, sinon rien', () => {
  assert.equal(isAppMode({ status: 'web', search: '?app' }), true);
  assert.equal(isAppMode({ status: 'web', search: '?app=1' }), true);
  assert.equal(isAppMode({ status: 'web', search: '' }), false);
  assert.equal(isAppMode({ status: 'web', search: '?seed=3' }), false);
  assert.equal(isAppMode({ status: 'ok', search: '' }), true);
  assert.equal(isAppMode({ status: 'blocked', search: '' }), true);
});
test('appli : site sans ?app → aucun appel au document', () => {
  const doc = new Proxy({}, { get(){ throw new Error('le site ne doit pas être touché'); } });
  assert.deepEqual(bootApp({ doc, win: { location: { search: '' } } }), { status: 'web', app: false });
});
```
Plus deux tests avec un faux document (`body.classList.add` et `body.append` qui notent leurs appels,
`createElement` qui rend un objet) :
- `?app` dans un navigateur → classe `app` posée, **pas** de badge ;
- pont `ok` → classe `app` + badge `id = 'appBadge'`, texte `APPLI ✓` ; pont `blocked` → texte `APPLI ⚠ pont bloqué`.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node --test tests/app-mode.test.js` — Expected: FAIL (`Cannot find module …/src/app/mode.js`).

- [ ] **Step 3: Écrire `src/app/mode.js` et `src/app/boot.js`**

`isAppMode` : `status !== 'web' || new URLSearchParams(search).has('app')`. `bootApp` lit `win.location.search`, ne
touche `doc` que si `app` est vrai. Le badge est **provisoire** (étape 1 seulement, remplacé à l'étape 2) : petit
cadre fixe en haut à droite, styles posés par `element.style` (la politique du serveur autorise les styles en ligne,
pas les scripts). En-tête de `boot.js` : dire que sur le site ce module ne fait rien.

- [ ] **Step 4: Brancher dans `src/main.js`**

`import { bootApp } from './app/boot.js';` avec les autres imports `./ui/…`, et `bootApp({ doc: document, win: window });`
au début du code de démarrage (avant la construction des onglets).

- [ ] **Step 5: Lancer les tests**

Run: `node --test tests/app-mode.test.js tests/boot-check.test.js` — Expected: tout PASS (boot-check retrouve
`src/app/*.js` parmi les fichiers chargés).

- [ ] **Step 6: Commit** — `Appli mobile : détection de l'appli (src/app/, classe app, badge provisoire)`

---

### Task 2: La coque Capacitor (`mobile/`)

**Files:**
- Create: `mobile/package.json`, `mobile/package-lock.json` (par `npm install`), `mobile/capacitor.config.json`,
  `mobile/www/index.html`, `mobile/www/offline.html`, `mobile/android/` (généré par `npx cap add android`)
- Test: `tests/mobile-config.test.js`

**Interfaces:**
- Produces: `mobile/android/` (projet Gradle utilisé par Task 3 et Task 4), commande `npm run sync` dans `mobile/`
  (= `cap sync android`).

- [ ] **Step 1: Écrire le test** `tests/mobile-config.test.js` (lit les fichiers, aucun réseau) :
  - `capacitor.config.json` : `appId === 'fr.deepmineidle.app'`, `appName === 'Deep Mine Idle'`, `webDir === 'www'`,
    `server.url === 'https://deepmineidle.fr'`, `server.errorPath === 'offline.html'`, `server.cleartext` absent ou faux ;
  - `mobile/www/offline.html` existe, contient `href="https://deepmineidle.fr/"` et aucune balise `<script` ;
  - `package.json` de la racine : `Object.keys(dependencies)` égal à `['pg']` ;
  - `mobile/package.json` : `dependencies` ⊂ `{ '@capacitor/core', '@capacitor/android' }`, `devDependencies` ⊂
    `{ '@capacitor/cli' }`, toutes en `^8.` ;
  - `server/config.js` : `SERVER.publicPaths` ne contient aucun chemin qui commence par `/mobile`.

- [ ] **Step 2: Lancer, vérifier l'échec** — `node --test tests/mobile-config.test.js` : FAIL (fichiers absents).

- [ ] **Step 3: Créer `mobile/package.json`** (`"private": true`, `"type": "module"`, script `"sync": "cap sync android"`)
  puis `cd mobile && npm install @capacitor/core@^8 @capacitor/android@^8 && npm install -D @capacitor/cli@^8`.

- [ ] **Step 4: Écrire `mobile/capacitor.config.json`** avec les valeurs du test, plus
  `"android": { "adjustMarginsForEdgeToEdge": "auto" }` **seulement si** la clé existe :
  `grep -n "errorPath\|adjustMarginsForEdgeToEdge" mobile/node_modules/@capacitor/cli/dist/declarations.d.ts`.
  Si `errorPath` n'existe pas : s'arrêter et le signaler (la page hors ligne doit alors passer par autre chose).

- [ ] **Step 5: Écrire `mobile/www/index.html`** (« Chargement… », sert seulement si `server.url` manquait) **et
  `mobile/www/offline.html`** : page autonome, styles en ligne aux couleurs de la Forge noire (fond `#191310`, texte
  `#f0e0c8`, bouton `#ff7a2e`), sans script. Texte exact :
  « **Pas de connexion au serveur du jeu.** » / « Vérifie ta connexion internet, puis réessaie. Si le jeu vient d'être
  mis à jour, il redémarre : réessaie dans une minute. » / lien-bouton « Réessayer » → `https://deepmineidle.fr/`.

- [ ] **Step 6: Générer le projet Android** — `cd mobile && npx cap add android && npx cap sync android`.
  Vérifier : `mobile/android/app/build.gradle` existe ; `mobile/android/.gitignore` ignore `build/` et
  `app/src/main/assets/public` ; `git status` ne montre ni `node_modules` ni `build/`.

- [ ] **Step 7: Regarder comment le pont est injecté** (pour savoir à quoi s'attendre sur le téléphone) :
  `grep -rn "DOCUMENT_START_SCRIPT\|addDocumentStartJavaScript\|JSInjector" mobile/node_modules/@capacitor/android/capacitor/src/main/java | head`.
  Noter le résultat dans l'entrée de `docs/debug.md` (Task 5) : injection par `addDocumentStartJavaScript` (non
  soumise à la politique de la page, a priori) ou par script en ligne dans le HTML (bloqué par `script-src 'self'`).

- [ ] **Step 8: Lancer le test** — `node --test tests/mobile-config.test.js` : PASS.

- [ ] **Step 9: Commit** — `Appli mobile : coque Capacitor 8 (mobile/, deepmineidle.fr, page hors ligne)`

---

### Task 3: L'icône

**Files:**
- Create: `scripts/gen_app_icon.py`, `mobile/assets/icon-1024.png` (pour iOS et les stores plus tard)
- Modify: `package.json` de la racine (script `"app:icon": "python scripts/gen_app_icon.py"`, aucune dépendance),
  les PNG `mobile/android/app/src/main/res/mipmap-*/ic_launcher*.png`,
  `mobile/android/app/src/main/res/values/ic_launcher_background.xml`
- Test: `tests/mobile-icon.test.js`

**Interfaces:**
- Consumes: `mobile/android/` (Task 2), `textures/pickaxe_steel.png` (16 × 16, RGBA).

- [ ] **Step 1: Écrire le test** : lit la largeur / hauteur dans l'en-tête PNG (octets 16-23, `readUInt32BE`) et vérifie,
  pour `mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi` : `ic_launcher.png` et `ic_launcher_round.png` = 48 / 72 / 96 / 144 / 192 px,
  `ic_launcher_foreground.png` = 108 / 162 / 216 / 324 / 432 px ; `mobile/assets/icon-1024.png` = 1024 px ;
  `ic_launcher_background.xml` contient `#191310`.

- [ ] **Step 2: Lancer, vérifier l'échec** (les PNG du modèle Capacitor n'ont pas la couleur attendue).

- [ ] **Step 3: Écrire `scripts/gen_app_icon.py`** (docstring en tête comme `gen_ui.py`) : la pioche agrandie d'un
  facteur **entier** au plus proche voisin (pixels nets), centrée ; fond `#191310` ; icônes classiques : pioche ≈ 60 %
  du côté ; avant-plan adaptatif : fond transparent, pioche ≈ 50 % du côté (dans la zone sûre 66/108) ; rond : même
  image découpée en disque. Réécrit `ic_launcher_background.xml` avec `#191310`.

- [ ] **Step 4: Lancer** `npm run app:icon` puis `node --test tests/mobile-icon.test.js` : PASS. Regarder
  `mobile/assets/icon-1024.png` (lecture de l'image) : pioche nette, centrée.

- [ ] **Step 5: Commit** — `Appli mobile : icône (pioche en acier, pixel art)`

---

### Task 4: L'APK fabriquée par GitHub

**Files:**
- Create: `.github/workflows/android-apk.yml`

**Interfaces:**
- Consumes: `mobile/` (Tasks 2-3). Produces: artefact `deep-mine-idle-apk` = `app-debug.apk`.

- [ ] **Step 1: Écrire le workflow** (nom « Appli Android (APK de test) ») : déclenché par `workflow_dispatch` et par
  `push` sur `mobile/**` ou ce fichier ; `ubuntu-latest` ; `actions/checkout@v4` ; `actions/setup-node@v4` (`22`, cache
  npm sur `mobile/package-lock.json`) ; `actions/setup-java@v4` (`temurin`, `21`) ; dans `mobile/` : `npm ci`,
  `npx cap sync android` ; dans `mobile/android/` : `chmod +x gradlew && ./gradlew assembleDebug` ;
  `actions/upload-artifact@v4` : `mobile/android/app/build/outputs/apk/debug/app-debug.apk`, rétention 30 jours.

- [ ] **Step 2: Commit et push** — `Appli mobile : APK de test fabriquée par GitHub Actions`, puis
  `git push`.

- [ ] **Step 3: Suivre la fabrication** — `gh run list --workflow android-apk.yml --limit 1` puis
  `gh run watch <id>`. Expected : succès. En cas d'échec, lire `gh run view <id> --log-failed`, corriger, recommencer
  (si `gh` n'est pas connecté : donner le lien de l'onglet Actions à Jules).

- [ ] **Step 4: Récupérer l'APK** — `gh run download <id> -n deep-mine-idle-apk -D <scratchpad>/apk` ; vérifier qu'un
  fichier `app-debug.apk` de quelques Mo est là.

---

### Task 5: Vérifier, documenter, faire tester

**Files:**
- Create: `docs/appli-mobile.md` (guide de l'équipe : récupérer l'APK, l'installer, les limites)
- Modify: `docs/journal.md` (en haut), `docs/debug.md` (en bas), `claude/etat-du-projet.md` (nouveau système « Appli
  mobile »), `CLAUDE.md` (§6 : commandes de `mobile/` et `npm run app:icon` ; §7 : `mobile/`, `src/app/`, `.github/`)

- [ ] **Step 1: Site inchangé** — serveur local isolé (`PORT=8124 DIM_DATA_DIR=<scratchpad> node server/main.js`,
  comptes `node scripts/dev-presets.js` avec le même `DIM_DATA_DIR`), playwright à 393 × 659 et 1440 × 900 **sans**
  `?app` : `document.body.classList.contains('app') === false`, pas de `#appBadge`, lobby et session comme le relevé du
  28/10. **Avec** `?app` : classe `app` présente, pas de badge. Couper les serveurs ensuite.

- [ ] **Step 2: Tests du sujet** — `node --test tests/app-mode.test.js tests/mobile-config.test.js tests/mobile-icon.test.js tests/boot-check.test.js` : tout PASS.

- [ ] **Step 3: Écrire `docs/appli-mobile.md`** : où télécharger l'APK (onglet Actions → dernière fabrication réussie
  → artefact, compte GitHub nécessaire) ; l'installer (autoriser « sources inconnues ») ; **désinstaller l'ancienne
  avant d'installer une nouvelle** (clé de debug différente à chaque fabrication ; rien n'est perdu, tout est sur le
  serveur, il faut juste se reconnecter) ; ce que montre le badge ; ce qui n'est pas encore là (interface téléphone,
  notifications, iOS).

- [ ] **Step 4: Docs de l'équipe** — journal (« Appli mobile : première APK Android de test », 🧪 sur la branche),
  debug (fichiers, tests, résultat du Task 2 Step 7, fabrication CI, ⚠️ ce qui reste à vérifier sur téléphone), état
  du projet, `CLAUDE.md`. Commit `Appli mobile : guide de test, docs de l'équipe` et push.

- [ ] **Step 5: Essai sur un vrai Android (Jules et un ami)** — liste à cocher, à remonter dans `docs/debug.md` :
  1. l'APK s'installe, l'icône pioche apparaît ;
  2. le badge dit **APPLI ✓** (si **⚠ pont bloqué** : **s'arrêter**, voir ci-dessous) ;
  3. connexion, lancement d'une session, la mine tourne ;
  4. fermer l'appli, la rouvrir : **toujours connecté** ;
  5. mode avion puis ouvrir l'appli : page « Pas de connexion » ; réseau revenu, « Réessayer » ramène au jeu ;
  6. bouton retour d'Android et lien Wiki : noter ce qui se passe (réglé à l'étape 2) ;
  7. barre du haut pas cachée sous la barre d'état du téléphone.

**Si le badge dit « pont bloqué »** : ne rien assouplir. Rapporter à Jules le résultat du Task 2 Step 7 et les options
(politique de sécurité différente pour l'appli seulement, reconnue à son agent utilisateur ; ou fichiers du jeu dans
l'appli, plan B de la spec), avec leurs conséquences sur la sécurité (`docs/securite.md`) : c'est une décision de
l'équipe.

**Pas de mise en ligne dans ce plan** : `main` seulement quand Jules le demande (`CLAUDE.md` §2). Rien de ce qui
arrive sur `main` ne change le site : `mobile/` et `.github/` ne sont pas servis, `src/app/` ne fait rien sans appli.
