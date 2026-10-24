/* Skills : règles des arbres (points, étape précédente au max, un seul arbre, reset), relecture, effets en partie. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, STATS, CFG, IDS } from '../src/config.js';
import { createSkills, skillOp, sanitizeSkills, skillEffects, blockedReason, spentPoints, nodeText } from '../src/meta/skills.js';
import { buildSession } from '../src/shared/game.js';
import { worldFrom, run } from './helpers.js';
import { moveT, climbT, winchT } from '../src/sim/mineur.js';
import { stepDir, finishAction, killMob } from '../src/sim/actions.js';
import { tackler } from '../src/sim/ai.js';
import { updateMobs } from '../src/sim/mobs.js';
import { mulberry32 } from '../src/core/rng.js';

let n = 0; const id = () => 'op-sk-' + (++n);
const learnAll = (st, nodes, points = 99) => { for(const x of nodes) assert.ok(skillOp(st, { action:'learn', node:x, opId:id() }, points).ok, x); return st; };
const fullTree = tree => SKILLS.trees.find(t => t.id === tree).nodes.flatMap(n => Array(n.max).fill(n.id));

test('arbres demandés : 3 étages (3 / 1 / 5 rangs, + au 4e : Braum 3 pour le Barbare, Légende de la flemme 1 pour le Mineur, Mule 1 pour le Logisticien) ; Logisticien : Échelle de 2 et Treuil côte à côte au 2e étage', () => {
  assert.deepEqual(SKILLS.trees.map(t => t.label), ['Mineur', 'Logisticien', 'Barbare']);
  for(const t of SKILLS.trees) for(const r of [1, 2, 3]) assert.ok(t.nodes.some(n => n.row === r), `${t.id} étage ${r}`);
  for(const t of SKILLS.trees) assert.deepEqual(t.nodes.map(n => n.max), { mineur:[3, 1, 5, 1], logisticien:[3, 1, 1, 5, 1], barbare:[3, 1, 5, 3] }[t.id]);   // 4e étage : Braum (Barbare), Légende de la flemme (Mineur), Mule (Logisticien)
  const lg = SKILLS.trees.find(t => t.id === 'logisticien').nodes;
  assert.deepEqual(lg.map(n => [n.id, n.row]), [['travel_rush', 1], ['tall_ladder', 2], ['winch', 2], ['winch_speed', 3], ['mule', 4]]);   // 23/10 soir : Bâtisseur supprimé
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

test('étage à deux cases : chacune exige l\'étage 1 (Navette) au max ; l\'étage 3 (Escalateur) exige les deux (23/10/2026)', () => {
  const st = createSkills();
  assert.equal(skillOp(st, { action:'learn', node:'winch', opId:id() }, 9).error, 'needs_previous');
  learnAll(st, ['travel_rush', 'travel_rush', 'travel_rush']);
  assert.equal(blockedReason(st, 'tall_ladder', 9), null);
  assert.equal(blockedReason(st, 'winch', 9), null);
  assert.equal(blockedReason(st, 'winch_speed', 9), 'needs_previous', 'aucune case de l\'étage 2');
  learnAll(st, ['winch']);
  assert.equal(blockedReason(st, 'winch_speed', 9), 'needs_previous', 'le Treuil seul ne suffit plus');
  const other = learnAll(createSkills(), ['travel_rush', 'travel_rush', 'travel_rush', 'tall_ladder']);
  assert.equal(blockedReason(other, 'winch_speed', 9), 'needs_previous', 'Échelle de 2 seule non plus');
  learnAll(st, ['tall_ladder']);
  assert.equal(blockedReason(st, 'winch_speed', 9), null, 'les deux cases ouvrent l\'étage 3');
  learnAll(st, ['winch_speed']);
  assert.deepEqual(st.ranks, { travel_rush:3, winch:1, tall_ladder:1, winch_speed:1 });
  const eff = skillEffects(st);
  assert.deepEqual([eff.winch, eff.tall_ladder], [1, 1]);
  assert.equal(blockedReason(learnAll(createSkills(), ['damage', 'damage', 'damage', 'taunt']), 'loot', 9), null, 'les autres arbres : inchangés');
});

test('relecture : l\'étage 3 du Logisticien exige les deux cases de l\'étage 2 ; une ancienne sauvegarde avec une seule les perd (points rendus)', () => {
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:3, tall_ladder:1, winch:1, winch_speed:5 } }, 99).ranks,
    { travel_rush:3, tall_ladder:1, winch:1, winch_speed:5 });
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:3, winch:1, winch_speed:2 } }, 99).ranks, { travel_rush:3, winch:1 }, 'Treuil seul');
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:3, tall_ladder:1, winch_speed:5 } }, 9).ranks, { travel_rush:3, tall_ladder:1 }, 'Échelle de 2 seule');
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:3, winch_speed:2 } }, 99).ranks, { travel_rush:3 }, 'étage 3 sans étage 2');
  assert.deepEqual(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:2, winch:1 } }, 99).ranks, { travel_rush:2 });
});

test('Logisticien refait (23/10 soir) : une sauvegarde de l\'ancien arbre garde ce qui tient, le reste est rendu', () => {
  /* ancien chemin complet : Bâtisseur 3, Échelle de 2, Treuil, Navette 5, Mule = 11 points */
  const old = sanitizeSkills({ tree:'logisticien', ranks:{ build_time:3, tall_ladder:1, winch:1, travel_rush:5, mule:1 } }, 11);
  assert.deepEqual(old.ranks, { travel_rush:3, tall_ladder:1, winch:1 }, 'Bâtisseur disparu, Navette ramenée à 3, Mule sans Escalateur : perdue');
  assert.equal(spentPoints(old), 5, '6 points rendus');
  /* le nouveau chemin complet coûte autant : 3 + 1 + 1 + 5 + 1 = 11 */
  const all = learnAll(old, ['winch_speed', 'winch_speed', 'winch_speed', 'winch_speed', 'winch_speed', 'mule'], 11);
  assert.deepEqual(all.ranks, { travel_rush:3, tall_ladder:1, winch:1, winch_speed:5, mule:1 });
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

