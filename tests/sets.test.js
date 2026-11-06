/* Sets : enregistrer, équiper (stuff, skills, sorts d'un coup), renommer, supprimer ; serveur et affichage.
   GAME_DESIGN §6 « Sets ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETS } from '../src/config.js';
import { createSets, setOp, applySet, snapshot, sanitizeSets, cleanName, equippedSet, checkDraft } from '../src/meta/sets.js';
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
  assert.deepEqual(k.spells.slots, ['dash', 'ulti_shen', null, null]);
  applySet(sets, { id:1, opId:'e2' }, { ...k, points:2, spec:{ barbare:4 } });
  assert.deepEqual(k.skills.ranks, { damage:2 }, 'pas assez de points : les rangs en trop sont rendus');
  assert.deepEqual(k.spells.slots, [null, 'ulti_shen', null, null], 'Dash pas débloqué : retiré');
});

test('relecture : sets invalides, doublons et cases inconnues retirés ; nom par défaut', () => {
  const s = sanitizeSets({ nextId:2, ops:['a', 3], list:[
    { id:1, name:'A', stuff:{ pioche:5, inconnu:3, casque:-1 }, skills:{ tree:'barbare', ranks:{ damage:9 } }, spells:['dash', 'x', 'ulti_shen'] },
    { id:1, name:'doublon' }, { id:'7' }, null, { id:4, name:'' } ] });
  assert.deepEqual(s.list.map(x => [x.id, x.name]), [[1, 'A'], [4, 'Set 4']]);
  assert.deepEqual(s.list[0].stuff, { pioche:5 });
  assert.deepEqual(s.list[0].skills, { v:3, tree:'barbare', ranks:{ damage:3 } });
  assert.deepEqual(s.list[0].spells, ['dash', null, 'ulti_shen', null]);   // 4 emplacements (05/11)
  assert.equal(s.nextId, 5); assert.deepEqual(s.ops, ['a']);
  assert.deepEqual(sanitizeSets('n\'importe quoi'), createSets());
});

/* ---------- Aperçu set (06/11/2026, Geoffrey) : un brouillon composé pièce par pièce, revérifié ---------- */

test('brouillon : pièces du sac ou portées, bonne case, jamais deux fois le même objet ; uid d\'un autre = refusé', () => {
  const k = kit(), [p1, p2] = k.uid(PICK), [h] = k.uid(HELM);
  wear(k, 'casque', h, 'w1');
  const own = { inv:k.inv, worn:k.stuff.worn, spells:k.spells, points:0, spec:{} };
  assert.deepEqual(checkDraft({ stuff:{ pioche:p2, casque:h } }, own).stuff, { pioche:p2, casque:h }, 'sac + porté');
  assert.deepEqual(checkDraft({ stuff:{ pioche:null } }, own).stuff, {}, 'case vide');
  assert.deepEqual(checkDraft({ stuff:{ pioche:9999 } }, own), { error:'not_owned' });
  assert.deepEqual(checkDraft({ stuff:{ casque:p1 } }, own), { error:'wrong_slot' });
  assert.deepEqual(checkDraft({ stuff:{ inconnu:p1 } }, own), { error:'bad_request' });
  for(const bad of [{ pioche:'1' }, { pioche:-1 }, { pioche:1.5 }, { pioche:Infinity }, [p1]])
    assert.deepEqual(checkDraft({ stuff:bad }, own), { error:'bad_request' }, JSON.stringify(bad));
  for(const bad of [null, 'x', { spells:'dash' }, { spells:Array(9).fill(null) }, { skills:{ tree:'pirate' } }, { skills:{ ranks:[1] } }, { spells:['inconnu'] }])
    assert.deepEqual(checkDraft(bad, own), { error:'bad_request' }, JSON.stringify(bad));
  /* le même anneau dans les deux cases */
  const inv = createInventory(); addItem(inv, 'Anneau du tigre', 2);
  const [r1, r2] = inv.slots.filter(Boolean).map(s => s.uid);
  assert.deepEqual(checkDraft({ stuff:{ anneau1:r1, anneau2:r2 } }, { inv }), { error:'same_ring' });
  assert.deepEqual(checkDraft({ stuff:{ anneau1:r1, anneau2:r1 } }, { inv }), { error:'same_ring' });
});

