/* Traducteur de la page (06/11/2026, Geoffrey ; étape 3 du chantier, docs/traduction-anglais.md).
   Le code de l'interface garde ses textes en français ; quand la langue n'est pas le français, ce module remplace à
   l'affichage chaque texte connu par sa traduction : nœuds de texte et attributs (title, placeholder, aria-label, data-tip,
   alt), au chargement puis à chaque changement de la page (MutationObserver). Rien n'est installé en français.

   Dictionnaire : src/i18n/en/ui.js. Une clé est un texte tel qu'il s'affiche (sans les espaces du bord) ; une clé avec
   {x} est un modèle : « Encore {n} tours » traduit « Encore 3 tours » (les valeurs sont elles-mêmes traduites si elles sont
   connues : un nom d'objet, un mot de l'interface) ; {#n} n'accepte qu'un nombre. data-tip : ligne par ligne.
   Jamais traduits : [data-noi18n] (pseudos, messages des joueurs, noms de guilde et de set : pn() de index.js), champs
   de saisie, canvas. Le chat est traduit sauf ces parties : les messages du jeu (Raffle…) passent en anglais.
   Mode dev : window.__i18nMissing = textes français vus sans traduction (pour compléter le dictionnaire). */
import { getLang, dictOf, I18N_BASE } from './index.js';

