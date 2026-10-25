/* Glyphes (25/10/2026, Geoffrey ; spec docs/superpowers/specs/2026-10-25-glyphes-design.md) : un parchemin lié à un
   skill, posé à côté de lui dans l'onglet Skills quand le skill est au rang max ; il ajoute un effet au skill. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { GLYPHS, ITEMS } from '../src/config.js';
import { NODES } from '../src/meta/skills.js';
import { rarityOf } from '../src/meta/rarity.js';

test('glyphes : 9 objets, un par skill visé, catégorie glyph, épiques, texture présente', () => {
  const entries = Object.entries(GLYPHS.items);
  assert.equal(entries.length, 9);
  for(const [node, name] of entries){
    assert.ok(NODES[node], `${node} : skill connu`);
    assert.equal(ITEMS[name]?.cat, 'glyph', name);
    assert.equal(ITEMS[name].glyph, node);
    assert.equal(ITEMS[name].stack, true);
    assert.equal(rarityOf(name), 'epique', name);
    assert.ok(GLYPHS.desc[node], `${node} : texte joueur`);
  }
  for(const node of ['lazy_legend', 'winch_speed', 'taunt', 'winch']) assert.equal(GLYPHS.items[node], undefined, `${node} : pas de glyphe`);
  assert.ok(existsSync('textures/glyph.png'));
  assert.equal(GLYPHS.rushTime, 5); assert.equal(GLYPHS.killDamageMax, 25); assert.equal(GLYPHS.braumOxygen, 0.3);
  assert.equal(GLYPHS.attackToMine, 0.1); assert.equal(GLYPHS.torchChance, 0.05); assert.equal(GLYPHS.ladderMult, 0.5);
  assert.equal(GLYPHS.oxygenToSpeed, 0.0003); assert.equal(GLYPHS.damageToPods, 3); assert.equal(GLYPHS.killDamagePct, 1);
});
