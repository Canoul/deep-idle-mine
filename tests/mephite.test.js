/* Méphite (24/10/2026, Geoffrey) : mob volant à partir de l'area 3, asphyxie (−5 d'oxygène toutes les 2 s tant qu'il
   tacle, non cumulable, Ténacité par pulse), butin Vésicule de gaz. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, XP, ITEMS, mobHp } from '../src/config.js';
import { tackler } from '../src/sim/ai.js';
import { killMob } from '../src/sim/actions.js';
import { trapTable } from '../src/sim/trap.js';
import { worldFrom, run } from './helpers.js';

const corridor = () => worldFrom(['', 'd'.repeat(50), '#@' + ' '.repeat(40) + '#', '#'.repeat(50)]);
const mob = (G, o) => { const x = { id: G.mobId++, hp: 1e9, maxhp: 1e9, cd: 0, ...o }; G.mobs.push(x); return x; };
const busy = m => { m.action = { type: 'wait', dur: 1e9, t: 0, data: {} }; };
const sum = row => Object.values(row).reduce((s, v) => s + v, 0);

test('apparition : 5 % en area 3, 15 % en area 4, 20 % en area 5 et au-delà, pris sur le gobelin ; PV 70 en area 3, +15 % par area', () => {
  const T = MOBS.spawnTable;
  assert.deepEqual(T[3], { bestiole:0.2, gobelin:0.55, mephite:0.05, mimic:0.2 });
  assert.deepEqual(T[4], { gobelin:0.55, occultiste:0.1, mephite:0.15, mimic:0.2 });
  assert.deepEqual(T[5], { gobelin:0.2, occultiste:0.3, mephite:0.2, mimic:0.2, golem:0.1 });
  for(const row of T) assert.ok(Math.abs(sum(row) - 1) < 1e-9, JSON.stringify(row));
  assert.ok(!('mephite' in T[2]), 'pas avant l\'area 3');
  assert.equal(MOBS.minArea.mephite, 3);
  assert.equal(mobHp('mephite', 3), 70); assert.equal(mobHp('mephite', 4), 81); assert.equal(mobHp('mephite', 5), 93);
});

/* un puits vertical sans échelle : le mineur en haut à gauche, le mob en bas du puits (6 cases plus bas) */
const shaft = () => worldFrom(['', 'd'.repeat(50), '#@   #', '####  #', '#### #', '#### #', '#### #', '#### #', '####  #', '#'.repeat(50)]);

test('vol : il monte un puits sans échelle et rejoint le mineur (une bestiole reste coincée en bas)', () => {
  const G = shaft(), m = G.miners[0]; busy(m); m.ox = 1e6;
  const o = mob(G, { type: 'mephite', x: 4, y: 8 });
  run(G, 150);
  assert.equal(tackler(G, m), o, 'il vole jusqu\'au mineur et le tacle');
  const H = shaft(), n = H.miners[0]; busy(n); n.ox = 1e6;
  const b = mob(H, { type: 'bestiole', x: 4, y: 8 });
  run(H, 150);
  assert.equal(tackler(H, n), null, 'la bestiole ne grimpe pas sans échelle');
  assert.equal(b.y, 8);
});

test('vol : en l\'air, il ne tombe pas', () => {
  const G = shaft(), m = G.miners[0]; busy(m);
  m.x = 45;   // hors de portée de poursuite (le mineur ne sert qu'à être sous terre)
  const o = mob(G, { type: 'mephite', x: 4, y: 4 });
  run(G, 50);
  assert.equal(o.y, 4, 'il flotte');
});

test('asphyxie : −5 d\'oxygène toutes les 2 s tant qu\'il tacle (en plus de la respiration)', () => {
  const ref = corridor(), r = ref.miners[0]; busy(r); r.ox = 300;
  run(ref, 41);
  const G = corridor(), m = G.miners[0]; busy(m); m.ox = 300;
  const o = mob(G, { type: 'mephite', x: m.x + 1, y: m.y });
  run(G, 41);
  assert.equal(tackler(G, m), o);
  assert.ok(Math.abs((r.ox - m.ox) - 2 * MOBS.mephite.oxygen) < 1e-9, `${r.ox - m.ox} d'oxygène en plus en 4,1 s`);
  assert.equal(MOBS.mephite.every, 2); assert.equal(MOBS.mephite.oxygen, 5);
});

test('asphyxie : non cumulable entre plusieurs Méphites', () => {
  const ref = corridor(), r = ref.miners[0]; busy(r); r.ox = 300;
  run(ref, 41);
  const G = corridor(), m = G.miners[0]; busy(m); m.ox = 300; m.x = 5;
  mob(G, { type: 'mephite', x: 4, y: m.y }); mob(G, { type: 'mephite', x: 6, y: m.y });
  run(G, 41);
  assert.equal(G.mobs.filter(o => o.grab === m.id).length, 2, 'les deux le taclent');
  assert.ok(Math.abs((r.ox - m.ox) - 2 * MOBS.mephite.oxygen) < 1e-9, 'toujours −5 toutes les 2 s');
});

test('asphyxie : chaque pulse est ignorable par la Ténacité ; l\'oxygène ne passe pas sous 0', () => {
  const ref = corridor(), r = ref.miners[0]; busy(r); r.ox = 300;
  run(ref, 41);
  const G = corridor(), m = G.miners[0]; busy(m); m.ox = 300; m.carac.tenacity = 100;
  mob(G, { type: 'mephite', x: m.x + 1, y: m.y });
  run(G, 41);
  assert.ok(Math.abs(r.ox - m.ox) < 1e-9, 'tout résisté');
  assert.equal(m.stats.resisted, 2);
  const H = corridor(), n = H.miners[0]; busy(n); n.ox = 3;
  mob(H, { type: 'mephite', x: n.x + 1, y: n.y });
  run(H, 25);
  assert.equal(n.ox, 0);
});

test('butin : 1 à 2 Vésicules de gaz (matériau), XP du méphite', () => {
  assert.equal(ITEMS['Vésicule de gaz'].cat, 'material');
  assert.equal(MOBS.mephite.item, 'Vésicule de gaz');
  const seen = new Set();
  for(let s = 1; s <= 30; s++){
    const G = corridor(), m = G.miners[0];
    const o = mob(G, { type: 'mephite', x: m.x + 1, y: m.y, hp: 1 });
    G.rng = (r => () => r)((s % 10) / 10);
    killMob(G, m, o);
    seen.add(m.inv['Vésicule de gaz']);
  }
  assert.deepEqual([...seen].sort(), [1, 2]);
  assert.ok(XP.mob.mephite > XP.mob.bestiole);
});

test('pièges : le méphite peut en sortir à partir de l\'area 3', () => {
  assert.ok('mephite' in trapTable(3));
  assert.ok(!('mephite' in trapTable(2)));
});
