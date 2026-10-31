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
import { realDurationMs } from '../src/shared/game.js';
import { GAME, ENERGY } from '../src/config.js';
import { statusText, statusDot, onlineCountText, energyHTML } from '../src/ui/social.js';

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
  await party.ready(A, true);
  await party.launch(C, {});                            // C (chef) lance pour lui et A (prêt)
  await assert.rejects(social.join(D, C.id), { code:'friend_in_session' });
  assert.ok(await game.activeSessionId(A.id));
});

test('ami en session : on voit le type de mine et le temps qui lui reste (23/10)', async () => {
  const { social, party, advance } = setup();
  await friends(social, A, C);
  await party.launch(C, {});                            // C seul : une session de mine
  const f = friend(await social.state(A), C);
  assert.equal(f.status, 'session'); assert.equal(f.mode, 'mine');
  assert.equal(f.leftMs, realDurationMs());
  advance(10 * 60_000);
  assert.equal(friend(await social.state(A), C).leftMs, realDurationMs() - 10 * 60_000);
  assert.equal(statusText({ status:'session', mode:'mine', leftMs: 23 * 60_000 - 1 }), 'En session mine · reste 23 min');
  assert.equal(statusText({ status:'session', mode:'tower_angel', leftMs: 30_000 }), 'En session · Tour de l\'Ange · reste < 1 min');
  assert.equal(statusText({ status:'session', mode:'mine', leftMs:null }), 'En session mine', 'mode dev : pas de fin');
  assert.equal(statusText({ status:'lobby', size:2, max:3 }), 'Dans le lobby (2/3)');
});

test('joueur en session : on voit combien ils sont dans le groupe (30/10), pour repérer les solos et les duos', async () => {
  const { social, party, game } = setup();
  await friends(social, A, C); await friends(social, A, D); await friends(social, B, D);
  await party.launch(C, {});                            // C seul
  let f = friend(await social.state(A), C);
  assert.equal(f.size, 1); assert.equal(f.max, GAME.maxPlayers);
  await social.state(B); await social.join(D, B.id);   // B (chef) + D : un duo
  await party.ready(D, true);
  await party.launch(B, {});
  f = friend(await social.state(A), D);
  assert.equal(f.status, 'session'); assert.equal(f.size, 2);
  const row = (await social.online(A)).players.find(p => p.id === D.id);
  assert.equal(row.size, 2, 'la liste Online aussi');
  await game.leave(B);                                  // B quitte : D reste seul dans la session
  assert.equal(friend(await social.state(A), D).size, 1);
  assert.equal(statusText({ status:'session', mode:'mine', size:1, max:3, leftMs: 23 * 60_000 - 1 }), 'En session mine (1/3) · reste 23 min');
  assert.equal(statusText({ status:'session', mode:'tower_angel', size:2, max:3, leftMs:null }), 'En session · Tour de l\'Ange (2/3)');
  assert.equal(statusText({ status:'session', mode:'giant', leftMs: 30_000 }).includes('/'), false, 'sans taille (Bloc géant) : rien');
});

test('limites : nombre d\'amis, demandes en attente', async () => {
  const { social } = setup({ ...SOCIAL_SERVER, maxFriends: 1, maxOutgoing: 1 });
  await social.request(A, 'Max');
  await assert.rejects(social.request(A, 'Lou'), { code:'too_many' });
  await social.answer(C, A.id, true);
  await assert.rejects(social.request(A, 'Lou'), { code:'too_many' });
  await assert.rejects(social.request(D, 'Zoe'), { code:'too_many' });
});

