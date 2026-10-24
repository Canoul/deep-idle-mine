/* Donjon (areas 4 et 5, 33 % chacune) : génération, minotaure enfermé, déclencheur, barbare d'abord, Fuir, effroi, butin. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, AREA_H, DUNGEON, DUNGEON_WALL, BLOCKS, IDS, XP, SHARE, ITEMS, WINCH, CHEST_X, PREF_OPTIONS } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { genArea, areaTop } from '../src/sim/world.js';
import { search } from '../src/sim/path.js';
import { planDungeon, addDungeon, inRoom, interior, noEntry, mayEnter } from '../src/sim/dungeon.js';
import { killMob } from '../src/sim/actions.js';
import { shareChest } from '../src/meta/share.js';
import { sanitizePrefs } from '../src/shared/game.js';
import { rarityOf } from '../src/meta/rarity.js';
import { worldFrom, run } from './helpers.js';

const S = DUNGEON.size;
const seedWith = (want=true, from=1) => { let s=from; while(!!planDungeon(s,5)!==want) s++; return s; };
function upTo5(seed){ const G=newSession(seed); for(let k=1;k<=5;k++) genArea(G,k); G.unlockedAreas=6; return G; }

/* mine de pierre ; un donjon (entrée à droite, ligne 13) ; une galerie de la sortie (x 15) jusqu'à x 34, sol en pierre */
function scene({ miners=1, trees=[], prefs=[] }={}){
  const rows=['', ...Array(24).fill('#'.repeat(W))];
  const G=worldFrom(rows, { miners });
  const d=addDungeon(G, { x0:5, y0:6, side:'R', hy:13 });
  for(let x=15;x<=34;x++) G.tiles[13][x]=0;
  G.miners.forEach((m,i) => { m.x=34-2*i; m.y=13; m.skillTree=trees[i] ?? null; Object.assign(m.prefs, prefs[i] ?? {}); m.ox=1e9; m.carac.oxygenMax=1e9; });
  return { G, d, boss:G.mobs.find(o=>o.id===d.boss) };
}

/* ---------- génération ---------- */

test('donjon : ~33 % des seeds, en areas 4 et 5 seulement, tirages indépendants', () => {
  assert.equal(DUNGEON.chance, 0.33);
  for(const k of [4,5]){
    let n=0; for(let s=1;s<=3000;s++) if(planDungeon(s,k)) n++;
    assert.ok(n>3000*0.30 && n<3000*0.36, `area ${k} : taux ${n/3000}`);
  }
  let both=0; for(let s=1;s<=3000;s++) if(planDungeon(s,4) && planDungeon(s,5)) both++;
  assert.ok(both>3000*0.08 && both<3000*0.14, `les deux : ${both/3000}`);   // ~11 % si indépendants
  for(let s=1;s<=300;s++) for(const k of [0,1,2,3,6,7]) assert.equal(planDungeon(s,k), null);
});

test('donjon : carré 10×10 de briques incassables, intérieur vide, une seule entrée sur un côté, minotaure dedans', () => {
  for(const seed of [seedWith(), seedWith(true, 500), seedWith(true, 9000)]){
    const G=upTo5(seed), d=G.dungeons.find(o=>o.k===5), top=areaTop(5);
    assert.ok(BLOCKS[DUNGEON_WALL].unbreakable);
    let holes=0;
    for(let y=d.y0;y<d.y0+S;y++) for(let x=d.x0;x<d.x0+S;x++){
      const wall = x===d.x0||x===d.x0+S-1||y===d.y0||y===d.y0+S-1, t=G.tiles[y][x];
      if(!wall) assert.equal(t, 0, 'intérieur vide');
      else if(t===0){ holes++; assert.ok(x===d.hx && y===d.hy); }
      else assert.equal(t, DUNGEON_WALL);
    }
    assert.equal(holes, 1);
    assert.ok(d.hx===d.x0 || d.hx===d.x0+S-1, 'entrée dans le mur de gauche ou de droite');
    assert.ok(d.hy>=d.y0+S-1-DUNGEON.holeRows && d.hy<=d.y0+S-2, 'entrée en bas de l\'intérieur (on y entre en marchant)');
    /* jamais contre un bord ni sur la colonne du treuil ± 5 */
    assert.ok(d.x0>=2 && d.x0+S-1<=W-3);
    assert.ok(d.y0>=top+2 && d.y0+S-1<=top+AREA_H-3);
    for(let x=d.x0;x<d.x0+S;x++) assert.ok(Math.abs(x-WINCH.x)>DUNGEON.winchGap, `colonne ${x}`);
    const boss=G.mobs.find(o=>o.id===d.boss);
    assert.equal(boss.type, 'minotaure'); assert.equal(boss.hp, 1000);
    assert.ok(interior(d,boss.x,boss.y)); assert.equal(G.tiles[boss.y+1][boss.x], DUNGEON_WALL, 'il est posé sur le sol');
    /* les comptes de l'area suivent ce qui reste vraiment dans la roche */
    const real={}; for(let y=top;y<top+AREA_H;y++) for(const t of G.tiles[y]) if(BLOCKS[t]?.type==='ore'){ const k=Object.keys(IDS).find(n=>IDS[n]===t); real[k]=(real[k]||0)+1; }
    for(const [k,o] of Object.entries(G.areas[5].ores)) assert.equal(o.total, real[k] ?? 0, k);
    assert.equal(G.areas[5].oreTotal, Object.values(real).reduce((a,b)=>a+b,0));
  }
});

