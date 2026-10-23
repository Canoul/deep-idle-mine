/* Treuil (skill Logisticien, étape 2) : posé au milieu de la mine à chaque nouvelle area par le logisticien, il sert à
   tous (monter / descendre à 0,85 × la vitesse de montée, s'arrêter à n'importe quelle ligne). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WINCH, CFG, IDS, W } from '../src/config.js';
import { worldFrom, run } from './helpers.js';
import { supported, isWinch } from '../src/sim/world.js';
import { search } from '../src/sim/path.js';
import { stepDir, finishAction } from '../src/sim/actions.js';
import { winchT, climbT, baseLadderT } from '../src/sim/mineur.js';
import { createViewer, emptyView, applyView } from '../src/shared/view.js';

const X = WINCH.x;
const col = (ch, y) => ' '.repeat(X) + ch;            // une ligne avec ch dans la colonne du treuil
/* puits du treuil déjà creusé de la ligne 1 à `bottom`, dans la pierre */
function shaft(bottom, depth = bottom + 4){
  const G = worldFrom(['', ...Array.from({ length:depth }, () => '#'.repeat(W))]);
  for(let y = 1; y <= bottom; y++) G.tiles[y][X] = 0;
  G.winch = { x:X, bottom };
  return G;
}

test('config : au milieu de la mine, seau à 0,85 × la vitesse de montée', () => {
  assert.equal(X, Math.floor(W / 2)); assert.equal(WINCH.speedFactor, 0.85);
});

test('le puits du treuil tient le mineur à n\'importe quelle ligne (comme une échelle) ; il peut miner à côté', () => {
  const G = shaft(10), m = G.miners[0];
  m.x = X; m.y = 6;
  assert.ok(isWinch(G, X, 6) && supported(G, X, 6));
  run(G, 1);
  assert.equal(m.y, 6, 'il ne tombe pas');
  assert.ok(stepDir(G, m, 1, 0)); assert.equal(m.action.type, 'mine', 'il mine à droite depuis le seau');
});

test('monter / descendre dans le seau : pas d\'échelle à poser, 0,85 × la vitesse de montée', () => {
  const G = shaft(10), m = G.miners[0];
  m.x = X; m.y = 6;
  assert.ok(stepDir(G, m, 0, -1));
  assert.equal(m.action.type, 'move', 'pas d\'échelle');
  assert.ok(Math.abs(m.action.dur - winchT(G, m)) < 1e-9, 'durée du seau (obscurité comprise)');
  assert.ok(m.action.data.winch);
  assert.ok(Math.abs(winchT(G, m) - climbT(G, m) / 0.85) < 1e-9);
  m.action = null; assert.ok(stepDir(G, m, 0, 1)); assert.ok(m.action.data.winch, 'descente aussi');
});

test('itinéraire : le treuil est pris en compte (remonter de 40 cases par le seau, sans rien construire)', () => {
  const G = shaft(40), m = G.miners[0];
  m.x = X; m.y = 40;
  const r = search(G, m, X, 40, false, (x, y) => y === 0, Infinity, 1);
  assert.ok(r, 'chemin par l\'existant (build=false) : le treuil suffit');
  assert.ok(Math.abs(r.dist[r.n] - 40 / (m.carac.climbSpeed * 0.85)) < 1e-6, `coût ${r.dist[r.n]}`);
  /* et depuis une galerie à côté : il rejoint le puits puis monte */
  for(let x = X + 1; x <= X + 6; x++) G.tiles[30][x] = 0;
  const r2 = search(G, m, X + 6, 30, false, (x, y) => y === 0, Infinity, 1);
  assert.ok(r2);
});

test('échelle de 2 de haut : l\'itinéraire compte moitié moins d\'échelles à poser', () => {
  const G = shaft(1), m = G.miners[0];
  const base = baseLadderT(m);
  m.skill.tall_ladder = 1;
  assert.equal(baseLadderT(m), base / 2);
  m.skill.build_time = 0.15;
  assert.ok(Math.abs(baseLadderT(m) - CFG.ladderTime * 0.85 / 2) < 1e-12);
});

