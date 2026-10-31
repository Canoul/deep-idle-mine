/* Chien de magma et Vers de terre (areas 7+, 31/10/2026, Geoffrey) ; état Bleed. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, XP, ITEMS, DT, MOB_INFO, mobHp, W, IDS } from '../src/config.js';
import { addBleed, tickBleed, bleedSlow } from '../src/sim/bleed.js';
import { moveT, climbT, mineRate } from '../src/sim/mineur.js';
import { updateMobs, pickType } from '../src/sim/mobs.js';
import { addWorm, updateWorms, updateStuck, release } from '../src/sim/worm.js';
import { landHit } from '../src/sim/actions.js';
import { minerEffects } from '../src/sim/effects.js';
import { newSession, tick } from '../src/sim/session.js';
import { worldFrom } from './helpers.js';

test('config : PV, areas, XP, butins, tables des areas 7 et 8 (pris au mimic et à l\'occultiste)', () => {
  assert.equal(MOBS.hpBase.chien, 200); assert.equal(MOBS.hpBase.ver, 300);
  assert.equal(MOBS.minArea.chien, 7); assert.equal(MOBS.minArea.ver, 7);
  assert.equal(XP.mob.chien, 40); assert.equal(XP.mob.ver, 40);
  assert.equal(ITEMS['Peau de chien de magma'].cat, 'material'); assert.equal(ITEMS['Chair de vers'].cat, 'material');
  assert.ok(MOB_INFO.chien && MOB_INFO.ver);
  const row = k => MOBS.spawnTable[k];
  assert.deepEqual([row(7).chien, row(7).ver, row(7).mimic, row(7).occultiste], [0.05, 0.05, 0.15, 0.25]);
  assert.deepEqual([row(8).chien, row(8).ver, row(8).mimic, row(8).occultiste], [0.08, 0.08, 0.12, 0.22]);
  for(const k of [7, 8]) assert.ok(Math.abs(Object.values(row(k)).reduce((a, b) => a + b, 0) - 1) < 1e-9, `area ${k}`);
  assert.equal(row(6).chien, undefined); assert.equal(row(6).ver, undefined);
  assert.ok(MOBS.noTrap.includes('ver'));
  assert.equal(pickType({ chien: 1 }, 0.5), 'chien');
});

test('bleed : -10 % par stack sur déplacement et minage, 5 stacks au plus, 60 s après le dernier', () => {
  const G = newSession(1), m = G.miners[0];
  const [w, c, r] = [moveT(G, m), climbT(G, m), mineRate(m)];
  addBleed(G, m);
  assert.equal(bleedSlow(m), 0.9);
  assert.ok(Math.abs(moveT(G, m) - w / 0.9) < 1e-9); assert.ok(Math.abs(climbT(G, m) - c / 0.9) < 1e-9);
  assert.ok(Math.abs(mineRate(m) - r * 0.9) < 1e-9);
  assert.equal(minerEffects(G, m).find(e => e.id === 'bleed').stacks, 1);
  for(let i = 0; i < 9; i++) addBleed(G, m);
  assert.equal(m.bleed, 5); assert.equal(bleedSlow(m), 0.5);
  G.t += 59; tickBleed(G); assert.equal(m.bleed, 5);
  addBleed(G, m);                      // un nouveau stack : les 60 s repartent
  G.t += 59; tickBleed(G); assert.equal(m.bleed, 5);
  G.t += 2; tickBleed(G); assert.equal(m.bleed, 0);
  assert.equal(bleedSlow(m), 1);
});

const room = () => worldFrom(['', ' ', '  @          ', '#############'.padEnd(W, '#')]);

test('chien : un stack toutes les 3 s de tacle ; ténacité 100 % : aucun', () => {
  for(const [ten, want] of [[0, 3], [100, 0]]){
    const G = room(), m = G.miners[0];
    m.carac.tenacity = ten;
    G.mobs = [{ id: 1, type: 'chien', x: m.x + 1, y: m.y, hp: 1e6, maxhp: 1e6, cd: 1 }];
    G.spawnTimer = 1e9;
    for(let t = 0; t < 9.05; t += DT){ G.t += DT; updateMobs(G); }
    assert.equal(m.stats.bled || 0, want, `ténacité ${ten}`);
  }
});

/* un mineur dans une galerie de la ligne 8, le reste en roche */
const rock = () => {
  const G = worldFrom(['', ...Array.from({ length: 30 }, (_, y) => y === 7 ? '@'.padStart(13, ' ') + ' '.repeat(5) : '')]);
  G.spawnTimer = 1e9;
  return { G, m: G.miners[0] };
};
const spin = (G, s) => { for(let t = 0; t < s - 1e-9; t += DT){ G.t += DT; updateWorms(G, () => false); } };

