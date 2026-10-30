/* Diffusion de la partie : le serveur fait tourner LA partie, les navigateurs en reçoivent une copie d'affichage.
   Logique pure, partagée : createViewer(G) (serveur, à côté de la partie) fabrique les envois ; applyView(M, v)
   (navigateur) les applique à sa copie M, que le rendu et l'interface lisent comme une partie normale.

   Un envoi dit « voici la partie au tick T ». La première fois (since absent, ou trop ancien) : la carte entière.
   Ensuite : seulement les cases qui ont changé depuis le tick que le navigateur a déjà (since). Le reste (mineurs,
   mobs, coffre, areas…) est petit et envoyé à chaque fois. La lumière n'est pas envoyée : le navigateur la recalcule
   (même calcul, src/sim/light.js). Le navigateur ne calcule aucun résultat : il affiche. */
import { W } from '../config.js';
import { updateLight } from '../sim/light.js';
import { muleCap } from '../sim/mule.js';
import { lit, travelling } from '../sim/mineur.js';
import { minerEffects, sessionBonuses, mobEffects } from '../sim/effects.js';

const HISTORY = 400;           // changements gardés (un navigateur plus en retard reçoit la carte entière)
const row = (a, enc) => Array.from(a, enc).join('');
const enc36 = v => v.toString(36);
const dec36 = c => parseInt(c, 36);

/* ce que l'affichage lit d'un mineur (pas de références internes à la simulation) */
function minerView(G, m){
  const a = m.action, d = a?.data || {};
  return {
    id: m.id, name: m.name, color: m.color, account: m.account, x: m.x, y: m.y, kx: m.kx || 0, ky: m.ky || 0, face: m.face,
    status: m.status, mode: m.mode, reason: m.reason, ox: m.ox, load: m.load, inv: m.inv,
    torches: m.torches, bridges: m.bridges, prefs: m.prefs, focusNotice: m.focusNotice ?? null, stats: m.stats,
    pings: (m.pings || []).map(({ x, y, t }) => ({ x, y, t })),     // minerais signalés par la boussole (cadres jaunes)
    look: m.look || {},                                              // équipement visible (skin, src/skins.js)
    auras: m.auras || {},                                            // aura des pièces visibles (src/meta/aura.js)
    carac: { oxygenMax: m.carac?.oxygenMax, pods: m.carac?.pods },   // jauges (oxygène, pods) avec le stuff
    flesh: m.fleshStacks || 0,                                       // stacks du mur de chair (−10 % de vitesse d'attaque chacun)
    spells: m.spells || [], spellCd: { ...(m.spellCd || {}) },          // sorts équipés et recharges (barre des sorts)
    /* états (28/10, src/sim/effects.js) : contrôles, debuffs et buffs avec leur temps restant ; bonus de la session */
    effects: minerEffects(G, m, { foes: G.mobs, robbable: true, dark: m.y > 0 && !lit(G, m),
                                  warcry: m.warcry && G.t < m.warcry.until ? m.warcry : null, travelling: travelling(m) }),
    bonus: sessionBonuses(G, m),
    action: a ? { type: a.type, t: a.t, dur: a.dur, data: { x: d.x, y: d.y, fx: d.fx, fy: d.fy, down: d.down, fall: d.fall, winch: d.winch, cause: d.cause } } : null,
  };
}
/* channel : id du mineur sur lequel un occultiste canalise (rayon noir) ; grab : mineur taclé */
const mobView = (G, o) => ({ id: o.id, type: o.type, x: o.x, y: o.y, kx: o.kx || 0, ky: o.ky || 0, hp: o.hp, maxhp: o.maxhp, h: o.h, revealed: o.revealed, ore: o.ore, name: o.name, hop: o.hop, variant: o.variant,
  channel: o.channel ? o.channel.target : null, grab: o.grab ?? null, splash: o.splash ?? null, fx: mobEffects(G, o) });   // fx : états (étourdi, provoqué…)   // splash : dégâts de zone reçus

/* ---------- serveur ---------- */

