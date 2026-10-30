/* Prison et énergie côté navigateur (29/10/2026, spec docs/superpowers/specs/2026-10-29-prison-energie-design.md) :
   textes de la jauge d'énergie (barre du haut), du bandeau de la prison (onglet Session) et du bilan d'absence.
   Logique pure, testée (tests/prison-ui.test.js) : le serveur calcule tout, ces fonctions ne font que l'écrire. */
import { ENERGY, PRISON, BLOCKS, IDS } from '../config.js';

const nf = n => Math.round(n).toLocaleString('fr-FR');
const ok = v => Number.isFinite(v);

/* jauge d'énergie : { value, max } → « 72 / 100 » (gardée au dixième par le serveur, affichée arrondie) */
export const energyText = e => e && ok(e.value) ? `${Math.round(e.value)} / ${e.max ?? ENERGY.max}` : '—';
export const energyPct = e => e && ok(e.value) ? Math.max(0, Math.min(100, e.value / (e.max || ENERGY.max) * 100)) : 0;

/* coût d'une mine classique, à côté de « Lancer » : « 6 à 12 ⚡ » ; sous le minimum, le joueur est prévenu (le serveur
   refuse de toute façon, message no_energy) */
export function launchCostText(e){
  const { min, max } = ENERGY.cost, base = `Coût : ${min} à ${max} ⚡`;
  return e && ok(e.value) && Math.round(e.value * 10) / 10 < min ? `${base} · pas assez d'énergie (${Math.round(e.value)}) : recharge-la en prison` : base;
}

/* contenu de la prison d'après les 10 dernières mines (profil du serveur, src/meta/prison-profile.js), pour le lobby :
   « Ta prison aura (d'après tes 7 dernières mines) : area 4 · minerais Fer 60 %, Or 30 % · treasures T2 70 %, T3 30 % ·
   mobs gobelin 50 %… » ; running : la prison qui tourne (son profil figé) */
const pctList = (parts, name) => Object.entries(parts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${name(k)} ${Math.round(v * 100)} %`).join(', ');
const MOB_NAMES = { bestiole:'bestiole', gobelin:'gobelin', mimic:'mimic', occultiste:'occultiste', mephite:'méphite', golem:'golem', chair:'mur de chair' };
export function prisonProfileText(p, running = false){
  if(!p) return '';
  const head = running ? 'Ta prison' : 'Ta prison aura';
  if(!(p.n > 0)) return `${head} : aucune mine classique dans ton historique, contenu de l'area ${p.area ?? PRISON.fallbackArea}.`;
  const parts = [`area ${p.area}`];
  if(p.ores) parts.push('minerais ' + pctList(p.ores, k => BLOCKS[IDS[k]]?.name ?? k));
  if(p.treasures) parts.push('treasures ' + pctList(p.treasures, k => k.replace('Treasure ', '')));
  parts.push(p.mobs ? 'mobs ' + pctList(p.mobs, k => MOB_NAMES[k] ?? k) : "mobs de l'area");
  return `${head} (d'après tes ${p.n} dernière${p.n > 1 ? 's' : ''} mine${p.n > 1 ? 's' : ''}) : ${parts.join(' · ')}.`;
}

