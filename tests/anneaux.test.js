/* Anneaux (RINGS) : 2 cases, jamais deux fois le même, effet pour tout le groupe (une fois par anneau différent),
   ni identification / amélioration / enchantement, butin des trésors de tour seulement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RINGS, RARITY, STATS, ITEMS, treasureItem, chestItem } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { createInventory, addItem, countOf } from '../src/meta/inventory.js';
import { createStuff, stuffOp, piecesFor, sanitizeStuff, sanitizeGear, equipSlotFor, minerStats, withRings, ringsOf, statLines } from '../src/meta/stuff.js';
import { sanitizePiece } from '../src/meta/piece.js';
import { identifyError, upgradeError, enchantError } from '../src/meta/upgrade.js';
import { openTreasure } from '../src/meta/loot.js';
import { minerSpecs, buildSession } from '../src/shared/game.js';
import { instantSpecs } from '../src/shared/instant.js';
import { endSession } from '../src/sim/session.js';
import { mulberry32 } from '../src/core/rng.js';

const TIGRE = 'Anneau du tigre', LION = 'Anneau du lion', NERD = 'Anneau du nerd';
let n = 0; const id = () => 'op-ring-' + (++n);
const uidOf = (inv, item, k = 0) => inv.slots.filter(s => s?.item === item)[k].uid;
function setup(items){
  const inv = createInventory();
  for(const [item, q] of Object.entries(items)) addItem(inv, item, q);
  return { inv, st: createStuff() };
}

test('8 anneaux : rares sauf Midas et Bouffon (épiques), sans recette, deux cases d\'anneau', () => {
  assert.equal(Object.keys(RINGS.items).length, 8);
  for(const [name, d] of Object.entries(RINGS.items)){
    assert.equal(ITEMS[name].cat, 'stuff'); assert.equal(ITEMS[name].slot, 'anneau');
    assert.equal(RARITY.items[name], d.rarity);
    assert.ok(!RECIPES[name] && !RECIPES[name + ' BP'], name + ' ne se fabrique pas');
  }
  assert.equal(RARITY.items['Anneau de Midas'], 'epique'); assert.equal(RARITY.items['Anneau du Bouffon'], 'epique');
  assert.equal(RARITY.items[TIGRE], 'rare');
  const { inv } = setup({ [TIGRE]:1, [LION]:1 });
  assert.equal(piecesFor(inv, 'anneau1').length, 2); assert.equal(piecesFor(inv, 'anneau2').length, 2);
  assert.equal(piecesFor(inv, 'casque').length, 0);
});

test('deux anneaux différents se portent ensemble ; le même anneau deux fois : refusé', () => {
  const { inv, st } = setup({ [TIGRE]:2, [LION]:1 });
  assert.equal(stuffOp(inv, st, { action:'equip', slot:'anneau1', uid:uidOf(inv, TIGRE), opId:id() }).ok, true);
  assert.deepEqual(stuffOp(inv, st, { action:'equip', slot:'anneau2', uid:uidOf(inv, TIGRE), opId:id() }), { error:'same_ring' });
  assert.equal(countOf(inv, TIGRE), 1, 'le second tigre reste dans l\'inventaire');
  assert.equal(stuffOp(inv, st, { action:'equip', slot:'anneau2', uid:uidOf(inv, LION), opId:id() }).ok, true);
  assert.deepEqual([st.worn.anneau1.item, st.worn.anneau2.item], [TIGRE, LION]);
  /* remplacer un tigre par l'autre tigre dans la même case : permis */
  const other = uidOf(inv, TIGRE), before = st.worn.anneau1.uid;
  assert.equal(stuffOp(inv, st, { action:'equip', slot:'anneau1', uid:other, opId:id() }).ok, true);
  assert.equal(st.worn.anneau1.uid, other); assert.equal(uidOf(inv, TIGRE), before);
  /* un anneau ne va pas dans une autre case, une pièce ne va pas dans une case d'anneau */
  assert.deepEqual(stuffOp(inv, st, { action:'equip', slot:'casque', uid:uidOf(inv, TIGRE), opId:id() }), { error:'wrong_slot' });
  addItem(inv, 'Casque en fer', 1);
  assert.deepEqual(stuffOp(inv, st, { action:'equip', slot:'anneau1', uid:uidOf(inv, 'Casque en fer'), opId:id() }), { error:'wrong_slot' });
});

