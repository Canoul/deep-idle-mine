/* Glyphes (25/10/2026, Geoffrey ; spec docs/superpowers/specs/2026-10-25-glyphes-design.md) : un parchemin lié à un
   skill, posé à côté de lui dans l'onglet Skills quand le skill est au rang max ; il ajoute un effet au skill. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { GLYPHS, ITEMS } from '../src/config.js';
import { NODES, sanitizeSkills, skillOp, skillEffects } from '../src/meta/skills.js';
import { rarityOf } from '../src/meta/rarity.js';
import { createInventory, addItem, countOf } from '../src/meta/inventory.js';
import { glyphOf, nodeOfGlyph, glyphOp, isActive, activeGlyphs, sessionSkills, withGlyphStats } from '../src/meta/glyphs.js';
import { STATS } from '../src/config.js';
import { minerSpecs } from '../src/shared/game.js';
import { minerStats } from '../src/meta/stuff.js';
import { W } from '../src/config.js';
import { mineBlock, killMob, hitDamage } from '../src/sim/actions.js';
import { ladderTime } from '../src/sim/mineur.js';
import { miLadderT } from '../src/sim/instant/ai.js';
import { addDungeon } from '../src/sim/dungeon.js';
import { worldFrom, run } from './helpers.js';
import { sanitizeSets, applySet } from '../src/meta/sets.js';
import { createSpells } from '../src/meta/spells.js';

test('glyphes : 10 objets, un par skill visé, catégorie glyph, épiques, texture présente', () => {
  const entries = Object.entries(GLYPHS.items);
  assert.equal(entries.length, 10);
  for(const [node, name] of entries){
    assert.ok(NODES[node], `${node} : skill connu`);
    assert.equal(ITEMS[name]?.cat, 'glyph', name);
    assert.equal(ITEMS[name].glyph, node);
    assert.equal(ITEMS[name].stack, true);
    assert.equal(rarityOf(name), 'epique', name);
    assert.ok(GLYPHS.desc[node], `${node} : texte joueur`);
  }
  for(const node of ['lazy_legend', 'winch_speed', 'taunt']) assert.equal(GLYPHS.items[node], undefined, `${node} : pas de glyphe`);
  assert.equal(GLYPHS.items.winch, 'Glyphe Treuil'); assert.equal(GLYPHS.liftSpeed, 1.5); assert.equal(GLYPHS.liftEvery, 2);
  for(const t of ['lift_rail', 'lift_top', 'lift_cabin']) assert.ok(existsSync(`textures/${t}.png`), t);
  assert.ok(existsSync('textures/glyph.png'));
  assert.equal(GLYPHS.rushTime, 5); assert.equal(GLYPHS.killDamageMax, 25); assert.equal(GLYPHS.braumOxygen, 0.3);
  assert.equal(GLYPHS.attackToMine, 0.1); assert.equal(GLYPHS.torchChance, 0.05); assert.equal(GLYPHS.ladderMult, 0.5);
  assert.equal(GLYPHS.oxygenToSpeed, 0.0003); assert.equal(GLYPHS.damageToPods, 3); assert.equal(GLYPHS.killDamagePct, 1);
});

/* ---------- pose et retrait (src/meta/glyphs.js) ---------- */

let nOp = 0; const op = () => 'op-glyph-' + String(++nOp).padStart(4, '0');
const RUSH = 'Glyphe Ruée';
/* mineur avec Pioche aiguisée 3/3, Second souffle 1/1, Ruée 5/5 (au max) ; partial : Ruée 4/5 */
const miner = (partial = false) => sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:partial ? 4 : 5 } });
const invWith = (items = {}) => { const inv = createInventory(); for(const [k, q] of Object.entries(items)) addItem(inv, k, q); return inv; };

test('glyphes : nom de l\'objet par skill, et l\'inverse', () => {
  assert.equal(glyphOf('ore_rush'), RUSH); assert.equal(nodeOfGlyph(RUSH), 'ore_rush');
  assert.equal(glyphOf('taunt'), null); assert.equal(glyphOf('__proto__'), null); assert.equal(nodeOfGlyph('Charbon'), null);
});

