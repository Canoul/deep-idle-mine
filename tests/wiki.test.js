/* Wiki du joueur : les données affichées viennent bien de la config, et rien n'est oublié. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ITEMS, AREAS, CFG, LOOT, STATS, MOBS, mobHp, SPELLS, XP, RINGS } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { SERVER, ROOT } from '../server/config.js';
import { resolvePublic } from '../server/http/static.js';
import * as D from '../src/wiki/data.js';

test('wiki : chaque objet du jeu est listé une fois, avec un usage et une source', () => {
  const all = D.itemGroups().flatMap(g => g.items);
  /* sauf les anciens coffres de tour (plus donnés, remplacés par les trésors le 22/10) */
  assert.deepEqual(all.map(i => i.name).sort(), Object.keys(ITEMS).filter(n => !(ITEMS[n].chest && !ITEMS[n].treasure)).sort());
  for(const i of all){
    assert.ok(i.uses.length && i.sources.length, i.name);
    assert.ok(i.rarity, i.name);
  }
});

test('wiki : sources et usages tirés des recettes, du four, des treasures et des shiny', () => {
  const by = Object.fromEntries(D.itemGroups().flatMap(g => g.items).map(i => [i.name, i]));
  assert.ok(by['Shiny iron'].sources[0].startsWith('1 % de chance en minant du fer'));
  assert.ok(by['Shiny gold'].sources[0].includes('de l\'or'));
  assert.ok(by['Four en fer BP'].uses.some(u => u.includes('débloque la recette Four en fer')));
  assert.ok(by['Four en fer'].uses.some(u => u.includes('ouvre le four 2')));
  assert.ok(by['Peau de gobelin'].uses.some(u => u.includes('Tainted gold')));
  assert.ok(!by['Chitine'].uses.some(u => u.includes('Tainted gold')));
  assert.ok(by['Rubis inférieur'].sources.some(s => s === 'Treasure T2 : 1,5 % de chance'));
  assert.deepEqual(by['Gants tactique'].stats, [`Vitesse d'attaque +${ITEMS['Gants tactique'].stats.attackSpeed} %`]);
  assert.deepEqual(by['Épée en fer'].stats, ['Dégâts 14']);
  assert.equal(by['Tissu sombre'].sources[0], 'Butin des occultistes (1 à 3)');
  for(const [name, r] of Object.entries(RECIPES)) assert.deepEqual(by[name].recipe.cost, r.cost, name);
});