test('ver : inciblable en navigation (hors de G.mobs), il charge à 10 s, stun 3 s et bleed sur le mineur traversé', () => {
  const { G, m } = rock();
  addWorm(G, 9, m.x, m.y + 6, 300);
  assert.ok(!G.mobs.some(o => o.type === 'ver'));
  G.rng = () => 0.99;   // jamais coincé
  spin(G, 9.5);
  assert.equal(m.bleed || 0, 0, 'pas avant 10 s');
  spin(G, 2);
  assert.equal(m.bleed, 1); assert.ok(Math.abs(m.wormUntil - G.t) <= 3 + 1e-9 && m.wormUntil > G.t);
  assert.equal(G.tiles[m.y + 3][m.x], IDS.stone, 'il ne casse pas les blocs');
  assert.ok(G.worms[0].trail.length > 0 && G.worms[0].trail.length <= MOBS.ver.len - 1);
  const stacks = m.bleed; spin(G, 9.5);
  assert.equal(m.bleed, stacks + 1, 'recharge 10 s après');
  assert.ok(!G.mobs.some(o => o.type === 'ver'));
});

test('ver : la ténacité tire le stun et le bleed séparément', () => {
  const { G, m } = rock();
  addWorm(G, 9, m.x, m.y + 4, 300); G.worms[0].cd = 0;
  G.rng = () => 0.99;
  const draws = [true, false];   // résiste au stun, pas au bleed
  for(let t = 0; t < 2; t += DT){ G.t += DT; updateWorms(G, () => draws.shift() ?? true); }
  assert.equal(m.wormUntil, undefined); assert.equal(m.bleed, 1);
});

test('ver : 30 % de se coincer, dans G.mobs sur un bloc qui touche le vide, frappable, puis il replonge avec ses PV', () => {
  const { G, m } = rock();
  addWorm(G, 9, m.x, m.y + 4, 300); G.worms[0].cd = 0;
  G.rng = () => 0.1;
  spin(G, 3);
  assert.equal(G.worms.length, 0);
  const o = G.mobs.find(x => x.type === 'ver');
  assert.ok(o, 'coincé');
  assert.notEqual(G.tiles[o.y][o.x], 0, 'sur un bloc');
  assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => G.tiles[o.y + dy]?.[o.x + dx] === 0), 'qui touche le vide');
  assert.equal(o.left, MOBS.ver.stuckFor);
  o.hp = 120; o.left = 0.05;
  assert.equal(updateStuck(o), true);
  G.mobs = []; release(G, o);
  assert.equal(G.worms[0].hp, 120);
  assert.equal(G.worms[0].maxhp, 300);
});

test('ver coincé dans la session : updateMobs le fait replonger après 10 s', () => {
  const { G } = rock();
  G.mobs = [{ id: 3, type: 'ver', x: 5, y: 12, hp: 200, maxhp: 300, cd: 5, left: 10, knockRes: 100 }];
  for(let t = 0; t < 9.5; t += DT){ G.t += DT; updateMobs(G); }
  assert.equal(G.mobs.length, 1);
  for(let t = 0; t < 0.7; t += DT){ G.t += DT; updateMobs(G); }
  assert.equal(G.mobs.length, 0); assert.equal(G.worms.length, 1); assert.equal(G.worms[0].hp, 200);
});

test('ver : plus aucun mineur à portée de suivi, il disparaît ; la session tourne avec un ver', () => {
  const { G, m } = rock();
  addWorm(G, 9, Math.min(W - 1, m.x + MOBS.ver.leash), 28, 300);
  m.y = 1; spin(G, 0.2);
  assert.equal(G.worms.length, 0);
  const S = newSession(4);
  addWorm(S, 77, 10, 12, 300);
  for(let i = 0; i < 300; i++) tick(S);
  assert.ok(Array.isArray(S.worms));
});

test('vaincus : butin de 1 à 3, XP de la table', () => {
  for(const [type, item] of [['chien', 'Peau de chien de magma'], ['ver', 'Chair de vers']]){
    for(let i = 0; i < 12; i++){
      const G = room(), m = G.miners[0];
      G.mobs = [{ id: 1, type, x: m.x + 1, y: m.y, hp: 1, maxhp: 200, cd: 1 }];
      m.carac.damage = 1e4;
      landHit(G, m, G.mobs[0]);
      const n = m.inv[item] ?? G.chest[item] ?? 0;
      assert.ok(n >= 1, `${item} : ${n}`);
      assert.ok(n <= 3 + 3, `${item} : ${n}`);
      assert.equal(G.mobs.length, 0);
    }
  }
  assert.equal(mobHp('ver', 7), 300); assert.equal(mobHp('chien', 8), Math.round(200 * 1.15));
});
