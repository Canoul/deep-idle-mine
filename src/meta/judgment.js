/* Jugement (concept Ange vs Démon, spec docs/superpowers/specs/2026-10-22-ange-demon-design.md) : deux jauges
   communes à tous les joueurs. Logique pure, partagée par le serveur (qui fait foi) et les tests.

   État : { angel:{ count, openUntil, opening }, demon:{…}, done:{ angel:{ opening, accounts:[…] }, demon:{…} } }
   - count : résidus rapportés depuis la dernière ouverture (0 à JUDGMENT.cap) ;
   - openUntil : heure (ms) de fermeture de la tour (0 = jamais ouverte) ; opening : numéro de la dernière ouverture ;
   - done : comptes qui ont déjà gagné un coffre pendant l'ouverture `opening` (une seule fois par ouverture).
   Jauge pleine et tour fermée → ouverture tout de suite pour JUDGMENT.openHours, jauge à 0 (surplus perdu). Pleine
   pendant une ouverture : elle reste à cap et la tour rouvre dès la fin de l'ouverture en cours (refresh). */
import { JUDGMENT } from '../config.js';

export const SIDES = Object.keys(JUDGMENT.sides);
const OPEN_MS = JUDGMENT.openHours * 3600e3;
const nat = v => Number.isSafeInteger(v) && v >= 0 ? v : 0;

export function createJudgment(){
  const j = { done:{} };
  for(const s of SIDES){ j[s] = { count:0, openUntil:0, opening:0 }; j.done[s] = { opening:0, accounts:[] }; }
  return j;
}

/* relecture du stockage, revérifiée à chaque fois */
export function sanitizeJudgment(raw){
  const j = createJudgment();
  if(!raw || typeof raw !== 'object') return j;
  for(const s of SIDES){
    const r = raw[s] || {};
    j[s].count = Math.min(JUDGMENT.cap, Number.isFinite(r.count) && r.count > 0 ? Math.floor(r.count) : 0);
    j[s].openUntil = nat(r.openUntil);
    j[s].opening = nat(r.opening);
    const d = raw.done?.[s];
    if(d && nat(d.opening) === j[s].opening && Array.isArray(d.accounts))
      j.done[s] = { opening: j[s].opening, accounts: [...new Set(d.accounts.filter(a => typeof a === 'string'))] };
    else j.done[s].opening = j[s].opening;
  }
  return j;
}

export const isOpen = (j, side, now) => now < j[side].openUntil;

/* ouvre les tours dont la jauge est pleine et qui sont fermées ; true si quelque chose a changé */
export function refresh(j, now){
  let changed = false;
  for(const s of SIDES){
    const g = j[s];
    if(g.count >= JUDGMENT.cap && !isOpen(j, s, now)){
      g.count = 0; g.opening++; g.openUntil = now + OPEN_MS;
      j.done[s] = { opening: g.opening, accounts: [] };
      changed = true;
    }
  }
  return changed;
}

/* résidus d'un sac versé à un joueur (bag : { objet: quantité }) ; true si une jauge a bougé */
export function addResidues(j, bag, now){
  let changed = false;
  for(const s of SIDES){
    const n = bag?.[JUDGMENT.sides[s].item];
    if(!Number.isSafeInteger(n) || n <= 0) continue;
    const g = j[s], before = g.count;
    g.count = Math.min(JUDGMENT.cap, g.count + n);
    if(g.count !== before) changed = true;
  }
  return refresh(j, now) || changed;
}

export const hasDone = (j, side, account) => j.done[side].opening === j[side].opening && j.done[side].accounts.includes(account);
/* note qu'un joueur a gagné le coffre de l'ouverture en cours ; false s'il l'avait déjà */
export function markDone(j, side, account){
  if(hasDone(j, side, account)) return false;
  if(j.done[side].opening !== j[side].opening) j.done[side] = { opening: j[side].opening, accounts: [] };
  j.done[side].accounts.push(account);
  return true;
}

/* ce que voit un joueur (onglet Jugement, lobby) */
export function publicJudgment(j, now, account){
  const sides = {};
  for(const s of SIDES) sides[s] = { count: j[s].count, cap: JUDGMENT.cap, open: isOpen(j, s, now), openUntil: j[s].openUntil,
                                     done: !!account && hasDone(j, s, account) };
  return { sides, now };
}
