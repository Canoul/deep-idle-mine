/* Mine géante (06/11/2026) : la carte de 70 colonnes et les 2 h, comme dans le fil de la partie (DIM_MINE=geante, posé avant
   le chargement de la config : ce fichier a son propre processus). Et le vrai fil d'une partie (server/game/live.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DIM_MINE = 'geante';
const { W, SESSION_LEN, CHEST_X, SPAWN_X, WINCH, GEANTE } = await import('../src/config.js');
const { buildSession, minerSpecs } = await import('../src/shared/game.js');
const { tick, SESSION_TICKS } = await import('../src/sim/session.js');
const { createViewer, applyView } = await import('../src/shared/view.js');

const players = Array.from({ length: 5 }, (_, i) => ({ account: `ACC${i}`, name: `J${i}` }));
const rec = { id: 'g1', seed: 4242, mode: 'geante', players, prefs: {}, looks: {}, gear: {}, skills: {}, spells: {} };

test('carte : 70 colonnes, coffre et treuil au milieu, 2 h, 5 mineurs répartis', () => {
  assert.equal(W, GEANTE.w); assert.equal(SESSION_LEN, GEANTE.len); assert.equal(SESSION_TICKS, 72000);
  assert.deepEqual([SPAWN_X, CHEST_X, WINCH.x], [35, 32, 35]);
  const G = buildSession(rec);
  assert.equal(G.geante, true); assert.equal(G.w, 70); assert.equal(G.len, 7200);
  assert.ok(G.tiles.every(r => r.length === 70));
  assert.deepEqual(minerSpecs(rec).map(m => m.x), [7, 21, 35, 49, 63]);
  for(let i = 0; i < 600; i++) tick(G);
  assert.equal(G.over, false);
  /* navigateur : la vue porte la largeur, la durée et le coffre ; la carte reconstruite fait 70 colonnes */
  const v = createViewer(G)(null);
  assert.deepEqual([v.w, v.len, v.chestX], [70, 7200, 32]);
  const M = applyView({ tiles: [], ladder: [], seen: [], torches: [], miners: [], mobs: [], light: new Map() }, v, 0, 0);
  assert.equal(M.w, 70); assert.ok(M.tiles.every(r => r.length === 70));
});

test('vrai fil d\'une partie : la Mine géante y a sa carte de 70 colonnes, la mine classique garde 50', async () => {
  const { createLiveRunner } = await import('../server/game/live.js');
  delete process.env.DIM_MINE;   // le serveur lui-même n'est pas en Mine géante : seul le fil de la partie l'est
  const runner = createLiveRunner();
  try {
    for(const [mode, w] of [['geante', 70], ['mine', 50]]){
      const r = { ...rec, id: 'live-' + mode, mode, players: mode === 'mine' ? players.slice(0, 3) : players };
      runner.open(r);
      const view = await runner.view(r.id, null);
      assert.equal(view.w, w, mode); assert.ok(view.rows.tiles.every(t => t.length === w));
    }
  } finally { runner.closeAll(); }
});
