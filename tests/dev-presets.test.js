import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, SPELLS } from '../src/config.js';
import { buildPreset, maxStorableLevel, PRESET } from '../scripts/dev-presets.js';
import { deserialize } from '../src/meta/inventory.js';
import { sanitizeStuff } from '../src/meta/stuff.js';
import { sanitizeSkills, spentPoints } from '../src/meta/skills.js';
import { sanitizeProgress, levelOf, specLevels } from '../src/meta/level.js';
import { sanitizeSpells, equippedSpells } from '../src/meta/spells.js';

test('le niveau des presets est le plus haut que le serveur garde', () => {
  const lv = maxStorableLevel();
  const p = sanitizeProgress(buildPreset('mineur').progress);
  assert.equal(levelOf(p.xp).level, lv);
  assert.ok(lv >= 70);
});

for(const t of SKILLS.trees) test(`preset ${t.id} : tout passe la relecture du serveur`, () => {
  const p = buildPreset(t.id, { keys: 7 });
  const progress = sanitizeProgress(p.progress);
  assert.equal(specLevels(progress)[t.id].level, p.level);
  /* arbre de la spé au maximum */
  const sk = sanitizeSkills(p.skills, levelOf(progress.xp).talentPoints);
  assert.equal(sk.tree, t.id);
  assert.equal(spentPoints(sk), t.nodes.reduce((s, n) => s + n.max, 0));
  /* stuff acier porté, pas de doublon dans l'inventaire, seulement les clés dedans */
  const inv = deserialize(JSON.stringify(p.inventory));
  const st = sanitizeStuff(p.stuff, inv);
  assert.deepEqual(Object.values(st.worn).filter(Boolean).map(x => x.item).sort(), [...PRESET.gear].sort());
  assert.deepEqual(inv.slots.filter(Boolean).map(s => [s.item, s.qty]), [[PRESET.key, 7]]);
  /* sorts de la spé équipés et valides */
  const ctx = { tree: t.id, spec: { [t.id]: p.level } };
  const want = SPELLS.list.filter(s => s.unlock.tree === t.id).map(s => s.id);
  assert.deepEqual(equippedSpells(sanitizeSpells(p.spells), ctx), want.slice(0, SPELLS.openSlots));
});

test('quantité de clés invalide refusée', () => {
  for(const keys of [-1, 1.5, NaN, Infinity]) assert.throws(() => buildPreset('mineur', { keys }));
  assert.throws(() => buildPreset('inconnu'));
});
