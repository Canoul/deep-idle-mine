// Taille d'affichage de la mine (src/ui/fit.js) : sur téléphone, la mine ne doit pas rétrécir en boucle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitMine } from '../src/ui/fit.js';

const CAM = { minRows: 20, maxRows: 48 }, TILE = 16;

/* faux canvas + boîte. phone : #cv dans le flux, la boîte prend la hauteur du canvas affiché ;
   sinon (#cv en absolu) la boîte a la hauteur boxH, imposée par la page */
function setup({ width, dpr = 2.625, phone, boxH = 600, rows = 34 }){
  globalThis.devicePixelRatio = dpr;
  const cv = { width: 50 * TILE, height: rows * TILE, style: {}, _pos: phone ? 'static' : 'absolute' };
  globalThis.getComputedStyle = el => ({ position: el._pos ?? 'static' });
  const renderer = { setRows(n){ cv.height = n * TILE; }, get rows(){ return cv.height / TILE; } };
  const shown = () => parseInt(cv.style.height) || cv.height;   // hauteur affichée (taille du dessin avant le 1er calage)
  const box = { clientWidth: width, get clientHeight(){ return phone ? shown() : boxH; } };
  return { cv, box, renderer, run(n){ const seen = new Set();
    for(let i = 0; i < n; i++){ fitMine(cv, box, renderer, CAM, TILE); seen.add(cv.style.width + 'x' + cv.style.height); }
    return seen; } };
}

test('téléphone : le nombre de lignes et la taille ne bougent pas d\'un appel à l\'autre', () => {
  for(const dpr of [2, 2.625, 3]) for(let width = 300; width <= 440; width += 7){
    const s = setup({ width, dpr, phone: true });
    s.run(1);
    const after1 = s.cv.style.width + 'x' + s.cv.style.height;
    const seen = s.run(50);
    assert.equal(s.renderer.rows, 34, `dpr ${dpr}, largeur ${width} : lignes`);
    assert.deepEqual([...seen], [after1], `dpr ${dpr}, largeur ${width} : taille`);
  }
});

test('téléphone : la mine remplit la largeur (ou un agrandissement entier proche)', () => {
  const s = setup({ width: 381, dpr: 2.625, phone: true });
  s.run(5);
  const w = parseInt(s.cv.style.width);
  assert.ok(w <= 381 && w >= 381 * 0.8, `largeur ${w}`);
});

test('écran large : la hauteur imposée décide du nombre de lignes, stable', () => {
  const s = setup({ width: 800, dpr: 1, phone: false, boxH: 600 });
  const seen = s.run(20);
  assert.equal(s.renderer.rows, Math.floor(600 / TILE));
  assert.equal(seen.size, 1);
});
