/* Le Carreau, la ville du spawn (29/10/2026, Jules) : affichage et marche.
   - Fond de page hors session : la ville remplace le mur, tamisée (TOWN.dim), derrière les onglets. Ton mineur marche
     jusqu'au bâtiment de l'onglet ouvert ; la caméra le suit.
   - Promenade (onglet Session sans session) : la ville en plein écran, sans les panneaux (classe townWalk sur <body>,
     style.css). ← → (ou Q / D, A / D) pour marcher, clic / toucher pour aller quelque part ; devant une porte, E (ou ↑,
     Entrée) ou un clic sur le bâtiment ouvre son onglet (le chevalement et la place : le Lobby, d'où on lance).
   - Autres joueurs : le serveur (server/town/service.js) renvoie ceux de la ville hors session ; chacun marche vers
     sa place (devant le bâtiment de son onglet, ou là où il se promène), avec la bulle de son dernier message.
   Option « Le Carreau en fond d'écran » (Mon compte), gardée dans ce navigateur. */
import { TOWN } from '../config.js';
import { createTownRenderer, TOWN_TILE } from '../render/town.js';
import { TOWN_WIDTH, restX, clampX, stepToward, buildingNear, townBuildings } from '../shared/town.js';

const KEY = 'dim.bgTown';
const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch(e){ return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };
const LEFT = new Set(['ArrowLeft', 'q', 'Q', 'a', 'A']), RIGHT = new Set(['ArrowRight', 'd', 'D']);
const ENTER = new Set(['e', 'E', 'ArrowUp', 'Enter', 'z', 'Z', 'w', 'W']);
/* bâtiment → onglet ouvert en y entrant (le chevalement mène au Lobby : c'est là qu'on lance une session) */
export const enterTab = b => b.tab === 'session' ? 'lobby' : b.tab;

/* joueurs reçus du serveur → joueurs affichés : prev (Map id → affiché) gardé pour ceux qui y sont encore (ils marchent
   de leur place affichée x vers leur nouvelle place tx) ; un nouveau venu apparaît directement à sa place ; un absent
   disparaît. Le x du serveur (promenade, sinon null) n'est que la cible : il n'écrase jamais la place affichée. */
export function mergeOthers(prev, list){
  const next = new Map();
  for(const { x: at, ...p } of list){
    const tx = at ?? restX(p.spot, p.id), o = prev.get(p.id);
    next.set(p.id, o ? Object.assign(o, p, { tx, trip: o.tx !== tx ? Math.abs(tx - o.x) : o.trip })
                     : { ...p, tx, x: tx, trip: 0, face: 1 });
  }
  return next;
}

/* root : boîte du fond (#bgTown) ; ping(body) : POST /api/town ; me() : { id, name, look, auras } ou null (pas
   connecté) ; onEnter(onglet) : ouvrir un onglet */
