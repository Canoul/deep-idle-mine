/* He's coming (navigateur) : menu du lobby, bouton d'entrée, onde du rugissement, onglet Session, textures. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { TEXTURES, HES_COMING as HC } from '../src/config.js';
import { entryState } from '../src/ui/giant.js';
import { roarWave, luciferFrame } from '../src/render/hescoming.js';
import { hesComingApi } from '../src/net/api.js';

test('textures de Lucifer générées et chargées', () => {
  for(const t of ['lucifer', 'lucifer_portal', ...[1, 2, 3, 4, 5, 6].map(i => `lucifer_roar${i}`)]){
    assert.ok(TEXTURES.includes(t));
    assert.ok(existsSync(new URL(`../textures/${t}.png`, import.meta.url)), t);
  }
});

test('bouton d\'entrée : le nom du lieu change, pas la règle', () => {
  assert.equal(entryState({ visit:{}, present:0, max:30 }, 0, 'Lucifer').label, 'Tu es devant Lucifer');
  assert.equal(entryState({ visit:{}, present:0, max:30 }, 0).label, 'Tu es devant le bloc géant');
});

test('page : une carte, une salle et un écran de fin à lui, un bouton de bascule', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for(const id of ['hcCard', 'hcBody', 'hcRun', 'hcDone', 'cvHc', 'cvHcWrap', 'fxBarHc', 'spellBarHc', 'hcMe', 'hcPresent', 'hcDay', 'hcTimer', 'hcTimeBar', 'hcPoints', 'hcLeaveBtn', 'hcDoneBody', 'hcDoneBtn'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('data-pane="hc"'));
});

test('onde du rugissement : grandit, s\'efface, s\'arrête au bord de la zone', () => {
  assert.equal(roarWave(null), null);
  assert.equal(roarWave(9), null);
  const a = roarWave(0.1), b = roarWave(1.4);
  assert.ok(b.reach > a.reach && b.alpha < a.alpha);
  assert.ok(b.reach <= HC.roar.radius + HC.block / 2);
});

test('Lucifer : il lève la main avant le rugissement, la flamme brûle, il la repose', () => {
  const A = HC.anim;
  assert.equal(luciferFrame(null, 20), 'lucifer');                       // avant le premier rugissement, loin
  assert.equal(luciferFrame(10, 20), 'lucifer');
  // la main se lève en 3 images juste avant
  assert.equal(luciferFrame(null, 4 * A.step - 0.01), 'lucifer_roar1');
  assert.equal(luciferFrame(26, 3 * A.step - 0.01), 'lucifer_roar2');
  assert.equal(luciferFrame(26, 2 * A.step - 0.01), 'lucifer_roar3');
  // flamme : avant, pendant et après le rugissement, jusqu'à hold
  for(const f of [luciferFrame(29.9, A.step - 0.01), luciferFrame(0, 30), luciferFrame(A.hold - 0.01, 30 - A.hold)])
    assert.match(f, /^lucifer_roar[456]$/);
  assert.notEqual(luciferFrame(0, 30), luciferFrame(A.flicker + 0.01, 30), 'la flamme vacille');
  // la main redescend, puis repos
  assert.equal(luciferFrame(A.hold + 0.01, 27), 'lucifer_roar3');
  assert.equal(luciferFrame(A.hold + A.step + 0.01, 27), 'lucifer_roar2');
  assert.equal(luciferFrame(A.hold + 2 * A.step + 0.01, 27), 'lucifer_roar1');
  assert.equal(luciferFrame(A.hold + 3 * A.step + 0.01, 27), 'lucifer');
  // sur deux cycles complets : toujours une texture connue
  for(let t = 0; t < 2 * HC.roar.every; t += 0.05){
    const ago = t % HC.roar.every;
    assert.ok(TEXTURES.includes(luciferFrame(t < HC.roar.every ? null : ago, HC.roar.every - ago)), String(t));
  }
});

test('api : ses propres adresses', () => {
  assert.deepEqual(Object.keys(hesComingApi).sort(), ['claim', 'enter', 'info', 'leave', 'view']);
});
