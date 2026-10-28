/* Mur de chair (28/10/2026, Geoffrey) : mob de 1 × 6 (une colonne) à partir de l'area 6 (2 / 5 / 8 % en areas 6 / 7 / 8+,
   pris sur le gobelin), 200 PV. Il recouvre la roche sans la casser, avance seulement à l'horizontale vers le mineur le
   plus proche ; ses cases sont un mur (ni entrée, ni minage). Passif : −10 % de vitesse d'attaque par stack (un toutes
   les 2 s à 1,5 case, 9 au plus, 10 s après le dernier, perdus hors du rayon, Ténacité par stack). Tacle, ni recul donné
   ni subi. Butin : 1 à 3 Rotten flesh, 1 à 5 chitine ; 40 XP. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, XP, ITEMS, mobHp } from '../src/config.js';
import { tackler } from '../src/sim/ai.js';
import { killMob, stepDir, mineBlock } from '../src/sim/actions.js';
import { trapTable } from '../src/sim/trap.js';
import { inReach } from '../src/sim/knock.js';
import { isAir } from '../src/sim/world.js';
import { search } from '../src/sim/path.js';
import { fleshSpot, fleshAt, syncFlesh, fleshSlow } from '../src/sim/flesh.js';
import { worldFrom, run } from './helpers.js';

const C = MOBS.chair;
/* (x, y) = case du bas ; le mur couvre les lignes y−5 … y */
const wall = (G, o) => { const x = { id: G.mobId++, type: 'chair', hp: 1e9, maxhp: 1e9, cd: 0, h: C.h, speed: MOBS.speed.chair, knockRes: 100, ...o }; G.mobs.push(x); syncFlesh(G); return x; };
const busy = m => { m.action = { type: 'wait', dur: 1e9, t: 0, data: {} }; };
const sum = row => Object.values(row).reduce((s, v) => s + v, 0);
const quiet = G => { G.spawnTimer = Infinity; return G; };   // pas d'autres mobs
/* roche sur 12 lignes, un couloir d'une ligne en ligne 6, le mineur à gauche */
const corridor = () => {
  const rows = ['', 'd'.repeat(50)];
  for(let y = 2; y <= 11; y++) rows.push(y === 6 ? '#@' + ' '.repeat(30) + '#' : '#'.repeat(50));
  return quiet(worldFrom(rows));
};
const MID = 8;   // case du bas d'un mur qui couvre la ligne 6 du couloir (lignes 3 à 8)

test('config : 2 / 5 / 8 % en areas 6 / 7 / 8+ (pris sur le gobelin), 200 PV, 40 XP, 1 × 6, pas dans les pièges', () => {
  const T = MOBS.spawnTable;
  assert.deepEqual(T[5], { gobelin:0.2, occultiste:0.3, mephite:0.2, mimic:0.2, golem:0.1 }, 'area 5 inchangée');
  assert.deepEqual([T[6].chair, T[7].chair, T[8].chair], [0.02, 0.05, 0.08]);
  assert.deepEqual([T[6].gobelin, T[7].gobelin, T[8].gobelin], [0.18, 0.15, 0.12]);
  for(const row of T) assert.ok(Math.abs(sum(row) - 1) < 1e-9, JSON.stringify(row));
  assert.ok(T.slice(0, 6).every(r => !('chair' in r)));
  assert.equal(MOBS.minArea.chair, 6); assert.equal(mobHp('chair', 6), 200);
  assert.equal(XP.mob.chair, 40); assert.equal(C.h, 6); assert.equal(C.maxStacks, 9);
  assert.ok(!('chair' in trapTable(8)));
  assert.equal(ITEMS['Rotten flesh'].cat, 'material');
});

test('naissance : dans la roche, à 8 à 12 colonnes du mineur, sa ligne vers le milieu du mur', () => {
  const G = corridor(), m = G.miners[0]; m.x = 20; m.y = 6;
  const sides = new Set();
  for(let i = 0; i < 200; i++){
    const at = fleshSpot(G, m); assert.ok(at);
    const d = Math.abs(at.x - m.x);
    assert.ok(d >= C.spawnDist.min && d <= C.spawnDist.max, `à ${d}`);
    assert.ok(at.y - C.h + 1 <= m.y && m.y <= at.y, `lignes ${at.y - C.h + 1}..${at.y}, mineur ${m.y}`);
    assert.equal(at.y, m.y + 2, 'le mineur vers le milieu');
    sides.add(Math.sign(at.x - m.x));
  }
  assert.equal(sides.size, 2, 'des deux côtés');
});

