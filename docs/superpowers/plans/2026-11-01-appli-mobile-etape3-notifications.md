# Appli mobile, étape 3 : notifications programmées — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'appli Android prévient le joueur, même fermée : session finie, mine instantanée dans 5 min, Bloc géant accessible, four fini. Chaque type se coupe dans Mon compte.

**Architecture:** une fonction pure calcule la liste des notifications à partir de l'état connu ; un petit module natif compare cette liste à ce qui est déjà programmé et applique la différence avec le plugin `@capacitor/local-notifications`. Le serveur ne change pas et n'envoie rien.

**Tech Stack:** Capacitor 8, `@capacitor/local-notifications` 8.x (dans `mobile/` seulement) ; JavaScript en modules ES ; tests `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-28-appli-mobile-design.md` (« Notifications », étape 3)

## Global Constraints

- **Le site ne change pas.** Aucun import npm dans `src/`. Tout accès natif passe par `src/app/native.js`, via `window.Capacitor.Plugins`.
- Le serveur ne reçoit aucune dépendance nouvelle ; le plugin est dans `mobile/package.json`.
- Une ancienne APK sans le plugin continue de marcher : pas de notification, pas de réglages, pas d'erreur.
- Quatre types : `session`, `mi`, `giant`, `four`. Tous activés par défaut. Pas de concasseur.
- Mine instantanée : 5 min avant l'ouverture, coupée de 23 h à 8 h, heure du téléphone. Rien dans le passé, pas de doublon.
- Valeurs réglables dans `src/config.js`, bloc `APP_NOTIFS` : `miBefore:300`, `quietFrom:23`, `quietTo:8`, `miAhead:24`.
- Les heures du serveur sont converties vers l'horloge du téléphone : `at - clockOffset`.
- Commits : un sujet par commit, dernière ligne `Par : Geoffrey`. Branche `geoffrey/appli-notifs` (worktree `F:\dim-appli-notifs`). Pas de mise en ligne sans la demande de Geoffrey.

## Review Focus

1. **Session quittée, finie ou relancée** : l'ancienne notification doit être annulée ou remplacée, sans alerte fausse (test Tâche 2).
2. **Ordre de mise en ligne** : le site en ligne doit fonctionner avec l'ancienne APK, et la nouvelle APK avec le site en ligne (test Tâche 2).
3. **Autorisation refusée sur Android 13+** : aucune erreur, aucune nouvelle demande à chaque ouverture (test Tâche 2).
4. **Compte changé ou déconnecté** : les notifications du compte précédent disparaissent (test Tâche 4).
5. **Horloge du téléphone en décalage** : une heure déjà passée après conversion ne déclenche rien (test Tâche 1).

---

### Tâche 1 : calculer les notifications

**Files:**
- Create: `src/app/notifs.js`
- Modify: `src/config.js`
- Test: `tests/app-notifs.test.js`

**Interfaces:**
- Consumes: `nextSlot` de `src/shared/instant.js` ; `ingotMs`, `batches` de `src/meta/furnace.js`.
- Produces :
  - `furnaceEnd(list, now) -> number | null` : la fin du dernier four en marche.
  - `planNotifs({ now, offset, sessionEnd, furnaces, giantNext, prefs, hourOf }) -> [{ id, kind, at, title, body, tab }]`. `now` est l'heure du serveur, `at` l'heure du téléphone, `hourOf(at)` l'heure locale.
  - `NOTIF_KINDS` : `[{ id, label }]`, pour les réglages.

Identifiants entiers stables : `session` 1, `four` 2, `giant` 3, `mi` 1000 + rang du créneau.

- [ ] **Étape 1 : écrire les tests qui échouent**

