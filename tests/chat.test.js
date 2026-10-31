/* Chat de session : texte nettoyé, un message par seconde, seuls les joueurs de la session (encore là) lisent et
   écrivent, nom donné par le serveur, rien gardé après la session.
   Chat global du lobby (28/10) : tous les comptes, sa propre cadence, enregistré et repris après un redémarrage. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT } from '../src/config.js';
import { cleanChatText } from '../src/shared/chat.js';
import { createChat } from '../server/game/chat.js';
import { stuckToEnd } from '../src/ui/chat.js';
import { realDurationMs } from '../src/shared/game.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createSocialService } from '../server/social/service.js';
import { fakeLive } from './helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const OTHER = { id:'BBBB2222', name:'Max', guest:false };
const OUT = { id:'CCCC3333', name:'Lea', guest:false };
const team = [{ account:ME.id, name:'Zoe' }, { account:OTHER.id, name:'Max' }];

function setup(){
  let now = 1_000_000;
  const clock = () => now;
  const live = fakeLive(rec => ({ id:rec.id, chest:{}, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{} })) }));
  const game = createGameService({ store:createMemoryGameStore(), liveRunner:live, clock, randomSeed:() => 4242 });
  return { game, live, advance: ms => { now += ms; } };
}

/* ---------- texte ---------- */

test('texte : espaces resserrés, caractères de contrôle retirés ; vide, trop long ou pas du texte = refusé', () => {
  assert.equal(cleanChatText('  salut \n\t les   mineurs  '), 'salut les mineurs');
  assert.equal(cleanChatText('a\u0000b‮c'), 'a b c');
  assert.equal(cleanChatText('x'.repeat(CHAT.maxLen)), 'x'.repeat(CHAT.maxLen));
  assert.equal(cleanChatText('😀'.repeat(CHAT.maxLen)), '😀'.repeat(CHAT.maxLen), 'compté en caractères, pas en octets');
  for(const v of ['', '   ', '\n', 'x'.repeat(CHAT.maxLen + 1), 42, null, undefined, ['a'], { text:'a' }])
    assert.equal(cleanChatText(v), null, JSON.stringify(v));
});

