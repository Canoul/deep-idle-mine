/* Chat de session : texte nettoyé, un message par seconde, seuls les joueurs de la session (encore là) lisent et
   écrivent, nom donné par le serveur, rien gardé après la session. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT } from '../src/config.js';
import { cleanChatText } from '../src/shared/chat.js';
import { createChat } from '../server/game/chat.js';
import { realDurationMs } from '../src/shared/game.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
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
