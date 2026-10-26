/* Bloc géant : simulation (src/sim/giant/session.js) et salle commune (src/shared/giant-room.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIANT, STATS, DT } from '../src/config.js';
import { newGiant, joinGiant, leaveGiant, tickGiant, runGiant, giantRate, VISIT_TICKS } from '../src/sim/giant/session.js';
import { newRoom, enterRoom, exitRoom, takeDone } from '../src/shared/giant-room.js';

const spec = (account, carac = {}, extra = {}) => ({ spec: { account, name: account, carac: { ...STATS, ...carac }, ...extra } });
const walkIn = (G) => (G.contact - G.spawn) / STATS.speed;          // secondes pour aller du spawn au bloc
const run = (G, seconds) => { for(let i = 0; i < Math.round(seconds / DT); i++) tickGiant(G); };

test('carte : 15 × 7, bloc 5 × 5 en bas à droite, on le frappe depuis la colonne 9 (ligne du bas)', () => {
  const G = newGiant(1);
  assert.deepEqual([G.w, G.h, G.bx, G.by, G.bw, G.contact, G.row, G.spawn], [15, 7, 10, 2, 5, 9, 6, 0]);
  assert.equal(VISIT_TICKS, GIANT.visit / DT);
});

test('visite solo sans stuff : il marche au bloc, frappe 3 min, sort ; points ≈ temps passé à miner, ≈ 10 % de coups qui repoussent', () => {
  const G = runGiant(7, [spec('A')]);
  assert.equal(G.done.length, 1); assert.equal(G.miners.length, 0);
  const v = G.done[0];
  assert.equal(v.why, 'end');
  assert.ok(Math.abs(v.points - v.mining) < 1e-6, 'vitesse 1 : un point par seconde de minage');
  assert.ok(v.points > 120 && v.points < GIANT.visit - walkIn(G), `points ${v.points}`);
  assert.equal(v.refills, 1, '360 d\'oxygène pour 300 de base : une recharge');
  assert.ok(v.knocks >= 5 && v.knocks <= 35, `reculs ${v.knocks} sur ${v.hits} coups`);
});

test('déterministe : même seed, mêmes visites → même résultat', () => {
  const a = runGiant(42, [spec('A'), spec('B', { mineSpeed: 1.3 })]).done, b = runGiant(42, [spec('A'), spec('B', { mineSpeed: 1.3 })]).done;
  assert.deepEqual(a, b);
});

test('vitesse de minage = points par seconde (pourcentage compris)', () => {
  const G = newGiant(1);
  const m = joinGiant(G, spec('A', { mineSpeed: 1.2, mineSpeedPct: 5 }).spec);
  assert.equal(giantRate(G, m), 1.2 * 1.05);
});

test('recul : ténacité 100 % → tous ignorés ; résistance 100 % → 1 case seulement', () => {
  const t = runGiant(3, [spec('A', { tenacity: 100, oxygenMax: 1e6 })]).done[0];
  assert.equal(t.knocks, 0); assert.ok(t.ignored > 5);
  assert.ok(Math.abs(t.points - (GIANT.visit - walkIn(newGiant(1)))) < 0.3, `sans recul : ${t.points}`);
  const G = newGiant(5);
  const m = joinGiant(G, spec('A', { knockRes: 100, oxygenMax: 1e6 }).spec);
  const seen = new Set();
  for(let i = 0; i < VISIT_TICKS - 1; i++){ tickGiant(G); if(m.fly) seen.add(m.fly.n); }
  assert.deepEqual([...seen], [1]);
});

test('recul : 1 à 3 cases vers la gauche, en arc, jamais hors de la carte', () => {
  const G = newGiant(9);
  const m = joinGiant(G, spec('A', { oxygenMax: 1e6 }).spec);
  const seen = new Set();
  for(let i = 0; i < VISIT_TICKS - 1; i++){
    tickGiant(G);
    if(m.fly){ seen.add(m.fly.n); assert.ok(m.fly.to <= m.fly.from && m.fly.to >= 0); }
    assert.ok(m.x >= 0 && m.x <= G.contact);
  }
  assert.ok([...seen].every(n => n >= 1 && n <= 3) && seen.size >= 2, [...seen].join(','));
});

test('oxygène : il baisse de 2/s, la fontaine recharge 30/s ; jamais à court au bloc', () => {
  const G = newGiant(11);
  const m = joinGiant(G, spec('A', { tenacity: 100 }).spec);   // sans recul : il doit aller exprès à la fontaine (un recul l'y pose souvent)
  let minOx = Infinity;
  for(let i = 0; i < VISIT_TICKS - 1; i++){ tickGiant(G); if(m.status === 'Frappe le bloc géant') minOx = Math.min(minOx, m.ox); }
  assert.ok(minOx > 0, `oxygène au bloc : ${minOx}`);
  assert.equal(m.stats.refills, 1, '360 d\'oxygène pour 300 de base : une recharge');
  const big = runGiant(11, [spec('B', { oxygenMax: 1000 })]).done[0];
  assert.equal(big.refills, 0, 'assez d\'oxygène pour 3 min : pas de fontaine');
});

test('sorts : Dynamite = +1 point par lancer (2 par visite), Inspiration pour tous les présents, Fast learner +10 %', () => {
  const big = { oxygenMax: 1e6, tenacity: 100 };
  const base = runGiant(1, [spec('A', big)]).done[0].points;
  const dyn = runGiant(1, [spec('A', big, { spells: ['dynamite'] })]).done[0];
  assert.equal(dyn.dynamites, 2); assert.ok(Math.abs(dyn.points - base - 2) < 1e-6);
  const G = runGiant(1, [spec('A', big), spec('L', big, { spells: ['inspiration'], skillTree: 'logisticien' })]);
  const a = G.done.find(d => d.account === 'A');
  assert.ok(Math.abs(a.points - (base + 60 * 0.10)) < 0.2, `Inspiration 60 s à +10 % : ${a.points} contre ${base}`);
  const fl = runGiant(1, [spec('A', big, { spells: ['fast_learner'] })]).done[0];
  assert.ok(Math.abs(fl.points - base * 1.1) < 0.2, `Fast learner : ${fl.points}`);
  const dash = runGiant(1, [spec('A', big, { spells: ['dash', 'illumination', 'ulti_shen'] })]).done[0];
  assert.ok(Math.abs(dash.points - base) < 1e-6, 'Dash, Illumination, Ulti shen : sans effet');
});

test('arrivées et départs en cours de partie : visites indépendantes, départ anticipé noté', () => {
  const G = newGiant(2);
  joinGiant(G, spec('A').spec);
  run(G, 60);
  joinGiant(G, spec('B').spec);
  run(G, 30);
  assert.ok(leaveGiant(G, 'B'));
  assert.equal(G.done[0].account, 'B'); assert.equal(G.done[0].why, 'left');
  assert.ok(G.done[0].points > 0 && G.done[0].points < 30);
  assert.ok(!leaveGiant(G, 'B'), 'déjà sorti');
  run(G, GIANT.visit);
  assert.equal(G.done[1].account, 'A'); assert.equal(G.done[1].why, 'end');
});

test('visite reprise (redémarrage) : temps restant et points déjà faits', () => {
  const G = newGiant(4);
  joinGiant(G, spec('A', { oxygenMax: 1e6 }).spec, { ticks: 100, points: 50 });
  run(G, 20);
  const v = G.done[0];
  assert.ok(v.points > 50 && v.points < 50 + 10, `${v.points}`);
});

test('30 mineurs en même temps : tous au bloc, superposés, aucun bloqué', () => {
  const visits = Array.from({ length: GIANT.maxPlayers }, (_, i) => ({ ...spec('P' + i), at: i * 0.5 }));
  const G = runGiant(8, visits);
  assert.equal(G.done.length, 30);
  for(const v of G.done) assert.ok(v.points > 100, `${v.account} : ${v.points}`);
});

test('salle : les anneaux comptent pour tous les présents, recalculés à chaque arrivée et départ', () => {
  const G = newRoom(1);
  const b = enterRoom(G, { account: 'B', name: 'B', gear: {} });
  assert.equal(b.carac.mineSpeedPct, 0);
  enterRoom(G, { account: 'A', name: 'A', gear: { anneau1: { item: 'Anneau du rat', uid: 1 } } });
  assert.equal(b.carac.mineSpeedPct, 3, 'l\'anneau du rat de A profite à B');
  assert.equal(enterRoom(G, { account: 'A', name: 'A' }), null, 'déjà dedans');
  assert.ok(exitRoom(G, 'A'));
  assert.equal(b.carac.mineSpeedPct, 0, 'A parti : plus d\'anneau');
  assert.deepEqual(takeDone(G).map(d => d.account), ['A']);
  assert.equal(G.entries.has('A'), false);
});
