/* Tours de l'Ange et du Démon (refonte du 23/10 : étages en serpentin, Séraphins / Diablotins, boss qui se déplace). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWER, BLOCKS, CFG } from '../src/config.js';
import { genTower, towerLayout, inTower, floorBottom, floorTop, floorCeil, gateCols, floorOf } from '../src/sim/tower/world.js';
import { newTower, tickTower, runTower, leaveTower, towerSupported, revealFloor, sealedFloor, wantedSide, contactCells, mobDist, TOWER_TICKS } from '../src/sim/tower/session.js';
import { towerSide, isTowerMode, buildTower } from '../src/shared/tower.js';
import { createTowerViewer, applyTowerView } from '../src/shared/tower-view.js';

const team = n => Array.from({ length: n }, (_, i) => ({ name: 'M' + i, account: 'A' + i }));
const hold = m => { m.action = { type: 'wait', dur: 1e9, t: 0, data: {} }; };

test('carte : 20 de large, 6 étages de 3 + séparations, toit, portes de 3 au bord en alternance, étages en alternance', () => {
  for(const [seed, side] of [[7, 'angel'], [8, 'demon'], [9, 'angel'], [10, 'demon']]){
    const T = genTower(seed, side), S = TOWER.sides[side];
    assert.equal(T.x1 - T.x0 + 1, TOWER.width);
    assert.equal(T.floor - T.roof + 1, TOWER.floors * (TOWER.floorH + 1), '24 lignes du rez-de-chaussée au toit');
    assert.equal(floorCeil(T, TOWER.floors - 1), T.roof, 'la séparation du dernier étage est le toit');
    for(let x = 0; x < T.w; x++) assert.ok(BLOCKS[T.tiles[T.h][x]].unbreakable, 'sol');
    for(let y = T.roof; y <= T.floor - TOWER.doorH; y++){ assert.equal(T.tiles[y][T.x0], S.hard); assert.equal(T.tiles[y][T.x1], S.hard); }
    for(let d = 0; d < TOWER.doorH; d++){ assert.equal(T.tiles[T.floor - d][T.x0], 0); assert.equal(T.tiles[T.floor - d][T.x1], 0); }
    assert.equal(T.kinds[0], 'empty');
    for(let k = 0; k < TOWER.floors; k++){
      const c = floorCeil(T, k), gate = gateCols(T, k);
      assert.equal(gate.length, TOWER.gate);
      assert.ok(gate[0] === T.x0 + 1 || gate.at(-1) === T.x1 - 1, `porte ${k} au bord`);
      if(k) assert.notEqual(gate[0], gateCols(T, k - 1)[0], 'alternance gauche / droite');
      for(let x = T.x0 + 1; x < T.x1; x++) assert.equal(T.tiles[c][x], gate.includes(x) ? S.brick : S.hard, `séparation ${k}, x ${x}`);
      if(k >= 2) assert.notEqual(T.kinds[k], T.kinds[k - 1], 'blocs et mobs en alternance');
      const want = T.kinds[k] === 'blocks' ? S.brick : 0;
      for(let y = floorTop(T, k); y <= floorBottom(T, k); y++) for(let x = T.x0 + 1; x < T.x1; x++) assert.equal(T.tiles[y][x], want);
      assert.equal(floorOf(T, floorBottom(T, k)), k); assert.equal(floorOf(T, c), k);
    }
    assert.deepEqual({ ...towerLayout() }, { w: T.w, h: T.h, x0: T.x0, x1: T.x1, roof: T.roof, floor: T.floor, bx: T.bx, by: T.by });
  }
  const firsts = new Set(Array.from({ length: 30 }, (_, s) => genTower(s, 'angel').kinds[1]));
  assert.deepEqual([...firsts].sort(), ['blocks', 'mobs'], 'le premier étage est tiré par la seed');
  assert.deepEqual(genTower(42, 'angel').tiles, genTower(42, 'angel').tiles);
});

test('mobs : 5 par étage « mobs », 200 PV, endormis, loin de la porte d\'entrée ; découverte étage par étage', () => {
  const G = newTower(3, { side: 'demon', miners: team(1) });
  const mobFloors = G.kinds.map((k, i) => k === 'mobs' ? i : -1).filter(i => i > 0);
  assert.equal(G.mobs.length, mobFloors.length * TOWER.mobs.count);
  for(const o of G.mobs){
    assert.equal(o.hp, TOWER.mobs.hp); assert.equal(o.awake, false); assert.equal(o.y, floorBottom(G, o.floor));
    assert.ok(gateCols(G, o.floor - 1).every(g => Math.abs(g - o.x) > 1), 'pas sur la porte d\'entrée');
  }
  assert.equal(G.seen[floorBottom(G, 0)][G.x0 + 3], 1, 'étage 0 découvert');
  assert.equal(G.seen[floorBottom(G, 1)][G.x0 + 3], 0, 'étage 1 pas encore');
  const k = mobFloors[0];
  revealFloor(G, k);
  for(let y = floorCeil(G, k); y <= floorBottom(G, k); y++) for(let x = G.x0; x <= G.x1; x++) assert.equal(G.seen[y][x], 1);
  assert.ok(G.mobs.filter(o => o.floor === k).every(o => o.awake), 'réveillés');
  assert.ok(G.mobs.filter(o => o.floor !== k).every(o => !o.awake));
});

test('mobs : la porte du plafond reste scellée tant qu\'il en reste un ; ils taclent au contact ; on les tue', () => {
  const G = newTower(3, { side: 'angel', miners: team(1) });
  const k = G.kinds.indexOf('mobs'), m = G.miners[0], gate = gateCols(G, k);
  revealFloor(G, k);
  /* scellée : l'IA ne peut pas creuser la porte */
  const o = G.mobs.find(q => q.floor === k);
  Object.assign(m, { x: o.x + 1, y: o.y, action: null });
  for(let i = 0; i < 3; i++) tickTower(G);
  assert.ok(G.mobs.some(q => q.grab === m.id), 'taclé');
  assert.equal(m.stats.tackled > 0, true);
  assert.equal(sealedFloor(G, k), true, 'scellée');
  for(const q of G.mobs.filter(q => q.floor === k)) q.hp = 0;
  assert.equal(sealedFloor(G, k), false, 'ouverte');
  /* le dernier mort, la porte s'ouvre : le mineur peut la creuser */
  Object.assign(m, { x: gate[1], y: floorBottom(G, k), action: null });
  let guard = 0;
  while(gate.every(x => G.tiles[floorCeil(G, k)][x] !== 0) && guard++ < 800) tickTower(G);
  assert.ok(gate.some(x => G.tiles[floorCeil(G, k)][x] === 0), 'porte creusée');
  assert.equal(mobDist({ x: 5, y: 10 }, { x: 5, y: 8 }), 1, 'un mob fait 2 cases de haut');
  assert.equal(mobDist({ x: 5, y: 10 }, { x: 6, y: 9 }), 1);
});

