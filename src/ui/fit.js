/* Taille d'affichage d'un canvas de jeu : le plus grand possible dans sa boîte, proportions gardées. Quand on perd peu
   (20 % au plus), on prend un agrandissement entier (×1, ×2…) pour que tous les pixels aient la même taille.
   Sans hauteur imposée (téléphone : la boîte suit le canvas), on se cale sur la largeur. */
export function fitCanvas(cv, box){
  const w = box.clientWidth, h = box.clientHeight > 60 ? box.clientHeight : Infinity;
  if(!w || !cv.width || !cv.height) return;
  const dpr = devicePixelRatio || 1;
  let s = Math.min(w / cv.width, h / cv.height);
  const whole = Math.floor(s * dpr);
  if(whole >= 1 && whole / (s * dpr) >= 0.8) s = whole / dpr;
  const W = Math.floor(cv.width * s), H = Math.floor(cv.height * s), key = W + 'x' + H;
  if(cv._fit !== key){ cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv._fit = key; }
}
