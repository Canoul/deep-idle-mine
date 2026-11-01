/* Bloquer un joueur (01/11/2026, exigence des stores) : messages masqués (global, session), bulle du Carreau, invitations de
   groupe et demandes d'ami qui n'arrivent pas, amitié retirée, sans que l'autre le sache. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODERATION, RULES } from '../src/config.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createSocialService, sanitizeSocial } from '../server/social/service.js';
import { createTownService } from '../server/town/service.js';
import { createModerationService } from '../server/moderation/service.js';
import { nameKey } from '../src/shared/account.js';
import { fakeLive } from './helpers.js';

const rules = { rulesVersion: RULES.version };
const A = { id:'AAAA1111', name:'Zoe', guest:false, ...rules }, B = { id:'BBBB2222', name:'Max', guest:false, ...rules }, C = { id:'CCCC3333', name:'Lou', guest:false, ...rules };
const ACCOUNTS = { [A.id]: A, [B.id]: B, [C.id]: C };
const accounts = { getAccount: async id => ACCOUNTS[id] ?? null, findAccountByName: async k => Object.values(ACCOUNTS).find(a => nameKey(a.name) === k) ?? null };
function setup(){
  const t = { now: 2_000_000 }, clock = () => t.now, store = createMemoryGameStore();
  const moderation = createModerationService({ store, clock });
  let social = null;
  const game = createGameService({ store, liveRunner: fakeLive(rec => ({ id: rec.id, shares: rec.players.map(p => ({ account: p.account, left: false, bag: {} })) })), clock, randomSeed: () => 7, moderation, blockedOf: id => social.blockedOf(id) });
  const party = createPartyService({ game, clock, getAccount: accounts.getAccount, blockedBy: (id, by) => social.isBlocked(id, by) });
  social = createSocialService({ store, game, party, clock, moderation, accounts });
  const town = createTownService({ accounts, game, party, clock, recentChat: ms => social.recentChat(ms), blockedOf: id => social.blockedOf(id) });
  return { t, game, party, social, town, say: async (who, text, extra = {}) => { t.now += 4000; return social.chatPost(who, { text, ...extra }); } };
}

test('chat global : les messages du joueur bloqué disparaissent pour moi seulement, MP compris ; débloquer les rend', async () => {
  const { social, say } = setup();
  await say(B, 'visible par tous');
  await say(B, 'privé', { channel: 'mp', to: 'Zoe' });
  await social.block(A, B.id);
  assert.equal((await social.chatGet(A, 0)).messages.length, 0);
  assert.equal((await social.chatGet(C, 0)).messages.length, 1);
  const sent = await say(B, 'encore un');
  assert.equal(sent.message.text, 'encore un', 'il n\'est pas prévenu');
  await social.unblock(A, B.id);
  assert.equal((await social.chatGet(A, 0)).messages.length, 3);
});

test('chat de session : les messages du joueur bloqué sont masqués', async () => {
  const { game, social, t } = setup();
  await game.start(A, {}, [{ account: A.id, name: A.name }, { account: B.id, name: B.name }]);
  await game.chatPost(B, { text: 'coucou' }); t.now += 4000;
  assert.equal((await game.chatGet(A, 0)).messages.length, 1);
  await social.block(A, B.id);
  assert.equal((await game.chatGet(A, 0)).messages.length, 0);
});

test('Carreau : la bulle du joueur bloqué n\'apparaît pas, le joueur reste visible', async () => {
  const { town, say, social } = setup();
  await town.ping(B, { spot: 'lobby' });
  await say(B, 'bonjour la ville');
  await town.ping(B, { spot: 'lobby' });
  assert.equal((await town.ping(A, { spot: 'lobby' })).players[0].say, 'bonjour la ville');
  await social.block(A, B.id);
  const r = await town.ping(A, { spot: 'lobby' });
  assert.equal(r.players[0].id, B.id); assert.equal(r.players[0].say, null);
  assert.equal((await town.ping(C, { spot: 'lobby' })).players.find(p => p.id === B.id).say, 'bonjour la ville');
});

test('bloquer retire l\'amitié et les demandes, des deux côtés', async () => {
  const { social } = setup();
  await social.request(A, 'Max'); await social.answer(B, A.id, true);
  await social.request(A, 'Lou');
  await social.block(A, B.id);
  await social.block(C, A.id);
  const a = await social.state(A), b = await social.state(B);
  assert.deepEqual(a.friends, []); assert.deepEqual(b.friends, []);
  assert.deepEqual(a.outgoing, []);
  assert.deepEqual(a.blocked.map(x => x.id), [B.id]);
  assert.equal(b.blocked.length, 0, 'il ne voit rien');
});

test('demande d\'ami d\'un joueur bloqué : elle ne m\'arrive pas, lui croit qu\'elle est partie', async () => {
  const { social } = setup();
  await social.block(A, B.id);
  const r = await social.request(B, 'Zoe');
  assert.equal(r.sent, 'Zoe');
  assert.equal((await social.state(A)).incoming.length, 0);
  assert.equal((await social.state(B)).outgoing.length, 1);
  await social.unblock(A, B.id);
  assert.equal((await social.state(A)).incoming.length, 0, 'débloquer ne fait pas réapparaître la demande');
});

test('invitation de groupe d\'un joueur bloqué : elle ne m\'arrive pas, sans erreur ; l\'invitation déjà reçue disparaît', async () => {
  const { party, social } = setup();
  await party.invite(B, A.id);
  assert.equal(party.invitesOf(A.id).length, 1);
  await social.block(A, B.id);
  assert.equal(party.invitesOf(A.id).length, 0);
  await party.invite(B, A.id);
  assert.equal(party.invitesOf(A.id).length, 0);
  await party.invite(C, A.id);
  assert.equal(party.invitesOf(A.id).length, 1, 'les autres joueurs invitent toujours');
});

test('je ne peux pas demander en ami un joueur que j\'ai bloqué ; bloquer deux fois ne double rien ; pas soi-même ; ID invalide', async () => {
  const { social } = setup();
  await social.block(A, B.id); await social.block(A, B.id);
  assert.equal((await social.state(A)).blocked.length, 1);
  await assert.rejects(social.request(A, 'Max'), e => e.status === 409);
  await assert.rejects(social.block(A, A.id), e => e.status === 400);
  for(const v of ['', 'pas un id', null, 12]) await assert.rejects(social.block(A, v), e => e.status === 400);
  await assert.rejects(social.block(A, 'ZZZZ9999'), e => e.status === 404);
});

test('liste relue et revérifiée, bornée', () => {
  assert.deepEqual(sanitizeSocial({ blocked: ['AAAA1111', 'AAAA1111', 'pas un id', 12, null] }).blocked, ['AAAA1111']);
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const many = Array.from({ length: MODERATION.blockedMax + 5 }, (_, i) => 'AAAAAA' + alphabet[i % 32] + alphabet[Math.floor(i / 32)]);
  assert.equal(sanitizeSocial({ blocked: many }).blocked.length, MODERATION.blockedMax);
});
