/* Shrines (28/10/2026, Geoffrey) : Shrine d'abondance (5 points de terrain changés en minerais dans toutes les areas de
   la mine classique), payé à plusieurs dans le lobby, rattaché au compte du chef, actif 5 sessions, décompté au
   lancement ; le chef garde le même code de lobby tant qu'il a un shrine. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHRINES, AREAS, BLOCKS, IDS } from '../src/config.js';
import { createShrines, sanitizeShrines, give, consume, hasShrines, missingFor, shrineEffects, oreBonusComp, publicShrines } from '../src/meta/shrines.js';
import { createInventory, addItem, countOf, serialize } from '../src/meta/inventory.js';
import { newSession } from '../src/sim/session.js';
import { buildSession, realDurationMs } from '../src/shared/game.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { fakeLive } from './helpers.js';
import { shrinesHtml } from '../src/ui/lobby.js';

const AB = SHRINES.list.abundance, NUG = 'Pépite d\'argent', RES = 'Résidu angélique';
const sum = o => Object.values(o).reduce((s, v) => s + v, 0);
const kind = k => BLOCKS[IDS[k]]?.type;
let ops = 0; const op = () => 'op-shrine-' + (++ops).toString().padStart(4, '0');

test('config : Shrine d\'abondance = 5 % de minerais, 10 pépites d\'argent + 20 résidus angéliques, 5 sessions', () => {
  assert.equal(AB.effect.orePoints, 5); assert.equal(AB.sessions, 5);
  assert.deepEqual(AB.price, { [NUG]: 10, [RES]: 20 });
});

test('composition : 5 points pris sur le terrain au prorata, donnés aux minerais au prorata ; vide et total inchangés', () => {
  const c = AREAS[7].comp, b = oreBonusComp(c, 5);   // graphite 7 % sur 20 % de minerais (exemple de Geoffrey)
  assert.ok(Math.abs(b.graphite - (7 + 7 / 20 * 5)) < 1e-9, 'graphite 8,75 %');
  assert.ok(Math.abs(sum(b) - sum(c)) < 1e-9); assert.equal(b.air, c.air);
  const ores = o => Object.keys(o).filter(k => kind(k) === 'ore').reduce((s, k) => s + o[k], 0);
  assert.ok(Math.abs(ores(b) - ores(c) - 5) < 1e-9);
  const T = Object.keys(c).filter(k => kind(k) === 'terrain').reduce((s, k) => s + c[k], 0);
  assert.ok(Math.abs(b.stone - (c.stone - c.stone / T * 5)) < 1e-9, 'pierre au prorata');
  const a0 = oreBonusComp(AREAS[0].comp, 5);
  assert.ok(Math.abs(a0.coal - (AREAS[0].comp.coal + 5)) < 1e-9, 'le charbon compte comme minerai');
  assert.equal(oreBonusComp(c, 0), c);
  assert.deepEqual(shrineEffects(['abundance', 'abundance', 'bidule']), { orePoints: 5 }, 'un shrine compte une fois');
});

test('mine classique : un Shrine d\'abondance donne plus de minerais dans chaque area, même partie à la même seed', () => {
  const ores = G => { let n = 0; for(let y = 1; y < G.tiles.length; y++) for(const v of G.tiles[y]) if(kind(Object.keys(IDS).find(k => IDS[k] === v)) === 'ore') n++; return n; };
  const a = newSession(11, { miners: 1 }), b = newSession(11, { miners: 1, shrines: ['abundance'] });
  assert.ok(ores(b) > ores(a)); assert.equal(b.areas[0].oreTotal, a.areas[0].oreTotal * 1.5, 'area 0 : 10 % → 15 % de charbon');
  assert.deepEqual(newSession(11, { miners: 1, shrines: ['abundance'] }).tiles, b.tiles, 'déterministe');
  const rec = { seed: 11, players: [{ account: 'A', name: 'A' }], prefs: {}, gear: {}, skills: {}, spells: {}, shrines: ['abundance'] };
  assert.deepEqual(buildSession(rec).shrines, ['abundance']);
  assert.deepEqual(buildSession({ ...rec, shrines: undefined }).shrines, [], 'ancienne session : aucun');
});

test('dons : on ne prend que ce qui manque ; prix atteint → actif 5 sessions ; refusé tant qu\'il est actif', () => {
  const st = createShrines(), inv = createInventory();
  addItem(inv, NUG, 15); addItem(inv, RES, 30);
  assert.deepEqual(give(st, inv, { shrine: 'abundance', item: NUG, qty: 4, opId: op() }), { ok: true, given: 4, activated: false, repeated: false });
  assert.equal(hasShrines(st), true, 'un paiement en cours compte (code de lobby gardé)');
  assert.equal(give(st, createInventory(), { shrine: 'abundance', item: NUG, qty: 2, opId: op() }).error, 'not_owned', 'rien dans le sac');
  assert.equal(give(st, inv, { shrine: 'abundance', item: NUG, qty: 50, opId: op() }).given, 6, 'il en manquait 6 : on ne prend que ça');
  assert.equal(countOf(inv, NUG), 5);
  assert.equal(give(st, inv, { shrine: 'abundance', item: NUG, qty: 1, opId: op() }).error, 'full');
  assert.deepEqual(missingFor(st, 'abundance'), { [RES]: 20 });
  const r = give(st, inv, { shrine: 'abundance', item: RES, qty: 20, opId: op() });
  assert.equal(r.activated, true); assert.equal(st.active.abundance, 5); assert.equal(st.paid.abundance, undefined);
  assert.equal(give(st, inv, { shrine: 'abundance', item: RES, qty: 1, opId: op() }).error, 'active');
  for(const bad of [0, -1, 1.5, '3', NaN, Infinity, 1e9]) assert.equal(give(st, inv, { shrine: 'abundance', item: RES, qty: bad, opId: op() }).error, 'bad_qty', `qty ${bad}`);
  assert.equal(give(st, inv, { shrine: 'bidule', item: RES, qty: 1, opId: op() }).error, 'bad_shrine');
  assert.equal(give(createShrines(), inv, { shrine: 'abundance', item: 'Charbon', qty: 1, opId: op() }).error, 'bad_item');
  assert.equal(countOf(inv, RES), 10);
});

test('dons : une demande rejouée n\'agit qu\'une fois', () => {
  const st = createShrines(), inv = createInventory(); addItem(inv, NUG, 10);
  const id = op();
  give(st, inv, { shrine: 'abundance', item: NUG, qty: 3, opId: id });
  assert.equal(give(st, inv, { shrine: 'abundance', item: NUG, qty: 3, opId: id }).repeated, true);
  assert.equal(countOf(inv, NUG), 7); assert.equal(st.paid.abundance[NUG], 3);
});

test('lancement : chaque shrine actif perd une session, retiré à 0 ; relu et revérifié', () => {
  const st = sanitizeShrines({ active: { abundance: 2, bidule: 3 }, paid: { abundance: { [NUG]: 99 } }, code: 'K7Q4P2', ops: 'x' });
  assert.deepEqual(st.active, { abundance: 2 }); assert.deepEqual(st.paid, {}, 'actif : pas de paiement'); assert.equal(st.code, 'K7Q4P2');
  assert.deepEqual(consume(st), ['abundance']); assert.deepEqual(consume(st), ['abundance']);
  assert.deepEqual(consume(st), []); assert.equal(hasShrines(st), false);
  assert.deepEqual(sanitizeShrines({ active: { abundance: 99 } }).active, { abundance: 5 }, 'jamais plus que la durée');
  assert.deepEqual(sanitizeShrines({ paid: { abundance: { [NUG]: 99, [RES]: -3, Fer: 4 } } }).paid, { abundance: { [NUG]: 10 } });
  assert.deepEqual(publicShrines(createShrines())[0], { id: 'abundance', name: AB.name, desc: AB.desc, tex: AB.tex, sessions: 5, price: AB.price, tower: null, paid: {}, left: 0 });
});

/* ---------- serveur ---------- */

