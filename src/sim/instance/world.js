/* Instance I : la carte (logique pure, partagée avec l'affichage). Réglages INSTANCE (src/config.js).

   Grille w × (h + 1) : lignes 0 à h − 1 = la salle, ligne h = le sol. Hors de la grille (à gauche, à droite, au-dessus) :
   les murs et le plafond, indestructibles. Cases : AIR, ROCK (rebords, plateforme, sol : indestructibles), CAGE (blocs
   des enfermements du roi), SPAWNER (un par rebord). Un rebord du niveau k (1 = le plus bas) est la ligne
   h − k × ledgeEvery, colonnes 0 à ledgeW − 1 (gauche) ou w − ledgeW à w − 1 (droite) ; on s'y tient sur la ligne
   au-dessus ; son spawner est collé au mur, sur cette ligne. */
import { INSTANCE } from '../../config.js';

export const AIR = 0, ROCK = 1, CAGE = 2, SPAWNER = 3;

/* rebords : { id, side ('L' | 'R'), level, row (ligne du rebord), y (ligne où l'on se tient), x0, x1 (colonnes),
   sx (colonne du spawner), mx (case d'où on le casse) } */
export function ledgesOf(cfg = INSTANCE){
  const out = [];
  for(let k = 1; k <= cfg.ledges; k++){
    const row = cfg.h - k * cfg.ledgeEvery;
    out.push({ id: out.length, side: 'L', level: k, row, y: row - 1, x0: 0, x1: cfg.ledgeW - 1, sx: 0, mx: 1 });
    out.push({ id: out.length, side: 'R', level: k, row, y: row - 1, x0: cfg.w - cfg.ledgeW, x1: cfg.w - 1, sx: cfg.w - 1, mx: cfg.w - 2 });
  }
  return out;
}

/* plateforme du roi : { row, x0, x1 } ; le roi s'y tient (sa ligne du bas : row − 1) */
export function platformOf(cfg = INSTANCE){
  const row = cfg.h - cfg.platform.height, x0 = Math.floor((cfg.w - cfg.platform.w) / 2);
  return { row, x0, x1: x0 + cfg.platform.w - 1 };
}

export function genInstance(cfg = INSTANCE){
  const { w, h } = cfg;
  const tiles = Array.from({ length: h + 1 }, (_, y) => new Uint8Array(w).fill(y === h ? ROCK : AIR));
  const ledges = ledgesOf(cfg), plat = platformOf(cfg);
  for(const l of ledges){
    for(let x = l.x0; x <= l.x1; x++) tiles[l.row][x] = ROCK;
    tiles[l.y][l.sx] = SPAWNER;
  }
  for(let x = plat.x0; x <= plat.x1; x++) tiles[plat.row][x] = ROCK;
  return { w, h, tiles, ledges, plat, floorY: h - 1, mid: w / 2 };
}

export const inGrid = (L, x, y) => x >= 0 && x < L.w && y >= 0 && y <= L.h;
export const isOpen = (L, x, y) => inGrid(L, x, y) && L.tiles[y][x] === AIR;
/* direction du centre de la salle depuis la colonne x : +1 (vers la droite) ou −1 */
export const toCenter = (L, x) => x + 0.5 < L.mid ? 1 : -1;
