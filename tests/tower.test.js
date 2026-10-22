/* Tours de l'Ange et du Démon (concept Ange vs Démon, étape 4) : carte, IA, boss, projection, fin. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWER, BLOCKS, CFG } from '../src/config.js';
import { genTower, towerLayout, inTower, inBoss } from '../src/sim/tower/world.js';
import { newTower, tickTower, runTower, leaveTower, towerSupported, TOWER_TICKS } from '../src/sim/tower/session.js';
import { towerSide, isTowerMode, buildTower } from '../src/shared/tower.js';
import { createTowerViewer, applyTowerView } from '../src/shared/tower-view.js';

const team = n => Array.from({ length: n }, (_, i) => ({ name: 'M' + i, account: 'A' + i }));

test('carte : tour de 15 × 30, murs et sol indestructibles, portes en bas, rez-de-chaussée vide, labyrinthe', () => {
  for(const side of ['angel', 'demon']){
    const T = genTower(7, side), S = TOWER.sides[side], L = towerLayout();
    assert.equal(T.x1 - T.x0 + 1, TOWER.width); assert.equal(T.floor - T.roof + 1, TOWER.height);
    for(let x = 0; x < T.w; x++) assert.ok(BLOCKS[T.tiles[T.h][x]].unbreakable, 'sol');
    for(let y = T.roof; y <= T.floor - TOWER.doorH; y++){ assert.equal(T.tiles[y][T.x0], S.hard); assert.equal(T.tiles[y][T.x1], S.hard); }
    for(let d = 0; d < TOWER.doorH; d++){ assert.equal(T.tiles[T.floor - d][T.x0], 0, 'porte gauche'); assert.equal(T.tiles[T.floor - d][T.x1], 0, 'porte droite'); }
    for(let x = T.x0 + 1; x < T.x1; x++) assert.equal(T.tiles[T.floor][x], 0, 'rez-de-chaussée vide');
    /* labyrinthe : une ligne sur mazeEvery = mazeHard blocs indestructibles sur width (murs compris), un seul passage
       d'un tenant, jamais au-dessus du passage de la ligne de mur précédente ; les autres lignes : de la brique */
    let prevGap = null, walls = 0;
    for(let y = T.roof + 1; y < T.floor; y++){
      const row = Array.from({ length: TOWER.width }, (_, i) => T.tiles[y][T.x0 + i]);
      const hard = row.filter(t => t === S.hard).length;
      if((T.floor - y) % TOWER.mazeEvery === 0){
        walls++;
        assert.equal(hard, TOWER.mazeHard, `ligne ${y}`);
        const gap = row.map((t, i) => t === S.brick ? T.x0 + i : null).filter(v => v !== null);
        assert.equal(gap.at(-1) - gap[0] + 1, gap.length, 'un seul passage');
        if(prevGap) assert.ok(!gap.some(x => prevGap.includes(x)), `ligne ${y} : passage au-dessus du précédent`);
        prevGap = gap;
      } else assert.equal(hard, y > T.floor - TOWER.doorH ? 0 : 2, `ligne ${y} : de la brique entre les murs (portes en bas)`);
    }
    assert.ok(walls >= 13);
    for(let x = T.bx; x < T.bx + TOWER.boss.w; x++) assert.equal(T.tiles[T.roof][x], S.hard, 'le toit sous le boss ne se perce pas');
    assert.equal(T.bx - T.x0, T.x1 - (T.bx + TOWER.boss.w - 1), 'boss au milieu');
    assert.deepEqual({ ...L }, { w: T.w, h: T.h, x0: T.x0, x1: T.x1, roof: T.roof, floor: T.floor, bx: T.bx, by: T.by });
  }
});

