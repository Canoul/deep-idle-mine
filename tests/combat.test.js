/* Combat dynamique dans la mine (25/10) : le mineur frappe à portée (0,5) et repousse le mob de 0,25 ; les deux
   reviennent au contact ; le tacle commence à portée, laisse le mineur bouger (seulement pour frapper) et dure jusqu'à
   la mort du mob, une provocation ou la soupape (5 s sans coup, plus de 6 cases) ; le minotaure repousse le mineur. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, COMBAT, MOBS } from '../src/config.js';
import { addDungeon } from '../src/sim/dungeon.js';
import { tackler } from '../src/sim/ai.js';
import { finishAction, landHit } from '../src/sim/actions.js';
import { worldFrom, run } from './helpers.js';

const corridor = (miners = 1) => worldFrom(['', 'd'.repeat(50), '#@' + ' '.repeat(40) + '#', '#'.repeat(50)], { miners });
const mob = (G, o) => { const x = { id: G.mobId++, type: 'bestiole', hp: 1e9, maxhp: 1e9, cd: 5, ...o }; G.mobs.push(x); return x; };
const hit = (G, m, o) => finishAction(G, m, { type: 'attack', data: { mob: o } });

test('coup du mineur : il repousse le mob de 0,25 ; verrou : pas de nouveau recul tant que le mob n\'est pas revenu à portée de tacle (25/10)', () => {
  const G = corridor(), m = G.miners[0];
  const b = mob(G, { x: m.x + 1, y: m.y, speed: 1e-9 });
  hit(G, m, b); assert.equal(b.kx, COMBAT.knock); assert.equal(b.knockLock, true);
  const hp = b.hp;
  hit(G, m, b); assert.equal(b.kx, COMBAT.knock, 'verrouillé : pas de recul'); assert.ok(b.hp < hp, 'mais le coup fait ses dégâts');
  b.x = m.x + 3; b.kx = 0; run(G, 1); assert.equal(b.knockLock, true, 'loin : toujours verrouillé');
  b.x = m.x + 1; run(G, 1); assert.equal(b.knockLock, false, 'revenu à portée de tacle : le verrou saute');
});

test('coup du mineur : hors de portée, le coup ne porte pas', () => {
  const G = corridor(), m = G.miners[0];
  const b = mob(G, { x: m.x + 2, y: m.y, kx: 0.25 });
  hit(G, m, b); assert.equal(b.hp, 1e9); assert.equal(b.kx, 0.25);
});

test('coup du mineur : un mob contre un mur reste sur place ; un mimic ne bouge jamais', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@ #', '#'.repeat(50)]), m = G.miners[0];
  const b = mob(G, { x: m.x + 1, y: m.y });
  for(let i = 0; i < 4; i++) hit(G, m, b);
  assert.equal(b.x, m.x + 1); assert.equal(b.kx, 0);
  const H = corridor(), n = H.miners[0];
  const k = mob(H, { type: 'mimic', revealed: true, x: n.x + 1, y: n.y });
  hit(H, n, k); assert.equal(k.kx ?? 0, 0);
});

test('combat réel : repoussé, le mob revient au contact ; le mineur le suit et le tue', () => {
  const G = corridor(), m = G.miners[0]; m.ox = 300;
  const b = mob(G, { x: m.x + 1, y: m.y, hp: 60, maxhp: 60, cd: 0 });
  const x0 = m.x; let far = 0, pushed = false;
  for(let i = 0; i < 600 && b.hp > 0; i++){
    run(G, 1);
    if(b.x + (b.kx || 0) > x0 + 1 + 1e-9) pushed = true;   // marche continue (25/10) : repoussé = décalé, même sans changer de case
    if(Math.abs(b.x - m.x) > 2) far++;
  }
  assert.ok(b.hp <= 0, 'il finit par le tuer');
  assert.ok(pushed, 'le mob a été repoussé au moins une fois');
  assert.equal(far, 0, 'ils ne se séparent jamais de plus de 2 cases');
});

test('tacle : il commence à portée (0,5), sans être collé', () => {
  const G = corridor(), m = G.miners[0];
  m.action = { type: 'wait', dur: 1e9, t: 0, data: {} };
  const b = mob(G, { x: m.x + 2, y: m.y, kx: -0.5 });
  run(G, 1);
  assert.equal(tackler(G, m), b);
});

test('tacle : il dure si le mob s\'éloigne sans être frappé ; un coup qui le repousse hors de SA portée le lui fait lâcher (25/10)', () => {
  const G = corridor(), m = G.miners[0]; m.ox = 300;
  const b = mob(G, { x: m.x + 1, y: m.y, cd: 1e9, speed: 1e-9 });   // immobile : seul le mineur bouge
  m.action = { type: 'wait', dur: 1e9, t: 0, data: {} };
  run(G, 1); assert.equal(tackler(G, m), b);
  b.x = m.x + 3; b.kx = 0;                                              // déplacé (pas un coup) : le tacle tient
  run(G, 1); assert.equal(tackler(G, m), b, 'toujours taclé');
  m.action = null; b.x = m.x + 1; b.kx = 0.5;                            // au bord de la portée (0,5)
  landHit(G, m, b);
  assert.ok(b.kx + (b.x - m.x - 1) > COMBAT.reach, 'repoussé hors de portée');
  assert.equal(tackler(G, m), null, 'il lâche le tacle');
});

test('tacle : soupape, il saute si le mineur ne peut pas le frapper pendant 5 s', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@ ' + ' '.repeat(10) + '#', '#'.repeat(50)]), m = G.miners[0];
  m.action = { type: 'wait', dur: 1e9, t: 0, data: {} };   // occupé pour toujours : il ne frappe jamais
  const b = mob(G, { x: m.x + 1, y: m.y, cd: 1e9, speed: 1e-9 });   // immobile
  b.grab = null; run(G, 1); assert.equal(tackler(G, m), b);
  m.action = { type: 'stun', dur: 1e9, t: 0, data: {} };
  b.x = m.x + 3;   // hors de portée : il ne pourra pas le reprendre tout de suite
  run(G, Math.round(COMBAT.tackleGiveUp / 0.1) - 5); assert.equal(tackler(G, m), b, 'avant 5 s : toujours taclé');
  run(G, 10);
  assert.equal(tackler(G, m), null, 'tacle levé');
});

test('tacle : soupape, il saute si le mob est à plus de 6 cases', () => {
  const G = corridor(), m = G.miners[0];
  const b = mob(G, { x: m.x + 1, y: m.y, cd: 1e9, speed: 1e-9 });   // immobile
  run(G, 1); assert.equal(tackler(G, m), b);
  b.x = m.x + COMBAT.tackleLeash + 1;
  run(G, 1); assert.equal(tackler(G, m), null);
});

test('gobelin : il vole encore toutes les 2 s de tacle, même repoussé à 2 cases', () => {
  const G = corridor(), m = G.miners[0];
  m.inv = { Charbon: 10 }; m.load = 10; m.action = { type: 'stun', dur: 1e9, t: 0, data: {} };
  const g = mob(G, { type: 'gobelin', x: m.x + 1, y: m.y, cd: 1e9 });
  run(G, 1); assert.equal(tackler(G, m), g);
  g.x = m.x + 2;   // hors de portée, toujours taclé
  run(G, Math.round(MOBS.goblinStealEvery / 0.1) * 2);
  assert.equal(tackler(G, m), g);
  assert.ok(m.inv.Charbon <= 8, 'au moins 2 vols');
});

test('minotaure : il repousse le mineur de 0,25 par coup (1 par seconde) ; résistance 100 % : rien', () => {
  for(const res of [0, 100]){
    const G = worldFrom(['', ...Array(24).fill('#'.repeat(W))]);
    const d = addDungeon(G, { x0:5, y0:6, side:'R', hy:13 }), boss = G.mobs.find(o => o.id === d.boss);
    const m = G.miners[0]; m.ox = 1e9; m.carac.knockRes = res;
    m.x = boss.x + 1; m.y = boss.y; m.scaredIn = d.id; m.scaredUntil = 0; boss.cd = 1e9;   // il ne marche pas
    m.action = { type: 'stun', dur: 1e9, t: 0, data: {} };   // il ne riposte pas
    run(G, 1); assert.equal(boss.grab, m.id);
    run(G, Math.round(MOBS.hitEvery / 0.1) + 1);
    if(res) assert.equal(m.kx ?? 0, 0, 'il résiste');
    else assert.equal(m.kx, MOBS.knock.minotaure, 'poussé de 0,25, du côté opposé au minotaure');
    assert.ok(m.stats.knocked >= 1);
  }
});

test('affichage : le décalage du recul part au navigateur (mineur et mob)', async () => {
  const { createViewer } = await import('../src/shared/view.js');
  const G = corridor(), m = G.miners[0];
  const b = mob(G, { x: m.x + 1, y: m.y });
  hit(G, m, b); m.kx = -0.25;
  const v = createViewer(G)();
  assert.equal(v.mobs.find(o => o.id === b.id).kx, COMBAT.knock);
  assert.equal(v.miners[0].kx, -0.25);
});
