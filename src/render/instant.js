/* Rendu de la mine instantanée : LIT la copie d'affichage (src/shared/instant-view.js), ne la modifie jamais.
   Caméra (22/10) : elle suit le mineur du joueur (à défaut le premier), avec MI.camCols colonnes à l'écran et autant
   de lignes que la place le permet (setRows) ; elle ne sort pas de la mine. Tout est éclairé, mais une case pas
   encore découverte (G.seen) est noire, comme dans la mine normale. */
import { BLOCKS, INSTANT_MINE as MI } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';

export const MI_TILE = 16;
const DARK = '#060608';

/* position affichée d'un mineur : en marche, entre sa case et la suivante selon l'avancée de l'action */
export function instantPos(m){
  const a = m.action;
  if(a?.type === 'move' && a.data && Number.isFinite(a.data.x)){
    const p = Math.min(1, a.dur > 0 ? a.t / a.dur : 1), x0 = m.x + (m.kx || 0), y0 = m.y + (m.ky || 0);
    return [x0 + (a.data.x - x0) * p, y0 + (a.data.y - y0) * p];
  }
  return [m.x + (m.kx || 0), m.y + (m.ky || 0)];   // recul (tours) : décalage dans sa case
}

/* Cadrage (logique pure, testée) : coin haut-gauche (en cases) d'une vue de cols × rows centrée sur (fx, fy), sans
   sortir de la carte (colonnes 0 à w-1 ; lignes -1 = bande de ciel à h). Carte plus petite que la vue : centrée. */
export function miFrame(fx, fy, cols, rows, w, h){
  const fit = (c, n, lo, hi) => n >= hi - lo + 1 ? lo - (n - (hi - lo + 1)) / 2 : Math.max(lo, Math.min(hi + 1 - n, c - n / 2 + 0.5));
  return { x: fit(fx, cols, 0, w - 1), y: fit(fy, rows, -1, h) };
}

export function createInstantRenderer(cv){
  const ctx = cv.getContext('2d'), T = MI_TILE;
  let cols = MI.camCols, rows = MI.camMinRows, cam = null;
  const resize = () => { cv.width = cols * T; cv.height = rows * T; ctx.imageSmoothingEnabled = false; };
  resize();
  const TEX = loadTextures();
  const sprite = createMinerSprite(ctx, TEX, T);
  function blit(name, px, py, fallback){
    const i = TEX[name];
    if(i && i.complete && i.naturalWidth) ctx.drawImage(i, px, py, T, T);
    else if(fallback){ ctx.fillStyle = fallback; ctx.fillRect(px, py, T, T); }
  }

  /* me : ID du compte du joueur (la caméra le suit ; son mineur est entouré et dessiné au-dessus des autres) */
  function draw(G, me){
    const now = performance.now();
    const mine = G.miners.find(m => m.account === me), follow = mine ?? G.miners[0];
    const [fx, fy] = follow ? instantPos(follow) : [G.w / 2, 0];
    const tgt = miFrame(fx, fy, cols, rows, G.w, G.h);
    if(!cam) cam = { ...tgt };
    cam.x += (tgt.x - cam.x) * MI.camEase; cam.y += (tgt.y - cam.y) * MI.camEase;
    if(Math.abs(tgt.x - cam.x) < 0.01) cam.x = tgt.x;
    if(Math.abs(tgt.y - cam.y) < 0.01) cam.y = tgt.y;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = DARK; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.translate(Math.round(-cam.x * T), Math.round(-cam.y * T));
    const x0 = Math.max(0, Math.floor(cam.x)), x1 = Math.min(G.w - 1, Math.ceil(cam.x + cols));
    const y0 = Math.max(-1, Math.floor(cam.y)), y1 = Math.min(G.h, Math.ceil(cam.y + rows));
    for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){
      const px = x * T, py = y * T;
      if(y <= 0){ blit('sky', px, py, '#6cc3ee'); continue; }
      if(!G.seen?.[y]?.[x]){ ctx.fillStyle = DARK; ctx.fillRect(px, py, T, T); continue; }
      const t = G.tiles[y][x];
      if(t === 0) blit('tunnel', px, py, '#2a1f18');
      else blit(BLOCKS[t].tex, px, py, BLOCKS[t].color);
      if(G.ladder?.[y]?.[x] && t === 0) blit('ladder', px, py);
      if(G.feathers.has(y * G.w + x)) blit(MI.heapTex, px, py, '#f4f1ff');
    }
    /* blocs en cours de minage : fissure qui grandit avec l'avancée */
    for(const m of G.miners){
      const a = m.action;
      if(a?.type !== 'mine') continue;
      const p = Math.min(1, a.t / a.dur), px = a.data.x * T, py = a.data.y * T;
      ctx.fillStyle = `rgba(0,0,0,${(0.15 + 0.45 * p).toFixed(2)})`;
      ctx.fillRect(px + T * (1 - p) / 2, py + T * (1 - p) / 2, T * p, T * p);
    }
    for(const m of [...G.miners.filter(x => x !== mine), ...(mine ? [mine] : [])]){
      const [x, y] = instantPos(m);
      if(x < cam.x - 2 || x > cam.x + cols + 1 || y < cam.y - 2 || y > cam.y + rows + 1) continue;
      sprite(m, x * T, y * T, m === mine, now);
    }
  }
  /* lignes visibles : selon la hauteur de la place (src/ui/fit.js, fitInstant) */
  function setRows(n){
    n = Math.max(MI.camMinRows, Math.min(MI.h + 2, Math.round(n)));
    if(n !== rows){ rows = n; resize(); }
  }
  return { draw, setRows, get cols(){ return cols; }, get rows(){ return rows; } };
}
