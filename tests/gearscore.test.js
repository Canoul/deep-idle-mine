/* Gear score (modulation des tours, 26/10/2026) : GS d'une pièce et du joueur, plafond au lancement d'une tour. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWER, UPGRADE, STATS, ITEMS } from '../src/config.js';
import { pieceGS, gearScore, statPrice, designPrice, gsPrice } from '../src/meta/gearscore.js';
import { createInventory } from '../src/meta/inventory.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { modulationState } from '../src/ui/lobby.js';
import { fakeLive } from './helpers.js';

/* prix d'une stat dans le GS : mesuré (worth, gs), sans l'ajustement de Geoffrey (28/10/2026) ; stats offensives : tableau des
   lignes (28/10/2026, UPGRADE.gsFromPrices) */
const P = new Proxy({}, { get: (_, k) => gsPrice(k) });

test('GS d\'une pièce : stats de l\'objet en x ; une valeur qui remplace la base compte pour ce qu\'elle ajoute', () => {
  const plastron = ITEMS['Plastron en fer'].stats;
  assert.equal(pieceGS('Plastron en fer'), Math.round(Object.entries(plastron).reduce((s, [k, v]) => s + v * (P[k] ?? 0), 0)));
  const epee = ITEMS['Épée en fer'].set.damage;
  assert.equal(pieceGS('Épée en fer'), Math.round((epee - STATS.damage) * P.damage), 'épée : (dégâts − base) × prix');
  assert.equal(pieceGS(null), 0); assert.equal(pieceGS('Objet inconnu'), 0);
});

test('GS : prix mesurés (worth), complétés par UPGRADE.gs pour les stats simulées le 26/10, sans ajustement (28/10)', () => {
  assert.equal(pieceGS('Pioche en fer'), Math.round(ITEMS['Pioche en fer'].stats.mineSpeed * UPGRADE.worth.mineSpeed), 'pioche en fer : 0,4 × 1 300 = 520 GS');
  for(const k of Object.keys(UPGRADE.gs)) assert.ok(!(k in UPGRADE.worth), `${k} : un seul prix`);
  const lance = ITEMS['Lance en fer'];
  const expect = Object.entries(lance.stats || {}).reduce((s, [k, v]) => s + v * (P[k] ?? 0), 0)
    + Object.entries(lance.set || {}).reduce((s, [k, v]) => s + (v - STATS[k]) * (P[k] ?? 0), 0);
  assert.equal(pieceGS('Lance en fer'), Math.round(expect));
  assert.ok(pieceGS('Lance en fer') < 900, `lance : ${pieceGS('Lance en fer')} GS (portée et recul au prix mesuré, 28/10)`);
  assert.equal(gsPrice('reach'), statPrice('reach')); assert.equal(gsPrice('knockback'), statPrice('knockback'));
});

test('GS des stats offensives (28/10/2026, Geoffrey) : prix du tableau des lignes (runes) ; le dessin des pièces ne change pas', () => {
  assert.deepEqual(UPGRADE.gsFromPrices, ['damage', 'damagePct', 'attackSpeed', 'doubleAttack', 'crit', 'oneTap', 'piercing']);
  for(const k of UPGRADE.gsFromPrices) assert.equal(gsPrice(k), UPGRADE.prices[k], k);
  assert.equal(gsPrice('pods'), statPrice('pods')); assert.equal(gsPrice('knockRes'), statPrice('knockRes'), 'défensive : prix mesuré');
  assert.equal(designPrice('damagePct'), statPrice('damagePct') * UPGRADE.priceAdjust.damagePct, 'dessin : prix mesuré × ajustement');
  /* exemple de Geoffrey : Casque en fer avec une rune de dégâts à 18,4 % du tier, 46 GS le 28/10 ; 31/10 : dégâts % ÷ 3 sur les runes, +3,1 % → 16 GS */
  const base = pieceGS('Casque en fer'), item = 'Casque en fer';
  const r = pieceGS({ item, q:7, rune:{ q:7, s:1, lines:[{ stat:'damagePct', pct:18.4 }] } });
  assert.equal(r - base, 16);
});

test('ajustements de Geoffrey (27/10/2026) : servent à dessiner les pièces, pas au GS (28/10)', () => {
  assert.deepEqual(UPGRADE.priceAdjust, { damage:2, attackSpeed:2, doubleAttack:2, crit:2, reach:2, knockback:2,
    damagePct:3, piercing:4, mineSpeed:3, mineSpeedPct:3, tenacity:2, knockRes:3 });
  assert.equal(statPrice('damage'), 40); assert.equal(designPrice('damage'), 80);
  assert.equal(statPrice('mineSpeed'), 1300); assert.equal(designPrice('mineSpeed'), 3900);
  assert.equal(statPrice('knockRes'), 5, 'pas de mesure : base du tableau des lignes (5)'); assert.equal(designPrice('knockRes'), 15);
  assert.equal(designPrice('pods'), UPGRADE.worth.pods, 'les autres stats : prix mesuré');
  assert.equal(statPrice('reach'), 0, 'portée : mesurée à 0, reste à 0');
});

