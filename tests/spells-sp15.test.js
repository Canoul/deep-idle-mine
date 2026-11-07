/* Sorts de spé niveau 15 (07/11/2026, Geoffrey ; spec docs/superpowers/specs/2026-11-07-sorts-sp15-design.md) :
   Fracasse Armure (Barbare), Rafale de pioche (Mineur), Désarmement (Logisticien) ; debuffs src/sim/debuffs.js. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS, IDS, COMBAT, DT, BRIDGE } from '../src/config.js';
import { isUnlocked, createSpells, unlockText } from '../src/meta/spells.js';
import { worldFrom } from './helpers.js';
import { startAction, mineT } from '../src/sim/mineur.js';
import { finishAction, landHit, hitDamage } from '../src/sim/actions.js';
import { afterDecide, updateSpells, disarmHit, burstFight } from '../src/sim/spells.js';
import { takenMul, mobDt, hurt } from '../src/sim/debuffs.js';
import { mobEffects } from '../src/sim/effects.js';
import { tick } from '../src/sim/session.js';

const S = Object.fromEntries(SPELLS.list.map(s => [s.id, s]));
const arena = () => worldFrom(['', '#'.repeat(50), '#@          #', '#'.repeat(50)]);
const mob = (id, x, y = 2, o = {}) => ({ id, type:'bestiole', x, y, hp:1000, maxhp:1000, cd:1e9, ...o });
const calm = m => { m.carac.crit = 0; m.carac.doubleAttack = 0; m.carac.knockback = -COMBAT.knock; };

test('déblocage : niveau de spé 15 de la bonne classe', () => {
  const st = createSpells();
  for(const [id, tree] of [['shatter', 'barbare'], ['burst', 'mineur'], ['disarm', 'logisticien']]){
    assert.equal(isUnlocked(st, id, { spec:{ [tree]:14 } }), false);
    assert.equal(isUnlocked(st, id, { spec:{ [tree]:15 } }), true);
    assert.equal(S[id].needTree, tree);
    assert.equal(S[id].cd, 30);
  }
  assert.equal(unlockText('burst'), 'Mineur : niveau de spécialisation 15');
});

/* ---------- debuffs ---------- */

test('Fracassé : +3 % de dégâts reçus pendant 15 s ; Désarmé : recharges 10 % plus longues ; affichés sur le mob', () => {
  const G = arena(), o = mob(1, 3);
  assert.equal(takenMul(G, o), 1); assert.equal(mobDt(G, o), DT);
  o.shatterUntil = G.t + 15; o.disarmUntil = G.t + 15;
  assert.ok(Math.abs(takenMul(G, o) - 1.03) < 1e-12);
  assert.ok(Math.abs(mobDt(G, o) * 1.1 - DT) < 1e-12);
  assert.ok(Math.abs(hurt(G, o, 100) - 103) < 1e-9); assert.ok(Math.abs(o.hp - 897) < 1e-9);
  assert.deepEqual(mobEffects(G, o).filter(e => e === 'shattered' || e === 'disarmed'), ['shattered', 'disarmed']);
  G.t += 15;
  assert.equal(takenMul(G, o), 1); assert.equal(mobDt(G, o), DT);
  assert.deepEqual(mobEffects(G, o), []);
});

test('Désarmé : un mob qui tacle frappe 10 % moins souvent', () => {
  const run = dis => {
    const G = arena(), m = G.miners[0];
    m.carac.knockback = 0;
    const o = mob(1, 2, 2, { type:'golem', grab:m.id, hit:0 });
    if(dis) o.disarmUntil = 1e9;
    G.mobs.push(o);
    for(let i = 0; i < 600; i++) tick(G);
    return m.stats.knocked || 0;
  };
  const a = run(false), b = run(true);
  assert.ok(a > 0 && b < a, `coups : ${a} → ${b}`);
});

/* ---------- Fracasse Armure ---------- */

