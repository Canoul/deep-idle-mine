/* Tailles d'affichage de la session : la mine, la mine instantanée, et les colonnes autour.
   Quand on perd peu (20 % au plus), on prend un agrandissement entier (×1, ×2…) pour que tous les pixels aient la
   même taille. */

/* Colonne de la session : elle descend jusqu'en bas de l'écran quand la barre d'action (centrée, plus ou moins large
   selon l'écran) ne passe pas sous elle ; sinon elle s'arrête au-dessus (marge du CSS). */
export function clearDock(col, dock){
  if(!col || !dock) return;
  const a = col.getBoundingClientRect(), d = dock.getBoundingClientRect();
  const v = a.right > d.left && a.left < d.right ? '' : '0px';
  if(col._dock !== v){ col.style.marginBottom = v; col._dock = v; }
}

/* agrandissement entier s'il est proche (pixels réguliers) */
function snap(s){
  const dpr = devicePixelRatio || 1, whole = Math.floor(s * dpr);
  return whole >= 1 && whole / (s * dpr) >= 0.8 ? whole / dpr : s;
}

function setSize(cv, s){
  const W = Math.floor(cv.width * s), H = Math.floor(cv.height * s), key = W + 'x' + H;
  if(cv._fit !== key){ cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv._fit = key; }
}

/* Mine de la session : elle remplit la largeur de sa boîte et montre autant de lignes que la hauteur en permet
   (entre minRows et maxRows), sans rien rogner : la caméra sait ce qui est visible (la surface en haut, le mineur
   suivi au milieu). Trop peu de hauteur pour minRows : la mine se cale sur la hauteur. Sans hauteur imposée
   (téléphone), le nombre de lignes ne change pas. tile : taille d'une case dans le canvas (px). */
export function fitMine(cv, box, renderer, { minRows, maxRows }, tile){
  const w = box.clientWidth, h = box.clientHeight > 60 ? box.clientHeight : 0;
  if(!w || !cv.width) return;
  let s = snap(w / cv.width);
  if(h){
    let rows = Math.floor(h / (tile * s));
    if(rows < minRows){ rows = minRows; s = h / (rows * tile); }
    renderer.setRows(Math.min(rows, maxRows));
  }
  setSize(cv, s);
}

/* Mine instantanée (caméra qui suit le mineur) : la vue remplit la largeur de sa boîte (MI.camCols colonnes) et montre
   autant de lignes que la hauteur en permet (renderer.setRows borne entre MI.camMinRows et la mine entière). Trop peu
   de hauteur : la vue se cale sur la hauteur. Sans hauteur imposée (téléphone), le nombre de lignes ne change pas. */
export function fitInstant(cv, box, renderer, tile){
  const w = box.clientWidth, h = box.clientHeight > 60 ? box.clientHeight : 0;
  if(!w || !cv.width) return;
  let s = snap(w / cv.width);
  if(h){
    renderer.setRows(Math.floor(h / (tile * s)));
    if(renderer.rows * tile * s > h) s = h / (renderer.rows * tile);
  }
  setSize(cv, s);
}

/* Tour : tout le canvas, le plus grand possible dans sa boîte, proportions gardées. Sans hauteur imposée
   (téléphone : la boîte suit le canvas), on se cale sur la largeur. */
export function fitCanvas(cv, box){
  const w = box.clientWidth, h = box.clientHeight > 60 ? box.clientHeight : Infinity;
  if(!w || !cv.width || !cv.height) return;
  setSize(cv, snap(Math.min(w / cv.width, h / cv.height)));
}