test('GS : identification, rune et amélioration comptent ; anneau = 0 ; joueur = somme des pièces portées', () => {
  const base = pieceGS('Plastron en fer');
  const ident = pieceGS({ item:'Plastron en fer', q:4, lines:[{ stat:'pods', pct:20 }] });
  const rune = pieceGS({ item:'Plastron en fer', rune:{ item:'Rune', q:3, lines:[{ stat:'oxygenMax', pct:30 }] } });
  const plus = pieceGS({ item:'Plastron en fer', plus:9 });
  assert.ok(ident > base && rune > base && plus > base, `${base} ${ident} ${rune} ${plus}`);
  const ring = Object.keys(ITEMS).find(k => ITEMS[k].cat === 'stuff' && ITEMS[k].slot === 'anneau');
  if(ring) assert.equal(pieceGS(ring), 0);
  const worn = { torse:{ item:'Plastron en fer' }, epee:{ item:'Épée en fer' }, casque:null };
  assert.equal(gearScore(worn), pieceGS('Plastron en fer') + pieceGS('Épée en fer'));
  assert.equal(gearScore({}), 0);
});

/* un joueur qui porte ces pièces (inventaire + stuff écrits dans le store) */
async function wear(store, id, items){
  const inv = createInventory(), worn = {};
  for(const [slot, item] of Object.entries(items)) worn[slot] = { uid: inv.nextUid++, item };
  await store.putInventoryAndStuff(id, inv, { worn, ops: [] });
}
const ME = { id:'AAAA1111', name:'Zoe', guest:false }, B = { account:'BBBB2222', name:'Max' };
function setup(){
  const store = createMemoryGameStore();
  const summary = rec => ({ id: rec.id, mode: 'tower', side: 'angel', success: false,
    shares: rec.players.map(p => ({ account: p.account, left: false, bag: {} })) });
  const game = createGameService({ store, liveRunner: fakeLive(summary), clock: () => Date.UTC(2026, 9, 26, 12), dev: true, randomSeed: () => 1 });
  return { store, game };
}
const FER = { pioche:'Pioche en fer', epee:'Épée en fer', casque:'Casque en fer', torse:'Plastron en fer', jambes:'Jambes en fer', pieds:'Bottes en fer' };
/* au-dessus de 2000 GS (exemple franc : tout en acier) */
const ACIER = { pioche:'Pioche en acier', epee:'Épée en acier', casque:'Casque en acier', torse:'Plastron en acier', jambes:'Jambes en acier', pieds:'Bottes en acier' };

test('modulation : tour lancée si chacun a moins de 2000 GS ; refusée sinon (avec qui et combien) ; seulement pour une tour', async () => {
  assert.equal(TOWER.modulation.gsMax, 2000);
  const { store, game } = setup();
  await wear(store, ME.id, { torse:'Plastron en fer' });
  await wear(store, B.account, ACIER);
  assert.ok(gearScore(ACIER) >= 2000, `stuff en acier : ${gearScore(ACIER)} GS`);
  const team = [{ account: ME.id, name: ME.name }, B];
  await assert.rejects(game.start(ME, { mode:'tower_angel', modulation:true }, team), e => e.code === 'gs_too_high' && /Max a \d+ GS/.test(e.message) && !/Zoe/.test(e.message));
  await assert.rejects(game.start(ME, { modulation:true }), { code:'bad_request' }, 'pas de modulation en mine');
  const { session } = await game.start(ME, { mode:'tower_angel', modulation:true });
  assert.deepEqual(session.modulation, { gsMax: 2000 });
  assert.equal(await game.gsFor(ME.id), pieceGS('Plastron en fer'));
});

test('modulation pas encore ouverte : refusée hors mode dev', async () => {
  assert.equal(TOWER.modulation.open, false);
  const { store } = setup();
  const prod = createGameService({ store, liveRunner: fakeLive(), clock: () => Date.UTC(2026, 9, 26, 12), dev: false, randomSeed: () => 1 });
  await assert.rejects(prod.start(ME, { mode:'mine', modulation:true }), e => e.code === 'bad_request' && /pas encore ouverte/.test(e.message));
});

test('modulation : sans la case, une tour se lance quel que soit le GS', async () => {
  const { store, game } = setup();
  await wear(store, ME.id, FER);
  const { session } = await game.start(ME, { mode:'tower_angel' });
  assert.equal(session.modulation, undefined);
});

test('lobby : case Modulation pour celui qui lance une tour, avec les joueurs au-dessus du plafond', () => {
  const account = { id:'AAAA1111' };
  const slots = [{ kind:'member', me:true, name:'Zoe' }, { kind:'member', name:'Max', gs:2481 }, { kind:'free' }];
  const party = { leader:'AAAA1111', members:[{}, {}] };
  assert.equal(modulationState({ tower:true, locked:false, party, account, slots, myGs:440 }).show, TOWER.modulation.open, 'hors dev : selon open');
  let m = modulationState({ tower:true, locked:false, party, account, slots, myGs:440, dev:true });
  assert.equal(m.show, true); assert.deepEqual(m.over.map(o => o.name), ['Max']); assert.match(m.text, /Max : 2/);
  assert.equal(modulationState({ tower:false, locked:false, party, account, slots, myGs:440 }).show, false);
  assert.equal(modulationState({ tower:true, locked:false, party:{ leader:'ZZZZ', members:[{}, {}] }, account, slots }).show, false, 'membre : pas la case');
});
