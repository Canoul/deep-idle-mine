/* Partage du coffre commun en fin de session : parts égales, reste au hasard (seed), Treasure TX pour chacun. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREASURE, MOBS } from '../src/config.js';
const [T1, T2] = TREASURE.tiers.map(t => t.item);
import { shareChest, shareIndexFor } from '../src/meta/share.js';
import { newSession, endSession, leaveSession, tick } from '../src/sim/session.js';

const total = (bags, k) => bags.reduce((n, b) => n + (b[k] || 0), 0);

test('division juste : chacun reçoit exactement sa part', () => {
  const bags = shareChest({ Charbon:99, Fer:30 }, 3, 1);
  for(const b of bags) assert.deepEqual(b, { Charbon:33, Fer:10 });
});

test('reste : rien n\'est perdu, et personne ne reçoit plus d\'une unité en plus', () => {
  for(let seed=1; seed<=50; seed++){
    const bags = shareChest({ Charbon:100, Or:5, Diamant:1, Terre:2 }, 3, seed);
    for(const [k, q] of Object.entries({ Charbon:100, Or:5, Diamant:1, Terre:2 })){
      assert.equal(total(bags, k), q, k+' : rien de perdu');
      const parts = bags.map(b => b[k] || 0);
      assert.ok(Math.max(...parts) - Math.min(...parts) <= 1, k+' : écart d\'au plus 1');
    }
  }
});

test('reste au hasard mais déterministe : même seed = même partage', () => {
  const chest = { Charbon:100, Or:5, Diamant:1 };
  assert.deepEqual(shareChest(chest, 3, 1234), shareChest(chest, 3, 1234));
  assert.deepEqual(shareChest(chest, 3, 1234), shareChest({ Diamant:1, Or:5, Charbon:100 }, 3, 1234), 'l\'ordre des dépôts ne compte pas');
});

test('le reste tombe sur des joueurs différents selon la seed (pas toujours le même)', () => {
  const winners = new Set();
  for(let seed=1; seed<=60; seed++) winners.add(shareChest({ Diamant:1 }, 3, seed).findIndex(b => b.Diamant));
  assert.deepEqual([...winners].sort(), [0, 1, 2]);
});

test('chaque part garde l\'ordre du coffre (ordre d\'arrivée dans l\'inventaire)', () => {
  const bags = shareChest({ Terre:4, Charbon:5, Fer:2 }, 3, 9);
  for(const b of bags) assert.deepEqual(Object.keys(b).filter(k => b[k]), ['Terre','Charbon','Fer'].filter(k => b[k]));
});

test('les Treasure TX ne se partagent pas : chaque joueur reçoit la quantité entière', () => {
  const bags = shareChest({ [T1]:2, Charbon:3 }, 3, 7);
  for(const b of bags) assert.deepEqual(b, { [T1]:2, Charbon:1 });
});

test('solo : le joueur garde tout', () => {
  assert.deepEqual(shareChest({ Charbon:7, [T1]:1, [MOBS.bugItem]:5 }, 1, 3),
    [{ Charbon:7, [T1]:1, [MOBS.bugItem]:5 }]);
});

test('coffre vide ou quantités invalides : parts vides', () => {
  assert.deepEqual(shareChest({}, 3, 1), [{}, {}, {}]);
  assert.deepEqual(shareChest({ Fer:0, Or:-2 }, 2, 1), [{}, {}]);
});

test('fin de session : une part par mineur, rattachée à son compte', () => {
  const G = newSession(42, { miners:3, accounts:['7K3Q-9XHP', 'AAAA-BBBB'] });
  G.chest = { Charbon:10, [T1]:1 };
  endSession(G);
  const s = G.summary.shares;
  assert.deepEqual(s.map(p => p.miner), ['Rouge', 'Bleu', 'Vert']);
  assert.deepEqual(s.map(p => p.account), ['7K3Q-9XHP', 'AAAA-BBBB', null]);
  assert.equal(s.reduce((n, p) => n + p.bag.Charbon, 0), 10);
  assert.ok(s.every(p => p.bag[T1] === 1));
});

test('la part du joueur : celle de son compte, sinon celle du premier mineur', () => {
  const shares = [{ account:'A' }, { account:'B' }, { account:null }];
  assert.equal(shareIndexFor(shares, 'B'), 1);
  assert.equal(shareIndexFor(shares, 'Z'), 0);
  assert.equal(shareIndexFor(shares, null), 0);
});

test('un joueur qui quitte ne reçoit rien ; les présents se partagent tout le coffre', () => {
  const G = newSession(5, { miners:3, accounts:['AAAA', 'BBBB', 'CCCC'] });
  assert.equal(leaveSession(G, 'BBBB'), true);
  G.chest = { Charbon:10, [TREASURE.tiers[0].item]:1 };
  endSession(G);
  const [a, b, c] = G.summary.shares;
  assert.equal(b.left, true);
  assert.deepEqual(b.bag, {});
  assert.equal(a.bag.Charbon + c.bag.Charbon, 10);
  assert.ok(Math.abs(a.bag.Charbon - c.bag.Charbon) <= 1);
  assert.equal(a.bag[TREASURE.tiers[0].item], 1);
  assert.equal(c.bag[TREASURE.tiers[0].item], 1);
});

test('le mineur d\'un joueur parti disparaît de la mine, la session continue sans lui', () => {
  const G = newSession(11, { miners:3, accounts:['AAAA', 'BBBB', 'CCCC'] });
  for(let i=0; i<300; i++) tick(G);
  const blue = G.miners[1];
  leaveSession(G, blue);
  assert.deepEqual(G.miners.map(m => m.name), ['Rouge', 'Vert']);
  assert.equal(G.roster.length, 3);
  for(let i=0; i<3000; i++) tick(G);                  // pas de plantage (IA, mobs, réservations)
  assert.equal(G.over, false);
  assert.ok(G.miners.every(m => m.left == null));
});

test('si tout le monde part, la session s\'arrête et personne ne reçoit rien', () => {
  const G = newSession(3, { miners:3 });
  G.chest = { Charbon:9 };
  for(const m of [...G.miners]) leaveSession(G, m);
  assert.equal(G.over, true);
  assert.ok(G.summary.shares.every(p => p.left && Object.keys(p.bag).length === 0));
});

test('quitter : par compte, et un compte inconnu ne fait rien', () => {
  const G = newSession(3, { miners:3, accounts:['AAAA'] });
  assert.equal(leaveSession(G, 'ZZZZ'), false);
  assert.equal(leaveSession(G, null), false, 'les mineurs sans compte ne partent pas par erreur');
  assert.equal(G.miners.length, 3);
  assert.equal(leaveSession(G, 'AAAA'), true);
  assert.equal(G.miners.length, 2);
});

test('chaque tier de Treasure se copie à tous les joueurs', () => {
  const bags = shareChest({ [T1]:1, [T2]:2, Fer:4 }, 3, 11);
  for(const b of bags){ assert.equal(b[T1], 1); assert.equal(b[T2], 2); }
  assert.equal(bags.reduce((s,b)=>s+b.Fer,0), 4, 'le fer, lui, se partage');
});
