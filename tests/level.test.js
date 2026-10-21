/* Niveau du mineur : courbe d'XP, XP gagnée pendant la session (minerais, mobs), pot partagé à parts égales,
   versement par le serveur (une seule fois, rien pour qui est parti). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XP, IDS } from '../src/config.js';
import { xpToNext, levelOf, xpForLevel, xpShare, createProgress, sanitizeProgress, creditXp } from '../src/meta/level.js';
import { mineBlock, killMob } from '../src/sim/actions.js';
import { newSession, endSession, leaveSession } from '../src/sim/session.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { realDurationMs } from '../src/shared/game.js';
import { worldFrom, fakeLive } from './helpers.js';

/* ---------- courbe ---------- */

test('courbe : 1000 XP pour le niveau 2, puis ×1,5 à chaque niveau', () => {
  assert.deepEqual([1,2,3,4].map(xpToNext), [1000, 1500, 2250, 3375]);
  assert.deepEqual([1,2,3,4,5].map(xpForLevel), [0, 1000, 2500, 4750, 8125]);
});

test('levelOf : niveau, avancement dans le niveau, points de talent (1 par niveau)', () => {
  assert.deepEqual(levelOf(0),    { level:1, into:0,   need:1000, talentPoints:0 });
  assert.deepEqual(levelOf(999),  { level:1, into:999, need:1000, talentPoints:0 });
  assert.deepEqual(levelOf(1000), { level:2, into:0,   need:1500, talentPoints:1 });
  assert.deepEqual(levelOf(2600), { level:3, into:100, need:2250, talentPoints:2 });
  for(const bad of [NaN, -5, Infinity, '9999', null, undefined]) assert.equal(levelOf(bad).level, 1);
  assert.ok(levelOf(Number.MAX_SAFE_INTEGER).level <= XP.maxLevel, 'pas de boucle infinie');
});

test('affichage : niveau, pourcentage (arrondi vers le bas) et XP / XP requise ; niveau max sans « / 0 »', async () => {
  const { renderLevel } = await import('../src/ui/level.js');
  const el = { innerHTML:'' };
  renderLevel(el, { xp:2600, ...levelOf(2600) });                  // niveau 3 : 100 / 2250 → 4,4 %
  assert.match(el.innerHTML, /Niveau 3/);
  assert.match(el.innerHTML, /<b>4 %<\/b>/);
  assert.match(el.innerHTML, /100 \/ 2\s250 XP/u);
  assert.match(el.innerHTML, /width:4\.4\d*%/);
  renderLevel(el, { xp:1e9, level:XP.maxLevel, into:0, need:0, talentPoints:XP.maxLevel - 1 });   // dernier niveau
  assert.match(el.innerHTML, /Niveau max/);
  assert.doesNotMatch(el.innerHTML, /\/ 0 XP/);
  renderLevel(el, null);
  assert.match(el.innerHTML, /—/);
});

/* ---------- partage et versement ---------- */

test('partage : parts égales arrondies vers le bas, jamais plus que le pot', () => {
  assert.equal(xpShare(10, 3), 3);
  assert.equal(xpShare(865, 1), 865);
  assert.equal(xpShare(10, 0), 0);
  for(const bad of [-10, 1.5, NaN, Infinity, '10']) assert.equal(xpShare(bad, 2), 0);
  for(const [pot, n] of [[7,3],[100,3],[1,2]]) assert.ok(xpShare(pot, n) * n <= pot);
});

test('creditXp : une session n\'est comptée qu\'une fois ; quantités invalides refusées', () => {
  const p = createProgress();
  assert.equal(creditXp(p, 's1', 500), true);
  assert.equal(creditXp(p, 's1', 500), false, 'rejouée : rien');
  for(const bad of [-1, 1.5, NaN, Infinity, '5', null]) assert.equal(creditXp(p, 's2', bad), false);
  assert.equal(creditXp(p, '', 5), false);
  assert.equal(p.xp, 500);
  assert.deepEqual(sanitizeProgress({ xp:-3, credited:'x' }), { xp:0, credited:[] });
  assert.deepEqual(sanitizeProgress({ xp:1.5 }), { xp:0, credited:[] });
});

