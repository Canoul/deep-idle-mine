/* Prison (PRISON en config ; spec docs/superpowers/specs/2026-10-29-prison-energie-design.md) : simulation d'un run.
   Un run = une session de mine (newSession) avec opts.prison : une seule area au contenu de l'area max du joueur,
   PRISON.width colonnes entre deux rangées de barreaux, un seul mineur, pas de fin à l'heure. Quand PRISON.resetAt des
   minerais de la carte sont minés (ou au bout de PRISON.runMax), le run rappelle le mineur (G.prison.recall) : plus de
   temps pour travailler (workLeft = 0), il remonte déposer comme en fin de session ; il garde PRISON.returnMax de temps
   réel (G.endAt, timeLeft) pour passer prendre son sac de Mule. Le run se termine une fois le mineur à la surface sans
   rien sur lui ni sac chargé à rapporter (ou PRISON.returnMax après le rappel au plus tard). Logique pure, déterministe
   par seed. */
import { DT, PRISON, CHEST_X } from '../config.js';
import { hash } from '../core/rng.js';
import { newSession, tick, endSession } from './session.js';
import { log } from './log.js';
import { maxRow } from './world.js';

/* seed d'un run : la seed de la prison et le numéro du run (chaque run a sa carte) */
export const runSeed = (seed, run) => (hash(seed, run) ^ PRISON.salt) | 0;

/* nouveau run : miner = spec du mineur (comme une entrée de opts.miners : carac, skills, prefs…), areaMax = contenu,
   run = numéro du run (1, 2…). opts.id / opts.account : id de la session et compte du joueur (partage du coffre). */
export function newPrisonRun(seed, { miner = {}, areaMax = 0, profile = null, run = 1, id, account } = {}){
  const G = newSession(runSeed(seed, run), { miners:[miner], prison:{ areaMax, profile }, id, accounts: account != null ? [account] : undefined });
  G.prison.run = run;
  G.prison.endTick = null;   // tick de la fin du run (but atteint ou temps max), null avant
  log(G, `⛓ Run ${run} : prison (contenu de l'area ${G.prison.areaMax})`);
  startWinch(G);
  return G;
}

/* treuil (29/10/2026, Geoffrey : l'atout du logisticien en prison) : dans la mine il se pose au déblocage d'une area,
   la prison n'en a qu'une ; un logisticien qui a le skill Treuil part donc l'installer dès le début du run, jusqu'au
   fond de la carte (ascenseur avec le Glyphe Treuil, comme au premier déblocage de la mine) */
function startWinch(G){
  const m = G.miners[0];
  if(!m?.skill?.winch) return;
  const bottom = maxRow(G), lift = !!m.skill.glyph_winch;
  m.winchJob = { bottom, ...(lift ? { lift:true } : {}) };
  log(G, lift ? `🛗 ${m.name} part installer l'ascenseur de la prison` : `🪣 ${m.name} part installer le treuil de la prison`);
}

/* nombre de blocs de minerai à miner pour finir le run */
export const prisonGoal = G => Math.ceil(PRISON.resetAt * G.areas[0].oreTotal);

const RUN_TICKS = Math.round(PRISON.runMax / DT), RETURN_TICKS = Math.round(PRISON.returnMax / DT);

/* fin du run demandée : plus de temps pour travailler, le mineur remonte (raison « fin de session » de l'IA), avec
   returnMax de temps pour la remontée et le ramassage du sac */
function callBack(G, why){
  G.prison.recall = true; G.endAt = G.t + PRISON.returnMax; G.prison.endTick = G.ticks;
  log(G, `⛓ Run ${G.prison.run} : ${why}, remontée`);
}

/* un tick du run (DT) */
export function tickPrison(G){
  if(G.over) return;
  tick(G);
  if(G.over){ endPrisonRun(G); return; }   // joueur parti (leaveSession)
  if(stunLocked(G)){ log(G, `⛓ Run ${G.prison.run} : étourdi ${PRISON.stunReset} s de suite, carte neuve`); G.prison.stunReset = true; endPrisonRun(G); return; }
  if(G.prison.endTick == null){
    if(G.areas[0].oreMined >= prisonGoal(G)) callBack(G, `${Math.round(PRISON.resetAt * 100)} % des minerais`);
    else if(G.ticks >= RUN_TICKS) callBack(G, 'temps max atteint');
  }
  if(G.prison.endTick == null) return;
  if(!G.miners.length || home(G, G.miners[0]) || G.ticks >= G.prison.endTick + RETURN_TICKS) endPrisonRun(G);
}

/* étourdi trop longtemps (30/10/2026, Geoffrey ; PRISON.stunReset) : temps étourdi cumulé (G.prison.stunFor), remis à
   zéro après PRISON.stunGap s sans étourdissement (G.prison.unstunFor) ; vrai quand il atteint stunReset */
function stunLocked(G){
  const m = G.miners[0], P = G.prison;
  if(!m) return false;
  if(m.action?.type === 'stun'){ P.stunFor = (P.stunFor || 0) + DT; P.unstunFor = 0; }
  else if((P.unstunFor = (P.unstunFor || 0) + DT) > PRISON.stunGap + 1e-9) P.stunFor = 0;
  return (P.stunFor || 0) >= PRISON.stunReset - 1e-9;
}

/* le mineur a fini : à la surface, rien sur lui, il a décidé de sa suite (pas en route vers son sac : m.action posée
   après sa décision), et pas de sac de Mule chargé sur lui (il le vide au coffre). Un sac resté en bas qu'il ne va pas
   chercher (inaccessible, plus le temps) est perdu, comme en fin de session. */
function home(G, m){
  if(m.y > 0 || Object.keys(m.inv).length || !m.action || m.mode === 'fetch') return false;
  if(!(G.mule?.load > 0)) return true;
  return G.mule.placed && m.x === CHEST_X;   // sac posé : il a pu décider au coffre de ne pas aller le chercher
}

/* fin du run : comme une fin de session (le coffre est figé et partagé : shares[0].bag = coffre + glyphes trouvés, le
   sac du mineur exclu), puis le bilan est marqué « prison ». Idempotent. */
export function endPrisonRun(G){
  const first = !G.summary;
  if(first) log(G, `⛓ Run ${G.prison?.run} terminé`);
  endSession(G);
  if(G.summary.mode !== 'prison') Object.assign(G.summary, { mode:'prison', run:G.prison?.run ?? null, t:G.t });
  return G.summary;
}
