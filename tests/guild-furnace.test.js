/* Fours de guilde (07/11/2026, Geoffrey ; src/meta/guild-furnace.js, server/guild/service.js bankFurnace) : 2 fours vitesse × 2
   alimentés par la banque, chef et officiers seulement, toutes les recettes ouvertes, la sortie se vide dans la banque. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GUILD, FURNACE } from '../src/config.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGuildService } from '../server/guild/service.js';
import { nameKey } from '../src/shared/account.js';
import { createBank, sanitizeBank, deposit, bankCount } from '../src/meta/guild-bank.js';
import { createGuildFurnaces, sanitizeGuildFurnaces, guildFurnaceOp, guildFurnacesView } from '../src/meta/guild-furnace.js';
import { bankHTML } from '../src/ui/guild.js';

const IRON = FURNACE.recipes.Fer, MS = IRON.time * 1000 / 2;   // un lingot de fer : 60 s / 2 = 30 s
let n = 0; const op = () => `op-four-${++n}`;
const bankWith = items => { const b = createBank(); for(const [k, q] of Object.entries(items)) deposit(b, k, q); return b; };
const total = b => b.slots.reduce((s, x) => s + (x?.qty ?? 0), 0) + b.furnaces.list.reduce((s, f) => s + ['ore', 'a', 'b', 'c', 'fuel', 'out'].reduce((t, k) => t + (f[k]?.qty ?? 0), 0), 0);

test('config : 2 fours de guilde, vitesse × 2', () => {
  assert.equal(GUILD.furnace.count, 2);
  assert.equal(FURNACE.tiers[GUILD.furnace.tier].speed, 2);
  const st = createGuildFurnaces();
  assert.equal(st.list.length, 2); assert.ok(st.list.every(f => f.tier === GUILD.furnace.tier));
});

test('recette depuis la banque : 2 × plus vite ; Récupérer rend les lingots à la banque ; matière conservée', () => {
  const b = bankWith({ Fer:100, Charbon:100 });
  b.furnaces = createGuildFurnaces();
  assert.ok(guildFurnaceOp(b, { action:'recipe', furnace:0, out:IRON.out, count:3, opId:op() }, 0).ok);
  assert.equal(bankCount(b, 'Fer'), 70); assert.equal(bankCount(b, 'Charbon'), 70);
  const v = guildFurnacesView(b, MS * 2 + 1);
  assert.equal(v[0].out.qty, 2, '2 lingots en 2 × 30 s');
  assert.equal(b.furnaces.list[0].out, null, 'la vue ne modifie rien');
  assert.ok(guildFurnaceOp(b, { action:'collect', furnace:0, opId:op() }, MS * 3).ok);
  assert.equal(bankCount(b, IRON.out), 3);
  assert.equal(bankCount(b, 'Fer') + bankCount(b, 'Charbon'), 140, 'ingrédients consommés : 30 + 30');
  assert.ok(guildFurnaceOp(b, { action:'recipe', furnace:1, out:IRON.out, count:2, opId:op() }, MS * 3).ok);
  const before = total(b);
  assert.ok(guildFurnaceOp(b, { action:'empty', furnace:1, opId:op() }, MS * 3 + 5).ok);
  assert.equal(total(b), before, 'Tout retirer : tout revient');
  assert.equal(bankCount(b, 'Fer'), 70);
});

test('recette fermée pour un joueur (Chitine) : ouverte dans le four de guilde', () => {
  const b = bankWith({ 'Peau de gobelin':10, Charbon:10 });
  assert.ok(guildFurnaceOp(b, { action:'recipe', furnace:0, out:'Chitine', count:1, opId:op() }, 0).ok);
  assert.ok(guildFurnacesView(b, 0)[0].recipes.find(r => r.out === 'Chitine'));
});

test('refusés : pas assez, quantités invalides, four inconnu, action inconnue ; renvoyé : une seule fois', () => {
  const b = bankWith({ Fer:20, Charbon:20 });
  assert.equal(guildFurnaceOp(b, { action:'recipe', furnace:0, out:IRON.out, count:3, opId:op() }, 0).error, 'not_enough');
  for(const count of [0, -1, 1.5, '2', Infinity, NaN]) assert.ok(guildFurnaceOp(b, { action:'recipe', furnace:0, out:IRON.out, count, opId:op() }, 0).error, String(count));
  assert.equal(guildFurnaceOp(b, { action:'recipe', furnace:2, out:IRON.out, count:1, opId:op() }, 0).error, 'bad_furnace');
  assert.equal(guildFurnaceOp(b, { action:'unlock', item:'Four en fer', opId:op() }, 0).error, 'bad_request');
  assert.equal(guildFurnaceOp(b, { action:'recipe', furnace:0, out:'Diamant', count:1, opId:op() }, 0).error, 'bad_item');
  assert.equal(bankCount(b, 'Fer'), 20, 'rien n\'a bougé');
  const id = op();
  guildFurnaceOp(b, { action:'recipe', furnace:0, out:IRON.out, count:1, opId:id }, 0);
  assert.equal(guildFurnaceOp(b, { action:'recipe', furnace:0, out:IRON.out, count:1, opId:id }, 0).repeated, true);
  assert.equal(bankCount(b, 'Fer'), 10, 'une seule fois');
});

test('relecture : les fours restent dans la banque ; état abîmé → 2 fours du tier de guilde', () => {
  const b = bankWith({ Fer:10, Charbon:10 });
  guildFurnaceOp(b, { action:'recipe', furnace:0, out:IRON.out, count:1, opId:op() }, 0);
  const r = sanitizeBank(JSON.parse(JSON.stringify(b)));
  assert.equal(r.furnaces.list[0].ore.qty, 10); assert.equal(r.furnaces.list[0].since, 0);
  const bad = sanitizeGuildFurnaces({ list:[{ tier:0, ore:{ item:'Fer', qty:-5 } }, null, {}, {}], ops:[1, 'x'] });
  assert.equal(bad.list.length, 2); assert.ok(bad.list.every(f => f.tier === GUILD.furnace.tier)); assert.equal(bad.list[0].ore, null);
  assert.deepEqual(bad.ops, ['x']);
  assert.equal(sanitizeBank(null).furnaces.list.length, 2);
});

/* ---------- serveur ---------- */
const acc = (id, name) => ({ id:id.repeat(8), name, guest:false });
const ZOE = acc('A', 'Zoe'), MAX = acc('B', 'Max'), LEA = acc('C', 'Lea');
const ALL = [ZOE, MAX, LEA];
function setup(bags){
  const clock = { now:1000 };
  const store = createMemoryGameStore(), seen = new Set(), stock = id => bags[id] ??= {};
  let k = 0;
  const guild = createGuildService({ store, clock:() => clock.now, makeId:() => `g${++k}`,
    accounts:{ getAccount: async id => ALL.find(a => a.id === id) ?? null, findAccountByName: async key => ALL.find(a => nameKey(a.name) === key) ?? null },
    statusOf: async () => ({ status:'offline' }),
    spend: async (id, item, qty, opId) => { if(seen.has(opId)) return true; if((stock(id)[item] ?? 0) < qty) return false; stock(id)[item] -= qty; seen.add(opId); return true; },
    counts: async (id, items) => Object.fromEntries(items.map(i => [i, stock(id)[i] ?? 0])),
    itemsOf: async id => Object.entries(stock(id)).filter(([, q]) => q > 0).map(([item, qty]) => ({ item, qty })) });
  return { guild, clock };
}
async function team(guild){
  await guild.create(ZOE, 'Les Mineurs');
  const id = (await guild.view(ZOE)).mine.id;
  for(const p of [MAX, LEA]){ await guild.invite(ZOE, p.name); await guild.acceptInvite(p, id); }
  await guild.promote(ZOE, MAX.id);
}