const SKIP = 'noscript, [data-noi18n], input, textarea, select option[data-raw], script, style, [contenteditable="true"], canvas';
const SKIP_ATTR = 'noscript, [data-noi18n], script, style';   // attributs : aussi ceux des champs (placeholder d'un <input>, 06/11)
const ATTRS = ['title', 'placeholder', 'aria-label', 'data-tip', 'alt'];
const FRENCH = /[éèêàùçôîâœ]|\b(le|la|les|des|du|une?|ton|ta|tes|pour|avec|sans|dans|est|pas|plus|de|et|ou|au|aux|en|sur)\b/i;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* traducteur pur (testé sans navigateur) : chaîne → chaîne */
export function createTranslator(ui, names = {}, { onMissing } = {}){
  const exact = new Map(), buckets = new Map(), loose = [];
  for(const [fr, en] of Object.entries(ui)){
    if(!fr.includes('{')){ exact.set(fr, en); continue; }
    const keys = [], deep = new Set();
    /* {#n} : un nombre seulement (« {#n} {item} » traduit « 5 Pépite d'argent » sans toucher « Mineur test 1 ») ;
       {*x} : un texte lui-même traduisible en entier (wiki : « {*a} par rang (max : {*b}) ») */
    const src = '^' + fr.split(/(\{[#*]?\w+\})/).map(part => {
      const m = part.match(/^\{([#*]?)(\w+)\}$/);
      if(m){ keys.push(m[2]); if(m[1] === '*') deep.add(m[2]); return m[1] === '#' ? '([\\d][\\d\\s.,]*)' : '(.*?)'; }
      return esc(part);
    }).join('') + '$';
    const lit = fr.replace(/\{[#*]?\w+\}/g, '');
    const p = { re: new RegExp(src, 's'), keys, deep, en, lit: lit.replace(/[^\p{L}]/gu, '').length };   // lit : lettres fixes
    const head = fr.match(/^[^{\s]+/)?.[0];
    if(head){ if(!buckets.has(head)) buckets.set(head, []); buckets.get(head).push(p); } else loose.push(p);
  }
  for(const list of [...buckets.values(), loose]) list.sort((a, b) => b.lit - a.lit || b.re.source.length - a.re.source.length);   // le plus précis d'abord (le plus de mots fixes)
  /* une valeur variable est traduite si elle est connue (texte, nom, ou elle-même un modèle : « 10 énergie ») */
  const known = (v, depth, deep = false) => { const t = v.trim();
    /* « 10 énergie » seulement ; deep ({*x} : « {*a} par rang (max : {*b}) ») : tout texte traduisible */
    const one = exact.get(t) ?? (Object.hasOwn(names, t) ? names[t] : depth > 0 && (deep || /^\d[\d\s.,]*\s\S+$/.test(t)) ? core(t, depth - 1) : null);
    if(one != null || depth <= 0 || !t.includes(', ')) return one;
    /* liste « Épée en mithril, Clé d'instance I » : chaque élément connu (wiki, 06/11) */
    const items = t.split(', ').map(x => known(x, 0));
    return items.every(x => x != null) ? items.join(', ') : null; };
  const core = (s, depth = 2) => {
    if(exact.has(s)) return exact.get(s);
    if(Object.hasOwn(names, s)) return names[s];
    /* modèles dont le début fixe (« R » de « R{a} {b} », « Encore » de « Encore {n} tours ») ouvre ce texte */
    const first = s.match(/^[^\s]+/)?.[0] ?? '', cand = [];
    for(let n = Math.min(first.length, 24); n > 0; n--) for(const p of buckets.get(first.slice(0, n)) ?? []) cand.push(p);
    for(const p of [...cand, ...loose]){
      const m = s.match(p.re);
      if(!m) continue;
      /* une valeur variable doit être simple (nombre, nom connu, texte sans français) ou traduisible : sinon un modèle
         court comme « {a} et {b} » traduirait un mot au milieu d'une phrase française */
      const vals = {}; let ok = true;
      p.keys.forEach((k, i) => { const v = m[i + 1], tr = known(v, depth, p.deep.has(k));
        if(tr == null && (FRENCH.test(v) || (!p.lit && /\p{L}/u.test(v)) || (p.lit <= 4 && /(^|\s)\p{Ll}/u.test(v.trim())))) ok = false;
        /* modèle sans mot fixe : ses mots doivent être connus ; modèle court (« Le {a} », « de {a} ») : pas de mot inconnu en
           minuscules (« Le donjon » restait « The donjon » ; un nom propre, un pseudo passent) */
        vals[k] = tr ?? v; });
      if(!ok) continue;
      return p.en.replace(/\{(\w+)\}/g, (x, k) => vals[k] ?? x);
    }
    /* ligne en morceaux « a · b · c » : chaque morceau traduit à part, si tous le sont (ou n'ont rien de français) */
    if(depth > 0 && s.includes(' · ')){
      const parts = s.split(' · '), out = parts.map(x => core(x.trim(), depth - 1));
      if(out.some(Boolean) && out.every((o, i) => o != null || !FRENCH.test(parts[i]))) return out.map((o, i) => o ?? parts[i]).join(' · ');
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

/* textes dessinés dans un canvas (noms des bâtiments du Carreau…) : même traduction que la page, rien en français */
let active = null;
export const trText = s => active && typeof s === 'string' ? active(s) : s;

/* mode « bloc » (wiki, 06/11/2026) : un paragraphe, une ligne de liste, une cellule… sans bloc à l'intérieur est traduit d'un
   coup, mise en forme comprise (<b>, <a>, <code>…) : sa clé est son innerHTML aux espaces resserrés, avec {#n} à la place
   des nombres qui viennent de la config (relevé dans le
   navigateur : en anglais, window.__i18nBlocks liste les blocs sans traduction). Les textes restants passent ensuite par
   le traducteur normal. */
const BLOCKS = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'TD', 'TH', 'DT', 'DD', 'FIGCAPTION', 'SUMMARY', 'CAPTION', 'LABEL', 'BUTTON', 'DIV', 'SPAN', 'A']);
const INNER = 'p, li, h1, h2, h3, h4, td, th, dt, dd, figcaption, summary, caption, div, section, ul, ol, table, tr, details, dl';
export const blockKey = el => el.innerHTML.replace(/\s+/g, ' ').trim();
export const isLeafBlock = el => BLOCKS.has(el.tagName) && !el.querySelector(INNER) && /\p{L}{2}/u.test(el.textContent);

/* installe le traducteur sur la page ; ne fait rien en français. blocks : dictionnaire des blocs (wiki) */
export function installPageTranslator(doc = document, { dev = false, blocks = null } = {}){
  const lang = getLang();
  if(lang === I18N_BASE || !dictOf(lang)) return null;
  /* mode dev : __i18nMissing = textes qui ont l'air français ; __i18nSeen = tous les textes laissés tels quels */
  const missing = dev ? (globalThis.__i18nMissing = new Set()) : null, seen = dev ? (globalThis.__i18nSeen = new Set()) : null;
  const tr = createTranslator(dictOf(lang).ui, dictOf(lang).names, missing ? { onMissing: (t, fr) => { seen.add(t); if(fr) missing.add(t); } } : {});
  const skip = el => !!el?.closest?.(SKIP);
  const text = n => { if(skip(n.parentElement)) return; const v = n.nodeValue, o = tr(v); if(o !== v) n.nodeValue = o; };
  const attrs = el => { if(el?.closest?.(SKIP_ATTR)) return; for(const a of ATTRS){ const v = el.getAttribute?.(a); if(v){ const o = tr(v); if(o !== v) el.setAttribute(a, o); } } };
  const btr = blocks ? createTranslator(blocks, dictOf(lang).names) : null;   // blocs : mêmes modèles ({#n} : les chiffres de la config)
  const block = el => { if(!blocks || !isLeafBlock(el)) return; const k = blockKey(el), o = btr(k);
    if(o !== k) el.innerHTML = o; else if(missing && /\p{L}{3}/u.test(el.textContent)){ (globalThis.__i18nBlocks ??= new Set()).add(k); el.__i18nKey = k; } };   // __i18nKey : relevé (le bloc reste-t-il français ?)
  const walk = root => {
    if(root.nodeType === 3) return text(root);
    if(root.nodeType !== 1) return;
    if(skip(root)) return attrs(root);   // un champ ajouté : son placeholder
    if(blocks){ if(isLeafBlock(root)) block(root); else for(const el of root.querySelectorAll('*')) if(!skip(el)) block(el); }
    attrs(root);
    const it = doc.createTreeWalker(root, 5 /* éléments + textes */);
    for(let n = it.nextNode(); n; n = it.nextNode()) n.nodeType === 3 ? text(n) : attrs(n);
  };
  active = tr;
  walk(doc.body);
  doc.title = tr(doc.title);
  const obs = new MutationObserver(list => {
    for(const m of list){
      if(m.type === 'characterData') text(m.target);
      else if(m.type === 'attributes') attrs(m.target);
      else { if(blocks && m.target.nodeType === 1 && !skip(m.target)) block(m.target); for(const n of m.addedNodes) if(n.isConnected) walk(n); }   // bloc rempli après coup (wiki : innerHTML d'un <li> vide)
    }
  });
  obs.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  return { translate: tr, stop: () => obs.disconnect() };
}
