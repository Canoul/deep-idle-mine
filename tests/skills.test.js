/* Skills : règles des arbres (points, étape précédente au max, un seul arbre, reset), relecture, effets en partie. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, STATS, CFG, IDS } from '../src/config.js';
import { createSkills, skillOp, sanitizeSkills, skillEffects, blockedReason, spentPoints, nodeText, slotMastery, behaviourSkills, NODES, pointsByTree, migrateSkills, skillRanks, SKILLS_VERSION } from '../src/meta/skills.js';
import { equippedStats, minerStats } from '../src/meta/stuff.js';
import { gearScore } from '../src/meta/gearscore.js';
import { buildSession } from '../src/shared/game.js';
import { worldFrom, run } from './helpers.js';
import { moveT, climbT, winchT } from '../src/sim/mineur.js';
import { stepDir, finishAction, killMob } from '../src/sim/actions.js';
import { tackler } from '../src/sim/ai.js';
import { updateMobs } from '../src/sim/mobs.js';
import { mulberry32 } from '../src/core/rng.js';

let n = 0; const id = () => 'op-sk-' + (++n);
/* arbres v2 (04/11) : sans spé, la spé est l'arbre du premier skill appris */
const learnAll = (st, nodes, points = 99) => { for(const x of nodes){ if(!st.tree) skillOp(st, { action:'spec', tree:NODES[x].tree, opId:id() }, points);
  const r = skillOp(st, { action:'learn', node:x, opId:id() }, points); assert.ok(r.ok, x + ' : ' + r.error); } return st; };
const fullTree = tree => SKILLS.trees.find(t => t.id === tree).nodes.flatMap(n => Array(n.max).fill(n.id));

test('arbres v3 (04/11/2026) : 5 étages, une 3e colonne, points max et « | » (needs) comme l\'arbre de Geoffrey', () => {
  assert.deepEqual(SKILLS.trees.map(t => t.label), ['Mineur', 'Logisticien', 'Barbare']);
  const shape = t => t.nodes.map(n => [n.id, n.row, n.col, n.max]);
  const T = id => SKILLS.trees.find(t => t.id === id);
  assert.deepEqual(shape(T('mineur')), [['mine_speed', 1, 0, 3], ['enchanted_pick', 1, 1, 3], ['ore_oxygen', 2, 0, 1], ['filou', 2, 1, 3],
    ['all_terrain', 2, 2, 3], ['lazy_legend', 3, 0, 1], ['ore_rush', 3, 1, 3], ['ore_drunk', 4, 0, 1], ['rested', 4, 1, 3],
    ['pick_mastery', 5, 0, 3], ['aura_efficiency', 5, 1, 1]]);
  assert.deepEqual(shape(T('logisticien')), [['travel_rush', 1, 0, 3], ['organized', 1, 1, 3], ['winch', 2, 0, 1], ['tall_ladder', 2, 1, 1],
    ['ambidextrous', 2, 2, 3], ['winch_speed', 3, 0, 3], ['grounded', 3, 1, 3], ['demat', 3, 2, 3], ['mule', 4, 0, 1], ['bench_mastery', 4, 1, 3],
    ['aura_reassure', 5, 0, 1], ['recon', 5, 1, 1]]);
  assert.deepEqual(shape(T('barbare')), [['damage', 1, 0, 3], ['loot', 1, 1, 3], ['taunt', 2, 0, 1], ['backstab', 2, 1, 3],
    ['steady', 3, 0, 1], ['crushing', 3, 1, 3], ['braum', 4, 0, 3], ['ravage', 4, 1, 1], ['sword_mastery', 5, 0, 3], ['aura_berserk', 5, 1, 1]]);
  const needs = Object.fromEntries(SKILLS.trees.flatMap(t => t.nodes.filter(n => n.needs).map(n => [n.id, n.needs])));
  assert.deepEqual(needs, { aura_efficiency:'rested', winch_speed:'winch', mule:'winch_speed', aura_reassure:'mule', steady:'taunt', ravage:'crushing', aura_berserk:'ravage' });
  assert.deepEqual(SKILLS.trees.map(t => t.nodes.reduce((s, n) => s + n.max, 0)), [25, 26, 22]);   // Escalateur max 3, Ambidextre 3 (04/11)
  assert.equal(nodeText('ambidextrous', 3), 'Double attaque +6 %');
  for(const t of SKILLS.trees) for(const n of t.nodes){ assert.ok(n.name && n.icon, n.id); assert.equal(!!n.specOnly, n.max === 1, n.id + ' : skill de classe = 1 point'); }
  assert.equal(nodeText('mine_speed', 3), 'Vitesse de minage +6 %');
  assert.equal(nodeText('ore_rush', 0).startsWith('Vitesse de marche +3 %'), true);
  assert.equal(nodeText('enchanted_pick', 3), 'Fortune +6 %');
  assert.equal(nodeText('filou', 1), 'Critique +2 %');
  assert.equal(nodeText('organized', 2), 'Pods +2 %');
  assert.equal(nodeText('grounded', 3), 'Ténacité +9 %');
  assert.equal(nodeText('aura_reassure', 1), 'Portée d\'attaque +0,1 bloc pour tout le groupe');
  assert.equal(nodeText('crushing', 2), 'Dégâts des coups critiques +20 %');
  assert.match(nodeText('rested', 3), /\+6 % et ténacité \+6 %/);
});

