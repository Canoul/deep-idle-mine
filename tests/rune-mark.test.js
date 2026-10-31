/* Icône des pièces runées (31/10/2026) : visible dans l'inventaire, le stuff et l'amélioration */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runeMark } from '../src/ui/rarity.js';

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
