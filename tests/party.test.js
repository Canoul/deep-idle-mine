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
import { realDurationMs } from '../src/shared/game.js';

const A = { id:'AAAA1111', name:'Zoe', guest:false };
const B = { id:'BBBB2222', name:null, guest:true };
const C = { id:'CCCC3333', name:'Max', guest:false };
const D = { id:'DDDD4444', name:'Lou', guest:false };
const ACCOUNTS = Object.fromEntries([A, B, C, D].map(a => [a.id, a]));

const fakeSummary = rec => ({ id:rec.id, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{ Charbon:1 } })) });

/* les membres (hors chef) se déclarent prêts : sans ça, le chef ne peut pas lancer (21/10) */
const ready = async (party, ...who) => { for(const m of who) await party.ready(m, true); };

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
  assert.equal(joinLink('https://deepmineidle.fr/#mine', 'K7Q4P2'), 'https://deepmineidle.fr/#rejoindre=K7Q4P2');
  assert.equal(joinLink('https://dim.onrender.com/#mine', 'K7Q4P2'), 'https://deepmineidle.fr/#rejoindre=K7Q4P2', 'ancienne adresse : lien vers le nouveau domaine');
  assert.equal(joinLink('http://localhost:8000/#mine', 'K7Q4P2'), 'http://localhost:8000/#rejoindre=K7Q4P2', 'en local : l\'adresse de la page');
  assert.equal(joinLink('http://192.168.1.20:8000/', 'K7Q4P2'), 'http://192.168.1.20:8000/#rejoindre=K7Q4P2');
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

test('le chef lance : une session pour tous (chef = Rouge), le groupe reste, chacun voit sa session', async () => {
  const { party } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await assert.rejects(party.launch(B, {}), { code:'not_leader' });
  await ready(party, B, C);
  const { session } = await party.launch(A, {});
  assert.deepEqual(session.players.map(p => p.account), [A.id, B.id, C.id]);
  assert.equal(party.count(), 1, 'le groupe survit au lancement');
  for(const who of [A, B, C]){
    const st = await party.state(who);
    assert.equal(st.session, session.id, 'le lobby de chacun passe à la session');
    assert.deepEqual(st.party.members.map(m => m.account), [A.id, B.id, C.id]);
  }
  await assert.rejects(party.create(B), { code:'session_running' });
  await assert.rejects(party.invite(B, 'DDDD4444'), { code:'session_running' });
});

test('seul (sans groupe ou groupe d\'un joueur) : session solo comme avant', async () => {
  const { party } = setup();
  assert.deepEqual((await party.launch(A, {})).session.players.map(p => p.account), [A.id]);
  await party.create(D);
  assert.deepEqual((await party.launch(D, {})).session.players.map(p => p.account), [D.id]);
});

test('enchaîner : pendant toute la session personne n\'est retiré ; à la fin, même groupe, le chef relance', async () => {
  const { party, game, advance } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await ready(party, B, C);
  const first = (await party.launch(A, {})).session;
  advance(realDurationMs() - 1000);                              // ~30 min sans un mot au groupe (ils jouent)
  await party._sweep();
  assert.deepEqual((await party.state(D)).party, null);
  advance(2000); await game.pump();                              // la session se termine
  for(const who of [A, B, C]) assert.equal((await party.state(who)).session, null);
  const st = await party.state(A);
  assert.deepEqual(st.party.members.map(m => m.account), [A.id, B.id, C.id], 'tout le monde est encore là');
  assert.equal(st.party.leader, A.id);
  await assert.rejects(party.launch(A, {}), { code:'not_ready' }, "personne n'est prêt après la session");
  await ready(party, B, C);
  const second = (await party.launch(A, {})).session;
  assert.notEqual(second.id, first.id);
  assert.deepEqual(second.players.map(p => p.account), [A.id, B.id, C.id], 'relancé sans réinviter');
});

test('enchaîner : celui qui ne veut pas relancer quitte le groupe, la suivante se fait sans lui', async () => {
  const { party, game, advance } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await ready(party, B, C); await party.launch(A, {});
  advance(realDurationMs()); await game.pump();
  await party.leave(B); await ready(party, C);
  assert.deepEqual((await party.launch(A, {})).session.players.map(p => p.account), [A.id, C.id]);
});