test('le texte reste du texte : le balisage est gardé tel quel (échappé à l\'affichage, jamais interprété)', () => {
  assert.equal(cleanChatText('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');
});

/* ---------- salons en mémoire ---------- */

test('salon : messages numérotés, lus à partir d\'un numéro, seuls les CHAT.keep derniers gardés', () => {
  let now = 0;
  const chat = createChat({ clock: () => now });
  for(let i = 0; i < CHAT.keep + 5; i++){ now += CHAT.gapMs; assert.ok(chat.post('s1', 'A', 'Zoe', 'm' + i).msg); }
  const all = chat.since('s1', 0);
  assert.equal(all.length, CHAT.keep);
  assert.equal(all[0].text, 'm5');
  assert.deepEqual(chat.since('s1', all.at(-2).id).map(m => m.text), ['m' + (CHAT.keep + 4)]);
  assert.deepEqual(chat.since('autre', 0), [], 'chaque session a son salon');
});

test('salon : un message par seconde et par joueur au plus', () => {
  let now = 0;
  const chat = createChat({ clock: () => now });
  assert.ok(chat.post('s1', 'A', 'Zoe', 'un').msg);
  assert.equal(chat.post('s1', 'A', 'Zoe', 'deux').error, 'too_fast');
  assert.ok(chat.post('s1', 'B', 'Max', 'moi').msg, 'un autre joueur peut parler');
  now += CHAT.gapMs;
  assert.ok(chat.post('s1', 'A', 'Zoe', 'trois').msg);
});

test('salon : effacé quand on le jette, et oublié tout seul après CHAT.ttlMs sans message', () => {
  let now = 0;
  const chat = createChat({ clock: () => now });
  chat.post('s1', 'A', 'Zoe', 'a'); chat.post('s2', 'B', 'Max', 'b');
  chat.drop('s1');
  assert.deepEqual(chat.since('s1', 0), []);
  now += CHAT.ttlMs + 1;
  chat.post('s3', 'A', 'Zoe', 'c');                    // un message ailleurs fait le ménage
  assert.deepEqual(chat.since('s2', 0), []);
});

/* ---------- service (ce que le serveur accepte) ---------- */

test('service : les joueurs de la session écrivent et lisent ; le nom vient du serveur', async () => {
  const { game } = setup();
  await game.start(ME, {}, team);
  const { message } = await game.chatPost(ME, { text:' salut ', name:'Admin' });
  assert.equal(message.text, 'salut');
  assert.equal(message.name, 'Zoe', 'le nom envoyé par le navigateur est ignoré');
  const { messages } = await game.chatGet(OTHER, 0);
  assert.deepEqual(messages.map(m => [m.name, m.text]), [['Zoe', 'salut']]);
  assert.deepEqual((await game.chatGet(OTHER, message.id)).messages, [], 'rien après le dernier lu');
});

test('service : hors de la session, ou parti, ni lecture ni écriture', async () => {
  const { game } = setup();
  await game.start(ME, {}, team);
  await game.chatPost(ME, { text:'secret' });
  await assert.rejects(game.chatGet(OUT, 0), { code:'no_session' });
  await assert.rejects(game.chatPost(OUT, { text:'coucou' }), { code:'no_session' });
  await game.leave(OTHER, {});
  await assert.rejects(game.chatGet(OTHER, 0), { code:'no_session' });
  await assert.rejects(game.chatPost(OTHER, { text:'je suis parti' }), { code:'no_session' });
});

test('service : message invalide ou trop rapide refusé', async () => {
  const { game, advance } = setup();
  await game.start(ME, {}, team);
  for(const text of ['', '  ', 'x'.repeat(CHAT.maxLen + 1), 7, null])
    await assert.rejects(game.chatPost(ME, { text }), { code:'bad_request' }, String(text));
  await game.chatPost(ME, { text:'un' });
  await assert.rejects(game.chatPost(ME, { text:'deux' }), { code:'too_many', status:429 });
  advance(CHAT.gapMs);
  await game.chatPost(ME, { text:'deux' });
  assert.equal((await game.chatGet(ME, 0)).messages.length, 2);
  for(const after of [-1, 1.5, 'x', null]) assert.equal((await game.chatGet(ME, after)).messages.length, 2, String(after));
});

test('service : la session finie, le chat est effacé (une nouvelle session repart à vide)', async () => {
  const { game, advance } = setup();
  await game.start(ME, {}, team);
  await game.chatPost(ME, { text:'avant' });
  advance(realDurationMs());
  await game.pump();                                      // fin à l'heure, versement
  assert.equal((await game.state(ME)).session, null);
  await assert.rejects(game.chatGet(ME, 0), { code:'no_session' });
  advance(CHAT.gapMs);
  await game.start(ME, {}, team);
  assert.deepEqual((await game.chatGet(ME, 0)).messages, []);
});

/* ---------- chat global (lobby) ---------- */

const GUEST = { id:'DDDD4444', name:null, guest:true };
const ACCOUNTS = Object.fromEntries([ME, OTHER, OUT, GUEST].map(a => [a.id, a]));
function setupGlobal(store = createMemoryGameStore()){
  let now = 2_000_000;
  const clock = () => now;
  const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock, randomSeed:() => 7 });
  const party = createPartyService({ game, clock, getAccount: async id => ACCOUNTS[id] ?? null });
  const social = createSocialService({ store, game, party, clock,
    accounts:{ getAccount: async id => ACCOUNTS[id] ?? null, findAccountByName: async () => null } });
  return { store, social, party, advance: ms => { now += ms; } };
}

