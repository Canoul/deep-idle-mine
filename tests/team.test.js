/* Plusieurs mineurs sur la même carte : coffre commun, réservation des cibles, pas de blocage. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSession, newSession, tick } from '../src/sim/session.js';
import { stuckDetector } from '../src/sim/diagnostics.js';
import { decide } from '../src/sim/ai.js';
import { updateLight } from '../src/sim/light.js';
import { worldFrom } from './helpers.js';

test('3 mineurs : même monde que la partie solo (même seed)', () => {
  assert.deepEqual(newSession(99, {miners:3}).tiles, newSession(99, {miners:1}).tiles);
});

test('réservation : deux mineurs ne visent pas le même minerai', () => {
  const G=worldFrom([
    '',
    'd'.repeat(50),
    '#  @  c  #',     // un seul charbon, deux mineurs côte à côte
    '##########',
  ], { miners:2 });
  const [a,b]=G.miners; b.x=a.x+1;
  for(const m of G.miners){ m.ox=300; m.y=2; }
  G.torches.push({x:5,y:2}); updateLight(G);   // galerie éclairée : sinon leur premier réflexe est de poser une torche
  decide(G,a); decide(G,b);
  assert.deepEqual(a.target, {x:6,y:2}, 'le premier vise le charbon');
  assert.notDeepEqual(b.target, {x:6,y:2}, 'le second ne le vise pas');
});

test('début de partie : les mineurs ne se marchent pas dessus en travaillant', () => {
  let ticks=0, same=0, sumMin=0;
  for(const seed of [7919, 23757]){
    const G=newSession(seed, {miners:3});
    for(let i=0;i<6000;i++){                        // 10 premières minutes
      tick(G);
      // en descente par un puits commun (ou en chute), partager une case est voulu : on ne compte que le travail
      const ms=G.miners.filter(m=>m.y>0 && m.mode!=='return' && !m.goingDown && !m.fall); if(ms.length<2) continue;
      let min=Infinity, s=false;
      for(let a=0;a<ms.length;a++) for(let b=a+1;b<ms.length;b++){
        const d=Math.abs(ms[a].x-ms[b].x)+Math.abs(ms[a].y-ms[b].y); min=Math.min(min,d); if(d===0) s=true; }
      ticks++; sumMin+=min; if(s) same++;
    }
  }
  assert.ok(same/ticks < 0.05, `même case ${(100*same/ticks).toFixed(1)} % du temps`);
  assert.ok(sumMin/ticks > 5, `distance moyenne au plus proche ${(sumMin/ticks).toFixed(1)}`);
});

test('session complète à 3 : aucun blocage, coffre commun = somme des contributions, chacun participe', () => {
  const det=stuckDetector();
  const G=runSession(7919, { miners:3, onTick:det.onTick });
  assert.deepEqual(det.result(), []);
  const sum={};
  for(const id in G.chestBy) for(const k in G.chestBy[id]) sum[k]=(sum[k]||0)+G.chestBy[id][k];
  assert.deepEqual(sum, G.chest);
  for(const m of G.miners){
    assert.ok(m.stats.trips>=8, `${m.name} : ${m.stats.trips} allers-retours`);
    assert.ok(m.stats.ore>=100, `${m.name} : ${m.stats.ore} minerais`);
  }
  assert.ok(G.unlockedAreas-1 >= 3, `areas débloquées : ${G.unlockedAreas-1}`);
});

test('départ du coffre sans treuil : il reprend le puits déjà creusé au lieu d\'en recreuser un près de la surface (seed 1924731460)', () => {
  const fresh = [];
  runSession(1924731460, { miners:3, onTick:G => {
    if(G.t < 300 || G.t > 1200 || G.winch) return;   // après le 1er aller-retour : des puits existent déjà
    for(const m of G.miners)
      if(m.mode === 'work' && m.y > 0 && m.y <= 15 && m.status === 'Creuse vers le bas') fresh.push(`${m.name} t${Math.round(G.t)} x${m.x} y${m.y}`);
  } });
  assert.deepEqual([...new Set(fresh.map(f => f.split(' ')[0]))], [], `puits neufs : ${fresh.slice(0, 3).join(', ')}`);
});
