# Guilde de l'appli — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sa guilde en 4 onglets dans l'appli. **Spec:** `docs/superpowers/specs/2026-11-04-appli-guilde-design.md`
**Architecture:** `mineAppHTML` pur dans `src/ui/guild.js` ; `setupGuild` choisit `mineHTML` (site) ou `mineAppHTML` (appli).

## Global Constraints
- `body.app` seulement ; mêmes actions `data-g` (give, build, invite, leave, message, more…).

## Review Focus
1. Demandes reçues (chef) : visibles dans Maison et Membres → test.
2. Bâtiment au maximum (pas de niveau suivant) : affiché sans matières → test.
3. Aucune entrée au journal : « Aucun don » → test.
4. Membre simple : pas de bouton « Inviter un joueur », « Quitter » présent → test.
5. `building` inconnu : le premier bâtiment → test.

### Task 1 : `mineAppHTML(g, older, { sub = 'house', building = null }) -> string`
**Files:** `src/ui/guild.js` ; test `tests/app-guild.test.js`.
- [ ] Tests : 4 `data-gsub`, celui de `sub` en `class="on"` ; house → « Maison de guilde » (scène), « Niveau 3 » ; members → les
  lignes `gmem`, `data-g="leave"` dans un `.gLeave` après la liste, pas d'« Inviter un joueur » pour un membre ; buildings →
  3 `data-gb`, un seul bâtiment affiché (le choisi, sinon le premier) ; log → « Journal des dons ».
- [ ] Rouge → écrire → vert → commit.

### Task 2 : l'écran
- [ ] `setupGuild` : `sub`, `bsel`, rendu appli, clics `data-gsub` / `data-gb` ; CSS (onglets, boutons de bâtiment, matières sur
  une ligne, `.gLeave` séparé) ; tests `app-guild`, `guild-ui`, `guild-buildings`, `guild-house` ; à l'écran avec une guilde
  locale (créée sur le compte de test) ; site inchangé ; documentation ; commit.
