/* Règles partagées entre le jeu (navigateur) et le serveur pour les sessions de jeu. Logique pure.

   Une session est décrite par un « enregistrement » créé par le serveur :
     { id, seed, players:[{account, name}], bots, prefs:{<compte>: prefs}, looks:{<compte>: {case: objet}}, gear:{<compte>: {case: pièce}}, overrides,
       leaves:[{account, tick}], focus:[{account, tick, focus}] }
   (looks : équipement visible de chaque joueur au lancement ; gear : les mêmes pièces avec leur qualité et leur
   niveau, pour les caractéristiques ; focus : changements faits pendant la session)
   À partir de lui, buildSession construit la partie que le serveur fait tourner (server/game/live-game.js) ; la même
   seed et les mêmes choix redonnent exactement la même partie (reconstruction après un redémarrage). */
import { TEAM, PREFS, PREF_OPTIONS, MOBS, DEV_TUNABLES, STATS, CFG, GAME, SESSION_LEN, DT } from '../config.js';
import { newSession, tick, leaveSession, endSession, SESSION_TICKS } from '../sim/session.js';
import { setFocus } from '../sim/focus.js';
import { sanitizeLook, sanitizeGear, equippedStats } from '../meta/stuff.js';
import { sanitizeSkills, skillEffects, withSkillStats } from '../meta/skills.js';

/* ---------- préférences ---------- */

/* ne garde que les préférences connues avec une valeur permise ; le reste prend la valeur par défaut */
export function sanitizePrefs(input){
  const out = { ...PREFS, helpIgnore:[] };
  if(!input || typeof input !== 'object') return out;
  for(const k in PREF_OPTIONS){
    const allowed = PREF_OPTIONS[k].options.map(o => o[0]);
    if(Object.hasOwn(input, k) && allowed.includes(input[k])) out[k] = input[k];
  }
  /* mobs ignorés par « Aider allié » : types connus seulement, sans doublon */
  out.helpIgnore = Array.isArray(input.helpIgnore)
    ? [...new Set(input.helpIgnore.filter(t => typeof t === 'string' && Object.hasOwn(MOBS.hpBase, t)))] : [];
  return out;
}

/* ---------- réglages du mode développeur ---------- */

const TARGETS = { STATS, CFG };

