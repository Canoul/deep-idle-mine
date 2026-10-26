/* Rendu du Bloc géant : LIT la vue envoyée par le serveur (server/giant/service.js viewOf), ne la modifie jamais.
   Toute la salle à l'écran (GIANT.w × GIANT.h cases, plus le sol) : mur du fond, sol, la grande torche, la fontaine,
   le bloc géant qui pulse, et les mineurs avec leur stuff (pioche qui frappe, arc quand ils sont repoussés).
   Entre deux envois, chaque mineur glisse de sa position précédente à la nouvelle (interpolation). */
import { GIANT } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';

export const GT_TILE = 16;

export function createGiantRenderer(cv){
  const ctx = cv.getContext('2d'), T = GT_TILE;
  ctx.imageSmoothingEnabled = false;
  const TEX = loadTextures();
  const sprite = createMinerSprite(ctx, TEX, T);
  const ready = i => i && i.complete && i.naturalWidth;
  function blit(name, px, py, fallback, w = T, h = T){
    const i = TEX[name];
    if(ready(i)) ctx.drawImage(i, px, py, w, h);
    else if(fallback){ ctx.fillStyle = fallback; ctx.fillRect(px, py, w, h); }
  }
  let prev = new Map(), cur = new Map(), at = 0;   // positions (id → { x, fly }) au dernier envoi et au précédent

  /* nouvelle vue du serveur : on garde la précédente pour glisser */
  function update(view){
    prev = new Map([...cur].map(([id, p]) => [id, { ...p, x: shownX(p, performance.now()) }]));
    cur = new Map((view?.miners ?? []).map(m => [m.id, m]));
    at = performance.now();
  }
  const shownX = (m, now) => {
    const p = prev.get(m.id), k = Math.min(1, (now - at) / GIANT.viewPoll);
    return p && Math.abs(p.x - m.x) < 4 ? p.x + (m.x - p.x) * k : m.x;
  };
  /* hauteur de l'arc d'un recul (cases), selon l'avancement du vol */
  const arc = (m, now) => {
    if(!m.fly) return 0;
    const k = Math.min(1, m.fly.k + (now - at) / 1000 / GIANT.knock.flight);
    return k < 1 ? 1.2 * Math.sin(Math.PI * k) : 0;
  };

  function draw(view){
    const L = view?.layout ?? { w: GIANT.w, h: GIANT.h, bx: GIANT.w - GIANT.block, by: GIANT.h - GIANT.block, bw: GIANT.block, bh: GIANT.block,
                                row: GIANT.h - 1, fountain: GIANT.fountainX };
    const now = performance.now();
    const W = L.w * T, H = (L.h + 1) * T;
    if(cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    /* mur du fond et sol */
    for(let y = 0; y < L.h; y++) for(let x = 0; x < L.w; x++) blit('tunnel', x * T, y * T, '#2a1f18');
    for(let x = 0; x < L.w; x++) blit('barrier', x * T, L.h * T, '#34344a');
    /* la grande torche, posée au sol entre la fontaine et le bloc, et sa lumière chaude (tout est éclairé) */
    const tcx = Math.round((L.fountain + L.bx) / 2) - 0.5, tx = tcx * T + T / 2, ty = (L.row - 1) * T + 6;
    const glow = ctx.createRadialGradient(tx, ty, 4, tx, ty, W * 0.8);
    glow.addColorStop(0, 'rgba(255,190,90,.24)'); glow.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    blit('giant_torch', tcx * T, (L.row - 1) * T, '#ff8a1f', T, 2 * T);
    /* fontaine à oxygène */
    blit('giant_fountain', L.fountain * T, (L.row - 1) * T, '#3d8bff', T, 2 * T);
    /* le bloc géant, qui pulse */
    const bx = L.bx * T, by = L.by * T, bw = L.bw * T, bh = L.bh * T, pulse = 0.5 + 0.5 * Math.sin(now / 450);
    ctx.save();
    ctx.shadowColor = `hsl(${(now / 20) % 360}, 90%, 65%)`; ctx.shadowBlur = 6 + 10 * pulse;
    blit('giant_block', bx, by, '#6a4fa0', bw, bh);
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${(0.04 + 0.10 * pulse).toFixed(3)})`; ctx.fillRect(bx, by, bw, bh);
    /* mineurs : les autres d'abord, le sien par-dessus. Ils se superposent devant le bloc : un seul pseudo par endroit
       (le sien d'abord), avec le nombre de mineurs (« ×3 ») */
    const list = [...cur.values()].sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0));
    const pos = new Map(list.map(m => [m.id, [shownX(m, now), L.row - arc(m, now)]]));
    const named = [];
    for(const m of [...list].reverse()){                     // le sien d'abord
      const [x, y] = pos.get(m.id);
      if(!named.some(n => Math.abs(n.x - x) < 0.8 && Math.abs(n.y - y) < 0.8)) named.push({ id: m.id, x, y, n: 0 });
      const n = named.find(q => Math.abs(q.x - x) < 0.8 && Math.abs(q.y - y) < 0.8); n.n++;
    }
    for(const m of list){
      const [x, y] = pos.get(m.id), tag = named.find(n => n.id === m.id);
      sprite({ ...m, name: tag ? m.name : '', action: m.mining ? { type: 'mine' } : null }, x * T, y * T, m.me, now);
    }
    ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for(const n of named) if(n.n > 1){
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(`×${n.n}`, n.x * T + T - 2, n.y * T + 1);
      ctx.fillStyle = '#ffd27a'; ctx.fillText(`×${n.n}`, n.x * T + T - 2, n.y * T + 1);
    }
  }
  return { draw, update };
}
