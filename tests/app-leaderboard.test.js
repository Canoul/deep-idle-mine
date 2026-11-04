/* Appli (04/11/2026) : Classement, podium du top 3 et sa place collée en bas (src/ui/leaderboard.js, fonctions pures).
   Spec docs/superpowers/specs/2026-11-04-appli-classement-design.md */
import test from 'node:test';
import assert from 'node:assert/strict';
import { podiumHtml, boardAppHtml } from '../src/ui/leaderboard.js';

const value = r => `${r.value} GS`;
const row = r => `<div class="frow lrow${r.me ? ' mine' : ''}">${r.rank} ${r.name}</div>`;
const R = (rank, name, more = {}) => ({ rank, name, value:6000 - rank * 100, ...more });
const count = (h, re) => (h.match(re) || []).length;

test('podium : 2ᵉ à gauche, 1ᵉʳ au centre, 3ᵉ à droite ; pseudos échappés ; marches vides s\'il manque des joueurs', () => {
  const h = podiumHtml([R(1, 'Brakk'), R(2, '<b>Ysolde</b>'), R(3, 'Mox')], value);
  assert.ok(h.indexOf('Ysolde') < h.indexOf('Brakk') && h.indexOf('Brakk') < h.indexOf('Mox'));
  assert.match(h, /&lt;b&gt;Ysolde/); assert.match(h, /5900 GS/);
  assert.equal(count(podiumHtml([R(1, 'Seul')], value), /class="lpName"/g), 1);
});

test('liste : les rangs 4 et plus en lignes, sa place collée en bas (dans le top ou hors du top)', () => {
  const rows = [R(1, 'A'), R(2, 'B'), R(3, 'C', { me:true }), R(4, 'D'), R(5, 'E')];
  const inTop = boardAppHtml({ rows, total:5, me:null }, { value, row });
  assert.equal(count(inTop, /class="frow lrow/g), 3, 'D, E, puis soi collé');
  assert.match(inTop, /class="lMe"><div class="frow lrow mine">3 C/);
  const out = boardAppHtml({ rows:rows.map(r => ({ ...r, me:false })), total:80, me:R(37, 'Toi', { me:true }) }, { value, row });
  assert.match(out, /class="lMe"><div class="frow lrow mine">37 Toi/); assert.match(out, /80 joueurs classés/);
  assert.match(boardAppHtml({ rows:[], total:0, me:null }, { value, row }), /Personne n'est encore classé ici/);
});
