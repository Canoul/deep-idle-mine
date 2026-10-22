/* Recherche de groupe (LFG, mine classique) : règle de remplissage, file, annulation, lancement automatique. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchLfg, queueTime } from '../src/shared/lfg.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { partyRoutes } from '../server/party/routes.js';
import { PARTY_SERVER } from '../server/config.js';
import { fakeLive } from './helpers.js';

const acc = (id, name) => ({ id, name, guest:false });
const A = acc('AAAA1111', 'Zoe'), B = acc('BBBB2222', 'Bob'), C = acc('CCCC3333', 'Max'),
      D = acc('DDDD4444', 'Lou'), E = acc('EEEE5555', 'Eva');
const ACCOUNTS = Object.fromEntries([A, B, C, D, E].map(a => [a.id, a]));
const fakeSummary = rec => ({ id:rec.id, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{ Charbon:1 } })) });

function setup(){
  let now = 5_000_000;
  const clock = () => now;
  const game = createGameService({ store:createMemoryGameStore(), liveRunner:fakeLive(fakeSummary), clock, randomSeed:() => 7 });
  let n = 0;
  const party = createPartyService({ game, clock, getAccount:async id => ACCOUNTS[id] ?? null,
                                     newCode:() => ['K7Q4P2', 'H3XM9T', 'R5B8NC', 'M2W6ZJ'][n++ % 4] });
  return { game, party, advance: ms => { now += ms; } };
}
const names = async (party, me) => (await party.state(me)).party?.members.map(m => m.name) ?? null;

/* ---------- règle pure ---------- */

test('règle : 3 solos → les 2 derniers rejoignent le premier arrivé', () => {
  const q = [{ account:'b', size:1, at:2 }, { account:'a', size:1, at:1 }, { account:'c', size:1, at:3 }];
  const m = matchLfg(q, 3);
  assert.equal(m.host.account, 'a');
  assert.deepEqual(m.guests.map(e => e.account), ['b', 'c']);
  assert.equal(matchLfg(q.slice(0, 2), 3), null, '2 solos : personne ne rejoint personne');
});

test('règle : un groupe de 2 prend le solo le plus ancien, même arrivé avant lui', () => {
  const q = [{ account:'s1', size:1, at:1 }, { account:'s2', size:1, at:2 }, { account:'g', size:2, at:5 }];
  const m = matchLfg(q, 3);
  assert.equal(m.host.account, 'g');
  assert.deepEqual(m.guests.map(e => e.account), ['s1']);
});

test('règle : deux groupes de 2 ne se combinent jamais ; le plus ancien prend le solo', () => {
  assert.equal(matchLfg([{ account:'g1', size:2, at:1 }, { account:'g2', size:2, at:2 }], 3), null);
  const m = matchLfg([{ account:'g2', size:2, at:2 }, { account:'g1', size:2, at:1 }, { account:'s', size:1, at:3 }], 3);
  assert.equal(m.host.account, 'g1');
});

test('règle : 4 solos → les 3 premiers, le 4e attend', () => {
  const q = [1, 2, 3, 4].map(i => ({ account:'s' + i, size:1, at:i }));
  const m = matchLfg(q, 3);
  assert.deepEqual([m.host, ...m.guests].map(e => e.account), ['s1', 's2', 's3']);
});

test('temps de queue lisible', () => {
  assert.equal(queueTime(0), '0:00');
  assert.equal(queueTime(102_000), '1:42');
  assert.equal(queueTime(-5), '0:00');
});

/* ---------- service ---------- */

test('3 solos : le lobby se forme d\'un coup dans celui du premier, avec « groupe trouvé »', async () => {
  const { party, advance } = setup();
  await party.lfg(A); advance(1000);
  const b = await party.lfg(B); advance(1000);
  assert.equal(b.party, null, 'à 2, personne n\'a rejoint personne');
  assert.equal(b.lfg.search.mine, true);
  assert.equal(b.lfg.search.waited, 0);
  const c = await party.lfg(C);
  assert.deepEqual(c.party.members.map(m => m.name), ['Zoe', 'Bob', 'Max']);
  assert.equal(c.party.leader, A.id);
  assert.equal(party.lfgCount(), 0);
  const sa = await party.state(A);
  assert.deepEqual(sa.lfg.found.names, ['Zoe', 'Bob', 'Max']);
  assert.equal(sa.lfg.search, null);
  assert.equal(sa.session, null, 'sans « lancer dès que plein » : le chef lance à la main');
});

test('groupe de 2 entré après un solo : c\'est le solo qui rejoint le groupe', async () => {
  const { party, advance } = setup();
  await party.lfg(A); advance(1000);
  await party.create(C); await party.join(D, 'K7Q4P2');
  const r = await party.lfg(C);
  assert.deepEqual(r.party.members.map(m => m.name), ['Max', 'Lou', 'Zoe']);
  assert.equal(r.party.code, 'K7Q4P2');
});

