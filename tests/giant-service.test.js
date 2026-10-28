/* Bloc géant (serveur) : entrer, délai, en même temps qu'une session (27/10), sortir, plein, scores du jour, minuit, récompenses,
   redémarrage, routes HTTP. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createGiantService } from '../server/giant/service.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createApp } from '../server/app.js';
import { SERVER, ROOT } from '../server/config.js';
import { GIANT, GAME } from '../src/config.js';
import { dayEnd, visitDurationMs } from '../src/shared/giant.js';
import { countOf, deserialize } from '../src/meta/inventory.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const A = { id:'AAAA1111', name:'Zoe' }, B = { id:'BBBB2222', name:'Max' }, C = { id:'CCCC3333', name:'Lou' };
const NUGGET = GIANT.nugget.item;   // pépite d'argent (27/10)
const H = 3600e3, VISIT = visitDurationMs(GAME.speed);
const fakeSummary = rec => ({ id:rec.id, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{} })) });

/* now : 26/10/2026 à 10 h, heure de Paris */
function setup({ now = Date.UTC(2026, 9, 26, 9, 0), config = GIANT, store = createMemoryGameStore() } = {}){
  const clock = { now };
  const game = createGameService({ store, liveRunner:fakeLive(fakeSummary), clock: () => clock.now, randomSeed:() => 7 });
  const make = () => createGiantService({ store, game, clock: () => clock.now, config, randomSeed: () => 7 });
  const giant = make();
  return { store, game, giant, make, clock, advance: async (ms, svc = giant) => { const end = clock.now + ms;
    while(clock.now < end){ clock.now = Math.min(end, clock.now + 1000); await svc.pump(); } } };
}
const inv = async (store, id) => deserialize(JSON.stringify(await store.getInventory(id) ?? { v:1, slots:[] }));

test('entrer : une visite, la salle en direct, puis la visite se ferme et ses points vont au jour', async () => {
  const { giant, advance, store } = setup();
  const r = await giant.enter(A);
  assert.ok(r.visit.endsAt > 0);
  assert.equal(r.view.miners.length, 1); assert.equal(r.view.me.id, r.visit.minerId);
  let i = await giant.info(A);
  assert.equal(i.present, 1); assert.deepEqual(i.mine, { points: 0, visits: 1 }); assert.ok(i.visit);
  await assert.rejects(giant.enter(A), { code: 'in_visit' });
  await advance(VISIT / 2);
  i = await giant.info(A);
  assert.ok(i.visit.points > 50 && i.total === i.visit.points, 'points en cours comptés dans le total');
  await advance(VISIT / 2 + 1000);
  i = await giant.info(A);
  assert.equal(i.present, 0); assert.equal(i.visit, null);
  assert.ok(i.total > 120 && i.total < 180, `total ${i.total}`);
  assert.equal(i.mine.points, i.total);
  assert.equal(i.ranking.list[0].name, 'Zoe');
  assert.equal((await store.getGiantPlayer(A.id)).visit, null);
});

test('délai : 3 h depuis la dernière entrée', async () => {
  const { giant, advance, clock } = setup();
  const t0 = clock.now;
  await giant.enter(A);
  await advance(VISIT + 1000);
  await assert.rejects(giant.enter(A), { code: 'cooldown' });
  assert.equal((await giant.info(A)).nextEntry, t0 + 3 * H);
  clock.now = t0 + 3 * H;
  await giant.enter(A);
});

test('session et visite en même temps, dans les deux sens (27/10) : entrer en session, lancer pendant une visite', async () => {
  const { giant, game, advance } = setup();
  await game.start(B, {});
  const r = await giant.enter(B);                                  // B en session entre au Bloc géant
  assert.ok(r.visit.endsAt > 0);
  assert.ok(await game.activeSessionId(B.id), 'sa session continue');
  await giant.enter(A);
  const info0 = await game.activeSessionInfo(A.id);
  assert.equal(info0.mode, 'giant', 'Social : en visite');
  const s = await game.start(A, {});                               // A en visite lance une session
  assert.equal(s.session.players[0].account, A.id);
  assert.ok((await giant.info(A)).visit, 'sa visite continue');
  await advance(VISIT + 1000);
  const i = await giant.info(A);
  assert.equal(i.visit, null); assert.ok(i.mine.points > 100, 'ses points comptent');
  assert.equal((await giant.info(B)).mine.visits, 1);
  assert.ok(await game.activeSessionId(A.id), 'la session dure après la visite');
});