test('pose : skill au max + glyphe dans l\'inventaire → case remplie, objet retiré ; demande rejouée sans effet', () => {
  const st = miner(), inv = invWith({ [RUSH]:2 }), id = op();
  assert.deepEqual(glyphOp(st, inv, { action:'pose', node:'ore_rush', opId:id }), { ok:true, repeated:false });
  assert.equal(st.glyphs.ore_rush, RUSH); assert.equal(countOf(inv, RUSH), 1);
  assert.deepEqual(glyphOp(st, inv, { action:'pose', node:'ore_rush', opId:id }), { ok:true, repeated:true });
  assert.equal(countOf(inv, RUSH), 1, 'un seul objet retiré');
  assert.equal(isActive(st, 'ore_rush'), true);
});

test('pose : refus (skill pas au max, pas d\'objet, case prise, skill sans glyphe, demande trafiquée)', () => {
  const inv = invWith({ [RUSH]:3 });
  assert.equal(glyphOp(miner(true), inv, { action:'pose', node:'ore_rush', opId:op() }).error, 'not_max');
  assert.equal(glyphOp(miner(), invWith(), { action:'pose', node:'ore_rush', opId:op() }).error, 'not_owned');
  const st = miner(); glyphOp(st, inv, { action:'pose', node:'ore_rush', opId:op() });
  assert.equal(glyphOp(st, inv, { action:'pose', node:'ore_rush', opId:op() }).error, 'occupied');
  for(const node of ['taunt', '__proto__', 42, null, 'inconnu']) assert.equal(glyphOp(miner(), inv, { action:'pose', node, opId:op() }).error, 'unknown', String(node));
  assert.equal(glyphOp(miner(), inv, { action:'voler', node:'ore_rush', opId:op() }).error, 'bad_request');
  assert.equal(countOf(inv, RUSH), 2, 'seule la pose réussie a retiré un objet');
});

test('retrait : objet rendu, case vide ; case vide → empty ; pile pleine → inventory_full, rien ne bouge', () => {
  const st = miner(), inv = invWith({ [RUSH]:1 });
  glyphOp(st, inv, { action:'pose', node:'ore_rush', opId:op() });
  assert.deepEqual(glyphOp(st, inv, { action:'remove', node:'ore_rush', opId:op() }), { ok:true, repeated:false });
  assert.equal(st.glyphs.ore_rush, undefined); assert.equal(countOf(inv, RUSH), 1);
  assert.equal(glyphOp(st, inv, { action:'remove', node:'ore_rush', opId:op() }).error, 'empty');
  glyphOp(st, inv, { action:'pose', node:'ore_rush', opId:op() });
  const full = invWith(); full.slots = [{ item:RUSH, qty:Number.MAX_SAFE_INTEGER }];
  assert.equal(glyphOp(st, full, { action:'remove', node:'ore_rush', opId:op() }).error, 'inventory_full');
  assert.equal(st.glyphs.ore_rush, RUSH, 'toujours posé');
});

test('reset des skills et set appliqué : glyphes toujours posés, inactifs tant que le skill n\'est pas au max', () => {
  const st = miner(), inv = invWith({ [RUSH]:1 });
  glyphOp(st, inv, { action:'pose', node:'ore_rush', opId:op() });
  skillOp(st, { action:'reset', opId:op() }, 99);
  assert.equal(st.glyphs.ore_rush, RUSH); assert.equal(isActive(st, 'ore_rush'), false);
  assert.deepEqual(activeGlyphs(st), {});
  const st2 = miner(); glyphOp(st2, invWith({ [RUSH]:1 }), { action:'pose', node:'ore_rush', opId:op() });
  const sets = sanitizeSets({ list:[{ id:1, name:'Barbare', stuff:{}, skills:{ tree:'barbare', ranks:{ damage:3 } }, spells:[] }], nextId:2, ops:[] });
  assert.ok(applySet(sets, { id:1, opId:op() }, { inv:createInventory(), stuff:{ worn:{} }, skills:st2, spells:createSpells(), points:99, spec:{} }).ok);
  assert.equal(st2.tree, 'barbare'); assert.equal(st2.glyphs.ore_rush, RUSH, 'le set ne touche pas aux glyphes');
  assert.equal(isActive(st2, 'ore_rush'), false);
});

