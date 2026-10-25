/* Piège (22/10) : tirage (à partir de l'area 1, 2 tirages de 25 %), salle cachée, déclenchement en retirant un bloc de
   paroi, 5 mobs boostés qui chassent le mineur, hors plafond de mobs, barbare à la rescousse. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, AREA_H, CFG, DT, TRAP, DUNGEON, WINCH, IDS, MOBS, mobHp } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { genArea, areaTop } from '../src/sim/world.js';
import { planDungeon } from '../src/sim/dungeon.js';
import { planTraps, addTrap, trapTable, inTrapRoom, isTrapWall } from '../src/sim/trap.js';
import { updateLight } from '../src/sim/light.js';
import { worldFrom, run } from './helpers.js';

const OW = TRAP.w+2, OH = TRAP.h+2;
const busy = m => { m.action = { type:'wait', dur:1e9, t:0, data:{} }; };

/* mine de pierre ; un piège (paroi x 20-26, y 8-12 ; salle x 21-25, y 9-11) ; une galerie y 11 (au niveau du sol de
   la salle) de x 2 à 19, contre la paroi gauche ; les mineurs au bout de la galerie, une torche à côté */
function scene({ miners=1, mobs } = {}){
  const rows = ['', 'd'.repeat(W), ...Array(20).fill('#'.repeat(W))];
  const G = worldFrom(rows, { miners });
  const t = addTrap(G, { x0:20, y0:8, ...(mobs ? { mobs } : {}) });
  for(let x=2; x<=19; x++) G.tiles[11][x] = 0;
  G.miners.forEach(m => { m.x=19; m.y=11; m.ox=1e9; m.carac.oxygenMax=1e9; });
  G.torches.push({ x:18, y:11 }); updateLight(G);
  return { G, t, m:G.miners[0] };
}
const breach = (G, x=20, y=11) => { G.tiles[y][x] = 0; updateLight(G); tick(G); };

/* ---------- tirage et génération ---------- */

test('tirage : jamais avant l\'area 1 ; 0 à 2 pièges par area, environ 0,5 en moyenne (2 tirages de 25 %)', () => {
  for(let s=1; s<=200; s++) assert.deepEqual(planTraps(s, 0), []);
  let n=0, two=0; const N=2000;
  for(let s=1; s<=N; s++){ const p=planTraps(s, 2); assert.ok(p.length<=TRAP.tries); n+=p.length; if(p.length===2) two++; }
  assert.ok(Math.abs(n/N - TRAP.tries*TRAP.chance) < 0.06, `moyenne ${n/N}`);
  assert.ok(two/N > 0.03 && two/N < 0.1, `deux pièges : ${two/N}`);
});

test('tirage : 5 mobs de la table de l\'area, jamais de mimic ; placement dans les marges, loin du treuil, du donjon et l\'un de l\'autre', () => {
  assert.equal(trapTable(1).mimic, undefined); assert.ok(trapTable(1).gobelin > 0);
  assert.equal(trapTable(3).occultiste, undefined, 'occultiste seulement à partir de l\'area 4');
  for(let s=1; s<=400; s++) for(const k of [1, 4, 5]){
    const d = planDungeon(s, k), ps = planTraps(s, k, d);
    for(const p of ps){
      assert.equal(p.mobs.length, TRAP.mobs);
      for(const ty of p.mobs) assert.ok(ty in trapTable(k), `${ty} en area ${k}`);
      assert.ok(p.x0 >= TRAP.margin && p.x0+OW-1 <= W-1-TRAP.margin);
      assert.ok(p.ry0 >= TRAP.margin && p.ry0+OH-1 <= AREA_H-1-TRAP.margin);
      assert.ok(p.x0+OW-1 < WINCH.x-TRAP.winchGap || p.x0 > WINCH.x+TRAP.winchGap, 'colonne du treuil');
      if(d) assert.ok(p.x0+OW < d.x0 || d.x0+DUNGEON.size < p.x0 || p.ry0+OH < d.ry0 || d.ry0+DUNGEON.size < p.ry0, `seed ${s} : contre le donjon`);
    }
    if(ps.length===2){ const [a,b]=ps; assert.ok(a.x0+OW < b.x0 || b.x0+OW < a.x0 || a.ry0+OH < b.ry0 || b.ry0+OH < a.ry0, 'deux pièges collés'); }
  }
});