/* ne garde que les réglages autorisés (DEV_TUNABLES), nombres finis dans leurs bornes ; null s'il n'y en a aucun */
export function sanitizeOverrides(input){
  if(!input || typeof input !== 'object') return null;
  const out = {};
  for(const [obj, key, , min, max] of DEV_TUNABLES){
    const v = input[obj]?.[key];
    if(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) (out[obj] ??= {})[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

/* valeurs de base, figées au chargement du module : appliquer des réglages repart toujours d'elles */
const BASE = Object.fromEntries(DEV_TUNABLES.map(([obj, key]) => [obj+'.'+key, TARGETS[obj][key]]));

/* remet les valeurs de base puis applique les réglages (déjà nettoyés) d'une session */
export function applyOverrides(overrides){
  for(const [obj, key] of DEV_TUNABLES) TARGETS[obj][key] = BASE[obj+'.'+key];
  for(const obj in overrides || {}) for(const key in overrides[obj]) TARGETS[obj][key] = overrides[obj][key];
}

/* ---------- construction et rejeu d'une session ---------- */

/* mineurs de la session : un par joueur, puis les mineurs de test (mode dev) ; seul = le mineur solo habituel */
/* chaque mineur porte le pseudo de son joueur (record.players[i].name), l'équipement porté au lancement
   (record.looks[compte] : son apparence ET ses caractéristiques, base + bonus des pièces) ; les mineurs de test (dev) s'appellent « Mineur test 1 », … */
export function minerSpecs(record){
  const players = record.players || [], n = players.length + (record.bots|0);
  const prefsOf = i => i < players.length ? sanitizePrefs(record.prefs?.[players[i].account]) : { ...PREFS };
  const nameOf = i => i < players.length ? (String(players[i].name || '').slice(0, 24) || 'Joueur ' + (i + 1))
                                         : 'Mineur test ' + (i - players.length + 1);
  const lookOf = i => i < players.length ? sanitizeLook(record.looks?.[players[i].account]) : {};
  /* caractéristiques : base + stuff porté au lancement : les pièces avec leur qualité et leur niveau (record.gear,
     revérifié) ; une session plus ancienne n'a que les noms (record.looks) */
  const gearOf = i => i < players.length && record.gear?.[players[i].account]
    ? Object.values(sanitizeGear(record.gear[players[i].account])) : Object.values(lookOf(i));
  /* skills figés au lancement (record.skills[compte], revérifiés) : effets en partie + multiplicateurs de stats */
  const skillsOf = i => skillEffects(sanitizeSkills(i < players.length ? record.skills?.[players[i].account] : null));
  const caracOf = i => withSkillStats(equippedStats(gearOf(i)), skillsOf(i));
  const treeOf = i => sanitizeSkills(i < players.length ? record.skills?.[players[i].account] : null).tree;
  const spec = i => ({ name: nameOf(i), prefs: prefsOf(i), look: lookOf(i), carac: caracOf(i), skills: skillsOf(i), skillTree: treeOf(i) });
  if(n <= 1) return [{ ...spec(0), name: players.length ? nameOf(0) : undefined }];
  return TEAM.slice(0, n).map((t, i) => ({ x: t.x, home: t.home, ...spec(i) }));
}

export function buildSession(record){
  return newSession(record.seed, {
    miners: minerSpecs(record),
    accounts: (record.players || []).map(p => p.account),
    id: record.id,
  });
}

/* départs dont le moment est venu (tick ≤ ticks déjà joués) ; renvoie le nombre appliqué */
export function applyDueLeaves(G, record){
  let n = 0;
  for(const l of record.leaves || [])
    if(l.tick <= G.ticks && G.miners.some(m => m.account === l.account) && leaveSession(G, l.account)) n++;
  return n;
}

/* changements de focus minerai dont le moment est venu, dans l'ordre de l'enregistrement (le serveur garantit des
   ticks croissants) ; G.focusDone retient ceux déjà appliqués. Renvoie le nombre appliqué. */
export function applyDueFocus(G, record){
  const list = record.focus || [];
  let n = 0;
  G.focusDone ??= 0;
  while(G.focusDone < list.length && list[G.focusDone].tick <= G.ticks){
    const e = list[G.focusDone++];
    const m = G.miners.find(x => x.account !== null && x.account === e.account);
    if(m){ setFocus(G, m, e.focus); n++; }
  }
  return n;
}

/* tout ce qui arrive en cours de partie (départs, focus) : appelé avant chaque tick, des deux côtés */
export function applyDueEvents(G, record){ applyDueLeaves(G, record); applyDueFocus(G, record); }

/* Rejoue une session entière (serveur). maxTicks : réservé aux tests (session raccourcie). */
export function replayRecord(record, { maxTicks = Infinity } = {}){
  applyOverrides(record.overrides);
  try {
    const G = buildSession(record);
    while(!G.over && G.ticks < maxTicks){ applyDueEvents(G, record); tick(G); }
    if(!G.over) endSession(G);
    return G.summary;
  } finally {
    applyOverrides(null);
  }
}

/* ---------- temps réel ---------- */

/* ticks écoulés après elapsedMs de temps réel à la vitesse speed (jamais plus que la session entière) */
/* fin de session dans le navigateur : que faire du « résultat pas encore vu » renvoyé par le serveur, quand on attend
   celui de la session waitingFor ? Un résultat plus ancien jamais vu (bilan quitté en relançant depuis le lobby) n'est
   PAS celui de cette session : on le marque vu sans l'afficher, et on continue d'attendre (22/10 : bilan de la tour
   montré à la fin d'une mine). 'show' | 'stale' | 'wait' */
export function resultChoice(ended, waitingFor){
  if(!ended) return 'wait';
  return !waitingFor || ended.id === waitingFor ? 'show' : 'stale';
}

export const TOTAL_TICKS = SESSION_TICKS;   // la session se termine exactement à ce tick (src/sim/session.js)
export function tickAt(elapsedMs, speed = GAME.speed){
  return Math.max(0, Math.min(TOTAL_TICKS, Math.floor(elapsedMs / 1000 * speed / DT + 1e-9)));
}
/* durée réelle d'une session à la vitesse normale (ms) */
export const realDurationMs = (speed = GAME.speed) => SESSION_LEN / speed * 1000;
