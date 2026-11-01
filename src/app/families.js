/* Couche appli : les 5 familles d'onglets de la barre du bas (spec de l'appli, « Navigation téléphone »).
   Logique pure, sans DOM. Un nouvel onglet de TABS doit être rangé ici (test garde-fou, tests/app-families.test.js). */
import { TABS, CHAT_TAB } from '../ui/nav.js';

export const FAMILIES = [
  { id:'accueil', label:'Accueil', icon:'house',   tabs:['lobby'] },
  { id:'session', label:'Session', icon:'pickaxe', tabs:['session', 'historique'] },
  { id:'sac',     label:'Sac',     icon:'bag',     tabs:['inventaire', 'four', 'concasseur', 'craft', 'recherche'] },
  { id:'perso',   label:'Perso',   icon:'helmet',  tabs:['stuff', 'amelioration', 'skills', 'sorts'] },
  { id:'social',  label:'Social',  icon:'group',   tabs:['social', 'guilde', 'chat'] },
];

export const familyOf = tab => FAMILIES.find(f => f.tabs.includes(tab))?.id ?? null;

/* hors session, l'onglet Session n'a rien à montrer : la famille ne garde que l'Historique (Geoffrey, 01/11) */
export function tabsOf(family, { inSession }){
  const tabs = FAMILIES.find(f => f.id === family)?.tabs ?? [];
  return inSession ? tabs : tabs.filter(t => t !== 'session');
}

/* onglet à ouvrir quand on touche une famille : celui retenu s'il est encore valable, sinon le premier */
export function targetTab(family, remembered, ctx){
  const tabs = tabsOf(family, ctx);
  return tabs.includes(remembered) ? remembered : tabs[0];
}

/* changement d'onglet automatique : l'onglet Session vide donne l'Historique, et une session qui apparaît pendant
   qu'on est sur l'Historique (page rechargée, session retrouvée) ramène à la mine. shown : Session a quelque chose à montrer */
export function sessionRedirect({ tab, shown, wasShown }){
  if(tab === 'session' && !shown) return 'historique';
  if(tab === 'historique' && shown && !wasShown) return 'session';
  return null;
}

export const tabLabel =id => [...TABS, CHAT_TAB].find(t => t.id === id)?.label ?? id;

/* pastilles d'onglets (Set) → familles à marquer (Set) */
export const familyMarks = marks => new Set([...marks].map(familyOf).filter(Boolean));
