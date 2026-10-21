/* Skills : règles des arbres (points, étape précédente au max, un seul arbre, reset), relecture, effets en partie. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, STATS, CFG, IDS } from '../src/config.js';
import { createSkills, skillOp, sanitizeSkills, skillEffects, blockedReason, spentPoints, nodeText } from '../src/meta/skills.js';
import { buildSession } from '../src/shared/game.js';
import { worldFrom, run } from './helpers.js';
import { moveT } from '../src/sim/miner.js';
import { stepDir, finishAction, killMob } from '../src/sim/actions.js';
import { tackler } from '../src/sim/ai.js';
import { updateMobs } from '../src/sim/mobs.js';
import { mulberry32 } from '../src/core/rng.js';

let n = 0; const id = () => 'op-sk-' + (++n);
const learnAll = (st, nodes, points = 99) => { for(const x of nodes) assert.ok(skillOp(st, { action:'learn', node:x, opId:id() }, points).ok, x); return st; };
const fullTree = tree => SKILLS.trees.find(t => t.id === tree).nodes.flatMap(n => Array(n.max).fill(n.id));

test('arbres demandés : 3 étages (3 / 1 / 5 rangs) ; Logisticien : Échelle de 2 et Treuil côte à côte au 2e étage', () => {
  assert.deepEqual(SKILLS.trees.map(t => t.label), ['Mineur', 'Logisticien', 'Barbare']);
  for(const t of SKILLS.trees) for(const r of [1, 2, 3]) assert.ok(t.nodes.some(n => n.row === r), `${t.id} étage ${r}`);
  for(const t of SKILLS.trees) assert.deepEqual(t.nodes.map(n => n.max), t.id === 'logisticien' ? [3, 1, 1, 5] : [3, 1, 5]);
  const lg = SKILLS.trees.find(t => t.id === 'logisticien').nodes;
  assert.deepEqual(lg.map(n => [n.id, n.row]), [['build_time', 1], ['tall_ladder', 2], ['winch', 2], ['travel_rush', 3]]);
  for(const t of SKILLS.trees) for(const n of t.nodes) assert.ok(n.name && n.icon, n.id);
  assert.equal(nodeText('mine_speed', 3), 'Vitesse de minage +6 %');
  assert.equal(nodeText('ore_rush', 0).startsWith('Vitesse de marche +3 %'), true);
});

test('règles : points du niveau, étape précédente au rang max, un seul arbre, reset', () => {
  const st = createSkills();
  assert.equal(skillOp(st, { action:'learn', node:'ore_oxygen', opId:id() }, 9).error, 'needs_previous');
  learnAll(st, ['mine_speed', 'mine_speed'], 9);
  assert.equal(skillOp(st, { action:'learn', node:'ore_oxygen', opId:id() }, 9).error, 'needs_previous', 'mine_speed pas encore au max');
  learnAll(st, ['mine_speed', 'ore_oxygen'], 9);
  assert.equal(st.tree, 'mineur');
  assert.equal(skillOp(st, { action:'learn', node:'damage', opId:id() }, 9).error, 'other_tree');
  assert.equal(skillOp(st, { action:'learn', node:'ore_oxygen', opId:id() }, 9).error, 'maxed');
  assert.equal(skillOp(st, { action:'learn', node:'ore_rush', opId:id() }, 4).error, 'no_points', '4 points déjà dépensés');
  assert.ok(skillOp(st, { action:'reset', opId:id() }, 9).ok);
  assert.deepEqual([st.tree, spentPoints(st)], [null, 0]);
  assert.ok(skillOp(st, { action:'learn', node:'damage', opId:id() }, 9).ok, 'après reset, un autre arbre est libre');
  assert.equal(skillOp(st, { action:'learn', node:'x', opId:id() }, 9).error, 'unknown');
  assert.equal(skillOp(st, { action:'pirater', opId:id() }, 9).error, 'bad_request');
});

test('étage à deux cases : chacune exige l\'étage 1 au max ; une seule des deux suffit pour l\'étage 3 ; on peut prendre les deux', () => {
  const st = createSkills();
  assert.equal(skillOp(st, { action:'learn', node:'winch', opId:id() }, 9).error, 'needs_previous');
  learnAll(st, ['build_time', 'build_time', 'build_time']);
  assert.equal(blockedReason(st, 'tall_ladder', 9), null);
  assert.equal(blockedReason(st, 'winch', 9), null);
  assert.equal(blockedReason(st, 'travel_rush', 9), 'needs_previous', 'aucune case de l\'étage 2');
  learnAll(st, ['winch']);
  assert.equal(blockedReason(st, 'travel_rush', 9), null, 'le Treuil seul ouvre l\'étage 3');
  learnAll(st, ['travel_rush', 'tall_ladder']);
  assert.deepEqual(st.ranks, { build_time:3, winch:1, travel_rush:1, tall_ladder:1 });
  const eff = skillEffects(st);
  assert.deepEqual([eff.winch, eff.tall_ladder], [1, 1]);
  const other = learnAll(createSkills(), ['build_time', 'build_time', 'build_time', 'tall_ladder', 'travel_rush']);
  assert.deepEqual([skillEffects(other).tall_ladder, skillEffects(other).winch], [1, 0], 'Échelle de 2 sans Treuil');
});

test('relecture : deux cases du même étage, ou une seule ; ancienne sauvegarde (Échelle de 2 = ancien combo) gardée', () => {
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ build_time:3, tall_ladder:1, winch:1, travel_rush:5 } }, 99).ranks,
    { build_time:3, tall_ladder:1, winch:1, travel_rush:5 });
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ build_time:3, winch:1, travel_rush:2 } }, 99).ranks, { build_time:3, winch:1, travel_rush:2 });
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ build_time:3, travel_rush:2 } }, 99).ranks, { build_time:3 }, 'étage 3 sans étage 2');
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ build_time:2, winch:1 } }, 99).ranks, { build_time:2 });
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ build_time:3, tall_ladder:1, travel_rush:5 } }, 9).ranks, { build_time:3, tall_ladder:1, travel_rush:5 });
});

test('demande rejouée (double clic) : un seul rang', () => {
  const st = createSkills(), o = id();
  skillOp(st, { action:'learn', node:'damage', opId:o }, 5);
  assert.ok(skillOp(st, { action:'learn', node:'damage', opId:o }, 5).repeated);
  assert.equal(st.ranks.damage, 1);
});

test('relecture : rangs trafiqués ignorés (plus que le max, sans l\'étape précédente, autre arbre, plus de points)', () => {
  assert.deepEqual(sanitizeSkills({ tree:'barbare', ranks:{ damage:99, taunt:1, loot:2 } }, 99).ranks, { damage:3, taunt:1, loot:2 });
  assert.deepEqual(sanitizeSkills({ tree:'barbare', ranks:{ damage:2, taunt:1 } }, 99).ranks, { damage:2 }, 'taunt sans damage au max');
  assert.deepEqual(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, mine_speed:3 } }, 99).ranks, { damage:3 }, 'pas d\'autre arbre');
  assert.deepEqual(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:5 } }, 2).ranks, { mine_speed:2 }, 'pas plus que les points');
  assert.deepEqual(sanitizeSkills({ tree:'hacker', ranks:{ damage:3 } }, 99).ranks, {});
  assert.deepEqual(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:1.5 } }, 99), createSkills());
  assert.deepEqual(sanitizeSkills(null), createSkills());
});

/* ---------- effets en partie ---------- */

