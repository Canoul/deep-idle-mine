/* Clé d'instance I (27/10/2026) : objet inhabituel empilable, tirage à part de 5 % dans le Treasure T3. */
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

test('Treasure T3 : la clé est un tirage à part (sa propre famille), 5 %', () => {
  const fam = LOOT['Treasure T3'].oneOf.filter(f => f.items.some(i => i.item === KEY));
  assert.equal(fam.length, 1); assert.equal(fam[0].items.length, 1, 'seule dans sa famille : ne prend la place de rien');
  assert.equal(fam[0].items[0].chance, 0.05);
  for(const t of ['Treasure T1', 'Treasure T2']) assert.ok(!LOOT[t].oneOf.some(f => f.items.some(i => i.item === KEY)));
});

test('Treasure T3 : ≈ 5 % des ouvertures donnent une clé, sans retirer les autres objets', () => {
  const rng = mulberry32(42), N = 20000;
  let keys = 0, crystals = 0, crystalsWithKey = 0;
  for(let i = 0; i < N; i++){
    const l = rollLoot(LOOT['Treasure T3'], rng);
    if(l[KEY]){ keys++; assert.equal(l[KEY], 1); if(l['Cristal de pleine lune']) crystalsWithKey++; }
    if(l['Cristal de pleine lune']) crystals++;
  }
  assert.ok(Math.abs(keys / N - 0.05) < 0.006, `${keys / N}`);
  assert.ok(Math.abs(crystals / N - 0.10) < 0.01, 'le cristal garde sa chance');
  assert.ok(crystalsWithKey > 0, 'clé et cristal peuvent tomber ensemble');
});
