/* Rareté des objets : commun par défaut, liste du créateur en inhabituel, shiny inhabituels. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RARITY, ITEMS, SHINY } from '../src/config.js';
import { rarityOf, rarityDef } from '../src/meta/rarity.js';
import { rcls, rname, rlabel } from '../src/ui/rarity.js';

const UNCOMMON = ['Rubis inférieur', 'Saphir inférieur', 'Jade inférieur', 'Boussole en or', 'Boussole en or BP',
  'Ceinture en peau de gobelin', 'Ceinture en peau de gobelin BP', 'Four en fer', 'Four en fer BP', ...Object.values(SHINY.items).map(s => s.item)];

test('rareté : les 5 raretés dans l\'ordre, chacune avec sa couleur', () => {
  assert.deepEqual(RARITY.tiers.map(t => t.id), ['commun', 'inhabituel', 'rare', 'epique', 'legendaire']);
  for(const t of RARITY.tiers) assert.match(t.color, /^#[0-9a-f]{6}$/i);
  assert.equal(RARITY.default, 'commun');
  assert.equal(rarityDef('Fer').rank, 0);
});

test('rareté : la liste du créateur est inhabituelle, tout le reste du catalogue est commun', () => {
  for(const n of UNCOMMON) assert.equal(rarityOf(n), 'inhabituel', n);
  const TIER2 = ['Gants tactique', 'Gants tactique BP', 'Gants d\'ouvrier', 'Gants d\'ouvrier BP'], RARE = ['Cape de Naingui', 'Cape de Naingui BP', 'Cristal de pleine lune'];
  for(const n of TIER2) assert.equal(rarityOf(n), 'inhabituel', n);
  for(const n of RARE) assert.equal(rarityOf(n), 'rare', n);
  for(const n of Object.keys(ITEMS)) if(!UNCOMMON.includes(n) && !TIER2.includes(n) && !RARE.includes(n)) assert.equal(rarityOf(n), 'commun', n);
  assert.ok(ITEMS['Shiny iron'] && ITEMS['Shiny gold']);
});

test('rareté : les noms de RARITY.items existent (pas de faute de frappe), sauf la Boussole en or pas encore créée', () => {
  for(const [n, r] of Object.entries(RARITY.items)){
    assert.ok(RARITY.tiers.some(t => t.id === r), `${n} : rareté ${r} inconnue`);
    if(n !== 'Boussole en or') assert.ok(ITEMS[n], `${n} absent du catalogue`);
  }
});

test('rareté : objet inconnu ou valeur bizarre → commun', () => {
  for(const v of ['Truc inconnu', '', null, undefined, 42, {}, '__proto__', 'constructor']) assert.equal(rarityOf(v), 'commun');
  assert.equal(rarityDef('Rubis inférieur').label, 'Inhabituel');
  assert.equal(rarityDef('Rubis inférieur').rank, 1);
});

test('rareté (affichage) : classe de case, nom coloré échappé, libellé', () => {
  assert.equal(rcls('Fer'), ' r-commun');
  assert.equal(rcls('Shiny gold'), ' r-inhabituel');
  assert.equal(rname('Jade inférieur'), '<span class="rn r-inhabituel">Jade inférieur</span>');
  assert.equal(rname('Fer', 'Fer × 3', 'b'), '<b class="rn r-commun">Fer × 3</b>');
  assert.equal(rname('<img onerror=x>'), '<span class="rn r-commun">&lt;img onerror=x&gt;</span>');
  assert.equal(rlabel('Charbon'), '<span class="rn r-commun">Commun</span>');
});
