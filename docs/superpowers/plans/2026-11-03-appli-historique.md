# Historique de l'appli — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une ligne par session, regroupées par jour, bilan complet en panneau du bas, dans l'appli.
**Architecture:** fonctions pures dans `src/ui/history.js`, rendu appli dans `setupHistory`, style `src/app/app.css`.
**Tech Stack:** JS vanilla, `node --test`. **Spec:** `docs/superpowers/specs/2026-11-03-appli-historique-design.md`

## Global Constraints
- `body.app` seulement ; le site garde `sessionCard`.
- Quantités courtes par `fmtQty(n, { short:true })` (src/ui/inventory.js).

## Review Focus
1. Session « partie avant la fin » : la ligne et le bilan le disent, sans butin → test (Task 1).
2. Session sans butin : « Rien rapporté » → test (Task 1).
3. Mode inconnu (ancienne session) : « Session » et ⛏ → test (Task 1).
4. Pseudos avec du HTML : échappés → test (Task 1).
5. Liste vide : bouton « Lancer une session ▸ » → test (Task 1).

### Task 1 : fonctions pures
**Files:** Modify `src/ui/history.js` ; Test `tests/app-history.test.js`.
**Produces:**
- `dayLabel(ms, now) -> string` : « AUJOURD'HUI », « HIER », sinon « JJ/MM » (heure locale).
- `topLoot(bag, n = 3) -> [[item, qty]]` : tri par `rarityDef(item).rank` décroissant puis quantité décroissante.
- `sessionRowHtml(s, i, me = null) -> string` : `<button class="hiRow" data-hi="<i>">` ; nom du mode (`MINE_MODES`, « Session » si
  inconnu) et heure ; durée (`lasted`), « solo » ou « avec … » (joueurs sauf `me`), « area N » pour la prison ; `topLoot` en
  icônes avec `fmtQty` court ; « +N XP » (`fmtQty` court) ; « Parti avant la fin » si `s.left`.
- `sessionDetailHtml(s) -> string` : ✕ `data-act="close"` ; titre (mode · `when`) ; durée, joueurs, areas, profondeur, XP,
  ligne prison ; grille de tout le butin (`icon`, quantité courte, `tipAttr` pour le nom) ou « Rien rapporté » / « Parti avant
  la fin : rien reçu » ; `🌱 seed` en petit.
- `historyListHtml(sessions, now, me) -> string` : intertitres par `dayLabel` + lignes ; liste vide : message + `<a class="btn on" href="#lobby">Lancer une session ▸</a>`.
- [ ] Tests (assertions des 5 points du Review Focus, plus : `dayLabel` aujourd'hui / hier / « 30/10 » ; `topLoot` met
  « Diamant » avant 2 756 « Pierre » ; `sessionRowHtml` contient « Prison » et « area 6 » pour une prison, « +5,5k XP » pour
  5 589 XP) → rouge → écrire → vert → commit.

### Task 2 : l'écran
**Files:** Modify `src/ui/history.js` (`setupHistory`), `src/app/app.css`, `src/app/device.js`.
- [ ] Appli : `historyListHtml` dans `#histBody`, `#hiSheet` (fond / ✕ = fermé) ouvert par une ligne avec `sessionDetailHtml` ;
  `me` = pseudo du compte (paramètre `me()` de `setupHistory`, passé par `src/main.js`).
- [ ] CSS : lignes (grille icône / texte / butin), intertitres, panneau du bas, grille du butin ; `hiSheet` dans `PANELS`.
- [ ] Tests `app-history`, `history` (s'il existe), `app-device` ; à l'écran avec une vraie session locale ; site inchangé ;
  documentation ; commit.
