/* Chiffre des dégâts de zone (Force brute) au-dessus d'un mob touché par la zone : « -0,3 » qui monte et s'efface.
   La partie envoie le dernier coup de zone de chaque mob (o.splash = { v, t }, t = temps de partie) ; l'animation suit
   l'heure du navigateur (première fois qu'il voit ce coup), pour rester fluide entre deux envois du serveur. */
import { FX } from '../config.js';

const seen = new Map();   // `${mob}:${t du coup}` → heure (ms) où le navigateur l'a vu

/* « -0,3 », « -1,2 », « -12 » */
export const splashText = v => '-' + (v >= 10 ? String(Math.round(v)) : String(Math.max(0.1, Math.round(v * 10) / 10)).replace('.', ','));

/* dessine le chiffre de o (px, py : coin haut-gauche de la case du mob, en pixels ; size : largeur d'une case) ;
   t : temps de partie affiché, now : performance.now() */
export function drawSplash(ctx, o, t, now, px, py, size){
  const s = o.splash;
  if(!s || t - s.t > FX.splashGame) return;          // ancien coup (reconnexion) : rien
  const k = o.id + ':' + s.t;
  if(!seen.has(k)){ seen.set(k, now); if(seen.size > 200) for(const [key, at] of seen) if(now - at > FX.splashMs) seen.delete(key); }
  const p = (now - seen.get(k)) / FX.splashMs;
  if(p >= 1) return;
  const y = py - 4 - p * FX.splashRise;
  ctx.save();
  ctx.globalAlpha = 1 - p * p;
  ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(splashText(s.v), px + size / 2, y);
  ctx.fillStyle = '#ffa53b'; ctx.fillText(splashText(s.v), px + size / 2, y);
  ctx.restore();
}
