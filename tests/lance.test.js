/* Lance en fer (25/10/2026) : variante de l'épée qui tue moins vite mais fait lâcher son tacle au mob en le
   repoussant ; stats Portée d'attaque et Recul ; verrou qui empêche de repousser un mob en boucle. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, COMBAT, STUFF, LOOT, ITEMS, STATS } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { equippedStats, statLines } from '../src/meta/stuff.js';
import { reachOf, knockbackOf } from '../src/sim/knock.js';
import { tackler } from '../src/sim/ai.js';
import { worldFrom, run } from './helpers.js';

const corridor = () => {
  const G = worldFrom(['', 'd'.repeat(W), '#@' + ' '.repeat(40) + '#', '#'.repeat(W)]);
  for(let x = 0; x < W; x++){ G.tiles[1][x] = 11; G.tiles[3][x] = 11; }   // incassable : il ne peut que se battre
  const m = G.miners[0]; m.ox = 1e9; m.carac.oxygenMax = 1e9;
  return { G, m };
};
const lance = (m, extra = {}) => { Object.assign(m.carac, equippedStats(['Lance en fer'])); for(const k in extra) m.carac[k] += extra[k]; };

test('Lance en fer : case épée, dégâts +8, vitesse d\'attaque −10 %, recul +0,5, portée +0,25 ; BP 2 % dans le Treasure T1', () => {
  assert.equal(STUFF.items['Lance en fer'].slot, 'epee');
  assert.deepEqual(STUFF.items['Lance en fer'].stats, { damage:8, attackSpeed:-10, knockback:0.5, reach:0.25 });
  assert.ok(RECIPES['Lance en fer'] && RECIPES['Lance en fer'].unlock === 'Lance en fer BP');
  const bp = LOOT['Treasure T1'].oneOf.find(f => f.family === 'blueprint').items.find(i => i.item === 'Lance en fer BP');
  assert.equal(bp.chance, 0.02);
  assert.equal(ITEMS['Lance en fer BP'].cat, 'blueprint');
  assert.equal(STATS.reach, 0); assert.equal(STATS.knockback, 0);
  const st = equippedStats(['Lance en fer']);
  assert.deepEqual([st.damage, st.attackSpeed], [13, 90]);
  assert.deepEqual([reachOf({ carac:st }), knockbackOf({ carac:st })], [COMBAT.reach + 0.25, COMBAT.knock + 0.5]);
  assert.deepEqual(statLines('Lance en fer'), ['Dégâts +8', 'Vitesse d\'attaque −10 %', 'Recul +0,5 bloc', 'Portée d\'attaque +0,25 bloc']);
});

test('Lance : depuis le contact, son coup repousse le mob hors de sa portée de tacle : il lâche, revient, et retacle', () => {
  const { G, m } = corridor(); lance(m);
  const o = { id:G.mobId++, type:'bestiole', x:m.x + 1, y:m.y, hp:1e9, maxhp:1e9, cd:0 };
  G.mobs.push(o);
  m.action = { type:'wait', dur:0.15, t:0, data:{} };   // il est taclé avant de pouvoir frapper
  run(G, 1); assert.equal(tackler(G, m), o, 'taclé au contact');
  let freed = false, back = false;
  for(let i = 0; i < 60; i++){ run(G, 1); if(!tackler(G, m)) freed = true; else if(freed) back = true; }
  assert.ok(freed, 'repoussé à 0,75 : il lâche le tacle');
  assert.ok(back, 'il revient et retacle');
});

test('Lance : même avec +300 % de vitesse d\'attaque, le mob finit toujours par retacler (pas de boucle de recul)', () => {
  const { G, m } = corridor(); lance(m, { attackSpeed:300 });
  const o = { id:G.mobId++, type:'bestiole', x:m.x + 4, y:m.y, hp:1e9, maxhp:1e9, cd:0, speed:0.5 };   // mob lent : le pire cas
  G.mobs.push(o);
  let grabs = 0, was = false;
  for(let i = 0; i < 300; i++){ run(G, 1); const g = !!tackler(G, m); if(g && !was) grabs++; was = g; }
  assert.ok(grabs >= 3, `il retacle à chaque cycle (${grabs} tacles en 30 s)`);
});
