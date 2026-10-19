import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDS } from '../src/config.js';
import { compassScan, decide, tackler } from '../src/sim/ai.js';
import { stepDir } from '../src/sim/actions.js';
import { planReturn } from '../src/sim/path.js';
import { worldFrom, run } from './helpers.js';

test('boussole : ne renseigne que la ligne du mineur', () => {
  const G=worldFrom([
    '',
    '##c######',
    '#@  c####',   // mineur ligne 2, charbon ligne 2 (x=4)
    '##c######',
    '#########',
  ]);
  const m=G.miners[0], ores=compassScan(G,m,8);
  assert.deepEqual(ores.map(o=>[o.x,o.y]), [[4,2]]);
});

test('gravité : un mineur au-dessus d\'un trou tombe jusqu\'au sol', () => {
  const G=worldFrom([
    '',
    '##@##',
    '##  #',
    '##  #',
    '#####',
  ]);
  const m=G.miners[0]; m.mode='return';   // peu importe ce qu'il veut faire : la gravité passe d'abord
  decide(G,m);
  assert.equal(m.action.type, 'move'); assert.ok(m.action.data.fall);
  assert.equal(m.action.data.y, 2);
});

test('passerelle : jamais posée depuis le vide', () => {
  const G=worldFrom([
    '',
    '#   #',
    '#   #',
    '#####',
  ]);
  const m=G.miners[0]; m.x=1; m.y=1;          // en l'air (vide dessous, pas d'échelle)
  stepDir(G,m,1,0);
  assert.notEqual(m.action && m.action.type, 'bridge');
});

test('passerelle : posée pour franchir un trou quand il tient debout', () => {
  const G=worldFrom([
    '',
    '#@  #',
    '## ##',   // trou en x=2 sous la case visée
    '## ##',
    '#####',
  ]);
  const m=G.miners[0];
  assert.ok(stepDir(G,m,1,0));
  assert.equal(m.action.type, 'bridge');
  assert.deepEqual([m.action.data.x, m.action.data.y], [2,2]);
});

test('tacle : immobilisé tant que la bestiole n\'est pas morte, même avec « combat » sur non', () => {
  const G=worldFrom([
    '',
    'd'.repeat(50),
    '#@'+' '.repeat(20)+'#',
    '#'.repeat(50),
  ]);
  const m=G.miners[0]; m.prefs.fightMobs=false; m.ox=300;
  G.mobs.push({id:99,type:'bestiole',x:m.x,y:m.y,hp:30,maxhp:30,cd:5});
  const x0=m.x, y0=m.y;
  for(let i=0;i<200 && tackler(G,m);i++){ run(G,1); assert.deepEqual([m.x,m.y],[x0,y0]); }
  assert.equal(tackler(G,m), null, 'il a fini par la tuer');
  assert.equal(G.mobs.filter(o=>o.id===99).length, 0);
});

test('bestiole : ne grimpe pas sans échelle', () => {
  const G=worldFrom([
    '',
    'd'.repeat(50),
    '#'+' '.repeat(10)+'#',   // mineur en haut
    '#'+' '.repeat(10)+'#',
    '#'+' '.repeat(10)+'#',   // bestiole en bas, aucune échelle
    '#'.repeat(50),
  ]);
  const m=G.miners[0]; m.x=5; m.y=2; m.action={type:'wait',dur:1e9,t:0,data:{}};   // le mineur reste sur place
  G.mobs.push({id:7,type:'bestiole',x:5,y:4,hp:30,maxhp:30,cd:0});
  run(G,100);
  assert.equal(G.mobs.find(o=>o.id===7).y, 4);
});

test('retour : préfère marcher jusqu\'à une échelle existante plutôt que d\'en poser de nouvelles', () => {
  // puits avec échelles en x=6 jusqu'à la surface ; le mineur est au fond, 4 cases à gauche
  const G=worldFrom([
    '',
    '######H###',
    '######H###',
    '######H###',
    '######H###',
    '##@   H###',
    '##########',
  ]);
  const m=G.miners[0];
  G.ladder[5][6]=1;
  const p=planReturn(G,m);
  assert.deepEqual([p.dx,p.dy],[1,0], 'premier pas : vers la droite, vers l\'échelle');
});

test('mimic dévoilé hors du champ de vision : il n\'attire pas le mineur', () => {
  const G=worldFrom([
    '',
    'd'.repeat(50),
    '#@'+'#'.repeat(28)+'c',   // mimic dévoilé à 29 cases, derrière la roche
  ]);
  const m=G.miners[0];
  G.mobs.push({id:99, type:'mimic', x:30, y:2, hp:25, maxhp:25, revealed:true, ore:IDS.coal});
  decide(G,m);
  assert.notEqual(m.foe, 99);
  assert.ok(!m.status.startsWith('Combat'), m.status);
});

test('mimic dévoilé juste à côté : le mineur le combat', () => {
  const G=worldFrom([
    '',
    'd'.repeat(50),
    '#@c#',
  ]);
  const m=G.miners[0];
  G.mobs.push({id:99, type:'mimic', x:2, y:2, hp:25, maxhp:25, revealed:true, ore:IDS.coal});
  decide(G,m);
  assert.equal(m.foe, 99);
  assert.equal(m.action.type, 'attack');
});
