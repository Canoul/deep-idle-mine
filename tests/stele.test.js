/* Stèles des tours (30/10/2026, Geoffrey) : Exorcisme (Tour du Démon) et Pacte (Tour de l'Ange).
   Shrines de tour (don, décompte au lancement d'une tour de leur camp), phase 2 dans la tour, trésor béni. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHRINES, TOWER, RUNE, RINGS, ITEMS, JUDGMENT, GAME, treasureItem } from '../src/config.js';
import { createShrines, sanitizeShrines, give, consume, steleFor, setStele, spendStele, publicShrines } from '../src/meta/shrines.js';
import { createInventory, addItem, countOf } from '../src/meta/inventory.js';
import { openTreasure } from '../src/meta/loot.js';
import { itemName } from '../src/meta/piece.js';
import { runTower, newTower, tickTower } from '../src/sim/tower/session.js';
import { shownShrines, shrinesHtml } from '../src/ui/lobby.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { realDurationMs } from '../src/shared/game.js';
import { fakeLive } from './helpers.js';

test('config : Exorcisme = 240 stonebricks angéliques pour la Tour du Démon, Pacte = 240 démoniaques pour la Tour de l\'Ange', () => {
  assert.deepEqual(SHRINES.list.exorcisme.price, { 'Stonebrick angélique': 240 });
  assert.equal(SHRINES.list.exorcisme.tower, 'demon');
  assert.deepEqual(SHRINES.list.pacte.price, { 'Stonebrick démoniaque': 240 });
  assert.equal(SHRINES.list.pacte.tower, 'angel');
  assert.equal(TOWER.stele.crashKnock, 10);
  assert.equal(TOWER.stele.mobs, 5);
  assert.equal(TOWER.stele.mobHp, 1.5);
  assert.equal(TOWER.stele.bossHp, 1.5);
  assert.equal(RUNE.luck.beni.rings, 2);
});

test('stèle : payée comme un shrine, une charge, ni la mine classique ni l\'autre camp ne la comptent', () => {
  const st = createShrines(), inv = createInventory();
  addItem(inv, 'Stonebrick angélique', 300);
  const r = give(st, inv, { shrine: 'exorcisme', item: 'Stonebrick angélique', qty: 300, opId: 'a' });
  assert.equal(r.given, 240); assert.equal(r.activated, true);
  assert.equal(countOf(inv, 'Stonebrick angélique'), 60);
  assert.equal(SHRINES.list.exorcisme.sessions, 1); assert.equal(SHRINES.list.pacte.sessions, 1);
  assert.deepEqual(consume(st), [], 'une mine classique ne la décompte pas');
  assert.equal(st.active.exorcisme, 1);
  assert.equal(steleFor(st, 'angel'), null, 'pas pour la Tour de l\'Ange');
  assert.equal(steleFor(st, 'demon'), 'exorcisme');
});

test('trésor béni : même trésor, nom « béni », chances des anneaux × 2', () => {
  const beni = treasureItem('demon', 5, 'beni');
  assert.equal(beni, 'Trésor démoniaque R5 béni');
  assert.deepEqual(ITEMS[beni].chest, { side: 'demon', q: 5, luck: 'beni' });
  assert.match(itemName(beni), /Trésor démoniaque béni$/);
  /* un tirage qui tombe juste au-delà des chances normales des anneaux : rien d'habitude, un anneau si béni */
  const total = RINGS.drops.demon.reduce((s, r) => s + r.chance, 0);
  const rolls = (v) => () => v;
  const open = item => { const inv = createInventory(); addItem(inv, item, 1); return openTreasure(inv, item, 'op', rolls(total * 1.5)).loot; };
  const ringsIn = loot => Object.keys(loot).filter(k => RINGS.drops.demon.some(r => r.item === k));
  assert.equal(ringsIn(open(treasureItem('demon', 5))).length, 0);
  assert.equal(ringsIn(open(beni)).length, 1);
});

const M = (name, carac, skillTree = null, skills = {}) => ({ name, account: name, carac, skillTree, skills });
const strong = () => [M('A', { mineSpeed: 6, damage: 400 }), M('Logi', { mineSpeed: 6, damage: 400 }, 'logisticien', { winch: 1 }),
                      M('Barb', { mineSpeed: 6, damage: 400 }, 'barbare')];

test('tour avec Exorcisme : le boss tué, l\'Ange s\'écrase (PV × 1,5), 5 Séraphins par étage ; victoire = 2e boss', () => {
  const G = runTower(3, { side: 'demon', level: 1, stele: 'exorcisme', miners: strong() });
  assert.equal(G.phase2, true);
  assert.equal(G.boss.side, 'angel'); assert.equal(G.boss.name, TOWER.sides.angel.boss);
  assert.equal(G.boss.maxhp, TOWER.boss.hp * TOWER.levels[1].hp * TOWER.stele.bossHp);
  const added = G.mobs.filter(o => o.stele);
  assert.equal(added.length, TOWER.stele.mobs * TOWER.stele.floors.length);
  assert.ok(added.every(o => o.side === 'angel' && o.maxhp === TOWER.mobs.hp * TOWER.levels[1].hp * TOWER.stele.mobHp));
  assert.equal(G.summary.success, G.boss.hp <= 0, 'victoire seulement si le 2e boss est mort');
  assert.equal(G.summary.stele, 'exorcisme');
});

