/* Prison : règles partagées par le jeu et le serveur (logique pure). PRISON (src/config.js), spec
   docs/superpowers/specs/2026-10-29-prison-energie-design.md.

   Enregistrement d'une prison (serveur, ns prison, clé = compte) :
     { id, account, seed, run, specs, areaMax, speed, runStartedAt, pausedMs, state: 'running' | 'waiting' | 'done',
       lastSeenAt, lastBatchAt, endedAt, totals: { runs, energy, bag } }
   specs : le mineur figé au lancement { name, prefs, look, gear, skills, spells } (comme une session : revérifiés à la
   construction par minerSpecs). Chaque run est une partie à part pour le moteur (runRecord : id 'prison:<id>:<run>'),
   qui se rejoue à l'identique depuis son début (seed de la prison + numéro du run). */
import { DT, GAME } from '../config.js';
import { minerSpecs } from './game.js';
import { newPrisonRun, prisonGoal } from '../sim/prison.js';

const STATES = ['running', 'waiting', 'done'];
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const validBag = b => isObj(b) && Object.values(b).every(n => Number.isSafeInteger(n) && n >= 0);

/* relit un enregistrement (stockage) ; null s'il est absent ou abîmé */
export function sanitizePrison(p){
  if(!isObj(p) || typeof p.id !== 'string' || !p.id || typeof p.account !== 'string' || !p.account) return null;
  if(!Number.isSafeInteger(p.seed) || !Number.isSafeInteger(p.run) || p.run < 1 || !isNum(p.runStartedAt)) return null;
  const t = isObj(p.totals) ? p.totals : {};
  return {
    id: p.id, account: p.account, seed: p.seed, run: p.run,
    specs: isObj(p.specs) ? p.specs : {},
    areaMax: Number.isSafeInteger(p.areaMax) && p.areaMax >= 0 ? p.areaMax : 0,
    speed: isNum(p.speed) && p.speed > 0 ? p.speed : GAME.speed,
    startedAt: isNum(p.startedAt) ? p.startedAt : p.runStartedAt,
    runStartedAt: p.runStartedAt,
    pausedMs: isNum(p.pausedMs) && p.pausedMs >= 0 ? p.pausedMs : 0,
    state: STATES.includes(p.state) ? p.state : 'done',
    lastSeenAt: isNum(p.lastSeenAt) ? p.lastSeenAt : p.runStartedAt,
    lastBatchAt: isNum(p.lastBatchAt) ? p.lastBatchAt : null,
    endedAt: isNum(p.endedAt) ? p.endedAt : null,
    totals: { runs: Number.isSafeInteger(t.runs) && t.runs >= 0 ? t.runs : 0,
              energy: isNum(t.energy) && t.energy >= 0 ? t.energy : 0,
              bag: validBag(t.bag) ? { ...t.bag } : {} },
  };
}

/* nouvelle prison : run 1, qui commence maintenant */
export function newPrisonRecord({ id, account, seed, specs, areaMax = 0, now, speed = GAME.speed }){
  return { id, account, seed, run: 1, specs, areaMax, speed, startedAt: now, runStartedAt: now, pausedMs: 0, state: 'running',
           lastSeenAt: now, lastBatchAt: null, endedAt: null, totals: { runs: 0, energy: 0, bag: {} } };
}

/* id du run en cours : clé de ses versements (inventaire, XP, énergie) et de sa partie dans le moteur */
export const runId = p => `prison:${p.id}:${p.run}`;

/* pseudo-session pour le moteur (server/game/live-game.js) */
export const runRecord = p => ({
  id: runId(p), mode: 'prison', seed: p.seed, run: p.run, specs: p.specs, areaMax: p.areaMax,
  players: [{ account: p.account, name: String(p.specs?.name ?? '') }], leaves: [], focus: [],
});

/* la partie d'un run : le mineur du joueur (stuff, skills, glyphes, sorts, anneaux et préférences figés) */
export function buildPrisonRun(rec){
  const a = rec.players[0].account, s = rec.specs || {};
  const miner = minerSpecs({ mode: 'prison', players: rec.players, prefs: { [a]: s.prefs }, looks: { [a]: s.look },
                             gear: { [a]: s.gear }, skills: { [a]: s.skills }, spells: { [a]: s.spells } })[0];
  return newPrisonRun(rec.seed, { miner, areaMax: rec.areaMax, run: rec.run, id: rec.id, account: a });
}

/* ticks de jeu joués après elapsedMs de temps réel à la vitesse speed (pas de plafond : un run peut durer plus d'une heure) */
export const prisonTickAt = (elapsedMs, speed = GAME.speed) => Math.max(0, Math.floor(elapsedMs / 1000 * speed / DT + 1e-9));

/* avancement du run (pour le navigateur), lu dans la partie */
export const runInfo = G => ({ goal: prisonGoal(G), mined: G.areas[0].oreMined });

/* ce que le navigateur voit de sa prison ; info = runInfo du run en cours si le moteur le connaît */
export function publicPrison(p, info = null){
  if(!p) return null;
  return { state: p.state, run: p.run, goal: info?.goal ?? null, mined: info?.mined ?? null, energy: p.totals.energy };
}