test('serveur : chef et officier lancent et récupèrent, un membre est refusé ; le temps fait la fonte ; renvoyé : une fois', async () => {
  const { guild, clock } = setup({ [LEA.id]:{ Fer:50, Charbon:50 } });
  await team(guild);
  await guild.bankDeposit(LEA, { item:'Fer', qty:50, opId:op() });
  await guild.bankDeposit(LEA, { item:'Charbon', qty:50, opId:op() });
  await assert.rejects(guild.bankFurnace(LEA, { action:'recipe', furnace:0, out:IRON.out, count:1, opId:op() }), e => e.code === 'forbidden');
  await assert.rejects(guild.bankFurnace(MAX, { action:'recipe', furnace:0, out:IRON.out, count:1 }), e => e.code === 'bad_request');
  await assert.rejects(guild.bankFurnace(MAX, { action:'recipe', furnace:0, out:IRON.out, count:9, opId:op() }), e => e.code === 'not_enough');
  const id = op();
  let v = await guild.bankFurnace(MAX, { action:'recipe', furnace:0, out:IRON.out, count:2, opId:id });
  v = await guild.bankFurnace(MAX, { action:'recipe', furnace:0, out:IRON.out, count:2, opId:id });
  assert.equal(v.bank.slots.find(s => s.item === 'Fer').qty, 30, 'compté une fois');
  assert.equal(v.furnaces.length, 2); assert.equal(v.furnaces[0].ore.qty, 20);
  clock.now += MS * 2;
  v = await guild.bank(LEA);
  assert.equal(v.furnaces[0].out.qty, 2, 'un membre voit les fours tourner');
  v = await guild.bankFurnace(ZOE, { action:'collect', furnace:0, opId:op() });
  assert.equal(v.bank.slots.find(s => s.item === IRON.out).qty, 2);
  assert.equal(v.furnaces[0].out, null);
});

test('affichage : sous-onglet Fours, boutons pour le chef et les officiers seulement', () => {
  const b = bankWith({ Fer:30, Charbon:30 });
  guildFurnaceOp(b, { action:'recipe', furnace:0, out:IRON.out, count:1, opId:op() }, 0);
  const v = { bank:{ slots:b.slots }, canUse:true, mine:[], recipes:[], gifts:[], furnaces:guildFurnacesView(b, MS / 2), now:MS / 2 };
  assert.match(bankHTML(v), /data-gbank="furnace"/);
  const h = bankHTML(v, { sub:'furnace' });
  assert.match(h, /Four de guilde 1/); assert.match(h, /Four de guilde 2/); assert.match(h, /× ?2/);
  assert.match(h, /data-g="gfRecipe"[^>]*data-f="1"/);
  assert.match(h, /width:50\.0%/, 'barre de progression à mi-chemin');
  const member = bankHTML({ ...v, canUse:false }, { sub:'furnace' });
  assert.doesNotMatch(member, /data-g="gf/); assert.match(member, /chef et les officiers/);
});