test('global : tout compte écrit et lit, sans session ni groupe ; le nom vient du compte (invité : « Invité xxxx »)', async () => {
  const { social, advance } = setupGlobal();
  const { message } = await social.chatPost(ME, { text:'  salut   tout le monde ', name:'Admin' });
  assert.equal(message.text, 'salut tout le monde');
  assert.equal(message.name, 'Zoe', 'le nom envoyé par le navigateur est ignoré');
  await social.chatPost(GUEST, { text:'coucou' });
  advance(1);
  const { messages } = await social.chatGet(OUT, 0);
  assert.deepEqual(messages.map(m => [m.name, m.text]), [['Zoe', 'salut tout le monde'], ['Invité DDDD', 'coucou']]);
  assert.deepEqual((await social.chatGet(OTHER, messages.at(-1).id)).messages, [], 'rien après le dernier lu');
  for(const after of [-1, 1.5, 'x', null, NaN]) assert.equal((await social.chatGet(ME, after)).messages.length, 2, String(after));
});

test('global : un message toutes les CHAT.globalGapMs par joueur ; texte invalide refusé', async () => {
  const { social, advance } = setupGlobal();
  for(const text of ['', '  ', 'x'.repeat(CHAT.maxLen + 1), 7, null, ['a'], { a:1 }])
    await assert.rejects(social.chatPost(ME, { text }), { code:'bad_request', status:400 }, JSON.stringify(text));
  await social.chatPost(ME, { text:'un' });
  advance(CHAT.globalGapMs - 1);
  await assert.rejects(social.chatPost(ME, { text:'deux' }), { code:'too_many', status:429 });
  await social.chatPost(OTHER, { text:'moi' });                         // un autre joueur peut parler
  advance(1);
  await social.chatPost(ME, { text:'deux' });
  assert.deepEqual((await social.chatGet(ME, 0)).messages.map(m => m.text), ['un', 'moi', 'deux']);
});

test('global : séparé du chat de session (dans les deux sens)', async () => {
  const { store, social, advance } = setupGlobal();
  const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, chest:{}, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{} })) })),
                                   clock:() => 3_000_000, randomSeed:() => 1 });
  await game.start(ME, {}, team);
  await game.chatPost(ME, { text:'en session' });
  await social.chatPost(ME, { text:'pour tous' });                     // la cadence du chat de session ne bloque pas le global
  advance(1);
  assert.deepEqual((await social.chatGet(OUT, 0)).messages.map(m => m.text), ['pour tous']);
  assert.deepEqual((await game.chatGet(OTHER, 0)).messages.map(m => m.text), ['en session']);
});

test('global : seuls les CHAT.keep derniers gardés ; enregistrés et repris après un redémarrage, numéros qui continuent', async () => {
  const { store, social, advance } = setupGlobal();
  for(let i = 0; i < CHAT.globalKeep + 3; i++){ advance(CHAT.globalGapMs); await social.chatPost(ME, { text:'m' + i }); }
  const before = (await social.chatGet(ME, 0)).messages;
  assert.equal(before.length, CHAT.keep);
  assert.equal(before[0].text, 'm' + (CHAT.globalKeep + 3 - CHAT.keep));
  assert.equal((await store.getGlobalChat()).msgs.length, CHAT.globalKeep);

  const again = setupGlobal(store).social;                              // redémarrage : même stockage, service neuf
  assert.deepEqual((await again.chatGet(OTHER, 0)).messages, before);
  const { message } = await again.chatPost(OTHER, { text:'après' });
  assert.equal(message.id, before.at(-1).id + 1, 'un navigateur qui a lu avant le redémarrage reçoit bien la suite');
  assert.deepEqual((await again.chatGet(ME, before.at(-1).id)).messages.map(m => m.text), ['après']);
});

