/* Anti-triche des sorts (SPELLS) côté serveur : un parchemin s'apprend une seule fois (double clic, requêtes en
   parallèle), jamais sans l'avoir, jamais un objet qui n'est pas un parchemin ; un sort verrouillé ou d'une autre
   spécialisation ne s'équipe pas et ne part pas en session même s'il est écrit à la main dans la sauvegarde. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createInventory, addItem, serialize } from '../../src/meta/inventory.js';
import { fakeLive } from '../helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const SCROLL = 'Parchemin « Fast learner »';

async function setup(items = {}){
  const store = createMemoryGameStore();
  const inv = createInventory();
  for(const [item, q] of Object.entries(items)) addItem(inv, item, q);
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  const game = createGameService({ store, liveRunner: fakeLive(() => ({ shares:[] })), clock: () => 1e6, dev:false,
                                   config:{ startsPerHour:1000, keepEnded:1e12 } });
  return { game, store };
}
const scrolls = inv => inv.slots.filter(s => s?.item === SCROLL).reduce((n, s) => n + s.qty, 0);

test('parchemin : même demande renvoyée ou deux demandes en parallèle → appris une fois, un seul parchemin consommé', async () => {
  const { game } = await setup({ [SCROLL]:2 });
  const op = { action:'learn', item:SCROLL, opId:'op-learn-same' };
  await Promise.all([game.spells(ME, op), game.spells(ME, op)]);
  const r = await Promise.allSettled([game.spells(ME, { action:'learn', item:SCROLL, opId:'op-learn-a1' }),
                                      game.spells(ME, { action:'learn', item:SCROLL, opId:'op-learn-b1' })]);
  assert.ok(r.every(x => x.status === 'rejected' && x.reason.code === 'already_learned'));
  const st = await game.state(ME);
  assert.deepEqual(st.spells.learned, ['fast_learner']);
  assert.equal(scrolls(st.inventory), 1, 'le deuxième parchemin est gardé');
});

test('parchemin absent, objet inconnu ou qui n\'est pas un parchemin : refusé, rien ne bouge', async () => {
  const { game } = await setup({ Charbon:5 });
  for(const item of [SCROLL, 'Charbon', '__proto__', 'constructor', '', null, 42, ['x'], { a:1 }])
    await assert.rejects(game.spells(ME, { action:'learn', item, opId:'op-learn-bad' }));
  const st = await game.state(ME);
  assert.deepEqual(st.spells.learned, []);
  assert.equal(st.inventory.slots.find(s => s?.item === 'Charbon').qty, 5);
});

test('équiper : sort verrouillé, autre spécialisation, slot verrouillé ou invalide → refusé', async () => {
  const { game } = await setup();
  for(const [spell, slot] of [['dash', 0], ['dynamite', 1], ['ulti_shen', 0], ['dash', 2], ['dash', -1], ['dash', 1e9], ['dash', '0'], ['__proto__', 0]])
    await assert.rejects(game.spells(ME, { action:'equip', spell, slot, opId:'op-equip-bad' }));
  assert.deepEqual((await game.state(ME)).spells.slots, [null, null]);
});

test('sauvegarde trafiquée (sort verrouillé dans un slot) : il n\'est pas figé au lancement', async () => {
  const { game, store } = await setup();
  await store.putSpells(ME.id, { learned:['ulti_shen', 'dash'], slots:['dash', 'dynamite'], ops:[] });
  const { session } = await game.start(ME, {});
  assert.deepEqual((await store.getGameSession(session.id)).spells[ME.id], []);
  assert.deepEqual((await game.state(ME)).spells.learned, ['ulti_shen'], 'seuls les sorts à parchemin peuvent être « appris »');
});
