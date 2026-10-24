/* Sorts en session (SPELLS dans src/config.js, onglet Sorts). Chaque sort équipé (m.spells, figés au lancement) part
   tout seul dès que sa recharge est finie ET qu'il peut servir ; sinon il reste prêt (m.spellCd[id] = heure où il est
   de nouveau prêt, 0 = prêt). Tout est déterministe (aucun tirage en dehors de ceux d'un coup normal).

   Trois moments :
   - afterDecide : l'IA vient de choisir une action ; un pas de marche peut devenir un Dash, un coup de pioche une
     Dynamite ;
   - updateSpells : à chaque tick, Illumination, Inspiration, Ulti shen ;
   - learnOnMine : un bloc miné (Fast learner). */
import { W, IDS, DUCK, BLOCKS } from '../config.js';
import { SPELL } from '../meta/spells.js';
import { isAir, supported, typeOf, maxRow } from './world.js';
import { startAction, moveT } from './mineur.js';
import { breakBlock, hitDamage, killMob } from './actions.js';
import { tackler } from './mobs.js';
import { noEntry } from './dungeon.js';
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

/* Dash : un pas de marche sur sa ligne devient une course de SPELL.dash.range cases au plus, dans le même sens. Il
   s'arrête devant un bloc, un trou, l'entrée d'un donjon interdit, au pied d'une échelle qui monte, ou juste avant
   l'objectif de l'IA (m.target, pour ne pas le dépasser) ; devant un mob, il le frappe en arrivant. Il ne part que
   s'il fait au moins minCells cases, ou s'il frappe un mob. */
function tryDash(G,m,a){
  const S = SPELL.dash, d = a.data;
  if(d.fall || d.winch || d.y!==m.y || Math.abs(d.x-m.x)!==1) return;
  const dir = d.x-m.x, y = m.y;
  let max = S.range;
  if(m.target && m.target.y===y && Math.sign(m.target.x-m.x)===dir) max = Math.min(max, Math.abs(m.target.x-m.x)-1);
  let n = 0, hit = null;
  for(let k=1; k<=max; k++){
    const x = m.x+dir*k;
    if(x<0 || x>=W) break;
    const o = mobAt(G,x,y);
    if(o){ hit = o; break; }
    if(!isAir(G,x,y) || noEntry(G,m,x,y) || !supported(G,x,y)) break;
    n = k;
    if(G.ladder[y-1]?.[x]) break;                     // une échelle monte ici : son chemin tourne peut-être
  }
  if(!hit && n<S.minCells) return;
  startAction(m,'dash', Math.max(1,n)*moveT(G,m)/S.speed, { x:m.x+dir*n, y, fx:m.x, fy:y, dir, mob:hit?.id ?? null });
  m.status = 'Dash';
}
export function finishDash(G,m,a){
  const d = a.data;
  m.face = d.dir; m.x = d.x;
  if(m.y>m.stats.maxDepth) m.stats.maxDepth = m.y;
  const o = d.mob!=null ? G.mobs.find(q => q.id===d.mob && q.hp>0) : null;
  const hit = o && Math.abs(o.x-m.x)+Math.abs(o.y-m.y)<=1;
  cast(G,m,'dash',G.t,hit ? SPELL.dash.hitCd : 1);
  if(!hit) return;
  o.hp -= hitDamage(G,m)*SPELL.dash.dmg;
  m.foe = o.id; m.foeHit = G.t;
  log(G, `💨 ${m.name} : Dash dans un ${o.type}`);
  if(o.hp<=0) killMob(G,m,o);
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
    if(m.y>m.stats.maxDepth) m.stats.maxDepth = m.y;
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
