/* Sorts en session (SPELLS dans src/config.js, onglet Sorts). Chaque sort équipé (m.spells, figés au lancement) part
   tout seul dès que sa recharge est finie ET qu'il peut servir ; sinon il reste prêt (m.spellCd[id] = heure où il est
   de nouveau prêt, 0 = prêt). Tout est déterministe (aucun tirage en dehors de ceux d'un coup normal).

   Trois moments :
   - afterDecide : l'IA vient de choisir une action ; un pas de marche peut devenir un Dash, un coup de pioche une
     Dynamite ;
   - updateSpells : à chaque tick, Illumination, Inspiration, Ulti shen, Cri de guerre, Cleave, Hand of Justice,
     Bonbonne de zipette ;
   - learnOnMine : un bloc miné (Fast learner). */
import { W, IDS, DUCK, BLOCKS, CFG } from '../config.js';
import { SPELL } from '../meta/spells.js';
import { isAir, supported, typeOf, maxRow } from './world.js';
import { startAction, moveT } from './mineur.js';
import { breakBlock, hitDamage, killMob } from './actions.js';
import { tackler } from './mobs.js';
import { noEntry, active, mayEnter, bossOf } from './dungeon.js';
import { veiled } from './trap.js';
import { updateLight } from './light.js';
import { log } from './log.js';

export const hasSpell = (m,id) => !!m.spells?.includes(id);
export const spellReady = (G,m,id) => hasSpell(m,id) && G.t >= (m.spellCd[id] || 0);
function cast(G,m,id,cdFrom=G.t,mul=1){
  m.spellCd[id] = cdFrom + SPELL[id].cd*mul;
  m.stats.spells = (m.stats.spells || 0) + 1;
}

/* mob vivant et visible sur la case (x,y) (un mimic encore caché est un bloc) */
const mobAt = (G,x,y) => G.mobs.find(o => o.hp>0 && o.x===x && o.y===y && !(o.type==='mimic' && !o.revealed)) || null;
/* boss : le minotaure (donjon) et le Gallianix */
const isBoss = o => o.dungeon!=null || o.type===DUCK.type;

/* ---------- l'IA vient de choisir une action ---------- */

export function afterDecide(G,m){
  const a = m.action;
  if(!a || !m.spells?.length || m.y<=0) return;
  if(a.type==='move' && spellReady(G,m,'dash')) tryDash(G,m,a);
  else if(a.type==='mine' && spellReady(G,m,'dynamite')) tryDynamite(G,m,a);
}

/* Dash (25/10/2026, Geoffrey : refonte). Une course de SPELL.dash.range cases au plus à speed × sa vitesse de marche,
   qui suit le terrain : il marche, descend (une marche de 1 en simple trajet ; une chute jusqu'à CFG.maxFall vers un
   mob) et SAUTE un bloc qui lui barre la route s'il y a de la place au-dessus. Jamais dans une case inconnue, l'intérieur
   d'un piège caché ou un donjon interdit ; il ne traverse pas un mob.
   - Vers un mob : quand il va combattre ou aider (aimOf), il cherche le plus court Dash (≤ range cases) qui finit au
     contact du mob ; un mob qui tacle un allié passe avant. Rien à portée : il GARDE son sort (pas de Dash « pour
     rien » pendant qu'il approche).
   - En simple trajet : la course continue dans le sens de son pas ; elle s'arrête devant ce qu'elle ne peut pas
     franchir, au pied d'une échelle qui monte, ou juste avant l'objectif de l'IA (m.target). Au moins minCells cases.
   Mob heurté : dmg × ses dégâts, recharge × hitCd, sa canalisation (occultiste) est coupée et il est étourdi stun s
   (il lâche son tacle, ne bouge plus). */
const free = (G,m,x,y) => x>=0 && x<W && y>=1 && y<=maxRow(G) && isAir(G,x,y) && !!G.seen[y]?.[x] && !veiled(G,x,y)
                           && !noEntry(G,m,x,y) && !mobAt(G,x,y);
