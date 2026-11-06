/* Qui pose l'échelle (06/11/2026, Geoffrey) : le plus rapide (Échelle de 2) la pose, même s'il arrive après ; règle commune
   à tous les modes (src/sim/ladder.js) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladderTurn, betterLadder, ladderCellTime } from '../src/sim/ladder.js';
import { CFG } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { stepDir } from '../src/sim/actions.js';
import { AREA_Y0 } from '../src/config.js';
import './helpers.js';

const M = (id, o = {}) => ({ id, name: 'M' + id, x: 5, y: 10, skill: o.skill || {}, action: o.action || null });
const placing = () => ({ type: 'ladder', t: 0, dur: 2, data: {} });

test('le logisticien (Échelle de 2) prend la main sur un mineur qui posait déjà', () => {
  const a = M(0, { action: placing() }), log = M(1, { skill: { tall_ladder: 1 } });
  const G = { miners: [a, log] };
  assert.ok(betterLadder(log, a)); assert.equal(ladderCellTime(log), CFG.ladderTime / 2);
  assert.equal(ladderTurn(G, log), 'go');
  assert.equal(a.action, null, 'le premier poseur s\'arrête'); assert.match(a.status, /Laisse M1/);
});

test('à vitesse égale, le premier garde la main ; moins rapide : on attend', () => {
  const a = M(0, { action: placing() }), b = M(1);
  assert.equal(ladderTurn({ miners: [a, b] }, b), 'wait'); assert.ok(a.action);
  const log = M(2, { skill: { tall_ladder: 1 }, action: placing() }), c = M(3);
  assert.equal(ladderTurn({ miners: [log, c] }, c), 'wait'); assert.ok(log.action);
  const far = M(4, { action: placing() }); far.x = 9;
  assert.equal(ladderTurn({ miners: [far, b] }, b), 'go', 'une autre case : chacun la sienne'); assert.ok(far.action);
});

test('mine : deux mineurs sur la même case à monter, le logisticien pose, l\'autre attend', () => {
  const G = newSession(3, { miners: [{ name: 'A' }, { name: 'L', skillTree: 'logisticien', skills: { tall_ladder: 1 } }] });
  const y = AREA_Y0 + 5, x = 12;
  for(const yy of [y, y - 1]) G.tiles[yy][x] = 0;
  const [a, l] = G.miners;
  for(const m of G.miners){ m.x = x; m.y = y; m.action = null; }
  l.skill.tall_ladder = 1;
  assert.ok(stepDir(G, a, 0, -1)); assert.equal(a.action.type, 'ladder');
  assert.ok(stepDir(G, l, 0, -1)); assert.equal(l.action.type, 'ladder');
  assert.equal(a.action, null, 'le mineur lâche la pose');
  assert.ok(stepDir(G, a, 0, -1)); assert.equal(a.action.type, 'wait');
});
