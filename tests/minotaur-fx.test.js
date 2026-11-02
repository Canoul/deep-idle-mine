/* Minotaure à l'écran : Charge et Rage bien visibles (src/render/minotaur.js, MINO_FX en config ; 02/11/2026, Jules) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINO_FX } from '../src/config.js';
import { minoLook, drawMinoAura, drawMinoLabel } from '../src/render/minotaur.js';

/* faux contexte de canvas : retient ce qui est écrit et rempli */
function fakeCtx(){
  const calls = [];
  return { calls, save(){}, restore(){}, strokeText(t){ calls.push(['stroke', t]); }, fillText(t){ calls.push(['text', t]); },
    fillRect(){ calls.push(['rect']); }, createRadialGradient(){ return { addColorStop(){} }; } };
}
const times = Array.from({ length: 200 }, (_, i) => i * 7);

test('sans état : il ne tremble pas, pas d\'aura, pas de bulle', () => {
  for(const fx of [undefined, [], ['stun'], ['exposed']]) assert.deepEqual(minoLook(fx, 1234), { shake: 0, aura: 0, label: null });
});

test('il gratte le sol : bulle « CHARGE ! » et tremblement de ±shake pixels', () => {
  const shakes = times.map(t => minoLook(['charge'], t).shake);
  assert.ok(shakes.every(s => Math.abs(s) <= MINO_FX.shake));
  assert.ok(shakes.includes(MINO_FX.shake) && shakes.includes(-MINO_FX.shake), 'il tremble vraiment, des deux côtés');
  assert.equal(minoLook(['charge'], 0).label, MINO_FX.chargeLabel);
  const ctx = fakeCtx();
  drawMinoLabel(ctx, minoLook(['charge'], 0), 8, 0);
  assert.deepEqual(ctx.calls.filter(c => c[0] === 'text'), [['text', 'CHARGE !']]);
});

test('enragé : une aura rouge qui pulse, sans bulle', () => {
  const auras = times.map(t => minoLook(['rage'], t).aura);
  assert.ok(auras.every(a => a >= MINO_FX.auraMin - 1e-9 && a <= MINO_FX.auraMax + 1e-9));
  assert.ok(Math.max(...auras) - Math.min(...auras) > 0.2, 'elle pulse');
  assert.equal(minoLook(['rage'], 0).label, null);
  const ctx = fakeCtx();
  drawMinoAura(ctx, minoLook(['rage'], 0), 0, 0, 16);
  assert.equal(ctx.calls.length, 1, 'aura dessinée');
  const none = fakeCtx();
  drawMinoAura(none, minoLook([], 0), 0, 0, 16); drawMinoLabel(none, minoLook([], 0), 8, 0);
  assert.equal(none.calls.length, 0, 'rien sans état');
});

test('enragé ET en train de gratter le sol : les deux', () => {
  const l = minoLook(['charge', 'rage'], 0);
  assert.equal(l.label, MINO_FX.chargeLabel); assert.ok(l.aura > 0);
});
