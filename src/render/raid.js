/* Rendu de l'arène du Raid 1, Cerbère (04/11/2026, Geoffrey ; adapté de src/render/instance.js) : LIT la copie
   d'affichage de la phase 'boss' (src/shared/raid-view.js applyRaidView), ne la modifie jamais. Les phases 'mine' et
   'door' sont une mine : c'est le rendu de la mine (src/render/canvas.js) qui les dessine.
   Toute l'arène à l'écran (RAID.cerbere.w × h + le sol) : fond de grotte rougeoyant, sol en pierre des enfers, Cerbère
   (8 × 6 cases, animé : planche textures/cerbere_anim.png, cerbere_rage_anim.png enragé ; 04/11/2026, Jules), sa barre de vie, ses trois cibles marquées, l'éclair de
   la Morsure, la poussière du Balayage, le voile du Magma gazeux ; les mineurs (Durci : bloc de pierre et sa solidité ;
   mordu : halo rouge ; mort : pierre tombale). Chaque entité glisse entre deux envois (src/shared/view.js). */
import { RAID } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';
import { drawMobFx } from './effects.js';
import { shownPos } from '../shared/view.js';

export const RD_TILE = 16;

/* image de la planche de Cerbère à l'instant now (ms, temps réel : le feu ne dépend pas de la vitesse du jeu) */
export function cerbereFrame(now, A = RAID.cerbere.anim){
  return ((Math.floor(now / A.ms) % A.frames) + A.frames) % A.frames;
}
const ARC_MS = 350;
const FX = { bite: 0.7, sweep: 0.6, magma: 2 };     // durée des effets à l'écran (s de jeu depuis l'attaque)

