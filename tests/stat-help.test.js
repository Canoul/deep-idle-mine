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

/* 06/11/2026 (Jules) : sur téléphone, le détail passe sous le total (src/ui/style.css) ; il faut donc nom, total et détail séparés */
test('carte des stats : chaque ligne a son nom (statL), son total (b) et, s\'il y en a un, son détail (statD)', async () => {
  const { DEV_PRESETS } = await import('../src/config.js');
  const worn = Object.fromEntries(DEV_PRESETS.gear.map((item, i) => [['casque', 'torse', 'jambes', 'bottes', 'pioche', 'epee'][i], { item }]));
  const html = statsHTML(worn, {}), rows = minerStats(worn, {});
  assert.equal(html.match(/class="row statRow"><span class="statL">/g)?.length, rows.length + 2);
  assert.equal(html.match(/<span class="statV"><b>/g)?.length, rows.length + 2);
  const withDetail = rows.filter(s => s.bonus || s.mult !== 1 || s.skill || s.ring || (s.key === 'tenacity' && s.total > 0)).length;
  assert.ok(withDetail > 0);
  assert.equal(html.match(/class="statD"/g)?.length, withDetail, 'un détail par stat qui a un bonus, rien sinon');
  assert.match(html, /<b>337<\/b> <span class="statD"><small class="mut">\(200 /, 'pods : total puis détail');
});
