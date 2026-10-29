/* Le Carreau, la ville du spawn : plan (un bâtiment par onglet, sans chevauchement), place d'un joueur, revérification
   de ce que le navigateur envoie, marche, service du serveur (joueurs en session exclus, moi exclu, départ après
   presentFor, bulles du chat global, apparence relue au plus toutes les lookFor ms), route HTTP. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWN } from '../src/config.js';
import { TABS } from '../src/ui/nav.js';
import { townLayout, TOWN_WIDTH, buildingOf, restX, cleanTownPing, buildingNear, stepToward, hash01, clampX } from '../src/shared/town.js';
import { createTownService } from '../server/town/service.js';
import { townRoutes } from '../server/town/routes.js';
import { TOWN_SERVER } from '../server/config.js';
import { bubbleLines } from '../src/render/town.js';
import { enterTab, mergeOthers } from '../src/ui/town.js';

test('plan : un bâtiment par onglet, de gauche à droite sans chevauchement, dans la ville', () => {
  const { buildings, width } = townLayout();
  assert.deepEqual(new Set(buildings.map(b => b.tab)), new Set(TABS.map(t => t.id)));
  for(let i = 1; i < buildings.length; i++) assert.ok(buildings[i].x >= buildings[i - 1].x + buildings[i - 1].w + TOWN.gap);
  assert.equal(width, TOWN_WIDTH);
  assert.ok(buildings[0].x >= TOWN.margin && buildings.at(-1).x + buildings.at(-1).w + TOWN.margin <= width);
  for(const b of buildings){
    assert.ok(b.door > b.x && b.door < b.x + b.w);
    if(b.kind === 'house') assert.ok(TOWN.ground - b.h - Math.floor(b.w / 2) - 1 >= 0, `${b.name} dépasse du haut de la scène`);
  }
});

test('place : devant la porte de son onglet, écart stable tiré de l\'ID, dans ± spread', () => {
  const four = buildingOf('four');
  const a = restX('four', 'AAAA1111'), b = restX('four', 'BBBB2222');
  assert.equal(a, restX('four', 'AAAA1111'));
  assert.notEqual(a, b);
  for(const x of [a, b]) assert.ok(Math.abs(x - four.door) <= TOWN.spread);
  assert.equal(restX('inconnu', 'AAAA1111'), restX('lobby', 'AAAA1111'));   // onglet inconnu : la place
  for(const s of ['', 'x', 'AAAA1111', '7K3Q-9XHP']){ const h = hash01(s); assert.ok(h >= 0 && h < 1); }
});

test('ping : onglet connu, x fini ramené dans la ville et arrondi ; le reste est refusé', () => {
  assert.deepEqual(cleanTownPing({ spot: 'craft' }), { spot: 'craft', x: null });
  assert.deepEqual(cleanTownPing({ spot: 'craft', x: null }), { spot: 'craft', x: null });
  assert.deepEqual(cleanTownPing({ spot: 'session', x: 12.3456 }), { spot: 'session', x: 12.35 });
  assert.equal(cleanTownPing({ spot: 'session', x: -50 }).x, 1);
  assert.equal(cleanTownPing({ spot: 'session', x: 1e9 }).x, TOWN_WIDTH - 1);
  for(const bad of [null, 'craft', 42, {}, { spot: 'nope' }, { spot: ['craft'] }, { spot: '__proto__' }, { spot: 'constructor' },
                    { spot: 'session', x: NaN }, { spot: 'session', x: Infinity }, { spot: 'session', x: '12' }, { spot: 'session', x: {} }])
    assert.equal(cleanTownPing(bad), null, JSON.stringify(bad));
  assert.equal(clampX(0), 1);
});

test('marche : vitesse de base, long trajet en au plus rush secondes, arrêt pile sur la cible', () => {
  assert.equal(stepToward(10, 20, 0.5, 10), 10 + TOWN.walk * 0.5);
  assert.equal(stepToward(10, 10.1, 1, 0.1), 10.1);
  assert.equal(stepToward(20, 10, 0.5, 10), 20 - TOWN.walk * 0.5);
  /* 100 cases : vitesse 100 / rush, le trajet tient en rush secondes */
  let x = 0, t = 0;
  while(x !== 100 && t < 60){ x = stepToward(x, 100, 0.1, 100); t += 0.1; }
  assert.ok(t <= TOWN.rush + 0.11, `trajet en ${t} s`);
});

test('bâtiment devant soi : le plus proche à moins de reach ; le chevalement mène au Lobby', () => {
  const four = buildingOf('four');
  assert.equal(buildingNear(four.door + 1), four);
  assert.equal(buildingNear(1), null);
  assert.equal(enterTab(buildingOf('session')), 'lobby');
  assert.equal(enterTab(four), 'four');
});

