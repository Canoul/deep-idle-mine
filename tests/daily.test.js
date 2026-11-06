/* Événement du jour (05/11/2026, Geoffrey ; DAILY, src/shared/daily.js) : tirage sans répétition sur 3 jours, effets
   (minerais, énergie, mobs, Jugement, MI, k hole, raffle, XP), état du serveur et bandeau du Lobby. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY, ENERGY, JUDGMENT, INSTANT_MINE as MI, KHOLE } from '../src/config.js';
import { dailyDay, dailyDef, dailyFx, sanitizeDaily, dailyCandidates, rollDaily, publicDaily, dailyCost, dailyOn } from '../src/shared/daily.js';
import { newSession } from '../src/sim/session.js';
import { genArea } from '../src/sim/world.js';
import { createJudgment, addResidues, refresh, paused, publicJudgment, residuesOn } from '../src/meta/judgment.js';
import { buildInstant, instantDurationMs } from '../src/shared/instant.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createRaffle } from '../server/social/raffle.js';
import { dailyBannerHtml } from '../src/ui/daily.js';
import { fakeLive } from './helpers.js';
import { mulberry32 } from '../src/core/rng.js';

const paris = (d, h = 12) => Date.UTC(2026, 10, d, h - 1);   // novembre 2026, heure d'hiver (UTC+1)

test('config : 8 événements (Grâce divine retirée), ids uniques, textes', () => {
  assert.deepEqual(DAILY.list.map(e => e.id), ['abondante', 'ferie', 'invasion', 'cataclysme', 'mi', 'multivers', 'peuple', 'heritage']);
  for(const e of DAILY.list) assert.ok(e.name && e.icon && e.desc, e.id);
  assert.equal(dailyDef('inconnu'), null); assert.equal(dailyDef(undefined), null);
  assert.deepEqual(dailyFx(null), dailyFx('inconnu'), 'sans événement : effets neutres');
});

test('jour de Paris : minuit à minuit', () => {
  assert.equal(dailyDay(Date.UTC(2026, 10, 5, 22, 59)), '2026-11-05');   // 23 h 59 à Paris
  assert.equal(dailyDay(Date.UTC(2026, 10, 5, 23, 0)), '2026-11-06');    // minuit à Paris
});

test('tirage : jamais un événement des 2 jours d\'avant ; tous finissent par sortir', () => {
  const st = sanitizeDaily(null);
  const random = mulberry32(42);
  for(let d = 1; d <= 300; d++) rollDaily(st, Date.UTC(2026, 0, 1) + d * 86400e3, random);
  const h = st.history;
  assert.equal(h.length, DAILY.keep);
  const all = new Set();
  const s2 = sanitizeDaily(null);
  for(let d = 1; d <= 300; d++){
    rollDaily(s2, Date.UTC(2026, 0, 1) + d * 86400e3, random);
    const last = s2.history.slice(-3).map(e => e.id);
    if(last.length === 3) assert.equal(new Set(last).size, 3, `jour ${d} : ${last}`);
    all.add(s2.id);
  }
  assert.equal(all.size, DAILY.list.length);
  /* une seule fois par jour */
  const day = paris(10);
  assert.equal(rollDaily(s2, day, random), true); assert.equal(rollDaily(s2, day + 3600e3, random), false);
});

test('candidats : on regarde les dates (un jour sans état ne bloque rien)', () => {
  const ids = l => l.map(e => e.id);
  assert.ok(!ids(dailyCandidates('2026-11-05', [{ day: '2026-11-04', id: 'ferie' }, { day: '2026-11-03', id: 'mi' }])).includes('ferie'));
  assert.ok(!ids(dailyCandidates('2026-11-05', [{ day: '2026-11-03', id: 'mi' }])).includes('mi'));
  assert.ok(ids(dailyCandidates('2026-11-05', [{ day: '2026-11-02', id: 'mi' }])).includes('mi'), '3 jours après : de nouveau possible');
  assert.equal(dailyCandidates('2026-11-05', []).length, 8);
});

