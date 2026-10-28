/* Clé d'instance I (27/10/2026) : objet inhabituel empilable, tirage à part dans le Treasure T3 ; craft de base (28/10). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, LOOT, RARITY } from '../src/config.js';
import { rollLoot } from '../src/meta/loot.js';
import { mulberry32 } from '../src/core/rng.js';

const KEY = 'Clé d\'instance I';

test('la clé : objet du jeu, inhabituel, empilable', () => {
  assert.equal(ITEMS[KEY].cat, 'key'); assert.equal(ITEMS[KEY].stack, true);
  assert.equal(Object.values(RARITY).find(v => v && typeof v === 'object' && KEY in v)?.[KEY], 'inhabituel');
});

test('Treasure T3 : la clé est un tirage à part (sa propre famille), à sa chance de la config', () => {
  const fam = LOOT['Treasure T3'].oneOf.filter(f => f.items.some(i => i.item === KEY));
  assert.equal(fam.length, 1); assert.equal(fam[0].items.length, 1, 'seule dans sa famille : ne prend la place de rien');
  assert.ok(fam[0].items[0].chance > 0 && fam[0].items[0].chance < 1);
  for(const t of ['Treasure T1', 'Treasure T2']) assert.ok(!LOOT[t].oneOf.some(f => f.items.some(i => i.item === KEY)));
});

test('Treasure T3 : la clé tombe à sa chance, sans retirer les autres objets', () => {
  const P = LOOT['Treasure T3'].oneOf.find(f => f.items.some(i => i.item === KEY)).items[0].chance;
  const rng = mulberry32(42), N = 20000;
  let keys = 0, crystals = 0, crystalsWithKey = 0;
  for(let i = 0; i < N; i++){
    const l = rollLoot(LOOT['Treasure T3'], rng);
    if(l[KEY]){ keys++; assert.equal(l[KEY], 1); if(l['Cristal de pleine lune']) crystalsWithKey++; }
    if(l['Cristal de pleine lune']) crystals++;
  }
  assert.ok(Math.abs(keys / N - P) < 0.012, `${keys / N} pour ${P}`);
  assert.ok(Math.abs(crystals / N - 0.10) < 0.01, 'le cristal garde sa chance');
  assert.ok(crystalsWithKey > 0, 'clé et cristal peuvent tomber ensemble');
});

/* 28/10/2026 (Geoffrey) : la clé se crafte de base ; son plan ne sort plus du Treasure T4 ; un plan gardé se recycle */
test('craft de base : la clé se fabrique sans plan, le Treasure T4 ne donne plus son plan', async () => {
  const { isUnlocked, canCraft, canLearn } = await import('../src/meta/craft.js');
  const { recycle } = await import('../src/meta/research.js');
  const { RECIPES } = await import('../src/recipes.js');
  const empty = { slots:[], unlocked:[] };
  assert.equal(RECIPES[KEY].unlock, null);
  assert.equal(isUnlocked(KEY, empty), true);
  const full = { slots:Object.entries(RECIPES[KEY].cost).map(([item, qty]) => ({ item, qty })), unlocked:[] };
  assert.equal(canCraft(full, KEY), true);
  const bp = KEY + ' BP';
  assert.ok(!LOOT['Treasure T4'].oneOf.some(f => f.items.some(i => i.item === bp)), 'plus dans le T4');
  /* ancien plan : toujours un objet (pas perdu), ne s'apprend plus, se recycle en parts */
  assert.equal(ITEMS[bp]?.cat, 'blueprint');
  const inv = { slots:[{ item:bp, qty:1 }], unlocked:[], research:[] };
  assert.equal(canLearn(inv, bp), false);
  const r = recycle(inv, bp, 'op-key-bp', mulberry32(1));
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(!inv.slots.some(s => s?.item === bp));
  assert.ok(inv.slots.some(s => s?.item === 'Blueprint parts' && s.qty >= 15));
});