test('global : stockage trafiqué nettoyé à la reprise (texte invalide, numéros en désordre, champs manquants)', async () => {
  const store = createMemoryGameStore();
  await store.putGlobalChat({ next: 2, msgs: [
    { id:1, at:1, account:'AAAA1111', name:'Zoe', text:'ok' },
    { id:1, at:2, account:'AAAA1111', name:'Zoe', text:'doublon' },
    { id:3, at:3, account:'AAAA1111', name:'Zoe', text:'x'.repeat(CHAT.maxLen + 1) },
    { id:4, at:4, account:42, name:'Zoe', text:'compte' },
    { id:5, at:5, account:'AAAA1111', name:'Zoe', text:'a\u0000b' },
    null, 'texte',
    { id:9, at:9, account:'BBBB2222', name:'Max', text:'fin', extra:'<script>' },
  ] });
  const { social } = setupGlobal(store);
  const msgs = (await social.chatGet(ME, 0)).messages;
  assert.deepEqual(msgs.map(m => m.text), ['ok', 'fin']);
  assert.equal(msgs[1].extra, undefined);
  assert.equal((await social.chatPost(ME, { text:'suite' })).message.id, 10, 'numéro après le plus grand gardé');
  for(const bad of [null, 'x', { msgs:'x' }, []]){
    const s2 = createMemoryGameStore(); await s2.putGlobalChat(bad);
    assert.deepEqual((await setupGlobal(s2).social.chatGet(ME, 0)).messages, [], JSON.stringify(bad));
  }
});

/* liste du chat (29/10) : elle suit les derniers messages si le joueur était en bas ; cachée (hauteur 0), l'état d'avant
   est gardé (le navigateur la remet en haut en la réaffichant : ce n'est pas le joueur qui a remonté) */
test('liste du chat : en bas, remontée, cachée', () => {
  assert.equal(stuckToEnd({ scrollTop: 400, clientHeight: 100, scrollHeight: 500 }), true);
  assert.equal(stuckToEnd({ scrollTop: 395, clientHeight: 100, scrollHeight: 500 }), true);        // à quelques pixels près
  assert.equal(stuckToEnd({ scrollTop: 100, clientHeight: 100, scrollHeight: 500 }), false);       // remontée relire
  assert.equal(stuckToEnd({ scrollTop: 0, clientHeight: 0, scrollHeight: 0 }, true), true);        // cachée : on garde
  assert.equal(stuckToEnd({ scrollTop: 0, clientHeight: 0, scrollHeight: 0 }, false), false);
});

/* ---------- messages de 18 h ou plus (30/10/2026) ---------- */
test('un message de 18 h ou plus disparaît : plus envoyé, plus enregistré, plus repris après un redémarrage', async () => {
  const { freshMessages } = await import('../src/shared/chat.js');
  let now = 10_000_000;
  const c = createChat({ clock: () => now, ttlMs: Infinity });
  c.post('g', 'A', 'Zoe', 'vieux message');
  now += CHAT.maxAgeMs - 60e3;
  c.post('g', 'B', 'Max', 'récent');
  assert.equal(c.since('g', 0).length, 2, 'moins de 18 h : gardé');
  now += 60e3;
  assert.deepEqual(c.since('g', 0).map(m => m.text), ['récent'], '18 h pile : parti');
  assert.deepEqual(c.room('g').msgs.map(m => m.text), ['récent'], 'pas enregistré non plus');
  const saved = { next: 3, msgs: [{ id: 1, at: now - CHAT.maxAgeMs, account: 'A', name: 'Zoe', text: 'vieux' }, { id: 2, at: now - 1000, account: 'B', name: 'Max', text: 'neuf' }] };
  const d = createChat({ clock: () => now, ttlMs: Infinity }); d.restore('g', saved);
  assert.deepEqual(d.since('g', 0).map(m => m.text), ['neuf'], 'redémarrage : le vieux message n\'est pas repris');
  assert.equal(d.post('g', 'C', 'Lea', 'suite').msg.id, 3, 'les numéros continuent');
  assert.equal(freshMessages([{ at: 0 }, { at: 5 }], CHAT.maxAgeMs + 1).length, 1);
});

test('chat permanent : hauteur de départ 60 %, bornée quand on la règle ; largeur bornée', async () => {
  const { dockShare, dockWidth } = await import('../src/ui/chat-dock.js');
  const { CHAT } = await import('../src/config.js');
  assert.equal(CHAT.dock.share, 0.6);
  assert.equal(dockShare(undefined), 0.6); assert.equal(dockShare(NaN), 0.6); assert.equal(dockShare('x'), 0.6);
  assert.equal(dockWidth(500, 1920), 500);
  assert.equal(dockWidth(1, 1920), CHAT.dock.minWidth); assert.equal(dockWidth(1900, 1000), 1000 * CHAT.dock.maxWidth);
  assert.equal(dockWidth(undefined, 1920), null); assert.equal(dockWidth('x', 1920), null);
  assert.equal(dockShare(0.55), 0.55);
  assert.equal(dockShare(0), CHAT.dock.min); assert.equal(dockShare(1), CHAT.dock.max);
});

