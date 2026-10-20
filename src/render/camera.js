/* Caméra de la session (affichage seulement) : elle suit un mineur, ou reste où le joueur l'a déplacée
   (défilement libre, pour naviguer dans la mine). La mine tient dans la largeur de l'écran : la caméra ne bouge
   que verticalement. Logique pure, testée sans navigateur (tests/camera.test.js). */
import { CAMERA } from '../config.js';

/* viewRows : lignes visibles à l'écran */
export function createCamera(viewRows){
  const cam = { y: CAMERA.top, free: false };
  /* plus bas qu'on puisse aller : le fond de la mine connue (lastRow) visible avec une petite marge */
  const bottom = lastRow => Math.max(CAMERA.top, lastRow + 1 + CAMERA.margin - viewRows);
  const clamp = (y, lastRow) => Math.max(CAMERA.top, Math.min(bottom(lastRow), y));

  return {
    get y(){ return cam.y; },
    get free(){ return cam.free; },
    /* à chaque image : en mode suivi, glisse vers le mineur suivi (ligne fy) ; en mode libre, ne bouge pas */
    update(fy, lastRow){
      if(cam.free){ cam.y = clamp(cam.y, lastRow); return cam.y; }
      const tgt = Math.max(CAMERA.top, fy - viewRows/2 + 2);
      cam.y += (tgt - cam.y) * CAMERA.ease;
      return cam.y;
    },
    /* le joueur déplace la caméra de rows lignes (négatif = vers le haut) : elle ne suit plus personne */
    pan(rows, lastRow){
      if(!Number.isFinite(rows) || rows === 0) return;
      cam.free = true;
      cam.y = clamp(cam.y + rows, lastRow);
    },
    /* revient au mineur suivi (glissade depuis la position actuelle) */
    follow(){ cam.free = false; },
  };
}

/* mineur suivi : par son id (stable, même si un joueur quitte la partie) ; à défaut, le premier */
export const followedMiner = (miners, id) => miners.find(m => m.id === id) ?? miners[0];
