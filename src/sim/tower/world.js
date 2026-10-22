/* Tours de l'Ange et du Démon : génération de la carte (dépend uniquement de la seed et du camp).

   Repère (TOWER) : colonnes 0 à w-1, lignes 0 (haut du ciel) à h (sol). La tour occupe les colonnes x0 à x1
   (murs compris : x0 et x1), le toit est la ligne roof, le rez-de-chaussée la ligne floor = roof + height - 1, le sol
   la ligne h = floor + 1 (incassable, toute la largeur).
   - toit (ligne roof) : stonebrick cassable entre les murs (on le perce pour monter dessus), murs indestructibles ;
     on se tient DESSUS, ligne roof - 1 ; le boss (bossW × bossH) est posé au milieu (colonnes bx à bx + bossW - 1) ;
   - intérieur (lignes roof + 1 à floor - 1) : stonebrick, dont unbreakablePct % indestructible ;
   - rez-de-chaussée (ligne floor) : vide, les mineurs y apparaissent ;
   - portes : les doorH lignes du bas des deux murs sont vides.
   Le tirage des blocs indestructibles garantit un chemin de cases cassables du rez-de-chaussée jusqu'au toit (sinon
   on retire, avec un autre tirage). */
import { TOWER } from '../../config.js';
import { mulberry32, shuffle } from '../../core/rng.js';

export function towerLayout(){
  const { width, height, sky, margin, boss } = TOWER;
  const w = width + 2 * margin, x0 = margin, x1 = margin + width - 1;
  const roof = sky + boss.h, floor = roof + height - 1, h = floor + 1;
  const bx = x0 + Math.floor((width - boss.w) / 2);
  return { w, h, x0, x1, roof, floor, bx, by: roof - boss.h };
}

/* la case (x, y) est-elle dans l'intérieur de la tour (là où l'on creuse et pose des échelles), toit compris ? */
export const inTower = (L, x, y) => x > L.x0 && x < L.x1 && y >= L.roof && y <= L.floor;
/* sur le toit (là où l'on se tient pour combattre) : la ligne au-dessus du toit, entre les murs compris */
export const onRoof = (L, x, y) => y === L.roof - 1 && x >= L.x0 && x <= L.x1;
/* case occupée par le boss */
export const inBoss = (L, x, y) => x >= L.bx && x < L.bx + TOWER.boss.w && y >= L.by && y < L.roof;

/* chemin de cases cassables (4 voisins) du rez-de-chaussée au toit ? */
function connected(tiles, L, hard){
  const seen = new Set(), stack = [];
  for(let x = L.x0 + 1; x < L.x1; x++){ stack.push([x, L.floor]); seen.add(L.floor * L.w + x); }
  while(stack.length){
    const [x, y] = stack.pop();
    if(y === L.roof) return true;
    for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx = x + dx, ny = y + dy, k = ny * L.w + nx;
      if(!inTower(L, nx, ny) || seen.has(k) || tiles[ny][nx] === hard) continue;
      seen.add(k); stack.push([nx, ny]);
    }
  }
  return false;
}

export function genTower(seed, side){
  const S = TOWER.sides[side];
  if(!S) throw new Error(`camp de tour inconnu : ${side}`);
  const L = towerLayout(), { w, h, x0, x1, roof, floor } = L;
  for(let attempt = 0; ; attempt++){
    const r = mulberry32((seed ^ TOWER.salt) + attempt * 0x9e3779b9);
    const tiles = Array.from({ length: h + 1 }, () => new Uint8Array(w));
    for(let x = 0; x < w; x++) tiles[h][x] = S.hard;                               // sol
    for(let y = roof; y <= floor; y++){ tiles[y][x0] = S.hard; tiles[y][x1] = S.hard; }   // murs
    for(let d = 0; d < TOWER.doorH; d++){ tiles[floor - d][x0] = 0; tiles[floor - d][x1] = 0; }   // portes
    const inner = [];
    for(let y = roof; y < floor; y++) for(let x = x0 + 1; x < x1; x++){
      tiles[y][x] = S.brick;
      if(y > roof) inner.push([x, y]);                                             // le toit reste cassable
    }
    for(let x = L.bx; x < L.bx + TOWER.boss.w; x++) tiles[roof][x] = S.hard;      // le toit sous le boss ne se perce pas
    shuffle(inner, r);
    const n = Math.round(inner.length * TOWER.unbreakablePct / 100);
    for(let i = 0; i < n; i++){ const [x, y] = inner[i]; tiles[y][x] = S.hard; }
    if(connected(tiles, L, S.hard) || attempt >= 20) return { ...L, side, tiles };
  }
}
