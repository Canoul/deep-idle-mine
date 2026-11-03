/* Vers de terre qui naviguent (03/11/2026, Jules) : chaque case de la file pivote dans le sens de la marche. La tête
   regarde là où elle va, chaque anneau s'aligne sur la case qui le précède (vers la tête). Les textures (scripts/gen_worm.py)
   sont dessinées tournées vers la droite. Affichage seulement : lit la vue (w.x, w.y, w.trail), ne la modifie jamais. */

/* direction de a vers b : 0 droite, 1 bas, 2 gauche, 3 haut (comme DIRS de src/sim/worm.js) ; null si même case */
export function dirTo(a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if(!dx && !dy) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
}

/* cases du ver, de la tête à la queue : { x, y, tex, dir }. Sans corps (il vient de naître) : tête vers la droite ;
   deux cases confondues : même direction que la case d'avant */
export function wormCells(w){
  const cells = [[w.x, w.y], ...(w.trail || [])];
  let prev = cells.length > 1 ? dirTo(cells[1], cells[0]) ?? 0 : 0;
  return cells.map(([x, y], i) => {
    const dir = i === 0 ? prev : dirTo(cells[i], cells[i - 1]) ?? prev;
    prev = dir;
    return { x, y, tex: i ? 'worm_body' : 'worm_head', dir };
  });
}

/* dessine une texture tournée vers la droite dans la direction dir ; vers la gauche elle est retournée (la lumière
   reste en haut), vers le bas / le haut elle pivote d'un quart de tour */
export function drawTurned(ctx, img, px, py, dir, T){
  if(!dir){ ctx.drawImage(img, px, py, T, T); return; }
  ctx.save();
  ctx.translate(px + T / 2, py + T / 2);
  if(dir === 2) ctx.scale(-1, 1);
  else ctx.rotate(dir === 1 ? Math.PI / 2 : -Math.PI / 2);
  ctx.drawImage(img, -T / 2, -T / 2, T, T);
  ctx.restore();
}