test('mine instantanée pendant une visite : le joueur y entre aussi (27/10)', async () => {
  const { giant, game, clock } = setup();
  await giant.enter(A);
  const r = await game.openInstant('mi-test', clock.now, [{ account: A.id, name: A.name }]);
  assert.ok(r, 'mine ouverte'); assert.ok(await game.activeSessionId(A.id));
  assert.ok((await giant.info(A)).visit, 'la visite continue');
});

test('une visite compte comme une session pour le Social et la liste Online', async () => {
  const { giant, game } = setup();
  await giant.enter(A);
  const info = await game.activeSessionInfo(A.id);
  assert.equal(info.mode, 'giant'); assert.ok(info.leftMs > 0);
  assert.ok((await game.playersInSession()).includes(A.id), 'liste Online du Social');
});

test('sortir avant la fin : les points faits comptent, l\'entrée reste consommée', async () => {
  const { giant, advance } = setup();
  await giant.enter(A);
  await advance(30e3);
  await giant.leave(A);
  const i = await giant.info(A);
  assert.ok(i.mine.points > 20 && i.mine.points < 70, `${i.mine.points}`);
  assert.equal(i.present, 0);
  await assert.rejects(giant.enter(A), { code: 'cooldown' });
  await assert.rejects(giant.leave(A), { code: 'no_visit' });
});

test('plein : maxPlayers mineurs au plus, le délai n\'est pas consommé', async () => {
  const { giant } = setup({ config: { ...GIANT, maxPlayers: 2 } });
  await giant.enter(A); await giant.enter(B);
  await assert.rejects(giant.enter(C), { code: 'full' });
  assert.equal((await giant.info(C)).nextEntry, 0);
});

test('minuit : une visite commencée avant compte pour la session qui se ferme', async () => {
  const late = Date.UTC(2026, 9, 26, 22, 59, 30);          // 23 h 59 min 30 s à Paris
  const { giant, advance, store } = setup({ now: late });
  await giant.enter(A);
  await advance(VISIT + 1000);
  assert.ok((await store.getGiantDay('2026-10-26')).total > 0);
  assert.equal(await store.getGiantDay('2026-10-27'), null);
  assert.equal((await giant.info(A)).day, '2026-10-27');
  assert.equal((await giant.info(A)).total, 0, 'nouvelle session à 0');
});

test('récompense (26/10, ancienne règle : une visite suffit) : jour fini, paliers additionnés, une seule fois', async () => {
  const { giant, advance, store, clock } = setup();
  await giant.enter(A);
  await advance(VISIT + 1000);
  const d = await store.getGiantDay('2026-10-26');
  d.total = 15200;                                          // score collectif du jour (le serveur l'a compté)
  d.scores[A.id].points = 250.7;                            // ses points à lui : 2 pépites d'argent (27/10)
  await store.putGiantDayAndPlayer(d, A.id, await store.getGiantPlayer(A.id));
  assert.deepEqual((await giant.info(A)).rewards, [], 'pas avant la fin de la session');
  clock.now = dayEnd(clock.now) + VISIT + 1;
  const i = await giant.info(A);
  assert.equal(i.rewards.length, 1);
  assert.deepEqual(i.rewards[0].items, { 'Treasure T1': 2, 'Blueprint parts': 45, 'Treasure T2': 2, [NUGGET]: 2 });
  assert.deepEqual((await giant.info(B)).rewards, [], 'B n\'est pas venu');
  const r = await giant.claim(A);
  assert.deepEqual(r.given, { 'Treasure T1': 2, 'Blueprint parts': 45, 'Treasure T2': 2, [NUGGET]: 2 });
  const a = await inv(store, A.id);
  assert.equal(countOf(a, NUGGET), 2);
  assert.equal(countOf(a, 'Treasure T1'), 2); assert.equal(countOf(a, 'Treasure T2'), 2); assert.equal(countOf(a, 'Blueprint parts'), 45);
  assert.deepEqual((await giant.claim(A)).given, {}, 'une seule fois');
  assert.equal(countOf(await inv(store, A.id), 'Treasure T1'), 2);
  assert.equal(countOf(await inv(store, A.id), NUGGET), 2, 'pépites données une seule fois');
  assert.deepEqual((await giant.info(A)).rewards, []);
  assert.deepEqual((await giant.claim(B)).given, {});
  assert.equal(await store.getInventory(B.id), null, 'rien écrit pour B');
});

