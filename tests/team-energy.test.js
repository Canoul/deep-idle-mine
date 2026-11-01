/* Énergie de chacun dans le panneau Équipe de la session (31/10/2026, Geoffrey) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENERGY } from '../src/config.js';
import { energyHTML, setTeamEnergies, teamEnergyHTML } from '../src/ui/energy-tag.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { fakeLive } from './helpers.js';

const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
const team = [{ account: A.id, name: 'Zoe' }, { account: B.id, name: 'Max' }];

function setup(){
  let now = 5_000_000;
  const store = createMemoryGameStore(), base = fakeLive(() => ({ shares: [] }));
  const liveRunner = o => { const live = base(o); live.view = async () => ({ tick: 1 }); return live; };
  const game = createGameService({ store, liveRunner, clock: () => now, randomSeed: () => 7 });
  return { store, game, advance: ms => { now += ms; } };
}

test('affichage : énergie du joueur, en rouge sous le coût minimal, rien si inconnue', () => {
  setTeamEnergies({ [A.id]: { value: 42, max: 100 }, [B.id]: { value: ENERGY.cost.min - 1, max: 100 } });
  assert.match(teamEnergyHTML(A.id), /⚡ 42\/100<\/span>$/);
  assert.doesNotMatch(teamEnergyHTML(A.id), /low/);
  assert.match(teamEnergyHTML(B.id), /fenergy low/);
  assert.equal(teamEnergyHTML('INCONNU'), '');
  setTeamEnergies(null);
  assert.equal(teamEnergyHTML(A.id), '');
  assert.match(energyHTML({ value: 10, max: 100 }), / · $/, 'Social garde son séparateur');
});

test('serveur : la vue d\'une session à plusieurs donne l\'énergie de chacun, seul : rien', async () => {
  const { game } = setup();
  await game.start(A, {}, team);
  const v = await game.view(A, null);
  assert.deepEqual(Object.keys(v.energies).sort(), [A.id, B.id].sort());
  for(const e of Object.values(v.energies)){ assert.ok(Number.isFinite(e.value)); assert.equal(e.max, ENERGY.max); }
  const solo = setup();
  await solo.game.start(A, {});
  assert.equal((await solo.game.view(A, null)).energies, undefined);
});

test('serveur : énergie relue au plus toutes les 30 s, pas à chaque vue', async () => {
  const { game, store, advance } = setup();
  await game.start(A, {}, team);
  let reads = 0;
  const get = store.getEnergy.bind(store);
  store.getEnergy = id => { reads++; return get(id); };
  await game.view(A, null); const first = reads;
  await game.view(A, null); await game.view(B, null);
  assert.equal(reads, first, 'dans les 30 s : aucune relecture');
  advance(30e3);
  await game.view(A, null);
  assert.ok(first > 0); assert.ok(reads > first, 'après 30 s : relu');
});
