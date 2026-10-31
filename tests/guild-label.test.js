/* Nom de guilde sous le pseudo, au-dessus de la tête : dans la mine, en prison et dans le Carreau. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { labelLines, LABEL_GUILD_H } from '../src/render/miner-sprite.js';
import { minerSpecs } from '../src/shared/game.js';
import { runRecord, newPrisonRecord } from '../src/shared/prison.js';
import { newSession } from '../src/sim/session.js';
import { minerView } from '../src/shared/view.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createGuildService } from '../server/guild/service.js';
import { createTownService } from '../server/town/service.js';
import { mergeOthers } from '../src/ui/town.js';
import { fakeLive } from './helpers.js';

const ZOE = { id:'AAAA1111', name:'Zoe', guest:false }, MAX = { id:'BBBB2222', name:'Max', guest:false };

test('lignes : pseudo seul sans guilde ; avec guilde, pseudo au-dessus, guilde dessous, en plus petit', () => {
  const one = labelLines('Canoul', null);
  assert.deepEqual(one.map(l => [l.text, l.dy]), [['Canoul', 0]]);
  const two = labelLines('Canoul', 'VI République');
  assert.deepEqual(two.map(l => l.text), ['Canoul', '< VI République >']);
  assert.equal(two[1].dy, 0, 'guilde juste au-dessus de la tête');
  assert.equal(two[0].dy, -LABEL_GUILD_H, 'pseudo remonté d\'une ligne');
  assert.ok(parseInt(two[1].font.match(/(\d+)px/)[1]) < parseInt(two[0].font.match(/(\d+)px/)[1]));
  assert.ok(parseInt(two[1].font.match(/(\d+)px/)[1]) >= 7, 'reste lisible');
});

test('mineur : le nom de guilde du joueur le suit ; aucun pour un mineur de test', () => {
  const specs = minerSpecs({ players:[{ account:ZOE.id, name:'Zoe', guild:'Les Rois' }, { account:MAX.id, name:'Max' }], bots:1 });
  assert.deepEqual(specs.map(s => s.guild ?? null), ['Les Rois', null, null]);
});

test('vue de la partie : le nom de guilde arrive au navigateur', () => {
  const G = newSession(1, { miners:minerSpecs({ players:[{ account:ZOE.id, name:'Zoe', guild:'Les Rois' }], bots:0 }) });
  assert.equal(minerView(G, G.miners[0]).guild, 'Les Rois');
});

test('prison : la guilde figée au lancement suit chaque run', () => {
  const p = newPrisonRecord({ id:'p1', account:ZOE.id, seed:1, specs:{ name:'Zoe', guild:'Les Rois' }, now:1 });
  assert.equal(runRecord(p).players[0].guild, 'Les Rois');
});

test('lancement : le nom de guilde est figé dans la session', async () => {
  const store = createMemoryGameStore();
  const game = createGameService({ store, clock:() => 1000, dev:false, randomSeed:() => 1, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })),
    guildNameOf:async id => id === ZOE.id ? 'Les Rois' : null });
  const r = await game.start(ZOE, {});
  assert.equal((await store.getGameSession(r.id ?? r.session?.id)).players[0].guild, 'Les Rois');
});

test('service : nameOf donne la guilde d\'un joueur, null sinon', async () => {
  const guild = createGuildService({ store:createMemoryGameStore(), statusOf:async () => ({ status:'offline' }),
    accounts:{ getAccount:async () => ZOE, findAccountByName:async () => null } });
  await guild.create(ZOE, 'Les Rois');
  assert.equal(await guild.nameOf(ZOE.id), 'Les Rois');
  assert.equal(await guild.nameOf(MAX.id), null);
});

test('Carreau : ma guilde et celle des autres', async () => {
  const town = createTownService({ accounts:{ getAccount:async id => [ZOE, MAX].find(a => a.id === id) }, game:{}, clock:() => 1000,
    guildNameOf:async id => id === MAX.id ? 'Les Rois' : 'Les Nains' });
  await town.ping(MAX, { spot:'lobby', x:5 });
  const r = await town.ping(ZOE, { spot:'lobby', x:6 });
  assert.equal(r.guild, 'Les Nains');
  assert.equal(r.players[0].guild, 'Les Rois');
});

test('Carreau : la guilde reçue reste sur le joueur affiché', () => {
  const list = [{ id:MAX.id, name:'Max', guild:'Les Rois', spot:'lobby', x:5 }];
  const out = mergeOthers(new Map(), list, 1000);
  assert.equal([...out.values()][0].guild, 'Les Rois');
});