/* temps de jeu « 1 h 07 », « 12 min », « 40 s » (secondes) */
export const gameTime = s => { if(!ok(s) || s < 60) return `${Math.max(0, Math.round(ok(s) ? s : 0))} s`;
  const min = Math.floor(s / 60); return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`; };
/* totaux de la prison (publicPrison.totals) : « 3 runs · 1 h 07 de jeu · +1 234 XP · +12 ⚡ · 2 450 objets » ;
   live : secondes du run en cours, ajoutées au temps de jeu (le panneau pendant la prison) */
export function prisonTotalsLine(t, live = 0){
  if(!t) return '';
  const items = Object.values(t.bag ?? {}).reduce((s, n) => s + (ok(n) ? n : 0), 0);
  return [`${t.runs | 0} run${(t.runs | 0) > 1 ? 's' : ''}`, `${gameTime((t.t || 0) + (ok(live) ? live : 0))} de jeu`, `+${nf(t.xp || 0)} XP`,
          `+${nf(t.energy || 0)} ⚡`, `${nf(items)} objet${items > 1 ? 's' : ''}`].join(' · ');
}

/* une prison qui tourne ou attend (pas fermée) */
export const prisonActive = p => p?.state === 'running' || p?.state === 'waiting';
/* bilan d'absence à montrer (envoyé une seule fois par le serveur) */
export const hasAway = p => !!(p?.away && (p.away.runs > 0 || p.away.energy > 0 || Object.keys(p.away.bag ?? {}).length));

/* temps avant la pause (plafond de 24 h sans visite) : « 23 h », « 25 min » */
function untilText(ms){
  const min = Math.max(0, ms) / 60e3;
  return min >= 60 ? `${Math.round(min / 60)} h` : `${Math.max(1, Math.ceil(min))} min`;
}

/* Bandeau au-dessus de la prison : « Run 4 · 61 / 80 % des minerais · +12 ⚡ · pause dans 23 h ».
   Minerais : part des minerais de la carte déjà minée (mined / goal ramené au seuil PRISON.resetAt), sur le seuil de fin
   de run. Énergie : gagnée depuis le début de cette prison. p : publicPrison du serveur ; now : heure du serveur (ms). */
export function prisonBanner(p, now = Date.now()){
  if(!prisonActive(p)) return '';
  const parts = [`Run ${p.run}`];
  if(ok(p.mined) && ok(p.goal) && p.goal > 0){
    const seuil = Math.round(PRISON.resetAt * 100);
    parts.push(`${Math.min(seuil, Math.floor(p.mined / p.goal * seuil))} / ${seuil} % des minerais`);
  }
  if(ok(p.energy)) parts.push(`+${Math.round(p.energy)} ⚡`);
  parts.push(p.state === 'waiting' ? `en pause (${Math.round(PRISON.offlineMax / 3600e3)} h sans visite)` : ok(p.waitAt) ? `pause dans ${untilText(p.waitAt - now)} sans visite` : '');
  return parts.filter(Boolean).join(' · ');
}

/* Bilan au retour : « Pendant ton absence : 14 runs, + 334 ressources, + 112 énergie. » ; '' s'il n'y a rien */
export function awayText(a){
  if(!a || !(a.runs > 0)) return '';
  const res = Object.values(a.bag ?? {}).reduce((s, n) => s + (ok(n) ? n : 0), 0);
  return `Pendant ton absence : ${a.runs} run${a.runs > 1 ? 's' : ''}`+
    (res > 0 ? `, + ${nf(res)} ressources` : '')+
    (ok(a.energy) && a.energy > 0 ? `, + ${nf(a.energy)} énergie` : '')+'.';
}

/* ---------- confirmations (relecture finale, 29/10) : lancer une mine, une tour ou une instance termine la prison de
   chaque joueur du groupe (le serveur l'arrête au lancement) ---------- */
const LOOT = 'pas ce que le mineur porte sur lui.';
const listFr = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
/* Lancer (seul ou chef) : '' s'il n'y a rien à terminer ; sinon la question, qui nomme les membres dont la prison sera
   arrêtée. mine : sa prison tourne (la sienne, publicPrison) ; party : vue du groupe (members[].prison, du serveur). */
export function launchPrisonText({ mine = false, party = null, meId = null } = {}){
  const others = (party?.members ?? []).filter(m => m.account !== meId && m.prison).map(m => m.name || 'un joueur');
  if(!mine && !others.length) return '';
  const who = [mine && 'ta prison', others.length && `la prison de ${listFr(others)}`].filter(Boolean).join(' et ');
  return `Lancer termine ${who}.\nLe coffre du run en cours est versé dans ${others.length ? 'l\'inventaire de chacun' : 'ton inventaire'}, ${LOOT}`;
}
/* Membre : « Je suis prêt » ou « Prêt tout le temps » (always) alors que sa prison tourne : '' sinon */
export function readyPrisonText({ prison, always = false } = {}){
  if(!prisonActive(prison)) return '';
  return `${always ? 'Prêt tout le temps' : 'Prêt'} : quand le chef lance, ta prison est terminée.\n`+
    `Le coffre du run en cours est versé dans ton inventaire, ${LOOT}`;
}

/* Sondage de la prison en erreur (errors : erreurs de suite) : déconnecté (401) → arrêt ; plus de session ou de prison
   côté serveur → état relu ; sinon nouvel essai, délai doublé à chaque erreur (PRISON.uiRetry … PRISON.uiPoll). */
export function prisonPollError(e, errors = 1){
  if(e?.status === 401) return { action: 'stop' };
  if(e?.code === 'no_session' || e?.code === 'no_prison') return { action: 'refresh' };
  return { action: 'retry', delay: Math.min(PRISON.uiPoll, PRISON.uiRetry * 2 ** Math.max(0, errors - 1)) };
}
