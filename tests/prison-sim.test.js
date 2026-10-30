/* Prison (spec docs/superpowers/specs/2026-10-29-prison-energie-design.md) : simulation d'un run. Une seule area de 50
   lignes au contenu de l'area max du joueur, 25 colonnes entre deux rangées de barreaux incassables, moitié moins de
   treasures et de butin rare, pas de k hole, de shrine, de Gallianix ni de nouvelle area ; le run finit à 80 % des
   minerais : le mineur remonte déposer, comme en fin de session. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, AREA_H, AREA_Y0, DT, PRISON, BLOCKS, SPAWN_X, CHEST_X, WINCH, DUNGEON, TRAP, MOBS, KHOLE, KHOLE_BLOCK, GLYPHS, SHINY, TREASURE_BLOCK } from '../src/config.js';
import { newPrisonRun, prisonGoal, tickPrison, endPrisonRun } from '../src/sim/prison.js';
import { newSession, tick } from '../src/sim/session.js';
import { areaComp, areaDef, prisonComp, contentOf, contentAt, maxRow } from '../src/sim/world.js';
import { timeLeft } from '../src/sim/mineur.js';
import { spawnTableAt } from '../src/sim/mobs.js';
import { glyphDrop, shinyOf } from '../src/sim/actions.js';
import { planDungeon, startColumns } from '../src/sim/dungeon.js';
import { planTraps } from '../src/sim/trap.js';
import { treasureItem } from '../src/sim/world.js';

const X0 = CHEST_X - Math.floor(PRISON.width/2), X1 = X0 + PRISON.width;   // colonnes [X0, X1)
const inside = x => x >= X0 && x < X1;

test('carte : une area de 50 lignes, composition de l\'area max, 25 colonnes entre les barreaux', () => {
  const G = newPrisonRun(7, { miner:{}, areaMax:3, run:1 });
  assert.equal(G.areas.length, 1);
  assert.equal(G.unlockedAreas, 1);
  assert.equal(G.tiles.length, AREA_Y0 + AREA_H);
  assert.deepEqual(G.areas[0].comp, prisonComp(areaComp(3), PRISON.oreMul));
  assert.equal(contentOf(G, 0), 3);
  assert.equal(contentAt(G, 10), 3);
  for(let y=1; y<=maxRow(G); y++){
    let free = 0;
    for(let x=0; x<W; x++){
      if(inside(x)) assert.notEqual(G.tiles[y][x], PRISON.bars, `barreau dans la prison (${x}, ${y})`);
      else assert.equal(G.tiles[y][x], PRISON.bars, `pas de barreau en (${x}, ${y})`);
      if(G.tiles[y][x] !== PRISON.bars) free++;
    }
    assert.equal(free, PRISON.width, `ligne ${y}`);
  }
  assert.ok(inside(SPAWN_X) && inside(CHEST_X) && inside(WINCH.x));
  assert.ok(BLOCKS[PRISON.bars].unbreakable);
  assert.equal(BLOCKS[PRISON.bars].tex, 'prison_bars');
  assert.equal(G.endAt, Infinity);
  assert.equal(timeLeft(G), Infinity);
  assert.equal(G.miners.length, 1);
});

test('mine classique : contenu = area, temps restant = la fin de session', () => {
  const G = newSession(7);
  assert.equal(contentOf(G, 2), 2);
  assert.equal(contentAt(G, AREA_Y0 + AREA_H), 1);
  assert.equal(timeLeft(G), 3600);
});

test('prisonComp : minerais × oreMul, pris sur le terrain dans sa proportion, somme 100', () => {
  const c = prisonComp({ coal:4, iron:2, stone:60, dirt:34 }, 2);
  assert.equal(c.coal, 8); assert.equal(c.iron, 4);
  assert.ok(Math.abs(c.stone - (60 - 6*60/94)) < 1e-9);
  assert.ok(Math.abs(c.dirt - (34 - 6*34/94)) < 1e-9);
  assert.ok(Math.abs(Object.values(c).reduce((s, v) => s+v, 0) - 100) < 1e-9);
  assert.deepEqual(prisonComp({ coal:4, iron:2, stone:60, dirt:34 }, 1), { coal:4, iron:2, stone:60, dirt:34 });
  const all = prisonComp(areaComp(4), 1.5);
  assert.ok(Math.abs(Object.values(all).reduce((s, v) => s+v, 0) - 100) < 1e-9);
});

test('donjon et pièges : entre les barreaux, le donjon à au moins dungeonWinchGap du treuil', () => {
  let dungeons = 0, traps = 0;
  for(let s=1; dungeons < 200 && s < 5000; s++){
    const G = newPrisonRun(s, { miner:{}, areaMax:DUNGEON.areas[0], run:1 });
    for(const d of G.dungeons){
      dungeons++;
      assert.ok(d.x0 >= X0 && d.x0 + DUNGEON.size <= X1, `donjon x0 ${d.x0}`);
      assert.ok(d.x0 + DUNGEON.size - 1 < WINCH.x - PRISON.dungeonWinchGap || d.x0 > WINCH.x + PRISON.dungeonWinchGap);
    }
    for(const t of G.traps){
      traps++;
      assert.ok(t.x0 >= X0 && t.x0 + TRAP.w + 2 <= X1, `piège x0 ${t.x0}`);
    }
  }
  assert.ok(dungeons >= 200, `donjons : ${dungeons}`);
  assert.ok(traps > 50, `pièges : ${traps}`);
  /* pièges dès TRAP.fromArea */
  let n = 0;
  for(let s=1; s<=200; s++) for(const t of newPrisonRun(s, { miner:{}, areaMax:TRAP.fromArea, run:1 }).traps){ n++; assert.ok(inside(t.x0) && inside(t.x0 + TRAP.w + 1)); }
  assert.ok(n > 20, `pièges area ${TRAP.fromArea} : ${n}`);
});

