/* Rendu de la mine instantanée : LIT la copie d'affichage (src/shared/instant-view.js), ne la modifie jamais.
   Toute la mine tient à l'écran (50 × 51 cases, sans caméra) : on voit tout le monde piller. Tout est éclairé. */
import { BLOCKS, INSTANT_MINE as MI } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';

export const MI_TILE = 16;

/* position affichée d'un mineur : en marche, entre sa case et la suivante selon l'avancée de l'action */
export function instantPos(m){
  const a = m.action;
  if(a?.type === 'move' && a.data && Number.isFinite(a.data.x)){
    const p = Math.min(1, a.dur > 0 ? a.t / a.dur : 1);
    return [m.x + (a.data.x - m.x) * p, m.y + (a.data.y - m.y) * p];
  }
  return [m.x, m.y];
}

export function createInstantRenderer(cv){
  const ctx = cv.getContext('2d'), T = MI_TILE;
  cv.width = MI.w * T; cv.height = (MI.h + 2) * T;   // + une bande de ciel en haut : les pseudos en surface restent lisibles
  ctx.imageSmoothingEnabled = false;
  const TEX = loadTextures();
  const sprite = createMinerSprite(ctx, TEX, T);
  function blit(name, px, py, fallback){
    const i = TEX[name];
    if(i && i.complete && i.naturalWidth) ctx.drawImage(i, px, py, T, T);
    else if(fallback){ ctx.fillStyle = fallback; ctx.fillRect(px, py, T, T); }
  }

  /* me : ID du compte du joueur (son mineur est entouré et dessiné au-dessus des autres) */
  function draw(G, me){
    const now = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for(let x = 0; x < G.w; x++) blit('sky', x * T, 0, '#6cc3ee');
    ctx.translate(0, T);
    for(let y = 0; y <= G.h; y++) for(let x = 0; x < G.w; x++){
      const px = x * T, py = y * T, t = G.tiles[y][x];
      if(y === 0){ blit('sky', px, py, '#6cc3ee'); continue; }
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
    const mine = G.miners.find(m => m.account === me);
    for(const m of [...G.miners.filter(x => x !== mine), ...(mine ? [mine] : [])]){
      const [x, y] = instantPos(m);
      sprite(m, x * T, y * T, m === mine, now);
    }
  }
  return { draw };
}