test('règles : spé choisie d\'abord, 3 points par étage dans l\'arbre, points du niveau, reset (la spé reste)', () => {
  const st = createSkills();
  assert.equal(skillOp(st, { action:'learn', node:'mine_speed', opId:id() }, 30).error, 'no_spec', 'sans spé : rien');
  assert.ok(skillOp(st, { action:'spec', tree:'mineur', opId:id() }, 30).ok);
  assert.equal(st.tree, 'mineur');
  assert.equal(skillOp(st, { action:'learn', node:'ore_oxygen', opId:id() }, 30).error, 'needs_tier', 'étage 2 : 3 points d\'abord');
  learnAll(st, ['mine_speed', 'enchanted_pick'], 30);
  assert.equal(blockedReason(st, 'filou', 30), 'needs_tier', '2 points : étage 2 fermé');
  learnAll(st, ['enchanted_pick', 'filou'], 30);
  assert.equal(blockedReason(st, 'ore_rush', 30), 'needs_tier', '4 points : étage 3 fermé (6)');
  learnAll(st, ['filou', 'ore_oxygen', 'ore_rush'], 30);
  assert.equal(blockedReason(st, 'mine_speed', 30), null, 'un étage du dessus reste libre');
  assert.equal(skillOp(st, { action:'learn', node:'ore_oxygen', opId:id() }, 30).error, 'maxed');
  assert.equal(skillOp(st, { action:'learn', node:'ore_rush', opId:id() }, 7).error, 'no_points', '7 points déjà dépensés');
  assert.ok(skillOp(st, { action:'reset', opId:id() }, 30).ok);
  assert.deepEqual([st.tree, spentPoints(st)], ['mineur', 0], 'reset : points rendus, spé gardée');
  assert.equal(skillOp(st, { action:'learn', node:'x', opId:id() }, 9).error, 'unknown');
  assert.equal(skillOp(st, { action:'spec', tree:'hacker', opId:id() }, 9).error, 'unknown');
  assert.equal(skillOp(st, { action:'pirater', opId:id() }, 9).error, 'bad_request');
});

test('changer de spé remet tous les points à zéro ; la même spé ne change rien', () => {
  const st = learnAll(createSkills(), ['damage', 'damage', 'loot']);
  assert.ok(skillOp(st, { action:'spec', tree:'barbare', opId:id() }, 30).ok);
  assert.equal(spentPoints(st), 3, 'même spé : rien de rendu');
  assert.ok(skillOp(st, { action:'spec', tree:'logisticien', opId:id() }, 30).ok);
  assert.deepEqual([st.tree, st.ranks], ['logisticien', {}]);
});

