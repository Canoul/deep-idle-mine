/* Cape inclusive (31/10/2026, Geoffrey) : 4 lignes tirées au craft par le serveur, 2 × le x du T4.5 à parts égales, aux prix de
   dessin ; doublons permis, une Découverte au plus. Plan : Treasure T4 et dernière étape de la recherche. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUFF, UPGRADE, LOOT, RESEARCH, WIKI, ITEMS } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { rollStats, rolledValue, rolledPrice, sanitizePiece, pieceBonus, tierOf } from '../src/meta/piece.js';
import { createInventory, addAll, deserialize, serialize, countOf } from '../src/meta/inventory.js';
import { craft, learn } from '../src/meta/craft.js';
import { statLines } from '../src/meta/stuff.js';
import { obtainedLines } from '../src/ui/obtained.js';
import { rarityOf } from '../src/meta/rarity.js';

const CAPE = 'Cape inclusive', BP = CAPE + ' BP', seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const ready = () => { const inv = createInventory(); addAll(inv, { [BP]:1 }); learn(inv, BP, 'learn-0001'); addAll(inv, RECIPES[CAPE].cost); return inv; };

test('fiche : cape épique, T4.5, 1 500 x, recette et plan comme les Jambières titanesques', () => {
  assert.equal(STUFF.items[CAPE].slot, 'cape');
  assert.equal(STUFF.items[CAPE].rolled.x, 2 * UPGRADE.tiers['4.5'].x);
  assert.equal(tierOf(CAPE), 4.5);
  assert.equal(rarityOf(CAPE), 'epique'); assert.equal(rarityOf(BP), 'epique');
  assert.deepEqual(RECIPES[CAPE].cost, { 'Tainted iron':20, 'Tainted gold':20, 'Diamant':20, 'Graphite ingot':20, 'Steel ingot':20, 'Mithril ingot':20,
                                         'Thorium ingot':20, 'Cobalt ingot':20, 'Orbe supérieur':5 });
  for(const k of Object.keys(RECIPES[CAPE].cost)) assert.ok(ITEMS[k], k);
  assert.ok(WIKI.secret.includes(CAPE));
  const stages = RESEARCH.tiers.find(t => t.tier === 4).stages;
  assert.deepEqual(stages.at(-1), ['Jambières titanesques BP', BP]);
  const entry = LOOT['Treasure T4'].oneOf[0].items.find(i => i.item === BP);
  assert.equal(entry.chance, LOOT['Treasure T4'].oneOf[0].items.find(i => i.item === 'Jambières titanesques BP').chance);
});

test('chaque stat du tirage a un prix : une ligne vaut 375 x, à un pas d\'arrondi près', () => {
  for(const k of UPGRADE.pool){
    assert.ok(rolledPrice(k) > 0, k);
    const v = rolledValue(CAPE, k);
    assert.ok(Number.isFinite(v) && Math.abs(v * rolledPrice(k) - 375) <= (UPGRADE.steps[k] ?? 0.01) * rolledPrice(k), k);
  }
  assert.equal(rolledValue(CAPE, 'discoverMax'), UPGRADE.discover.value);
  /* ratios de UPGRADE.runeDiv appliqués au prix de dessin */
  const combat = { attackSpeed:19.1, damagePct:20.8, doubleAttack:7.8, crit:4.8, damage:1.6, piercing:4.5, knockback:0.52, reach:0.06, looting:9.4, oneTap:14.4, tenacity:12.5, knockRes:8.3 };
  for(const [k, v] of Object.entries(combat)) assert.equal(rolledValue(CAPE, k), v, k);
  assert.equal(rolledValue(CAPE, 'pods'), 63);   // hors runeDiv : prix de dessin
});

test('tirage : 4 lignes, doublons permis, une Découverte au plus', () => {
  assert.deepEqual(rollStats(CAPE, () => 0).rolled, Array(4).fill(UPGRADE.pool[0]));
  const top = rollStats(CAPE, () => 0.999999).rolled;
  assert.equal(top.filter(k => k === 'discoverMax').length, 1);
  assert.equal(top.length, 4);
});

test('craft : le serveur tire, matière retirée, stats dans le pop-up ; une demande rejouée ne refait rien', () => {
  const inv = ready();
  assert.equal(craft(inv, CAPE, 'craft-0001').error, 'unknown', 'sans hasard du serveur, refus');
  assert.equal(countOf(inv, 'Orbe supérieur'), 5, 'rien retiré');
  const r = craft(inv, CAPE, 'craft-0002', seq(0, 0.3, 0.6, 0.9));
  assert.equal(r.ok, true);
  const [piece] = r.pieces;
  assert.equal(piece.rolled.length, 4);
  assert.equal(countOf(inv, 'Orbe supérieur'), 0);
  assert.equal(statLines(piece).length, 4);
  assert.equal(obtainedLines(piece).length, 5, '4 lignes et le GS');
  assert.equal(craft(inv, CAPE, 'craft-0002', seq(0)).repeated, true);
  assert.equal(countOf(inv, CAPE), 1);
});

test('avant le craft : l\'effet ne dit rien des stats', () => {
  assert.deepEqual(statLines(CAPE), ['4 lignes de stats aléatoires, tirées au craft']);
  assert.deepEqual(pieceBonus(CAPE).stats, {});
});

test('doublons : deux lignes de la même stat s\'additionnent, l\'amélioration les multiplie', () => {
  const k = 'pods', v = rolledValue(CAPE, k), rolled = [k, k, 'fortune', 'crit'];
  assert.equal(pieceBonus({ item:CAPE, rolled }).stats.pods, 2 * v);
  assert.ok(pieceBonus({ item:CAPE, rolled, plus:3 }).stats.pods > 2 * v);
});

test('anti-triche : un tirage trafiqué est retiré à la relecture ; un tirage valide survit à la sauvegarde', () => {
  const ok = ['pods', 'pods', 'fortune', 'discoverMax'], base = { item:CAPE, uid:1 };
  assert.deepEqual(sanitizePiece({ ...base, rolled:ok }).rolled, ok);
  for(const rolled of [['pods'], ['pods', 'pods', 'pods', 'pods', 'pods'], ['pods', 'pods', 'pods', 'triche'], ['discoverMax', 'discoverMax', 'pods', 'pods'], 'pods', { length:4 }, [1, 2, 3, 4]])
    assert.equal(sanitizePiece({ ...base, rolled }).rolled, undefined, JSON.stringify(rolled));
  assert.equal(sanitizePiece({ item:'Cape de Naingui', uid:2, rolled:ok }).rolled, undefined, 'pas sur une autre pièce');
  const inv = ready(), r = craft(inv, CAPE, 'craft-0003', () => 0.5);
  const back = deserialize(serialize(inv)).slots.find(s => s?.item === CAPE);
  assert.deepEqual(back.rolled, r.pieces[0].rolled);
});