test('chantier : le logisticien creuse au milieu depuis la surface et pose tout le treuil d\'un coup, sans être étourdi', () => {
  const G = worldFrom(['', ...Array.from({ length:20 }, () => '#'.repeat(W))]), m = G.miners[0];
  m.x = X; m.y = 0; m.skill.winch = 1; m.skillTree = 'logisticien';
  for(let y = 6; y <= 10; y++){ G.tiles[y][X] = 0; G.seen[y][X] = 0; }   // poche cachée de 5 cases sur le chemin
  m.winchJob = { bottom:14 };
  m.mode = 'surface';
  for(let i = 0; i < 2000 && m.winchJob; i++) run(G, 1);
  assert.equal(m.winchJob, null, 'chantier fini');
  assert.deepEqual(G.winch, { x:X, bottom:14 });
  for(let y = 1; y <= 14; y++) assert.equal(G.tiles[y][X], 0, `puits creusé ligne ${y}`);
  assert.equal(m.stats.stuns, 0, 'pas étourdi en chantier');
});

test('déblocage d\'une area : seul le premier logisticien qui a le skill part installer le treuil', async () => {
  const { newSession } = await import('../src/sim/session.js');
  const { tryUnlock, areaTop } = await import('../src/sim/world.js');
  const G = newSession(3, { miners:3 });
  G.miners[1].skill.winch = 1; G.miners[2].skill.winch = 1;
  G.areas[0].oreMined = G.areas[0].oreTotal;
  assert.ok(tryUnlock(G));
  assert.equal(G.miners[0].winchJob, null);
  assert.deepEqual(G.miners[1].winchJob, { bottom:areaTop(1) });
  assert.equal(G.miners[2].winchJob, null);
});

test('affichage : le navigateur reçoit le treuil', () => {
  const G = shaft(10);
  const M = applyView(emptyView(), createViewer(G)(null), 0);
  assert.deepEqual(M.winch, { x:X, bottom:10 });
});
test('pose du treuil : le logisticien retire les échelles du puits, le treuil va de la surface jusqu\'en bas', () => {
  const G = worldFrom(['', ...Array.from({ length:20 }, () => '#'.repeat(W))]), m = G.miners[0];
  m.x = X; m.y = 0; m.skill.winch = 1; m.skillTree = 'logisticien';
  for(let y = 1; y <= 6; y++){ G.tiles[y][X] = 0; G.ladder[y][X] = 1; }   // un ancien puits avec ses échelles
  m.winchJob = { bottom:14 }; m.mode = 'surface';
  for(let i = 0; i < 3000 && m.winchJob; i++) run(G, 1);
  assert.deepEqual(G.winch, { x:X, bottom:14 });
  for(let y = 1; y <= 14; y++) assert.equal(G.ladder[y][X], 0, `plus d'échelle ligne ${y}`);
  assert.ok(G.log.some(l => /échelles? retirée/.test(l.msg)));
});

test('puits du treuil : on n\'y pose plus d\'échelle (même une échelle de 2 qui y dépasserait)', async () => {
  const { finishAction } = await import('../src/sim/actions.js');
  const G = worldFrom(['', ...Array.from({ length:12 }, () => '#'.repeat(W))]), m = G.miners[0];
  for(let y = 1; y <= 10; y++) G.tiles[y][X] = 0;
  G.winch = { x:X, bottom:8 };
  m.x = X; m.y = 5; finishAction(G, m, { type:'ladder', data:{} });
  assert.equal(G.ladder[5][X], 0);
  m.y = 9; m.skill.tall_ladder = 1; finishAction(G, m, { type:'ladder', data:{} });
  assert.equal(G.ladder[9][X], 1, 'sous le treuil : échelle normale');
  assert.equal(G.ladder[8][X], 0, 'la 2e case est dans le puits : pas d\'échelle');
});