test('arbres secondaires : jamais aussi profond que la spé ; les skills de classe (1 point) seulement pour leur spé', () => {
  const st = learnAll(createSkills(), ['travel_rush', 'travel_rush', 'travel_rush']);   // spé Logisticien, profondeur 1
  assert.equal(blockedReason(st, 'mine_speed', 30), 'too_deep', 'spé à l\'étage 1 : rien ailleurs');
  learnAll(st, ['winch']);                                                                   // profondeur 2
  assert.equal(blockedReason(st, 'mine_speed', 30), null);
  learnAll(st, ['mine_speed', 'mine_speed', 'mine_speed'], 30);
  assert.equal(blockedReason(st, 'filou', 30), 'too_deep', 'étage 2 du Mineur : la spé n\'est qu\'à l\'étage 2');
  learnAll(st, ['organized', 'organized', 'organized', 'grounded']);                         // 8 points, étage 3 atteint
  assert.equal(blockedReason(st, 'filou', 30), null);
  assert.equal(blockedReason(st, 'ore_oxygen', 30), 'spec_only', 'Second souffle : skill de classe du Mineur');
  assert.equal(blockedReason(st, 'ore_rush', 30), 'too_deep', 'étage 3 du Mineur : spé à l\'étage 3');
  learnAll(st, ['tall_ladder', 'bench_mastery']);                                             // 10 points, spé à l'étage 4
  assert.equal(blockedReason(st, 'ore_rush', 30), 'needs_tier', 'étage 3 du Mineur : 6 points dans le Mineur');
  learnAll(st, ['filou', 'filou', 'filou', 'ore_rush']);
  /* exemple de Geoffrey : spé Logisticien à la profondeur 5 → les autres arbres jusqu'à l'étage 4 */
  const g = learnAll(createSkills(), ['travel_rush', 'travel_rush', 'travel_rush', 'organized', 'organized', 'organized', 'winch', 'tall_ladder',
    'winch_speed', 'winch_speed', 'winch_speed', 'mule', 'aura_reassure']);   // 13 points, étage 5
  learnAll(g, ['damage', 'damage', 'damage', 'loot', 'loot', 'loot', 'backstab', 'backstab', 'backstab', 'crushing', 'crushing', 'crushing', 'braum'], 99);
  assert.equal(g.ranks.braum, 1, 'Braum (étage 4) permis');
  assert.equal(blockedReason(g, 'taunt', 99), 'spec_only', 'Provocation : seulement pour un barbare');
  assert.equal(blockedReason(g, 'ravage', 99), 'spec_only');
  learnAll(g, ['braum', 'braum']);
  assert.equal(blockedReason(g, 'sword_mastery', 99), 'too_deep', 'étage 5 : refusé hors spé');
  assert.deepEqual(pointsByTree(g), [0, 13, 15]);
});

test('« | » : Treuil → Escalateur → Mule → Aura rassurante ; Provocation → Solide ; Crushing → Saccager → Aura berserk ; Reposé → Aura d\'efficacité', () => {
  const st = learnAll(createSkills(), ['travel_rush', 'travel_rush', 'travel_rush', 'organized', 'organized', 'organized']);
  assert.equal(blockedReason(st, 'winch_speed', 99), 'needs_previous', '6 points mais pas de Treuil');
  learnAll(st, ['winch', 'winch_speed']);
  assert.equal(blockedReason(st, 'mule', 99), 'needs_tier', '8 points : étage 4 fermé (9)');
  learnAll(st, ['grounded', 'grounded', 'grounded']);
  assert.equal(blockedReason(st, 'mule', 99), 'needs_previous', 'Escalateur pas au max');
  learnAll(st, ['winch_speed', 'winch_speed', 'mule', 'bench_mastery']);
  assert.equal(blockedReason(st, 'aura_reassure', 99), null);
  const b = learnAll(createSkills(), ['damage', 'damage', 'damage', 'backstab', 'backstab', 'backstab']);
  assert.equal(blockedReason(b, 'steady', 99), 'needs_previous', 'Solide sans Provocation');
  learnAll(b, ['crushing', 'crushing', 'loot']);
  assert.equal(blockedReason(b, 'ravage', 99), 'needs_previous', 'Crushing pas au max');
});

