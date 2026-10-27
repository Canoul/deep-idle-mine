/* Blueprints et pièces en fer : recettes secrètes débloquées en utilisant leur blueprint (consommé, pour toujours),
   effets des nouvelles pièces (épée : remplace les mains nues), apparence. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, STATS, LOOT, TEXTURES } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { createInventory, addAll, countOf, serialize, deserialize } from '../src/meta/inventory.js';
import { craft, craftable, learn, canLearn, isUnlocked, recipeOfBlueprint } from '../src/meta/craft.js';
import { equippedStats, statLines } from '../src/meta/stuff.js';
import { armorLayers, toolOf, SKIN_TEXTURES } from '../src/skins.js';
import { existsSync } from 'node:fs';

const invWith = bag => { const inv = createInventory(); addAll(inv, bag); return inv; };
let n = 0; const id = () => 'op-bp-' + (++n);

/* les objets demandés par le créateur : effet, recette, blueprint (fer × 1,75, épée et pioche × 1,25 le 24/10) */
const NEW = {
  'Pioche en fer':   { stats:{ mineSpeed:0.4 },  cost:{ 'Tainted iron':20 } },   // nerf du 25/10 (avant 0,5)
  'Épée en fer':     { set:{ damage:14 },        cost:{ 'Tainted iron':10 } },
  /* armure : + 20 peaux de gobelin (25/10) */
  'Casque en fer':   { stats:{ oxygenMax:63 },   cost:{ 'Tainted iron':5, 'Peau de gobelin':20 } },
  'Plastron en fer': { stats:{ pods:42 },        cost:{ 'Tainted iron':8, 'Peau de gobelin':20 } },
  'Jambes en fer':   { stats:{ climbSpeed:1 }, cost:{ 'Tainted iron':7, 'Peau de gobelin':20 } },
  'Bottes en fer':   { stats:{ speed:1.04 },     cost:{ 'Tainted iron':4, 'Peau de gobelin':20, 'Lingot d\'or':1 } },
  'Ceinture en peau de gobelin': { stats:{ torches:10 }, cost:{ 'Peau de gobelin':20, 'Lingot d\'or':20 } },
};

test('les 7 pièces : effets, recettes et blueprint du Treasure T1', () => {
  const bps = LOOT['Treasure T1'].oneOf.find(f => f.family === 'blueprint').items.map(i => i.item);
  for(const [name, d] of Object.entries(NEW)){
    assert.equal(ITEMS[name]?.cat, 'stuff', name);
    assert.deepEqual(ITEMS[name].stats, d.stats ?? {}, name);
    assert.deepEqual(ITEMS[name].set, d.set ?? {}, name);
    assert.deepEqual(RECIPES[name].cost, d.cost, name);
    assert.equal(RECIPES[name].unlock, name + ' BP');
    assert.ok(bps.includes(name + ' BP'), `${name} BP doit pouvoir sortir d'un Treasure T1`);
    assert.ok(TEXTURES.includes(ITEMS[name].tex) && existsSync(`textures/${ITEMS[name].tex}.png`), `texture de ${name}`);
  }
});

test('secret : les recettes à blueprint ne sont pas dans le craft tant que le blueprint n\'est pas utilisé', () => {
  const inv = invWith({ 'Tainted iron':100 });
  for(const name of Object.keys(NEW)) assert.ok(!craftable(inv).includes(name), name);
  assert.ok(craftable(inv).includes('Pioche en pierre'), 'les recettes de base restent');
  assert.equal(craft(inv, 'Pioche en fer', id()).error, 'locked');
  assert.equal(countOf(inv, 'Tainted iron'), 100, 'rien retiré');
});

test('utiliser un blueprint : consommé, recette débloquée pour toujours, puis fabrication', () => {
  const inv = invWith({ 'Pioche en fer BP':1, 'Tainted iron':25 });
  assert.equal(recipeOfBlueprint('Pioche en fer BP'), 'Pioche en fer');
  assert.ok(canLearn(inv, 'Pioche en fer BP'));
  const r = learn(inv, 'Pioche en fer BP', id());
  assert.deepEqual(r, { ok:true, repeated:false, recipe:'Pioche en fer' });
  assert.equal(countOf(inv, 'Pioche en fer BP'), 0);
  assert.ok(isUnlocked('Pioche en fer', inv));
  assert.ok(craftable(inv).includes('Pioche en fer'));
  assert.ok(craft(inv, 'Pioche en fer', id()).ok);
  assert.equal(countOf(inv, 'Pioche en fer'), 1); assert.equal(countOf(inv, 'Tainted iron'), 5);
  /* toujours débloquée après relecture de la sauvegarde */
  const back = deserialize(serialize(inv));
  assert.deepEqual(back.unlocked, ['Pioche en fer']);
});

