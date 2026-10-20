/* Groupes : code, lien, invitation par ID, chef qui lance pour tous, départs, ménage. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { GAME, PARTY } from '../src/config.js';
import { parsePartyCode, joinLink, joinCodeFromHash } from '../src/shared/party.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createApp } from '../server/app.js';
import { SERVER, PARTY_SERVER, ROOT } from '../server/config.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const A = { id:'AAAA1111', name:'Zoe', guest:false };
const B = { id:'BBBB2222', name:null, guest:true };
const C = { id:'CCCC3333', name:'Max', guest:false };
const D = { id:'DDDD4444', name:'Lou', guest:false };
const ACCOUNTS = Object.fromEntries([A, B, C, D].map(a => [a.id, a]));

const fakeSummary = rec => ({ id:rec.id, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{ Charbon:1 } })) });

function setup(){
  let now = 5_000_000;
  const clock = () => now;
  const game = createGameService({ store:createMemoryGameStore(), liveRunner:fakeLive(fakeSummary), clock, randomSeed:() => 7 });
  let n = 0;
  const party = createPartyService({ game, clock, getAccount:async id => ACCOUNTS[id] ?? null,
                                     newCode:() => ['K7Q4P2', 'H3XM9T', 'R5B8NC'][n++ % 3] });
  return { game, party, advance: ms => { now += ms; } };
}

/* ---------- code et lien ---------- */

test('code de groupe : tapé sans soin, il est reconnu ; sinon null', () => {
  assert.equal(parsePartyCode('k7q-4p2'), 'K7Q4P2');
  assert.equal(parsePartyCode(' K7Q 4P2 '), 'K7Q4P2');
  assert.equal(parsePartyCode('h3xm9t'), 'H3XM9T');
  assert.equal(parsePartyCode('K7Q4P'), null, 'trop court');
  assert.equal(parsePartyCode('K7Q4P2U'), null);
  assert.equal(parsePartyCode(42), null);
  assert.equal(PARTY.codeLength, 6);
});

test('lien d\'invitation : construit depuis l\'adresse de la page, relu depuis #rejoindre=…', () => {
  assert.equal(joinLink('https://dim.onrender.com/#mine', 'K7Q4P2'), 'https://dim.onrender.com/#rejoindre=K7Q4P2');
  assert.equal(joinCodeFromHash('#rejoindre=K7Q4P2'), 'K7Q4P2');
  assert.equal(joinCodeFromHash('https://dim.onrender.com/#rejoindre=k7q-4p2'), 'K7Q4P2');
  assert.equal(joinCodeFromHash('#mine'), null);
  assert.equal(joinCodeFromHash('#rejoindre=%E0%A4%A'), null, 'adresse abîmée : ignorée');
  assert.equal(joinCodeFromHash('rejoindre=K7Q4P2'), null, 'sans # : pas un lien');
});

/* ---------- se réunir ---------- */

test('créer puis rejoindre par code : chef, places, « toi »', async () => {
  const { party } = setup();
  const { party:p } = await party.create(A);
  assert.equal(p.code, 'K7Q4P2');
  assert.equal(p.leader, A.id);
  const j = (await party.join(B, 'k7q4p2')).party;
  assert.deepEqual(j.members.map(m => [m.name, m.leader, m.me]), [['Zoe', true, false], ['Invité BBBB', false, true]]);
  assert.equal((await party.state(A)).party.members.length, 2, 'le chef voit le nouveau membre');
  assert.equal((await party.create(A)).party.code, 'K7Q4P2', 'créer à nouveau : on garde son groupe');
});

test('groupe complet, code inconnu : refusés ; rejoindre un autre groupe fait quitter le premier', async () => {
  const { party } = setup();
  await party.create(A);
  await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await assert.rejects(party.join(D, 'K7Q4P2'), { code:'party_full' });
  await assert.rejects(party.join(D, 'ZZZZZZ'), { code:'party_not_found' });
  await assert.rejects(party.join(D, 'n\'importe quoi'), { code:'party_not_found' });
  await party.create(D);                                        // H3XM9T
  await party.join(C, 'H3XM9T');
  assert.deepEqual((await party.state(A)).party.members.map(m => m.account), [A.id, B.id]);
  assert.deepEqual((await party.state(D)).party.members.map(m => m.account), [D.id, C.id]);
});