test('génération : salle vide, paroi pleine (blocs de l\'area), intérieur caché, comptes de l\'area justes', () => {
  let seed=1; while(planTraps(seed, 2).length!==2) seed++;
  const G = newSession(seed); genArea(G,1); genArea(G,2);
  const ts = G.traps.filter(t => t.k===2);
  assert.equal(ts.length, 2);
  for(const t of ts){
    for(let y=t.y0; y<t.y0+OH; y++) for(let x=t.x0; x<t.x0+OW; x++){
      if(inTrapRoom(t,x,y)){ assert.equal(G.tiles[y][x], 0); assert.ok(G.veil.has(y*W+x)); }
      else { assert.ok(isTrapWall(t,x,y)); assert.notEqual(G.tiles[y][x], 0, `trou dans la paroi (${x},${y})`); }
    }
    assert.equal(t.sprung, false);
    for(const s of t.mobs) assert.equal(s.hp, Math.round(mobHp(s.type, 2)*TRAP.hpMul));
  }
  assert.equal(G.mobs.length, 0, 'aucun mob dans la mine avant le déclenchement');
  const a = G.areas[2], top = areaTop(2), seen = {};
  for(let y=top; y<top+AREA_H; y++) for(let x=0; x<W; x++){ const t=G.tiles[y][x]; seen[t]=(seen[t]||0)+1; }
  for(const n in a.counts) if(a.counts[n] && IDS[n]!==undefined) assert.equal(a.counts[n], seen[IDS[n]] ?? 0, `compte ${n}`);
});

/* ---------- caché, puis déclenché ---------- */

test('caché : le mineur découvre la paroi mais jamais la salle, même éclairé juste à côté', () => {
  const { G, t, m } = scene(); busy(m); m.carac.discoverMax = 10;
  for(const row of G.seen) row.fill(0);
  run(G, 5);
  assert.equal(G.seen[11][20], 1, 'la paroi se découvre comme de la roche');
  for(let y=9; y<=11; y++) for(let x=21; x<=25; x++) assert.equal(G.seen[y][x], 0, `case (${x},${y}) découverte`);
  assert.equal(t.sprung, false); assert.equal(G.mobs.length, 0);
});

test('déclenché : un bloc de paroi retiré → tout se dévoile, 5 mobs (PV ×1,5) chassent le mineur', () => {
  const { G, t, m } = scene(); busy(m);
  for(const row of G.seen) row.fill(0);
  breach(G);
  assert.equal(t.sprung, true); assert.equal(t.by, m.id);
  for(let y=8; y<=12; y++) for(let x=20; x<=26; x++) assert.equal(G.seen[y][x], 1);
  assert.equal(G.veil.size, 0);
  assert.equal(G.mobs.length, TRAP.mobs);
  for(const o of G.mobs){
    assert.equal(o.hp, Math.round(mobHp('bestiole', 1)*TRAP.hpMul)); assert.equal(o.speed, TRAP.speedMul);
    assert.equal(o.hunt, m.id); assert.ok(inTrapRoom(t, o.x, o.y));
  }
  assert.ok(G.log.some(l => /piège/.test(l.msg ?? l)), 'message dans le journal');
  run(G, 30);
  assert.ok(G.mobs.some(o => o.grab===m.id), 'un mob l\'a taclé');
});

test('physique normale : un trou en hauteur dans la paroi, les mobs restent dans la salle (ils ne grimpent pas)', () => {
  const { G, t, m } = scene(); busy(m);
  G.tiles[10][19] = 0; m.y = 10; G.tiles[11][19] = IDS.stone;   // le mineur est une case plus haut que le sol de la salle
  breach(G, 20, 10);
  assert.equal(t.sprung, true);
  run(G, 100);
  assert.ok(G.mobs.every(o => inTrapRoom(t,o.x,o.y) || (o.x===20 && o.y===11)), 'aucun mob dehors');
  assert.ok(!G.mobs.some(o => o.grab===m.id), 'personne ne le tacle');
});

test("mobs coincés dans la salle, hors d'atteinte : le mineur (Combattre) les laisse tout de suite au lieu d'attendre", () => {
  const { G, t, m } = scene();
  for(let x=2; x<=24; x++) G.tiles[7][x] = 0;   // galerie au-dessus du piège ; il se tient sur la paroi du haut
  m.x = 23; m.y = 7; m.prefs.fightMobs = true; G.torches.push({ x:22, y:7 });
  breach(G, 21, 8);   // trou dans la paroi du haut : la salle est 3 cases plus bas, il ne saute pas
  assert.equal(t.sprung, true);
  run(G, 50);
  assert.equal(G.mobs.filter(o => o.trap===t.id && m.ignored.has(o.id)).length, TRAP.mobs, 'les 5 mobs laissés en 5 s');
  assert.ok(!/Combat/.test(m.status), m.status);
});

test('déclenché : un mimic tué dans la paroi (case vidée) déclenche aussi ; une seule fois', () => {
  const { G, t, m } = scene(); busy(m);
  breach(G, 23, 8);
  assert.equal(t.sprung, true);
  const n = G.mobs.length; G.tiles[12][22]=0; tick(G);
  assert.equal(G.mobs.filter(o => o.trap===t.id).length, n, 'pas de seconde vague');
});