export function setupTown(root, { ping, me, onEnter }){
  const cv = document.createElement('canvas');
  root.appendChild(cv);
  const hint = document.createElement('div');
  hint.className = 'townHint';
  hint.innerHTML = '<b>Le Carreau</b><span>← → marcher · clic : aller · <kbd>E</kbd> entrer</span>';
  root.appendChild(hint);
  const r = createTownRenderer(cv);
  let on = load(KEY, '1') !== '0';
  let shown = false, free = false, tab = 'lobby';
  let x = null, target = null, trip = 0, face = 1, keys = 0, enterOnArrive = null;
  let others = new Map();          // id → { id, name, look, auras, say, x, tx, trip, face }
  let mySay = null, timer = null, busy = false, camX = 0;

  /* ---------- serveur ---------- */
  function schedule(ms){ clearTimeout(timer); timer = setTimeout(poll, ms); }
  async function poll(){
    const m = me();
    if(!shown || !m || busy) return schedule(TOWN.poll);
    busy = true;
    try {
      const res = await ping({ spot: free ? 'session' : tab, x: free ? Math.round(x * 100) / 100 : null });
      merge(res?.players ?? []);
      mySay = res?.say ?? null;
    } catch(e){ /* hors ligne, serveur redémarré : on réessaie au prochain tour */ }
    busy = false;
    schedule(document.hidden ? TOWN.hiddenPoll : free ? TOWN.walkPoll : TOWN.poll);
  }
  const merge = list => { others = mergeOthers(others, list); };

  /* ---------- marche ---------- */
  const near = () => x === null ? null : buildingNear(x);
  function go(tx){ target = clampX(tx); trip = Math.abs(target - x); }
  function enter(b){ if(b){ enterOnArrive = null; onEnter(enterTab(b)); } }

  document.addEventListener('keydown', e => {
    if(!free || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
    if(LEFT.has(e.key)){ keys = -1; e.preventDefault(); }
    else if(RIGHT.has(e.key)){ keys = 1; e.preventDefault(); }
    else if(ENTER.has(e.key) && near()){ e.preventDefault(); enter(near()); }
  });
  document.addEventListener('keyup', e => {
    if((LEFT.has(e.key) && keys < 0) || (RIGHT.has(e.key) && keys > 0)){ keys = 0; target = x; }
  });
  /* clic : un bâtiment (sa façade) → y aller puis entrer ; ailleurs → y aller */
  root.addEventListener('pointerdown', e => {
    if(!free || e.target.closest('.townHint')) return;
    const b = cv.getBoundingClientRect(), s = b.height / (TOWN.rows * TOWN_TILE);
    const tx = camX + (e.clientX - b.left) / s / TOWN_TILE, ty = (e.clientY - b.top) / s / TOWN_TILE;
    const hit = ty < TOWN.ground && townBuildings().find(k => tx >= k.x && tx < k.x + k.w && ty >= TOWN.ground - Math.max(k.h, 2) - (k.kind === 'house' ? Math.floor(k.w / 2) + 1 : 0));
    if(hit){ go(hit.door); enterOnArrive = hit; if(Math.abs(x - hit.door) < 0.05) enter(hit); }
    else { go(tx); enterOnArrive = null; }
  });

  function size(){
    r.setCols(TOWN.rows * innerWidth / Math.max(1, innerHeight));
    /* plein écran, proportions gardées : le canvas couvre la fenêtre */
    const s = Math.max(innerWidth / cv.width, innerHeight / cv.height);
    Object.assign(cv.style, { width: cv.width * s + 'px', height: cv.height * s + 'px',
      left: (innerWidth - cv.width * s) / 2 + 'px', top: (innerHeight - cv.height * s) / 2 + 'px' });
  }

  /* à chaque image : show = la ville est le fond (pas de session) ; walk = promenade ; t = onglet ouvert */
  function frame(dt, { show, walk, tab: t }, now = performance.now()){
    show = on && show; walk = show && walk;
    if(show !== shown){ shown = show; root.hidden = !show; if(show) poll(); else clearTimeout(timer); }
    if(walk !== free){
      free = walk; keys = 0; enterOnArrive = null;
      document.body.classList.toggle('townWalk', free);
      root.classList.toggle('walk', free);
      if(shown) poll();
    }
    if(!shown) return;
    const m = me();
    if(x === null){ x = restX(t, m?.id ?? ''); target = x; }
    if(t !== tab){ tab = t; if(!free) go(restX(t, m?.id ?? '')); }
    if(free && keys){ target = clampX(x + keys * TOWN.walk * Math.max(dt, 0.05) * 2); trip = 0; }
    const nx = stepToward(x, target, dt, trip);
    if(nx !== x) face = nx > x ? 1 : -1;
    const walking = nx !== x;
    x = nx;
    if(!walking && enterOnArrive && free) enter(enterOnArrive);
    for(const o of others.values()){
      const ox = stepToward(o.x, o.tx, dt, o.trip);
      o.walking = ox !== o.x; if(o.walking) o.face = ox > o.x ? 1 : -1; o.x = ox;
    }
    size();
    camX = Math.min(Math.max(0, x - r.cols / 2), Math.max(0, TOWN_WIDTH - r.cols));
    cv.style.filter = free ? '' : `brightness(${TOWN.dim}) saturate(.8)`;
    const players = [...others.values()];
    if(m) players.push({ id: m.id, name: m.name, look: m.look, auras: m.auras, x, face, walking, say: mySay, me: true });
    const b = free ? near() : null;
    r.draw({ camX, players, labels: free, near: b, hint: b ? (b.tab === 'session' || b.tab === 'lobby' ? 'E : préparer une session' : 'E : entrer') : null }, now);
  }

  return {
    frame,
    get on(){ return on; },
    set(v){ on = !!v; save(KEY, on ? '1' : '0'); },
    /* pour les tests et le débogage (console : TOWN_UI.state()) */
    state: () => ({ x, target, tab, free, shown, others: [...others.values()].map(o => ({ name: o.name, x: o.x, say: o.say })) }),
    poke: () => { if(shown) poll(); },
  };
}
