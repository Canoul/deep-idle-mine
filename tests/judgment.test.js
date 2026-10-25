/* Jugement (concept Ange vs Démon) : jauges globales, ouverture des tours, « déjà fait » par ouverture. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUDGMENT, IDS, BLOCKS, TREASURE_BLOCK } from '../src/config.js';
import { isTarget } from '../src/sim/world.js';
import { targetVal, setFocus } from '../src/sim/focus.js';
import { decide } from '../src/sim/ai.js';
import { updateLight } from '../src/sim/light.js';
import { worldFrom } from './helpers.js';
import { createJudgment, sanitizeJudgment, addResidues, refresh, isOpen, publicJudgment, markDone, hasDone, paused, anyOpen, setCount } from '../src/meta/judgment.js';

const H = 3600e3, CAP = JUDGMENT.cap, OPEN = JUDGMENT.openHours * H;
const A = JUDGMENT.sides.angel.item, D = JUDGMENT.sides.demon.item;

test('jauges : les résidus du sac s\'ajoutent à leur sorte, le reste est ignoré', () => {
  const j = createJudgment();
  assert.equal(addResidues(j, { [A]: 3, [D]: 2, 'Pierre': 50 }, 0), true);
  assert.equal(j.angel.count, 3); assert.equal(j.demon.count, 2);
  assert.equal(addResidues(j, { 'Fer': 4 }, 0), false, 'rien à ajouter : pas de changement');
  assert.equal(addResidues(j, { [A]: -5, [D]: 1.5, [A + 'x']: 9 }, 0), false, 'quantités invalides ignorées');
});

test('jauge pleine : la tour ouvre pour 6 h, la jauge repart de 0 (surplus perdu) et se remplit pendant l\'ouverture', () => {
  const j = createJudgment(), t0 = 1_000_000;
  addResidues(j, { [A]: CAP - 1 }, t0);
  assert.equal(isOpen(j, 'angel', t0), false);
  addResidues(j, { [A]: 5 }, t0 + 10);
  assert.equal(isOpen(j, 'angel', t0 + 10), true);
  assert.equal(j.angel.openUntil, t0 + 10 + OPEN);
  assert.equal(j.angel.opening, 1);
  assert.equal(j.angel.count, 0, 'surplus perdu');
  assert.equal(isOpen(j, 'demon', t0 + 10), false, 'l\'autre jauge ne bouge pas');
  addResidues(j, { [A]: 40 }, t0 + 20);
  assert.equal(j.angel.count, 40, 'elle se remplit pendant l\'ouverture');
  assert.equal(isOpen(j, 'angel', t0 + 10 + OPEN), false, 'fermée au bout de 6 h');
});

test('pleine pendant une ouverture : bloquée à 250, la tour rouvre à la fin de l\'ouverture en cours', () => {
  const j = createJudgment();
  addResidues(j, { [A]: CAP }, 0);
  addResidues(j, { [A]: CAP + 30 }, H);
  assert.equal(j.angel.count, CAP); assert.equal(j.angel.opening, 1, 'pas de nouvelle ouverture tant que la tour est ouverte');
  assert.equal(refresh(j, OPEN - 1), false);
  assert.equal(refresh(j, OPEN + 5), true, 'à la fin : nouvelle ouverture');
  assert.equal(j.angel.opening, 2); assert.equal(j.angel.count, 0); assert.equal(j.angel.openUntil, OPEN + 5 + OPEN);
});

test('une tour à la fois (23/10) : l\'autre jauge est en pause pendant l\'ouverture, puis reprend', () => {
  const j = createJudgment();
  addResidues(j, { [A]: CAP, [D]: CAP }, 0);
  assert.equal(isOpen(j, 'angel', 1), true); assert.equal(isOpen(j, 'demon', 1), false, 'pleines en même temps : une seule ouvre');
  assert.equal(j.demon.count, CAP, 'la pleine attend');
  assert.equal(paused(j, 'demon', 1), true); assert.equal(paused(j, 'angel', 1), false);
  assert.equal(anyOpen(j, 1), true); assert.equal(anyOpen(j, OPEN + 1), false);
  /* pendant l'ouverture de l'Ange : les résidus démoniaques ne comptent pas, les angéliques si */
  const k = createJudgment();
  addResidues(k, { [A]: CAP }, 0);
  assert.equal(addResidues(k, { [D]: 40, [A]: 5 }, H), true);
  assert.equal(k.demon.count, 0, 'jauge du Démon en pause'); assert.equal(k.angel.count, 5);
  /* fermeture de l'Ange : la jauge du Démon reprend ; une jauge pleine en attente ouvre à ce moment */
  addResidues(k, { [D]: 12 }, OPEN + 1);
  assert.equal(k.demon.count, 12);
  refresh(j, OPEN + 1);
  assert.equal(isOpen(j, 'demon', OPEN + 2), true, 'le Démon ouvre quand l\'Ange ferme'); assert.equal(isOpen(j, 'angel', OPEN + 2), false);
});

