/* Prison et énergie côté navigateur (29/10/2026) : textes de la barre du haut, du bandeau de la prison et du bilan
   d'absence (src/ui/prison.js), choix « Prison » du lobby (src/ui/lobby.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MINE_MODES, ENERGY, PRISON } from '../src/config.js';
import { energyText, energyPct, prisonBanner, awayText, hasAway, prisonActive, launchCostText } from '../src/ui/prison.js';
import { mineModes, prisonLaunchState } from '../src/ui/lobby.js';

const now = 1_800_000_000_000;

test('jauge d\'énergie : « 72 / 100 », arrondie ; rien sans valeur', () => {
  assert.equal(energyText({ value: 72, max: 100 }), '72 / 100');
  assert.equal(energyText({ value: 71.6, max: 100 }), '72 / 100', 'gardée au dixième, affichée arrondie');
  assert.equal(energyText(null), '—');
  assert.equal(energyPct({ value: 25, max: 100 }), 25);
  assert.equal(energyPct({ value: 140, max: 100 }), 100);
  assert.equal(energyPct(null), 0);
});

test('bandeau de la prison : run, minerais / seuil, énergie gagnée, pause dans …', () => {
  const p = { state: 'running', run: 4, mined: 61, goal: 80, energy: 12.4, waitAt: now + 23 * 3600e3 };
  const b = prisonBanner(p, now);
  assert.match(b, /Run 4/);
  assert.match(b, /61 \/ 80/);
  assert.match(b, /23 h/);
  assert.match(b, /pause dans/);
  assert.match(b, /\+12/, 'énergie gagnée en prison, arrondie');
  assert.match(prisonBanner({ ...p, waitAt: now + 25 * 60e3 }, now), /pause dans 25 min/, 'moins d\'une heure : en minutes');
  assert.match(prisonBanner({ ...p, state: 'waiting' }, now), /en pause/);
  assert.doesNotMatch(prisonBanner({ ...p, state: 'waiting' }, now), /pause dans/);
  const between = prisonBanner({ ...p, mined: null, goal: null }, now);
  assert.match(between, /Run 4/, 'entre deux runs (avancement inconnu) : pas de minerais');
  assert.doesNotMatch(between, /null|NaN|undefined/);
  assert.equal(prisonBanner(null, now), '');
  assert.equal(prisonBanner({ ...p, state: 'done' }, now), '');
});

test('bilan d\'absence : runs, ressources et énergie ; rien sans run', () => {
  const t = awayText({ runs: 14, energy: 112.4, bag: { Iron: 300, Coal: 34 } });
  assert.match(t, /^Pendant ton absence/);
  assert.match(t, /14 runs/);
  assert.match(t, /112/);
  assert.match(t, /334 ressources/);
  assert.match(awayText({ runs: 1, energy: 8, bag: {} }), /1 run[^s]/, 'singulier');
  assert.equal(awayText({ runs: 0 }), '');
  assert.equal(awayText(null), '');
  assert.equal(hasAway({ away: { runs: 2, energy: 0, bag: {} } }), true);
  assert.equal(hasAway({ away: { runs: 0, energy: 0, bag: {} } }), false);
  assert.equal(hasAway(null), false);
});

test('prison active : en cours ou en attente, pas terminée', () => {
  assert.equal(prisonActive({ state: 'running' }), true);
  assert.equal(prisonActive({ state: 'waiting' }), true);
  assert.equal(prisonActive({ state: 'done' }), false);
  assert.equal(prisonActive(null), false);
});

test('coût de la mine à côté de « Lancer » : « 6 à 12 ⚡ », depuis la config', () => {
  const t = launchCostText({ value: 72, max: 100 });
  assert.match(t, new RegExp(`${ENERGY.cost.min} à ${ENERGY.cost.max}`));
  assert.match(t, /⚡/);
  assert.match(launchCostText({ value: 3, max: 100 }), /pas assez/i, 'sous le minimum : prévenu (le serveur refuse)');
});

test('lobby : la Prison est proposée (solo), grisée dans un groupe de plusieurs', () => {
  assert.ok(MINE_MODES.some(m => m.prison && m.solo));
  const solo = mineModes('mine', false, null, false, 1).find(m => m.id === 'prison');
  assert.ok(solo, 'dans « Où miner »');
  assert.equal(solo.disabled, false);
  const group = mineModes('mine', false, null, false, 2).find(m => m.id === 'prison');
  assert.equal(group.disabled, true, 'groupe de plusieurs : grisée');
  assert.match(group.title, /seul/);
  assert.equal(mineModes('prison', false, null, false, 1).find(m => m.id === 'prison').on, true);
});

test('lobby : bouton de la prison (entrer, la voir quand elle tourne)', () => {
  const me = { id: 'AAAA1111' };
  assert.deepEqual(prisonLaunchState({ account: me, prison: null }), { can: true, label: '⛓ Entrer en prison', action: 'start' });
  assert.deepEqual(prisonLaunchState({ account: me, prison: { state: 'running' } }), { can: true, label: '⛓ Voir la prison', action: 'view' });
  assert.equal(prisonLaunchState({ account: me, prison: null, party: { members: [{}, {}] } }).can, false, 'groupe de plusieurs');
  assert.equal(prisonLaunchState({ account: me, prison: null, session: { id: 's' } }).can, false, 'en session');
  assert.equal(prisonLaunchState({ account: null, prison: null }).can, false);
  assert.equal(prisonLaunchState({ account: me, prison: null, busy: true }).can, false);
  assert.ok(PRISON.uiPoll > 0 && PRISON.uiPoll < PRISON.presentFor, 'le jeu ouvert reste « présent » pour le serveur');
});
