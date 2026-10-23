/* Coffres des tours, runes et enchantement (concept Ange vs Démon, étape 3). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADE, RUNE, chestItem, ITEMS } from '../src/config.js';
import { mulberry32 } from '../src/core/rng.js';
import { createInventory, addItem, countOf, deserialize, serialize } from '../src/meta/inventory.js';
import { canOpen, openTreasure } from '../src/meta/loot.js';
import { rollChestQuality, rollRune, sanitizePiece, pieceBonus, lineValue, isRune, isFragment, roundStat } from '../src/meta/piece.js';
import { enchant, enchantError, unenchant, unenchantError } from '../src/meta/upgrade.js';
import { statLines } from '../src/meta/stuff.js';

const PICK = 'Pioche en pierre';
const fixed = v => () => v;
let n = 0; const id = () => 'op-test-' + (++n).toString().padStart(4, '0');

test('coffres : 7 qualités par tour, objets empilables qui s\'ouvrent ; la rune est une pièce (non empilable)', () => {
  for(const side of ['angel', 'demon']) for(let q = 1; q <= 7; q++){
    const c = chestItem(side, q);
    assert.ok(ITEMS[c]?.stack, c); assert.equal(ITEMS[c].chest.q, q); assert.ok(canOpen(c), c);
  }
  assert.equal(chestItem('angel', 4), 'Coffre angélique R4');
  assert.equal(ITEMS[RUNE.item].stack, false); assert.ok(isRune(RUNE.item)); assert.ok(!canOpen(RUNE.item));
});

test('qualité d\'un coffre : les chances de l\'identification (20 000 tirages)', () => {
  const r = mulberry32(3), count = {};
  for(let i = 0; i < 20000; i++){ const q = rollChestQuality(r); count[q] = (count[q] || 0) + 1; }
  for(const d of UPGRADE.qualities) assert.ok(Math.abs((count[d.q] || 0) / 20000 - d.chance) < 0.012, `R${d.q}`);
});

test('rune tirée : la qualité imposée, le bon nombre de lignes, % dans la fourchette, barème actuel', () => {
  const r = mulberry32(8);
  for(let i = 0; i < 2000; i++){
    const q = 1 + (i % 7), d = UPGRADE.qualities[q - 1], rune = rollRune(q, r);
    assert.equal(rune.q, q); assert.equal(rune.lines.length, d.lines); assert.equal(rune.s, UPGRADE.scale);
    for(const l of rune.lines) if(l.stat !== 'discoverMax') assert.ok(l.pct >= d.min && l.pct <= d.max && UPGRADE.pool.includes(l.stat));
    assert.ok(rune.lines.filter(l => l.stat === 'discoverMax').length <= (UPGRADE.discover.qualities.includes(q) ? 1 : 0));
    assert.ok(sanitizePiece({ item: RUNE.item, uid: 1, ...rune }), 'une vraie rune passe la relecture');
  }
});

test('ouvrir un coffre : il disparaît, une rune de sa qualité apparaît ; demande renvoyée = même résultat', () => {
  const inv = createInventory(), c = chestItem('demon', 5);
  addItem(inv, c, 2);
  const op = id(), r = openTreasure(inv, c, op, mulberry32(4));
  assert.deepEqual(r.loot, { [RUNE.item]: 1 }); assert.equal(r.repeated, false);
  assert.equal(countOf(inv, c), 1);
  const runes = inv.slots.filter(s => s?.item === RUNE.item);
  assert.equal(runes.length, 1); assert.equal(runes[0].q, 5); assert.equal(runes[0].lines.length, 2); assert.ok(runes[0].uid > 0);
  assert.equal(openTreasure(inv, c, op, mulberry32(9)).repeated, true, 'rejouée');
  assert.equal(countOf(inv, c), 1, 'rien rouvert'); assert.equal(inv.slots.filter(s => s?.item === RUNE.item).length, 1);
  assert.equal(openTreasure(createInventory(), c, id(), mulberry32(1)), null, 'pas de coffre : rien');
});

test('relecture : une rune trafiquée ou incomplète disparaît ; une rune valide reste', () => {
  const ok = { item: RUNE.item, uid: 3, q: 1, s: UPGRADE.scale, lines: [{ stat: 'crit', pct: 20 }] };
  assert.deepEqual(sanitizePiece(ok), ok);
  for(const bad of [{ ...ok, q: undefined }, { ...ok, lines: [{ stat: 'crit', pct: 90 }] }, { ...ok, lines: [] },
                    { ...ok, lines: [{ stat: 'light', pct: 20 }] }, { ...ok, plus: 2, q: 9 }])
    assert.equal(sanitizePiece(bad), null, JSON.stringify(bad));
  assert.equal(sanitizePiece({ ...ok, plus: 2 }).plus, undefined, 'une rune n\'a pas de niveau');
  const inv = deserialize(JSON.stringify({ v: 1, slots: [{ ...ok, qty: 1 }, { ...ok, uid: 4, qty: 1, lines: [{ stat: 'crit', pct: 99 }] }] }));
  assert.deepEqual(inv.slots.filter(Boolean).map(s => s.uid), [3]);
});

/* pieceQ : qualité de la pièce (identifiée) ; une rune ne va que sur une pièce de qualité égale ou supérieure (22/10) */
function withRune(lines = [{ stat: 'crit', pct: 20 }], q = 1, pieceQ = 7){
  const inv = createInventory();
  const [i] = addItem(inv, PICK, 1), [j] = addItem(inv, RUNE.item, 1);
  Object.assign(inv.slots[j], { q, lines, s: UPGRADE.scale });
  if(pieceQ) inv.slots[i].q = pieceQ;
  return { inv, piece: inv.slots[i], rune: inv.slots[j] };
}