/* un pas de Dash depuis (x,y) dans le sens dx : { x, y, cells } ou null. fallMax : chute acceptée (cases) */
function dashStep(G,m,x,y,dx,fallMax){
  const nx = x+dx;
  if(free(G,m,nx,y)){
    let ly = y;
    while(!supported(G,nx,ly)){ if(ly-y>=fallMax || !free(G,m,nx,ly+1)) return null; ly++; }
    return { x:nx, y:ly, cells:1+(ly-y) };
  }
  if(nx>=0 && nx<W && !isAir(G,nx,y) && free(G,m,x,y-1) && free(G,m,nx,y-1)) return { x:nx, y:y-1, cells:1 };   // il saute
  return null;
}
const near = (a,o) => Math.abs(a.x-o.x)+Math.abs(a.y-o.y)<=1;
/* mob qu'il va combattre : celui qu'il aide, celui qu'il combat, ou le boss du donjon qu'il rejoint ; sinon null */
function aimOf(G,m){
  const id = m.helping && m.helpFoe!=null ? m.helpFoe : m.foe;
  const o = id!=null ? G.mobs.find(q => q.id===id && q.hp>0) : null;
  if(o || !m.helping) return o;
  const d = G.dungeons?.find(d => active(G,d) && mayEnter(G,m,d));
  return d ? bossOf(G,d) : null;
}
/* plus court Dash (en cases) qui finit au contact d'un des mobs foes : { path, cells, mob } ou null */
function dashTo(G,m,foes){
  if(!foes.length) return null;
  const key = (x,y) => y*W+x, best = new Map([[key(m.x,m.y), 0]]);
  const open = [{ x:m.x, y:m.y, cells:0, path:[] }];
  let found = null;
  while(open.length){
    open.sort((a,b) => a.cells-b.cells);
    const n = open.shift();
    if(found && n.cells>=found.cells) break;
    for(const dx of [-1, 1]){
      const s = dashStep(G,m,n.x,n.y,dx,CFG.maxFall);
      if(!s || n.cells+s.cells>SPELL.dash.range) continue;
      const c = n.cells+s.cells, k = key(s.x,s.y);
      if(best.has(k) && best.get(k)<=c) continue;
      best.set(k, c);
      const next = { x:s.x, y:s.y, cells:c, path:[...n.path, [s.x, s.y]] };
      const mob = foes.find(o => near(next,o));
      if(mob && (!found || c<found.cells)) found = { path:next.path, cells:c, mob };
      open.push(next);
    }
  }
  return found;
}
function tryDash(G,m,a){
  const S = SPELL.dash, d = a.data;
  if(d.fall || d.winch) return;
  const aim = aimOf(G,m);
  if(aim){
    const tacklers = G.miners.filter(o => o!==m && o.y>0).map(o => tackler(G,o)).filter(Boolean);
    if(near(m,aim) && !tacklers.length) return;        // déjà au contact : il frappe
    const r = dashTo(G,m,tacklers) || (near(m,aim) ? null : dashTo(G,m,[aim]));
    if(r) startDash(G,m,r.path,r.cells,r.mob);        // sinon pas à portée : il garde son Dash
    return;
  }
  if(d.y!==m.y || Math.abs(d.x-m.x)!==1) return;
  const dir = d.x-m.x;
  let max = S.range;
  if(m.target && Math.sign(m.target.x-m.x)===dir) max = Math.min(max, Math.abs(m.target.x-m.x)-1);
  const path = []; let x = m.x, y = m.y, cells = 0, hit = null;
  while(path.length<max){
    const o = mobAt(G,x+dir,y);
    if(o){ hit = o; break; }
    const s = dashStep(G,m,x,y,dir,1);
    if(!s || cells+s.cells>S.range) break;
    x = s.x; y = s.y; cells += s.cells; path.push([x, y]);
    if(G.ladder[y-1]?.[x]) break;                     // une échelle monte ici : son chemin tourne peut-être
  }
  if(!hit && path.length<S.minCells) return;
  startDash(G,m,path,Math.max(1,cells),hit);
}
function startDash(G,m,path,cells,mob){
  const [x, y] = path.at(-1) ?? [m.x, m.y];
  startAction(m,'dash', cells*moveT(G,m)/SPELL.dash.speed, { x, y, fx:m.x+(m.kx||0), fy:m.y+(m.ky||0), path:[[m.x, m.y], ...path],
    dir: Math.sign(x-m.x) || Math.sign((mob?.x ?? m.x)-m.x) || m.face || 1, mob:mob?.id ?? null });
  m.status = 'Dash';
}
export function finishDash(G,m,a){
  const d = a.data, S = SPELL.dash;
  m.face = d.dir; m.x = d.x; m.y = d.y; m.kx = 0; m.ky = 0;   // comme un pas : recentré dans sa case (src/sim/knock.js)
  if(!G.khole && m.y>m.stats.maxDepth) m.stats.maxDepth = m.y;
  const o = d.mob!=null ? G.mobs.find(q => q.id===d.mob && q.hp>0) : null;
  const hit = o && near(m,o);
  cast(G,m,'dash',G.t,hit ? S.hitCd : 1);
  if(!hit) return;
  o.hp -= hitDamage(G,m)*S.dmg;
  m.foe = o.id; m.foeHit = G.t;
  log(G, `💨 ${m.name} : Dash dans un ${o.type}`);
  if(o.hp<=0) return killMob(G,m,o);
  if(o.channel){ o.channel = null; log(G, `💨 ${m.name} coupe la canalisation de l'occultiste`); }
  o.stunUntil = G.t+S.stun; o.grab = null;
}

