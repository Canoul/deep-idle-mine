/* Annonces Discord (server/social/discord.js) : messages d'un trésor de tour ou d'une identification R7, envoi au
   webhook (faux fetch), et branchements dans le service de jeu (une seule annonce, même rejouée ; jamais bloquante). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANNOUNCE, UPGRADE, JUDGMENT, TOWER, GAME, TREASURE, treasureItem } from '../src/config.js';
import { realDurationMs } from '../src/shared/game.js';
import { createInventory, addItem, serialize } from '../src/meta/inventory.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { treasureMessage, identifyMessage, towerOpenMessage, escapeMarkdown, createDiscordAnnouncer } from '../server/social/discord.js';
import { fakeLive } from './helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const OTHER = { id:'BBBB2222', name:'Max', guest:false };
const PICK = 'Pioche en pierre';
const MIN = ANNOUNCE.minQuality;
/* valeur du hasard qui tire la qualité q (milieu de sa tranche dans UPGRADE.qualities) */
const rndFor = q => { let r = 0; for(const d of UPGRADE.qualities){ if(d.q === q) return r + d.chance / 2; r += d.chance; } };
const flush = () => new Promise(r => setTimeout(r, 10));   // les annonces partent en tâche de fond

/* ---------- messages ---------- */

test("message : trésor de tour R7 (démon ou ange) annoncé ; en dessous, Treasure de la mine, objet inconnu : rien", () => {
  assert.equal(treasureMessage('admin', treasureItem('demon', 7)), '🚨 admin a loot un trésor démoniaque R7 🚨');
  assert.equal(treasureMessage('Zoe', treasureItem('angel', 7)), '🚨 Zoe a loot un trésor angélique R7 🚨');
  assert.equal(treasureMessage('Zoe', treasureItem('demon', MIN - 1)), null);
  assert.equal(treasureMessage('Zoe', TREASURE.tiers.at(-1).item), null, 'un Treasure TX de la mine n\'a pas de qualité');
  for(const item of ['Charbon', 'Objet inconnu', '', undefined, null]) assert.equal(treasureMessage('Zoe', item), null, String(item));
});

test("message : pièce identifiée R7 avec son nom ; en dessous ou sans qualité : rien", () => {
  assert.equal(identifyMessage('Zoe', { item:'Plastron en fer', q:7 }), '🚨 Zoe a identifié Plastron en fer R7 🚨');
  assert.equal(identifyMessage('Zoe', { item:'Plastron en fer', q:MIN - 1 }), null);
  for(const piece of [{ item:PICK }, null, undefined]) assert.equal(identifyMessage('Zoe', piece), null);
});

test("message : la mise en forme Discord d\'un pseudo est neutralisée ; pseudo vide = « Un joueur »", () => {
  assert.equal(escapeMarkdown('*Zo_e*|`x`'), '\\*Zo\\_e\\*\\|\\`x\\`');
  assert.equal(identifyMessage('**Zoe**', { item:PICK, q:7 }), '🚨 \\*\\*Zoe\\*\\* a identifié Pioche en pierre R7 🚨');
  assert.equal(treasureMessage('', treasureItem('demon', 7)), '🚨 Un joueur a loot un trésor démoniaque R7 🚨');
  assert.equal(treasureMessage(undefined, treasureItem('demon', 7)), '🚨 Un joueur a loot un trésor démoniaque R7 🚨');
});

/* ---------- envoi au webhook ---------- */

function fakeFetch(respond = () => ({ ok:true, status:204 })){
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return respond(); };
  return { fetch, calls };
}

test("envoi : POST JSON au webhook, sans aucune mention possible", async () => {
  const { fetch, calls } = fakeFetch();
  await createDiscordAnnouncer({ url:'https://discord.test/hook', fetch })('🚨 @everyone a loot 🚨');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://discord.test/hook');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(calls[0].body, { content:'🚨 @everyone a loot 🚨', allowed_mentions:{ parse:[] } });
});

