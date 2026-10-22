/* Rendu des tours de l'Ange et du Démon : LIT la copie d'affichage (src/shared/tower-view.js), ne la modifie jamais.
   Toute la tour tient à l'écran (sans caméra). Ciel autour, intérieur creusé en galerie, boss sur le toit avec sa
   barre de vie, mineurs avec leur stuff. */
import { BLOCKS, TOWER } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';
import { instantPos } from './instant.js';

export const TW_TILE = 16;

export function createTowerRenderer(cv){
  const ctx = cv.getContext('2d'), T = TW_TILE;
  ctx.imageSmoothingEnabled = false;
  const TEX = loadTextures();
  const sprite = createMinerSprite(ctx, TEX, T);
  const ready = i => i && i.complete && i.naturalWidth;
  function blit(name, px, py, fallback, w = T, h = T){
    const i = TEX[name];
    if(ready(i)) ctx.drawImage(i, px, py, w, h);
    else if(fallback){ ctx.fillStyle = fallback; ctx.fillRect(px, py, w, h); }
  }
  /* le boss est une image à part (3 × 5 cases) : chargée ici si la liste des textures ne l'a pas */
  const bossImg = {};
  const bossTex = side => {
    const name = TOWER.sides[side].bossTex;
    if(TEX[name]) return TEX[name];
    if(!bossImg[name]){ bossImg[name] = new Image(); bossImg[name].src = `textures/${name}.png`; }
    return bossImg[name];
  };

  /* me : ID du compte du joueur (son mineur est entouré et dessiné au-dessus des autres) */
  function draw(G, me){
    if(cv.width !== G.w * T || cv.height !== (G.h + 1) * T){ cv.width = G.w * T; cv.height = (G.h + 1) * T; ctx.imageSmoothingEnabled = false; }
    const now = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const inside = (x, y) => x > G.x0 && x < G.x1 && y >= G.roof && y <= G.floor;
    for(let y = 0; y <= G.h; y++) for(let x = 0; x < G.w; x++){
      const px = x * T, py = y * T, t = G.tiles[y][x];
      if(t === 0) blit(inside(x, y) ? 'tunnel' : 'sky', px, py, inside(x, y) ? '#2a1f18' : (G.side === 'demon' ? '#3a1530' : '#8fd8ff'));
      else blit(BLOCKS[t].tex, px, py, BLOCKS[t].color);
      if(G.ladder?.[y]?.[x] && t === 0) blit('ladder', px, py);
    }
    /* ciel teinté : rouge sombre pour le Démon */
    if(G.side === 'demon'){ ctx.fillStyle = 'rgba(90,10,40,.35)'; ctx.fillRect(0, 0, G.w * T, G.roof * T); }
    /* blocs en cours de minage : fissure qui grandit */
    for(const m of G.miners){
      const a = m.action;
      if(a?.type !== 'mine') continue;
      const p = Math.min(1, a.t / a.dur), px = a.data.x * T, py = a.data.y * T;
      ctx.fillStyle = `rgba(0,0,0,${(0.15 + 0.45 * p).toFixed(2)})`;
      ctx.fillRect(px + T * (1 - p) / 2, py + T * (1 - p) / 2, T * p, T * p);
    }
    /* boss et sa barre de vie */
    const b = G.boss, bw = TOWER.boss.w * T, bh = TOWER.boss.h * T, bxp = G.bx * T, byp = G.by * T;
    if(b.hp > 0){
      const img = bossTex(G.side);
      if(ready(img)) ctx.drawImage(img, bxp, byp, bw, bh);
      else { ctx.fillStyle = G.side === 'demon' ? '#5a1f4a' : '#f4f7ff'; ctx.fillRect(bxp, byp, bw, bh); }
      const pct = Math.max(0, b.hp / b.maxhp);
      ctx.fillStyle = '#000'; ctx.fillRect(bxp - 2, byp - 8, bw + 4, 6);
      ctx.fillStyle = pct < TOWER.boss.rageBelow ? '#ff3b3b' : G.side === 'demon' ? '#c48bff' : '#8fd8ff';
      ctx.fillRect(bxp - 1, byp - 7, (bw + 2) * pct, 4);
    }
    const mine = G.miners.find(m => m.account === me);
    for(const m of [...G.miners.filter(x => x !== mine), ...(mine ? [mine] : [])]){
      const [x, y] = instantPos(m);
      sprite(m, x * T, y * T, m === mine, now);
      if(m.id === b.target && b.hp > 0){                     // cible du boss : petit marqueur au-dessus
        ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x * T + T / 2 - 2, y * T - 6, 4, 4);
      }
    }
  }
  return { draw };
}
