/* Amélioration : qualité R1 à R7 (identification), lignes de stats en unité x, niveaux +1 à +3, nouvelles stats en
   session (minage et dégâts en %, critique, coup unique, perçage, butin des mobs). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADE, IDS, STATS } from '../src/config.js';
import { mulberry32 } from '../src/core/rng.js';
import { createInventory, addAll, addItem, countOf, serialize, deserialize } from '../src/meta/inventory.js';
import { createStuff, stuffOp, sanitizeStuff, statsOf, statLines, stuffTip, gearOf } from '../src/meta/stuff.js';
import { itemValue, linePoints, lineValue, rollQuality, rollIdentity, pieceBonus, pieceName, pieceColor, sanitizePiece } from '../src/meta/piece.js';
import { identify, upgrade, identifyError, sacrificesFor, nextLevel } from '../src/meta/upgrade.js';
import { minerSpecs } from '../src/shared/game.js';
import { mineBlock, hitDamage, mineDuration } from '../src/sim/actions.js';
import { mineT } from '../src/sim/miner.js';
import { worldFrom } from './helpers.js';

const PICK = 'Pioche en pierre', FEATHER = 'Plume d\'ange', STONE = 'Pierre de pleine lune';
let n = 0; const id = () => 'op-amelio-' + (++n);
const fixed = v => () => v;                                   // « hasard » fixe pour les tests
const seq = vs => { let i = 0; return () => vs[i++ % vs.length]; };
function setup(picks = 2, mats = 0){
  const inv = createInventory(); addItem(inv, PICK, picks);
  if(mats) addAll(inv, { [FEATHER]:mats, [STONE]:mats });
  return { inv, uids: inv.slots.filter(s => s?.item === PICK).map(s => s.uid) };
}

/* ---------- valeur en x et lignes ---------- */

test('valeur des objets en x : pioche en pierre 130, pioche en fer 260, épée en fer 240 (set)', () => {
  assert.equal(itemValue(PICK), 130);
  assert.equal(itemValue('Pioche en fer'), 260);
  assert.equal(itemValue('Épée en fer'), 240);
  assert.equal(itemValue('Inconnu'), 0);
});

test('une ligne = % de la valeur de l\'objet, ÷ prix de la stat, arrondie au pas (au moins un pas)', () => {
  assert.equal(linePoints(PICK, 'mineSpeed', 32), 0.032);   // 130 × 32 % = 41,6 x ÷ 1300
  assert.equal(linePoints(PICK, 'fortune', 32), 1.2);       // 41,6 / 36 = 1,16 → 1,2 %
  assert.equal(linePoints(PICK, 'pods', 32), 7);            // 41,6 / 6 = 6,9 → 7
  assert.equal(linePoints('Gants tactique', 'pods', 1), 1); // presque rien : au moins un pas
});

test('qualité : les chances de la config (somme 100 %), sur 20 000 tirages', () => {
  assert.ok(Math.abs(UPGRADE.qualities.reduce((s, d) => s + d.chance, 0) - 1) < 1e-9);
  const r = mulberry32(7), count = {};
  for(let i = 0; i < 20000; i++){ const q = rollQuality(r); count[q] = (count[q] || 0) + 1; }
  for(const d of UPGRADE.qualities) assert.ok(Math.abs(count[d.q] / 20000 - d.chance) < 0.012, `R${d.q} ${count[d.q] / 20000}`);
});

test('identification : le bon nombre de lignes, valeurs dans la fourchette, Découverte seulement en R6/R7 et une au plus', () => {
  const r = mulberry32(11);
  for(let i = 0; i < 3000; i++){
    const { q, lines } = rollIdentity(PICK, r), d = UPGRADE.qualities.find(x => x.q === q);
    assert.equal(lines.length, d.lines);
    const disc = lines.filter(l => l.stat === 'discoverMax');
    assert.ok(disc.length <= 1 && (disc.length === 0 || q >= 6));
    for(const l of lines.filter(l => l.stat !== 'discoverMax')){
      assert.ok(UPGRADE.pool.includes(l.stat));
      assert.ok(l.pct >= d.min && l.pct <= d.max, `${l.stat} ${l.pct} R${q}`);
      assert.ok(lineValue(PICK, l) >= linePoints(PICK, l.stat, d.min) - 1e-9 && lineValue(PICK, l) <= linePoints(PICK, l.stat, d.max) + 1e-9);
    }
    assert.ok(sanitizePiece({ item:PICK, uid:1, q, lines }).q === q, 'un tirage réel passe toujours la vérification');
  }
});

