/* Fabrique une mine à partir d'un dessin texte, pour tester des situations précises.
   Légende : ' ' vide · '#' pierre · 'd' terre · 'c' charbon · 'H' échelle (case vide) · '=' passerelle · '@' mineur (case vide)
   La ligne 0 du dessin est la surface. Les lignes plus courtes que W sont complétées en pierre.
   Sous la dernière ligne : barrière (area suivante verrouillée). */
import { W, IDS, BRIDGE } from '../src/config.js';
import { newSession } from '../src/sim/session.js';

const CH = { ' ':0, '#':IDS.stone, 'd':IDS.dirt, 'c':IDS.coal, 'H':0, '=':BRIDGE, '@':0 };

export function worldFrom(rows, opts={}){
  const G = newSession(opts.seed ?? 1, { miners: opts.miners ?? 1 });
  G.tiles=[]; G.ladder=[]; G.seen=[]; G.mobs=[]; G.torches=[]; G.light=new Map();
  let at=null;
  rows.forEach((line,y)=>{
    const t=new Uint8Array(W).fill(y===0?0:IDS.stone), l=new Uint8Array(W);
    for(let x=0;x<W;x++){
      const c = x<line.length ? line[x] : (y===0?' ':'#');
      if(!(c in CH)) throw new Error(`caractère inconnu « ${c} »`);
      t[x]=CH[c]; if(c==='H') l[x]=1; if(c==='@') at={x,y};
    }
    G.tiles.push(t); G.ladder.push(l); G.seen.push(new Uint8Array(W).fill(1));
  });
  G.areas[0].oreMined=0; G.areas[0].oreTotal=1e9;   // pas de déblocage pendant les tests
  if(at) for(const m of G.miners){ m.x=at.x; m.y=at.y; }
  return G;
}

/* avance la simulation de n ticks */
import { tick } from '../src/sim/session.js';
export function run(G, n){ for(let i=0;i<n && !G.over;i++) tick(G); return G; }