test('wiki : nouveautés — plumes de la mine instantanée, matériaux d\'amélioration, concasseur, donjon', async () => {
  const { UPGRADE, INSTANT_MINE, DUNGEON, CRUSHER } = await import('../src/config.js');
  const by = Object.fromEntries(D.itemGroups().flatMap(g => g.items).map(i => [i.name, i]));
  const plume = by[INSTANT_MINE.featherItem];
  assert.ok(plume.sources.some(s => s.startsWith('Mine instantanée')), plume.sources.join(' / '));
  assert.ok(plume.uses.some(u => u.startsWith('Amélioration : ') && u.includes(`${UPGRADE.levels[2].cost[INSTANT_MINE.featherItem]} pour +3`)));
  assert.ok(by[DUNGEON.loot.item].uses.some(u => u.startsWith('Amélioration : ')));
  assert.ok(by['Pioche en pierre'].uses.includes('S\'identifie et s\'améliore (onglet Amélioration)'));
  assert.equal(D.qualityRows().length, 7);
  assert.equal(D.upgradeTotal()[INSTANT_MINE.featherItem], UPGRADE.levels.reduce((s, l) => s + l.cost[INSTANT_MINE.featherItem], 0));
  const rows = D.crusherRows();
  assert.deepEqual(rows.map(r => r.block), Object.keys(CRUSHER.loot));
  assert.ok(rows.every(r => r.families.every(f => f.chance > 0 && f.every === undefined && f.sec === undefined)));
  const html = fs.readFileSync(new URL('../wiki.html', import.meta.url), 'utf8');
  for(const id of ['mi', 'amelioration', 'concasseur', 'w-mi', 'w-qualities', 'w-upgrade', 'w-mi-notify', 'w-mi-lost'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(!html.includes('Bientôt : liste d\'amis') && !html.includes('La barre à gauche') && !html.includes('viendra plus tard'));
  for(const id of ['ange', 'w-judgment', 'w-tower', 'w-runes']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(by['Résidu angélique'].sources[0].startsWith('Miné à partir de l\'area 4'));
  assert.ok(by['Trésor démoniaque R7'].uses[0].includes('Rune R7'));
  assert.equal(by['Coffre démoniaque R7'], undefined, 'ancien coffre : plus listé');
  assert.ok(!by.Rune.sources.includes('Pas encore obtenable'));
  assert.equal(D.runeRows().length, 7);
});

test('wiki : areas — % de la config, seuil de déblocage = 40 % des minerais', () => {
  const rows = D.areaRows();
  assert.equal(rows.length, AREAS.length);
  assert.deepEqual(rows.map(r => r.ores), [250, 400, 500, 500, 500, 501, 500]);
  for(const r of rows) assert.equal(r.unlock, Math.ceil(CFG.unlockRatio * r.ores));
  assert.deepEqual(rows.map(r => r.tier), ['Treasure T1', 'Treasure T1', 'Treasure T1', 'Treasure T2', 'Treasure T2', 'Treasure T3', 'Treasure T3']);
});

test('wiki : mobs — table d\'apparition et PV de la config, occultiste compris', () => {
  const rows = D.mobRows();
  assert.equal(rows.length, MOBS.spawnTable.length);
  for(const r of rows) for(const m of D.MOB_TYPES){
    assert.equal(r.types[m].chance, MOBS.spawnTable[r.k][m] || 0);
    assert.equal(r.types[m].hp, r.k >= MOBS.minArea[m] ? mobHp(m, r.k) : null);
  }
  assert.ok(D.MOB_TYPES.includes('occultiste'));
  assert.deepEqual(D.MOB_INFO.occultiste.loot, [{ item:'Tissu sombre', min:1, max:3 }, { item:'Chitine', min:1, max:2 }]);
  assert.deepEqual(D.MOB_INFO.bestiole.loot, [{ item:'Chitine', min:1, max:2 }]);
  for(const r of rows) assert.ok(r.spawn[0] < r.spawn[1]);
});

test('wiki : stats, treasures, niveaux, format français', () => {
  const st = D.statRows();
  assert.deepEqual(st.map(s => s.key).sort(), Object.keys(STATS).sort());
  assert.ok(st.every(s => s.help), 'chaque stat a son explication');
  assert.deepEqual(D.lootTables().map(t => t.name), Object.keys(LOOT));
  assert.equal(D.lootTables()[0].families.find(f => f.family === 'blueprint').total.toFixed(2), '0.17');   // 7 BP en fer à 2 % (lance comprise) + 3 à 1 % (25/10)
  assert.deepEqual(D.levelRows(4), [{ level:2, need:1000, total:1000 }, { level:3, need:1500, total:2500 }, { level:4, need:2250, total:4750 }]);
  assert.equal(D.fmt(1234.5), '1 234,5');
  assert.equal(D.fmt(2.25), '2,25');
});

test('wiki : la page est servie par le jeu (et seulement elle, pas un autre .html de la racine)', () => {
  assert.ok(fs.existsSync(new URL('../wiki.html', import.meta.url)));
  assert.ok(resolvePublic(ROOT, SERVER.publicPaths, '/wiki.html'));
  assert.ok(resolvePublic(ROOT, SERVER.publicPaths, '/src/wiki/wiki.js'));
  assert.equal(resolvePublic(ROOT, SERVER.publicPaths, '/GAME_DESIGN.md'), null);
});

test('wiki : sorts, XP de spécialisation, anneaux et date de mise à jour (24/10)', () => {
  const sp = D.spellRows();
  assert.deepEqual(sp.map(s => s.id), SPELLS.list.map(s => s.id), 'chaque sort du jeu est listé');
  const dash = sp.find(s => s.id === 'dash');
  assert.deepEqual([dash.unlock.tree.label, dash.unlock.level, dash.needTree.label, dash.cd], ['Barbare', 5, 'Barbare', 30]);
  assert.equal(sp.find(s => s.id === 'ulti_shen').unlock.scroll, 'Parchemin « Ulti shen »');
  assert.equal(sp.find(s => s.id === 'ulti_shen').needTree, null);
  const spec = D.specInfo();
  assert.equal(spec.pct, XP.specPct);
  assert.equal(spec.sameCurve, true, 'XP de spé : mêmes paliers que le niveau');
  assert.ok(Math.abs(D.ringDrop().angel - RINGS.drops.angel.reduce((t, r) => t + r.chance, 0)) < 1e-9);
  const html = fs.readFileSync(new URL('../wiki.html', import.meta.url), 'utf8');
  assert.match(html, /class="maj"[^>]*>🗓 Mis à jour le \d{2}\/\d{2}\/\d{4}</, 'date de mise à jour dans le bandeau');
  for(const id of ['sorts', 'spe', 'anneaux', 'sets', 'w-spells', 'w-spec']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(!/Il en porte 10/.test(html), 'passerelles illimitées');
});

test('wiki : chance de treasure par area lue dans la config (50 % en areas 0 à 2, 40 % au-delà, 25/10 au soir)', () => {
  assert.equal(D.treasureChanceText(), '40 à 50 %');
  assert.deepEqual(AREAS.map(a => a.chestChance), [0.5, 0.5, 0.5, 0.4, 0.4, 0.4, 0.4]);
});

test('wiki : glyphes — tableau généré depuis GLYPHS (10 lignes), usage des objets, section dans la page', async () => {
  const { GLYPHS } = await import('../src/config.js');
  const rows = D.glyphRows();
  assert.equal(rows.length, 10);
  const rush = rows.find(r => r.node === 'ore_rush');
  assert.deepEqual({ item:rush.item, skill:rush.skill, desc:rush.desc }, { item:'Glyphe Ruée', skill:'Ruée', desc:GLYPHS.desc.ore_rush });
  assert.ok(rush.tree, 'arbre du skill');
  const g = D.itemGroups().find(x => x.cat === 'glyph');
  assert.equal(g.label, 'Glyphe');
  for(const it of g.items) assert.match(it.uses.join(' '), /onglet Skills/, it.name);
  const html = fs.readFileSync('wiki.html', 'utf8');
  assert.match(html, /id="glyphes"/); assert.match(html, /id="w-glyphs"/);
});

test('wiki : source des glyphes lue dans GLYPHS.drop (par spécialisation)', () => {
  const g = D.itemGroups().find(x => x.cat === 'glyph');
  const rush = g.items.find(i => i.name === 'Glyphe Ruée'), braum = g.items.find(i => i.name === 'Glyphe Braum'), lad = g.items.find(i => i.name === 'Glyphe Échelle de 2');
  assert.match(rush.sources.join(' '), /0,00383 % de chance par bloc/);
  assert.match(lad.sources.join(' '), /0,0335 % de chance par échelle/);
  assert.match(braum.sources.join(' '), /0,101 % de chance par mob/);
  assert.match(rush.sources.join(' '), /≈ 3 % par session/);
});
