/* Gallianix (23/10/2026, Geoffrey) : canard de la surface. Naît à chaque area débloquée, pseudo pris dans l'ordre de
   la liste (en boucle), se promène autour du coffre sans tomber dans la mine, ne tacle pas, 50 PV, 25 % de Fragment
   de cœur (dans le sac du mineur, donc au coffre commun). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUCK, CHEST_X, W, XP, ITEMS, TEXTURES, MOBS } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { tryUnlock, unlockNeed } from '../src/sim/world.js';
import { updateMobs, MOB_TYPES } from '../src/sim/mobs.js';
import { killMob } from '../src/sim/actions.js';
import { duckName } from '../src/sim/duck.js';
import { existsSync } from 'node:fs';

/* débloque l'area suivante (seuil atteint d'office) */
const unlock = G => { const a = G.areas[G.unlockedAreas - 1]; a.oreMined = unlockNeed(a); assert.ok(tryUnlock(G)); };
const ducks = G => G.mobs.filter(o => o.type === DUCK.type && o.hp > 0);
const run = (G, s) => { for(let i = 0; i < s * 10; i++) updateMobs(G); };

test('config : 50 PV, la liste du créateur, 25 % de Fragment de cœur ; hors des tirages d\'apparition', () => {
  assert.equal(DUCK.hp, 50);
  assert.deepEqual(DUCK.names, ['Cuiseuse de sperme', 'Roxanne', 'La brésilienne', 'La thaïlandaise']);
  assert.deepEqual([DUCK.heart.item, DUCK.heart.chance], ['Fragment de cœur', 0.25]);
  assert.equal(ITEMS['Fragment de cœur'].cat, 'material');
  assert.ok(!MOB_TYPES.includes(DUCK.type) && !Object.hasOwn(MOBS.hpBase, DUCK.type));
  assert.equal(XP.mob[DUCK.type], 5);
  for(const t of [DUCK.tex, DUCK.heart.tex]) assert.ok(TEXTURES.includes(t) && existsSync(`textures/${t}.png`), t);
});

test('naissance : aucun au lancement, un par area débloquée, près du coffre, à la surface', () => {
  const G = newSession(5, { miners: 1 });
  run(G, 1);
  assert.equal(ducks(G).length, 0, 'pas de canard pour l\'area 0');
  unlock(G); run(G, 0.1);
  assert.equal(ducks(G).length, 1);
  unlock(G); run(G, 0.1);
  const d = ducks(G);
  assert.equal(d.length, 2);
  for(const o of d){ assert.equal(o.y, 0); assert.ok(Math.abs(o.x - CHEST_X) <= DUCK.range); assert.equal(o.hp, 50); }
  assert.ok(G.log.some(l => String(l.msg ?? l).includes('Gallianix')));
});

test('pseudos : 1er canard = 1er nom, puis dans l\'ordre, et on recommence au 1er après le dernier', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(duckName), [...DUCK.names, DUCK.names[0], DUCK.names[1]]);
  const G = newSession(9, { miners: 1 });
  for(let i = 0; i < 5; i++){ unlock(G); run(G, 0.1); }
  assert.deepEqual(ducks(G).map(o => o.name), [...DUCK.names, DUCK.names[0]]);
});

test('promenade : reste dans sa zone, ne tombe jamais, saute un trou étroit, fait demi-tour devant un trou large', () => {
  const G = newSession(3, { miners: 1 });
  unlock(G); run(G, 0.1);
  const o = ducks(G)[0];
  /* trou de 2 cases à droite, trou de 6 cases à gauche */
  o.x = CHEST_X; o.dir = 1;
  for(const x of [CHEST_X + 1, CHEST_X + 2]) G.tiles[1][x] = 0;
  for(let x = CHEST_X - 7; x <= CHEST_X - 2; x++) G.tiles[1][x] = 0;
  const seen = new Set();
  let jumped = false;
  for(let i = 0; i < 6000; i++){
    updateMobs(G);
    assert.equal(o.y, 0, 'toujours à la surface');
    assert.ok(Math.abs(o.x - CHEST_X) <= DUCK.range, `dans sa zone (x=${o.x})`);
    assert.ok(G.tiles[1][o.x] > 0 || G.ladder[1][o.x], `posé sur du sol (x=${o.x})`);
    assert.equal(o.grab, null, 'ne tacle jamais'); assert.equal(o.chase, null, 'ne chasse personne');
    if(o.hop) jumped = true;
    seen.add(o.x);
  }
  assert.ok(jumped && seen.has(CHEST_X + 3), 'a sauté le petit trou');
  assert.ok(![...seen].some(x => x < CHEST_X - 7), 'n\'a pas franchi le grand trou');
});