test("chat permanent : largeur arrêtée au bord de l'interface centrale, jamais sous le minimum", async () => {
  const { dockFit } = await import('../src/ui/chat-dock.js');
  const { CHAT } = await import('../src/config.js');
  assert.equal(dockFit(null, Infinity), CHAT.dock.startWidth);
  assert.equal(dockFit(300, 500), 300);
  assert.equal(dockFit(700, 500), 500);
  assert.equal(dockFit(700, 50), CHAT.dock.minWidth);
});

/* ---------- canaux du chat global (31/10) ---------- */
function setupChannels(){
  let now = 5_000_000;
  const store = createMemoryGameStore(), clock = () => now;
  const social = createSocialService({ store, clock, game: { energyOf: async () => null }, party: { membersOf: id => id === ME.id || id === OTHER.id ? [ME.id, OTHER.id] : [] },
    accounts: { getAccount: async id => ACCOUNTS[id] ?? null, findAccountByName: async k => Object.values(ACCOUNTS).find(a => a.name?.toLowerCase() === k) ?? null } });
  return { store, social, tick: () => { now += CHAT.globalGapMs; } };
}

test('raccourcis : /1 /2 /c /gr /w, sans raccourci le canal choisi ; texte manquant refusé', async () => {
  const { parseChatInput } = await import('../src/shared/chat.js');
  assert.deepEqual(parseChatInput('toto', 'commerce'), { channel:'commerce', text:'toto' });
  assert.deepEqual(parseChatInput('/1 toto'), { channel:'general', text:'toto' });
  assert.deepEqual(parseChatInput('/2 toto'), { channel:'lfg', text:'toto' });
  assert.deepEqual(parseChatInput('/C toto'), { channel:'commerce', text:'toto' });
  assert.deepEqual(parseChatInput('/gr toto'), { channel:'group', text:'toto' });
  assert.deepEqual(parseChatInput('/w "Le Nain" toto a'), { channel:'mp', to:'Le Nain', text:'toto a' });
  assert.deepEqual(parseChatInput('/w Zoe toto'), { channel:'mp', to:'Zoe', text:'toto' });
  for(const bad of ['/1', '/gr ', '/w', '/w Zoe']) assert.ok(parseChatInput(bad).error, bad);
  assert.deepEqual(parseChatInput('/12 toto'), { channel:'general', text:'/12 toto' }, 'autre barre oblique : du texte');
});

test('MP : seuls auteur et destinataire le lisent, la liste des lecteurs ne part jamais ; pseudo inconnu ou soi-même refusé', async () => {
  const { social, tick } = setupChannels();
  const { message } = await social.chatPost(ME, { channel:'mp', to:OTHER.name, text:'secret' });
  assert.equal(message.to, undefined); assert.equal(message.toName, OTHER.name);
  assert.deepEqual((await social.chatGet(OTHER, 0)).messages.map(m => m.text), ['secret']);
  assert.deepEqual((await social.chatGet(ME, 0)).messages.map(m => m.text), ['secret']);
  assert.deepEqual((await social.chatGet(OUT, 0)).messages, [], 'un tiers ne voit rien, même en relisant depuis 0');
  assert.deepEqual(await social.recentChat(1e9), [], 'pas de bulle dans le Carreau');
  tick();
  await assert.rejects(social.chatPost(ME, { channel:'mp', to:'personne', text:'x' }), { status:404 });
  await assert.rejects(social.chatPost(ME, { channel:'mp', to:['a'], text:'x' }), { status:404 });
  await assert.rejects(social.chatPost(ME, { channel:'mp', to:ME.name, text:'x' }), { status:400 });
});

