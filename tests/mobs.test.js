/* Mobs (21/10) : tacle à 1 case (un mineur par mob), mimic qui tacle et ne se mine pas, occultiste (téléportation,
   canalisation qui étourdit, provocation), aide aux alliés (état « combat » de la session). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, IDS, CFG, mobHp } from '../src/config.js';
import { tackler, compassScan } from '../src/sim/ai.js';
import { channeler, updateMobs, provoke } from '../src/sim/mobs.js';
import { killMob, mineBlock } from '../src/sim/actions.js';
import { search } from '../src/sim/path.js';
import { worldFrom, run } from './helpers.js';
import { mulberry32 } from '../src/core/rng.js';

const corridor = (miners = 1) => worldFrom(['', 'd'.repeat(50), '#@' + ' '.repeat(40) + '#', '#'.repeat(50)], { miners });
const mob = (G, o) => { const x = { id: G.mobId++, hp: 1e9, maxhp: 1e9, cd: 5, ...o }; G.mobs.push(x); return x; };
const busy = m => { m.action = { type: 'wait', dur: 1e9, t: 0, data: {} }; };
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

test('PV : formules du créateur (k = area où naît le mob)', () => {
  assert.equal(mobHp('bestiole', 0), 50); assert.equal(mobHp('mimic', 3), Math.round(50 * 1.15 ** 3));
  assert.equal(mobHp('gobelin', 1), 100); assert.equal(mobHp('gobelin', 5), Math.round(100 * 1.15 ** 4));
  assert.equal(mobHp('occultiste', 4), 100); assert.equal(mobHp('occultiste', 5), 115);
});

test('tacle : à 1 case du mineur, le mob s\'arrête à côté de lui et l\'immobilise', () => {
  const G = corridor(), m = G.miners[0]; busy(m);
  const b = mob(G, { type: 'bestiole', x: m.x + 4, y: m.y, cd: 0 });
  run(G, 60);
  assert.equal(dist(b, m), 1, 'il s\'arrête à côté (pas sur lui)');
  assert.equal(tackler(G, m), b);
  assert.equal(G.combat, true, 'état « combat » de la session');
});

test('tacle : un seul mineur par mob', () => {
  const G = corridor(2), [a, c] = G.miners;
  a.x = 4; c.x = 6; busy(a); busy(c);
  const b = mob(G, { type: 'bestiole', x: 5, y: a.y });
  run(G, 1);
  assert.ok([tackler(G, a), tackler(G, c)].filter(Boolean).length === 1, 'un seul des deux est taclé');
  assert.equal(tackler(G, a), b, 'le premier de la liste à égalité');
});

test('mimic : il ne se mine pas, il se dévoile, tacle le mineur à côté et se combat ; butin 3 minerais', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@c' + ' '.repeat(40) + '#', '#'.repeat(50)]), m = G.miners[0];
  const o = mob(G, { type: 'mimic', x: m.x + 1, y: m.y, ore: IDS.coal, revealed: false, hp: 20, maxhp: 20 });
  mineBlock(G, m, o.x, o.y);
  assert.equal(o.revealed, true); assert.equal(G.tiles[o.y][o.x], IDS.coal, 'la roche ne bouge pas');
  assert.ok(G.mimicCells.has(o.y * 50 + o.x));
  assert.ok(!compassScan(G, m, 8).some(p => p.x === o.x && p.y === o.y), 'plus un minerai pour l\'IA');
  const r = search(G, m, m.x, m.y, true, null);
  assert.equal(r.dist[o.y * 50 + o.x], Infinity, 'on ne creuse pas dans un mimic dévoilé');
  m.ox = 300; run(G, 1);
  assert.equal(tackler(G, m), o, 'il tacle le mineur à côté');
  run(G, 100);
  assert.equal(o.hp <= 0, true, 'vaincu à l\'arme');
  assert.equal(m.inv.Charbon, MOBS.mimicLoot); assert.equal(G.tiles[o.y][o.x], 0);
  assert.ok(!G.mimicCells.has(o.y * 50 + o.x));
});

test('occultiste : sort prêt → téléportation à 3 cases (sans miner) et canalisation : la cible est étourdie 5 s', () => {
  const G = corridor(), m = G.miners[0]; m.ox = 300;
  G.rng = mulberry32(3);
  const o = mob(G, { type: 'occultiste', x: m.x + 8, y: m.y, cast: 0.05, hp: 1e9, maxhp: 1e9 });
  run(G, 1);
  assert.ok(o.channel, 'il canalise'); assert.equal(dist(o, m), MOBS.occult.tpDist, 'à 3 cases');
  assert.equal(channeler(G, m), o);
  const x0 = o.x, ticks = Math.round(MOBS.occult.channel / 0.1);
  for(let i = 0; i < ticks - 1; i++){
    run(G, 1);
    assert.equal(m.action?.type, 'stun', `étourdi (tick ${i})`);
    assert.equal(o.x, x0, 'il ne bouge pas pendant la canalisation'); assert.equal(o.grab, null, 'il ne tacle pas');
  }
  run(G, 2);
  assert.equal(o.channel, null, 'fin après 5 s'); assert.equal(channeler(G, m), null);
  assert.equal(m.stats.hexed, 1);
  assert.ok(Math.abs(o.cast - (MOBS.occult.cooldown - MOBS.occult.channel)) < 0.25, `prochain sort dans ~10 s (${o.cast})`);
});

test('occultiste : pas de case possible à 2-4 cases → pas de sort (jamais au contact)', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@ #', '#'.repeat(50)]), m = G.miners[0];
  const o = mob(G, { type: 'occultiste', x: m.x + 1, y: m.y, cast: 0, hp: 1e9, maxhp: 1e9 });
  updateMobs(G);
  assert.equal(o.channel ?? null, null); assert.equal(o.grab, m.id, 'il tacle au contact');
});

test('occultiste provoqué : la canalisation s\'arrête tout de suite (la cible est libérée) et il ne relance plus son sort', () => {
  const G = corridor(2), [a, b] = G.miners; a.x = 10; b.x = 30; b.ox = a.ox = 300;
  const o = mob(G, { type: 'occultiste', x: 20, y: a.y, cast: 0.05, hp: 1e9, maxhp: 1e9 });
  run(G, 1);
  const target = G.miners.find(m => m.id === o.channel?.target); assert.ok(target);
  const other = target === a ? b : a;
  provoke(G, o, other);
  assert.equal(o.channel, null); assert.equal(channeler(G, target), null, 'libéré');
  o.cast = 0; run(G, 300);
  assert.equal(o.channel, null, 'plus jamais de sort');
  assert.equal(target.stats.hexed, 1);
});

test('occultiste vaincu : 1 à 3 Tissu sombre', () => {
  const G = corridor(), m = G.miners[0]; const seen = new Set();
  G.rng = mulberry32(9);
  for(let i = 0; i < 300; i++){ m.inv = {}; const o = mob(G, { type: 'occultiste', x: 3, y: m.y }); killMob(G, m, o); seen.add(m.inv['Tissu sombre']); }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('Aider allié : il part tout de suite vers le mob qui a pris un allié en chasse, sauf les mobs qu\'il ignore', () => {
  const setup = ignore => {
    const G = corridor(2), [alice, bob] = G.miners;
    alice.x = 14; bob.x = 30; alice.ox = bob.ox = 300; busy(bob); bob.carac.damage = 0;   // Bob ne peut pas le tuer seul ; mob à 17 cases d'elle
    alice.prefs = { ...alice.prefs, helpAllies: true, helpIgnore: ignore, fightMobs: true };
    alice.carac.light = 2;   // le mob est hors de son champ de vision : elle n'y va que pour aider
    const b = mob(G, { type: 'bestiole', x: 31, y: bob.y, hp: 50, maxhp: 50 });
    return { G, alice, bob, b };
  };
  { const { G, alice, b } = setup([]);
    run(G, 40); assert.match(alice.status, /aide/i); assert.ok(alice.x > 18, `elle y va (x = ${alice.x})`);
    run(G, 400);
    assert.ok(b.hp <= 0, 'le mob est mort'); assert.ok(alice.stats.kills >= 1, 'c\'est elle qui l\'a tué');
    assert.equal(G.combat, false, 'plus de combat dans la session'); }
  { const { G, alice } = setup(['bestiole']);
    run(G, 20); assert.ok(!/aide/i.test(alice.status), `ignoré : elle n'y va pas (${alice.status})`); }
});

test('Aider allié désactivé : comportement de base (il ne bouge pas pour un mob hors de vue)', () => {
  const G = corridor(2), [alice, bob] = G.miners;
  alice.x = 5; bob.x = 30; alice.ox = bob.ox = 300; busy(bob); alice.carac.light = 2;
  mob(G, { type: 'bestiole', x: 31, y: bob.y, hp: 50, maxhp: 50 });
  run(G, 20);
  assert.ok(!/aide/i.test(alice.status));
});

test('Aider allié : jamais pendant le chantier du treuil (sinon il le reprend depuis la surface, en boucle)', () => {
  const G = corridor(2), [alice, bob] = G.miners;
  alice.x = 5; bob.x = 30; alice.ox = bob.ox = 300; busy(bob); bob.carac.damage = 0;
  alice.prefs = { ...alice.prefs, helpAllies: true }; alice.carac.light = 2;
  alice.winchJob = { bottom: 2 }; alice.mode = 'winch';
  mob(G, { type: 'bestiole', x: 31, y: bob.y, hp: 50, maxhp: 50 });
  run(G, 40);
  assert.ok(!/aide/i.test(alice.status), alice.status);
});

test('Aider allié : pas au-delà de HELP.range cases (le combat serait fini avant son arrivée)', () => {
  const G = corridor(2), [alice, bob] = G.miners;
  alice.x = 5; bob.x = 30; alice.ox = bob.ox = 300; busy(bob); bob.carac.damage = 0; alice.carac.light = 2;
  alice.prefs = { ...alice.prefs, helpAllies: true };
  mob(G, { type: 'bestiole', x: 31, y: bob.y, hp: 50, maxhp: 50 });
  run(G, 40);
  assert.ok(!/aide/i.test(alice.status), alice.status);
});

test('treuil : sorti du puits par un combat, le logisticien y retourne (au lieu de repartir de la surface)', () => {
  const shaft = '#'.repeat(25) + ' ' + '#'.repeat(24);
  const side  = '#'.repeat(22) + '    ' + '#'.repeat(24);   // galerie x 22 à 25 à la ligne 5
  const G = worldFrom(['', 'd'.repeat(25) + ' ' + 'd'.repeat(24), shaft, shaft, shaft, side, '#'.repeat(50)]), m = G.miners[0];
  m.x = 22; m.y = 5; m.ox = 300; m.mode = 'winch'; m.winchJob = { bottom: 40 }; m.winchDepth = 5;
  run(G, 30);
  assert.equal(m.mode, 'winch', `toujours en chantier (${m.status})`);
  assert.equal(m.x, 25, 'revenu dans le puits');
});
