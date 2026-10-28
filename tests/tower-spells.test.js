/* Sorts dans les tours du Jugement (28/10/2026, Geoffrey) : les sorts équipés (figés au lancement) partent comme dans la
   mine et l'instance. Dynamite (rework du 28/10) : blocs moins durs que 3 × sa vitesse de minage (dureté du niveau de
   tour comprise), jamais le toit ; 50 % de ses dégâts aux mobs et au boss du rayon. Zipette : pas d'oxygène, jamais. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWER, BLOCKS } from '../src/config.js';
import { newTower, runTower, tickTower, decide, blockCells } from '../src/sim/tower/session.js';
import { buildTower } from '../src/shared/tower.js';

const M = (name, carac, tree, spells) => ({ name, account: name, carac, skillTree: tree, skills: {}, spells });
const team = () => [M('Min', { mineSpeed: 1.6, damage: 14 }, 'mineur', ['dynamite', 'fast_learner']),
                    M('Barb', { mineSpeed: 1.3, damage: 18 }, 'barbare', ['dash', 'war_cry']),
                    M('Logi', { mineSpeed: 1.3, damage: 14 }, 'logisticien', ['inspiration', 'zipette'])];
const logs = (G, re) => G.log.filter(l => re.test(l.msg));

test('les sorts du lancement arrivent dans la tour (enregistrement du serveur)', () => {
  const rec = { seed: 3, mode: 'tower_angel', players: [{ account: 'A', name: 'A' }], prefs: {}, gear: {}, skills: {},
                spells: { A: ['fast_learner', 'cleave'] } };
  const G = buildTower(rec);
  assert.deepEqual(G.miners[0].spells, ['fast_learner', 'cleave']);
});

test('une tour avec des sorts : chacun lance les siens, la zipette jamais ; même seed = même partie', () => {
  const G = runTower(101, { side: 'angel', miners: team() });
  const by = n => G.miners.find(m => m.name === n) ?? null;
  assert.ok(logs(G, /🧨/).length > 0, 'dynamite'); assert.ok(logs(G, /🎺/).length > 0, 'inspiration'); assert.ok(logs(G, /📯/).length > 0, 'cri de guerre');
  assert.ok(!(by('Logi')?.spellCd.zipette > 0), 'zipette : jamais lancée');
  assert.equal(G.stats.blocked, 0);
  const H = runTower(101, { side: 'angel', miners: team() });
  assert.equal(H.t, G.t); assert.equal(H.boss.hp, G.boss.hp); assert.deepEqual(H.log.map(l => l.msg), G.log.map(l => l.msg));
});

/* un mineur dans une poche creusée au milieu d'un étage « blocs » (sol de l'étage dessous : il tient), des briques autour */
function pocket(G){
  const k = G.kinds.findIndex(x => x === 'blocks'), cells = blockCells(G, k);
  const ys = cells.map(c => c[1]), bottom = Math.max(...ys), mid = Math.round((G.x0 + G.x1) / 2);
  G.tiles[bottom][mid] = 0; G.blocksLeft[k]--; G.bricks--;
  return { k, x: mid, y: bottom };
}

test('Dynamite (28/10) : casse les stonebricks seulement si dureté (× niveau) < 3 × sa vitesse de minage', () => {
  const hard = BLOCKS[TOWER.sides.angel.brick].hard;
  for(const [speed, level, want] of [[hard / 3 + 0.01, 1, true], [hard / 3 - 0.01, 1, false], [hard / 3 + 0.01, 2, false]]){
    const G = newTower(7, { side: 'angel', level, miners: [M('Min', { mineSpeed: speed }, 'mineur', ['dynamite'])] });
    for(let k = 0; k < TOWER.floors; k++) G.floorSeen[k] = true;
    const p = pocket(G);
    const m = G.miners[0]; Object.assign(m, { x: p.x, y: p.y, action: null }); G.mobs.forEach(o => { o.hp = 0; });
    for(let k = 0; k < p.k; k++) G.blocksLeft[k] = 0;
    decide(G, m);
    for(let i = 0; i < 100 && !['mine', 'dynamite'].includes(m.action?.type); i++) tickTower(G);   // d'abord une torche (noir)
    assert.equal(m.action?.type, want ? 'dynamite' : 'mine', `vitesse ${speed.toFixed(2)}, niveau ${level}`);
    if(want){
      const before = G.stats.mined;
      for(let i = 0; i < 20 && m.action?.type === 'dynamite'; i++) tickTower(G);
      assert.ok(G.stats.mined - before >= 2, 'au moins 2 briques');
      assert.ok(G.tiles[G.roof].every((t, x) => x <= G.x0 || x >= G.x1 || t !== 0), 'le toit reste');
    }
  }
});

test('un mob étourdi ne tacle pas et ne bouge pas', () => {
  const G = newTower(9, { side: 'demon', miners: [M('A', {}, null, [])] });
  const o = G.mobs[0], m = G.miners[0];
  Object.assign(o, { awake: true, stunUntil: 5 }); Object.assign(m, { x: o.x + 1, y: o.y, action: { type: 'wait', dur: 1e9, t: 0, data: {} } });
  const x0 = o.x;
  for(let i = 0; i < 20; i++) tickTower(G);
  assert.equal(o.grab, null); assert.equal(o.x, x0);
});
