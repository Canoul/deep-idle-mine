/* Arbres de skills v2 (04/11/2026, Geoffrey) : effets des nouveaux skills (stats fixes, Mineur tout terrain, auras du
   groupe, Crushing, Dans le dos, Reposé, Solide sur les appuis). Les règles des arbres sont dans skills.test.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, STATS } from '../src/config.js';
import { sanitizeSkills, skillEffects, withSkillStats, groupAuras } from '../src/meta/skills.js';
import { minerSpecs } from '../src/shared/game.js';
import { critMul, backstabMul, trackRested, restedMul, tenacityBonus } from '../src/sim/skillfx.js';
import { tenacityOf } from '../src/sim/tenacity.js';
import { hitDamage } from '../src/sim/actions.js';
import { moveT, mineT } from '../src/sim/mineur.js';
import { worldFrom } from './helpers.js';
import { tickGolbute } from '../src/sim/instance/golbute.js';
import { IDS } from '../src/config.js';

const full = tree => ({ tree, ranks: Object.fromEntries(SKILLS.trees.find(t => t.id === tree).nodes.map(n => [n.id, n.max])) });
const eff = raw => skillEffects(sanitizeSkills(raw));
const specs = (skills, mode = 'mine') => minerSpecs({ seed: 1, mode, players: Object.keys(skills).map(a => ({ account: a, name: a })), skills });

test('stats fixes : Pioche ensorcelée (fortune), Filou (critique), Organisé (pods), Dématérialisation (coup unique), Cloué au sol (ténacité)', () => {
  const m = withSkillStats({ ...STATS }, eff({ tree: 'mineur', ranks: { mine_speed: 3, enchanted_pick: 3, filou: 3 } }));
  assert.equal(m.fortune, STATS.fortune + 6); assert.equal(m.crit, (STATS.crit || 0) + 6);
  const l = withSkillStats({ ...STATS }, eff({ tree: 'logisticien', ranks: { travel_rush: 3, organized: 3, demat: 3, grounded: 3 } }));
  assert.ok(Math.abs(l.pods - STATS.pods * 1.03) < 1e-9, 'pods × 1,03');
  assert.equal(l.oneTap, (STATS.oneTap || 0) + 6); assert.equal(l.tenacity, (STATS.tenacity || 0) + 9);
  const [a] = specs({ A: { tree: 'logisticien', ranks: { travel_rush: 3, organized: 3, demat: 3, grounded: 3 } } });
  assert.equal(a.carac.tenacity, l.tenacity, 'même chose en session');
});

test('Mineur tout terrain : minage +5 %/rang seulement en instance, tour, Bloc géant et He\'s coming', () => {
  const sk = { A: { tree: 'mineur', ranks: { mine_speed: 3, enchanted_pick: 3, all_terrain: 3 } } };
  const mine = specs(sk, 'mine')[0].carac.mineSpeed, prison = specs(sk, 'prison')[0].carac.mineSpeed;
  assert.equal(mine, prison);
  for(const mode of ['instance_1', 'instance_2', 'tower_angel', 'tower_demon', 'giant'])
    assert.ok(Math.abs(specs(sk, mode)[0].carac.mineSpeed - mine * 1.15) < 1e-9, mode);
});

test('auras : tout le groupe, porteur compris ; deux porteurs = une seule fois', () => {
  assert.deepEqual(groupAuras([eff(full('barbare')), {}]), { crit: 2 });
  assert.deepEqual(groupAuras([eff(full('barbare')), eff(full('barbare'))]), { crit: 2 }, 'pas de cumul');
  assert.deepEqual(groupAuras([eff(full('mineur')), eff(full('logisticien')), eff(full('barbare'))]), { piercing: 2, reach: 0.1, crit: 2 });
  const [b, x] = specs({ B: full('barbare'), X: null });
  const [, alone] = specs({ X0: null, X: null });
  assert.equal(x.carac.crit - alone.carac.crit, 2, 'l\'autre membre a +2 de critique');
  assert.equal(b.carac.crit - withSkillStats({ ...STATS }, eff(full('barbare'))).crit, 2, 'le porteur aussi');
  const [l, y] = specs({ L: full('logisticien'), Y: null });
  assert.ok(Math.abs(y.carac.reach - alone.carac.reach - 0.1) < 1e-9, 'Aura rassurante : portée +0,1');
});

test('Crushing : un critique fait × 2 × (1 + 10 %/rang) ; sans le skill × 2', () => {
  assert.equal(critMul({ skill: {} }), 2);
  assert.ok(Math.abs(critMul({ skill: eff({ tree: 'barbare', ranks: { damage: 3, loot: 3, crushing: 3 } }) }) - 2.6) < 1e-9);
  const G = worldFrom(['', '@']), m = G.miners[0];
  m.carac.crit = 100; m.skill.crushing = 0.3;
  assert.ok(Math.abs(hitDamage(G, m) - m.carac.damage * 2.6) < 1e-9, 'en partie (mine)');
});

test('Dans le dos : +5 %/rang de dégâts quand aucun mob ne le tacle', () => {
  assert.equal(backstabMul({ skill: { backstab: 0.15 } }, false), 1.15);
  assert.equal(backstabMul({ skill: { backstab: 0.15 } }, true), 1);
  const G = worldFrom(['', '@ ']), m = G.miners[0];
  m.carac.crit = 0; m.skill.backstab = 0.15;
  const o = { id: 99, type: 'gobelin', x: m.x + 1, y: m.y, hp: 10, maxhp: 10, grab: null };
  G.mobs.push(o);
  const free = hitDamage(G, m);
  o.grab = m.id;
  const held = hitDamage(G, m);
  assert.ok(Math.abs(free - held * 1.15) < 1e-9, `libre ${free}, taclé ${held}`);
});

test('Reposé : après une remontée, une fois redescendu au front, minage / marche / dégâts / ténacité en plus pendant 3 min (1 min en prison)', () => {
  const G = worldFrom(['', '@', '#']), m = G.miners[0];
  m.skill.rested = 0.06; m.stats.trips = 0;
  m.mode = 'departure'; trackRested(G, m); m.mode = 'work'; trackRested(G, m);
  assert.ok(!m.restedNow, 'première descente (pas de remontée avant) : rien');
  m.stats.trips = 1;
  const t0 = moveT(G, m), d0 = hitDamage(G, m), k0 = tenacityOf(m), mt = mineT(G, m, IDS.stone);
  m.mode = 'departure'; trackRested(G, m); m.mode = 'work'; trackRested(G, m);
  assert.ok(m.restedNow);
  assert.equal(restedMul(m), 1.06);
  assert.ok(Math.abs(moveT(G, m) - t0 / 1.06) < 1e-9); assert.ok(Math.abs(mineT(G, m, IDS.stone) - mt / 1.06) < 1e-9);
  m.carac.crit = 0; assert.ok(Math.abs(hitDamage(G, m) - d0 * 1.06) < 1e-9);
  assert.equal(tenacityBonus(m), 6); assert.ok(tenacityOf(m) > k0);
  G.t += SKILLS.rested.time + 1; trackRested(G, m);
  assert.ok(!m.restedNow, 'fini après 3 min');
  G.prison = {}; m.mode = 'departure'; trackRested(G, m); m.mode = 'work'; trackRested(G, m);
  assert.equal(m.restedUntil, G.t + SKILLS.rested.prisonTime, 'prison : 1 min');
});

test('Solide sur les appuis : +5 de ténacité contre les mécaniques de boss seulement', () => {
  const m = { carac: { tenacity: 0 }, skill: eff({ tree: 'barbare', ranks: { damage: 3, taunt: 1, loot: 2, steady: 1 } }) };
  assert.equal(m.skill.steady, 1);
  for(const src of ['golbute', 'towerBoss', 'minotaure', 'hescoming']) assert.equal(tenacityBonus(m, src), 5, src);
  assert.equal(tenacityBonus(m, 'gobelin'), 0); assert.equal(tenacityBonus(m, null), 0);
  assert.ok(tenacityOf(m, 'golbute') > 0); assert.equal(tenacityOf(m, 'gobelin'), 0);
});

test('Solide sur les appuis : l\'avalanche du Golbute n\'en profite pas, l\'autoattack si', async () => {
  const { newGolbute, slamChance } = await import('../src/sim/instance/golbute.js');
  const { INSTANCE } = await import('../src/config.js');
  const mk = steady => newGolbute(3, { miners: [{ name: 'B', account: 'B', carac: { damage: 0, mineSpeed: 0, tenacity: 30 }, skills: steady ? { steady: 1 } : {} }] });
  const a = mk(false), b = mk(true);
  assert.ok(slamChance(b, b.miners[0]) < slamChance(a, a.miners[0]), 'autoattack : moins de chances d\'être propulsé');
  const dodges = G => { G.boss.cd = Infinity; G.next.split = Infinity; G.fightRng = (() => { let i = 0; return () => (i++ % 100) / 100; })();
    const n = Math.round((INSTANCE.golbute.avalanche.every * 5 + 1) / 0.1); for(let i = 0; i < n && !G.over; i++) tickGolbute(G); return G.stats.dodges; };
  assert.equal(dodges(mk(true)), dodges(mk(false)), 'avalanche : même esquive avec ou sans le skill');
});

/* ---------- serveur ---------- */