test('sans stèle, ou avec la stèle de l\'autre camp : pas de phase 2', () => {
  const G = runTower(3, { side: 'demon', level: 1, miners: strong() });
  assert.equal(G.phase2, false); assert.equal(G.summary.success, true);
  assert.equal(newTower(3, { side: 'demon', stele: 'pacte', miners: strong() }).stele, null);
});

/* ---------- retours du 30/10 (Geoffrey) ---------- */

/* partie jouée jusqu'à l'arrivée du 2e boss ; before(G) : juste avant la mort du 1er */
function toPhase2(miners, before = () => {}){
  const G = newTower(3, { side: 'demon', level: 1, stele: 'exorcisme', miners });
  while(!G.boss.engaged && !G.over) tickTower(G);
  before(G);
  while(!G.phase2 && !G.over) tickTower(G);
  assert.equal(G.phase2, true);
  return G;
}
const untilLanded = G => { while(G.boss.air && !G.over) tickTower(G); };

test('2e boss : la ténacité évite sa projection (100 % : personne ne tombe ; 0 % : tout le toit tombe)', () => {
  const team = t => [M('A', { mineSpeed: 6, damage: 400, tenacity: t }), M('B', { mineSpeed: 6, damage: 400, tenacity: t })];
  for(const [t, stays] of [[100, true], [0, false]]){
    const G = toPhase2(team(t)), on = G.miners.filter(m => m.y === G.roof - 1).length;
    assert.ok(on > 0, 'du monde sur le toit à l\'arrivée du boss');
    untilLanded(G);
    assert.equal(G.miners.some(m => m.knocked || m.y > G.roof - 1), !stays, `ténacité ${t}`);
  }
});

test('2e boss : mêmes règles que le 1er (résistance au recul, attend d\'être engagé, regroupement)', () => {
  const G = toPhase2([M('A', { mineSpeed: 6, damage: 400 }), M('B', { mineSpeed: 6, damage: 400 }), M('C', { mineSpeed: 0.5, damage: 1 })]);
  assert.equal(G.boss.knockRes, TOWER.boss.knockRes);
  assert.equal(G.boss.engaged, false, 'il n\'avance pas avant le premier coup');
  for(const m of G.miners) if(m.y !== G.roof - 1) assert.equal(m.fell, true, `${m.name}, pas sur le toit : il se regroupera`);
});

test('treuil : le logisticien le pose au 2e boss s\'il n\'en avait pas ; un treuil posé est brisé, sans retour', () => {
  const team = () => [M('A', { mineSpeed: 6, damage: 400 }), M('Logi', { mineSpeed: 6, damage: 400 }, 'logisticien', { winch: 1 })];
  const G = toPhase2(team(), g => assert.equal(g.winch, null));
  assert.equal(G.winchBroken, false);
  while(!G.winch && !G.over) tickTower(G);
  assert.ok(G.winch, 'treuil posé pendant la phase 2');
  const H = toPhase2(team(), g => { g.winch = { x: g.x0 - 1, top: g.roof - 1, bottom: g.floor }; });
  assert.equal(H.winch, null); assert.equal(H.winchBroken, true);
  while(!H.over) tickTower(H);
  assert.equal(H.winch, null, 'pas de second treuil');
});

test('activer / désactiver : stèle chargée seulement, gardé après relecture ; désactivée, elle ne compte pas', () => {
  const st = sanitizeShrines({ active: { pacte: 1 } });
  assert.equal(steleFor(st, 'angel'), 'pacte');
  assert.deepEqual(setStele(st, { shrine: 'pacte', on: false }), { ok: true });
  assert.equal(steleFor(st, 'angel'), null);
  const again = sanitizeShrines(JSON.parse(JSON.stringify(st)));
  assert.equal(steleFor(again, 'angel'), null, 'désactivée après relecture');
  assert.equal(again.active.pacte, 1, 'sa charge persiste');
  assert.equal(publicShrines(again).find(s => s.id === 'pacte').on, false);
  setStele(again, { shrine: 'pacte', on: true });
  assert.equal(steleFor(again, 'angel'), 'pacte');
  for(const [b, error] of [[{ shrine: 'abundance', on: true }, 'bad_shrine'], [{ shrine: 'x', on: true }, 'bad_shrine'], [{ shrine: 'pacte', on: 1 }, 'bad_qty'], [{ shrine: 'exorcisme', on: true }, 'not_charged']])
    assert.equal(setStele(again, b).error, error);
  assert.equal(sanitizeShrines({ active: { pacte: 3 } }).active.pacte, 1, 'anciennes stèles à 3 charges : ramenées à 1');
});