test('enchanter : la rune est consommée, ses lignes s\'ajoutent à la pièce (valeur de CETTE pièce) ; définitif', () => {
  const { inv, piece, rune } = withRune();
  const r = enchant(inv, { uid: piece.uid, rune: rune.uid, opId: id() });
  assert.equal(r.ok, true);
  assert.equal(inv.slots.filter(s => s?.item === RUNE.item).length, 0, 'rune consommée');
  assert.deepEqual(r.piece.rune, { q: 1, s: UPGRADE.scale, lines: [{ stat: 'crit', pct: 20 }] });
  assert.equal(pieceBonus(r.piece).stats.crit, lineValue(PICK, { stat: 'crit', pct: 20 }));   // 26 x × 7 % = 1,8
  assert.ok(statLines(r.piece).some(t => t.startsWith('Rune')), 'les lignes de la rune sont affichées à part');
  /* une deuxième rune : refusée */
  const [j] = addItem(inv, RUNE.item, 1); Object.assign(inv.slots[j], { q: 2, lines: [{ stat: 'pods', pct: 20 }], s: UPGRADE.scale });
  assert.equal(enchantError(inv, piece.uid, inv.slots[j].uid), 'already_enchanted');
  assert.equal(sanitizePiece(r.piece).rune.q, 1, 'relue : la rune de la pièce reste');
});

test('enchanter : niveau compris ; les lignes d\'une ancienne identification et la rune s\'additionnent', () => {
  const { inv, piece, rune } = withRune([{ stat: 'pods', pct: 20 }], 1, 1);
  piece.plus = 3; piece.q = 1; piece.lines = [{ stat: 'pods', pct: 20 }]; piece.s = UPGRADE.scale;
  enchant(inv, { uid: piece.uid, rune: rune.uid, opId: id() });
  const one = lineValue(PICK, { stat: 'pods', pct: 20 });
  assert.equal(pieceBonus(piece).stats.pods, Math.round(2 * one * 1.07));
});

test('enchanter (22/10) : une pièce n\'accepte qu\'une rune de qualité égale ou inférieure à la sienne ; non identifiée = refusée', () => {
  for(const [pq, rq, expected] of [[6, 3, null], [6, 6, null], [6, 1, null], [6, 7, 'rune_too_rare'], [3, 4, 'rune_too_rare'],
                                   [1, 1, null], [1, 2, 'rune_too_rare'], [7, 7, null], [7, 1, null], [0, 1, 'not_identified']]){
    const { inv, piece, rune } = withRune([{ stat: 'crit', pct: 20 }], rq, pq);
    assert.equal(enchantError(inv, piece.uid, rune.uid), expected, `pièce R${pq}, rune R${rq}`);
    const before = serialize(inv), r = enchant(inv, { uid: piece.uid, rune: rune.uid, opId: id() });
    if(expected){ assert.equal(r.error, expected); assert.equal(serialize(inv), before, 'refusé : rien ne bouge'); }
    else { assert.equal(r.ok, true); assert.equal(r.piece.rune.q, rq); assert.equal(inv.slots.filter(s => s?.item === RUNE.item).length, 0); }
  }
});

