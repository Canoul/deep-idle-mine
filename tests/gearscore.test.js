/* Gear score (modulation des tours, 26/10/2026) : GS d'une pièce et du joueur, plafond au lancement d'une tour. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWER, UPGRADE, STATS, ITEMS } from '../src/config.js';
import { pieceGS, gearScore } from '../src/meta/gearscore.js';
import { createInventory } from '../src/meta/inventory.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { modulationState } from '../src/ui/lobby.js';
import { fakeLive } from './helpers.js';

const P = UPGRADE.prices;

test('GS d\'une pièce : stats de l\'objet en x ; une valeur qui remplace la base compte pour ce qu\'elle ajoute', () => {
  const plastron = ITEMS['Plastron en fer'].stats;
  assert.equal(pieceGS('Plastron en fer'), Math.round(Object.entries(plastron).reduce((s, [k, v]) => s + v * (P[k] ?? 0), 0)));
  const epee = ITEMS['Épée en fer'].set.damage;
  assert.equal(pieceGS('Épée en fer'), Math.round((epee - STATS.damage) * P.damage), 'épée : (dégâts − base) × prix');
  assert.equal(pieceGS(null), 0); assert.equal(pieceGS('Objet inconnu'), 0);
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

test('modulation : tour lancée si chacun a moins de 2000 GS ; refusée sinon (avec qui et combien) ; seulement pour une tour', async () => {
  assert.equal(TOWER.modulation.gsMax, 2000);
  const { store, game } = setup();
  await wear(store, ME.id, { torse:'Plastron en fer' });
  await wear(store, B.account, FER);
  assert.ok(gearScore(FER) >= 2000, `stuff en fer : ${gearScore(FER)} GS`);
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
