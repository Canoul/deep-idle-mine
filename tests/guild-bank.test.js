/* Banque de guilde (05/11/2026, Geoffrey) : dépôts des membres, craft de guilde et dons aux bâtiments réservés au chef et aux
   officiers, pas de retrait, chaque demande comptée une fois, matière conservée. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GUILD } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGuildService } from '../server/guild/service.js';
import { nameKey } from '../src/shared/account.js';
import { createBank, sanitizeBank, bankable, deposit, take, bankRecipes, bankMaxCrafts, bankCraft, bankCount } from '../src/meta/guild-bank.js';
import { bankHTML, buildingHTML, logHTML, guildTabs } from '../src/ui/guild.js';

const acc = (id, name) => ({ id:id.repeat(8), name, guest:false });
const ZOE = acc('A', 'Zoe'), MAX = acc('B', 'Max'), LEA = acc('C', 'Lea');
const ALL = [ZOE, MAX, LEA];
let ops = 0; const op = () => `op-bank-${++ops}`;

function setup(bags = {}){
  let now = 1000, n = 0;
  const store = createMemoryGameStore(), seen = new Set();
  const stock = id => bags[id] ??= {};
  const guild = createGuildService({ store, clock:() => now++, makeId:() => `g${++n}`,
    accounts:{ getAccount: async id => ALL.find(a => a.id === id) ?? null, findAccountByName: async k => ALL.find(a => nameKey(a.name) === k) ?? null },
    statusOf: async () => ({ status:'offline' }),
    spend: async (id, item, qty, opId) => {
      if(seen.has(opId)) return true;
      if((stock(id)[item] ?? 0) < qty) return false;
      stock(id)[item] -= qty; seen.add(opId); return true;
    },
    counts: async (id, items) => Object.fromEntries(items.map(i => [i, stock(id)[i] ?? 0])),
    itemsOf: async id => Object.entries(stock(id)).filter(([, q]) => q > 0).map(([item, qty]) => ({ item, qty })) });
  return { guild, store, bags };
}
/* Zoe chef, Max officier, Lea membre */
async function team(guild){
  await guild.create(ZOE, 'Les Mineurs');
  const id = (await guild.view(ZOE)).mine.id;
  for(const p of [MAX, LEA]){ await guild.invite(ZOE, p.name); await guild.acceptInvite(p, id); }
  await guild.promote(ZOE, MAX.id);
  return id;
}
const forge = GUILD.buildings.find(b => b.id === 'forge');

test('logique : objets empilables seulement, piles fusionnées, craft sans stuff', () => {
  assert.equal(bankable('Diamant'), true); assert.equal(bankable('Pioche en fer'), false); assert.equal(bankable('Rune'), false); assert.equal(bankable('inconnu'), false);
  const b = sanitizeBank({ slots:[{ item:'Diamant', qty:3 }, { item:'Diamant', qty:2 }, { item:'Pioche en fer', qty:1 }, { item:'Charbon', qty:-4 }], ops:['x', 5] });
  assert.deepEqual(b.slots, [{ item:'Diamant', qty:5 }]); assert.deepEqual(b.ops, ['x']);
  assert.equal(deposit(b, 'Pioche en fer', 1), false); assert.equal(deposit(b, 'Diamant', 1.5), false);
  assert.equal(take(b, 'Diamant', 9), false, 'tout ou rien'); assert.equal(bankCount(b, 'Diamant'), 5);
  const list = bankRecipes();
  assert.ok(list.includes('Orbe') && list.includes('Clé d\'instance I'));
  assert.ok(!list.some(n => RECIPES[n] && ['Pioche en fer', 'Rune', 'Casque en mithril'].includes(n)), 'ni stuff ni rune');
  const c = createBank(); for(const [k, n] of Object.entries(RECIPES.Orbe.cost)) deposit(c, k, n * 2 + 1);
  assert.equal(bankMaxCrafts(c, 'Orbe'), 2);
  assert.equal(bankCraft(c, 'Orbe', 3).error, 'not_enough');
  assert.equal(bankCraft(c, 'Pioche en fer', 1).error, 'unknown');
  assert.ok(bankCraft(c, 'Orbe', 2).ok);
  assert.equal(bankCount(c, 'Orbe'), RECIPES.Orbe.qty * 2);
  for(const [k] of Object.entries(RECIPES.Orbe.cost)) assert.equal(bankCount(c, k), 1, 'matière conservée');
});

