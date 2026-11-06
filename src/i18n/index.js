/* Traduction du jeu (03/11/2026, Geoffrey ; I18N en config). Le français est la langue d'écriture : le code garde ses
   textes en français, et t() les traduit dans la langue choisie. Le texte français EST la clé (pas de « ui.login.btn ») :
   le code reste lisible, et un texte pas encore traduit s'affiche en français.

   t('Encore {n} tours', { n: 3 })   → « Encore 3 tours » / « 3 more towers »
   tn('Pioche en pierre')            → nom affiché d'un objet, bloc, mob… (l'identifiant ne change jamais : sauvegardes,
                                        recettes et serveur gardent le nom français)

   Dictionnaires : ./en/*.js (un objet { 'texte français': 'English text' } par fichier). Logique pure : aussi utilisée
   par le serveur et les tests. */
import { I18N } from '../config.js';
import EN_UI from './en/ui.js';
import EN_NAMES from './en/names.js';

const DICTS = { en: { ui: EN_UI, names: EN_NAMES } };
let cur = I18N.base;
const listeners = new Set();

export const LANGS = I18N.langs;
export const I18N_BASE = I18N.base;
export const isLang = l => typeof l === 'string' && LANGS.includes(l);
export const getLang = () => cur;
/* change la langue (inconnue : français) ; prévient les écrans abonnés (onLang) */
export function setLang(l){
  const next = isLang(l) ? l : I18N.base;
  if(next === cur) return;
  cur = next;
  for(const fn of listeners) fn(cur);
}
export const onLang = fn => { listeners.add(fn); return () => listeners.delete(fn); };

const fill = (s, p) => p ? s.replace(/\{(\w+)\}/g, (m, k) => Object.hasOwn(p, k) ? String(p[k]) : m) : s;
/* texte d'interface ; lang : une autre langue que celle en cours (ex. le serveur, pour un joueur précis) */
export function t(fr, params, lang = cur){
  const d = lang === I18N.base ? null : DICTS[lang]?.ui;
  return fill(d && Object.hasOwn(d, fr) ? d[fr] : fr, params);
}
/* nom d'un objet, bloc, mob, skill, sort… (identifiant français) */
export function tn(id, lang = cur){
  if(typeof id !== 'string') return id;
  const d = lang === I18N.base ? null : DICTS[lang]?.names;
  return d && Object.hasOwn(d, id) ? d[id] : id;
}
/* pour les tests : les dictionnaires d'une langue */
export const dictOf = lang => DICTS[lang] ?? null;
/* langue de départ, avant la connexion : celle du navigateur si elle est ouverte aux joueurs (ou dev) */
export const guessLang = (navLang, allowed = I18N.open) => allowed && typeof navLang === 'string' && navLang.toLowerCase().startsWith('en') ? 'en' : I18N.base;