test('relecture : glyphes trafiqués ignorés ; un glyphe sur un skill pas au max est gardé (inactif)', () => {
  const raw = JSON.parse('{"ore_rush":"Glyphe Ruée","taunt":"Glyphe Pillage","mine_speed":"Charbon","ore_oxygen":7,"__proto__":{"x":1}}');
  const st = sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:2 }, glyphs:raw });
  assert.deepEqual({ ...st.glyphs }, { ore_rush:RUSH });
  assert.equal(isActive(st, 'ore_rush'), false);
  assert.deepEqual(sanitizeSkills(null).glyphs, {});
});

test('effets en partie et enregistrement de session : seulement les glyphes actifs', () => {
  const st = miner(), inv = invWith({ [RUSH]:1, 'Glyphe Second souffle':1 });
  glyphOp(st, inv, { action:'pose', node:'ore_rush', opId:op() });
  glyphOp(st, inv, { action:'pose', node:'ore_oxygen', opId:op() });
  assert.equal(skillEffects(st).glyph_ore_rush, 1); assert.equal(skillEffects(st).glyph_ore_oxygen, 1);
  assert.equal(skillEffects(st).glyph_mine_speed, undefined);
  st.ranks.ore_rush = 4;                                                  // plus au max (comme après un reset partiel)
  assert.equal(skillEffects(st).glyph_ore_rush, undefined);
  assert.deepEqual(sessionSkills(st).glyphs, { ore_oxygen:'Glyphe Second souffle' });
  assert.equal(skillEffects(sanitizeSkills(JSON.parse(JSON.stringify(sessionSkills(st))))).glyph_ore_oxygen, 1, 'relu depuis l\'enregistrement');
});

/* ---------- stats : Pioche aiguisée, Mule, Force brute ---------- */

test('stats des glyphes : minage % (bonus de vitesse d\'attaque), marche et montée (oxygène max), pods (dégâts)', () => {
  const base = { ...STATS };
  assert.deepEqual(withGlyphStats(base, {}), base, 'sans glyphe : identique');
  assert.equal(withGlyphStats({ ...base, attackSpeed:120 }, { glyph_mine_speed:1 }).mineSpeedPct, 2);
  assert.equal(withGlyphStats({ ...base, attackSpeed:100 }, { glyph_mine_speed:1 }).mineSpeedPct, 0);
  const mule = withGlyphStats({ ...base, oxygenMax:300 }, { glyph_mule:1 });
  assert.ok(Math.abs(mule.speed - base.speed * 1.09) < 1e-9); assert.ok(Math.abs(mule.climbSpeed - base.climbSpeed * 1.09) < 1e-9);
  assert.equal(withGlyphStats({ ...base, damage:14 }, { glyph_damage:1 }).pods, base.pods + 42);
  assert.equal(base.pods, STATS.pods, 'copie : l\'objet reçu n\'est pas modifié');
});

test('stats des glyphes : en session (glyphes figés) et dans l\'onglet Stuff', () => {
  const skills = { tree:'barbare', ranks:{ damage:3 }, glyphs:{ damage:'Glyphe Force brute' } };
  const [m] = minerSpecs({ seed:1, players:[{ account:'A', name:'Geo' }], skills:{ A:skills } });
  assert.equal(m.carac.pods, STATS.pods + Math.round(3 * m.carac.damage), 'dégâts skills compris');
  const [n] = minerSpecs({ seed:1, players:[{ account:'A', name:'Geo' }], skills:{ A:{ tree:'barbare', ranks:{ damage:3 } } } });
  assert.equal(n.carac.pods, STATS.pods);
  const shown = minerStats({}, skillEffects(sanitizeSkills(skills))).find(s => s.key === 'pods');
  assert.equal(shown.total, m.carac.pods);
});

/* ---------- effets en partie : Second souffle, Ruée, Navette, Échelle de 2, Pillage, Braum ---------- */

const hold = m => { m.action = { type:'wait', dur:1e9, t:0, data:{} }; };
const coalScene = skill => { const G = worldFrom(['', '', '  @c']), m = G.miners[0]; Object.assign(m.skill, skill); return { G, m }; };

