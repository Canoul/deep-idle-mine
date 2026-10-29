/* Prison : règles partagées par le jeu et le serveur (logique pure). PRISON (src/config.js), spec
   docs/superpowers/specs/2026-10-29-prison-energie-design.md.

   Enregistrement d'une prison (serveur, ns prison, clé = compte) :
     { id, account, seed, run, specs, areaMax, speed, runStartedAt, pausedMs, state: 'running' | 'waiting' | 'done',
       lastSeenAt, lastBatchAt, endedAt, totals: { runs, energy, bag }, away: { runs, energy, bag } }
   away : ce que les runs finis pendant l'absence du joueur ont rapporté (bilan montré une fois à son retour).
   specs : le mineur figé au lancement { name, prefs, look, gear, skills, spells } (comme une session : revérifiés à la
   construction par minerSpecs). Chaque run est une partie à part pour le moteur (runRecord : id 'prison:<id>:<run>'),
   qui se rejoue à l'identique depuis son début (seed de la prison + numéro du run). */
import { DT, GAME, PRISON } from '../config.js';
import { minerSpecs } from './game.js';
import { newPrisonRun, prisonGoal } from '../sim/prison.js';

const STATES = ['running', 'waiting', 'done'];
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const validBag = b => isObj(b) && Object.values(b).every(n => Number.isSafeInteger(n) && n >= 0);
const sanitizeTotals = t => {
  t = isObj(t) ? t : {};
  return { runs: Number.isSafeInteger(t.runs) && t.runs >= 0 ? t.runs : 0,
           energy: isNum(t.energy) && t.energy >= 0 ? t.energy : 0,
           bag: validBag(t.bag) ? { ...t.bag } : {} };
};
const noTotals = () => ({ runs: 0, energy: 0, bag: {} });

/* relit un enregistrement (stockage) ; null s'il est absent ou abîmé */
export function sanitizePrison(p){
  if(!isObj(p) || typeof p.id !== 'string' || !p.id || typeof p.account !== 'string' || !p.account) return null;
  if(!Number.isSafeInteger(p.seed) || !Number.isSafeInteger(p.run) || p.run < 1 || !isNum(p.runStartedAt)) return null;
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
    totals: sanitizeTotals(p.totals), away: sanitizeTotals(p.away),
  };
}

/* nouvelle prison : run 1, qui commence maintenant */
export function newPrisonRecord({ id, account, seed, specs, areaMax = 0, now, speed = GAME.speed }){
  return { id, account, seed, run: 1, specs, areaMax, speed, startedAt: now, runStartedAt: now, pausedMs: 0, state: 'running',
           lastSeenAt: now, lastBatchAt: null, endedAt: null, totals: noTotals(), away: noTotals() };
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

/* ---------- rythme (spec « Rythme ») : temps réel dû, présence, paquets, plafond ---------- */

/* temps réel que le run en cours doit avoir joué à l'heure now : le temps réel depuis son début, moins les attentes, et
   jamais au-delà de lastSeenAt + offlineMax (après 24 h sans visite, la prison s'arrête et attend) */
export const prisonDueMs = (p, now, cfg = PRISON) =>
  Math.max(0, Math.min(now, p.lastSeenAt + cfg.offlineMax) - p.runStartedAt - p.pausedMs);
/* le joueur regarde (une demande du jeu ouvert depuis moins de presentFor) */
export const isPresent = (p, now, cfg = PRISON) => now - p.lastSeenAt <= cfg.presentFor;
/* un paquet est dû : batchMs depuis le dernier paquet, ou depuis la dernière visite (avant, il était joué en direct) */
export const batchDue = (p, now, cfg = PRISON) => now - Math.max(p.lastBatchAt ?? -Infinity, p.lastSeenAt) >= cfg.batchMs;
/* Visite du joueur à l'heure now (le serveur seul l'appelle) : lastSeenAt = now. Le temps passé au-delà du plafond
   (lastSeenAt + offlineMax) est une attente, ajoutée à pausedMs : le run reprend au tick où il s'était arrêté (en
   waiting, il repasse running). De retour après plus de presentFor : le bilan de l'absence (away) est remis à zéro
   (l'appelant l'a lu avant). → true si autre chose que lastSeenAt a changé (à écrire tout de suite). */
export function touchPrison(p, now, cfg = PRISON){
  let changed = false;
  const cap = p.lastSeenAt + cfg.offlineMax;
  if(now > cap && p.state !== 'done'){ p.pausedMs += now - cap; changed = true; }
  if(p.state === 'waiting'){ p.state = 'running'; changed = true; }
  if(now - p.lastSeenAt > cfg.presentFor && (p.away.runs || p.away.energy || Object.keys(p.away.bag).length)){ p.away = noTotals(); changed = true; }
  p.lastSeenAt = Math.max(p.lastSeenAt, now);
  return changed;
}
/* ajoute un run versé au bilan de l'absence */
export function addAway(p, energy, bag){
  p.away.runs++;
  p.away.energy = Math.round((p.away.energy + energy) * 10) / 10;
  for(const [item, n] of Object.entries(bag)) p.away.bag[item] = (p.away.bag[item] || 0) + n;
}

/* avancement du run (pour le navigateur), lu dans la partie */
export const runInfo = G => ({ goal: prisonGoal(G), mined: G.areas[0].oreMined });

/* ce que le navigateur voit de sa prison ; info = runInfo du run en cours si le moteur le connaît ; away = bilan de
   l'absence à montrer (lu avant touchPrison) ; waitAt : heure où elle s'arrêtera faute de visite */
export function publicPrison(p, info = null, { away = p?.away, cfg = PRISON } = {}){
  if(!p) return null;
  const a = away ?? noTotals();
  return { state: p.state, run: p.run, goal: info?.goal ?? null, mined: info?.mined ?? null, energy: p.totals.energy,
           waitAt: p.lastSeenAt + cfg.offlineMax, away: { runs: a.runs, energy: a.energy, bag: { ...a.bag } } };
}
