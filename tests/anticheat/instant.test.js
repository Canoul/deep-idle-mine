/* Anti-triche de la mine instantanée (suite lancée à la demande : npm run test:anticheat).
   La mine crée des ressources : un joueur ne doit toucher son butin qu'une fois, rien s'il quitte, jamais être dans
   deux mines à la fois, et rien de ce que le navigateur envoie ne compte (le serveur choisit tout). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTANT_MINE as MI, ITEMS, BLOCKS } from '../../src/config.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createInlineRunner } from '../../server/game/live.js';
import { createInstantService } from '../../server/instant/service.js';
import { deserialize, countOf } from '../../src/meta/inventory.js';
import { runInstant } from '../../src/sim/instant/session.js';
import '../helpers.js';   // énergie pleine au départ des tests (ENERGY.start, 30/10/2026)

const SLOT = Date.parse('2026-10-21T14:00:00Z');
const A = { id:'AAAA1111', name:'Zoe', guest:false }, B = { id:'BBBB2222', name:'Max', guest:false };

async function setup(store = createMemoryGameStore(), now = SLOT - 60e3){
  const t = { now };
  const game = createGameService({ store, liveRunner:createInlineRunner, clock:() => t.now, randomSeed:() => 77 });
  const instant = createInstantService({ game, store, clock:() => t.now });
  await instant.load();
  return { store, game, instant, t };
}
const total = async (store, id) => { const inv = deserialize(JSON.stringify(await store.getInventory(id) ?? {}));
  return inv.slots.reduce((a, s) => a + (s?.qty ?? 0), 0); };
const bagSize = bag => Object.values(bag).reduce((a, n) => a + n, 0);

test('MI : butin versé une seule fois (fin rejouée, settle répété, redémarrage après la fin)', async () => {
  const a = await setup();
  await a.instant.join(A);
  a.t.now = SLOT; const [s] = await a.instant.tick();
  a.t.now = s.finishAt + 1; await a.game.pump();
  const bag = (await a.game.state(A)).ended.result.shares[0].bag;
  assert.ok(bagSize(bag) > 50);
  assert.equal(await total(a.store, A.id), bagSize(bag));
  await a.game.settle(s.id); await a.game.pump(); await a.game.finish(A).catch(() => {});
  const b = await setup(a.store, s.finishAt + 5000);
  await b.game.recover(); await b.game.pump(); await b.instant.tick();
  assert.equal(await total(b.store, A.id), bagSize(bag));
});

test('MI : quitter = rien, même en revenant (pas de retour dans la mine, pas de part à la fin)', async () => {
  const { game, instant, store, t } = await setup();
  await instant.join(A); await instant.join(B);
  t.now = SLOT; const [s] = await instant.tick();
  t.now = SLOT + 60e3; await game.pump();
  await game.leave(A);
  await assert.rejects(game.leave(A), e => e.code === 'no_session');
  assert.equal((await game.state(A)).session, null);
  await assert.rejects(instant.join(A), e => e.code === 'signup_closed', 'pas de réinscription pendant la mine (prochaine dans 2 h)');
  t.now = SLOT + 61e3;
  assert.deepEqual(await instant.tick(), [], 'pas de retour dans la mine');
  t.now = s.finishAt + 1; await game.pump();
  assert.equal(await total(store, A.id), 0);
  assert.ok(await total(store, B.id) > 0);
});

test('MI : un joueur n\'est jamais dans deux mines, ni en mine et en session', async () => {
  const { game, instant, t } = await setup();
  const s1 = await game.openInstant('mi-x-1', SLOT, [{ account:A.id, name:'Zoe' }, { account:A.id, name:'Zoe bis' }]);
  assert.deepEqual(s1.players.map(p => p.account), [A.id], 'doublon écarté');
  assert.equal(await game.openInstant('mi-x-2', SLOT, [{ account:A.id, name:'Zoe' }]), null, 'déjà dans une mine');
  assert.equal(await game.openInstant('mi-x-1', SLOT, [{ account:B.id, name:'Max' }]), null, 'même mine pas rouverte');
  await assert.rejects(game.start(A, {}), e => e.code === 'session_running');
  /* inscrit en session pour la mine suivante (permis dans les 30 dernières minutes) : jamais deux mines à la fois */
  t.now = SLOT + 2 * 3600e3 - 60e3;
  await instant.join(A);
  assert.equal(await game.activeSessionId(A.id), 'mi-x-1', 'toujours dans sa mine (jamais finie dans ce test)');
  t.now = SLOT + 2 * 3600e3;
  const next = await instant.tick();
  assert.ok(next.every(x => !x.players.some(p => p.account === A.id)), 'encore en session à l\'heure : écarté de la nouvelle mine');
  assert.equal(await game.activeSessionId(A.id), 'mi-x-1');
});

test('MI : ce que le navigateur envoie n\'est pas lu (inscription, ouverture dev hors mode dev)', async () => {
  const { instant } = await setup();
  const s = await instant.join(A, { name:'Hack', at:0, count:999 });
  assert.equal(s.count, 1);
  await assert.rejects(instant.devOpen(A), e => e.status === 403);
});

test('MI : la matière est conservée (jamais plus que la mine, un bloc = un gagnant, objets connus)', () => {
  for(const n of [1, 5, 20]){
    const G = runInstant(31 + n, { miners:Array.from({ length:n }, (_, i) => ({ account:'a' + i, carac:{ fortune:150 } })) });
    let ore = 0, feathers = 0;
    for(const s of G.summary.shares){
      for(const [k, q] of Object.entries(s.bag)){
        assert.ok(ITEMS[k], k); assert.ok(Number.isSafeInteger(q) && q > 0, `${k} ${q}`);
        if(k === MI.featherItem) feathers += q; else ore += q;
      }
      assert.ok(bagSize(s.bag) - (s.bag[MI.featherItem] ?? 0) <= s.stats.mined * 3, 'Fortune 150 % : au plus 3 par bloc');
    }
    assert.equal(G.summary.shares.reduce((a, s) => a + s.stats.mined, 0), G.stats.mined);
    assert.ok(G.stats.mined <= MI.w * MI.h);
    assert.ok(feathers <= Math.round(MI.w * MI.h * MI.feather / 100) * MI.featherMax);
    assert.ok(Object.values(BLOCKS).some(b => b.name === 'Or'));
  }
});
