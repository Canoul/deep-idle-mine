/* Contenu de la prison d'après les 10 dernières mines (29/10/2026, Geoffrey ; src/meta/prison-profile.js) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisonProfile, lastMines, sanitizeProfile, pickShare } from '../src/meta/prison-profile.js';
import { profileComp } from '../src/sim/world.js';
import { newPrisonRun, tickPrison } from '../src/sim/prison.js';
import { PRISON, AREAS } from '../src/config.js';

const A = 'AAAA1111';
const mine = (i, { areas = 6, bag = {}, killsBy, left = false, mode = 'mine', dev = false } = {}) => ({
  id: 's' + i, mode, dev, status: 'done', startedAt: i * 1000, endedAt: i * 1000 + 500, players: [{ account: A }],
  result: { areasUnlocked: areas, shares: [{ account: A, left, bag }], miners: [{ account: A, stats: { killsBy } }] } });

test('profil : 10 dernières mines classiques où le joueur était là ; area moyenne ; parts des minerais, treasures, mobs', () => {
  const s = [
    ...Array.from({ length: 12 }, (_, i) => mine(i, { areas: i < 2 ? 1 : 7, bag: { Fer: 60, Or: 40, Pierre: 500, 'Treasure T3': 1 }, killsBy: { gobelin: 3, golem: 1 } })),
    mine(20, { mode: 'mi', areas: 0, bag: { Diamant: 999 } }), mine(21, { left: true, bag: { Diamant: 999 } }), mine(22, { dev: true, bag: { Diamant: 999 } }),
  ];
  assert.equal(lastMines(s, A).length, PRISON.profileSessions);
  const p = prisonProfile(s, A);
  assert.equal(p.n, 10); assert.equal(p.area, 7);                       // les 2 vieilles mines en area 1 sont hors des 10
  assert.deepEqual(p.ores, { iron: 0.6, gold: 0.4 });                    // pierre ignorée ; ni MI, ni partie, ni dev
  assert.deepEqual(p.treasures, { 'Treasure T3': 1 });
  assert.deepEqual(p.mobs, { gobelin: 0.75, golem: 0.25 });
  assert.equal(prisonProfile(s.slice(12), A).n, 0);
  assert.equal(PRISON.fallbackArea, 2);
  assert.equal(prisonProfile([mine(1, { areas: 0 })], A).area, 2, 'une mine en area 0 : pas plus bas que le départ d\'un nouveau joueur');
  assert.equal(prisonProfile([mine(1, { areas: 3 })], A).area, 3);
  assert.deepEqual(prisonProfile([], A), { n: 0, area: PRISON.fallbackArea, ores: null, treasures: null, mobs: null });
  assert.equal(prisonProfile([mine(22, { dev: true, bag: { Fer: 1 } })], A, true).n, 1, 'serveur de dev : les mines dev comptent');
});

test('profil relu : parts revérifiées (clés inconnues, nombres invalides) ; tirage pondéré', () => {
  const p = sanitizeProfile({ n: 3, area: 5, ores: { iron: 1, mud: 5, gold: -1 }, treasures: { 'Treasure T9': 1 }, mobs: { golem: Infinity } });
  assert.deepEqual(p, { n: 3, area: 5, ores: { iron: 1 }, treasures: null, mobs: null });
  assert.equal(sanitizeProfile(null), null);
  assert.equal(pickShare({ a: 0.25, b: 0.75 }, 0.2), 'a'); assert.equal(pickShare({ a: 0.25, b: 0.75 }, 0.3), 'b');
});

test('carte de la prison : même part totale de minerais, répartie selon le profil ; un run se joue avec un profil', () => {
  const comp = { stone: 60, hardstone: 20, iron: 10, gold: 5, air: 5 };
  const out = profileComp(comp, { diamond: 0.5, iron: 0.5 });
  assert.equal(out.iron, 7.5); assert.equal(out.diamond, 7.5); assert.equal(out.gold, undefined);
  assert.equal(out.stone, 60); assert.equal(out.air, 5);
  assert.equal(profileComp(comp, null), comp);
  const profile = { n: 10, area: 6, ores: { iron: 0.7, mithril: 0.3 }, treasures: { 'Treasure T4': 1 }, mobs: { gobelin: 1 } };
  const G = newPrisonRun(7, { areaMax: 6, profile });
  assert.ok(G.areas[0].counts.mithril > 0 && !G.areas[0].counts.graphite, 'mithril du profil, pas de graphite de l\'area 6');
  if(G.areas[0].treasure) assert.equal(G.areas[0].treasure.item, 'Treasure T4');
  for(let i = 0; i < 6000 && !G.over; i++) tickPrison(G);
  assert.ok(G.mobs.every(m => m.type === 'gobelin' || m.trap != null || m.type === 'chair'), 'mobs du profil (hors pièges)');
  assert.ok(AREAS[6]);
});