test('dépôt : tout membre ; les objets quittent son inventaire ; renvoyé (même opId) : une seule fois ; pas assez : refusé', async () => {
  const { guild, bags } = setup({ [LEA.id]:{ Diamant:100, 'Pioche en fer':1 } });
  await team(guild);
  const id = op();
  const v = await guild.bankDeposit(LEA, { item:'Diamant', qty:60, opId:id });
  assert.deepEqual(v.bank.slots, [{ item:'Diamant', qty:60 }]); assert.equal(bags[LEA.id].Diamant, 40);
  await guild.bankDeposit(LEA, { item:'Diamant', qty:60, opId:id });
  assert.equal((await guild.bank(LEA)).bank.slots[0].qty, 60, 'compté une fois');
  await assert.rejects(guild.bankDeposit(LEA, { item:'Diamant', qty:41, opId:op() }), e => e.code === 'not_enough');
  await assert.rejects(guild.bankDeposit(LEA, { item:'Pioche en fer', qty:1, opId:op() }), e => e.code === 'bad_item');
  for(const qty of [0, -1, 1.5, '3', Infinity]) await assert.rejects(guild.bankDeposit(LEA, { item:'Diamant', qty, opId:op() }), e => e.code === 'bad_qty', String(qty));
  assert.equal(bags[LEA.id].Diamant, 40);
  assert.equal((await guild.view(LEA)).mine.log.rows[0].kind, 'deposit');
  assert.equal(v.canUse, false, 'un membre ne s\'en sert pas');
  assert.deepEqual(v.mine.map(s => s.item), ['Diamant'], 'le stuff n\'est pas proposé');
});

test('dépôts en même temps : chacun compté, jamais plus que ce qui a quitté les inventaires', async () => {
  const { guild, bags } = setup({ [LEA.id]:{ Diamant:50 }, [MAX.id]:{ Diamant:50 } });
  await team(guild);
  const id = op();
  await Promise.all([guild.bankDeposit(LEA, { item:'Diamant', qty:50, opId:op() }), guild.bankDeposit(MAX, { item:'Diamant', qty:50, opId:id }), guild.bankDeposit(MAX, { item:'Diamant', qty:50, opId:id })]);
  assert.equal((await guild.bank(ZOE)).bank.slots[0].qty, 100);
  assert.equal(bags[LEA.id].Diamant + bags[MAX.id].Diamant, 0);
});

test('craft de guilde : chef ou officier, avec la banque ; un membre est refusé', async () => {
  const bag = Object.fromEntries(Object.entries(RECIPES.Orbe.cost).map(([k, n]) => [k, n * 3]));
  const { guild } = setup({ [LEA.id]:{ ...bag } });
  await team(guild);
  for(const [item, qty] of Object.entries(bag)) await guild.bankDeposit(LEA, { item, qty, opId:op() });
  await assert.rejects(guild.bankCraft(LEA, { item:'Orbe', count:1, opId:op() }), e => e.code === 'forbidden');
  const id = op();
  const v = await guild.bankCraft(MAX, { item:'Orbe', count:2, opId:id });
  assert.equal(v.bank.slots.find(s => s.item === 'Orbe').qty, RECIPES.Orbe.qty * 2);
  await guild.bankCraft(MAX, { item:'Orbe', count:2, opId:id });
  assert.equal((await guild.bank(ZOE)).bank.slots.find(s => s.item === 'Orbe').qty, RECIPES.Orbe.qty * 2, 'renvoyé : une fois');
  await assert.rejects(guild.bankCraft(ZOE, { item:'Orbe', count:2, opId:op() }), e => e.code === 'not_enough');
  await assert.rejects(guild.bankCraft(ZOE, { item:'Pioche en fer', count:1, opId:op() }), e => e.code === 'unknown');
  assert.equal(v.recipes.find(r => r.item === 'Orbe').max, 1);
});