/* cases cassables par la dynamite autour de (cx,cy), rayon SPELL.dynamite.radius (cercle) : un bloc que le mineur peut
   miner (pas une construction, pas l'incassable, pas un mimic caché), jamais le sol sous les pieds d'un mineur */
function blastCells(G,m,cx,cy){
  const R = SPELL.dynamite.radius, out = [];
  for(let y=Math.max(1,cy-R); y<=Math.min(maxRow(G),cy+R); y++)
    for(let x=Math.max(0,cx-R); x<=Math.min(W-1,cx+R); x++){
      if((x-cx)**2+(y-cy)**2>R*R) continue;
      const t = G.tiles[y][x];
      if(!t || typeOf(t)==='build' || BLOCKS[t].unbreakable) continue;
      if(G.mobs.some(o => o.type==='mimic' && o.hp>0 && o.x===x && o.y===y)) continue;
      if(G.miners.some(o => o.x===x && o.y===y-1)) continue;
      out.push([x,y]);
    }
  return out;
}

/* Dynamite : au lieu de son coup de pioche, il la lance dans le sens du coup ; elle s'arrête au premier bloc (au plus
   reach cases) et explose. Ne part que si elle casse plus que le bloc qu'il allait miner. */
function tryDynamite(G,m,a){
  const S = SPELL.dynamite, dx = Math.sign(a.data.x-m.x), dy = Math.sign(a.data.y-m.y);
  let cx = m.x, cy = m.y;
  for(let k=1; k<=S.reach; k++){
    cx = m.x+dx*k; cy = m.y+dy*k;
    if(cx<0 || cx>=W || cy<1 || cy>maxRow(G) || !isAir(G,cx,cy)) break;
  }
  if(blastCells(G,m,cx,cy).length<2) return;
  startAction(m,'dynamite', S.throwTime, { cx, cy });
  m.status = 'Lance une dynamite';
}
export function finishDynamite(G,m,a){
  const cells = blastCells(G,m,a.data.cx,a.data.cy);
  for(const [x,y] of cells) breakBlock(G,m,x,y);
  updateLight(G);
  cast(G,m,'dynamite');
  log(G, `🧨 ${m.name} : dynamite, ${cells.length} blocs cassés`);
}

/* ---------- à chaque tick ---------- */

export function updateSpells(G){
  for(const m of G.miners){
    if(!m.spells?.length || m.y<=0) continue;
    if(spellReady(G,m,'illumination')) illuminate(G,m);
    if(spellReady(G,m,'inspiration') && !(G.t < (G.inspire?.until ?? 0))) inspire(G,m);
    if(spellReady(G,m,'ulti_shen')) ulti(G,m);
    if(spellReady(G,m,'war_cry')) warCry(G,m);
    if(spellReady(G,m,'cleave')) cleave(G,m);
    if(spellReady(G,m,'hand_of_justice')) handOfJustice(G,m);
    if(spellReady(G,m,'zipette')) zipette(G,m);
  }
}

/* Illumination : toutes les cases du cercle de rayon radius sont découvertes (sauf l'intérieur d'un piège pas encore
   déclenché) ; ne part que s'il y a au moins une case inconnue */
