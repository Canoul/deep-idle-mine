/* Stuff : 10 cases, équiper (la pièce quitte l'inventaire), remplacer, retirer, relecture sans duplication. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUFF } from '../src/config.js';
import { createInventory, addAll, addItem, countOf } from '../src/meta/inventory.js';
import { createStuff, stuffOp, piecesFor, sanitizeStuff, SLOT_IDS } from '../src/meta/stuff.js';

const PICK = 'Pioche en pierre';
let n = 0; const id = () => 'op-stuff-' + (++n);
function setup(picks = 1){
  const inv = createInventory(); addAll(inv, { Charbon:5 }); addItem(inv, PICK, picks);
  return { inv, st: createStuff() };
}
const uids = inv => inv.slots.filter(s => s?.item === PICK).map(s => s.uid);

test('les 10 cases demandées', () => {
  assert.deepEqual(SLOT_IDS, ['casque','torse','jambes','pieds','gants','ceinture','pioche','epee','cape','boussole']);
  assert.equal(STUFF.slots.length, 10);
});

test('la case pioche propose les pioches de l\'inventaire, les autres cases rien', () => {
  const { inv } = setup(2);
  assert.equal(piecesFor(inv, 'pioche').length, 2);
  assert.equal(piecesFor(inv, 'casque').length, 0);
});

test('équiper : la pioche quitte l\'inventaire et va dans la case ; retirer la remet (même uid)', () => {
  const { inv, st } = setup();
  const [u] = uids(inv);
  assert.equal(stuffOp(inv, st, { action:'equip', slot:'pioche', uid:u, opId:id() }).ok, true);
  assert.deepEqual(st.worn.pioche, { item:PICK, uid:u });
  assert.equal(countOf(inv, PICK), 0);
  stuffOp(inv, st, { action:'unequip', slot:'pioche', opId:id() });
  assert.equal(st.worn.pioche, null); assert.deepEqual(uids(inv), [u]);
});

test('équiper une autre pièce : l\'ancienne revient dans l\'inventaire', () => {
  const { inv, st } = setup(2);
  const [a, b] = uids(inv);
  stuffOp(inv, st, { action:'equip', slot:'pioche', uid:a, opId:id() });
  stuffOp(inv, st, { action:'equip', slot:'pioche', uid:b, opId:id() });
  assert.equal(st.worn.pioche.uid, b); assert.deepEqual(uids(inv), [a]);
});

test('refus : mauvaise case, pièce absente, case inconnue, demande rejouée', () => {
  const { inv, st } = setup();
  const [u] = uids(inv);
  assert.equal(stuffOp(inv, st, { action:'equip', slot:'casque', uid:u, opId:id() }).error, 'wrong_slot');
  assert.equal(stuffOp(inv, st, { action:'equip', slot:'pioche', uid:999, opId:id() }).error, 'not_owned');
  assert.equal(stuffOp(inv, st, { action:'equip', slot:'tete', uid:u, opId:id() }).error, 'bad_slot');
  assert.equal(stuffOp(inv, st, { action:'equip', slot:'pioche', uid:'1', opId:id() }).error, 'bad_request');
  const o = { action:'equip', slot:'pioche', uid:u, opId:'rejoue' };
  stuffOp(inv, st, o); stuffOp(inv, st, { action:'unequip', slot:'pioche', opId:id() });
  assert.equal(stuffOp(inv, st, o).repeated, true);
  assert.equal(st.worn.pioche, null, 'la demande rejouée n\'a rien refait');
});

test('relecture : pièce portée ET dans l\'inventaire (duplication) → retirée du stuff ; mauvaise case → retirée', () => {
  const { inv } = setup();
  const [u] = uids(inv);
  const st = sanitizeStuff({ worn:{ pioche:{ item:PICK, uid:u }, casque:{ item:PICK, uid:77 } } }, inv);
  assert.equal(st.worn.pioche, null); assert.equal(st.worn.casque, null);
  const st2 = sanitizeStuff({ worn:{ pioche:{ item:PICK, uid:500 } } }, inv);
  assert.deepEqual(st2.worn.pioche, { item:PICK, uid:500 });
  assert.ok(inv.nextUid > 500, 'les prochains uid ne réutilisent pas celui de la pièce portée');
});
