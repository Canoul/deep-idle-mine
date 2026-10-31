/* Filtre du chat (30/10/2026, Geoffrey) : repère les mots interdits (server/moderation/words.js) et les remplace par des
   astérisques. Logique pure, sans état : le service (server/moderation/service.js) décide des avertissements.

   Normalisation d'un texte, lettre par lettre, en gardant pour chaque lettre sa place dans le texte d'origine (pour
   masquer exactement ce qu'il a écrit) : minuscules, accents retirés, lettres déguisées traduites (leetspeak, lettres
   cyrilliques qui ressemblent aux latines, œ/æ) ; tout le reste (espaces, ponctuation, emojis) est un séparateur.
   - forme « espacée » : les mots séparés par une espace (recherche en mot entier, liste WORD) ;
   - forme « collée » : les lettres seules (recherche des mots STRICT même découpés : « n i g g e r », « n.1.g.g.e.r »).
   Lettres répétées acceptées partout (« niiiigger », « connnnard »). */
import { STRICT, WORD } from './words.js';
import { MODERATION } from '../../src/config.js';

const LEET = { '0':'o', '1':'i', '!':'i', '|':'i', '3':'e', '€':'e', '4':'a', '@':'a', '5':'s', '$':'s', '7':'t', '8':'b', '9':'g', '¡':'i' };
const HOMO = { 'а':'a', 'е':'e', 'о':'o', 'і':'i', 'ı':'i', 'с':'c', 'р':'p', 'х':'x', 'у':'y', 'к':'k', 'м':'m', 'т':'t', 'в':'b', 'н':'h', 'ѕ':'s' };
const LIG = { 'œ':'oe', 'æ':'ae', 'ß':'ss' };

/* lettres normalisées d'un caractère (0, 1 ou 2 lettres) */
function lettersOf(ch){
  const lower = ch.toLowerCase();
  if(LIG[lower]) return LIG[lower];
  if(HOMO[lower]) return HOMO[lower];
  if(LEET[lower]) return LEET[lower];
  const base = lower.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return /^[a-z]$/.test(base) ? base : '';
}

/* { spaced, spacedMap, squeezed, squeezedMap } ; *Map[i] = position (unités UTF-16) du caractère d'origine de la lettre i,
   et sa longueur (pour masquer les caractères sur deux unités) */
export function normalize(text){
  let spaced = '', squeezed = '';
  const spacedMap = [], squeezedMap = [];
  let i = 0;
  const chars = [...String(text)];
  chars.forEach((ch, k) => {
    const at = { start: i, end: i + ch.length };
    i += ch.length;
    /* « ! » et « | » ne valent « i » qu'entre deux lettres (« n!gger »), pas en fin de phrase */
    const inWord = c => !!c && /^[a-z]$/.test(lettersOf(c));
    const l = (ch === '!' || ch === '|') && !(inWord(chars[k - 1]) && inWord(chars[k + 1])) ? '' : lettersOf(ch);
    if(!l){ if(spaced && !spaced.endsWith(' ')){ spaced += ' '; spacedMap.push(at); } return; }
    for(const c of l){ spaced += c; spacedMap.push(at); squeezed += c; squeezedMap.push(at); }
  });
  if(spaced.endsWith(' ')){ spaced = spaced.slice(0, -1); spacedMap.pop(); }
  return { spaced, spacedMap, squeezed, squeezedMap };
}

/* motif d'une entrée → expression régulière : chaque lettre peut être répétée, une espace = un ou plusieurs séparateurs */
const pattern = re => re.replace(/[a-z]/g, c => `(?:${c}+)`).replace(/ /g, ' +');
const STRICT_RE = STRICT.map(e => ({ ...e, rx: new RegExp(pattern(e.re), 'g') }));
const WORD_RE = WORD.map(e => ({ ...e, rx: new RegExp(`(?<![a-z])(?:${pattern(e.re)})(?:s|x)?(?![a-z])`, 'g') }));

/* toutes les occurrences : [{ start, end (positions dans le texte d'origine), word, motif }] */
export function findBanned(text){
  const n = normalize(text), out = [];
  const scan = (list, str, map) => {
    for(const e of list){
      e.rx.lastIndex = 0;
      for(let m; (m = e.rx.exec(str)); ){
        if(!m[0].length){ e.rx.lastIndex++; continue; }
        out.push({ start: map[m.index].start, end: map[m.index + m[0].length - 1].end, word: e.re, motif: e.motif });
      }
    }
  };
  scan(STRICT_RE, n.squeezed, n.squeezedMap);
  scan(WORD_RE, n.spaced, n.spacedMap);
  return out;
}

/* Pseudo interdit (31/10/2026, Geoffrey) : la liste du chat, sur le pseudo tel quel et découpé à ses majuscules (un pseudo n'a
   pas d'espace : « SaleConnard » = « Sale Connard »). Les mots WORD restent en mot entier : « Conan » et « Falcon » passent. */
export const nameBanned = name => {
  const n = String(name ?? '');
  return findBanned(n).length > 0 || findBanned(n.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')).length > 0;
};

/* remplace par « * » les caractères (hors espaces) des passages donnés */
export function mask(text, spans){
  const chars = String(text).split('');
  for(const s of spans) for(let i = s.start; i < s.end; i++) if(!/\s/.test(chars[i])) chars[i] = '*';
  return chars.join('');
}

/* Mots STRICT coupés entre des messages qui se suivent (« ni » puis « gger », du même joueur ou d'un autre).
   prev : les messages précédents du salon, du plus ancien au plus récent ({ text, account, name }) ; seuls les
   MODERATION.joinMessages derniers comptent (au service de ne donner que ceux des MODERATION.joinWindowMs dernières ms).
   Renvoie les occurrences qui commencent dans un message précédent et finissent dans le nouveau :
   [{ start, end (dans le nouveau texte), word, motif, with: [{ account, name }] (auteurs des morceaux d'avant) }]. */
export function findJoined(prev, text){
  const before = (prev || []).slice(-MODERATION.joinMessages).map(m => ({ m, n: normalize(m.text) }));
  const cur = normalize(text);
  if(!before.length || !cur.squeezed) return [];
  let joined = '';
  const owner = [];                        // pour chaque lettre de joined : index du message d'avant (-1 = le nouveau)
  before.forEach((b, k) => { joined += b.n.squeezed; for(const _ of b.n.squeezed) owner.push(k); });
  const offset = joined.length;
  joined += cur.squeezed; for(const _ of cur.squeezed) owner.push(-1);
  const out = [];
  for(const e of STRICT_RE){
    e.rx.lastIndex = 0;
    for(let m; (m = e.rx.exec(joined)); ){
      if(!m[0].length){ e.rx.lastIndex++; continue; }
      const a = m.index, b = m.index + m[0].length;
      if(!(a < offset && b > offset)) continue;            // tout d'un côté : déjà vu message par message
      const who = [...new Set(owner.slice(a, offset))].map(k => before[k].m);
      out.push({ start: cur.squeezedMap[0].start, end: cur.squeezedMap[b - offset - 1].end, word: e.re, motif: e.motif,
                 with: who.map(w => ({ account: w.account, name: w.name })) });
    }
  }
  return out;
}

/* le texte à publier et ce qui a été trouvé : { text (masqué), hits: [{ word, motif, with? }] } */
export function moderate(text, prev = []){
  const hits = [...findBanned(text), ...findJoined(prev, text)];
  return { text: hits.length ? mask(text, hits) : text, hits };
}
