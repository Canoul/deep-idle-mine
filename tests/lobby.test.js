/* Lobby partagé : inviter (pseudo ou ID), rejoindre, refuser, quitter, hôte qui part, lancer à plusieurs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../server/accounts/store.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createLobbyService } from '../server/lobby/service.js';
import { nameKey } from '../src/shared/account.js';
import { LOBBY_SERVER } from '../server/config.js';

const ZOE = { id:'AAAA1111', name:'Zoe', guest:false };
const LEO = { id:'BBBB2222', name:'Léo', guest:false };
const MIA = { id:'CCCC3333', name:'Mia', guest:false };
const GUEST = { id:'DDDD4444', name:null, guest:true };
const EVE = { id:'EEEE5555', name:'Eve', guest:false };

async function setup(){
  let now = 1_000_000;
  const clock = () => now;
  const accounts = createMemoryStore();
  for(const a of [ZOE, LEO, MIA, GUEST, EVE]) await accounts.insertAccount({ ...a, nameKey: a.name ? nameKey(a.name) : null });
  const gameStore = createMemoryGameStore();
  const game = createGameService({ store: gameStore, replay: async () => ({ shares: [] }), clock, dev: false, randomSeed: () => 7 });
  const lobby = createLobbyService({ accounts, game, clock });
  return { lobby, game, gameStore, advance: ms => { now += ms; } };
}
const inviteOf = (view) => view.invites[0]?.id;

test('inviter par pseudo (sans majuscules ni accents) : l\'invité voit l\'invitation, l\'hôte la place en attente', async () => {
  const { lobby } = await setup();
  const v = await lobby.invite(ZOE, { to:'leo' });
  assert.deepEqual(v.lobby.pending.map(p => p.name), ['Léo']);
  assert.equal(v.lobby.isHost, true);
  const l = await lobby.poll(LEO);
  assert.equal(l.invites.length, 1);
  assert.equal(l.invites[0].from, 'Zoe');
  assert.equal(l.lobby, null, 'pas encore dans le lobby');
});

test('inviter par ID de compte (saisie tolérante) : un invité sans pseudo est invitable', async () => {
  const { lobby } = await setup();
  await lobby.invite(ZOE, { to:'dddd-4444' });
  assert.equal((await lobby.poll(GUEST)).invites.length, 1);
});

test('inviter : joueur inconnu, soi-même, saisie invalide', async () => {
  const { lobby } = await setup();
  await assert.rejects(lobby.invite(ZOE, { to:'personne' }), { code:'not_found' });
  await assert.rejects(lobby.invite(ZOE, { to:'zoe' }), { code:'self' });
  await assert.rejects(lobby.invite(ZOE, { to:42 }), { code:'bad_request' });
  await assert.rejects(lobby.invite(ZOE, { to:'x'.repeat(500) }), { code:'not_found' });
});

test('inviter deux fois la même personne ne crée qu\'une invitation', async () => {
  const { lobby } = await setup();
  await lobby.invite(ZOE, { to:'Léo' });
  const v = await lobby.invite(ZOE, { to:'Léo' });
  assert.equal(v.lobby.pending.length, 1);
  assert.equal((await lobby.poll(LEO)).invites.length, 1);
});

test('rejoindre : les deux voient le même lobby (membres, hôte)', async () => {
  const { lobby } = await setup();
  await lobby.invite(ZOE, { to:'Léo' });
  const v = await lobby.accept(LEO, { invite: inviteOf(await lobby.poll(LEO)) });
  assert.deepEqual(v.lobby.members.map(m => m.name), ['Zoe', 'Léo']);
  assert.equal(v.lobby.isHost, false);
  const z = await lobby.poll(ZOE);
  assert.deepEqual(z.lobby.members.map(m => [m.name, m.host]), [['Zoe', true], ['Léo', false]]);
  assert.equal(z.lobby.id, v.lobby.id);
  assert.deepEqual(z.lobby.pending, [], 'l\'invitation acceptée n\'est plus en attente');
  assert.equal((await lobby.poll(LEO)).invites.length, 0);
});

test('refuser : l\'invitation disparaît chez les deux', async () => {
  const { lobby } = await setup();
  await lobby.invite(ZOE, { to:'Léo' });
  await lobby.decline(LEO, { invite: inviteOf(await lobby.poll(LEO)) });
  assert.equal((await lobby.poll(LEO)).invites.length, 0);
  assert.deepEqual((await lobby.poll(ZOE)).lobby.pending, []);
});

test('lobby complet : 3 joueurs max, une invitation de plus ne peut pas être acceptée', async () => {
  const { lobby } = await setup();
  await lobby.invite(ZOE, { to:'Léo' }); await lobby.invite(ZOE, { to:'Mia' }); await lobby.invite(ZOE, { to:'Eve' });
  await lobby.accept(LEO, { invite: inviteOf(await lobby.poll(LEO)) });
  await lobby.accept(MIA, { invite: inviteOf(await lobby.poll(MIA)) });
  await assert.rejects(lobby.accept(EVE, { invite: inviteOf(await lobby.poll(EVE)) }), { code:'full' });
  await assert.rejects(lobby.invite(ZOE, { to:'dddd4444' }), { code:'full' });
  assert.equal((await lobby.poll(EVE)).invites.length, 1, 'l\'invitation reste jusqu\'au lancement');
});

test('l\'hôte quitte : le plus ancien membre devient hôte ; le dernier parti = lobby dissous', async () => {
  const { lobby } = await setup();
  await lobby.invite(ZOE, { to:'Léo' }); await lobby.invite(ZOE, { to:'Mia' });
  await lobby.accept(LEO, { invite: inviteOf(await lobby.poll(LEO)) });
  await lobby.accept(MIA, { invite: inviteOf(await lobby.poll(MIA)) });
  await lobby.leave(ZOE);
  assert.equal((await lobby.poll(ZOE)).lobby, null);
  const l = await lobby.poll(MIA);
  assert.deepEqual(l.lobby.members.map(m => [m.name, m.host]), [['Léo', true], ['Mia', false]]);
  await lobby.leave(LEO); await lobby.leave(MIA);
  assert.equal(lobby._lobbies.size, 0);
});

test('page fermée : un membre plus vu depuis LOBBY_SERVER.idle quitte le lobby (l\'hôte aussi)', async () => {
  const { lobby, advance } = await setup();
  await lobby.invite(ZOE, { to:'Léo' });
  await lobby.accept(LEO, { invite: inviteOf(await lobby.poll(LEO)) });
  advance(LOBBY_SERVER.idle / 2); await lobby.poll(LEO);
  advance(LOBBY_SERVER.idle / 2 + 1);
  const l = await lobby.poll(LEO);
  assert.deepEqual(l.lobby.members.map(m => [m.name, m.host]), [['Léo', true]]);
});

test('rejoindre un lobby fait quitter le sien (l\'hôte de l\'autre passe la main)', async () => {
  const { lobby } = await setup();
  await lobby.invite(LEO, { to:'Mia' });
  await lobby.accept(MIA, { invite: inviteOf(await lobby.poll(MIA)) });
  await lobby.invite(ZOE, { to:'Léo' });
  await lobby.accept(LEO, { invite: inviteOf(await lobby.poll(LEO)) });
  assert.deepEqual((await lobby.poll(MIA)).lobby.members.map(m => [m.name, m.host]), [['Mia', true]]);
  assert.deepEqual((await lobby.poll(LEO)).lobby.members.map(m => m.name), ['Zoe', 'Léo']);
});

test('lancer : seul l\'hôte, avec tous les membres ; tout le monde se retrouve dans la session', async () => {
  const { lobby } = await setup();
  await lobby.invite(ZOE, { to:'Léo' }); await lobby.invite(ZOE, { to:'Eve' });
  await lobby.accept(LEO, { invite: inviteOf(await lobby.poll(LEO)) });
  await assert.rejects(lobby.launch(LEO, {}), { code:'not_host' });
  const { session } = await lobby.launch(ZOE, {});
  assert.deepEqual(session.players.map(p => p.name), ['Zoe', 'Léo']);
  assert.deepEqual(Object.keys(session.prefs).sort(), [LEO.id, ZOE.id].sort());
  const l = await lobby.poll(LEO);
  assert.equal(l.inSession, true, 'le membre voit qu\'une session l\'attend');
  assert.equal(l.lobby, null, 'le lobby disparaît au lancement');
  assert.equal((await lobby.poll(EVE)).invites.length, 0, 'ses invitations aussi');
});

test('lancer seul (sans lobby) : la session habituelle', async () => {
  const { lobby } = await setup();
  const { session } = await lobby.launch(ZOE, {});
  assert.deepEqual(session.players.map(p => p.account), [ZOE.id]);
});

test('rejoindre est refusé à un joueur déjà en session', async () => {
  const { lobby } = await setup();
  await lobby.launch(LEO, {});
  await lobby.invite(ZOE, { to:'Léo' });
  await assert.rejects(lobby.accept(LEO, { invite: inviteOf(await lobby.poll(LEO)) }), { code:'session_running' });
});
