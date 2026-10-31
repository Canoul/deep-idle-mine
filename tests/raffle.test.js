/* Raffle : créneau horaire, table de lots, !join, tirage, reprise après un redémarrage (server/social/raffle.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAFFLE, ITEMS } from '../src/config.js';
import { localHour, raffleOpen, nextRaffleAt, rollLot, lotLabel, isRaffleJoin, sanitizeRaffle } from '../src/shared/raffle.js';
import { createChat } from '../server/game/chat.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createSocialService } from '../server/social/service.js';
import { deserialize, countOf } from '../src/meta/inventory.js';
import { chatLine } from '../src/ui/chat-tabs.js';
import { fakeLive } from './helpers.js';

const paris = (d, h, m = 0) => Date.UTC(2026, 9, d, h - 1, m);   // heure d'hiver depuis le 25/10/2026 : UTC+1
const ZOE = { id:'AAAA1111', name:'Zoe', guest:false }, MAX = { id:'BBBB2222', name:'Max', guest:false }, GUEST = { id:'CCCC3333', name:null, guest:true };

function setup({ random = () => 0, store = createMemoryGameStore(), start = paris(28, 12) } = {}){
  let now = start;
  const clock = () => now;
  const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock, randomSeed:() => 7 });
  const social = createSocialService({ store, game, clock, random, party:null,
    accounts:{ getAccount: async id => [ZOE, MAX, GUEST].find(a => a.id === id) ?? null, findAccountByName: async () => null } });
  /* lance un raffle : premier passage = heure du prochain, puis on y va */
  const open = async () => { await social.raffleTick(); now = (await store.getRaffle()).nextAt; await social.raffleTick(); };
  return { store, game, social, open, clock, set: t => { now = t; }, advance: ms => { now += ms; } };
}
const texts = async (social, me) => (await social.chatGet(me, 0)).messages.map(m => m.text);
const count = async (store, id, item) => { const raw = await store.getInventory(id); return raw ? countOf(deserialize(JSON.stringify(raw)), item) : 0; };

test('table des lots : total 100 %, 17 lots, objets existants', () => {
  assert.equal(RAFFLE.lots.length, 17);
  assert.ok(Math.abs(RAFFLE.lots.reduce((s, l) => s + l.chance, 0) - 1) < 1e-9);
  for(const l of RAFFLE.lots) assert.ok(l.energy || ITEMS[l.item ?? l.rune], JSON.stringify(l));
});

test('tirage du lot : suit les chances ; la rune a une qualité', () => {
  assert.deepEqual(rollLot(() => 0), { item:'Chitine', qty:100 });
  assert.deepEqual(rollLot(() => 0.305), { item:'Treasure T4', qty:1 });
  assert.equal(rollLot(() => 0.999999).item, 'Graphite ingot');
  const seq = [0.695, 0.5]; const rune = rollLot(() => seq.shift() ?? 0.5);
  assert.ok(rune.rune && rune.q >= 1 && rune.q <= 7);
  assert.match(lotLabel(rune), /^1 Rune R[1-7]$/);
  assert.equal(lotLabel({ energy:10 }), '10 énergie');
});

test('créneau : ouvert de 8 h à 2 h, heure de Paris', () => {
  assert.equal(localHour(paris(28, 8)), 8);
  assert.ok(raffleOpen(paris(28, 8)));
  assert.ok(raffleOpen(paris(28, 23, 59)));
  assert.ok(raffleOpen(paris(29, 1, 59)));
  assert.ok(!raffleOpen(paris(29, 2)));
  assert.ok(!raffleOpen(paris(29, 7, 59)));
});

test('prochain raffle : 45 à 120 min, reporté après 8 h s\'il tombe la nuit', () => {
  assert.equal(nextRaffleAt(paris(28, 12), () => 0), paris(28, 12, 45));
  assert.equal(nextRaffleAt(paris(28, 12), () => 1), paris(28, 14));
  const t = nextRaffleAt(paris(29, 1, 30), () => 1);   // 3 h 30 : fermé
  assert.ok(raffleOpen(t));
  assert.equal(localHour(t), 9);
  assert.ok(t <= paris(29, 9, 16));
  assert.ok(raffleOpen(nextRaffleAt(paris(29, 1, 30), () => 0.5)));
});

test('hasard du serveur (sans random injecté) : un vrai raffle se lance', async () => {
  const store = createMemoryGameStore();
  let now = paris(28, 12);
  const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock:() => now, randomSeed:() => 7 });
  const social = createSocialService({ store, game, clock:() => now, party:null, accounts:{ getAccount: async () => null, findAccountByName: async () => null } });
  await social.raffleTick();
  now = (await store.getRaffle()).nextAt;
  await social.raffleTick();
  assert.ok((await store.getRaffle()).current);
});

test('!join sans raffle : réponse pour lui seul, rien de publié', async () => {
  const { social } = setup();
  const r = await social.chatPost(ZOE, { text:' !JOIN ' });
  assert.match(r.message.text, /pas de raffle/);
  assert.deepEqual(await texts(social, ZOE), []);
  assert.deepEqual(await texts(social, MAX), []);
});

