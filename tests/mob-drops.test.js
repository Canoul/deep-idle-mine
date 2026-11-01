/* Butin rare des mobs (26/10/2026, Geoffrey) : quatre pièces de stuff non craftables, de la valeur en x de la pièce en
   fer de leur case (ceinture : x du tier 2), lâchées par un mob avec une chance × (1 + butin du mineur), recyclées en quantités fixes. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { MOB_DROPS, STUFF, ITEMS, RARITY, UPGRADE, TEXTURES, DUNGEON } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { SKIN } from '../src/skins.js';
import { pieceGS } from '../src/meta/gearscore.js';
import { createInventory, addItem } from '../src/meta/inventory.js';
import { recyclable, recycleRefund, recycleStuff } from '../src/meta/craft.js';
import { newSession } from '../src/sim/session.js';
import { killMob } from '../src/sim/actions.js';
import { sourcesOf } from '../src/wiki/data.js';

const PIECES = {
  'Lanières en cuir du gobelin': { mob:'gobelin', slot:'torse', iron:'Plastron en fer', rarity:'inhabituel',
                                   recycle:{ 'Chitine':20, 'Peau de gobelin':10 } },
  'Capuche sombre':      { mob:'occultiste', slot:'casque', iron:'Casque en fer', rarity:'rare', recycle:{ 'Chitine':30, 'Tissu sombre':10 } },
  'Nuage magique':       { mob:'mephite', slot:'jambes', iron:'Jambes en fer', rarity:'rare', recycle:{ 'Chitine':30, 'Vésicule de gaz':10 } },
  'Ceinture du Géant':   { mob:DUNGEON.boss.type, slot:'ceinture', x:UPGRADE.tiers[2].x, rarity:'epique', recycle:{ 'Chitine':50, 'Steel ingot':5 } },
  /* 31/10/2026 (Geoffrey) */
  'Piolet de gobelin':   { mob:'gobelin', slot:'pioche', rarity:'inhabituel', recycle:{ 'Tainted iron':6, 'Peau de gobelin':10 }, chance:0.005 },
  'Kilt ténébreux':      { mob:'occultiste', slot:'jambes', rarity:'rare', recycle:{ 'Tainted gold':6, 'Tissu sombre':10 }, chance:0.005 },
  'Chapeau de naab':     { mob:'bestiole', slot:'casque', tier:1, rarity:'inhabituel', recycle:{ 'Chitine':20 }, chance:0.01 },
  'Épée cassée en carton': { mob:'bestiole', slot:'epee', tier:1, rarity:undefined, recycle:{ 'Chitine':20 }, chance:0.01 },
};

test('config : case, rareté, tier 2, pas de recette, textures et skin ; chaque recyclage rend des objets connus', () => {
  for(const [n, p] of Object.entries(PIECES)){
    const d = STUFF.items[n];
    assert.equal(d.slot, p.slot, n);
    assert.equal(RARITY.items[n], p.rarity, n);
    assert.ok(UPGRADE.tiers[p.tier ?? 2].items.includes(n), `${n} : tier ${p.tier ?? 2}`);
    assert.equal(RECIPES[n], undefined, `${n} : pas craftable`);
    assert.ok(TEXTURES.includes(d.tex) && existsSync(`textures/${d.tex}.png`), `${n} : icône`);
    const skin = SKIN.armor[n] ?? SKIN.pickaxe[n] ?? SKIN.sword[n];
    assert.ok(skin && existsSync(`textures/${skin}.png`), `${n} : skin`);
    assert.deepEqual(d.recycle, p.recycle, n);
    for(const k of Object.keys(d.recycle)) assert.ok(ITEMS[k], `${n} : ${k} existe`);
    assert.equal(MOB_DROPS.items.find(x => x.item === n)?.mob, p.mob, n);
    if(p.chance) assert.equal(MOB_DROPS.items.find(x => x.item === n).chance, p.chance, n);
  }
});

/* valeur en x : tests/stuff-balance.test.js (règle du 27/10 : tier 2, parts égales, stat de combat à moitié) */

/* tue `n` mobs de ce type dans une même partie ; renvoie le nombre de pièces lâchées */
function drops(type, n, { khole = false, seed = 7, looting = 0 } = {}){
  const G = newSession(seed, { miners: 1 }), m = G.miners[0];
  if(khole) G.khole = {};
  m.carac.looting = looting;
  const items = MOB_DROPS.items.filter(d => d.mob === type).map(d => d.item);
  for(let i = 0; i < n; i++){
    const o = { id: G.mobId++, type, x: m.x, y: m.y, hp: 1, maxhp: 1, cd: 1 };
    G.mobs.push(o);
    killMob(G, m, o);
  }
  return items.reduce((a, i) => a + (m.inv[i] ?? 0), 0);
}

