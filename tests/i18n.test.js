/* Traduction (03/11/2026, Geoffrey ; I18N, src/i18n/) : t() et tn(), langue du compte, et complétude des
   dictionnaires : l'anglais ne s'ouvre aux joueurs (I18N.open) que lorsque plus rien ne manque. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { I18N } from '../src/config.js';
import { t, tn, setLang, getLang, isLang, guessLang, dictOf } from '../src/i18n/index.js';
import { createAccountService, AccountError } from '../server/accounts/service.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { FAST_SCRYPT } from './helpers.js';

test('t : français par défaut, anglais depuis le dictionnaire, valeurs {x} remplies, texte inconnu laissé en français', () => {
  setLang('fr');
  assert.equal(t('Langue'), 'Langue');
  assert.equal(t('Encore {n} tours', { n: 3 }), 'Encore 3 tours');
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(t('Langue'), 'Language');
  assert.equal(t('Texte pas encore traduit {n}', { n: 2 }), 'Texte pas encore traduit 2');
  assert.equal(t('Langue', null, 'fr'), 'Langue', 'une autre langue que celle en cours');
  setLang('xx'); assert.equal(getLang(), 'fr', 'langue inconnue : français');
});

test('tn : l\'identifiant français ne change jamais ; sans traduction, il s\'affiche tel quel', () => {
  setLang('en');
  assert.equal(tn('Nom inconnu'), 'Nom inconnu');
  assert.equal(tn(null), null);
  setLang('fr');
});

test('langue de départ : celle du navigateur seulement si l\'anglais est ouvert', () => {
  assert.equal(guessLang('en-US', true), 'en');
  assert.equal(guessLang('fr-FR', true), 'fr');
  assert.equal(guessLang('en-US', false), 'fr');
  assert.ok(isLang('fr') && isLang('en') && !isLang('de') && !isLang(3));
});

test('dictionnaires : textes non vides, mêmes valeurs {x} dans les deux langues', () => {
  for(const lang of I18N.langs.filter(l => l !== I18N.base)) for(const [kind, dict] of Object.entries(dictOf(lang))){
    for(const [fr, tr] of Object.entries(dict)){
      assert.ok(typeof tr === 'string' && tr.trim(), `${lang}/${kind} : « ${fr} » sans traduction`);
      const keys = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
      assert.equal(keys(tr), keys(fr), `${lang}/${kind} : « ${fr} » n'a pas les mêmes {valeurs}`);
    }
  }
});

/* textes passés à t('…') dans le code (littéraux seulement) */
function calledTexts(){
  const out = new Set(), walk = d => { for(const f of fs.readdirSync(d, { withFileTypes: true })){
    const p = path.join(d, f.name);
    if(f.isDirectory()){ if(f.name !== 'i18n') walk(p); continue; }
    if(!p.endsWith('.js')) continue;
    for(const m of fs.readFileSync(p, 'utf8').matchAll(/\bt\((['`"])((?:\\.|(?!\1).)*)\1/g)) if(!m[2].includes('${')) out.add(m[2].replace(/\\(['"`\\])/g, '$1'));
  } };
  walk('src'); walk('server');
  return out;
}

test('complétude : I18N.open seulement si chaque texte de t(…) a sa traduction anglaise', () => {
  const missing = [...calledTexts()].filter(fr => !Object.hasOwn(dictOf('en').ui, fr));
  if(I18N.open) assert.deepEqual(missing, [], 'textes sans traduction anglaise');
  else if(missing.length) console.log(`i18n : ${missing.length} texte(s) encore sans anglais (I18N.open est false)`);
});

/* ---------- langue sur le compte (serveur) ---------- */
async function account(){
  const store = createMemoryStore(), svc = createAccountService({ store, scrypt: FAST_SCRYPT });
  const r = await svc.register({ name: 'Zoe', password: 'motdepasse1', ip: '1.1.1.1', acceptRules: true });
  return { svc, id: r.account.id, account: r.account };
}

test('compte : français par défaut ; l\'anglais refusé tant qu\'il est fermé, sauf en mode dev ; langue inconnue refusée', async () => {
  const { svc, id, account: a } = await account();
  assert.equal(a.lang, 'fr');
  if(!I18N.open) await assert.rejects(svc.setLang(id, { lang: 'en' }), e => e instanceof AccountError && e.code === 'bad_lang');
  assert.equal((await svc.setLang(id, { lang: 'en' }, { dev: true })).account.lang, 'en');
  assert.equal((await svc.setLang(id, { lang: 'fr' })).account.lang, 'fr');
  await assert.rejects(svc.setLang(id, { lang: 'de' }, { dev: true }), e => e.code === 'bad_lang');
  await assert.rejects(svc.setLang(id, { lang: { x: 1 } }, { dev: true }), e => e.code === 'bad_lang');
});

/* noms de la config (objets, blocs, et champs name / label / boss / mob / tower / title) : même relevé que le glossaire du 06/11 */
async function configNames(){
  const C = await import('../src/config.js'), out = new Set();
  const isVariant = k => / R[1-7]( \S+)?$/.test(k) || / R[1-7] /.test(k);
  const skip = new Set(['angel', 'demon', 'any', 'gobelin', 'occultiste', 'bestiole', 'mephite', 'minotaure']);
  const add = n => { if(typeof n === 'string' && n.trim() && !skip.has(n)) out.add(n); };
  for(const k of Object.keys(C.ITEMS)) if(!isVariant(k)) add(k);
  for(const b of Object.values(C.BLOCKS)) add(b.name);
  for(const l of Object.values(C.STUFF.statLabels)) add(l);
  const walk = (o, d = 0) => { if(!o || typeof o !== 'object' || d > 6) return;
    for(const [k, v] of Object.entries(o)){ if(typeof v === 'string' && ['name', 'label', 'boss', 'mob', 'tower', 'title'].includes(k)) add(v); else if(v && typeof v === 'object') walk(v, d + 1); } };
  for(const [k, v] of Object.entries(C)) if(v && typeof v === 'object' && !['ITEMS', 'BLOCKS'].includes(k)) walk(v);
  return out;
}

test('noms : chaque nom de la config a son anglais (sinon il s\'affiche en français ; bloquant seulement à l\'ouverture)', async () => {
  const missing = [...await configNames()].filter(n => !Object.hasOwn(dictOf('en').names, n));
  if(I18N.open) assert.deepEqual(missing, [], 'noms sans anglais : à ajouter dans src/i18n/en/names.js');
  else if(missing.length) console.log(`i18n : ${missing.length} nom(s) sans anglais : ${missing.slice(0, 10).join(', ')}`);
});

test('noms affichés : objet, trésor béni, pièce de qualité, stat, en français et en anglais', async () => {
  const { itemName, pieceName } = await import('../src/meta/piece.js');
  const { ITEMS } = await import('../src/config.js');
  const blessed = Object.keys(ITEMS).find(k => ITEMS[k].chest?.luck && ITEMS[k].chest.side === 'demon' && ITEMS[k].chest.q === 5);
  setLang('fr');
  assert.equal(itemName(blessed), 'Antique Trésor démoniaque béni');
  assert.equal(pieceName({ item: 'Pioche en fer', q: 5, plus: 2 }), 'Antique : Pioche en fer +2');
  setLang('en');
  assert.equal(itemName(blessed), 'Ancient Blessed Demonic Treasure');
  assert.equal(pieceName({ item: 'Pioche en fer', q: 5, plus: 2 }), 'Ancient: Iron Pickaxe +2');
  assert.equal(itemName('Stonebrick angélique'), 'Angelic Stonebrick');
  setLang('fr');
});
