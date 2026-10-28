/* Bulles d'aide « ? » (src/ui/help.js, 28/10/2026) : chaque « ? » de la page a son texte, chaque texte sert, et
   « pris en compte à la prochaine session » n'est plus un paragraphe permanent. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HELP, qhelp, helpLine } from '../src/ui/help.js';
import { CRUSHER, FURNACE } from '../src/config.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css  = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
const keys = [...html.matchAll(/data-qhelp="([^"]+)"/g)].map(m => m[1]);
const section = id => html.match(new RegExp(`<section class="view" data-view="${id}"[^>]*>([\\s\\S]*?)</section>`))?.[1] ?? '';

test('chaque « ? » de la page a un texte, et chaque texte a son « ? »', () => {
  assert.ok(keys.length >= 20, `${keys.length} bulles`);
  for(const k of keys) assert.ok(HELP[k], `texte manquant pour « ${k} »`);
  for(const k of Object.keys(HELP)) assert.ok(keys.includes(k), `texte « ${k} » jamais utilisé`);
});

test('un texte d\'aide : un titre, puis au moins une ligne', () => {
  for(const [k, t] of Object.entries(HELP)){
    const lines = t.split('\n');
    assert.ok(lines.length >= 2 && lines.every(l => l.trim()), `« ${k} » : titre + lignes non vides`);
  }
});

test('qhelp : bulle d\'aide échappée, au clavier, avec un libellé facultatif', () => {
  const h = qhelp('Titre "x" <b>\nligne & co');
  assert.match(h, /class="qhelp"/);
  assert.match(h, /data-tipkind="help"/);
  assert.match(h, /tabindex="0"/);
  assert.match(h, /data-tip="Titre &quot;x&quot; &lt;b&gt;\nligne &amp; co"/);
  assert.doesNotMatch(h, /<b>\n/);
  assert.match(qhelp('T\nl', 'Règles'), /class="qhelp wide"[^>]*><b>\?<\/b>Règles<\/span>/);
  assert.match(helpLine('T\nl'), /^<p class="helpLine">.*Comment ça marche<\/span><\/p>$/s);
});

test('les chiffres des bulles viennent de la config', () => {
  assert.match(HELP.crusher, new RegExp(`${CRUSHER.batch} toutes les ${CRUSHER.time} s`));
  assert.match(HELP.furnace, new RegExp(`${FURNACE.orePerIngot} minerais \\+ ${FURNACE.fuelPerIngot} charbons`));
});

test('« prochaine session » : un bandeau en haut de Stuff, Skills et Sorts, visible seulement en session', () => {
  for(const v of ['stuff', 'skills', 'sorts']){
    const s = section(v);
    assert.match(s, /<p class="nextNote">[^<]*prochaine session/, `bandeau dans ${v}`);
    assert.equal((s.match(/prochaine session/g) ?? []).length, 1, `plus de paragraphe permanent dans ${v}`);
  }
  assert.match(css, /\.nextNote\{display:none/);
  assert.match(css, /body\.inSession \.nextNote\{display:block\}/);
});

test('les sous-titres d\'explication des onglets sont partis (remplacés par le « ? »)', () => {
  for(const t of ['Clique une recette pour la voir', 'Dépense tes Blueprint parts', 'Choisis un arbre : chaque étape',
                  'Appliquées à ton mineur pour toute la session', 'Clic sur un mineur : la caméra le suit.</p>'])
    assert.ok(!html.includes(t), `encore dans la page : ${t}`);
});