test("envoi : sans webhook configuré ou sans message, rien n\'est envoyé", async () => {
  const { fetch, calls } = fakeFetch();
  await createDiscordAnnouncer({ url:'', fetch })('🚨 x 🚨');
  await createDiscordAnnouncer({ fetch })('🚨 x 🚨');
  await createDiscordAnnouncer({ url:'https://discord.test/hook', fetch })(null);
  assert.equal(calls.length, 0);
});

test("envoi : Discord en panne ou qui refuse → aucune erreur levée, seulement une ligne de journal", async () => {
  const logs = [];
  const down = createDiscordAnnouncer({ url:'https://discord.test/hook', log: m => logs.push(m), fetch: async () => { throw new Error('réseau'); } });
  await down('🚨 x 🚨');
  const refused = createDiscordAnnouncer({ url:'https://discord.test/hook', log: m => logs.push(m), fetch: async () => ({ ok:false, status:429 }) });
  await refused('🚨 x 🚨');
  assert.equal(logs.length, 2);
  assert.match(logs[0], /réseau/); assert.match(logs[1], /429/);
});

/* ---------- branchements dans le service de jeu ---------- */

/* service avec annonces enregistrées ; random fixé (il décide de la qualité des trésors et des identifications) */
async function setup({ random, summary, announce } = {}){
  let now = 1_000_000;
  const store = createMemoryGameStore();
  const said = [];
  const inv = createInventory(); addItem(inv, PICK, 3);
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  const game = createGameService({ store, liveRunner: fakeLive(summary ?? (() => ({ shares: [] }))), clock: () => now, dev:false,
    randomSeed: () => 4242, random, announce: announce ?? (t => { said.push(t); }),
    config:{ startsPerHour:1000, keepEnded:1e12, maxLive:5 } });
  const uids = inv.slots.filter(s => s?.item === PICK).map(s => s.uid);
  return { game, store, said, uids, advance: ms => { now += ms; } };
}

/* une mine qui remplit la jauge de l'Ange (la tour ouvre), puis une tour réussie à deux */
const towerSummary = rec => rec.mode === 'tower_angel'
  ? { id: rec.id, success: true, shares: rec.players.map(p => ({ account: p.account, left: false, bag: {} })) }
  : { id: rec.id, chest: {}, shares: rec.players.map(p => ({ account: p.account, left: false, bag: { [JUDGMENT.sides.angel.item]: JUDGMENT.cap } })) };
const duo = [{ account: ME.id, name: 'Zoe' }, { account: OTHER.id, name: 'Max' }];
async function winTower(t){
  await t.game.start(ME, {}); t.advance(realDurationMs()); await t.game.pump();
  await t.game.start(ME, { mode: 'tower_angel' }, duo);
  t.advance(TOWER.duration / GAME.speed * 1000); await t.game.pump(); await flush();
}

test("tour réussie avec un trésor R7 : une annonce par joueur, avec son pseudo ; fin rejouée : pas de nouvelle annonce", async () => {
  const t = await setup({ random: () => rndFor(7), summary: towerSummary });
  await winTower(t);
  assert.deepEqual(t.said.sort(), [towerOpenMessage('angel'), '🚨 Max a loot un trésor angélique R7 🚨', '🚨 Zoe a loot un trésor angélique R7 🚨']);
  await t.game.recover(); await t.game.pump(); await flush();
  assert.equal(t.said.length, 3, 'redémarrage : rien n\'est annoncé deux fois');
});

test("tour réussie avec un trésor sous R7 : aucune annonce", async () => {
  const t = await setup({ random: () => rndFor(MIN - 1), summary: towerSummary });
  await winTower(t);
  assert.ok((await t.game.state(ME)).inventory.slots.some(s => s?.item === treasureItem('angel', MIN - 1)), 'le trésor est bien versé');
  assert.deepEqual(t.said, [towerOpenMessage('angel')], "seulement l'ouverture de la tour");
});

