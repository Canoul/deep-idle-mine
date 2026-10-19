/* Anti-duplication et anti-triche : suite à part, lancée à la demande (npm run test:anticheat),
   pas à chaque modification. Elle vérifie qu'aucun chemin ne crée de ressources à partir de rien :
   partage du coffre, fin et départ de session, versement dans l'inventaire, sauvegarde. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SHARE, INVENTORY, TREASURE } from '../../src/config.js';
import { mulberry32 } from '../../src/core/rng.js';
import { shareChest } from '../../src/meta/share.js';
import { newSession, endSession, leaveSession, tick } from '../../src/sim/session.js';
import { createInventory, addItem, addAll, removeItem, countOf, creditSession, serialize, deserialize } from '../../src/meta/inventory.js';

ITEMS['Pioche test'] = { cat:'stuff', tex:null, w:0, stack:false };
const NAMES = ['Terre', 'Pierre', 'Charbon', 'Fer', 'Or', 'Diamant', 'Chitine', TREASURE.tiers[0].item];

/* coffre aléatoire (déterministe) pour les tests de propriété */
function randomChest(r){
  const c = {};
  for(const k of NAMES) if(r() < 0.8) c[k] = Math.floor(r() * (r() < 0.1 ? 1e9 : 1000));
  return c;
}

/* ---------- partage ---------- */

test('partage : la somme des parts n\'excède jamais le coffre (et ne perd rien), sur 3000 coffres aléatoires', () => {
  const r = mulberry32(2026);
  for(let t=0; t<3000; t++){
    const chest = randomChest(r), n = 1 + Math.floor(r() * 3), seed = Math.floor(r() * 2**31);
    const bags = shareChest(chest, n, seed);
    assert.equal(bags.length, n);
    for(const k in chest){
      if(!(chest[k] > 0)) continue;
      const sum = bags.reduce((s, b) => s + (b[k] || 0), 0);
      const expected = SHARE.copyToAll.includes(k) ? chest[k] * n : chest[k];
      assert.equal(sum, expected, `${k} : ${sum} distribués pour ${chest[k]} au coffre (${n} joueurs)`);
    }
    for(const b of bags) for(const k in b) assert.ok(k in chest, `objet ${k} apparu de nulle part`);
  }
});

test('partage : quantités invalides au coffre ignorées (Infinity, NaN, négatif, décimale, texte)', () => {
  const bags = shareChest({ Or:Infinity, Fer:NaN, Charbon:-50, Terre:2.5, Pierre:'99', Diamant:3 }, 3, 1);
  for(const b of bags){
    for(const k of ['Or', 'Fer', 'Charbon', 'Terre', 'Pierre']) assert.equal(b[k], undefined, k);
    assert.equal(b.Diamant, 1);
  }
});

test('partage : plus aucun joueur → personne ne reçoit rien', () => {
  assert.deepEqual(shareChest({ Or:5 }, 0, 1), []);
  assert.deepEqual(shareChest({ Or:5 }, -2, 1), []);
});

/* ---------- fin et départ de session ---------- */

test('fin de session appelée deux fois : le partage n\'est pas recalculé ni doublé', () => {
  const G = newSession(1, { miners:3 });
  G.chest = { Charbon:10 };
  endSession(G);
  const first = JSON.stringify(G.summary);
  G.chest.Charbon = 999;                  // un coffre modifié après la fin ne compte plus
  endSession(G);
  assert.equal(JSON.stringify(G.summary), first);
});

test('quitter deux fois, ou après la fin, ne change rien', () => {
  const G = newSession(1, { miners:3, accounts:['AAAA', 'BBBB', 'CCCC'] });
  assert.equal(leaveSession(G, 'AAAA'), true);
  assert.equal(leaveSession(G, 'AAAA'), false);
  assert.equal(G.miners.length, 2);
  G.chest = { Charbon:10 };
  endSession(G);
  assert.equal(leaveSession(G, 'BBBB'), false, 'trop tard : la session est finie');
  assert.equal(G.summary.shares[1].bag.Charbon + G.summary.shares[2].bag.Charbon, 10);
});

test('un joueur parti ne touche rien, même s\'il avait beaucoup déposé', () => {
  const G = newSession(1, { miners:3, accounts:['AAAA', 'BBBB', 'CCCC'] });
  G.chest = { Or:30 }; G.chestBy = { 0:{ Or:30 } };
  leaveSession(G, 'AAAA');
  endSession(G);
  assert.deepEqual(G.summary.shares[0].bag, {});
  assert.equal(G.summary.shares[1].bag.Or + G.summary.shares[2].bag.Or, 30);
});

