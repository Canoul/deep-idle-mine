/* Tours de l'Ange et du Démon : génération de la carte (dépend uniquement de la seed et du camp).

   Repère (TOWER) : colonnes 0 à w-1, lignes 0 (haut du ciel) à h (sol). La tour occupe les colonnes x0 à x1
   (murs compris : x0 et x1, indestructibles), du toit (ligne roof) au rez-de-chaussée (ligne floor) ; le sol est la
   ligne h = floor + 1 (incassable, toute la largeur).

   Étages (23/10, Geoffrey) : de bas en haut, étage k = 0 … floors - 1, chacun de floorH lignes (sa ligne du bas :
   bottom(k) = floor - k × (floorH + 1)), surmonté d'une ligne de séparation indestructible (ceil(k) = bottom(k) - floorH)
   percée d'une porte de `gate` cases en stonebrick, collée au mur de gauche ou de droite, en alternance d'un étage à
   l'autre (côté du premier tiré par la seed) : on traverse chaque étage en serpentin. La séparation du dernier étage est
   le toit ; sa porte est aussi au bord. Au-dessus du toit (étage floors, roofH lignes), à ciel ouvert : le boss.
   - étage 0 : vide (les mineurs y apparaissent), une porte de doorH cases en bas de chaque mur ;
   - étages 1 à floors - 1 : en alternance (le premier tiré par la seed) « blocs » (plein de stonebrick) ou « mobs »
     (vide, mobs.count Séraphins / Diablotins posés par la session). */
import { TOWER, STATS } from '../../config.js';
import { mulberry32 } from '../../core/rng.js';

const STEP = () => TOWER.floorH + 1;

export function towerLayout(){
  const { width, floors, sky, margin, boss } = TOWER;
  const w = width + 2 * margin, x0 = margin, x1 = margin + width - 1;
  const roof = sky + boss.h, floor = roof + floors * STEP() - 1, h = floor + 1;
  const bx = x0 + Math.floor((width - boss.w) / 2);
  return { w, h, x0, x1, roof, floor, bx, by: roof - boss.h };
}

/* lignes d'un étage : bas, haut, et sa séparation (plafond) */
export const floorBottom = (L, k) => L.floor - k * STEP();
export const floorTop = (L, k) => floorBottom(L, k) - TOWER.floorH + 1;
export const floorCeil = (L, k) => floorBottom(L, k) - TOWER.floorH;
/* étage d'une ligne de la tour (sa séparation de plafond comprise), -1 hors de la tour ; floors = au-dessus du toit */
export function floorOf(L, y){
  if(y > L.floor) return -1;
  if(y < L.roof) return TOWER.floors;
  return Math.floor((L.floor - y) / STEP());
}
/* la ligne est-elle une séparation (plafond d'un étage, toit compris) ? */
export const isCeil = (L, y) => y >= L.roof && y <= L.floor && (L.floor - y) % STEP() === TOWER.floorH;
/* colonnes de la porte du plafond de l'étage k : side 0 = à gauche, 1 = à droite */
export function gateCols(L, k){
  const left = (L.gate0 + k) % 2 === 0, g = TOWER.gate;
  const a = left ? L.x0 + 1 : L.x1 - g;
  return Array.from({ length: g }, (_, i) => a + i);
}

/* la case (x, y) est-elle dans l'intérieur de la tour (là où l'on creuse et pose des échelles), toit compris ? */
export const inTower = (L, x, y) => x > L.x0 && x < L.x1 && y >= L.roof && y <= L.floor;
/* sur le toit (là où l'on se tient pour combattre) : la ligne au-dessus du toit, entre les murs compris */
export const onRoof = (L, x, y) => y === L.roof - 1 && x >= L.x0 && x <= L.x1;
/* case occupée par le boss (b : { x, y }, sa position ; par défaut celle de départ) */
export const inBoss = (L, x, y, b = { x: L.bx, y: L.by }) => x >= b.x && x < b.x + TOWER.boss.w && y >= b.y && y < b.y + TOWER.boss.h;

export function genTower(seed, side){
  const S = TOWER.sides[side];
  if(!S) throw new Error(`camp de tour inconnu : ${side}`);
  const r = mulberry32(seed ^ TOWER.salt);
  const L = { ...towerLayout(), gate0: r() < 0.5 ? 0 : 1 };
  const firstKind = r() < 0.5 ? 'blocks' : 'mobs';
  const { w, h, x0, x1 } = L;
  const tiles = Array.from({ length: h + 1 }, () => new Uint8Array(w));
  for(let x = 0; x < w; x++) tiles[h][x] = S.hard;                                         // sol
  for(let y = L.roof; y <= L.floor; y++){ tiles[y][x0] = S.hard; tiles[y][x1] = S.hard; }  // murs
  for(let d = 0; d < TOWER.doorH; d++){ tiles[L.floor - d][x0] = 0; tiles[L.floor - d][x1] = 0; }   // portes
  const kinds = ['empty'];
  for(let k = 1; k < TOWER.floors; k++) kinds.push((k % 2 === 1) === (firstKind === 'blocks') ? 'blocks' : 'mobs');
  for(let k = 0; k < TOWER.floors; k++){
    if(kinds[k] === 'blocks')
      for(let y = floorTop(L, k); y <= floorBottom(L, k); y++) for(let x = x0 + 1; x < x1; x++) tiles[y][x] = S.brick;
    const c = floorCeil(L, k), gate = gateCols(L, k);
    for(let x = x0 + 1; x < x1; x++) tiles[c][x] = gate.includes(x) ? S.brick : S.hard;
  }
  return { ...L, side, tiles, kinds };
}

/* lumière des torches (G.torches) : comme dans la mine (src/sim/light.js), de proche en proche dans les cases vides de
   l'intérieur, jamais à travers un bloc ; intensité 1 - distance / (rayon + 1). Renvoie une Map (y × w + x → 0..1). */
export function towerLight(G){
  const map = new Map(), R = STATS.torchRadius;
  const air = (x, y) => inTower(G, x, y) && G.tiles[y][x] === 0;
  for(const T of G.torches || []){
    const dist = new Map([[T.y * G.w + T.x, 0]]), q = [[T.x, T.y]];
    for(let i = 0; i < q.length; i++){
      const [x, y] = q[i], k = y * G.w + x, d = dist.get(k), v = 1 - d / (R + 1);
      if(v > (map.get(k) || 0)) map.set(k, v);
      if(d >= R) continue;
      for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x + dx, ny = y + dy, nk = ny * G.w + nx;
        if(!air(nx, ny) || dist.has(nk)) continue;
        dist.set(nk, d + 1); q.push([nx, ny]);
      }
    }
  }
  return map;
}
