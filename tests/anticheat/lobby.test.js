/* Anti-triche du lobby : une part de coffre ne revient qu'aux joueurs qui ont vraiment accepté une invitation.
   On ne peut ni s'ajouter à la session d'un autre, ni utiliser l'invitation d'un autre, ni lancer pour l'hôte. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../../server/accounts/store.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createLobbyService } from '../../server/lobby/service.js';
import { nameKey } from '../../src/shared/account.js';

const HOST = { id:'AAAA1111', name:'Hote', guest:false };
const FRIEND = { id:'BBBB2222', name:'Ami', guest:false };
const THIEF = { id:'CCCC3333', name:'Voleur', guest:false };

async function setup(){
  const accounts = createMemoryStore();
  for(const a of [HOST, FRIEND, THIEF]) await accounts.insertAccount({ ...a, nameKey: nameKey(a.name) });
  const game = createGameService({ store: createMemoryGameStore(), replay: async () => ({ shares: [] }), dev: false, randomSeed: () => 1 });
  return { lobby: createLobbyService({ accounts, game }), game };
}

test('on ne peut pas accepter l\'invitation adressée à un autre', async () => {
  const { lobby } = await setup();
  await lobby.invite(HOST, { to:'Ami' });
  const id = (await lobby.poll(FRIEND)).invites[0].id;
  await assert.rejects(lobby.accept(THIEF, { invite:id }), { code:'no_invite' });
  const { session } = await lobby.launch(HOST, {});
  assert.deepEqual(session.players.map(p => p.account), [HOST.id], 'le voleur n\'est pas dans la session');
});

test('identifiant d\'invitation invalide ou inventé : refusé', async () => {
  const { lobby } = await setup();
  for(const bad of [undefined, null, 3, '', 'x', { id:1 }, 'a'.repeat(100)])
    await assert.rejects(lobby.accept(THIEF, { invite:bad }), { code:'bad_request' });
  await assert.rejects(lobby.accept(THIEF, { invite:'00000000-0000-0000-0000-000000000000' }), { code:'no_invite' });
});

test('une invitation ne sert qu\'une fois ; une fois parti, on ne revient pas sans nouvelle invitation', async () => {
  const { lobby } = await setup();
  await lobby.invite(HOST, { to:'Ami' });
  const id = (await lobby.poll(FRIEND)).invites[0].id;
  await lobby.accept(FRIEND, { invite:id });
  await lobby.leave(FRIEND);
  await assert.rejects(lobby.accept(FRIEND, { invite:id }), { code:'no_invite' });
  const { session } = await lobby.launch(HOST, {});
  assert.deepEqual(session.players.map(p => p.account), [HOST.id]);
});

test('un membre ne lance pas pour l\'hôte ; un lancement direct n\'ajoute personne', async () => {
  const { lobby, game } = await setup();
  await lobby.invite(HOST, { to:'Ami' });
  await lobby.accept(FRIEND, { invite:(await lobby.poll(FRIEND)).invites[0].id });
  await assert.rejects(lobby.launch(FRIEND, {}), { code:'not_host' });
  // le service de jeu refuse un groupe dont le lanceur ne fait pas partie
  await assert.rejects(game.start(THIEF, {}, [HOST, FRIEND]), { code:'bad_request' });
  assert.equal(await game.hasActive(HOST.id), false);
});

test('un joueur déjà en session ne peut pas être mis dans une deuxième', async () => {
  const { lobby, game } = await setup();
  await lobby.invite(HOST, { to:'Ami' });
  await lobby.accept(FRIEND, { invite:(await lobby.poll(FRIEND)).invites[0].id });
  await game.start(FRIEND, {});                 // (ancienne route directe) l'ami lance seul de son côté
  await assert.rejects(lobby.launch(HOST, {}), { code:'member_busy' });
  assert.equal(await game.hasActive(HOST.id), false, 'rien n\'est créé');
});
