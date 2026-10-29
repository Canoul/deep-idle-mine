/* Prison et énergie côté navigateur (29/10/2026) : textes de la barre du haut, du bandeau de la prison et du bilan
   d'absence (src/ui/prison.js), choix « Prison » du lobby (src/ui/lobby.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MINE_MODES, ENERGY, PRISON } from '../src/config.js';
import { energyText, energyPct, prisonBanner, awayText, hasAway, prisonActive, launchCostText, launchPrisonText, readyPrisonText, prisonPollError } from '../src/ui/prison.js';
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

/* ---------- relecture finale : confirmations du groupe, sondage de la prison ---------- */

test('lancer (chef ou seul) : la confirmation nomme ce qui sera terminé (sa prison, celle des membres)', () => {
  const party = { members: [{ account: 'A', name: 'Zoe' }, { account: 'B', name: 'Max', prison: true }, { account: 'C', name: 'Lea', prison: true }, { account: 'D', name: 'Tom' }] };
  assert.equal(launchPrisonText({ mine: false, party: null, meId: 'A' }), '', 'rien à terminer : pas de question');
  assert.equal(launchPrisonText({ mine: false, party: { members: [{ account: 'A', name: 'Zoe' }, { account: 'D', name: 'Tom' }] }, meId: 'A' }), '');
  assert.match(launchPrisonText({ mine: true, party: null, meId: 'A' }), /^Lancer termine ta prison\./);
  const both = launchPrisonText({ mine: true, party, meId: 'A' });
  assert.match(both, /ta prison et la prison de Max et Lea/);
  assert.doesNotMatch(both, /Tom|Zoe/);
  assert.match(launchPrisonText({ mine: false, party: { members: [...party.members, { account: 'E', name: 'Eve', prison: true }] }, meId: 'A' }), /la prison de Max, Lea et Eve\./);
  assert.match(both, /pas ce que le mineur porte/);
  assert.equal(launchPrisonText({ mine: false, party: { members: [{ account: 'A', name: 'Zoe', prison: true }] }, meId: 'A' }), '', 'sa propre ligne : mine fait foi');
});

test('membre : « Je suis prêt » et « Prêt tout le temps » demandent confirmation si sa prison tourne', () => {
  assert.equal(readyPrisonText({ prison: null }), '');
  assert.equal(readyPrisonText({ prison: { state: 'done' } }), '');
  const t = readyPrisonText({ prison: { state: 'running' } });
  assert.match(t, /quand le chef lance, ta prison est terminée/);
  assert.match(t, /pas ce que le mineur porte/);
  assert.match(readyPrisonText({ prison: { state: 'waiting' }, always: true }), /^Prêt tout le temps/);
});

test('sondage de la prison : 401 → arrêt ; no_session → état relu ; autre erreur → recul doublé jusqu\'à uiPoll', () => {
  assert.deepEqual(prisonPollError({ status: 401, code: 'not_authenticated' }, 1), { action: 'stop' });
  assert.deepEqual(prisonPollError({ status: 404, code: 'no_session' }, 1), { action: 'refresh' });
  const d = n => prisonPollError(new Error('réseau'), n).delay;
  assert.equal(prisonPollError({ status: 500 }, 1).action, 'retry');
  assert.equal(d(1), PRISON.uiRetry);
  assert.equal(d(2), PRISON.uiRetry * 2);
  assert.equal(d(3), PRISON.uiRetry * 4);
  assert.equal(d(50), PRISON.uiPoll, 'plafonné');
  assert.ok(PRISON.uiRetry > 250, 'plus lent que la vue en direct');
});
