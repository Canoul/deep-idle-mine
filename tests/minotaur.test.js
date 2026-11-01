/* Minotaure : Charge et Rage (MINOTAUR en config, src/sim/minotaur.js ; 30/10/2026, Jules) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, DT, MINOTAUR, MOBS } from '../src/config.js';
import { addDungeon, interior } from '../src/sim/dungeon.js';
import { landHit, hitDamage } from '../src/sim/actions.js';
import { mobEffects } from '../src/sim/effects.js';
import { rageHit, variantOf } from '../src/sim/minotaur.js';
import { worldFrom, run } from './helpers.js';

const C = MINOTAUR.charge;
const ticks = s => Math.round(s/DT);

/* mine de pierre ; un donjon 10 × 10 (x 5-14, y 6-15, entrée à droite ligne 13) ; minotaure au sol (y 14) contre le
   mur de gauche (x 6) ; le mineur (barbare) déjà dans la salle, sur la même ligne, à dist cases à droite du boss */
function scene({ dist=3, tenacity=0, variant } = {}){
  const rows=['', ...Array(24).fill('#'.repeat(W))];
  const G=worldFrom(rows, { miners:1 });
  const d=addDungeon(G, { x0:5, y0:6, side:'R', hy:13 });
  const boss=G.mobs.find(o=>o.id===d.boss); if(variant) boss.variant=variant;
  boss.x=d.x0+1;
  const m=G.miners[0];
  m.skillTree='barbare'; m.ox=1e9; m.carac.oxygenMax=1e9; m.carac.tenacity=tenacity;
  m.x=boss.x+dist; m.y=boss.y;
  run(G,1);
  return { G, d, boss, m };
}
/* jusqu'à ce que la charge commence (il gratte le sol) */
const untilWindup = (G, boss, max=ticks(C.first+2)) => { for(let i=0;i<max && boss.charge?.phase!=='windup';i++) run(G,1); };

test('charge : après first s de combat, il gratte le sol windup s sans frapper, puis encorne : projeté et étourdi', () => {
  const { G, boss, m } = scene();
  untilWindup(G, boss);
  assert.equal(boss.charge?.phase, 'windup', 'il prépare sa charge');
  assert.ok(G.t <= C.first+1.5, `charge au bout de ${G.t} s`);
  assert.ok(mobEffects(G, boss).includes('charge'), 'état « Charge » visible');
  const x0=boss.x, knocked=m.stats.knocked||0;
  run(G, ticks(C.windup)-1);
  assert.equal(boss.charge?.phase, 'windup'); assert.equal(boss.x, x0, 'immobile pendant la préparation');
  assert.equal(m.stats.knocked||0, knocked, 'il ne frappe pas en grattant le sol');
  for(let i=0;i<10 && !m.stats.gored;i++) run(G,1);
  assert.equal(m.stats.gored, 1, 'encorné');
  assert.equal(boss.charge, null, 'la charge s\'arrête sur lui');
  assert.ok(m.x-boss.x>=C.knock, `projeté : mineur en ${m.x}, boss en ${boss.x}`);
  run(G,1);
  assert.equal(m.action?.type, 'stun'); assert.equal(m.action.data.cause, 'gore');
  assert.ok(Math.abs(m.goredUntil-G.t-C.stun)<=0.2+1e-9, `${m.goredUntil-G.t}`);
});

test('charge : la ténacité ignore l\'étourdissement, pas la projection', () => {
  const { G, boss, m } = scene({ tenacity:100 });
  for(let i=0;i<ticks(C.first+C.windup+3) && !m.stats.gored;i++) run(G,1);
  assert.equal(m.stats.gored, 1);
  assert.ok(m.x-boss.x>=C.knock, 'projeté quand même');
  assert.ok(!(m.goredUntil>G.t), 'pas étourdi');
  assert.ok(m.stats.resisted>=1);
});

test('charge : la résistance au recul du mineur réduit la projection', () => {
  const { G, boss, m } = scene();
  m.carac.knockRes=100;
  for(let i=0;i<ticks(C.first+C.windup+3) && !m.stats.gored;i++) run(G,1);
  assert.equal(m.stats.gored, 1);
  assert.ok(m.x-boss.x<=1, `100 % de résistance : il ne bouge pas (${m.x-boss.x})`);
});