test('relecture : un état abîmé est vidé, l\'historique garde les jours valides', () => {
  assert.deepEqual(sanitizeDaily({ day: 'hier', id: 'mi', history: [{ day: '2026-11-04', id: 'mi' }, { day: 'x', id: 'mi' }, { day: '2026-11-03', id: 'nope' }] }),
    { day: null, id: null, history: [{ day: '2026-11-04', id: 'mi' }] });
  const st = { day: '2026-11-05', id: 'heritage', history: [{ day: '2026-11-04', id: 'mi' }, { day: '2026-11-05', id: 'heritage' }] };
  assert.equal(dailyOn(st, paris(5)), 'heritage'); assert.equal(dailyOn(st, paris(4)), 'mi'); assert.equal(dailyOn(st, paris(1)), null);
  assert.equal(publicDaily(st, paris(5)).name, 'Héritage');
  assert.equal(publicDaily(st, paris(6)), null, 'le lendemain, avant le tirage : rien');
});

test('Jour férié : coût × 0,67 arrondi (6-12 → 4-8), seuil 4 ; sans événement : inchangé', () => {
  assert.deepEqual([6, 9, 12].map(c => dailyCost(c, 'ferie')), [4, 6, 8]);
  assert.equal(dailyCost(ENERGY.cost.min, 'ferie'), 4);
  assert.equal(dailyCost(7, null), 7); assert.equal(dailyCost(7, 'mi'), 7);
});

test('Mine abondante : +2 points de minerais, avec la Shrine ; mine et prison', () => {
  assert.equal(newSession(1, { daily: 'abondante' }).oreBonus, 2);
  assert.equal(newSession(1, {}).oreBonus, 0);
  assert.equal(newSession(1, { daily: 'abondante', shrines: ['abundance'] }).oreBonus, 2 + 5);
  assert.equal(newSession(1, { daily: 'abondante', prison: { areaMax: 2 } }).oreBonus, 2, 'prison : pas de shrine, mais l\'événement');
  assert.equal(newSession(1, { daily: 'inconnu' }).daily, null);
});

test('Multivers : k hole 5 fois plus fréquent (mesuré sur 300 mines × 9 areas)', () => {
  const count = daily => { let n = 0; for(let s = 1; s <= 300; s++){ const G = newSession(s, { daily }); for(let k = 1; k <= 8; k++) genArea(G, k); n += (G.kholes || []).length; } return n; };
  const base = count(null), multi = count('multivers');
  const want = 300 * 9 * KHOLE.chance;
  assert.ok(base > want * 0.5 && base < want * 1.6, `sans : ${base} (≈ ${want})`);
  assert.ok(multi > base * 3.5 && multi < base * 6.5, `Multivers : ${multi} contre ${base}`);
});

test('Héritage : effet + 5 % d\'XP dans la partie ; Invasion : mobs × 1,25 dès l\'area 5, pas en prison', () => {
  assert.equal(newSession(1, { daily: 'heritage' }).dailyFx.xpMul, 1.05);
  const f = newSession(1, { daily: 'invasion' }).dailyFx;
  assert.equal(f.mobSpawnMul, 1.25); assert.equal(f.mobFrom, 5);
});

test('Cataclysme : les deux tours ensemble, jauge pleine à 150 ; le lendemain, retour aux règles normales', () => {
  const rules = { cap: 150, together: true }, now = 1e12;
  const j = createJudgment();
  addResidues(j, { [JUDGMENT.sides.angel.item]: 150 }, now, rules);
  assert.ok(j.angel.openUntil > now, 'ange ouvert à 150');
  assert.equal(paused(j, 'demon', now, rules), false, 'le démon continue de se remplir');
  assert.equal(paused(j, 'demon', now), true, 'sans Cataclysme : en pause');
  assert.equal(residuesOn(j, now, rules), true); assert.equal(residuesOn(j, now), false);
  addResidues(j, { [JUDGMENT.sides.demon.item]: 150 }, now, rules);
  assert.ok(j.demon.openUntil > now, 'les deux ouverts ensemble');
  const v = publicJudgment(j, now, 'A', rules);
  assert.equal(v.sides.angel.cap, 150); assert.equal(v.sides.demon.open, true);
  /* jour normal : 150 ne suffit pas */
  const k = createJudgment();
  addResidues(k, { [JUDGMENT.sides.angel.item]: 150 }, now);
  assert.equal(k.angel.openUntil, 0); assert.equal(k.angel.count, 150);
  assert.equal(refresh(k, now, rules), true, 'Cataclysme le lendemain d\'un 150 : elle ouvre');
});

