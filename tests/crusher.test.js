/* Concasseur : famille Bloc, ordre des cases, cycle de 1 min, butin, actions du joueur, relecture, serveur. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRUSHER, ITEMS } from '../src/config.js';
import { mulberry32 } from '../src/core/rng.js';
import { createInventory, addAll, countOf, serialize } from '../src/meta/inventory.js';
import { createCrusher, crusherOp, advance, canRun, nextSlot, crushable, progress, sanitizeCrusher } from '../src/meta/crusher.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { fakeLive } from './helpers.js';

const MIN = 60_000, T0 = 1_000_000;
const NOTHING = () => 0.999999;     // hasard qui ne donne jamais rien
let n = 0;
const id = () => 'op-crush-' + (++n);
const setup = (bag = { Terre:500, Pierre:300, 'Pierre dure':200, Fer:50 }) => {
  const inv = createInventory(); addAll(inv, bag);
  return { inv, c: createCrusher() };
};
const op = (c, inv, o, now = T0) => crusherOp(c, inv, { opId:id(), ...o }, now);

test('famille Bloc : terre, pierre, pierre dure ; seuls eux se concassent', () => {
  for(const b of ['Terre', 'Pierre', 'Pierre dure']){ assert.equal(ITEMS[b].cat, 'bloc', b); assert.ok(crushable(b), b); }
  for(const x of ['Fer', 'Charbon', 'Treasure T1', 'Rubis inférieur', '__proto__', 'constructor', '', null, 3]) assert.ok(!crushable(x), String(x));
  assert.equal(createCrusher().in.length, 8); assert.equal(createCrusher().out.length, 8);
});

test('tables : les chances demandées par le créateur', () => {
  const ch = (b, item) => CRUSHER.loot[b].oneOf.flatMap(f => f.items).find(i => i.item === item)?.chance;
  for(const g of ['Rubis inférieur', 'Saphir inférieur', 'Jade inférieur']){
    assert.equal(ch('Terre', g), 0.002); assert.equal(ch('Pierre', g), 0.003); assert.equal(ch('Pierre dure', g), 0.004);
  }
  assert.equal(ch('Terre', 'Treasure T1'), 0.001);
  assert.equal(ch('Pierre', 'Treasure T2'), 0.001);
  assert.equal(ch('Pierre dure', 'Treasure T2'), 0.0015);
});

test('poser : bloc seulement, une sorte par case, quantités invalides refusées, rien ne bouge en cas de refus', () => {
  const { inv, c } = setup();
  assert.equal(op(c, inv, { action:'load', slot:0, item:'Fer', qty:10 }).error, 'bad_item');
  for(const slot of [-1, 8, 1.5, '0', null]) assert.equal(op(c, inv, { action:'load', slot, item:'Terre', qty:10 }).error, 'bad_slot');
  for(const qty of [0, -5, 2.5, Infinity, NaN, '100', 1e300]) assert.equal(op(c, inv, { action:'load', slot:0, item:'Terre', qty }).error, 'bad_qty');
  assert.equal(op(c, inv, { action:'load', slot:0, item:'Terre', qty:501 }).error, 'not_enough');
  assert.ok(op(c, inv, { action:'load', slot:0, item:'Terre', qty:150 }).ok);
  assert.equal(op(c, inv, { action:'load', slot:0, item:'Pierre', qty:10 }).error, 'slot_busy');
  assert.ok(op(c, inv, { action:'load', slot:0, item:'Terre', qty:50 }).ok);
  assert.deepEqual(c.in[0], { item:'Terre', qty:200 });
  assert.equal(countOf(inv, 'Terre'), 300);
});

test('ordre : de haut en bas, de gauche à droite ; une case de moins de 100 est sautée', () => {
  const { inv, c } = setup();
  op(c, inv, { action:'load', slot:5, item:'Pierre', qty:100 });
  op(c, inv, { action:'load', slot:1, item:'Terre', qty:99 });
  op(c, inv, { action:'load', slot:2, item:'Pierre dure', qty:200 });
  assert.equal(nextSlot(c), 2);
  advance(c, T0 + MIN, NOTHING);
  assert.equal(c.in[2].qty, 100, 'case 3 (index 2) concassée en premier');
  advance(c, T0 + 2 * MIN, NOTHING);
  assert.equal(c.in[2], null);
  assert.equal(nextSlot(c), 5);
  advance(c, T0 + 3 * MIN, NOTHING);
  assert.equal(c.in[5], null);
  assert.deepEqual(c.in[1], { item:'Terre', qty:99 }, 'moins de 100 : jamais concassé');
  assert.equal(c.since, null, 'plus rien à concasser : à l\'arrêt');
  assert.equal(c.crushed, 3);
});

test('cycle : 100 blocs par minute, pas avant, même page fermée (plusieurs cycles d\'un coup)', () => {
  const { inv, c } = setup();
  op(c, inv, { action:'load', slot:0, item:'Terre', qty:500 });
  assert.equal(c.since, T0);
  assert.equal(advance(c, T0 + MIN - 1, NOTHING), 0);
  assert.equal(c.in[0].qty, 500, 'rien consommé avant la fin du cycle');
  assert.ok(Math.abs(progress(c, T0 + MIN / 2) - 0.5) < 1e-9);
  assert.equal(advance(c, T0 + 3.5 * MIN, NOTHING), 3);
  assert.equal(c.in[0].qty, 200);
  assert.equal(c.since, T0 + 3 * MIN, 'le cycle en cours garde son avance');
  assert.equal(advance(c, T0 + 100 * MIN, NOTHING), 2);
  assert.equal(c.in[0], null); assert.equal(c.since, null);
  assert.ok(c.out.every(s => !s), 'hasard qui ne donne rien : sortie vide');
});

test('butin : gemme et treasure tirés, empilés dans la sortie, notés dans les trouvailles', () => {
  const { inv, c } = setup();
  op(c, inv, { action:'load', slot:0, item:'Terre', qty:300 });
  const lucky = () => 0;          // premier objet de chaque famille : Rubis + Treasure T1
  advance(c, T0 + 3 * MIN, lucky);
  assert.deepEqual(c.out[0], { item:'Rubis inférieur', qty:3 });
  assert.deepEqual(c.out[1], { item:'Treasure T1', qty:3 });
  assert.equal(c.finds.length, 3); assert.equal(c.finds[0].from, 'Terre');
  const { inv: inv2, c: c2 } = setup();
  op(c2, inv2, { action:'load', slot:0, item:'Pierre', qty:100 });
  advance(c2, T0 + MIN, lucky);
  assert.deepEqual(c2.out.filter(Boolean).map(s => s.item), ['Rubis inférieur', 'Treasure T2']);
});

test('fréquence du butin proche des chances (200 000 lots de terre, hasard déterministe)', () => {
  const rng = mulberry32(42), N = 200_000, got = {};
  const c = createCrusher();
  c.in[0] = { item:'Terre', qty:N * CRUSHER.batch }; c.since = 0;
  advance(c, N * MIN, rng);
  for(const s of c.out) if(s) got[s.item] = s.qty;
  assert.equal(c.crushed, N);
  for(const g of ['Rubis inférieur', 'Saphir inférieur', 'Jade inférieur']) assert.ok(got[g] > 320 && got[g] < 480, `${g} : ${got[g]} (attendu ~400)`);
  assert.ok(got['Treasure T1'] > 140 && got['Treasure T1'] < 260, `Treasure T1 : ${got['Treasure T1']} (attendu ~200)`);
});

test('retirer, récupérer une case, tout récupérer ; opId rejoué sans effet', () => {
  const { inv, c } = setup();
  op(c, inv, { action:'load', slot:3, item:'Pierre', qty:250 });
  advance(c, T0 + 2 * MIN, () => 0);
  assert.equal(c.in[3].qty, 50);
  assert.ok(op(c, inv, { action:'unload', slot:3 }, T0 + 2 * MIN).ok);
  assert.equal(countOf(inv, 'Pierre'), 100);
  assert.equal(c.since, null);
  const o = { action:'collect', slot:0, opId:'op-crush-double' };
  assert.equal(crusherOp(c, inv, o, T0).repeated, false);
  assert.equal(crusherOp(c, inv, o, T0).repeated, true);
  assert.equal(countOf(inv, 'Rubis inférieur'), 2);
  assert.ok(op(c, inv, { action:'collect', slot:'all' }).ok);
  assert.equal(countOf(inv, 'Treasure T2'), 2);
  assert.ok(c.out.every(s => !s));
  assert.equal(op(c, inv, { action:'collect', slot:9 }).error, 'bad_slot');
  assert.equal(op(c, inv, { action:'hack' }).error, 'bad_request');
});

test('retirer pendant un cycle : rien n\'est perdu, le cycle continue sur la case suivante', () => {
  const { inv, c } = setup();
  op(c, inv, { action:'load', slot:0, item:'Terre', qty:100 });
  op(c, inv, { action:'load', slot:1, item:'Pierre', qty:100 });
  op(c, inv, { action:'unload', slot:0 }, T0 + 30_000);
  assert.equal(countOf(inv, 'Terre'), 500);
  assert.equal(c.since, T0);
  advance(c, T0 + MIN, NOTHING);
  assert.equal(c.in[1], null, 'la pierre est concassée à la fin du cycle');
});

test('sortie pleine : pas de cycle, aucun bloc consommé', () => {
  const { inv, c } = setup();
  c.out = Array.from({ length:8 }, (_, i) => ({ item:'Rubis inférieur', qty:i + 1 }));
  op(c, inv, { action:'load', slot:0, item:'Terre', qty:100 });
  assert.ok(!canRun(c)); assert.equal(c.since, null);
  advance(c, T0 + 10 * MIN, () => 0);
  assert.equal(c.in[0].qty, 100);
});

test('relecture : sauvegarde trafiquée nettoyée', () => {
  const c = sanitizeCrusher({ in:[{ item:'Fer', qty:100 }, { item:'Terre', qty:-5 }, { item:'Terre', qty:2.5 }, { item:'Pierre', qty:300 }],
                              out:[{ item:'Diamant', qty:5 }, { item:'Jade inférieur', qty:2 }, null, null, null, null, null, null, { item:'Rubis inférieur', qty:1 }],
                              since:Infinity, crushed:-3, finds:[{ at:1, from:'Fer', loot:{} }], ops:[1, 'a'] });
  assert.deepEqual(c.in, [null, null, null, { item:'Pierre', qty:300 }, null, null, null, null]);
  assert.deepEqual(c.out[1], { item:'Jade inférieur', qty:2 }); assert.equal(c.out[0], null); assert.equal(c.out.length, 8);
  assert.equal(c.since, null); assert.equal(c.crushed, 0); assert.deepEqual(c.finds, []); assert.deepEqual(c.ops, ['a']);
  assert.deepEqual(sanitizeCrusher(null), createCrusher());
});

/* ---- serveur ---- */
const ME = { id:'AAAA1111', name:'Zoe', guest:false };
async function server(bag, random = NOTHING){
  let now = T0;
  const store = createMemoryGameStore();
  const inv = createInventory(); addAll(inv, bag);
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  const game = createGameService({ store, liveRunner:fakeLive(() => ({ shares:[] })), clock:() => now, dev:false,
                                   config:{ startsPerHour:1000, keepEnded:1e12 }, random });
  return { game, store, at: t => { now = t; } };
}

