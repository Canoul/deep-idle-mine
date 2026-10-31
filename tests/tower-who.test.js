/* « Who ? » (lobby, tour ouverte, 26/10/2026) : joueurs en ligne qui n'ont pas encore fait la tour pendant cette ouverture,
   puis (26/10 au soir) les joueurs hors ligne venus depuis 24 h. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocialService } from '../server/social/service.js';
import { whoRows, seenText } from '../src/ui/lobby.js';
import { canBeInvited } from '../src/shared/party.js';
import { createMemoryStore } from '../server/accounts/store.js';

const ME = { id:'AAAA1111' }, B = { id:'BBBB2222' }, C = { id:'CCCC3333' }, D = { id:'DDDD4444' }, E = { id:'EEEE5555' }, F = { id:'FFFF6666' };
const H = 3600e3;
function setup({ open = true, done = [], inSession = [], recent = null, clock = Date.now } = {}){
  const names = { AAAA1111:'Zoe', BBBB2222:'Max', CCCC3333:'Lou', DDDD4444:'Ana', EEEE5555:'Eva', FFFF6666:'Fred' };
  const store = { _: new Map(), async getSocial(id){ return this._.get(id) ?? null; }, async putSocial(id, v){ this._.set(id, v); },
                  async putSocials(list){ for(const [id, v] of list) this._.set(id, v); } };
  const accounts = { getAccount: async id => names[id] ? { id, name: names[id], displayName: names[id] } : null, findAccountByName: async () => null,
                     ...(recent ? { recentlySeen: async since => Object.fromEntries(Object.entries(recent).filter(([, at]) => at >= since)) } : {}) };
  const game = { towerDone: async side => { if(!['angel', 'demon'].includes(side)) throw Object.assign(new Error('Camp inconnu.'), { code:'bad_request' });
                                            return { open, done: new Set(done) }; },
                 playersInSession: async () => inSession, activeSessionInfo: async id => inSession.includes(id) ? { mode:'mine', leftMs: 60_000 } : null,
                 activeSessionId: async id => inSession.includes(id) ? 's1' : null };
  const party = { groupOf: () => null, invite: async () => {}, joinFriend: async () => ({}) };
  return createSocialService({ store, accounts, party, game, clock });
}

test('Who ? : en ligne et pas encore faite (moi exclu) ; joueur en session compté ; tour fermée = liste vide', async () => {
  const s = setup({ done:[C.id], inSession:[D.id] });
  for(const p of [ME, B, C]) await s.online(p);                 // signes de vie
  const r = await s.towerWho(ME, 'angel');
  assert.equal(r.open, true);
  assert.deepEqual(r.players.map(p => p.id).sort(), [B.id, D.id].sort());
  const closed = await setup({ open:false }).towerWho(ME, 'angel');
  assert.deepEqual(closed, { side:'angel', open:false, count:0, players:[] });
  await assert.rejects(s.towerWho(ME, 'nope'), { code:'bad_request' });
});

test('Who ? : Inviter seulement si pas en session et pas déjà dans mon groupe', () => {
  const list = { players:[{ id:B.id, name:'Max', status:'online' }, { id:C.id, name:'Lou', status:'session' }, { id:D.id, name:'Ana', status:'lobby', size:1, max:3 }] };
  const rows = whoRows(list, { members:[{ account:ME.id }, { account:D.id }] });
  assert.deepEqual(rows.map(r => [r.name, r.canInvite]), [['Max', true], ['Lou', false], ['Ana', false]]);
  assert.match(rows[1].text, /session/i);
});

test('service de jeu : towerDone dit si la tour est ouverte et qui l\'a faite (fermée au départ)', async () => {
  const { createMemoryGameStore } = await import('../server/game/store.js');
  const { createGameService } = await import('../server/game/service.js');
  const { fakeLive } = await import('./helpers.js');
  const game = createGameService({ store: createMemoryGameStore(), liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })), clock: () => Date.UTC(2026, 9, 26, 12) });
  const t = await game.towerDone('angel');
  assert.equal(t.open, false); assert.equal(t.done.size, 0);
});

test("Who ? : aussi les joueurs hors ligne venus depuis 24 h (après ceux en ligne, le plus récent d'abord) ; pas plus vieux, pas ceux qui l'ont faite", async () => {
  const now = Date.UTC(2026, 9, 26, 20);
  /* E venu il y a 3 h, F il y a 30 h, C il y a 1 h mais a fait la tour, D il y a 5 h ; un compte supprimé (ZZZZ) ignoré */
  const s = setup({ done:[C.id], clock: () => now, recent:{ [E.id]: now - 3*H, [F.id]: now - 30*H, [C.id]: now - H, [D.id]: now - 5*H, ZZZZ9999: now - H, [ME.id]: now } });
  for(const p of [ME, B]) await s.online(p);
  const r = await s.towerWho(ME, 'angel');
  assert.deepEqual(r.players.map(p => p.id), [B.id, E.id, D.id]);
  assert.equal(r.online, 1); assert.equal(r.count, 3);
  assert.equal(r.players[1].status, 'offline'); assert.equal(r.players[1].lastSeenAt, now - 3*H);
});

