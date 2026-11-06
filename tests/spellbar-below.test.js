import test from 'node:test';
import assert from 'node:assert/strict';
import { spellBarsBelow } from '../src/ui/hud.js';

/* faux DOM minimal : des boîtes (parent) qui contiennent une barre des sorts */
function el(id){
  const e = { id, children:[], parentElement:null, style:{}, cls:new Set(),
    classList:{ toggle:(c, on) => on ? e.cls.add(c) : e.cls.delete(c), contains:c => e.cls.has(c) },
    get previousElementSibling(){ const p = e.parentElement; if(!p) return null; const i = p.children.indexOf(e); return i > 0 ? p.children[i - 1] : null; },
    append(x){ x.remove?.(); x.parentElement = e; e.children.push(x); },
    after(x){ x.remove(); const p = e.parentElement, i = p.children.indexOf(e); x.parentElement = p; p.children.splice(i + 1, 0, x); },
    remove(){ const p = e.parentElement; if(p){ p.children.splice(p.children.indexOf(e), 1); e.parentElement = null; } } };
  return e;
}

test('téléphone (06/11) : les sorts passent sous le jeu, et reviennent dessus quand l\'écran s\'élargit', () => {
  const grid = el('runGrid'), wrap = el('cvWrap'), cv = el('cv'), bar = el('spellBar'), side = el('runR');
  grid.append(wrap); grid.append(side); wrap.append(cv); wrap.append(bar);
  bar.style.bottom = '40px';
  let fire = null;
  const mq = { matches:true, addEventListener:(t, f) => { fire = f; } };
  spellBarsBelow({ querySelectorAll:() => [bar] }, mq);
  assert.equal(bar.parentElement, grid, 'sortie de la boîte du canvas');
  assert.equal(bar.previousElementSibling, wrap, 'juste après le jeu');
  assert.ok(bar.classList.contains('below'));
  assert.equal(bar.style.bottom, '', 'plus de calage par-dessus le canvas');
  mq.matches = false; fire();
  assert.equal(bar.parentElement, wrap, 'écran large : de nouveau sur le jeu');
  assert.ok(!bar.classList.contains('below'));
});