test('enchanter : refus lisibles, rien ne bouge ; demande renvoyée appliquée une fois', () => {
  const { inv, piece, rune } = withRune();
  assert.equal(enchantError(inv, piece.uid, 999), 'not_owned');
  assert.equal(enchantError(inv, rune.uid, rune.uid), 'not_stuff', 'une rune sur une rune');
  assert.equal(enchantError(inv, piece.uid, piece.uid), 'not_rune');
  const before = serialize(inv);
  assert.equal(enchant(inv, { uid: piece.uid, rune: 12345, opId: id() }).error, 'not_owned');
  assert.equal(serialize(inv), before);
  const op = id();
  enchant(inv, { uid: piece.uid, rune: rune.uid, opId: op });
  const again = enchant(inv, { uid: piece.uid, rune: rune.uid, opId: op });
  assert.equal(again.repeated, true); assert.equal(again.piece.rune.q, 1);
});

/* Trésors des tours (22/10/2026) : remplacent les coffres ; non empilables, rareté Unique, nom « <qualité> Trésor … »
   dans la couleur de la qualité ; les anciens coffres restent ouvrables */
test('trésors : 7 qualités par tour, non empilables, rareté Unique, nom et couleur de la qualité', async () => {
  const { treasureItem } = await import('../src/config.js');
  const { itemName, itemColor, pieceName, pieceColor } = await import('../src/meta/piece.js');
  const { rarityOf } = await import('../src/meta/rarity.js');
  const { rname } = await import('../src/ui/rarity.js');
  for(const side of ['angel', 'demon']) for(let q = 1; q <= 7; q++){
    const t = treasureItem(side, q), d = UPGRADE.qualities[q - 1];
    assert.equal(ITEMS[t]?.stack, false, t); assert.equal(ITEMS[t].chest.q, q); assert.ok(canOpen(t), t);
    assert.equal(rarityOf(t), 'unique', t);
    assert.equal(itemName(t), `${d.label} ${RUNE.treasures[side].name}`); assert.equal(itemColor(t), d.color);
    assert.ok(rname(t).includes(`color:${d.color}`) && rname(t).includes(itemName(t)) && rname(t).includes('r-unique'), rname(t));
  }
  assert.equal(treasureItem('demon', 5), 'Trésor démoniaque R5');
  assert.equal(itemName(treasureItem('demon', 5)), 'Antique Trésor démoniaque');
  const inv = createInventory(); addItem(inv, treasureItem('demon', 6), 1);
  assert.equal(pieceName(inv.slots[0]), 'Mystérieux Trésor démoniaque'); assert.equal(pieceColor(inv.slots[0]), UPGRADE.qualities[5].color);
  assert.equal(itemName(PICK), PICK); assert.equal(itemColor(PICK), null);
  assert.equal(itemName(chestItem('demon', 6)), 'Coffre démoniaque R6', 'ancien coffre : nom inchangé');
});

test('trésors : un par case, gardés au rechargement, une rune de leur qualité à l\'ouverture ; ancien coffre toujours ouvrable', async () => {
  const { treasureItem } = await import('../src/config.js');
  const inv = createInventory(), t = treasureItem('angel', 7);
  addItem(inv, t, 2);
  assert.equal(inv.slots.filter(s => s?.item === t).length, 2, 'deux cases'); assert.ok(inv.slots.every(s => s.qty === 1 && s.uid > 0));
  const back = deserialize(serialize(inv));
  assert.equal(countOf(back, t), 2, 'gardés au rechargement');
  const dup = deserialize(JSON.stringify({ v: 1, slots: [{ item: t, qty: 1, uid: 5 }, { item: t, qty: 1, uid: 5 }, { item: t, qty: 3, uid: 6, q: 7 }] }));
  assert.deepEqual(dup.slots.filter(Boolean).map(s => [s.uid, s.qty, s.q]), [[5, 1, undefined], [6, 1, undefined]],
    'uid en double : refusé ; quantité > 1 ramenée à 1 (comme le stuff) ; pas de qualité ajoutée');
  const r = openTreasure(back, t, id(), mulberry32(2));
  assert.deepEqual(r.loot, { [RUNE.item]: 1 }); assert.equal(countOf(back, t), 1);
  const rune = back.slots.find(s => s?.item === RUNE.item);
  assert.equal(rune.q, 7); assert.equal(rune.lines.length, UPGRADE.qualities[6].lines);
  const old = createInventory(), c = chestItem('demon', 3);
  addItem(old, c, 2);
  assert.equal(old.slots.length, 1, 'ancien coffre : toujours empilable');
  assert.equal(openTreasure(old, c, id(), mulberry32(3)).loot[RUNE.item], 1);
  assert.equal(old.slots.find(s => s?.item === RUNE.item).q, 3);
});

