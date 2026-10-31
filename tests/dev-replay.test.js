/* Rejeu à l'écran (mode dev, 25/10/2026) : une session exportée de la base en ligne (scripts/export-session.js) rejouée
   comme une session dev, celui qui regarde à la place du premier joueur. Même partie, rien de versé. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME, TREASURE } from '../src/config.js';
import { replayRecord } from '../src/shared/game.js';
import { replayFields, sameAsOriginal } from '../server/game/replay.js';
import { compactRecord } from '../src/ui/lobby.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { fakeLive } from './helpers.js';

const ME = { id:'VIEWER01', name:'Geoffrey', guest:false };
const T1 = TREASURE.tiers[0].item;

/* enregistrement tel que sorti de la base : deux joueurs, un départ, un focus, déjà terminé */
const original = (extra = {}) => ({
  id:'ORIG-1', mode:'mine', seed:303843686, dev:false, speed:2, bots:0, status:'done', seen:['P1', 'P2'],
  players:[{ account:'P1', name:'Crousti' }, { account:'P2', name:'Bob' }],
  prefs:{ P1:{ priority:'descendre', fightMobs:true }, P2:{ priority:'minerais', fightMobs:'flee' } },
  looks:{ P1:{}, P2:{} }, gear:{}, skills:{ P1:{ tree:'mineur', ranks:{} } }, spells:{},
  overrides:null, leaves:[{ account:'P2', tick:3000, at:123 }], focus:[{ account:'P1', tick:500, at:9, focus:{ coal:'only' } }],
  result:{ chest:{ Charbon:18, [T1]:1 }, shares:[{ account:'P1', left:false, bag:{ Charbon:18, [T1]:1 } }, { account:'P2', left:true, bag:{} }] },
  ...extra,
});

test('replayFields : celui qui regarde prend la place du premier joueur ; préférences, skills, départs et focus suivent', () => {
  const f = replayFields(original(), ME.id);
  assert.deepEqual(f.players, [{ account:ME.id, name:'Crousti' }, { account:'rejeu-2', name:'Bob' }]);
  assert.deepEqual(f.prefs, { [ME.id]:{ priority:'descendre', fightMobs:true }, 'rejeu-2':{ priority:'minerais', fightMobs:'flee' } });
  assert.deepEqual(f.skills, { [ME.id]:{ tree:'mineur', ranks:{} } });
  assert.deepEqual(f.leaves, [{ account:'rejeu-2', tick:3000 }], 'sans heure : un départ de la partie, pas de celui qui regarde');
  assert.deepEqual(f.focus, [{ account:ME.id, tick:500, focus:{ coal:'only' } }]);
  assert.equal(f.seed, 303843686); assert.equal(f.mode, 'mine');
  assert.deepEqual(f.replay, { of:'ORIG-1', bags:[{ Charbon:18, [T1]:1 }, {}] });
});

test('replayFields : fichier invalide refusé (seed, joueurs, mode) ; événements mal formés ou d\'inconnus ignorés', () => {
  for(const raw of [null, [], 'x', original({ seed:-1 }), original({ seed:2**31 }), original({ seed:'303843686' }),
                    original({ players:[] }), original({ players:[{ name:'x' }] }),
                    original({ players:[{ account:'A' }, { account:'A' }] }),
                    original({ players:Array.from({ length:GAME.maxPlayers + 1 }, (_, i) => ({ account:'A' + i })) }),
                    original({ mode:'volcan' })])
    assert.ok(replayFields(raw, ME.id).error, JSON.stringify(raw)?.slice(0, 80));
  const f = replayFields(original({ leaves:[{ account:'ZZ', tick:5 }, { account:'P2', tick:-1 }, 'x'],
                                    focus:[{ account:'P1', tick:1.5, focus:{} }], bots:99, result:undefined }), ME.id);
  assert.deepEqual(f.leaves, []); assert.deepEqual(f.focus, []);
  assert.equal(f.bots, GAME.maxPlayers - 2);
  assert.equal(f.replay.bags, null);
});

test('même partie : changer les comptes ne change rien au résultat (seed, mineurs, départs, focus)', () => {
  const orig = original();
  const f = replayFields(orig, ME.id);
  const noAcc = list => list.map(({ account, ...r }) => r);   // seuls les comptes diffèrent (mineurs et parts)
  const strip = s => JSON.parse(JSON.stringify({ ...s, id:undefined, shares:noAcc(s.shares), miners:noAcc(s.miners) }));
  const a = replayRecord({ ...orig, id:'X' }, { maxTicks:4000 }), b = replayRecord({ ...f, id:'X' }, { maxTicks:4000 });
  assert.deepEqual(strip(b), strip(a));
  assert.equal(sameAsOriginal({ replay:{ bags:a.shares.map(s => s.bag) } }, b), true);
  assert.equal(sameAsOriginal({ replay:{ bags:[{ Charbon:1 }] } }, b), false);
  assert.equal(sameAsOriginal({ replay:{ bags:null } }, b), null);
});

