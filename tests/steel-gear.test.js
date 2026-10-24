/* Stuff en acier, Plastron de l'équilibre et Treasure T3 (23/10/2026, Geoffrey) : effets, recettes à blueprint,
   rareté, apparence, contenu du Treasure T3. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, LOOT, TEXTURES, TREASURE } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { createInventory, addAll, countOf } from '../src/meta/inventory.js';
import { craft, craftable, learn } from '../src/meta/craft.js';
import { equippedStats } from '../src/meta/stuff.js';
import { rarityOf } from '../src/meta/rarity.js';
import { openTreasure, rollLoot } from '../src/meta/loot.js';
import { armorLayers, toolOf, SKIN_TEXTURES } from '../src/skins.js';
import { mulberry32 } from '../src/core/rng.js';
import { existsSync } from 'node:fs';

const invWith = bag => { const inv = createInventory(); addAll(inv, bag); return inv; };
let n = 0; const id = () => 'op-steel-' + (++n);
const ARMOR = { 'Shiny iron':10, 'Tissu sombre':10 }, TOOL = { 'Shiny gold':10, 'Diamant':10 };

/* demandé par le créateur : au départ pièce en fer × 1,2 ; le 24/10, acier × 1,5, épée et pioche × 1,25 (entier le plus proche
   pour oxygène, pods, dégâts). L'acier reste au-dessus du fer sur chaque stat. */
const STEEL = {
  'Casque en acier':   { iron:'Casque en fer',   stats:{ oxygenMax:69 },     cost:{ 'Steel ingot':10, ...ARMOR } },
  'Plastron en acier': { iron:'Plastron en fer', stats:{ pods:120 },         cost:{ 'Steel ingot':16, ...ARMOR } },
  'Jambes en acier':   { iron:'Jambes en fer',   stats:{ climbSpeed:1.08 },  cost:{ 'Steel ingot':14, ...ARMOR } },
  'Bottes en acier':   { iron:'Bottes en fer',   stats:{ speed:1.08 },       cost:{ 'Steel ingot':8,  ...ARMOR } },
  'Pioche en acier':   { iron:'Pioche en fer',   stats:{ mineSpeed:0.6 },    cost:{ 'Steel ingot':20, ...TOOL } },
  'Épée en acier':     { iron:'Épée en fer',     set:{ damage:16 },          cost:{ 'Steel ingot':10, ...TOOL } },
};
const BALANCE = 'Plastron de l\'équilibre';

test('pièces en acier : au-dessus du fer, même case, recette et blueprint, inhabituel', () => {
  for(const [name, d] of Object.entries(STEEL)){
    const it = ITEMS[name], iron = ITEMS[d.iron];
    assert.equal(it?.cat, 'stuff', name);
    assert.equal(it.slot, iron.slot, name);
    assert.deepEqual(it.stats, d.stats ?? {}, name);
    assert.deepEqual(it.set, d.set ?? {}, name);
    for(const [k, v] of Object.entries({ ...iron.stats, ...iron.set }))
      assert.ok(({ ...it.stats, ...it.set })[k] > v, `${name} ${k} au-dessus du fer`);
    assert.deepEqual(RECIPES[name].cost, d.cost, name);
    assert.equal(RECIPES[name].unlock, name + ' BP');
    assert.equal(rarityOf(name), 'inhabituel'); assert.equal(rarityOf(name + ' BP'), 'inhabituel');
    assert.ok(TEXTURES.includes(it.tex) && existsSync(`textures/${it.tex}.png`), `texture de ${name}`);
  }
});

test('Plastron de l\'équilibre : torse, ses 9 stats, recette du créateur, épique', () => {
  assert.equal(ITEMS[BALANCE].slot, 'torse');
  assert.deepEqual(ITEMS[BALANCE].stats, { pods:188, oxygenMax:30, mineSpeedPct:3, damagePct:3, attackSpeed:8,
                                           tenacity:3, fortune:2, looting:3, torches:8 });
  assert.deepEqual(RECIPES[BALANCE].cost, { 'Steel ingot':50, 'Shiny gold':20, 'Rubis inférieur':1, 'Saphir inférieur':1,
                                            'Jade inférieur':1, 'Résidu angélique':50, 'Résidu démoniaque':50 });
  assert.equal(RECIPES[BALANCE].unlock, BALANCE + ' BP');
  assert.equal(rarityOf(BALANCE), 'epique'); assert.equal(rarityOf(BALANCE + ' BP'), 'epique');
  const s = equippedStats([BALANCE]), base = equippedStats([]);
  assert.equal(s.pods - base.pods, 188); assert.equal(s.tenacity - base.tenacity, 3);
  assert.equal(s.torches - base.torches, 8); assert.equal(s.mineSpeedPct, 3);
});

test('pas débloquées de base ; le blueprint débloque, puis fabrication', () => {
  const inv = invWith({ 'Steel ingot':30, ...TOOL, 'Pioche en acier BP':1 });
  for(const name of [...Object.keys(STEEL), BALANCE]) assert.ok(!craftable(inv).includes(name), name);
  assert.equal(craft(inv, 'Pioche en acier', id()).error, 'locked');
  assert.ok(learn(inv, 'Pioche en acier BP', id()).ok);
  assert.ok(craft(inv, 'Pioche en acier', id()).ok);
  assert.equal(countOf(inv, 'Pioche en acier'), 1);
  assert.deepEqual([countOf(inv, 'Steel ingot'), countOf(inv, 'Diamant'), countOf(inv, 'Shiny gold')], [10, 0, 0]);
});