test('carte : toujours un chemin cassable du rez-de-chaussée au toit (200 seeds) ; même seed, même tour', () => {
  for(let seed = 1; seed <= 200; seed++){
    const T = genTower(seed, 'demon'), seen = new Set(), st = [];
    for(let x = T.x0 + 1; x < T.x1; x++){ st.push([x, T.floor]); seen.add(T.floor * T.w + x); }
    let ok = false;
    while(st.length && !ok){
      const [x, y] = st.pop(); if(y === T.roof){ ok = true; break; }
      for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x + dx, ny = y + dy, k = ny * T.w + nx;
        if(!inTower(T, nx, ny) || seen.has(k) || BLOCKS[T.tiles[ny][nx]]?.unbreakable) continue;
        seen.add(k); st.push([nx, ny]);
      }
    }
    assert.ok(ok, `seed ${seed}`);
  }
  assert.deepEqual(genTower(42, 'angel').tiles, genTower(42, 'angel').tiles);
});

test('à 3 bien équipés (minage 1,6, 14 dégâts) : ils traversent le labyrinthe et tuent le boss avant la fin, sur 5 seeds', () => {
  const gear = { mineSpeed: 1.6, damage: 14, attackSpeed: 120 };
  for(const seed of [11, 12, 13, 14, 15]){
    const G = runTower(seed, { side: seed % 2 ? 'angel' : 'demon', miners: team(3).map(m => ({ ...m, carac: gear })) });
    assert.equal(G.summary.success, true, `seed ${seed} : boss à ${G.summary.bossHp} PV`);
    assert.ok(G.summary.t < TOWER.duration);
    assert.ok(G.roster.every(m => m.stats.mined > 0 || m.stats.dmg > 0), 'chacun a travaillé');
    assert.ok(G.roster.filter(m => m.stats.dmg > 0).length >= 2, 'au moins deux combattent');
  }
});

test('mineur bien équipé, seul : il réussit ; le temps écoulé sans boss tué = échec', () => {
  const strong = [{ name: 'Fort', account: 'F', carac: { damage: 30, mineSpeed: 4 } }];
  assert.equal(runTower(3, { side: 'angel', miners: strong }).summary.success, true);
  const weak = [{ name: 'Lent', account: 'L', carac: { mineSpeed: 0.05 } }];
  const G = runTower(3, { side: 'angel', miners: weak });
  assert.equal(G.summary.success, false); assert.equal(G.ticks, TOWER_TICKS); assert.ok(G.summary.bossHp > 0);
});

test('boss : vise le premier arrivé ; frappe toutes les 1 s, 0,5 s sous 33 % ; projection = chute hors de la tour, étourdi', () => {
  const G = newTower(5, { side: 'angel', miners: team(2) });
  /* deux mineurs posés au contact, l'un après l'autre */
  const [a, b] = G.miners;
  Object.assign(a, { x: G.bx - 1, y: G.roof - 1, action: null }); tickTower(G);
  Object.assign(b, { x: G.bx + TOWER.boss.w, y: G.roof - 1, action: null }); tickTower(G);
  assert.deepEqual(G.arrivals, [a.id, b.id]); assert.equal(G.boss.target, a.id);
  /* projections forcées : hasard des combats toujours 0 (< 10 %) */
  G.fightRng = () => 0;
  let guard = 0;
  while(!a.stats.knocked && guard++ < 50) tickTower(G);
  assert.ok(a.stats.knocked >= 1, 'projeté');
  assert.ok(a.x < G.x0, 'hors de la tour (côté gauche)');
  G.fightRng = () => 0.99;                           // plus de projection pendant la chute
  while(!towerSupported(G, a.x, a.y) && guard++ < 500) tickTower(G);
  for(let i = 0; i < 3; i++) tickTower(G);
  assert.equal(a.action?.type, 'stun', 'chute imprévue : étourdi'); assert.equal(a.y, G.floor);
  assert.equal(G.boss.target, b.id, 'le suivant devient la cible');
  /* rage : sous 33 %, un coup toutes les 0,5 s (après le coup en cours) */
  G.boss.hp = G.boss.maxhp * 0.3;
  const hits0 = G.stats.hits; for(let i = 0; i < 20; i++){ b.x = G.bx + TOWER.boss.w; b.y = G.roof - 1; b.action = { type: 'wait', dur: 1e9, t: 0, data: {} }; tickTower(G); }
  assert.ok(G.stats.hits - hits0 >= 3, `coups en 2 s : ${G.stats.hits - hits0}`);   // 1 s, puis toutes les 0,5 s
});

