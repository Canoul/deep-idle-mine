/* Anti-duplication du four : aucune suite d'actions (même trafiquées, rejouées, à des heures quelconques)
   ne crée de minerai, de charbon ou de lingot. 10 minerais + 10 charbons = 1 lingot, jamais plus. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FURNACE } from '../../src/config.js';
import { mulberry32 } from '../../src/core/rng.js';
import { createInventory, addAll, countOf } from '../../src/meta/inventory.js';
import { createFurnaces, furnaceOp, advance, sanitizeFurnaces } from '../../src/meta/furnace.js';

const START = { Fer:200, Or:100, Diamant:30, Charbon:400 };
const BAD_QTY = [0, -10, 2.5, Infinity, -Infinity, NaN, '50', 1e300, null, undefined, {}];

function total(inv, st, name){
  let n = countOf(inv, name);
  for(const f of st.list) for(const s of ['ore', 'fuel', 'out']) if(f[s]?.item === name) n += f[s].qty;
  return n;
}

test('four : matière conservée sur 500 suites d\'actions au hasard (quantités trafiquées, opId rejoués, 3 fours)', () => {
  const r = mulberry32(2026);
  for(let t = 0; t < 500; t++){
    const inv = createInventory(); addAll(inv, START);
    const st = createFurnaces(); while(st.list.length < FURNACE.max) st.list.push(createFurnaces().list[0]);
    let now = 1e6; const ids = [];
    for(let k = 0; k < 30; k++){
      now += Math.floor(r() * 200_000) - 20_000;                  // l'heure peut même reculer un peu
      const reuse = ids.length && r() < 0.2;
      const opId = reuse ? ids[Math.floor(r() * ids.length)] : 'op-' + t + '-' + k;
      ids.push(opId);
      const slot = ['ore', 'fuel', 'out', 'x'][Math.floor(r() * 4)];
      const item = ['Fer', 'Or', 'Diamant', 'Charbon', 'Lingot de fer', 'Pierre'][Math.floor(r() * 6)];
      const qty = r() < 0.2 ? BAD_QTY[Math.floor(r() * BAD_QTY.length)] : 1 + Math.floor(r() * 80);
      const action = ['load', 'load', 'unload', 'collect', 'hack', 'empty', 'emptyAll'][Math.floor(r() * 7)];   // empty / emptyAll : « Tout retirer » (22/10)
      furnaceOp(st, inv, { action, furnace: Math.floor(r() * 4) - (r() < 0.1 ? 5 : 0), slot, item, qty, opId }, now);
    }
    for(const f of st.list) advance(f, now + 1e12);
    const ingots = { Fer: total(inv, st, 'Lingot de fer'), Or: total(inv, st, 'Lingot d\'or'), Diamant: 0 };   // le diamant ne fond pas
    for(const ore of ['Fer', 'Or', 'Diamant'])
      assert.equal(total(inv, st, ore) + FURNACE.orePerIngot * ingots[ore], START[ore], `${ore} (essai ${t})`);
    const all = ingots.Fer + ingots.Or + ingots.Diamant;
    assert.equal(total(inv, st, 'Charbon') + FURNACE.fuelPerIngot * all, START.Charbon, `charbon (essai ${t})`);
    for(const s of inv.slots) if(s) assert.ok(Number.isSafeInteger(s.qty) && s.qty > 0);
  }
});

test('four : sauvegarde trafiquée (quantités folles, objets interdits, fours en trop) → nettoyée', () => {
  const st = sanitizeFurnaces({ list: Array.from({ length: 10 }, () => ({
    ore:{ item:'Charbon', qty:50 }, fuel:{ item:'Charbon', qty:-5 }, out:{ item:'Lingot de fer', qty:1.5 }, since:Infinity })) });
  assert.equal(st.list.length, FURNACE.max);
  for(const f of st.list) assert.deepEqual(f, { tier:0, mode:'smelt', ore:null, a:null, b:null, fuel:null, out:null, since:null });
});

test('alliage : matière conservée sur 300 suites d\'actions au hasard (modes, ingrédients, quantités trafiquées)', () => {
  const r = mulberry32(77);
  const BAG = { 'Lingot de fer':60, Chitine:200, Charbon:600, Fer:50 };
  const tot = (inv, st, name) => { let n = countOf(inv, name); for(const f of st.list) for(const s of ['ore','a','b','fuel','out']) if(f[s]?.item === name) n += f[s].qty; return n; };
  for(let t = 0; t < 300; t++){
    const inv = createInventory(); addAll(inv, BAG);
    const st = createFurnaces(); let now = 1e6; const ids = [];
    for(let k = 0; k < 30; k++){
      const pick = a => a[Math.floor(r() * a.length)];
      const opId = ids.length && r() < 0.2 ? pick(ids) : 'o' + t + '-' + k; ids.push(opId);
      const o = { furnace:0, opId, action:pick(['load','load','unload','collect','mode','empty','emptyAll']), slot:pick(['ore','a','b','fuel','out']),
                  item:pick(Object.keys(BAG)), qty:r() < 0.2 ? pick(BAD_QTY) : 1 + Math.floor(r() * 40), mode:pick(['smelt','alloy','x']) };
      furnaceOp(st, inv, o, now);
      now += Math.floor(r() * 400_000);
    }
    advance(st.list[0], now);
    const made = tot(inv, st, 'Tainted iron'), ingots = tot(inv, st, 'Lingot de fer');
    /* chaque Tainted iron a consommé exactement 5 lingots de fer, 20 chitine, 50 charbons (et chaque lingot 10 fer + 10 charbons) */
    assert.equal(tot(inv, st, 'Chitine') + 20 * made, BAG.Chitine);
    const smelted = (BAG.Fer - tot(inv, st, 'Fer')) / 10;
    assert.equal(ingots + 5 * made, BAG['Lingot de fer'] + smelted);
    assert.equal(tot(inv, st, 'Charbon') + 50 * made + 10 * smelted, BAG.Charbon);
  }
});