test('voir le stuff d\'un ami : pièces portées, niveau, spécialisation, même hors ligne ; jamais son inventaire ; refusé si pas ami', async () => {
  const { social, game, store, advance } = setup();
  await friends(social, A, C);
  await store.putInventory(C.id, { slots:[{ item:'Casque en chitine', qty:1, uid:1 }, { item:'Fer', qty:40 }], nextUid:2, credited:[] });
  await game.stuff(C, { action:'equip', slot:'casque', uid:1, opId:'op-ami-casque' });
  await store.putProgress(C.id, { xp:1200, credited:[] });                       // niveau 2 : 1 point de skill
  await store.putSkills(C.id, { tree:'mineur', ranks:{ mine_speed:1 }, ops:[] });
  advance(SOCIAL_SERVER.onlineFor + 60_000);                                      // Max est hors ligne
  const p = await social.profile(A, C.id);
  assert.equal(p.name, 'Max');
  assert.deepEqual(p.stuff.casque, { item:'Casque en chitine', uid:1 });
  assert.equal(p.stuff.pioche, null);
  assert.equal(p.progress.level, 2);
  assert.deepEqual(p.skills, { tree:'mineur', ranks:{ mine_speed:1 } });
  assert.equal(JSON.stringify(p).includes('Fer'), false, 'rien de son inventaire');
  assert.deepEqual(Object.keys(p).sort(), ['displayId', 'id', 'name', 'progress', 'skills', 'stuff']);
  await assert.rejects(social.profile(D, C.id), { code:'not_friend' });            // pas ami
  await assert.rejects(social.profile(A, 'n\'importe quoi'), { code:'not_friend' });
  await assert.rejects(social.profile(A, A.id), { code:'not_friend' });
  await social.remove(C, A.id);
  await assert.rejects(social.profile(A, C.id), { code:'not_friend' });            // ami retiré : plus rien
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
    r = await max('POST', '/api/social/profile', { id });
    assert.equal(r.status, 200); assert.equal(r.data.name, 'Zoe'); assert.equal(r.data.progress.level, 1);
    assert.equal((await client()('POST', '/api/social/profile', { id })).status, 401);
    r = await zoe('GET', '/api/social/online');
    assert.equal(r.status, 200); assert.equal(r.data.count, 2);
    assert.equal((await client()('GET', '/api/social/online')).status, 401);
    r = await zoe('POST', '/api/social/request', { name:'personne' });
    assert.equal(r.status, 404); assert.equal(r.data.error.code, 'not_found');
  } finally { server.close(); }
});

test('HTTP : chat global, connecté seulement ; écrire puis relire après un numéro ; trop vite ou vide refusé', async () => {
  const { server, client } = await serve();
  try {
    const zoe = client(), guest = client();
    await zoe('POST', '/api/account/register', { name:'Zoe', password:'motdepasse-zoe' });
    await guest('POST', '/api/account/guest', {});
    assert.equal((await client()('GET', '/api/social/chat')).status, 401);
    assert.equal((await client()('POST', '/api/social/chat', { text:'x' })).status, 401);
    const sent = await zoe('POST', '/api/social/chat', { text:'  hello <b>mine</b> ' });
    assert.equal(sent.status, 200); assert.equal(sent.data.message.name, 'Zoe');
    const r = await guest('GET', '/api/social/chat');
    assert.deepEqual(r.data.messages.map(m => m.text), ['hello <b>mine</b>']);
    assert.deepEqual((await guest('GET', `/api/social/chat?after=${sent.data.message.id}`)).data.messages, []);
    assert.equal((await guest('GET', '/api/social/chat?after=abc')).data.messages.length, 1, 'numéro invalide : tout');
    assert.equal((await zoe('POST', '/api/social/chat', { text:'vite' })).status, 429);
    assert.equal((await guest('POST', '/api/social/chat', { text:'' })).status, 400);
    assert.equal((await guest('POST', '/api/social/chat', [1])).status, 400);
    assert.match((await guest('POST', '/api/social/chat', { text:'moi' })).data.message.name, /^Invité /);
  } finally { server.close(); }
});

test('Online : tous les joueurs en ligne (amis ou non), pas en session d\'abord, puis en session ; hors ligne absents', async () => {
  const { social, game, advance } = setup();
  await friends(social, A, C);
  await social.state(D); await game.start(D, {});           // D : en ligne, en session
  await social.state(C);                                    // C : ami de A, en ligne
  await social.state(B);                                    // B : invité, sans pseudo
  let r = await social.online(A);
  assert.equal(r.count, 4);
  assert.deepEqual(r.players.map(p => p.status), ['online', 'online', 'online', 'session'], 'en session tout en bas');
  assert.equal(r.players.at(-1).id, D.id);
  const me = r.players.find(p => p.id === A.id), c = r.players.find(p => p.id === C.id), b = r.players.find(p => p.id === B.id);
  assert.equal(me.me, true); assert.equal(c.friend, true); assert.equal(b.friend, false);
  assert.match(b.name, /^Invité/, 'un invité garde son nom d\'invité');
  advance(SOCIAL_SERVER.onlineFor + 1);
  r = await social.online(A);
  assert.deepEqual(r.players.map(p => p.id), [A.id, D.id], 'B et C ne donnent plus signe de vie ; D reste : en session');
});

test('Online : la liste est bornée, le compteur compte tout le monde', async () => {
  const { social } = setup({ ...SOCIAL_SERVER, onlineListMax: 2 });
  for(const x of [A, B, C, D]) await social.state(x);
  const r = await social.online(A);
  assert.equal(r.count, 4); assert.equal(r.players.length, 2);
  assert.equal(onlineCountText(1), '1 joueur en ligne'); assert.equal(onlineCountText(4), '4 joueurs en ligne');
});