test('invitation par ID : reçue, acceptée (= rejoindre), ou refusée', async () => {
  const { party } = setup();
  await party.invite(A, 'bbbb-2222');                           // crée le groupe au passage
  const seen = await party.state(B);
  assert.deepEqual(seen.invites, [{ code:'K7Q4P2', from:'Zoe', members:['Zoe'], full:false }]);
  assert.deepEqual((await party.state(A)).party.invited.map(i => i.name), ['Invité BBBB'], 'le chef voit qui est invité');
  await party.join(B, seen.invites[0].code);
  assert.deepEqual((await party.state(B)).invites, [], 'invitation consommée');
  await party.invite(A, 'CCCC-3333');
  await party.decline(C, 'K7Q4P2');
  assert.deepEqual((await party.state(C)).invites, []);
  assert.deepEqual((await party.state(A)).party.invited, []);
});

test('invitation : ID invalide, inconnu, soi-même, déjà membre : refusés avec un message clair', async () => {
  const { party } = setup();
  await assert.rejects(party.invite(A, 'pas un id'), { code:'invalid_id' });
  await assert.rejects(party.invite(A, 'ZZZZ-ZZZZ'), { code:'account_not_found' });
  await assert.rejects(party.invite(A, 'AAAA-1111'), { code:'invalid_id' });
  await party.invite(A, 'BBBB2222'); await party.join(B, 'K7Q4P2');
  await assert.rejects(party.invite(A, 'BBBB2222'), e => e.code === 'already_member' && /Invité BBBB/.test(e.message));
});

test('le chef part : le suivant devient chef ; le dernier part : le groupe disparaît', async () => {
  const { party } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  await party.leave(A);
  assert.equal((await party.state(B)).party.leader, B.id);
  await party.leave(B);
  assert.equal(party.count(), 0);
  await assert.rejects(party.join(C, 'K7Q4P2'), { code:'party_not_found' });
});

test('le chef retire un membre ; un membre ne peut pas retirer', async () => {
  const { party } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await assert.rejects(party.kick(B, 'CCCC3333'), { code:'not_leader' });
  await party.kick(A, 'CCCC-3333');
  assert.equal((await party.state(C)).party, null);
  assert.equal((await party.state(A)).party.members.length, 2);
});

test('membre sans nouvelles : « absent » puis retiré ; invitation périmée', async () => {
  const { party, advance } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.invite(A, 'CCCC3333');
  advance(PARTY_SERVER.awayAfter + 1000);
  await party.state(A);                                         // A donne signe de vie, pas B
  assert.deepEqual((await party.state(A)).party.members.map(m => m.away), [false, true]);
  advance(PARTY_SERVER.memberTimeout);
  await party.state(A);
  advance(PARTY_SERVER.inviteTtl);
  const st = await party.state(A);
  assert.deepEqual(st.party.members.map(m => m.account), [A.id], 'B retiré');
  assert.deepEqual(st.party.invited, [], 'invitation périmée');
});

/* ---------- lancer ---------- */

test('le chef lance : une session pour tous (chef = Rouge), le groupe disparaît, chacun voit sa session', async () => {
  const { party } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await assert.rejects(party.launch(B, {}), { code:'not_leader' });
  const { session } = await party.launch(A, {});
  assert.deepEqual(session.players.map(p => p.account), [A.id, B.id, C.id]);
  assert.equal(party.count(), 0);
  for(const who of [A, B, C]){
    const st = await party.state(who);
    assert.equal(st.session, session.id, 'le lobby de chacun passe à la session');
    assert.equal(st.party, null);
  }
  await assert.rejects(party.create(B), { code:'session_running' });
  await assert.rejects(party.invite(B, 'DDDD4444'), { code:'session_running' });
});

