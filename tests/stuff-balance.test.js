/* Équilibre du stuff (27/10/2026, Geoffrey ; règle dans STUFF.combatStats / combatOnStuff, src/config.js) :
   - casque, plastron, jambes et bottes en chitine / fer / acier valent en GS la valeur de leur tier (100 / 250 / 400 x) ;
   - le butin des mobs vaut le tier 2, à parts égales entre ses stats ; une stat de combat n'en reçoit que la moitié.
   Ce test échoue si un prix mesuré (UPGRADE.worth, gs) ou une pièce change sans rééquilibrer : c'est voulu. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUFF, UPGRADE, MOB_DROPS } from '../src/config.js';
import { pieceGS } from '../src/meta/gearscore.js';
import { tierOf } from '../src/meta/piece.js';

const ARMOR = ['Casque en', 'Plastron en', 'Jambes en', 'Bottes en'];
const MATERIALS = { chitine: 1, fer: 2, acier: 3 };
const TOL = 0.025;   // arrondi au pas de la stat (un pod = 6 x, un point d'oxygène = 4 x)
const price = k => UPGRADE.worth[k] ?? UPGRADE.gs[k];
const near = (v, want) => Math.abs(v - want) <= TOL * want;

test('armures en chitine, fer et acier : GS = valeur du tier (100 / 250 / 400 x)', () => {
  for(const [mat, tier] of Object.entries(MATERIALS)) for(const p of ARMOR){
    const name = `${p} ${mat}`, want = UPGRADE.tiers[tier].x;
    assert.equal(tierOf(name), tier, `${name} : tier ${tier}`);
    assert.ok(near(pieceGS(name), want), `${name} : ${pieceGS(name)} x au lieu de ${want}`);
  }
});

test('butin des mobs : tier 2, parts égales entre les stats, stat de combat à moitié', () => {
  assert.equal(STUFF.combatOnStuff, 0.5);
  for(const { item } of MOB_DROPS.items){
    const stats = Object.entries(STUFF.items[item].stats), share = UPGRADE.tiers[tierOf(item)].x / stats.length;
    assert.equal(tierOf(item), 2, item);
    for(const [k, v] of stats){
      assert.ok(price(k) > 0, `${item} : ${k} a un prix mesuré`);
      const f = STUFF.combatStats.includes(k) ? STUFF.combatOnStuff : 1;
      /* la stat donne f × (part / prix) : ramenée à l'équation, elle vaut la part */
      assert.ok(near(v * price(k) / f, share), `${item} : ${k} ${v} vaut ${Math.round(v * price(k) / f)} x au lieu de ${share}`);
    }
  }
});

test('stats de combat : toutes connues et avec un prix mesuré', () => {
  for(const k of STUFF.combatStats) assert.ok(k in STUFF.statLabels && price(k) !== undefined, k);
});