test('boss : 3500 PV ; projection de 5 cases, 25 % (10 % barbare), 35 / 20 % en rage ; son focus tombé, il marche vers un autre', () => {
  assert.equal(TOWER.boss.hp, 3500); assert.equal(TOWER.boss.knockChance, 0.25); assert.equal(TOWER.boss.knockBarb, 0.1);
  assert.equal(TOWER.boss.rageKnock, 0.35); assert.equal(TOWER.boss.rageKnockBarb, 0.2); assert.equal(TOWER.boss.knock, 5);
  const G = newTower(5, { side: 'angel', miners: team(2) });
  for(const o of G.mobs) o.hp = 0;
  const [a, b] = G.miners, y = G.roof - 1;
  Object.assign(a, { x: G.boss.x - 1, y }); hold(a);
  Object.assign(b, { x: G.x1, y }); hold(b);
  tickTower(G);
  assert.equal(G.boss.target, a.id);
  /* pas encore engagé : immobile ; engagé et personne au contact : il marche vers b */
  a.y = G.floor; tickTower(G); assert.equal(G.boss.x, G.bx, 'pas de combat : il ne bouge pas');
  G.boss.engaged = true;
  for(let i = 0; i < 20; i++) tickTower(G);
  assert.ok(G.boss.x > G.bx, 'il s\'est déplacé vers le mineur le plus proche');
  assert.ok(G.boss.x + TOWER.boss.w - 1 <= G.x1, 'il reste sur le toit');
  /* projection depuis le milieu : 5 cases, il reste sur le toit */
  assert.equal(G.boss.focus, b.id, 'son focus (a) est tombé du toit : il focus b');
  G.boss.x = G.bx; a.x = G.boss.x - 1; a.y = y; b.x = G.x1;
  G.boss.focus = a.id;   // il ignore les autres : on lui redonne a comme focus
  G.fightRng = () => 0; G.boss.cd = 0;
  tickTower(G);
  assert.equal(a.stats.knocked, 1); assert.equal(a.x, G.bx - 1 - TOWER.boss.knock); assert.ok(a.x >= G.x0);
  /* depuis le bord : il passe le bord et tombe jusqu'en bas */
  G.fightRng = () => 0.99; hold(b);
  G.boss.x = G.x0 + 4; a.x = G.boss.x - 1; a.y = y; a.action = null;
  hold(a); G.fightRng = () => 0; G.boss.cd = 0; tickTower(G);
  assert.ok(a.x < G.x0, 'hors de la tour');
  G.fightRng = () => 0.99; a.action = null;
  let guard = 0;
  while(!towerSupported(G, a.x, a.y) || a.action?.type === 'move'){ tickTower(G); if(guard++ > 300) break; }
  assert.equal(a.y, G.floor, 'au pied de la tour');
  assert.equal(a.action?.type, 'stun', 'étourdi');
});

