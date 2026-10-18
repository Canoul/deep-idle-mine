/* Chargement des textures de textures/ (PNG 16×16). Navigateur uniquement. */
import { TEXTURES } from '../config.js';

export function loadTextures(base='textures/'){
  const tex={};
  for(const n of TEXTURES){ const i=new Image(); i.src=base+n+'.png'; tex[n]=i; }
  return tex;
}
