// Appli : les écrans qui restaient (04/11/2026, spec docs/superpowers/specs/2026-11-04-appli-ecrans-fin-design.md).
// Fonctions pures du rendu appli : Inventaire (Déplacer), Four (onglets), Recherche (tiers), Amélioration (tuiles), Amis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RESEARCH } from '../src/config.js';
import { moveOp, infoHtml } from '../src/ui/inventory.js';
import { furnTabsHtml } from '../src/ui/furnace.js';
import { tierChipsHtml, tierWhyHtml } from '../src/ui/research.js';
import { pieceTileHtml } from '../src/ui/upgrade.js';
import { friendRowAppHtml, friendSheetHtml } from '../src/ui/social.js';

const inv = { slots:[{ item:'Charbon', qty:40 }, null, { item:'Pioche en acier', qty:1, uid:7 }], unlocked:[] };
const count = (html, re) => (html.match(re) ?? []).length;

test('inventaire : moveOp, la même demande que le glisser-déposer', () => {
  assert.deepEqual(moveOp(inv, 0, 1), { from:0, to:1, item:'Charbon' });
  assert.deepEqual(moveOp(inv, 2, 0), { from:2, to:0, item:'Pioche en acier', uid:7 });   // une pièce garde son uid
  assert.equal(moveOp(inv, 0, 0), null);    // même case : rien à envoyer
  assert.equal(moveOp(inv, 1, 0), null);    // case de départ vide
});

test('inventaire : bouton « Déplacer » seulement si on le demande (appli)', () => {
  assert.match(infoHtml(inv.slots[0], true, inv, null, null, 0), /class="[^"]*invMove[^"]*" data-i="0"/);
  assert.doesNotMatch(infoHtml(inv.slots[0], true, inv), /invMove/);        // site : pas de bouton
});

test('four : un onglet par four, 🔥 s\'il chauffe, 🔒 s\'il est fermé', () => {
  const list = [{ since:123, tier:0 }, { since:null, tier:1 }];
  const h = furnTabsHtml(list, 3, 1);
  assert.equal(count(h, /data-ftab=/g), 3);
  assert.match(h, /data-ftab="0"[^>]*>[^<]*Four 1[^<]*🔥/);
  assert.match(h, /class="[^"]*\bon\b[^"]*" data-ftab="1"/);
  assert.match(h, /class="[^"]*\blocked\b[^"]*" data-ftab="2"[^>]*>🔒 Four 3/);
  assert.doesNotMatch(h, /data-ftab="1"[^>]*>[^<]*🔥/);
});

test('recherche : un bouton par tier, les fermés marqués, et ce qui manque', () => {
  const h = tierChipsHtml(inv, 1);
  assert.equal(count(h, /data-rtier=/g), RESEARCH.tiers.length);
  assert.match(h, /class="[^"]*\bon\b[^"]*" data-rtier="1"/);
  assert.match(h, /class="[^"]*\blocked\b[^"]*" data-rtier="2"/);          // personne n'a encore appris de recette
  assert.match(tierWhyHtml(inv, 2), /Tier 2.*apprends encore \d+ recettes? du Tier 1/);
  assert.equal(tierWhyHtml(inv, 1), '');                                   // ouvert : rien à dire
});

test('amélioration : une tuile par pièce, marques équipée / tag / choisie / grisée', () => {
  const p = { uid:7, item:'Pioche en acier', q:3 };
  const h = pieceTileHtml(p, { worn:true, tag:'MAX', sel:true });
  assert.match(h, /class="[^"]*upPick[^"]*upTile[^"]*sel[^"]*" data-uid="7"/);
  assert.match(h, /class="upEq"/);
  assert.match(h, /class="upTag">MAX</);
  const d = pieceTileHtml(p, { dim:true });
  assert.match(d, /\bdim\b/);
  assert.doesNotMatch(d, /upEq|upTag/);
});

/* 06/11/2026 : en display:grid, l'icône (62 % × 62 %) sortait écrasée en largeur sur téléphone (26×42 px mesurés dans
   Chrome) ; la tuile garde le centrage flex de .slot */
test('amélioration : la tuile ne passe pas en grille (sprite écrasé)', () => {
  const css = fs.readFileSync(new URL('../src/app/app.css', import.meta.url), 'utf8');
  const rule = css.match(/body\.app \.upTile\{([^}]*)\}/)?.[1];
  assert.ok(rule, 'règle .upTile introuvable');
  assert.doesNotMatch(rule, /display:\s*grid/);
});

test('amis : le bouton utile sur la ligne, tout le reste dans la fiche', () => {
  const lobby = { id:'a1', name:'Brakk', status:'lobby', size:2, max:4, canJoin:true, canInvite:true };
  const play = { id:'b2', name:'Ysolde', status:'session', mode:'mine', canJoin:false, canInvite:false };
  assert.match(friendRowAppHtml(lobby), /data-join="a1"/);
  assert.doesNotMatch(friendRowAppHtml(lobby), /data-invite/);
  assert.match(friendRowAppHtml(play), /data-invite="b2" disabled/);
  assert.match(friendRowAppHtml(play), /data-fsheet="b2"/);
  const s = friendSheetHtml(lobby);
  for(const k of ['data-join="a1"', 'data-invite="a1"', 'data-profile="a1"', 'data-mod="a1" data-name="Brakk"', 'data-remove="a1" data-name="Brakk"'])
    assert.ok(s.includes(k), k);
  assert.match(friendSheetHtml(play), /data-join="b2" disabled/);
});