test('Who ? : un joueur parti depuis le dernier démarrage du serveur est retenu en mémoire, à la minute près', async () => {
  let now = Date.UTC(2026, 9, 26, 12);
  const s = setup({ clock: () => now });
  await s.online(B);                                  // signe de vie de Max à 12 h
  now += 2 * H;                                       // 14 h : Max n'est plus en ligne
  await s.online(ME);
  const r = await s.towerWho(ME, 'angel');
  assert.deepEqual(r.players.map(p => [p.id, p.status, p.lastSeenAt]), [[B.id, 'offline', now - 2*H]]);
  now += 23 * H;                                      // plus de 24 h après : oublié
  assert.deepEqual((await s.towerWho(ME, 'angel')).players, []);
});

test('Who ? : hors ligne = pas de bouton Inviter, « vu il y a … »', () => {
  const now = Date.UTC(2026, 9, 26, 12);
  const rows = whoRows({ players:[{ id:E.id, name:'Eva', status:'offline', lastSeenAt: now - 3*H }] }, null, now);
  assert.equal(rows[0].canInvite, false);
  assert.equal(rows[0].text, 'Hors ligne · vu il y a 3 h');
  assert.equal(seenText(now - 25 * 60e3, now), 'Hors ligne · vu il y a 25 min');
  assert.equal(seenText(now, now), 'Hors ligne · vu il y a 1 min');
  assert.equal(seenText(undefined, now), 'Hors ligne');
});

test('stockage des comptes : recentlySeen donne le dernier passage de chaque compte depuis une date', async () => {
  const store = createMemoryStore({ sessions:{ h1:{ accountId:'A', lastSeenAt: 100 }, h2:{ accountId:'A', lastSeenAt: 300 }, h3:{ accountId:'B', lastSeenAt: 50 } } });
  assert.deepEqual(await store.recentlySeen(80), { A: 300 });
  assert.deepEqual(await store.recentlySeen(0), { A: 300, B: 50 });
});

test('Who ? : même règle que Social, un joueur en vert s\'invite (31/10)', () => {
  assert.equal(canBeInvited({ status:'online' }), true);
  assert.equal(canBeInvited({ status:'lobby', size:1, max:3 }), true);
  assert.equal(canBeInvited({ status:'session', mode:'prison', online:true }), true);
  assert.equal(canBeInvited({ status:'session', mode:'prison', online:false }), false);
  assert.equal(canBeInvited({ status:'session', mode:'mine' }), false);
  assert.equal(canBeInvited({ status:'offline' }), false);
  const rows = whoRows({ players:[{ id:'P', name:'Pia', status:'session', mode:'prison', online:true }] }, null);
  assert.equal(rows[0].canInvite, true);
});