test('donjon : chance × rareMul en prison', () => {
  const k = DUNGEON.areas[0], box = { x0:X0, w:PRISON.width, winchGap:PRISON.dungeonWinchGap };
  let mine = 0, prison = 0;
  for(let s=1; s<=4000; s++){ if(planDungeon(s, k)) mine++; if(planDungeon(s, k, { ...box, chanceMul:PRISON.rareMul })) prison++; }
  assert.ok(Math.abs(prison/mine - PRISON.rareMul) < 0.1, `${prison} / ${mine}`);
});

test('boîte trop étroite : ni donjon ni piège (pas de colonne NaN)', () => {
  assert.deepEqual(startColumns({ x0:X0, w:PRISON.width }), []);   // l'écart classique au treuil ne laisse rien
  for(let s=1; s<=300; s++){
    assert.equal(planDungeon(s, DUNGEON.areas[0], { x0:X0, w:PRISON.width }), null);
    assert.equal(planDungeon(s, DUNGEON.areas[0], { x0:0, w:DUNGEON.size }), null);
    assert.deepEqual(planTraps(s, TRAP.fromArea, null, { x0:X0, w:TRAP.w }), []);
  }
  /* sans boîte : comme avant */
  assert.ok(startColumns().length > 0);
});

test('mobs : la table d\'apparition est celle de l\'area max', () => {
  const G = newPrisonRun(3, { miner:{}, areaMax:5, run:1 });
  const want = MOBS.spawnTable[5], seen = new Set();
  const r = (() => { let i = 0; return () => (i++ % 1000) / 1000; })();
  for(let i=0; i<10000; i++){
    const table = spawnTableAt(G, 10);
    assert.deepEqual(table, want);
    let x = r(), pick = null;
    for(const t in table){ x -= table[t]; if(x < 0){ pick = t; break; } }
    seen.add(pick ?? Object.keys(table).at(-1));
  }
  for(const t of seen) assert.ok(t in want, t);
  assert.deepEqual(spawnTableAt(newSession(3), 10), MOBS.spawnTable[0]);
});

test('treasure : chance × treasureMul, objet de l\'area max', () => {
  const k = 2; let n = 0;
  for(let s=1; s<=400; s++){
    const G = newPrisonRun(s, { miner:{}, areaMax:k, run:1 });
    if(G.areas[0].treasure){
      n++;
      assert.equal(G.areas[0].treasure.item, treasureItem(k));
      assert.equal(G.tiles[G.areas[0].treasure.y][G.areas[0].treasure.x], TREASURE_BLOCK);
      assert.ok(inside(G.areas[0].treasure.x));
    }
  }
  assert.ok(Math.abs(n/400 - areaDef(k).chestChance*PRISON.treasureMul) < 0.05, `${n} / 400`);
});