test('Second souffle : 5 % de chance qu\'un minerai rende une torche, jamais au-delà du max', () => {
  let { G, m } = coalScene({ ore_oxygen:1, glyph_ore_oxygen:1 });
  m.torches = 10; G.rng = () => 0; mineBlock(G, m, 3, 2);
  assert.equal(m.torches, 11, 'tirage gagnant');
  ({ G, m } = coalScene({ ore_oxygen:1, glyph_ore_oxygen:1 }));
  m.torches = 10; G.rng = () => 0.99; mineBlock(G, m, 3, 2);
  assert.equal(m.torches, 10, 'tirage perdant');
  ({ G, m } = coalScene({ ore_oxygen:1, glyph_ore_oxygen:1 }));
  m.torches = m.carac.torches; G.rng = () => 0; mineBlock(G, m, 3, 2);
  assert.equal(m.torches, m.carac.torches, 'stock plein');
  ({ G, m } = coalScene({ ore_oxygen:1 }));
  m.torches = 10; G.rng = () => 0; mineBlock(G, m, 3, 2);
  assert.equal(m.torches, 10, 'sans glyphe : rien');
});

test('Ruée : le bonus de marche dure 5 s au lieu de 3', () => {
  let { G, m } = coalScene({ ore_rush:0.15, glyph_ore_rush:1 });
  mineBlock(G, m, 3, 2); assert.equal(m.rushUntil - G.t, 5);
  ({ G, m } = coalScene({ ore_rush:0.15 }));
  mineBlock(G, m, 3, 2); assert.equal(m.rushUntil - G.t, 3);
});

test('Navette : pas d\'oxygène consommé en redescendant au front après une remontée', () => {
  const G = worldFrom(['', '', '', '  @']), m = G.miners[0];
  Object.assign(m.skill, { travel_rush:0.09, glyph_travel_rush:1 }); hold(m);
  m.ox = 100; m.mode = 'departure'; run(G, 10);
  assert.equal(m.ox, 100, 'en redescente');
  m.mode = 'work'; run(G, 10);
  assert.ok(m.ox < 100, 'au travail : il respire');
});

test('Échelle de 2 : poser une échelle prend 2 fois moins de temps (mine, mine instantanée, tours)', () => {
  const m = { skill:{ tall_ladder:1, glyph_tall_ladder:1 } }, n = { skill:{ tall_ladder:1 } };
  assert.equal(ladderTime(m), 1); assert.equal(ladderTime(n), 2);
  assert.equal(miLadderT(m), 1); assert.equal(miLadderT(n), 2);
});

test('Pillage : chaque mob tué ajoute 1 % aux dégâts, au plus 25 %', () => {
  const G = worldFrom(['', '  @']), m = G.miners[0];
  Object.assign(m.skill, { loot:0.15, glyph_loot:1 }); m.carac.crit = 0;
  const base = hitDamage(G, m);
  for(let i = 0; i < 30; i++) killMob(G, m, { id:1000 + i, type:'bestiole', hp:1, x:5, y:1 });
  assert.equal(m.pillage, 25);
  assert.ok(Math.abs(hitDamage(G, m) - base * 1.25) < 1e-9);
  const H = worldFrom(['', '  @']), n = H.miners[0]; n.skill.loot = 0.15;
  killMob(H, n, { id:1, type:'bestiole', hp:1, x:5, y:1 });
  assert.equal(n.pillage ?? 0, 0, 'sans glyphe : rien');
});