test('seul (sans groupe ou groupe d\'un joueur) : session solo comme avant', async () => {
  const { party } = setup();
  assert.deepEqual((await party.launch(A, {})).session.players.map(p => p.account), [A.id]);
  await party.create(D);
  assert.deepEqual((await party.launch(D, {})).session.players.map(p => p.account), [D.id]);
  assert.equal(party.count(), 0);
});

test('lancement refusé (un membre déjà en session) : le groupe reste, personne n\'est engagé', async () => {
  const { party, game } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  await game.start(B, {});                                      // B a lancé une session solo ailleurs (autre onglet)
  await assert.rejects(party.launch(A, {}), { code:'member_in_session' });
  assert.equal((await party.state(A)).party.members.length, 2);
  assert.equal(await game.activeSessionId(A.id), null);
});

test('pendant le lancement, personne n\'entre ni ne sort (l\'équipe lancée est celle du groupe)', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const game = { activeSessionId:async () => null,
                 start:async (me, body, members) => { await gate; return { session:{ players:members } }; } };
  const party = createPartyService({ game, getAccount:async id => ACCOUNTS[id], newCode:() => 'K7Q4P2' });
  await party.create(A); await party.join(B, 'K7Q4P2');
  const launching = party.launch(A, {});
  await new Promise(r => setTimeout(r, 0));
  await assert.rejects(party.join(C, 'K7Q4P2'), { code:'launching' });
  await assert.rejects(party.leave(B), { code:'launching' });
  release();
  assert.deepEqual((await launching).session.players.map(p => p.account), [A.id, B.id]);
});

/* ---------- de bout en bout par HTTP (deux navigateurs) ---------- */

test('HTTP : Zoé crée, Max rejoint par le code, Zoé lance, les deux sont dans la même session', async () => {
  const store = createMemoryStore();
  const service = createAccountService({ store, scrypt:FAST_SCRYPT });
  const game = createGameService({ store:createMemoryGameStore(), liveRunner:fakeLive(fakeSummary) });
  const party = createPartyService({ game, getAccount:id => store.getAccount(id) });
  const server = http.createServer(createApp({ store, service, game, party, root:ROOT, config:{ ...SERVER, logProxyCheck:false } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = () => {
    let cookie = '';
    return async (method, p, body) => {
      const res = await fetch(base + p, { method, headers:{ ...(body ? { 'content-type':'application/json' } : {}), ...(cookie ? { cookie } : {}) },
                                          body:body ? JSON.stringify(body) : undefined });
      for(const c of res.headers.getSetCookie()) cookie = c.split(';')[0];
      const text = await res.text();
      return { status:res.status, data:text ? JSON.parse(text) : null };
    };
  };
  try {
    const zoe = browser(), max = browser();
    assert.equal((await zoe('GET', '/api/party')).status, 401, 'connexion exigée');
    await zoe('POST', '/api/account/register', { name:'Zoé', password:'motdepasse' });
    const maxAcc = (await max('POST', '/api/account/guest', {})).data.account;
    const { code } = (await zoe('POST', '/api/party/create', {})).data.party;
    assert.equal((await max('POST', '/api/party/join', { code })).status, 200);
    assert.equal((await max('POST', '/api/game/start', {})).data.error.code, 'not_leader');
    const inv = await zoe('POST', '/api/party/invite', { id:maxAcc.displayId });
    assert.equal(inv.data.error.code, 'already_member');
    const start = await zoe('POST', '/api/game/start', {});
    assert.equal(start.status, 201);
    assert.equal(start.data.session.players.length, 2);
    const st = (await max('GET', '/api/party')).data;
    assert.equal(st.session, start.data.session.id);
    assert.equal((await max('GET', '/api/game/state')).data.session.id, start.data.session.id);
  } finally { server.close(); }
});

test('réglages : maxPlayers vient de la config du jeu', () => assert.equal(GAME.maxPlayers, 3));