test('relecture : la spé d\'abord, puis les autres arbres, étage par étage ; rangs trafiqués ignorés', () => {
  assert.deepEqual(sanitizeSkills({ tree:'barbare', ranks:{ damage:99, loot:2 } }, 99).ranks, { damage:3, loot:2 });
  assert.deepEqual(sanitizeSkills({ tree:'barbare', ranks:{ damage:2, taunt:1 } }, 99).ranks, { damage:2 }, 'étage 2 avec 2 points');
  assert.deepEqual(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, mine_speed:3 } }, 99).ranks, { damage:3 }, 'spé à l\'étage 1 : pas d\'autre arbre');
  assert.deepEqual(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, taunt:1, mine_speed:3 } }, 99).ranks, { damage:3, taunt:1, mine_speed:3 }, 'spé à l\'étage 2 : étage 1 ailleurs');
  assert.deepEqual(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:3 } }, 2).ranks, { mine_speed:2 }, 'pas plus que les points');
  assert.deepEqual(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, damage:3 } }).ranks, { mine_speed:3 });
  assert.deepEqual(sanitizeSkills({ ranks:{ damage:3 } }, 99).ranks, {}, 'sans spé : aucun rang');
  assert.deepEqual(sanitizeSkills({ tree:'hacker', ranks:{ damage:3 } }, 99).ranks, {});
  assert.deepEqual(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:1.5 } }, 99).ranks, {});
  assert.deepEqual(sanitizeSkills(null), createSkills());
});

test('migration (arbres v2 puis v3) : une sauvegarde de compte d\'une autre version perd ses rangs, garde spé et glyphes ; idempotent', () => {
  assert.equal(SKILLS_VERSION, 3);
  for(const v of [undefined, 2]){
    const old = { v, tree:'logisticien', ranks:{ travel_rush:3, tall_ladder:1 }, glyphs:{ travel_rush:'Glyphe Navette' }, ops:['a'] };
    const m = migrateSkills(old);
    assert.deepEqual([m.v, m.tree, m.ranks, m.glyphs, m.ops], [3, 'logisticien', {}, old.glyphs, ['a']], `v${v}`);
    assert.equal(migrateSkills(m), m, 'déjà migrée : rien');
    const st = sanitizeSkills(m, 30);
    assert.deepEqual([st.v, st.tree, st.ranks], [3, 'logisticien', {}]);
  }
  assert.equal(migrateSkills(null), null);
  assert.deepEqual(skillRanks(learnAll(createSkills(), ['damage'])), { v:3, tree:'barbare', ranks:{ damage:1 } });
});