test('Online : un joueur en session compte même navigateur fermé (comme dans la liste d\'amis)', async () => {
  const { social, game, advance } = setup();
  await social.state(D); await game.start(D, {});
  advance(SOCIAL_SERVER.onlineFor + 1);                     // D a fermé son navigateur, sa session tourne
  await friends(social, A, D);
  assert.equal(friend(await social.state(A), D).status, 'session');
  const r = await social.online(A);
  assert.equal(r.count, 2);
  assert.deepEqual(r.players.map(p => [p.id, p.status]), [[A.id, 'online'], [D.id, 'session']]);
});

/* ---------- énergie dans Social (31/10/2026) ---------- */
test('énergie : visible chez les amis (même hors ligne) et dans la liste Online, repos compris', async () => {
  const { store, social, advance } = setup();
  await friends(social, A, C);
  await store.putEnergy(C.id, { value: 42, keys: [], at: 5_000_000 });
  assert.deepEqual(friend(await social.state(A), C).energy, { value: 42, max: ENERGY.max });
  const on = await social.online(A);
  assert.deepEqual(on.players.find(p => p.id === C.id).energy, { value: 42, max: ENERGY.max });
  advance(SOCIAL_SERVER.onlineFor + 1);                                  // C hors ligne : le repos continue de compter
  advance(3600e3 / GAME.speed);
  await social.state(A);
  const f = friend(await social.state(A), C);
  assert.equal(f.status, 'offline');
  assert.equal(f.energy.value, Math.round(42 + ENERGY.idlePerHour));
});

test('énergie : regarder celle d\'un autre n\'écrit rien (ne peut pas écraser un débit en cours)', async () => {
  const { store, game, social, advance } = setup();
  await friends(social, A, C);
  const e = { value: 20, keys: ['s1'], at: 5_000_000 };
  await store.putEnergy(C.id, e);
  advance(3600e3);
  await game.energyOf(C.id);
  await social.online(A);
  assert.deepEqual(await store.getEnergy(C.id), e);
  await store.putEnergy(D.id, null);                                     // compte sans énergie enregistrée
  await game.energyOf(D.id);
  assert.equal(await store.getEnergy(D.id), null);
});

test('énergie : relue au plus tous les energyFor, pas à chaque demande', async () => {
  const { store, social, advance } = setup();
  await friends(social, A, C);
  await store.putEnergy(C.id, { value: 30, keys: [], at: 5_000_000 });
  assert.equal(friend(await social.state(A), C).energy.value, 30);
  await store.putEnergy(C.id, { value: 10, keys: [], at: 5_000_000 });
  assert.equal(friend(await social.state(A), C).energy.value, 30);
  advance(SOCIAL_SERVER.energyFor);
  assert.equal(friend(await social.state(A), C).energy.value < 30, true);
});

test('énergie : affichage, en rouge sous le coût minimum, rien si inconnue', () => {
  assert.match(energyHTML({ value: 42, max: 100 }), /⚡ 42\/100/);
  assert.doesNotMatch(energyHTML({ value: ENERGY.cost.min, max: 100 }), /low/);
  assert.match(energyHTML({ value: ENERGY.cost.min - 1, max: 100 }), /low/);
  assert.equal(energyHTML(undefined), '');
});

test('pastille (31/10) : en prison, vert si le jeu est ouvert, orange sinon ; une session reste orange', () => {
  assert.equal(statusDot({ status:'session', mode:'prison', online:true }), 'on');
  assert.equal(statusDot({ status:'session', mode:'prison', online:false }), 'play');
  assert.equal(statusDot({ status:'session', mode:'mine' }), 'play');
  assert.equal(statusDot({ status:'online' }), 'on');
});

test('inviter un joueur en prison (31/10) : possible s\'il est en ligne (vert), pas page fermée ; le bouton Rejoindre reste fermé', async () => {
  const { social, party, game, advance } = setup();
  await friends(social, A, D);
  game.prisonActiveOf = async id => id === D.id;
  advance(SOCIAL_SERVER.onlineFor + 1);
  let a = await social.state(A);
  assert.deepEqual([friend(a, D).mode, friend(a, D).online, friend(a, D).canInvite], ['prison', false, false], 'page fermée');
  await social.state(D);                                // D ouvre le jeu
  a = await social.state(A);
  assert.deepEqual([friend(a, D).mode, friend(a, D).online, friend(a, D).canInvite, friend(a, D).canJoin], ['prison', true, true, false]);
  await party.invite(A, D.id);
  assert.equal((await party.state(D)).invites.length, 1, 'il reçoit l\'invitation');
});
