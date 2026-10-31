/* Rendu de l'Instance I : LIT la copie d'affichage (src/shared/instances-view.js), ne la modifie jamais.
   Caméra rapprochée (INSTANCE.view : cols × rows cases, 27/10/2026 ; avant : toute la salle) qui suit le mineur du
   joueur en glissant, comme dans la tour du Jugement. Fond de grotte, rebords et plateforme en briques, échelles, blocs des
   cages, spawners avec leur barre de vie, gobelins (et leur vie), le roi gobelin (3 × 3) et sa vie, les mineurs avec
   leur stuff (petit arc quand ils sont repoussés). Chaque entité glisse entre deux envois (src/shared/view.js). */
import { INSTANCE } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';
import { drawMobFx } from './effects.js';
import { shownPos } from '../shared/view.js';
import { ROCK, CAGE, SPAWNER } from '../sim/instance/world.js';
import { armPose, trackRocks, SLAM_MS } from './golbute-fx.js';

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

  const V = INSTANCE.view;
  let cam = null;                                   // coin haut-gauche affiché, en cases (glisse vers sa cible)

  /* me : ID du compte du joueur (son mineur est entouré, dessiné par-dessus, et suivi par la caméra) */
  function draw(G, me){
    const now = performance.now();
    const cols = Math.min(V.cols, G.w), rows = Math.min(V.rows, G.h + 1);
    if(cv.width !== cols * T || cv.height !== rows * T){ cv.width = cols * T; cv.height = rows * T; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    const fol = G.miners.find(m => m.account === me) ?? G.miners[0];
    const [fx, fy] = fol ? posOf(G, fol, now) : [G.w / 2, G.h];
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const want = { x: clamp(fx + 0.5 - cols / 2, 0, G.w - cols), y: clamp(fy + 0.5 - rows / 2, 0, G.h + 1 - rows) };
    if(!cam || Math.abs(cam.x - want.x) + Math.abs(cam.y - want.y) > 12) cam = { ...want };   // départ, projection : on saute
    else { cam.x += (want.x - cam.x) * 0.15; cam.y += (want.y - cam.y) * 0.15; }
    ctx.setTransform(1, 0, 0, 1, Math.round(-cam.x * T), Math.round(-cam.y * T));
    if(G.instance === 'instance_2') return drawGolbute(G, me, now);
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
      if(b.state !== 'sleep') drawMobFx(ctx, [b.rage && 'rage', b.taunt && 'taunt'].filter(Boolean), px + b.w * T / 2, py - 7, b.w * T, now, T);   // états du roi (28/10)
      if(b.state === 'sleep'){ ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#d8c9a8'; ctx.fillText('zZ', px + b.w * T - 2, py - 1); }
    }
    /* gobelins */
    for(const o of G.goblins){
      const [ox, oy] = posOf(G, o, now), px = ox * T, py = oy * T;
      ctx.save();
      if((o.face || 1) < 0){ ctx.translate(px + T, 0); ctx.scale(-1, 1); blit('goblin', 0, py, '#5f8a3a'); } else blit('goblin', px, py, '#5f8a3a');
      ctx.restore();
      if(o.hp < o.maxhp) bar(px + 1, py - 5, T - 2, o.hp / o.maxhp, '#ff5a3b');
      drawMobFx(ctx, [o.stun && 'stun', o.taunt && 'taunt'].filter(Boolean), px + T / 2, py - 5, T, now, T);   // états (28/10)
    }
    /* mineurs : le sien par-dessus */
    const mine = G.miners.find(m => m.account === me);
    for(const m of [...G.miners.filter(x => x !== mine), ...(mine ? [mine] : [])]){
      const [x, y0] = posOf(G, m, now), y = y0 - arcOf(m, now);
      const a = m.action?.type === 'drill' || m.action?.type === 'mine' ? { type: 'mine' } : m.action?.type === 'attack' ? { type: 'attack' } : m.action;
      sprite({ ...m, action: a }, x * T, y * T, m === mine, now);
    }
  }

  /* Instance II, le Golbute (30/10/2026) : arène vide (sol de briques), le Golbute 5 × 5 (cristal : texture de cristal ;
     coup au sol : il lève les bras et frappe de chaque côté, poussière sur 3 cases, src/render/golbute-fx.js), ses golems,
     les rochers de l'avalanche qui tombent sur chaque mineur, les mineurs (un mort est couché, grisé) */
  const seen = { slam: null, slamAt: -Infinity, rocks: new Map() };
  /* bras du Golbute : texture du bras gauche (34 × 80 px), pivot à l'épaule ; le droit en miroir */
  function drawArm(b, px, py, side, pose, name, fallback){
    const k = T / 16, pivX = 18 * k, pivY = 24 * k;
    ctx.save();
    ctx.translate(side < 0 ? px + pivX : px + b.w * T - pivX, py + pivY);
    if(side > 0) ctx.scale(-1, 1);
    ctx.rotate(pose.angle);
    ctx.scale(1, pose.stretch);
    blit(name, -pivX, -pivY, fallback, 34 * k, b.h * T);
    ctx.restore();
  }
  function drawGolbute(G, me, now){
    for(let y = 0; y <= G.h; y++) for(let x = 0; x < G.w; x++){
      const px = x * T, py = y * T;
      blit('tunnel', px, py, '#2a1f18');
      if(G.tiles[y][x]) blit('dungeon_brick', px, py, '#4a3a2e');
    }
    const b = G.boss;
    if(b && b.slamAt != null && b.slamAt !== seen.slam){
      seen.slam = b.slamAt;
      if(now - seen.slamAt >= SLAM_MS) seen.slamAt = now;   // une animation commencée va au bout
    }
    const pose = armPose((now - seen.slamAt) / SLAM_MS);
    if(b && b.hp > 0 && b.state !== 'split'){
      const px = b.x * T, py = (b.y - b.h + 1) * T, crystal = b.state === 'crystal', end = crystal ? '_crystal' : '', stone = crystal ? '#7fd6ff' : '#6b6f78';
      ctx.save();
      if(b.rage){ ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 10; }
      if(crystal){ ctx.shadowColor = '#9fe8ff'; ctx.shadowBlur = 12; }
      blit('golbute_body' + end, px, py + pose.dip, stone, b.w * T, b.h * T);
      for(const side of [-1, 1]) drawArm(b, px, py + pose.dip, side, pose, 'golbute_arm' + end, stone);
      ctx.restore();
      if(pose.dust > 0){
        ctx.fillStyle = `rgba(200,180,150,${pose.dust * 0.7})`;
        const R = INSTANCE.golbute.slam.range * T, floor = (b.y + 1) * T, up = Math.round((1 - pose.dust) * 6);
        ctx.fillRect(px - R, floor - 5 - up, R, 4 + up); ctx.fillRect(px + b.w * T, floor - 5 - up, R, 4 + up);
      }
      if(b.state === 'crystal' && b.crystal) bar(px - 2, py - 13, b.w * T + 4, b.crystal.hp / b.crystal.max, '#9fe8ff');
      bar(px - 2, py - 7, b.w * T + 4, b.hp / b.maxhp, b.rage ? '#ff3b3b' : '#c9b48a');
      drawMobFx(ctx, [b.rage && 'rage'].filter(Boolean), px + b.w * T / 2, py - 7, b.w * T, now, T);
    }
    for(const o of G.golems || []){
      const [ox, oy] = posOf(G, o, now), px = ox * T, py = oy * T;
      ctx.save();
      if((o.face || 1) < 0){ ctx.translate(px + T, 0); ctx.scale(-1, 1); blit('golem', 0, py, '#80868f'); } else blit('golem', px, py, '#80868f');
      ctx.restore();
      if(o.hp < o.maxhp) bar(px + 1, py - 5, T - 2, o.hp / o.maxhp, '#ff5a3b');
      drawMobFx(ctx, [o.stun && 'stun', o.taunt && 'taunt'].filter(Boolean), px + T / 2, py - 5, T, now, T);
    }
    const mine = G.miners.find(m => m.account === me);
    for(const m of [...G.miners.filter(x => x !== mine), ...(mine ? [mine] : [])]){
      const [x, y0] = posOf(G, m, now), y = y0 - arcOf(m, now);
      if(m.dead){
        ctx.save(); ctx.globalAlpha = 0.55; ctx.translate(x * T + T, y * T + T); ctx.rotate(Math.PI / 2);
        sprite({ ...m, name: null, action: null }, -T, 0, m === mine, now); ctx.restore();
        ctx.save(); ctx.globalAlpha = 0.55; sprite.label(m.name, x * T, y * T, m === mine); ctx.restore();   // le corps est couché, pas son pseudo
        continue;
      }
      const a = m.action?.type === 'drill' ? { type: 'mine' } : m.action?.type === 'attack' ? { type: 'attack' } : m.action;
      sprite({ ...m, action: a }, x * T, y * T, m === mine, now);
    }
    /* rochers de l'avalanche : chacun tombe du plafond sur sa colonne jusqu'au sol, s'y brise dans la poussière */
    for(const r of trackRocks(seen.rocks, G.rocks, now)){
      const px = r.x * T, py = Math.round(r.fall * G.floorY * T);
      if(!r.dust){ blit('golbute_rock', px, py, '#8a7a66'); continue; }
      ctx.save(); ctx.globalAlpha = r.dust; blit('golbute_rock', px, py, '#8a7a66'); ctx.restore();
      ctx.fillStyle = `rgba(200,180,150,${r.dust * 0.7})`;
      const w = Math.round(T * (2.2 - r.dust));
      ctx.fillRect(px + T / 2 - w / 2, py + T - 4 - Math.round((1 - r.dust) * 5), w, 4);
    }
  }
  return { draw };
}

/* hauteur du canvas en cases (pour la mise à l'échelle) */
export const instanceRows = () => INSTANCE.h + 1;
