/* Instance I (src/sim/instance/) : la salle, les spawners, les gobelins, l'IA des mineurs ; le roi gobelin et la fin. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTANCE, STATS, DT } from '../src/config.js';
import { newInstance, tickInstance, runInstance, instSupported, tackler, INSTANCE_TICKS, leaveInstance, pushMiner } from '../src/sim/instance/session.js';
import { genInstance, ledgesOf, platformOf, ROCK, SPAWNER, CAGE, AIR } from '../src/sim/instance/world.js';

const spec = (i, carac = {}, extra = {}) => ({ name: 'M' + i, account: 'a' + i, carac: { ...STATS, ...carac }, ...extra });
const STRONG = { mineSpeed: 1.4, damage: 14, attackSpeed: 120 };
/* très fort : pour vérifier la mécanique du roi sans dépendre de l'équilibrage (temps, PV) */
const HUGE = { mineSpeed: 3, damage: 30, attackSpeed: 150 };
const run = (G, s) => { for(let i = 0; i < Math.round(s / DT) && !G.over; i++) tickInstance(G); };
const goblin = (G, x, y, extra = {}) => { const o = { id: G.nextGob++, x, y, kx: 0, hp: INSTANCE.goblin.hp, maxhp: INSTANCE.goblin.hp, grab: null,
  grabHit: null, taunt: null, hit: INSTANCE.goblin.hitEvery, moveCd: INSTANCE.goblin.step, fall: 0, stunUntil: null, ...extra }; G.goblins.push(o); return o; };
/* salle sans spawner (ils ne gênent pas un test de combat) */
const quiet = G => { for(const s of G.spawners){ s.alive = false; G.tiles[s.y][s.x] = AIR; } G.boss.state = 'test'; };

test('salle : 28 × 24, 3 rebords de 6 par côté (5 cases d\'air entre deux), un spawner collé au mur sur chacun, plateforme du roi plus haute', () => {
  const L = genInstance();
  assert.equal(L.w, 28); assert.equal(L.h, 24); assert.ok(L.tiles[24].every(t => t === ROCK), 'sol');
  const ledges = ledgesOf();
  assert.equal(ledges.length, 6);
  assert.deepEqual([...new Set(ledges.map(l => l.row))], [18, 12, 6], '6, 12 et 18 au-dessus du sol : 5 cases d\'air entre deux');
  for(const l of ledges){
    for(let x = l.x0; x <= l.x1; x++) assert.equal(L.tiles[l.row][x], ROCK);
    assert.equal(l.x1 - l.x0 + 1, 6);
    assert.equal(L.tiles[l.y][l.sx], SPAWNER);
    assert.ok(l.sx === 0 || l.sx === L.w - 1, 'collé au mur');
    assert.equal(Math.abs(l.mx - l.sx), 1, 'on le casse depuis la case d\'à côté');
  }
  const p = platformOf();
  assert.equal(L.h - p.row, 21); assert.equal(p.x1 - p.x0 + 1, 4);
  assert.ok(p.row < Math.min(...ledges.map(l => l.row)), 'plus haute que les rebords');
});

test('spawners : un gobelin chacun dès le début, puis un toutes les 30 s', () => {
  const G = newInstance(1, { miners: [] }), n = G.spawners.length;
  tickInstance(G);
  assert.equal(G.goblins.length, n);
  run(G, 30);
  assert.equal(G.stats.spawned, 2 * n);
  run(G, 30);
  assert.equal(G.stats.spawned, 3 * n);
});

test('casser un spawner : INSTANCE.spawner.hp « coups de pioche » à la vitesse de minage ; la Dynamite en vaut 6', () => {
  const HP = INSTANCE.spawner.hp;
  const at = (carac, extra) => { const G = newInstance(1, { miners: [spec(0, { ...carac, tenacity: 0 }, extra)] }); const s = G.spawners[0], m = G.miners[0];
    m.x = s.mx; m.y = s.y; G.target = s.id; G.goblins = []; for(const q of G.spawners) q.cd = 1e9; return { G, s, m }; };
  let { G, s } = at({ mineSpeed: 2 });
  run(G, 10);
  assert.ok(Math.abs(s.hp - (HP - 2 * 10)) < 0.6, `${s.hp}`);
  run(G, HP / 2 - 10 + 1);
  assert.equal(s.alive, false); assert.equal(G.tiles[s.y][s.x], AIR, 'cassé : la case se vide');
  ({ G, s } = at({ mineSpeed: 1 }, { spells: ['dynamite'] }));
  run(G, 2);
  assert.ok(Math.abs(s.hp - (HP - INSTANCE.spawner.dynamite - 2)) < 0.6, `Dynamite : ${s.hp}`);
});

