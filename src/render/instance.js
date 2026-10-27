/* Rendu de l'Instance I : LIT la copie d'affichage (src/shared/instances-view.js), ne la modifie jamais.
   Toute la salle à l'écran (20 × 21 cases) : fond de grotte, rebords et plateforme en briques, échelles, blocs des
   cages, spawners avec leur barre de vie, gobelins (et leur vie), le roi gobelin (3 × 3) et sa vie, les mineurs avec
   leur stuff (petit arc quand ils sont repoussés). Chaque entité glisse entre deux envois (src/shared/view.js). */
import { INSTANCE } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';
import { shownPos } from '../shared/view.js';
import { ROCK, CAGE, SPAWNER } from '../sim/instance/world.js';

export const IN_TILE = 16;
const ARC_MS = 350;

export function createInstanceRenderer(cv){
  const ctx = cv.getContext('2d'), T = IN_TILE;
  ctx.imageSmoothingEnabled = false;
  const TEX = loadTextures();
  const sprite = createMinerSprite(ctx, TEX, T);
  const ready = i => i && i.complete && i.naturalWidth;
  function blit(name, px, py, fallback, w = T, h = T){
    const i = TEX[name];
    if(ready(i)) ctx.drawImage(i, px, py, w, h);
    else if(fallback){ ctx.fillStyle = fallback; ctx.fillRect(px, py, w, h); }
  }
  const bar = (px, py, w, pct, color) => {
    ctx.fillStyle = '#000'; ctx.fillRect(px, py, w, 4);
    ctx.fillStyle = color; ctx.fillRect(px + 1, py + 1, Math.max(0, (w - 2) * pct), 2);
  };
  const posOf = (G, o, now) => o._to ? shownPos(G, o, now) : [o.x + (o.kx || 0), o.y];
  /* arc : un recul (hop) fait un petit saut, un coup boosté un grand */
  const arcOf = (m, now) => {
    if(m._hopAt == null) return 0;
    const p = (now - m._hopAt) / ARC_MS;
    return p > 0 && p < 1 ? 0.5 * Math.sin(Math.PI * p) : 0;
  };

  /* me : ID du compte du joueur (son mineur est entouré et dessiné par-dessus) */
  function draw(G, me){
    const now = performance.now(), W = G.w * T, H = (G.h + 1) * T;
    if(cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    for(let y = 0; y <= G.h; y++) for(let x = 0; x < G.w; x++){
      const t = G.tiles[y][x], px = x * T, py = y * T;
      blit('tunnel', px, py, '#2a1f18');
      if(t === ROCK) blit('dungeon_brick', px, py, '#4a3a2e');
      else if(t === CAGE) blit('instance_cage', px, py, '#6b5a3a');
      if(G.ladder[y]?.[x] && t !== ROCK && t !== CAGE) blit('ladder', px, py);
    }
    /* spawners (avec leur vie) ; celui que vise le groupe est souligné */
    for(const s of G.spawners){
      if(!s.alive) continue;
      const px = s.x * T, py = s.y * T;
      blit('instance_spawner', px, py, '#7a2a1a');
      if(s.id === G.target){ ctx.strokeStyle = '#ffb84d'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1); }
      bar(px, py - 6, T, s.hp / s.maxhp, '#ff8a3b');
    }
    /* le roi (plateforme puis sol) */
    const b = G.boss;
    if(b && b.hp > 0){
      const [bx, by] = posOf(G, b, now), px = bx * T, py = (by - b.h + 1) * T;
      ctx.save();
      if(b.state === 'sleep'){ ctx.globalAlpha = 0.85; }
      if(b.rage){ ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 8; }
      blit('goblin_king', px, py, '#3f7a3a', b.w * T, b.h * T);
      ctx.restore();
      if(b.state !== 'sleep') bar(px - 2, py - 7, b.w * T + 4, b.hp / b.maxhp, b.rage ? '#ff3b3b' : '#7fd35a');
      if(b.state === 'sleep'){ ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#d8c9a8'; ctx.fillText('zZ', px + b.w * T - 2, py - 1); }
    }
    /* gobelins */
    for(const o of G.goblins){
      const [ox, oy] = posOf(G, o, now), px = ox * T, py = oy * T;
      ctx.save();
      if((o.face || 1) < 0){ ctx.translate(px + T, 0); ctx.scale(-1, 1); blit('goblin', 0, py, '#5f8a3a'); } else blit('goblin', px, py, '#5f8a3a');
      ctx.restore();
      if(o.hp < o.maxhp) bar(px + 1, py - 5, T - 2, o.hp / o.maxhp, '#ff5a3b');
      if(o.stun) blit('stun', px, py - 6);
    }
    /* mineurs : le sien par-dessus */
    const mine = G.miners.find(m => m.account === me);
    for(const m of [...G.miners.filter(x => x !== mine), ...(mine ? [mine] : [])]){
      const [x, y0] = posOf(G, m, now), y = y0 - arcOf(m, now);
      const a = m.action?.type === 'drill' || m.action?.type === 'mine' ? { type: 'mine' } : m.action?.type === 'attack' ? { type: 'attack' } : m.action;
      sprite({ ...m, action: a }, x * T, y * T, m === mine, now);
    }
  }
  return { draw };
}

/* hauteur du canvas en cases (pour la mise à l'échelle) */
export const instanceRows = () => INSTANCE.h + 1;