test('départ du coffre : il prend la descente existante (treuil) au lieu de creuser un puits neuf près de la surface (seed 1250570735)', async () => {
  const { runSession } = await import('../src/sim/session.js');
  const { SKILLS } = await import('../src/config.js');
  const { sanitizeSkills, skillEffects, withSkillStats } = await import('../src/meta/skills.js');
  const give = (m, tree) => { const t = SKILLS.trees.find(x => x.id === tree);
    const st = sanitizeSkills({ tree, ranks:Object.fromEntries(t.nodes.map(n => [n.id, n.max])) });
    m.skill = { ...m.skill, ...skillEffects(st) }; m.skillTree = tree; m.carac = withSkillStats(m.carac, m.skill); };
  const fresh = [];
  let winchRides = 0;
  runSession(1250570735, { miners:3, onTick:(G, i) => {
    if(i === 0) G.miners.forEach((m, k) => give(m, SKILLS.trees[k % 3].id));   // mineur, logisticien, barbare
    if(G.t > 1200) return;
    for(const m of G.miners){
      if(G.winch && m.mode === 'work' && m.y > 0 && m.y <= 10 && m.status === 'Creuse vers le bas') fresh.push(`${m.name} t${Math.round(G.t)} x${m.x} y${m.y}`);
      if(m.skillTree !== 'logisticien' && isWinch(G, m.x, m.y)) winchRides++;
    }
  } });
  assert.deepEqual([...new Set(fresh.map(f => f.split(' ')[0]))], [], `puits neufs : ${fresh.slice(0, 3).join(', ')}`);
  assert.ok(winchRides > 300, `les autres prennent le seau (${winchRides} ticks)`);
});

test('prolonger le treuil : tombé à côté du puits (trou près de la surface), il le rejoint au lieu de remonter en boucle (seed 1209172417)', () => {
  const G = shaft(10, 24), m = G.miners[0];
  G.tiles[1][X - 1] = 0;                                   // trou juste à gauche du treuil, sous la surface
  G.tiles[1][X - 2] = 0; G.ladder[1][X - 2] = 1;           // une échelle à côté : il remonte par là, sans repasser au-dessus du trou
  m.x = X - 3; m.y = 0; m.skill.winch = 1; m.skillTree = 'logisticien';
  m.winchJob = { bottom:16 };
  m.mode = 'surface';
  let ups = 0, prev = m.y;
  for(let i = 0; i < 3000 && m.winchJob; i++){ run(G, 1); if(prev > 0 && m.y === 0) ups++; prev = m.y; }
  assert.equal(m.winchJob, null, 'chantier fini');
  assert.equal(G.winch.bottom, 16);
  assert.ok(ups <= 1, `remonté ${ups} fois à la surface pendant le chantier`);
});

test('premier treuil : la 1re case du puits déjà ouverte (combat dès l\'entrée), tombé à côté, il le rejoint au lieu de boucler (seed 39595)', () => {
  const G = worldFrom(['', ...Array.from({ length:24 }, () => '#'.repeat(W))]), m = G.miners[0];
  G.tiles[1][X] = 0;                                       // il est entré dans le puits, puis un combat l'en a sorti
  G.tiles[1][X - 1] = 0;                                   // trou juste à gauche
  G.tiles[1][X - 2] = 0; G.ladder[1][X - 2] = 1;           // il remonte par l'échelle d'à côté
  m.x = X - 3; m.y = 0; m.skill.winch = 1; m.skillTree = 'logisticien';
  m.winchJob = { bottom:12 }; m.winchDepth = null;
  m.mode = 'surface';
  let ups = 0, prev = m.y;
  for(let i = 0; i < 3000 && m.winchJob; i++){ run(G, 1); if(prev > 0 && m.y === 0) ups++; prev = m.y; }
  assert.equal(m.winchJob, null, 'chantier fini');
  assert.equal(G.winch.bottom, 12);
  assert.ok(ups <= 1, `remonté ${ups} fois à la surface pendant le chantier`);
});