test('gobelin : 150 PV, le premier coup tacle, recul de 0,5 vers le centre à chaque coup (27/10 ; avant 30 %)', () => {
  assert.equal(INSTANCE.goblin.hp, 150);
  const G = newInstance(3, { miners: [spec(0, { damage: 0.001, knockRes: 0 })] });
  quiet(G);
  const m = G.miners[0]; m.x = 4; m.y = G.floorY;
  const o = goblin(G, 3, G.floorY);
  run(G, 1.9);
  assert.equal(tackler(G, m), null, 'pas encore frappé (un coup toutes les 2 s)');
  for(let i = 0; i < 300 && !o.hits; i++) run(G, DT);
  assert.equal(o.hits, 1);
  assert.equal(tackler(G, m), o, 'premier coup : taclé');
  run(G, 600);
  const r = G.stats.gobKnocks / G.stats.gobHits;
  assert.equal(INSTANCE.goblin.knockChance, 1);
  assert.ok(G.stats.gobHits > 100 && r > 0.95, `${G.stats.gobKnocks} reculs sur ${G.stats.gobHits} coups`);
});

test('recul : toujours vers le centre de la salle, des deux côtés', () => {
  const G = newInstance(3, { miners: [spec(0), spec(1)] });
  quiet(G);
  const [a, b] = G.miners;
  a.x = 3; a.y = G.floorY; b.x = 16; b.y = G.floorY;
  for(let i = 0; i < 2; i++){ pushMiner(G, a, 0.5); pushMiner(G, b, 0.5); }
  assert.equal(a.x + a.kx, 4, 'à gauche : poussé vers la droite');
  assert.equal(b.x + b.kx, 15, 'à droite : poussé vers la gauche');
});

test('gobelins : la provocation, puis le mineur qui casse un spawner à 10 cases, puis le plus proche', () => {
  const G = newInstance(4, { miners: [spec(0), spec(1), spec(2)] });
  quiet(G);
  const [a, b, c] = G.miners;
  a.x = 8; a.y = G.floorY; b.x = 2; b.y = G.floorY; c.x = 18; c.y = G.floorY;
  const o = goblin(G, 9, G.floorY, { moveCd: 0 });
  const prey = () => { run(G, DT); return G.goblins[0]; };
  b.action = { type: 'drill', dur: 99, t: 0, data: { sp: 0, x: 0, y: 0 } };
  const before = o.x; prey();
  assert.ok(o.x < before, 'il va vers celui qui casse un spawner (à 7 cases) plutôt que le plus proche');
  o.taunt = c.id; o.moveCd = 0; const b2 = o.x; prey();
  assert.ok(o.x > b2, 'provoqué : il va vers son barbare');
});

test('gobelins : ils tombent des rebords et montent aux échelles', () => {
  const G = newInstance(5, { miners: [spec(0)] });
  quiet(G);
  const m = G.miners[0]; m.x = 8; m.y = G.floorY; m.action = { type: 'wait', dur: 1e9, t: 0, data: {} };
  const l = G.ledges[0], o = goblin(G, l.mx, l.y);
  run(G, 20);
  assert.equal(o.y, G.floorY, 'descendu au sol'); assert.ok(Math.abs(o.x - m.x) <= 1);
  const G2 = newInstance(5, { miners: [spec(0, { knockRes: 100 })] });   // ne tombe pas du rebord sous les coups
  quiet(G2);
  const m2 = G2.miners[0], l2 = G2.ledges[0]; m2.x = 3; m2.y = l2.y; m2.action = { type: 'wait', dur: 1e9, t: 0, data: {} };
  for(let y = l2.y; y <= G2.floorY; y++) G2.ladder[y][6] = 1;
  const o2 = goblin(G2, 9, G2.floorY);
  run(G2, 30);
  assert.equal(o2.y, l2.y, 'monté sur le rebord par l\'échelle'); assert.ok(Math.abs(o2.x - m2.x) <= 1);
});

