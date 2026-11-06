# Sorts de l'appli — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fiche du sort en panneau du bas dans l'appli ; toucher la barre ouvre la fiche au lieu de retirer.
**Architecture:** `renderInfo` devient la fonction pure `spellInfoHtml` ; `setupSpells` la met dans `#spellInfo` (site) ou
dans `#spSheet` (appli). Style dans `src/app/app.css`.
**Tech Stack:** JS vanilla, `node --test`. **Spec:** `docs/superpowers/specs/2026-11-03-appli-sorts-design.md`

## Global Constraints
- `body.app` seulement ; le site garde sa fiche à droite / en bas et le retrait au clic sur la barre.
- Mêmes `onOp` (equip, unequip, learn) ; aucune règle nouvelle.

## Review Focus
1. Sort dans la barre qui « n'agit pas » (autre spé) : la fiche le dit et propose Retirer → test (Task 1).
2. Parchemin en poche : « Apprendre le parchemin » → test (Task 1).
3. Sort pas débloqué : barre de progression de spé, pas de bouton → test (Task 1).
4. Demande en cours : boutons grisés → test (Task 1).
5. Emplacement libre de la barre touché : rien ne s'ouvre, il devient la cible du prochain sort (comme aujourd'hui) → à l'écran (Task 2).

### Task 1 : `spellInfoHtml` (pur)
**Files:** Modify `src/ui/spells.js` ; Test `tests/app-spells.test.js`.
**Produces:** `export function spellInfoHtml(st, id, { ctx = { tree:null, spec:{} }, owned = 0, busy = false, into = null, close = false } = {}) -> string`
(`into` : le sort déjà dans l'emplacement visé, pour « Remplacer X » ; `close` : ajoute le ✕ `data-act="close"`), même
contenu que `renderInfo` aujourd'hui (titre « Fiche du sort » seulement si `!close`).
- [ ] Tests : sort prêt → `data-act="equip"` « Mettre dans la barre » ; avec `into:'dynamite'` → « Remplacer Dynamite » ;
  sort dans la barre → `data-act="unequip"` ; dans la barre sans la bonne spé → « N'agit pas » + unequip ; parchemin
  possédé (`owned:1`) → `data-learn` ; sort de spé pas atteinte → `class="spProg"` et aucun `data-act` ; `busy` → `disabled` ;
  `close:true` → `data-act="close"`.
- [ ] Lancer → échec ; écrire la fonction (`renderInfo` l'appelle) ; lancer `node --test tests/app-spells.test.js tests/spells.test.js` → vert ; commit.

### Task 2 : l'écran
**Files:** Modify `src/ui/spells.js` (`setupSpells`), `src/app/app.css`, `src/app/device.js`.
- [ ] Appli : `sheetOpen` ; tuile touchée → `cur` + fiche ouverte ; emplacement rempli touché → fiche de ce sort (pas de retrait) ;
  `#spSheet` (racine plein écran + `.box`, fond / ✕ → fermé) avec les mêmes actions que `#spellInfo` ; `#spellInfo` caché.
- [ ] CSS : barre compacte (`.spBarNote` réduite à une ligne), grille 3 colonnes, filtres en rangée, fiche en panneau du bas ;
  `spSheet` dans `PANELS`.
- [ ] Tests `app-spells`, `spells`, `app-device` ; à l'écran : grille sans défiler (hors note de session / guide), fiche d'un
  sort de la barre (Retirer), d'un sort verrouillé (raison) ; site sans `?app` inchangé ; documentation ; commit.