test('barbare : projeté deux fois moins souvent (5 % au lieu de 10 %)', () => {
  const G = newTower(5, { side: 'demon', miners: [{ name: 'B', account: 'B', skillTree: 'barbare' }] });
  const m = G.miners[0]; Object.assign(m, { x: G.bx - 1, y: G.roof - 1, action: null }); tickTower(G);
  G.fightRng = () => 0.07;                           // 7 % : projeté s'il ne l'était pas (10 %), pas en barbare (5 %)
  for(let i = 0; i < 30; i++){ m.action = { type: 'wait', dur: 1e9, t: 0, data: {} }; tickTower(G); }
  assert.equal(m.stats.knocked, 0);
});

test('quitter : le mineur disparaît ; tout le monde parti = fin sans réussite', () => {
  const G = newTower(9, { side: 'angel', miners: team(2) });
  for(let i = 0; i < 50; i++) tickTower(G);
  assert.equal(leaveTower(G, 'A0'), true); assert.equal(leaveTower(G, 'A0'), false);
  leaveTower(G, 'A1');
  assert.equal(G.over, true); assert.equal(G.summary.success, false);
  assert.deepEqual(G.summary.shares.map(s => s.left), [true, true]);
});

test('modes de lancement, construction depuis l\'enregistrement, affichage (carte, boss, mineurs)', () => {
  assert.equal(towerSide('tower_angel'), 'angel'); assert.equal(towerSide('tower_demon'), 'demon');
  assert.equal(isTowerMode('mine'), false); assert.equal(isTowerMode('mi'), false);
  const G = buildTower({ id: 'x', mode: 'tower_demon', seed: 4, players: [{ account: 'K1', name: 'Zoe' }], looks: {}, gear: {}, skills: {} });
  assert.equal(G.side, 'demon'); assert.equal(G.miners[0].account, 'K1'); assert.equal(G.miners[0].name, 'Zoe');
  for(let i = 0; i < 30; i++) tickTower(G);
  const v = applyTowerView(JSON.parse(JSON.stringify(createTowerViewer(G)())));
  assert.deepEqual(v.tiles, G.tiles); assert.equal(v.boss.hp, TOWER.boss.hp); assert.equal(v.miners.length, 1);
  assert.ok(inBoss(v, v.bx, v.roof - 1) && !inBoss(v, v.bx - 1, v.roof - 1));
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

test('brouillard : l\'intérieur n\'est pas découvert au départ ; chaque mineur découvre autour de lui (Découverte)', async () => {
  const { revealAround } = await import('../src/sim/tower/session.js');
  const G = newTower(6, { side: 'angel', miners: [{ name: 'A', account: 'A' }, { name: 'B', account: 'B', carac: { discoverMax: 4 } }] });
  let inner = 0, seen = 0;
  for(let y = G.roof; y <= G.floor; y++) for(let x = G.x0 + 1; x < G.x1; x++){ inner++; seen += G.seen[y][x]; }
  assert.ok(seen > 0 && seen < inner / 3, `découvert au départ : ${seen} / ${inner}`);
  assert.equal(G.seen[0][0], 1, 'l\'extérieur est connu');
  const [a, b] = G.miners;
  const disc = (m, r) => { for(let dy = -r; dy <= r; dy++) for(let dx = -r; dx <= r; dx++) if(dx * dx + dy * dy <= r * r && G.seen[m.y + dy]?.[m.x + dx] === 0) return false; return true; };
  assert.ok(disc(a, 2) && disc(b, 4), 'rayon = Découverte');
  a.y = G.roof + 4; revealAround(G, a);
  assert.equal(G.seen[G.roof + 4][a.x], 1);
  /* l'IA ne connaît pas les murs pas encore découverts : elle les découvre en creusant, sans jamais creuser un incassable */
  const H = runTower(6, { side: 'angel', miners: team(3).map(m => ({ ...m, carac: { mineSpeed: 1.6, damage: 14 } })) });
  assert.equal(H.summary.success, true);
});
