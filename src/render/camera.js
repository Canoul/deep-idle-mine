/* Caméra de la session (affichage seulement) : elle suit un mineur, ou reste où le joueur l'a déplacée
   (défilement libre, pour naviguer dans la mine). Zoom ×1 = la mine tient dans la largeur de l'écran et la caméra ne
   bouge que verticalement ; zoomée (30/10, pincer sur mobile), elle bouge aussi à l'horizontale.
   Logique pure, testée sans navigateur (tests/camera.test.js). */
import { CAMERA, W } from '../config.js';

/* viewRows : lignes visibles à l'écran au zoom ×1 (changeable : la vue s'adapte à la hauteur de la fenêtre, setRows) ;
   cols : colonnes de la mine (largeur affichée au zoom ×1) */
export function createCamera(viewRows, cols = W){
  const cam = { y: CAMERA.top, x: 0, z: 1, free: false };
  /* bornes horizontales (prison, 30/10/2026 : colonnes entre les barreaux) et zoom minimal (celui où elles remplissent la
     largeur) ; mine : toute la largeur, zoom ×1 */
  const box = { lo: 0, hi: cols, zmin: 1, key: '' };
  const vr = () => viewRows / cam.z, vc = () => cols / cam.z;   // lignes et colonnes visibles au zoom actuel
  /* plus bas qu'on puisse aller : le fond de la mine connue (lastRow) visible avec une petite marge */
  const bottom = lastRow => Math.max(CAMERA.top, lastRow + 1 + CAMERA.margin - vr());
  const clamp = (y, lastRow) => Math.max(CAMERA.top, Math.min(bottom(lastRow), y));
  const clampX = x => Math.max(box.lo, Math.min(box.hi - vc(), x));
  let last = 0;   // dernière ligne connue (pour borner un zoom ou un glissé entre deux images)

  return {
    get y(){ return cam.y; },
    get x(){ return cam.x; },
    get zoom(){ return cam.z; },
    get free(){ return cam.free; },
    /* à chaque image : en mode suivi, glisse vers le mineur suivi (case fx, fy) ; en mode libre, ne bouge pas */
    update(fy, lastRow, fx = cols / 2){
      last = lastRow;
      if(cam.free){ cam.y = clamp(cam.y, lastRow); cam.x = clampX(cam.x); return cam.y; }
      const tgt = Math.max(CAMERA.top, fy - vr()/2 + 2), tx = clampX(fx + 0.5 - vc()/2);
      cam.y += (tgt - cam.y) * CAMERA.ease;
      cam.x += (tx - cam.x) * CAMERA.ease;
      return cam.y;
    },
    /* le joueur déplace la caméra de rows lignes (négatif = vers le haut) et cols colonnes : elle ne suit plus personne */
    pan(rows, lastRow = last, colsBy = 0){
      if(!Number.isFinite(rows) || !Number.isFinite(colsBy) || (rows === 0 && colsBy === 0)) return;
      cam.free = true;
      cam.y = clamp(cam.y + rows, lastRow);
      cam.x = clampX(cam.x + colsBy);
    },
    /* zoom multiplié par f, autour du point de l'écran (fx, fy) en fraction de la vue (0..1) : ce point ne bouge pas.
       Ne change pas le mode (en suivi, la caméra reste sur le mineur) */
    zoomBy(f, fx = 0.5, fy = 0.5){
      if(!Number.isFinite(f) || f < 0) return;   // f = 0 : retour au ×1
      const z = Math.max(box.zmin, Math.min(Math.max(CAMERA.maxZoom, box.zmin), cam.z * f));
      if(z === cam.z) return;
      const wx = cam.x + fx * vc(), wy = cam.y + fy * vr();
      cam.z = z;
      cam.x = clampX(wx - fx * vc());
      cam.y = clamp(wy - fy * vr(), last);
    },
    /* colonnes visibles bornées à b = { x0, x1 } (prison), ou toute la mine (null) ; un changement remet le zoom au minimum */
    setBox(b){
      const key = b ? b.x0 + ':' + b.x1 : '';
      if(key === box.key) return;
      box.key = key; box.lo = b ? b.x0 : 0; box.hi = b ? b.x1 + 1 : cols; box.zmin = cols / (box.hi - box.lo);
      cam.z = box.zmin; cam.x = clampX(box.lo);
    },
    /* revient au mineur suivi (glissade depuis la position actuelle) */
    follow(){ cam.free = false; },
    /* nombre de lignes visibles (fenêtre plus ou moins haute) */
    setRows(n){ if(Number.isInteger(n) && n > 0) viewRows = n; },
    get rows(){ return viewRows; },
  };
}

/* mineur suivi : par son id (stable, même si un joueur quitte la partie) ; à défaut, le premier */
export const followedMiner = (miners, id) => miners.find(m => m.id === id) ?? miners[0];
