/* Sets : enregistrer, équiper (stuff, skills, sorts d'un coup), renommer, supprimer ; serveur et affichage.
   GAME_DESIGN §6 « Sets ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETS } from '../src/config.js';
import { createSets, setOp, applySet, snapshot, sanitizeSets, cleanName, equippedSet } from '../src/meta/sets.js';
import { createStuff, stuffOp } from '../src/meta/stuff.js';
import { createSkills } from '../src/meta/skills.js';
import { createSpells } from '../src/meta/spells.js';
import { createInventory, addItem, serialize } from '../src/meta/inventory.js';

const PICK = 'Pioche en fer', HELM = 'Casque en fer';
/* inventaire avec deux pioches et un casque (pièces : uid), stuff vide */
function kit(){
  const inv = createInventory(); addItem(inv, PICK, 2); addItem(inv, HELM, 1);
  const uid = item => inv.slots.filter(s => s?.item === item).map(s => s.uid);
  return { inv, stuff:createStuff(), skills:createSkills(), spells:createSpells(), uid };
}
const wear = (k, slot, uid, opId) => assert.ok(stuffOp(k.inv, k.stuff, { action:'equip', slot, uid, opId }).ok);

test('noms : texte de 1 à 24 caractères, espaces resserrés', () => {
  assert.equal(cleanName('  Farm   fer '), 'Farm fer');
  for(const bad of ['', '   ', 'x'.repeat(SETS.max + 5), 42, null, ['a']]) assert.equal(cleanName(bad), null);
});

test('créer, enregistrer, renommer, supprimer ; « Set n » libre ; garde-fou du nombre ; double clic sans effet', () => {
  const k = kit(), sets = createSets();
  const cur = () => snapshot(k.stuff, k.skills, k.spells);
  assert.deepEqual(setOp(sets, { action:'create', opId:'c1' }, cur()), { ok:true, repeated:false, id:1 });
  assert.deepEqual(setOp(sets, { action:'create', opId:'c1' }, cur()), { ok:true, repeated:true });
  setOp(sets, { action:'create', opId:'c2' }, cur());
  assert.deepEqual(sets.list.map(s => s.name), ['Set 1', 'Set 2']);
  wear(k, 'pioche', k.uid(PICK)[0], 'w1');
  setOp(sets, { action:'save', id:1, opId:'s1' }, cur());
  assert.equal(typeof sets.list[0].stuff.pioche, 'number');
  assert.deepEqual(sets.list[1].stuff, {}, 'l\'autre set ne bouge pas');
  setOp(sets, { action:'rename', id:2, name:'Farm fer', opId:'r1' });
  assert.deepEqual(setOp(sets, { action:'rename', id:2, name:'', opId:'r2' }), { error:'bad_name' });
  setOp(sets, { action:'delete', id:1, opId:'d1' });
  setOp(sets, { action:'create', opId:'c3' }, cur());
  assert.deepEqual(sets.list.map(s => [s.id, s.name]), [[2, 'Farm fer'], [3, 'Set 1']]);
  for(const id of [1, 99, '2', null]) assert.ok(setOp(sets, { action:'save', id, opId:'x' + id }, cur()).error);
  for(let i = sets.list.length; i < SETS.max; i++) setOp(sets, { action:'create', opId:'m' + i }, cur());
  assert.deepEqual(setOp(sets, { action:'create', opId:'trop' }, cur()), { error:'too_many' });
});

