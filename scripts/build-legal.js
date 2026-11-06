/* Pages légales du site (01/11/2026) : transforme legal/<page>.md en <page>.html, à la racine, dans le style du wiki, sans script.
   Le texte est publié tel quel : seule la mise en forme change. Les passages [entre crochets] restent visibles, et l'outil les liste.

     npm run legal

   Mise en forme lue : titres #, listes - et 1., tableaux |, **gras**, *italique*, `code`, [liens](https://…), citations >, ---.
   Aucun HTML du fichier n'est interprété. Servies à /confidentialite, /mentions-legales, /conditions (SERVER.pages).
   Anglais (06/11/2026) : legal/en/*.md → /privacy, /legal-notice, /terms (+ /delete-account, écrite à la main). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEGAL_PAGES = { confidentialite: 'Politique de confidentialité', 'mentions-legales': 'Mentions légales', conditions: "Conditions générales d'utilisation" };
/* versions anglaises (06/11/2026) : legal/en/<page>.md → <page>.html ; chacune dit que la version française fait foi */
export const LEGAL_PAGES_EN = { privacy: { title: 'Privacy policy', fr: 'confidentialite' }, 'legal-notice': { title: 'Legal notice', fr: 'mentions-legales' },
  terms: { title: 'Terms of use', fr: 'conditions' } };

const esc = s => s.replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
function inline(raw){
  const code = [];
  return esc(raw.replace(/\\([[\]])/g, '$1')).replace(/`([^`]+)`/g, (_, c) => { code.push(c); return `\u0000${code.length - 1}\u0000`; })
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${code[+i]}</code>`);
}
const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export function mdToHtml(md){
  const lines = md.replace(/^﻿/, '').split(/\r?\n/), out = [];
  let i = 0;
  const run = rx => { const list = []; while(i < lines.length && rx.test(lines[i])) list.push(lines[i++]); return list; };
  while(i < lines.length){
    const l = lines[i];
    if(!l.trim()){ i++; continue; }
    const h = /^(#{1,6})\s+(.*?)\s*#*$/.exec(l);
    if(h){ out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if(/^\s*(-{3,}|\*{3,})\s*$/.test(l)){ out.push('<hr>'); i++; continue; }
    if(/^\s*[-*+]\s+/.test(l)){ out.push(`<ul>${run(/^\s*[-*+]\s+/).map(x => `<li>${inline(x.replace(/^\s*[-*+]\s+/, ''))}</li>`).join('')}</ul>`); continue; }
    if(/^\s*\d+[.)]\s+/.test(l)){ out.push(`<ol>${run(/^\s*\d+[.)]\s+/).map(x => `<li>${inline(x.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`); continue; }
    if(/^\s*>/.test(l)){ out.push(`<blockquote>${inline(run(/^\s*>/).map(x => x.replace(/^\s*>\s?/, '')).join(' '))}</blockquote>`); continue; }
    if(l.includes('|') && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '') && lines[i + 1].includes('-')){
      const head = cells(l); i += 2;
      const rows = run(/\|/).map(cells);
      out.push(`<div class="scroll"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const para = [];
    while(i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*+]\s+|\s*\d+[.)]\s+|\s*>)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}
/* passages à compléter : [texte] qui n'est pas un lien */
export const placeholders = md => [...md.replace(/\\([[\]])/g, '$1').matchAll(/\[([^\]\n]+)\](?!\()/g)].map(m => m[0]);

const CHROME = {
  fr: { play: '▶ Jouer', links: [['/confidentialite', 'Confidentialité'], ['/mentions-legales', 'Mentions légales'], ['/conditions', 'Conditions'], ['/suppression-compte', 'Supprimer son compte']] },
  en: { play: '▶ Play', links: [['/privacy', 'Privacy'], ['/legal-notice', 'Legal notice'], ['/terms', 'Terms'], ['/delete-account', 'Delete your account']] },
};
export const pageHtml = (title, body, lang = 'fr') => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Deep Mine Idle MMO</title>
<link rel="icon" type="image/png" sizes="32x32" href="textures/favicon-32.png">
<link rel="stylesheet" href="src/wiki/wiki.css">
</head>
<body>
<header class="top">
  <a class="brand" href="index.html">⛏ Deep Mine Idle MMO</a>
  <span class="sub">${esc(title)}</span>
  <a class="play" href="index.html">${CHROME[lang].play}</a>
</header>
<main>
<section>
${body}
</section>
<footer class="foot">${CHROME[lang].links.map(([u, t]) => `<a href="${u}">${t}</a>`).join(' · ')}</footer>
</main>
</body>
</html>
`;

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let missing = 0;
  for(const [page, title] of Object.entries(LEGAL_PAGES)){
    const src = path.join(root, 'legal', page + '.md');
    if(!fs.existsSync(src)){ console.error(`Manque legal/${page}.md`); missing++; continue; }
    const md = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(path.join(root, page + '.html'), pageHtml(title, mdToHtml(md)));
    const open = placeholders(md);
    console.log(`${page}.html écrit. Passages entre crochets : ${open.length ? open.join(' ; ') : 'aucun'}`);
  }
  for(const [page, { title }] of Object.entries(LEGAL_PAGES_EN)){
    const src = path.join(root, 'legal', 'en', page + '.md');
    if(!fs.existsSync(src)){ console.error(`Manque legal/en/${page}.md`); missing++; continue; }
    fs.writeFileSync(path.join(root, page + '.html'), pageHtml(title, mdToHtml(fs.readFileSync(src, 'utf8')), 'en'));
    console.log(`${page}.html écrit (anglais).`);
  }
  process.exit(missing ? 1 : 0);
}
