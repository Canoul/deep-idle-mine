/* Guilde, anti-triche : droits revérifiés par le serveur, entrées invalides, double clic, places disputées. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GUILD } from '../../src/config.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGuildService } from '../../server/guild/service.js';
import { nameKey } from '../../src/shared/account.js';

const acc = (id, name) => ({ id:id.repeat(8), name, guest:false });
const ZOE = acc('A', 'Zoe'), MAX = acc('B', 'Max'), LEA = acc('C', 'Lea'), TOM = acc('D', 'Tom'), BOB = acc('F', 'Bob'), OTT = acc('G', 'Ott');
const ALL = [ZOE, MAX, LEA, TOM, BOB, OTT];

function setup(accounts = ALL){
  let now = 1000, n = 0; const store = createMemoryGameStore();
  const guild = createGuildService({ store, clock:() => now++, makeId:() => `g${++n}`,
    accounts:{ getAccount: async id => accounts.find(a => a.id === id) ?? null, findAccountByName: async k => accounts.find(a => nameKey(a.name) === k) ?? null },
    statusOf: async () => ({ status:'offline' }) });
  return { guild, store };
}
const rejects = (p, code) => assert.rejects(p, e => e.code === code);
/* Zoe chef, Max et Tom officiers, Lea membre */
async function team(){
  const s = setup(), { guild } = s;
  await guild.create(ZOE, 'Les Rois');
  for(const p of [MAX, TOM, LEA]){ await guild.invite(ZOE, p.name); await guild.acceptInvite(p, 'g1'); }
  await guild.promote(ZOE, MAX.id); await guild.promote(ZOE, TOM.id);
  return s;
}

test('membre : invite, kick, promote, acceptation refusés', async () => {
  const { guild } = await team();
  await guild.request(BOB, 'g1');
  await rejects(guild.invite(LEA, 'Ott'), 'forbidden');
  await rejects(guild.kick(LEA, MAX.id), 'forbidden');
  await rejects(guild.promote(LEA, LEA.id), 'forbidden');
  await rejects(guild.acceptRequest(LEA, BOB.id), 'forbidden');
  await rejects(guild.refuseRequest(LEA, BOB.id), 'forbidden');
});

test('officier : kick d\'un officier, demote, transfer, actions sur le chef refusés', async () => {
  const { guild } = await team();
  await rejects(guild.kick(MAX, TOM.id), 'forbidden');
  await rejects(guild.demote(MAX, TOM.id), 'forbidden');
  await rejects(guild.transfer(MAX, LEA.id), 'forbidden');
  await rejects(guild.kick(MAX, ZOE.id), 'forbidden');
  assert.equal((await guild.view(ZOE)).mine.rank, 'chief');
});

test('joueur extérieur : aucune action sur la guilde', async () => {
  const { guild } = await team();
  for(const act of ['promote', 'demote', 'kick', 'transfer', 'acceptRequest', 'refuseRequest'])
    await rejects(guild[act](BOB, LEA.id), 'no_guild');
  await rejects(guild.invite(BOB, 'Ott'), 'no_guild');
});

test('un joueur d\'une autre guilde reste hors d\'atteinte', async () => {
  const { guild } = await team();
  await guild.create(BOB, 'Les Nains');
  await rejects(guild.kick(ZOE, BOB.id), 'not_member');
  await rejects(guild.promote(ZOE, BOB.id), 'not_member');
  await rejects(guild.transfer(ZOE, BOB.id), 'not_member');
});

test('id ou nom invalides : refus 400, fiche inchangée', async () => {
  const { guild, store } = await team();
  const before = JSON.stringify(await store.getGuilds());
  for(const bad of [42, null, {}, [], 'x'.repeat(1000)]){
    for(const act of ['promote', 'demote', 'kick', 'transfer', 'acceptRequest', 'refuseRequest']) await rejects(guild[act](ZOE, bad), 'bad_request');
    await rejects(guild.acceptInvite(BOB, bad), 'bad_request');
    await rejects(guild.request(BOB, bad), 'bad_request');
    await rejects(guild.create(BOB, bad), 'bad_name');
    await rejects(guild.invite(ZOE, bad), 'bad_name');
  }
  await rejects(guild.create(BOB, 'Les\u0007Nains'), 'bad_name');
  assert.equal(JSON.stringify(await store.getGuilds()), before);
});

