/* Partage du coffre commun en fin de session : parts égales, reste au hasard (seed), Trésor pour chacun. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREASURE, MOBS } from '../src/config.js';
import { shareChest, shareIndexFor } from '../src/meta/share.js';
import { newSession, endSession } from '../src/sim/session.js';

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

test('le Trésor ne se partage pas : chaque joueur reçoit la quantité entière', () => {
  const bags = shareChest({ [TREASURE.item]:2, Charbon:3 }, 3, 7);
  for(const b of bags) assert.deepEqual(b, { [TREASURE.item]:2, Charbon:1 });
});

test('solo : le joueur garde tout', () => {
  assert.deepEqual(shareChest({ Charbon:7, [TREASURE.item]:1, [MOBS.bugItem]:5 }, 1, 3),
    [{ Charbon:7, [TREASURE.item]:1, [MOBS.bugItem]:5 }]);
});

test('coffre vide ou quantités invalides : parts vides', () => {
  assert.deepEqual(shareChest({}, 3, 1), [{}, {}, {}]);
  assert.deepEqual(shareChest({ Fer:0, Or:-2 }, 2, 1), [{}, {}]);
});

test('fin de session : une part par mineur, rattachée à son compte', () => {
  const G = newSession(42, { miners:3, accounts:['7K3Q-9XHP', 'AAAA-BBBB'] });
  G.chest = { Charbon:10, [TREASURE.item]:1 };
  endSession(G);
  const s = G.summary.shares;
  assert.deepEqual(s.map(p => p.miner), ['Rouge', 'Bleu', 'Vert']);
  assert.deepEqual(s.map(p => p.account), ['7K3Q-9XHP', 'AAAA-BBBB', null]);
  assert.equal(s.reduce((n, p) => n + p.bag.Charbon, 0), 10);
  assert.ok(s.every(p => p.bag[TREASURE.item] === 1));
});

test('la part du joueur : celle de son compte, sinon celle du premier mineur', () => {
  const shares = [{ account:'A' }, { account:'B' }, { account:null }];
  assert.equal(shareIndexFor(shares, 'B'), 1);
  assert.equal(shareIndexFor(shares, 'Z'), 0);
  assert.equal(shareIndexFor(shares, null), 0);
});
