/* Bilan de fin de session (22/10) : le navigateur n'affiche que le résultat de la session qu'il vient de jouer.
   Bug : un bilan de tour jamais fermé (relance depuis le lobby) s'affichait à la fin de la mine suivante. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultChoice } from '../src/shared/game.js';

test('bilan : celui de la session attendue est affiché ; un plus ancien jamais vu est écarté ; rien → on attend', () => {
  assert.equal(resultChoice({ id:'mine-2', mode:'mine' }, 'mine-2'), 'show');
  assert.equal(resultChoice({ id:'tour-1', mode:'tower-demon' }, 'mine-2'), 'stale', 'la mine est encore en partage : pas son bilan');
  assert.equal(resultChoice(null, 'mine-2'), 'wait');
  assert.equal(resultChoice({ id:'tour-1' }, null), 'show', 'sans session attendue (page rechargée) : le bilan en attente s\'affiche');
});

test('bilan : le détail de ce que chacun portait encore à la fin (perdu)', async () => {
  const { newSession, endSession } = await import('../src/sim/session.js');
  const G = newSession(1, { miners:2 });
  G.miners[0].inv = { 'Cristal de pleine lune':4, Fer:12 };
  endSession(G);
  assert.deepEqual(G.summary.lostBags, [{ name:G.miners[0].name, items:{ 'Cristal de pleine lune':4, Fer:12 } }]);
  assert.deepEqual(G.summary.lost, [G.miners[0].name]);
});

/* 31/10/2026 : bilan de tour jamais affiché, depuis les correctifs du 30/10 (bilan « vu » dès qu'il s'affiche, seule la
   dernière session compte) */
const ME = { id:'AAAA1111', name:'Zoe', guest:false }, OTHER = { id:'BBBB2222', name:'Max', guest:false };
async function service(){
  const { createMemoryGameStore } = await import('../server/game/store.js');
  const { createGameService } = await import('../server/game/service.js');
  const { fakeLive } = await import('./helpers.js');
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock:() => 1e7, randomSeed:() => 7 });
  const done = (id, mode, startedAt, endedAt, seen = []) => store.putGameSession({ id, mode, status:'done', startedAt, endedAt, seen, leaves:[],
    players:[{ account:ME.id, name:'Zoe' }], result:{ shares:[{ account:ME.id, bag:{} }] } });
  return { store, game, done };
}

test('bilan : la dernière session est celle finie en dernier, pas celle commencée en dernier (mine instantanée pendant une tour)', async () => {
  const { game, done } = await service();
  await done('tour', 'tower-angel', 1000, 5000);
  await done('mi', 'mi', 2000, 3000, [ME.id]);
  assert.equal((await game.state(ME)).ended?.id, 'tour');
});

test('bilan : une session vue n\'est pas remontrée au rechargement', async () => {
  const { game, done } = await service();
  await done('tour', 'tower-angel', 1000, 5000);
  assert.equal((await game.state(ME)).ended?.id, 'tour');
  await game.ack(ME, 'tour');
  assert.equal((await game.state(ME)).ended, null);
});

test('bilan : l\'écran qui attendait cette session la reçoit même si un autre onglet l\'a déjà marquée vue', async () => {
  const { game, done } = await service();
  await done('tour', 'tower-angel', 1000, 5000, [ME.id]);
  assert.equal((await game.state(ME, 'tour')).ended?.id, 'tour');
  assert.equal((await game.state(ME, 'inconnue')).ended, null);
  assert.equal((await game.state(OTHER, 'tour')).ended, null, 'la session d\'un autre joueur reste invisible');
  assert.equal((await game.state(ME, { id:'tour' })).ended, null, 'valeur invalide ignorée');
});