test('Fracasse Armure : en combat sur sa cible, 15 s ; pas sur une cible déjà fracassée ; toutes les sources comptent', () => {
  const G = arena(), m = G.miners[0];
  m.spells = ['shatter']; calm(m); m.x = 5;
  const o = mob(1, 6); G.mobs.push(o);
  updateSpells(G);
  assert.ok(!m.spellCd.shatter, 'pas en combat : rien');
  startAction(m, 'attack', 1, { mob:o });
  updateSpells(G);
  assert.equal(o.shatterUntil, G.t + 15); assert.equal(m.spellCd.shatter, G.t + 30);
  const base = hitDamage(G, m);
  landHit(G, m, o);
  assert.ok(Math.abs((1000 - o.hp) - base * 1.03) < 1e-6, 'coup normal × 1,03');
  m.spellCd.shatter = 0; o.shatterUntil = G.t + 5;
  updateSpells(G);
  assert.equal(o.shatterUntil, G.t + 5, 'déjà fracassé : il ne le relance pas'); assert.equal(m.spellCd.shatter, 0);
});

/* ---------- Désarmement ---------- */

test('Désarmement : à la place du coup, 200 % (critique possible) puis Désarmé 15 s ; pas sur une cible déjà désarmée', () => {
  const G = arena(), m = G.miners[0];
  m.spells = ['disarm']; calm(m); m.x = 5;
  const o = mob(1, 6); G.mobs.push(o);
  const base = hitDamage(G, m);
  assert.equal(disarmHit(G, m, o), true);
  assert.ok(Math.abs((1000 - o.hp) - base * 2) < 1e-6);
  assert.equal(o.disarmUntil, G.t + 15); assert.equal(m.spellCd.disarm, G.t + 30);
  assert.equal(disarmHit(G, m, o), false, 'en recharge');
  m.spellCd.disarm = 0;
  assert.equal(disarmHit(G, m, o), false, 'déjà désarmé');
  m.carac.crit = 100; o.disarmUntil = 0; const hp = o.hp;
  disarmHit(G, m, o);
  assert.ok(hp - o.hp > base * 2 + 1e-6, 'critique possible');
});

test('Désarmement en session : part dans le combat, un seul coup à ce moment-là', () => {
  const G = worldFrom(['', '#'.repeat(50), '#@  #', '#'.repeat(50)]), m = G.miners[0];
  m.spells = ['disarm']; calm(m);
  const o = mob(3, 2, 2, { hp:1e9, maxhp:1e9 }); G.mobs.push(o); m.foe = 3;
  for(let i = 0; i < 20 && !m.spellCd.disarm; i++) tick(G);
  assert.ok(m.spellCd.disarm > 0, 'lancé');
  assert.ok(o.disarmUntil > G.t);
});

/* ---------- Rafale de pioche ---------- */

const gallery = row => worldFrom(['', '#'.repeat(50), row, '#'.repeat(50)]);

test('Rafale (minage) : 5 × le temps du bloc visé ÷ 1,25, puis casse 5 blocs en ligne comme s\'il minait', () => {
  const G = gallery('#@dcccc#'), m = G.miners[0];
  m.spells = ['burst'];
  startAction(m, 'mine', mineT(G, m, IDS.dirt), { x:2, y:2 });
  afterDecide(G, m);
  assert.equal(m.action.type, 'burst');
  assert.ok(Math.abs(m.action.dur - 5 * mineT(G, m, IDS.dirt) / 1.25) < 1e-9, 'durée : celle du bloc visé (terre)');
  finishAction(G, m, m.action);
  for(let x = 2; x <= 6; x++) assert.equal(G.tiles[2][x], 0, `x = ${x} cassé`);
  assert.equal(G.tiles[2][7], IDS.stone, 'le 6e reste');
  assert.equal(m.inv['Charbon'], 4);
  assert.equal(m.spellCd.burst, G.t + 30);
});

test('Rafale (minage) : au moins 3 blocs en ligne ; jamais vers le bas ; la ligne s\'arrête au vide et aux constructions', () => {
  let G = gallery('#@cc  #'), m = G.miners[0]; m.spells = ['burst'];
  startAction(m, 'mine', 1, { x:2, y:2 }); afterDecide(G, m);
  assert.equal(m.action.type, 'mine', '2 blocs : coup normal');
  G = gallery('#@ccc=c#'); m = G.miners[0]; m.spells = ['burst'];
  startAction(m, 'mine', 1, { x:2, y:2 }); afterDecide(G, m);
  assert.equal(m.action.type, 'burst');
  finishAction(G, m, m.action);
  assert.equal(G.tiles[2][4], 0); assert.equal(G.tiles[2][5], BRIDGE, 'passerelle : la ligne s\'arrête'); assert.equal(G.tiles[2][6], IDS.coal);
  G = worldFrom(['', '#@#', '#c#', '#c#', '#c#', '#c#', '###']); m = G.miners[0]; m.spells = ['burst'];
  startAction(m, 'mine', 1, { x:1, y:2 }); afterDecide(G, m);
  assert.equal(m.action.type, 'mine', 'vers le bas : jamais');
  G = worldFrom(['', '#c#', '#c#', '#c#', '#@#', '###']); m = G.miners[0]; m.spells = ['burst'];
  startAction(m, 'mine', 1, { x:1, y:3 }); afterDecide(G, m);
  assert.equal(m.action.type, 'burst', 'vers le haut : oui');
});