test('mobs du piège : vitesse ×1,5 ; ils chassent le mineur visé au-delà de la portée habituelle', () => {
  const G = worldFrom(['', 'd'.repeat(W), '#@'+' '.repeat(45)+'#', '#'.repeat(W)]), m = G.miners[0]; busy(m);
  const far = CFG.mobChaseRange + 6;
  const hunter = { id:G.mobId++, type:'bestiole', x:m.x+far, y:m.y, hp:1e9, maxhp:1e9, cd:0, trap:0, hunt:m.id, speed:TRAP.speedMul };
  const plain  = { id:G.mobId++, type:'bestiole', x:m.x+far, y:m.y, hp:1e9, maxhp:1e9, cd:0 };
  G.mobs.push(hunter, plain);
  let step=null, prev=hunter.cd;
  for(let i=0; i<40; i++){ tick(G); if(hunter.cd > prev) step ??= hunter.cd; prev = hunter.cd; }
  assert.ok(Math.abs(step - CFG.mobStep/TRAP.speedMul) < 1e-9, `pas de ${step} s`);
  assert.ok(hunter.x < m.x+far-3, 'le chasseur avance');
  assert.equal(plain.x, m.x+far, 'un mob ordinaire, trop loin, ne bouge pas');
});

test('mobs du piège : hors du plafond de mobs, et le rythme des apparitions ne change pas', () => {
  const { G, m } = scene(); busy(m);
  const timer = G.spawnTimer;
  breach(G);
  assert.ok(Math.abs(G.spawnTimer - (timer - DT)) < 1e-9, 'le déclenchement ne touche pas au minuteur');
  assert.ok(TRAP.mobs > MOBS.walkerCap(G.unlockedAreas-1));
  G.rng = () => 0; G.spawnTimer = 0;   // apparition forcée : bestiole, première case possible
  tick(G);
  assert.equal(G.mobs.filter(o => o.trap==null).length, 1, 'une bestiole naît malgré les 5 mobs du piège');
});

/* ---------- barbare à la rescousse ---------- */

function rescue(tree){
  const { G, t } = scene({ miners:2 });
  const [alice, bob] = G.miners;
  alice.carac.damage = 0;   // elle ne peut pas s'en sortir seule
  bob.x = 2; bob.skillTree = tree; Object.assign(bob.prefs, { fightMobs:'flee', helpAllies:false });
  busy(alice); busy(bob);
  breach(G); bob.action = null;
  return { G, t, alice, bob };
}

test('barbare : il vient tuer les mobs du piège, même réglé sur Fuir et sans Aider allié', () => {
  const { G, t, alice, bob } = rescue('barbare');
  let went=false;
  for(let i=0; i<60; i++){ tick(G); if(/rescousse|piège/i.test(bob.status)) went=true; }
  assert.ok(went, 'il part à la rescousse');
  assert.ok(bob.x > 6, `il y va (x = ${bob.x})`);
  run(G, 6000);
  assert.ok(bob.stats.kills >= 1, 'il en a tué');
  assert.equal(G.mobs.filter(o => o.trap===t.id && o.hp>0).length, 0, 'tous les mobs du piège sont morts');
});

test('Braum : en route vers le piège, le barbare a son bonus de vitesse', () => {
  const { G, bob } = rescue('barbare');
  bob.skill.braum = 0.3;
  let seen = false;
  for(let i=0; i<60 && !seen; i++){ tick(G); seen = /rescousse|piège/i.test(bob.status) && bob.helping; }
  assert.ok(seen, 'bonus actif pendant la rescousse');
});

test('sans barbare : personne ne vient (Fuir, sans Aider allié)', () => {
  const { G, bob } = rescue(null);
  for(let i=0; i<100; i++){ tick(G); assert.ok(!/rescousse|piège/i.test(bob.status), bob.status); }
  assert.equal(bob.stats.kills, 0);
});

test('barbare juste au-dessus du piège (Combattre) : il ne lâche pas les mobs qu\'il ne peut pas atteindre d\'un pas (25/10)', () => {
  /* il les voit sous lui ; un pas droit vers eux est impossible (paroi puis chute de plus de 3 cases) : avant le 25/10
     il les ignorait pour de bon, et la rescousse les sautait ensuite (seed 23757) */
  const { G, t } = scene({ miners:2 });
  const [alice, bob] = G.miners;
  alice.carac.damage = 0; busy(alice);
  bob.skillTree = 'barbare'; bob.x = 23; bob.y = 7; G.tiles[7][23] = 0;   // debout sur la paroi du plafond
  G.torches.push({ x:23, y:7 }); updateLight(G);
  busy(bob);
  breach(G); bob.action = null;
  const ids = G.mobs.filter(o => o.trap===t.id).map(o => o.id);
  assert.equal(ids.length, TRAP.mobs);
  run(G, 6000);
  assert.equal(ids.filter(id => bob.ignored.has(id)).length, 0, 'il n\'en ignore aucun');
  assert.equal(G.mobs.filter(o => o.trap===t.id && o.hp>0).length, 0, 'tous les mobs du piège sont morts');
  assert.ok(bob.stats.kills >= 1, 'le barbare en a tué');
});
