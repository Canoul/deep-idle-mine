/* Minotaure à l'écran (02/11/2026, Jules : Geoffrey ne voyait ni la Charge ni la Rage). Lit ses états reçus du serveur
   (o.fx, src/sim/effects.js), ne modifie rien de la partie ; animé à l'horloge de la page (now, ms). MINO_FX en config.
   - il gratte le sol (charge) : il tremble et une bulle « CHARGE ! » apparaît au-dessus de lui ;
   - enragé (rage) : une aura rouge pulse derrière lui. */
import { MINO_FX } from '../config.js';

/* ce qu'on dessine à l'instant now : décalage du sprite (px), opacité de l'aura (0 : aucune), bulle (null : aucune) */
export function minoLook(fx, now){
  const charge = !!fx?.includes('charge'), rage = !!fx?.includes('rage'), F = MINO_FX;
  return {
    shake: charge ? Math.round(F.shake * Math.sin(now / F.shakeMs)) : 0,
    aura: rage ? F.auraMin + (F.auraMax - F.auraMin) * (0.5 + 0.5 * Math.sin(now / F.auraMs)) : 0,
    label: charge ? F.chargeLabel : null,
  };
}

/* aura de rage, sous le sprite ; px, py : coin haut-gauche de sa case, T : taille d'une case */
export function drawMinoAura(ctx, look, px, py, T){
  if(!(look.aura > 0)) return;
  const cx = px + T / 2, cy = py + T / 2, c = MINO_FX.auraColor;
  const g = ctx.createRadialGradient(cx, cy, T * 0.2, cx, cy, T);
  g.addColorStop(0, `rgba(${c},${look.aura.toFixed(2)})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.fillRect(px - T / 2, py - T / 2, T * 2, T * 2);
}

/* bulle « CHARGE ! », au-dessus de ses icônes d'état (top : haut de sa barre de vie) */
export function drawMinoLabel(ctx, look, cx, top){
  if(!look.label) return;
  ctx.save();
  ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(look.label, cx, top - 10);
  ctx.fillStyle = MINO_FX.chargeColor; ctx.fillText(look.label, cx, top - 10);
  ctx.restore();
}