test('« Équiper » depuis l\'inventaire : case vide, ou celle qui porte déjà le même anneau', () => {
  assert.equal(equipSlotFor(TIGRE, {}), 'anneau1');
  assert.equal(equipSlotFor(TIGRE, { anneau1:{ item:LION } }), 'anneau2');
  assert.equal(equipSlotFor(TIGRE, { anneau1:{ item:LION }, anneau2:{ item:TIGRE } }), 'anneau2');
  assert.equal(equipSlotFor(TIGRE, { anneau1:{ item:LION }, anneau2:{ item:NERD } }), 'anneau1');
  assert.equal(equipSlotFor('Casque en fer', {}), 'casque');
});

test('relecture : le même anneau dans les deux cases → le second revient dans l\'inventaire (rien ne se perd)', () => {
  const inv = createInventory();
  const st = sanitizeStuff({ worn:{ anneau1:{ item:TIGRE, uid:10 }, anneau2:{ item:TIGRE, uid:11 } } }, inv);
  assert.deepEqual(st.worn.anneau1, { item:TIGRE, uid:10 }); assert.equal(st.worn.anneau2, null);
  assert.equal(countOf(inv, TIGRE), 1); assert.equal(uidOf(inv, TIGRE), 11);
  /* sanitizeGear (stats en session) : un seul exemplaire compte */
  assert.deepEqual(Object.keys(sanitizeGear({ anneau1:{ item:TIGRE, uid:1 }, anneau2:{ item:TIGRE, uid:2 } })), ['anneau1']);
});

test('ni qualité, ni niveau, ni rune sur un anneau ; identification, amélioration et enchantement refusés', () => {
  assert.deepEqual(sanitizePiece({ item:TIGRE, uid:5, q:7, plus:3, rune:{ q:1, lines:[] } }), { item:TIGRE, uid:5 });
  const { inv } = setup({ [TIGRE]:2 });
  addItem(inv, 'Plume d\'ange', 100); addItem(inv, 'Cristal de pleine lune', 20);
  const [a, b] = inv.slots.filter(s => s?.item === TIGRE).map(s => s.uid);
  assert.equal(identifyError(inv, a, b), 'ring');
  assert.equal(upgradeError(inv, a), 'ring');
  const [r] = addItem(inv, 'Rune', 1); Object.assign(inv.slots[r], { q:1, lines:[{ stat:'crit', pct:1 }] });
  assert.equal(enchantError(inv, a, inv.slots[r].uid), 'ring');
});

test('effets : % du total pour vitesse, oxygène, pods ; points pour dégâts %, minage %, fortune, butin', () => {
  const c = withRings({ ...STATS }, Object.keys(RINGS.items));
  assert.equal(c.speed, 3.09); assert.equal(c.climbSpeed, 2.32);          // 2,25 × 1,03 = 2,3175
  assert.equal(c.oxygenMax, 309); assert.equal(c.pods, 206);
  assert.equal(c.damagePct, 3); assert.equal(c.mineSpeedPct, 3); assert.equal(c.fortune, 2); assert.equal(c.looting, 2);
  assert.equal(c.damage, STATS.damage, 'la base des dégâts ne bouge pas (le % passe par damagePct)');
  /* un anneau en double ne compte qu'une fois */
  assert.deepEqual(withRings({ ...STATS }, [TIGRE, TIGRE]), withRings({ ...STATS }, [TIGRE]));
  assert.deepEqual(statLines(TIGRE), ['Groupe · Vitesse (marche) +3 %', 'Groupe · Vitesse (échelle) +3 %']);
  assert.deepEqual(statLines(NERD), ['Groupe · XP +3 %']);
});

test('onglet Stuff : les anneaux portés s\'ajoutent au total (colonne ring)', () => {
  const s = minerStats({ anneau1:{ item:'Anneau de la baleine', uid:1 }, casque:{ item:'Casque en fer', uid:2 } });
  const ox = s.find(x => x.key === 'oxygenMax');
  assert.equal(ox.bonus, 38); assert.equal(ox.total, 348.14); assert.equal(ox.ring, 10.14);   // (300 + 38) × 1,03
  assert.equal(s.find(x => x.key === 'pods').ring, 0);
});