test('charge ratée : il percute le mur, sonné missStun s, et prend +50 % de dégâts', () => {
  const { G, d, boss, m } = scene({ dist:3 });
  m.y=boss.y-2;                                      // le mineur n'est pas sur sa ligne (plus bas que lui, impossible : au-dessus)
  boss.charge={ phase:'run', dir:-1, acc:0, ran:0 };  // il fonce vers le mur de gauche
  for(let i=0;i<20 && boss.charge;i++) run(G,1);
  assert.equal(boss.x, d.x0+1, 'arrêté contre le mur');
  assert.ok(interior(d, boss.x, boss.y));
  assert.ok(boss.stunUntil>G.t && boss.exposedUntil>G.t, 'sonné et vulnérable');
  assert.ok(Math.abs(boss.stunUntil-G.t-C.missStun)<=0.2+1e-9);
  assert.ok(mobEffects(G, boss).includes('exposed'));
  m.x=boss.x+1; m.y=boss.y; m.kx=0; m.ky=0;
  const hp=boss.hp; landHit(G, m, boss);
  assert.ok(Math.abs((hp-boss.hp) - hitDamage(G,m)*(1+C.missVuln))<1e-9, `dégâts ${hp-boss.hp}`);
  run(G, ticks(C.missStun)+1);
  const hp2=boss.hp; landHit(G, m, boss);
  assert.ok(Math.abs((hp2-boss.hp) - hitDamage(G,m))<1e-9, 'plus vulnérable après');
});

test('charge : un étourdissement pendant la préparation la coupe (Dash, Main de la justice)', () => {
  const { G, boss } = scene();
  untilWindup(G, boss);
  assert.equal(boss.charge?.phase, 'windup');
  boss.stunUntil=G.t+1;
  run(G,1);
  assert.equal(boss.charge, null, 'charge coupée');
  assert.ok(Math.abs(boss.chargeCd-C.every)<=DT+1e-9, 'le compteur repart');
});

test('charge : le boss du donjon ne sort jamais de sa salle', () => {
  const { G, d, boss } = scene({ dist:2 });
  for(let i=0;i<ticks(60) && boss.hp>0;i++){ run(G,1); assert.ok(interior(d, boss.x, boss.y), `boss en ${boss.x},${boss.y}`); }
  assert.ok(G.miners[0].stats.gored>=2, 'plusieurs charges en une minute');
});

test('rage : sous 33 % de ses PV, il frappe toutes les 0,5 s et repousse de 0,5 ; sa charge revient plus vite', () => {
  const { G, boss } = scene();
  assert.equal(rageHit(boss), null);
  boss.hp=boss.maxhp*0.34; run(G,1); assert.ok(!boss.rage);
  boss.hp=boss.maxhp*0.32; run(G,1);
  assert.ok(boss.rage); assert.ok(mobEffects(G, boss).includes('rage'));
  assert.deepEqual(rageHit(boss), { every:MINOTAUR.rage.hitEvery, knock:MINOTAUR.rage.knock });
  boss.charge={ phase:'run', dir:-1, acc:0, ran:0 }; G.miners[0].y=boss.y-2;
  for(let i=0;i<20 && boss.charge;i++) run(G,1);
  assert.equal(boss.chargeCd, MINOTAUR.rage.chargeEvery);
});

test('variantes : le brun charge sans rage, le noir enrage plus tôt (50 %) et ne charge jamais', () => {
  { const { G, boss } = scene({ variant:'brun' });
    boss.hp=boss.maxhp*0.1; untilWindup(G, boss);
    assert.ok(!boss.rage, 'jamais enragé'); assert.equal(boss.charge?.phase, 'windup', 'il charge'); }
  { const { G, boss, m } = scene({ variant:'noir' });
    run(G, ticks(C.first+C.every+C.windup+2));
    assert.ok(!m.stats.gored && !boss.charge, 'jamais de charge');
    boss.hp=boss.maxhp*0.49; run(G,1);
    assert.ok(boss.rage);
    const r=MINOTAUR.variants.noir.rage;
    assert.deepEqual(rageHit(boss), { every:r.hitEvery, knock:r.knock });
    assert.ok(r.hitEvery<MINOTAUR.rage.hitEvery && r.knock>MINOTAUR.rage.knock, 'plus fort que la rage du donjon'); }
  assert.equal(variantOf({}).name, 'Minotaure', 'sans variante : celui du donjon');
  assert.ok(MOBS.knock.minotaure<MINOTAUR.rage.knock);
});