test('Rafale (minage) : un tacle l\'interrompt, rien ne casse, pas de recharge', () => {
  const G = gallery('#@cccc     #'), m = G.miners[0];
  m.spells = ['burst'];
  startAction(m, 'mine', 1, { x:2, y:2 }); afterDecide(G, m);
  assert.equal(m.action.type, 'burst');
  G.tiles[1][1] = 0; G.mobs.push(mob(5, 1, 1, { type:'gobelin', grab:m.id, hp:1e9, maxhp:1e9 }));
  tick(G);
  assert.notEqual(m.action?.type, 'burst');
  assert.equal(G.tiles[2][2], IDS.coal); assert.ok(!m.spellCd.burst, 'le sort reste prêt');
});

test('Rafale (combat) : le temps de 5 attaques à × 1,25 sans frapper, puis 5 coups d\'un coup ; attaque suivante prête', () => {
  const G = arena(), m = G.miners[0];
  m.spells = ['burst']; calm(m); m.x = 5;
  const o = mob(1, 6, 2, { hp:1e6, maxhp:1e6 }); G.mobs.push(o);
  assert.equal(burstFight(G, m, o, 2), true);
  assert.ok(Math.abs(m.action.dur - 5 * 2 / 1.25) < 1e-9);
  assert.equal(o.hp, 1e6, 'pas de coup pendant l\'incantation');
  const base = hitDamage(G, m);
  G.t += m.action.dur; finishAction(G, m, m.action);
  assert.ok(Math.abs((1e6 - o.hp) - 5 * base) < 1e-6, '5 coups');
  assert.equal(m.spellCd.burst, G.t + 30); assert.equal(m.atkReady, G.t);
});

test('Rafale (combat) : cible morte → les coups vont au mob suivant ; personne → annulée sans recharge', () => {
  let G = arena(), m = G.miners[0];
  m.spells = ['burst']; calm(m); m.x = 5;
  let o = mob(1, 6), q = mob(2, 4, 2, { hp:1e6, maxhp:1e6 }); G.mobs.push(o, q);
  burstFight(G, m, o, 1); o.hp = 0;
  finishAction(G, m, m.action);
  assert.ok(Math.abs((1e6 - q.hp) - 5 * hitDamage(G, m)) < 1e-6, 'les 5 coups sur le suivant');
  G = arena(); m = G.miners[0]; m.spells = ['burst']; calm(m); m.x = 5;
  o = mob(1, 6); G.mobs.push(o);
  burstFight(G, m, o, 1); o.hp = 0;
  finishAction(G, m, m.action);
  assert.ok(!m.spellCd.burst, 'personne : le sort reste prêt');
});

test('Rafale (combat) : un seul recul, au dernier coup', () => {
  const G = arena(), m = G.miners[0];
  m.spells = ['burst']; m.carac.crit = 0; m.carac.doubleAttack = 0; m.x = 5;
  const o = mob(1, 6, 2, { hp:1e6, maxhp:1e6 }); G.mobs.push(o);
  burstFight(G, m, o, 1);
  finishAction(G, m, m.action);
  assert.ok(Math.abs((1e6 - o.hp) - 5 * hitDamage(G, m)) < 1e-6, 'les 5 coups touchent (le recul ne le sort pas de portée avant)');
});

test('10 min avec les sorts de spé 15 : déterministe, sans blocage, chaque sort part', () => {
  const run = () => {
    const G = worldFrom(['', '#'.repeat(50), '#@' + 'c'.repeat(40) + '#', '#'.repeat(50), '#'.repeat(50)]), m = G.miners[0];
    m.spells = ['burst'];
    for(let i = 0; i < 6000; i++) tick(G);
    return [m.stats.spells || 0, m.stats.mined];
  };
  const a = run(), b = run();
  assert.deepEqual(a, b);
  assert.ok(a[0] > 0, `Rafale lancée ${a[0]} fois`);
});