test('enchaîner : un membre encore en session est affiché « en session » et bloque la relance', async () => {
  const { party, game } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  await ready(party, B); await party.launch(A, {});
  await game.leave(A, {});                                       // A quitte tôt et revient au lobby ; B joue encore
  const st = await party.state(A);
  assert.equal(st.session, null);
  assert.deepEqual(st.party.members.map(m => [m.account, m.playing, m.away]), [[A.id, false, false], [B.id, true, false]]);
  await assert.rejects(party.launch(A, {}), { code:'not_ready' });   // B, encore en session, ne peut pas se dire prêt
  await assert.rejects(party.ready(B, true), { code:'session_running' });
  assert.equal((await party.state(A)).party.members.length, 2, 'le groupe ne bouge pas');
});

test('enchaîner : après la fin, un membre silencieux est retiré au bout de memberTimeout (comme avant)', async () => {
  const { party, game, advance } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  await ready(party, B); await party.launch(A, {});
  advance(realDurationMs()); await game.pump();
  await party.state(B);                                          // B voit le bilan puis ferme l'onglet
  advance(PARTY_SERVER.memberTimeout / 2); await party.state(A);
  advance(PARTY_SERVER.memberTimeout / 2 + 1000);
  assert.deepEqual((await party.state(A)).party.members.map(m => m.account), [A.id]);
});

test('enchaîner : session finie en retard (serveur lent ou redémarré) : personne n\'est retiré juste après la fin', async () => {
  const { party, game, advance } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  await ready(party, B); await party.launch(A, {});
  advance(realDurationMs() + 2 * PARTY_SERVER.memberTimeout);    // la partie rattrape son retard : elle finit bien après l'heure
  await game.pump();
  const st = await party.state(A);                               // A revient le premier ; B n'a pas encore rechargé son lobby
  assert.deepEqual(st.party.members.map(m => m.account), [A.id, B.id], 'B a memberTimeout après la VRAIE fin pour revenir');
  advance(PARTY_SERVER.memberTimeout + 1000);
  assert.deepEqual((await party.state(A)).party.members.map(m => m.account), [A.id], 'puis il est retiré s\'il ne revient pas');
});

test('enchaîner (mode dev, fin libre) : session de plus de memberTimeout, personne n\'est retiré juste après la fin', async () => {
  let now = 5_000_000;
  const clock = () => now;
  const game = createGameService({ store:createMemoryGameStore(), liveRunner:fakeLive(fakeSummary), clock, randomSeed:() => 7, dev:true });
  const party = createPartyService({ game, clock, getAccount:async id => ACCOUNTS[id] ?? null, newCode:() => 'K7Q4P2' });
  await party.create(A); await party.join(B, 'K7Q4P2');
  await ready(party, B); await party.launch(A, {});
  now += 3 * PARTY_SERVER.memberTimeout;                         // on joue un moment
  await game.finish(A);                                          // fin libre (dev)
  assert.deepEqual((await party.state(A)).party.members.map(m => m.account), [A.id, B.id]);
});

test('redémarrage du serveur : les groupes sont gardés (code, chef, membres, invitations) et on relance sans se réinviter', async () => {
  let now = 5_000_000;
  const clock = () => now;
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner:fakeLive(fakeSummary), clock, randomSeed:() => 7 });
  const party = createPartyService({ game, store, clock, getAccount:async id => ACCOUNTS[id] ?? null, newCode:() => 'K7Q4P2' });
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.invite(A, 'CCCC3333');
  await ready(party, B); await party.launch(A, {});
  now += realDurationMs(); await game.pump();
  /* redémarrage : nouveaux services sur le même stockage */
  const store2 = createMemoryGameStore(store.snapshot());
  const game2 = createGameService({ store:store2, liveRunner:fakeLive(fakeSummary), clock, randomSeed:() => 8 });
  const party2 = createPartyService({ game:game2, store:store2, clock, getAccount:async id => ACCOUNTS[id] ?? null, newCode:() => 'H3XM9T' });
  await party2.load();
  await party2.ready(B, true);
  const st = await party2.state(B);
  assert.equal(st.party.code, 'K7Q4P2');
  assert.equal(st.party.leader, A.id);
  assert.deepEqual(st.party.members.map(m => m.account), [A.id, B.id]);
  assert.deepEqual(st.party.invited.map(i => i.account), [C.id]);
  assert.deepEqual((await party2.launch(A, {})).session.players.map(p => p.account), [A.id, B.id], 'relancé sans réinviter');
  /* un groupe quitté ou dissous ne revient pas */
  await party2.leave(B); await party2.leave(A);
  const party3 = createPartyService({ game:game2, store:createMemoryGameStore(store2.snapshot()), clock, getAccount:async id => ACCOUNTS[id] ?? null });
  await party3.load();
  assert.equal(party3.count(), 0);
});

