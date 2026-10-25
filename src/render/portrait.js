/* Portrait d'un mineur hors de la mine (barre du haut, lobby, onglet Stuff) : le même sprite que dans la mine, corps
   et équipement visible (src/skins.js) avec l'aura de ses pièces (src/render/aura.js), sur un canvas 16×16 que le CSS agrandit en pixels nets. Lit, ne modifie rien. */
import { SKIN, armorPieces } from '../skins.js';
import { drawAura } from './aura.js';

const IMG = {};
const load = n => IMG[n] ??= new Promise(res => {
  const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = `textures/${n}.png`;
});

/* équipement porté (onglet Stuff : { case: { item, … } }) → look du sprite ({ case: nom de l'objet }) */
export const lookOf = worn => Object.fromEntries(Object.entries(worn ?? {}).filter(([, p]) => p?.item).map(([slot, p]) => [slot, p.item]));

/* dessine le mineur dans cv (16×16) ; look : { case: objet } (vide = tenue de base) ; auras : { case: qualité }.
   Avec une aura, le portrait est redessiné à chaque image (le halo pulse) tant qu'il est affiché et inchangé. */
export async function drawPortrait(cv, look = {}, auras = {}){
  const pieces = armorPieces(look), names = [SKIN.body, ...pieces.map(([, n]) => n)];
  const key = names.join('|') + '#' + pieces.map(([slot]) => auras?.[slot] || 0).join('');
  if(cv._look === key) return;
  cv._look = key;
  const imgs = await Promise.all(names.map(load));
  if(cv._look !== key) return;                     // redemandé entre-temps avec un autre équipement
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const glow = pieces.some(([slot]) => auras?.[slot]);
  const paint = now => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    /* l'aura des pièces d'abord, derrière le corps (imgs[0]) : elle ne masque rien */
    pieces.forEach(([slot], k) => { if(auras?.[slot]) drawAura(ctx, imgs[k + 1], auras[slot], 0, 0, cv.width, now); });
    for(const i of imgs) if(i) ctx.drawImage(i, 0, 0, cv.width, cv.height);
  };
  paint(performance.now());
  if(!glow) return;
  const loop = now => { if(cv._look !== key || !cv.isConnected) return; paint(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