test('demande rejouée (double clic) : un seul rang', () => {
  const st = learnAll(createSkills(), []), o = id();
  skillOp(st, { action:'spec', tree:'barbare', opId:id() }, 5);
  skillOp(st, { action:'learn', node:'damage', opId:o }, 5);
  assert.ok(skillOp(st, { action:'learn', node:'damage', opId:o }, 5).repeated);
  assert.equal(st.ranks.damage, 1);
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

test('Logisticien : échelle de 2 de haut (temps normal : plus de Bâtisseur), marche +3 %/rang au retour et en redescente', () => {
  const G = worldFrom(['', '##### ####', '##### ####', '#####@####']), m = G.miners[0];
  m.skill.tall_ladder = 1; m.skill.travel_rush = 0.15;
  m.mode = 'return';
  assert.ok(stepDir(G, m, 0, -1));
  assert.ok(Math.abs(m.action.dur - CFG.ladderTime) < 1e-9);
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

test('Barbare : butin des mobs +3 %/rang = 3 % de chance par rang pour 1 butin en plus (pas un multiplicateur)', () => {
  const G = worldFrom(['', '@']), m = G.miners[0];
  G.rng = mulberry32(5);
  const N = 20000, perMob = () => { m.inv = {}; m.load = 0; for(let i = 0; i < N; i++){ const o = { id:i, type:'bestiole', x:0, y:1, hp:1, maxhp:1 }; G.mobs.push(o); killMob(G, m, o); } return m.inv.Chitine / N; };
  assert.ok(Math.abs(perMob() - 1.5) < 0.02, 'sans Pillage : 1 à 2 chitines (1,5 en moyenne)');
  m.skill.loot = 0.15;
  const extra = perMob() - 1.5;   // butin en plus par mob tué : 0,15 en moyenne (1 chitine dans 15 % des cas)
  assert.ok(Math.abs(extra - 0.15) < 0.02, `en plus par mob ${extra}`);
  m.skill.loot = 1.5; assert.ok(Math.abs(perMob() - 1.5 - 1.5) < 0.03, '150 % : +1 sûr, et +1 encore une fois sur deux');
});

test('Barbare : Braum à l\'étage 4 (9 points dans l\'arbre d\'abord), marche et montée +10 %/rang seulement quand il aide', () => {
  const b = SKILLS.trees.find(t => t.id === 'barbare').nodes.find(n => n.id === 'braum');
  assert.deepEqual([b.row, b.max, b.per], [4, 3, 0.1]);
  assert.deepEqual(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, taunt:1, loot:3, backstab:1, braum:3 } }, 99).ranks,
    { damage:3, taunt:1, loot:3, backstab:1 }, '8 points : pas de Braum');
  assert.equal(skillEffects(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, taunt:1, loot:3, backstab:2, braum:3 } }, 99)).braum, 0.3);
  const G = worldFrom(['', '@']), m = G.miners[0];
  m.skill.braum = 0.3;
  const [w, c, s] = [moveT(G, m), climbT(G, m), winchT(G, m)];
  m.helping = true;
  assert.ok(Math.abs(moveT(G, m) - w / 1.3) < 1e-9, 'marche');
  assert.ok(Math.abs(climbT(G, m) - c / 1.3) < 1e-9, 'échelle');
  assert.ok(Math.abs(winchT(G, m) - s / 1.3) < 1e-9, 'seau');
  m.skill.braum = 0; assert.equal(moveT(G, m), w, 'sans le skill : rien');
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
  assert.equal(iron.total, 1.48, '(1 + 0,4) × 1,06 = 1,484 (pioche en fer +0,4 depuis le nerf du 25/10)');
  const G = buildSession({ id:'S', seed:1, players:[{ account:'A', name:'Ana' }], looks:{ A:{ pioche:'Pioche en pierre' } }, skills:{ A:skills } });
  assert.equal(Math.round(G.miners[0].carac.mineSpeed * 100) / 100, row.total, 'même valeur qu\'en session');
  assert.equal(minerStats(worn).find(s => s.key === 'mineSpeed').skill, 0, 'sans skills : rien');
});

test('stats : Pillage s\'ajoute au butin des mobs (3 rangs → +9 %), les skills de comportement sont listés à part', async () => {
  const { minerStats } = await import('../src/meta/stuff.js');
  const { behaviourSkills } = await import('../src/meta/skills.js');
  const barb = skillEffects(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, taunt:1, loot:3 } }));
  const row = minerStats({}, barb).find(s => s.key === 'looting');
  assert.equal(row.add, 9); assert.equal(row.total, 9); assert.equal(row.mult, 1, 'pas un multiplicateur');
  assert.deepEqual(behaviourSkills(barb).map(k => k.id), ['taunt'], 'Force brute et Pillage sont déjà dans les stats');
  const log = skillEffects(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:3, tall_ladder:1, organized:3, demat:1, winch:1, winch_speed:2 } }));
  const list = behaviourSkills(log);   // Organisé et Dématérialisation : déjà dans les stats
  assert.deepEqual(list.map(k => k.id), ['travel_rush', 'winch', 'tall_ladder', 'winch_speed']);
  assert.match(list[0].text, /\+9 %/); assert.match(list[3].text, /\+10 %/);
  assert.deepEqual(behaviourSkills({}), [], 'aucun skill : rien');
});

