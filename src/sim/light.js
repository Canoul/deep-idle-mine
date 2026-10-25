/* Lumière des torches : se propage de proche en proche dans les cases creusées (air), jamais à travers les murs.
   Torches infinies. Intensité = 1 - distance/(rayon+1) ; rayon = celui du mineur qui l'a posée (T.r, stat torchRadius ;
   STATS.torchRadius pour une torche plus ancienne). Recalculée à la pose d'une torche et quand un bloc change. */
import { W, STATS } from '../config.js';
import { DIRS, isAir } from './world.js';

export function updateLight(G){
  const map=new Map();
  for(const T of G.torches){
    const R=T.r ?? STATS.torchRadius;
    const dist=new Map([[T.y*W+T.x,0]]), q=[[T.x,T.y]];
    for(let qi=0;qi<q.length;qi++){
      const [x,y]=q[qi], k=y*W+x, d=dist.get(k), v=1-d/(R+1);
      if(v>(map.get(k)||0)) map.set(k,v);
      if(d>=R) continue;
      for(const [dx,dy] of DIRS){
        const nx=x+dx, ny=y+dy; if(ny<1||!isAir(G,nx,ny)) continue;
        const nk=ny*W+nx; if(dist.has(nk)) continue;
        dist.set(nk,d+1); q.push([nx,ny]);
      }
    }
  }
  G.light=map;
}

/* luminosité 0..1 d'une case : 1 en surface (le jour), sinon donnée par les torches posées */
export const lumAt = (G,x,y) => y===0 ? 1 : (G.light.get(y*W+x)||0);

/* lumière affichée : max de la case et de ses voisines (un mur éclairé par la galerie voisine) */
export function lightShown(G,x,y){
  let l=G.light.get(y*W+x)||0;
  for(const [dx,dy] of DIRS){ const v=G.light.get((y+dy)*W+x+dx)||0; if(v>l) l=v; }
  return l;
}