/* ---------- XP gagnée pendant la session ---------- */

test('minerais : XP selon le type, dans le pot commun et dans la contribution du mineur', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#c@ ', '#'.repeat(50)]), m = G.miners[0];
  for(const [key, x] of [['coal',2], ['iron',3], ['gold',4], ['diamond',5]]){ G.tiles[2][x] = IDS[key]; }
  G.tiles[2][1] = IDS.coal;
  const before = G.stats.xp;
  mineBlock(G, m, 1, 2);
  assert.equal(G.stats.xp - before, XP.ore.coal);
  for(const [x, key] of [[3,'iron'],[4,'gold'],[5,'diamond']]){ const b = G.stats.xp; mineBlock(G, m, x, 2); assert.equal(G.stats.xp - b, XP.ore[key]); }
  assert.equal(m.stats.xp, 1+2+4+7);
  const b = G.stats.xp; G.tiles[2][6] = IDS.stone; mineBlock(G, m, 6, 2);
  assert.equal(G.stats.xp, b, 'la pierre ne rapporte rien');
});

test('mobs : bestiole 5, gobelin 10, mimic 5 (sans XP de minerai en plus)', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@  ', '#'.repeat(50)]), m = G.miners[0];
  for(const [type, xp] of [['bestiole',5], ['gobelin',10]]){
    const o = { id:90, type, x:2, y:2, hp:1, maxhp:1 }; G.mobs.push(o);
    const b = G.stats.xp; killMob(G, m, o); assert.equal(G.stats.xp - b, xp, type);
  }
  G.tiles[2][3] = IDS.coal;
  const mim = { id:91, type:'mimic', x:3, y:2, hp:1, maxhp:1, revealed:true, ore:IDS.coal }; G.mobs.push(mim);
  const b = G.stats.xp; killMob(G, m, mim);
  assert.equal(G.stats.xp - b, XP.mob.mimic);
});

test('fin de session : XP partagée par tranches entre les présents de chaque tranche ; qui est parti n\'a rien', () => {
  const G = newSession(5, { miners:3, accounts:['A','B','C'] });
  G.stats.xp = 90;                       // gagnée à 3
  leaveSession(G, 'C');
  G.stats.xp = 150;                      // + 60 gagnée à 2
  endSession(G);
  assert.equal(G.summary.xp, 150);
  assert.deepEqual(G.summary.shares.map(s => s.xp), [30 + 30, 30 + 30, 0], 'le tiers de C est perdu');
  const solo = newSession(5, { miners:3, accounts:['A','B','C'] }); solo.stats.xp = 100; endSession(solo);
  assert.deepEqual(solo.summary.shares.map(s => s.xp), [33, 33, 33], 'sans départ : comme avant');
});

/* ---------- versement par le serveur ---------- */

function server(){
  let now = 1_000_000;
  const store = createMemoryGameStore();
  const live = fakeLive(rec => ({ id:rec.id, chest:{}, xp:900, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{}, xp:900 })) }));
  const game = createGameService({ store, liveRunner: live, clock: () => now, dev:false, randomSeed: () => 1 });
  return { game, store, advance: ms => { now += ms; } };
}
const ME = { id:'AAAA1111', name:'Zoe', guest:false };

test('serveur : l\'XP est versée à la fin, une seule fois, et le niveau se lit dans l\'état', async () => {
  const { game, store, advance } = server();
  assert.deepEqual((await game.state(ME)).progress, { xp:0, level:1, into:0, need:1000, talentPoints:0 });
  for(let i = 0; i < 2; i++){
    await game.start(ME, {});
    advance(realDurationMs());
    await game.pump();
    const st = await game.state(ME);
    await game.ack(ME, st.ended.id);
  }
  const p = (await game.state(ME)).progress;
  assert.equal(p.xp, 1800);
  assert.equal(p.level, 2); assert.equal(p.into, 800); assert.equal(p.talentPoints, 1);
  assert.equal((await store.getProgress(ME.id)).credited.length, 2);
});
