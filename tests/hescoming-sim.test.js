/* He's coming : la salle de Lucifer (src/sim/hescoming/session.js). Mêmes visites que le Bloc géant, mais on frappe, et le boss répond. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HES_COMING as HC, GIANT, STATS, DT, CFG } from '../src/config.js';
import { newLucifer, joinLucifer, tickLucifer, standX, luciferDps } from '../src/sim/hescoming/session.js';
import { minerEffects } from '../src/sim/effects.js';

const spec = (carac = {}) => ({ account:'A', name:'A', carac:{ ...STATS, damage:20, oxygenMax:1e6, ...carac } });
const room = (carac, seed = 1) => { const G = newLucifer(seed), m = joinLucifer(G, spec(carac)); return { G, m }; };
const run = (G, s) => { for(let i = 0, n = Math.round(s / DT); i < n; i++) tickLucifer(G); };
/* mineur posé à sa place, combat engagé */
const ready = (carac, seed) => { const r = room(carac, seed); r.m.x = standX(r.G, r.m); return r; };

test('config : paliers du Bloc × 25, pépites ÷ 25, mêmes objets, même durée', () => {
  assert.deepEqual(HC.tiers.map(t => t.min), [25000, 125000, 250000, 375000, 500000]);
  assert.deepEqual(HC.tiers.map(t => t.items), GIANT.tiers.map(t => t.items));
  assert.equal(HC.nugget.per, 2500);
  assert.equal(HC.visit, GIANT.visit); assert.equal(HC.cooldownMs, GIANT.cooldownMs);
});

test('il marche jusqu\'à Lucifer puis frappe : 1 dégât = 1 point', () => {
  const { G, m } = room();
  run(G, 8);
  assert.equal(m.x, G.contact);
  assert.ok(m.points > 0);
  assert.equal(m.points, m.stats.hits * 20);
});

test('rythme : un coup tous les attackInterval à 100 % de vitesse d\'attaque, 200 % deux fois plus', () => {
  const a = ready(), b = ready({ attackSpeed:200 });
  run(a.G, 4); run(b.G, 4);
  assert.equal(a.m.stats.hits, Math.floor(4 / CFG.attackInterval));
  assert.ok(Math.abs(b.m.stats.hits - 2 * a.m.stats.hits) <= 1);
});

test('dps affiché : dégâts × vitesse', () => {
  const { G, m } = ready({ damage:20, attackSpeed:100 });
  assert.ok(Math.abs(luciferDps(G, m) - 20 / CFG.attackInterval) < 1e-9);
});

test('chaque coup coûte de l\'oxygène, la fontaine reste le recours', () => {
  const { G, m } = room({ oxygenMax:100 });
  m.ox = 100;
  run(G, 60);
  assert.ok(m.stats.refills >= 1);
});

test('la portée compte : il reste plus loin', () => {
  const { G, m } = room({ reach:2 });
  assert.equal(standX(G, m), G.contact - 2);
  run(G, 8);
  assert.equal(m.x, G.contact - 2);
  assert.ok(m.points > 0);
});

test('rugissement à 30 s : Fear de 15 s dans un rayon de 3, aura visible', () => {
  const { G, m } = ready({ attackSpeed:1 });
  run(G, HC.roar.every - 1);
  assert.ok(!(m.fearUntil > G.t));
  run(G, 1.1);
  assert.ok(m.fearUntil > G.t);
  assert.ok(Math.abs(m.fearUntil - (HC.roar.every + HC.roar.fear)) < 0.2);
  assert.ok(G.roarAt >= HC.roar.every - 1e-6);
  assert.equal(minerEffects(G, m).find(e => e.id === 'fear')?.id, 'fear');
});

test('Fear : il erre, ne frappe plus, ne marque plus', () => {
  const { G, m } = ready();
  run(G, HC.roar.every + HC.swing.flight + 0.2);
  const pts = m.points, x = new Set();
  assert.equal(m.status, 'Fear');
  for(let i = 0; i < 100; i++){ tickLucifer(G); x.add(m.x); }
  assert.equal(m.points, pts);
  assert.ok(x.size > 5, 'il bouge');
  for(const v of x) assert.ok(v >= 0 && v <= G.contact);
});

