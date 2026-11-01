/* Couche appli : barre des familles et sous-onglets (HTML). Les données viennent de families.js. */
import { pxi } from '../ui/pxicons.js';
import { FAMILIES, familyMarks, tabsOf, tabLabel } from './families.js';

const dot = on => on ? '<i class="dot"></i>' : '';

export function barHtml({ active, marks }){
  const fam = familyMarks(marks);
  return FAMILIES.map(f => `<button class="${f.id === active ? 'on' : ''}" data-family="${f.id}" aria-label="${f.label}">`+
    `${pxi(f.icon)}<span>${f.label}</span>${dot(fam.has(f.id))}</button>`).join('');
}

/* vide quand la famille n'a qu'un onglet à montrer : pas de rangée de sous-onglets */
export function subHtml({ family, current, marks, inSession }){
  const tabs = tabsOf(family, { inSession });
  if(tabs.length < 2) return '';
  return tabs.map(t => `<button class="${t === current ? 'on' : ''}" data-subtab="${t}">${tabLabel(t)}${dot(marks.has(t))}</button>`).join('');
}
