/* Rejeu à l'écran (mode dev, 25/10/2026, Geoffrey) : une session enregistrée par le serveur en ligne (fichier sorti par
   scripts/export-session.js) devient une session dev qu'on regarde dans le navigateur, à la vitesse voulue.

   La partie est la même : même seed, mêmes joueurs (pseudos, préférences, stuff, skills, sorts), mêmes départs et
   changements de focus, au même tick. Seuls les comptes changent : celui qui regarde prend la place du premier joueur
   (mineur Rouge), les autres deviennent « rejeu-2 », « rejeu-3 » (la simulation ne se sert des comptes que pour savoir
   qui contrôle quel mineur). La session est marquée replay : rien n'est versé à la fin (ni coffre, ni XP, ni jauges).
   Logique pure : le service vérifie le mode dev, le compte et l'absence de session en cours. */
import { GAME, MINE_MODES } from '../../src/config.js';
import { sanitizeOverrides, sanitizeDevSpecs } from '../../src/shared/game.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const tickOk = v => Number.isSafeInteger(v) && v >= 0;

/* enregistrement → champs de la partie à rejouer ; { error } si le fichier n'est pas un enregistrement de session */
export function replayFields(raw, viewer){
  if(!isObj(raw)) return { error: 'Ce fichier n\'est pas un enregistrement de session.' };
  const { seed, players } = raw;
  if(!Number.isSafeInteger(seed) || seed < 0 || seed >= 2**31) return { error: 'Seed absente ou invalide.' };
  if(!Array.isArray(players) || !players.length || players.length > GAME.maxPlayers ||
     players.some(p => !isObj(p) || typeof p.account !== 'string')) return { error: 'Liste des joueurs invalide.' };
  if(new Set(players.map(p => p.account)).size !== players.length) return { error: 'Liste des joueurs invalide.' };
  const mode = raw.mode ?? MINE_MODES[0].id;
  if(!MINE_MODES.some(m => m.id === mode)) return { error: 'Type de mine inconnu.' };

  /* comptes d'origine → comptes du rejeu */
  const ids = new Map(players.map((p, i) => [p.account, i === 0 ? viewer : `rejeu-${i + 1}`]));
  const byAccount = obj => Object.fromEntries(players.filter(p => isObj(obj) && Object.hasOwn(obj, p.account))
    .map(p => [ids.get(p.account), obj[p.account]]));
  const events = list => (Array.isArray(list) ? list : [])
    .filter(e => isObj(e) && ids.has(e.account) && tickOk(e.tick)).map(e => ({ ...e, account: ids.get(e.account) }));
  const bots = Number.isSafeInteger(raw.bots) ? Math.max(0, Math.min(GAME.maxPlayers - players.length, raw.bots)) : 0;

  return {
    mode, seed, bots,
    players: players.map(p => ({ account: ids.get(p.account), name: String(p.name ?? '').slice(0, 24) })),
    /* revérifiés à la construction de la partie (minerSpecs : sanitizePrefs, sanitizeLook, sanitizeGear, sanitizeSkills…) */
    prefs: byAccount(raw.prefs), looks: byAccount(raw.looks), gear: byAccount(raw.gear),
    skills: byAccount(raw.skills), spells: byAccount(raw.spells),
    overrides: sanitizeOverrides(raw.overrides), devSpecs: sanitizeDevSpecs(raw.devSpecs),
    ...(Number.isSafeInteger(raw.opening) ? { opening: raw.opening } : {}),
    ...(raw.residues === false ? { residues: false } : {}),
    /* départs triés (le rejeu les applique au tick) ; focus dans l'ordre enregistré (le serveur les écrit dans l'ordre) */
    leaves: events(raw.leaves).map(({ account, tick }) => ({ account, tick })),
    focus: events(raw.focus).map(({ account, tick, focus }) => ({ account, tick, focus })),
    replay: { of: typeof raw.id === 'string' ? raw.id.slice(0, 64) : null, bags: bagsOf(raw.result) },
  };
}

/* parts du coffre d'un résultat, dans l'ordre des mineurs (pour dire à la fin si le rejeu retombe sur la même partie) */
export function bagsOf(result){
  return Array.isArray(result?.shares) ? result.shares.map(s => isObj(s?.bag) ? s.bag : {}) : null;
}
/* même coffre que la session d'origine ? null si l'original n'avait pas de résultat (session pas terminée) */
export function sameAsOriginal(rec, summary){
  const a = rec.replay?.bags, b = bagsOf(summary);
  if(!a || !b) return null;
  const key = bag => JSON.stringify(Object.keys(bag).sort().map(k => [k, bag[k]]));
  return a.length === b.length && a.every((bag, i) => key(bag) === key(b[i]));
}