test('Fear fini : il revient frapper', () => {
  const { G, m } = ready();
  run(G, HC.roar.every + HC.roar.fear + 5);
  const pts = m.points;
  run(G, 4);
  assert.ok(m.points > pts);
});

test('hors du rayon de 3 : pas de Fear', () => {
  const { G, m } = ready({ reach:4 });
  run(G, HC.roar.every + 1);
  assert.ok(!(m.fearUntil > G.t));
});

test('juste dans le rayon : portée 3 touchée', () => {
  const { G, m } = ready({ reach:3 - 0.5 + 0.5 });
  run(G, HC.roar.every + 1);
  assert.ok(m.fearUntil > G.t);
});

test('ténacité 100 % : ignore le Fear et le recul', () => {
  const { G, m } = ready({ tenacity:100 });
  run(G, HC.roar.every + 1);
  assert.ok(!(m.fearUntil > G.t));
  assert.equal(m.stats.knocks, 0);
  assert.ok(m.stats.ignored >= 2);
});

test('un Fear en cours n\'est pas prolongé', () => {
  const { G, m } = ready();
  run(G, HC.roar.every + 0.5);
  m.fearUntil = G.t + 100;
  const until = m.fearUntil;
  G.nextRoar = G.t;
  run(G, 0.2);
  assert.equal(m.fearUntil, until);
});

test('autoattaque à 5 s : 4 cases en arc de 2 de haut, au contact', () => {
  const { G, m } = ready();
  const x = m.x;
  run(G, HC.swing.every + DT);
  assert.ok(m.fly);
  assert.equal(m.fly.to, x - HC.swing.knock);
  assert.equal(m.fly.high, 2);
  assert.equal(m.stats.knocks, 1);
});

test('autoattaque : la portée de base seulement, un mineur à distance n\'est pas touché', () => {
  const { G, m } = ready({ reach:1 });
  run(G, HC.swing.every + DT);
  assert.equal(m.stats.knocks, 0);
});

test('autoattaque : tous les mineurs au contact', () => {
  const G = newLucifer(1), a = joinLucifer(G, spec()), b = joinLucifer(G, { ...spec(), account:'B' });
  a.x = b.x = G.contact;
  run(G, HC.swing.every + DT);
  assert.ok(a.fly && b.fly);
});

test('résistance au recul : distance réduite, 1 case au moins', () => {
  const half = ready({ knockRes:50 }), all = ready({ knockRes:100 });
  run(half.G, HC.swing.every + DT); run(all.G, HC.swing.every + DT);
  assert.equal(half.m.fly.n, 2);
  assert.equal(all.m.fly.n, 1);
});

test('recul : il ne sort jamais de la salle', () => {
  const { G, m } = ready();
  m.x = G.contact; m.fly = null;
  G.contact = 2; m.x = 2;
  run(G, HC.swing.every + DT);
  assert.ok(m.fly.to >= 0);
});

test('déterministe : même seed, mêmes points', () => {
  const a = ready({ crit:30, doubleAttack:30, tenacity:20 }, 7), b = ready({ crit:30, doubleAttack:30, tenacity:20 }, 7);
  run(a.G, 120); run(b.G, 120);
  assert.equal(a.m.points, b.m.points);
});

test('critiques et double attaque comptent', () => {
  const plain = ready({}, 3), good = ready({ crit:50, doubleAttack:50 }, 3);
  run(plain.G, 25); run(good.G, 25);
  assert.ok(good.m.points > plain.m.points * 1.5);
});

test('fin de visite : la visite part dans G.done', () => {
  const { G, m } = ready();
  run(G, HC.visit + 1);
  assert.equal(G.miners.length, 0);
  assert.equal(G.done[0].account, 'A');
  assert.equal(G.done[0].points, m.points);
});

test('Inspiration : tout le monde frappe plus vite', () => {
  const G = newLucifer(1), a = joinLucifer(G, { ...spec(), spells:['inspiration'] }), b = joinLucifer(G, { ...spec(), account:'B' });
  a.x = b.x = G.contact;
  run(G, 3);
  assert.ok(G.inspire);
  assert.ok(luciferDps(G, b) > 20 / CFG.attackInterval);
});
