/* Animations du Golbute (31/10/2026, Geoffrey), sans canvas. Temps réel (ms), indépendants de la vitesse de la partie.
   armPose : pose des bras pendant le coup au sol. trackRocks : rochers de l'avalanche, suivis ici : le serveur ne les envoie
   que 1,5 s de jeu, moins que leur chute dès la vitesse ×2 (ils disparaissaient en l'air). */
export const SLAM_MS = 640, ROCK_MS = 900, ROCK_DUST_MS = 300;

const ease = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const RAISED = 2.5, DOWN = 0.9, REACH = 1.6;   // angles (radians, 0 : bras pendant) ; étirement du bras au sol

/* p : avancement du coup (0 à 1), en dehors : au repos. → { angle, stretch, dip (px, le corps s'abaisse), dust (0 à 1) } */
export function armPose(p){
  if(!(p > 0 && p < 1)) return { angle: 0, stretch: 1, dip: 0, dust: 0 };
  if(p < 0.3){ const t = ease(p / 0.3); return { angle: lerp(0, RAISED, t), stretch: 1, dip: 0, dust: 0 }; }   // il lève les bras
  if(p < 0.42){ const t = (p - 0.3) / 0.12; return { angle: lerp(RAISED, DOWN, t * t), stretch: lerp(1, REACH, t), dip: 0, dust: 0 }; }   // il frappe
  const dust = 1 - (p - 0.42) / 0.58;
  if(p < 0.62) return { angle: DOWN, stretch: REACH, dip: 3, dust };   // poings au sol
  const t = ease((p - 0.62) / 0.38);
  return { angle: lerp(DOWN, 0, t), stretch: lerp(REACH, 1, t), dip: Math.round(lerp(3, 0, t)), dust };
}

/* seen : Map (rocher → heure où on l'a vu tomber), gardée par le dessin. → [{ x, fall (0 à 1), dust (0 à 1, 0 : pas encore au sol) }] */
export function trackRocks(seen, rocks, now){
  for(const r of rocks ?? []){
    const k = r.at + ':' + r.x;
    if(!seen.has(k)) seen.set(k, { x: r.x, at: now });
  }
  const out = [];
  for(const [k, r] of seen){
    const age = now - r.at;
    if(age < ROCK_MS) out.push({ x: r.x, fall: Math.max(0, age) / ROCK_MS, dust: 0 });
    else if(age < ROCK_MS + ROCK_DUST_MS) out.push({ x: r.x, fall: 1, dust: 1 - (age - ROCK_MS) / ROCK_DUST_MS });
    else if(age > 60e3) seen.delete(k);   // gardé un moment : un rocher encore dans la vue ne retombe pas
  }
  return out;
}
