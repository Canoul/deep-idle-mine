/* Guilde : création, invitations, demandes, départs, XP, redémarrage (server/guild/service.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GUILD } from '../src/config.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGuildService } from '../server/guild/service.js';
import { createSocialService } from '../server/social/service.js';
import { nameKey, formatAccountId } from '../src/shared/account.js';

const acc = (id, name, guest = false) => ({ id:id.repeat(8), name, guest });
const ZOE = acc('A', 'Zoe'), MAX = acc('B', 'Max'), LEA = acc('C', 'Lea'), TOM = acc('D', 'Tom'), GUEST = { id:'E'.repeat(8), name:null, guest:true };
const ALL = [ZOE, MAX, LEA, TOM, GUEST];

function setup({ store = createMemoryGameStore(), accounts = ALL, status = {} } = {}){
  let now = 1000, n = 0;
  const guild = createGuildService({ store, clock:() => now++, makeId:() => `g${++n}`,
    accounts:{ getAccount: async id => accounts.find(a => a.id === id) ?? null, findAccountByName: async k => accounts.find(a => a.name && nameKey(a.name) === k) ?? null },
    statusOf: async id => ({ status:status[id] ?? 'offline' }) });
  return { guild, store, status };
}
const rejects = (p, code) => assert.rejects(p, e => e.code === code);
/* Zoe chef, Max officier, Lea membre */
async function trio(){
  const s = setup(), { guild } = s;
  await guild.create(ZOE, 'Les Rois');
  for(const p of [MAX, LEA]){ await guild.invite(ZOE, p.name); await guild.acceptInvite(p, 'g1'); }
  await guild.promote(ZOE, MAX.id);
  return s;
}

test('créer : le joueur est chef ; nom pris refusé, même en majuscules', async () => {
  const { guild } = setup();
  const v = await guild.create(ZOE, '  Les   Rois ');
  assert.equal(v.mine.name, 'Les Rois'); assert.equal(v.mine.rank, 'chief'); assert.equal(v.mine.level, 1);
  await rejects(guild.create(MAX, 'LES rois'), 'name_taken');
});

test('une guilde par joueur : créer en étant déjà membre est refusé', async () => {
  const { guild } = setup();
  await guild.create(ZOE, 'Les Rois');
  await rejects(guild.create(ZOE, 'Autre'), 'in_guild');
});

test('invité (compte sans pseudo) : ni créer, ni demander, ni accepter', async () => {
  const { guild } = setup();
  await guild.create(ZOE, 'Les Rois');
  await rejects(guild.create(GUEST, 'Invités'), 'guest');
  await rejects(guild.request(GUEST, 'g1'), 'guest');
  await rejects(guild.acceptInvite(GUEST, 'g1'), 'guest');
  await rejects(guild.invite(ZOE, 'Personne'), 'not_found');
});

test('invitation : hors ligne, elle attend ; accepter fait entrer et annule ses autres invitations et demandes', async () => {
  const { guild } = setup();
  await guild.create(ZOE, 'Les Rois'); await guild.create(MAX, 'Les Nains'); await guild.create(LEA, 'Les Elfes');
  await guild.invite(ZOE, 'tom'); await guild.invite(MAX, 'Tom'); await guild.request(TOM, 'g3');
  assert.deepEqual((await guild.invitesOf(TOM.id)).map(i => i.name).sort(), ['Les Nains', 'Les Rois']);
  const v = await guild.acceptInvite(TOM, 'g1');
  assert.equal(v.mine.name, 'Les Rois'); assert.equal(v.mine.rank, 'member');
  assert.deepEqual(v.invites, []); assert.deepEqual(v.requests, []);
  assert.deepEqual((await guild.view(LEA)).mine.requests, []);
});

test('refuser une invitation la retire', async () => {
  const { guild } = setup();
  await guild.create(ZOE, 'Les Rois'); await guild.invite(ZOE, 'Tom');
  assert.deepEqual((await guild.refuseInvite(TOM, 'g1')).invites, []);
  await rejects(guild.acceptInvite(TOM, 'g1'), 'no_invite');
});

