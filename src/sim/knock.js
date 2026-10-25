/* Combat dynamique (25/10/2026, Geoffrey) : portée d'attaque et recul.
   Chaque entité (mineur, mob) reste sur une case entière (x, y) pour le chemin, la gravité et les échelles, et garde un
   petit décalage dans sa case (kx, ky, entre −0,5 et +0,5). Le recul s'ajoute à ce décalage ; au-delà d'une demi-case,
   l'entité passe sur la case voisine si elle peut y entrer, sinon elle reste sur place. Un pas recentre l'entité
   (décalage remis à 0). Logique pure, sans DOM. Valeurs : COMBAT (src/config.js). */
import { COMBAT } from '../config.js';
import { isAir } from './world.js';

const EPS = 1e-9;
/* décalage horizontal ; un mineur en plein pas sur sa ligne est entre ses deux cases (mouvement continu, 25/10/2026) :
   il reste sur sa case de départ pour le chemin et la gravité, mais la portée se mesure là où il en est de son pas */
export function offX(e){
  const a = e.action;
  if(a?.type === 'move' && a.data.y === e.y && a.data.x !== e.x && a.dur > 0){
    const fx = a.data.fx ?? e.x;
    return fx - e.x + (a.data.x - fx) * Math.min(1, a.t / a.dur);
  }
  return e.kx || 0;
}
export const offY = e => e.ky || 0;
export const recenter = e => { e.kx = 0; e.ky = 0; };

/* écart bord à bord (en blocs) entre deux entités d'une case alignées sur une ligne ou une colonne ; Infinity en
   diagonale (on ne frappe jamais en diagonale). Même case : négatif. */
export function gap(a, b){
  if(a.y === b.y) return Math.abs(a.x + offX(a) - b.x - offX(b)) - 1;
  if(a.x === b.x) return Math.abs(a.y + offY(a) - b.y - offY(b)) - 1;
  return Infinity;
}

/* a peut-il frapper (ou tacler) b ? écart ≤ range et que des cases ouvertes entre les deux (open(G,x,y), par défaut
   une case vide) */
export function inReach(G, a, b, range = COMBAT.reach, open = isAir){
  if(!(gap(a, b) <= range + EPS)) return false;
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  for(let x = a.x + dx, y = a.y + dy; x !== b.x || y !== b.y; x += dx, y += dy) if(!open(G, x, y)) return false;
  return true;
}

/* interrompt l'action du mineur m ; un pas horizontal interrompu GARDE son avancée (mouvement continu, 25/10/2026) :
   il reste là où il en est (décalage kx), et passe sur la case d'arrivée s'il en a fait plus de la moitié. Sans ça, un
   pas coupé le ramenait au centre de sa case : hors de portée, il repartait, était recoupé… (oscillation, seed 7919) */
export function stopAction(m){
  const a = m.action;
  if(a?.type === 'move' && a.data.y === m.y && a.data.x !== m.x && !a.data.fall){
    const pos = m.x + offX(m), dir = Math.sign(a.data.x - m.x);
    if((pos - m.x) * dir > 0.5){ m.x = a.data.x; m.face = dir; }
    m.kx = Math.max(-0.5, Math.min(0.5, pos - m.x));
  }
  m.action = null;
}

/* portée d'attaque et recul d'un mineur : COMBAT + sa stat (reach, knockback ; Lance en fer, 25/10/2026) */
export const reachOf = m => COMBAT.reach + (m.carac?.reach || 0);
export const knockbackOf = m => COMBAT.knock + (m.carac?.knockback || 0);

/* décalage qui éloigne a de b sur leur axe (a doit se recentrer pour se rapprocher) */
export const driftsAway = (a, b) => a.y === b.y ? offX(a) * Math.sign(b.x - a.x) < -EPS
                                   : a.x === b.x ? offY(a) * Math.sign(b.y - a.y) < -EPS : false;

/* recul réellement subi : amount × (1 − résistance/100), résistance bornée à 0–100 % (stat knockRes du mineur,
   o.knockRes d'un mob) */
export function knockOf(t, amount){
  const r = Math.min(100, Math.max(0, Number(t.carac?.knockRes ?? t.knockRes) || 0));
  return amount > 0 ? amount * (1 - r / 100) : 0;
}

/* pousse la cible t, frappée par from, de amount blocs sur l'axe du coup (horizontal si même ligne, vertical si même
   colonne ; même case : du côté où regarde from). canEnter(x,y) : la cible peut-elle entrer dans cette case ? Elle ne
   s'avance jamais vers une case fermée : contre un bloc, elle reste sur place. Renvoie true si elle a changé de case. */
export function push(t, from, amount, canEnter){
  const k = knockOf(t, amount); if(!(k > 0)) return false;
  const vertical = t.x === from.x && t.y !== from.y;
  const ax = vertical ? 'y' : 'x', ko = vertical ? 'ky' : 'kx';
  const fromPos = from[ax] + (from[ko] || 0), here = t[ax] + (t[ko] || 0);
  const dir = Math.sign(here - fromPos) || (vertical ? 1 : (from.face || 1));
  const next = () => vertical ? canEnter(t.x, t.y + dir) : canEnter(t.x + dir, t.y);
  let off = (t[ko] || 0) + dir * k, moved = false;
  while(off * dir > 0.5 + EPS){
    if(!next()){ off = 0; break; }
    t[ax] += dir; off -= dir; moved = true;
  }
  if(off * dir > EPS && !next()) off = 0;   // jamais à cheval sur un bloc
  t[ko] = off;
  return moved;
}