test('barbare : du côté opposé aux autres ; deux barbares sans autre mineur se répartissent', () => {
  const G = newTower(5, { side: 'demon', miners: [{ name: 'M', account: 'M' }, { name: 'B', account: 'B', skillTree: 'barbare' }] });
  const [m, b] = G.miners;
  Object.assign(m, { x: G.boss.x - 1, y: G.roof - 1 });
  assert.equal(wantedSide(G, b), 'R'); assert.equal(wantedSide(G, m), null);
  m.x = G.boss.x + TOWER.boss.w; assert.equal(wantedSide(G, b), 'L');
  const H = newTower(5, { side: 'demon', miners: [{ name: 'B1', account: 'B1', skillTree: 'barbare' }, { name: 'B2', account: 'B2', skillTree: 'barbare' }] });
  assert.notEqual(wantedSide(H, H.miners[0]), wantedSide(H, H.miners[1]));
  assert.equal(contactCells(G).length, 2);
});

test('lumière : il pose des torches dans le noir (illimitées)', () => {
  const G = newTower(4, { side: 'angel', miners: team(1) });
  for(let i = 0; i < 300; i++) tickTower(G);
  assert.ok(G.torches.length >= 1, `torches : ${G.torches.length}`);
  assert.ok(G.light.size > 0);
});

test('compo forte (2 barbares 15 dégâts + mineur 1,3) : toit atteint et boss entamé sur 5 seeds, sans blocage ; stuff de base : échec', () => {
  const strong = [{ name: 'B1', account: 'B1', skillTree: 'barbare', carac: { damage: 15 } },
                  { name: 'B2', account: 'B2', skillTree: 'barbare', carac: { damage: 15 } },
                  { name: 'M', account: 'M', carac: { mineSpeed: 1.3 } }];
  for(const seed of [11, 12, 13, 14, 15]){
    const G = runTower(seed, { side: seed % 2 ? 'angel' : 'demon', miners: strong });
    assert.equal(G.summary.floor, TOWER.floors, `seed ${seed} : toit atteint (étage ${G.summary.floor})`);
    assert.ok(G.summary.bossHp < TOWER.boss.hp * 0.8, `seed ${seed} : boss entamé (${G.summary.bossHp} PV)`);
    assert.equal(G.stats.blocked, 0, 'jamais bloqué');
    assert.equal(G.summary.kills, G.mobs.length, 'tous les mobs tués');
  }
  const weak = runTower(11, { side: 'angel', miners: team(3) });
  assert.equal(weak.summary.success, false); assert.equal(weak.ticks, TOWER_TICKS); assert.ok(weak.summary.bossHp > 0);
});

test('quitter : le mineur disparaît ; tout le monde parti = fin sans réussite', () => {
  const G = newTower(9, { side: 'angel', miners: team(2) });
  for(let i = 0; i < 50; i++) tickTower(G);
  assert.equal(leaveTower(G, 'A0'), true); assert.equal(leaveTower(G, 'A0'), false);
  leaveTower(G, 'A1');
  assert.equal(G.over, true); assert.equal(G.summary.success, false);
  assert.deepEqual(G.summary.shares.map(s => s.left), [true, true]);
});

