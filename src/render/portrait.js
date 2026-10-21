/* Portrait d'un mineur hors de la mine (barre du haut, lobby, onglet Stuff) : le même sprite que dans la mine, corps
   et équipement visible (src/skins.js), sur un canvas 16×16 que le CSS agrandit en pixels nets. Lit, ne modifie rien. */
import { SKIN, armorLayers } from '../skins.js';

const IMG = {};
const load = n => IMG[n] ??= new Promise(res => {
  const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = `textures/${n}.png`;
});

/* équipement porté (onglet Stuff : { case: { item, … } }) → look du sprite ({ case: nom de l'objet }) */
export const lookOf = worn => Object.fromEntries(Object.entries(worn ?? {}).filter(([, p]) => p?.item).map(([slot, p]) => [slot, p.item]));

/* dessine le mineur dans cv (16×16) ; look : { case: objet } (vide = tenue de base) */
export async function drawPortrait(cv, look = {}){
  const names = [SKIN.body, ...armorLayers(look)], key = names.join('|');
  if(cv._look === key) return;
  cv._look = key;
  const imgs = await Promise.all(names.map(load));
  if(cv._look !== key) return;                     // redemandé entre-temps avec un autre équipement
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  for(const i of imgs) if(i) ctx.drawImage(i, 0, 0, cv.width, cv.height);
}