test('ce que porte un joueur qui part est perdu, pas versé au coffre', () => {
  const G = newSession(1, { miners:3, accounts:['AAAA'] });
  G.miners[0].inv = { Diamant:4 };
  leaveSession(G, 'AAAA');
  for(let i=0; i<50; i++) tick(G);
  assert.equal(G.chest.Diamant, undefined);
});

/* ---------- inventaire ---------- */

test('versement : une même session ne peut être créditée qu\'une fois', () => {
  const inv = createInventory();
  assert.ok(creditSession(inv, 'S1', { Or:5 }));
  assert.equal(creditSession(inv, 'S1', { Or:5 }), null);
  assert.equal(countOf(inv, 'Or'), 5);
  assert.equal(creditSession(inv, '', { Or:5 }), null, 'sans id de session : refusé');
  assert.equal(creditSession(inv, undefined, { Or:5 }), null);
  assert.equal(countOf(inv, 'Or'), 5);
});

test('versement : la mémoire des sessions créditées survit à la sauvegarde', () => {
  const inv = createInventory();
  creditSession(inv, 'S1', { Fer:3 });
  const back = deserialize(serialize(inv));
  assert.equal(creditSession(back, 'S1', { Fer:3 }), null);
  assert.equal(countOf(back, 'Fer'), 3);
});

test('versement : deux sessions distinctes de même seed sont deux sessions (ids différents)', () => {
  const a = newSession(42, { miners:1 }), b = newSession(42, { miners:1 });
  assert.notEqual(a.id, b.id);
});

test('inventaire : quantités invalides refusées à l\'ajout et au retrait', () => {
  const inv = createInventory();
  for(const q of [Infinity, -Infinity, NaN, -1, 0, 2.5, '10', null, undefined, 2**53]) {
    assert.deepEqual(addItem(inv, 'Or', q), [], `ajout ${q}`);
  }
  addItem(inv, 'Or', 10);
  for(const q of [Infinity, NaN, -5, 0, 1.5, '3']) assert.equal(removeItem(inv, 'Or', q), false, `retrait ${q}`);
  assert.equal(countOf(inv, 'Or'), 10, 'retirer une quantité négative n\'ajoute rien');
});

test('inventaire : une pile ne dépasse jamais la précision des nombres', () => {
  const inv = createInventory();
  addItem(inv, 'Or', Number.MAX_SAFE_INTEGER - 1);
  assert.deepEqual(addItem(inv, 'Or', 5), []);
  assert.equal(countOf(inv, 'Or'), Number.MAX_SAFE_INTEGER - 1);
});

test('inventaire : retirer plus que possédé échoue sans rien retirer', () => {
  const inv = createInventory();
  addAll(inv, { Fer:3 });
  assert.equal(removeItem(inv, 'Fer', 4), false);
  assert.equal(countOf(inv, 'Fer'), 3);
});

test('inventaire : stuff en quantité aberrante refusé (pas de millions de slots)', () => {
  const inv = createInventory();
  assert.deepEqual(addItem(inv, 'Pioche test', INVENTORY.maxUniqueAdd + 1), []);
  assert.equal(inv.slots.length, 0);
});

test('sauvegarde : une pièce de stuff dupliquée (même identifiant) n\'est gardée qu\'une fois', () => {
  const inv = createInventory();
  addItem(inv, 'Pioche test', 1);
  const d = JSON.parse(serialize(inv));
  d.slots.push({ ...d.slots[0] }, { ...d.slots[0] });     // copie-colle de la pièce dans la sauvegarde
  const back = deserialize(JSON.stringify(d));
  assert.equal(countOf(back, 'Pioche test'), 1);
  addItem(back, 'Pioche test', 1);
  assert.equal(new Set(back.slots.filter(Boolean).map(s => s.uid)).size, 2, 'la nouvelle pièce a un identifiant neuf');
});

test('sauvegarde : quantités trafiquées rejetées (Infinity, négatif, décimale, texte, stuff ×1000)', () => {
  const back = deserialize(JSON.stringify({ v:1, slots:[
    { item:'Or', qty:1e400 }, { item:'Fer', qty:-5 }, { item:'Terre', qty:1.5 }, { item:'Charbon', qty:'99' },
    { item:'Pioche test', qty:1000, uid:7 }, { item:'Pierre', qty:12 },
  ] }));
  assert.equal(countOf(back, 'Or'), 0);
  assert.equal(countOf(back, 'Fer'), 0);
  assert.equal(countOf(back, 'Terre'), 0);
  assert.equal(countOf(back, 'Charbon'), 0);
  assert.equal(countOf(back, 'Pioche test'), 1, 'une pièce de stuff vaut toujours 1');
  assert.equal(countOf(back, 'Pierre'), 12);
});
