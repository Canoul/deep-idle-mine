/* Stuff : 12 cases, équiper (la pièce quitte l'inventaire), remplacer, retirer, relecture sans duplication. */
import { pieceGS } from '../src/meta/gearscore.js';
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

test('les 13 cases demandées (dont 2 d\'anneau, 23/10 ; torche, 25/10)', () => {
  assert.deepEqual(SLOT_IDS, ['casque','torse','jambes','pieds','gants','ceinture','pioche','epee','cape','boussole','anneau1','anneau2','torche']);
  assert.equal(STUFF.slots.length, 13);
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

test('pièces en chitine : bonus affichés (oxygène, pods, vitesses), clés de stats du mineur connues', async () => {
  const { STATS, ITEMS, TEXTURES } = await import('../src/config.js');
  const { statsText } = await import('../src/meta/stuff.js');
  const { existsSync } = await import('node:fs');
  assert.equal(statsText('Casque en chitine'), 'Oxygène +25');
  assert.equal(statsText('Plastron en chitine'), 'Pods +17');
  assert.equal(statsText('Jambes en chitine'), 'Vitesse (échelle) +0,4');
  assert.equal(statsText('Bottes en chitine'), 'Vitesse (marche) +0,42');
  assert.equal(statsText(PICK), 'Vitesse de minage +0,2');
  for(const [name, d] of Object.entries(STUFF.items)){
    for(const k of Object.keys(d.stats || {})){ assert.ok(k in STATS, `${name} : stat ${k} inconnue`); assert.ok(STUFF.statLabels[k], k); }
    assert.ok(TEXTURES.includes(ITEMS[name].tex) && existsSync(new URL(`../textures/${d.tex}.png`, import.meta.url)), d.tex);
  }
  const inv = createInventory(); addItem(inv, 'Bottes en chitine', 1);
  assert.equal(piecesFor(inv, 'pieds').length, 1);
});

test('bulle d\'info du stuff : le nom, puis un effet par ligne ; rien pour un objet qui n\'est pas du stuff', async () => {
  const { stuffTip } = await import('../src/meta/stuff.js');
  assert.equal(stuffTip(PICK), `Pioche en pierre\nVitesse de minage +0,2\nGS ${pieceGS(PICK)}`);
  assert.equal(stuffTip('Casque en chitine'), `Casque en chitine\nOxygène +25\nGS ${pieceGS('Casque en chitine')}`);
  assert.equal(stuffTip('Charbon'), null);
  assert.equal(stuffTip('Objet inconnu'), null);
});

test('stats du mineur : base + bonus des pièces portées, arrondies ; sans stuff = la base', async () => {
  const { STATS } = await import('../src/config.js');
  const { minerStats } = await import('../src/meta/stuff.js');
  const get = (worn, key) => minerStats(worn).find(s => s.key === key);
  assert.deepEqual(get({}, 'oxygenMax'), { key:'oxygenMax', label:'Oxygène', base:STATS.oxygenMax, bonus:0, mult:1, add:0, skill:0, ring:0, total:STATS.oxygenMax });
  const worn = { casque:{ item:'Casque en chitine', uid:1 }, jambes:{ item:'Jambes en chitine', uid:2 }, pioche:{ item:PICK, uid:3 }, torse:null };
  assert.equal(get(worn, 'oxygenMax').total, STATS.oxygenMax + 25);
  assert.equal(get(worn, 'climbSpeed').total, Math.round((STATS.climbSpeed + 0.4) * 100) / 100);
  assert.equal(get(worn, 'mineSpeed').bonus, 0.2);
  assert.equal(get(worn, 'pods').bonus, 0);
  for(const s of minerStats(worn)) assert.ok(s.key in STATS && s.label, s.key);
});

test('inventaire : bouton « Équiper » sur une pièce de stuff, avec la pièce qu\'elle remplace', async () => {
  globalThis.document ??= { getElementById: () => null };       // le module d'interface ne touche pas au DOM au chargement
  const { equipHtml } = await import('../src/ui/inventory.js');
  const h = equipHtml({ item:'Casque en fer', qty:1, uid:7 }, { casque:{ item:'Casque en chitine', uid:3 } });
  assert.match(h, /data-uid="7"/); assert.match(h, /data-slot="casque"/);
  assert.match(h, /remplace Casque en chitine/);
  assert.doesNotMatch(equipHtml({ item:'Épée en fer', qty:1, uid:8 }, {}), /remplace/);
  assert.equal(equipHtml({ item:'Charbon', qty:50 }, {}), '', 'pas un objet de stuff : pas de bouton');
});
