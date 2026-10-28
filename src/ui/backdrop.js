/* Fond de page (28/10/2026, Geoffrey) : pendant une session, la mine en cours remplace le mur du fond, en plein écran,
   assombrie pour rester un décor. Seulement le dessin de la mine : aucun panneau d'infos. Option du joueur dans
   « Mon compte », gardée dans ce navigateur (activée par défaut). Un canvas par mode de jeu : chaque moteur de dessin
   garde la taille du sien.
   Transition avec l'onglet Session (28/10, Geoffrey) : en y entrant, la mine du fond rétrécit linéairement jusqu'à la
   place de la mine de la session (et s'éclaircit), puis la vraie mine prend le relais ; en en sortant, l'inverse.
   measure() relève cette place (position à l'écran, taille, lignes) quand l'onglet Session est affiché ; elle est
   gardée dans le navigateur avec la taille de la fenêtre. Le fond dessine le même nombre de lignes que la session :
   la transition n'est qu'un zoom (même image). Sans mesure valable : plein écran, sans transition. */
import { CAMERA } from '../config.js';
import { createRenderer, TILE } from '../render/canvas.js';
import { createInstantRenderer, MI_TILE } from '../render/instant.js';
import { createTowerRenderer } from '../render/tower.js';
import { createInstanceRenderer } from '../render/instance.js';

const KEY = 'dim.bgSession', PLACE_KEY = 'dim.bgPlace';
export const BACKDROP = { dim: 0.4, transitionMs: 450 };   // luminosité du fond ; durée de la transition (aussi en CSS : --bgAnim)
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

/* plein écran (le canvas couvre la fenêtre, centré, proportions gardées) */
export function coverRect(cw, ch, vw, vh){
  const s = Math.max(vw / cw, vh / ch), w = cw * s, h = ch * s;
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}
/* entre deux rectangles, k de 0 à 1 (linéaire) */
export const lerpRect = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });

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

/* panneaux de l'onglet Session pendant la transition (style.css .bgEnter / .bgLeave), au même rythme que la mine.
   enterPanels : ils glissent depuis les bords. leavePanels : l'onglet Session reste affiché par-dessus le nouvel onglet
   (fixé à sa place, sans capter les clics) le temps que ses panneaux repartent vers les bords, puis il se cache ;
   box : la zone des onglets (sa place), stillHere() : l'onglet Session est-il de nouveau ouvert entre-temps ? */
function resetPanels(view){
  clearTimeout(view._bgT);
  view.classList.remove('bgEnter', 'bgLeave');
  Object.assign(view.style, { position: '', left: '', top: '', width: '' });
}
export function enterPanels(view){
  if(!view) return;
  resetPanels(view);
  view.style.setProperty('--bgAnim', BACKDROP.transitionMs + 'ms');
  void view.offsetWidth; view.classList.add('bgEnter');
  view._bgT = setTimeout(() => resetPanels(view), BACKDROP.transitionMs + 50);
}
export function leavePanels(view, box, stillHere = () => false){
  if(!view || !box) return;
  resetPanels(view);
  const b = box.getBoundingClientRect();
  view.style.setProperty('--bgAnim', BACKDROP.transitionMs + 'ms');
  Object.assign(view.style, { position: 'fixed', left: b.left + 'px', top: Math.max(0, b.top) + 'px', width: b.width + 'px' });
  view.hidden = false; view.classList.add('bgLeave');
  view._bgT = setTimeout(() => { resetPanels(view); view.hidden = !stillHere(); }, BACKDROP.transitionMs);
}

/* root : boîte du fond ; sessionCanvas(mode) : le canvas de la mine dans l'onglet Session (caché pendant l'entrée) */
export function createBackdrop(root, { sessionCanvas = () => null, now = () => performance.now() } = {}){
  let on = load(KEY, '1') !== '0', shownMode = null, anim = null;   // anim : { to:'session'|'cover', t0, mode, hidden }
  const places = readPlaces();
  const made = {};                                     // mode → { cv, r, rows, key }
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; } };
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
  function place(m, r, bright){
    const key = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)},${bright.toFixed(3)}`;
    if(key === m.key) return;
    m.key = key;
    Object.assign(m.cv.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px',
      filter: bright < 1 ? `brightness(${bright}) saturate(${0.7 + 0.3 * (bright - BACKDROP.dim) / (1 - BACKDROP.dim)})` : '' });
  }
  function finish(){
    if(anim?.hidden) anim.hidden.style.visibility = '';
    anim = null;
  }

  /* à chaque image : G = partie affichée (null hors session), visible = pas sur l'onglet Session */
  function draw(G, visible, me, follow){
    if(anim && now() - anim.t0 >= BACKDROP.transitionMs) finish();
    if(!on || !G || (!visible && !anim)) return show(null);
    const mode = modeOf(G), m = get(mode), tile = MODES[mode].tile, p = placeOf(mode);
    setRows(m, tile, p ? p.rows : rowsFor(m.cv, tile));
    const cover = coverRect(m.cv.width, m.cv.height, innerWidth, innerHeight);
    if(anim && p){
      const k = Math.min(1, (now() - anim.t0) / BACKDROP.transitionMs), t = anim.to === 'session' ? k : 1 - k;
      place(m, lerpRect(cover, p, t), BACKDROP.dim + (1 - BACKDROP.dim) * t);
    }
    else place(m, cover, BACKDROP.dim);
    show(mode);
    MODES[mode].draw(m.r, G, me, follow);
  }
  /* changement d'onglet : vers la session, la mine rétrécit jusqu'à sa place ; depuis la session, elle s'agrandit */
  function switchTab(from, to, G){
    finish();
    if(!on || !G || reduced() || (from === 'session') === (to === 'session')) return false;
    const mode = modeOf(G);
    if(!placeOf(mode)) return false;
    anim = { to: to === 'session' ? 'session' : 'cover', t0: now(), mode, hidden: null };
    const cv = sessionCanvas(mode);                    // la vraie mine se cache : le fond fait le zoom (aller et retour)
    if(cv){ cv.style.visibility = 'hidden'; anim.hidden = cv; }
    return true;
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
    draw, measure, switchTab,
    get on(){ return on; },
    get animating(){ return !!anim; },
    set(v){ on = !!v; save(KEY, on ? '1' : '0'); if(!on){ finish(); show(null); } },
  };
}
