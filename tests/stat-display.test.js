/* Chiffres affichés des stats (30/10/2026) : pas de virgule quand elle ne sert à rien (oxygène, pods, torches), mais les
   boosts qui se lisent au dixième ou au millième restent (vitesse de minage +0,206, dégâts 14,3, ténacité +16,3 %) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../src/config.js';
import { statNum, statLines, minerStats } from '../src/meta/stuff.js';

test('statNum : entier pour un compte, 1 décimale par défaut, 2 ou 3 pour les vitesses ; torches à l\'inférieur', () => {
  assert.equal(statNum('oxygenMax', 373.89), '374');
  assert.equal(statNum('pods', 408.4), '408');
  assert.equal(statNum('golemOxygen', 25.75), '26');
  assert.equal(statNum('torches', 30.9), '30');          // comme en session (src/sim/mineur.js)
  assert.equal(statNum('damage', 23.575), '23,6');
  assert.equal(statNum('blockMinePct', 25.75), '25,8');
  assert.equal(statNum('tenacity', 15), '15');           // pas de « ,0 »
  assert.equal(statNum('mineSpeed', 0.206), '0,206');
  assert.equal(statNum('speed', 5.7277), '5,73');
});

test('textes des pièces, de +0 à +9 : jamais de virgule sur oxygène, pods, torches ; jamais plus de 3 décimales', () => {
  for(const [name, it] of Object.entries(ITEMS)) if(it.cat === 'stuff') for(let plus = 0; plus <= 9; plus++){
    for(const l of statLines({ item: name, plus })){
      if(/^(Oxygène|Pods|Torches)/.test(l)) assert.doesNotMatch(l, /\d,\d/, `${l} (${name} +${plus})`);
      assert.doesNotMatch(l, /\d,\d{4}/, `${l} (${name} +${plus})`);
    }
  }
  assert.ok(statLines({ item: 'Âme du Golbute', plus: 1 }).some(l => /golem tué .* 26$/.test(l)));
  assert.ok(statLines({ item: 'Pioche en pierre', plus: 1 }).includes('Vitesse de minage +0,206'));   // boost de pioche gardé
});

test('panneau des stats : ceinture améliorée = 30 torches (30,9 arrondi comme en session)', () => {
  const worn = { [ITEMS['Ceinture en peau de gobelin'].slot]: { item: 'Ceinture en peau de gobelin', uid: 1, plus: 3, q: 1 } };
  const t = minerStats(worn, {}).find(s => s.key === 'torches');
  assert.equal(statNum('torches', t.total), '30');
});
