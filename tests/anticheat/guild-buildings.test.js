/* Dons aux bâtiments de guilde, anti-triche : quantités invalides, double envoi, dons simultanés, vrai inventaire. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GUILD } from '../../src/config.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGuildService } from '../../server/guild/service.js';
import { createInventory, addItem, countOf } from '../../src/meta/inventory.js';
import { spendFor } from '../../src/meta/craft.js';

const acc = (id, name) => ({ id:id.repeat(8), name, guest:false });
const ZOE = acc('A', 'Zoe'), MAX = acc('B', 'Max'), BOB = acc('C', 'Bob');
const ALL = [ZOE, MAX, BOB];
const COST = GUILD.buildings.find(b => b.id === 'forge').levels[0].cost.Diamant;
let ops = 0; const op = () => `op-anti-${++ops}`;

/* vrai inventaire (spendFor), avec une attente : deux dons se chevauchent vraiment */
function setup(stock){
  const invs = new Map(), store = createMemoryGameStore();
  for(const [id, qty] of Object.entries(stock)){ const inv = createInventory(); addItem(inv, 'Diamant', qty); invs.set(id, inv); }
  const guild = createGuildService({ store, makeId:() => 'g1',
    accounts:{ getAccount: async id => ALL.find(a => a.id === id) ?? null, findAccountByName: async () => null },
    statusOf: async () => ({ status:'offline' }),
    spend: async (id, item, qty, opId) => { await new Promise(r => setTimeout(r, 1)); return spendFor(invs.get(id), item, qty, opId); } });
  return { guild, invs, store };
}
const diamonds = async (guild, me) => (await guild.view(me)).mine.buildings.find(b => b.id === 'forge').materials.find(m => m.item === 'Diamant').have;
const give = (guild, me, qty, opId = op(), extra = {}) => guild.give(me, { building:'forge', item:'Diamant', qty, opId, ...extra });

test('quantités et objets invalides refusés, rien ne bouge', async () => {
  const { guild, invs } = setup({ [ZOE.id]:100 });
  await guild.create(ZOE, 'Les Mineurs');
  for(const qty of [0, -5, 1.5, NaN, Infinity, '10', null, 1e15]) await assert.rejects(give(guild, ZOE, qty), e => e.code === 'bad_qty', String(qty));
  await assert.rejects(give(guild, ZOE, 1, op(), { item:'Pierre' }), e => e.code === 'bad_item');
  await assert.rejects(give(guild, ZOE, 1, op(), { item:'__proto__' }), e => e.code === 'bad_item');
  await assert.rejects(give(guild, ZOE, 1, op(), { building:'faux' }), e => e.code === 'bad_request');
  await assert.rejects(give(guild, ZOE, 1, 'x'), e => e.code === 'bad_request');
  assert.equal(countOf(invs.get(ZOE.id), 'Diamant'), 100);
  assert.equal(await diamonds(guild, ZOE), 0);
});

test('don sans la matière : refusé, et la place réservée se libère', async () => {
  const { guild, invs } = setup({ [ZOE.id]:10 });
  await guild.create(ZOE, 'Les Mineurs');
  await assert.rejects(give(guild, ZOE, 11), e => e.code === 'not_enough');
  assert.equal(countOf(invs.get(ZOE.id), 'Diamant'), 10);
  await give(guild, ZOE, COST > 10 ? 10 : COST);
  assert.equal(await diamonds(guild, ZOE), 10);
});

test('même demande renvoyée : retirée et comptée une seule fois', async () => {
  const { guild, invs } = setup({ [ZOE.id]:100 });
  await guild.create(ZOE, 'Les Mineurs');
  const id = op();
  await Promise.all([give(guild, ZOE, 40, id), give(guild, ZOE, 40, id)].map(p => p.catch(() => null)));
  await give(guild, ZOE, 40, id);
  assert.equal(countOf(invs.get(ZOE.id), 'Diamant'), 60);
  assert.equal(await diamonds(guild, ZOE), 40);
  assert.equal((await guild.view(ZOE)).mine.log.rows.length, 1);
});

test('dons simultanés sur le dernier manque : la matière se conserve, jamais au-dessus du coût', async () => {
  const { guild, invs } = setup({ [ZOE.id]:COST, [MAX.id]:COST });
  await guild.create(ZOE, 'Les Mineurs');
  await guild.invite(ZOE, 'Max').catch(() => null);
  const g = (await guild.view(ZOE)).mine;
  await guild.request(MAX, g.id); await guild.acceptRequest(ZOE, MAX.id);
  await give(guild, ZOE, COST - 50);
  const res = await Promise.allSettled([give(guild, ZOE, 50), give(guild, MAX, 50)]);
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  const total = await diamonds(guild, ZOE), left = countOf(invs.get(ZOE.id), 'Diamant') + countOf(invs.get(MAX.id), 'Diamant');
  assert.equal(total, COST);
  assert.equal(total + left, COST * 2);
});

test('un joueur hors de la guilde ne donne rien, un membre ne construit pas', async () => {
  const { guild, invs } = setup({ [BOB.id]:10 });
  await assert.rejects(give(guild, BOB, 5), e => e.code === 'no_guild');
  assert.equal(countOf(invs.get(BOB.id), 'Diamant'), 10);
  await assert.rejects(guild.build(BOB, 'forge'), e => e.code === 'no_guild');
});

test('la guilde disparaît pendant un don : rien ne plante, le don reste définitif', async () => {
  const { guild, invs, store } = setup({ [ZOE.id]:10 });
  await guild.create(ZOE, 'Les Mineurs');
  const p = give(guild, ZOE, 5);
  await guild.leave(ZOE);
  await p.catch(() => null);
  assert.equal(countOf(invs.get(ZOE.id), 'Diamant'), 5);
  assert.equal((await store.getGuildLog('g1', 0)).length, 1);
});
