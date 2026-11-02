/* Pseudos des joueurs dans les canvas (mine, ville, instances, tours…) : on peut les cacher depuis « Mon compte »,
   pour des captures d'écran sans nom (fiches des stores, 02/11/2026, Jules). Le pseudo, la guilde dessous, le nom de
   ma guilde au-dessus de sa maison et celui de la statue du Carreau. Réglage de ce navigateur seulement (localStorage). */
const KEY = 'dim.showNames';
const load = () => { try { return localStorage.getItem(KEY) !== '0'; } catch(e){ return true; } };
let shown = load();

export const namesShown = () => shown;
export function setNamesShown(v){
  shown = !!v;
  try { localStorage.setItem(KEY, shown ? '1' : '0'); } catch(e){}
}