test('Braum : +30 % de l\'oxygène max à chaque entrée dans un donjon ; rester dedans ne recharge pas', () => {
  const rows = ['', ...Array(24).fill('#'.repeat(W))];
  const G = worldFrom(rows), m = G.miners[0];
  const d = addDungeon(G, { x0:5, y0:6, side:'R', hy:13 });
  for(let x = 15; x <= 30; x++) G.tiles[13][x] = 0;
  Object.assign(m.skill, { braum:0.3, glyph_braum:1 }); m.skillTree = 'barbare';
  m.carac.oxygenMax = 300; m.ox = 100; Object.assign(m, { x:20, y:13 }); hold(m);
  run(G, 1); const out = m.ox;
  Object.assign(m, { x:d.hx, y:d.hy }); run(G, 1);
  assert.ok(Math.abs(m.ox - (out - 0.1 + 90)) < 1e-6, `entrée : +90 (${m.ox})`);
  const inside = m.ox; run(G, 50);
  assert.ok(m.ox < inside, 'rester dedans ne recharge pas');
  Object.assign(m, { x:20, y:13 }); run(G, 1);
  const before = m.ox; Object.assign(m, { x:d.hx, y:d.hy }); run(G, 1);
  assert.ok(Math.abs(m.ox - (before - 0.1 + 90)) < 1e-6, 'seconde entrée : encore +90');
  m.ox = 290; Object.assign(m, { x:20, y:13 }); run(G, 1); Object.assign(m, { x:d.hx, y:d.hy }); run(G, 1);
  assert.equal(m.ox, 300, 'plafonné au max');
});

/* ---------- onglet Skills : état de la case de glyphe ---------- */

test('case de glyphe : none sans glyphe, can_pose (skill au max et glyphe possédé), empty, posed, inactive', async () => {
  const { glyphSlot } = await import('../src/ui/skills.js');
  const inv = { slots:[{ item:RUSH, qty:1 }] }, none = { slots:[] };
  const max = { tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:5 }, glyphs:{} };
  assert.equal(glyphSlot(max, 'taunt', inv), 'none');
  assert.equal(glyphSlot(max, 'lazy_legend', inv), 'none');
  assert.equal(glyphSlot(max, 'ore_rush', inv), 'can_pose');
  assert.equal(glyphSlot(max, 'ore_rush', none), 'empty', 'pas de glyphe dans l\'inventaire');
  assert.equal(glyphSlot({ ...max, ranks:{ ...max.ranks, ore_rush:4 } }, 'ore_rush', inv), 'empty', 'skill pas au max');
  assert.equal(glyphSlot({ ...max, glyphs:{ ore_rush:RUSH } }, 'ore_rush', none), 'posed');
  assert.equal(glyphSlot({ ...max, ranks:{ ...max.ranks, ore_rush:4 }, glyphs:{ ore_rush:RUSH } }, 'ore_rush', none), 'inactive');
});

test('fiche d\'un glyphe (inventaire) : skill visé, effet, où le poser ; rien pour un autre objet', async () => {
  const { glyphInfo } = await import('../src/meta/glyphs.js');
  assert.equal(glyphInfo(RUSH), `Skill « Ruée » : ${GLYPHS.desc.ore_rush}. À poser dans l'onglet Skills (skill au rang max).`);
  assert.equal(glyphInfo('Charbon'), null);
});

test('Glyphe Mule : seulement dans la mine classique (son skill n\'agit pas en mine instantanée ni dans les tours)', async () => {
  const { instantSpecs } = await import('../src/shared/instant.js');
  const { towerSpecs } = await import('../src/shared/tower.js');
  const skills = { tree:'logisticien', ranks:{ travel_rush:3, tall_ladder:1, winch:1, winch_speed:5, mule:1 }, glyphs:{ mule:'Glyphe Mule' } };
  const rec = { seed:1, players:[{ account:'A', name:'Geo' }], skills:{ A:skills } };
  const k = 1 + GLYPHS.oxygenToSpeed * STATS.oxygenMax;
  assert.ok(Math.abs(minerSpecs(rec)[0].carac.speed - STATS.speed * k) < 1e-9, 'mine classique : bonus');
  assert.equal(instantSpecs(rec)[0].carac.speed, STATS.speed, 'mine instantanée : rien');
  assert.equal(towerSpecs({ ...rec, mode:'tower_angel' })[0].carac.speed, STATS.speed, 'tour : rien');
});

/* ---------- Glyphe Treuil : ascenseur (étape 2) ---------- */
import { WINCH } from '../src/config.js';
import { newSession } from '../src/sim/session.js';
import { tryUnlock, areaTop } from '../src/sim/world.js';
import { baseWinchT } from '../src/sim/mineur.js';

const unlockNext = G => { const a = G.areas[G.unlockedAreas - 1]; a.oreMined = a.oreTotal; assert.ok(tryUnlock(G)); };

