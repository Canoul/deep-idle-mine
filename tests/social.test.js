/* Social : demandes d'ami (par pseudo ou ID), accepter / refuser / retirer, présence et statut des amis,
   inviter / rejoindre un ami, pas d'invitation pour un joueur en session, relecture du stockage, routes HTTP. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createSocialService, sanitizeSocial } from '../server/social/service.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createApp } from '../server/app.js';
import { SERVER, SOCIAL_SERVER, ROOT } from '../server/config.js';
import { nameKey } from '../src/shared/account.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const A = { id:'AAAA1111', name:'Zoe', guest:false };
const B = { id:'BBBB2222', name:null, guest:true };          // invité : pas de pseudo
const C = { id:'CCCC3333', name:'Max', guest:false };
const D = { id:'DDDD4444', name:'Lou', guest:false };
const ACCOUNTS = Object.fromEntries([A, B, C, D].map(a => [a.id, a]));
const accounts = {
  getAccount: async id => ACCOUNTS[id] ?? null,
  findAccountByName: async key => Object.values(ACCOUNTS).find(a => a.name && nameKey(a.name) === key) ?? null,
};
const fakeSummary = rec => ({ id:rec.id, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{} })) });

function setup(config = SOCIAL_SERVER){
  let now = 5_000_000;
  const clock = () => now;
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner:fakeLive(fakeSummary), clock, randomSeed:() => 7 });
  const party = createPartyService({ game, clock, getAccount:accounts.getAccount });
  const social = createSocialService({ store, accounts, party, game, clock, config });
  return { store, game, party, social, advance: ms => { now += ms; } };
}
async function friends(social, x, y){
  await social.request(x, nameOrId(y));
  await social.answer(y, x.id, true);
}
const nameOrId = a => a.name ?? a.id;
const friend = (st, a) => st.friends.find(f => f.id === a.id);

test('demande par pseudo (sans tenir compte des majuscules) → demande reçue chez l\'autre ; accepter → amis des deux côtés', async () => {
  const { social } = setup();
  let r = await social.request(A, 'max');
  assert.equal(r.sent, 'Max');
  assert.deepEqual(r.outgoing.map(o => o.name), ['Max']);
  let c = await social.state(C);
  assert.deepEqual(c.incoming.map(i => i.name), ['Zoe']);
  r = await social.answer(C, A.id, true);
  assert.equal(r.friend, 'Zoe');
  assert.deepEqual(r.friends.map(f => f.name), ['Zoe']); assert.deepEqual(r.incoming, []);
  const a = await social.state(A);
  assert.deepEqual(a.friends.map(f => f.name), ['Max']); assert.deepEqual(a.outgoing, []);
});

test('un invité (sans pseudo) s\'ajoute par son ID ; erreurs : soi-même, inconnu, déjà ami, déjà demandé', async () => {
  const { social } = setup();
  const r = await social.request(A, 'bbbb-2222');
  assert.equal(r.sent, 'Invité BBBB');
  await assert.rejects(social.request(A, 'BBBB2222'), { code:'already_sent' });
  await assert.rejects(social.request(A, 'zoe'), { code:'self' });
  await assert.rejects(social.request(A, 'Personne'), { code:'not_found' });
  await assert.rejects(social.request(A, ''), { code:'bad_name' });
  await assert.rejects(social.request(A, 'x'.repeat(40)), { code:'bad_name' });
  await social.answer(B, A.id, true);
  await assert.rejects(social.request(A, 'BBBB-2222'), { code:'already_friend' });
});

test('demandes croisées : amis tout de suite ; refuser et annuler effacent la demande des deux côtés', async () => {
  const { social } = setup();
  await social.request(A, 'Max');
  const r = await social.request(C, 'Zoe');
  assert.equal(r.friend, 'Zoe');
  assert.deepEqual((await social.state(A)).friends.map(f => f.id), [C.id]);
  await social.request(A, 'Lou');
  await social.answer(D, A.id, false);
  assert.deepEqual((await social.state(A)).outgoing, []);
  assert.deepEqual((await social.state(D)).incoming, []);
  await social.request(D, 'Zoe');
  await social.remove(D, A.id);                         // annuler sa demande
  assert.deepEqual((await social.state(A)).incoming, []);
  assert.deepEqual((await social.answer(A, D.id, true)).friends.map(f => f.id), [C.id], 'demande annulée : rien à accepter');
});

test('retirer un ami : des deux côtés', async () => {
  const { social } = setup();
  await friends(social, A, C);
  await social.remove(C, A.id);
  assert.deepEqual((await social.state(A)).friends, []);
  assert.deepEqual((await social.state(C)).friends, []);
});

test('statut : hors ligne, en ligne, dans le lobby (n/3), en session ; boutons selon le statut', async () => {
  const { social, party, game, advance } = setup();
  await friends(social, A, C);
  await friends(social, A, D);
  advance(SOCIAL_SERVER.onlineFor + 1);                 // personne n'a donné signe de vie récemment
  let a = await social.state(A);
  assert.equal(friend(a, C).status, 'offline');
  assert.ok(!friend(a, C).canInvite && !friend(a, C).canJoin);
  await social.state(C);                                // C ouvre le jeu
  a = await social.state(A);
  assert.equal(friend(a, C).status, 'online');
  assert.ok(friend(a, C).canInvite && friend(a, C).canJoin);
  await party.create(C);
  a = await social.state(A);
  assert.deepEqual([friend(a, C).status, friend(a, C).size, friend(a, C).max], ['lobby', 1, 3]);
  await social.state(D);
  await game.start(D, {});                              // D lance une session solo
  a = await social.state(A);
  assert.equal(friend(a, D).status, 'session');
  assert.ok(!friend(a, D).canInvite && !friend(a, D).canJoin);
  assert.equal(a.friends[0].id, C.id, 'en lobby en premier, en session ensuite');
});

test('inviter un ami : il reçoit l\'invitation (pop-up) ; refusé s\'il est en session, hors ligne ou pas ami', async () => {
  const { social, game, advance } = setup();
  await friends(social, A, C); await friends(social, A, D);
  await social.state(C); await social.state(D);
  await social.invite(A, C.id);
  const c = await social.state(C);
  assert.deepEqual(c.partyInvites.map(i => i.from), ['Zoe']);
  await game.start(D, {});
  await assert.rejects(social.invite(A, D.id), { code:'friend_in_session' });
  await assert.rejects(social.invite(A, B.id), { code:'not_friend' });
  advance(SOCIAL_SERVER.onlineFor + 1);
  await social.state(A);
  await assert.rejects(social.invite(A, C.id), { code:'friend_offline' });
});

test('le service des groupes refuse aussi d\'inviter (par ID, depuis le lobby) un joueur en session', async () => {
  const { party, game } = setup();
  await game.start(C, {});
  await assert.rejects(party.invite(A, 'CCCC-3333'), { code:'friend_in_session' });
});

test('rejoindre un ami : son groupe (créé s\'il n\'en a pas, dont il est chef) ; refusé s\'il est en session ou complet', async () => {
  const { social, party, game } = setup();
  await friends(social, A, C); await friends(social, B, C); await friends(social, D, C);
  await social.state(C);
  let r = await social.join(A, C.id);
  assert.equal(r.party.leader, C.id);
  assert.deepEqual(r.party.members.map(m => m.account), [C.id, A.id]);
  assert.ok(friend(r, C).together && !friend(r, C).canJoin && !friend(r, C).canInvite);
  r = await social.join(B, C.id);
  assert.equal(r.party.members.length, 3);
  assert.ok(!friend(await social.state(D), C).canJoin, 'groupe complet');
  await assert.rejects(social.join(D, C.id), { code:'party_full' });
  await party.leave(B);
  await party.launch(C, {});                            // C (chef) lance pour lui et A
  await assert.rejects(social.join(D, C.id), { code:'friend_in_session' });
  assert.ok(await game.activeSessionId(A.id));
});

test('limites : nombre d\'amis, demandes en attente', async () => {
  const { social } = setup({ ...SOCIAL_SERVER, maxFriends: 1, maxOutgoing: 1 });
  await social.request(A, 'Max');
  await assert.rejects(social.request(A, 'Lou'), { code:'too_many' });
  await social.answer(C, A.id, true);
  await assert.rejects(social.request(A, 'Lou'), { code:'too_many' });
  await assert.rejects(social.request(D, 'Zoe'), { code:'too_many' });
});

test('relecture : stockage trafiqué nettoyé (ID invalides, doublons, demandes d\'un ami)', () => {
  const s = sanitizeSocial({ friends:['AAAA1111', 'AAAA1111', 'pas un id', 42, 'CCCC3333'],
                             incoming:[{ from:'AAAA1111', at:1 }, { from:'DDDD4444', at:2 }, { from:'DDDD4444', at:3 }, { from:'x', at:1 }, null],
                             outgoing:[{ to:'BBBB2222', at:Infinity }, { to:'BBBB2222', at:5 }] });
  assert.deepEqual(s.friends, ['AAAA1111', 'CCCC3333']);
  assert.deepEqual(s.incoming, [{ from:'DDDD4444', at:2 }]);
  assert.deepEqual(s.outgoing, [{ to:'BBBB2222', at:5 }]);
  assert.deepEqual(sanitizeSocial('n\'importe quoi'), { friends:[], incoming:[], outgoing:[] });
});

test('stockage : une demande écrit les deux comptes en une seule fois', async () => {
  const { social, store } = setup();
  const batches = [];
  store.changed = async ch => { batches.push(ch.map(c => c.ns + '/' + c.key)); };
  await social.request(A, 'Max');
  assert.deepEqual(batches, [['social/AAAA1111', 'social/CCCC3333']]);
});

test('demandes simultanées (double clic) : une seule demande enregistrée', async () => {
  const { social } = setup();
  const rs = await Promise.allSettled([social.request(A, 'Max'), social.request(A, 'Max'), social.request(A, 'max')]);
  assert.equal(rs.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await social.state(C)).incoming.length, 1);
});

/* ---- routes HTTP ---- */
async function serve(){
  const store = createMemoryStore();
  const service = createAccountService({ store, config:{ ...SERVER, scrypt:FAST_SCRYPT } });
  const gameStore = createMemoryGameStore();
  const game = createGameService({ store:gameStore, liveRunner:fakeLive(fakeSummary) });
  const party = createPartyService({ game, getAccount:id => store.getAccount(id) });
  const social = createSocialService({ store:gameStore, accounts:store, party, game });
  const server = http.createServer(createApp({ store, service, game, party, social, root:ROOT, config:{ ...SERVER, scrypt:FAST_SCRYPT, logProxyCheck:false } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => { let cookie = '';
    return async (method, path, body) => {
      const res = await fetch(base + path, { method, headers:{ 'content-type':'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
      const c = res.headers.get('set-cookie'); if(c) cookie = c.split(';')[0];
      return { status:res.status, data: res.status === 204 ? null : await res.json() };
    }; };
  return { server, client };
}

test('HTTP : s\'inscrire, demander en ami par pseudo, accepter, voir l\'ami en ligne, le rejoindre', async () => {
  const { server, client } = await serve();
  try {
    const zoe = client(), max = client();
    await zoe('POST', '/api/account/register', { name:'Zoe', password:'motdepasse-zoe' });
    await max('POST', '/api/account/register', { name:'Max', password:'motdepasse-max' });
    assert.equal((await client()('GET', '/api/social')).status, 401);
    let r = await zoe('POST', '/api/social/request', { name:'max' });
    assert.equal(r.status, 200); assert.equal(r.data.sent, 'Max');
    r = await max('GET', '/api/social');
    const id = r.data.incoming[0].id;
    r = await max('POST', '/api/social/accept', { id });
    assert.equal(r.data.friends[0].name, 'Zoe');
    assert.equal(r.data.friends[0].status, 'online', 'Zoe a appelé /api/social : en ligne');
    r = await max('POST', '/api/social/join', { id });
    assert.equal(r.status, 200); assert.equal(r.data.party.members.length, 2);
    r = await zoe('POST', '/api/social/request', { name:'personne' });
    assert.equal(r.status, 404); assert.equal(r.data.error.code, 'not_found');
  } finally { server.close(); }
});
