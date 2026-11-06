/* Relevé des textes d'interface à traduire (06/11/2026, chantier du jeu en anglais) :
   node scripts/i18n-extract.js [--missing]  → JSON { texte français: fichier } sur la sortie
   Sources : index.html, journal et actions de la simulation (src/sim), messages du serveur (server, sauf admin et db), (textes et attributs title / placeholder / aria-label / data-tip / alt), littéraux et gabarits des
   modules d'interface (src/ui, src/app, src/main.js, src/wiki), textes de la config (desc, short, label, tip, text, note…).
   Un gabarit `Prêt dans ${left} s` donne le modèle « Prêt dans {a} s » ; le HTML est découpé aux balises comme à
   l'affichage. --missing : seulement ceux qui n'ont pas encore leur anglais (src/i18n/en/ui.js et names.js). */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FRENCH = /[éèêàùçôîâœ]|\b(le|la|les|des|du|une?|ton|ta|tes|pour|avec|sans|dans|est|pas|plus|de|et|ou|au|aux|en|sur|tu|ton|il|elle|on)\b/i;
const out = new Map();
const add = (s, where) => {
  s = s.replace(/[ \t]+/g, ' ').trim();
  if(s.length < 2 || !/\p{L}{2}/u.test(s) || !FRENCH.test(s.replace(/\{\w+\}/g, ''))) return;
  if(/^[a-z_$][\w$]*(\.[\w$]+)+$/.test(s) || /^[#.\[][\w-]/.test(s)) return;   // chemins, sélecteurs
  if(!out.has(s)) out.set(s, where);
};
/* texte HTML (avec {a} déjà posés) → fragments affichés */
const fromHtml = (html, where) => {
  const attr = /\b(?:title|placeholder|aria-label|data-tip|alt)="([^"]*)"/g;
  for(const m of html.matchAll(attr)) for(const line of m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').split(/\\n|\n/)) add(line, where);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, '\u0000');
  for(const part of text.split('\u0000')) for(const line of part.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').split(/\\n|\n/)) add(line, where);
};

/* gabarit JS : ${…} → {a} {b}… (en sautant les accolades imbriquées) */
function templateParts(src, start){
  let i = start + 1, s = '', k = 0;
  const vars = 'abcdefghijklmnopqrstuvwxyz';
  while(i < src.length && src[i] !== '`'){
    if(src[i] === '\\'){ s += src[i] + src[i + 1]; i += 2; continue; }
    if(src[i] === '$' && src[i + 1] === '{'){
      let depth = 1; i += 2;
      while(i < src.length && depth){ if(src[i] === '{') depth++; else if(src[i] === '}') depth--; else if(src[i] === '`'){ const r = templateParts(src, i); i = r.end; } i++; }
      s += `{${vars[k++ % 26]}}`; continue;
    }
    s += src[i++];
  }
  return { text: s, end: i };
}
function fromJs(file){
  const src = fs.readFileSync(file, 'utf8'), where = path.relative(ROOT, file);
  let i = 0;
  while(i < src.length){
    const c = src[i];
    if(c === '/' && src[i + 1] === '/'){ i = src.indexOf('\n', i); if(i < 0) break; continue; }
    if(c === '/' && src[i + 1] === '*'){ i = src.indexOf('*/', i) + 2; if(i < 2) break; continue; }
    if(c === "'" || c === '"'){
      let j = i + 1, s = '';
      while(j < src.length && src[j] !== c && src[j] !== '\n'){ if(src[j] === '\\'){ s += src[j + 1] === 'n' ? '\\n' : src[j + 1]; j += 2; continue; } s += src[j++]; }
      fromHtml(s, where); i = j + 1; continue;
    }
    if(c === '`'){ const r = templateParts(src, i); fromHtml(r.text.replace(/\\`/g, '`').replace(/\\'/g, "'"), where); i = r.end + 1; continue; }
    i++;
  }
}
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => f.isDirectory() ? walk(path.join(d, f.name)) : f.name.endsWith('.js') ? [path.join(d, f.name)] : []);

fromHtml(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), 'index.html');
for(const f of [...walk(path.join(ROOT, 'src/ui')), ...walk(path.join(ROOT, 'src/app')), ...walk(path.join(ROOT, 'src/meta')), ...walk(path.join(ROOT, 'src/shared')), ...walk(path.join(ROOT, 'src/sim')), ...walk(path.join(ROOT, 'src/wiki')),
  ...walk(path.join(ROOT, 'server')).filter(f => !/[\\/](admin|db)[\\/]/.test(f)), path.join(ROOT, 'src/main.js')]) fromJs(f);   // sim et serveur : journal, actions, erreurs (06/11)
/* config : textes affichés (pas les noms, déjà dans names.js) */
const C = await import(path.join(ROOT, 'src/config.js'));
const TEXT = new Set(['desc', 'short', 'tip', 'text', 'note', 'help', 'hint', 'msg', 'title', 'label', 'tab', 'unit', 'units', 'line', 'lines', 'sub', 'info', 'detail', 'details']);
const seen = new WeakSet();
const cfg = (o, d = 0) => { if(!o || typeof o !== 'object' || seen.has(o) || d > 8) return; seen.add(o);
  for(const [k, v] of Object.entries(o)){
    /* champs de texte connus, ou toute phrase (une valeur avec des espaces qui sonne français : descriptions des glyphes…) */
    if(typeof v === 'string' && (TEXT.has(k) || (/\s\S+\s/.test(v) && v.length > 12))) for(const l of v.split('\n')) add(l, 'src/config.js');
    else if(v && typeof v === 'object') cfg(v, d + 1); } };
for(const v of Object.values(C)) cfg(v);

let list = [...out];
if(process.argv.includes('--missing')){
  const ui = (await import(path.join(ROOT, 'src/i18n/en/ui.js'))).default, names = (await import(path.join(ROOT, 'src/i18n/en/names.js'))).default;
  list = list.filter(([s]) => !Object.hasOwn(ui, s) && !Object.hasOwn(names, s));
}
process.stdout.write(JSON.stringify(Object.fromEntries(list), null, 1) + '\n');
console.error(`${list.length} texte(s)`);
