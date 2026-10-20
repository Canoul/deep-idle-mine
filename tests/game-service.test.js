/* Sessions de jeu côté serveur : lancement, départ, fin (refusée avant l'heure), versement des parts.
   Horloge simulée et rejeu factice (le vrai rejeu est testé dans game-replay.test.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME, TREASURE, FOCUS } from '../src/config.js';
const T1 = TREASURE.tiers[0].item;   // Treasure T1 : un exemplaire pour chacun
import { realDurationMs, tickAt, TOTAL_TICKS } from '../src/shared/game.js';
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
  /* + préavis de GAME.leaveNotice s réelles (15 s à x2 = 300 ticks) pour que les autres navigateurs l'apprennent */
  assert.equal((await store.getGameSession(session.id)).leaves[0].tick, 200 + GAME.leaveNotice * GAME.speed * 10);
});

test('quitter juste avant la fin : le départ a lieu au plus tard au dernier tick (jamais après la fin)', async () => {
  const { game, advance, store } = setup();
  const { session } = await game.start(ME, {});
  advance(realDurationMs() - 2000);
  await game.leave(ME, {});
  assert.equal((await store.getGameSession(session.id)).leaves[0].tick, TOTAL_TICKS - 1);
});

/* ---------- à plusieurs (groupe lancé par son chef) ---------- */
const THIRD = { id:'CCCC3333', name:'Max', guest:false };
const team = [{ account:ME.id, name:'Zoe' }, { account:OTHER.id, name:'Invité BBBB' }, { account:THIRD.id, name:'Max' }];

test('groupe : une session pour tous, chacun avec ses préférences, le chef en premier (Rouge)', async () => {
  const { game } = setup();
  await game.setPrefs(OTHER, { priority:'descendre', fightMobs:false });
  const { session } = await game.start(ME, {}, team);
  assert.deepEqual(session.players.map(p => p.account), [ME.id, OTHER.id, THIRD.id]);
  assert.deepEqual(session.prefs[OTHER.id], { priority:'descendre', fightMobs:false });
  for(const who of [ME, OTHER, THIRD]) assert.equal((await game.state(who)).session.id, session.id, 'chacun la voit');
  assert.equal(await game.activeSessionId(THIRD.id), session.id);
});

test('groupe : refusé si un membre est déjà en session ; personne n\'est engagé', async () => {
  const { game, store } = setup();
  await game.start(THIRD, {});
  await assert.rejects(game.start(ME, {}, team), e => e.code === 'member_in_session' && /Max/.test(e.message));
  assert.equal((await store.sessionsOf(ME.id)).length, 0);
  assert.equal((await store.sessionsOf(OTHER.id)).length, 0);
});

test('groupe : équipe invalide refusée (doublon, trop de joueurs, lanceur pas en tête)', async () => {
  const { game } = setup();
  await assert.rejects(game.start(ME, {}, [team[0], team[0]]), { code:'bad_request' });
  await assert.rejects(game.start(ME, {}, [...team, { account:'DDDD4444', name:'X' }]), { code:'bad_request' });
  await assert.rejects(game.start(ME, {}, [team[1], team[0]]), { code:'bad_request' });
});

test('groupe : deux chefs qui lancent en même temps avec un joueur commun → une seule session pour lui', async () => {
  const { game, store } = setup();
  const r = await Promise.allSettled([game.start(ME, {}, [team[0], team[2]]), game.start(OTHER, {}, [team[1], team[2]])]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await store.sessionsOf(THIRD.id)).length, 1);
});