test('Barbare, Force brute : +5 % de dégâts par rang, plus de ténacité depuis le 03/11 (texte, session, onglet Stuff)', async () => {
  const { withSkillStats } = await import('../src/meta/skills.js');
  assert.equal(nodeText('damage', 1), 'Dégâts infligés +5 %, dégâts de zone 2 % (mobs à 1 case de sa cible)');
  assert.equal(nodeText('damage', 3), 'Dégâts infligés +15 %, dégâts de zone 6 % (mobs à 1 case de sa cible)');
  const st = learnAll(createSkills(), ['damage', 'damage']);
  const c = withSkillStats({ ...STATS }, skillEffects(st));
  assert.equal(c.tenacity, STATS.tenacity ?? 0, 'pas de ténacité'); assert.equal(c.damage, STATS.damage * 1.1);
  const G = buildSession({ seed:1, players:[{ account:'A', name:'A' }], skills:{ A:{ tree:st.tree, ranks:{ ...st.ranks } } } });
  assert.equal(G.miners[0].carac.tenacity, STATS.tenacity ?? 0);
});

test('Force brute : 2 % de dégâts de zone par rang (aoeOf), dans le texte du nœud', async () => {
  const { aoeOf, skillEffects, sanitizeSkills, nodeText } = await import('../src/meta/skills.js');
  const eff = r => skillEffects(sanitizeSkills({ tree:'barbare', ranks:{ damage:r } }));
  assert.equal(aoeOf(eff(0)), 0); assert.equal(aoeOf(eff(1)), 0.02); assert.equal(aoeOf(eff(3)), 0.06);
  assert.equal(aoeOf(skillEffects(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3 } }))), 0);
  assert.match(nodeText('damage', 2), /dégâts de zone 4 %/);
});

/* ---- Légende de la flemme (arbre Mineur, 4e étage, 23/10) ---- */
test('Légende de la flemme : 3e étage du Mineur (6 points dans l\'arbre, arbres v3), 0/1, 5 %', async () => {
  const { SKILLS } = await import('../src/config.js');
  const n = SKILLS.trees.find(t => t.id === 'mineur').nodes.find(x => x.id === 'lazy_legend');
  assert.equal(n.row, 3); assert.equal(n.max, 1); assert.equal(n.per, 0.05);
  const { sanitizeSkills, skillEffects } = await import('../src/meta/skills.js');
  assert.equal(skillEffects(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, enchanted_pick:1, lazy_legend:1 } })).lazy_legend, 0, '5 points : refusé');
  assert.equal(skillEffects(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, enchanted_pick:2, lazy_legend:1 } })).lazy_legend, 0.05);
});

test('Légende de la flemme : un tirage par remontée ; réussi = au-dessus du coffre ; jamais en fin de session', async () => {
  const { newSession, tick } = await import('../src/sim/session.js');
  const { lazyTeleport } = await import('../src/sim/ai.js');
  const { CHEST_X } = await import('../src/config.js');
  const G = newSession(5, { miners: 1 }), m = G.miners[0];
  m.skill.lazy_legend = 1;                                    // 100 % pour le test
  Object.assign(m, { x: 10, y: 30, mode: 'return', reason: 'pods pleins', returnStart: 12 });
  assert.equal(lazyTeleport(G, m), true);
  assert.deepEqual([m.x, m.y], [CHEST_X, 0]); assert.equal(m.stats.lazy, 1);
  Object.assign(m, { x: 10, y: 30 });
  assert.equal(lazyTeleport(G, m), false, 'même remontée : pas de deuxième tirage');
  Object.assign(m, { returnStart: 40, reason: 'fin de session' });
  assert.equal(lazyTeleport(G, m), false, 'fin de session : jamais');
  m.skill.lazy_legend = 0; Object.assign(m, { returnStart: 50, reason: 'oxygène' });
  assert.equal(lazyTeleport(G, m), false, 'sans le skill : jamais');
  /* en partie : avec le skill à 100 %, les remontées (sac plein) finissent toutes au coffre d'un coup */
  const H = newSession(9, { miners: 1 }), k = H.miners[0];
  k.skill.lazy_legend = 1; k.carac.pods = 30;
  for(let i = 0; i < 6000 && !(k.stats.lazy >= 2); i++) tick(H);
  assert.ok(k.stats.lazy >= 2, `téléportations : ${k.stats.lazy}`);
  assert.ok(k.stats.trips >= 1, 'il a bien déposé au coffre');
});