export function createViewer(G){
  /* copie de la carte au dernier passage, et historique des changements, chacun du tick from au tick to :
     [{ from, to, H (lignes au tick from), cells:[y,x,tuile,échelle,vue,…] (lignes déjà là), torches (nombre au tick
     from), log (le journal a changé) }]. Les lignes apparues (nouvelle area) partent en bloc, comme la carte entière. */
  let prev = null, frames = [], logHead = null;
  const rowsFrom = y0 => ({ y0, tiles: G.tiles.slice(y0).map(r => row(r, enc36)), ladder: G.ladder.slice(y0).map(r => row(r, enc36)),
                            seen: G.seen.slice(y0).map(r => row(r, enc36)) });

  function snapshotRows(){ return { tiles: G.tiles.map(r => r.slice()), ladder: G.ladder.map(r => r.slice()), seen: G.seen.map(r => r.slice()) }; }

  /* enregistre ce qui a changé depuis le dernier passage (une fois par tick au plus) */
  function record(){
    /* k hole (src/sim/khole.js) : la carte a changé (aller ou retour) ; les changements d'avant ne servent plus, le
       prochain envoi est la carte entière */
    if(prev && prev.realm !== (G.realm || 0)){ prev = null; frames = []; }
    if(!prev){ prev = snapshotRows(); prev.torches = G.torches.length; prev.tick = G.ticks; prev.realm = G.realm || 0; logHead = G.log[0]; return; }
    if(prev.tick === G.ticks) return;
    const cells = [];
    const H = prev.tiles.length;
    for(let y = 0; y < H; y++){
      const pt = prev.tiles[y], pl = prev.ladder[y], ps = prev.seen[y];
      const t = G.tiles[y], l = G.ladder[y], s = G.seen[y];
      for(let x = 0; x < W; x++)
        if(pt[x] !== t[x] || pl[x] !== l[x] || ps[x] !== s[x]) cells.push(y, x, t[x], l[x], s[x]);
    }
    frames.push({ from: prev.tick, to: G.ticks, H, cells, torches: prev.torches, log: G.log[0] !== logHead });
    if(frames.length > HISTORY) frames.shift();
    prev = snapshotRows(); prev.torches = G.torches.length; prev.tick = G.ticks; prev.realm = G.realm || 0; logHead = G.log[0];
  }

  /* l'envoi pour un navigateur qui a déjà la partie au tick since (absent : rien) */
  return function view(since){
    record();
    const base = {
      tick: G.ticks, t: G.t, over: G.over, H: G.tiles.length,
      miners: G.miners.map(m => minerView(G, m)), mobs: G.mobs.map(o => mobView(G, o)),
      thralls: (G.thralls || []).map(o => ({ id: o.id, x: o.x, y: o.y, dig: o.dig ? { x: o.dig.x, y: o.dig.y } : null, left: Math.max(0, Math.round(o.until - G.t)) })),   // gobelins asservis (27/10)
      chest: G.chest, chestBy: G.chestBy, goblinChest: G.goblinChest || {}, shrines: G.shrines || [], stats: G.stats, areas: G.areas, unlockedAreas: G.unlockedAreas, winch: G.winch,
      mule: muleView(G),
      khole: G.khole ? { until: G.khole.until, label: G.khole.map.label } : null,   // dimension du k hole : carte, heure du retour
    };
    /* changements depuis since : le navigateur est à jour, ou on a tous les lots depuis son tick */
    if(since === G.ticks) return { ...base, cells: [], torches: [], torchesFrom: G.torches.length };
    const i = Number.isSafeInteger(since) ? frames.findIndex(f => f.from === since) : -1;
    if(i >= 0){
      const list = frames.slice(i), y0 = list[0].H;
      return { ...base, rows: G.tiles.length > y0 ? rowsFrom(y0) : undefined,
               cells: list.flatMap(f => f.cells), torches: G.torches.slice(list[0].torches), torchesFrom: list[0].torches,
               log: list.some(f => f.log) ? G.log : undefined };
    }
    /* carte entière */
    return { ...base, full: true,
             rows: rowsFrom(0),
             torches: G.torches, torchesFrom: 0, log: G.log };
  };
}

/* ---------- navigateur ---------- */

/* Mouvement fluide (interpolation) : entre deux envois, un mineur fait plusieurs pas. Au lieu de sauter, chaque
   mineur et chaque mob glisse de la position où il est affiché quand l'envoi arrive (jamais de saut) vers sa
   nouvelle position, sur la durée moyenne entre deux envois. L'image a ainsi ~un envoi de retard sur la partie. */
