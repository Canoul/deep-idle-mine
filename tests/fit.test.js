// Taille d'affichage de la mine et des événements (src/ui/fit.js) : sur téléphone, rien ne doit rétrécir en boucle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitMine, fitInstant, fitCanvas } from '../src/ui/fit.js';

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

/* événements : canvas libre (cw × ch). follows : la boîte prend la hauteur du canvas affiché (canvas dans le flux) */
function event({ width, cw, ch, follows, boxH = 500, dpr = 2.625 }){
  globalThis.devicePixelRatio = dpr;
  const cv = { width: cw, height: ch, style: {}, _pos: follows ? 'static' : 'absolute' };
  globalThis.getComputedStyle = el => ({ position: el._pos });
  const shown = () => parseInt(cv.style.height) || cv.height;
  const box = { clientWidth: width, get clientHeight(){ return follows ? shown() : boxH; } };
  const renderer = { rows: ch / TILE, setRows(n){ n = Math.max(10, Math.min(60, n)); this.rows = n; cv.height = n * TILE; } };
  return { cv, box, renderer };
}

test('tours / instance / géant : boîte qui suit le canvas → taille stable, calée sur la largeur', () => {
  for(const [cw, ch] of [[240, 640], [480, 320], [640, 400]]) for(let width = 300; width <= 440; width += 11){
    const { cv, box } = event({ width, cw, ch, follows: true });
    const seen = new Set();
    for(let i = 0; i < 40; i++){ fitCanvas(cv, box); if(i) seen.add(cv.style.width + 'x' + cv.style.height); }
    assert.equal(seen.size, 1, `${cw}×${ch}, largeur ${width}`);
    assert.ok(parseInt(cv.style.width) <= width && parseInt(cv.style.width) >= width * 0.8, `${cw}×${ch}, largeur ${width}`);
  }
});

test('tours / instance / géant : hauteur imposée → tout le canvas tient dans la boîte, stable', () => {
  const { cv, box } = event({ width: 381, cw: 240, ch: 640, follows: false, boxH: 300 });
  const seen = new Set();
  for(let i = 0; i < 20; i++){ fitCanvas(cv, box); seen.add(cv.style.width + 'x' + cv.style.height); }
  assert.equal(seen.size, 1);
  assert.ok(parseInt(cv.style.height) <= 300);
});

test('mine instantanée : boîte qui suit le canvas → lignes et taille stables', () => {
  for(let width = 300; width <= 440; width += 11){
    const { cv, box, renderer } = event({ width, cw: 24 * TILE, ch: 30 * TILE, follows: true });
    const seen = new Set();
    for(let i = 0; i < 40; i++){ fitInstant(cv, box, renderer, TILE); if(i) seen.add(cv.style.width + 'x' + cv.style.height); }
    assert.equal(renderer.rows, 30, `largeur ${width}`);
    assert.equal(seen.size, 1, `largeur ${width}`);
  }
});

test('mine instantanée : hauteur imposée → autant de lignes que la place en permet, stable', () => {
  const { cv, box, renderer } = event({ width: 381, cw: 24 * TILE, ch: 30 * TILE, follows: false, boxH: 400 });
  const seen = new Set();
  for(let i = 0; i < 20; i++){ fitInstant(cv, box, renderer, TILE); seen.add(cv.style.width + 'x' + cv.style.height + '/' + renderer.rows); }
  assert.equal(seen.size, 1);
  assert.ok(parseInt(cv.style.height) <= 400);
});