test('bâtiment depuis la banque : chef ou officier, ramené à ce qu\'il manque et à ce que la banque a ; une écriture', async () => {
  const need = forge.levels[0].cost.Diamant;
  const { guild, store } = setup({ [LEA.id]:{ Diamant:need + 500 } });
  await team(guild);
  await guild.bankDeposit(LEA, { item:'Diamant', qty:need + 500, opId:op() });
  await assert.rejects(guild.bankGive(LEA, { building:'forge', item:'Diamant', qty:10, opId:op() }), e => e.code === 'forbidden');
  const id = op();
  let v = await guild.bankGive(MAX, { building:'forge', item:'Diamant', qty:need + 999, opId:id });
  assert.equal(v.mine.buildings.find(b => b.id === 'forge').materials.find(m => m.item === 'Diamant').have, need);
  assert.equal(v.mine.bank.Diamant, 500, 'le reste en banque');
  v = await guild.bankGive(MAX, { building:'forge', item:'Diamant', qty:10, opId:id });
  assert.equal(v.mine.bank.Diamant, 500, 'renvoyé : une fois');
  await assert.rejects(guild.bankGive(ZOE, { building:'forge', item:'Diamant', qty:1, opId:op() }), e => e.code === 'complete');
  await assert.rejects(guild.bankGive(ZOE, { building:'forge', item:'Rubis inférieur', qty:1, opId:op() }), e => e.code === 'not_enough');
  await assert.rejects(guild.bankGive(ZOE, { building:'forge', item:'Charbon', qty:1, opId:op() }), e => e.code === 'bad_item');
  assert.equal((await guild.view(ZOE)).mine.log.rows[0].fromBank, true);
  /* relu après un redémarrage : la banque et le don sont enregistrés */
  const again = setup(); const g2 = createGuildService({ store, accounts:{ getAccount: async id => ALL.find(a => a.id === id) ?? null, findAccountByName: async () => null }, statusOf: async () => ({ status:'offline' }) });
  assert.equal((await g2.bank(ZOE)).bank.slots[0].qty, 500);
  assert.ok(again);
});

test('sans guilde : refusé ; quitter la guilde ne rend rien', async () => {
  const { guild } = setup({ [LEA.id]:{ Diamant:10 } });
  await assert.rejects(guild.bank(LEA), e => e.code === 'no_guild');
  await assert.rejects(guild.bankDeposit(LEA, { item:'Diamant', qty:1, opId:op() }), e => e.code === 'no_guild');
});

test('affichage : onglet Banque, grilles, craft, bouton « De la banque » pour le chef et les officiers, journal', () => {
  assert.deepEqual(guildTabs({ mine:{ name:'X' } }).map(t => t.id), ['mine', 'bank', 'raid', 'search', 'board']);
  const v = { bank:{ slots:[{ item:'Diamant', qty:5 }] }, canUse:true, mine:[{ item:'Charbon', qty:3 }],
              recipes:[{ item:'Orbe', qty:1, max:0, cost:[{ item:'Diamant', need:10, have:5 }] }] };
  const chest = bankHTML(v);
  assert.match(chest, /Banque de guilde/); assert.match(chest, /Ton inventaire/); assert.match(chest, /data-bgrid="mine"/);
  const craft = bankHTML(v, { sub:'craft' });
  assert.match(craft, /data-g="bankCraft"[^>]*disabled/);
  assert.doesNotMatch(bankHTML({ ...v, canUse:false }, { sub:'craft' }), /data-g="bankCraft"/);
  const b = { id:'forge', level:0, max:1, ready:false, materials:[{ item:'Diamant', need:10, have:2 }] };
  assert.match(buildingHTML(b, { owned:{ Diamant:1 }, canBuild:true, bank:{ Diamant:4 } }), /data-g="bankGive"/);
  assert.doesNotMatch(buildingHTML(b, { owned:{ Diamant:1 }, canBuild:false, bank:{ Diamant:4 } }), /bankGive/);
  const log = logHTML({ rows:[{ at:0, name:'Zoe', kind:'deposit', item:'Diamant', qty:5 }, { at:0, name:'Max', kind:'craft', item:'Orbe', qty:2 },
                              { at:0, name:'Max', kind:'give', building:'forge', item:'Diamant', qty:3, fromBank:true }], next:0 });
  assert.match(log, /a déposé 5/); assert.match(log, /a fabriqué 2/); assert.match(log, /\(banque de guilde\)/);
});
