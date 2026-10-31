/* Raffle : le lot n'est versé qu'une fois, même rejoué ; une rune reçoit un uid neuf ; le navigateur ne choisit rien. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { deserialize, countOf } from '../../src/meta/inventory.js';
import { fakeLive } from '../helpers.js';

function setup(){
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock:() => 1e12, randomSeed:() => 7 });
  const inv = async id => deserialize(JSON.stringify(await store.getInventory(id)));
  return { store, game, inv };
}

test('objet : un même raffle ne paie qu\'une fois, même en parallèle', async () => {
  const { game, inv } = setup();
  const lot = { item:'Chitine', qty:100 };
  const r = await Promise.all([game.raffleGive('A', 'raffle:1', lot), game.raffleGive('A', 'raffle:1', lot)]);
  assert.deepEqual(r.sort(), [false, true]);
  assert.equal(await game.raffleGive('A', 'raffle:1', lot), false);
  assert.equal(countOf(await inv('A'), 'Chitine'), 100);
  assert.equal(await game.raffleGive('A', 'raffle:2', lot), true);
  assert.equal(countOf(await inv('A'), 'Chitine'), 200);
});

test('énergie : une seule fois, plafonnée', async () => {
  const { game, store } = setup();
  await store.putEnergy('A', { value:95, keys:[], at:1e12 });
  assert.equal(await game.raffleGive('A', 'raffle:1', { energy:10 }), true);
  assert.equal(await game.raffleGive('A', 'raffle:1', { energy:10 }), false);
  assert.equal((await store.getEnergy('A')).value, 100);
});

test('rune : une seule, de la qualité annoncée, avec ses lignes', async () => {
  const { game, inv } = setup();
  const lot = { rune:'Rune', q:5 };
  await game.raffleGive('A', 'raffle:1', lot); await game.raffleGive('A', 'raffle:1', lot);
  const runes = (await inv('A')).slots.filter(s => s?.item === 'Rune');
  assert.equal(runes.length, 1);
  assert.equal(runes[0].q, 5);
  assert.ok(runes[0].lines.length > 0 && runes[0].uid > 0);
});
