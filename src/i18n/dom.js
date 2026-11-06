/* Traducteur de la page (06/11/2026, Geoffrey ; étape 3 du chantier, docs/traduction-anglais.md).
   Le code de l'interface garde ses textes en français ; quand la langue n'est pas le français, ce module remplace à
   l'affichage chaque texte connu par sa traduction : nœuds de texte et attributs (title, placeholder, aria-label, data-tip,
   alt), au chargement puis à chaque changement de la page (MutationObserver). Rien n'est installé en français.

   Dictionnaire : src/i18n/en/ui.js. Une clé est un texte tel qu'il s'affiche (sans les espaces du bord) ; une clé avec
   {x} est un modèle : « Encore {n} tours » traduit « Encore 3 tours » (les valeurs sont elles-mêmes traduites si elles sont
   connues : un nom d'objet, un mot de l'interface). data-tip : ligne par ligne.
   Jamais traduits : chat, champs de saisie, [data-noi18n] (pseudos, messages de guilde…), canvas.
   Mode dev : window.__i18nMissing = textes français vus sans traduction (pour compléter le dictionnaire). */
import { getLang, dictOf, I18N_BASE } from './index.js';

const SKIP = 'noscript, .chatLog, .chatPanel, [data-noi18n], input, textarea, select option[data-raw], script, style, [contenteditable="true"], canvas';
const ATTRS = ['title', 'placeholder', 'aria-label', 'data-tip', 'alt'];
const FRENCH = /[éèêàùçôîâœ]|\b(le|la|les|des|du|une?|ton|ta|tes|pour|avec|sans|dans|est|pas|plus|de|et|ou|au|aux|en|sur)\b/i;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* traducteur pur (testé sans navigateur) : chaîne → chaîne */
export function createTranslator(ui, names = {}, { onMissing } = {}){
  const exact = new Map(), buckets = new Map(), loose = [];
  for(const [fr, en] of Object.entries(ui)){
    if(!fr.includes('{')){ exact.set(fr, en); continue; }
    const keys = [];
    const src = '^' + fr.split(/(\{\w+\})/).map(part => {
      const m = part.match(/^\{(\w+)\}$/);
      if(m){ keys.push(m[1]); return '(.*?)'; }
      return esc(part);
    }).join('') + '$';
    const p = { re: new RegExp(src, 's'), keys, en };
    const head = fr.match(/^[^{\s]+/)?.[0];
    if(head){ if(!buckets.has(head)) buckets.set(head, []); buckets.get(head).push(p); } else loose.push(p);
  }
  for(const list of [...buckets.values(), loose]) list.sort((a, b) => b.re.source.length - a.re.source.length);   // le plus précis d'abord
  const value = v => exact.get(v.trim()) ?? names[v.trim()] ?? v;
  const core = s => {
    if(exact.has(s)) return exact.get(s);
    if(Object.hasOwn(names, s)) return names[s];
    /* modèles dont le début fixe (« R » de « R{a} {b} », « Encore » de « Encore {n} tours ») ouvre ce texte */
    const first = s.match(/^[^\s]+/)?.[0] ?? '', cand = [];
    for(let n = Math.min(first.length, 24); n > 0; n--) for(const p of buckets.get(first.slice(0, n)) ?? []) cand.push(p);
    for(const p of [...cand, ...loose]){
      const m = s.match(p.re);
      if(!m) continue;
      /* une valeur variable doit être simple (nombre, nom connu, texte sans français) : sinon un modèle court comme
         « {a} et {b} » traduirait un mot au milieu d'une phrase française */
      if(m.slice(1).some(v => FRENCH.test(v) && !exact.has(v.trim()) && !Object.hasOwn(names, v.trim()))) continue;
      const vals = Object.fromEntries(p.keys.map((k, i) => [k, value(m[i + 1])]));
      return p.en.replace(/\{(\w+)\}/g, (x, k) => vals[k] ?? x);
    }
    return null;
  };
  const one = text => {
    const t = text.trim();
    if(!t || !/\p{L}/u.test(t)) return text;
    const out = core(t);
    if(out == null){ if(onMissing) onMissing(t, FRENCH.test(t)); return text; }
    return text.replace(t, () => out);   // garde les espaces du bord
  };
  return text => text.includes('\n') ? text.split('\n').map(one).join('\n') : one(text);
}

/* installe le traducteur sur la page ; ne fait rien en français */
export function installPageTranslator(doc = document, { dev = false } = {}){
  const lang = getLang();
  if(lang === I18N_BASE || !dictOf(lang)) return null;
  /* mode dev : __i18nMissing = textes qui ont l'air français ; __i18nSeen = tous les textes laissés tels quels */
  const missing = dev ? (globalThis.__i18nMissing = new Set()) : null, seen = dev ? (globalThis.__i18nSeen = new Set()) : null;
  const tr = createTranslator(dictOf(lang).ui, dictOf(lang).names, missing ? { onMissing: (t, fr) => { seen.add(t); if(fr) missing.add(t); } } : {});
  const skip = el => !!el?.closest?.(SKIP);
  const text = n => { if(skip(n.parentElement)) return; const v = n.nodeValue, o = tr(v); if(o !== v) n.nodeValue = o; };
  const attrs = el => { if(skip(el)) return; for(const a of ATTRS){ const v = el.getAttribute?.(a); if(v){ const o = tr(v); if(o !== v) el.setAttribute(a, o); } } };
  const walk = root => {
    if(root.nodeType === 3) return text(root);
    if(root.nodeType !== 1 || skip(root)) return;
    attrs(root);
    const it = doc.createTreeWalker(root, 5 /* éléments + textes */);
    for(let n = it.nextNode(); n; n = it.nextNode()) n.nodeType === 3 ? text(n) : attrs(n);
  };
  walk(doc.body);
  doc.title = tr(doc.title);
  const obs = new MutationObserver(list => {
    for(const m of list){
      if(m.type === 'characterData') text(m.target);
      else if(m.type === 'attributes') attrs(m.target);
      else for(const n of m.addedNodes) walk(n);
    }
  });
  obs.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  return { translate: tr, stop: () => obs.disconnect() };
}