const TELEPORT = 6;            // au-delà de cette distance (cases), pas de glissade : il apparaît directement
const minerPos = m => {        // position exacte au moment de l'envoi (un pas en cours compte pour sa part faite ; recul : kx, ky)
  const a = m.action;
  if(a && a.type === 'move'){ const p = Math.min(1, a.t / a.dur); return [a.data.fx + (a.data.x - a.data.fx) * p, a.data.fy + (a.data.y - a.data.fy) * p]; }
  return [m.x + (m.kx || 0), m.y + (m.ky || 0)];
};
/* position affichée de o (mineur ou mob de la copie M) à l'instant now (ms, horloge de la page) */
export function shownPos(M, o, now = performance.now()){
  if(!o._to) return [o.x, o.y];
  const p = Math.max(0, Math.min(1, (now - M._at) / M._dur));
  return [o._from[0] + (o._to[0] - o._from[0]) * p, o._from[1] + (o._to[1] - o._from[1]) * p];
}
/* rythme des envois (29/10/2026 : partagé avec la Mine instantanée et le Bloc géant) : durée de glissade = moyenne lissée
   du temps réel entre deux envois (attente + requête), pour que le mineur arrive juste quand le suivant arrive */
export function pace(M, prev, now){
  M._dur = prev?._at == null ? 250 : Math.max(80, Math.min(1500, 0.7 * (prev._dur ?? 250) + 0.3 * (now - prev._at)));
  M._at = now;
  return M;
}
/* dans le seau du treuil (ou la cabine de l'ascenseur) : il va vite et en ligne droite, plus de TELEPORT cases entre deux
   envois n'est pas une téléportation (28/10/2026 : à ×2, l'ascenseur faisait « sauter » le mineur dans le puits) */
const riding = o => !!o?.action?.data?.winch;
export function glide(M, oldList, newList, target, now){
  const old = new Map(oldList.map(o => [o.id, o]));
  for(const o of newList){
    const to = target(o), was = old.get(o.id), from = was ? shownPos(M, was, now) : to;
    o._to = to;
    const far = Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) > TELEPORT;
    o._from = far && !riding(o) && !riding(was) ? to : from;
  }
}

/* sac de la Mule, posé dans la mine : sa case et son remplissage (jauge) ; null sinon (pas de sac, ou transporté) */
const muleView = G => G.mule?.placed ? { x: G.mule.x, y: G.mule.y, load: Math.round(G.mule.load), cap: muleCap(G) } : null;

/* copie d'affichage vide (avant le premier envoi) */
export function emptyView(){
  return { tiles: [], ladder: [], seen: [], torches: [], light: new Map(), miners: [], mobs: [], thralls: [], chest: {}, chestBy: {}, goblinChest: {},
           stats: {}, areas: [], unlockedAreas: 0, winch: null, mule: null, khole: null, log: [], t: 0, ticks: -1, over: false, ready: false };
}

/* applique un envoi du serveur ; now : heure de la page (ms) à son arrivée. Renvoie M (modifié). */
export function applyView(M, v, now = performance.now()){
  let mapChanged = false;
  const dec = s => Uint8Array.from(s, dec36);
  if(!v.full){                                     // cases changées des lignes que le navigateur avait déjà
    const c = v.cells;
    for(let i = 0; i < c.length; i += 5) if(c[i] < M.tiles.length){ M.tiles[c[i]][c[i+1]] = c[i+2]; M.ladder[c[i]][c[i+1]] = c[i+3]; M.seen[c[i]][c[i+1]] = c[i+4]; }
    if(c.length) mapChanged = true;
  }
  if(v.rows){                                      // carte entière, ou lignes apparues (nouvelle area), dans leur état actuel
    const { y0 } = v.rows;
    M.tiles.length = M.ladder.length = M.seen.length = y0;
    M.tiles.push(...v.rows.tiles.map(dec)); M.ladder.push(...v.rows.ladder.map(dec)); M.seen.push(...v.rows.seen.map(dec));
    mapChanged = true;
  }
  if(v.torchesFrom === 0) M.torches = v.torches.slice();
  else { M.torches.length = v.torchesFrom; M.torches.push(...v.torches); }
  if(v.torches.length || v.full) mapChanged = true;
  if(mapChanged) updateLight(M);
  if(v.log) M.log = v.log;
  /* glissades : depuis la position affichée maintenant (calculée avec l'envoi précédent), vers la nouvelle */
  glide(M, M.miners, v.miners, minerPos, now);
  glide(M, M.mobs, v.mobs, o => [o.x + (o.kx || 0), o.y + (o.ky || 0)], now);
  pace(M, M, now);
  Object.assign(M, { ticks: v.tick, t: v.t, over: v.over, miners: v.miners, mobs: v.mobs, thralls: v.thralls ?? [], chest: v.chest, chestBy: v.chestBy, goblinChest: v.goblinChest ?? {}, shrines: v.shrines ?? [],
                     stats: v.stats, areas: v.areas, unlockedAreas: v.unlockedAreas, winch: v.winch ?? null, mule: v.mule ?? null, khole: v.khole ?? null, ready: true });
  return M;
}