test('pause (25/10, Geoffrey) : à 100 quand l\'Ange ouvre, le Démon est toujours à 100 à la fermeture, et vice versa', () => {
  for(const [open, other, item, otherItem] of [['angel', 'demon', A, D], ['demon', 'angel', D, A]]){
    const j = createJudgment();
    addResidues(j, { [otherItem]: 100 }, 0);
    addResidues(j, { [item]: CAP }, 0);
    assert.equal(isOpen(j, open, 1), true);
    addResidues(j, { [otherItem]: 60 }, H);                              // versés pendant la pause : ignorés
    assert.equal(j[other].count, 100, `${other} en pause : ne bouge pas`);
    refresh(j, OPEN + 1);
    assert.equal(isOpen(j, open, OPEN + 1), false);
    assert.equal(j[other].count, 100, `${other} à la fermeture : toujours 100, pas d'ouverture`);
    assert.equal(isOpen(j, other, OPEN + 1), false);
    addResidues(j, { [otherItem]: 5 }, OPEN + 2);
    assert.equal(j[other].count, 105, 'reprend depuis 100');
  }
});

test('setCount (administration) : règle une jauge, même en pause ; pleine, la tour ouvre ; valeurs invalides refusées', () => {
  const j = createJudgment();
  assert.equal(setCount(j, 'demon', 175, 0), true);
  assert.equal(j.demon.count, 175); assert.equal(isOpen(j, 'demon', 1), false);
  addResidues(j, { [A]: CAP }, 0);                                       // l'Ange ouvre : le Démon en pause
  assert.equal(setCount(j, 'demon', 150, H), true);
  assert.equal(j.demon.count, 150, 'réglable même en pause');
  for(const [side, n] of [['demon', -1], ['demon', 1.5], ['demon', CAP + 1], ['demon', '10'], ['demon', NaN], ['diable', 10], [undefined, 10]])
    assert.equal(setCount(j, side, n, H), false, `${side} ${n}`);
  assert.equal(j.demon.count, 150, 'refus : rien ne change');
  const k = createJudgment();
  assert.equal(setCount(k, 'angel', CAP, 0), true);
  assert.equal(isOpen(k, 'angel', 1), true, 'pleine : la tour ouvre'); assert.equal(k.angel.count, 0);
});

test('« déjà fait » : par compte et par ouverture ; une nouvelle ouverture efface la liste', () => {
  const j = createJudgment();
  addResidues(j, { [A]: CAP }, 0);
  assert.equal(hasDone(j, 'angel', 'K1'), false);
  assert.equal(markDone(j, 'angel', 'K1'), true);
  assert.equal(markDone(j, 'angel', 'K1'), false, 'une seule fois');
  assert.equal(hasDone(j, 'angel', 'K1'), true); assert.equal(hasDone(j, 'demon', 'K1'), false);
  addResidues(j, { [A]: CAP }, H); refresh(j, OPEN + 1);
  assert.equal(hasDone(j, 'angel', 'K1'), false, 'nouvelle ouverture : on peut la refaire');
});

