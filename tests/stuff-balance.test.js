/* Équilibre du stuff (27/10/2026, Geoffrey ; règle dans STUFF.combatStats / combatOnStuff, src/config.js) :
   - casque, jambes et bottes en chitine / fer / acier valent en GS la valeur de leur tier (100 / 250 / 500 x) ; les
     plastrons sont hors règle (torse volontairement plus fort, décision du 27/10) ;
   - le butin des mobs vaut le tier 2, à parts égales entre ses stats ; une stat de combat n'en reçoit que la moitié.
   Ce test échoue si un prix mesuré (UPGRADE.worth, gs) ou une pièce change sans rééquilibrer : c'est voulu. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUFF, UPGRADE, MOB_DROPS } from '../src/config.js';
import { pieceGS, designPrice } from '../src/meta/gearscore.js';
import { tierOf } from '../src/meta/piece.js';

const ARMOR = ['Casque en', 'Jambes en', 'Bottes en'];   // pas le plastron : torse volontairement plus fort
const MATERIALS = { chitine: 1, fer: 2, acier: 3 };
const TOL = 0.025;   // arrondi au pas de la stat (un pod = 6 x, un point d'oxygène = 4 x)
const price = designPrice;   // prix mesurés × ajustements de Geoffrey (UPGRADE.priceAdjust, 27/10/2026) : valeur de dessin, pas le GS (28/10)
/* hors règle, voulu : Ceinture du Géant à 1,5 dégâts (29/10/2026, Geoffrey ; 28/10 : 5 ; avant 1,6) */
const OFF_RULE = new Set(['Ceinture du Géant', 'Piolet de gobelin', 'Chapeau de naab', 'Épée cassée en carton']);   // 31/10 : valeurs de Geoffrey, voir tests/mob-drops.test.js
const near = (v, want) => Math.abs(v - want) <= TOL * want;

test('casques, jambes et bottes en chitine, fer et acier : GS = valeur du tier (100 / 250 / 500 x)', () => {
  for(const [mat, tier] of Object.entries(MATERIALS)) for(const p of ARMOR){
    const name = `${p} ${mat}`, want = UPGRADE.tiers[tier].x;
    assert.equal(tierOf(name), tier, `${name} : tier ${tier}`);
    assert.ok(near(pieceGS(name), want), `${name} : ${pieceGS(name)} x au lieu de ${want}`);
  }
});

test('butin des mobs : tier 2, parts égales entre les stats (prix ajustés, valeur pleine depuis le 27/10)', () => {
  assert.equal(STUFF.combatOnStuff, 1, 'plus de demi-valeur : remplacée par UPGRADE.priceAdjust (27/10, Geoffrey)');
  for(const { item } of MOB_DROPS.items){
    if(OFF_RULE.has(item)) continue;
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

test('plastrons : hors règle, au-dessus de la valeur de leur tier (torse volontairement plus fort)', () => {
  for(const [mat, tier] of Object.entries(MATERIALS))
    assert.ok(pieceGS(`Plastron en ${mat}`) > UPGRADE.tiers[tier].x, `Plastron en ${mat} : ${pieceGS(`Plastron en ${mat}`)} x`);
});

test('Plastron de l\'équilibre : 2 fois le x de son tier (31/10/2026, Geoffrey)', () => {
  assert.equal(tierOf('Plastron de l\'équilibre'), 3);
  assert.equal(pieceGS('Plastron de l\'équilibre'), 1003);
  assert.ok(Math.abs(pieceGS('Plastron de l\'équilibre') / UPGRADE.tiers[3].x - 2) < 0.01);
});