test('invité déjà en guilde : invitation reçue, acceptation refusée tant qu\'il n\'a pas quitté', async () => {
  const { guild } = setup();
  await guild.create(ZOE, 'Les Rois'); await guild.create(MAX, 'Les Nains');
  await guild.invite(ZOE, 'Max');
  await rejects(guild.acceptInvite(MAX, 'g1'), 'in_guild');
  await guild.leave(MAX);
  assert.equal((await guild.acceptInvite(MAX, 'g1')).mine.name, 'Les Rois');
});

test('demande : un officier accepte ; une demande en attente empêche les doublons', async () => {
  const { guild } = await trio();
  await guild.request(TOM, 'g1'); await guild.request(TOM, 'g1');
  const v = await guild.view(MAX);
  assert.deepEqual(v.mine.requests.map(r => r.name), ['Tom']);
  assert.deepEqual((await guild.view(LEA)).mine.requests, [], 'un membre ne voit pas les demandes');
  assert.equal((await guild.acceptRequest(MAX, TOM.id)).mine.members.length, 4);
});

test('demande annulée ou refusée : retirée', async () => {
  const { guild } = await trio();
  await guild.request(TOM, 'g1');
  assert.deepEqual((await guild.cancelRequest(TOM, 'g1')).requests, []);
  await guild.request(TOM, 'g1');
  assert.deepEqual((await guild.refuseRequest(MAX, TOM.id)).mine.requests, []);
});

test('30 membres : acceptation refusée, l\'invitation reste ; acceptable quand une place se libère', async () => {
  const many = Array.from({ length:GUILD.maxMembers + 1 }, (_, i) => acc2(i));
  const { guild } = setup({ accounts:many });
  await guild.create(many[0], 'Les Rois');
  for(const p of many.slice(1, -1)){ await guild.invite(many[0], p.name); await guild.acceptInvite(p, 'g1'); }
  const last = many.at(-1);
  await guild.invite(many[0], last.name);
  await rejects(guild.acceptInvite(last, 'g1'), 'guild_full');
  await rejects(guild.request(last, 'g1'), 'guild_full');
  assert.equal((await guild.invitesOf(last.id)).length, 1);
  await guild.leave(many[1]);
  assert.equal((await guild.acceptInvite(last, 'g1')).mine.members.length, GUILD.maxMembers);
});
function acc2(i){ const a = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; return { id:a[i % 32] + a[i >> 5] + 'ZZZZZZ', name:'Joueur' + i, guest:false }; }

test('chef qui part : plus ancien officier, sinon plus ancien membre', async () => {
  const { guild } = await trio();
  await guild.leave(ZOE);
  const m = (await guild.view(MAX)).mine;
  assert.equal(m.rank, 'chief'); assert.equal(m.members.length, 2);
  await guild.leave(MAX);
  assert.equal((await guild.view(LEA)).mine.rank, 'chief');
});

test('dernier membre parti : guilde, invitations et demandes supprimées, nom réutilisable', async () => {
  const { guild } = setup();
  await guild.create(ZOE, 'Les Rois'); await guild.invite(ZOE, 'Max'); await guild.request(LEA, 'g1');
  assert.equal((await guild.leave(ZOE)).mine, null);
  assert.deepEqual(await guild.invitesOf(MAX.id), []);
  assert.deepEqual((await guild.view(LEA)).requests, []);
  assert.deepEqual((await guild.list(ZOE, '')).guilds, []);
  assert.equal((await guild.create(MAX, 'les rois')).mine.name, 'les rois');
});

test('donner sa place : le chef devient officier', async () => {
  const { guild } = await trio();
  assert.equal((await guild.transfer(ZOE, LEA.id)).mine.rank, 'officer');
  assert.equal((await guild.view(LEA)).mine.rank, 'chief');
});

test('rétrograder, exclure : effets et actions proposées', async () => {
  const { guild } = await trio();
  const row = (v, a) => v.mine.members.find(m => m.id === a.id);
  const asOfficer = await guild.view(MAX);
  assert.deepEqual(row(asOfficer, LEA).actions, { kick:true, promote:true, demote:false, transfer:false });
  assert.deepEqual(row(asOfficer, ZOE).actions, { kick:false, promote:false, demote:false, transfer:false });
  assert.equal(row(await guild.demote(ZOE, MAX.id), MAX).rank, 'member');
  assert.equal((await guild.kick(ZOE, MAX.id)).mine.members.length, 2);
  assert.equal((await guild.view(MAX)).mine, null);
});

