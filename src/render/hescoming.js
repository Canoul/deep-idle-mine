/* Rendu de He's coming (01/11/2026) : la salle du Bloc géant (src/render/giant.js), avec Lucifer à la place du bloc. Lit la vue du serveur,
   ne la modifie jamais. Lucifer et son portail de lave, l'onde violette du rugissement (il lève la main et une flamme violette
   s'y allume juste avant, 02/11/2026), le recul de son autoattaque. */
import { HES_COMING as HC, GAME } from '../config.js';
import { createGiantRenderer } from './giant.js';

/* onde violette (fonction pure) : ago = secondes de jeu depuis le rugissement ; null quand elle est finie.
   Elle part de Lucifer et s'arrête au bord de la zone du Fear */
export function roarWave(ago, duration = 1.5){
  if(ago === null || ago === undefined || ago < 0 || ago >= duration) return null;
  return { k:ago / duration, reach:(HC.roar.radius + HC.block / 2) * ago / duration, alpha:0.7 * (1 - ago / duration) };
}

/* image de Lucifer (fonction pure) : ago = secondes de jeu depuis le dernier rugissement (null avant le premier),
   until = secondes avant le prochain. Il lève la main (lucifer_roar1 à 3) juste avant, la flamme vacille (4 à 6)
   jusqu'à A.hold après, puis la main redescend (3, 2, 1) ; le reste du temps, les deux mains sur le portail */
export function luciferFrame(ago, until, A = HC.anim){
  const flame = t => `lucifer_roar${4 + ((Math.floor(t / A.flicker) % 3) + 3) % 3}`;
  if(ago !== null && ago !== undefined && ago >= 0 && ago < A.hold + 3 * A.step){
    if(ago < A.hold) return flame(ago);
    return `lucifer_roar${3 - Math.floor((ago - A.hold) / A.step)}`;
  }
  if(until !== null && until !== undefined && until < 4 * A.step){
    const k = Math.floor((4 * A.step - Math.max(0, until)) / A.step);
    return k < 3 ? `lucifer_roar${k + 1}` : flame(-until);
  }
  return 'lucifer';
}

function drawBoss(ctx, L, view, now, blit, T, seen){
  const wait = (now - seen) / 1000 * GAME.speed, boss = view?.boss;
  const swing = boss?.swingAgo === null || boss?.swingAgo === undefined ? 9 : boss.swingAgo + wait;
  const lean = swing < 0.5 ? Math.round(-3 * Math.sin(Math.PI * swing / 0.5)) : 0;   // il frappe : il se penche vers les mineurs
  const bx = L.bx * T, by = L.by * T, bw = L.bw * T, bh = L.bh * T, flick = 0.5 + 0.5 * Math.sin(now / 180);
  const glow = ctx.createRadialGradient(bx + bw / 2, L.h * T, 8, bx + bw / 2, L.h * T, bw);
  glow.addColorStop(0, `rgba(255,110,30,${(0.4 + 0.2 * flick).toFixed(3)})`); glow.addColorStop(1, 'rgba(255,110,30,0)');
  ctx.fillStyle = glow; ctx.fillRect(bx - bw, by, bw * 2 + T, bh + T);
  /* les rugissements tombent à heure fixe, toutes les roar.every s de jeu (src/sim/hescoming/session.js) : on reste dans le
     cycle même si la vue tarde (sinon il garderait la main levée) */
  const every = HC.roar.every;
  const ago = boss?.roarAgo === null || boss?.roarAgo === undefined ? null : (boss.roarAgo + wait) % every;
  const until = every - (ago ?? ((view?.t ?? 0) + wait) % every);
  blit(luciferFrame(ago, until), bx + lean, by, '#a81c1e', bw, bh);
  blit('lucifer_portal', bx - T, L.h * T, '#ff7a1a', bw + T, T);
  const w = roarWave(ago);
  if(w){
    const cx = bx + bw / 2, cy = by + bh / 2, r = Math.max(4, w.reach * T);
    const aura = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    aura.addColorStop(0, 'rgba(176,107,255,0)'); aura.addColorStop(0.8, `rgba(176,107,255,${(w.alpha * 0.6).toFixed(3)})`); aura.addColorStop(1, 'rgba(176,107,255,0)');
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
}

export const createLuciferRenderer = cv => createGiantRenderer(cv, { drawBoss, flight:HC.swing.flight, high:HC.swing.high,
  strike:(m, L) => ({ type:'attack', data:{ aim:{ x:L.bx, y:m.y } } }) });