/* ---------- stats d'une pièce, nom ---------- */

test('pièce : lignes ajoutées aux stats de l\'objet, amélioration = bonus total du palier', () => {
  const p = { item:PICK, uid:1, q:4, lines:[{ stat:'mineSpeed', pct:30 }, { stat:'fortune', pct:33 }] };   // 39 x et 42,9 x
  assert.deepEqual(pieceBonus(p).stats, { mineSpeed:0.13, fortune:1.2 });
  assert.equal(pieceBonus({ item:PICK, uid:1, plus:3 }).stats.mineSpeed, 0.107);        // 0,1 × 1,07
  assert.equal(pieceBonus({ item:'Épée en fer', uid:2, plus:3 }).set.damage, 11.4);    // 5 + 6 × 1,07
  assert.equal(pieceBonus({ item:'Plastron en chitine', uid:3, plus:1 }).stats.pods, 26);   // 25 × 1,03 = 25,75 → 26
  assert.deepEqual(pieceBonus(PICK).stats, { mineSpeed:0.1 }, 'un simple nom d\'objet : comme avant');
  assert.equal(statsOf([p]).mineSpeed.total, 1.13);
  assert.deepEqual(statLines(p), ['Vitesse de minage +0,13', 'Fortune +1,2 %']);
});

test('nom affiché : « Excellent : Pioche en pierre +2 », couleur de la qualité ; non identifiée : le nom seul', () => {
  assert.equal(pieceName({ item:PICK, uid:1, q:4, lines:[], plus:2 }), 'Excellent : Pioche en pierre +2');
  assert.equal(pieceColor({ item:PICK, uid:1, q:4 }), '#FF00FF');
  assert.equal(pieceName({ item:PICK, uid:1 }), PICK);
  assert.equal(pieceColor({ item:PICK, uid:1 }), null);
  assert.ok(stuffTip({ item:PICK, uid:1, q:7, lines:[{ stat:'crit', pct:40 }] }).startsWith('Légendaire : Pioche en pierre\n'));
});

/* ---------- identifier ---------- */

test('identifier : le sacrifice disparaît, la pièce garde son uid et reçoit qualité et lignes', () => {
  const { inv, uids:[a, b] } = setup(2);
  const r = identify(inv, { uid:a, sacrifice:b, opId:id() }, fixed(0.5));
  assert.equal(r.ok, true);
  assert.equal(countOf(inv, PICK), 1);
  const p = inv.slots.find(s => s?.uid === a);
  assert.ok(p.q >= 1 && p.lines.length >= 1);
  assert.equal(inv.slots.some(s => s?.uid === b), false);
});

test('identifier : refusé sans second exemplaire, avec un autre objet, deux fois, ou sur une pièce portée', () => {
  const { inv, uids:[a, b, c] } = setup(3);
  addItem(inv, 'Pioche en fer', 1);
  const iron = inv.slots.find(s => s?.item === 'Pioche en fer').uid;
  assert.equal(identifyError(inv, a, a), 'same_piece');
  assert.equal(identifyError(inv, a, iron), 'not_same_item');
  assert.equal(identifyError(inv, a, 999), 'not_owned');
  identify(inv, { uid:a, sacrifice:b, opId:id() }, fixed(0.1));
  assert.equal(identify(inv, { uid:a, sacrifice:c, opId:id() }, fixed(0.1)).error, 'already_identified', 'définitive');
  const st = createStuff();
  stuffOp(inv, st, { action:'equip', slot:'pioche', uid:c, opId:id() });
  assert.equal(identifyError(inv, c, a), 'not_owned', 'une pièce portée ne s\'identifie pas');
  assert.equal(identifyError(inv, a, c), 'not_owned', 'une pièce portée ne se sacrifie pas');
});

