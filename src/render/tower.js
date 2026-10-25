/* Rendu des tours de l'Ange et du Démon : LIT la copie d'affichage (src/shared/tower-view.js), ne la modifie jamais.
   Caméra rapprochée (TOWER.view : cols × rows cases, aussi large que la tour) qui suit le mineur du joueur, en
   glissant. Ciel autour, étages pas encore découverts en noir, ombre selon la lumière des torches, Séraphins /
   Diablotins (2 cases de haut) avec leur vie, boss sur le toit avec sa barre de vie, mineurs avec leur stuff. */
import { BLOCKS, TOWER } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';
import { shownPos } from '../shared/view.js';
import { drawSplash } from './splash.js';

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

  const V = TOWER.view;
  cv.width = V.cols * T; cv.height = V.rows * T;
  let cam = null;                                   // coin haut-gauche affiché, en cases (glisse vers sa cible)

  /* position affichée (glissade entre deux envois, src/shared/tower-view.js) ; un mineur repoussé par le boss fait un
     petit arc (TOWER.boss.arcHigh blocs, en TOWER.boss.arcMs) */
  const posOf = (G, o, now) => o._to ? shownPos(G, o, now) : [o.x + (o.kx || 0), o.y];
  const arcOf = (m, now) => {
    if(m._hopAt == null) return 0;
    const p = (now - m._hopAt) / TOWER.boss.arcMs;
    return p > 0 && p < 1 ? TOWER.boss.arcHigh * Math.sin(Math.PI * p) : 0;
  };

  /* me : ID du compte du joueur (son mineur est entouré, dessiné au-dessus des autres, et suivi par la caméra) */
  function draw(G, me){
    const now = performance.now();
    const cols = Math.min(V.cols, G.w), rows = Math.min(V.rows, G.h + 1);
    if(cv.width !== cols * T || cv.height !== rows * T){ cv.width = cols * T; cv.height = rows * T; }
    ctx.imageSmoothingEnabled = false;
    const mine = G.miners.find(m => m.account === me), fol = mine ?? G.miners[0];
    const [bx0, by0] = G.boss ? (G.boss._to ? shownPos(G, G.boss, now) : [G.boss.x + (G.boss.kx || 0), G.boss.y - (G.boss.lift || 0)]) : [G.bx, G.by];
    const [fx, fy] = fol ? posOf(G, fol, now) : [bx0 + 1, G.roof];
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const want = { x: clamp(fx + 0.5 - cols / 2, 0, G.w - cols), y: clamp(fy + 0.5 - rows / 2, 0, G.h + 1 - rows) };
    if(!cam || Math.abs(cam.x - want.x) + Math.abs(cam.y - want.y) > 12) cam = { ...want };   // départ, projection : on saute
    else { cam.x += (want.x - cam.x) * 0.15; cam.y += (want.y - cam.y) * 0.15; }
    ctx.setTransform(1, 0, 0, 1, Math.round(-cam.x * T), Math.round(-cam.y * T));
    const inside = (x, y) => x > G.x0 && x < G.x1 && y >= G.roof && y <= G.floor;
    const x0 = Math.floor(cam.x), y0 = Math.floor(cam.y);
    for(let y = y0; y <= Math.min(G.h, y0 + rows); y++) for(let x = x0; x <= Math.min(G.w - 1, x0 + cols); x++){
      const px = x * T, py = y * T, t = G.tiles[y][x];
      if(G.seen && !G.seen[y]?.[x]){ ctx.fillStyle = '#07050a'; ctx.fillRect(px, py, T, T); continue; }   // pas encore découvert
      if(t === 0) blit(inside(x, y) ? 'tunnel' : 'sky', px, py, inside(x, y) ? '#2a1f18' : (G.side === 'demon' ? '#3a1530' : '#8fd8ff'));
      else blit(BLOCKS[t].tex, px, py, BLOCKS[t].color);
      if(G.ladder?.[y]?.[x] && t === 0) blit('ladder', px, py);
      if(G.winch && x === G.winch.x && y > G.winch.top && y <= G.winch.bottom) blit(G.winch.lift ? 'lift_rail' : 'winch_rope', px, py);   // treuil (ou rails de l'ascenseur) du logisticien
    }
    if(G.winch) blit(G.winch.lift ? 'lift_top' : 'winch_top', G.winch.x * T, (G.winch.top - 1) * T);   // sa poulie (machinerie), au-dessus du dernier palier
    /* torches, puis l'ombre de l'intérieur découvert selon la lumière (comme dans la mine) */
    for(const tc of G.torches || []) if(G.seen?.[tc.y]?.[tc.x]) blit('torch', tc.x * T, tc.y * T);
    for(let y = y0; y <= Math.min(G.h, y0 + rows); y++) for(let x = x0; x <= Math.min(G.w - 1, x0 + cols); x++){
      if(!inside(x, y) || !G.seen?.[y]?.[x]) continue;
      let l = 0;
      for(const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) l = Math.max(l, G.light?.get((y + dy) * G.w + x + dx) || 0);
      const a = 0.72 * (1 - Math.min(1, l * 1.4));
      if(a > 0.01){ ctx.fillStyle = `rgba(4,2,8,${a.toFixed(2)})`; ctx.fillRect(x * T, y * T, T, T); }
    }
    /* mobs des étages (2 cases de haut) et leur vie */
    const mobTex = TOWER.sides[G.side]?.mobTex;
    for(const o of G.mobs || []){
      const [ox, oy] = posOf(G, o, now), px = ox * T, py = (oy - 1) * T;
      blit(mobTex, px, py, G.side === 'demon' ? '#8a1f2a' : '#e8f0ff', T, 2 * T);
      if(o.awake && o.hp < o.maxhp){
        ctx.fillStyle = '#000'; ctx.fillRect(px + 1, py - 4, T - 2, 3);
        ctx.fillStyle = '#ff5a3b'; ctx.fillRect(px + 1, py - 4, (T - 2) * Math.max(0, o.hp / o.maxhp), 3);
      }
      drawSplash(ctx, o, G.t, now, px, py - 4, T);   // dégâts de zone reçus (Force brute)
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
    const b = G.boss, bw = TOWER.boss.w * T, bh = TOWER.boss.h * T, bxp = bx0 * T, byp = by0 * T;
    if(b.hp > 0){
      const img = bossTex(G.side);
      if(ready(img)) ctx.drawImage(img, bxp, byp, bw, bh);
      else { ctx.fillStyle = G.side === 'demon' ? '#5a1f4a' : '#f4f7ff'; ctx.fillRect(bxp, byp, bw, bh); }
      const pct = Math.max(0, b.hp / b.maxhp);
      ctx.fillStyle = '#000'; ctx.fillRect(bxp - 2, byp - 8, bw + 4, 6);
      ctx.fillStyle = pct < TOWER.boss.rageBelow ? '#ff3b3b' : G.side === 'demon' ? '#c48bff' : '#8fd8ff';
      ctx.fillRect(bxp - 1, byp - 7, (bw + 2) * pct, 4);
    }
    for(const m of [...G.miners.filter(x => x !== mine), ...(mine ? [mine] : [])]){
      const [x, y0] = posOf(G, m, now), y = y0 - arcOf(m, now);
      sprite(m, x * T, y * T, m === mine, now);
      if(m.action?.data?.winch) G.winch?.lift ? blit('lift_cabin', x * T, y * T) : blit('bucket', x * T, y * T + 4);   // seau, ou cabine de l'ascenseur
      if(m.id === b.target && b.hp > 0){                     // cible du boss : petit marqueur au-dessus
        ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x * T + T / 2 - 2, y * T - 6, 4, 4);
      }
    }
  }
  return { draw };
}
