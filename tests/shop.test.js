/* Boutique (05/11/2026) : l'article, le Coffre affilié (contenu fixe, s'ouvre), l'onglet. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP, ITEMS, LOOT } from '../src/config.js';
import { mulberry32 } from '../src/core/rng.js';
import { createInventory, addAll, countOf } from '../src/meta/inventory.js';
import { buy, affordable, shopItem } from '../src/meta/shop.js';
import { openTreasure, canOpen } from '../src/meta/loot.js';

test('Coffre affilié : 20 émeraudes, s\'ouvre et donne toujours le même contenu', () => {
  assert.equal(SHOP.currency, 'Émeraude');
  assert.deepEqual(shopItem('affilie'), { id: 'affilie', item: 'Coffre affilié', price: 20 });
  assert.ok(ITEMS['Coffre affilié'] && canOpen('Coffre affilié'));
  const inv = createInventory(); addAll(inv, { 'Émeraude': 45 });
  assert.equal(affordable(inv, shopItem('affilie')), 2);
  assert.ok(buy(inv, { id: 'affilie', opId: 'a1' }).ok);
  const r = openTreasure(inv, 'Coffre affilié', 'o1', mulberry32(3));
  assert.deepEqual(r.loot, { 'Plume d\'ange': 50, 'Cristal de pleine lune': 50, 'Poudre de rêve': 200, 'Charbon': 10000, 'Barre d\'argent': 5 });
  assert.deepEqual([countOf(inv, 'Émeraude'), countOf(inv, 'Coffre affilié'), countOf(inv, 'Charbon')], [25, 0, 10000]);
  for(const k of Object.keys(LOOT['Coffre affilié'].always.reduce((o, a) => (o[a.item] = 1, o), {}))) assert.ok(ITEMS[k], k);
});

test('onglet : article, prix, contenu, bouton grisé sans assez d\'émeraudes', async () => {
  const { shopHtml, contentsOf } = await import('../src/ui/shop.js');
  assert.equal(contentsOf('Coffre affilié').length, 5);
  const poor = shopHtml({ slots: [{ item: 'Émeraude', qty: 3 }] });
  assert.match(poor, /Tes émeraudes : <b>3<\/b>/); assert.match(poor, /disabled>Il te manque 17 émeraudes/); assert.match(poor, /10 000|10 000/);
  const rich = shopHtml({ slots: [{ item: 'Émeraude', qty: 20 }] });
  assert.match(rich, /data-id="affilie">Acheter/);
  const { TABS } = await import('../src/ui/nav.js'), { familyOf } = await import('../src/app/families.js');
  assert.ok(TABS.some(t => t.id === 'boutique' && t.ready)); assert.equal(familyOf('boutique'), 'sac');
});