test('identifier : le sacrifice peut être identifié ou amélioré, peu importe', () => {
  const { inv, uids:[a, b, c] } = setup(3);
  identify(inv, { uid:b, sacrifice:c, opId:id() }, fixed(0.99));
  assert.deepEqual(sacrificesFor(inv, inv.slots.find(s => s?.uid === a)).map(s => s.uid), [b]);
  assert.equal(identify(inv, { uid:a, sacrifice:b, opId:id() }, fixed(0.2)).ok, true);
});

test('identifier : une demande renvoyée ne tire pas une seconde fois et ne sacrifie rien de plus', () => {
  const { inv, uids:[a, b, c] } = setup(3), op = { uid:a, sacrifice:b, opId:id() };
  const first = identify(inv, op, mulberry32(3)), q = first.piece.q, lines = JSON.stringify(first.piece.lines);
  const again = identify(inv, { ...op, sacrifice:c }, mulberry32(99));
  assert.equal(again.repeated, true);
  assert.equal(again.piece.q, q); assert.equal(JSON.stringify(again.piece.lines), lines);
  assert.equal(countOf(inv, PICK), 2);
});

/* ---------- améliorer ---------- */

test('améliorer : coût du palier, +1 à +3, puis maximum', () => {
  const { inv, uids:[a] } = setup(1, 15);
  for(const lv of [1, 2, 3]){
    const r = upgrade(inv, { uid:a, opId:id() }, fixed(0));
    assert.equal(r.success, true); assert.equal(r.piece.plus, lv);
  }
  assert.equal(countOf(inv, FEATHER), 0); assert.equal(countOf(inv, STONE), 0);   // 3 + 5 + 7
  assert.equal(nextLevel(inv.slots.find(s => s?.uid === a)), null);
  assert.equal(upgrade(inv, { uid:a, opId:id() }, fixed(0)).error, 'maxed');
});

test('améliorer : un échec ne coûte que les matériaux ; sans matériaux, refusé sans rien consommer', () => {
  const { inv, uids:[a] } = setup(1, 8);
  upgrade(inv, { uid:a, opId:id() }, fixed(0));                       // +1 (100 %)
  const r = upgrade(inv, { uid:a, opId:id() }, fixed(0.97));          // +2 : 95 % → raté
  assert.equal(r.success, false); assert.equal(r.piece.plus, 1);
  assert.equal(countOf(inv, FEATHER), 0);
  assert.equal(upgrade(inv, { uid:a, opId:id() }, fixed(0)).error, 'not_enough');
  assert.equal(inv.slots.find(s => s?.uid === a).plus, 1);
});

test('améliorer : une demande renvoyée ne consomme pas deux fois et redonne le même résultat', () => {
  const { inv, uids:[a] } = setup(1, 20), op = { uid:a, opId:id() };
  upgrade(inv, op, fixed(0));
  const again = upgrade(inv, op, fixed(0));
  assert.equal(again.repeated, true); assert.equal(again.piece.plus, 1);
  assert.equal(countOf(inv, FEATHER), 17);
});

/* ---------- sauvegarde, stuff, session ---------- */

test('sauvegarde : qualité, lignes et niveau gardés ; équiper puis retirer les garde aussi', () => {
  const { inv, uids:[a, b] } = setup(2, 3);
  identify(inv, { uid:a, sacrifice:b, opId:id() }, fixed(0.5));
  upgrade(inv, { uid:a, opId:id() }, fixed(0));
  const before = JSON.stringify(inv.slots.find(s => s?.uid === a));
  const inv2 = deserialize(serialize(inv));
  assert.deepEqual(inv2.slots.find(s => s?.uid === a), JSON.parse(before));
  const st = createStuff();
  stuffOp(inv2, st, { action:'equip', slot:'pioche', uid:a, opId:id() });
  const st2 = sanitizeStuff(JSON.parse(JSON.stringify(st)), inv2);
  assert.equal(st2.worn.pioche.q, JSON.parse(before).q);
  assert.equal(st2.worn.pioche.plus, 1);
  stuffOp(inv2, st2, { action:'unequip', slot:'pioche', opId:id() });
  assert.deepEqual(inv2.slots.find(s => s?.uid === a), JSON.parse(before));
});