test('serveur : poser, concasser au fil du temps, enregistré une seule fois, état dans /state', async () => {
  let rolls = 0;
  const { game, store, at } = await server({ Terre:300 }, () => { rolls++; return 0; });
  let r = await game.crusher(ME, { action:'load', slot:0, item:'Terre', qty:300, opId:'op-crush-load' });
  assert.deepEqual(r.crusher.in[0], { item:'Terre', qty:300 });
  assert.ok(!r.inventory.slots.some(s => s?.item === 'Terre'));
  at(T0 + 2 * MIN);
  r = await game.crusherState(ME);
  assert.equal(r.crusher.in[0].qty, 100);
  assert.deepEqual(r.crusher.out[0], { item:'Rubis inférieur', qty:2 });
  const after = rolls;
  r = await game.crusherState(ME);                     // relu : rien n'est retiré une 2e fois
  assert.equal(rolls, after); assert.equal(r.crusher.out[0].qty, 2);
  assert.equal((await store.getCrusher(ME.id)).crushed, 2, 'enregistré');
  assert.equal((await game.state(ME)).crusher.crushed, 2);
  r = await game.crusher(ME, { action:'collect', slot:'all', opId:'op-crush-all' });
  assert.equal(r.inventory.slots.find(s => s?.item === 'Rubis inférieur').qty, 2);
  assert.equal(r.inventory.slots.find(s => s?.item === 'Treasure T1').qty, 2);
  assert.ok(!('ops' in r.crusher), 'la mémoire des demandes reste au serveur');
});

test('serveur : demandes invalides refusées', async () => {
  const { game } = await server({ Terre:100 });
  await assert.rejects(game.crusher(ME, { action:'load', slot:0, item:'Terre', qty:100, opId:'x' }), { code:'bad_request' });
  await assert.rejects(game.crusher(ME, { action:'load', slot:0, item:'Fer', qty:1, opId:'op-crush-bad1' }), { code:'bad_item' });
  await assert.rejects(game.crusher(ME, { action:'load', slot:0, item:'Terre', qty:101, opId:'op-crush-bad2' }), { code:'not_enough' });
});
