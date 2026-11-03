/* Appli (03/11/2026) : Skills, onglets de classe et fiche d'un skill (src/ui/skills.js, fonctions pures).
   Spec docs/superpowers/specs/2026-11-03-appli-skills-design.md */
import test from 'node:test';
import assert from 'node:assert/strict';
import { skillTabsHtml, skillSheetHtml } from '../src/ui/skills.js';
import { nodeText } from '../src/meta/skills.js';
import { glyphOf } from '../src/meta/glyphs.js';

const st = { tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:2 }, points:20, spent:6, glyphs:{} };
const count = (h, re) => (h.match(re) || []).length;

test('onglets de classe : les 3 arbres, celui ouvert marqué, « ★ ta classe » et le niveau de spécialisation', () => {
  const h = skillTabsHtml('mineur', { chosen:'mineur', spec:{ mineur:{ level:72 } } });
  assert.equal(count(h, /data-sktab=/g), 3);
  assert.match(h, /data-sktab="mineur" class="on"/);
  assert.equal(count(h, /★ ta classe/g), 1); assert.match(h, /SP 72/);
  assert.doesNotMatch(skillTabsHtml('mineur'), /ta classe/, 'aucune classe choisie');
});

test('fiche : effet maintenant et au rang suivant, bouton Apprendre (grisé pendant une demande)', () => {
  const h = skillSheetHtml(st, 'ore_rush');
  assert.match(h, /Ruée/); assert.match(h, /rang 2 \/ 5/);
  assert.ok(h.includes(nodeText('ore_rush', 2))); assert.ok(h.includes(nodeText('ore_rush', 3)));
  assert.match(h, /data-learn="ore_rush"/); assert.match(h, /data-act="close"/);
  assert.match(skillSheetHtml(st, 'ore_rush', { busy:true }), /data-learn="ore_rush" disabled/);
});

test('fiche : rang max, autre arbre, plus de points → pas de bouton, la raison en clair', () => {
  const max = skillSheetHtml(st, 'mine_speed');
  assert.doesNotMatch(max, /Au rang suivant/); assert.doesNotMatch(max, /data-learn/); assert.match(max, /Rang max/);
  const other = skillSheetHtml(st, 'travel_rush');
  assert.doesNotMatch(other, /data-learn/); assert.match(other, /Autre arbre choisi/);
  assert.match(skillSheetHtml({ ...st, points:6 }, 'ore_rush'), /Plus de points/);
});

test('fiche : glyphe posable hors session, pas pendant une session', () => {
  const g = glyphOf('ore_rush'); assert.ok(g, 'Ruée a un glyphe');
  const full = { ...st, ranks:{ ...st.ranks, ore_rush:5 } }, inv = { slots:[{ item:g, qty:1 }] };
  assert.match(skillSheetHtml(full, 'ore_rush', { inv }), /data-gact="glyph_pose"/);
  assert.doesNotMatch(skillSheetHtml(full, 'ore_rush', { inv, session:true }), /data-gact=/);
  assert.match(skillSheetHtml(full, 'ore_rush', { inv, session:true }), /après la session/, 'pas de « Clic : » sans bouton');
  assert.doesNotMatch(skillSheetHtml(full, 'ore_rush', { inv }), /Clic/);
});