Tests, avec une heure fixe, `prefs` toutes vraies et `offset:0` sauf mention contraire :
- `session : une notification à la fin, qui ouvre Session` ;
- `session : aucune si elle est finie ou absente` ;
- `four : à la fin du dernier four en marche, pas une par four` ;
- `four : aucune si tout est à l'arrêt` ;
- `Bloc géant : à nextEntry, aucune s'il est déjà accessible` ;
- `mine instantanée : 5 min avant, pour les 24 prochains créneaux` ;
- `mine instantanée : rien de 23 h à 8 h, heure du téléphone` ;
- `mine instantanée : un créneau à 22 h 05 est gardé, un à 8 h 05 aussi` (bornes) ;
- `type coupé dans les réglages : aucune notification de ce type` ;
- `décalage d'horloge : at = heure serveur - offset, et rien dans le passé` ;
- `identifiants uniques`.

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/app-notifs.test.js`. Attendu : échec, module `notifs.js` introuvable.

- [ ] **Étape 3 : écrire `src/app/notifs.js` et `APP_NOTIFS`**

Textes :

| Type | Titre | Texte | Onglet |
|---|---|---|---|
| `session` | Session terminée | Ton mineur est remonté : viens voir le butin. | `session` |
| `mi` | Mine instantanée dans 5 min | Inscris-toi avant l'ouverture. | `lobby` |
| `giant` | Bloc géant accessible | Tu peux y retourner. | `lobby` |
| `four` | Four terminé | Tes lingots sont prêts. | `four` |

- [ ] **Étape 4 : vérifier le succès**

Lancer `node --test tests/app-notifs.test.js`. Attendu : tout passe.

- [ ] **Étape 5 : commiter**

Message `Appli mobile : calcul des notifications`.

### Tâche 2 : programmer sur le téléphone

**Files:**
- Create: `src/app/native.js`
- Test: `tests/app-native.test.js`

**Interfaces:**
- Consumes: la liste de `planNotifs`.
- Produces :
  - `notifPlugin(win) -> plugin | null`.
  - `askPermission(plugin, store) -> Promise<boolean>` : ne demande qu'une fois (clé `deepIdleMine.appNotifAsked`).
  - `syncNotifs(plugin, wanted, previous) -> Promise<Map>` : annule ce qui a disparu, programme ce qui est nouveau ou modifié, ne touche pas au reste.
  - `onNotifTap(plugin, fn)` : `fn(tab)` au toucher d'une notification.

- [ ] **Étape 1 : écrire les tests qui échouent**

Avec un faux plugin qui note les appels :
- `sans plugin : null, aucune erreur` ;
- `autorisation accordée : vrai, et une seule demande` ;
- `autorisation refusée : faux, pas de nouvelle demande à l'ouverture suivante` ;
- `stockage indisponible : aucune erreur` ;
- `nouvelle notification programmée avec allowWhileIdle` ;
- `session quittée : notification annulée` ;
- `heure changée : annulée puis reprogrammée` ;
- `rien de changé : aucun appel` ;
- `erreur du plugin : pas de crash, l'état précédent reste` ;
- `toucher : ouvre l'onglet de la notification`.

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/app-native.test.js`. Attendu : échec, module `native.js` introuvable.

- [ ] **Étape 3 : écrire `src/app/native.js`**

Appels du plugin : `checkPermissions`, `requestPermissions`, `schedule({ notifications })` avec `schedule:{ at:new Date(at), allowWhileIdle:true }` et `extra:{ tab }`, `cancel({ notifications:[{ id }] })`, `addListener('localNotificationActionPerformed', …)`.

- [ ] **Étape 4 : vérifier le succès**

Lancer `node --test tests/app-native.test.js`. Attendu : tout passe.

- [ ] **Étape 5 : commiter**

Message `Appli mobile : programmation sur le téléphone`.

### Tâche 3 : le plugin dans la coque Android

**Files:**
- Modify: `mobile/package.json`, `mobile/package-lock.json`, fichiers générés de `mobile/android/`, `tests/mobile-config.test.js`

- [ ] **Étape 1 : écrire le test qui échoue**

Dans `tests/mobile-config.test.js` : `coque : plugin des notifications dans mobile/, jamais à la racine`, et `POST_NOTIFICATIONS` dans l'`AndroidManifest.xml`.

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/mobile-config.test.js`. Attendu : échec.

- [ ] **Étape 3 : installer et synchroniser**

Dans `mobile/` : `npm install @capacitor/local-notifications@^8`, puis `npm run sync`. Ajouter `android.permission.POST_NOTIFICATIONS` au manifeste si le plugin ne l'apporte pas.

- [ ] **Étape 4 : vérifier**

Lancer `node --test tests/mobile-config.test.js`, puis pousser la branche et contrôler par l'API GitHub que l'APK se fabrique. Attendu : tests verts, fabrication réussie.

- [ ] **Étape 5 : commiter**

Message `Appli mobile : plugin des notifications dans la coque`.

### Tâche 4 : brancher dans le jeu et les réglages

**Files:**
- Modify: `src/app/main.js`, `src/main.js`, `tests/app-notifs.test.js`

**Interfaces:**
- Consumes: Tâches 1 et 2.
- Produces :
  - `startApp` reçoit en plus `notifData() -> { now, offset, sessionEnd, furnaces, giantNext, account }`.
  - `notifPrefs(store, account) -> { session, mi, giant, four }` et `setNotifPref(store, account, kind, on)`, dans `src/app/notifs.js`.
  - `appLayer.notifOptions() -> [{ key, label, on }]` et `appLayer.setNotif(kind, on)`.

- [ ] **Étape 1 : écrire les tests qui échouent**

- `réglages : tout activé par défaut` ;
- `réglages : un type coupé reste coupé pour ce compte` ;
- `compte absent : planNotifs reçoit prefs toutes fausses, donc aucune notification`.

- [ ] **Étape 2 : vérifier l'échec**

Lancer `node --test tests/app-notifs.test.js`. Attendu : échec sur `notifPrefs`.

- [ ] **Étape 3 : écrire et brancher**

- `src/main.js` : `notifData` lit `rec?.finishAt`, `clockOffset`, l'état des fours, `nextEntry` du Bloc géant (à relire au démarrage et après une visite) et le compte.
- `src/app/main.js` : `planNotifs` puis `syncNotifs` à l'ouverture, toutes les 30 s et au retour dans l'appli (`visibilitychange`) ; `onNotifTap` vers `nav.show`.
- `options()` de Mon compte : ajoute `appLayer?.notifOptions() ?? []` ; `setOption` transmet les clés `notif_…`.

- [ ] **Étape 4 : vérifier**

Lancer `node --test tests/app-notifs.test.js tests/app-native.test.js tests/app-families.test.js tests/app-bar.test.js tests/app-mode.test.js`. Attendu : tout passe.

- [ ] **Étape 5 : commiter**

Message `Appli mobile : notifications branchées, réglages dans Mon compte`.

### Tâche 5 : vérification et documentation

**Files:**
- Modify: `docs/appli-mobile.md`, `docs/journal.md`, `docs/debug.md`, `claude/etat-du-projet.md`, `CLAUDE.md` §6-7

- [ ] **Étape 1 : vérifier le site et l'aperçu**

Sans `?app`, puis avec `?app` dans Chrome : aucune erreur, aucun appel natif, pas de réglage de notification (pas de plugin dans un navigateur).

- [ ] **Étape 2 : écrire la documentation et commiter**

Guide : nouvelle APK à installer, essais à faire appli fermée, limites connues. Message `Appli mobile : notifications, documentation`.

- [ ] **Étape 3 : demander l'essai à Geoffrey**

Installer la nouvelle APK (désinstaller l'ancienne d'abord), puis tester les 4 notifications appli fermée.
