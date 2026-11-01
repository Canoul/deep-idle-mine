/* Bulle « tableau de butin » (01/11/2026, Jules) : src/meta/loot-table.js (tables lues dans la config) et
   src/ui/loot-tip.js (HTML de la bulle). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOT, ITEMS, MOBS, RINGS, GOLBUTE, UPGRADE, INSTANCE, DUNGEON, MOB_DROPS, goblinChestItem, golbuteChestItem, treasureItem } from '../src/config.js';
import { lootTableOf, instanceLootTable, towerLootTable, mobLootTable, mobLoot, pctText } from '../src/meta/loot-table.js';
import { canOpen } from '../src/meta/loot.js';
import { lootTipHtml, lootHelp } from '../src/ui/loot-tip.js';
import { MOB_INFO as WIKI_MOBS } from '../src/wiki/data.js';

const items = t => t.groups.flatMap(g => g.rows.map(r => r.item)).filter(Boolean);

test('chaque Treasure TX : tous ses objets « toujours » et tirés sont dans la bulle', () => {
  for(const [name, l] of Object.entries(LOOT)){
    const t = lootTableOf(name), shown = items(t);
    for(const a of l.always) assert.ok(shown.includes(a.item), `${name} : ${a.item}`);
    for(const f of l.oneOf) for(const i of f.items) assert.ok(shown.includes(i.item), `${name} : ${i.item}`);
    assert.equal(t.groups[0].label, 'Toujours');
  }
});

test('tout objet qui s\'ouvre a un tableau, les autres non', () => {
  for(const name of Object.keys(ITEMS)) if(canOpen(name)) assert.ok(lootTableOf(name), name);
  assert.equal(lootTableOf('Fer'), null);
  assert.equal(lootTableOf('Pioche en pierre'), null);
  assert.equal(lootTableOf('objet inconnu'), null);
});

test('Coffre du Roi Gobelin II : chances des objets × le multiplicateur du niveau 2', () => {
  const t1 = lootTableOf(goblinChestItem(4, 1)), t2 = lootTableOf(goblinChestItem(4, 2)), k = INSTANCE.levels[2].chest.drop;
  const c = (t, item) => t.groups.flatMap(g => g.rows).find(r => r.item === item).chance;
  assert.ok(Math.abs(c(t2, 'Couronne du Roi Gobelin') - c(t1, 'Couronne du Roi Gobelin') * k) < 1e-12);
});

test('Coffre du Golbute : sa table de la config', () => {
  const shown = items(lootTableOf(golbuteChestItem(3)));
  for(const a of GOLBUTE.loot.always) assert.ok(shown.includes(a.item));
  assert.ok(shown.includes('Némésis du Golbute'));
});

test('trésor de tour : une rune toujours, les anneaux du camp ; béni : chances × 2', () => {
  const t = lootTableOf(treasureItem('angel', 5)), b = lootTableOf(treasureItem('angel', 5, 'beni'));
  assert.ok(items(t).includes('Rune'));
  assert.deepEqual(items(t).filter(i => i !== 'Rune'), RINGS.drops.angel.map(r => r.item));
  const ring = t => t.groups.at(-1).rows[0].chance;
  assert.equal(ring(b), ring(t) * 2);
});

test('instance et tour : qualités R1 à R7 en tête, chances qui font 100 %', () => {
  for(const t of [instanceLootTable('instance_1', 1), instanceLootTable('instance_1', 2), instanceLootTable('instance_2'), towerLootTable('demon')]){
    const q = t.groups[0];
    assert.equal(q.rows.length, UPGRADE.qualities.length);
    assert.ok(Math.abs(q.rows.reduce((s, r) => s + r.chance, 0) - 1) < 1e-9, t.title);
  }
  assert.match(instanceLootTable('instance_1', 2).title, /Coffre du Roi Gobelin II$/);
  assert.equal(instanceLootTable('instance_3'), null);   // pas encore prête : pas de coffre
  assert.equal(towerLootTable('inconnu'), null);
});

test('mobs : chaque mob de la mine et le minotaure, avec leur butin rare', () => {
  const t = mobLootTable();
  for(const m of Object.keys(MOBS.hpBase)){
    const row = t.mobs.find(x => x.id === m);
    assert.ok(row?.loot.length, `${m} sans butin`);
    for(const d of MOB_DROPS.items.filter(d => d.mob === m)) assert.ok(row.rare.some(r => r.item === d.item));
  }
  const mino = t.mobs.find(x => x.id === DUNGEON.boss.type);
  assert.ok(mino.rare.some(r => r.khole != null));
  for(const m of t.mobs) for(const l of m.loot) if(l.item) assert.ok(l.min >= 1 && l.max >= l.min, `${m.id} ${l.item}`);
});

test('wiki : même butin des mobs que la bulle (chien et ver compris)', () => {
  for(const m of ['chien', 'ver', 'gobelin']) assert.deepEqual(WIKI_MOBS[m].loot, mobLoot(m));
  assert.deepEqual(WIKI_MOBS.mimic.loot, []);   // le wiki écrit sa propre phrase pour le mimic
});

test('HTML de la bulle : titre, lignes, clés inconnues', () => {
  const h = lootTipHtml('item:Treasure T3');
  assert.match(h, /^<b>Treasure T3<\/b>/);
  assert.match(h, /Clé d&#39;instance I|Clé d'instance I/);
  assert.match(h, /20 %/);
  assert.match(lootTipHtml('mobs'), /Chien de magma/);
  assert.match(lootTipHtml('tower:angel'), /Rune/);
  assert.match(lootTipHtml('instance:instance_1:2'), /R7/);
  assert.equal(lootTipHtml('item:Fer'), null);
  assert.equal(lootTipHtml('nimporte'), null);
  assert.match(lootHelp('mobs', 'Butin des mobs'), /data-loot="mobs"/);
  assert.equal(pctText(0.005), '0,5 %');
});
