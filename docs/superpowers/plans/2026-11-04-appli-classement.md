# Classement de l'appli — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** podium du top 3 et sa place collée en bas, dans l'appli. **Spec:** `docs/superpowers/specs/2026-11-04-appli-classement-design.md`

## Review Focus
1. Moins de 3 classés → marches vides, pas d'erreur → test.
2. Soi dans le top 3 → sa ligne collée quand même → test.
3. Soi hors du top (`board.me`) → collée → test.
4. Liste vide → « Personne n'est encore classé ici. » → test.
5. Pseudos avec du HTML → échappés sur le podium → test.

### Task 1 : `podiumHtml(top, value)`, `boardAppHtml(board, { value, row })` (purs) — tests `tests/app-leaderboard.test.js`
- [ ] Tests des 5 points, plus : ordre 2 · 1 · 3 ; `row` appelé pour les rangs 4 et plus seulement → rouge → écrire → vert → commit.
### Task 2 : écran
- [ ] `renderBoard` : `boardAppHtml` dans l'appli ; CSS (podium, marches, `.lMe` en `position:sticky` au-dessus de la barre) ;
  à l'écran ; site inchangé ; documentation ; commit.