test('déroulé : annonce, !join privé, gagnant annoncé et payé une fois', async () => {
  const { social, store, open, advance } = setup();
  await open();
  const public1 = await texts(social, MAX);
  assert.equal(public1.length, 2);
  assert.match(public1[0], /^\[Raffle\] 100 Chitine seront attribués aléatoirement à quelqu'un dans le chat dans 40 s$/);
  assert.equal(public1[1], '!join pour participer');

  assert.match((await social.chatPost(ZOE, { text:'!join', channel:'lfg' })).message.text, /Tu participes au raffle/);
  const again = await social.chatPost(ZOE, { text:'!join' });
  assert.match(again.message.text, /déjà/);
  assert.equal(again.message.channel, 'general');
  assert.deepEqual(await texts(social, MAX), public1);        // ni le !join ni la réponse ne sont lus par les autres
  await social.chatPost(ZOE, { text:'salut' });               // !join ne consomme pas la cadence

  advance(39_000); await social.raffleTick();
  assert.equal(await count(store, ZOE.id, 'Chitine'), 0);
  advance(1_000); await social.raffleTick(); await social.raffleTick();
  assert.equal(await count(store, ZOE.id, 'Chitine'), 100);
  assert.equal((await texts(social, MAX)).at(-1), '[Raffle] Zoe a gagné 100 Chitine');
  assert.equal((await social.chatGet(MAX, 0)).messages.at(-1).winner, ZOE.id);   // son navigateur relit son inventaire
  assert.ok((await store.getRaffle()).nextAt > 0);
  assert.equal((await store.getRaffle()).current, null);
});

test('invité refusé ; un seul ticket par compte ; !join après les 40 s refusé', async () => {
  const { social, store, open, advance } = setup();
  await open();
  assert.match((await social.chatPost(GUEST, { text:'!join' })).message.text, /pseudo/);
  await social.chatPost(ZOE, { text:'!join' }); await social.chatPost(ZOE, { text:'!join' });
  assert.equal((await store.getRaffle()).current.players.length, 1);
  advance(40_000);
  assert.match((await social.chatPost(MAX, { text:'!join' })).message.text, /pas de raffle/);
});

test('personne : lot perdu et annoncé, le prochain est programmé', async () => {
  const { social, store, open, advance } = setup();
  await open();
  advance(40_000); await social.raffleTick();
  assert.equal((await texts(social, ZOE)).at(-1), "[Raffle] Personne n'a participé, le lot est perdu");
  assert.ok((await store.getRaffle()).nextAt > 0);
});

test('pas de départ dans le créneau fermé (serveur rallumé la nuit)', async () => {
  const { social, store, set } = setup();
  await store.putRaffle({ nextAt: paris(29, 3), current: null });
  set(paris(29, 3, 1)); await social.raffleTick();
  const r = await store.getRaffle();
  assert.equal(r.current, null);
  assert.ok(raffleOpen(r.nextAt) && r.nextAt >= paris(29, 8));
});

test('redémarrage : le raffle reprend, les inscrits restent, tirage immédiat s\'il est échu', async () => {
  const store = createMemoryGameStore();
  const a = setup({ store });
  await a.open();
  await a.social.chatPost(ZOE, { text:'!join' });
  const b = setup({ store, start: a.clock() + 3600e3 });
  await b.social.raffleTick();
  assert.equal(await count(store, ZOE.id, 'Chitine'), 100);
  assert.equal((await store.getRaffle()).current, null);
});

test('état enregistré revérifié : lot inconnu, joueurs en double, gagnant étranger', () => {
  const lot = { item:'Chitine', qty:100 };
  assert.equal(sanitizeRaffle({ current:{ id:'x', endsAt:1, lot:{ item:'Chitine', qty:9999 }, players:[] } }).current, null);
  assert.equal(sanitizeRaffle({ current:{ id:'x', endsAt:1, lot:{ rune:'Rune', q:99 }, players:[] } }).current, null);
  const c = sanitizeRaffle({ current:{ id:'x', endsAt:1, lot, players:[{ id:'a', name:'A' }, { id:'a', name:'A' }], winner:{ id:'z', name:'Z' } } }).current;
  assert.equal(c.players.length, 1);
  assert.equal(c.winner, undefined);
  assert.deepEqual(sanitizeRaffle(null), { nextAt:null, current:null });
});

test('chat : message du jeu gardé après relecture, !join seulement écrit tel quel', () => {
  assert.ok(isRaffleJoin(' !Join ')); assert.ok(!isRaffleJoin('!join moi')); assert.ok(!isRaffleJoin(5));
  const chat = createChat({ clock:() => 1000 });
  chat.system('r', 'Raffle', '[Raffle] test', 'general');
  const other = createChat({ clock:() => 1000 });
  other.restore('r', chat.room('r'));
  assert.equal(other.since('r', 0)[0].system, true);
  const n = chat.notice('r', 'Raffle', 'pour toi', 'general');
  assert.equal(n.id, 2);
  assert.equal(chat.since('r', 0).length, 1);
  assert.equal(chat.system('r', 'Raffle', 'suite', 'general').id, 3);
});

test('affichage : un message du jeu sans préfixe de canal, texte échappé', () => {
  const html = chatLine({ system:true, at:0, text:'<b>x</b>', channel:'general', name:'Raffle' }, 'me');
  assert.ok(html.includes('chSystem') && html.includes('&lt;b&gt;') && !html.includes('[Général]'));
});
