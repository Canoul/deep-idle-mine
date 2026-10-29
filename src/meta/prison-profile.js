/* Profil de la prison (29/10/2026, Geoffrey ; PRISON en config) : ce que le joueur trouve en mine classique, d'après ses
   PRISON.profileSessions dernières mines terminées. Logique pure : le serveur le calcule au lancement de la prison et le
   range dans son enregistrement (figé pour tous les runs : ils se rejouent à l'identique).

   Profil : { n, area, ores, treasures, mobs }
     n         : nombre de mines lues (0 à profileSessions)
     area      : area moyenne atteinte, arrondie (aucune mine : PRISON.fallbackArea) ; contenu de la carte
     ores      : { clé de composition (coal, iron…) : part } d'après les minerais de sa part du butin, ou null
     treasures : { 'Treasure T1'… : part } d'après les Treasure TX de sa part du butin, ou null
     mobs      : { type : part } d'après ses kills par type (stats.killsBy, enregistrés depuis le 29/10), ou null
   Les parts font 1 au total. */
import { PRISON, BLOCKS, IDS, TREASURE, MOBS } from '../config.js';

/* nom d'objet d'un minerai (« Fer ») → clé de composition (« iron ») */
const ORE_KEY = Object.fromEntries(Object.entries(IDS).filter(([, id]) => BLOCKS[id]?.type === 'ore').map(([k, id]) => [BLOCKS[id].name, k]));
const ORE_KEYS = new Set(Object.values(ORE_KEY));
const TREASURES = new Set(TREASURE.tiers.map(t => t.item));
const MOB_TYPES = new Set(Object.keys(MOBS.hpBase));

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
/* { clé: nombre } → parts qui font 1 (seulement les clés permises, nombres positifs) ; null si rien */
function shares(counts, allowed){
  const out = {};
  let total = 0;
  for(const [k, n] of Object.entries(isObj(counts) ? counts : {}))
    if(allowed.has(k) && Number.isFinite(n) && n > 0){ out[k] = n; total += n; }
  if(!(total > 0)) return null;
  for(const k of Object.keys(out)) out[k] = out[k] / total;
  return out;
}
const add = (acc, counts) => { for(const [k, n] of Object.entries(isObj(counts) ? counts : {})) if(Number.isFinite(n) && n > 0) acc[k] = (acc[k] || 0) + n; };

/* les dernières mines classiques terminées où le joueur était présent à la fin : [{ at, areas, bag, killsBy }] */
export function lastMines(sessions, account, max = PRISON.profileSessions){
  const out = [];
  for(const s of Array.isArray(sessions) ? sessions : []){
    if(!s || (s.mode ?? 'mine') !== 'mine' || s.dev || s.status !== 'done' || !isObj(s.result) || s.result.abandoned) continue;
    const share = (s.result.shares || []).find(x => x?.account === account);
    if(!share || share.left) continue;
    const miner = (s.result.miners || []).find(m => m?.account === account);
    out.push({ at: s.endedAt ?? s.startedAt ?? 0, areas: Number.isSafeInteger(s.result.areasUnlocked) ? s.result.areasUnlocked : 0,
               bag: share.bag, killsBy: miner?.stats?.killsBy });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, max);
}

/* profil d'après l'historique du joueur (records de sessions du serveur) */
export function prisonProfile(sessions, account){
  const mines = lastMines(sessions, account);
  if(!mines.length) return { n: 0, area: PRISON.fallbackArea, ores: null, treasures: null, mobs: null };
  const bag = {}, kills = {};
  for(const m of mines){ add(bag, m.bag); add(kills, m.killsBy); }
  const ores = {};
  for(const [name, n] of Object.entries(bag)) if(ORE_KEY[name]) ores[ORE_KEY[name]] = (ores[ORE_KEY[name]] || 0) + n;
  return { n: mines.length, area: Math.round(mines.reduce((s, m) => s + m.areas, 0) / mines.length),
           ores: shares(ores, ORE_KEYS), treasures: shares(bag, TREASURES), mobs: shares(kills, MOB_TYPES) };
}

/* profil relu (enregistrement de la prison, partie) : parts revérifiées ; null si absent (ancienne prison : l'area seule) */
export function sanitizeProfile(p){
  if(!isObj(p)) return null;
  return { n: Number.isSafeInteger(p.n) && p.n >= 0 ? p.n : 0,
           area: Number.isSafeInteger(p.area) && p.area >= 0 ? p.area : PRISON.fallbackArea,
           ores: shares(p.ores, ORE_KEYS), treasures: shares(p.treasures, TREASURES), mobs: shares(p.mobs, MOB_TYPES) };
}

/* tirage pondéré d'une clé de parts avec r dans [0, 1[ */
export function pickShare(parts, r){
  let acc = 0; const keys = Object.keys(parts);
  for(const k of keys){ acc += parts[k]; if(r < acc) return k; }
  return keys[keys.length - 1];
}
