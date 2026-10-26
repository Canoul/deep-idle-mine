/* Drop des glyphes (25/10/2026, Geoffrey) : un mineur avec une spécialisation peut trouver un glyphe de SON arbre,
   tiré parmi ceux qu'il ne possède pas au lancement : mineur 0,01 % par bloc cassé, logisticien 0,07 % par échelle
   posée, barbare 0,1 % par mob tué ; mine classique ; pour lui seul, versé à la fin (perdu s'il quitte). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS } from '../src/config.js';
import { ownedGlyphs } from '../src/meta/glyphs.js';
import { minerSpecs } from '../src/shared/game.js';
import { newSession, endSession } from '../src/sim/session.js';
import { mineBlock, killMob, finishAction } from '../src/sim/actions.js';
import { createInventory, addItem } from '../src/meta/inventory.js';
import { worldFrom } from './helpers.js';

const TREE_GLYPHS = tree => ({ mineur:['Glyphe Pioche aiguisée', 'Glyphe Second souffle', 'Glyphe Ruée'],
  logisticien:['Glyphe Navette', 'Glyphe Échelle de 2', 'Glyphe Mule', 'Glyphe Treuil'],
  barbare:['Glyphe Force brute', 'Glyphe Pillage', 'Glyphe Braum'] })[tree];
const scene = (tree, owned = []) => {
  const G = worldFrom(['', '', '  @cccc']), m = G.miners[0];
  m.skillTree = tree; m.glyphsOwned = [...owned]; G.glyphRng = () => 0;
  return { G, m };
};
const bug = id => ({ id, type:'bestiole', hp:1, x:9, y:2 });

test('drop : taux par spécialisation (bloc, échelle, mob)', () => {
  assert.deepEqual(GLYPHS.drop, { mineur:{ event:'block', chance:0.0000383 }, logisticien:{ event:'ladder', chance:0.000335 },
                                  barbare:{ event:'kill', chance:0.00101 } });
  /* un glyphe (n'importe lequel) ≈ 3 % par session à 3 (événements mesurés : 795 blocs, 91 échelles, 30 mobs par mineur) */
  for(const [tree, E] of [['mineur', 795], ['logisticien', 91], ['barbare', 30]]){
    const p = 1 - (1 - GLYPHS.drop[tree].chance) ** E;
    assert.ok(Math.abs(p - 0.03) < 0.0005, `${tree} : ${(p * 100).toFixed(3)} %`);
  }
  assert.ok(typeof newSession(1).glyphRng === 'function', 'hasard à part');
});

test('drop : glyphes possédés = inventaire + posés', () => {
  const inv = createInventory(); addItem(inv, 'Glyphe Ruée', 2); addItem(inv, 'Charbon', 3);
  assert.deepEqual(ownedGlyphs({ glyphs:{ damage:'Glyphe Force brute' } }, inv).sort(), ['Glyphe Force brute', 'Glyphe Ruée']);
  assert.deepEqual(ownedGlyphs({}, createInventory()), []);
});

test('drop : liste figée au lancement relue (noms de glyphes seulement)', () => {
  const rec = { seed:1, players:[{ account:'A', name:'Geo' }], skills:{ A:{ tree:'mineur', ranks:{}, owned:['Glyphe Ruée', 'Charbon', 42] } } };
  assert.deepEqual(minerSpecs(rec)[0].glyphsOwned, ['Glyphe Ruée']);
  assert.deepEqual(minerSpecs({ seed:1, players:[{ account:'A', name:'Geo' }] })[0].glyphsOwned, []);
});

test('drop mineur : un bloc cassé peut donner un glyphe de son arbre, jamais un qu\'il possède, jamais deux fois le même', () => {
  const { G, m } = scene('mineur', ['Glyphe Ruée']);
  mineBlock(G, m, 3, 2);
  assert.equal(m.glyphFound.length, 1);
  assert.ok(TREE_GLYPHS('mineur').includes(m.glyphFound[0]) && m.glyphFound[0] !== 'Glyphe Ruée', m.glyphFound[0]);
  mineBlock(G, m, 4, 2);
  assert.equal(m.glyphFound.length, 2); assert.notEqual(m.glyphFound[0], m.glyphFound[1]);
  mineBlock(G, m, 5, 2);
  assert.equal(m.glyphFound.length, 2, 'il a tous ceux de son arbre : plus rien');
  assert.ok(G.log.some(l => /Glyphe/.test(l.msg ?? l.text ?? String(l))), 'annoncé au journal');
});

test('drop : rien au-dessus du taux, rien sans spécialisation, rien pour le mauvais événement', () => {
  let { G, m } = scene('mineur'); G.glyphRng = () => 0.5; mineBlock(G, m, 3, 2);
  assert.deepEqual(m.glyphFound ?? [], [], 'tirage perdant');
  ({ G, m } = scene(null)); mineBlock(G, m, 3, 2);
  assert.deepEqual(m.glyphFound ?? [], [], 'sans spécialisation');
  ({ G, m } = scene('mineur')); killMob(G, m, bug(1));
  assert.deepEqual(m.glyphFound ?? [], [], 'un mineur ne trouve rien en tuant un mob');
});

test('drop logisticien : une échelle posée ; drop barbare : un mob tué', () => {
  let { G, m } = scene('logisticien');
  finishAction(G, m, { type:'ladder', t:0, dur:2, data:{} });
  assert.ok(TREE_GLYPHS('logisticien').includes(m.glyphFound?.[0]), String(m.glyphFound));
  ({ G, m } = scene('barbare'));
  killMob(G, m, bug(2));
  assert.ok(TREE_GLYPHS('barbare').includes(m.glyphFound?.[0]), String(m.glyphFound));
});

test('drop : versé à la fin dans SA part (pas dans le coffre) ; perdu s\'il quitte', () => {
  const G = newSession(5, { miners:2, accounts:['A', 'B'] });
  G.miners[0].glyphFound = ['Glyphe Ruée']; G.miners[1].glyphFound = ['Glyphe Braum']; G.miners[1].left = 10;
  endSession(G);
  assert.equal(G.summary.shares[0].bag['Glyphe Ruée'], 1);
  assert.equal(G.summary.shares[1].bag['Glyphe Braum'], undefined, 'parti : perdu');
  assert.equal(G.summary.chest['Glyphe Ruée'], undefined, 'pas dans le coffre commun');
});

test('drop : une seule chance pour tous les glyphes manquants (même chance avec 3 ou 1 manquant)', () => {
  const c = GLYPHS.drop.mineur.chance;
  const at = (owned, r) => { const { G, m } = scene('mineur', owned); G.glyphRng = () => r; mineBlock(G, m, 3, 2); return m.glyphFound?.length ?? 0; };
  assert.equal(at([], c - 1e-9), 1);
  assert.equal(at([], c + 1e-9), 0, 'pas × 3 avec 3 manquants');
  assert.equal(at(['Glyphe Ruée', 'Glyphe Second souffle'], c - 1e-9), 1);
  assert.equal(at(['Glyphe Ruée', 'Glyphe Second souffle'], c + 1e-9), 0);
});