test('donjon : même seed, mêmes donjons (un en area 4, un en area 5)', () => {
  const s=seedWith();
  assert.deepEqual(upTo5(s).dungeons, upTo5(s).dungeons);
  assert.deepEqual(upTo5(s).dungeons.map(d=>d.k).sort(), [4,5]);
});

/* ---------- déclencheur, entrée ---------- */

test('déclencheur : voir un bloc du donjon le rend « découvert » (avant : aucune restriction)', () => {
  const { G, d } = scene();
  for(let y=d.y0;y<d.y0+S;y++) for(let x=d.x0;x<d.x0+S;x++) G.seen[y][x]=0;
  const m=G.miners[0];
  assert.equal(noEntry(G,m,d.hx,d.hy), false, 'pas encore découvert');
  G.seen[d.y0][d.x0]=1; run(G,1);
  assert.equal(d.found, true);
  assert.ok(G.log.some(l=>String(l.msg).includes('donjon est découvert')));
  assert.equal(noEntry(G,m,d.hx,d.hy), true, 'sans barbare : interdit');
});

test('un mineur entre dans le donjon : toute la structure est découverte d\'un coup (23/10 soir)', () => {
  const { G, d } = scene();
  const hidden = () => { let n=0; for(let y=d.y0;y<d.y0+S;y++) for(let x=d.x0;x<d.x0+S;x++) if(!G.seen[y][x]) n++; return n; };
  for(let y=d.y0;y<d.y0+S;y++) for(let x=d.x0;x<d.x0+S;x++) G.seen[y][x]=0;
  const m=G.miners[0];
  m.x=d.hx; m.y=d.hy; m.action={ type:'wait', dur:1e9, t:0, data:{} };   // sur le seuil (l'entrée) : pas encore dedans
  run(G,1);
  assert.ok(hidden() > 0, 'sur le seuil, rien de plus');
  m.x=d.hx-1; run(G,1);                                                     // un pas : dans la salle
  assert.equal(hidden(), 0, 'murs, intérieur et boss découverts');
  assert.equal(d.revealed, true);
});

test('sans barbare : personne n\'entre, aucun itinéraire ne passe par le donjon', () => {
  const { G, d } = scene({ miners:3 });
  run(G,1);
  for(const m of G.miners){
    assert.equal(mayEnter(G,m,d), false);
    assert.equal(search(G,m,m.x,m.y,true,(x,y)=>inRoom(d,x,y)), null);
  }
  run(G,1200);
  for(let i=0;i<600;i++){ run(G,1); for(const m of G.miners) assert.ok(!inRoom(d,m.x,m.y), `${m.name} est entré`); }
});

test('avec un barbare : les autres attendent devant l\'entrée, le barbare entre le premier, puis ils le rejoignent', () => {
  const { G, d, boss } = scene({ miners:3, trees:['mineur','barbare','logisticien'] });
  const barb=G.miners[1];
  let waited=false, firstIn=null;
  for(let i=0;i<6000 && boss.hp>0;i++){
    run(G,1);
    for(const m of G.miners) if(interior(d,m.x,m.y) && !firstIn) firstIn=m;
    if(!d.barbIn) for(const m of G.miners) if(m!==barb) assert.ok(!inRoom(d,m.x,m.y), `${m.name} entre avant le barbare`);
    if(!d.barbIn && G.miners.some(m=>m.status==='Attend le barbare devant le donjon')) waited=true;
  }
  assert.ok(waited, 'quelqu\'un a attendu devant l\'entrée');
  assert.equal(firstIn, barb);
  assert.ok(d.barbIn);
  assert.ok(boss.hp<=0, 'minotaure vaincu');
  assert.ok(G.stats.kills>=1);
});