/* 24/10 (Geoffrey, « pas appliqué ? ») : bout en bout, depuis les skills du compte jusqu'au coup en partie */
test('Force brute 3/3 : en partie, le mob collé à la cible prend 6 % du coup', async () => {
  const { buildSession } = await import('../src/shared/game.js');
  const { finishAction } = await import('../src/sim/actions.js');
  const G = buildSession({ seed:5, id:'aoe', players:[{ account:'A', name:'Geo' }], skills:{ A:{ tree:'barbare', ranks:{ damage:3 } } } });
  const m = G.miners[0];
  const mk = (id, dx) => ({ id, type:'bestiole', x:m.x + dx, y:m.y, hp:100, maxhp:100 });
  const [a, b, far] = [mk(900, 1), mk(901, 2), mk(902, 4)];
  G.mobs.push(a, b, far);
  finishAction(G, m, { type:'attack', data:{ mob:a } });
  const dmg = 100 - a.hp;
  assert.ok(Math.abs(dmg - 5.75) < 1e-9, `coup ${dmg}`);                  // 5 × 1,15
  assert.ok(Math.abs((100 - b.hp) - dmg * 0.06) < 1e-9, `voisin ${100 - b.hp}`);
  assert.equal(far.hp, 100, 'pas au-delà d\'1 case');
  /* affichage (24/10, option 2) : le coup de zone est noté sur le mob et envoyé au navigateur */
  assert.ok(Math.abs(b.splash.v - dmg * 0.06) < 1e-9); assert.equal(b.splash.t, G.t);
  assert.equal(a.splash, undefined, 'la cible n\'a pas de chiffre de zone'); assert.equal(far.splash, undefined);
  const { createViewer } = await import('../src/shared/view.js');
  const sent = createViewer(G)().mobs.find(o => o.id === 901);
  assert.deepEqual(sent.splash, b.splash);
});

test('chiffre des dégâts de zone : « -0,3 », « -1,2 », « -13 », jamais « -0 »', async () => {
  const { splashText } = await import('../src/render/splash.js');
  assert.deepEqual([0.345, 1.23, 12.6, 0.01].map(splashText), ['-0,3', '-1,2', '-13', '-0,1']);
});