test('session : les caractéristiques viennent des pièces portées (lignes et niveau), pas seulement de leur nom', () => {
  const piece = { item:PICK, uid:5, q:5, lines:[{ stat:'mineSpeedPct', pct:40 }, { stat:'crit', pct:45 }], plus:1 }   // 4 % et 4,5 %;
  const rec = { players:[{ account:'A', name:'Geo' }], looks:{ A:{ pioche:PICK } }, gear:{ A:{ pioche:piece } } };
  const [spec] = minerSpecs(rec);
  assert.equal(spec.carac.mineSpeed, 1.1);                                // 1 + 0,1 × 1,03, arrondi à 2 décimales
  assert.equal(spec.carac.mineSpeedPct, 4.1);                             // 4 × 1,03 = 4,12
  assert.equal(spec.carac.crit, 4.6);                                     // 4,5 × 1,03 = 4,64 → 4,6
  const old = minerSpecs({ players:[{ account:'A', name:'Geo' }], looks:{ A:{ pioche:PICK } } })[0];
  assert.equal(old.carac.mineSpeed, 1.1, 'une session sans gear : les noms suffisent, comme avant');
  assert.equal(old.carac.crit, 0);
  assert.deepEqual(gearOf({ worn:{ pioche:piece, casque:{ item:PICK, uid:6 } } }), { pioche:piece }, 'une pièce dans la mauvaise case est ignorée');
});

/* ---------- anti-triche à la relecture ---------- */

test('rééquilibrage : une ligne garde son %, sa valeur suit la config (la pièce reste valide)', async () => {
  const { UPGRADE:U } = await import('../src/config.js');
  const p = { item:PICK, uid:1, q:1, lines:[{ stat:'fortune', pct:20 }] };
  assert.equal(pieceBonus(p).stats.fortune, 0.7);                       // 26 x / 36
  const old = U.prices.fortune; U.prices.fortune = 13;
  try { assert.equal(pieceBonus(p).stats.fortune, 2); assert.equal(sanitizePiece(p).q, 1); }
  finally { U.prices.fortune = old; }
});

test('relecture : lignes trafiquées → la pièce redevient non identifiée ; niveau impossible → 0', () => {
  const ok = { item:PICK, uid:1, q:1, lines:[{ stat:'mineSpeed', pct:20 }] };
  assert.equal(sanitizePiece(ok).q, 1);
  for(const bad of [
    { ...ok, lines:[{ stat:'mineSpeed', pct:50 }] },                    // au-dessus de la fourchette R1 (10-30)
    { ...ok, lines:[{ stat:'mineSpeed', pct:5 }] },                     // en dessous
    { ...ok, lines:[{ stat:'mineSpeed', pct:-1 }] },
    { ...ok, lines:[{ stat:'mineSpeed', pct:NaN }] },
    { ...ok, lines:[{ stat:'mineSpeed', pct:'20' }] },
    { ...ok, lines:[{ stat:'mineSpeed', v:0.02 }] },                    // valeur au lieu du %
    { ...ok, lines:[{ stat:'light', pct:20 }] },                        // stat hors liste
    { ...ok, lines:[{ stat:'discoverMax' }] },                          // Découverte en R1
    { ...ok, lines:[ok.lines[0], ok.lines[0]] },                       // trop de lignes
    { ...ok, q:8 }, { ...ok, q:'1' }, { ...ok, lines:null },
    { item:PICK, uid:1, q:6, lines:[{ stat:'discoverMax' }, { stat:'discoverMax' }, { stat:'pods', pct:40 }] },
  ]) assert.equal(sanitizePiece(bad).q, undefined, JSON.stringify(bad));
  for(const plus of [4, -1, 1.5, '2', Infinity]) assert.equal(sanitizePiece({ ...ok, plus }).plus, undefined, String(plus));
  assert.equal(sanitizePiece({ item:'Charbon', uid:1 }), null);
  const inv = deserialize(JSON.stringify({ v:1, slots:[{ ...ok, qty:1, lines:[{ stat:'mineSpeed', pct:99 }], plus:9, hack:1 }] }));
  assert.deepEqual(inv.slots[0], { item:PICK, uid:1, qty:1 });
});

/* ---------- nouvelles stats en session ---------- */

test('minage en % : vitesse = (base + fixe) × (1 + %)', () => {
  const G = worldFrom(['', ' @', ' #']), m = G.miners[0];
  const t0 = mineT(G, m, IDS.stone);
  m.carac.mineSpeedPct = 25;
  assert.ok(Math.abs(mineT(G, m, IDS.stone) - t0 / 1.25) < 1e-9);
});