const rec = skills => ({ id:'S', seed:4242, players:[{ account:'A', name:'Ana' }, { account:'B', name:'Bob' }], skills });

test('en session : minage +2 % et dégâts +5 % par rang, figés depuis l\'enregistrement', () => {
  const G = buildSession(rec({ A:{ tree:'mineur', ranks:{ mine_speed:3 } }, B:{ tree:'barbare', ranks:{ damage:3 } } }));
  const [a, b] = G.miners;
  assert.ok(Math.abs(a.carac.mineSpeed - STATS.mineSpeed * 1.06) < 1e-9);
  assert.ok(Math.abs(b.carac.damage - STATS.damage * 1.15) < 1e-9);
  assert.equal(a.carac.damage, STATS.damage); assert.equal(b.carac.mineSpeed, STATS.mineSpeed);
  assert.equal(a.skillTree, 'mineur'); assert.equal(b.skillTree, 'barbare');
});

test('Mineur : un minerai rend 1 d\'oxygène (tout court) et donne +3 %/rang de marche pendant 3 s (pas de cumul)', () => {
  const G = worldFrom(['', '##########', '@c########']), m = G.miners[0];
  m.skill.ore_oxygen = skillEffects(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1 } })).ore_oxygen; m.skill.ore_rush = 0.15;
  m.ox = 100;
  const t0 = moveT(G, m);
  finishAction(G, m, { type:'mine', data:{ x:1, y:2 } });
  assert.equal(m.ox, 101, '+1 d\'oxygène, quel que soit l\'oxygène max');
  assert.equal(nodeText('ore_oxygen', 1), 'Miner un minerai rend 1 d\'oxygène');
  assert.ok(Math.abs(moveT(G, m) - t0 / 1.15) < 1e-9);
  G.t += SKILLS.rushTime + 0.01;
  assert.equal(moveT(G, m), t0, 'bonus fini après 3 s');
});

test('Logisticien : constructions −5 %/rang, échelle de 2 de haut, marche +3 %/rang au retour et en redescente', () => {
  const G = worldFrom(['', '##### ####', '##### ####', '#####@####']), m = G.miners[0];
  m.skill.build_time = 0.15; m.skill.tall_ladder = 1; m.skill.travel_rush = 0.15;
  m.mode = 'return';
  assert.ok(stepDir(G, m, 0, -1));
  assert.ok(Math.abs(m.action.dur - CFG.ladderTime * 0.85) < 1e-9);
  finishAction(G, m, m.action);
  assert.deepEqual([G.ladder[3][5], G.ladder[2][5]], [1, 1], 'deux cases d\'échelle');
  const back = moveT(G, m); m.mode = 'work'; const work = moveT(G, m);
  assert.ok(Math.abs(back - work / 1.15) < 1e-9);
  m.goingDown = true; assert.equal(moveT(G, m), back, 'redescente par l\'existant aussi');
});

