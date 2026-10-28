/* États visibles dessinés sur le perso et sur les mobs (28/10/2026, Geoffrey ; EFFECTS en config, src/sim/effects.js).
   Lit les états reçus du serveur (m.effects, o.fx, m.spellCd), ne modifie rien de la partie. Tout est animé à
   l'horloge de la page (now, ms), donc fluide entre deux envois du serveur.
   - contrôles et debuffs : étoiles qui tournent (étourdi), botte barrée (taclé), bulles (asphyxie), pièce qui
     s'envole (vol), « ! » qui tremble (effroi), crochets rouges (ciblé par le boss) ;
   - buffs : lueur au sol (Cri de guerre), notes (Inspiration), traits de vitesse (Ruée, Navette, Braum) ;
   - sorts : une onde qui s'élargit et l'icône du sort qui monte, au moment où il part (sa recharge repart) ;
   - mobs : petites icônes au-dessus de leur barre de vie (étoiles pour l'étourdissement). */
import { EFFECTS, SPELLS } from '../config.js';
import { pxPath } from '../ui/pxicons.js';

const paths = new Map();
const pathOf = name => {
  if(!paths.has(name)){ const d = pxPath(name); paths.set(name, d && typeof Path2D !== 'undefined' ? new Path2D(d) : null); }
  return paths.get(name);
};

/* icône pixel (16 × 16 dans pxicons) à la taille size, contour noir pour rester lisible sur la roche */
export function drawIcon(ctx, name, x, y, size, color, alpha = 1){
  const p = pathOf(name); if(!p) return;
  const k = size / 16;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(0,0,0,.85)';
  for(const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]){ ctx.save(); ctx.translate(dx, dy); ctx.fill(p); ctx.restore(); }
  ctx.fillStyle = color; ctx.fill(p);
  ctx.restore();
}

/* petite étoile (une croix de pixels) */
function star(ctx, x, y, s, color, alpha){
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - s), Math.round(y), Math.round(2 * s + 1), 1);
  ctx.fillRect(Math.round(x), Math.round(y - s), 1, Math.round(2 * s + 1));
  ctx.globalAlpha = 1;
}
/* étoiles qui tournent au-dessus d'une tête (cx : milieu, y : haut de la tête) */
export function drawStunStars(ctx, cx, y, w, now, color = '#ffd23f'){
  ctx.save();
  for(let k = 0; k < 3; k++){
    const a = now / 260 + k * 2 * Math.PI / 3, front = Math.sin(a) > 0;
    star(ctx, cx + Math.cos(a) * w * 0.42, y - 3 + Math.sin(a) * w * 0.14, front ? 2 : 1, color, front ? 1 : 0.6);
  }
  ctx.restore();
}

const BOOT = ['.XX...', '.XX...', '.XX...', '.XXXX.', 'XXXXXX'];   // petite botte (5 lignes de 6 pixels)
function bootCrossed(ctx, x, y, k){
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  BOOT.forEach((row, j) => [...row].forEach((c, i) => {
    if(c !== 'X') return;
    ctx.fillStyle = '#000'; ctx.fillRect(i - 0.5, j - 0.5, 2, 2);
  }));
  BOOT.forEach((row, j) => [...row].forEach((c, i) => { if(c === 'X'){ ctx.fillStyle = '#c8a27a'; ctx.fillRect(i, j, 1, 1); } }));
  ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(7, 6); ctx.stroke();
  ctx.restore();
}

/* un sort part : sa recharge repart (spellCd[id] augmente). On le repère d'un envoi à l'autre, par mineur. */
export function createCastWatch(){
  const last = new Map();          // id du mineur → { cd: { sort: fin de recharge }, casts: [{ id, at }] }
  return function castsOf(m, now){
    let s = last.get(m.id);
    if(!s){ s = { cd: { ...(m.spellCd || {}) }, casts: [] }; last.set(m.id, s); return s.casts; }
    for(const [id, v] of Object.entries(m.spellCd || {})){
      if(v > (s.cd[id] ?? 0) + 1e-6) s.casts.push({ id, at: now });   // recharge repartie (ou premier lancement de ce sort)
      s.cd[id] = v;
    }
    s.casts = s.casts.filter(c => now - c.at < EFFECTS.castAnim);
    return s.casts;
  };
}
const SPELL_ICON = Object.fromEntries(SPELLS.list.map(s => [s.id, s.icon]));

