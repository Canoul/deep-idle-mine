/* Signalements (01/11/2026, exigence des stores) : texte copié par le serveur, 10 par heure, un seul par message, motif
   et commentaire vérifiés, envoi sur le salon privé, jamais sur un message qu'on ne peut pas lire. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODERATION, RULES } from '../src/config.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createSocialService } from '../server/social/service.js';
import { createModerationService } from '../server/moderation/service.js';
import { createReportService, reportMessage } from '../server/moderation/reports.js';
import { fakeLive } from './helpers.js';

const rules = { rulesVersion: RULES.version };
const ME = { id:'AAAA1111', name:'Zoe', guest:false, ...rules }, OTHER = { id:'BBBB2222', name:'Max', guest:false, ...rules }, THIRD = { id:'CCCC3333', name:'Lou', guest:false, ...rules };
const ACCOUNTS = { [ME.id]: ME, [OTHER.id]: OTHER, [THIRD.id]: THIRD };
function setup(){
  const t = { now: 2_000_000 }, clock = () => t.now, store = createMemoryGameStore(), sent = [];
  const accounts = { getAccount: async id => ACCOUNTS[id] ?? null, findAccountByName: async key => Object.values(ACCOUNTS).find(a => a.name.toLowerCase() === key) ?? null };
  const moderation = createModerationService({ store, clock });
  const game = createGameService({ store, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })), clock, randomSeed: () => 7, moderation });
  const party = createPartyService({ game, clock, getAccount: accounts.getAccount });
  const social = createSocialService({ store, game, party, clock, moderation, accounts });
  const reports = createReportService({ store, accounts, clock, social, game, announce: async text => { sent.push(text); } });
  return { t, store, social, reports, sent, say: async (who, text, extra = {}) => { t.now += 4000; return (await social.chatPost(who, { text, ...extra })).message; } };
}

test('signaler un message : le serveur copie le texte et l\'auteur, le navigateur ne peut pas les choisir', async () => {
  const { reports, say, store, sent } = setup();
  const m = await say(OTHER, 'message à signaler');
  const r = await reports.report(ME, { source: 'global', message: m.id, reason: 'spam', comment: '  il insiste  ', text: 'texte inventé', target: THIRD.id });
  assert.equal(r.ok, true);
  const [saved] = await store.listReports();
  assert.equal(saved.by, ME.id); assert.equal(saved.target, OTHER.id, 'l\'auteur du message, pas la cible envoyée');
  assert.equal(saved.message.text, 'message à signaler'); assert.equal(saved.reason, 'spam'); assert.equal(saved.comment, 'il insiste');
  assert.equal(saved.open, true); assert.ok(Number.isFinite(saved.at));
  assert.equal(sent.length, 1); assert.match(sent[0], /message à signaler/); assert.match(sent[0], /Zoe/); assert.match(sent[0], /Max/);
});

test('un seul signalement par message et par compte : le second ne compte pas, un autre joueur peut signaler', async () => {
  const { reports, say, store, sent } = setup();
  const m = await say(OTHER, 'salut');
  await reports.report(ME, { source: 'global', message: m.id, reason: 'spam' });
  const again = await reports.report(ME, { source: 'global', message: m.id, reason: 'other' });
  assert.equal(again.already, true);
  await reports.report(THIRD, { source: 'global', message: m.id, reason: 'spam' });
  assert.equal((await store.listReports()).length, 2); assert.equal(sent.length, 2);
});

test('limite : 10 par compte et par heure, fiches comprises, repart après une heure, survit à un redémarrage', async () => {
  const { reports, t, say, store, social } = setup();
  assert.equal(MODERATION.reportsPerHour, 10);
  for(let i = 0; i < 10; i++){ const m = await say(OTHER, 'msg ' + i); await reports.report(ME, { source: 'global', message: m.id, reason: 'spam' }); }
  await assert.rejects(reports.report(ME, { source: 'player', target: OTHER.id, reason: 'cheat' }), e => e.status === 429 && e.code === 'rate_limited' && e.retryAfter > 0);
  await reports.report(THIRD, { source: 'player', target: OTHER.id, reason: 'cheat' });    // un autre compte n'est pas touché
  const fresh = createReportService({ store, accounts: { getAccount: async id => ACCOUNTS[id] }, clock: () => t.now, social, game: {} });
  await assert.rejects(fresh.report(ME, { source: 'player', target: OTHER.id, reason: 'cheat' }), e => e.status === 429);
  t.now += 3600e3;
  assert.equal((await reports.report(ME, { source: 'player', target: OTHER.id, reason: 'cheat' })).ok, true);
});

test('fiche d\'un joueur : pas de message copié ; refusé pour soi-même et pour un compte inconnu', async () => {
  const { reports, store } = setup();
  await reports.report(ME, { source: 'player', target: OTHER.id, reason: 'name' });
  assert.equal((await store.listReports())[0].message, null);
  await assert.rejects(reports.report(ME, { source: 'player', target: ME.id, reason: 'name' }), e => e.status === 400);
  await assert.rejects(reports.report(ME, { source: 'player', target: 'ZZZZ9999', reason: 'name' }), e => e.status === 404);
});

test('motif et commentaire vérifiés : motif inconnu, commentaire trop long ou pas du texte', async () => {
  const { reports, store } = setup();
  for(const reason of ['', 'autre chose', 12, null, undefined, '__proto__'])
    await assert.rejects(reports.report(ME, { source: 'player', target: OTHER.id, reason }), e => e.status === 400, String(reason));
  for(const comment of ['x'.repeat(MODERATION.reportCommentMax + 1), 12, {}])
    await assert.rejects(reports.report(ME, { source: 'player', target: OTHER.id, reason: 'other', comment }), e => e.status === 400);
  assert.equal((await store.listReports()).length, 0);
});

test('message illisible ou absent : un MP d\'autrui, son propre message, un numéro bidon', async () => {
  const { reports, say } = setup();
  const mp = await say(OTHER, 'secret', { channel: 'mp', to: 'Lou' });
  await assert.rejects(reports.report(ME, { source: 'global', message: mp.id, reason: 'spam' }), e => e.status === 404);
  assert.equal((await reports.report(THIRD, { source: 'global', message: mp.id, reason: 'spam' })).ok, true, 'le destinataire peut');
  const mine = await say(ME, 'moi');
  await assert.rejects(reports.report(ME, { source: 'global', message: mine.id, reason: 'spam' }), e => e.status === 400);
  for(const id of [9999, -1, 'a', 1.5, undefined])
    await assert.rejects(reports.report(ME, { source: 'global', message: id, reason: 'spam' }), e => e.status === 404, String(id));
  await assert.rejects(reports.report(ME, { source: 'mars', message: 1, reason: 'spam' }), e => e.status === 400);
});

test('salon privé : Discord en panne ne fait pas échouer le signalement ; mise en forme neutralisée, longueur bornée', async () => {
  const { store, social, say } = setup();
  const reports = createReportService({ store, accounts: { getAccount: async id => ACCOUNTS[id] }, social, game: {}, announce: async () => { throw new Error('panne'); } });
  const m = await say(OTHER, 'x');
  assert.equal((await reports.report(ME, { source: 'global', message: m.id, reason: 'spam' })).ok, true);
  const text = reportMessage({ id: 3, reason: 'other', source: 'global', byName: '*Zoe*', targetName: 'Max', comment: '`code`', message: { id: 1, text: '@everyone **x**' } });
  assert.ok(text.includes('\\*\\*x')); assert.ok(text.length <= 2000);
  assert.ok(reportMessage({ id: 3, reason: 'other', source: 'player', byName: 'a', targetName: 'b', comment: 'x'.repeat(5000), message: null }).length <= 2000);
});

test('administration : liste filtrée par joueur et par état, clôture idempotente', async () => {
  const { reports } = setup();
  await reports.report(ME, { source: 'player', target: OTHER.id, reason: 'name' });
  await reports.report(OTHER, { source: 'player', target: THIRD.id, reason: 'cheat' });
  assert.equal((await reports.list({ account: THIRD.id })).length, 1);
  assert.equal((await reports.list({ account: OTHER.id })).length, 2, 'signalé ou signaleur');
  const [last] = await reports.list({});
  assert.equal((await reports.close(last.id, 'geoffrey')).open, false);
  assert.equal((await reports.close(last.id, 'autre')).closedBy, 'geoffrey');
  assert.equal((await reports.list({ open: true })).length, 1);
  await assert.rejects(reports.close(9999, 'x'), e => e.status === 404);
});
