/* Dessin de l'aura d'une pièce (src/meta/aura.js) : un halo pixel art de la couleur de la qualité autour des pixels
   de sa texture, qui pulse. Partagé par la mine (miner-sprite.js) et les portraits (portrait.js). Lit, ne modifie rien.
   Le halo d'une texture (pour une couleur et une largeur) est calculé une fois puis gardé. */
import { auraLook } from '../meta/aura.js';

const HALOS = new Map();

/* halo d'une image 16×16 : canvas de (16 + 2 × radius)², pixels autour des pixels opaques, plus pâles en s'éloignant */
function haloOf(img, color, radius){
  const key = `${img.src}|${color}|${radius}`;
  if(HALOS.has(key)) return HALOS.get(key);
  const w = img.naturalWidth, h = img.naturalHeight, W = w + 2 * radius, H = h + 2 * radius;
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const sctx = src.getContext('2d'); sctx.drawImage(img, 0, 0);
  const a = sctx.getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 0;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const octx = out.getContext('2d'), px = octx.createImageData(W, H), d = px.data;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const sx = x - radius, sy = y - radius;
    if(solid(sx, sy)) continue;                       // la pièce elle-même est dessinée par-dessus
    let best = Infinity;                              // distance (en pixels) au pixel opaque le plus proche
    for(let dy = -radius; dy <= radius; dy++) for(let dx = -radius; dx <= radius; dx++)
      if(solid(sx + dx, sy + dy)) best = Math.min(best, Math.hypot(dx, dy));
    if(best > radius + 0.5) continue;
    const i = (y * W + x) * 4, f = 1 - (best - 1) / (radius + 0.5);
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = Math.round(255 * Math.max(0.25, Math.min(1, f)));
  }
  octx.putImageData(px, 0, 0);
  HALOS.set(key, out);
  return out;
}

/* opacité de l'aura à l'instant now (ms) : elle respire entre alpha × (1 − pulse) et alpha */
export const auraAlpha = (look, now) => look.alpha * (1 - look.pulse * (0.5 + 0.5 * Math.sin(2 * Math.PI * now / 1000 / look.period)));

/* dessine l'aura de qualité q de la texture img, posée en (x, y) sur size × size pixels ; rien si pas d'aura */
export function drawAura(ctx, img, q, x, y, size, now){
  const look = auraLook(q);
  if(!look || !img?.complete || !img.naturalWidth) return;
  const halo = haloOf(img, look.color, look.radius), k = size / img.naturalWidth;
  ctx.save();
  ctx.globalAlpha *= auraAlpha(look, now);
  ctx.drawImage(halo, x - look.radius * k, y - look.radius * k, halo.width * k, halo.height * k);
  ctx.restore();
}
