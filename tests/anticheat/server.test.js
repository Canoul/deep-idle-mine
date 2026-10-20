/* Anti-triche côté serveur (suite lancée à la demande : npm run test:anticheat).
   Le serveur fait foi : rien de ce que le navigateur envoie ne doit créer, doubler ou détourner des ressources. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realDurationMs } from '../../src/shared/game.js';
import { GAME } from '../../src/config.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const OTHER = { id:'BBBB2222', name:'Max', guest:false };
const flush = async () => { for(let i=0; i<5; i++) await new Promise(r => setTimeout(r, 0)); };

function setup(replayImpl){
  let now = 1_000_000;
  const store = createMemoryGameStore();
  const calls = [];
  const replay = async rec => {
    calls.push(rec.id);
    await new Promise(r => setTimeout(r, 5));            // un vrai rejeu prend du temps : laisse les requêtes s'entremêler
    return replayImpl ? replayImpl(rec) : { shares: rec.players.map(p => ({ account:p.account, left:false, bag:{ Or:10 } })) };
  };
  const game = createGameService({ store, replay, clock: () => now, dev:false, config:{ startsPerHour:1000, keepEnded:1e12 } });
  return { game, store, calls, advance: ms => { now += ms; } };
}
const gold = async (game, who = ME) => (await game.state(who)).inventory.slots.find(s => s?.item === 'Or')?.qty ?? 0;

test('fin signalée plusieurs fois en même temps (onglets, double clic) : un seul rejeu, un seul versement', async () => {
  const { game, calls, advance } = setup();
  await game.start(ME, {});
  advance(realDurationMs());
  await Promise.all([game.finish(ME), game.finish(ME), game.finish(ME), game.settleDue(), game.state(ME)]);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(await gold(game), 10);
});

test('fin rejouée après coup (requête renvoyée) : rien de plus', async () => {
  const { game, advance, store } = setup();
  const { session } = await game.start(ME, {});
  advance(realDurationMs());
  await game.finish(ME); await flush();
  await assert.rejects(game.finish(ME), { code:'no_session' });
  await game.settle(session.id);                                      // forcé : déjà « done », sans effet
  const rec = await store.getGameSession(session.id);
  rec.status = 'running'; await store.putGameSession(rec);            // même remis à « running » par erreur…
  await game.settle(session.id); await flush();
  assert.equal(await gold(game), 10, '…la part n\'est versée qu\'une fois (creditSession)');
});

test('impossible de lancer une 2e session pendant que la 1re est en cours de rejeu', async () => {
  const { game, advance } = setup();
  await game.start(ME, {});
  advance(realDurationMs());
  await game.finish(ME);
  await assert.rejects(game.start(ME, {}), { code:'session_running' });
});

test('quitter puis tenter d\'obtenir quand même sa part : rien', async () => {
  const { game, advance } = setup(rec => ({ shares: rec.players.map(p => ({ account:p.account, left:false, bag:{ Or:10 } })) }));
  await game.start(ME, {});
  advance(1000);
  await game.leave(ME, {});
  advance(realDurationMs());
  await game.settleDue(); await flush();
  await assert.rejects(game.finish(ME), { code:'no_session' });
  assert.equal(await gold(game), 0);
});

test('un résultat de rejeu qui verserait à un compte hors de la session est ignoré', async () => {
  const { game, advance } = setup(() => ({ shares:[
    { account:ME.id, left:false, bag:{ Or:10 } },
    { account:OTHER.id, left:false, bag:{ Or:999 } },               // pas dans la session
  ] }));
  await game.start(ME, {});
  advance(realDurationMs());
  await game.settleDue(); await flush();
  assert.equal(await gold(game), 10);
  assert.equal(await gold(game, OTHER), 0);
});

test('un résultat de rejeu avec des quantités aberrantes ne crée rien d\'invalide', async () => {
  const { game, advance } = setup(rec => ({ shares:[{ account:rec.players[0].account, left:false,
    bag:{ Or:Infinity, Fer:-5, Terre:1.5, Charbon:'9', Diamant:2 } }] }));
  await game.start(ME, {});
  advance(realDurationMs());
  await game.settleDue(); await flush();
  assert.deepEqual((await game.state(ME)).inventory.slots, [{ item:'Diamant', qty:2 }]);
});

test('session d\'un autre joueur : ni la finir, ni la quitter, ni la voir', async () => {
  const { game, advance } = setup();
  const { session } = await game.start(ME, {});
  advance(realDurationMs());
  await assert.rejects(game.finish(OTHER), { code:'no_session' });
  await assert.rejects(game.leave(OTHER, {}), { code:'no_session' });
  const st = await game.state(OTHER);
  assert.equal(st.session, null);
  assert.equal(st.ended, null);
  await game.ack(OTHER, session.id);
});

test('mode normal : le navigateur ne choisit ni la seed, ni la vitesse, ni l\'heure de fin, ni le moment du départ', async () => {
  const { game, store, advance } = setup();
  const { session } = await game.start(ME, { seed:1, speed:300, finishAt:0, startedAt:0, players:[{ account:OTHER.id }], bots:2 });
  const rec = await store.getGameSession(session.id);
  assert.equal(rec.speed, 2);
  assert.equal(rec.finishAt - rec.startedAt, realDurationMs());
  assert.deepEqual(rec.players.map(p => p.account), [ME.id]);
  assert.equal(rec.bots, 0);
  advance(1000);
  await game.leave(ME, { tick:0 });
  assert.equal((await store.getGameSession(session.id)).leaves[0].tick, 20 + GAME.leaveNotice * 20,
               '1 s réelle à x2 = 20 ticks (+ préavis de départ), pas 0');
});

test('lancements en rafale limités par heure', async () => {
  let now = 0;
  const game = createGameService({ store:createMemoryGameStore(), replay:async () => ({ shares:[] }), clock:() => now, dev:false,
                                   config:{ startsPerHour:3, keepEnded:1e12 } });
  for(let i=0; i<3; i++){ await game.start(ME, {}); await game.leave(ME, {}); }
  await assert.rejects(game.start(ME, {}), { code:'rate_limited' });
});
