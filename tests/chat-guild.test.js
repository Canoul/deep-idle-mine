/* Canal Guilde du chat global (/g) : lu seulement par les membres, décidé par le serveur. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT } from '../src/config.js';
import { parseChatInput, chatChannel, sanitizeChatPrefs } from '../src/shared/chat.js';
import { chatLine, chatPrefix } from '../src/ui/chat-tabs.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createSocialService } from '../server/social/service.js';
import { createGuildService } from '../server/guild/service.js';

const ZOE = { id:'AAAA1111', name:'Zoe', guest:false }, MAX = { id:'BBBB2222', name:'Max', guest:false }, TOM = { id:'CCCC3333', name:'Tom', guest:false };
const ALL = [ZOE, MAX, TOM];

async function setup(){
  let now = 5_000_000;
  const store = createMemoryGameStore(), clock = () => now;
  const accounts = { getAccount:async id => ALL.find(a => a.id === id) ?? null, findAccountByName:async k => ALL.find(a => a.name.toLowerCase() === k) ?? null };
  const guild = createGuildService({ store, accounts, statusOf:async () => ({ status:'offline' }) });
  const social = createSocialService({ store, accounts, clock, game:{ energyOf:async () => null }, party:{}, guildMembers:id => guild.membersOf(id) });
  const texts = async who => (await social.chatGet(who, 0)).messages.map(m => m.text);
  return { guild, social, texts, tick:() => { now += CHAT.globalGapMs; } };
}
const join = async (guild, id) => {
  await guild.invite(ZOE, ALL.find(a => a.id === id).name);
  await guild.acceptInvite(ALL.find(a => a.id === id), (await guild.invitesOf(id))[0].guildId);
};

test('raccourci /g : canal Guilde, sans toucher à /gr ; texte manquant refusé', () => {
  assert.deepEqual(parseChatInput('/g toto'), { channel:'guild', text:'toto' });
  assert.deepEqual(parseChatInput('/G toto'), { channel:'guild', text:'toto' });
  assert.deepEqual(parseChatInput('/gr toto'), { channel:'group', text:'toto' });
  assert.deepEqual(parseChatInput('toto', 'guild'), { channel:'guild', text:'toto' });
  assert.ok(parseChatInput('/g').error);
  assert.deepEqual(parseChatInput('/gx toto'), { channel:'general', text:'/gx toto' });
});

test('canal connu : label Guilde, gardé dans les réglages, masquable', () => {
  assert.equal(chatChannel('guild').label, 'Guilde');
  const prefs = sanitizeChatPrefs({ tabs:[{ name:'A', hidden:['guild'] }], channel:'guild' });
  assert.equal(prefs.channel, 'guild');
  assert.deepEqual(prefs.tabs[0].hidden, ['guild']);
});

test('ligne : [Guilde] et sa classe de couleur', () => {
  const m = { id:1, at:0, account:'x', name:'Zoe', text:'salut', channel:'guild' };
  assert.equal(chatPrefix(m, 'y'), '[Guilde] Zoe');
  assert.match(chatLine(m, 'y'), /class="ch-guild"/);
});

test('seuls les membres de la guilde lisent le message', async () => {
  const { guild, social, texts } = await setup();
  await guild.create(ZOE, 'Les Rois');
  await join(guild, MAX.id);
  await social.chatPost(ZOE, { channel:'guild', text:'entre nous' });
  assert.deepEqual(await texts(ZOE), ['entre nous']);
  assert.deepEqual(await texts(MAX), ['entre nous']);
  assert.deepEqual(await texts(TOM), []);
});

test('sans guilde : refusé ; le navigateur ne choisit jamais les lecteurs', async () => {
  const { guild, social, texts, tick } = await setup();
  await assert.rejects(social.chatPost(TOM, { channel:'guild', text:'non' }), /guilde/);
  await guild.create(ZOE, 'Les Rois');
  tick();
  await social.chatPost(ZOE, { channel:'guild', text:'privé', to:[TOM.id] });
  assert.deepEqual(await texts(TOM), []);
});

test('seul dans sa guilde : le message passe, et reste à lui', async () => {
  const { guild, social, texts } = await setup();
  await guild.create(ZOE, 'Les Rois');
  await social.chatPost(ZOE, { channel:'guild', text:'écho' });
  assert.deepEqual(await texts(ZOE), ['écho']);
  assert.deepEqual(await texts(MAX), []);
});

test('un message de guilde ne fait jamais de bulle dans le Carreau', async () => {
  const { guild, social } = await setup();
  await guild.create(ZOE, 'Les Rois');
  await social.chatPost(ZOE, { channel:'guild', text:'secret' });
  assert.deepEqual(await social.recentChat(60e3), []);
});

test('nouveau membre : il ne lit pas ce qui a été dit avant son arrivée', async () => {
  const { guild, social, texts, tick } = await setup();
  await guild.create(ZOE, 'Les Rois');
  await social.chatPost(ZOE, { channel:'guild', text:'avant' });
  await join(guild, MAX.id);
  tick();
  await social.chatPost(ZOE, { channel:'guild', text:'après' });
  assert.deepEqual(await texts(MAX), ['après']);
});
