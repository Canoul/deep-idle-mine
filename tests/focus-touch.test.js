/* Téléphone : ouvrir le four ou le concasseur n'ouvre pas le clavier ; sur ordinateur, le curseur reste dans le champ. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { focusUnlessTouch } from '../src/ui/focus.js';

function focused(touch){
  globalThis.matchMedia = q => ({ matches: q === '(hover: none)' && touch });
  let n = 0;
  focusUnlessTouch({ focus(){ n++; } });
  delete globalThis.matchMedia;
  return n;
}

test('écran tactile : pas de focus ; ordinateur : focus', () => {
  assert.equal(focused(true), 0);
  assert.equal(focused(false), 1);
});

test('four et concasseur passent par cette règle : aucun focus direct', () => {
  for(const f of ['furnace', 'crusher']){
    const src = fs.readFileSync(new URL(`../src/ui/${f}.js`, import.meta.url), 'utf8');
    assert.ok(!/\.focus\(\)/.test(src), f);
    assert.ok(src.includes('focusUnlessTouch(qty)'), f);
  }
});