test('butin rare : glyphes et shiny × rareMul', () => {
  const save = GLYPHS.drop.mineur.chance; GLYPHS.drop.mineur.chance = 0.2;
  try {
    const count = G => { const m = G.miners[0]; m.skillTree = 'mineur'; let n = 0;
      for(let i=0; i<20000; i++){ m.glyphFound = []; const before = G.stats.glyphs || 0; glyphDrop(G, m, 'block'); if((G.stats.glyphs || 0) > before) n++; }
      return n; };
    const mine = count(newSession(11)), prison = count(newPrisonRun(11, { miner:{}, areaMax:0, run:1 }));
    assert.ok(Math.abs(prison/mine - PRISON.rareMul) / PRISON.rareMul < 0.2, `${prison} / ${mine}`);
  } finally { GLYPHS.drop.mineur.chance = save; }
  const ore = Number(Object.keys(BLOCKS).find(id => Object.hasOwn(SHINY.items, BLOCKS[id].name)));
  const shiny = G => { let n = 0; for(let i=0; i<20000; i++) if(shinyOf(G, ore)) n++; return n; };
  const a = shiny(newSession(11)), b = shiny(newPrisonRun(11, { miner:{}, areaMax:0, run:1 }));
  assert.ok(Math.abs(b/a - PRISON.rareMul) / PRISON.rareMul < 0.2, `shiny ${b} / ${a}`);
});

/* k hole : permis en prison depuis le 29/10 (chance × PRISON.kholeMul) ; toujours ni shrine, ni Gallianix, ni nouvelle area */
test('ni shrine, ni Gallianix, ni nouvelle area ; k hole 2 fois plus rare qu\'en mine', () => {
  let kh = 0;
  for(let s=1; s<=300; s++){
    const G = newPrisonRun(s, { miner:{}, areaMax:2, run:1 });
    if(G.tiles.some(row => row.includes(KHOLE_BLOCK))) kh++;
    assert.equal((G.kholes || []).length, G.tiles.some(row => row.includes(KHOLE_BLOCK)) ? 1 : 0);
  }
  assert.ok(kh < 300 * KHOLE.chance, `k hole : ${kh} cartes sur 300 (mine : ${300 * KHOLE.chance} attendues)`);
  const G = newPrisonRun(5, { miner:{}, areaMax:2, run:1 });
  const S = newSession(5, { shrines:['abundance'], prison:{ areaMax:2 } });
  assert.deepEqual(S.shrines, []);
  assert.equal(S.oreBonus || 0, 0);
  G.areas[0].oreMined = G.areas[0].oreTotal;
  for(let i=0; i<50; i++) tickPrison(G);
  assert.equal(G.unlockedAreas, 1);
  assert.equal(G.areas.length, 1);
  assert.equal(G.ducks || 0, 0);
  });

test('fin de run : 80 % des minerais, remontée, dépôt, bilan prison', () => {
  const G = newPrisonRun(21, { miner:{ carac:{ mineSpeed:5, pods:2000 } }, areaMax:1, run:4 });
  const max = Math.ceil(PRISON.runMax/DT + PRISON.returnMax/DT);
  let i = 0;
  while(!G.over && i++ < max) tickPrison(G);
  assert.ok(G.over, 'le run ne finit pas');
  assert.ok(G.areas[0].oreMined >= prisonGoal(G), `${G.areas[0].oreMined} / ${prisonGoal(G)}`);
  assert.equal(prisonGoal(G), Math.ceil(PRISON.resetAt * G.areas[0].oreTotal));
  const m = G.miners[0];
  assert.ok(m.y <= 0, `mineur en y ${m.y}`);
  assert.equal(Object.keys(m.inv).length, 0);
  assert.ok(G.t < PRISON.runMax, `fini à ${G.t} s`);
  assert.equal(G.summary.mode, 'prison');
  assert.equal(G.summary.run, 4);
  assert.equal(G.summary.t, G.t);
  const bag = G.summary.shares[0].bag;
  assert.ok((bag.Charbon || 0) > 0, JSON.stringify(bag));
  assert.ok(G.log.some(l => /Run 4 : 80 % des minerais/.test(l.msg)), 'journal');
  /* idempotent */
  const s = G.summary; endPrisonRun(G); assert.equal(G.summary, s);
});