test('blueprint : refus sans le consommer (déjà connu, ne débloque rien, pas possédé) ; demande rejouée = une fois', () => {
  const inv = invWith({ 'Casque en fer BP':2 });
  const o = id();
  assert.ok(learn(inv, 'Casque en fer BP', o).ok);
  assert.ok(learn(inv, 'Casque en fer BP', o).repeated, 'double clic');
  assert.equal(countOf(inv, 'Casque en fer BP'), 1, 'un seul consommé');
  assert.equal(learn(inv, 'Casque en fer BP', id()).error, 'known');
  assert.equal(countOf(inv, 'Casque en fer BP'), 1, 'le second est gardé');
  assert.equal(learn(inv, 'Épée en fer BP', id()).error, 'not_owned');
  assert.equal(learn(inv, 'Charbon', id()).error, 'no_use');
  assert.equal(learn(inv, 42, id()).error, 'no_use');
});

test('sauvegarde trafiquée : seules des recettes à blueprint existantes, une fois chacune', () => {
  const raw = JSON.parse(serialize(createInventory()));
  raw.unlocked = ['Pioche en fer', 'Pioche en fer', 'Pioche en pierre', 'Objet magique', 7, null];
  assert.deepEqual(deserialize(JSON.stringify(raw)).unlocked, ['Pioche en fer']);
  raw.unlocked = 'Pioche en fer';
  assert.deepEqual(deserialize(JSON.stringify(raw)).unlocked, []);
});

test('effets : l\'épée remplace les mains nues (14 au lieu de 5), les autres s\'ajoutent', () => {
  const c = equippedStats(['Épée en fer', 'Pioche en fer', 'Casque en fer', 'Plastron en fer', 'Jambes en fer', 'Bottes en fer', 'Ceinture en peau de gobelin']);
  assert.equal(c.damage, 14);
  assert.equal(c.mineSpeed, 1.4); assert.equal(c.oxygenMax, STATS.oxygenMax + 63); assert.equal(c.pods, STATS.pods + 42);
  assert.equal(c.climbSpeed, 3.25); assert.equal(c.speed, 4.04); assert.equal(c.discoverMax, STATS.discoverMax); assert.equal(c.torches, STATS.torches + 10);
  assert.deepEqual(statLines('Épée en fer'), ['Dégâts 14']);
  assert.deepEqual(statLines('Ceinture en peau de gobelin'), ['Torches +10']);
});

test('apparence : armure en fer, ceinture, pioche en fer, épée sortie seulement pour frapper', () => {
  const look = { casque:'Casque en fer', torse:'Plastron en fer', ceinture:'Ceinture en peau de gobelin', pioche:'Pioche en fer', epee:'Épée en fer' };
  assert.deepEqual(armorLayers(look), ['skins/goblin_belt', 'skins/iron_chest', 'skins/iron_helmet']);
  assert.equal(toolOf(look, 'mine'), 'skins/pick_iron');
  assert.equal(toolOf(look, 'attack'), 'skins/sword_iron');
  assert.equal(toolOf({}, 'attack'), 'skins/pick_wood');
  for(const t of SKIN_TEXTURES) assert.ok(existsSync(`textures/${t}.png`), t);
});
test('épée en pierre : recette de base (15 lingots de fer), dégâts 8 au lieu de 5 (+3, un tiers de l\'épée en fer depuis le 24/10), visible en main', async () => {
  const { RECIPES } = await import('../src/recipes.js');
  const { ITEMS } = await import('../src/config.js');
  const { statsOf, statLines } = await import('../src/meta/stuff.js');
  const { craftable } = await import('../src/meta/craft.js');
  assert.deepEqual(RECIPES['Épée en pierre'], { cost:{ 'Lingot de fer':15 }, qty:1, unlock:null });
  assert.ok(craftable({ unlocked:[] }).includes('Épée en pierre'));
  assert.equal(ITEMS['Épée en pierre'].slot, 'epee');
  assert.equal(statsOf(['Épée en pierre']).damage.total, 8);
  assert.equal(statsOf(['Épée en fer']).damage.total - 5, 3 * (statsOf(['Épée en pierre']).damage.total - 5));
  assert.deepEqual(statLines('Épée en pierre'), ['Dégâts 8']);
  assert.equal(toolOf({ epee:'Épée en pierre' }, 'attack'), 'skins/sword_stone');
});