test('maîtrises (28/10) : pioche +5 %, épée +5 % (étage 5, 12 points), torse +3 % (étage 4, 9 points, arbres v3) par rang', () => {
  const nodes = { mineur:['pick_mastery', 5], barbare:['sword_mastery', 5], logisticien:['bench_mastery', 4] };
  for(const [tree, [node, row]] of Object.entries(nodes)){
    const t = SKILLS.trees.find(x => x.id === tree), n = t.nodes.find(x => x.id === node);
    assert.deepEqual([n.row, n.max], [row, 3], node);
    const st = learnAll(createSkills(), t.nodes.filter(x => x.row < 2).flatMap(x => Array(x.max).fill(x.id)));
    assert.equal(blockedReason(st, node, 99), 'needs_tier', node + ' bloqué avec 6 points');
    learnAll(st, t.nodes.filter(x => x.row >= 2).flatMap(x => Array(x.max).fill(x.id)));
    assert.equal(st.ranks[node], 3);
  }
  assert.equal(nodeText('pick_mastery', 3), 'Les stats données par la pioche +15 %');
  assert.equal(nodeText('bench_mastery', 1), 'Les stats données par le torse +3 %');

  const eff = tree => skillEffects(sanitizeSkills({ tree, ranks:Object.fromEntries(SKILLS.trees.find(t => t.id === tree).nodes.map(n => [n.id, n.max])) }));
  assert.deepEqual(slotMastery(eff('mineur')), { pioche:0.15 });
  assert.deepEqual(slotMastery(eff('barbare')), { epee:0.15 });
  assert.deepEqual(slotMastery(eff('logisticien')), { torse:0.09 });
  assert.deepEqual(slotMastery({}), {});

  const gear = [{ item:'Pioche en fer' }, { item:'Épée en fer' }, { item:'Plastron en fer' }, { item:'Bottes en chitine' }];
  const plain = equippedStats(gear);
  const pick = equippedStats(gear, { pioche:0.15 }), sword = equippedStats(gear, { epee:0.15 }), chest = equippedStats(gear, { torse:0.09 });
  assert.equal(pick.mineSpeed, STATS.mineSpeed + 0.46);                       // 0,4 × 1,15
  assert.equal(pick.damage, plain.damage); assert.equal(pick.speed, plain.speed);   // le reste ne bouge pas
  assert.equal(sword.damage, 15.4);                                           // 5 + (14 − 5) × 1,15 = 15,35 → 15,4 (dégâts au dixième) : ce que l'épée ajoute aux mains nues
  assert.equal(chest.pods, STATS.pods + 96);                                  // 88 × 1,09 = 95,9 → 96 (pods entiers)
  assert.equal(chest.mineSpeed, plain.mineSpeed);
  /* rien porté dans la case : rien ne change */
  assert.deepEqual(equippedStats([{ item:'Bottes en chitine' }], { pioche:0.15 }), equippedStats([{ item:'Bottes en chitine' }]));
  /* pas dans le gear score (ce n'est pas le stuff) */
  assert.equal(gearScore(gear), gearScore(gear));

  /* onglet Stuff : l'apport va dans la colonne des skills, pas dans les comportements */
  const row = minerStats({ pioche:{ item:'Pioche en fer' } }, eff('mineur')).find(r => r.key === 'mineSpeed');
  assert.equal(row.bonus, 0.4);
  assert.ok(row.total > (STATS.mineSpeed + 0.46) * 1.06 - 1e-9 && row.total < (STATS.mineSpeed + 0.46) * 1.06 + 0.01, String(row.total));   // × Pioche aiguisée 6 %
  assert.ok(!behaviourSkills(eff('mineur')).some(b => b.id === 'pick_mastery'));

  /* en session : mêmes stats (src/shared/game.js) */
  const G = buildSession({ seed:1, players:[{ account:'A', name:'A' }], gear:{ A:{ pioche:{ item:'Pioche en fer', uid:1 } } },
    skills:{ A:{ tree:'mineur', ranks:Object.fromEntries(SKILLS.trees[0].nodes.map(n => [n.id, n.max])) } } });
  assert.ok(Math.abs(G.miners[0].carac.mineSpeed - row.total) < 0.01, String(G.miners[0].carac.mineSpeed));   // 1,46 × 1,06 (l'onglet arrondit au centième)
});

test('Ambidextre (arbres v3, 04/11) : +2 % de double attaque par rang, dans les stats comme en session', async () => {
  const { withSkillStats } = await import('../src/meta/skills.js');
  const eff = r => skillEffects(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:3, ambidextrous:r } }));
  assert.equal(withSkillStats({ ...STATS, doubleAttack:5 }, eff(2)).doubleAttack, 9);
  assert.equal(withSkillStats({ ...STATS, doubleAttack:5 }, eff(0)).doubleAttack, 5);
  assert.equal(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:2, ambidextrous:3 } }, 99).ranks.ambidextrous, undefined, 'étage 2 : 3 points d\'abord');
});
