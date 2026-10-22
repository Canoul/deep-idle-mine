/* Jugement (concept Ange vs Démon) : jauges globales, ouverture des tours, « déjà fait » par ouverture. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUDGMENT } from '../src/config.js';
import { createJudgment, sanitizeJudgment, addResidues, refresh, isOpen, publicJudgment, markDone, hasDone } from '../src/meta/judgment.js';

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

test('les deux tours peuvent être ouvertes en même temps', () => {
  const j = createJudgment();
  addResidues(j, { [A]: CAP, [D]: CAP }, 0);
  assert.equal(isOpen(j, 'angel', 1), true); assert.equal(isOpen(j, 'demon', 1), true);
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
  assert.deepEqual(v.sides.angel, { count: 0, cap: CAP, open: true, openUntil: OPEN, done: true });
  assert.deepEqual(v.sides.demon, { count: 7, cap: CAP, open: false, openUntil: 0, done: false });
  assert.equal(v.now, 1000);
});
