/* Sessions de jeu côté serveur : lancement, départ, fin (refusée avant l'heure), versement des parts.
   Horloge simulée et rejeu factice (le vrai rejeu est testé dans game-replay.test.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME, TREASURE } from '../src/config.js';
const T1 = TREASURE.tiers[0].item;   // Treasure T1 : un exemplaire pour chacun
import { realDurationMs } from '../src/shared/game.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const OTHER = { id:'BBBB2222', name:null, guest:true };

/* rejeu factice : le coffre est fixé par le test ; on partage comme le vrai (un sac par joueur présent) */
function fakeReplay(chestOf = () => ({ Charbon:9, [T1]:1 })){
  const calls = [];
  const replay = async rec => {
    calls.push(rec.id);
    const present = rec.players.filter(p => !rec.leaves.some(l => l.account === p.account));
    const chest = chestOf(rec), n = present.length;
    return { id:rec.id, chest, shares: rec.players.map(p => {
      const left = !present.includes(p);
      const bag = {};
      if(!left) for(const k in chest) bag[k] = k === T1 ? chest[k] : Math.floor(chest[k] / n);
      return { account:p.account, left, bag };
    }) };
  };
  replay.calls = calls;
  return replay;
}

function setup({ dev = false, replay = fakeReplay() } = {}){
  let now = 1_000_000;
  const clock = () => now;
  const store = createMemoryGameStore();
  const game = createGameService({ store, replay, clock, dev, randomSeed: () => 4242 });
  return { game, store, replay, advance: ms => { now += ms; }, clock };
}
const flush = () => new Promise(r => setTimeout(r, 0));

test('lancer : la session est créée par le serveur (seed, joueur, préférences, heure de fin)', async () => {
  const { game } = setup();
  await game.setPrefs(ME, { priority:'descendre', fightMobs:false });
  const { session } = await game.start(ME, {});
  assert.equal(session.seed, 4242);
  assert.deepEqual(session.players, [{ account:ME.id, name:'Zoe' }]);
  assert.deepEqual(session.prefs[ME.id], { priority:'descendre', fightMobs:false });
  assert.equal(session.speed, GAME.speed);
  assert.equal(session.finishAt - session.startedAt, realDurationMs(GAME.speed));
  assert.equal(session.status, 'running');
  assert.equal((await game.state(ME)).session.id, session.id);
});

test('une seule session à la fois par joueur', async () => {
  const { game } = setup();
  await game.start(ME, {});
  await assert.rejects(game.start(ME, {}), { code:'session_running', status:409 });
});

test('deux lancements simultanés (double clic) : un seul passe', async () => {
  const { game, store } = setup();
  const r = await Promise.allSettled([game.start(ME, {}), game.start(ME, {})]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await store.sessionsOf(ME.id)).length, 1);
});

test('mode normal : fin refusée avant l\'heure, avec le temps restant', async () => {
  const { game, advance } = setup();
  await game.start(ME, {});
  advance(realDurationMs() - 5000);
  await assert.rejects(game.finish(ME), e => e.code === 'too_early' && e.retryAfter === 5);
});

test('fin à l\'heure : rejeu, part versée dans l\'inventaire, résultat montré une fois', async () => {
  const { game, advance, replay } = setup();
  const { session } = await game.start(ME, {});
  advance(realDurationMs());
  await game.finish(ME); await flush(); await flush();
  const st = await game.state(ME);
  assert.equal(st.session, null);
  assert.equal(st.ended.id, session.id);
  assert.equal(st.ended.status, 'done');
  assert.deepEqual(st.inventory.slots, [{ item:'Charbon', qty:9 }, { item:T1, qty:1 }]);
  assert.deepEqual(replay.calls, [session.id]);
  await game.ack(ME, session.id);
  assert.equal((await game.state(ME)).ended, null);
});

test('joueur absent : la session arrivée à sa fin est versée quand même (au prochain passage du serveur)', async () => {
  const { game, advance } = setup();
  await game.start(ME, {});
  advance(realDurationMs() + 60_000);
  await game.settleDue();
  assert.equal((await game.state(ME)).inventory.slots[0].qty, 9);
});

