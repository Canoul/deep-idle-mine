/* Traducteur de la page (06/11/2026, src/i18n/dom.js) : textes exacts, modèles {x}, garde-fous */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from '../src/i18n/dom.js';
import UI from '../src/i18n/en/ui.js';
import NAMES from '../src/i18n/en/names.js';

const tr = createTranslator(UI, NAMES);

test('texte exact, espaces du bord gardés, ligne par ligne (data-tip)', () => {
  assert.equal(tr('  Lancer la session '), '  Launch the session ');
  assert.equal(tr('Inventaire\nPioche en fer'), 'Inventory\nIron Pickaxe');
});

test('modèles : nombres, valeur vide (pluriel), noms traduits dans la valeur, début collé (R3)', () => {
  assert.equal(tr('12 points à dépenser'), '12 points to spend');
  assert.equal(tr('0 point à dépenser'), '0 point to spend');
  assert.equal(tr('R3 Haute qualité'), 'R3 High Quality');
  assert.equal(tr("5 Pépite d'argent"), '5 Silver Nugget');
  assert.equal(tr('Mineur test 1'), 'Mineur test 1', '{#n} : un nombre seulement');
});

test('garde-fou : un modèle court ne traduit jamais un mot au milieu d\'une phrase française', () => {
  const s = 'apprends encore 10 recettes du Tier 1 et 4 recettes du Tier 2';
  assert.equal(tr(s), s);
  assert.equal(tr('Une phrase inconnue sur la mine'), 'Une phrase inconnue sur la mine');
});

test('sans lettre ou inconnu : inchangé ; relevé des manquants', () => {
  const seen = [];
  const t2 = createTranslator(UI, NAMES, { onMissing: (t, fr) => seen.push([t, fr]) });
  assert.equal(t2('42'), '42');
  assert.equal(t2('Texte jamais vu dans le jeu'), 'Texte jamais vu dans le jeu');
  assert.deepEqual(seen, [['Texte jamais vu dans le jeu', true]]);
});

test('ligne en morceaux « a · b » et valeur « nombre + mot » traduites ; un modèle sans mot fixe n\'invente rien', () => {
  assert.equal(tr('0 run · 1 s de jeu · +0 XP · +0 ⚡ · 0 objet'), '0 run · 1 s of play · +0 XP · +0 ⚡ · 0 item');
  assert.equal(tr(': 10 énergie à gagner ! Tirage dans 2 min'), ': 10 energy to win! Draw in 2 min');
  assert.equal(tr('3 Truc inconnu'), '3 Truc inconnu');
});

test('pseudos et messages des joueurs : protégés par pn() (data-noi18n)', async () => {
  const { pn } = await import('../src/i18n/index.js');
  assert.equal(pn('Mineur <b>'), '<bdi data-noi18n>Mineur &lt;b&gt;</bdi>');
});

/* wiki (06/11/2026) : modèles {*x}, listes de noms, mots inconnus en minuscules, dictionnaire des blocs */
test('wiki : {*x} = valeur traduisible en entier, liste de noms, « Le donjon » pas en « The donjon »', () => {
  assert.equal(tr('Ténacité +3 % par rang (max : Ténacité +9 %)'), 'Tenacity +3 % per rank (max: Tenacity +9 %)');
  assert.equal(tr("Ingrédient : Épée en mithril, Clé d'instance I"), 'Ingredient: Mithril Sword, Instance Key I');
  assert.equal(tr('Le machin'), 'Le machin', 'modèle court : un mot inconnu en minuscules le fait rejeter');
  assert.equal(tr('Le Golbute'), 'The Golbute');
});

test('wiki : chaque bloc garde ses balises et ses valeurs ; un bloc modèle ({#n}) suit les chiffres de la config', async () => {
  const BLOCKS = (await import('../src/i18n/en/wiki.js')).default;
  const tags = s => (s.match(/<\/?[a-z]+/g) ?? []).join(',');
  for(const [fr, en] of Object.entries(BLOCKS)){
    assert.equal(tags(en), tags(fr), `balises : ${fr.slice(0, 60)}`);
    const vars = s => new Set([...s.matchAll(/\{[#*]?(\w+)\}/g)].map(m => m[1]));
    for(const k of vars(en)) assert.ok(vars(fr).has(k), `{${k}} inconnue : ${fr.slice(0, 60)}`);
  }
  const bt = createTranslator(BLOCKS, NAMES);
  assert.equal(bt('<b>Danger :</b> le tacle.'), '<b>Danger:</b> tackles it.');
  assert.match(bt("<b>À partir de :</b> l'area 3 · <b>PV :</b> 130 au départ, +15 % par area plus profonde · <b>Vitesse :</b> 1.11 case/s"), /^<b>From:<\/b> area 3 · <b>HP:<\/b> 130 at the start, \+15% per deeper area/);
});
