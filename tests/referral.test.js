/* Parrainage (05/11/2026, Geoffrey ; REFERRAL) : code et lien, entrer le code d'un parrain, récompense au niveau 5 pour le
   filleul et son parrain, comptes d'avant affiliés d'office à Canoul (lui ne reçoit rien), fenêtre de Mon compte. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFERRAL, ITEMS } from '../src/config.js';
import { parseReferralCode, referralLink, referralRefusal } from '../src/shared/referral.js';
import { xpForLevel } from '../src/meta/level.js';

const LV5 = xpForLevel(REFERRAL.level);
const OLD = REFERRAL.legacyBefore - 1000, NEW = REFERRAL.legacyBefore + 1000;

async function setup(accounts){
  const { createMemoryGameStore } = await import('../server/game/store.js');
  const { createGameService } = await import('../server/game/service.js');
  const { fakeLive } = await import('./helpers.js');
  const store = createMemoryGameStore();
  const byId = Object.fromEntries(accounts.map(a => [a.id, { nameKey: a.name.toLowerCase(), ...a }]));
  const game = createGameService({ store, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })), clock: () => NEW + 5000, randomSeed: () => 1,
    accountOf: async id => byId[id] ?? null, accountByName: async key => Object.values(byId).find(a => a.nameKey === key) ?? null });
  const me = id => ({ id, name: byId[id].name });
  const gems = async id => ((await store.getInventory(id))?.slots ?? []).filter(x => x?.item === REFERRAL.item).reduce((n, x) => n + x.qty, 0);
  return { store, game, me, gems };
}

test('config : 10 Émeraudes (légendaire) au niveau 5 ; code = ID de compte ; lien ?ref=', () => {
  assert.deepEqual([REFERRAL.item, REFERRAL.qty, REFERRAL.level], ['Émeraude', 10, 5]);
  assert.ok(ITEMS['Émeraude'].stack);
  assert.equal(parseReferralCode('abcd-1234'), 'ABCD1234');
  assert.equal(parseReferralCode(' ABCD 1234 '), 'ABCD1234');
  for(const bad of ['', 'ABC', 'ABCD12345', 'ABCD-12$4', null, 42]) assert.equal(parseReferralCode(bad), null, String(bad));
  assert.equal(referralLink('https://deepmineidle.fr/', 'ABCD1234'), 'https://deepmineidle.fr/?ref=ABCD1234');
  assert.equal(referralRefusal({ me: 'A', rec: null, level: 1, code: 'B', target: {}, targetRec: { by: 'A' } }), 'cycle');
});

test('entrer un code : refusé (invalide, inconnu, le sien, déjà un parrain, trop tard) ; accepté une fois', async () => {
  const { game, me, store } = await setup([{ id: 'AAAA1111', name: 'Ana', createdAt: NEW }, { id: 'BBBB2222', name: 'Bob', createdAt: NEW },
                                           { id: 'CCCC3333', name: 'Cid', createdAt: NEW }]);
  await assert.rejects(game.setReferral(me('BBBB2222'), { code: 'xx' }), { code: 'bad_code' });
  await assert.rejects(game.setReferral(me('BBBB2222'), { code: 'ZZZZ9999' }), { code: 'unknown_code' });
  await assert.rejects(game.setReferral(me('BBBB2222'), { code: 'BBBB-2222' }), { code: 'self' });
  const r = await game.setReferral(me('BBBB2222'), { code: 'aaaa-1111' });
  assert.equal(r.by.name, 'Ana');
  await assert.rejects(game.setReferral(me('BBBB2222'), { code: 'CCCC3333' }), { code: 'already' });
  await assert.rejects(game.setReferral(me('AAAA1111'), { code: 'BBBB2222' }), { code: 'cycle' }, 'son filleul ne peut pas devenir son parrain');
  await store.putProgress('CCCC3333', { xp: LV5, credited: [] });
  await assert.rejects(game.setReferral(me('CCCC3333'), { code: 'AAAA1111' }), { code: 'too_late' });
  const info = await game.referral(me('AAAA1111'));
  assert.deepEqual([info.code, info.referees, info.canSet, info.by], ['AAAA-1111', 1, true, null]);
});

test('niveau 5 atteint : 10 Émeraudes pour le filleul ET le parrain, une seule fois', async () => {
  const { game, me, store, gems } = await setup([{ id: 'AAAA1111', name: 'Ana', createdAt: NEW }, { id: 'BBBB2222', name: 'Bob', createdAt: NEW }]);
  await game.setReferral(me('BBBB2222'), { code: 'AAAA1111' });
  await store.putProgress('BBBB2222', { xp: LV5 - 1, credited: [] });
  await game.state(me('BBBB2222'));
  assert.deepEqual([await gems('BBBB2222'), await gems('AAAA1111')], [0, 0], 'niveau 4 : rien');
  await store.putProgress('BBBB2222', { xp: LV5, credited: [] });
  await Promise.all([game.state(me('BBBB2222')), game.state(me('BBBB2222')), game.referral(me('BBBB2222'))]);   // en même temps : une fois
  await game.state(me('BBBB2222'));
  assert.deepEqual([await gems('BBBB2222'), await gems('AAAA1111')], [10, 10]);
  const rec = await store.getReferral('BBBB2222');
  assert.deepEqual([rec.done, rec.paid], [true, true]);
  const info = await game.referral(me('AAAA1111'));
  assert.deepEqual([info.referees, info.rewarded], [1, 1]);
  assert.equal((await game.referral(me('BBBB2222'))).done, true);
});

test('comptes d\'avant : affiliés à Canoul, 10 Émeraudes au niveau 5 (déjà atteint : tout de suite), et 10 pour Canoul (05/11 13 h)', async () => {
  const { game, me, store, gems } = await setup([{ id: 'CANO0001', name: 'canoul', createdAt: OLD - 1e6 }, { id: 'OLDD0001', name: 'Vieux', createdAt: OLD },
                                                 { id: 'OLDD0002', name: 'Lent', createdAt: OLD }, { id: 'NEWW0001', name: 'Neuf', createdAt: NEW }]);
  await store.putProgress('OLDD0001', { xp: LV5 * 10, credited: [] });
  const info = await game.referral(me('OLDD0001'));
  assert.deepEqual([info.by.name, info.by.legacy, info.done, info.canSet], ['canoul', true, true, false]);
  assert.equal(await gems('OLDD0001'), 10);
  assert.equal(await gems('CANO0001'), 10, 'Canoul : sa part aussi (legacyPaysReferrer)');
  await game.state(me('OLDD0001'));
  assert.equal(await gems('OLDD0001'), 10, 'une seule fois');
  assert.equal(await gems('CANO0001'), 10, 'une seule fois pour Canoul aussi');
  await store.putProgress('OLDD0002', { xp: 0, credited: [] });
  assert.equal((await game.referral(me('OLDD0002'))).by.name, 'canoul');
  await assert.rejects(game.setReferral(me('OLDD0002'), { code: 'NEWW0001' }), { code: 'already' }, 'déjà affilié : pas de code');
  assert.equal((await game.referral(me('NEWW0001'))).by, null, 'compte créé après : pas d\'affiliation d\'office');
  assert.equal((await game.referral(me('CANO0001'))).by, null, 'Canoul n\'est pas son propre filleul');
});

test('fenêtre « Parrainer un ami » : code, lien, filleuls, parrain ou case pour entrer un code', async () => {
  const { referralHtml } = await import('../src/ui/account.js').catch(() => ({}));
  if(!referralHtml) return;   // module navigateur
  const base = { code: 'AAAA-1111', id: 'AAAA1111', level: 2, need: 5, item: 'Émeraude', qty: 10, referees: 3, rewarded: 1 };
  const h = referralHtml({ ...base, by: null, canSet: true }, 'https://deepmineidle.fr');
  assert.match(h, /AAAA-1111/); assert.match(h, /https:\/\/deepmineidle\.fr\/\?ref=AAAA1111/); assert.match(h, /data-mode="referral"/);
  assert.match(h, /3 \(1 récompense reçue\)/);
  const k = referralHtml({ ...base, by: { name: 'Ana' }, canSet: false, done: false }, 'https://deepmineidle.fr');
  assert.match(k, /Ana/); assert.doesNotMatch(k, /data-mode="referral"/); assert.match(k, /tu es niveau 2/);
});

test('rattrapage : un compte récompensé avant le réglage (sans la part de Canoul) la lui verse une fois', async () => {
  const { game, me, store, gems } = await setup([{ id: 'CANO0001', name: 'canoul', createdAt: OLD - 1e6 }, { id: 'OLDD0001', name: 'Vieux', createdAt: OLD }]);
  await store.putProgress('OLDD0001', { xp: LV5 * 10, credited: [] });
  await store.putReferral('OLDD0001', { by: 'CANO0001', at: null, legacy: true, done: true, doneAt: 1, paid: false });   // versé avant 13 h
  await Promise.all([game.state(me('OLDD0001')), game.state(me('OLDD0001')), game.referral(me('OLDD0001'))]);
  await game.state(me('OLDD0001'));
  assert.deepEqual([await gems('CANO0001'), await gems('OLDD0001')], [10, 0], 'Canoul : sa part une fois ; le filleul ne reçoit rien de plus');
  assert.equal((await store.getReferral('OLDD0001')).paid, true);
});