function illuminate(G,m){
  const R = SPELL.illumination.radius, cells = [];
  for(let y=Math.max(1,m.y-R); y<=Math.min(maxRow(G),m.y+R); y++)
    for(let x=Math.max(0,m.x-R); x<=Math.min(W-1,m.x+R); x++)
      if((x-m.x)**2+(y-m.y)**2<=R*R && !G.seen[y][x] && !veiled(G,x,y)) cells.push([x,y]);
  if(!cells.length) return;
  for(const [x,y] of cells) G.seen[y][x] = 1;
  cast(G,m,'illumination');
}

/* Inspiration : tous les mineurs minent plus vite pendant duration s (G.inspire, lu par mineT) ; la recharge commence
   à la fin de l'effet. Ne part pas pendant un effet déjà en cours (plusieurs logisticiens : ils s'enchaînent). */
function inspire(G,m){
  const S = SPELL.inspiration;
  G.inspire = { until:G.t+S.duration, pct:S.mineSpeed };
  cast(G,m,'inspiration',G.inspire.until);
  log(G, `🎺 ${m.name} : Inspiration, minage +${Math.round(S.mineSpeed*100)} % pour tous pendant ${S.duration} s`);
}
export const inspireBonus = G => G.inspire && G.t < G.inspire.until ? G.inspire.pct : 0;

/* Ulti shen : un autre mineur du groupe se bat (il frappe un mob, ou un mob le tacle) → téléporté sur sa case, il
   inflige hpPct des PV max du mob (bossPct sur un boss), puis se bat à ses côtés. Seulement quand il travaille (pas
   en remontée, pas pendant un chantier de treuil, la Mule, une chute ou un étourdissement) ; jamais dans un donjon interdit. */
function ulti(G,m){
  const S = SPELL.ulti_shen, a = m.action;
  /* pas en remontée (oxygène, pods pleins : le téléporter plus bas le mettrait en danger), ni en chantier */
  if(m.mode!=='work' || m.winchJob || m.muleJob || m.fall) return;
  if(a && (a.type==='stun' || a.data.fall || a.type==='dash' || a.type==='dynamite')) return;
  for(const o of G.miners){
    if(o===m || o.y<=0) continue;
    const foe = tackler(G,o) || (o.action?.type==='attack' && o.action.data.mob?.hp>0 ? o.action.data.mob : null);
    if(!foe || noEntry(G,m,o.x,o.y)) continue;
    m.x = o.x; m.y = o.y; m.action = null; m.fall = null;
    m.target = null; m.exploring = false; m.digCol = null; m.galleryRow = null; m.goingDown = false;
    if(!G.khole && m.y>m.stats.maxDepth) m.stats.maxDepth = m.y;
    cast(G,m,'ulti_shen');
    foe.hp -= foe.maxhp*(isBoss(foe) ? S.bossPct : S.hpPct);
    log(G, `🌀 ${m.name} : Ulti shen, rejoint ${o.name} contre un ${foe.type}`);
    if(foe.hp<=0) killMob(G,m,foe);
    else { m.foe = foe.id; m.foeHit = G.t; }
    return;
  }
}

/* ---------- un bloc miné ---------- */

/* Fast learner : le premier bloc miné une fois le sort prêt (pas de la terre ni un trésor) est appris ; ce type de
   bloc se mine bonus plus vite jusqu'à la fin de la session (m.learned, lu par mineT), cumulable */
export function learnOnMine(G,m,t){
  if(!t || !spellReady(G,m,'fast_learner') || t===IDS.dirt || typeOf(t)==='treasure') return;
  m.learned[t] = Math.round(((m.learned[t] || 0)+SPELL.fast_learner.bonus)*1e6)/1e6;
  cast(G,m,'fast_learner');
  log(G, `📖 ${m.name} : Fast learner, ${BLOCKS[t].name} +${Math.round(m.learned[t]*100)} % de vitesse de minage`);
}

/* ---------- sorts du 27/10/2026 (Geoffrey) ---------- */

const dist = (a,o) => Math.hypot(a.x-o.x, a.y-o.y);
/* mob qu'il frappe en ce moment (coup en cours), ou null */
const attacking = m => m.action?.type==='attack' && m.action.data.mob?.hp>0 ? m.action.data.mob : null;
/* il se bat : il frappe un mob, ou un mob le tacle. Pas pendant un étourdissement (canalisation de l'occultiste) */
const fighting = (G,m) => m.action?.type!=='stun' && (attacking(m) || tackler(G,m));
/* un mob qu'on peut viser : vivant, visible (pas un mimic caché) ; un boss de donjon seulement si ce mineur le combat
   déjà (sinon on le toucherait à travers le mur de sa salle) */
