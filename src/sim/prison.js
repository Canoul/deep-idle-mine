/* Prison (PRISON en config ; spec docs/superpowers/specs/2026-10-29-prison-energie-design.md) : simulation d'un run.
   Un run = une session de mine (newSession) avec opts.prison : une seule area au contenu de l'area max du joueur,
   PRISON.width colonnes entre deux rangées de barreaux, un seul mineur, pas de fin à l'heure. Quand PRISON.resetAt des
   minerais de la carte sont minés (ou au bout de PRISON.runMax), G.endAt = maintenant : l'IA voit qu'il ne reste plus de
   temps (timeLeft) et remonte déposer, comme en fin de session ; le run se termine une fois le mineur à la surface sans
   rien sur lui (ou PRISON.returnMax plus tard s'il ne peut pas remonter). Logique pure, déterministe par seed. */
import { DT, PRISON } from '../config.js';
import { hash } from '../core/rng.js';
import { newSession, tick, endSession } from './session.js';
import { log } from './log.js';

/* seed d'un run : la seed de la prison et le numéro du run (chaque run a sa carte) */
export const runSeed = (seed, run) => (hash(seed, run) ^ PRISON.salt) | 0;

/* nouveau run : miner = spec du mineur (comme une entrée de opts.miners : carac, skills, prefs…), areaMax = contenu,
   run = numéro du run (1, 2…). opts.id / opts.account : id de la session et compte du joueur (partage du coffre). */
export function newPrisonRun(seed, { miner = {}, areaMax = 0, run = 1, id, account } = {}){
  const G = newSession(runSeed(seed, run), { miners:[miner], prison:{ areaMax }, id, accounts: account != null ? [account] : undefined });
  G.prison.run = run;
  G.prison.endTick = null;   // tick de la fin du run (but atteint ou temps max), null avant
  log(G, `⛓ Run ${run} : prison (contenu de l'area ${G.prison.areaMax + 1})`);
  return G;
}

/* nombre de blocs de minerai à miner pour finir le run */
export const prisonGoal = G => Math.ceil(PRISON.resetAt * G.areas[0].oreTotal);

const RUN_TICKS = Math.round(PRISON.runMax / DT), RETURN_TICKS = Math.round(PRISON.returnMax / DT);

/* fin du run demandée : plus de temps restant, le mineur remonte (raison « fin de session » de l'IA) */
function callBack(G, why){
  G.endAt = G.t; G.prison.endTick = G.ticks;
  log(G, `⛓ Run ${G.prison.run} : ${why}, remontée`);
}

/* un tick du run (DT) */
export function tickPrison(G){
  if(G.over) return;
  tick(G);
  if(G.over){ endPrisonRun(G); return; }   // joueur parti (leaveSession)
  if(G.prison.endTick == null){
    if(G.areas[0].oreMined >= prisonGoal(G)) callBack(G, `${Math.round(PRISON.resetAt * 100)} % des minerais`);
    else if(G.ticks >= RUN_TICKS) callBack(G, 'temps max atteint');
  }
  if(G.prison.endTick == null) return;
  const m = G.miners[0];
  const home = !m || (m.y <= 0 && !Object.keys(m.inv).length);
  if(home || G.ticks >= G.prison.endTick + RETURN_TICKS) endPrisonRun(G);
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