test('les mineurs creusent sous lui : il s\'envole vers le sol le plus proche', () => {
  const G = newSession(4, { miners: 1 });
  unlock(G); run(G, 0.1);
  const o = ducks(G)[0];
  o.x = CHEST_X - DUCK.range;                                  // au bord de sa zone
  for(let x = o.x; x <= o.x + 6; x++) G.tiles[1][x] = 0;        // tout creusé sous lui et à côté
  run(G, DUCK.step + 0.2);
  assert.ok(G.tiles[1][o.x] > 0 || G.ladder[1][o.x], `reposé sur du sol (x=${o.x})`);
  assert.ok(Math.abs(o.x - CHEST_X) <= DUCK.range);
});

test('vaincu : 5 XP, un Fragment de cœur une fois sur 4 environ, dans le sac du mineur (coffre commun)', () => {
  let hearts = 0; const N = 2000;
  for(let i = 0; i < N; i++){
    const G = newSession(1000 + i, { miners: 1 }); unlock(G); run(G, 0.1);
    const m = G.miners[0], o = ducks(G)[0], xp = G.stats.xp;
    killMob(G, m, o);
    assert.equal(ducks(G).length, 0);
    assert.ok(G.stats.xp >= xp);
    hearts += m.inv['Fragment de cœur'] ?? 0;
    assert.ok((m.inv['Fragment de cœur'] ?? 0) <= 1, 'jamais plus d\'un');
  }
  assert.ok(Math.abs(hearts / N - 0.25) < 0.04, `fréquence ${hearts / N}`);
});

test('session complète : les mineurs le combattent sans se bloquer (même seed = même partie)', () => {
  const play = () => { const G = newSession(23757, { miners: 3 }); for(let i = 0; i < 9000; i++) tick(G); return G; };
  const A = play(), B = play();
  assert.deepEqual(A.mobs.map(o => [o.type, o.x, o.y, o.hp]), B.mobs.map(o => [o.type, o.x, o.y, o.hp]));
  assert.ok(A.unlockedAreas >= 2 && A.ducks >= 1, 'au moins un canard né');
  for(const o of ducks(A)) assert.equal(o.y, 0);
  assert.ok(W > 0);
});

/* fin de session (23/10) : un mineur qui attendrait au coffre va chasser le canard, s'il a le temps de revenir */
import { SESSION_LEN, DT } from '../src/config.js';
import { run as runTicks } from './helpers.js';
function endGame({ left = 40, duckX = CHEST_X + 4, fight = true } = {}){
  const G = newSession(11, { miners: 1 }), m = G.miners[0];
  G.ticks = Math.round((SESSION_LEN - left) / DT); G.t = G.ticks * DT;
  G.mobs = [{ id: G.mobId++, type: DUCK.type, name: 'Roxanne', x: duckX, y: 0, hp: DUCK.hp, maxhp: DUCK.hp, cd: 99, dir: 1 }];
  m.x = CHEST_X; m.y = 0; m.mode = 'surface'; m.action = null; m.prefs = { ...m.prefs, fightMobs: fight };
  return { G, m, duck: G.mobs[0] };
}

test('fin de session : au lieu d\'attendre au coffre, il va tuer le canard, puis revient au coffre', () => {
  const { G, m, duck } = endGame();
  let chased = false;
  for(let i = 0; i < 300 && duck.hp > 0; i++){ runTicks(G, 1); if(m.status.includes('Gallianix')) chased = true; }
  assert.ok(chased, 'il le chasse');
  assert.ok(duck.hp <= 0, 'canard vaincu');
  assert.equal(m.y, 0, 'jamais tombé dans la mine');
  runTicks(G, 100);
  assert.equal(m.x, CHEST_X, 'revenu au coffre');
  assert.equal(m.load, 0, 'ce qu\'il a lâché est déposé');
});

test('fin de session : pas de chasse sans le temps de revenir, en « Ignorer », ou de l\'autre côté d\'un trou', () => {
  for(const [why, opts, prep] of [
    ['trop tard', { left: 10 }, null],
    ['Ignorer', { fight: false }, null],
    ['trou', {}, G => { G.tiles[1][CHEST_X + 2] = 0; G.tiles[2][CHEST_X + 2] = 0; }],
  ]){
    const { G, m, duck } = endGame(opts);
    prep?.(G);
    runTicks(G, 50);
    assert.equal(m.x, CHEST_X, why);
    assert.equal(duck.hp, DUCK.hp, why);
  }
});