test('joueurs affichés : nouveau venu à sa place, x du serveur = cible seulement, absent retiré', () => {
  const four = { id: 'AAAA1111', name: 'Zoe', spot: 'four', x: null }, walker = { id: 'BBBB2222', name: null, spot: 'session', x: 40 };
  let m = mergeOthers(new Map(), [four, walker]);
  assert.equal(m.get('AAAA1111').x, restX('four', 'AAAA1111'));
  assert.equal(m.get('BBBB2222').x, 40);
  m.get('BBBB2222').x = 41;                                       // il a marché à l'écran
  m = mergeOthers(m, [four, { ...walker, x: 50 }]);
  assert.equal(m.get('AAAA1111').x, restX('four', 'AAAA1111'));   // x: null ne l'efface pas
  assert.deepEqual([m.get('BBBB2222').x, m.get('BBBB2222').tx, m.get('BBBB2222').trip], [41, 50, 9]);
  m = mergeOthers(m, [four]);
  assert.deepEqual([...m.keys()], ['AAAA1111']);
  for(const o of m.values()) assert.ok(Number.isFinite(o.x));
});

test('bulle : lignes coupées, mots trop longs découpés, au plus 3 lignes', () => {
  assert.deepEqual(bubbleLines('salut tout le monde'), ['salut tout le monde']);
  assert.deepEqual(bubbleLines('a'.repeat(30), 22), ['a'.repeat(22), 'a'.repeat(8)]);
  const l = bubbleLines('mot '.repeat(40), 10);
  assert.equal(l.length, 3);
  assert.ok(l[2].endsWith('…'));
});

/* ---------- service du serveur ---------- */
const ACC = { AAAA1111: { id: 'AAAA1111', name: 'Zoe' }, BBBB2222: { id: 'BBBB2222', name: null }, CCCC3333: { id: 'CCCC3333', name: 'Max' } };
const me = id => ACC[id];
function setup(){
  let now = 1_000_000, playing = [], chat = [], looks = 0, sessions = 0;
  const game = {
    playersInSession: async () => { sessions++; return playing; },
    lookFor: async id => { looks++; return { head: 'helmet_' + id }; },
    aurasFor: async () => ({}),
  };
  const town = createTownService({ accounts: { getAccount: async id => ACC[id] ?? null }, game, clock: () => now,
    recentChat: async ms => chat.filter(m => now - m.at <= ms) });
  return { town, advance: ms => { now += ms; }, setPlaying: p => { playing = p; }, say: (account, text) => chat.push({ account, text, at: now }),
           looks: () => looks, sessions: () => sessions };
}

test('service : les autres joueurs avec leur place, moi exclu, pseudo d\'invité', async () => {
  const s = setup();
  await s.town.ping(me('AAAA1111'), { spot: 'four' });
  await s.town.ping(me('BBBB2222'), { spot: 'session', x: 40 });
  const r = await s.town.ping(me('CCCC3333'), { spot: 'craft' });
  const byId = Object.fromEntries(r.players.map(p => [p.id, p]));
  assert.deepEqual(Object.keys(byId).sort(), ['AAAA1111', 'BBBB2222']);
  assert.deepEqual([byId.AAAA1111.spot, byId.AAAA1111.x, byId.AAAA1111.name], ['four', null, 'Zoe']);
  assert.deepEqual([byId.BBBB2222.spot, byId.BBBB2222.x, byId.BBBB2222.name], ['session', 40, 'Invité BBBB']);
  assert.deepEqual(byId.AAAA1111.look, { head: 'helmet_AAAA1111' });
});

test('service : un joueur en session n\'est pas dans la ville ; sans nouvelles depuis presentFor, il part', async () => {
  const s = setup();
  await s.town.ping(me('AAAA1111'), { spot: 'four' });
  await s.town.ping(me('BBBB2222'), { spot: 'lobby' });
  s.setPlaying(['AAAA1111']);
  s.advance(TOWN_SERVER.sessionsFor);
  let r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.deepEqual(r.players.map(p => p.id), ['BBBB2222']);
  s.advance(TOWN_SERVER.presentFor + 1);
  r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.deepEqual(r.players, []);
  assert.equal(s.town.count(), 1);
});

test('service : bulles du chat global de moins de bubbleMs, la mienne à part', async () => {
  const s = setup();
  await s.town.ping(me('AAAA1111'), { spot: 'four' });
  s.say('AAAA1111', 'premier'); s.say('AAAA1111', 'salut !'); s.say('CCCC3333', 'coucou');
  let r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(r.players[0].say, 'salut !');
  assert.equal(r.say, 'coucou');
  s.advance(TOWN.bubbleMs + 1);
  r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(r.players[0].say, null);
  assert.equal(r.say, null);
});

test('service : apparence relue au plus toutes les lookFor ms, joueurs en session lus une fois pour plusieurs pings', async () => {
  const s = setup();
  await s.town.ping(me('AAAA1111'), { spot: 'four' });
  for(let i = 0; i < 5; i++) await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(s.looks(), 1);
  assert.equal(s.sessions(), 1);
  s.advance(TOWN_SERVER.lookFor);
  await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(s.looks(), 2);
});

test('service : place invalide refusée (400), rien d\'enregistré ; route sans compte : 401', async () => {
  const s = setup();
  await assert.rejects(s.town.ping(me('AAAA1111'), { spot: 'nope' }), e => e.status === 400);
  await assert.rejects(s.town.ping(me('AAAA1111'), { spot: 'session', x: 'abc' }), e => e.status === 400);
  assert.equal(s.town.count(), 0);
  const route = townRoutes(s.town)['POST /api/town'];
  await assert.rejects(route({ me: null, body: { spot: 'lobby' } }), e => e.status === 401);
  assert.deepEqual(await route({ me: me('AAAA1111'), body: { spot: 'lobby' } }), { players: [], say: null });
});