test('Barbare : Braum à l\'étage 4 (Pillage au max d\'abord), marche et montée +10 %/rang seulement quand il aide', () => {
  const b = SKILLS.trees.find(t => t.id === 'barbare').nodes.find(n => n.id === 'braum');
  assert.deepEqual([b.row, b.max, b.per], [4, 3, 0.1]);
  assert.deepEqual(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, taunt:1, loot:4, braum:3 } }, 99).ranks,
    { damage:3, taunt:1, loot:4 }, 'Pillage pas au max : pas de Braum');
  assert.equal(skillEffects(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, taunt:1, loot:5, braum:3 } }, 99)).braum, 0.3);
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
  assert.equal(iron.total, 1.59, '(1 + 0,5) × 1,06 = 1,59');
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
  const log = skillEffects(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:3, tall_ladder:1, winch:1, winch_speed:2 } }));
  const list = behaviourSkills(log);
  assert.deepEqual(list.map(k => k.id), ['travel_rush', 'tall_ladder', 'winch', 'winch_speed']);
  assert.match(list[0].text, /\+9 %/); assert.match(list[3].text, /\+10 %/);
  assert.deepEqual(behaviourSkills({}), [], 'aucun skill : rien');
});

test('Barbare, Force brute : +5 % de dégâts ET +5 % de ténacité par rang (texte, session, onglet Stuff)', async () => {
  const { withSkillStats } = await import('../src/meta/skills.js');
  const { minerStats } = await import('../src/meta/stuff.js');
  assert.equal(nodeText('damage', 1), 'Dégâts infligés +5 %, ténacité +5 %, dégâts de zone 2 % (mobs à 1 case de sa cible)');
  assert.equal(nodeText('damage', 3), 'Dégâts infligés +15 %, ténacité +15 %, dégâts de zone 6 % (mobs à 1 case de sa cible)');
  const st = learnAll(createSkills(), ['damage', 'damage']);
  const eff = skillEffects(st);
  const c = withSkillStats({ ...STATS }, eff);
  assert.equal(c.tenacity, 10); assert.equal(c.damage, STATS.damage * 1.1);
  assert.equal(withSkillStats({ ...STATS }, skillEffects(createSkills())).tenacity, 0, 'sans skill : 0');
  const ten = minerStats({}, eff).find(s => s.key === 'tenacity');
  assert.deepEqual([ten.total, ten.skill, ten.mult, ten.label], [10, 10, 1, 'Ténacité']);
  /* en session : la carac du mineur porte la ténacité */
  const G = buildSession({ seed:1, players:[{ account:'A', name:'A' }], skills:{ A:{ tree:st.tree, ranks:{ ...st.ranks } } } });
  assert.equal(G.miners[0].carac.tenacity, 10);
});

test('Force brute : 2 % de dégâts de zone par rang (aoeOf), dans le texte du nœud', async () => {
  const { aoeOf, skillEffects, sanitizeSkills, nodeText } = await import('../src/meta/skills.js');
  const eff = r => skillEffects(sanitizeSkills({ tree:'barbare', ranks:{ damage:r } }));
  assert.equal(aoeOf(eff(0)), 0); assert.equal(aoeOf(eff(1)), 0.02); assert.equal(aoeOf(eff(3)), 0.06);
  assert.equal(aoeOf(skillEffects(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3 } }))), 0);
  assert.match(nodeText('damage', 2), /dégâts de zone 4 %/);
});

/* ---- Légende de la flemme (arbre Mineur, 4e étage, 23/10) ---- */
test('Légende de la flemme : 4e étage du Mineur (Ruée au max avant), 0/1, 5 %', async () => {
  const { SKILLS } = await import('../src/config.js');
  const n = SKILLS.trees.find(t => t.id === 'mineur').nodes.find(x => x.id === 'lazy_legend');
  assert.equal(n.row, 4); assert.equal(n.max, 1); assert.equal(n.per, 0.05);
  const { sanitizeSkills, skillEffects } = await import('../src/meta/skills.js');
  assert.equal(skillEffects(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:4, lazy_legend:1 } })).lazy_legend, 0, 'Ruée pas au max : refusé');
  assert.equal(skillEffects(sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:5, lazy_legend:1 } })).lazy_legend, 0.05);
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
});
