/* Mine instantanée, interface (logique pure) : compte à rebours, rappels, classement, position affichée. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTANT_MINE as MI } from '../src/config.js';
import { countdownText, noticeDelay, crossedNotice } from '../src/ui/instant-lobby.js';
import { instantRanking } from '../src/ui/instant-hud.js';
import { instantPos } from '../src/render/instant.js';
import { applyInstantView, createInstantViewer } from '../src/shared/instant-view.js';
import { newInstant, tickInstant } from '../src/sim/instant/session.js';

test('MI compte à rebours : heures, minutes, secondes', () => {
  assert.equal(countdownText(2 * 3600e3 - 1), '2 h 00 min 00 s');
  assert.equal(countdownText(3600e3 + 5 * 60e3 + 12e3), '1 h 05 min 12 s');
  assert.equal(countdownText(4 * 60e3 + 3e3), '4 min 03 s');
  assert.equal(countdownText(12e3), '12 s');
  assert.equal(countdownText(-5), '0 s');
  assert.deepEqual(MI.notify.map(noticeDelay), ['30 min', '15 min', '5 min', '30 secondes']);
});

test('MI rappels : à 30, 15, 5 min et 30 s, une fois chacun ; rien au chargement de la page', () => {
  const at = 10_000_000, s = 1000;
  assert.equal(crossedNotice(null, at - 30 * 60 * s, at), null, 'première lecture : pas de rappel');
  assert.equal(crossedNotice(at - 30 * 60 * s - 500, at - 30 * 60 * s + 500, at), 30 * 60);
  assert.equal(crossedNotice(at - 30 * 60 * s + 500, at - 30 * 60 * s + 1500, at), null, 'déjà passé');
  assert.equal(crossedNotice(at - 15 * 60 * s - 1, at - 15 * 60 * s, at), 15 * 60);
  assert.equal(crossedNotice(at - 5 * 60 * s - 1, at - 5 * 60 * s, at), 5 * 60);
  assert.equal(crossedNotice(at - 30 * s - 1, at - 30 * s, at), 30);
  assert.equal(crossedNotice(at - 31 * 60 * s, at - 10 * s, at), 30, 'page en veille : le plus proche seulement');
  assert.equal(crossedNotice(at - 10 * s, at + 10 * s, at), null);
  assert.equal(MI.inviteAt, 30);
});

test('MI classement : le plus de blocs, puis le plus de plumes', () => {
  const r = instantRanking([{ name:'a', stats:{ mined:3, feathers:0 } }, { name:'b', stats:{ mined:5, feathers:0 } }, { name:'c', stats:{ mined:3, feathers:2 } }]);
  assert.deepEqual(r.map(x => x.name), ['b', 'c', 'a']);
});

test('MI affichage : la copie du navigateur = la partie ; un mineur en marche glisse entre deux cases', () => {
  const G = newInstant(3, { miners:[{ name:'A', account:'a' }, { name:'B', account:'b' }] });
  for(let i = 0; i < 200; i++) tickInstant(G);
  G.ladder[5][7] = 1; G.ladder[12][30] = 1;                             // des échelles (gravité, 22/10)
  const v = JSON.parse(JSON.stringify(createInstantViewer(G)()));      // passe par le réseau (JSON)
  const M = applyInstantView(v);
  assert.equal(M.mode, 'mi'); assert.equal(M.ticks, 200);
  assert.deepEqual(M.tiles.map(r => [...r]), G.tiles.map(r => [...r]));
  assert.deepEqual([...M.feathers], [...G.feathers]);
  assert.deepEqual(M.ladder.map(r => [...r]), G.ladder.map(r => [...r]), 'échelles');
  assert.equal(M.miners.length, 2);
  assert.ok(JSON.stringify(v).length < 8000, `envoi ${JSON.stringify(v).length} octets`);
  assert.deepEqual(instantPos({ x:2, y:3, action:{ type:'move', t:0.5, dur:1, data:{ x:3, y:3 } } }), [2.5, 3]);
  assert.deepEqual(instantPos({ x:2, y:3, action:{ type:'mine', t:0.5, dur:1, data:{ x:2, y:4 } } }), [2, 3]);
});