test('équiper : les pièces du set reviennent dans leurs cases, le reste à l\'inventaire ; pièce disparue = case vide', () => {
  const k = kit(), sets = createSets(), [p1, p2] = k.uid(PICK), [h] = k.uid(HELM);
  wear(k, 'pioche', p1, 'w1'); wear(k, 'casque', h, 'w2');
  setOp(sets, { action:'create', opId:'c1' }, snapshot(k.stuff, k.skills, k.spells));
  wear(k, 'pioche', p2, 'w3');                                          // on change de pioche, on retire le casque
  stuffOp(k.inv, k.stuff, { action:'unequip', slot:'casque', opId:'w4' });
  const r = applySet(sets, { id:1, opId:'e1' }, { ...k, points:0, spec:{} });
  assert.deepEqual(r, { ok:true, repeated:false, missing:0 });
  assert.deepEqual([k.stuff.worn.pioche.uid, k.stuff.worn.casque.uid], [p1, h]);
  assert.deepEqual(k.uid(PICK), [p2], 'l\'autre pioche est dans l\'inventaire');
  assert.deepEqual(applySet(sets, { id:1, opId:'e1' }, { ...k, points:0, spec:{} }), { ok:true, repeated:true, missing:0 });
  /* la pioche du set disparaît (sacrifiée…) : case vide, rien d'autre */
  stuffOp(k.inv, k.stuff, { action:'unequip', slot:'pioche', opId:'w5' });
  k.inv.slots = k.inv.slots.map(s => s?.uid === p1 ? null : s);
  const r2 = applySet(sets, { id:1, opId:'e2' }, { ...k, points:0, spec:{} });
  assert.equal(r2.missing, 1);
  assert.equal(k.stuff.worn.pioche, null);
  assert.equal(k.stuff.worn.casque.uid, h);
  const pieces = k.inv.slots.filter(Boolean).length + Object.values(k.stuff.worn).filter(Boolean).length;
  assert.equal(pieces, 2, 'aucune pièce créée ni perdue');
});

test('équiper : skills remis (revérifiés avec les points) et sorts encore équipables', () => {
  const k = kit(), sets = createSets();
  k.skills.tree = 'barbare'; k.skills.ranks = { damage:3, taunt:1 };
  k.spells.learned = ['ulti_shen']; k.spells.slots = ['dash', 'ulti_shen'];
  setOp(sets, { action:'create', opId:'c1' }, snapshot(k.stuff, k.skills, k.spells));
  k.skills.tree = null; k.skills.ranks = {}; k.spells.slots = [null, null];
  applySet(sets, { id:1, opId:'e1' }, { ...k, points:4, spec:{ barbare:5 } });
  assert.deepEqual([k.skills.tree, k.skills.ranks], ['barbare', { damage:3, taunt:1 }]);
  assert.deepEqual(k.spells.slots, ['dash', 'ulti_shen']);
  applySet(sets, { id:1, opId:'e2' }, { ...k, points:2, spec:{ barbare:4 } });
  assert.deepEqual(k.skills.ranks, { damage:2 }, 'pas assez de points : les rangs en trop sont rendus');
  assert.deepEqual(k.spells.slots, [null, 'ulti_shen'], 'Dash pas débloqué : retiré');
});

test('relecture : sets invalides, doublons et cases inconnues retirés ; nom par défaut', () => {
  const s = sanitizeSets({ nextId:2, ops:['a', 3], list:[
    { id:1, name:'A', stuff:{ pioche:5, inconnu:3, casque:-1 }, skills:{ tree:'barbare', ranks:{ damage:9 } }, spells:['dash', 'x', 'ulti_shen'] },
    { id:1, name:'doublon' }, { id:'7' }, null, { id:4, name:'' } ] });
  assert.deepEqual(s.list.map(x => [x.id, x.name]), [[1, 'A'], [4, 'Set 4']]);
  assert.deepEqual(s.list[0].stuff, { pioche:5 });
  assert.deepEqual(s.list[0].skills, { tree:'barbare', ranks:{ damage:3 } });
  assert.deepEqual(s.list[0].spells, ['dash', null]);
  assert.equal(s.nextId, 5); assert.deepEqual(s.ops, ['a']);
  assert.deepEqual(sanitizeSets('n\'importe quoi'), createSets());
});

/* ---------- serveur ---------- */

