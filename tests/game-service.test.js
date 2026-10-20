/* Sessions de jeu côté serveur : lancement, départ, fin (refusée avant l'heure), versement des parts.
   Horloge simulée et faux gestionnaire de parties (les vraies parties en direct sont testées dans live.test.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME, TREASURE, FOCUS } from '../src/config.js';
const T1 = TREASURE.tiers[0].item;   // Treasure T1 : un exemplaire pour chacun
import { realDurationMs, tickAt, TOTAL_TICKS } from '../src/shared/game.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { fakeLive } from './helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const OTHER = { id:'BBBB2222', name:null, guest:true };

/* résumé de fin factice : le coffre est fixé par le test ; on partage comme le vrai (un sac par joueur présent) */
function fakeSummary(chestOf = () => ({ Charbon:9, [T1]:1 })){
  return rec => {
    const present = rec.players.filter(p => !rec.leaves.some(l => l.account === p.account));
    const chest = chestOf(rec), n = present.length;
    return { id:rec.id, chest, shares: rec.players.map(p => {
      const left = !present.includes(p);
      const bag = {};
      if(!left) for(const k in chest) bag[k] = k === T1 ? chest[k] : Math.floor(chest[k] / n);
      return { account:p.account, left, bag };
    }) };
  };
}

function setup({ dev = false, summary = fakeSummary() } = {}){
  let now = 1_000_000;
  const clock = () => now;
  const store = createMemoryGameStore();
  const live = fakeLive(summary);
  const game = createGameService({ store, liveRunner: live, clock, dev, randomSeed: () => 4242 });
  return { game, store, live, advance: ms => { now += ms; }, clock };
}

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

test('fin à l\'heure : la partie du serveur se termine, part versée dans l\'inventaire, résultat montré une fois', async () => {
  const { game, advance, live } = setup();
  const { session } = await game.start(ME, {});
  advance(realDurationMs());
  await game.pump();
  const st = await game.state(ME);
  assert.equal(st.session, null);
  assert.equal(st.ended.id, session.id);
  assert.equal(st.ended.status, 'done');
  assert.deepEqual(st.inventory.slots, [{ item:'Charbon', qty:9 }, { item:T1, qty:1 }]);
  assert.deepEqual(live.ended, [session.id]);
  await game.ack(ME, session.id);
  assert.equal((await game.state(ME)).ended, null);
});

test('joueur absent : la session arrivée à sa fin est versée quand même (au prochain passage du serveur)', async () => {
  const { game, advance } = setup();
  await game.start(ME, {});
  advance(realDurationMs() + 60_000);
  await game.pump();
  assert.equal((await game.state(ME)).inventory.slots[0].qty, 9);
});

test('quitter : on ne reçoit rien ; seul, la session s\'arrête', async () => {
  const { game, advance, live } = setup();
  await game.start(ME, {});
  advance(60_000);
  await game.leave(ME, {});
  const st = await game.state(ME);
  assert.equal(st.session, null);
  assert.equal(st.ended, null, 'pas de bilan pour celui qui est parti');
  assert.deepEqual(st.inventory.slots, []);
  assert.deepEqual(live.ended, [], 'pas de partage : abandonnée');
  await game.start(ME, {});   // et on peut relancer
});

