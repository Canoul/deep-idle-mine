/* Maison de guilde (02/11/2026) : étape de la maison, état des annexes, affichage dans l'onglet Guilde. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUILD } from '../src/config.js';
import { givenPart, housePoints, houseStage, annexState, houseState } from '../src/shared/guild-house.js';
import { houseHTML, mineHTML, peekHTML } from '../src/ui/guild.js';

const mat = (have, need) => ({ item:'Pierre', have, need });
const row = (id, level = 0, mats = [mat(0, 100)]) => ({ id, level, max:1, ready:false, materials:level >= 1 ? [] : mats });
const empty = () => GUILD.buildings.map(b => row(b.id));

test('part donnée : moyenne des matériaux, chacun plafonné à 1', () => {
  assert.equal(givenPart(row('forge', 0, [mat(50, 100), mat(0, 25)])), 0.25);
  assert.equal(givenPart(row('forge', 0, [mat(500, 100), mat(25, 25)])), 1);
  assert.equal(givenPart(row('forge', 0, [])), 0);
  assert.equal(givenPart(row('forge', 0, [mat(NaN, 100), mat(-5, 100), mat(5, 0)])), 0);
});

test('points : niveaux construits + parts données', () => {
  assert.equal(housePoints(empty()), 0);
  assert.equal(housePoints([row('armurerie', 1), row('forge', 0, [mat(50, 100)])]), 1.5);
  assert.equal(housePoints(null), 0);
});

test('étapes : seuils de la config, la dernière seulement quand tout est construit', () => {
  const s = GUILD.house.stages;
  assert.equal(houseStage(0), 0);
  assert.equal(houseStage(s[1].at - 0.01), 0);
  assert.equal(houseStage(s[1].at), 1);
  assert.equal(houseStage(s[2].at), 2);
  assert.equal(houseStage(GUILD.buildings.length - 0.01), 2);
  assert.equal(houseStage(GUILD.buildings.length), s.length - 1);
  assert.equal(houseStage(99), s.length - 1);
});

test('les points ne baissent pas quand un bâtiment est construit (sa part repart de 0, son niveau monte)', () => {
  const before = housePoints([row('armurerie', 0, [mat(100, 100), mat(25, 25)])]);
  const after = housePoints([row('armurerie', 1)]);
  assert.ok(after >= before);
});

test('annexes : vide, chantier dès un don, construite au niveau 1', () => {
  assert.equal(annexState(row('forge')), 'empty');
  assert.equal(annexState(row('forge', 0, [mat(1, 100)])), 'site');
  assert.equal(annexState(row('forge', 1)), 'built');
  assert.equal(annexState(undefined), 'empty');
});

test('état complet : une annexe par bâtiment de la config, étape suivante', () => {
  const st = houseState([row('armurerie', 1), row('tresorerie', 0, [mat(10, 100)])]);
  assert.deepEqual(Object.keys(st.annexes).sort(), GUILD.buildings.map(b => b.id).sort());
  assert.equal(st.annexes.armurerie, 'built'); assert.equal(st.annexes.tresorerie, 'site'); assert.equal(st.annexes.forge, 'empty');
  assert.equal(st.stage, 1); assert.equal(st.next, GUILD.house.stages[2].at);
  const done = houseState(GUILD.buildings.map(b => row(b.id, 1)));
  assert.equal(done.stage, GUILD.house.stages.length - 1); assert.equal(done.next, null);
});

test('chaque bâtiment de guilde a sa place dans la scène, dans les limites', () => {
  const h = GUILD.house;
  for(const b of GUILD.buildings) assert.ok(h.annexes[b.id], `annexe manquante : ${b.id}`);
  for(const a of [h.hall, ...Object.values(h.annexes), ...Object.values(h.annexes).map(a => ({ x:a.x, w:h.site.w }))]) assert.ok(a.x >= 0 && a.x + a.w <= h.w);
  for(let i = 1; i < h.stages.length; i++) assert.ok(h.stages[i].at > h.stages[i - 1].at);
});

test('les sprites existent, à la largeur annoncée en config, et tiennent au-dessus du sol', () => {
  const h = GUILD.house, size = tex => { const b = readFileSync(new URL(`../textures/${tex}.png`, import.meta.url)); return { w:b.readUInt32BE(16), h:b.readUInt32BE(20) }; };
  const all = [...h.stages.map(s => [s.tex, h.hall.w]), [h.site.tex, h.site.w], ...Object.values(h.annexes).map(a => [a.tex, a.w])];
  for(const [tex, w] of all){
    const s = size(tex);
    assert.equal(s.w, w, `${tex} : largeur`);
    assert.ok(s.h <= h.h - h.ground, `${tex} : trop haut`);
  }
});

test('scène : sprite de l\'étape, annexes construites ou en chantier, terrain vide sans image', () => {
  const html = houseHTML([row('armurerie', 1), row('tresorerie', 0, [mat(10, 100)]), row('forge')]);
  assert.match(html, /guild_hall_2\.png/);
  assert.match(html, /guild_wing_armory\.png/);
  assert.match(html, /guild_site\.png/);
  assert.ok(!html.includes('guild_wing_forge'));
  assert.ok(!html.includes('guild_wing_treasury'));
  assert.match(html, /Étape 2 \/ 4/);
  assert.match(houseHTML(GUILD.buildings.map(b => row(b.id, 1))), /Maison achevée/);
});

test('la scène est dans l\'onglet de sa guilde et dans la fiche d\'une autre guilde', () => {
  const g = { id:'g1', name:'X', level:1, into:0, need:10, xp:0, rank:'member', max:30, members:[], requests:[], buildings:empty(), owned:{}, canBuild:false, log:{ rows:[], next:0 } };
  assert.match(mineHTML(g), /ghouse/);
  assert.match(peekHTML({ id:'g2', name:'Y', buildings:empty(), log:{ rows:[], next:0 } }), /ghouse/);
});

/* Carreau (02/11/2026) : la maison de guilde est un bâtiment de la ville */
test('Carreau : bâtiment de l\'onglet Guilde, aussi large que la scène, porte devant le portail', async () => {
  const { buildingOf } = await import('../src/shared/town.js');
  const { TEXTURES } = await import('../src/config.js');
  const b = buildingOf('guilde'), H = GUILD.house;
  assert.equal(b.kind, 'guild');
  assert.equal(b.w * 16, H.w);
  const portal = (b.door - b.x) * 16 - H.hall.x;                 // portail : x 78 à 102 du sprite de la maison
  assert.ok(portal >= 78 && portal <= 102, `porte à ${portal} px`);
  const texs = [...H.stages.map(s => s.tex), H.site.tex, H.lot.tex, ...Object.values(H.annexes).map(a => a.tex)];
  for(const t of texs) assert.ok(TEXTURES.includes(t), `${t} absent de TEXTURES`);
});

test('Carreau : halos et fumée dans leur sprite, terrain vide à sa largeur', () => {
  const H = GUILD.house, size = tex => { const d = readFileSync(new URL(`../textures/${tex}.png`, import.meta.url)); return { w:d.readUInt32BE(16), h:d.readUInt32BE(20) }; };
  const all = [...H.stages, ...Object.values(H.annexes)];
  for(const p of all){
    const s = size(p.tex);
    for(const [x, y, r, kind] of p.glows ?? []){
      assert.ok(x >= 0 && x < s.w && y >= 0 && y < s.h && r > 0, `${p.tex} : halo hors du sprite`);
      assert.ok(kind === undefined || kind === 'red');
    }
    if(p.smoke) assert.ok(p.smoke[0] >= 0 && p.smoke[0] < s.w && p.smoke[1] >= 0 && p.smoke[1] < s.h);
  }
  assert.equal(size(H.lot.tex).w, H.lot.w);
  assert.ok(size(H.lot.tex).h <= H.h - H.ground);
});