test('quitter : on ne reçoit rien ; seul, la session s\'arrête sans rejeu', async () => {
  const { game, advance, replay } = setup();
  await game.start(ME, {});
  advance(60_000);
  await game.leave(ME, {});
  const st = await game.state(ME);
  assert.equal(st.session, null);
  assert.equal(st.ended, null, 'pas de bilan pour celui qui est parti');
  assert.deepEqual(st.inventory.slots, []);
  assert.deepEqual(replay.calls, []);
  await game.start(ME, {});   // et on peut relancer
});

test('quitter : le moment du départ est calculé par le serveur (ticks à vitesse x2), pas fourni par le navigateur', async () => {
  const { game, advance, store } = setup();
  const { session } = await game.start(ME, {});
  advance(10_000);                                   // 10 s réelles à x2 = 20 s de jeu = 200 ticks
  await game.leave(ME, { tick: 999999 });
  assert.equal((await store.getGameSession(session.id)).leaves[0].tick, 200);
});

test('quitter après la fin : refusé (la part est acquise)', async () => {
  const { game, advance } = setup();
  await game.start(ME, {});
  advance(realDurationMs());
  await assert.rejects(game.leave(ME, {}), { code:'session_over' });
});

test('rejeu en échec : la session reste à verser et sera retentée, sans rien verser deux fois', async () => {
  let fail = true;
  const ok = fakeReplay();
  const replay = async rec => { if(fail) throw new Error('panne'); return ok(rec); };
  const { game, advance } = setup({ replay });
  await game.start(ME, {});
  advance(realDurationMs());
  await game.finish(ME); await flush(); await flush();
  assert.equal((await game.state(ME)).session.status, 'running');
  fail = false;
  await game.settleDue(); await game.settleDue();
  assert.equal((await game.state(ME)).inventory.slots[0].qty, 9);
});

test('redémarrage pendant un rejeu : repris au démarrage, versé une seule fois', async () => {
  const { game, advance, store } = setup();
  const { session } = await game.start(ME, {});
  advance(realDurationMs());
  await game.settle(session.id);
  const rec = await store.getGameSession(session.id);
  rec.status = 'settling'; await store.putGameSession(rec);    // comme si le serveur s'était arrêté en plein versement
  await game.recover();
  assert.equal((await game.state(ME)).inventory.slots[0].qty, 9, 'pas de double versement');
});

test('préférences : seules les valeurs permises sont gardées', async () => {
  const { game } = setup();
  const { prefs } = await game.setPrefs(ME, { priority:'tout casser', fightMobs:'oui', extra:1 });
  assert.deepEqual(prefs, { priority:'minerais', fightMobs:true });
});

test('mode normal : seed, mineurs de test et réglages dev du navigateur ignorés', async () => {
  const { game } = setup();
  const { session } = await game.start(ME, { seed:7, bots:2, overrides:{ STATS:{ pods:99999 } } });
  assert.equal(session.seed, 4242);
  assert.equal(session.bots, 0);
  assert.equal(session.overrides, null);
});

test('mode dev : seed, mineurs de test et réglages acceptés (bornés) ; fin libre ; départ au tick fourni', async () => {
  const { game, store } = setup({ dev:true });
  const { session } = await game.start(ME, { seed:7, bots:5, overrides:{ STATS:{ pods:500, speed:-3 }, CFG:{ evil:1 } } });
  assert.equal(session.seed, 7);
  assert.equal(session.bots, GAME.maxPlayers - 1);
  assert.deepEqual(session.overrides, { STATS:{ pods:500 } });
  assert.equal(session.finishAt, null);
  await game.leave(ME, { tick:123 });
  assert.equal((await store.getGameSession(session.id)).leaves[0].tick, 123);
  assert.equal(game.info().dev, true);
});

test('mode dev : fin quand le navigateur le dit', async () => {
  const { game } = setup({ dev:true });
  await game.start(ME, {});
  await game.finish(ME); await flush(); await flush();
  assert.equal((await game.state(ME)).inventory.slots[0].qty, 9);
});

test('chacun ne voit et ne touche que ses propres sessions', async () => {
  const { game } = setup();
  const { session } = await game.start(ME, {});
  assert.equal((await game.state(OTHER)).session, null);
  await assert.rejects(game.finish(OTHER), { code:'no_session' });
  await assert.rejects(game.leave(OTHER, {}), { code:'no_session' });
  await game.ack(OTHER, session.id);   // sans effet
  assert.equal((await game.state(ME)).session.id, session.id);
});