/* le mineur (px, py : coin haut gauche de sa case ; T : taille d'une case) */
export function drawMinerFx(ctx, m, px, py, T, now, casts = []){
  const has = new Map((m.effects || []).map(e => [e.id, e]));
  const cx = px + T / 2, k = T / 16;
  ctx.save();
  /* buffs, sous lui */
  if(has.has('war_cry')){
    const a = 0.35 + 0.15 * Math.sin(now / 120);
    ctx.fillStyle = `rgba(255,106,59,${a.toFixed(2)})`;
    ctx.beginPath(); ctx.ellipse(cx, py + T - 1, T * 0.55, T * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  }
  if(has.has('ore_rush') || has.has('travel_rush') || has.has('braum')){
    const back = (m.face || 1) > 0 ? px - 2 * k : px + T + 2 * k, dir = (m.face || 1) > 0 ? -1 : 1;
    ctx.fillStyle = has.has('braum') ? 'rgba(150,215,255,.9)' : 'rgba(190,255,150,.9)';
    for(let j = 0; j < 3; j++){
      const len = (4 + ((now / 60 + j * 3) % 5)) * k;
      ctx.fillRect(dir > 0 ? back : back - len, py + (4 + j * 4) * k, len, Math.max(1, Math.round(1.5 * k)));
    }
  }
  if(has.has('inspiration')){
    const p = (now / 1400) % 1;
    drawIcon(ctx, 'note', px - 6 * k + Math.sin(p * 6) * 2, py + 6 * k - p * T * 0.5, 7 * k, '#6fc2ff', 1 - p);   // à gauche de la tête, sous le pseudo
  }
  /* contrôles et debuffs, au-dessus */
  const stun = has.get('stun');
  if(stun) drawStunStars(ctx, cx, py + 4 * k, T, now, stun.src === 'hex' ? '#c48bff' : '#ffd23f');
  if(has.has('tackled')) bootCrossed(ctx, px - 3 * k, py + T - 5 * k, k);
  if(has.has('choke')){
    for(let j = 0; j < 3; j++){
      const p = ((now / 900) + j / 3) % 1;
      ctx.strokeStyle = `rgba(143,209,79,${(1 - p).toFixed(2)})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx + 3 * k + Math.sin(p * 9 + j) * 2, py + 5 * k - p * T * 0.7, (1 + p * 1.5) * k, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if(has.has('robbed')){
    const p = (now / 2000) % 1;
    if(p < 0.6) drawIcon(ctx, 'coin', px - 4 * k - p * 6, py + 2 * k - p * T * 0.8, 7 * k, '#e0b03a', 1 - p / 0.6);
  }
  if(has.has('scared')){
    const j = Math.round(Math.sin(now / 40));
    drawIcon(ctx, 'alert', px - 7 * k + j, py - 1 * k, 8 * k, '#ff8c1a');   // à gauche de la tête (pseudo au-dessus, stacks de chair à droite)
  }
  if(has.has('boss_focus')){
    const a = 0.6 + 0.4 * Math.sin(now / 150), c = 3 * k, x0 = px - 2, y0 = py - 2, x1 = px + T + 1, y1 = py + T + 1;
    ctx.strokeStyle = `rgba(229,83,75,${a.toFixed(2)})`; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + c); ctx.lineTo(x0, y0); ctx.lineTo(x0 + c, y0);
    ctx.moveTo(x1 - c, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + c);
    ctx.moveTo(x0, y1 - c); ctx.lineTo(x0, y1); ctx.lineTo(x0 + c, y1);
    ctx.moveTo(x1 - c, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - c);
    ctx.stroke();
  }
  /* sorts qui viennent de partir : onde + icône qui monte */
  for(const c of casts){
    const p = Math.min(1, (now - c.at) / EFFECTS.castAnim), col = EFFECTS.castColor[c.id] ?? '#ffffff';
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = col; ctx.lineWidth = 2 * (1 - p) + 0.5;
    ctx.beginPath(); ctx.arc(cx, py + T / 2, T * (0.4 + 1.1 * p), 0, Math.PI * 2); ctx.stroke();
    const icon = SPELL_ICON[c.id];
    if(icon){ ctx.font = `${Math.round(9 * k)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(icon, cx, py - 2 - p * T * 0.8); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* états d'un mob (list : ids de EFFECTS.mob) ; cx : milieu, top : haut de sa barre de vie ; w : largeur du mob */
export function drawMobFx(ctx, list, cx, top, w, now, T = 16){
  if(!list?.length) return;
  if(list.includes('stun')) drawStunStars(ctx, cx, top + 2, w, now);
  const icons = list.filter(id => id !== 'stun' && EFFECTS.mob[id]);
  const s = Math.round(8 * T / 16), x0 = cx - (icons.length * (s + 1)) / 2;
  icons.forEach((id, i) => drawIcon(ctx, EFFECTS.mob[id].icon, x0 + i * (s + 1), top - s - 1, s, EFFECTS.mob[id].color));
}