test('un mur : ses cases ne sont pas vides, ses blocs ne se minent pas, le chemin ne passe pas', () => {
  const G = corridor(), m = G.miners[0]; busy(m);
  wall(G, { x: 10, y: MID });   // colonne 10, lignes 3 à 8 (la ligne 6 est le vide du couloir)
  for(let y = 3; y <= 8; y++){ assert.ok(!isAir(G, 10, y), `ligne ${y}`); assert.ok(fleshAt(G, 10, y)); }
  assert.ok(isAir(G, 9, 6) && isAir(G, 11, 6));
  m.action = null; m.x = 9; m.y = 6;
  assert.equal(stepDir(G, m, 1, 0), false, 'il ne peut ni y entrer ni le miner');
  const before = G.tiles[5][10];
  mineBlock(G, m, 10, 5);
  assert.equal(G.tiles[5][10], before, 'bloc recouvert intact');
  const r = search(G, m, 9, 6, true, (x, y) => x === 20 && y === 6);
  assert.ok(r, 'on peut le contourner en creusant au-dessus ou en dessous…');
  assert.ok(r.dist[r.n] > 12, '…mais pas passer au travers');
});

test('il avance à l\'horizontale vers le mineur, sans casser la roche, et le tacle au contact', () => {
  const G = corridor(), m = G.miners[0]; busy(m); m.ox = 1e6;
  const o = wall(G, { x: 12, y: MID });   // à 11 colonnes (poursuite : 14 au plus)
  const tiles = G.tiles.map(r => Array.from(r));
  for(let i = 0; i < 600 && !tackler(G, m); i++){ run(G, 1); assert.equal(o.y, MID); }
  assert.equal(tackler(G, m), o, `il l'atteint (mur en ${o.x})`);
  assert.equal(o.x, 2, 'collé au mineur');
  assert.deepEqual(G.tiles.map(r => Array.from(r)), tiles, 'aucun bloc cassé');
});

test('mineur au-dessus du mur : il va jusque sous lui et attend, sans monter', () => {
  const G = corridor(), m = G.miners[0]; busy(m); m.ox = 1e6; m.x = 20; m.y = 2;
  const o = wall(G, { x: 12, y: 11 });   // lignes 6 à 11 : le mineur est 4 lignes au-dessus
  run(G, 600);
  assert.equal(o.y, 11);
  assert.equal(o.x, 20, 'dans la colonne du mineur, sous lui');
});

test('passif : un stack toutes les 2 s à 1,5 case, 9 au plus (−90 %), perdus hors du rayon ; Ténacité', () => {
  const G = corridor(), m = G.miners[0]; busy(m); m.ox = 1e6; m.x = 9; m.y = 6;
  wall(G, { x: 10, y: MID, cd: 1e9 });   // il ne bouge pas
  run(G, 21);
  assert.equal(m.fleshStacks, 1, 'un stack après 2 s');
  run(G, 300);
  assert.equal(m.fleshStacks, 9, 'plafond');
  assert.ok(Math.abs(fleshSlow(m) - 0.1) < 1e-9, '−90 % : il frappe encore');
  m.x = 3; run(G, 1);
  assert.equal(m.fleshStacks, 0, 'hors du rayon : tous perdus');
  assert.equal(fleshSlow(m), 1);
  const G2 = corridor(), t = G2.miners[0]; busy(t); t.ox = 1e6; t.x = 9; t.y = 6; t.carac.tenacity = 100;
  wall(G2, { x: 10, y: MID, cd: 1e9 });
  run(G2, 100);
  assert.equal(t.fleshStacks || 0, 0, 'Ténacité 100 % : aucun stack');
  assert.ok(G2.stats.resisted > 0);
});

test('pas de recul : il ne repousse pas et ne se fait pas repousser', () => {
  const G = corridor(), m = G.miners[0]; busy(m); m.ox = 1e6; m.x = 9; m.y = 6;
  const o = wall(G, { x: 10, y: MID, cd: 1e9 });
  run(G, 50);
  assert.equal(m.x, 9); assert.equal(m.kx || 0, 0);
  assert.ok(inReach(G, m, o));
});

test('vaincu : 1 à 3 Rotten flesh et 1 à 5 chitine, le mur disparaît', () => {
  const counts = { flesh: new Set(), chitin: new Set() };
  for(let s = 1; s <= 60; s++){
    const G = corridor(), m = G.miners[0]; G.rng = (r => () => (r = (r * 16807) % 2147483647) / 2147483647)(s * 7919);
    const o = wall(G, { x: 10, y: MID });
    killMob(G, m, o);
    const f = m.inv['Rotten flesh'], c = m.inv['Chitine'];
    assert.ok(f >= 1 && f <= 3 && c >= 1 && c <= 5, `${f} / ${c}`);
    counts.flesh.add(f); counts.chitin.add(c);
    syncFlesh(G); assert.ok(isAir(G, 10, 6), 'plus de mur');
  }
  assert.equal(counts.flesh.size, 3); assert.equal(counts.chitin.size, 5);
});

test('un mineur qui combat le tue (couloir, IA complète, épée en fer)', () => {
  const G = corridor(), m = G.miners[0]; m.ox = 1e6; m.x = 2; m.y = 6; m.carac.damage = 14;
  const o = wall(G, { x: 14, y: MID, hp: 200, maxhp: 200 });
  run(G, 1500);
  assert.ok(o.hp <= 0, `mur à ${Math.round(o.hp)} PV`);
  assert.ok(!G.flesh?.size, 'plus de mur');
});