test('apparence : calques d\'armure, pioche et épée en acier', () => {
  const look = { casque:'Casque en acier', torse:'Plastron en acier', jambes:'Jambes en acier', pieds:'Bottes en acier',
                 pioche:'Pioche en acier', epee:'Épée en acier' };
  assert.equal(armorLayers(look).length, 4);
  assert.equal(toolOf(look, 'mine'), 'skins/pick_steel');
  assert.equal(toolOf(look, 'attack'), 'skins/sword_steel');
  assert.equal(armorLayers({ torse:BALANCE })[0], 'skins/balance_chest');
  for(const t of SKIN_TEXTURES) assert.ok(existsSync(`textures/${t}.png`), t);
});

test('Treasure T3 : areas 5 et au-delà, table du créateur', () => {
  assert.deepEqual(TREASURE.tiers.map(t => [t.item, t.maxArea]), [['Treasure T1', 2], ['Treasure T2', 4], ['Treasure T3', 6]]);
  assert.ok(existsSync('textures/treasure_t3.png'));
  const T3 = LOOT['Treasure T3'];
  assert.deepEqual(T3.always.map(a => [a.item, a.min, a.max]),
    [['Graphite ore', 20, 40], ['Tissu sombre', 3, 10], ['Blueprint parts', 10, 20]]);
  const fam = f => Object.fromEntries(T3.oneOf.find(o => o.family === f).items.map(i => [i.item, i.chance]));
  assert.deepEqual(fam('blueprint'), { ...Object.fromEntries(Object.keys(STEEL).map(k => [k + ' BP', 0.01])), [BALANCE + ' BP']:0.005 });
  assert.deepEqual(fam('gem'), { 'Rubis inférieur':0.02, 'Jade inférieur':0.02, 'Saphir inférieur':0.02 });
  assert.deepEqual(fam('material'), { 'Cristal de pleine lune':0.10 });
  assert.equal(ITEMS['Cristal de pleine lune'].w, 1, 'garde son poids (butin du minotaure)');
  for(const bp of Object.keys(fam('blueprint'))) assert.equal(ITEMS[bp]?.cat, 'blueprint', bp);
});

test('ouvrir des Treasure T3 : toujours graphite, tissu, parts ; fréquences proches des chances', () => {
  const rng = mulberry32(3), N = 20000, got = {};
  for(let i = 0; i < N; i++) for(const [k, v] of Object.entries(rollLoot(LOOT['Treasure T3'], rng))) {
    if(['Graphite ore', 'Tissu sombre', 'Blueprint parts'].includes(k)) continue;
    got[k] = (got[k] || 0) + v;
  }
  assert.ok(Math.abs(got['Cristal de pleine lune'] / N - 0.10) < 0.01);
  assert.ok(Math.abs((got['Casque en acier BP'] || 0) / N - 0.01) < 0.004);
  const inv = invWith({ 'Treasure T3':1 });
  const r = openTreasure(inv, 'Treasure T3', id(), mulberry32(9));
  assert.ok(r.loot['Graphite ore'] >= 20 && r.loot['Graphite ore'] <= 40);
  assert.ok(r.loot['Tissu sombre'] >= 3 && r.loot['Blueprint parts'] >= 10);
  assert.equal(countOf(inv, 'Treasure T3'), 0);
});

/* buff du 24/10 (Geoffrey) : les pièces déjà fabriquées le reçoivent aussi. Une pièce enregistrée ne garde que son nom,
   sa qualité, ses lignes (en %) et son niveau : ses stats sont relues dans le catalogue au lancement de chaque session. */
test('pièces déjà fabriquées : elles ont les stats du catalogue actuel, lignes comprises', async () => {
  const { minerSpecs } = await import('../src/shared/game.js');
  const { lineValue } = await import('../src/meta/piece.js');
  const { STATS, UPGRADE } = await import('../src/config.js');
  const line = { stat:'pods', pct:20 };
  const gear = { torse:{ item:'Plastron en fer', uid:7, q:2, lines:[line], s:UPGRADE.scale }, pioche:{ item:'Pioche en acier', uid:8 },
                 epee:{ item:'Épée en fer', uid:9 }, casque:{ item:'Casque en acier', uid:10 } };
  const [m] = minerSpecs({ players:[{ account:'A', name:'Geo' }], gear:{ A:gear } });
  assert.equal(m.carac.pods, STATS.pods + 88 + lineValue('Plastron en fer', line));
  assert.equal(m.carac.mineSpeed, STATS.mineSpeed + 0.6);
  assert.equal(m.carac.damage, 14);
  assert.equal(m.carac.oxygenMax, STATS.oxygenMax + 69);
  /* la ligne suit la valeur de l'objet : 20 % de 528 x (88 pods) = 21 pods ; elle en valait 12 avec 50 pods */
  assert.equal(lineValue('Plastron en fer', line), 21);
  const [b] = minerSpecs({ players:[{ account:'A', name:'Geo' }], gear:{ A:{ torse:{ item:BALANCE, uid:11 } } } });
  assert.equal(b.carac.pods, STATS.pods + 188);
  assert.equal(b.carac.torches, STATS.torches + 8);
});