test('Barbare : provocation, le mob lâche l\'autre mineur et ne peut plus tacler que le barbare', () => {
  const G = worldFrom(['', '   @@   '], { miners:2 }), [a, b] = G.miners;
  a.x = 3; b.x = 4; a.y = b.y = 1;
  a.skill.taunt = 1; b.prefs.fightMobs = false;
  const bug = { id:7, type:'bestiole', x:4, y:1, hp:1e9, maxhp:1e9, cd:5, grab:b.id };
  G.mobs.push(bug);
  assert.equal(tackler(G, b), bug, 'Bob est taclé');
  finishAction(G, a, { type:'attack', data:{ mob:bug } });
  assert.equal(bug.taunt, a.id);
  updateMobs(G);
  assert.equal(tackler(G, b), null, 'Bob est libéré : il repart travailler');
  assert.equal(tackler(G, a), bug, 'il ne peut tacler que le barbare (à 1 case de lui)');
  run(G, 30);
  assert.ok(!/Taclé/.test(b.status), `Bob : ${b.status}`);
});

test('Barbare : butin des mobs +3 %/rang (en moyenne)', () => {
  const G = worldFrom(['', '@']), m = G.miners[0];
  G.rng = mulberry32(5);
  const killAll = k => { m.inv = {}; m.load = 0; for(let i = 0; i < 2000; i++){ const o = { id:i, type:'bestiole', x:0, y:1, hp:1, maxhp:1 }; G.mobs.push(o); killMob(G, m, o); } return m.inv.Chitine; };
  const base = killAll(0);
  m.skill.loot = 0.15;
  const more = killAll(0);
  assert.ok(more / base > 1.10 && more / base < 1.20, `rapport ${more / base}`);
});

test('échelles au retour : on laisse le logisticien les poser (au plus 4 s), puis on la pose soi-même', () => {
  const rows = ['', ...Array(6).fill('##### ####')];
  const G = worldFrom(rows, { miners:2 }), [a, l] = G.miners;
  for(let y = 1; y <= 6; y++) G.tiles[y][5] = 0;
  for(let y = 4; y <= 6; y++) G.ladder[y][5] = 1;         // échelle déjà posée en bas
  G.tiles[6][5] = IDS.stone;
  a.x = l.x = 5; a.y = 4; l.y = 5;
  a.mode = l.mode = 'return'; a.reason = l.reason = 'test';
  l.skillTree = 'logisticien';
  l.action = { type:'wait', dur:1e9, t:0, data:{} };     // le logisticien est occupé : Ana ne l'attendra pas plus de 4 s
  G.ladder[4][5] = 0;
  run(G, 2);
  assert.equal(a.status, 'Laisse le logisticien poser l\'échelle');
  run(G, Math.round(SKILLS.ladderYieldMax / 0.1) + 30);
  assert.ok(G.ladder[4][5] || a.y < 4, 'après l\'attente, elle pose l\'échelle elle-même');
});
test('onglet Stuff : les stats montrent aussi les bonus des skills, comme en session', async () => {
  const { minerStats } = await import('../src/meta/stuff.js');
  const { skillEffects, sanitizeSkills } = await import('../src/meta/skills.js');
  const { buildSession } = await import('../src/shared/game.js');
  const skills = { tree:'mineur', ranks:{ mine_speed:3 } };
  const worn = { pioche:{ item:'Pioche en pierre', uid:1 } };
  const row = minerStats(worn, skillEffects(sanitizeSkills(skills))).find(s => s.key === 'mineSpeed');
  assert.deepEqual([row.base, row.bonus, row.mult, row.total], [1, 0.2, 1.06, 1.27]);   // (1 + 0,2) × 1,06 = 1,272 : multiplicateur, pas +0,06
  const iron = minerStats({ pioche:{ item:'Pioche en fer', uid:2 } }, skillEffects(sanitizeSkills(skills))).find(s => s.key === 'mineSpeed');
  assert.equal(iron.total, 1.48, '(1 + 0,4) × 1,06 = 1,484');
  const G = buildSession({ id:'S', seed:1, players:[{ account:'A', name:'Ana' }], looks:{ A:{ pioche:'Pioche en pierre' } }, skills:{ A:skills } });
  assert.equal(Math.round(G.miners[0].carac.mineSpeed * 100) / 100, row.total, 'même valeur qu\'en session');
  assert.equal(minerStats(worn).find(s => s.key === 'mineSpeed').skill, 0, 'sans skills : rien');
});