test('stockage des groupes : on n\'écrit que les vrais changements (pas à chaque signe de vie)', async () => {
  let now = 5_000_000, writes = 0;
  const clock = () => now;
  const store = createMemoryGameStore();
  const changed = store.changed; store.changed = async c => { if(c.some(x => x.ns === 'party')) writes++; return changed(c); };
  const game = createGameService({ store, liveRunner:fakeLive(fakeSummary), clock, randomSeed:() => 7 });
  const party = createPartyService({ game, store, clock, getAccount:async id => ACCOUNTS[id] ?? null, newCode:() => 'K7Q4P2' });
  await party.create(A); await party.join(B, 'K7Q4P2');
  const before = writes;
  for(let k = 0; k < 20; k++){ now += 2500; await party.state(A); await party.state(B); }
  assert.equal(writes, before, 'les signes de vie ne réécrivent rien');
});

test('lancement refusé (un membre déjà en session) : le groupe reste, personne n\'est engagé', async () => {
  const { party, game } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  await ready(party, B);
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
  await ready(party, B);
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
    assert.equal((await zoe('POST', '/api/game/start', {})).data.error.code, 'not_ready');
    assert.equal((await max('POST', '/api/party/ready', { ready:'oui' })).status, 400, 'valeur invalide');
    assert.equal((await max('POST', '/api/party/always-ready', { always:'oui' })).status, 400, 'valeur invalide');
    assert.equal((await max('POST', '/api/party/always-ready', { always:true })).status, 200);
    const start = await zoe('POST', '/api/game/start', {});
    assert.equal(start.status, 201);
    assert.equal(start.data.session.players.length, 2);
    const st = (await max('GET', '/api/party')).data;
    assert.equal(st.session, start.data.session.id);
    assert.equal((await max('GET', '/api/game/state')).data.session.id, start.data.session.id);
  } finally { server.close(); }
});

test('réglages : maxPlayers vient de la config du jeu', () => assert.equal(GAME.maxPlayers, 3));

test('lobby : chaque membre du groupe montre sa spécialisation (arbre de skills choisi)', async () => {
  const { party, game } = setup();
  const T = { [A.id]:'logisticien', [B.id]:null, [C.id]:'barbare' };
  game.skillTreeOf = async id => T[id];
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  const st = await party.state(B);
  assert.deepEqual(st.party.members.map(m => [m.account, m.tree]), [[A.id, 'logisticien'], [B.id, null], [C.id, 'barbare']]);
});

test('lobby : chaque membre du groupe montre son skin (équipement porté)', async () => {
  const { party, game } = setup();
  const L = { [A.id]:{ casque:'Casque en chitine' }, [B.id]:{}, [C.id]:{ pioche:'Pioche en pierre' } };
  game.lookFor = async id => L[id];
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  const st = await party.state(B);
  assert.deepEqual(st.party.members.map(m => [m.account, m.look]), [[A.id, L[A.id]], [B.id, {}], [C.id, L[C.id]]]);
});

test('spécialisation : lue par le service de jeu depuis les skills du compte', async () => {
  const { game } = setup();
  assert.equal(await game.skillTreeOf(A.id), null);
});

/* ---------- prêt et chef (21/10) ---------- */

test('prêt : le chef ne lance que si tous les autres sont prêts ; il n\'a pas à se dire prêt lui-même', async () => {
  const { party } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await party.ready(B, true);
  await assert.rejects(party.launch(A, {}), e => e.code === 'not_ready' && /Max/.test(e.message) && !/Zoe/.test(e.message));
  assert.deepEqual((await party.state(A)).party.members.map(m => m.ready), [false, true, false]);
  await party.ready(C, true); await party.ready(B, false);
  await assert.rejects(party.launch(A, {}), { code:'not_ready' }, 'B s\'est ravisé');
  await party.ready(B, true);
  assert.equal((await party.launch(A, {})).session.players.length, 3);
  assert.deepEqual((await party.state(A)).party.members.map(m => m.ready), [false, false, false], 'tout le monde repasse « pas prêt »');
});

test('prêt : quelqu\'un rejoint → tout le monde repasse « pas prêt » ; valeurs invalides et sans groupe refusées', async () => {
  const { party } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  await party.ready(B, true);
  await party.join(C, 'K7Q4P2');
  assert.deepEqual((await party.state(A)).party.members.map(m => m.ready), [false, false, false]);
  for(const v of ['true', 1, null, undefined, {}]) await assert.rejects(party.ready(B, v), { code:'bad_request' });
  await assert.rejects(party.ready(D, true), { code:'no_party' });
});