test('brouillon : rangs en trop rendus (points du niveau), sorts revérifiés avec la spé du set et les emplacements ouverts', () => {
  const k = kit();
  k.spells.learned = ['ulti_shen'];
  const own = { inv:k.inv, worn:k.stuff.worn, spells:k.spells, points:2, spec:{ barbare:5 }, level:1 };
  const d = checkDraft({ skills:{ tree:'barbare', ranks:{ damage:3, taunt:1 } }, spells:['dash', 'ulti_shen', 'dash', 'illumination'] }, own);
  assert.deepEqual(d.skills, { v:3, tree:'barbare', ranks:{ damage:2 } });
  assert.deepEqual(d.spells, ['dash', 'ulti_shen', null, null], 'niveau 1 : 2 emplacements ouverts ; un sort une fois');
  const m = checkDraft({ skills:{ tree:'mineur', ranks:{} }, spells:['dash', 'ulti_shen'] }, own);
  assert.deepEqual(m.spells, [null, 'ulti_shen', null, null], 'Dash réservé au barbare : retiré');
  assert.deepEqual(checkDraft({ spells:['ulti_shen'] }, { ...own, spells:{ learned:[] } }).spells, [null, null, null, null], 'parchemin pas appris');
});

test('edit : remplace un set existant (rien d\'équipé), crée avec id null, nom optionnel ; set inconnu, nom vide, garde-fou', () => {
  const k = kit(), sets = createSets(), [p1] = k.uid(PICK);
  setOp(sets, { action:'create', opId:'c1' }, snapshot(k.stuff, k.skills, k.spells));
  const draft = checkDraft({ stuff:{ pioche:p1 } }, { inv:k.inv, worn:k.stuff.worn, spells:k.spells });
  assert.deepEqual(setOp(sets, { action:'edit', id:1, opId:'e1' }, draft), { ok:true, repeated:false, id:1 });
  assert.deepEqual(sets.list[0].stuff, { pioche:p1 });
  assert.equal(sets.list[0].name, 'Set 1');
  assert.equal(k.stuff.worn.pioche, null, 'rien n\'est équipé');
  assert.deepEqual(setOp(sets, { action:'edit', id:1, opId:'e1' }, { stuff:{} }), { ok:true, repeated:true });
  assert.deepEqual(sets.list[0].stuff, { pioche:p1 }, 'rejoué : rien ne change');
  assert.deepEqual(setOp(sets, { action:'edit', id:null, name:'  Farm ', opId:'e2' }, draft), { ok:true, repeated:false, id:2 });
  assert.deepEqual(sets.list.map(s => s.name), ['Set 1', 'Farm']);
  assert.deepEqual(setOp(sets, { action:'edit', id:1, name:'Barbare', opId:'e3' }, draft).id, 1);
  assert.equal(sets.list[0].name, 'Barbare');
  for(const id of [99, '1', 0]) assert.deepEqual(setOp(sets, { action:'edit', id, opId:'u' + id }, draft), { error:'unknown' });
  assert.deepEqual(setOp(sets, { action:'edit', id:1, name:'', opId:'e4' }, draft), { error:'bad_name' });
  for(let i = sets.list.length; i < SETS.max; i++) setOp(sets, { action:'create', opId:'m' + i }, draft);
  assert.deepEqual(setOp(sets, { action:'edit', id:null, opId:'trop' }, draft), { error:'too_many' });
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
  await game.skills(ME, { action:'spec', tree:'barbare', opId:'op-set-k0' });
  await game.skills(ME, { action:'learn', node:'damage', opId:'op-set-k1' });
  await game.spells(ME, { action:'equip', spell:'dash', slot:0, opId:'op-set-p1' });
  let r = await game.sets(ME, { action:'create', opId:'op-set-c1' });
  assert.deepEqual(r.sets.list[0].skills, { v:3, tree:'barbare', ranks:{ damage:1 } });
  await game.stuff(ME, { action:'unequip', slot:'pioche', opId:'op-set-w2' });
  await game.skills(ME, { action:'reset', opId:'op-set-k2' });
  r = await game.sets(ME, { action:'equip', id:1, opId:'op-set-e1' });
  assert.equal(r.stuff.pioche.uid, p1);
  assert.deepEqual([r.skills.tree, r.skills.ranks, r.spells.slots], ['barbare', { damage:1 }, ['dash', null, null, null]]);
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
  await game.skills(ME, { action:'spec', tree:'barbare', opId:'op-ses-k0' });
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

test('serveur : Aperçu set — « Enregistrer » écrit le set sans rien équiper, « Enregistrer et équiper » l\'équipe ; pièce d\'un autre refusée', async () => {
  const { game, uid } = await server(), [p1, p2] = uid(PICK), [h] = uid(HELM);
  await game.stuff(ME, { action:'equip', slot:'pioche', uid:p1, opId:'op-ed-w1' });
  await game.sets(ME, { action:'create', opId:'op-ed-c1' });
  const before = await game.state(ME);
  let r = await game.sets(ME, { action:'edit', id:1, name:'Barbare', stuff:{ pioche:p2, casque:h },
    skills:{ tree:'barbare', ranks:{ damage:99 } }, spells:['dash', null], opId:'op-ed-e1' });
  assert.equal(r.sets.list[0].name, 'Barbare');
  assert.deepEqual(r.sets.list[0].stuff, { pioche:p2, casque:h });
  assert.ok(r.sets.list[0].skills.ranks.damage <= r.skills.points, 'rangs ramenés aux points du niveau');
  assert.equal(r.stuff.pioche.uid, p1, 'brouillon : le mineur garde sa pioche');
  assert.deepEqual([r.skills.tree, r.spells.slots], [before.skills.tree, before.spells.slots], 'skills et sorts du mineur inchangés');
  await assert.rejects(game.sets(ME, { action:'edit', id:1, stuff:{ pioche:123456 }, opId:'op-ed-e2' }), { code:'not_owned' });
  await assert.rejects(game.sets(ME, { action:'edit', id:1, stuff:{ casque:p2 }, opId:'op-ed-e3' }), { code:'wrong_slot' });
  await assert.rejects(game.sets(ME, { action:'edit', id:42, stuff:{}, opId:'op-ed-e4' }), { code:'unknown' });
  /* Enregistrer et équiper : un nouveau set, écrit puis équipé dans la même demande ; rejouée, rien de plus */
  r = await game.sets(ME, { action:'edit', id:null, stuff:{ casque:h }, skills:{ tree:'barbare', ranks:{ damage:1 } }, spells:[], equip:true, opId:'op-ed-e5' });
  assert.equal(r.id, 2);
  assert.deepEqual([r.stuff.pioche, r.stuff.casque?.uid, r.skills.tree, r.skills.ranks], [null, h, 'barbare', { damage:1 }]);
  assert.equal(r.missing, 0);
  const again = await game.sets(ME, { action:'edit', id:null, stuff:{}, equip:true, opId:'op-ed-e5' });
  assert.equal(again.sets.list.length, 2, 'demande rejouée : pas de 3e set');
  assert.equal(again.stuff.casque.uid, h);
  /* permis pendant une session, comme Enregistrer */
  await game.start(ME, {});
  r = await game.sets(ME, { action:'edit', id:1, stuff:{ pioche:p1 }, opId:'op-ed-e6' });
  assert.deepEqual(r.sets.list[0].stuff, { pioche:p1 });
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
  assert.match(setsHtml({ list:sets.list }, { current:sets.list[1] }), /Set équipé : <b><bdi data-noi18n>Set 2<\/bdi><\/b>[^]*setRow on" data-set="2"/);
  assert.match(setsHtml({ list:sets.list }), /Set équipé : <span class="mut">aucun/);
  assert.doesNotMatch(setsHtml({ list:[] }), /Set équipé/);
});

test('sets : textes de la pop-up de confirmation', async () => {
  const { savedText, equippedText } = await import('../src/ui/sets.js');
  assert.equal(savedText('Mine'), 'Stuff bien sauvegardé dans « Mine »');
  assert.equal(equippedText('Mine'), 'Set « Mine » bien équipé');
  assert.equal(equippedText('Mine', 1), 'Set « Mine » équipé : 1 pièce introuvable');
  assert.equal(equippedText('Mine', 2), 'Set « Mine » équipé : 2 pièces introuvables');
  assert.equal(equippedText('Mine', 0, true), 'Set « Mine » bien équipé. Il compte dès la prochaine session.');
});

/* set de l'activité équipé tout seul au lancement (06/11/2026) : la page le dit, seulement si le set porté a changé */
test('sets : message quand le lancement a équipé le set de l\'activité', async () => {
  const { autoSetText } = await import('../src/ui/sets.js');
  const a = { id:1, name:'Mine' }, b = { id:2, name:'Prison' };
  assert.equal(autoSetText(a, b), 'Set « Prison » équipé : c\'est le set défini pour cette activité');
  assert.equal(autoSetText(null, b), 'Set « Prison » équipé : c\'est le set défini pour cette activité');
  assert.equal(autoSetText(b, b), null);      // déjà porté : rien
  assert.equal(autoSetText(a, null), null);   // plus aucun set reconnu (pièce introuvable…) : rien
});

/* appli (03/11/2026) : une ligne « Set : x ▾ » et un menu qui monte du bas (spec 2026-11-03-appli-perso-sets-stuff-design.md) */
test('appli : la ligne des sets dit le set équipé, ou « aucun » ; nom échappé', async () => {
  const { setsBarHtml } = await import('../src/ui/sets.js');
  const h = setsBarHtml({ id:1, name:'barb' });
  assert.match(h, /data-act="sheet"/); assert.match(h, /barb/); assert.match(h, /▾/);
  assert.match(setsBarHtml(null), /aucun/);
  assert.match(setsBarHtml({ id:1, name:'<b>' }), /&lt;b&gt;/);
});

test('appli : le menu des sets — Équiper (grisé pour le set porté), ⋯ qui déplie Enregistrer / Renommer / Supprimer, garde-fous', async () => {
  const { setsSheetHtml } = await import('../src/ui/sets.js');
  const st = { list:[{ id:1, name:'barb' }, { id:2, name:'Mineur' }], max:20 };
  const h = setsSheetHtml(st, { current:{ id:1 } });
  assert.equal((h.match(/data-act="equip"/g) || []).length, 2);
  assert.match(h, /data-set="1"[^]*?data-act="equip" disabled/);
  assert.equal((h.match(/✔ équipé/g) || []).length, 1);
  assert.equal((h.match(/data-act="more"/g) || []).length, 2);
  assert.doesNotMatch(h, /data-act="delete"/);
  assert.match(h, /\+ Nouveau set/); assert.match(h, /data-act="close"/);
  const open = setsSheetHtml(st, { current:{ id:1 }, more:2 });
  for(const act of ['save', 'rename', 'delete']) assert.equal((open.match(new RegExp(`data-act="${act}"`, 'g')) || []).length, 1, act);
  assert.match(open, /data-set="2"[^]*data-act="delete"/); assert.doesNotMatch(open.split('data-set="2"')[0], /data-act="delete"/);
  assert.doesNotMatch(setsSheetHtml({ ...st, max:2 }), /Nouveau set/);
  assert.equal((setsSheetHtml(st, { busy:true }).match(/data-act="equip" disabled/g) || []).length, 2);
  assert.match(setsSheetHtml(st, { locked:true }), /prochaine session/);
  assert.match(setsSheetHtml(st, { msg:'Oups' }), /class="[^"]*err[^"]*">Oups/);
  const empty = setsSheetHtml({ list:[], max:20 });
  assert.match(empty, /Aucun set/); assert.match(empty, /\+ Nouveau set/);
  assert.match(setsSheetHtml({ list:[{ id:3, name:'<i>' }], max:20 }), /&lt;i&gt;/);
});

/* ---------- set par activité (03/11/2026, Geoffrey) ---------- */
import { setActivity, setForMode } from '../src/meta/sets.js';
import { activityLineHtml } from '../src/ui/sets.js';

test('set par activité : activité d\'un mode (instances et tours groupées), associer, dissocier, set supprimé = dissocié', () => {
  assert.equal(setActivity('mine'), 'mine'); assert.equal(setActivity('prison'), 'prison'); assert.equal(setActivity('mi'), 'mi');
  assert.equal(setActivity('giant'), 'giant'); assert.equal(setActivity('geante'), 'geante'); assert.equal(setActivity('hescoming'), 'hescoming');
  assert.equal(setActivity('instance_2'), 'instances'); assert.equal(setActivity('tower_demon'), 'towers');
  for(const m of ['bidule', null, 3, '__proto__']) assert.equal(setActivity(m), null, String(m));
  const sets = createSets(), cur = { stuff:{}, skills:{ tree:null, ranks:{} }, spells:[null, null] };
  setOp(sets, { action:'create', opId:'op-a-c1' }, cur); setOp(sets, { action:'create', opId:'op-a-c2' }, cur);
  assert.ok(setOp(sets, { action:'assign', activity:'giant', id:2, opId:'op-a-1' }).ok);
  assert.equal(setForMode(sets, 'giant').id, 2); assert.equal(setForMode(sets, 'mine'), null);
  assert.ok(setOp(sets, { action:'assign', activity:'instances', id:1, opId:'op-a-2' }).ok);
  assert.equal(setForMode(sets, 'instance_1').id, 1);
  assert.equal(setOp(sets, { action:'assign', activity:'giant', id:9, opId:'op-a-3' }).error, 'unknown');
  assert.equal(setOp(sets, { action:'assign', activity:'volcan', id:1, opId:'op-a-4' }).error, 'bad_request');
  assert.ok(setOp(sets, { action:'assign', activity:'instances', id:null, opId:'op-a-5' }).ok);
  assert.equal(setForMode(sets, 'instance_1'), null, 'dissocié');
  setOp(sets, { action:'delete', id:2, opId:'op-a-6' });
  assert.deepEqual(sets.byActivity, {}, 'set supprimé : plus associé');
  /* relecture : activités connues et sets existants seulement */
  const back = sanitizeSets({ list:[{ id:1, name:'A', stuff:{}, skills:{}, spells:[] }], byActivity:{ mine:1, giant:7, volcan:1, __proto__:1 } });
  assert.deepEqual(back.byActivity, { mine:1 });
});

test('ligne du Lobby : « Set défini pour … » avec aucun et chaque set, celui associé choisi ; rien hors activité', () => {
  const html = activityLineHtml({ list:[{ id:1, name:'Mine' }, { id:2, name:'Bloc <b>' }], byActivity:{ giant:2 } }, 'giant');
  assert.match(html, /Set défini pour le Bloc géant :/);
  assert.match(html, /<option value="2" selected>Bloc &lt;b&gt;<\/option>/);
  assert.match(html, /data-activity="giant"/);
  assert.match(activityLineHtml({ list:[{ id:1, name:'A' }] }, 'tower_angel'), /les tours du Jugement/);
  assert.match(activityLineHtml({ list:[{ id:1, name:'A' }] }, 'mine'), /<option value="" selected>Aucun<\/option>/);
  assert.match(activityLineHtml({ list:[{ id:1, name:'A' }] }, 'geante'), /Set défini pour la Mine géante :.*data-activity="geante"/s);   // 06/11
  assert.equal(activityLineHtml({ list:[] }, null), '');
});

test('serveur : le set de l\'activité est équipé au lancement (mine, prison) et à l\'entrée du Bloc géant ; rien en session', async () => {
  const { game, store, uid } = await server(), [p1] = uid(PICK);
  await game.stuff(ME, { action:'equip', slot:'pioche', uid:p1, opId:'op-act-w1' });
  await game.sets(ME, { action:'create', opId:'op-act-c1' });                     // Set 1 : avec la pioche
  await game.stuff(ME, { action:'unequip', slot:'pioche', opId:'op-act-w2' });
  await game.sets(ME, { action:'create', opId:'op-act-c2' });                     // Set 2 : sans
  let r = await game.sets(ME, { action:'assign', activity:'mine', id:1, opId:'op-act-a1' });
  assert.deepEqual(r.sets.byActivity, { mine:1 });
  await game.sets(ME, { action:'assign', activity:'prison', id:2, opId:'op-act-a2' });
  await assert.rejects(game.sets(ME, { action:'assign', activity:'mine', id:5, opId:'op-act-a3' }), { code:'unknown' });
  const { session } = await game.start(ME, { mode:'mine' });
  assert.equal((await game.state(ME)).stuff.pioche?.uid, p1, 'lancement de la mine : Set 1 équipé');
  assert.equal((await store.getGameSession(session.id)).gear[ME.id].pioche?.uid, p1, 'la session part avec le set');
  /* en session : l'entrée du Bloc géant ne touche pas à l'équipement */
  await game.sets(ME, { action:'assign', activity:'giant', id:2, opId:'op-act-a4' });
  assert.equal(await game.autoEquip(ME.id, 'giant'), null);
  assert.equal((await game.state(ME)).stuff.pioche?.uid, p1);
  await game.leave(ME);
  /* hors session : Bloc géant → Set 2 (sans pioche) */
  r = await game.autoEquip(ME.id, 'giant');
  assert.equal(r.set, 'Set 2');
  assert.equal((await game.state(ME)).stuff.pioche ?? null, null);
  assert.equal(await game.autoEquip(ME.id, 'giant'), null, 'déjà équipé : rien');
  assert.equal(await game.autoEquip(ME.id, 'instance_1'), null, 'aucun set associé : rien');
});

test('appli : « 💾 Enregistrer » à côté du set quand l\'équipement ne correspond plus à aucun set (05/11)', async () => {
  const { setsBarHtml } = await import('../src/ui/sets.js');
  assert.doesNotMatch(setsBarHtml({ id:1, name:'barb' }), /quickSave/, 'équipement = un set : pas de bouton');
  const mod = setsBarHtml(null, { id:2, name:'mineur' });
  assert.match(mod, /data-act="quickSave"/); assert.match(mod, /mineur<\/bdi><\/b> <small class="mut">\(modifié\)/);
  assert.match(setsBarHtml(null, null), /nouveau set/);
  assert.match(setsBarHtml(null, { id:2, name:'x' }, true), /quickSave" disabled/);
});

/* ---------- Aperçu set (06/11/2026) : affichage ---------- */

test('Aperçu set : brouillon d\'un set (pièces disparues retirées, rangs ramenés), nouveau depuis le stuff ou vide, choix d\'une case', async () => {
  const { draftOf, draftKey, slotChoices, poolOf, previewListHtml, previewSpellsHtml } = await import('../src/ui/set-preview.js');
  const k = kit(), [p1, p2] = k.uid(PICK), [h] = k.uid(HELM);
  wear(k, 'pioche', p1, 'w1');
  k.skills.tree = 'barbare'; k.skills.ranks = { damage:2 };
  const c = { inv:k.inv, worn:k.stuff.worn, skills:{ tree:'barbare', ranks:{ damage:2 }, points:2 }, spells:{ learned:[], slots:['dash', null, null, null] }, specLevels:{ barbare:5 }, level:1 };
  const set = { id:3, name:'Farm', stuff:{ pioche:p2, casque:777 }, skills:{ tree:'barbare', ranks:{ damage:3 } }, spells:['dash', null, null, null] };
  const d = draftOf(set, c);
  assert.deepEqual([d.id, d.name, d.stuff, d.skills.ranks, d.spells, d.missing], [3, 'Farm', { pioche:p2 }, { damage:2 }, ['dash', null, null, null], 1]);
  assert.deepEqual(draftOf(null, c).stuff, { pioche:p1 }, 'nouveau : le stuff porté');
  assert.deepEqual([draftOf(null, c, 'empty').stuff, draftOf(null, c, 'empty').skills], [{}, { tree:'barbare', ranks:{} }], 'vide : la spé reste');
  assert.notEqual(draftKey(d), draftKey({ ...d, stuff:{} }));
  assert.equal(draftKey(d), draftKey({ ...d, name:' Farm ' }));
  const pool = poolOf(k.inv, k.stuff.worn);
  assert.deepEqual(slotChoices('pioche', d, pool).map(e => [e.piece.uid, e.worn]).sort(), [[p1, 'pioche'], [p2, null]].sort(), 'sac + portée');
  assert.deepEqual(slotChoices('casque', d, pool).map(e => e.piece.uid), [h]);
  const html = previewListHtml([{ id:3, name:'<b>x' }], d, { max:1 });
  assert.match(html, /data-pick="3"/); assert.doesNotMatch(html, /<b>x/); assert.doesNotMatch(html, /data-new/, 'garde-fou atteint : pas de nouveau set');
  const sp = previewSpellsHtml(['dash', null, null, null], 2);
  assert.equal((sp.match(/data-sslot/g) || []).length, 2, 'deux emplacements ouverts au niveau 1');
  assert.match(sp, /Niveau 15/);
});
