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
};

test('config : case, rareté, tier 2, pas de recette, textures et skin ; chaque recyclage rend des objets connus', () => {
  for(const [n, p] of Object.entries(PIECES)){
    const d = STUFF.items[n];
    assert.equal(d.slot, p.slot, n);
    assert.equal(RARITY.items[n], p.rarity, n);
    assert.ok(UPGRADE.tiers[2].items.includes(n), `${n} : tier 2`);
    assert.equal(RECIPES[n], undefined, `${n} : pas craftable`);
    assert.ok(TEXTURES.includes(d.tex) && existsSync(`textures/${d.tex}.png`), `${n} : icône`);
    assert.ok(SKIN.armor[n] && existsSync(`textures/${SKIN.armor[n]}.png`), `${n} : skin`);
    assert.deepEqual(d.recycle, p.recycle, n);
    for(const k of Object.keys(d.recycle)) assert.ok(ITEMS[k], `${n} : ${k} existe`);
    assert.equal(MOB_DROPS.items.find(x => x.item === n)?.mob, p.mob, n);
  }
});

/* x d'une pièce au tableau des runes (UPGRADE.prices) */
const runeX = n => Object.entries(STUFF.items[n].stats).reduce((s, [k, v]) => s + v * UPGRADE.prices[k], 0);
const gsPrice = k => UPGRADE.worth[k] ?? UPGRADE.gs[k];

test('valeur en x : celle de la pièce en fer de la case (ceinture : tier 2) ; prix mesurés (GS) pour le Nuage et la Ceinture, tableau des runes pour les Lanières et la Capuche', () => {
  assert.ok(Math.abs(pieceGS('Nuage magique') - pieceGS('Jambes en fer')) <= 2, `Nuage : ${pieceGS('Nuage magique')}`);
  assert.ok(Math.abs(pieceGS('Ceinture du Géant') - UPGRADE.tiers[2].x) <= 2, `Ceinture : ${pieceGS('Ceinture du Géant')}`);
  assert.ok(Math.abs(runeX('Lanières en cuir du gobelin') - runeX('Plastron en fer')) <= 2);
  assert.ok(Math.abs(runeX('Capuche sombre') - runeX('Casque en fer')) <= 2);
  /* les deux stats se partagent la valeur à peu près moitié / moitié (dans leur barème) */
  for(const [n, price] of [['Lanières en cuir du gobelin', k => UPGRADE.prices[k]], ['Capuche sombre', k => UPGRADE.prices[k]], ['Ceinture du Géant', gsPrice]]){
    const parts = Object.entries(STUFF.items[n].stats).map(([k, v]) => v * price(k));
    assert.equal(parts.length, 2, n);
    assert.ok(Math.abs(parts[0] - parts[1]) <= 0.1 * (parts[0] + parts[1]), `${n} : ${parts.map(Math.round)}`);
  }
});

/* tue `n` mobs de ce type dans une même partie ; renvoie le nombre de pièces lâchées */
function drops(type, n, { khole = false, seed = 7, looting = 0 } = {}){
  const G = newSession(seed, { miners: 1 }), m = G.miners[0];
  if(khole) G.khole = {};
  m.carac.looting = looting;
  const item = MOB_DROPS.items.find(d => d.mob === type).item;
  for(let i = 0; i < n; i++){
    const o = { id: G.mobId++, type, x: m.x, y: m.y, hp: 1, maxhp: 1, cd: 1 };
    G.mobs.push(o);
    killMob(G, m, o);
  }
  return m.inv[item] ?? 0;
}

test('drop : 0,5 % sur gobelin, occultiste et méphite ; minotaure 1 %, 2 % dans un k hole', () => {
  const N = 40000, near = (got, p) => Math.abs(got / N - p) < p * 0.25;
  for(const d of MOB_DROPS.items){
    const got = drops(d.mob, N);
    assert.ok(near(got, d.chance), `${d.mob} : ${got} sur ${N}`);
  }
  assert.equal(MOB_DROPS.items.find(d => d.mob === DUNGEON.boss.type).chance, 0.01);
  const k = drops(DUNGEON.boss.type, N, { khole: true });
  assert.ok(near(k, 0.02), `minotaure en k hole : ${k} sur ${N}`);
  assert.ok(MOB_DROPS.items.filter(d => d.mob !== DUNGEON.boss.type).every(d => d.chance === 0.005));
});

test('drop : le butin du mineur multiplie la chance (1 % avec +50 % → 1,5 %), une seule pièce à la fois', () => {
  const N = 40000, near = (got, p) => Math.abs(got / N - p) < p * 0.2;
  const g = drops(DUNGEON.boss.type, N, { looting: 50 });
  assert.ok(near(g, 0.015), `minotaure, +50 % : ${g} sur ${N}`);
  const k = drops(DUNGEON.boss.type, N, { looting: 50, khole: true });
  assert.ok(near(k, 0.03), `minotaure en k hole, +50 % : ${k} sur ${N}`);
  /* jamais deux pièces d'un coup, même avec un butin énorme : au plus une par mob */
  assert.ok(drops('gobelin', 200, { looting: 1000 }) <= 200);
});

test('drop : hasard à part (le hasard de la partie ne bouge pas) ; rien pour un mob sans butin rare', () => {
  const a = newSession(3, { miners: 1 }), b = newSession(3, { miners: 1 });
  const kill = (G, type) => { const o = { id: G.mobId++, type, x: 0, y: 0, hp: 1, maxhp: 1, cd: 1 }; G.mobs.push(o); killMob(G, G.miners[0], o); };
  kill(a, 'bestiole');
  assert.equal(a.dropRng, undefined, 'pas de tirage pour une bestiole');
  /* même partie avec et sans le tirage rare : le hasard principal donne la même suite */
  kill(b, 'bestiole');
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
  assert.ok(sourcesOf('Lanières en cuir du gobelin').some(s => /0,5 % de chance sur un gobelin/.test(s)));
  assert.ok(sourcesOf('Ceinture du Géant').some(s => /1 % de chance sur un minotaure \(2 % dans un k hole\)/.test(s)));
});