test('retirer une rune (23/10) : gratuit, elle revient en Fragment de rune (mêmes lignes, % ÷ 2), reposable, puis définitif', () => {
  const d2 = UPGRADE.qualities.find(q => q.q === 2), pct = d2.max;
  const L = Array.from({ length: d2.lines }, (_, i) => ({ stat: i % 2 ? 'pods' : 'crit', pct }));
  const { inv, piece, rune } = withRune(L, 2, 5);
  enchant(inv, { uid: piece.uid, rune: rune.uid, opId: id() });
  const full = pieceBonus(piece).stats;
  const op = id(), r = unenchant(inv, { uid: piece.uid, opId: op });
  assert.equal(r.ok, true); assert.equal(piece.rune, undefined, 'la pièce n\'a plus de rune');
  const f = r.fragment;
  assert.equal(f.item, RUNE.fragment.item); assert.equal(f.q, 2); assert.ok(isRune(f.item) && isFragment(f.item));
  assert.deepEqual(f.lines, L, 'les mêmes lignes');
  assert.notEqual(f.uid, rune.uid);
  /* demande renvoyée : rien de plus */
  const again = unenchant(inv, { uid: piece.uid, opId: op });
  assert.equal(again.repeated, true); assert.equal(inv.slots.filter(s => s?.item === RUNE.fragment.item).length, 1);
  /* reposé : chaque ligne vaut la moitié du % */
  assert.equal(enchantError(inv, piece.uid, f.uid), null);
  enchant(inv, { uid: piece.uid, rune: f.uid, opId: id() });
  assert.equal(piece.rune.frag, true);
  const half = pieceBonus(piece).stats;
  assert.equal(half.crit, roundStat('crit', L.filter(l => l.stat === 'crit').reduce((s, l) => s + lineValue(PICK, { ...l, pct: l.pct / 2 }), 0)));
  assert.ok(half.crit < full.crit, `${half.crit} < ${full.crit}`);
  assert.ok(statLines(piece).some(t => t.startsWith('Fragment')));
  /* un fragment posé ne se retire plus ; relu, il reste un fragment */
  assert.equal(unenchantError(inv, piece.uid), 'fragment_locked');
  assert.equal(sanitizePiece(JSON.parse(JSON.stringify(piece))).rune.frag, true);
  /* refus : pièce sans rune, absente */
  const [k] = addItem(inv, PICK, 1);
  assert.equal(unenchantError(inv, inv.slots[k].uid), 'no_rune'); assert.equal(unenchantError(inv, 99999), 'not_owned');
});

test('fragment : mêmes règles qu\'une rune (qualité ≤ pièce), relu et revérifié ; la ligne Découverte reste +1', () => {
  const { inv, piece } = withRune(undefined, 1, 3);
  const [j] = addItem(inv, RUNE.fragment.item, 1);
  Object.assign(inv.slots[j], { q: 5, lines: [{ stat: 'crit', pct: 30 }, { stat: 'pods', pct: 30 }, { stat: 'oxygenMax', pct: 30 }], s: UPGRADE.scale });
  const d5 = UPGRADE.qualities.find(q => q.q === 5);
  inv.slots[j].lines = Array.from({ length: d5.lines }, () => ({ stat: 'crit', pct: d5.min }));
  assert.equal(enchantError(inv, piece.uid, inv.slots[j].uid), 'rune_too_rare');
  const bad = { item: RUNE.fragment.item, uid: 7, q: 2, lines: [{ stat: 'crit', pct: 999 }], s: UPGRADE.scale };
  assert.equal(sanitizePiece(bad), null, 'fragment trafiqué : refusé');
  assert.equal(lineValue(PICK, { stat: 'discoverMax' }, 0.5), lineValue(PICK, { stat: 'discoverMax' }));
});