test('prêt tout le temps : le membre reste prêt après une session et quand quelqu\'un arrive ; le chef enchaîne sans attendre (23/10)', async () => {
  const { party, game } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  await party.alwaysReady(B, true);
  assert.deepEqual((await party.state(A)).party.members.map(m => [m.ready, m.always]), [[false, false], [true, true]]);
  await party.join(C, 'K7Q4P2');                                 // un nouveau venu : B reste prêt, C doit le dire
  assert.deepEqual((await party.state(A)).party.members.map(m => m.ready), [false, true, false]);
  await party.ready(C, true);
  await party.launch(A, {});
  await party.alwaysReady(C, true);                              // possible pendant la session : pour la suivante
  for(const p of [A, B, C]) await game.leave(p, {});
  assert.deepEqual((await party.state(A)).party.members.map(m => m.ready), [false, true, true], 'toujours prêts après la session');
  assert.equal((await party.launch(A, {})).session.players.length, 3, 'relance sans clic « prêt »');
});

test('prêt tout le temps : « plus prêt » ou décocher l\'arrête ; valeurs invalides et sans groupe refusées', async () => {
  const { party } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2');
  await party.alwaysReady(B, true);
  await party.ready(B, false);
  assert.deepEqual((await party.state(B)).party.members.map(m => [m.ready, m.always]), [[false, false], [false, false]]);
  await party.alwaysReady(B, true); await party.alwaysReady(B, false);
  await assert.rejects(party.launch(A, {}), { code:'not_ready' });
  for(const v of ['true', 1, null, undefined, {}]) await assert.rejects(party.alwaysReady(B, v), { code:'bad_request' });
  await assert.rejects(party.alwaysReady(D, true), { code:'no_party' });
  /* un membre qui l'avait coché devient chef puis redevient membre : il l'a toujours */
  await party.alwaysReady(B, true);
  await party.promote(A, B.id); await party.promote(B, A.id);
  assert.equal((await party.state(A)).party.members.find(m => m.account === B.id).ready, true);
});

test('prêt tout le temps : gardé quand le serveur redémarre', async () => {
  const clock = () => 5_000_000, store = createMemoryGameStore();
  const mk = st => createPartyService({ game:createGameService({ store:st, liveRunner:fakeLive(fakeSummary), clock }), store:st, clock,
                                        getAccount:async id => ACCOUNTS[id] ?? null, newCode:() => 'K7Q4P2' });
  const party = mk(store);
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.alwaysReady(B, true);
  const party2 = mk(createMemoryGameStore(store.snapshot()));
  await party2.load();
  assert.deepEqual((await party2.state(A)).party.members.map(m => [m.ready, m.always]), [[false, false], [true, true]]);
});

test('chef : il peut donner sa place à un membre ; le nouveau chef lance, l\'ancien doit se dire prêt', async () => {
  const { party } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await party.ready(B, true); await party.ready(C, true);
  await assert.rejects(party.promote(B, C.id), { code:'not_leader' });
  for(const bad of [A.id, D.id, 'n\'importe quoi', '']) await assert.rejects(party.promote(A, bad), { code:'invalid_id' });
  const r = await party.promote(A, 'bbbb-2222');                    // ID tapé sans soin
  assert.equal(r.party.leader, B.id);
  assert.deepEqual(r.party.members.map(m => [m.account, m.leader, m.ready]), [[A.id, false, false], [B.id, true, false], [C.id, false, true]]);
  await assert.rejects(party.launch(A, {}), { code:'not_leader' });
  await assert.rejects(party.launch(B, {}), { code:'not_ready' }, 'A, devenu simple membre, n\'est pas prêt');
  await assert.rejects(party.kick(A, C.id), { code:'not_leader' });
  await party.ready(A, true);
  assert.deepEqual((await party.launch(B, {})).session.players.map(p => p.account), [B.id, A.id, C.id], 'le chef lance (il est Rouge)');
});

test('prêt et chef : gardés au redémarrage du serveur', async () => {
  let now = 5_000_000;
  const clock = () => now;
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner:fakeLive(fakeSummary), clock, randomSeed:() => 7 });
  const party = createPartyService({ game, store, clock, getAccount:async id => ACCOUNTS[id] ?? null, newCode:() => 'K7Q4P2' });
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await party.promote(A, B.id); await party.ready(C, true);
  const store2 = createMemoryGameStore(store.snapshot());
  const party2 = createPartyService({ game:createGameService({ store:store2, liveRunner:fakeLive(fakeSummary), clock }), store:store2, clock, getAccount:async id => ACCOUNTS[id] ?? null });
  await party2.load();
  const st = (await party2.state(B)).party;
  assert.equal(st.leader, B.id);
  assert.deepEqual(st.members.map(m => m.ready), [false, false, true]);
});