test('runMax : un mineur trop lent finit au bout du temps max', () => {
  const G = newPrisonRun(22, { miner:{ carac:{ mineSpeed:0.02 } }, areaMax:0, run:1 });
  const max = Math.ceil(PRISON.runMax/DT + PRISON.returnMax/DT) + 1;
  let i = 0;
  while(!G.over && i++ < max) tickPrison(G);
  assert.ok(G.over);
  assert.ok(G.t <= PRISON.runMax + PRISON.returnMax + 1e-6, `${G.t}`);
  assert.ok(G.t >= PRISON.runMax - 1e-6, `${G.t}`);
  assert.ok(G.areas[0].oreMined < prisonGoal(G));
  assert.equal(G.summary.mode, 'prison');
});

test('rejeu : même seed, même spec, même run → même coffre', () => {
  const spec = { carac:{ mineSpeed:2 } };
  const a = newPrisonRun(9, { miner:spec, areaMax:2, run:3 }), b = newPrisonRun(9, { miner:spec, areaMax:2, run:3 });
  for(let i=0; i<20000; i++){ tickPrison(a); tickPrison(b); }
  assert.equal(JSON.stringify(a.chest), JSON.stringify(b.chest));
  assert.ok(Object.keys(a.chest).length > 0);
  assert.notEqual(newPrisonRun(9, { miner:spec, areaMax:2, run:4 }).seed, a.seed);
});

/* fin de run avec un sac de Mule chargé en bas (posé là où se tient le logisticien) : il remonte en passant le
   prendre, le vide au coffre ; rien n'est perdu (revue du 29/10) */
test('fin de run : le porteur de la Mule passe prendre son sac et le rapporte', () => {
  const G = newPrisonRun(31, { miner:{ skills:{ winch:1, mule:1 }, skillTree:'logisticien' }, areaMax:1, run:2 });
  const m = G.miners[0];
  let i = 0;
  while(!(m.y >= 12 && m.mode === 'work' && !m.action?.data?.fall) && i++ < 30000) tickPrison(G);
  assert.ok(m.y >= 12, `mineur en y ${m.y}`);
  G.mule = { carrier:m.id, placed:true, x:m.x, y:m.y, inv:{ 'Fer':7 }, by:{ [m.id]:{ 'Fer':7 } }, load:21 };
  const before = G.chest['Fer'] || 0;
  G.areas[0].oreMined = prisonGoal(G);
  const max = Math.ceil(PRISON.returnMax/DT) + 2;
  for(i=0; i<max && !G.over; i++) tickPrison(G);
  assert.ok(G.over, 'le run ne finit pas');
  assert.ok(G.t < G.prison.endTick*DT + PRISON.returnMax, `fini au filet de sécurité (${G.t})`);
  assert.equal(G.mule.load, 0, 'sac vidé');
  assert.ok((G.chest['Fer'] || 0) >= before + 7, `coffre : ${G.chest['Fer']}`);
  assert.ok((G.summary.shares[0].bag['Fer'] || 0) >= 7);
  assert.deepEqual(G.summary.lostBags, []);
  assert.ok(G.log.some(l => /ramasse son sac/.test(l.msg)), 'ramassage au journal');
});

test('minerai rare d\'une petite carte : nombre de cases arrondi au hasard en prison (moyenne exacte), au plus proche en mine (30/10/2026)', async () => {
  const { fillComp } = await import('../src/sim/world.js');
  const { mulberry32: rng } = await import('../src/core/rng.js');
  const comp = { stone: 69.976, coal: 30, cobalt: 0.024, air: 0 };   // 0,024 % de 25 × 50 = 0,3 case de cobalt
  assert.equal(fillComp(rng(1), comp, 25, 50).counts.cobalt, 0, 'mine : arrondi au plus proche, jamais de cobalt');
  let n = 0; const N = 2000, frac = rng(7);
  for(let i = 0; i < N; i++){ const c = fillComp(rng(i), comp, 25, 50, frac).counts; assert.ok(c.cobalt === 0 || c.cobalt === 1); assert.equal(Object.values(c).reduce((s, v) => s + v, 0), 1250); n += c.cobalt; }
  assert.ok(Math.abs(n / N - 0.3) < 0.04, `prison : ${n / N} case de cobalt par carte en moyenne (0,3 attendu)`);
});