test('groupe : un joueur part, les autres continuent et reçoivent leur part ; lui rien', async () => {
  const { game, advance } = setup();
  const { session } = await game.start(ME, {}, team.slice(0, 2));
  advance(60_000);
  await game.leave(OTHER, {});
  assert.equal((await game.state(ME)).session.leaves.length, 1, 'les autres voient le départ (et son tick)');
  assert.equal((await game.state(OTHER)).session, null);
  advance(realDurationMs());
  await game.settleDue();
  assert.equal((await game.state(ME)).inventory.slots[0].qty, 9, 'seul présent : tout le coffre');
  assert.deepEqual((await game.state(OTHER)).inventory.slots, []);
  assert.equal((await game.state(ME)).ended.id, session.id);
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

/* ---------- focus minerai (changé pendant la session) ---------- */

test('focus : enregistré avec le tick du serveur (+ délai), nettoyé, visible dans la session', async () => {
  const { game, advance } = setup();
  const { session } = await game.start(ME, {});
  advance(10_000);
  const { event } = await game.focus(ME, { focus:{ coal:'only', stone:'target', iron:'boom' }, tick:5 });
  assert.equal(event.tick, tickAt(10_000, GAME.speed) + FOCUS.delayTicks, 'le tick du navigateur est ignoré en jeu normal');
  assert.deepEqual(event.focus, { coal:'only' });
  const st = await game.state(ME);
  assert.deepEqual(st.session.focus, [{ account:ME.id, tick:event.tick, focus:{ coal:'only' } }]);
  assert.equal(st.session.id, session.id);
});

test('focus : ticks toujours croissants ; dev = tick du navigateur', async () => {
  const { game } = setup({ dev:true });
  await game.start(ME, {});
  assert.equal((await game.focus(ME, { focus:{}, tick:300 })).event.tick, 300);
  assert.equal((await game.focus(ME, { focus:{}, tick:100 })).event.tick, 300, 'jamais avant le précédent');
  assert.equal((await game.focus(ME, { focus:{}, tick:-5 })).event.tick, 300);
});

test('focus : refusé sans session, après la fin, mal formé, ou trop souvent', async () => {
  const { game, advance } = setup();
  await assert.rejects(game.focus(ME, { focus:{} }), { code:'no_session' });
  await game.start(ME, {});
  for(const bad of [undefined, null, 'coal', ['only'], 3]) await assert.rejects(game.focus(ME, { focus:bad }), { code:'bad_request' });
  for(let i=0;i<FOCUS.maxChanges;i++) await game.focus(ME, { focus:{ coal:'target' } });
  await assert.rejects(game.focus(ME, { focus:{} }), { code:'too_many' });
  advance(realDurationMs(GAME.speed));
  await assert.rejects(game.focus(OTHER, { focus:{} }), { code:'no_session' });
});

test('focus : refusé quand la session est finie', async () => {
  const { game, advance } = setup();
  await game.start(ME, {});
  advance(realDurationMs(GAME.speed));
  await assert.rejects(game.focus(ME, { focus:{} }), { code:'session_over' });
});

/* ---------- four ---------- */

test('four : poser, fondre en temps réel (page fermée), récupérer — le serveur fait foi', async () => {
  const { game, store, advance } = setup();
  await store.putInventory(ME.id, { slots:[{ item:'Fer', qty:30 }, { item:'Charbon', qty:50 }], nextUid:1, credited:[] });
  let r = await game.furnace(ME, { action:'load', furnace:0, slot:'ore', item:'Fer', qty:30, opId:'op-load-ore' });
  r = await game.furnace(ME, { action:'load', furnace:0, slot:'fuel', item:'Charbon', qty:50, opId:'op-load-fuel' });
  assert.deepEqual(r.inventory.slots, []);
  assert.equal(r.furnaces.list.length, 1); assert.equal(r.furnaces.max, 3);
  advance(150_000);                                                // 2 lingots et demi
  const st = await game.state(ME);
  assert.deepEqual(st.furnaces.list[0].out, { item:'Lingot de fer', qty:2 });
  r = await game.furnace(ME, { action:'collect', furnace:0, opId:'op-collect-1' });
  assert.deepEqual(r.inventory.slots, [{ item:'Lingot de fer', qty:2 }]);
  assert.equal(r.furnaces.list[0].ore.qty, 10);
});

test('four : refus lisibles, rien ne bouge ; demande rejouée appliquée une fois', async () => {
  const { game, store } = setup();
  await store.putInventory(ME.id, { slots:[{ item:'Fer', qty:30 }], nextUid:1, credited:[] });
  await assert.rejects(game.furnace(ME, { action:'load', furnace:0, slot:'ore', item:'Fer', qty:31, opId:'op-trop-1' }), { code:'not_enough' });
  await assert.rejects(game.furnace(ME, { action:'load', furnace:2, slot:'ore', item:'Fer', qty:1, opId:'op-cadenas' }), { code:'bad_furnace' });
  await assert.rejects(game.furnace(ME, { action:'load', furnace:0, slot:'ore', item:'Fer', qty:1 }), { code:'bad_request' });
  const o = { action:'load', furnace:0, slot:'ore', item:'Fer', qty:10, opId:'op-double-clic' };
  await game.furnace(ME, o); const r = await game.furnace(ME, o);
  assert.deepEqual(r.inventory.slots, [{ item:'Fer', qty:20 }]);
  assert.deepEqual(r.furnaces.list[0].ore, { item:'Fer', qty:10 });
});

test('four : demandes simultanées (deux onglets) sans duplication', async () => {
  const { game, store } = setup();
  await store.putInventory(ME.id, { slots:[{ item:'Fer', qty:15 }], nextUid:1, credited:[] });
  const res = await Promise.allSettled([1, 2, 3].map(i =>
    game.furnace(ME, { action:'load', furnace:0, slot:'ore', item:'Fer', qty:10, opId:'op-onglet-' + i })));
  assert.equal(res.filter(x => x.status === 'fulfilled').length, 1);
  const st = await game.state(ME);
  assert.deepEqual(st.inventory.slots, [{ item:'Fer', qty:5 }]);
  assert.deepEqual(st.furnaces.list[0].ore, { item:'Fer', qty:10 });
});