test('serveur : migration (ancienne sauvegarde → points rendus, spé gardée), choisir sa spé, points par arbre ; spé refusée en session', async () => {
  const { createMemoryGameStore } = await import('../server/game/store.js');
  const { createGameService } = await import('../server/game/service.js');
  const { fakeLive } = await import('./helpers.js');
  const store = createMemoryGameStore();
  await store.putProgress('AAAA1111', { xp: 1e9, spec: {}, credited: [] });
  await store.putSkills('AAAA1111', { tree: 'barbare', ranks: { damage: 3, taunt: 1, loot: 5 }, glyphs: {}, ops: [] });   // arbre d'avant le 04/11
  const game = createGameService({ store, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })), clock: () => 1e6, randomSeed: () => 1 });
  const ME = { id: 'AAAA1111', name: 'Zoe' };
  assert.equal(await game.skillTreeOf('AAAA1111'), 'barbare', 'spé gardée');
  assert.deepEqual(await game.skillPointsOf('AAAA1111'), [0, 0, 0], 'points rendus');
  let r = await game.skills(ME, { action: 'learn', node: 'damage', opId: 'op-skv2-aa' });
  assert.equal(r.skills.ranks.damage, 1);
  assert.equal((await store.getSkills('AAAA1111')).v, 2, 'enregistrée en v2 : plus de migration');
  r = await game.skills(ME, { action: 'spec', tree: 'mineur', opId: 'op-skv2-bb' });
  assert.deepEqual([r.skills.tree, r.skills.spent], ['mineur', 0]);
  await assert.rejects(game.skills(ME, { action: 'learn', node: 'taunt', opId: 'op-skv2-cc' }), /spécialisation|Hors spé|classe/i);
  await assert.rejects(game.skills(ME, { action: 'spec', tree: 'hacker', opId: 'op-skv2-dd' }));
});
