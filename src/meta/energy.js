/* Énergie du compte : progression hors session, logique pure (partagée par le jeu et le serveur).
   Enregistrement : { value (0..max, au dixième), keys:[clés d'opération déjà comptées] }. Débit et crédit sont
   idempotents : une même clé (id de session, « prison:<id>:<run> ») n'est comptée qu'une fois. */
import { ENERGY, DT } from '../config.js';

const tenth = n => Math.round(n * 10) / 10;
const clamp = n => Math.min(ENERGY.max, Math.max(0, n));

export function createEnergy(){ return { value: ENERGY.start, keys: [], at: null }; }   // at : dernier calcul du repos (ms, serveur)
export function sanitizeEnergy(e){
  const out = createEnergy();
  if(e && typeof e.value === 'number' && Number.isFinite(e.value)) out.value = tenth(clamp(e.value));
  if(Array.isArray(e?.keys)) out.keys = e.keys.filter(k => typeof k === 'string').slice(-ENERGY.memory);
  if(typeof e?.at === 'number' && Number.isFinite(e.at)) out.at = e.at;
  return out;
}
/* repos (30/10/2026) : ajoute l'énergie de repos entre from et now (ms réels, vitesse speed), plafonnée ; e.at = now.
   Renvoie le gain. from : début du repos (le serveur prend le plus tard entre e.at et la fin de la dernière activité) */
export function settleIdle(e, from, now, speed){
  const ms = Number.isFinite(from) ? Math.max(0, now - from) : 0;
  const before = e.value;
  e.value = tenth(clamp(e.value + ms / 3600e3 * speed * ENERGY.idlePerHour));
  e.at = now;
  return tenth(e.value - before);
}

export const canPay = e => e.value >= ENERGY.cost.min;
/* coût entier tiré dans cost.min..cost.max ; random : fonction → [0, 1[ */
export const rollCost = random =>
  ENERGY.cost.min + Math.min(ENERGY.cost.max - ENERGY.cost.min, Math.floor(random() * (ENERGY.cost.max - ENERGY.cost.min + 1)));

function remember(e, key){
  e.keys.push(key);
  if(e.keys.length > ENERGY.memory) e.keys.splice(0, e.keys.length - ENERGY.memory);
}
const validKey = (e, key) => !!key && typeof key === 'string' && !e.keys.includes(key);

/* débite cost (entier) ; false si clé déjà vue, coût invalide ou énergie insuffisante */
export function spendEnergy(e, key, cost){
  if(!validKey(e, key) || !Number.isSafeInteger(cost) || cost <= 0 || e.value < cost) return false;
  remember(e, key);
  e.value = tenth(e.value - cost);
  return true;
}
/* ajoute amount (plafonné à max) ; false si clé déjà vue ou montant invalide */
export function creditEnergy(e, key, amount){
  if(!validKey(e, key) || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return false;
  remember(e, key);
  e.value = tenth(clamp(e.value + amount));
  return true;
}
/* énergie gagnée en prison pendant ticks ticks de jeu */
export const energyOfTicks = ticks =>
  Number.isFinite(ticks) && ticks > 0 ? tenth(ticks * DT / 3600 * ENERGY.prisonPerHour) : 0;
export const publicEnergy = e => ({ value: Math.round(e.value), max: ENERGY.max });