test("Discord en panne (announce qui lève) : la tour est quand même versée", async () => {
  const t = await setup({ random: () => rndFor(7), summary: towerSummary, announce: () => { throw new Error('panne'); } });
  const logged = console.error; console.error = () => {};
  try { await winTower(t); } finally { console.error = logged; }
  assert.ok((await t.game.state(ME)).inventory.slots.some(s => s?.item === treasureItem('angel', 7)));
});

test("identification R7 : annoncée avec le pseudo et le nom de la pièce ; double clic (même demande) : une seule annonce", async () => {
  const t = await setup({ random: () => rndFor(7) });
  const [a, b, c] = t.uids;
  const op = { action:'identify', uid:a, sacrifice:b, opId:'op-identify-r7' };
  await Promise.all([t.game.upgrade(ME, op), t.game.upgrade(ME, { ...op, sacrifice:c })]);
  await t.game.upgrade(ME, op); await flush();
  assert.deepEqual(t.said, [`🚨 Zoe a identifié ${PICK} R7 🚨`]);
});

test("identification sous R7, don admin d\'une pièce R7 : aucune annonce", async () => {
  const t = await setup({ random: () => rndFor(MIN - 1) });
  const [a, b] = t.uids;
  const r = await t.game.upgrade(ME, { action:'identify', uid:a, sacrifice:b, opId:'op-identify-r6' });
  assert.equal(r.piece.q, MIN - 1);
  await t.game.adminGive(ME.id, PICK, 1, 7); await flush();
  assert.deepEqual(t.said, []);
});

/* ---------- ouverture d'une tour du Jugement (26/10) ---------- */

test("message d'ouverture : nom de la tour et durée ; camp inconnu : rien", () => {
  assert.equal(towerOpenMessage('demon'), `🚨 La Tour du Démon est ouverte pendant ${JUDGMENT.openHours} h ! 🚨`);
  assert.equal(towerOpenMessage('angel'), `🚨 La Tour de l'Ange est ouverte pendant ${JUDGMENT.openHours} h ! 🚨`);
  for(const s of ['diable', '', undefined, 'constructor', '__proto__']) assert.equal(towerOpenMessage(s), null, String(s));
});

test("tour ouverte par les résidus d'une mine : une annonce ; relectures et redémarrage : pas de nouvelle annonce", async () => {
  const t = await setup({ summary: towerSummary });
  await t.game.start(ME, {}); t.advance(realDurationMs()); await t.game.pump(); await flush();
  assert.deepEqual(t.said, [towerOpenMessage('angel')]);
  await t.game.judgment(ME); await t.game.recover(); await t.game.pump(); await t.game.judgment(ME); await flush();
  assert.equal(t.said.length, 1);
});

test("tour ouverte par l'admin (jauge pleine) : annoncée ; jauge réglée sans la remplir : rien", async () => {
  const t = await setup();
  await t.game.adminJudgment('demon', JUDGMENT.cap - 1); await flush();
  assert.deepEqual(t.said, []);
  await t.game.adminJudgment('demon', JUDGMENT.cap); await flush();
  assert.deepEqual(t.said, [towerOpenMessage('demon')]);
});

test("réouverture automatique : jauge pleine pendant l'ouverture, la tour rouvre à la fin et c'est annoncé", async () => {
  const t = await setup();
  await t.game.adminJudgment('demon', JUDGMENT.cap);
  await t.game.adminJudgment('demon', JUDGMENT.cap); await flush();   // pleine pendant l'ouverture : pas encore
  assert.equal(t.said.length, 1);
  t.advance(JUDGMENT.openHours * 3600e3); await t.game.judgment(ME); await flush();
  assert.deepEqual(t.said, [towerOpenMessage('demon'), towerOpenMessage('demon')]);
});