test('session : l\'effet va à tout le groupe, une seule fois même si deux joueurs portent le même anneau', () => {
  const rec = { players:[{ account:'A', name:'Geo' }, { account:'B', name:'Jules' }, { account:'C', name:'Max' }],
    gear:{ A:{ anneau1:{ item:TIGRE, uid:1 } }, B:{ anneau1:{ item:TIGRE, uid:2 }, anneau2:{ item:LION, uid:3 } }, C:{ casque:{ item:'Casque en fer', uid:4 } } } };
  const [a, b, c] = minerSpecs(rec);
  for(const m of [a, b, c]){
    assert.equal(m.carac.speed, 3.09, m.name); assert.equal(m.carac.damagePct, 3, m.name);
  }
  assert.equal(c.carac.oxygenMax, 338, 'pas de baleine : l\'oxygène ne bouge pas');
  /* sans anneau, rien ne change */
  const plain = minerSpecs({ players:[{ account:'A', name:'Geo' }], gear:{ A:{ casque:{ item:'Casque en fer', uid:4 } } } })[0];
  assert.equal(plain.carac.speed, STATS.speed); assert.equal(plain.carac.oxygenMax, 338);
});

test('mine instantanée : chacun pour soi, l\'anneau ne profite qu\'à son porteur', () => {
  const [a, b] = instantSpecs({ players:[{ account:'A', name:'Geo' }, { account:'B', name:'Jules' }], looks:{ A:{ anneau1:TIGRE }, B:{} } });
  assert.equal(a.carac.speed, 3.09); assert.equal(b.carac.speed, STATS.speed);
});

test('Anneau du nerd : +3 % d\'XP sur le pot commun de la session', () => {
  const rec = n => ({ seed:7, id:'s-' + n, players:[{ account:'A', name:'Geo' }, { account:'B', name:'Jules' }],
    gear:{ A: n ? { anneau1:{ item:NERD, uid:1 } } : {}, B: n > 1 ? { anneau1:{ item:NERD, uid:2 } } : {} } });
  const xpOf = r => { const G = buildSession(r); G.stats.xp = 1000; endSession(G); return G.summary.shares.map(s => s.xp); };
  assert.deepEqual(xpOf(rec(0)), [500, 500]);
  assert.deepEqual(xpOf(rec(1)), [515, 515]);
  assert.deepEqual(xpOf(rec(2)), [515, 515], 'deux nerds : toujours +3 %');
});

test('trésor de tour : rune + au plus un anneau de sa table (≈ 6,5 %) ; jamais dans un Treasure ni un ancien coffre', () => {
  const N = 20000, got = { angel:{}, demon:{} };
  for(const side of ['angel', 'demon']){
    const rng = mulberry32(side === 'angel' ? 11 : 22);
    for(let i = 0; i < N; i++){
      const inv = createInventory(); addItem(inv, treasureItem(side, 3), 1);
      const { loot } = openTreasure(inv, treasureItem(side, 3), 'op-' + side + i, rng);
      assert.equal(loot.Rune, 1);
      const rings = Object.keys(loot).filter(k => RINGS.items[k]);
      assert.ok(rings.length <= 1);
      for(const r of rings){ got[side][r] = (got[side][r] || 0) + 1; assert.equal(countOf(inv, r), 1); }
    }
  }
  const total = side => Object.values(got[side]).reduce((a, b) => a + b, 0) / N;
  for(const side of ['angel', 'demon']) assert.ok(Math.abs(total(side) - 0.065) < 0.01, `${side} : ${total(side)}`);
  assert.ok(got.angel['Anneau de Midas'] > 0 && !got.angel['Anneau du Bouffon']);
  assert.ok(got.demon['Anneau du Bouffon'] > 0 && !got.demon['Anneau de Midas']);
  /* ancien coffre et Treasure T1 : jamais d'anneau */
  const rng = mulberry32(3);
  for(let i = 0; i < 2000; i++){
    const inv = createInventory(); addItem(inv, chestItem('angel', 2), 1); addItem(inv, 'Treasure T1', 1);
    const a = openTreasure(inv, chestItem('angel', 2), 'op-c' + i, rng).loot, b = openTreasure(inv, 'Treasure T1', 'op-t' + i, rng).loot;
    assert.ok(![...Object.keys(a), ...Object.keys(b)].some(k => RINGS.items[k]));
  }
});
