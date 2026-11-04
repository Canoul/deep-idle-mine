/* Raid Cerbère côté navigateur (04/11/2026) : onglet Raid de la guilde (src/ui/guild.js raidHTML), bandeau du minage et
   bilan (src/ui/raid-hud.js), états Morsure / Durci (src/sim/effects.js), arène vue par le fond (src/ui/backdrop.js modeOf). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { raidHTML, guildTabs } from '../src/ui/guild.js';
import { raidBannerText, raidMinedPct, raidEndHTML } from '../src/ui/raid-hud.js';
import { minerEffects } from '../src/sim/effects.js';
import { effectTip } from '../src/ui/effects.js';
import { RAID, TEXTURES } from '../src/config.js';

const mem = (o = {}) => ({ account:'AAAAAAAA', name:'Zoe', ready:false, leader:false, me:false, playing:false, ...o });
const raid = (o = {}) => ({ max:RAID.maxPlayers, members:[], leader:null, size:0, mine:false, isLeader:false, launching:false, waiting:[], canLaunch:false, running:null, ...o });

test('onglet Raid : seulement avec une guilde', () => {
  assert.ok(!guildTabs({ mine:null }).some(t => t.id === 'raid'));
  assert.ok(guildTabs({ mine:{ name:'x' } }).some(t => t.id === 'raid'));
});

test('lobby vide : explication et bouton Rejoindre', () => {
  const h = raidHTML(raid());
  assert.match(h, /Cerbère/); assert.match(h, new RegExp(`1 à ${RAID.maxPlayers} joueurs`)); assert.match(h, /30 min/);
  assert.match(h, /Morts définitives/); assert.match(h, /pas de récompense/);
  assert.match(h, /data-g="raidJoin"(?! disabled)/);
  assert.match(raidHTML(raid({ size:RAID.maxPlayers })), /data-g="raidJoin" disabled/);
});

test('chef du raid : couronne, Sortir sur les autres, Lancer suit canLaunch, en attente', () => {
  const r = raid({ mine:true, isLeader:true, size:2, members:[mem({ account:'L', name:'Chef', leader:true, me:true, ready:true }), mem({ account:'B', name:'<b>x' })], waiting:['<b>x'] });
  const h = raidHTML(r);
  assert.match(h, /Chef du raid/); assert.match(h, /<svg/);                 // couronne
  assert.match(h, /data-g="raidKick" data-id="B"/); assert.ok(!/data-g="raidKick" data-id="L"/.test(h));
  assert.match(h, /data-g="raidLaunch" disabled/); assert.match(h, /En attente : &lt;b&gt;x/);
  assert.ok(!h.includes('<b>x'));
  assert.match(raidHTML({ ...r, canLaunch:true, waiting:[] }), /data-g="raidLaunch">/);
});

test('membre : Prêt bascule, Quitter ; raid en cours : y retourner si on en est', () => {
  const r = raid({ mine:true, size:2, members:[mem({ account:'L', leader:true, ready:true }), mem({ account:'M', me:true })] });
  assert.match(raidHTML(r), /data-g="raidReady" data-on="1">Je suis prêt/);
  assert.match(raidHTML({ ...r, members:[r.members[0], { ...r.members[1], ready:true }] }), /data-on="0">Plus prêt/);
  assert.match(raidHTML(r), /data-g="raidLeave"/);
  const run = { id:'s', startedAt:0, finishAt:10 * 60000, players:['Zoe'], mine:true };
  assert.match(raidHTML(raid({ running:run }), 0), /Raid en cours.*fin dans 10 min.*data-g="raidWatch"/s);
  assert.ok(!/raidWatch/.test(raidHTML(raid({ running:{ ...run, mine:false } }), 0)));
});

test('bandeau : blocs restants, temps, porte', () => {
  assert.match(raidBannerText({ phase:'mine', left:250, total:1000, timeLeft:1500, doorLeft:null }), /250 \/ 1.000 blocs restants \(75 %\) · 25:00 restantes/);
  assert.match(raidBannerText({ phase:'door', left:0, total:1000, timeLeft:1200, doorLeft:4 }), /La grande porte s'ouvre dans 4 s/);
  assert.equal(raidMinedPct({ left:250, total:1000 }), 75);
});

test('bilan : victoire, échec avant la porte, parts de chacun', () => {
  const share = (o = {}) => ({ miner:'A', account:'A', left:false, stats:{ mined:120, bossDmg:3400, bitten:2, stoned:1, freed:3, dead:false }, ...o });
  const rec = s => ({ players:[{ account:'A', name:'Alice' }, { account:'B', name:'Bob' }], result:{ success:false, t:1800, mineT:900, blocksLeft:0, blocksTotal:5000, bossHp:4000, bossMax:15000, deaths:1, shares:[share(), share({ account:'B', miner:'B', stats:{ mined:5, bossDmg:0, bitten:1, stoned:0, freed:0, dead:true } })], ...s } });
  const win = raidEndHTML(rec({ success:true, t:1500, bossHp:0 }), 'A');
  assert.match(win, /victoire/); assert.match(win, /Alice \(toi\)/); assert.match(win, /3.400 dégâts/); assert.match(win, /mordu 2 · durci 1 · libérés 3/);
  assert.match(win, /Bob 💀/);
  assert.match(raidEndHTML(rec({}), 'A'), /Temps écoulé : Cerbère tient toujours \(4.000 \/ 15.000 PV\)/);
  assert.match(raidEndHTML(rec({ bossHp:null, bossMax:null, blocksLeft:800 }), 'A'), /avant la grande porte : 800 \/ 5.000/);
});

test('états : Morsure (affichage), Durci (solidité), Mort au raid ; bulles', () => {
  const G = { t:10, mode:'raid' };
  const ids = m => minerEffects(G, { id:0, skill:{}, carac:{}, action:null, ...m }).map(e => e.id);
  assert.deepEqual(ids({ bitUntil:11 }), ['bitten']);
  assert.deepEqual(ids({ bitUntil:9 }), []);
  assert.deepEqual(ids({ stone:{ hp:30, max:50 } }), ['stone']);
  assert.equal(minerEffects(G, { id:0, skill:{}, carac:{}, stone:{ hp:29.2, max:50 } })[0].value, 30);
  assert.equal(minerEffects(G, { id:0, skill:{}, carac:{}, dead:true })[0].src, 'raid');
  assert.match(effectTip({ id:'dead', src:'raid' }), /Cerbère/);
  assert.match(effectTip({ id:'stone', value:30 }), /dureté 50.*\n.*encore 30/s);
  assert.match(effectTip({ id:'bitten', left:1 }), /les 3 meurent/);
});

test('textures de Cerbère chargées ; le fond dessine l\'arène avec le rendu du raid', async () => {
  assert.ok(TEXTURES.includes('cerbere') && TEXTURES.includes('cerbere_rage'));
  const { modeOf } = await import('../src/ui/backdrop.js').catch(() => ({}));
  if(!modeOf) return;                                       // module navigateur : pas chargé sans DOM
  assert.equal(modeOf({ mode:'raid', phase:'boss' }), 'raid');
  assert.equal(modeOf({ mode:'raid', phase:'mine' }), 'mine');
});

test('vue du minage : la fin du raid (temps écoulé) se voit, même si la mine ne finit pas', async () => {
  const { newRaid, endRaid } = await import('../src/sim/raid/session.js');
  const { createRaidViewer, applyRaidView } = await import('../src/shared/raid-view.js');
  const G = newRaid(7, { miners:[{ name:'A' }] });
  const view = createRaidViewer(G);
  assert.equal(view(null).over, false);
  endRaid(G, false);
  const v = view(null);
  assert.equal(v.over, true); assert.equal(G.mine.over, false);
  assert.equal(applyRaidView(v, null, 0).over, true);
});

test('lobby : 2 groupes, rejoindre un groupe, changer de groupe, le chef déplace', () => {
  const mem = (n, group, o = {}) => ({ account: n, name: n, ready: false, group, leader: false, me: false, playing: false, ...o });
  const base = { max: 10, groups: 2, groupSize: 5, leader: 'A', launching: false, waiting: [], canLaunch: false, running: null };
  const out = raidHTML({ ...base, members: [mem('A', 1, { leader: true }), ...['B', 'C', 'D', 'E', 'F'].map(n => mem(n, 2))], size: 6, mine: false, isLeader: false });
  assert.match(out, /Groupe 1 <span class="mut">1\/5/); assert.match(out, /Groupe 2 <span class="mut">5\/5/);
  assert.match(out, /data-g="raidJoin" data-group="1">/); assert.match(out, /data-g="raidJoin" data-group="2" disabled/);
  const lead = raidHTML({ ...base, members: [mem('A', 1, { leader: true, me: true }), mem('B', 1)], size: 2, mine: true, isLeader: true });
  assert.match(lead, /data-g="raidMove" data-id="B" data-group="2">/, 'le chef déplace B');
  assert.match(lead, /data-g="raidMove" data-group="2">Passer dans ce groupe/);
});

test('lobby : chaque joueur avec son pseudo, son portrait et sa spé', () => {
  const r = { max: 10, groups: 2, groupSize: 5, leader: 'A', launching: false, waiting: [], canLaunch: false, running: null, size: 1, mine: true, isLeader: true,
              members: [{ account: 'A', name: 'Canoul', ready: true, group: 1, leader: true, me: true, playing: false, tree: 'barbare', specLevel: 12, look: { pioche: 'Pioche en fer' }, auras: {} }] };
  const out = raidHTML(r);
  assert.match(out, /<b>Canoul<\/b>/); assert.match(out, /data-raidpic="A"/); assert.match(out, /Barbare \(SP lvl : 12\)/);
});