test('récompense à partir du 27/10 : 2 visites au moins dans la journée (une seule : rien)', async () => {
  const { giant, advance, store, clock } = setup({ now: Date.UTC(2026, 9, 27, 6, 0) });   // 27/10 à 7 h, Paris
  await giant.enter(A); await giant.enter(B);
  await advance(VISIT + 1000);
  let i = await giant.info(A);
  assert.equal(i.minVisits, 2); assert.equal(i.mine.visits, 1);
  clock.now += 3 * H;                                              // 10 h : A revient, pas B
  await giant.enter(A); await advance(VISIT + 1000);
  assert.equal((await giant.info(A)).mine.visits, 2);
  const d = await store.getGiantDay('2026-10-27'); d.total = 1500; d.scores[A.id].points = 99; d.scores[B.id].points = 500;
  await store.putGiantDayAndPlayer(d, A.id, await store.getGiantPlayer(A.id));
  clock.now = dayEnd(clock.now) + VISIT + 1;
  assert.deepEqual((await giant.info(A)).rewards.map(r => r.items), [{ 'Treasure T1': 1 }], 'A : 2 visites, 99 points = 0 pépite');
  assert.deepEqual((await giant.info(B)).rewards, [], 'B : une seule visite (ni palier ni pépite, même avec 500 points)');
  assert.deepEqual((await giant.claim(B)).given, {}, 'B ne peut rien réclamer');
  assert.equal(countOf(await inv(store, A.id), 'Treasure T1'), 0);
  assert.deepEqual((await giant.claim(A)).given, { 'Treasure T1': 1 });
});

test('récompense : sous le premier palier, seulement les pépites d\'argent (rien sous 100 points)', async () => {
  const { giant, advance, clock, store } = setup();
  await giant.enter(A); await giant.enter(B);
  await advance(VISIT + 1000);
  const d = await store.getGiantDay('2026-10-26');
  assert.ok(d.total < 1000);
  d.scores[A.id].points = 340; d.scores[B.id].points = 99.9;
  await store.putGiantDayAndPlayer(d, A.id, await store.getGiantPlayer(A.id));
  clock.now = dayEnd(clock.now) + VISIT + 1;
  assert.deepEqual((await giant.info(A)).rewards.map(r => r.items), [{ [NUGGET]: 3 }]);
  assert.deepEqual((await giant.info(B)).rewards, [], '99,9 points : rien');
  assert.deepEqual((await giant.claim(A)).given, { [NUGGET]: 3 });
  assert.deepEqual((await giant.claim(A)).given, {}, 'une seule fois');
});

test('carte : mes pépites d\'argent du jour', async () => {
  const { giant, advance } = setup();
  await giant.enter(A);
  await advance(VISIT + 1000);
  const i = await giant.info(A);
  assert.equal(i.nugget.item, NUGGET); assert.equal(i.nugget.per, GIANT.nugget.per);
  assert.equal(i.nugget.n, Math.floor(i.mine.points / GIANT.nugget.per));
  assert.ok(i.nugget.n >= 1, `${i.mine.points} points en une visite`);
});

test('redémarrage du serveur : la visite reprend avec le temps restant et ses points enregistrés', async () => {
  const s = setup();
  await s.giant.enter(A);
  await s.advance(40e3);                                   // points enregistrés toutes les 10 s
  const saved = (await s.store.getGiantPlayer(A.id)).visit.points;
  assert.ok(saved > 30, `${saved}`);
  const giant2 = s.make();                                 // le serveur redémarre : nouvelle salle, même stockage
  const i = await giant2.info(A);
  assert.equal(i.present, 1); assert.ok(i.visit.points >= Math.floor(saved));
  await s.advance(VISIT, giant2);
  const after = await giant2.info(A);
  assert.equal(after.present, 0);
  assert.ok(after.total > saved + 30 && after.total < 200, `${after.total}`);
});