test('recherche : texte invalide ignoré', async () => {
  const { guild } = await team();
  assert.equal((await guild.list(BOB, 42)).guilds.length, 1);
});

test('double clic : une seule entrée, second appel sans erreur', async () => {
  const { guild } = await team();
  await guild.request(BOB, 'g1');
  await guild.acceptRequest(MAX, BOB.id); await guild.acceptRequest(TOM, BOB.id);
  assert.equal((await guild.view(ZOE)).mine.members.filter(m => m.id === BOB.id).length, 1);
  await guild.invite(ZOE, 'Ott'); await guild.acceptInvite(OTT, 'g1'); await guild.acceptInvite(OTT, 'g1');
  await guild.promote(ZOE, OTT.id); await guild.promote(ZOE, OTT.id);
  await guild.kick(ZOE, OTT.id); await guild.kick(ZOE, OTT.id);
  await guild.leave(BOB); await guild.leave(BOB);
  assert.equal((await guild.view(ZOE)).mine.members.length, 4);
});

test('deux acceptations simultanées sur la dernière place : jamais plus que le maximum', async () => {
  const alpha = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const many = Array.from({ length:GUILD.maxMembers + 1 }, (_, i) => ({ id:alpha[i % 32] + alpha[i >> 5] + 'ZZZZZZ', name:'Joueur' + i, guest:false }));
  const { guild } = setup(many);
  await guild.create(many[0], 'Les Rois');
  for(const p of many.slice(1)) await guild.invite(many[0], p.name);
  for(const p of many.slice(1, -2)) await guild.acceptInvite(p, 'g1');
  const r = await Promise.allSettled([guild.acceptInvite(many.at(-2), 'g1'), guild.acceptInvite(many.at(-1), 'g1')]);
  assert.deepEqual(r.map(x => x.status).sort(), ['fulfilled', 'rejected']);
  assert.equal((await guild.view(many[0])).mine.members.length, GUILD.maxMembers);
});

test('un joueur ne rejoint pas deux guildes par deux acceptations simultanées', async () => {
  const { guild } = setup();
  await guild.create(ZOE, 'Les Rois'); await guild.create(MAX, 'Les Nains');
  await guild.invite(ZOE, 'Bob'); await guild.invite(MAX, 'Bob');
  await Promise.allSettled([guild.acceptInvite(BOB, 'g1'), guild.acceptInvite(BOB, 'g2')]);
  const counts = (await guild.list(ZOE, '')).guilds.map(g => g.members);
  assert.equal(counts.reduce((a, b) => a + b), 3);
});

test('deux créations simultanées du même nom : une seule guilde', async () => {
  const { guild } = setup();
  await Promise.allSettled([guild.create(ZOE, 'Les Rois'), guild.create(MAX, 'les rois')]);
  assert.equal((await guild.list(ZOE, '')).guilds.length, 1);
});

test('bornes : invitations par guilde, demandes envoyées par joueur', async () => {
  const alpha = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const many = Array.from({ length:GUILD.maxInvites + 2 }, (_, i) => ({ id:alpha[i % 32] + alpha[i >> 5] + 'ZZZZZZ', name:'Joueur' + i, guest:false }));
  const { guild } = setup(many);
  await guild.create(many[0], 'Les Rois');
  for(const p of many.slice(1, GUILD.maxInvites + 1)) await guild.invite(many[0], p.name);
  await rejects(guild.invite(many[0], many.at(-1).name), 'too_many');
  const { guild: g2 } = setup(many);
  for(let i = 0; i <= GUILD.maxPendingPerPlayer; i++) await g2.create(many[i], 'Guilde ' + i);
  for(let i = 1; i <= GUILD.maxPendingPerPlayer; i++) await g2.request(many.at(-1), 'g' + i);
  await rejects(g2.request(many.at(-1), 'g' + (GUILD.maxPendingPerPlayer + 1)), 'too_many');
});

test('nom banni refusé', async () => {
  const { guild } = setup();
  await rejects(guild.create(ZOE, 'Les Connard'), 'bad_name');
});
