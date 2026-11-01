/* He's coming (navigateur) : menu du lobby, bouton d'entrée, onde du rugissement, onglet Session, textures. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { TEXTURES, HES_COMING as HC } from '../src/config.js';
import { entryState } from '../src/ui/giant.js';
import { roarWave } from '../src/render/hescoming.js';
import { hesComingApi } from '../src/net/api.js';

test('textures de Lucifer générées et chargées', () => {
  for(const t of ['lucifer', 'lucifer_portal']){
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

test('api : ses propres adresses', () => {
  assert.deepEqual(Object.keys(hesComingApi).sort(), ['claim', 'enter', 'info', 'leave', 'view']);
});
