/* Groupes en formation et cadenas (31/10/2026, Geoffrey) : la liste du lobby, l'activité annoncée par le chef, le groupe
   verrouillé fermé aux non-invités par tous les chemins. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME } from '../src/config.js';
import { lobbyLabel } from '../src/shared/chat.js';
import { peekHTML, peekStatus } from '../src/ui/chat-lobby.js';
import { formingHTML } from '../src/ui/forming.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { PARTY_SERVER } from '../server/config.js';
import { fakeLive } from './helpers.js';

const A = { id:'AAAA1111', name:'Zoe', guest:false };
const B = { id:'BBBB2222', name:'Noa', guest:false };
const C = { id:'CCCC3333', name:'Max', guest:false };
const D = { id:'DDDD4444', name:'Lou', guest:false };
const ACCOUNTS = Object.fromEntries([A, B, C, D].map(a => [a.id, a]));
const fakeSummary = rec => ({ id:rec.id, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{ Charbon:1 } })) });

function setup({ saved = null } = {}){
  let now = 5_000_000, n = 0;
  const clock = () => now;
  const game = createGameService({ store:createMemoryGameStore(), liveRunner:fakeLive(fakeSummary), clock, randomSeed:() => 7 });
  const store = saved;
  const party = createPartyService({ game, clock, store, getAccount:async id => ACCOUNTS[id] ?? null,
                                     newCode:() => ['K7Q4P2', 'H3XM9T', 'R5B8NC', 'W2M6JD'][n++ % 4] });
  return { game, party, advance: ms => { now += ms; } };
}
const codes = async (party, me) => (await party.forming(me)).groups.map(g => g.code);
const code = (r) => r.party.code;

test('la liste : groupes de 1 ou 2 joueurs, ni le sien ni un groupe plein ; il sort dès qu\'il se remplit', async () => {
  const { party } = setup();
  const k = code(await party.create(A));
  assert.deepEqual(await codes(party, A), [], 'pas son propre groupe');
  assert.deepEqual(await codes(party, D), [k], 'un joueur seul dans son groupe');
  await party.join(B, k);
  const g = (await party.forming(D)).groups[0];
  assert.equal(g.size, 2); assert.equal(g.max, GAME.maxPlayers);
  assert.deepEqual(g.members.map(m => [m.name, m.leader]), [['Zoe', true], ['Noa', false]]);
  assert.ok(g.members.every(m => m.look && m.auras), 'de quoi dessiner le portrait');
  await party.join(C, k);
  assert.deepEqual(await codes(party, D), [], 'plein : il sort tout de suite, même avec les portraits gardés');
  await party.leave(C);
  assert.deepEqual(await codes(party, D), [k], 'une place se libère : il revient');
});

test('la liste : les groupes les plus remplis d\'abord, et une taille bornée', async () => {
  const { party } = setup();
  const k1 = code(await party.create(A)), k2 = code(await party.create(B));
  await party.join(C, k2);
  assert.deepEqual(await codes(party, D), [k2, k1]);
});

test('la liste : un portrait gardé suit quand même le titre de chef', async () => {
  const { party } = setup();
  const k = code(await party.create(A));
  await party.join(B, k);
  await party.forming(D);
  await party.promote(A, B.id);
  const g = (await party.forming(D)).groups[0];
  assert.deepEqual(g.members.map(m => m.leader), [false, true]);
});

test('la liste : chef absent, session ou prison en cours : le groupe n\'y est pas', async () => {
  const { party, advance } = setup();
  const k = code(await party.create(A));
  advance(PARTY_SERVER.awayAfter + 1);
  assert.deepEqual(await codes(party, D), [], 'chef parti');
  await party.state(A);
  assert.deepEqual(await codes(party, D), [k]);
  await party.launch(A, {});
  assert.deepEqual(await codes(party, D), [], 'en session');
  const { party:p2 } = setupPrison();
  const k2 = code(await p2.create(B));
  assert.ok(k2);
  assert.deepEqual(await codes(p2, D), [], 'en prison');
});
function setupPrison(){
  const game = { activeSessionId: async () => null, prisonActiveOf: async () => true };
  return { party: createPartyService({ game, clock:() => 5_000_000, getAccount:async id => ACCOUNTS[id] ?? null, newCode:() => 'Z9Z9Z9' }) };
}

test('l\'activité : celle du chef, un membre ne la change pas, inconnue au début, gardée au redémarrage', async () => {
  const { party } = setup();
  const k = code(await party.create(A));
  assert.equal((await party.forming(D)).groups[0].mode, null);
  await party.activity(A, { mode:'instance_1', level:2 });
  let g = (await party.forming(D)).groups[0];
  assert.deepEqual([g.mode, g.level], ['instance_1', 2]);
  await party.join(B, k);
  assert.deepEqual(await party.activity(B, { mode:'mine' }), { ok:false });
  g = (await party.forming(D)).groups[0];
  assert.equal(g.mode, 'instance_1');
  await party.activity(A, { mode:'<b>' });
  assert.equal((await party.forming(D)).groups[0].mode, 'mine', 'inconnue : ramenée à la mine');
  await party.activity(A, {});
  assert.equal((await party.forming(D)).groups[0].mode, null, 'retour au menu');
  assert.equal(lobbyLabel({ mode:null, level:1, size:1, max:3 }), 'Activité à choisir 1/3');
});

test('le cadenas : jamais posé par défaut, le chef seul, valeur stricte', async () => {
  const { party } = setup();
  const r = await party.create(A);
  assert.equal(r.party.locked, false);
  await party.join(B, code(r));
  await assert.rejects(party.lock(B, true), e => e.code === 'not_leader');
  await assert.rejects(party.lock(C, true), e => e.code === 'no_party');
  for(const bad of ['true', 1, null, undefined]) await assert.rejects(party.lock(A, bad), e => e.code === 'bad_request');
  assert.equal((await party.lock(A, true)).party.locked, true);
  assert.equal((await party.state(B)).party.locked, true, 'les membres le voient');
  assert.equal((await party.lock(A, false)).party.locked, false);
});

test('verrouillé : hors de la liste, refusé par code et par ami ; un invité entre', async () => {
  const { party } = setup();
  const k = code(await party.create(A));
  await party.lock(A, true);
  assert.deepEqual(await codes(party, D), []);
  await assert.rejects(party.join(C, k), e => e.code === 'party_locked' && e.status === 403);
  await assert.rejects(party.joinFriend(C, A), e => e.code === 'party_locked');
  assert.equal((await party.state(A)).party.members.length, 1);
  await party.invite(A, D.id);
  assert.equal((await party.join(D, k)).party.members.length, 2, 'invité par le chef');
  await party.lock(A, false);
  assert.equal((await party.join(C, k)).party.members.length, 3, 'rouvert');
});

test('verrouillé : l\'aperçu d\'un lien le dit, plus de pub ni de recherche de groupe', async () => {
  const { party } = setup();
  const k = code(await party.create(A));
  await party.lfg(A, {});
  assert.ok(party.searching(A.id));
  const r = await party.lock(A, true);
  assert.equal(party.searching(A.id), false, 'la recherche s\'arrête');
  assert.equal(r.lfg.search, null);
  await assert.rejects(party.lfg(A, {}), e => e.code === 'party_locked');
  await assert.rejects(party.chatLink(A, { mode:'mine', level:1 }), e => e.code === 'party_locked');
  const peek = await party.peek(k);
  assert.equal(peek.locked, true);
  assert.equal(peekStatus({ ...peek, open:true }), 'Groupe verrouillé');
  assert.equal(party.groupOf(A.id).locked, true);
});

test('le cadenas ne suit personne : un nouveau groupe, même créé par le même chef, est ouvert', async () => {
  const { party } = setup();
  await party.create(A);
  await party.lock(A, true);
  await party.leave(A);
  assert.equal((await party.state(A)).party, null);
  const k2 = await party.create(A);
  assert.equal(k2.party.locked, false);
  assert.deepEqual(await codes(party, D), [code(k2)]);
  const k3 = code(await party.create(B));
  await party.lock(B, true);
  await party.invite(B, C.id);
  await party.join(C, k3);
  await party.join(B, code(k2));   // B quitte le groupe verrouillé pour le groupe ouvert : rien ne le suit
  assert.equal((await party.state(A)).party.locked, false);
});

test('redémarrage du serveur : le cadenas et l\'activité restent', async () => {
  const data = new Map();
  const store = { getParties: async () => [...data.values()], putParty: async (c, v) => { data.set(c, v); }, deleteParty: async c => { data.delete(c); },
                  getAlwaysReady: async () => [], setAlwaysReady: async () => {} };
  const a = setup({ saved:store });
  const k = code(await a.party.create(A));
  await a.party.lock(A, true);
  await a.party.activity(A, { mode:'instance_1', level:1 });
  const b = setup({ saved:store });
  await b.party.load();
  await assert.rejects(b.party.join(C, k), e => e.code === 'party_locked');
  await b.party.lock(A, false);
  assert.equal((await b.party.forming(D)).groups[0].mode, 'instance_1');
});

test('affichage : la fenêtre échappe les pseudos et dit quand il n\'y a rien', () => {
  const g = { code:'K7Q4P2', mode:'instance_1', level:1, open:true, size:1, max:3, members:[{ name:'<Zoe>', leader:true }] };
  const h = formingHTML([g], null);
  assert.match(h, /data-group="K7Q4P2"/);
  assert.match(h, /&lt;Zoe&gt;/); assert.doesNotMatch(h, /<Zoe>/);
  assert.match(h, /Instance I 1\/3/);
  assert.match(h, /Clique pour rejoindre/);
  assert.equal((peekHTML(g).match(/Place libre/g) ?? []).length, 2);
  assert.match(h, /Proposer mon groupe/, 'sans groupe');
  assert.match(formingHTML([], { locked:true, members:[{}], max:3 }), /verrouillé/);
  assert.match(formingHTML([], { members:[{}], max:3 }), /Aucun groupe en formation/);
});
