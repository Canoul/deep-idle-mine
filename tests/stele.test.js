/* Stèles des tours (30/10/2026, Geoffrey) : Exorcisme (Tour du Démon) et Pacte (Tour de l'Ange).
   Shrines de tour (don, décompte au lancement d'une tour de leur camp), phase 2 dans la tour, trésor béni. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHRINES, TOWER, RUNE, RINGS, ITEMS, treasureItem } from '../src/config.js';
import { createShrines, give, consume } from '../src/meta/shrines.js';
import { createInventory, addItem, countOf } from '../src/meta/inventory.js';
import { openTreasure } from '../src/meta/loot.js';
import { itemName } from '../src/meta/piece.js';
import { runTower, newTower } from '../src/sim/tower/session.js';

test('config : Exorcisme = 240 stonebricks angéliques pour la Tour du Démon, Pacte = 240 démoniaques pour la Tour de l\'Ange', () => {
  assert.deepEqual(SHRINES.list.exorcisme.price, { 'Stonebrick angélique': 240 });
  assert.equal(SHRINES.list.exorcisme.tower, 'demon');
  assert.deepEqual(SHRINES.list.pacte.price, { 'Stonebrick démoniaque': 240 });
  assert.equal(SHRINES.list.pacte.tower, 'angel');
  assert.equal(TOWER.stele.crashKnock, 10);
  assert.equal(TOWER.stele.mobs, 5);
  assert.equal(TOWER.stele.mobHp, 1.5);
  assert.equal(TOWER.stele.bossHp, 1.5);
  assert.equal(RUNE.luck.beni.rings, 2);
});

test('stèle : payée comme un shrine, décomptée seulement au lancement d\'une tour de son camp', () => {
  const st = createShrines(), inv = createInventory();
  addItem(inv, 'Stonebrick angélique', 300);
  const r = give(st, inv, { shrine: 'exorcisme', item: 'Stonebrick angélique', qty: 300, opId: 'a' });
  assert.equal(r.given, 240); assert.equal(r.activated, true);
  assert.equal(countOf(inv, 'Stonebrick angélique'), 60);
  assert.deepEqual(consume(st), [], 'une mine classique ne la décompte pas');
  assert.deepEqual(consume(st, 'angel'), [], 'ni la Tour de l\'Ange');
  assert.deepEqual(consume(st, 'demon'), ['exorcisme']);
  assert.equal(st.active.exorcisme, SHRINES.list.exorcisme.sessions - 1);
});

test('trésor béni : même trésor, nom « béni », chances des anneaux × 2', () => {
  const beni = treasureItem('demon', 5, 'beni');
  assert.equal(beni, 'Trésor démoniaque R5 béni');
  assert.deepEqual(ITEMS[beni].chest, { side: 'demon', q: 5, luck: 'beni' });
  assert.match(itemName(beni), /Trésor démoniaque béni$/);
  /* un tirage qui tombe juste au-delà des chances normales des anneaux : rien d'habitude, un anneau si béni */
  const total = RINGS.drops.demon.reduce((s, r) => s + r.chance, 0);
  const rolls = (v) => () => v;
  const open = item => { const inv = createInventory(); addItem(inv, item, 1); return openTreasure(inv, item, 'op', rolls(total * 1.5)).loot; };
  const ringsIn = loot => Object.keys(loot).filter(k => RINGS.drops.demon.some(r => r.item === k));
  assert.equal(ringsIn(open(treasureItem('demon', 5))).length, 0);
  assert.equal(ringsIn(open(beni)).length, 1);
});

const M = (name, carac, skillTree = null, skills = {}) => ({ name, account: name, carac, skillTree, skills });
const strong = () => [M('A', { mineSpeed: 6, damage: 400 }), M('Logi', { mineSpeed: 6, damage: 400 }, 'logisticien', { winch: 1 }),
                      M('Barb', { mineSpeed: 6, damage: 400 }, 'barbare')];

test('tour avec Exorcisme : le boss tué, l\'Ange s\'écrase (PV × 1,5), treuil brisé, 5 Séraphins par étage ; victoire = 2e boss', () => {
  const G = runTower(3, { side: 'demon', level: 1, stele: 'exorcisme', miners: strong() });
  assert.equal(G.phase2, true);
  assert.equal(G.winchBroken, true); assert.equal(G.winch, null);
  assert.equal(G.boss.side, 'angel'); assert.equal(G.boss.name, TOWER.sides.angel.boss);
  assert.equal(G.boss.maxhp, TOWER.boss.hp * TOWER.levels[1].hp * TOWER.stele.bossHp);
  const added = G.mobs.filter(o => o.stele);
  assert.equal(added.length, TOWER.stele.mobs * TOWER.stele.floors.length);
  assert.ok(added.every(o => o.side === 'angel' && o.maxhp === TOWER.mobs.hp * TOWER.levels[1].hp * TOWER.stele.mobHp));
  assert.equal(G.summary.success, G.boss.hp <= 0, 'victoire seulement si le 2e boss est mort');
  assert.equal(G.summary.stele, 'exorcisme');
});

test('sans stèle, ou avec la stèle de l\'autre camp : pas de phase 2', () => {
  const G = runTower(3, { side: 'demon', level: 1, miners: strong() });
  assert.equal(G.phase2, false); assert.equal(G.summary.success, true);
  assert.equal(newTower(3, { side: 'demon', stele: 'pacte', miners: strong() }).stele, null);
});