test('avec un barbare : « Fuir » attend avec les autres mais n\'entre jamais', () => {
  const { G, d, boss } = scene({ miners:2, trees:['barbare', null], prefs:[{}, { fightMobs:'flee' }] });
  const runner=G.miners[1];
  let checked=false;
  for(let i=0;i<6000 && boss.hp>0;i++){
    run(G,1); assert.ok(!inRoom(d,runner.x,runner.y), 'Fuir est entré');
    if(d.barbIn && boss.hp>0 && !checked){ assert.equal(mayEnter(G,runner,d), false); checked=true; }
  }
  assert.ok(d.barbIn && checked);
  assert.ok(boss.hp<=0, 'le barbare l\'a vaincu seul');
  assert.ok(PREF_OPTIONS.fightMobs.options.some(o=>o[0]==='flee'));
  assert.equal(sanitizePrefs({ fightMobs:'flee' }).fightMobs, 'flee');
});

/* ---------- minotaure ---------- */

test('minotaure : il reste enfermé dans sa salle et ne vise que ceux qui y sont', () => {
  const { G, d, boss } = scene({ miners:1, trees:['mineur'] });
  G.miners[0].x=15; G.miners[0].y=13;                       // juste devant l'entrée, dehors
  for(let i=0;i<3000;i++){ run(G,1); assert.ok(interior(d,boss.x,boss.y)); assert.equal(boss.grab ?? null, null); }
});

test('effroi : sans barbare, un mineur dans le donjon est effrayé 15 s ; attaqué, il s\'enfuit à la surface avec son sac', () => {
  const { G, d, boss } = scene();
  const m=G.miners[0];
  m.x=boss.x+3; m.y=boss.y; m.inv={ Fer:4 }; m.load=12;
  run(G,1);
  assert.ok(m.scaredUntil>G.t && m.scaredUntil<=G.t+DUNGEON.scaredTime);
  boss.x=m.x-1;                                               // le minotaure arrive sur lui
  run(G,2);
  assert.equal(m.y, 0); assert.equal(m.x, CHEST_X);
  assert.deepEqual(m.inv, { Fer:4 }, 'il garde ce qu\'il porte');
  assert.equal(m.stats.fled, 1);
  assert.ok(interior(d,boss.x,boss.y));
});

test('effroi passé : il sort du donjon tout seul ; taclé, il se bat (le tacle oblige)', () => {
  { const { G, d, boss } = scene();
    const m=G.miners[0];
    m.x=boss.x+3; m.y=boss.y; run(G,1);
    m.scaredUntil=0; boss.cd=1e9;                              // le minotaure ne bouge pas
    for(let i=0;i<900 && inRoom(d,m.x,m.y);i++) run(G,1);
    assert.ok(!inRoom(d,m.x,m.y), 'il est ressorti'); }
  { const { G, d, boss } = scene();
    const m=G.miners[0];
    m.x=boss.x+1; m.y=boss.y; m.scaredIn=d.id; m.scaredUntil=0;   // déjà là depuis plus de 15 s
    run(G,100);
    assert.equal(boss.grab, m.id); assert.ok(boss.hp<1000, 'il le frappe'); assert.ok(m.y>0, 'pas de fuite hors effroi'); }
});

/* ---------- butin ---------- */

test('minotaure vaincu : 1 à 3 Cristaux de pleine lune (rare), 100 XP, donjon libéré', () => {
  const seen=new Set();
  for(let s=1;s<=60;s++){
    const { G, d, boss } = scene();
    G.rng=(r=>()=>r)(((s*0.137)%1));
    const m=G.miners[0]; m.inv={}; m.load=0;
    killMob(G,m,boss);
    const n=m.inv[DUNGEON.loot.item]; seen.add(n);
    assert.ok(n>=1 && n<=3);
    assert.equal(G.stats.xp, XP.mob.minotaure);
    run(G,1); assert.ok(d.cleared); assert.equal(noEntry(G,m,d.hx,d.hy), false);
  }
  assert.deepEqual([...seen].sort(), [1,2,3]);
  assert.equal(XP.mob.minotaure, 100);
  assert.equal(rarityOf(DUNGEON.loot.item), 'rare');
  assert.ok(ITEMS[DUNGEON.loot.item]);
});

test('cristaux : pas partagés, chaque joueur présent en reçoit la quantité entière (comme un Treasure TX)', () => {
  assert.ok(SHARE.copyToAll.includes(DUNGEON.loot.item));
  const bags=shareChest({ [DUNGEON.loot.item]:2, Charbon:10 }, 3, 42);
  assert.deepEqual(bags.map(b=>b[DUNGEON.loot.item]), [2,2,2]);
  assert.equal(bags.reduce((s,b)=>s+b.Charbon,0), 10);
});