test('solo qui avait déjà un code (groupe d\'un joueur) : compte comme solo, son groupe vide disparaît', async () => {
  const { party } = setup();
  await party.create(B);                                    // K7Q4P2, seul dedans
  await party.lfg(A); await party.lfg(B); await party.lfg(C);
  assert.deepEqual(await names(party, B), ['Zoe', 'Bob', 'Max']);
  assert.equal(party.count(), 1);
});

test('membre d\'un groupe de 2 : voit la recherche de son chef, sans pouvoir la lancer', async () => {
  const { party } = setup();
  await party.create(C); await party.join(D, 'K7Q4P2');
  await assert.rejects(party.lfg(D), { code:'not_leader' });
  await party.lfg(C, { auto:true });
  const sd = await party.state(D);
  assert.equal(sd.lfg.search.mine, false);
  assert.equal(sd.lfg.search.auto, true);
});

test('groupe complet ou joueur en session : pas de recherche', async () => {
  const { party, game } = setup();
  await party.create(A); await party.join(B, 'K7Q4P2'); await party.join(C, 'K7Q4P2');
  await assert.rejects(party.lfg(A), { code:'party_full' });
  await game.start(D);
  await assert.rejects(party.lfg(D), { code:'session_running' });
});

test('annuler : on sort de la file ; re-cliquer garde sa place (pas de double entrée)', async () => {
  const { party, advance } = setup();
  await party.lfg(A); advance(5000);
  const again = await party.lfg(A);
  assert.equal(again.lfg.search.waited, 5000, 'même place');
  assert.equal(party.lfgCount(), 1);
  await party.lfgCancel(A);
  await party.lfg(B); await party.lfg(C);
  assert.equal(await names(party, B), null, 'A a annulé : B et C attendent toujours');
  assert.equal(party.lfgCount(), 2);
});

test('l\'équipe change pendant la recherche : la recherche du groupe s\'annule', async () => {
  const { party } = setup();
  await party.create(C); await party.join(D, 'K7Q4P2');
  await party.lfg(C);
  await party.leave(D);
  await party.join(E, 'K7Q4P2');                            // même taille, mais pas la même équipe
  await party.lfg(A);
  assert.deepEqual(await names(party, A), null, 'A ne rejoint pas : le groupe C+E n\'a pas demandé');
  assert.equal((await party.state(E)).lfg.search, null);
});

test('onglet fermé : sorti de la file après lfgTimeout sans nouvelles', async () => {
  const { party, advance } = setup();
  await party.lfg(A);
  advance(PARTY_SERVER.lfgTimeout - 1000); await party.state(A);   // le lobby donne signe de vie
  advance(PARTY_SERVER.lfgTimeout - 1000);
  await party.lfg(B);
  assert.equal(party.lfgCount(), 2, 'encore là');
  advance(PARTY_SERVER.lfgTimeout + 1000);
  await party.state(B);
  await party.lfg(C);
  assert.equal(await names(party, C), null, 'A parti : B et C attendent');
});

test('« lancer dès que plein » : seul le choix du chef compte', async () => {
  const { party } = setup();
  await party.lfg(A); await party.lfg(B, { auto:true }); await party.lfg(C, { auto:true });
  assert.equal((await party.state(A)).session, null, 'le chef (A) n\'a pas coché : pas de lancement');

  const t = setup();
  await t.party.lfg(A, { auto:true }); await t.party.lfg(B); const c = await t.party.lfg(C);
  assert.ok(c.session, 'le chef a coché : la session démarre pour tous');
  const sa = await t.party.state(A), sb = await t.party.state(B);
  assert.equal(sa.session, c.session);
  assert.equal(sb.session, c.session);
});

test('« lancer dès que plein » qui échoue : le lobby reste formé, l\'erreur est montrée', async () => {
  const { party, game } = setup();
  await party.lfg(A, { auto:true }); await party.lfg(B);
  const real = game.start;
  game.start = async () => { throw Object.assign(new Error('Le serveur est plein.'), { code:'server_busy' }); };
  await party.lfg(C);
  game.start = real;
  const sa = await party.state(A);
  assert.equal(sa.session, null);
  assert.equal(sa.party.members.length, 3);
  assert.equal(sa.lfg.found.error, 'Le serveur est plein.');
});

test('routes : entrer et annuler (compte requis) ; auto n\'accepte que true', async () => {
  const { party } = setup();
  const r = partyRoutes(party);
  await assert.rejects(r['POST /api/party/lfg']({ me:null, body:{} }), { code:'not_authenticated' });
  const x = await r['POST /api/party/lfg']({ me:A, body:{ auto:'oui' } });
  assert.equal(x.lfg.search.auto, false);
  const y = await r['POST /api/party/lfg/cancel']({ me:A, body:{} });
  assert.equal(y.lfg.search, null);
});

test('redémarrage du serveur : boot change (le navigateur relance sa recherche)', async () => {
  const a = setup(), b = setup();
  assert.notEqual((await a.party.state(A)).lfg.boot, (await b.party.state(A)).lfg.boot);
});