test('quitter : le départ a lieu tout de suite, au tick de la partie du serveur (pas fourni par le navigateur)', async () => {
  const { game, advance, store } = setup();
  const { session } = await game.start(ME, {}, team.slice(0, 2));
  advance(10_000);                                   // 10 s réelles à x2 = 20 s de jeu = 200 ticks
  await game.pump();                                 // le serveur fait avancer la partie
  await game.leave(ME, { tick: 999999 });
  assert.equal((await store.getGameSession(session.id)).leaves[0].tick, 200);
  advance(realDurationMs() - 12_000);                // juste avant la fin
  await game.pump();
  await game.leave(OTHER, {});
  assert.equal((await store.getGameSession(session.id)).leaves[1].tick, TOTAL_TICKS - 40);
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
  await game.pump();
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

test('partie en panne : relancée au passage suivant (reconstruite), versée une seule fois', async () => {
  const { game, advance, store } = setup();
  const { session } = await game.start(ME, {});
  advance(realDurationMs() / 2);
  await game.pump();
  game.close();                                      // comme si la partie (ou le serveur) s'était arrêtée
  advance(realDurationMs());
  await game.pump(); await game.pump();
  assert.equal((await game.state(ME)).inventory.slots[0].qty, 9);
  assert.equal((await store.getGameSession(session.id)).status, 'done');
});

test('redémarrage du serveur : les sessions en cours repartent et se terminent ; rien n\'est versé deux fois', async () => {
  const { game, advance, store } = setup();
  const { session } = await game.start(ME, {});
  advance(realDurationMs());
  await game.settle(session.id);
  const rec = await store.getGameSession(session.id);
  rec.status = 'settling'; await store.putGameSession(rec);    // ancien format : arrêté en plein versement
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

test('mode dev : seed, mineurs de test et réglages acceptés (bornés) ; départ au tick de la partie', async () => {
  const { game, store } = setup({ dev:true });
  const { session } = await game.start(ME, { seed:7, bots:5, overrides:{ STATS:{ pods:500, speed:-3 }, CFG:{ evil:1 } } });
  assert.equal(session.seed, 7);
  assert.equal(session.bots, GAME.maxPlayers - 1);
  assert.deepEqual(session.overrides, { STATS:{ pods:500 } });
  assert.equal(session.finishAt, null);
  await game.leave(ME, { tick:123 });
  assert.equal((await store.getGameSession(session.id)).leaves[0].tick, 0, 'le tick du navigateur est ignoré');
  assert.equal(game.info().dev, true);
});

test('mode dev : fin quand le navigateur le dit', async () => {
  const { game } = setup({ dev:true });
  await game.start(ME, {});
  await game.finish(ME);
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

test('focus : appliqué tout de suite, au tick de la partie du serveur, nettoyé, visible dans la session', async () => {
  const { game, advance } = setup();
  const { session } = await game.start(ME, {});
  advance(10_000);
  await game.pump();
  const { event } = await game.focus(ME, { focus:{ coal:'only', stone:'target', iron:'boom' }, tick:5 });
  assert.equal(event.tick, tickAt(10_000, GAME.speed), 'le tick du navigateur est ignoré');
  assert.deepEqual(event.focus, { coal:'only' });
  const st = await game.state(ME);
  assert.deepEqual(st.session.focus, [{ account:ME.id, tick:event.tick, focus:{ coal:'only' } }]);
  assert.equal(st.session.id, session.id);
});

test('mode dev : vitesse et pause sur le serveur ; la partie suit cette horloge', async () => {
  const { game, advance } = setup({ dev:true });
  await game.start(ME, {});
  await game.devClock(ME, { speed:20 });
  advance(1000);                                     // 1 s à x20 = 20 s de jeu = 200 ticks
  await game.pump();
  assert.equal((await game.focus(ME, { focus:{} })).event.tick, 200);
  await game.devClock(ME, { paused:true });
  advance(60_000);
  await game.pump();
  assert.equal((await game.focus(ME, { focus:{} })).event.tick, 200, 'en pause : la partie n\'avance pas');
  await game.devClock(ME, { paused:false, speed:7 });
  assert.equal((await game.state(ME)).session.clock.speed, 20, 'vitesse hors liste ignorée');
});

test('horloge dev refusée en jeu normal', async () => {
  const { game } = setup();
  await game.start(ME, {});
  await assert.rejects(game.devClock(ME, { speed:300 }), { code:'forbidden' });
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

test('four : mode Alliage par le serveur (Tainted iron en 3 min), changement refusé si des ingrédients restent', async () => {
  const { game, store, advance } = setup();
  await store.putInventory(ME.id, { slots:[{ item:'Lingot de fer', qty:5 }, { item:'Chitine', qty:20 }, { item:'Charbon', qty:50 }, { item:'Fer', qty:10 }], nextUid:1, credited:[] });
  await game.furnace(ME, { action:'load', furnace:0, slot:'ore', item:'Fer', qty:10, opId:'op-alloy-1' });
  await assert.rejects(game.furnace(ME, { action:'mode', furnace:0, mode:'alloy', opId:'op-alloy-2' }), { code:'not_empty' });
  await game.furnace(ME, { action:'unload', furnace:0, slot:'ore', opId:'op-alloy-3' });
  let r = await game.furnace(ME, { action:'mode', furnace:0, mode:'alloy', opId:'op-alloy-4' });
  assert.equal(r.furnaces.list[0].mode, 'alloy');
  await game.furnace(ME, { action:'load', furnace:0, slot:'a', item:'Lingot de fer', qty:5, opId:'op-alloy-5' });
  await game.furnace(ME, { action:'load', furnace:0, slot:'b', item:'Chitine', qty:20, opId:'op-alloy-6' });
  await game.furnace(ME, { action:'load', furnace:0, slot:'fuel', item:'Charbon', qty:50, opId:'op-alloy-7' });
  advance(180_000);
  r = await game.furnace(ME, { action:'collect', furnace:0, opId:'op-alloy-8' });
  const has = item => r.inventory.slots.find(s => s?.item === item)?.qty ?? 0;
  assert.deepEqual([has('Tainted iron'), has('Fer'), has('Lingot de fer'), has('Chitine'), has('Charbon')], [1, 10, 0, 0, 0]);
  assert.equal((await game.state(ME)).furnaces.list[0].mode, 'alloy', 'le mode est enregistré');
});

test('blueprint par le serveur : consommé une fois, recette débloquée et renvoyée au navigateur', async () => {
  const { game, store } = setup();
  await store.putInventory(ME.id, { slots:[{ item:'Épée en fer BP', qty:1 }, { item:'Tainted iron', qty:10 }], nextUid:1, credited:[] });
  await assert.rejects(game.craft(ME, { item:'Épée en fer', opId:'op-sword-0' }), { code:'locked' });
  const o = { item:'Épée en fer BP', opId:'op-learn-sword' };
  let r = await game.learn(ME, o);
  assert.equal(r.recipe, 'Épée en fer'); assert.deepEqual(r.inventory.unlocked, ['Épée en fer']);
  r = await game.learn(ME, o);                                            // double clic : rien de plus
  assert.deepEqual(r.inventory.unlocked, ['Épée en fer']);
  await assert.rejects(game.learn(ME, { item:'Épée en fer BP', opId:'op-learn-again' }), { code:'known' });
  await assert.rejects(game.learn(ME, { item:'Four en fer BP', opId:'op-learn-four' }), { code:'no_use' });
  r = await game.craft(ME, { item:'Épée en fer', opId:'op-sword-1' });
  assert.ok(r.inventory.slots.some(s => s?.item === 'Épée en fer'));
  const st = await game.state(ME);
  assert.deepEqual(st.inventory.unlocked, ['Épée en fer']);
  assert.ok(!st.inventory.slots.some(s => s?.item === 'Épée en fer BP' || s?.item === 'Tainted iron'));
});

test('table de recherche par le serveur : 100 parts → un blueprint ; recycler → 30 à 60 parts ; demandes rejouées', async () => {
  const { game, store } = setup();
  await store.putInventory(ME.id, { slots:[{ item:'Blueprint parts', qty:150 }], nextUid:1, credited:[] });
  const o = { action:'research', tier:1, opId:'op-research-1' };
  const a = await game.research(ME, o), b = await game.research(ME, o);
  assert.equal(b.item, a.item, 'double clic : même blueprint');
  const has = (r, item) => r.inventory.slots.find(s => s?.item === item)?.qty ?? 0;
  assert.equal(has(b, 'Blueprint parts'), 50); assert.equal(has(b, a.item), 1);
  await assert.rejects(game.research(ME, { action:'research', tier:1, opId:'op-research-2' }), { code:'not_enough' });
  await assert.rejects(game.research(ME, { action:'research', tier:7, opId:'op-research-3' }), { code:'bad_tier' });
  await assert.rejects(game.research(ME, { action:'voler', opId:'op-research-4' }), { code:'bad_request' });
  const c = await game.research(ME, { action:'recycle', item:a.item, opId:'op-recycle-1' });
  assert.ok(c.parts >= 30 && c.parts <= 60);
  assert.equal(has(c, 'Blueprint parts'), 50 + c.parts); assert.equal(has(c, a.item), 0);
  await assert.rejects(game.research(ME, { action:'recycle', item:a.item, opId:'op-recycle-2' }), { code:'not_owned' });
  const st = await game.state(ME);
  assert.equal(st.inventory.slots.find(s => s?.item === 'Blueprint parts').qty, 50 + c.parts, 'enregistré');
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

/* ---------- craft et stuff ---------- */

test('craft puis équiper : le serveur fait foi, rien n\'est dupliqué', async () => {
  const { game, store } = setup();
  await store.putInventory(ME.id, { slots:[{ item:'Lingot de fer', qty:35 }], nextUid:1, credited:[] });
  await assert.rejects(game.craft(ME, { item:'Pioche en pierre' }), { code:'bad_request' });
  let r = await game.craft(ME, { item:'Pioche en pierre', opId:'op-craft-srv' });
  r = await game.craft(ME, { item:'Pioche en pierre', opId:'op-craft-srv' });     // double clic
  const pick = r.inventory.slots.find(s => s?.item === 'Pioche en pierre');
  assert.deepEqual(r.inventory.slots.filter(Boolean).map(s => [s.item, s.qty]), [['Lingot de fer', 5], ['Pioche en pierre', 1]]);
  await assert.rejects(game.craft(ME, { item:'Pioche en pierre', opId:'op-craft-2' }), { code:'not_enough' });
  const e = await game.stuff(ME, { action:'equip', slot:'pioche', uid:pick.uid, opId:'op-equip-srv' });
  assert.deepEqual(e.stuff.pioche, { item:'Pioche en pierre', uid:pick.uid });
  assert.equal(e.inventory.slots.filter(Boolean).some(s => s.item === 'Pioche en pierre'), false);
  const st = await game.state(ME);
  assert.deepEqual(st.stuff.pioche, { item:'Pioche en pierre', uid:pick.uid });
  await assert.rejects(game.stuff(ME, { action:'equip', slot:'pioche', uid:pick.uid, opId:'op-equip-2' }), { code:'not_owned' });
});

/* ---------- budget de calcul (serveur faible, ex. Render gratuit) ---------- */

function budgetSetup(tickBudget){
  let now = 1_000_000;
  const store = createMemoryGameStore();
  const live = fakeLive(fakeSummary());
  const game = createGameService({ store, liveRunner: live, clock: () => now, randomSeed: () => 4242,
    config:{ startsPerHour:1000, keepEnded:1e12, maxLive:2, tickBudget, pumpEvery:200, maxStep:200 } });
  return { game, store, advance: ms => { now += ms; } };
}
const P = n => ({ id:'P'+String(n).padStart(7, '0'), name:'J'+n, guest:false });

test('budget : au plus tickBudget ticks/s au total, les sessions à l\'heure d\'abord, une session dépassée à la fois', async () => {
  const { game, store, advance } = budgetSetup(100);             // 100 ticks/s = 20 par passage (200 ms)
  const old1 = (await game.start(P(1), {})).session, old2 = (await game.start(P(2), {})).session;
  advance(realDurationMs() + 60_000);                             // ces deux-là sont dépassées (serveur arrêté)
  const fresh = (await game.start(P(3), {})).session;             // les dépassées ne prennent pas de place
  advance(500);                                                   // la nouvelle a 10 ticks de retard
  await game.pump();
  const st = async s => (await store.getGameSession(s.id)).status;
  /* nouvelle session servie en premier (10 ticks), puis 10 ticks pour la plus ancienne dépassée, rien pour l'autre */
  assert.equal(await st(old1), 'running'); assert.equal(await st(old2), 'running');
  assert.equal((await game.state(P(3))).session.tick, 10, 'la session à l\'heure a son compte');
  assert.equal((await game.state(P(1))).session.tick, 10, 'la plus ancienne dépassée : le reste du budget');
  assert.equal((await game.state(P(2))).session.tick, 0, 'l\'autre attend son tour');
});

test('budget : les sessions dépassées finissent quand même, et rien n\'est versé deux fois', async () => {
  const { game, advance } = budgetSetup(1e6);
  await game.start(P(1), {}); await game.start(P(2), {});
  advance(realDurationMs() + 60_000);
  for(let i = 0; i < 6; i++) await game.pump();
  assert.equal((await game.state(P(1))).inventory.slots[0].qty, 9);
  assert.equal((await game.state(P(2))).inventory.slots[0].qty, 9);
});

test('places : deux sessions à l\'heure = serveur plein ; une session dépassée ne compte pas', async () => {
  const { game, advance } = budgetSetup(1e6);
  await game.start(P(1), {}); await game.start(P(2), {});
  await assert.rejects(game.start(P(3), {}), { code:'server_busy' });
  advance(realDurationMs() + 1000);
  await game.start(P(3), {});
});

test('ouvrir un Treasure T1 avec le vrai hasard du serveur (pas de hasard fourni par le test)', async () => {
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(fakeSummary()) });
  await store.putInventory(ME.id, { slots:[{ item:T1, qty:2 }], nextUid:1, credited:[] });
  const r = await game.open(ME, { item:T1, opId:'op-vrai-hasard' });
  assert.ok(r.loot['Charbon'] > 0, 'un butin a été tiré');
  assert.equal(r.inventory.slots.find(s => s?.item === T1).qty, 1);
});
