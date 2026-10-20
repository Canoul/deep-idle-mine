/* Chargement des textures de textures/ (PNG 16×16), skins des mineurs compris (src/skins.js). Navigateur uniquement. */
import { TEXTURES } from '../config.js';
import { SKIN_TEXTURES } from '../skins.js';

export function loadTextures(base='textures/'){
  const tex={};
  for(const n of [...TEXTURES, ...SKIN_TEXTURES]){ const i=new Image(); i.src=base+n+'.png'; tex[n]=i; }
  return tex;
}
