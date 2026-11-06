/* Bulles d'aide des stats (05/11/2026, Geoffrey) : chaque stat de la carte « Stats du mineur » (onglet Stuff) a sa bulle « ? »,
   avec le même texte que le wiki (une seule liste, src/meta/stat-help.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAT_HELP } from '../src/meta/stat-help.js';
import { minerStats } from '../src/meta/stuff.js';
import { statsHTML } from '../src/ui/stuff.js';
import { statRows } from '../src/wiki/data.js';

test('chaque stat affichée a une explication', () => {
  const keys = minerStats({}, {}).map(s => s.key);
  assert.ok(keys.length > 20);
  for(const k of keys) assert.ok(STAT_HELP[k]?.length > 10, k);
});

test('carte des stats : la bulle est sur le nom de chaque stat (souris dessus, doigt maintenu), plus le gear score et le DPS ; plus de bouton « ? »', () => {
  const html = statsHTML({}, {}), rows = minerStats({}, {});
  const tips = html.match(/class="statName"[^>]*data-tiphold="1"/g) ?? [];
  assert.equal(tips.length, rows.length + 2);
  assert.ok(!html.includes('class="qhelp"'), 'plus de bouton « ? » (05/11)');
  assert.ok(html.includes('data-tipkind="help"'));
  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  assert.ok(html.includes(esc(STAT_HELP.tenacity).slice(0, 40)), 'texte de la ténacité');
});

test('le wiki lit les mêmes textes', () => {
  const r = statRows().find(s => s.key === 'pods');
  assert.equal(r.help, STAT_HELP.pods);
});
