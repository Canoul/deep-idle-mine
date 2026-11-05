/* Événement du jour (05/11/2026, Geoffrey ; DAILY en config) : logique pure, partagée par le serveur (tirage, effets) et le
   jeu (affichage). État enregistré (ns daily, clé 'state') : { day: 'AAAA-MM-JJ', id, history: [{ day, id }] } (le plus récent
   à la fin, DAILY.keep jours gardés). Le jour est celui de Paris (minuit à minuit). */
import { DAILY } from '../config.js';
import { dayOf, dayEnd } from './giant.js';

export const dailyDay = now => dayOf(now, DAILY.timeZone);
export const dailyEnds = now => dayEnd(now, DAILY.timeZone);
/* définition d'un événement (null si inconnu) */
export const dailyDef = id => typeof id === 'string' ? DAILY.list.find(e => e.id === id) ?? null : null;

/* effets d'un événement (valeurs neutres sans événement ou pour un id inconnu) */
export function dailyFx(id){
  const d = dailyDef(id) ?? {};
  return {
    orePoints: d.orePoints ?? 0, energyMul: d.energyMul ?? 1, mobSpawnMul: d.mobSpawnMul ?? 1, mobFrom: d.mobFrom ?? 0,
    towerCap: d.towerCap ?? null, towersTogether: !!d.towersTogether,
    miW: d.miW ?? null, miH: d.miH ?? null, miDuration: d.miDuration ?? null,
    kholeMul: d.kholeMul ?? 1, raffleWinners: d.raffleWinners ?? 1, xpMul: d.xpMul ?? 1,
  };
}

/* relit l'état enregistré (abîmé : vide) */
export function sanitizeDaily(raw){
  const okDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const history = Array.isArray(raw?.history) ? raw.history.filter(h => okDay(h?.day) && dailyDef(h.id)).map(h => ({ day: h.day, id: h.id })).slice(-DAILY.keep) : [];
  return okDay(raw?.day) && dailyDef(raw.id) ? { day: raw.day, id: raw.id, history } : { day: null, id: null, history };
}

/* événements possibles le jour day : tous sauf ceux des DAILY.noRepeat jours d'avant (pas deux fois en moins de 3 jours).
   Les jours sans état (serveur éteint) ne comptent pas : on regarde les dates. */
export function dailyCandidates(day, history){
  const t = Date.parse(day + 'T12:00:00Z'), recent = new Set();
  for(const h of history){
    const gap = Math.round((t - Date.parse(h.day + 'T12:00:00Z')) / 86400e3);
    if(gap >= 1 && gap <= DAILY.noRepeat) recent.add(h.id);
  }
  const ok = DAILY.list.filter(e => !recent.has(e.id));
  return ok.length ? ok : DAILY.list;
}

/* passe à l'événement du jour de now si besoin ; renvoie true si l'état a changé (à enregistrer). random : [0, 1[ */
export function rollDaily(st, now, random = Math.random){
  const day = dailyDay(now);
  if(st.day === day) return false;
  const list = dailyCandidates(day, st.history);
  const e = list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  st.day = day; st.id = e.id;
  st.history = [...st.history.filter(h => h.day !== day), { day, id: e.id }].slice(-DAILY.keep);
  return true;
}

/* événement du jour où tombe l'heure t (historique gardé : DAILY.keep jours) ; null si inconnu */
export const dailyOn = (st, t) => { const d = dailyDay(t); return st?.day === d ? st.id : st?.history?.find(h => h.day === d)?.id ?? null; };

/* ce que voit le navigateur : { id, name, icon, desc, endsAt } ou null */
export function publicDaily(st, now){
  const d = st && st.day === dailyDay(now) ? dailyDef(st.id) : null;
  return d ? { id: d.id, name: d.name, icon: d.icon, desc: d.desc, endsAt: dailyEnds(now) } : null;
}

/* coût en énergie d'une mine avec l'événement id : le coût tiré × energyMul, arrondi, 1 au moins */
export const dailyCost = (cost, id) => { const m = dailyFx(id).energyMul; return m === 1 ? cost : Math.max(1, Math.round(cost * m)); };
