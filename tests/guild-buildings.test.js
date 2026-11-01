/* Bâtiments de guilde (01/11/2026) : dons, construction, journal, bonus du mineur. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { GUILD, ITEMS } from '../src/config.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGuildService } from '../server/guild/service.js';
import { guildBonus, sanitizeGuilds } from '../src/shared/guild.js';
import { sanitizeSkills, skillEffects, withSkillStats } from '../src/meta/skills.js';
import { buildingHTML, logHTML, bonusLabels } from '../src/ui/guild.js';
import { nameKey } from '../src/shared/account.js';
import { minerSpecs } from '../src/shared/game.js';
import { instantSpecs } from '../src/shared/instant.js';
import { STATS } from '../src/config.js';

const acc = (id, name) => ({ id:id.repeat(8), name, guest:false });
const ZOE = acc('A', 'Zoe'), MAX = acc('B', 'Max'), LEA = acc('C', 'Lea');
const ALL = [ZOE, MAX, LEA];
let ops = 0; const op = () => `op-build-${++ops}`;

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
    counts: async (id, items) => Object.fromEntries(items.map(i => [i, stock(id)[i] ?? 0])) });
  return { guild, store, bags };
}
const forge = GUILD.buildings.find(b => b.id === 'forge'), cost = forge.levels[0].cost;
const fullBag = () => ({ ...cost });
async function fill(guild, me){ for(const [item, qty] of Object.entries(cost)) await guild.give(me, { building:'forge', item, qty, opId:op() }); }

test('config : les matériaux existent, chaque bâtiment a sa texture', () => {
  for(const b of GUILD.buildings){
    assert.ok(existsSync(new URL(`../textures/${b.tex}.png`, import.meta.url)), b.tex);
    for(const l of b.levels) for(const item of Object.keys(l.cost)) assert.ok(ITEMS[item], item);
  }
});

test("un don passe de l'inventaire au bâtiment, et le journal le garde", async () => {
  const { guild, bags } = setup({ [ZOE.id]:fullBag() });
  await guild.create(ZOE, 'Les Mineurs');
  const v = await guild.give(ZOE, { building:'forge', item:'Diamant', qty:300, opId:op() });
  const b = v.mine.buildings.find(x => x.id === 'forge');
  assert.equal(b.materials.find(m => m.item === 'Diamant').have, 300);
  assert.equal(bags[ZOE.id].Diamant, cost.Diamant - 300);
  assert.deepEqual(v.mine.log.rows.map(r => [r.name, r.item, r.qty]), [['Zoe', 'Diamant', 300]]);
});

test("don ramené à ce qu'il manque : jamais plus que le coût", async () => {
  const { guild, bags } = setup({ [ZOE.id]:{ Diamant:cost.Diamant + 700 } });
  await guild.create(ZOE, 'Les Mineurs');
  await guild.give(ZOE, { building:'forge', item:'Diamant', qty:cost.Diamant + 700, opId:op() });
  assert.equal(bags[ZOE.id].Diamant, 700);
  await assert.rejects(guild.give(ZOE, { building:'forge', item:'Diamant', qty:1, opId:op() }), e => e.code === 'complete');
  assert.equal(bags[ZOE.id].Diamant, 700);
});

test('construction : chef ou officier, tout réuni ; ensuite le bonus existe', async () => {
  const { guild } = setup({ [ZOE.id]:fullBag() });
  await guild.create(ZOE, 'Les Mineurs');
  const id = (await guild.view(ZOE)).mine.id;
  await guild.invite(ZOE, 'Max'); await guild.acceptInvite(MAX, id);
  await fill(guild, ZOE);
  assert.equal(await guild.bonusOf(ZOE.id), null);
  await assert.rejects(guild.build(MAX, 'forge'), e => e.code === 'forbidden');
  const v = await guild.build(ZOE, 'forge');
  assert.equal(v.mine.buildings.find(b => b.id === 'forge').level, 1);
  assert.deepEqual(await guild.bonusOf(MAX.id), { mult:{ mineSpeed:2 }, add:{} });
  assert.equal((await guild.build(ZOE, 'forge')).mine.buildings.find(b => b.id === 'forge').level, 1);   // double clic
  assert.equal(v.mine.log.rows[0].kind, 'build');
});

test('nouveau membre : bonus tout de suite ; parti : plus de bonus', async () => {
  const { guild } = setup({ [ZOE.id]:fullBag() });
  await guild.create(ZOE, 'Les Mineurs');
  const id = (await guild.view(ZOE)).mine.id;
  await fill(guild, ZOE); await guild.build(ZOE, 'forge');
  await guild.request(LEA, id); await guild.acceptRequest(ZOE, LEA.id);
  assert.ok(await guild.bonusOf(LEA.id));
  await guild.leave(LEA);
  assert.equal(await guild.bonusOf(LEA.id), null);
});

test('journal : sans limite, public, lu par écrans, du plus récent au plus ancien', async () => {
  const n = GUILD.logPage + GUILD.logShow + 5;
  const { guild, store } = setup({ [ZOE.id]:{ Diamant:n } });
  await guild.create(ZOE, 'Les Mineurs');
  for(let i = 0; i < n; i++) await guild.give(ZOE, { building:'forge', item:'Diamant', qty:1, opId:op() });
  const g = (await guild.view(ZOE)).mine, p = await guild.peek(MAX, g.id);
  assert.equal(p.log.rows.length, GUILD.logShow);
  const all = [...p.log.rows]; let next = p.log.next;
  while(next > 0){ const { log } = await guild.log(MAX, g.id, next); all.push(...log.rows); next = log.next; }
  assert.equal(all.length, n);
  assert.ok(all.every((r, i) => !i || r.at < all[i - 1].at));
  await guild.leave(ZOE);                                       // la guilde disparaît, le journal reste en base
  assert.equal((await store.getGuildLog(g.id, 0)).length, GUILD.logPage);
});

test('bonus : passe par les skills figés et change les stats du mineur', () => {
  const skills = sanitizeSkills({ guild:{ mult:{ damage:2, mineSpeed:2 }, add:{ fortune:2 } } });
  const out = withSkillStats({ damage:100, mineSpeed:2, fortune:5, pods:200 }, skillEffects(skills));
  assert.equal(out.damage, 102);
  assert.equal(out.mineSpeed, 2.04);
  assert.equal(out.fortune, 7);
  assert.equal(out.pods, 200);
});

test('bonus : un chiffre trafiqué ne passe pas', () => {
  const s = sanitizeSkills({ guild:{ mult:{ damage:500, pods:50 }, add:{ fortune:'x' } } });
  assert.deepEqual(s.guild, { mult:{ damage:2 }, add:{} });
  assert.equal(sanitizeSkills({}).guild, undefined);
});

test('relecture : bâtiments gardés, quantités ramenées au coût, objet inconnu retiré', () => {
  const m = { id:ZOE.id, rank:'chief', joinedAt:1, rawXp:0 };
  const g = sanitizeGuilds({ guilds:{ a:{ name:'X', members:[m], log:3, ops:['o'],
    buildings:{ forge:{ level:0, given:{ Diamant:999999, Faux:5 } }, armurerie:{ level:99, given:{} }, faux:{ level:1 } } } } }).guilds.a;
  assert.deepEqual(g.buildings.forge.given, { Diamant:cost.Diamant });
  assert.equal(g.buildings.armurerie.level, 1);
  assert.equal(g.buildings.faux, undefined);
  assert.deepEqual(guildBonus(g), { mult:{ damage:2 }, add:{} });
  assert.equal(g.log, 3);
});

test('affichage : texture, bouton Donner, lecture seule, texte échappé', () => {
  const b = { id:'forge', level:0, max:1, ready:false, materials:[{ item:'Diamant', need:5000, have:10 }] };
  assert.match(buildingHTML(b, { owned:{ Diamant:3 } }), /textures\/guild_forge\.png/);
  assert.match(buildingHTML(b, { owned:{ Diamant:3 } }), /data-g="give"/);
  assert.doesNotMatch(buildingHTML(b), /data-g="give"/);
  assert.match(buildingHTML({ ...b, ready:true }, { canBuild:true }), /data-g="build"/);
  assert.doesNotMatch(buildingHTML({ ...b, ready:true }, { canBuild:false }), /data-g="build"/);
  assert.deepEqual(bonusLabels([{ id:'forge', level:1 }, { id:'tresorerie', level:0 }]), ['+2 % de vitesse de minage']);
  const log = { rows:[{ at:1, name:'<b>', kind:'give', building:'forge', item:'Diamant', qty:2 }], next:4 };
  assert.match(logHTML(log), /&lt;b&gt;/);
  assert.match(logHTML(log), /data-g="more"/);
});

test('bonus : lu par une partie et par la mine instantanée, pour ce joueur seulement', () => {
  const guild = { mult:{ damage:2, mineSpeed:2 }, add:{ fortune:2 } };
  const rec = { mode:'mine', players:[{ account:'A', name:'Zoe' }, { account:'B', name:'Max' }], skills:{ A:{ guild } } };
  const [a, b] = minerSpecs(rec);
  assert.ok(Math.abs(a.carac.damage - b.carac.damage * 1.02) < 1e-9);
  assert.ok(Math.abs(a.carac.mineSpeed - b.carac.mineSpeed * 1.02) < 1e-9);
  assert.equal(a.carac.fortune, b.carac.fortune + 2);
  const [c, d] = instantSpecs(rec);
  assert.ok(Math.abs(c.carac.damage - d.carac.damage * 1.02) < 1e-9);
  assert.equal(c.carac.fortune, d.carac.fortune + 2);
  assert.equal(b.carac.damage, STATS.damage);
});

test('coût : Armurerie niveau 1, 500 000 Pierre (01/11/2026, Geoffrey)', () => {
  assert.equal(GUILD.buildings.find(b => b.id === 'armurerie').levels[0].cost['Pierre'], 500000);
});
