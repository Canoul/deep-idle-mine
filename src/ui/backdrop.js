/* Fond de page (28/10/2026, Geoffrey) : pendant une session, la mine en cours remplace le mur du fond, assombrie
   (style.css .bgSession) pour rester un décor. Seulement le dessin de la mine : aucun panneau d'infos.
   Pas dessinée sur l'onglet Session (la mine y est déjà). Option du joueur dans « Mon compte », gardée dans ce
   navigateur (activée par défaut). Un canvas par mode de jeu : chaque moteur de dessin garde la taille du sien.
   Même place et même échelle qu'en session (28/10, Geoffrey : changer d'onglet ne doit pas faire sauter l'image) :
   measure() relève le canvas de la session (position à l'écran, taille, lignes) quand l'onglet Session est affiché ;
   la mesure est gardée dans le navigateur avec la taille de la fenêtre. Sans mesure valable (jamais ouvert l'onglet
   Session à cette taille de fenêtre) : la mine couvre l'écran (.cover). */
import { CAMERA } from '../config.js';
import { createRenderer, TILE } from '../render/canvas.js';
import { createInstantRenderer, MI_TILE } from '../render/instant.js';
import { createTowerRenderer } from '../render/tower.js';
import { createInstanceRenderer } from '../render/instance.js';

const KEY = 'dim.bgSession', PLACE_KEY = 'dim.bgPlace';
const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch(e){ return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };

/* moteur de dessin de chaque mode : draw(r, G, moi, suivi) ; tile : la mine défile (lignes réglables) */
const rowsFor = (cv, tile) => Math.min(CAMERA.maxRows, Math.ceil(cv.width / tile * innerHeight / Math.max(1, innerWidth)));
const MODES = {
  mine:     { make: createRenderer,         draw: (r, G, me, follow) => r.draw(G, follow), tile: TILE },
  mi:       { make: createInstantRenderer,  draw: (r, G, me) => r.draw(G, me),            tile: MI_TILE },
  tower:    { make: createTowerRenderer,    draw: (r, G, me) => r.draw(G, me) },
  instance: { make: createInstanceRenderer, draw: (r, G, me) => r.draw(G, me) },
};
export const modeOf = G => G.mode === 'mi' || G.mode === 'tower' || G.mode === 'instance' ? G.mode : 'mine';

/* mesure relue : { mode: { x, y, w, h, rows, vw, vh } }, seulement des nombres */
function readPlaces(){
  try {
    const raw = JSON.parse(load(PLACE_KEY, '{}')), out = {};
    for(const k of Object.keys(MODES)){
      const p = raw?.[k];
      if(p && ['x', 'y', 'w', 'h', 'rows', 'vw', 'vh'].every(f => Number.isFinite(p[f])) && p.w > 0 && p.h > 0) out[k] = p;
    }
    return out;
  } catch(e){ return {}; }
}

export function createBackdrop(root){
  let on = load(KEY, '1') !== '0', shownMode = null;
  const places = readPlaces();
  const made = {};                                     // mode → { cv, r, rows, key }
  function get(mode){
    if(made[mode]) return made[mode];
    const cv = document.createElement('canvas');
    root.appendChild(cv);
    return made[mode] = { cv, r: MODES[mode].make(cv), rows: 0, key: '' };
  }
  function show(mode){
    if(mode === shownMode) return;
    shownMode = mode;
    root.hidden = !mode;
    for(const [k, m] of Object.entries(made)) m.cv.hidden = k !== mode;
  }
  const setRows = (m, tile, rows) => { if(tile && m.r.setRows && rows !== m.rows){ m.r.setRows(rows); m.rows = rows; } };
  /* la place de la session pour ce mode, si elle a été mesurée à cette taille de fenêtre */
  const placeOf = mode => { const p = places[mode]; return p && p.vw === innerWidth && p.vh === innerHeight ? p : null; };
  function place(m, p){
    const key = p ? `${p.x},${p.y},${p.w},${p.h}` : 'cover';
    if(key === m.key) return;
    m.key = key;
    m.cv.classList.toggle('cover', !p);
    Object.assign(m.cv.style, p ? { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px' } : { left: '', top: '', width: '', height: '' });
  }

  /* à chaque image : G = partie affichée (null hors session), visible = pas sur l'onglet Session */
  function draw(G, visible, me, follow){
    if(!on || !G || !visible) return show(null);
    const mode = modeOf(G), m = get(mode), tile = MODES[mode].tile, p = placeOf(mode);
    setRows(m, tile, p ? p.rows : rowsFor(m.cv, tile));
    place(m, p);
    MODES[mode].draw(m.r, G, me, follow);
    show(mode);
  }
  /* onglet Session affiché : relève la place du canvas de la session (cv) et ses lignes (rows, mine qui défile) */
  function measure(mode, cv, rows){
    const b = cv?.getBoundingClientRect();
    if(!b || !b.width || !b.height || !MODES[mode]) return;
    const p = { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height),
                rows: Number.isInteger(rows) ? rows : 0, vw: innerWidth, vh: innerHeight };
    const old = places[mode];
    if(old && Object.keys(p).every(k => old[k] === p[k])) return;
    places[mode] = p;
    save(PLACE_KEY, JSON.stringify(places));
  }
  return {
    draw, measure,
    get on(){ return on; },
    set(v){ on = !!v; save(KEY, on ? '1' : '0'); if(!on) show(null); },
  };
}
