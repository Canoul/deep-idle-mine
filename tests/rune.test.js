/* Coffres des tours, runes et enchantement (concept Ange vs Démon, étape 3). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADE, RUNE, chestItem, ITEMS } from '../src/config.js';
import { mulberry32 } from '../src/core/rng.js';
import { createInventory, addItem, countOf, deserialize, serialize } from '../src/meta/inventory.js';
import { canOpen, openTreasure } from '../src/meta/loot.js';
import { rollChestQuality, rollRune, sanitizePiece, pieceBonus, lineValue, isRune } from '../src/meta/piece.js';
import { enchant, enchantError } from '../src/meta/upgrade.js';
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

function withRune(lines = [{ stat: 'crit', pct: 20 }], q = 1){
  const inv = createInventory();
  const [i] = addItem(inv, PICK, 1), [j] = addItem(inv, RUNE.item, 1);
  Object.assign(inv.slots[j], { q, lines, s: UPGRADE.scale });
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

test('enchanter : niveau compris ; pièce non identifiée possible ; identification et rune s\'additionnent', () => {
  const { inv, piece, rune } = withRune([{ stat: 'pods', pct: 20 }], 1);
  piece.plus = 3; piece.q = 1; piece.lines = [{ stat: 'pods', pct: 20 }]; piece.s = UPGRADE.scale;
  enchant(inv, { uid: piece.uid, rune: rune.uid, opId: id() });
  const one = lineValue(PICK, { stat: 'pods', pct: 20 });
  assert.equal(pieceBonus(piece).stats.pods, Math.round(2 * one * 1.07));
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
