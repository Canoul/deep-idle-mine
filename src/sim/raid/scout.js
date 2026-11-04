/* Raid : explorer le noir (04/11/2026, Geoffrey : « pour chercher l'Indice, les mineurs doivent explorer des zones pas
   découvertes, pas miner le bloc le plus proche » ; avant, sans Indice en vue, ils creusaient tout droit jusqu'au fond).
   Les lignes où peuvent se cacher des Indices (sous RAID.mine.clueMinDepth dans l'area 0) sont découpées en zones de
   RAID.mine.scout.zone cases de côté. Sans Indice connu, un mineur va au centre d'une zone encore dans le noir que
   personne d'autre n'explore : la plus proche par le chemin. Arrivé au centre, la zone est faite pour tout le monde
   (G.raid.scouted). Une zone dont moins de minUnseen des cases restent dans le noir ne vaut plus le trajet.
   Logique pure (lue par src/sim/ai.js). */
import { RAID, W, AREA_Y0, AREA_H } from '../../config.js';

const S = () => RAID.mine.scout;
const top = () => AREA_Y0 + Math.min(AREA_H - 1, RAID.mine.clueMinDepth);   // premières lignes sans Indice (src/sim/world.js genRaidArea)
const bottom = () => AREA_Y0 + RAID.mine.areas * AREA_H - 1;
const cols = () => Math.ceil(W / S().zone);

/* zone n° id : bornes (incluses) et centre */
export function zoneOf(id){
  const z = S().zone, zx = id % cols(), zy = Math.floor(id / cols());
  const x0 = zx * z, y0 = top() + zy * z, x1 = Math.min(W - 1, x0 + z - 1), y1 = Math.min(bottom(), y0 + z - 1);
  return { id, x0, y0, x1, y1, cx: Math.floor((x0 + x1) / 2), cy: Math.floor((y0 + y1) / 2) };
}
export const zoneCount = () => cols() * Math.ceil((bottom() - top() + 1) / S().zone);
/* le mineur est arrivé : à une case au plus du centre */
export const atCore = (z, x, y) => Math.abs(x - z.cx) <= 1 && Math.abs(y - z.cy) <= 1;

/* part des cases de la zone encore dans le noir */
export function unseenShare(G, z){
  let n = 0, k = 0;
  for(let y = z.y0; y <= z.y1; y++) for(let x = z.x0; x <= z.x1; x++){ n++; if(!G.seen[y]?.[x]) k++; }
  return n ? k / n : 0;
}
/* la zone vaut encore le trajet */
export const zoneOpen = (G, id) => !G.raid?.scouted?.has(id) && unseenShare(G, zoneOf(id)) >= S().minUnseen;
export function markScouted(G, id){ (G.raid.scouted ??= new Set()).add(id); }

/* la zone où aller : ouverte, pas visée par un autre mineur (s'il n'en reste que des visées, la plus proche quand même),
   la plus proche par le chemin (dist : r.dist d'une recherche depuis le mineur, indexée y × W + x). null : plus rien. */
export function pickZone(G, m, dist){
  const taken = new Set(G.miners.filter(o => o !== m && o.scout != null).map(o => o.scout));
  let best = null, bd = Infinity, bestT = null, bdT = Infinity;
  for(let id = 0; id < zoneCount(); id++){
    if(!zoneOpen(G, id)) continue;
    const z = zoneOf(id);
    let d = Infinity;
    for(let y = z.cy - 1; y <= z.cy + 1; y++) for(let x = z.cx - 1; x <= z.cx + 1; x++) if(x >= 0 && x < W) d = Math.min(d, dist[y * W + x] ?? Infinity);
    if(!(d < Infinity)) continue;
    if(taken.has(id)){ if(d < bdT){ bdT = d; bestT = id; } continue; }
    if(d < bd){ bd = d; best = id; }
  }
  return best ?? bestT;
}
