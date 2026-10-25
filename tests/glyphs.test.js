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
import { sanitizeSets, applySet } from '../src/meta/sets.js';
import { createSpells } from '../src/meta/spells.js';

test('glyphes : 9 objets, un par skill visé, catégorie glyph, épiques, texture présente', () => {
  const entries = Object.entries(GLYPHS.items);
  assert.equal(entries.length, 9);
  for(const [node, name] of entries){
    assert.ok(NODES[node], `${node} : skill connu`);
    assert.equal(ITEMS[name]?.cat, 'glyph', name);
    assert.equal(ITEMS[name].glyph, node);
    assert.equal(ITEMS[name].stack, true);
    assert.equal(rarityOf(name), 'epique', name);
    assert.ok(GLYPHS.desc[node], `${node} : texte joueur`);
  }
  for(const node of ['lazy_legend', 'winch_speed', 'taunt', 'winch']) assert.equal(GLYPHS.items[node], undefined, `${node} : pas de glyphe`);
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