test('MI abondante : 71 × 71, 10 min de jeu ; sans : 50 × 50, 5 min', () => {
  const rec = { seed: 3, id: 'mi-1', players: [{ account: 'A', name: 'A' }], looks: {}, gear: {}, skills: {} };
  const big = buildInstant({ ...rec, daily: 'mi' }), small = buildInstant(rec);
  assert.deepEqual([big.w, big.h, big.duration], [71, 71, 600]);
  assert.deepEqual([small.w, small.h, small.duration], [MI.w, MI.h, MI.duration]);
  assert.equal(instantDurationMs(2, 'mi'), 2 * instantDurationMs(2));
});

test('Pouvoir au peuple : 3 gagnants différents, chacun le lot ; moins de 3 inscrits : tous gagnent ; fin relancée : payés une fois', async () => {
  let now = paris(5, 12), state = null;
  const store = { getRaffle: async () => state, putRaffle: async r => { state = structuredClone(r); } };
  const paid = [], said = [];
  const make = () => createRaffle({ store, clock: () => now, random: () => 0, winners: async () => 3,
    give: async (id, key, lot) => { if(!paid.some(p => p.id === id && p.key === key)) paid.push({ id, key }); }, announce: async (t, w) => said.push({ t, w }) });
  const r = make();
  assert.ok(await r.force());
  for(const [id, name] of [['A', 'Ana'], ['B', 'Bob'], ['C', 'Cid'], ['D', 'Dan']]) await r.join({ id, name, guest: false });
  now += 3 * 60e3;
  await r.tick();
  assert.equal(paid.length, 3); assert.equal(new Set(paid.map(p => p.id)).size, 3);
  assert.match(said.at(-1).t, /Ana, Bob et Cid ont gagné/);
  assert.deepEqual(said.at(-1).w, ['A', 'B', 'C']);
  assert.match(said[0].t, /pour 3 gagnants/);
  /* 2 inscrits : les 2 gagnent */
  assert.ok(await r.force());
  await r.join({ id: 'A', name: 'Ana' }); await r.join({ id: 'B', name: 'Bob' });
  now += 3 * 60e3; paid.length = 0;
  await r.tick();
  assert.equal(paid.length, 2);
});

test('serveur : l\'événement est tiré une fois par jour, figé dans la session, envoyé avec les jauges ; coupé par défaut (tests)', async () => {
  let now = paris(5, 9);
  const store = createMemoryGameStore();
  await store.putDaily({ day: '2026-11-05', id: 'ferie', history: [{ day: '2026-11-05', id: 'ferie' }] });
  const game = createGameService({ store, liveRunner: fakeLive(() => ({ shares: [] })), clock: () => now, randomSeed: () => 7, dailyEvents: true, random: () => 0.99 });
  assert.equal((await game.daily()).id, 'ferie');
  assert.equal((await game.judgment({ id: 'AAAA1111' })).daily.name, 'Jour férié');
  const r = await game.start({ id: 'AAAA1111', name: 'Zoe' }, {});
  const rec = await store.getGameSession(r.session.id);
  assert.equal(rec.daily, 'ferie');
  assert.ok(rec.energy.AAAA1111 >= 4 && rec.energy.AAAA1111 <= 8, `coût ${rec.energy.AAAA1111}`);
  now = paris(6, 0) + 60e3;   // 00 h 01 le lendemain
  const next = (await game.daily()).id;
  assert.notEqual(next, 'ferie', 'pas deux jours de suite');
  assert.equal((await store.getDaily()).history.length, 2);
  /* coupé par défaut */
  const off = createGameService({ store: createMemoryGameStore(), liveRunner: fakeLive(() => ({ shares: [] })), clock: () => now, randomSeed: () => 7 });
  assert.equal(await off.daily(), null);
});

test('bandeau du Lobby : nom, effet, temps restant ; rien sans événement', () => {
  const now = paris(5, 22);
  const html = dailyBannerHtml({ name: 'Invasion', icon: '⚔', desc: '+25 % de mobs', endsAt: paris(6, 0) }, now);
  assert.match(html, /Événement du jour : Invasion/); assert.match(html, /\+25 % de mobs/); assert.match(html, /encore 2 h 00/);
  assert.equal(dailyBannerHtml(null, now), '');
  assert.match(dailyBannerHtml({ name: '<b>x</b>', icon: '', desc: '', endsAt: now + 60e3 }, now), /&lt;b&gt;/);
});
