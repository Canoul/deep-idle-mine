/* Hasard déterministe : même seed → même suite de nombres. */

export function mulberry32(a){
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

/* mélange deux entiers (seed + numéro d'area) en une nouvelle seed */
export function hash(a,b){
  let h=Math.imul(a^0x85ebca6b,0xcc9e2d51)^Math.imul(b+0x1b873593,0x85ebca6b);
  h^=h>>>13; h=Math.imul(h,0xc2b2ae35);
  return (h^h>>>16)>>>0;
}

export function shuffle(a,r){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
}