test('four : débloquer avec un Four en fer — 300 suites trafiquées (rejouées, objets bidon) : jamais plus d\'un four gagné par objet consommé', () => {
  const r = mulberry32(77);
  const ITEMS_TRY = ['Four en fer', 'Four en fer', 'Four en fer BP', 'Fer', '', null, 7, { a:1 }, '__proto__'];
  for(let t = 0; t < 300; t++){
    const start = 1 + Math.floor(r() * 3);
    const inv = createInventory(); addAll(inv, { 'Four en fer':start });
    const st = createFurnaces(); const ids = [];
    for(let k = 0; k < 12; k++){
      const opId = ids.length && r() < 0.4 ? ids[Math.floor(r() * ids.length)] : `u${t}-${k}`;
      ids.push(opId);
      furnaceOp(st, inv, { action:'unlock', item:ITEMS_TRY[Math.floor(r() * ITEMS_TRY.length)], opId }, 1e6);
      assert.equal(countOf(inv, 'Four en fer') + (st.list.length - 1), start, 'objet consommé = four gagné');
      assert.ok(st.list.length <= 2, 'le 3e four reste fermé');
    }
    const back = sanitizeFurnaces(JSON.parse(JSON.stringify(st)));
    assert.equal(back.list.length, st.list.length);
  }
});

test('four, recette choisie (28/10) : quantités trafiquées refusées, rejeu sans effet, matière conservée', () => {
  const inv = createInventory(); addAll(inv, START);
  const st = createFurnaces();
  for(const count of BAD_QTY)
    assert.equal(furnaceOp(st, inv, { action:'recipe', furnace:0, out:'Lingot de fer', count, opId:'bad-' + String(count) }, 1e6).error, 'bad_qty', String(count));
  for(const out of [null, 42, 'Diamant', '__proto__', 'constructor', { out:'Lingot de fer' }])
    assert.equal(furnaceOp(st, inv, { action:'recipe', furnace:0, out, count:1, opId:'out-' + String(out) }, 1e6).error, 'bad_item');
  assert.equal(furnaceOp(st, inv, { action:'recipe', furnace:0, out:'Lingot de fer', count:1e12, opId:'huge' }, 1e6).error, 'not_enough');
  assert.equal(furnaceOp(st, inv, { action:'recipe', furnace:0, out:'Lingot de fer', count:1e15, opId:'huge2' }, 1e6).error, 'bad_qty', 'quantité qui déborde');
  assert.equal(countOf(inv, 'Fer'), START.Fer);
  for(let k = 0; k < 3; k++) furnaceOp(st, inv, { action:'recipe', furnace:0, out:'Lingot de fer', count:5, opId:'same-op' }, 1e6);
  assert.equal(st.list[0].ore.qty, 50, 'trois envois de la même demande : une seule fois');
  advance(st.list[0], 1e12);
  assert.equal(total(inv, st, 'Fer') + FURNACE.orePerIngot * total(inv, st, 'Lingot de fer'), START.Fer);
  assert.equal(total(inv, st, 'Charbon') + FURNACE.fuelPerIngot * total(inv, st, 'Lingot de fer'), START.Charbon);
});
