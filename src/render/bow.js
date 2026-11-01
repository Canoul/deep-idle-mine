/* Tir à l'arc (Arc de l'Admin, 01/11/2026) : où en est le tir, pour le dessin (src/render/miner-sprite.js). Logique pure. Le coup
   lui-même part dans la simulation : la flèche ne fait que le montrer, elle ne touche rien.
   m : le mineur affiché ; ph : temps de l'animation (BOW_SHOT.perSec cycles par seconde). Renvoie { angle (radians), dist (cases),
   drawn (arc bandé), arrow (null, ou avancée de la flèche de 0 à 1) }. Sans cible connue (boss) : une case devant lui. */
import { BOW_SHOT } from '../config.js';

export function bowShot(m, ph){
  const aim = m.action?.data?.aim, t = ph % 1, off = t >= BOW_SHOT.release;
  const dx = aim ? aim.x - m.x : m.face || 1, dy = aim ? aim.y - m.y : 0;
  return { angle: Math.atan2(dy, dx), dist: Math.hypot(dx, dy) || 1, drawn: !off,
           arrow: off ? (t - BOW_SHOT.release) / (1 - BOW_SHOT.release) : null };
}
