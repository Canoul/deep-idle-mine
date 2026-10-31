/* Bleed (MOBS.bleed, 31/10/2026, Geoffrey) : état donné par le Chien de magma et le Vers de terre. Chaque stack retire
   slow % de vitesse de déplacement (marche, échelle, treuil) et de vitesse de minage, maxStacks au plus. Ils tombent tous
   last s après le dernier reçu. Logique pure, sans DOM. */
import { MOBS } from '../config.js';

const C = MOBS.bleed;

/* un stack de plus ; le compteur de durée repart de zéro */
export function addBleed(G, m){
  m.bleed = Math.min(C.maxStacks, (m.bleed || 0) + 1);
  m.bleedUntil = G.t + C.last;
  m.stats.bled = (m.stats.bled || 0) + 1; G.stats.bled = (G.stats.bled || 0) + 1;
}

/* retire les stacks arrivés au bout de leur durée */
export function tickBleed(G){
  for(const m of G.miners) if(m.bleed && G.t > m.bleedUntil + 1e-9) m.bleed = 0;
}

/* multiplicateur de déplacement et de minage (1 sans stack, 0,5 à 5 stacks) */
export const bleedSlow = m => 1 - (m.bleed || 0) * C.slow / 100;
