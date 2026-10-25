/* Aura du stuff : une pièce visible sur le corps, identifiée R4+ et portant une vraie rune R4+, émet un halo de la
   qualité la plus basse des deux (AURA, src/config.js). Logique pure, partagée par le jeu et le serveur ; visuel
   seulement (aucun effet sur les stats). Dessin : src/render/aura.js.
   Ce qui circule : { case: qualité } (ex. { torse: 5 }) ; le palier et la couleur se relisent dans la config. */
import { AURA } from '../config.js';
import { SKIN } from '../skins.js';
import { qualityDef } from './piece.js';

const isQ = q => Number.isInteger(q) && q >= AURA.minQ && !!qualityDef(q);

/* qualité de l'aura d'une pièce (4 à 7), 0 si elle n'en émet pas */
export function auraQ(p){
  const r = p?.rune;
  if(!r || r.frag || !isQ(p.q) || !isQ(r.q)) return 0;
  return Math.min(p.q, r.q);
}

/* auras des pièces portées ({ case: pièce }) : seulement les cases dessinées sur le corps, avec une texture */
export function aurasOf(worn){
  const out = {};
  for(const slot of SKIN.layers){
    const p = worn?.[slot], q = SKIN.armor[p?.item] ? auraQ(p) : 0;
    if(q) out[slot] = q;
  }
  return out;
}

/* auras reçues (serveur → navigateur) revérifiées : case dessinée sur le corps, qualité R4 à R7 entière */
export function sanitizeAuras(a){
  const out = {};
  if(!a || typeof a !== 'object') return out;
  for(const slot of SKIN.layers) if(isQ(a[slot])) out[slot] = a[slot];
  return out;
}

/* ce qu'il faut pour dessiner l'aura de qualité q : { tier, color, radius, alpha, pulse, period }, null si aucune */
export function auraLook(q){
  if(!isQ(q)) return null;
  const tier = AURA.tiers[q];
  return { tier, color: qualityDef(q).color, ...AURA.looks[tier] };
}