test('IA : un groupe fort casse tous les spawners, sans jamais rester bloqué', () => {
  const G = newInstance(11, { miners: [0, 1, 2].map(i => spec(i, HUGE)) });
  run(G, 25 * 60);
  assert.equal(G.spawners.filter(s => s.alive).length, 0, `spawners restants`);
  assert.equal(G.stats.blocked, 0);
  assert.ok(G.stats.ladders > 0);
});

test('roi : il dort tant qu\'il reste un spawner ; puis descend, enferme à chaque seuil, enrage, et meurt', () => {
  const G = newInstance(7, { miners: [0, 1, 2].map(i => spec(i, HUGE)) });
  run(G, 60);
  assert.equal(G.boss.state, 'sleep'); assert.equal(G.boss.hp, G.boss.maxhp);
  run(G, INSTANCE.duration);
  assert.ok(G.over); assert.equal(G.summary.success, true);
  assert.equal(G.summary.spawners, G.spawners.length);
  assert.equal(G.timeline.cages.length, INSTANCE.boss.cageAt.length, 'un enfermement par seuil');
  assert.ok(G.timeline.rage != null, 'il a enragé');
  assert.ok(G.stats.boosts >= 1, 'au moins un coup boosté');
  assert.equal(G.stats.blocked, 0);
  assert.ok(G.summary.shares.every(s => s.stats.bossDmg > 0), 'tout le monde a frappé le roi');
});

test('enfermement : chaque mineur sur un rebord différent, entouré de blocs de cage ; le roi attend', () => {
  const G = newInstance(9, { miners: [0, 1, 2].map(i => spec(i, STRONG)) });
  quiet(G);
  G.boss.state = 'fight'; G.boss.y = G.floorY; G.boss.hp = G.boss.maxhp * 0.74;
  run(G, DT);
  assert.equal(G.boss.state, 'wait');
  const ys = G.miners.map(m => `${m.x < G.mid ? 'L' : 'R'}${m.y}`);
  assert.equal(new Set(ys).size, 3, 'trois rebords différents');
  for(const m of G.miners){
    assert.ok(G.ledges.some(l => l.y === m.y), 'sur un rebord');
    assert.equal(G.tiles[m.y - 1][m.x], CAGE); assert.equal(G.tiles[m.y][m.x + (m.x < G.mid ? 1 : -1)], CAGE);
    assert.ok(instSupported(G, m.x, m.y));
  }
  const hp = G.boss.hp;
  run(G, 2);
  assert.equal(G.boss.hp, hp);
  let resumed = false;
  for(let i = 0; i < Math.round(INSTANCE.boss.cageMaxWait / DT) + 1 && !resumed; i++){ run(G, DT); resumed = G.boss.state !== 'wait'; }
  assert.ok(resumed, 'il reprend');
});

test('fin : 30 min de jeu sans tuer le roi = échec ; tout le monde parti = échec', () => {
  assert.equal(INSTANCE_TICKS, INSTANCE.duration / DT);
  const G = runInstance(2, { miners: [spec(0, { damage: 0.5 })] });
  assert.equal(G.summary.success, false); assert.ok(Math.abs(G.t - INSTANCE.duration) < 1e-6);
  const H = newInstance(2, { miners: [spec(0), spec(1)] });
  run(H, 5);
  assert.ok(leaveInstance(H, 'a0')); assert.ok(!leaveInstance(H, 'a0'), 'déjà parti');
  assert.ok(leaveInstance(H, 'a1'));
  assert.equal(H.over, true); assert.equal(H.summary.success, false);
  assert.equal(H.summary.shares.filter(s => s.left).length, 2);
});

test('déterministe : même seed, mêmes mineurs → même partie', () => {
  const a = runInstance(13, { miners: [0, 1].map(i => spec(i, STRONG)) }).summary;
  const b = runInstance(13, { miners: [0, 1].map(i => spec(i, STRONG)) }).summary;
  assert.deepEqual({ ...a, id: 0 }, { ...b, id: 0 });
});
