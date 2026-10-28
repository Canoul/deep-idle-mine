/* DPS brut de l'onglet Stuff (28/10/2026) : cible immobile, sans recul. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS, DEV_PRESETS } from '../src/config.js';
import { rawDps, equippedStats, minerStats } from '../src/meta/stuff.js';
import { statsHTML } from '../src/ui/stuff.js';

test('formule : dégâts × (1 + dégâts %) × (1 + critique) × (1 + double attaque) × vitesse ÷ 0,8 s', () => {
  assert.equal(rawDps(STATS), 6.25, 'sans stuff : 5 dégâts toutes les 0,8 s');
  assert.equal(rawDps({ damage: 10, attackSpeed: 200 }), 25);
  assert.ok(Math.abs(rawDps({ damage: 10, attackSpeed: 100, crit: 50, doubleAttack: 20, damagePct: 10 }) - 10 * 1.1 * 1.5 * 1.2 / 0.8) < 1e-9);
  assert.equal(rawDps({ damage: 10, attackSpeed: 100, crit: 150 }), 25, 'critique plafonné à 100 %');
  assert.ok(Math.abs(rawDps(equippedStats(DEV_PRESETS.gear)) - 23.125) < 1e-9, 'preset acier : 18,5 dégâts');
});

test('onglet Stuff : une ligne DPS sous le gear score, avec les totaux affichés (skills compris)', () => {
  const worn = { epee: { item: 'Épée en fer' } };
  const html = statsHTML(worn, {});
  assert.match(html, /<b>DPS<\/b>.*?<b>17,5<\/b>/s);
  assert.ok(html.indexOf('Gear score') < html.indexOf('DPS'));
  const total = Object.fromEntries(minerStats(worn, {}).map(s => [s.key, s.total]));
  assert.equal(rawDps(total), 17.5);
});

/* 28/10/2026 (Geoffrey) : les skills de comportement (Navette, Treuil…) ne sont plus listés sous les stats */
test('onglet Stuff : pas de bloc « Skills en partie » sous les stats', async () => {
  const { skillEffects, sanitizeSkills } = await import('../src/meta/skills.js');
  const log = skillEffects(sanitizeSkills({ tree:'logisticien', ranks:{ travel_rush:3, tall_ladder:1, winch:1, winch_speed:2 } }));
  const html = statsHTML({}, log);
  assert.doesNotMatch(html, /Skills en partie|Treuil|Navette/);
  assert.match(html, /Gear score/);
});
