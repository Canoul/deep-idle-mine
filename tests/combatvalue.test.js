/* xc, la valeur de combat (06/11/2026, Geoffrey) : 1 xc = +1 % de DPS sur le mineur de référence du tier */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS, CFG, UPGRADE } from '../src/config.js';
import { dps, refStats, pieceXC } from '../src/meta/combatvalue.js';
import { pieceGS } from '../src/meta/gearscore.js';
import { itemValue } from '../src/meta/piece.js';

test('DPS du mineur de base : 5 dégâts toutes les 0,8 s', () => {
  assert.equal(dps(STATS), STATS.damage / CFG.attackInterval);
  assert.ok(Math.abs(dps({ ...STATS, crit: 50 }) - dps(STATS) * 1.5) < 1e-9, 'critique : × 2 une fois sur deux');
  assert.ok(Math.abs(dps({ ...STATS, doubleAttack: 20 }) - dps(STATS) * 1.2) < 1e-9);
});

test('une arme se mesure aux mains nues : Épée en pierre 8 au lieu de 5 = +60 %', () => {
  assert.equal(pieceXC('Épée en pierre'), 60);
  assert.equal(refStats(3).damage, 18.5); assert.equal(refStats(3, { bare: true }).damage, STATS.damage);
});

test('un % vaut le même xc à tous les tiers (pièce sans arme)', () => {
  const crit = t => pieceXC({ item: 'Capuche sombre' }, { tier: t });
  assert.equal(crit(1), crit(4), 'critique 4,8 % = +4,8 % de DPS partout');
  assert.equal(pieceXC('Pioche en fer'), 0, 'rien d\'offensif : 0 xc');
});

test('le xc ne change ni le x ni le GS', () => {
  assert.equal(itemValue('Épée en fer'), (14 - STATS.damage) * UPGRADE.worth.damage);
  assert.ok(pieceGS('Épée en fer') > 0);
});
