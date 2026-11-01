/* Arc de l'Admin (01/11/2026) : portée +8, tire de loin comme au contact ; aucune obtention (donné par l'administration). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { W, COMBAT, STUFF, ITEMS, LOOT, WIKI } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { equippedStats } from '../src/meta/stuff.js';
import { rarityOf } from '../src/meta/rarity.js';
import { reachOf, knockbackOf } from '../src/sim/knock.js';
import { minerView } from '../src/shared/view.js';
import { SKIN, SKIN_TEXTURES, bowOf, toolOf } from '../src/skins.js';
import { bowShot } from '../src/render/bow.js';
import { worldFrom, run } from './helpers.js';

const BOW = 'Arc de l\'Admin';
const corridor = rows => {
  const G = worldFrom(rows ?? ['', 'd'.repeat(W), '#@' + ' '.repeat(40) + '#', '#'.repeat(W)]);
  for(let x = 0; x < W; x++){ G.tiles[1][x] = 11; G.tiles[3][x] = 11; }
  const m = G.miners[0]; m.ox = 1e9; m.carac.oxygenMax = 1e9;
  Object.assign(m.carac, equippedStats([BOW]));
  return { G, m };
};
const mob = (G, m, at) => { const o = { id:G.mobId++, type:'bestiole', x:m.x + at, y:m.y, hp:1e9, maxhp:1e9, cd:0, speed:0 }; G.mobs.push(o); return o; };

test('objet : case épée, portée +8, dégâts +15, recul +2, légendaire', () => {
  assert.equal(STUFF.items[BOW].slot, 'epee');
  assert.deepEqual(STUFF.items[BOW].stats, { reach:8, damage:15, knockback:2 });
  assert.equal(rarityOf(BOW)?.id ?? rarityOf(BOW), 'legendaire');
  assert.equal(ITEMS[BOW].cat, 'stuff');
  const st = equippedStats([BOW]);
  assert.equal(reachOf({ carac:st }), COMBAT.reach + 8);
  assert.equal(knockbackOf({ carac:st }), COMBAT.knock + 2);
});

test('obtention : aucune recette, aucun butin ; caché du wiki', () => {
  assert.equal(RECIPES[BOW], undefined);
  assert.ok(!JSON.stringify(LOOT).includes(BOW));
  assert.ok(WIKI.secret.includes(BOW));
});

test('textures : icône, arc tenu, arc bandé, flèche', () => {
  for(const t of [STUFF.items[BOW].tex, SKIN.sword[BOW], SKIN.bow[BOW].drawn, SKIN.bow[BOW].arrow])
    assert.ok(existsSync(new URL(`../textures/${t}.png`, import.meta.url)), t);
  assert.ok(SKIN_TEXTURES.includes(SKIN.bow[BOW].drawn) && SKIN_TEXTURES.includes(SKIN.bow[BOW].arrow));
  assert.equal(bowOf({ epee:BOW }), SKIN.bow[BOW]);
  assert.equal(bowOf({ epee:'Épée en fer' }), null);
  assert.equal(bowOf({}), null);
  assert.equal(toolOf({ epee:BOW }, 'attack'), SKIN.sword[BOW]);
});

test('tir à 8 cases : le mob perd des PV sans que le mineur avance', () => {
  const { G, m } = corridor(), x = m.x, o = mob(G, m, 8);
  run(G, 10);
  assert.ok(o.hp < o.maxhp, 'touché de loin');
  assert.equal(m.x, x, 'il ne s\'approche pas');
  assert.equal(m.action?.type, 'attack');
});

test('un mur entre les deux : pas de tir à travers', () => {
  const { G, m } = corridor(['', 'd'.repeat(W), '#@   h    ' + ' '.repeat(30) + '#', '#'.repeat(W)]);
  G.tiles[2][m.x + 4] = 11;
  const o = mob(G, m, 6);
  run(G, 10);
  assert.equal(o.hp, o.maxhp);
});

test('au contact : il continue à tirer, et la vue donne la case du mob', () => {
  const { G, m } = corridor(), o = mob(G, m, 1);
  run(G, 3);
  assert.ok(o.hp < o.maxhp);
  assert.equal(m.action?.type, 'attack');
  assert.deepEqual(minerView(G, m).action.data.aim, { x:o.x, y:o.y });
});

test('vue : pas de cible hors combat', () => {
  const { G, m } = corridor();
  m.action = { type:'mine', t:0, dur:1, data:{ x:3, y:2 } };
  assert.equal(minerView(G, m).action.data.aim, undefined);
});

test('animation : l\'arc se bande, puis la flèche part de 0 à 1 vers la cible', () => {
  const m = { x:5, y:2, face:1, action:{ type:'attack', data:{ aim:{ x:9, y:2 } } } };
  const pull = bowShot(m, 0.1), fly = bowShot(m, 0.9);
  assert.equal(pull.drawn, true); assert.equal(pull.arrow, null);
  assert.equal(fly.drawn, false); assert.ok(fly.arrow > 0 && fly.arrow <= 1);
  assert.equal(pull.dist, 4); assert.equal(pull.angle, 0);
});

test('animation : vers le haut, et au contact la flèche part quand même', () => {
  const up = bowShot({ x:5, y:6, face:1, action:{ data:{ aim:{ x:5, y:2 } } } }, 0.1);
  assert.equal(up.dist, 4); assert.ok(Math.abs(up.angle + Math.PI / 2) < 1e-9);
  assert.equal(bowShot({ x:5, y:2, face:1, action:{ data:{ aim:{ x:6, y:2 } } } }, 0.9).dist, 1);
});

test('animation : sans cible connue (boss), une case devant lui, du côté où il regarde', () => {
  const s = bowShot({ x:5, y:2, face:-1, action:{ data:{} } }, 0.1);
  assert.equal(s.dist, 1); assert.ok(Math.abs(Math.abs(s.angle) - Math.PI) < 1e-9);
});