export function createRaidRenderer(cv){
  const ctx = cv.getContext('2d'), T = RD_TILE;
  ctx.imageSmoothingEnabled = false;
  const TEX = loadTextures();
  const sprite = createMinerSprite(ctx, TEX, T);
  const ready = i => i && i.complete && i.naturalWidth;
  function blit(name, px, py, fallback, w = T, h = T){
    const i = TEX[name];
    if(ready(i)) ctx.drawImage(i, px, py, w, h);
    else if(fallback){ ctx.fillStyle = fallback; ctx.fillRect(px, py, w, h); }
  }
  const bar = (px, py, w, pct, color, hgt = 4) => {
    ctx.fillStyle = '#000'; ctx.fillRect(px, py, w, hgt);
    ctx.fillStyle = color; ctx.fillRect(px + 1, py + 1, Math.max(0, (w - 2) * pct), hgt - 2);
  };
  const posOf = (G, o, now) => o._to ? shownPos(G, o, now) : [o.x + (o.kx || 0), o.y + (o.ky || 0)];
  const arcOf = (m, now) => {
    if(m._hopAt == null) return 0;
    const p = (now - m._hopAt) / ARC_MS;
    return p > 0 && p < 1 ? 0.5 * Math.sin(Math.PI * p) : 0;
  };
  /* temps de jeu écoulé depuis une attaque (envoyé en s par le serveur, en direct entre deux envois) */
  const since = (G, ago, now) => ago == null ? Infinity : ago + Math.max(0, (now - (G._at ?? now)) / 1000) * (G._rate || 1);

  /* croix de visée au-dessus d'une cible de Cerbère */
  function reticle(cx, cy, now){
    const r = 4 + Math.sin(now / 160);
    ctx.strokeStyle = '#ff3b2a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff3b2a';
    ctx.fillRect(cx - r - 2, cy, 3, 1); ctx.fillRect(cx + r, cy, 3, 1); ctx.fillRect(cx, cy - r - 2, 1, 3); ctx.fillRect(cx, cy + r, 1, 3);
  }
  /* pierre tombale d'un mort, sur sa case */
  function tomb(px, py){
    ctx.fillStyle = '#5c5650'; ctx.fillRect(px + 4, py + 5, 8, 11); ctx.fillRect(px + 5, py + 4, 6, 1);
    ctx.fillStyle = '#8a837a'; ctx.fillRect(px + 5, py + 6, 6, 9);
    ctx.fillStyle = '#3a3531'; ctx.fillRect(px + 7, py + 7, 2, 6); ctx.fillRect(px + 6, py + 8, 4, 2);
  }

  function draw(G, me){
    const now = performance.now();
    const cols = G.w, rows = G.h + 1;
    if(cv.width !== cols * T || cv.height !== rows * T){ cv.width = cols * T; cv.height = rows * T; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    /* grotte : tunnel assombri, lueur de lave depuis le sol ; sol et murs en pierre des enfers */
    for(let y = 0; y <= G.h; y++) for(let x = 0; x < G.w; x++){
      const px = x * T, py = y * T;
      if(G.tiles[y]?.[x]) blit('hellstone', px, py, '#4a1a12');
      else blit('tunnel', px, py, '#2a1712');
    }
    const glow = ctx.createLinearGradient(0, 0, 0, cv.height);
    glow.addColorStop(0, 'rgba(10,0,0,0.55)'); glow.addColorStop(1, 'rgba(255,70,20,0.22)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, cv.width, (G.floorY + 1) * T);

    const b = G.boss, byId = new Map(G.miners.map(m => [m.id, m]));
    if(b && b.hp > 0){
      const px = b.x * T, py = (b.y - b.h + 1) * T, w = b.w * T, h = b.h * T;
      /* Balayage : la patte balaie RAID.cerbere.sweep.range cases devant lui (poussière) */
      const sw = since(G, b.sweepAgo, now);
      if(sw < FX.sweep){
        const k = 1 - sw / FX.sweep, R = RAID.cerbere.sweep.range * T, floor = (b.y + 1) * T, up = Math.round((1 - k) * 8);
        ctx.fillStyle = `rgba(220,150,90,${k * 0.6})`;
        ctx.fillRect(px - R, floor - 6 - up, R, 5 + up);
      }
      ctx.save();
      if(b.rage){ ctx.shadowColor = '#ff3b1a'; ctx.shadowBlur = 12; }
      const sheet = TEX[b.rage ? 'cerbere_rage_anim' : 'cerbere_anim'];
      if(ready(sheet)){
        const fw = sheet.naturalWidth / RAID.cerbere.anim.frames;
        ctx.drawImage(sheet, cerbereFrame(now) * fw, 0, fw, sheet.naturalHeight, px, py, w, h);
      } else blit(b.rage ? 'cerbere_rage' : 'cerbere', px, py, b.rage ? '#a3260f' : '#3c2426', w, h);
      ctx.restore();
      /* Morsure : éclair rouge sur les gueules */
      const bt = since(G, b.biteAgo, now);
      if(bt < FX.bite){ ctx.fillStyle = `rgba(255,40,20,${(1 - bt / FX.bite) * 0.35})`; ctx.fillRect(px, py, w, h); }
      bar(px - 2, py - 7, w + 4, b.hp / b.maxhp, b.rage ? '#ff3b1a' : '#ff8a2a');
      drawMobFx(ctx, [b.rage && 'rage'].filter(Boolean), px + w / 2, py - 7, w, now, T);
    }

    /* mineurs : le sien par-dessus ; les morts d'abord (au sol, derrière) */
    const mine = G.miners.find(m => m.account === me);
    const order = [...G.miners.filter(m => m.dead), ...G.miners.filter(m => !m.dead && m !== mine), ...(mine && !mine.dead ? [mine] : [])];
    for(const m of order){
      if(m.left != null) continue;                        // a quitté le raid
      const [x, y0] = posOf(G, m, now), y = y0 - arcOf(m, now), px = x * T, py = y * T;
      if(m.dead){
        tomb(Math.round(px), Math.round(y0 * T));      // sans pseudo : les morts s'empilent souvent au contact (l'équipe les nomme)
        continue;
      }
      if(m.stone){
        /* Durci : le mineur grisé dans un bloc de pierre, sa solidité au-dessus */
        ctx.save(); ctx.filter = 'grayscale(1) brightness(0.8)';
        sprite({ ...m, action: null }, px, py, m === mine, now);
        ctx.restore();
        ctx.save(); ctx.globalAlpha = 0.75; blit('stone', px, py, '#7a746c'); ctx.restore();
        ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, T - 1, T - 1);
        bar(px + 1, py - 4, T - 2, m.stone.max ? m.stone.hp / m.stone.max : 0, '#c9c1b5', 3);
        continue;
      }
      const a = m.action?.type === 'drill' || m.action?.type === 'mine' ? { type: 'mine' } : m.action?.type === 'attack' ? { type: 'attack', data: m.action.data } : m.action;
      sprite({ ...m, action: a }, px, py, m === mine, now);
      if(m.bitten > 0){
        /* mordu : halo rouge qui bat, trois traces de crocs */
        const k = 0.35 + 0.25 * Math.sin(now / 90);
        ctx.fillStyle = `rgba(255,30,20,${k})`; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#ffd0c0';
        for(const dx of [4, 7, 10]) ctx.fillRect(px + dx, py + 6, 1, 3);
      }
    }
    /* cibles de la prochaine Morsure (ses trois cibles) */
    for(const id of b?.hp > 0 ? b.targets || [] : []){
      const m = byId.get(id);
      if(!m || m.dead || m.stone || m.left != null) continue;
      const [x, y] = posOf(G, m, now);
      reticle(x * T + T / 2, y * T - 10, now);
    }
    /* Magma gazeux : voile orange sur toute l'arène, qui retombe */
    const mg = since(G, b?.magmaAgo, now);
    if(mg < FX.magma){ ctx.fillStyle = `rgba(255,110,30,${(1 - mg / FX.magma) * 0.3})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  }
  return { draw };
}