test('Glyphe Treuil : le porteur du glyphe construit, aux 1er et 3e déblocages, pas au 2e', () => {
  const G = newSession(3, { miners:3 });
  G.miners[1].skill.winch = 1; G.miners[2].skill.winch = 1; G.miners[2].skill.glyph_winch = 1;
  unlockNext(G);
  assert.equal(G.miners[1].winchJob, null, 'pas le premier logisticien');
  assert.deepEqual(G.miners[2].winchJob, { bottom:areaTop(1), lift:true });
  G.miners[2].winchJob = null;
  unlockNext(G);
  assert.equal(G.miners[2].winchJob, null, '2e déblocage : pas de chantier');
  assert.equal(G.miners[1].winchJob, null, 'ni pour l\'autre logisticien');
  unlockNext(G);
  assert.deepEqual(G.miners[2].winchJob, { bottom:areaTop(3), lift:true }, '3e déblocage : jusqu\'à l\'area 3');
});

test('Glyphe Treuil : sans glyphe, le treuil est posé à chaque déblocage (inchangé)', () => {
  const G = newSession(3, { miners:2 });
  G.miners[1].skill.winch = 1;
  unlockNext(G); assert.deepEqual(G.miners[1].winchJob, { bottom:areaTop(1) });
  G.miners[1].winchJob = null;
  unlockNext(G); assert.deepEqual(G.miners[1].winchJob, { bottom:areaTop(2) });
});

test('Glyphe Treuil : le chantier pose un ascenseur ; le seau va 3 fois plus vite, Escalateur compris', () => {
  const G = worldFrom(['', ...Array.from({ length:20 }, () => '#'.repeat(W))]), m = G.miners[0];
  Object.assign(m, { x:WINCH.x, y:0, mode:'surface', skillTree:'logisticien' });
  Object.assign(m.skill, { winch:1, glyph_winch:1 });
  m.winchJob = { bottom:14, lift:true };
  for(let i = 0; i < 3000 && m.winchJob; i++) run(G, 1);
  assert.deepEqual(G.winch, { x:WINCH.x, bottom:14, lift:true });
  G.winchBoost = 0.25;
  const lift = baseWinchT(G, m);
  delete G.winch.lift;
  assert.ok(Math.abs(baseWinchT(G, m) / lift - GLYPHS.liftSpeed) < 1e-9, 'treuil 1,5 fois plus lent');
  assert.ok(Math.abs(lift - 1 / (m.carac.climbSpeed * WINCH.speedFactor * 1.25 * GLYPHS.liftSpeed)) < 1e-12, 'Escalateur compris');
});

test('Glyphe Treuil dans les tours : le logisticien porteur installe un ascenseur ; même vitesse que dans la mine (× 1,5)', async () => {
  const { newTower, tickTower, towerWinchT } = await import('../src/sim/tower/session.js');
  const { winchMult } = await import('../src/sim/mineur.js');
  const G = newTower(3, { side:'angel', miners:[{ name:'L', account:'L', skillTree:'logisticien', skills:{ winch:1, glyph_winch:1, winch_speed:0.25 } }] });
  const m = G.miners[0]; G.boss.engaged = false;
  Object.assign(m, { x:G.x0 - 3, y:G.roof - 1, knocked:true, action:null });
  for(let i = 0; i < 3000 && !G.winch; i++) tickTower(G);
  assert.equal(G.winch?.lift, true, 'un ascenseur');
  assert.equal(winchMult(G), 1.25 * GLYPHS.liftSpeed);
  assert.ok(Math.abs(towerWinchT(G, m) - 1 / (m.carac.climbSpeed * WINCH.speedFactor * winchMult(G))) < 1e-12);
  const H = newTower(3, { side:'angel', miners:[{ name:'L', account:'L', skillTree:'logisticien', skills:{ winch:1 } }] });
  const n = H.miners[0]; H.boss.engaged = false;
  Object.assign(n, { x:H.x0 - 3, y:H.roof - 1, knocked:true, action:null });
  for(let i = 0; i < 3000 && !H.winch; i++) tickTower(H);
  assert.equal(H.winch.lift, undefined, 'sans glyphe : un treuil');
});