test('relecture : un état abîmé ou trafiqué redevient valide', () => {
  assert.deepEqual(sanitizeJudgment(null), createJudgment());
  const j = sanitizeJudgment({ angel: { count: 9e9, openUntil: 'x', opening: -2 }, demon: { count: 12.7 },
                               done: { angel: { opening: 0, accounts: ['K1', 3, 'K1'] } }, hack: 1 });
  assert.equal(j.angel.count, CAP); assert.equal(j.angel.openUntil, 0); assert.equal(j.angel.opening, 0);
  assert.equal(j.demon.count, 12);
  assert.deepEqual(j.done.angel.accounts, ['K1']);
  assert.equal(j.hack, undefined);
});

test('vue publique : compte, cap, ouvert, temps restant, déjà fait pour ce joueur', () => {
  const j = createJudgment();
  addResidues(j, { [A]: CAP, [D]: 7 }, 0); markDone(j, 'angel', 'K1');
  const v = publicJudgment(j, 1000, 'K1');
  assert.deepEqual(v.sides.angel, { count: 0, cap: CAP, open: true, openUntil: OPEN, done: true, paused: false });
  assert.deepEqual(v.sides.demon, { count: 7, cap: CAP, open: false, openUntil: 0, done: false, paused: true });
  assert.equal(v.residues, false, 'une tour ouverte : pas de résidus dans les mines');
  assert.equal(v.now, 1000);
});

/* ---------- résidus dans la mine : visés par l'IA comme un treasure (22/10/2026) ---------- */

const RES = [IDS.residueAngel, IDS.residueDemon];
/* galerie éclairée : mineur en (3,2), charbon en (1,2), un résidu au bout en (7,2) */
function gallery(t){
  const G = worldFrom(['', 'd'.repeat(50), '#c @   ##', '#########']);
  G.tiles[2][7] = t;
  G.torches.push({ x:3, y:2 }); updateLight(G);
  return G;
}

test('résidus : cibles de l\'IA, au même poids que le treasure (même en focus « Uniquement »)', () => {
  const m = { prefs:{ focus:{} } };
  for(const t of RES){
    assert.ok(isTarget(t));
    assert.equal(targetVal(m, t), BLOCKS[TREASURE_BLOCK].val);
  }
  m.prefs.focus = { iron:'only' };
  for(const t of RES) assert.equal(targetVal(m, t), BLOCKS[TREASURE_BLOCK].val, 'pas un minerai : jamais ignoré');
});

test('IA : un résidu découvert est visé, même face à un charbon plus proche', () => {
  for(const t of RES){
    const G = gallery(t), m = G.miners[0];
    decide(G, m);
    assert.deepEqual(m.target, { x:7, y:2 });
    assert.equal(m.status, 'Va chercher un résidu');
  }
});

test('IA : un résidu non découvert n\'attire pas le mineur', () => {
  const G = gallery(IDS.residueAngel), m = G.miners[0];
  G.seen[2][7] = 0;
  decide(G, m);
  assert.notDeepEqual(m.target, { x:7, y:2 });
});

test('mine lancée pendant une ouverture (23/10) : aucun résidu (record.residues = false) ; même seed sinon identique', async () => {
  const { buildSession } = await import('../src/shared/game.js');
  const rec = residues => ({ id:'r', seed:77, players:[{ account:'K1', name:'Zoe' }], prefs:{}, looks:{}, gear:{}, skills:{}, bots:0, ...(residues === false ? { residues:false } : {}) });
  const { genArea } = await import('../src/sim/world.js');
  const on = buildSession(rec(true)), off = buildSession(rec(false));
  for(const G of [on, off]) while(G.unlockedAreas <= JUDGMENT.fromArea){ genArea(G, G.unlockedAreas); G.unlockedAreas++; }
  const n = G => G.tiles.reduce((s, row) => s + [...row].filter(t => RES.includes(t)).length, 0);
  assert.ok(n(on) > 0, `résidus sans tour ouverte : ${n(on)}`);
  assert.equal(n(off), 0, 'aucun résidu quand une tour était ouverte');
  assert.equal(off.noResidues, true); assert.equal(on.noResidues, false);
});