test('dégâts en % et critique (×2), coup unique (durée nulle)', () => {
  const G = worldFrom(['', ' @']), m = G.miners[0];
  assert.equal(hitDamage(G, m), STATS.damage);
  m.carac.damagePct = 20; assert.equal(hitDamage(G, m), STATS.damage * 1.2);
  m.carac.crit = 100; assert.equal(hitDamage(G, m), STATS.damage * 2.4);
  assert.ok(mineDuration(G, m, IDS.stone) > 0);
  m.carac.oneTap = 100; assert.equal(mineDuration(G, m, IDS.stone), 0);
});

test('perçage : le bloc juste derrière casse aussi (butin compris), jamais une barrière ni en chaîne', () => {
  const G = worldFrom(['', '', ' @ccc']), m = G.miners[0];
  m.carac.piercing = 100;
  mineBlock(G, m, 2, 2);
  assert.equal(G.tiles[2][2], 0); assert.equal(G.tiles[2][3], 0); assert.equal(G.tiles[2][4], IDS.coal, 'pas en chaîne');
  assert.equal(m.inv.Charbon, 2);
  const H = worldFrom(['', '', ' @', ' #']), k = H.miners[0];
  k.carac.piercing = 100;
  const below = H.tiles.length;                                    // sous la dernière ligne : rien à percer
  mineBlock(H, k, 1, 3);
  assert.equal(H.tiles[3][1], 0); assert.equal(H.tiles.length, below);
});

test('sans les nouvelles stats, le hasard de la partie ne bouge pas (G.gearRng jamais tiré)', () => {
  const G = worldFrom(['', '', ' @ccc']), m = G.miners[0], probe = G.gearRng;
  let draws = 0; G.gearRng = () => { draws++; return probe(); };
  mineBlock(G, m, 2, 2); hitDamage(G, m); mineDuration(G, m, IDS.stone);
  assert.equal(draws, 0);
});

/* ---------- anti-duplication : suites d'actions au hasard ---------- */

test('identifier + améliorer + équiper : 300 suites au hasard, matière conservée, pièces uniques', () => {
  const r = mulberry32(17);
  for(let t = 0; t < 300; t++){
    const inv = createInventory(); addItem(inv, PICK, 4); addAll(inv, { [FEATHER]:30, [STONE]:30 });
    let st = createStuff(); const ids = [];
    let sacrificed = 0, spent = 0;
    for(let k = 0; k < 20; k++){
      const opId = ids.length && r() < 0.25 ? ids[Math.floor(r() * ids.length)] : `op-${t}-${k}`;
      ids.push(opId);
      const all = inv.slots.filter(s => s?.uid != null).map(s => s.uid);
      const pick = () => r() < 0.85 && all.length ? all[Math.floor(r() * all.length)] : [999, -1, 1.5, '1', null][Math.floor(r() * 5)];
      const a = r();
      if(a < 0.4){ const res = identify(inv, { uid:pick(), sacrifice:pick(), opId }, r); if(res.ok && !res.repeated) sacrificed++; }
      else if(a < 0.75){ const f = countOf(inv, FEATHER); const res = upgrade(inv, { uid:pick(), opId }, r); if(res.ok && !res.repeated) spent += f - countOf(inv, FEATHER); }
      else stuffOp(inv, st, { action: a < 0.9 ? 'equip' : 'unequip', slot:'pioche', uid:pick(), opId });
      if(r() < 0.2){ const inv2 = deserialize(serialize(inv)); st = sanitizeStuff(JSON.parse(JSON.stringify(st)), inv2); Object.assign(inv, inv2); }
    }
    const worn = Object.values(st.worn).filter(Boolean);
    assert.equal(countOf(inv, PICK) + worn.length + sacrificed, 4, `essai ${t} : pioches`);
    assert.equal(countOf(inv, FEATHER) + spent, 30, `essai ${t} : plumes`);
    assert.equal(countOf(inv, FEATHER), countOf(inv, STONE));
    const uids = [...inv.slots.filter(s => s?.uid != null).map(s => s.uid), ...worn.map(p => p.uid)];
    assert.equal(new Set(uids).size, uids.length);
  }
});
