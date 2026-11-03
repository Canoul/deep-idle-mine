/* Appli (03/11/2026) : l'Historique, une ligne par session et le bilan en panneau du bas (src/ui/history.js, fonctions pures).
   Spec docs/superpowers/specs/2026-11-03-appli-historique-design.md */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dayLabel, topLoot, sessionRowHtml, sessionDetailHtml, historyListHtml } from '../src/ui/history.js';

const NOW = new Date(2026, 10, 3, 22, 0).getTime();
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
const prison = { id:'p', mode:'prison', seed:482231403, startedAt:at(3, 20, 12), endedAt:at(3, 23, 36), players:['L9DJULO'], areas:null, depth:null,
  left:false, xp:5589, bag:{ Pierre:2756, Fer:683, Diamant:8, 'Treasure T1':3 }, prison:{ runs:39, energy:53, area:6, t:24420 } };
const mine = { id:'m', mode:'mine', seed:1779542187, startedAt:at(2, 20, 0), endedAt:at(2, 20, 3), players:['L9DJULO', '<b>Brakk</b>', 'Ysolde'],
  areas:4, depth:212, left:false, xp:1240, bag:{ Charbon:65, Fer:41 } };

test('jours : aujourd\'hui, hier, puis la date', () => {
  assert.equal(dayLabel(at(3, 9), NOW), 'AUJOURD\'HUI');
  assert.equal(dayLabel(at(2, 23), NOW), 'HIER');
  assert.equal(dayLabel(new Date(2026, 9, 30, 12).getTime(), NOW), '30/10');
});

test('plus gros butins : trésors, puis minerais par valeur, le terrain en dernier', () => {
  assert.deepEqual(topLoot(prison.bag).map(([k]) => k), ['Treasure T1', 'Diamant', 'Fer']);
});

test('ligne : type, heure, avec qui (sans soi, échappé), area de la prison, XP courte', () => {
  const p = sessionRowHtml(prison, 0, 'L9DJULO');
  assert.match(p, /data-hi="0"/); assert.match(p, /Prison/); assert.match(p, /20:12/); assert.match(p, /area 6/); assert.match(p, /\+5,5k XP/); assert.match(p, /solo/);
  const m = sessionRowHtml(mine, 1, 'L9DJULO');
  assert.match(m, /Mine/); assert.match(m, /avec &lt;b&gt;Brakk&lt;\/b&gt;, Ysolde/); assert.doesNotMatch(m, /avec L9DJULO/);
  assert.match(sessionRowHtml({ ...mine, mode:'ancien_mode' }, 2), /Session/, 'mode inconnu');
  assert.match(sessionRowHtml({ ...mine, left:true }, 3), /Parti avant la fin/);
});

test('bilan : tout le butin, la prison, la seed en petit ; parti avant la fin / rien rapporté', () => {
  const d = sessionDetailHtml(prison);
  assert.match(d, /data-act="close"/); assert.match(d, /39 runs/); assert.match(d, /482231403/);
  assert.equal((d.match(/class="hiIt"/g) || []).length, 4, 'les 4 butins');
  assert.match(sessionDetailHtml({ ...mine, left:true }), /Parti avant la fin : rien reçu/);
  assert.match(sessionDetailHtml({ ...mine, bag:{} }), /Rien rapporté/);
});

test('liste : intertitres par jour ; vide → bouton vers l\'Accueil', () => {
  const h = historyListHtml([prison, mine], NOW, 'L9DJULO');
  assert.ok(h.indexOf('AUJOURD\'HUI') < h.indexOf('HIER'));
  assert.equal((h.match(/class="hiRow"/g) || []).length, 2);
  const empty = historyListHtml([], NOW);
  assert.match(empty, /Aucune session terminée/); assert.match(empty, /href="#lobby"[^>]*>Lancer une session/);
});