const A = { id: 'AAAA1111', name: 'Zoe', guest: false }, B = { id: 'BBBB2222', name: 'Max', guest: false };
const summary = rec => ({ id: rec.id, shares: rec.players.map(p => ({ account: p.account, left: false, bag: {} })) });
async function server({ dev = false } = {}){
  let now = 1_000_000, n = 0;
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(summary), clock: () => now, randomSeed: () => 7, dev });
  const party = createPartyService({ game, clock: () => now, getAccount: async id => ({ [A.id]: A, [B.id]: B })[id] ?? null,
                                     newCode: () => ['K7Q4P2', 'H3XM9T', 'R5B8NC', 'P2W6ZJ'][n++ % 4] });
  for(const who of [A, B]){ const inv = createInventory(); addItem(inv, NUG, 10); addItem(inv, RES, 20); await store.putInventory(who.id, JSON.parse(serialize(inv))); }
  return { game, party, store, advance: ms => { now += ms; } };
}

test('serveur : le groupe paie le shrine du chef ; actif 5 mines classiques lancées par lui, décomptées au lancement', async () => {
  const { game, party, store, advance } = await server();
  await party.create(A); await party.join(B, 'K7Q4P2');
  let r = await party.shrineGive(B, { shrine: 'abundance', item: NUG, qty: 10, opId: op() });
  assert.deepEqual(r.shrines[0].paid, { [NUG]: 10 }, 'don du membre sur le shrine du chef');
  assert.equal(countOf(r.inventory, NUG) ?? 0, 0);
  r = await party.shrineGive(A, { shrine: 'abundance', item: RES, qty: 20, opId: op() });
  assert.equal(r.activated, true); assert.equal(r.shrines[0].left, 5);
  assert.equal((await party.state(B)).shrines[0].left, 5, 'le membre voit les shrines du chef');
  assert.equal((await party.state(A)).shrines[0].left, 5);
  await assert.rejects(party.shrineGive(B, { shrine: 'abundance', item: RES, qty: 1, opId: op() }), { code: 'active' });
  for(let i = 0; i < 5; i++){
    await party.ready(B, true);
    const { session } = await party.launch(A, {});
    assert.deepEqual(session.shrines, ['abundance']);
    assert.deepEqual((await store.getGameSession(session.id)).shrines, ['abundance'], 'enregistré dans la session');
    advance(realDurationMs()); await game.pump();
  }
  assert.equal((await game.shrinesOf(A.id))[0].left, 0, 'les 5 sessions sont passées');
  await party.ready(B, true);
  assert.equal((await party.launch(A, {})).session.shrines, undefined);
});

