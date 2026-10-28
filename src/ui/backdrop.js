/* Fond de page (28/10/2026, Geoffrey) : pendant une session, la mine en cours remplace le mur du fond, en grand,
   assombrie (style.css .bgSession) pour rester un décor. Seulement le dessin de la mine : aucun panneau d'infos.
   Pas dessinée sur l'onglet Session (la mine y est déjà). Option du joueur dans « Mon compte », gardée dans ce
   navigateur (activée par défaut). Un canvas par mode de jeu : chaque moteur de dessin garde la taille du sien. */
import { CAMERA } from '../config.js';
import { createRenderer, TILE } from '../render/canvas.js';
import { createInstantRenderer, MI_TILE } from '../render/instant.js';
import { createTowerRenderer } from '../render/tower.js';
import { createInstanceRenderer } from '../render/instance.js';

const KEY = 'dim.bgSession';
const read = () => { try { return localStorage.getItem(KEY) !== '0'; } catch(e){ return true; } };
const write = on => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){} };

/* moteur de dessin de chaque mode : draw(G, moi, suivi) ; fit(cv, renderer) : assez de lignes pour couvrir l'écran */
const rowsFor = (cv, tile) => Math.min(CAMERA.maxRows, Math.ceil(cv.width / tile * innerHeight / Math.max(1, innerWidth)));
const MODES = {
  mine:     { make: createRenderer,         draw: (r, G, me, follow) => r.draw(G, follow), tile: TILE },
  mi:       { make: createInstantRenderer,  draw: (r, G, me) => r.draw(G, me),            tile: MI_TILE },
  tower:    { make: createTowerRenderer,    draw: (r, G, me) => r.draw(G, me) },
  instance: { make: createInstanceRenderer, draw: (r, G, me) => r.draw(G, me) },
};
const modeOf = G => G.mode === 'mi' || G.mode === 'tower' || G.mode === 'instance' ? G.mode : 'mine';

export function createBackdrop(root){
  let on = read(), shownMode = null;
  const made = {};                                     // mode → { cv, r }
  function get(mode){
    if(made[mode]) return made[mode];
    const cv = document.createElement('canvas');
    root.appendChild(cv);
    return made[mode] = { cv, r: MODES[mode].make(cv), rows: 0 };
  }
  function show(mode){
    if(mode === shownMode) return;
    shownMode = mode;
    root.hidden = !mode;
    for(const [k, m] of Object.entries(made)) m.cv.hidden = k !== mode;
  }
  /* à chaque image : G = partie affichée (null hors session), visible = pas sur l'onglet Session */
  function draw(G, visible, me, follow){
    if(!on || !G || !visible) return show(null);
    const mode = modeOf(G), m = get(mode), tile = MODES[mode].tile;
    if(tile && m.r.setRows){                           // mine qui défile : autant de lignes que l'écran en montre
      const rows = rowsFor(m.cv, tile);
      if(rows !== m.rows){ m.r.setRows(rows); m.rows = rows; }
    }
    MODES[mode].draw(m.r, G, me, follow);
    show(mode);
  }
  return {
    draw,
    get on(){ return on; },
    set(v){ on = !!v; write(on); if(!on) show(null); },
  };
}
