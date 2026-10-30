/* Instance II, le Golbute (30/10/2026) : arène, autoattack (propulsion + chute qui étourdit), avalanche (Sonné, mort à
   6 stacks, ténacité), Division (golems, boss absent), cristal (minage), enrage, fin (victoire, temps, tous morts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTANCE, DT, CFG, mobHp } from '../src/config.js';
import { newGolbute, tickGolbute, golOpen, slamChance, endGolbute, leaveGolbute, GOLBUTE_TICKS } from '../src/sim/instance/golbute.js';

const C = INSTANCE.golbute;
const run = (G, s) => { const n = Math.round(s / DT); for(let i = 0; i < n && !G.over; i++) tickGolbute(G); };
/* mineur qui ne fait rien (pas de dégâts, pas de minage) : on observe le boss */
const idle = (n = 3, carac = {}) => Array.from({ length: n }, (_, i) => ({ name: 'M' + i, account: 'A' + i, carac: { damage: 0, mineSpeed: 0, ...carac } }));

test('arène : 20 × 20, sol plat, mineurs à gauche, Golbute 5 × 5 au sol au milieu (ses cases sont un mur)', () => {
  const G = newGolbute(1, { miners: idle() });
  assert.equal(G.w, 20); assert.equal(G.h, 20);
  assert.ok(G.miners.every(m => m.y === G.floorY && m.x <= 3));
  const b = G.boss;
  assert.equal(b.w, 5); assert.equal(b.h, 5); assert.equal(b.y, G.floorY); assert.equal(b.x, 7);
  assert.equal(b.knockRes, 100);
  assert.ok(!golOpen(G, 7, G.floorY) && !golOpen(G, 11, G.floorY - 4) && golOpen(G, 6, G.floorY) && golOpen(G, 9, G.floorY - 5));
});

test('autoattack : chance × (1 − recul) × (1 − ténacité) ; propulsé de 3 en haut, 1 en arrière, étourdi à l\'atterrissage', () => {
  const G = newGolbute(2, { miners: idle(1) });
  const m = G.miners[0];
  assert.equal(slamChance(G, m), 0.5);
  m.carac.knockRes = 50; m.carac.tenacity = 20;
  assert.ok(Math.abs(slamChance(G, m) - 0.5 * 0.5 * 0.8) < 1e-12);
  m.carac.knockRes = 0; m.carac.tenacity = 0;
  G.fightRng = () => 0;                         // toujours propulsé
  m.x = 6; m.action = null;
  run(G, C.slam.every + DT / 2);
  assert.equal(m.y, G.floorY - C.slam.high, 'en l\'air');
  assert.equal(m.x, 6 - C.slam.back, 'en arrière');
  run(G, 1);
  assert.equal(m.y, G.floorY);
  assert.equal(m.action?.type, 'stun'); assert.equal(m.action.data.cause, 'fall');
  assert.equal(m.action.dur, CFG.stunTime);
  /* hors de portée (plus de 3 cases) : rien */
  const H = newGolbute(2, { miners: idle(1, { speed: 0.01 }) }); H.fightRng = () => 0;   // il ne s'approche pas
  H.miners[0].x = 7 - C.slam.range - 1;
  run(H, C.slam.every + DT);
  assert.equal(H.miners[0].y, H.floorY); assert.equal(H.stats.knocks, 0);
});

test('avalanche : toutes les 60 s sur tous ; étourdi 5 s + Sonné 90 s réactualisé ; mort à 6 stacks ; tous morts = échec', () => {
  const G = newGolbute(3, { miners: idle(2) });
  G.boss.cd = Infinity; G.next.split = Infinity;   // ni autoattack ni division
  run(G, C.avalanche.every + DT);
  for(const m of G.miners){ assert.equal(m.dazed, 1); assert.equal(m.action?.type, 'stun'); assert.equal(m.action.data.cause, 'avalanche'); }
  assert.ok(Math.abs(G.miners[0].dazedUntil - (C.avalanche.every + C.avalanche.dazed)) < DT + 1e-9);
  run(G, C.avalanche.every * (C.avalanche.deathStacks - 1));
  assert.ok(G.miners.every(m => m.dead), 'morts au 6e stack');
  assert.ok(G.over); assert.equal(G.summary.success, false);
  assert.equal(G.stats.deaths, 2);
});

test('avalanche : la ténacité l\'esquive ; un stack expiré (90 s sans coup) repart de 1', () => {
  const G = newGolbute(4, { miners: idle(1, { tenacity: 100 }) });
  G.boss.cd = Infinity; G.next.split = Infinity;
  run(G, C.avalanche.every * 3 + DT);
  assert.equal(G.miners[0].dazed, 0); assert.equal(G.stats.dodges, 3);
  const H = newGolbute(4, { miners: idle(1) });
  H.boss.cd = Infinity; H.next.split = Infinity;
  const m = H.miners[0];
  m.dazed = 3; m.dazedUntil = C.avalanche.every - 1;   // expiré avant la prochaine avalanche
  run(H, C.avalanche.every + DT);
  assert.equal(m.dazed, 1);
});