test('serveur : pas de session décomptée hors mine classique ; les shrines restent au compte du chef', async () => {
  const { game, party, advance } = await server();
  await party.shrineGive(A, { shrine: 'abundance', item: NUG, qty: 10, opId: op() });
  await party.shrineGive(A, { shrine: 'abundance', item: RES, qty: 20, opId: op() });
  await party.create(B); await party.join(A, (await party.state(B)).party.code);
  assert.equal((await party.state(A)).shrines[0].left, 0, 'dans le groupe de B : ce sont les shrines de B');
  await party.ready(A, true);
  assert.equal((await party.launch(B, {})).session.shrines, undefined, 'B lance : pas les shrines de A');
  advance(realDurationMs()); await game.pump();
  assert.equal((await game.shrinesOf(A.id))[0].left, 5, 'rien décompté pour A');
});

test('serveur : mode dev, pas de décompte', async () => {
  const { game } = await server({ dev: true });
  await game.shrineGive(A, A.id, { shrine: 'abundance', item: NUG, qty: 10, opId: op() });
  await game.shrineGive(A, A.id, { shrine: 'abundance', item: RES, qty: 20, opId: op() });
  const { session } = await game.start(A, {});
  assert.equal(session.shrines, undefined);
  assert.equal((await game.shrinesOf(A.id))[0].left, 5);
});

test('lobby : un chef qui a un shrine garde le même code ; sans shrine, un code neuf', async () => {
  const { party } = await server();
  const c1 = (await party.create(A)).party.code; await party.leave(A);
  const c2 = (await party.create(A)).party.code; await party.leave(A);
  assert.notEqual(c1, c2, 'sans shrine : code neuf');
  await party.create(A);
  const code = (await party.state(A)).party.code;
  await party.shrineGive(A, { shrine: 'abundance', item: NUG, qty: 1, opId: op() });   // paiement en cours : ça suffit
  await party.leave(A);
  assert.equal((await party.create(A)).party.code, code, 'même code');
  await party.leave(A);
  assert.equal((await party.create(A)).party.code, code, 'toujours le même');
});

test('lobby : carte des shrines (prix, déjà donné, actif)', () => {
  const list = publicShrines(sanitizeShrines({ paid: { abundance: { [NUG]: 4 } } }));
  const h = shrinesHtml(list, { have: () => 3 });
  assert.match(h, /Shrine d'abondance/); assert.match(h, /4 \/ 10/); assert.match(h, /0 \/ 20/); assert.match(h, /data-shrine-give="abundance\|Pépite d'argent"/);
  assert.match(shrinesHtml(list, { leaderName: 'Zoe' }), /Shrines de <b>Zoe<\/b>/);
  assert.match(shrinesHtml(publicShrines(sanitizeShrines({ active: { abundance: 3 } }))), /encore <b>3<\/b> sessions/);
});