test('charge consommée une seule fois par session (fin rejouée)', () => {
  const st = sanitizeShrines({ active: { pacte: 1 }, off: { pacte: true } });
  assert.equal(spendStele(st, 'pacte', 'stele:s1'), true);
  assert.equal(st.active.pacte, undefined); assert.equal(st.off.pacte, undefined);
  st.active.pacte = 1;
  assert.equal(spendStele(st, 'pacte', 'stele:s1'), false, 'rejouée');
  assert.equal(st.active.pacte, 1);
});

test('lobby : stèle du pacte dans la Tour de l\'Ange seulement, exorcisme dans celle du Démon ; aucune en mine', () => {
  const list = publicShrines(createShrines()), ids = o => shownShrines(list, o).map(s => s.id);
  assert.deepEqual(ids({ tower: 'angel' }), ['pacte']);
  assert.deepEqual(ids({ tower: 'demon' }), ['exorcisme']);
  assert.deepEqual(ids({ mine: true }), ['abundance']);
  assert.deepEqual(ids({}), []);
  const on = publicShrines(sanitizeShrines({ active: { pacte: 1 } }))[2];
  assert.match(shrinesHtml([on]), /data-stele-set="pacte" data-on="0"/);
  assert.match(shrinesHtml([{ ...on, on: false }]), /data-on="1"/);
  assert.doesNotMatch(shrinesHtml([on], { leaderName: 'Zoe' }), /data-stele-set/, 'pas le chef : pas de bouton');
});

const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
/* serveur : une mine ouvre la Tour de l'Ange ; tower(win) y joue une partie avec la stèle du chef */
function setupServer(){
  let now = 5_000_000, win = true;
  const store = createMemoryGameStore(), clock = () => now;
  const summary = rec => rec.mode === 'tower_angel'
    ? { id: rec.id, mode: 'tower', side: 'angel', success: win, t: 400, loot: {}, shares: rec.players.map(p => ({ account: p.account, left: false, bag: {} })) }
    : { id: rec.id, shares: rec.players.map(p => ({ account: p.account, left: false, bag: { [JUDGMENT.sides.angel.item]: JUDGMENT.cap }, xp: 0 })) };
  const game = createGameService({ store, liveRunner: fakeLive(summary), clock, randomSeed: () => 7 });
  const party = createPartyService({ game, clock, getAccount: async id => ({ [A.id]: A, [B.id]: B })[id] ?? null });
  const advance = ms => { now += ms; };
  const open = async () => { await game.start(A, {}); advance(realDurationMs()); await game.pump(); };
  const tower = async ok => { win = ok; const { session } = await game.start(A, { mode: 'tower_angel' }); const r = await store.getGameSession(session.id);
    advance(TOWER.duration / GAME.speed * 1000); await game.pump(); return r; };
  return { store, game, party, open, tower, advance };
}

test('serveur : défaite, la charge reste (même chef, tour suivante) ; victoire, elle part et le trésor est béni', async () => {
  const { store, game, open, tower } = setupServer();
  await store.putShrines(A.id, { active: { pacte: 1 } });
  await open();
  const lost = await tower(false);
  assert.equal(lost.stele, 'pacte'); assert.equal(lost.steleOwner, A.id);
  assert.equal(sanitizeShrines(await store.getShrines(A.id)).active.pacte, 1, 'défaite : pas consommée');
  const won = await tower(true);
  assert.equal(won.stele, 'pacte');
  assert.equal(sanitizeShrines(await store.getShrines(A.id)).active.pacte, undefined, 'victoire : consommée');
  const bag = (await store.getGameSession(won.id)).result.shares[0].bag;
  assert.ok(Object.keys(bag).some(k => / béni$/.test(k)), 'trésor béni');
});

test('serveur : stèle désactivée par le chef, tour normale et charge gardée ; un membre ne peut pas la changer', async () => {
  const { store, party, open, tower, game } = setupServer();
  await store.putShrines(A.id, { active: { pacte: 1 } });
  await open();
  const r = await party.steleSet(A, { shrine: 'pacte', on: false });
  assert.equal(r.shrines.find(s => s.id === 'pacte').on, false);
  const rec = await tower(true);
  assert.equal(rec.stele, undefined);
  assert.equal(sanitizeShrines(await store.getShrines(A.id)).active.pacte, 1);
  await assert.rejects(game.steleSet(A.id, { shrine: 'exorcisme', on: true }), { code: 'not_charged' });
  await party.create(A);
  await party.join(B, (await party.state(A)).party.code);
  await assert.rejects(party.steleSet(B, { shrine: 'pacte', on: true }), { code: 'not_leader' });
});
