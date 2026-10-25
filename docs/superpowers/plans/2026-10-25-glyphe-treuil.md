# Glyphe Treuil (étape 2) Implementation Plan

**Goal:** Ascenseur 3× plus rapide que le treuil, posé une area sur deux, par le logisticien qui a le Glyphe Treuil.
**Spec:** `docs/superpowers/specs/2026-10-25-glyphes-design.md` (section Étape 2). Contraintes et workflow : ceux du plan de l'étape 1.

### Task 1: Config, objet, textures
`GLYPHS.items.winch = 'Glyphe Treuil'`, `desc.winch`, `liftSpeed:3`, `liftEvery:2` ; textures `lift_rail`, `lift_top`, `lift_cabin`
(gen_textures.py, `TEXTURES`). Tests : `tests/glyphs.test.js` (10 glyphes, valeurs), `tests/wiki.test.js` (10 lignes).

### Task 2: Construction et vitesse (mine)
`tryUnlock` : porteur du glyphe prioritaire, `winchJob.lift`, rien aux déblocages pairs ; `decideWinch` : `G.winch.lift` ;
`winchT` / `baseWinchT` × `liftSpeed`. Tests (`tests/glyphs.test.js`) : priorité, 1er et 3e oui / 2e non, vitesse × 3 Escalateur
compris, sans glyphe `G.winch` inchangé ; `tests/winch.test.js`, `tests/mule.test.js` verts ; simulation 5 sessions.

### Task 3: Tours, rendu, docs
Tours : `winchSetup` → `lift`, `winchT` × `liftSpeed`. Rendu mine et tours (rail, machinerie, cabine), capture Edge.
Wiki, GAME_DESIGN, état, journal, debug.
