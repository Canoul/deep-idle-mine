/* Anti-triche des groupes (suite lancée à la demande : npm run test:anticheat).
   Un groupe ne crée aucune ressource ; il ne doit permettre ni d'embarquer quelqu'un dans une session sans
   qu'il l'ait rejointe, ni de toucher une part en partant, ni de deviner des codes en masse. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realDurationMs, TOTAL_TICKS } from '../../src/shared/game.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createPartyService } from '../../server/party/service.js';
import { PARTY_SERVER } from '../../server/config.js';

const A = { id:'AAAA1111', name:'Zoe', guest:false };
const B = { id:'BBBB2222', name:'Max', guest:false };
const C = { id:'CCCC3333', name:'Lou', guest:false };
const ACC = { [A.id]:A, [B.id]:B, [C.id]:C };

function setup(){
  let now = 1_000_000;
  const store = createMemoryGameStore();
  const replay = async rec => ({ shares: rec.players.map(p => ({ account:p.account, left:rec.leaves.some(l => l.account === p.account),
                                                                bag:{ Or:10 } })) });
  const game = createGameService({ store, replay, clock:() => now, config:{ startsPerHour:1000, keepEnded:1e12 } });
  const party = createPartyService({ game, clock:() => now, getAccount:async id => ACC[id] ?? null, newCode:() => 'K7Q4P2' });
  return { game, party, store, advance: ms => { now += ms; } };
}
const gold = async (game, who) => (await game.state(who)).inventory.slots.find(s => s?.item === 'Or')?.qty ?? 0;

test('lancer : l\'équipe vient du serveur, jamais du navigateur (members / players envoyés ignorés)', async () => {
  const { party } = setup();
  const { session } = await party.launch(A, { members:[{ account:B.id }], players:[{ account:C.id }] });
  assert.deepEqual(session.players.map(p => p.account), [A.id]);
});

test('inviter ne fait pas entrer : seul celui qui accepte joue (et reçoit une part)', async () => {
  const { party } = setup();
  await party.invite(A, 'BBBB2222');
  const { session } = await party.launch(A, {});
  assert.deepEqual(session.players.map(p => p.account), [A.id], 'B, invité sans accepter, n\'est pas embarqué');
});

test('partir juste avant la fin : aucune part, même si le départ tombe sur le dernier tick', async () => {
  const { game, party, store, advance } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  const { session } = await party.launch(A, {});
  advance(realDurationMs() - 500);
  await game.leave(B, {});
  assert.ok((await store.getGameSession(session.id)).leaves[0].tick < TOTAL_TICKS);
  advance(1000);
  await game.settleDue();
  assert.equal(await gold(game, A), 10);
  assert.equal(await gold(game, B), 0);
});

test('deviner des codes : bloqué après PARTY_SERVER.joinFailures essais faux', async () => {
  const { party } = setup();
  await party.create(A);
  for(let i = 0; i < PARTY_SERVER.joinFailures.max; i++) await assert.rejects(party.join(B, 'ZZZZZ' + (i % 10)), { code:'party_not_found' });
  await assert.rejects(party.join(B, 'K7Q4P2'), { code:'rate_limited' }, 'même le bon code, le temps du blocage');
});

test('spam d\'invitations : limité par compte et par groupe', async () => {
  const { party } = setup();
  const ids = Array.from({ length:12 }, (_, i) => `EEEE${String(1000 + i)}`);
  for(const id of ids) ACC[id] = { id, name:'x' + id, guest:false };
  for(let i = 0; i < PARTY_SERVER.maxPendingInvites; i++) await party.invite(A, ids[i]);
  await assert.rejects(party.invite(A, ids[10]), { code:'too_many_invites' });
});

test('le même joueur dans deux groupes qui lancent en même temps : une seule session pour lui', async () => {
  const { game, store } = setup();
  const r = await Promise.allSettled([
    game.start(A, {}, [{ account:A.id, name:'Zoe' }, { account:C.id, name:'Lou' }]),
    game.start(B, {}, [{ account:B.id, name:'Max' }, { account:C.id, name:'Lou' }]),
  ]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await store.sessionsOf(C.id)).length, 1);
});