test('redémarrage après la fin d\'une visite : close avec ses points enregistrés', async () => {
  const s = setup();
  await s.giant.enter(A);
  await s.advance(20e3);
  const saved = (await s.store.getGiantPlayer(A.id)).visit.points;
  s.clock.now += VISIT;                                    // serveur arrêté pendant la fin de la visite
  const i = await s.make().info(A);
  assert.equal(i.present, 0); assert.equal(i.total, Math.floor(saved));
});

test('routes HTTP : connecté seulement, entrer, voir, sortir, réclamer', async () => {
  const store = createMemoryStore();
  const accounts = createAccountService({ store, scrypt: FAST_SCRYPT });
  const { game, giant } = setup();
  const server = http.createServer(createApp({ store, service: accounts, game, giant, root: ROOT, config: { ...SERVER, logProxyCheck:false } }));
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => { let cookie = ''; return async (method, path, body) => {
    const res = await fetch(base + path, { method, headers:{ 'content-type':'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie'); if(set) cookie = set.split(';')[0];
    return { status: res.status, data: res.status === 204 ? null : await res.json() };
  }; };
  try {
    assert.equal((await client()('GET', '/api/giant')).status, 401);
    const zoe = client();
    await zoe('POST', '/api/account/register', { name:'Zoe', password:'motdepasse-zoe' });
    let r = await zoe('GET', '/api/giant');
    assert.equal(r.status, 200); assert.equal(r.data.present, 0);
    r = await zoe('POST', '/api/giant/enter');
    assert.equal(r.status, 200);
    r = await zoe('GET', '/api/giant/view');
    assert.equal(r.data.miners.length, 1); assert.equal(r.data.miners[0].name, 'Zoe'); assert.ok(r.data.me);
    r = await zoe('POST', '/api/giant/enter');
    assert.equal(r.status, 409);
    assert.equal((await zoe('POST', '/api/giant/leave')).status, 200);
    r = await zoe('POST', '/api/giant/claim');
    assert.equal(r.status, 200); assert.deepEqual(r.data.given, {});
    assert.ok(Array.isArray(r.data.inventory?.slots), 'l\'inventaire revient avec la réclamation : le navigateur l\'affiche sans actualiser');
  } finally { server.close(); }
});

test('redémarrage : la première vue de la salle voit déjà la visite reprise (26/10 : le navigateur croyait la visite finie)', async () => {
  const s = setup();
  await s.giant.enter(A);
  await s.advance(30e3);
  const giant2 = s.make();                                 // redémarrage, et la vue arrive avant toute autre demande
  const v = await giant2.view(A);
  assert.ok(v.me, 'visite toujours en cours');
  assert.ok(v.me.points > 20);
});

test('fin de visite : le serveur donne les points de la dernière visite (écran de fin)', async () => {
  const { giant, advance } = setup();
  await giant.enter(A);
  assert.equal((await giant.info(A)).lastVisit, null, 'pendant la visite : rien');
  await advance(VISIT + 1000);
  const i = await giant.info(A);
  assert.equal(i.lastVisit.points, i.mine.points);
  assert.equal(i.lastVisit.day, i.day);
});

test('fin de visite : deux visites dans la journée, lastVisit = la dernière seule, jour = somme', async () => {
  const { giant, advance, clock } = setup();
  await giant.enter(A);
  await advance(VISIT + 1000);
  const first = (await giant.info(A)).lastVisit.points;
  clock.now += 3 * 3600e3;
  await giant.enter(A);
  await advance(VISIT + 1000);
  const i = await giant.info(A);
  assert.ok(i.lastVisit.points > 0 && i.lastVisit.points < i.mine.points, 'deuxième visite seule');
  assert.ok(Math.abs(i.mine.points - first - i.lastVisit.points) <= 1, 'jour = somme des visites');
});