test('réexclu puis réinvité : son compteur repart de 0, l\'XP reste à la guilde', async () => {
  const { guild } = await trio();
  await guild.addXp(LEA.id, 5000);
  await guild.kick(MAX, LEA.id);
  await guild.invite(MAX, 'Lea'); const v = await guild.acceptInvite(LEA, 'g1');
  assert.equal(v.mine.members.find(m => m.id === LEA.id).xp, 0);
  assert.equal(v.mine.xp, 50);
});

test('addXp : additionne guilde et membre ; sans guilde, rien', async () => {
  const { guild } = await trio();
  await guild.addXp(LEA.id, 60); await guild.addXp(LEA.id, 40); await guild.addXp(ZOE.id, 100000);
  await guild.addXp(TOM.id, 1000);
  const m = (await guild.view(ZOE)).mine;
  assert.equal(m.xp, 1001); assert.equal(m.level, 2); assert.equal(m.into, 1); assert.equal(m.need, 1500);
  assert.equal(m.members.find(x => x.id === LEA.id).xp, 1);
  for(const bad of [0, -5, 1.5, NaN, Infinity, '9']) await guild.addXp(LEA.id, bad);
  assert.equal((await guild.view(ZOE)).mine.xp, 1001);
});

test('redémarrage : fiche relue, grades, XP et index compte → guilde intacts', async () => {
  const { store, guild } = await trio();
  await guild.addXp(LEA.id, 1000);
  const again = setup({ store }).guild;
  const m = (await again.view(LEA)).mine;
  assert.equal(m.name, 'Les Rois'); assert.equal(m.xp, 10); assert.equal(m.members.length, 3);
  await rejects(again.create(LEA, 'Autre'), 'in_guild');
});

test('activité et ordre de la liste : grade, puis activité', async () => {
  const { guild, status } = await trio();
  status[LEA.id] = 'lobby';
  await guild.invite(ZOE, 'Tom'); await guild.acceptInvite(TOM, 'g1');
  status[TOM.id] = 'session';
  const rows = (await guild.view(ZOE)).mine.members;
  assert.deepEqual(rows.map(m => m.name), ['Zoe', 'Max', 'Lea', 'Tom']);
  assert.deepEqual(rows.map(m => m.activity), ['offline', 'offline', 'online', 'session']);
});

test('compte disparu : ligne affichée avec l\'ID formaté', async () => {
  const accounts = [...ALL], { guild } = setup({ accounts });
  await guild.create(ZOE, 'Les Rois'); await guild.invite(ZOE, 'Lea'); await guild.acceptInvite(LEA, 'g1');
  accounts.splice(accounts.indexOf(LEA), 1);
  assert.ok((await guild.view(ZOE)).mine.members.some(m => m.name === formatAccountId(LEA.id)));
});

test('classement : niveau puis XP ; recherche : filtre sans majuscules', async () => {
  const { guild } = setup();
  await guild.create(ZOE, 'Les Rois'); await guild.create(MAX, 'Les Nains'); await guild.create(LEA, 'Elfes');
  await guild.addXp(MAX.id, 150000); await guild.addXp(ZOE.id, 110000);
  const b = (await guild.board(LEA)).guilds;
  assert.deepEqual(b.map(g => [g.rank, g.name, g.level]), [[1, 'Les Nains', 2], [2, 'Les Rois', 2], [3, 'Elfes', 1]]);
  const l = (await guild.list(TOM, 'LES ')).guilds;
  assert.deepEqual(l.map(g => g.name).sort(), ['Les Nains', 'Les Rois']);
  assert.equal(l.find(g => g.name === 'Les Rois').chief, 'Zoe');
  assert.equal(l[0].max, GUILD.maxMembers);
});

test('état social : donne les invitations de guilde, pour le pop-up', async () => {
  const { guild, store } = setup();
  await guild.create(ZOE, 'Les Rois'); await guild.invite(ZOE, 'Tom');
  const social = createSocialService({ store, guildInvites:id => guild.invitesOf(id), party:{ groupOf:() => null, invitesOf:() => [] },
    game:{ activeSessionId:async () => null, activeSessionInfo:async () => null }, accounts:{ getAccount:async () => null, findAccountByName:async () => null } });
  assert.deepEqual((await social.state(TOM)).guildInvites, [{ guildId:'g1', name:'Les Rois' }]);
  assert.equal(typeof (await social.statusOf(TOM.id)).status, 'string');
});
