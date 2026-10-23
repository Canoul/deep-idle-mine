/* Anti-duplication : le sac de la Mule (src/sim/mule.js) déplace des ressources mineur → sac → coffre.
   Aucune opération ne doit en créer ni en faire disparaître (hors perte prévue : sac pas rapporté en fin de session). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, WINCH } from '../../src/config.js';
import { mulberry32 } from '../../src/core/rng.js';
import { newSession, leaveSession, endSession } from '../../src/sim/session.js';
import { depositToMule, emptyMule, pickMule, placeMule, muleCap, itemW } from '../../src/sim/mule.js';

const NAMES = ['Terre', 'Pierre', 'Charbon', 'Fer', 'Or', 'Diamant', 'Chitine', 'Résidu angélique', 'Tissu sombre'];
const total = G => {   // tout ce qui existe dans la partie : inventaires des mineurs présents + sac + coffre
  const t = {};
  const add = inv => { for(const k in inv) t[k] = (t[k] || 0) + inv[k]; };
  for(const m of G.miners) add(m.inv);
  if(G.mule) add(G.mule.inv);
  add(G.chest);
  return t;
};
const loadOf = inv => Object.entries(inv).reduce((s, [k, n]) => s + n*itemW(k), 0);

test('sac : 2000 suites aléatoires de dépôts, ramassages, poses et vidages ne créent ni ne perdent rien', () => {
  const r = mulberry32(2310);
  for(let run = 0; run < 2000; run++){
    const G = newSession(run, { miners:3 }), [lg] = G.miners;
    lg.skill.winch = 1; lg.skill.mule = 1; lg.carac.pods = 20 + Math.floor(r()*200);
    G.winch = { x:WINCH.x, bottom:10 };
    G.mule = { carrier:lg.id, placed:true, x:WINCH.x + 1, y:10, inv:{}, by:{}, load:0 };
    for(const m of G.miners){ m.inv = {}; for(const k of NAMES) if(r() < 0.5) m.inv[k] = 1 + Math.floor(r()*30); m.load = loadOf(m.inv); }
    const start = total(G);
    for(let step = 0; step < 12; step++){
      const op = r(), m = G.miners[Math.floor(r()*G.miners.length)];
      if(op < 0.55) depositToMule(G, m);
      else if(op < 0.7) pickMule(G, lg);
      else if(op < 0.85 && !G.mule.placed) placeMule(G, lg, WINCH.x + 1, 10);
      else if(!G.mule.placed) emptyMule(G, lg.name);
      /* invariants à chaque pas */
      assert.ok(G.mule.load <= muleCap(G) + 1e-9, 'jamais plus que la capacité');
      assert.ok(Math.abs(G.mule.load - loadOf(G.mule.inv)) < 1e-6, 'poids du sac = son contenu');
      for(const x of G.miners) assert.ok(Math.abs(x.load - loadOf(x.inv)) < 1e-6, 'poids du mineur = son inventaire');
      for(const inv of [G.mule.inv, ...G.miners.map(x => x.inv)])
        for(const k in inv) assert.ok(Number.isSafeInteger(inv[k]) && inv[k] > 0, `quantité entière et positive (${k})`);
      const by = {};
      for(const id in G.mule.by) for(const k in G.mule.by[id]) by[k] = (by[k] || 0) + G.mule.by[id][k];
      assert.deepEqual(by, G.mule.inv, 'qui a déposé quoi = le contenu');
    }
    assert.deepEqual(total(G), start, `conservation (essai ${run})`);
  }
});

test('départ du porteur : le contenu du sac est au coffre une seule fois (quitter deux fois ne double rien)', () => {
  const G = newSession(7, { miners:2 }), [lg, m] = G.miners;
  lg.skill.mule = 1;
  G.mule = { carrier:lg.id, placed:true, x:WINCH.x + 1, y:10, inv:{ 'Or':7 }, by:{ [m.id]:{ 'Or':7 } }, load:28 };
  leaveSession(G, lg); leaveSession(G, lg);
  assert.equal(G.chest['Or'], 7);
  endSession(G); endSession(G);
  const shared = G.summary.shares.reduce((s, x) => s + (x.bag['Or'] || 0), 0);
  assert.ok(shared <= 7, 'le partage ne crée rien');
});

test('fin de session : un sac pas rapporté ne va pas au coffre', () => {
  const G = newSession(8, { miners:1 }), [lg] = G.miners;
  lg.skill.mule = 1;
  G.mule = { carrier:lg.id, placed:true, x:WINCH.x + 1, y:10, inv:{ 'Or':7 }, by:{ [lg.id]:{ 'Or':7 } }, load:28 };
  endSession(G);
  assert.equal(G.summary.chest['Or'] ?? 0, 0);
  assert.equal(G.summary.shares[0].bag['Or'] ?? 0, 0);
  assert.ok(W > 0);
});
