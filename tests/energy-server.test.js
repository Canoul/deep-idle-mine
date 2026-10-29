/* Énergie côté serveur (29/10/2026) : départ à 100, coût de 6 à 12 au lancement d'une mine classique, refus sous 6
   (message qui nomme les joueurs), rien débité pour une tour, une instance ou le mode dev. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENERGY, INSTANCE } from '../src/config.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createEnergy } from '../src/meta/energy.js';
import { createInventory, addItem, serialize } from '../src/meta/inventory.js';
import { fakeLive } from './helpers.js';

const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
const P = [{ account: A.id, name: 'Zoe' }, { account: B.id, name: 'Max' }];

function setup({ dev = false } = {}){
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(() => ({ shares: [] })), clock: () => 5_000_000, randomSeed: () => 7, dev });
  const setEnergy = (id, value) => store.putEnergy(id, { ...createEnergy(), value });
  const valueOf = async id => (await game.state({ id })).energy.value;
  return { store, game, setEnergy, valueOf };
}

test('nouveau compte : 100 sur 100', async () => {
  const { game } = setup();
  assert.deepEqual((await game.state(A)).energy, { value: ENERGY.start, max: ENERGY.max });
});

test('mine solo : coût de 6 à 12 débité, noté dans la session', async () => {
  const { game, store } = setup();
  const r = await game.start(A, {});
  const rec = await store.getGameSession(r.session.id);
  const cost = rec.energy[A.id];
  assert.ok(Number.isInteger(cost) && cost >= ENERGY.cost.min && cost <= ENERGY.cost.max);
  const e = (await game.state(A)).energy.value;
  assert.ok(e >= 88 && e <= 94); assert.equal(e, ENERGY.start - cost);
});

test('sous 6 d\'énergie : refus qui nomme le joueur, ni session ni débit', async () => {
  const { game, setEnergy, valueOf } = setup();
  await setEnergy(A.id, 5);
  await assert.rejects(game.start(A, {}), e => e.code === 'no_energy' && e.status === 409 && /Zoe/.test(e.message));
  assert.equal(await game.activeSessionId(A.id), null);
  assert.equal(await valueOf(A.id), 5);
});

test('groupe : le refus nomme Max seulement, l\'énergie de Zoe ne bouge pas', async () => {
  const { game, setEnergy, valueOf } = setup();
  await setEnergy(A.id, 50); await setEnergy(B.id, 3);
  await assert.rejects(game.start(A, {}, P), e => e.code === 'no_energy' && /Max/.test(e.message) && !/Zoe/.test(e.message));
  assert.equal(await valueOf(A.id), 50); assert.equal(await valueOf(B.id), 3);
  assert.equal(await game.activeSessionId(A.id), null);
});

test('groupe : chacun paie son propre coût', async () => {
  const { game, store, valueOf } = setup();
  const r = await game.start(A, {}, P);
  const rec = await store.getGameSession(r.session.id);
  assert.equal(await valueOf(A.id), 100 - rec.energy[A.id]); assert.equal(await valueOf(B.id), 100 - rec.energy[B.id]);
});

test('tour, instance et mode dev : énergie inchangée', async () => {
  const s = setup();
  await s.setEnergy(A.id, 5);
  const inv = createInventory(); addItem(inv, INSTANCE.list[0].key, 1);
  await s.store.putInventory(A.id, JSON.parse(serialize(inv)));
  await s.game.start(A, { mode: 'instance_1' });
  assert.equal(await s.valueOf(A.id), 5, 'instance gratuite, même à 5');
  const d = setup({ dev: true });
  await d.setEnergy(A.id, 5);
  await d.game.start(A, {});
  assert.equal(await d.valueOf(A.id), 5, 'mode dev : pas de coût');
});
