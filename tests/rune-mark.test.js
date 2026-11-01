/* Icône des pièces runées (31/10/2026) : visible dans l'inventaire, le stuff et l'amélioration */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runeMark, rframe } from '../src/ui/rarity.js';
import { RUNE, UPGRADE } from '../src/config.js';

const read = f => readFileSync(new URL(`../src/ui/${f}`, import.meta.url), 'utf8');

test('runeMark : une rune ou un fragment posé donne l\'icône, sinon rien', () => {
  assert.match(runeMark({ item:'x', rune:{ q:1, lines:[] } }), /runeMark.*textures\/rune\.png/);
  assert.match(runeMark({ item:'x', rune:{ q:1, lines:[], frag:true } }), /runeMark.*textures\/rune_fragment\.png/);
  assert.equal(runeMark({ item:'x' }), '');
  assert.equal(runeMark(null), '');
});

test('l\'icône est affichée partout où on choisit ou range une pièce', () => {
  for(const f of ['inventory.js', 'stuff.js', 'upgrade.js']) assert.match(read(f), /runeMark\(/, f);
  assert.match(read('style.css'), /\.runeMark\{[^}]*position:absolute[^}]*pointer-events:none/);
});

test('rframe : le contour d\'une rune ou d\'un fragment prend la couleur de sa qualité, une autre pièce garde sa rareté', () => {
  for(const item of [RUNE.item, RUNE.fragment.item]) for(const t of UPGRADE.qualities)
    assert.equal(rframe({ item, q:t.q, lines:[] }), ` style="--rc:${t.color}"`);
  assert.equal(rframe({ item:'Pioche en pierre', q:3, lines:[] }), '');
  assert.equal(rframe({ item:RUNE.item }), '');
  assert.equal(rframe('Fer'), '');
  assert.equal(rframe(null), '');
});

test('le contour de la rune suit sa qualité dans l\'inventaire, l\'amélioration et la fenêtre d\'objet obtenu', () => {
  for(const f of ['inventory.js', 'upgrade.js', 'obtained.js']) assert.match(read(f), /rframe\(/, f);
});
