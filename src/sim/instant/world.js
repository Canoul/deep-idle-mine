/* Mine instantanée : génération de la mine (dépend uniquement de la seed).
   Ligne 0 = surface (vide), lignes 1 à h = la mine, que des minerais. Les tas de plumes d'ange sont des cases vides
   portant un tas (G.feathers : case → nombre de plumes), comme les échelles et les torches de la mine normale. */
import { INSTANT_MINE as MI, IDS } from '../../config.js';
import { mulberry32, shuffle } from '../../core/rng.js';

/* composition EXACTE (pas un tirage par case) : chaque mine a les mêmes quantités, à l'arrondi près
   (50×50 : 999 charbons, 675 fers, 500 ors, 125 graphites, 25 diamants, 75 mithrils, 38 cobalts, 38 thoriums, 25 tas de plumes ;
   le dernier minerai de MI.comp perd ce qui dépasse à cause des arrondis) ; seules les positions changent */
export function genInstantMine(seed, w=MI.w, h=MI.h){
  const r = mulberry32(seed ^ 0x1a57a11e), n = w*h;
  const cells = [];
  const nFeather = Math.round(n*MI.feather/100);
  for(let i=0;i<nFeather;i++) cells.push(-1);
  for(const [k, pct] of Object.entries(MI.comp)){
    const c = Math.round(n*pct/100);
    for(let i=0;i<c && cells.length<n;i++) cells.push(IDS[k]);
  }
  const fill = IDS[Object.entries(MI.comp).sort((a,b) => b[1]-a[1])[0][0]];   // arrondis : complété avec le minerai le plus fréquent
  while(cells.length<n) cells.push(fill);
  shuffle(cells, r);
  const tiles = [new Uint8Array(w)], feathers = new Map();
  for(let y=1;y<=h;y++){
    const row = new Uint8Array(w);
    for(let x=0;x<w;x++){
      const c = cells[(y-1)*w+x];
      if(c<0) feathers.set(y*w+x, MI.featherMin + Math.floor(r()*(MI.featherMax-MI.featherMin+1)));
      else row[x] = c;
    }
    tiles.push(row);
  }
  return { w, h, tiles, feathers };
}

/* colonnes de départ : n mineurs espacés régulièrement sur la surface */
export function spawnColumns(n, w=MI.w){
  return Array.from({ length:n }, (_, i) => Math.min(w-1, Math.floor((i+0.5)*w/n)));
}