async function server(){
  const { createMemoryGameStore } = await import('../server/game/store.js');
  const { createGameService } = await import('../server/game/service.js');
  const { fakeLive } = await import('./helpers.js');
  const store = createMemoryGameStore();
  const k = kit();
  await store.putInventory('AAAA1111', JSON.parse(serialize(k.inv)));
  await store.putProgress('AAAA1111', { xp:2600, spec:{ barbare:8125 }, credited:[] });
  const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock:() => 1e6, randomSeed:() => 1 });
  return { game, store, uid:k.uid };
}
const ME = { id:'AAAA1111', name:'Zoe' };

test('serveur : un set enregistre et remet stuff, skills et sorts ; créer / enregistrer permis pendant une session', async () => {
  const { game, uid } = await server(), [p1] = uid(PICK);
  await game.stuff(ME, { action:'equip', slot:'pioche', uid:p1, opId:'op-set-w1' });
  await game.skills(ME, { action:'learn', node:'damage', opId:'op-set-k1' });
  await game.spells(ME, { action:'equip', spell:'dash', slot:0, opId:'op-set-p1' });
  let r = await game.sets(ME, { action:'create', opId:'op-set-c1' });
  assert.deepEqual(r.sets.list[0].skills, { tree:'barbare', ranks:{ damage:1 } });
  await game.stuff(ME, { action:'unequip', slot:'pioche', opId:'op-set-w2' });
  await game.skills(ME, { action:'reset', opId:'op-set-k2' });
  r = await game.sets(ME, { action:'equip', id:1, opId:'op-set-e1' });
  assert.equal(r.stuff.pioche.uid, p1);
  assert.deepEqual([r.skills.tree, r.skills.ranks, r.spells.slots], ['barbare', { damage:1 }, ['dash', null]]);
  assert.equal(r.missing, 0);
  assert.deepEqual((await game.state(ME)).sets.list.map(s => s.name), ['Set 1']);
  /* 28/10/2026 (Geoffrey) : enregistrer et créer sont permis pendant une session (rien ne bouge : le set note l'équipement) */
  await game.start(ME, {});
  await game.stuff(ME, { action:'unequip', slot:'pioche', opId:'op-set-w3' });
  r = await game.sets(ME, { action:'save', id:1, opId:'op-set-s-save' });
  assert.equal(r.sets.list[0].stuff.pioche, undefined, 'enregistrer en session : le set prend l\'équipement actuel');
  r = await game.sets(ME, { action:'create', opId:'op-set-s-create' });
  assert.deepEqual(r.sets.list.map(s => s.name), ['Set 1', 'Set 2'], 'créer en session');
  r = await game.sets(ME, { action:'create', opId:'op-set-s-create' });
  assert.equal(r.sets.list.length, 2, 'demande rejouée : pas de 3e set');
  r = await game.sets(ME, { action:'rename', id:1, name:'Barbare', opId:'op-set-rn1' });
  assert.equal(r.sets.list[0].name, 'Barbare', 'renommer reste possible');
  await assert.rejects(game.sets(ME, { action:'bidule', opId:'op-set-bad1' }), { code:'bad_request' });
  await assert.rejects(game.sets(ME, { action:'equip', id:1, opId:'x' }), { code:'bad_request' });
});

/* 28/10/2026 (Geoffrey) : équiper un set pendant une session prépare la prochaine ; la session en cours garde
   l'équipement figé à son lancement */
test('serveur : équiper un set pendant une session ; la session en cours ne change pas, la suivante prend le set', async () => {
  const { game, store, uid } = await server(), [p1] = uid(PICK);
  await game.skills(ME, { action:'learn', node:'damage', opId:'op-ses-k1' });
  await game.sets(ME, { action:'create', opId:'op-ses-c1' });                       // set 1 : sans pioche, damage 1
  await game.stuff(ME, { action:'equip', slot:'pioche', uid:p1, opId:'op-ses-w1' });
  await game.skills(ME, { action:'reset', opId:'op-ses-k2' });
  const s1 = await game.start(ME, {}), id1 = s1.session?.id ?? s1.id;
  const rec1 = await store.getGameSession(id1);
  assert.ok(rec1?.gear?.AAAA1111 && rec1.skills?.AAAA1111, 'session lancée, équipement figé');
  assert.equal(rec1.gear.AAAA1111.pioche?.item, PICK, 'lancée avec la pioche');
  const frozen = JSON.stringify([rec1.gear, rec1.skills, rec1.spells]);
  const r = await game.sets(ME, { action:'equip', id:1, opId:'op-ses-e1' });
  assert.equal(r.stuff.pioche, null, 'le compte porte le set');
  assert.deepEqual(r.skills.ranks, { damage:1 });
  assert.ok(Array.isArray((await game.state(ME)).inventory.slots), 'état lisible');
  const rec2 = await store.getGameSession(id1);
  assert.equal(JSON.stringify([rec2.gear, rec2.skills, rec2.spells]), frozen, 'la session en cours garde son équipement');
  const again = await game.sets(ME, { action:'equip', id:1, opId:'op-ses-e1' });
  assert.equal(again.stuff.pioche, null, 'demande rejouée : rien de plus');
});

