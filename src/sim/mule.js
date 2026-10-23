/* Mule (skill Logisticien, étage 4) : le sac posé à côté du bas du treuil.
   Spec : docs/superpowers/specs/2026-10-23-mule-design.md ; réglages : MULE (src/config.js).

   G.mule = null tant qu'aucun logisticien avec Mule n'a posé de treuil, puis
   { carrier : id du logisticien qui le porte et le pose, placed : posé dans la mine (sinon transporté),
     x, y : sa case quand il est posé, inv : { objet: quantité }, by : { id de mineur: { objet: quantité } } (qui a
     déposé quoi : le bilan crédite le déposant), load : pods occupés }.
   Le sac n'a pas de collision (on passe à travers), ne tombe pas, et les mobs l'ignorent : ce n'est pas un bloc de
   la grille, seulement cet objet. Le contenu ne compte jamais dans les pods du logisticien.
   Tout est de la simulation (côté serveur, une seule copie) : le navigateur ne fait que l'afficher. */
import { W, MULE, ITEMS, BLOCKS, BARRIER } from '../config.js';
import { tileAt, isAir } from './world.js';
import { log } from './log.js';

/* poids d'un objet dans les pods (comme au ramassage : sans poids au catalogue, 1) */
export const itemW = name => (Object.hasOwn(ITEMS, name) ? ITEMS[name].w : undefined) ?? 1;
/* capacité : MULE.capacityPct × la somme des pods des logisticiens présents qui ont Mule */
export const muleCap = G => Math.round(MULE.capacityPct*G.miners.filter(m => m.skill?.mule).reduce((s, m) => s + m.carac.pods, 0));
export const mulePlaced = G => !!G.mule?.placed;
export const isCarrier = (G, m) => !!G.mule && G.mule.carrier === m.id;
/* place libre dans le sac posé (0 s'il n'est pas posé) */
export const muleFree = G => mulePlaced(G) ? Math.max(0, muleCap(G) - G.mule.load) : 0;
/* au moins un objet de m tient dans la place libre (un résidu pèse 6 : 3 pods libres ne suffisent pas) */
export const muleFits = (G, m) => { const free = muleFree(G); return Object.keys(m.inv).some(k => m.inv[k] > 0 && itemW(k) <= free + 1e-9); };
/* au contact du sac (sur sa case ou à côté) : c'est d'ici qu'on dépose et qu'on ramasse */
export const nearMule = (G, x, y) => mulePlaced(G) && Math.abs(x - G.mule.x) + Math.abs(y - G.mule.y) <= 1;

/* le logisticien m vient de poser le treuil : il aura un sac à poser s'il a Mule et que le sac est à lui (ou qu'il
   n'y en a pas encore). Renvoie la case où le poser ({x,y}) ou null. */
export function muleAfterWinch(G, m){
  if(!m.skill?.mule || !G.winch) return null;
  if(G.mule && G.mule.carrier !== m.id){
    if(G.miners.some(o => o.id === G.mule.carrier)) return null;   // le sac d'un autre logisticien encore là
    G.mule.carrier = m.id;                                          // (ne devrait pas arriver : il est versé au départ)
  }
  G.mule ??= { carrier:m.id, placed:false, x:null, y:null, inv:{}, by:{}, load:0 };
  if(G.mule.placed) pickMule(G, m);   // encore posé plus haut (il ne l'a pas croisé en descendant) : il le reprend
  const spot = muleSpot(G);
  if(!spot) log(G, `🎒 ${m.name} ne peut pas poser son sac : aucune place à côté du bas du treuil`);
  return spot;
}

/* case du sac : à droite du bas du treuil, sinon à gauche ; une case vide, ou un bloc qui se casse (il le mine).
   Jamais un mimic caché, ni un bloc incassable ou une barrière. */
export function muleSpot(G){
  const y = G.winch.bottom;
  for(const dx of [1, -1]){
    const x = G.winch.x + dx, t = tileAt(G, x, y);
    if(x < 0 || t === undefined || t === BARRIER || G.mimicCells.has(y*W + x)) continue;
    if(isAir(G, x, y) || !BLOCKS[t].unbreakable) return { x, y };
  }
  return null;
}

/* pose le sac (transporté) sur la case (x,y) */
export function placeMule(G, m, x, y){
  Object.assign(G.mule, { placed:true, x, y });
  log(G, `🎒 ${m.name} pose son sac en bas du treuil (couche ${y})`);
}

/* ramasse le sac posé : il est transporté (son contenu ne pèse rien pour le logisticien) */
export function pickMule(G, m){
  if(!mulePlaced(G)) return;
  Object.assign(G.mule, { placed:false, x:null, y:null });
  log(G, `🎒 ${m.name} ramasse son sac` + (G.mule.load > 0 ? ` (${fmtLoad(G.mule.load)} pods)` : ''));
}

/* le mineur m dépose dans le sac posé autant que la place le permet (dépôt partiel) ; renvoie les pods déposés */
export function depositToMule(G, m){
  if(!mulePlaced(G)) return 0;
  const b = G.mule, cap = muleCap(G), by = (b.by[m.id] ??= {});
  let moved = 0;
  for(const k of Object.keys(m.inv)){
    const have = m.inv[k], w = itemW(k);
    const n = w > 0 ? Math.min(have, Math.floor((cap - b.load + 1e-9)/w)) : have;
    if(!(n > 0)) continue;
    b.inv[k] = (b.inv[k] || 0) + n; by[k] = (by[k] || 0) + n;
    b.load += w*n; m.load -= w*n; moved += w*n;
    if(have === n) delete m.inv[k]; else m.inv[k] = have - n;
  }
  if(!Object.keys(m.inv).length) m.load = 0;                       // pas de reste d'arrondi sur un sac vide
  if(moved > 0){ G.stats.muleDeposits = (G.stats.muleDeposits || 0) + 1; G.stats.mulePods = (G.stats.mulePods || 0) + moved; }
  if(moved > 0) log(G, `🎒 ${m.name} dépose ${fmtLoad(moved)} pods dans le sac (${fmtLoad(b.load)} / ${cap})`);
  return moved;
}

/* vide le sac dans le coffre commun ; chaque objet compte pour le mineur qui l'a déposé (G.chestBy) */
export function emptyMule(G, who){
  const b = G.mule; if(!b || !Object.keys(b.inv).length) return;
  for(const k in b.inv) G.chest[k] = (G.chest[k] || 0) + b.inv[k];
  for(const id in b.by){ const mine = (G.chestBy[id] ??= {});
    for(const k in b.by[id]) mine[k] = (mine[k] || 0) + b.by[id][k]; }
  G.stats.muleEmptied = (G.stats.muleEmptied || 0) + b.load;
  log(G, `🎒 ${who} vide le sac dans le coffre (${fmtLoad(b.load)} pods)`);
  b.inv = {}; b.by = {}; b.load = 0;
}

/* le porteur quitte la session : le contenu part dans le coffre et le sac disparaît */
export function muleOnLeave(G, m){
  if(!isCarrier(G, m)) return;
  emptyMule(G, `Le sac de ${m.name}`);
  G.mule = null;
}

const fmtLoad = n => String(Math.round(n*10)/10).replace('.', ',');