test('groupe : seulement ses membres ; sans groupe refusé ; canal inconnu = Général ; un to envoyé sur un canal public est ignoré', async () => {
  const { social, tick } = setupChannels();
  await social.chatPost(ME, { channel:'group', text:'gr' });
  assert.equal((await social.chatGet(OTHER, 0)).messages.length, 1);
  assert.deepEqual((await social.chatGet(OUT, 0)).messages, []);
  await assert.rejects(social.chatPost(OUT, { channel:'group', text:'x' }), { status:400 });
  tick();
  const { message } = await social.chatPost(ME, { channel:'hack', to:OTHER.name, text:'pub' });
  assert.equal(message.channel, 'general'); assert.equal(message.toName, undefined);
  assert.equal((await social.chatGet(OUT, 0)).messages.length, 1);
});

test('canaux gardés au redémarrage, lecteurs compris ; ancien message sans canal : Général', async () => {
  const { store, social } = setupChannels();
  await social.chatPost(ME, { channel:'mp', to:OTHER.name, text:'secret' });
  const again = createSocialService({ store, game: {}, party: {}, clock: () => 5_000_001, accounts: { getAccount: async id => ACCOUNTS[id] ?? null } });
  assert.deepEqual((await again.chatGet(OUT, 0)).messages, [], 'toujours privé après redémarrage');
  assert.equal((await again.chatGet(OTHER, 0)).messages[0].channel, 'mp');
  const { chatChannel } = await import('../src/shared/chat.js');
  assert.equal(chatChannel(undefined).id, 'general');
});

test('préfixes : [Général], [LFG], de / à pour un MP', async () => {
  const { chatPrefix } = await import('../src/ui/chat-tabs.js');
  assert.equal(chatPrefix({ channel:'general', name:'admin' }, 'x'), '[Général] admin');
  assert.equal(chatPrefix({ channel:'group', name:'admin' }, 'x'), '[Groupe] admin');
  assert.equal(chatPrefix({ channel:'lfg', name:'admin' }, 'x'), '[LFG] admin');
  assert.equal(chatPrefix({ channel:'mp', name:'admin', account:'a', toName:'Zoe' }, 'x'), 'de admin');
  assert.equal(chatPrefix({ channel:'mp', name:'admin', account:'x', toName:'Zoe' }, 'x'), 'à Zoe');
});

test('réglages du chat : gardés par compte, tout est revérifié', async () => {
  const { social } = setupChannels();
  const { sanitizeChatPrefs } = await import('../src/shared/chat.js');
  assert.deepEqual(sanitizeChatPrefs(null), { tabs:[{ name:'Tous', hidden:[] }], active:0, channel:'general' });
  assert.deepEqual(await social.chatPrefsSave(ME, { tabs:[{ name:'Trade', hidden:['general', 'hack', 'general'] }], active:9, channel:'mp' }),
    { tabs:[{ name:'Trade', hidden:['general'] }], active:0, channel:'general' });
  assert.equal((await social.chatPrefs(ME)).tabs[0].name, 'Trade');
  assert.equal((await social.chatPrefs(OTHER)).tabs[0].name, 'Tous', 'un autre compte garde les siens');
  const many = sanitizeChatPrefs({ tabs:Array.from({ length:50 }, () => ({ name:'x'.repeat(99), hidden:7 })) });
  assert.equal(many.tabs.length, CHAT.tabsMax); assert.equal(many.tabs[0].name.length, CHAT.tabNameMax);
});

test('groupe, avec le vrai service des groupes : seul refusé ; à deux, lu par le groupe et pas par les autres', async () => {
  const { social, party } = setupGlobal();
  await assert.rejects(social.chatPost(ME, { channel:'group', text:'seul' }), { status:400 });
  const { party: p } = await party.create(ME).then(r => r?.party ? r : { party: r });
  await party.join(OTHER, p.code);
  await social.chatPost(ME, { channel:'group', text:'entre nous' });
  assert.deepEqual((await social.chatGet(OTHER, 0)).messages.map(m => m.text), ['entre nous']);
  assert.deepEqual((await social.chatGet(OUT, 0)).messages, []);
});