test('drop : les chances de chaque mob s\'additionnent ; minotaure 0,5 %, 1 % dans un k hole ; pièces du 26/10 à 0,1 % (nerf)', () => {
  const N = 200000, near = (got, p) => Math.abs(got / N - p) < p * 0.25;
  for(const mob of new Set(MOB_DROPS.items.map(d => d.mob))){
    const got = drops(mob, N), p = MOB_DROPS.items.filter(d => d.mob === mob).reduce((a, d) => a + d.chance, 0);
    assert.ok(near(got, p), `${mob} : ${got} sur ${N}`);
  }
  assert.equal(MOB_DROPS.items.find(d => d.mob === DUNGEON.boss.type).chance, 0.005);
  const k = drops(DUNGEON.boss.type, N, { khole: true });
  assert.ok(near(k, 0.01), `minotaure en k hole : ${k} sur ${N}`);
  assert.ok(MOB_DROPS.items.filter(d => ['Lanières en cuir du gobelin', 'Capuche sombre', 'Nuage magique'].includes(d.item)).every(d => d.chance === 0.001));
});

test('drop : le butin du mineur multiplie la chance (+50 % → ×1,5), une seule pièce à la fois', () => {
  const N = 200000, boss = MOB_DROPS.items.find(d => d.mob === DUNGEON.boss.type), near = (got, p) => Math.abs(got / N - p) < p * 0.2;
  const g = drops(DUNGEON.boss.type, N, { looting: 50 });
  assert.ok(near(g, boss.chance * 1.5), `minotaure, +50 % : ${g} sur ${N}`);
  const k = drops(DUNGEON.boss.type, N, { looting: 50, khole: true });
  assert.ok(near(k, boss.kholeChance * 1.5), `minotaure en k hole, +50 % : ${k} sur ${N}`);
  /* jamais deux pièces d'un coup, même avec un butin énorme : au plus une par mob */
  assert.ok(drops('gobelin', 200, { looting: 1000 }) <= 200);
  assert.ok(drops('bestiole', 200, { looting: 1000 }) <= 200);
});

test('drop : hasard à part (le hasard de la partie ne bouge pas) ; rien pour un mob sans butin rare', () => {
  const a = newSession(3, { miners: 1 }), b = newSession(3, { miners: 1 });
  const kill = (G, type) => { const o = { id: G.mobId++, type, x: 0, y: 0, hp: 1, maxhp: 1, cd: 1 }; G.mobs.push(o); killMob(G, G.miners[0], o); };
  kill(a, 'golem');
  assert.equal(a.dropRng, undefined, 'pas de tirage pour un golem');
  kill(a, 'bestiole');
  assert.ok(a.dropRng, 'tirage à part pour une bestiole');
  /* même partie avec et sans le tirage rare : le hasard principal donne la même suite */
  kill(b, 'golem'); kill(b, 'bestiole');
  assert.equal(a.rng(), b.rng());
});

test('recyclage : quantités fixes ; la pièce disparaît une fois, rien ne se rend deux fois', () => {
  for(const [n, p] of Object.entries(PIECES)){
    assert.ok(recyclable(n), n);
    assert.deepEqual(recycleRefund(n), p.recycle, n);
    const inv = createInventory();
    addItem(inv, n, 1);
    const uid = inv.slots[0].uid;
    const r = recycleStuff(inv, uid);
    assert.ok(r.ok, n);
    assert.deepEqual(r.refund, p.recycle);
    for(const [k, q] of Object.entries(p.recycle)) assert.equal(inv.slots.find(s => s?.item === k)?.qty, q, `${n} : ${k}`);
    assert.equal(recycleStuff(inv, uid).error, 'not_owned', 'deuxième demande');
    assert.ok(!inv.slots.some(s => s?.item === n));
  }
  /* le rendu fixe ne se partage pas avec la configuration : le modifier ne touche pas la config */
  recycleRefund('Nuage magique')['Chitine'] = 9999;
  assert.equal(STUFF.items['Nuage magique'].recycle['Chitine'], 30);
});

test('wiki : chaque pièce dit d\'où elle tombe', () => {
  assert.ok(sourcesOf('Lanières en cuir du gobelin').some(s => /0,1 % de chance sur un gobelin/.test(s)));
  assert.ok(sourcesOf('Ceinture du Géant').some(s => /0,5 % de chance sur un minotaure \(1 % dans un k hole\)/.test(s)));
});

test('butin du 31/10 : les stats voulues par Geoffrey', () => {
  const I = STUFF.items;
  assert.deepEqual(I['Piolet de gobelin'].stats, { mineSpeed:0.3 });
  assert.deepEqual(I['Kilt ténébreux'].stats, { mineSpeedPct:6.4 });
  assert.deepEqual(I['Chapeau de naab'].stats, { oxygenMax:8, pods:6, speed:0.14 });
  assert.deepEqual(I['Épée cassée en carton'].set, { damage:7 });
  const gs = pieceGS('Chapeau de naab'), x = UPGRADE.tiers[1].x;
  assert.ok(Math.abs(gs - x) <= 0.05 * x, `Chapeau de naab : ${gs} x au lieu de ${x}`);
});

test('une pièce recyclée rend ses quantités fixes : le Piolet de gobelin', () => {
  const inv = createInventory(); addItem(inv, 'Piolet de gobelin', 1);
  assert.deepEqual(recycleRefund('Piolet de gobelin'), { 'Tainted iron':6, 'Peau de gobelin':10 });
  assert.equal(recyclable('Piolet de gobelin'), true);
});