const fair = (G,m,o) => o.hp>0 && !(o.type==='mimic' && !o.revealed)
                       && (o.dungeon==null || attacking(m)===o || tackler(G,m)===o);

/* Cri de guerre : il entre en combat → lui et les mineurs à radius cases ou moins ont le bonus pendant duration s
   (m.warcry, lu par hitDamage et par l'intervalle d'attaque) ; la recharge commence à la fin de l'effet */
function warCry(G,m){
  if(!fighting(G,m)) return;
  const S = SPELL.war_cry, until = G.t+S.duration;
  const hit = G.miners.filter(o => o===m || dist(m,o)<=S.radius);
  for(const o of hit) o.warcry = { until:Math.max(until, o.warcry?.until ?? 0), dmg:S.dmgPct, speed:S.atkSpeed };
  cast(G,m,'war_cry',until);
  log(G, `📯 ${m.name} : Cri de guerre, ${hit.length} mineur${hit.length>1 ? 's' : ''} : dégâts +${Math.round(S.dmgPct*100)} %, attaque +${Math.round(S.atkSpeed*100)} % pendant ${S.duration} s`);
}

/* Cleave : en combat, dmg × ses dégâts (critique tiré pour chaque mob) à chaque mob à radius cases ou moins.
   Un mob tué ainsi compte pour lui (butin, XP) */
function cleave(G,m){
  if(!fighting(G,m)) return;
  const S = SPELL.cleave, foes = G.mobs.filter(o => fair(G,m,o) && dist(m,o)<=S.radius);
  if(!foes.length) return;
  for(const o of foes){
    o.hp -= hitDamage(G,m)*S.dmg;
    if(o.hp<=0) killMob(G,m,o);
  }
  m.foeHit = G.t;
  cast(G,m,'cleave');
  log(G, `🪓 ${m.name} : Cleave, ${foes.length} mob${foes.length>1 ? 's' : ''} touché${foes.length>1 ? 's' : ''}`);
}

/* Hand of Justice : étourdit stun s un mob qui se bat à range cases ou moins : d'abord un mob qui tacle un allié, puis
   celui qui le tacle, puis celui qu'il frappe ; pas un mob déjà étourdi. Il lâche son tacle, sa canalisation est coupée */
function handOfJustice(G,m){
  if(m.action?.type==='stun') return;
  const S = SPELL.hand_of_justice;
  const ok = o => o && fair(G,m,o) && !(o.stunUntil>G.t) && dist(m,o)<=S.range;
  const allies = G.miners.filter(o => o!==m && o.y>0).map(o => tackler(G,o)).filter(ok).sort((a,b) => dist(m,a)-dist(m,b));
  const o = allies[0] ?? [tackler(G,m), attacking(m)].find(ok);
  if(!o) return;
  o.stunUntil = G.t+S.stun; o.grab = null;
  if(o.channel) o.channel = null;
  cast(G,m,'hand_of_justice');
  log(G, `⚖️ ${m.name} : Hand of Justice, ${o.type} étourdi ${S.stun} s`);
}

/* Bonbonne de zipette : le prochain allié à radius cases ou moins, qui travaille dans la mine (pas en remontée, pas en
   descente depuis la surface, pas à la surface) et à qui il manque de l'oxygène, regagne podsPct des pods max du
   logisticien (sans dépasser son max) ; s'il y en a plusieurs, celui qui en a le moins (en %). Jamais sur lui-même. La
   recharge commence une fois l'oxygène donné. */
const ZIP_AWAY = new Set(['return', 'departure', 'surface', 'fetch']);
function zipette(G,m){
  const S = SPELL.zipette;
  const ratio = o => o.ox/o.carac.oxygenMax;
  const o = G.miners.filter(o => o!==m && o.y>0 && !ZIP_AWAY.has(o.mode) && o.ox<o.carac.oxygenMax && dist(m,o)<=S.radius)
                    .sort((a,b) => ratio(a)-ratio(b))[0];
  if(!o) return;
  const gain = Math.min(m.carac.pods*S.podsPct, o.carac.oxygenMax-o.ox);
  o.ox += gain;
  cast(G,m,'zipette');
  log(G, `🫧 ${m.name} : Bonbonne de zipette, ${o.name} +${Math.round(gain)} d'oxygène`);
}
