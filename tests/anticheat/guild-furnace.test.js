/* Anti-triche : fours de guilde (07/11/2026, src/meta/guild-furnace.js). Rien ne naît, rien ne disparaît : la matière de la
   banque + des fours ne change qu'au rythme de la fonte ; quantités et objets invalides refusés ; une demande renvoyée n'agit
   qu'une fois ; les fours d'un joueur ne peuvent pas voler le tier de guilde. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GUILD, FURNACE } from '../../src/config.js';
import { createBank, deposit, bankCount, sanitizeBank } from '../../src/meta/guild-bank.js';
import { guildFurnaceOp } from '../../src/meta/guild-furnace.js';
import { sanitizeFurnaces } from '../../src/meta/furnace.js';

let n = 0; const op = () => `ac-gf-${++n}`;
const SLOTS = ['ore', 'a', 'b', 'c', 'fuel', 'out'];
const count = (b, item) => bankCount(b, item) + b.furnaces.list.reduce((s, f) => s + SLOTS.reduce((t, k) => t + (f[k]?.item === item ? f[k].qty : 0), 0), 0);

test('tout retirer, relancer, retirer encore : jamais plus de fer ni de charbon qu\'au départ', () => {
  const b = createBank(); deposit(b, 'Fer', 100); deposit(b, 'Charbon', 100);
  b.furnaces = sanitizeBank(b).furnaces;
  for(let k = 0; k < 20; k++){
    guildFurnaceOp(b, { action:'recipe', furnace:k % 2, out:'Lingot de fer', count:1 + (k % 3), opId:op() }, k);
    guildFurnaceOp(b, { action:k % 2 ? 'empty' : 'emptyAll', furnace:k % 2, opId:op() }, k);
  }
  assert.equal(count(b, 'Fer'), 100); assert.equal(count(b, 'Charbon'), 100); assert.equal(count(b, 'Lingot de fer'), 0);
});

test('fonte : chaque lingot coûte exactement sa recette', () => {
  const b = createBank(); deposit(b, 'Fer', 100); deposit(b, 'Charbon', 100);
  guildFurnaceOp(b, { action:'recipe', furnace:0, out:'Lingot de fer', count:10, opId:op() }, 0);
  guildFurnaceOp(b, { action:'collect', furnace:0, opId:op() }, 1e9);
  assert.equal(count(b, 'Lingot de fer'), 10); assert.equal(count(b, 'Fer'), 0); assert.equal(count(b, 'Charbon'), 0);
});

test('quantités, cases, objets et actions invalides : refusés sans rien bouger ; rejouée : une fois', () => {
  const b = createBank(); deposit(b, 'Fer', 10); deposit(b, 'Charbon', 10);
  const bad = [
    { action:'recipe', furnace:0, out:'Lingot de fer', count:-1 }, { action:'recipe', furnace:0, out:'Lingot de fer', count:1e300 },
    { action:'recipe', furnace:0, out:'Lingot de fer', count:'1' }, { action:'recipe', furnace:'0', out:'Lingot de fer', count:1 },
    { action:'recipe', furnace:-1, out:'Lingot de fer', count:1 }, { action:'recipe', furnace:0, out:'Pioche en fer', count:1 },
    { action:'load', furnace:0, slot:'out', item:'Lingot de fer', qty:5 }, { action:'load', furnace:0, slot:'ore', item:'Fer', qty:11 },
    { action:'load', furnace:0, slot:'ore', item:'Fer', qty:NaN }, { action:'unlock', item:'Four en or' }, { action:'__proto__' },
  ];
  for(const o of bad) assert.ok(guildFurnaceOp(b, { ...o, opId:op() }, 0).error, JSON.stringify(o));
  assert.equal(bankCount(b, 'Fer'), 10); assert.equal(bankCount(b, 'Charbon'), 10);
  const id = op();
  for(let k = 0; k < 3; k++) guildFurnaceOp(b, { action:'load', furnace:0, slot:'ore', item:'Fer', qty:4, opId:id }, 0);
  assert.equal(bankCount(b, 'Fer'), 6);
});

test('un four de joueur enregistré avec le tier de guilde reste relu tel quel (pas de tier inventé), une banque abîmée non plus', () => {
  /* le tier de guilde n'est jamais donné à un joueur par le jeu ; relu, il ne dépasse pas les tiers connus */
  const st = sanitizeFurnaces({ list:[{ tier:99 }, { tier:GUILD.furnace.tier }] });
  assert.equal(st.list[0].tier, 0);
  assert.ok(FURNACE.tiers[st.list[1].tier]);
  const b = sanitizeBank({ slots:[], furnaces:{ list:[{ out:{ item:'Diamant', qty:5 } }, { out:{ item:'Lingot de fer', qty:-3 } }] } });
  assert.equal(b.furnaces.list[0].out, null, 'un diamant dans la sortie : refusé');
  assert.equal(b.furnaces.list[1].out, null);
});
