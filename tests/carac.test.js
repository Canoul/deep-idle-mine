/* Caractéristiques du mineur en session : stats de base + bonus du stuff porté au lancement (par mineur). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../src/config.js';
import { statsOf, equippedStats } from '../src/meta/stuff.js';
import { buildSession, applyOverrides } from '../src/shared/game.js';
import { tick } from '../src/sim/session.js';
import { mineT, baseMineT } from '../src/sim/miner.js';
import { createViewer, emptyView, applyView } from '../src/shared/view.js';

const rec = looks => ({ id:'S', seed:4242, players:[{ account:'A', name:'Ana' }, { account:'B', name:'Bob' }], looks });

test('caractéristiques : base + somme des bonus des pièces', () => {
  const c = equippedStats(['Casque en chitine', 'Plastron en chitine', 'Pioche en pierre', 'Bottes en chitine', 'Jambes en chitine']);
  assert.equal(c.oxygenMax, STATS.oxygenMax + 30);
  assert.equal(c.pods, STATS.pods + 25);
  assert.equal(c.mineSpeed, 1.1);
  assert.equal(c.speed, STATS.speed + 0.5);
  assert.equal(c.climbSpeed, 2.65);                       // arrondi au centième
  assert.equal(c.damage, STATS.damage);                   // rien ne touche aux dégâts
  assert.deepEqual(equippedStats([]), { ...STATS });       // sans stuff : les stats de base
  assert.deepEqual(equippedStats(['Objet inconnu']), { ...STATS });
  assert.deepEqual(statsOf(['Plastron en chitine']).pods, { base:STATS.pods, bonus:25, total:STATS.pods + 25 });
});

test('en session : chaque mineur a les caractéristiques de SON stuff', () => {
  const G = buildSession(rec({ A:{ torse:'Plastron en chitine', casque:'Casque en chitine' }, B:{ pioche:'Pioche en pierre' } }));
  const [a, b] = G.miners;
  assert.equal(a.carac.pods, STATS.pods + 25);
  assert.equal(a.carac.oxygenMax, STATS.oxygenMax + 30);
  assert.equal(a.ox, STATS.oxygenMax + 30);               // part avec son oxygène max
  assert.equal(b.carac.pods, STATS.pods);
  assert.equal(b.carac.mineSpeed, 1.1);
  assert.ok(Math.abs(baseMineT(b, 2) - baseMineT(a, 2) / 1.1) < 1e-12);   // la pioche en pierre mine plus vite
  assert.ok(mineT(G, b, 2) < mineT(G, a, 2));
});

test('en session : une pièce dans la mauvaise case ne donne rien (revérifié)', () => {
  const G = buildSession(rec({ A:{ pioche:'Plastron en chitine' } }));
  assert.equal(G.miners[0].carac.pods, STATS.pods);
});

test('en session : le stuff change la partie (plus de pods = moins d\'allers-retours forcés)', () => {
  const run = looks => { const G = buildSession({ ...rec(looks), players:[{ account:'A', name:'Ana' }] }); while(G.ticks < 9000) tick(G); return G; };
  const base = run({}), big = run({ A:{ torse:'Plastron en chitine' } });
  assert.notDeepEqual(base.chest, big.chest);
  assert.ok(big.miners[0].stats.maxDepth >= 1);
});

test('mode dev : les réglages des stats s\'ajoutent au stuff', () => {
  applyOverrides({ STATS:{ pods:500 } });
  try {
    const G = buildSession(rec({ A:{ torse:'Plastron en chitine' } }));
    assert.equal(G.miners[0].carac.pods, 525);
    assert.equal(G.miners[1].carac.pods, 500);
  } finally { applyOverrides(null); }
  assert.equal(STATS.pods, 200);
});

test('affichage : le navigateur reçoit l\'oxygène max et les pods de chaque mineur', () => {
  const G = buildSession(rec({ A:{ torse:'Plastron en chitine' } }));
  const M = applyView(emptyView(), createViewer(G)(null), 0);
  assert.equal(M.miners[0].carac.pods, STATS.pods + 25);
  assert.equal(M.miners[1].carac.oxygenMax, STATS.oxygenMax);
});