test('Division : à 3 min, 10 golems de l\'area 8, boss absent (ni coups ni mur), avalanche maintenue ; il revient quand ils sont morts', () => {
  const G = newGolbute(5, { miners: idle(1) });
  G.next.avalanche = Infinity;
  run(G, C.split.every + DT);
  assert.equal(G.boss.state, 'split');
  assert.equal(G.golems.length, C.split.count);
  assert.ok(G.golems.every(o => o.maxhp === mobHp('golem', C.split.area)));
  assert.ok(golOpen(G, 9, G.floorY), 'le boss n\'est plus un mur');
  const slams = G.stats.slams;
  G.next.avalanche = G.t + 1;
  run(G, 2);
  assert.equal(G.stats.slams, slams, 'pas d\'autoattack pendant la Division');
  assert.equal(G.stats.avalanches, 1, 'l\'avalanche continue');
  for(const o of G.golems) o.hp = 0;
  run(G, DT * 2);
  assert.equal(G.boss.state, 'fight');
  assert.equal(G.boss.hp, G.boss.maxhp, 'il revient avec ses PV');
});

test('cristal à 66 % et 33 % : insensible aux coups, il se mine ; enrage après le 2e (attaque + 50 %, propulsion 65 %, avalanche − 25 %)', () => {
  const G = newGolbute(6, { miners: [{ name: 'Fort', account: 'A', carac: { damage: 1e6, mineSpeed: 0 } }] });
  G.next.split = Infinity; G.next.avalanche = Infinity;
  G.miners[0].x = 6;
  run(G, 2);
  const b = G.boss;
  assert.equal(b.state, 'crystal');
  assert.equal(b.hp, b.maxhp * 0.66, 'le surplus de dégâts est perdu');
  run(G, 5);
  assert.equal(b.hp, b.maxhp * 0.66, 'insensible aux coups');
  const slams = G.stats.slams;
  run(G, 3);
  assert.equal(G.stats.slams, slams, 'pas d\'autoattack pendant le cristal');
  /* minage : coups de minage à la vitesse du mineur */
  G.miners[0].carac.mineSpeed = 100; G.miners[0].carac.damage = 0;
  run(G, C.crystal.hp / 100 + 1);
  assert.equal(b.state, 'fight'); assert.equal(b.phase, 1); assert.equal(b.rage, false);
  G.miners[0].carac.damage = 1e6;
  run(G, 2);
  assert.equal(b.state, 'crystal'); assert.equal(b.hp, b.maxhp * 0.33);
  G.miners[0].carac.damage = 0;
  run(G, C.crystal.hp / 100 + 1);
  assert.equal(b.rage, true);
  assert.equal(slamChance(G, G.miners[0]), C.rage.chance);
  G.next.avalanche = G.t + 1;
  run(G, 2);
  assert.ok(Math.abs(G.next.avalanche - G.timeline.avalanches.at(-1) - C.avalanche.every * 0.75) < 1e-9);
});

test('victoire : PV à 0 ; temps écoulé : échec ; idempotent ; départ de tous : échec', () => {
  const G = newGolbute(7, { miners: [{ name: 'Fort', account: 'A', carac: { damage: 1e6, mineSpeed: 1e6 } }] });
  G.next.split = Infinity; G.next.avalanche = Infinity;
  G.miners[0].x = 6;
  run(G, 30);
  assert.ok(G.over); assert.equal(G.summary.success, true); assert.equal(G.boss.hp, 0);
  endGolbute(G, false);
  assert.equal(G.summary.success, true, 'idempotent');
  const H = newGolbute(7, { miners: idle(1) });
  H.next.avalanche = Infinity;
  run(H, INSTANCE.duration + 1);
  assert.ok(H.over); assert.equal(H.summary.success, false); assert.equal(H.ticks, GOLBUTE_TICKS);
  const L = newGolbute(7, { miners: idle(2) });
  assert.ok(leaveGolbute(L, 'A0')); assert.ok(!leaveGolbute(L, 'A0'));
  assert.ok(leaveGolbute(L, 'A1'));
  assert.ok(L.over); assert.equal(L.summary.success, false);
  assert.equal(L.summary.shares.length, 2); assert.ok(L.summary.shares.every(s => s.left));
});

test('IA : les mineurs vont au contact et frappent ; ils combattent les golems de la Division ; même seed = même partie', () => {
  const miners = [{ name: 'A', account: 'A', carac: { damage: 30 } }, { name: 'B', account: 'B', carac: { damage: 30 } }];
  const G = newGolbute(8, { miners });
  run(G, 20);
  assert.ok(G.stats.bossDmg > 0, 'le boss prend des coups');
  G.next.split = G.t + DT;
  run(G, 30);
  assert.ok(G.stats.kills > 0, 'Division : ils combattent les golems');
  const a = newGolbute(9, { miners }), b = newGolbute(9, { miners });
  run(a, 200); run(b, 200);
  assert.equal(a.boss.hp, b.boss.hp); assert.deepEqual(a.miners.map(m => [m.x, m.y, m.dazed]), b.miners.map(m => [m.x, m.y, m.dazed]));
});
