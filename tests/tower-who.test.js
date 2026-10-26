/* « Who ? » (lobby, tour ouverte, 26/10/2026) : joueurs en ligne qui n'ont pas encore fait la tour pendant cette ouverture. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocialService } from '../server/social/service.js';
import { whoRows } from '../src/ui/lobby.js';

const ME = { id:'AAAA1111' }, B = { id:'BBBB2222' }, C = { id:'CCCC3333' }, D = { id:'DDDD4444' };
function setup({ open = true, done = [], inSession = [] } = {}){
  const names = { AAAA1111:'Zoe', BBBB2222:'Max', CCCC3333:'Lou', DDDD4444:'Ana' };
  const store = { _: new Map(), async getSocial(id){ return this._.get(id) ?? null; }, async putSocial(id, v){ this._.set(id, v); },
                  async putSocials(list){ for(const [id, v] of list) this._.set(id, v); } };
  const accounts = { getAccount: async id => names[id] ? { id, name: names[id], displayName: names[id] } : null, findAccountByName: async () => null };
  const game = { towerDone: async side => { if(!['angel', 'demon'].includes(side)) throw Object.assign(new Error('Camp inconnu.'), { code:'bad_request' });
                                            return { open, done: new Set(done) }; },
                 playersInSession: async () => inSession, activeSessionInfo: async id => inSession.includes(id) ? { mode:'mine', leftMs: 60_000 } : null,
                 activeSessionId: async id => inSession.includes(id) ? 's1' : null };
  const party = { groupOf: () => null, invite: async () => {}, joinFriend: async () => ({}) };
  return createSocialService({ store, accounts, party, game });
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