test('compactRecord : garde ce que lit le serveur, et seulement les parts du coffre du résultat', () => {
  const c = compactRecord(original());
  assert.equal('seen' in c, false); assert.equal('status' in c, false); assert.equal('dev' in c, false);
  assert.deepEqual(c.result, { shares:[{ bag:{ Charbon:18, [T1]:1 } }, { bag:{} }] });
  assert.deepEqual(replayFields(c, ME.id).replay.bags, replayFields(original(), ME.id).replay.bags);
  for(const bad of [null, [], 'x']) assert.throws(() => compactRecord(bad));
});

/* ---------- service : mode dev seulement, rien de versé ---------- */

function setup(dev = true){
  let now = 1_000_000;
  const store = createMemoryGameStore();
  /* coffre fixé : 18 charbons et un T1, partagés entre les présents (comme fakeSummary de game-service.test.js) */
  const live = fakeLive(rec => {
    const present = rec.players.filter(p => !rec.leaves.some(l => l.account === p.account));
    return { id:rec.id, seed:rec.seed, chest:{ Charbon:18, [T1]:1 }, shares:rec.players.map(p => {
      const left = !present.includes(p);
      return { account:p.account, left, bag: left ? {} : { Charbon:Math.floor(18 / present.length), [T1]:1 } };
    }) };
  });
  const game = createGameService({ store, liveRunner:live, clock:() => now, dev, randomSeed:() => 4242 });
  return { game, store };
}

test('rejeu : refusé hors mode dev ; fichier invalide refusé sans rien créer', async () => {
  await assert.rejects(setup(false).game.replay(ME, { record:original() }), { code:'forbidden' });
  const { game } = setup();
  for(const record of [undefined, null, original({ seed:'x' }), original({ players:[] })])
    await assert.rejects(game.replay(ME, { record }), { code:'bad_request' });
  assert.equal((await game.state(ME)).session, null);
});

test('rejeu : session dev visible par celui qui regarde (même si son joueur était parti) ; rien n\'est versé à la fin', async () => {
  const { game, store } = setup();
  const { session } = await game.replay(ME, { record:original({ leaves:[{ account:'P1', tick:3000, at:5 }] }) });
  assert.equal(session.replay, true); assert.equal(session.dev, true); assert.equal(session.seed, 303843686);
  assert.equal((await game.state(ME)).session?.id, session.id, 'le départ enregistré du joueur d\'origine ne fait pas partir le spectateur');
  await assert.rejects(game.replay(ME, { record:original() }), { code:'session_running' });
  await game.finish(ME);
  const st = await game.state(ME);
  assert.deepEqual(st.inventory.slots.filter(Boolean), [], 'rien de versé');
  assert.equal(st.progress.xp, 0, 'pas d\'XP');
  assert.equal(st.ended.replay, true);
  assert.equal(typeof st.ended.result.replay.same, 'boolean');
  const j = await store.getJudgment();
  assert.ok(!j || (j.angel.count === 0 && j.demon.count === 0), 'jauges intactes');
});

test('rejeu : même coffre que l\'original → same:true ; Quitter arrête le rejeu', async () => {
  const { game } = setup();
  /* P1 présent seul à la fin (P2 parti) : la part de P1 vaut tout le coffre */
  await game.replay(ME, { record:original({ result:{ shares:[{ bag:{ Charbon:18, [T1]:1 } }, { bag:{} }] } }) });
  await game.finish(ME);
  assert.equal((await game.state(ME)).ended.result.replay.same, true);
  const g2 = setup().game;
  await g2.replay(ME, { record:original() });
  await g2.leave(ME, {});
  const st = await g2.state(ME);
  assert.equal(st.session, null, 'rejeu arrêté');
  assert.deepEqual(st.inventory.slots.filter(Boolean), []);
});

test('rejeu : anneaux, niveau, shrines, stèles et k holes de l\'enregistrement sont repris (31/10/2026)', async () => {
  const { replayFields } = await import('../server/game/replay.js');
  const f = replayFields({ seed:5, mode:'mine', players:[{ account:'A', name:'Zoe' }], rings:['x'], level:2, modulation:{ gsMax:9 },
                           shrines:['s'], stele:'p', heroic:'h', kholes:[{ tick:12, map:'filons', at:3 }, { tick:-1 }] }, 'MOI');
  assert.deepEqual(f.rings, ['x']);
  assert.deepEqual([f.level, f.modulation, f.shrines, f.stele, f.heroic], [2, { gsMax:9 }, ['s'], 'p', 'h']);
  assert.deepEqual(f.kholes, [{ tick:12, map:'filons' }]);
});