test('modes de lancement, construction depuis l\'enregistrement, affichage (carte, mobs, torches, boss, mineurs)', () => {
  assert.equal(towerSide('tower_angel'), 'angel'); assert.equal(towerSide('tower_demon'), 'demon');
  assert.equal(isTowerMode('mine'), false); assert.equal(isTowerMode('mi'), false);
  const G = buildTower({ id: 'x', mode: 'tower_demon', seed: 4, players: [{ account: 'K1', name: 'Zoe' }], looks: {}, gear: {}, skills: {} });
  assert.equal(G.side, 'demon'); assert.equal(G.miners[0].account, 'K1'); assert.equal(G.miners[0].name, 'Zoe');
  for(let i = 0; i < 400; i++) tickTower(G);
  const v = applyTowerView(JSON.parse(JSON.stringify(createTowerViewer(G)())));
  assert.deepEqual(v.tiles, G.tiles); assert.equal(v.boss.hp, TOWER.boss.hp); assert.equal(v.boss.x, G.boss.x); assert.equal(v.miners.length, 1);
  assert.deepEqual(v.torches, G.torches); assert.deepEqual([...v.light], [...G.light], 'même lumière');
  assert.equal(v.mobs.length, G.mobs.filter(o => o.hp > 0 && G.seen[o.y][o.x]).length, 'seulement les mobs des étages découverts');
  assert.ok(inTower(v, v.x0 + 1, v.floor));
});

test('partie en direct du serveur : une tour se joue jusqu\'au bout, le rejeu (redémarrage) donne la même partie', async () => {
  const { createLiveGame } = await import('../server/game/live-game.js');
  const rec = { id: 't1', mode: 'tower_angel', seed: 21, players: team(3).map(p => ({ account: p.account, name: p.name })),
                looks: {}, gear: {}, skills: {}, leaves: [{ account: 'A2', tick: 1200 }], focus: [] };
  const a = createLiveGame(rec), b = createLiveGame(rec);
  a.advance(TOWER_TICKS); b.advance(TOWER_TICKS);
  assert.equal(a.over, true);
  assert.deepEqual(a.summary, b.summary, 'même seed et mêmes départs : même partie');
  assert.equal(a.summary.shares.find(s => s.account === 'A2').left, true);
  assert.equal(a.view().mode, 'tower');
});

test('recul (25/10) : un coup repousse le Séraphin de 0,25 ; il repousse le mineur qu\'il tacle de 0,25 par seconde', () => {
  const G = newTower(3, { side: 'angel', miners: team(1) });
  const k = G.kinds.indexOf('mobs'), m = G.miners[0];
  revealFloor(G, k);
  const o = G.mobs.find(q => q.floor === k);
  for(const q of G.mobs) if(q !== o) q.awake = false;
  o.x = G.x0 + 8; o.cd = 1e9;   // il ne marche pas
  Object.assign(m, { x: o.x - 1, y: o.y, action: { type: 'stun', dur: 1e9, t: 0, data: {} } });
  tickTower(G); assert.equal(o.grab, m.id, 'taclé à portée');
  for(let i = 0; i < Math.round(TOWER.mobs.hitEvery / 0.1) + 1; i++) tickTower(G);
  assert.equal(m.kx, -TOWER.mobs.knock, 'le mineur est repoussé (du côté opposé au mob)');
  m.kx = 0; m.action = null; o.hp = 1e9;
  const x0 = o.x;
  for(let i = 0; i < 200; i++) tickTower(G);
  assert.ok(o.hp < 1e9, 'il frappe le mob');
  assert.ok(o.x > x0 || (o.kx ?? 0) > 0, 'le mob a reculé');
  assert.equal(o.grab, m.id, 'toujours taclé : il revient au contact');
});

test('recul : le boss repousse le mineur de 0,25 quand il ne le projette pas ; lui ne recule pas', () => {
  const G = newTower(5, { side: 'demon', miners: team(1) });
  const m = G.miners[0], [cx, cy] = contactCells(G)[0];
  Object.assign(m, { x: cx, y: cy, action: { type: 'stun', dur: 1e9, t: 0, data: {} } });
  G.fightRng = () => 0.99;   // jamais de projection
  G.arrivals = [m.id]; G.boss.engaged = true; G.boss.cd = 0.05;
  const bx = G.boss.x;
  tickTower(G); tickTower(G);
  assert.equal(Math.abs(m.kx), TOWER.boss.push, 'repoussé de 0,25');
  assert.ok(Math.sign(m.kx) === Math.sign(m.x + 0.5 - (G.boss.x + TOWER.boss.w / 2)), 'vers l\'extérieur');
  assert.equal(G.boss.x, bx);
});
