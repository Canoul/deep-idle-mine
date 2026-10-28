/* Mine instantanée : règles partagées par le jeu et le serveur (logique pure).
   - horaires : une mine toutes les MI.everyHours heures pile, heure de Paris (heure d'été comprise) ;
   - répartition des inscrits en mines d'au plus MI.maxPerMine joueurs, de tailles égales ;
   - construction et rejeu de la partie depuis l'enregistrement du serveur (seed, joueurs, stuff, skills, départs). */
import { INSTANT_MINE as MI, DT } from '../config.js';
import { aurasOf } from '../meta/aura.js';
import { sanitizeLook, sanitizeGear, equippedStats, ringsOf, withRings } from '../meta/stuff.js';
import { sanitizeSkills, skillEffects, withSkillStats, slotMastery } from '../meta/skills.js';
import { withGlyphStats } from '../meta/glyphs.js';
import { newInstant, leaveInstant, INSTANT_TICKS } from '../sim/instant/session.js';

const HOUR = 3600e3;

/* heure locale (0-23) à l'instant t, dans le fuseau tz */
const hourFormat = new Map();
export function localHour(t, tz = MI.timeZone){
  if(!hourFormat.has(tz)) hourFormat.set(tz, new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }));
  return +hourFormat.get(tz).format(new Date(t));
}

/* une heure pleine UTC est une ouverture si son heure locale est un multiple de everyHours, sauf la seconde fois
   qu'une heure se répète (passage à l'heure d'hiver : 2 h existe deux fois ; au passage à l'heure d'été, 2 h n'existe
   pas : l'ouverture de 2 h saute) */
const isSlot = (s, everyHours, tz) => localHour(s, tz) % everyHours === 0 && localHour(s - HOUR, tz) !== localHour(s, tz);

/* prochaine ouverture STRICTEMENT après t (ms). Les décalages de Paris sont des heures entières : on parcourt les
   heures pleines UTC. */
export function nextSlot(t, { everyHours = MI.everyHours, timeZone = MI.timeZone } = {}){
  let s = Math.floor(t / HOUR) * HOUR + HOUR;
  for(let i = 0; i < 48; i++, s += HOUR) if(isSlot(s, everyHours, timeZone)) return s;
  throw new Error('aucune ouverture de mine instantanée trouvée');
}
/* inscriptions ouvertes à t pour l'ouverture nextAt : seulement dans les MI.signupBefore dernières secondes */
export const signupOpensAt = nextAt => nextAt - MI.signupBefore * 1000;
export const signupOpen = (t, nextAt = nextSlot(t)) => t >= signupOpensAt(nextAt) && t < nextAt;

/* dernière ouverture au plus tard à t */
export function lastSlot(t, { everyHours = MI.everyHours, timeZone = MI.timeZone } = {}){
  let s = Math.floor(t / HOUR) * HOUR;
  for(let i = 0; i < 48; i++, s -= HOUR) if(isSlot(s, everyHours, timeZone)) return s;
  throw new Error('aucune ouverture de mine instantanée trouvée');
}

/* inscrits (dans l'ordre d'inscription) → mines d'au plus max joueurs, de tailles égales (21 → 11 + 10) */
export function splitMines(list, max = MI.maxPerMine){
  if(!list.length) return [];
  const k = Math.ceil(list.length / max), out = [];
  let i = 0;
  for(let g = 0; g < k; g++){
    const size = Math.floor(list.length / k) + (g < list.length % k ? 1 : 0);
    out.push(list.slice(i, i + size)); i += size;
  }
  return out;
}

/* durée réelle d'une mine instantanée (ms) à la vitesse speed */
export const instantDurationMs = speed => MI.duration / speed * 1000;
export { INSTANT_TICKS };
export const instantTickAt = (elapsedMs, speed) => Math.max(0, Math.min(INSTANT_TICKS, Math.floor(elapsedMs / 1000 * speed / DT + 1e-9)));

/* mineurs de la mine : un par joueur, avec son pseudo, son stuff porté (apparence + caractéristiques) et ses skills
   figés à l'ouverture (revérifiés) ; même calcul que pour une session normale (src/shared/game.js minerSpecs), sauf les
   anneaux : chacun pour soi, ils ne profitent qu'à leur porteur */
export function instantSpecs(record){
  return (record.players || []).map((p, i) => {
    const look = sanitizeLook(record.looks?.[p.account]);
    const st = sanitizeSkills(record.skills?.[p.account]), skills = skillEffects(st);
    return { name: String(p.name || '').slice(0, 24) || 'Joueur ' + (i + 1), account: p.account, look,
             auras: aurasOf(sanitizeGear(record.gear?.[p.account])),
             carac: withGlyphStats(withRings(withSkillStats(equippedStats(Object.values(look), slotMastery(skills)), skills), ringsOf(Object.values(look))), skills, false), skills, skillTree: st.tree,
             rings: ringsOf(Object.values(look)) };   // pas de Glyphe Mule ici
  });
}

export const buildInstant = record => newInstant(record.seed, { miners: instantSpecs(record), id: record.id });

/* départs dont le moment est venu (tick ≤ ticks déjà joués) ; renvoie le nombre appliqué */
export function applyDueInstantLeaves(G, record){
  let n = 0;
  for(const l of record.leaves || [])
    if(l.tick <= G.ticks && G.miners.some(m => m.account === l.account) && leaveInstant(G, l.account)) n++;
  return n;
}