/* ---------- affichage ---------- */

test('panneau des sets : Équiper / Enregistrer par set, « + Nouveau set » jusqu\'au garde-fou, tout permis en session, grisé pendant une demande', async () => {
  const { setsHtml } = await import('../src/ui/sets.js');
  const list = [{ id:1, name:'Set 1' }, { id:2, name:'<b>' }];
  const h = setsHtml({ list, max:20 });
  assert.equal((h.match(/data-act="equip"/g) || []).length, 2);
  assert.equal((h.match(/data-act="save"/g) || []).length, 2);
  assert.match(h, /\+ Nouveau set/); assert.match(h, /&lt;b&gt;/);
  assert.doesNotMatch(setsHtml({ list, max:2 }), /Nouveau set/);
  const inSession = setsHtml({ list, max:20 }, { locked:true });
  assert.doesNotMatch(inSession, /data-act="equip" disabled/, 'équiper reste possible en session (28/10)');
  assert.doesNotMatch(inSession, /data-act="(save|create)" disabled/, 'enregistrer et créer restent possibles en session (28/10)');
  assert.match(inSession, /prochaine session/);
  const busy = setsHtml({ list, max:20 }, { busy:true });
  assert.match(busy, /data-act="equip" disabled/); assert.match(busy, /data-act="save" disabled/);
});

test('set équipé (29/10/2026) : celui qui correspond exactement à l\'équipement actuel, sinon aucun ; ligne dans la liste', async () => {
  const k = kit(), sets = createSets();
  const cur = () => snapshot(k.stuff, k.skills, k.spells);
  const now = () => equippedSet(sets.list, k.stuff.worn, k.skills, k.spells.slots);
  assert.equal(now(), null, 'aucun set');
  setOp(sets, { action:'create', opId:'c1' }, cur());                 // Set 1 : rien de porté
  assert.equal(now()?.name, 'Set 1');
  wear(k, 'pioche', k.uid(PICK)[0], 'w1');
  assert.equal(now(), null, 'pièce portée en plus : plus le set');
  setOp(sets, { action:'create', opId:'c2' }, cur());                 // Set 2 : la pioche
  assert.equal(now()?.name, 'Set 2');
  wear(k, 'pioche', k.uid(PICK)[0], 'w2');                            // l'autre exemplaire (resté dans l'inventaire) : pas la même pièce
  assert.equal(now(), null);
  k.skills.ranks.x_inconnu = 0;                                       // un rang à 0 ne compte pas
  applySet(sets, { id:2, opId:'e1' }, { ...k, points:0, spec:{} });
  assert.equal(now()?.name, 'Set 2');
  k.spells.slots[0] = 'dash';
  assert.equal(now(), null, 'sort différent');
  const { setsHtml } = await import('../src/ui/sets.js');
  assert.match(setsHtml({ list:sets.list }, { current:sets.list[1] }), /Set équipé : <b>Set 2<\/b>[^]*setRow on" data-set="2"/);
  assert.match(setsHtml({ list:sets.list }), /Set équipé : <span class="mut">aucun/);
  assert.doesNotMatch(setsHtml({ list:[] }), /Set équipé/);
});
