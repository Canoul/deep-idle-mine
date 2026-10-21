/* Anti-duplication des shiny : un bloc miné donne un seul objet (le minerai OU son shiny), et un shiny ne peut pas
   repasser au four (ni comme minerai, ni comme combustible, ni dans un alliage) pour être « refondu ». */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHINY, IDS } from '../../src/config.js';
import { createInventory, addAll, countOf } from '../../src/meta/inventory.js';
import { createFurnaces, furnaceOp } from '../../src/meta/furnace.js';
import { mineBlock } from '../../src/sim/actions.js';
import { worldFrom } from '../helpers.js';

const SHINIES = Object.values(SHINY.items).map(s => s.item);

test('shiny : un bloc = un objet, même quand le tirage réussit à chaque fois', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@ #', '#'.repeat(50)]), m = G.miners[0];
  G.shinyRng = () => 0;
  for(let i = 0; i < 100; i++){ G.tiles[2][2] = i % 2 ? IDS.iron : IDS.gold; mineBlock(G, m, 2, 2); }
  assert.deepEqual(m.inv, { 'Shiny gold':50, 'Shiny iron':50 });
  assert.equal(m.load, 100 * SHINY.w);
});

test('shiny : refusé dans toutes les cases du four, l\'inventaire ne bouge pas', () => {
  for(const item of SHINIES){
    const inv = createInventory(); addAll(inv, { [item]:10, 'Lingot de fer':10, Chitine:40, Charbon:100 });
    const st = createFurnaces();
    let n = 0;
    const op = o => furnaceOp(st, inv, { furnace:0, opId:`op${n++}`, ...o }, 1e6);
    assert.equal(op({ action:'load', slot:'ore',  item, qty:5 }).error, 'bad_item');
    assert.equal(op({ action:'load', slot:'fuel', item, qty:5 }).error, 'bad_item');
    assert.ok(op({ action:'mode', mode:'alloy' }).ok);
    assert.equal(op({ action:'load', slot:'a', item, qty:5 }).error, 'bad_item');
    assert.equal(op({ action:'load', slot:'b', item, qty:5 }).error, 'bad_item');
    assert.equal(countOf(inv, item), 10);
  }
});
